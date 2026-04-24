/**
 * One-time: convert Holiday documents that only have legacy `date` into month+day (fixed),
 * and unset `date`. Rows that were loaded once per calendar year duplicate the same annual
 * observance (e.g. two "New Year's Day" with different years) — only one row per
 * (location, month, day) is kept; extra legacy copies are deleted.
 *
 *   node backend/seeds/migrate_holidays_legacy_date_to_recurring.js
 */
import { connectDB } from '../config/db.js';
import { Holiday } from '../modules/holidays/holiday.model.js';

const run = async () => {
  await connectDB();
  const rows = await Holiday.find({ date: { $ne: null }, month: null, rule: null }).lean();
  let migrated = 0;
  let removed = 0;
  for (const h of rows) {
    const d = new Date(h.date);
    const month = d.getUTCMonth() + 1;
    const day = d.getUTCDate();

    const keeper = await Holiday.findOne({
      location: h.location,
      month,
      day,
      rule: null,
      _id: { $ne: h._id },
    }).lean();

    if (keeper) {
      await Holiday.deleteOne({ _id: h._id });
      removed++;
      console.log(
        `Removed duplicate legacy ${h._id} (${month}/${day} — ${h.name}); already have ${keeper._id}`
      );
      continue;
    }

    await Holiday.updateOne(
      { _id: h._id },
      {
        $set: { month, day },
        $unset: { date: '' },
      }
    );
    migrated++;
    console.log(`Migrated ${h._id} → ${month}/${day} — ${h.name}`);
  }
  console.log(`Done. Migrated ${migrated}, removed duplicate legacy rows ${removed}.`);
  process.exit(0);
};

run().catch((e) => {
  console.error(e);
  process.exit(1);
});
