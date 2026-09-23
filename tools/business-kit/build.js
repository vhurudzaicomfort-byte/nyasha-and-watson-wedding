// Builds the business kit into /business-kit:
//   screenshots/  real screens (demo data) at phone, tablet and desktop sizes
//   mockups/      device mockups and multi-device suites
//   whatsapp/     pitch messages + portrait images sized for WhatsApp
//   Event-Desk-Catalogue.docx
// Run from /tools:  npm run business-kit
const path = require("path");
const fs = require("fs");
const sharp = require("sharp");
const D = require("docx");
const C = require("./catalogue");
const M = require("./mockups");
const { start } = require("./demo-server");
const { capture } = require("./capture");

const ROOT = path.join(__dirname, "..", "..");
const OUT = path.join(ROOT, "business-kit");
const SHOTS = path.join(OUT, "screenshots"), MOCK = path.join(OUT, "mockups"), WA = path.join(OUT, "whatsapp");
const SITE_URL = "nyasha-watson.e-guests.com";
const PLUM = "5A2A55", GOLD = "A57C35", INK = "1E1B22", MUTED = "67626B";

const shot = (n) => path.join(SHOTS, n + ".png");
async function jpg(buf, file, width, bg) {
  await sharp(buf).flatten({ background: bg || "#FBF7F0" }).resize({ width, withoutEnlargement: true }).jpeg({ quality: 86, mozjpeg: true }).toFile(file);
  return file;
}

// ---------------------------------------------------------------- mockups
async function buildMockups() {
  fs.mkdirSync(MOCK, { recursive: true });
  const m = {};
  const ph = async (n) => (m[n] = await M.phone(shot(n)));
  const tb = async (n) => (m[n] = await M.tablet(shot(n)));
  const br = async (n, url) => (m[n] = await M.browser(shot(n), url));
  for (const n of ["site-phone-cover", "site-phone-home", "site-phone-rsvp", "site-phone-card", "site-phone-programme", "portal-phone-dashboard", "portal-phone-checkin"]) await ph(n);
  for (const n of ["site-tablet-home", "site-tablet-lovenote", "site-tablet-card", "portal-tablet-dashboard", "portal-tablet-guests"]) await tb(n);
  for (const n of ["site-desktop-cover", "site-desktop-home", "site-desktop-card", "site-desktop-rsvp"]) await br(n, SITE_URL);
  for (const n of ["portal-desktop-dashboard", "portal-desktop-guests", "portal-desktop-approvals", "portal-desktop-gifts", "portal-desktop-providers", "portal-desktop-reports", "portal-desktop-badge"]) await br(n, SITE_URL + "/admin");
  for (const [n, buf] of Object.entries(m)) fs.writeFileSync(path.join(MOCK, n + ".png"), buf);

  m.suiteSite = await M.suite(m["site-desktop-home"], m["site-tablet-lovenote"], m["site-phone-rsvp"], {});
  m.suitePortal = await M.suite(m["portal-desktop-dashboard"], m["portal-tablet-guests"], m["portal-phone-checkin"], { from: "#F6F1F5", to: "#E7DCE5" });
  m.phonesGuest = await M.phoneRow([m["site-phone-cover"], m["site-phone-rsvp"], m["site-phone-card"]], {});
  m.phonesDay = await M.phoneRow([m["site-phone-programme"], m["portal-phone-checkin"], m["portal-phone-dashboard"]], { from: "#F6F1F5", to: "#E7DCE5" });
  for (const n of ["suiteSite", "suitePortal", "phonesGuest", "phonesDay"]) await jpg(m[n], path.join(MOCK, n + ".jpg"), 2400);
  // transparent versions for the WhatsApp cards, so devices sit directly on the card background
  m.clear = {
    suiteSite: await M.suite(m["site-desktop-home"], m["site-tablet-lovenote"], m["site-phone-rsvp"], { transparent: true }),
    suitePortal: await M.suite(m["portal-desktop-dashboard"], m["portal-tablet-guests"], m["portal-phone-checkin"], { transparent: true }),
    phonesGuest: await M.phoneRow([m["site-phone-cover"], m["site-phone-rsvp"], m["site-phone-card"]], { transparent: true }),
    phonesDay: await M.phoneRow([m["site-phone-programme"], m["portal-phone-checkin"], m["portal-phone-dashboard"]], { transparent: true }),
  };
  console.log("  mockups done");
  return m;
}

