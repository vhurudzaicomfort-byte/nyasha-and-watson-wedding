const crypto = require("crypto");
const { makeSessionCookie } = require("../../lib/auth");

function safeEqual(a, b) {
  var bufA = Buffer.from(String(a));
  var bufB = Buffer.from(String(b));
  if (bufA.length !== bufB.length) return false;
  return crypto.timingSafeEqual(bufA, bufB);
}

module.exports = async function handler(req, res) {
  if (req.method !== "POST") {
    res.status(405).json({ error: "Method not allowed" });
    return;
  }
  var expected = process.env.ADMIN_PASSWORD;
  if (!expected) {
    res.status(500).json({ error: "Admin password is not configured" });
    return;
  }
  var password = (req.body && req.body.password) || "";
  if (!password || !safeEqual(password, expected)) {
    res.status(401).json({ error: "Incorrect password" });
    return;
  }
  res.setHeader("Set-Cookie", makeSessionCookie());
  res.status(200).json({ ok: true });
};
