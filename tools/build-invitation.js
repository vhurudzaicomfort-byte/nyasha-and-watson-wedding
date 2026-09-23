// Builds the general (no guest name) invitation card deliverables into
// /invitation-card: 1080x1350 JPG, clickable PDF, editable SVG and animated GIF.
// Run from /tools:  npm install && npm run invitation
const fs = require("fs");
const path = require("path");
const { Resvg } = require("@resvg/resvg-js");
const QRCode = require("qrcode");
const PDFDocument = require("pdfkit");
const SVGtoPDF = require("svg-to-pdfkit");
const sharp = require("sharp");
const fontkit = require("fontkit");
const { quantize, applyPalette } = require("gifenc");
const { GifWriter } = require("omggif");

const ROOT = path.join(__dirname, "..");
const OUT = path.join(ROOT, "invitation-card");
const FONT_DIR = path.join(ROOT, "assets", "fonts");
const Inv = require(path.join(ROOT, "assets", "js", "invitation-card.js"));
const BASE = "Nyasha-Watson-Invitation";

const FONT_FILES = {
  script: "GreatVibes-Regular.ttf",
  serif: "BodoniModa_28pt-Regular.ttf",
  serifSemi: "BodoniModa_28pt-SemiBold.ttf",
  serifBold: "BodoniModa_28pt-Bold.ttf",
  sans: "Poppins-Regular.ttf",
  sansMed: "Poppins-Medium.ttf",
  sansSemi: "Poppins-SemiBold.ttf",
};
const fonts = {};
for (const [k, f] of Object.entries(FONT_FILES)) fonts[k] = fontkit.openSync(path.join(FONT_DIR, f));

function measure(str, key, size, ls) {
  const font = fonts[key];
  return (font.layout(str).advanceWidth / font.unitsPerEm) * size + (ls || 0) * str.length;
}

// Standalone files carry their fonts, declared under the same family names the
// SVG uses, so they render correctly anywhere without anything installed.
function fontCss() {
  const faces = [
    ["Great Vibes", 400, "script"],
    ["Bodoni Moda 28pt", 400, "serif"],
    ["Bodoni Moda 28pt", 700, "serifBold"],
    ["Bodoni Moda 28pt", 600, "serifSemi"],
    ["Poppins", 400, "sans"],
    ["Poppins", 500, "sansMed"],
    ["Poppins", 600, "sansSemi"],
  ];
  return faces.map(([fam, w, key]) => {
    const b64 = fs.readFileSync(path.join(FONT_DIR, FONT_FILES[key])).toString("base64");
    return `@font-face{font-family:'${fam}';font-weight:${w};font-style:normal;src:url(data:font/ttf;base64,${b64}) format('truetype');}`;
  }).join("");
}

// Card artwork as PNG data URIs: self-contained files, and PNG is what the PDF
// engine and design tools (Illustrator, Inkscape) can all read.
async function pngDataUri(file, width) {
  const buf = await sharp(path.join(ROOT, "assets", "img", file)).resize(width).png({ compressionLevel: 9 }).toBuffer();
  return "data:image/png;base64," + buf.toString("base64");
}

function qrMatrix(text) {
  const q = QRCode.create(text, { errorCorrectionLevel: "M" });
  const n = q.modules.size, data = q.modules.data;
  return { size: n, isDark: (r, c) => !!data[r * n + c] };
}

const resvgFontOpts = { fontFiles: Object.values(FONT_FILES).map((f) => path.join(FONT_DIR, f)), loadSystemFonts: false, defaultFontFamily: "Poppins" };
function renderRgba(svg) {
  const img = new Resvg(svg, { fitTo: { mode: "width", value: Inv.W }, font: resvgFontOpts, background: "#FBF7F0" }).render();
  return { width: img.width, height: img.height, pixels: img.pixels, png: img.asPng() };
}

