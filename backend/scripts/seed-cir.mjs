#!/usr/bin/env node
/**
 * Seed CIR records from the sample workbook.
 * Usage: node backend/scripts/seed-cir.mjs [path-to-xlsx]
 */
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { connectDB } from '../config/db.js';
import { importCirWorkbook } from '../modules/cir/cir.service.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const defaultPath = path.join(
  process.env.HOME || '',
  'Downloads',
  'Continious Improvement Register.xlsx'
);

const xlsxPath = process.argv[2] || defaultPath;

async function main() {
  if (!fs.existsSync(xlsxPath)) {
    console.error('File not found:', xlsxPath);
    process.exit(1);
  }
  await connectDB();
  const buffer = fs.readFileSync(xlsxPath);
  const results = await importCirWorkbook(buffer);
  console.log('CIR seed complete:', results);
  process.exit(0);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
