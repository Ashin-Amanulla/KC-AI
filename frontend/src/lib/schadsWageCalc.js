/**
 * SCHADS award wage calculations — shared by SchadsCalculator and Cost Analysis.
 */

export const DAILY_ORD = 7.6;
export const WEEKLY_ORD = 38.0;
export const BROKEN_ALLOWANCE_1 = 20.82;
export const BROKEN_ALLOWANCE_2 = 27.56;
export const MEAL_ALLOWANCE = 16.62;
export const VEHICLE_RATE = 0.99;
export const OT_1 = 1.5;
export const OT_2 = 2.0;

export function r2(n) {
  return Math.round(n * 100) / 100;
}

export function normName(s) {
  return s?.toLowerCase().replace(/\s+/g, ' ').trim() ?? '';
}

export function casualEff(rate, mult) {
  return rate * (mult / 1.25 + 0.2);
}

export function calcGrossFromRates(ph, rates) {
  if (!rates) return null;
  const ot76Wd = ph.otAfter76Weekday || 0;
  const ot76Sat = ph.otAfter76Saturday || 0;
  const sunAll = (ph.sundayHours || 0) + (ph.sundayOtUpto2 || 0) + (ph.sundayOtAfter2 || 0);
  const holAll = (ph.holidayHours || 0) + (ph.holidayOtUpto2 || 0) + (ph.holidayOtAfter2 || 0);
  const ot76WdT1 = r2(Math.min(ot76Wd, 2));
  const ot76WdT2 = r2(Math.max(0, ot76Wd - 2));
  const ot76SatT1 = r2(Math.min(ot76Sat, 2));
  const ot76SatT2 = r2(Math.max(0, ot76Sat - 2));

  const mealAllow = r2((ph.mealAllowanceCount || 0) * rates.mealAllow);
  const mileageAllow = r2((ph.totalKm || 0) * (rates.kmRate || VEHICLE_RATE));

  const pay = r2(
    (ph.morningHours || 0) * rates.daytime +
    (ph.afternoonHours || 0) * rates.afternoon +
    (ph.nightHours || 0) * rates.night +
    (ph.weekdayOtUpto2 || 0) * rates.otUpto2 +
    (ph.weekdayOtAfter2 || 0) * rates.otAfter2 +
    (ph.saturdayHours || 0) * rates.saturday +
    (ph.saturdayOtUpto2 || 0) * rates.otUpto2 +
    (ph.saturdayOtAfter2 || 0) * rates.satOtAfter2 +
    sunAll * rates.sunday +
    holAll * rates.ph +
    (ph.nursingCareHours || 0) * rates.daytime +
    ot76WdT1 * rates.otUpto2 +
    ot76WdT2 * rates.otAfter2 +
    ot76SatT1 * rates.otUpto2 +
    ot76SatT2 * rates.satOtAfter2 +
    (ph.otAfter76Sunday || 0) * rates.sunday +
    (ph.otAfter76Holiday || 0) * rates.ph +
    (ph.brokenShiftCount || 0) * rates.brokenShift +
    (ph.brokenShift2BreakCount || 0) * BROKEN_ALLOWANCE_2 +
    (ph.sleepoversCount || 0) * rates.sleepover +
    mealAllow +
    mileageAllow
  );
  return pay;
}

