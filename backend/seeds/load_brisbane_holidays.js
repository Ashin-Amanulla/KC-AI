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

  const location = await Location.findOne({ code: 'BRISBANE' }).lean();
  if (!location) {
    console.error('Brisbane location not found. Create it first.');
    process.exit(1);
  }
  console.log(`Found location: ${location.name} (${location._id})`);

  const fixturePath = join(__dirname, '../fixtures/holidays_recurring.json');
  const fixtureData = JSON.parse(readFileSync(fixturePath, 'utf8'));
  const holidays = fixtureData['QLD'];

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

  console.log(`\nDone. Created: ${created}, Skipped: ${skipped}`);
  process.exit(0);
};

run().catch(err => { console.error(err); process.exit(1); });
