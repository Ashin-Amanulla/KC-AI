import * as XLSX from 'xlsx';
import { CrmSupportCoordinator } from './crmSupportCoordinator.model.js';
import { CrmLead } from './crmLead.model.js';
import { CrmMarketingActivity } from './crmMarketingActivity.model.js';
import { CrmStaffingRequirement } from './crmStaffingRequirement.model.js';
import { RELATIONSHIP_STATUSES, LEAD_STATUSES, CRM_SHEETS } from './crm.constants.js';
import {
  parseWorkbookBuffer,
  parseSupportCoordinatorRow,
  parseLeadRow,
  parseMarketingActivityRow,
  parseStaffingRequirementRow,
  SUPPORT_COORDINATOR_EXPORT_HEADERS,
  LEAD_EXPORT_HEADERS,
  MARKETING_ACTIVITY_EXPORT_HEADERS,
  STAFFING_REQUIREMENT_EXPORT_HEADERS,
  supportCoordinatorToExportRow,
  leadToExportRow,
  marketingActivityToExportRow,
  staffingRequirementToExportRow,
} from './crmExcelImport.js';
import {
  allocateNextId,
  CRM_ID_CONFIG,
  isBlankId,
} from './crmIdAllocator.js';
import {
  mergeMongoFilters,
  assertCanMutateRecord,
  withBdmOwnerOnCreate,
  listBdmOwners,
} from './crmAccess.js';
import { enrichLead, enrichLeads, stripLeadComputedFields } from './crmLeadUtils.js';
import { config } from '../../config/index.js';
import { parsePagination, paginationMeta } from '../../utils/pagination.js';

export { listBdmOwners };

const MS_PER_DAY = 86400000;

function startOfToday() {
  const d = new Date();
  d.setHours(0, 0, 0, 0);
  return d;
}

function buildSearchFilter(search, fields) {
  const q = String(search || '').trim();
  if (!q) return {};
  const regex = new RegExp(q.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'i');
  return { $or: fields.map((f) => ({ [f]: regex })) };
}

const ENTITY_MODELS = {
  'support-coordinators': CrmSupportCoordinator,
  leads: CrmLead,
  'marketing-activities': CrmMarketingActivity,
};

async function ensureBusinessId(data, entityKey) {
  const cfg = CRM_ID_CONFIG[entityKey];
  if (!cfg) return data;
  const body = { ...data };
  if (!isBlankId(body[cfg.field])) return body;
  body[cfg.field] = await allocateNextId(
    ENTITY_MODELS[entityKey],
    cfg.field,
    cfg.prefix,
    cfg.padWidth
  );
  return body;
}

async function createWithAutoId(model, entityKey, data) {
  const body = await ensureBusinessId(data, entityKey);
  try {
    return await model.create(body);
  } catch (e) {
    if (e?.code === 11000 && CRM_ID_CONFIG[entityKey]) {
      const retryBody = await ensureBusinessId({ ...data, [CRM_ID_CONFIG[entityKey].field]: '' }, entityKey);
      return model.create(retryBody);
    }
    throw e;
  }
}

export async function previewNextId(entityKey) {
  const cfg = CRM_ID_CONFIG[entityKey];
  const model = ENTITY_MODELS[entityKey];
  if (!cfg || !model) {
    const err = new Error('Unknown entity for ID preview');
    err.status = 400;
    throw err;
  }
  return allocateNextId(model, cfg.field, cfg.prefix, cfg.padWidth);
}

function buildListFilter(search, fields, extra = {}, bdmFilter = {}) {
  const filter = mergeMongoFilters(buildSearchFilter(search, fields), bdmFilter);
  return { ...filter, ...extra };
}

async function findOwned(Model, id, access) {
  const doc = await Model.findById(id).lean();
  if (!doc) return null;
  assertCanMutateRecord(doc, access);
  return doc;
}

async function paginatedFind(Model, filter, sort, { page, pageSize } = {}) {
  const pagination = parsePagination({ page, pageSize }, config.crm.pageSize);
  const [items, total] = await Promise.all([
    Model.find(filter).sort(sort).skip(pagination.skip).limit(pagination.pageSize).lean(),
    Model.countDocuments(filter),
  ]);
  return {
    items,
    ...paginationMeta(total, pagination.page, pagination.pageSize),
  };
}

