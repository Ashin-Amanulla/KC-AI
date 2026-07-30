/**
 * Engine entry point - re-exports all functions from the current engine version.
 * This module is the public interface for the rest of the backend.
 */

import {
  r2,
  normalizeRateCard,
  applyAwardConstants,
  calcGrossFromRates,
  calcBreakdownFromRates,
  calcGross,
  calcBreakdown,
  staffTotalHours,
  shiftRowPayableHours,
  totalOtHrs,
  effectiveSleepoverRate,
  calcAllowances,
} from './wageEngine.js';

import { resolveOt76PayTiers } from '../utils/ot76GlobalTier.js';

// Re-export all calculation functions
export {
  r2,
  normalizeRateCard,
  applyAwardConstants,
  calcGrossFromRates,
  calcBreakdownFromRates,
  calcGross,
  calcBreakdown,
  staffTotalHours,
  shiftRowPayableHours,
  totalOtHrs,
  effectiveSleepoverRate,
  calcAllowances,
};

// Re-export constants
export {
  DAILY_ORD,
  WEEKLY_ORD,
  BROKEN_ALLOWANCE_1,
  BROKEN_ALLOWANCE_2,
  MEAL_ALLOWANCE,
  VEHICLE_RATE,
  OT_1,
  OT_2,
} from './constants.js';

// Re-export resolveOt76PayTiers for modules that need it
export { default as resolveOt76PayTiers } from '../utils/ot76GlobalTier.js';
