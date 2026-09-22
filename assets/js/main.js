(function () {
  "use strict";

  /* ---------------- CONFIG ---------------- */
  // TODO: replace with the couple's real WhatsApp number — digits only, country code first, no + or spaces.
  var RSVP_WHATSAPP_NUMBER = "000000000000";
  var WEDDING_DATE_ISO = "2026-12-05T00:00:00+02:00"; // Harare (CAT, UTC+2)
  var VENUE_NAME = "Colne Valley Nature Reserve Park";
  var VENUE_ADDRESS = "7 Bay Noakes, Colne Valley, Chisipite, Harare, Zimbabwe";

  var PROGRAMME = [
    { t: "TBC", title: "Guest Arrival", desc: "Please arrive in good time before the ceremony begins." },
    { t: "TBC", title: "Ceremony", desc: "Nyasha & Watson exchange their vows." },
    { t: "TBC", title: "Photographs", desc: "Family and wedding party photographs." },
    { t: "TBC", title: "Cocktail Reception", desc: "Drinks and canapés while the newlyweds are photographed." },
    { t: "TBC", title: "Reception & Speeches", desc: "Guests are seated; speeches and toasts follow." },
    { t: "TBC", title: "Dinner", desc: "A shared meal to celebrate the day." },
    { t: "TBC", title: "Cake Cutting & First Dance", desc: "A sweet moment before the dance floor opens." },
    { t: "TBC", title: "Celebration", desc: "Dancing and celebration continue into the evening." }
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
  var wd = new Date(WEDDING_DATE_ISO);
  var startStr = wd.getFullYear() + pad(wd.getMonth() + 1) + pad(wd.getDate());
  var endD = new Date(wd.getTime() + 86400000);
  var endStr = endD.getFullYear() + pad(endD.getMonth() + 1) + pad(endD.getDate());
  var calTitle = "Nyasha & Watson's Wedding";
  var calDetails = "Ceremony and reception times to be confirmed. We can't wait to celebrate with you!";
  var gcalUrl = "https://calendar.google.com/calendar/render?action=TEMPLATE&text=" + encodeURIComponent(calTitle) +
    "&dates=" + startStr + "/" + endStr +
    "&details=" + encodeURIComponent(calDetails) +
    "&location=" + encodeURIComponent(VENUE_NAME + ", " + VENUE_ADDRESS);
  document.getElementById("gcalBtn").href = gcalUrl;

  document.getElementById("icsBtn").addEventListener("click", function () {
    var uid = "nyasha-watson-wedding-" + Date.now() + "@invitation";
    var now = new Date();
    var stamp = now.toISOString().replace(/[-:]/g, "").split(".")[0] + "Z";
    var ics = [
      "BEGIN:VCALENDAR", "VERSION:2.0", "PRODID:-//Nyasha & Watson Wedding//EN", "CALSCALE:GREGORIAN", "METHOD:PUBLISH",
      "BEGIN:VEVENT",
      "UID:" + uid,
      "DTSTAMP:" + stamp,
      "DTSTART;VALUE=DATE:" + startStr,
      "DTEND;VALUE=DATE:" + endStr,
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

  function drawCard(ctx, w, h, qrImg) {
    ctx.clearRect(0, 0, w, h);
    ctx.fillStyle = "#FBF7F0"; ctx.fillRect(0, 0, w, h);
    ctx.strokeStyle = "#B08A46"; ctx.lineWidth = 3; ctx.strokeRect(34, 34, w - 68, h - 68);
    ctx.strokeStyle = "#E4D2B0"; ctx.lineWidth = 1; ctx.strokeRect(50, 50, w - 100, h - 100);
    ctx.textAlign = "center";

    ctx.fillStyle = "#8B7A6E"; ctx.font = '500 21px "Poppins", sans-serif';
    ctx.fillText("T O G E T H E R   W I T H   T H E I R   F A M I L I E S", w / 2, 128);
    ctx.font = 'italic 400 24px "Bodoni Moda", serif'; ctx.fillStyle = "#5A2444";
    ctx.fillText("You are warmly invited to the wedding of", w / 2, 165);

    ctx.fillStyle = "#3E1730"; ctx.font = '400 132px "Great Vibes", cursive';
    ctx.fillText("Nyasha", w / 2, 300);
    ctx.font = '600 30px "Bodoni Moda", serif'; ctx.fillStyle = "#5A2444";
    ctx.fillText("M A Z U R U S E", w / 2, 350);

    ctx.fillStyle = "#D97F55"; ctx.font = '400 78px "Great Vibes", cursive';
    ctx.fillText("&", w / 2, 425);

    ctx.fillStyle = "#3E1730"; ctx.font = '400 132px "Great Vibes", cursive';
    ctx.fillText("Watson", w / 2, 560);
    ctx.font = '600 30px "Bodoni Moda", serif'; ctx.fillStyle = "#5A2444";
    ctx.fillText("C H I M O M B E", w / 2, 610);

    ctx.strokeStyle = "#E4D2B0"; ctx.beginPath(); ctx.moveTo(w / 2 - 170, 648); ctx.lineTo(w / 2 + 170, 648); ctx.stroke();
    ctx.font = 'italic 400 26px "Bodoni Moda", serif'; ctx.fillStyle = "#5A2444";
    ctx.fillText("As they celebrate their love", w / 2, 686);
    ctx.fillText("and begin a new chapter together", w / 2, 718);

    // date block
    ctx.font = '500 24px "Poppins", sans-serif'; ctx.fillStyle = "#5A2444";
    ctx.fillText("S A T U R D A Y", w / 2 - 255, 782);
    ctx.fillText("D E C E M B E R   2 0 2 6", w / 2 + 245, 782);
    ctx.strokeStyle = "#D97F55"; ctx.beginPath(); ctx.moveTo(w / 2 - 400, 775); ctx.lineTo(w / 2 - 330, 775); ctx.stroke();
    ctx.beginPath(); ctx.moveTo(w / 2 + 330, 775); ctx.lineTo(w / 2 + 400, 775); ctx.stroke();
    ctx.fillStyle = "#D97F55"; ctx.font = '600 66px "Bodoni Moda", serif';
    ctx.fillText("05", w / 2, 810);

    ctx.fillStyle = "#5A2444"; ctx.font = '600 28px "Bodoni Moda", serif';
    ctx.fillText("COLNE VALLEY NATURE RESERVE PARK", w / 2, 878);
    ctx.fillStyle = "#8B7A6E"; ctx.font = '400 22px "Poppins", sans-serif';
    ctx.fillText("7 Bay Noakes, Colne Valley, Chisipite,", w / 2, 910);
    ctx.fillText("Harare, Zimbabwe", w / 2, 938);

    ctx.strokeStyle = "#E4D2B0"; ctx.beginPath(); ctx.moveTo(w / 2 - 170, 968); ctx.lineTo(w / 2 + 170, 968); ctx.stroke();

    ctx.fillStyle = "#5A2444"; ctx.font = 'italic 400 25px "Bodoni Moda", serif';
    ctx.fillText('"Above all, love each other deeply,', w / 2, 1006);
    ctx.fillText("because love covers over a multitude of sins.\"", w / 2, 1036);
    ctx.font = '600 20px "Poppins", sans-serif'; ctx.fillStyle = "#8B7A6E";
    ctx.fillText("1   P E T E R   4 : 8", w / 2, 1068);

    var qs = 168;
    var qrTop = 1104;
    if (qrImg) {
      ctx.drawImage(qrImg, w / 2 - qs / 2, qrTop, qs, qs);
    } else {
      ctx.strokeStyle = "#E4D2B0"; ctx.strokeRect(w / 2 - qs / 2, qrTop, qs, qs);
    }
    ctx.fillStyle = "#8B7A6E"; ctx.font = '500 17px "Poppins", sans-serif';
    ctx.fillText("SCAN FOR RSVP & WEDDING DETAILS", w / 2, qrTop + qs + 30);
  }

  var cardReady = false;
  function renderCard() {
    var canvas = document.getElementById("inviteCanvas");
    var ctx = canvas.getContext("2d");
    var url = location.origin + location.pathname;
    Promise.all([loadFonts(), makeQrDataUrl(url)]).then(function (res) {
      var qrDataUrl = res[1];
      if (qrDataUrl) {
        var img = new Image();
        img.onload = function () { drawCard(ctx, canvas.width, canvas.height, img); cardReady = true; };
        img.src = qrDataUrl;
      } else {
        drawCard(ctx, canvas.width, canvas.height, null);
        cardReady = true;
      }
    });
  }
  renderCard();

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

  /* ---------------- SHARE ---------------- */
  var pageUrl = location.href;
  var shareMsg = "You're invited to celebrate the wedding of Nyasha & Watson on 5 December 2026 at Colne Valley Nature Reserve Park, Harare. View the invitation and RSVP here: " + pageUrl;
  document.getElementById("shareWhatsapp").href = "https://wa.me/?text=" + encodeURIComponent(shareMsg);
  document.getElementById("shareEmail").href = "mailto:?subject=" + encodeURIComponent("Nyasha & Watson's Wedding") + "&body=" + encodeURIComponent(shareMsg);
  document.getElementById("shareSms").href = "sms:?body=" + encodeURIComponent(shareMsg);
  document.getElementById("shareCopy").addEventListener("click", function () {
    if (navigator.clipboard && navigator.clipboard.writeText) {
      navigator.clipboard.writeText(pageUrl).then(function () { showToast("Link copied"); }).catch(function () { showToast("Could not copy link"); });
    } else { showToast("Could not copy link"); }
  });

  var toastTimer;
  function showToast(msg) {
    var t = document.getElementById("toast");
    t.textContent = msg; t.classList.add("show");
    clearTimeout(toastTimer);
    toastTimer = setTimeout(function () { t.classList.remove("show"); }, 2400);
  }
})();
