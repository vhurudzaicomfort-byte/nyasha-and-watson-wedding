(function () {
  "use strict";

  var guests = [];
  var gifts = [];
  var providers = [];
  var currencies = ["USD"];
  var paymentMethods = ["Cash"];
  var FG = window.WNGuestFields;
  // Built in (not fetched) so the "Invited for" dropdown is never empty, even
  // before the guest list has loaded or if an older API response is cached.
  var categories = FG.CATEGORIES.slice();
  var CHECKIN_METHODS = { usher: "Usher", self: "Self", auto: "Auto (GPS)", "self-unverified": "Self · no location" };
  var CHANNELS = { web: "website", whatsapp: "WhatsApp", sms: "SMS", email: "email", call: "phone call", admin: "portal (logged by admin)" };

  var toastTimer;
  function showToast(msg) {
    var t = document.getElementById("toast");
    t.textContent = msg; t.classList.add("show");
    clearTimeout(toastTimer);
    toastTimer = setTimeout(function () { t.classList.remove("show"); }, 2600);
  }

  function escapeHtml(s) { return String(s == null ? "" : s).replace(/[&<>"']/g, function (c) { return { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]; }); }
  function fullName(g) { return ((g.firstName || "") + " " + (g.lastName || "")).trim() || "(unnamed guest)"; }
  function fmtMoney(n) { return (Number(n) || 0).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 }); }
  function fmtDate(s) { if (!s) return "—"; try { return new Date(s).toLocaleDateString(undefined, { day: "numeric", month: "short", year: "numeric" }); } catch (e) { return s; } }
  function statusPillClass(status) {
    if (status === "Fully Paid") return "pill-status-green";
    if (status === "Partially Paid" || status === "Due Soon") return "pill-status-amber";
    if (status === "Not Paid" || status === "Overdue") return "pill-status-red";
    return "pill-status-neutral";
  }
  function capitalize(s) { return s ? s.charAt(0).toUpperCase() + s.slice(1) : ""; }

  /* ---------------- API helper ---------------- */
  function api(path, opts) {
    opts = opts || {};
    var headers = opts.body ? { "Content-Type": "application/json" } : {};
    return fetch(path, { method: opts.method || "GET", headers: headers, body: opts.body ? JSON.stringify(opts.body) : undefined })
      .then(function (res) {
        if (res.status === 401) { location.href = "/admin/login.html"; return new Promise(function () {}); }
        return res.json().then(function (data) {
          if (!res.ok) throw new Error(data.error || "Request failed");
          return data;
        });
      });
  }

  /* ---------------- TABS ---------------- */
  var navItems = document.querySelectorAll(".navitem");
  var panels = document.querySelectorAll(".tabpanel");
  function activateTab(tab) {
    navItems.forEach(function (n) { n.classList.toggle("active", n.dataset.tab === tab); });
    panels.forEach(function (p) { p.classList.toggle("active", p.dataset.panel === tab); });
    document.getElementById("mobileNavSelect").value = tab;
  }
  navItems.forEach(function (n) { n.addEventListener("click", function () { activateTab(n.dataset.tab); }); });
  document.getElementById("mobileNavSelect").addEventListener("change", function (e) { activateTab(e.target.value); });

  document.getElementById("logoutBtn").addEventListener("click", function () {
    api("/api/admin/logout", { method: "POST" }).then(function () { location.href = "/admin/login.html"; });
  });

  /* ---------------- CONFIRM DIALOG ---------------- */
  var confirmResolver = null;
  function askConfirm(title, body) {
    document.getElementById("confirmTitle").textContent = title;
    document.getElementById("confirmBody").textContent = body;
    document.getElementById("confirmOverlay").hidden = false;
    return new Promise(function (resolve) { confirmResolver = resolve; });
  }
  document.getElementById("confirmOk").addEventListener("click", function () { document.getElementById("confirmOverlay").hidden = true; if (confirmResolver) confirmResolver(true); });
  document.getElementById("confirmCancel").addEventListener("click", function () { document.getElementById("confirmOverlay").hidden = true; if (confirmResolver) confirmResolver(false); });

  /* ---------------- LOAD + RENDER ---------------- */
  function loadAll() {
    return Promise.all([api("/api/admin/guests"), api("/api/admin/gifts"), api("/api/admin/providers")]).then(function (res) {
      guests = res[0].guests; if (res[0].categories && res[0].categories.length) categories = res[0].categories;
      gifts = res[1].gifts; currencies = res[1].currencies; paymentMethods = res[1].paymentMethods;
      providers = res[2].providers;
      renderAll();
    });
  }
  function renderAll() {
    populateInvitedForFilter();
    renderDashboard(); renderGuestTable();
    renderGifts(); renderProviders();
  }
  function fillSelect(id, firstLabel, options) {
    var sel = document.getElementById(id);
    var current = sel.value;
    sel.innerHTML = '<option value="">' + firstLabel + "</option>" + options.map(function (o) { return '<option value="' + escapeHtml(o.value) + '">' + escapeHtml(o.label) + "</option>"; }).join("");
    sel.value = current;
  }
  function populateInvitedForFilter() {
    fillSelect("filterInvitedFor", "All (invited for)", categories.map(function (c) { return { value: c, label: c }; }));
    fillSelect("filterGender", "All genders", FG.GENDERS.concat([{ value: "_none", label: "Not recorded" }]));
    fillSelect("filterAge", "All ages", [{ value: "_child", label: "Children (0–16)" }].concat(FG.AGE_GROUPS.map(function (a) { return { value: a.value, label: "Age " + a.label }; }), [{ value: "_none", label: "Not recorded" }]));
  }

  function renderDashboard() {
    var total = guests.length;
    var attending = guests.filter(function (g) { return g.rsvpStatus === "attending"; });
    var maybe = guests.filter(function (g) { return g.rsvpStatus === "maybe"; });
    var not = guests.filter(function (g) { return g.rsvpStatus === "not_attending"; });
    var pending = guests.filter(function (g) { return !g.rsvpStatus || g.rsvpStatus === "pending"; });
    var attendingCount = attending.reduce(function (s, g) { return s + (Number(g.attendingCount) || 0); }, 0);
    var invitedCount = guests.reduce(function (s, g) { return s + (Number(g.invitedCount) || 1); }, 0);
    var checkedIn = guests.filter(function (g) { return g.checkedIn; }).length;
    var responded = attending.length + maybe.length + not.length;
    var rate = total ? Math.round((responded / total) * 100) : 0;

    var cashByCurrency = {};
    var kindCount = 0;
    gifts.forEach(function (g) {
      if (g.type === "cash") cashByCurrency[g.currency] = (cashByCurrency[g.currency] || 0) + (Number(g.amount) || 0);
      else kindCount++;
    });
    var cashTotalStr = Object.keys(cashByCurrency).map(function (c) { return c + " " + fmtMoney(cashByCurrency[c]); }).join(" · ") || "—";

    var provAgreedByCurrency = {}, provPaidByCurrency = {}, provOutstandingByCurrency = {};
    var overdueCount = 0, dueSoonCount = 0;
    providers.forEach(function (p) {
      var cur = p.currency || "USD";
      provAgreedByCurrency[cur] = (provAgreedByCurrency[cur] || 0) + (Number(p.agreedFee) || 0);
      provPaidByCurrency[cur] = (provPaidByCurrency[cur] || 0) + (Number(p.amountPaid) || 0);
      provOutstandingByCurrency[cur] = (provOutstandingByCurrency[cur] || 0) + (Number(p.outstanding) || 0);
      if (p.status === "Overdue") overdueCount++;
      if (p.status === "Due Soon") dueSoonCount++;
    });
    var outstandingStr = Object.keys(provOutstandingByCurrency).map(function (c) { return c + " " + fmtMoney(provOutstandingByCurrency[c]); }).join(" · ") || "—";

    document.getElementById("statGrid").innerHTML = [
      stat("Total Invited (records)", total, invitedCount + " people across all invitations"),
      stat("Attending", attending.length, attendingCount + " people confirmed", true),
      stat("Maybe", maybe.length),
      stat("Not Attending", not.length),
      stat("Pending", pending.length),
      stat("Checked In", checkedIn, (total - checkedIn) + " not yet arrived"),
      stat("RSVP Rate", rate + "%", responded + " of " + total + " responded"),
      stat("Cash Gifts", cashTotalStr, gifts.filter(function (g) { return g.type === "cash"; }).length + " gifts recorded"),
      stat("Gifts in Kind", kindCount, "items received"),
      stat("Providers Outstanding", outstandingStr, providers.length + " providers tracked"),
      stat("Payments Due", overdueCount + dueSoonCount, overdueCount + " overdue · " + dueSoonCount + " due soon", overdueCount > 0)
    ].join("");

    var rows = [["Attending", attending.length, total], ["Maybe", maybe.length, total], ["Not Attending", not.length, total], ["Pending", pending.length, total]];
    document.getElementById("rsvpBars").innerHTML = rows.map(barRow).join("") || emptyBars();
    renderGuestMix(attending);
    renderCheckinMethods();

    var giftCurrencyEntries = Object.keys(cashByCurrency).map(function (c) { return [c, cashByCurrency[c]]; });
    var maxGift = Math.max.apply(null, giftCurrencyEntries.map(function (e) { return e[1]; }).concat([1]));
    var giftBarsHtml = giftCurrencyEntries.map(function (e) { return barRow([e[0], fmtMoney(e[1]), maxGift]); }).join("");
    if (kindCount) giftBarsHtml += barRow(["Gifts in kind", kindCount, Math.max(kindCount, maxGift)]);
    document.getElementById("giftBars").innerHTML = giftBarsHtml || '<p style="color:var(--text-muted); font-size:.84rem;">No gifts recorded yet.</p>';

    var provEntries = Object.keys(provAgreedByCurrency).map(function (c) {
      return [c + " agreed / paid", provAgreedByCurrency[c] ? Math.round((provPaidByCurrency[c] || 0) / provAgreedByCurrency[c] * 100) : 0, 100];
    });
    document.getElementById("providerBars").innerHTML = provEntries.length
      ? provEntries.map(barRow).join("") + '<p style="margin-top:6px; font-size:.76rem; color:var(--text-muted);">Percent of agreed fee paid so far, by currency.</p>'
      : '<p style="color:var(--text-muted); font-size:.84rem;">No service providers recorded yet.</p>';
  }
  // Age and gender are optional, so every figure says how much of the list it covers.
  function renderGuestMix(attending) {
    var withAge = attending.filter(function (g) { return g.ageGroup; });
    var withGender = attending.filter(function (g) { return g.gender; });
    var ageMax = Math.max(1, withAge.length);
    document.getElementById("ageBars").innerHTML = withAge.length
      ? FG.AGE_GROUPS.map(function (a) { return barRow([a.label, withAge.filter(function (g) { return g.ageGroup === a.value; }).length, ageMax]); }).join("")
      : '<p style="color:var(--text-muted); font-size:.84rem;">No age groups recorded yet.</p>';
    var gMax = Math.max(1, withGender.length);
    document.getElementById("genderBars").innerHTML = withGender.length
      ? FG.GENDERS.map(function (x) { return barRow([x.label, withGender.filter(function (g) { return g.gender === x.value; }).length, gMax]); }).join("")
      : '<p style="color:var(--text-muted); font-size:.84rem;">No genders recorded yet.</p>';
    var children = withAge.filter(function (g) { return FG.isChild(g.ageGroup); }).length;
    var seniors = withAge.filter(function (g) { return g.ageGroup === "61+"; }).length;
    var parts = [];
    if (attending.length) parts.push("Age recorded for " + withAge.length + " of " + attending.length + " attending invitations, gender for " + withGender.length + ".");
    if (children) parts.push(children + (children > 1 ? " children" : " child") + " (0–16) expected — plan kids' meals and seating.");
    if (seniors) parts.push(seniors + " guest" + (seniors > 1 ? "s" : "") + " aged 61+ — consider seating near the front and easy access.");
    document.getElementById("mixNote").textContent = parts.join(" ");
  }
  function renderCheckinMethods() {
    var checked = guests.filter(function (g) { return g.checkedIn; });
    if (!checked.length) { document.getElementById("checkinBars").innerHTML = '<p style="color:var(--text-muted); font-size:.84rem;">No one checked in yet. Guests can be checked in by an usher, by Self Check-in on the website, or automatically when they arrive.</p>'; return; }
    var counts = {};
    checked.forEach(function (g) { var m = g.checkInMethod || "usher"; counts[m] = (counts[m] || 0) + 1; });
    document.getElementById("checkinBars").innerHTML = Object.keys(CHECKIN_METHODS).filter(function (m) { return counts[m]; })
      .map(function (m) { return barRow([CHECKIN_METHODS[m], counts[m], checked.length]); }).join("");
  }
  function checkinPill(g) {
    if (!g.checkedIn) return '<span class="pill pill-notchecked">Not yet</span>';
    var m = g.checkInMethod || "usher";
    var cls = m === "self-unverified" ? "pill-checked-warn" : m === "usher" ? "pill-checked" : "pill-checked-self";
    var when = g.checkInTime ? new Date(g.checkInTime).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }) : "";
    return '<span class="pill ' + cls + '" title="' + escapeHtml((CHECKIN_METHODS[m] || m) + (when ? " at " + when : "")) + '">Checked in · ' + escapeHtml(CHECKIN_METHODS[m] || m) + "</span>";
  }
  function stat(label, val, sub, accent) {
    return '<div class="stat-card' + (accent ? " accent" : "") + '"><div class="sc-label">' + label + '</div><div class="sc-val">' + val + "</div>" + (sub ? '<div class="sc-sub">' + sub + "</div>" : "") + "</div>";
  }
  function barRow(r) {
    var label = r[0], val = r[1], max = r[2] || 1;
    var pct = max ? Math.round((val / max) * 100) : 0;
    return '<div class="bar-row"><div class="br-label">' + escapeHtml(label) + '</div><div class="bar-track"><div class="bar-fill" style="width:' + pct + '%"></div></div><div class="br-val">' + val + "</div></div>";
  }
  function emptyBars() { return '<p style="color:var(--text-muted); font-size:.84rem;">No RSVPs logged yet.</p>'; }

  /* ---------------- GUEST TABLE ---------------- */
  function renderGuestTable() {
    var q = (document.getElementById("guestSearch").value || "").toLowerCase();
    var fRsvp = document.getElementById("filterRsvp").value;
    var fInvitedFor = document.getElementById("filterInvitedFor").value;
    var fCheckin = document.getElementById("filterCheckin").value;
    var fGender = document.getElementById("filterGender").value;
    var fAge = document.getElementById("filterAge").value;

    var rows = guests.filter(function (g) {
      if (q) {
        var hay = (fullName(g) + " " + (g.phone || "") + " " + (g.familyName || "")).toLowerCase();
        if (hay.indexOf(q) === -1) return false;
      }
      if (fRsvp && (g.rsvpStatus || "pending") !== fRsvp) return false;
      if (fInvitedFor && (g.invitedFor || "") !== fInvitedFor) return false;
      if (fGender && (fGender === "_none" ? !!g.gender : g.gender !== fGender)) return false;
      if (fAge === "_child" && !FG.isChild(g.ageGroup)) return false;
      if (fAge === "_none" && g.ageGroup) return false;
      if (fAge && fAge.charAt(0) !== "_" && g.ageGroup !== fAge) return false;
      if (fCheckin === "yes" && !g.checkedIn) return false;
      if (fCheckin === "no" && g.checkedIn) return false;
      return true;
    }).sort(function (a, b) { return fullName(a).localeCompare(fullName(b)); });

    document.getElementById("guestsEmpty").hidden = guests.length !== 0;

    document.getElementById("guestRows").innerHTML = rows.map(function (g) {
      var status = g.rsvpStatus || "pending";
      var subLine = [g.familyName || capitalize(g.invitationType || "individual"), g.invitedFor].filter(Boolean).join(" · ");
      var meta = [FG.genderLabel(g.gender), g.ageGroup ? "Age " + FG.ageLabel(g.ageGroup) : "", g.rsvpChannel && status !== "pending" ? "Replied via " + (CHANNELS[g.rsvpChannel] || g.rsvpChannel) : ""].filter(Boolean).join(" · ");
      return "<tr>" +
        '<td><div class="g-name">' + escapeHtml(fullName(g)) + '</div><div class="g-sub">' + escapeHtml(subLine) + "</div>" + (meta ? '<div class="g-meta">' + escapeHtml(meta) + "</div>" : "") + "</td>" +
        '<td><span class="pill pill-' + status + '">' + status.replace("_", " ") + "</span></td>" +
        "<td>" + (g.attendingCount != null && g.attendingCount !== "" ? g.attendingCount : "—") + " / " + (g.invitedCount || 1) + "</td>" +
        "<td>" + checkinPill(g) + "</td>" +
        '<td><div class="row-actions">' + iconBtn("edit", g.id, "Edit") + iconBtn("link", g.id, "Copy invite link") + iconBtn("invite", g.id, "Send invite via WhatsApp") + iconBtn("badge", g.id, "Badge") + iconBtn("checkin", g.id, g.checkedIn ? "Undo check-in" : "Check in") + iconBtn("delete", g.id, "Delete") + "</div></td>" +
        "</tr>";
    }).join("");
  }
  function iconBtn(action, id, title) {
    var icons = {
      edit: '<path d="M12 20h9"/><path d="M16.5 3.5a2.1 2.1 0 0 1 3 3L7 19l-4 1 1-4z"/>',
      link: '<path d="M10 13a5 5 0 0 0 7 0l2-2a5 5 0 0 0-7-7l-1 1"/><path d="M14 11a5 5 0 0 0-7 0l-2 2a5 5 0 0 0 7 7l1-1"/>',
      invite: '<path d="m22 2-7 20-4-9-9-4Z"/><path d="M22 2 11 13"/>',
      badge: '<rect x="4" y="3" width="16" height="18" rx="2"/><circle cx="12" cy="10" r="3"/><path d="M8 18h8"/>',
      checkin: '<path d="M20 6L9 17l-5-5"/>',
      delete: '<path d="M3 6h18"/><path d="M8 6V4a1 1 0 0 1 1-1h6a1 1 0 0 1 1 1v2"/><path d="M19 6l-1 14a1 1 0 0 1-1 1H7a1 1 0 0 1-1-1L5 6"/>',
      "gift-edit": '<path d="M12 20h9"/><path d="M16.5 3.5a2.1 2.1 0 0 1 3 3L7 19l-4 1 1-4z"/>',
      "gift-delete": '<path d="M3 6h18"/><path d="M8 6V4a1 1 0 0 1 1-1h6a1 1 0 0 1 1 1v2"/><path d="M19 6l-1 14a1 1 0 0 1-1 1H7a1 1 0 0 1-1-1L5 6"/>',
      "provider-open": '<path d="M9 18l6-6-6-6"/>',
      "provider-delete": '<path d="M3 6h18"/><path d="M8 6V4a1 1 0 0 1 1-1h6a1 1 0 0 1 1 1v2"/><path d="M19 6l-1 14a1 1 0 0 1-1 1H7a1 1 0 0 1-1-1L5 6"/>'
    };
    return '<button class="icon-btn" data-action="' + action + '" data-id="' + id + '" title="' + title + '" aria-label="' + title + '"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8">' + icons[action] + "</svg></button>";
  }

  document.getElementById("guestSearch").addEventListener("input", renderGuestTable);
  document.getElementById("filterRsvp").addEventListener("change", renderGuestTable);
  document.getElementById("filterInvitedFor").addEventListener("change", renderGuestTable);
  document.getElementById("filterCheckin").addEventListener("change", renderGuestTable);
  document.getElementById("filterGender").addEventListener("change", renderGuestTable);
  document.getElementById("filterAge").addEventListener("change", renderGuestTable);

  document.getElementById("guestRows").addEventListener("click", function (e) {
    var btn = e.target.closest(".icon-btn");
    if (!btn) return;
    var id = btn.dataset.id, action = btn.dataset.action;
    var g = guests.find(function (x) { return x.id === id; });
    if (!g) return;
    if (action === "edit") openGuestModal(g);
    else if (action === "link") copyInviteLink(g);
    else if (action === "invite") sendInvite(g);
    else if (action === "badge") openBadgeModal(g);
    else if (action === "checkin") toggleCheckin(g);
    else if (action === "delete") deleteGuest(g);
  });

  function copyInviteLink(g) {
    var url = location.origin + "/?g=" + encodeURIComponent(g.id);
    if (navigator.clipboard && navigator.clipboard.writeText) {
      navigator.clipboard.writeText(url).then(function () { showToast("Invite link copied for " + fullName(g)); }).catch(function () { prompt("Copy this link:", url); });
    } else { prompt("Copy this link:", url); }
  }

  function waNumber(phone) {
    var digits = String(phone || "").replace(/[^\d]/g, "");
    if (!digits) return "";
    if (digits.charAt(0) === "0") return "263" + digits.slice(1); // local Zimbabwean format -> country code
    return digits;
  }

  function sendInvite(g) {
    var link = location.origin + "/?g=" + encodeURIComponent(g.id);
    var msg = "Hello " + (g.firstName || "there") + "! You're warmly invited to Nyasha & Watson's wedding on Saturday, 5 December 2026 at Colne Valley Nature Reserve Park, Harare. Please view your invitation and RSVP here: " + link;
    var num = waNumber(g.phone);
    var url = (num ? "https://wa.me/" + num : "https://wa.me/") + "?text=" + encodeURIComponent(msg);
    window.open(url, "_blank");
    showToast(num ? "Opening WhatsApp to invite " + fullName(g) : "No phone on file — opening WhatsApp so you can choose a contact");
  }

  function toggleCheckin(g) {
    var next = !g.checkedIn;
    api("/api/admin/guests?id=" + g.id, { method: "PATCH", body: { checkedIn: next, checkInTime: next ? new Date().toISOString() : null, checkInMethod: next ? "usher" : "" } })
      .then(function () { showToast(next ? fullName(g) + " checked in" : "Check-in undone"); return loadAll(); })
      .catch(function () { showToast("Could not update check-in"); });
  }
  function deleteGuest(g) {
    askConfirm("Remove " + fullName(g) + "?", "This permanently removes them from the guest list.").then(function (ok) {
      if (!ok) return;
      api("/api/admin/guests?id=" + g.id, { method: "DELETE" }).then(function () { showToast("Guest removed"); return loadAll(); }).catch(function () { showToast("Could not remove guest"); });
    });
  }

  /* ---------------- GUEST MODAL ---------------- */
  var editingGuestId = null;
  function openGuestModal(g) {
    editingGuestId = g ? g.id : null;
    document.getElementById("guestModalTitle").textContent = g ? "Edit Guest" : "Add Guest";
    document.getElementById("f-first").value = g ? (g.firstName || "") : "";
    document.getElementById("f-last").value = g ? (g.lastName || "") : "";
    WNPhone.populatePhoneWidget(document.getElementById("f-phone-cc"), document.getElementById("f-phone"), g ? (g.phone || "") : "");
    document.getElementById("f-email").value = g ? (g.email || "") : "";
    document.getElementById("f-type").value = g ? (g.invitationType || "individual") : "individual";
    document.getElementById("f-family").value = g ? (g.familyName || "") : "";
    var invitedForVal = g ? (g.invitedFor || "") : "";
    document.getElementById("f-invitedfor").innerHTML = '<option value="">—</option>' +
      categories.map(function (c) { return '<option value="' + escapeHtml(c) + '"' + (c === invitedForVal ? " selected" : "") + ">" + escapeHtml(c) + "</option>"; }).join("");
    document.getElementById("f-gender").innerHTML = '<option value="">—</option>' + FG.GENDERS.map(function (x) { return '<option value="' + x.value + '">' + x.label + "</option>"; }).join("");
    document.getElementById("f-gender").value = g ? (g.gender || "") : "";
    document.getElementById("f-age").innerHTML = '<option value="">—</option>' + FG.AGE_GROUPS.map(function (a) { return '<option value="' + a.value + '">' + a.label + "</option>"; }).join("");
    document.getElementById("f-age").value = g ? (g.ageGroup || "") : "";
    document.getElementById("f-invited").value = g ? (g.invitedCount || 1) : 1;
    document.getElementById("f-rsvp").value = g ? (g.rsvpStatus || "pending") : "pending";
    document.getElementById("f-attending").value = g ? (g.attendingCount || 0) : 0;
    document.getElementById("f-plusone").checked = g ? !!g.plusOneAllowed : false;
    document.getElementById("f-notes").value = g ? (g.notes || "") : "";
    document.getElementById("guestModalOverlay").hidden = false;
    document.getElementById("f-first").focus();
  }
  function closeGuestModal() { document.getElementById("guestModalOverlay").hidden = true; editingGuestId = null; }
  document.getElementById("addGuestBtn").addEventListener("click", function () { openGuestModal(null); });
  document.getElementById("guestModalClose").addEventListener("click", closeGuestModal);
  document.getElementById("guestModalCancel").addEventListener("click", closeGuestModal);

  document.getElementById("guestModalSave").addEventListener("click", function () {
    var first = document.getElementById("f-first").value.trim();
    if (!first) { document.getElementById("f-first").focus(); return; }
    var data = {
      firstName: first,
      lastName: document.getElementById("f-last").value.trim(),
      phone: WNPhone.readPhoneWidget(document.getElementById("f-phone-cc"), document.getElementById("f-phone")),
      email: document.getElementById("f-email").value.trim(),
      invitationType: document.getElementById("f-type").value,
      familyName: document.getElementById("f-family").value.trim(),
      invitedFor: document.getElementById("f-invitedfor").value,
      gender: document.getElementById("f-gender").value,
      ageGroup: document.getElementById("f-age").value,
      invitedCount: Number(document.getElementById("f-invited").value) || 1,
      rsvpStatus: document.getElementById("f-rsvp").value,
      attendingCount: Number(document.getElementById("f-attending").value) || 0,
      plusOneAllowed: document.getElementById("f-plusone").checked,
      notes: document.getElementById("f-notes").value.trim()
    };
    if (data.rsvpStatus === "attending" && !data.attendingCount) data.attendingCount = data.invitedCount;
    var original = editingGuestId ? guests.find(function (x) { return x.id === editingGuestId; }) : null;
    var statusChanged = original ? (original.rsvpStatus || "pending") !== data.rsvpStatus : data.rsvpStatus !== "pending";
    if (statusChanged) { data.rsvpAt = data.rsvpStatus === "pending" ? null : new Date().toISOString(); data.rsvpChannel = data.rsvpStatus === "pending" ? "" : "admin"; }
    var req = editingGuestId
      ? api("/api/admin/guests?id=" + editingGuestId, { method: "PATCH", body: data })
      : api("/api/admin/guests", { method: "POST", body: data });
    req.then(function () { showToast(editingGuestId ? "Guest updated" : "Guest added"); closeGuestModal(); return loadAll(); })
      .catch(function (e) { showToast(e.message || "Could not save guest"); });
  });

  /* ---------------- BADGE ---------------- */
  var currentBadgeGuest = null;
  function openBadgeModal(g) { currentBadgeGuest = g; document.getElementById("badgeModalOverlay").hidden = false; drawBadge(g); }
  document.getElementById("badgeModalClose").addEventListener("click", function () { document.getElementById("badgeModalOverlay").hidden = true; });

  function drawBadge(g) {
    var qrTemp = document.getElementById("qrTemp");
    qrTemp.innerHTML = "";
    var qrDataUrlPromise;
    if (window.QRCode) {
      try {
        var badgeUrl = location.origin + "/?g=" + encodeURIComponent(g.id) + "&badge=1";
        new QRCode(qrTemp, { text: badgeUrl, width: 260, height: 260, colorDark: "#3E1730", colorLight: "#FBF7F0", correctLevel: QRCode.CorrectLevel.M });
        qrDataUrlPromise = new Promise(function (resolve) { setTimeout(function () { var c = qrTemp.querySelector("canvas"); resolve(c ? c.toDataURL("image/png") : null); }, 150); });
      } catch (e) { qrDataUrlPromise = Promise.resolve(null); }
    } else { qrDataUrlPromise = Promise.resolve(null); }

    Promise.all([qrDataUrlPromise, badgeSpray()]).then(function (res) {
      var qrDataUrl = res[0], spray = res[1];
      var c = document.getElementById("badgeCanvas");
      var ctx = c.getContext("2d");
      var w = c.width, h = c.height;
      ctx.fillStyle = "#FBF7F0"; ctx.fillRect(0, 0, w, h);
      ctx.strokeStyle = "#B08A46"; ctx.lineWidth = 3; ctx.strokeRect(24, 24, w - 48, h - 48);
      drawSpray(ctx, spray, w, h, 230, "tl", 62);
      drawSpray(ctx, spray, w, h, 230, "br", 62);
      ctx.textAlign = "center";
      ctx.fillStyle = "#8B7A6E"; ctx.font = '400 22px Jost, sans-serif';
      ctx.fillText("WATSON & NYASHA", w / 2, 90);
      ctx.fillStyle = "#B08A46"; ctx.font = '500 20px Jost, sans-serif';
      ctx.fillText("G U E S T   P A S S", w / 2, 124);
      ctx.strokeStyle = "#E4D2B0"; ctx.beginPath(); ctx.moveTo(80, 150); ctx.lineTo(w - 80, 150); ctx.stroke();
      ctx.fillStyle = "#3E1730"; ctx.font = '600 48px "Cormorant Garamond", serif';
      wrapText(ctx, fullName(g), w / 2, 220, w - 140, 52);
      ctx.fillStyle = "#8B7A6E"; ctx.font = '400 22px Jost, sans-serif';
      ctx.fillText("Party of " + (g.attendingCount || g.invitedCount || 1), w / 2, 330);
      var status = (g.rsvpStatus || "pending").toUpperCase().replace("_", " ");
      ctx.fillStyle = "#D97F55"; ctx.font = '500 24px Jost, sans-serif';
      ctx.fillText(status, w / 2, 372);
      if (qrDataUrl) {
        var img = new Image();
        img.onload = function () { ctx.drawImage(img, w / 2 - 140, 440, 280, 280); finishBadge(w, h); };
        img.src = qrDataUrl;
      } else {
        ctx.strokeStyle = "#E4D2B0"; ctx.strokeRect(w / 2 - 140, 440, 280, 280);
        ctx.fillStyle = "#8B7A6E"; ctx.font = '400 18px Jost, sans-serif';
        ctx.fillText("QR unavailable", w / 2, 590);
        finishBadge(w, h);
      }
    });
  }
  // Same floral spray as the website, bloom tucked just inside the corner and
  // tilted to follow the frame (matches drawSpray in assets/js/main.js).
  var badgeSprayPromise = null;
  function badgeSpray() {
    if (!badgeSprayPromise) badgeSprayPromise = new Promise(function (resolve) {
      var img = new Image();
      img.onload = function () { resolve(img); };
      img.onerror = function () { resolve(null); };
      img.src = "/assets/img/floral-spray.webp";
    });
    return badgeSprayPromise;
  }
  function drawSpray(ctx, img, cw, ch, size, corner, inset) {
    if (!img) return;
    var sw = size, sh = size * img.naturalHeight / img.naturalWidth;
    var x = corner === "tl" ? inset - 0.5 * sw : cw - inset - 0.5 * sw;
    var y = corner === "tl" ? inset - 0.41 * sh : ch - inset - 0.59 * sh;
    ctx.save();
    ctx.translate(x + sw / 2, y + sh / 2);
    if (corner === "br") ctx.rotate(Math.PI);
    ctx.rotate(-6 * Math.PI / 180);
    ctx.drawImage(img, -sw / 2, -sh / 2, sw, sh);
    ctx.restore();
  }
  function finishBadge(w, h) {
    var c = document.getElementById("badgeCanvas");
    var ctx = c.getContext("2d");
    ctx.fillStyle = "#3A2430"; ctx.font = '400 22px Jost, sans-serif';
    ctx.textAlign = "center";
    ctx.fillText("5 DECEMBER 2026", w / 2, 780);
    ctx.fillStyle = "#8B7A6E"; ctx.font = '400 18px Jost, sans-serif';
    ctx.fillText("COLNE VALLEY NATURE RESERVE PARK", w / 2, 810);
    document.getElementById("badgePreview").src = c.toDataURL("image/png");
  }
  function wrapText(ctx, text, x, y, maxWidth, lineHeight) {
    var words = text.split(" "); var line = ""; var lines = [];
    words.forEach(function (word) {
      var test = line + word + " ";
      if (ctx.measureText(test).width > maxWidth && line) { lines.push(line); line = word + " "; } else { line = test; }
    });
    lines.push(line);
    var startY = y - ((lines.length - 1) * lineHeight / 2);
    lines.forEach(function (l, i) { ctx.fillText(l.trim(), x, startY + i * lineHeight); });
  }

  document.getElementById("badgeDownloadBtn").addEventListener("click", function () {
    var c = document.getElementById("badgeCanvas");
    c.toBlob(function (blob) {
      if (!blob) return;
      var url = URL.createObjectURL(blob);
      var a = document.createElement("a");
      a.href = url; a.download = (currentBadgeGuest ? fullName(currentBadgeGuest).replace(/\s+/g, "-") : "Guest") + "-Badge.png";
      document.body.appendChild(a); a.click(); document.body.removeChild(a);
      setTimeout(function () { URL.revokeObjectURL(url); }, 4000);
      showToast("Badge saved");
    }, "image/png");
  });

  /* ---------------- CHECK-IN: search ---------------- */
  document.getElementById("checkinSearch").addEventListener("input", function (e) {
    var q = e.target.value.trim().toLowerCase();
    var box = document.getElementById("checkinResult");
    if (!q) { box.innerHTML = ""; return; }
    var matches = guests.filter(function (g) { return fullName(g).toLowerCase().indexOf(q) !== -1; }).slice(0, 8);
    box.innerHTML = matches.length ? matches.map(renderCheckinCard).join("") : '<p style="margin-top:14px; font-size:.84rem; color:var(--text-muted);">No matching guest found.</p>';
  });
  function renderCheckinCard(g) {
    var status = (g.rsvpStatus || "pending").replace("_", " ");
    return '<div class="checkin-result"><div class="g-name">' + escapeHtml(fullName(g)) + "</div>" +
      '<div class="g-sub">Party of ' + (g.attendingCount || g.invitedCount || 1) + " &middot; " + capitalize(status) + "</div>" +
      '<div style="margin-top:10px;"><button class="btn btn-sm ' + (g.checkedIn ? "btn-outline" : "btn-primary") + '" data-checkin-id="' + g.id + '">' + (g.checkedIn ? "Checked in ✓ (tap to undo)" : "Check In") + "</button></div></div>";
  }
  document.getElementById("checkinResult").addEventListener("click", function (e) {
    var btn = e.target.closest("[data-checkin-id]");
    if (!btn) return;
    var g = guests.find(function (x) { return x.id === btn.dataset.checkinId; });
    if (g) toggleCheckin(g);
  });

  /* ---------------- CHECK-IN: QR camera scan ---------------- */
  var scanning = false, scanStream = null, scanRAF = null;
  document.getElementById("scanToggleBtn").addEventListener("click", function () { if (scanning) stopScan(); else startScan(); });
  function startScan() {
    if (!window.jsQR) { document.getElementById("scanStatus").textContent = "QR scanning library unavailable — use search instead."; return; }
    if (!(navigator.mediaDevices && navigator.mediaDevices.getUserMedia)) { document.getElementById("scanStatus").textContent = "Camera not available in this browser — use search instead."; return; }
    navigator.mediaDevices.getUserMedia({ video: { facingMode: "environment" } }).then(function (stream) {
      scanStream = stream;
      var video = document.getElementById("scanVideo");
      video.srcObject = stream; video.hidden = false; video.play();
      scanning = true;
      document.getElementById("scanToggleBtn").textContent = "Stop Camera Scan";
      document.getElementById("scanStatus").textContent = "Point the camera at a guest's QR badge.";
      scanLoop();
    }).catch(function () { document.getElementById("scanStatus").textContent = "Camera access was blocked — use search instead."; });
  }
  function stopScan() {
    scanning = false;
    if (scanRAF) cancelAnimationFrame(scanRAF);
    if (scanStream) scanStream.getTracks().forEach(function (t) { t.stop(); });
    document.getElementById("scanVideo").hidden = true;
    document.getElementById("scanToggleBtn").textContent = "Start Camera Scan";
    document.getElementById("scanStatus").textContent = "";
  }
  function scanLoop() {
    if (!scanning) return;
    var video = document.getElementById("scanVideo");
    var canvas = document.getElementById("scanCanvas");
    if (video.readyState === video.HAVE_ENOUGH_DATA) {
      canvas.width = video.videoWidth; canvas.height = video.videoHeight;
      var ctx = canvas.getContext("2d");
      ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
      var img = ctx.getImageData(0, 0, canvas.width, canvas.height);
      var code = window.jsQR(img.data, img.width, img.height);
      if (code && code.data) {
        var scannedId = code.data;
        try { scannedId = new URL(code.data).searchParams.get("g") || code.data; } catch (e) {}
        var g = guests.find(function (x) { return x.id === scannedId; });
        if (g) {
          stopScan();
          document.getElementById("checkinSearch").value = fullName(g);
          document.getElementById("checkinResult").innerHTML = renderCheckinCard(g);
          showToast("Found " + fullName(g));
          return;
        }
      }
    }
    scanRAF = requestAnimationFrame(scanLoop);
  }

  /* ---------------- GIFTS ---------------- */
  function populateSelect(el, options, selected) {
    el.innerHTML = options.map(function (o) { return '<option value="' + o + '"' + (o === selected ? " selected" : "") + ">" + o + "</option>"; }).join("");
  }

  function renderGifts() {
    document.getElementById("giftsEmpty").hidden = gifts.length !== 0;
    var cashTotal = gifts.filter(function (g) { return g.type === "cash"; }).length;
    var kindTotal = gifts.filter(function (g) { return g.type === "kind"; }).length;
    var byCurrency = {};
    gifts.forEach(function (g) { if (g.type === "cash") byCurrency[g.currency] = (byCurrency[g.currency] || 0) + (Number(g.amount) || 0); });
    var totalsStr = Object.keys(byCurrency).map(function (c) { return c + " " + fmtMoney(byCurrency[c]); }).join("  ·  ") || "—";
    document.getElementById("giftStatGrid").innerHTML = [
      stat("Total Gifts", gifts.length),
      stat("Cash Gifts", cashTotal, totalsStr, true),
      stat("Gifts in Kind", kindTotal),
    ].join("");

    document.getElementById("giftRows").innerHTML = gifts.slice().sort(function (a, b) { return (b.date || "").localeCompare(a.date || ""); }).map(function (g) {
      var amountStr = g.type === "cash" ? (g.currency + " " + fmtMoney(g.amount)) : (g.estimatedValue != null ? "~" + (g.estimatedCurrency || "") + " " + fmtMoney(g.estimatedValue) : "—");
      return "<tr>" +
        "<td>" + (g.type === "cash" ? "Cash" : "In Kind") + "</td>" +
        "<td><div class=\"g-name\">" + escapeHtml(g.giver) + "</div>" + ([g.type === "kind" ? g.description : "", g.giverPhone].filter(Boolean).length ? '<div class="g-sub">' + escapeHtml([g.type === "kind" ? g.description : "", g.giverPhone].filter(Boolean).join(" · ")) + "</div>" : "") + "</td>" +
        "<td>" + fmtDate(g.date) + "</td>" +
        "<td>" + amountStr + "</td>" +
        "<td>" + escapeHtml(g.type === "cash" ? (g.paymentMethod || "") : "—") + "</td>" +
        "<td style=\"max-width:180px; font-size:.74rem; color:var(--text-muted);\">" + escapeHtml(g.notes || "—") + "</td>" +
        "<td><div class=\"row-actions\">" + iconBtn("gift-edit", g.id, "Edit") + iconBtn("gift-delete", g.id, "Delete") + "</div></td>" +
        "</tr>";
    }).join("");
  }
  document.getElementById("giftRows").addEventListener("click", function (e) {
    var btn = e.target.closest(".icon-btn");
    if (!btn) return;
    var g = gifts.find(function (x) { return x.id === btn.dataset.id; });
    if (!g) return;
    if (btn.dataset.action === "gift-edit") openGiftModal(g);
    else if (btn.dataset.action === "gift-delete") {
      askConfirm("Remove this gift record?", "This cannot be undone.").then(function (ok) {
        if (!ok) return;
        api("/api/admin/gifts?id=" + g.id, { method: "DELETE" }).then(function () { showToast("Gift removed"); return loadAll(); });
      });
    }
  });

  var editingGiftId = null;
  function openGiftModal(g) {
    editingGiftId = g ? g.id : null;
    document.getElementById("giftModalTitle").textContent = g ? "Edit Gift" : "Add Gift";
    populateSelect(document.getElementById("gift-currency"), currencies, g ? g.currency : "USD");
    populateSelect(document.getElementById("gift-value-currency"), currencies, g ? g.estimatedCurrency : "USD");
    populateSelect(document.getElementById("gift-method"), paymentMethods, g ? g.paymentMethod : paymentMethods[0]);
    var type = g ? g.type : "cash";
    document.querySelectorAll('input[name="gift-type"]').forEach(function (r) { r.checked = r.value === type; });
    toggleGiftFields(type);
    document.getElementById("gift-giver").value = g ? g.giver : "";
    document.getElementById("giftGiverGuestList").innerHTML = guests.map(function (guest) { return '<option value="' + escapeHtml(fullName(guest)) + '">'; }).join("");
    WNPhone.populatePhoneWidget(document.getElementById("gift-phone-cc"), document.getElementById("gift-phone"), g ? (g.giverPhone || "") : "");
    document.getElementById("gift-date").value = g ? g.date : new Date().toISOString().slice(0, 10);
    document.getElementById("gift-amount").value = g ? g.amount || "" : "";
    document.getElementById("gift-description").value = g ? g.description || "" : "";
    document.getElementById("gift-value").value = g && g.estimatedValue != null ? g.estimatedValue : "";
    document.getElementById("gift-notes").value = g ? g.notes || "" : "";
    document.getElementById("giftModalOverlay").hidden = false;
  }
  function toggleGiftFields(type) {
    document.getElementById("giftCashFields").style.display = type === "cash" ? "grid" : "none";
    document.getElementById("giftKindFields").style.display = type === "kind" ? "grid" : "none";
  }
  document.querySelectorAll('input[name="gift-type"]').forEach(function (r) { r.addEventListener("change", function () { toggleGiftFields(r.value); }); });
  document.getElementById("gift-giver").addEventListener("change", function (e) {
    var typed = e.target.value.trim().toLowerCase();
    var match = guests.find(function (guest) { return fullName(guest).toLowerCase() === typed; });
    var phoneInput = document.getElementById("gift-phone");
    if (match && match.phone && !phoneInput.value) {
      WNPhone.populatePhoneWidget(document.getElementById("gift-phone-cc"), phoneInput, match.phone);
    }
  });
  document.getElementById("addGiftBtn").addEventListener("click", function () { openGiftModal(null); });
  document.getElementById("giftModalClose").addEventListener("click", function () { document.getElementById("giftModalOverlay").hidden = true; });
  document.getElementById("giftModalCancel").addEventListener("click", function () { document.getElementById("giftModalOverlay").hidden = true; });
  document.getElementById("giftModalSave").addEventListener("click", function () {
    var type = document.querySelector('input[name="gift-type"]:checked').value;
    var body = {
      type: type,
      giver: document.getElementById("gift-giver").value.trim(),
      giverPhone: WNPhone.readPhoneWidget(document.getElementById("gift-phone-cc"), document.getElementById("gift-phone")),
      date: document.getElementById("gift-date").value,
      notes: document.getElementById("gift-notes").value.trim(),
    };
    if (type === "cash") {
      body.amount = document.getElementById("gift-amount").value;
      body.currency = document.getElementById("gift-currency").value;
      body.paymentMethod = document.getElementById("gift-method").value;
    } else {
      body.description = document.getElementById("gift-description").value.trim();
      body.estimatedValue = document.getElementById("gift-value").value || null;
      body.estimatedCurrency = document.getElementById("gift-value-currency").value;
    }
    var req = editingGiftId ? api("/api/admin/gifts?id=" + editingGiftId, { method: "PATCH", body: body }) : api("/api/admin/gifts", { method: "POST", body: body });
    req.then(function () { showToast("Gift saved"); document.getElementById("giftModalOverlay").hidden = true; return loadAll(); })
      .catch(function (e) { showToast(e.message || "Could not save gift"); });
  });

  /* ---------------- SERVICE PROVIDERS ---------------- */
  function renderProviders() {
    document.getElementById("providersEmpty").hidden = providers.length !== 0;
    var totalAgreed = {}, totalPaid = {}, totalOutstanding = {};
    var overdue = 0;
    providers.forEach(function (p) {
      var c = p.currency || "USD";
      totalAgreed[c] = (totalAgreed[c] || 0) + (Number(p.agreedFee) || 0);
      totalPaid[c] = (totalPaid[c] || 0) + (Number(p.amountPaid) || 0);
      totalOutstanding[c] = (totalOutstanding[c] || 0) + (Number(p.outstanding) || 0);
      if (p.status === "Overdue") overdue++;
    });
    function fmtByCurrency(obj) { return Object.keys(obj).map(function (c) { return c + " " + fmtMoney(obj[c]); }).join(" · ") || "—"; }
    document.getElementById("providerStatGrid").innerHTML = [
      stat("Providers", providers.length),
      stat("Agreed Total", fmtByCurrency(totalAgreed)),
      stat("Paid To Date", fmtByCurrency(totalPaid), null, true),
      stat("Outstanding", fmtByCurrency(totalOutstanding), overdue + " overdue"),
    ].join("");

    document.getElementById("providerRows").innerHTML = providers.map(function (p) {
      return "<tr>" +
        "<td><div class=\"g-name\">" + escapeHtml(p.name) + "</div><div class=\"g-sub\">" + escapeHtml(p.contactName || p.phone || p.email || "") + "</div></td>" +
        "<td>" + escapeHtml(p.category || "—") + "</td>" +
        "<td>" + (p.currency || "") + " " + fmtMoney(p.agreedFee) + "</td>" +
        "<td>" + (p.currency || "") + " " + fmtMoney(p.amountPaid) + "</td>" +
        "<td>" + (p.currency || "") + " " + fmtMoney(p.outstanding) + "</td>" +
        "<td><span class=\"pill " + statusPillClass(p.status) + "\">" + p.status + "</span></td>" +
        "<td>" + fmtDate(p.paymentDeadline) + "</td>" +
        "<td><div class=\"row-actions\">" + iconBtn("provider-open", p.id, "Open") + iconBtn("provider-delete", p.id, "Delete") + "</div></td>" +
        "</tr>";
    }).join("");
  }
  document.getElementById("providerRows").addEventListener("click", function (e) {
    var btn = e.target.closest(".icon-btn");
    if (!btn) return;
    var p = providers.find(function (x) { return x.id === btn.dataset.id; });
    if (!p) return;
    if (btn.dataset.action === "provider-open") openProviderModal(p);
    else if (btn.dataset.action === "provider-delete") {
      askConfirm("Delete " + p.name + "?", "This removes the provider and its full payment history.").then(function (ok) {
        if (!ok) return;
        api("/api/admin/providers?id=" + p.id, { method: "DELETE" }).then(function () { showToast("Provider removed"); return loadAll(); });
      });
    }
  });

  var editingProviderId = null;
  function openProviderModal(p) {
    editingProviderId = p ? p.id : null;
    document.getElementById("providerModalTitle").textContent = p ? "Edit " + p.name : "Add Service Provider";
    populateSelect(document.getElementById("prov-currency"), currencies, p ? p.currency : "USD");
    document.getElementById("prov-name").value = p ? p.name : "";
    document.getElementById("prov-category").value = p ? p.category : "";
    WNPhone.populatePhoneWidget(document.getElementById("prov-phone-cc"), document.getElementById("prov-phone"), p ? (p.phone || "") : "");
    document.getElementById("prov-email").value = p ? p.email : "";
    document.getElementById("prov-fee").value = p ? p.agreedFee : "";
    document.getElementById("prov-deadline").value = p ? p.paymentDeadline || "" : "";
    document.getElementById("prov-notes").value = p ? p.notes : "";
    document.getElementById("providerModalDelete").hidden = !p;
    document.getElementById("providerPaymentsSection").hidden = !p;
    if (p) {
      populateSelect(document.getElementById("pay-currency"), currencies, p.currency);
      populateSelect(document.getElementById("pay-method"), paymentMethods, paymentMethods[0]);
      document.getElementById("pay-date").value = new Date().toISOString().slice(0, 10);
      renderProviderPayments(p);
    }
    document.getElementById("providerModalOverlay").hidden = false;
  }
  function renderProviderPayments(p) {
    var comp = { amountPaid: p.amountPaid, outstanding: p.outstanding, status: p.status };
    document.getElementById("providerBalanceSummary").innerHTML =
      "Paid <strong>" + p.currency + " " + fmtMoney(comp.amountPaid) + "</strong> of <strong>" + p.currency + " " + fmtMoney(p.agreedFee) + "</strong> — outstanding <strong>" + p.currency + " " + fmtMoney(comp.outstanding) + "</strong> — <span class=\"pill " + statusPillClass(comp.status) + "\">" + comp.status + "</span>" +
      (p.otherCurrencyPaid && p.otherCurrencyPaid.length ? "<br><span style=\"color:var(--text-muted);\">Also received payments in " + p.otherCurrencyPaid.join(", ") + " (kept separate — not converted).</span>" : "");
    var payments = p.payments || [];
    document.getElementById("providerPaymentsList").innerHTML = payments.length ? payments.map(function (pay) {
      return '<div class="payment-row"><span>' + fmtDate(pay.date) + " — " + pay.currency + " " + fmtMoney(pay.amount) + " (" + escapeHtml(pay.method) + ")" + (pay.notes ? " — " + escapeHtml(pay.notes) : "") + '</span><button class="pr-del" data-payid="' + pay.id + '">Remove</button></div>';
    }).join("") : '<p style="font-size:.8rem; color:var(--text-muted);">No payments recorded yet.</p>';
  }
  document.getElementById("providerPaymentsList").addEventListener("click", function (e) {
    var btn = e.target.closest(".pr-del");
    if (!btn || !editingProviderId) return;
    api("/api/admin/providers?id=" + editingProviderId, { method: "PATCH", body: { action: "delete-payment", paymentId: btn.dataset.payid } })
      .then(function (res) {
        var p = providers.find(function (x) { return x.id === editingProviderId; });
        Object.assign(p, res.provider);
        renderProviderPayments(p);
        showToast("Payment removed");
        return loadAll();
      });
  });
  document.getElementById("addPaymentBtn").addEventListener("click", function () {
    var amount = Number(document.getElementById("pay-amount").value);
    if (!amount || amount <= 0) { showToast("Enter a payment amount"); return; }
    api("/api/admin/providers?id=" + editingProviderId, {
      method: "PATCH",
      body: { action: "add-payment", amount: amount, currency: document.getElementById("pay-currency").value, method: document.getElementById("pay-method").value, date: document.getElementById("pay-date").value }
    }).then(function (res) {
      showToast("Payment recorded");
      document.getElementById("pay-amount").value = "";
      return loadAll().then(function () {
        var p = providers.find(function (x) { return x.id === editingProviderId; });
        if (p) renderProviderPayments(p);
      });
    }).catch(function (e) { showToast(e.message || "Could not record payment"); });
  });

  document.getElementById("addProviderBtn").addEventListener("click", function () { openProviderModal(null); });
  document.getElementById("providerModalClose").addEventListener("click", function () { document.getElementById("providerModalOverlay").hidden = true; });
  document.getElementById("providerModalSave").addEventListener("click", function () {
    var body = {
      name: document.getElementById("prov-name").value.trim(),
      category: document.getElementById("prov-category").value.trim(),
      phone: WNPhone.readPhoneWidget(document.getElementById("prov-phone-cc"), document.getElementById("prov-phone")),
      email: document.getElementById("prov-email").value.trim(),
      agreedFee: document.getElementById("prov-fee").value,
      currency: document.getElementById("prov-currency").value,
      paymentDeadline: document.getElementById("prov-deadline").value || null,
      notes: document.getElementById("prov-notes").value.trim(),
    };
    if (!body.name) { document.getElementById("prov-name").focus(); return; }
    var req = editingProviderId ? api("/api/admin/providers?id=" + editingProviderId, { method: "PATCH", body: body }) : api("/api/admin/providers", { method: "POST", body: body });
    req.then(function (res) {
      showToast("Provider saved");
      if (!editingProviderId) { editingProviderId = res.provider.id; }
      return loadAll();
    }).then(function () {
      var p = providers.find(function (x) { return x.id === editingProviderId; });
      if (p) openProviderModal(p);
    }).catch(function (e) { showToast(e.message || "Could not save provider"); });
  });
  document.getElementById("providerModalDelete").addEventListener("click", function () {
    if (!editingProviderId) return;
    askConfirm("Delete this provider?", "This removes the provider and its full payment history.").then(function (ok) {
      if (!ok) return;
      api("/api/admin/providers?id=" + editingProviderId, { method: "DELETE" }).then(function () {
        showToast("Provider removed");
        document.getElementById("providerModalOverlay").hidden = true;
        return loadAll();
      });
    });
  });

  /* ---------------- CSV IMPORT (generic engine, reused for guests/gifts/providers) ---------------- */
  function importOpt(r, value, label) {
    return "<option value=\"" + value + "\"" + (r.resolution === value ? " selected" : "") + ">" + label + "</option>";
  }

  function setupCsvImport(cfg) {
    var rows = [];
    function reset() {
      rows = [];
      document.getElementById(cfg.previewWrapId).hidden = true;
      document.getElementById(cfg.dropzoneId).hidden = false;
      document.getElementById(cfg.commitBtnId).hidden = true;
      document.getElementById(cfg.fileInputId).value = "";
    }
    document.getElementById(cfg.openBtnId).addEventListener("click", function () {
      reset();
      document.getElementById(cfg.overlayId).hidden = false;
    });
    document.getElementById(cfg.closeId).addEventListener("click", function () { document.getElementById(cfg.overlayId).hidden = true; });
    document.getElementById(cfg.cancelId).addEventListener("click", function () { document.getElementById(cfg.overlayId).hidden = true; });

    var dz = document.getElementById(cfg.dropzoneId);
    dz.addEventListener("click", function () { document.getElementById(cfg.fileInputId).click(); });
    dz.addEventListener("dragover", function (e) { e.preventDefault(); dz.classList.add("dragover"); });
    dz.addEventListener("dragleave", function () { dz.classList.remove("dragover"); });
    dz.addEventListener("drop", function (e) {
      e.preventDefault(); dz.classList.remove("dragover");
      if (e.dataTransfer.files && e.dataTransfer.files[0]) readFile(e.dataTransfer.files[0]);
    });
    document.getElementById(cfg.fileInputId).addEventListener("change", function (e) {
      if (e.target.files && e.target.files[0]) readFile(e.target.files[0]);
    });

    function readFile(file) {
      var reader = new FileReader();
      reader.onload = function () {
        api(cfg.endpoint, { method: "POST", body: { csv: String(reader.result) } })
          .then(function (res) { showPreview(res); })
          .catch(function (e) { showToast(e.message || "Could not read that CSV file"); });
      };
      reader.readAsText(file);
    }

    function showPreview(res) {
      rows = res.rows.map(function (r) { return Object.assign({}, r, { resolution: r.duplicate ? "skip" : "create" }); });
      document.getElementById(cfg.dropzoneId).hidden = true;
      document.getElementById(cfg.previewWrapId).hidden = false;
      document.getElementById(cfg.commitBtnId).hidden = false;
      document.getElementById(cfg.summaryId).innerHTML =
        "<span><strong>" + res.totalRows + "</strong> rows found</span>" +
        "<span><strong>" + res.duplicateCount + "</strong> possible duplicates</span>" +
        (res.invalidRows ? "<span><strong>" + res.invalidRows + "</strong> rows missing required details (will be skipped)</span>" : "");
      render();
    }
    function render() {
      document.getElementById(cfg.rowsId).innerHTML = rows.map(function (r, idx) { return cfg.renderRow(r, idx); }).join("");
    }
    document.getElementById(cfg.rowsId).addEventListener("change", function (e) {
      var sel = e.target.closest(".import-action-select");
      if (!sel) return;
      rows[Number(sel.dataset.idx)].resolution = sel.value;
    });
    document.getElementById(cfg.commitBtnId).addEventListener("click", function () {
      var payloadRows = rows.filter(cfg.isValid).map(cfg.buildCommitRow);
      api(cfg.endpoint, { method: "POST", body: { mode: "commit", rows: payloadRows } })
        .then(function (res) {
          showToast(cfg.resultText(res));
          document.getElementById(cfg.overlayId).hidden = true;
          return loadAll();
        }).catch(function (e) { showToast(e.message || "Import failed"); });
    });
  }

  setupCsvImport({
    openBtnId: "importGuestsBtn", overlayId: "importModalOverlay", closeId: "importModalClose", cancelId: "importCancelBtn",
    dropzoneId: "importDropzone", fileInputId: "importFileInput", previewWrapId: "importPreviewWrap", summaryId: "importSummary",
    rowsId: "importRows", commitBtnId: "importCommitBtn", endpoint: "/api/admin/guests-import",
    isValid: function (r) { return !!r.draft.firstName; },
    buildCommitRow: function (r) { return { fields: r.fields, resolution: r.resolution, targetId: r.duplicate ? r.duplicate.id : null }; },
    resultText: function (res) { return "Imported: " + res.created + " created, " + res.updated + " updated, " + res.skipped + " skipped"; },
    renderRow: function (r, idx) {
      var name = (r.draft.firstName + " " + r.draft.lastName).trim() || "(no name)";
      var statusHtml = r.duplicate
        ? '<span class="pill pill-status-amber">Possible duplicate of ' + escapeHtml(r.duplicate.name) + "</span>"
        : (r.draft.firstName ? '<span class="pill pill-status-green">New guest</span>' : '<span class="pill pill-status-red">Missing name</span>');
      var actionOptions = r.duplicate
        ? importOpt(r, "skip", "Skip") + importOpt(r, "update", "Update existing") + importOpt(r, "create", "Create new anyway")
        : importOpt(r, "create", "Create") + importOpt(r, "skip", "Skip");
      return "<tr><td>" + escapeHtml(name) + "</td><td>" + escapeHtml(r.draft.phone || "—") + "</td><td>" + (r.draft.invitedCount || 1) + "</td><td>" + statusHtml + "</td>" +
        '<td><select data-idx="' + idx + '" class="import-action-select" style="border:1px solid var(--border); border-radius:6px; padding:6px 8px; font-family:inherit; font-size:.78rem;">' + actionOptions + "</select></td></tr>";
    },
  });

  setupCsvImport({
    openBtnId: "importGiftsBtn", overlayId: "giftImportModalOverlay", closeId: "giftImportModalClose", cancelId: "giftImportCancelBtn",
    dropzoneId: "giftImportDropzone", fileInputId: "giftImportFileInput", previewWrapId: "giftImportPreviewWrap", summaryId: "giftImportSummary",
    rowsId: "giftImportRows", commitBtnId: "giftImportCommitBtn", endpoint: "/api/admin/gifts",
    isValid: function (r) { return !!(r.draft.giver && (r.draft.type !== "kind" || r.draft.description)); },
    buildCommitRow: function (r) { return { fields: r.fields, resolution: r.resolution }; },
    resultText: function (res) { return "Imported: " + res.created + " added, " + res.skipped + " skipped"; },
    renderRow: function (r, idx) {
      var typeLabel = r.draft.type === "kind" ? "In Kind" : "Cash";
      var amountOrItem = r.draft.type === "kind" ? escapeHtml(r.draft.description || "—") : (r.draft.currency + " " + fmtMoney(r.draft.amount));
      var valid = r.draft.giver && (r.draft.type !== "kind" || r.draft.description);
      var statusHtml = r.duplicate
        ? '<span class="pill pill-status-amber">Possible duplicate</span>'
        : (valid ? '<span class="pill pill-status-green">New gift</span>' : '<span class="pill pill-status-red">Missing details</span>');
      var actionOptions = r.duplicate
        ? importOpt(r, "skip", "Skip") + importOpt(r, "create", "Add anyway")
        : importOpt(r, "create", "Add") + importOpt(r, "skip", "Skip");
      return "<tr><td>" + typeLabel + "</td><td>" + escapeHtml(r.draft.giver || "—") + "</td><td>" + fmtDate(r.draft.date) + "</td><td>" + amountOrItem + "</td><td>" + statusHtml + "</td>" +
        '<td><select data-idx="' + idx + '" class="import-action-select" style="border:1px solid var(--border); border-radius:6px; padding:6px 8px; font-family:inherit; font-size:.78rem;">' + actionOptions + "</select></td></tr>";
    },
  });

  setupCsvImport({
    openBtnId: "importProvidersBtn", overlayId: "providerImportModalOverlay", closeId: "providerImportModalClose", cancelId: "providerImportCancelBtn",
    dropzoneId: "providerImportDropzone", fileInputId: "providerImportFileInput", previewWrapId: "providerImportPreviewWrap", summaryId: "providerImportSummary",
    rowsId: "providerImportRows", commitBtnId: "providerImportCommitBtn", endpoint: "/api/admin/providers",
    isValid: function (r) { return !!r.draft.name; },
    buildCommitRow: function (r) { return { fields: r.fields, resolution: r.resolution, targetId: r.duplicate ? r.duplicate.id : null }; },
    resultText: function (res) { return "Imported: " + res.created + " created, " + res.updated + " updated, " + res.skipped + " skipped"; },
    renderRow: function (r, idx) {
      var statusHtml = r.duplicate
        ? '<span class="pill pill-status-amber">Possible duplicate of ' + escapeHtml(r.duplicate.name) + "</span>"
        : (r.draft.name ? '<span class="pill pill-status-green">New provider</span>' : '<span class="pill pill-status-red">Missing name</span>');
      var actionOptions = r.duplicate
        ? importOpt(r, "skip", "Skip") + importOpt(r, "update", "Update existing") + importOpt(r, "create", "Create new anyway")
        : importOpt(r, "create", "Create") + importOpt(r, "skip", "Skip");
      return "<tr><td>" + escapeHtml(r.draft.name || "(no name)") + "</td><td>" + escapeHtml(r.draft.category || "—") + "</td><td>" + r.draft.currency + " " + fmtMoney(r.draft.agreedFee) + "</td><td>" + statusHtml + "</td>" +
        '<td><select data-idx="' + idx + '" class="import-action-select" style="border:1px solid var(--border); border-radius:6px; padding:6px 8px; font-family:inherit; font-size:.78rem;">' + actionOptions + "</select></td></tr>";
    },
  });

  /* ---------------- INIT ---------------- */
  // The page itself is already gated by middleware.js (redirects to /admin/login.html
  // before this ever loads), so there's no separate session check here — just render
  // and start fetching. If a session has since expired, api() below redirects on 401.
  loadAll().catch(function () { showToast("Could not load guest data"); });
})();
