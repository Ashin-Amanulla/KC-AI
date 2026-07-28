import fs from 'fs';
import mongoose from 'mongoose';
import * as XLSX from 'xlsx';
import { config } from '../../config/index.js';
import { Location } from '../locations/location.model.js';
import { RosterStaff } from './rosterStaff.model.js';
import { RosterParticipant } from './rosterParticipant.model.js';
import { RosterWorkedShift } from './rosterWorkedShift.model.js';
import { RosterVacantShift } from './rosterVacantShift.model.js';
import { RosterCoverageAudit } from './rosterCoverageAudit.model.js';
import { RosterContactStatus } from './rosterContactStatus.model.js';
import { Shift } from '../shifts/shift.model.js';
import { findCover, hoursOfShiftOverlappingFortnight, r2, toMs } from './services/eligibilityEngine.js';
import {
  getFortnightContaining,
  startOfLocalDayUtc,
  formatLocalDate,
} from './services/fortnight.js';
import { buildSummaryPdf } from '../forecast-actuals/summaryPdf.js';
import { parseShiftCsvBuffer } from '../shifts/shiftCsvParser.js';
import { parseVacantShiftBuffer } from './vacantShiftImport.js';
import { nameMatchKeys, normStaffNameForMatch } from '../../utils/staffNameNorm.js';

const MS_PER_DAY = 86400000;
const PAD_MS = 10 * 24 * 3600000;

/** ISO / date string → UTC ms, or null if invalid */
function parsePayPeriodInstantMs(raw) {
  if (raw == null || raw === '') return null;
  const t = new Date(String(raw).trim()).getTime();
  return Number.isFinite(t) ? t : null;
}

/** @returns {{ startUtc: number, endUtc: number } | null} */
function parseTimesheetWindowParams(obj) {
  if (!obj) return null;
  const a = parsePayPeriodInstantMs(obj.timesheetFrom);
  const b = parsePayPeriodInstantMs(obj.timesheetTo);
  if (a == null || b == null || !(a < b)) return null;
  return { startUtc: a, endUtc: b };
}

function rosterShiftStatusFromWorkforceShift(shift) {
  if (shift?.absent) return 'cancelled';
  const status = String(shift?.shiftStatus || '').toLowerCase();
  if (status.includes('cancel')) return 'cancelled';
  if (status.includes('active')) return 'active';
  return 'completed';
}

function buildWorkforceShiftsByStaffId(allStaff, workforceShifts) {
  const out = new Map();
  for (const s of allStaff) out.set(String(s._id), []);

  /** @type {Map<string, string>} ShiftCare staff id → roster staff id (first roster wins) */
  const rosterIdByShiftcareStaffId = new Map();
  /** @type {Map<string, string[]>} */
  const staffIdsByNormName = new Map();
  /** @type {Set<string>} */
  const ambiguousNorms = new Set();

  for (const s of allStaff) {
    const sid = String(s._id);
    const sc = s.shiftcareStaffId != null ? String(s.shiftcareStaffId).trim() : '';
    if (sc && !rosterIdByShiftcareStaffId.has(sc)) rosterIdByShiftcareStaffId.set(sc, sid);

    for (const key of nameMatchKeys(s.fullName)) {
      if (!staffIdsByNormName.has(key)) staffIdsByNormName.set(key, []);
      staffIdsByNormName.get(key).push(sid);
    }
  }

  for (const [key, arr] of staffIdsByNormName) {
    const uniq = [...new Set(arr)];
    if (uniq.length > 1) ambiguousNorms.add(key);
  }

  function matchedRosterStaffIdsForWorkforceShift(ws) {
    const scRaw = ws.shiftcareStaffId != null ? String(ws.shiftcareStaffId).trim() : '';
    if (scRaw) {
      const byId = rosterIdByShiftcareStaffId.get(scRaw);
      if (byId) return [byId];
    }

    const ids = new Set();
    for (const key of nameMatchKeys(ws.staffName)) {
      if (ambiguousNorms.has(key)) continue;
      const arr = staffIdsByNormName.get(key);
      if (arr?.length === 1) ids.add(arr[0]);
    }
    return [...ids];
  }

  for (const ws of workforceShifts) {
    const matchedStaffIds = matchedRosterStaffIdsForWorkforceShift(ws);
    if (!matchedStaffIds.length) continue;

    const mapped = {
      startDatetime: ws.startDatetime,
      endDatetime: ws.endDatetime,
      sleepover: ws.shiftType === 'sleepover',
      sleepoverStart: null,
      shiftStatus: rosterShiftStatusFromWorkforceShift(ws),
    };

    for (const sid of matchedStaffIds) {
      if (!out.has(sid)) out.set(sid, []);
      out.get(sid).push(mapped);
    }
  }

  return out;
}

/** Minute-rounded key so sub-second DB differences still dedupe. */
function workedShiftTimeKey(s) {
  const startMin = Math.round(toMs(s.startDatetime) / 60000);
  const endMin = Math.round(toMs(s.endDatetime) / 60000);
  return `${startMin}_${endMin}`;
}

/** True when two shifts are the same worked block (exact or near-identical times). */
function workedShiftsDuplicate(a, b) {
  if (workedShiftTimeKey(a) === workedShiftTimeKey(b)) return true;
  const aStart = toMs(a.startDatetime);
  const aEnd = toMs(a.endDatetime);
  const bStart = toMs(b.startDatetime);
  const bEnd = toMs(b.endDatetime);
  const overlapStart = Math.max(aStart, bStart);
  const overlapEnd = Math.min(aEnd, bEnd);
  if (overlapEnd <= overlapStart) return false;
  const overlapH = (overlapEnd - overlapStart) / 3600000;
  const aH = (aEnd - aStart) / 3600000;
  const bH = (bEnd - bStart) / 3600000;
  const shorter = Math.min(aH, bH);
  return shorter > 0 && overlapH >= shorter * 0.9;
}

