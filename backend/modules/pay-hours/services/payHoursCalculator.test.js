import assert from 'node:assert';
import test, { describe } from 'node:test';
import { computePayHoursForStaff } from './payHoursCalculator.js';

function r2(n) {
  return Math.round(n * 100) / 100;
}

/** UTC instant for local wall time in Australia +10:00 (no DST). */
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
    hours: overrides.hours ?? (end - start) / 3600000,
    shiftType: overrides.shiftType ?? 'personal_care',
    isBrokenShift: !!overrides.isBrokenShift,
    timezoneOffset: overrides.timezoneOffset ?? '+10:00',
    mileage: overrides.mileage ?? null,
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

test('weekday 2pm–10pm local (+10): whole shift paid as evening (highest band)', () => {
  // 2026-04-07 = Tuesday AU. Crosses 8pm band boundary; entire shift must be evening.
  const s = shift({
    _id: 'e8e8e8e8e8e8e8e8e8e8e8e8',
    start: '2026-04-07T04:00:00.000Z',
    end: '2026-04-07T12:00:00.000Z',
    hours: 8,
    timezoneOffset: '+10:00',
  });
  const { data } = computePayHoursForStaff([s], new Set());
  assert.strictEqual(data.morningHours, 0, 'no split when crossing into higher weekday band');
  assert.strictEqual(data.afternoonHours, 8, 'full shift treated as evening band');
  assert.strictEqual(data.nightHours, 0);
});

test('weekday 11am–9pm local (+10): whole shift paid as evening (highest band)', () => {
  const s = shift({
    _id: 'f1f1f1f1f1f1f1f1f1f1f1f1',
    start: '2026-04-07T01:00:00.000Z',
    end: '2026-04-07T11:00:00.000Z',
    hours: 10,
    timezoneOffset: '+10:00',
  });
  const { data } = computePayHoursForStaff([s], new Set());
  assert.strictEqual(data.morningHours, 0);
  assert.strictEqual(data.afternoonHours, 10);
  assert.strictEqual(data.nightHours, 0);
});

// ─── SCHADS-style regression suite (engine behaviour; timezone +10:00) ───────

describe('weekday time bands (6am / 8pm local)', () => {
  test('before 6am start: whole same-day segment is night band', () => {
    const s = shiftBrisbane({ _id: 'tb01' }, '2026-04-07', 5, 0, 13, 0);
    const { data } = computePayHoursForStaff([s], new Set());
    assert.strictEqual(data.nightHours, 8);
    assert.strictEqual(data.morningHours, 0);
    assert.strictEqual(data.afternoonHours, 0);
  });

  test('9am–5pm: all daytime (≤8pm) ordinary', () => {
    const s = shiftBrisbane({ _id: 'tb02' }, '2026-04-07', 9, 0, 17, 0);
    const { data } = computePayHoursForStaff([s], new Set());
    assert.strictEqual(data.morningHours, 8);
    assert.strictEqual(data.afternoonHours, 0);
    assert.strictEqual(data.nightHours, 0);
  });

  test('ends exactly 8pm: still daytime band (endHour 20:00 inclusive)', () => {
    const s = shiftBrisbane({ _id: 'tb03' }, '2026-04-07', 12, 0, 20, 0);
    const { data } = computePayHoursForStaff([s], new Set());
    assert.strictEqual(data.morningHours, 8);
    assert.strictEqual(data.afternoonHours, 0);
  });

  test('8pm–10pm only: all evening (>8pm) band', () => {
    const s = shiftBrisbane({ _id: 'tb04' }, '2026-04-07', 20, 0, 22, 0);
    const { data } = computePayHoursForStaff([s], new Set());
    assert.strictEqual(data.afternoonHours, 2);
    assert.strictEqual(data.morningHours, 0);
    assert.strictEqual(data.nightHours, 0);
  });
});

