/**
 * SCHADS award wage calculations (hours × rate card → dollars).
 *
 * This file now re-exports from the isolated engine module under `engine/`.
 * All existing exports are preserved. Use the engine module directly if you
 * need to import the engine separately.
 */

export * from '../engine/wageEngine.js';
