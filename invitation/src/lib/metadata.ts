import type { Metadata } from "next";
import type { Invitation } from "@/invitations/types";
import { longDate } from "./datetime";

export function buildMetadata(inv: Invitation): Metadata {
  const title = `${inv.couple.partnerOne} & ${inv.couple.partnerTwo} · ${inv.title}`;
  const description = `${inv.invitationLine} ${inv.title}. ${longDate(inv.schedule.date, inv.schedule.timeZone)} · ${inv.venue.name}, ${inv.venue.city}.`;
  return {
    title,
    description,
    openGraph: { title, description, type: "website" },
    twitter: { card: "summary", title, description },
  };
}
