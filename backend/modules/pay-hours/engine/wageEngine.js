/**
 * SCHADS award wage calculations (hours × rate card → dollars).
 *
 * Backend port of frontend/src/lib/schadsWageCalc.js — bug-for-bug for now;
 * wageParity.test.js enforces functional equality between the two until the
 * frontend copy is retired. Award-indexed amounts are injected via
 * applyAwardConstants() from the effective-dated award-rates module.
 */

import { resolveOt76PayTiers } from '../utils/ot76GlobalTier.js';
import {
  DAILY_ORD,
  WEEKLY_ORD,
  BROKEN_ALLOWANCE_1,
  BROKEN_ALLOWANCE_2,
  MEAL_ALLOWANCE,
  VEHICLE_RATE,
  OT_1,
  OT_2,
  applyAwardConstants
} from './constants.js';

// Re-export constants and applyAwardConstants so external code can access them
export {
  DAILY_ORD,
  WEEKLY_ORD,
  BROKEN_ALLOWANCE_1,
  BROKEN_ALLOWANCE_2,
  MEAL_ALLOWANCE,
  VEHICLE_RATE,
  OT_1,
  OT_2,
  applyAwardConstants
};

export function r2(n) {
  return Math.round(n * 100) / 100;
}

/** Base sleepover allowance + optional per-staff extra (rates file / UI). */
export function effectiveSleepoverRate(rates) {
  if (!rates) return 0;
  return r2((rates.sleepover || 0) + (rates.sleepoverExtra || 0));
}

export function normName(s) {
  if (!s) return '';
  let n = s.toString().toLowerCase().replace(/\([^)]*\)/g, '').trim();
  n = n.replace(/\s+/g, ' ');
  const parts = n.split(' ');
  if (parts.length >= 2) {
    return `${parts[0]} ${parts[parts.length - 1]}`;
  }
  return n;
}

export function casualEff(rate, mult) {
  return rate * (mult / 1.25 + 0.2);
}

function normalizeRateCard(rawRates) {
  if (!rawRates) return rawRates;
  const rates = { ...rawRates };
  const day = Number(rates.daytime || 0);
  if (day <= 0) return rates;

  // daytime is the casual-inclusive rate (base × 1.25).
  // All penalty rates must be derived as: day × (penalty_mult + 0.25) / 1.25
  // i.e.  base × (penalty_mult + casualLoading)
  // This is the correct SCHADS casual penalty formula.
  //
  // If a stored rate is already correct (within $0.01) we leave it alone.
  // If it is zero/missing OR was derived incorrectly (e.g. day × penalty_mult
  // instead of day × (penalty_mult+0.25)/1.25), we rederive it.

  function casualPenalty(mult) {
    // day × (mult + 0.25) / 1.25
    return r2(day * (mult + 0.25) / 1.25);
  }

  const derived = {
    afternoon:   casualPenalty(1.125),
    night:       casualPenalty(1.15),
    otUpto2:     casualPenalty(1.5),
    otAfter2:    casualPenalty(2.0),
    saturday:    casualPenalty(1.5),
    satOtAfter2: casualPenalty(2.0),
    sunday:      casualPenalty(2.0),
    ph:          casualPenalty(2.5),
  };

  for (const [key, correct] of Object.entries(derived)) {
    const stored = Number(rates[key] || 0);
    // Rederive if: missing, zero, or stored as day×mult (old wrong behaviour)
    if (stored <= 0 || Math.abs(stored - correct) > 0.015) {
      rates[key] = correct;
    }
  }

  // Nursing penalty keys — derive from nursingDaytime if present, else from daytime
  const nursingDay = Number(rates.nursingDaytime || 0) || day;
  if (!rates.nursingAfternoon || rates.nursingAfternoon <= 0)
    rates.nursingAfternoon = r2(nursingDay * (1.125 + 0.25) / 1.25);
  if (!rates.nursingNight || rates.nursingNight <= 0)
    rates.nursingNight = r2(nursingDay * (1.15 + 0.25) / 1.25);
  if (!rates.nursingSaturday || rates.nursingSaturday <= 0)
    rates.nursingSaturday = r2(nursingDay * (1.5 + 0.25) / 1.25);
  if (!rates.nursingSunday || rates.nursingSunday <= 0)
    rates.nursingSunday = r2(nursingDay * (2.0 + 0.25) / 1.25);
  if (!rates.nursingPh || rates.nursingPh <= 0)
    rates.nursingPh = r2(nursingDay * (2.5 + 0.25) / 1.25);

  return rates;
}

