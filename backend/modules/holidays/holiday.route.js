import express from 'express';
import { authenticateJWT, authorizePermission } from '../../middlewares/auth.middleware.js';
import { listHolidays, createHoliday, deleteHoliday } from './holiday.controller.js';
import { PERMISSIONS } from '../../config/permissionCatalog.js';

const router = express.Router();

const authAll = [authenticateJWT];
const authWrite = [
  authenticateJWT,
  authorizePermission(
    PERMISSIONS.WORKFORCE_VIEW,
    PERMISSIONS.ROSTER_VIEW,
    PERMISSIONS.ROSTER_SHIFT_LOG_VIEW
  ),
];

router.get('/holidays', ...authAll, listHolidays);
router.post('/holidays', ...authWrite, createHoliday);
router.delete('/holidays/:id', ...authWrite, deleteHoliday);

export default router;
