import { SilEstimate } from './silEstimate.model.js';
import { buildComputedSummary } from './silEstimate.calc.js';

const ALLOWED_FIELDS = [
  'name',
  'state',
  'ratesNew',
  'ratesOld',
  'oldRatesConfirmed',
  'holidays',
  'templates',
  'participants',
  'activeParticipantName',
  'budget',
  'planStart',
  'planEnd',
];

function pickWorkspaceFields(data) {
  const out = {};
  for (const key of ALLOWED_FIELDS) {
    if (data[key] !== undefined) out[key] = data[key];
  }
  return out;
}

function getActiveParticipant(workspace) {
  const name = workspace.activeParticipantName || workspace.participants?.[0]?.name;
  return workspace.participants?.find((p) => p.name === name) || workspace.participants?.[0] || null;
}

export async function listSilEstimates() {
  const rows = await SilEstimate.find()
    .sort({ updatedAt: -1 })
    .select('name state participants activeParticipantName computedSummary updatedAt createdAt')
    .lean();

  return rows.map((row) => {
    const p = getActiveParticipant(row);
    return {
      _id: row._id,
      name: row.name,
      state: row.state,
      participantCount: row.participants?.length || 0,
      activeParticipantName: row.activeParticipantName,
      planStart: p?.planStart || row.computedSummary?.planStart || '',
      planEnd: p?.planEnd || row.computedSummary?.planEnd || '',
      periodTotal: row.computedSummary?.periodTotal ?? 0,
      variance: row.computedSummary?.variance ?? 0,
      updatedAt: row.updatedAt,
      createdAt: row.createdAt,
    };
  });
}

export async function getSilEstimateById(id) {
  const doc = await SilEstimate.findById(id).lean();
  if (!doc) return null;
  // Recompute summary from stored workspace data (always fresh)
  doc.computedSummary = buildComputedSummary(doc);
  return doc;
}

export async function createSilEstimate(data, userId) {
  const body = pickWorkspaceFields(data);
  if (!body.name?.trim()) body.name = 'New SIL estimate';
  body.computedSummary = buildComputedSummary(body);
  body.createdBy = userId || null;
  const doc = await SilEstimate.create(body);
  return doc.toObject();
}

export async function updateSilEstimate(id, data) {
  const body = pickWorkspaceFields(data);
  const merged = { ...body };
  merged.computedSummary = buildComputedSummary(merged);
  return SilEstimate.findByIdAndUpdate(id, merged, { new: true, runValidators: true }).lean();
}

export async function deleteSilEstimate(id) {
  return SilEstimate.findByIdAndDelete(id);
}

export async function duplicateSilEstimate(id, userId) {
  const src = await SilEstimate.findById(id).lean();
  if (!src) return null;
  const { _id, createdAt, updatedAt, ...rest } = src;
  const copy = {
    ...rest,
    name: `${rest.name} (copy)`,
    createdBy: userId || rest.createdBy,
  };
  copy.computedSummary = buildComputedSummary(copy);
  const doc = await SilEstimate.create(copy);
  return doc.toObject();
}

