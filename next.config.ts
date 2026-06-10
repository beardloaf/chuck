import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // @libsql/client ships a native binding; keep it external so the bundler
  // doesn't try to bundle the .node file (which breaks the build).
  serverExternalPackages: ["@libsql/client", "libsql"],
};

export default nextConfig;
