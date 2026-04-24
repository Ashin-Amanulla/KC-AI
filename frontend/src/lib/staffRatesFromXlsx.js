/**
 * Parse Support Staff Rates workbook (first sheet) — same layout as Schads calculator / scripts.
 */
import * as XLSX from 'xlsx';
import { normName, r2, VEHICLE_RATE } from './schadsWageCalc.js';

/**
 * @param {ArrayBuffer} arrayBuffer
 * @returns {Map<string, object>} normName → rate row (name, daytime, …)
 */
export function loadStaffRatesMapFromXlsx(arrayBuffer) {
  const buf = new Uint8Array(arrayBuffer);
  const wb = XLSX.read(buf, { type: 'array' });
  const ws = wb.Sheets[wb.SheetNames[0]];
  const rows = XLSX.utils.sheet_to_json(ws, { header: 1, defval: '' });
  let headerIdx = -1;
  for (let i = 0; i < rows.length; i++) {
    const r = rows[i].map((c) => c?.toString().toLowerCase().trim());
    if (r.some((h) => h === 'employee name') && r.some((h) => h.includes('daytime'))) {
      headerIdx = i;
      break;
    }
  }
  if (headerIdx < 0) {
    return new Map();
  }
  const h = rows[headerIdx].map((c) => c?.toString().toLowerCase().trim());
  const ci = (keyword) => h.findIndex((x) => x.includes(keyword));
  const sleepoverExtraCol = h.findIndex(
    (x) => x.includes('sleepover') && (x.includes('extra') || x.includes('bonus') || x.includes('additional'))
  );
  const idx = {
    emp: h.findIndex((x) => x === 'employee name'),
    daytime: ci('daytime'),
    afternoon: ci('afternoon'),
    night: ci('night'),
    otUpto2: h.findIndex((x) => x === 'ot upto 2 hours'),
    otAfter2: h.findIndex((x) => x === 'ot after 2 hours'),
    saturday: h.findIndex((x) => x === 'saturday'),
    satOtAfter2: ci('saturday ot after'),
    sunday: h.findIndex((x) => x === 'sunday'),
    ph: h.findIndex((x) => x === 'public holiday'),
    mealAllow: ci('overtime meal'),
    brokenShift: h.findIndex((x) => x === 'broken shift'),
    sleepover: ci('sleepover'),
    kmRate: ci('mileage'),
  };
  const map = new Map();
  for (let i = headerIdx + 1; i < rows.length; i++) {
    const name = rows[i][idx.emp]?.toString().trim();
    if (!name) continue;
    const nLower = name.toLowerCase();
    if (nLower === 'total' || nLower === 'totals' || nLower === 'subtotal' || nLower === 'summary') continue;
    const g = (k) => {
      const v = parseFloat(rows[i][idx[k]]);
      return Number.isNaN(v) ? 0 : r2(v);
    };
    const gx = (col) => {
      if (col < 0) return 0;
      const v = parseFloat(rows[i][col]);
      return Number.isNaN(v) ? 0 : r2(v);
    };
    const row = {
      name,
      daytime: g('daytime'),
      afternoon: g('afternoon'),
      night: g('night'),
      otUpto2: g('otUpto2'),
      otAfter2: g('otAfter2'),
      saturday: g('saturday'),
      satOtAfter2: g('satOtAfter2'),
      sunday: g('sunday'),
      ph: g('ph'),
      mealAllow: g('mealAllow'),
      brokenShift: g('brokenShift'),
      sleepover: g('sleepover'),
      kmRate: g('kmRate') || VEHICLE_RATE,
    };
    if (sleepoverExtraCol >= 0) row.sleepoverExtra = gx(sleepoverExtraCol);
    map.set(normName(name), row);
  }
  return map;
}
