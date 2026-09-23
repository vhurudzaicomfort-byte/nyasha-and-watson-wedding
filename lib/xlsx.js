// Styled Excel workbooks for the portal: import templates (with dropdowns and
// input checks) and reports. One look everywhere: title band, bold plum header,
// wide bordered columns, frozen header, filters, landscape print setup.
const ExcelJS = require("exceljs");

const C = { plum: "FF3E1730", plum2: "FF5A2444", gold: "FFB08A46", champ: "FFE4D2B0", ivory: "FFFBF7F0", ivoryDeep: "FFF3ECDF", muted: "FF8B7A6E", ink: "FF3A2430", white: "FFFFFFFF" };
const thin = (argb) => ({ style: "thin", color: { argb } });
const GRID = { top: thin(C.champ), left: thin(C.champ), bottom: thin(C.champ), right: thin(C.champ) };
const fill = (argb) => ({ type: "pattern", pattern: "solid", fgColor: { argb } });
const EVENT_LINE = "Nyasha & Watson · Saturday 5 December 2026 · Colne Valley Nature Reserve Park, Harare";

function colLetter(n) { let s = ""; while (n > 0) { const m = (n - 1) % 26; s = String.fromCharCode(65 + m) + s; n = Math.floor((n - 1) / 26); } return s; }

function newSheet(wb, name, cols, opts) {
  return wb.addWorksheet(name, {
    properties: { tabColor: { argb: opts.tab || C.plum }, defaultRowHeight: 22 },
    views: [{ state: "frozen", ySplit: 3, activeCell: "A4", showGridLines: false }],
    pageSetup: { orientation: cols > 5 ? "landscape" : "portrait", fitToPage: true, fitToWidth: 1, fitToHeight: 0, paperSize: 9, margins: { left: 0.4, right: 0.4, top: 0.5, bottom: 0.5, header: 0.2, footer: 0.2 }, printTitlesRow: "3:3" },
    headerFooter: { oddFooter: "&L&8Nyasha && Watson · " + name + "&R&8Page &P of &N" },
  });
}

function titleBand(ws, ncols, title, subtitle) {
  const last = colLetter(ncols);
  ws.mergeCells("A1:" + last + "1");
  ws.mergeCells("A2:" + last + "2");
  const t = ws.getCell("A1");
  t.value = title;
  t.font = { name: "Calibri", size: 18, bold: true, color: { argb: C.plum } };
  t.alignment = { vertical: "middle", indent: 1 };
  const s = ws.getCell("A2");
  s.value = subtitle;
  s.font = { name: "Calibri", size: 10, italic: true, color: { argb: C.muted } };
  s.alignment = { vertical: "middle", indent: 1, wrapText: true };
  ws.getRow(1).height = 34;
  ws.getRow(2).height = 24;
  for (let c = 1; c <= ncols; c++) {
    ws.getRow(1).getCell(c).fill = fill(C.ivory);
    ws.getRow(2).getCell(c).fill = fill(C.ivory);
    ws.getRow(2).getCell(c).border = { bottom: { style: "medium", color: { argb: C.gold } } };
  }
}

function headerRow(ws, headers, notes) {
  const row = ws.getRow(3);
  row.height = 32;
  headers.forEach((h, i) => {
    const cell = row.getCell(i + 1);
    cell.value = h;
    cell.font = { name: "Calibri", size: 11, bold: true, color: { argb: C.white } };
    cell.fill = fill(C.plum);
    cell.alignment = { vertical: "middle", horizontal: "center", wrapText: true };
    cell.border = { top: thin(C.plum2), left: thin(C.plum2), bottom: { style: "medium", color: { argb: C.gold } }, right: thin(C.plum2) };
    if (notes && notes[i]) cell.note = { texts: [{ text: notes[i] }] };
  });
  ws.autoFilter = { from: { row: 3, column: 1 }, to: { row: 3, column: headers.length } };
}

/**
 * Import template.
 * spec: { sheet, title, subtitle, rows, columns: [{ header, width, note, list, number: {min,max}, decimal, date, text }],
 *         steps: [..], notes: [[label, text]], examples: { headers, rows } }
 */
