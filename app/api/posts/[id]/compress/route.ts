import { db, schema } from "@/lib/db";
import { eq } from "drizzle-orm";
import { after } from "next/server";
import { rateLimit, getClientIp } from "@/lib/rate-limit";
import { transcodeVideoToH264, isCompressedVideo, isBlobUrl } from "@/lib/video";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
// Transcoding a long clip can take 1–2 min; Fluid Compute allows it.
export const maxDuration = 300;

/**
 * Transcode a post's Blob-hosted videos to web-friendly H.264 MP4 (smaller =
 * lower bandwidth/storage fees) and repoint the media rows at the compressed
 * file, deleting the original Blob. Idempotent: media already under
 * `compressed/` or served from the committed /uploads tree are skipped.
 *
 * The actual transcode runs in `after()` — i.e. AFTER the response is sent —
 * so it isn't bound to the caller's connection. A fire-and-forget client fetch
 * would otherwise be cancelled (killing the transcode) the moment the page
 * navigates or refreshes, which is exactly what left earlier videos unconverted.
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

  if (targets.length > 0) {
    after(async () => {
      for (const m of targets) {
        const result = await transcodeVideoToH264(m.url);
        if (!result) continue;
        await db
          .update(schema.mediaItems)
          .set({ url: result.url, mime: "video/mp4" })
          .where(eq(schema.mediaItems.id, m.id));
        try {
          const { del } = await import("@vercel/blob");
          await del(m.url);
        } catch {
          /* best-effort cleanup of the original */
        }
      }
    });
  }

  return Response.json({ ok: true, targets: targets.length, queued: targets.length });
}
