import express from 'express';
import { login, logout, getAuthStatus } from './auth.controller.js';
import { authenticateJWT } from '../../middlewares/auth.middleware.js';
import { validate } from '../../middlewares/validate.middleware.js';
import { loginSchema } from '../../validators/auth.validator.js';

const router = express.Router();

router.post('/login', validate(loginSchema), login);
router.post('/logout', logout);
router.get('/status', authenticateJWT, getAuthStatus);

export default router;
