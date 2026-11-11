import path from "node:path";
import type { NextConfig } from "next";

/**
 * Static export: the invitation is served as plain files by the existing
 * wedding site (nyasha-watson.e-guests.com) next to the portal's /admin and
 * /api functions. `npm run build` writes ../ (index.html, _next/, images/)
 * via scripts/publish.mjs. Security headers live in the site's vercel.json.
 */
const nextConfig: NextConfig = {
  output: "export",
  poweredByHeader: false,
  reactStrictMode: true,
  images: { unoptimized: true },
  trailingSlash: false,
  // the wedding site (one level up) has its own package.json and middleware: build only this folder
  turbopack: { root: path.resolve(".") },
  outputFileTracingRoot: path.resolve("."),
};

export default nextConfig;
