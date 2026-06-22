const MS_PER_DAY = 86400000;

export function startOfDay(d) {
  const x = new Date(d);
  x.setHours(0, 0, 0, 0);
  return x;
}

/** Days since initial contact (date received), inclusive of day 0. */
export function computeDaysStale(lead) {
  const anchor = lead?.dateReceived;
  if (!anchor) return null;
  const start = startOfDay(anchor);
  const today = startOfDay(new Date());
  const diff = Math.floor((today.getTime() - start.getTime()) / MS_PER_DAY);
  return Math.max(0, diff);
}

export function enrichLead(doc) {
  if (!doc) return doc;
  return { ...doc, daysStale: computeDaysStale(doc) };
}

export function enrichLeads(docs) {
  return docs.map(enrichLead);
}

export function stripLeadComputedFields(data) {
  if (!data || typeof data !== 'object') return data;
  const { daysStale, ...rest } = data;
  return rest;
}
