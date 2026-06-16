"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Recorder } from "./Recorder";
import { MediaPicker } from "./MediaPicker";
import { filesToAttachments } from "./mediaFiles";
import type { Attachment } from "./types";
import type { FeedPost } from "@/app/feed/Tile";

const STORAGE_KEY = "mikula.composer.v1";

export function Composer({
  onSubmitted,
  onDirtyChange,
}: {
  onSubmitted?: (pending: FeedPost) => void;
  onDirtyChange?: (dirty: boolean) => void;
}) {
  const [author, setAuthor] = useState("");
  const [title, setTitle] = useState("");
  const [body, setBody] = useState("");
  const [attachments, setAttachments] = useState<Attachment[]>([]);
  const [recording, setRecording] = useState(false);
  const [dropActive, setDropActive] = useState(false);
  const [mediaMode, setMediaMode] = useState<"upload" | "record">("upload");
  // Default the story date to the current month/year (the user only changes it
  // if the memory is from another time).
  const [month, setMonth] = useState(() =>
    String(new Date().getMonth() + 1).padStart(2, "0"),
  ); // "01".."12"
  const [year, setYear] = useState(() => String(new Date().getFullYear())); // "YYYY"
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);
  const [phase, setPhase] = useState<"idle" | "uploading" | "saving">("idle");
  const [uploadPct, setUploadPct] = useState<number | null>(null);
  const [submittedVideo, setSubmittedVideo] = useState(false);

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

  // Show the "when was this?" date once there's a story or any media.
  const showDate = body.trim().length > 0 || attachments.length > 0;

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
      if (/^\d{4}$/.test(yr)) {
        // Store the chosen month/year as the first of that month.
        const mo = /^\d{2}$/.test(month) ? month : "01";
        fd.append("storyDate", `${yr}-${mo}-01`);
      }
      // On Vercel, upload media straight to Blob (handles large videos that
      // would exceed the function body limit). Locally, post the files inline.
      const hadVideo = attachments.some((a) => a.type === "video");
      const useBlob =
        process.env.NEXT_PUBLIC_BLOB_UPLOAD === "1" && attachments.length > 0;
      if (useBlob) {
        setPhase("uploading");
        setUploadPct(0);
        const { upload } = await import("@vercel/blob/client");
        for (let i = 0; i < attachments.length; i++) {
          const a = attachments[i];
          const safeName = a.file.name.replace(/[^\w.-]/g, "_") || "upload";
          const blob = await upload(`uploads/${Date.now()}-${safeName}`, a.file, {
            access: "public",
            handleUploadUrl: "/api/blob/upload",
            contentType: a.file.type || undefined,
            onUploadProgress: (ev) => {
              // overall progress across all attachments (0–100)
              const overall =
                ((i + ev.percentage / 100) / attachments.length) * 100;
              setUploadPct(Math.min(100, Math.round(overall)));
            },
          });
          fd.append("mediaUrl[]", blob.url);
          fd.append("mediaType[]", a.type);
          fd.append("mediaMime[]", a.file.type || "");
          fd.append("durationMs", a.durationMs != null ? String(a.durationMs) : "");
          fd.append("width", a.width != null ? String(a.width) : "");
          fd.append("height", a.height != null ? String(a.height) : "");
          fd.append("peaks", a.peaks ? JSON.stringify(a.peaks) : "");
        }
        setUploadPct(100);
      } else {
        for (const a of attachments) {
          fd.append("media[]", a.file, a.file.name);
          fd.append("durationMs", a.durationMs != null ? String(a.durationMs) : "");
          fd.append("width", a.width != null ? String(a.width) : "");
          fd.append("height", a.height != null ? String(a.height) : "");
          fd.append("peaks", a.peaks ? JSON.stringify(a.peaks) : "");
        }
      }

      setPhase("saving");
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
      // Fire-and-forget: transcode any uploaded video to a small H.264 MP4 on
      // the server so we serve a lightweight file (lower bandwidth/storage fees).
      const created = (await res.json().catch(() => null)) as {
        id?: string;
      } | null;
      if (created?.id && hadVideo) {
        fetch(`/api/posts/${created.id}/compress`, { method: "POST" }).catch(
          () => {},
        );
      }
      // Don't navigate — show success state. Post awaits admin approval.
      setSubmittedVideo(hadVideo);
      setSuccess(true);
      setTitle("");
      setBody("");
      setYear(String(new Date().getFullYear()));
      setMonth(String(new Date().getMonth() + 1).padStart(2, "0"));
      setMediaMode("upload");
      // Hand the just-submitted memory to the feed as a local "pending" preview
      // (shown only to this author until it's approved). Ownership of the object
      // URLs transfers to the feed, so we don't revoke them here.
      const monthNum = /^\d{2}$/.test(month) ? Number(month) : 1;
      const pendingPost: FeedPost = {
        id: created?.id ?? `pending-${Date.now()}`,
        author: author.trim() || "Anonymous",
        title: title.trim() || null,
        body: body.trim() || null,
        createdAt: Date.now(),
        storyDate: /^\d{4}$/.test(yr) ? Date.UTC(Number(yr), monthNum - 1, 1) : null,
        media: attachments.map((a) => ({
          id: a.id,
          type: a.type,
          url: a.previewUrl,
          mime: a.file.type || "",
          durationMs: a.durationMs ?? null,
          width: a.width ?? null,
          height: a.height ?? null,
          peaks: a.peaks ?? null,
        })),
      };
      setAttachments([]);
      onSubmitted?.(pendingPost);
    } catch (e) {
      const msg = e instanceof Error ? e.message : "Something went wrong.";
      setError(msg);
    } finally {
      setSubmitting(false);
      setPhase("idle");
      setUploadPct(null);
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
        {submittedVideo && (
          <p className="text-xs text-ink-3 leading-relaxed mt-2">
            Your video is being optimized for fast playback in the background —
            nothing more to do.
          </p>
        )}
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

      {showDate && (
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
            /* Thumbnails of what's been added (× to remove), with the "+" add
               tile filling the next free cell — three per row. */
            <div className="media-grid">
              {attachments.map((a) => (
                <MediaThumb
                  key={a.id}
                  a={a}
                  onRemove={() => removeAttachment(a.id)}
                />
              ))}
              <MediaPicker onAdd={addAttachments} />
            </div>
          ) : (
            <>
              {attachments.length > 0 && (
                <div className="media-grid">
                  {attachments.map((a) => (
                    <MediaThumb
                      key={a.id}
                      a={a}
                      onRemove={() => removeAttachment(a.id)}
                    />
                  ))}
                </div>
              )}
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
            </>
          )}
        </div>
      )}

      {error && (
        <p className="text-sm text-danger bg-[color:var(--danger-soft)] rounded-[var(--r-md)] px-4 py-3 border border-[color:rgba(239,68,68,0.3)]">
          {error}
        </p>
      )}

      {submitting ? (
        <div className="upload-status pt-2" aria-live="polite">
          <div
            className={`upload-bar ${phase === "uploading" ? "" : "is-indeterminate"}`}
          >
            {phase === "uploading" && (
              <div
                className="upload-bar-fill"
                style={{ width: `${uploadPct ?? 0}%` }}
              />
            )}
          </div>
          <span className="upload-label">
            {phase === "uploading"
              ? `Uploading media… ${uploadPct ?? 0}%`
              : "Saving your memory…"}
          </span>
        </div>
      ) : (
        <div className="flex items-center justify-between gap-4 pt-2">
          <p className="composer-note">
            Posts go through a quick review before appearing in the feed.
          </p>
          <button type="submit" className="btn-primary" disabled={!canSubmit}>
            Submit
          </button>
        </div>
      )}
    </form>
  );
}

