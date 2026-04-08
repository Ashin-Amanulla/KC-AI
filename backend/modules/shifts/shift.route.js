import express from 'express';
import fs from 'fs';
import multer from 'multer';
import { config } from '../../config/index.js';
import { authenticateJWT, authorizeRoles } from '../../middlewares/auth.middleware.js';
import {
  uploadShifts,
  listShifts,
  getDateRange,
  exportShiftsCsv,
} from './shift.controller.js';

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

const authFinance = [authenticateJWT, authorizeRoles('super_admin', 'finance')];
const authAll = [authenticateJWT];

router.post('/shifts/upload', ...authFinance, upload.single('file'), uploadShifts);
router.get('/shifts', ...authAll, listShifts);
router.get('/shifts/date-range', ...authAll, getDateRange);
router.get('/shifts/export', ...authFinance, exportShiftsCsv);

export default router;
