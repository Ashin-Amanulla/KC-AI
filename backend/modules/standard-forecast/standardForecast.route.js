import express from 'express';
import fs from 'fs';
import multer from 'multer';
import { config } from '../../config/index.js';
import { authenticateJWT, authorizeRoles } from '../../middlewares/auth.middleware.js';
import {
  financeRoles,
  getDirectory,
  getStandardExport,
  getStandardList,
  getSummary,
  getSummaryExportCsv,
  getSummaryExportPdf,
  getVarianceDetail,
  getVarianceList,
  deleteStandardRow,
  postStandardCreate,
  postStandardUpload,
  putStandardUpdate,
} from './standardForecast.controller.js';

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

router.get('/standard-forecast/directory', ...authFinance, getDirectory);

router.post('/standard-forecast/standard/upload', ...authFinance, upload.single('file'), postStandardUpload);
router.post('/standard-forecast/standard', ...authFinance, postStandardCreate);
router.put('/standard-forecast/standard/:id', ...authFinance, putStandardUpdate);
router.delete('/standard-forecast/standard/:id', ...authFinance, deleteStandardRow);
router.get('/standard-forecast/standard', ...authFinance, getStandardList);
router.get('/standard-forecast/standard/export', ...authFinance, getStandardExport);

router.get('/standard-forecast/summary', ...authFinance, getSummary);
router.get('/standard-forecast/summary/export.csv', ...authFinance, getSummaryExportCsv);
router.get('/standard-forecast/summary/export.pdf', ...authFinance, getSummaryExportPdf);

router.get('/standard-forecast/variance', ...authFinance, getVarianceList);
router.get('/standard-forecast/variance/detail', ...authFinance, getVarianceDetail);

export default router;
