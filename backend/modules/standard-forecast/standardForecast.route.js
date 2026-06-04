import express from 'express';
import { authenticateJWT, authorizePermission } from '../../middlewares/auth.middleware.js';
import { PERMISSIONS } from '../../config/permissionCatalog.js';
import { tabularUpload } from '../../middlewares/tabularUpload.middleware.js';
import {
  getDirectory,
  getStandardExport,
  getStandardList,
  getSummary,
  getSummaryExportCsv,
  getSummaryExportPdf,
  getVarianceDetail,
  getVarianceExport,
  getVarianceList,
  deleteStandardRow,
  postStandardCreate,
  postStandardUpload,
  putStandardUpdate,
} from './standardForecast.controller.js';

const router = express.Router();

const authFinance = [authenticateJWT, authorizePermission(PERMISSIONS.FORECAST_ANALYSIS_VIEW)];

router.get('/standard-forecast/directory', ...authFinance, getDirectory);

router.post('/standard-forecast/standard/upload', ...authFinance, tabularUpload.single('file'), postStandardUpload);
router.post('/standard-forecast/standard', ...authFinance, postStandardCreate);
router.put('/standard-forecast/standard/:id', ...authFinance, putStandardUpdate);
router.delete('/standard-forecast/standard/:id', ...authFinance, deleteStandardRow);
router.get('/standard-forecast/standard', ...authFinance, getStandardList);
router.get('/standard-forecast/standard/export', ...authFinance, getStandardExport);

router.get('/standard-forecast/summary', ...authFinance, getSummary);
router.get('/standard-forecast/summary/export.csv', ...authFinance, getSummaryExportCsv);
router.get('/standard-forecast/summary/export.pdf', ...authFinance, getSummaryExportPdf);

router.get('/standard-forecast/variance', ...authFinance, getVarianceList);
router.get('/standard-forecast/variance/export.csv', ...authFinance, getVarianceExport);
router.get('/standard-forecast/variance/detail', ...authFinance, getVarianceDetail);

export default router;
