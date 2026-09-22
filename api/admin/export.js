const { requireAuth } = require("../../lib/auth");
const { readData } = require("../../lib/blob-store");

function toCsv(rows) {
  return rows.map(function (r) {
    return r.map(function (cell) {
      var s = String(cell == null ? "" : cell).replace(/"/g, '""');
      return /[",\n]/.test(s) ? '"' + s + '"' : s;
    }).join(",");
  }).join("\r\n");
}
function fullName(g) { return ((g.firstName || "") + " " + (g.lastName || "")).trim() || "(unnamed guest)"; }

module.exports = async function handler(req, res) {
  if (!requireAuth(req, res)) return;
  var type = req.query.type || "rsvp";
  var data = await readData();
  var guests = data.guests, tables = data.tables;
  var rows, filename;

  if (type === "rsvp") {
    rows = [["Name", "Phone", "Invitation Type", "RSVP Status", "Invited", "Attending", "Plus-one Allowed", "Responded At"]];
    guests.forEach(function (g) {
      rows.push([fullName(g), g.phone || "", g.invitationType || "", g.rsvpStatus || "pending", g.invitedCount || 1, g.attendingCount || 0, g.plusOneAllowed ? "Yes" : "No", g.rsvpAt || ""]);
    });
    filename = "RSVP-Report.csv";
  } else if (type === "seating") {
    rows = [["Table", "Capacity", "VIP", "Guest", "Party Size"]];
    tables.forEach(function (t) {
      var seated = guests.filter(function (g) { return g.tableId === t.id; });
      if (!seated.length) rows.push([t.name, t.capacity, t.vip ? "Yes" : "No", "", ""]);
      seated.forEach(function (g) { rows.push([t.name, t.capacity, t.vip ? "Yes" : "No", fullName(g), g.attendingCount || g.invitedCount || 1]); });
    });
    filename = "Seating-Report.csv";
  } else if (type === "dietary") {
    rows = [["Guest", "Table", "Dietary Requirements"]];
    guests.forEach(function (g) {
      if (g.dietary) {
        var t = tables.find(function (x) { return x.id === g.tableId; });
        rows.push([fullName(g), t ? t.name : "", g.dietary]);
      }
    });
    filename = "Dietary-Report.csv";
  } else if (type === "checkin") {
    rows = [["Guest", "Table", "Checked In", "Check-in Time"]];
    guests.forEach(function (g) {
      var t = tables.find(function (x) { return x.id === g.tableId; });
      rows.push([fullName(g), t ? t.name : "", g.checkedIn ? "Yes" : "No", g.checkInTime || ""]);
    });
    filename = "Checkin-Report.csv";
  } else {
    res.status(400).json({ error: "Unknown report type" });
    return;
  }

  res.setHeader("Content-Type", "text/csv; charset=utf-8");
  res.setHeader("Content-Disposition", 'attachment; filename="' + filename + '"');
  res.status(200).send(toCsv(rows));
};
