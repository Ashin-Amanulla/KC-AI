import assert from 'node:assert';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import test, { describe } from 'node:test';
import { computePayHoursForStaff } from '../pay-hours/services/payHoursCalculator.js';
import { detectBrokenShifts, parseShiftCsvBuffer } from '../shifts/shiftCsvParser.js';
import { calcGross, casualEff } from '../pay-hours/services/wageCalculator.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const CHECKLIST_PH = new Set(['2026-05-04']);
const GOOD_FRIDAY = new Set(['2026-04-03']);

const r2 = (n) => Math.round(n * 100) / 100;

function brisbaneLocal(ymd, hour, minute = 0) {
  const [y, mo, d] = ymd.split('-').map(Number);
  const localMidnightUtc = Date.UTC(y, mo - 1, d, 0, 0, 0) - 10 * 3600000;
  return new Date(localMidnightUtc + hour * 3600000 + minute * 60000);
}

function shift(overrides) {
  const start = new Date(overrides.start);
  const end = new Date(overrides.end);
  return {
    _id: overrides._id ?? '507f1f77bcf86cd799439011',
    staffName: overrides.staffName ?? 'Test Staff',
    startDatetime: start,
    endDatetime: end,
    hours: overrides.hours ?? r2((end - start) / 3600000),
    shiftType: overrides.shiftType ?? 'personal_care',
    isBrokenShift: !!overrides.isBrokenShift,
    timezoneOffset: overrides.timezoneOffset ?? '+10:00',
    clientName: overrides.clientName ?? null,
  };
}

function shiftBrisbane(overrides, ymd, h1, m1, h2, m2) {
  const start = brisbaneLocal(ymd, h1, m1);
  const end = brisbaneLocal(ymd, h2, m2);
  return shift({
    ...overrides,
    start: start.toISOString(),
    end: end.toISOString(),
    hours: overrides.hours ?? r2((end - start) / 3600000),
  });
}

function bucketTotal(data) {
  return r2(
    (data.morningHours || 0) +
      (data.afternoonHours || 0) +
      (data.nightHours || 0) +
      (data.weekdayOtUpto2 || 0) +
      (data.weekdayOtAfter2 || 0) +
      (data.saturdayHours || 0) +
      (data.saturdayOtUpto2 || 0) +
      (data.saturdayOtAfter2 || 0) +
      (data.sundayHours || 0) +
      (data.sundayOtUpto2 || 0) +
      (data.sundayOtAfter2 || 0) +
      (data.holidayHours || 0) +
      (data.holidayOtUpto2 || 0) +
      (data.holidayOtAfter2 || 0) +
      (data.shortTurnaroundHours || 0)
  );
}

describe('client checklist — section A boundaries', () => {
  test('[A-02] start exactly 06:00 → morning', () => {
    const s = shiftBrisbane({ _id: 'a02' }, '2026-05-05', 6, 0, 14, 0);
    const { data } = computePayHoursForStaff([s], CHECKLIST_PH);
    assert.strictEqual(data.morningHours, 8);
    assert.strictEqual(data.afternoonHours, 0);
  });

  test('[A-03] end exactly 20:00 → morning only', () => {
    const s = shiftBrisbane({ _id: 'a03' }, '2026-05-06', 14, 0, 20, 0);
    const { data } = computePayHoursForStaff([s], CHECKLIST_PH);
    assert.strictEqual(data.morningHours, 6);
    assert.strictEqual(data.afternoonHours, 0);
  });

  test('[A-07] start exactly 20:00 → afternoon', () => {
    const s = shiftBrisbane({ _id: 'a07' }, '2026-05-12', 20, 0, 24, 0);
    const { data } = computePayHoursForStaff([s], CHECKLIST_PH);
    assert.strictEqual(data.afternoonHours, 4);
    assert.strictEqual(data.morningHours, 0);
  });
});

describe('client checklist — section F midnight', () => {
  test('[F-05] Sun 22:00–Mon 06:00 SPLIT step-down', () => {
    const start = brisbaneLocal('2026-05-10', 22, 0);
    const end = brisbaneLocal('2026-05-11', 6, 0);
    const s = shift({ _id: 'f05', start: start.toISOString(), end: end.toISOString(), hours: 8 });
    const { data } = computePayHoursForStaff([s], CHECKLIST_PH);
    assert.strictEqual(data.sundayHours, 2);
    assert.strictEqual(data.nightHours, 6);
  });
});

