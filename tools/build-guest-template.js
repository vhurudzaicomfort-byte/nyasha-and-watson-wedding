// Builds the Excel guest import template (assets/guest-import-template.xlsx):
// styled header, wide bordered columns, dropdowns for the fixed-choice fields,
// and an Instructions sheet. Run from /tools:  npm run guest-template
const path = require("path");
const ExcelJS = require("exceljs");

const OUT = path.join(__dirname, "..", "assets", "guest-import-template.xlsx");
const ROWS = 500; // pre-formatted rows with borders + dropdowns
const PLUM = "FF3E1730", PLUM2 = "FF5A2444", GOLD = "FFB08A46", CHAMP = "FFE4D2B0", IVORY = "FFFBF7F0", IVORY_DEEP = "FFF3ECDF", MUTED = "FF8B7A6E";

const LISTS = {
  invitationType: ["Individual", "Couple", "Family"],
  invitedFor: ["Bride's Side", "Groom's Side", "Church", "Mutual Friends", "Service Providers"],
  gender: ["Female", "Male"],
};

// header text, width, key, note (shown when the header cell is hovered)
const COLUMNS = [
  { header: "First Name *", width: 22, note: "Required." },
  { header: "Last Name", width: 22 },
  { header: "Phone", width: 22, text: true, note: "Include the country code, e.g. +263 772 692 738. Used to match RSVPs and send WhatsApp invites." },
  { header: "Email", width: 32 },
  { header: "Invitation Type", width: 19, list: "invitationType", note: "Choose from the list." },
  { header: "Family Name", width: 26, note: "For couples and families, e.g. The Moyo Family." },
  { header: "Invited For", width: 22, list: "invitedFor", note: "Choose from the list." },
  { header: "Gender", width: 13, list: "gender", note: "Optional. Choose from the list." },
  { header: "Number Invited", width: 17, number: true, note: "How many people this invitation covers. Leave blank for 1 (Individual) or 2 (Couple)." },
  { header: "Notes", width: 50 },
];

const thin = (argb) => ({ style: "thin", color: { argb } });
const gridBorder = { top: thin(CHAMP), left: thin(CHAMP), bottom: thin(CHAMP), right: thin(CHAMP) };

