import express from 'express';
import { authenticateJWT, authorizeRoles } from '../../middlewares/auth.middleware.js';
import { listStaffRates, upsertStaffRate, deleteStaffRate, bulkUpsertStaffRates } from './staffRates.controller.js';

const router = express.Router();

const readRoles = ['super_admin', 'viewer', 'finance', 'shifts_viewer'];
const writeRoles = ['super_admin', 'finance'];

router.get('/staff-rates', authenticateJWT, authorizeRoles(...readRoles), listStaffRates);
router.put('/staff-rates', authenticateJWT, authorizeRoles(...writeRoles), upsertStaffRate);
router.post('/staff-rates/bulk', authenticateJWT, authorizeRoles(...writeRoles), bulkUpsertStaffRates);
router.delete('/staff-rates', authenticateJWT, authorizeRoles(...writeRoles), deleteStaffRate);

export default router;