// ---------------------------------------------------------------- whatsapp
function waText() {
  const live = C.FEATURES.flatMap((g) => g.items.filter((i) => i[2] === "live").map((i) => i[0]));
  const short = [
    "*" + C.BRAND + "* — digital event management for Zimbabwe and the diaspora",
    "",
    "We run your event's invitations, RSVPs, guest list, check-in, gifts and supplier payments — all from one link and one dashboard.",
    "",
    "*What your guests get*",
    "• A beautiful event website with their own personal invitation link",
    "• An interactive invitation card — tap to RSVP, tap for directions",
    "• RSVP in seconds online, or by WhatsApp, SMS or a call",
    "• A QR pass and self check-in at the gate",
    "",
    "*What you get*",
    "• A live dashboard: who's coming, headcount, gifts and money owed",
    "• Guest lists imported from Excel, duplicates caught automatically",
    "• Uninvited replies held for your approval",
    "• A gift register in USD, ZWG, ZAR, GBP and EUR",
    "• Supplier payments tracked — nothing overdue by surprise",
    "• Branded Excel and PDF reports",
    "",
    "*For every kind of event*",
    "Weddings · Lobola & roora · Kitchen parties · Corporate events & trainings · Church gatherings · Birthdays & milestones · Memorials · Galas & fundraisers · Reunions · Festivals & expos",
    "",
    "*Packages from $30 per event* — or a monthly licence for planners.",
    "",
    "See a live example: https://" + SITE_URL,
    "",
    "Reply *DEMO* and we'll walk you through it.",
  ].join("\n");

  const lines = ["*" + C.BRAND + " — full service catalogue*", "_" + C.TAGLINE + "_", "", "*How it works*"];
  C.JOURNEY.forEach(([k, v], i) => lines.push((i + 1) + ". *" + k + "* — " + v));
  lines.push("", "*Available now* (" + live.length + " features)");
  C.FEATURES.forEach((g) => {
    const items = g.items.filter((i) => i[2] === "live");
    if (!items.length) return;
    lines.push("", "_" + g.group + "_");
    items.forEach((i) => lines.push("• *" + i[0] + "* — " + i[1]));
  });
  lines.push("", "*Coming next*");
  C.FEATURES.forEach((g) => g.items.filter((i) => i[2] === "next").forEach((i) => lines.push("• " + i[0])));
  lines.push("", "*Events we serve*");
  C.EVENTS.forEach(([name, kinds]) => lines.push("• *" + name + "* — " + kinds));
  lines.push("", "*Packages*");
  C.PACKAGES.forEach(([name, forWho, price]) => lines.push("• *" + name + "* (" + forWho + "): " + price));
  lines.push("", "*Add-ons*");
  C.ADDONS.forEach(([name, price]) => lines.push("• " + name + " — " + price));
  lines.push("", "Live example: https://" + SITE_URL, "Reply *DEMO* for a walkthrough.");
  return { short, full: lines.join("\n") };
}

