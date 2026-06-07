"use client";

import { useEffect, useRef, useState } from "react";
import type { Attachment } from "./types";

/** Hard cap on recording length (audio + video). */
const MAX_RECORD_MS = 5 * 60 * 1000;

/**
 * Inline recorder — audio-only by default, or audio+video when `withVideo` is
 * true. Audio-only shows a live, sound-reactive waveform (no camera); video
 * shows the camera preview. Auto-stops at 5 minutes. On stop, emits an
 * Attachment back to the parent.
 */
export function Recorder({
  withVideo,
  onComplete,
  onCancel,
}: {
  withVideo: boolean;
  onComplete: (a: Attachment) => void;
  onCancel: () => void;
}) {
  const [status, setStatus] = useState<
    "requesting" | "recording" | "stopped" | "error"
  >("requesting");
  const [error, setError] = useState<string | null>(null);
  const [elapsed, setElapsed] = useState(0);

  const streamRef = useRef<MediaStream | null>(null);
  const recorderRef = useRef<MediaRecorder | null>(null);
  const chunksRef = useRef<Blob[]>([]);
  const audioCtxRef = useRef<AudioContext | null>(null);
  const analyserRef = useRef<AnalyserNode | null>(null);
  const rafRef = useRef<number | null>(null);
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const peaksRef = useRef<number[]>([]);
  const startTsRef = useRef<number>(0);
  const recordedKindRef = useRef<"audio" | "video">(withVideo ? "video" : "audio");

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const stream = await navigator.mediaDevices.getUserMedia({
          audio: true,
          video: withVideo ? { facingMode: "user" } : false,
        });
        if (cancelled) {
          stream.getTracks().forEach((t) => t.stop());
          return;
        }
        streamRef.current = stream;
        recordedKindRef.current = withVideo ? "video" : "audio";

        // Live video preview
        if (withVideo && videoRef.current) {
          videoRef.current.srcObject = stream;
          videoRef.current.play().catch(() => {});
        }

        // Audio analyser for visualization (used in audio-only mode for waveform)
        const AudioCtx =
          window.AudioContext ||
          (window as unknown as { webkitAudioContext: typeof AudioContext })
            .webkitAudioContext;
        const ctx = new AudioCtx();
        audioCtxRef.current = ctx;
        const source = ctx.createMediaStreamSource(stream);
        const analyser = ctx.createAnalyser();
        analyser.fftSize = 512;
        source.connect(analyser);
        analyserRef.current = analyser;

        const mime = pickMime(withVideo);
        const recorder = new MediaRecorder(
          stream,
          mime ? { mimeType: mime } : undefined,
        );
        recorderRef.current = recorder;
        chunksRef.current = [];
        peaksRef.current = [];

        recorder.ondataavailable = (e) => {
          if (e.data && e.data.size > 0) chunksRef.current.push(e.data);
        };
        recorder.onstop = handleStop;
        recorder.start(250);
        startTsRef.current = performance.now();
        setStatus("recording");
        loop();
      } catch (e) {
        const msg = e instanceof Error ? e.message : "Capture failed";
        setError(msg);
        setStatus("error");
      }
    })();

    return () => {
      cancelled = true;
      cleanup();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [withVideo]);

  function cleanup() {
    if (rafRef.current != null) cancelAnimationFrame(rafRef.current);
    rafRef.current = null;
    if (recorderRef.current && recorderRef.current.state !== "inactive") {
      try {
        recorderRef.current.stop();
      } catch {
        /* ignore */
      }
    }
    streamRef.current?.getTracks().forEach((t) => t.stop());
    streamRef.current = null;
    if (videoRef.current) videoRef.current.srcObject = null;
    audioCtxRef.current?.close().catch(() => {});
    audioCtxRef.current = null;
  }

  function loop() {
    const analyser = analyserRef.current;
    const canvas = canvasRef.current;
    if (analyser) {
      const buf = new Uint8Array(analyser.fftSize);
      analyser.getByteTimeDomainData(buf);
      let sum = 0;
      for (let i = 0; i < buf.length; i++) {
        const v = (buf[i] - 128) / 128;
        sum += v * v;
      }
      const rms = Math.sqrt(sum / buf.length);
      const peak = Math.min(255, Math.round(rms * 255 * 3));
      peaksRef.current.push(peak);
      if (canvas) drawWave(canvas, peaksRef.current);
    }
    const el = performance.now() - startTsRef.current;
    setElapsed(el);
    // Cap recordings at 5 minutes (audio and video).
    if (el >= MAX_RECORD_MS) {
      stop();
      return;
    }
    rafRef.current = requestAnimationFrame(loop);
  }

  function handleStop() {
    const mime = recorderRef.current?.mimeType || (withVideo ? "video/webm" : "audio/webm");
    const blob = new Blob(chunksRef.current, { type: mime });
    const isVideo = mime.startsWith("video/");
    const ext = isVideo
      ? mime.includes("mp4") ? "mp4" : "webm"
      : mime.includes("ogg") ? "ogg" : "webm";
    const name = `${isVideo ? "clip" : "voice"}-${Date.now()}.${ext}`;
    const file = new File([blob], name, { type: mime });
    const durationMs = performance.now() - startTsRef.current;

    // For audio: compute compact waveform peaks for the feed's static player.
    let peaks: number[] | undefined;
    if (!isVideo) peaks = downsamplePeaks(peaksRef.current, 120);

    // For video: capture a still frame as width/height (no thumbnail upload
    // here — the feed renders <video preload="metadata"> directly).
    let width: number | undefined;
    let height: number | undefined;
    if (isVideo && videoRef.current) {
      width = videoRef.current.videoWidth || undefined;
      height = videoRef.current.videoHeight || undefined;
    }

    const attachment: Attachment = {
      id: cryptoRandomId(),
      file,
      type: isVideo ? "video" : "audio",
      previewUrl: URL.createObjectURL(blob),
      source: "recorded",
      durationMs: Math.round(durationMs),
      peaks,
      width,
      height,
    };
    onComplete(attachment);
  }

  function stop() {
    if (recorderRef.current && recorderRef.current.state !== "inactive") {
      recorderRef.current.stop();
      setStatus("stopped");
    }
  }

  // -------- render --------
  if (status === "error") {
    return (
      <div className="recorder text-sm">
        <p className="text-ink-2">
          {withVideo ? "Camera/mic" : "Microphone"} unavailable: {error}
        </p>
        <button type="button" className="btn-ghost mt-3" onClick={onCancel}>
          Close
        </button>
      </div>
    );
  }

  const isLive = status === "recording";

  return (
    <div className="recorder rec-pane">
      <div className="rec-stage">
        {withVideo ? (
          <video ref={videoRef} muted playsInline className="rec-stage-video" />
        ) : (
          <canvas ref={canvasRef} width={600} height={120} className="rec-stage-canvas" />
        )}

        <div className="rec-stage-overlay">
          <span className={`rec-dot ${isLive ? "live" : ""}`} aria-hidden />
          <span className="rec-stage-time tabular-nums">{formatTime(elapsed)}</span>
        </div>
      </div>

      <div className="rec-controls">
        <button
          type="button"
          className="rec-btn-cancel"
          onClick={onCancel}
          aria-label="Cancel recording"
        >
          Cancel
        </button>
        <button
          type="button"
          className={`rec-btn ${isLive ? "is-recording" : ""}`}
          onClick={isLive ? stop : undefined}
          aria-label={isLive ? "Stop recording" : "Recording…"}
          disabled={status === "requesting"}
        >
          <span className="rec-btn-inner" />
        </button>
        <span className="rec-controls-spacer" aria-hidden />
      </div>
    </div>
  );
}

