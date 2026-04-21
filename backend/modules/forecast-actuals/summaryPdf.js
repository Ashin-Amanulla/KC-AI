import PDFDocument from 'pdfkit';

/**
 * Build summary PDF buffer (landscape A4 table) — mirrors KC Studio ReportLab layout.
 */
export function buildSummaryPdf({ title, headers, rows, totalsRow }) {
  return new Promise((resolve, reject) => {
    const doc = new PDFDocument({
      size: 'A4',
      layout: 'landscape',
      margin: 36,
    });
    const chunks = [];
    doc.on('data', (c) => chunks.push(c));
    doc.on('error', reject);
    doc.on('end', () => resolve(Buffer.concat(chunks)));

    doc.fontSize(14).text(title, { align: 'center' });
    doc.moveDown(0.8);

    const tableTop = doc.y;
    const pageWidth = doc.page.width - doc.page.margins.left - doc.page.margins.right;
    const colWidths = [
      pageWidth * 0.28,
      pageWidth * 0.12,
      pageWidth * 0.12,
      pageWidth * 0.12,
      pageWidth * 0.12,
      pageWidth * 0.12,
      pageWidth * 0.12,
    ];
    const rowH = 22;
    let x = doc.page.margins.left;
    let y = tableTop;

    function drawRow(cells, opts = {}) {
      const { header = false, footer = false } = opts;
      x = doc.page.margins.left;
      if (y + rowH > doc.page.height - doc.page.margins.bottom) {
        doc.addPage({ size: 'A4', layout: 'landscape', margin: 36 });
        y = doc.page.margins.top;
      }
      doc.save();
      if (header) {
        doc.fillColor('#555555').rect(x, y, pageWidth, rowH).fill();
        doc.fillColor('#ffffff');
      } else if (footer) {
        doc.fillColor('#dddddd').rect(x, y, pageWidth, rowH).fill();
        doc.fillColor('#000000');
      } else {
        doc.fillColor('#f5f5dc').rect(x, y, pageWidth, rowH).fill();
        doc.fillColor('#000000');
      }
      doc.restore();

      doc.font(header || footer ? 'Helvetica-Bold' : 'Helvetica').fontSize(header ? 10 : 9);
      for (let i = 0; i < cells.length; i += 1) {
        const w = colWidths[i];
        const text = String(cells[i] ?? '');
        const align = i === 0 ? 'left' : 'right';
        doc.fillColor(header ? '#ffffff' : '#000000');
        doc.text(text, x + 4, y + 6, { width: w - 8, align });
        x += w;
      }
      doc.rect(doc.page.margins.left, y, pageWidth, rowH).stroke('#000000');
      y += rowH;
    }

    drawRow(headers, { header: true });
    for (const row of rows) {
      drawRow(row);
    }
    drawRow(totalsRow, { footer: true });

    doc.end();
  });
}
