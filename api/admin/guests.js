const { requireAuth } = require("../../lib/auth");
const { readData, writeData, newId } = require("../../lib/blob-store");
const Fields = require("../../assets/js/guest-fields.js");

const CATEGORIES = Fields.CATEGORIES;

// RSVP approval requests (people who replied from the general link but aren't
// on the invite list) are handled here too, to stay within Vercel's function limit:
//   POST { action: "approve", requestId, mode: "new", invitedFor }
//   POST { action: "approve", requestId, mode: "link", guestId }
//   POST { action: "decline" | "reopen", requestId }
function applyRequestToGuest(guest, reqRec, now) {
  const cap = (Number(guest.invitedCount) || 1) + (guest.plusOneAllowed ? 1 : 0);
  guest.rsvpStatus = reqRec.attend;
  guest.attendingCount = reqRec.attend === "attending" ? Math.max(1, Math.min(Number(reqRec.guests) || 1, cap)) : 0;
  if (reqRec.plusOneName) guest.plusOneName = reqRec.plusOneName;
  if (reqRec.message) {
    guest.rsvpMessage = reqRec.message;
    guest.notes = (guest.notes ? guest.notes + " | " : "") + "RSVP message: " + reqRec.message;
  }
  if (reqRec.phone && !guest.phone) guest.phone = reqRec.phone;
  if (reqRec.gender) guest.gender = reqRec.gender;
  guest.rsvpChannel = reqRec.channel || "web";
  guest.rsvpAt = reqRec.updatedAt || reqRec.createdAt || now;
}

async function handleRequestAction(body, res) {
  const data = await readData();
  const reqRec = data.requests.find((r) => r.id === body.requestId);
  if (!reqRec) { res.status(404).json({ error: "Request not found" }); return; }
  const now = new Date().toISOString();

  if (body.action === "decline") {
    if (reqRec.status === "approved") { res.status(400).json({ error: "Already approved — remove the guest from the invite list instead" }); return; }
    reqRec.status = "declined";
    reqRec.decidedAt = now;
  } else if (body.action === "reopen") {
    if (reqRec.status !== "declined") { res.status(400).json({ error: "Only declined requests can be reopened" }); return; }
    reqRec.status = "pending";
    reqRec.decidedAt = null;
  } else if (body.action === "approve") {
    if (reqRec.status === "approved") { res.status(400).json({ error: "Already approved" }); return; }
    let guest;
    if (body.mode === "link") {
      guest = data.guests.find((g) => g.id === body.guestId);
      if (!guest) { res.status(404).json({ error: "Choose the invite to link this RSVP to" }); return; }
      applyRequestToGuest(guest, reqRec, now);
      guest.notes = (guest.notes ? guest.notes + " | " : "") + "RSVP request linked " + now.slice(0, 10);
    } else {
      const party = Math.max(1, Number(reqRec.guests) || 1);
      guest = {
        id: newId("guest"),
        firstName: reqRec.firstName || "",
        lastName: reqRec.lastName || "",
        phone: reqRec.phone || "",
        email: "",
        invitationType: party > 1 ? "group" : "individual",
        familyName: "",
        invitedFor: Fields.normCategory(body.invitedFor),
        gender: reqRec.gender || "",
        invitedCount: party,
        plusOneAllowed: false,
        rsvpStatus: "pending",
        attendingCount: 0,
        plusOneName: "",
        notes: "Approved from RSVP request " + now.slice(0, 10),
        checkedIn: false,
        checkInTime: null,
        checkInMethod: "",
        createdAt: now,
        rsvpAt: null,
      };
      applyRequestToGuest(guest, reqRec, now);
      data.guests.push(guest);
    }
    reqRec.status = "approved";
    reqRec.decidedAt = now;
    reqRec.guestId = guest.id;
    reqRec.approvedAs = body.mode === "link" ? "linked" : "new";
  } else {
    res.status(400).json({ error: "Unknown action" });
    return;
  }
  await writeData(data);
  res.status(200).json({ ok: true, request: reqRec });
}

