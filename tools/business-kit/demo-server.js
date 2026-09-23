// Serves the real site and portal from the project folder, answering their API
// calls with fictional demo data — so marketing screenshots show the product
// working without exposing any real guest's name or phone number.
const http = require("http");
const fs = require("fs");
const path = require("path");

const ROOT = path.join(__dirname, "..", "..");
const TYPES = { ".html": "text/html; charset=utf-8", ".js": "text/javascript", ".css": "text/css", ".png": "image/png", ".jpg": "image/jpeg", ".webp": "image/webp", ".svg": "image/svg+xml", ".ttf": "font/ttf", ".json": "application/json", ".pdf": "application/pdf", ".gif": "image/gif", ".xlsx": "application/octet-stream", ".csv": "text/csv" };

const now = new Date();
const iso = (daysAgo, h) => { const d = new Date(now.getTime() - daysAgo * 86400000); if (h != null) d.setHours(h, 15, 0, 0); return d.toISOString(); };

const G = (id, first, last, phone, extra) => Object.assign({ id, firstName: first, lastName: last, phone, email: "", invitationType: "individual", familyName: "", invitedFor: "", gender: "", invitedCount: 1, plusOneAllowed: false, rsvpStatus: "pending", attendingCount: 0, notes: "", checkedIn: false, checkInTime: null, checkInMethod: "", createdAt: iso(40), rsvpAt: null, rsvpChannel: "" }, extra);
const guests = [
  G("guest_demo", "Tariro", "Moyo", "+263771234567", { invitationType: "couple", familyName: "The Moyo Family", invitedFor: "Groom's Side", gender: "female", invitedCount: 2 }),
  G("g2", "Rudo", "Banda", "+263772110220", { invitedFor: "Bride's Side", gender: "female", rsvpStatus: "attending", attendingCount: 1, rsvpAt: iso(6), rsvpChannel: "web", checkedIn: true, checkInMethod: "self", checkInTime: iso(0, 9) }),
  G("g3", "Tendai", "Mukanga", "+263773220330", { invitationType: "family", familyName: "The Mukanga Family", invitedFor: "Church", gender: "male", invitedCount: 4, rsvpStatus: "attending", attendingCount: 4, rsvpAt: iso(9), rsvpChannel: "whatsapp", checkedIn: true, checkInMethod: "usher", checkInTime: iso(0, 9) }),
  G("g4", "Chipo", "Ndlovu", "+27821112233", { invitedFor: "Mutual Friends", gender: "female", rsvpStatus: "attending", attendingCount: 1, rsvpAt: iso(3), rsvpChannel: "web", checkedIn: true, checkInMethod: "auto", checkInTime: iso(0, 10) }),
  G("g5", "Farai", "Chikomo", "+447911123456", { invitationType: "couple", invitedFor: "Bride's Side", gender: "male", invitedCount: 2, rsvpStatus: "maybe", rsvpAt: iso(2), rsvpChannel: "sms" }),
  G("g6", "Nyarai", "Sibanda", "+263774330440", { invitedFor: "Church", gender: "female", rsvpStatus: "attending", attendingCount: 1, rsvpAt: iso(11), rsvpChannel: "web" }),
  G("g7", "Kudakwashe", "Mhlanga", "+263775440550", { invitedFor: "Groom's Side", gender: "male", rsvpStatus: "not_attending", rsvpAt: iso(5), rsvpChannel: "call" }),
  G("g8", "Ruvimbo", "Dube", "+263776550660", { invitationType: "couple", familyName: "The Dube Family", invitedFor: "Bride's Side", gender: "female", invitedCount: 2, rsvpStatus: "attending", attendingCount: 2, rsvpAt: iso(8), rsvpChannel: "web", checkedIn: true, checkInMethod: "self", checkInTime: iso(0, 9) }),
  G("g9", "Tatenda", "Gumbo", "+263777660770", { invitedFor: "Service Providers", gender: "male" }),
  G("g10", "Rutendo", "Marufu", "+61412345678", { invitedFor: "Mutual Friends", gender: "female", rsvpStatus: "attending", attendingCount: 1, rsvpAt: iso(4), rsvpChannel: "whatsapp" }),
  G("g11", "Simba", "Nyathi", "+263778770880", { invitationType: "family", familyName: "The Nyathi Family", invitedFor: "Groom's Side", gender: "male", invitedCount: 5, rsvpStatus: "attending", attendingCount: 5, rsvpAt: iso(10), rsvpChannel: "web" }),
  G("g12", "Vimbai", "Chari", "+263779880990", { invitedFor: "Church", gender: "female" }),
  G("g13", "Tapiwa", "Mutasa", "+263771990110", { invitedFor: "Bride's Side", gender: "male", rsvpStatus: "attending", attendingCount: 1, rsvpAt: iso(1), rsvpChannel: "admin" }),
  G("g14", "Nokuthula", "Zulu", "+27831234567", { invitationType: "couple", invitedFor: "Mutual Friends", gender: "female", invitedCount: 2 }),
];
const requests = [
  { id: "r1", firstName: "Blessing", lastName: "Mapfumo", phone: "+263772001122", gender: "male", attend: "attending", guests: 2, plusOneName: "Grace Mapfumo", message: "Colleague of the groom from Econet — hope it's okay to bring my wife!", channel: "web", status: "pending", createdAt: iso(1), updatedAt: iso(1) },
  { id: "r2", firstName: "Anesu", lastName: "Kariba", phone: "+263773003344", gender: "female", attend: "attending", guests: 1, message: "Nyasha's cousin on her mother's side", channel: "whatsapp", status: "pending", createdAt: iso(2), updatedAt: iso(2) },
  { id: "r3", firstName: "Tinashe", lastName: "Moyo", phone: "+263774005566", attend: "attending", guests: 1, message: "", channel: "web", status: "approved", guestId: "g13", createdAt: iso(6), updatedAt: iso(6), decidedAt: iso(5) },
  { id: "r4", firstName: "Unknown", lastName: "Guest", phone: "+263779009999", attend: "attending", guests: 3, message: "", channel: "web", status: "declined", createdAt: iso(7), updatedAt: iso(7), decidedAt: iso(6) },
];
const gifts = [
  { id: "gf1", type: "cash", giver: "The Mukanga Family", giverPhone: "+263773220330", date: iso(1).slice(0, 10), amount: 300, currency: "USD", paymentMethod: "EcoCash", notes: "" },
  { id: "gf2", type: "cash", giver: "Farai Chikomo", giverPhone: "+447911123456", date: iso(3).slice(0, 10), amount: 150, currency: "GBP", paymentMethod: "World Remit", notes: "From London" },
  { id: "gf3", type: "cash", giver: "Chipo Ndlovu", giverPhone: "+27821112233", date: iso(2).slice(0, 10), amount: 1500, currency: "ZAR", paymentMethod: "Bank Transfer", notes: "" },
  { id: "gf4", type: "cash", giver: "Rudo Banda", date: iso(0).slice(0, 10), amount: 100, currency: "USD", paymentMethod: "Cash", notes: "" },
  { id: "gf5", type: "kind", giver: "The Dube Family", date: iso(0).slice(0, 10), description: "Dinner set for 12", estimatedValue: 180, estimatedCurrency: "USD", notes: "" },
  { id: "gf6", type: "kind", giver: "Nyarai Sibanda", date: iso(0).slice(0, 10), description: "Blender", estimatedValue: 60, estimatedCurrency: "USD", notes: "" },
];
const providersRaw = [
  { id: "p1", name: "Sunrise Catering Co", category: "Catering", contactName: "Tendai Moyo", phone: "+263772345678", agreedFee: 2400, currency: "USD", paymentDeadline: iso(-30).slice(0, 10), payments: [{ id: "pay1", amount: 1200, currency: "USD", method: "Bank Transfer", date: iso(20).slice(0, 10) }] },
  { id: "p2", name: "Petal & Stem Décor", category: "Décor & Flowers", contactName: "Grace Chari", phone: "+263773456789", agreedFee: 900, currency: "USD", paymentDeadline: iso(-12).slice(0, 10), payments: [{ id: "pay2", amount: 900, currency: "USD", method: "EcoCash", date: iso(10).slice(0, 10) }] },
  { id: "p3", name: "Lens & Light Studios", category: "Photography", contactName: "Kuda Gumbo", phone: "+263774567890", agreedFee: 650, currency: "USD", paymentDeadline: iso(-5).slice(0, 10), payments: [{ id: "pay3", amount: 300, currency: "USD", method: "EcoCash", date: iso(15).slice(0, 10) }] },
  { id: "p4", name: "DJ Tino Sounds", category: "Music / DJ / Band", contactName: "Tino", phone: "+263775678901", agreedFee: 350, currency: "USD", paymentDeadline: iso(3).slice(0, 10), payments: [] },
  { id: "p5", name: "Colne Valley Reserve", category: "Venue", contactName: "Bookings Office", phone: "+263242123456", agreedFee: 1800, currency: "USD", paymentDeadline: iso(-45).slice(0, 10), payments: [{ id: "pay4", amount: 1800, currency: "USD", method: "Bank Transfer", date: iso(30).slice(0, 10) }] },
  { id: "p6", name: "Sweet Layers Cakes", category: "Cake", contactName: "Ruth", phone: "+263776789012", agreedFee: 250, currency: "USD", paymentDeadline: iso(-20).slice(0, 10), payments: [{ id: "pay5", amount: 100, currency: "USD", method: "Cash", date: iso(12).slice(0, 10) }] },
];
function computed(p) {
  const paid = p.payments.reduce((s, x) => s + x.amount, 0);
  const outstanding = Math.max(0, p.agreedFee - paid);
  const today = now.toISOString().slice(0, 10);
  const overdue = p.paymentDeadline && p.paymentDeadline < today;
  const days = p.paymentDeadline ? Math.ceil((new Date(p.paymentDeadline) - new Date(today)) / 86400000) : null;
  let status = paid <= 0 ? (overdue ? "Overdue" : "Not Paid") : outstanding <= 0 ? "Fully Paid" : overdue ? "Overdue" : days != null && days <= 7 ? "Due Soon" : "Partially Paid";
  if (paid <= 0 && !overdue && days != null && days <= 7) status = "Due Soon";
  return Object.assign({}, p, { amountPaid: paid, outstanding, status, paidByCurrency: { USD: paid }, otherCurrencyPaid: [] });
}
const L = require(path.join(ROOT, "assets", "js", "guest-fields.js"));

