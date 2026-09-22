const { requireAuth } = require("../../lib/auth");
const { readData, writeData, newId } = require("../../lib/blob-store");

function occupiedSeats(guests, tableId) {
  return guests
    .filter(function (g) { return g.tableId === tableId; })
    .reduce(function (sum, g) { return sum + (Number(g.attendingCount) || Number(g.invitedCount) || 1); }, 0);
}

module.exports = async function handler(req, res) {
  if (!requireAuth(req, res)) return;

  if (req.method === "GET") {
    var data = await readData();
    res.status(200).json({ tables: data.tables });
    return;
  }

  if (req.method === "POST") {
    var data2 = await readData();
    var body = req.body || {};
    var table = {
      id: newId("table"),
      name: String(body.name || "Table").trim(),
      capacity: Math.max(1, Number(body.capacity) || 8),
      vip: !!body.vip,
      locked: !!body.locked,
    };
    data2.tables.push(table);
    await writeData(data2);
    res.status(201).json({ table: table });
    return;
  }

  if (req.method === "PATCH") {
    var id = req.query.id;
    if (!id) { res.status(400).json({ error: "id is required" }); return; }
    var data3 = await readData();

    // Special action: assign or unassign a guest to this table, enforcing capacity.
    var body3 = req.body || {};
    if (body3.action === "assign" || body3.action === "unassign") {
      var table3 = data3.tables.find(function (t) { return t.id === id; });
      if (!table3) { res.status(404).json({ error: "Table not found" }); return; }
      var guest3 = data3.guests.find(function (g) { return g.id === body3.guestId; });
      if (!guest3) { res.status(404).json({ error: "Guest not found" }); return; }
      if (body3.action === "unassign") {
        if (guest3.tableId === id) guest3.tableId = null;
      } else {
        var partySize = Number(guest3.attendingCount) || Number(guest3.invitedCount) || 1;
        var occ = occupiedSeats(data3.guests, id);
        if (occ + partySize > table3.capacity) {
          res.status(409).json({ error: "Table full" });
          return;
        }
        guest3.tableId = id;
      }
      await writeData(data3);
      res.status(200).json({ table: table3, guest: guest3 });
      return;
    }

    var idx = data3.tables.findIndex(function (t) { return t.id === id; });
    if (idx === -1) { res.status(404).json({ error: "Table not found" }); return; }
    var allowed = ["name", "capacity", "vip", "locked"];
    allowed.forEach(function (k) {
      if (Object.prototype.hasOwnProperty.call(body3, k)) data3.tables[idx][k] = body3[k];
    });
    await writeData(data3);
    res.status(200).json({ table: data3.tables[idx] });
    return;
  }

  if (req.method === "DELETE") {
    var id2 = req.query.id;
    if (!id2) { res.status(400).json({ error: "id is required" }); return; }
    var data4 = await readData();
    data4.tables = data4.tables.filter(function (t) { return t.id !== id2; });
    data4.guests.forEach(function (g) { if (g.tableId === id2) g.tableId = null; });
    await writeData(data4);
    res.status(200).json({ ok: true });
    return;
  }

  res.status(405).json({ error: "Method not allowed" });
};
