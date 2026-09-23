const { requireAuth } = require("../../lib/auth");
const { readData, writeData, newId } = require("../../lib/blob-store");

const L = require("../../assets/js/guest-fields.js");
const { readRows, parseMoney, normDate } = require("../../lib/import-helpers");

const CURRENCIES = L.CURRENCIES;
const PAYMENT_METHODS = L.PAYMENT_METHODS;
const DUE_SOON_DAYS = 7;
const IMPORT_COLUMNS = ["Name", "Category", "ContactName", "Phone", "Email", "AgreedFee", "Currency", "PaymentDeadline", "Notes"];
// Excel template headers ("Provider Name *", "Agreed Fee") and older CSV ones both map here.
const HEADER_ALIASES = {
  name: "Name", providername: "Name", provider: "Name", supplier: "Name", company: "Name",
  category: "Category", service: "Category", type: "Category",
  contactname: "ContactName", contactperson: "ContactName", contact: "ContactName",
  phone: "Phone", phonenumber: "Phone", mobile: "Phone",
  email: "Email", emailaddress: "Email",
  agreedfee: "AgreedFee", fee: "AgreedFee", amount: "AgreedFee", price: "AgreedFee", quote: "AgreedFee",
  currency: "Currency",
  paymentdeadline: "PaymentDeadline", deadline: "PaymentDeadline", duedate: "PaymentDeadline",
  notes: "Notes", note: "Notes",
};

function computeStatus(provider) {
  const payments = provider.payments || [];
  const paidByCurrency = {};
  payments.forEach((p) => {
    const cur = (p.currency || provider.currency || "USD").toUpperCase();
    paidByCurrency[cur] = (paidByCurrency[cur] || 0) + (Number(p.amount) || 0);
  });
  const feeCurrency = (provider.currency || "USD").toUpperCase();
  const amountPaid = paidByCurrency[feeCurrency] || 0;
  const agreedFee = Number(provider.agreedFee) || 0;
  const outstanding = Math.max(0, agreedFee - amountPaid);
  const otherCurrencyPaid = Object.keys(paidByCurrency).filter((c) => c !== feeCurrency);

  let status;
  const today = new Date().toISOString().slice(0, 10);
  const deadline = provider.paymentDeadline || null;
  const isOverdue = deadline && deadline < today;
  const daysToDeadline = deadline ? Math.ceil((new Date(deadline) - new Date(today)) / 86400000) : null;

  if (agreedFee <= 0) {
    status = "Not Set";
  } else if (amountPaid <= 0) {
    status = isOverdue ? "Overdue" : "Not Paid";
  } else if (outstanding <= 0) {
    status = "Fully Paid";
  } else if (isOverdue) {
    status = "Overdue";
  } else if (daysToDeadline != null && daysToDeadline <= DUE_SOON_DAYS) {
    status = "Due Soon";
  } else {
    status = "Partially Paid";
  }

  return { amountPaid, outstanding, status, paidByCurrency, otherCurrencyPaid };
}

function withComputed(provider) {
  return Object.assign({}, provider, computeStatus(provider));
}

function normPhone(s) { return String(s || "").replace(/[^\d]/g, ""); }
function normName(s) { return String(s || "").trim().toLowerCase().replace(/\s+/g, " "); }

function toProviderDraft(rowObj) {
  return {
    name: String(rowObj.Name || "").trim(),
    category: L.normProviderCategory(rowObj.Category),
    contactName: String(rowObj.ContactName || "").trim(),
    phone: String(rowObj.Phone || "").trim(),
    email: String(rowObj.Email || "").trim(),
    agreedFee: parseMoney(rowObj.AgreedFee) || 0,
    currency: L.normCurrency(rowObj.Currency),
    paymentDeadline: normDate(rowObj.PaymentDeadline) || null,
    notes: String(rowObj.Notes || "").trim(),
  };
}

