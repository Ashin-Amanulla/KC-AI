import mongoose from 'mongoose';
import { PayHours } from './payHours.model.js';
import { ShiftPayHours } from './shiftPayHours.model.js';
import { Shift } from '../shifts/shift.model.js';
import { PayHoursJob } from './payHoursJob.model.js';
import { addPayHoursJob } from '../../jobs/payHoursQueue.js';
import {
  manualFieldsToObject,
  pickManualFields,
  serializePayHoursRecord,
  serializeShiftPayHoursRecord,
  SHIFT_MANUAL_FIELD_KEYS,
  STAFF_MANUAL_FIELD_KEYS,
} from './payHoursManualFields.js';
import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import { fileURLToPath } from 'node:url';

const execFileAsync = promisify(execFile);

export const computePayHours = async (req, res, next) => {
  try {
    const locationId = req.body.locationId ?? null;

    const job = await PayHoursJob.create({
      location: locationId,
      triggeredBy: req.user?.userId ?? null,
      status: 'pending',
    });

    await addPayHoursJob({ jobId: job._id.toString(), locationId });

    res.json({ jobId: job._id.toString() });
  } catch (error) {
    next(error);
  }
};

export const getJobStatus = async (req, res, next) => {
  try {
    const job = await PayHoursJob.findById(req.params.id)
      .select('status progress staffProcessed payHoursCreated periodStart periodEnd errors startedAt completedAt')
      .lean();

    if (!job) {
      return res.status(404).json({ error: 'Job not found' });
    }

    res.json(job);
  } catch (error) {
    next(error);
  }
};

export const listPayHours = async (req, res, next) => {
  try {
    const { staffName, locationId } = req.query;

    const filter = {};
    if (locationId) filter.location = locationId;
    if (staffName) {
      filter.staffName = { $regex: staffName, $options: 'i' };
    }

    const payHours = await PayHours.find(filter)
      .sort({ staffName: 1 })
      .lean();

    // Determine overall period
    let periodStart = null;
    let periodEnd = null;
    if (payHours.length > 0) {
      periodStart = payHours.reduce((min, p) => p.periodStart < min ? p.periodStart : min, payHours[0].periodStart);
      periodEnd = payHours.reduce((max, p) => p.periodEnd > max ? p.periodEnd : max, payHours[0].periodEnd);
    }

    res.json({
      payHours: payHours.map(serializePayHoursRecord),
      periodStart,
      periodEnd,
      total: payHours.length,
    });
  } catch (error) {
    next(error);
  }
};

export const listShiftCosts = async (req, res, next) => {
  try {
    const { locationId } = req.query;

    const filter = {};
    if (locationId) filter.location = locationId;

    const payHoursRows = await PayHours.find(filter).select('_id staffName').lean();
    const payHoursIds = payHoursRows.map((p) => p._id);

    if (payHoursIds.length === 0) {
      return res.json({ shifts: [], total: 0 });
    }

    const shiftPayRows = await ShiftPayHours.find({ payHoursId: { $in: payHoursIds } })
      .sort({ shiftStart: 1 })
      .lean();

    const shiftIds = [...new Set(shiftPayRows.map((s) => String(s.shiftId)))];
    const shiftDocs = shiftIds.length
      ? await Shift.find({ _id: { $in: shiftIds } }).select('_id shiftcareId').lean()
      : [];
    const shiftcareById = new Map(shiftDocs.map((s) => [String(s._id), s.shiftcareId || null]));

    const shifts = shiftPayRows.map((row) => ({
      ...serializeShiftPayHoursRecord(row),
      shiftcareId: shiftcareById.get(String(row.shiftId)) || null,
    }));

    res.json({ shifts, total: shifts.length });
  } catch (error) {
    next(error);
  }
};

export const getShiftPayHours = async (req, res, next) => {
  try {
    const { id } = req.params;

    const payHours = await PayHours.findById(id).lean();
    if (!payHours) {
      return res.status(404).json({ error: 'Pay hours record not found' });
    }

    const shifts = await ShiftPayHours.find({ payHoursId: id })
      .sort({ shiftStart: 1 })
      .lean();

    res.json({
      payHours: serializePayHoursRecord(payHours),
      shifts: shifts.map(serializeShiftPayHoursRecord),
    });
  } catch (error) {
    next(error);
  }
};

