// Every fixed option list in the system — shared by the public site, the admin
// portal, the APIs and the Excel templates' dropdowns — so they can never drift
// apart, and dropdowns never depend on a network response to be populated.
(function (global) {
  "use strict";

  var CATEGORIES = ["Bride's Side", "Groom's Side", "Church", "Mutual Friends", "Service Providers"];

  var INVITATION_TYPES = [
    { value: "individual", label: "Individual" },
    { value: "couple", label: "Couple" },
    { value: "family", label: "Family" }
  ];

  var CURRENCIES = ["USD", "ZWG", "ZAR", "GBP", "EUR"];
  var PAYMENT_METHODS = ["EcoCash", "InnBucks", "Bank Transfer", "Cash", "World Remit", "Mukuru", "Western Union", "Other"];
  var GIFT_TYPES = [
    { value: "cash", label: "Cash" },
    { value: "kind", label: "In Kind" }
  ];
  var PROVIDER_CATEGORIES = ["Venue", "Catering", "Cake", "Photography", "Videography", "Décor & Flowers", "Music / DJ / Band", "MC", "Attire & Styling", "Hair & Makeup", "Transport", "Stationery & Printing", "Tent & Chair Hire", "Security", "Officiant", "Other"];

  var GENDERS = [
    { value: "female", label: "Female" },
    { value: "male", label: "Male" }
  ];

  function normGender(v) {
    var s = String(v || "").trim().toLowerCase();
    if (s === "f" || s === "female" || s === "woman") return "female";
    if (s === "m" || s === "male" || s === "man") return "male";
    return "";
  }
  // Older records used one category per church; they all fold into "Church".
  function normCategory(v) {
    var s = String(v || "").trim();
    if (!s) return "";
    if (/church/i.test(s)) return "Church";
    if (/^bride/i.test(s)) return "Bride's Side";
    if (/^groom/i.test(s)) return "Groom's Side";
    if (/mutual|friend/i.test(s)) return "Mutual Friends";
    if (/service|provider|vendor|supplier/i.test(s)) return "Service Providers";
    var hit = CATEGORIES.find(function (c) { return c.toLowerCase() === s.toLowerCase(); });
    return hit || s;
  }
  function normInvitationType(v) {
    var s = String(v || "").trim().toLowerCase();
    if (s === "group") return "family";
    return INVITATION_TYPES.some(function (t) { return t.value === s; }) ? s : "individual";
  }
  function normGiftType(v) { return /kind/i.test(String(v || "")) ? "kind" : "cash"; }
  function normCurrency(v) {
    var s = String(v || "").trim().toUpperCase();
    if (s === "US$" || s === "$") s = "USD";
    if (s === "ZIG" || s === "ZWL") s = "ZWG";
    if (s === "R" || s === "RAND") s = "ZAR";
    if (s === "£") s = "GBP";
    if (s === "€") s = "EUR";
    return CURRENCIES.indexOf(s) !== -1 ? s : "USD";
  }
  // Match a typed value to a list entry ignoring case/punctuation; keep the typed text otherwise.
  function matchList(list, v, fallback) {
    var raw = String(v || "").trim();
    if (!raw) return fallback || "";
    var key = raw.toLowerCase().replace(/[^a-z0-9]/g, "");
    var hit = list.find(function (x) { return x.toLowerCase().replace(/[^a-z0-9]/g, "") === key; });
    return hit || raw;
  }
  function normPaymentMethod(v) { return matchList(PAYMENT_METHODS, v, "Cash"); }
  function normProviderCategory(v) {
    var s = String(v || "").trim();
    if (!s) return "";
    var l = s.toLowerCase();
    if (/cater|food/.test(l)) return "Catering";
    if (/photo/.test(l)) return "Photography";
    if (/video|film/.test(l)) return "Videography";
    if (/flor|flower|decor/.test(l)) return "Décor & Flowers";
    if (/\bdj\b|music|band|sound/.test(l)) return "Music / DJ / Band";
    if (/cake|bak/.test(l)) return "Cake";
    if (/hair|makeup|make-up|beauty/.test(l)) return "Hair & Makeup";
    if (/transport|car|bus|limo/.test(l)) return "Transport";
    if (/tent|chair|hire|rental/.test(l)) return "Tent & Chair Hire";
    if (/print|stationer|invitation card/.test(l)) return "Stationery & Printing";
    if (/pastor|priest|minister|officiant/.test(l)) return "Officiant";
    return matchList(PROVIDER_CATEGORIES, s, s);
  }
  function genderLabel(v) { var g = GENDERS.find(function (x) { return x.value === v; }); return g ? g.label : ""; }

  // RSVPs close at the end of 10 November (Harare time). The site and the API
  // both read this, so the page and the server always agree.
  var RSVP_DEADLINE_LABEL = "10 November 2026";
  var RSVP_CLOSES_AT = "2026-11-11T00:00:00+02:00";
  function rsvpClosed(now) { return (now == null ? Date.now() : +now) >= Date.parse(RSVP_CLOSES_AT); }

  global.WNGuestFields = {
    CATEGORIES: CATEGORIES, GENDERS: GENDERS, INVITATION_TYPES: INVITATION_TYPES,
    CURRENCIES: CURRENCIES, PAYMENT_METHODS: PAYMENT_METHODS, GIFT_TYPES: GIFT_TYPES, PROVIDER_CATEGORIES: PROVIDER_CATEGORIES,
    normGender: normGender, normCategory: normCategory, normInvitationType: normInvitationType, normGiftType: normGiftType,
    normCurrency: normCurrency, normPaymentMethod: normPaymentMethod, normProviderCategory: normProviderCategory, genderLabel: genderLabel,
    RSVP_DEADLINE_LABEL: RSVP_DEADLINE_LABEL, RSVP_CLOSES_AT: RSVP_CLOSES_AT, rsvpClosed: rsvpClosed
  };
  if (typeof module !== "undefined" && module.exports) module.exports = global.WNGuestFields;
})(typeof window !== "undefined" ? window : globalThis);
