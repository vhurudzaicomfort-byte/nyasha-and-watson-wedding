const { requireAuth } = require("../../lib/auth");
const { readData, writeData, newId } = require("../../lib/blob-store");
const Fields = require("../../assets/js/guest-fields.js");
const { readRows } = require("../../lib/import-helpers");
const Seat = require("../../lib/seating");

const COLUMNS = ["FirstName", "LastName", "Phone", "Email", "InvitationType", "FamilyName", "InvitedFor", "Gender", "InvitedCount", "PlusOneAllowed", "RSVPStatus", "Notes", "Table", "Review"];

// Accept the Excel template's friendly headers ("First Name *", "Number Invited"…) as
// well as the original CSV ones, matched case- and punctuation-insensitively.
const HEADER_ALIASES = {
  firstname: "FirstName", name: "FirstName", lastname: "LastName", surname: "LastName",
  phone: "Phone", phonenumber: "Phone", mobile: "Phone", cell: "Phone", whatsapp: "Phone",
  email: "Email", emailaddress: "Email",
  invitationtype: "InvitationType", type: "InvitationType",
  familyname: "FamilyName", familygroupname: "FamilyName", family: "FamilyName", groupname: "FamilyName",
  invitedfor: "InvitedFor", category: "InvitedFor", side: "InvitedFor",
  gender: "Gender", sex: "Gender",
  numberinvited: "InvitedCount", invitedcount: "InvitedCount", invited: "InvitedCount", partysize: "InvitedCount", guests: "InvitedCount",
  plusoneallowed: "PlusOneAllowed", plusone: "PlusOneAllowed",
  rsvpstatus: "RSVPStatus", rsvp: "RSVPStatus",
  notes: "Notes", note: "Notes", comments: "Notes",
  table: "Table", tablename: "Table", tablenumber: "Table", tableno: "Table", seating: "Table",
  review: "Review", needsreview: "Review", pleaseconfirm: "Review", check: "Review",
};

