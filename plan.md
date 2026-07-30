# Engine Isolation Implementation Plan

## Goal
Extract the SCHADS calculation engine from `wageCalculator.js` into a standalone, hot‑reloadable service with an AI‑update UI, while maintaining full backward compatibility.

## Phases

### Phase 0 – Prepare Wrapper (Non‑breaking)
- [ ] Create `backend/modules/pay-hours/engine/` directory.
- [ ] Copy `wageCalculator.js` to `engine/wageEngine.js`.
- [ ] Modify `wageCalculator.js` to re‑export all functions from `engine/wageEngine.js` (no behaviour change).
- [ ] Verify existing tests (wageParity.test.js) still pass.

### Phase 1 – Core Module + Dependency Decoupling
- [x] Move constants (`DAILY_ORD`, etc.) and `applyAwardConstants` into a separate context object.
- [x] Refactor engine functions to accept context (or import from a context module).
- [x] Ensure `resolveOt76PayTiers` is imported locally or passed as dependency.
- [x] Keep `normalizeRateCard` pure (only uses input rates).

### Phase 2 – Hot‑Reload & Versioning
- [ ] Implement versioned storage: `engine/versions/engine_<timestamp>.js`.
- [ ] Symlink or pointer to current version.
- [ ] Use dynamic `import()` to load active engine on each call (with caching and cache invalidation).
- [ ] Add global ready flag and fallback to original copy when engine unavailable.

### Phase 3 – Engine Update API
- [ ] Create `backend/modules/engine/engine.routes.js` with routes:
  - `GET /api/engine/status` – current version, timestamp.
  - `POST /api/engine/update` – accept new code, validate syntax, run tests, save and reload.
  - `POST /api/engine/suggest` – accept prompt, return AI‑generated code suggestion.
- [ ] Add controller to handle update logic (save, validate, reload).
- [ ] Integrate with existing test runner (jest).

### Phase 4 – Frontend UI
- [x] Add new page/route for Engine Admin (e.g., under Rule Engine).
- [x] Display current version and status.
- [x] Textarea to view current engine code.
- [x] Prompt input + "Suggest" button -> calls `/api/engine/suggest` and shows diff.
- [x] "Apply" button -> calls `/api/engine/update` with new code.
- [x] Show test results (pass/fail) after apply.

### Phase 5 – Testing & Validation
- [ ] Expand wageParity.test.js to run against the active engine version.
- [ ] Add random‑input gold‑standard test fixture.
- [ ] Automatically run tests after each engine update (block apply on failure unless overridden).
- [ ] Integration test for the whole API flow.

### Phase 6 – Rollout & Monitoring
- [ ] Add feature flag (`USE_ENGINE_SERVICE`) to enable/disable.
- [ ] Enable in staging, monitor logs, then production.
- [ ] Document rollback procedure.

## Current Status
Phase 0-4 complete. Phase 5 (Testing & Validation) and Phase 6 (Rollout & Monitoring) remain.
