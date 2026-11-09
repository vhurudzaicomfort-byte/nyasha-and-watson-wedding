// Signed session cookie, verified with Node's crypto (api/ routes run on the
// Node.js runtime). middleware.js re-implements the same HMAC with Web Crypto
// because Edge Middleware can't use the `crypto` module.
//
// Cookie value: "<payload>.<signature>", payload "<expiry>~<userId>~<tokenVersion>".
// userId "main" is the shared ADMIN_PASSWORD login (always an owner). Older cookies
// carrying only "<expiry>" are read as the main login, so nobody is signed out.
// Portal users (owner / planner / viewer) live in the store; deactivating or removing
// one, or changing their password, ends their sessions at once (token version).
const crypto = require("crypto");

const COOKIE_NAME = "wn_admin";
const SESSION_MS = 1000 * 60 * 60 * 24 * 30; // 30 days
const ROLES = {
  owner: "Everything, including portal users",
  planner: "Guests, RSVPs, tables, check-in, gifts and providers — not portal users",
  viewer: "Read-only; phone numbers masked",
};

function secret() {
  const s = process.env.ADMIN_SESSION_SECRET;
  if (!s) throw new Error("ADMIN_SESSION_SECRET is not set");
  return s;
}

function sign(payload) {
  return crypto.createHmac("sha256", secret()).update(payload).digest("base64url");
}

function makeSessionCookie(user) {
  const exp = Date.now() + SESSION_MS;
  const payload = exp + "~" + (user && user.id ? user.id : "main") + "~" + (user && user.tv ? user.tv : 0);
  const value = payload + "." + sign(payload);
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

// { exp, uid, tv } for a valid, unexpired cookie, otherwise null
function readSession(req) {
  var value = parseCookies(req.headers.cookie)[COOKIE_NAME];
  if (!value) return null;
  var parts = value.split(".");
  if (parts.length !== 2) return null;
  var payload = parts[0], sig = parts[1];
  var expected = sign(payload);
  if (expected.length !== sig.length) return null;
  if (!crypto.timingSafeEqual(Buffer.from(expected), Buffer.from(sig))) return null;
  var bits = payload.split("~");
  var exp = Number(bits[0]);
  if (!exp || Date.now() > exp) return null;
  return { exp: exp, uid: bits[1] || "main", tv: Number(bits[2]) || 0 };
}

function isAuthed(req) { return !!readSession(req); }

// Resolves the signed-in person and their role (req.wnUser). Viewers may only read.
// opts.owner: owners only (portal users). Returns false after sending 401/403.
async function requireAuth(req, res, opts) {
  var s = readSession(req);
  if (!s) { res.status(401).json({ error: "Not authenticated" }); return false; }
  var who;
  if (s.uid === "main") {
    who = { id: "main", name: "Main login", email: "", role: "owner" };
  } else {
    var data = await require("./blob-store").readData();
    var u = (data.users || []).find(function (x) { return x.id === s.uid; });
    if (!u || u.status !== "active" || (u.tv || 0) !== s.tv) { res.status(401).json({ error: "Your access has changed — please sign in again" }); return false; }
    who = { id: u.id, name: u.name, email: u.email, role: ROLES[u.role] ? u.role : "viewer" };
  }
  req.wnUser = who;
  if (opts && opts.owner && who.role !== "owner") { res.status(403).json({ error: "Only an owner can manage portal users" }); return false; }
  if (who.role === "viewer" && req.method !== "GET") { res.status(403).json({ error: "You have view-only access" }); return false; }
  return true;
}

// scrypt password hashes: "scrypt$<salt>$<hash>"
function hashPassword(pw) {
  var salt = crypto.randomBytes(16).toString("base64url");
  return "scrypt$" + salt + "$" + crypto.scryptSync(String(pw), salt, 32).toString("base64url");
}
function checkPassword(pw, stored) {
  var p = String(stored || "").split("$");
  if (p.length !== 3 || p[0] !== "scrypt") return false;
  var a = crypto.scryptSync(String(pw), p[1], 32), b = Buffer.from(p[2], "base64url");
  return a.length === b.length && crypto.timingSafeEqual(a, b);
}
function passwordProblem(pw) {
  pw = String(pw || "");
  if (pw.length < 8) return "Use at least 8 characters";
  if (!/[0-9]/.test(pw) || !/[A-Za-z]/.test(pw)) return "Use letters and at least one number";
  return "";
}
// phone numbers for viewers: only the last 3 digits
function maskPhone(p) { var d = String(p || ""); return d ? d.replace(/\d(?=(?:\D*\d){3})/g, "•") : ""; }

module.exports = { COOKIE_NAME, ROLES, makeSessionCookie, clearSessionCookie, isAuthed, readSession, requireAuth, hashPassword, checkPassword, passwordProblem, maskPhone };
