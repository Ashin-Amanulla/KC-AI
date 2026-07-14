import mongoose from 'mongoose';
import { PayHours } from '../pay-hours/payHours.model.js';
import { PayHoursJob } from '../pay-hours/payHoursJob.model.js';
import { Shift } from '../shifts/shift.model.js';
import { StaffSchadsRate } from '../staff-rates/staffSchadsRate.model.js';
import { getConstantsEffectiveAt } from '../award-rates/awardRateResolver.js';
import { nameMatchKeys, normStaffNameForMatch } from '../../utils/staffNameNorm.js';

/**
 * Operational summary for the dashboard: last pay-run status, exception
 * counts pulled from the pay engine's own flags, and award-rates staleness —
 * the signals accountants/ops actually need to catch pay problems early.
 */
export const getDashboardSummary = async (req, res, next) => {
  try {
    const { locationId } = req.query;
    const payHoursFilter = locationId ? { location: new mongoose.Types.ObjectId(locationId) } : {};
    const jobFilter = locationId ? { location: new mongoose.Types.ObjectId(locationId) } : {};

    const [lastJob, exceptionAgg, awardRates] = await Promise.all([
      PayHoursJob.findOne(jobFilter).sort({ createdAt: -1 }).lean(),
      PayHours.aggregate([
        { $match: payHoursFilter },
        {
          $group: {
            _id: null,
            staffCount: { $sum: 1 },
            minimumEngagement: {
              $sum: { $cond: [{ $gt: ['$minimumEngagementExceptionCount', 0] }, 1, 0] },
            },
            shortTurnaround: {
              $sum: { $cond: [{ $gt: ['$shortTurnaroundHours', 0] }, 1, 0] },
            },
            brokenShift: {
              $sum: {
                $cond: [
                  {
                    $or: [
                      { $gt: ['$brokenShiftCount', 0] },
                      { $gt: ['$brokenShift2BreakCount', 0] },
                    ],
                  },
                  1,
                  0,
                ],
              },
            },
            noRateCard: {
              $sum: { $cond: [{ $eq: ['$grossSource', null] }, 1, 0] },
            },
            totalGross: { $sum: { $ifNull: ['$gross', 0] } },
          },
        },
      ]),
      getConstantsEffectiveAt(new Date()),
    ]);

    const exceptions = exceptionAgg[0] || {
      staffCount: 0,
      minimumEngagement: 0,
      shortTurnaround: 0,
      brokenShift: 0,
      noRateCard: 0,
      totalGross: 0,
    };

    // Rate-card coverage: staff who worked shifts but have no matching rate card.
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
    const missingRateCardCount = staffNames.filter(
      (name) => ![...nameMatchKeys(name)].some((k) => ratedKeys.has(k))
    ).length;

    res.json({
      payRun: lastJob
        ? {
            status: lastJob.status,
            periodStart: lastJob.periodStart,
            periodEnd: lastJob.periodEnd,
            staffProcessed: lastJob.staffProcessed,
            payHoursCreated: lastJob.payHoursCreated,
            errorCount: lastJob.errors?.length || 0,
            startedAt: lastJob.startedAt,
            completedAt: lastJob.completedAt,
          }
        : null,
      exceptions: {
        staffCount: exceptions.staffCount,
        minimumEngagement: exceptions.minimumEngagement,
        shortTurnaround: exceptions.shortTurnaround,
        brokenShift: exceptions.brokenShift,
        missingRateCard: missingRateCardCount,
      },
      totalGross: Math.round((exceptions.totalGross || 0) * 100) / 100,
      awardRates: {
        setLabel: awardRates.setLabel,
        status: awardRates.status || null,
        isFallback: awardRates.isFallback,
        needsAttention: awardRates.isFallback || awardRates.status === 'needs-verification',
      },
    });
  } catch (err) {
    next(err);
  }
};