/** Collapse duplicate / overlapping worked shifts (roster + workforce imports). */
function dedupeWorkedShifts(shifts) {
  const out = [];
  for (const s of shifts) {
    if (out.some((existing) => workedShiftsDuplicate(existing, s))) continue;
    out.push(s);
  }
  return out;
}

/**
 * Append roster-coverage worked shifts (timesheet / manual) per staffId, then dedupe.
 * Skips roster rows that duplicate workforce shifts already in the map.
 */
function mergeRosterWorkedIntoShiftsByStaffId(shiftsByStaffId, rosterWorkedRows) {
  for (const w of rosterWorkedRows) {
    const sid = String(w.rosterStaffId);
    if (!shiftsByStaffId.has(sid)) shiftsByStaffId.set(sid, []);
    const candidate = {
      startDatetime: w.startDatetime,
      endDatetime: w.endDatetime,
      sleepover: !!w.sleepover,
      sleepoverStart: w.sleepoverStart ?? null,
      shiftStatus: w.shiftStatus === 'cancelled' ? 'cancelled' : w.shiftStatus || 'completed',
    };
    const existing = shiftsByStaffId.get(sid);
    if (existing.some((e) => workedShiftsDuplicate(e, candidate))) continue;
    existing.push(candidate);
  }
  for (const sid of shiftsByStaffId.keys()) {
    shiftsByStaffId.set(sid, dedupeWorkedShifts(shiftsByStaffId.get(sid)));
  }
}

async function resolveParticipantTimezone(participantDoc) {
  if (participantDoc?.timezone) return participantDoc.timezone;
  if (participantDoc?.location) {
    const loc = await Location.findById(participantDoc.location).lean();
    if (loc?.timezone) return loc.timezone;
  }
  return config.rosterCoverage.defaultTimezone;
}

function badId(res, id) {
  if (!mongoose.isValidObjectId(id)) {
    res.status(400).json({ error: 'Invalid id' });
    return true;
  }
  return false;
}

// ─── Staff CRUD ─────────────────────────────────────────────────────────────

export async function listRosterStaff(req, res, next) {
  try {
    const rows = await RosterStaff.find().sort({ fullName: 1 }).lean();
    if (rows.length === 0) {
      return res.json({ staff: [] });
    }

    const ids = rows.map((r) => r._id);
    const win = parseTimesheetWindowParams(req.query);

    if (win) {
      const workedShifts = await RosterWorkedShift.find({
        rosterStaffId: { $in: ids },
        shiftStatus: { $ne: 'cancelled' },
        startDatetime: { $lt: new Date(win.endUtc) },
        endDatetime: { $gt: new Date(win.startUtc) },
      }).lean();

      const byStaff = new Map();
      for (const w of workedShifts) {
        const k = String(w.rosterStaffId);
        if (!byStaff.has(k)) byStaff.set(k, []);
        byStaff.get(k).push(w);
      }

      const staff = rows.map((s) => {
        const list = byStaff.get(String(s._id)) || [];
        const workedHoursThisFortnight = r2(
          list.reduce((sum, w) => sum + hoursOfShiftOverlappingFortnight(w, win), 0)
        );
        const cap = s.contractedFortnightlyHours ?? 0;
        const hoursRemaining = r2(cap - workedHoursThisFortnight);
        const capExceeded = cap > 0 && workedHoursThisFortnight >= cap - 1e-6;
        return { ...s, workedHoursThisFortnight, hoursRemaining, capExceeded };
      });
      return res.json({ staff });
    }

    const atMs = parsePayPeriodInstantMs(req.query.payPeriodAt) ?? Date.now();
    const staffMeta = rows.map((s) => {
      const tz = s.timezone || config.rosterCoverage.defaultTimezone;
      const anchorMs = startOfLocalDayUtc(config.rosterCoverage.fortnightAnchorISO, tz);
      const fort = getFortnightContaining(anchorMs, atMs);
      return { s, fortnight: { startUtc: fort.startUtc, endUtc: fort.endUtc } };
    });

    let minStart = Infinity;
    let maxEnd = -Infinity;
    for (const m of staffMeta) {
      if (m.fortnight.startUtc < minStart) minStart = m.fortnight.startUtc;
      if (m.fortnight.endUtc > maxEnd) maxEnd = m.fortnight.endUtc;
    }

    const workedShifts = await RosterWorkedShift.find({
      rosterStaffId: { $in: ids },
      shiftStatus: { $ne: 'cancelled' },
      startDatetime: { $lt: new Date(maxEnd) },
      endDatetime: { $gt: new Date(minStart) },
    }).lean();

    const byStaff = new Map();
    for (const w of workedShifts) {
      const k = String(w.rosterStaffId);
      if (!byStaff.has(k)) byStaff.set(k, []);
      byStaff.get(k).push(w);
    }

    const staff = staffMeta.map(({ s, fortnight }) => {
      const list = byStaff.get(String(s._id)) || [];
      const workedHoursThisFortnight = r2(
        list.reduce((sum, w) => sum + hoursOfShiftOverlappingFortnight(w, fortnight), 0)
      );
      const cap = s.contractedFortnightlyHours ?? 0;
      const hoursRemaining = r2(cap - workedHoursThisFortnight);
      const capExceeded = cap > 0 && workedHoursThisFortnight >= cap - 1e-6;
      return { ...s, workedHoursThisFortnight, hoursRemaining, capExceeded };
    });

    res.json({ staff });
  } catch (e) {
    next(e);
  }
}

export async function createRosterStaff(req, res, next) {
  try {
    const body = req.body || {};
    const doc = await RosterStaff.create({
      fullName: body.fullName,
      shiftcareStaffId:
        body.shiftcareStaffId != null && String(body.shiftcareStaffId).trim() !== ''
          ? String(body.shiftcareStaffId).trim()
          : null,
      phone: body.phone ?? '',
      email: body.email ?? '',
      role: body.role ?? 'Support Worker',
      contractedFortnightlyHours: Number(body.contractedFortnightlyHours),
      timezone: body.timezone || null,
      location: body.location || null,
    });
    res.status(201).json({ staff: doc });
  } catch (e) {
    next(e);
  }
}

