/**
 * @param {object} h — fixture row: { rule?, month?, day?, date?, name }
 * @returns {{ name: string, rule?: string, month?: number, day?: number }}
 */
export function normaliseFixtureEntry(h) {
  if (h.rule) {
    return { rule: h.rule, name: h.name };
  }
  if (h.month != null && h.day != null) {
    return { month: h.month, day: h.day, name: h.name };
  }
  if (h.date) {
    const p = h.date.split('-');
    if (p.length < 3) throw new Error('Invalid date in fixture');
    return { month: parseInt(p[1], 10), day: parseInt(p[2], 10), name: h.name };
  }
  throw new Error('Fixture entry must have rule, (month+day), or date');
}
