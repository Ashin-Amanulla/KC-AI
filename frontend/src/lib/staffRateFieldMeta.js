/** Shared SCHADS $/h column metadata for award calculator + Staff page editor. */
export const STAFF_RATES_TABLE_FIELDS = [
  ['daytime', 'Day'],
  ['afternoon', 'Aft'],
  ['night', 'Night'],
  ['otUpto2', 'WD OT≤2'],
  ['otAfter2', 'WD OT>2'],
  ['saturday', 'Sat'],
  ['satOtAfter2', 'Sat OT>2'],
  ['sunday', 'Sun'],
  ['ph', 'PH'],
  ['mealAllow', 'Meal'],
  ['brokenShift', 'Broken'],
  ['sleepover', 'Sleep'],
  ['kmRate', '$/km'],
];

export const STAFF_RATES_NUMERIC_KEYS = STAFF_RATES_TABLE_FIELDS.map(([k]) => k);
