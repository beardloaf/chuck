"use client";

import { useEffect, useRef, useState } from "react";

/**
 * Ambient looping video preview for a tile, with a duration badge that ticks
 * down as it plays (resets each loop).
 */
export function TileVideo({ src, durationMs }: { src: string; durationMs?: number }) {
  const ref = useRef<HTMLVideoElement | null>(null);
  const [remainingMs, setRemainingMs] = useState<number | null>(
    durationMs ?? null,
  );

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const onTime = () => {
      const dur =
        Number.isFinite(el.duration) && el.duration > 0
          ? el.duration
          : durationMs
            ? durationMs / 1000
            : 0;
      if (dur > 0) setRemainingMs(Math.max(0, (dur - el.currentTime) * 1000));
    };
    el.addEventListener("timeupdate", onTime);
    return () => el.removeEventListener("timeupdate", onTime);
  }, [durationMs]);

  return (
    <>
      <video
        ref={ref}
        src={src}
        className="tile-fill"
        autoPlay
        muted
        loop
        playsInline
        preload="metadata"
      />
      {remainingMs != null ? (
        <span className="tile-badge tile-badge-duration">{fmt(remainingMs)}</span>
      ) : null}
    </>
  );
}

function fmt(ms: number): string {
  const t = Math.round(ms / 1000);
  return `${Math.floor(t / 60)}:${(t % 60).toString().padStart(2, "0")}`;
}
