import { calcGrossFromRates, calcGross, normName } from './schadsWageCalc.js';

const r2 = (n) => Math.round(n * 100) / 100;

export function billingSharedShiftKey(row) {
  return `${normName(row.staff)}|${row.shiftId || ''}|${row.startDt || ''}|${row.endDt || ''}`;
}

export function shiftRecordToPayHoursInput(sph) {
  return {
    morningHours: sph.morningHours || 0,
    afternoonHours: sph.afternoonHours || 0,
    nightHours: sph.nightHours || 0,
    saturdayHours: sph.saturdayHours || 0,
    sundayHours: sph.sundayHours || 0,
    holidayHours: sph.holidayHours || 0,
    nursingCareHours: sph.nursingCareHours || 0,
    nursingAfternoonHours: sph.nursingAfternoonHours || 0,
    nursingNightHours: sph.nursingNightHours || 0,
    nursingSaturdayHours: sph.nursingSaturdayHours || 0,
    nursingSundayHours: sph.nursingSundayHours || 0,
    nursingHolidayHours: sph.nursingHolidayHours || 0,
    shortTurnaroundHours: sph.shortTurnaroundHours || 0,
    weekdayOtUpto2: sph.weekdayOtUpto2 || 0,
    weekdayOtAfter2: sph.weekdayOtAfter2 || 0,
    saturdayOtUpto2: sph.saturdayOtUpto2 || 0,
    saturdayOtAfter2: sph.saturdayOtAfter2 || 0,
    sundayOtUpto2: sph.sundayOtUpto2 || 0,
    sundayOtAfter2: sph.sundayOtAfter2 || 0,
    holidayOtUpto2: sph.holidayOtUpto2 || 0,
    holidayOtAfter2: sph.holidayOtAfter2 || 0,
    brokenShiftCount: sph.isBrokenShift ? 1 : 0,
    sleepoversCount: sph.isSleepover ? 1 : 0,
    totalKm: sph.mileage ?? 0,
  };
}

export function calcShiftGross(sph, rates, { baseRate, empType = 'casual' } = {}) {
  const input = shiftRecordToPayHoursInput(sph);
  if (rates) {
    const gross = calcGrossFromRates(input, rates);
    if (gross != null) return r2(gross);
  }
  if (baseRate) {
    const gross = calcGross(input, baseRate, empType);
    if (gross != null) return r2(gross);
  }
  return null;
}

export function buildShiftCostIndex(shiftCosts, ratesMap, superPct = 11.5, rateFallback = {}) {
  const pct = superPct / 100;
  const byShiftcareId = new Map();
  const bySharedKey = new Map();

  for (const sph of shiftCosts || []) {
    const staffNorm = normName(sph.staffName);
    const rates = ratesMap?.get(staffNorm);
    const gross = calcShiftGross(sph, rates, rateFallback);
    if (gross == null) continue;

    const wages = gross;
    const superAmt = r2(wages * pct);
    const entry = {
      gross,
      wages,
      superAmt,
      employerCost: r2(wages + superAmt),
      staffNorm,
      shiftcareId: sph.shiftcareId ? String(sph.shiftcareId) : null,
      sph,
    };

    if (entry.shiftcareId) {
      byShiftcareId.set(entry.shiftcareId, entry);
    }

    const startIso = sph.shiftStart ? new Date(sph.shiftStart).toISOString() : '';
    const endIso = sph.shiftEnd ? new Date(sph.shiftEnd).toISOString() : '';
    const sharedKey = `${staffNorm}|${entry.shiftcareId || ''}|${startIso}|${endIso}`;
    bySharedKey.set(sharedKey, entry);
  }

  return { byShiftcareId, bySharedKey };
}

export function matchBillingGroup(groupRows, shiftCostIndex, staffNorm) {
  if (!shiftCostIndex || !groupRows?.length) return null;
  const sample = groupRows[0];
  const shiftId = sample.shiftId ? String(sample.shiftId) : '';

  if (shiftId && shiftCostIndex.byShiftcareId.has(shiftId)) {
    const entry = shiftCostIndex.byShiftcareId.get(shiftId);
    if (entry.staffNorm === staffNorm) return entry;
  }

  const sharedKey = billingSharedShiftKey(sample);
  if (shiftCostIndex.bySharedKey.has(sharedKey)) {
    return shiftCostIndex.bySharedKey.get(sharedKey);
  }

  return null;
}

function groupBillingRowsByShift(billingRows) {
  const groups = new Map();
  for (const row of billingRows) {
    const key = billingSharedShiftKey(row);
    if (!groups.has(key)) groups.set(key, []);
    groups.get(key).push(row);
  }
  return groups;
}

/**
 * Allocate one staff member's wages to billing rows using shift-level SCHADS gross.
 * Returns Map(billingRow -> { wages, superAmt, employerCost }).
 */