export const patchPayHoursManual = async (req, res, next) => {
  try {
    const { id } = req.params;
    if (!mongoose.Types.ObjectId.isValid(id)) {
      return res.status(400).json({ error: 'Invalid pay hours id' });
    }

    const payHours = await PayHours.findById(id);
    if (!payHours) return res.status(404).json({ error: 'Pay hours record not found' });

    const incoming = pickManualFields(req.body?.fields ?? {}, STAFF_MANUAL_FIELD_KEYS);
    const unset = Array.isArray(req.body?.unset)
      ? req.body.unset.filter((k) => STAFF_MANUAL_FIELD_KEYS.has(k))
      : [];
    if (!Object.keys(incoming).length && !unset.length) {
      return res.status(400).json({ error: 'No valid manual fields provided' });
    }

    const merged = { ...manualFieldsToObject(payHours.manualFields), ...incoming };
    for (const key of unset) delete merged[key];
    payHours.manualFields = merged;
    payHours.isManuallyAdjusted = Object.keys(merged).length > 0;
    payHours.adjustedAt = new Date();
    payHours.adjustedBy = req.user?.userId ?? null;
    await payHours.save();

    res.json(serializePayHoursRecord(payHours));
  } catch (error) {
    next(error);
  }
};

export const clearPayHoursManual = async (req, res, next) => {
  try {
    const { id } = req.params;
    if (!mongoose.Types.ObjectId.isValid(id)) {
      return res.status(400).json({ error: 'Invalid pay hours id' });
    }

    const payHours = await PayHours.findById(id);
    if (!payHours) return res.status(404).json({ error: 'Pay hours record not found' });

    payHours.manualFields = new Map();
    payHours.isManuallyAdjusted = false;
    payHours.adjustedAt = new Date();
    payHours.adjustedBy = req.user?.userId ?? null;
    await payHours.save();

    res.json(serializePayHoursRecord(payHours));
  } catch (error) {
    next(error);
  }
};

export const patchShiftPayHoursManual = async (req, res, next) => {
  try {
    const { id, shiftPayHoursId } = req.params;
    if (!mongoose.Types.ObjectId.isValid(id) || !mongoose.Types.ObjectId.isValid(shiftPayHoursId)) {
      return res.status(400).json({ error: 'Invalid id' });
    }

    const payHours = await PayHours.findById(id).lean();
    if (!payHours) return res.status(404).json({ error: 'Pay hours record not found' });

    const shiftDoc = await ShiftPayHours.findOne({ _id: shiftPayHoursId, payHoursId: id });
    if (!shiftDoc) return res.status(404).json({ error: 'Shift pay hours record not found' });

    const incoming = pickManualFields(req.body?.fields ?? {}, SHIFT_MANUAL_FIELD_KEYS);
    const unset = Array.isArray(req.body?.unset)
      ? req.body.unset.filter((k) => SHIFT_MANUAL_FIELD_KEYS.has(k))
      : [];
    if (!Object.keys(incoming).length && !unset.length) {
      return res.status(400).json({ error: 'No valid manual fields provided' });
    }

    const merged = { ...manualFieldsToObject(shiftDoc.manualFields), ...incoming };
    for (const key of unset) delete merged[key];
    shiftDoc.manualFields = merged;
    shiftDoc.isManuallyAdjusted = Object.keys(merged).length > 0;
    shiftDoc.adjustedAt = new Date();
    shiftDoc.adjustedBy = req.user?.userId ?? null;
    await shiftDoc.save();

    res.json(serializeShiftPayHoursRecord(shiftDoc));
  } catch (error) {
    next(error);
  }
};

