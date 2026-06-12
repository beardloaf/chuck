"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useCallback, useEffect, useRef, useState } from "react";

/** Band-style "Mikula" wordmarks in /public (all share a width; height varies). */
const LOGOS = [
  "/mikula-aerosmith.webp",
  "/mikula-blackmetal.webp",
  "/mikula-blacksabbath.webp",
  "/mikula-danzig.webp",
  "/mikula-def.webp",
  "/mikula-jerks.webp",
  "/mikula-judas.webp",
  "/mikula-led.webp",
  "/mikula-tallica1.webp",
  "/mikula-tallica2.webp",
];

/** Fixed logo-area height (px) while the reel spins, so the page doesn't jump. */
const CYCLE_H = 96;
/** The reel keeps flashing for about this long before it lands (decelerating). */
const SPIN_MS = 2400;

const randomLogo = () => LOGOS[Math.floor(Math.random() * LOGOS.length)];

/**
 * Site top bar — a centered "Mikula" wordmark that runs like a slot machine:
 * rapidly flashing random logos in a fixed-height window (so nothing jumps),
 * decelerating, then slowly landing on a random one — after which the window
 * eases to that logo's natural height so the page content glides into place.
 * Clicking the wordmark re-runs the reel. All client-side (after mount) → no
 * SSR/hydration mismatch.
 */
export function SiteNav({
  infoOpen,
  onInfo,
  timelineHref,
}: {
  infoOpen?: boolean;
  onInfo?: () => void;
  timelineHref?: string;
}) {
  const [src, setSrc] = useState<string | null>(null);
  const [spinning, setSpinning] = useState(true);
  const [boxH, setBoxH] = useState(CYCLE_H);
  const boxRef = useRef<HTMLSpanElement | null>(null);
  const imgRef = useRef<HTMLImageElement | null>(null);
  const timerRef = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);
  const pathname = usePathname();

  // Size the box to the landed logo's natural height (at the current width) so
  // the content below eases to its final position.
  const settle = useCallback(() => {
    const box = boxRef.current;
    const img = imgRef.current;
    if (!box || !img || !img.naturalWidth) return;
    setBoxH(box.clientWidth * (img.naturalHeight / img.naturalWidth));
  }, []);

  // Run the reel: reset to the fixed window, flash random logos with a delay
  // that grows each frame (ease-out), then land on a random pick. Re-runnable.
  const startSpin = useCallback(() => {
    clearTimeout(timerRef.current);
    setSpinning(true);
    setBoxH(CYCLE_H);
    const reduced = window.matchMedia?.(
      "(prefers-reduced-motion: reduce)",
    )?.matches;
    if (reduced) {
      timerRef.current = setTimeout(() => {
        setSrc(randomLogo());
        setSpinning(false);
      }, 0);
      return;
    }
    let elapsed = 0;
    const tick = () => {
      setSrc(randomLogo());
      const delay = 50 + elapsed * 0.2; // grows → the reel slows as it lands
      elapsed += delay;
      if (elapsed < SPIN_MS) {
        timerRef.current = setTimeout(tick, delay);
      } else {
        setSrc(randomLogo());
        setSpinning(false);
      }
    };
    timerRef.current = setTimeout(tick, 0);
  }, []);

  // Preload all logos, then spin on mount (deferred a tick so no state is set
  // synchronously inside the effect body).
  useEffect(() => {
    LOGOS.forEach((l) => {
      const im = new window.Image();
      im.src = l;
    });
    const kickoff = setTimeout(startSpin, 0);
    return () => {
      clearTimeout(kickoff);
      clearTimeout(timerRef.current);
    };
  }, [startSpin]);

  // Once landed, measure → resize. The ResizeObserver fires once on observe
  // (driving the initial settle) and again on viewport resize.
  useEffect(() => {
    if (spinning) return;
    const box = boxRef.current;
    if (!box) return;
    const ro = new ResizeObserver(settle);
    ro.observe(box);
    return () => ro.disconnect();
  }, [spinning, settle]);

  return (
    <header className="topbar">
      {onInfo && (
        <button
          type="button"
          className="topbar-icon-btn topbar-info"
          onClick={onInfo}
          data-open={infoOpen ? "true" : "false"}
          aria-label="About Charles Mikula"
          aria-expanded={infoOpen}
          title="About"
        >
          <InfoIcon />
        </button>
      )}
      <Link
        href="/"
        className="topbar-brand"
        aria-label="Charles Mikula"
        onClick={(e) => {
          // Already on the feed → re-run the reel instead of a no-op navigation.
          if (pathname === "/") {
            e.preventDefault();
            startSpin();
          }
        }}
      >
        {src ? (
          <span
            ref={boxRef}
            className="topbar-logo-box"
            data-spinning={spinning ? "true" : "false"}
            style={{ height: `${boxH}px` }}
          >
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              ref={imgRef}
              src={src}
              alt="Charles Mikula"
              className="topbar-logo"
              onLoad={() => {
                if (!spinning) settle();
              }}
            />
          </span>
        ) : (
          "Charles Mikula"
        )}
      </Link>
      {timelineHref && (
        <Link
          href={timelineHref}
          className="topbar-icon-btn topbar-timeline"
          aria-label="Open the timeline"
          title="Timeline"
        >
          <TimelineIcon />
        </Link>
      )}
    </header>
  );
}

/** Just the "i" — the button already supplies the circular ring. */
function InfoIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 18 18" fill="none" aria-hidden>
      <circle cx="9" cy="4.3" r="1.15" fill="currentColor" />
      <path
        d="M9 7.6v6.1"
        stroke="currentColor"
        strokeWidth="1.9"
        strokeLinecap="round"
      />
    </svg>
  );
}

/** Browse-photos mark — an image frame (sun + mountain) flanked by ‹ › chevrons. */
function TimelineIcon() {
  return (
    <svg width="22" height="18" viewBox="0 0 30 22" fill="none" aria-hidden>
      {/* left chevron */}
      <path
        d="M4 7l-2.3 4 2.3 4"
        stroke="currentColor"
        strokeWidth="1.7"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      {/* image frame */}
      <rect x="8" y="4" width="14" height="14" rx="2.6" stroke="currentColor" strokeWidth="1.7" />
      {/* sun */}
      <circle cx="17.6" cy="8.4" r="1.3" fill="currentColor" />
      {/* mountain */}
      <path
        d="M9 16.4l3.3-3.7 2.2 2.2 2.4-2.8 4 4.3"
        stroke="currentColor"
        strokeWidth="1.7"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      {/* right chevron */}
      <path
        d="M26 7l2.3 4-2.3 4"
        stroke="currentColor"
        strokeWidth="1.7"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}
