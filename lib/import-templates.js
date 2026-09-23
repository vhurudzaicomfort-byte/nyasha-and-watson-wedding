// Excel import templates. Dropdowns come straight from the shared option lists,
// so a template downloaded today always matches what the portal accepts.
const L = require("../assets/js/guest-fields.js");

const labels = (list) => list.map((x) => (typeof x === "string" ? x : x.label));

const TEMPLATES = {
  guests: {
    file: "Guest-Register-Template.xlsx",
    sheet: "Guests",
    title: "Nyasha & Watson — Guest Register",
    columns: [
      { header: "First Name *", width: 22, note: "Required." },
      { header: "Last Name", width: 22 },
      { header: "Phone", width: 22, text: true, note: "Include the country code, e.g. +263 772 692 738. Used to match RSVPs and send WhatsApp invites." },
      { header: "Email", width: 32 },
      { header: "Invitation Type", width: 19, list: labels(L.INVITATION_TYPES) },
      { header: "Family Name", width: 26, note: "For couples and families, e.g. The Moyo Family." },
      { header: "Invited For", width: 22, list: L.CATEGORIES },
      { header: "Gender", width: 13, list: labels(L.GENDERS) },
      { header: "Number Invited", width: 17, number: { min: 1, max: 50 }, note: "How many people this invitation covers. Leave blank for 1 (Individual) or 2 (Couple)." },
      { header: "Notes", width: 48 },
    ],
    steps: [
      "Fill in the Guests tab — one invitation per row, starting under the purple header.",
      "First Name is the only required field. Keep the header row exactly as it is.",
      "Shaded columns are dropdowns: click the cell and pick from the arrow.",
      "Save, then in the portal go to Invites & RSVPs → Import and drop this Excel file in.",
      "You'll see a preview first; possible duplicates are flagged for you to skip, update or add.",
    ],
    notes: [
      ["Phone", "Include the country code (e.g. +263, +27, +44). It lets the site recognise the guest when they RSVP and powers the WhatsApp invite button."],
      ["Number Invited", "How many people the invitation covers. Leave blank for 1 (Individual) or 2 (Couple); fill it in for families."],
      ["Family Name", "Shown on the guest list for couples and families, e.g. The Moyo Family."],
    ],
    examples: {
      headers: ["First Name", "Last Name", "Phone", "Invitation Type", "Family Name", "Invited For", "Gender", "Number Invited"],
      rows: [
        ["Tariro", "Moyo", "+263 771 234 567", "Couple", "The Moyo Family", "Groom's Side", "Female", 2],
        ["Rudo", "Banda", "+27 82 111 2233", "Individual", "", "Church", "Female", 1],
        ["Tendai", "Mukanga", "+263 772 000 111", "Family", "The Mukanga Family", "Bride's Side", "Male", 4],
      ],
    },
  },

  gifts: {
    file: "Gift-Register-Template.xlsx",
    sheet: "Gifts",
    title: "Nyasha & Watson — Gift Register",
    columns: [
      { header: "Type *", width: 13, list: labels(L.GIFT_TYPES), note: "Cash or In Kind." },
      { header: "Giver *", width: 28, note: "Who gave the gift, e.g. The Moyo Family." },
      { header: "Giver Phone", width: 20, text: true, note: "Optional. Include the country code." },
      { header: "Date", width: 14, date: true, note: "When it was received. Leave blank for today." },
      { header: "Amount", width: 15, decimal: true, note: "Cash gifts only." },
      { header: "Currency", width: 12, list: L.CURRENCIES, note: "Cash gifts only. Blank = USD." },
      { header: "Payment Method", width: 18, list: L.PAYMENT_METHODS, note: "Cash gifts only." },
      { header: "Description", width: 32, note: "In-kind gifts only (required for them), e.g. Toaster, Dinner set." },
      { header: "Estimated Value", width: 16, decimal: true, note: "In-kind gifts only, optional." },
      { header: "Estimated Currency", width: 14, list: L.CURRENCIES, note: "In-kind gifts only." },
      { header: "Notes", width: 40 },
    ],
    steps: [
      "Fill in the Gifts tab — one gift per row.",
      "Type and Giver are required. For Cash, fill Amount, Currency and Payment Method; for In Kind, fill Description (and an estimated value if you like).",
      "Shaded columns are dropdowns; dates can be typed as 2026-11-15 or 15/11/2026.",
      "Save, then in the portal go to Gifts → Import and drop this Excel file in.",
      "The preview flags gifts that look already recorded (same giver, date and amount).",
    ],
    notes: [
      ["Amount", "Numbers only — no currency symbols. Totals in the reports are worked out per currency."],
      ["Date", "Leave blank to use the day you import."],
    ],
    examples: {
      headers: ["Type", "Giver", "Giver Phone", "Date", "Amount", "Currency", "Payment Method", "Description"],
      rows: [
        ["Cash", "The Moyo Family", "+263 771 234 567", "2026-12-05", 200, "USD", "EcoCash", ""],
        ["In Kind", "Rudo Banda", "", "2026-12-05", "", "", "", "Dinner set"],
      ],
    },
  },

  providers: {
    file: "Service-Providers-Template.xlsx",
    sheet: "Providers",
    title: "Nyasha & Watson — Service Providers",
    columns: [
      { header: "Provider Name *", width: 28, note: "Required, e.g. Sunrise Catering Co." },
      { header: "Category", width: 22, list: L.PROVIDER_CATEGORIES, strict: false, note: "Choose from the list (you may type your own)." },
      { header: "Contact Person", width: 22 },
      { header: "Phone", width: 20, text: true, note: "Include the country code." },
      { header: "Email", width: 30 },
      { header: "Agreed Fee", width: 15, decimal: true, note: "The total you agreed to pay." },
      { header: "Currency", width: 12, list: L.CURRENCIES, note: "Blank = USD." },
      { header: "Payment Deadline", width: 17, date: true, note: "When the balance is due. Drives the Overdue / Due Soon status." },
      { header: "Notes", width: 40 },
    ],
    steps: [
      "Fill in the Providers tab — one supplier per row.",
      "Provider Name is required. Add the Agreed Fee and Payment Deadline so the portal can track what's outstanding.",
      "Shaded columns are dropdowns; dates can be typed as 2026-11-15 or 15/11/2026.",
      "Save, then in the portal go to Service Providers → Import and drop this Excel file in.",
      "Payments are recorded in the portal afterwards — importing never changes payments already logged.",
    ],
    notes: [
      ["Category", "Pick the closest match, or type your own if nothing fits."],
      ["Payment Deadline", "Providers past their deadline with a balance show as Overdue; within 7 days, Due Soon."],
    ],
    examples: {
      headers: ["Provider Name", "Category", "Contact Person", "Phone", "Agreed Fee", "Currency", "Payment Deadline", "Notes"],
      rows: [
        ["Sunrise Catering Co", "Catering", "Tendai Moyo", "+263 772 345 678", 1000, "USD", "2026-11-15", "Deposit paid"],
        ["Petal & Stem", "Décor & Flowers", "Grace Chari", "+27 82 111 2233", 450, "USD", "2026-11-30", ""],
      ],
    },
  },
};

module.exports = { TEMPLATES };
