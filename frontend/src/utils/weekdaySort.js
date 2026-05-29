const WEEKDAY_ORDER = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday'];

export function weekdayIndex(day) {
  const i = WEEKDAY_ORDER.findIndex((d) => d.toLowerCase() === String(day || '').trim().toLowerCase());
  return i >= 0 ? i : WEEKDAY_ORDER.length;
}

/** Sort rows with a Day column Mon→Sun, then start time. */
export function sortByWeekdayThenTime(rows) {
  return [...(rows || [])].sort((a, b) => {
    const dayDiff = weekdayIndex(a.day) - weekdayIndex(b.day);
    if (dayDiff !== 0) return dayDiff;
    const timeA = a.startTime || (a.startDatetime ? String(a.startDatetime) : '');
    const timeB = b.startTime || (b.startDatetime ? String(b.startDatetime) : '');
    return String(timeA).localeCompare(String(timeB));
  });
}
