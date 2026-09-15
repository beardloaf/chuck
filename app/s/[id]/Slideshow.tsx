"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  type CSSProperties,
  type ReactNode,
} from "react";
import { useRouter } from "next/navigation";

export interface SlideshowPhoto {
  id: string;
  url: string;
  width: number | null;
  height: number | null;
}

export interface SlideshowPost {
  id: string;
  heading: string;
  author: string;
  dateLabel: string;
  photos: SlideshowPhoto[];
}

interface Slide {
  post: SlideshowPost;
  photo: SlideshowPhoto;
  /** Position of this photo within its post (0-based). */
  n: number;
}

/** How long each photo holds before auto-advancing, when Auto is on (ms). */
const AUTO_MS = 5000;

/**
 * `open` starts the slideshow on a photo; `auto` is the one Auto setting shared
 * by the slideshow and the story page's carousel. Null outside a provider (no
 * expand button; the carousel keeps its own setting).
 */
const SlideshowContext = createContext<{
  open: (photoId: string) => void;
  auto: boolean;
  setAuto: (auto: boolean) => void;
} | null>(null);

/** The shared Auto setting, or a local one outside a slideshow provider. */
export function useAuto(): [boolean, (auto: boolean) => void] {
  const ctx = useContext(SlideshowContext);
  const [local, setLocal] = useState(true);
  return ctx ? [ctx.auto, ctx.setAuto] : [local, setLocal];
}

/**
 * Holds the full-screen slideshow for a story page. `posts` are every memory
 * with photos, in timeline order (newest first), so stepping past a post's
 * last photo carries on into the next memory. Closing on a different memory
 * than the one the page shows navigates there.
 */
export function SlideshowProvider({
  posts,
  activeId,
  children,
}: {
  posts: SlideshowPost[];
  activeId: string;
  children: ReactNode;
}) {
  const router = useRouter();
  const slides = useMemo<Slide[]>(
    () =>
      posts.flatMap((post) => post.photos.map((photo, n) => ({ post, photo, n }))),
    [posts],
  );
  const [index, setIndex] = useState<number | null>(null);
  // On by default. Kept here rather than in the overlay so switching it off
  // holds between openings, and so the carousel's switch is the same one.
  const [auto, setAuto] = useState(true);

  const open = useCallback(
    (photoId: string) => {
      const i = slides.findIndex((s) => s.photo.id === photoId);
      if (i !== -1) setIndex(i);
    },
    [slides],
  );

  const close = useCallback(() => {
    const postId = index === null ? null : slides[index]?.post.id;
    setIndex(null);
    if (postId && postId !== activeId) router.push(`/s/${postId}`);
  }, [index, slides, activeId, router]);

  const ctx = useMemo(() => ({ open, auto, setAuto }), [open, auto]);

  return (
    <SlideshowContext.Provider value={ctx}>
      {children}
      {index !== null && slides[index] && (
        <Slideshow
          slides={slides}
          index={index}
          onIndex={setIndex}
          onClose={close}
          auto={auto}
          onAuto={setAuto}
        />
      )}
    </SlideshowContext.Provider>
  );
}

