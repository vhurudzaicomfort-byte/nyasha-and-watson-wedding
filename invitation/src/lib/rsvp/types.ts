export type Attendance = "attending" | "declined";

/** What a guest submits from the form. */
export interface RsvpInput {
  invitationSlug: string;
  fullName: string;
  attendance: Attendance;
  partySize: number;
  /** Optional contact detail so the couple can reach the guest if needed. */
  phone?: string;
  email?: string;
  message?: string;
  /** Personal invitation code when the guest opened a personalised link. */
  guestCode?: string;
}

/** Stored record. Never returned to ordinary guests – admin export only. */
export interface RsvpRecord extends RsvpInput {
  id: string;
  /** Normalised key used to recognise the same guest responding twice. */
  dedupeKey: string;
  createdAt: string;
  updatedAt: string;
  /** Coarse request metadata for abuse investigation (no full IP stored). */
  meta: { userAgent: string; ipHash: string };
}

export interface RsvpResult {
  record: RsvpRecord;
  /** true when an earlier response by the same guest was updated. */
  updated: boolean;
}
