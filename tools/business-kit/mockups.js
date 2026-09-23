// Device mockups (phone, tablet, desktop browser) drawn as SVG around real
// screenshots and rendered with resvg; suites combine all three devices.
const path = require("path");
const fs = require("fs");
const sharp = require("sharp");
const { Resvg } = require("@resvg/resvg-js");

const FONT_DIR = path.join(__dirname, "..", "..", "assets", "fonts");
const FONTS = ["Poppins-Regular.ttf", "Poppins-Medium.ttf", "Poppins-SemiBold.ttf", "BodoniModa_28pt-Regular.ttf", "BodoniModa_28pt-SemiBold.ttf", "GreatVibes-Regular.ttf"].map((f) => path.join(FONT_DIR, f));

function render(svg) {
  return new Resvg(svg, { font: { fontFiles: FONTS, loadSystemFonts: false, defaultFontFamily: "Poppins" } }).render().asPng();
}
const dataUri = (buf) => "data:image/png;base64," + buf.toString("base64");
async function topColor(file) {
  const { data } = await sharp(file).extract({ left: 6, top: 6, width: 4, height: 4 }).raw().toBuffer({ resolveWithObject: true });
  const [r, g, b] = [data[0], data[1], data[2]];
  const hex = "#" + [r, g, b].map((v) => v.toString(16).padStart(2, "0")).join("");
  const light = 0.299 * r + 0.587 * g + 0.114 * b > 150;
  return { hex, ink: light ? "#1d1a20" : "#ffffff" };
}
const shadow = (id, dy, blur, op) => '<filter id="' + id + '" x="-25%" y="-25%" width="150%" height="150%"><feDropShadow dx="0" dy="' + dy + '" stdDeviation="' + blur + '" flood-color="#2a1426" flood-opacity="' + op + '"/></filter>';

function statusIcons(xRight, yMid, ink, s) {
  // cellular bars, wifi, battery — right-aligned at xRight
  const bars = [0, 1, 2, 3].map((i) => '<rect x="' + (xRight - 150 * s + i * 11 * s) + '" y="' + (yMid + 8 * s - (6 + i * 4) * s) + '" width="' + 7 * s + '" height="' + (6 + i * 4) * s + '" rx="' + 1.5 * s + '" fill="' + ink + '"/>').join("");
  const wx = xRight - 88 * s, wy = yMid + 8 * s;
  const wifi = '<path d="M' + (wx - 13 * s) + " " + (wy - 12 * s) + " Q" + wx + " " + (wy - 24 * s) + " " + (wx + 13 * s) + " " + (wy - 12 * s) + '" stroke="' + ink + '" stroke-width="' + 3.4 * s + '" fill="none" stroke-linecap="round"/><path d="M' + (wx - 7 * s) + " " + (wy - 6 * s) + " Q" + wx + " " + (wy - 12 * s) + " " + (wx + 7 * s) + " " + (wy - 6 * s) + '" stroke="' + ink + '" stroke-width="' + 3.4 * s + '" fill="none" stroke-linecap="round"/><circle cx="' + wx + '" cy="' + (wy - 1 * s) + '" r="' + 2.6 * s + '" fill="' + ink + '"/>';
  const bx = xRight - 54 * s;
  const battery = '<rect x="' + bx + '" y="' + (yMid - 8 * s) + '" width="' + 44 * s + '" height="' + 21 * s + '" rx="' + 6 * s + '" fill="none" stroke="' + ink + '" stroke-opacity=".45" stroke-width="' + 2 * s + '"/><rect x="' + (bx + 3.5 * s) + '" y="' + (yMid - 4.5 * s) + '" width="' + 30 * s + '" height="' + 14 * s + '" rx="' + 3.5 * s + '" fill="' + ink + '"/><rect x="' + (bx + 46 * s) + '" y="' + (yMid - 1 * s) + '" width="' + 3 * s + '" height="' + 7 * s + '" rx="' + 1.5 * s + '" fill="' + ink + '" fill-opacity=".45"/>';
  return bars + wifi + battery;
}