export function calcGrossFromRates(ph, rates) {
  if (!rates) return null;
  const normalizedRates = normalizeRateCard(rates);
  const nursingDay = Math.max(normalizedRates.nursingDaytime || 0, normalizedRates.daytime || 0);
  const nursingFactor = normalizedRates.daytime > 0 ? nursingDay / normalizedRates.daytime : 1;
  const nursingAfternoon = normalizedRates.nursingAfternoon > 0 ? normalizedRates.nursingAfternoon : r2((normalizedRates.afternoon || 0) * nursingFactor);
  const nursingNight = normalizedRates.nursingNight > 0 ? normalizedRates.nursingNight : r2((normalizedRates.night || 0) * nursingFactor);
  const nursingSatRate = normalizedRates.nursingSaturday > 0 ? normalizedRates.nursingSaturday : r2((normalizedRates.saturday || 0) * nursingFactor);
  const nursingSunRate = normalizedRates.nursingSunday > 0 ? normalizedRates.nursingSunday : r2((normalizedRates.sunday || 0) * nursingFactor);
  const nursingPhRate = normalizedRates.nursingPh > 0 ? normalizedRates.nursingPh : r2((normalizedRates.ph || 0) * nursingFactor);

  const nursingAft = r2(ph.nursingAfternoonHours || 0);
  const nursingNgt = r2(ph.nursingNightHours || 0);
  const nursingSat = r2(ph.nursingSaturdayHours || 0);
  const nursingSun = r2(ph.nursingSundayHours || 0);
  const nursingHol = r2(ph.nursingHolidayHours || 0);

  const aftBaseOnly = r2(Math.max(0, (ph.afternoonHours || 0) - nursingAft));
  const ngtBaseOnly = r2(Math.max(0, (ph.nightHours || 0) - nursingNgt));
  const satBaseOnly = r2(Math.max(0, (ph.saturdayHours || 0) - nursingSat));
  const sunBaseOnly = r2(Math.max(0, (ph.sundayHours || 0) - nursingSun));
  const holBaseOnly = r2(Math.max(0, (ph.holidayHours || 0) - nursingHol));
  const sunAll = sunBaseOnly + (ph.sundayOtUpto2 || 0) + (ph.sundayOtAfter2 || 0);
  const holAll = holBaseOnly + (ph.holidayOtUpto2 || 0) + (ph.holidayOtAfter2 || 0);
  const { wdT1: ot76WdT1, wdT2: ot76WdT2, satT1: ot76SatT1, satT2: ot76SatT2 } = resolveOt76PayTiers(ph);

  const brokenShiftRate = normalizedRates.brokenShift > 0 ? normalizedRates.brokenShift : BROKEN_ALLOWANCE_1;
  const mealAllow = r2((ph.mealAllowanceCount || 0) * normalizedRates.mealAllow);
  const mileageAllow = r2((ph.totalKm || 0) * (normalizedRates.kmRate || VEHICLE_RATE));

  const pay = r2(
    (ph.morningHours || 0) * normalizedRates.daytime +
    aftBaseOnly * normalizedRates.afternoon +
    nursingAft * nursingAfternoon +
    ngtBaseOnly * normalizedRates.night +
    nursingNgt * nursingNight +
    (ph.weekdayOtUpto2 || 0) * normalizedRates.otUpto2 +
    (ph.weekdayOtAfter2 || 0) * normalizedRates.otAfter2 +
    satBaseOnly * normalizedRates.saturday +
    nursingSat * nursingSatRate +
    (ph.saturdayOtUpto2 || 0) * normalizedRates.otUpto2 +
    (ph.saturdayOtAfter2 || 0) * normalizedRates.satOtAfter2 +
    sunAll * normalizedRates.sunday +
    nursingSun * nursingSunRate +
    holAll * normalizedRates.ph +
    nursingHol * nursingPhRate +
    (ph.nursingCareHours || 0) * nursingDay +
    (ph.shortTurnaroundHours || 0) * normalizedRates.otAfter2 +
    ot76WdT1 * normalizedRates.otUpto2 +
    ot76WdT2 * normalizedRates.otAfter2 +
    ot76SatT1 * normalizedRates.otUpto2 +
    ot76SatT2 * normalizedRates.satOtAfter2 +
    (ph.otAfter76Sunday || 0) * normalizedRates.sunday +
    (ph.otAfter76Holiday || 0) * normalizedRates.ph +
    (ph.brokenShiftCount || 0) * brokenShiftRate +
    (ph.brokenShift2BreakCount || 0) * BROKEN_ALLOWANCE_2 +
    (ph.sleepoversCount || 0) * effectiveSleepoverRate(normalizedRates) +
    mealAllow +
    mileageAllow +
    r2(normalizedRates.allowance || 0)
  );
  return pay;
}

