import type { CSSProperties } from "react";

/**
 * A square (1:1) region of an image, in fractions of its natural size.
 * `x`/`y` are the top-left corner; `w`/`h` are the side length expressed as a
 * fraction of the image's width and height respectively (so for a landscape
 * photo `h` > `w`, and both are 1 only when the image is already square).
 */
export interface TileCrop {
  x: number;
  y: number;
  w: number;
  h: number;
}

/** Zoomed all the way in, the crop is this fraction of the shortest edge. */
export const MIN_CROP_FRACTION = 0.25;

const isFrac = (n: unknown): n is number =>
  typeof n === "number" && Number.isFinite(n) && n >= 0 && n <= 1;

/** Read a crop off a media row, or null when the admin hasn't set one. */
export function toTileCrop(row: {
  cropX: number | null;
  cropY: number | null;
  cropW: number | null;
  cropH: number | null;
}): TileCrop | null {
  const { cropX: x, cropY: y, cropW: w, cropH: h } = row;
  if (!isFrac(x) || !isFrac(y) || !isFrac(w) || !isFrac(h)) return null;
  if (w <= 0 || h <= 0) return null;
  return { x, y, w, h };
}

/**
 * Build the square crop covering as much of a `naturalWidth`×`naturalHeight`
 * image as possible — what a tile shows by default (a centred `cover`).
 */
export function defaultCrop(width: number, height: number): TileCrop {
  const side = Math.min(width, height);
  const w = side / width;
  const h = side / height;
  return { x: (1 - w) / 2, y: (1 - h) / 2, w, h };
}

/**
 * Inline style that shows exactly `crop` inside a square, `overflow: hidden`
 * tile. The image is blown up to 1/w × 1/h of the tile and shifted so the
 * crop's top-left corner lands on the tile's — which keeps the image's own
 * aspect ratio, so nothing is squashed. Returns undefined without a crop, so
 * the plain `object-fit: cover` in the stylesheet stays in charge.
 */
export function tileCropStyle(
  crop: TileCrop | null | undefined,
): CSSProperties | undefined {
  if (!crop) return undefined;
  return {
    left: `${(-crop.x / crop.w) * 100}%`,
    top: `${(-crop.y / crop.h) * 100}%`,
    width: `${100 / crop.w}%`,
    height: `${100 / crop.h}%`,
  };
}
