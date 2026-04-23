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
/** Weekday personal care: ordinary hours in a shift before daily OT (SCHADS). */
const MAX_REGULAR_HOURS_WEEKDAY = 4;
const SLEEPOVER_DEDUCTION = 8;
const OT_TIER_1_MAX = 2;
const TOTAL_HOURS_CAP = 76;
const BROKEN_SHIFT_SHORT_SPAN = 12;

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
  const startDate = localDateStr(startUtc, offsetStr);
  const endDate = localDateStr(endUtc, offsetStr);
  const endHour = localHour(endUtc, offsetStr);
  const endMin = toLocal(endUtc, offsetStr).getUTCMinutes();

  // Night: starts before 6am OR crosses midnight (end on different day)
  if (startHour < MORNING_START || startDate !== endDate) return 'night';

  // Morning: starts >= 6am AND ends at/before 20:00
  if (startHour >= MORNING_START && (endHour < AFTERNOON_START || (endHour === AFTERNOON_START && endMin === 0))) {
    return 'morning';
  }

  // Afternoon: ends after 20:00 (same day)
  return 'afternoon';
}

// ─── SHIFT SEGMENT CREATION ──────────────────────────────────────────────────

/**
 * ShiftSegment: { startUtc, endUtc, hours, dayType, timeCategory, isSleepoverExcess }
 */

function createSingleDaySegment(startUtc, endUtc, hours, shiftType, offsetStr, holidaySet) {
  const dayType = getDayType(startUtc, offsetStr, holidaySet);
  const timeCategory = dayType === 'weekday' ? getTimeCategory(startUtc, endUtc, offsetStr) : null;

  let segHours = hours;
  let isSleepoverExcess = false;

  if (shiftType === 'sleepover') {
    segHours = r2(Math.max(0, hours - SLEEPOVER_DEDUCTION));
    isSleepoverExcess = true;
    if (segHours <= 0) return [];
  }

  return [{ startUtc, endUtc, hours: segHours, dayType, timeCategory, isSleepoverExcess }];
}

function createNightShiftSegment(startUtc, endUtc, hours, shiftType) {
  let segHours = hours;
  let isSleepoverExcess = false;

  if (shiftType === 'sleepover') {
    segHours = r2(Math.max(0, hours - SLEEPOVER_DEDUCTION));
    isSleepoverExcess = true;
    if (segHours <= 0) return [];
  }

  return [{ startUtc, endUtc, hours: segHours, dayType: 'weekday', timeCategory: 'night', isSleepoverExcess }];
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
    const day2TimeCat = day2Type === 'weekday' ? getTimeCategory(midnightUtc, endUtc, offsetStr) : null;
    segments.push({ startUtc: midnightUtc, endUtc, hours: remainingHours, dayType: day2Type, timeCategory: day2TimeCat, isSleepoverExcess: true });
  }

  return segments;
}

function splitAtChristmasEve6pm(startUtc, endUtc, hours, shiftType, offsetStr, holidaySet) {
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
  const beforeTimeCat = beforeDayType === 'weekday' ? getTimeCategory(startUtc, holidayStartUtc, offsetStr) : null;

  if (shiftType === 'sleepover') {
    return splitSleepoverAtChristmasEve6pm(
      startUtc, endUtc, holidayStartUtc, midnightUtc,
      beforeHours, afterHours, remainingHours,
      beforeDayType, beforeTimeCat, offsetStr, holidaySet
    );
  }

  const segments = [];

  if (beforeHours > 0) {
    segments.push({ startUtc, endUtc: holidayStartUtc, hours: beforeHours, dayType: beforeDayType, timeCategory: beforeTimeCat, isSleepoverExcess: false });
  }
  if (afterHours > 0) {
    const afterEnd = midnightUtc === null ? endUtc : midnightUtc;
    segments.push({ startUtc: holidayStartUtc, endUtc: afterEnd, hours: afterHours, dayType: 'holiday', timeCategory: null, isSleepoverExcess: false });
  }
  if (remainingHours > 0 && midnightUtc !== null) {
    const day2Type = getDayType(endUtc, offsetStr, holidaySet);
    const day2TimeCat = day2Type === 'weekday' ? getTimeCategory(midnightUtc, endUtc, offsetStr) : null;
    segments.push({ startUtc: midnightUtc, endUtc, hours: remainingHours, dayType: day2Type, timeCategory: day2TimeCat, isSleepoverExcess: false });
  }

  return segments;
}

