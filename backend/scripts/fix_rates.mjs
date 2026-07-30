import { config } from '../config/index.js';
import mongoose from 'mongoose';

// CASUAL LOADING RATES — correct inclusive formula
// daytime already includes 25% casual loading
// Correct penalty rate = daytime × (mult + 0.25) / 1.25
const RATIOS = {
  afternoon: (1.125 + 0.25) / 1.25,  // 1.1
  night: (1.15 + 0.25) / 1.25,       // 1.12
  otUpto2: (1.5 + 0.25) / 1.25,      // 1.4
  otAfter2: (2.0 + 0.25) / 1.25,     // 1.8
  saturday: (1.5 + 0.25) / 1.25,     // 1.4
  satOtAfter2: (2.0 + 0.25) / 1.25,  // 1.8
  sunday: (2.0 + 0.25) / 1.25,       // 1.8
  ph: (2.5 + 0.25) / 1.25,           // 2.2
};

function r2(v) { return Math.round(v * 100) / 100; }

const uri = config.mongodb.uri;
console.log('Connecting...');

try {
  await mongoose.connect(uri);
  console.log('Connected to MongoDB');

  const colls = await mongoose.connection.db.listCollections().toArray();
  console.log('Collections:', colls.map(c => c.name).join(', '));
  const coll = mongoose.connection.collection('staffschadsrates');
  const brisbaneLoc = new mongoose.Types.ObjectId('69eaaa638d3940d9bae7fcdd');
  const melbLoc = new mongoose.Types.ObjectId('69eb5a6267c6fe27406964f4');
  const allRates = await coll.find({ locationId: brisbaneLoc }).toArray();
  console.log(`Found ${allRates.length} Brisbane rate cards`);

  let fixed = 0;
  for (const doc of allRates) {
    const rates = doc.rates || {};
    const day = parseFloat(rates.daytime);
    if (!day || day <= 0) {
      console.log(`  SKIP ${doc.staffName}: no daytime rate`);
      continue;
    }

    const updates = {};
    let changed = false;

    for (const [key, ratio] of Object.entries(RATIOS)) {
      const correct = r2(day * ratio);
      const current = parseFloat(rates[key]);
      if (current !== correct) {
        updates[`rates.${key}`] = correct;
        changed = true;
        console.log(`  ${doc.staffName}: ${key} ${current} → ${correct}`);
      }
    }

    if (changed) {
      await coll.updateOne({ _id: doc._id }, { $set: updates });
      fixed++;
    }
  }

  console.log(`\nFixed ${fixed}/${allRates.length} rate cards`);
  
  // Also fix Melbourne
  const melbLoc = '69eb5a6267c6fe27406964f4';
  const melbRates = await coll.find({ locationId: melbLoc }).toArray();
  console.log(`Found ${melbRates.length} Melbourne rate cards`);
  
  let melbFixed = 0;
  for (const doc of melbRates) {
    const rates = doc.rates || {};
    const day = parseFloat(rates.daytime);
    if (!day || day <= 0) continue;

    const updates = {};
    let changed = false;

    for (const [key, ratio] of Object.entries(RATIOS)) {
      const correct = r2(day * ratio);
      const current = parseFloat(rates[key]);
      if (current !== correct) {
        updates[`rates.${key}`] = correct;
        changed = true;
        console.log(`  [MELB] ${doc.staffName}: ${key} ${current} → ${correct}`);
      }
    }

    if (changed) {
      await coll.updateOne({ _id: doc._id }, { $set: updates });
      melbFixed++;
    }
  }
  
  console.log(`\nFixed ${melbFixed}/${melbRates.length} Melbourne rate cards`);

  await mongoose.disconnect();
  console.log('Done');
} catch (err) {
  console.error('ERROR:', err.message);
  process.exit(1);
}
