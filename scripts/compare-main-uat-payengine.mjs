/**
 * Compare payHoursCalculator outputs between two repo roots (main vs uat).
 * Usage: node scripts/compare-main-uat-payengine.mjs [mainRoot] [uatRoot]
 */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const defaultMain = path.resolve(__dirname, '../../kcai-main');
const defaultUat = path.resolve(__dirname, '..');

const mainRoot = path.resolve(process.argv[2] || defaultMain);
const uatRoot = path.resolve(process.argv[3] || defaultUat);
const TOLERANCE = 0.01;

const FIXTURE_PATHS = [
  'backend/modules/rule-engine/fixtures/anzac-cross-midnight.json',
  'backend/modules/rule-engine/fixtures/broken-shift-boundary.json',
  'backend/modules/rule-engine/fixtures/double-count-broken-evening.json',
  'backend/modules/rule-engine/fixtures/sleepover-ot76-fortnight.json',
];

async function loadEngine(root) {
  const calcPath = path.join(root, 'backend/modules/pay-hours/services/payHoursCalculator.js');
  const parserPath = path.join(root, 'backend/modules/shifts/shiftCsvParser.js');
  const { computePayHoursForStaff } = await import(pathToFileURL(calcPath).href);
  const { detectBrokenShifts } = await import(pathToFileURL(parserPath).href);
  return { computePayHoursForStaff, detectBrokenShifts };
}

function loadKcStudioFixtures(uatRoot) {
  const dir = path.join(uatRoot, 'backend/fixtures/kc-studio-evidence');
  if (!fs.existsSync(dir)) return [];
  return fs
    .readdirSync(dir)
    .filter((f) => f.endsWith('.json'))
    .map((f) => {
      const raw = JSON.parse(fs.readFileSync(path.join(dir, f), 'utf8'));
      const shifts = Array.isArray(raw) ? raw : raw.shifts;
      return {
        name: `kc-studio/${f.replace('.json', '')}`,
        description: Array.isArray(raw) ? f : raw.description || f,
        holidays: Array.isArray(raw) ? [] : raw.holidays || [],
        shifts,
        expected: Array.isArray(raw) ? undefined : raw.expected,
      };
    });
}

function loadJsonFixtures(root, relPaths) {
  return relPaths.map((rel) => {
    const full = path.join(root, rel);
    const raw = JSON.parse(fs.readFileSync(full, 'utf8'));
    return {
      name: path.basename(rel, '.json'),
      description: raw.description || rel,
      holidays: raw.holidays || [],
      shifts: raw.shifts,
      expected: raw.expected,
      runBrokenDetection: raw.runBrokenDetection,
    };
  });
}

function numericFields(obj) {
  const out = {};
  for (const [k, v] of Object.entries(obj)) {
    if (typeof v === 'number' && !Number.isNaN(v)) out[k] = v;
  }
  return out;
}

function prepareShifts(shifts) {
  return shifts.map((s, i) => ({
    ...s,
    _id: s._id || `fx-${i + 1}`,
    startDatetime: new Date(s.startDatetime),
    endDatetime: new Date(s.endDatetime),
  }));
}

function compareOutputs(mainData, uatData, label) {
  const mainNums = numericFields(mainData);
  const uatNums = numericFields(uatData);
  const allKeys = new Set([...Object.keys(mainNums), ...Object.keys(uatNums)]);
  const diffs = [];

  for (const key of allKeys) {
    const m = mainNums[key] ?? 0;
    const u = uatNums[key] ?? 0;
    if (Math.abs(m - u) > TOLERANCE) {
      diffs.push({ field: key, main: m, uat: u, delta: r2(u - m) });
    }
  }

  return { label, match: diffs.length === 0, diffs, mainKeys: Object.keys(mainNums).length, uatKeys: Object.keys(uatNums).length };
}

function r2(n) {
  return Math.round(n * 100) / 100;
}