function splitSleepoverAtMidnight(startUtc, endUtc, midnightUtc, day1Type, day2Type, day1Hours, day2Hours, offsetStr) {
  const segments = [];

  if (day1Hours >= SLEEPOVER_DEDUCTION) {
    const day1Excess = r2(day1Hours - SLEEPOVER_DEDUCTION);
    if (day1Excess > 0) {
      const day1TimeCat = day1Type === 'weekday' ? getTimeCategory(startUtc, midnightUtc, offsetStr) : null;
      segments.push({ startUtc, endUtc: midnightUtc, hours: day1Excess, dayType: day1Type, timeCategory: day1TimeCat, isSleepoverExcess: true });
    }
    if (day2Hours > 0) {
      const day2TimeCat = day2Type === 'weekday' ? getTimeCategory(midnightUtc, endUtc, offsetStr) : null;
      segments.push({ startUtc: midnightUtc, endUtc, hours: day2Hours, dayType: day2Type, timeCategory: day2TimeCat, isSleepoverExcess: true });
    }
  } else {
    const remainingDeduction = r2(SLEEPOVER_DEDUCTION - day1Hours);
    const day2Excess = r2(day2Hours - remainingDeduction);
    if (day2Excess > 0) {
      const day2TimeCat = day2Type === 'weekday' ? getTimeCategory(midnightUtc, endUtc, offsetStr) : null;
      segments.push({ startUtc: midnightUtc, endUtc, hours: day2Excess, dayType: day2Type, timeCategory: day2TimeCat, isSleepoverExcess: true });
    }
  }

  return segments;
}

/**
 * Split a shift at midnight (and/or Christmas Eve 6pm) into segments.
 * Returns array of ShiftSegment objects.
 */
