import * as roleService from './role.service.js';
import { PERMISSION_CATALOG } from '../../config/permissionCatalog.js';
import { invalidate } from '../../utils/cache.js';

async function invalidateRoleCache() {
  await invalidate('role:*');
}

export const listRoles = async (req, res, next) => {
  try {
    const roles = await roleService.listRoles();
    res.json({ roles, catalog: PERMISSION_CATALOG });
  } catch (error) {
    next(error);
  }
};

export const getRole = async (req, res, next) => {
  try {
    const role = await roleService.getRoleById(req.params.id);
    if (!role) {
      return res.status(404).json({ error: 'Role not found' });
    }
    res.json({ role, catalog: PERMISSION_CATALOG });
  } catch (error) {
    next(error);
  }
};

export const createRole = async (req, res, next) => {
  try {
    const role = await roleService.createRole(req.body);
    await invalidateRoleCache();
    res.status(201).json({ role });
  } catch (error) {
    if (
      error.message?.includes('permission') ||
      error.message?.includes('Invalid') ||
      error.message?.includes('name')
    ) {
      return res.status(400).json({ error: error.message });
    }
    next(error);
  }
};

export const updateRole = async (req, res, next) => {
  try {
    const role = await roleService.updateRole(req.params.id, req.body);
    await invalidateRoleCache();
    res.json({ role });
  } catch (error) {
    if (error.message === 'Role not found') {
      return res.status(404).json({ error: error.message });
    }
    if (error.message?.includes('permission') || error.message?.includes('Invalid')) {
      return res.status(400).json({ error: error.message });
    }
    next(error);
  }
};

export const deleteRole = async (req, res, next) => {
  try {
    const role = await roleService.deactivateRole(req.params.id);
    await invalidateRoleCache();
    res.json({ message: 'Role deactivated', role });
  } catch (error) {
    if (error.message === 'Role not found') {
      return res.status(404).json({ error: error.message });
    }
    if (
      error.message?.includes('System roles') ||
      error.message?.includes('Cannot deactivate')
    ) {
      return res.status(400).json({ error: error.message });
    }
    next(error);
  }
};
