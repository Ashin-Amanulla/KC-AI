/**
 * Pay Hours Calculator
 *
 * Pure JavaScript port of the Python pay hours calculation algorithm from:
 *   kc_studio/app/pay_hours/services/pay_hours_service.py
 *
 * All functions are pure (no I/O, no DB access) and take plain objects.
 * Hours are stored as numbers with 2dp precision via r2().
 */

// ─── CONSTANTS ───────────────────────────────────────────────────────────────

const MORNING_START = 6;             // 06:00 local
const AFTERNOON_START = 20;          // 20:00 local
const CHRISTMAS_EVE_MONTH = 12;
const CHRISTMAS_EVE_DAY = 24;
const CHRISTMAS_EVE_HOLIDAY_START = 18; // 18:00 local
/** Max ordinary hours in a shift before daily OT (Sat/Sun/PH). */
const MAX_REGULAR_HOURS = 10;
/** Weekday: ordinary hours in a shift before daily OT (same cap as Sat/Sun/PH). */
const MAX_REGULAR_HOURS_WEEKDAY = 10;
const SLEEPOVER_DEDUCTION = 8;
/** Max ms gap after a sleepover that still "attaches" the next PC/nursing shift (same as shift CSV broken rule). */
const SLEEPOVER_FOLLOWON_GAP_MS = 8 * 60 * 60 * 1000;
/** Standard minimum unpaid break between consecutive shifts before short-turnaround penalty applies. */
const MIN_BREAK_BETWEEN_SHIFTS_MS = 10 * 60 * 60 * 1000;
/** SCHADS 2026 exception: shifts that are sleepover-linked only require an 8h following break. */
const MIN_BREAK_AFTER_SLEEPOVER_MS = 8 * 60 * 60 * 1000;
const OT_TIER_1_MAX = 2;
const TOTAL_HOURS_CAP = 76;
const BROKEN_SHIFT_SHORT_SPAN = 12;
/** Treat ≤ this gap between shift end/start as contiguous (rounding / CSV quirks). */
const GAP_CONTIGUOUS_TOLERANCE_MS = 60 * 1000;

// Time category priority (higher = higher pay)
const TIME_CATEGORY_PRIORITY = { morning: 1, afternoon: 2, night: 3 };

// Day type priority (higher = higher pay)
const DAY_TYPE_PRIORITY = { weekday: 1, saturday: 2, sunday: 3, holiday: 4 };

// ─── PRECISION ───────────────────────────────────────────────────────────────

/** Round to 2 decimal places. */
function r2(n) {
  return Math.round(n * 100) / 100;
}

// ─── TIMEZONE HELPERS ────────────────────────────────────────────────────────

/**
 * Apply a timezone offset string (e.g. '+10:00') to a UTC Date to produce
 * a new Date whose UTC fields represent the local time.
 */
function toLocal(utcDate, offsetStr) {
  const sign = offsetStr[0] === '+' ? 1 : -1;
  const clean = offsetStr.slice(1).replace(':', '');
  const h = parseInt(clean.slice(0, 2), 10);
  const m = parseInt(clean.slice(2, 4), 10);
  return new Date(utcDate.getTime() + sign * (h * 60 + m) * 60000);
}

/** Get the local-time hour (0-23) from a UTC date + offset. */
function localHour(utcDate, offsetStr) {
  return toLocal(utcDate, offsetStr).getUTCHours();
}

/** Get the local-time date-string "YYYY-MM-DD" from a UTC date + offset. */
function localDateStr(utcDate, offsetStr) {
  const d = toLocal(utcDate, offsetStr);
  return `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, '0')}-${String(d.getUTCDate()).padStart(2, '0')}`;
}

/** Get local weekday 0=Mon … 6=Sun from a UTC date + offset. */
function localWeekday(utcDate, offsetStr) {
  // JS: getUTCDay() → 0=Sun, 1=Mon … 6=Sat
  return (toLocal(utcDate, offsetStr).getUTCDay() + 6) % 7;
}

/** Get local month (1-12) from a UTC date + offset. */
function localMonth(utcDate, offsetStr) {
  return toLocal(utcDate, offsetStr).getUTCMonth() + 1;
}

/** Get local day-of-month from a UTC date + offset. */
function localDay(utcDate, offsetStr) {
  return toLocal(utcDate, offsetStr).getUTCDate();
}

/**
 * Create a UTC Date that represents midnight at the start of the local date following
 * startUtc (i.e. midnight local time = 00:00 of localDateStr(startUtc) + 1 day).
 */
function localMidnightAfter(utcDate, offsetStr) {
  const localDateStrVal = localDateStr(utcDate, offsetStr);
  const [y, mo, d] = localDateStrVal.split('-').map(Number);
  // Build next day midnight in local time, then subtract offset to get UTC
  const nextDayLocal = new Date(Date.UTC(y, mo - 1, d + 1, 0, 0, 0, 0));
  // Reverse the offset
  const sign = offsetStr[0] === '+' ? 1 : -1;
  const clean = offsetStr.slice(1).replace(':', '');
  const h = parseInt(clean.slice(0, 2), 10);
  const m = parseInt(clean.slice(2, 4), 10);
  return new Date(nextDayLocal.getTime() - sign * (h * 60 + m) * 60000);
}

/**
 * Create a UTC Date representing local 18:00 on the same local date as utcDate.
 */
function localSixPmOn(utcDate, offsetStr) {
  const localDateStrVal = localDateStr(utcDate, offsetStr);
  const [y, mo, d] = localDateStrVal.split('-').map(Number);
  const sixPmLocal = new Date(Date.UTC(y, mo - 1, d, CHRISTMAS_EVE_HOLIDAY_START, 0, 0, 0));
  const sign = offsetStr[0] === '+' ? 1 : -1;
  const clean = offsetStr.slice(1).replace(':', '');
  const h = parseInt(clean.slice(0, 2), 10);
  const m = parseInt(clean.slice(2, 4), 10);
  return new Date(sixPmLocal.getTime() - sign * (h * 60 + m) * 60000);
}

function localHourBoundary(refUtc, hour, offsetStr, minute = 0) {
  const ds = localDateStr(refUtc, offsetStr);
  const [y, mo, d] = ds.split('-').map(Number);
  const sign = offsetStr[0] === '+' ? 1 : -1;
  const clean = offsetStr.slice(1).replace(':', '');
  const oh = parseInt(clean.slice(0, 2), 10);
  const om = parseInt(clean.slice(2, 4), 10);
  return new Date(Date.UTC(y, mo - 1, d, hour, minute, 0) - sign * (oh * 60 + om) * 60000);
}

/**
 * Split a weekday segment at 06:01 and 20:01 local-time boundaries.
 * Handles cross-midnight shifts by iterating over each spanned local day.
 */
function splitWeekdayByTimeBand(startUtc, endUtc, hours, isSleepoverExcess, offsetStr) {
  const cuts = new Set([startUtc.getTime(), endUtc.getTime()]);

  let checkDate = startUtc;
  while (checkDate < endUtc) {
    const b6am = localHourBoundary(checkDate, MORNING_START, offsetStr, 1);
    const b8pm = localHourBoundary(checkDate, AFTERNOON_START, offsetStr, 1);
    if (b6am > startUtc && b6am < endUtc) cuts.add(b6am.getTime());
    if (b8pm > startUtc && b8pm < endUtc) cuts.add(b8pm.getTime());
    checkDate = localMidnightAfter(checkDate, offsetStr);
  }

  const sortedCuts = [...cuts].sort((a, b) => a - b).map(t => new Date(t));
  const totalMs = endUtc - startUtc;

  return sortedCuts.slice(0, -1).map((s, i) => {
    const e = sortedCuts[i + 1];
    const h = r2(hours * ((e - s) / totalMs));
    if (h <= 0) return null;
    const midH = localHour(new Date((s.getTime() + e.getTime()) / 2), offsetStr);
    const tc = midH < MORNING_START ? 'night' : midH < AFTERNOON_START ? 'morning' : 'afternoon';
    return { startUtc: s, endUtc: e, hours: h, dayType: 'weekday', timeCategory: tc, isSleepoverExcess };
  }).filter(Boolean);
}

// ─── DAY TYPE HELPERS ────────────────────────────────────────────────────────

function getDayTypeByWeekday(utcDate, offsetStr) {
  const wd = localWeekday(utcDate, offsetStr);
  if (wd === 6) return 'sunday';
  if (wd === 5) return 'saturday';
  return 'weekday';
}

function isChristmasEve(utcDate, offsetStr) {
  return localMonth(utcDate, offsetStr) === CHRISTMAS_EVE_MONTH &&
         localDay(utcDate, offsetStr) === CHRISTMAS_EVE_DAY;
}

/**
 * Get day type: 'holiday' | 'sunday' | 'saturday' | 'weekday'.
 * holidaySet: Set<string> of "YYYY-MM-DD" strings.
 */
