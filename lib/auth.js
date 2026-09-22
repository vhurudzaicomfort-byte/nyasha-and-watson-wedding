// Signed session cookie, verified with Node's crypto (api/ routes run on the
// Node.js runtime). middleware.js re-implements the same HMAC with Web Crypto
// because Edge Middleware can't use the `crypto` module.
const crypto = require("crypto");

const COOKIE_NAME = "wn_admin";
const SESSION_MS = 1000 * 60 * 60 * 24 * 30; // 30 days

function secret() {
  const s = process.env.ADMIN_SESSION_SECRET;
  if (!s) throw new Error("ADMIN_SESSION_SECRET is not set");
  return s;
}

function sign(payload) {
  return crypto.createHmac("sha256", secret()).update(payload).digest("base64url");
}

function makeSessionCookie() {
  const exp = Date.now() + SESSION_MS;
  const payload = String(exp);
  const sig = sign(payload);
  const value = payload + "." + sig;
  const maxAge = Math.floor(SESSION_MS / 1000);
  return `${COOKIE_NAME}=${value}; Path=/; HttpOnly; Secure; SameSite=Lax; Max-Age=${maxAge}`;
}

function clearSessionCookie() {
  return `${COOKIE_NAME}=; Path=/; HttpOnly; Secure; SameSite=Lax; Max-Age=0`;
}

function parseCookies(header) {
  var out = {};
  (header || "").split(";").forEach(function (part) {
    var i = part.indexOf("=");
    if (i === -1) return;
    out[part.slice(0, i).trim()] = decodeURIComponent(part.slice(i + 1).trim());
  });
  return out;
}

function isAuthed(req) {
  var cookies = parseCookies(req.headers.cookie);
  var value = cookies[COOKIE_NAME];
  if (!value) return false;
  var parts = value.split(".");
  if (parts.length !== 2) return false;
  var payload = parts[0], sig = parts[1];
  var expected = sign(payload);
  if (expected.length !== sig.length) return false;
  if (!crypto.timingSafeEqual(Buffer.from(expected), Buffer.from(sig))) return false;
  var exp = Number(payload);
  if (!exp || Date.now() > exp) return false;
  return true;
}

function requireAuth(req, res) {
  if (!isAuthed(req)) {
    res.status(401).json({ error: "Not authenticated" });
    return false;
  }
  return true;
}

module.exports = { COOKIE_NAME, makeSessionCookie, clearSessionCookie, isAuthed, requireAuth };
