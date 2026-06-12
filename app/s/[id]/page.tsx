import type { Metadata } from "next";
import { db, schema } from "@/lib/db";
import { eq, and, inArray, desc } from "drizzle-orm";
import { notFound } from "next/navigation";
import Link from "next/link";
import { format } from "date-fns";
import { formatStoryMonth } from "@/lib/date";
import { AudioPlayer } from "@/app/feed/AudioPlayer";
import { Timeline, type TimelineItem } from "./Timeline";
import { EscapeBack } from "./EscapeBack";
import { ScrollLock } from "./ScrollLock";
import { MediaCarousel } from "./MediaCarousel";
import { StoryMediaArea } from "./StoryMediaArea";
import { DownloadAll, type DownloadItem } from "./DownloadAll";
import { asset, displayUrl, originalUrl } from "@/lib/site";

// Rendered at request time so a story is viewable as soon as it's approved,
// without a rebuild.
export const dynamic = "force-dynamic";

// Title → "Charles Mikula — <post title or month/year>" (template lives in the
// root layout); falls back to the default for missing posts.
export async function generateMetadata({
  params,
}: {
  params: Promise<{ id: string }>;
}): Promise<Metadata> {
  const { id } = await params;
  const [row] = await db
    .select()
    .from(schema.posts)
    .where(and(eq(schema.posts.id, id), eq(schema.posts.status, "approved")))
    .limit(1)
    .all();
  if (!row) return {};
  const title =
    row.title?.trim() ||
    (row.storyDate
      ? formatStoryMonth(row.storyDate, "MMMM yyyy")
      : format(row.createdAt, "MMMM yyyy"));
  return { title };
}

export default async function StoryPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;

  const [row] = await db
    .select()
    .from(schema.posts)
    .where(and(eq(schema.posts.id, id), eq(schema.posts.status, "approved")))
    .limit(1)
    .all();

  if (!row) notFound();

  const media = await db
    .select()
    .from(schema.mediaItems)
    .where(inArray(schema.mediaItems.postId, [row.id]))
    .all();
  media.sort((a, b) => a.position - b.position);

  // ---- timeline: all approved posts (id, date, first image, title) ----
  const allPosts = await db
    .select()
    .from(schema.posts)
    .where(eq(schema.posts.status, "approved"))
    .orderBy(desc(schema.posts.createdAt))
    .all();
  const allIds = allPosts.map((p) => p.id);
  const allMedia =
    allIds.length === 0
      ? []
      : await db
          .select()
          .from(schema.mediaItems)
          .where(inArray(schema.mediaItems.postId, allIds))
          .all();
  const firstImageByPost = new Map<string, string>();
  const firstVideoByPost = new Map<string, string>();
  for (const m of allMedia) {
    if (m.type === "image" && !firstImageByPost.has(m.postId)) {
      firstImageByPost.set(m.postId, asset(displayUrl(m.url, "image")));
    }
    if (m.type === "video" && !firstVideoByPost.has(m.postId)) {
      firstVideoByPost.set(m.postId, asset(displayUrl(m.url, "video")));
    }
  }
  const timeline: TimelineItem[] = allPosts.map((p) => ({
    id: p.id,
    date: (p.storyDate ?? p.createdAt).getTime(),
    thumbUrl: firstImageByPost.get(p.id) ?? null,
    videoUrl: firstVideoByPost.get(p.id) ?? null,
    title: p.title,
  }));

  // Neighbours for swipe navigation (same order as the default feed / timeline:
  // newest first). Swipe right → previous (newer), swipe left → next (older).
  const curIdx = allPosts.findIndex((p) => p.id === row.id);
  const len = allPosts.length;
  // Wrap around at the ends so navigation cycles (matches the keyboard arrows).
  const prevId =
    len > 1 && curIdx >= 0 ? allPosts[(curIdx - 1 + len) % len].id : null;
  const nextId =
    len > 1 && curIdx >= 0 ? allPosts[(curIdx + 1) % len].id : null;

  // Story-dated posts are month-granular; undated posts show the full posted date.
  const dateLabel = row.storyDate
    ? formatStoryMonth(row.storyDate, "MMMM yyyy")
    : format(row.createdAt, "MMMM d, yyyy");
  const hasMedia = media.length > 0;
  const hasBody = !!row.body?.trim();
  const heading = row.title?.trim() || dateLabel;

  // Filenames for the "download all" action: a slug of the memory plus an index.
  // Videos download the original high-res file, not the compressed display copy.
  const baseName = slugify(row.title?.trim() || row.author || dateLabel);
  const downloadItems: DownloadItem[] = media.map((m, i) => {
    const dl = originalUrl(m.url);
    return {
      url: asset(dl),
      filename: `${baseName}-${i + 1}.${extFromUrl(dl)}`,
    };
  });

  const backLink = (
    <Link href="/" className="story-back" aria-label="Back to the feed">
      <BackIcon />
      <span>Back</span>
    </Link>
  );

  const prose = (
    <>
      <p className="story-meta">{dateLabel}</p>
      <h1 className="story-heading">{heading}</h1>
      <p className="story-author-big">{row.author}</p>
      {row.body && <div className="story-body">{row.body}</div>}
    </>
  );

  const mediaEl =
    media.length > 1 ? (
      <MediaCarousel media={media.map(toCarouselMedia)} />
    ) : hasMedia ? (
      <MediaBlock m={media[0]} />
    ) : null;

  return (
    <div className="story">
      <ScrollLock />
      <EscapeBack />
      <Timeline items={timeline} activeId={row.id} />

      {hasMedia && !hasBody ? (
        /* Media-only memory: float the photo/video on the dark stage. Top bar:
           back (left), name + headline (centre), download (right). */
        <div className="story-stage">
          <div className="story-topbar">
            {backLink}
            <div className="story-stage-meta">
              <p className="story-stage-date">{dateLabel}</p>
              {row.title?.trim() && (
                <h1 className="story-stage-title">{row.title.trim()}</h1>
              )}
              <p className="story-stage-name">{row.author}</p>
            </div>
            <DownloadAll items={downloadItems} />
          </div>
          <StoryMediaArea
            className="story-stage-media"
            prevId={prevId}
            nextId={nextId}
          >
            {mediaEl}
          </StoryMediaArea>
        </div>
      ) : hasMedia ? (
        /* Media + story text: same top bar (back left, download right) so the
           buttons sit in the same place as the media-only view, then columns. */
        <>
          <div className="story-topbar story-topbar-split">
            {backLink}
            <DownloadAll items={downloadItems} />
          </div>
          <div
            className={`story-cols ${media.length === 1 ? "single-media" : ""}`}
          >
            <div className="story-text">
              <div className="story-text-scroll">{prose}</div>
            </div>
            <StoryMediaArea
              className="story-media"
              prevId={prevId}
              nextId={nextId}
            >
              {mediaEl}
            </StoryMediaArea>
          </div>
        </>
      ) : (
        <div className="story-inner">
          <div className="story-single">
            {backLink}
            {prose}
          </div>
        </div>
      )}
    </div>
  );
}

