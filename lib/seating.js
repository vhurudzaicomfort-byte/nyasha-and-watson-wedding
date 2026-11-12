// Seating rules shared by the tables, guests and import APIs and the exports.
// Seats a guest needs: their confirmed number once they've said yes, nothing once
// they've declined, otherwise the number on their invitation (so a table is never
// planned beyond capacity while RSVPs are still coming in).
function seatsFor(g) {
  if (g.rsvpStatus === "not_attending") return 0;
  if (g.rsvpStatus === "attending") return Math.max(1, Number(g.attendingCount) || Number(g.invitedCount) || 1);
  return Math.max(1, Number(g.invitedCount) || 1);
}

function occupied(guests, tableId, exceptGuestId) {
  return guests.reduce(function (sum, g) {
    return g.tableId === tableId && g.id !== exceptGuestId && !g.removedAt ? sum + seatsFor(g) : sum;
  }, 0);
}

// "Table 5", "table 05", "5", "T5" all mean the same table; named tables
// ("Top Table", "Bridal Party") match on their name.
function tableKey(name) {
  var s = String(name == null ? "" : name).trim().toLowerCase().replace(/\s+/g, " ");
  var m = s.match(/^(?:table|tbl|t)?\s*#?\s*0*(\d+)$/);
  return m ? "n" + m[1] : s.replace(/[^a-z0-9]/g, "");
}
function findTable(tables, name) {
  var k = tableKey(name);
  if (!k) return null;
  return tables.find(function (t) { return tableKey(t.name) === k; }) || null;
}
function displayName(name) {
  var s = String(name == null ? "" : name).trim();
  return /^\d+$/.test(s) ? "Table " + Number(s) : s;
}
// natural order: Table 2 before Table 10, named tables first
function compareTables(a, b) {
  var ka = tableKey(a.name), kb = tableKey(b.name);
  var na = ka.charAt(0) === "n" && /^\d+$/.test(ka.slice(1)), nb = kb.charAt(0) === "n" && /^\d+$/.test(kb.slice(1));
  if (na && nb) return Number(ka.slice(1)) - Number(kb.slice(1));
  if (na !== nb) return na ? 1 : -1;
  return String(a.name).localeCompare(String(b.name));
}

function tableSummaries(data) {
  return data.tables.slice().sort(compareTables).map(function (t) {
    var seated = data.guests.filter(function (g) { return g.tableId === t.id && !g.removedAt; });
    var used = seated.reduce(function (s, g) { return s + seatsFor(g); }, 0);
    return Object.assign({}, t, { seatsUsed: used, guestCount: seated.length, over: used > t.capacity });
  });
}

module.exports = { seatsFor, occupied, tableKey, findTable, displayName, compareTables, tableSummaries };
