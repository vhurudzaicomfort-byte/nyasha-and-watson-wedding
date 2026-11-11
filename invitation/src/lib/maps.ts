import type { Venue } from "@/invitations/types";

const q = (v: Venue) =>
  v.coordinates ? `${v.coordinates.lat},${v.coordinates.lng}` : v.mapsQuery;

/** Opens the venue pin in Google Maps (app or web) – the couple's exact share link when set. */
export function mapsSearchUrl(venue: Venue): string {
  return venue.mapsUrl || `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(q(venue))}`;
}

/** Starts turn-by-turn directions from the guest's current location. */
export function mapsDirectionsUrl(venue: Venue): string {
  return `https://www.google.com/maps/dir/?api=1&destination=${encodeURIComponent(q(venue))}&travelmode=driving`;
}

/** Key-less embeddable map (lightweight; fine for a venue preview). */
export function mapsEmbedUrl(venue: Venue): string {
  return `https://maps.google.com/maps?q=${encodeURIComponent(q(venue))}&z=15&output=embed`;
}