async function main() {
  fs.mkdirSync(OUT, { recursive: true });
  const rsvpUrl = Inv.SITE + "/#rsvp";
  const qr = qrMatrix(rsvpUrl);
  const images = { rings: await pngDataUri("wedding-rings.webp", 640), spray: await pngDataUri("floral-spray.webp", 660) };
  const common = { qr, measure, images, rsvpHref: rsvpUrl, linkTarget: "_blank" };

  // 1) editable SVG (live text, embedded fonts, working links)
  const svgStatic = Inv.build(Object.assign({ fontCss: fontCss() }, common));
  fs.writeFileSync(path.join(OUT, BASE + ".svg"), '<?xml version="1.0" encoding="UTF-8"?>\n' + svgStatic);

  // 2) JPG 1080x1350
  const plain = Inv.build(common);
  const still = renderRgba(plain);
  await sharp(still.png).jpeg({ quality: 93, chromaSubsampling: "4:4:4", mozjpeg: true }).toFile(path.join(OUT, BASE + ".jpg"));

  // 3) PDF — vector, with clickable RSVP and venue areas
  const scale = 0.5; // 540x675 pt page (7.5 x 9.375 in)
  const doc = new PDFDocument({ size: [Inv.W * scale, Inv.H * scale], margin: 0, info: { Title: "Wedding Invitation — Nyasha & Watson", Author: "Nyasha & Watson", Subject: "Saturday 05 December 2026 · Colne Valley Nature Reserve Park, Harare" } });
  const pdfOut = fs.createWriteStream(path.join(OUT, BASE + ".pdf"));
  doc.pipe(pdfOut);
  const reg = { script: "GV", serif: "BMR", serifSemi: "BMS", serifBold: "BMB", sans: "PR", sansMed: "PM", sansSemi: "PS" };
  for (const [k, n] of Object.entries(reg)) doc.registerFont(n, path.join(FONT_DIR, FONT_FILES[k]));
  SVGtoPDF(doc, Inv.build(Object.assign({ pdf: true }, common)), 0, 0, {
    width: Inv.W * scale, height: Inv.H * scale, assumePt: false,
    fontCallback: (family) => String(family).trim(),
  });
  for (const [key, url] of [["venue", Inv.MAPS_URL], ["rsvp", rsvpUrl]]) {
    const h = Inv.HOTSPOTS[key];
    doc.link(h.x * scale, h.y * scale, h.w * scale, h.h * scale, url);
  }
  doc.end();
  await new Promise((r) => pdfOut.on("finish", r));

  // 4) animated GIF — light sweeps the rings, sparkles twinkle, the venue pin
  // bobs and the RSVP button pulses. One shared palette; after the first frame
  // only changed pixels are written (index 255 = transparent / unchanged).
  const FRAMES = 30, DELAY_CS = 8;
  const frames = [];
  for (let i = 0; i < FRAMES; i++) frames.push(renderRgba(Inv.build(Object.assign({ frame: i / FRAMES }, common))).pixels);
  const { width: w, height: h } = still;
  const sample = [];
  for (const f of [frames[0], frames[6], frames[12], frames[18]]) for (let p = 0; p < f.length; p += 4 * 3) sample.push(f[p], f[p + 1], f[p + 2], 255);
  const palette = quantize(new Uint8Array(sample), 255);
  while (palette.length < 255) palette.push([0, 0, 0]);
  const TRANSPARENT = 255;
  const pal24 = palette.map(([r, g, b]) => (r << 16) | (g << 8) | b).concat([0]);
  const buf = Buffer.alloc(w * h * FRAMES + 1024 * 1024);
  const gw = new GifWriter(buf, w, h, { palette: pal24, loop: 0 });
  let prev = null;
  for (let i = 0; i < FRAMES; i++) {
    const idx = applyPalette(frames[i], palette);
    if (!prev) { gw.addFrame(0, 0, w, h, idx, { delay: DELAY_CS, disposal: 1 }); prev = idx; continue; }
    let x0 = w, y0 = h, x1 = -1, y1 = -1;
    for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) {
      const p = y * w + x;
      if (idx[p] !== prev[p]) { if (x < x0) x0 = x; if (x > x1) x1 = x; if (y < y0) y0 = y; if (y > y1) y1 = y; }
    }
    if (x1 < 0) { x0 = 0; y0 = 0; x1 = 0; y1 = 0; }
    const rw = x1 - x0 + 1, rh = y1 - y0 + 1;
    const sub = new Uint8Array(rw * rh);
    for (let y = 0; y < rh; y++) for (let x = 0; x < rw; x++) {
      const p = (y + y0) * w + (x + x0);
      sub[y * rw + x] = idx[p] === prev[p] ? TRANSPARENT : idx[p];
    }
    gw.addFrame(x0, y0, rw, rh, sub, { delay: DELAY_CS, disposal: 1, transparent: TRANSPARENT });
    prev = idx;
  }
  fs.writeFileSync(path.join(OUT, BASE + ".gif"), buf.subarray(0, gw.end()));

  // fonts + licences so the SVG can be edited in Illustrator / Inkscape / Figma
  const fontOut = path.join(OUT, "fonts");
  fs.mkdirSync(fontOut, { recursive: true });
  for (const f of Object.values(FONT_FILES).concat(["OFL-BodoniModa.txt", "OFL-GreatVibes.txt", "OFL-Poppins.txt"])) fs.copyFileSync(path.join(FONT_DIR, f), path.join(fontOut, f));

  for (const f of fs.readdirSync(OUT)) {
    const st = fs.statSync(path.join(OUT, f));
    if (st.isFile()) console.log(f.padEnd(36), (st.size / 1024).toFixed(0) + " KB");
  }
}

main().catch((e) => { console.error(e); process.exit(1); });