/** Map a DB media row to the serializable shape the client carousel needs. */
function toCarouselMedia(m: typeof schema.mediaItems.$inferSelect) {
  return {
    id: m.id,
    type: m.type,
    url: asset(displayUrl(m.url, m.type)), // carousel shows the compressed version
    width: m.width,
    height: m.height,
    durationMs: m.durationMs,
    waveformPeaks: m.waveformPeaks,
  };
}

function slugify(s: string): string {
  const slug = s
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 40);
  return slug || "memory";
}

function extFromUrl(url: string): string {
  const m = url.match(/\.([a-z0-9]+)(?:[?#]|$)/i);
  return m ? m[1].toLowerCase() : "bin";
}

function MediaBlock({ m }: { m: typeof schema.mediaItems.$inferSelect }) {
  if (m.type === "image") {
    return (
      /* eslint-disable-next-line @next/next/no-img-element */
      <img
        src={asset(displayUrl(m.url, m.type))}
        alt=""
        className="story-image"
        style={{
          aspectRatio: m.width && m.height ? `${m.width} / ${m.height}` : undefined,
        }}
      />
    );
  }
  if (m.type === "video") {
    return (
      <video
        src={asset(displayUrl(m.url, m.type))}
        controls
        autoPlay
        muted
        loop
        playsInline
        preload="metadata"
        className="story-video"
        style={{
          aspectRatio: m.width && m.height ? `${m.width} / ${m.height}` : "16 / 9",
        }}
      />
    );
  }
  return (
    <div className="story-audio">
      <AudioPlayer
        src={asset(m.url)}
        durationMs={m.durationMs ?? undefined}
        peaks={m.waveformPeaks ?? undefined}
      />
    </div>
  );
}

function BackIcon() {
  return (
    <svg width="14" height="14" viewBox="0 0 14 14" fill="none" aria-hidden>
      <path
        d="M8.5 2L3.5 7l5 5"
        stroke="currentColor"
        strokeWidth="1.6"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}
