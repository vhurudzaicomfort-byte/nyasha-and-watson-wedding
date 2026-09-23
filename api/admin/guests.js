const { requireAuth } = require("../../lib/auth");
const { readData, writeData, newId } = require("../../lib/blob-store");

const CATEGORIES = ["Bride's Side", "Groom's Side", "ZAOGA Church", "Roman Catholic Church", "Mutual Friends", "Service Providers"];

module.exports = async function handler(req, res) {
  if (!requireAuth(req, res)) return;

  if (req.method === "GET") {
    var data = await readData();
    res.status(200).json({ guests: data.guests, categories: CATEGORIES });
    return;
  }

  if (req.method === "POST") {
    var data2 = await readData();
    var body = req.body || {};
    var guest = {
      id: newId("guest"),
      firstName: String(body.firstName || "").trim(),
      lastName: String(body.lastName || "").trim(),
      phone: String(body.phone || "").trim(),
      email: String(body.email || "").trim(),
      invitationType: body.invitationType || "individual",
      familyName: String(body.familyName || "").trim(),
      invitedFor: String(body.invitedFor || "").trim(),
      invitedCount: Number(body.invitedCount) || 1,
      plusOneAllowed: !!body.plusOneAllowed,
      rsvpStatus: body.rsvpStatus || "pending",
      attendingCount: Number(body.attendingCount) || 0,
      notes: String(body.notes || "").trim(),
      checkedIn: false,
      checkInTime: null,
      createdAt: new Date().toISOString(),
      rsvpAt: null,
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
    var patch = req.body || {};
    var allowed = ["firstName", "lastName", "phone", "email", "invitationType", "familyName", "invitedFor",
      "invitedCount", "plusOneAllowed", "rsvpStatus", "attendingCount", "notes",
      "checkedIn", "checkInTime", "rsvpAt"];
    allowed.forEach(function (k) {
      if (Object.prototype.hasOwnProperty.call(patch, k)) data3.guests[idx][k] = patch[k];
    });
    await writeData(data3);
    res.status(200).json({ guest: data3.guests[idx] });
    return;
  }

  if (req.method === "DELETE") {
    var id2 = req.query.id;
    if (!id2) { res.status(400).json({ error: "id is required" }); return; }
    var data4 = await readData();
    data4.guests = data4.guests.filter(function (g) { return g.id !== id2; });
    await writeData(data4);
    res.status(200).json({ ok: true });
    return;
  }

  res.status(405).json({ error: "Method not allowed" });
};
