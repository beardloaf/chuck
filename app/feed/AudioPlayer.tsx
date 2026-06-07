"use client";

import { useEffect, useRef, useState } from "react";

interface Props {
  src: string;
  durationMs?: number;
  peaks?: number[];
  /** Stop click events from bubbling — used when the player is inside a tile <Link>. */
  stopBubble?: boolean;
  /** Compact tile-friendly layout (smaller play button + duration). */
  compact?: boolean;
}

/**
 * Custom audio player with a clickable waveform scrubber. Falls back to
 * native <audio controls> if peaks aren't available.
 */
export function AudioPlayer({ src, durationMs, peaks, stopBubble, compact }: Props) {
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const [playing, setPlaying] = useState(false);
  const [progress, setProgress] = useState(0);
  const [duration, setDuration] = useState<number | undefined>(
    durationMs ? durationMs / 1000 : undefined,
  );

  useEffect(() => {
    if (!peaks || !canvasRef.current) return;
    drawWaveform(canvasRef.current, peaks, progress);
  }, [peaks, progress]);

  // webm blobs may report a non-finite duration until fully played; fall back
  // to the known durationMs for progress + seeking.
  function effDuration(el: HTMLAudioElement | null): number {
    if (el && Number.isFinite(el.duration) && el.duration > 0) return el.duration;
    if (durationMs && durationMs > 0) return durationMs / 1000;
    return 0;
  }

  useEffect(() => {
    const el = audioRef.current;
    if (!el) return;
    const onTime = () => {
      const d = effDuration(el);
      if (d > 0) setProgress(Math.min(1, el.currentTime / d));
    };
    const onMeta = () => {
      if (Number.isFinite(el.duration)) setDuration(el.duration);
    };
    const onEnd = () => setPlaying(false);
    el.addEventListener("timeupdate", onTime);
    el.addEventListener("loadedmetadata", onMeta);
    el.addEventListener("ended", onEnd);
    return () => {
      el.removeEventListener("timeupdate", onTime);
      el.removeEventListener("loadedmetadata", onMeta);
      el.removeEventListener("ended", onEnd);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [durationMs]);

  function maybeStop(e: React.SyntheticEvent) {
    if (stopBubble) {
      e.stopPropagation();
      e.preventDefault();
    }
  }

  function toggle(e: React.MouseEvent) {
    maybeStop(e);
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

  function seekTo(ratio: number) {
    const el = audioRef.current;
    if (!el) return;
    const d = effDuration(el);
    if (d > 0) {
      const t = ratio * d;
      if (Number.isFinite(t)) el.currentTime = t;
    }
    setProgress(ratio);
  }

  function handleCanvasClick(e: React.MouseEvent<HTMLCanvasElement>) {
    maybeStop(e);
    const rect = e.currentTarget.getBoundingClientRect();
    const ratio = (e.clientX - rect.left) / rect.width;
    seekTo(Math.max(0, Math.min(1, ratio)));
  }

  if (!peaks || peaks.length === 0) {
    return (
      <audio
        ref={audioRef}
        src={src}
        controls
        preload="metadata"
        className="w-full rounded-2xl"
        onClick={maybeStop}
      />
    );
  }

  return (
    <div className={`audio-player ${compact ? "audio-player-compact" : ""}`} onClick={maybeStop}>
      <audio ref={audioRef} src={src} preload="metadata" />
      <button
        type="button"
        className="audio-play"
        onClick={toggle}
        aria-label={playing ? "Pause" : "Play"}
      >
        {playing ? (
          <svg width="14" height="14" viewBox="0 0 14 14" fill="currentColor">
            <rect x="2" y="1" width="3" height="12" rx="1" />
            <rect x="9" y="1" width="3" height="12" rx="1" />
          </svg>
        ) : (
          <svg width="14" height="14" viewBox="0 0 14 14" fill="currentColor">
            <path d="M3 1.5 L12 7 L3 12.5 Z" />
          </svg>
        )}
      </button>
      <canvas ref={canvasRef} width={600} height={48} onClick={handleCanvasClick} />
      <span className="text-xs text-ink-3 tabular-nums w-12 text-right">
        {duration != null ? formatTime(duration) : "—"}
      </span>
    </div>
  );
}

function drawWaveform(canvas: HTMLCanvasElement, peaks: number[], progress: number) {
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

  // Theme-aware colors: read the cascaded tokens off the canvas element.
  const cs = getComputedStyle(canvas);
  const played = cs.getPropertyValue("--ink").trim() || "#f4f4f5";
  const unplayed = cs.getPropertyValue("--line-strong").trim() || "#3a3a44";

  const barW = 2;
  const gap = 1;
  const slots = Math.floor(w / (barW + gap));
  const samples = resamplePeaks(peaks, slots);
  const playedSlots = Math.floor(slots * progress);

  for (let i = 0; i < samples.length; i++) {
    const v = samples[i] / 255;
    const barH = Math.max(2, v * h * 0.85);
    const x = i * (barW + gap);
    const y = (h - barH) / 2;
    ctx.fillStyle = i <= playedSlots ? played : unplayed;
    ctx.fillRect(x, y, barW, barH);
  }
}

function resamplePeaks(peaks: number[], target: number): number[] {
  if (peaks.length === target) return peaks;
  const out: number[] = [];
  const ratio = peaks.length / target;
  for (let i = 0; i < target; i++) {
    const idx = Math.floor(i * ratio);
    out.push(peaks[idx] ?? 0);
  }
  return out;
}

function formatTime(sec: number): string {
  const totalSec = Math.floor(sec);
  const m = Math.floor(totalSec / 60);
  const s = totalSec % 60;
  return `${m}:${s.toString().padStart(2, "0")}`;
}
