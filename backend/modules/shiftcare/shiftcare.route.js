import express from 'express';
import { requireAuth, authorizeRoles } from '../../middlewares/auth.middleware.js';
import { getShifts, getStaff, getClients, getTimesheets } from './shiftcare.controller.js';

const router = express.Router();

// All routes require authentication
router.use(requireAuth);

// Dashboard, staff, clients: super_admin + viewer
router.get('/shifts', authorizeRoles('super_admin', 'viewer'), getShifts);
router.get('/staff', authorizeRoles('super_admin', 'viewer'), getStaff);
router.get('/clients', authorizeRoles('super_admin', 'viewer'), getClients);
// Timesheets: super_admin + finance
router.get('/timesheets', authorizeRoles('super_admin', 'finance'), getTimesheets);

export default router;