// --- Support Coordinators ---

export async function listSupportCoordinators({ search, access, page, pageSize } = {}) {
  const filter = buildListFilter(
    search,
    ['scId', 'coordinatorName', 'organisation', 'email', 'location'],
    {},
    access?.bdmFilter
  );
  return paginatedFind(CrmSupportCoordinator, filter, { scId: 1 }, { page, pageSize });
}

export async function createSupportCoordinator(data, access) {
  const body = withBdmOwnerOnCreate(data, access);
  return createWithAutoId(CrmSupportCoordinator, 'support-coordinators', body);
}

export async function updateSupportCoordinator(id, data, access) {
  await findOwned(CrmSupportCoordinator, id, access);
  const { bdmOwnerId, ...patch } = data || {};
  return CrmSupportCoordinator.findByIdAndUpdate(id, patch, { new: true, runValidators: true }).lean();
}

export async function deleteSupportCoordinator(id, access) {
  await findOwned(CrmSupportCoordinator, id, access);
  return CrmSupportCoordinator.findByIdAndDelete(id);
}

// --- Leads ---

export async function listLeads({ search, status, access, page, pageSize } = {}) {
  const extra = status ? { status } : {};
  const filter = buildListFilter(
    search,
    ['leadId', 'name', 'referralSource', 'referralEmail'],
    extra,
    access?.bdmFilter
  );
  const result = await paginatedFind(CrmLead, filter, { leadId: 1 }, { page, pageSize });
  return {
    ...result,
    items: enrichLeads(result.items),
  };
}

export async function createLead(data, access) {
  const body = withBdmOwnerOnCreate(stripLeadComputedFields(data), access);
  const doc = await createWithAutoId(CrmLead, 'leads', body);
  return enrichLead(doc?.toObject ? doc.toObject() : doc);
}

export async function updateLead(id, data, access) {
  await findOwned(CrmLead, id, access);
  const patch = stripLeadComputedFields(data);
  delete patch.bdmOwnerId;
  const doc = await CrmLead.findByIdAndUpdate(id, patch, { new: true, runValidators: true }).lean();
  return enrichLead(doc);
}

export async function deleteLead(id, access) {
  await findOwned(CrmLead, id, access);
  return CrmLead.findByIdAndDelete(id);
}

// --- Marketing Activities ---

export async function listMarketingActivities({ search, access, page, pageSize } = {}) {
  const filter = buildListFilter(
    search,
    ['activityId', 'activityType', 'organisationName', 'relatedScOrLeadId'],
    {},
    access?.bdmFilter
  );
  return paginatedFind(CrmMarketingActivity, filter, { date: -1, activityId: 1 }, { page, pageSize });
}

export async function createMarketingActivity(data, access) {
  const body = withBdmOwnerOnCreate(data, access);
  return createWithAutoId(CrmMarketingActivity, 'marketing-activities', body);
}

export async function updateMarketingActivity(id, data, access) {
  await findOwned(CrmMarketingActivity, id, access);
  const { bdmOwnerId, ...patch } = data || {};
  return CrmMarketingActivity.findByIdAndUpdate(id, patch, { new: true, runValidators: true }).lean();
}

export async function deleteMarketingActivity(id, access) {
  await findOwned(CrmMarketingActivity, id, access);
  return CrmMarketingActivity.findByIdAndDelete(id);
}

// --- Staffing Requirements ---

export async function listStaffingRequirements({ search, access, page, pageSize } = {}) {
  const filter = buildListFilter(search, ['participant', 'location', 'notes'], {}, access?.bdmFilter);
  return paginatedFind(
    CrmStaffingRequirement,
    filter,
    { startDate: 1, dueDate: 1, participant: 1 },
    { page, pageSize }
  );
}

export async function createStaffingRequirement(data, access) {
  const body = withBdmOwnerOnCreate(data, access);
  return CrmStaffingRequirement.create(body);
}

export async function updateStaffingRequirement(id, data, access) {
  await findOwned(CrmStaffingRequirement, id, access);
  const { bdmOwnerId, ...patch } = data || {};
  return CrmStaffingRequirement.findByIdAndUpdate(id, patch, { new: true, runValidators: true }).lean();
}

