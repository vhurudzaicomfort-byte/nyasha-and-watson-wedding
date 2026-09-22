(function () {
  "use strict";

  var guests = [];
  var tables = [];

  var toastTimer;
  function showToast(msg) {
    var t = document.getElementById("toast");
    t.textContent = msg; t.classList.add("show");
    clearTimeout(toastTimer);
    toastTimer = setTimeout(function () { t.classList.remove("show"); }, 2600);
  }

  function escapeHtml(s) { return String(s == null ? "" : s).replace(/[&<>"']/g, function (c) { return { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]; }); }
  function fullName(g) { return ((g.firstName || "") + " " + (g.lastName || "")).trim() || "(unnamed guest)"; }
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
    return Promise.all([api("/api/admin/guests"), api("/api/admin/tables")]).then(function (res) {
      guests = res[0].guests; tables = res[1].tables;
      renderAll();
    });
  }
  function renderAll() {
    renderDashboard(); renderGuestTable(); renderTables(); populateFilterTables();
  }

  function occupiedSeats(t) {
    return guests.filter(function (g) { return g.tableId === t.id; })
      .reduce(function (s, g) { return s + (Number(g.attendingCount) || Number(g.invitedCount) || 1); }, 0);
  }

  function renderDashboard() {
    var total = guests.length;
    var attending = guests.filter(function (g) { return g.rsvpStatus === "attending"; });
    var maybe = guests.filter(function (g) { return g.rsvpStatus === "maybe"; });
    var not = guests.filter(function (g) { return g.rsvpStatus === "not_attending"; });
    var pending = guests.filter(function (g) { return !g.rsvpStatus || g.rsvpStatus === "pending"; });
    var attendingCount = attending.reduce(function (s, g) { return s + (Number(g.attendingCount) || 0); }, 0);
    var invitedCount = guests.reduce(function (s, g) { return s + (Number(g.invitedCount) || 1); }, 0);
    var seatCapacity = tables.reduce(function (s, t) { return s + (Number(t.capacity) || 0); }, 0);
    var seatOccupied = tables.reduce(function (s, t) { return s + occupiedSeats(t); }, 0);
    var checkedIn = guests.filter(function (g) { return g.checkedIn; }).length;
    var responded = attending.length + maybe.length + not.length;
    var rate = total ? Math.round((responded / total) * 100) : 0;

    document.getElementById("statGrid").innerHTML = [
      stat("Total Invited (records)", total, invitedCount + " people across all invitations"),
      stat("Attending", attending.length, attendingCount + " people confirmed", true),
      stat("Maybe", maybe.length),
      stat("Not Attending", not.length),
      stat("Pending", pending.length),
      stat("Tables", tables.length, seatOccupied + " / " + seatCapacity + " seats filled"),
      stat("Checked In", checkedIn, (total - checkedIn) + " not yet arrived"),
      stat("RSVP Rate", rate + "%", responded + " of " + total + " responded")
    ].join("");

    var rows = [["Attending", attending.length, total], ["Maybe", maybe.length, total], ["Not Attending", not.length, total], ["Pending", pending.length, total]];
    document.getElementById("rsvpBars").innerHTML = rows.map(barRow).join("") || emptyBars();

    var dietCounts = {};
    guests.forEach(function (g) {
      if (!g.dietary) return;
      String(g.dietary).split(/[;,\n]/).forEach(function (part) {
        var m = part.split(":"); var val = (m.length > 1 ? m[1] : m[0]).trim();
        if (!val) return;
        var key = val.toLowerCase();
        if (key === "none" || key === "no restrictions") return;
        dietCounts[val] = (dietCounts[val] || 0) + 1;
      });
    });
    var dietEntries = Object.keys(dietCounts).map(function (k) { return [k, dietCounts[k]]; });
    var maxDiet = Math.max.apply(null, dietEntries.map(function (e) { return e[1]; }).concat([1]));
    document.getElementById("dietBars").innerHTML = dietEntries.length
      ? dietEntries.map(function (e) { return barRow([e[0], e[1], maxDiet]); }).join("")
      : '<p style="color:var(--text-muted); font-size:.84rem;">No dietary requirements logged yet.</p>';
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
  function populateFilterTables() {
    var sel = document.getElementById("filterTable");
    var current = sel.value;
    sel.innerHTML = '<option value="">All tables</option>' + tables.map(function (t) { return '<option value="' + t.id + '">' + escapeHtml(t.name) + "</option>"; }).join("");
    sel.value = current;
  }

  function renderGuestTable() {
    var q = (document.getElementById("guestSearch").value || "").toLowerCase();
    var fRsvp = document.getElementById("filterRsvp").value;
    var fTable = document.getElementById("filterTable").value;
    var fCheckin = document.getElementById("filterCheckin").value;

    var rows = guests.filter(function (g) {
      if (q) {
        var hay = (fullName(g) + " " + (g.phone || "") + " " + (g.familyName || "")).toLowerCase();
        if (hay.indexOf(q) === -1) return false;
      }
      if (fRsvp && (g.rsvpStatus || "pending") !== fRsvp) return false;
      if (fTable && g.tableId !== fTable) return false;
      if (fCheckin === "yes" && !g.checkedIn) return false;
      if (fCheckin === "no" && g.checkedIn) return false;
      return true;
    }).sort(function (a, b) { return fullName(a).localeCompare(fullName(b)); });

    document.getElementById("guestsEmpty").hidden = guests.length !== 0;

    document.getElementById("guestRows").innerHTML = rows.map(function (g) {
      var tbl = tables.find(function (t) { return t.id === g.tableId; });
      var status = g.rsvpStatus || "pending";
      return "<tr>" +
        '<td><div class="g-name">' + escapeHtml(fullName(g)) + '</div><div class="g-sub">' + escapeHtml(g.familyName || capitalize(g.invitationType || "individual")) + "</div></td>" +
        '<td><span class="pill pill-' + status + '">' + status.replace("_", " ") + "</span></td>" +
        "<td>" + (g.attendingCount != null && g.attendingCount !== "" ? g.attendingCount : "—") + " / " + (g.invitedCount || 1) + "</td>" +
        "<td>" + (tbl ? escapeHtml(tbl.name) : '<span style="color:var(--text-muted)">Unassigned</span>') + "</td>" +
        '<td style="max-width:160px; font-size:.74rem; color:var(--text-muted);">' + escapeHtml(g.dietary || "—") + "</td>" +
        '<td><span class="pill ' + (g.checkedIn ? "pill-checked" : "pill-notchecked") + '">' + (g.checkedIn ? "Checked in" : "Not yet") + "</span></td>" +
        '<td><div class="row-actions">' + iconBtn("edit", g.id, "Edit") + iconBtn("badge", g.id, "Badge") + iconBtn("checkin", g.id, g.checkedIn ? "Undo check-in" : "Check in") + iconBtn("delete", g.id, "Delete") + "</div></td>" +
        "</tr>";
    }).join("");
  }
  function iconBtn(action, id, title) {
    var icons = {
      edit: '<path d="M12 20h9"/><path d="M16.5 3.5a2.1 2.1 0 0 1 3 3L7 19l-4 1 1-4z"/>',
      badge: '<rect x="4" y="3" width="16" height="18" rx="2"/><circle cx="12" cy="10" r="3"/><path d="M8 18h8"/>',
      checkin: '<path d="M20 6L9 17l-5-5"/>',
      delete: '<path d="M3 6h18"/><path d="M8 6V4a1 1 0 0 1 1-1h6a1 1 0 0 1 1 1v2"/><path d="M19 6l-1 14a1 1 0 0 1-1 1H7a1 1 0 0 1-1-1L5 6"/>'
    };
    return '<button class="icon-btn" data-action="' + action + '" data-id="' + id + '" title="' + title + '" aria-label="' + title + '"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8">' + icons[action] + "</svg></button>";
  }

  document.getElementById("guestSearch").addEventListener("input", renderGuestTable);
  document.getElementById("filterRsvp").addEventListener("change", renderGuestTable);
  document.getElementById("filterTable").addEventListener("change", renderGuestTable);
  document.getElementById("filterCheckin").addEventListener("change", renderGuestTable);

  document.getElementById("guestRows").addEventListener("click", function (e) {
    var btn = e.target.closest(".icon-btn");
    if (!btn) return;
    var id = btn.dataset.id, action = btn.dataset.action;
    var g = guests.find(function (x) { return x.id === id; });
    if (!g) return;
    if (action === "edit") openGuestModal(g);
    else if (action === "badge") openBadgeModal(g);
    else if (action === "checkin") toggleCheckin(g);
    else if (action === "delete") deleteGuest(g);
  });

  function toggleCheckin(g) {
    var next = !g.checkedIn;
    api("/api/admin/guests?id=" + g.id, { method: "PATCH", body: { checkedIn: next, checkInTime: next ? new Date().toISOString() : null } })
      .then(function () { showToast(next ? fullName(g) + " checked in" : "Check-in undone"); return loadAll(); })
      .catch(function () { showToast("Could not update check-in"); });
  }
  function deleteGuest(g) {
    askConfirm("Remove " + fullName(g) + "?", "This removes them from the guest list and any table they are seated at.").then(function (ok) {
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
    document.getElementById("f-phone").value = g ? (g.phone || "") : "";
    document.getElementById("f-email").value = g ? (g.email || "") : "";
    document.getElementById("f-type").value = g ? (g.invitationType || "individual") : "individual";
    document.getElementById("f-family").value = g ? (g.familyName || "") : "";
    document.getElementById("f-invited").value = g ? (g.invitedCount || 1) : 1;
    document.getElementById("f-rsvp").value = g ? (g.rsvpStatus || "pending") : "pending";
    document.getElementById("f-attending").value = g ? (g.attendingCount || 0) : 0;
    document.getElementById("f-plusone").checked = g ? !!g.plusOneAllowed : false;
    document.getElementById("f-dietary").value = g ? (g.dietary || "") : "";
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
      phone: document.getElementById("f-phone").value.trim(),
      email: document.getElementById("f-email").value.trim(),
      invitationType: document.getElementById("f-type").value,
      familyName: document.getElementById("f-family").value.trim(),
      invitedCount: Number(document.getElementById("f-invited").value) || 1,
      rsvpStatus: document.getElementById("f-rsvp").value,
      attendingCount: Number(document.getElementById("f-attending").value) || 0,
      plusOneAllowed: document.getElementById("f-plusone").checked,
      dietary: document.getElementById("f-dietary").value.trim(),
      notes: document.getElementById("f-notes").value.trim()
    };
    if (data.rsvpStatus === "attending" && !data.attendingCount) data.attendingCount = data.invitedCount;
    var req = editingGuestId
      ? api("/api/admin/guests?id=" + editingGuestId, { method: "PATCH", body: Object.assign(data, { rsvpAt: new Date().toISOString() }) })
      : api("/api/admin/guests", { method: "POST", body: data });
    req.then(function () { showToast(editingGuestId ? "Guest updated" : "Guest added"); closeGuestModal(); return loadAll(); })
      .catch(function (e) { showToast(e.message || "Could not save guest"); });
  });

  /* ---------------- TABLES ---------------- */
  function renderTables() {
    document.getElementById("tablesEmpty").hidden = tables.length !== 0;
    document.getElementById("tablesGrid").innerHTML = tables.map(function (t) {
      var occ = occupiedSeats(t);
      var cap = Number(t.capacity) || 0;
      var partyGuests = guests.filter(function (g) { return g.tableId === t.id; });
      var dots = "";
      var filled = Math.min(occ, cap);
      for (var i = 0; i < cap; i++) { dots += '<span class="seat-dot' + (i < filled ? " filled" : "") + '"></span>'; }
      return '<div class="table-card' + (t.vip ? " vip" : "") + (t.locked ? " locked" : "") + '" data-id="' + t.id + '">' +
        '<div class="tc-head"><div class="tc-name">' + escapeHtml(t.name) + '</div><div class="tc-badges">' +
        (t.vip ? '<span class="tc-badge">VIP</span>' : "") + (t.locked ? '<span class="tc-badge">Locked</span>' : "") + "</div></div>" +
        '<div class="tc-seats">' + dots + "</div>" +
        '<div class="tc-meta">' + occ + " / " + cap + " seats" + (occ >= cap && cap > 0 ? ' &middot; <strong style="color:var(--error)">FULL</strong>' : "") + "</div>" +
        '<div class="tc-guests">' + partyGuests.slice(0, 4).map(function (g) { return '<div class="tc-guest">' + escapeHtml(fullName(g)) + "</div>"; }).join("") +
        (partyGuests.length > 4 ? '<div class="tc-guest">+' + (partyGuests.length - 4) + " more</div>" : "") + "</div>" +
        "</div>";
    }).join("");
  }

  document.getElementById("tablesGrid").addEventListener("click", function (e) {
    var card = e.target.closest(".table-card");
    if (!card) return;
    var t = tables.find(function (x) { return x.id === card.dataset.id; });
    if (t) openTableModal(t);
  });

  var editingTableId = null;
  function openTableModal(t) {
    editingTableId = t ? t.id : null;
    document.getElementById("tableModalTitle").textContent = t ? "Edit " + t.name : "Add Table";
    document.getElementById("t-name").value = t ? t.name : "Table " + (tables.length + 1);
    document.getElementById("t-capacity").value = t ? t.capacity : 8;
    document.getElementById("t-vip").checked = t ? !!t.vip : false;
    document.getElementById("t-locked").checked = t ? !!t.locked : false;
    document.getElementById("tableModalDelete").hidden = !t;
    renderTableSeatedList(t);
    renderAssignSelect(t);
    document.getElementById("tableModalOverlay").hidden = false;
  }
  function closeTableModal() { document.getElementById("tableModalOverlay").hidden = true; editingTableId = null; }
  document.getElementById("addTableBtn").addEventListener("click", function () { openTableModal(null); });
  document.getElementById("tableModalClose").addEventListener("click", closeTableModal);

  function renderTableSeatedList(t) {
    var seated = t ? guests.filter(function (g) { return g.tableId === t.id; }) : [];
    document.getElementById("tSeatedCount").textContent = t ? occupiedSeats(t) : 0;
    document.getElementById("tCapCount").textContent = t ? (t.capacity || 0) : (document.getElementById("t-capacity").value || 0);
    document.getElementById("tSeatedList").innerHTML = seated.length ? seated.map(function (g) {
      return '<div style="display:flex; justify-content:space-between; align-items:center; background:var(--ivory-deep); padding:8px 10px; border-radius:6px; font-size:.8rem;">' +
        "<span>" + escapeHtml(fullName(g)) + ' <span style="color:var(--text-muted)">(' + (g.attendingCount || g.invitedCount || 1) + ')</span></span>' +
        '<button class="btn btn-sm btn-outline" data-unassign="' + g.id + '">Remove</button></div>';
    }).join("") : '<p style="font-size:.78rem; color:var(--text-muted);">No one seated here yet.</p>';
  }
  function renderAssignSelect(t) {
    var unassigned = guests.filter(function (g) { return !g.tableId && (g.rsvpStatus === "attending" || g.rsvpStatus === "maybe" || !g.rsvpStatus); });
    var sel = document.getElementById("t-assignSelect");
    sel.innerHTML = unassigned.length
      ? unassigned.map(function (g) { return '<option value="' + g.id + '">' + escapeHtml(fullName(g)) + " (" + (g.attendingCount || g.invitedCount || 1) + ")</option>"; }).join("")
      : '<option value="">No unassigned guests</option>';
  }

  document.getElementById("tSeatedList").addEventListener("click", function (e) {
    var btn = e.target.closest("[data-unassign]");
    if (!btn) return;
    var gid = btn.dataset.unassign;
    api("/api/admin/tables?id=" + editingTableId, { method: "PATCH", body: { action: "unassign", guestId: gid } })
      .then(function () { return loadAll(); })
      .then(function () {
        var t = tables.find(function (x) { return x.id === editingTableId; });
        renderTableSeatedList(t); renderAssignSelect(t);
        showToast("Removed from table");
      }).catch(function () { showToast("Could not update"); });
  });

  document.getElementById("t-assignBtn").addEventListener("click", function () {
    var gid = document.getElementById("t-assignSelect").value;
    if (!gid) return;
    if (!editingTableId) { showToast("Save the table before assigning guests"); return; }
    api("/api/admin/tables?id=" + editingTableId, { method: "PATCH", body: { action: "assign", guestId: gid } })
      .then(function () { return loadAll(); })
      .then(function () {
        var t = tables.find(function (x) { return x.id === editingTableId; });
        renderTableSeatedList(t); renderAssignSelect(t);
        showToast("Guest assigned");
      }).catch(function (e) { showToast(e.message === "Table full" ? "Table full — not enough seats for this party" : "Could not assign guest"); });
  });

  document.getElementById("tableModalSave").addEventListener("click", function () {
    var name = document.getElementById("t-name").value.trim();
    if (!name) { document.getElementById("t-name").focus(); return; }
    var data = {
      name: name,
      capacity: Math.max(1, Number(document.getElementById("t-capacity").value) || 1),
      vip: document.getElementById("t-vip").checked,
      locked: document.getElementById("t-locked").checked
    };
    var req = editingTableId
      ? api("/api/admin/tables?id=" + editingTableId, { method: "PATCH", body: data })
      : api("/api/admin/tables", { method: "POST", body: data });
    req.then(function (res) { if (!editingTableId && res.table) editingTableId = res.table.id; showToast("Table saved"); closeTableModal(); return loadAll(); })
      .catch(function () { showToast("Could not save table"); });
  });

  document.getElementById("tableModalDelete").addEventListener("click", function () {
    if (!editingTableId) return;
    askConfirm("Delete this table?", "Guests seated here will become unassigned.").then(function (ok) {
      if (!ok) return;
      api("/api/admin/tables?id=" + editingTableId, { method: "DELETE" })
        .then(function () { showToast("Table deleted"); closeTableModal(); return loadAll(); })
        .catch(function () { showToast("Could not delete table"); });
    });
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
        new QRCode(qrTemp, { text: g.id, width: 260, height: 260, colorDark: "#3E1730", colorLight: "#FBF7F0", correctLevel: QRCode.CorrectLevel.M });
        qrDataUrlPromise = new Promise(function (resolve) { setTimeout(function () { var c = qrTemp.querySelector("canvas"); resolve(c ? c.toDataURL("image/png") : null); }, 150); });
      } catch (e) { qrDataUrlPromise = Promise.resolve(null); }
    } else { qrDataUrlPromise = Promise.resolve(null); }

    qrDataUrlPromise.then(function (qrDataUrl) {
      var c = document.getElementById("badgeCanvas");
      var ctx = c.getContext("2d");
      var w = c.width, h = c.height;
      ctx.fillStyle = "#FBF7F0"; ctx.fillRect(0, 0, w, h);
      ctx.strokeStyle = "#B08A46"; ctx.lineWidth = 3; ctx.strokeRect(24, 24, w - 48, h - 48);
      ctx.textAlign = "center";
      ctx.fillStyle = "#8B7A6E"; ctx.font = '400 22px Jost, sans-serif';
      ctx.fillText("WATSON & NYASHA", w / 2, 90);
      ctx.fillStyle = "#B08A46"; ctx.font = '500 20px Jost, sans-serif';
      ctx.fillText("G U E S T   P A S S", w / 2, 124);
      ctx.strokeStyle = "#E4D2B0"; ctx.beginPath(); ctx.moveTo(80, 150); ctx.lineTo(w - 80, 150); ctx.stroke();
      ctx.fillStyle = "#3E1730"; ctx.font = '600 48px "Cormorant Garamond", serif';
      wrapText(ctx, fullName(g), w / 2, 220, w - 140, 52);
      var tbl = tables.find(function (t) { return t.id === g.tableId; });
      ctx.fillStyle = "#5A2444"; ctx.font = '500 26px Jost, sans-serif';
      ctx.fillText(tbl ? tbl.name.toUpperCase() : "TABLE TO BE ASSIGNED", w / 2, 320);
      ctx.fillStyle = "#8B7A6E"; ctx.font = '400 20px Jost, sans-serif';
      ctx.fillText("Party of " + (g.attendingCount || g.invitedCount || 1), w / 2, 352);
      var status = (g.rsvpStatus || "pending").toUpperCase().replace("_", " ");
      ctx.fillStyle = "#D97F55"; ctx.font = '500 22px Jost, sans-serif';
      ctx.fillText(status, w / 2, 400);
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
    var tbl = tables.find(function (t) { return t.id === g.tableId; });
    return '<div class="checkin-result"><div class="g-name">' + escapeHtml(fullName(g)) + "</div>" +
      '<div class="g-sub">' + (tbl ? escapeHtml(tbl.name) : "No table assigned") + " &middot; Party of " + (g.attendingCount || g.invitedCount || 1) + " &middot; " + escapeHtml(g.dietary || "No dietary notes") + "</div>" +
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
        var g = guests.find(function (x) { return x.id === code.data; });
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

  /* ---------------- INIT ---------------- */
  api("/api/admin/session").then(function (res) {
    if (!res.authed) { location.href = "/admin/login.html"; return; }
    document.getElementById("loadingScreen").hidden = true;
    document.getElementById("appRoot").hidden = false;
    loadAll().catch(function () { showToast("Could not load guest data"); });
  }).catch(function () { location.href = "/admin/login.html"; });
})();
