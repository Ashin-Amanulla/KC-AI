import express from 'express';
import fs from 'fs';
import multer from 'multer';
import { config } from '../../config/index.js';
import { authenticateJWT, authorizeRoles } from '../../middlewares/auth.middleware.js';
import {
  financeRoles,
  getActualsExport,
  getActualsList,
  getDirectory,
  getForecastExport,
  getForecastList,
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
const uploadDir = 'uploads';

if (!fs.existsSync(uploadDir)) {
  fs.mkdirSync(uploadDir, { recursive: true, mode: 0o755 });
}

const storage = multer.diskStorage({
  destination: (req, file, cb) => cb(null, uploadDir),
  filename: (req, file, cb) => cb(null, `${Date.now()}-${file.originalname}`),
});

const csvFileFilter = (req, file, cb) => {
  const allowedMimes = ['text/csv', 'application/csv', 'text/plain'];
  const hasValidMime = allowedMimes.includes(file.mimetype);
  const hasValidExt = /\.csv$/i.test(file.originalname);
  if (hasValidMime || hasValidExt) {
    cb(null, true);
  } else {
    cb(new Error('Only CSV files are allowed'), false);
  }
};

const upload = multer({
  storage,
  fileFilter: csvFileFilter,
  limits: { fileSize: config.upload.maxFileSizeBytes },
});

const authFinance = [authenticateJWT, authorizeRoles(...financeRoles)];

router.get('/forecast-actuals/directory', ...authFinance, getDirectory);

router.post('/forecast-actuals/forecast/upload', ...authFinance, upload.single('file'), postForecastUpload);
router.post('/forecast-actuals/actuals/upload', ...authFinance, upload.single('file'), postActualsUpload);

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
