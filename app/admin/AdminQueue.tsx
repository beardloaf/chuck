"use client";

import { useEffect, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { formatDistanceToNowStrict } from "date-fns";
import { AudioPlayer } from "@/app/feed/AudioPlayer";
import { isCompressedVideo } from "@/lib/site";
import { maybeConvertHeic } from "@/app/share/mediaFiles";

export interface AdminMedia {
  id: string;
  type: "audio" | "image" | "video";
  url: string;
  mime: string;
  durationMs: number | null;
  width: number | null;
  height: number | null;
  peaks: number[] | null;
}

export interface AdminPost {
  id: string;
  author: string;
  title: string | null;
  body: string | null;
  status: string;
  createdAt: number;
  storyDate: number | null;
  media: AdminMedia[];
}

const MONTHS: { value: string; label: string }[] = [
  "Jan", "Feb", "Mar", "Apr", "May", "Jun",
  "Jul", "Aug", "Sep", "Oct", "Nov", "Dec",
].map((label, i) => ({ value: String(i + 1).padStart(2, "0"), label }));

const YEARS: string[] = (() => {
  const now = new Date().getFullYear();
  const out: string[] = [];
  for (let y = now; y >= 1962; y--) out.push(String(y));
  return out;
})();

const monthOf = (d: Date | null) =>
  d ? String(d.getUTCMonth() + 1).padStart(2, "0") : "";
const yearOf = (d: Date | null) => (d ? String(d.getUTCFullYear()) : "");

export function AdminQueue({
  items,
  filter,
}: {
  items: AdminPost[];
  filter: string;
}) {
  if (items.length === 0) {
    return (
      <div className="card p-10 text-center">
        <p className="headline-md mb-2">Nothing {filter}</p>
        <p className="text-sm text-ink-2">
          {filter === "pending"
            ? "No stories are waiting for review."
            : `No ${filter} stories.`}
        </p>
      </div>
    );
  }
  return (
    <ul className="space-y-4">
      {items.map((p) => (
        <li key={p.id}>
          <AdminCard post={p} />
        </li>
      ))}
    </ul>
  );
}

function AdminCard({ post }: { post: AdminPost }) {
  const router = useRouter();
  const [busy, setBusy] = useState<
    "approving" | "rejecting" | "pending" | "deleting" | null
  >(null);
  const [adding, setAdding] = useState(false);
  const [uploadPct, setUploadPct] = useState<number | null>(null);
  const [, startTransition] = useTransition();

  // A Blob video that hasn't been transcoded yet is still being optimized
  // server-side; poll so the converted version (and the cleared "Optimizing…"
  // badge) show up without a manual refresh.
  const converting = post.media.some(
    (m) =>
      m.type === "video" &&
      /\.blob\.vercel-storage\.com\//i.test(m.url) &&
      !isCompressedVideo(m.url),
  );
  useEffect(() => {
    if (!converting) return;
    // Transcodes can take ~2 min; poll long enough that the badge clears itself.
    const iv = setInterval(() => startTransition(() => router.refresh()), 5000);
    const stop = setTimeout(() => clearInterval(iv), 360_000);
    return () => {
      clearInterval(iv);
      clearTimeout(stop);
    };
  }, [converting, router]);
  const created = new Date(post.createdAt);
  const storyDate = post.storyDate ? new Date(post.storyDate) : null;

  // Editable fields.
  const [author, setAuthor] = useState(post.author);
  const [title, setTitle] = useState(post.title ?? "");
  const [body, setBody] = useState(post.body ?? "");
  const [month, setMonth] = useState(monthOf(storyDate));
  const [year, setYear] = useState(yearOf(storyDate));
  const [saving, setSaving] = useState(false);

  const dirty =
    author !== post.author ||
    title !== (post.title ?? "") ||
    body !== (post.body ?? "") ||
    month !== monthOf(storyDate) ||
    year !== yearOf(storyDate);

  async function setStatus(status: "approved" | "rejected" | "pending") {
    setBusy(
      status === "approved"
        ? "approving"
        : status === "rejected"
          ? "rejecting"
          : "pending",
    );
    try {
      const res = await fetch(`/api/admin/posts/${post.id}/status`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ status }),
      });
      if (!res.ok) throw new Error("Update failed");
      startTransition(() => router.refresh());
    } finally {
      setBusy(null);
    }
  }

  async function save() {
    setSaving(true);
    try {
      const res = await fetch(`/api/admin/posts/${post.id}`, {
        method: "PATCH",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          author,
          title,
          body,
          storyDate: year && month ? `${year}-${month}-01` : null,
        }),
      });
      if (!res.ok) throw new Error("Update failed");
      startTransition(() => router.refresh());
    } finally {
      setSaving(false);
    }
  }

  async function remove() {
    if (!window.confirm("Delete this post permanently? This can't be undone."))
      return;
    setBusy("deleting");
    try {
      const res = await fetch(`/api/admin/posts/${post.id}`, {
        method: "DELETE",
      });
      if (!res.ok) throw new Error("Delete failed");
      startTransition(() => router.refresh());
    } finally {
      setBusy(null);
    }
  }

  async function removeMedia(mediaId: string) {
    if (!window.confirm("Remove this media from the post?")) return;
    const res = await fetch(`/api/admin/media/${mediaId}`, { method: "DELETE" });
    if (res.ok) startTransition(() => router.refresh());
  }

  // Reorder media: swap item at `index` with its neighbour and persist the new
  // order (positions = array index).
  async function moveMedia(index: number, dir: -1 | 1) {
    const order = post.media.map((m) => m.id);
    const to = index + dir;
    if (to < 0 || to >= order.length) return;
    [order[index], order[to]] = [order[to], order[index]];
    const res = await fetch(`/api/admin/posts/${post.id}/media`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ ids: order }),
    });
    if (res.ok) startTransition(() => router.refresh());
  }

  async function addMedia(fileList: FileList | null) {
    if (!fileList || fileList.length === 0) return;
    setAdding(true);
    try {
      // Convert HEIC/HEIF → JPEG client-side (browsers can't display HEIC);
      // drop any file whose conversion fails.
      const files = (
        await Promise.all(Array.from(fileList).map((f) => maybeConvertHeic(f)))
      ).filter((f): f is File => f !== null);
      if (files.length === 0) return;

      const fd = new FormData();
      const typeOf = (f: File) =>
        f.type.startsWith("video/")
          ? "video"
          : f.type.startsWith("audio/")
            ? "audio"
            : "image";
      if (process.env.NEXT_PUBLIC_BLOB_UPLOAD === "1") {
        setUploadPct(0);
        const { upload } = await import("@vercel/blob/client");
        for (let i = 0; i < files.length; i++) {
          const file = files[i];
          const safe = file.name.replace(/[^\w.-]/g, "_") || "upload";
          const blob = await upload(`uploads/${Date.now()}-${safe}`, file, {
            access: "public",
            handleUploadUrl: "/api/blob/upload",
            contentType: file.type || undefined,
            onUploadProgress: (ev) => {
              const overall = ((i + ev.percentage / 100) / files.length) * 100;
              setUploadPct(Math.min(100, Math.round(overall)));
            },
          });
          fd.append("mediaUrl[]", blob.url);
          fd.append("mediaType[]", typeOf(file));
          fd.append("mediaMime[]", file.type || "");
          fd.append("durationMs", "");
          fd.append("width", "");
          fd.append("height", "");
        }
        setUploadPct(100);
      } else {
        for (const file of files) {
          fd.append("media[]", file, file.name);
          fd.append("durationMs", "");
          fd.append("width", "");
          fd.append("height", "");
        }
      }
      const res = await fetch(`/api/admin/posts/${post.id}/media`, {
        method: "POST",
        body: fd,
      });
      if (!res.ok) throw new Error("Add failed");
      // Fire-and-forget H.264 transcode of any added video (server-side).
      if (files.some((f) => f.type.startsWith("video/"))) {
        fetch(`/api/posts/${post.id}/compress`, { method: "POST" }).catch(
          () => {},
        );
      }
      startTransition(() => router.refresh());
    } finally {
      setAdding(false);
      setUploadPct(null);
    }
  }

  return (
    <article className="card p-5 sm:p-6">
      <header className="flex items-center justify-between gap-3 mb-4">
        <time
          className="text-sm text-ink-3"
          dateTime={created.toISOString()}
          title={created.toLocaleString()}
        >
          {formatDistanceToNowStrict(created, { addSuffix: true })}
        </time>
        <StatusPill status={post.status} />
      </header>

      <div className="space-y-2.5 mb-4">
        <input
          className="input !py-2 text-sm"
          value={author}
          onChange={(e) => setAuthor(e.target.value)}
          placeholder="Name"
          aria-label="Name"
          maxLength={80}
        />
        <input
          className="input input-headline !py-2"
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          placeholder="Headline"
          aria-label="Headline"
          maxLength={200}
        />
        <textarea
          className="textarea !min-h-[4.5rem] text-sm"
          value={body}
          onChange={(e) => setBody(e.target.value)}
          placeholder="Story"
          aria-label="Story"
          maxLength={20_000}
        />
      </div>

      <div className="space-y-2 mb-4">
        {post.media.map((m, i) => (
          <MediaItem
            key={m.id}
            m={m}
            onRemove={() => removeMedia(m.id)}
            onMoveUp={post.media.length > 1 ? () => moveMedia(i, -1) : undefined}
            onMoveDown={
              post.media.length > 1 ? () => moveMedia(i, 1) : undefined
            }
            isFirst={i === 0}
            isLast={i === post.media.length - 1}
            optimizing={
              m.type === "video" &&
              /\.blob\.vercel-storage\.com\//i.test(m.url) &&
              !isCompressedVideo(m.url)
            }
          />
        ))}
        {adding ? (
          <div className="upload-status" aria-live="polite">
            <div
              className={`upload-bar ${uploadPct == null ? "is-indeterminate" : ""}`}
            >
              {uploadPct != null && (
                <div
                  className="upload-bar-fill"
                  style={{ width: `${uploadPct}%` }}
                />
              )}
            </div>
            <span className="upload-label">
              {uploadPct != null ? `Uploading… ${uploadPct}%` : "Adding…"}
            </span>
          </div>
        ) : (
          <label className="btn-ghost text-sm inline-flex cursor-pointer items-center gap-2">
            + Add photo / video
            <input
              type="file"
              accept="image/*,video/*,audio/*"
              multiple
              className="hidden"
              onChange={(e) => {
                addMedia(e.target.files);
                e.target.value = "";
              }}
            />
          </label>
        )}
      </div>

      <div className="flex items-center justify-between gap-3 flex-wrap border-t border-line pt-4">
        <div className="flex items-center gap-2">
          <select
            className="input !w-24 !py-1.5 !px-2.5 text-sm"
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
            className="input !w-20 !py-1.5 !px-2.5 text-sm"
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
          <button
            type="button"
            className="btn-ghost text-sm"
            onClick={save}
            disabled={saving || !dirty}
          >
            {saving ? "Saving…" : "Save"}
          </button>
        </div>

        <div className="flex items-center gap-2">
          {post.status === "rejected" && (
            <button
              type="button"
              className="btn-danger text-sm"
              onClick={remove}
              disabled={busy != null}
            >
              {busy === "deleting" ? "Deleting…" : "Delete"}
            </button>
          )}
          {post.status !== "pending" && (
            <button
              type="button"
              className="btn-ghost"
              onClick={() => setStatus("pending")}
              disabled={busy != null}
            >
              {busy === "pending" ? "Moving…" : "Move to pending"}
            </button>
          )}
          {post.status === "pending" && (
            <button
              type="button"
              className="btn-ghost"
              onClick={() => setStatus("rejected")}
              disabled={busy != null}
            >
              {busy === "rejecting" ? "Rejecting…" : "Reject"}
            </button>
          )}
          {post.status === "approved" && (
            <button
              type="button"
              className="btn-ghost"
              onClick={() => setStatus("rejected")}
              disabled={busy != null}
            >
              {busy === "rejecting" ? "Rejecting…" : "Move to rejected"}
            </button>
          )}
          {post.status !== "approved" && (
            <button
              type="button"
              className="btn-primary"
              onClick={() => setStatus("approved")}
              disabled={busy != null}
            >
              {busy === "approving" ? "Approving…" : "Approve"}
            </button>
          )}
        </div>
      </div>
    </article>
  );
}

