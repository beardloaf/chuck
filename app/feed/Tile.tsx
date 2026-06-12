"use client";

import Link from "next/link";
import { useCallback, useEffect, useRef, useState } from "react";
import { format } from "date-fns";
import { TileAudio } from "./TileAudio";
import { TileVideo } from "./TileVideo";

/** How long each image shows before auto-advancing (ms) — matches the detail view. */
const SLIDE_MS = 5000;

export interface FeedMedia {
  id: string;
  type: "audio" | "image" | "video";
  url: string;
  mime: string;
  durationMs: number | null;
  width: number | null;
  height: number | null;
  peaks: number[] | null;
}

export interface FeedPost {
  id: string;
  author: string;
  title: string | null;
  body: string | null;
  createdAt: number;
  storyDate: number | null;
  media: FeedMedia[];
}

const QUIET_VARIANTS = [
  "tile-quiet",
  "tile-deep",
  "tile-warm",
  "tile-cool",
  "tile-violet",
] as const;

/** The single line shown on a tile: headline, else first line of body. */
function tileHeadline(post: FeedPost): string {
  if (post.title && post.title.trim()) return post.title.trim();
  if (post.body && post.body.trim()) return post.body.trim().split("\n")[0];
  return "";
}

export function Tile({ post }: { post: FeedPost }) {
  const images = post.media.filter((m) => m.type === "image");
  const primary = post.media[0];
  const isImageLed = primary?.type === "image";
  const isVideo = primary?.type === "video";
  const isAudioOnly =
    !!primary &&
    primary.type === "audio" &&
    !post.media.some((m) => m.type === "image" || m.type === "video");
  const isTextOnly = post.media.length === 0;
  const isMultiImage = isImageLed && images.length > 1;

  // Carousel index (only meaningful for multi-image tiles)
  const [idx, setIdx] = useState(0);

  // Pick black or white for the date based on the luminance of what's behind it.
  const articleRef = useRef<HTMLElement | null>(null);
  const [dateInk, setDateInk] = useState<"light" | "dark">("light");
  useEffect(() => {
    const root = articleRef.current;
    if (!root) return;
    const el =
      root.querySelector<HTMLImageElement>('.carousel-img[data-active="true"]') ??
      root.querySelector<HTMLImageElement | HTMLVideoElement>(
        "img.tile-fill, video.tile-fill",
      );
    if (!el) return; // no media (text/audio tile) → keep default
    let cancelled = false;
    const compute = () => {
      if (cancelled) return;
      const lum = topLeftLuminance(el);
      if (lum != null) setDateInk(lum > 0.6 ? "dark" : "light");
    };
    if (el instanceof HTMLImageElement) {
      if (el.complete && el.naturalWidth) compute();
      else el.addEventListener("load", compute, { once: true });
    } else {
      if (el.readyState >= 2) compute();
      else el.addEventListener("loadeddata", compute, { once: true });
    }
    return () => {
      cancelled = true;
    };
  }, [idx, primary?.url]);

  const variant = QUIET_VARIANTS[hashStr(post.id) % QUIET_VARIANTS.length];
  const onMedia = isImageLed || isVideo;
  const headline = tileHeadline(post);
  // Story-dated posts are month-granular → show "MMM yyyy"; otherwise the
  // full posted date.
  const dateLabel = post.storyDate
    ? format(new Date(post.storyDate), "MMM yyyy")
    : format(new Date(post.createdAt), "MMM d, yyyy");
  const audio = post.media.find((m) => m.type === "audio");

  const next = useCallback(() => {
    setIdx((i) => (i + 1) % images.length);
  }, [images.length]);
  function jump(to: number, e: React.MouseEvent) {
    e.preventDefault();
    e.stopPropagation();
    setIdx(to);
  }

  return (
    <Link
      href={`/s/${post.id}`}
      className="tile-link"
      aria-label={`Open story by ${post.author}`}
    >
      <article
        ref={articleRef}
        className={`tile ${onMedia ? "tile-media" : variant} ${isMultiImage ? "tile-has-carousel" : ""}`}
        id={`post-${post.id}`}
      >
        {/* Media background */}
        {isImageLed &&
          (isMultiImage ? (
            <div className="carousel">
              {images.map((m, i) => (
                /* eslint-disable-next-line @next/next/no-img-element */
                <img
                  key={m.id}
                  src={m.url}
                  alt=""
                  loading="lazy"
                  className="tile-fill carousel-img"
                  data-active={i === idx}
                />
              ))}
            </div>
          ) : (
            /* eslint-disable-next-line @next/next/no-img-element */
            <img src={primary.url} alt="" loading="lazy" className="tile-fill" />
          ))}
        {isVideo && primary && (
          <TileVideo src={primary.url} durationMs={primary.durationMs ?? undefined} />
        )}

        {/* Audio: the waveform is the feature, filling the tile */}
        {isAudioOnly && audio && (
          <TileAudio
            src={audio.url}
            peaks={audio.peaks ?? undefined}
            durationMs={audio.durationMs ?? undefined}
          />
        )}

        {/* Top metadata: date only (author moved to a pill above headline) */}
        <header
          className={`tile-head ${onMedia ? "on-media" : ""}`}
          data-ink={dateInk}
        >
          <span className="tile-date">{dateLabel}</span>
        </header>

        {/* Bottom: author pill, headline (1 line), and — for multi-image tiles —
            the carousel dots below the title (left-aligned, revealed on hover). */}
        <div className="tile-foot">
          <span className={`tile-author-pill ${onMedia ? "on-media" : ""}`}>
            {post.author}
          </span>
          {headline && <p className="tile-headline">{headline}</p>}
          {isMultiImage && (
            <div className="tile-dots" role="tablist" aria-label="Choose image">
              {images.map((m, i) => (
                <button
                  key={m.id}
                  type="button"
                  className="carousel-dot"
                  data-active={i === idx ? "true" : undefined}
                  aria-label={`Show image ${i + 1} of ${images.length}`}
                  aria-selected={i === idx}
                  role="tab"
                  onClick={(e) => jump(i, e)}
                >
                  {i === idx && (
                    <span
                      // Remount per slide so the fill restarts; on end → advance.
                      key={idx}
                      className="carousel-dot-fill"
                      style={{ animationDuration: `${SLIDE_MS}ms` }}
                      onAnimationEnd={next}
                    />
                  )}
                </button>
              ))}
            </div>
          )}
        </div>

        {/* Multi-media count badge (video duration badge is rendered by TileVideo) */}
        {post.media.length > 1 && !isMultiImage && (
          <span className="tile-badge tile-badge-count">+{post.media.length - 1}</span>
        )}
      </article>
    </Link>
  );
}

