import express from 'express';
import fs from 'fs';
import multer from 'multer';
import { config } from '../../config/index.js';
import { authenticateJWT, authorizePermission } from '../../middlewares/auth.middleware.js';
import { PERMISSIONS } from '../../config/permissionCatalog.js';
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

const authWorkforce = [
  authenticateJWT,
  authorizePermission(
    PERMISSIONS.WORKFORCE_VIEW,
    PERMISSIONS.ROSTER_VIEW,
    PERMISSIONS.ROSTER_SHIFT_LOG_VIEW
  ),
];
const authAll = [authenticateJWT];

router.post('/shifts/upload', ...authWorkforce, upload.single('file'), uploadShifts);
router.get('/shifts', ...authAll, listShifts);
router.get('/shifts/date-range', ...authAll, getDateRange);
router.get('/shifts/export', ...authWorkforce, exportShiftsCsv);

export default router;
