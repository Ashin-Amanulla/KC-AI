import test from 'node:test';
import assert from 'node:assert/strict';
import {
  normStaffNameForMatch,
  lookupByNameKeys,
  registerNameKeys,
} from './staffNameNorm.js';

test('normStaffNameForMatch drops middle names', () => {
  assert.equal(normStaffNameForMatch('Teena Mariyam Shijo'), 'teena shijo');
});

test('lookupByNameKeys matches pay-hours full name to rates keyed by first+last', () => {
  const ratesMap = new Map([['teena shijo', { daytime: 34.44 }]]);
  const rates = lookupByNameKeys(ratesMap, 'Teena Mariyam Shijo');
  assert.equal(rates?.daytime, 34.44);
});

test('registerNameKeys indexes payroll under first+last for middle-name staff', () => {
  const payroll = new Map();
  registerNameKeys(payroll, 'Teena Shijo', { name: 'Teena Shijo', earnings: 1000 });
  assert.ok(payroll.has('teena shijo'));
  const match = lookupByNameKeys(payroll, 'Teena Mariyam Shijo');
  assert.equal(match?.earnings, 1000);
});
