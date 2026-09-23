// Shared country-dial-code list + phone helpers, used by both the public site
// (assets/js/main.js) and the admin app (admin/app.js). Zimbabwe first (this
// wedding's home country), then the requested priority order, then the rest
// of the world alphabetically.
(function (global) {
  "use strict";

  var COUNTRIES = [
    { code: "ZW", dial: "263", name: "Zimbabwe" },
    { code: "ZA", dial: "27", name: "South Africa" },
    { code: "GB", dial: "44", name: "United Kingdom" },
    { code: "US", dial: "1", name: "United States" },
    { code: "AU", dial: "61", name: "Australia" },
    { code: "BW", dial: "267", name: "Botswana" },
    { code: "ZM", dial: "260", name: "Zambia" },
    { code: "NA", dial: "264", name: "Namibia" },
    { code: "CN", dial: "86", name: "China" },
    { code: "AE", dial: "971", name: "United Arab Emirates" },
    { code: "AR", dial: "54", name: "Argentina" },
    { code: "AT", dial: "43", name: "Austria" },
    { code: "BE", dial: "32", name: "Belgium" },
    { code: "BR", dial: "55", name: "Brazil" },
    { code: "CA", dial: "1", name: "Canada" },
    { code: "CH", dial: "41", name: "Switzerland" },
    { code: "DE", dial: "49", name: "Germany" },
    { code: "DK", dial: "45", name: "Denmark" },
    { code: "EG", dial: "20", name: "Egypt" },
    { code: "ES", dial: "34", name: "Spain" },
    { code: "FI", dial: "358", name: "Finland" },
    { code: "FR", dial: "33", name: "France" },
    { code: "GH", dial: "233", name: "Ghana" },
    { code: "GR", dial: "30", name: "Greece" },
    { code: "HK", dial: "852", name: "Hong Kong" },
    { code: "IE", dial: "353", name: "Ireland" },
    { code: "IN", dial: "91", name: "India" },
    { code: "IT", dial: "39", name: "Italy" },
    { code: "JP", dial: "81", name: "Japan" },
    { code: "KE", dial: "254", name: "Kenya" },
    { code: "KR", dial: "82", name: "South Korea" },
    { code: "MW", dial: "265", name: "Malawi" },
    { code: "MX", dial: "52", name: "Mexico" },
    { code: "MY", dial: "60", name: "Malaysia" },
    { code: "MZ", dial: "258", name: "Mozambique" },
    { code: "NG", dial: "234", name: "Nigeria" },
    { code: "NL", dial: "31", name: "Netherlands" },
    { code: "NO", dial: "47", name: "Norway" },
    { code: "NZ", dial: "64", name: "New Zealand" },
    { code: "PK", dial: "92", name: "Pakistan" },
    { code: "PL", dial: "48", name: "Poland" },
    { code: "PT", dial: "351", name: "Portugal" },
    { code: "RU", dial: "7", name: "Russia" },
    { code: "RW", dial: "250", name: "Rwanda" },
    { code: "SA", dial: "966", name: "Saudi Arabia" },
    { code: "SE", dial: "46", name: "Sweden" },
    { code: "SG", dial: "65", name: "Singapore" },
    { code: "TZ", dial: "255", name: "Tanzania" },
    { code: "UG", dial: "256", name: "Uganda" },
  ];

  function findByDial(dial) {
    return COUNTRIES.find(function (c) { return c.dial === dial; });
  }

  // Best-effort parse of whatever's already stored (raw digits, "0..." local,
  // "+263..." E.164, or "263..." with no plus) into {dial, number}.
  function splitPhone(raw) {
    var digits = String(raw || "").replace(/[^\d]/g, "");
    if (!digits) return { dial: "263", number: "" };
    if (digits.charAt(0) === "0") return { dial: "263", number: digits.slice(1) };
    var sortedByLen = COUNTRIES.slice().sort(function (a, b) { return b.dial.length - a.dial.length; });
    for (var i = 0; i < sortedByLen.length; i++) {
      var c = sortedByLen[i];
      if (digits.indexOf(c.dial) === 0 && digits.length > c.dial.length) {
        return { dial: c.dial, number: digits.slice(c.dial.length) };
      }
    }
    return { dial: "263", number: digits };
  }

  function joinPhone(dial, number) {
    var num = String(number || "").replace(/[^\d]/g, "").replace(/^0+/, "");
    if (!num) return "";
    return "+" + dial + num;
  }

  // Wires a <select> (country) + <input type=tel> (local number) pair.
  // existingValue is whatever was previously stored for this phone field.
  // Options are keyed by ISO code (not dial) so countries sharing a dial code
  // (US/Canada) stay distinct; the full name lives in the tooltip only.
  function populatePhoneWidget(selectEl, inputEl, existingValue) {
    var parsed = splitPhone(existingValue);
    var selected = findByDial(parsed.dial) || COUNTRIES[0];
    selectEl.innerHTML = COUNTRIES.map(function (c) {
      return '<option value="' + c.code + '" title="' + c.name + '"' + (c === selected ? " selected" : "") + ">" + c.code + " +" + c.dial + "</option>";
    }).join("");
    selectEl.value = selected.code;
    inputEl.value = parsed.number;
  }

  function readPhoneWidget(selectEl, inputEl) {
    var c = COUNTRIES.find(function (x) { return x.code === selectEl.value; }) || COUNTRIES[0];
    return joinPhone(c.dial, inputEl.value);
  }

  // "+263778106935" -> "+263 778106935": readable, and the space stops Excel
  // from turning the number into 2.64E+11 when a CSV is opened.
  function formatPhone(raw) {
    var s = String(raw || "").trim();
    if (!s) return "";
    var p = splitPhone(s);
    return p.number ? "+" + p.dial + " " + p.number : s;
  }

  global.WNPhone = { COUNTRIES: COUNTRIES, splitPhone: splitPhone, joinPhone: joinPhone, formatPhone: formatPhone, populatePhoneWidget: populatePhoneWidget, readPhoneWidget: readPhoneWidget, findByDial: findByDial };
  if (typeof module !== "undefined" && module.exports) module.exports = global.WNPhone;
})(typeof window !== "undefined" ? window : globalThis);
