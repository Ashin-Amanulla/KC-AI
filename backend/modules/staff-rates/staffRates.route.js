import express from 'express';
import { authenticateJWT, authorizePermission } from '../../middlewares/auth.middleware.js';
import { listStaffRates, upsertStaffRate, deleteStaffRate, bulkUpsertStaffRates } from './staffRates.controller.js';
import { PERMISSIONS } from '../../config/permissionCatalog.js';

const router = express.Router();

const readPerms = [
  PERMISSIONS.STAFF_VIEW,
  PERMISSIONS.WORKFORCE_VIEW,
  PERMISSIONS.ROSTER_VIEW,
  PERMISSIONS.ROSTER_SHIFT_LOG_VIEW,
];

router.get('/staff-rates', authenticateJWT, authorizePermission(...readPerms), listStaffRates);
router.put('/staff-rates', authenticateJWT, authorizePermission(PERMISSIONS.WORKFORCE_VIEW), upsertStaffRate);
router.post(
  '/staff-rates/bulk',
  authenticateJWT,
  authorizePermission(PERMISSIONS.WORKFORCE_VIEW),
  bulkUpsertStaffRates
);
router.delete(
  '/staff-rates',
  authenticateJWT,
  authorizePermission(PERMISSIONS.WORKFORCE_VIEW),
  deleteStaffRate
);

export default router;