function splitShiftAtMidnight(startUtc, endUtc, hours, shiftType, offsetStr, holidaySet) {
  // Christmas Eve 6pm split takes priority
  if (shiftSpansChristmasEve6pm(startUtc, endUtc, offsetStr)) {
    return splitAtChristmasEve6pm(startUtc, endUtc, hours, shiftType, offsetStr, holidaySet);
  }

  const startDateStr = localDateStr(startUtc, offsetStr);
  const endDateStr = localDateStr(endUtc, offsetStr);

  // Same local day — no midnight split
  if (startDateStr === endDateStr) {
    return createSingleDaySegment(startUtc, endUtc, hours, shiftType, offsetStr, holidaySet);
  }

  // Ends exactly at local midnight (00:00)
  const endLocalHour = localHour(endUtc, offsetStr);
  const endLocalMin = toLocal(endUtc, offsetStr).getUTCMinutes();
  if (endLocalHour === 0 && endLocalMin === 0) {
    const dayType = getDayType(startUtc, offsetStr, holidaySet);
    let segHours = hours;
    let isSleepoverExcess = false;

    if (shiftType === 'sleepover') {
      segHours = r2(Math.max(0, hours - SLEEPOVER_DEDUCTION));
      isSleepoverExcess = true;
      if (segHours <= 0) return [];
    }

    let timeCategory = null;
    if (dayType === 'weekday') {
      const startHour = localHour(startUtc, offsetStr);
      if (startHour < MORNING_START) {
        timeCategory = 'night';
      } else {
        timeCategory = 'afternoon'; // starts in morning/afternoon window but ends at midnight
      }
    }

    return [{ startUtc, endUtc, hours: segHours, dayType, timeCategory, isSleepoverExcess }];
  }

  // Shift crosses midnight — check day types
  const day1Type = getDayType(startUtc, offsetStr, holidaySet);
  const day2Type = getDayType(endUtc, offsetStr, holidaySet);

  // Both weekdays = night hours (no split)
  if (day1Type === 'weekday' && day2Type === 'weekday') {
    return createNightShiftSegment(startUtc, endUtc, hours, shiftType);
  }

  // One day is special — split at midnight
  const midnightUtc = localMidnightAfter(startUtc, offsetStr);
  const day1Hours = r2((midnightUtc - startUtc) / 3600000);
  const day2Hours = r2((endUtc - midnightUtc) / 3600000);

  if (shiftType === 'sleepover') {
    return splitSleepoverAtMidnight(startUtc, endUtc, midnightUtc, day1Type, day2Type, day1Hours, day2Hours, offsetStr);
  }

  const day1TimeCat = day1Type === 'weekday' ? getTimeCategory(startUtc, midnightUtc, offsetStr) : null;
  const day2TimeCat = day2Type === 'weekday' ? getTimeCategory(midnightUtc, endUtc, offsetStr) : null;

  return [
    { startUtc, endUtc: midnightUtc, hours: day1Hours, dayType: day1Type, timeCategory: day1TimeCat, isSleepoverExcess: false },
    { startUtc: midnightUtc, endUtc, hours: day2Hours, dayType: day2Type, timeCategory: day2TimeCat, isSleepoverExcess: false },
  ];
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
    otAfter76Hours: 0,
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
  if (previousShifts.length >= 2) {
    // 2nd break in same day — upgrade from 1-break to 2-break (don't double-count)
    data.brokenShiftCount       = Math.max(0, data.brokenShiftCount - 1);
    data.brokenShift2BreakCount += 1;
  } else {
    // First break in this day
    data.brokenShiftCount += 1;
  }

  if (!previousShifts.length || !currentShift.segments.length) return;

  const spanStart = previousShifts[0].startUtc;
  const spanEnd = currentShift.endUtc;
  const spanHours = r2((spanEnd - spanStart) / 3600000);

  const totalActive = r2(
    previousShifts.reduce((sum, s) => sum + s.activeHours, 0) + currentShift.activeHours
  );

  const dayType = currentShift.segments[0].dayType;

  if (spanHours < BROKEN_SHIFT_SHORT_SPAN) {
    // Span < 12h: OT at 1.5× for active hours beyond daily ordinary cap (weekday 4h / other 10h)
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

  processBrokenShiftOvertime(processedShift, previousInSpan, data, ctx);
}

// ─── ACTIVE HOURS ─────────────────────────────────────────────────────────────

function calculateActiveHours(hours, shiftType) {
  if (shiftType === 'sleepover') return r2(Math.max(0, hours - SLEEPOVER_DEDUCTION));
  return hours;
}

// ─── 76-HOUR CAP ─────────────────────────────────────────────────────────────

function apply76HourCap(data, hourLedger) {
  const totalRegular = r2(
    data.morningHours + data.afternoonHours + data.nightHours +
    data.saturdayHours + data.sundayHours + data.holidayHours +
    data.nursingCareHours
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
    if (!seg.isContinuousWithPrevious || !currentChain.length) {
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

  for (let i = entries.length - 1; i >= 0; i--) {
    if (otRemaining <= 0) break;
    const entry = entries[i];
    const deduct = r2(Math.min(entry.hours, otRemaining));
    entry.hours = r2(entry.hours - deduct);
    otRemaining = r2(otRemaining - deduct);
    otByDayType[entry.dayType] = r2((otByDayType[entry.dayType] || 0) + deduct);
  }

  return { entries, otByDayType };
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
  let highestCategory = null;

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
        fieldName: `${tc}Hours`,
        dayType: 'weekday',
        hours: seg.hours,
        entryDate: seg.startUtc,
      });
      highestCategory =
        highestCategory && TIME_CATEGORY_PRIORITY[tc] !== undefined && TIME_CATEGORY_PRIORITY[highestCategory] !== undefined
          ? TIME_CATEGORY_PRIORITY[tc] > TIME_CATEGORY_PRIORITY[highestCategory]
            ? tc
            : highestCategory
          : tc;
    } else if (['saturday', 'sunday', 'holiday'].includes(seg.dayType)) {
      entries.push({
        fieldName: `${seg.dayType}Hours`,
        dayType: seg.dayType,
        hours: seg.hours,
        entryDate: seg.startUtc,
      });
    }
  }

  return { entries, highestCategory };
}

function processSingleChain(chain, data, ctx) {
  const { entries } = buildOrderedChainEntries(chain, ctx);

  const uniqueShiftIds = [...new Set(chain.map(ps => ps.shiftId))];
  const hasBroken = uniqueShiftIds.some(sid => ctx.shiftIsBroken.get(sid) === true);

  if (!hasBroken) {
    const combinedActive = r2(
      uniqueShiftIds.reduce((sum, sid) => sum + (ctx.shiftActiveHours.get(sid) || 0), 0)
    );
    const activeSegs = chain.filter(
      (ps) =>
        ps.segment.hours > 0 &&
        !ctx.reclassifiedFullDoubleTimeShiftIds?.has(ps.shiftId)
    );
    const allWeekday =
      activeSegs.length > 0 && activeSegs.every((ps) => ps.segment.dayType === 'weekday');
    const threshold = allWeekday ? MAX_REGULAR_HOURS_WEEKDAY : MAX_REGULAR_HOURS;
    if (combinedActive > threshold) {
      const otTotal = r2(combinedActive - threshold);
      const { otByDayType } = deductOtFromEnd(entries, otTotal);
      applyOtByDayType(otByDayType, data);
      // Meal allowance: 1 per shift where OT > 1h; additional 1 where OT > 4h
      if (otTotal > 1) data.mealAllowanceCount += 1;
      if (otTotal > 4) data.mealAllowanceCount += 1;
    }
  }

  for (const entry of entries) {
    if (entry.hours > 0) {
      data[entry.fieldName] = r2((data[entry.fieldName] || 0) + entry.hours);
    }
  }

  return entries.filter(e => e.hours > 0);
}

