"use client";

import { useMemo, useState } from "react";
import { Tile, type FeedPost } from "./Tile";
import {
  ControlPanel,
  type FilterKey,
  type SortMode,
  type SortDir,
  type Counts,
} from "./ControlPanel";
import { SideSheet } from "../SideSheet";
import { Composer } from "../share/Composer";
import { SiteNav } from "../SiteNav";
import { Intro } from "./Intro";
import { READ_ONLY } from "@/lib/site";

/**
 * Client feed: holds filter (content type), sort mode (recent / story date),
 * sort direction (desc / asc), and the add-story sheet. The control module is
 * the first grid cell so tiles flow around it, Azuki-style.
 */
export function Feed({ posts }: { posts: FeedPost[] }) {
  const [filter, setFilter] = useState<FilterKey>("all");
  const [mode, setMode] = useState<SortMode>("recent");
  const [dir, setDir] = useState<SortDir>("desc");
  const [open, setOpen] = useState(false);
  const [dirty, setDirty] = useState(false);
  const [aboutOpen, setAboutOpen] = useState(false);

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
    const key = (p: FeedPost) =>
      mode === "story" ? (p.storyDate ?? p.createdAt) : p.createdAt;
    return [...list].sort((a, b) =>
      dir === "desc" ? key(b) - key(a) : key(a) - key(b),
    );
  }, [posts, filter, mode, dir]);

  return (
    <>
      <SiteNav infoOpen={aboutOpen} onInfo={() => setAboutOpen((o) => !o)} />

      <Intro open={aboutOpen} onClose={() => setAboutOpen(false)} />

      <div className="gallery">
        <ControlPanel
          counts={counts}
          filter={filter}
          mode={mode}
          dir={dir}
          onFilter={setFilter}
          onMode={setMode}
          onToggleDir={() => setDir((d) => (d === "desc" ? "asc" : "desc"))}
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
