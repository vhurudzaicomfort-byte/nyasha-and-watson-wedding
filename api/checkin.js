// Public, unauthenticated self check-in endpoint used by the guest-facing site.
// GET  ?token=<guestId>          -> minimal status so the page can render the right state.
// POST { token, mode, lat, lng } -> marks the guest checked in.
//   mode "manual": guest tapped "I've arrived" — no location needed.
//   mode "auto": page detected the guest is near the venue — lat/lng are
//     required and re-verified server-side (never trust the client alone).
const { readData, writeData } = require("../lib/blob-store");

// Approximate venue location (best available geocode for Colne Valley Nature
// Reserve Park / Bay Noakes Road, Chisipite, Harare — the venue itself isn't
// individually mapped, so this is road-level accuracy). A generous radius
// compensates for that uncertainty plus ordinary GPS drift.
const VENUE_LAT = -17.7809453;
const VENUE_LNG = 31.1223485;
const VENUE_RADIUS_METERS = 800;

function distanceMeters(lat1, lng1, lat2, lng2) {
  const R = 6371000;
  const toRad = (d) => (d * Math.PI) / 180;
  const dLat = toRad(lat2 - lat1);
  const dLng = toRad(lng2 - lng1);
  const a = Math.sin(dLat / 2) ** 2 + Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLng / 2) ** 2;
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
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
      rsvpStatus: guest.rsvpStatus || "pending",
    });
    return;
  }

  if (req.method === "POST") {
    const body = req.body || {};
    const token = body.token;
    if (!token) { res.status(400).json({ error: "token is required" }); return; }
    const data = await readData();
    const guest = data.guests.find((g) => g.id === token);
    if (!guest) { res.status(404).json({ error: "Guest not found" }); return; }

    if (guest.checkedIn) { res.status(200).json({ ok: true, alreadyCheckedIn: true }); return; }

    if (body.mode === "auto") {
      const lat = Number(body.lat), lng = Number(body.lng);
      if (!isFinite(lat) || !isFinite(lng)) { res.status(400).json({ error: "Location is required for automatic check-in" }); return; }
      const dist = distanceMeters(lat, lng, VENUE_LAT, VENUE_LNG);
      if (dist > VENUE_RADIUS_METERS) { res.status(200).json({ ok: false, reason: "too_far", distanceMeters: Math.round(dist) }); return; }
    }

    guest.checkedIn = true;
    guest.checkInTime = new Date().toISOString();
    await writeData(data);
    res.status(200).json({ ok: true, alreadyCheckedIn: false });
    return;
  }

  res.status(405).json({ error: "Method not allowed" });
};
