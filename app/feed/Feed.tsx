"use client";

import { useMemo, useState } from "react";
import { Tile, type FeedPost } from "./Tile";
import {
  ControlPanel,
  type FilterKey,
  type SortMode,
  type Counts,
} from "./ControlPanel";
import { SideSheet } from "../SideSheet";
import { Composer } from "../share/Composer";
import { SiteNav } from "../SiteNav";
import { READ_ONLY } from "@/lib/site";

/**
 * Client feed: holds filter (content type), sort mode (recent / story date /
 * random), and the add-story sheet. The control module is the first grid
 * cell so tiles flow around it, Azuki-style.
 */
export function Feed({ posts }: { posts: FeedPost[] }) {
  const [filter, setFilter] = useState<FilterKey>("all");
  const [mode, setMode] = useState<SortMode>("recent");
  const [seed, setSeed] = useState(() => Math.floor(Math.random() * 1e9));
  const [open, setOpen] = useState(false);
  const [dirty, setDirty] = useState(false);

  function requestClose() {
    if (
      dirty &&
      !window.confirm("Discard your story? Your text and media will be lost.")
    ) {
      return;
    }
    setDirty(false);
    setOpen(false);
  }

  const counts: Counts = useMemo(() => {
    const c: Counts = { all: posts.length, words: 0, photo: 0, video: 0 };
    for (const p of posts) {
      const hasImage = p.media.some((m) => m.type === "image");
      const hasVideo = p.media.some((m) => m.type === "video");
      // "Words" = text-only or audio-only (no image/video)
      if (!hasImage && !hasVideo) c.words++;
      if (hasImage) c.photo++;
      if (hasVideo) c.video++;
    }
    return c;
  }, [posts]);

  const displayed = useMemo(() => {
    const list = posts.filter((p) => matchesFilter(p, filter));
    if (mode === "recent") {
      return [...list].sort((a, b) => b.createdAt - a.createdAt);
    }
    if (mode === "story") {
      return [...list].sort(
        (a, b) => (b.storyDate ?? b.createdAt) - (a.storyDate ?? a.createdAt),
      );
    }
    return shuffle(list, seed);
  }, [posts, filter, mode, seed]);

  function handleMode(m: SortMode) {
    if (m === "random") setSeed(Math.floor(Math.random() * 1e9));
    setMode(m);
  }

  return (
    <>
      <SiteNav />

      <div className="gallery">
        <ControlPanel
          counts={counts}
          filter={filter}
          mode={mode}
          onFilter={setFilter}
          onMode={handleMode}
          onAdd={() => setOpen(true)}
        />
        {displayed.map((p) => (
          <Tile key={p.id} post={p} />
        ))}
        {displayed.length === 0 && (
          <p className="feed-empty">
            {filter === "all"
              ? "Nothing here yet. Be the first to add a story."
              : `No ${filter} stories yet.`}
          </p>
        )}
      </div>

      {!READ_ONLY && (
        <SideSheet open={open} onClose={requestClose} title="Add a memory">
          <Composer
            onSubmitted={() => setDirty(false)}
            onDirtyChange={setDirty}
          />
        </SideSheet>
      )}
    </>
  );
}

function matchesFilter(p: FeedPost, f: FilterKey): boolean {
  const hasImage = p.media.some((m) => m.type === "image");
  const hasVideo = p.media.some((m) => m.type === "video");
  switch (f) {
    case "all":
      return true;
    case "words":
      return !hasImage && !hasVideo; // text-only or audio-only
    case "photo":
      return hasImage;
    case "video":
      return hasVideo;
    default:
      return true;
  }
}

/** Seeded shuffle so the order is stable across re-renders until reshuffled. */
function shuffle<T>(arr: T[], seed: number): T[] {
  const rand = mulberry32(seed);
  const a = [...arr];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(rand() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

function mulberry32(a: number): () => number {
  return function () {
    a |= 0;
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
