(function () {
  "use strict";

  var guests = [];
  var gifts = [];
  var providers = [];
  var requests = [];
  var tables = [];
  var removedGuests = [];
  var me = null;
  var picked = {};
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

  /* ---------------- SEATING HELPERS (same rules as lib/seating.js) ---------------- */
  // Seats an invitation needs: confirmed number once attending, none once declined,
  // otherwise the number invited (so tables are never planned beyond capacity).
  function seatsFor(g) {
    if (g.rsvpStatus === "not_attending") return 0;
    if (g.rsvpStatus === "attending") return Math.max(1, Number(g.attendingCount) || Number(g.invitedCount) || 1);
    return Math.max(1, Number(g.invitedCount) || 1);
  }
  function delivery(g) { return g.openedAt ? "opened" : g.inviteSentAt ? "sent" : "not"; }
  var DELIVERY = { opened: "Opened", sent: "Sent, not opened", not: "Not sent" };
  function tableById(id) { return id ? tables.find(function (x) { return x.id === id; }) || null : null; }
  function tableName(g) { var tb = tableById(g.tableId); return tb ? tb.name : ""; }
  function seatsUsed(tableId, exceptId) { return guests.reduce(function (s, g) { return g.tableId === tableId && g.id !== exceptId ? s + seatsFor(g) : s; }, 0); }
  function seatsLeft(tb, exceptId) { return tb.capacity - seatsUsed(tb.id, exceptId); }

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
    if (tab === "users") { renderUsers(); renderBackups(); }
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
      var all = res[0].guests || [];
      guests = all.filter(function (g) { return !g.removedAt; }); removedGuests = all.filter(function (g) { return g.removedAt; });
      me = res[0].me || me; applyRole();
      requests = res[0].requests || []; tables = res[0].tables || []; if (res[0].categories && res[0].categories.length) categories = res[0].categories;
      gifts = res[1].gifts; currencies = res[1].currencies; paymentMethods = res[1].paymentMethods;
      providers = res[2].providers;
      renderAll();
    });
  }
  // Owners see Portal Users; viewers get the read-only view (the API enforces both).
  function applyRole() {
    var role = me ? me.role : "owner";
    document.body.classList.toggle("role-viewer", role === "viewer");
    var owner = role === "owner";
    document.getElementById("usersNav").hidden = !owner;
    var opt = document.getElementById("usersOption"); opt.hidden = !owner; opt.disabled = !owner;
  }
  function renderAll() {
    populateInvitedForFilter();
    renderDashboard(); renderGuestTable(); renderApprovals(); renderTables();
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
    fillSelect("filterTable", "All tables", [{ value: "_none", label: "Not seated" }].concat(tables.map(function (tb) { return { value: tb.id, label: tb.name }; })));
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
      stat("Seated", guests.filter(function (g) { return g.tableId && seatsFor(g); }).reduce(function (s, g) { return s + seatsFor(g); }, 0) + " / " + guests.reduce(function (s, g) { return s + seatsFor(g); }, 0), tables.length + " tables · people with a seat / expected"),
      stat("Needs Review", guests.filter(function (g) { return g.reviewFlag; }).length, "invitations to check", guests.some(function (g) { return g.reviewFlag; })),
      stat("Pending Approval", requests.filter(function (r) { return r.status === "pending"; }).length, "RSVPs from people not on the invite list", requests.some(function (r) { return r.status === "pending"; })),
      stat("RSVP Rate", rate + "%", responded + " of " + total + " responded"),
      stat("Cash Gifts", cashTotalStr, gifts.filter(function (g) { return g.type === "cash"; }).length + " gifts recorded"),
      stat("Gifts in Kind", kindCount, "items received"),
      stat("Providers Outstanding", outstandingStr, providers.length + " providers tracked"),
      stat("Payments Due", overdueCount + dueSoonCount, overdueCount + " overdue · " + dueSoonCount + " due soon", overdueCount > 0)
    ].join("");

    var dOpened = guests.filter(function (g) { return delivery(g) === "opened"; }).length, dSent = guests.filter(function (g) { return delivery(g) === "sent"; }).length, dNot = total - dOpened - dSent;
    document.getElementById("deliveryNote").textContent = (dOpened + dSent) + " marked as sent · " + dOpened + " opened · " + guests.filter(function (g) { return !g.phone; }).length + " without a phone number";
    var pct = function (n) { return total ? (n / total * 100).toFixed(2) + "%" : "0"; };
    document.getElementById("deliveryBar").innerHTML = '<span class="seg-opened" style="width:' + pct(dOpened) + '"></span><span class="seg-sent" style="width:' + pct(dSent) + '"></span><span class="seg-not" style="width:' + pct(dNot) + '"></span>';
    document.getElementById("deliveryLegend").innerHTML = '<span><i class="seg-opened"></i>Opened ' + dOpened + '</span><span><i class="seg-sent"></i>Sent, not opened ' + dSent + '</span><span><i class="seg-not"></i>Not sent ' + dNot + "</span>";

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
  // Gender is optional, so the note says how much of the list it covers.
  function renderGuestMix(attending) {
    var withGender = attending.filter(function (g) { return g.gender; });
    var gMax = Math.max(1, withGender.length);
    document.getElementById("genderBars").innerHTML = withGender.length
      ? FG.GENDERS.map(function (x) { return barRow([x.label, withGender.filter(function (g) { return g.gender === x.value; }).length, gMax]); }).join("")
      : '<p style="color:var(--text-muted); font-size:.84rem;">No genders recorded yet.</p>';
    document.getElementById("mixNote").textContent = attending.length ? "Gender recorded for " + withGender.length + " of " + attending.length + " attending invitations." : "";
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
    // multi-currency totals ("USD 400.00 · GBP 150.00 …") get a smaller size instead of wrapping in giant type
    var long = String(val).length > 12;
    return '<div class="stat-card' + (accent ? " accent" : "") + '"><div class="sc-label">' + label + '</div><div class="sc-val' + (long ? " long" : "") + '">' + val + "</div>" + (sub ? '<div class="sc-sub">' + sub + "</div>" : "") + "</div>";
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
    var fTable = document.getElementById("filterTable").value;
    var fReview = document.getElementById("filterReview").value;
    var fDelivery = document.getElementById("filterDelivery").value;
    var fPhone = document.getElementById("filterPhone").value;

    var showRemoved = document.getElementById("showRemoved").checked;
    document.getElementById("removedCount").textContent = removedGuests.length ? "(" + removedGuests.length + ")" : "";
    var rows = (showRemoved ? removedGuests : guests).filter(function (g) {
      if (q) {
        var hay = (fullName(g) + " " + (g.phone || "") + " " + (g.familyName || "") + " " + tableName(g) + " " + (g.notes || "")).toLowerCase();
        if (hay.indexOf(q) === -1) return false;
      }
      if (fRsvp && (g.rsvpStatus || "pending") !== fRsvp) return false;
      if (fInvitedFor && (g.invitedFor || "") !== fInvitedFor) return false;
      if (fGender && (fGender === "_none" ? !!g.gender : g.gender !== fGender)) return false;
      if (fCheckin === "yes" && !g.checkedIn) return false;
      if (fCheckin === "no" && g.checkedIn) return false;
      if (fTable === "_none" && tableById(g.tableId)) return false;
      if (fTable && fTable !== "_none" && g.tableId !== fTable) return false;
      if (fDelivery && delivery(g) !== fDelivery) return false;
      if (fPhone === "yes" && !g.phone) return false;
      if (fPhone === "no" && g.phone) return false;
      if (fReview === "yes" && !g.reviewFlag) return false;
      if (fReview === "no" && g.reviewFlag) return false;
      return true;
    }).sort(function (a, b) { return fullName(a).localeCompare(fullName(b)); });
    var people = rows.reduce(function (s, g) { return s + (Number(g.invitedCount) || 1); }, 0);
    document.getElementById("guestCountNote").textContent = guests.length ? "Showing " + rows.length + " of " + guests.length + " invitations · " + people + " people invited" : "";

    document.getElementById("guestsEmpty").hidden = guests.length !== 0;

    document.getElementById("guestRows").innerHTML = rows.map(function (g) {
      var status = g.rsvpStatus || "pending";
      var subLine = [g.familyName || capitalize(g.invitationType || "individual"), g.invitedFor].filter(Boolean).join(" · ");
      var meta = [FG.genderLabel(g.gender), g.rsvpChannel && status !== "pending" ? "Replied via " + (CHANNELS[g.rsvpChannel] || g.rsvpChannel) : ""].filter(Boolean).join(" · ");
      var dv = delivery(g);
      var lastC = (g.contacts || []).slice(-1)[0];
      if (lastC) meta = (meta ? meta + " · " : "") + "Last contact: " + lastC.channel + " · " + fmtDate(lastC.at);
      if (g.removedAt) meta = (meta ? meta + " · " : "") + "Removed " + fmtDate(g.removedAt) + (g.removedBy ? " by " + g.removedBy : "");
      return "<tr>" +
        '<td class="pick"><input type="checkbox" class="pick-one" data-id="' + g.id + '"' + (picked[g.id] ? " checked" : "") + ' aria-label="Select ' + escapeHtml(fullName(g)) + '"></td>' +
        '<td><div class="g-name">' + escapeHtml(fullName(g)) + '</div><div class="g-sub">' + escapeHtml(subLine) + "</div>" + (meta ? '<div class="g-meta">' + escapeHtml(meta) + "</div>" : "") + '<div class="g-meta"><span class="pill pill-delivery-' + dv + '">' + DELIVERY[dv] + "</span>" + (g.phone ? "" : ' <span style="font-size:.68rem;">· no phone</span>') + "</div>" + (g.reviewFlag ? '<div class="g-meta"><span class="pill pill-review" title="' + escapeHtml(g.reviewFlag) + '">Needs review: ' + escapeHtml(g.reviewFlag.length > 60 ? g.reviewFlag.slice(0, 57) + "…" : g.reviewFlag) + "</span></div>" : "") + "</td>" +
        '<td><span class="pill pill-' + status + '">' + status.replace("_", " ") + "</span></td>" +
        "<td>" + (g.attendingCount != null && g.attendingCount !== "" ? g.attendingCount : "—") + " / " + (g.invitedCount || 1) + "</td>" +
        "<td>" + (tableName(g) ? '<span class="pill pill-table">' + escapeHtml(tableName(g)) + "</span>" : '<span style="color:var(--text-muted);">—</span>') + "</td>" +
        "<td>" + checkinPill(g) + "</td>" +
        '<td><div class="row-actions">' + (g.removedAt
          ? iconBtn("restore", g.id, "Restore to the guest list") + iconBtn("purge", g.id, "Delete permanently")
          : iconBtn("edit", g.id, "Edit") + iconBtn("link", g.id, "Copy invite link") + iconBtn("invite", g.id, "Send invite via WhatsApp") + iconBtn("contact", g.id, "Log contact") + iconBtn("invitepdf", g.id, "Invitation PDF (A5)") + iconBtn("badge", g.id, "Badge") + iconBtn("checkin", g.id, g.checkedIn ? "Undo check-in" : "Check in") + iconBtn("delete", g.id, "Remove")) + "</div></td>" +
        "</tr>";
    }).join("");
    shownIds = rows.map(function (g) { return g.id; });
    renderBulkBar();
  }
  var shownIds = [];
  function iconBtn(action, id, title) {
    var icons = {
      edit: '<path d="M12 20h9"/><path d="M16.5 3.5a2.1 2.1 0 0 1 3 3L7 19l-4 1 1-4z"/>',
      link: '<path d="M10 13a5 5 0 0 0 7 0l2-2a5 5 0 0 0-7-7l-1 1"/><path d="M14 11a5 5 0 0 0-7 0l-2 2a5 5 0 0 0 7 7l1-1"/>',
      invite: '<path d="m22 2-7 20-4-9-9-4Z"/><path d="M22 2 11 13"/>',
      badge: '<rect x="4" y="3" width="16" height="18" rx="2"/><circle cx="12" cy="10" r="3"/><path d="M8 18h8"/>',
      invitepdf: '<path d="M14 3H7a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2V8z"/><path d="M14 3v5h5"/><path d="M12 11v6M9.5 14.5 12 17l2.5-2.5"/>',
      checkin: '<path d="M20 6L9 17l-5-5"/>',
      contact: '<path d="M21 12a8.5 8.5 0 0 1-12.4 7.5L3 21l1.6-5.4A8.5 8.5 0 1 1 21 12z"/><path d="M8.5 11h7M8.5 14.5h4"/>',
      restore: '<path d="M3 12a9 9 0 1 0 3-6.7L3 8"/><path d="M3 3v5h5"/>',
      purge: '<path d="M3 6h18"/><path d="M8 6V4a1 1 0 0 1 1-1h6a1 1 0 0 1 1 1v2"/><path d="M19 6l-1 14a1 1 0 0 1-1 1H7a1 1 0 0 1-1-1L5 6"/><path d="M10 11v6M14 11v6"/>',
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
  document.getElementById("filterTable").addEventListener("change", renderGuestTable);
  document.getElementById("showRemoved").addEventListener("change", function () { picked = {}; renderGuestTable(); });

  /* ---------------- BULK ACTIONS ---------------- */
  function pickedIds() { return Object.keys(picked).filter(function (id) { return picked[id]; }); }
  function renderBulkBar() {
    var ids = pickedIds(), removedView = document.getElementById("showRemoved").checked;
    document.getElementById("bulkBar").hidden = !ids.length;
    document.getElementById("bulkCount").textContent = ids.length + " selected";
    var all = document.getElementById("pickAll");
    all.checked = shownIds.length > 0 && shownIds.every(function (id) { return picked[id]; });
    var ops = removedView ? [["restore", "Restore to the guest list"]] : [["invitePdf", "Download invitations (PDF)"], ["markSent", "Mark invitation sent"], ["seat", "Seat at a table…"], ["rsvp", "Set RSVP…"], ["invitedFor", "Set invited for…"], ["remove", "Remove"]];
    var sel = document.getElementById("bulkOp"), cur = sel.value;
    sel.innerHTML = ops.map(function (o) { return '<option value="' + o[0] + '">' + o[1] + "</option>"; }).join("");
    if (ops.some(function (o) { return o[0] === cur; })) sel.value = cur;
    renderBulkValue();
  }
  function renderBulkValue() {
    var op = document.getElementById("bulkOp").value, v = document.getElementById("bulkValue");
    var opts = null;
    if (op === "seat") opts = tables.map(function (tb) { return [tb.id, tb.name + " · " + Math.max(0, seatsLeft(tb)) + " free"]; }).concat([["", "Not seated (take off their table)"]]);
    if (op === "rsvp") opts = [["attending", "Attending"], ["maybe", "Maybe"], ["not_attending", "Not attending"], ["pending", "Pending"]];
    if (op === "invitedFor") opts = categories.map(function (c) { return [c, c]; });
    v.hidden = !opts;
    if (opts) v.innerHTML = opts.map(function (o) { return '<option value="' + escapeHtml(o[0]) + '">' + escapeHtml(o[1]) + "</option>"; }).join("");
  }
  document.getElementById("bulkOp").addEventListener("change", renderBulkValue);
  document.getElementById("guestRows").addEventListener("change", function (e) {
    var cb = e.target.closest(".pick-one"); if (!cb) return;
    picked[cb.dataset.id] = cb.checked; renderBulkBar();
  });
  document.getElementById("pickAll").addEventListener("change", function (e) {
    shownIds.forEach(function (id) { picked[id] = e.target.checked; });
    renderGuestTable();
  });
  document.getElementById("bulkClear").addEventListener("click", function () { picked = {}; renderGuestTable(); });
  document.getElementById("bulkApply").addEventListener("click", function () {
    var ids = pickedIds(), op = document.getElementById("bulkOp").value, value = document.getElementById("bulkValue").hidden ? null : document.getElementById("bulkValue").value;
    if (!ids.length) return;
    if (op === "invitePdf") { invitationPdfs(ids.map(function (id) { return guests.find(function (x) { return x.id === id; }); }).filter(Boolean)); return; }
    var go = function () {
      api("/api/admin/guests", { method: "POST", body: { action: "bulk", ids: ids, op: op, value: value } }).then(function (res) {
        picked = {};
        showToast(res.done + " guest(s) updated");
        if (res.notSeated && res.notSeated.length) askConfirm("Some guests weren't seated", "Not enough free seats for: " + res.notSeated.join(", ") + ".");
        return loadAll();
      }).catch(function (e) { showToast(e.message || "Could not apply that"); });
    };
    if (op === "remove") askConfirm("Remove " + ids.length + " guest(s)?", "They move to Removed and give up their tables. You can restore them any time.").then(function (ok) { if (ok) go(); });
    else go();
  });

  /* ---------------- A5 PDF INVITATIONS ---------------- */
  // Same card the guests save from their invitation (assets/js/wn-invitation-pdf.js):
  // the venue opens Google Maps, the phone numbers dial, the QR code and web
  // address open that guest's personal invitation. Many guests = one PDF, a page each.
  var pdfBusy = false;
  function invitationPdfs(list) {
    if (!list.length || pdfBusy) return;
    if (!window.WNInvitationPDF) { showToast("The PDF maker didn't load — refresh the page"); return; }
    pdfBusy = true;
    var items = list.map(function (g) { return { name: fullName(g), link: location.origin + "/?g=" + encodeURIComponent(g.id) }; });
    var name = list.length === 1 ? WNInvitationPDF.fileName(items[0].name) : "Nyasha-Watson-Invitations-" + list.length + "-guests.pdf";
    showToast(list.length === 1 ? "Preparing the invitation…" : "Preparing " + list.length + " invitations…");
    WNInvitationPDF.download(items, name, function (done, total) {
      if (total > 12 && done < total) showToast("Preparing invitations… " + done + " of " + total);
    }).then(function () {
      showToast(list.length === 1 ? "Invitation saved (A5 PDF)" : list.length + " invitations saved in one PDF");
    }).catch(function (e) {
      console.warn("[invitation pdf]", e);
      showToast("Sorry, the PDF could not be created");
    }).then(function () { pdfBusy = false; });
  }
  document.getElementById("invitePdfAllBtn").addEventListener("click", function () {
    var list = shownIds.map(function (id) { return guests.find(function (x) { return x.id === id; }); }).filter(Boolean);
    if (!list.length) { showToast("No guests shown — clear the filters first"); return; }
    if (list.length === 1) { invitationPdfs(list); return; }
    askConfirm("Download " + list.length + " invitations?", "One A5 PDF with a page for each guest shown (about " + Math.max(1, Math.round(list.length * 0.06)) + " MB). Use the search and filters first to download fewer.").then(function (ok) { if (ok) invitationPdfs(list); });
  });

  /* ---------------- LOG CONTACT ---------------- */
  var contactGuest = null;
  function openContactModal(g) {
    contactGuest = g;
    document.getElementById("contactModalTitle").textContent = "Log Contact — " + fullName(g);
    document.getElementById("c-date").value = new Date().toISOString().slice(0, 10);
    document.getElementById("c-note").value = "";
    document.getElementById("c-sent").checked = !g.inviteSentAt;
    document.getElementById("contactHistory").innerHTML = (g.contacts || []).slice().reverse().map(function (c) {
      return "<div><strong>" + escapeHtml(c.channel) + "</strong> · " + escapeHtml(fmtDate(c.at)) + (c.by ? " <small>by " + escapeHtml(c.by) + "</small>" : "") + (c.note ? "<br>" + escapeHtml(c.note) : "") + "</div>";
    }).join("") || '<p class="mix-note">No contact logged yet.</p>';
    document.getElementById("contactModalOverlay").hidden = false;
  }
  function closeContact() { document.getElementById("contactModalOverlay").hidden = true; contactGuest = null; }
  document.getElementById("contactModalClose").addEventListener("click", closeContact);
  document.getElementById("contactModalCancel").addEventListener("click", closeContact);
  document.getElementById("contactModalSave").addEventListener("click", function () {
    if (!contactGuest) return;
    var g = contactGuest;
    api("/api/admin/guests", { method: "POST", body: { action: "logContact", guestId: g.id, channel: document.getElementById("c-channel").value, at: document.getElementById("c-date").value, note: document.getElementById("c-note").value, invitationSent: document.getElementById("c-sent").checked } })
      .then(function () { showToast("Contact logged for " + fullName(g)); closeContact(); return loadAll(); })
      .catch(function (e) { showToast(e.message || "Could not save"); });
  });

  /* ---------------- PORTAL USERS (owners) ---------------- */
  var USER_STATUS = { active: ["Active", "pill-status-green"], invited: ["Invited", "pill-status-amber"], deactivated: ["Deactivated", "pill-status-red"] };
  function renderUsers() {
    api("/api/admin/session?users=1").then(function (res) {
      var mine = res.me || {};
      var mainRow = '<tr><td><div class="g-name">Main login</div><div class="g-sub">The shared portal password</div></td><td>owner</td><td><span class="pill pill-status-green">Active</span></td><td>—</td><td></td></tr>';
      document.getElementById("userRows").innerHTML = mainRow + res.users.map(function (u) {
        var st = USER_STATUS[u.status] || [u.status, "pill-status-neutral"], self = u.id === mine.id;
        if (u.resetRequestedAt && u.status !== "deactivated") st = ["Reset requested", "pill-status-amber"];
        var roleCell = self ? escapeHtml(u.role) + " (you)" : '<select class="user-role" data-id="' + u.id + '" style="border:1px solid var(--border); border-radius:6px; padding:6px 8px; font-family:inherit; font-size:.78rem;">' + ["owner", "planner", "viewer"].map(function (rl) { return '<option value="' + rl + '"' + (u.role === rl ? " selected" : "") + ">" + rl + "</option>"; }).join("") + "</select>";
        var acts = self ? "" : '<div class="row-actions">' +
          (u.status !== "deactivated" ? '<button class="btn btn-outline btn-sm" data-ulink="' + u.id + '">' + (u.status === "invited" ? "Invitation link" : "Password reset link") + "</button>" : "") +
          '<button class="btn btn-outline btn-sm" data-uactive="' + u.id + '" data-on="' + (u.status === "deactivated" ? "1" : "0") + '">' + (u.status === "deactivated" ? "Reactivate" : "Deactivate") + "</button>" +
          '<button class="btn btn-danger btn-sm" data-uremove="' + u.id + '">Remove</button></div>';
        return '<tr><td><div class="g-name">' + escapeHtml(u.name) + '</div><div class="g-sub">' + escapeHtml(u.email) + "</div></td><td>" + roleCell + '</td><td><span class="pill ' + st[1] + '">' + st[0] + "</span></td><td>" + (u.lastLoginAt ? escapeHtml(new Date(u.lastLoginAt).toLocaleString(undefined, { day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" })) : "—") + "</td><td>" + acts + "</td></tr>";
      }).join("");
    }).catch(function (e) { showToast(e.message || "Could not load portal users"); });
  }
  function renderBackups() {
    api("/api/admin/session?backups=1").then(function (res) {
      document.getElementById("backupRows").innerHTML = res.backups.length ? res.backups.map(function (b) {
        var name = b.pathname.split("/").pop().replace(/\.json$/, "");
        var when = new Date(b.uploadedAt).toLocaleString(undefined, { day: "numeric", month: "short", year: "numeric", hour: "2-digit", minute: "2-digit" });
        return '<tr><td><div class="g-name">' + escapeHtml(when) + '</div><div class="g-sub">' + escapeHtml(name) + "</div></td><td>" + Math.round(b.size / 1024) + ' KB</td><td><button class="btn btn-outline btn-sm" data-restore="' + escapeHtml(b.pathname) + '">Restore</button></td></tr>';
      }).join("") : '<tr><td colspan="3" style="color:var(--text-muted);">No backups yet.</td></tr>';
    }).catch(function () {});
  }
  document.getElementById("backupNowBtn").addEventListener("click", function () {
    api("/api/admin/session", { method: "POST", body: { action: "backup", label: "manual" } }).then(function (r) { showToast("Backed up " + r.guests + " invitations"); renderBackups(); }).catch(function (e) { showToast(e.message || "Backup failed"); });
  });
  document.getElementById("backupRows").addEventListener("click", function (e) {
    var b = e.target.closest("[data-restore]"); if (!b) return;
    askConfirm("Restore this backup?", "The guest list, RSVPs, tables, gifts, providers and users go back to how they were then. A backup of the current state is taken first, so this can be undone.").then(function (ok) {
      if (!ok) return;
      api("/api/admin/session", { method: "POST", body: { action: "restore", pathname: b.dataset.restore } }).then(function (r) { showToast("Restored (" + r.guests + " invitations)"); renderBackups(); return loadAll(); }).catch(function (e2) { showToast(e2.message || "Restore failed"); });
    });
  });
  function userAction(body, msg) {
    return api("/api/admin/session", { method: "POST", body: body }).then(function (res) { if (msg) showToast(msg); renderUsers(); return res; }).catch(function (e) { showToast(e.message || "Could not update"); });
  }
  function showLink(name, token, reset) {
    var url = location.origin + "/admin/login.html?invite=" + encodeURIComponent(token);
    document.getElementById("linkModalTitle").textContent = reset ? "Password Reset Link" : "Invitation Link";
    document.getElementById("linkModalSub").textContent = "Send this to " + name + ". It works once and expires in " + (reset ? "2" : "7") + " days.";
    document.getElementById("linkModalUrl").value = url;
    document.getElementById("linkModalWa").href = "https://wa.me/?text=" + encodeURIComponent("Hi " + name.split(" ")[0] + ", here is your link to the Nyasha & Watson wedding portal" + (reset ? " to set a new password" : " — choose your password to get started") + ": " + url);
    document.getElementById("linkModalOverlay").hidden = false;
  }
  document.getElementById("linkModalClose").addEventListener("click", function () { document.getElementById("linkModalOverlay").hidden = true; });
  document.getElementById("linkModalCopy").addEventListener("click", function () {
    var v = document.getElementById("linkModalUrl").value;
    (navigator.clipboard ? navigator.clipboard.writeText(v) : Promise.reject()).then(function () { showToast("Link copied"); }).catch(function () { document.getElementById("linkModalUrl").select(); });
  });
  document.getElementById("userRows").addEventListener("change", function (e) {
    var s = e.target.closest(".user-role"); if (s) userAction({ action: "update", id: s.dataset.id, role: s.value }, "Role updated");
  });
  document.getElementById("userRows").addEventListener("click", function (e) {
    var b = e.target.closest("button"); if (!b) return;
    var row = b.closest("tr"), name = row.querySelector(".g-name").textContent;
    if (b.dataset.ulink) userAction({ action: "link", id: b.dataset.ulink }).then(function (res) { if (res) showLink(name, res.token, res.reset); });
    if (b.dataset.uactive) userAction({ action: "update", id: b.dataset.uactive, active: b.dataset.on === "1" }, b.dataset.on === "1" ? name + " reactivated" : name + " deactivated — signed out everywhere");
    if (b.dataset.uremove) askConfirm("Remove " + name + "?", "They lose access straight away.").then(function (ok) { if (ok) userAction({ action: "remove", id: b.dataset.uremove }, name + " removed"); });
  });
  function closeUserModal() { document.getElementById("userModalOverlay").hidden = true; }
  document.getElementById("inviteUserBtn").addEventListener("click", function () {
    document.getElementById("u-name").value = ""; document.getElementById("u-email").value = ""; document.getElementById("u-role").value = "planner";
    document.getElementById("userModalOverlay").hidden = false; document.getElementById("u-name").focus();
  });
  document.getElementById("userModalClose").addEventListener("click", closeUserModal);
  document.getElementById("userModalCancel").addEventListener("click", closeUserModal);
  document.getElementById("userModalSave").addEventListener("click", function () {
    var name = document.getElementById("u-name").value.trim();
    userAction({ action: "invite", name: name, email: document.getElementById("u-email").value.trim(), role: document.getElementById("u-role").value }).then(function (res) {
      if (res && res.token) { closeUserModal(); showLink(name, res.token, false); }
    });
  });
  document.getElementById("filterReview").addEventListener("change", renderGuestTable);
  document.getElementById("filterDelivery").addEventListener("change", renderGuestTable);
  document.getElementById("filterPhone").addEventListener("change", renderGuestTable);
  document.getElementById("dashManageGuests").addEventListener("click", function () { activateTab("guests"); });

  document.getElementById("guestRows").addEventListener("click", function (e) {
    var btn = e.target.closest(".icon-btn");
    if (!btn) return;
    var id = btn.dataset.id, action = btn.dataset.action;
    var g = guests.find(function (x) { return x.id === id; }) || removedGuests.find(function (x) { return x.id === id; });
    if (!g) return;
    if (action === "edit") openGuestModal(g);
    else if (action === "contact") openContactModal(g);
    else if (action === "restore") api("/api/admin/guests?id=" + g.id, { method: "PATCH", body: { removedAt: null } }).then(function () { showToast(fullName(g) + " is back on the guest list"); return loadAll(); });
    else if (action === "purge") askConfirm("Delete " + fullName(g) + " permanently?", "This can't be undone. Their RSVP and history are deleted too.").then(function (ok) {
      if (ok) api("/api/admin/guests?id=" + g.id, { method: "DELETE" }).then(function () { showToast("Deleted permanently"); return loadAll(); });
    });
    else if (action === "link") copyInviteLink(g);
    else if (action === "invite") sendInvite(g);
    else if (action === "badge") openBadgeModal(g);
    else if (action === "invitepdf") invitationPdfs([g]);
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
    // record it as sent (delivery tracking) the first time
    if (!g.inviteSentAt) api("/api/admin/guests?id=" + g.id, { method: "PATCH", body: { inviteSentAt: new Date().toISOString() } }).then(function (res) { g.inviteSentAt = res.guest.inviteSentAt; renderDashboard(); renderGuestTable(); }).catch(function () {});
  }

  function toggleCheckin(g) {
    var next = !g.checkedIn;
    api("/api/admin/guests?id=" + g.id, { method: "PATCH", body: { checkedIn: next, checkInTime: next ? new Date().toISOString() : null, checkInMethod: next ? "usher" : "" } })
      .then(function () { showToast(next ? fullName(g) + " checked in" : "Check-in undone"); return loadAll(); })
      .catch(function () { showToast("Could not update check-in"); });
  }
  function deleteGuest(g) {
    askConfirm("Remove " + fullName(g) + "?", "They move to Removed (tick Removed above the list to see them), give up their table, and their invitation link stops working. You can restore them any time.").then(function (ok) {
      if (!ok) return;
      api("/api/admin/guests?id=" + g.id, { method: "PATCH", body: { removedAt: new Date().toISOString() } }).then(function () { showToast(fullName(g) + " removed — restore from Removed"); return loadAll(); }).catch(function () { showToast("Could not remove guest"); });
    });
  }

  /* ---------------- RSVP APPROVALS ---------------- */
  // RSVPs from the general link that didn't match anyone on the invite list.
  // The guest was told "pending approval"; approving adds (or links) them to the
  // invite list with their RSVP already recorded. Decisions are kept on record.
  var REQ_STATUS = { pending: "Pending approval", approved: "Approved", declined: "Declined" };
  function reqName(r) { return ((r.firstName || "") + " " + (r.lastName || "")).trim() || "(no name)"; }
  function reqResponse(r) {
    if (r.attend === "attending") return "Attending · party of " + (r.guests || 1);
    if (r.attend === "maybe") return "Not sure yet";
    if (r.attend === "not_attending") return "Declining";
    return "—";
  }
  function renderApprovals() {
    var pending = requests.filter(function (r) { return r.status === "pending"; }).length;
    var badge = document.getElementById("approvalCount");
    badge.hidden = !pending;
    badge.textContent = pending;
    document.getElementById("approvalOption").textContent = "Approvals" + (pending ? " (" + pending + ")" : "");

    var fStatus = document.getElementById("reqFilter").value;
    var q = (document.getElementById("reqSearch").value || "").toLowerCase();
    var rows = requests.filter(function (r) {
      if (fStatus && r.status !== fStatus) return false;
      if (q && (reqName(r) + " " + (r.phone || "")).toLowerCase().indexOf(q) === -1) return false;
      return true;
    });
    var empty = document.getElementById("reqEmpty");
    empty.hidden = rows.length !== 0;
    document.getElementById("reqEmptyTitle").textContent = fStatus === "pending" ? "Nothing waiting for approval" : "No requests here";
    var byId = {};
    guests.forEach(function (g) { byId[g.id] = g; });
    document.getElementById("reqRows").innerHTML = rows.map(function (r) {
      var meta = [WNPhone.formatPhone(r.phone), FG.genderLabel(r.gender)].filter(Boolean).join(" · ");
      var linked = r.guestId && byId[r.guestId] ? "On invite list as " + fullName(byId[r.guestId]) : "";
      var actions;
      if (r.status === "pending") actions = '<button class="btn btn-primary btn-sm" data-req-action="approve" data-id="' + r.id + '">Approve</button> <button class="btn btn-outline btn-sm" data-req-action="decline" data-id="' + r.id + '">Decline</button>';
      else if (r.status === "declined") actions = '<button class="btn btn-outline btn-sm" data-req-action="reopen" data-id="' + r.id + '">Reopen</button>';
      else actions = r.guestId && byId[r.guestId] ? '<button class="btn btn-outline btn-sm" data-req-action="invite" data-id="' + r.id + '">Send invite link</button>' : "";
      return "<tr>" +
        '<td><div class="g-name">' + escapeHtml(reqName(r)) + '</div><div class="g-sub">' + escapeHtml(meta) + "</div>" + (linked ? '<div class="g-meta">' + escapeHtml(linked) + "</div>" : "") + "</td>" +
        "<td>" + escapeHtml(reqResponse(r)) + (r.plusOneName ? '<div class="g-sub">With ' + escapeHtml(r.plusOneName) + "</div>" : "") + "</td>" +
        '<td><div class="req-msg">' + escapeHtml(r.message || "—") + "</div></td>" +
        "<td>" + fmtDate(r.updatedAt || r.createdAt) + '<div class="g-sub">via ' + escapeHtml(CHANNELS[r.channel] || "website") + "</div></td>" +
        '<td><span class="pill pill-req-' + r.status + '">' + (REQ_STATUS[r.status] || r.status) + "</span>" + (r.decidedAt ? '<div class="g-sub">' + fmtDate(r.decidedAt) + "</div>" : "") + "</td>" +
        '<td><div class="row-actions">' + actions + "</div></td>" +
        "</tr>";
    }).join("");
  }
  document.getElementById("reqFilter").addEventListener("change", renderApprovals);
  document.getElementById("reqSearch").addEventListener("input", renderApprovals);

  function requestAction(body, okMsg) {
    return api("/api/admin/guests", { method: "POST", body: body })
      .then(function () { showToast(okMsg); return loadAll(); })
      .catch(function (e) { showToast(e.message || "Could not update the request"); });
  }
  document.getElementById("reqRows").addEventListener("click", function (e) {
    var btn = e.target.closest("[data-req-action]");
    if (!btn) return;
    var r = requests.find(function (x) { return x.id === btn.dataset.id; });
    if (!r) return;
    var action = btn.dataset.reqAction;
    if (action === "approve") openApproveModal(r);
    else if (action === "decline") {
      askConfirm("Decline " + reqName(r) + "?", "They'll stay off the invite list. You can reopen this later if you change your mind.").then(function (ok) {
        if (ok) requestAction({ action: "decline", requestId: r.id }, "Request declined");
      });
    } else if (action === "reopen") requestAction({ action: "reopen", requestId: r.id }, "Request reopened");
    else if (action === "invite") {
      var g = guests.find(function (x) { return x.id === r.guestId; });
      if (g) sendInvite(g);
    }
  });

  var approvingRequest = null;
  function nameTokens(s) { return String(s || "").toLowerCase().split(/\s+/).filter(Boolean); }
  function openApproveModal(r) {
    approvingRequest = r;
    document.getElementById("approveModalSub").textContent = reqName(r) + " — " + reqResponse(r) + (r.phone ? " · " + WNPhone.formatPhone(r.phone) : "");
    document.getElementById("approve-invitedfor").innerHTML = '<option value="">—</option>' + categories.map(function (c) { return '<option value="' + escapeHtml(c) + '">' + escapeHtml(c) + "</option>"; }).join("");
    // suggest the most likely existing invite: shared surname or first name
    var mine = nameTokens(reqName(r));
    var sorted = guests.slice().sort(function (a, b) { return fullName(a).localeCompare(fullName(b)); });
    var suggestion = sorted.find(function (g) { return nameTokens(fullName(g)).some(function (t) { return mine.indexOf(t) !== -1; }); });
    document.getElementById("approve-guest").innerHTML = '<option value="">Choose an invite…</option>' + sorted.map(function (g) {
      return '<option value="' + g.id + '"' + (suggestion && suggestion.id === g.id ? " selected" : "") + ">" + escapeHtml(fullName(g)) + (g.phone ? " · " + escapeHtml(WNPhone.formatPhone(g.phone)) : "") + "</option>";
    }).join("");
    document.querySelector('input[name="approve-mode"][value="new"]').checked = true;
    syncApproveMode();
    document.getElementById("approveModalOverlay").hidden = false;
  }
  function syncApproveMode() {
    var mode = document.querySelector('input[name="approve-mode"]:checked').value;
    document.getElementById("approveNewFields").hidden = mode !== "new";
    document.getElementById("approveLinkFields").hidden = mode !== "link";
  }
  document.querySelectorAll('input[name="approve-mode"]').forEach(function (el) { el.addEventListener("change", syncApproveMode); });
  function closeApproveModal() { document.getElementById("approveModalOverlay").hidden = true; approvingRequest = null; }
  document.getElementById("approveModalClose").addEventListener("click", closeApproveModal);
  document.getElementById("approveModalCancel").addEventListener("click", closeApproveModal);
  document.getElementById("approveModalSave").addEventListener("click", function () {
    if (!approvingRequest) return;
    var mode = document.querySelector('input[name="approve-mode"]:checked').value;
    var body = { action: "approve", requestId: approvingRequest.id, mode: mode };
    if (mode === "link") {
      body.guestId = document.getElementById("approve-guest").value;
      if (!body.guestId) { showToast("Choose the invite to link this RSVP to"); return; }
    } else body.invitedFor = document.getElementById("approve-invitedfor").value;
    var name = reqName(approvingRequest);
    closeApproveModal();
    requestAction(body, name + " approved and added to the invite list");
  });

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
    document.getElementById("f-invited").value = g ? (g.invitedCount || 1) : 1;
    document.getElementById("f-rsvp").value = g ? (g.rsvpStatus || "pending") : "pending";
    document.getElementById("f-attending").value = g ? (g.attendingCount || 0) : 0;
    document.getElementById("f-plusone").checked = g ? !!g.plusOneAllowed : false;
    document.getElementById("f-notes").value = g ? (g.notes || "") : "";
    document.getElementById("f-review").value = g ? (g.reviewFlag || "") : "";
    document.getElementById("f-sent").checked = g ? !!(g.inviteSentAt || g.openedAt) : false;
    var curTable = g ? (g.tableId || "") : "";
    document.getElementById("f-table").innerHTML = '<option value="">Not seated</option>' + tables.map(function (tb) {
      var left = seatsLeft(tb, g ? g.id : null);
      return '<option value="' + tb.id + '"' + (tb.id === curTable ? " selected" : "") + ">" + escapeHtml(tb.name) + " · " + Math.max(0, left) + " seat" + (left === 1 ? "" : "s") + " free</option>";
    }).join("");
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
      invitedCount: Number(document.getElementById("f-invited").value) || 1,
      rsvpStatus: document.getElementById("f-rsvp").value,
      attendingCount: Number(document.getElementById("f-attending").value) || 0,
      plusOneAllowed: document.getElementById("f-plusone").checked,
      notes: document.getElementById("f-notes").value.trim(),
      reviewFlag: document.getElementById("f-review").value.trim(),
      tableId: document.getElementById("f-table").value || null
    };
    var wasSent = editingGuestId ? !!(guests.find(function (x) { return x.id === editingGuestId; }) || {}).inviteSentAt : false;
    var nowSent = document.getElementById("f-sent").checked;
    if (nowSent && !wasSent) data.inviteSentAt = new Date().toISOString();
    if (!nowSent) data.inviteSentAt = null;
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
      ctx.fillText("NYASHA & WATSON", w / 2, 90);
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
      if (tableName(g) && g.rsvpStatus !== "not_attending") { ctx.fillStyle = "#3E1730"; ctx.font = '600 30px "Cormorant Garamond", serif'; ctx.fillText(tableName(g), w / 2, 414); }
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
    // shared category list; a custom category saved earlier stays selectable
    var cat = p ? (p.category || "") : "";
    var cats = FG.PROVIDER_CATEGORIES.slice();
    if (cat && cats.indexOf(cat) === -1) cats.unshift(cat);
    document.getElementById("prov-category").innerHTML = '<option value="">Choose a category…</option>' + cats.map(function (c) { return '<option value="' + escapeHtml(c) + '">' + escapeHtml(c) + "</option>"; }).join("");
    document.getElementById("prov-category").value = cat;
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
      category: document.getElementById("prov-category").value,
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

  /* ---------------- TABLES & SEATING ---------------- */
  function tableState(tb) { var used = seatsUsed(tb.id); return { used: used, over: used > tb.capacity, full: used === tb.capacity, empty: used === 0 }; }
  function renderTables() {
    var q = (document.getElementById("tableSearch").value || "").toLowerCase();
    var fl = document.getElementById("tableFilter").value;
    var totalSeats = tables.reduce(function (s, tb) { return s + (Number(tb.capacity) || 0); }, 0);
    var seatedPeople = guests.reduce(function (s, g) { return tableById(g.tableId) ? s + seatsFor(g) : s; }, 0);
    var unseated = guests.filter(function (g) { return !tableById(g.tableId) && seatsFor(g) > 0; });
    var unseatedPeople = unseated.reduce(function (s, g) { return s + seatsFor(g); }, 0);
    var overCount = tables.filter(function (tb) { return tableState(tb).over; }).length;
    document.getElementById("tableStatGrid").innerHTML = [
      stat("Tables", tables.length, totalSeats + " seats in total"),
      stat("Seats Allocated", seatedPeople, Math.max(0, totalSeats - seatedPeople) + " seats still free"),
      stat("Not Seated Yet", unseatedPeople, unseated.length + " invitations (declined guests excluded)", unseatedPeople > 0),
      stat("Over Capacity", overCount, overCount ? "tables need guests moved" : "every table within its seats", overCount > 0)
    ].join("");

    var list = tables.filter(function (tb) {
      var st = tableState(tb);
      if (fl === "space" && st.used >= tb.capacity) return false;
      if (fl === "full" && !st.full) return false;
      if (fl === "over" && !st.over) return false;
      if (fl === "empty" && !st.empty) return false;
      if (q) {
        var hay = (tb.name + " " + (tb.notes || "") + " " + guests.filter(function (g) { return g.tableId === tb.id; }).map(fullName).join(" ")).toLowerCase();
        if (hay.indexOf(q) === -1) return false;
      }
      return true;
    });
    document.getElementById("tablesEmpty").hidden = tables.length !== 0;
    document.getElementById("tablesGrid").innerHTML = list.map(function (tb) {
      var st = tableState(tb), seated = guests.filter(function (g) { return g.tableId === tb.id; }).sort(function (a, b) { return fullName(a).localeCompare(fullName(b)); });
      var pct = Math.min(100, Math.round(st.used / Math.max(1, tb.capacity) * 100));
      var declined = seated.filter(function (g) { return g.rsvpStatus === "not_attending"; }).length;
      return '<button type="button" class="table-card' + (st.over ? " over" : st.full ? " full" : "") + '" data-table="' + tb.id + '">' +
        '<div class="tc-head"><h4 class="tc-name">' + escapeHtml(tb.name) + '</h4><span class="tc-count">' + st.used + " / " + tb.capacity + " seats</span></div>" +
        '<div class="bar-track tc-bar"><div class="bar-fill" style="width:' + pct + '%"></div></div>' +
        (seated.length ? '<div class="tc-guests">' + seated.map(function (g) { return '<div class="tc-guest"><span>' + escapeHtml(fullName(g)) + "</span><span>" + (g.rsvpStatus === "not_attending" ? "declined" : seatsFor(g)) + "</span></div>"; }).join("") + "</div>" : '<div class="tc-meta">No one seated yet</div>') +
        (tb.notes ? '<div class="tc-meta">' + escapeHtml(tb.notes) + "</div>" : "") +
        (st.over ? '<div class="tc-warn">Over capacity by ' + (st.used - tb.capacity) + " — move someone</div>" : "") +
        (declined ? '<div class="tc-meta">' + declined + " declined guest(s) still listed here (they don't use a seat)</div>" : "") +
        "</button>";
    }).join("");

    document.getElementById("unseatedPanel").hidden = !guests.length;
    document.getElementById("unseatedNote").textContent = unseated.length ? unseated.length + " invitations (" + unseatedPeople + " people) still need a table. Pick one to seat them." : "Everyone who is expected has a table.";
    document.getElementById("unseatedRows").innerHTML = unseated.sort(function (a, b) { return fullName(a).localeCompare(fullName(b)); }).map(function (g) {
      var need = seatsFor(g);
      var opts = tables.map(function (tb) { var left = seatsLeft(tb); return '<option value="' + tb.id + '"' + (left < need ? " disabled" : "") + ">" + escapeHtml(tb.name) + " · " + Math.max(0, left) + " free</option>"; }).join("");
      return "<tr><td><div class=\"g-name\">" + escapeHtml(fullName(g)) + '</div><div class="g-sub">' + escapeHtml([g.familyName, g.invitedFor].filter(Boolean).join(" · ")) + "</div></td>" +
        '<td><span class="pill pill-' + (g.rsvpStatus || "pending") + '">' + (g.rsvpStatus || "pending").replace("_", " ") + "</span></td><td>" + need + "</td>" +
        '<td><select class="seat-select" data-guest="' + g.id + '" style="border:1px solid var(--border); border-radius:6px; padding:6px 8px; font-family:inherit; font-size:.78rem;"' + (tables.length ? "" : " disabled") + '><option value="">' + (tables.length ? "Choose a table…" : "Add tables first") + "</option>" + opts + "</select></td></tr>";
    }).join("");
  }
  function seatGuest(guestId, tableId) {
    return api("/api/admin/tables?id=" + encodeURIComponent(tableId), { method: "PATCH", body: { action: "assign", guestId: guestId } });
  }
  document.getElementById("tableSearch").addEventListener("input", renderTables);
  document.getElementById("tableFilter").addEventListener("change", renderTables);
  document.getElementById("tablesGrid").addEventListener("click", function (e) {
    var card = e.target.closest(".table-card"); if (card) openTableModal(tableById(card.dataset.table));
  });
  document.getElementById("unseatedRows").addEventListener("change", function (e) {
    var sel = e.target.closest(".seat-select"); if (!sel || !sel.value) return;
    var g = guests.find(function (x) { return x.id === sel.dataset.guest; }), tb = tableById(sel.value);
    sel.disabled = true;
    seatGuest(sel.dataset.guest, sel.value).then(function () { showToast(fullName(g) + " seated at " + tb.name); return loadAll(); })
      .catch(function (err) { sel.disabled = false; sel.value = ""; showToast(err.message || "Could not seat this guest"); });
  });

  var editingTableId = null;
  function openTableModal(tb) {
    editingTableId = tb ? tb.id : null;
    document.getElementById("tableModalTitle").textContent = tb ? tb.name : "Add Table";
    document.getElementById("tableModalSub").textContent = tb ? "Change the seats, or seat and move guests." : "Name or number the table and set its seats.";
    document.getElementById("t-name").value = tb ? tb.name : "";
    document.getElementById("t-capacity").value = tb ? tb.capacity : 10;
    document.getElementById("t-notes").value = tb ? (tb.notes || "") : "";
    document.getElementById("tSeatWrap").hidden = !tb;
    document.getElementById("tableModalDelete").hidden = !tb;
    if (tb) renderTableSeating(tb);
    document.getElementById("tableModalOverlay").hidden = false;
  }
  function renderTableSeating(tb) {
    var seated = guests.filter(function (g) { return g.tableId === tb.id; }).sort(function (a, b) { return fullName(a).localeCompare(fullName(b)); });
    document.getElementById("tSeatedCount").textContent = seatsUsed(tb.id);
    document.getElementById("tCapCount").textContent = tb.capacity;
    document.getElementById("tSeatedList").innerHTML = seated.length ? seated.map(function (g) {
      return '<div class="seated-row"><span>' + escapeHtml(fullName(g)) + " <small>· " + (g.rsvpStatus === "not_attending" ? "declined" : seatsFor(g) + " seat" + (seatsFor(g) === 1 ? "" : "s")) + " · " + escapeHtml(String(g.rsvpStatus || "pending").replace("_", " ")) + '</small></span><button class="btn btn-outline btn-sm" type="button" data-unseat="' + g.id + '">Remove</button></div>';
    }).join("") : '<p class="mix-note">No one seated here yet.</p>';
    var left = seatsLeft(tb);
    var candidates = guests.filter(function (g) { return g.tableId !== tb.id && seatsFor(g) > 0; }).sort(function (a, b) { return (tableById(a.tableId) ? 1 : 0) - (tableById(b.tableId) ? 1 : 0) || fullName(a).localeCompare(fullName(b)); });
    document.getElementById("t-assignSelect").innerHTML = '<option value="">Choose a guest… (' + Math.max(0, left) + " seats free)</option>" + candidates.map(function (g) {
      var need = seatsFor(g), from = tableName(g);
      return '<option value="' + g.id + '"' + (need > left ? " disabled" : "") + ">" + escapeHtml(fullName(g)) + " · " + need + (from ? " · move from " + escapeHtml(from) : "") + "</option>";
    }).join("");
  }
  function closeTableModal() { document.getElementById("tableModalOverlay").hidden = true; editingTableId = null; }
  document.getElementById("addTableBtn").addEventListener("click", function () { openTableModal(null); });
  document.getElementById("tableModalClose").addEventListener("click", closeTableModal);
  document.getElementById("tableModalCancel").addEventListener("click", closeTableModal);
  document.getElementById("tableModalSave").addEventListener("click", function () {
    var body = { name: document.getElementById("t-name").value.trim(), capacity: Number(document.getElementById("t-capacity").value) || 10, notes: document.getElementById("t-notes").value.trim() };
    if (!body.name) { document.getElementById("t-name").focus(); return; }
    var req = editingTableId ? api("/api/admin/tables?id=" + editingTableId, { method: "PATCH", body: body }) : api("/api/admin/tables", { method: "POST", body: body });
    req.then(function () { showToast(editingTableId ? "Table saved" : "Table added"); closeTableModal(); return loadAll(); })
      .catch(function (e) { showToast(e.message || "Could not save table"); });
  });
  document.getElementById("tableModalDelete").addEventListener("click", function () {
    var tb = tableById(editingTableId); if (!tb) return;
    askConfirm("Delete " + tb.name + "?", "Its guests stay on the guest list and become unseated.").then(function (ok) {
      if (!ok) return;
      api("/api/admin/tables?id=" + tb.id, { method: "DELETE" }).then(function () { showToast(tb.name + " deleted"); closeTableModal(); return loadAll(); });
    });
  });
  document.getElementById("t-assignBtn").addEventListener("click", function () {
    var gid = document.getElementById("t-assignSelect").value, tb = tableById(editingTableId);
    if (!gid || !tb) return;
    var g = guests.find(function (x) { return x.id === gid; });
    seatGuest(gid, tb.id).then(function () { showToast(fullName(g) + " seated at " + tb.name); return loadAll(); })
      .then(function () { var fresh = tableById(editingTableId); if (fresh) renderTableSeating(fresh); })
      .catch(function (e) { showToast(e.message || "Could not seat this guest"); });
  });
  document.getElementById("tSeatedList").addEventListener("click", function (e) {
    var b = e.target.closest("[data-unseat]"); if (!b) return;
    var tb = tableById(editingTableId), g = guests.find(function (x) { return x.id === b.dataset.unseat; });
    api("/api/admin/tables?id=" + tb.id, { method: "PATCH", body: { action: "unassign", guestId: g.id } })
      .then(function () { showToast(fullName(g) + " removed from " + tb.name); return loadAll(); })
      .then(function () { var fresh = tableById(editingTableId); if (fresh) renderTableSeating(fresh); });
  });
  function closeBulk() { document.getElementById("bulkTablesOverlay").hidden = true; }
  document.getElementById("bulkTablesBtn").addEventListener("click", function () {
    var nums = tables.map(function (tb) { var m = String(tb.name).match(/^Table (\d+)$/); return m ? Number(m[1]) : 0; });
    document.getElementById("b-start").value = Math.max.apply(null, nums.concat([0])) + 1;
    document.getElementById("bulkTablesOverlay").hidden = false;
  });
  document.getElementById("bulkTablesClose").addEventListener("click", closeBulk);
  document.getElementById("bulkTablesCancel").addEventListener("click", closeBulk);
  document.getElementById("bulkTablesSave").addEventListener("click", function () {
    var body = { action: "bulk", count: Number(document.getElementById("b-count").value) || 1, capacity: Number(document.getElementById("b-capacity").value) || 10, start: Number(document.getElementById("b-start").value) || 1 };
    api("/api/admin/tables", { method: "POST", body: body }).then(function (res) {
      showToast(res.added + " tables added" + (res.skipped.length ? " (" + res.skipped.length + " already existed)" : ""));
      closeBulk(); return loadAll();
    }).catch(function (e) { showToast(e.message || "Could not add tables"); });
  });

  /* ---------------- CSV IMPORT (generic engine, reused for guests/gifts/providers) ---------------- */
  function importOpt(r, value, label) {
    return "<option value=\"" + value + "\"" + (r.resolution === value ? " selected" : "") + ">" + label + "</option>";
  }

  // Excel uploads: the SheetJS reader is loaded only when an Excel file is picked,
  // then the "Guests" sheet (or the first sheet) becomes CSV for the same import.
  // Title rows above the header are skipped: the header is the first row with 3+ filled cells.
  var xlsxLoader = null;
  function loadXlsx() {
    if (window.XLSX) return Promise.resolve(window.XLSX);
    if (!xlsxLoader) xlsxLoader = new Promise(function (resolve, reject) {
      var s = document.createElement("script");
      s.src = "/assets/js/xlsx.mini.min.js";
      s.onload = function () { resolve(window.XLSX); };
      s.onerror = function () { xlsxLoader = null; reject(new Error("Could not load the Excel reader — please try again")); };
      document.head.appendChild(s);
    });
    return xlsxLoader;
  }
  function csvCell(v) {
    var s = String(v == null ? "" : v);
    return /[",\n\r]/.test(s) ? '"' + s.replace(/"/g, '""') + '"' : s;
  }
  function excelToCsv(file) {
    return Promise.all([loadXlsx(), file.arrayBuffer()]).then(function (res) {
      var XLSX = res[0];
      var wb = XLSX.read(res[1], { type: "array" });
      var sheetName = wb.SheetNames.find(function (n) { return /^(guests?|gifts?|providers?)$/i.test(n.trim()); }) || wb.SheetNames.find(function (n) { return !/^(instructions|lists)$/i.test(n.trim()); }) || wb.SheetNames[0];
      var rows = XLSX.utils.sheet_to_json(wb.Sheets[sheetName], { header: 1, raw: false, defval: "", blankrows: false });
      var filled = function (r) { return r.filter(function (c) { return String(c).trim() !== ""; }).length; };
      var start = rows.findIndex(function (r) { return filled(r) >= 3; });
      if (start === -1) throw new Error("That sheet looks empty — fill in the Guests tab and try again");
      return rows.slice(start).filter(function (r) { return filled(r) > 0; })
        .map(function (r) { return r.map(csvCell).join(","); }).join("\n");
    });
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
      var isExcel = /\.(xlsx|xlsm|xls)$/i.test(file.name || "");
      (isExcel ? excelToCsv(file) : file.text()).then(function (csv) {
        return api(cfg.endpoint, { method: "POST", body: { csv: csv } });
      }).then(function (res) { showPreview(res); })
        .catch(function (e) { showToast(e.message || "Could not read that file"); });
    }

    function showPreview(res) {
      rows = res.rows.map(function (r) { return Object.assign({}, r, { resolution: r.duplicate ? (cfg.duplicateDefault || "skip") : "create" }); });
      if (cfg.onPreview) cfg.onPreview(res);
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
      api(cfg.endpoint, { method: "POST", body: Object.assign({ mode: "commit", rows: payloadRows }, cfg.commitExtra ? cfg.commitExtra() : {}) })
        .then(function (res) {
          showToast(cfg.resultText(res));
          document.getElementById(cfg.overlayId).hidden = true;
          if (cfg.afterCommit) cfg.afterCommit(res);
          return loadAll();
        }).catch(function (e) { showToast(e.message || "Import failed"); });
    });
  }

  setupCsvImport({
    openBtnId: "importGuestsBtn", overlayId: "importModalOverlay", closeId: "importModalClose", cancelId: "importCancelBtn",
    dropzoneId: "importDropzone", fileInputId: "importFileInput", previewWrapId: "importPreviewWrap", summaryId: "importSummary",
    rowsId: "importRows", commitBtnId: "importCommitBtn", endpoint: "/api/admin/guests-import",
    // a guest already on the list is updated by default — their RSVP, check-in and table are kept
    duplicateDefault: "update",
    onPreview: function (res) {
      document.getElementById("importNotInFile").textContent = res.notInFile || 0;
      document.getElementById("importFlagMissing").checked = false;
      document.getElementById("importFlagWrap").hidden = !res.notInFile;
    },
    commitExtra: function () { return { flagMissing: document.getElementById("importFlagMissing").checked }; },
    afterCommit: function (res) {
      var extra = [];
      if (res.flagged) extra.push(res.flagged + " guest(s) not in the file were flagged Needs review.");
      if (res.createdTables && res.createdTables.length) extra.push("New tables created (capacity 10 — check them under Tables): " + res.createdTables.join(", ") + ".");
      if (res.warnings && res.warnings.length) extra.push("Could not seat: " + res.warnings.join("; ") + ".");
      if (extra.length) askConfirm("Import finished", extra.join(" "));
    },
    isValid: function (r) { return !!r.draft.firstName; },
    buildCommitRow: function (r) { return { fields: r.fields, resolution: r.resolution, targetId: r.duplicate ? r.duplicate.id : null }; },
    resultText: function (res) { return "Imported: " + res.created + " created, " + res.updated + " updated, " + res.skipped + " skipped"; },
    renderRow: function (r, idx) {
      var name = (r.draft.firstName + " " + r.draft.lastName).trim() || "(no name)";
      var statusHtml = r.duplicate
        ? '<span class="pill pill-status-amber">Already on the list as ' + escapeHtml(r.duplicate.name) + (r.duplicate.by === "phone" ? " (same phone)" : "") + " · RSVP " + escapeHtml(String(r.duplicate.rsvpStatus || "pending").replace("_", " ")) + "</span>"
        : (r.draft.firstName ? '<span class="pill pill-status-green">New guest</span>' : '<span class="pill pill-status-red">Missing name</span>');
      if (r.draft.table) statusHtml += ' <span class="pill pill-table">' + escapeHtml(r.draft.table) + "</span>";
      if (r.draft.reviewFlag) statusHtml += ' <span class="pill pill-review" title="' + escapeHtml(r.draft.reviewFlag) + '">Needs review</span>';
      var actionOptions = r.duplicate
        ? importOpt(r, "update", "Update existing (keeps RSVP)") + importOpt(r, "skip", "Skip") + importOpt(r, "create", "Create new anyway")
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