async function main() {
  const wb = new ExcelJS.Workbook();
  wb.creator = "Nyasha & Watson — Wedding Management Portal";
  wb.created = new Date();

  // ---------- Guests sheet ----------
  const ws = wb.addWorksheet("Guests", {
    properties: { tabColor: { argb: PLUM }, defaultRowHeight: 22 },
    views: [{ state: "frozen", ySplit: 3, activeCell: "A4", showGridLines: false }],
    pageSetup: { orientation: "landscape", fitToPage: true, fitToWidth: 1, fitToHeight: 0, paperSize: 9, margins: { left: 0.4, right: 0.4, top: 0.5, bottom: 0.5, header: 0.2, footer: 0.2 } },
    headerFooter: { oddFooter: "&L&8Nyasha && Watson · Guest Register&R&8Page &P of &N" },
  });
  ws.columns = COLUMNS.map((c) => ({ width: c.width }));
  const last = String.fromCharCode(64 + COLUMNS.length);

  // title band (row 1) + subtitle (row 2); the header row the importer reads is row 3
  ws.mergeCells(`A1:${last}1`);
  const title = ws.getCell("A1");
  title.value = "Nyasha & Watson — Guest Register";
  title.font = { name: "Calibri", size: 18, bold: true, color: { argb: PLUM } };
  title.alignment = { vertical: "middle", horizontal: "left", indent: 1 };
  ws.getRow(1).height = 34;
  ws.mergeCells(`A2:${last}2`);
  const sub = ws.getCell("A2");
  sub.value = "Saturday 5 December 2026 · Colne Valley Nature Reserve Park, Harare — one invitation per row. Shaded columns are dropdowns. See the Instructions tab.";
  sub.font = { name: "Calibri", size: 10, italic: true, color: { argb: MUTED } };
  sub.alignment = { vertical: "middle", horizontal: "left", indent: 1 };
  ws.getRow(2).height = 22;
  for (let c = 1; c <= COLUMNS.length; c++) {
    ws.getRow(1).getCell(c).fill = { type: "pattern", pattern: "solid", fgColor: { argb: IVORY } };
    ws.getRow(2).getCell(c).fill = { type: "pattern", pattern: "solid", fgColor: { argb: IVORY } };
    ws.getRow(2).getCell(c).border = { bottom: { style: "medium", color: { argb: GOLD } } };
  }

  const header = ws.getRow(3);
  header.height = 30;
  COLUMNS.forEach((c, i) => {
    const cell = header.getCell(i + 1);
    cell.value = c.header;
    cell.font = { name: "Calibri", size: 11, bold: true, color: { argb: "FFFFFFFF" } };
    cell.fill = { type: "pattern", pattern: "solid", fgColor: { argb: PLUM } };
    cell.alignment = { vertical: "middle", horizontal: "center", wrapText: true };
    cell.border = { top: thin(PLUM2), left: thin(PLUM2), bottom: { style: "medium", color: { argb: GOLD } }, right: thin(PLUM2) };
    if (c.note) cell.note = { texts: [{ text: c.note }], margins: { insetmode: "auto" } };
  });
  ws.autoFilter = { from: { row: 3, column: 1 }, to: { row: 3, column: COLUMNS.length } };

  for (let r = 4; r < 4 + ROWS; r++) {
    const row = ws.getRow(r);
    row.height = 22;
    COLUMNS.forEach((c, i) => {
      const cell = row.getCell(i + 1);
      cell.border = gridBorder;
      cell.font = { name: "Calibri", size: 11, color: { argb: "FF3A2430" } };
      cell.alignment = { vertical: "middle", horizontal: c.list || c.number ? "center" : "left", indent: c.list || c.number ? 0 : 1 };
      if (c.list) cell.fill = { type: "pattern", pattern: "solid", fgColor: { argb: IVORY_DEEP } };
      if (c.text) cell.numFmt = "@"; // keep "+263…" and leading zeros as typed
      if (c.list) {
        cell.dataValidation = {
          type: "list", allowBlank: true, showInputMessage: true, showErrorMessage: true,
          formulae: ['"' + LISTS[c.list].join(",") + '"'],
          promptTitle: c.header, prompt: "Choose from the list",
          errorStyle: "stop", errorTitle: "Please use the list", error: "Choose one of: " + LISTS[c.list].join(", "),
        };
      } else if (c.number) {
        cell.dataValidation = {
          type: "whole", operator: "between", allowBlank: true, showErrorMessage: true, formulae: [1, 50],
          errorStyle: "stop", errorTitle: "Number Invited", error: "Enter a whole number from 1 to 50.",
        };
      }
    });
  }

  // ---------- Instructions sheet (even 8-column grid; text rows span B:I) ----------
  const info = wb.addWorksheet("Instructions", { properties: { tabColor: { argb: GOLD } }, views: [{ showGridLines: false }], pageSetup: { orientation: "landscape", fitToPage: true, fitToWidth: 1, fitToHeight: 1, paperSize: 9 } });
  info.columns = [{ width: 3 }].concat(Array.from({ length: 8 }, () => ({ width: 19 })));
  let r = 2;
  const ink = { size: 11, color: { argb: "FF3A2430" } };
  function line(text, font, height) {
    info.mergeCells(r, 2, r, 9);
    const c = info.getRow(r).getCell(2);
    c.value = text; c.font = font; c.alignment = { vertical: "middle", wrapText: true, indent: 1 };
    info.getRow(r).height = height || 22; r++;
  }
  function pair(label, value, height) {
    info.mergeCells(r, 2, r, 3); info.mergeCells(r, 4, r, 9);
    const a = info.getRow(r).getCell(2), b = info.getRow(r).getCell(4);
    a.value = label; a.font = { bold: true, color: { argb: "FFFFFFFF" } }; a.fill = { type: "pattern", pattern: "solid", fgColor: { argb: PLUM } };
    b.value = value; b.font = ink;
    [a, b].forEach((c) => { c.alignment = { vertical: "middle", wrapText: true, indent: 1 }; });
    for (let col = 2; col <= 9; col++) info.getRow(r).getCell(col).border = gridBorder;
    info.getRow(r).height = height || 24; r++;
  }
  line("How to use this template", { size: 16, bold: true, color: { argb: PLUM } }, 30);
  r++;
  line("1.  Fill in the Guests tab — one invitation per row, starting under the purple header.", ink);
  line("2.  First Name is the only required field. Keep the header row exactly as it is.", ink);
  line("3.  Shaded columns are dropdowns: click the cell and pick from the arrow.", ink);
  line("4.  Save, then in the portal go to Invites & RSVPs → Import and drop this Excel file in.", ink);
  line("5.  You'll see a preview first; possible duplicates are flagged for you to skip, update or add.", ink);
  r++;
  line("Dropdown options", { size: 13, bold: true, color: { argb: PLUM } }, 26);
  pair("Invitation Type", LISTS.invitationType.join("   ·   "));
  pair("Invited For", LISTS.invitedFor.join("   ·   "));
  pair("Gender", LISTS.gender.join("   ·   "));
  r++;
  line("Good to know", { size: 13, bold: true, color: { argb: PLUM } }, 26);
  pair("Phone", "Include the country code (e.g. +263, +27, +44). It lets the site recognise the guest when they RSVP and powers the WhatsApp invite button.", 34);
  pair("Number Invited", "How many people the invitation covers. Leave blank for 1 (Individual) or 2 (Couple); fill it in for families.", 34);
  pair("Family Name", "Shown on the guest list for couples and families, e.g. The Moyo Family.");
  r++;
  line("Example rows — for reference only (they are not imported from this tab)", { size: 13, bold: true, color: { argb: PLUM } }, 26);
  const exHeader = ["First Name", "Last Name", "Phone", "Invitation Type", "Family Name", "Invited For", "Gender", "Number Invited"];
  const examples = [
    ["Tariro", "Moyo", "+263 771 234 567", "Couple", "The Moyo Family", "Groom's Side", "Female", 2],
    ["Rudo", "Banda", "+27 82 111 2233", "Individual", "", "Church", "Female", 1],
    ["Tendai", "Mukanga", "+263 772 000 111", "Family", "The Mukanga Family", "Bride's Side", "Male", 4],
  ];
  exHeader.forEach((h, i) => { const c = info.getRow(r).getCell(2 + i); c.value = h; c.font = { bold: true, size: 10, color: { argb: "FFFFFFFF" } }; c.fill = { type: "pattern", pattern: "solid", fgColor: { argb: PLUM2 } }; c.alignment = { horizontal: "center", vertical: "middle" }; c.border = gridBorder; });
  info.getRow(r).height = 24; r++;
  examples.forEach((row) => {
    row.forEach((v, i) => { const c = info.getRow(r).getCell(2 + i); c.value = v; c.font = { size: 10, italic: true, color: { argb: MUTED } }; c.alignment = { horizontal: "center", vertical: "middle" }; c.border = gridBorder; });
    info.getRow(r).height = 22; r++;
  });

  await wb.xlsx.writeFile(OUT);
  console.log("wrote", OUT);
}

main().catch((e) => { console.error(e); process.exit(1); });
