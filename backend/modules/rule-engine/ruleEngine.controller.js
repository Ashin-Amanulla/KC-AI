import mongoose from 'mongoose';
import { RuleTestRun } from './ruleTestRun.model.js';
import { runEngineTests } from './testRunner.service.js';
import { RULES_CATALOG, RULE_CATEGORIES } from './rulesCatalog.js';
import { getScenarioForRule } from './ruleScenarios.js';
import { getConstantsEffectiveAt } from '../award-rates/awardRateResolver.js';
import { getClientSopGuide } from './clientSopGuide.js';
import { PayHours } from '../pay-hours/payHours.model.js';
import { Shift } from '../shifts/shift.model.js';
import { StaffSchadsRate } from '../staff-rates/staffSchadsRate.model.js';
import { nameMatchKeys, normStaffNameForMatch } from '../../utils/staffNameNorm.js';

export const executeTestRun = async (req, res, next) => {
  try {
    const outcome = await runEngineTests();
    const awardRates = await getConstantsEffectiveAt(new Date());
    const run = await RuleTestRun.create({
      ranAt: new Date(),
      ranBy: req.user?.email || req.user?.name || null,
      durationMs: outcome.durationMs,
      gitSha: outcome.gitSha,
      awardRateSetLabel: awardRates.setLabel,
      totals: outcome.totals,
      ok: outcome.ok,
      results: outcome.results,
    });
    await RuleTestRun.pruneHistory();
    res.status(201).json({ run });
  } catch (err) {
    next(err);
  }
};

export const listTestRuns = async (req, res, next) => {
  try {
    const limit = Math.min(Number(req.query.limit) || 20, 100);
    const runs = await RuleTestRun.find({})
      .sort({ ranAt: -1 })
      .limit(limit)
      .select('-results')
      .lean();
    res.json({ runs });
  } catch (err) {
    next(err);
  }
};

export const getTestRun = async (req, res, next) => {
  try {
    const run = await RuleTestRun.findById(req.params.id).lean();
    if (!run) return res.status(404).json({ error: 'Test run not found' });
    res.json({ run });
  } catch (err) {
    next(err);
  }
};

/**
 * Rules catalog joined with the latest test run: each rule carries
 * lastStatus 'pass' | 'fail' | 'untested' plus its covering test names.
 */
export const listSopGuide = async (_req, res, next) => {
  try {
    res.json(getClientSopGuide());
  } catch (err) {
    next(err);
  }
};

export const listRules = async (_req, res, next) => {
  try {
    const latestRun = await RuleTestRun.findOne({}).sort({ ranAt: -1 }).lean();
    const testsByRule = new Map();
    for (const result of latestRun?.results || []) {
      for (const ruleId of result.ruleIds || []) {
        if (!testsByRule.has(ruleId)) testsByRule.set(ruleId, []);
        testsByRule.get(ruleId).push({
          testName: result.testName,
          status: result.status,
          error: result.error,
        });
      }
    }

    const rules = RULES_CATALOG.map((rule) => {
      const tests = testsByRule.get(rule.id) || [];
      const lastStatus = !tests.length
        ? 'untested'
        : tests.some((t) => t.status === 'fail')
          ? 'fail'
          : 'pass';
      return { ...rule, tests, lastStatus, scenario: getScenarioForRule(rule) };
    });

    res.json({
      categories: RULE_CATEGORIES,
      rules,
      latestRun: latestRun
        ? { _id: latestRun._id, ranAt: latestRun.ranAt, totals: latestRun.totals, ok: latestRun.ok, gitSha: latestRun.gitSha }
        : null,
    });
  } catch (err) {
    next(err);
  }
};

const DIFF_TOLERANCE = 0.02;

/**
 * Diff externally-approved figures (e.g. an accountant's payroll export,
 * parsed to rows client-side) against the latest computed PayHours.
 *
 * Body: { expected: [{ staffName, <numeric PayHours fields> }], locationId? }
 * Response: per-staff per-field deltas beyond tolerance, plus staff present
 * on one side only — formalizes the 2026 payroll-vs-calculator audit.
 */
