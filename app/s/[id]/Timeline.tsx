"use client";

import { useEffect, useMemo, useRef } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { formatStoryMonth } from "@/lib/date";

export interface TimelineItem {
  id: string;
  date: number; // ms — story date or created date
  thumbUrl: string | null;
  videoUrl: string | null;
  title: string | null;
}

/**
 * Horizontal chronological strip across the top of a story. Oldest → newest,
 * left → right, grouped by year (year label above each group). The active
 * story is highlighted and scrolled into view on mount.
 */
export function Timeline({
  items,
  activeId,
}: {
  items: TimelineItem[];
  activeId: string;
}) {
  const scrollRef = useRef<HTMLDivElement | null>(null);
  const activeRef = useRef<HTMLAnchorElement | null>(null);
  const router = useRouter();

  useEffect(() => {
    const el = activeRef.current;
    const scroller = scrollRef.current;
    if (!el || !scroller) return;
    // Center the active thumb horizontally within the scroller.
    const left =
      el.offsetLeft - scroller.clientWidth / 2 + el.clientWidth / 2;
    scroller.scrollTo({ left, behavior: "auto" });
  }, [activeId]);

  // Most recent on the left, older to the right.
  const sorted = useMemo(
    () => [...items].sort((a, b) => b.date - a.date),
    [items],
  );

  // Left/right arrows step through the timeline (left = newer, right = older).
  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (e.key !== "ArrowLeft" && e.key !== "ArrowRight") return;
      const idx = sorted.findIndex((s) => s.id === activeId);
      if (idx === -1) return;
      const nextIdx = e.key === "ArrowLeft" ? idx - 1 : idx + 1;
      if (nextIdx < 0 || nextIdx >= sorted.length) return;
      e.preventDefault();
      router.push(`/s/${sorted[nextIdx].id}`);
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [sorted, activeId, router]);

  const groups: { year: string; items: TimelineItem[] }[] = [];
  for (const it of sorted) {
    const year = formatStoryMonth(it.date, "yyyy");
    const last = groups[groups.length - 1];
    if (last && last.year === year) last.items.push(it);
    else groups.push({ year, items: [it] });
  }

  if (items.length <= 1) return null;

  return (
    <nav className="timeline" aria-label="Story timeline">
      <div className="timeline-scroll" ref={scrollRef}>
        {groups.map((g) => (
          <div className="timeline-group" key={g.year}>
            <div className="timeline-year">{g.year}</div>
            <div className="timeline-thumbs">
              {g.items.map((it) => (
                <Link
                  key={it.id}
                  href={`/s/${it.id}`}
                  ref={it.id === activeId ? activeRef : undefined}
                  className="timeline-thumb"
                  data-active={it.id === activeId}
                  title={it.title ?? formatStoryMonth(it.date, "MMM yyyy")}
                  aria-current={it.id === activeId ? "true" : undefined}
                >
                  {it.thumbUrl ? (
                    /* eslint-disable-next-line @next/next/no-img-element */
                    <img src={it.thumbUrl} alt="" loading="lazy" />
                  ) : it.videoUrl ? (
                    <video
                      src={it.videoUrl}
                      autoPlay
                      muted
                      loop
                      playsInline
                      preload="metadata"
                      tabIndex={-1}
                    />
                  ) : (
                    <span className="timeline-thumb-blank" aria-hidden>
                      T
                    </span>
                  )}
                </Link>
              ))}
            </div>
          </div>
        ))}
      </div>
    </nav>
  );
}