async function promo(file, opts) {
  // 1080 x 1350 portrait card: brand, headline, subline, device image, footer strip
  const W = 1080, H = 1350;
  const img = await sharp(opts.image).resize({ width: opts.imgWidth || 1000, height: opts.imgHeight || 800, fit: "inside" }).png().toBuffer();
  const im = await sharp(img).metadata();
  const esc = (s) => String(s).replace(/&/g, "&amp;").replace(/</g, "&lt;");
  const head = opts.headline.map((l, i) => '<text x="80" y="' + (250 + i * 82) + '" font-family="Bodoni Moda 28pt" font-weight="600" font-size="70" fill="#3E1730">' + esc(l) + "</text>").join("");
  const svg = '<svg xmlns="http://www.w3.org/2000/svg" width="' + W + '" height="' + H + '"><defs><linearGradient id="g" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#FBF7F0"/><stop offset="1" stop-color="' + (opts.to || "#EFE3D2") + '"/></linearGradient></defs>' +
    '<rect width="100%" height="100%" fill="url(#g)"/>' +
    '<text x="80" y="118" font-family="Poppins" font-weight="600" font-size="26" letter-spacing="6" fill="#A57C35">' + esc(C.BRAND.toUpperCase()) + "</text>" +
    '<rect x="80" y="140" width="64" height="3" fill="#A57C35"/>' + head +
    '<text x="80" y="' + (250 + opts.headline.length * 82 + 8) + '" font-family="Poppins" font-size="30" fill="#67626B">' + esc(opts.sub) + "</text>" +
    '<image href="' + M.dataUri(img) + '" x="' + Math.round((W - im.width) / 2) + '" y="' + (H - 150 - im.height) + '" width="' + im.width + '" height="' + im.height + '"/>' +
    '<rect x="0" y="' + (H - 110) + '" width="' + W + '" height="110" fill="#3E1730"/>' +
    '<text x="' + W / 2 + '" y="' + (H - 48) + '" font-family="Poppins" font-weight="500" font-size="25" fill="#F3E6D2" text-anchor="middle">' + esc(opts.footer || "Weddings · Lobola · Corporate · Church · Parties · Memorials") + "</text>" +
    "</svg>";
  await sharp(M.render(svg)).jpeg({ quality: 88, mozjpeg: true }).toFile(file);
}

async function buildWhatsApp(m) {
  fs.mkdirSync(WA, { recursive: true });
  const t = waText();
  fs.writeFileSync(path.join(WA, "1-WhatsApp-Pitch.txt"), t.short);
  fs.writeFileSync(path.join(WA, "2-WhatsApp-Full-Catalogue.txt"), t.full);
  await promo(path.join(WA, "01-Every-event.jpg"), { headline: ["Your whole event,", "beautifully", "organised."], sub: "Invitations, RSVPs, check-in, gifts and payments.", image: m.clear.suiteSite, imgWidth: 1000, imgHeight: 640 });
  await promo(path.join(WA, "02-Invitations.jpg"), { headline: ["Invitations your", "guests will love."], sub: "Personal links · interactive cards · RSVP in seconds", image: m.clear.phonesGuest, imgWidth: 1040, imgHeight: 780 });
  await promo(path.join(WA, "03-Live-dashboard.jpg"), { headline: ["Know who's coming,", "in real time."], sub: "Headcount, approvals, gifts and supplier balances.", image: m.clear.suitePortal, imgWidth: 1000, imgHeight: 660, to: "#E9DDE7" });
  await promo(path.join(WA, "04-Check-in.jpg"), { headline: ["Check-in at the", "gate in seconds."], sub: "QR passes · usher scan · self check-in on arrival", image: m.clear.phonesDay, imgWidth: 1040, imgHeight: 780, to: "#E9DDE7" });
  await promo(path.join(WA, "05-Money.jpg"), { headline: ["Gifts and suppliers,", "all accounted for."], sub: "Multi-currency gift register and payment tracking.", image: m["portal-desktop-providers"], imgWidth: 1000, imgHeight: 700 });
  console.log("  whatsapp done");
  return t;
}

