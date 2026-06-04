import express from 'express';
import { authenticateJWT, authorizePermission } from '../../middlewares/auth.middleware.js';
import { listLocations, createLocation, deleteLocation, loadHolidayFixture } from './location.controller.js';
import { PERMISSIONS } from '../../config/permissionCatalog.js';

const router = express.Router();

const authAll = [authenticateJWT];
const authWrite = [
  authenticateJWT,
  authorizePermission(
    PERMISSIONS.WORKFORCE_VIEW,
    PERMISSIONS.ROSTER_VIEW,
    PERMISSIONS.ROSTER_SHIFT_LOG_VIEW
  ),
];

router.get('/locations', ...authAll, listLocations);
router.post('/locations', ...authWrite, createLocation);
router.delete('/locations/:id', ...authWrite, deleteLocation);
router.post('/locations/:id/load-holidays', ...authWrite, loadHolidayFixture);

export default router;
