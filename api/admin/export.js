const { requireAuth } = require("../../lib/auth");
const { readData } = require("../../lib/blob-store");
const { buildReportPdf } = require("../../lib/pdf-report");
const { buildTemplate, buildReport: buildReportXlsx } = require("../../lib/xlsx");
const { TEMPLATES } = require("../../lib/import-templates");
const XLSX_TYPE = "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet";
const WNPhone = require("../../assets/js/countries.js");
const Fields = require("../../assets/js/guest-fields.js");

var phone = WNPhone.formatPhone;
var CHECKIN_METHODS = { usher: "Usher", self: "Self (at venue)", auto: "Automatic (GPS)", "self-unverified": "Self (location unavailable)" };
var CHANNELS = { web: "Website", whatsapp: "WhatsApp", sms: "SMS", email: "Email", call: "Phone call", admin: "Logged by admin" };
function methodLabel(g) { return g.checkedIn ? (CHECKIN_METHODS[g.checkInMethod] || "Usher") : ""; }
function channelLabel(g) { return CHANNELS[g.rsvpChannel] || ""; }

function toCsv(rows) {
  return rows.map(function (r) {
    return r.map(function (cell) {
      var s = String(cell == null ? "" : cell).replace(/"/g, '""');
      return /[",\n]/.test(s) ? '"' + s + '"' : s;
    }).join(",");
  }).join("\r\n");
}
function cap(s) { s = String(s || "").replace("_", " "); return s ? s.charAt(0).toUpperCase() + s.slice(1) : ""; }
function fullName(g) { return ((g.firstName || "") + " " + (g.lastName || "")).trim() || "(unnamed guest)"; }
function money(n) { return (Number(n) || 0).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 }); }

function computeGiftTotals(gifts) {
  var byCurrency = {};
  var kindCount = 0, cashCount = 0;
  gifts.forEach(function (g) {
    if (g.type === "cash") { cashCount++; var c = (g.currency || "USD").toUpperCase(); byCurrency[c] = (byCurrency[c] || 0) + (Number(g.amount) || 0); }
    else kindCount++;
  });
  return { byCurrency: byCurrency, kindCount: kindCount, cashCount: cashCount };
}

function computeProviderStatus(provider) {
  var payments = provider.payments || [];
  var paidByCurrency = {};
  payments.forEach(function (p) {
    var cur = (p.currency || provider.currency || "USD").toUpperCase();
    paidByCurrency[cur] = (paidByCurrency[cur] || 0) + (Number(p.amount) || 0);
  });
  var feeCurrency = (provider.currency || "USD").toUpperCase();
  var amountPaid = paidByCurrency[feeCurrency] || 0;
  var agreedFee = Number(provider.agreedFee) || 0;
  var outstanding = Math.max(0, agreedFee - amountPaid);
  var today = new Date().toISOString().slice(0, 10);
  var deadline = provider.paymentDeadline || null;
  var isOverdue = deadline && deadline < today;
  var daysToDeadline = deadline ? Math.ceil((new Date(deadline) - new Date(today)) / 86400000) : null;
  var status;
  if (agreedFee <= 0) status = "Not Set";
  else if (amountPaid <= 0) status = isOverdue ? "Overdue" : "Not Paid";
  else if (outstanding <= 0) status = "Fully Paid";
  else if (isOverdue) status = "Overdue";
  else if (daysToDeadline != null && daysToDeadline <= 7) status = "Due Soon";
  else status = "Partially Paid";
  return { amountPaid: amountPaid, outstanding: outstanding, status: status };
}

