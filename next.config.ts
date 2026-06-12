import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // @libsql/client ships a native binding; keep it external so the bundler
  // doesn't try to bundle the .node file (which breaks the build).
  // ffmpeg-static resolves its binary via its own __dirname, so it must stay
  // external (not bundled) — and the binary itself is shipped into the
  // transcode function via outputFileTracingIncludes below.
  // heic-convert + its deps are emscripten/asm.js — keep them external so the
  // bundler doesn't mangle the generated code; the tracer ships the JS into the
  // upload routes that import them (via lib/storage's saveUpload).
  serverExternalPackages: [
    "@libsql/client",
    "libsql",
    "ffmpeg-static",
    "heic-convert",
    "heic-decode",
    "libheif-js",
  ],
  outputFileTracingIncludes: {
    // ffmpeg-static's JS is traced via the require; only its binary (a data
    // file, name has no extension on Linux/macOS) needs to be shipped.
    "/api/posts/*/compress": ["./node_modules/ffmpeg-static/ffmpeg"],
    // Ensure the HEIC decoder (heic-convert + asm.js libheif) ships into the
    // upload routes that call saveUpload().
    "/api/posts": [
      "./node_modules/heic-convert/**",
      "./node_modules/heic-decode/**",
      "./node_modules/libheif-js/libheif/**",
    ],
    "/api/admin/posts/*/media": [
      "./node_modules/heic-convert/**",
      "./node_modules/heic-decode/**",
      "./node_modules/libheif-js/libheif/**",
    ],
  },
  outputFileTracingExcludes: {
    // The transcode route's fs/path usage makes the tracer over-include; keep
    // the committed media and other heavy, unused files out of the function.
    "/api/posts/*/compress": [
      "./public/**",
      "./node_modules/sharp/**",
      "./node_modules/better-sqlite3/**",
      "./node_modules/@img/**",
    ],
  },
};

export default nextConfig;
