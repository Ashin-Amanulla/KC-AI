import express from 'express';
import { authenticateJWT, authorizePermission } from '../../middlewares/auth.middleware.js';
import { getDashboardSummary } from './dashboard.controller.js';
import { PERMISSIONS } from '../../config/permissionCatalog.js';

const router = express.Router();

router.get(
  '/dashboard/summary',
  authenticateJWT,
  authorizePermission(PERMISSIONS.DASHBOARD_VIEW),
  getDashboardSummary
);

export default router;
