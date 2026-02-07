import express from 'express';
import { authenticateJWT, authorizeRoles } from '../../middlewares/auth.middleware.js';
import { listUsers, createUser, updateUser, deleteUser } from './user.controller.js';

const router = express.Router();

router.use(authenticateJWT);
router.use(authorizeRoles('super_admin'));

router.get('/', listUsers);
router.post('/', createUser);
router.put('/:id', updateUser);
router.delete('/:id', deleteUser);

export default router;
