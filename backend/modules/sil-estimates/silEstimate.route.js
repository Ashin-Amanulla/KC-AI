import express from 'express';
import { authenticateJWT, authorizePermission } from '../../middlewares/auth.middleware.js';
import { PERMISSIONS } from '../../config/permissionCatalog.js';
import {
  listSilEstimates,
  getSilEstimate,
  createSilEstimate,
  updateSilEstimate,
  deleteSilEstimate,
  duplicateSilEstimate,
} from './silEstimate.controller.js';

const router = express.Router();

const authView = [authenticateJWT, authorizePermission(PERMISSIONS.ESTIMATES_VIEW)];
const authManage = [authenticateJWT, authorizePermission(PERMISSIONS.ESTIMATES_MANAGE)];

router.get('/sil-estimates', ...authView, listSilEstimates);
router.get('/sil-estimates/:id', ...authView, getSilEstimate);
router.post('/sil-estimates', ...authManage, createSilEstimate);
router.put('/sil-estimates/:id', ...authManage, updateSilEstimate);
router.delete('/sil-estimates/:id', ...authManage, deleteSilEstimate);
router.post('/sil-estimates/:id/duplicate', ...authManage, duplicateSilEstimate);

export default router;
