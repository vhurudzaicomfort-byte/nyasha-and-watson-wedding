#!/usr/bin/env node
/**
 * Copies the static export (out/) into the wedding site root:
 *   out/index.html → ../index.html        (the invitation at "/")
 *   out/_next/     → ../_next/            (scripts, styles, fonts; replaced each build)
 *   out/images/    → ../images/           (HD florals, rings, frame, dress code)
 *   out/favicon.svg, out/og-card.jpg → ../
 * Nothing else in the site (admin/, api/, assets/, lib/) is touched.
 */
import { cp, rm, readdir, stat } from "node:fs/promises";
import path from "node:path";

const out = path.resolve("out");
const site = path.resolve("..");
await rm(path.join(site, "_next"), { recursive: true, force: true });
await rm(path.join(site, "images"), { recursive: true, force: true });
for (const name of await readdir(out)) {
  if (["index.html", "_next", "images", "favicon.svg", "og-card.jpg"].includes(name)) {
    await cp(path.join(out, name), path.join(site, name), { recursive: true });
  }
}
const kb = (await stat(path.join(site, "index.html"))).size / 1024;
console.log(`published invitation to ${site} (index.html ${kb.toFixed(0)} KB)`);
