import fs from 'node:fs';
import path from 'node:path';
import { pathToFileURL } from 'node:url';

const mainRoot = '/home/cntrlx/Code/Xyvin/KCXyvin/kcai-main';
const uatRoot = '/home/cntrlx/Code/Xyvin/KCXyvin/kcai';
const TOLERANCE = 0.01;

async function load(root) {
  const { computePayHoursForStaff } = await import(
    pathToFileURL(path.join(root, 'backend/modules/pay-hours/services/payHoursCalculator.js')).href
  );
  const { detectBrokenShifts } = await import(
    pathToFileURL(path.join(root, 'backend/modules/shifts/shiftCsvParser.js')).href
  );
  const wage = await import(pathToFileURL(path.join(root, 'frontend/src/lib/schadsWageCalc.js')).href);
  return { computePayHoursForStaff, detectBrokenShifts, calcGrossFromRates: wage.calcGrossFromRates };
}

const rates = {
  weekday: 30,
  afternoon: 33,
  night: 36,
  saturday: 45,
  sunday: 54,
  holiday: 60,
  otTier1Mult: 1.5,
  otTier2Mult: 2,
  brokenShiftAllowance1: 20.82,
  brokenShiftAllowance2: 27.56,
  mealAllowance: 16.62,
  vehicleKmRate: 0.99,
  sleepoverAllowance: 50,
};

const cases = [
  { name: 'double-count-broken-evening', path: 'backend/modules/rule-engine/fixtures/double-count-broken-evening.json' },
  { name: 'rahulBrokenShiftMay22', path: 'backend/fixtures/kc-studio-evidence/rahulBrokenShiftMay22.json' },
];

const main = await load(mainRoot);
const uat = await load(uatRoot);

for (const c of cases) {
  const raw = JSON.parse(fs.readFileSync(path.join(uatRoot, c.path), 'utf8'));
  const shiftList = Array.isArray(raw) ? raw : raw.shifts;
  const holidays = Array.isArray(raw) ? [] : raw.holidays || [];

  const prep = shiftList.map((s, i) => ({
    ...s,
    _id: s._id || `fx-${i}`,
    startDatetime: new Date(s.startDatetime),
    endDatetime: new Date(s.endDatetime),
  }));

  const prepCopy = prep.map((s) => ({
    ...s,
    startDatetime: new Date(s.startDatetime),
    endDatetime: new Date(s.endDatetime),
  }));

  main.detectBrokenShifts(prep);
  uat.detectBrokenShifts(prepCopy);

  const m = main.computePayHoursForStaff(prep, new Set(holidays));
  const u = uat.computePayHoursForStaff(prepCopy, new Set(holidays));
  const mg = main.calcGrossFromRates(m.data, rates);
  const ug = uat.calcGrossFromRates(u.data, rates);

  console.log(`\n=== ${c.name} ===`);
  console.log(`Gross pay: main=$${mg} uat=$${ug} diff=$${Math.abs(mg - ug).toFixed(2)}`);

  const allKeys = new Set([...Object.keys(m.data), ...Object.keys(u.data)]);
  for (const k of allKeys) {
    const mv = m.data[k];
    const uv = u.data[k];
    if (typeof mv === 'number' && typeof uv === 'number' && Math.abs(mv - uv) > TOLERANCE) {
      console.log(`  ${k}: main=${mv} uat=${uv}`);
    }
  }
}
