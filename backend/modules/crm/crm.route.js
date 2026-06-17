import express from 'express';
import { authenticateJWT, authorizePermission } from '../../middlewares/auth.middleware.js';
import { PERMISSIONS } from '../../config/permissionCatalog.js';
import { tabularUpload } from '../../middlewares/tabularUpload.middleware.js';
import {
  getDashboard,
  listSupportCoordinators,
  createSupportCoordinator,
  updateSupportCoordinator,
  deleteSupportCoordinator,
  listLeads,
  createLead,
  updateLead,
  deleteLead,
  listMarketingActivities,
  createMarketingActivity,
  updateMarketingActivity,
  deleteMarketingActivity,
  listStaffingRequirements,
  createStaffingRequirement,
  updateStaffingRequirement,
  deleteStaffingRequirement,
  importCrmWorkbook,
  exportCrmWorkbook,
  getNextId,
} from './crm.controller.js';

const router = express.Router();

const authView = [authenticateJWT, authorizePermission(PERMISSIONS.CRM_VIEW)];
const authManage = [authenticateJWT, authorizePermission(PERMISSIONS.CRM_MANAGE)];

router.get('/crm/dashboard', ...authView, getDashboard);

router.get('/crm/next-id/:entity', ...authView, getNextId);

router.get('/crm/support-coordinators', ...authView, listSupportCoordinators);
router.post('/crm/support-coordinators', ...authManage, createSupportCoordinator);
router.put('/crm/support-coordinators/:id', ...authManage, updateSupportCoordinator);
router.delete('/crm/support-coordinators/:id', ...authManage, deleteSupportCoordinator);

router.get('/crm/leads', ...authView, listLeads);
router.post('/crm/leads', ...authManage, createLead);
router.put('/crm/leads/:id', ...authManage, updateLead);
router.delete('/crm/leads/:id', ...authManage, deleteLead);

router.get('/crm/marketing-activities', ...authView, listMarketingActivities);
router.post('/crm/marketing-activities', ...authManage, createMarketingActivity);
router.put('/crm/marketing-activities/:id', ...authManage, updateMarketingActivity);
router.delete('/crm/marketing-activities/:id', ...authManage, deleteMarketingActivity);

router.get('/crm/staffing-requirements', ...authView, listStaffingRequirements);
router.post('/crm/staffing-requirements', ...authManage, createStaffingRequirement);
router.put('/crm/staffing-requirements/:id', ...authManage, updateStaffingRequirement);
router.delete('/crm/staffing-requirements/:id', ...authManage, deleteStaffingRequirement);

router.post('/crm/import', ...authManage, tabularUpload.single('file'), importCrmWorkbook);
router.get('/crm/export', ...authView, exportCrmWorkbook);

export default router;
