import fs from "node:fs/promises";
import path from "node:path";
import { randomUUID } from "node:crypto";

/**
 * Local-disk media storage. Saves uploads under `public/uploads/<yyyy>/<mm>/`
 * so they're served by Next.js as static assets at /uploads/...
 *
 * Production note: serverless deploys (Vercel) lose disk on cold start.
 * Swap this module for `@vercel/blob` when deploying — see DEPLOY.md.
 */

const UPLOAD_ROOT = path.join(process.cwd(), "public", "uploads");

export const SIZE_LIMITS = {
  audio: 25 * 1024 * 1024, // 25 MB
  image: 15 * 1024 * 1024, // 15 MB
  video: 200 * 1024 * 1024, // 200 MB
} as const;

export const MIME_TO_TYPE: Record<string, "audio" | "image" | "video"> = {
  // audio
  "audio/webm": "audio",
  "audio/ogg": "audio",
  "audio/mpeg": "audio",
  "audio/mp4": "audio",
  "audio/x-m4a": "audio",
  "audio/wav": "audio",
  "audio/wave": "audio",
  // image
  "image/jpeg": "image",
  "image/png": "image",
  "image/webp": "image",
  "image/gif": "image",
  "image/heic": "image",
  "image/heif": "image",
  // video
  "video/mp4": "video",
  "video/webm": "video",
  "video/quicktime": "video",
};

export const EXT_FOR_MIME: Record<string, string> = {
  "audio/webm": "webm",
  "audio/ogg": "ogg",
  "audio/mpeg": "mp3",
  "audio/mp4": "m4a",
  "audio/x-m4a": "m4a",
  "audio/wav": "wav",
  "audio/wave": "wav",
  "image/jpeg": "jpg",
  "image/png": "png",
  "image/webp": "webp",
  "image/gif": "gif",
  "image/heic": "heic",
  "image/heif": "heif",
  "video/mp4": "mp4",
  "video/webm": "webm",
  "video/quicktime": "mov",
};

export interface SavedFile {
  url: string;
  type: "audio" | "image" | "video";
  mime: string;
  size: number;
}

/**
 * Save a single uploaded File to disk. Returns its public URL and the
 * media type, or throws if the mime/size isn't acceptable.
 */
export async function saveUpload(file: File): Promise<SavedFile> {
  // MediaRecorder emits types like "video/webm;codecs=vp9,opus" — strip the
  // codec parameters before checking the allowlist.
  const mime = (file.type || "").toLowerCase().split(";")[0].trim();
  const type = MIME_TO_TYPE[mime];
  if (!type) {
    throw new StorageError(`Unsupported file type: ${mime || "unknown"}`, 415);
  }
  const limit = SIZE_LIMITS[type];
  if (file.size > limit) {
    throw new StorageError(
      `${type} file too large (${formatBytes(file.size)} > ${formatBytes(limit)})`,
      413,
    );
  }

  const now = new Date();
  const yyyy = String(now.getUTCFullYear());
  const mm = String(now.getUTCMonth() + 1).padStart(2, "0");
  const ext = EXT_FOR_MIME[mime] ?? "bin";
  const filename = `${randomUUID()}.${ext}`;
  const key = `uploads/${yyyy}/${mm}/${filename}`;

  const buf = Buffer.from(await file.arrayBuffer());

  // Hosts with a read-only/ephemeral filesystem (Vercel) → Vercel Blob.
  // Local dev → write under public/ so it's served at /uploads/...
  if (process.env.BLOB_READ_WRITE_TOKEN) {
    const { put } = await import("@vercel/blob");
    const { url } = await put(key, buf, { access: "public", contentType: mime });
    return { url, type, mime, size: file.size };
  }

  const dir = path.join(UPLOAD_ROOT, yyyy, mm);
  await fs.mkdir(dir, { recursive: true });
  await fs.writeFile(path.join(dir, filename), buf);

  return { url: `/${key}`, type, mime, size: file.size };
}

export class StorageError extends Error {
  status: number;
  constructor(message: string, status = 400) {
    super(message);
    this.status = status;
  }
}

function formatBytes(n: number): string {
  if (n < 1024) return `${n} B`;
  if (n < 1024 * 1024) return `${(n / 1024).toFixed(1)} KB`;
  return `${(n / (1024 * 1024)).toFixed(1)} MB`;
}
