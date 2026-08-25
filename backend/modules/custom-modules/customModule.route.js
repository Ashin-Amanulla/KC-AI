import express from 'express';
import { authenticateJWT, authorizePermission } from '../../middlewares/auth.middleware.js';
import { PERMISSIONS } from '../../config/permissionCatalog.js';
import {
  listModules,
  getModule,
  createModule,
  updateModule,
  deleteModule,
} from './customModule.controller.js';

const router = express.Router();

const authView = [authenticateJWT, authorizePermission(PERMISSIONS.CUSTOM_MODULES_VIEW)];
const authManage = [authenticateJWT, authorizePermission(PERMISSIONS.CUSTOM_MODULES_MANAGE)];

// Manager-only listing includes drafts; viewer listing is published-only.
router.get(
  '/custom-modules',
  authenticateJWT,
  authorizePermission(PERMISSIONS.CUSTOM_MODULES_VIEW, PERMISSIONS.CUSTOM_MODULES_MANAGE),
  (req, res, next) => {
    // authorizePermission stores matched role permissions; detect manage via a cheap second check
    req.canManageCustomModules = Array.isArray(req.rolePermissions)
      ? req.rolePermissions.includes(PERMISSIONS.CUSTOM_MODULES_MANAGE)
      : false;
    next();
  },
  listModules
);

// Published module source for rendering (view permission).
router.get('/custom-modules/slug/:slug', authView, getModule);

// Management endpoints.
router.post('/custom-modules', ...authManage, createModule);
router.put('/custom-modules/:id', ...authManage, updateModule);
router.delete('/custom-modules/:id', ...authManage, deleteModule);

export default router;
