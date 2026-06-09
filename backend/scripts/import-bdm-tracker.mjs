#!/usr/bin/env node
/**
 * One-time import of BDM Master Tracker xlsx into MongoDB.
 * Usage: node scripts/import-bdm-tracker.mjs [path-to-xlsx]
 */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { connectDB, markMongoShutdown } from '../config/db.js';
import { importWorkbook } from '../modules/crm/crm.service.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const defaultPath = path.resolve(__dirname, '../../tmp/test/BDM Master Tracker.xlsx');
const filePath = process.argv[2] ? path.resolve(process.argv[2]) : defaultPath;

async function main() {
  if (!fs.existsSync(filePath)) {
    console.error(`File not found: ${filePath}`);
    process.exit(1);
  }

  await connectDB();
  const buffer = fs.readFileSync(filePath);
  const results = await importWorkbook(buffer);
  console.log('Import complete:', JSON.stringify(results, null, 2));
  markMongoShutdown();
  process.exit(0);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
