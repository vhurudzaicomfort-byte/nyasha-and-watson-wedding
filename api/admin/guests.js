const { requireAuth, maskPhone } = require("../../lib/auth");
const { readData, writeData, newId } = require("../../lib/blob-store");
const Fields = require("../../assets/js/guest-fields.js");
const Match = require("../../assets/js/guest-match.js");
const Seat = require("../../lib/seating");

const CATEGORIES = Fields.CATEGORIES;

// RSVP approval requests (people who replied from the general link but aren't
// on the invite list) are handled here too, to stay within Vercel's function limit:
//   POST { action: "approve", requestId, mode: "new", invitedFor }
//   POST { action: "approve", requestId, mode: "link", guestId }
//   POST { action: "decline" | "reopen", requestId }
// People in a request: what they entered, or more when the name says so
// ("Mr and Mrs X", "X & Wife" = 2).
function requestParty(reqRec) {
  const implied = Match.impliedPartySize(((reqRec.firstName || "") + " " + (reqRec.lastName || "")).trim()) || 0;
  return Math.max(1, Number(reqRec.guests) || 1, implied);
}
function applyRequestToGuest(guest, reqRec, now) {
  const party = requestParty(reqRec);
  // approving a request for N people admits N, even if the invitation allowed fewer
  if (reqRec.attend === "attending" && party > (Number(guest.invitedCount) || 1) + (guest.plusOneAllowed ? 1 : 0)) {
    guest.invitedCount = party;
    if (party === 2 && (guest.invitationType || "individual") === "individual") guest.invitationType = "couple";
    if (party > 2) guest.invitationType = "family";
  }
  const cap = (Number(guest.invitedCount) || 1) + (guest.plusOneAllowed ? 1 : 0);
  guest.rsvpStatus = reqRec.attend;
  guest.attendingCount = reqRec.attend === "attending" ? Math.max(1, Math.min(party, cap)) : 0;
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
      const party = requestParty(reqRec);
      guest = {
        id: newId("guest"),
        firstName: reqRec.firstName || "",
        lastName: reqRec.lastName || "",
        phone: reqRec.phone || "",
        email: "",
        invitationType: party > 2 ? "family" : party === 2 ? "couple" : "individual",
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

// Bulk actions on ticked guests: remove / restore / markSent / seat / invitedFor / rsvp
async function handleBulk(body, req, res) {
  var ids = Array.isArray(body.ids) ? body.ids : [];
  if (!ids.length) { res.status(400).json({ error: "Tick at least one guest" }); return; }
  var data = await readData(), now = new Date().toISOString(), done = 0, notSeated = [];
  var picked = data.guests.filter(function (g) { return ids.indexOf(g.id) !== -1; });
  var table = body.op === "seat" && body.value ? data.tables.find(function (t) { return t.id === body.value; }) : null;
  if (body.op === "seat" && body.value && !table) { res.status(400).json({ error: "That table no longer exists" }); return; }
  picked.forEach(function (g) {
    if (body.op === "remove") { if (!g.removedAt) { g.removedAt = now; g.removedBy = req.wnUser.name; g.tableId = null; done++; } }
    else if (body.op === "restore") { if (g.removedAt) { g.removedAt = null; done++; } }
    else if (body.op === "markSent") { if (!g.inviteSentAt) { g.inviteSentAt = now; done++; } }
    else if (body.op === "invitedFor") { g.invitedFor = Fields.normCategory(body.value); done++; }
    else if (body.op === "rsvp" && ["pending", "attending", "maybe", "not_attending"].indexOf(body.value) !== -1) {
      if ((g.rsvpStatus || "pending") !== body.value) {
        g.rsvpStatus = body.value; g.rsvpAt = body.value === "pending" ? null : now; g.rsvpChannel = body.value === "pending" ? "" : "admin";
        g.attendingCount = body.value === "attending" ? (Number(g.attendingCount) || Number(g.invitedCount) || 1) : 0; done++;
      }
    } else if (body.op === "seat") {
      if (g.removedAt) return;
      if (!table) { if (g.tableId) { g.tableId = null; done++; } return; }
      if (g.tableId === table.id) return;
      if (Seat.occupied(data.guests, table.id, g.id) + Seat.seatsFor(g) > table.capacity) { notSeated.push(((g.firstName || "") + " " + (g.lastName || "")).trim()); return; }
      g.tableId = table.id; done++;
    }
  });
  await writeData(data);
  res.status(200).json({ ok: true, done: done, notSeated: notSeated });
}

// A contact made with a guest (WhatsApp, call…): kept as a history; counts as the invite being sent.
async function handleLogContact(body, req, res) {
  var data = await readData();
  var g = data.guests.find(function (x) { return x.id === body.guestId; });
  if (!g) { res.status(404).json({ error: "Guest not found" }); return; }
  var at = /^\d{4}-\d{2}-\d{2}/.test(String(body.at || "")) ? new Date(body.at).toISOString() : new Date().toISOString();
  g.contacts = (g.contacts || []).concat([{ at: at, channel: String(body.channel || "WhatsApp").slice(0, 30), note: String(body.note || "").trim().slice(0, 500), by: req.wnUser.name }]);
  if (!g.inviteSentAt && body.invitationSent !== false) g.inviteSentAt = at;
  await writeData(data);
  res.status(200).json({ guest: g });
}

module.exports = async function handler(req, res) {
  if (!(await requireAuth(req, res))) return;

  if (req.method === "GET") {
    var data = await readData();
    // one-off clean-ups: old per-church categories -> "Church"; age group is no longer collected
    var migrated = false;
    data.guests.forEach(function (g) {
      var norm = Fields.normCategory(g.invitedFor);
      if (norm !== (g.invitedFor || "")) { g.invitedFor = norm; migrated = true; }
      if ("ageGroup" in g) { delete g.ageGroup; migrated = true; }
      if (g.invitationType === "group") { g.invitationType = "family"; migrated = true; }
    });
    data.requests.forEach(function (r) { if ("ageGroup" in r) { delete r.ageGroup; migrated = true; } });
    if (migrated) await writeData(data);
    var requests = data.requests.slice().sort(function (a, b) { return (b.updatedAt || b.createdAt || "").localeCompare(a.updatedAt || a.createdAt || ""); });
    // viewers never receive full phone numbers
    var mask = req.wnUser.role === "viewer";
    var outGuests = mask ? data.guests.map(function (g) { return Object.assign({}, g, { phone: maskPhone(g.phone), email: g.email ? "(hidden)" : "" }); }) : data.guests;
    var outReq = mask ? requests.map(function (r) { return Object.assign({}, r, { phone: maskPhone(r.phone) }); }) : requests;
    res.status(200).json({ guests: outGuests, categories: CATEGORIES, requests: outReq, tables: Seat.tableSummaries(data), me: req.wnUser });
    return;
  }

  if (req.method === "POST") {
    var body = req.body || {};
    if (body.action === "bulk") { await handleBulk(body, req, res); return; }
    if (body.action === "logContact") { await handleLogContact(body, req, res); return; }
    if (body.action) { await handleRequestAction(body, res); return; }
    var data2 = await readData();
    var guest = {
      id: newId("guest"),
      firstName: String(body.firstName || "").trim(),
      lastName: String(body.lastName || "").trim(),
      phone: String(body.phone || "").trim(),
      email: String(body.email || "").trim(),
      invitationType: Fields.normInvitationType(body.invitationType),
      familyName: String(body.familyName || "").trim(),
      invitedFor: Fields.normCategory(body.invitedFor),
      gender: Fields.normGender(body.gender),
      invitedCount: Number(body.invitedCount) || 1,
      plusOneAllowed: !!body.plusOneAllowed,
      rsvpStatus: body.rsvpStatus || "pending",
      attendingCount: Number(body.attendingCount) || 0,
      notes: String(body.notes || "").trim(),
      tableId: null,
      reviewFlag: String(body.reviewFlag || "").trim(),
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
    if (body.tableId) {
      var t0 = data2.tables.find(function (t) { return t.id === body.tableId; });
      if (!t0) { res.status(400).json({ error: "That table no longer exists" }); return; }
      if (Seat.occupied(data2.guests, t0.id) + Seat.seatsFor(guest) > t0.capacity) { res.status(409).json({ error: t0.name + " doesn't have enough free seats" }); return; }
      guest.tableId = t0.id;
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
    if ("invitationType" in patch) patch.invitationType = Fields.normInvitationType(patch.invitationType);
    if (patch.checkedIn === true && !patch.checkInMethod) patch.checkInMethod = "usher";
    if (patch.checkedIn === false) patch.checkInMethod = "";
    var allowed = ["firstName", "lastName", "phone", "email", "invitationType", "familyName", "invitedFor", "gender",
      "invitedCount", "plusOneAllowed", "rsvpStatus", "attendingCount", "notes", "reviewFlag", "inviteSentAt", "removedAt",
      "checkedIn", "checkInTime", "checkInMethod", "rsvpAt", "rsvpChannel"];
    // table: checked against the seats left once this guest's (possibly new) party size is known
    if (Object.prototype.hasOwnProperty.call(patch, "tableId")) {
      var tid = patch.tableId || null;
      if (tid) {
        var tb = data3.tables.find(function (t) { return t.id === tid; });
        if (!tb) { res.status(400).json({ error: "That table no longer exists" }); return; }
        var after = Object.assign({}, data3.guests[idx], patch);
        var used = Seat.occupied(data3.guests, tid, id);
        if (used + Seat.seatsFor(after) > tb.capacity) { res.status(409).json({ error: tb.name + " has " + Math.max(0, tb.capacity - used) + " seat(s) left — this invitation needs " + Seat.seatsFor(after) }); return; }
      }
      data3.guests[idx].tableId = tid;
    }
    allowed.forEach(function (k) {
      if (Object.prototype.hasOwnProperty.call(patch, k)) data3.guests[idx][k] = patch[k];
    });
    if (patch.removedAt) { data3.guests[idx].tableId = null; data3.guests[idx].removedBy = req.wnUser.name; }
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
