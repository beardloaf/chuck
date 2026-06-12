"use client";

import { READ_ONLY } from "@/lib/site";

export type FilterKey = "all" | "words" | "photo" | "video";
export type SortMode = "recent" | "story";
export type SortDir = "desc" | "asc";

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
  dir,
  onFilter,
  onMode,
  onToggleDir,
  onAdd,
}: {
  counts: Counts;
  filter: FilterKey;
  mode: SortMode;
  dir: SortDir;
  onFilter: (f: FilterKey) => void;
  onMode: (m: SortMode) => void;
  onToggleDir: () => void;
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
          data-active={mode === "story" ? "story" : "recent"}
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
          onClick={onToggleDir}
          aria-label={
            dir === "desc" ? "Newest first — switch to oldest first" : "Oldest first — switch to newest first"
          }
          title={dir === "desc" ? "Newest first" : "Oldest first"}
        >
          {dir === "desc" ? <SortDescIcon /> : <SortAscIcon />}
        </button>
        {!READ_ONLY && (
          <button
            type="button"
            className="add-btn cp-add"
            onClick={onAdd}
            aria-label="Add a memory"
          >
            <PlusIcon />
            <span>
              <span className="cp-add-pre">Add a </span>Memory
            </span>
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

/* Descending (newest first): down arrow + bars wide→narrow. */
function SortDescIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" aria-hidden>
      <path
        d="M3 16l4 4 4-4M7 20V4"
        stroke="currentColor"
        strokeWidth="1.9"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <path
        d="M11 5h10M11 10h7M11 15h4"
        stroke="currentColor"
        strokeWidth="1.9"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

/* Ascending (oldest first): up arrow + bars narrow→wide. */
function SortAscIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" aria-hidden>
      <path
        d="M3 8l4-4 4 4M7 4v16"
        stroke="currentColor"
        strokeWidth="1.9"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <path
        d="M11 9h4M11 14h7M11 19h10"
        stroke="currentColor"
        strokeWidth="1.9"
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
