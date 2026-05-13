const WIN_KEY = 'rosterCoverage.timesheetWindow';
const LEGACY_KEY = 'rosterCoverage.payPeriodAt';
const EVT = 'rosterCoveragePayPeriodChanged';

/**
 * @returns {{ start: string, end: string } | null} ISO bounds from last successful import (min/max shift times).
 */
export function getRosterTimesheetWindow() {
  try {
    const raw = sessionStorage.getItem(WIN_KEY);
    if (raw) {
      const o = JSON.parse(raw);
      if (o?.start && o?.end) return { start: String(o.start), end: String(o.end) };
    }
  } catch {
    /* ignore */
  }
  return null;
}

/** Persist full timesheet span; clears legacy single-instant key. Pass null to clear. */
export function setRosterTimesheetWindow(span) {
  try {
    if (span?.start && span?.end) {
      sessionStorage.setItem(WIN_KEY, JSON.stringify({ start: span.start, end: span.end }));
    } else {
      sessionStorage.removeItem(WIN_KEY);
    }
    sessionStorage.removeItem(LEGACY_KEY);
  } catch {
    /* ignore */
  }
  if (typeof window !== 'undefined') window.dispatchEvent(new Event(EVT));
}

export function subscribeRosterPayPeriod(cb) {
  if (typeof window === 'undefined') return () => {};
  window.addEventListener(EVT, cb);
  window.addEventListener('storage', cb);
  return () => {
    window.removeEventListener(EVT, cb);
    window.removeEventListener('storage', cb);
  };
}

/** Stable string for React Query + useSyncExternalStore */
export function getRosterPayPeriodSnapshot() {
  const w = getRosterTimesheetWindow();
  if (!w) return '';
  return JSON.stringify([w.start, w.end]);
}
