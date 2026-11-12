/**
 * Host adapter for the Nyasha & Watson wedding site (nyasha-watson.e-guests.com).
 *
 * The invitation runs as a static page on the existing site and talks to the
 * wedding portal's own APIs, so there is one guest database:
 *   GET  /api/rsvp?token=<guestId>   personal invitation (?g=<guestId> links)
 *   POST /api/rsvp                    RSVP → the guest's record, or an approval request
 *   GET  /api/rsvp?request=<id>       status of an RSVP awaiting the couple's approval
 *   POST /api/checkin                 self / automatic check-in at the venue
 * Field names and statuses below are the portal's; never rename them here alone.
 */
import type { GuestContext } from "@/invitations/types";
import { rsvpSchema, issuesToFieldErrors } from "@/lib/rsvp/validation";
import type { RsvpTransport } from "./env";

const TOKEN_KEY = "wn_guest_token"; // same keys as the previous site, so returning guests are recognised
const REQUEST_KEY = "wn_rsvp_request";
const DEVICE_KEY = "wn_device";

const store = {
  get: (k: string) => { try { return window.localStorage.getItem(k) || ""; } catch { return ""; } },
  set: (k: string, v: string) => { try { if (v) window.localStorage.setItem(k, v); else window.localStorage.removeItem(k); } catch { /* private mode */ } },
};

/**
 * A random code for this browser, so a personal link works only on its allowed
 * number of devices (the portal's lib/devices.js). Nothing personal is in it.
 */
let memoDevice = "";
export function deviceId(): string {
  if (memoDevice) return memoDevice;
  let id = store.get(DEVICE_KEY);
  if (!/^[A-Za-z0-9_-]{16,64}$/.test(id)) {
    const bytes = new Uint8Array(18);
    (window.crypto || (window as unknown as { msCrypto: Crypto }).msCrypto).getRandomValues(bytes);
    id = btoa(String.fromCharCode(...bytes)).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
    store.set(DEVICE_KEY, id);
  }
  memoDevice = id;
  return id;
}

/** Set when this device was refused for the personal link it opened. */
let refused = "";
export function deviceRefusal(): string { return refused; }

interface PortalGuest {
  found: boolean;
  guestId?: string;
  firstName?: string;
  lastName?: string;
  invitedCount?: number;
  plusOneAllowed?: boolean;
  rsvpStatus?: "pending" | "attending" | "maybe" | "not_attending";
  attendingCount?: number;
  rsvpAt?: string | null;
  checkedIn?: boolean;
  table?: string;
}

function toGuest(g: PortalGuest): GuestContext | null {
  if (!g.found || !g.guestId) return null;
  const displayName = `${g.firstName || ""} ${g.lastName || ""}`.trim() || "Guest";
  const allowance = Math.max(1, (Number(g.invitedCount) || 1) + (g.plusOneAllowed ? 1 : 0));
  const st = g.rsvpStatus || "pending";
  return {
    code: g.guestId,
    displayName,
    allowance,
    rsvp: st === "attending" || st === "not_attending"
      ? { attendance: st === "attending" ? "attending" : "declined", partySize: st === "attending" ? Number(g.attendingCount) || 1 : 0, at: g.rsvpAt || null }
      : null,
    table: g.table || undefined,
    checkedIn: !!g.checkedIn,
  };
}

/** The guest's personal token: ?g= (portal links), ?code= (design links) or remembered on this device. */
export function currentToken(): { token: string; fromUrl: boolean; badge: boolean } {
  const q = new URLSearchParams(window.location.search);
  const fromUrl = q.get("g") || q.get("code") || "";
  return { token: fromUrl || store.get(TOKEN_KEY), fromUrl: !!fromUrl, badge: !!q.get("badge") };
}

/** Remember the guest on this device and show their personal link in the address bar. */
export function adoptToken(id: string) {
  store.set(TOKEN_KEY, id);
  try {
    const u = new URL(window.location.href);
    u.searchParams.delete("code");
    u.searchParams.set("g", id);
    window.history.replaceState(null, "", u.pathname + u.search + u.hash);
  } catch { /* ignore */ }
}

export async function loadGuest(): Promise<GuestContext | null> {
  const { token, fromUrl, badge } = currentToken();
  if (!token) return null;
  try {
    const res = await fetch(`/api/rsvp?token=${encodeURIComponent(token)}${badge ? "&badge=1" : ""}&device=${encodeURIComponent(deviceId())}`, { cache: "no-store" });
    const g = (await res.json()) as PortalGuest & { blocked?: boolean; error?: string };
    if (g.blocked) {
      refused = g.error || "This personal invitation can't be opened on this device.";
      store.set(TOKEN_KEY, "");
      return null;
    }
    const guest = toGuest(g);
    if (guest) store.set(TOKEN_KEY, guest.code);
    else if (!fromUrl) store.set(TOKEN_KEY, ""); // a removed invitation is forgotten on this device
    return guest;
  } catch {
    return null;
  }
}

