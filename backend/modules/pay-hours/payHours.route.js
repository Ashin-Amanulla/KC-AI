import express from 'express';
import { authenticateJWT, authorizeRoles } from '../../middlewares/auth.middleware.js';
import {
  computePayHours,
  getJobStatus,
  listPayHours,
  getShiftPayHours,
  exportPayHoursCsv,
  runPayHoursEngineTests,
} from './payHours.controller.js';

const router = express.Router();

const authAll = [authenticateJWT];
const authFinance = [authenticateJWT, authorizeRoles('super_admin', 'finance', 'viewer', 'shifts_viewer')];

router.post('/pay-hours/compute', ...authFinance, computePayHours);
router.post('/pay-hours/tests/run', ...authFinance, runPayHoursEngineTests);
router.get('/pay-hours/jobs/:id/status', ...authFinance, getJobStatus);
router.get('/pay-hours/export', ...authFinance, exportPayHoursCsv);
router.get('/pay-hours/:id/shifts', ...authAll, getShiftPayHours);
router.get('/pay-hours', ...authAll, listPayHours);

export default router;