function StatusPill({ status }: { status: string }) {
  if (status === "approved") return <span className="status-pill success">Approved</span>;
  if (status === "rejected") return <span className="status-pill danger">Rejected</span>;
  return <span className="status-pill">Pending</span>;
}

function MediaItem({
  m,
  onRemove,
  onMoveUp,
  onMoveDown,
  isFirst,
  isLast,
  optimizing,
}: {
  m: AdminMedia;
  onRemove: () => void;
  onMoveUp?: () => void;
  onMoveDown?: () => void;
  isFirst?: boolean;
  isLast?: boolean;
  optimizing?: boolean;
}) {
  const canReorder = !!(onMoveUp || onMoveDown);
  return (
    <div
      className={`relative max-w-full ${m.type === "image" ? "inline-block" : "block"}`}
    >
      {m.type === "image" ? (
        /* eslint-disable-next-line @next/next/no-img-element */
        <img
          src={m.url}
          alt=""
          loading="lazy"
          className="rounded-md max-h-72 w-auto border border-line"
          style={{
            aspectRatio:
              m.width && m.height ? `${m.width} / ${m.height}` : undefined,
          }}
        />
      ) : m.type === "video" ? (
        <video
          src={m.url}
          controls
          loop
          preload="metadata"
          className="rounded-md w-full max-h-72 bg-black"
        />
      ) : (
        <AudioPlayer
          src={m.url}
          durationMs={m.durationMs ?? undefined}
          peaks={m.peaks ?? undefined}
        />
      )}
      {optimizing && <span className="media-optimizing">Optimizing video…</span>}
      {canReorder && (
        <div className="absolute left-1.5 top-1.5 flex flex-col gap-1">
          <button
            type="button"
            onClick={onMoveUp}
            disabled={isFirst}
            aria-label="Move earlier"
            title="Move earlier"
            className="grid h-7 w-7 place-items-center rounded-full bg-black/65 text-white backdrop-blur transition hover:bg-black/85 disabled:opacity-30 disabled:cursor-default"
          >
            <svg width="14" height="14" viewBox="0 0 14 14" fill="none" aria-hidden>
              <path d="M3.5 8.5L7 5l3.5 3.5" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
          </button>
          <button
            type="button"
            onClick={onMoveDown}
            disabled={isLast}
            aria-label="Move later"
            title="Move later"
            className="grid h-7 w-7 place-items-center rounded-full bg-black/65 text-white backdrop-blur transition hover:bg-black/85 disabled:opacity-30 disabled:cursor-default"
          >
            <svg width="14" height="14" viewBox="0 0 14 14" fill="none" aria-hidden>
              <path d="M3.5 5.5L7 9l3.5-3.5" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
          </button>
        </div>
      )}
      <button
        type="button"
        onClick={onRemove}
        aria-label="Remove media"
        title="Remove media"
        className="absolute right-1.5 top-1.5 grid h-7 w-7 place-items-center rounded-full bg-black/65 text-white backdrop-blur transition hover:bg-black/85"
      >
        <svg width="14" height="14" viewBox="0 0 14 14" fill="none" aria-hidden>
          <path
            d="M3.5 3.5l7 7M10.5 3.5l-7 7"
            stroke="currentColor"
            strokeWidth="1.8"
            strokeLinecap="round"
          />
        </svg>
      </button>
    </div>
  );
}
