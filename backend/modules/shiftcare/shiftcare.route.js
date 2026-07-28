import express from 'express';
import { requireAuth, authorizePermission } from '../../middlewares/auth.middleware.js';
import {
  getShifts,
  getStaff,
  getClients,
  getTimesheets,
  getKpis,
  getProgressNotes,
  getClientFunds,
  getClientFundBalance,
  getInvoices,
  getInvoice,
  getLeaves,
  getStaffQualifications,
  getStaffFiles,
  getQualifications,
  getQualificationCategories,
  getWebhookSubscriptions,
  getWebhookEventTypes,
  getFundsDashboard,
  getComplianceDashboard,
} from './shiftcare.controller.js';
import { PERMISSIONS } from '../../config/permissionCatalog.js';

const router = express.Router();

router.use(requireAuth);

router.get('/kpis', authorizePermission(PERMISSIONS.TIMESHEETS_VIEW), getKpis);

router.get('/shifts', authorizePermission(PERMISSIONS.STAFF_VIEW), getShifts);
router.get('/staff', authorizePermission(PERMISSIONS.STAFF_VIEW), getStaff);
router.get('/clients', authorizePermission(PERMISSIONS.CLIENTS_VIEW), getClients);
router.get('/timesheets', authorizePermission(PERMISSIONS.TIMESHEETS_VIEW), getTimesheets);

router.get('/progress-notes', authorizePermission(PERMISSIONS.SHIFT_ANALYSIS_VIEW), getProgressNotes);

router.get('/clients/:clientId/funds', authorizePermission(PERMISSIONS.CLIENTS_VIEW), getClientFunds);
router.get(
  '/clients/:clientId/funds/:fundId/balance',
  authorizePermission(PERMISSIONS.CLIENTS_VIEW),
  getClientFundBalance
);
router.get('/funds-dashboard', authorizePermission(PERMISSIONS.CLIENTS_VIEW), getFundsDashboard);

router.get('/invoices', authorizePermission(PERMISSIONS.FORECAST_ANALYSIS_VIEW), getInvoices);
router.get('/invoices/:id', authorizePermission(PERMISSIONS.FORECAST_ANALYSIS_VIEW), getInvoice);

router.get('/leaves', authorizePermission(PERMISSIONS.STAFF_VIEW), getLeaves);
router.get(
  '/staff/:staffId/qualifications',
  authorizePermission(PERMISSIONS.STAFF_VIEW),
  getStaffQualifications
);
router.get('/staff-files', authorizePermission(PERMISSIONS.STAFF_VIEW), getStaffFiles);
router.get('/qualifications', authorizePermission(PERMISSIONS.STAFF_VIEW), getQualifications);
router.get(
  '/qualification-categories',
  authorizePermission(PERMISSIONS.STAFF_VIEW),
  getQualificationCategories
);
router.get('/compliance-dashboard', authorizePermission(PERMISSIONS.STAFF_VIEW), getComplianceDashboard);

router.get('/webhooks/subscriptions', authorizePermission(PERMISSIONS.USERS_MANAGE), getWebhookSubscriptions);
router.get('/webhooks/event-types', authorizePermission(PERMISSIONS.USERS_MANAGE), getWebhookEventTypes);

export default router;
