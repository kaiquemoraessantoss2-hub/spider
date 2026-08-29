import type { NextConfig } from "next";

// Tauri loads the frontend as static files from disk (no Node server in the
// shipped app), so the build must be a static export. `distDir` matches
// `frontendDist` in src-tauri/tauri.conf.json.
const nextConfig: NextConfig = {
  output: "export",
  distDir: "dist",
  images: {
    unoptimized: true,
  },
  // Tauri's dev server proxy needs predictable, unhashed asset paths.
  trailingSlash: true,
};

export default nextConfig;
