"use client";

import { READ_ONLY } from "@/lib/site";

export type FilterKey = "all" | "words" | "photo" | "video";
export type SortMode = "recent" | "story" | "random";

export interface Counts {
  all: number;
  words: number;
  photo: number;
  video: number;
}

const ROWS: { key: FilterKey; label: string }[] = [
  { key: "all", label: "All" },
  { key: "words", label: "Words" },
  { key: "photo", label: "Photos" },
  { key: "video", label: "Videos" },
];

export function ControlPanel({
  counts,
  filter,
  mode,
  onFilter,
  onMode,
  onAdd,
}: {
  counts: Counts;
  filter: FilterKey;
  mode: SortMode;
  onFilter: (f: FilterKey) => void;
  onMode: (m: SortMode) => void;
  onAdd: () => void;
}) {
  return (
    <div className="control-panel">
      {ROWS.map((r) => (
        <button
          key={r.key}
          type="button"
          className="cp-row"
          data-on={filter === r.key}
          onClick={() => onFilter(r.key)}
        >
          <span className="cp-label">{r.label}</span>
          <span className="cp-count">
            {String(counts[r.key]).padStart(2, "0")}
          </span>
        </button>
      ))}

      <div className="cp-actions">
        <div
          className="cp-toggle"
          role="group"
          aria-label="Sort order"
          data-active={
            mode === "recent" ? "recent" : mode === "story" ? "story" : "none"
          }
        >
          <span className="cp-toggle-thumb" aria-hidden="true" />
          <button
            type="button"
            className="cp-toggle-opt"
            data-on={mode === "recent"}
            onClick={() => onMode("recent")}
            aria-label="Most recent"
            title="Most recent"
          >
            <RecentIcon />
          </button>
          <button
            type="button"
            className="cp-toggle-opt"
            data-on={mode === "story"}
            onClick={() => onMode("story")}
            aria-label="By date of story"
            title="By date of story"
          >
            <CalendarIcon />
          </button>
        </div>
        <button
          type="button"
          className="cp-icon"
          data-on={mode === "random"}
          onClick={() => onMode("random")}
          aria-label="Shuffle"
          title="Shuffle"
        >
          <ShuffleIcon />
        </button>
        {!READ_ONLY && (
          <button
            type="button"
            className="add-btn cp-add"
            onClick={onAdd}
            aria-label="Add a memory"
          >
            <PlusIcon />
            <span>Add a memory</span>
          </button>
        )}
      </div>
    </div>
  );
}

function RecentIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 18 18" fill="none" aria-hidden>
      <circle cx="9" cy="9" r="6.5" stroke="currentColor" strokeWidth="1.5" />
      <path
        d="M9 5v4l2.5 1.5"
        stroke="currentColor"
        strokeWidth="1.5"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

function CalendarIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 18 18" fill="none" aria-hidden>
      <rect x="2.5" y="3.5" width="13" height="12" rx="2" stroke="currentColor" strokeWidth="1.5" />
      <path d="M2.5 7h13M6 2.5v2M12 2.5v2" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
    </svg>
  );
}

function ShuffleIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 18 18" fill="none" aria-hidden>
      <path
        d="M2.5 4.5h2.2c1 0 1.6.5 2.3 1.4l3.5 6.2c.6 1 1.3 1.4 2.3 1.4h2.2M2.5 13.5h2.2c1 0 1.6-.5 2.3-1.4M11 5.9c.6-.9 1.3-1.4 2.3-1.4h2.2"
        stroke="currentColor"
        strokeWidth="1.5"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <path
        d="M13.5 2.5L15.5 4.5L13.5 6.5M13.5 11.5L15.5 13.5L13.5 15.5"
        stroke="currentColor"
        strokeWidth="1.5"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

function PlusIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 18 18" fill="none" aria-hidden>
      <path d="M9 3.5v11M3.5 9h11" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
    </svg>
  );
}
