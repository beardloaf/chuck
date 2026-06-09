#!/usr/bin/env node
// Serve the static export in ./out the way GitHub Pages would: mounted under
// the project base path (default /chuck) with clean/trailing-slash URLs.
//
//   npm run build:static   # produces ./out
//   NEXT_PUBLIC_BASE_PATH=/chuck node scripts/preview-static.mjs
//
// Then open http://localhost:4530/chuck/.

import http from "node:http";
import fs from "node:fs";
import path from "node:path";

const ROOT = path.join(process.cwd(), "out");
const BASE = process.env.NEXT_PUBLIC_BASE_PATH || "/chuck";
const PORT = Number(process.env.PORT) || 4530;

const TYPES = {
  ".html": "text/html; charset=utf-8",
  ".js": "text/javascript",
  ".css": "text/css",
  ".json": "application/json",
  ".txt": "text/plain; charset=utf-8",
  ".svg": "image/svg+xml",
  ".png": "image/png",
  ".jpg": "image/jpeg",
  ".jpeg": "image/jpeg",
  ".webp": "image/webp",
  ".gif": "image/gif",
  ".ico": "image/x-icon",
  ".webm": "video/webm",
  ".mp4": "video/mp4",
  ".mov": "video/quicktime",
  ".mp3": "audio/mpeg",
  ".m4a": "audio/mp4",
  ".wav": "audio/wav",
  ".woff2": "font/woff2",
};

function resolveFile(rel) {
  const candidates = [];
  if (rel === "" || rel.endsWith("/")) candidates.push(path.join(rel, "index.html"));
  candidates.push(rel);
  if (!path.extname(rel)) {
    candidates.push(rel + ".html", path.join(rel, "index.html"));
  }
  for (const c of candidates) {
    const abs = path.join(ROOT, c);
    if (abs.startsWith(ROOT) && fs.existsSync(abs) && fs.statSync(abs).isFile()) {
      return abs;
    }
  }
  return null;
}

http
  .createServer((req, res) => {
    const url = new URL(req.url, "http://localhost");
    let pathname = decodeURIComponent(url.pathname);

    if (pathname === "/" || pathname === "") {
      res.writeHead(302, { Location: `${BASE}/` });
      return res.end();
    }
    if (BASE && pathname.startsWith(BASE)) {
      pathname = pathname.slice(BASE.length);
    }

    const file = resolveFile(pathname.replace(/^\//, ""));
    if (!file) {
      const notFound = path.join(ROOT, "404.html");
      res.writeHead(404, { "Content-Type": "text/html; charset=utf-8" });
      return res.end(fs.existsSync(notFound) ? fs.readFileSync(notFound) : "Not found");
    }
    res.writeHead(200, { "Content-Type": TYPES[path.extname(file)] || "application/octet-stream" });
    fs.createReadStream(file).pipe(res);
  })
  .listen(PORT, () => {
    console.log(`Static export serving at http://localhost:${PORT}${BASE}/`);
  });
