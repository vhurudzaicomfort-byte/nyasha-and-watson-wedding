// Guest option lists shared by the public site, the admin app and the API,
// so dropdowns never depend on a network response to be populated.
(function (global) {
  "use strict";

  var CATEGORIES = ["Bride's Side", "Groom's Side", "Church", "Mutual Friends", "Service Providers"];

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
  function genderLabel(v) { var g = GENDERS.find(function (x) { return x.value === v; }); return g ? g.label : ""; }

  global.WNGuestFields = {
    CATEGORIES: CATEGORIES, GENDERS: GENDERS,
    normGender: normGender, normCategory: normCategory, genderLabel: genderLabel
  };
  if (typeof module !== "undefined" && module.exports) module.exports = global.WNGuestFields;
})(typeof window !== "undefined" ? window : globalThis);
