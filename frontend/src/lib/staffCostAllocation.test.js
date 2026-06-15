import test from 'node:test';
import assert from 'node:assert/strict';
import { buildAwardCostMapFromPayHours } from './schadsWageCalc.js';
import {
  allocateStaffMemberRows,
  buildShiftCostIndex,
  matchBillingGroup,
} from './staffCostAllocation.js';

const rates = {
  daytime: 30,
  afternoon: 33,
  night: 35,
  otUpto2: 45,
  otAfter2: 60,
  saturday: 45,
  satOtAfter2: 60,
  sunday: 60,
  ph: 75,
  mealAllow: 16.62,
  brokenShift: 20.82,
  sleepover: 60,
  kmRate: 0.99,
  allowance: 0,
};

const staffRatesMap = new Map([['jane doe', rates]]);

const shiftWeekday = {
  staffName: 'Jane Doe',
  shiftcareId: '100001',
  morningHours: 8,
  saturdayHours: 0,
  isBrokenShift: false,
  isSleepover: false,
  mileage: 0,
};

const shiftSaturday = {
  staffName: 'Jane Doe',
  shiftcareId: '100002',
  morningHours: 0,
  saturdayHours: 4,
  isBrokenShift: false,
  isSleepover: false,
  mileage: 0,
};

const billingRows = [
  {
    staff: 'Jane Doe',
    client: 'Client X',
    shiftId: '100001',
    startDt: '05/10/2026 06:00 am',
    endDt: '05/10/2026 02:00 pm',
    duration: 8,
    totalCost: 400,
  },
  {
    staff: 'Jane Doe',
    client: 'Client Y',
    shiftId: '100002',
    startDt: '05/11/2026 06:00 am',
    endDt: '05/11/2026 10:00 am',
    duration: 4,
    totalCost: 300,
  },
];

test('shift-based allocation gives higher cost per hour to Saturday client', () => {
  const index = buildShiftCostIndex([shiftWeekday, shiftSaturday], staffRatesMap, 11.5);
  const wages = 8 * 30 + 4 * 45;
  const superAmt = Math.round(wages * 0.115 * 100) / 100;

  const { rowAlloc } = allocateStaffMemberRows({
    billingRows,
    staffNorm: 'jane doe',
    wages,
    superAmt,
    shiftCostIndex: index,
  });

  const clientX = rowAlloc.get(billingRows[0]);
  const clientY = rowAlloc.get(billingRows[1]);

  assert.ok(clientX.employerCost / 8 < clientY.employerCost / 4);
  assert.ok(clientY.wages > clientX.wages / 2);
  assert.equal(
    Math.round((clientX.wages + clientY.wages) * 100) / 100,
    wages
  );
});

test('ratio-split billing rows each get half of shift cost', () => {
  const ratioRows = [
    {
      staff: 'Jane Doe',
      client: 'Client A',
      shiftId: '200001',
      startDt: '05/12/2026 06:00 am',
      endDt: '05/12/2026 10:00 am',
      duration: 2,
      totalCost: 100,
    },
    {
      staff: 'Jane Doe',
      client: 'Client B',
      shiftId: '200001',
      startDt: '05/12/2026 06:00 am',
      endDt: '05/12/2026 10:00 am',
      duration: 2,
      totalCost: 100,
    },
  ];

  const shift = {
    staffName: 'Jane Doe',
    shiftcareId: '200001',
    morningHours: 4,
    isBrokenShift: false,
    isSleepover: false,
    mileage: 0,
  };

  const index = buildShiftCostIndex([shift], staffRatesMap, 11.5);
  const wages = 4 * 30;
  const superAmt = Math.round(wages * 0.115 * 100) / 100;

  const { rowAlloc } = allocateStaffMemberRows({
    billingRows: ratioRows,
    staffNorm: 'jane doe',
    wages,
    superAmt,
    shiftCostIndex: index,
  });

  const a = rowAlloc.get(ratioRows[0]);
  const b = rowAlloc.get(ratioRows[1]);
  assert.equal(a.wages, b.wages);
  assert.equal(Math.round((a.wages + b.wages) * 100) / 100, wages);
});

test('staff totals reconcile with buildAwardCostMapFromPayHours', () => {
  const payHoursRow = {
    staffName: 'Jane Doe',
    morningHours: 8,
    saturdayHours: 4,
    brokenShiftCount: 0,
    sleepoversCount: 0,
    totalKm: 0,
    otAfter76Weekday: 0,
    mealAllowanceCount: 0,
  };

  const costMap = buildAwardCostMapFromPayHours({
    payHoursRows: [payHoursRow],
    staffRatesMap,
    superPct: 11.5,
  });

  const staffCost = costMap.get('jane doe');
  const index = buildShiftCostIndex([shiftWeekday, shiftSaturday], staffRatesMap, 11.5);

  const { rowAlloc } = allocateStaffMemberRows({
    billingRows,
    staffNorm: 'jane doe',
    wages: staffCost.earnings,
    superAmt: staffCost.superAmt,
    shiftCostIndex: index,
  });

  const allocatedWages = [...rowAlloc.values()].reduce((s, v) => s + v.wages, 0);
  assert.equal(Math.round(allocatedWages * 100) / 100, staffCost.earnings);
});

test('matchBillingGroup resolves by shiftcareId', () => {
  const index = buildShiftCostIndex([shiftWeekday], staffRatesMap, 11.5);
  const group = [billingRows[0]];
  const match = matchBillingGroup(group, index, 'jane doe');
  assert.ok(match);
  assert.equal(match.shiftcareId, '100001');
});