module.exports = async function handler(req, res) {
  if (!requireAuth(req, res)) return;

  if (req.method === "GET") {
    var data = await readData();
    // one-off clean-ups: old per-church categories -> "Church"; age group is no longer collected
    var migrated = false;
    data.guests.forEach(function (g) {
      var norm = Fields.normCategory(g.invitedFor);
      if (norm !== (g.invitedFor || "")) { g.invitedFor = norm; migrated = true; }
      if ("ageGroup" in g) { delete g.ageGroup; migrated = true; }
    });
    data.requests.forEach(function (r) { if ("ageGroup" in r) { delete r.ageGroup; migrated = true; } });
    if (migrated) await writeData(data);
    var requests = data.requests.slice().sort(function (a, b) { return (b.updatedAt || b.createdAt || "").localeCompare(a.updatedAt || a.createdAt || ""); });
    res.status(200).json({ guests: data.guests, categories: CATEGORIES, requests: requests });
    return;
  }

  if (req.method === "POST") {
    var body = req.body || {};
    if (body.action) { await handleRequestAction(body, res); return; }
    var data2 = await readData();
    var guest = {
      id: newId("guest"),
      firstName: String(body.firstName || "").trim(),
      lastName: String(body.lastName || "").trim(),
      phone: String(body.phone || "").trim(),
      email: String(body.email || "").trim(),
      invitationType: body.invitationType || "individual",
      familyName: String(body.familyName || "").trim(),
      invitedFor: Fields.normCategory(body.invitedFor),
      gender: Fields.normGender(body.gender),
      invitedCount: Number(body.invitedCount) || 1,
      plusOneAllowed: !!body.plusOneAllowed,
      rsvpStatus: body.rsvpStatus || "pending",
      attendingCount: Number(body.attendingCount) || 0,
      notes: String(body.notes || "").trim(),
      checkedIn: false,
      checkInTime: null,
      createdAt: new Date().toISOString(),
      rsvpAt: body.rsvpStatus && body.rsvpStatus !== "pending" ? new Date().toISOString() : null,
      rsvpChannel: body.rsvpStatus && body.rsvpStatus !== "pending" ? "admin" : "",
      checkInMethod: "",
    };
    if (!guest.firstName) {
      res.status(400).json({ error: "First name is required" });
      return;
    }
    data2.guests.push(guest);
    await writeData(data2);
    res.status(201).json({ guest: guest });
    return;
  }

  if (req.method === "PATCH") {
    var id = req.query.id;
    if (!id) { res.status(400).json({ error: "id is required" }); return; }
    var data3 = await readData();
    var idx = data3.guests.findIndex(function (g) { return g.id === id; });
    if (idx === -1) { res.status(404).json({ error: "Guest not found" }); return; }
    var patch = Object.assign({}, req.body || {});
    if ("gender" in patch) patch.gender = Fields.normGender(patch.gender);
    if ("invitedFor" in patch) patch.invitedFor = Fields.normCategory(patch.invitedFor);
    if (patch.checkedIn === true && !patch.checkInMethod) patch.checkInMethod = "usher";
    if (patch.checkedIn === false) patch.checkInMethod = "";
    var allowed = ["firstName", "lastName", "phone", "email", "invitationType", "familyName", "invitedFor", "gender",
      "invitedCount", "plusOneAllowed", "rsvpStatus", "attendingCount", "notes",
      "checkedIn", "checkInTime", "checkInMethod", "rsvpAt", "rsvpChannel"];
    allowed.forEach(function (k) {
      if (Object.prototype.hasOwnProperty.call(patch, k)) data3.guests[idx][k] = patch[k];
    });
    await writeData(data3);
    res.status(200).json({ guest: data3.guests[idx] });
    return;
  }

  if (req.method === "DELETE") {
    var id2 = req.query.id;
    var reqId = req.query.requestId;
    if (!id2 && !reqId) { res.status(400).json({ error: "id is required" }); return; }
    var data4 = await readData();
    if (reqId) data4.requests = data4.requests.filter(function (r) { return r.id !== reqId; });
    else data4.guests = data4.guests.filter(function (g) { return g.id !== id2; });
    await writeData(data4);
    res.status(200).json({ ok: true });
    return;
  }

  res.status(405).json({ error: "Method not allowed" });
};