export async function patchRosterStaff(req, res, next) {
  try {
    const { id } = req.params;
    if (badId(res, id)) return;
    const body = req.body || {};
    const doc = await RosterStaff.findByIdAndUpdate(
      id,
      {
        $set: {
          ...(body.fullName != null && { fullName: body.fullName }),
          ...(body.shiftcareStaffId !== undefined && {
            shiftcareStaffId:
              body.shiftcareStaffId != null && String(body.shiftcareStaffId).trim() !== ''
                ? String(body.shiftcareStaffId).trim()
                : null,
          }),
          ...(body.phone != null && { phone: body.phone }),
          ...(body.email != null && { email: body.email }),
          ...(body.role != null && { role: body.role }),
          ...(body.contractedFortnightlyHours != null && {
            contractedFortnightlyHours: Number(body.contractedFortnightlyHours),
          }),
          ...(body.timezone !== undefined && { timezone: body.timezone || null }),
          ...(body.location !== undefined && { location: body.location || null }),
        },
      },
      { new: true }
    );
    if (!doc) return res.status(404).json({ error: 'Not found' });
    res.json({ staff: doc });
  } catch (e) {
    next(e);
  }
}

export async function deleteRosterStaff(req, res, next) {
  try {
    const { id } = req.params;
    if (badId(res, id)) return;
    await RosterStaff.findByIdAndDelete(id);
    await RosterParticipant.updateMany({}, { $pull: { approvedStaffIds: id } });
    await RosterWorkedShift.deleteMany({ rosterStaffId: id });
    res.json({ ok: true });
  } catch (e) {
    next(e);
  }
}

// ─── Participants CRUD ──────────────────────────────────────────────────────

export async function listParticipants(req, res, next) {
  try {
    const rows = await RosterParticipant.find()
      .populate('location', 'name timezone code')
      .sort({ name: 1 })
      .lean();
    res.json({ participants: rows });
  } catch (e) {
    next(e);
  }
}

export async function createParticipant(req, res, next) {
  try {
    const body = req.body || {};
    const doc = await RosterParticipant.create({
      name: body.name,
      locationLabel: body.locationLabel ?? '',
      location: body.location || null,
      timezone: body.timezone || null,
      approvedStaffIds: body.approvedStaffIds || [],
    });
    res.status(201).json({ participant: doc });
  } catch (e) {
    next(e);
  }
}

export async function patchParticipant(req, res, next) {
  try {
    const { id } = req.params;
    if (badId(res, id)) return;
    const body = req.body || {};
    const doc = await RosterParticipant.findByIdAndUpdate(
      id,
      {
        $set: {
          ...(body.name != null && { name: body.name }),
          ...(body.locationLabel != null && { locationLabel: body.locationLabel }),
          ...(body.location !== undefined && { location: body.location || null }),
          ...(body.timezone !== undefined && { timezone: body.timezone || null }),
          ...(body.approvedStaffIds != null && { approvedStaffIds: body.approvedStaffIds }),
        },
      },
      { new: true }
    );
    if (!doc) return res.status(404).json({ error: 'Not found' });
    res.json({ participant: doc });
  } catch (e) {
    next(e);
  }
}

export async function deleteParticipant(req, res, next) {
  try {
    const { id } = req.params;
    if (badId(res, id)) return;
    await RosterParticipant.findByIdAndDelete(id);
    await RosterWorkedShift.deleteMany({ rosterParticipantId: id });
    await RosterVacantShift.deleteMany({ rosterParticipantId: id });
    res.json({ ok: true });
  } catch (e) {
    next(e);
  }
}

// ─── Worked shifts ───────────────────────────────────────────────────────────

export async function listWorkedShifts(req, res, next) {
  try {
    const { staffId, from, to } = req.query;
    const q = {};
    if (staffId) {
      if (badId(res, staffId)) return;
      q.rosterStaffId = staffId;
    }
    if (from || to) {
      q.startDatetime = {};
      if (from) q.startDatetime.$gte = new Date(from);
      if (to) q.startDatetime.$lte = new Date(to);
    }
    const rows = await RosterWorkedShift.find(q)
      .populate('rosterStaffId', 'fullName phone')
      .populate('rosterParticipantId', 'name')
      .sort({ startDatetime: 1 })
      .lean();
    res.json({ workedShifts: rows });
  } catch (e) {
    next(e);
  }
}

export async function createWorkedShifts(req, res, next) {
  try {
    const body = req.body || {};
    const items = Array.isArray(body.shifts) ? body.shifts : [body];
    const docs = [];
    for (const s of items) {
      docs.push({
        rosterStaffId: s.rosterStaffId,
        rosterParticipantId: s.rosterParticipantId,
        startDatetime: s.startDatetime,
        endDatetime: s.endDatetime,
        sleepover: !!s.sleepover,
        sleepoverStart: s.sleepoverStart || null,
        shiftStatus: s.shiftStatus || 'completed',
      });
    }
    const inserted = await RosterWorkedShift.insertMany(docs);
    res.status(201).json({ workedShifts: inserted });
  } catch (e) {
    next(e);
  }
}

export async function deleteWorkedShift(req, res, next) {
  try {
    const { id } = req.params;
    if (badId(res, id)) return;
    await RosterWorkedShift.findByIdAndDelete(id);
    res.json({ ok: true });
  } catch (e) {
    next(e);
  }
}

// ─── Vacant shifts ───────────────────────────────────────────────────────────

export async function listVacantShifts(req, res, next) {
  try {
    const status = req.query.status || 'open';
    const q = status === 'all' ? {} : { status };
    const rows = await RosterVacantShift.find(q)
      .populate('rosterParticipantId', 'name')
      .sort({ startDatetime: 1 })
      .lean();
    res.json({ vacantShifts: rows });
  } catch (e) {
    next(e);
  }
}

