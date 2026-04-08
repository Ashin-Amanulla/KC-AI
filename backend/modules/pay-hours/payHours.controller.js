import { PayHours } from './payHours.model.js';
import { ShiftPayHours } from './shiftPayHours.model.js';
import { PayHoursJob } from './payHoursJob.model.js';
import { addPayHoursJob } from '../../jobs/payHoursQueue.js';

export const computePayHours = async (req, res, next) => {
  try {
    const job = await PayHoursJob.create({
      triggeredBy: req.user?.userId ?? null,
      status: 'pending',
    });

    await addPayHoursJob({ jobId: job._id.toString() });

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
    const { staffName } = req.query;

    const filter = {};
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

    res.json({ payHours, periodStart, periodEnd, total: payHours.length });
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

    res.json({ payHours, shifts });
  } catch (error) {
    next(error);
  }
};

export const exportPayHoursCsv = async (req, res, next) => {
  try {
    const { staffName } = req.query;

    const filter = {};
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
      'OT After 76 Hours',
      'Broken Shifts',
      'Sleepovers',
    ];
    res.write(headers.join(',') + '\n');

    for (const ph of payHours) {
      const row = [
        csvEscape(ph.staffName),
        ph.morningHours ?? 0,
        ph.afternoonHours ?? 0,
        ph.nightHours ?? 0,
        ph.weekdayOtUpto2 ?? 0,
        ph.weekdayOtAfter2 ?? 0,
        ph.saturdayHours ?? 0,
        ph.saturdayOtUpto2 ?? 0,
        ph.saturdayOtAfter2 ?? 0,
        ph.sundayHours ?? 0,
        ph.sundayOtUpto2 ?? 0,
        ph.sundayOtAfter2 ?? 0,
        ph.holidayHours ?? 0,
        ph.holidayOtUpto2 ?? 0,
        ph.holidayOtAfter2 ?? 0,
        ph.nursingCareHours ?? 0,
        ph.otAfter76Hours ?? 0,
        ph.brokenShiftCount ?? 0,
        ph.sleepoversCount ?? 0,
      ];
      res.write(row.join(',') + '\n');
    }

    res.end();
  } catch (error) {
    next(error);
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