export async function deleteStaffingRequirement(id, access) {
  await findOwned(CrmStaffingRequirement, id, access);
  return CrmStaffingRequirement.findByIdAndDelete(id);
}

// --- Dashboard ---

export async function getDashboardSummary(access = {}) {
  const bdm = access?.bdmFilter ?? {};
  const scFilter = mergeMongoFilters({}, bdm);
  const leadFilter = mergeMongoFilters({}, bdm);
  const actFilter = mergeMongoFilters({}, bdm);

  const today = startOfToday();
  const in7Days = new Date(today.getTime() + 7 * MS_PER_DAY);
  const last7 = new Date(today.getTime() - 7 * MS_PER_DAY);
  const last30 = new Date(today.getTime() - 30 * MS_PER_DAY);

  const [
    totalScs,
    totalLeads,
    leadsByStatus,
    scFollowUpOverdue,
    scFollowUpDue7,
    activityNextActionOverdue,
    activityDue7,
    activitiesLast7,
    activitiesLast30,
    scByRelationship,
  ] = await Promise.all([
    CrmSupportCoordinator.countDocuments(scFilter),
    CrmLead.countDocuments(leadFilter),
    CrmLead.aggregate([{ $match: leadFilter }, { $group: { _id: '$status', count: { $sum: 1 } } }]),
    CrmSupportCoordinator.countDocuments({
      ...scFilter,
      nextFollowUpDate: { $ne: null, $lt: today },
    }),
    CrmSupportCoordinator.countDocuments({
      ...scFilter,
      nextFollowUpDate: { $gte: today, $lte: in7Days },
    }),
    CrmMarketingActivity.countDocuments({
      ...actFilter,
      nextActionDate: { $ne: null, $lt: today },
    }),
    CrmMarketingActivity.countDocuments({
      ...actFilter,
      nextActionDate: { $gte: today, $lte: in7Days },
    }),
    CrmMarketingActivity.countDocuments({ ...actFilter, date: { $gte: last7 } }),
    CrmMarketingActivity.countDocuments({ ...actFilter, date: { $gte: last30 } }),
    CrmSupportCoordinator.aggregate([
      { $match: scFilter },
      { $group: { _id: '$relationshipStatus', count: { $sum: 1 } } },
    ]),
  ]);

  const leadStatusCounts = Object.fromEntries(LEAD_STATUSES.map((s) => [s, 0]));
  for (const row of leadsByStatus) {
    if (row._id) leadStatusCounts[row._id] = row.count;
  }

  const relationshipCounts = Object.fromEntries(RELATIONSHIP_STATUSES.map((s) => [s, 0]));
  for (const row of scByRelationship) {
    if (row._id) relationshipCounts[row._id] = row.count;
  }

  return {
    keyMetrics: {
      totalSupportCoordinators: totalScs,
      totalLeads,
      leadsNew: leadStatusCounts.New ?? 0,
      leadsActive: leadStatusCounts.Active ?? 0,
      leadsConverted: leadStatusCounts.Converted ?? 0,
      leadsLost: leadStatusCounts.Lost ?? 0,
    },
    followUps: {
      scFollowUpsOverdue: scFollowUpOverdue,
      scFollowUpsDue7Days: scFollowUpDue7,
      activitiesNextActionOverdue: activityNextActionOverdue,
      activitiesDue7Days: activityDue7,
    },
    activitySummary: {
      activitiesLast7Days: activitiesLast7,
      activitiesLast30Days: activitiesLast30,
    },
    relationshipStatus: relationshipCounts,
  };
}

// --- Import / Export ---

