// The A5 printable invitation (148 x 210 mm PDF), in the design of the
// invitation's opening screen: deep plum, the photo roses, the gold monogram,
// "Our Love Story", the names with the real wedding rings, then the full
// details. Guests save it from the invitation; the portal pulls one or many.
//
// Everything that matters is a real link in the PDF: the venue opens Google
// Maps, the guest's QR code and web address open their personal invitation,
// the phone numbers dial. Wedding details come from /invitation.json, which is
// built from the invitation's config, so the card and the website always agree.
//
//   WNInvitationPDF.download([{ name, link }], "file.pdf", onProgress?)
//   WNInvitationPDF.preview({ name, link })  -> canvas (for checks)
(function (global) {
  "use strict";

  var DPI = 300, MM = DPI / 25.4;
  var PW = 148, PH = 210; // A5 portrait, mm
  var W = Math.round(PW * MM), H = Math.round(PH * MM);
  var px = function (mm) { return mm * MM; };

  var C = {
    ivory: "#f7f2e9", ivoryHi: "#fbf6ec", champagne: "#e6d3a3", gold: "#c4a46a", goldDeep: "#9c7e46",
    plum: "#3b2531", plum2: "#2d1b26", plum3: "#22141c", tile: "#fffdf8"
  };
  var FONTS = [
    '400 40px "Cormorant Garamond"', 'italic 400 40px "Cormorant Garamond"', '500 40px "Cormorant Garamond"',
    '400 40px "Pinyon Script"', '400 20px "Jost"', '500 20px "Jost"'
  ];

  /* ---------- loading ---------- */
  var scripts = {};
  function loadScript(src) {
    if (!scripts[src]) scripts[src] = new Promise(function (resolve, reject) {
      var s = document.createElement("script");
      s.src = src; s.async = true;
      s.onload = function () { resolve(); };
      s.onerror = function () { delete scripts[src]; reject(new Error("Could not load " + src)); };
      document.head.appendChild(s);
    });
    return scripts[src];
  }
  function loadImage(src) {
    return new Promise(function (resolve) {
      if (!src) return resolve(null);
      var img = new Image();
      img.onload = function () { resolve(img); };
      img.onerror = function () { resolve(null); };
      img.src = src;
    });
  }
  var detailsP = null;
  function details() {
    if (!detailsP) detailsP = fetch("/invitation.json", { cache: "no-cache" }).then(function (r) {
      if (!r.ok) throw new Error("invitation.json " + r.status);
      return r.json();
    }).catch(function (e) { detailsP = null; throw e; });
    return detailsP;
  }
  function ready() {
    var libs = [];
    if (!(global.jspdf && global.jspdf.jsPDF)) libs.push(loadScript("/assets/vendor/jspdf.umd.min.js"));
    if (!global.QRCode) libs.push(loadScript("/assets/js/qrcode.min.js"));
    var fonts = document.fonts ? Promise.all(FONTS.map(function (f) { return document.fonts.load(f).catch(function () { return null; }); })) : Promise.resolve();
    return Promise.all([details(), Promise.all(libs), fonts]).then(function (r) { return r[0]; });
  }

  /* ---------- drawing helpers ---------- */
  // Letter-spaced text (canvas letterSpacing isn't available everywhere). Returns the box drawn.
  function spaced(ctx, text, x, y, spacing, align) {
    var chars = Array.from(text), widths = chars.map(function (c) { return ctx.measureText(c).width; });
    var total = widths.reduce(function (a, b) { return a + b; }, 0) + spacing * Math.max(0, chars.length - 1);
    var left = align === "left" ? x : x - total / 2, cx = left, keep = ctx.textAlign;
    ctx.textAlign = "left";
    chars.forEach(function (c, i) { ctx.fillText(c, cx, y); cx += widths[i] + spacing; });
    ctx.textAlign = keep;
    return { x: left, w: total };
  }
  function spacedWidth(ctx, text, spacing) {
    var chars = Array.from(text);
    return chars.reduce(function (s, c) { return s + ctx.measureText(c).width; }, 0) + spacing * Math.max(0, chars.length - 1);
  }
  function fontPx(spec, sizeMm) { return spec.replace("{s}", Math.round(px(sizeMm)) + "px"); }
  // Elliptical radial glow, like the CSS radial-gradient(… ellipse …) of the hero.
  function glow(ctx, cx, cy, rx, ry, color, stop) {
    ctx.save();
    ctx.translate(cx, cy); ctx.scale(1, ry / rx);
    var g = ctx.createRadialGradient(0, 0, 0, 0, 0, rx);
    g.addColorStop(0, color); g.addColorStop(stop, "rgba(0,0,0,0)");
    ctx.fillStyle = g; ctx.fillRect(-rx, -rx, rx * 2, rx * 2);
    ctx.restore();
  }
  function goldGradient(ctx, x0, y0, x1, y1) {
    var g = ctx.createLinearGradient(x0, y0, x1, y1);
    g.addColorStop(0, "#e6d3a3"); g.addColorStop(0.5, "#c4a46a"); g.addColorStop(1, "#9c7e46");
    return g;
  }
  function wrap(ctx, text, maxW) {
    var words = text.split(/\s+/), lines = [], line = "";
    words.forEach(function (w) {
      var t = line ? line + " " + w : w;
      if (ctx.measureText(t).width > maxW && line) { lines.push(line); line = w; } else line = t;
    });
    if (line) lines.push(line);
    return lines;
  }

  // The monogram from the hero: two gold rings, a laurel of 14 leaves, "N & W".
  function monogram(ctx, cx, cy, d, a, b) {
    var s = d / 100, gold = goldGradient(ctx, cx - d / 2, cy - d / 2, cx + d / 2, cy + d / 2);
    ctx.save();
    ctx.translate(cx, cy); ctx.scale(s, s);
    ctx.strokeStyle = goldGradient(ctx, -50, -50, 50, 50);
    ctx.lineWidth = 1; ctx.beginPath(); ctx.arc(0, 0, 46, 0, Math.PI * 2); ctx.stroke();
    ctx.globalAlpha = 0.7; ctx.lineWidth = 0.5; ctx.beginPath(); ctx.arc(0, 0, 42, 0, Math.PI * 2); ctx.stroke();
    ctx.globalAlpha = 1;
    ctx.fillStyle = goldGradient(ctx, -50, -50, 50, 50);
    for (var i = 0; i < 14; i++) {
      var ang = (i / 14) * Math.PI * 2;
      ctx.save();
      ctx.translate(Math.cos(ang) * 39, Math.sin(ang) * 39);
      ctx.rotate(ang + Math.PI / 2);
      ctx.beginPath();
      ctx.moveTo(0, 0); ctx.bezierCurveTo(-2, -2.5, -2, -6, 0, -8); ctx.bezierCurveTo(2, -6, 2, -2.5, 0, 0);
      ctx.fill();
      ctx.restore();
    }
    ctx.restore();
    // initials drawn with the page's fonts
    ctx.save();
    ctx.textBaseline = "alphabetic";
    ctx.font = '400 ' + Math.round(26 * s) + 'px "Pinyon Script"';
    var wa = ctx.measureText(a).width, wb = ctx.measureText(b).width;
    ctx.font = '400 ' + Math.round(12 * s) + 'px "Cormorant Garamond"';
    var amp = " & ", wamp = ctx.measureText(amp).width;
    var x = cx - (wa + wamp + wb) / 2, y = cy + 7 * s;
    ctx.fillStyle = gold;
    ctx.font = '400 ' + Math.round(26 * s) + 'px "Pinyon Script"'; ctx.textAlign = "left";
    ctx.fillText(a, x, y);
    ctx.fillStyle = C.gold; ctx.font = '400 ' + Math.round(12 * s) + 'px "Cormorant Garamond"';
    ctx.fillText(amp, x + wa, y - 2 * s);
    ctx.fillStyle = gold; ctx.font = '400 ' + Math.round(26 * s) + 'px "Pinyon Script"';
    ctx.fillText(b, x + wa + wamp, y);
    ctx.restore();
  }

  /* ---------- the layout (millimetres) ---------- */
  var L = {
    frameInset: 6,
    monoY: 27, monoD: 21,
    dearY: 47.5,
    eyebrowY: 55.5,
    titleY: 77, titleSize: 19.5,
    name1Y: 91, nameSize: 5.9,
    ringsY: 99.2, ringsH: 9.6,
    name2Y: 111.2,
    ruleY: 117.5,
    dateY: 131, dateSize: 10.4,
    whenY: 139,
    venueY: 150, addressY: 156, mapY: 161.5,
    // bottom band, kept left of the bottom-right roses
    qrX: 16.5, qrY: 171, qrSize: 23,
    bandX: 44.5, bandTop: 174.5,
    footY: 200.5
  };

  // Everything shared by all guests: background, roses, frame, names, details, link hints.
  function drawShared(ctx, d, imgs) {
    var links = [];
    // background (the hero's three layers)
    var lin = ctx.createLinearGradient(0, 0, 0, H);
    lin.addColorStop(0, C.plum); lin.addColorStop(0.6, C.plum2); lin.addColorStop(1, C.plum3);
    ctx.fillStyle = lin; ctx.fillRect(0, 0, W, H);
    glow(ctx, W / 2, H * 0.2, W * 0.9, H * 0.6, "rgba(140,106,127,0.5)", 0.7);
    glow(ctx, W / 2, H * 1.1, W * 0.7, H * 0.5, "rgba(196,164,106,0.2)", 0.6);

    // fine gold frame
    ctx.strokeStyle = "rgba(196,164,106,0.55)"; ctx.lineWidth = px(0.3);
    var fi = px(L.frameInset);
    ctx.strokeRect(fi, fi, W - 2 * fi, H - 2 * fi);

    // roses: burgundy branch top-left, burgundy corner bottom-right (mirrored), as on the opening screen
    ctx.save();
    ctx.shadowColor = "rgba(10,4,8,0.55)"; ctx.shadowBlur = px(4); ctx.shadowOffsetY = px(2);
    if (imgs.tl) { var tw = px(70), th = tw * imgs.tl.height / imgs.tl.width; ctx.drawImage(imgs.tl, -px(9), -px(6), tw, th); }
    if (imgs.br) {
      var bw = px(46), bh = bw * imgs.br.height / imgs.br.width;
      ctx.save(); ctx.translate(W + px(9), H + px(10) - bh); ctx.scale(-1, 1); ctx.drawImage(imgs.br, 0, 0, bw, bh); ctx.restore();
    }
    ctx.restore();

    ctx.textAlign = "center"; ctx.textBaseline = "alphabetic";
    var cx = W / 2;
    var first = function (n) { return String(n).split(" ")[0]; };
    monogram(ctx, cx, px(L.monoY), px(L.monoD), first(d.couple.partnerOne).charAt(0), first(d.couple.partnerTwo).charAt(0));

    ctx.fillStyle = "rgba(247,242,233,0.78)"; ctx.font = fontPx('400 {s} "Jost"', 2.55);
    spaced(ctx, d.invitationLine.toUpperCase(), cx, px(L.eyebrowY), px(2.55) * 0.32);

    ctx.fillStyle = C.ivoryHi; ctx.font = fontPx('400 {s} "Pinyon Script"', L.titleSize);
    ctx.save(); ctx.shadowColor = "rgba(0,0,0,0.25)"; ctx.shadowBlur = px(1.5);
    ctx.fillText(d.title, cx, px(L.titleY)); ctx.restore();

    ctx.fillStyle = C.ivory; ctx.font = fontPx('500 {s} "Cormorant Garamond"', L.nameSize);
    var nsp = px(L.nameSize) * 0.24;
    spaced(ctx, d.couple.partnerOne.toUpperCase(), cx, px(L.name1Y), nsp);
    if (imgs.rings) {
      var rh = px(L.ringsH), rw = rh * imgs.rings.width / imgs.rings.height;
      ctx.save(); ctx.shadowColor = "rgba(0,0,0,0.45)"; ctx.shadowBlur = px(1.6); ctx.shadowOffsetY = px(0.6);
      ctx.drawImage(imgs.rings, cx - rw / 2, px(L.ringsY) - rh / 2, rw, rh); ctx.restore();
    } else {
      ctx.font = fontPx('400 {s} "Cormorant Garamond"', 7); ctx.fillText("&", cx, px(L.ringsY + 2));
      ctx.font = fontPx('500 {s} "Cormorant Garamond"', L.nameSize);
    }
    spaced(ctx, d.couple.partnerTwo.toUpperCase(), cx, px(L.name2Y), nsp);

    // gold rule with a diamond
    ctx.strokeStyle = "rgba(196,164,106,0.85)"; ctx.lineWidth = px(0.25);
    var ry = px(L.ruleY), half = px(19), gap = px(2.2);
    ctx.beginPath(); ctx.moveTo(cx - half, ry); ctx.lineTo(cx - gap, ry); ctx.moveTo(cx + gap, ry); ctx.lineTo(cx + half, ry); ctx.stroke();
    ctx.fillStyle = C.gold; var dm = px(1.1);
    ctx.beginPath(); ctx.moveTo(cx, ry - dm); ctx.lineTo(cx + dm, ry); ctx.lineTo(cx, ry + dm); ctx.lineTo(cx - dm, ry); ctx.closePath(); ctx.fill();

    ctx.fillStyle = C.champagne; ctx.font = fontPx('500 {s} "Cormorant Garamond"', L.dateSize);
    spaced(ctx, d.dottedDate, cx, px(L.dateY), px(L.dateSize) * 0.18);

    ctx.fillStyle = "rgba(247,242,233,0.9)"; ctx.font = fontPx('400 {s} "Jost"', 2.75);
    spaced(ctx, (d.weekday + " · Arrival " + d.arrival + " · Ceremony " + d.ceremony).toUpperCase(), cx, px(L.whenY), px(2.75) * 0.26);

    // venue: name, address, and a quiet hint; the whole block opens Google Maps
    ctx.fillStyle = C.ivory; ctx.font = fontPx('italic 400 {s} "Cormorant Garamond"', 6);
    var vw = ctx.measureText(d.venue.name).width;
    ctx.fillText(d.venue.name, cx, px(L.venueY));
    ctx.fillStyle = "rgba(247,242,233,0.75)"; ctx.font = fontPx('400 {s} "Jost"', 2.35);
    var addr = (d.venue.addressLine + ", " + d.venue.city).toUpperCase();
    var aw = spacedWidth(ctx, addr, px(2.35) * 0.2);
    spaced(ctx, addr, cx, px(L.addressY), px(2.35) * 0.2);
    ctx.fillStyle = C.gold; ctx.font = fontPx('500 {s} "Jost"', 2.15);
    var hint = "OPEN IN GOOGLE MAPS";
    var hw = spacedWidth(ctx, hint, px(2.15) * 0.3);
    spaced(ctx, hint, cx, px(L.mapY), px(2.15) * 0.3);
    var vbw = Math.max(vw, aw, hw) / MM + 4;
    links.push({ x: PW / 2 - vbw / 2, y: L.venueY - 6, w: vbw, h: L.mapY - L.venueY + 7.5, url: d.venue.mapsUrl });

    // bottom band: QR tile (the code itself is per guest), then the guest's details
    var q = L.qrSize;
    ctx.fillStyle = C.tile; ctx.strokeStyle = "rgba(196,164,106,0.8)"; ctx.lineWidth = px(0.3);
    roundRect(ctx, px(L.qrX), px(L.qrY), px(q), px(q), px(1.6)); ctx.fill(); ctx.stroke();

    var bx = px(L.bandX), y = px(L.bandTop);
    ctx.textAlign = "left";
    ctx.fillStyle = C.gold; ctx.font = fontPx('500 {s} "Jost"', 2.1);
    spaced(ctx, "YOUR PERSONAL INVITATION & RSVP", bx, y, px(2.1) * 0.24, "left");
    // (the web address line is drawn per guest; the box is linked per guest)
    var py = y + px(10.6);
    ctx.fillStyle = "rgba(247,242,233,0.82)"; ctx.font = fontPx('400 {s} "Jost"', 2.35);
    var label = "RSVP BY PHONE  ";
    spaced(ctx, label, bx, py, px(2.35) * 0.12, "left");
    var lx = bx + spacedWidth(ctx, label, px(2.35) * 0.12);
    ctx.fillStyle = C.ivory; ctx.font = fontPx('500 {s} "Jost"', 2.45);
    (d.phones || []).forEach(function (ph, i) {
      var t = (i ? "  ·  " : "") + ph;
      var w = ctx.measureText(t).width;
      ctx.fillText(t, lx, py);
      var lead = i ? ctx.measureText("  ·  ").width : 0;
      links.push({ x: (lx + lead) / MM - 0.5, y: py / MM - 3.2, w: (w - lead) / MM + 1, h: 4.4, url: "tel:" + toIntl(ph) });
      lx += w;
    });
    var dy = py + px(5.4);
    ctx.fillStyle = "rgba(247,242,233,0.82)"; ctx.font = fontPx('400 {s} "Jost"', 2.35);
    spaced(ctx, "DRESS CODE  ", bx, dy, px(2.35) * 0.12, "left");
    var dx = bx + spacedWidth(ctx, "DRESS CODE  ", px(2.35) * 0.12);
    ctx.fillStyle = C.ivory; ctx.font = fontPx('italic 400 {s} "Cormorant Garamond"', 3.5);
    ctx.fillText(d.dressCode.theme.replace(/\s*•\s*/g, " & "), dx, dy);
    ctx.fillStyle = "rgba(247,242,233,0.7)"; ctx.font = fontPx('400 {s} "Jost"', 2.15);
    ctx.fillText(d.dressCode.palette.join(" · "), bx, dy + px(4.2));

    // footer: the two house rules, centred, clear of the roses
    ctx.textAlign = "center";
    ctx.fillStyle = "rgba(247,242,233,0.62)"; ctx.font = fontPx('400 {s} "Jost"', 2.0);
    spaced(ctx, "STRICTLY BY RSVP & INVITATION  ·  KINDLY, NO CHILDREN", W / 2 - px(9), px(L.footY), px(2.0) * 0.22);
    return links;
  }

  function roundRect(ctx, x, y, w, h, r) {
    ctx.beginPath();
    ctx.moveTo(x + r, y); ctx.lineTo(x + w - r, y); ctx.quadraticCurveTo(x + w, y, x + w, y + r);
    ctx.lineTo(x + w, y + h - r); ctx.quadraticCurveTo(x + w, y + h, x + w - r, y + h);
    ctx.lineTo(x + r, y + h); ctx.quadraticCurveTo(x, y + h, x, y + h - r);
    ctx.lineTo(x, y + r); ctx.quadraticCurveTo(x, y, x + r, y); ctx.closePath();
  }
  // any form of a number → "+<country><number>" (same rules as WNPhone.toInternational)
  function toIntl(ph) {
    if (global.WNPhone && global.WNPhone.toInternational) return global.WNPhone.toInternational(ph);
    var s = String(ph || "").trim(), digits = s.replace(/\D/g, "");
    var intl = s.charAt(0) === "+" || digits.indexOf("00") === 0;
    if (digits.indexOf("00") === 0) digits = digits.slice(2);
    if (!intl && digits.charAt(0) === "0") digits = "263" + digits.slice(1);
    else if (!intl && digits.length <= 9) digits = "263" + digits;
    return "+" + digits;
  }
  function shortLink(link) { return String(link).replace(/^https?:\/\//, "").replace(/\/$/, ""); }

  // The per-guest pieces, drawn into their own transparent strips.
  function nameStrip(name) {
    var c = document.createElement("canvas"); c.width = Math.round(px(120)); c.height = Math.round(px(9));
    var ctx = c.getContext("2d");
    ctx.fillStyle = C.champagne; ctx.textAlign = "center"; ctx.textBaseline = "alphabetic";
    var size = 5.3;
    ctx.font = fontPx('italic 400 {s} "Cormorant Garamond"', size);
    while (ctx.measureText(name).width > c.width - px(4) && size > 3) { size -= 0.2; ctx.font = fontPx('italic 400 {s} "Cormorant Garamond"', size); }
    ctx.fillText(name, c.width / 2, px(6.2));
    return c;
  }
  function linkStrip(link) {
    var c = document.createElement("canvas"); c.width = Math.round(px(62)); c.height = Math.round(px(6.4));
    var ctx = c.getContext("2d");
    var text = shortLink(link), size = 3.9;
    ctx.fillStyle = C.ivory; ctx.textBaseline = "alphabetic";
    ctx.font = fontPx('italic 400 {s} "Cormorant Garamond"', size);
    while (ctx.measureText(text).width > c.width - px(1) && size > 2.4) { size -= 0.15; ctx.font = fontPx('italic 400 {s} "Cormorant Garamond"', size); }
    ctx.fillText(text, 0, px(4.6));
    return { canvas: c, widthMm: Math.min(62, ctx.measureText(text).width / MM + 0.5) };
  }
  function qrCanvas(link) {
    var holder = document.createElement("div");
    new global.QRCode(holder, { text: link, width: 600, height: 600, colorDark: C.plum, colorLight: C.tile, correctLevel: global.QRCode.CorrectLevel.M });
    return holder.querySelector("canvas");
  }

  var sharedCache = null;
  function shared(d) {
    if (sharedCache) return sharedCache;
    sharedCache = Promise.all([loadImage(d.images.topLeft), loadImage(d.images.bottomRight), loadImage(d.images.rings)]).then(function (im) {
      var c = document.createElement("canvas"); c.width = W; c.height = H;
      var links = drawShared(c.getContext("2d"), d, { tl: im[0], br: im[1], rings: im[2] });
      return { canvas: c, jpeg: c.toDataURL("image/jpeg", 0.9), links: links };
    }).catch(function (e) { sharedCache = null; throw e; });
    return sharedCache;
  }

  function addGuestPage(doc, d, base, guest, first) {
    if (!first) doc.addPage([PW, PH], "portrait");
    doc.addImage(base.jpeg, "JPEG", 0, 0, PW, PH, "wn-base", "FAST");
    if (guest.name) doc.addImage(nameStrip("Dear " + guest.name).toDataURL("image/png"), "PNG", (PW - 120) / 2, L.dearY - 6.2, 120, 9, undefined, "FAST");
    var q = L.qrSize, pad = 1.6;
    doc.addImage(qrCanvas(guest.link).toDataURL("image/png"), "PNG", L.qrX + pad, L.qrY + pad, q - 2 * pad, q - 2 * pad, undefined, "FAST");
    var ls = linkStrip(guest.link);
    doc.addImage(ls.canvas.toDataURL("image/png"), "PNG", L.bandX, L.bandTop + 1.4, 62, 6.4, undefined, "FAST");
    // links: shared ones (venue, phones) plus this guest's own invitation
    base.links.forEach(function (l) { doc.link(l.x, l.y, l.w, l.h, { url: l.url }); });
    doc.link(L.qrX, L.qrY, q, q, { url: guest.link });
    doc.link(L.bandX - 0.5, L.bandTop + 1.2, ls.widthMm + 1, 6.4, { url: guest.link });
    // invisible text so the PDF is searchable and readable by screen readers
    doc.setFontSize(9);
    var lines = [
      (guest.name ? "Dear " + guest.name + ". " : "") + d.invitationLine + ": " + d.title + ", " + d.couple.partnerOne + " and " + d.couple.partnerTwo + ".",
      d.weekday + " " + d.longDate + ". Arrival " + d.arrival + ", ceremony " + d.ceremony + ".",
      d.venue.name + ", " + d.venue.addressLine + ", " + d.venue.city + ". Map: " + d.venue.mapsUrl,
      "Your invitation and RSVP: " + guest.link + ". RSVP by phone: " + (d.phones || []).join(", ") + ".",
    ];
    lines.forEach(function (t, i) { doc.text(t, 10, 20 + i * 4, { renderingMode: "invisible", maxWidth: 128 }); });
  }

  function build(guests, onProgress) {
    return ready().then(function (d) {
      return shared(d).then(function (base) {
        var doc = new global.jspdf.jsPDF({ unit: "mm", format: [PW, PH], orientation: "portrait", compress: true });
        var title = d.couple.partnerOne.split(" ")[0] + " & " + d.couple.partnerTwo.split(" ")[0] + " · Wedding Invitation";
        doc.setProperties({ title: guests.length === 1 && guests[0].name ? title + " · " + guests[0].name : title, subject: d.longDate + " · " + d.venue.name, author: d.couple.partnerOne + " & " + d.couple.partnerTwo, creator: "e-Guests" });
        var i = 0;
        return new Promise(function (resolve, reject) {
          // a few pages per tick so big batches keep the page responsive
          (function step() {
            try {
              var end = Math.min(guests.length, i + 6);
              for (; i < end; i++) addGuestPage(doc, d, base, guests[i], i === 0);
              if (onProgress) onProgress(i, guests.length);
              if (i < guests.length) setTimeout(step, 0); else resolve(doc.output("blob"));
            } catch (e) { reject(e); }
          })();
        });
      });
    });
  }

  function save(blob, fileName) {
    var a = document.createElement("a");
    a.href = URL.createObjectURL(blob);
    a.download = fileName;
    document.body.appendChild(a); a.click(); a.remove();
    setTimeout(function () { URL.revokeObjectURL(a.href); }, 10000);
  }

  // Preview of one page as a canvas (same drawing, links not shown).
  function preview(guest) {
    return ready().then(function (d) {
      return shared(d).then(function (base) {
        var c = document.createElement("canvas"); c.width = W; c.height = H;
        var ctx = c.getContext("2d");
        ctx.drawImage(base.canvas, 0, 0);
        if (guest.name) ctx.drawImage(nameStrip("Dear " + guest.name), px((PW - 120) / 2), px(L.dearY - 6.2));
        var q = L.qrSize, pad = 1.6;
        ctx.drawImage(qrCanvas(guest.link), px(L.qrX + pad), px(L.qrY + pad), px(q - 2 * pad), px(q - 2 * pad));
        ctx.drawImage(linkStrip(guest.link).canvas, px(L.bandX), px(L.bandTop + 1.4));
        return c;
      });
    });
  }

  global.WNInvitationPDF = {
    build: build,
    preview: preview,
    download: function (guests, fileName, onProgress) {
      return build(guests, onProgress).then(function (blob) { save(blob, fileName); return blob; });
    },
    fileName: function (name) {
      return "Nyasha-Watson-Invitation" + (name ? "-" + String(name).replace(/[^\p{L}\p{N}]+/gu, "-").replace(/^-|-$/g, "") : "") + ".pdf";
    }
  };
})(typeof window !== "undefined" ? window : this);
