"use client";

import { useEffect, useMemo, useState } from "react";
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
  // Default ordering is by the memory's own date, not its upload time.
  const [mode, setMode] = useState<SortMode>("story");
  const [dir, setDir] = useState<SortDir>("desc");
  const [open, setOpen] = useState(false);
  const [dirty, setDirty] = useState(false);
  const [aboutOpen, setAboutOpen] = useState(false);
  const [scrolled, setScrolled] = useState(false);
  const [atBottom, setAtBottom] = useState(false);
  // A just-submitted memory, previewed at the top of the feed for its author
  // (client-only) while it awaits review.
  const [pending, setPending] = useState<FeedPost | null>(null);
  // IDs of posts that are new since this visitor's last visit (yellow chip).
  const [newIds, setNewIds] = useState<Set<string>>(() => new Set());

  // Release the preview's object URLs when it's replaced or the feed unmounts.
  useEffect(() => {
    return () => {
      pending?.media.forEach((m) => {
        if (m.url.startsWith("blob:")) URL.revokeObjectURL(m.url);
      });
    };
  }, [pending]);

  // Floating button: reveal after scrolling; dock (centered, no gradient) once
  // the page is scrolled all the way to the bottom dock space.
  useEffect(() => {
    const onScroll = () => {
      const y = window.scrollY;
      setScrolled(y > 240);
      const doc = document.documentElement;
      setAtBottom(doc.scrollHeight - (y + window.innerHeight) <= 8);
    };
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  // The site always defaults to "by story date". It only flips to "recent" for
  // a returning visitor who actually has new content since their last visit —
  // those new posts also get a "new" chip. First visits (and returning visits
  // with nothing new) keep the story-date default. localStorage is client-only,
  // so this runs after mount.
  useEffect(() => {
    const KEY = "mikula.lastVisit";
    let last = 0;
    try {
      last = Number(localStorage.getItem(KEY)) || 0;
    } catch {
      /* ignore */
    }
    // Always record this visit for next time.
    try {
      localStorage.setItem(KEY, String(Date.now()));
    } catch {
      /* ignore */
    }
    if (last <= 0) return; // first visit → keep the story-date default
    const fresh = posts.filter((p) => p.createdAt > last).map((p) => p.id);
    if (fresh.length === 0) return; // nothing new → keep the story-date default
    // New content → surface it: switch to recent and flag the new posts.
    const t = setTimeout(() => {
      setMode("recent");
      setNewIds(new Set(fresh));
    }, 0);
    return () => clearTimeout(t);
  }, [posts]);

  // The timeline button jumps to the most recent story (which carries the
  // timeline). Posts arrive newest-first, but find the max to be safe.
  const mostRecentId = useMemo(() => {
    let id: string | null = null;
    let newest = -Infinity;
    for (const p of posts) {
      if (p.createdAt > newest) {
        newest = p.createdAt;
        id = p.id;
      }
    }
    return id;
  }, [posts]);

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
      <SiteNav
        infoOpen={aboutOpen}
        onInfo={() => setAboutOpen((o) => !o)}
        timelineHref={mostRecentId ? `/s/${mostRecentId}` : undefined}
      />

      <Intro open={aboutOpen} />

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
        {pending && <Tile key={pending.id} post={pending} pending />}
        {displayed.map((p) => (
          <Tile key={p.id} post={p} isNew={newIds.has(p.id)} />
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
        <>
          {/* Scroll-revealed floating add button: a "+" that expands on hover,
              over a page-wide gradient so it pops off the feed below. */}
          <div
            className="fab-zone"
            data-show={scrolled && !open ? "true" : "false"}
            data-docked={atBottom ? "true" : "false"}
            aria-hidden={!(scrolled && !open)}
          >
            <button
              type="button"
              className="fab"
              onClick={() => setOpen(true)}
              aria-label="Add a memory"
              tabIndex={scrolled && !open ? 0 : -1}
            >
              <PlusIcon />
              <span className="fab-label">Add a memory</span>
            </button>
          </div>

          <SideSheet open={open} onClose={requestClose} title="Add a memory">
            <Composer
              onSubmitted={(post) => {
                setDirty(false);
                setPending(post);
                setMode("recent"); // their new memory sorts to the top
              }}
              onDirtyChange={setDirty}
            />
          </SideSheet>
        </>
      )}
    </>
  );
}

function PlusIcon() {
  return (
    <svg width="20" height="20" viewBox="0 0 20 20" fill="none" aria-hidden>
      <path
        d="M10 4v12M4 10h12"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
      />
    </svg>
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
