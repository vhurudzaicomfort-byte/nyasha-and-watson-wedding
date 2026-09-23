// Branded PDF reports: a letterhead matching the invitation's visual identity,
// then a bordered, gridded table. Built with pdfkit (pure JS, no native deps).
const PDFDocument = require("pdfkit");
const path = require("path");

const FONTS_DIR = path.join(__dirname, "..", "assets", "fonts");

const COLOR = {
  plum: "#3E1730",
  plum2: "#5A2444",
  gold: "#B08A46",
  muted: "#8B7A6E",
  border: "#D8C6A8",
  rowAlt: "#FBF3E4",
  white: "#FFFFFF",
};

function buildReportPdf({ title, columns, rows, columnWeights, subtitle, landscape }) {
  return new Promise((resolve, reject) => {
    const doc = new PDFDocument({ size: "A4", layout: landscape ? "landscape" : "portrait", margin: 40, bufferPages: true });
    const chunks = [];
    doc.on("data", (c) => chunks.push(c));
    doc.on("end", () => resolve(Buffer.concat(chunks)));
    doc.on("error", reject);

    doc.registerFont("Script", path.join(FONTS_DIR, "GreatVibes-Regular.ttf"));
    doc.registerFont("DisplayBold", path.join(FONTS_DIR, "BodoniModa_28pt-Bold.ttf"));
    doc.registerFont("Body", path.join(FONTS_DIR, "Poppins-Regular.ttf"));
    doc.registerFont("BodyMedium", path.join(FONTS_DIR, "Poppins-Medium.ttf"));

    const marginLeft = doc.page.margins.left;
    const marginRight = doc.page.margins.right;
    const pageWidth = doc.page.width - marginLeft - marginRight;
    const bottomLimit = doc.page.height - doc.page.margins.bottom;

    function drawLetterhead() {
      doc.font("Body").fontSize(8).fillColor(COLOR.muted)
        .text("TOGETHER WITH THEIR FAMILIES", marginLeft, doc.y, { width: pageWidth, align: "center", characterSpacing: 2 });
      doc.moveDown(0.3);
      doc.font("Script").fontSize(28).fillColor(COLOR.plum)
        .text("Nyasha & Watson", marginLeft, doc.y, { width: pageWidth, align: "center" });
      doc.moveDown(0.1);
      doc.font("Body").fontSize(9).fillColor(COLOR.plum2)
        .text("Saturday, 5 December 2026  ·  Colne Valley Nature Reserve Park, Harare", marginLeft, doc.y, { width: pageWidth, align: "center" });
      doc.moveDown(0.4);
      const ruleY = doc.y;
      doc.moveTo(marginLeft, ruleY).lineTo(marginLeft + pageWidth, ruleY).lineWidth(1).strokeColor(COLOR.gold).stroke();
      doc.moveDown(0.5);
      doc.font("DisplayBold").fontSize(14).fillColor(COLOR.plum)
        .text(title.toUpperCase(), marginLeft, doc.y, { width: pageWidth, align: "center", characterSpacing: 1 });
      if (subtitle) {
        doc.moveDown(0.1);
        doc.font("Body").fontSize(9).fillColor(COLOR.muted).text(subtitle, marginLeft, doc.y, { width: pageWidth, align: "center" });
      }
      doc.moveDown(0.1);
      doc.font("Body").fontSize(8).fillColor(COLOR.muted)
        .text("Generated " + new Date().toLocaleString("en-GB", { dateStyle: "medium", timeStyle: "short" }), marginLeft, doc.y, { width: pageWidth, align: "center" });
      doc.moveDown(0.6);
    }

    drawLetterhead();

    const weights = columnWeights && columnWeights.length === columns.length ? columnWeights : columns.map(() => 1);
    const weightSum = weights.reduce((a, b) => a + b, 0);
    const colWidths = weights.map((w) => (w / weightSum) * pageWidth);
    const colX = [];
    let acc = marginLeft;
    colWidths.forEach((w) => { colX.push(acc); acc += w; });

    const cellPad = 6;
    const minRowHeight = 20;

    function drawGrid(y, h) {
      doc.strokeColor(COLOR.border).lineWidth(0.5);
      doc.moveTo(marginLeft, y + h).lineTo(marginLeft + pageWidth, y + h).stroke();
      for (let i = 0; i <= colX.length; i++) {
        const x = i < colX.length ? colX[i] : marginLeft + pageWidth;
        doc.moveTo(x, y).lineTo(x, y + h).stroke();
      }
    }

    // Full text always wraps (never truncates) — row height grows to fit the tallest cell.
    function rowHeightFor(cells, font, fontSize) {
      doc.font(font).fontSize(fontSize);
      let h = minRowHeight;
      cells.forEach((cell, i) => {
        const text = String(cell == null ? "" : cell);
        if (!text) return;
        const measured = doc.heightOfString(text, { width: colWidths[i] - cellPad * 2 });
        h = Math.max(h, measured + cellPad * 2);
      });
      return h;
    }

    function drawHeaderRow(y) {
      const upper = columns.map((c) => String(c).toUpperCase());
      const h = rowHeightFor(upper, "BodyMedium", 8.5);
      doc.rect(marginLeft, y, pageWidth, h).fill(COLOR.plum);
      doc.fillColor(COLOR.white).font("BodyMedium").fontSize(8.5);
      upper.forEach((col, i) => {
        doc.text(col, colX[i] + cellPad, y + cellPad, { width: colWidths[i] - cellPad * 2 });
      });
      drawGrid(y, h);
      return y + h;
    }

    let y = doc.y;
    doc.y = y;
    y = drawHeaderRow(y);

    rows.forEach((r, idx) => {
      const h = rowHeightFor(r, "Body", 8.5);
      if (y + h > bottomLimit) {
        doc.addPage();
        drawLetterhead();
        y = doc.y;
        y = drawHeaderRow(y);
      }
      if (idx % 2 === 1) doc.rect(marginLeft, y, pageWidth, h).fill(COLOR.rowAlt);
      doc.fillColor(COLOR.plum2).font("Body").fontSize(8.5);
      r.forEach((cell, i) => {
        doc.text(String(cell == null ? "" : cell), colX[i] + cellPad, y + cellPad, { width: colWidths[i] - cellPad * 2 });
      });
      drawGrid(y, h);
      y += h;
    });

    if (!rows.length) {
      doc.font("Body").fontSize(9).fillColor(COLOR.muted).text("No records yet.", marginLeft, y + 12, { width: pageWidth, align: "center" });
    }

    // Footer with page numbers
    const range = doc.bufferedPageRange();
    for (let i = range.start; i < range.start + range.count; i++) {
      doc.switchToPage(i);
      doc.font("Body").fontSize(7.5).fillColor(COLOR.muted)
        .text("Nyasha & Watson · " + (i + 1) + " of " + range.count, marginLeft, doc.page.height - doc.page.margins.bottom + 10, { width: pageWidth, align: "center", height: 20, lineBreak: false });
    }

    doc.end();
  });
}

module.exports = { buildReportPdf };
