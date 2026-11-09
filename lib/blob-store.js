// Single-document JSON store on Vercel Blob. Good enough for a guest list of a
// few hundred people — not built for high write concurrency, which this app
// never sees in practice (a couple of admins, occasional door check-ins).
// For local testing only, WN_LOCAL_STORE=<file> keeps the same document in a
// plain JSON file instead (never set on Vercel).
const fs = require("fs");
const path = require("path");
const { put, get } = require("@vercel/blob");

const PATHNAME = "wn-wedding-store/data.json";
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

async function readData() {
  if (LOCAL) {
    try { return normalise(JSON.parse(fs.readFileSync(LOCAL, "utf8"))); } catch (e) { return emptyData(); }
  }
  try {
    const result = await get(PATHNAME, { access: "private", useCache: false });
    if (!result || !result.stream) return emptyData();
    const text = await streamToString(result.stream);
    return normalise(JSON.parse(text));
  } catch (e) {
    return emptyData();
  }
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

module.exports = { readData, writeData, newId };