function getDayType(utcDate, offsetStr, holidaySet) {
  // Christmas Eve: before 6pm → regular day, at/after 6pm → holiday
  if (isChristmasEve(utcDate, offsetStr)) {
    const hour = localHour(utcDate, offsetStr);
    if (hour >= CHRISTMAS_EVE_HOLIDAY_START) return 'holiday';
    return getDayTypeByWeekday(utcDate, offsetStr);
  }

  const ds = localDateStr(utcDate, offsetStr);
  if (holidaySet.has(ds)) return 'holiday';
  return getDayTypeByWeekday(utcDate, offsetStr);
}

/**
 * Get weekday time category: 'morning' | 'afternoon' | 'night'.
 * Both startUtc and endUtc are UTC Dates; offsetStr is the shift's timezone offset.
 */
function getTimeCategory(startUtc, endUtc, offsetStr) {
  const startHour = localHour(startUtc, offsetStr);
  const startMin = toLocal(startUtc, offsetStr).getUTCMinutes();
  const startFloat = startHour + startMin / 60;

  const endHour = localHour(endUtc, offsetStr);
  const endMin = toLocal(endUtc, offsetStr).getUTCMinutes();
  const endFloat = endHour + endMin / 60;

  const startDate = localDateStr(startUtc, offsetStr);
  const endDate = localDateStr(endUtc, offsetStr);
  const crossesMidnight = startDate !== endDate;
  const endsExactlyAtMidnight = endHour === 0 && endMin === 0;

  // Night: starts before 06:00 OR crosses midnight past midnight.
  // A shift that ends exactly at 00:00 is still treated as "at/before midnight".
  if (startFloat < MORNING_START) return 'night';
  if (crossesMidnight && !endsExactlyAtMidnight) return 'night';

  // Same-day weekday shifts:
  // - Afternoon if finish after 20:00
  // - Otherwise Daytime (ordinary)
  const effectiveEndFloat = endsExactlyAtMidnight ? 24 : endFloat;
  if (effectiveEndFloat > AFTERNOON_START) return 'afternoon';
  return 'morning';
}

// ─── SHIFT SEGMENT CREATION ──────────────────────────────────────────────────

/**
 * ShiftSegment: { startUtc, endUtc, hours, dayType, timeCategory, isSleepoverExcess }
 */

function createSingleDaySegment(startUtc, endUtc, hours, shiftType, offsetStr, holidaySet, options = {}) {
  const { isPreSleepoverWeekday = false, isPostSleepoverWeekday = false } = options;
  const dayType = getDayType(startUtc, offsetStr, holidaySet);

  let segHours = hours;
  let isSleepoverExcess = false;

  if (shiftType === 'sleepover') {
    segHours = r2(Math.max(0, hours - SLEEPOVER_DEDUCTION));
    isSleepoverExcess = true;
    if (segHours <= 0) return [];
  }

  if (dayType === 'weekday') {
    if (isSleepoverExcess) {
      // Sleepover excess only: split at 6am/8pm per new SCHADS split-loading rule.
      return splitWeekdayByTimeBand(startUtc, endUtc, segHours, isSleepoverExcess, offsetStr);
    }
    // SCHADS weekday classification applies to the whole qualifying shift:
    // - Afternoon if it finishes after 8:00pm and at/before midnight
    // - Night if it starts before 6:00am or finishes after midnight
    // - Otherwise daytime
    return [{
      startUtc,
      endUtc,
      hours: segHours,
      dayType: 'weekday',
      timeCategory: getTimeCategory(startUtc, endUtc, offsetStr),
      isSleepoverExcess: false,
    }];
  }

  return [{ startUtc, endUtc, hours: segHours, dayType, timeCategory: null, isSleepoverExcess }];
}

function createNightShiftSegment(startUtc, endUtc, hours, shiftType, offsetStr) {
  let segHours = hours;
  let isSleepoverExcess = false;

  if (shiftType === 'sleepover') {
    segHours = r2(Math.max(0, hours - SLEEPOVER_DEDUCTION));
    isSleepoverExcess = true;
    if (segHours <= 0) return [];
    // Sleepover excess only: split at 6am/8pm per new SCHADS split-loading rule.
    return splitWeekdayByTimeBand(startUtc, endUtc, segHours, isSleepoverExcess, offsetStr);
  }

  // Regular cross-midnight weekday (both days weekday): whole segment is night.
  return [{ startUtc, endUtc, hours: segHours, dayType: 'weekday', timeCategory: 'night', isSleepoverExcess: false }];
}

function shiftSpansChristmasEve6pm(startUtc, endUtc, offsetStr) {
  if (!isChristmasEve(startUtc, offsetStr)) return false;
  const startHour = localHour(startUtc, offsetStr);
  const endDate = localDateStr(endUtc, offsetStr);
  const startDate = localDateStr(startUtc, offsetStr);
  const endHour = localHour(endUtc, offsetStr);
  return startHour < CHRISTMAS_EVE_HOLIDAY_START &&
         (endHour >= CHRISTMAS_EVE_HOLIDAY_START || endDate !== startDate);
}

function splitSleepoverAtChristmasEve6pm(
  startUtc, endUtc, holidayStartUtc, midnightUtc,
  beforeHours, afterHours, remainingHours,
  beforeDayType, beforeTimeCategory, offsetStr, holidaySet
) {
  const segments = [];

  if (beforeHours >= SLEEPOVER_DEDUCTION) {
    const beforeExcess = r2(beforeHours - SLEEPOVER_DEDUCTION);
    if (beforeExcess > 0) {
      segments.push({ startUtc, endUtc: holidayStartUtc, hours: beforeExcess, dayType: beforeDayType, timeCategory: beforeTimeCategory, isSleepoverExcess: true });
    }
    if (afterHours > 0) {
      const afterEnd = midnightUtc === null ? endUtc : midnightUtc;
      segments.push({ startUtc: holidayStartUtc, endUtc: afterEnd, hours: afterHours, dayType: 'holiday', timeCategory: null, isSleepoverExcess: true });
    }
  } else {
    const remainingDeduction = r2(SLEEPOVER_DEDUCTION - beforeHours);
    const afterExcess = r2(afterHours - remainingDeduction);
    if (afterExcess > 0) {
      const afterEnd = midnightUtc === null ? endUtc : midnightUtc;
      segments.push({ startUtc: holidayStartUtc, endUtc: afterEnd, hours: afterExcess, dayType: 'holiday', timeCategory: null, isSleepoverExcess: true });
    }
  }

  if (remainingHours > 0 && midnightUtc !== null) {
    const day2Type = getDayType(endUtc, offsetStr, holidaySet);
    const day2TimeCat = day2Type === 'weekday' ? 'night' : null;
    segments.push({ startUtc: midnightUtc, endUtc, hours: remainingHours, dayType: day2Type, timeCategory: day2TimeCat, isSleepoverExcess: true });
  }

  return segments;
}

function splitAtChristmasEve6pm(startUtc, endUtc, hours, shiftType, offsetStr, holidaySet, options = {}) {
  const { forceWeekdayNight = false } = options;
  const holidayStartUtc = localSixPmOn(startUtc, offsetStr);

  const beforeHours = r2((holidayStartUtc - startUtc) / 3600000);
  const startDate = localDateStr(startUtc, offsetStr);
  const endDate = localDateStr(endUtc, offsetStr);

  let afterHours, remainingHours, midnightUtc;

  if (endDate !== startDate) {
    midnightUtc = localMidnightAfter(startUtc, offsetStr);
    afterHours = r2((midnightUtc - holidayStartUtc) / 3600000);
    remainingHours = r2((endUtc - midnightUtc) / 3600000);
  } else {
    afterHours = r2((endUtc - holidayStartUtc) / 3600000);
    remainingHours = 0;
    midnightUtc = null;
  }

  const beforeDayType = getDayTypeByWeekday(startUtc, offsetStr);
  const beforeTimeCat = beforeDayType === 'weekday' && (shiftType === 'sleepover' || forceWeekdayNight) ? 'night' : null;

  if (shiftType === 'sleepover') {
    return splitSleepoverAtChristmasEve6pm(
      startUtc, endUtc, holidayStartUtc, midnightUtc,
      beforeHours, afterHours, remainingHours,
      beforeDayType, beforeTimeCat, offsetStr, holidaySet
    );
  }

  const segments = [];

  if (beforeHours > 0) {
    if (beforeDayType === 'weekday' && !forceWeekdayNight) {
      const tc = getTimeCategory(startUtc, holidayStartUtc, offsetStr);
      segments.push({ startUtc, endUtc: holidayStartUtc, hours: beforeHours, dayType: beforeDayType, timeCategory: tc, isSleepoverExcess: false });
    } else {
      segments.push({ startUtc, endUtc: holidayStartUtc, hours: beforeHours, dayType: beforeDayType, timeCategory: beforeTimeCat, isSleepoverExcess: false });
    }
  }
  if (afterHours > 0) {
    const afterEnd = midnightUtc === null ? endUtc : midnightUtc;
    segments.push({ startUtc: holidayStartUtc, endUtc: afterEnd, hours: afterHours, dayType: 'holiday', timeCategory: null, isSleepoverExcess: false });
  }
  if (remainingHours > 0 && midnightUtc !== null) {
    const day2Type = getDayType(endUtc, offsetStr, holidaySet);
    // Day2 starts at midnight (0am): weekday portion is always night.
    const day2TimeCat = day2Type === 'weekday' ? 'night' : null;
    segments.push({ startUtc: midnightUtc, endUtc, hours: remainingHours, dayType: day2Type, timeCategory: day2TimeCat, isSleepoverExcess: false });
  }

  return segments;
}

