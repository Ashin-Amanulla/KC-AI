import assert from 'node:assert';
import { describe, it } from 'node:test';
import {
  minRestHoursBetween,
  shiftEndsWithSleepover,
  shiftStartsWithSleepover,
  shiftDurationHours,
  evaluateStaffForVacant,
  findCover,
} from './eligibilityEngine.js';

const d = (iso) => new Date(iso);

describe('eligibilityEngine', () => {
  it('minRestHoursBetween: standard both ends → 10h', () => {
    const prev = { sleepover: false, startDatetime: d('2025-06-01T08:00:00Z'), endDatetime: d('2025-06-01T16:00:00Z') };
    const next = { sleepover: false, startDatetime: d('2025-06-02T08:00:00Z') };
    assert.strictEqual(minRestHoursBetween(prev, next), 10);
  });

  it('minRestHoursBetween: prev ended sleepover → 8h', () => {
    const prev = { sleepover: true, startDatetime: d('2025-06-01T08:00:00Z'), endDatetime: d('2025-06-02T08:00:00Z') };
    const next = { sleepover: false, startDatetime: d('2025-06-02T18:00:00Z') };
    assert.strictEqual(minRestHoursBetween(prev, next), 8);
  });

  it('minRestHoursBetween: next starts sleepover → 8h', () => {
    const prev = { sleepover: false, startDatetime: d('2025-06-01T08:00:00Z'), endDatetime: d('2025-06-01T16:00:00Z') };
    const next = {
      sleepover: true,
      sleepoverStart: d('2025-06-02T08:00:00Z'),
      startDatetime: d('2025-06-02T08:00:00Z'),
    };
    assert.strictEqual(minRestHoursBetween(prev, next), 8);
  });

  it('shiftStartsWithSleepover false when sleepoverStart missing', () => {
    const s = { sleepover: true, startDatetime: d('2025-06-01T08:00:00Z'), endDatetime: d('2025-06-02T08:00:00Z') };
    assert.strictEqual(shiftStartsWithSleepover(s), false);
    assert.strictEqual(shiftEndsWithSleepover(s), true);
  });

  it('evaluateStaffForVacant: fails participant match', () => {
    const staff = { _id: '507f1f77bcf86cd799439011', contractedFortnightlyHours: 76 };
    const participant = { name: 'Alex', approvedStaffIds: [] };
    const vacant = {
      startDatetime: d('2025-06-10T08:00:00Z'),
      endDatetime: d('2025-06-10T16:00:00Z'),
      sleepover: false,
    };
    const fn = { startUtc: d('2025-06-01').getTime(), endUtc: d('2025-06-15').getTime() };
    const { reasons } = evaluateStaffForVacant(vacant, staff, [], fn, participant);
    assert.ok(reasons.some((r) => r.includes('Not assigned')));
  });

  it('evaluateStaffForVacant: overlap', () => {
    const id = '507f1f77bcf86cd799439011';
    const staff = { _id: id, contractedFortnightlyHours: 76 };
    const participant = { name: 'Alex', approvedStaffIds: [id] };
    const vacant = {
      startDatetime: d('2025-06-10T08:00:00Z'),
      endDatetime: d('2025-06-10T16:00:00Z'),
      sleepover: false,
    };
    const worked = [
      {
        startDatetime: d('2025-06-10T07:00:00Z'),
        endDatetime: d('2025-06-10T12:00:00Z'),
        shiftStatus: 'completed',
      },
    ];
    const fn = { startUtc: d('2025-06-01').getTime(), endUtc: d('2025-06-20').getTime() };
    const { reasons } = evaluateStaffForVacant(vacant, staff, worked, fn, participant);
    assert.ok(reasons.some((r) => r.includes('Already rostered')));
  });

  it('evaluateStaffForVacant: rest before insufficient', () => {
    const id = '507f1f77bcf86cd799439011';
    const staff = { _id: id, contractedFortnightlyHours: 76 };
    const participant = { name: 'Alex', approvedStaffIds: [id] };
    const vacant = {
      startDatetime: d('2025-06-10T08:00:00Z'),
      endDatetime: d('2025-06-10T16:00:00Z'),
      sleepover: false,
    };
    const worked = [
      {
        startDatetime: d('2025-06-09T20:00:00Z'),
        endDatetime: d('2025-06-10T02:00:00Z'),
        shiftStatus: 'completed',
        sleepover: false,
      },
    ];
    const fn = { startUtc: d('2025-06-01').getTime(), endUtc: d('2025-06-20').getTime() };
    const { reasons } = evaluateStaffForVacant(vacant, staff, worked, fn, participant);
    assert.ok(reasons.some((r) => r.includes('Minimum required: 10 hours')));
  });

  it('findCover sorts eligible by hours remaining', () => {
    const p = { name: 'P', approvedStaffIds: ['a', 'b'] };
    const sa = { _id: 'a', contractedFortnightlyHours: 40, phone: '' };
    const sb = { _id: 'b', contractedFortnightlyHours: 40, phone: '' };
    const vacant = {
      startDatetime: d('2025-06-10T08:00:00Z'),
      endDatetime: d('2025-06-10T10:00:00Z'),
      sleepover: false,
    };
    const fn = { startUtc: d('2025-06-01').getTime(), endUtc: d('2025-06-20').getTime() };
    const shiftsByStaffId = new Map([
      [
        'a',
        [
          {
            startDatetime: d('2025-06-05T08:00:00Z'),
            endDatetime: d('2025-06-05T22:00:00Z'),
            shiftStatus: 'completed',
          },
        ],
      ],
      ['b', []],
    ]);
    const { eligibleTeam } = findCover(vacant, p, [sa, sb], shiftsByStaffId, fn);
    assert.strictEqual(eligibleTeam.length, 2);
    assert.strictEqual(String(eligibleTeam[0].staff._id), 'b');
  });

  it('findCover: open pool lists non-team staff who pass logistics only', () => {
    const p = { name: 'House', approvedStaffIds: ['a'] };
    const sa = { _id: 'a', contractedFortnightlyHours: 76, phone: '' };
    const sb = { _id: 'b', contractedFortnightlyHours: 76, phone: '' };
    const vacant = {
      startDatetime: d('2025-06-10T08:00:00Z'),
      endDatetime: d('2025-06-10T10:00:00Z'),
      sleepover: false,
    };
    const fn = { startUtc: d('2025-06-01').getTime(), endUtc: d('2025-06-20').getTime() };
    const shiftsByStaffId = new Map([
      ['a', []],
      ['b', []],
    ]);
    const { eligibleTeam, ineligibleTeam, openPoolEligible } = findCover(vacant, p, [sa, sb], shiftsByStaffId, fn);
    assert.strictEqual(eligibleTeam.length, 1);
    assert.strictEqual(String(eligibleTeam[0].staff._id), 'a');
    assert.strictEqual(ineligibleTeam.length, 0);
    assert.strictEqual(openPoolEligible.length, 1);
    assert.strictEqual(String(openPoolEligible[0].staff._id), 'b');
    assert.strictEqual(openPoolEligible[0].reasons.length, 0);
  });

  it('shiftDurationHours', () => {
    const h = shiftDurationHours({
      startDatetime: d('2025-06-01T08:00:00Z'),
      endDatetime: d('2025-06-01T16:00:00Z'),
    });
    assert.strictEqual(h, 8);
  });
});
