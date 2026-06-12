import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // @libsql/client ships a native binding; keep it external so the bundler
  // doesn't try to bundle the .node file (which breaks the build).
  // ffmpeg-static resolves its binary via its own __dirname, so it must stay
  // external (not bundled) — and the binary itself is shipped into the
  // transcode function via outputFileTracingIncludes below.
  serverExternalPackages: ["@libsql/client", "libsql", "ffmpeg-static"],
  outputFileTracingIncludes: {
    // ffmpeg-static's JS is traced via the require; only its binary (a data
    // file, name has no extension on Linux/macOS) needs to be shipped.
    "/api/posts/*/compress": ["./node_modules/ffmpeg-static/ffmpeg"],
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
