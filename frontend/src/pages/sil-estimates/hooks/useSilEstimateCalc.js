import { useMemo } from 'react';
import { computeSilEstimate } from '../../../lib/silEstimate/calculations';
import { buildDefaultSchedule } from '../../../lib/silEstimate/defaults';
import { getActiveParticipant } from '../../../lib/silEstimate/defaults';

export function useSilEstimateCalc(workspace, activeParticipantOverride) {
  const active =
    activeParticipantOverride || (workspace ? getActiveParticipant(workspace) : null);

  return useMemo(() => {
    if (!workspace || !active) {
      return {
        perDayTypical: {},
        weeklyTypical: 0,
        usingOldRates: false,
        totalDays: 0,
        periodTotal: 0,
        counts: {},
        costByType: {},
        categoryBreakdown: {},
        dateError: 'No participant selected.',
        phWithinPeriod: 0,
        uncoveredDays: 0,
        overlapDays: 0,
        variance: 0,
        pctOfBudget: 0,
      };
    }

    return computeSilEstimate({
      templates: workspace.templates,
      activeTemplateId: active.activeTemplateId,
      segments: active.segments,
      ratesOld: workspace.ratesOld,
      ratesNew: workspace.ratesNew,
      budget: active.budget,
      planStart: active.planStart,
      planEnd: active.planEnd,
      holidays: workspace.holidays,
      scheduleFallback: buildDefaultSchedule(),
    });
  }, [workspace, active]);
}
