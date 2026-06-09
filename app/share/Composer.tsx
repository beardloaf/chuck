"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Recorder } from "./Recorder";
import { MediaPicker } from "./MediaPicker";
import { filesToAttachments } from "./mediaFiles";
import type { Attachment } from "./types";

const STORAGE_KEY = "mikula.composer.v1";

export function Composer({
  onSubmitted,
  onDirtyChange,
}: {
  onSubmitted?: () => void;
  onDirtyChange?: (dirty: boolean) => void;
}) {
  const [author, setAuthor] = useState("");
  const [title, setTitle] = useState("");
  const [body, setBody] = useState("");
  const [attachments, setAttachments] = useState<Attachment[]>([]);
  const [recording, setRecording] = useState(false);
  const [dropActive, setDropActive] = useState(false);
  const [mediaMode, setMediaMode] = useState<"upload" | "record">("upload");
  const [month, setMonth] = useState(""); // "01".."12"
  const [year, setYear] = useState(""); // "YYYY"
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);

  useEffect(() => {
    try {
      const saved = localStorage.getItem(STORAGE_KEY);
      if (saved) {
        const data = JSON.parse(saved) as { author?: string };
        if (data.author) setAuthor(data.author);
      }
    } catch {
      /* ignore */
    }
  }, []);
  useEffect(() => {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify({ author }));
    } catch {
      /* ignore */
    }
  }, [author]);

  const attachmentsRef = useRef(attachments);
  attachmentsRef.current = attachments;
  useEffect(() => {
    return () => {
      attachmentsRef.current.forEach((a) => URL.revokeObjectURL(a.previewUrl));
    };
  }, []);

  const addAttachments = useCallback((items: Attachment[]) => {
    setAttachments((cur) => {
      // First time anything's attached → seed the story year to this year so
      // the user only has to change it if it's wrong.
      if (cur.length === 0 && items.length > 0) {
        const now = new Date();
        setYear((y) => y || String(now.getFullYear()));
        setMonth((m) => m || String(now.getMonth() + 1).padStart(2, "0"));
      }
      return [...cur, ...items];
    });
  }, []);
  const removeAttachment = useCallback((id: string) => {
    setAttachments((cur) => {
      const target = cur.find((a) => a.id === id);
      if (target) URL.revokeObjectURL(target.previewUrl);
      return cur.filter((a) => a.id !== id);
    });
  }, []);

  // Drag/drop anywhere on the form adds media (HEIC auto-converted).
  const dragDepth = useRef(0);
  function onDragEnter(e: React.DragEvent) {
    if (!e.dataTransfer.types.includes("Files")) return;
    dragDepth.current += 1;
    setDropActive(true);
  }
  function onDragLeave() {
    dragDepth.current = Math.max(0, dragDepth.current - 1);
    if (dragDepth.current === 0) setDropActive(false);
  }
  async function onDrop(e: React.DragEvent) {
    e.preventDefault();
    dragDepth.current = 0;
    setDropActive(false);
    if (recording) return;
    const items = await filesToAttachments(e.dataTransfer.files);
    if (items.length) addAttachments(items);
  }

  // Safety net: clear the drop overlay whenever a drag ends or a drop lands
  // anywhere — the inner picker stops propagation, so the form's onDrop may not
  // fire, which previously left the "Drop to add media" overlay stuck.
  useEffect(() => {
    const clear = () => {
      dragDepth.current = 0;
      setDropActive(false);
    };
    window.addEventListener("drop", clear);
    window.addEventListener("dragend", clear);
    return () => {
      window.removeEventListener("drop", clear);
      window.removeEventListener("dragend", clear);
    };
  }, []);

  const canSubmit = useMemo(() => {
    return (
      !submitting &&
      (title.trim().length > 0 || body.trim().length > 0 || attachments.length > 0)
    );
  }, [submitting, title, body, attachments.length]);

  // Report "dirty" so the sheet can confirm before discarding progress.
  const dirty =
    !success &&
    (title.trim().length > 0 ||
      body.trim().length > 0 ||
      attachments.length > 0 ||
      recording);
  useEffect(() => {
    onDirtyChange?.(dirty);
  }, [dirty, onDirtyChange]);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!canSubmit) return;
    setSubmitting(true);
    setError(null);

    try {
      const fd = new FormData();
      fd.append("author", author.trim() || "Anonymous");
      fd.append("title", title.trim());
      fd.append("body", body.trim());
      const yr = year.trim();
      if (attachments.length > 0 && /^\d{4}$/.test(yr)) {
        // Store the chosen month/year as the first of that month.
        const mo = /^\d{2}$/.test(month) ? month : "01";
        fd.append("storyDate", `${yr}-${mo}-01`);
      }
      for (const a of attachments) {
        fd.append("media[]", a.file, a.file.name);
        fd.append("durationMs", a.durationMs != null ? String(a.durationMs) : "");
        fd.append("width", a.width != null ? String(a.width) : "");
        fd.append("height", a.height != null ? String(a.height) : "");
        fd.append("peaks", a.peaks ? JSON.stringify(a.peaks) : "");
      }

      const res = await fetch("/api/posts", { method: "POST", body: fd });
      if (!res.ok) {
        const text = await res.text();
        let msg = "Something went wrong.";
        try {
          msg = (JSON.parse(text) as { error?: string }).error ?? msg;
        } catch {
          /* keep default */
        }
        throw new Error(msg);
      }
      // Don't navigate — show success state. Post awaits admin approval.
      setSuccess(true);
      setTitle("");
      setBody("");
      setYear("");
      setMonth("");
      setMediaMode("upload");
      attachments.forEach((a) => URL.revokeObjectURL(a.previewUrl));
      setAttachments([]);
      onSubmitted?.();
    } catch (e) {
      const msg = e instanceof Error ? e.message : "Something went wrong.";
      setError(msg);
    } finally {
      setSubmitting(false);
    }
  }

  if (success) {
    return (
      <div className="card p-6 text-center">
        <p className="headline-md mb-2">Submitted</p>
        <p className="text-sm text-ink-2 leading-relaxed">
          Your story is in the queue. It'll appear in the feed once it's been
          looked over.
        </p>
        <button
          type="button"
          className="btn-ghost mt-5"
          onClick={() => setSuccess(false)}
        >
          Share another
        </button>
      </div>
    );
  }

  return (
    <form
      onSubmit={handleSubmit}
      className={`composer ${dropActive ? "is-dropping" : ""}`}
      onDragEnter={onDragEnter}
      onDragOver={(e) => {
        if (e.dataTransfer.types.includes("Files")) e.preventDefault();
      }}
      onDragLeave={onDragLeave}
      onDrop={onDrop}
    >
      {dropActive && (
        <div className="composer-drop-overlay" aria-hidden>
          <span>Drop to add media</span>
        </div>
      )}
      <input
        type="text"
        className="input"
        placeholder="Your name"
        value={author}
        onChange={(e) => setAuthor(e.target.value)}
        maxLength={80}
      />

      <input
        type="text"
        className="input input-headline"
        placeholder="Headline"
        value={title}
        onChange={(e) => setTitle(e.target.value)}
        maxLength={200}
      />

      <textarea
        className="textarea"
        placeholder="Tell your story"
        value={body}
        onChange={(e) => setBody(e.target.value)}
        maxLength={20_000}
      />

      {attachments.length > 0 && (
        <>
          <ul className="space-y-2">
            {attachments.map((a) => (
              <li key={a.id} className="attachment-chip">
                <AttachmentPreview a={a} />
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium text-ink truncate">
                    {labelFor(a)}
                  </p>
                  <p className="text-xs text-ink-3 truncate">
                    {a.file.name}
                    {a.durationMs ? ` · ${formatDuration(a.durationMs)}` : ""}
                  </p>
                </div>
                <button
                  type="button"
                  className="chip-remove"
                  onClick={() => removeAttachment(a.id)}
                  aria-label={`Remove ${a.type}`}
                >
                  Remove
                </button>
              </li>
            ))}
          </ul>

          <label className="flex items-center justify-between gap-3 px-1">
            <span className="text-sm text-ink-2">When was this?</span>
            <span className="flex gap-2">
              <select
                className="input !w-28 !py-1.5 !px-2.5 text-sm"
                value={month}
                onChange={(e) => setMonth(e.target.value)}
                aria-label="Month"
              >
                <option value="">Month</option>
                {MONTHS.map((m) => (
                  <option key={m.value} value={m.value}>
                    {m.label}
                  </option>
                ))}
              </select>
              <select
                className="input !w-24 !py-1.5 !px-2.5 text-sm"
                value={year}
                onChange={(e) => setYear(e.target.value)}
                aria-label="Year"
              >
                <option value="">Year</option>
                {YEARS.map((y) => (
                  <option key={y} value={y}>
                    {y}
                  </option>
                ))}
              </select>
            </span>
          </label>
        </>
      )}

      {recording ? (
        <Recorder
          withVideo={true}
          onComplete={(att) => {
            addAttachments([att]);
            setRecording(false);
          }}
          onCancel={() => setRecording(false)}
        />
      ) : (
        <div className="space-y-3">
          {/* Upload vs Record — defaults to Upload */}
          <div className="media-mode" role="group" aria-label="Add media">
            <button
              type="button"
              className="media-mode-opt"
              data-on={mediaMode === "upload"}
              onClick={() => setMediaMode("upload")}
            >
              Upload
            </button>
            <button
              type="button"
              className="media-mode-opt"
              data-on={mediaMode === "record"}
              onClick={() => setMediaMode("record")}
            >
              Record
            </button>
          </div>

          {mediaMode === "upload" ? (
            <MediaPicker onAdd={addAttachments} />
          ) : (
            <button
              type="button"
              className="action-tile"
              onClick={() => setRecording(true)}
            >
              <span className="tile-icon" aria-hidden>
                <RecIcon />
              </span>
              <span className="tile-label">Start recording</span>
            </button>
          )}
        </div>
      )}

      {error && (
        <p className="text-sm text-danger bg-[color:var(--danger-soft)] rounded-[var(--r-md)] px-4 py-3 border border-[color:rgba(239,68,68,0.3)]">
          {error}
        </p>
      )}

      <div className="flex items-center justify-between gap-4 pt-2">
        <p className="composer-note">
          Posts go through a quick review before appearing in the feed.
        </p>
        <button type="submit" className="btn-primary" disabled={!canSubmit}>
          {submitting ? "Submitting…" : "Submit"}
        </button>
      </div>
    </form>
  );
}

