// Public, unauthenticated self check-in endpoint used by the guest-facing site.
// GET  ?token=<guestId>                  -> minimal status so the page can render the right state.
// POST { token | phone, mode, lat, lng } -> marks the guest checked in.
//   mode "self": guest tapped "Self Check-in" — location is required and must
//     be within the venue radius (re-verified here, never trusted from the client).
//   mode "auto": the page detected the guest near the venue on the day — same check.
//   mode "self-unverified": the guest's device could not provide a location at
//     all; accepted, but recorded as unverified so ushers can see it in the portal.
// Ushers check guests in from the admin portal (recorded as "usher").
const { readData, writeData } = require("../lib/blob-store");

// Approximate venue location (best available geocode for Colne Valley Nature
// Reserve Park / Bay Noakes Road, Chisipite, Harare — the venue itself isn't
// individually mapped, so this is road-level accuracy). A generous radius
// compensates for that uncertainty plus ordinary GPS drift.
const VENUE_LAT = -17.7809453;
const VENUE_LNG = 31.1223485;
const VENUE_RADIUS_METERS = 800;
const MODES = ["self", "auto", "self-unverified"];

function distanceMeters(lat1, lng1, lat2, lng2) {
  const R = 6371000;
  const toRad = (d) => (d * Math.PI) / 180;
  const dLat = toRad(lat2 - lat1);
  const dLng = toRad(lng2 - lng1);
  const a = Math.sin(dLat / 2) ** 2 + Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLng / 2) ** 2;
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}
function digits(s) { return String(s || "").replace(/[^\d]/g, ""); }
function samePhone(a, b) {
  const x = digits(a), y = digits(b);
  if (x.length < 7 || y.length < 7) return false;
  return x.slice(-9) === y.slice(-9);
}

module.exports = async function handler(req, res) {
  if (req.method === "GET") {
    const token = req.query.token;
    if (!token) { res.status(400).json({ error: "token is required" }); return; }
    const data = await readData();
    const guest = data.guests.find((g) => g.id === token);
    if (!guest) { res.status(200).json({ found: false }); return; }
    res.status(200).json({
      found: true,
      firstName: guest.firstName || "",
      checkedIn: !!guest.checkedIn,
      checkInTime: guest.checkInTime || null,
      rsvpStatus: guest.rsvpStatus || "pending",
    });
    return;
  }

  if (req.method === "POST") {
    const body = req.body || {};
    const mode = MODES.indexOf(body.mode) !== -1 ? body.mode : "";
    if (!mode) { res.status(400).json({ error: "Unknown check-in mode" }); return; }
    if (!body.token && !body.phone) { res.status(400).json({ error: "token or phone is required" }); return; }

    const data = await readData();
    let guest = body.token ? data.guests.find((g) => g.id === body.token) : null;
    if (!guest && body.phone) guest = data.guests.find((g) => samePhone(g.phone, body.phone));
    if (!guest) { res.status(200).json({ ok: false, reason: "not_found" }); return; }

    if (mode !== "self-unverified") {
      const lat = Number(body.lat), lng = Number(body.lng);
      if (!isFinite(lat) || !isFinite(lng)) { res.status(400).json({ error: "Location is required to check in" }); return; }
      const dist = distanceMeters(lat, lng, VENUE_LAT, VENUE_LNG);
      if (dist > VENUE_RADIUS_METERS) { res.status(200).json({ ok: false, reason: "too_far", distanceMeters: Math.round(dist) }); return; }
    }

    const view = { firstName: guest.firstName || "" };
    // A phone number alone only unlocks the guest's personal link once they've proven they're at the venue.
    if (body.token || mode !== "self-unverified") view.guestId = guest.id;
    if (guest.checkedIn) { res.status(200).json(Object.assign({ ok: true, alreadyCheckedIn: true }, view)); return; }

    guest.checkedIn = true;
    guest.checkInTime = new Date().toISOString();
    guest.checkInMethod = mode;
    await writeData(data);
    res.status(200).json(Object.assign({ ok: true, alreadyCheckedIn: false }, view));
    return;
  }

  res.status(405).json({ error: "Method not allowed" });
};
