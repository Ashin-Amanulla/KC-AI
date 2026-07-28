# SCHADS A/B Test Report
**Date:** 2026-07-28  
**Award:** MA000100 — Social, Community, Home Care and Disability Services Industry Award  
**Effective rates basis:** PR799380 (1 Jul 2026)  
**Base rate used:** $30.00/h permanent part-time  
**Timezone:** Australia/Brisbane (+10:00, no DST)  

---

## Implementations Under Test

| Implementation | Path | Language | Entry Point |
|---|---|---|---|
| **KC AI Engine (Node)** | `backend/modules/pay-hours/services/payHoursCalculator.js` + `wageCalculator.js` | Node.js (ESM) | `computePayHoursForStaff()` → `calcGross()` |
| **Rust CLI** | `schads-calculator/src/lib.rs` | Rust 2021 | `calculate_pay(PayInput)` via JSON CLI |

The Node engine is the production system. The Rust CLI is a standalone validator built against the Award text.

---

## Test Harness

Script: `scripts/ab-schads-rust.mjs`  
Run: `node scripts/ab-schads-rust.mjs`

All 9 cases use identical inputs: same date, same wall-clock start/end (Brisbane +10:00), same $30 base rate, permanent part-time employment, disability_services stream. Node path uses `computePayHoursForStaff()` for hour classification then `calcGross()` multiplier fallback for dollar value.

---

## Results Summary

| # | Scenario | Node ($) | Rust ($) | Delta | Status |
|---|---|---|---|---|---|
| 1 | Ordinary weekday 09:00–17:00 | **240.00** | **240.00** | 0 | ✅ MATCH |
| 2 | Evening weekday 14:00–22:00 | **270.00** | **270.00** | 0 | ✅ MATCH |
| 3 | Saturday 09:00–17:00 | **360.00** | **360.00** | 0 | ✅ MATCH |
| 4 | Sunday 09:00–17:00 | **480.00** | **480.00** | 0 | ✅ MATCH |
| 5 | Public holiday 09:00–17:00 | **600.00** | **600.00** | 0 | ✅ MATCH |
| 6 | Minimum engagement 09:00–10:30 | **45.00** | **60.00** | +15.00 | ⚠️ DIFFER |
| 7 | Daily OT 07:00–19:00 (12 h) | **406.62** | **360.00** | −46.62 | ⚠️ DIFFER |
| 8 | Broken shift (2×2 h) | **140.82** | **141.81** | +0.99 | ⚠️ DIFFER |
| 9 | Sleepover 22:00–06:00 (8 h) | **0.00** | **55.86** | +55.86 | ⚠️ DIFFER |

**5 / 9 exact matches. 4 / 9 diverge.**

---

## Case-by-Case Analysis

### ✅ Cases 1–5 — Exact Match

All straight penalty-rate cases (daytime ×1.0, evening ×1.125, Saturday ×1.5, Sunday ×2.0, public holiday ×2.5) produce identical gross values. Both engines agree on the multiplier table and apply it identically to a clean 8-hour block with no OT, allowances, or crossings.

---

### ⚠️ Case 6 — Minimum Engagement (1.5 h shift)

| Engine | Hours classified | Rule applied | Gross |
|---|---|---|---|
| Node | 1.5 morningHours | **None** — pays actual hours only | $45.00 |
| Rust | 2.0 morningHours | **Cl. 10.3 minimum engagement = 2 h** | $60.00 |

**Root cause:** The Node `payHoursCalculator.js` records only actual shift hours into the pay-hours bucket. It does **not** pad to the 2-hour minimum engagement guarantee. The downstream `calcGross()` multiplies whatever hours arrive. The Rust crate applies Clause 10.3 inside `apply_minimum_engagement()` before billing.

**Award position (MA000100 Cl. 10.3):** "A casual or part-time employee called in to work on any day will be paid a minimum of 2 ordinary hours." The Award requires $60.00 for this shift, not $45.00.

**Risk: Node underpays by $15.00 per sub-2-hour shift for part-time/casual workers.** The Node engine relies on the upstream roster system never scheduling a shift under 2 hours; if such a shift is imported from ShiftCare, it will silently underpay.

---

### ⚠️ Case 7 — Daily Overtime (12 h weekday shift)

| Engine | Hours classified | Rule applied | Gross |
|---|---|---|---|
| Node | 10 morningHours + 2 weekdayOtUpto2 + 1 mealAllowanceCount | Daily OT kicks in after 10 h ordinary | $406.62 |
| Rust | 12 morningHours (no OT) | No daily OT; applies weekly OT cap only | $360.00 |

**Root cause:** The Rust `apply_overtime()` only applies a **weekly 76-hour** OT threshold. It does **not** implement the **daily** OT trigger (>10 h on a single day → remaining hours at 1.5×, then >12 h at 2.0×). The Node engine correctly detects daily OT via `payHoursCalculator.js` shift-chain analysis.

Additionally, the Node engine adds a `mealAllowanceCount: 1` ($16.62) for shifts >10 h, which the Rust CLI omits (no auto-meal-allowance logic from shift duration).

**Award position (MA000100 Cl. 25.1):** Daily OT applies after the maximum ordinary daily span. The Rust implementation is missing this entire rule.

**Risk: Rust underpays by $46.62 on long weekday shifts. Node is correct here.**

---

### ⚠️ Case 8 — Broken Shift Allowance ($0.99 delta)

| Engine | Hours | Allowance applied | Gross |
|---|---|---|---|
| Node | 4 morningHours, brokenShiftCount: 1 | $20.82 (BROKEN_ALLOWANCE_1) | $140.82 |
| Rust | 4 morningHours, 1 broken shift | $21.81 (`BrokenShiftAllowance`) | $141.81 |

