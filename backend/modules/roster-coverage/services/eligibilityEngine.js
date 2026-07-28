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

/** Portion of shift duration that falls inside [fortnight.startUtc, fortnight.endUtc). */
export function hoursOfShiftOverlappingFortnight(w, fortnight) {
  const ws = toMs(w.startDatetime ?? w.start);
  const we = toMs(w.endDatetime ?? w.end);
  if (!Number.isFinite(ws) || !Number.isFinite(we)) return 0;
  const a = Math.max(ws, fortnight.startUtc);
  const b = Math.min(we, fortnight.endUtc);
  return r2(Math.max(0, (b - a) / HOUR_MS));
}

/**
 * Hours, overlap, and rest rules only (no participant assignment check).
 * @param {object} vacant
 * @param {object} staff
 * @param {object[]} workedShiftsForStaff
 * @param {{ startUtc: number, endUtc: number }} fortnight
 */
export function evaluateStaffLogistics(vacant, staff, workedShiftsForStaff, fortnight) {
  const reasons = [];

  const vStart = toMs(vacant.startDatetime);
  const vEnd = toMs(vacant.endDatetime);
  const vacantDuration = r2((vEnd - vStart) / HOUR_MS);

  const nonCancelled = workedShiftsForStaff.filter((w) => w.shiftStatus !== 'cancelled');
  const workedHours = r2(
    nonCancelled.reduce((sum, w) => sum + hoursOfShiftOverlappingFortnight(w, fortnight), 0)
  );
  const cap = staff.contractedFortnightlyHours ?? 0;
  const remaining = r2(cap - workedHours);
  const headroomAfterShift = r2(remaining - vacantDuration);
  const capWouldExceed = headroomAfterShift < -1e-6;
  const hoursOverCapIfAssigned = capWouldExceed ? r2(Math.abs(headroomAfterShift)) : 0;

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

  return {
    staff,
    reasons,
    workedHours,
    remaining: r2(cap - workedHours),
    headroomAfterShift,
    capWouldExceed,
    hoursOverCapIfAssigned,
  };
}

/**
 * @param {object} vacant - { startDatetime, endDatetime, sleepover?, sleepoverStart? }
 * @param {object} staff
 * @param {object[]} workedShiftsForStaff
 * @param {{ startUtc: number, endUtc: number}} fortnight
 * @param {object} participant - { name, approvedStaffIds }
 */
export function evaluateStaffForVacant(vacant, staff, workedShiftsForStaff, fortnight, participant) {
  const logistics = evaluateStaffLogistics(vacant, staff, workedShiftsForStaff, fortnight);
  const reasons = [...logistics.reasons];

  const vid = String(staff._id ?? staff.id);
  const participantName = participant.name ?? 'participant';
  const approved = (participant.approvedStaffIds ?? []).map((x) => String(x));
  if (!approved.includes(vid)) {
    reasons.unshift(`Not assigned to support ${participantName}`);
  }

  return {
    staff,
    reasons,
    workedHours: logistics.workedHours,
    remaining: logistics.remaining,
    headroomAfterShift: logistics.headroomAfterShift,
    capWouldExceed: logistics.capWouldExceed,
    hoursOverCapIfAssigned: logistics.hoursOverCapIfAssigned,
    logisticsReasons: logistics.reasons,
  };
}

/**
 * @param {object} vacant
 * @param {object} participant
 * @param {object[]} allStaff
 * @param {Map<string, object[]>} shiftsByStaffId
 * @param {{ startUtc: number, endUtc: number }} fortnight
 */
function buildCoverRow(evalResult) {
  const { staff, reasons, workedHours, remaining, headroomAfterShift, capWouldExceed, hoursOverCapIfAssigned } =
    evalResult;
  return {
    staff,
    phone: staff.phone,
    workedHoursThisFortnight: workedHours,
    hoursRemaining: remaining,
    headroomAfterShift,
    capWouldExceed,
    hoursOverCapIfAssigned,
    reasons: [...reasons],
  };
}

export function findCover(vacant, participant, allStaff, shiftsByStaffId, fortnight) {
  const eligibleTeam = [];
  const capExceededTeam = [];
  const ineligibleTeam = [];
  const openPoolEligible = [];
  const openPoolCapExceeded = [];
  const approvedSet = new Set((participant.approvedStaffIds ?? []).map((x) => String(x)));

  for (const staff of allStaff) {
    const sid = String(staff._id ?? staff.id);
    const list = shiftsByStaffId.get(sid) ?? [];
    const evalResult = evaluateStaffForVacant(vacant, staff, list, fortnight, participant);
    const row = buildCoverRow(evalResult);
    const { reasons, logisticsReasons, capWouldExceed } = evalResult;

    const onTeam = approvedSet.has(sid);
    if (onTeam) {
      if (reasons.length === 0) {
        if (capWouldExceed) capExceededTeam.push(row);
        else eligibleTeam.push(row);
      } else {
        ineligibleTeam.push(row);
      }
    } else if (logisticsReasons.length === 0) {
      const openRow = { ...row, reasons: [] };
      if (capWouldExceed) openPoolCapExceeded.push(openRow);
      else openPoolEligible.push(openRow);
    }
  }

  const sortWithinCap = (a, b) => b.headroomAfterShift - a.headroomAfterShift;
  const sortOverCap = (a, b) => a.hoursOverCapIfAssigned - b.hoursOverCapIfAssigned;

  eligibleTeam.sort(sortWithinCap);
  openPoolEligible.sort(sortWithinCap);
  capExceededTeam.sort(sortOverCap);
  openPoolCapExceeded.sort(sortOverCap);

  return { eligibleTeam, capExceededTeam, ineligibleTeam, openPoolEligible, openPoolCapExceeded };
}
