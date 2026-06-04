import express from 'express';
import { authenticateJWT, authorizePermission } from '../../middlewares/auth.middleware.js';
import { validate } from '../../middlewares/validate.middleware.js';
import { createUserSchema, updateUserSchema, deleteUserSchema } from '../../validators/user.validator.js';
import { listUsers, createUser, updateUser, deleteUser } from './user.controller.js';
import { PERMISSIONS } from '../../config/permissionCatalog.js';

const router = express.Router();

router.use(authenticateJWT);
router.use(authorizePermission(PERMISSIONS.USERS_MANAGE));

router.get('/', listUsers);
router.post('/', validate(createUserSchema), createUser);
router.put('/:id', validate(updateUserSchema), updateUser);
router.delete('/:id', validate(deleteUserSchema), deleteUser);

export default router;