export async function createVacantShift(req, res, next) {
  try {
    const body = req.body || {};
    const doc = await RosterVacantShift.create({
      rosterParticipantId: body.rosterParticipantId,
      startDatetime: body.startDatetime,
      endDatetime: body.endDatetime,
      sleepover: !!body.sleepover,
      sleepoverStart: body.sleepoverStart || null,
      reason: body.reason || 'vacancy',
      notes: body.notes || '',
      createdBy: req.user?.userId || null,
    });
    res.status(201).json({ vacantShift: doc });
  } catch (e) {
    next(e);
  }
}

export async function patchVacantShift(req, res, next) {
  try {
    const { id } = req.params;
    if (badId(res, id)) return;
    const body = req.body || {};
    const doc = await RosterVacantShift.findByIdAndUpdate(
      id,
      {
        $set: {
          ...(body.status != null && { status: body.status }),
          ...(body.filledByStaffId !== undefined && { filledByStaffId: body.filledByStaffId || null }),
        },
      },
      { new: true }
    );
    if (!doc) return res.status(404).json({ error: 'Not found' });
    res.json({ vacantShift: doc });
  } catch (e) {
    next(e);
  }
}

export async function deleteVacantShift(req, res, next) {
  try {
    const { id } = req.params;
    if (badId(res, id)) return;
    const doc = await RosterVacantShift.findByIdAndDelete(id);
    if (!doc) return res.status(404).json({ error: 'Not found' });
    res.json({ ok: true });
  } catch (e) {
    next(e);
  }
}

export async function clearVacantShifts(req, res, next) {
  try {
    const result = await RosterVacantShift.deleteMany({});
    const deleted = result.deletedCount ?? 0;
    await RosterCoverageAudit.create({
      action: 'vacant_shifts_clear_all',
      userId: req.user?.userId || null,
      payload: { deleted },
    });
    res.json({ ok: true, deleted });
  } catch (e) {
    next(e);
  }
}

// ─── Find cover ──────────────────────────────────────────────────────────────

export async function postFindCover(req, res, next) {
  try {
    const body = req.body || {};
    const participantId = body.rosterParticipantId;
    if (!participantId) return res.status(400).json({ error: 'rosterParticipantId required' });
    if (badId(res, participantId)) return;

    const participant = await RosterParticipant.findById(participantId).lean();
    if (!participant) return res.status(404).json({ error: 'Participant not found' });

    const vacant = {
      startDatetime: body.startDatetime,
      endDatetime: body.endDatetime,
      sleepover: !!body.sleepover,
      sleepoverStart: body.sleepoverStart || null,
    };
    if (!vacant.startDatetime || !vacant.endDatetime) {
      return res.status(400).json({ error: 'startDatetime and endDatetime required' });
    }

    const tz = await resolveParticipantTimezone(participant);
    const win = parseTimesheetWindowParams(body);
    let fortnight;
    let payPeriodAnchorMs;
    let usedTimesheetWindow = false;

    if (win) {
      fortnight = win;
      payPeriodAnchorMs = Math.floor((win.startUtc + win.endUtc) / 2);
      usedTimesheetWindow = true;
    } else {
      const anchorMs = startOfLocalDayUtc(config.rosterCoverage.fortnightAnchorISO, tz);
      const refMs = parsePayPeriodInstantMs(body.payPeriodAt);
      const atMs = refMs != null ? refMs : toMs(vacant.startDatetime);
      const fort = getFortnightContaining(anchorMs, atMs);
      fortnight = { startUtc: fort.startUtc, endUtc: fort.endUtc };
      payPeriodAnchorMs = atMs;
    }

    const allStaff = await RosterStaff.find().lean();
    const staffIds = allStaff.map((s) => s._id);

    const vStart = toMs(vacant.startDatetime);
    const vEnd = toMs(vacant.endDatetime);
    const workforceShifts = await Shift.find({
      $or: [
        {
          startDatetime: { $lt: new Date(fortnight.endUtc) },
          endDatetime: { $gt: new Date(fortnight.startUtc) },
        },
        {
          startDatetime: { $lt: new Date(vEnd + PAD_MS) },
          endDatetime: { $gt: new Date(vStart - PAD_MS) },
        },
      ],
    })
      .select('staffName shiftcareStaffId startDatetime endDatetime shiftType shiftStatus absent')
      .lean();

    const shiftsByStaffId = buildWorkforceShiftsByStaffId(allStaff, workforceShifts);

    const rosterWorkedShifts = await RosterWorkedShift.find({
      rosterStaffId: { $in: staffIds },
      shiftStatus: { $ne: 'cancelled' },
      $or: [
        {
          startDatetime: { $lt: new Date(fortnight.endUtc) },
          endDatetime: { $gt: new Date(fortnight.startUtc) },
        },
        {
          startDatetime: { $lt: new Date(vEnd + PAD_MS) },
          endDatetime: { $gt: new Date(vStart - PAD_MS) },
        },
      ],
    }).lean();

    mergeRosterWorkedIntoShiftsByStaffId(shiftsByStaffId, rosterWorkedShifts);

    const pForEngine = {
      name: participant.name,
      approvedStaffIds: (participant.approvedStaffIds || []).map((x) => String(x)),
    };

    const { eligibleTeam, capExceededTeam, ineligibleTeam, openPoolEligible, openPoolCapExceeded } = findCover(
      vacant,
      pForEngine,
      allStaff,
      shiftsByStaffId,
      fortnight
    );

    let vacantShiftId = body.vacantShiftId || null;
    if (vacantShiftId) {
      if (badId(res, vacantShiftId)) return;
      const existing = await RosterVacantShift.findById(vacantShiftId).lean();
      if (!existing) return res.status(404).json({ error: 'Vacant shift not found' });
    } else if (body.persistVacant) {
      const vs = await RosterVacantShift.create({
        rosterParticipantId: participantId,
        startDatetime: body.startDatetime,
        endDatetime: body.endDatetime,
        sleepover: !!body.sleepover,
        sleepoverStart: body.sleepoverStart || null,
        reason: body.reason || 'vacancy',
        notes: body.notes || '',
        createdBy: req.user?.userId || null,
      });
      vacantShiftId = vs._id;
    }

    await RosterCoverageAudit.create({
      action: 'find_cover',
      userId: req.user?.userId || null,
      vacantShiftId,
      payload: {
        rosterParticipantId: participantId,
        eligibleTeamCount: eligibleTeam.length,
        capExceededTeamCount: capExceededTeam.length,
        ineligibleTeamCount: ineligibleTeam.length,
        openPoolEligibleCount: openPoolEligible.length,
        openPoolCapExceededCount: openPoolCapExceeded.length,
      },
    });

    res.json({
      fortnight: {
        start: new Date(fortnight.startUtc).toISOString(),
        end: new Date(fortnight.endUtc).toISOString(),
        timezone: tz,
      },
      payPeriodAnchor: new Date(payPeriodAnchorMs).toISOString(),
      usedUploadedPayReference: usedTimesheetWindow,
      usedTimesheetWindow,
      eligibleTeam,
      capExceededTeam,
      ineligibleTeam,
      openPoolEligible,
      openPoolCapExceeded,
      vacantShiftId,
    });
  } catch (e) {
    next(e);
  }
}