function processContinuousChains(pendingSegments, data, ctx) {
  if (!pendingSegments.length) return [];

  const chains = groupSegmentsIntoChains(pendingSegments);
  const hourLedger = [];

  for (const chain of chains) {
    const chainEntries = processSingleChain(chain, data, ctx);
    hourLedger.push(...chainEntries);
  }

  return hourLedger;
}

// ─── PER-SHIFT BREAKDOWNS ────────────────────────────────────────────────────

function buildPerShiftBreakdowns(ctx, shifts) {
  const breakdowns = new Map();
  const shiftLookup = new Map(shifts.map(s => [String(s._id), s]));

  for (const ps of ctx.pendingSegments) {
    if (ctx.reclassifiedFullDoubleTimeShiftIds?.has(ps.shiftId)) continue;

    const sid = ps.shiftId;
    if (!breakdowns.has(sid)) {
      const shift = shiftLookup.get(sid);
      breakdowns.set(sid, {
        morningHours: 0, afternoonHours: 0, nightHours: 0,
        saturdayHours: 0, sundayHours: 0, holidayHours: 0,
        nursingCareHours: 0,
        isBrokenShift: ctx.shiftIsBroken.get(sid) || false,
        isSleepover: shift?.shiftType === 'sleepover' || false,
        clientName: shift?.clientName || null,
        mileage: shift?.mileage ?? null,
        totalHours: shift?.hours || 0,
        shiftDate: shift?.startDatetime || null,
        shiftStart: shift?.startDatetime || null,
        shiftEnd: shift?.endDatetime || null,
        shiftType: shift?.shiftType || '',
      });
    }

    const seg = ps.segment;
    if (seg.hours <= 0) continue;

    let fieldName;
    if (seg.dayType === 'weekday') {
      const influences = ps.timeCategoryInfluence ? [ps.timeCategoryInfluence] : [];
      const tc = seg.timeCategory || getHighestTimeCategory(influences) || 'morning';
      fieldName = `${tc}Hours`;
    } else if (['saturday', 'sunday', 'holiday'].includes(seg.dayType)) {
      fieldName = `${seg.dayType}Hours`;
    } else {
      continue;
    }

    const bd = breakdowns.get(sid);
    bd[fieldName] = r2((bd[fieldName] || 0) + seg.hours);
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
        isBrokenShift: ctx.shiftIsBroken.get(sid) || false,
        isSleepover: false,
        clientName: shift.clientName || null,
        mileage: shift.mileage ?? null,
        totalHours: shift.hours,
        shiftDate: shift.startDatetime,
        shiftStart: shift.startDatetime,
        shiftEnd: shift.endDatetime,
        shiftType: shift.shiftType,
      });
    } else {
      // Mixed nursing (some non-weekday segments already in breakdown).
      // nursingCareHours = weekday portion = total hours minus penalty-day hours.
      const bd = breakdowns.get(sid);
      const penaltyHours = r2((bd.saturdayHours || 0) + (bd.sundayHours || 0) + (bd.holidayHours || 0));
      bd.nursingCareHours = r2(shift.hours - penaltyHours);
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
        isBrokenShift: ctx.shiftIsBroken.get(sid) || false,
        isSleepover: true,
        clientName: shift.clientName || null,
        mileage: shift.mileage ?? null,
        totalHours: shift.hours,
        shiftDate: shift.startDatetime,
        shiftStart: shift.startDatetime,
        shiftEnd: shift.endDatetime,
        shiftType: shift.shiftType,
      });
    }
  }

  return breakdowns;
}

// ─── PROCESS SHIFT FOR PAY HOURS ─────────────────────────────────────────────

