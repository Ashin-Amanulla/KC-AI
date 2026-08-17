import {
  RATIO_PRESETS,
  WEEK_DAYS,
  DAY_META,
  INDEXATION_DATE,
  MAX_PERIOD_DAYS,
  getRate,
  multiplierOf,
} from './constants.js';
import { toISODate } from './formatters.js';

function ratioLabelOf(b) {
  if (b.ratio === 'custom') {
    const w = Number(b.customW) || 0;
    const p = Number(b.customP) || 0;
    return p > 0 ? `${w}:${p}` : b.ratio;
  }
  return b.ratio;
}

export function computeHoursFromTime(start, end) {
  if (!start || !end) return 0;
  const [sh, sm] = start.split(':').map(Number);
  const [eh, em] = end.split(':').map(Number);
  if ([sh, sm, eh, em].some((n) => Number.isNaN(n))) return 0;
  let startMin = sh * 60 + sm;
  let endMin = eh * 60 + em;
  let diff = endMin - startMin;
  if (diff <= 0) diff += 24 * 60;
  return Math.round((diff / 60) * 100) / 100;
}

export function dayCost(blocks, rateDayType, rates) {
  let cost = 0;
  let hoursSum = 0;
  const details = (blocks || []).map((b) => {
    const mult = multiplierOf(b);
    const hrs = Number(b.hours) || 0;
    hoursSum += hrs;
    const rate = getRate(rates, rateDayType, b.period, b.intensity);
    const isFlat = b.period === 'Sleepover';
    const c = isFlat ? rate * mult : hrs * rate * mult;
    cost += c;
    return {
      id: b.id,
      period: b.period,
      intensity: b.intensity,
      hours: hrs,
      mult,
      rate,
      isFlat,
      cost: c,
      ratioLabel: ratioLabelOf(b),
    };
  });
  return { cost, hoursSum, details };
}

