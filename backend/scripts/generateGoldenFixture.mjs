/**
 * Fills in (or refreshes) the `expected` block of golden-run fixtures under
 * modules/rule-engine/fixtures/ by running the current engine.
 *
 * Usage:
 *   node scripts/generateGoldenFixture.mjs               # only fixtures missing `expected`
 *   node scripts/generateGoldenFixture.mjs --rebless     # regenerate all (after a VERIFIED engine change)
 *
 * Only rebless after the change in behaviour has been signed off — golden
 * fixtures exist to catch unintended engine changes.
 */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { computePayHoursForStaff } from '../modules/pay-hours/services/payHoursCalculator.js';
import { detectBrokenShifts } from '../modules/shifts/shiftCsvParser.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const FIXTURES_DIR = path.join(__dirname, '../modules/rule-engine/fixtures');
const rebless = process.argv.includes('--rebless');

for (const file of fs.readdirSync(FIXTURES_DIR).filter((f) => f.endsWith('.json'))) {
  const fullPath = path.join(FIXTURES_DIR, file);
  const fixture = JSON.parse(fs.readFileSync(fullPath, 'utf8'));
  if (fixture.expected && !rebless) {
    console.log(`skip ${file} (already blessed)`);
    continue;
  }
  const shifts = fixture.shifts.map((s, i) => ({
    ...s,
    _id: s._id || `fx-${i + 1}`,
    startDatetime: new Date(s.startDatetime),
    endDatetime: new Date(s.endDatetime),
  }));
  if (fixture.runBrokenDetection !== false) detectBrokenShifts(shifts);
  const { data } = computePayHoursForStaff(shifts, new Set(fixture.holidays || []));
  // Persist only non-zero buckets to keep fixtures readable.
  const expected = {};
  for (const [key, value] of Object.entries(data)) {
    if (typeof value === 'number' && value !== 0) expected[key] = value;
  }
  fixture.expected = expected;
  fs.writeFileSync(fullPath, `${JSON.stringify(fixture, null, 2)}\n`);
  console.log(`blessed ${file}`);
}