function buildReport(type, data) {
  var guests = data.guests, gifts = data.gifts || [], providers = data.providers || [];
  var columns, rows, filename, title, weights;

  if (type === "rsvp") {
    columns = ["Name", "Phone", "Invited For", "Gender", "RSVP Status", "Invited", "Attending", "Plus-one", "Responded Via", "Responded At"];
    weights = [1.7, 1.3, 1.2, 0.8, 1, 0.7, 0.8, 0.7, 1, 1.1];
    rows = guests.map(function (g) { return [fullName(g), phone(g.phone), g.invitedFor || "", Fields.genderLabel(g.gender), cap(g.rsvpStatus || "pending"), g.invitedCount || 1, g.attendingCount || 0, g.plusOneAllowed ? "Yes" : "No", channelLabel(g), g.rsvpAt ? g.rsvpAt.slice(0, 10) : ""]; });
    filename = "RSVP-Report"; title = "RSVP Report";
  } else if (type === "checkin") {
    columns = ["Guest", "RSVP", "Party", "Checked In", "Method", "Check-in Time"];
    weights = [2, 1, 0.7, 0.9, 1.4, 1.4];
    rows = guests.map(function (g) {
      return [fullName(g), cap(g.rsvpStatus || "pending"), g.attendingCount || g.invitedCount || 1, g.checkedIn ? "Yes" : "No", methodLabel(g), g.checkInTime ? new Date(g.checkInTime).toLocaleString("en-GB", { timeZone: "Africa/Harare" }) : ""];
    });
    filename = "Checkin-Report"; title = "Check-in Report";
  } else if (type === "attending") {
    var attendingGuests = guests.filter(function (g) { return g.rsvpStatus === "attending"; });
    columns = ["Name", "Phone", "Email", "Family", "Invited For", "Gender", "Attending", "Checked In", "Notes"];
    weights = [1.6, 1.3, 1.5, 1.2, 1.1, 0.7, 0.7, 0.8, 1.6];
    rows = attendingGuests.map(function (g) {
      return [fullName(g), phone(g.phone), g.email || "", g.familyName || "", g.invitedFor || "", Fields.genderLabel(g.gender), g.attendingCount || 0, g.checkedIn ? "Yes" : "No", g.notes || ""];
    });
    filename = "Attending-Guest-List"; title = "Attending Guest List";
  } else if (type === "invited") {
    columns = ["Name", "Phone", "Email", "Type", "Family", "Invited For", "Gender", "Invited", "RSVP", "Attending", "Checked In", "Notes"];
    weights = [1.5, 1.2, 1.4, 0.7, 1.1, 1.1, 0.7, 0.6, 0.9, 0.7, 0.7, 1.4];
    rows = guests.map(function (g) {
      return [fullName(g), phone(g.phone), g.email || "", cap(g.invitationType), g.familyName || "", g.invitedFor || "", Fields.genderLabel(g.gender), g.invitedCount || 1, cap(g.rsvpStatus || "pending"), g.attendingCount || 0, g.checkedIn ? "Yes" : "No", g.notes || ""];
    });
    filename = "Invited-Guests"; title = "All Invited Guests";
  } else if (type === "requests") {
    var REQ_STATUS = { pending: "Pending approval", approved: "Approved", declined: "Declined" };
    var byId = {}; guests.forEach(function (g) { byId[g.id] = g; });
    columns = ["Name", "Phone", "Response", "Party", "Message", "Via", "Received", "Status", "Decided", "On Invite List As"];
    weights = [1.5, 1.2, 1, 0.6, 1.8, 0.8, 1, 1, 1, 1.4];
    rows = (data.requests || []).slice().sort(function (a, b) { return (b.createdAt || "").localeCompare(a.createdAt || ""); }).map(function (r) {
      var linked = r.guestId && byId[r.guestId] ? fullName(byId[r.guestId]) : "";
      return [((r.firstName || "") + " " + (r.lastName || "")).trim(), phone(r.phone), cap(r.attend), r.attend === "attending" ? (r.guests || 1) : "", r.message || "", CHANNELS[r.channel] || "", (r.createdAt || "").slice(0, 10), REQ_STATUS[r.status] || r.status, (r.decidedAt || "").slice(0, 10), linked];
    });
    filename = "RSVP-Approval-Requests"; title = "RSVP Approval Requests";
  } else if (type === "gifts") {
    columns = ["Type", "Giver", "Phone", "Date", "Amount", "Currency", "Payment Method", "Description", "Notes"];
    weights = [0.8, 1.4, 1.1, 1, 1, 0.8, 1.2, 1.6, 1.4];
    rows = gifts.map(function (g) {
      return [g.type === "cash" ? "Cash" : "In Kind", g.giver || "", phone(g.giverPhone), g.date || "", g.type === "cash" ? money(g.amount) : (g.estimatedValue != null ? money(g.estimatedValue) : ""), g.type === "cash" ? (g.currency || "") : (g.estimatedValue != null ? (g.estimatedCurrency || "") : ""), g.type === "cash" ? (g.paymentMethod || "") : "", g.description || "", g.notes || ""];
    });
    var totals = computeGiftTotals(gifts);
    filename = "Gifts-Report"; title = "Gift Report";
    var summaryLine = Object.keys(totals.byCurrency).map(function (c) { return c + " " + money(totals.byCurrency[c]); }).join("  ·  ") || "No cash gifts yet";
    return { columns: columns, rows: rows, filename: filename, title: title, weights: weights, subtitle: "Cash totals: " + summaryLine + "   ·   Gifts in kind: " + totals.kindCount };
  } else if (type === "providers") {
    columns = ["Provider", "Category", "Contact", "Agreed Fee", "Currency", "Paid", "Outstanding", "Status", "Deadline"];
    weights = [1.5, 1, 1.3, 1, 0.7, 1, 1, 1, 1];
    rows = providers.map(function (p) {
      var comp = computeProviderStatus(p);
      return [p.name || "", p.category || "", (phone(p.phone) || p.email || ""), money(p.agreedFee), p.currency || "", money(comp.amountPaid), money(comp.outstanding), comp.status, p.paymentDeadline || ""];
    });
    filename = "Service-Providers-Report"; title = "Service Provider Payments";
    var owed = {};
    providers.forEach(function (p) { var cur = (p.currency || "USD").toUpperCase(); owed[cur] = (owed[cur] || 0) + computeProviderStatus(p).outstanding; });
    var owedLine = Object.keys(owed).map(function (c) { return c + " " + money(owed[c]); }).join("  ·  ");
    return { columns: columns, rows: rows, filename: filename, title: title, weights: weights, subtitle: providers.length ? "Outstanding: " + (owedLine || "nothing") : "" };
  } else {
    return null;
  }
  return { columns: columns, rows: rows, filename: filename, title: title, weights: weights };
}

