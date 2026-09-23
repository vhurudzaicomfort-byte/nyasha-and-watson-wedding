(function () {
  "use strict";

  /* ---------------- CONFIG ---------------- */
  var RSVP_PHONE = "263772692738"; // international format, no "+" — WhatsApp, SMS and call
  var RSVP_EMAIL = ""; // set the couple's email address here to enable the "Email" RSVP option
  var cardWhatsappLink = document.getElementById("cardWhatsappLink");
  if (cardWhatsappLink) cardWhatsappLink.href = "https://wa.me/" + RSVP_PHONE + "?text=" + encodeURIComponent("Hello Nyasha & Watson, I have a question about your wedding:");
  var WEDDING_DATE_ISO = "2026-12-05T09:00:00+02:00"; // Harare (CAT, UTC+2) — ceremony at 9:00 AM
  var WEDDING_DAY_LOCAL = "2026-12-05";
  var VENUE_NAME = "Colne Valley Nature Reserve Park";
  var VENUE_ADDRESS = "7 Bay Noakes, Colne Valley, Chisipite, Harare, Zimbabwe";
  var SPRAY_SRC = "assets/img/floral-spray.webp";
  var F = window.WNGuestFields;

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

  function escapeHtml(s) { return String(s).replace(/[&<>"']/g, function (c) { return { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]; }); }
  function attendLabel(v) { return v === "attending" ? "Joyfully Accepting" : v === "maybe" ? "Not Sure Yet" : v === "not_attending" ? "Regretfully Declining" : "Not yet replied"; }
  function isWeddingDay() {
    try { return new Date().toLocaleDateString("en-CA", { timeZone: "Africa/Harare" }) === WEDDING_DAY_LOCAL; }
    catch (e) { return new Date().toDateString() === new Date(WEDDING_DATE_ISO).toDateString(); }
  }
  // Remembers the guest's personal token on this device so the RSVP they just
  // sent and self check-in keep working even if they reopen the plain link.
  var STORE_KEY = "wn_guest_token";
  function storeGet() { try { return localStorage.getItem(STORE_KEY) || ""; } catch (e) { return ""; } }
  function storeSet(v) { try { if (v) localStorage.setItem(STORE_KEY, v); else localStorage.removeItem(STORE_KEY); } catch (e) {} }

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
    var diff = Math.max(0, target - Date.now());
    document.getElementById("cd-days").textContent = Math.floor(diff / 86400000);
    document.getElementById("cd-hours").textContent = String(Math.floor((diff % 86400000) / 3600000)).padStart(2, "0");
    document.getElementById("cd-mins").textContent = String(Math.floor((diff % 3600000) / 60000)).padStart(2, "0");
    document.getElementById("cd-secs").textContent = String(Math.floor((diff % 60000) / 1000)).padStart(2, "0");
  }
  tick();
  setInterval(tick, 1000);

  /* ---------------- GUEST IDENTITY ---------------- */
  // A personalised link looks like ?g=<guestId> (copied from the admin Guest List).
  // The generic link with no ?g= param is the "master" invitation.
  var urlToken = new URLSearchParams(location.search).get("g") || "";
  var guestToken = urlToken || storeGet();
  var guestInfo = null;
  var maxGuestsAllowed = 10;

  function adoptToken(id) {
    if (!id || id === guestToken) return;
    guestToken = id;
    storeSet(id);
    try {
      var u = new URL(location.href);
      u.searchParams.set("g", id);
      history.replaceState(null, "", u.pathname + u.search + u.hash);
    } catch (e) {}
  }

  function applyGuestInfo(info) {
    guestInfo = info;
    maxGuestsAllowed = Math.max(1, (info.invitedCount || 1) + (info.plusOneAllowed ? 1 : 0));
    var full = ((info.firstName || "") + " " + (info.lastName || "")).trim();
    var nameInput = document.getElementById("g-name");
    if (full && !nameInput.value) nameInput.value = full;
    var cardNameInput = document.getElementById("g-card-name");
    if (full && !cardNameInput.value) { cardNameInput.value = full; redrawCard(); }
    if (info.gender && !state.gender) setChip("g-gender", state.gender = info.gender);
    if (info.ageGroup && !state.ageGroup) setChip("g-age", state.ageGroup = info.ageGroup);
    renderInviteHint();
    renderRsvpAlready();
    renderCheckin();
  }

  function renderInviteHint() {
    var hint = document.getElementById("inviteHint");
    if (!guestInfo) { hint.hidden = true; return; }
    hint.hidden = false;
    var first = guestInfo.firstName || "friend";
    var st = guestInfo.rsvpStatus;
    if (st === "attending") hint.textContent = "Welcome back, " + first + " — you're joyfully accepting · party of " + (guestInfo.attendingCount || 1) + ".";
    else if (st === "maybe") hint.textContent = "Welcome back, " + first + " — we've noted you're not sure yet. Update your RSVP any time.";
    else if (st === "not_attending") hint.textContent = "Welcome, " + first + " — we'll miss you, and thank you for letting us know.";
    else hint.textContent = "Welcome, " + first + " — your invitation includes " + maxGuestsAllowed + (maxGuestsAllowed > 1 ? " guests." : " guest.");
  }

  function renderRsvpAlready() {
    var box = document.getElementById("rsvpAlready");
    if (!guestInfo || !guestInfo.rsvpStatus || guestInfo.rsvpStatus === "pending") { box.hidden = true; return; }
    var when = guestInfo.rsvpAt ? new Date(guestInfo.rsvpAt).toLocaleDateString("en-GB", { day: "numeric", month: "long" }) : "";
    var party = guestInfo.rsvpStatus === "attending" ? " · party of " + (guestInfo.attendingCount || 1) : "";
    box.innerHTML = "You've already replied: <strong>" + attendLabel(guestInfo.rsvpStatus) + "</strong>" + party + (when ? " (" + escapeHtml(when) + ")" : "") + ". Need to change it? Just go through the steps below again.";
    box.hidden = false;
  }

  function loadGuest() {
    if (!guestToken) { renderCheckin(); return; }
    fetch("/api/rsvp?token=" + encodeURIComponent(guestToken)).then(function (r) { return r.json(); }).then(function (info) {
      if (!info || !info.found) {
        if (!urlToken) { storeSet(""); guestToken = ""; }
        renderCheckin();
        return;
      }
      if (urlToken) storeSet(urlToken);
      applyGuestInfo(info);
      maybeAutoCheckin();
    }).catch(function () { renderCheckin(); });
  }

  /* ---------------- CHECK-IN (self, automatic, usher) ---------------- */
  // Three ways a guest gets checked in, all landing on the same guest record in
  // the portal: an usher at the door (admin), "Self Check-in" (location-verified),
  // or silently on the wedding day when the page sees the guest at the venue.
  var scCard = document.getElementById("self-checkin");
  var scBtn = document.getElementById("selfCheckinBtn");
  var scStatus = document.getElementById("selfcheckStatus");
  var scPhoneField = document.getElementById("selfcheckPhoneField");
  var checkinBanner = document.getElementById("checkinBanner");
  if (window.WNPhone) WNPhone.populatePhoneWidget(document.getElementById("sc-phone-cc"), document.getElementById("sc-phone"), "");

  function setScStatus(msg, kind) {
    scStatus.className = "selfcheck-status" + (kind ? " " + kind : "");
    scStatus.innerHTML = msg || "";
  }

  function renderCheckin() {
    var checked = !!(guestInfo && guestInfo.checkedIn);
    var today = isWeddingDay();
    scCard.classList.toggle("done", checked);
    scPhoneField.hidden = checked || !today || !!guestInfo;
    if (checked) {
      scBtn.hidden = true;
      setScStatus("&#10003;&nbsp; You're checked in" + (guestInfo.firstName ? ", " + escapeHtml(guestInfo.firstName) : "") + " — welcome, and enjoy the celebration!", "ok");
    } else if (!today) {
      scBtn.hidden = false;
      scBtn.disabled = true;
      setScStatus("Self check-in opens on the wedding day, Saturday 5 December 2026.");
    } else {
      scBtn.hidden = false;
      scBtn.disabled = false;
      if (!/warn|ok/.test(scStatus.className)) setScStatus("");
    }

    if (!guestInfo || guestInfo.rsvpStatus !== "attending") { checkinBanner.hidden = true; return; }
    if (checked) {
      checkinBanner.hidden = false;
      checkinBanner.classList.add("done");
      checkinBanner.innerHTML = "&#10003;&nbsp; You're checked in — see you at the celebration!";
    } else if (today) {
      checkinBanner.hidden = false;
      checkinBanner.classList.remove("done");
      checkinBanner.innerHTML = 'Arrived at the venue? &nbsp;<a class="btn btn-outline" href="#self-checkin">Self Check-in</a>';
    } else {
      checkinBanner.hidden = true;
    }
  }

  function postCheckin(payload) {
    return fetch("/api/checkin", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(payload) }).then(function (r) { return r.json(); });
  }

  function handleCheckinResult(res, mode) {
    if (res && res.ok) {
      if (res.guestId) adoptToken(res.guestId);
      guestInfo = Object.assign(guestInfo || {}, { checkedIn: true, firstName: (guestInfo && guestInfo.firstName) || res.firstName || "" });
      if (!res.alreadyCheckedIn) showToast(mode === "auto" ? "Welcome! You've been checked in automatically." : "You're checked in — welcome!");
      renderCheckin();
      return;
    }
    scBtn.disabled = false;
    if (res && res.reason === "too_far") {
      var km = res.distanceMeters >= 1000 ? (res.distanceMeters / 1000).toFixed(1) + " km" : res.distanceMeters + " m";
      setScStatus("You appear to be about " + km + " from the venue. Please check in once you've arrived at Colne Valley.", "warn");
    } else if (res && res.reason === "not_found") {
      setScStatus("We couldn't find an invitation with that phone number. Please see an usher at the entrance.", "warn");
    } else {
      setScStatus((res && res.error) || "Something went wrong — please try again, or see an usher at the entrance.", "warn");
    }
  }

  function identityPayload() {
    if (guestToken) return { token: guestToken };
    var phone = WNPhone.readPhoneWidget(document.getElementById("sc-phone-cc"), document.getElementById("sc-phone"));
    return phone ? { phone: phone } : null;
  }

  function offerUnverified(identity) {
    setScStatus('We couldn\'t read your location. Please allow location access and try again &mdash; or, if you\'re already at the venue, <button type="button" class="link-btn" id="scUnverified" style="padding:4px; color:var(--plum); text-decoration:underline;">check in without location</button>.', "warn");
    document.getElementById("scUnverified").addEventListener("click", function () {
      setScStatus("Checking you in…");
      postCheckin(Object.assign({ mode: "self-unverified" }, identity)).then(function (res) { handleCheckinResult(res, "self"); })
        .catch(function () { handleCheckinResult(null, "self"); });
    });
  }

  scBtn.addEventListener("click", function () {
    if (!isWeddingDay()) return;
    var identity = identityPayload();
    if (!identity) { setScStatus("Please enter the phone number your invitation was sent to.", "warn"); document.getElementById("sc-phone").focus(); return; }
    scBtn.disabled = true;
    if (!navigator.geolocation) { scBtn.disabled = false; offerUnverified(identity); return; }
    setScStatus("Confirming you're at the venue…");
    navigator.geolocation.getCurrentPosition(function (pos) {
      postCheckin(Object.assign({ mode: "self", lat: pos.coords.latitude, lng: pos.coords.longitude }, identity))
        .then(function (res) { handleCheckinResult(res, "self"); })
        .catch(function () { handleCheckinResult(null, "self"); });
    }, function () {
      scBtn.disabled = false;
      offerUnverified(identity);
    }, { enableHighAccuracy: true, timeout: 12000, maximumAge: 30000 });
  });

  // Only ever attempted on the wedding day itself, for guests who've accepted —
  // otherwise a guest previewing their invitation from a nearby home could be
  // checked in weeks early. A denied permission simply leaves the button.
  function maybeAutoCheckin() {
    if (!guestInfo || guestInfo.checkedIn || guestInfo.rsvpStatus !== "attending" || !isWeddingDay() || !navigator.geolocation) return;
    navigator.geolocation.getCurrentPosition(function (pos) {
      postCheckin({ token: guestToken, mode: "auto", lat: pos.coords.latitude, lng: pos.coords.longitude })
        .then(function (res) { if (res && res.ok) handleCheckinResult(res, "auto"); }).catch(function () {});
    }, function () {}, { enableHighAccuracy: false, timeout: 8000, maximumAge: 60000 });
  }

  /* ---------------- PROGRAMME RENDER ---------------- */
  document.getElementById("programmeList").innerHTML = PROGRAMME.map(function (item) {
    return '<div class="t-item"><div class="t-time">' + item.t + '</div><div class="t-dot"></div><div class="t-body"><div class="t-title">' + escapeHtml(item.title) + '</div><div class="t-desc">' + escapeHtml(item.desc) + "</div></div></div>";
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
  document.getElementById("gcalBtn").href = "https://calendar.google.com/calendar/render?action=TEMPLATE&text=" + encodeURIComponent(calTitle) +
    "&dates=" + startStr + "/" + endStr +
    "&details=" + encodeURIComponent(calDetails) +
    "&location=" + encodeURIComponent(VENUE_NAME + ", " + VENUE_ADDRESS);

  function downloadBlob(blob, filename) {
    var url = URL.createObjectURL(blob);
    var a = document.createElement("a");
    a.href = url; a.download = filename;
    document.body.appendChild(a); a.click(); document.body.removeChild(a);
    setTimeout(function () { URL.revokeObjectURL(url); }, 4000);
  }

  document.getElementById("icsBtn").addEventListener("click", function () {
    var ics = [
      "BEGIN:VCALENDAR", "VERSION:2.0", "PRODID:-//Nyasha & Watson Wedding//EN", "CALSCALE:GREGORIAN", "METHOD:PUBLISH",
      "BEGIN:VEVENT",
      "UID:nyasha-watson-wedding-" + Date.now() + "@invitation",
      "DTSTAMP:" + toUtcStamp(new Date()),
      "DTSTART:" + startStr,
      "DTEND:" + endStr,
      "SUMMARY:" + calTitle,
      "DESCRIPTION:" + calDetails.replace(/,/g, "\\,"),
      "LOCATION:" + (VENUE_NAME + ", " + VENUE_ADDRESS).replace(/,/g, "\\,"),
      "END:VEVENT", "END:VCALENDAR"
    ].join("\r\n");
    downloadBlob(new Blob([ics], { type: "text/calendar;charset=utf-8" }), "Nyasha-Watson-Wedding.ics");
  });

  /* ---------------- RSVP WIZARD ---------------- */
  var state = { step: 0, name: "", phone: "", gender: "", ageGroup: "", attend: "", guests: 1, plusone: "", message: "" };
  var stepsEls = document.querySelectorAll(".rsvp-step");
  var segs = document.querySelectorAll(".rp-seg");

  function showStep(n) {
    stepsEls.forEach(function (el) { el.hidden = el.dataset.step != n; });
    segs.forEach(function (seg) { seg.classList.toggle("done", Number(seg.dataset.step) <= n); });
    state.step = n;
  }

  // Optional "about you" chips: tap to choose, tap again to clear.
  function buildChips(groupId, options, key) {
    var el = document.getElementById(groupId);
    el.innerHTML = options.map(function (o) {
      return '<button type="button" class="chip" role="radio" aria-checked="false" data-value="' + o.value + '">' + o.label + "</button>";
    }).join("");
    el.addEventListener("click", function (e) {
      var chip = e.target.closest(".chip");
      if (!chip) return;
      state[key] = state[key] === chip.dataset.value ? "" : chip.dataset.value;
      setChip(groupId, state[key]);
    });
  }
  function setChip(groupId, value) {
    document.querySelectorAll("#" + groupId + " .chip").forEach(function (c) { c.setAttribute("aria-checked", String(c.dataset.value === value)); });
  }
  buildChips("g-gender", F.GENDERS, "gender");
  buildChips("g-age", F.AGE_GROUPS, "ageGroup");

  if (window.WNPhone) WNPhone.populatePhoneWidget(document.getElementById("g-phone-cc"), document.getElementById("g-phone"), "");

  document.getElementById("toStep1").addEventListener("click", function () {
    var name = document.getElementById("g-name").value.trim();
    if (!name) { document.getElementById("g-name").focus(); return; }
    state.name = name;
    state.phone = WNPhone.readPhoneWidget(document.getElementById("g-phone-cc"), document.getElementById("g-phone"));
    // Returning guests: start from what they told us last time.
    if (!state.attend && guestInfo && guestInfo.rsvpStatus && guestInfo.rsvpStatus !== "pending") {
      var prev = document.querySelector('#attendChoices input[value="' + guestInfo.rsvpStatus + '"]');
      if (prev) { prev.checked = true; prev.dispatchEvent(new Event("change")); }
      if (guestInfo.attendingCount) { state.guests = Math.min(maxGuestsAllowed, guestInfo.attendingCount); guestCountEl.textContent = state.guests; }
      if (guestInfo.plusOneName) document.getElementById("g-plusone").value = guestInfo.plusOneName;
    }
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
  document.getElementById("incGuests").addEventListener("click", function () {
    if (state.guests >= maxGuestsAllowed) { showToast("Your invitation covers up to " + maxGuestsAllowed + (maxGuestsAllowed > 1 ? " guests" : " guest")); return; }
    state.guests++; guestCountEl.textContent = state.guests;
  });
  document.getElementById("decGuests").addEventListener("click", function () { state.guests = Math.max(1, state.guests - 1); guestCountEl.textContent = state.guests; });

  document.getElementById("toStep3").addEventListener("click", function () {
    if (state.attend === "attending") {
      state.plusone = document.getElementById("g-plusone").value.trim();
      state.message = document.getElementById("g-message").value.trim();
    } else if (state.attend === "maybe") {
      state.plusone = "";
      state.message = document.getElementById("g-message-maybe").value.trim();
    } else {
      state.plusone = "";
      state.message = document.getElementById("g-message-decline").value.trim();
    }
    document.getElementById("summaryList").innerHTML = summaryHtml();
    document.getElementById("rsvpError").hidden = true;
    showStep(3);
    document.getElementById("reviewPane").hidden = false;
    document.getElementById("confirmPane").hidden = true;
  });
  document.getElementById("back3").addEventListener("click", function () { showStep(2); });

  function summaryRows() {
    var rows = [["Name", state.name], ["Response", attendLabel(state.attend)]];
    if (state.phone) rows.push(["Phone", WNPhone.formatPhone(state.phone)]);
    if (state.gender) rows.push(["Gender", F.genderLabel(state.gender)]);
    if (state.ageGroup) rows.push(["Age group", F.ageLabel(state.ageGroup)]);
    if (state.attend === "attending") {
      rows.push(["Party size", state.guests + (state.guests > 1 ? " guests" : " guest")]);
      if (state.plusone) rows.push(["Additional guest(s)", state.plusone]);
    }
    if (state.message) rows.push(["Message", state.message]);
    return rows;
  }
  function summaryHtml() {
    return summaryRows().map(function (r) {
      return '<div class="summary-row"><div class="sr-k">' + r[0] + '</div><div class="sr-v">' + escapeHtml(r[1]) + "</div></div>";
    }).join("");
  }
  function rsvpText() {
    var lines = ["Hello Nyasha & Watson! This is my RSVP for your wedding on 5 December 2026:", ""];
    summaryRows().forEach(function (r) { lines.push(r[0] + ": " + r[1]); });
    return lines.join("\n");
  }

  function submitRsvp(channel) {
    return fetch("/api/rsvp", {
      method: "POST", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        token: guestToken || undefined, channel: channel,
        name: state.name, phone: state.phone, gender: state.gender, ageGroup: state.ageGroup,
        attend: state.attend, guests: state.guests, plusOneName: state.plusone, message: state.message
      })
    }).then(function (r) {
      return r.json().then(function (j) { if (!r.ok || !j.ok) throw new Error(j.error || "Could not save your RSVP"); return j; });
    });
  }

  function showConfirm(result, channel) {
    if (result) {
      if (result.guestId) adoptToken(result.guestId);
      guestInfo = Object.assign({}, guestInfo || {}, result);
      delete guestInfo.ok; delete guestInfo.mode;
      maxGuestsAllowed = Math.max(1, (guestInfo.invitedCount || 1) + (guestInfo.plusOneAllowed ? 1 : 0));
      if (result.capped) state.guests = result.attendingCount;
    }
    var msg = {
      web: "Your RSVP has been received — the couple can see it right away.",
      whatsapp: "Your RSVP is saved, and your WhatsApp message is ready — just tap send.",
      sms: "Your RSVP is saved, and your SMS is ready — just tap send.",
      email: "Your RSVP is saved, and your email is ready — just tap send.",
      call: "Your answers are saved — we look forward to hearing from you."
    }[channel];
    if (!result) msg = "Your message is ready to send. (We couldn't save it online just now, so please do send it.)";
    if (result && result.capped) msg += " Your invitation covers " + result.attendingCount + (result.attendingCount > 1 ? " guests" : " guest") + ", so that's what we've recorded.";
    if (state.attend === "attending") msg += " We can't wait to celebrate with you.";
    document.getElementById("confirmMsg").textContent = msg;
    document.getElementById("confirmName").textContent = ", " + state.name.split(" ")[0];
    document.getElementById("confirmSummary").innerHTML = summaryHtml();
    document.getElementById("reviewPane").hidden = true;
    document.getElementById("confirmPane").hidden = false;
    document.getElementById("rsvpAlready").hidden = true;
    renderInviteHint();
    renderCheckin();
  }

  var submitBtn = document.getElementById("submitRsvp");
  submitBtn.addEventListener("click", function () {
    var label = submitBtn.innerHTML;
    submitBtn.disabled = true;
    submitBtn.textContent = "Submitting…";
    document.getElementById("rsvpError").hidden = true;
    submitRsvp("web").then(function (res) { showConfirm(res, "web"); }).catch(function (e) {
      var err = document.getElementById("rsvpError");
      err.textContent = (e && e.message && e.message !== "Failed to fetch" ? e.message + ". " : "We couldn't submit your RSVP just now. ") + "Please try again, or use one of the other ways below.";
      err.hidden = false;
      document.getElementById("otherWays").open = true;
    }).then(function () { submitBtn.disabled = false; submitBtn.innerHTML = label; });
  });

  // Other ways to RSVP. The app/composer must open synchronously inside the
  // click (or popup blockers step in); the answers are saved alongside it so
  // the portal is up to date whichever channel the guest picks.
  var emailBtn = document.querySelector('.ow-item[data-channel="email"]');
  if (!RSVP_EMAIL) emailBtn.hidden = true;
  document.querySelector(".other-ways-list").addEventListener("click", function (e) {
    var item = e.target.closest(".ow-item");
    if (!item) return;
    var channel = item.dataset.channel;
    var text = rsvpText();
    if (channel === "whatsapp") window.open("https://wa.me/" + RSVP_PHONE + "?text=" + encodeURIComponent(text), "_blank", "noopener");
    else if (channel === "sms") location.href = "sms:+" + RSVP_PHONE + "?body=" + encodeURIComponent(text);
    else if (channel === "call") location.href = "tel:+" + RSVP_PHONE;
    else if (channel === "email") location.href = "mailto:" + RSVP_EMAIL + "?subject=" + encodeURIComponent("RSVP — " + state.name) + "&body=" + encodeURIComponent(text);
    submitRsvp(channel).then(function (res) { showConfirm(res, channel); }).catch(function () { showConfirm(null, channel); });
  });

  document.getElementById("changeRsvp").addEventListener("click", function () {
    document.getElementById("reviewPane").hidden = false;
    document.getElementById("confirmPane").hidden = true;
    showStep(0);
    document.getElementById("rsvp").scrollIntoView({ behavior: "smooth" });
  });

  /* ---------------- SHARED CANVAS HELPERS ---------------- */
  function loadFonts() {
    var specs = ['400 90px "Great Vibes"', '600 30px "Bodoni Moda"', '400 26px "Poppins"', 'italic 400 26px "Bodoni Moda"'];
    if (!(document.fonts && document.fonts.load)) return Promise.resolve();
    return Promise.all(specs.map(function (s) { return document.fonts.load(s).catch(function () {}); })).then(function () { return document.fonts.ready; });
  }
  function loadImage(src) {
    return new Promise(function (resolve) {
      var img = new Image();
      img.onload = function () { resolve(img); };
      img.onerror = function () { resolve(null); };
      img.src = src;
    });
  }
  // Mirrors the site's .spray CSS: the bloom (~50% x / ~41% y of the artwork)
  // sits on the corner, laid across the corner so it wraps around it.
  function drawSpray(ctx, img, cw, ch, size, corner) {
    if (!img) return;
    var sw = size, sh = size * img.naturalHeight / img.naturalWidth;
    var x = corner === "tl" || corner === "bl" ? -0.52 * sw : cw - sw + 0.52 * sw;
    var y = corner === "tl" || corner === "tr" ? -0.44 * sw : ch - sh + 0.44 * sw;
    ctx.save();
    ctx.translate(x + sw / 2, y + sh / 2);
    if (corner === "br") ctx.rotate(Math.PI);
    if (corner === "tr") ctx.scale(-1, 1);
    if (corner === "bl") ctx.scale(1, -1);
    ctx.drawImage(img, -sw / 2, -sh / 2, sw, sh);
    ctx.restore();
  }
  function boldScript(ctx, text, x, y, font, fill, strokeW) {
    ctx.font = font;
    ctx.lineJoin = "round";
    ctx.strokeStyle = fill; ctx.lineWidth = strokeW; ctx.strokeText(text, x, y);
    ctx.fillStyle = fill; ctx.fillText(text, x, y);
  }
  function drawRings(ctx, x, y, r, offset, color, lw) {
    ctx.strokeStyle = color; ctx.lineWidth = lw;
    ctx.beginPath(); ctx.arc(x - offset, y, r, 0, Math.PI * 2); ctx.stroke();
    ctx.beginPath(); ctx.arc(x + offset, y, r, 0, Math.PI * 2); ctx.stroke();
  }
  function centeredRule(ctx, w, y, halfGap, len, color) {
    ctx.strokeStyle = color; ctx.lineWidth = 1;
    ctx.beginPath(); ctx.moveTo(w / 2 - halfGap - len, y); ctx.lineTo(w / 2 - halfGap, y); ctx.stroke();
    ctx.beginPath(); ctx.moveTo(w / 2 + halfGap, y); ctx.lineTo(w / 2 + halfGap + len, y); ctx.stroke();
  }
  var sprayImgPromise = loadImage(SPRAY_SRC);

  /* ---------------- INVITATION CARD (canvas, live preview + download) ---------------- */
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

  function drawCard(ctx, w, h, qrImg, floralImg, guestName) {
    ctx.clearRect(0, 0, w, h);
    ctx.fillStyle = "#FBF7F0"; ctx.fillRect(0, 0, w, h);
    ctx.strokeStyle = "#B08A46"; ctx.lineWidth = 3; ctx.strokeRect(34, 34, w - 68, h - 68);
    ctx.strokeStyle = "#E4D2B0"; ctx.lineWidth = 1; ctx.strokeRect(50, 50, w - 100, h - 100);
    drawSpray(ctx, floralImg, w, h, 380, "tl");
    drawSpray(ctx, floralImg, w, h, 380, "br");
    ctx.textAlign = "center";

    drawRings(ctx, w / 2, 68, 11, 8, "#B08A46", 2.4);
    ctx.fillStyle = "#8B7A6E"; ctx.font = '500 20px "Poppins", sans-serif';
    ctx.fillText("T O G E T H E R   W I T H   T H E I R   F A M I L I E S", w / 2, 108);
    ctx.font = 'italic 400 22px "Bodoni Moda", serif'; ctx.fillStyle = "#5A2444";
    ctx.fillText("You are warmly invited to the wedding of", w / 2, 145);

    boldScript(ctx, "Nyasha", w / 2, 255, '400 104px "Great Vibes", cursive', "#3E1730", 3.6);
    ctx.font = '600 24px "Bodoni Moda", serif'; ctx.fillStyle = "#5A2444";
    ctx.fillText("M A Z U R U S E", w / 2, 343);
    boldScript(ctx, "&", w / 2, 400, '400 56px "Great Vibes", cursive', "#D97F55", 2.4);
    boldScript(ctx, "Watson", w / 2, 520, '400 104px "Great Vibes", cursive', "#3E1730", 3.6);
    ctx.font = '600 24px "Bodoni Moda", serif'; ctx.fillStyle = "#5A2444";
    ctx.fillText("C H I N ' O M B E", w / 2, 608);

    ctx.strokeStyle = "#E4D2B0"; ctx.lineWidth = 1; ctx.beginPath(); ctx.moveTo(w / 2 - 140, 642); ctx.lineTo(w / 2 + 140, 642); ctx.stroke();
    ctx.font = 'italic 400 21px "Bodoni Moda", serif'; ctx.fillStyle = "#5A2444";
    ctx.fillText("As they celebrate their love", w / 2, 676);
    ctx.fillText("and begin a new chapter together", w / 2, 702);

    // date block — width of the date line is measured so the flanking rules never cross the text
    ctx.font = '500 19px "Poppins", sans-serif';
    ctx.letterSpacing = "2px";
    var dateLine = "SATURDAY   ·   DECEMBER 2026";
    var dateW = ctx.measureText(dateLine).width;
    ctx.fillStyle = "#5A2444";
    ctx.fillText(dateLine, w / 2, 754);
    centeredRule(ctx, w, 748, dateW / 2 + 24, 60, "#D97F55");
    ctx.letterSpacing = "0px";

    ctx.fillStyle = "#D97F55"; ctx.font = '600 128px "Bodoni Moda", serif';
    ctx.fillText("05", w / 2, 872);

    ctx.fillStyle = "#5A2444"; ctx.font = '600 24px "Bodoni Moda", serif';
    ctx.fillText("COLNE VALLEY NATURE RESERVE PARK", w / 2, 928);
    ctx.fillStyle = "#8B7A6E"; ctx.font = '400 18px "Poppins", sans-serif';
    ctx.fillText("7 Bay Noakes, Colne Valley, Chisipite,", w / 2, 956);
    ctx.fillText("Harare, Zimbabwe", w / 2, 978);

    ctx.strokeStyle = "#E4D2B0"; ctx.beginPath(); ctx.moveTo(w / 2 - 140, 1002); ctx.lineTo(w / 2 + 140, 1002); ctx.stroke();

    ctx.fillStyle = "#5A2444"; ctx.font = 'italic 400 20px "Bodoni Moda", serif';
    ctx.fillText('"Above all, love each other deeply,', w / 2, 1032);
    ctx.fillText("because love covers over a multitude of sins.\"", w / 2, 1056);
    ctx.font = '600 15px "Poppins", sans-serif'; ctx.fillStyle = "#8B7A6E";
    ctx.fillText("1   P E T E R   4 : 8", w / 2, 1080);

    if (guestName) {
      ctx.font = '500 12px "Poppins", sans-serif'; ctx.fillStyle = "#B08A46";
      ctx.fillText("R E S E R V E D   F O R", w / 2, 1102);
      ctx.font = 'italic 400 22px "Bodoni Moda", serif'; ctx.fillStyle = "#3E1730";
      ctx.fillText(guestName, w / 2, 1126);
    }
    ctx.font = '500 13px "Poppins", sans-serif'; ctx.fillStyle = "#8B7A6E";
    ctx.fillText("S T R I C T L Y   B Y   I N V I T A T I O N   O N L Y", w / 2, 1148);

    // Caption sits above the QR code (not below it) so nothing renders past the
    // card's inner border — the frame previously struck straight through this line.
    ctx.font = '500 14px "Poppins", sans-serif'; ctx.fillStyle = "#8B7A6E";
    ctx.fillText("SCAN FOR RSVP & WEDDING DETAILS", w / 2, 1176);

    var qs = 104, qrTop = 1190;
    if (qrImg) ctx.drawImage(qrImg, w / 2 - qs / 2, qrTop, qs, qs);
    else { ctx.strokeStyle = "#E4D2B0"; ctx.strokeRect(w / 2 - qs / 2, qrTop, qs, qs); }
  }

  var cachedQrImg = null, cachedFloralImg = null;
  var cardCanvas = document.getElementById("inviteCanvas");
  var cardCtx = cardCanvas.getContext("2d");

  function redrawCard() {
    if (!cachedQrImg && !cachedFloralImg) return;
    var name = (document.getElementById("g-card-name").value || "").trim();
    drawCard(cardCtx, cardCanvas.width, cardCanvas.height, cachedQrImg, cachedFloralImg, name);
  }

  Promise.all([loadFonts(), makeQrDataUrl(location.origin + location.pathname), sprayImgPromise]).then(function (res) {
    cachedFloralImg = res[2];
    if (res[1]) loadImage(res[1]).then(function (img) { cachedQrImg = img; redrawCard(); });
    else redrawCard();
  });

  /* Keep the RSVP name field and the card's personalisation field in sync */
  var rsvpNameInput = document.getElementById("g-name");
  var cardNameInput = document.getElementById("g-card-name");
  rsvpNameInput.addEventListener("input", function () { cardNameInput.value = rsvpNameInput.value; redrawCard(); });
  cardNameInput.addEventListener("input", function () { rsvpNameInput.value = cardNameInput.value; redrawCard(); });

  document.getElementById("saveCardBtn").addEventListener("click", function () {
    cardCanvas.toBlob(function (blob) {
      if (!blob) return;
      var guestName = (cardNameInput.value || "").trim().replace(/[^a-z0-9]+/gi, "-").replace(/^-+|-+$/g, "");
      downloadBlob(blob, "Nyasha-Watson-Invitation" + (guestName ? "-" + guestName : "") + ".png");
      showToast("Invitation card downloaded");
    }, "image/png");
  });

  /* ---------------- PROGRAMME DOWNLOAD (branded PNG, phone-friendly) ---------------- */
  function drawProgramme(ctx, w, h, floralImg) {
    ctx.fillStyle = "#FBF7F0"; ctx.fillRect(0, 0, w, h);
    ctx.strokeStyle = "#B08A46"; ctx.lineWidth = 3; ctx.strokeRect(34, 34, w - 68, h - 68);
    ctx.strokeStyle = "#E4D2B0"; ctx.lineWidth = 1; ctx.strokeRect(50, 50, w - 100, h - 100);
    drawSpray(ctx, floralImg, w, h, 380, "tl");
    drawSpray(ctx, floralImg, w, h, 380, "br");
    ctx.textAlign = "center";

    drawRings(ctx, w / 2, 96, 11, 8, "#B08A46", 2.4);
    ctx.fillStyle = "#8B7A6E"; ctx.font = '500 18px "Poppins", sans-serif';
    ctx.fillText("T H E   W E D D I N G   O F", w / 2, 142);
    boldScript(ctx, "Nyasha & Watson", w / 2, 230, '400 88px "Great Vibes", cursive', "#3E1730", 2.6);
    ctx.fillStyle = "#5A2444"; ctx.font = '600 40px "Bodoni Moda", serif';
    ctx.letterSpacing = "6px";
    ctx.fillText("ORDER OF EVENTS", w / 2, 310);
    ctx.letterSpacing = "0px";
    ctx.fillStyle = "#8B7A6E"; ctx.font = '400 20px "Poppins", sans-serif';
    ctx.fillText("Saturday, 5 December 2026  ·  Colne Valley Nature Reserve Park, Harare", w / 2, 350);
    centeredRule(ctx, w, 384, 10, 130, "#D97F55");

    var top = 440, rowH = 112, lineX = 330;
    ctx.strokeStyle = "#E4D2B0"; ctx.lineWidth = 2;
    ctx.beginPath(); ctx.moveTo(lineX, top - 10); ctx.lineTo(lineX, top + rowH * (PROGRAMME.length - 1) + 10); ctx.stroke();
    PROGRAMME.forEach(function (item, i) {
      var y = top + i * rowH;
      ctx.textAlign = "right"; ctx.fillStyle = "#3E1730"; ctx.font = '600 28px "Bodoni Moda", serif';
      ctx.fillText(item.t, lineX - 34, y + 10);
      ctx.fillStyle = "#FBF7F0"; ctx.beginPath(); ctx.arc(lineX, y, 13, 0, Math.PI * 2); ctx.fill();
      ctx.fillStyle = "#D97F55"; ctx.beginPath(); ctx.arc(lineX, y, 8, 0, Math.PI * 2); ctx.fill();
      ctx.textAlign = "left"; ctx.fillStyle = "#3A2430"; ctx.font = '500 28px "Poppins", sans-serif';
      ctx.fillText(item.title, lineX + 34, y + 10);
      ctx.fillStyle = "#8B7A6E"; ctx.font = '400 20px "Poppins", sans-serif';
      ctx.fillText(item.desc, lineX + 34, y + 42);
    });

    ctx.textAlign = "center";
    var footY = top + rowH * PROGRAMME.length + 20;
    ctx.fillStyle = "#8B7A6E"; ctx.font = 'italic 400 20px "Bodoni Moda", serif';
    ctx.fillText("All times are provisional and will be finalised nearer the date.", w / 2, footY);
    ctx.fillStyle = "#5A2444"; ctx.font = '500 16px "Poppins", sans-serif';
    ctx.fillText("S T R I C T L Y   B Y   I N V I T A T I O N   O N L Y", w / 2, footY + 44);
  }

  document.getElementById("downloadProgrammeBtn").addEventListener("click", function () {
    Promise.all([loadFonts(), sprayImgPromise]).then(function (res) {
      var c = document.createElement("canvas");
      c.width = 1080; c.height = 1500;
      drawProgramme(c.getContext("2d"), c.width, c.height, res[1]);
      c.toBlob(function (blob) {
        if (!blob) return;
        downloadBlob(blob, "Nyasha-Watson-Programme.png");
        showToast("Programme downloaded");
      }, "image/png");
    });
  });

  var toastTimer;
  function showToast(msg) {
    var t = document.getElementById("toast");
    t.textContent = msg; t.classList.add("show");
    clearTimeout(toastTimer);
    toastTimer = setTimeout(function () { t.classList.remove("show"); }, 2600);
  }

  loadGuest();
})();
