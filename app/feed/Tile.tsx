"use client";

import Link from "next/link";
import { useState } from "react";
import { format } from "date-fns";
import { TileAudio } from "./TileAudio";
import { TileVideo } from "./TileVideo";

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

  const variant = QUIET_VARIANTS[hashStr(post.id) % QUIET_VARIANTS.length];
  const onMedia = isImageLed || isVideo;
  const headline = tileHeadline(post);
  // Story-dated posts are month-granular → show "MMM yyyy"; otherwise the
  // full posted date.
  const dateLabel = post.storyDate
    ? format(new Date(post.storyDate), "MMM yyyy")
    : format(new Date(post.createdAt), "MMM d, yyyy");
  const audio = post.media.find((m) => m.type === "audio");

  function go(delta: number, e: React.MouseEvent) {
    e.preventDefault();
    e.stopPropagation();
    setIdx((i) => (i + delta + images.length) % images.length);
  }
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
              <button
                type="button"
                className="carousel-caret carousel-prev"
                onClick={(e) => go(-1, e)}
                aria-label="Previous image"
              >
                <CaretLeft />
              </button>
              <button
                type="button"
                className="carousel-caret carousel-next"
                onClick={(e) => go(1, e)}
                aria-label="Next image"
              >
                <CaretRight />
              </button>
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
        <header className={`tile-head ${onMedia ? "on-media" : ""}`}>
          <span className="tile-date">{dateLabel}</span>
        </header>

        {/* Bottom: author pill, headline (1 line), carousel dots */}
        <div className="tile-foot">
          <span className={`tile-author-pill ${onMedia ? "on-media" : ""}`}>
            {post.author}
          </span>
          {headline && <p className="tile-headline">{headline}</p>}

          {isMultiImage && (
            <div className="carousel-dots">
              {images.map((m, i) => (
                <button
                  key={m.id}
                  type="button"
                  className="carousel-dot"
                  data-on={i === idx}
                  onClick={(e) => jump(i, e)}
                  aria-label={`Image ${i + 1}`}
                />
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

function CaretLeft() {
  return (
    <svg width="16" height="16" viewBox="0 0 16 16" fill="none" aria-hidden>
      <path d="M10 3L5 8l5 5" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}
function CaretRight() {
  return (
    <svg width="16" height="16" viewBox="0 0 16 16" fill="none" aria-hidden>
      <path d="M6 3l5 5-5 5" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

function hashStr(s: string): number {
  let h = 0;
  for (let i = 0; i < s.length; i++) h = (h * 31 + s.charCodeAt(i)) >>> 0;
  return h;
}
