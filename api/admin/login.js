// Sign in.
//   { password }                 -> the main shared password (ADMIN_PASSWORD), an owner
//   { email, password }          -> a portal user
//   { invite, password }         -> accept an invitation (or a reset link): set the password and sign in
//   GET ?invite=<token>          -> who the invitation is for (so the page can greet them)
//   { forgot: email }            -> password reset request: owners see it in Portal Users; when
//                                   RESEND_API_KEY and MAIL_FROM are set, the reset link is emailed.
//                                   The reply never says whether the email has access.
const crypto = require("crypto");
const A = require("../../lib/auth");
const { readData, writeData } = require("../../lib/blob-store");

const MAX_FAILS = 6, LOCK_MS = 15 * 60 * 1000;

function safeEqual(a, b) {
  var bufA = Buffer.from(String(a));
  var bufB = Buffer.from(String(b));
  if (bufA.length !== bufB.length) return false;
  return crypto.timingSafeEqual(bufA, bufB);
}
function validInvite(u, token) { return u.invite && u.invite.token && safeEqual(u.invite.token, token) && u.invite.exp > Date.now() && u.status !== "deactivated"; }

module.exports = async function handler(req, res) {
  if (req.method === "GET" && req.query.invite) {
    var d0 = await readData();
    var inv = (d0.users || []).find(function (u) { return validInvite(u, req.query.invite); });
    res.status(200).json(inv ? { ok: true, name: inv.name, email: inv.email, reset: !!inv.hash } : { ok: false });
    return;
  }
  if (req.method !== "POST") {
    res.status(405).json({ error: "Method not allowed" });
    return;
  }
  var body = req.body || {};
  var password = String(body.password || "");

  if (body.forgot) {
    var fe = String(body.forgot || "").trim().toLowerCase();
    var df = await readData(); df.users = df.users || [];
    var uf = df.users.find(function (u) { return (u.email || "").toLowerCase() === fe && u.status !== "deactivated"; });
    var recent = uf && uf.resetRequestedAt && Date.now() - Date.parse(uf.resetRequestedAt) < 10 * 60 * 1000;
    if (uf && !recent) {
      uf.resetRequestedAt = new Date().toISOString();
      var mailed = false;
      if (process.env.RESEND_API_KEY && process.env.MAIL_FROM) {
        uf.invite = { token: crypto.randomBytes(24).toString("base64url"), exp: Date.now() + 2 * 864e5 };
        var origin = (req.headers["x-forwarded-proto"] || "https") + "://" + (req.headers["x-forwarded-host"] || req.headers.host);
        var link = origin + "/admin/login.html?invite=" + encodeURIComponent(uf.invite.token);
        try {
          var r = await fetch("https://api.resend.com/emails", { method: "POST", headers: { Authorization: "Bearer " + process.env.RESEND_API_KEY, "Content-Type": "application/json" },
            body: JSON.stringify({ from: process.env.MAIL_FROM, to: [uf.email], subject: "Reset your Nyasha & Watson portal password", text: ["Hi " + (uf.name || "") + ",", "", "Use this link to set a new password for the Nyasha & Watson wedding portal. It works once and expires in 2 days:", link, "", "If you didn't ask for this, you can ignore this email."].join("\n") }) });
          mailed = r.ok;
        } catch (e) { mailed = false; }
        if (mailed) uf.resetRequestedAt = null;
      }
      await writeData(df);
    }
    res.status(200).json({ ok: true, message: "If that email has access to the portal, a reset link is on its way — or an owner will send you one shortly." });
    return;
  }

  // invitation / reset link
  if (body.invite) {
    var problem = A.passwordProblem(password);
    if (problem) { res.status(400).json({ error: problem }); return; }
    var d1 = await readData(); d1.users = d1.users || [];
    var u1 = d1.users.find(function (u) { return validInvite(u, body.invite); });
    if (!u1) { res.status(400).json({ error: "This link has expired or was already used — ask the owner for a new one" }); return; }
    u1.hash = A.hashPassword(password); u1.status = "active"; u1.invite = null; u1.tv = (u1.tv || 0) + 1;
    u1.fails = 0; u1.lockedUntil = 0; u1.lastLoginAt = new Date().toISOString();
    await writeData(d1);
    res.setHeader("Set-Cookie", A.makeSessionCookie(u1));
    res.status(200).json({ ok: true });
    return;
  }

  // portal user
  var email = String(body.email || "").trim().toLowerCase();
  if (email) {
    var d2 = await readData(); d2.users = d2.users || [];
    var u2 = d2.users.find(function (u) { return (u.email || "").toLowerCase() === email; });
    if (u2 && u2.lockedUntil && u2.lockedUntil > Date.now()) { res.status(429).json({ error: "Too many attempts — try again in 15 minutes" }); return; }
    if (!u2 || !u2.hash || !A.checkPassword(password, u2.hash)) {
      if (u2) { u2.fails = (u2.fails || 0) + 1; if (u2.fails >= MAX_FAILS) { u2.lockedUntil = Date.now() + LOCK_MS; u2.fails = 0; } await writeData(d2); }
      res.status(401).json({ error: "Incorrect email or password" });
      return;
    }
    if (u2.status !== "active") { res.status(403).json({ error: "This account has been deactivated — ask the owner" }); return; }
    u2.fails = 0; u2.lockedUntil = 0; u2.lastLoginAt = new Date().toISOString();
    await writeData(d2);
    res.setHeader("Set-Cookie", A.makeSessionCookie(u2));
    res.status(200).json({ ok: true });
    return;
  }

  // main shared password
  var expected = process.env.ADMIN_PASSWORD;
  if (!expected) {
    res.status(500).json({ error: "Admin password is not configured" });
    return;
  }
  if (!password || !safeEqual(password, expected)) {
    res.status(401).json({ error: "Incorrect password" });
    return;
  }
  res.setHeader("Set-Cookie", A.makeSessionCookie(null));
  res.status(200).json({ ok: true });
};
