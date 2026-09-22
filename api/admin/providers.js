const { requireAuth } = require("../../lib/auth");
const { readData, writeData, newId } = require("../../lib/blob-store");

const CURRENCIES = ["USD", "ZWG", "ZAR", "GBP", "EUR"];
const PAYMENT_METHODS = ["EcoCash", "Bank Transfer", "Cash", "Other"];
const DUE_SOON_DAYS = 7;

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

module.exports = async function handler(req, res) {
  if (!requireAuth(req, res)) return;

  if (req.method === "GET") {
    const data = await readData();
    res.status(200).json({ providers: data.providers.map(withComputed), currencies: CURRENCIES, paymentMethods: PAYMENT_METHODS });
    return;
  }

  if (req.method === "POST") {
    const data = await readData();
    const body = req.body || {};
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