async function phone(file) {
  const meta = await sharp(file).metadata();
  const sw = meta.width, sh = meta.height; // 780 x 1688 (390x844 @2x)
  const bezel = 30, status = 96, pad = 80;
  const scrH = status + sh, devW = sw + bezel * 2, devH = scrH + bezel * 2;
  const W = devW + pad * 2, H = devH + pad * 2;
  const x0 = pad + bezel, y0 = pad + bezel;
  const top = await topColor(file);
  const svg = '<svg xmlns="http://www.w3.org/2000/svg" width="' + W + '" height="' + H + '"><defs>' + shadow("s", 30, 34, 0.3) +
    '<clipPath id="c"><rect x="' + x0 + '" y="' + y0 + '" width="' + sw + '" height="' + scrH + '" rx="96"/></clipPath></defs>' +
    '<rect x="' + (pad - 5) + '" y="' + (pad + 250) + '" width="8" height="90" rx="4" fill="#2a272e"/><rect x="' + (pad - 5) + '" y="' + (pad + 370) + '" width="8" height="150" rx="4" fill="#2a272e"/><rect x="' + (pad + devW - 3) + '" y="' + (pad + 320) + '" width="8" height="190" rx="4" fill="#2a272e"/>' +
    '<rect x="' + pad + '" y="' + pad + '" width="' + devW + '" height="' + devH + '" rx="124" fill="#141217" filter="url(#s)"/>' +
    '<rect x="' + (pad + 4) + '" y="' + (pad + 4) + '" width="' + (devW - 8) + '" height="' + (devH - 8) + '" rx="120" fill="none" stroke="#403b46" stroke-width="4"/>' +
    '<g clip-path="url(#c)"><rect x="' + x0 + '" y="' + y0 + '" width="' + sw + '" height="' + status + '" fill="' + top.hex + '"/>' +
    '<image href="' + dataUri(fs.readFileSync(file)) + '" x="' + x0 + '" y="' + (y0 + status) + '" width="' + sw + '" height="' + sh + '"/></g>' +
    '<text x="' + (x0 + 92) + '" y="' + (y0 + 60) + '" font-family="Poppins" font-weight="600" font-size="31" fill="' + top.ink + '" text-anchor="middle">9:41</text>' +
    statusIcons(x0 + sw - 44, y0 + 50, top.ink, 1) +
    '<rect x="' + (x0 + sw / 2 - 124) + '" y="' + (y0 + 20) + '" width="248" height="72" rx="36" fill="#000"/>' +
    "</svg>";
  return render(svg);
}

async function tablet(file) {
  const meta = await sharp(file).metadata();
  const sw = meta.width, sh = meta.height; // 1640 x 2360
  const bezel = 50, status = 48, pad = 90;
  const scrH = status + sh, devW = sw + bezel * 2, devH = scrH + bezel * 2;
  const W = devW + pad * 2, H = devH + pad * 2;
  const x0 = pad + bezel, y0 = pad + bezel;
  const top = await topColor(file);
  const svg = '<svg xmlns="http://www.w3.org/2000/svg" width="' + W + '" height="' + H + '"><defs>' + shadow("s", 34, 40, 0.28) +
    '<clipPath id="c"><rect x="' + x0 + '" y="' + y0 + '" width="' + sw + '" height="' + scrH + '" rx="44"/></clipPath></defs>' +
    '<rect x="' + pad + '" y="' + pad + '" width="' + devW + '" height="' + devH + '" rx="92" fill="#18161b" filter="url(#s)"/>' +
    '<rect x="' + (pad + 4) + '" y="' + (pad + 4) + '" width="' + (devW - 8) + '" height="' + (devH - 8) + '" rx="88" fill="none" stroke="#3d3943" stroke-width="4"/>' +
    '<circle cx="' + (pad + devW / 2) + '" cy="' + (pad + bezel / 2) + '" r="8" fill="#2c2a31"/>' +
    '<g clip-path="url(#c)"><rect x="' + x0 + '" y="' + y0 + '" width="' + sw + '" height="' + status + '" fill="' + top.hex + '"/>' +
    '<image href="' + dataUri(fs.readFileSync(file)) + '" x="' + x0 + '" y="' + (y0 + status) + '" width="' + sw + '" height="' + sh + '"/></g>' +
    '<text x="' + (x0 + 40) + '" y="' + (y0 + 33) + '" font-family="Poppins" font-weight="600" font-size="24" fill="' + top.ink + '">9:41  <tspan font-weight="400">Tue 23 Sep</tspan></text>' +
    statusIcons(x0 + sw - 34, y0 + 26, top.ink, 0.8) +
    "</svg>";
  return render(svg);
}

