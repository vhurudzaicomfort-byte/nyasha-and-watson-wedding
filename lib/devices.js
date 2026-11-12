// How many devices may use one personal invitation link.
//
// A website can't see WhatsApp forwards, so each link remembers the devices that
// open it instead: the first few are welcome, further ones are refused (a
// forwarded link stops working for whoever it was forwarded to). The limit is
// 2, or the invitation's party size when that's bigger (a family of 4 → 4).
//
// The browser keeps a random device code (localStorage "wn_device"); only a hash
// of it is stored, with a plain label ("iPhone · Safari") so the couple can tell
// devices apart. Admins signed in to the portal and badge scans at check-in
// never use up a slot. Requests without a device code (an old cached page) are
// let through rather than locking a guest out.
//
// Writes happen only when something changes (a new device, or a refused one at
// most every 10 minutes), so ordinary visits don't touch the database.
const crypto = require("crypto");

const MIN_DEVICES = 2;
const BLOCK_NOTE_EVERY_MS = 10 * 60 * 1000;

function limitFor(guest) { return Math.max(MIN_DEVICES, Number(guest.invitedCount) || 1); }
function validId(id) { return typeof id === "string" && /^[A-Za-z0-9_-]{16,64}$/.test(id); }
function hashId(id) { return crypto.createHash("sha256").update("wn-device:" + id).digest("base64url").slice(0, 22); }

function label(ua) {
  ua = String(ua || "");
  var device = /iPhone/.test(ua) ? "iPhone" : /iPad/.test(ua) ? "iPad" : /Android/.test(ua) ? (/Mobile/.test(ua) ? "Android phone" : "Android tablet")
    : /Windows/.test(ua) ? "Windows" : /Macintosh|Mac OS X/.test(ua) ? "Mac" : /Linux/.test(ua) ? "Linux" : "Device";
  var browser = /Edg\//.test(ua) ? "Edge" : /SamsungBrowser/.test(ua) ? "Samsung Internet" : /OPR\/|Opera/.test(ua) ? "Opera"
    : /Firefox|FxiOS/.test(ua) ? "Firefox" : /CriOS|Chrome/.test(ua) ? "Chrome" : /Safari/.test(ua) ? "Safari" : "";
  var inApp = /FBAN|FBAV|Instagram|WhatsApp/.test(ua) ? " (in-app)" : "";
  return device + (browser ? " · " + browser : "") + inApp;
}

// Decide whether this device may use the guest's invitation.
//   returns { ok, changed }: changed = the guest record was updated (save it)
function admit(guest, deviceId, ua) {
  if (!validId(deviceId)) return { ok: true, changed: false };
  var h = hashId(deviceId), now = new Date().toISOString();
  guest.devices = Array.isArray(guest.devices) ? guest.devices : [];
  if (guest.devices.some(function (d) { return d.id === h; })) return { ok: true, changed: false };
  if (guest.devices.length < limitFor(guest)) {
    guest.devices.push({ id: h, label: label(ua), firstSeen: now });
    return { ok: true, changed: true };
  }
  var last = guest.lastBlockedAt ? Date.parse(guest.lastBlockedAt) : 0;
  if (Date.now() - last < BLOCK_NOTE_EVERY_MS) return { ok: false, changed: false };
  guest.blockedOpens = (Number(guest.blockedOpens) || 0) + 1;
  guest.lastBlockedAt = now;
  return { ok: false, changed: true };
}

const BLOCKED_MESSAGE = "This personal invitation is already open on its allowed devices, so it can't be used here. If it's yours, please contact the couple and they'll sort it out.";

module.exports = { admit, limitFor, label, BLOCKED_MESSAGE, MIN_DEVICES };
