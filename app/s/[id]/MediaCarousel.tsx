"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { AudioPlayer } from "@/app/feed/AudioPlayer";

export interface CarouselMedia {
  id: string;
  type: "audio" | "image" | "video";
  url: string;
  width: number | null;
  height: number | null;
  durationMs: number | null;
  waveformPeaks: number[] | null;
}

/** How long each image is shown before auto-advancing (ms). */
const SLIDE_MS = 5000;

/**
 * Auto-rotating media carousel for story details. Cross-fades between slides
 * and shows a row of dots; the active dot stretches to ~two dots wide and a
 * white fill sweeps across it as the timer counts down, then advances.
 *
 * Auto-advance only runs on image slides — video/audio slides hold so a
 * playing clip isn't yanked away. Hovering pauses the timer.
 */
export function MediaCarousel({ media }: { media: CarouselMedia[] }) {
  const [index, setIndex] = useState(0);
  const [paused, setPaused] = useState(false);
  const count = media.length;

  const active = media[index];
  const autoAdvance = active?.type === "image";

  const next = useCallback(() => {
    setIndex((i) => (i + 1) % count);
  }, [count]);
  const prev = useCallback(() => {
    setIndex((i) => (i - 1 + count) % count);
  }, [count]);

  return (
    <div
      className="story-carousel"
      data-paused={paused ? "true" : undefined}
      onMouseEnter={() => setPaused(true)}
      onMouseLeave={() => setPaused(false)}
      aria-roledescription="carousel"
      aria-label="Memory media"
    >
      <div className="carousel-stage">
        {media.map((m, i) => (
          <div
            key={m.id}
            className="carousel-slide"
            data-active={i === index ? "true" : undefined}
            aria-hidden={i === index ? undefined : true}
          >
            <Slide m={m} active={i === index} />
          </div>
        ))}
      </div>

      <div className="carousel-controls">
        <button
          type="button"
          className="carousel-arrow"
          onClick={prev}
          aria-label="Previous media"
        >
          <ChevronLeft />
        </button>
        <div className="carousel-dots" role="tablist" aria-label="Choose media">
          {media.map((m, i) => (
            <button
              key={m.id}
              type="button"
              className="carousel-dot"
              data-active={i === index ? "true" : undefined}
              aria-label={`Show media ${i + 1} of ${count}`}
              aria-selected={i === index}
              role="tab"
              onClick={() => setIndex(i)}
            >
              {i === index &&
                (autoAdvance ? (
                  <span
                    // Remounting on each slide restarts the fill animation cleanly.
                    key={index}
                    className="carousel-dot-fill"
                    style={{ animationDuration: `${SLIDE_MS}ms` }}
                    onAnimationEnd={next}
                  />
                ) : (
                  <span className="carousel-dot-fill carousel-dot-fill--static" />
                ))}
            </button>
          ))}
        </div>
        <button
          type="button"
          className="carousel-arrow"
          onClick={next}
          aria-label="Next media"
        >
          <ChevronRight />
        </button>
      </div>
    </div>
  );
}

function ChevronLeft() {
  return (
    <svg width="16" height="16" viewBox="0 0 16 16" fill="none" aria-hidden>
      <path d="M10 3L5 8l5 5" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}
function ChevronRight() {
  return (
    <svg width="16" height="16" viewBox="0 0 16 16" fill="none" aria-hidden>
      <path d="M6 3l5 5-5 5" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

function Slide({ m, active }: { m: CarouselMedia; active: boolean }) {
  const videoRef = useRef<HTMLVideoElement | null>(null);

  // Pause a video when its slide is navigated away from.
  useEffect(() => {
    if (!active && videoRef.current) videoRef.current.pause();
  }, [active]);

  if (m.type === "image") {
    return (
      /* eslint-disable-next-line @next/next/no-img-element */
      <img
        src={m.url}
        alt=""
        className="carousel-image"
        style={{
          aspectRatio: m.width && m.height ? `${m.width} / ${m.height}` : undefined,
        }}
      />
    );
  }
  if (m.type === "video") {
    return (
      <video
        ref={videoRef}
        src={m.url}
        controls
        autoPlay
        muted
        playsInline
        preload="metadata"
        className="carousel-video"
        style={{
          aspectRatio: m.width && m.height ? `${m.width} / ${m.height}` : "16 / 9",
        }}
      />
    );
  }
  return (
    <div className="story-audio carousel-audio">
      <AudioPlayer
        src={m.url}
        durationMs={m.durationMs ?? undefined}
        peaks={m.waveformPeaks ?? undefined}
      />
    </div>
  );
}
