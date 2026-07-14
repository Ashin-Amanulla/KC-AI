import express from 'express';
import { authenticateJWT, authorizePermission } from '../../middlewares/auth.middleware.js';
import {
  executeTestRun,
  listTestRuns,
  getTestRun,
  listRules,
  goldenDiff,
  rateCardCoverage,
  scanAnomalies,
} from './ruleEngine.controller.js';
import { PERMISSIONS } from '../../config/permissionCatalog.js';
import { spawnJobLimiter } from '../../middlewares/rateLimit.js';

const router = express.Router();

const readPerms = [PERMISSIONS.RULE_ENGINE_VIEW, PERMISSIONS.PAY_HOURS_TESTS_VIEW];

router.get('/rule-engine/rules', authenticateJWT, authorizePermission(...readPerms), listRules);
router.get('/rule-engine/test-runs', authenticateJWT, authorizePermission(...readPerms), listTestRuns);
router.get('/rule-engine/test-runs/:id', authenticateJWT, authorizePermission(...readPerms), getTestRun);
router.post(
  '/rule-engine/test-runs',
  spawnJobLimiter,
  authenticateJWT,
  authorizePermission(...readPerms),
  executeTestRun
);
router.post('/rule-engine/golden-diff', authenticateJWT, authorizePermission(...readPerms), goldenDiff);
router.get('/rule-engine/coverage', authenticateJWT, authorizePermission(...readPerms), rateCardCoverage);
router.get('/rule-engine/anomalies', authenticateJWT, authorizePermission(...readPerms), scanAnomalies);

export default router;
