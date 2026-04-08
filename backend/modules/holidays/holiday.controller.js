import { Holiday } from './holiday.model.js';

export const listHolidays = async (req, res, next) => {
  try {
    const { year } = req.query;

    const filter = {};
    if (year) {
      const y = parseInt(year, 10);
      filter.date = {
        $gte: new Date(`${y}-01-01T00:00:00.000Z`),
        $lte: new Date(`${y}-12-31T23:59:59.999Z`),
      };
    }

    const holidays = await Holiday.find(filter).sort({ date: 1 }).lean();
    res.json({ holidays });
  } catch (error) {
    next(error);
  }
};

export const createHoliday = async (req, res, next) => {
  try {
    const { date, name } = req.body;

    if (!date || !name) {
      return res.status(400).json({ error: 'Both date and name are required' });
    }

    // Normalise to midnight UTC of that date
    const normalizedDate = new Date(date);
    normalizedDate.setUTCHours(0, 0, 0, 0);

    const existing = await Holiday.findOne({ date: normalizedDate });
    if (existing) {
      return res.status(409).json({ error: `A holiday already exists on ${date}` });
    }

    const holiday = await Holiday.create({
      date: normalizedDate,
      name: name.trim(),
      createdBy: req.user?.userId ?? null,
    });

    res.status(201).json({ holiday });
  } catch (error) {
    next(error);
  }
};

export const deleteHoliday = async (req, res, next) => {
  try {
    const { id } = req.params;
    const holiday = await Holiday.findByIdAndDelete(id);

    if (!holiday) {
      return res.status(404).json({ error: 'Holiday not found' });
    }

    res.json({ success: true });
  } catch (error) {
    next(error);
  }
};
