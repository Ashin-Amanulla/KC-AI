/**
 * Expand recurring holiday definitions to concrete YYYY-MM-DD (UTC) for a calendar year.
 * Used for Easter and "nth weekday in month" public holidays.
 */

/** Easter Sunday: Gregorian, Anonymous Gregorian algorithm. Returns { month: 1-12, day: 1-31 } */
export function easterSundayMonthDay(year) {
  const a = year % 19;
  const b = Math.floor(year / 100);
  const c = year % 100;
  const d = Math.floor(b / 4);
  const e = b % 4;
  const f = Math.floor((b + 8) / 25);
  const g = Math.floor((b - f + 1) / 3);
  const h = (19 * a + b - d - g + 15) % 30;
  const i = Math.floor(c / 4);
  const k = c % 4;
  const l = (32 + 2 * e + 2 * i - h - k) % 7;
  const m = Math.floor((a + 11 * h + 22 * l) / 451);
  const month = Math.floor((h + l - 7 * m + 114) / 31);
  const day = ((h + l - 7 * m + 114) % 31) + 1;
  return { month, day };
}

export function ymdUTC(year, month, day) {
  const d = new Date(Date.UTC(year, month - 1, day));
  return `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, '0')}-${String(d.getUTCDate()).padStart(2, '0')}`;
}

/** Offset in days from Easter Sunday (Sun=0, Fri=-2, Mon=+1). */
export function easterOffsetDate(year, offsetFromSunday) {
  const e = easterSundayMonthDay(year);
  const d = new Date(Date.UTC(year, e.month - 1, e.day));
  d.setUTCDate(d.getUTCDate() + offsetFromSunday);
  return ymdUTC(d.getUTCFullYear(), d.getUTCMonth() + 1, d.getUTCDate());
}

/** weekday: 0=Sun … 6=Sat. n: 1=first … 5=fifth */
export function nthWeekdayInMonthUTC(year, month1to12, weekday0to6, n) {
  let count = 0;
  for (let day = 1; day <= 31; day++) {
    const d = new Date(Date.UTC(year, month1to12 - 1, day));
    if (d.getUTCMonth() !== month1to12 - 1) break;
    if (d.getUTCDay() === weekday0to6) {
      count += 1;
      if (count === n) {
        return ymdUTC(d.getUTCFullYear(), d.getUTCMonth() + 1, d.getUTCDate());
      }
    }
  }
  return null;
}

export function lastWeekdayInMonthUTC(year, month1to12, weekday0to6) {
  const lastD = new Date(Date.UTC(year, month1to12, 0)).getUTCDate();
  for (let day = lastD; day >= 1; day--) {
    const d = new Date(Date.UTC(year, month1to12 - 1, day));
    if (d.getUTCDay() === weekday0to6) {
      return ymdUTC(d.getUTCFullYear(), d.getUTCMonth() + 1, d.getUTCDate());
    }
  }
  return null;
}

/**
 * @param {string|null} rule
 * @param {number} year
 * @returns {string|null} "YYYY-MM-DD" or null
 */
export function resolveRuleToYmdUTC(rule, year) {
  if (!rule) return null;
  switch (rule) {
    case 'good_friday':
      return easterOffsetDate(year, -2);
    case 'easter_saturday':
      return easterOffsetDate(year, -1);
    case 'easter_sunday':
      return easterOffsetDate(year, 0);
    case 'easter_monday':
      return easterOffsetDate(year, 1);
    case 'first_monday_march':
      return nthWeekdayInMonthUTC(year, 3, 1, 1);
    case 'first_monday_may':
      return nthWeekdayInMonthUTC(year, 5, 1, 1);
    case 'first_monday_june':
      return nthWeekdayInMonthUTC(year, 6, 1, 1);
    case 'first_monday_august':
      return nthWeekdayInMonthUTC(year, 8, 1, 1);
    case 'first_monday_october':
      return nthWeekdayInMonthUTC(year, 10, 1, 1);
    case 'second_monday_march':
      return nthWeekdayInMonthUTC(year, 3, 1, 2);
    case 'second_monday_june':
      return nthWeekdayInMonthUTC(year, 6, 1, 2);
    case 'first_tuesday_november':
      return nthWeekdayInMonthUTC(year, 11, 2, 1);
    case 'second_wednesday_august':
      return nthWeekdayInMonthUTC(year, 8, 3, 2);
    case 'last_monday_september':
      return lastWeekdayInMonthUTC(year, 9, 1);
    default:
      return null;
  }
}

/**
 * @param {object} h - { month, day, rule }
 * @param {number} year
 * @returns {string} YYYY-MM-DD
 */
export function holidayToYmdUTC(h, year) {
  if (h.rule) {
    const y = resolveRuleToYmdUTC(h.rule, year);
    if (y) return y;
  }
  if (h.month && h.day) {
    return ymdUTC(year, h.month, h.day);
  }
  return null;
}
