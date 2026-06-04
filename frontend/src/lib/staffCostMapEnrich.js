import { nameMatchKeys, normStaffNameForMatch } from './staffNameNorm.js';

/**
 * Register staff-rate aliases (and rate-card name variants) on a payroll-shaped cost map
 * so billing export spellings match pay-hours cost rows.
 *
 * @param {Map<string, { name?: string, earnings: number, superAmt: number, totalCost: number }>} costMap
 * @param {Array<{ staffName?: string, normName?: string, rates?: object, aliases?: string[] }>} staffRatesRows
 */
export function enrichCostMapWithStaffRateAliases(costMap, staffRatesRows) {
  if (!costMap?.size || !staffRatesRows?.length) return costMap;

  const resolveEntry = (rateRow) => {
    const canonical = normStaffNameForMatch(rateRow.staffName) || rateRow.normName;
    if (!canonical) return null;

    if (costMap.has(canonical)) return costMap.get(canonical);
    if (rateRow.normName && costMap.has(rateRow.normName)) return costMap.get(rateRow.normName);

    for (const [, v] of costMap) {
      if (normStaffNameForMatch(v?.name) === canonical) return v;
    }

    for (const alias of rateRow.aliases || []) {
      if (!alias) continue;
      for (const k of nameMatchKeys(alias)) {
        if (costMap.has(k)) return costMap.get(k);
      }
    }
    return null;
  };

  const extra = [];
  for (const rateRow of staffRatesRows) {
    if (!rateRow?.rates) continue;
    const entry = resolveEntry(rateRow);
    if (!entry) continue;

    const register = (key) => {
      if (key && !costMap.has(key)) extra.push([key, entry]);
    };

    for (const alias of rateRow.aliases || []) {
      if (!alias) continue;
      for (const k of nameMatchKeys(alias)) register(k);
    }
    if (rateRow.staffName) {
      for (const k of nameMatchKeys(rateRow.staffName)) register(k);
    }
  }

  for (const [k, v] of extra) costMap.set(k, v);
  return costMap;
}