function splitSleepoverAtMidnight(startUtc, endUtc, midnightUtc, day1Type, day2Type, day1Hours, day2Hours, offsetStr) {
  const segments = [];

  if (day1Hours >= SLEEPOVER_DEDUCTION) {
    const day1Excess = r2(day1Hours - SLEEPOVER_DEDUCTION);
    if (day1Excess > 0) {
      if (day1Type === 'weekday') {
        segments.push(...splitWeekdayByTimeBand(startUtc, midnightUtc, day1Excess, true, offsetStr));
      } else {
        segments.push({ startUtc, endUtc: midnightUtc, hours: day1Excess, dayType: day1Type, timeCategory: null, isSleepoverExcess: true });
      }
    }
    if (day2Hours > 0) {
      if (day2Type === 'weekday') {
        segments.push(...splitWeekdayByTimeBand(midnightUtc, endUtc, day2Hours, true, offsetStr));
      } else {
        segments.push({ startUtc: midnightUtc, endUtc, hours: day2Hours, dayType: day2Type, timeCategory: null, isSleepoverExcess: true });
      }
    }
  } else {
    const remainingDeduction = r2(SLEEPOVER_DEDUCTION - day1Hours);
    const day2Excess = r2(day2Hours - remainingDeduction);
    if (day2Excess > 0) {
      if (day2Type === 'weekday') {
        segments.push(...splitWeekdayByTimeBand(midnightUtc, endUtc, day2Excess, true, offsetStr));
      } else {
        segments.push({ startUtc: midnightUtc, endUtc, hours: day2Excess, dayType: day2Type, timeCategory: null, isSleepoverExcess: true });
      }
    }
  }

  return segments;
}

/**
 * Split a shift at midnight (and/or Christmas Eve 6pm) into segments.
 * Returns array of ShiftSegment objects.
 */
function splitShiftAtMidnight(startUtc, endUtc, hours, shiftType, offsetStr, holidaySet, options = {}) {
  const { forceWeekdayNight = false } = options;
  // Christmas Eve 6pm split takes priority
  if (shiftSpansChristmasEve6pm(startUtc, endUtc, offsetStr)) {
    return splitAtChristmasEve6pm(startUtc, endUtc, hours, shiftType, offsetStr, holidaySet, options);
  }

  const startDateStr = localDateStr(startUtc, offsetStr);
  const endDateStr = localDateStr(endUtc, offsetStr);

  // Same local day OR ends at/before 00:01 on the next day
  const endLocalHour = localHour(endUtc, offsetStr);
  const endLocalMin = toLocal(endUtc, offsetStr).getUTCMinutes();
  const endFloat = endLocalHour + endLocalMin / 60;
  
  // Assuming shifts are < 24 hours, if it crosses to the next day but ends at or before 00:01, it's effectively one day.
  if (startDateStr === endDateStr || endFloat <= 1 / 60) {
    return createSingleDaySegment(startUtc, endUtc, hours, shiftType, offsetStr, holidaySet, options);
  }

  // Shift crosses midnight boundary (00:01) — check day types
  const day1Type = getDayType(startUtc, offsetStr, holidaySet);
  const day2Type = getDayType(endUtc, offsetStr, holidaySet);

  // Both weekdays = night hours (no split)
  if (day1Type === 'weekday' && day2Type === 'weekday') {
    return createNightShiftSegment(startUtc, endUtc, hours, shiftType, offsetStr, options);
  }

  // One day is special — split at 00:00 of the next day
  // Use 00:00 for hour calculations; time band classification still uses :01 boundaries.
  const midnightUtc = localMidnightAfter(startUtc, offsetStr);
  const day1Hours = r2((midnightUtc - startUtc) / 3600000);
  const day2Hours = r2((endUtc - midnightUtc) / 3600000);

  if (shiftType === 'sleepover') {
    return splitSleepoverAtMidnight(startUtc, endUtc, midnightUtc, day1Type, day2Type, day1Hours, day2Hours, offsetStr);
  }

  const segments = [];

  // Strict midnight boundary for cross-day classification:
  // day1 gets pre-midnight hours; day2 gets post-midnight hours.
  if (day2Type === 'holiday' && day1Type === 'weekday') {
    // Pre-midnight weekday portion is night for cross-midnight weekday shifts.
    if (day1Hours > 0) {
      segments.push({ startUtc, endUtc: midnightUtc, hours: day1Hours, dayType: day1Type, timeCategory: 'night', isSleepoverExcess: false });
    }
    // Post-midnight portion belongs to holiday day type.
    if (day2Hours > 0) {
      segments.push({ startUtc: midnightUtc, endUtc, hours: day2Hours, dayType: 'holiday', timeCategory: null, isSleepoverExcess: false });
    }
  } else {
    // Original logic for non-holiday overflow
    if (day1Type === 'weekday') {
      if (forceWeekdayNight) {
        segments.push({ startUtc, endUtc: midnightUtc, hours: day1Hours, dayType: day1Type, timeCategory: 'night', isSleepoverExcess: false });
      } else {
        // A cross-midnight shift finishes after midnight. Under SCHADS, any shift finishing after midnight is a Night shift.
        segments.push({ startUtc, endUtc: midnightUtc, hours: day1Hours, dayType: day1Type, timeCategory: 'night', isSleepoverExcess: false });
      }
    } else {
      segments.push({ startUtc, endUtc: midnightUtc, hours: day1Hours, dayType: day1Type, timeCategory: null, isSleepoverExcess: false });
    }

    if (day2Type === 'weekday') {
      // Day2 always starts at midnight (0am < 6am): night band.
      segments.push({ startUtc: midnightUtc, endUtc, hours: day2Hours, dayType: day2Type, timeCategory: 'night', isSleepoverExcess: false });
    } else {
      segments.push({ startUtc: midnightUtc, endUtc, hours: day2Hours, dayType: day2Type, timeCategory: null, isSleepoverExcess: false });
    }
  }

  return segments;
}

// ─── SLEEPOVER-FLANKING PERSONAL CARE / NURSING ───────────────────────────────

/** Milliseconds between previous.shift endDatetime and cur.shift startDatetime */
function gapBetweenShiftsUtc(prevShift, curShift) {
  return new Date(curShift.startDatetime) - new Date(prevShift.endDatetime);
}

/**
 * PC / nursing immediately before a touching sleepovern, or PC / nursing immediately after sleepovern
 * (within attach window), stack with the overnight period and bill as SCHADS weekday **night**.
 * Overrides holiday/sat/sun segment bucket for those hours only.
 *
 * Exported for regression tests only.
 *
 * @param {Array<object>} shifts
 * @returns {boolean[]}
 */
export function computeSleepovernAttachedNight(shifts) {
  return shifts.map(() => false);
}

/**
 * For each shift, flag whether it is immediately before or after a regular sleepover.
 *
 * Pre-sleepover weekday shifts: use highest time band (no split at 6am/8pm boundaries).
 * Post-sleepover weekday shifts: forced to night band regardless of actual clock hours.
 * The sleepover's own excess hours are always split by time band — these flags don't affect it.
 */
function computeSleepoverAdjacentFlags(shifts) {
  const n = shifts.length;
  const isPreSleepover = new Array(n).fill(false);
  const isPostSleepover = new Array(n).fill(false);

  for (let i = 0; i < n; i++) {
    if (shifts[i].shiftType !== 'sleepover') continue;
    if (i > 0) {
      const gap = new Date(shifts[i].startDatetime) - new Date(shifts[i - 1].endDatetime);
      if (Math.abs(gap) <= GAP_CONTIGUOUS_TOLERANCE_MS) isPreSleepover[i - 1] = true;
    }
    if (i < n - 1) {
      const gap = new Date(shifts[i + 1].startDatetime) - new Date(shifts[i].endDatetime);
      if (gap >= 0 && gap <= SLEEPOVER_FOLLOWON_GAP_MS) isPostSleepover[i + 1] = true;
    }
  }

  return { isPreSleepover, isPostSleepover };
}

/**
 * Force all hourly segments onto weekday night (used when flanking a sleepovern).
 */
function applySleepovernChainNightSegments(segments) {
  return segments.map((seg) => {
    if (!seg) return seg;
    if (seg.hours <= 0) return seg;
    return {
      ...seg,
      dayType: 'weekday',
      timeCategory: 'night',
      isSleepoverExcess: !!seg.isSleepoverExcess,
    };
  });
}

// ─── PAY HOURS DATA ───────────────────────────────────────────────────────────