async function buildTemplate(spec) {
  const wb = new ExcelJS.Workbook();
  wb.creator = "Nyasha & Watson — Wedding Management Portal";
  wb.created = new Date();
  const cols = spec.columns;
  const ws = newSheet(wb, spec.sheet, cols.length, {});
  ws.columns = cols.map((c) => ({ width: c.width || 18 }));
  titleBand(ws, cols.length, spec.title, spec.subtitle || "Saturday 5 December 2026 · Colne Valley Nature Reserve Park, Harare — one entry per row. Shaded columns are dropdowns; see the Instructions tab.");
  headerRow(ws, cols.map((c) => c.header), cols.map((c) => c.note));

  // dropdown sources live on a hidden sheet: no 255-character limit, and items may contain commas
  const listsWs = wb.addWorksheet("Lists", { state: "hidden" });
  const listRef = {};
  cols.filter((c) => c.list).forEach((c, li) => {
    const letter = colLetter(li + 1);
    c.list.forEach((item, ri) => { listsWs.getCell(letter + (ri + 1)).value = item; });
    listRef[c.header] = "Lists!$" + letter + "$1:$" + letter + "$" + c.list.length;
  });

  const n = spec.rows || 500;
  for (let r = 4; r < 4 + n; r++) {
    const row = ws.getRow(r);
    row.height = 22;
    cols.forEach((c, i) => {
      const cell = row.getCell(i + 1);
      const centered = c.list || c.number || c.date;
      cell.border = GRID;
      cell.font = { name: "Calibri", size: 11, color: { argb: C.ink } };
      cell.alignment = { vertical: "middle", horizontal: c.decimal ? "right" : centered ? "center" : "left", indent: centered || c.decimal ? 0 : 1 };
      if (c.text) cell.numFmt = "@";
      if (c.list) {
        cell.fill = fill(C.ivoryDeep);
        cell.dataValidation = {
          type: "list", allowBlank: true, showInputMessage: true, showErrorMessage: true,
          formulae: [listRef[c.header]],
          promptTitle: c.header.replace(/\s*\*$/, ""), prompt: "Choose from the list",
          errorStyle: c.strict === false ? "warning" : "stop", errorTitle: "Please use the list", error: "Choose one of: " + c.list.join(", "),
        };
      } else if (c.number) {
        cell.dataValidation = { type: "whole", operator: "between", allowBlank: true, showErrorMessage: true, formulae: [c.number.min, c.number.max], errorStyle: "stop", errorTitle: c.header, error: "Enter a whole number from " + c.number.min + " to " + c.number.max + "." };
      } else if (c.decimal) {
        cell.numFmt = "#,##0.00";
        cell.dataValidation = { type: "decimal", operator: "greaterThanOrEqual", allowBlank: true, showErrorMessage: true, formulae: [0], errorStyle: "stop", errorTitle: c.header, error: "Enter an amount (numbers only, e.g. 1500 or 1500.50)." };
      } else if (c.date) {
        cell.numFmt = "yyyy-mm-dd";
        cell.dataValidation = { type: "date", operator: "greaterThan", allowBlank: true, showInputMessage: true, showErrorMessage: true, formulae: [new Date(Date.UTC(2020, 0, 1))], promptTitle: c.header, prompt: "Type a date, e.g. 2026-11-15 or 15/11/2026", errorStyle: "stop", errorTitle: c.header, error: "Please enter a valid date." };
      }
    });
  }

  // Instructions tab: an even 8-column grid, text rows spanning B:I
  const info = wb.addWorksheet("Instructions", { properties: { tabColor: { argb: C.gold } }, views: [{ showGridLines: false }], pageSetup: { orientation: "landscape", fitToPage: true, fitToWidth: 1, fitToHeight: 1, paperSize: 9 } });
  info.columns = [{ width: 3 }].concat(Array.from({ length: 8 }, () => ({ width: 19 })));
  let r = 2;
  const ink = { size: 11, color: { argb: C.ink } };
  const line = (text, font, height) => {
    info.mergeCells(r, 2, r, 9);
    const c = info.getRow(r).getCell(2);
    c.value = text; c.font = font; c.alignment = { vertical: "middle", wrapText: true, indent: 1 };
    info.getRow(r).height = height || 22; r++;
  };
  const pair = (label, value, height) => {
    info.mergeCells(r, 2, r, 3); info.mergeCells(r, 4, r, 9);
    const a = info.getRow(r).getCell(2), b = info.getRow(r).getCell(4);
    a.value = label; a.font = { bold: true, color: { argb: C.white } }; a.fill = fill(C.plum);
    b.value = value; b.font = ink;
    [a, b].forEach((c) => { c.alignment = { vertical: "middle", wrapText: true, indent: 1 }; });
    for (let col = 2; col <= 9; col++) info.getRow(r).getCell(col).border = GRID;
    info.getRow(r).height = height || (String(value).length > 90 ? 36 : 24); r++;
  };
  line("How to use this template", { size: 16, bold: true, color: { argb: C.plum } }, 30);
  r++;
  (spec.steps || []).forEach((t, i) => line((i + 1) + ".  " + t, ink));
  const lists = cols.filter((c) => c.list);
  if (lists.length) {
    r++;
    line("Dropdown options", { size: 13, bold: true, color: { argb: C.plum } }, 26);
    lists.forEach((c) => pair(c.header.replace(/\s*\*$/, ""), c.list.join("   ·   ")));
  }
  if (spec.notes && spec.notes.length) {
    r++;
    line("Good to know", { size: 13, bold: true, color: { argb: C.plum } }, 26);
    spec.notes.forEach(([k, v]) => pair(k, v));
  }
  if (spec.examples) {
    r++;
    line("Example rows — for reference only (they are not imported from this tab)", { size: 13, bold: true, color: { argb: C.plum } }, 26);
    const exCols = spec.examples.headers.length;
    for (let i = 0; i < exCols; i++) if (2 + i > 9) info.getColumn(2 + i).width = 19;
    spec.examples.headers.forEach((h, i) => { const c = info.getRow(r).getCell(2 + i); c.value = h; c.font = { bold: true, size: 10, color: { argb: C.white } }; c.fill = fill(C.plum2); c.alignment = { horizontal: "center", vertical: "middle", wrapText: true }; c.border = GRID; });
    info.getRow(r).height = 26; r++;
    spec.examples.rows.forEach((row) => {
      row.forEach((v, i) => { const c = info.getRow(r).getCell(2 + i); c.value = v; c.font = { size: 10, italic: true, color: { argb: C.muted } }; c.alignment = { horizontal: "center", vertical: "middle", wrapText: true }; c.border = GRID; });
      info.getRow(r).height = 22; r++;
    });
  }
  return Buffer.from(await wb.xlsx.writeBuffer());
}

