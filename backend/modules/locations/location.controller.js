import { readFileSync } from 'fs';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';
import { Location } from './location.model.js';
import { Holiday } from '../holidays/holiday.model.js';
import { normaliseFixtureEntry } from '../holidays/holidayFixture.util.js';

const __dirname = dirname(fileURLToPath(import.meta.url));

export const listLocations = async (req, res, next) => {
  try {
    const locations = await Location.find({ isActive: true }).sort({ name: 1 }).lean();
    res.json({ locations });
  } catch (error) {
    next(error);
  }
};

export const createLocation = async (req, res, next) => {
  try {
    const { name, code, timezone, pricingRegion } = req.body;

    if (!name || !code) {
      return res.status(400).json({ error: 'name and code are required' });
    }

    const location = await Location.create({
      name: name.trim(),
      code: code.trim().toUpperCase(),
      timezone: timezone || 'Australia/Brisbane',
      pricingRegion: pricingRegion || 'National',
      createdBy: req.user?.userId ?? null,
    });

    res.status(201).json({ location });
  } catch (error) {
    if (error.code === 11000) {
      return res.status(409).json({ error: 'A location with that name or code already exists' });
    }
    next(error);
  }
};

export const deleteLocation = async (req, res, next) => {
  try {
    const { id } = req.params;
    const location = await Location.findByIdAndDelete(id);
    if (!location) return res.status(404).json({ error: 'Location not found' });
    res.json({ success: true });
  } catch (error) {
    next(error);
  }
};

/**
 * Load year-independent holiday definitions from fixtures/holidays_recurring.json
 * (optional legacy per-year file holidays_YYYY.json still supported: dates become month+day only).
 *
 * POST /api/locations/:id/load-holidays
 * Body: { file?: "holidays_recurring" } — defaults to holidays_recurring.json
 */
export const loadHolidayFixture = async (req, res, next) => {
  try {
    const { id } = req.params;
    const fileBase = (req.body.file && String(req.body.file).replace(/\.json$/, '')) || 'holidays_recurring';

    const location = await Location.findById(id).lean();
    if (!location) return res.status(404).json({ error: 'Location not found' });

    const fixturePath = join(__dirname, '../../fixtures', `${fileBase}.json`);
    let fixtureData;
    try {
      fixtureData = JSON.parse(readFileSync(fixturePath, 'utf8'));
    } catch {
      return res.status(404).json({ error: `No holiday fixture file: ${fileBase}.json` });
    }

    let holidays;
    if (Array.isArray(fixtureData)) {
      holidays = fixtureData;
    } else {
      const CODE_TO_STATE = {
        BRISBANE: 'QLD', GOLD_COAST: 'QLD', SUNSHINE_COAST: 'QLD', TOWNSVILLE: 'QLD',
        SYDNEY: 'NSW', NEWCASTLE: 'NSW', WOLLONGONG: 'NSW',
        MELBOURNE: 'VIC', GEELONG: 'VIC',
        PERTH: 'WA',
        ADELAIDE: 'SA',
        DARWIN: 'NT',
        HOBART: 'TAS',
        CANBERRA: 'ACT',
      };
      const stateKey = CODE_TO_STATE[location.code] ?? location.code;
      holidays = fixtureData[stateKey] ?? fixtureData[location.code] ?? [];
    }

    if (!holidays.length) {
      return res.status(404).json({ error: `No holidays found in fixture for location code "${location.code}"` });
    }

    let created = 0;
    let skipped = 0;
    const errors = [];

    for (const raw of holidays) {
      let norm;
      try {
        norm = normaliseFixtureEntry(raw);
      } catch (e) {
        errors.push(String(e.message));
        continue;
      }

      try {
        const q = norm.rule
          ? { location: id, rule: norm.rule }
          : { location: id, month: norm.month, day: norm.day, rule: null };
        const exists = await Holiday.findOne(q).lean();
        if (exists) {
          skipped++;
          continue;
        }
        await Holiday.create({
          location: id,
          name: norm.name,
          rule: norm.rule || null,
          month: norm.rule ? null : norm.month,
          day: norm.rule ? null : norm.day,
          date: null,
          createdBy: req.user?.userId ?? null,
        });
        created++;
      } catch (err) {
        errors.push(`${raw.name || raw.date || '?'}: ${err.message}`);
      }
    }

    res.json({ file: fileBase, created, skipped, errors });
  } catch (error) {
    next(error);
  }
};