export const clearShiftPayHoursManual = async (req, res, next) => {
  try {
    const { id, shiftPayHoursId } = req.params;
    if (!mongoose.Types.ObjectId.isValid(id) || !mongoose.Types.ObjectId.isValid(shiftPayHoursId)) {
      return res.status(400).json({ error: 'Invalid id' });
    }

    const shiftDoc = await ShiftPayHours.findOne({ _id: shiftPayHoursId, payHoursId: id });
    if (!shiftDoc) return res.status(404).json({ error: 'Shift pay hours record not found' });

    shiftDoc.manualFields = new Map();
    shiftDoc.isManuallyAdjusted = false;
    shiftDoc.adjustedAt = new Date();
    shiftDoc.adjustedBy = req.user?.userId ?? null;
    await shiftDoc.save();

    res.json(serializeShiftPayHoursRecord(shiftDoc));
  } catch (error) {
    next(error);
  }
};

export const exportPayHoursCsv = async (req, res, next) => {
  try {
    const { staffName, locationId } = req.query;

    const filter = {};
    if (locationId) filter.location = locationId;
    if (staffName) filter.staffName = { $regex: staffName, $options: 'i' };

    const payHours = await PayHours.find(filter).sort({ staffName: 1 }).lean();

    const timestamp = new Date().toISOString().replace(/[:.]/g, '').slice(0, 15);
    res.setHeader('Content-Type', 'text/csv');
    res.setHeader('Content-Disposition', `attachment; filename="pay_hours_${timestamp}.csv"`);

    const headers = [
      'Staff Name',
      'Morning Hours',
      'Afternoon Hours',
      'Night Hours',
      'Weekday OT (<=2h)',
      'Weekday OT (>2h)',
      'Saturday Hours',
      'Sat OT (<=2h)',
      'Sat OT (>2h)',
      'Sunday Hours',
      'Sun OT (<=2h)',
      'Sun OT (>2h)',
      'Holiday Hours',
      'Holiday OT (<=2h)',
      'Holiday OT (>2h)',
      'Nursing Care Hours',
      'Broken Shifts',
      'Sleepovers',
      'OT After 76 Hours',
    ];
    res.write(headers.join(',') + '\n');

    for (const ph of payHours) {
      const effective = serializePayHoursRecord(ph);
      const row = [
        csvEscape(ph.staffName),
        effective.morningHours ?? 0,
        effective.afternoonHours ?? 0,
        effective.nightHours ?? 0,
        effective.weekdayOtUpto2 ?? 0,
        effective.weekdayOtAfter2 ?? 0,
        effective.saturdayHours ?? 0,
        effective.saturdayOtUpto2 ?? 0,
        effective.saturdayOtAfter2 ?? 0,
        effective.sundayHours ?? 0,
        effective.sundayOtUpto2 ?? 0,
        effective.sundayOtAfter2 ?? 0,
        effective.holidayHours ?? 0,
        effective.holidayOtUpto2 ?? 0,
        effective.holidayOtAfter2 ?? 0,
        effective.nursingCareHours ?? 0,
        effective.brokenShiftCount ?? 0,
        effective.sleepoversCount ?? 0,
        effective.otAfter76Hours ?? 0,
      ];
      res.write(row.join(',') + '\n');
    }

    res.end();
  } catch (error) {
    next(error);
  }
};

export const runPayHoursEngineTests = async (_req, res, next) => {
  try {
    const testFilePath = fileURLToPath(new URL('./services/payHoursCalculator.test.js', import.meta.url));

    const { stdout, stderr } = await execFileAsync(process.execPath, ['--test', testFilePath], {
      maxBuffer: 10 * 1024 * 1024,
      timeout: 60000,
    });

    const output = [stdout, stderr].filter(Boolean).join('\n').trim();
    res.json({
      ok: true,
      exitCode: 0,
      output,
      ranAt: new Date().toISOString(),
    });
  } catch (error) {
    const output = [error?.stdout, error?.stderr, error?.message].filter(Boolean).join('\n').trim();
    res.status(500).json({
      ok: false,
      exitCode: typeof error?.code === 'number' ? error.code : 1,
      output,
      ranAt: new Date().toISOString(),
    });
  }
};

function csvEscape(val) {
  if (val === null || val === undefined) return '';
  const s = String(val);
  if (s.includes(',') || s.includes('"') || s.includes('\n')) {
    return '"' + s.replace(/"/g, '""') + '"';
  }
  return s;
}