// ---------------------------------------------------------------- word
const T = (text, o) => new D.TextRun(Object.assign({ text, font: "Calibri", size: 21, color: INK }, o || {}));
const P = (children, o) => new D.Paragraph(Object.assign({ children: Array.isArray(children) ? children : [T(children)], spacing: { after: 120, line: 290 } }, o || {}));
const H1 = (text) => new D.Paragraph({ heading: D.HeadingLevel.HEADING_1, children: [new D.TextRun({ text, font: "Georgia", size: 40, color: PLUM })], spacing: { before: 240, after: 160 }, keepNext: true });
const H2 = (text) => new D.Paragraph({ heading: D.HeadingLevel.HEADING_2, children: [new D.TextRun({ text, font: "Georgia", size: 28, color: PLUM })], spacing: { before: 280, after: 100 }, keepNext: true });
const EYEBROW = (text) => new D.Paragraph({ children: [new D.TextRun({ text: text.toUpperCase(), font: "Calibri", size: 17, bold: true, color: GOLD, characterSpacing: 40 })], spacing: { before: 120, after: 40 }, keepNext: true });
const CAPTION = (text) => P([T(text, { italics: true, size: 18, color: MUTED })], { alignment: D.AlignmentType.CENTER, spacing: { after: 240 } });
const BULLET = (runs) => new D.Paragraph({ children: Array.isArray(runs) ? runs : [T(runs)], bullet: { level: 0 }, spacing: { after: 60 } });

async function image(buf, widthPx) {
  const jb = await sharp(buf).flatten({ background: "#FBF7F0" }).resize({ width: Math.min(1800, widthPx * 3) }).jpeg({ quality: 84, mozjpeg: true }).toBuffer();
  const meta = await sharp(jb).metadata();
  return new D.ImageRun({ type: "jpg", data: jb, transformation: { width: widthPx, height: Math.round(widthPx * meta.height / meta.width) } });
}
const IMG = async (buf, w) => new D.Paragraph({ children: [await image(buf, w || 600)], alignment: D.AlignmentType.CENTER, spacing: { before: 120, after: 60 }, keepNext: true, keepLines: true });

const NONE = { style: D.BorderStyle.NONE, size: 0, color: "FFFFFF" };
const LINE = { style: D.BorderStyle.SINGLE, size: 4, color: "E2DED7" };
const STATUS_FILL = { live: ["E4F0E8", "2F6B4F"], next: ["F7ECD9", "8A5A12"], later: ["E9EAF0", "5B5F73"] };
function cell(children, o) {
  o = o || {};
  return new D.TableCell({
    children: (Array.isArray(children) ? children : [children]).map((c) => (c instanceof D.Paragraph ? c : P(typeof c === "string" ? c : [c], { spacing: { after: 40 } }))),
    width: o.width ? { size: o.width, type: D.WidthType.PERCENTAGE } : undefined,
    shading: o.fill ? { type: D.ShadingType.CLEAR, color: "auto", fill: o.fill } : undefined,
    margins: { top: 80, bottom: 80, left: 110, right: 110 },
    verticalAlign: o.valign || D.VerticalAlign.TOP,
    borders: o.borders || { top: NONE, left: NONE, right: NONE, bottom: LINE },
  });
}
function table(headers, rows, widths) {
  const head = new D.TableRow({ tableHeader: true, children: headers.map((h, i) => cell(P([T(h.toUpperCase(), { bold: true, size: 16, color: "FFFFFF", characterSpacing: 20 })], { spacing: { after: 0 } }), { width: widths[i], fill: PLUM })) });
  return new D.Table({ width: { size: 100, type: D.WidthType.PERCENTAGE }, rows: [head].concat(rows), borders: { top: NONE, bottom: NONE, left: NONE, right: NONE, insideHorizontal: NONE, insideVertical: NONE } });
}
function statusCell(s, width) {
  const [fill, color] = STATUS_FILL[s];
  return cell(P([T(C.STATUS_LABEL[s], { bold: true, size: 17, color })], { spacing: { after: 0 }, alignment: D.AlignmentType.CENTER }), { width, fill, valign: D.VerticalAlign.CENTER });
}
async function imageGrid(items, cols) {
  const w = cols === 2 ? 292 : 190;
  const rows = [];
  for (let i = 0; i < items.length; i += cols) {
    const cells = [];
    for (let j = 0; j < cols; j++) {
      const it = items[i + j];
      cells.push(new D.TableCell({
        width: { size: 100 / cols, type: D.WidthType.PERCENTAGE },
        borders: { top: NONE, bottom: NONE, left: NONE, right: NONE },
        margins: { top: 60, bottom: 60, left: 60, right: 60 },
        children: it ? [new D.Paragraph({ children: [await image(it[0], w)], alignment: D.AlignmentType.CENTER }), CAPTION(it[1])] : [P("")],
      }));
    }
    rows.push(new D.TableRow({ children: cells, cantSplit: true }));
  }
  return new D.Table({ width: { size: 100, type: D.WidthType.PERCENTAGE }, rows, borders: { top: NONE, bottom: NONE, left: NONE, right: NONE, insideHorizontal: NONE, insideVertical: NONE } });
}