module.exports = async function handler(req, res) {
  if (!requireAuth(req, res)) return;
  var type = req.query.type || "rsvp";
  var format = (req.query.format || "csv").toLowerCase();

  // Excel import templates: ?type=template&for=guests|gifts|providers
  if (type === "template") {
    var spec = TEMPLATES[req.query.for];
    if (!spec) { res.status(400).json({ error: "Unknown template" }); return; }
    var tpl = await buildTemplate(spec);
    res.setHeader("Content-Type", XLSX_TYPE);
    res.setHeader("Content-Disposition", 'attachment; filename="' + spec.file + '"');
    res.status(200).send(tpl);
    return;
  }

  var data = await readData();
  var report = buildReport(type, data);
  if (!report) { res.status(400).json({ error: "Unknown report type" }); return; }

  if (format === "xlsx") {
    var xbuf = await buildReportXlsx({ title: report.title, subtitle: report.subtitle, columns: report.columns, rows: report.rows, sheet: report.title.slice(0, 31) });
    res.setHeader("Content-Type", XLSX_TYPE);
    res.setHeader("Content-Disposition", 'attachment; filename="' + report.filename + '.xlsx"');
    res.status(200).send(xbuf);
    return;
  }

  if (format === "pdf") {
    try {
      var pdfBuffer = await buildReportPdf({ title: report.title, columns: report.columns, rows: report.rows, columnWeights: report.weights, subtitle: report.subtitle, landscape: report.columns.length > 5 });
      res.setHeader("Content-Type", "application/pdf");
      res.setHeader("Content-Disposition", 'attachment; filename="' + report.filename + '.pdf"');
      res.status(200).send(pdfBuffer);
    } catch (e) {
      res.status(500).json({ error: "Could not generate PDF: " + e.message });
    }
    return;
  }

  res.setHeader("Content-Type", "text/csv; charset=utf-8");
  res.setHeader("Content-Disposition", 'attachment; filename="' + report.filename + '.csv"');
  // BOM so Excel opens the file as UTF-8 (names with accents, "·", "–").
  res.status(200).send("﻿" + toCsv([report.columns].concat(report.rows)));
};
