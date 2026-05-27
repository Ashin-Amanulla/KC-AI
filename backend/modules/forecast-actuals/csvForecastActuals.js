/**
 * Forecast / Actuals CSV parsing — ported from KC Studio forecast_actuals_service.py
 */

/** Required columns for forecast/actuals CSV (total cost may be omitted if cost is present). */
export const REQUIRED_CSV_COLUMNS = new Set([
  'client name',
  'date',
  'start date time',
  'end date time',
  'duration',
  'cost',
]);

export const OPTIONAL_CSV_COLUMNS = new Set(['total cost']);

export const COLUMN_ALIASES = {
  name: 'client name',
  client: 'client name',
  'staff name': 'staff',
  'shift id': 'shift id',
  shift: 'shift',
  'start time': 'start date time',
  start: 'start date time',
  'end time': 'end date time',
  end: 'end date time',
  hours: 'duration',
  'additional cost': 'additional cost',
  kms: 'kms',
  absent: 'absent',
  status: 'status',
  'invoice nos.': 'invoice nos.',
  'invoice numbers': 'invoice nos.',
  'rate groups': 'rate groups',
  'reference no': 'reference no',
  'shift type': 'shift type',
  'additional shift type': 'additional shift type',
  'client type': 'client type',
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
  if (!normalizedKeys.has('total cost') && !normalizedKeys.has('cost')) {
    return ['Missing required columns: cost'];
  }
  return [];
}

export function getRowValue(row, colName, normalizedColumns) {
  const original = normalizedColumns.get(colName);
  if (!original) return '';
  const v = row[original];
  return v == null ? '' : String(v).trim();
}

/** True when the row has no non-whitespace values (trailing blank CSV lines). */
export function isBlankCsvRow(row) {
  return !Object.values(row).some((v) => String(v ?? '').trim() !== '');
}

/** Fix common export glitches like "6  4:00:00 PM" → "4:00:00 PM". */
export function normalizeTimeInput(timeStr) {
  let s = String(timeStr || '')
    .trim()
    .replace(/\s+/g, ' ');
  const stray = s.match(/^(\d{1,2})\s+(\d{1,2}:\d{2}(?::\d{2})?\s*(?:am|pm)?)$/i);
  if (stray) s = stray[2];
  return s;
}

function utcDateValid(y, m0, d) {
  if (m0 < 0 || m0 > 11 || d < 1 || d > 31) return null;
  const dt = new Date(Date.UTC(y, m0, d));
  if (dt.getUTCFullYear() !== y || dt.getUTCMonth() !== m0 || dt.getUTCDate() !== d) return null;
  return dt;
}

export function parseDate(dateStr) {
  const s = String(dateStr || '').trim();
  if (!s) return null;

  if (/^\d{4}-\d{2}-\d{2}/.test(s)) {
    const d = new Date(s.slice(0, 10) + 'T12:00:00.000Z');
    if (!Number.isNaN(d.getTime())) return d;
  }

  const slash4 = /^(\d{1,2})\/(\d{1,2})\/(\d{4})$/;
  let m = s.match(slash4);
  if (m) {
    const a = parseInt(m[1], 10);
    const b = parseInt(m[2], 10);
    const yy = parseInt(m[3], 10);
    let dt = utcDateValid(yy, a - 1, b);
    if (dt) return dt;
    dt = utcDateValid(yy, b - 1, a);
    if (dt) return dt;
    return null;
  }

  const slash2 = /^(\d{1,2})\/(\d{1,2})\/(\d{2})$/;
  m = s.match(slash2);
  if (m) {
    const a = parseInt(m[1], 10);
    const b = parseInt(m[2], 10);
    let yy = parseInt(m[3], 10);
    yy += yy >= 70 ? 1900 : 2000;
    let dt = utcDateValid(yy, a - 1, b);
    if (dt) return dt;
    dt = utcDateValid(yy, b - 1, a);
    if (dt) return dt;
  }

  return null;
}

/** Parse time-only strings: HH:MM, H:MM, or 12h with optional seconds (e.g. 6:00:00 AM). */
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

/**
 * Parse a datetime string, or combine shift date with a time-only value.
 */
export function combineDateAndTime(shiftDate, timeStr) {
  const cleaned = normalizeTimeInput(timeStr);
  const full = parseDateTime(cleaned);
  if (full) return full;

  const timeNorm = parseTime(cleaned);
  if (!timeNorm || !shiftDate) return null;

  const [hh, mm] = timeNorm.split(':').map((x) => parseInt(x, 10));
  return new Date(
    Date.UTC(
      shiftDate.getUTCFullYear(),
      shiftDate.getUTCMonth(),
      shiftDate.getUTCDate(),
      hh,
      mm,
      0
    )
  );
}

export function parseDateTime(dtStr) {
  const s0 = String(dtStr || '').trim();
  if (!s0) return null;

  let s = s0.replace(' +', '+');
  const isoTry = new Date(s);
  if (!Number.isNaN(isoTry.getTime()) && s.includes('-') && s.length >= 16) {
    return isoTry;
  }

  const au24 = /^(\d{1,2})\/(\d{1,2})\/(\d{4})\s+(\d{1,2}):(\d{2})$/;
  let m = s.match(au24);
  if (m) {
    const dd = parseInt(m[1], 10);
    const mm = parseInt(m[2], 10);
    const yy = parseInt(m[3], 10);
    const hh = parseInt(m[4], 10);
    const mi = parseInt(m[5], 10);
    return new Date(Date.UTC(yy, mm - 1, dd, hh, mi, 0));
  }

  const lower = s.toLowerCase();
  const au12 = /^(\d{1,2})\/(\d{1,2})\/(\d{4})\s+(\d{1,2}):(\d{2})\s*(am|pm)$/;
  m = lower.match(au12);
  if (m) {
    const dd = parseInt(m[1], 10);
    const mm = parseInt(m[2], 10);
    const yy = parseInt(m[3], 10);
    let hh = parseInt(m[4], 10);
    const mi = parseInt(m[5], 10);
    const ap = m[6];
    if (ap === 'pm' && hh < 12) hh += 12;
    if (ap === 'am' && hh === 12) hh = 0;
    return new Date(Date.UTC(yy, mm - 1, dd, hh, mi, 0));
  }

  const usShort = /^(\d{1,2})\/(\d{1,2})\/(\d{2})\s+(\d{1,2}):(\d{2})$/;
  m = s.match(usShort);
  if (m) {
    const mm = parseInt(m[1], 10);
    const dd = parseInt(m[2], 10);
    let yy = parseInt(m[3], 10);
    yy += yy >= 70 ? 1900 : 2000;
    const hh = parseInt(m[4], 10);
    const mi = parseInt(m[5], 10);
    return new Date(Date.UTC(yy, mm - 1, dd, hh, mi, 0));
  }

  return null;
}

export function parseDecimal(value) {
  let v = String(value || '').trim();
  if (!v) return null;
  v = v.replace(/\$/g, '').replace(/,/g, '');
  v = v.replace(/\s*hrs?\s*$/i, '').replace(/hrs?/gi, '');
  const n = Number.parseFloat(v);
  return Number.isFinite(n) ? n : null;
}

export function parseBoolean(value) {
  const v = String(value || '').trim().toLowerCase();
  return v === 'yes' || v === 'true' || v === '1';
}

export function roundMoney(n) {
  return Math.round(n * 100) / 100;
}

export function moneyEqual(a, b) {
  return roundMoney(Number(a)) === roundMoney(Number(b));
}
