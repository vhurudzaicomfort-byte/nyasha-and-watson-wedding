// Guest option lists shared by the public site, the admin app and the API,
// so dropdowns never depend on a network response to be populated.
(function (global) {
  "use strict";

  var CATEGORIES = ["Bride's Side", "Groom's Side", "ZAOGA Church", "Roman Catholic Church", "Mutual Friends", "Service Providers"];

  var GENDERS = [
    { value: "female", label: "Female" },
    { value: "male", label: "Male" }
  ];

  var AGE_GROUPS = [
    { value: "0-6", label: "0–6", group: "child" },
    { value: "7-16", label: "7–16", group: "child" },
    { value: "17-30", label: "17–30", group: "adult" },
    { value: "31-50", label: "31–50", group: "adult" },
    { value: "51-60", label: "51–60", group: "adult" },
    { value: "61+", label: "61+", group: "adult" }
  ];

  function normGender(v) {
    var s = String(v || "").trim().toLowerCase();
    if (s === "f" || s === "female" || s === "woman") return "female";
    if (s === "m" || s === "male" || s === "man") return "male";
    return "";
  }
  function normAgeGroup(v) {
    var s = String(v || "").trim().replace(/[–—]/g, "-").replace(/\s+/g, "");
    if (s === "61" || s === "61-" || s === "61plus") s = "61+";
    return AGE_GROUPS.some(function (a) { return a.value === s; }) ? s : "";
  }
  function genderLabel(v) { var g = GENDERS.find(function (x) { return x.value === v; }); return g ? g.label : ""; }
  function ageLabel(v) { var a = AGE_GROUPS.find(function (x) { return x.value === v; }); return a ? a.label : ""; }
  function isChild(v) { var a = AGE_GROUPS.find(function (x) { return x.value === v; }); return !!a && a.group === "child"; }

  global.WNGuestFields = {
    CATEGORIES: CATEGORIES, GENDERS: GENDERS, AGE_GROUPS: AGE_GROUPS,
    normGender: normGender, normAgeGroup: normAgeGroup, genderLabel: genderLabel, ageLabel: ageLabel, isChild: isChild
  };
  if (typeof module !== "undefined" && module.exports) module.exports = global.WNGuestFields;
})(typeof window !== "undefined" ? window : globalThis);
