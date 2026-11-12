import { z } from "zod";

const trimmed = (max: number) => z.string().trim().max(max);

/**
 * Shared client/server schema. The server is the source of truth; the client
 * reuses it so guests see the same messages before submitting.
 */
export const rsvpSchema = z
  .object({
    invitationSlug: z
      .string()
      .trim()
      .min(1)
      .max(64)
      .regex(/^[a-z0-9-]+$/, "Invalid invitation."),
    fullName: trimmed(80)
      .min(2, "Please enter your full name.")
      .regex(/^[\p{L}\p{M}'’.\- ]+$/u, "Please use letters only in your name."),
    attendance: z.enum(["attending", "declined"], {
      message: "Please let us know whether you will attend.",
    }),
    partySize: z.coerce
      .number()
      .int("Guests must be a whole number.")
      .min(0)
      .max(12, "That is more guests than one invitation may cover."),
    phone: trimmed(32)
      .regex(/^[+\d][\d\s().-]{5,}$/, "Please enter a valid phone number.")
      .or(z.literal(""))
      .optional(),
    email: z.email("Please enter a valid email address.").max(120).or(z.literal("")).optional(),
    message: trimmed(500).optional(),
    guestCode: trimmed(24).optional(),
    /** Honeypot – must stay empty. Bots that fill every field are rejected. */
    website: z.string().max(0).optional(),
    /** Milliseconds the form was open before submit (spam heuristic). */
    elapsedMs: z.coerce.number().int().min(0).optional(),
  })
  .superRefine((v, ctx) => {
    if (v.attendance === "attending" && v.partySize < 1) {
      ctx.addIssue({
        code: "custom",
        path: ["partySize"],
        message: "Please tell us how many guests will attend (at least one).",
      });
    }
    if (!v.phone && !v.email) {
      ctx.addIssue({
        code: "custom",
        path: ["phone"],
        message: "Please leave a phone number or an email so we can reach you.",
      });
    }
  });

/** Shape held in the form's React state (before coercion). */
export interface RsvpFormValues {
  invitationSlug: string;
  fullName: string;
  attendance: "attending" | "declined";
  partySize: number | string;
  phone?: string;
  email?: string;
  message?: string;
  guestCode?: string;
  website?: string;
  elapsedMs?: number;
}
export type RsvpValidated = z.output<typeof rsvpSchema>;

/** Flatten zod issues into { field: message } for the form. */
export function issuesToFieldErrors(error: z.ZodError): Record<string, string> {
  const out: Record<string, string> = {};
  for (const issue of error.issues) {
    const key = String(issue.path[0] ?? "form");
    if (!out[key]) out[key] = issue.message;
  }
  return out;
}

/** Collapse whitespace/case/punctuation so "Mr  J. Moyo" and "mr j moyo" match. */
export function normaliseName(name: string): string {
  return name
    .normalize("NFKD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9 ]+/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}