// --------------------------- helpers ---------------------------

function pickMime(video: boolean): string | null {
  if (typeof MediaRecorder === "undefined") return null;
  const candidates = video
    ? [
        "video/webm;codecs=vp9,opus",
        "video/webm;codecs=vp8,opus",
        "video/webm",
        "video/mp4",
      ]
    : [
        "audio/webm;codecs=opus",
        "audio/webm",
        "audio/ogg;codecs=opus",
        "audio/mp4",
      ];
  for (const c of candidates) {
    if (MediaRecorder.isTypeSupported(c)) return c;
  }
  return null;
}

function formatTime(ms: number): string {
  const totalSec = Math.floor(ms / 1000);
  const m = Math.floor(totalSec / 60);
  const s = totalSec % 60;
  return `${m}:${s.toString().padStart(2, "0")}`;
}

function drawWave(canvas: HTMLCanvasElement, peaks: number[]) {
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
  ctx.fillStyle = getComputedStyle(canvas).getPropertyValue("--ink").trim() || "#f4f4f5";

  const barW = 2;
  const gap = 1;
  const slots = Math.floor(w / (barW + gap));
  const slice = peaks.slice(-slots);
  for (let i = 0; i < slice.length; i++) {
    const v = slice[i] / 255;
    const barH = Math.max(2, v * h * 0.9);
    const x = i * (barW + gap);
    const y = (h - barH) / 2;
    ctx.fillRect(x, y, barW, barH);
  }
}

function downsamplePeaks(peaks: number[], target: number): number[] {
  if (peaks.length <= target) return peaks.slice();
  const out: number[] = [];
  const bucket = peaks.length / target;
  for (let i = 0; i < target; i++) {
    const start = Math.floor(i * bucket);
    const end = Math.floor((i + 1) * bucket);
    let max = 0;
    for (let j = start; j < end; j++) {
      if (peaks[j] > max) max = peaks[j];
    }
    out.push(max);
  }
  return out;
}

function cryptoRandomId(): string {
  if (typeof crypto !== "undefined" && "randomUUID" in crypto) return crypto.randomUUID();
  return Math.random().toString(36).slice(2);
}
