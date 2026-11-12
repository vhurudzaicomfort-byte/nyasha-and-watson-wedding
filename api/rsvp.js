// Public, unauthenticated endpoint used by the guest-facing site (index.html).
// GET  ?token=<guestId>  -> minimal info to personalise the page and prefill
//                           the RSVP wizard. Never returns email or admin notes.
// GET  ?request=<id>     -> status of an RSVP that is waiting for approval.
// POST { token?, ... }   -> records the RSVP on the guest's record. Without a
//                           token we match an existing invitation by phone, then
//                           email, then exact full name (a name alone may only
//                           claim an invitation nobody has answered yet). Only
//                           guests on the list can RSVP: anyone we can't match is
//                           refused (403, notListed) and nothing is stored.
//                           Also refused (403) once an RSVP deadline has passed.
//                           (Requests made before this rule can still be approved
//                           in the portal; GET ?request keeps reporting them.)
const { readData, writeData } = require("../lib/blob-store");
const Fields = require("../assets/js/guest-fields.js");

const CHANNELS = ["web", "whatsapp", "sms", "email", "call"];

function splitName(name) {
  var parts = String(name || "").trim().split(/\s+/);
  return { firstName: parts.shift() || "", lastName: parts.join(" ") };
}
function digits(s) { return String(s || "").replace(/[^\d]/g, ""); }
// Compare on the trailing 9 digits so "+263 77…" and "077…" match each other.
function samePhone(a, b) {
  var x = digits(a), y = digits(b);
  if (x.length < 7 || y.length < 7) return false;
  return x.slice(-9) === y.slice(-9);
}
function normName(s) { return String(s || "").trim().toLowerCase().replace(/\s+/g, " "); }
function fullName(g) { return ((g.firstName || "") + " " + (g.lastName || "")).trim(); }

// The guest's own table only — never anyone else's seating.
function tableName(data, guest) {
  var t = guest.tableId && (data.tables || []).find(function (x) { return x.id === guest.tableId; });
  return t ? t.name : "";
}
function publicView(guest, data) {
  return {
    found: true,
    guestId: guest.id,
    firstName: guest.firstName || "",
    lastName: guest.lastName || "",
    invitedCount: guest.invitedCount || 1,
    plusOneAllowed: !!guest.plusOneAllowed,
    rsvpStatus: guest.rsvpStatus || "pending",
    attendingCount: guest.attendingCount || 0,
    plusOneName: guest.plusOneName || "",
    gender: guest.gender || "",
    rsvpAt: guest.rsvpAt || null,
    checkedIn: !!guest.checkedIn,
    table: guest.rsvpStatus === "not_attending" || !data ? "" : tableName(data, guest),
  };
}