export function calcBreakdownFromRates(ph, rates) {
  if (!rates) return null;
  const normalizedRates = normalizeRateCard(rates);
  const nursingDay = Math.max(normalizedRates.nursingDaytime || 0, normalizedRates.daytime || 0);
  const nursingFactor = normalizedRates.daytime > 0 ? nursingDay / normalizedRates.daytime : 1;
  const nursingAfternoon = normalizedRates.nursingAfternoon > 0 ? normalizedRates.nursingAfternoon : r2((normalizedRates.afternoon || 0) * nursingFactor);
  const nursingNight = normalizedRates.nursingNight > 0 ? normalizedRates.nursingNight : r2((normalizedRates.night || 0) * nursingFactor);
  const nursingAft = r2(ph.nursingAfternoonHours || 0);
  const nursingNgt = r2(ph.nursingNightHours || 0);
  const aftBaseOnly = r2(Math.max(0, (ph.afternoonHours || 0) - nursingAft));
  const ngtBaseOnly = r2(Math.max(0, (ph.nightHours || 0) - nursingNgt));
  const nursingSatRate = normalizedRates.nursingSaturday > 0 ? normalizedRates.nursingSaturday : r2((normalizedRates.saturday || 0) * nursingFactor);
  const nursingSunRate = normalizedRates.nursingSunday > 0 ? normalizedRates.nursingSunday : r2((normalizedRates.sunday || 0) * nursingFactor);
  const nursingPhRate = normalizedRates.nursingPh > 0 ? normalizedRates.nursingPh : r2((normalizedRates.ph || 0) * nursingFactor);
  const nursingSat = r2(ph.nursingSaturdayHours || 0);
  const nursingSun = r2(ph.nursingSundayHours || 0);
  const nursingHol = r2(ph.nursingHolidayHours || 0);
  const satBaseOnly = r2(Math.max(0, (ph.saturdayHours || 0) - nursingSat));
  const sunBaseOnly = r2(Math.max(0, (ph.sundayHours || 0) - nursingSun));
  const holBaseOnly = r2(Math.max(0, (ph.holidayHours || 0) - nursingHol));
  const sunAll = r2(sunBaseOnly + (ph.sundayOtUpto2 || 0) + (ph.sundayOtAfter2 || 0));
  const holAll = r2(holBaseOnly + (ph.holidayOtUpto2 || 0) + (ph.holidayOtAfter2 || 0));
  const { wdT1: ot76WdT1, wdT2: ot76WdT2, satT1: ot76SatT1, satT2: ot76SatT2 } = resolveOt76PayTiers(ph);

  const defs = [
    ['Daytime (≤8pm)', ph.morningHours || 0, normalizedRates.daytime, 'ord'],
    ['Evening (>8pm)', aftBaseOnly, normalizedRates.afternoon, 'penalty'],
    ['Nursing Evening', nursingAft, nursingAfternoon, 'penalty'],
    ['Night', ngtBaseOnly, normalizedRates.night, 'penalty'],
    ['Nursing Night', nursingNgt, nursingNight, 'penalty'],
    ['WD OT ≤2h', ph.weekdayOtUpto2 || 0, normalizedRates.otUpto2, 'ot'],
    ['WD OT >2h', ph.weekdayOtAfter2 || 0, normalizedRates.otAfter2, 'ot'],
    ['Saturday', satBaseOnly, normalizedRates.saturday, 'penalty'],
    ['Nursing Saturday', nursingSat, nursingSatRate, 'penalty'],
    ['Sat OT ≤2h', ph.saturdayOtUpto2 || 0, normalizedRates.otUpto2, 'ot'],
    ['Sat OT >2h', ph.saturdayOtAfter2 || 0, normalizedRates.satOtAfter2, 'ot'],
    ['Sunday', sunAll, normalizedRates.sunday, 'penalty'],
    ['Nursing Sunday', nursingSun, nursingSunRate, 'penalty'],
    ['Public Holiday', holAll, normalizedRates.ph, 'penalty'],
    ['Nursing Holiday', nursingHol, nursingPhRate, 'penalty'],
    ['Nursing Care', ph.nursingCareHours || 0, nursingDay, 'ord'],
    ['Double Time (No Break)', ph.shortTurnaroundHours || 0, normalizedRates.otAfter2, 'penalty'],
    ['OT >76h WD ≤2h', ot76WdT1, normalizedRates.otUpto2, 'ot76'],
    ['OT >76h WD >2h', ot76WdT2, normalizedRates.otAfter2, 'ot76'],
    ['OT >76h Sat ≤2h', ot76SatT1, normalizedRates.otUpto2, 'ot76'],
    ['OT >76h Sat >2h', ot76SatT2, normalizedRates.satOtAfter2, 'ot76'],
    ['OT >76h Sun', ph.otAfter76Sunday || 0, normalizedRates.sunday, 'ot76'],
    ['OT >76h PH', ph.otAfter76Holiday || 0, normalizedRates.ph, 'ot76'],
  ];

  const lines = [];
  let basePay = 0;
  let penaltyExtra = 0;
  let otPay = 0;
  let ordHours = 0;
  let otHours = 0;

  for (const [label, hours, effRate, cat] of defs) {
    if (hours <= 0) continue;
    const pay = r2(hours * effRate);
    lines.push({ label, hours, effRate, pay, cat });
    if (cat === 'ord') {
      basePay += pay;
      ordHours += hours;
    } else if (cat === 'penalty') {
      const penaltyBaseRate = label.startsWith('Nursing') ? nursingDay : normalizedRates.daytime;
      basePay += r2(hours * penaltyBaseRate);
      penaltyExtra += r2(pay - hours * penaltyBaseRate);
      ordHours += hours;
    } else if (cat === 'ot' || cat === 'ot76') {
      otPay += pay;
      otHours += hours;
    }
  }

  const brokenShiftRate = normalizedRates.brokenShift > 0 ? normalizedRates.brokenShift : BROKEN_ALLOWANCE_1;
  const mealAllow = r2((ph.mealAllowanceCount || 0) * normalizedRates.mealAllow);
  const broken1Allow = r2((ph.brokenShiftCount || 0) * brokenShiftRate);
  const broken2Allow = r2((ph.brokenShift2BreakCount || 0) * BROKEN_ALLOWANCE_2);
  const brokenAllow = r2(broken1Allow + broken2Allow);
  const sleepRate = effectiveSleepoverRate(normalizedRates);
  const sleepAllow = r2((ph.sleepoversCount || 0) * sleepRate);
  const mileageAllow = r2((ph.totalKm || 0) * (normalizedRates.kmRate || VEHICLE_RATE));
  const otherAllow = r2(normalizedRates.allowance || 0);
  const allow = {
    brokenAllow,
    broken1Allow,
    broken2Allow,
    mealAllow,
    sleepAllow,
    mileageAllow,
    otherAllow,
    total: r2(brokenAllow + mealAllow + sleepAllow + mileageAllow + otherAllow),
  };

  const gross = r2(lines.reduce((s, l) => s + l.pay, 0) + allow.total);
  const totalHours = r2(ordHours + otHours);

  return {
    lines,
    allow,
    basePay: r2(basePay),
    penaltyExtra: r2(penaltyExtra),
    otPay: r2(otPay),
    totalHours,
    ordHours: r2(ordHours),
    otHours: r2(otHours),
    gross,
    isCasual: true,
    base: normalizedRates.daytime,
    load: null,
    fromRates: true,
  };
}

