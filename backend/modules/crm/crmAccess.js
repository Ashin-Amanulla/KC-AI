import mongoose from 'mongoose';
import { PERMISSIONS } from '../../config/permissionCatalog.js';
import { User } from '../user/user.model.js';
import { CrmLead } from './crmLead.model.js';
import { CrmSupportCoordinator } from './crmSupportCoordinator.model.js';
import { CrmMarketingActivity } from './crmMarketingActivity.model.js';
import { CrmStaffingRequirement } from './crmStaffingRequirement.model.js';

export function canViewAllCrm(permissions = []) {
  return (
    permissions.includes(PERMISSIONS.CRM_VIEW_ALL) ||
    permissions.includes(PERMISSIONS.USERS_MANAGE)
  );
}

export function resolveCrmAccess(req, queryBdmOwnerId) {
  const permissions = req.rolePermissions ?? [];
  const userId = req.user?.userId ? String(req.user.userId) : null;
  const viewAll = canViewAllCrm(permissions);

  if (!viewAll) {
    return { viewAll: false, userId, bdmFilter: userId ? { bdmOwnerId: userId } : { bdmOwnerId: '__none__' } };
  }

  const raw = String(queryBdmOwnerId ?? '').trim();
  if (!raw || raw === 'all') {
    return { viewAll: true, userId, bdmFilter: {} };
  }
  if (raw === 'unassigned') {
    return { viewAll: true, userId, bdmFilter: { bdmOwnerId: null } };
  }
  if (!mongoose.Types.ObjectId.isValid(raw)) {
    return { viewAll: true, userId, bdmFilter: {} };
  }
  return { viewAll: true, userId, bdmFilter: { bdmOwnerId: raw } };
}

export function mergeMongoFilters(base, bdmFilter) {
  if (!bdmFilter || Object.keys(bdmFilter).length === 0) return base;
  if (bdmFilter.bdmOwnerId === '__none__') {
    return { ...base, bdmOwnerId: { $exists: false } };
  }
  return { ...base, ...bdmFilter };
}

export function assertCanMutateRecord(doc, access) {
  if (!doc) return;
  if (access.viewAll) return;
  if (String(doc.bdmOwnerId ?? '') !== String(access.userId ?? '')) {
    const err = new Error('Forbidden: this record belongs to another BDM');
    err.status = 403;
    throw err;
  }
}

export function withBdmOwnerOnCreate(data, access) {
  const body = { ...data };
  if (!body.bdmOwnerId && access.userId) {
    body.bdmOwnerId = access.userId;
  }
  return body;
}

export async function listBdmOwners() {
  const [leadIds, scIds, actIds, staffIds] = await Promise.all([
    CrmLead.distinct('bdmOwnerId'),
    CrmSupportCoordinator.distinct('bdmOwnerId'),
    CrmMarketingActivity.distinct('bdmOwnerId'),
    CrmStaffingRequirement.distinct('bdmOwnerId'),
  ]);
  const idSet = new Set(
    [...leadIds, ...scIds, ...actIds, ...staffIds]
      .filter(Boolean)
      .map((id) => String(id))
  );
  if (idSet.size === 0) return [];
  const users = await User.find({ _id: { $in: [...idSet] } })
    .select('name email')
    .sort({ name: 1 })
    .lean();
  return users.map((u) => ({
    id: String(u._id),
    name: u.name,
    email: u.email,
  }));
}
