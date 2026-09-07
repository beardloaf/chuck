"use client";

import { useCallback, useRef, useState } from "react";
import { MIN_CROP_FRACTION, defaultCrop, tileCropStyle, type TileCrop } from "@/lib/crop";

/** Deepest zoom the slider allows (crop side = 1/MAX_ZOOM of the short edge). */
const MAX_ZOOM = 1 / MIN_CROP_FRACTION;

/** The crop rect in the image's own pixels — what the editor manipulates. */
interface Rect {
  /** Top-left corner. */
  ox: number;
  oy: number;
  /** Side length (square, so the same number in both axes). */
  side: number;
}

const clamp = (n: number, lo: number, hi: number) =>
  Math.min(hi, Math.max(lo, n));

function toRect(crop: TileCrop, w: number, h: number): Rect {
  return { ox: crop.x * w, oy: crop.y * h, side: crop.w * w };
}

function toCrop(r: Rect, w: number, h: number): TileCrop {
  return { x: r.ox / w, y: r.oy / h, w: r.side / w, h: r.side / h };
}

/**
 * Square crop editor for the image a feed tile shows. Drag the photo to pan,
 * use the slider to zoom; the preview box is the tile, one-to-one.
 *
 * The natural size comes from the loaded <img> rather than the stored
 * width/height columns, which are nullable on older rows.
 */
export function TileCropper({
  src,
  crop,
  onSave,
  onClear,
  onCancel,
  saving,
}: {
  src: string;
  /** The saved crop, or null when the tile is still centring the image. */
  crop: TileCrop | null;
  onSave: (crop: TileCrop) => void;
  onClear: () => void;
  onCancel: () => void;
  saving?: boolean;
}) {
  const boxRef = useRef<HTMLDivElement | null>(null);
  // Natural image size; null until the image loads.
  const [nat, setNat] = useState<{ w: number; h: number } | null>(null);
  const [rect, setRect] = useState<Rect | null>(null);
  const ready = useRef(false);

  /** Seed the editor from the image's natural size, once. */
  const init = useCallback(
    (img: HTMLImageElement | null) => {
      if (!img || ready.current) return;
      const { naturalWidth: w, naturalHeight: h } = img;
      if (!w || !h) return; // not decoded yet — the load handler will call back
      ready.current = true;
      setNat({ w, h });
      setRect(toRect(crop ?? defaultCrop(w, h), w, h));
    },
    [crop],
  );

  const maxSide = nat ? Math.min(nat.w, nat.h) : 0;
  const minSide = maxSide * MIN_CROP_FRACTION;

  /** Re-clamp after a zoom so the crop stays inside the image. */
  const place = useCallback(
    (ox: number, oy: number, side: number): Rect => {
      if (!nat) return { ox, oy, side };
      return {
        side,
        ox: clamp(ox, 0, nat.w - side),
        oy: clamp(oy, 0, nat.h - side),
      };
    },
    [nat],
  );

  function onPointerDown(e: React.PointerEvent<HTMLDivElement>) {
    const box = boxRef.current;
    if (!box || !rect || !nat) return;
    e.preventDefault();
    // Preview pixels → image pixels. The box shows exactly `side` across.
    const scale = rect.side / box.clientWidth;
    const start = { x: e.clientX, y: e.clientY, ...rect };
    // Listening on the window (rather than capturing the pointer) keeps the
    // drag alive when it wanders outside the small preview box.
    const move = (ev: PointerEvent) => {
      setRect(
        place(
          start.ox - (ev.clientX - start.x) * scale,
          start.oy - (ev.clientY - start.y) * scale,
          start.side,
        ),
      );
    };
    const up = () => {
      window.removeEventListener("pointermove", move);
      window.removeEventListener("pointerup", up);
    };
    window.addEventListener("pointermove", move);
    window.addEventListener("pointerup", up);
  }

  /** Zoom about the crop's centre so the subject stays put. */
  function onZoom(zoom: number) {
    if (!rect || !nat) return;
    const side = clamp(maxSide / zoom, minSide, maxSide);
    const cx = rect.ox + rect.side / 2;
    const cy = rect.oy + rect.side / 2;
    setRect(place(cx - side / 2, cy - side / 2, side));
  }

  const preview = rect && nat ? toCrop(rect, nat.w, nat.h) : null;
  const zoom = rect ? maxSide / rect.side : 1;

  return (
    <div className="crop-editor">
      <div
        ref={boxRef}
        className="crop-box"
        onPointerDown={onPointerDown}
        role="application"
        aria-label="Drag to reposition the tile crop"
      >
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src={src}
          alt=""
          draggable={false}
          // A cached image can finish before React attaches onLoad, so seed
          // from the mounted node too; `init` runs only once either way.
          ref={init}
          onLoad={(e) => init(e.currentTarget)}
          className="crop-img"
          style={tileCropStyle(preview)}
        />
      </div>

      <div className="crop-controls">
        <label className="crop-zoom">
          <span className="text-xs text-ink-3">Zoom</span>
          <input
            type="range"
            min={1}
            max={MAX_ZOOM}
            step={0.01}
            value={zoom}
            disabled={!rect}
            onChange={(e) => onZoom(Number(e.target.value))}
            aria-label="Zoom"
          />
        </label>
        <p className="text-xs text-ink-3">
          Drag the photo to choose what the square tile shows.
        </p>
        <div className="flex items-center gap-2 flex-wrap">
          <button
            type="button"
            className="btn-primary text-sm"
            disabled={!preview || saving}
            onClick={() => preview && onSave(preview)}
          >
            {saving ? "Saving…" : "Save crop"}
          </button>
          <button
            type="button"
            className="btn-ghost text-sm"
            onClick={onCancel}
            disabled={saving}
          >
            Cancel
          </button>
          {crop && (
            <button
              type="button"
              className="btn-ghost text-sm"
              onClick={onClear}
              disabled={saving}
            >
              Reset to centre
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
