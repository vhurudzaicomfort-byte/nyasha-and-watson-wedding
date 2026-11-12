"use client";

import { createContext, useContext } from "react";
import type { RsvpFormValues } from "@/lib/rsvp/validation";
import { portalTransport } from "./host";

export interface RsvpSubmitResult {
  ok: boolean;
  status: number;
  message?: string;
  error?: string;
  fieldErrors?: Record<string, string>;
  updated?: boolean;
  /** Not on the invitation list yet: held for the couple's approval. */
  pending?: boolean;
  /** The number of guests actually recorded (the portal caps it at the invitation's allowance). */
  partySize?: number;
}

export type RsvpTransport = (payload: RsvpFormValues & { elapsedMs: number }) => Promise<RsvpSubmitResult>;

/** Default transport: the app's own API route. */
export const apiTransport: RsvpTransport = async (payload) => {
  const res = await fetch("/api/rsvp", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  });
  const data = (await res.json().catch(() => ({}))) as Omit<RsvpSubmitResult, "status">;
  return { ...data, status: res.status, ok: res.ok && Boolean(data.ok) };
};

export interface InvitationEnv {
  /** How the RSVP form sends responses (API route, or a platform store). */
  submitRsvp: RsvpTransport;
  /** Whether third-party iframes (Google Maps embed) may be rendered. */
  allowEmbeds: boolean;
  /** Whether file downloads (.ics) are possible for the viewer. */
  allowDownloads: boolean;
}

export const InvitationEnvContext = createContext<InvitationEnv>({
  submitRsvp: portalTransport,
  allowEmbeds: true,
  allowDownloads: true,
});

export const useInvitationEnv = () => useContext(InvitationEnvContext);
