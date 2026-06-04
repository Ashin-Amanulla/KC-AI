import express from 'express';
import { authenticateJWT, authorizePermission } from '../../middlewares/auth.middleware.js';
import { PERMISSIONS } from '../../config/permissionCatalog.js';
import { tabularUpload } from '../../middlewares/tabularUpload.middleware.js';
import {
  deleteActualsRow,
  deleteForecastRow,
  getActualsExport,
  getActualsList,
  getDirectory,
  getForecastExport,
  getForecastList,
  postActualsCreate,
  postForecastCreate,
  putActualsUpdate,
  putForecastUpdate,
  getSummaryExportCsv,
  getSummaryExportPdf,
  getSummaryHandler,
  getVarianceDetailHandler,
  getVarianceExport,
  getVarianceList,
  postActualsUpload,
  postForecastUpload,
} from './forecastActuals.controller.js';

const router = express.Router();

const authFinance = [authenticateJWT, authorizePermission(PERMISSIONS.FORECAST_ANALYSIS_VIEW)];

router.get('/forecast-actuals/directory', ...authFinance, getDirectory);

router.post('/forecast-actuals/forecast/upload', ...authFinance, tabularUpload.single('file'), postForecastUpload);
router.post('/forecast-actuals/actuals/upload', ...authFinance, tabularUpload.single('file'), postActualsUpload);
router.post('/forecast-actuals/forecast', ...authFinance, postForecastCreate);
router.put('/forecast-actuals/forecast/:id', ...authFinance, putForecastUpdate);
router.delete('/forecast-actuals/forecast/:id', ...authFinance, deleteForecastRow);
router.post('/forecast-actuals/actuals', ...authFinance, postActualsCreate);
router.put('/forecast-actuals/actuals/:id', ...authFinance, putActualsUpdate);
router.delete('/forecast-actuals/actuals/:id', ...authFinance, deleteActualsRow);

router.get('/forecast-actuals/forecast', ...authFinance, getForecastList);
router.get('/forecast-actuals/actuals', ...authFinance, getActualsList);
router.get('/forecast-actuals/summary', ...authFinance, getSummaryHandler);

router.get('/forecast-actuals/forecast/export', ...authFinance, getForecastExport);
router.get('/forecast-actuals/actuals/export', ...authFinance, getActualsExport);
router.get('/forecast-actuals/summary/export.csv', ...authFinance, getSummaryExportCsv);
router.get('/forecast-actuals/summary/export.pdf', ...authFinance, getSummaryExportPdf);

router.get('/forecast-actuals/variance', ...authFinance, getVarianceList);
router.get('/forecast-actuals/variance/export.csv', ...authFinance, getVarianceExport);
router.get('/forecast-actuals/variance/:shiftcareId/detail', ...authFinance, getVarianceDetailHandler);

export default router;
