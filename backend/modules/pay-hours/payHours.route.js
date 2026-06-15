import express from 'express';
import { authenticateJWT, authorizePermission } from '../../middlewares/auth.middleware.js';
import {
  computePayHours,
  getJobStatus,
  listPayHours,
  listShiftCosts,
  getShiftPayHours,
  patchPayHoursManual,
  clearPayHoursManual,
  patchShiftPayHoursManual,
  clearShiftPayHoursManual,
  exportPayHoursCsv,
  runPayHoursEngineTests,
} from './payHours.controller.js';
import { PERMISSIONS } from '../../config/permissionCatalog.js';

const router = express.Router();

const authAll = [authenticateJWT];
const authPayHours = [
  authenticateJWT,
  authorizePermission(
    PERMISSIONS.WORKFORCE_VIEW,
    PERMISSIONS.PAY_HOURS_TESTS_VIEW,
    PERMISSIONS.ROSTER_SHIFT_LOG_VIEW
  ),
];

router.post('/pay-hours/compute', ...authPayHours, computePayHours);
router.post('/pay-hours/tests/run', ...authPayHours, runPayHoursEngineTests);
router.get('/pay-hours/jobs/:id/status', ...authPayHours, getJobStatus);
router.get('/pay-hours/export', ...authPayHours, exportPayHoursCsv);
router.patch('/pay-hours/:id', ...authPayHours, patchPayHoursManual);
router.delete('/pay-hours/:id/manual', ...authPayHours, clearPayHoursManual);
router.patch('/pay-hours/:id/shifts/:shiftPayHoursId', ...authPayHours, patchShiftPayHoursManual);
router.delete('/pay-hours/:id/shifts/:shiftPayHoursId/manual', ...authPayHours, clearShiftPayHoursManual);
router.get('/pay-hours/shift-costs', ...authAll, listShiftCosts);
router.get('/pay-hours/:id/shifts', ...authAll, getShiftPayHours);
router.get('/pay-hours', ...authAll, listPayHours);

export default router;