/** An RSVP from someone not (yet) on the list, waiting for the couple. */
export async function pendingRequest(): Promise<{ status: string; guestId?: string; firstName?: string } | null> {
  const id = store.get(REQUEST_KEY);
  if (!id) return null;
  try {
    const r = (await (await fetch(`/api/rsvp?request=${encodeURIComponent(id)}`, { cache: "no-store" })).json()) as { found: boolean; status: string; guestId?: string; firstName?: string };
    if (!r.found) { store.set(REQUEST_KEY, ""); return null; }
    if (r.status === "approved" && r.guestId) { store.set(REQUEST_KEY, ""); adoptToken(r.guestId); }
    return r;
  } catch {
    return null;
  }
}

/** RSVP transport onto the portal's /api/rsvp (same validation as the design, then the portal's rules). */
export const portalTransport: RsvpTransport = async (payload) => {
  const parsed = rsvpSchema.safeParse(payload);
  if (!parsed.success) return { ok: false, status: 400, error: "Please check the highlighted fields.", fieldErrors: issuesToFieldErrors(parsed.error) };
  const v = parsed.data;
  if (v.website) return { ok: true, status: 200, message: "Thank you." }; // honeypot
  const { token } = currentToken();
  const body = {
    token: v.guestCode || token || undefined,
    requestId: store.get(REQUEST_KEY) || undefined,
    name: v.fullName,
    attend: v.attendance === "attending" ? "attending" : "not_attending",
    guests: v.attendance === "attending" ? v.partySize : 0,
    phone: v.phone || "",
    email: v.email || "",
    message: v.message || "",
    channel: "web",
    device: deviceId(),
  };
  let res: Response;
  try {
    res = await fetch("/api/rsvp", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) });
  } catch {
    return { ok: false, status: 0, error: "We could not reach the server. Please check your connection and try again." };
  }
  const data = (await res.json().catch(() => ({}))) as { ok?: boolean; error?: string; mode?: string; requestId?: string; guestId?: string; capped?: boolean; attendingCount?: number };
  if (!res.ok || !data.ok) return { ok: false, status: res.status, error: data.error || "Something went wrong. Please try again." };

  if (data.mode === "pending") {
    if (data.requestId) store.set(REQUEST_KEY, data.requestId);
    return {
      ok: true,
      status: res.status,
      pending: true,
      message: "Waiting for approval.",
    };
  }
  if (data.guestId) adoptToken(data.guestId);
  const capped = data.capped ? ` Your invitation covers ${data.attendingCount} guest${data.attendingCount === 1 ? "" : "s"}, so we have noted ${data.attendingCount}.` : "";
  return {
    ok: true,
    status: res.status,
    updated: true,
    partySize: data.attendingCount,
    message:
      (v.attendance === "attending" ? "Thank you! We cannot wait to celebrate with you." : "Thank you for letting us know. You will be missed.") + capped,
  };
};

/* ---------------- check-in ---------------- */

/** Wedding day in Harare (check-in only opens on the day). */
export function isWeddingDay(date: string, timeZone: string, now = new Date()): boolean {
  try { return now.toLocaleDateString("en-CA", { timeZone }) === date; } catch { return false; }
}

export type CheckinResult = { ok: boolean; reason?: string; distanceMeters?: number; alreadyCheckedIn?: boolean; guestId?: string; firstName?: string; table?: string; error?: string };

export async function postCheckin(payload: Record<string, unknown>): Promise<CheckinResult> {
  try {
    const res = await fetch("/api/checkin", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ ...payload, device: deviceId() }) });
    const data = (await res.json().catch(() => ({}))) as CheckinResult;
    if (data.ok && data.guestId) adoptToken(data.guestId);
    return data;
  } catch {
    return { ok: false, error: "We could not reach the server. Please try again, or see an usher at the entrance." };
  }
}

export function currentPosition(timeout = 10000): Promise<GeolocationPosition> {
  return new Promise((resolve, reject) => {
    if (!navigator.geolocation) return reject(new Error("unsupported"));
    navigator.geolocation.getCurrentPosition(resolve, reject, { enableHighAccuracy: true, timeout, maximumAge: 60000 });
  });
}
