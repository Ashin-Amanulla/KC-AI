import express from 'express';
import { authenticateJWT, authorizePermission } from '../../middlewares/auth.middleware.js';
import { PERMISSIONS } from '../../config/permissionCatalog.js';
import { tabularUpload } from '../../middlewares/tabularUpload.middleware.js';
import {
  getNextCirId,
  listCirRecords,
  createCirRecord,
  updateCirRecord,
  deleteCirRecord,
  postActionUpdate,
  importCirWorkbook,
  exportCirWorkbook,
} from './cir.controller.js';

const router = express.Router();

const authView = [authenticateJWT, authorizePermission(PERMISSIONS.CIR_VIEW)];
const authManage = [authenticateJWT, authorizePermission(PERMISSIONS.CIR_MANAGE)];

router.get('/cir/next-id', ...authView, getNextCirId);
router.get('/cir', ...authView, listCirRecords);
router.post('/cir', ...authManage, createCirRecord);
router.put('/cir/:id', ...authManage, updateCirRecord);
router.delete('/cir/:id', ...authManage, deleteCirRecord);
router.post('/cir/:id/action-updates', ...authManage, postActionUpdate);
router.post('/cir/import', ...authManage, tabularUpload.single('file'), importCirWorkbook);
router.get('/cir/export', ...authView, exportCirWorkbook);

export default router;