// ─── Dashboard ───────────────────────────────────────────────────────────────

export async function getDashboardSummary(req, res, next) {
  try {
    const tz = config.rosterCoverage.defaultTimezone;
    const today = formatLocalDate(Date.now(), tz);
    const startToday = startOfLocalDayUtc(today, tz);
    const endToday = startToday + MS_PER_DAY;

    const [participantCount, staffCount, openVacancies, onShiftToday] = await Promise.all([
      RosterParticipant.countDocuments(),
      RosterStaff.countDocuments(),
      RosterVacantShift.countDocuments({ status: 'open' }),
      RosterWorkedShift.countDocuments({
        shiftStatus: { $ne: 'cancelled' },
        startDatetime: { $lt: new Date(endToday) },
        endDatetime: { $gt: new Date(startToday) },
      }),
    ]);

    res.json({
      participantCount,
      staffCount,
      openVacancies,
      onShiftToday,
      localDate: today,
      timezone: tz,
    });
  } catch (e) {
    next(e);
  }
}

// ─── Staff profile ───────────────────────────────────────────────────────────

export async function getStaffProfile(req, res, next) {
  try {
    const { id } = req.params;
    if (badId(res, id)) return;
    const staff = await RosterStaff.findById(id).lean();
    if (!staff) return res.status(404).json({ error: 'Not found' });

    const tz = staff.timezone || config.rosterCoverage.defaultTimezone;
    const win = parseTimesheetWindowParams(req.query);

    let capWindow;
    let payPeriodAnchorMs;
    if (win) {
      capWindow = win;
      payPeriodAnchorMs = Math.floor((win.startUtc + win.endUtc) / 2);
    } else {
      const anchorMs = startOfLocalDayUtc(config.rosterCoverage.fortnightAnchorISO, tz);
      const atMs = parsePayPeriodInstantMs(req.query.payPeriodAt) ?? Date.now();
      const fort = getFortnightContaining(anchorMs, atMs);
      capWindow = { startUtc: fort.startUtc, endUtc: fort.endUtc };
      payPeriodAnchorMs = atMs;
    }

    const [participants, workedShifts] = await Promise.all([
      RosterParticipant.find({ approvedStaffIds: id }).select('name locationLabel').lean(),
      RosterWorkedShift.find({
        rosterStaffId: id,
        shiftStatus: { $ne: 'cancelled' },
        startDatetime: { $lt: new Date(capWindow.endUtc) },
        endDatetime: { $gt: new Date(capWindow.startUtc) },
      })
        .populate('rosterParticipantId', 'name')
        .sort({ startDatetime: 1 })
        .lean(),
    ]);

    const workedHours = r2(
      workedShifts.reduce((sum, w) => sum + hoursOfShiftOverlappingFortnight(w, capWindow), 0)
    );
    const cap = staff.contractedFortnightlyHours ?? 0;
    const hoursRemaining = r2(cap - workedHours);
    const capExceeded = cap > 0 && workedHours >= cap - 1e-6;

    res.json({
      staff,
      approvedParticipants: participants,
      usedTimesheetWindow: !!win,
      payPeriodAnchor: new Date(payPeriodAnchorMs).toISOString(),
      fortnight: {
        start: new Date(capWindow.startUtc).toISOString(),
        end: new Date(capWindow.endUtc).toISOString(),
      },
      workedHoursThisFortnight: workedHours,
      hoursRemaining,
      capExceeded,
      recentWorkedShifts: workedShifts,
    });
  } catch (e) {
    next(e);
  }
}

// ─── Timesheet upload (ShiftCare CSV — same as workforce /api/shifts/upload) ─

function rosterShiftStatusFromParsed(shift) {
  if (shift.absent) return 'cancelled';
  const s = String(shift.shiftStatus ?? '').toLowerCase();
  if (s.includes('cancel')) return 'cancelled';
  if (s.includes('active')) return 'active';
  return 'completed';
}

/** Min/max datetime and sum of durations for shifts about to be inserted (roster timesheet import). */
function summarizeImportedTimesheetRows(rows) {
  if (!rows?.length) {
    return { timesheetSpan: null, totalHoursImported: 0 };
  }
  let minStart = Infinity;
  let maxEnd = -Infinity;
  let totalMs = 0;
  for (const row of rows) {
    const sm = toMs(row.startDatetime);
    const em = toMs(row.endDatetime);
    if (Number.isFinite(sm) && sm < minStart) minStart = sm;
    if (Number.isFinite(em) && em > maxEnd) maxEnd = em;
    totalMs += Math.max(0, em - sm);
  }
  const span =
    Number.isFinite(minStart) && Number.isFinite(maxEnd)
      ? { start: new Date(minStart).toISOString(), end: new Date(maxEnd).toISOString() }
      : null;
  return {
    timesheetSpan: span,
    totalHoursImported: Math.round((totalMs / 3600000) * 100) / 100,
  };
}

