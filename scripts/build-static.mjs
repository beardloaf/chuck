#!/usr/bin/env node
// Build a static, read-only export of the site into ./out for GitHub Pages.
//
//   NEXT_PUBLIC_BASE_PATH=/chuck node scripts/build-static.mjs
//
// GitHub Pages can't run a Node server, so the server-only routes (the upload
// API and the admin moderation UI) can't be part of the export — `next build`
// with `output: 'export'` errors on Route Handlers that read the request and
// on `cookies()`. We temporarily move those route directories aside, build,
// then move them back (even if the build fails).

import { execSync } from "node:child_process";
import fs from "node:fs";
import path from "node:path";

const ROOT = process.cwd();
const STASH = path.join(ROOT, ".static-stash");
const EXCLUDE = ["app/api", "app/admin"]; // server-only; not exportable

// `dynamic`/`dynamicParams`/`generateStaticParams` must be static literals that
// Next can parse, so we can't switch them on an env var in source. Instead we
// rewrite the two data pages from their dynamic (full-app) form to a static one
// for the export, then restore the originals afterwards.
const PATCHES = [
  {
    file: "app/page.tsx",
    from: 'export const dynamic = "force-dynamic";',
    to: 'export const dynamic = "force-static";',
  },
  {
    file: "app/s/[id]/page.tsx",
    from: 'export const dynamic = "force-dynamic";',
    to: `export const dynamic = "force-static";
export const dynamicParams = false;
export async function generateStaticParams() {
  return db
    .select({ id: schema.posts.id })
    .from(schema.posts)
    .where(eq(schema.posts.status, "approved"))
    .all()
    .map((p) => ({ id: p.id }));
}`,
  },
];

function move(from, to) {
  fs.mkdirSync(path.dirname(to), { recursive: true });
  fs.renameSync(from, to);
}

fs.rmSync(STASH, { recursive: true, force: true });
const moved = [];
for (const rel of EXCLUDE) {
  const abs = path.join(ROOT, rel);
  if (fs.existsSync(abs)) {
    move(abs, path.join(STASH, rel));
    moved.push(rel);
  }
}

// Apply the static-page patches, keeping the originals to restore later.
const originals = new Map();
for (const p of PATCHES) {
  const abs = path.join(ROOT, p.file);
  const src = fs.readFileSync(abs, "utf8");
  if (!src.includes(p.from)) {
    throw new Error(`build-static: marker not found in ${p.file}`);
  }
  originals.set(abs, src);
  fs.writeFileSync(abs, src.replace(p.from, p.to));
}

try {
  execSync("next build", {
    stdio: "inherit",
    env: {
      ...process.env,
      STATIC_EXPORT: "1",
      NEXT_PUBLIC_READ_ONLY: "1",
      NEXT_PUBLIC_BASE_PATH: process.env.NEXT_PUBLIC_BASE_PATH ?? "",
    },
  });
  // GitHub Pages' artifact deploy serves the folder as-is, but `.nojekyll`
  // guarantees the `_next/` directory is never stripped by Jekyll.
  fs.writeFileSync(path.join(ROOT, "out", ".nojekyll"), "");
} finally {
  for (const [abs, src] of originals) {
    fs.writeFileSync(abs, src);
  }
  for (const rel of moved) {
    move(path.join(STASH, rel), path.join(ROOT, rel));
  }
  fs.rmSync(STASH, { recursive: true, force: true });
}