export function allocateStaffMemberRows({
  billingRows,
  staffNorm,
  wages,
  superAmt,
  shiftCostIndex,
}) {
  const rowAlloc = new Map();
  if (wages == null || !billingRows?.length) return { rowAlloc, unmatchedCount: 0 };

  const groups = groupBillingRowsByShift(billingRows);
  const matchedWeights = [];
  let shiftWagesAllocated = 0;

  for (const groupRows of groups.values()) {
    const shiftCost = matchBillingGroup(groupRows, shiftCostIndex, staffNorm);
    if (!shiftCost) continue;

    shiftWagesAllocated = r2(shiftWagesAllocated + shiftCost.gross);
    const perRowWages = r2(shiftCost.gross / groupRows.length);
    for (const row of groupRows) {
      rowAlloc.set(row, { wages: perRowWages, superAmt: 0, employerCost: 0, matched: true });
      matchedWeights.push({ row, weight: perRowWages });
    }
  }

  const residualWages = r2(wages - shiftWagesAllocated);
  const totalWeight = matchedWeights.reduce((s, x) => s + x.weight, 0);
  if (totalWeight > 0 && Math.abs(residualWages) > 0.001) {
    for (const { row, weight } of matchedWeights) {
      const extra = r2(residualWages * (weight / totalWeight));
      const cur = rowAlloc.get(row);
      cur.wages = r2(cur.wages + extra);
    }
  }

  const unmatched = billingRows.filter((r) => !rowAlloc.has(r));
  if (unmatched.length) {
    const unmatchedHours = unmatched.reduce((s, r) => s + (r.duration || 0), 0);
    const allocatedWages = [...rowAlloc.values()].reduce((s, v) => s + v.wages, 0);
    const pool = r2(wages - allocatedWages);
    if (unmatchedHours > 0 && pool > 0) {
      for (const row of unmatched) {
        rowAlloc.set(row, {
          wages: r2(pool * ((row.duration || 0) / unmatchedHours)),
          superAmt: 0,
          employerCost: 0,
          matched: false,
        });
      }
    }
  }

  if (rowAlloc.size === 0 && billingRows.length) {
    const totalHours = billingRows.reduce((s, r) => s + (r.duration || 0), 0);
    for (const row of billingRows) {
      const share = totalHours > 0 ? (row.duration || 0) / totalHours : 0;
      rowAlloc.set(row, {
        wages: r2(wages * share),
        superAmt: 0,
        employerCost: 0,
        matched: false,
      });
    }
  }

  const superRatio = wages > 0 ? (superAmt || 0) / wages : 0;
  for (const val of rowAlloc.values()) {
    val.superAmt = r2(val.wages * superRatio);
    val.employerCost = r2(val.wages + val.superAmt);
  }

  const unmatchedCount = billingRows.filter((r) => {
    const a = rowAlloc.get(r);
    return !a || a.matched === false;
  }).length;

  return { rowAlloc, unmatchedCount };
}

/**
 * Apply shift-based row allocations to client aggregates.
 */
export function applyRowAllocationsToClients({
  rowAlloc,
  byClient,
  staffKey,
  staffName,
  billingRows,
}) {
  for (const br of billingRows) {
    if (!br.client || !byClient[br.client]) continue;
    const alloc = rowAlloc.get(br);
    if (!alloc) continue;

    byClient[br.client].matchedRevenue = r2(byClient[br.client].matchedRevenue + br.totalCost);
    byClient[br.client].allocWages = r2(byClient[br.client].allocWages + alloc.wages);
    byClient[br.client].allocSuper = r2(byClient[br.client].allocSuper + alloc.superAmt);
    byClient[br.client].allocEmployerCost = r2(byClient[br.client].allocEmployerCost + alloc.employerCost);

    if (!byClient[br.client].staffAlloc[staffKey]) {
      byClient[br.client].staffAlloc[staffKey] = {
        staffName,
        hours: 0,
        revenue: 0,
        wages: 0,
        superAmt: 0,
        employerCost: 0,
      };
    }
    const sa = byClient[br.client].staffAlloc[staffKey];
    sa.hours = r2(sa.hours + (br.duration || 0));
    sa.revenue = r2(sa.revenue + br.totalCost);
    sa.wages = r2(sa.wages + alloc.wages);
    sa.superAmt = r2(sa.superAmt + alloc.superAmt);
    sa.employerCost = r2(sa.employerCost + alloc.employerCost);
  }
}

export function allocateHourProportional({
  billingRows,
  wages,
  superAmt,
  byClient,
  staffKey,
  staffName,
}) {
  const totalStaffHours = billingRows.reduce((s, r) => s + (r.duration || 0), 0);
  if (totalStaffHours <= 0) return;

  for (const br of billingRows) {
    if (!br.client || !byClient[br.client]) continue;
    const share = (br.duration || 0) / totalStaffHours;
    const wageShare = r2(wages * share);
    const superShare = r2((superAmt || 0) * share);
    const employerShare = r2(wageShare + superShare);

    byClient[br.client].matchedRevenue = r2(byClient[br.client].matchedRevenue + br.totalCost);
    byClient[br.client].allocWages = r2(byClient[br.client].allocWages + wageShare);
    byClient[br.client].allocSuper = r2(byClient[br.client].allocSuper + superShare);
    byClient[br.client].allocEmployerCost = r2(byClient[br.client].allocEmployerCost + employerShare);

    if (!byClient[br.client].staffAlloc[staffKey]) {
      byClient[br.client].staffAlloc[staffKey] = {
        staffName,
        hours: 0,
        revenue: 0,
        wages: 0,
        superAmt: 0,
        employerCost: 0,
      };
    }
    const sa = byClient[br.client].staffAlloc[staffKey];
    sa.hours = r2(sa.hours + (br.duration || 0));
    sa.revenue = r2(sa.revenue + br.totalCost);
    sa.wages = r2(sa.wages + wageShare);
    sa.superAmt = r2(sa.superAmt + superShare);
    sa.employerCost = r2(sa.employerCost + employerShare);
  }
}

/**
 * Build WeakMap-compatible row paid lookup from shift-based allocations.
 */
export function buildLineStaffPaidMap(staffRows, rowAllocByStaff) {
  const map = new WeakMap();
  for (const staffRow of staffRows) {
    const staffNorm = normName(staffRow.name);
    const rowAlloc = rowAllocByStaff?.get(staffNorm);
    if (!rowAlloc) continue;
    for (const [row, alloc] of rowAlloc.entries()) {
      map.set(row, alloc.employerCost);
    }
  }
  return map;
}