describe('day types (Sat / Sun / public holiday)', () => {
  test('Saturday 9am–5pm: saturdayHours only', () => {
    const s = shiftBrisbane({ _id: 'dt01' }, '2026-04-11', 9, 0, 17, 0);
    const { data } = computePayHoursForStaff([s], new Set());
    assert.strictEqual(data.saturdayHours, 8);
    assert.strictEqual(data.sundayHours, 0);
    assert.strictEqual(data.holidayHours, 0);
    assert.strictEqual(data.morningHours, 0);
  });

  test('Sunday 9am–5pm: sundayHours only', () => {
    const s = shiftBrisbane({ _id: 'dt02' }, '2026-04-12', 9, 0, 17, 0);
    const { data } = computePayHoursForStaff([s], new Set());
    assert.strictEqual(data.sundayHours, 8);
    assert.strictEqual(data.saturdayHours, 0);
    assert.strictEqual(data.morningHours, 0);
  });

  test('calendar PH overrides weekday: all holidayHours', () => {
    const s = shiftBrisbane({ _id: 'dt03' }, '2026-04-07', 9, 0, 17, 0);
    const { data } = computePayHoursForStaff([s], new Set(['2026-04-07']));
    assert.strictEqual(data.holidayHours, 8);
    assert.strictEqual(data.morningHours, 0);
  });
});

describe('midnight crossings', () => {
  test('weekday → weekday (overnight): single night segment', () => {
    const start = brisbaneLocal('2026-04-07', 22, 0);
    const end = brisbaneLocal('2026-04-08', 2, 0);
    const s = shift({ _id: 'mc01', start: start.toISOString(), end: end.toISOString(), hours: 4 });
    const { data } = computePayHoursForStaff([s], new Set());
    assert.strictEqual(data.nightHours, 4);
    assert.strictEqual(data.morningHours, 0);
  });

  test('Friday → Saturday: split 2h weekday night + 2h Saturday', () => {
    const start = brisbaneLocal('2026-04-10', 22, 0);
    const end = brisbaneLocal('2026-04-11', 2, 0);
    const s = shift({ _id: 'mc02', start: start.toISOString(), end: end.toISOString(), hours: 4 });
    const { data } = computePayHoursForStaff([s], new Set());
    assert.strictEqual(data.nightHours, 2);
    assert.strictEqual(data.saturdayHours, 2);
  });
});

describe('Christmas Eve (local 6pm boundary)', () => {
  test('10am–1pm Dec 24: ordinary weekday only (before 6pm PH)', () => {
    const s = shiftBrisbane({ _id: 'ce01' }, '2026-12-24', 10, 0, 13, 0);
    const { data } = computePayHoursForStaff([s], new Set());
    assert.strictEqual(data.morningHours, 3);
    assert.strictEqual(data.holidayHours, 0);
  });

  test('4pm–9pm Dec 24: split weekday + public holiday at 6pm', () => {
    const s = shiftBrisbane({ _id: 'ce02' }, '2026-12-24', 16, 0, 21, 0);
    const { data } = computePayHoursForStaff([s], new Set());
    assert.strictEqual(data.morningHours, 2);
    assert.strictEqual(data.holidayHours, 3);
  });
});

