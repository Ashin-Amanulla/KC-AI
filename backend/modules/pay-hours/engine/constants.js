/**
 * Mutable award constants for SCHADS calculations.
 * These are updated at runtime via applyAwardConstants() from the award-rates module.
 * The engine imports these live bindings so changes are reflected immediately.
 */

export let DAILY_ORD = 7.6;
export let WEEKLY_ORD = 38.0;
export let BROKEN_ALLOWANCE_1 = 20.82;
export let BROKEN_ALLOWANCE_2 = 27.56;
export let MEAL_ALLOWANCE = 16.62;
export let VEHICLE_RATE = 0.99;
export let OT_1 = 1.5;
export let OT_2 = 2.0;

/** Overwrite module constants from a backend award-rate `constants` object. */
export function applyAwardConstants(c) {
  if (!c) return;
  if (c.dailyOrdHours > 0) DAILY_ORD = c.dailyOrdHours;
  if (c.weeklyOrdHours > 0) WEEKLY_ORD = c.weeklyOrdHours;
  if (c.brokenShiftAllowance1 > 0) BROKEN_ALLOWANCE_1 = c.brokenShiftAllowance1;
  if (c.brokenShiftAllowance2 > 0) BROKEN_ALLOWANCE_2 = c.brokenShiftAllowance2;
  if (c.mealAllowance > 0) MEAL_ALLOWANCE = c.mealAllowance;
  if (c.vehicleKmRate > 0) VEHICLE_RATE = c.vehicleKmRate;
  if (c.otTier1Mult > 0) OT_1 = c.otTier1Mult;
  if (c.otTier2Mult > 0) OT_2 = c.otTier2Mult;
}
