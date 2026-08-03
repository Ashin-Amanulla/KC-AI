/**
 * Standard Forecast CSV parsing — ported from KC Studio standard_forecast_service.py
 */

export const REQUIRED_CSV_COLUMNS = new Set([
  'client name',
  'day',
  'start date time',
  'end date time',
  'duration',
  'total cost',
]);

export const COLUMN_ALIASES = {
  name: 'client name',
  client: 'client name',
  'start time': 'start date time',
  start: 'start date time',
  'end time': 'end date time',
  end: 'end date time',
  hours: 'duration',
  cost: 'total cost',
  'rate group': 'rate groups',
  'rate groups': 'rate groups',
  'reference number': 'reference no',
  'reference no': 'reference no',
  'shift type': 'shift type',
  ratio: 'ratio',
};

export function normalizeColumnName(name) {
  const normalized = String(name || '')
    .trim()
    .toLowerCase()
    .replace(/\s+/g, ' ');
  return COLUMN_ALIASES[normalized] ?? normalized;
}

export function buildNormalizedColumns(fieldnames) {
  const map = new Map();
  for (const col of fieldnames) {
    const n = normalizeColumnName(col);
    map.set(n, col);
  }
  return map;
}

export function validateHeaders(normalizedKeys) {
  const missing = [...REQUIRED_CSV_COLUMNS].filter((k) => !normalizedKeys.has(k));
  if (missing.length) {
    return [`Missing required columns: ${missing.join(', ')}`];
  }
  return [];
}

export function getRowValue(row, colName, normalizedColumns) {
  const original = normalizedColumns.get(colName);
  if (!original) return '';
  const v = row[original];
  return v == null ? '' : String(v).trim();
}

/** Parse time strings: HH:MM, H:MM, or 12h with optional seconds (e.g. 6:00:00 AM) */
export function parseTime(timeStr) {
  const s = String(timeStr || '')
    .trim()
    .replace(/\s+/g, ' ');
  if (!s) return null;

  const m12 = s.match(/^(\d{1,2}):(\d{2})(?::\d{2})?\s*(am|pm)$/i);
  if (m12) {
    let h = parseInt(m12[1], 10);
    const min = parseInt(m12[2], 10);
    const ampm = m12[3].toLowerCase();
    if (h < 1 || h > 12 || min < 0 || min > 59) return null;
    if (ampm === 'am') {
      if (h === 12) h = 0;
    } else if (h !== 12) {
      h += 12;
    }
    return `${String(h).padStart(2, '0')}:${String(min).padStart(2, '0')}`;
  }

  const m24 = s.match(/^(\d{1,2}):(\d{2})(?::\d{2})?$/);
  if (m24) {
    const h = parseInt(m24[1], 10);
    const min = parseInt(m24[2], 10);
    if (h >= 0 && h <= 23 && min >= 0 && min <= 59) {
      return `${String(h).padStart(2, '0')}:${String(min).padStart(2, '0')}`;
    }
  }
  return null;
}

export function parseDecimal(value) {
  let v = String(value || '').trim();
  if (!v) return null;
  v = v.replace(/\$/g, '').replace(/,/g, '');
  v = v.replace(/\s*hrs?\s*$/i, '');
  const n = parseFloat(v);
  return Number.isFinite(n) ? n : null;
}

export { roundMoney } from '../forecast-actuals/csvForecastActuals.js';
