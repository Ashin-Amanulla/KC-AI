/**
 * Pay Hours Orchestrator
 *
 * Reads shifts + holidays from MongoDB, calls the calculator for each staff member,
 * persists PayHours + ShiftPayHours records, and updates the PayHoursJob status.
 *
 * Mirrors KC Studio behaviour: holidays are scoped per location, so shifts uploaded
 * for Brisbane get Brisbane's public holidays, not some other location's.
 */

import { Shift } from '../../shifts/shift.model.js';
import { getHolidaysInRange } from '../../holidays/holiday.service.js';
import { PayHours } from '../payHours.model.js';
import { ShiftPayHours } from '../shiftPayHours.model.js';
import { PayHoursJob } from '../payHoursJob.model.js';
import { computePayHoursForStaff } from './payHoursCalculator.js';
import mongoose from 'mongoose';

/**
 * Compute all pay hours for all staff (optionally filtered by location).
 * Called by the BullMQ worker with a jobId.
 *
 * @param {string} jobId - PayHoursJob _id
 * @param {string|null} locationId - Optional: restrict to one location
 */
export async function computeAllPayHours(jobId, locationId = null) {
  const job = await PayHoursJob.findById(jobId);
  if (!job) throw new Error(`PayHoursJob not found: ${jobId}`);

  job.status = 'processing';
  job.startedAt = new Date();
  await job.save();

  const errors = [];

  try {
    // Build shift query — scope to location if provided
    const shiftFilter = locationId ? { location: new mongoose.Types.ObjectId(locationId) } : {};
    const allShifts = await Shift.find(shiftFilter).sort({ staffName: 1, startDatetime: 1 }).lean();

    if (!allShifts.length) {
      job.status = 'completed';
      job.progress = 100;
      job.staffProcessed = 0;
      job.payHoursCreated = 0;
      job.completedAt = new Date();
      await job.save();
      return;
    }

    // Overall period range (across all shifts)
    const minStart = allShifts.reduce((min, s) => s.startDatetime < min ? s.startDatetime : min, allShifts[0].startDatetime);
    const maxEnd   = allShifts.reduce((max, s) => s.endDatetime   > max ? s.endDatetime   : max, allShifts[0].endDatetime);

    job.periodStart = minStart;
    job.periodEnd   = maxEnd;
    await job.save();

    // Group shifts by location (each location needs its own holiday set)
    // Shifts without a location are grouped under the key 'null'
    const byLocation = new Map();
    for (const shift of allShifts) {
      const locKey = shift.location ? shift.location.toString() : null;
      if (!byLocation.has(locKey)) byLocation.set(locKey, []);
      byLocation.get(locKey).push(shift);
    }

    // Pre-fetch holiday sets per location — mirrors KC Studio get_holidays_in_range(location, ...)
    const holidaySetByLocation = new Map();
    for (const [locKey, shifts] of byLocation.entries()) {
      const locMinStart = shifts.reduce((min, s) => s.startDatetime < min ? s.startDatetime : min, shifts[0].startDatetime);
      const locMaxEnd   = shifts.reduce((max, s) => s.endDatetime   > max ? s.endDatetime   : max, shifts[0].endDatetime);

      if (locKey) {
        holidaySetByLocation.set(locKey, await getHolidaysInRange(locKey, locMinStart, locMaxEnd));
      } else {
        // Shifts with no location — empty holiday set (no holidays can be attributed)
        holidaySetByLocation.set(null, new Set());
      }
    }

    // Group shifts by staffName (within each location group)
    const staffEntries = []; // { staffName, locationId, shifts }
    for (const [locKey, shifts] of byLocation.entries()) {
      const byStaff = new Map();
      for (const shift of shifts) {
        if (!byStaff.has(shift.staffName)) byStaff.set(shift.staffName, []);
        byStaff.get(shift.staffName).push(shift);
      }
      for (const [staffName, staffShifts] of byStaff.entries()) {
        staffEntries.push({ staffName, locationId: locKey, shifts: staffShifts });
      }
    }

    const totalStaff = staffEntries.length;
    const payHoursDocs    = [];
    const shiftPayHoursDocs = [];

    for (let i = 0; i < staffEntries.length; i++) {
      const { staffName, locationId: locKey, shifts: staffShifts } = staffEntries[i];
      const holidaySet = holidaySetByLocation.get(locKey) ?? new Set();

      try {
        const { data, shiftBreakdowns } = computePayHoursForStaff(staffShifts, holidaySet);

        const staffStart = staffShifts.reduce((min, s) => s.startDatetime < min ? s.startDatetime : min, staffShifts[0].startDatetime);
        const staffEnd   = staffShifts.reduce((max, s) => s.endDatetime   > max ? s.endDatetime   : max, staffShifts[0].endDatetime);

        const payHoursId = new mongoose.Types.ObjectId();
        const totalKm = staffShifts.reduce((sum, s) => sum + (s.mileage || 0), 0);
        payHoursDocs.push({
          _id: payHoursId,
          location: locKey ? new mongoose.Types.ObjectId(locKey) : null,
          staffName,
          periodStart: staffStart,
          periodEnd:   staffEnd,
          ...data,
          totalKm,
          computedAt: new Date(),
        });

        for (const [shiftId, bd] of shiftBreakdowns) {
          shiftPayHoursDocs.push({
            payHoursId,
            shiftId:          new mongoose.Types.ObjectId(shiftId),
            staffName,
            shiftDate:        bd.shiftDate,
            shiftStart:       bd.shiftStart,
            shiftEnd:         bd.shiftEnd,
            shiftType:        bd.shiftType,
            clientName:       bd.clientName,
            totalHours:       bd.totalHours,
            morningHours:     bd.morningHours,
            afternoonHours:   bd.afternoonHours,
            nightHours:       bd.nightHours,
            saturdayHours:    bd.saturdayHours,
            sundayHours:      bd.sundayHours,
            holidayHours:     bd.holidayHours,
            nursingCareHours: bd.nursingCareHours,
            weekdayOtUpto2:   0,
            weekdayOtAfter2:  0,
            saturdayOtUpto2:  0,
            saturdayOtAfter2: 0,
            sundayOtUpto2:    0,
            sundayOtAfter2:   0,
            holidayOtUpto2:   0,
            holidayOtAfter2:  0,
            isBrokenShift:    bd.isBrokenShift,
            isSleepover:      bd.isSleepover,
            mileage:          bd.mileage ?? null,
          });
        }
      } catch (err) {
        errors.push(`${staffName}: ${err.message}`);
      }

      job.progress = Math.round(((i + 1) / totalStaff) * 100);
      job.staffProcessed = i + 1;
      await job.save();
    }

    // Full replace within scope: delete old results then insert new ones in a transaction
    const session = await mongoose.startSession();
    try {
      await session.withTransaction(async () => {
        const deleteFilter = locationId ? { location: new mongoose.Types.ObjectId(locationId) } : {};

        // For ShiftPayHours we need to find the payHoursIds that belong to this location
        if (locationId) {
          const oldPayHoursIds = await PayHours.find(deleteFilter).distinct('_id').session(session);
          await ShiftPayHours.deleteMany({ payHoursId: { $in: oldPayHoursIds } }, { session });
        } else {
          await ShiftPayHours.deleteMany({}, { session });
        }
        await PayHours.deleteMany(deleteFilter, { session });

        if (payHoursDocs.length > 0)     await PayHours.insertMany(payHoursDocs, { session });
        if (shiftPayHoursDocs.length > 0) await ShiftPayHours.insertMany(shiftPayHoursDocs, { session });
      });
    } finally {
      await session.endSession();
    }

    job.status = 'completed';
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
