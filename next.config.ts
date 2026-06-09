import type { NextConfig } from "next";

// The static GitHub Pages build sets STATIC_EXPORT=1 (see scripts/build-static.mjs).
// The export-only options are applied only for that build, so the normal
// dev/server (Vercel) build keeps the full dynamic app.
const isExport = process.env.STATIC_EXPORT === "1";
const basePath = process.env.NEXT_PUBLIC_BASE_PATH || "";

const nextConfig: NextConfig = {
  // @libsql/client ships a native binding; keep it external so the bundler
  // doesn't try to bundle the .node file (which breaks the build).
  serverExternalPackages: ["@libsql/client", "libsql"],
  ...(isExport
    ? {
        output: "export",
        // Emit /s/<id>/index.html etc. — the most reliable shape for static hosts.
        trailingSlash: true,
        // No image optimization server on GitHub Pages.
        images: { unoptimized: true },
        ...(basePath ? { basePath, assetPrefix: basePath } : {}),
      }
    : {}),
};

export default nextConfig;