function labelFor(a: Attachment): string {
  const isRecorded = a.source === "recorded";
  if (a.type === "audio") return isRecorded ? "Voice memo" : "Audio";
  if (a.type === "video") return isRecorded ? "Video clip" : "Video";
  return "Photo";
}

function AttachmentPreview({ a }: { a: Attachment }) {
  if (a.type === "image") {
    return (
      <span className="chip-thumb">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src={a.previewUrl} alt="" className="w-full h-full object-cover" />
      </span>
    );
  }
  if (a.type === "video") {
    return (
      <span className="chip-thumb">
        <video src={a.previewUrl} className="w-full h-full object-cover" muted playsInline />
      </span>
    );
  }
  return (
    <span className="chip-thumb">
      <MicIcon />
    </span>
  );
}

function formatDuration(ms: number): string {
  const totalSec = Math.round(ms / 1000);
  const m = Math.floor(totalSec / 60);
  const s = totalSec % 60;
  return `${m}:${s.toString().padStart(2, "0")}`;
}

// Year options — current year back to 1962.
const YEARS: string[] = (() => {
  const now = new Date().getFullYear();
  const out: string[] = [];
  for (let y = now; y >= 1962; y--) out.push(String(y));
  return out;
})();

const MONTHS: { value: string; label: string }[] = [
  "Jan", "Feb", "Mar", "Apr", "May", "Jun",
  "Jul", "Aug", "Sep", "Oct", "Nov", "Dec",
].map((label, i) => ({ value: String(i + 1).padStart(2, "0"), label }));

function RecIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
      <circle cx="8" cy="8" r="5" fill="currentColor" />
    </svg>
  );
}
function MicIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
      <rect x="6" y="2" width="4" height="8" rx="2" stroke="currentColor" strokeWidth="1.4" />
      <path d="M3.5 7.5a4.5 4.5 0 0 0 9 0M8 12v2" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" />
    </svg>
  );
}
