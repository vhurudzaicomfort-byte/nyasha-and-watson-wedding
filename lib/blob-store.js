// Single-document JSON store on Vercel Blob. Good enough for a guest list of a
// few hundred people — not built for high write concurrency, which this app
// never sees in practice (a couple of admins, occasional door check-ins).
const { put, get } = require("@vercel/blob");

const PATHNAME = "wn-wedding-store/data.json";

function emptyData() {
  return { guests: [], tables: [], gifts: [], providers: [] };
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

async function readData() {
  try {
    const result = await get(PATHNAME, { access: "private", useCache: false });
    if (!result || !result.stream) return emptyData();
    const text = await streamToString(result.stream);
    const data = JSON.parse(text);
    if (!Array.isArray(data.guests)) data.guests = [];
    if (!Array.isArray(data.tables)) data.tables = [];
    if (!Array.isArray(data.gifts)) data.gifts = [];
    if (!Array.isArray(data.providers)) data.providers = [];
    return data;
  } catch (e) {
    return emptyData();
  }
}

async function writeData(data) {
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
