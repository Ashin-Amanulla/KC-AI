import { CirRecord } from './cir.model.js';
import { allocateNextCirId, isBlankCirId } from './cirIdAllocator.js';
import { parseCirWorkbookBuffer, buildCirWorkbook } from './cirExcelImport.js';

function buildSearchFilter(search) {
  const q = String(search || '').trim();
  if (!q) return {};
  const regex = new RegExp(q.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'i');
  return {
    $or: [
      { cirId: regex },
      { clientArea: regex },
      { issueDescription: regex },
      { responsibleOfficer: regex },
      { enteredByName: regex },
      { department: regex },
      { status: regex },
    ],
  };
}

function startOfToday() {
  const d = new Date();
  d.setHours(0, 0, 0, 0);
  return d;
}

async function ensureCirId(data) {
  const body = { ...data };
  if (!isBlankCirId(body.cirId)) return body;
  body.cirId = await allocateNextCirId(CirRecord);
  return body;
}

function applyCreateDefaults(data, user) {
  const body = { ...data };
  const today = startOfToday();
  if (!body.dateEntered) body.dateEntered = today;
  if (!body.dateRaised) body.dateRaised = today;
  if (!body.enteredByName && user?.name) body.enteredByName = user.name;
  if (!body.status) body.status = 'Open';
  return body;
}

export async function previewNextCirId() {
  return allocateNextCirId(CirRecord);
}

export async function listCirRecords({ search } = {}) {
  const filter = buildSearchFilter(search);
  return CirRecord.find(filter).sort({ cirId: 1 }).lean();
}

export async function createCirRecord(data, user) {
  const withDefaults = applyCreateDefaults(data, user);
  const body = await ensureCirId(withDefaults);
  try {
    return await CirRecord.create(body);
  } catch (e) {
    if (e?.code === 11000) {
      const retryBody = await ensureCirId({ ...withDefaults, cirId: '' });
      return CirRecord.create(retryBody);
    }
    throw e;
  }
}

export async function updateCirRecord(id, data) {
  const { actionUpdates, cirId, ...patch } = data || {};
  return CirRecord.findByIdAndUpdate(id, patch, { new: true, runValidators: true }).lean();
}

export async function deleteCirRecord(id) {
  return CirRecord.findByIdAndDelete(id);
}

export async function appendActionUpdate(id, { text, authorName, authorUserId }) {
  const trimmed = String(text || '').trim();
  if (!trimmed) {
    const err = new Error('Update text is required');
    err.status = 400;
    throw err;
  }
  const update = {
    text: trimmed,
    authorName: String(authorName || 'Staff').trim() || 'Staff',
    authorUserId: authorUserId || null,
  };
  return CirRecord.findByIdAndUpdate(
    id,
    { $push: { actionUpdates: update } },
    { new: true, runValidators: true }
  ).lean();
}

export async function importCirWorkbook(buffer) {
  const rows = parseCirWorkbookBuffer(buffer);
  const results = { upserted: 0, skipped: 0 };
  for (const parsed of rows) {
    if (!parsed?.cirId) {
      results.skipped += 1;
      continue;
    }
    await CirRecord.findOneAndUpdate(
      { cirId: parsed.cirId },
      { $set: parsed },
      { upsert: true, runValidators: true }
    );
    results.upserted += 1;
  }
  return results;
}

export async function exportCirWorkbook() {
  const records = await CirRecord.find().sort({ cirId: 1 }).lean();
  const body = buildCirWorkbook(records);
  return {
    filename: 'continuous-improvement-register.xlsx',
    body,
    contentType: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  };
}
