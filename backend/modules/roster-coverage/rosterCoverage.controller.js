import fs from 'fs';
import mongoose from 'mongoose';
import { parse } from 'csv-parse/sync';
import * as XLSX from 'xlsx';
import { config } from '../../config/index.js';
import { Location } from '../locations/location.model.js';
import { RosterStaff } from './rosterStaff.model.js';
import { RosterParticipant } from './rosterParticipant.model.js';
import { RosterWorkedShift } from './rosterWorkedShift.model.js';
import { RosterVacantShift } from './rosterVacantShift.model.js';
import { RosterCoverageAudit } from './rosterCoverageAudit.model.js';
import { RosterContactStatus } from './rosterContactStatus.model.js';
import { findCover, toMs } from './services/eligibilityEngine.js';
import {
  getFortnightContaining,
  startOfLocalDayUtc,
  formatLocalDate,
} from './services/fortnight.js';
import { buildSummaryPdf } from '../forecast-actuals/summaryPdf.js';

const MS_PER_DAY = 86400000;
const PAD_MS = 10 * 24 * 3600000;

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
    res.json({ staff: rows });
  } catch (e) {
    next(e);
  }
}

export async function createRosterStaff(req, res, next) {
  try {
    const body = req.body || {};
    const doc = await RosterStaff.create({
      fullName: body.fullName,
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
    const anchorMs = startOfLocalDayUtc(config.rosterCoverage.fortnightAnchorISO, tz);
    const atMs = toMs(vacant.startDatetime);
    const fort = getFortnightContaining(anchorMs, atMs);
    const fortnight = { startUtc: fort.startUtc, endUtc: fort.endUtc };

    const allStaff = await RosterStaff.find().lean();
    const staffIds = allStaff.map((s) => s._id);

    const vStart = toMs(vacant.startDatetime);
    const vEnd = toMs(vacant.endDatetime);
    const shifts = await RosterWorkedShift.find({
      rosterStaffId: { $in: staffIds },
      shiftStatus: { $ne: 'cancelled' },
      $or: [
        {
          startDatetime: { $lt: new Date(fort.endUtc) },
          endDatetime: { $gt: new Date(fort.startUtc) },
        },
        {
          startDatetime: { $lt: new Date(vEnd + PAD_MS) },
          endDatetime: { $gt: new Date(vStart - PAD_MS) },
        },
      ],
    }).lean();

    const shiftsByStaffId = new Map();
    for (const sid of staffIds) shiftsByStaffId.set(String(sid), []);
    for (const sh of shifts) {
      const k = String(sh.rosterStaffId);
      if (!shiftsByStaffId.has(k)) shiftsByStaffId.set(k, []);
      shiftsByStaffId.get(k).push(sh);
    }

    const pForEngine = {
      name: participant.name,
      approvedStaffIds: (participant.approvedStaffIds || []).map((x) => String(x)),
    };

    const { eligible, ineligible } = findCover(vacant, pForEngine, allStaff, shiftsByStaffId, fortnight);

    let vacantShiftId = null;
    if (body.persistVacant) {
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
        eligibleCount: eligible.length,
        ineligibleCount: ineligible.length,
      },
    });

    res.json({
      fortnight: {
        start: new Date(fortnight.startUtc).toISOString(),
        end: new Date(fortnight.endUtc).toISOString(),
        timezone: tz,
      },
      eligible,
      ineligible,
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
    const anchorMs = startOfLocalDayUtc(config.rosterCoverage.fortnightAnchorISO, tz);
    const fort = getFortnightContaining(anchorMs, Date.now());

    const [participants, workedShifts] = await Promise.all([
      RosterParticipant.find({ approvedStaffIds: id }).select('name locationLabel').lean(),
      RosterWorkedShift.find({
        rosterStaffId: id,
        shiftStatus: { $ne: 'cancelled' },
        startDatetime: { $lt: new Date(fort.endUtc) },
        endDatetime: { $gt: new Date(fort.startUtc) },
      })
        .populate('rosterParticipantId', 'name')
        .sort({ startDatetime: 1 })
        .lean(),
    ]);

    const inFortnight = workedShifts.filter((w) => {
      const ws = toMs(w.startDatetime);
      return ws >= fort.startUtc && ws < fort.endUtc;
    });
    const workedHours = inFortnight.reduce((sum, w) => {
      const h = (toMs(w.endDatetime) - toMs(w.startDatetime)) / 3600000;
      return sum + Math.round(h * 100) / 100;
    }, 0);

    res.json({
      staff,
      approvedParticipants: participants,
      fortnight: {
        start: new Date(fort.startUtc).toISOString(),
        end: new Date(fort.endUtc).toISOString(),
      },
      workedHoursThisFortnight: workedHours,
      hoursRemaining: Math.max(0, Math.round((staff.contractedFortnightlyHours - workedHours) * 100) / 100),
      recentWorkedShifts: workedShifts,
    });
  } catch (e) {
    next(e);
  }
}

// ─── Timesheet upload ────────────────────────────────────────────────────────

function normalizeHeader(h) {
  return String(h || '')
    .trim()
    .toLowerCase()
    .replace(/\s+/g, ' ');
}

function defaultColumnMap() {
  return {
    staffName: ['staff name', 'staff', 'name'],
    participantName: ['participant name', 'participant', 'client name', 'client'],
    date: ['shift date', 'date'],
    start: ['start time', 'start'],
    end: ['end time', 'end'],
    sleepover: ['sleepover', 'sleep over'],
    sleepoverStart: ['sleepover start', 'sleepover begins'],
    status: ['shift status', 'status'],
  };
}

function pickColumn(headers, aliases) {
  const norm = new Map(headers.map((h, i) => [normalizeHeader(h), i]));
  for (const a of aliases) {
    const i = norm.get(normalizeHeader(a));
    if (i !== undefined) return i;
  }
  return null;
}

function sheetRowsToObjects(buffer, ext) {
  if (ext === '.csv') {
    const text = buffer.toString('utf8');
    const records = parse(text, { columns: true, skip_empty_lines: true, trim: true });
    return { rows: records, headers: records.length ? Object.keys(records[0]) : [] };
  }
  const wb = XLSX.read(buffer, { type: 'buffer' });
  const sheet = wb.Sheets[wb.SheetNames[0]];
  const rows = XLSX.utils.sheet_to_json(sheet, { defval: '' });
  return { rows, headers: rows.length ? Object.keys(rows[0]) : [] };
}

export async function uploadTimesheet(req, res, next) {
  let filePath = null;
  try {
    if (!req.file) return res.status(400).json({ error: 'No file uploaded' });
    filePath = req.file.path;
    const buffer = fs.readFileSync(filePath);
    const ext = (req.file.originalname || '').toLowerCase().endsWith('.csv') ? '.csv' : '.xlsx';

    let columnMap = defaultColumnMap();
    if (req.body.columnMap) {
      try {
        columnMap = { ...columnMap, ...JSON.parse(req.body.columnMap) };
      } catch {
        /* use default */
      }
    }

    const { rows, headers } = sheetRowsToObjects(buffer, ext);
    const idx = {
      staff: pickColumn(headers, columnMap.staffName),
      participant: pickColumn(headers, columnMap.participantName),
      date: pickColumn(headers, columnMap.date),
      start: pickColumn(headers, columnMap.start),
      end: pickColumn(headers, columnMap.end),
      sleepover: pickColumn(headers, columnMap.sleepover),
      sleepoverStart: pickColumn(headers, columnMap.sleepoverStart),
      status: pickColumn(headers, columnMap.status),
    };

    if (idx.staff == null || idx.date == null || idx.start == null || idx.end == null || idx.participant == null) {
      return res.status(400).json({
        error:
          'Could not detect required columns (staff name, participant name, date, start, end). Pass columnMap JSON if headers differ.',
        headers,
      });
    }

    const staffByName = new Map((await RosterStaff.find().lean()).map((s) => [s.fullName.trim().toLowerCase(), s]));
    const partByName = new Map((await RosterParticipant.find().lean()).map((p) => [p.name.trim().toLowerCase(), p]));

    const errors = [];
    let created = 0;
    const toCreate = [];

    for (let r = 0; r < rows.length; r++) {
      const row = rows[r];
      const vals = Array.isArray(row) ? row : headers.map((h) => row[h]);
      const staffName = String(vals[idx.staff] ?? '').trim();
      const partName = idx.participant != null ? String(vals[idx.participant] ?? '').trim() : '';
      const dateStr = String(vals[idx.date] ?? '').trim();
      const startRaw = vals[idx.start];
      const endRaw = vals[idx.end];

      const st = staffByName.get(staffName.toLowerCase());
      if (!st) {
        errors.push({ row: r + 2, message: `Unknown staff: ${staffName}` });
        continue;
      }
      const pt = partByName.get(partName.toLowerCase());
      if (!partName || !pt) {
        errors.push({ row: r + 2, message: partName ? `Unknown participant: ${partName}` : 'Participant name required' });
        continue;
      }

      let shiftStatus = 'completed';
      if (idx.status != null) {
        const s = String(vals[idx.status] ?? '').toLowerCase();
        if (s.includes('cancel')) shiftStatus = 'cancelled';
        else if (s.includes('active')) shiftStatus = 'active';
      }

      let sleepover = false;
      if (idx.sleepover != null) {
        const sy = String(vals[idx.sleepover] ?? '').toLowerCase();
        sleepover = sy === 'yes' || sy === 'y' || sy === 'true' || sy === '1';
      }

      let startDatetime;
      let endDatetime;
      try {
        if (startRaw instanceof Date) {
          startDatetime = startRaw;
        } else if (typeof startRaw === 'number') {
          const base = XLSX.SSF.parse_date_code(startRaw);
          startDatetime = new Date(Date.UTC(base.y, base.m - 1, base.d, base.H || 0, base.M || 0));
        } else {
          startDatetime = new Date(`${dateStr}T${String(startRaw).trim()}`);
        }
        if (endRaw instanceof Date) {
          endDatetime = endRaw;
        } else if (typeof endRaw === 'number') {
          const base = XLSX.SSF.parse_date_code(endRaw);
          endDatetime = new Date(Date.UTC(base.y, base.m - 1, base.d, base.H || 0, base.M || 0));
        } else {
          endDatetime = new Date(`${dateStr}T${String(endRaw).trim()}`);
        }
      } catch {
        errors.push({ row: r + 2, message: 'Invalid date/time' });
        continue;
      }

      let sleepoverStart = null;
      if (sleepover && idx.sleepoverStart != null && vals[idx.sleepoverStart]) {
        try {
          sleepoverStart = new Date(`${dateStr}T${String(vals[idx.sleepoverStart]).trim()}`);
        } catch {
          sleepoverStart = null;
        }
      }

      toCreate.push({
        rosterStaffId: st._id,
        rosterParticipantId: pt._id,
        startDatetime,
        endDatetime,
        sleepover,
        sleepoverStart,
        shiftStatus,
      });
    }

    if (toCreate.length) {
      const inserted = await RosterWorkedShift.insertMany(toCreate);
      created = inserted.length;
    }

    await RosterCoverageAudit.create({
      action: 'timesheet_upload',
      userId: req.user?.userId || null,
      payload: { rows: rows.length, created, errors: errors.length },
    });

    try {
      fs.unlinkSync(filePath);
    } catch {}

    res.json({ success: true, rowsProcessed: rows.length, shiftsCreated: created, errors });
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
