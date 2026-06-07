"use client";

import { useEffect, useRef, useState } from "react";

/**
 * Audio waveform as the centerpiece of an audio tile. Fills the tile, with a
 * centered play/pause control. Bars recolor with the active theme (read from
 * --ink / --ink-4 so they invert in light vs dark). Click events are kept from
 * bubbling so the surrounding tile <Link> doesn't navigate.
 */
export function TileAudio({
  src,
  peaks,
  durationMs,
}: {
  src: string;
  peaks?: number[];
  durationMs?: number;
}) {
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const [playing, setPlaying] = useState(false);
  const [progress, setProgress] = useState(0);
  const [currentSec, setCurrentSec] = useState(0);

  useEffect(() => {
    draw(canvasRef.current, peaks, progress);
  }, [peaks, progress]);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ro = new ResizeObserver(() => draw(canvas, peaks, progress));
    ro.observe(canvas);
    return () => ro.disconnect();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // MediaRecorder webm blobs often report a non-finite duration until fully
  // played, which breaks progress + seeking. Fall back to the known durationMs.
  function effectiveDuration(el: HTMLAudioElement | null): number {
    if (el && Number.isFinite(el.duration) && el.duration > 0) return el.duration;
    if (durationMs && durationMs > 0) return durationMs / 1000;
    return 0;
  }

  useEffect(() => {
    const el = audioRef.current;
    if (!el) return;
    const onTime = () => {
      const d = effectiveDuration(el);
      if (d > 0) setProgress(Math.min(1, el.currentTime / d));
      setCurrentSec(el.currentTime);
    };
    const onEnd = () => {
      setPlaying(false);
      setProgress(0);
      setCurrentSec(0);
    };
    el.addEventListener("timeupdate", onTime);
    el.addEventListener("ended", onEnd);
    return () => {
      el.removeEventListener("timeupdate", onTime);
      el.removeEventListener("ended", onEnd);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [durationMs]);

  function stop(e: React.SyntheticEvent) {
    e.preventDefault();
    e.stopPropagation();
  }

  function toggle(e: React.MouseEvent) {
    stop(e);
    const el = audioRef.current;
    if (!el) return;
    if (el.paused) {
      el.play();
      setPlaying(true);
    } else {
      el.pause();
      setPlaying(false);
    }
  }

  function seek(e: React.MouseEvent<HTMLCanvasElement>) {
    stop(e);
    const el = audioRef.current;
    const rect = e.currentTarget.getBoundingClientRect();
    const ratio = Math.max(0, Math.min(1, (e.clientX - rect.left) / rect.width));
    const d = effectiveDuration(el);
    if (el && d > 0) {
      const t = ratio * d;
      if (Number.isFinite(t)) el.currentTime = t;
    }
    setProgress(ratio);
  }

  return (
    <div className="tile-audio-wrap">
      <audio ref={audioRef} src={src} preload="metadata" onClick={stop} />
      <canvas ref={canvasRef} className="tile-audio-canvas" onClick={seek} />
      <button
        type="button"
        className="tile-audio-play"
        onClick={toggle}
        aria-label={playing ? "Pause" : "Play"}
      >
        {playing ? (
          <svg width="18" height="18" viewBox="0 0 18 18" fill="currentColor">
            <rect x="3" y="2" width="4" height="14" rx="1.2" />
            <rect x="11" y="2" width="4" height="14" rx="1.2" />
          </svg>
        ) : (
          <svg width="18" height="18" viewBox="0 0 18 18" fill="currentColor">
            <path d="M4 2.5 L15 9 L4 15.5 Z" />
          </svg>
        )}
      </button>
      {durationMs ? (
        <span className="tile-badge tile-badge-duration">
          {playing
            ? fmt(Math.max(0, durationMs - currentSec * 1000))
            : fmt(durationMs)}
        </span>
      ) : null}
    </div>
  );
}

function fmt(ms: number): string {
  const t = Math.round(ms / 1000);
  return `${Math.floor(t / 60)}:${(t % 60).toString().padStart(2, "0")}`;
}

function draw(
  canvas: HTMLCanvasElement | null,
  peaks: number[] | undefined,
  progress: number,
) {
  if (!canvas || !peaks || peaks.length === 0) return;
  const ctx = canvas.getContext("2d");
  if (!ctx) return;
  const dpr = window.devicePixelRatio || 1;
  const w = canvas.clientWidth;
  const h = canvas.clientHeight;
  if (canvas.width !== Math.round(w * dpr) || canvas.height !== Math.round(h * dpr)) {
    canvas.width = Math.round(w * dpr);
    canvas.height = Math.round(h * dpr);
  }
  ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  ctx.clearRect(0, 0, w, h);

  const cs = getComputedStyle(canvas);
  const played = cs.getPropertyValue("--ink").trim() || "#f4f4f5";
  const dim = cs.getPropertyValue("--ink-4").trim() || "#52525b";

  // Bars sized to fill the width; tallest bar ~70% of height.
  const gap = Math.max(2, Math.round(w / 90));
  const barW = Math.max(2, Math.round(w / 70));
  const slots = Math.max(1, Math.floor(w / (barW + gap)));
  const samples = resample(peaks, slots);
  const playedSlots = Math.floor(slots * progress);
  const maxH = h * 0.7;
  const totalW = slots * (barW + gap) - gap;
  const startX = (w - totalW) / 2;

  for (let i = 0; i < samples.length; i++) {
    const v = samples[i] / 255;
    const barH = Math.max(3, v * maxH);
    const x = startX + i * (barW + gap);
    const y = (h - barH) / 2;
    ctx.fillStyle = i <= playedSlots ? played : dim;
    ctx.beginPath();
    // rounded bars
    const r = barW / 2;
    roundRect(ctx, x, y, barW, barH, r);
    ctx.fill();
  }
}

function roundRect(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  w: number,
  h: number,
  r: number,
) {
  const rr = Math.min(r, w / 2, h / 2);
  ctx.moveTo(x + rr, y);
  ctx.arcTo(x + w, y, x + w, y + h, rr);
  ctx.arcTo(x + w, y + h, x, y + h, rr);
  ctx.arcTo(x, y + h, x, y, rr);
  ctx.arcTo(x, y, x + w, y, rr);
}

function resample(peaks: number[], target: number): number[] {
  if (peaks.length === target) return peaks;
  const out: number[] = [];
  const ratio = peaks.length / target;
  for (let i = 0; i < target; i++) {
    const start = Math.floor(i * ratio);
    const end = Math.max(start + 1, Math.floor((i + 1) * ratio));
    let max = 0;
    for (let j = start; j < end && j < peaks.length; j++) {
      if (peaks[j] > max) max = peaks[j];
    }
    out.push(max);
  }
  return out;
}
