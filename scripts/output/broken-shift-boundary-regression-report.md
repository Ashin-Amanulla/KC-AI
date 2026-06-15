# Broken Shift Boundary Regression — Incident Report

**Date discovered:** 15 June 2026  
**Date fixed:** 15 June 2026 (`ebdcbc2`)  
**Severity:** Medium — incorrect exception flags and broken-shift allowances/OT on real timesheets  
**Affected area:** Shift import (`detectBrokenShifts`), pay-hours calculator (`collectBrokenShiftSpanPrevious`), SCHADS Calculator exception reports  

---

## Executive summary

Staff exception reports showed many incorrect **broken shift** flags after processing the June 2026 timesheet export (`Scheduler_Timesheet_Export_2026-06-15-01-08.csv`). Investigation found that shifts with **exactly 10 hours** rest after Personal Care (or **exactly 8 hours** after Sleepover) were wrongly classified as broken.

This was **not a new bug introduced by the fix**. It was a **regression** introduced on **8 June 2026** in commit `e3981f3`, which changed the gap comparison from strict less-than (`<`) to less-than-or-equal (`<=`). The original implementation (April 2026) had the correct boundary. The fix on 15 June restored the original semantics while keeping the cross-midnight detection improvements from `e3981f3`.

---

## What was reported

Users reviewing **Exception Reports** in the SCHADS Calculator observed:

- A large number of broken-shift exceptions that did not match expected SCHADS rules
- Common pattern: **8:00 PM finish → 6:00 AM start next day** (exactly 10 hours rest) flagged as broken
- Broader concern that shift calculations and broken-shift pay rules were unreliable

**Trigger data:** `tmp/test/Scheduler_Timesheet_Export_2026-06-15-01-08.csv` (~1,248 valid shifts after parse)

---

## Business rules (reference)

Documented in `backend/modules/shifts/shiftCsvParser.js` as BR-BS-001/002/003:

| Previous shift type | Broken when gap is… |
|---------------------|---------------------|
| Personal Care       | **0 < gap < 10 hours** |
| Sleepover           | **0 < gap < 8 hours** |
| Nursing Support     | **0 < gap < 10 hours** |

Additionally, the gap must fall on the **same local start day** as the previous shift, **or** the previous shift must **end on the same local calendar day** the current shift starts (cross-midnight spans).

**Critical detail:** Exactly 10 hours (or exactly 8 hours after sleepover) is **adequate rest** and must **not** trigger broken-shift treatment.

---

## Root cause

### The operator regression

**Correct logic:**

```javascript
// Not broken when gap >= threshold
if (gap >= thresholdMs) return false;
// Equivalent to: broken only when gap < thresholdMs
```

**Buggy logic (8 Jun – 14 Jun):**

```javascript
// Not broken when gap > threshold  →  broken when gap <= threshold
if (gap > thresholdMs) return false;
```

At exactly 10.0000 hours, `gap > thresholdMs` is false, so the shift was incorrectly marked broken.

### Where it lived

| File | Function | Buggy condition |
|------|----------|-----------------|
| `backend/modules/shifts/shiftCsvParser.js` | `calculateIsBrokenShift` | `gap > thresholdMs` |
| `backend/modules/pay-hours/services/payHoursCalculator.js` | `collectBrokenShiftSpanPrevious` | `gap <= thresholdMs` |

Both expressions implement the same wrong boundary: **inclusive** at the threshold instead of **exclusive**.

---

## Why it happened

### Git timeline

| Date | Commit | Change |
|------|--------|--------|
| 8 Apr 2026 | `7229af4` | Initial shifts module — used `gap < BROKEN_SHIFT_GAP_*` (**correct**) |
| 8 Jun 2026 | `e3981f3` | Refactored broken-shift detection; added cross-midnight `spansOntoCurrentDay` (**good**); changed boundary to `gap > thresholdMs` (**regression**) |
| 15 Jun 2026 | `ebdcbc2` | Restored `gap >= thresholdMs` / `gap < thresholdMs` (**fix**) |

Commit `e3981f3` (“enhance variance export functionality…”) bundled pay-hours calculator changes, evidence fixtures, and broken-shift refactors. The cross-midnight improvement was needed (e.g. Rahul Rahul 8 PM → 8 AM next day with &lt;10h gap should be broken), but the refactor accidentally flipped the comparison operator.

### Why it went undetected for ~1 week

1. **Tests matched the bug** — the Krishna jith evidence fixture (`krishnaBrokenShiftMay25.json`) has a exactly 10h gap (8 PM–10 PM + 10 PM–12 AM, then 10 AM sleepover). Tests asserted that chain should be broken, encoding the wrong boundary.
2. **No boundary tests** — there were no tests asserting that exactly 10h/8h gaps are **not** broken.
3. **Real-world pattern** — the 8 PM → 6 AM roster pattern (exactly 10h) is common; it only became visible when someone reviewed exception reports against a full fortnight export.

---

