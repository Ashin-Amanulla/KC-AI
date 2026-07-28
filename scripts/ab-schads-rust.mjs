#!/usr/bin/env node
/**
 * Repeatable A/B comparison: existing KC AI SCHADS engine vs standalone Rust CLI.
 * Uses identical Brisbane (+10:00) wall-clock shifts and a $30 permanent base rate.
 * Run: node scripts/ab-schads-rust.mjs
 */
import { spawnSync } from 'node:child_process';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { computePayHoursForStaff } from '../backend/modules/pay-hours/services/payHoursCalculator.js';
import { calcGross } from '../backend/modules/pay-hours/services/wageCalculator.js';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const RATE = 30;
const periodStart = '2026-07-06';

function hourMinute(hour) {
  return { hour: Math.trunc(hour), minute: Math.round((hour % 1) * 60) };
}
function localDateTime(ymd, hour) {
  const t = hourMinute(hour);
  return `${ymd}T${String(t.hour).padStart(2, '0')}:${String(t.minute).padStart(2, '0')}:00`;
}
function utcForBrisbane(ymd, hour) {
  const [y, m, d] = ymd.split('-').map(Number);
  const t = hourMinute(hour);
  return new Date(Date.UTC(y, m - 1, d, t.hour - 10, t.minute));
}
function nodeShift(id, spec) {
  const start = utcForBrisbane(spec.date, spec.start);
  const endDate = spec.end < spec.start ? nextDate(spec.date) : spec.date;
  const end = utcForBrisbane(endDate, spec.end);
  return {
    _id: id, staffName: 'A/B Staff', startDatetime: start, endDatetime: end,
    hours: (end - start) / 3600000, shiftType: spec.sleepover ? 'sleepover' : 'personal_care',
    isBrokenShift: Boolean(spec.broken), timezoneOffset: '+10:00', mileage: null, clientName: null,
  };
}
function rustShift(spec) {
  const endDate = spec.end < spec.start ? nextDate(spec.date) : spec.date;
  return {
    start: localDateTime(spec.date, spec.start), end: localDateTime(endDate, spec.end),
    sleepover: Boolean(spec.sleepover), agreed_twelve_hour_sleepover_shift: false, authorised_overtime: false,
  };
}
function nextDate(ymd) {
  const d = new Date(`${ymd}T00:00:00Z`); d.setUTCDate(d.getUTCDate() + 1); return d.toISOString().slice(0, 10);
}
const cases = [
  { id: 'ordinary-weekday', shifts: [{ date: '2026-07-06', start: 9, end: 17 }], holidays: [] },
  { id: 'evening-weekday', shifts: [{ date: '2026-07-07', start: 14, end: 22 }], holidays: [] },
  { id: 'saturday', shifts: [{ date: '2026-07-11', start: 9, end: 17 }], holidays: [] },
  { id: 'sunday', shifts: [{ date: '2026-07-12', start: 9, end: 17 }], holidays: [] },
  { id: 'public-holiday', shifts: [{ date: '2026-07-07', start: 9, end: 17 }], holidays: ['2026-07-07'] },
  { id: 'minimum-engagement', shifts: [{ date: '2026-07-08', start: 9, end: 10.5 }], holidays: [] },
  { id: 'daily-overtime', shifts: [{ date: '2026-07-09', start: 7, end: 19 }], holidays: [] },
  { id: 'broken-shift', shifts: [{ date: '2026-07-10', start: 8, end: 10 }, { date: '2026-07-10', start: 14, end: 16, broken: true }], holidays: [] },
  { id: 'sleepover-eight-hours', shifts: [{ date: '2026-07-10', start: 22, end: 6, sleepover: true }], holidays: [] },
];

function calcRust(testCase) {
  const input = {
    base_hourly_rate: String(RATE), employment: 'part_time', stream: 'disability_services',
    shifts: testCase.shifts.map(rustShift), pay_period_start: periodStart, public_holidays: testCase.holidays, allowances: [],
  };
  const inputPath = path.join(os.tmpdir(), `schads-ab-${process.pid}-${testCase.id}.json`);
  fs.writeFileSync(inputPath, JSON.stringify(input));
  const run = spawnSync('cargo', ['run', '--quiet', '--manifest-path', 'schads-calculator/Cargo.toml', '--', inputPath], { cwd: root, encoding: 'utf8' });
  fs.unlinkSync(inputPath);
  if (run.status !== 0) return { error: (run.stderr || run.stdout).trim() };
  const output = JSON.parse(run.stdout);
  return { gross: Number(output.gross), audit: output.audit_log };
}

const results = cases.map((testCase) => {
  const shifts = testCase.shifts.map((s, i) => nodeShift(`${testCase.id}-${i}`, s));
  const { data } = computePayHoursForStaff(shifts, new Set(testCase.holidays));
  const existingGross = calcGross(data, RATE, 'permanent');
  const rust = calcRust(testCase);
  const rustGross = rust.error ? null : rust.gross;
  return {
    id: testCase.id, existing_gross: existingGross, rust_gross: rustGross,
    delta_rust_minus_existing: rustGross == null || existingGross == null ? null : Number((rustGross - existingGross).toFixed(2)),
    status: rust.error ? 'RUST_ERROR' : rustGross === existingGross ? 'MATCH' : 'DIFFER',
    rust_error: rust.error ?? null,
    existing_pay_hours: data,
  };
});
console.log(JSON.stringify({ assumptions: { rate: RATE, employment: 'part_time', stream: 'disability_services', timezone: '+10:00', node_wage_path: 'calcGross multiplier fallback' }, results }, null, 2));
if (results.some((r) => r.status === 'RUST_ERROR')) process.exitCode = 1;
