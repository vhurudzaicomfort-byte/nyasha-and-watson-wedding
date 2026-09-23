// Public, unauthenticated endpoint used by the guest-facing site (index.html).
// GET  ?token=<guestId>  -> minimal info to personalise the page and prefill
//                           the RSVP wizard. Never returns email or admin notes.
// GET  ?request=<id>     -> status of an RSVP that is waiting for approval.
// POST { token?, ... }   -> records the RSVP on the guest's record. Without a
//                           token we first try to match an existing invitation
//                           by phone, then by exact full name. Anyone we can't
//                           match isn't on the invite list: their RSVP is held
//                           as a pending request for the couple to approve.
const { readData, writeData, newId } = require("../lib/blob-store");
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

function publicView(guest) {
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
    var guest = data.guests.find(function (g) { return g.id === token; });
    if (!guest) { res.status(200).json({ found: false }); return; }
    res.status(200).json(publicView(guest));
    return;
  }

  if (req.method === "POST") {
    var body = req.body || {};
    var attend = body.attend === "attending" || body.attend === "maybe" || body.attend === "not_attending" ? body.attend : "";
    if (!attend) { res.status(400).json({ error: "Please choose whether you'll attend" }); return; }
    var message = String(body.message || "").trim().slice(0, 1000);
    var channel = CHANNELS.indexOf(body.channel) !== -1 ? body.channel : "web";
    var gender = Fields.normGender(body.gender);
    var phone = String(body.phone || "").trim();
    var requestedCount = Math.max(1, Math.min(10, Number(body.guests) || 1));

    var data2 = await readData();
    var guest2 = null, matchedBy = "";
    if (body.token) { guest2 = data2.guests.find(function (g) { return g.id === body.token; }); if (guest2) matchedBy = "link"; }
    if (!guest2 && phone) { guest2 = data2.guests.find(function (g) { return samePhone(g.phone, phone); }); if (guest2) matchedBy = "phone"; }
    if (!guest2 && body.name) {
      var n = normName(body.name);
      // Name alone is guessable, so it may only claim an invitation nobody has answered yet.
      var byName = data2.guests.filter(function (g) { return normName(fullName(g)) === n; });
      if (byName.length === 1 && (byName[0].rsvpStatus || "pending") === "pending") { guest2 = byName[0]; matchedBy = "name"; }
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
      if (gender) guest2.gender = gender;
      guest2.rsvpChannel = channel;
      guest2.rsvpAt = now;
      await writeData(data2);
      var view = publicView(guest2);
      if (matchedBy === "name") delete view.guestId;
      res.status(200).json(Object.assign({ ok: true, mode: "updated", matchedBy: matchedBy, capped: requestedCount > cap }, view));
      return;
    }

    // Not on the invite list: hold the RSVP for approval instead of adding a guest.
    var nameParts = splitName(body.name);
    if (!nameParts.firstName) { res.status(400).json({ error: "Name is required" }); return; }
    var fullN = normName(body.name);
    var reqRec = data2.requests.find(function (r) {
      if (r.status !== "pending") return false;
      if (body.requestId && r.id === body.requestId) return true;
      return (phone && samePhone(r.phone, phone)) || normName((r.firstName || "") + " " + (r.lastName || "")) === fullN;
    });
    if (!reqRec) {
      reqRec = { id: newId("req"), status: "pending", createdAt: now };
      data2.requests.push(reqRec);
    }
    Object.assign(reqRec, {
      firstName: nameParts.firstName,
      lastName: nameParts.lastName,
      phone: phone || reqRec.phone || "",
      gender: gender || reqRec.gender || "",
      attend: attend,
      guests: attend === "attending" ? requestedCount : 0,
      plusOneName: attend === "attending" && body.plusOneName ? String(body.plusOneName).trim() : "",
      message: message || reqRec.message || "",
      channel: channel,
      updatedAt: now,
    });
    await writeData(data2);
    res.status(202).json({ ok: true, mode: "pending", requestId: reqRec.id, status: "pending", firstName: reqRec.firstName, rsvpStatus: attend, attendingCount: reqRec.guests });
    return;
  }

  res.status(405).json({ error: "Method not allowed" });
};