module.exports = async function handler(req, res) {
  if (req.method === "GET" && req.query.request) {
    var store = await readData();
    var rq = store.requests.find(function (r) { return r.id === req.query.request; });
    if (!rq) { res.status(200).json({ found: false }); return; }
    var out = { found: true, requestId: rq.id, status: rq.status, firstName: rq.firstName || "", attend: rq.attend, guests: rq.guests };
    if (rq.status === "approved" && rq.guestId) out.guestId = rq.guestId;
    res.status(200).json(out);
    return;
  }

  if (req.method === "GET") {
    var token = req.query.token;
    if (!token) { res.status(400).json({ error: "token is required" }); return; }
    var data = await readData();
    var guest = data.guests.find(function (g) { return g.id === token && !g.removedAt; });
    if (!guest) { res.status(200).json({ found: false }); return; }
    // delivery tracking: the first time a guest opens their personal link (badge scans don't count)
    if (!guest.openedAt && !req.query.badge) { guest.openedAt = new Date().toISOString(); try { await writeData(data); } catch (e) {} }
    res.status(200).json(publicView(guest, data));
    return;
  }

  if (req.method === "POST") {
    if (Fields.rsvpClosed()) {
      res.status(403).json({ ok: false, closed: true, error: "RSVPs closed on " + Fields.RSVP_DEADLINE_LABEL });
      return;
    }
    var body = req.body || {};
    var attend = body.attend === "attending" || body.attend === "maybe" || body.attend === "not_attending" ? body.attend : "";
    if (!attend) { res.status(400).json({ error: "Please choose whether you'll attend" }); return; }
    var message = String(body.message || "").trim().slice(0, 1000);
    var channel = CHANNELS.indexOf(body.channel) !== -1 ? body.channel : "web";
    var gender = Fields.normGender(body.gender);
    var phone = String(body.phone || "").trim();
    var email = /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(String(body.email || "").trim()) ? String(body.email).trim().slice(0, 120) : "";
    var requestedCount = Math.max(1, Math.min(10, Number(body.guests) || 1));

    var data2 = await readData();
    var guest2 = null, matchedBy = "", nameHint = "";
    if (body.token) { guest2 = data2.guests.find(function (g) { return g.id === body.token && !g.removedAt; }); if (guest2) matchedBy = "link"; }
    if (!guest2 && phone) { guest2 = data2.guests.find(function (g) { return !g.removedAt && samePhone(g.phone, phone); }); if (guest2) matchedBy = "phone"; }
    if (!guest2 && email) {
      var em = email.toLowerCase();
      guest2 = data2.guests.find(function (g) { return !g.removedAt && g.email && String(g.email).trim().toLowerCase() === em; });
      if (guest2) matchedBy = "email";
    }
    if (!guest2 && body.name) {
      var n = normName(body.name);
      // Name alone is guessable, so it may only claim an invitation nobody has answered yet.
      var byName = data2.guests.filter(function (g) { return !g.removedAt && normName(fullName(g)) === n; });
      if (byName.length === 1 && (byName[0].rsvpStatus || "pending") === "pending") { guest2 = byName[0]; matchedBy = "name"; }
      else if (byName.length > 1) nameHint = "shared";
      else if (byName.length === 1) nameHint = "answered";
    }

    var now = new Date().toISOString();
    if (guest2) {
      var cap = (Number(guest2.invitedCount) || 1) + (guest2.plusOneAllowed ? 1 : 0);
      guest2.rsvpStatus = attend;
      guest2.attendingCount = attend === "attending" ? Math.max(1, Math.min(requestedCount, cap)) : 0;
      guest2.plusOneName = attend === "attending" && body.plusOneName ? String(body.plusOneName).trim() : (guest2.plusOneName || "");
      if (message) {
        guest2.rsvpMessage = message;
        guest2.notes = (guest2.notes ? guest2.notes + " | " : "") + "RSVP message: " + message;
      }
      if (phone && (matchedBy === "link" || !guest2.phone)) guest2.phone = phone;
      if (email && !guest2.email) guest2.email = email;
      if (gender) guest2.gender = gender;
      guest2.rsvpChannel = channel;
      guest2.rsvpAt = now;
      await writeData(data2);
      var view = publicView(guest2, data2);
      if (matchedBy === "name") delete view.guestId;
      res.status(200).json(Object.assign({ ok: true, mode: "updated", matchedBy: matchedBy, capped: requestedCount > cap }, view));
      return;
    }

    // Not on the guest list (by personal link, full name, phone or email): only invited
    // guests can RSVP, so nothing is recorded.
    if (!splitName(body.name).firstName && !phone && !email) { res.status(400).json({ error: "Please enter your full name" }); return; }
    var why = nameHint === "shared"
      ? "More than one guest has this name. Please add the phone number or email address on your invitation, or open your personal invitation link."
      : nameHint === "answered"
        ? "This invitation already has a reply. To change it, open your personal invitation link, or add the phone number or email address on your invitation."
        : "Sorry, we couldn't find you on the guest list. Please use your full name as it appears on your invitation, or the phone number or email address the couple has for you.";
    res.status(403).json({ ok: false, notListed: true, error: why });
    return;
  }

  res.status(405).json({ error: "Method not allowed" });
};
