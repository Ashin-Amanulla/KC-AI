import express from 'express';
import { authenticateJWT, authorizeRoles } from '../../middlewares/auth.middleware.js';
import { listLocations, createLocation, deleteLocation, loadHolidayFixture } from './location.controller.js';

const router = express.Router();

const authAll    = [authenticateJWT];
const authAdmin  = [authenticateJWT, authorizeRoles('super_admin', 'finance')];

router.get('/locations',                       ...authAll,   listLocations);
router.post('/locations',                      ...authAdmin, createLocation);
router.delete('/locations/:id',                ...authAdmin, deleteLocation);
router.post('/locations/:id/load-holidays',    ...authAdmin, loadHolidayFixture);

export default router;
