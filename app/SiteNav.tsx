"use client";

import Link from "next/link";
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
/** The reel keeps flashing logos for about this long before it lands. */
const SPIN_MS = 1150;

const randomLogo = () => LOGOS[Math.floor(Math.random() * LOGOS.length)];

/**
 * Site top bar — a centered "Mikula" wordmark. On each load it runs like a slot
 * machine: rapidly flashing random logos (in a fixed-height window so nothing
 * jumps), decelerating, then landing on a random one. When it lands, the box
 * resizes to that logo's natural height so the page content slides into place.
 * All client-side (after mount) → no SSR/hydration mismatch.
 */
export function SiteNav({
  infoOpen,
  onInfo,
}: {
  infoOpen?: boolean;
  onInfo?: () => void;
}) {
  const [src, setSrc] = useState<string | null>(null);
  const [spinning, setSpinning] = useState(true);
  const [boxH, setBoxH] = useState(CYCLE_H);
  const boxRef = useRef<HTMLSpanElement | null>(null);
  const imgRef = useRef<HTMLImageElement | null>(null);

  // Size the box to the landed logo's natural height (at the current width) so
  // the content below slides to its final position.
  const settle = useCallback(() => {
    const box = boxRef.current;
    const img = imgRef.current;
    if (!box || !img || !img.naturalWidth) return;
    setBoxH(box.clientWidth * (img.naturalHeight / img.naturalWidth));
  }, []);

  // The spin: preload all logos, then flash through them with a decelerating
  // interval until SPIN_MS elapses, ending on a random pick. All state changes
  // happen inside timers (never synchronously in the effect body).
  useEffect(() => {
    LOGOS.forEach((l) => {
      const im = new window.Image();
      im.src = l;
    });
    const reduced = window.matchMedia?.(
      "(prefers-reduced-motion: reduce)",
    )?.matches;
    let timer: ReturnType<typeof setTimeout>;
    if (reduced) {
      timer = setTimeout(() => {
        setSrc(randomLogo());
        setSpinning(false);
      }, 0);
      return () => clearTimeout(timer);
    }
    let elapsed = 0;
    const tick = () => {
      setSrc(randomLogo());
      // ease-out: each frame waits a touch longer than the last.
      const delay = 55 + elapsed * 0.14;
      elapsed += delay;
      if (elapsed < SPIN_MS) {
        timer = setTimeout(tick, delay);
      } else {
        setSrc(randomLogo());
        setSpinning(false);
      }
    };
    timer = setTimeout(tick, 0);
    return () => clearTimeout(timer);
  }, []);

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
          className="topbar-info"
          onClick={onInfo}
          data-open={infoOpen ? "true" : "false"}
          aria-label="About Charles Mikula"
          aria-expanded={infoOpen}
          title="About"
        >
          <InfoIcon />
        </button>
      )}
      <Link href="/" className="topbar-brand" aria-label="Charles Mikula">
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
    </header>
  );
}

function InfoIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 18 18" fill="none" aria-hidden>
      <circle cx="9" cy="9" r="7" stroke="currentColor" strokeWidth="1.5" />
      <path d="M9 8v4" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" />
      <circle cx="9" cy="5.5" r="0.95" fill="currentColor" />
    </svg>
  );
}