export function calcAllowances(ph) {
  const broken1 = ph.brokenShiftCount || 0;
  const broken2 = ph.brokenShift2BreakCount || 0;
  const brokenAllow = r2(broken1 * BROKEN_ALLOWANCE_1 + broken2 * BROKEN_ALLOWANCE_2);
  const mealAllow = r2((ph.mealAllowanceCount || 0) * MEAL_ALLOWANCE);
  const mileageAllow = r2((ph.totalKm || 0) * VEHICLE_RATE);
  return { brokenAllow, mealAllow, mileageAllow, total: r2(brokenAllow + mealAllow + mileageAllow) };
}

export function calcGross(ph, baseRate, empType = 'permanent') {
  const rate = parseFloat(baseRate);
  if (!rate || rate <= 0) return null;

  const sunAll = (ph.sundayHours || 0) + (ph.sundayOtUpto2 || 0) + (ph.sundayOtAfter2 || 0);
  const holAll = (ph.holidayHours || 0) + (ph.holidayOtUpto2 || 0) + (ph.holidayOtAfter2 || 0);
  const ot76Sun = ph.otAfter76Sunday || 0;
  const ot76Hol = ph.otAfter76Holiday || 0;
  const { wdT1: ot76WdT1, wdT2: ot76WdT2, satT1: ot76SatT1, satT2: ot76SatT2 } = resolveOt76PayTiers(ph);

  let pay = 0;
  if (empType === 'casual') {
    const ce = (m) => casualEff(rate, m);
    pay =
      (ph.morningHours || 0) * ce(1.0) +
      (ph.afternoonHours || 0) * ce(1.125) +
      (ph.nightHours || 0) * ce(1.15) +
      (ph.weekdayOtUpto2 || 0) * ce(1.5) +
      (ph.weekdayOtAfter2 || 0) * ce(2.0) +
      (ph.saturdayHours || 0) * ce(1.5) +
      (ph.saturdayOtUpto2 || 0) * ce(1.5) +
      (ph.saturdayOtAfter2 || 0) * ce(2.0) +
      sunAll * ce(2.0) +
      holAll * ce(2.5) +
      (ph.nursingCareHours || 0) * ce(1.0) +
      (ph.shortTurnaroundHours || 0) * ce(2.0) +
      ot76WdT1 * ce(1.5) +
      ot76WdT2 * ce(2.0) +
      ot76SatT1 * ce(1.5) +
      ot76SatT2 * ce(2.0) +
      ot76Sun * ce(2.0) +
      ot76Hol * ce(2.5);
  } else {
    // Permanent / non-casual: penalty loadings on base rate (align with calcBreakdown: 1 / 1.125 / 1.15 for weekday hours)
    pay =
      rate *
      ((ph.morningHours || 0) * 1.0 +
        (ph.afternoonHours || 0) * 1.125 +
        (ph.nightHours || 0) * 1.15 +
        (ph.weekdayOtUpto2 || 0) * 1.5 +
        (ph.weekdayOtAfter2 || 0) * 2.0 +
        (ph.saturdayHours || 0) * 1.5 +
        (ph.saturdayOtUpto2 || 0) * 1.5 +
        (ph.saturdayOtAfter2 || 0) * 2.0 +
        sunAll * 2.0 +
        holAll * 2.5 +
        (ph.nursingCareHours || 0) * 1.0 +
        (ph.shortTurnaroundHours || 0) * 2.0 +
        ot76WdT1 * 1.5 +
        ot76WdT2 * 2.0 +
        ot76SatT1 * 1.5 +
        ot76SatT2 * 2.0 +
        ot76Sun * 2.0 +
        ot76Hol * 2.5);
  }

  return r2(pay + calcAllowances(ph).total);
}

