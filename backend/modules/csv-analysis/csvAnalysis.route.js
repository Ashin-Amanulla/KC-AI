import express from 'express';
import fs from 'fs';
import multer from 'multer';
import { config } from '../../config/index.js';
import { authenticateJWT, authorizeRoles } from '../../middlewares/auth.middleware.js';
import { validate } from '../../middlewares/validate.middleware.js';
import { getJobByIdSchema } from '../../validators/analysisJobs.validator.js';
import {
  uploadAndAnalyze,
  getJobStatus,
  getJob,
  listJobs,
  cancelJob,
} from './csvAnalysis.controller.js';

const router = express.Router();
const uploadDir = 'uploads';

if (!fs.existsSync(uploadDir)) {
  fs.mkdirSync(uploadDir, { recursive: true, mode: 0o755 });
}

const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    cb(null, uploadDir);
  },
  filename: (req, file, cb) => {
    cb(null, `${Date.now()}-${file.originalname}`);
  },
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
  limits: {
    fileSize: config.upload.maxFileSizeBytes,
  },
});

const csvAuth = [authenticateJWT, authorizeRoles('super_admin', 'finance')];

router.post(
  '/analyze-shift-report',
  ...csvAuth,
  upload.single('file'),
  uploadAndAnalyze
);

router.get('/analysis-jobs/:id/status', ...csvAuth, validate(getJobByIdSchema), getJobStatus);
router.post('/analysis-jobs/:id/cancel', ...csvAuth, validate(getJobByIdSchema), cancelJob);
router.get('/analysis-jobs/:id', ...csvAuth, validate(getJobByIdSchema), getJob);
router.get('/analysis-jobs', ...csvAuth, listJobs);

export default router;