describe('client checklist — section G broken spans', () => {
  test('[G-02b] span 13h → 1h @ 2× after 12h mark', () => {
    const s1 = shiftBrisbane({ _id: 'g02a' }, '2026-05-05', 7, 0, 12, 0);
    const s2 = shiftBrisbane({ _id: 'g02b', isBrokenShift: true }, '2026-05-05', 14, 0, 20, 0);
    const { data } = computePayHoursForStaff([s1, s2], CHECKLIST_PH);
    assert.strictEqual(data.weekdayOtAfter2, 1);
    assert.strictEqual(data.weekdayOtUpto2, 0);
    assert.ok(data.morningHours > 0, 'period 1 stays morning band');
  });

  test('[G-05b] span exactly 12h → 1h daily OT @ 1.5× only', () => {
    const s1 = shiftBrisbane({ _id: 'g05a' }, '2026-05-07', 8, 0, 13, 0);
    const s2 = shiftBrisbane({ _id: 'g05b', isBrokenShift: true }, '2026-05-07', 14, 0, 20, 0);
    const { data } = computePayHoursForStaff([s1, s2], CHECKLIST_PH);
    assert.strictEqual(data.weekdayOtUpto2, 1);
    assert.strictEqual(data.weekdayOtAfter2, 0);
  });

  test('[G-06b] span 13h ending 21:00 → 1h @ 2×', () => {
    const s1 = shiftBrisbane({ _id: 'g06a' }, '2026-05-08', 8, 0, 13, 0);
    const s2 = shiftBrisbane({ _id: 'g06b', isBrokenShift: true }, '2026-05-08', 15, 0, 21, 0);
    const { data } = computePayHoursForStaff([s1, s2], CHECKLIST_PH);
    assert.strictEqual(data.weekdayOtAfter2, 1);
  });
});

describe('client checklist — section I/K sleepover flags', () => {
  test('[K-04] exactly 4h pre-sleepover → no 4h flag', () => {
    const pre = shiftBrisbane({ _id: 'k04a', shiftType: 'personal_care' }, '2026-05-07', 18, 0, 22, 0);
    const soStart = brisbaneLocal('2026-05-07', 22, 0);
    const soEnd = brisbaneLocal('2026-05-08', 6, 0);
    const sleepover = shift({
      _id: 'k04b',
      shiftType: 'sleepover',
      start: soStart.toISOString(),
      end: soEnd.toISOString(),
      hours: 8,
    });
    const { shiftBreakdowns } = computePayHoursForStaff([pre, sleepover], CHECKLIST_PH);
    assert.strictEqual(shiftBreakdowns.get('k04a')?.minimum4hEngagementReview, false);
  });

  test('[K-05] 1.5h pre-sleepover → 2h and 4h flags', () => {
    const pre = shiftBrisbane({ _id: 'k05a', shiftType: 'personal_care' }, '2026-05-08', 20, 30, 22, 0);
    const soStart = brisbaneLocal('2026-05-08', 22, 0);
    const soEnd = brisbaneLocal('2026-05-09', 6, 0);
    const sleepover = shift({
      _id: 'k05b',
      shiftType: 'sleepover',
      start: soStart.toISOString(),
      end: soEnd.toISOString(),
      hours: 8,
    });
    const { shiftBreakdowns } = computePayHoursForStaff([pre, sleepover], CHECKLIST_PH);
    assert.strictEqual(shiftBreakdowns.get('k05a')?.minimumEngagementException, false);
    assert.strictEqual(shiftBreakdowns.get('k05a')?.minimum4hEngagementReview, true);
  });

  test('[I-07b] gap < 8h before sleepover → preSleepoverInsufficientBreak', () => {
    const pre = shiftBrisbane({ _id: 'i07a' }, '2026-05-07', 14, 0, 22, 0);
    const soStart = brisbaneLocal('2026-05-07', 23, 0);
    const soEnd = brisbaneLocal('2026-05-08', 7, 0);
    const sleepover = shift({
      _id: 'i07b',
      shiftType: 'sleepover',
      start: soStart.toISOString(),
      end: soEnd.toISOString(),
      hours: 8,
    });
    const { shiftBreakdowns } = computePayHoursForStaff([pre, sleepover], CHECKLIST_PH);
    assert.strictEqual(shiftBreakdowns.get('i07a')?.preSleepoverInsufficientBreak, true);
  });
});

describe('client checklist — section M casual rates', () => {
  test('[M-01] casual weekday ordinary $36.23/hr', () => {
    const storedRate = 36.23;
    const eff = r2(casualEff(storedRate, 1.0));
    assert.strictEqual(eff, 36.23);
    const s = shiftBrisbane({ _id: 'm01' }, '2026-05-05', 8, 0, 16, 0);
    const ph = computePayHoursForStaff([s], CHECKLIST_PH).data;
    const gross = calcGross(ph, storedRate, 'casual');
    assert.strictEqual(r2(gross / 8), 36.23);
  });
});

describe('client timesheet CSV — Georgia Bailey broken spans', () => {
  const csvPath = path.join(__dirname, '../../../temp/SCHADS_Test_Timesheet.csv');

  test('G-02b Georgia span OT from imported CSV', { skip: !fs.existsSync(csvPath) }, () => {
    const buf = fs.readFileSync(csvPath);
    const { shifts } = parseShiftCsvBuffer(buf);
    const georgia = shifts
      .filter((s) => s.staffName === 'Georgia Bailey' && s.notes?.includes('G-02'))
      .map((s) => ({ ...s, _id: String(s.shiftcareId) }));
    detectBrokenShifts(georgia);
    const { data } = computePayHoursForStaff(georgia, CHECKLIST_PH);
    assert.strictEqual(data.weekdayOtAfter2, 1);
  });
});