function normPhone(s) { return String(s || "").replace(/[^\d]/g, ""); }
// "+263 77…" and "077…" are the same number: compare the last 9 digits
function samePhone(a, b) { var x = normPhone(a), y = normPhone(b); return x.length >= 7 && y.length >= 7 && x.slice(-9) === y.slice(-9); }
function normName(s) { return String(s || "").trim().toLowerCase().replace(/[^a-z0-9' ]/g, " ").replace(/\s+/g, " ").trim(); }
const TITLES = { mai: 1, baba: 1, ba: 1, va: 1, sekuru: 1, mbuya: 1, tete: 1, mainini: 1, bamnini: 1, maiguru: 1, mukoma: 1, mk: 1, sis: 1, mr: 1, mrs: 1, ms: 1, dr: 1, bishop: 1, elder: 1, overseer: 1, pastor: 1, and: 1, wife: 1, husband: 1, guest: 1, family: 1 };
function words(s) { return normName(s).split(" ").filter(function (w) { return w.length > 1 && !TITLES[w]; }); }
const RSVP_VALUES = { pending: "pending", attending: "attending", yes: "attending", maybe: "maybe", notattending: "not_attending", no: "not_attending", declined: "not_attending" };

function toGuestDraft(rowObj) {
  const rsvpKey = String(rowObj.RSVPStatus || "").toLowerCase().replace(/[^a-z]/g, "");
  return {
    firstName: (rowObj.FirstName || "").trim(),
    lastName: (rowObj.LastName || "").trim(),
    phone: (rowObj.Phone || "").trim(),
    email: (rowObj.Email || "").trim(),
    invitationType: Fields.normInvitationType(rowObj.InvitationType),
    familyName: (rowObj.FamilyName || "").trim(),
    invitedFor: Fields.normCategory(rowObj.InvitedFor),
    gender: Fields.normGender(rowObj.Gender),
    // blank count: 2 for a couple, otherwise 1
    invitedCount: Math.max(1, Math.min(50, parseInt(rowObj.InvitedCount, 10) || (String(rowObj.InvitationType || "").trim().toLowerCase() === "couple" ? 2 : 1))),
    plusOneAllowed: /^(y|yes|true|1)$/i.test((rowObj.PlusOneAllowed || "").trim()),
    rsvpStatus: RSVP_VALUES[rsvpKey] || "pending",
    attendingCount: 0,
    notes: (rowObj.Notes || "").trim(),
    reviewFlag: (rowObj.Review || "").trim(),
    table: Seat.displayName(rowObj.Table),
  };
}

// The same person: exact full name, or the same phone AND a shared name word
// (families often share one phone, so a phone alone is never enough).
function findDuplicate(guests, draft) {
  const incomingName = normName(draft.firstName + " " + draft.lastName);
  if (incomingName) {
    const byName = guests.find((g) => normName((g.firstName || "") + " " + (g.lastName || "")) === incomingName);
    if (byName) return { guest: byName, by: "name" };
  }
  if (draft.phone) {
    const mine = words(draft.firstName + " " + draft.lastName);
    const byPhone = guests.find((g) => g.phone && samePhone(g.phone, draft.phone) && words((g.firstName || "") + " " + (g.lastName || "")).some((w) => mine.indexOf(w) !== -1));
    if (byPhone) return { guest: byPhone, by: "phone" };
  }
  return null;
}

function appendNote(existing, add) {
  existing = String(existing || "").trim(); add = String(add || "").trim();
  if (!add || existing.indexOf(add) !== -1) return existing;
  return existing ? existing + " | " + add : add;
}

// Seat a guest at the table named in the file (created if it isn't there yet),
// never beyond its capacity. Returns a warning string when it couldn't.
function seatFromFile(data, guest, tableName, createdTables) {
  if (!tableName) return "";
  let t = Seat.findTable(data.tables, tableName);
  if (!t) {
    t = { id: newId("table"), name: tableName, capacity: 10, notes: "Created by import — check the capacity", createdAt: new Date().toISOString() };
    data.tables.push(t); createdTables.push(tableName);
  }
  if (guest.tableId === t.id) return "";
  const need = Seat.seatsFor(guest), used = Seat.occupied(data.guests, t.id, guest.id);
  if (used + need > t.capacity) return ((guest.firstName || "") + " " + (guest.lastName || "")).trim() + " not seated: " + t.name + " has " + Math.max(0, t.capacity - used) + " seat(s) left";
  guest.tableId = t.id;
  return "";
}

module.exports = async function handler(req, res) {
  if (!requireAuth(req, res)) return;
  if (req.method !== "POST") { res.status(405).json({ error: "Method not allowed" }); return; }

  const body = req.body || {};
  const data = await readData();

  if (body.mode === "commit") {
    const rows = Array.isArray(body.rows) ? body.rows : [];
    const now = new Date().toISOString();
    let created = 0, updated = 0, skipped = 0, flagged = 0;
    const touched = {}, warnings = [], createdTables = [];
    rows.forEach((r) => {
      if (r.resolution === "skip") { skipped++; if (r.targetId) touched[r.targetId] = 1; return; }
      const f = r.fields || {};
      const draft = toGuestDraft(f);
      const tableName = draft.table; delete draft.table;
      if (r.resolution === "update" && r.targetId) {
        const existing = data.guests.find((g) => g.id === r.targetId);
        if (existing) {
          // Correct the invitation details without losing anything already recorded:
          // RSVP progress, check-in and table stay; blank cells never wipe a field;
          // names stay as they are (they matched); notes are added to, not replaced.
          ["phone", "email", "familyName", "invitedFor", "gender"].forEach((k) => { if (draft[k]) existing[k] = draft[k]; });
          if (String(f.InvitationType || "").trim()) existing.invitationType = draft.invitationType;
          if (String(f.InvitedCount || "").trim()) existing.invitedCount = draft.invitedCount;
          if (String(f.PlusOneAllowed || "").trim()) existing.plusOneAllowed = draft.plusOneAllowed;
          if (!existing.firstName) { existing.firstName = draft.firstName; existing.lastName = draft.lastName; }
          existing.notes = appendNote(existing.notes, draft.notes);
          existing.reviewFlag = draft.reviewFlag || (/^not on the list/i.test(existing.reviewFlag || "") ? "" : existing.reviewFlag || "");
          const w = seatFromFile(data, existing, tableName, createdTables); if (w) warnings.push(w);
          touched[existing.id] = 1;
          updated++;
          return;
        }
      }
      const g = Object.assign({
        id: newId("guest"),
        checkedIn: false,
        checkInTime: null,
        createdAt: now,
        rsvpAt: null,
        tableId: null,
      }, draft);
      if (g.rsvpStatus !== "pending") { g.rsvpAt = now; g.rsvpChannel = "admin"; }
      data.guests.push(g);
      const w2 = seatFromFile(data, g, tableName, createdTables); if (w2) warnings.push(w2);
      touched[g.id] = 1;
      created++;
    });
    // Everyone already on the site who isn't in this file: kept, but flagged for the couple to review.
    if (body.flagMissing) {
      const label = "Not on the list imported " + now.slice(0, 10) + " — please review";
      data.guests.forEach((g) => { if (!touched[g.id] && !g.reviewFlag) { g.reviewFlag = label; flagged++; } });
    }
    await writeData(data);
    res.status(200).json({ ok: true, created, updated, skipped, flagged, warnings, createdTables });
    return;
  }

  // preview mode
  const csvText = String(body.csv || "");
  if (!csvText.trim()) { res.status(400).json({ error: "No CSV content provided" }); return; }
  const { header, records } = readRows(csvText, HEADER_ALIASES);
  if (!header.length) { res.status(400).json({ error: "The file appears to be empty" }); return; }

  const preview = records.map((fields) => {
    const draft = toGuestDraft(fields);
    const dup = findDuplicate(data.guests, draft);
    const d = dup && dup.guest;
    return {
      fields,
      draft,
      duplicate: d ? { id: d.id, name: ((d.firstName || "") + " " + (d.lastName || "")).trim(), phone: d.phone, by: dup.by, rsvpStatus: d.rsvpStatus || "pending" } : null,
    };
  });

  const validRows = preview.filter((p) => p.draft.firstName);
  const invalidCount = preview.length - validRows.length;
  const matchedIds = {}; preview.forEach((p) => { if (p.duplicate) matchedIds[p.duplicate.id] = 1; });

  res.status(200).json({
    columns: COLUMNS,
    totalRows: preview.length,
    invalidRows: invalidCount,
    duplicateCount: preview.filter((p) => p.duplicate).length,
    notInFile: data.guests.filter((g) => !matchedIds[g.id]).length,
    rows: preview,
  });
};
