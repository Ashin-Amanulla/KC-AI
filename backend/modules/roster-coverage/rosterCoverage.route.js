import express from 'express';
import fs from 'fs';
import multer from 'multer';
import { config } from '../../config/index.js';
import { authenticateJWT, authorizePermission } from '../../middlewares/auth.middleware.js';
import { tabularUpload } from '../../middlewares/tabularUpload.middleware.js';
import { PERMISSIONS } from '../../config/permissionCatalog.js';
import {
  listRosterStaff,
  createRosterStaff,
  patchRosterStaff,
  deleteRosterStaff,
  listParticipants,
  createParticipant,
  patchParticipant,
  deleteParticipant,
  listWorkedShifts,
  createWorkedShifts,
  deleteWorkedShift,
  listVacantShifts,
  createVacantShift,
  patchVacantShift,
  deleteVacantShift,
  clearVacantShifts,
  postFindCover,
  getDashboardSummary,
  getStaffProfile,
  uploadTimesheet,
  uploadVacantShifts,
  exportIneligibilityPdf,
  exportIneligibilityXlsx,
  patchContactStatus,
  listAuditLog,
  listShiftDashboard,
  addVacantShiftUpdate,
} from './rosterCoverage.controller.js';

const router = express.Router();
const uploadDir = 'uploads';

if (!fs.existsSync(uploadDir)) {
  fs.mkdirSync(uploadDir, { recursive: true, mode: 0o755 });
}

const storage = multer.diskStorage({
  destination: (req, file, cb) => cb(null, uploadDir),
  filename: (req, file, cb) => cb(null, `${Date.now()}-${file.originalname}`),
});

const timesheetFilter = (req, file, cb) => {
  const allowedMimes = ['text/csv', 'application/csv', 'text/plain'];
  const hasValidMime = allowedMimes.includes(file.mimetype);
  const hasValidExt = /\.csv$/i.test(file.originalname || '');
  if (hasValidMime || hasValidExt) cb(null, true);
  else cb(new Error('Only CSV files are allowed (ShiftCare export)'), false);
};

const upload = multer({
  storage,
  fileFilter: timesheetFilter,
  limits: { fileSize: config.upload.maxFileSizeBytes },
});

const authRoster = [
  authenticateJWT,
  authorizePermission(PERMISSIONS.ROSTER_VIEW, PERMISSIONS.ROSTER_SHIFT_LOG_VIEW),
];
const authAll = [authenticateJWT];

router.get('/roster-coverage/dashboard', ...authAll, getDashboardSummary);
router.get('/roster-coverage/audit', ...authRoster, listAuditLog);

router.get('/roster-coverage/staff', ...authAll, listRosterStaff);
router.post('/roster-coverage/staff', ...authRoster, createRosterStaff);
router.patch('/roster-coverage/staff/:id', ...authRoster, patchRosterStaff);
router.delete('/roster-coverage/staff/:id', ...authRoster, deleteRosterStaff);
router.get('/roster-coverage/staff/:id/profile', ...authAll, getStaffProfile);

router.get('/roster-coverage/participants', ...authAll, listParticipants);
router.post('/roster-coverage/participants', ...authRoster, createParticipant);
router.patch('/roster-coverage/participants/:id', ...authRoster, patchParticipant);
router.delete('/roster-coverage/participants/:id', ...authRoster, deleteParticipant);

router.get('/roster-coverage/worked-shifts', ...authAll, listWorkedShifts);
router.post('/roster-coverage/worked-shifts', ...authRoster, createWorkedShifts);
router.delete('/roster-coverage/worked-shifts/:id', ...authRoster, deleteWorkedShift);

router.get('/roster-coverage/shift-dashboard', ...authAll, listShiftDashboard);
router.get('/roster-coverage/vacant-shifts', ...authAll, listVacantShifts);
router.post('/roster-coverage/vacant-shifts', ...authRoster, createVacantShift);
router.delete('/roster-coverage/vacant-shifts', ...authRoster, clearVacantShifts);
router.post('/roster-coverage/vacant-shifts/:id/updates', ...authAll, addVacantShiftUpdate);
router.patch(
  '/roster-coverage/vacant-shifts/:vacantId/contact/:staffId',
  ...authRoster,
  patchContactStatus
);
router.patch('/roster-coverage/vacant-shifts/:id', ...authRoster, patchVacantShift);
router.delete('/roster-coverage/vacant-shifts/:id', ...authRoster, deleteVacantShift);

router.post('/roster-coverage/find-cover', ...authRoster, postFindCover);
router.post('/roster-coverage/timesheet-upload', ...authRoster, upload.single('file'), uploadTimesheet);
router.post(
  '/roster-coverage/vacant-shifts/upload',
  ...authRoster,
  tabularUpload.single('file'),
  uploadVacantShifts
);
router.post('/roster-coverage/export/ineligibility-pdf', ...authRoster, exportIneligibilityPdf);
router.post('/roster-coverage/export/ineligibility-xlsx', ...authRoster, exportIneligibilityXlsx);

export default router;