describe('sleepover', () => {
  test('8h sleepover: no billable excess; sleepover counted', () => {
    const s = shiftBrisbane(
      { _id: 'so01', shiftType: 'sleepover', hours: 8 },
      '2026-06-01',
      8,
      0,
      16,
      0
    );
    const { data } = computePayHoursForStaff([s], new Set());
    assert.strictEqual(data.sleepoversCount, 1);
    assert.strictEqual(data.nightHours, 0);
    assert.strictEqual(data.morningHours, 0);
  });

  test('9h sleepover: 1h billable excess as night', () => {
    const s = shift({
      _id: 'so02',
      start: '2026-06-01T22:00:00.000Z',
      end: '2026-06-02T07:00:00.000Z',
      hours: 9,
      shiftType: 'sleepover',
      timezoneOffset: '+10:00',
    });
    const { data } = computePayHoursForStaff([s], new Set());
    assert.strictEqual(data.nightHours, 1);
    assert.strictEqual(data.sleepoversCount, 1);
  });

  test('PC within 8h after sleepover end: forced night band (attached)', () => {
    const sleepover = shift({
      _id: 'so03a',
      start: '2026-06-01T10:00:00.000Z',
      end: '2026-06-01T22:00:00.000Z',
      hours: 12,
      shiftType: 'sleepover',
      timezoneOffset: '+10:00',
    });
    const pc = shift({
      _id: 'so03b',
      start: '2026-06-01T22:00:00.000Z',
      end: '2026-06-02T02:00:00.000Z',
      hours: 4,
      shiftType: 'personal_care',
      isBrokenShift: true,
      timezoneOffset: '+10:00',
    });
    const { data } = computePayHoursForStaff([sleepover, pc], new Set());
    assert.strictEqual(data.nightHours, 8);
    assert.strictEqual(data.morningHours, 0);
  });

  test('PC gap ≥8h after sleepover: not attached; still follows highest weekday band rule', () => {
    const sleepover = shift({
      _id: 'so04a',
      start: '2026-06-01T10:00:00.000Z',
      end: '2026-06-01T22:00:00.000Z',
      hours: 12,
      shiftType: 'sleepover',
      timezoneOffset: '+10:00',
    });
    const gapStart = new Date(sleepover.endDatetime.getTime() + 9 * 3600000);
    const gapEnd = new Date(gapStart.getTime() + 4 * 3600000);
    const pc = shift({
      _id: 'so04b',
      start: gapStart.toISOString(),
      end: gapEnd.toISOString(),
      hours: 4,
      shiftType: 'personal_care',
      isBrokenShift: true,
      timezoneOffset: '+10:00',
    });
    const { data } = computePayHoursForStaff([sleepover, pc], new Set());
    assert.ok(data.morningHours > 0 || data.afternoonHours > 0, 'expect weekday hours (highest-band classification)');
    assert.strictEqual(data.nightHours, 4);
  });
});

describe('nursing_support', () => {
  test('weekday nursing: hours in nursingCareHours not morning/afternoon', () => {
    const s = shiftBrisbane({ _id: 'ns01', shiftType: 'nursing_support' }, '2026-04-07', 9, 0, 17, 0);
    const { data } = computePayHoursForStaff([s], new Set());
    assert.strictEqual(data.nursingCareHours, 8);
    assert.strictEqual(data.morningHours, 0);
  });

  test('Saturday nursing: saturday penalty hours; no nursingCareHours', () => {
    const s = shiftBrisbane({ _id: 'ns02', shiftType: 'nursing_support' }, '2026-04-11', 9, 0, 17, 0);
    const { data } = computePayHoursForStaff([s], new Set());
    assert.strictEqual(data.saturdayHours, 8);
    assert.strictEqual(data.nursingCareHours, 0);
  });

  test('continuous nursing Sat → Sun: split across day types', () => {
    const s1 = shift({
      _id: 'ns03a',
      start: brisbaneLocal('2026-04-11', 23, 0).toISOString(),
      end: brisbaneLocal('2026-04-12', 0, 0).toISOString(),
      hours: 1,
      shiftType: 'nursing_support',
    });
    const s2 = shift({
      _id: 'ns03b',
      start: brisbaneLocal('2026-04-12', 0, 0).toISOString(),
      end: brisbaneLocal('2026-04-12', 4, 0).toISOString(),
      hours: 4,
      shiftType: 'nursing_support',
    });
    const { data } = computePayHoursForStaff([s1, s2], new Set());
    assert.strictEqual(data.saturdayHours, 1);
    assert.strictEqual(data.sundayHours, 4);
    assert.strictEqual(data.nursingCareHours, 0);
  });
});

