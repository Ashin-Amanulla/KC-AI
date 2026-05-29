import path from 'path';
import { parse } from 'csv-parse/sync';
import * as XLSX from 'xlsx';

const XLSX_EXTENSIONS = new Set(['.xlsx', '.xls']);
const CSV_EXTENSIONS = new Set(['.csv']);

export function getFileExtension(filename = '') {
  return path.extname(String(filename)).toLowerCase();
}

export function isSpreadsheetFilename(filename = '') {
  const ext = getFileExtension(filename);
  return XLSX_EXTENSIONS.has(ext) || CSV_EXTENSIONS.has(ext);
}

function normalizeRowObjects(rows) {
  return rows
    .map((row) => {
      const out = {};
      for (const [key, value] of Object.entries(row || {})) {
        const k = String(key ?? '').trim();
        if (!k) continue;
        if (value == null || value === '') {
          out[k] = '';
        } else if (typeof value === 'string') {
          out[k] = value.trim();
        } else {
          out[k] = value;
        }
      }
      return out;
    })
    .filter((row) => Object.values(row).some((v) => String(v ?? '').trim() !== ''));
}

/** Parse CSV or Excel upload into row objects (same shape as csv-parse columns:true). */
export function parseTabularBuffer(buffer, filename = '') {
  const ext = getFileExtension(filename);

  if (XLSX_EXTENSIONS.has(ext)) {
    const workbook = XLSX.read(buffer, { type: 'buffer', cellDates: true });
    const sheetName = workbook.SheetNames[0];
    if (!sheetName) return [];
    const sheet = workbook.Sheets[sheetName];
    const rows = XLSX.utils.sheet_to_json(sheet, { defval: '', raw: false });
    return normalizeRowObjects(rows);
  }

  const records = parse(buffer, {
    columns: true,
    skip_empty_lines: true,
    trim: true,
    bom: true,
    relax_column_count: true,
  });
  return normalizeRowObjects(records);
}
