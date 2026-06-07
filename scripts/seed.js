#!/usr/bin/env node
/* eslint-disable */
// Seed the local SQLite DB with example posts. Run with:
//   node scripts/seed.js
// Idempotent: skips posts whose body already exists (cheap dedupe).

const Database = require("better-sqlite3");
const fs = require("node:fs");
const path = require("node:path");
const { randomUUID } = require("node:crypto");

const ROOT = path.join(__dirname, "..");
const DB_PATH = path.join(ROOT, "data", "mikula.db");
const UPLOAD_ROOT = path.join(ROOT, "public", "uploads");

const db = new Database(DB_PATH);

const now = Date.now();
function daysAgo(n) {
  return now - n * 24 * 60 * 60 * 1000;
}

/** Copy a source file into public/uploads/<yyyy>/<mm>/ and return its public URL. */
function copyMedia(srcPath, ext) {
  const d = new Date();
  const yyyy = String(d.getUTCFullYear());
  const mm = String(d.getUTCMonth() + 1).padStart(2, "0");
  const dir = path.join(UPLOAD_ROOT, yyyy, mm);
  fs.mkdirSync(dir, { recursive: true });
  const filename = `${randomUUID()}.${ext}`;
  fs.copyFileSync(srcPath, path.join(dir, filename));
  return `/uploads/${yyyy}/${mm}/${filename}`;
}

function imageMeta(srcPath) {
  // Cheap dimensions extractor for JPEG: we'll fall back to JSON sidecar if present.
  // For seed data, we already know dims.
  return null;
}

const T = "/tmp/mikula-test";

const SEEDS = [
  {
    author: "Maren",
    body: "Found this on the trail behind the house. Bigger than I remembered.",
    daysAgo: 1,
    media: [
      { src: `${T}/landscape_forest.jpg`, ext: "jpg", mime: "image/jpeg", w: 1280, h: 720 },
    ],
  },
  {
    author: "Theo",
    body: "She kept telling the same story all night. By the end, every one of us could finish it.",
    daysAgo: 3,
    media: [],
  },
  {
    author: "Iris",
    body: "Two minutes of the river right before sunrise.",
    daysAgo: 5,
    media: [
      { src: `${T}/portrait_blue.jpg`, ext: "jpg", mime: "image/jpeg", w: 900, h: 1500 },
    ],
  },
  {
    author: "Owen",
    body: "Three frames from a wedding I shot last weekend. Two felt warm, one felt cold.",
    daysAgo: 7,
    media: [
      { src: `${T}/landscape_dusk.jpg`, ext: "jpg", mime: "image/jpeg", w: 1920, h: 1080 },
      { src: `${T}/square_orange.jpg`, ext: "jpg", mime: "image/jpeg", w: 1200, h: 1200 },
      { src: `${T}/portrait_violet.jpg`, ext: "jpg", mime: "image/jpeg", w: 1080, h: 1920 },
    ],
  },
  {
    author: "Priya",
    body: "Voice note on the walk home — I think I figured out what to say at the meeting tomorrow.",
    daysAgo: 12,
    media: [
      {
        src: `${T}/clip.webm`,
        ext: "webm",
        mime: "audio/webm",
        durationMs: 28000,
        peaks: [40, 80, 180, 220, 160, 90, 40, 30, 60, 140, 210, 180, 120, 80, 60, 40, 30, 50, 90, 140, 180, 200, 160, 100, 60, 40, 30, 40, 80, 130, 170, 150, 90, 50, 30, 20, 40, 80, 120, 150, 200, 230, 180, 90, 40, 60, 100, 150, 200, 160, 100, 70, 50, 30, 20, 30, 50, 90, 130, 80],
      },
    ],
  },
  {
    author: "Cal",
    body: "Roof at golden hour. There's a kind of light that makes everything look like a memory before it's even gone.",
    daysAgo: 21,
    media: [
      { src: `${T}/landscape_sunset.jpg`, ext: "jpg", mime: "image/jpeg", w: 1600, h: 900 },
    ],
  },
];

const insertPost = db.prepare(`
  INSERT INTO posts (id, author, body, created_at, story_date, status, status_at)
  VALUES (?, ?, ?, ?, ?, 'approved', ?)
`);
const insertMedia = db.prepare(`
  INSERT INTO media_items
    (id, post_id, type, url, mime, duration_ms, width, height, waveform_peaks, position)
  VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
`);

let created = 0;
const tx = db.transaction(() => {
  for (const seed of SEEDS) {
    // dedupe by body if non-empty
    if (seed.body) {
      const dup = db
        .prepare("SELECT id FROM posts WHERE body = ? LIMIT 1")
        .get(seed.body);
      if (dup) {
        console.log(`skip (exists): "${seed.body.slice(0, 40)}…"`);
        continue;
      }
    }
    const postId = randomUUID();
    const createdAt = daysAgo(seed.daysAgo);
    const storyDate = seed.media.length > 0 ? daysAgo(seed.daysAgo) : null;
    insertPost.run(postId, seed.author, seed.body || null, createdAt, storyDate, createdAt);

    seed.media.forEach((m, i) => {
      if (!fs.existsSync(m.src)) {
        console.warn(`  missing source: ${m.src} — skipping`);
        return;
      }
      const url = copyMedia(m.src, m.ext);
      const type = m.mime.startsWith("image/") ? "image" : m.mime.startsWith("video/") ? "video" : "audio";
      insertMedia.run(
        randomUUID(),
        postId,
        type,
        url,
        m.mime,
        m.durationMs ?? null,
        m.w ?? null,
        m.h ?? null,
        m.peaks ? JSON.stringify(m.peaks) : null,
        i,
      );
    });
    created++;
    console.log(`+ ${seed.author}: ${seed.body ? seed.body.slice(0, 50) : "(no body)"}…`);
  }
});

tx();
console.log(`\nDone. Created ${created} new posts.`);
