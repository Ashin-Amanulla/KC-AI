#!/usr/bin/env node
/**
 * Fix staff rate normName (first + last) and add aliases from pay hours / shifts spellings.
 *
 *   node scripts/sync-staff-rate-aliases.mjs           # dry run
 *   node scripts/sync-staff-rate-aliases.mjs --apply   # write to MongoDB
 */
import mongoose from 'mongoose';
import { config } from '../config/index.js';
import { normStaffNameForMatch, nameMatchKeys } from '../utils/staffNameNorm.js';

const APPLY = process.argv.includes('--apply');

function mergeAliases(existing, staffName, oldNorm, externalNames) {
  const canonical = normStaffNameForMatch(staffName);
  const keys = new Set();
  for (const a of existing || []) {
    if (!a) continue;
    for (const k of nameMatchKeys(a)) {
      if (k && k !== canonical) keys.add(k);
    }
  }
  if (oldNorm && oldNorm !== canonical) keys.add(oldNorm);
  for (const k of nameMatchKeys(staffName)) {
    if (k && k !== canonical) keys.add(k);
  }
  for (const ext of externalNames) {
    for (const k of nameMatchKeys(ext)) {
      if (k && k !== canonical) keys.add(k);
    }
  }
  return [...keys].sort();
}

async function main() {
  await mongoose.connect(config.mongodb.uri);
  const db = mongoose.connection.db;
  const rates = await db.collection('staffschadsrates').find({}).toArray();
  const payNames = await db.collection('payhours').distinct('staffName');
  const shiftNames = await db.collection('shifts').distinct('staffName');
  const externalNames = [...new Set([...payNames, ...shiftNames].filter(Boolean))];

  const byCanonical = new Map();
  for (const r of rates) {
    const canonical = normStaffNameForMatch(r.staffName);
    if (!canonical) continue;
    if (!byCanonical.has(canonical)) byCanonical.set(canonical, []);
    byCanonical.get(canonical).push(r);
  }

  const namesForCanonical = new Map();
  for (const n of externalNames) {
    const c = normStaffNameForMatch(n);
    if (!c) continue;
    if (!namesForCanonical.has(c)) namesForCanonical.set(c, new Set());
    namesForCanonical.get(c).add(n);
  }

  const manualAliases = [{ canonical: 'kangaroocare 1', add: ['kangaroocare'] }];

  let updateCount = 0;
  const ops = [];

  for (const r of rates) {
    const canonical = normStaffNameForMatch(r.staffName);
    if (!canonical) continue;
    const ext = namesForCanonical.get(canonical) || new Set();
    const aliases = mergeAliases(r.aliases, r.staffName, r.normName, ext);
    for (const m of manualAliases) {
      if (m.canonical === canonical) {
        for (const a of m.add) {
          for (const k of nameMatchKeys(a)) {
            if (k && k !== canonical) aliases.push(k);
          }
        }
      }
    }
    const uniqueAliases = [...new Set(aliases)].sort();
    const changed =
      r.normName !== canonical ||
      JSON.stringify([...(r.aliases || [])].sort()) !== JSON.stringify(uniqueAliases);

    if (!changed) continue;
    updateCount++;
    console.log(
      `${r.staffName}\n  norm: ${r.normName} -> ${canonical}\n  aliases: ${(r.aliases || []).join(', ') || '(none)'} -> ${uniqueAliases.join(', ') || '(none)'}`,
    );
    if (APPLY) {
      ops.push({
        updateOne: {
          filter: { _id: r._id },
          update: { $set: { normName: canonical, aliases: uniqueAliases } },
        },
      });
    }
  }

  const unmatched = externalNames.filter((n) => {
    const c = normStaffNameForMatch(n);
    return c && !byCanonical.has(c);
  });
  console.log(`\n${updateCount} staff rate row(s) to update.`);
  console.log(`${unmatched.length} pay/shift name(s) with no staff rate row (add rates first):`);
  unmatched.slice(0, 50).forEach((n) => console.log(`  - ${n}`));
  if (unmatched.length > 50) console.log(`  ... and ${unmatched.length - 50} more`);

  if (APPLY && ops.length) {
    const result = await db.collection('staffschadsrates').bulkWrite(ops);
    console.log(`\nApplied: modified ${result.modifiedCount}`);
  } else if (!APPLY && updateCount) {
    console.log('\nDry run — pass --apply to write changes.');
  }

  await mongoose.disconnect();
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
