import { Role } from './role.model.js';
import { User } from '../user/user.model.js';
import {
  ALL_PERMISSION_KEYS,
  ADMIN_PERMISSIONS,
  PERMISSION_CATALOG,
} from '../../config/permissionCatalog.js';

const slugify = (name) =>
  name
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, '_')
    .replace(/^_|_$/g, '');

export const getCatalog = () => PERMISSION_CATALOG;

export const listRoles = async () => {
  const roles = await Role.find({}).sort({ isSystem: -1, name: 1 }).lean();
  const counts = await User.aggregate([
    { $match: { isActive: { $ne: false } } },
    { $group: { _id: '$role', count: { $sum: 1 } } },
  ]);
  const countBySlug = Object.fromEntries(counts.map((c) => [c._id, c.count]));

  return roles.map((r) => ({
    ...r,
    userCount: countBySlug[r.slug] ?? 0,
  }));
};

export const getRoleById = async (id) => {
  const role = await Role.findById(id).lean();
  if (!role) return null;
  const userCount = await User.countDocuments({ role: role.slug, isActive: { $ne: false } });
  return { ...role, userCount };
};

const countRolesWithAdminPerms = async (excludeId = null) => {
  const query = { isActive: true, permissions: { $in: ADMIN_PERMISSIONS } };
  if (excludeId) query._id = { $ne: excludeId };
  return Role.countDocuments(query);
};

export const assertAdminPermissionsRetained = async (permissions, roleId = null) => {
  const hasUsersManage = permissions.includes('users:manage');
  const hasRolesManage = permissions.includes('roles:manage');
  const adminCount = await countRolesWithAdminPerms(roleId);

  if (!hasUsersManage && !hasRolesManage) {
    if (adminCount === 0) {
      throw new Error('At least one active role must have user or role management permissions');
    }
    return;
  }

  if (roleId) {
    const others = await countRolesWithAdminPerms(roleId);
    if (others === 0 && (!hasUsersManage || !hasRolesManage)) {
      const current = await Role.findById(roleId).lean();
      const hadUsers = current?.permissions?.includes('users:manage');
      const hadRoles = current?.permissions?.includes('roles:manage');
      if (hadUsers && !hasUsersManage) {
        throw new Error('Cannot remove user management from the last admin-capable role');
      }
      if (hadRoles && !hasRolesManage) {
        throw new Error('Cannot remove role management from the last admin-capable role');
      }
    }
  }
};

export const createRole = async ({ name, description, permissions }) => {
  if (!permissions?.length) {
    throw new Error('Role must have at least one permission');
  }

  const invalid = permissions.filter((p) => !ALL_PERMISSION_KEYS.includes(p));
  if (invalid.length) {
    throw new Error(`Invalid permissions: ${invalid.join(', ')}`);
  }

  await assertAdminPermissionsRetained(permissions);

  let slug = slugify(name);
  if (!slug) throw new Error('Invalid role name');

  const existing = await Role.findOne({ slug });
  if (existing) {
    slug = `${slug}_${Date.now().toString(36)}`;
  }

  const role = await Role.create({
    slug,
    name: name.trim(),
    description: description?.trim() ?? '',
    permissions,
    isSystem: false,
    isActive: true,
  });

  return role.toObject();
};

export const updateRole = async (id, { name, description, permissions }) => {
  const role = await Role.findById(id);
  if (!role) throw new Error('Role not found');

  if (name !== undefined) role.name = name.trim();
  if (description !== undefined) role.description = description.trim();

  if (permissions !== undefined) {
    if (!permissions.length) {
      throw new Error('Role must have at least one permission');
    }
    const invalid = permissions.filter((p) => !ALL_PERMISSION_KEYS.includes(p));
    if (invalid.length) {
      throw new Error(`Invalid permissions: ${invalid.join(', ')}`);
    }
    await assertAdminPermissionsRetained(permissions, id);
    role.permissions = permissions;
  }

  await role.save();
  return role.toObject();
};

export const deactivateRole = async (id) => {
  const role = await Role.findById(id);
  if (!role) throw new Error('Role not found');
  if (role.isSystem) throw new Error('System roles cannot be deactivated');

  const userCount = await User.countDocuments({
    role: role.slug,
    $or: [{ isActive: true }, { isActive: { $exists: false } }],
  });
  if (userCount > 0) {
    throw new Error(`Cannot deactivate role: ${userCount} active user(s) still assigned`);
  }

  role.isActive = false;
  await role.save();
  return role.toObject();
};

export const getActiveRoleBySlug = async (slug) => {
  return Role.findOne({ slug, isActive: true }).lean();
};

export const getActiveRoleSlugs = async () => {
  const roles = await Role.find({ isActive: true }).select('slug').lean();
  return roles.map((r) => r.slug);
};
