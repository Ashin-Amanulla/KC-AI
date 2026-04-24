import { Holiday, HOLIDAY_RULES } from './holiday.model.js';
import { Location } from '../locations/location.model.js';
import { holidayToYmdUTC, ymdUTC } from './holidayRule.service.js';

const RULE_LABELS = {
  good_friday: 'Good Friday (Easter)',
  easter_saturday: 'Easter Saturday',
  easter_sunday: 'Easter Sunday',
  easter_monday: 'Easter Monday',
  first_monday_march: 'First Monday in March',
  first_monday_may: 'First Monday in May',
  first_monday_june: 'First Monday in June',
  first_monday_august: 'First Monday in August',
  first_monday_october: 'First Monday in October',
  second_monday_march: 'Second Monday in March',
  second_monday_june: "Second Monday in June (e.g. King's / Queen's)",
  first_tuesday_november: 'First Tuesday in November (Melbourne Cup)',
  second_wednesday_august: 'Second Wednesday in August (Qld RQS / Ekka, approximate by rule)',
  last_monday_september: "Last Monday in September (e.g. WA King's / Queen's)",
};

/**
 * @param {object} h
 * @param {number} [sampleYear]
 */
function enrichHolidayForClient(h, sampleYear) {
  const y = sampleYear && Number.isInteger(sampleYear) ? sampleYear : new Date().getUTCFullYear();
  let sampleYmd = null;
  if (h.date && h.month == null && !h.rule) {
    const d = new Date(h.date);
    sampleYmd = ymdUTC(d.getUTCFullYear(), d.getUTCMonth() + 1, d.getUTCDate());
  } else {
    sampleYmd = holidayToYmdUTC(h, y) || null;
  }
  return {
    ...h,
    displaySchedule: h.rule
      ? (RULE_LABELS[h.rule] || h.rule)
      : h.month && h.day
        ? `Annual — ${h.day} ${['', 'Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'][h.month]}`
        : h.date
          ? 'One-off (legacy date)'
          : '—',
    sampleYmd,
  };
}

export const listHolidays = async (req, res, next) => {
  try {
    const { locationId, sampleYear: sy } = req.query;
    const sampleYear = sy ? parseInt(sy, 10) : undefined;

    const filter = {};
    if (locationId) {
      if (!/^[a-f\d]{24}$/i.test(locationId)) {
        return res.status(400).json({ error: 'Invalid locationId' });
      }
      filter.location = locationId;
    }

    const holidays = await Holiday.find(filter)
      .populate('location', 'name code timezone')
      .sort({ name: 1 })
      .lean();

    const withMeta = holidays.map((h) => enrichHolidayForClient(h, sampleYear));
    res.json({ holidays: withMeta, ruleLabels: RULE_LABELS, rules: HOLIDAY_RULES });
  } catch (error) {
    next(error);
  }
};

async function findExistingDefinition(locationId, { rule, month, day } = {}) {
  if (rule) {
    return Holiday.findOne({ location: locationId, rule }).lean();
  }
  if (month != null && day != null) {
    return Holiday.findOne({ location: locationId, month, day, rule: null }).lean();
  }
  return null;
}

export const createHoliday = async (req, res, next) => {
  try {
    const { name, locationId, rule, month, day, date } = req.body;

    if (!name?.trim() || !locationId) {
      return res.status(400).json({ error: 'name and locationId are required' });
    }

    const hasRule = Boolean(rule);
    const hasMD = month != null && day != null;
    const hasDate = Boolean(date);
    if (!hasRule && !hasMD && !hasDate) {
      return res.status(400).json({
        error: 'Provide one of: rule, or (month and day), or date (one-off; stored as annual month/day)',
      });
    }
    if (hasRule && (hasMD || hasDate)) {
      return res.status(400).json({ error: 'Do not combine rule with month/day or date' });
    }
    if (hasMD && hasDate) {
      return res.status(400).json({ error: 'Use either (month, day) or date, not both' });
    }

    const location = await Location.findById(locationId).lean();
    if (!location) {
      return res.status(404).json({ error: 'Location not found' });
    }

    if (hasRule && !HOLIDAY_RULES.includes(rule)) {
      return res.status(400).json({ error: `Invalid rule. Allowed: ${HOLIDAY_RULES.join(', ')}` });
    }

    let monthNum = hasMD ? parseInt(String(month), 10) : null;
    let dayNum = hasMD ? parseInt(String(day), 10) : null;
    if (hasDate) {
      const d = new Date(date);
      monthNum = d.getUTCMonth() + 1;
      dayNum = d.getUTCDate();
    }

    const payload = {
      location: locationId,
      name: name.trim(),
      createdBy: req.user?.userId ?? null,
      rule: hasRule ? rule : null,
      month: hasRule ? null : monthNum,
      day: hasRule ? null : dayNum,
      date: null,
    };

    const existing = await findExistingDefinition(locationId, {
      rule: hasRule ? rule : null,
      month: !hasRule ? monthNum : null,
      day: !hasRule ? dayNum : null,
    });
    if (existing) {
      return res.status(409).json({ error: 'A holiday with the same rule or same calendar day already exists for this location' });
    }

    let holiday;
    try {
      holiday = await Holiday.create(payload);
    } catch (e) {
      if (e.code === 11000) {
        return res.status(409).json({ error: 'A holiday with the same rule or day already exists for this location' });
      }
      throw e;
    }

    res.status(201).json({ holiday: enrichHolidayForClient(holiday.toObject()) });
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
