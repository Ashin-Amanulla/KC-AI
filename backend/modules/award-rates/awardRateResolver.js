import { AwardRateSet } from './awardRateSet.model.js';

/**
 * Resolves which award-rate set applies at a given date.
 *
 * Resolution rule: greatest effectiveFrom <= date. Pay runs resolve by the
 * fortnight's periodStart (SCHADS increases apply from the first full pay
 * period on or after 1 July), so historical recomputes reproduce historical
 * dollars.
 *
 * FALLBACK_CONSTANTS mirror the values that were hardcoded across the codebase
 * before award rates became data (FY2025-26). They keep the engine and tests
 * working with no database and are the safety net if the collection is empty.
 */
export const FALLBACK_CONSTANTS = Object.freeze({
  brokenShiftAllowance1: 20.82,
  brokenShiftAllowance2: 27.56,
  mealAllowance: 16.62,
  vehicleKmRate: 0.99,
  sleepoverDefault: 90,
  brokenShiftAllowancePct1: 0.017,
  brokenShiftAllowancePct2: 0.0225,
  sleepoverPct: 0.049,
  standardRateWeekly: 0,
  dailyOrdHours: 7.6,
  weeklyOrdHours: 38,
  otTier1Mult: 1.5,
  otTier2Mult: 2.0,
  casualLoading: 0.25,
  eveningMult: 1.125,
  nightMult: 1.15,
  satMult: 1.5,
  sunMult: 2.0,
  phMult: 2.5,
});

let cache = null; // sorted descending by effectiveFrom
let cacheLoadedAt = 0;
const CACHE_TTL_MS = 5 * 60 * 1000;

export function invalidateAwardRateCache() {
  cache = null;
  cacheLoadedAt = 0;
}

async function loadSets() {
  const now = Date.now();
  if (cache && now - cacheLoadedAt < CACHE_TTL_MS) return cache;
  cache = await AwardRateSet.find({}).sort({ effectiveFrom: -1 }).lean();
  cacheLoadedAt = now;
  return cache;
}

/** The full rate-set document effective at `date`, or null when none applies. */
export async function getRateSetEffectiveAt(date = new Date()) {
  const at = new Date(date);
  const sets = await loadSets();
  return sets.find((s) => new Date(s.effectiveFrom) <= at) || null;
}

/**
 * Constants effective at `date`, always usable: falls back to the legacy
 * hardcoded values when no set covers the date (flagged via `isFallback`).
 */
export async function getConstantsEffectiveAt(date = new Date()) {
  const set = await getRateSetEffectiveAt(date);
  if (!set) {
    return { constants: { ...FALLBACK_CONSTANTS }, setLabel: null, setId: null, isFallback: true };
  }
  return {
    constants: { ...FALLBACK_CONSTANTS, ...set.constants },
    setLabel: set.label,
    setId: set._id,
    status: set.status,
    isFallback: false,
  };
}