export function newPayHoursData() {
  return {
    morningHours: 0, afternoonHours: 0, nightHours: 0,
    weekdayOtUpto2: 0, weekdayOtAfter2: 0,
    saturdayHours: 0, saturdayOtUpto2: 0, saturdayOtAfter2: 0,
    sundayHours: 0, sundayOtUpto2: 0, sundayOtAfter2: 0,
    holidayHours: 0, holidayOtUpto2: 0, holidayOtAfter2: 0,
    nursingCareHours: 0,
    nursingAfternoonHours: 0,
    nursingNightHours: 0,
    nursingSaturdayHours: 0,
    nursingSundayHours: 0,
    nursingHolidayHours: 0,
    otAfter76Hours: 0,
    shortTurnaroundHours: 0,
    otAfter76Weekday: 0, otAfter76Saturday: 0,
    otAfter76Sunday: 0, otAfter76Holiday: 0,
    brokenShiftCount: 0,
    brokenShift2BreakCount: 0,
    mealAllowanceCount: 0,
    sleepoversCount: 0,
  };
}

function addHoursToCategory(data, hours, dayType, timeCategory) {
  if (dayType === 'holiday') {
    data.holidayHours = r2(data.holidayHours + hours);
  } else if (dayType === 'sunday') {
    data.sundayHours = r2(data.sundayHours + hours);
  } else if (dayType === 'saturday') {
    data.saturdayHours = r2(data.saturdayHours + hours);
  } else if (dayType === 'weekday') {
    if (timeCategory === 'morning') data.morningHours = r2(data.morningHours + hours);
    else if (timeCategory === 'afternoon') data.afternoonHours = r2(data.afternoonHours + hours);
    else if (timeCategory === 'night') data.nightHours = r2(data.nightHours + hours);
  }
}

function getHighestTimeCategory(categories) {
  const valid = categories.filter(c => c && TIME_CATEGORY_PRIORITY[c] !== undefined);
  if (!valid.length) return null;
  return valid.reduce((best, c) => TIME_CATEGORY_PRIORITY[c] > TIME_CATEGORY_PRIORITY[best] ? c : best, valid[0]);
}

function getHighestDayType(dayTypes) {
  if (!dayTypes.length) return 'weekday';
  return dayTypes.reduce((best, d) => (DAY_TYPE_PRIORITY[d] || 0) > (DAY_TYPE_PRIORITY[best] || 0) ? d : best, dayTypes[0]);
}

// ─── OVERTIME ────────────────────────────────────────────────────────────────

function processOvertime(activeHours, dayType, timeCategory, data) {
  const cap = dayType === 'weekday' ? MAX_REGULAR_HOURS_WEEKDAY : MAX_REGULAR_HOURS;
  if (activeHours <= cap) return;

  const otHours = r2(activeHours - cap);
  const otTier1 = r2(Math.min(otHours, OT_TIER_1_MAX));
  const otTier2 = r2(Math.max(0, otHours - OT_TIER_1_MAX));

  if (dayType === 'holiday') {
    data.holidayOtUpto2 = r2(data.holidayOtUpto2 + otTier1);
    data.holidayOtAfter2 = r2(data.holidayOtAfter2 + otTier2);
  } else if (dayType === 'sunday') {
    data.sundayOtUpto2 = r2(data.sundayOtUpto2 + otTier1);
    data.sundayOtAfter2 = r2(data.sundayOtAfter2 + otTier2);
  } else if (dayType === 'saturday') {
    data.saturdayOtUpto2 = r2(data.saturdayOtUpto2 + otTier1);
    data.saturdayOtAfter2 = r2(data.saturdayOtAfter2 + otTier2);
  } else if (dayType === 'weekday') {
    data.weekdayOtUpto2 = r2(data.weekdayOtUpto2 + otTier1);
    data.weekdayOtAfter2 = r2(data.weekdayOtAfter2 + otTier2);
  }
}

function addBrokenShiftOtToCategory(data, dayType, hours, isTier1) {
  if (dayType === 'holiday') {
    if (isTier1) data.holidayOtUpto2 = r2(data.holidayOtUpto2 + hours);
    else data.holidayOtAfter2 = r2(data.holidayOtAfter2 + hours);
  } else if (dayType === 'sunday') {
    if (isTier1) data.sundayOtUpto2 = r2(data.sundayOtUpto2 + hours);
    else data.sundayOtAfter2 = r2(data.sundayOtAfter2 + hours);
  } else if (dayType === 'saturday') {
    if (isTier1) data.saturdayOtUpto2 = r2(data.saturdayOtUpto2 + hours);
    else data.saturdayOtAfter2 = r2(data.saturdayOtAfter2 + hours);
  } else if (dayType === 'weekday') {
    if (isTier1) data.weekdayOtUpto2 = r2(data.weekdayOtUpto2 + hours);
    else data.weekdayOtAfter2 = r2(data.weekdayOtAfter2 + hours);
  }
}

function processBrokenShiftOvertime(currentShift, previousShifts, data, ctx) {
  // Check if there's an actual break (gap > 0) in the current link
  if (currentShift.isBrokenShift) {
    if (previousShifts.length >= 2) {
      // 2nd break in same day — upgrade from 1-break to 2-break (don't double-count)
      data.brokenShiftCount       = Math.max(0, data.brokenShiftCount - 1);
      data.brokenShift2BreakCount += 1;
    } else {
      // First break in this day
      data.brokenShiftCount += 1;
    }
  }

  // If this shift is already fully reclassified by short-turnaround logic,
  // do not stack broken-shift overtime on the same hours.
  if ((ctx?.shortTurnaroundByShift?.[currentShift.shiftId] || 0) > 0) return;

  if (!previousShifts.length || !currentShift.segments.length) return;

  const spanStart = previousShifts[0].startUtc;
  const spanEnd = currentShift.endUtc;
  const spanHours = r2((spanEnd - spanStart) / 3600000);

  const totalActive = r2(
    previousShifts.reduce((sum, s) => sum + s.activeHours, 0) + currentShift.activeHours
  );

  const dayType = currentShift.segments[0].dayType;

  if (spanHours < BROKEN_SHIFT_SHORT_SPAN) {
    // Span < 12h: OT at 1.5× for active hours beyond daily ordinary cap (10h all day types)
    const cap = dayType === 'weekday' ? MAX_REGULAR_HOURS_WEEKDAY : MAX_REGULAR_HOURS;
    if (totalActive > cap) {
      const extraHours = r2(totalActive - cap);
      addBrokenShiftOtToCategory(data, dayType, extraHours, true);
      // Meal allowance per broken-shift OT event
      if (extraHours > 1) data.mealAllowanceCount += 1;
      if (extraHours > 4) data.mealAllowanceCount += 1;
    }
  } else {
    // Span ≥ 12h: the ENTIRE last shift is reclassified to double time (2×).
    // Rule: "Overrides all previous classifications for that shift."
    // Span breach = full-shift penalty, regardless of when within the shift the mark falls.
    const doubleTimeHours = currentShift.activeHours;
    if (doubleTimeHours > 0) {
      ctx.reclassifiedFullDoubleTimeShiftIds.add(currentShift.shiftId);
      addBrokenShiftOtToCategory(data, dayType, doubleTimeHours, false); // false = tier 2 = 2×
      // Meal allowance per broken-shift OT event
      if (doubleTimeHours > 1) data.mealAllowanceCount += 1;
      if (doubleTimeHours > 4) data.mealAllowanceCount += 1;
    }
  }
}

function handleBrokenShift(shift, processedShift, processedShifts, data, ctx) {
  // Broken-shift rules apply only when the current shift is explicitly broken.
  if (!shift.isBrokenShift) return;

  const offsetStr = shift.timezoneOffset || '+10:00';
  const previousInSpan = [];
  const shiftStartDateStr = localDateStr(processedShift.startUtc, offsetStr);

  for (let i = processedShifts.length - 1; i >= 0; i--) {
    const prev = processedShifts[i];
    const prevDateStr = localDateStr(prev.startUtc, offsetStr);
    if (prevDateStr === shiftStartDateStr) {
      previousInSpan.unshift(prev);
    } else {
      break;
    }
  }

  // Retroactive loading across broken-shift span:
  // if final segment runs past evening boundary, apply the final penalty category
  // (evening/night) to all weekday segments in that day's broken span.
  if (shift.isBrokenShift && previousInSpan.length) {
    const endDateStr = localDateStr(processedShift.endUtc, offsetStr);
    const endHour = localHour(processedShift.endUtc, offsetStr);
    const targetCategory =
      endDateStr !== shiftStartDateStr ? 'night' : endHour > AFTERNOON_START ? 'afternoon' : null;
    if (targetCategory) {
      const spanShifts = [...previousInSpan, processedShift];
      const targetField = targetCategory === 'night' ? 'nightHours' : 'afternoonHours';
      const targetNursingField = targetCategory === 'night' ? 'nursingNightHours' : 'nursingAfternoonHours';
      for (const s of spanShifts) {
        if (s.shiftType === 'nursing_support') {
          const nursingWeekdayHours = r2(
            (s.segments || [])
              .filter((seg) => seg && seg.hours > 0 && seg.dayType === 'weekday' && !seg.isSleepoverExcess)
              .reduce((sum, seg) => sum + seg.hours, 0)
          );
          if (nursingWeekdayHours > 0) {
            data.nursingCareHours = r2(Math.max(0, data.nursingCareHours - nursingWeekdayHours));
            data[targetField] = r2((data[targetField] || 0) + nursingWeekdayHours);
            data[targetNursingField] = r2((data[targetNursingField] || 0) + nursingWeekdayHours);
            for (const e of ctx.nursingWeekdayLedger || []) {
              if (e.shiftId === s.shiftId && e.fieldName === 'nursingCareHours') {
                e.fieldName = targetField;
              }
            }
          }
        }
        for (const seg of s.segments || []) {
          if (!seg || seg.hours <= 0) continue;
          if (seg.dayType !== 'weekday') continue;
          if (seg.isSleepoverExcess) continue;
          seg.timeCategory = targetCategory;
        }
      }
    }
  }

  processBrokenShiftOvertime(processedShift, previousInSpan, data, ctx);
}

