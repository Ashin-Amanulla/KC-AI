import express from 'express';
import { requireAuth, authorizePermission } from '../../middlewares/auth.middleware.js';
import { getShifts, getStaff, getClients, getTimesheets } from './shiftcare.controller.js';
import { PERMISSIONS } from '../../config/permissionCatalog.js';

const router = express.Router();

router.use(requireAuth);

router.get('/shifts', authorizePermission(PERMISSIONS.STAFF_VIEW), getShifts);
router.get('/staff', authorizePermission(PERMISSIONS.STAFF_VIEW), getStaff);
router.get('/clients', authorizePermission(PERMISSIONS.CLIENTS_VIEW), getClients);
router.get('/timesheets', authorizePermission(PERMISSIONS.TIMESHEETS_VIEW), getTimesheets);

export default router;
