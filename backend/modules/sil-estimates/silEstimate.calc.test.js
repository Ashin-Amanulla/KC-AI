import test from 'node:test';
import assert from 'node:assert/strict';
import { dayCost, computeSilEstimate, ratioLabelOf } from './silEstimate.calc.js';

const ratesNew = {
  Weekday: {
    AM: { Standard: 73.58, 'High Intensity': 79.6 },
    PM: { Standard: 81.07, 'High Intensity': 87.7 },
    Night: { Standard: 82.57, 'High Intensity': 89.32 },
    Sleepover: { Standard: 311.79, 'High Intensity': 311.79 },
  },
  Saturday: {
    Day: { Standard: 103.54, 'High Intensity': 112.01 },
    Sleepover: { Standard: 311.79, 'High Intensity': 311.79 },
  },
  Sunday: {
    Day: { Standard: 133.5, 'High Intensity': 144.42 },
    Sleepover: { Standard: 311.79, 'High Intensity': 311.79 },
  },
  'Public Holiday': {
    Day: { Standard: 163.46, 'High Intensity': 176.84 },
    Sleepover: { Standard: 311.79, 'High Intensity': 311.79 },
  },
};

test('dayCost applies hourly rate and ratio multiplier', () => {
  const blocks = [
    {
      id: 1,
      period: 'AM',
      intensity: 'Standard',
      hours: 4,
      ratio: '1:2',
      customW: 1,
      customP: 2,
    },
  ];
  const { cost } = dayCost(blocks, 'Weekday', ratesNew);
  assert.equal(cost, 4 * 73.58 * 0.5);
});

test('dayCost uses flat sleepover rate', () => {
  const blocks = [
    {
      id: 1,
      period: 'Sleepover',
      intensity: 'Standard',
      hours: 8,
      ratio: '1:1',
      customW: 1,
      customP: 1,
    },
  ];
  const { cost } = dayCost(blocks, 'Weekday', ratesNew);
  assert.equal(cost, 311.79);
});

test('computeSilEstimate applies public holiday override', () => {
  const templateId = 't1';
  const schedule = {
    Mon: [],
    Tue: [],
    Wed: [],
    Thu: [],
    Fri: [],
    Sat: [],
    Sun: [
      {
        id: 1,
        period: 'AM',
        intensity: 'Standard',
        hours: 4,
        ratio: '1:1',
        customW: 1,
        customP: 1,
      },
    ],
  };
  const result = computeSilEstimate({
    templates: { [templateId]: { id: templateId, schedule } },
    activeTemplateId: templateId,
    segments: [
      { id: 1, label: 'All', start: '2026-07-05', end: '2026-07-05', templateId },
    ],
    ratesOld: ratesNew,
    ratesNew,
    budget: 0,
    planStart: '2026-07-05',
    planEnd: '2026-07-05',
    holidays: [{ id: 1, date: '2026-07-05', name: 'Test PH' }],
  });
  assert.equal(result.totalDays, 1);
  assert.equal(result.phWithinPeriod, 1);
  assert.equal(result.periodTotal, 4 * 163.46);
});

test('computeSilEstimate uses old rates when plan starts before indexation', () => {
  const templateId = 't1';
  const schedule = {
    Mon: [],
    Tue: [
      {
        id: 1,
        period: 'AM',
        intensity: 'Standard',
        hours: 1,
        ratio: '1:1',
        customW: 1,
        customP: 1,
      },
    ],
    Wed: [],
    Thu: [],
    Fri: [],
    Sat: [],
    Sun: [],
  };
  const ratesOld = JSON.parse(JSON.stringify(ratesNew));
  ratesOld.Weekday.AM.Standard = 50;
  const result = computeSilEstimate({
    templates: { [templateId]: { id: templateId, schedule } },
    activeTemplateId: templateId,
    segments: [
      { id: 1, label: 'All', start: '2026-06-02', end: '2026-06-02', templateId },
    ],
    ratesOld,
    ratesNew,
    budget: 0,
    planStart: '2026-06-02',
    planEnd: '2026-06-02',
    holidays: [],
  });
  assert.equal(result.usingOldRates, true);
  assert.equal(result.periodTotal, 50);
});

