import type { Attachment } from "./types";

/**
 * Convert a list of dropped/picked files into Attachments.
 *  - HEIC/HEIF images are converted to JPEG in the browser (heic2any).
 *  - Non image/video files are ignored.
 *  - Reads dimensions (images) and dimensions+duration (video) for tiling.
 */
export async function filesToAttachments(
  files: FileList | File[] | null,
): Promise<Attachment[]> {
  if (!files) return [];
  const arr = Array.from(files);
  const out: Attachment[] = [];
  for (const f of arr) {
    // Best-effort client conversion; if it fails the raw HEIC is kept and the
    // server converts it on upload (so the photo is never silently dropped).
    const converted = await maybeConvertHeic(f);
    const isImage =
      converted.type.startsWith("image/") ||
      /\.(heic|heif)$/i.test(converted.name);
    const isVideo = converted.type.startsWith("video/");
    if (!isImage && !isVideo) continue;
    // Shrink large photos in the browser so the upload stays under the server's
    // request-body limit (Vercel functions cap at ~4.5MB).
    const file = isImage ? await compressImageFile(converted) : converted;
    out.push(await fileToAttachment(file, isImage ? "image" : "video"));
  }
  return out;
}

/**
 * Downscale (max 2048px on the long edge) and re-encode an image to JPEG so big
 * phone photos upload reliably. Returns the original if it can't be processed
 * or compression wouldn't help.
 */
async function compressImageFile(file: File): Promise<File> {
  const MAX_EDGE = 2048;
  const SKIP_BELOW = 3_500_000; // bytes — small files don't need it
  let url: string | null = null;
  try {
    url = URL.createObjectURL(file);
    const img = await new Promise<HTMLImageElement>((resolve, reject) => {
      const im = new Image();
      im.onload = () => resolve(im);
      im.onerror = reject;
      im.src = url as string;
    });
    const w0 = img.naturalWidth;
    const h0 = img.naturalHeight;
    if (!w0 || !h0) return file;
    const scale = Math.min(1, MAX_EDGE / Math.max(w0, h0));
    if (scale === 1 && file.size <= SKIP_BELOW) return file;
    const w = Math.round(w0 * scale);
    const h = Math.round(h0 * scale);
    const canvas = document.createElement("canvas");
    canvas.width = w;
    canvas.height = h;
    const ctx = canvas.getContext("2d");
    if (!ctx) return file;
    ctx.drawImage(img, 0, 0, w, h);
    const blob = await new Promise<Blob | null>((resolve) =>
      canvas.toBlob((b) => resolve(b), "image/jpeg", 0.82),
    );
    if (!blob || (blob.size >= file.size && scale === 1)) return file;
    const name = file.name.replace(/\.[^.]+$/, "") + ".jpg";
    return new File([blob], name, { type: "image/jpeg" });
  } catch {
    return file;
  } finally {
    if (url) URL.revokeObjectURL(url);
  }
}

/**
 * HEIC/HEIF → JPEG (best effort, in-browser via heic2any). Returns the original
 * file for everything else, and — crucially — returns the original HEIC
 * untouched if conversion fails, so the caller can still upload it and let the
 * server convert it. Never drops the file.
 */
export async function maybeConvertHeic(file: File): Promise<File> {
  const isHeic =
    /image\/hei[cf]/i.test(file.type) || /\.(heic|heif)$/i.test(file.name);
  if (!isHeic) return file;
  try {
    const heic2any = (await import("heic2any")).default;
    const result = await heic2any({
      blob: file,
      toType: "image/jpeg",
      quality: 0.9,
    });
    const blob = Array.isArray(result) ? result[0] : result;
    const name = file.name.replace(/\.(heic|heif)$/i, ".jpg") || "photo.jpg";
    return new File([blob], name, { type: "image/jpeg" });
  } catch {
    // Couldn't convert in the browser (common — heic2any fails on many real
    // iPhone HEICs). Keep the original; the server converts it on upload.
    return file;
  }
}

async function fileToAttachment(
  file: File,
  kind: "image" | "video",
): Promise<Attachment> {
  const previewUrl = URL.createObjectURL(file);
  const base: Attachment = {
    id: cryptoRandomId(),
    file,
    type: kind,
    previewUrl,
    source: "uploaded",
  };
  try {
    if (kind === "image") {
      const dims = await readImageDimensions(previewUrl);
      base.width = dims.width;
      base.height = dims.height;
    } else {
      const meta = await readVideoMetadata(previewUrl);
      base.width = meta.width;
      base.height = meta.height;
      base.durationMs = meta.durationMs;
    }
  } catch {
    /* metadata is optional */
  }
  return base;
}

function readImageDimensions(url: string): Promise<{ width: number; height: number }> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => resolve({ width: img.naturalWidth, height: img.naturalHeight });
    img.onerror = reject;
    img.src = url;
  });
}

function readVideoMetadata(
  url: string,
): Promise<{ width: number; height: number; durationMs: number }> {
  return new Promise((resolve, reject) => {
    const v = document.createElement("video");
    v.preload = "metadata";
    v.onloadedmetadata = () => {
      resolve({
        width: v.videoWidth,
        height: v.videoHeight,
        durationMs: Math.round(v.duration * 1000),
      });
    };
    v.onerror = reject;
    v.src = url;
  });
}

function cryptoRandomId(): string {
  if (typeof crypto !== "undefined" && "randomUUID" in crypto) return crypto.randomUUID();
  return Math.random().toString(36).slice(2);
}
