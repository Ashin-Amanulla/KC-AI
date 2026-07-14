import assert from 'node:assert';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import test, { describe } from 'node:test';
import { computePayHoursForStaff } from '../pay-hours/services/payHoursCalculator.js';
import { detectBrokenShifts } from '../shifts/shiftCsvParser.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const FIXTURES_DIR = path.join(__dirname, 'fixtures');
const TOLERANCE = 0.01;

/**
 * Golden-run monitor: each fixture is a blessed engine output. Any change to
 * the engine that alters ANY pay bucket for these scenarios fails here with a
 * field-level diff. Rebless deliberately with:
 *   node scripts/generateGoldenFixture.mjs --rebless
 * only after the behaviour change has been verified/signed off.
 */
describe('golden runs (blessed engine outputs)', () => {
  const files = fs.readdirSync(FIXTURES_DIR).filter((f) => f.endsWith('.json'));

  for (const file of files) {
    const fixture = JSON.parse(fs.readFileSync(path.join(FIXTURES_DIR, file), 'utf8'));

    test(`golden: ${fixture.name} — ${fixture.description.slice(0, 60)}…`, () => {
      assert.ok(fixture.expected, `${file} has no blessed 'expected' block — run scripts/generateGoldenFixture.mjs`);

      const shifts = fixture.shifts.map((s, i) => ({
        ...s,
        _id: s._id || `fx-${i + 1}`,
        startDatetime: new Date(s.startDatetime),
        endDatetime: new Date(s.endDatetime),
      }));
      if (fixture.runBrokenDetection !== false) detectBrokenShifts(shifts);
      const { data } = computePayHoursForStaff(shifts, new Set(fixture.holidays || []));

      const diffs = [];
      // Every blessed bucket must match…
      for (const [key, expectedValue] of Object.entries(fixture.expected)) {
        const actual = data[key] ?? 0;
        if (Math.abs(actual - expectedValue) > TOLERANCE) {
          diffs.push(`${key}: expected ${expectedValue}, got ${actual}`);
        }
      }
      // …and no bucket outside the blessed set may become non-zero.
      for (const [key, value] of Object.entries(data)) {
        if (typeof value !== 'number') continue;
        if (fixture.expected[key] === undefined && Math.abs(value) > TOLERANCE) {
          diffs.push(`${key}: expected 0, got ${value}`);
        }
      }

      assert.strictEqual(
        diffs.length,
        0,
        `engine output drifted from blessed fixture ${file}:\n  ${diffs.join('\n  ')}`
      );
    });
  }
});
