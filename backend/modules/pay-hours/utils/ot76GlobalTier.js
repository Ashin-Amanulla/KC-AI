/** Fortnight OT>76: one shared 1.5× band for first 2h across weekday + Saturday (weekday pool first). */

export const OT76_GLOBAL_TIER1_MAX = 2;

function r2(n) {
  return Math.round(n * 100) / 100;
}

/**
 * Allocate global 1.5× / 2× tiers from weekday + Saturday OT>76 totals.
 * Weekday hours consume the shared 1.5× band first; Saturday only gets 1.5× if capacity remains.
 */
export function allocateOt76GlobalTierFromTotals(ot76Wd, ot76Sat) {
  let tier1Remaining = OT76_GLOBAL_TIER1_MAX;
  const wdT1 = r2(Math.min(ot76Wd, tier1Remaining));
  tier1Remaining = r2(tier1Remaining - wdT1);
  const wdT2 = r2(Math.max(0, ot76Wd - wdT1));
  const satT1 = r2(Math.min(ot76Sat, tier1Remaining));
  const satT2 = r2(Math.max(0, ot76Sat - satT1));
  return { wdT1, wdT2, satT1, satT2 };
}

export function resolveOt76PayTiers(ph) {
  if (
    ph?.otAfter76WeekdayUpto2 != null &&
    ph?.otAfter76WeekdayAfter2 != null &&
    ph?.otAfter76SaturdayUpto2 != null &&
    ph?.otAfter76SaturdayAfter2 != null
  ) {
    return {
      wdT1: ph.otAfter76WeekdayUpto2 || 0,
      wdT2: ph.otAfter76WeekdayAfter2 || 0,
      satT1: ph.otAfter76SaturdayUpto2 || 0,
      satT2: ph.otAfter76SaturdayAfter2 || 0,
    };
  }
  return allocateOt76GlobalTierFromTotals(ph?.otAfter76Weekday || 0, ph?.otAfter76Saturday || 0);
}
