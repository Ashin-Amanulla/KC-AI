# SCHADS Rules Engine: main vs uat Comparison Report

**Generated:** 2026-08-05  
**Branches:** `main` (7628b03) vs `uat` (current)  
**Method:** Fixture replay through both `payHoursCalculator.js` engines + full test suites on each branch

---

## Executive summary

**Rules do NOT produce identical output on both branches.**

| Metric | Result |
|--------|--------|
| Fixture scenarios compared | 8 |
| Identical bucket output | 6 / 8 (75%) |
| Different bucket output | 2 / 8 (25%) |
| Estimated gross pay impact (sample rates) | **$12–$24 per affected fortnight fragment** |
| `main` pay-hours tests | 73 pass, 0 fail |
| `uat` pay-hours + rule-engine tests | 99 pass, 0 fail |

UAT changes **weekday time-band classification** for some broken-shift and cross-midnight scenarios. OT hour counts can match while **penalty bucket labels and dollar pay differ**.

---

## Test results

### `main` branch

| Suite | Pass | Fail |
|-------|------|------|
| `payHoursCalculator.test.js` | 70 | 0 |
| `payHoursManualFields.test.js` | 3 | 0 |
| **Total** | **73** | **0** |

No rule-engine module, golden runs, invariants, or wage parity tests exist on `main`.

### `uat` branch

| Suite | Pass | Fail |
|-------|------|------|
| `payHoursCalculator.test.js` | 74 | 0 |
| `payHoursManualFields.test.js` | 3 | 0 |
| `wageParity.test.js` | 4 | 0 |
| `goldenRuns.test.js` | 4 | 0 |
| `invariants.test.js` | 1 (200 seeds) | 0 |
| `clientScenarios.test.js` | 1 | 0 |
| **Total** | **99** | **0** |

`rulesCatalog.test.js` fails on **doc drift** (committed markdown ≠ generated catalog) — documentation only, not calculation.

### New on UAT (not on main)

- 4 regression scenarios in `payHoursCalculator.test.js` (broken evening double-count, gapless evening chain, ANZAC cross-midnight, ANZAC Saturday)
- `goldenRuns.test.js` — 4 blessed fixtures
- `invariants.test.js` — 200 seeded random fortnights (I1–I5 conservation laws)
- `clientScenarios.test.js` — rule scenario visuals
- `wageParity.test.js` — frontend/backend wage layer parity
- Full `backend/modules/rule-engine/` API + UI

---

## Fixture-by-fixture output comparison

Engine: `computePayHoursForStaff()` with `detectBrokenShifts()` on identical shift JSON.

### ✅ Identical (6)

| Fixture | Notes |
|---------|-------|
| `anzac-cross-midnight` | Both match blessed expected output |
| `broken-shift-boundary` | Both match blessed expected output |
| `sleepover-ot76-fortnight` | Both match blessed expected output |
| `kc-studio/krishnaBrokenShiftMay25` | Identical |
| `kc-studio/sonaSleepoverChainMay19` | Identical |
| `kc-studio/sonaSleepoverChainMay22` | Identical |

### ❌ Different (2)

#### 1. `double-count-broken-evening`

**Scenario:** 8am–12pm PC (4h) + broken 9pm–11pm PC (2h) same weekday.

| Field | main | uat | Blessed (UAT) |
|-------|------|-----|---------------|
| `morningHours` | 0 | **4** | **4** |
| `afternoonHours` | **4** | 0 | 0 |
| `weekdayOtAfter2` | 2 | 2 | 2 |
| `brokenShiftCount` | 1 | 1 | 1 |

**Gross pay (sample rates):** main **$289.44** vs uat **$277.44** (Δ **$12.00**)

**Verdict:** UAT matches blessed fixture. Main misclassifies the 8am–12pm shift into `afternoonHours` instead of `morningHours`.

**Likely rule:** R035/R037 per-period time-band vs whole-shift highest-band logic for broken-span segments.

---

#### 2. `kc-studio/rahulBrokenShiftMay22`

**Scenario:** Rahul Rahul — 8h PC (2pm–10pm local) after inadequate rest → broken, 8h at 2× OT.

| Field | main | uat |
|-------|------|-----|
| `afternoonHours` | **8** | 0 |
| `nightHours` | 0 | **8** |
| `weekdayOtAfter2` | 8 | 8 |

**Gross pay (sample rates):** main **$798.06** vs uat **$822.06** (Δ **$24.00**)

**Verdict:** Same OT hours (8h at 2×) but different ordinary penalty bucket. Main classifies Jennifer shift as **evening** (`afternoonHours`); UAT classifies as **night** (`nightHours`). Both branch tests pass because they assert OT buckets and broken flags, not time-band labels.

**Likely rule:** R034 (ends after 8pm → evening) vs broken-span retro band loading change on UAT.

---

## What is the same

- **Core rule count:** ~198–199 award rules; UAT adds R199 (pre-sleepover flag only, no pay effect)
- **`schadsWageCalc.js`:** Functionally same except UAT adds `applyAwardConstants()` for FWC-indexed rates from backend
- **Broken-shift detection:** Same gap thresholds (10h PC, 8h sleepover, exactly-at-threshold not broken)
- **Sleepover chains, 76h cap, ANZAC PH split, minimum engagement flags:** Match on shared fixtures
- **All `main` tests pass on `main`; all `uat` tests pass on `uat`**

---

## What differs (calculation)

| Area | main | uat |
|------|------|-----|
| Broken-shift OT model | Span `<12h` → 1.5× daily OT; span `≥12h` → entire last shift 2× | 12h **clock mark** from span start; hours after mark at 2× (idempotent state) |
| Time-band on broken spans | Retro evening loading across span | Per-period bands; retro loading removed (R066) |
| Weekday band for some shifts | `afternoonHours` for 8am–12pm / 2pm–10pm cases above | `morningHours` / `nightHours` respectively |
| Test coverage | 70 calculator tests | 74 + golden + invariants + parity |
| Infrastructure | Static markdown doc | `rulesCatalog.js` SSOT + API + UI + Rust A/B calculator |

---

## Recommendations

1. **Do not assume pay parity** when merging UAT → main without re-running golden fixtures and KC Studio evidence.
2. **UAT is authoritative** for `double-count-broken-evening` (matches blessed fixture; main fails it).
3. **Review `rahulBrokenShiftMay22`** — confirm whether 2pm–10pm broken shift should be evening or night band before production sign-off.
4. Run `node scripts/compare-main-uat-payengine.mjs` after any calculator change; full JSON at `scripts/output/main-uat-payengine-comparison.json`.
5. Regenerate docs: `cd backend && npm run docs:rules` to fix `rulesCatalog.test.js` drift.

---

## Artifacts

| File | Description |
|------|-------------|
| `scripts/compare-main-uat-payengine.mjs` | Fixture replay comparator |
| `scripts/output/main-uat-payengine-comparison.json` | Machine-readable diff |
| `kcai-main/` git worktree | Clean `main` checkout for re-runs |