// Report cells arrive as display strings; turn amounts and counts back into real
// numbers so Excel can sum and sort them. Phone-like columns stay text.
function typedCell(value, header) {
  const s = value == null ? "" : String(value);
  if (/phone|contact/i.test(header)) return { v: s };
  if (/^-?\d{1,3}(,\d{3})*\.\d{2}$/.test(s) || /^-?\d+\.\d{2}$/.test(s)) return { v: Number(s.replace(/,/g, "")), fmt: "#,##0.00" };
  if (/^-?\d{1,6}$/.test(s) && !/^0\d/.test(s)) return { v: Number(s), fmt: "0" };
  return { v: s };
}

/** Report: { title, subtitle, columns: [header...], rows: [[...]], sheet } */
async function buildReport(report) {
  const wb = new ExcelJS.Workbook();
  wb.creator = "Nyasha & Watson — Wedding Management Portal";
  wb.created = new Date();
  const cols = report.columns;
  const ws = newSheet(wb, report.sheet || "Report", cols.length, {});
  const generated = "Generated " + new Date().toLocaleString("en-GB", { timeZone: "Africa/Harare", day: "numeric", month: "short", year: "numeric", hour: "2-digit", minute: "2-digit" });
  titleBand(ws, cols.length, report.title, [EVENT_LINE, report.subtitle, generated].filter(Boolean).join("   ·   "));
  headerRow(ws, cols);

  report.rows.forEach((row, ri) => {
    const xr = ws.getRow(4 + ri);
    xr.height = 20;
    row.forEach((val, ci) => {
      const t = typedCell(val, cols[ci]);
      const cell = xr.getCell(ci + 1);
      cell.value = t.v;
      if (t.fmt) cell.numFmt = t.fmt;
      cell.font = { name: "Calibri", size: 11, color: { argb: C.ink } };
      cell.alignment = { vertical: "middle", horizontal: typeof t.v === "number" ? "right" : "left", indent: typeof t.v === "number" ? 0 : 1, wrapText: String(t.v).length > 60 };
      cell.border = GRID;
      if (ri % 2 === 1) cell.fill = fill("FFFCF9F4");
    });
  });
  if (!report.rows.length) {
    ws.mergeCells(4, 1, 4, cols.length);
    const c = ws.getRow(4).getCell(1);
    c.value = "Nothing to show yet.";
    c.font = { italic: true, color: { argb: C.muted } };
    c.alignment = { horizontal: "center", vertical: "middle" };
  }
  // widths from content (bounded) so nothing is cramped or absurdly wide
  cols.forEach((h, ci) => {
    let max = String(h).length;
    report.rows.forEach((row) => { max = Math.max(max, String(row[ci] == null ? "" : row[ci]).length); });
    ws.getColumn(ci + 1).width = Math.min(48, Math.max(12, max + 3));
  });
  return Buffer.from(await wb.xlsx.writeBuffer());
}

module.exports = { buildTemplate, buildReport };
