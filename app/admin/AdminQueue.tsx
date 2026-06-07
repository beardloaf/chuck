"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { formatDistanceToNowStrict } from "date-fns";
import { AudioPlayer } from "@/app/feed/AudioPlayer";

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
  body: string | null;
  status: string;
  createdAt: number;
  media: AdminMedia[];
}

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
  const [busy, setBusy] = useState<"approving" | "rejecting" | null>(null);
  const [, startTransition] = useTransition();
  const created = new Date(post.createdAt);

  async function setStatus(status: "approved" | "rejected") {
    setBusy(status === "approved" ? "approving" : "rejecting");
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

  return (
    <article className="card p-5 sm:p-6">
      <header className="flex items-center justify-between gap-3 mb-4">
        <div className="flex items-center gap-2 text-sm text-ink-3">
          <span className="avatar-pill">
            <span className="avatar-dot">{(post.author?.[0] ?? "?").toUpperCase()}</span>
            <span>{post.author}</span>
          </span>
          <span aria-hidden>·</span>
          <time
            dateTime={created.toISOString()}
            title={created.toLocaleString()}
          >
            {formatDistanceToNowStrict(created, { addSuffix: true })}
          </time>
        </div>
        <StatusPill status={post.status} />
      </header>

      {post.body && (
        <p className="text-ink whitespace-pre-wrap leading-relaxed mb-4">
          {post.body}
        </p>
      )}

      {post.media.length > 0 && (
        <div className="space-y-2 mb-4">
          {post.media.map((m) => (
            <MediaItem key={m.id} m={m} />
          ))}
        </div>
      )}

      {post.status === "pending" ? (
        <div className="flex justify-end gap-2 pt-1">
          <button
            type="button"
            className="btn-danger"
            onClick={() => setStatus("rejected")}
            disabled={busy != null}
          >
            {busy === "rejecting" ? "Rejecting…" : "Reject"}
          </button>
          <button
            type="button"
            className="btn-primary"
            onClick={() => setStatus("approved")}
            disabled={busy != null}
          >
            {busy === "approving" ? "Approving…" : "Approve"}
          </button>
        </div>
      ) : (
        <div className="flex justify-end gap-2 pt-1">
          <button
            type="button"
            className="btn-ghost"
            onClick={() =>
              setStatus(post.status === "approved" ? "rejected" : "approved")
            }
            disabled={busy != null}
          >
            {post.status === "approved" ? "Move to rejected" : "Approve"}
          </button>
        </div>
      )}
    </article>
  );
}

function StatusPill({ status }: { status: string }) {
  if (status === "approved") return <span className="status-pill success">Approved</span>;
  if (status === "rejected") return <span className="status-pill danger">Rejected</span>;
  return <span className="status-pill">Pending</span>;
}

function MediaItem({ m }: { m: AdminMedia }) {
  if (m.type === "image") {
    return (
      /* eslint-disable-next-line @next/next/no-img-element */
      <img
        src={m.url}
        alt=""
        loading="lazy"
        className="rounded-md max-h-72 w-auto border border-line"
        style={{
          aspectRatio: m.width && m.height ? `${m.width} / ${m.height}` : undefined,
        }}
      />
    );
  }
  if (m.type === "video") {
    return (
      <video
        src={m.url}
        controls
        preload="metadata"
        className="rounded-md w-full max-h-72 bg-black"
      />
    );
  }
  return (
    <AudioPlayer
      src={m.url}
      durationMs={m.durationMs ?? undefined}
      peaks={m.peaks ?? undefined}
    />
  );
}
