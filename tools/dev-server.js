// Local test server: the static site + every api/ function, run the way Vercel runs them,
// against a throwaway local data file (never the live Blob store).
//   node tools/dev-server.js            → http://localhost:3010 (admin signed in automatically)
// Local only: it refuses to start on Vercel and never reads the real store.
const http = require("http");
const fs = require("fs");
const path = require("path");
const crypto = require("crypto");

if (process.env.VERCEL) { console.error("dev-server is for local testing only"); process.exit(1); }
const ROOT = path.join(__dirname, "..");
process.env.WN_LOCAL_STORE = process.env.WN_LOCAL_STORE || path.join(ROOT, ".data-local", "data.json");
process.env.ADMIN_SESSION_SECRET = process.env.ADMIN_SESSION_SECRET || crypto.randomBytes(24).toString("hex");
process.env.ADMIN_PASSWORD = process.env.ADMIN_PASSWORD || crypto.randomBytes(12).toString("hex");
const { makeSessionCookie } = require("../lib/auth");
const PORT = Number(process.env.PORT) || 3010;
const TYPES = { ".html": "text/html; charset=utf-8", ".js": "text/javascript", ".css": "text/css", ".json": "application/json", ".png": "image/png", ".jpg": "image/jpeg", ".svg": "image/svg+xml", ".woff2": "font/woff2", ".woff": "font/woff", ".ttf": "font/ttf", ".ico": "image/x-icon", ".csv": "text/csv", ".gif": "image/gif", ".webp": "image/webp", ".pdf": "application/pdf" };
// the admin is signed in automatically so tests never need the real password
const AUTO = makeSessionCookie().split(";")[0];

function vercelRes(res) {
  res.status = function (c) { res.statusCode = c; return res; };
  res.json = function (o) { if (!res.getHeader("Content-Type")) res.setHeader("Content-Type", "application/json"); res.end(JSON.stringify(o)); return res; };
  res.send = function (b) { res.end(typeof b === "string" || Buffer.isBuffer(b) ? b : JSON.stringify(b)); return res; };
  return res;
}

http.createServer(async (req, res) => {
  const url = new URL(req.url, "http://localhost");
  try {
    if (url.pathname.startsWith("/api/")) {
      const file = path.join(ROOT, url.pathname.replace(/\/$/, "") + ".js");
      if (!file.startsWith(path.join(ROOT, "api")) || !fs.existsSync(file)) { res.statusCode = 404; res.end("not found"); return; }
      req.query = Object.fromEntries(url.searchParams);
      const chunks = []; for await (const c of req) chunks.push(c);
      const raw = Buffer.concat(chunks).toString("utf8");
      req.body = /json/.test(req.headers["content-type"] || "") && raw ? JSON.parse(raw) : raw || undefined;
      if (process.env.WN_DEV_AUTOLOGIN !== "0") req.headers.cookie = AUTO + (req.headers.cookie ? "; " + req.headers.cookie : "");
      await require(file)(req, vercelRes(res));
      return;
    }
    let p = path.join(ROOT, decodeURIComponent(url.pathname));
    if (!p.startsWith(ROOT)) { res.statusCode = 403; res.end(); return; }
    if (fs.existsSync(p) && fs.statSync(p).isDirectory()) p = path.join(p, "index.html");
    if (!fs.existsSync(p) && fs.existsSync(p + ".html")) p += ".html";
    if (!fs.existsSync(p)) { res.statusCode = 404; res.end("not found"); return; }
    res.setHeader("Content-Type", TYPES[path.extname(p).toLowerCase()] || "application/octet-stream");
    fs.createReadStream(p).pipe(res);
  } catch (e) {
    console.error(e);
    if (!res.headersSent) { res.statusCode = 500; res.end(JSON.stringify({ error: e.message })); }
  }
}).listen(PORT, () => console.log("Wedding site (local test data: " + process.env.WN_LOCAL_STORE + ") on http://localhost:" + PORT));