async function buildDocx(m) {
  const invitationJpg = fs.readFileSync(path.join(ROOT, "invitation-card", "Nyasha-Watson-Invitation.jpg"));
  const liveCount = C.FEATURES.reduce((s, g) => s + g.items.filter((i) => i[2] === "live").length, 0);
  const total = C.FEATURES.reduce((s, g) => s + g.items.length, 0);
  const kids = [];

  // cover
  kids.push(new D.Paragraph({ children: [new D.TextRun({ text: "SERVICE & FEATURE CATALOGUE · WORKING DRAFT", font: "Calibri", size: 18, bold: true, color: GOLD, characterSpacing: 60 })], spacing: { before: 600, after: 120 } }));
  kids.push(new D.Paragraph({ children: [new D.TextRun({ text: C.BRAND, font: "Georgia", size: 96, color: PLUM })], spacing: { after: 160 } }));
  kids.push(P([T(C.TAGLINE, { size: 26, color: MUTED })], { spacing: { after: 360 } }));
  kids.push(await IMG(m.suiteSite, 600));
  kids.push(CAPTION("The platform running a real event today — Nyasha & Watson's wedding, on desktop, tablet and phone."));
  kids.push(P([T(liveCount + " features live today · " + total + " planned · " + C.EVENTS.length + " kinds of event", { bold: true, color: PLUM, size: 22 })], { alignment: D.AlignmentType.CENTER }));
  kids.push(new D.Paragraph({ children: [new D.PageBreak()] }));

  // the platform today
  kids.push(EYEBROW("01 · The platform today"));
  kids.push(H1("See it working"));
  kids.push(P("Everything below is the live system, captured on phone, tablet and desktop. Guest names and figures in the organiser screens are demo data."));
  kids.push(H2("What guests see"));
  kids.push(P("Each guest opens their own invitation link: a branded event site that greets them by name, a step-by-step RSVP, and an interactive invitation card they can save or share."));
  kids.push(await IMG(m.phonesGuest, 600));
  kids.push(CAPTION("Phone: opening cover · RSVP · interactive invitation card"));
  kids.push(await imageGrid([[m["site-desktop-cover"], "Desktop: the opening cover"], [m["site-desktop-rsvp"], "Desktop: RSVP review — submit online or choose WhatsApp, SMS, call or email"], [m["site-tablet-card"], "Tablet: the interactive invitation card"], [m["site-tablet-home"], "Tablet: personalised welcome and countdown"]], 2));
  kids.push(H2("The invitation card"));
  kids.push(P("Delivered as JPG, clickable PDF, animated GIF and editable SVG. Tapping RSVP Online opens the RSVP page; tapping the venue opens Google Maps. Personalised cards carry the guest's name and their own QR code."));
  kids.push(await IMG(invitationJpg, 270));
  kids.push(CAPTION("The general invitation card (1080 × 1350)"));
  kids.push(new D.Paragraph({ children: [new D.PageBreak()] }));

  kids.push(H2("What organisers see"));
  kids.push(P("A private management portal with a live dashboard, the guest list, approvals, check-in, gifts, suppliers and reports — on any device."));
  kids.push(await IMG(m.suitePortal, 600));
  kids.push(CAPTION("Organiser portal on desktop, tablet and phone"));
  kids.push(await imageGrid([
    [m["portal-desktop-guests"], "Invites & RSVPs — filters, categories, reply channel, check-in status"],
    [m["portal-desktop-approvals"], "Approvals — replies from people not on the list, approved or declined"],
    [m["portal-desktop-gifts"], "Gifts — cash and in-kind, in any currency"],
    [m["portal-desktop-providers"], "Service providers — fees, payments, outstanding and overdue"],
    [m["portal-desktop-reports"], "Reports — Excel, CSV and PDF"],
    [m["portal-desktop-badge"], "Guest pass with QR code for check-in"],
  ], 2));
  kids.push(H2("On the day"));
  kids.push(await IMG(m.phonesDay, 600));
  kids.push(CAPTION("Programme for guests · usher check-in by search or QR scan · live dashboard on the phone"));
  kids.push(new D.Paragraph({ children: [new D.PageBreak()] }));

  // journey
  kids.push(EYEBROW("02 · How it works"));
  kids.push(H1("One platform, from the first invite to the thank-you"));
  kids.push(table(["Stage", "What happens"], C.JOURNEY.map(([k, v], i) => new D.TableRow({ children: [cell(P([T((i + 1) + ". " + k, { bold: true, color: PLUM })], { spacing: { after: 0 } }), { width: 25 }), cell(v, { width: 75 })] })), [25, 75]));

  // features
  kids.push(EYEBROW("03 · Catalogue"));
  kids.push(H1("Features & functions"));
  kids.push(P([T("Live", { bold: true, color: STATUS_FILL.live[1] }), T(" — working in the current system.   "), T("Build next", { bold: true, color: STATUS_FILL.next[1] }), T(" — needed for the first paying clients.   "), T("Later", { bold: true, color: STATUS_FILL.later[1] }), T(" — growth features.")]));
  for (const g of C.FEATURES) {
    kids.push(H2(g.group));
    kids.push(table(["Feature", "What it does", "Status"], g.items.map(([n, d, s]) => new D.TableRow({ cantSplit: true, children: [cell(P([T(n, { bold: true })], { spacing: { after: 0 } }), { width: 28 }), cell(P([T(d, { color: "3F3B44" })], { spacing: { after: 0 } }), { width: 56 }), statusCell(s, 16)] })), [28, 56, 16]));
  }

  // events
  kids.push(EYEBROW("04 · Markets"));
  kids.push(H1("Events we serve"));
  for (const [name, kindsText, points] of C.EVENTS) {
    kids.push(H2(name));
    kids.push(P([T(kindsText, { italics: true, color: GOLD })], { spacing: { after: 60 } }));
    points.forEach((pt) => kids.push(BULLET(pt)));
  }

  // natures
  kids.push(EYEBROW("05 · Event natures"));
  kids.push(H1("Any size, any format"));
  kids.push(table(["Dimension", "Options", "What the platform does"], C.NATURES.map(([a, b, c]) => new D.TableRow({ cantSplit: true, children: [cell(P([T(a, { bold: true })], { spacing: { after: 0 } }), { width: 18 }), cell(b, { width: 34 }), cell(P([T(c, { color: "3F3B44" })], { spacing: { after: 0 } }), { width: 48 })] })), [18, 34, 48]));

  // roles
  kids.push(EYEBROW("06 · Users"));
  kids.push(H1("Who uses it"));
  kids.push(table(["User", "What they do", "Status"], C.ROLES.map(([a, b, s]) => new D.TableRow({ cantSplit: true, children: [cell(P([T(a, { bold: true })], { spacing: { after: 0 } }), { width: 24 }), cell(b, { width: 60 }), statusCell(s, 16)] })), [24, 60, 16]));
  kids.push(new D.Paragraph({ children: [new D.PageBreak()] }));

  // packages
  kids.push(EYEBROW("07 · Packages"));
  kids.push(H1("How we could package it"));
  kids.push(P("Starting points to test with the first clients. Prices are per event in US dollars unless marked monthly."));
  kids.push(table(["Package", "For", "Price", "Includes"], C.PACKAGES.map(([n, f, p, inc]) => new D.TableRow({ cantSplit: true, children: [cell(P([T(n, { bold: true, color: PLUM })], { spacing: { after: 0 } }), { width: 18 }), cell(f, { width: 24 }), cell(P([T(p, { bold: true })], { spacing: { after: 0 } }), { width: 18 }), cell(inc.map((x) => BULLET(x)), { width: 40 })] })), [18, 24, 18, 40]));

  kids.push(EYEBROW("08 · Add-ons"));
  kids.push(H1("Add-on services"));
  kids.push(table(["Service", "Indicative price", "Description"], C.ADDONS.map(([n, p, d]) => new D.TableRow({ cantSplit: true, children: [cell(P([T(n, { bold: true })], { spacing: { after: 0 } }), { width: 32 }), cell(P([T(p, { color: PLUM })], { spacing: { after: 0 } }), { width: 20 }), cell(d, { width: 48 })] })), [32, 20, 48]));

  kids.push(EYEBROW("09 · Business model"));
  kids.push(H1("Revenue streams"));
  C.REVENUE.forEach(([n, d]) => kids.push(BULLET([T(n + " — ", { bold: true }), T(d)])));

  kids.push(EYEBROW("10 · Roadmap"));
  kids.push(H1("Before we launch"));
  kids.push(P("In order of priority. The first three turn the wedding site into a product we can sell to more than one client."));
  C.LAUNCH.forEach(([n, d], i) => kids.push(P([T((i + 1) + ".  " + n, { bold: true, color: PLUM }), T("  —  " + d)], { spacing: { after: 100 } })));
  kids.push(P([T("Working draft for internal planning. \"" + C.BRAND + "\" is a working name. Prices are suggestions to test with real clients, not final.", { italics: true, size: 18, color: MUTED })], { spacing: { before: 360 } }));

  const doc = new D.Document({
    creator: C.BRAND, title: C.BRAND + " — Service & Feature Catalogue", description: C.TAGLINE,
    styles: { default: { document: { run: { font: "Calibri", size: 21, color: INK } } } },
    sections: [{
      properties: { page: { size: { width: 11906, height: 16838 }, margin: { top: 1134, bottom: 1134, left: 1134, right: 1134 } } },
      footers: { default: new D.Footer({ children: [new D.Paragraph({ alignment: D.AlignmentType.RIGHT, children: [new D.TextRun({ text: C.BRAND + " · Service catalogue · page ", size: 16, color: MUTED }), new D.TextRun({ children: [D.PageNumber.CURRENT], size: 16, color: MUTED })] })] }) },
      children: kids,
    }],
  });
  const buf = await D.Packer.toBuffer(doc);
  const file = path.join(OUT, C.BRAND.replace(/\s+/g, "-") + "-Catalogue.docx");
  fs.writeFileSync(file, buf);
  console.log("  word document done:", (buf.length / 1024 / 1024).toFixed(1) + " MB");
  return file;
}

(async () => {
  fs.mkdirSync(OUT, { recursive: true });
  if (!process.argv.includes("--no-capture")) {
    const server = await start(5317);
    try { await capture("http://127.0.0.1:5317", SHOTS); } finally { server.close(); }
  }
  const m = await buildMockups();
  await buildWhatsApp(m);
  await buildDocx(m);
  for (const f of fs.readdirSync(MOCK)) if (f.startsWith("test-")) fs.unlinkSync(path.join(MOCK, f));
  console.log("business kit ready in", OUT);
})().catch((e) => { console.error(e); process.exit(1); });
