import fs from 'fs';
import { Shift } from './shift.model.js';
import { PayHours } from '../pay-hours/payHours.model.js';
import { ShiftPayHours } from '../pay-hours/shiftPayHours.model.js';
import { parseShiftCsvBuffer, detectBrokenShifts } from './shiftCsvParser.js';

export const uploadShifts = async (req, res, next) => {
  let filePath = null;
  try {
    if (!req.file) {
      return res.status(400).json({ error: 'No file uploaded' });
    }
    filePath = req.file.path;

    const buffer = fs.readFileSync(filePath);
    const parseResult = parseShiftCsvBuffer(buffer, req.user?.userId);

    // If fatal parsing errors (missing columns), abort early
    if (parseResult.errors.length > 0 && parseResult.shifts.length === 0) {
      return res.status(400).json({
        success: false,
        errors: parseResult.errors,
        rowsProcessed: parseResult.rowsProcessed,
        shiftsCreated: 0,
        shiftsSkipped: parseResult.rowsSkipped,
      });
    }

    // Detect broken shifts (mutates isBrokenShift in place)
    detectBrokenShifts(parseResult.shifts);

    // Full replace strategy — clear existing data then insert new
    await ShiftPayHours.deleteMany({});
    await PayHours.deleteMany({});
    await Shift.deleteMany({});

    let shiftsCreated = 0;
    if (parseResult.shifts.length > 0) {
      const inserted = await Shift.insertMany(parseResult.shifts);
      shiftsCreated = inserted.length;
    }

    // Clean up temp file
    try {
      fs.unlinkSync(filePath);
    } catch {}

    res.json({
      success: true,
      rowsProcessed: parseResult.rowsProcessed,
      shiftsCreated,
      shiftsSkipped: parseResult.rowsSkipped,
      errors: parseResult.errors,
    });
  } catch (error) {
    if (filePath) {
      try { fs.unlinkSync(filePath); } catch {}
    }
    next(error);
  }
};

export const listShifts = async (req, res, next) => {
  try {
    const {
      staffName,
      clientName,
      shiftType,
      broken,
      search,
      page = 1,
      perPage = 50,
    } = req.query;

    const filter = {};

    if (staffName) {
      filter.staffName = { $regex: staffName, $options: 'i' };
    }
    if (clientName) {
      filter.clientName = { $regex: clientName, $options: 'i' };
    }
    if (shiftType && shiftType !== 'all') {
      filter.shiftType = shiftType;
    }
    if (broken === 'true') {
      filter.isBrokenShift = true;
    }
    if (search) {
      filter.$or = [
        { staffName: { $regex: search, $options: 'i' } },
        { clientName: { $regex: search, $options: 'i' } },
      ];
    }

    const pageNum = Math.max(1, parseInt(page, 10));
    const limit = Math.min(5000, Math.max(1, parseInt(perPage, 10)));
    const skip = (pageNum - 1) * limit;

    const [shifts, total] = await Promise.all([
      Shift.find(filter)
        .sort({ startDatetime: 1 })
        .skip(skip)
        .limit(limit)
        .lean(),
      Shift.countDocuments(filter),
    ]);

    // Summary stats (unfiltered)
    const [stats] = await Shift.aggregate([
      {
        $group: {
          _id: null,
          totalHours: { $sum: '$hours' },
          brokenCount: { $sum: { $cond: ['$isBrokenShift', 1, 0] } },
          personalCareCount: { $sum: { $cond: [{ $eq: ['$shiftType', 'personal_care'] }, 1, 0] } },
          sleepoversCount: { $sum: { $cond: [{ $eq: ['$shiftType', 'sleepover'] }, 1, 0] } },
          nursingCount: { $sum: { $cond: [{ $eq: ['$shiftType', 'nursing_support'] }, 1, 0] } },
          minStart: { $min: '$startDatetime' },
          maxEnd: { $max: '$endDatetime' },
          totalCount: { $sum: 1 },
        },
      },
    ]);

    res.json({
      shifts,
      total,
      page: pageNum,
      perPage: limit,
      totalPages: Math.ceil(total / limit),
      stats: stats || {
        totalHours: 0,
        brokenCount: 0,
        personalCareCount: 0,
        sleepoversCount: 0,
        nursingCount: 0,
        minStart: null,
        maxEnd: null,
        totalCount: 0,
      },
    });
  } catch (error) {
    next(error);
  }
};

export const getDateRange = async (req, res, next) => {
  try {
    const [result] = await Shift.aggregate([
      {
        $group: {
          _id: null,
          minStart: { $min: '$startDatetime' },
          maxEnd: { $max: '$endDatetime' },
        },
      },
    ]);

    res.json({
      minStart: result?.minStart ?? null,
      maxEnd: result?.maxEnd ?? null,
    });
  } catch (error) {
    next(error);
  }
};

export const exportShiftsCsv = async (req, res, next) => {
  try {
    const { staffName, shiftType, broken } = req.query;

    const filter = {};
    if (staffName) filter.staffName = { $regex: staffName, $options: 'i' };
    if (shiftType && shiftType !== 'all') filter.shiftType = shiftType;
    if (broken === 'true') filter.isBrokenShift = true;

    const shifts = await Shift.find(filter).sort({ staffName: 1, startDatetime: 1 }).lean();

    const timestamp = new Date().toISOString().replace(/[:.]/g, '').slice(0, 15);
    res.setHeader('Content-Type', 'text/csv');
    res.setHeader('Content-Disposition', `attachment; filename="shifts_${timestamp}.csv"`);

    const headers = [
      'Staff Name', 'Client Name', 'Date', 'Start Time', 'End Time',
      'Hours', 'Shift Type', 'Broken Shift', 'Mileage', 'Expense', 'Notes',
    ];
    res.write(headers.join(',') + '\n');

    for (const shift of shifts) {
      const row = [
        csvEscape(shift.staffName),
        csvEscape(shift.clientName ?? ''),
        shift.startDatetime ? new Date(shift.startDatetime).toISOString().split('T')[0] : '',
        shift.startDatetime ? new Date(shift.startDatetime).toISOString() : '',
        shift.endDatetime ? new Date(shift.endDatetime).toISOString() : '',
        shift.hours ?? '',
        shift.shiftType ?? '',
        shift.isBrokenShift ? 'Yes' : 'No',
        shift.mileage ?? '',
        shift.expense ?? '',
        csvEscape(shift.notes ?? ''),
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