async function browser(file, url) {
  const meta = await sharp(file).metadata();
  const sw = meta.width, sh = meta.height; // 1440 x 900
  const bar = 54, pad = 70, r = 16;
  const W = sw + pad * 2, H = sh + bar + pad * 2;
  const x0 = pad, y0 = pad;
  const svg = '<svg xmlns="http://www.w3.org/2000/svg" width="' + W + '" height="' + H + '"><defs>' + shadow("s", 26, 30, 0.24) +
    '<clipPath id="c"><rect x="' + x0 + '" y="' + y0 + '" width="' + sw + '" height="' + (sh + bar) + '" rx="' + r + '"/></clipPath></defs>' +
    '<rect x="' + x0 + '" y="' + y0 + '" width="' + sw + '" height="' + (sh + bar) + '" rx="' + r + '" fill="#fff" filter="url(#s)"/>' +
    '<g clip-path="url(#c)"><rect x="' + x0 + '" y="' + y0 + '" width="' + sw + '" height="' + bar + '" fill="#EEEAE6"/>' +
    '<rect x="' + x0 + '" y="' + (y0 + bar - 1) + '" width="' + sw + '" height="1" fill="#D9D3CD"/>' +
    '<image href="' + dataUri(fs.readFileSync(file)) + '" x="' + x0 + '" y="' + (y0 + bar) + '" width="' + sw + '" height="' + sh + '"/></g>' +
    ["#FF5F57", "#FEBC2E", "#28C840"].map((c, i) => '<circle cx="' + (x0 + 26 + i * 22) + '" cy="' + (y0 + bar / 2) + '" r="7" fill="' + c + '"/>').join("") +
    '<rect x="' + (x0 + sw / 2 - 330) + '" y="' + (y0 + 12) + '" width="660" height="30" rx="15" fill="#fff" stroke="#DDD6CF"/>' +
    '<g transform="translate(' + (x0 + sw / 2 - 310) + " " + (y0 + 20) + ')"><rect x="1" y="6" width="11" height="8" rx="2" fill="#8A8390"/><path d="M3.5 6 V4 a3 3 0 0 1 6 0 V6" stroke="#8A8390" stroke-width="1.6" fill="none"/></g>' +
    '<text x="' + (x0 + sw / 2 - 288) + '" y="' + (y0 + 32) + '" font-family="Poppins" font-size="14" fill="#5b5560">' + url + "</text>" +
    "</svg>";
  return render(svg);
}

// all three devices together on a soft background
async function suite(desktopPng, tabletPng, phonePng, opts) {
  const W = opts.width || 2600, H = opts.height || 1640;
  const bg = '<svg xmlns="http://www.w3.org/2000/svg" width="' + W + '" height="' + H + '"><defs><linearGradient id="g" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="' + (opts.from || "#FBF7F0") + '"/><stop offset="1" stop-color="' + (opts.to || "#EFE3D2") + '"/></linearGradient></defs><rect width="100%" height="100%" fill="url(#g)"/><circle cx="' + W * 0.12 + '" cy="' + H * 0.1 + '" r="' + H * 0.5 + '" fill="#fff" fill-opacity=".35"/></svg>';
  const d = await sharp(desktopPng).resize({ width: Math.round(W * 0.74) }).png().toBuffer();
  const t = await sharp(tabletPng).resize({ height: Math.round(H * 0.74) }).png().toBuffer();
  const p = await sharp(phonePng).resize({ height: Math.round(H * 0.7) }).png().toBuffer();
  const [dm, tm, pm] = await Promise.all([d, t, p].map((b) => sharp(b).metadata()));
  const base = opts.transparent ? sharp({ create: { width: W, height: H, channels: 4, background: { r: 0, g: 0, b: 0, alpha: 0 } } }) : sharp(Buffer.from(bg));
  return base.composite([
    { input: d, left: Math.round(W * 0.02), top: Math.round(H * 0.04) },
    { input: t, left: Math.round(W - tm.width - pm.width * 0.55), top: Math.round(H - tm.height + H * 0.02) },
    { input: p, left: Math.round(W - pm.width - W * 0.005), top: Math.round(H - pm.height + H * 0.015) },
  ]).png().toBuffer();
}

// a row of phones side by side
async function phoneRow(phonePngs, opts) {
  const W = opts.width || 2400, H = opts.height || 1500;
  const bg = '<svg xmlns="http://www.w3.org/2000/svg" width="' + W + '" height="' + H + '"><defs><linearGradient id="g" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="' + (opts.from || "#FBF7F0") + '"/><stop offset="1" stop-color="' + (opts.to || "#EFE3D2") + '"/></linearGradient></defs><rect width="100%" height="100%" fill="url(#g)"/></svg>';
  const imgs = await Promise.all(phonePngs.map((b) => sharp(b).resize({ height: Math.round(H * 0.94) }).png().toBuffer()));
  const w = (await sharp(imgs[0]).metadata()).width;
  const gap = (W - w * imgs.length) / (imgs.length + 1);
  const base = opts.transparent ? sharp({ create: { width: W, height: H, channels: 4, background: { r: 0, g: 0, b: 0, alpha: 0 } } }) : sharp(Buffer.from(bg));
  return base.composite(imgs.map((b, i) => ({ input: b, left: Math.round(gap + i * (w + gap)), top: Math.round(H * 0.03) }))).png().toBuffer();
}

module.exports = { phone, tablet, browser, suite, phoneRow, render, dataUri };