describe('daily ordinary cap (10h) & OT tiers', () => {
  test('single weekday 12h: 10 ordinary + 2h OT tier1', () => {
    const s = shiftBrisbane({ _id: 'ot01' }, '2026-04-07', 9, 0, 21, 0);
    const { data } = computePayHoursForStaff([s], new Set());
    assert.strictEqual(data.afternoonHours, 10);
    assert.strictEqual(data.weekdayOtUpto2, 2);
    assert.strictEqual(data.weekdayOtAfter2, 0);
    assert.ok(data.mealAllowanceCount >= 1);
  });

  test('Sunday 15h: 10 + 2 tier1 + 3 tier2; meal when OT>4', () => {
    const start = brisbaneLocal('2026-04-12', 9, 0);
    const end = brisbaneLocal('2026-04-13', 0, 0);
    const sAdj = shift({
      _id: 'ot02',
      start: start.toISOString(),
      end: end.toISOString(),
      hours: 15,
    });
    const { data } = computePayHoursForStaff([sAdj], new Set());
    assert.strictEqual(data.sundayHours, 10);
    assert.strictEqual(data.sundayOtUpto2, 2);
    assert.strictEqual(data.sundayOtAfter2, 3);
    assert.strictEqual(data.mealAllowanceCount, 2);
  });

  test('public holiday 12h: 10 holiday + 2 OT tier1', () => {
    const s = shiftBrisbane({ _id: 'ot03' }, '2026-04-07', 9, 0, 21, 0);
    const { data } = computePayHoursForStaff([s], new Set(['2026-04-07']));
    assert.strictEqual(data.holidayHours, 10);
    assert.strictEqual(data.holidayOtUpto2, 2);
    assert.strictEqual(data.holidayOtAfter2, 0);
  });

  test('Saturday 12h: 10 + 2 OT tier1', () => {
    const s = shiftBrisbane({ _id: 'ot04' }, '2026-04-11', 9, 0, 21, 0);
    const { data } = computePayHoursForStaff([s], new Set());
    assert.strictEqual(data.saturdayHours, 10);
    assert.strictEqual(data.saturdayOtUpto2, 2);
  });

  test('weekday 13h: OT tier1 (2h) + tier2 (1h)', () => {
    const s = shiftBrisbane({ _id: 'ot05' }, '2026-04-07', 9, 0, 22, 0);
    const { data } = computePayHoursForStaff([s], new Set());
    assert.strictEqual(data.afternoonHours, 10);
    assert.strictEqual(data.weekdayOtUpto2, 2);
    assert.strictEqual(data.weekdayOtAfter2, 1);
  });

  test('public holiday 13h: holiday OT tier1 + tier2', () => {
    const s = shiftBrisbane({ _id: 'ot06' }, '2026-04-07', 9, 0, 22, 0);
    const { data } = computePayHoursForStaff([s], new Set(['2026-04-07']));
    assert.strictEqual(data.holidayHours, 10);
    assert.strictEqual(data.holidayOtUpto2, 2);
    assert.strictEqual(data.holidayOtAfter2, 1);
  });
});

describe('broken shift (same local day)', () => {
  // Engine adds both full chain ordinary hours and broken-shift OT hours (see processBrokenShiftOvertime + processSingleChain when hasBroken).
  test('short span (<12h) over 10h active: extra goes to WD OT tier1 via broken rule', () => {
    const s1 = shiftBrisbane({ _id: 'br01a', isBrokenShift: false }, '2026-04-07', 9, 0, 15, 0);
    const s2 = shiftBrisbane({ _id: 'br01b', isBrokenShift: true }, '2026-04-07', 15, 0, 20, 0);
    const { data } = computePayHoursForStaff([s1, s2], new Set());
    assert.strictEqual(data.brokenShiftCount, 1);
    assert.strictEqual(data.morningHours, 11);
    assert.strictEqual(data.weekdayOtUpto2, 1);
    assert.strictEqual(data.weekdayOtAfter2, 0);
  });
});

describe('76-hour ordinary cap', () => {
  test('10× Tuesday 8h (non-continuous): last 4h moved to otAfter76 (weekday)', () => {
    const shifts = [];
    for (let w = 0; w < 10; w++) {
      const start = new Date(Date.UTC(2026, 3, 7 + w * 7, 23, 0, 0));
      const end = new Date(start.getTime() + 8 * 3600000);
      shifts.push(
        shift({
          _id: `cap${w}`,
          start: start.toISOString(),
          end: end.toISOString(),
          hours: 8,
        })
      );
    }
    const { data } = computePayHoursForStaff(shifts, new Set());
    assert.strictEqual(data.morningHours, 76);
    assert.strictEqual(data.otAfter76Hours, 4);
    assert.strictEqual(data.otAfter76Weekday, 4);
  });
});
