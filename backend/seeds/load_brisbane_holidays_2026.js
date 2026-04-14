import { readFileSync } from 'fs';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';
import { connectDB } from '../config/db.js';
import { Location } from '../modules/locations/location.model.js';
import { Holiday } from '../modules/holidays/holiday.model.js';

const __dirname = dirname(fileURLToPath(import.meta.url));

const run = async () => {
  await connectDB();

  const location = await Location.findOne({ code: 'BRISBANE' }).lean();
  if (!location) {
    console.error('Brisbane location not found. Create it first.');
    process.exit(1);
  }
  console.log(`Found location: ${location.name} (${location._id})`);

  const fixturePath = join(__dirname, '../fixtures/holidays_2026.json');
  const fixtureData = JSON.parse(readFileSync(fixturePath, 'utf8'));
  const holidays = fixtureData['QLD'];

  let created = 0;
  let skipped = 0;

  for (const h of holidays) {
    const normalizedDate = new Date(h.date);
    normalizedDate.setUTCHours(0, 0, 0, 0);

    const exists = await Holiday.findOne({ location: location._id, date: normalizedDate }).lean();
    if (exists) {
      console.log(`  SKIP  ${h.date} — ${h.name}`);
      skipped++;
      continue;
    }

    await Holiday.create({ location: location._id, date: normalizedDate, name: h.name });
    console.log(`  ADD   ${h.date} — ${h.name}`);
    created++;
  }

  console.log(`\nDone. Created: ${created}, Skipped: ${skipped}`);
  process.exit(0);
};

run().catch(err => { console.error(err); process.exit(1); });
