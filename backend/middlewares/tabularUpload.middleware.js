import fs from 'fs';
import multer from 'multer';
import { config } from '../config/index.js';
import { getFileExtension, isSpreadsheetFilename } from '../utils/tabularFile.js';

const uploadDir = 'uploads';

if (!fs.existsSync(uploadDir)) {
  fs.mkdirSync(uploadDir, { recursive: true, mode: 0o755 });
}

const storage = multer.diskStorage({
  destination: (req, file, cb) => cb(null, uploadDir),
  filename: (req, file, cb) => cb(null, `${Date.now()}-${file.originalname}`),
});

const tabularFileFilter = (req, file, cb) => {
  const allowedMimes = [
    'text/csv',
    'application/csv',
    'text/plain',
    'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    'application/vnd.ms-excel',
  ];
  const hasValidMime = allowedMimes.includes(file.mimetype);
  const hasValidExt = isSpreadsheetFilename(file.originalname);
  if (hasValidMime || hasValidExt) {
    cb(null, true);
  } else {
    cb(new Error('Only CSV or Excel (.xlsx, .xls) files are allowed'), false);
  }
};

export const tabularUpload = multer({
  storage,
  fileFilter: tabularFileFilter,
  limits: { fileSize: config.upload.maxFileSizeBytes },
});