function Slideshow({
  slides,
  index,
  onIndex,
  onClose,
  auto,
  onAuto,
}: {
  slides: Slide[];
  index: number;
  onIndex: (i: number) => void;
  onClose: () => void;
  auto: boolean;
  onAuto: (auto: boolean) => void;
}) {
  const count = slides.length;
  const { post, photo, n } = slides[index];
  const closeRef = useRef<HTMLButtonElement | null>(null);
  const swipeX = useRef<number | null>(null);

  // The last step, for the crossfade: `from` is the photo fading out beneath
  // the new one. `dir` is set when the step crossed into another memory, so
  // both photos also drift sideways; null is a plain crossfade. `seq` remounts
  // the outgoing layer on every step so its animation restarts.
  const [motion, setMotion] = useState<{
    from: SlideshowPhoto;
    dir: "next" | "prev" | null;
    seq: number;
  } | null>(null);

  // Wraps around at either end, like the timeline's arrow keys.
  const step = useCallback(
    (dir: "next" | "prev") => {
      const to = (index + (dir === "next" ? 1 : -1) + count) % count;
      setMotion((m) => ({
        from: photo,
        dir: slides[to].post.id === post.id ? null : dir,
        seq: (m?.seq ?? 0) + 1,
      }));
      onIndex(to);
    },
    [index, count, slides, post.id, photo, onIndex],
  );
  const suffix = motion?.dir ? `-${motion.dir}` : "";
  const next = useCallback(() => step("next"), [step]);
  const prev = useCallback(() => step("prev"), [step]);

  // Arrow keys step, Escape closes. Listening in the capture phase and stopping
  // the event keeps the page's own window listeners (the timeline's arrow-key
  // navigation, Escape-to-feed) from also acting while the slideshow is up.
  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      const action =
        e.key === "ArrowRight" ? next : e.key === "ArrowLeft" ? prev : e.key === "Escape" ? onClose : null;
      if (!action) return;
      e.preventDefault();
      e.stopPropagation();
      action();
    }
    window.addEventListener("keydown", onKey, true);
    return () => window.removeEventListener("keydown", onKey, true);
  }, [next, prev, onClose]);

  // Auto: move on after AUTO_MS. Keyed on the index, so any step — manual or
  // automatic — restarts the full hold on the new photo.
  useEffect(() => {
    if (!auto || count < 2) return;
    const t = window.setTimeout(next, AUTO_MS);
    return () => window.clearTimeout(t);
  }, [auto, count, next, index]);

  // Take focus while open, hand it back to the expand button on close, and keep
  // the page underneath from scrolling.
  useEffect(() => {
    const returnTo = document.activeElement as HTMLElement | null;
    closeRef.current?.focus();
    document.body.classList.add("slideshow-open");
    return () => {
      document.body.classList.remove("slideshow-open");
      if (returnTo?.isConnected) returnTo.focus();
    };
  }, []);

  // Warm the neighbours so stepping doesn't wait on the network.
  useEffect(() => {
    for (const i of [index + 1, index - 1]) {
      const s = slides[(i + count) % count];
      if (s) new Image().src = s.photo.url;
    }
  }, [index, slides, count]);

  return (
    <div
      className="slideshow"
      role="dialog"
      aria-modal="true"
      aria-label="Photo slideshow"
      onPointerDown={(e) => {
        if (e.pointerType === "touch") swipeX.current = e.clientX;
      }}
      onPointerUp={(e) => {
        const start = swipeX.current;
        swipeX.current = null;
        if (start === null) return;
        const dx = e.clientX - start;
        if (Math.abs(dx) > 48) (dx < 0 ? next : prev)();
      }}
    >
      <div className="slideshow-bar">
        <div className="slideshow-meta" key={post.id}>
          <p className="slideshow-date">{post.dateLabel}</p>
          <h2 className="slideshow-title">{post.heading}</h2>
          <p className="slideshow-name">{post.author}</p>
        </div>
        <button
          ref={closeRef}
          type="button"
          className="photo-button slideshow-close"
          onClick={onClose}
          aria-label="Close slideshow"
        >
          <CloseIcon />
        </button>
      </div>

      <div className="slideshow-stage">
        <div className="slideshow-frame">
          {motion && (
            <div
              key={`out-${motion.seq}`}
              className="slideshow-layer"
              data-motion={`out${suffix}`}
              aria-hidden
              inert
              onAnimationEnd={(e) => {
                if (e.target === e.currentTarget) setMotion(null);
              }}
            >
              <StoryPhoto photo={motion.from} expandable={false} />
            </div>
          )}
          <div
            key={photo.id}
            className="slideshow-layer"
            data-motion={motion ? `in${suffix}` : undefined}
          >
            <StoryPhoto photo={photo} expandable={false} />
          </div>
        </div>
        {count > 1 && (
          <>
            <button
              type="button"
              className="photo-button slideshow-arrow slideshow-prev"
              onClick={prev}
              aria-label="Previous photo"
            >
              <ChevronIcon dir="left" />
            </button>
            <button
              type="button"
              className="photo-button slideshow-arrow slideshow-next"
              onClick={next}
              aria-label="Next photo"
            >
              <ChevronIcon dir="right" />
            </button>
          </>
        )}
      </div>

      <div className="slideshow-foot">
        <div className="slideshow-foot-side">
          {count > 1 && <AutoSwitch on={auto} onChange={onAuto} />}
        </div>
        <div aria-live={auto ? "off" : "polite"}>
          {post.photos.length > 1 && (
            <>
              <div className="slideshow-dots" aria-hidden>
                {post.photos.map((p, i) => (
                  <span
                    key={p.id}
                    className="slideshow-dot"
                    data-active={i === n ? "true" : undefined}
                  >
                    {i === n && auto && (
                      // Remounts per photo so the sweep restarts with the timer.
                      <span
                        key={index}
                        className="slideshow-dot-fill"
                        style={{ animationDuration: `${AUTO_MS}ms` }}
                      />
                    )}
                  </span>
                ))}
              </div>
              <span className="sr-only">
                Photo {n + 1} of {post.photos.length}
              </span>
            </>
          )}
        </div>
        <div className="slideshow-foot-side" />
      </div>
    </div>
  );
}

