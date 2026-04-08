/**
 * Pay Hours Orchestrator
 *
 * Reads shifts + holidays from MongoDB, calls the calculator for each staff member,
 * persists PayHours + ShiftPayHours records, and updates the PayHoursJob status.
 */

import { Shift } from '../../shifts/shift.model.js';
import { Holiday } from '../../holidays/holiday.model.js';
import { PayHours } from '../payHours.model.js';
import { ShiftPayHours } from '../shiftPayHours.model.js';
import { PayHoursJob } from '../payHoursJob.model.js';
import { computePayHoursForStaff } from './payHoursCalculator.js';
import mongoose from 'mongoose';

/**
 * Compute all pay hours for all staff.
 * Called by the BullMQ worker with a jobId.
 */
export async function computeAllPayHours(jobId) {
  const job = await PayHoursJob.findById(jobId);
  if (!job) throw new Error(`PayHoursJob not found: ${jobId}`);

  job.status = 'processing';
  job.startedAt = new Date();
  await job.save();

  const errors = [];

  try {
    // Load all shifts sorted by staffName + startDatetime
    const allShifts = await Shift.find({}).sort({ staffName: 1, startDatetime: 1 }).lean();

    if (!allShifts.length) {
      job.status = 'completed';
      job.progress = 100;
      job.staffProcessed = 0;
      job.payHoursCreated = 0;
      job.completedAt = new Date();
      await job.save();
      return;
    }

    // Determine period range from shifts
    const minStart = allShifts.reduce((min, s) => s.startDatetime < min ? s.startDatetime : min, allShifts[0].startDatetime);
    const maxEnd = allShifts.reduce((max, s) => s.endDatetime > max ? s.endDatetime : max, allShifts[0].endDatetime);

    job.periodStart = minStart;
    job.periodEnd = maxEnd;
    await job.save();

    // Load holidays into a Set<"YYYY-MM-DD"> for fast lookups
    const holidays = await Holiday.find({}).lean();
    const holidaySet = new Set(
      holidays.map(h => {
        const d = new Date(h.date);
        return `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, '0')}-${String(d.getUTCDate()).padStart(2, '0')}`;
      })
    );

    // Group shifts by staffName
    const byStaff = new Map();
    for (const shift of allShifts) {
      const key = shift.staffName;
      if (!byStaff.has(key)) byStaff.set(key, []);
      byStaff.get(key).push(shift);
    }

    const staffNames = [...byStaff.keys()];
    const totalStaff = staffNames.length;

    const payHoursDocs = [];
    const shiftPayHoursDocs = [];

    for (let i = 0; i < staffNames.length; i++) {
      const staffName = staffNames[i];
      const staffShifts = byStaff.get(staffName);

      try {
        const { data, shiftBreakdowns } = computePayHoursForStaff(staffShifts, holidaySet);

        // Period for this staff member
        const staffStart = staffShifts.reduce((min, s) => s.startDatetime < min ? s.startDatetime : min, staffShifts[0].startDatetime);
        const staffEnd = staffShifts.reduce((max, s) => s.endDatetime > max ? s.endDatetime : max, staffShifts[0].endDatetime);

        const payHoursId = new mongoose.Types.ObjectId();
        payHoursDocs.push({
          _id: payHoursId,
          staffName,
          periodStart: staffStart,
          periodEnd: staffEnd,
          ...data,
          computedAt: new Date(),
        });

        // Build ShiftPayHours documents
        for (const [shiftId, bd] of shiftBreakdowns) {
          shiftPayHoursDocs.push({
            payHoursId,
            shiftId: new mongoose.Types.ObjectId(shiftId),
            staffName,
            shiftDate: bd.shiftDate,
            shiftStart: bd.shiftStart,
            shiftEnd: bd.shiftEnd,
            shiftType: bd.shiftType,
            clientName: bd.clientName,
            totalHours: bd.totalHours,
            morningHours: bd.morningHours,
            afternoonHours: bd.afternoonHours,
            nightHours: bd.nightHours,
            saturdayHours: bd.saturdayHours,
            sundayHours: bd.sundayHours,
            holidayHours: bd.holidayHours,
            nursingCareHours: bd.nursingCareHours,
            weekdayOtUpto2: 0,
            weekdayOtAfter2: 0,
            saturdayOtUpto2: 0,
            saturdayOtAfter2: 0,
            sundayOtUpto2: 0,
            sundayOtAfter2: 0,
            holidayOtUpto2: 0,
            holidayOtAfter2: 0,
            isBrokenShift: bd.isBrokenShift,
            isSleepover: bd.isSleepover,
          });
        }
      } catch (err) {
        errors.push(`${staffName}: ${err.message}`);
      }

      // Progress update
      const progress = Math.round(((i + 1) / totalStaff) * 100);
      job.progress = progress;
      job.staffProcessed = i + 1;
      await job.save();
    }

    // Full replace: delete old results and insert new ones in a transaction
    const session = await mongoose.startSession();
    try {
      await session.withTransaction(async () => {
        await ShiftPayHours.deleteMany({}, { session });
        await PayHours.deleteMany({}, { session });

        if (payHoursDocs.length > 0) {
          await PayHours.insertMany(payHoursDocs, { session });
        }
        if (shiftPayHoursDocs.length > 0) {
          await ShiftPayHours.insertMany(shiftPayHoursDocs, { session });
        }
      });
    } finally {
      await session.endSession();
    }

    job.status = errors.length > 0 ? 'completed' : 'completed';
    job.progress = 100;
    job.payHoursCreated = payHoursDocs.length;
    job.errors = errors;
    job.completedAt = new Date();
    await job.save();
  } catch (err) {
    job.status = 'failed';
    job.errors = [...errors, err.message];
    job.completedAt = new Date();
    await job.save();
    throw err;
  }
}
