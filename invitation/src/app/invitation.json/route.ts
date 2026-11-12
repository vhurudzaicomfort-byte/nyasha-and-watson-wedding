import { ourLoveStory as inv } from "@/invitations/our-love-story";
import { dateParts, dottedDate, formatTime12h, longDate } from "@/lib/datetime";

/**
 * The wedding details as a static file (/invitation.json), written at build time
 * from the invitation config. The A5 PDF invitation (public/assets → site
 * /assets/js/wn-invitation-pdf.js), used by guests and by the portal, reads it,
 * so the printed card can never disagree with the website.
 */
export const dynamic = "force-static";

export function GET() {
  const s = inv.schedule;
  const p = dateParts(s.date, s.timeZone);
  const body = {
    couple: inv.couple,
    invitationLine: inv.invitationLine,
    title: inv.title,
    tagline: inv.tagline,
    date: s.date,
    dottedDate: dottedDate(s.date),
    weekday: s.weekdayLabel ?? p.weekday,
    longDate: longDate(s.date, s.timeZone),
    arrival: formatTime12h(s.arrivalTime || s.startTime),
    ceremony: formatTime12h(s.startTime),
    venue: inv.venue,
    dressCode: {
      theme: inv.dressCode.theme,
      ladies: inv.dressCode.ladies,
      gentlemen: inv.dressCode.gentlemen,
      palette: inv.dressCode.palette.map((c) => c.name),
    },
    gifts: inv.gifts.message,
    guidelines: inv.guidelines,
    phones: inv.rsvp.fallbackPhones,
    images: {
      topLeft: inv.decor?.slots?.["hero-tl"] ?? inv.decor?.cornerImage ?? null,
      bottomRight: inv.decor?.slots?.["hero-br"] ?? inv.decor?.cornerImage ?? null,
      rings: inv.decor?.ringsImage ?? null,
    },
  };
  return new Response(JSON.stringify(body, null, 2), { headers: { "Content-Type": "application/json" } });
}
