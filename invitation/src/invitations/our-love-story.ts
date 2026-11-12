import type { Invitation } from "./types";

/**
 * ---------------------------------------------------------------------------
 *  "Our Love Story" – content transcribed from the couple's Canva design.
 * ---------------------------------------------------------------------------
 *  Everything a guest reads lives in this one file. Edit here, nowhere else.
 *  Details confirmed by the couple.
 */
export const ourLoveStory: Invitation = {
  slug: "our-love-story",

  couple: {
    partnerOne: "Nyasha Mazuruse",
    partnerTwo: "Watson Chin'ombe",
  },

  invitationLine: "You are cordially invited to celebrate",
  title: "Our Love Story",
  tagline:
    "Join us for an unforgettable celebration of love, laughter, and new beginnings.",

  schedule: {
    date: "2026-12-05", // Saturday
    startTime: "10:00",
    endTime: "16:00",
    arrivalTime: "09:30",
    timeZone: "Africa/Harare",
  },

  venue: {
    name: "Colne Valley Nature Reserve Park",
    addressLine: "7 Bay Noakes Road, Colne Valley, Chisipite",
    city: "Harare",
    country: "Zimbabwe",
    mapsQuery: "Colne Valley Nature Reserve Park, 7 Bay Noakes Road, Chisipite, Harare, Zimbabwe",
    mapsUrl: "https://maps.app.goo.gl/aFjWs1ofgq1LSQgJA",
  },

  dressCode: {
    theme: "Classic • Elegant",
    ladies: "Elegant dresses",
    gentlemen: "Tailored tuxedo suits",
    note: "Please draw inspiration from the pictures below.",
    inspirationImages: [
      {
        src: "/images/dress-code-attire.webp",
        alt: "Ladies in gowns of muted plum, soft champagne, peach coral and ivory; gentlemen in an ivory dinner jacket and a black tuxedo",
      },
    ],
    palette: [
      { name: "Dusty Mauve", hex: "#9B7386", gownName: "Muted Plum" },
      { name: "Soft Champagne", hex: "#E7D7B3", gownName: "Soft Champagne" },
      { name: "Peach", hex: "#F0B48E", gownName: "Peach Coral" },
      { name: "Ivory", hex: "#F5F0E6", gownName: "Ivory" },
    ],
  },

  gifts: {
    heading: "Gifts",
    message:
      "Should you wish to bless us further, cash contributions would be greatly appreciated. Kindly note no physical gifts will be allowed.",
  },

  guidelines: [
    "Guests arrive at 9:30 AM. Please be seated by 10:00 AM.",
    "Please remember that attendance at the wedding is strictly by RSVP and invitation.",
    "Due to restrictions and safety reasons at our venue, we are unable to extend this invitation to children.",
  ],

  // Chorus of "Those Eyes" (New West), 1:44.6–2:19.6 of the supplied recording,
  // levelled to -16 LUFS. The beat lines up exactly 30.00 s apart, so each pass
  // starts at 1.4 s (just before "Cause' all of the small things") and cross-fades
  // in as the previous pass reaches 31.4 s ("and the small things you do" has ended).
  musicSrc: "/audio/those-eyes-chorus.m4a",
  music: { fallbackSrc: "/audio/those-eyes-chorus.mp3", loopIn: 1.4, loopAt: 31.4, volume: 0.5, firstFade: 3 },

  rsvp: {
    deadline: null, // no deadline announced in the design
    defaultPartySize: 2,
    fallbackPhones: ["077 277 3973", "077 269 2738"],
  },

  closingLine: "With love, we look forward to celebrating with you.",

  // HD photographic florals (transparent WebP). Placement per slot: src/app/decor.css
  decor: {
    cornerImage: "/images/roses-ivory-peach-corner.webp",
    sprigImage: "/images/roses-burgundy-garland.webp",
    slots: {
      "envelope-l": "/images/roses-burgundy-branch.webp",
      "envelope-r": "/images/roses-burgundy-garland.webp",
      "hero-tl": "/images/roses-burgundy-branch.webp",
      "hero-br": "/images/roses-burgundy-corner.webp",
      "details-tl": "/images/roses-ivory-cascade.webp",
      "details-br": "/images/roses-ivory-peach-corner.webp",
      "dress-r": "/images/roses-burgundy-branch.webp",
      "rsvp-tr": "/images/roses-ivory-peach-corner.webp",
      "rsvp-bl": "/images/roses-burgundy-corner.webp",
      "closing-l": "/images/roses-burgundy-corner.webp",
      "closing-r": "/images/roses-burgundy-branch.webp",
    },
    frameImage: "/images/frame-gold-roses.webp",
    ringsImage: "/images/wedding-rings.webp",
  },

  theme: {
    primary: "#8C6A7F", // dusty mauve
    primaryDeep: "#3B2531", // deep plum (cover)
    gold: "#C4A46A", // soft gold foil
    blush: "#F0B48E", // peach
    leaf: "#4F6B52", // botanical green
  },
};
