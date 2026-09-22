const { requireAuth } = require("../../lib/auth");
const { readData, writeData, newId } = require("../../lib/blob-store");

const CURRENCIES = ["USD", "ZWG", "ZAR", "GBP", "EUR"];
const PAYMENT_METHODS = ["EcoCash", "Bank Transfer", "Cash", "Other"];

module.exports = async function handler(req, res) {
  if (!requireAuth(req, res)) return;

  if (req.method === "GET") {
    const data = await readData();
    res.status(200).json({ gifts: data.gifts, currencies: CURRENCIES, paymentMethods: PAYMENT_METHODS });
    return;
  }

  if (req.method === "POST") {
    const data = await readData();
    const body = req.body || {};
    const type = body.type === "kind" ? "kind" : "cash";
    const gift = {
      id: newId("gift"),
      type,
      giver: String(body.giver || "").trim(),
      date: body.date || new Date().toISOString().slice(0, 10),
      notes: String(body.notes || "").trim(),
      createdAt: new Date().toISOString(),
    };
    if (type === "cash") {
      gift.amount = Number(body.amount) || 0;
      gift.currency = String(body.currency || "USD").trim().toUpperCase();
      gift.paymentMethod = String(body.paymentMethod || "Cash").trim();
    } else {
      gift.description = String(body.description || "").trim();
      gift.estimatedValue = body.estimatedValue !== "" && body.estimatedValue != null ? Number(body.estimatedValue) : null;
      gift.estimatedCurrency = String(body.estimatedCurrency || "USD").trim().toUpperCase();
    }
    if (!gift.giver) { res.status(400).json({ error: "Gift giver is required" }); return; }
    if (type === "kind" && !gift.description) { res.status(400).json({ error: "A description is required for a gift in kind" }); return; }
    data.gifts.push(gift);
    await writeData(data);
    res.status(201).json({ gift });
    return;
  }

  if (req.method === "PATCH") {
    const id = req.query.id;
    if (!id) { res.status(400).json({ error: "id is required" }); return; }
    const data = await readData();
    const idx = data.gifts.findIndex((g) => g.id === id);
    if (idx === -1) { res.status(404).json({ error: "Gift not found" }); return; }
    const patch = req.body || {};
    const allowed = ["giver", "date", "notes", "amount", "currency", "paymentMethod", "description", "estimatedValue", "estimatedCurrency"];
    allowed.forEach((k) => { if (Object.prototype.hasOwnProperty.call(patch, k)) data.gifts[idx][k] = patch[k]; });
    await writeData(data);
    res.status(200).json({ gift: data.gifts[idx] });
    return;
  }

  if (req.method === "DELETE") {
    const id = req.query.id;
    if (!id) { res.status(400).json({ error: "id is required" }); return; }
    const data = await readData();
    data.gifts = data.gifts.filter((g) => g.id !== id);
    await writeData(data);
    res.status(200).json({ ok: true });
    return;
  }

  res.status(405).json({ error: "Method not allowed" });
};