export const goldenDiff = async (req, res, next) => {
  try {
    const { expected, locationId } = req.body || {};
    if (!Array.isArray(expected) || !expected.length) {
      return res.status(400).json({ error: 'expected must be a non-empty array of rows' });
    }

    const filter = locationId ? { location: new mongoose.Types.ObjectId(locationId) } : {};
    const payHours = await PayHours.find(filter).sort({ computedAt: -1 }).lean();

    // Latest PayHours row per normalized staff name (+ alt match keys)
    const actualByKey = new Map();
    for (const row of payHours) {
      for (const key of nameMatchKeys(row.staffName)) {
        if (!actualByKey.has(key)) actualByKey.set(key, row);
      }
    }

    const diffs = [];
    const unmatchedExpected = [];
    const matchedActualIds = new Set();

    for (const row of expected) {
      const staffName = row.staffName || row.name || '';
      const keys = [...nameMatchKeys(staffName)];
      const actual = keys.map((k) => actualByKey.get(k)).find(Boolean);
      if (!actual) {
        unmatchedExpected.push(staffName);
        continue;
      }
      matchedActualIds.add(String(actual._id));
      const fieldDiffs = [];
      for (const [field, value] of Object.entries(row)) {
        if (field === 'staffName' || field === 'name') continue;
        const expectedNum = Number(value);
        if (!Number.isFinite(expectedNum)) continue;
        const actualNum = Number(actual[field] ?? 0);
        if (Math.abs(actualNum - expectedNum) > DIFF_TOLERANCE) {
          fieldDiffs.push({
            field,
            expected: expectedNum,
            actual: actualNum,
            delta: Math.round((actualNum - expectedNum) * 100) / 100,
          });
        }
      }
      if (fieldDiffs.length) {
        diffs.push({ staffName, payHoursId: actual._id, fields: fieldDiffs });
      }
    }

    const unmatchedActual = payHours
      .filter((p) => !matchedActualIds.has(String(p._id)))
      .map((p) => p.staffName);

    res.json({
      comparedStaff: expected.length,
      staffWithDiffs: diffs.length,
      diffs,
      unmatchedExpected,
      unmatchedActual: [...new Set(unmatchedActual)],
    });
  } catch (err) {
    next(err);
  }
};

const GROSS_PER_HOUR_MIN = 20; // below SCHADS minimum → rate card or hours look wrong
const GROSS_PER_HOUR_MAX = 150; // implausibly high effective rate
const MAX_SINGLE_SHIFT_HOURS = 16;

/**
 * Data-quality scan across imported shifts and computed pay hours. Every
 * check here corresponds to a class of discrepancy accountants have reported:
 * overlapping/duplicate rostered shifts, implausible durations, negative pay
 * buckets, and effective hourly rates outside sane SCHADS bounds.
 */
