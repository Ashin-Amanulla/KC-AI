import test from 'node:test';
import assert from 'node:assert/strict';
import { dayCost, computeSilEstimate } from './silEstimate.calc.js';

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
