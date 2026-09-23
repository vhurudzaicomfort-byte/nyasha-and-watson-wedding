// QR code PNGs for the wedding site, saved into /invitation-card:
//   Nyasha-Watson-QR.png       plain code, 2000px, for printing anywhere
//   Nyasha-Watson-QR-Card.png  branded 1200x1500 card with names and address
// Run from /tools:  npm run qr
const fs = require("fs");
const path = require("path");
const { Resvg } = require("@resvg/resvg-js");
const QRCode = require("qrcode");

const ROOT = path.join(__dirname, "..");
const OUT = path.join(ROOT, "invitation-card");
const FONT_DIR = path.join(ROOT, "assets", "fonts");
const Inv = require(path.join(ROOT, "assets", "js", "invitation-card.js"));
const URL = Inv.SITE + "/";
const HOST = Inv.SITE.replace(/^https?:\/\//, "");
const PLUM = "#3E1730", CORAL = "#D9826B", CHAMPAGNE = "#C9A96E", IVORY = "#FBF7F0";

function qrPath(size, x0, y0, cell) {
  const q = QRCode.create(URL, { errorCorrectionLevel: "H" });
  const n = q.modules.size, d = q.modules.data;
  let p = "";
  for (let r = 0; r < n; r++) for (let c = 0; c < n; c++) {
    if (d[r * n + c]) p += `M${x0 + c * cell} ${y0 + r * cell}h${cell}v${cell}h-${cell}z`;
  }
  return { d: p, n };
}

function render(svg, width) {
  return new Resvg(svg, {
    fitTo: { mode: "width", value: width },
    font: { fontFiles: fs.readdirSync(FONT_DIR).filter((f) => f.endsWith(".ttf")).map((f) => path.join(FONT_DIR, f)), loadSystemFonts: false, defaultFontFamily: "Poppins" },
  }).render().asPng();
}

function plain() {
  const n = QRCode.create(URL, { errorCorrectionLevel: "H" }).modules.size;
  const quiet = 4, total = n + quiet * 2;
  const { d } = qrPath(n, quiet, quiet, 1);
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${total} ${total}" shape-rendering="crispEdges"><rect width="${total}" height="${total}" fill="#FFFFFF"/><path d="${d}" fill="${PLUM}"/></svg>`;
  return render(svg, 2000);
}

function card() {
  const W = 1200, H = 1500, box = 720, bx = (W - box) / 2, by = 470;
  const n = QRCode.create(URL, { errorCorrectionLevel: "H" }).modules.size;
  const cell = (box - 80) / n;
  const { d } = qrPath(n, bx + 40, by + 40, cell);
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${W} ${H}">
  <rect width="${W}" height="${H}" fill="${IVORY}"/>
  <rect x="40" y="40" width="${W - 80}" height="${H - 80}" fill="none" stroke="${CHAMPAGNE}" stroke-width="3"/>
  <rect x="56" y="56" width="${W - 112}" height="${H - 112}" fill="none" stroke="${CHAMPAGNE}" stroke-width="1.2" opacity=".7"/>
  <text x="${W / 2}" y="150" text-anchor="middle" font-family="Poppins" font-weight="500" font-size="24" letter-spacing="7" fill="${CHAMPAGNE}">THE WEDDING OF</text>
  <g font-family="Great Vibes" font-size="118">
    <text x="${W / 2 - 58}" y="290" text-anchor="end" fill="${PLUM}">Nyasha</text>
    <text x="${W / 2 - 4}" y="290" text-anchor="middle" fill="${CORAL}">&amp;</text>
    <text x="${W / 2 + 62}" y="290" text-anchor="start" fill="${PLUM}">Watson</text>
  </g>
  <text x="${W / 2}" y="372" text-anchor="middle" font-family="Bodoni Moda 28pt" font-weight="600" font-size="34" letter-spacing="3" fill="${PLUM}">Saturday · 05 December 2026</text>
  <rect x="${bx}" y="${by}" width="${box}" height="${box}" rx="28" fill="#FFFFFF" stroke="${CHAMPAGNE}" stroke-width="2"/>
  <path d="${d}" fill="${PLUM}" shape-rendering="crispEdges"/>
  <text x="${W / 2}" y="${by + box + 105}" text-anchor="middle" font-family="Bodoni Moda 28pt" font-weight="700" font-size="46" fill="${PLUM}">Scan to view our invitation &amp; RSVP</text>
  <text x="${W / 2}" y="${by + box + 170}" text-anchor="middle" font-family="Poppins" font-weight="500" font-size="32" fill="${CORAL}">${HOST}</text>
  <text x="${W / 2}" y="${H - 100}" text-anchor="middle" font-family="Poppins" font-size="24" letter-spacing="4" fill="${PLUM}" opacity=".75">STRICTLY BY INVITATION ONLY</text>
</svg>`;
  return render(svg, W);
}

fs.mkdirSync(OUT, { recursive: true });
fs.writeFileSync(path.join(OUT, "Nyasha-Watson-QR.png"), plain());
fs.writeFileSync(path.join(OUT, "Nyasha-Watson-QR-Card.png"), card());
console.log("QR ->", URL);