/** Exact key: trimmed lower, collapsed internal spaces */
function rosterExactNameKey(displayName) {
  return String(displayName || '')
    .trim()
    .toLowerCase()
    .replace(/\s+/g, ' ');
}

function buildRosterNameLookup(records, nameField) {
  const byExact = new Map();
  const normToRecords = new Map();
  for (const r of records) {
    const raw = r[nameField];
    if (raw == null) continue;
    const ex = rosterExactNameKey(raw);
    if (ex) byExact.set(ex, r);
    const rn = normStaffNameForMatch(raw);
    if (!rn) continue;
    if (!normToRecords.has(rn)) normToRecords.set(rn, []);
    normToRecords.get(rn).push(r);
  }
  const byNormUnique = new Map();
  const ambiguousNorms = new Set();
  for (const [norm, arr] of normToRecords) {
    if (arr.length === 1) byNormUnique.set(norm, arr[0]);
    else ambiguousNorms.add(norm);
  }
  return { byExact, byNormUnique, ambiguousNorms };
}

function resolveByDisplayName(csvName, lookup) {
  const ex = rosterExactNameKey(csvName);
  if (ex && lookup.byExact.has(ex)) return lookup.byExact.get(ex);
  const rn = normStaffNameForMatch(csvName);
  if (!rn) return null;
  if (lookup.ambiguousNorms.has(rn)) return null;
  if (lookup.byNormUnique.has(rn)) return lookup.byNormUnique.get(rn);
  return null;
}

function mergeStaffIntoLookup(lookup, doc) {
  if (!doc?.fullName) return;
  const ex = rosterExactNameKey(doc.fullName);
  if (ex) lookup.byExact.set(ex, doc);
  const rn = normStaffNameForMatch(doc.fullName);
  if (!rn) return;
  if (lookup.ambiguousNorms.has(rn)) return;
  const prev = lookup.byNormUnique.get(rn);
  if (!prev || String(prev._id) === String(doc._id)) lookup.byNormUnique.set(rn, doc);
  else {
    lookup.ambiguousNorms.add(rn);
    lookup.byNormUnique.delete(rn);
  }
}

function mergeParticipantIntoLookup(lookup, doc) {
  if (!doc?.name) return;
  const ex = rosterExactNameKey(doc.name);
  if (ex) lookup.byExact.set(ex, doc);
  const rn = normStaffNameForMatch(doc.name);
  if (!rn) return;
  if (lookup.ambiguousNorms.has(rn)) return;
  const prev = lookup.byNormUnique.get(rn);
  if (!prev || String(prev._id) === String(doc._id)) lookup.byNormUnique.set(rn, doc);
  else {
    lookup.ambiguousNorms.add(rn);
    lookup.byNormUnique.delete(rn);
  }
}

/** Create participant from Scheduler client Name when not already in roster. */
async function ensureParticipantForTimesheetRow(clientName, partLookup) {
  let pt = resolveByDisplayName(clientName, partLookup);
  if (pt) return pt;
  if (lookupParticipantIsAmbiguous(clientName, partLookup)) return null;
  const doc = await RosterParticipant.create({
    name: clientName,
    locationLabel: '',
    approvedStaffIds: [],
  });
  mergeParticipantIntoLookup(partLookup, doc);
  return doc;
}

function lookupParticipantIsAmbiguous(clientName, lookup) {
  const rn = normStaffNameForMatch(clientName);
  return rn ? lookup.ambiguousNorms.has(rn) : false;
}

/**
 * Resolve or create RosterStaff from ShiftCare CSV row (Staff + Staff ID).
 * When roster has no row for that Staff ID, upserts from the file so Scheduler exports work without pre-seeding team.
 */
async function ensureRosterStaffForTimesheetRow({
  staffName,
  scStaffId,
  staffByShiftcareId,
  staffLookup,
}) {
  const defaultH = config.rosterCoverage.defaultContractedFortnightlyHours ?? 76;

  let st = null;
  if (scStaffId && staffByShiftcareId.has(scStaffId)) {
    st = staffByShiftcareId.get(scStaffId);
  } else {
    st = resolveByDisplayName(staffName, staffLookup);
    if (st && scStaffId) {
      const existingById = staffByShiftcareId.get(scStaffId);
      if (existingById && String(existingById._id) !== String(st._id)) {
        st = existingById;
      } else if (!existingById) {
        const hasId = st.shiftcareStaffId != null && String(st.shiftcareStaffId).trim() !== '';
        if (!hasId) {
          await RosterStaff.findByIdAndUpdate(st._id, { $set: { shiftcareStaffId: scStaffId } });
          st = { ...st, shiftcareStaffId: scStaffId };
          staffByShiftcareId.set(scStaffId, st);
        }
      }
    }
  }

  if (!st && scStaffId) {
    const doc = await RosterStaff.findOneAndUpdate(
      { shiftcareStaffId: scStaffId },
      {
        $set: {
          fullName: staffName,
          shiftcareStaffId: scStaffId,
        },
        $setOnInsert: {
          contractedFortnightlyHours: defaultH,
          phone: '',
          email: '',
          role: 'Support Worker',
        },
      },
      { upsert: true, new: true, lean: true }
    );
    staffByShiftcareId.set(scStaffId, doc);
    mergeStaffIntoLookup(staffLookup, doc);
    st = doc;
  }

  return st;
}

