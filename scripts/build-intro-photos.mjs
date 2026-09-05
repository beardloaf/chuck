/**
 * Compress the intro photos.
 *
 * Drop the originals (any order-able names — 1.png, a.jpg, …) into `intro-src/`
 * and run `npm run intro:photos`. Sources are sorted by filename and written to
 * public/intro/intro-1.webp … in that order, matching lib/intro-photos.ts.
 *
 * Square-cropped to match the panel's 1:1 frame, capped at 1000px, webp q72 —
 * these sit behind a click in a collapsed panel, so they should be small.
 *
 *   node scripts/build-intro-photos.mjs [srcDir]
 */
import { mkdir, readdir, rm, stat, writeFile } from "node:fs/promises";
import { existsSync } from "node:fs";
import path from "node:path";
import sharp from "sharp";

const SRC = process.argv[2] ?? "intro-src";
const OUT = path.join("public", "intro");
const MAX = 1000;
const QUALITY = 72;

const isImage = (f) => /\.(jpe?g|png|webp|avif|tiff?|heic)$/i.test(f);

if (!existsSync(SRC)) {
  console.error(`No source directory "${SRC}".`);
  console.error(`Create it, drop the photos in, then re-run.`);
  process.exit(1);
}

const files = (await readdir(SRC)).filter(isImage).sort((a, b) =>
  a.localeCompare(b, undefined, { numeric: true, sensitivity: "base" }),
);

if (!files.length) {
  console.error(`No images in "${SRC}" (looked for jpg/png/webp/avif/tiff/heic).`);
  process.exit(1);
}

await rm(OUT, { recursive: true, force: true });
await mkdir(OUT, { recursive: true });

let before = 0;
let after = 0;
const manifest = [];

for (const [n, file] of files.entries()) {
  const src = path.join(SRC, file);
  const name = `intro-${n + 1}.webp`;
  const dest = path.join(OUT, name);

  before += (await stat(src)).size;
  await sharp(src)
    .rotate() // honour EXIF orientation before cropping
    .resize(MAX, MAX, { fit: "cover", position: "attention", withoutEnlargement: true })
    .webp({ quality: QUALITY })
    .toFile(dest);
  const size = (await stat(dest)).size;
  after += size;

  manifest.push({ from: file, to: `/intro/${name}`, kb: Math.round(size / 1024) });
  console.log(`${file}  →  ${name}  ${(size / 1024).toFixed(0)} KB`);
}

await writeFile(path.join(OUT, "manifest.json"), JSON.stringify(manifest, null, 2) + "\n");

console.log(
  `\n${files.length} photo(s): ${(before / 1024 / 1024).toFixed(2)} MB → ` +
    `${(after / 1024).toFixed(0)} KB (${Math.round((1 - after / before) * 100)}% smaller)`,
);
console.log(`Check the order and the alt text in lib/intro-photos.ts.`);