export function computeSilEstimate({
  templates,
  activeTemplateId,
  segments,
  ratesOld,
  ratesNew,
  budget,
  planStart,
  planEnd,
  holidays,
  scheduleFallback,
}) {
  const usingOldRates = !!planStart && planStart < INDEXATION_DATE;
  const ratesForPeriod = usingOldRates ? ratesOld : ratesNew;

  const activeSchedule = templates?.[activeTemplateId]?.schedule || scheduleFallback || {};
  const perDayTypical = {};
  let weeklyTypical = 0;
  WEEK_DAYS.forEach((d) => {
    const { cost, hoursSum, details } = dayCost(activeSchedule[d], DAY_META[d].rateType, ratesForPeriod);
    perDayTypical[d] = { cost, hoursSum, details };
    weeklyTypical += cost;
  });

  const start = planStart ? new Date(planStart + 'T00:00:00Z') : null;
  const end = planEnd ? new Date(planEnd + 'T00:00:00Z') : null;
  const holidaySet = new Set((holidays || []).map((h) => h.date));
  const JS_DAY_TO_NAME = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

  let totalDays = 0;
  let periodTotal = 0;
  let uncoveredDays = 0;
  let overlapDays = 0;
  const counts = { Weekday: 0, Saturday: 0, Sunday: 0, 'Public Holiday': 0 };
  const costByType = { Weekday: 0, Saturday: 0, Sunday: 0, 'Public Holiday': 0 };
  const categoryBreakdown = {};
  let dateError = null;
  let phWithinPeriod = 0;

  // Sleepover tracking by day type
  const sleepoverByType = {
    Weekday: { hours: 0, cost: 0, nights: 0, mults: new Set() },
    Saturday: { hours: 0, cost: 0, nights: 0, mults: new Set() },
    Sunday: { hours: 0, cost: 0, nights: 0, mults: new Set() },
    'Public Holiday': { hours: 0, cost: 0, nights: 0, mults: new Set() },
  };

  if (!start || !end || isNaN(start) || isNaN(end)) {
    dateError = 'Enter a valid plan start and end date.';
  } else if (end < start) {
    dateError = 'Plan end date must be on or after the start date.';
  } else {
    const diffDays = Math.round((end - start) / 86400000) + 1;
    if (diffDays > MAX_PERIOD_DAYS) {
      dateError = `Period is too long to calculate day-by-day (max ~${MAX_PERIOD_DAYS} days).`;
    } else {
      const cursor = new Date(start);
      for (let i = 0; i < diffDays; i++) {
        const iso = toISODate(cursor);
        totalDays += 1;
        const jsDay = cursor.getUTCDay();
        const dayName = JS_DAY_TO_NAME[jsDay];
        const isPH = holidaySet.has(iso);
        const rateType = isPH ? 'Public Holiday' : DAY_META[dayName].rateType;
        if (isPH) phWithinPeriod += 1;

        const matching = (segments || []).filter(
          (seg) => seg.start && seg.end && iso >= seg.start && iso <= seg.end
        );
        if (matching.length > 1) overlapDays += 1;
        const segTemplateId = matching.length ? matching[matching.length - 1].templateId : null;
        const tmpl = segTemplateId ? templates?.[segTemplateId] : null;

        if (!tmpl) {
          uncoveredDays += 1;
        } else {
          const blocks = tmpl.schedule?.[dayName] || [];
          const { cost, details } = dayCost(blocks, rateType, ratesForPeriod);
          periodTotal += cost;
          counts[rateType] += 1;
          costByType[rateType] += cost;

          details.forEach((d) => {
            const isSleepover = d.period === 'Sleepover';
            const breakdownPeriod =
              rateType === 'Weekday' ? d.period : isSleepover ? 'Sleepover' : 'Day';
            // Sleepover is priced the same regardless of day type or intensity, so it's
            // tracked as one combined line item unless the ratio actually differs between
            // day types (in which case cost genuinely differs, and it's split below).
            // Active (non-sleepover) hours are grouped by ratio too, since two blocks in
            // the same day type/period/intensity but different ratios cost differently.
            const key = isSleepover
              ? 'Sleepover|All|All'
              : `${rateType}|${breakdownPeriod}|${d.intensity}|${d.ratioLabel}`;

            if (!categoryBreakdown[key]) {
              categoryBreakdown[key] = {
                rateType: isSleepover ? 'All' : rateType,
                period: breakdownPeriod,
                intensity: isSleepover ? 'All' : d.intensity,
                ratioLabel: isSleepover ? null : d.ratioLabel,
                rate: d.rate,
                mult: d.mult,
                hours: 0,
                cost: 0,
                nights: 0,
              };
            }

            categoryBreakdown[key].hours += d.hours;
            categoryBreakdown[key].cost += d.cost;

            if (isSleepover) {
              categoryBreakdown[key].nights += 1;
              sleepoverByType[rateType].hours += d.hours;
              sleepoverByType[rateType].cost += d.cost;
              sleepoverByType[rateType].nights += 1;
              sleepoverByType[rateType].mults.add(Math.round(d.mult * 10000) / 10000);
            }
          });
        }
        cursor.setUTCDate(cursor.getUTCDate() + 1);
      }
    }
  }

  let sleepoverNights = 0;
  let sleepoverCost = 0;
  Object.values(categoryBreakdown).forEach((row) => {
    if (row.period === 'Sleepover') {
      sleepoverNights += row.nights;
      sleepoverCost += row.cost;
    }
  });

  const allSleepoverMults = new Set();
  Object.values(sleepoverByType).forEach((t) => t.mults.forEach((m) => allSleepoverMults.add(m)));
  const sleepoverSplitNeeded = allSleepoverMults.size > 1;

  const variance = budget - periodTotal;
  const pctOfBudget = budget > 0 && !dateError ? periodTotal / budget : 0;

  return {
    perDayTypical,
    weeklyTypical,
    usingOldRates,
    totalDays,
    periodTotal,
    counts,
    costByType,
    categoryBreakdown,
    dateError,
    phWithinPeriod,
    uncoveredDays,
    overlapDays,
    variance,
    pctOfBudget,
    sleepoverNights,
    sleepoverCost,
    sleepoverByType,
    sleepoverSplitNeeded,
  };
}

export function buildComputedSummary(workspace, activeParticipant) {
  const p = activeParticipant || workspace.participants?.[0];
  if (!p) {
    return {
      periodTotal: 0,
      weeklyTypical: 0,
      variance: 0,
      pctOfBudget: 0,
      sleepoverNights: 0,
      sleepoverCost: 0,
      participantCount: workspace.participants?.length || 0,
    };
  }
  const calc = computeSilEstimate({
    templates: workspace.templates,
    activeTemplateId: p.activeTemplateId,
    segments: p.segments,
    ratesOld: workspace.ratesOld,
    ratesNew: workspace.ratesNew,
    budget: p.budget,
    planStart: p.planStart,
    planEnd: p.planEnd,
    holidays: workspace.holidays,
  });
  return {
    periodTotal: calc.periodTotal,
    weeklyTypical: calc.weeklyTypical,
    variance: calc.variance,
    pctOfBudget: calc.pctOfBudget,
    sleepoverNights: calc.sleepoverNights,
    sleepoverCost: calc.sleepoverCost,
    participantCount: workspace.participants?.length || 0,
    planStart: p.planStart,
    planEnd: p.planEnd,
    dateError: calc.dateError,
  };
}