// ─── ACTIVE HOURS ─────────────────────────────────────────────────────────────

function calculateActiveHours(hours, shiftType) {
  if (shiftType === 'sleepover') return r2(Math.max(0, hours - SLEEPOVER_DEDUCTION));
  return hours;
}

function normalizeShiftHours(shift, startUtc, endUtc) {
  const derived = r2((endUtc - startUtc) / 3600000);
  if (!Number.isFinite(shift.hours) || shift.hours <= 0) return derived;
  // Guard against bad imported "hours" values; trust timestamps when mismatch is material.
  return Math.abs(r2(shift.hours) - derived) <= 0.05 ? r2(shift.hours) : derived;
}

function isMinimumEngagementException(shiftType, hours) {
  return shiftType === 'personal_care' && hours > 0 && hours < 2;
}

/**
 * Consecutive shifts that count as one engagement for SCHADS minimum-hours review:
 * - Back-to-back (zero gap) only.
 * Any unpaid break starts a new engagement and minimum engagement
 * must be assessed independently.
 */
function shouldLinkShiftsForMinimumEngagement(prev, cur, gapMs) {
  if (gapMs !== 0) return false;
  // Minimum engagement applies to personal care attendance only.
  // Sleepovers (and other non-PC types) must not bridge PC segments into one engagement.
  return prev?.shiftType === 'personal_care' && cur?.shiftType === 'personal_care';
}

/**
 * Clear per-shift minimum-engagement flags when personal care time in a linked chain sums to ≥2h.
 */
function resolveMinimumEngagementChains(shifts, ctx) {
  if (!shifts.length) return;
  const ordered = [...shifts].sort(
    (a, b) => new Date(a.startDatetime) - new Date(b.startDatetime)
  );

  const flushGroup = (group) => {
    let pcSum = 0;
    for (const sh of group) {
      if (sh.shiftType !== 'personal_care') continue;
      const su = new Date(sh.startDatetime);
      const eu = new Date(sh.endDatetime);
      pcSum = r2(pcSum + normalizeShiftHours(sh, su, eu));
    }
    if (pcSum < 2) return;
    for (const sh of group) {
      if (sh.shiftType === 'personal_care') {
        ctx.shiftMinimumEngagementException.set(String(sh._id), false);
      }
    }
  };

  let group = [ordered[0]];
  for (let i = 1; i < ordered.length; i++) {
    const prev = ordered[i - 1];
    const cur = ordered[i];
    const pe = new Date(prev.endDatetime);
    const cs = new Date(cur.startDatetime);
    const gapMs = cs - pe;
    if (shouldLinkShiftsForMinimumEngagement(prev, cur, gapMs)) {
      group.push(cur);
    } else {
      flushGroup(group);
      group = [cur];
    }
  }
  flushGroup(group);

  // SCHADS 25.7(f): if a sleepover has immediately-adjacent pre/post personal care
  // periods and at least one side is rostered/paid at >=4h, the other side does not
  // require a 2h minimum-engagement review flag.
  for (let i = 1; i < ordered.length - 1; i++) {
    const mid = ordered[i];
    if (mid.shiftType !== 'sleepover') continue;
    const pre = ordered[i - 1];
    const post = ordered[i + 1];
    if (pre.shiftType !== 'personal_care' || post.shiftType !== 'personal_care') continue;

    const preGap = new Date(mid.startDatetime) - new Date(pre.endDatetime);
    const postGap = new Date(post.startDatetime) - new Date(mid.endDatetime);
    const isImmediatePre = Math.abs(preGap) <= GAP_CONTIGUOUS_TOLERANCE_MS;
    const isImmediatePost = Math.abs(postGap) <= GAP_CONTIGUOUS_TOLERANCE_MS;
    if (!isImmediatePre || !isImmediatePost) continue;

    const preHours = normalizeShiftHours(pre, new Date(pre.startDatetime), new Date(pre.endDatetime));
    const postHours = normalizeShiftHours(post, new Date(post.startDatetime), new Date(post.endDatetime));
    if (preHours >= 4 && postHours > 0 && postHours < 2) {
      ctx.shiftMinimumEngagementException.set(String(post._id), false);
    }
    if (postHours >= 4 && preHours > 0 && preHours < 2) {
      ctx.shiftMinimumEngagementException.set(String(pre._id), false);
    }
  }
}

function computeShiftDurationHours(shift) {
  if (!shift?.startDatetime || !shift?.endDatetime) return r2(Number(shift?.hours) || 0);
  const start = new Date(shift.startDatetime);
  const end = new Date(shift.endDatetime);
  const derived = r2((end - start) / 3600000);
  return derived > 0 ? derived : r2(Number(shift?.hours) || 0);
}

// ─── 76-HOUR CAP ─────────────────────────────────────────────────────────────

function apply76HourCap(data, hourLedger) {
  const totalRegular = r2(
    data.morningHours + data.afternoonHours + data.nightHours +
    data.saturdayHours + data.sundayHours + data.holidayHours +
    data.nursingCareHours + data.nursingAfternoonHours + data.nursingNightHours
  );

  if (totalRegular <= TOTAL_HOURS_CAP) return;

  const excess = r2(totalRegular - TOTAL_HOURS_CAP);
  data.otAfter76Hours = r2(data.otAfter76Hours + excess);

  // Track OT>76 by day type for correct pay rates
  let ot76Weekday = 0, ot76Saturday = 0, ot76Sunday = 0, ot76Holiday = 0;

  // Sort ledger by date descending (latest first)
  const sorted = [...hourLedger].sort((a, b) => b.entryDate - a.entryDate);

  let remaining = excess;
  for (const entry of sorted) {
    if (remaining <= 0) break;
    const deduct = r2(Math.min(entry.hours, remaining));
    entry.hours = r2(entry.hours - deduct);

    // Deduct from data field
    data[entry.fieldName] = r2((data[entry.fieldName] || 0) - deduct);
    if (entry.isNursing && entry.dayType === 'saturday') {
      data.nursingSaturdayHours = r2((data.nursingSaturdayHours || 0) - deduct);
    } else if (entry.isNursing && entry.dayType === 'sunday') {
      data.nursingSundayHours = r2((data.nursingSundayHours || 0) - deduct);
    } else if (entry.isNursing && entry.dayType === 'holiday') {
      data.nursingHolidayHours = r2((data.nursingHolidayHours || 0) - deduct);
    } else if (entry.isNursing && entry.dayType === 'weekday' && entry.fieldName === 'afternoonHours') {
      data.nursingAfternoonHours = r2((data.nursingAfternoonHours || 0) - deduct);
    } else if (entry.isNursing && entry.dayType === 'weekday' && entry.fieldName === 'nightHours') {
      data.nursingNightHours = r2((data.nursingNightHours || 0) - deduct);
    }
    remaining = r2(remaining - deduct);

    // Accumulate by day type
    if (entry.dayType === 'holiday') ot76Holiday = r2(ot76Holiday + deduct);
    else if (entry.dayType === 'sunday') ot76Sunday = r2(ot76Sunday + deduct);
    else if (entry.dayType === 'saturday') ot76Saturday = r2(ot76Saturday + deduct);
    else ot76Weekday = r2(ot76Weekday + deduct);
  }

  data.otAfter76Weekday = r2(data.otAfter76Weekday + ot76Weekday);
  data.otAfter76Saturday = r2(data.otAfter76Saturday + ot76Saturday);
  data.otAfter76Sunday = r2(data.otAfter76Sunday + ot76Sunday);
  data.otAfter76Holiday = r2(data.otAfter76Holiday + ot76Holiday);
}

// ─── CHAIN PROCESSING ────────────────────────────────────────────────────────

function groupSegmentsIntoChains(pendingSegments) {
  const chains = [];
  let currentChain = [];

  for (const seg of pendingSegments) {
    const prev = currentChain.length ? currentChain[currentChain.length - 1] : null;
    // SCHADS 2026+: loadings before and after a sleepover are decoupled — never treat
    // pre-sleepover night/evening as the "originating band" for OT + cap logic that
    // includes post-sleepover ordinary hours (chain must snap at SO boundary).
    const sleepoverAttendanceBoundary =
      prev &&
      (prev.shiftType === 'sleepover') !== (seg.shiftType === 'sleepover');

    if (
      !seg.isContinuousWithPrevious ||
      !currentChain.length ||
      sleepoverAttendanceBoundary
    ) {
      if (currentChain.length) chains.push(currentChain);
      currentChain = [seg];
    } else {
      currentChain.push(seg);
    }
  }
  if (currentChain.length) chains.push(currentChain);
  return chains;
}

