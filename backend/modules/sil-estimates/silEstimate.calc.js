const INDEXATION_DATE = '2026-07-01';
const MAX_PERIOD_DAYS = 1100;
const JS_DAY_TO_NAME = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

const DAY_META = {
  Mon: { rateType: 'Weekday' },
  Tue: { rateType: 'Weekday' },
  Wed: { rateType: 'Weekday' },
  Thu: { rateType: 'Weekday' },
  Fri: { rateType: 'Weekday' },
  Sat: { rateType: 'Saturday' },
  Sun: { rateType: 'Sunday' },
};

const RATIO_MULTIPLIERS = {
  '1:1': 1,
  '2:1': 2,
  '3:1': 3,
  '1:2': 0.5,
  '1:3': 1 / 3,
  '1:4': 0.25,
};

function toISODate(d) {
  return d.toISOString().slice(0, 10);
}

function getRate(rates, dayType, period, intensity) {
  if (dayType === 'Weekday') return rates?.Weekday?.[period]?.[intensity] ?? 0;
  const key = period === 'Sleepover' ? 'Sleepover' : 'Day';
  return rates?.[dayType]?.[key]?.[intensity] ?? 0;
}

function multiplierOf(block) {
  if (block.ratio === 'custom') {
    const w = Number(block.customW) || 0;
    const p = Number(block.customP) || 0;
    return p > 0 ? w / p : 0;
  }
  return RATIO_MULTIPLIERS[block.ratio] ?? 0;
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
    return { id: b.id, period: b.period, intensity: b.intensity, hours: hrs, mult, rate, isFlat, cost: c };
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
}) {
  const usingOldRates = !!planStart && planStart < INDEXATION_DATE;
  const ratesForPeriod = usingOldRates ? ratesOld : ratesNew;

  const start = planStart ? new Date(planStart + 'T00:00:00Z') : null;
  const end = planEnd ? new Date(planEnd + 'T00:00:00Z') : null;
  const holidaySet = new Set((holidays || []).map((h) => h.date));

  let totalDays = 0;
  let periodTotal = 0;
  let uncoveredDays = 0;
  let overlapDays = 0;
  const counts = { Weekday: 0, Saturday: 0, Sunday: 0, 'Public Holiday': 0 };
  const costByType = { Weekday: 0, Saturday: 0, Sunday: 0, 'Public Holiday': 0 };
  const categoryBreakdown = {};
  let dateError = null;
  let phWithinPeriod = 0;
  let weeklyTypical = 0;

  const activeSchedule = templates?.[activeTemplateId]?.schedule || {};
  Object.keys(DAY_META).forEach((d) => {
    weeklyTypical += dayCost(activeSchedule[d], DAY_META[d].rateType, ratesForPeriod).cost;
  });

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
        const dayName = JS_DAY_TO_NAME[cursor.getUTCDay()];
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
            const breakdownPeriod =
              rateType === 'Weekday' ? d.period : d.period === 'Sleepover' ? 'Sleepover' : 'Day';
            const key = `${rateType}|${breakdownPeriod}|${d.intensity}`;
            if (!categoryBreakdown[key]) {
              categoryBreakdown[key] = {
                rateType,
                period: breakdownPeriod,
                intensity: d.intensity,
                hours: 0,
                cost: 0,
              };
            }
            categoryBreakdown[key].hours += d.hours;
            categoryBreakdown[key].cost += d.cost;
          });
        }
        cursor.setUTCDate(cursor.getUTCDate() + 1);
      }
    }
  }

  const variance = budget - periodTotal;
  const pctOfBudget = budget > 0 && !dateError ? periodTotal / budget : 0;

  return {
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
  };
}

export function buildComputedSummary(workspace) {
  const activeName = workspace.activeParticipantName || workspace.participants?.[0]?.name;
  const p = workspace.participants?.find((x) => x.name === activeName) || workspace.participants?.[0];
  if (!p) {
    return {
      periodTotal: 0,
      weeklyTypical: 0,
      variance: 0,
      pctOfBudget: 0,
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
    participantCount: workspace.participants?.length || 0,
    planStart: p.planStart,
    planEnd: p.planEnd,
    dateError: calc.dateError,
  };
}
