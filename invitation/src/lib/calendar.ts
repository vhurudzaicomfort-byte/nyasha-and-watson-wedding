import type { Invitation } from "@/invitations/types";
import { zonedTimeToUtc } from "./datetime";

function icsStamp(d: Date): string {
  return d.toISOString().replace(/[-:]/g, "").replace(/\.\d{3}/, "");
}

/** Escape text per RFC 5545. */
function icsText(s: string): string {
  return s.replace(/\\/g, "\\\\").replace(/;/g, "\;").replace(/,/g, "\\,").replace(/\r?\n/g, "\\n");
}

/** Fold long lines at 75 octets as the spec requires. */
function fold(line: string): string {
  const out: string[] = [];
  let rest = line;
  while (rest.length > 73) {
    out.push(rest.slice(0, 73));
    rest = " " + rest.slice(73);
  }
  out.push(rest);
  return out.join("\r\n");
}

export interface CalendarEvent {
  title: string;
  description: string;
  location: string;
  start: Date;
  end: Date;
  url?: string;
  uid: string;
}

export function invitationToEvent(inv: Invitation, url?: string): CalendarEvent {
  const { schedule, venue, couple } = inv;
  return {
    title: `Wedding of ${couple.partnerOne} & ${couple.partnerTwo}`,
    description: `${inv.invitationLine} ${inv.title}. ${inv.tagline}${url ? `\n\n${url}` : ""}`,
    location: `${venue.name}, ${venue.addressLine}, ${venue.city}, ${venue.country}`,
    start: zonedTimeToUtc(schedule.date, schedule.startTime, schedule.timeZone),
    end: zonedTimeToUtc(schedule.date, schedule.endTime, schedule.timeZone),
    url,
    uid: `${inv.slug}@eguest`,
  };
}

export function buildIcs(ev: CalendarEvent): string {
  const lines = [
    "BEGIN:VCALENDAR",
    "VERSION:2.0",
    "PRODID:-//eGuest//Wedding Invitation//EN",
    "CALSCALE:GREGORIAN",
    "METHOD:PUBLISH",
    "BEGIN:VEVENT",
    `UID:${ev.uid}`,
    `DTSTAMP:${icsStamp(new Date())}`,
    `DTSTART:${icsStamp(ev.start)}`,
    `DTEND:${icsStamp(ev.end)}`,
    `SUMMARY:${icsText(ev.title)}`,
    `DESCRIPTION:${icsText(ev.description)}`,
    `LOCATION:${icsText(ev.location)}`,
    ...(ev.url ? [`URL:${ev.url}`] : []),
    "BEGIN:VALARM",
    "TRIGGER:-P1D",
    "ACTION:DISPLAY",
    `DESCRIPTION:${icsText(ev.title)} is tomorrow`,
    "END:VALARM",
    "END:VEVENT",
    "END:VCALENDAR",
  ];
  return lines.map(fold).join("\r\n") + "\r\n";
}

export function googleCalendarUrl(ev: CalendarEvent): string {
  const p = new URLSearchParams({
    action: "TEMPLATE",
    text: ev.title,
    dates: `${icsStamp(ev.start)}/${icsStamp(ev.end)}`,
    details: ev.description,
    location: ev.location,
  });
  return `https://calendar.google.com/calendar/render?${p.toString()}`;
}
