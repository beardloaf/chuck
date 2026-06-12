import { spawnSync } from "node:child_process";
import {
  mkdtempSync,
  writeFileSync,
  readFileSync,
  rmSync,
  chmodSync,
} from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { randomUUID } from "node:crypto";

const BLOB_HOST = /^https:\/\/[a-z0-9.-]+\.blob\.vercel-storage\.com\//i;

/** A media URL we've already transcoded — skip to stay idempotent. */
export function isCompressedVideo(url: string): boolean {
  return url.includes("/compressed/");
}

export function isBlobUrl(url: string): boolean {
  return BLOB_HOST.test(url);
}

/**
 * Download a video, transcode it to a web-friendly H.264 MP4 (long edge capped
 * at 1280px, faststart, AAC audio) with the bundled ffmpeg binary, upload the
 * result to Vercel Blob under `compressed/…`, and return its URL.
 *
 * Returns null on any failure so the caller can leave the original in place.
 * Runs on Node (Vercel Fluid Compute) and locally. The `ffmpeg-static` binary
 * is shipped into the function via `outputFileTracingIncludes` in next.config.
 */
export async function transcodeVideoToH264(
  srcUrl: string,
): Promise<{ url: string } | null> {
  let ffmpegPath: string | null = null;
  try {
    const mod = (await import("ffmpeg-static")) as unknown as {
      default?: string;
    };
    ffmpegPath = mod.default ?? null;
  } catch {
    return null;
  }
  if (!ffmpegPath) return null;
  try {
    chmodSync(ffmpegPath, 0o755);
  } catch {
    /* binary may already be executable / read-only fs — try anyway */
  }

  let input: Buffer;
  try {
    const res = await fetch(srcUrl);
    if (!res.ok) return null;
    input = Buffer.from(await res.arrayBuffer());
  } catch {
    return null;
  }

  const dir = mkdtempSync(join(tmpdir(), "vid-"));
  const inPath = join(dir, "input");
  const outPath = join(dir, "out.mp4");
  try {
    writeFileSync(inPath, input);
    const r = spawnSync(
      ffmpegPath,
      [
        "-y",
        "-i",
        inPath,
        "-vf",
        "scale='min(1280,iw)':'min(1280,ih)':force_original_aspect_ratio=decrease,scale=trunc(iw/2)*2:trunc(ih/2)*2",
        "-c:v",
        "libx264",
        "-crf",
        "26",
        "-preset",
        "veryfast",
        "-pix_fmt",
        "yuv420p",
        "-movflags",
        "+faststart",
        "-c:a",
        "aac",
        "-b:a",
        "128k",
        outPath,
      ],
      { maxBuffer: 1 << 27 },
    );
    if (r.status !== 0) return null;
    const out = readFileSync(outPath);
    const { put } = await import("@vercel/blob");
    const { url } = await put(`compressed/${randomUUID()}.mp4`, out, {
      access: "public",
      contentType: "video/mp4",
      addRandomSuffix: false,
    });
    return { url };
  } catch {
    return null;
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
}
