// The wedding invitation card, built as one SVG so every copy of it — the
// interactive card on the website, the personalised guest card, and the
// JPG / PDF / SVG / GIF deliverables (tools/build-invitation.js) — comes from
// the same drawing. Clickable areas (RSVP, venue) are real <a> elements laid
// over the artwork, so they scale with the card and never show link styling.
(function (global) {
  "use strict";

  var W = 1080, H = 1350;
  var SITE = "https://nyasha-watson.e-guests.com";
  var MAPS_URL = "https://www.google.com/maps/search/?api=1&query=7%20Bay%20Noakes%2C%20Colne%20Valley%2C%20Chisipite%2C%20Harare%2C%20Zimbabwe";
  var C = { ivory: "#FBF7F0", plum: "#3E1730", plum2: "#5A2444", coral: "#D97F55", gold: "#B08A46", champ: "#E4D2B0", muted: "#8B7A6E" };
  var SWATCHES = [
    { name: "Muted Plum", color: "#9C7089" },
    { name: "Soft Champagne", color: "#E8D9BE" },
    { name: "Peach Coral", color: "#E8916B" },
    { name: "Ivory", color: "#FBF8F3" }
  ];

  // family: the font files' typographic family first (image renderer, design
  // tools), then the website's @font-face name. pdf: the face registered in the
  // PDF build, which can't distinguish weights like 500/600 on its own.
  var FONTS = {
    script: { family: "'Great Vibes', cursive", weight: 400, pdf: "GV" },
    serif: { family: "'Bodoni Moda 28pt', 'Bodoni Moda', serif", weight: 400, pdf: "BMR" },
    serifSemi: { family: "'Bodoni Moda 28pt', 'Bodoni Moda', serif", weight: 600, pdf: "BMS" },
    serifBold: { family: "'Bodoni Moda 28pt', 'Bodoni Moda', serif", weight: 700, pdf: "BMB" },
    sans: { family: "Poppins, sans-serif", weight: 400, pdf: "PR" },
    sansMed: { family: "Poppins, sans-serif", weight: 500, pdf: "PM" },
    sansSemi: { family: "Poppins, sans-serif", weight: 600, pdf: "PS" }
  };
  var pdfMode = false;

  // Clickable areas in card coordinates (also used for PDF link annotations).
  var HOTSPOTS = {
    venue: { x: 196, y: 734, w: 688, h: 146, label: "Open Colne Valley Nature Reserve Park in Google Maps" },
    rsvp: { x: 554, y: 1092, w: 342, h: 152, label: "RSVP online" }
  };

  function esc(s) { return String(s).replace(/[&<>"]/g, function (c) { return { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c]; }); }
  function r2(n) { return Math.round(n * 100) / 100; }

  function defaultMeasure(str, fontKey, size, ls) { return str.length * size * 0.56 + (ls || 0) * str.length; }

  function text(str, x, y, fontKey, size, fill, o) {
    o = o || {};
    var f = FONTS[fontKey];
    var a = ' font-family="' + (pdfMode ? f.pdf : f.family) + '" font-weight="' + f.weight + '" font-size="' + size + '" fill="' + fill + '" text-anchor="' + (o.anchor || "middle") + '"';
    if (o.ls) a += ' letter-spacing="' + o.ls + '"';
    if (o.stroke) a += ' stroke="' + fill + '" stroke-width="' + o.stroke + '" stroke-linejoin="round"';
    if (o.opacity != null) a += ' opacity="' + r2(o.opacity) + '"';
    // No italic cut of Bodoni Moda ships with the site, so italics are an
    // explicit slant — identical in browsers, the image renderer and the PDF.
    if (o.italic) return '<text x="0" y="0"' + a + ' transform="translate(' + r2(x) + " " + r2(y) + ') skewX(-11)">' + esc(str) + "</text>";
    return '<text x="' + r2(x) + '" y="' + r2(y) + '"' + a + ">" + esc(str) + "</text>";
  }

  function star(cx, cy, s, opacity) {
    var k = s * 0.22;
    return '<path d="M' + r2(cx) + " " + r2(cy - s) + " L" + r2(cx + k) + " " + r2(cy - k) + " L" + r2(cx + s) + " " + r2(cy) + " L" + r2(cx + k) + " " + r2(cy + k) + " L" + r2(cx) + " " + r2(cy + s) + " L" + r2(cx - k) + " " + r2(cy + k) + " L" + r2(cx - s) + " " + r2(cy) + " L" + r2(cx - k) + " " + r2(cy - k) + ' Z" fill="' + C.gold + '" opacity="' + r2(opacity) + '"/>';
  }

  // Gold rings artwork (640x298), seated on a soft shadow. For the GIF a band
  // of light, masked to the rings' own shape, travels across the gold and a few
  // sparkles twinkle around them.
  var RINGS_RATIO = 298 / 640;
  function rings(href, cx, top, width, t) {
    var h = width * RINGS_RATIO, x = cx - width / 2;
    var animated = typeof t === "number";
    var out = [];
    out.push('<ellipse cx="' + r2(cx + 6) + '" cy="' + r2(top + h - 4) + '" rx="' + r2(width * 0.42) + '" ry="9" fill="url(#wnRingShadow)"/>');
    out.push('<image href="' + esc(href) + '" xlink:href="' + esc(href) + '" x="' + r2(x) + '" y="' + r2(top) + '" width="' + r2(width) + '" height="' + r2(h) + '" preserveAspectRatio="xMidYMid meet"/>');
    if (animated) {
      var sweep = -width + 2 * width * Math.min(1, t / 0.6);
      out.push('<mask id="wnRingMask" mask-type="alpha" maskUnits="userSpaceOnUse" x="' + r2(x) + '" y="' + r2(top) + '" width="' + r2(width) + '" height="' + r2(h) + '">' +
        '<image href="' + esc(href) + '" xlink:href="' + esc(href) + '" x="' + r2(x) + '" y="' + r2(top) + '" width="' + r2(width) + '" height="' + r2(h) + '"/></mask>');
      out.push('<linearGradient id="wnShine" gradientUnits="userSpaceOnUse" x1="' + r2(cx - 60 + sweep) + '" y1="' + r2(top) + '" x2="' + r2(cx + 20 + sweep) + '" y2="' + r2(top + h) + '">' +
        '<stop offset="0" stop-color="#FFF7E0" stop-opacity="0"/><stop offset=".5" stop-color="#FFF7E0" stop-opacity=".5"/><stop offset="1" stop-color="#FFF7E0" stop-opacity="0"/></linearGradient>');
      out.push('<rect x="' + r2(x) + '" y="' + r2(top) + '" width="' + r2(width) + '" height="' + r2(h) + '" fill="url(#wnShine)" mask="url(#wnRingMask)"/>');
      var tw = function (phase) { return 0.2 + 0.8 * Math.abs(Math.sin(Math.PI * 2 * (t + phase))); };
      out.push(star(x + width * 0.93, top + 8, 10, tw(0)));
      out.push(star(x + width * 0.05, top + h * 0.28, 7, tw(0.35)));
      out.push(star(x + width * 0.62, top + h * 0.12, 6, tw(0.7)));
    }
    return out.join("");
  }

  // Floral spray on a card corner: bloom (~50% x / ~41% y of the artwork)
  // placed `inset` px inside the corner, laid across it with a slight tilt so
  // the stems follow the frame; the tips bleed off the card's edges.
  var SPRAY_RATIO = 1366 / 1360;
  function spray(href, corner, size, inset) {
    var w = size, h = size * SPRAY_RATIO;
    var x = corner === "tl" ? inset - 0.5 * w : W - inset - 0.5 * w;
    var y = corner === "tl" ? inset - 0.41 * h : H - inset - 0.59 * h;
    var rot = corner === "tl" ? -6 : 174;
    return '<image href="' + esc(href) + '" xlink:href="' + esc(href) + '" x="' + r2(x) + '" y="' + r2(y) + '" width="' + r2(w) + '" height="' + r2(h) + '" transform="rotate(' + rot + " " + r2(x + w / 2) + " " + r2(y + h / 2) + ')" filter="url(#wnSoft)"/>';
  }

  function qrPath(qr, x, y, size) {
    var n = qr.size, cell = size / n, d = "";
    for (var row = 0; row < n; row++) {
      for (var col = 0; col < n; col++) {
        if (qr.isDark(row, col)) d += "M" + r2(x + col * cell) + " " + r2(y + row * cell) + "h" + r2(cell + 0.2) + "v" + r2(cell + 0.2) + "h-" + r2(cell + 0.2) + "z";
      }
    }
    return '<path d="' + d + '" fill="' + C.plum + '"/>';
  }

  function hotspot(key, href, target) {
    var h = HOTSPOTS[key];
    return '<a class="wn-hot" href="' + esc(href) + '" xlink:href="' + esc(href) + '"' + (target ? ' target="' + target + '" rel="noopener"' : "") + ' aria-label="' + esc(h.label) + '">' +
      '<rect x="' + h.x + '" y="' + h.y + '" width="' + h.w + '" height="' + h.h + '" rx="6" fill="#FFFFFF" fill-opacity="0"/></a>';
  }

  /**
   * o.name       optional guest name ("Reserved for …" line); omit for the general card
   * o.qr         { size, isDark(row, col) } — QR matrix for the RSVP link
   * o.rsvpHref   where the RSVP hotspot goes (default: the site's RSVP section)
   * o.mapsHref   venue hotspot (default: Google Maps)
   * o.linkTarget target for the RSVP link ("_blank" for files, "" inside the website); the map always opens a new tab
   * o.measure    (text, fontKey, size, letterSpacing) -> width, for fitting the name
   * o.fontCss    optional @font-face CSS to embed (standalone files)
   * o.frame      0..1 animation phase (GIF frames); omit for the static card
   * o.pdf        true when the SVG is only an intermediate for the PDF build
   * o.images     { rings, spray } image URLs (data: URIs for standalone files)
   */
  function build(o) {
    o = o || {};
    pdfMode = !!o.pdf;
    var t = o.frame;
    var animated = typeof t === "number";
    var name = String(o.name || "").trim();
    var measure = o.measure || defaultMeasure;
    var rsvpHref = o.rsvpHref || SITE + "/#rsvp";
    var mapsHref = o.mapsHref || MAPS_URL;
    var target = o.linkTarget == null ? "_blank" : o.linkTarget;
    var cx = W / 2;
    var img = o.images || {};
    var ringsHref = img.rings || "/assets/img/wedding-rings.webp";
    var sprayHref = img.spray || "/assets/img/floral-spray.webp";
    var s = [];

    s.push('<svg xmlns="http://www.w3.org/2000/svg" xmlns:xlink="http://www.w3.org/1999/xlink" viewBox="0 0 ' + W + " " + H + '"' + (pdfMode ? '' : ' width="' + W + '" height="' + H + '"') + ' role="img" aria-labelledby="wnTitle wnDesc">');
    s.push('<title id="wnTitle">Wedding invitation — Nyasha Mazuruse &amp; Watson Chin’ombe</title>');
    s.push('<desc id="wnDesc">Saturday 05 December 2026 at Colne Valley Nature Reserve Park, 7 Bay Noakes, Colne Valley, Chisipite, Harare, Zimbabwe. Formal &amp; smart casual. Strictly by invitation only.</desc>');
    if (o.fontCss) s.push("<style>" + o.fontCss + "</style>");
    s.push("<defs>" +
      '<radialGradient id="wnGlowA" cx="16%" cy="10%" r="60%"><stop offset="0" stop-color="#E8D2A6" stop-opacity=".32"/><stop offset="1" stop-color="#E8D2A6" stop-opacity="0"/></radialGradient>' +
      '<radialGradient id="wnGlowB" cx="88%" cy="94%" r="55%"><stop offset="0" stop-color="#EAB08C" stop-opacity=".18"/><stop offset="1" stop-color="#EAB08C" stop-opacity="0"/></radialGradient>' +
      '<radialGradient id="wnRingShadow"><stop offset="0" stop-color="#5A3A10" stop-opacity=".28"/><stop offset="1" stop-color="#5A3A10" stop-opacity="0"/></radialGradient>' +
      '<filter id="wnSoft" x="-15%" y="-15%" width="130%" height="130%"><feDropShadow dx="0" dy="5" stdDeviation="6" flood-color="#3E1730" flood-opacity=".18"/></filter>' +
      "</defs>");

    // paper + frame
    s.push('<rect width="' + W + '" height="' + H + '" fill="' + C.ivory + '"/>');
    s.push('<rect width="' + W + '" height="' + H + '" fill="url(#wnGlowA)"/><rect width="' + W + '" height="' + H + '" fill="url(#wnGlowB)"/>');
    var footer = "STRICTLY BY INVITATION ONLY";
    var fw = measure(footer, "sansSemi", 15, 5);
    var gapL = r2(cx - fw / 2 - 22), gapR = r2(cx + fw / 2 + 22);
    s.push('<path d="M' + gapL + ' 1314 H36 V36 H1044 V1314 H' + gapR + '" fill="none" stroke="' + C.gold + '" stroke-width="3"/>');
    s.push('<path d="M' + gapL + ' 1298 H52 V52 H1028 V1298 H' + gapR + '" fill="none" stroke="' + C.champ + '" stroke-width="1.5"/>');
    s.push(spray(sprayHref, "tl", 320, 106));
    s.push(spray(sprayHref, "br", 320, 98));

    // header
    s.push(text("TOGETHER WITH THEIR FAMILIES", cx + 3, 98, "sansMed", 17, C.muted, { ls: 6 }));
    s.push(rings(ringsHref, cx, 116, 236, t));
    s.push(text("You are warmly invited to the wedding of", cx, 258, "serif", 25, C.plum2, { italic: true }));

    // names
    s.push(text("Nyasha", cx, 354, "script", 104, C.plum, { stroke: 3 }));
    s.push(text("MAZURUSE", cx + 4.5, 426, "serifSemi", 22, C.plum2, { ls: 9 }));
    s.push(text("&", cx, 480, "script", 58, C.coral, { stroke: 2 }));
    s.push(text("Watson", cx, 570, "script", 104, C.plum, { stroke: 3 }));
    s.push(text("CHIN’OMBE", cx + 4.5, 614, "serifSemi", 22, C.plum2, { ls: 9 }));

    // date
    s.push('<g stroke="' + C.champ + '" stroke-width="1.5"><path d="M150 656H440M150 706H440M640 656H930M640 706H930"/></g>');
    s.push(text("SATURDAY", 298, 689, "sansMed", 21, C.plum2, { ls: 6 }));
    s.push(text("DECEMBER 2026", 788, 689, "sansMed", 21, C.plum2, { ls: 6 }));
    s.push(text("05", cx, 718, "serifSemi", 100, C.coral));

    // venue (clickable → Google Maps)
    var bob = animated ? -4 * Math.abs(Math.sin(Math.PI * 2 * t)) : 0;
    s.push('<g transform="translate(' + cx + " " + r2(762 + bob) + ')"><path d="M0 12 C-7 4 -11 -1 -11 -7 A11 11 0 0 1 11 -7 C11 -1 7 4 0 12 Z" fill="' + C.coral + '"/><circle cx="0" cy="-7" r="4" fill="' + C.ivory + '"/></g>');
    s.push(text("COLNE VALLEY NATURE RESERVE PARK", cx + 1, 808, "serifSemi", 26, C.plum, { ls: 2 }));
    s.push(text("7 Bay Noakes, Colne Valley, Chisipite, Harare, Zimbabwe", cx, 840, "sans", 19, C.muted));
    var mapsLabel = "VIEW ON GOOGLE MAPS";
    var mw = measure(mapsLabel, "sansSemi", 13, 4);
    s.push(text(mapsLabel, cx - 9, 868, "sansSemi", 13, C.coral, { ls: 4 }));
    var ax = cx - 9 + mw / 2 + 8;
    s.push('<path d="M' + r2(ax) + " 863 H" + r2(ax + 14) + " M" + r2(ax + 9) + " 858 L" + r2(ax + 14) + " 863 L" + r2(ax + 9) + ' 868" fill="none" stroke="' + C.coral + '" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"/>');

    // ornament + verse
    s.push('<path d="M470 898H530M550 898H610" stroke="' + C.champ + '" stroke-width="1.5"/><rect x="535" y="893" width="10" height="10" transform="rotate(45 540 898)" fill="' + C.gold + '"/>');
    var vy = name ? 934 : 964;
    s.push(text("“Above all, love each other deeply,", cx, vy, "serif", 22, C.plum2, { italic: true }));
    s.push(text("because love covers over a multitude of sins.”", cx, vy + 30, "serif", 22, C.plum2, { italic: true }));
    s.push(text("1 PETER 4:8", cx, vy + 60, "sansSemi", 13, C.muted, { ls: 5 }));

    // personalised guest line — upright, bold and on one line, shrunk to fit
    if (name) {
      s.push(text("RESERVED FOR", cx + 3, 1022, "sansSemi", 13, C.gold, { ls: 6 }));
      var size = 46, maxW = 840;
      var nw = measure(name, "serifBold", size, 1);
      if (nw > maxW) size = Math.max(24, Math.floor(size * maxW / nw));
      s.push(text(name, cx, 1068, "serifBold", size, C.plum, { ls: 1 }));
    }

    // details panel: dress code + colours | RSVP
    s.push('<path d="M110 1086H970M540 1106V1250" stroke="' + C.champ + '" stroke-width="1.5"/>');
    s.push(text("DRESS CODE", 327, 1124, "sansSemi", 13, C.gold, { ls: 5 }));
    s.push(text("Formal & Smart Casual", 325, 1160, "serifSemi", 27, C.plum));
    s.push(text("OUR COLOURS", 327, 1198, "sansSemi", 13, C.gold, { ls: 5 }));
    SWATCHES.forEach(function (sw, i) {
      var x = 175 + i * 100;
      s.push('<circle cx="' + x + '" cy="1221" r="15" fill="' + sw.color + '" stroke="' + (sw.name === "Ivory" ? "#D9C9AE" : "#3E1730") + '" stroke-opacity="' + (sw.name === "Ivory" ? 1 : 0.14) + '" stroke-width="1.2"/>');
      s.push(text(sw.name, x, 1256, "sans", 12, C.plum2));
    });

    s.push('<rect x="560" y="1100" width="150" height="150" fill="#FFFDF8" stroke="' + C.champ + '" stroke-width="1.5"/>');
    if (o.qr) s.push(qrPath(o.qr, 575, 1115, 120));
    else s.push('<rect x="575" y="1115" width="120" height="120" fill="none" stroke="' + C.champ + '" stroke-dasharray="4 4"/>');
    s.push(text("KINDLY RSVP BY", 808, 1130, "sansSemi", 13, C.gold, { ls: 4 }));
    s.push(text("10 November 2026", 806, 1164, "serifSemi", 20, C.plum));
    if (animated) {
      var u = (t * 2) % 1;
      s.push('<rect x="' + r2(726 - 10 * u) + '" y="' + r2(1188 - 10 * u) + '" width="' + r2(160 + 20 * u) + '" height="' + r2(44 + 20 * u) + '" rx="' + r2(3 + 6 * u) + '" fill="none" stroke="' + C.coral + '" stroke-width="2" opacity="' + r2(0.7 * (1 - u)) + '"/>');
    }
    s.push('<rect x="726" y="1188" width="160" height="44" rx="3" fill="' + C.plum + '"/>');
    var bl = "RSVP ONLINE", bw = measure(bl, "sansSemi", 13, 3), groupW = bw + 6 + 10;
    var bx = 806 - groupW / 2;
    s.push(text(bl, bx, 1215, "sansSemi", 13, C.ivory, { ls: 3, anchor: "start" }));
    var arx = bx + bw + 6;
    s.push('<path d="M' + r2(arx) + " 1211 H" + r2(arx + 10) + " M" + r2(arx + 6) + " 1207 L" + r2(arx + 10) + " 1211 L" + r2(arx + 6) + ' 1215" fill="none" stroke="' + C.ivory + '" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"/>');

    // "strictly by invitation only" set into the bottom of the frame
    s.push(text(footer, cx + 2.5, 1311, "sansSemi", 15, C.plum2, { ls: 5 }));

    // interactive layer (transparent, on top)
    if (!pdfMode) {
      s.push(hotspot("venue", mapsHref, "_blank"));
      s.push(hotspot("rsvp", rsvpHref, target));
    }
    s.push("</svg>");
    return s.join("");
  }

  global.WNInvitation = { build: build, W: W, H: H, SITE: SITE, MAPS_URL: MAPS_URL, HOTSPOTS: HOTSPOTS, FONTS: FONTS };
  if (typeof module !== "undefined" && module.exports) module.exports = global.WNInvitation;
})(typeof window !== "undefined" ? window : globalThis);
