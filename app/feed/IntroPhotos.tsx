"use client";

import { useCallback, useEffect, useRef, useState, useSyncExternalStore } from "react";
import { INTRO_PHOTOS } from "@/lib/intro-photos";
import { asset } from "@/lib/site";

/** How long each photo holds before the next one fades in. */
const HOLD_MS = 3000;

/**
 * The photo panel beside the intro text: one photo at a time, cross-fading on a
 * timer, and advancing immediately when clicked.
 *
 * Two behaviours worth knowing:
 * - Nothing is fetched until the intro has actually been opened. The panel
 *   lives inside a collapsed container that is still in the document, so
 *   rendering the <img>s eagerly would pull the whole set down on first paint.
 * - The timer only runs while the intro is open. A carousel ticking away inside
 *   a closed panel is wasted work, and it would also mean the photo silently
 *   changed underneath someone between two viewings.
 *
 * Reduced motion turns off both the fade and the auto-advance — an unprompted
 * rotation is exactly the kind of movement that setting asks us to stop — and
 * leaves the click-to-advance, so the photos are still all reachable.
 */
export function IntroPhotos({ open }: { open?: boolean }) {
  const [i, setI] = useState(0);
  const timer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);

  const count = INTRO_PHOTOS.length;

  // A latch, set while rendering rather than in an effect: once the intro has
  // been opened the images stay mounted, so reopening it doesn't re-fetch.
  const [seen, setSeen] = useState(false);
  if (open && !seen) setSeen(true);

  const reduced = useSyncExternalStore(subscribeReducedMotion, getReducedMotion, () => false);

  const advance = useCallback(() => {
    setI((n) => (n + 1) % count);
  }, [count]);

  // Auto-advance, restarted whenever the index changes so a click gives the
  // photo it lands on a full turn rather than the remainder of the last one.
  useEffect(() => {
    if (!open || reduced || count < 2) return;
    timer.current = setTimeout(advance, HOLD_MS);
    return () => clearTimeout(timer.current);
  }, [open, reduced, count, i, advance]);

  if (!count) return null;

  return (
    <button
      type="button"
      className="intro-photos"
      onClick={advance}
      aria-label={`Photo ${i + 1} of ${count}. Show the next photo.`}
    >
      <span className="intro-photo-frame">
        {seen &&
          INTRO_PHOTOS.map((p, n) => (
            /* eslint-disable-next-line @next/next/no-img-element */
            <img
              key={p.src}
              src={asset(p.src)}
              alt={n === i ? p.alt : ""}
              aria-hidden={n !== i}
              className="intro-photo"
              data-active={n === i ? "true" : undefined}
              draggable={false}
            />
          ))}
      </span>
    </button>
  );
}

const REDUCED_MOTION = "(prefers-reduced-motion: reduce)";

function subscribeReducedMotion(onChange: () => void) {
  const mq = window.matchMedia(REDUCED_MOTION);
  mq.addEventListener("change", onChange);
  return () => mq.removeEventListener("change", onChange);
}

function getReducedMotion() {
  return window.matchMedia(REDUCED_MOTION).matches;
}