function deductOtFromEnd(entries, otTotal) {
  let otRemaining = otTotal;
  const otByDayType = {};
  const otByShiftId = {};

  for (let i = entries.length - 1; i >= 0; i--) {
    if (otRemaining <= 0) break;
    const entry = entries[i];
    const deduct = r2(Math.min(entry.hours, otRemaining));
    entry.hours = r2(entry.hours - deduct);
    otRemaining = r2(otRemaining - deduct);
    otByDayType[entry.dayType] = r2((otByDayType[entry.dayType] || 0) + deduct);
    if (entry.shiftId) {
      if (!otByShiftId[entry.shiftId]) otByShiftId[entry.shiftId] = {};
      otByShiftId[entry.shiftId][entry.dayType] = r2(
        (otByShiftId[entry.shiftId][entry.dayType] || 0) + deduct
      );
    }
  }

  return { entries, otByDayType, otByShiftId };
}

function applyOtByDayType(otByDayType, data) {
  for (const [dayType, otHours] of Object.entries(otByDayType)) {
    const tier1 = r2(Math.min(otHours, OT_TIER_1_MAX));
    const tier2 = r2(Math.max(0, otHours - OT_TIER_1_MAX));
    if (dayType === 'holiday') {
      data.holidayOtUpto2 = r2(data.holidayOtUpto2 + tier1);
      data.holidayOtAfter2 = r2(data.holidayOtAfter2 + tier2);
    } else if (dayType === 'sunday') {
      data.sundayOtUpto2 = r2(data.sundayOtUpto2 + tier1);
      data.sundayOtAfter2 = r2(data.sundayOtAfter2 + tier2);
    } else if (dayType === 'saturday') {
      data.saturdayOtUpto2 = r2(data.saturdayOtUpto2 + tier1);
      data.saturdayOtAfter2 = r2(data.saturdayOtAfter2 + tier2);
    } else if (dayType === 'weekday') {
      data.weekdayOtUpto2 = r2(data.weekdayOtUpto2 + tier1);
      data.weekdayOtAfter2 = r2(data.weekdayOtAfter2 + tier2);
    }
  }
}

function buildOrderedChainEntries(chain, ctx) {
  const entries = [];

  for (const ps of chain) {
    if (ctx?.reclassifiedFullDoubleTimeShiftIds?.has(ps.shiftId)) continue;

    const seg = ps.segment;
    if (seg.hours <= 0) continue;

    if (seg.dayType === 'weekday') {
      const influences = ps.timeCategoryInfluence ? [ps.timeCategoryInfluence] : [];
      const tc =
        seg.timeCategory ||
        getHighestTimeCategory(influences) ||
        'morning';

      entries.push({
        _psRef: ps,
        shiftId: ps.shiftId,
        isNursing: ps.shiftType === 'nursing_support',
        fieldName: `${tc}Hours`,
        dayType: 'weekday',
        hours: seg.hours,
        entryDate: seg.startUtc,
      });
    } else if (['saturday', 'sunday', 'holiday'].includes(seg.dayType)) {
      entries.push({
        shiftId: ps.shiftId,
        isNursing: ps.shiftType === 'nursing_support',
        fieldName: `${seg.dayType}Hours`,
        dayType: seg.dayType,
        hours: seg.hours,
        entryDate: seg.startUtc,
      });
    }
  }

  // Cleanup temporary references
  for (const entry of entries) {
    delete entry._psRef;
  }

  return { entries };
}

function processSingleChain(chain, data, ctx) {
  const { entries } = buildOrderedChainEntries(chain, ctx);

  const uniqueShiftIds = [...new Set(chain.map(ps => ps.shiftId))];
  const hasBroken = uniqueShiftIds.some(sid => ctx.shiftIsBroken.get(sid) === true);

  let perShiftOt = {};
  let calcEntries = [...entries];

  if (!hasBroken) {
    const activeSegs = chain.filter(
      (ps) =>
        ps.segment.hours > 0 &&
        !ctx.reclassifiedFullDoubleTimeShiftIds?.has(ps.shiftId)
    );
    const activeShiftIds = [...new Set(activeSegs.map((ps) => ps.shiftId))];
    const combinedActive = r2(
      activeShiftIds.reduce((sum, sid) => sum + (ctx.shiftActiveHours.get(sid) || 0), 0)
    );
    const allWeekday =
      activeSegs.length > 0 && activeSegs.every((ps) => ps.segment.dayType === 'weekday');
    const threshold = allWeekday ? MAX_REGULAR_HOURS_WEEKDAY : MAX_REGULAR_HOURS;

    // Do not treat post-sleepover ordinary hours as part of a pre-sleepover "night chain"
    // for daily-cap / OT spill (SCHADS 2026 sleepover loading decoupling).
    const chainHasSleepoverShift = activeSegs.some((ps) => ps.shiftType === 'sleepover');

    // SCHADS overnight continuity: when a continuous weekday chain originates as night,
    // keep the first ordinary-cap window on night loading before extracting overtime.
    if (
      !chainHasSleepoverShift &&
      allWeekday &&
      calcEntries.length > 0 &&
      calcEntries[0].fieldName === 'nightHours' &&
      threshold > 0
    ) {
      const locked = [];
      let ordinaryRemaining = threshold;
      for (const entry of calcEntries) {
        if (ordinaryRemaining <= 0) {
          locked.push(entry);
          continue;
        }
        const ordinaryPart = r2(Math.min(entry.hours, ordinaryRemaining));
        const remainderPart = r2(Math.max(0, entry.hours - ordinaryPart));
        if (ordinaryPart > 0) {
          locked.push({ ...entry, hours: ordinaryPart, fieldName: 'nightHours' });
          ordinaryRemaining = r2(Math.max(0, ordinaryRemaining - ordinaryPart));
        }
        if (remainderPart > 0) {
          locked.push({ ...entry, hours: remainderPart });
        }
      }
      calcEntries = locked;
    }

    if (combinedActive > threshold) {
      const otTotal = r2(combinedActive - threshold);
      const { otByDayType, otByShiftId } = deductOtFromEnd(calcEntries, otTotal);
      applyOtByDayType(otByDayType, data);
      perShiftOt = otByShiftId;
      // Meal allowance: 1 per shift where OT > 1h; additional 1 where OT > 4h
      if (otTotal > 1) data.mealAllowanceCount += 1;
      if (otTotal > 4) data.mealAllowanceCount += 1;
    }
  }

  for (const entry of calcEntries) {
    if (entry.hours > 0) {
      data[entry.fieldName] = r2((data[entry.fieldName] || 0) + entry.hours);
      if (entry.isNursing && entry.dayType === 'saturday') {
        data.nursingSaturdayHours = r2((data.nursingSaturdayHours || 0) + entry.hours);
      } else if (entry.isNursing && entry.dayType === 'sunday') {
        data.nursingSundayHours = r2((data.nursingSundayHours || 0) + entry.hours);
      } else if (entry.isNursing && entry.dayType === 'holiday') {
        data.nursingHolidayHours = r2((data.nursingHolidayHours || 0) + entry.hours);
      }
    }
  }

  return { entries: calcEntries.filter(e => e.hours > 0), perShiftOt };
}

function processContinuousChains(pendingSegments, data, ctx) {
  if (!pendingSegments.length) return { hourLedger: [], perShiftOt: {} };

  const chains = groupSegmentsIntoChains(pendingSegments);
  const hourLedger = [];
  const perShiftOt = {};

  for (const chain of chains) {
    const { entries: chainEntries, perShiftOt: chainOt } = processSingleChain(chain, data, ctx);
    hourLedger.push(...chainEntries);
    for (const [sid, otByDayType] of Object.entries(chainOt)) {
      if (!perShiftOt[sid]) perShiftOt[sid] = {};
      for (const [dt, h] of Object.entries(otByDayType)) {
        perShiftOt[sid][dt] = r2((perShiftOt[sid][dt] || 0) + h);
      }
    }
  }

  return { hourLedger, perShiftOt };
}

// ─── PER-SHIFT BREAKDOWNS ────────────────────────────────────────────────────

