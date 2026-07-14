import express from 'express';
import { authenticateJWT, authorizePermission } from '../../middlewares/auth.middleware.js';
import {
  listAwardRateSets,
  getEffectiveAwardRates,
  createAwardRateSet,
  updateAwardRateSet,
} from './awardRates.controller.js';
import { PERMISSIONS } from '../../config/permissionCatalog.js';

const router = express.Router();

const readPerms = [
  PERMISSIONS.RULE_ENGINE_VIEW,
  PERMISSIONS.WORKFORCE_VIEW,
  PERMISSIONS.PAY_HOURS_TESTS_VIEW,
];

router.get('/award-rates', authenticateJWT, authorizePermission(...readPerms), listAwardRateSets);
router.get(
  '/award-rates/effective',
  authenticateJWT,
  authorizePermission(...readPerms),
  getEffectiveAwardRates
);
router.post(
  '/award-rates',
  authenticateJWT,
  authorizePermission(PERMISSIONS.RULE_ENGINE_MANAGE),
  createAwardRateSet
);
router.patch(
  '/award-rates/:id',
  authenticateJWT,
  authorizePermission(PERMISSIONS.RULE_ENGINE_MANAGE),
  updateAwardRateSet
);

export default router;
