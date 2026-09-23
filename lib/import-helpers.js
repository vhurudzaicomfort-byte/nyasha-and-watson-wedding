// Shared by the guest, gift and provider imports. Uploads arrive as CSV (Excel
// files are converted in the browser), with either the Excel templates'
// friendly headers ("First Name *", "Agreed Fee") or the older CSV ones.

// Minimal RFC4180-ish CSV parser: quoted fields, escaped quotes, commas/newlines inside quotes.
function parseCsv(text) {
  const rows = [];
  let row = [];
  let field = "";
  let inQuotes = false;
  const s = String(text || "").replace(/^﻿/, "").replace(/\r\n/g, "\n").replace(/\r/g, "\n");
  for (let i = 0; i < s.length; i++) {
    const c = s[i];
    if (inQuotes) {
      if (c === '"') {
        if (s[i + 1] === '"') { field += '"'; i++; } else { inQuotes = false; }
      } else { field += c; }
    } else if (c === '"') {
      inQuotes = true;
    } else if (c === ",") {
      row.push(field); field = "";
    } else if (c === "\n") {
      row.push(field); field = "";
      rows.push(row); row = [];
    } else {
      field += c;
    }
  }
  if (field.length || row.length) { row.push(field); rows.push(row); }
  return rows.filter((r) => r.some((c) => c.trim() !== ""));
}

// aliases: { normalisedHeader: "CanonicalField" }; headers are compared
// lowercase with everything but letters/digits removed ("First Name *" -> "firstname").
function headerMapper(aliases) {
  return function (h) {
    const key = String(h || "").toLowerCase().replace(/[^a-z0-9]/g, "");
    return aliases[key] || String(h || "").trim();
  };
}

// Rows as objects keyed by canonical field names.
function readRows(csvText, aliases) {
  const rows = parseCsv(csvText);
  if (!rows.length) return { header: [], records: [] };
  const map = headerMapper(aliases);
  const header = rows[0].map(map);
  const records = rows.slice(1).map((r) => {
    const o = {};
    header.forEach((h, i) => { o[h] = r[i] !== undefined ? r[i] : ""; });
    return o;
  });
  return { header, records };
}

// "1,250.50", "$ 1 250", "USD 300" -> number; blank/garbage -> null
function parseMoney(v) {
  const s = String(v == null ? "" : v).replace(/[^\d.\-]/g, "");
  if (!s || s === "." || s === "-") return null;
  const n = Number(s);
  return isFinite(n) ? n : null;
}

const MONTHS = { jan: 1, feb: 2, mar: 3, apr: 4, may: 5, jun: 6, jul: 7, aug: 8, sep: 9, sept: 9, oct: 10, nov: 11, dec: 12 };
function monthNum(name) { const k = String(name).toLowerCase(); return MONTHS[k.slice(0, 4)] || MONTHS[k.slice(0, 3)] || 0; }
function iso(y, m, d) {
  if (!(y > 1900 && m >= 1 && m <= 12 && d >= 1 && d <= 31)) return "";
  return y + "-" + String(m).padStart(2, "0") + "-" + String(d).padStart(2, "0");
}
// Accepts 2026-11-15, 15/11/2026 (day first, as written in Zimbabwe), 15-11-26,
// "15 Nov 2026", "Nov 15, 2026" and Excel serial numbers. Returns YYYY-MM-DD or "".
function normDate(v) {
  const s = String(v == null ? "" : v).trim();
  if (!s) return "";
  let m;
  if ((m = s.match(/^(\d{4})[-/.](\d{1,2})[-/.](\d{1,2})/))) return iso(+m[1], +m[2], +m[3]);
  if ((m = s.match(/^(\d{1,2})[-/.](\d{1,2})[-/.](\d{2,4})$/))) { let y = +m[3]; if (y < 100) y += 2000; return iso(y, +m[2], +m[1]); }
  if ((m = s.match(/^(\d{1,2})\s+([a-z]{3,})\.?,?\s+(\d{4})$/i)) && monthNum(m[2])) return iso(+m[3], monthNum(m[2]), +m[1]);
  if ((m = s.match(/^([a-z]{3,})\.?\s+(\d{1,2}),?\s+(\d{4})$/i)) && monthNum(m[1])) return iso(+m[3], monthNum(m[1]), +m[2]);
  if (/^\d{5}$/.test(s)) { const d = new Date(Date.UTC(1899, 11, 30) + Number(s) * 86400000); return d.toISOString().slice(0, 10); }
  return "";
}

module.exports = { parseCsv, headerMapper, readRows, parseMoney, normDate };