export async function uploadTimesheet(req, res, next) {
  let filePath = null;
  try {
    if (!req.file) return res.status(400).json({ error: 'No file uploaded' });
    const name = (req.file.originalname || '').toLowerCase();
    if (!name.endsWith('.csv')) {
      return res.status(400).json({ error: 'Only CSV files are allowed (ShiftCare export, same as Workforce).' });
    }

    filePath = req.file.path;
    const buffer = fs.readFileSync(filePath);
    const parseResult = parseShiftCsvBuffer(buffer, req.user?.userId);

    if (parseResult.errors.length > 0 && parseResult.shifts.length === 0) {
      try {
        fs.unlinkSync(filePath);
      } catch {}
      return res.status(400).json({
        success: false,
        errors: parseResult.errors,
        rowsProcessed: parseResult.rowsProcessed,
        shiftsCreated: 0,
        shiftsSkipped: parseResult.rowsSkipped,
      });
    }

    const staffRows = await RosterStaff.find().lean();
    const staffByShiftcareId = new Map();
    for (const s of staffRows) {
      if (s.shiftcareStaffId != null && String(s.shiftcareStaffId).trim() !== '') {
        staffByShiftcareId.set(String(s.shiftcareStaffId).trim(), s);
      }
    }
    const staffLookup = buildRosterNameLookup(staffRows, 'fullName');
    const partLookup = buildRosterNameLookup(await RosterParticipant.find().lean(), 'name');

    const errors = [...parseResult.errors];
    let resolutionSkipped = 0;
    const toCreate = [];

    for (const shift of parseResult.shifts) {
      const staffName = String(shift.staffName || '').trim();
      const clientName = shift.clientName ? String(shift.clientName).trim() : '';
      const scStaffId = shift.shiftcareStaffId != null ? String(shift.shiftcareStaffId).trim() : '';

      const st = await ensureRosterStaffForTimesheetRow({
        staffName,
        scStaffId,
        staffByShiftcareId,
        staffLookup,
      });
      if (!st) {
        resolutionSkipped += 1;
        const hint = scStaffId ? ` (Staff ID ${scStaffId})` : '';
        errors.push(
          `Unknown roster staff "${staffName}"${hint} — add them under Team or use a CSV row with Staff ID (shift ${shift.startDatetime instanceof Date ? shift.startDatetime.toISOString() : ''})`
        );
        continue;
      }
      if (!clientName) {
        resolutionSkipped += 1;
        errors.push(
          `Missing client name for shift (${staffName}, ${shift.startDatetime instanceof Date ? shift.startDatetime.toISOString() : ''})`
        );
        continue;
      }
      const pt = await ensureParticipantForTimesheetRow(clientName, partLookup);
      if (!pt) {
        resolutionSkipped += 1;
        errors.push(
          `Unknown or ambiguous roster participant "${clientName}" — resolve duplicate names in Participants or add the participant`
        );
        continue;
      }

      const sleepover = shift.shiftType === 'sleepover';
      toCreate.push({
        rosterStaffId: st._id,
        rosterParticipantId: pt._id,
        startDatetime: shift.startDatetime,
        endDatetime: shift.endDatetime,
        sleepover,
        sleepoverStart: null,
        shiftStatus: rosterShiftStatusFromParsed(shift),
      });
    }

    const { timesheetSpan, totalHoursImported } = summarizeImportedTimesheetRows(toCreate);

    let created = 0;
    if (toCreate.length) {
      // Replace prior timesheet rows for these staff in this import span (workforce upload replaces; roster used to append).
      if (timesheetSpan?.start && timesheetSpan?.end) {
        const spanStart = new Date(timesheetSpan.start);
        const spanEnd = new Date(timesheetSpan.end);
        const staffIdsInFile = [...new Set(toCreate.map((r) => r.rosterStaffId))];
        await RosterWorkedShift.deleteMany({
          rosterStaffId: { $in: staffIdsInFile },
          startDatetime: { $lt: spanEnd },
          endDatetime: { $gt: spanStart },
        });
      }
      const inserted = await RosterWorkedShift.insertMany(toCreate);
      created = inserted.length;
    }

    await RosterCoverageAudit.create({
      action: 'timesheet_upload',
      userId: req.user?.userId || null,
      payload: {
        rows: parseResult.rowsProcessed,
        created,
        errors: errors.length,
        shiftsSkipped: parseResult.rowsSkipped + resolutionSkipped,
        timesheetSpan,
        totalHoursImported,
      },
    });

    try {
      fs.unlinkSync(filePath);
    } catch {}

    res.json({
      success: true,
      rowsProcessed: parseResult.rowsProcessed,
      shiftsCreated: created,
      shiftsSkipped: parseResult.rowsSkipped + resolutionSkipped,
      errors,
      timesheetSpan,
      totalHoursImported,
    });
  } catch (e) {
    if (filePath) {
      try {
        fs.unlinkSync(filePath);
      } catch {}
    }
    next(e);
  }
}

export async function uploadVacantShifts(req, res, next) {
  let filePath = null;
  try {
    if (!req.file) return res.status(400).json({ error: 'No file uploaded' });

    filePath = req.file.path;
    const buffer = fs.readFileSync(filePath);
    const parseResult = parseVacantShiftBuffer(buffer, req.file.originalname || '');

    if (parseResult.errors.length > 0 && parseResult.rows.length === 0) {
      try {
        fs.unlinkSync(filePath);
      } catch {}
      return res.status(400).json({
        success: false,
        errors: parseResult.errors,
        rowsProcessed: parseResult.rowsProcessed,
        created: 0,
        kept: 0,
        skipped: 0,
      });
    }

    const partLookup = buildRosterNameLookup(await RosterParticipant.find().lean(), 'name');
    const errors = [...parseResult.errors];
    let created = 0;
    let kept = 0;
    let skipped = 0;

    const seenShiftIds = parseResult.rows.map((r) => r.shiftcareShiftId);

    for (const row of parseResult.rows) {
      const pt = await ensureParticipantForTimesheetRow(row.clientName, partLookup);
      if (!pt) {
        skipped += 1;
        errors.push(
          `Unknown or ambiguous roster participant "${row.clientName}" (shift ${row.shiftcareShiftId})`
        );
        continue;
      }

      const existing = await RosterVacantShift.findOne({
        shiftcareShiftId: row.shiftcareShiftId,
      }).lean();

      if (existing) {
        // Preserve history: do not update schedule, status, notes, or updateLogs.
        kept += 1;
        continue;
      }

      await RosterVacantShift.create({
        rosterParticipantId: pt._id,
        startDatetime: row.startDatetime,
        endDatetime: row.endDatetime,
        sleepover: row.sleepover,
        reason: row.reason,
        priority: row.priority,
        shiftcareShiftId: row.shiftcareShiftId,
        notes: row.notes,
        status: row.status,
        createdBy: req.user?.userId || null,
      });
      created += 1;
    }

    // Hard-delete imported shifts absent from this file (manual rows without shiftcareShiftId untouched).
    let deleted = 0;
    if (seenShiftIds.length > 0) {
      const deleteResult = await RosterVacantShift.deleteMany({
        shiftcareShiftId: { $nin: seenShiftIds, $ne: null },
      });
      deleted = deleteResult.deletedCount ?? 0;
    }

    await RosterCoverageAudit.create({
      action: 'vacant_shifts_upload',
      userId: req.user?.userId || null,
      payload: {
        rows: parseResult.rowsProcessed,
        created,
        kept,
        skipped,
        deleted,
        errors: errors.length,
      },
    });

    try {
      fs.unlinkSync(filePath);
    } catch {}

    res.json({
      success: true,
      rowsProcessed: parseResult.rowsProcessed,
      created,
      kept,
      skipped,
      deleted,
      errors,
    });
  } catch (e) {
    if (filePath) {
      try {
        fs.unlinkSync(filePath);
      } catch {}
    }
    next(e);
  }
}

