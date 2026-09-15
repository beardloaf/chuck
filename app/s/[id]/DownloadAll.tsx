"use client";

import { useState } from "react";

export interface DownloadItem {
  url: string;
  /** Suggested filename for the saved file, e.g. "travels-1.jpg". */
  filename: string;
}

/**
 * Round icon button that downloads every media file in a memory — icon-only so
 * it fits beside the carousel's Auto switch and stepper on narrow screens; the
 * label lives in aria-label and the hover tooltip. The files are
 * same-origin static assets, so we fetch each as a blob and save it in turn.
 */
export function DownloadAll({ items }: { items: DownloadItem[] }) {
  const [busy, setBusy] = useState(false);

  async function downloadAll() {
    if (busy || items.length === 0) return;
    setBusy(true);
    try {
      for (const item of items) {
        try {
          const res = await fetch(item.url);
          if (!res.ok) continue;
          const blob = await res.blob();
          const objectUrl = URL.createObjectURL(blob);
          const a = document.createElement("a");
          a.href = objectUrl;
          a.download = item.filename;
          document.body.appendChild(a);
          a.click();
          a.remove();
          URL.revokeObjectURL(objectUrl);
        } catch {
          // Skip a file that fails to fetch; keep going with the rest.
        }
        // Small gap so the browser queues each save rather than dropping them.
        await new Promise((r) => setTimeout(r, 200));
      }
    } finally {
      setBusy(false);
    }
  }

  const label = busy
    ? "Downloading…"
    : items.length > 1
      ? `Download all (${items.length} files)`
      : "Download";

  return (
    <button
      type="button"
      className="story-download"
      onClick={downloadAll}
      disabled={busy}
      aria-label={label}
      title={label}
    >
      {busy ? <SpinnerIcon /> : <DownloadIcon />}
    </button>
  );
}

function DownloadIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 14 14" fill="none" aria-hidden>
      <path
        d="M7 1.5v7m0 0L4 5.5m3 3 3-3"
        stroke="currentColor"
        strokeWidth="1.6"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <path
        d="M2 9.5v1.5a1 1 0 0 0 1 1h8a1 1 0 0 0 1-1V9.5"
        stroke="currentColor"
        strokeWidth="1.6"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

function SpinnerIcon() {
  return (
    <svg
      width="16"
      height="16"
      viewBox="0 0 14 14"
      fill="none"
      aria-hidden
      className="story-download-spin"
    >
      <circle cx="7" cy="7" r="5.5" stroke="currentColor" strokeWidth="1.6" opacity="0.25" />
      <path
        d="M7 1.5a5.5 5.5 0 0 1 5.5 5.5"
        stroke="currentColor"
        strokeWidth="1.6"
        strokeLinecap="round"
      />
    </svg>
  );
}
