import { db, schema } from "@/lib/db";
import { eq } from "drizzle-orm";
import { isAuthed } from "@/lib/admin";
import { saveUpload, StorageError } from "@/lib/storage";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const MAX_MEDIA_ITEMS = 20;
const BLOB_HOST = /^https:\/\/[a-z0-9.-]+\.blob\.vercel-storage\.com\//i;

/** Admin: attach media to an existing post. Accepts the same FormData shape as
 *  /api/posts — inline files (media[]) for local dev, or already-uploaded
 *  Vercel Blob URLs (mediaUrl[]/mediaType[]/mediaMime[]) on Vercel. */
export async function POST(
  req: Request,
  ctx: { params: Promise<{ id: string }> },
) {
  if (!(await isAuthed())) {
    return Response.json({ error: "Unauthorized" }, { status: 401 });
  }
  const { id } = await ctx.params;

  const [post] = await db
    .select()
    .from(schema.posts)
    .where(eq(schema.posts.id, id))
    .limit(1)
    .all();
  if (!post) return Response.json({ error: "Not found" }, { status: 404 });

  let form: FormData;
  try {
    form = await req.formData();
  } catch {
    return Response.json({ error: "Invalid form data" }, { status: 400 });
  }

  const durations = form.getAll("durationMs").map((v) => Number(v) || null);
  const widths = form.getAll("width").map((v) => Number(v) || null);
  const heights = form.getAll("height").map((v) => Number(v) || null);

  const saved: Array<{
    url: string;
    type: "audio" | "image" | "video";
    mime: string;
    durationMs: number | null;
    width: number | null;
    height: number | null;
  }> = [];

  const files = form.getAll("media[]").filter((v): v is File => v instanceof File);
  try {
    for (let i = 0; i < files.length; i++) {
      const s = await saveUpload(files[i]);
      saved.push({
        url: s.url,
        type: s.type,
        mime: s.mime,
        durationMs: durations[i] ?? null,
        width: widths[i] ?? null,
        height: heights[i] ?? null,
      });
    }
  } catch (e) {
    const status = e instanceof StorageError ? e.status : 500;
    return Response.json(
      { error: e instanceof Error ? e.message : "Upload failed" },
      { status },
    );
  }

  const blobUrls = form.getAll("mediaUrl[]").map(String);
  const blobTypes = form.getAll("mediaType[]").map(String);
  const blobMimes = form.getAll("mediaMime[]").map(String);
  for (let i = 0; i < blobUrls.length; i++) {
    const url = blobUrls[i];
    const type = blobTypes[i];
    if (!BLOB_HOST.test(url)) continue;
    if (type !== "audio" && type !== "image" && type !== "video") continue;
    saved.push({
      url,
      type,
      mime: blobMimes[i] || "application/octet-stream",
      durationMs: durations[i] ?? null,
      width: widths[i] ?? null,
      height: heights[i] ?? null,
    });
  }

  if (saved.length === 0) {
    return Response.json({ error: "No media to add" }, { status: 400 });
  }

  const existing = await db
    .select()
    .from(schema.mediaItems)
    .where(eq(schema.mediaItems.postId, id))
    .all();
  if (existing.length + saved.length > MAX_MEDIA_ITEMS) {
    return Response.json(
      { error: `Too many attachments (max ${MAX_MEDIA_ITEMS})` },
      { status: 400 },
    );
  }
  let pos = existing.reduce((m, x) => Math.max(m, x.position), -1) + 1;

  await db.insert(schema.mediaItems).values(
    saved.map((s) => ({
      postId: id,
      type: s.type,
      url: s.url,
      mime: s.mime,
      durationMs: s.durationMs,
      width: s.width,
      height: s.height,
      waveformPeaks: null,
      position: pos++,
    })),
  );

  return Response.json({ ok: true, added: saved.length });
}