/**
 * A story photo sized to its own shape so its box — and the expand button in
 * the top-right corner — hugs the visible image. It fits inside the nearest
 * size container (see `.story-photo` in globals.css). The stored dimensions
 * give the shape up front; the loaded image's natural size corrects it.
 */
export function StoryPhoto({
  photo,
  expandable = true,
}: {
  photo: SlideshowPhoto;
  expandable?: boolean;
}) {
  const openSlideshow = useContext(SlideshowContext)?.open;
  const imgRef = useRef<HTMLImageElement | null>(null);
  const [natural, setNatural] = useState<number | null>(null);
  const ratio =
    natural ?? (photo.width && photo.height ? photo.width / photo.height : null);

  const measure = useCallback(() => {
    const img = imgRef.current;
    if (img?.naturalWidth && img.naturalHeight) {
      setNatural(img.naturalWidth / img.naturalHeight);
    }
  }, []);

  // A server-rendered image can finish loading before hydration, missing onLoad.
  useEffect(() => {
    if (imgRef.current?.complete) measure();
  }, [measure]);

  return (
    <div
      className="story-photo"
      style={ratio ? ({ "--ar": String(ratio) } as CSSProperties) : undefined}
    >
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img ref={imgRef} src={photo.url} alt="" onLoad={measure} />
      {expandable && openSlideshow && (
        <button
          type="button"
          className="photo-button story-photo-expand"
          onClick={() => openSlideshow(photo.id)}
          aria-label="View in slideshow"
        >
          <ExpandIcon />
        </button>
      )}
    </div>
  );
}

/** The "Auto" on/off switch, for controls sitting on a black panel. */
export function AutoSwitch({
  on,
  onChange,
}: {
  on: boolean;
  onChange: (on: boolean) => void;
}) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={on}
      className="auto-switch"
      onClick={() => onChange(!on)}
    >
      <span className="auto-switch-track" aria-hidden />
      <span>Auto</span>
    </button>
  );
}

function ExpandIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 16 16" fill="none" aria-hidden>
      <path
        d="M9.5 2.5h4v4M13.5 2.5 9 7M6.5 13.5h-4v-4M2.5 13.5 7 9"
        stroke="currentColor"
        strokeWidth="1.6"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

function CloseIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 16 16" fill="none" aria-hidden>
      <path
        d="M4 4l8 8M12 4l-8 8"
        stroke="currentColor"
        strokeWidth="1.6"
        strokeLinecap="round"
      />
    </svg>
  );
}

function ChevronIcon({ dir }: { dir: "left" | "right" }) {
  return (
    <svg width="18" height="18" viewBox="0 0 16 16" fill="none" aria-hidden>
      <path
        d={dir === "left" ? "M10 3L5 8l5 5" : "M6 3l5 5-5 5"}
        stroke="currentColor"
        strokeWidth="1.8"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}
