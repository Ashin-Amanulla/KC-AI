import express from 'express';
import { login, logout, getAuthStatus } from './auth.controller.js';
import { authenticateJWT } from '../../middlewares/auth.middleware.js';

const router = express.Router();

router.post('/login', login);
router.post('/logout', logout);
router.get('/status', authenticateJWT, getAuthStatus);

export default router;
