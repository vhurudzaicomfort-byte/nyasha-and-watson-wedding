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

function buildReportPdf({ title, columns, rows, columnWeights, subtitle }) {
  return new Promise((resolve, reject) => {
    const doc = new PDFDocument({ size: "A4", margin: 40, bufferPages: true });
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
      doc.font("Script").fontSize(32).fillColor(COLOR.plum)
        .text("Nyasha & Watson", marginLeft, doc.y, { width: pageWidth, align: "center" });
      doc.moveDown(0.1);
      doc.font("Body").fontSize(9).fillColor(COLOR.plum2)
        .text("Saturday, 5 December 2026  ·  Colne Valley Nature Reserve Park, Harare", marginLeft, doc.y, { width: pageWidth, align: "center" });
      doc.moveDown(0.5);
      const ruleY = doc.y;
      doc.moveTo(marginLeft, ruleY).lineTo(marginLeft + pageWidth, ruleY).lineWidth(1).strokeColor(COLOR.gold).stroke();
      doc.moveDown(0.6);
      doc.font("DisplayBold").fontSize(15).fillColor(COLOR.plum)
        .text(title.toUpperCase(), marginLeft, doc.y, { width: pageWidth, align: "center", characterSpacing: 1 });
      if (subtitle) {
        doc.moveDown(0.1);
        doc.font("Body").fontSize(9).fillColor(COLOR.muted).text(subtitle, marginLeft, doc.y, { width: pageWidth, align: "center" });
      }
      doc.moveDown(0.1);
      doc.font("Body").fontSize(8).fillColor(COLOR.muted)
        .text("Generated " + new Date().toLocaleString("en-GB", { dateStyle: "medium", timeStyle: "short" }), marginLeft, doc.y, { width: pageWidth, align: "center" });
      doc.moveDown(0.8);
    }

    drawLetterhead();

    const weights = columnWeights && columnWeights.length === columns.length ? columnWeights : columns.map(() => 1);
    const weightSum = weights.reduce((a, b) => a + b, 0);
    const colWidths = weights.map((w) => (w / weightSum) * pageWidth);
    const colX = [];
    let acc = marginLeft;
    colWidths.forEach((w) => { colX.push(acc); acc += w; });

    const rowHeight = 22;
    const cellPad = 6;

    function drawGrid(y, h) {
      doc.strokeColor(COLOR.border).lineWidth(0.5);
      doc.moveTo(marginLeft, y + h).lineTo(marginLeft + pageWidth, y + h).stroke();
      for (let i = 0; i <= colX.length; i++) {
        const x = i < colX.length ? colX[i] : marginLeft + pageWidth;
        doc.moveTo(x, y).lineTo(x, y + h).stroke();
      }
    }

    function drawHeaderRow(y) {
      doc.rect(marginLeft, y, pageWidth, rowHeight).fill(COLOR.plum);
      doc.fillColor(COLOR.white).font("BodyMedium").fontSize(8.5);
      columns.forEach((col, i) => {
        doc.text(String(col).toUpperCase(), colX[i] + cellPad, y + 7, { width: colWidths[i] - cellPad * 2, height: rowHeight - 6, ellipsis: true });
      });
      drawGrid(y, rowHeight);
      return y + rowHeight;
    }

    let y = doc.y;
    doc.y = y;
    y = drawHeaderRow(y);

    rows.forEach((r, idx) => {
      if (y + rowHeight > bottomLimit) {
        doc.addPage();
        drawLetterhead();
        y = doc.y;
        y = drawHeaderRow(y);
      }
      if (idx % 2 === 1) doc.rect(marginLeft, y, pageWidth, rowHeight).fill(COLOR.rowAlt);
      doc.fillColor(COLOR.plum2).font("Body").fontSize(8.5);
      r.forEach((cell, i) => {
        doc.text(String(cell == null ? "" : cell), colX[i] + cellPad, y + 7, { width: colWidths[i] - cellPad * 2, height: rowHeight - 6, ellipsis: true });
      });
      drawGrid(y, rowHeight);
      y += rowHeight;
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
