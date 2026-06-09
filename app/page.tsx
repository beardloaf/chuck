import { db, schema } from "@/lib/db";
import { desc, eq, inArray } from "drizzle-orm";
import { Feed } from "./feed/Feed";
import type { FeedPost } from "./feed/Tile";
import { asset } from "@/lib/site";

// Dynamic for the normal server build. The static GitHub Pages build swaps this
// to "force-static" (see scripts/build-static.mjs) so it prerenders at build.
export const dynamic = "force-dynamic";

const MAX_POSTS = 200;

export default async function HomePage() {
  const rows = await db
    .select()
    .from(schema.posts)
    .where(eq(schema.posts.status, "approved"))
    .orderBy(desc(schema.posts.createdAt))
    .limit(MAX_POSTS)
    .all();

  const ids = rows.map((p) => p.id);
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
  for (const list of byPost.values()) list.sort((a, b) => a.position - b.position);

  const items: FeedPost[] = rows.map((p) => ({
    id: p.id,
    author: p.author,
    title: p.title,
    body: p.body,
    createdAt: p.createdAt.getTime(),
    storyDate: p.storyDate ? p.storyDate.getTime() : null,
    media: (byPost.get(p.id) ?? []).map((m) => ({
      id: m.id,
      type: m.type as "audio" | "image" | "video",
      url: asset(m.url),
      mime: m.mime,
      durationMs: m.durationMs,
      width: m.width,
      height: m.height,
      peaks: m.waveformPeaks ?? null,
    })),
  }));

  return (
    <div className="w-full max-w-[2000px] mx-auto px-4 sm:px-6 py-8">
      <Feed posts={items} />
    </div>
  );
}
