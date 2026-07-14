/**
 * Regenerates docs/schads-rules-implemented.md from the rules catalog.
 * Usage: npm run docs:rules   (from backend/)
 *
 * The catalog (modules/rule-engine/rulesCatalog.js) is the single source of
 * truth; rulesCatalog.test.js fails when the committed doc drifts from it.
 */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { renderRulesDoc } from '../modules/rule-engine/renderRulesDoc.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const DOC_PATH = path.join(__dirname, '../../docs/schads-rules-implemented.md');

fs.writeFileSync(DOC_PATH, renderRulesDoc());
console.log(`Wrote ${DOC_PATH}`);
