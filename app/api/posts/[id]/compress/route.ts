import { db, schema } from "@/lib/db";
import { eq } from "drizzle-orm";
import { rateLimit, getClientIp } from "@/lib/rate-limit";
import { transcodeVideoToH264, isCompressedVideo, isBlobUrl } from "@/lib/video";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
// Transcoding can take a while; Fluid Compute allows long-running functions.
export const maxDuration = 300;

/**
 * Transcode a post's Blob-hosted videos to web-friendly H.264 MP4 (smaller =
 * lower bandwidth/storage fees) and repoint the media rows at the compressed
 * file, deleting the original Blob. Idempotent: media already under
 * `compressed/` or served from the committed /uploads tree are skipped.
 *
 * Called fire-and-forget by the composer (and admin) after an upload, and can
 * be re-run for existing posts. Unauthenticated but rate-limited and harmless
 * (it only re-encodes media already attached to a real post).
 */
export async function POST(
  req: Request,
  ctx: { params: Promise<{ id: string }> },
) {
  const ip = getClientIp(req);
  const rl = rateLimit({
    key: `compress:${ip}`,
    limit: 30,
    windowMs: 10 * 60 * 1000,
  });
  if (!rl.ok) {
    return Response.json({ error: "Slow down" }, { status: 429 });
  }

  const { id } = await ctx.params;

  const media = await db
    .select()
    .from(schema.mediaItems)
    .where(eq(schema.mediaItems.postId, id))
    .all();

  const targets = media.filter(
    (m) => m.type === "video" && isBlobUrl(m.url) && !isCompressedVideo(m.url),
  );

  let compressed = 0;
  for (const m of targets) {
    const result = await transcodeVideoToH264(m.url);
    if (!result) continue;
    const oldUrl = m.url;
    await db
      .update(schema.mediaItems)
      .set({ url: result.url, mime: "video/mp4" })
      .where(eq(schema.mediaItems.id, m.id));
    compressed++;
    try {
      const { del } = await import("@vercel/blob");
      await del(oldUrl);
    } catch {
      /* best-effort cleanup of the original */
    }
  }

  return Response.json({ ok: true, targets: targets.length, compressed });
}