test('computeSilEstimate tracks sleepover nights and cost', () => {
  const templateId = 't1';
  const schedule = {
    Mon: [
      { id: 1, period: 'Sleepover', intensity: 'Standard', hours: 8, ratio: '1:1', customW: 1, customP: 1 },
    ],
    Tue: [],
    Wed: [],
    Thu: [],
    Fri: [],
    Sat: [],
    Sun: [],
  };
  const result = computeSilEstimate({
    templates: { [templateId]: { id: templateId, schedule } },
    activeTemplateId: templateId,
    segments: [
      { id: 1, label: 'All', start: '2026-07-06', end: '2026-07-06', templateId },
    ],
    ratesOld: ratesNew,
    ratesNew,
    budget: 0,
    planStart: '2026-07-06',
    planEnd: '2026-07-06',
    holidays: [],
  });
  assert.equal(result.periodTotal, 311.79);
  assert.equal(result.sleepoverNights, 1);
  assert.equal(result.sleepoverCost, 311.79);
  assert.equal(result.sleepoverSplitNeeded, false);
});

test('computeSilEstimate splits sleepover when ratios differ across day types', () => {
  const templateId = 't1';
  const schedule = {
    Mon: [
      { id: 1, period: 'Sleepover', intensity: 'Standard', hours: 8, ratio: '1:1', customW: 1, customP: 1 },
    ],
    Tue: [
      { id: 2, period: 'Sleepover', intensity: 'Standard', hours: 8, ratio: '1:2', customW: 1, customP: 2 },
    ],
    Wed: [],
    Thu: [],
    Fri: [],
    Sat: [],
    Sun: [],
  };
  const result = computeSilEstimate({
    templates: { [templateId]: { id: templateId, schedule } },
    activeTemplateId: templateId,
    segments: [
      { id: 1, label: 'All', start: '2026-07-06', end: '2026-07-07', templateId },
    ],
    ratesOld: ratesNew,
    ratesNew,
    budget: 0,
    planStart: '2026-07-06',
    planEnd: '2026-07-07',
    holidays: [],
  });
  assert.equal(result.sleepoverNights, 2);
  assert.equal(result.sleepoverCost, 311.79 * 1 + 311.79 * 0.5);
  assert.equal(result.sleepoverSplitNeeded, true);
  // Two sleepover keys: Mon (1:1) and Tue (1:2)
  const sleepoverKeys = Object.keys(result.categoryBreakdown).filter(k => result.categoryBreakdown[k].period === 'Sleepover');
  assert.equal(sleepoverKeys.length, 2);
});

test('computeSilEstimate breaks down active hours by ratio', () => {
  const templateId = 't1';
  const schedule = {
    Mon: [
      { id: 1, period: 'AM', intensity: 'Standard', hours: 4, ratio: '1:1', customW: 1, customP: 1 },
      { id: 2, period: 'AM', intensity: 'Standard', hours: 4, ratio: '1:2', customW: 1, customP: 2 },
    ],
    Tue: [],
    Wed: [],
    Thu: [],
    Fri: [],
    Sat: [],
    Sun: [],
  };
  const result = computeSilEstimate({
    templates: { [templateId]: { id: templateId, schedule } },
    activeTemplateId: templateId,
    segments: [
      { id: 1, label: 'All', start: '2026-07-06', end: '2026-07-06', templateId },
    ],
    ratesOld: ratesNew,
    ratesNew,
    budget: 0,
    planStart: '2026-07-06',
    planEnd: '2026-07-06',
    holidays: [],
  });
  // Two separate AM rows at 1:1 and 1:2
  const amKeys = Object.keys(result.categoryBreakdown).filter(k => result.categoryBreakdown[k].period === 'AM');
  assert.equal(amKeys.length, 2);
  const row1to1 = result.categoryBreakdown['Weekday|AM|Standard|1:1'];
  const row1to2 = result.categoryBreakdown['Weekday|AM|Standard|1:2'];
  assert.ok(row1to1);
  assert.ok(row1to2);
  assert.equal(row1to1 && row1to1.hours, 4);
  assert.equal(row1to2 && row1to2.hours, 4);
  assert.equal(row1to1 && row1to1.cost, 4 * 73.58 * 1);
  assert.equal(row1to2 && row1to2.cost, 4 * 73.58 * 0.5);
});

test('ratioLabelOf formats ratios correctly', () => {
  assert.equal(ratioLabelOf({ ratio: '1:2', customW: 0, customP: 0 }), '1:2');
  assert.equal(ratioLabelOf({ ratio: 'custom', customW: 3, customP: 2 }), '3:2');
  assert.equal(ratioLabelOf({ ratio: 'custom', customW: 1, customP: 3 }), '1:3');
});