function hashStr(s: string): number {
  let h = 0;
  for (let i = 0; i < s.length; i++) h = (h * 31 + s.charCodeAt(i)) >>> 0;
  return h;
}

/**
 * Average luminance (0–1) of the top-left region where the date sits. Returns
 * null if it can't be read (e.g. a cross-origin Blob image taints the canvas).
 */
function topLeftLuminance(el: HTMLImageElement | HTMLVideoElement): number | null {
  const sw = el instanceof HTMLImageElement ? el.naturalWidth : el.videoWidth;
  const sh = el instanceof HTMLImageElement ? el.naturalHeight : el.videoHeight;
  if (!sw || !sh) return null;
  try {
    const c = document.createElement("canvas");
    c.width = 12;
    c.height = 12;
    const ctx = c.getContext("2d", { willReadFrequently: true });
    if (!ctx) return null;
    ctx.drawImage(el, 0, 0, Math.max(1, sw * 0.55), Math.max(1, sh * 0.22), 0, 0, 12, 12);
    const d = ctx.getImageData(0, 0, 12, 12).data;
    let sum = 0;
    for (let i = 0; i < d.length; i += 4) {
      sum += (0.299 * d[i] + 0.587 * d[i + 1] + 0.114 * d[i + 2]) / 255;
    }
    return sum / (d.length / 4);
  } catch {
    return null;
  }
}