function buildPerShiftBreakdowns(hourLedger, perShiftOt, ctx, shifts) {
  const breakdowns = new Map();
  const shiftLookup = new Map(shifts.map(s => [String(s._id), s]));

  // Initialise breakdown record for every shift that has ledger entries
  for (const entry of hourLedger) {
    const sid = entry.shiftId;
    if (!sid) continue;
    if (!breakdowns.has(sid)) {
      const shift = shiftLookup.get(sid);
      breakdowns.set(sid, {
        morningHours: 0, afternoonHours: 0, nightHours: 0,
        saturdayHours: 0, sundayHours: 0, holidayHours: 0,
        nursingCareHours: 0,
        shortTurnaroundHours: 0,
        weekdayOtUpto2: 0, weekdayOtAfter2: 0,
        saturdayOtUpto2: 0, saturdayOtAfter2: 0,
        sundayOtUpto2: 0, sundayOtAfter2: 0,
        holidayOtUpto2: 0, holidayOtAfter2: 0,
        isBrokenShift: ctx.shiftIsBroken.get(sid) || false,
        isSleepover: shift?.shiftType === 'sleepover' || false,
        minimumEngagementException: ctx.shiftMinimumEngagementException.get(sid) || false,
        clientName: shift?.clientName || null,
        mileage: shift?.mileage ?? null,
        totalHours: computeShiftDurationHours(shift),
        shiftDate: shift?.startDatetime || null,
        shiftStart: shift?.startDatetime || null,
        shiftEnd: shift?.endDatetime || null,
        shiftType: shift?.shiftType || '',
        timezoneOffset: shift?.timezoneOffset || '+10:00',
      });
    }
    const bd = breakdowns.get(sid);
    if (entry.hours > 0) {
      bd[entry.fieldName] = r2((bd[entry.fieldName] || 0) + entry.hours);
    }
  }

  // Apply per-shift OT (tiered, same logic as applyOtByDayType)
  for (const [sid, otByDayType] of Object.entries(perShiftOt)) {
    if (!breakdowns.has(sid)) {
      const shift = shiftLookup.get(sid);
      breakdowns.set(sid, {
        morningHours: 0, afternoonHours: 0, nightHours: 0,
        saturdayHours: 0, sundayHours: 0, holidayHours: 0,
        nursingCareHours: 0,
        shortTurnaroundHours: 0,
        weekdayOtUpto2: 0, weekdayOtAfter2: 0,
        saturdayOtUpto2: 0, saturdayOtAfter2: 0,
        sundayOtUpto2: 0, sundayOtAfter2: 0,
        holidayOtUpto2: 0, holidayOtAfter2: 0,
        isBrokenShift: ctx.shiftIsBroken.get(sid) || false,
        isSleepover: shift?.shiftType === 'sleepover' || false,
        minimumEngagementException: ctx.shiftMinimumEngagementException.get(sid) || false,
        clientName: shift?.clientName || null,
        mileage: shift?.mileage ?? null,
        totalHours: computeShiftDurationHours(shift),
        shiftDate: shift?.startDatetime || null,
        shiftStart: shift?.startDatetime || null,
        shiftEnd: shift?.endDatetime || null,
        shiftType: shift?.shiftType || '',
        timezoneOffset: shift?.timezoneOffset || '+10:00',
      });
    }
    const bd = breakdowns.get(sid);
    for (const [dayType, otHours] of Object.entries(otByDayType)) {
      const tier1 = r2(Math.min(otHours, OT_TIER_1_MAX));
      const tier2 = r2(Math.max(0, otHours - OT_TIER_1_MAX));
      if (dayType === 'weekday') {
        bd.weekdayOtUpto2 = r2(bd.weekdayOtUpto2 + tier1);
        bd.weekdayOtAfter2 = r2(bd.weekdayOtAfter2 + tier2);
      } else if (dayType === 'saturday') {
        bd.saturdayOtUpto2 = r2(bd.saturdayOtUpto2 + tier1);
        bd.saturdayOtAfter2 = r2(bd.saturdayOtAfter2 + tier2);
      } else if (dayType === 'sunday') {
        bd.sundayOtUpto2 = r2(bd.sundayOtUpto2 + tier1);
        bd.sundayOtAfter2 = r2(bd.sundayOtAfter2 + tier2);
      } else if (dayType === 'holiday') {
        bd.holidayOtUpto2 = r2(bd.holidayOtUpto2 + tier1);
        bd.holidayOtAfter2 = r2(bd.holidayOtAfter2 + tier2);
      }
    }
  }

  // Handle nursing shifts — set nursingCareHours to the weekday portion only.
  // Non-weekday segments were already processed above via pendingSegments, so
  // saturdayHours/sundayHours/holidayHours are already in the breakdown.
  for (const shift of shifts) {
    const sid = String(shift._id);
    if (shift.shiftType !== 'nursing_support') continue;

    if (!breakdowns.has(sid)) {
      // Pure weekday nursing: no segments were added to pendingSegments, create entry now.
      breakdowns.set(sid, {
        morningHours: 0, afternoonHours: 0, nightHours: 0,
        saturdayHours: 0, sundayHours: 0, holidayHours: 0,
        nursingCareHours: shift.hours,
        shortTurnaroundHours: 0,
        weekdayOtUpto2: 0, weekdayOtAfter2: 0,
        saturdayOtUpto2: 0, saturdayOtAfter2: 0,
        sundayOtUpto2: 0, sundayOtAfter2: 0,
        holidayOtUpto2: 0, holidayOtAfter2: 0,
        isBrokenShift: ctx.shiftIsBroken.get(sid) || false,
        isSleepover: false,
        minimumEngagementException: ctx.shiftMinimumEngagementException.get(sid) || false,
        clientName: shift.clientName || null,
        mileage: shift.mileage ?? null,
        totalHours: computeShiftDurationHours(shift),
        shiftDate: shift.startDatetime,
        shiftStart: shift.startDatetime,
        shiftEnd: shift.endDatetime,
        shiftType: shift.shiftType,
      });
    }
  }

  // Handle sleepover with no excess
  for (const shift of shifts) {
    const sid = String(shift._id);
    if (shift.shiftType === 'sleepover' && !breakdowns.has(sid)) {
      breakdowns.set(sid, {
        morningHours: 0, afternoonHours: 0, nightHours: 0,
        saturdayHours: 0, sundayHours: 0, holidayHours: 0,
        nursingCareHours: 0,
        shortTurnaroundHours: 0,
        weekdayOtUpto2: 0, weekdayOtAfter2: 0,
        saturdayOtUpto2: 0, saturdayOtAfter2: 0,
        sundayOtUpto2: 0, sundayOtAfter2: 0,
        holidayOtUpto2: 0, holidayOtAfter2: 0,
        isBrokenShift: ctx.shiftIsBroken.get(sid) || false,
        isSleepover: true,
        minimumEngagementException: ctx.shiftMinimumEngagementException.get(sid) || false,
        clientName: shift.clientName || null,
        mileage: shift.mileage ?? null,
        totalHours: computeShiftDurationHours(shift),
        shiftDate: shift.startDatetime,
        shiftStart: shift.startDatetime,
        shiftEnd: shift.endDatetime,
        shiftType: shift.shiftType,
      });
    }
  }

  for (const [sid, stHours] of Object.entries(ctx.shortTurnaroundByShift || {})) {
    if (!breakdowns.has(sid)) {
      const shift = shiftLookup.get(sid);
      breakdowns.set(sid, {
        morningHours: 0, afternoonHours: 0, nightHours: 0,
        saturdayHours: 0, sundayHours: 0, holidayHours: 0,
        nursingCareHours: 0,
        shortTurnaroundHours: 0,
        weekdayOtUpto2: 0, weekdayOtAfter2: 0,
        saturdayOtUpto2: 0, saturdayOtAfter2: 0,
        sundayOtUpto2: 0, sundayOtAfter2: 0,
        holidayOtUpto2: 0, holidayOtAfter2: 0,
        isBrokenShift: ctx.shiftIsBroken.get(sid) || false,
        isSleepover: shift?.shiftType === 'sleepover' || false,
        minimumEngagementException: ctx.shiftMinimumEngagementException.get(sid) || false,
        clientName: shift?.clientName || null,
        mileage: shift?.mileage ?? null,
        totalHours: computeShiftDurationHours(shift),
        shiftDate: shift?.startDatetime || null,
        shiftStart: shift?.startDatetime || null,
        shiftEnd: shift?.endDatetime || null,
        shiftType: shift?.shiftType || '',
        timezoneOffset: shift?.timezoneOffset || '+10:00',
      });
    }
    const bd = breakdowns.get(sid);
    bd.shortTurnaroundHours = r2((bd.shortTurnaroundHours || 0) + stHours);
  }

  return breakdowns;
}

// ─── PROCESS SHIFT FOR PAY HOURS ─────────────────────────────────────────────

