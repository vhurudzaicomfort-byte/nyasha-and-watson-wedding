/**
 * Invitation data model.
 *
 * One `Invitation` object fully describes an event. The eGuest platform can
 * later supply these objects from a database instead of the static registry in
 * `./index.ts` without touching any UI component.
 */

export interface Couple {
  /** First partner's display name, e.g. "Rachel Collins". */
  partnerOne: string;
  /** Second partner's display name. */
  partnerTwo: string;
  /** Optional short form used in the envelope seal, e.g. "R & A". */
  monogram?: string;
}

export interface Venue {
  name: string;
  /** Street / suburb line shown under the venue name. */
  addressLine: string;
  city: string;
  country: string;
  /** Google "plus code" or any string Google Maps resolves. */
  mapsQuery: string;
  /** Exact Google Maps share link for the venue pin, when the couple has one. */
  mapsUrl?: string;
  /** Optional precise coordinates – used for the embedded map when present. */
  coordinates?: { lat: number; lng: number };
}

export interface Schedule {
  /** ISO calendar date of the ceremony, e.g. "2030-02-14". */
  date: string;
  /** 24h local start time of the ceremony, e.g. "10:00". */
  startTime: string;
  /** 24h local end time used for calendar entries. */
  endTime: string;
  /** IANA time zone the times above are expressed in. */
  timeZone: string;
  /**
   * Optional weekday wording shown on the invitation. When omitted the
   * weekday is derived from `date`. Set it only to match printed stationery.
   */
  weekdayLabel?: string;
  /** Optional guest arrival time shown in guidelines, e.g. "09:30". */
  arrivalTime?: string;
}

export interface ColourSwatch {
  name: string;
  hex: string;
  /** Optional gown name shown under the illustrated dress (e.g. "Muted Plum"). */
  gownName?: string;
}

export interface DressCode {
  theme: string;
  ladies: string;
  gentlemen: string;
  note?: string;
  palette: ColourSwatch[];
  /**
   * Optional licensed inspiration photos (paths under /public). When omitted,
   * illustrated gowns and tuxedos in the palette colours are shown instead.
   */
  inspirationImages?: { src: string; alt: string }[];
}

export interface RsvpSettings {
  /** ISO date by which guests should respond (null = not announced). */
  deadline: string | null;
  /** Maximum guests one response may cover when no personal allowance exists. */
  defaultPartySize: number;
  /** Phone numbers guests may use when they cannot RSVP online. */
  fallbackPhones: string[];
  /** Optional WhatsApp number (international format, digits only). */
  whatsappNumber?: string;
}

export interface Invitation {
  /** URL slug: /invitation/<slug>, /rsvp/<slug>. */
  slug: string;
  couple: Couple;
  /** Heading shown above the names ("You are cordially invited to celebrate"). */
  invitationLine: string;
  /** Calligraphic title ("Our Love Story"). */
  title: string;
  /** Short welcome paragraph on the cover. */
  tagline: string;
  schedule: Schedule;
  venue: Venue;
  /** Optional scripture / quote. */
  verse?: { text: string; reference: string };
  dressCode: DressCode;
  gifts: { heading: string; message: string };
  guidelines: string[];
  rsvp: RsvpSettings;
  /** Closing sentence under the signature. */
  closingLine: string;
  /** Optional licensed music track (path under /public or absolute URL). */
  musicSrc?: string;
  /**
   * Optional photographic decorations (paths under /public, PNG with
   * transparent background recommended). When absent, procedural SVG
   * florals are drawn instead.
   */
  decor?: {
    /** Floral bouquet used in page corners (details, RSVP, print pages). */
    cornerImage?: string;
    /** Leafy sprig used along edges (dress code, cover, envelope, footer). */
    sprigImage?: string;
    /**
     * Per-placement florals, keyed by slot name (e.g. "hero-tl", "rsvp-bl").
     * Size, position, rotation and mirroring for each slot live in
     * src/app/decor.css. A slot without an entry falls back to the images above.
     */
    slots?: Record<string, string>;
    /** Decorative gold frame (card borders and the downloadable invitation card). */
    frameImage?: string;
    /** Photographic wedding rings shown in place of "&" between the names. */
    ringsImage?: string;
  };
  theme: {
    /** Accent colours exposed as CSS variables (keeps each wedding on-brand). */
    primary: string;
    primaryDeep: string;
    gold: string;
    blush: string;
    leaf: string;
  };
}

/**
 * A guest resolved from a personal invitation code. Only the fields needed to
 * personalise the page are ever sent to the browser.
 */
export interface GuestContext {
  code: string;
  displayName: string;
  /** Number of seats reserved for this guest (including themselves). */
  allowance: number;
  /** Their reply already on record in the wedding portal, if any. */
  rsvp?: { attendance: "attending" | "declined"; partySize: number; at: string | null } | null;
  /** The table the couple has seated them at, once assigned. */
  table?: string;
  /** Whether they have already been checked in at the venue. */
  checkedIn?: boolean;
}
