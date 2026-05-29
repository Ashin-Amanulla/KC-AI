import { parseDate } from './csvForecastActuals.js';

/** Parse YYYY-MM-DD (HTML date input) or existing CSV date formats. */
export function parseScopeDateParam(s) {
  if (!s || String(s).trim() === '') return null;
  const trimmed = String(s).trim();
  if (/^\d{4}-\d{2}-\d{2}$/.test(trimmed)) {
    return new Date(`${trimmed}T00:00:00.000Z`);
  }
  return parseDate(trimmed);
}

export function endOfUtcDay(d) {
  return new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate(), 23, 59, 59, 999));
}

/** Add shiftDate $gte / $lte on a Mongo filter object (UTC, inclusive). */
export function applyShiftDateRange(q, dateFrom, dateTo) {
  const from = parseScopeDateParam(dateFrom);
  const to = parseScopeDateParam(dateTo);
  if (!from && !to) return;
  q.shiftDate = {};
  if (from) q.shiftDate.$gte = from;
  if (to) q.shiftDate.$lte = endOfUtcDay(to);
}

/** When user sets a range, use it; otherwise fall back to data min/max. */
export function resolveForecastRangeFromFilter(dateFrom, dateTo, dataMin, dataMax) {
  const from = parseScopeDateParam(dateFrom);
  const to = parseScopeDateParam(dateTo);
  if (!from && !to) {
    return { start: dataMin ?? null, end: dataMax ?? null };
  }
  return {
    start: from || dataMin || null,
    end: (to ? endOfUtcDay(to) : null) || dataMax || null,
  };
}
