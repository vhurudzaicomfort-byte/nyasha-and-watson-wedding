// Tables & seating.
//   GET                                   -> tables with seats used
//   POST { name, capacity, notes }        -> add a table
//   POST { action: "bulk", count, capacity, start } -> add numbered tables (Table <start>…)
//   PATCH ?id { name, capacity, notes }   -> edit (capacity can't drop below the seats in use)
//   PATCH ?id { action: "assign"|"unassign", guestId } -> seat / unseat a guest (capacity enforced)
//   DELETE ?id                            -> remove the table; its guests become unseated
const { requireAuth } = require("../../lib/auth");
const { readData, writeData, newId } = require("../../lib/blob-store");
const Seat = require("../../lib/seating");

function cleanCapacity(v, fallback) { var n = Math.round(Number(v)); return n >= 1 && n <= 100 ? n : fallback; }

module.exports = async function handler(req, res) {
  if (!requireAuth(req, res)) return;
  var body = req.body || {};

  if (req.method === "GET") {
    var d0 = await readData();
    res.status(200).json({ tables: Seat.tableSummaries(d0) });
    return;
  }

  if (req.method === "POST") {
    var d1 = await readData();
    if (body.action === "bulk") {
      var count = Math.max(1, Math.min(60, Math.round(Number(body.count)) || 0));
      var cap = cleanCapacity(body.capacity, 10);
      var start = Math.max(1, Math.round(Number(body.start)) || 1);
      var added = [], skipped = [];
      for (var n = start; n < start + count; n++) {
        var nm = "Table " + n;
        if (Seat.findTable(d1.tables, nm)) { skipped.push(nm); continue; }
        var t = { id: newId("table"), name: nm, capacity: cap, notes: "", createdAt: new Date().toISOString() };
        d1.tables.push(t); added.push(t);
      }
      await writeData(d1);
      res.status(201).json({ added: added.length, skipped: skipped, tables: Seat.tableSummaries(d1) });
      return;
    }
    var name = Seat.displayName(body.name);
    if (!name) { res.status(400).json({ error: "Give the table a name or number" }); return; }
    if (Seat.findTable(d1.tables, name)) { res.status(409).json({ error: name + " already exists" }); return; }
    var table = { id: newId("table"), name: name, capacity: cleanCapacity(body.capacity, 10), notes: String(body.notes || "").trim(), createdAt: new Date().toISOString() };
    d1.tables.push(table);
    await writeData(d1);
    res.status(201).json({ table: table });
    return;
  }

  if (req.method === "PATCH") {
    var id = req.query.id;
    if (!id) { res.status(400).json({ error: "id is required" }); return; }
    var d2 = await readData();
    var tb = d2.tables.find(function (t) { return t.id === id; });
    if (!tb) { res.status(404).json({ error: "Table not found" }); return; }

    if (body.action === "assign" || body.action === "unassign") {
      var guest = d2.guests.find(function (g) { return g.id === body.guestId; });
      if (!guest) { res.status(404).json({ error: "Guest not found" }); return; }
      if (body.action === "unassign") {
        if (guest.tableId === id) guest.tableId = null;
      } else {
        var need = Seat.seatsFor(guest), used = Seat.occupied(d2.guests, id, guest.id);
        if (used + need > tb.capacity) {
          res.status(409).json({ error: tb.name + " has " + Math.max(0, tb.capacity - used) + " seat(s) left — " + ((guest.firstName || "") + " " + (guest.lastName || "")).trim() + " needs " + need });
          return;
        }
        guest.tableId = id;
      }
      await writeData(d2);
      res.status(200).json({ guest: guest, tables: Seat.tableSummaries(d2) });
      return;
    }

    if ("name" in body) {
      var nn = Seat.displayName(body.name);
      if (!nn) { res.status(400).json({ error: "Give the table a name or number" }); return; }
      var clash = Seat.findTable(d2.tables, nn);
      if (clash && clash.id !== id) { res.status(409).json({ error: nn + " already exists" }); return; }
      tb.name = nn;
    }
    if ("capacity" in body) {
      var c = cleanCapacity(body.capacity, tb.capacity), inUse = Seat.occupied(d2.guests, id);
      if (c < inUse) { res.status(409).json({ error: tb.name + " already seats " + inUse + " — move some guests before lowering the capacity" }); return; }
      tb.capacity = c;
    }
    if ("notes" in body) tb.notes = String(body.notes || "").trim();
    await writeData(d2);
    res.status(200).json({ table: tb, tables: Seat.tableSummaries(d2) });
    return;
  }

  if (req.method === "DELETE") {
    var id2 = req.query.id;
    if (!id2) { res.status(400).json({ error: "id is required" }); return; }
    var d3 = await readData();
    d3.tables = d3.tables.filter(function (t) { return t.id !== id2; });
    d3.guests.forEach(function (g) { if (g.tableId === id2) g.tableId = null; });
    await writeData(d3);
    res.status(200).json({ ok: true, tables: Seat.tableSummaries(d3) });
    return;
  }

  res.status(405).json({ error: "Method not allowed" });
};