function api(req, res, url) {
  const send = (obj, code) => { res.writeHead(code || 200, { "Content-Type": "application/json" }); res.end(JSON.stringify(obj)); };
  if (url.pathname === "/api/admin/guests") return send({ guests, categories: L.CATEGORIES, requests });
  if (url.pathname === "/api/admin/gifts") return send({ gifts, currencies: L.CURRENCIES, paymentMethods: L.PAYMENT_METHODS });
  if (url.pathname === "/api/admin/providers") return send({ providers: providersRaw.map(computed), currencies: L.CURRENCIES, paymentMethods: L.PAYMENT_METHODS });
  if (url.pathname === "/api/rsvp") {
    const g = guests.find((x) => x.id === url.searchParams.get("token"));
    if (!g) return send({ found: false });
    return send({ found: true, guestId: g.id, firstName: g.firstName, lastName: g.lastName, invitedCount: g.invitedCount, plusOneAllowed: g.plusOneAllowed, rsvpStatus: g.rsvpStatus, attendingCount: g.attendingCount, plusOneName: "", gender: g.gender, rsvpAt: g.rsvpAt, checkedIn: g.checkedIn });
  }
  if (url.pathname === "/api/checkin") {
    const g = guests.find((x) => x.id === url.searchParams.get("token"));
    return send(g ? { found: true, firstName: g.firstName, checkedIn: g.checkedIn, rsvpStatus: g.rsvpStatus } : { found: false });
  }
  return send({ ok: true });
}

function start(port) {
  const server = http.createServer((req, res) => {
    const url = new URL(req.url, "http://localhost");
    if (url.pathname.startsWith("/api/")) return api(req, res, url);
    let p = decodeURIComponent(url.pathname);
    if (p === "/" || p === "") p = "/index.html";
    if (p === "/admin" || p === "/admin/") p = "/admin/index.html";
    let file = path.join(ROOT, p);
    if (!file.startsWith(ROOT)) { res.writeHead(403); return res.end(); }
    if (!path.extname(file) && fs.existsSync(file + ".html")) file += ".html";
    fs.readFile(file, (err, buf) => {
      if (err) { res.writeHead(404); return res.end("not found"); }
      res.writeHead(200, { "Content-Type": TYPES[path.extname(file).toLowerCase()] || "application/octet-stream" });
      res.end(buf);
    });
  });
  return new Promise((resolve) => server.listen(port, "127.0.0.1", () => resolve(server)));
}

module.exports = { start };