**Root cause:** Allowance constant mismatch.
- Node: `BROKEN_ALLOWANCE_1 = 20.82` (hardcoded FY2025-26 fallback in `wageCalculator.js` line 18)
- Rust: $21.81 (derived from PR799380 rate table in `src/lib.rs`)

**Which is correct?** The PR799380 (1 Jul 2026) broken shift allowance under MA000100 Cl. 20.1 should be checked against the official pay guide. The $0.99 difference suggests the Node fallback constant has **not been updated** to the FY2026-27 (1 Jul 2026) rate. The `applyAwardConstants()` hydration path in Node would override this at runtime if the award-rates DB seed is current — but the hardcoded fallback is stale.

**Risk: If the award-rates DB seed was not updated for FY2026-27, all broken-shift calculations using the fallback underpay by $0.99 per occurrence.**

---

### ⚠️ Case 9 — Sleepover 22:00–06:00 (8 h)

| Engine | Rule applied | Gross |
|---|---|---|
| Node | 8 h sleepover → `sleepoversCount: 1`, $0 gross (no rate card, multiplier path gives $0) | $0.00 |
| Rust | 8 h sleepover → `apply_sleepover()` → flat allowance $55.86 | $55.86 |

**Root cause — two separate issues:**

1. **Node returns $0 because the multiplier path (`calcGross`) has no sleepover rate.** `calcGross()` does not include `sleepoversCount` multiplied by any value; it is only handled in `calcGrossFromRates()` (the rate-card path). When a staff member has no rate card uploaded, `calcGross()` is used and sleepover is silently ignored.

2. **The Rust CLI applies a flat $55.86 allowance.** This figure is the Rust crate's `SLEEPOVER_ALLOWANCE` constant. The actual MA000100 sleepover allowance (Cl. 20.3) is a fixed dollar amount per sleepover, but the exact amount must be verified against the current pay guide.

**Risk: Node silently pays $0 for sleepover shifts when using the multiplier fallback path (no rate card). This is the most significant payroll risk identified. Any staff without an uploaded rate card will receive $0 for every sleepover.**

---

## Supporting Test Results

### Node internal parity tests (wageParity.test.js)
```
✔ ot76GlobalTier: frontend and backend copies are code-identical
✔ calcGrossFromRates parity across sample pay-hours
✔ calcBreakdownFromRates parity (gross + line items)
✔ calcGross multiplier-fallback parity (casual + permanent)
✔ calcAllowances parity
5 pass, 0 fail
```
Frontend and backend JS wage layers are identical — no divergence risk there.

### Rust unit/integration tests
```
✔ casual_loading (unit)
✔ casual_public_holiday_is_275_percent_inclusive_of_casual_loading
✔ home_care_casual_shift_has_two_hour_minimum_engagement
✔ casual_saturday_is_175_percent_inclusive_of_casual_loading
4 pass, 0 fail
```

---

## Risk Register

| ID | Severity | Component | Issue | Recommended Action |
|---|---|---|---|---|
| R1 | **HIGH** | Node engine | Sleepover $0 on multiplier path (no rate card) | Add `sleepoversCount * SLEEPOVER_ALLOWANCE` to `calcGross()` |
| R2 | **HIGH** | Rust CLI | No daily OT rule (>10 h weekday) | Implement `apply_daily_overtime()` in `src/lib.rs` |
| R3 | **MEDIUM** | Node engine | Minimum engagement not enforced (sub-2h shifts) | Add 2h minimum pad in `payHoursCalculator.js` or gate at CSV import |
| R4 | **MEDIUM** | Node engine | Broken shift allowance fallback constant stale ($20.82 vs $21.81) | Update `BROKEN_ALLOWANCE_1` to FY2026-27 figure; verify against current pay guide |
| R5 | **LOW** | Rust CLI | No meal allowance auto-trigger from shift duration | Implement duration-triggered meal allowance in `apply_allowances()` |
| R6 | **LOW** | Rust CLI | Sleepover allowance amount unverified against PR799380 pay guide | Cross-check `SLEEPOVER_ALLOWANCE` constant against current Fair Work pay guide |

---

## Scope Limitations

- **Weekly OT (76-h cap):** Not exercised in this fixture set. Both engines claim to implement it; dedicated multi-shift fixtures required.
- **Nursing support stream:** Not tested; Node has nursing rate card path (`nursingCareHours`, `nursingDaytime`), Rust does not yet distinguish streams in hour classification.
- **Rate-card path (calcGrossFromRates):** Not A/B tested here. The 5-test wageParity.test.js suite covers frontend/backend parity on rate cards only; no Rust equivalent tested.
- **Casual loading:** Rust tests confirm casual loading math; not exercised in this permanent-rate A/B run.
- **Christmas Eve 6pm rule:** Not in this fixture. Node handles it (payHoursCalculator.test.js has coverage); Rust status unknown.

---

## Conclusion

**5 of 9 core SCHADS scenarios match exactly** between Node and Rust — all clean penalty-rate shifts (day, evening, Saturday, Sunday, public holiday) agree to the cent.

**4 scenarios diverge**, revealing real gaps in both implementations:
- The **Node engine** is missing minimum engagement enforcement and sleepover pay on the multiplier path, and carries a potentially stale broken-shift allowance constant.
- The **Rust CLI** is missing daily overtime and meal allowance auto-trigger, and has not been fully validated on allowance amounts.

The Node production engine is correct on overtime (daily OT, R2 is a Rust gap), but carries three payroll risks (R1, R3, R4) that should be addressed before the sleepover/minimum-engagement/FY2026-27 allowance scenarios arise in production.
