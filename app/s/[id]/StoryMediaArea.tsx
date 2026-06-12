"use client";

import { useRouter } from "next/navigation";
import { useRef } from "react";

/**
 * The detail-page media area. Renders the same `className` div as before (so the
 * existing layout CSS is untouched) but adds a horizontal-swipe gesture on
 * touch devices to move between posts: swipe left → next (older), swipe right →
 * previous (newer). Taps (e.g. carousel dots, video controls) are unaffected.
 */
export function StoryMediaArea({
  className,
  prevId,
  nextId,
  children,
}: {
  className?: string;
  prevId: string | null;
  nextId: string | null;
  children: React.ReactNode;
}) {
  const router = useRouter();
  const start = useRef<{ x: number; y: number } | null>(null);

  function onTouchStart(e: React.TouchEvent) {
    const t = e.touches[0];
    start.current = { x: t.clientX, y: t.clientY };
  }

  function onTouchEnd(e: React.TouchEvent) {
    const s = start.current;
    start.current = null;
    if (!s) return;
    const t = e.changedTouches[0];
    const dx = t.clientX - s.x;
    const dy = t.clientY - s.y;
    // Only act on a clearly horizontal swipe so taps/vertical scrolls pass through.
    if (Math.abs(dx) < 60 || Math.abs(dx) < Math.abs(dy) * 1.4) return;
    if (dx < 0 && nextId) router.push(`/s/${nextId}`);
    else if (dx > 0 && prevId) router.push(`/s/${prevId}`);
  }

  return (
    <div className={className} onTouchStart={onTouchStart} onTouchEnd={onTouchEnd}>
      {children}
    </div>
  );
}
