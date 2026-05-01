import express from 'express';
import fs from 'fs';
import multer from 'multer';
import { config } from '../../config/index.js';
import { authenticateJWT, authorizeRoles } from '../../middlewares/auth.middleware.js';
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
  postFindCover,
  getDashboardSummary,
  getStaffProfile,
  uploadTimesheet,
  exportIneligibilityPdf,
  exportIneligibilityXlsx,
  patchContactStatus,
  listAuditLog,
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
  const ok = /\.(csv|xlsx)$/i.test(file.originalname || '');
  if (ok) cb(null, true);
  else cb(new Error('Only CSV or XLSX files are allowed'), false);
};

const upload = multer({
  storage,
  fileFilter: timesheetFilter,
  limits: { fileSize: config.upload.maxFileSizeBytes },
});

const rosterRoles = ['super_admin', 'finance', 'viewer', 'shifts_viewer'];
const authRoster = [authenticateJWT, authorizeRoles(...rosterRoles)];
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

router.get('/roster-coverage/vacant-shifts', ...authAll, listVacantShifts);
router.post('/roster-coverage/vacant-shifts', ...authRoster, createVacantShift);
router.patch(
  '/roster-coverage/vacant-shifts/:vacantId/contact/:staffId',
  ...authRoster,
  patchContactStatus
);
router.patch('/roster-coverage/vacant-shifts/:id', ...authRoster, patchVacantShift);

router.post('/roster-coverage/find-cover', ...authRoster, postFindCover);
router.post('/roster-coverage/timesheet-upload', ...authRoster, upload.single('file'), uploadTimesheet);
router.post('/roster-coverage/export/ineligibility-pdf', ...authRoster, exportIneligibilityPdf);
router.post('/roster-coverage/export/ineligibility-xlsx', ...authRoster, exportIneligibilityXlsx);

export default router;
