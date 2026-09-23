const { requireAuth } = require("../../lib/auth");
const { readData, writeData, newId } = require("../../lib/blob-store");

const L = require("../../assets/js/guest-fields.js");
const { readRows, parseMoney, normDate } = require("../../lib/import-helpers");

const CURRENCIES = L.CURRENCIES;
const PAYMENT_METHODS = L.PAYMENT_METHODS;
const IMPORT_COLUMNS = ["Type", "Giver", "GiverPhone", "Date", "Amount", "Currency", "PaymentMethod", "Description", "EstimatedValue", "EstimatedCurrency", "Notes"];
// Excel template headers ("Giver *", "Payment Method") and older CSV ones both map here.
const HEADER_ALIASES = {
  type: "Type", gifttype: "Type",
  giver: "Giver", from: "Giver", name: "Giver", givername: "Giver",
  giverphone: "GiverPhone", phone: "GiverPhone",
  date: "Date", datereceived: "Date",
  amount: "Amount", cashamount: "Amount",
  currency: "Currency",
  paymentmethod: "PaymentMethod", method: "PaymentMethod",
  description: "Description", item: "Description",
  estimatedvalue: "EstimatedValue", value: "EstimatedValue",
  estimatedcurrency: "EstimatedCurrency", valuecurrency: "EstimatedCurrency",
  notes: "Notes", note: "Notes",
};

function normName(s) { return String(s || "").trim().toLowerCase().replace(/\s+/g, " "); }

function toGiftDraft(rowObj) {
  // a row with a description but no amount is an in-kind gift even if Type was left blank
  const type = rowObj.Type ? L.normGiftType(rowObj.Type) : (String(rowObj.Description || "").trim() && parseMoney(rowObj.Amount) == null ? "kind" : "cash");
  const draft = {
    type,
    giver: String(rowObj.Giver || "").trim(),
    giverPhone: String(rowObj.GiverPhone || "").trim(),
    date: normDate(rowObj.Date) || new Date().toISOString().slice(0, 10),
    notes: String(rowObj.Notes || "").trim(),
  };
  if (type === "cash") {
    draft.amount = parseMoney(rowObj.Amount) || 0;
    draft.currency = L.normCurrency(rowObj.Currency);
    draft.paymentMethod = L.normPaymentMethod(rowObj.PaymentMethod);
  } else {
    draft.description = String(rowObj.Description || "").trim();
    draft.estimatedValue = parseMoney(rowObj.EstimatedValue);
    draft.estimatedCurrency = L.normCurrency(rowObj.EstimatedCurrency);
  }
  return draft;
}

async function handleImport(req, res) {
  const body = req.body || {};
  const data = await readData();

  if (body.mode === "commit") {
    const rows = Array.isArray(body.rows) ? body.rows : [];
    let created = 0, skipped = 0;
    rows.forEach((r) => {
      if (r.resolution === "skip") { skipped++; return; }
      const draft = toGiftDraft(r.fields || {});
      if (!draft.giver || (draft.type === "kind" && !draft.description)) { skipped++; return; }
      data.gifts.push(Object.assign({ id: newId("gift"), createdAt: new Date().toISOString() }, draft));
      created++;
    });
    await writeData(data);
    res.status(200).json({ ok: true, created, skipped });
    return;
  }

  // preview mode
  const csvText = String(body.csv || "");
  if (!csvText.trim()) { res.status(400).json({ error: "No CSV content provided" }); return; }
  const { header, records } = readRows(csvText, HEADER_ALIASES);
  if (!header.length) { res.status(400).json({ error: "The file appears to be empty" }); return; }

  const preview = records.map((fields) => {
    const draft = toGiftDraft(fields);
    const incomingKey = normName(draft.giver) + "|" + draft.date + "|" + (draft.type === "cash" ? draft.amount + draft.currency : normName(draft.description));
    const duplicate = data.gifts.find((g) => {
      const key = normName(g.giver) + "|" + g.date + "|" + (g.type === "cash" ? g.amount + g.currency : normName(g.description));
      return key === incomingKey;
    });
    return {
      fields,
      draft,
      duplicate: duplicate ? { id: duplicate.id, giver: duplicate.giver } : null,
    };
  });

  const validRows = preview.filter((p) => p.draft.giver && (p.draft.type !== "kind" || p.draft.description));
  const invalidCount = preview.length - validRows.length;

  res.status(200).json({
    columns: IMPORT_COLUMNS,
    totalRows: preview.length,
    invalidRows: invalidCount,
    duplicateCount: preview.filter((p) => p.duplicate).length,
    rows: preview,
  });
}

module.exports = async function handler(req, res) {
  if (!requireAuth(req, res)) return;

  if (req.method === "GET") {
    const data = await readData();
    res.status(200).json({ gifts: data.gifts, currencies: CURRENCIES, paymentMethods: PAYMENT_METHODS });
    return;
  }

  if (req.method === "POST") {
    const body = req.body || {};
    // CSV bulk import shares this endpoint (body.csv for preview, body.mode === "commit" for commit)
    // instead of a separate serverless function, to stay within the Hobby plan's function-count limit.
    if (body.mode === "commit" || typeof body.csv === "string") { await handleImport(req, res); return; }

    const data = await readData();
    const type = body.type === "kind" ? "kind" : "cash";
    const gift = {
      id: newId("gift"),
      type,
      giver: String(body.giver || "").trim(),
      giverPhone: String(body.giverPhone || "").trim(),
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
    const allowed = ["giver", "giverPhone", "date", "notes", "amount", "currency", "paymentMethod", "description", "estimatedValue", "estimatedCurrency"];
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
