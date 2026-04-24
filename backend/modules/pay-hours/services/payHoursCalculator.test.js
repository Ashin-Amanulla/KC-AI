import assert from 'node:assert';
import test from 'node:test';
import { computePayHoursForStaff } from './payHoursCalculator.js';

function r2(n) {
  return Math.round(n * 100) / 100;
}

function shift(overrides) {
  const start = new Date(overrides.start);
  const end = new Date(overrides.end);
  return {
    _id: overrides._id ?? '507f1f77bcf86cd799439011',
    staffName: overrides.staffName ?? 'Test Staff',
    startDatetime: start,
    endDatetime: end,
    hours: overrides.hours ?? (end - start) / 3600000,
    shiftType: overrides.shiftType ?? 'personal_care',
    isBrokenShift: !!overrides.isBrokenShift,
    timezoneOffset: overrides.timezoneOffset ?? '+10:00',
    mileage: overrides.mileage ?? null,
    clientName: overrides.clientName ?? null,
  };
}

test('broken shift: same local day uses local date (AU) not UTC for span grouping', () => {
  // 6pm Brisbane Mon → appears as Sun UTC; second shift same calendar Mon AU
  const s1 = shift({
    _id: 'aaaaaaaaaaaaaaaaaaaaaaaa',
    start: '2026-03-09T08:00:00.000Z',
    end: '2026-03-09T10:00:00.000Z',
    hours: 2,
    isBrokenShift: false,
  });
  const s2 = shift({
    _id: 'bbbbbbbbbbbbbbbbbbbbbbbb',
    start: '2026-03-09T20:00:00.000Z',
    end: '2026-03-09T22:00:00.000Z',
    hours: 2,
    isBrokenShift: true,
  });
  const { data } = computePayHoursForStaff([s1, s2], new Set());
  assert.ok(data.brokenShiftCount >= 1, 'broken shift should be recognised same AU day');
});

test('long-span broken shift: no double-count ordinary + 2× OT for last shift', () => {
  const s1 = shift({
    _id: 'c1c1c1c1c1c1c1c1c1c1c1c1',
    start: '2026-03-11T21:00:00.000Z',
    end: '2026-03-12T01:00:00.000Z',
    hours: 4,
    isBrokenShift: false,
    timezoneOffset: '+10:00',
  });
  const s2 = shift({
    _id: 'c2c2c2c2c2c2c2c2c2c2c2c2',
    start: '2026-03-12T09:00:00.000Z',
    end: '2026-03-12T13:00:00.000Z',
    hours: 4,
    isBrokenShift: true,
    timezoneOffset: '+10:00',
  });
  const { data } = computePayHoursForStaff([s1, s2], new Set());
  const ordinary = r2(data.morningHours + data.afternoonHours + data.nightHours);
  const otAfter = data.weekdayOtAfter2 || 0;
  assert.strictEqual(ordinary, 4, 'only first shift should count as ordinary hours');
  assert.ok(otAfter >= 4, 'last broken shift should be 2× OT hours');
});

test('weekday chain: preserves separate time bands (not one lump at highest penalty)', () => {
  const s1 = shift({
    _id: 'd1d1d1d1d1d1d1d1d1d1d1d1',
    start: '2026-03-11T21:00:00.000Z',
    end: '2026-03-12T03:00:00.000Z',
    hours: 6,
    isBrokenShift: false,
    timezoneOffset: '+10:00',
  });
  const s2 = shift({
    _id: 'd2d2d2d2d2d2d2d2d2d2d2d2',
    start: '2026-03-12T03:00:00.000Z',
    end: '2026-03-12T09:00:00.000Z',
    hours: 6,
    isBrokenShift: false,
    timezoneOffset: '+10:00',
  });
  const { data } = computePayHoursForStaff([s1, s2], new Set());
  assert.ok((data.morningHours || 0) > 0, 'first segment contributes morning-classified hours');
  // 12h continuous weekday chain: first 10h ordinary, next 2h spill to OT — must not be 12h all ordinary
  assert.ok(
    (data.weekdayOtUpto2 || 0) + (data.weekdayOtAfter2 || 0) > 0,
    'combined chain over 10h weekday cap produces OT from end segments'
  );
  assert.ok(
    r2((data.morningHours || 0) + (data.afternoonHours || 0) + (data.nightHours || 0)) <= 10.01,
    'ordinary weekday hours should not exceed 10h once OT is extracted'
  );
});

test('sleepover weekday billable excess is night band, not morning/afternoon', () => {
  // 12h same local day, +10: 8:00–20:00 → 4h excess after 8h sleepover deduction → all night
  const s = shift({
    _id: 'sosososososososososososo',
    start: '2026-06-01T22:00:00.000Z',
    end: '2026-06-02T10:00:00.000Z',
    hours: 12,
    shiftType: 'sleepover',
    timezoneOffset: '+10:00',
  });
  const { data } = computePayHoursForStaff([s], new Set());
  assert.strictEqual(data.nightHours, 4);
  assert.strictEqual(data.morningHours, 0);
  assert.strictEqual(data.afternoonHours, 0);
});

test('personal care immediately after sleepover (within 8h gap) is night band', () => {
  const sleepover = shift({
    _id: 'so1111111111111111111111',
    start: '2026-06-01T10:00:00.000Z',
    end: '2026-06-01T22:00:00.000Z',
    hours: 12,
    shiftType: 'sleepover',
    isBrokenShift: false,
    timezoneOffset: '+10:00',
  });
  const pc = shift({
    _id: 'pc2222222222222222222222',
    start: '2026-06-01T22:00:00.000Z',
    end: '2026-06-02T02:00:00.000Z',
    hours: 4,
    shiftType: 'personal_care',
    isBrokenShift: true,
    timezoneOffset: '+10:00',
  });
  const { data } = computePayHoursForStaff([sleepover, pc], new Set());
  assert.strictEqual(data.nightHours, 8, '4h SO excess + 4h attached PC');
  assert.strictEqual(data.morningHours, 0);
  assert.strictEqual(data.afternoonHours, 0);
});
