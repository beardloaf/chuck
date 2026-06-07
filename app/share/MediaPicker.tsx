"use client";

import { useRef, useState } from "react";
import type { Attachment } from "./types";
import { filesToAttachments } from "./mediaFiles";

interface Props {
  onAdd: (attachments: Attachment[]) => void;
}

/**
 * "Add media" picker — any image or video (HEIC/HEIF auto-converted to JPEG).
 * Click to pick or drop files onto the tile.
 */
export function MediaPicker({ onAdd }: Props) {
  const inputRef = useRef<HTMLInputElement | null>(null);
  const [dragOver, setDragOver] = useState(false);

  async function handleFiles(files: FileList | File[] | null) {
    const results = await filesToAttachments(files);
    if (results.length) onAdd(results);
  }

  return (
    <button
      type="button"
      className="action-tile"
      data-active={dragOver ? "true" : undefined}
      onClick={() => inputRef.current?.click()}
      onDragEnter={(e) => {
        e.preventDefault();
        setDragOver(true);
      }}
      onDragOver={(e) => {
        e.preventDefault();
      }}
      onDragLeave={() => setDragOver(false)}
      onDrop={(e) => {
        e.preventDefault();
        e.stopPropagation();
        setDragOver(false);
        handleFiles(e.dataTransfer.files);
      }}
    >
      <span className="tile-icon" aria-hidden>
        <PlusIcon />
      </span>
      <span className="flex flex-col gap-0.5">
        <span className="tile-label">Add media</span>
        <span className="tile-sub">photo or video</span>
      </span>
      <input
        ref={inputRef}
        type="file"
        accept="image/*,video/*,.heic,.heif,image/heic,image/heif"
        multiple
        className="hidden"
        onChange={(e) => {
          handleFiles(e.target.files);
          e.target.value = "";
        }}
      />
    </button>
  );
}

function PlusIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 18 18" fill="none">
      <path d="M9 3.5v11M3.5 9h11" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" />
    </svg>
  );
}