export function calcBreakdownFromRates(ph, rates) {
  if (!rates) return null;
  const ot76Wd = ph.otAfter76Weekday || 0;
  const ot76Sat = ph.otAfter76Saturday || 0;
  const sunAll = r2((ph.sundayHours || 0) + (ph.sundayOtUpto2 || 0) + (ph.sundayOtAfter2 || 0));
  const holAll = r2((ph.holidayHours || 0) + (ph.holidayOtUpto2 || 0) + (ph.holidayOtAfter2 || 0));
  const ot76WdT1 = r2(Math.min(ot76Wd, 2));
  const ot76WdT2 = r2(Math.max(0, ot76Wd - 2));
  const ot76SatT1 = r2(Math.min(ot76Sat, 2));
  const ot76SatT2 = r2(Math.max(0, ot76Sat - 2));

  const defs = [
    ['Morning', ph.morningHours || 0, rates.daytime, 'ord'],
    ['Afternoon', ph.afternoonHours || 0, rates.afternoon, 'penalty'],
    ['Night', ph.nightHours || 0, rates.night, 'penalty'],
    ['WD OT ≤2h', ph.weekdayOtUpto2 || 0, rates.otUpto2, 'ot'],
    ['WD OT >2h', ph.weekdayOtAfter2 || 0, rates.otAfter2, 'ot'],
    ['Saturday', ph.saturdayHours || 0, rates.saturday, 'penalty'],
    ['Sat OT ≤2h', ph.saturdayOtUpto2 || 0, rates.otUpto2, 'ot'],
    ['Sat OT >2h', ph.saturdayOtAfter2 || 0, rates.satOtAfter2, 'ot'],
    ['Sunday', sunAll, rates.sunday, 'penalty'],
    ['Public Holiday', holAll, rates.ph, 'penalty'],
    ['Nursing Care', ph.nursingCareHours || 0, rates.daytime, 'ord'],
    ['OT >76h WD ≤2h', ot76WdT1, rates.otUpto2, 'ot76'],
    ['OT >76h WD >2h', ot76WdT2, rates.otAfter2, 'ot76'],
    ['OT >76h Sat ≤2h', ot76SatT1, rates.otUpto2, 'ot76'],
    ['OT >76h Sat >2h', ot76SatT2, rates.satOtAfter2, 'ot76'],
    ['OT >76h Sun', ph.otAfter76Sunday || 0, rates.sunday, 'ot76'],
    ['OT >76h PH', ph.otAfter76Holiday || 0, rates.ph, 'ot76'],
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
      basePay += r2(hours * rates.daytime);
      penaltyExtra += r2(pay - hours * rates.daytime);
      ordHours += hours;
    } else if (cat === 'ot' || cat === 'ot76') {
      otPay += pay;
      otHours += hours;
    }
  }

  const mealAllow = r2((ph.mealAllowanceCount || 0) * rates.mealAllow);
  const broken1Allow = r2((ph.brokenShiftCount || 0) * rates.brokenShift);
  const broken2Allow = r2((ph.brokenShift2BreakCount || 0) * BROKEN_ALLOWANCE_2);
  const brokenAllow = r2(broken1Allow + broken2Allow);
  const sleepAllow = r2((ph.sleepoversCount || 0) * rates.sleepover);
  const mileageAllow = r2((ph.totalKm || 0) * (rates.kmRate || VEHICLE_RATE));
  const allow = {
    brokenAllow,
    broken1Allow,
    broken2Allow,
    mealAllow,
    sleepAllow,
    mileageAllow,
    total: r2(brokenAllow + mealAllow + sleepAllow + mileageAllow),
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
    base: rates.daytime,
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
  const ot76Wd = ph.otAfter76Weekday || 0;
  const ot76Sat = ph.otAfter76Saturday || 0;
  const ot76Sun = ph.otAfter76Sunday || 0;
  const ot76Hol = ph.otAfter76Holiday || 0;
  const ot76WdT1 = r2(Math.min(ot76Wd, 2));
  const ot76WdT2 = r2(Math.max(0, ot76Wd - 2));
  const ot76SatT1 = r2(Math.min(ot76Sat, 2));
  const ot76SatT2 = r2(Math.max(0, ot76Sat - 2));

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
      ot76WdT1 * ce(1.5) +
      ot76WdT2 * ce(2.0) +
      ot76SatT1 * ce(1.5) +
      ot76SatT2 * ce(2.0) +
      ot76Sun * ce(2.0) +
      ot76Hol * ce(2.5);
  } else {
    pay =
      rate *
      ((ph.morningHours || 0) * 1.0 +
        (ph.afternoonHours || 0) * 1.0 +
        (ph.nightHours || 0) * 1.0 +
        (ph.weekdayOtUpto2 || 0) * 1.5 +
        (ph.weekdayOtAfter2 || 0) * 2.0 +
        (ph.saturdayHours || 0) * 1.5 +
        (ph.saturdayOtUpto2 || 0) * 1.5 +
        (ph.saturdayOtAfter2 || 0) * 2.0 +
        sunAll * 2.0 +
        holAll * 2.5 +
        (ph.nursingCareHours || 0) * 1.0 +
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
      (ph.nursingCareHours || 0)
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
    ['Morning', ph.morningHours || 0, 1.0, 'ord'],
    ['Afternoon', ph.afternoonHours || 0, 1.125, 'penalty'],
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
