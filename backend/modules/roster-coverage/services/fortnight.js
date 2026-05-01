/**
 * Fortnight periods: 14-day windows from a configurable anchor (local calendar day in org TZ).
 * All boundary math uses UTC instants derived from calendar dates in the given IANA timezone.
 */

const MS_PER_DAY = 86400000;

/**
 * @param {string} isoDate - 'YYYY-MM-DD' (anchor start of day meaning is interpreted in tz)
 * @param {string} timeZone - IANA e.g. Australia/Brisbane
 * @returns {number} UTC ms at start of that local calendar day in tz
 */
export function startOfLocalDayUtc(isoDate, timeZone) {
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

/**
 * @param {number} atUtcMs
 * @param {number} anchorUtcMs - start of anchor local day (inclusive)
 * @returns {{ startUtc: number, endUtc: number, index: number }}
 */
export function getFortnightContaining(anchorUtcMs, atUtcMs) {
  const diffMs = atUtcMs - anchorUtcMs;
  const fortnightMs = 14 * MS_PER_DAY;
  const index = Math.floor(diffMs / fortnightMs);
  const startUtc = anchorUtcMs + index * fortnightMs;
  const endUtc = startUtc + fortnightMs;
  return { startUtc, endUtc, index };
}

/**
 * Local calendar date string YYYY-MM-DD in timeZone for instant.
 * @param {number} utcMs
 * @param {string} timeZone
 */
export function formatLocalDate(utcMs, timeZone) {
  return new Intl.DateTimeFormat('en-CA', {
    timeZone,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).format(new Date(utcMs));
}