export const scanAnomalies = async (req, res, next) => {
  try {
    const { locationId } = req.query;
    const shiftFilter = locationId ? { location: new mongoose.Types.ObjectId(locationId) } : {};
    const payFilter = locationId ? { location: new mongoose.Types.ObjectId(locationId) } : {};

    const [shifts, payHours] = await Promise.all([
      Shift.find(shiftFilter)
        .select('staffName startDatetime endDatetime hours shiftType')
        .sort({ staffName: 1, startDatetime: 1 })
        .lean(),
      PayHours.find(payFilter).lean(),
    ]);

    const anomalies = [];

    // Overlapping / zero-duration / implausibly long shifts per staff
    let prevByStaff = new Map();
    for (const shift of shifts) {
      const key = (shift.staffName || '').toLowerCase();
      const start = new Date(shift.startDatetime);
      const end = new Date(shift.endDatetime);
      const durH = (end - start) / 3600000;

      if (durH <= 0) {
        anomalies.push({
          type: 'zero-duration-shift',
          severity: 'error',
          staffName: shift.staffName,
          detail: `Shift ${start.toISOString()} has non-positive duration (${durH.toFixed(2)}h)`,
        });
      } else if (durH > MAX_SINGLE_SHIFT_HOURS && shift.shiftType !== 'sleepover') {
        anomalies.push({
          type: 'implausible-duration',
          severity: 'warning',
          staffName: shift.staffName,
          detail: `${shift.shiftType} shift of ${durH.toFixed(2)}h starting ${start.toISOString()}`,
        });
      }

      const prev = prevByStaff.get(key);
      if (prev && start < prev.end) {
        anomalies.push({
          type: 'overlapping-shifts',
          severity: 'error',
          staffName: shift.staffName,
          detail: `Shift starting ${start.toISOString()} overlaps previous shift ending ${prev.end.toISOString()} — double-paid time`,
        });
      }
      if (!prev || end > prev.end) prevByStaff.set(key, { end });
    }

    // Computed pay sanity
    for (const row of payHours) {
      for (const [field, value] of Object.entries(row)) {
        if (typeof value === 'number' && value < -0.001) {
          anomalies.push({
            type: 'negative-bucket',
            severity: 'error',
            staffName: row.staffName,
            detail: `${field} is negative (${value})`,
          });
        }
      }
      const payable =
        (row.morningHours || 0) + (row.afternoonHours || 0) + (row.nightHours || 0) +
        (row.saturdayHours || 0) + (row.sundayHours || 0) + (row.holidayHours || 0) +
        (row.nursingCareHours || 0) + (row.shortTurnaroundHours || 0) +
        (row.weekdayOtUpto2 || 0) + (row.weekdayOtAfter2 || 0) +
        (row.saturdayOtUpto2 || 0) + (row.saturdayOtAfter2 || 0) +
        (row.sundayOtUpto2 || 0) + (row.sundayOtAfter2 || 0) +
        (row.holidayOtUpto2 || 0) + (row.holidayOtAfter2 || 0);
      if (row.gross != null && payable > 1) {
        const perHour = row.gross / payable;
        if (perHour < GROSS_PER_HOUR_MIN || perHour > GROSS_PER_HOUR_MAX) {
          anomalies.push({
            type: 'effective-rate-out-of-bounds',
            severity: 'warning',
            staffName: row.staffName,
            detail: `Effective rate $${perHour.toFixed(2)}/h over ${payable.toFixed(2)} payable hours (gross $${row.gross})`,
          });
        }
      }
    }

    const bySeverity = { error: 0, warning: 0 };
    for (const a of anomalies) bySeverity[a.severity] = (bySeverity[a.severity] || 0) + 1;

    res.json({
      scannedShifts: shifts.length,
      scannedPayHours: payHours.length,
      totals: bySeverity,
      anomalies: anomalies.slice(0, 500),
    });
  } catch (err) {
    next(err);
  }
};

/**
 * Rate-card coverage: staff who worked shifts but have no StaffSchadsRate row
 * (they silently fall back to default rates in cost analysis — a confirmed
 * source of wrong pay figures).
 */
export const rateCardCoverage = async (req, res, next) => {
  try {
    const { locationId } = req.query;
    const shiftFilter = locationId ? { location: new mongoose.Types.ObjectId(locationId) } : {};
    const rateFilter = locationId ? { locationId: new mongoose.Types.ObjectId(locationId) } : {};

    const [staffNames, rateRows] = await Promise.all([
      Shift.distinct('staffName', shiftFilter),
      StaffSchadsRate.find(rateFilter).select('staffName normName aliases').lean(),
    ]);

    const ratedKeys = new Set();
    for (const rate of rateRows) {
      if (rate.normName) ratedKeys.add(rate.normName);
      for (const key of nameMatchKeys(rate.staffName)) ratedKeys.add(key);
      for (const alias of rate.aliases || []) {
        const k = normStaffNameForMatch(alias);
        if (k) ratedKeys.add(k);
      }
    }

    const missingRateCard = staffNames
      .filter((name) => ![...nameMatchKeys(name)].some((k) => ratedKeys.has(k)))
      .sort((a, b) => a.localeCompare(b));

    res.json({
      totalStaffWithShifts: staffNames.length,
      totalWithRateCards: staffNames.length - missingRateCard.length,
      missingRateCard,
    });
  } catch (err) {
    next(err);
  }
};
