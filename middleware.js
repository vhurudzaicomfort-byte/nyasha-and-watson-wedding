// Protects the /admin/* pages. Edge runtime, so this re-implements the same
// HMAC-SHA256 cookie check as lib/auth.js (Node's `crypto` isn't available
// here) using Web Crypto. Keep both in sync if the cookie format changes.

export const config = { matcher: ["/admin/:path*"] };

function base64UrlToBytes(b64url) {
  var b64 = b64url.replace(/-/g, "+").replace(/_/g, "/");
  while (b64.length % 4) b64 += "=";
  var bin = atob(b64);
  var bytes = new Uint8Array(bin.length);
  for (var i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i);
  return bytes;
}
function bytesToBase64Url(bytes) {
  var bin = "";
  for (var i = 0; i < bytes.length; i++) bin += String.fromCharCode(bytes[i]);
  return btoa(bin).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}
function timingSafeEqualStr(a, b) {
  if (a.length !== b.length) return false;
  var diff = 0;
  for (var i = 0; i < a.length; i++) diff |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return diff === 0;
}

async function sign(payload, secret) {
  var key = await crypto.subtle.importKey(
    "raw", new TextEncoder().encode(secret),
    { name: "HMAC", hash: "SHA-256" }, false, ["sign"]
  );
  var sig = await crypto.subtle.sign("HMAC", key, new TextEncoder().encode(payload));
  return bytesToBase64Url(new Uint8Array(sig));
}

function readCookie(req, name) {
  var header = req.headers.get("cookie") || "";
  var parts = header.split(";");
  for (var i = 0; i < parts.length; i++) {
    var eq = parts[i].indexOf("=");
    if (eq === -1) continue;
    var key = parts[i].slice(0, eq).trim();
    if (key === name) return decodeURIComponent(parts[i].slice(eq + 1).trim());
  }
  return null;
}

async function isAuthed(req, secret) {
  var value = readCookie(req, "wn_admin");
  if (!value) return false;
  var parts = value.split(".");
  if (parts.length !== 2) return false;
  var payload = parts[0], sig = parts[1];
  var expected = await sign(payload, secret);
  if (!timingSafeEqualStr(expected, sig)) return false;
  var exp = Number(payload);
  if (!exp || Date.now() > exp) return false;
  return true;
}

export default async function middleware(req) {
  var url = new URL(req.url);
  if (url.pathname === "/admin/login.html" || url.pathname === "/admin/login") {
    return; // login page itself must stay reachable
  }
  var secret = process.env.ADMIN_SESSION_SECRET;
  var authed = secret ? await isAuthed(req, secret) : false;
  if (!authed) {
    var loginUrl = new URL("/admin/login.html", req.url);
    return Response.redirect(loginUrl, 302);
  }
}
