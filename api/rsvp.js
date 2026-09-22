// Public, unauthenticated endpoint used by the guest-facing site (index.html).
// GET  ?token=<guestId>  -> minimal, non-sensitive info to personalise the page.
// POST { token?, ... }   -> creates or updates a guest record with the RSVP.
// Deliberately exposes nothing beyond first/last name, invited count and
// plus-one eligibility on GET — never phone, email, dietary or notes.
const { readData, writeData, newId } = require("../lib/blob-store");

function splitName(name) {
  var parts = String(name || "").trim().split(/\s+/);
  return { firstName: parts.shift() || "", lastName: parts.join(" ") };
}

module.exports = async function handler(req, res) {
  if (req.method === "GET") {
    var token = req.query.token;
    if (!token) { res.status(400).json({ error: "token is required" }); return; }
    var data = await readData();
    var guest = data.guests.find(function (g) { return g.id === token; });
    if (!guest) { res.status(200).json({ found: false }); return; }
    res.status(200).json({
      found: true,
      firstName: guest.firstName || "",
      lastName: guest.lastName || "",
      invitedCount: guest.invitedCount || 1,
      plusOneAllowed: !!guest.plusOneAllowed,
      rsvpStatus: guest.rsvpStatus || "pending",
    });
    return;
  }

  if (req.method === "POST") {
    var body = req.body || {};
    var attend = body.attend === "attending" || body.attend === "maybe" || body.attend === "not_attending" ? body.attend : "pending";
    var message = String(body.message || "").trim();
    var dietary = String(body.dietary || "").trim();
    var data2 = await readData();
    var guest2 = body.token ? data2.guests.find(function (g) { return g.id === body.token; }) : null;

    var requestedCount = Math.max(1, Math.min(10, Number(body.guests) || 1));

    if (guest2) {
      var cap = (Number(guest2.invitedCount) || 1) + (guest2.plusOneAllowed ? 1 : 0);
      guest2.rsvpStatus = attend;
      guest2.attendingCount = attend === "attending" ? Math.max(1, Math.min(requestedCount, cap)) : 0;
      if (body.plusOneName) guest2.plusOneName = String(body.plusOneName).trim();
      if (dietary) guest2.dietary = dietary;
      if (message) guest2.notes = (guest2.notes ? guest2.notes + " | " : "") + "RSVP message: " + message;
      if (body.phone) guest2.phone = String(body.phone).trim();
      guest2.rsvpAt = new Date().toISOString();
      await writeData(data2);
      res.status(200).json({ ok: true, guestId: guest2.id, mode: "updated" });
      return;
    }

    // No token (or unknown token): self-registered guest, not linked to any pre-existing invitation.
    var nameParts = splitName(body.name);
    if (!nameParts.firstName) { res.status(400).json({ error: "Name is required" }); return; }
    var newGuest = {
      id: newId("guest"),
      firstName: nameParts.firstName,
      lastName: nameParts.lastName,
      phone: String(body.phone || "").trim(),
      email: "",
      invitationType: "individual",
      familyName: "",
      invitedCount: requestedCount,
      plusOneAllowed: false,
      rsvpStatus: attend,
      attendingCount: attend === "attending" ? requestedCount : 0,
      plusOneName: body.plusOneName ? String(body.plusOneName).trim() : "",
      dietary: dietary,
      notes: (message ? "RSVP message: " + message : "") + " (self-registered via public RSVP form)",
      tableId: null,
      checkedIn: false,
      checkInTime: null,
      createdAt: new Date().toISOString(),
      rsvpAt: new Date().toISOString(),
    };
    data2.guests.push(newGuest);
    await writeData(data2);
    res.status(201).json({ ok: true, guestId: newGuest.id, mode: "created" });
    return;
  }

  res.status(405).json({ error: "Method not allowed" });
};
