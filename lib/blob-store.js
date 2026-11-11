// Single-document JSON store on Vercel Blob. Good enough for a guest list of a
// few hundred people — not built for high write concurrency, which this app
// never sees in practice (a couple of admins, occasional door check-ins).
// For local testing only, WN_LOCAL_STORE=<file> keeps the same document in a
// plain JSON file instead (never set on Vercel).
const fs = require("fs");
const path = require("path");
const { put, get } = require("@vercel/blob");

// Production data. Preview deployments share the Blob store, so they work on their
// own copy (seeded once, read-only, from production) and never write live guests.
const LIVE_PATHNAME = "wn-wedding-store/data.json";
const IS_PREVIEW = process.env.VERCEL_ENV === "preview";
const PATHNAME = IS_PREVIEW ? "wn-wedding-store/preview/data.json" : LIVE_PATHNAME;
const BACKUP_PREFIX = (IS_PREVIEW ? "wn-wedding-store/preview/" : "wn-wedding-store/") + "backups/";
const LOCAL = process.env.WN_LOCAL_STORE && !process.env.VERCEL ? process.env.WN_LOCAL_STORE : "";

function emptyData() {
  return { guests: [], gifts: [], providers: [], requests: [], tables: [] };
}

async function streamToString(stream) {
  const reader = stream.getReader();
  const decoder = new TextDecoder();
  let out = "";
  for (;;) {
    const { done, value } = await reader.read();
    if (done) break;
    out += decoder.decode(value, { stream: true });
  }
  return out;
}

function normalise(data) {
  ["guests", "gifts", "providers", "requests", "tables"].forEach(function (k) { if (!Array.isArray(data[k])) data[k] = []; });
  return data;
}

async function readPath(pathname) {
  const result = await get(pathname, { access: "private", useCache: false });
  if (!result || !result.stream) return null;
  return normalise(JSON.parse(await streamToString(result.stream)));
}

async function readData() {
  if (LOCAL) {
    try { return normalise(JSON.parse(fs.readFileSync(LOCAL, "utf8"))); } catch (e) { return emptyData(); }
  }
  try {
    const data = await readPath(PATHNAME);
    if (data) return data;
    if (IS_PREVIEW) { try { const live = await readPath(LIVE_PATHNAME); if (live) return live; } catch (e) { /* fall through */ } }
    return emptyData();
  } catch (e) {
    return emptyData();
  }
}

// A dated copy of the whole document (guests, RSVPs, tables, gifts, providers,
// users) inside the same private store. Returns the backup's pathname.
async function backupData(label) {
  const data = await readData();
  const stamp = new Date().toISOString().replace(/[:.]/g, "-");
  const pathname = BACKUP_PREFIX + stamp + (label ? "-" + String(label).replace(/[^a-z0-9-]+/gi, "-").slice(0, 40) : "") + ".json";
  if (LOCAL) { const p = path.join(path.dirname(LOCAL), pathname.replace(/\//g, "_")); fs.writeFileSync(p, JSON.stringify(data)); return { pathname: p, guests: data.guests.length }; }
  await put(pathname, JSON.stringify(data), { access: "private", contentType: "application/json", addRandomSuffix: false, allowOverwrite: false, cacheControlMaxAge: 0 });
  return { pathname, guests: data.guests.length };
}
async function listBackups() {
  if (LOCAL) return [];
  const { list } = require("@vercel/blob");
  const r = await list({ prefix: BACKUP_PREFIX, limit: 100 });
  return r.blobs.map((b) => ({ pathname: b.pathname, size: b.size, uploadedAt: b.uploadedAt })).sort((a, b) => String(b.uploadedAt).localeCompare(String(a.uploadedAt)));
}
// Restores a backup made by backupData (a fresh backup of the current state is taken first).
async function restoreBackup(pathname) {
  if (!String(pathname).startsWith(BACKUP_PREFIX)) throw new Error("Not a backup of this environment");
  const data = await readPath(pathname);
  if (!data) throw new Error("Backup not found");
  const before = await backupData("before-restore");
  await writeData(data);
  return { restored: pathname, guests: data.guests.length, safetyCopy: before.pathname };
}

async function writeData(data) {
  if (LOCAL) {
    fs.mkdirSync(path.dirname(LOCAL), { recursive: true });
    fs.writeFileSync(LOCAL, JSON.stringify(data, null, 1));
    return;
  }
  await put(PATHNAME, JSON.stringify(data), {
    access: "private",
    contentType: "application/json",
    allowOverwrite: true,
    addRandomSuffix: false,
    cacheControlMaxAge: 0,
  });
}

function newId(prefix) {
  return prefix + "_" + Date.now().toString(36) + Math.random().toString(36).slice(2, 8);
}

module.exports = { readData, writeData, newId, backupData, listBackups, restoreBackup, IS_PREVIEW };
