/**
 * Find or create location "Melbourne" (code MELBOURNE) and load VIC recurring public holidays
 * from fixtures/holidays_recurring.json.
 *
 * Run: node backend/seeds/seed_melbourne_location_holidays.js
 */
import { readFileSync } from 'fs';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';
import { connectDB } from '../config/db.js';
import { Location } from '../modules/locations/location.model.js';
import { Holiday } from '../modules/holidays/holiday.model.js';
import { normaliseFixtureEntry } from '../modules/holidays/holidayFixture.util.js';

const __dirname = dirname(fileURLToPath(import.meta.url));

const run = async () => {
  await connectDB();

  let location =
    (await Location.findOne({ code: 'MELBOURNE' }).lean()) ||
    (await Location.findOne({ name: /^melbourne$/i }).lean());

  if (!location) {
    const created = await Location.create({
      name: 'Melbourne',
      code: 'MELBOURNE',
      timezone: 'Australia/Melbourne',
      pricingRegion: 'National',
      isActive: true,
    });
    location = created.toObject();
    console.log(`Created location: ${location.name} (${location._id})`);
  } else {
    console.log(`Using location: ${location.name} (${location._id})`);
  }

  const fixturePath = join(__dirname, '../fixtures/holidays_recurring.json');
  const fixtureData = JSON.parse(readFileSync(fixturePath, 'utf8'));
  const holidays = fixtureData['VIC'];
  if (!holidays?.length) {
    console.error('No VIC holidays in holidays_recurring.json');
    process.exit(1);
  }

  let created = 0;
  let skipped = 0;

  for (const raw of holidays) {
    const norm = normaliseFixtureEntry(raw);
    const q = norm.rule
      ? { location: location._id, rule: norm.rule }
      : { location: location._id, month: norm.month, day: norm.day, rule: null };
    const exists = await Holiday.findOne(q).lean();
    if (exists) {
      console.log(`  SKIP  ${norm.rule || `${norm.month}/${norm.day}`} — ${norm.name}`);
      skipped++;
      continue;
    }

    await Holiday.create({
      location: location._id,
      name: norm.name,
      rule: norm.rule || null,
      month: norm.rule ? null : norm.month,
      day: norm.rule ? null : norm.day,
      date: null,
    });
    console.log(`  ADD   ${norm.rule || `${norm.month}/${norm.day}`} — ${norm.name}`);
    created++;
  }

  console.log(`\nDone. Created: ${created}, Skipped (already present): ${skipped}`);
  console.log('Note: AFL Grand Final public holiday (date TBC) is not included — add manually when announced.');
  process.exit(0);
};

run().catch((err) => {
  console.error(err);
  process.exit(1);
});
