/** Staff-level fields users may override (mirrors SchadsCalculator EDITABLE_FIELDS). */
export const STAFF_MANUAL_FIELD_KEYS = new Set([
  'morningHours',
  'afternoonHours',
  'nightHours',
  'weekdayOtUpto2',
  'weekdayOtAfter2',
  'saturdayHours',
  'saturdayOtUpto2',
  'saturdayOtAfter2',
  'sundayHours',
  'sundayOtUpto2',
  'sundayOtAfter2',
  'holidayHours',
  'holidayOtUpto2',
  'holidayOtAfter2',
  'nursingCareHours',
  'brokenShiftCount',
  'brokenShift2BreakCount',
  'sleepoversCount',
  'otAfter76Weekday',
  'otAfter76Saturday',
  'otAfter76Sunday',
  'otAfter76Holiday',
  'additionalAllowance',
]);

/** Per-shift bucket fields users may override. */
export const SHIFT_MANUAL_FIELD_KEYS = new Set([
  'morningHours',
  'afternoonHours',
  'nightHours',
  'saturdayHours',
  'sundayHours',
  'holidayHours',
  'nursingCareHours',
  'shortTurnaroundHours',
  'weekdayOtUpto2',
  'weekdayOtAfter2',
  'saturdayOtUpto2',
  'saturdayOtAfter2',
  'sundayOtUpto2',
  'sundayOtAfter2',
  'holidayOtUpto2',
  'holidayOtAfter2',
]);

export function manualFieldsToObject(manualFields) {
  if (!manualFields) return {};
  if (manualFields instanceof Map) {
    return Object.fromEntries(manualFields.entries());
  }
  if (typeof manualFields === 'object') return { ...manualFields };
  return {};
}

export function pickManualFields(body, allowedKeys) {
  const out = {};
  if (!body || typeof body !== 'object') return out;
  for (const [key, raw] of Object.entries(body)) {
    if (!allowedKeys.has(key)) continue;
    const n = Number(raw);
    if (!Number.isFinite(n)) continue;
    out[key] = Math.round(n * 100) / 100;
  }
  return out;
}

/** Merge computed document fields with manual overrides (manual wins). */
export function applyManualFields(doc, manualFieldsObj, fieldKeys) {
  const manual = manualFieldsToObject(manualFieldsObj);
  const effective = { ...doc };
  for (const key of fieldKeys) {
    if (key in manual) effective[key] = manual[key];
  }
  return effective;
}

export function serializePayHoursRecord(doc) {
  const plain = doc?.toObject ? doc.toObject() : { ...doc };
  const manualFields = manualFieldsToObject(plain.manualFields);
  const computed = { ...plain };
  const effective = applyManualFields(plain, manualFields, STAFF_MANUAL_FIELD_KEYS);
  return {
    ...effective,
    _id: plain._id,
    location: plain.location,
    staffName: plain.staffName,
    periodStart: plain.periodStart,
    periodEnd: plain.periodEnd,
    computedAt: plain.computedAt,
    isManuallyAdjusted: plain.isManuallyAdjusted || Object.keys(manualFields).length > 0,
    manualFields,
    computed: Object.fromEntries(
      [...STAFF_MANUAL_FIELD_KEYS].filter((k) => k in plain).map((k) => [k, plain[k]])
    ),
    adjustedAt: plain.adjustedAt ?? null,
    adjustedBy: plain.adjustedBy ?? null,
    totalKm: plain.totalKm,
    minimumEngagementExceptionCount: plain.minimumEngagementExceptionCount,
    mealAllowanceCount: plain.mealAllowanceCount,
    otAfter76Hours: plain.otAfter76Hours,
    shortTurnaroundHours: plain.shortTurnaroundHours,
    nursingAfternoonHours: plain.nursingAfternoonHours,
    nursingNightHours: plain.nursingNightHours,
    nursingSaturdayHours: plain.nursingSaturdayHours,
    nursingSundayHours: plain.nursingSundayHours,
    nursingHolidayHours: plain.nursingHolidayHours,
  };
}

export function serializeShiftPayHoursRecord(doc) {
  const plain = doc?.toObject ? doc.toObject() : { ...doc };
  const manualFields = manualFieldsToObject(plain.manualFields);
  const effective = applyManualFields(plain, manualFields, SHIFT_MANUAL_FIELD_KEYS);
  return {
    ...effective,
    _id: plain._id,
    payHoursId: plain.payHoursId,
    shiftId: plain.shiftId,
    staffName: plain.staffName,
    shiftDate: plain.shiftDate,
    shiftStart: plain.shiftStart,
    shiftEnd: plain.shiftEnd,
    timezoneOffset: plain.timezoneOffset,
    shiftType: plain.shiftType,
    clientName: plain.clientName,
    totalHours: plain.totalHours,
    isBrokenShift: plain.isBrokenShift,
    isSleepover: plain.isSleepover,
    minimumEngagementException: plain.minimumEngagementException,
    minimum4hEngagementReview: plain.minimum4hEngagementReview || false,
    preSleepoverInsufficientBreak: plain.preSleepoverInsufficientBreak || false,
    mileage: plain.mileage,
    isManuallyAdjusted: plain.isManuallyAdjusted || Object.keys(manualFields).length > 0,
    manualFields,
    computed: Object.fromEntries(
      [...SHIFT_MANUAL_FIELD_KEYS].filter((k) => k in plain).map((k) => [k, plain[k]])
    ),
    adjustedAt: plain.adjustedAt ?? null,
    adjustedBy: plain.adjustedBy ?? null,
  };
}
