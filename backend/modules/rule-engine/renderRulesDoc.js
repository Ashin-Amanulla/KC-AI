import { RULES_CATALOG, RULE_CATEGORIES } from './rulesCatalog.js';

const STATUS_BADGES = {
  implemented: '',
  'needs-verification': ' ⚠️ *needs verification*',
  flagged: ' 🏳️ *flag only*',
  'not-implemented': ' 🚫 *not implemented*',
};

/** Render the rules catalog as the committed markdown doc. */
export function renderRulesDoc() {
  const lines = [];
  lines.push('# SCHADS Rules Implemented in Calculation');
  lines.push('');
  lines.push('<!-- GENERATED FILE — do not edit by hand. -->');
  lines.push('<!-- Source of truth: backend/modules/rule-engine/rulesCatalog.js -->');
  lines.push('<!-- Regenerate with: cd backend && npm run docs:rules -->');
  lines.push('');
  lines.push('Rule-by-rule inventory of SCHADS Award (MA000100) rules encoded in this codebase.  ');
  lines.push('**Sources:** `backend/modules/pay-hours/services/payHoursCalculator.js`, `backend/modules/shifts/shiftCsvParser.js`, `frontend/src/lib/schadsWageCalc.js`, `backend/modules/pay-hours/utils/ot76GlobalTier.js`.');
  lines.push('');
  lines.push('Legend: ⚠️ needs verification against the award/pay guide · 🏳️ engine flags only (no pay effect) · 🚫 known award rule not implemented.');

  for (const category of RULE_CATEGORIES) {
    const rules = RULES_CATALOG.filter((rule) => rule.category === category.slug);
    if (!rules.length) continue;
    lines.push('');
    lines.push('---');
    lines.push('');
    lines.push(`## ${category.title}`);
    lines.push('');
    for (const rule of rules) {
      const badge = STATUS_BADGES[rule.status] ?? '';
      const clause = rule.awardRef ? ` _(${rule.awardRef})_` : '';
      lines.push(`- **${rule.id}** — ${rule.description}${clause}${badge}`);
    }
  }

  lines.push('');
  lines.push('---');
  lines.push('');
  lines.push('*Generated from `rulesCatalog.js`. Verify ⚠️ items against [Fair Work SCHADS Award MA000100](https://www.fairwork.gov.au) and the current pay guide; indexed dollar amounts are served per financial year by the award-rates module.*');
  lines.push('');
  return lines.join('\n');
}