/** One added item in the media grid: a cover thumbnail with an "×" to remove. */
function MediaThumb({ a, onRemove }: { a: Attachment; onRemove: () => void }) {
  return (
    <div className="media-grid-item">
      {a.type === "image" ? (
        /* eslint-disable-next-line @next/next/no-img-element */
        <img
          src={a.previewUrl}
          alt=""
          onError={(e) => {
            // Some browsers (e.g. desktop Chrome) can't render a HEIC preview;
            // it still converts + uploads fine, so show a neutral placeholder.
            const el = e.currentTarget;
            el.style.display = "none";
            el.parentElement?.setAttribute("data-noimg", "true");
          }}
        />
      ) : a.type === "video" ? (
        <video src={a.previewUrl} muted playsInline preload="metadata" />
      ) : (
        <span className="media-grid-audio" aria-hidden>
          <MicIcon />
        </span>
      )}
      <button
        type="button"
        className="media-grid-remove"
        onClick={onRemove}
        aria-label={`Remove ${a.type}`}
      >
        <XIcon />
      </button>
    </div>
  );
}

function XIcon() {
  return (
    <svg width="14" height="14" viewBox="0 0 14 14" fill="none" aria-hidden>
      <path
        d="M3.5 3.5l7 7M10.5 3.5l-7 7"
        stroke="currentColor"
        strokeWidth="1.8"
        strokeLinecap="round"
      />
    </svg>
  );
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
