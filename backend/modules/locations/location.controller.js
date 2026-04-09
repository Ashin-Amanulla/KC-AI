import { readFileSync } from 'fs';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';
import { Location } from './location.model.js';
import { Holiday } from '../holidays/holiday.model.js';

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
 * Load holiday fixture for a location + year.
 * Mirrors: python manage.py load_holidays --location BRISBANE --year 2026
 *
 * POST /api/locations/:id/load-holidays
 * Body: { year: 2026 }
 *
 * Upsert strategy: skips dates that already exist, creates the rest.
 */
export const loadHolidayFixture = async (req, res, next) => {
  try {
    const { id } = req.params;
    const year = parseInt(req.body.year ?? new Date().getFullYear(), 10);

    const location = await Location.findById(id).lean();
    if (!location) return res.status(404).json({ error: 'Location not found' });

    // Load fixture file
    const fixturePath = join(__dirname, '../../fixtures', `holidays_${year}.json`);
    let fixtureData;
    try {
      fixtureData = JSON.parse(readFileSync(fixturePath, 'utf8'));
    } catch {
      return res.status(404).json({ error: `No holiday fixture for year ${year}` });
    }

    // Fixture is keyed by state code — try to match by location code
    // e.g. code="BRISBANE" → try "QLD", then "BRISBANE", then fall back to flat array
    let holidays;
    if (Array.isArray(fixtureData)) {
      holidays = fixtureData;
    } else {
      // Map known city codes → state keys
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
      return res.status(404).json({ error: `No holidays found in fixture for location code "${location.code}" (year ${year})` });
    }

    let created = 0;
    let skipped = 0;
    const errors = [];

    for (const h of holidays) {
      const normalizedDate = new Date(h.date);
      normalizedDate.setUTCHours(0, 0, 0, 0);

      try {
        const exists = await Holiday.findOne({ location: id, date: normalizedDate }).lean();
        if (exists) {
          skipped++;
          continue;
        }
        await Holiday.create({
          location: id,
          date: normalizedDate,
          name: h.name,
          createdBy: req.user?.userId ?? null,
        });
        created++;
      } catch (err) {
        errors.push(`${h.date}: ${err.message}`);
      }
    }

    res.json({ year, created, skipped, errors });
  } catch (error) {
    next(error);
  }
};