## Impact analysis (June timesheet)

Analysis run against `Scheduler_Timesheet_Export_2026-06-15-01-08.csv`:

| Metric | Before fix | After fix |
|--------|------------|-----------|
| Shifts flagged broken | 37 | 17 |
| False positives (exactly 10h or 8h gap) | 20 | 0 |
| False negatives | 0 | 0 |
| Staff with broken-shift pay exceptions | ~20+ inflated | 9 (legitimate) |

### Examples of false positives removed (exactly 10h gap)

- Erica Cox — 8 PM finish → 6 AM start
- Jimel E Dennis — overnight rest boundary (×2)
- Jaimon James, Netsayi Kunaka, Mahesh Pillai, Tomseena Tomy, Dora Vilma Amaya (one shift), Ann Mathew, Vaciseva B Lacudru, Abdullateef Kuranga, Jobitt Joseph, and others

### Examples of legitimate broken shifts retained

- Annmary Davis — 0.5h gap after nursing → PC
- Marie Claire Nsengiyumva — 0.5–1h gaps between PC shifts
- Mohammed Lakhal — 7.5h gap after sleepover (&lt;8h)
- Abdullateef Kuranga — 9h gap (&lt;10h)
- Jimel E Dennis — 8h gap on same calendar day (&lt;10h, not at boundary)

### Downstream pay impact

False broken flags could incorrectly add:

- Broken shift allowance counts (`brokenShiftCount`, `brokenShift2BreakCount`)
- Broken-shift OT tiers (1.5× / 2×) via `processBrokenShiftOvertime`
- Meal allowance counts tied to broken-shift OT events
- Inflated exception-report totals in SCHADS Calculator

---

## How we solved it

### Code changes (commit `ebdcbc2`)

**1. `shiftCsvParser.js` — detection at import**

```javascript
// Before (bug)
if (thresholdMs == null || gap > thresholdMs) return false;

// After (fix)
// BR-BS: broken only when 0 < gap < threshold (exactly threshold hours is adequate rest)
if (thresholdMs == null || gap >= thresholdMs) return false;
```

**2. `payHoursCalculator.js` — span collection for OT/allowances**

```javascript
// Before (bug)
if (thresholdMs != null && gap <= thresholdMs) {

// After (fix)
if (thresholdMs != null && gap < thresholdMs) {
```

**3. Tests added in `payHoursCalculator.test.js`**

- Exactly 10h gap after overnight PC → **not** broken
- Just under 10h gap (9h 59m) after overnight PC → **broken**
- Exactly 8h gap after sleepover → **not** broken
- Krishna jith fixture updated: exactly 10h rest → **not** broken (aligns with BR-BS)

### Verification

- All **161** backend tests pass
- Re-analysis of June timesheet: 20 boundary false positives eliminated, 17 legitimate broken shifts remain
- Erica Cox 8 PM → 6 AM case: `gap = 10.0000h`, `isBrokenShift = false` ✓

### User action required

Re-upload the timesheet CSV and click **Compute Pay Hours** to refresh stored shift flags and exception reports. Existing computed data in the database still reflects pre-fix logic until recomputed.

---

## Related notes

- **2 CSV rows skipped** on import: shift type `'Demo'` (rows 665, 1037) — not in `SHIFT_TYPE_MAP`. Unrelated to this regression; add mapping if Demo shifts should be included.
- **Cross-midnight detection** from `e3981f3` was retained — only the boundary operator was corrected.

---

## Prevention recommendations

1. **Keep boundary tests permanent** — assert both sides of `<` vs `<=` for 10h PC and 8h sleepover thresholds.
2. **Code review checklist** — when refactoring comparisons, verify inclusive/exclusive boundaries against documented BR-* rules.
3. **Fixture discipline** — evidence fixtures should encode rule intent (e.g. 9h59m for “just broken”, 10h00m for “not broken”), not accidental behavior.
4. **Regression test on real export** — optional smoke script against `tmp/test` timesheets counting boundary false positives (similar to `scripts/test-tmp-fixtures.mjs`).

---

## Files changed

| File | Role |
|------|------|
| `backend/modules/shifts/shiftCsvParser.js` | Broken shift detection at CSV import |
| `backend/modules/pay-hours/services/payHoursCalculator.js` | Broken shift span / OT calculation |
| `backend/modules/pay-hours/services/payHoursCalculator.test.js` | Boundary and fixture tests |

---

## References

- Introducing commit (regression): `e3981f3` — 8 Jun 2026
- Fix commit: `ebdcbc2` — 15 Jun 2026
- Original correct implementation: `7229af4` — 8 Apr 2026
- Evidence fixture (Rahul — cross-midnight broken, correct): `backend/fixtures/kc-studio-evidence/rahulBrokenShiftMay22.json`
- Evidence fixture (Krishna — exactly 10h, should **not** be broken): `backend/fixtures/kc-studio-evidence/krishnaBrokenShiftMay25.json`
