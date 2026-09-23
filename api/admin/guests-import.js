const { requireAuth } = require("../../lib/auth");
const { readData, writeData, newId } = require("../../lib/blob-store");
const Fields = require("../../assets/js/guest-fields.js");

const COLUMNS = ["FirstName", "LastName", "Phone", "Email", "InvitationType", "FamilyName", "InvitedFor", "Gender", "InvitedCount", "PlusOneAllowed", "RSVPStatus", "Notes"];

// Minimal RFC4180-ish CSV parser: handles quoted fields, escaped quotes, commas/newlines inside quotes.
function parseCsv(text) {
  const rows = [];
  let row = [];
  let field = "";
  let inQuotes = false;
  const s = text.replace(/\r\n/g, "\n").replace(/\r/g, "\n");
  for (let i = 0; i < s.length; i++) {
    const c = s[i];
    if (inQuotes) {
      if (c === '"') {
        if (s[i + 1] === '"') { field += '"'; i++; } else { inQuotes = false; }
      } else { field += c; }
    } else if (c === '"') {
      inQuotes = true;
    } else if (c === ",") {
      row.push(field); field = "";
    } else if (c === "\n") {
      row.push(field); field = "";
      rows.push(row); row = [];
    } else {
      field += c;
    }
  }
  if (field.length || row.length) { row.push(field); rows.push(row); }
  return rows.filter((r) => r.some((c) => c.trim() !== ""));
}

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
};
function canonicalHeader(h) {
  const key = String(h || "").toLowerCase().replace(/[^a-z0-9]/g, "");
  return HEADER_ALIASES[key] || String(h || "").trim();
}
const INVITATION_TYPES = ["individual", "couple", "family", "group"];

function normPhone(s) { return String(s || "").replace(/[^\d]/g, ""); }
function normName(s) { return String(s || "").trim().toLowerCase().replace(/\s+/g, " "); }

function toGuestDraft(rowObj) {
  return {
    firstName: (rowObj.FirstName || "").trim(),
    lastName: (rowObj.LastName || "").trim(),
    phone: (rowObj.Phone || "").trim(),
    email: (rowObj.Email || "").trim(),
    invitationType: (function (t) { t = String(t || "").trim().toLowerCase(); return INVITATION_TYPES.indexOf(t) !== -1 ? t : "individual"; })(rowObj.InvitationType),
    familyName: (rowObj.FamilyName || "").trim(),
    invitedFor: Fields.normCategory(rowObj.InvitedFor),
    gender: Fields.normGender(rowObj.Gender),
    // blank count: 2 for a couple, otherwise 1
    invitedCount: Math.max(1, Math.min(50, parseInt(rowObj.InvitedCount, 10) || (String(rowObj.InvitationType || "").trim().toLowerCase() === "couple" ? 2 : 1))),
    plusOneAllowed: /^(y|yes|true|1)$/i.test((rowObj.PlusOneAllowed || "").trim()),
    rsvpStatus: (rowObj.RSVPStatus || "pending").trim().toLowerCase() || "pending",
    attendingCount: 0,
    notes: (rowObj.Notes || "").trim(),
  };
}

module.exports = async function handler(req, res) {
  if (!requireAuth(req, res)) return;
  if (req.method !== "POST") { res.status(405).json({ error: "Method not allowed" }); return; }

  const body = req.body || {};
  const data = await readData();

  if (body.mode === "commit") {
    const rows = Array.isArray(body.rows) ? body.rows : [];
    let created = 0, updated = 0, skipped = 0;
    rows.forEach((r) => {
      if (r.resolution === "skip") { skipped++; return; }
      const draft = toGuestDraft(r.fields || {});
      if (r.resolution === "update" && r.targetId) {
        const existing = data.guests.find((g) => g.id === r.targetId);
        if (existing) {
          // Contact/invitation details only — never clobber RSVP progress already
          // recorded (via the guest edit modal or the guest's own RSVP submission).
          const { rsvpStatus, attendingCount, ...contactFields } = draft;
          if (!contactFields.gender) delete contactFields.gender; // don't blank what the guest told us
          Object.assign(existing, contactFields);
          updated++;
          return;
        }
      }
      data.guests.push(Object.assign({
        id: newId("guest"),
        checkedIn: false,
        checkInTime: null,
        createdAt: new Date().toISOString(),
        rsvpAt: null,
      }, draft));
      created++;
    });
    await writeData(data);
    res.status(200).json({ ok: true, created, updated, skipped });
    return;
  }

  // preview mode
  const csvText = String(body.csv || "");
  if (!csvText.trim()) { res.status(400).json({ error: "No CSV content provided" }); return; }
  const rows = parseCsv(csvText);
  if (!rows.length) { res.status(400).json({ error: "CSV appears to be empty" }); return; }

  const header = rows[0].map(canonicalHeader);
  const dataRows = rows.slice(1);

  const preview = dataRows.map((r) => {
    const fields = {};
    header.forEach((h, i) => { fields[h] = r[i] !== undefined ? r[i] : ""; });
    const draft = toGuestDraft(fields);
    const incomingPhone = normPhone(draft.phone);
    const incomingName = normName(draft.firstName + " " + draft.lastName);
    let duplicate = null;
    if (incomingPhone) {
      duplicate = data.guests.find((g) => g.phone && normPhone(g.phone) === incomingPhone);
    }
    if (!duplicate && incomingName) {
      duplicate = data.guests.find((g) => normName((g.firstName || "") + " " + (g.lastName || "")) === incomingName);
    }
    return {
      fields,
      draft,
      duplicate: duplicate ? { id: duplicate.id, name: ((duplicate.firstName || "") + " " + (duplicate.lastName || "")).trim(), phone: duplicate.phone } : null,
    };
  });

  const validRows = preview.filter((p) => p.draft.firstName);
  const invalidCount = preview.length - validRows.length;

  res.status(200).json({
    columns: COLUMNS,
    totalRows: preview.length,
    invalidRows: invalidCount,
    duplicateCount: preview.filter((p) => p.duplicate).length,
    rows: preview,
  });
};