async function handleImport(req, res) {
  const body = req.body || {};
  const data = await readData();

  if (body.mode === "commit") {
    const rows = Array.isArray(body.rows) ? body.rows : [];
    let created = 0, updated = 0, skipped = 0;
    rows.forEach((r) => {
      if (r.resolution === "skip") { skipped++; return; }
      const draft = toProviderDraft(r.fields || {});
      if (!draft.name) { skipped++; return; }
      if (r.resolution === "update" && r.targetId) {
        const existing = data.providers.find((p) => p.id === r.targetId);
        if (existing) {
          // Contract/contact details only — never touch payments already recorded.
          Object.assign(existing, draft);
          updated++;
          return;
        }
      }
      data.providers.push(Object.assign({ id: newId("provider"), payments: [], createdAt: new Date().toISOString() }, draft));
      created++;
    });
    await writeData(data);
    res.status(200).json({ ok: true, created, updated, skipped });
    return;
  }

  // preview mode
  const csvText = String(body.csv || "");
  if (!csvText.trim()) { res.status(400).json({ error: "No CSV content provided" }); return; }
  const { header, records } = readRows(csvText, HEADER_ALIASES);
  if (!header.length) { res.status(400).json({ error: "The file appears to be empty" }); return; }

  const preview = records.map((fields) => {
    const draft = toProviderDraft(fields);
    const incomingPhone = normPhone(draft.phone);
    const incomingName = normName(draft.name);
    let duplicate = null;
    if (incomingPhone) {
      duplicate = data.providers.find((p) => p.phone && normPhone(p.phone) === incomingPhone);
    }
    if (!duplicate && incomingName) {
      duplicate = data.providers.find((p) => normName(p.name) === incomingName);
    }
    return {
      fields,
      draft,
      duplicate: duplicate ? { id: duplicate.id, name: duplicate.name, phone: duplicate.phone } : null,
    };
  });

  const validRows = preview.filter((p) => p.draft.name);
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
    res.status(200).json({ providers: data.providers.map(withComputed), currencies: CURRENCIES, paymentMethods: PAYMENT_METHODS });
    return;
  }

  if (req.method === "POST") {
    const body = req.body || {};
    // CSV bulk import shares this endpoint (body.csv for preview, body.mode === "commit" for commit)
    // instead of a separate serverless function, to stay within the Hobby plan's function-count limit.
    if (body.mode === "commit" || typeof body.csv === "string") { await handleImport(req, res); return; }

    const data = await readData();
    const provider = {
      id: newId("provider"),
      name: String(body.name || "").trim(),
      category: String(body.category || "").trim(),
      contactName: String(body.contactName || "").trim(),
      phone: String(body.phone || "").trim(),
      email: String(body.email || "").trim(),
      agreedFee: Number(body.agreedFee) || 0,
      currency: String(body.currency || "USD").trim().toUpperCase(),
      paymentDeadline: body.paymentDeadline || null,
      notes: String(body.notes || "").trim(),
      payments: [],
      createdAt: new Date().toISOString(),
    };
    if (!provider.name) { res.status(400).json({ error: "Provider name is required" }); return; }
    data.providers.push(provider);
    await writeData(data);
    res.status(201).json({ provider: withComputed(provider) });
    return;
  }

  if (req.method === "PATCH") {
    const id = req.query.id;
    if (!id) { res.status(400).json({ error: "id is required" }); return; }
    const data = await readData();
    const provider = data.providers.find((p) => p.id === id);
    if (!provider) { res.status(404).json({ error: "Provider not found" }); return; }
    const body = req.body || {};

    if (body.action === "add-payment") {
      const payment = {
        id: newId("payment"),
        date: body.date || new Date().toISOString().slice(0, 10),
        amount: Number(body.amount) || 0,
        currency: String(body.currency || provider.currency || "USD").trim().toUpperCase(),
        method: String(body.method || "Cash").trim(),
        notes: String(body.notes || "").trim(),
      };
      if (payment.amount <= 0) { res.status(400).json({ error: "Payment amount must be greater than zero" }); return; }
      provider.payments = provider.payments || [];
      provider.payments.push(payment);
      await writeData(data);
      res.status(200).json({ provider: withComputed(provider) });
      return;
    }

    if (body.action === "delete-payment") {
      provider.payments = (provider.payments || []).filter((p) => p.id !== body.paymentId);
      await writeData(data);
      res.status(200).json({ provider: withComputed(provider) });
      return;
    }

    const allowed = ["name", "category", "contactName", "phone", "email", "agreedFee", "currency", "paymentDeadline", "notes"];
    allowed.forEach((k) => { if (Object.prototype.hasOwnProperty.call(body, k)) provider[k] = body[k]; });
    await writeData(data);
    res.status(200).json({ provider: withComputed(provider) });
    return;
  }

  if (req.method === "DELETE") {
    const id = req.query.id;
    if (!id) { res.status(400).json({ error: "id is required" }); return; }
    const data = await readData();
    data.providers = data.providers.filter((p) => p.id !== id);
    await writeData(data);
    res.status(200).json({ ok: true });
    return;
  }

  res.status(405).json({ error: "Method not allowed" });
};
