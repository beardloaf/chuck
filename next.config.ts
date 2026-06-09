import type { NextConfig } from "next";

// The static GitHub Pages build sets STATIC_EXPORT=1 (see scripts/build-static.mjs).
// Everything below is only applied for that build, so the normal dev/server
// build keeps the full dynamic app (API routes, admin, request-time data).
const isExport = process.env.STATIC_EXPORT === "1";
const basePath = process.env.NEXT_PUBLIC_BASE_PATH || "";

const nextConfig: NextConfig = isExport
  ? {
      output: "export",
      // Emit /s/<id>/index.html etc. — the most reliable shape for static hosts.
      trailingSlash: true,
      // No image optimization server on GitHub Pages.
      images: { unoptimized: true },
      ...(basePath ? { basePath, assetPrefix: basePath } : {}),
    }
  : {};

export default nextConfig;
