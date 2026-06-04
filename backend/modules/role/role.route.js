import express from 'express';
import { authenticateJWT, authorizePermission } from '../../middlewares/auth.middleware.js';
import { validate } from '../../middlewares/validate.middleware.js';
import {
  createRoleSchema,
  updateRoleSchema,
  deleteRoleSchema,
  getRoleSchema,
} from '../../validators/role.validator.js';
import {
  listRoles,
  getRole,
  createRole,
  updateRole,
  deleteRole,
} from './role.controller.js';
import { PERMISSIONS } from '../../config/permissionCatalog.js';

const router = express.Router();

router.use(authenticateJWT);

router.get('/', authorizePermission(PERMISSIONS.ROLES_MANAGE, PERMISSIONS.USERS_MANAGE), listRoles);
router.get(
  '/:id',
  authorizePermission(PERMISSIONS.ROLES_MANAGE),
  validate(getRoleSchema),
  getRole
);
router.post(
  '/',
  authorizePermission(PERMISSIONS.ROLES_MANAGE),
  validate(createRoleSchema),
  createRole
);
router.put(
  '/:id',
  authorizePermission(PERMISSIONS.ROLES_MANAGE),
  validate(updateRoleSchema),
  updateRole
);
router.delete(
  '/:id',
  authorizePermission(PERMISSIONS.ROLES_MANAGE),
  validate(deleteRoleSchema),
  deleteRole
);

export default router;
