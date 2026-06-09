#!/usr/bin/env node
// Generate lightweight display versions of everything under public/uploads/ into
// public/uploads/_c/, mirroring the directory layout:
//   images  -> .webp  (max 1600px, quality 80)
//   videos  -> .mp4   (H.264, max 1280px long edge, faststart)
//   audio   -> skipped (served as-is)
//
// Originals are left untouched (used for "download all"). The site displays the
// _c/ versions via lib/site.ts `displayUrl()`. Idempotent: skips outputs that
// are newer than their source.
//
//   node scripts/compress-media.mjs

import { spawnSync } from "node:child_process";
import fs from "node:fs";
import path from "node:path";
import ffmpegPath from "ffmpeg-static";
import sharp from "sharp";

const ROOT = process.cwd();
const SRC = path.join(ROOT, "public", "uploads");
const OUT = path.join(SRC, "_c");

const IMAGE_EXT = new Set([".jpg", ".jpeg", ".png", ".webp", ".gif", ".heic", ".heif"]);
const VIDEO_EXT = new Set([".mov", ".mp4", ".webm", ".m4v"]);

function* walk(dir) {
  for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
    const p = path.join(dir, e.name);
    if (e.isDirectory()) {
      if (p === OUT) continue; // never recurse into the output dir
      yield* walk(p);
    } else {
      yield p;
    }
  }
}

function isFresh(src, out) {
  return fs.existsSync(out) && fs.statSync(out).mtimeMs >= fs.statSync(src).mtimeMs;
}

let images = 0, videos = 0, skipped = 0;

for (const src of walk(SRC)) {
  const ext = path.extname(src).toLowerCase();
  const rel = path.relative(SRC, src);
  const base = rel.slice(0, -ext.length);

  if (IMAGE_EXT.has(ext)) {
    const out = path.join(OUT, base + ".webp");
    if (isFresh(src, out)) { skipped++; continue; }
    fs.mkdirSync(path.dirname(out), { recursive: true });
    await sharp(src)
      .rotate()
      .resize(1600, 1600, { fit: "inside", withoutEnlargement: true })
      .webp({ quality: 80 })
      .toFile(out);
    images++;
    console.log("img ", rel, "->", path.relative(SRC, out));
  } else if (VIDEO_EXT.has(ext)) {
    const out = path.join(OUT, base + ".mp4");
    if (isFresh(src, out)) { skipped++; continue; }
    fs.mkdirSync(path.dirname(out), { recursive: true });
    const r = spawnSync(
      ffmpegPath,
      [
        "-y", "-i", src,
        "-vf", "scale='min(1280,iw)':'min(1280,ih)':force_original_aspect_ratio=decrease,scale=trunc(iw/2)*2:trunc(ih/2)*2",
        "-c:v", "libx264", "-crf", "26", "-preset", "medium", "-pix_fmt", "yuv420p",
        "-movflags", "+faststart",
        "-c:a", "aac", "-b:a", "128k",
        out,
      ],
      { stdio: ["ignore", "ignore", "inherit"] },
    );
    if (r.status !== 0) {
      // e.g. audio-only .webm recordings — no compressed video needed, served as-is.
      console.warn("skip (ffmpeg can't process):", rel);
      continue;
    }
    videos++;
    console.log("vid ", rel, "->", path.relative(SRC, out));
  }
}

console.log(`\nDone. images: ${images}, videos: ${videos}, skipped(fresh): ${skipped}`);