export function staffTotalHours(ph) {
  return r2(
    (ph.morningHours || 0) +
      (ph.afternoonHours || 0) +
      (ph.nightHours || 0) +
      (ph.weekdayOtUpto2 || 0) +
      (ph.weekdayOtAfter2 || 0) +
      (ph.saturdayHours || 0) +
      (ph.saturdayOtUpto2 || 0) +
      (ph.saturdayOtAfter2 || 0) +
      (ph.sundayHours || 0) +
      (ph.sundayOtUpto2 || 0) +
      (ph.sundayOtAfter2 || 0) +
      (ph.holidayHours || 0) +
      (ph.holidayOtUpto2 || 0) +
      (ph.holidayOtAfter2 || 0) +
      (ph.nursingCareHours || 0) +
      (ph.shortTurnaroundHours || 0) +
      (ph.otAfter76Weekday || 0) +
      (ph.otAfter76Saturday || 0) +
      (ph.otAfter76Sunday || 0) +
      (ph.otAfter76Holiday || 0)
  );
}

/** Payable hours for a single shift row (includes OT>76 reclassified from 76h cap). */
export function shiftRowPayableHours(shift) {
  return r2(
    (shift.morningHours || 0) +
      (shift.afternoonHours || 0) +
      (shift.nightHours || 0) +
      (shift.weekdayOtUpto2 || 0) +
      (shift.weekdayOtAfter2 || 0) +
      (shift.saturdayHours || 0) +
      (shift.saturdayOtUpto2 || 0) +
      (shift.saturdayOtAfter2 || 0) +
      (shift.sundayHours || 0) +
      (shift.sundayOtUpto2 || 0) +
      (shift.sundayOtAfter2 || 0) +
      (shift.holidayHours || 0) +
      (shift.holidayOtUpto2 || 0) +
      (shift.holidayOtAfter2 || 0) +
      (shift.nursingCareHours || 0) +
      (shift.shortTurnaroundHours || 0) +
      (shift.otAfter76Weekday || 0) +
      (shift.otAfter76Saturday || 0) +
      (shift.otAfter76Sunday || 0) +
      (shift.otAfter76Holiday || 0)
  );
}

