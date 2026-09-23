// Public, unauthenticated endpoint used by the guest-facing site (index.html).
// GET  ?token=<guestId>  -> minimal info to personalise the page and prefill
//                           the RSVP wizard. Never returns email or admin notes.
// POST { token?, ... }   -> records the RSVP on the guest's record. Without a
//                           token we first try to match an existing invitation
//                           by phone, then by exact full name, so a guest who
//                           replies from the generic link doesn't create a duplicate.
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
    ageGroup: guest.ageGroup || "",
    rsvpAt: guest.rsvpAt || null,
    checkedIn: !!guest.checkedIn,
  };
}

module.exports = async function handler(req, res) {
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
    var ageGroup = Fields.normAgeGroup(body.ageGroup);
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
      if (ageGroup) guest2.ageGroup = ageGroup;
      guest2.rsvpChannel = channel;
      guest2.rsvpAt = now;
      await writeData(data2);
      var view = publicView(guest2);
      if (matchedBy === "name") delete view.guestId;
      res.status(200).json(Object.assign({ ok: true, mode: "updated", matchedBy: matchedBy, capped: requestedCount > cap }, view));
      return;
    }

    var nameParts = splitName(body.name);
    if (!nameParts.firstName) { res.status(400).json({ error: "Name is required" }); return; }
    var newGuest = {
      id: newId("guest"),
      firstName: nameParts.firstName,
      lastName: nameParts.lastName,
      phone: phone,
      email: "",
      invitationType: "individual",
      familyName: "",
      invitedFor: "",
      gender: gender,
      ageGroup: ageGroup,
      invitedCount: requestedCount,
      plusOneAllowed: false,
      rsvpStatus: attend,
      attendingCount: attend === "attending" ? requestedCount : 0,
      plusOneName: body.plusOneName ? String(body.plusOneName).trim() : "",
      rsvpMessage: message,
      rsvpChannel: channel,
      notes: ((message ? "RSVP message: " + message + " " : "") + "(self-registered via public RSVP form — not matched to an invitation)").trim(),
      checkedIn: false,
      checkInTime: null,
      checkInMethod: "",
      createdAt: now,
      rsvpAt: now,
    };
    data2.guests.push(newGuest);
    await writeData(data2);
    res.status(201).json(Object.assign({ ok: true, mode: "created", matchedBy: "" }, publicView(newGuest)));
    return;
  }

  res.status(405).json({ error: "Method not allowed" });
};
