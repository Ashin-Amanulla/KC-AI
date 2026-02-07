import express from 'express';
import { authenticateJWT, authorizeRoles } from '../../middlewares/auth.middleware.js';
import { validate } from '../../middlewares/validate.middleware.js';
import { createUserSchema, updateUserSchema, deleteUserSchema } from '../../validators/user.validator.js';
import { listUsers, createUser, updateUser, deleteUser } from './user.controller.js';

const router = express.Router();

router.use(authenticateJWT);
router.use(authorizeRoles('super_admin'));

router.get('/', listUsers);
router.post('/', validate(createUserSchema), createUser);
router.put('/:id', validate(updateUserSchema), updateUser);
router.delete('/:id', validate(deleteUserSchema), deleteUser);

export default router;