function processShiftForPayHours(shift, ctx) {
  const offsetStr = shift.timezoneOffset || '+10:00';
  const startUtc = new Date(shift.startDatetime);
  const endUtc = new Date(shift.endDatetime);

  // Check if continuous with previous shift (gap = 0ms)
  let isContinuous = false;
  if (ctx.previousEndUtc !== null) {
    const gap = startUtc - ctx.previousEndUtc;
    isContinuous = gap === 0;
  }

  const activeHours = calculateActiveHours(shift.hours, shift.shiftType);
  const sid = String(shift._id);
  ctx.shiftActiveHours.set(sid, activeHours);
  ctx.shiftIsBroken.set(sid, shift.isBrokenShift);

  const isSleepoverNoExcess = shift.shiftType === 'sleepover' && activeHours <= 0;
  if (shift.shiftType === 'sleepover') ctx.data.sleepoversCount += 1;

  // Create segments
  let segments = [];
  if (shift.shiftType === 'nursing_support') {
    // Split by day type so Saturday/Sunday/Holiday nursing attracts the correct penalty
    // rates. Weekday nursing still accumulates in nursingCareHours (paid at daytime rate).
    // All segments are kept on processedShift so broken-shift OT detection works.
    const nsSegments = splitShiftAtMidnight(startUtc, endUtc, shift.hours, shift.shiftType, offsetStr, ctx.holidaySet);
    for (let i = 0; i < nsSegments.length; i++) {
      const seg = nsSegments[i];
      if (seg.dayType === 'weekday') {
        // Weekday nursing: track separately at daytime rate
        ctx.data.nursingCareHours = r2(ctx.data.nursingCareHours + seg.hours);
      } else {
        // Saturday / Sunday / Holiday nursing: chain processing applies penalty rates
        const segContinuous = i === 0 ? isContinuous : true;
        ctx.pendingSegments.push({ segment: seg, shiftId: sid, isContinuousWithPrevious: segContinuous, timeCategoryInfluence: null });
      }
    }
    segments = nsSegments; // processedShift needs non-empty segments for broken-shift OT
  } else if (!isSleepoverNoExcess) {
    segments = splitShiftAtMidnight(startUtc, endUtc, shift.hours, shift.shiftType, offsetStr, ctx.holidaySet);
    // Add segments to pending list
    for (let i = 0; i < segments.length; i++) {
      const segContinuous = i === 0 ? isContinuous : true;
      ctx.pendingSegments.push({ segment: segments[i], shiftId: sid, isContinuousWithPrevious: segContinuous, timeCategoryInfluence: null });
    }
  }

  // Sleepover with no excess: add placeholder for chain influence
  if (isSleepoverNoExcess) {
    const wd = localWeekday(startUtc, offsetStr);
    if (wd < 5) { // weekday
      const timeCat = getTimeCategory(startUtc, endUtc, offsetStr);
      const placeholder = { startUtc, endUtc, hours: 0, dayType: 'weekday', timeCategory: timeCat, isSleepoverExcess: true };
      ctx.pendingSegments.push({ segment: placeholder, shiftId: sid, isContinuousWithPrevious: isContinuous, timeCategoryInfluence: timeCat });
    }
  }

  // Create processed shift record
  const processedShift = {
    shiftId: sid,
    startUtc,
    endUtc,
    shiftType: shift.shiftType,
    hours: shift.hours,
    activeHours,
    isBrokenShift: shift.isBrokenShift,
    segments,
  };

  handleBrokenShift(shift, processedShift, ctx.processedShifts, ctx.data, ctx);
  ctx.processedShifts.push(processedShift);
  ctx.previousEndUtc = endUtc;
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

  const ctx = {
    holidaySet,
    data,
    pendingSegments: [],
    processedShifts: [],
    previousEndUtc: null,
    shiftActiveHours: new Map(),
    shiftIsBroken: new Map(),
    reclassifiedFullDoubleTimeShiftIds: new Set(),
  };

  for (const shift of shifts) {
    processShiftForPayHours(shift, ctx);
  }

  // Build per-shift breakdowns BEFORE chain processing modifies data
  const shiftBreakdowns = buildPerShiftBreakdowns(ctx, shifts);

  // Apply continuous chain logic
  const hourLedger = processContinuousChains(ctx.pendingSegments, data, ctx);

  // Apply 76-hour cap
  apply76HourCap(data, hourLedger);

  return { data, shiftBreakdowns };
}