function processShiftForPayHours(shift, ctx, sleepovernAttachedNight = false, isPreSleepover = false, isPostSleepover = false) {
  const offsetStr = shift.timezoneOffset || '+10:00';
  const startUtc = new Date(shift.startDatetime);
  const endUtc = new Date(shift.endDatetime);
  const derivedHours = r2((endUtc - startUtc) / 3600000);
  const normalizedHours = normalizeShiftHours(shift, startUtc, endUtc);

  // Check if continuous with previous shift (gap = 0ms)
  let isContinuous = false;
  let gapMs = null;
  if (ctx.previousEndUtc !== null) {
    gapMs = startUtc - ctx.previousEndUtc;
    isContinuous =
      gapMs === 0 &&
      ctx.previousShiftType !== 'sleepover' &&
      shift.shiftType !== 'sleepover';
  }
  const requiredBreakMs = ctx.previousTurnaroundBreakMs ?? MIN_BREAK_BETWEEN_SHIFTS_MS;
  // Broken-shift marker (ShiftCare inadequate-rest split): use broken-shift OT + allowance rules,
  // not the separate short-turnaround 2× bucket (would suppress processBrokenShiftOvertime).
  const shortTurnaround =
    gapMs !== null &&
    gapMs > 0 &&
    gapMs < requiredBreakMs &&
    !shift.isBrokenShift;

  const sid = String(shift._id);
  const activeHours = calculateActiveHours(normalizedHours, shift.shiftType);
  const minimumEngagementException = isMinimumEngagementException(shift.shiftType, normalizedHours);
  ctx.shiftActiveHours.set(sid, activeHours);
  ctx.shiftIsBroken.set(sid, shift.isBrokenShift);
  ctx.shiftMinimumEngagementException.set(sid, minimumEngagementException);

  const isSleepoverNoExcess = shift.shiftType === 'sleepover' && activeHours <= 0;
  if (shift.shiftType === 'sleepover') ctx.data.sleepoversCount += 1;

  /** PC/nursing stacked before or after sleepovern bills as SCHADS weekday night (overrides PH/Sat/Sun buckets). */
  const attachNight = !!sleepovernAttachedNight;
  // Only apply pre/post sleepover band rules to non-sleepover shifts
  const isSleepoverShift = shift.shiftType === 'sleepover';

  // Create segments
  let segments = [];
  const segmentOpts = {
    forceWeekdayNight: attachNight,
    isPostSleepoverWeekday: !isSleepoverShift && isPostSleepover,
  };

  if (shift.shiftType === 'nursing_support') {
    // Split by day type so Saturday/Sunday/Holiday nursing attracts the correct penalty
    // rates. Weekday nursing still accumulates in nursingCareHours (paid at daytime rate).
    // All segments are kept on processedShift so broken-shift OT detection works.
      let nsSegments = splitShiftAtMidnight(startUtc, endUtc, normalizedHours, shift.shiftType, offsetStr, ctx.holidaySet, segmentOpts);
    if (attachNight) nsSegments = applySleepovernChainNightSegments(nsSegments);

    if (attachNight) {
      for (let i = 0; i < nsSegments.length; i++) {
        const seg = nsSegments[i];
        if (seg.hours <= 0) continue;
        const segContinuous = i === 0 ? isContinuous : true;
        ctx.pendingSegments.push({ segment: seg, shiftId: sid, shiftType: shift.shiftType, isContinuousWithPrevious: segContinuous, timeCategoryInfluence: null });
      }
      segments = nsSegments;
    } else {
      for (let i = 0; i < nsSegments.length; i++) {
        const seg = nsSegments[i];
        if (seg.dayType === 'weekday') {
          if (!shortTurnaround) {
            ctx.data.nursingCareHours = r2(ctx.data.nursingCareHours + seg.hours);
            ctx.nursingWeekdayLedger.push({
              shiftId: sid,
              fieldName: 'nursingCareHours',
              dayType: 'weekday',
              hours: seg.hours,
              entryDate: seg.startUtc,
              isNursing: true,
            });
          }
        } else {
          const segContinuous = i === 0 ? isContinuous : true;
          ctx.pendingSegments.push({ segment: seg, shiftId: sid, shiftType: shift.shiftType, isContinuousWithPrevious: segContinuous, timeCategoryInfluence: null });
        }
      }
      segments = nsSegments;
    }
  } else if (!isSleepoverNoExcess) {
    segments = splitShiftAtMidnight(startUtc, endUtc, normalizedHours, shift.shiftType, offsetStr, ctx.holidaySet, segmentOpts);
    if (
      attachNight &&
      (shift.shiftType === 'personal_care' || shift.shiftType === 'nursing_support')
    ) {
      segments = applySleepovernChainNightSegments(segments);
    }
    // Add segments to pending list
    for (let i = 0; i < segments.length; i++) {
      const segContinuous = i === 0 ? isContinuous : true;
      ctx.pendingSegments.push({ segment: segments[i], shiftId: sid, shiftType: shift.shiftType, isContinuousWithPrevious: segContinuous, timeCategoryInfluence: null });
    }
  }
  // Sleepover with no excess: add placeholder for chain influence
  if (isSleepoverNoExcess) {
    const wd = localWeekday(startUtc, offsetStr);
    if (wd < 5) { // weekday — sleepover hours are night band for SCHADS
      const timeCat = 'night';
      const placeholder = { startUtc, endUtc, hours: 0, dayType: 'weekday', timeCategory: timeCat, isSleepoverExcess: true };
      ctx.pendingSegments.push({ segment: placeholder, shiftId: sid, shiftType: shift.shiftType, isContinuousWithPrevious: isContinuous, timeCategoryInfluence: timeCat });
    }
  }

  // Short turnaround (<10h break) override: current shift paid at double time
  // until a compliant break is achieved. Reclassify this shift's active hours to OT tier 2.
  if (shortTurnaround && activeHours > 0) {
    if (shift.shiftType === 'nursing_support') {
      const weekdayNursingHours = r2(
        (segments || [])
          .filter((seg) => seg && seg.hours > 0 && seg.dayType === 'weekday')
          .reduce((sum, seg) => sum + seg.hours, 0)
      );
      if (weekdayNursingHours > 0) {
        ctx.data.nursingCareHours = r2(Math.max(0, ctx.data.nursingCareHours - weekdayNursingHours));
      }
      if (ctx.nursingWeekdayLedger?.length) {
        ctx.nursingWeekdayLedger = ctx.nursingWeekdayLedger.filter((e) => e.shiftId !== sid);
      }
    }

    for (const seg of segments || []) {
      if (!seg || seg.hours <= 0) continue;
      ctx.data.shortTurnaroundHours = r2((ctx.data.shortTurnaroundHours || 0) + seg.hours);
    }
    ctx.shortTurnaroundByShift[sid] = r2((ctx.shortTurnaroundByShift[sid] || 0) + activeHours);
    ctx.reclassifiedFullDoubleTimeShiftIds.add(sid);
  }

  // Create processed shift record
  const processedShift = {
    shiftId: sid,
    startUtc,
    endUtc,
    shiftType: shift.shiftType,
    hours: normalizedHours,
    activeHours,
    isBrokenShift: shift.isBrokenShift,
    isContinuous,
    segments,
  };

  handleBrokenShift(shift, processedShift, ctx.processedShifts, ctx.data, ctx);
  ctx.processedShifts.push(processedShift);
  ctx.previousEndUtc = endUtc;
  ctx.previousShiftType = shift.shiftType;
  const isSleepoverLinkedShift =
    shift.shiftType === 'sleepover' ||
    isPreSleepover ||
    isPostSleepover;
  ctx.previousTurnaroundBreakMs =
    isSleepoverLinkedShift
      ? MIN_BREAK_AFTER_SLEEPOVER_MS
      : MIN_BREAK_BETWEEN_SHIFTS_MS;
}

// ─── MAIN ENTRY POINT ─────────────────────────────────────────────────────────

/**
 * Compute pay hours for a single staff member.
 *
 * @param {Array} shifts - Mongoose Shift documents, sorted by startDatetime ASC
 * @param {Set<string>} holidaySet - Set of "YYYY-MM-DD" local date strings
 * @returns {{ data: PayHoursData, shiftBreakdowns: Map<shiftId, breakdown> }}
 */
export function computePayHoursForStaff(shifts, holidaySet) {
  const data = newPayHoursData();

  if (!shifts.length) {
    return { data, shiftBreakdowns: new Map() };
  }

  const sleepovernAttachedNight = computeSleepovernAttachedNight(shifts);
  const { isPreSleepover, isPostSleepover } = computeSleepoverAdjacentFlags(shifts);

  const ctx = {
    holidaySet,
    data,
    pendingSegments: [],
    nursingWeekdayLedger: [],
    processedShifts: [],
    previousEndUtc: null,
    previousShiftType: null,
    previousTurnaroundBreakMs: MIN_BREAK_BETWEEN_SHIFTS_MS,
    shiftActiveHours: new Map(),
    shiftIsBroken: new Map(),
    shiftMinimumEngagementException: new Map(),
    reclassifiedFullDoubleTimeShiftIds: new Set(),
    shortTurnaroundByShift: {},
  };

  for (let i = 0; i < shifts.length; i++) {
    processShiftForPayHours(shifts[i], ctx, sleepovernAttachedNight[i], isPreSleepover[i], isPostSleepover[i]);
  }

  resolveMinimumEngagementChains(shifts, ctx);

  // Apply continuous chain logic first (OT deduction mutates entries)
  const { hourLedger, perShiftOt } = processContinuousChains(ctx.pendingSegments, data, ctx);

  // 76h cap must see ALL ordinary hours (including weekday nursingCareHours which bypass chain processing)
  const capLedger = [...hourLedger, ...ctx.nursingWeekdayLedger];

  // Apply 76-hour cap (mutates ledger + data)
  apply76HourCap(data, capLedger);

  // Build per-shift breakdowns from the post-OT-deduction + post-76h-cap ledger
  const shiftBreakdowns = buildPerShiftBreakdowns(capLedger, perShiftOt, ctx, shifts);

  return { data, shiftBreakdowns };
}
