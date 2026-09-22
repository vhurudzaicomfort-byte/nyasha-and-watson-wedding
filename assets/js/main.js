(function () {
  "use strict";

  /* ---------------- CONFIG ---------------- */
  var RSVP_WHATSAPP_NUMBER = "263772692738";
  var WEDDING_DATE_ISO = "2026-12-05T09:00:00+02:00"; // Harare (CAT, UTC+2) — ceremony at 9:00 AM
  var VENUE_NAME = "Colne Valley Nature Reserve Park";
  var VENUE_ADDRESS = "7 Bay Noakes, Colne Valley, Chisipite, Harare, Zimbabwe";

  var PROGRAMME = [
    { t: "8:30 AM", title: "Guest Arrival", desc: "Please arrive in good time before the ceremony begins." },
    { t: "9:00 AM", title: "Ceremony", desc: "Nyasha & Watson exchange their vows." },
    { t: "10:00 AM", title: "Photographs", desc: "Family and wedding party photographs." },
    { t: "11:00 AM", title: "Cocktail Reception", desc: "Drinks and canapés while the newlyweds are photographed." },
    { t: "12:30 PM", title: "Reception & Speeches", desc: "Guests are seated; speeches and toasts follow." },
    { t: "1:30 PM", title: "Lunch", desc: "A shared meal to celebrate the day." },
    { t: "2:30 PM", title: "Cake Cutting & First Dance", desc: "A sweet moment before the dance floor opens." },
    { t: "3:00 PM", title: "Celebration", desc: "Dancing and celebration continue into the afternoon." }
  ];

  /* ---------------- COVER ---------------- */
  var cover = document.getElementById("cover");
  var body = document.body;
  body.classList.add("locked");
  document.getElementById("openInviteBtn").addEventListener("click", function () {
    cover.classList.add("opened");
    body.classList.remove("locked");
  });

  /* ---------------- NAV active state (mobile) ---------------- */
  var sections = ["home", "venue", "programme", "rsvp"];
  var navLinks = document.querySelectorAll(".bottomnav a");
  function setActive() {
    var pos = window.scrollY + window.innerHeight * 0.35;
    var current = "home";
    sections.forEach(function (id) {
      var el = document.getElementById(id);
      if (el && el.offsetTop <= pos) current = id;
    });
    navLinks.forEach(function (a) { a.classList.toggle("active", a.dataset.sec === current); });
  }
  window.addEventListener("scroll", setActive, { passive: true });
  setActive();

  /* ---------------- COUNTDOWN ---------------- */
  var target = new Date(WEDDING_DATE_ISO).getTime();
  function tick() {
    var now = Date.now();
    var diff = Math.max(0, target - now);
    var d = Math.floor(diff / 86400000);
    var h = Math.floor((diff % 86400000) / 3600000);
    var m = Math.floor((diff % 3600000) / 60000);
    var s = Math.floor((diff % 60000) / 1000);
    document.getElementById("cd-days").textContent = d;
    document.getElementById("cd-hours").textContent = String(h).padStart(2, "0");
    document.getElementById("cd-mins").textContent = String(m).padStart(2, "0");
    document.getElementById("cd-secs").textContent = String(s).padStart(2, "0");
  }
  tick();
  setInterval(tick, 1000);

  /* ---------------- PROGRAMME RENDER ---------------- */
  document.getElementById("programmeList").innerHTML = PROGRAMME.map(function (item) {
    return '<div class="t-item"><div class="t-time">' + item.t + '</div><div class="t-dot"></div><div class="t-body"><div class="t-title">' + item.title + '</div><div class="t-desc">' + item.desc + "</div></div></div>";
  }).join("");

  /* ---------------- CALENDAR LINKS ---------------- */
  function pad(n) { return String(n).padStart(2, "0"); }
  function toUtcStamp(d) { return d.getUTCFullYear() + pad(d.getUTCMonth() + 1) + pad(d.getUTCDate()) + "T" + pad(d.getUTCHours()) + pad(d.getUTCMinutes()) + "00Z"; }
  var wd = new Date(WEDDING_DATE_ISO);
  var endD = new Date(wd.getTime() + 8 * 3600000); // ceremony 9:00 AM through ~5:00 PM
  var startStr = toUtcStamp(wd);
  var endStr = toUtcStamp(endD);
  var calTitle = "Nyasha & Watson's Wedding";
  var calDetails = "Ceremony at 9:00 AM, reception to follow. Strictly by invitation only. We can't wait to celebrate with you!";
  var gcalUrl = "https://calendar.google.com/calendar/render?action=TEMPLATE&text=" + encodeURIComponent(calTitle) +
    "&dates=" + startStr + "/" + endStr +
    "&details=" + encodeURIComponent(calDetails) +
    "&location=" + encodeURIComponent(VENUE_NAME + ", " + VENUE_ADDRESS);
  document.getElementById("gcalBtn").href = gcalUrl;

  document.getElementById("icsBtn").addEventListener("click", function () {
    var uid = "nyasha-watson-wedding-" + Date.now() + "@invitation";
    var stamp = toUtcStamp(new Date());
    var ics = [
      "BEGIN:VCALENDAR", "VERSION:2.0", "PRODID:-//Nyasha & Watson Wedding//EN", "CALSCALE:GREGORIAN", "METHOD:PUBLISH",
      "BEGIN:VEVENT",
      "UID:" + uid,
      "DTSTAMP:" + stamp,
      "DTSTART:" + startStr,
      "DTEND:" + endStr,
      "SUMMARY:" + calTitle,
      "DESCRIPTION:" + calDetails.replace(/,/g, "\\,"),
      "LOCATION:" + (VENUE_NAME + ", " + VENUE_ADDRESS).replace(/,/g, "\\,"),
      "END:VEVENT", "END:VCALENDAR"
    ].join("\r\n");
    var blob = new Blob([ics], { type: "text/calendar;charset=utf-8" });
    var url = URL.createObjectURL(blob);
    var a = document.createElement("a");
    a.href = url; a.download = "Nyasha-Watson-Wedding.ics";
    document.body.appendChild(a); a.click(); document.body.removeChild(a);
    setTimeout(function () { URL.revokeObjectURL(url); }, 4000);
  });

  /* ---------------- RSVP WIZARD ---------------- */
  var state = { step: 0, name: "", phone: "", attend: "", guests: 1, plusone: "", diet: ["None"], dietOther: "", message: "" };
  var stepsEls = document.querySelectorAll(".rsvp-step");
  var segs = document.querySelectorAll(".rp-seg");

  function showStep(n) {
    stepsEls.forEach(function (el) { el.hidden = el.dataset.step != n; });
    segs.forEach(function (seg) { seg.classList.toggle("done", Number(seg.dataset.step) <= n); });
    state.step = n;
  }

  document.getElementById("toStep1").addEventListener("click", function () {
    var name = document.getElementById("g-name").value.trim();
    if (!name) { document.getElementById("g-name").focus(); return; }
    state.name = name;
    state.phone = document.getElementById("g-phone").value.trim();
    showStep(1);
  });
  document.getElementById("back1").addEventListener("click", function () { showStep(0); });

  var attendChoices = document.getElementById("attendChoices");
  attendChoices.querySelectorAll("input[name=attend]").forEach(function (input) {
    input.addEventListener("change", function () {
      attendChoices.querySelectorAll(".choice-card").forEach(function (c) { c.classList.remove("selected"); });
      input.closest(".choice-card").classList.add("selected");
      state.attend = input.value;
      document.getElementById("toStep2").disabled = false;
    });
  });

  document.getElementById("toStep2").addEventListener("click", function () {
    document.getElementById("branchAttending").hidden = state.attend !== "attending";
    document.getElementById("branchMaybe").hidden = state.attend !== "maybe";
    document.getElementById("branchDecline").hidden = state.attend !== "not_attending";
    showStep(2);
  });
  document.getElementById("back2").addEventListener("click", function () { showStep(1); });

  var guestCountEl = document.getElementById("guestCount");
  document.getElementById("incGuests").addEventListener("click", function () { state.guests = Math.min(10, state.guests + 1); guestCountEl.textContent = state.guests; });
  document.getElementById("decGuests").addEventListener("click", function () { state.guests = Math.max(1, state.guests - 1); guestCountEl.textContent = state.guests; });

  var dietChips = document.getElementById("dietChips");
  dietChips.querySelectorAll(".chip").forEach(function (chip) {
    chip.addEventListener("click", function () {
      var val = chip.dataset.val;
      if (val === "None") {
        dietChips.querySelectorAll(".chip").forEach(function (c) { c.classList.remove("selected"); });
        chip.classList.add("selected");
        state.diet = ["None"];
      } else {
        dietChips.querySelector('.chip[data-val="None"]').classList.remove("selected");
        chip.classList.toggle("selected");
        state.diet = Array.from(dietChips.querySelectorAll(".chip.selected")).map(function (c) { return c.dataset.val; });
        if (state.diet.length === 0) { dietChips.querySelector('.chip[data-val="None"]').classList.add("selected"); state.diet = ["None"]; }
      }
      document.getElementById("dietOtherWrap").hidden = state.diet.indexOf("Other") === -1;
    });
  });

  document.getElementById("toStep3").addEventListener("click", function () {
    if (state.attend === "attending") {
      state.plusone = document.getElementById("g-plusone").value.trim();
      state.dietOther = document.getElementById("g-diet-other").value.trim();
      state.message = document.getElementById("g-message").value.trim();
    } else if (state.attend === "maybe") {
      state.message = document.getElementById("g-message-maybe").value.trim();
    } else {
      state.message = document.getElementById("g-message-decline").value.trim();
    }
    buildSummary();
    showStep(3);
    document.getElementById("reviewPane").hidden = false;
    document.getElementById("confirmPane").hidden = true;
  });
  document.getElementById("back3").addEventListener("click", function () { showStep(2); });

  function attendLabel(v) { return v === "attending" ? "Joyfully Accepting" : v === "maybe" ? "Not Sure Yet" : "Regretfully Declining"; }

  function buildSummary() {
    var rows = [["Name", state.name], ["Response", attendLabel(state.attend)]];
    if (state.phone) rows.push(["Phone", state.phone]);
    if (state.attend === "attending") {
      rows.push(["Party size", state.guests + (state.guests > 1 ? " guests" : " guest")]);
      if (state.plusone) rows.push(["Additional guest(s)", state.plusone]);
      var dietStr = state.diet.map(function (d) { return d === "Other" && state.dietOther ? state.dietOther : d; }).join(", ");
      rows.push(["Dietary", dietStr]);
    }
    if (state.message) rows.push(["Message", state.message]);
    document.getElementById("summaryList").innerHTML = rows.map(function (r) {
      return '<div class="summary-row"><div class="sr-k">' + r[0] + '</div><div class="sr-v">' + escapeHtml(r[1]) + "</div></div>";
    }).join("");
  }
  function escapeHtml(s) { return String(s).replace(/[&<>"']/g, function (c) { return { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]; }); }

  document.getElementById("sendRsvp").addEventListener("click", function () {
    var lines = [];
    lines.push("Hello Nyasha & Watson! This is my RSVP for your wedding on 5 December 2026:");
    lines.push("");
    lines.push("Name: " + state.name);
    if (state.phone) lines.push("Phone: " + state.phone);
    lines.push("Response: " + attendLabel(state.attend));
    if (state.attend === "attending") {
      lines.push("Party size: " + state.guests);
      if (state.plusone) lines.push("Additional guest(s): " + state.plusone);
      var dietStr = state.diet.map(function (d) { return d === "Other" && state.dietOther ? state.dietOther : d; }).join(", ");
      lines.push("Dietary requirements: " + dietStr);
    }
    if (state.message) lines.push("Message: " + state.message);
    var text = lines.join("\n");
    var url = "https://wa.me/" + RSVP_WHATSAPP_NUMBER + "?text=" + encodeURIComponent(text);
    window.open(url, "_blank", "noopener");
    document.getElementById("reviewPane").hidden = true;
    document.getElementById("confirmPane").hidden = false;
    document.getElementById("confirmName").textContent = ", " + state.name;
  });

  /* ---------------- INVITATION CARD (canvas, live preview + download) ---------------- */
  function loadFonts() {
    var specs = ['400 90px "Great Vibes"', '600 30px "Bodoni Moda"', '400 26px "Poppins"', 'italic 400 26px "Bodoni Moda"'];
    if (!(document.fonts && document.fonts.load)) return Promise.resolve();
    return Promise.all(specs.map(function (s) { return document.fonts.load(s).catch(function () {}); })).then(function () {
      return document.fonts.ready;
    });
  }

  function makeQrDataUrl(text) {
    return new Promise(function (resolve) {
      if (!window.QRCode) { resolve(null); return; }
      var el = document.getElementById("qrTemp");
      el.innerHTML = "";
      try {
        new QRCode(el, { text: text, width: 300, height: 300, colorDark: "#3E1730", colorLight: "#FBF7F0", correctLevel: QRCode.CorrectLevel.M });
        setTimeout(function () {
          var c = el.querySelector("canvas");
          resolve(c ? c.toDataURL("image/png") : null);
        }, 160);
      } catch (e) { resolve(null); }
    });
  }

  function loadImage(src) {
    return new Promise(function (resolve) {
      var img = new Image();
      img.onload = function () { resolve(img); };
      img.onerror = function () { resolve(null); };
      img.src = src;
    });
  }

  function drawCard(ctx, w, h, qrImg, floralImg, guestName) {
    ctx.clearRect(0, 0, w, h);
    ctx.fillStyle = "#FBF7F0"; ctx.fillRect(0, 0, w, h);

    if (floralImg) {
      var iw = 360, ih = Math.round(iw * floralImg.naturalHeight / floralImg.naturalWidth);
      // bottom-left: bleeds off the left/bottom edges, densest bloom near the corner
      ctx.drawImage(floralImg, -50, h - ih + 50, iw, ih);
      // top-right: same artwork rotated 180° about its own centre so the dense bloom
      // (originally bottom-left in the source image) lands in the top-right corner
      ctx.save();
      ctx.translate(w - 130, 89);
      ctx.rotate(Math.PI);
      ctx.drawImage(floralImg, -iw / 2, -ih / 2, iw, ih);
      ctx.restore();
    }

    ctx.strokeStyle = "#B08A46"; ctx.lineWidth = 3; ctx.strokeRect(34, 34, w - 68, h - 68);
    ctx.strokeStyle = "#E4D2B0"; ctx.lineWidth = 1; ctx.strokeRect(50, 50, w - 100, h - 100);
    ctx.textAlign = "center";

    ctx.fillStyle = "#8B7A6E"; ctx.font = '500 20px "Poppins", sans-serif';
    ctx.fillText("T O G E T H E R   W I T H   T H E I R   F A M I L I E S", w / 2, 108);
    ctx.font = 'italic 400 22px "Bodoni Moda", serif'; ctx.fillStyle = "#5A2444";
    ctx.fillText("You are warmly invited to the wedding of", w / 2, 145);

    ctx.fillStyle = "#3E1730"; ctx.font = '400 118px "Great Vibes", cursive';
    ctx.fillText("Nyasha", w / 2, 265);
    ctx.font = '600 26px "Bodoni Moda", serif'; ctx.fillStyle = "#5A2444";
    ctx.fillText("M A Z U R U S E", w / 2, 308);

    ctx.fillStyle = "#D97F55"; ctx.font = '400 66px "Great Vibes", cursive';
    ctx.fillText("&", w / 2, 372);

    ctx.fillStyle = "#3E1730"; ctx.font = '400 118px "Great Vibes", cursive';
    ctx.fillText("Watson", w / 2, 495);
    ctx.font = '600 26px "Bodoni Moda", serif'; ctx.fillStyle = "#5A2444";
    ctx.fillText("C H I M O M B E", w / 2, 538);

    ctx.strokeStyle = "#E4D2B0"; ctx.beginPath(); ctx.moveTo(w / 2 - 150, 572); ctx.lineTo(w / 2 + 150, 572); ctx.stroke();
    ctx.font = 'italic 400 23px "Bodoni Moda", serif'; ctx.fillStyle = "#5A2444";
    ctx.fillText("As they celebrate their love", w / 2, 608);
    ctx.fillText("and begin a new chapter together", w / 2, 637);

    // date block
    ctx.font = '500 22px "Poppins", sans-serif'; ctx.fillStyle = "#5A2444";
    ctx.fillText("S A T U R D A Y", w / 2 - 245, 700);
    ctx.fillText("D E C E M B E R   2 0 2 6", w / 2 + 235, 700);
    ctx.strokeStyle = "#D97F55"; ctx.beginPath(); ctx.moveTo(w / 2 - 385, 693); ctx.lineTo(w / 2 - 320, 693); ctx.stroke();
    ctx.beginPath(); ctx.moveTo(w / 2 + 320, 693); ctx.lineTo(w / 2 + 385, 693); ctx.stroke();
    ctx.fillStyle = "#D97F55"; ctx.font = '600 58px "Bodoni Moda", serif';
    ctx.fillText("05", w / 2, 768);

    ctx.fillStyle = "#5A2444"; ctx.font = '600 25px "Bodoni Moda", serif';
    ctx.fillText("COLNE VALLEY NATURE RESERVE PARK", w / 2, 828);
    ctx.fillStyle = "#8B7A6E"; ctx.font = '400 19px "Poppins", sans-serif';
    ctx.fillText("7 Bay Noakes, Colne Valley, Chisipite,", w / 2, 858);
    ctx.fillText("Harare, Zimbabwe", w / 2, 882);

    ctx.strokeStyle = "#E4D2B0"; ctx.beginPath(); ctx.moveTo(w / 2 - 150, 910); ctx.lineTo(w / 2 + 150, 910); ctx.stroke();

    ctx.fillStyle = "#5A2444"; ctx.font = 'italic 400 23px "Bodoni Moda", serif';
    ctx.fillText('"Above all, love each other deeply,', w / 2, 944);
    ctx.fillText("because love covers over a multitude of sins.\"", w / 2, 972);
    ctx.font = '600 17px "Poppins", sans-serif'; ctx.fillStyle = "#8B7A6E";
    ctx.fillText("1   P E T E R   4 : 8", w / 2, 1000);

    if (guestName) {
      ctx.font = '500 13px "Poppins", sans-serif'; ctx.fillStyle = "#B08A46";
      ctx.fillText("R E S E R V E D   F O R", w / 2, 1030);
      ctx.font = 'italic 400 25px "Bodoni Moda", serif'; ctx.fillStyle = "#3E1730";
      ctx.fillText(guestName, w / 2, 1058);
    }
    ctx.font = '500 14px "Poppins", sans-serif'; ctx.fillStyle = "#8B7A6E";
    ctx.fillText("S T R I C T L Y   B Y   I N V I T A T I O N   O N L Y", w / 2, 1088);

    var qs = 150;
    var qrTop = 1114;
    if (qrImg) {
      ctx.drawImage(qrImg, w / 2 - qs / 2, qrTop, qs, qs);
    } else {
      ctx.strokeStyle = "#E4D2B0"; ctx.strokeRect(w / 2 - qs / 2, qrTop, qs, qs);
    }
    ctx.fillStyle = "#8B7A6E"; ctx.font = '500 16px "Poppins", sans-serif';
    ctx.fillText("SCAN FOR RSVP & WEDDING DETAILS", w / 2, qrTop + qs + 28);
  }

  var cachedQrImg = null, cachedFloralImg = null;
  var cardCanvas = document.getElementById("inviteCanvas");
  var cardCtx = cardCanvas.getContext("2d");

  function redrawCard() {
    if (!cachedQrImg && !cachedFloralImg) return;
    var name = (document.getElementById("g-card-name").value || "").trim();
    drawCard(cardCtx, cardCanvas.width, cardCanvas.height, cachedQrImg, cachedFloralImg, name);
  }

  function renderCard() {
    var url = location.origin + location.pathname;
    Promise.all([loadFonts(), makeQrDataUrl(url), loadImage("assets/img/floral-corner.png")]).then(function (res) {
      cachedFloralImg = res[2];
      var qrDataUrl = res[1];
      if (qrDataUrl) {
        loadImage(qrDataUrl).then(function (img) { cachedQrImg = img; redrawCard(); });
      } else {
        redrawCard();
      }
    });
  }
  renderCard();

  /* Keep the RSVP name field and the card's personalisation field in sync */
  var rsvpNameInput = document.getElementById("g-name");
  var cardNameInput = document.getElementById("g-card-name");
  rsvpNameInput.addEventListener("input", function () { cardNameInput.value = rsvpNameInput.value; redrawCard(); });
  cardNameInput.addEventListener("input", function () { rsvpNameInput.value = cardNameInput.value; redrawCard(); });

  document.getElementById("saveCardBtn").addEventListener("click", function () {
    var canvas = document.getElementById("inviteCanvas");
    canvas.toBlob(function (blob) {
      if (!blob) return;
      var url = URL.createObjectURL(blob);
      var a = document.createElement("a");
      a.href = url; a.download = "Nyasha-Watson-Invitation.png";
      document.body.appendChild(a); a.click(); document.body.removeChild(a);
      setTimeout(function () { URL.revokeObjectURL(url); }, 4000);
      showToast("Invitation card downloaded");
    }, "image/png");
  });

  var toastTimer;
  function showToast(msg) {
    var t = document.getElementById("toast");
    t.textContent = msg; t.classList.add("show");
    clearTimeout(toastTimer);
    toastTimer = setTimeout(function () { t.classList.remove("show"); }, 2400);
  }
})();
