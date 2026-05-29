import * as XLSX from 'xlsx';

export function resolveExportFormat(format) {
  const f = String(format || 'csv').toLowerCase();
  if (f === 'xlsx' || f === 'excel') return 'xlsx';
  return 'csv';
}

function csvEscapeCell(value) {
  const s = String(value ?? '');
  if (s.includes(',') || s.includes('"') || s.includes('\n') || s.includes('\r')) {
    return `"${s.replace(/"/g, '""')}"`;
  }
  return s;
}

/** Build CSV or XLSX download payload from header row + data rows. */
export function buildTabularExport({ headers, rows, baseFilename, format = 'csv' }) {
  const fmt = resolveExportFormat(format);
  const base = String(baseFilename || 'export').replace(/\.(csv|xlsx)$/i, '');

  if (fmt === 'xlsx') {
    const sheetData = [headers, ...rows];
    const worksheet = XLSX.utils.aoa_to_sheet(sheetData);
    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(workbook, worksheet, 'Export');
    const body = XLSX.write(workbook, { type: 'buffer', bookType: 'xlsx' });
    return {
      filename: `${base}.xlsx`,
      body,
      contentType: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    };
  }

  const lines = [
    headers.map(csvEscapeCell).join(','),
    ...rows.map((row) => row.map((cell) => csvEscapeCell(cell)).join(',')),
  ];
  return {
    filename: `${base}.csv`,
    body: Buffer.from('\uFEFF' + lines.join('\n'), 'utf-8'),
    contentType: 'text/csv; charset=utf-8',
  };
}

export function sendTabularExport(res, { filename, body, contentType }) {
  res.setHeader('Content-Type', contentType);
  res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
  res.send(body);
}
