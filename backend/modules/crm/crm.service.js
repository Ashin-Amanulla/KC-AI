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

// --- Support Coordinators ---

export async function listSupportCoordinators({ search } = {}) {
  const filter = buildSearchFilter(search, [
    'scId',
    'coordinatorName',
    'organisation',
    'email',
    'location',
  ]);
  return CrmSupportCoordinator.find(filter).sort({ scId: 1 }).lean();
}

export async function createSupportCoordinator(data) {
  return CrmSupportCoordinator.create(data);
}

export async function updateSupportCoordinator(id, data) {
  return CrmSupportCoordinator.findByIdAndUpdate(id, data, { new: true, runValidators: true }).lean();
}

export async function deleteSupportCoordinator(id) {
  return CrmSupportCoordinator.findByIdAndDelete(id);
}

// --- Leads ---

export async function listLeads({ search, status } = {}) {
  const filter = buildSearchFilter(search, ['leadId', 'name', 'referralSource', 'referralEmail']);
  if (status) filter.status = status;
  return CrmLead.find(filter).sort({ leadId: 1 }).lean();
}

export async function createLead(data) {
  return CrmLead.create(data);
}

export async function updateLead(id, data) {
  return CrmLead.findByIdAndUpdate(id, data, { new: true, runValidators: true }).lean();
}

export async function deleteLead(id) {
  return CrmLead.findByIdAndDelete(id);
}

// --- Marketing Activities ---

export async function listMarketingActivities({ search } = {}) {
  const filter = buildSearchFilter(search, [
    'activityId',
    'activityType',
    'organisationName',
    'relatedScOrLeadId',
  ]);
  return CrmMarketingActivity.find(filter).sort({ date: -1, activityId: 1 }).lean();
}

export async function createMarketingActivity(data) {
  return CrmMarketingActivity.create(data);
}

export async function updateMarketingActivity(id, data) {
  return CrmMarketingActivity.findByIdAndUpdate(id, data, { new: true, runValidators: true }).lean();
}

export async function deleteMarketingActivity(id) {
  return CrmMarketingActivity.findByIdAndDelete(id);
}

// --- Staffing Requirements ---

export async function listStaffingRequirements({ search } = {}) {
  const filter = buildSearchFilter(search, ['participant', 'location', 'notes']);
  return CrmStaffingRequirement.find(filter).sort({ dueDate: 1, participant: 1 }).lean();
}

export async function createStaffingRequirement(data) {
  return CrmStaffingRequirement.create(data);
}

export async function updateStaffingRequirement(id, data) {
  return CrmStaffingRequirement.findByIdAndUpdate(id, data, { new: true, runValidators: true }).lean();
}

export async function deleteStaffingRequirement(id) {
  return CrmStaffingRequirement.findByIdAndDelete(id);
}

// --- Dashboard ---

export async function getDashboardSummary() {
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
    CrmSupportCoordinator.countDocuments(),
    CrmLead.countDocuments(),
    CrmLead.aggregate([{ $group: { _id: '$status', count: { $sum: 1 } } }]),
    CrmSupportCoordinator.countDocuments({
      nextFollowUpDate: { $ne: null, $lt: today },
    }),
    CrmSupportCoordinator.countDocuments({
      nextFollowUpDate: { $gte: today, $lte: in7Days },
    }),
    CrmMarketingActivity.countDocuments({
      nextActionDate: { $ne: null, $lt: today },
    }),
    CrmMarketingActivity.countDocuments({
      nextActionDate: { $gte: today, $lte: in7Days },
    }),
    CrmMarketingActivity.countDocuments({ date: { $gte: last7 } }),
    CrmMarketingActivity.countDocuments({ date: { $gte: last30 } }),
    CrmSupportCoordinator.aggregate([{ $group: { _id: '$relationshipStatus', count: { $sum: 1 } } }]),
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

export async function importWorkbook(buffer) {
  const sheets = parseWorkbookBuffer(buffer);
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
      { $set: parsed },
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
      { $set: parsed },
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
      { $set: parsed },
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
      { $set: parsed },
      { upsert: true, runValidators: true }
    );
    results.staffingRequirements.upserted += 1;
  }

  return results;
}

export async function exportWorkbook() {
  const [scs, leads, activities, staffing] = await Promise.all([
    CrmSupportCoordinator.find().sort({ scId: 1 }).lean(),
    CrmLead.find().sort({ leadId: 1 }).lean(),
    CrmMarketingActivity.find().sort({ activityId: 1 }).lean(),
    CrmStaffingRequirement.find().sort({ participant: 1 }).lean(),
  ]);

  const workbook = XLSX.utils.book_new();

  const scSheet = XLSX.utils.aoa_to_sheet([
    SUPPORT_COORDINATOR_EXPORT_HEADERS,
    ...scs.map(supportCoordinatorToExportRow),
  ]);
  XLSX.utils.book_append_sheet(workbook, scSheet, CRM_SHEETS.SUPPORT_COORDINATORS);

  const leadSheet = XLSX.utils.aoa_to_sheet([
    LEAD_EXPORT_HEADERS,
    ...leads.map(leadToExportRow),
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
