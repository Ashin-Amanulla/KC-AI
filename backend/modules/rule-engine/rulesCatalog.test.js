import assert from 'node:assert';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import test from 'node:test';
import { RULES_CATALOG, RULE_CATEGORIES, getRulesByCategory } from './rulesCatalog.js';
import { renderRulesDoc } from './renderRulesDoc.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const DOC_PATH = path.join(__dirname, '../../../docs/schads-rules-implemented.md');

test('rules catalog: ids are unique, sequential R001..R198 and categories valid', () => {
  const ids = RULES_CATALOG.map((rule) => rule.id);
  assert.strictEqual(new Set(ids).size, ids.length, 'duplicate rule ids');
  assert.strictEqual(ids[0], 'R001');
  assert.strictEqual(ids[ids.length - 1], 'R198');
  assert.strictEqual(ids.length, 198);

  const validCategories = new Set(RULE_CATEGORIES.map((c) => c.slug));
  const validStatuses = new Set(['implemented', 'needs-verification', 'flagged', 'not-implemented']);
  for (const rule of RULES_CATALOG) {
    assert.ok(validCategories.has(rule.category), `${rule.id}: unknown category ${rule.category}`);
    assert.ok(validStatuses.has(rule.status), `${rule.id}: unknown status ${rule.status}`);
    assert.ok(rule.title && rule.description, `${rule.id}: missing title/description`);
  }
});

test('rules catalog: every category has at least one rule', () => {
  for (const group of getRulesByCategory()) {
    assert.ok(group.rules.length > 0, `category ${group.slug} has no rules`);
  }
});

test('[R055] catalog reflects split-loading (post-sleepover PC NOT forced to night band)', () => {
  const r055 = RULES_CATALOG.find((rule) => rule.id === 'R055');
  assert.match(r055.description, /NOT.*forced/i, 'R055 must state the band is not forced (code wins over old doc)');
});

test('docs/schads-rules-implemented.md matches the rules catalog (run `npm run docs:rules` after editing the catalog)', () => {
  const committed = fs.readFileSync(DOC_PATH, 'utf8');
  assert.strictEqual(
    committed,
    renderRulesDoc(),
    'docs/schads-rules-implemented.md has drifted from rulesCatalog.js — regenerate with `cd backend && npm run docs:rules`'
  );
});