export function totalOtHrs(ph) {
  return r2(
    (ph.weekdayOtUpto2 || 0) +
      (ph.weekdayOtAfter2 || 0) +
      (ph.saturdayOtUpto2 || 0) +
      (ph.saturdayOtAfter2 || 0) +
      (ph.sundayOtUpto2 || 0) +
      (ph.sundayOtAfter2 || 0) +
      (ph.holidayOtUpto2 || 0) +
      (ph.holidayOtAfter2 || 0)
  );
}

export function calcBreakdown(ph, baseRate, empType = 'permanent') {
  const rate = parseFloat(baseRate);
  if (!rate || rate <= 0) return null;

  const isCasual = empType === 'casual';
  const base = isCasual ? r2(rate / 1.25) : rate;
  const load = isCasual ? r2(rate * 0.2) : 0;
  const eff = (mult) => (isCasual ? r2(base * mult + load) : r2(rate * mult));

  const ot76wd = ph.otAfter76Weekday || 0;
  const ot76sat = ph.otAfter76Saturday || 0;
  const ot76sun = ph.otAfter76Sunday || 0;
  const ot76hol = ph.otAfter76Holiday || 0;
  const ot76WdT1 = r2(Math.min(ot76wd, 2));
  const ot76WdT2 = r2(Math.max(0, ot76wd - 2));
  const ot76SatT1 = r2(Math.min(ot76sat, 2));
  const ot76SatT2 = r2(Math.max(0, ot76sat - 2));

  const sunAll = r2((ph.sundayHours || 0) + (ph.sundayOtUpto2 || 0) + (ph.sundayOtAfter2 || 0));
  const holAll = r2((ph.holidayHours || 0) + (ph.holidayOtUpto2 || 0) + (ph.holidayOtAfter2 || 0));

  const defs = [
    ['Daytime (≤8pm)', ph.morningHours || 0, 1.0, 'ord'],
    ['Evening (>8pm)', ph.afternoonHours || 0, 1.125, 'penalty'],
    ['Night', ph.nightHours || 0, 1.15, 'penalty'],
    ['WD OT ≤2h', ph.weekdayOtUpto2 || 0, 1.5, 'ot'],
    ['WD OT >2h', ph.weekdayOtAfter2 || 0, 2.0, 'ot'],
    ['Saturday', ph.saturdayHours || 0, 1.5, 'penalty'],
    ['Sat OT ≤2h', ph.saturdayOtUpto2 || 0, 1.5, 'ot'],
    ['Sat OT >2h', ph.saturdayOtAfter2 || 0, 2.0, 'ot'],
    ['Sunday', sunAll, 2.0, 'penalty'],
    ['Public Holiday', holAll, 2.5, 'penalty'],
    ['Nursing Care', ph.nursingCareHours || 0, 1.0, 'ord'],
    ['OT >76h WD ≤2h', ot76WdT1, 1.5, 'ot76'],
    ['OT >76h WD >2h', ot76WdT2, 2.0, 'ot76'],
    ['OT >76h Sat ≤2h', ot76SatT1, 1.5, 'ot76'],
    ['OT >76h Sat >2h', ot76SatT2, 2.0, 'ot76'],
    ['OT >76h Sun', ot76sun, 2.0, 'ot76'],
    ['OT >76h PH', ot76hol, 2.5, 'ot76'],
  ];

  const lines = [];
  let basePay = 0;
  let penaltyExtra = 0;
  let otPay = 0;
  let ordHours = 0;
  let otHours = 0;

  for (const [label, hours, mult, cat] of defs) {
    if (hours <= 0) continue;
    const effRate = eff(mult);
    const pay = r2(hours * effRate);
    lines.push({ label, hours, mult, effRate, pay, cat });

    if (cat === 'ord') {
      basePay += r2(hours * rate);
      ordHours += hours;
    } else if (cat === 'penalty') {
      basePay += r2(hours * (isCasual ? base : rate));
      penaltyExtra += r2(hours * (isCasual ? (mult - 1) * base : (mult - 1.0) * rate));
      ordHours += hours;
    } else if (cat === 'ot' || cat === 'ot76') {
      otPay += pay;
      otHours += hours;
    }
  }

  const allow = calcAllowances(ph);
  const totalH = r2(ordHours + otHours);

  let displayBase = 0;
  let displayPenalty = 0;
  let displayOT = 0;
  for (const l of lines) {
    const rawPay = r2(l.hours * (isCasual ? base * l.mult : rate * l.mult));
    if (l.cat === 'ord') {
      displayBase += rawPay;
    } else if (l.cat === 'penalty') {
      displayBase += r2(l.hours * (isCasual ? base : rate));
      displayPenalty += r2(l.hours * (isCasual ? (l.mult - 1) * base : (l.mult - 1.0) * rate));
    } else {
      displayOT += l.pay;
    }
  }
  if (isCasual) {
    const totalLoading = r2(lines.reduce((s, l) => s + (l.cat !== 'ot' && l.cat !== 'ot76' ? l.hours * load : 0), 0));
    displayPenalty = r2(displayPenalty + totalLoading);
  }

  const gross = r2(lines.reduce((s, l) => s + l.pay, 0) + allow.total);

  return {
    lines,
    allow,
    basePay: r2(displayBase),
    penaltyExtra: r2(displayPenalty),
    otPay: r2(displayOT),
    totalHours: totalH,
    ordHours: r2(ordHours),
    otHours: r2(otHours),
    gross,
    isCasual,
    base,
    load,
  };
}

