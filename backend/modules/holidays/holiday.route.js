import express from 'express';
import { authenticateJWT, authorizeRoles } from '../../middlewares/auth.middleware.js';
import { listHolidays, createHoliday, deleteHoliday } from './holiday.controller.js';

const router = express.Router();

const authAll = [authenticateJWT];
const authFinance = [authenticateJWT, authorizeRoles('super_admin', 'finance', 'viewer', 'shifts_viewer')];

router.get('/holidays', ...authAll, listHolidays);
router.post('/holidays', ...authFinance, createHoliday);
router.delete('/holidays/:id', ...authFinance, deleteHoliday);

export default router;
