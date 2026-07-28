/** Fortnight / week windows aligned with backend roster anchor (Australia/Brisbane). */

export const FORTNIGHT_ANCHOR = '2025-01-06';
export const DEFAULT_TIMEZONE = 'Australia/Brisbane';
const MS_PER_DAY = 86400000;

function startOfLocalDayUtc(isoDate, timeZone) {
  const [Y, M, D] = isoDate.split('-').map(Number);
  const calFmt = new Intl.DateTimeFormat('en-CA', {
    timeZone,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  });
  const center = Date.UTC(Y, M - 1, D, 12, 0, 0);
  for (let h = -36; h <= 36; h++) {
    const cand = center + h * 3600000;
    if (calFmt.format(new Date(cand)) !== isoDate) continue;
    let start = cand;
    while (start > center - 49 * MS_PER_DAY) {
      const prev = start - 60000;
      if (calFmt.format(new Date(prev)) !== isoDate) break;
      start = prev;
    }
    return start;
  }
  throw new Error(`startOfLocalDayUtc: could not resolve ${isoDate} in ${timeZone}`);
}

function getFortnightContaining(anchorUtcMs, atUtcMs) {
  const fortnightMs = 14 * MS_PER_DAY;
  const index = Math.floor((atUtcMs - anchorUtcMs) / fortnightMs);
  const startUtc = anchorUtcMs + index * fortnightMs;
  return { startUtc, endUtc: startUtc + fortnightMs, index };
}

function formatLocalDate(utcMs, timeZone) {
  return new Intl.DateTimeFormat('en-CA', {
    timeZone,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).format(new Date(utcMs));
}

function getIsoWeekContaining(atUtcMs, timeZone) {
  const localDate = formatLocalDate(atUtcMs, timeZone);
  const d = new Date(`${localDate}T12:00:00Z`);
  const day = d.getUTCDay();
  const diffToMon = day === 0 ? -6 : 1 - day;
  const monday = new Date(d);
  monday.setUTCDate(d.getUTCDate() + diffToMon);
  const monIso = monday.toISOString().slice(0, 10);
  const startUtc = startOfLocalDayUtc(monIso, timeZone);
  return { startUtc, endUtc: startUtc + 7 * MS_PER_DAY };
}

/** @returns {{ fromDate: string, toDate: string, label: string, index?: number, mode: string }} */
export function getPeriodWindow(mode, { customFrom, customTo, anchor = FORTNIGHT_ANCHOR, timeZone = DEFAULT_TIMEZONE } = {}) {
  const now = Date.now();
  if (mode === 'custom') {
    const fromDate = customFrom || formatLocalDate(now, timeZone);
    const toDate = customTo || fromDate;
    return { fromDate, toDate, label: `${fromDate} – ${toDate}`, mode: 'custom' };
  }
  if (mode === 'week') {
    const { startUtc, endUtc } = getIsoWeekContaining(now, timeZone);
    const fromDate = formatLocalDate(startUtc, timeZone);
    const toDate = formatLocalDate(endUtc - MS_PER_DAY, timeZone);
    return { fromDate, toDate, label: `Week ${fromDate} – ${toDate}`, mode: 'week' };
  }
  const anchorUtc = startOfLocalDayUtc(anchor, timeZone);
  const { startUtc, endUtc, index } = getFortnightContaining(anchorUtc, now);
  const fromDate = formatLocalDate(startUtc, timeZone);
  const toDate = formatLocalDate(endUtc - MS_PER_DAY, timeZone);
  return {
    fromDate,
    toDate,
    label: `Fortnight ${index + 1} · ${fromDate} – ${toDate}`,
    index,
    mode: 'fortnight',
  };
}

export function toTimesheetRange(fromDate, toDate) {
  return {
    from: `${fromDate}T00:00:00Z`,
    to: `${toDate}T23:59:59Z`,
  };
}

export const SHIFTCARE_SCHEDULER_URL = 'https://app.shiftcare.com/users/scheduler';