/** Daily OT + OT&gt;76h (hours × rates), plus broken-shift allowances only (excludes meal, mileage, sleepover). */
export function calcOtAndBrokenPay(ph, { staffRates, baseRate, empType = 'casual' }) {
  if (staffRates) {
    const bd = calcBreakdownFromRates(ph, staffRates);
    if (!bd) return null;
    return {
      otPay: bd.otPay,
      brokenPay: bd.allow.brokenAllow,
      total: r2(bd.otPay + bd.allow.brokenAllow),
    };
  }
  const bd = calcBreakdown(ph, baseRate, empType);
  if (!bd) return null;
  return {
    otPay: bd.otPay,
    brokenPay: bd.allow.brokenAllow,
    total: r2(bd.otPay + bd.allow.brokenAllow),
  };
}

/** Dollar value of OT&gt;76h tier lines only (from same breakdown as gross). */
export function calcOt76MonetaryPay(ph, { staffRates, baseRate, empType = 'casual' }) {
  if (staffRates) {
    const bd = calcBreakdownFromRates(ph, staffRates);
    if (!bd) return null;
    return r2(bd.lines.filter((l) => l.cat === 'ot76').reduce((s, l) => s + l.pay, 0));
  }
  const bd = calcBreakdown(ph, baseRate, empType);
  if (!bd) return null;
  return r2(bd.lines.filter((l) => l.cat === 'ot76').reduce((s, l) => s + l.pay, 0));
}

/**
 * Build a payroll-shaped Map for analyzeStaffProfitability from pay hours rows + rates.
 * @param {number} superPct - e.g. 11.5 for 11.5% of gross
 */
export function buildAwardCostMapFromPayHours({
  payHoursRows,
  staffRatesMap,
  baseRates = {},
  defaultRate = '',
  empTypes = {},
  defaultEmpType = 'casual',
  superPct = 11.5,
}) {
  const map = new Map();
  const pct = superPct / 100;
  for (const ph of payHoursRows) {
    const key = normName(ph.staffName);
    const staffRates = staffRatesMap?.get(key);
    const rateVal = baseRates[ph.staffName] ?? defaultRate;
    const empT = empTypes[ph.staffName] ?? defaultEmpType;
    const earnings = staffRates ? calcGrossFromRates(ph, staffRates) : calcGross(ph, rateVal, empT);
    if (earnings == null) continue;
    const superAmt = r2(earnings * pct);
    map.set(key, {
      name: ph.staffName,
      earnings,
      superAmt,
      tax: 0,
      net: 0,
      totalCost: r2(earnings + superAmt),
    });
  }
  return map;
}