function compareExpected(data, expected, label) {
  if (!expected) return null;
  const nums = numericFields(data);
  const diffs = [];
  for (const [key, exp] of Object.entries(expected)) {
    const act = nums[key] ?? 0;
    if (Math.abs(act - exp) > TOLERANCE) {
      diffs.push({ field: key, expected: exp, actual: act, branch: label });
    }
  }
  for (const [key, val] of Object.entries(nums)) {
    if (expected[key] === undefined && Math.abs(val) > TOLERANCE) {
      diffs.push({ field: key, expected: 0, actual: val, branch: label, extra: true });
    }
  }
  return { label, match: diffs.length === 0, diffs };
}

async function runFixture(engine, fixture) {
  const shifts = prepareShifts(fixture.shifts);
  if (fixture.runBrokenDetection !== false) engine.detectBrokenShifts(shifts);
  const { data } = await engine.computePayHoursForStaff(shifts, new Set(fixture.holidays || []));
  return data;
}

async function main() {
  console.log(`Main root: ${mainRoot}`);
  console.log(`UAT root:  ${uatRoot}`);

  const mainEngine = await loadEngine(mainRoot);
  const uatEngine = await loadEngine(uatRoot);

  const fixtures = [
    ...loadJsonFixtures(uatRoot, FIXTURE_PATHS),
    ...loadKcStudioFixtures(uatRoot),
  ];

  const results = [];
  let matchCount = 0;
  let diffCount = 0;

  for (const fixture of fixtures) {
    const mainData = await runFixture(mainEngine, fixture);
    const uatData = await runFixture(uatEngine, fixture);
    const cmp = compareOutputs(mainData, uatData, fixture.name);
    const mainBless = compareExpected(mainData, fixture.expected, 'main-vs-blessed');
    const uatBless = compareExpected(uatData, fixture.expected, 'uat-vs-blessed');

    if (cmp.match) matchCount += 1;
    else diffCount += 1;

    results.push({
      name: fixture.name,
      description: fixture.description?.slice(0, 80),
      mainUatMatch: cmp.match,
      fieldDiffs: cmp.diffs,
      mainVsBlessed: mainBless,
      uatVsBlessed: uatBless,
    });
  }

  const report = {
    generatedAt: new Date().toISOString(),
    mainRoot,
    uatRoot,
    fixtureCount: fixtures.length,
    mainUatIdentical: matchCount,
    mainUatDifferent: diffCount,
    results,
  };

  const outPath = path.join(uatRoot, 'scripts/output/main-uat-payengine-comparison.json');
  fs.mkdirSync(path.dirname(outPath), { recursive: true });
  fs.writeFileSync(outPath, JSON.stringify(report, null, 2));

  console.log('\n=== MAIN vs UAT PAY ENGINE COMPARISON ===');
  console.log(`Fixtures: ${fixtures.length} | Identical: ${matchCount} | Different: ${diffCount}`);

  for (const r of results) {
    const status = r.mainUatMatch ? 'MATCH' : 'DIFF';
    console.log(`\n[${status}] ${r.name}`);
    if (!r.mainUatMatch) {
      for (const d of r.fieldDiffs) {
        console.log(`  ${d.field}: main=${d.main} uat=${d.uat} (Δ${d.delta})`);
      }
    }
    if (r.mainVsBlessed && !r.mainVsBlessed.match) {
      console.log('  main drifts from blessed:');
      for (const d of r.mainVsBlessed.diffs.slice(0, 8)) {
        console.log(`    ${d.field}: blessed=${d.expected} main=${d.actual}`);
      }
    }
    if (r.uatVsBlessed && !r.uatVsBlessed.match) {
      console.log('  uat drifts from blessed:');
      for (const d of r.uatVsBlessed.diffs.slice(0, 8)) {
        console.log(`    ${d.field}: blessed=${d.expected} uat=${d.actual}`);
      }
    }
  }

  console.log(`\nFull report: ${outPath}`);
  process.exit(diffCount > 0 ? 1 : 0);
}

main().catch((err) => {
  console.error(err);
  process.exit(2);
});
