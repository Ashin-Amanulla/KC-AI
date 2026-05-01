/**
 * Pure eligibility engine: five rules + sleepover-aware rest gaps.
 * All shifts are plain objects with Date or ISO-string times.
 */

const HOUR_MS = 3600000;

export function r2(n) {
  return Math.round(n * 100) / 100;
}

export function toMs(t) {
  return t instanceof Date ? t.getTime() : new Date(t).getTime();
}

/** Sleepover at end of block (typical PC + sleepover). */
export function shiftEndsWithSleepover(s) {
  return !!s.sleepover;
}

/** Sleepover segment begins near shift start (first ~4h). */
export function shiftStartsWithSleepover(s) {
  if (!s.sleepover || !s.sleepoverStart) return false;
  const start = toMs(s.startDatetime ?? s.start);
  const ss = toMs(s.sleepoverStart);
  return ss - start >= 0 && ss - start <= 4 * HOUR_MS;
}

/**
 * Minimum rest hours between end of previous shift and start of next shift.
 */
export function minRestHoursBetween(prevShift, nextShift) {
  const prevEnd = shiftEndsWithSleepover(prevShift);
  const nextStart = shiftStartsWithSleepover(nextShift);
  return prevEnd || nextStart ? 8 : 10;
}

export function shiftDurationHours(s) {
  const a = toMs(s.startDatetime ?? s.start);
  const b = toMs(s.endDatetime ?? s.end);
  return r2(Math.max(0, (b - a) / HOUR_MS));
}

function overlaps(aStart, aEnd, bStart, bEnd) {
  return aStart < bEnd && aEnd > bStart;
}

/**
 * @param {object} vacant - { startDatetime, endDatetime, sleepover?, sleepoverStart? }
 * @param {object} participant - { _id, name, approvedStaffIds }
 * @param {object[]} staffList - roster staff docs
 * @param {object[]} workedShifts - all worked shifts for period (filtered per staff in caller)
 * @param {{ startUtc: number, endUtc: number }} fortnight - for hours worked sum
 * @param {object} participant - { name, approvedStaffIds }
 */
export function evaluateStaffForVacant(vacant, staff, workedShiftsForStaff, fortnight, participant) {
  const reasons = [];
  const vid = String(staff._id ?? staff.id);
  const participantName = participant.name ?? 'participant';

  const approved = (participant.approvedStaffIds ?? []).map((x) => String(x));
  if (!approved.includes(vid)) {
    reasons.push(`Not assigned to support ${participantName}`);
  }

  const vStart = toMs(vacant.startDatetime);
  const vEnd = toMs(vacant.endDatetime);
  const vacantDuration = r2((vEnd - vStart) / HOUR_MS);

  const nonCancelled = workedShiftsForStaff.filter((w) => w.shiftStatus !== 'cancelled');
  const inFortnight = nonCancelled.filter((w) => {
    const ws = toMs(w.startDatetime);
    return ws >= fortnight.startUtc && ws < fortnight.endUtc;
  });
  const workedHours = r2(inFortnight.reduce((sum, w) => sum + shiftDurationHours(w), 0));
  const cap = staff.contractedFortnightlyHours ?? 0;
  const remaining = r2(cap - workedHours);
  if (remaining < vacantDuration - 1e-6) {
    reasons.push(
      `Only ${remaining.toFixed(1)} hours remaining this fortnight — shift requires ${vacantDuration.toFixed(1)} hours`
    );
  }

  const blocking = nonCancelled.filter((w) => overlaps(vStart, vEnd, toMs(w.startDatetime), toMs(w.endDatetime)));
  if (blocking.length) {
    const w = blocking[0];
    const fmt = (ms) => new Date(ms).toISOString().slice(11, 16);
    reasons.push(
      `Already rostered ${fmt(toMs(w.startDatetime))} to ${fmt(toMs(w.endDatetime))} on this date — shift overlap`
    );
  }

  const endedBeforeVacant = nonCancelled.filter((w) => toMs(w.endDatetime) <= vStart);
  const prev = endedBeforeVacant.length
    ? endedBeforeVacant.reduce((best, w) => (toMs(w.endDatetime) > toMs(best.endDatetime) ? w : best))
    : null;
  if (prev) {
    const gapH = (vStart - toMs(prev.endDatetime)) / HOUR_MS;
    const need = minRestHoursBetween(prev, vacant);
    if (gapH < need - 1e-6) {
      const fmt = (ms) => new Date(ms).toISOString().slice(11, 16);
      reasons.push(
        `Finishes a shift at ${fmt(toMs(prev.endDatetime))} — only ${r2(gapH)} hours before this shift starts. Minimum required: ${need} hours`
      );
    }
  }

  const startsAfterVacant = nonCancelled.filter((w) => toMs(w.startDatetime) >= vEnd);
  const next = startsAfterVacant.length
    ? startsAfterVacant.reduce((best, w) => (toMs(w.startDatetime) < toMs(best.startDatetime) ? w : best))
    : null;
  if (next) {
    const gapH = (toMs(next.startDatetime) - vEnd) / HOUR_MS;
    const need = minRestHoursBetween(vacant, next);
    if (gapH < need - 1e-6) {
      const fmt = (ms) => new Date(ms).toISOString().slice(11, 16);
      reasons.push(
        `Next rostered shift at ${fmt(toMs(next.startDatetime))} — only ${r2(gapH)} hours rest after this shift ends. Minimum required: ${need} hours`
      );
    }
  }

  return { staff, reasons, workedHours, remaining: r2(cap - workedHours) };
}

/**
 * @param {object} vacant
 * @param {object} participant
 * @param {object[]} allStaff
 * @param {Map<string, object[]>} shiftsByStaffId
 * @param {{ startUtc: number, endUtc: number }} fortnight
 */
export function findCover(vacant, participant, allStaff, shiftsByStaffId, fortnight) {
  const eligible = [];
  const ineligible = [];

  for (const staff of allStaff) {
    const sid = String(staff._id ?? staff.id);
    const list = shiftsByStaffId.get(sid) ?? [];
    const { reasons, workedHours, remaining } = evaluateStaffForVacant(
      vacant,
      staff,
      list,
      fortnight,
      participant
    );
    const row = {
      staff,
      phone: staff.phone,
      workedHoursThisFortnight: workedHours,
      hoursRemaining: Math.max(0, remaining),
      reasons: [...reasons],
    };
    if (reasons.length === 0) eligible.push(row);
    else ineligible.push(row);
  }

  eligible.sort((a, b) => b.hoursRemaining - a.hoursRemaining);

  return { eligible, ineligible };
}