export async function importWorkbook(buffer, access) {
  const sheets = parseWorkbookBuffer(buffer);
  const ownerOnInsert = access?.userId ? { bdmOwnerId: access.userId } : {};
  const results = {
    supportCoordinators: { upserted: 0, skipped: 0 },
    leads: { upserted: 0, skipped: 0 },
    marketingActivities: { upserted: 0, skipped: 0 },
    staffingRequirements: { upserted: 0, skipped: 0 },
  };

  for (const row of sheets.supportCoordinators) {
    const parsed = parseSupportCoordinatorRow(row);
    if (!parsed) {
      results.supportCoordinators.skipped += 1;
      continue;
    }
    await CrmSupportCoordinator.findOneAndUpdate(
      { scId: parsed.scId },
      { $set: parsed, $setOnInsert: ownerOnInsert },
      { upsert: true, runValidators: true }
    );
    results.supportCoordinators.upserted += 1;
  }

  for (const row of sheets.leads) {
    const parsed = parseLeadRow(row);
    if (!parsed) {
      results.leads.skipped += 1;
      continue;
    }
    await CrmLead.findOneAndUpdate(
      { leadId: parsed.leadId },
      { $set: parsed, $setOnInsert: ownerOnInsert },
      { upsert: true, runValidators: true }
    );
    results.leads.upserted += 1;
  }

  for (const row of sheets.marketingActivities) {
    const parsed = parseMarketingActivityRow(row);
    if (!parsed) {
      results.marketingActivities.skipped += 1;
      continue;
    }
    await CrmMarketingActivity.findOneAndUpdate(
      { activityId: parsed.activityId },
      { $set: parsed, $setOnInsert: ownerOnInsert },
      { upsert: true, runValidators: true }
    );
    results.marketingActivities.upserted += 1;
  }

  for (const row of sheets.staffingRequirements) {
    const parsed = parseStaffingRequirementRow(row);
    if (!parsed) {
      results.staffingRequirements.skipped += 1;
      continue;
    }
    const filter = {
      participant: parsed.participant,
      dueDate: parsed.dueDate ?? null,
    };
    await CrmStaffingRequirement.findOneAndUpdate(
      filter,
      { $set: parsed, $setOnInsert: ownerOnInsert },
      { upsert: true, runValidators: true }
    );
    results.staffingRequirements.upserted += 1;
  }

  return results;
}

export async function exportWorkbook(access = {}) {
  const bdm = access?.bdmFilter ?? {};
  const scFilter = mergeMongoFilters({}, bdm);
  const leadFilter = mergeMongoFilters({}, bdm);
  const actFilter = mergeMongoFilters({}, bdm);
  const staffFilter = mergeMongoFilters({}, bdm);

  const [scs, leads, activities, staffing] = await Promise.all([
    CrmSupportCoordinator.find(scFilter).sort({ scId: 1 }).lean(),
    CrmLead.find(leadFilter).sort({ leadId: 1 }).lean(),
    CrmMarketingActivity.find(actFilter).sort({ activityId: 1 }).lean(),
    CrmStaffingRequirement.find(staffFilter).sort({ participant: 1 }).lean(),
  ]);

  const enrichedLeads = enrichLeads(leads);

  const workbook = XLSX.utils.book_new();

  const scSheet = XLSX.utils.aoa_to_sheet([
    SUPPORT_COORDINATOR_EXPORT_HEADERS,
    ...scs.map(supportCoordinatorToExportRow),
  ]);
  XLSX.utils.book_append_sheet(workbook, scSheet, CRM_SHEETS.SUPPORT_COORDINATORS);

  const leadSheet = XLSX.utils.aoa_to_sheet([
    LEAD_EXPORT_HEADERS,
    ...enrichedLeads.map(leadToExportRow),
  ]);
  XLSX.utils.book_append_sheet(workbook, leadSheet, CRM_SHEETS.POTENTIAL_LEADS);

  const activitySheet = XLSX.utils.aoa_to_sheet([
    MARKETING_ACTIVITY_EXPORT_HEADERS,
    ...activities.map(marketingActivityToExportRow),
  ]);
  XLSX.utils.book_append_sheet(workbook, activitySheet, CRM_SHEETS.MARKETING_ACTIVITIES);

  const staffingSheet = XLSX.utils.aoa_to_sheet([
    STAFFING_REQUIREMENT_EXPORT_HEADERS,
    ...staffing.map(staffingRequirementToExportRow),
  ]);
  XLSX.utils.book_append_sheet(workbook, staffingSheet, CRM_SHEETS.STAFFING_REQUIREMENTS);

  const body = XLSX.write(workbook, { type: 'buffer', bookType: 'xlsx' });
  return {
    filename: 'bdm-master-tracker.xlsx',
    body,
    contentType: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  };
}