// ─── Exports & contact ───────────────────────────────────────────────────────

function padPdf7(cells) {
  const out = [...cells];
  while (out.length < 7) out.push('');
  return out;
}

export async function exportIneligibilityPdf(req, res, next) {
  try {
    const { title, rows } = req.body || {};
    const headers = padPdf7(['Staff', 'Reasons']);
    const pdfRows = (rows || []).map((r) =>
      padPdf7([
        r.fullName || r.staff?.fullName || '',
        Array.isArray(r.reasons) ? r.reasons.join('; ') : String(r.reasons || ''),
      ])
    );
    const buf = await buildSummaryPdf({
      title: title || 'Ineligibility report',
      headers,
      rows: pdfRows,
      totalsRow: padPdf7(['Total rows', String(pdfRows.length)]),
    });
    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', 'attachment; filename=ineligibility.pdf');
    res.send(buf);
  } catch (e) {
    next(e);
  }
}

export async function exportIneligibilityXlsx(req, res, next) {
  try {
    const { rows } = req.body || {};
    const data = (rows || []).map((r) => ({
      Staff: r.fullName || r.staff?.fullName || '',
      Reasons: Array.isArray(r.reasons) ? r.reasons.join('; ') : String(r.reasons || ''),
    }));
    const ws = XLSX.utils.json_to_sheet(data.length ? data : [{ Staff: '', Reasons: '' }]);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, 'Ineligible');
    const buf = XLSX.write(wb, { type: 'buffer', bookType: 'xlsx' });
    res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
    res.setHeader('Content-Disposition', 'attachment; filename=ineligibility.xlsx');
    res.send(buf);
  } catch (e) {
    next(e);
  }
}

export async function patchContactStatus(req, res, next) {
  try {
    const { vacantId, staffId } = req.params;
    if (badId(res, vacantId) || badId(res, staffId)) return;
    const body = req.body || {};
    const doc = await RosterContactStatus.findOneAndUpdate(
      { vacantShiftId: vacantId, rosterStaffId: staffId },
      {
        $set: {
          ...(body.contacted != null && {
            contacted: !!body.contacted,
            contactedAt: body.contacted ? new Date() : null,
          }),
          ...(body.confirmed != null && {
            confirmed: !!body.confirmed,
            confirmedAt: body.confirmed ? new Date() : null,
          }),
        },
      },
      { new: true, upsert: true }
    );

    await RosterCoverageAudit.create({
      action: body.confirmed ? 'confirmed' : 'contacted',
      userId: req.user?.userId || null,
      vacantShiftId: vacantId,
      rosterStaffId: staffId,
      payload: body,
    });

    res.json({ contactStatus: doc });
  } catch (e) {
    next(e);
  }
}

export async function listAuditLog(req, res, next) {
  try {
    const limit = Math.min(Number(req.query.limit) || 50, 200);
    const rows = await RosterCoverageAudit.find().sort({ createdAt: -1 }).limit(limit).lean();
    res.json({ audit: rows });
  } catch (e) {
    next(e);
  }
}

// ─── Shift Dashboard ─────────────────────────────────────────────────────────

export async function listShiftDashboard(req, res, next) {
  try {
    const { status, priority } = req.query;
    const filter = {};
    if (status && status !== 'all') filter.status = status;
    if (priority && priority !== 'all') filter.priority = priority;

    const shifts = await RosterVacantShift.find(filter)
      .populate('rosterParticipantId', 'name locationLabel')
      .populate('filledByStaffId', 'fullName')
      .sort({ createdAt: -1 })
      .lean();

    const counts = {
      open: await RosterVacantShift.countDocuments({ status: 'open' }),
      in_progress: await RosterVacantShift.countDocuments({ status: 'in_progress' }),
      filled: await RosterVacantShift.countDocuments({ status: 'filled' }),
      critical: await RosterVacantShift.countDocuments({
        priority: 'critical',
        status: { $in: ['open', 'in_progress'] },
      }),
    };

    res.json({ shifts, counts });
  } catch (e) {
    next(e);
  }
}

export async function addVacantShiftUpdate(req, res, next) {
  try {
    const { id } = req.params;
    if (badId(res, id)) return;
    const { authorName, text } = req.body;
    if (!text?.trim()) return res.status(400).json({ error: 'text required' });

    const shift = await RosterVacantShift.findByIdAndUpdate(
      id,
      { $push: { updateLogs: { authorName: (authorName || 'Staff').trim(), text: text.trim() } } },
      { new: true }
    )
      .populate('rosterParticipantId', 'name locationLabel')
      .populate('filledByStaffId', 'fullName')
      .lean();

    if (!shift) return res.status(404).json({ error: 'Not found' });
    res.json({ shift });
  } catch (e) {
    next(e);
  }
}
