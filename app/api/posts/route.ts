import { z } from "zod";
import { randomUUID } from "node:crypto";
import { db, schema } from "@/lib/db";
import { desc, eq, lt, and, inArray } from "drizzle-orm";
import { rateLimit, getClientIp } from "@/lib/rate-limit";
import { saveUpload, StorageError, convertRemoteHeicToJpeg } from "@/lib/storage";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// ---------- shared payload caps ----------
const MAX_AUTHOR = 80;
const MAX_TITLE = 200;
const MAX_BODY = 20_000;
const MAX_MEDIA_ITEMS = 20;
const RATE_LIMIT = 5;
const RATE_WINDOW_MS = 10 * 60 * 1000;

// ---------- POST: create (lands as "pending") ----------
const PeaksSchema = z.array(z.number().int().min(0).max(255)).max(512);

export async function POST(req: Request) {
  const ip = getClientIp(req);
  const rl = rateLimit({
    key: `posts:${ip}`,
    limit: RATE_LIMIT,
    windowMs: RATE_WINDOW_MS,
  });
  if (!rl.ok) {
    return Response.json(
      { error: "Slow down, you're posting too fast.", retryAt: rl.resetAt },
      { status: 429 },
    );
  }

  let form: FormData;
  try {
    form = await req.formData();
  } catch {
    return Response.json({ error: "Invalid form data" }, { status: 400 });
  }

  const author = (form.get("author") as string | null)?.trim() || "Anonymous";
  const title = ((form.get("title") as string | null) ?? "").trim();
  const body = ((form.get("body") as string | null) ?? "").trim();
  const peaksRaw = form.getAll("peaks").map((v) => String(v));
  const storyDateRaw = (form.get("storyDate") as string | null)?.trim() || "";
  let storyDate: Date | null = null;
  if (storyDateRaw) {
    // Accept "YYYY-MM-DD" from <input type="date"> or a full ISO string.
    const parsed = new Date(storyDateRaw);
    if (!Number.isNaN(parsed.getTime())) storyDate = parsed;
  }

  if (author.length > MAX_AUTHOR) {
    return Response.json({ error: "Author too long" }, { status: 400 });
  }
  if (title.length > MAX_TITLE) {
    return Response.json({ error: "Headline too long" }, { status: 400 });
  }
  if (body.length > MAX_BODY) {
    return Response.json({ error: "Body too long" }, { status: 400 });
  }

  const files = form.getAll("media[]").filter((v): v is File => v instanceof File);
  // Files already uploaded directly to Vercel Blob by the client (used for
  // large files that exceed the function body limit, e.g. videos).
  const blobUrls = form.getAll("mediaUrl[]").map((v) => String(v));
  const blobTypes = form.getAll("mediaType[]").map((v) => String(v));
  const blobMimes = form.getAll("mediaMime[]").map((v) => String(v));
  const mediaCount = files.length + blobUrls.length;

  if (mediaCount > MAX_MEDIA_ITEMS) {
    return Response.json(
      { error: `Too many attachments (max ${MAX_MEDIA_ITEMS})` },
      { status: 400 },
    );
  }

  if (title.length === 0 && body.length === 0 && mediaCount === 0) {
    return Response.json(
      { error: "Empty post — add a headline, write something, or attach something." },
      { status: 400 },
    );
  }

  const saved: Array<Awaited<ReturnType<typeof saveUpload>> & {
    durationMs?: number;
    width?: number;
    height?: number;
    peaks?: number[];
  }> = [];

  const durations = form.getAll("durationMs").map((v) => Number(v) || null);
  const widths = form.getAll("width").map((v) => Number(v) || null);
  const heights = form.getAll("height").map((v) => Number(v) || null);

  try {
    for (let i = 0; i < files.length; i++) {
      const f = files[i];
      const s = await saveUpload(f);

      let peaks: number[] | undefined;
      if (s.type === "audio" && peaksRaw[i]) {
        try {
          const parsed = JSON.parse(peaksRaw[i]);
          const ok = PeaksSchema.safeParse(parsed);
          if (ok.success) peaks = ok.data;
        } catch {
          /* ignore malformed peaks */
        }
      }

      saved.push({
        ...s,
        durationMs: durations[i] ?? undefined,
        width: widths[i] ?? undefined,
        height: heights[i] ?? undefined,
        peaks,
      });
    }
  } catch (e) {
    const status = e instanceof StorageError ? e.status : 500;
    const msg = e instanceof Error ? e.message : "Upload failed";
    return Response.json({ error: msg }, { status });
  }

  // Media already uploaded to our Vercel Blob store by the client. Only accept
  // URLs that point at our blob storage (forged ones are also gated by review).
  for (let i = 0; i < blobUrls.length; i++) {
    let url = blobUrls[i];
    const type = blobTypes[i];
    let mime = blobMimes[i] || "application/octet-stream";
    // Vercel Blob public URLs are https://<store>.public.blob.vercel-storage.com/…
    // — the host has a dotted ".public." label, so allow dots in the subdomain
    // (the old [\w-]+ only matched a single label and rejected every real URL,
    // silently dropping the media so posts saved with no attachments).
    if (!/^https:\/\/[a-z0-9.-]+\.blob\.vercel-storage\.com\//i.test(url)) continue;
    if (type !== "audio" && type !== "image" && type !== "video") continue;
    // The browser couldn't convert this HEIC, so it uploaded the original —
    // transcode it to JPEG server-side so the feed can display it.
    if (
      type === "image" &&
      (/image\/hei[cf]/i.test(mime) || /\.(heic|heif)(?:\?|$)/i.test(url))
    ) {
      const conv = await convertRemoteHeicToJpeg(url);
      if (conv) {
        url = conv.url;
        mime = conv.mime;
      }
    }
    let peaks: number[] | undefined;
    if (type === "audio" && peaksRaw[i]) {
      try {
        const ok = PeaksSchema.safeParse(JSON.parse(peaksRaw[i]));
        if (ok.success) peaks = ok.data;
      } catch {
        /* ignore */
      }
    }
    saved.push({
      url,
      type,
      mime,
      size: 0,
      durationMs: durations[i] ?? undefined,
      width: widths[i] ?? undefined,
      height: heights[i] ?? undefined,
      peaks,
    });
  }

  // New posts land as "pending" — admin approval gates them to the feed.
  // Generate the id up front so the post + its media can be written atomically
  // via batch() (more robust on Turso/serverless than an interactive tx).
  const id = randomUUID();
  const insertPost = db.insert(schema.posts).values({
    id,
    author,
    title: title || null,
    body: body || null,
    storyDate,
    status: "pending",
    statusAt: new Date(),
  });

  if (saved.length > 0) {
    await db.batch([
      insertPost,
      db.insert(schema.mediaItems).values(
        saved.map((s, i) => ({
          postId: id,
          type: s.type,
          url: s.url,
          mime: s.mime,
          durationMs: s.durationMs ?? null,
          width: s.width ?? null,
          height: s.height ?? null,
          waveformPeaks: s.peaks ?? null,
          position: i,
        })),
      ),
    ]);
  } else {
    await insertPost;
  }

  return Response.json({ id, status: "pending" }, { status: 201 });
}

// ---------- GET: list (approved only) ----------
const PAGE_SIZE = 40;

export async function GET(req: Request) {
  const url = new URL(req.url);
  const cursor = url.searchParams.get("cursor");
  const limit = Math.min(
    PAGE_SIZE,
    Math.max(1, Number(url.searchParams.get("limit")) || PAGE_SIZE),
  );

  const cursorMs = cursor && Number.isFinite(Number(cursor)) ? Number(cursor) : null;
  const where = cursorMs
    ? and(
        eq(schema.posts.status, "approved"),
        lt(schema.posts.createdAt, new Date(cursorMs)),
      )
    : eq(schema.posts.status, "approved");

  const rows = await db
    .select()
    .from(schema.posts)
    .where(where)
    .orderBy(desc(schema.posts.createdAt))
    .limit(limit + 1)
    .all();

  const hasMore = rows.length > limit;
  const page = hasMore ? rows.slice(0, limit) : rows;

  const ids = page.map((p) => p.id);
  const media =
    ids.length === 0
      ? []
      : await db
          .select()
          .from(schema.mediaItems)
          .where(inArray(schema.mediaItems.postId, ids))
          .all();

  const byPost = new Map<string, typeof media>();
  for (const m of media) {
    const list = byPost.get(m.postId) ?? [];
    list.push(m);
    byPost.set(m.postId, list);
  }
  for (const list of byPost.values()) {
    list.sort((a, b) => a.position - b.position);
  }

  const items = page.map((p) => ({
    ...p,
    createdAt: p.createdAt.getTime(),
    statusAt: p.statusAt ? p.statusAt.getTime() : null,
    media: byPost.get(p.id) ?? [],
  }));

  const nextCursor = hasMore
    ? String(page[page.length - 1].createdAt.getTime())
    : null;

  return Response.json({ items, nextCursor });
}
