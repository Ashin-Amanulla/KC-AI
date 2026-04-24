# Payroll vs calculator: negative difference (Gross < Payroll)

**Negative difference** = this report’s *Gross* minus *Payroll* is **&lt; 0** (calculator lower than imported payroll).

## Assumptions in this report

- **Scheduler file:** `/home/cntrlx/Downloads/Scheduler_Timesheet_Export_2026-04-24-01-37.csv`
- **Payroll file:** `/home/cntrlx/Downloads/Payroll Employee Summary - FN ending 19th April (2).xlsx`
- **Gross** uses `calcGrossFromRates` per employee when a row exists in the staff rates file (**`/home/cntrlx/Downloads/Support Staff Rates.xlsx`**, `170` people); otherwise `calcGross` at **$35/h casual** — same pattern as **SchadsCalculator** / `scripts/audit-calculator-vs-payroll.mjs` with a rates arg.
- **Gross from staff rates (matched names):** 150 / 169 staff; **flat fallback:** 19 staff.
- **Roster date span (included shifts):** 2026-04-05T20:00:00.000Z → 2026-04-19T23:00:00.000Z
- **Parse issues:** 2 row message(s); **0** of the people below have at least one failed CSV row attributed to their name.

---

## Summary — why Gross can still be below Payroll

- **This run:** **98** matched people with **Gross &lt; Payroll** — **88** use **per-staff rates** (`calcGrossFromRates`); **10** have **no** rates row (still on **$35/h** fallback) — add/fix names in `/home/cntrlx/Downloads/Support Staff Rates.xlsx` for them.
- **Name alignment:** **21** staff in the **scheduler CSV** have **no** payroll earnings row (strings differ, e.g. nicknames); **19** payroll people are **not** in this CSV — comparisons and sums will not line up until names match.
- **CSV parse:** **2** row(s) dropped (e.g. unknown shift type) — if those hours matter, add them to `SHIFT_TYPE_MAP` or they stay out of **all** staff hours.
- **Scope:** Roster window (above) vs payroll fortnight may differ; payroll can include **leave, back pay, allowances not in the rates columns, on-call**, etc., which this engine does not add automatically.
- **Even with correct rates:** if **Payroll ÷ hours** is still far above **Gross ÷ hours** (see each table), payroll is paying **more per hour** than the rate grid in the file for that run — check the pay run detail, not only the rate export.

---

## People (98)

### Syed Saifuddin Minallah

| Field | Value |
| --- | --- |
| Payroll (import) | $4399.07 |
| Gross (this report) | $2050.61 |
| Diff (Gross − Payroll) | **$-2348.46** (-114.52% of gross) |
| Pay-hours total (excl. sleepover allowance hours in total) | 38.5 h |
| Implied $/h (Payroll ÷ pay-hours) | ~$114.26/h |
| Implied $/h (Gross ÷ pay-hours) | ~$53.26/h (from per-staff rates xlsx) |
| Staff rates row in xlsx? | **Yes** (normName match) |
| Weekday band mix (afternoon+night share of m+a+n) | 20% |

**Why Gross is below Payroll (most likely first)**

1. **Gross** used **`calcGrossFromRates`** from the staff-rates xlsx. Remaining gap vs payroll is usually **period/scope** (roster vs FN), **extra pay lines** in payroll, or **name spelling** (rates row is a different person).
2. **Implied rate gap:** payroll ~$114.26/h vs gross ~$53.26/h across these hours — **items in payroll** not in the formula (e.g. leave, allowances outside sheet), or **rate column mismatch** (export not same as pay run).
3. **Period / scope:** roster span may not match the payroll fortnight; payroll can include **leave, adjustments, on-call, or other lines** not in the scheduler CSV.
4. **No** parse-failed rows attributed to this staff name in the CSV error list (other staff may still have failed rows).

### Sonney Davis

| Field | Value |
| --- | --- |
| Payroll (import) | $1729.84 |
| Gross (this report) | $924.00 |
| Diff (Gross − Payroll) | **$-805.84** (-87.21% of gross) |
| Pay-hours total (excl. sleepover allowance hours in total) | 24 h |
| Implied $/h (Payroll ÷ pay-hours) | ~$72.08/h |
| Implied $/h (Gross ÷ pay-hours) | ~$38.50/h (at $35 casual default) |
| Staff rates row in xlsx? | **No** (normName match) |
| Weekday band mix (afternoon+night share of m+a+n) | 100% |

**Why Gross is below Payroll (most likely first)**

1. **No staff-rates match** for this name — this report used **$35/h** casual `calcGross` for them. If the calculator in the app shows a rate from your rates XLSX, **re-run** with the same `[staff-rates.xlsx]` so gross matches.
2. **Implied rate gap:** payroll ~$72.08/h vs gross ~$38.50/h across these hours — **higher** rates in payroll than a **$35** casual build, or **items not modelled** in the flat build.
3. **Period / scope:** roster span may not match the payroll fortnight; payroll can include **leave, adjustments, on-call, or other lines** not in the scheduler CSV.
4. **High afternoon/night share (100%)** — more penalty loading; small errors in **band split** (or sleepover follow-on) change dollars; payroll may use different treatment.
5. **No** parse-failed rows attributed to this staff name in the CSV error list (other staff may still have failed rows).

### Jess Josephine Verave

| Field | Value |
| --- | --- |
| Payroll (import) | $3146.55 |
| Gross (this report) | $2348.50 |
| Diff (Gross − Payroll) | **$-798.05** (-33.98% of gross) |
| Pay-hours total (excl. sleepover allowance hours in total) | 55.5 h |
| Implied $/h (Payroll ÷ pay-hours) | ~$56.69/h |
| Implied $/h (Gross ÷ pay-hours) | ~$42.32/h (at $35 casual default) |
| Staff rates row in xlsx? | **No** (normName match) |
| Weekday band mix (afternoon+night share of m+a+n) | 0% |

**Why Gross is below Payroll (most likely first)**

1. **No staff-rates match** for this name — this report used **$35/h** casual `calcGross` for them. If the calculator in the app shows a rate from your rates XLSX, **re-run** with the same `[staff-rates.xlsx]` so gross matches.
2. **Implied rate gap:** payroll ~$56.69/h vs gross ~$42.32/h across these hours — **higher** rates in payroll than a **$35** casual build, or **items not modelled** in the flat build.
3. **Period / scope:** roster span may not match the payroll fortnight; payroll can include **leave, adjustments, on-call, or other lines** not in the scheduler CSV.
4. **No** parse-failed rows attributed to this staff name in the CSV error list (other staff may still have failed rows).

### Annmary Davis

| Field | Value |
| --- | --- |
| Payroll (import) | $2840.56 |
| Gross (this report) | $2217.14 |
| Diff (Gross − Payroll) | **$-623.42** (-28.12% of gross) |
| Pay-hours total (excl. sleepover allowance hours in total) | 48 h |
| Implied $/h (Payroll ÷ pay-hours) | ~$59.18/h |
| Implied $/h (Gross ÷ pay-hours) | ~$46.19/h (from per-staff rates xlsx) |
| Staff rates row in xlsx? | **Yes** (normName match) |
| Weekday band mix (afternoon+night share of m+a+n) | 100% |

**Why Gross is below Payroll (most likely first)**

1. **Gross** used **`calcGrossFromRates`** from the staff-rates xlsx. Remaining gap vs payroll is usually **period/scope** (roster vs FN), **extra pay lines** in payroll, or **name spelling** (rates row is a different person).
2. **Implied rate gap:** payroll ~$59.18/h vs gross ~$46.19/h across these hours — **items in payroll** not in the formula (e.g. leave, allowances outside sheet), or **rate column mismatch** (export not same as pay run).
3. **Period / scope:** roster span may not match the payroll fortnight; payroll can include **leave, adjustments, on-call, or other lines** not in the scheduler CSV.
4. **High afternoon/night share (100%)** — more penalty loading; small errors in **band split** (or sleepover follow-on) change dollars; payroll may use different treatment.
5. **No** parse-failed rows attributed to this staff name in the CSV error list (other staff may still have failed rows).

### Silvester Jose

| Field | Value |
| --- | --- |
| Payroll (import) | $3014.16 |
| Gross (this report) | $2534.72 |
| Diff (Gross − Payroll) | **$-479.44** (-18.91% of gross) |
| Pay-hours total (excl. sleepover allowance hours in total) | 64 h |
| Implied $/h (Payroll ÷ pay-hours) | ~$47.10/h |
| Implied $/h (Gross ÷ pay-hours) | ~$39.60/h (from per-staff rates xlsx) |
| Staff rates row in xlsx? | **Yes** (normName match) |
| Weekday band mix (afternoon+night share of m+a+n) | 67% |

**Why Gross is below Payroll (most likely first)**

1. **Gross** used **`calcGrossFromRates`** from the staff-rates xlsx. Remaining gap vs payroll is usually **period/scope** (roster vs FN), **extra pay lines** in payroll, or **name spelling** (rates row is a different person).
2. **Implied rate gap:** payroll ~$47.10/h vs gross ~$39.60/h across these hours — **items in payroll** not in the formula (e.g. leave, allowances outside sheet), or **rate column mismatch** (export not same as pay run).
3. **Period / scope:** roster span may not match the payroll fortnight; payroll can include **leave, adjustments, on-call, or other lines** not in the scheduler CSV.
4. **High afternoon/night share (67%)** — more penalty loading; small errors in **band split** (or sleepover follow-on) change dollars; payroll may use different treatment.
5. **No** parse-failed rows attributed to this staff name in the CSV error list (other staff may still have failed rows).

### Aini-Alem Goitom

| Field | Value |
| --- | --- |
| Payroll (import) | $2177.36 |
| Gross (this report) | $1711.97 |
| Diff (Gross − Payroll) | **$-465.39** (-27.18% of gross) |
| Pay-hours total (excl. sleepover allowance hours in total) | 37.5 h |
| Implied $/h (Payroll ÷ pay-hours) | ~$58.06/h |
| Implied $/h (Gross ÷ pay-hours) | ~$45.65/h (from per-staff rates xlsx) |
| Staff rates row in xlsx? | **Yes** (normName match) |
| Weekday band mix (afternoon+night share of m+a+n) | 12% |

**Why Gross is below Payroll (most likely first)**

1. **Gross** used **`calcGrossFromRates`** from the staff-rates xlsx. Remaining gap vs payroll is usually **period/scope** (roster vs FN), **extra pay lines** in payroll, or **name spelling** (rates row is a different person).
2. **Implied rate gap:** payroll ~$58.06/h vs gross ~$45.65/h across these hours — **items in payroll** not in the formula (e.g. leave, allowances outside sheet), or **rate column mismatch** (export not same as pay run).
3. **Period / scope:** roster span may not match the payroll fortnight; payroll can include **leave, adjustments, on-call, or other lines** not in the scheduler CSV.
4. **No** parse-failed rows attributed to this staff name in the CSV error list (other staff may still have failed rows).

### Alan Abraham

| Field | Value |
| --- | --- |
| Payroll (import) | $2883.33 |
| Gross (this report) | $2426.13 |
| Diff (Gross − Payroll) | **$-457.20** (-18.84% of gross) |
| Pay-hours total (excl. sleepover allowance hours in total) | 54 h |
| Implied $/h (Payroll ÷ pay-hours) | ~$53.40/h |
| Implied $/h (Gross ÷ pay-hours) | ~$44.93/h (from per-staff rates xlsx) |
| Staff rates row in xlsx? | **Yes** (normName match) |
| Weekday band mix (afternoon+night share of m+a+n) | 0% |

**Why Gross is below Payroll (most likely first)**

1. **Gross** used **`calcGrossFromRates`** from the staff-rates xlsx. Remaining gap vs payroll is usually **period/scope** (roster vs FN), **extra pay lines** in payroll, or **name spelling** (rates row is a different person).
2. **Implied rate gap:** payroll ~$53.40/h vs gross ~$44.93/h across these hours — **items in payroll** not in the formula (e.g. leave, allowances outside sheet), or **rate column mismatch** (export not same as pay run).
3. **Period / scope:** roster span may not match the payroll fortnight; payroll can include **leave, adjustments, on-call, or other lines** not in the scheduler CSV.
4. **No** parse-failed rows attributed to this staff name in the CSV error list (other staff may still have failed rows).

### Chloe Genette Thompson

| Field | Value |
| --- | --- |
| Payroll (import) | $2169.24 |
| Gross (this report) | $1745.60 |
| Diff (Gross − Payroll) | **$-423.64** (-24.27% of gross) |
| Pay-hours total (excl. sleepover allowance hours in total) | 44.5 h |
| Implied $/h (Payroll ÷ pay-hours) | ~$48.75/h |
| Implied $/h (Gross ÷ pay-hours) | ~$39.23/h (at $35 casual default) |
| Staff rates row in xlsx? | **No** (normName match) |
| Weekday band mix (afternoon+night share of m+a+n) | 0% |

**Why Gross is below Payroll (most likely first)**

1. **No staff-rates match** for this name — this report used **$35/h** casual `calcGross` for them. If the calculator in the app shows a rate from your rates XLSX, **re-run** with the same `[staff-rates.xlsx]` so gross matches.
2. **Implied rate gap:** payroll ~$48.75/h vs gross ~$39.23/h across these hours — **higher** rates in payroll than a **$35** casual build, or **items not modelled** in the flat build.
3. **Period / scope:** roster span may not match the payroll fortnight; payroll can include **leave, adjustments, on-call, or other lines** not in the scheduler CSV.
4. **No** parse-failed rows attributed to this staff name in the CSV error list (other staff may still have failed rows).

### Choki Dorji

| Field | Value |
| --- | --- |
| Payroll (import) | $775.39 |
| Gross (this report) | $352.45 |
| Diff (Gross − Payroll) | **$-422.94** (-120% of gross) |
| Pay-hours total (excl. sleepover allowance hours in total) | 9.5 h |
| Implied $/h (Payroll ÷ pay-hours) | ~$81.62/h |
| Implied $/h (Gross ÷ pay-hours) | ~$37.10/h (from per-staff rates xlsx) |
| Staff rates row in xlsx? | **Yes** (normName match) |
| Weekday band mix (afternoon+night share of m+a+n) | 0% |

**Why Gross is below Payroll (most likely first)**

1. **Gross** used **`calcGrossFromRates`** from the staff-rates xlsx. Remaining gap vs payroll is usually **period/scope** (roster vs FN), **extra pay lines** in payroll, or **name spelling** (rates row is a different person).
2. **Implied rate gap:** payroll ~$81.62/h vs gross ~$37.10/h across these hours — **items in payroll** not in the formula (e.g. leave, allowances outside sheet), or **rate column mismatch** (export not same as pay run).
3. **Period / scope:** roster span may not match the payroll fortnight; payroll can include **leave, adjustments, on-call, or other lines** not in the scheduler CSV.
4. **No** parse-failed rows attributed to this staff name in the CSV error list (other staff may still have failed rows).

### Fathima Mahamood

| Field | Value |
| --- | --- |
| Payroll (import) | $2264.39 |
| Gross (this report) | $1844.50 |
| Diff (Gross − Payroll) | **$-419.89** (-22.76% of gross) |
| Pay-hours total (excl. sleepover allowance hours in total) | 37 h |
| Implied $/h (Payroll ÷ pay-hours) | ~$61.20/h |
| Implied $/h (Gross ÷ pay-hours) | ~$49.85/h (at $35 casual default) |
| Staff rates row in xlsx? | **No** (normName match) |
| Weekday band mix (afternoon+night share of m+a+n) | 100% |

**Why Gross is below Payroll (most likely first)**

1. **No staff-rates match** for this name — this report used **$35/h** casual `calcGross` for them. If the calculator in the app shows a rate from your rates XLSX, **re-run** with the same `[staff-rates.xlsx]` so gross matches.
2. **Implied rate gap:** payroll ~$61.20/h vs gross ~$49.85/h across these hours — **higher** rates in payroll than a **$35** casual build, or **items not modelled** in the flat build.
3. **Period / scope:** roster span may not match the payroll fortnight; payroll can include **leave, adjustments, on-call, or other lines** not in the scheduler CSV.
4. **High afternoon/night share (100%)** — more penalty loading; small errors in **band split** (or sleepover follow-on) change dollars; payroll may use different treatment.
5. **No** parse-failed rows attributed to this staff name in the CSV error list (other staff may still have failed rows).

### Amala Benoy

| Field | Value |
| --- | --- |
| Payroll (import) | $3918.97 |
| Gross (this report) | $3499.85 |
| Diff (Gross − Payroll) | **$-419.12** (-11.98% of gross) |
| Pay-hours total (excl. sleepover allowance hours in total) | 72.5 h |
| Implied $/h (Payroll ÷ pay-hours) | ~$54.05/h |
| Implied $/h (Gross ÷ pay-hours) | ~$48.27/h (from per-staff rates xlsx) |
| Staff rates row in xlsx? | **Yes** (normName match) |
| Weekday band mix (afternoon+night share of m+a+n) | 88% |

**Why Gross is below Payroll (most likely first)**

1. **Gross** used **`calcGrossFromRates`** from the staff-rates xlsx. Remaining gap vs payroll is usually **period/scope** (roster vs FN), **extra pay lines** in payroll, or **name spelling** (rates row is a different person).
2. **Implied rate gap:** payroll ~$54.05/h vs gross ~$48.27/h across these hours — **items in payroll** not in the formula (e.g. leave, allowances outside sheet), or **rate column mismatch** (export not same as pay run).
3. **Period / scope:** roster span may not match the payroll fortnight; payroll can include **leave, adjustments, on-call, or other lines** not in the scheduler CSV.
4. **High afternoon/night share (88%)** — more penalty loading; small errors in **band split** (or sleepover follow-on) change dollars; payroll may use different treatment.
5. **No** parse-failed rows attributed to this staff name in the CSV error list (other staff may still have failed rows).

### Rhiannon Camiller

| Field | Value |
| --- | --- |
| Payroll (import) | $3055.95 |
| Gross (this report) | $2643.66 |
| Diff (Gross − Payroll) | **$-412.29** (-15.6% of gross) |
| Pay-hours total (excl. sleepover allowance hours in total) | 58 h |
| Implied $/h (Payroll ÷ pay-hours) | ~$52.69/h |
| Implied $/h (Gross ÷ pay-hours) | ~$45.58/h (from per-staff rates xlsx) |
| Staff rates row in xlsx? | **Yes** (normName match) |
| Weekday band mix (afternoon+night share of m+a+n) | 0% |

**Why Gross is below Payroll (most likely first)**

1. **Gross** used **`calcGrossFromRates`** from the staff-rates xlsx. Remaining gap vs payroll is usually **period/scope** (roster vs FN), **extra pay lines** in payroll, or **name spelling** (rates row is a different person).
2. **Implied rate gap:** payroll ~$52.69/h vs gross ~$45.58/h across these hours — **items in payroll** not in the formula (e.g. leave, allowances outside sheet), or **rate column mismatch** (export not same as pay run).
3. **Period / scope:** roster span may not match the payroll fortnight; payroll can include **leave, adjustments, on-call, or other lines** not in the scheduler CSV.
4. **No** parse-failed rows attributed to this staff name in the CSV error list (other staff may still have failed rows).

### Kelvin Kunjumon Thomas

| Field | Value |
| --- | --- |
| Payroll (import) | $2773.68 |
| Gross (this report) | $2362.20 |
| Diff (Gross − Payroll) | **$-411.48** (-17.42% of gross) |
| Pay-hours total (excl. sleepover allowance hours in total) | 52 h |
| Implied $/h (Payroll ÷ pay-hours) | ~$53.34/h |
| Implied $/h (Gross ÷ pay-hours) | ~$45.43/h (from per-staff rates xlsx) |
| Staff rates row in xlsx? | **Yes** (normName match) |
| Weekday band mix (afternoon+night share of m+a+n) | 0% |

**Why Gross is below Payroll (most likely first)**

1. **Gross** used **`calcGrossFromRates`** from the staff-rates xlsx. Remaining gap vs payroll is usually **period/scope** (roster vs FN), **extra pay lines** in payroll, or **name spelling** (rates row is a different person).
2. **Implied rate gap:** payroll ~$53.34/h vs gross ~$45.43/h across these hours — **items in payroll** not in the formula (e.g. leave, allowances outside sheet), or **rate column mismatch** (export not same as pay run).
3. **Period / scope:** roster span may not match the payroll fortnight; payroll can include **leave, adjustments, on-call, or other lines** not in the scheduler CSV.
4. **No** parse-failed rows attributed to this staff name in the CSV error list (other staff may still have failed rows).

### Tina Hallett

| Field | Value |
| --- | --- |
| Payroll (import) | $1135.95 |
| Gross (this report) | $724.75 |
| Diff (Gross − Payroll) | **$-411.20** (-56.74% of gross) |
| Pay-hours total (excl. sleepover allowance hours in total) | 20 h |
| Implied $/h (Payroll ÷ pay-hours) | ~$56.80/h |
| Implied $/h (Gross ÷ pay-hours) | ~$36.24/h (at $35 casual default) |
| Staff rates row in xlsx? | **No** (normName match) |
| Weekday band mix (afternoon+night share of m+a+n) | 0% |

**Why Gross is below Payroll (most likely first)**

1. **No staff-rates match** for this name — this report used **$35/h** casual `calcGross` for them. If the calculator in the app shows a rate from your rates XLSX, **re-run** with the same `[staff-rates.xlsx]` so gross matches.
2. **Implied rate gap:** payroll ~$56.80/h vs gross ~$36.24/h across these hours — **higher** rates in payroll than a **$35** casual build, or **items not modelled** in the flat build.
3. **Period / scope:** roster span may not match the payroll fortnight; payroll can include **leave, adjustments, on-call, or other lines** not in the scheduler CSV.
4. **No** parse-failed rows attributed to this staff name in the CSV error list (other staff may still have failed rows).

### Jacinta Gichuhi

| Field | Value |
| --- | --- |
| Payroll (import) | $1073.88 |
| Gross (this report) | $668.76 |
| Diff (Gross − Payroll) | **$-405.12** (-60.58% of gross) |
| Pay-hours total (excl. sleepover allowance hours in total) | 15 h |
| Implied $/h (Payroll ÷ pay-hours) | ~$71.59/h |
| Implied $/h (Gross ÷ pay-hours) | ~$44.58/h (from per-staff rates xlsx) |
| Staff rates row in xlsx? | **Yes** (normName match) |
| Weekday band mix (afternoon+night share of m+a+n) | 40% |

**Why Gross is below Payroll (most likely first)**

1. **Gross** used **`calcGrossFromRates`** from the staff-rates xlsx. Remaining gap vs payroll is usually **period/scope** (roster vs FN), **extra pay lines** in payroll, or **name spelling** (rates row is a different person).
2. **Implied rate gap:** payroll ~$71.59/h vs gross ~$44.58/h across these hours — **items in payroll** not in the formula (e.g. leave, allowances outside sheet), or **rate column mismatch** (export not same as pay run).
3. **Period / scope:** roster span may not match the payroll fortnight; payroll can include **leave, adjustments, on-call, or other lines** not in the scheduler CSV.
4. **No** parse-failed rows attributed to this staff name in the CSV error list (other staff may still have failed rows).

### Nanise Mafi

| Field | Value |
| --- | --- |
| Payroll (import) | $4470.93 |
| Gross (this report) | $4076.37 |
| Diff (Gross − Payroll) | **$-394.56** (-9.68% of gross) |
| Pay-hours total (excl. sleepover allowance hours in total) | 79.5 h |
| Implied $/h (Payroll ÷ pay-hours) | ~$56.24/h |
| Implied $/h (Gross ÷ pay-hours) | ~$51.28/h (from per-staff rates xlsx) |
| Staff rates row in xlsx? | **Yes** (normName match) |
| Weekday band mix (afternoon+night share of m+a+n) | 0% |

**Why Gross is below Payroll (most likely first)**

1. **Gross** used **`calcGrossFromRates`** from the staff-rates xlsx. Remaining gap vs payroll is usually **period/scope** (roster vs FN), **extra pay lines** in payroll, or **name spelling** (rates row is a different person).
2. **Implied rate gap:** payroll ~$56.24/h vs gross ~$51.28/h across these hours — **items in payroll** not in the formula (e.g. leave, allowances outside sheet), or **rate column mismatch** (export not same as pay run).
3. **Period / scope:** roster span may not match the payroll fortnight; payroll can include **leave, adjustments, on-call, or other lines** not in the scheduler CSV.
4. **No** parse-failed rows attributed to this staff name in the CSV error list (other staff may still have failed rows).

### Jyothis Elizebath

| Field | Value |
| --- | --- |
| Payroll (import) | $2383.40 |
| Gross (this report) | $1991.40 |
| Diff (Gross − Payroll) | **$-392.00** (-19.68% of gross) |
| Pay-hours total (excl. sleepover allowance hours in total) | 44 h |
| Implied $/h (Payroll ÷ pay-hours) | ~$54.17/h |
| Implied $/h (Gross ÷ pay-hours) | ~$45.26/h (from per-staff rates xlsx) |
| Staff rates row in xlsx? | **Yes** (normName match) |
| Weekday band mix (afternoon+night share of m+a+n) | 50% |

**Why Gross is below Payroll (most likely first)**

1. **Gross** used **`calcGrossFromRates`** from the staff-rates xlsx. Remaining gap vs payroll is usually **period/scope** (roster vs FN), **extra pay lines** in payroll, or **name spelling** (rates row is a different person).
2. **Implied rate gap:** payroll ~$54.17/h vs gross ~$45.26/h across these hours — **items in payroll** not in the formula (e.g. leave, allowances outside sheet), or **rate column mismatch** (export not same as pay run).
3. **Period / scope:** roster span may not match the payroll fortnight; payroll can include **leave, adjustments, on-call, or other lines** not in the scheduler CSV.
4. **High afternoon/night share (50%)** — more penalty loading; small errors in **band split** (or sleepover follow-on) change dollars; payroll may use different treatment.
5. **No** parse-failed rows attributed to this staff name in the CSV error list (other staff may still have failed rows).

### Kaiyu Lumsdon

| Field | Value |
| --- | --- |
| Payroll (import) | $2123.92 |
| Gross (this report) | $1732.92 |
| Diff (Gross − Payroll) | **$-391.00** (-22.56% of gross) |
| Pay-hours total (excl. sleepover allowance hours in total) | 42 h |
| Implied $/h (Payroll ÷ pay-hours) | ~$50.57/h |
| Implied $/h (Gross ÷ pay-hours) | ~$41.26/h (from per-staff rates xlsx) |
| Staff rates row in xlsx? | **Yes** (normName match) |
| Weekday band mix (afternoon+night share of m+a+n) | 0% |

**Why Gross is below Payroll (most likely first)**

1. **Gross** used **`calcGrossFromRates`** from the staff-rates xlsx. Remaining gap vs payroll is usually **period/scope** (roster vs FN), **extra pay lines** in payroll, or **name spelling** (rates row is a different person).
2. **Implied rate gap:** payroll ~$50.57/h vs gross ~$41.26/h across these hours — **items in payroll** not in the formula (e.g. leave, allowances outside sheet), or **rate column mismatch** (export not same as pay run).
3. **Period / scope:** roster span may not match the payroll fortnight; payroll can include **leave, adjustments, on-call, or other lines** not in the scheduler CSV.
4. **No** parse-failed rows attributed to this staff name in the CSV error list (other staff may still have failed rows).

### Emeka Emmanuel Chike

| Field | Value |
| --- | --- |
| Payroll (import) | $2681.85 |
| Gross (this report) | $2303.00 |
| Diff (Gross − Payroll) | **$-378.85** (-16.45% of gross) |
| Pay-hours total (excl. sleepover allowance hours in total) | 50 h |
| Implied $/h (Payroll ÷ pay-hours) | ~$53.64/h |
| Implied $/h (Gross ÷ pay-hours) | ~$46.06/h (at $35 casual default) |
| Staff rates row in xlsx? | **No** (normName match) |
| Weekday band mix (afternoon+night share of m+a+n) | 100% |

**Why Gross is below Payroll (most likely first)**

1. **No staff-rates match** for this name — this report used **$35/h** casual `calcGross` for them. If the calculator in the app shows a rate from your rates XLSX, **re-run** with the same `[staff-rates.xlsx]` so gross matches.
2. **Implied rate gap:** payroll ~$53.64/h vs gross ~$46.06/h across these hours — **higher** rates in payroll than a **$35** casual build, or **items not modelled** in the flat build.
3. **Period / scope:** roster span may not match the payroll fortnight; payroll can include **leave, adjustments, on-call, or other lines** not in the scheduler CSV.
4. **High afternoon/night share (100%)** — more penalty loading; small errors in **band split** (or sleepover follow-on) change dollars; payroll may use different treatment.
5. **No** parse-failed rows attributed to this staff name in the CSV error list (other staff may still have failed rows).

### Fatu Wantee

| Field | Value |
| --- | --- |
| Payroll (import) | $1011.02 |
| Gross (this report) | $635.25 |
| Diff (Gross − Payroll) | **$-375.77** (-59.15% of gross) |
| Pay-hours total (excl. sleepover allowance hours in total) | 16.5 h |
| Implied $/h (Payroll ÷ pay-hours) | ~$61.27/h |
| Implied $/h (Gross ÷ pay-hours) | ~$38.50/h (at $35 casual default) |
| Staff rates row in xlsx? | **No** (normName match) |
| Weekday band mix (afternoon+night share of m+a+n) | 100% |

**Why Gross is below Payroll (most likely first)**

1. **No staff-rates match** for this name — this report used **$35/h** casual `calcGross` for them. If the calculator in the app shows a rate from your rates XLSX, **re-run** with the same `[staff-rates.xlsx]` so gross matches.
2. **Implied rate gap:** payroll ~$61.27/h vs gross ~$38.50/h across these hours — **higher** rates in payroll than a **$35** casual build, or **items not modelled** in the flat build.
3. **Period / scope:** roster span may not match the payroll fortnight; payroll can include **leave, adjustments, on-call, or other lines** not in the scheduler CSV.
4. **High afternoon/night share (100%)** — more penalty loading; small errors in **band split** (or sleepover follow-on) change dollars; payroll may use different treatment.
5. **No** parse-failed rows attributed to this staff name in the CSV error list (other staff may still have failed rows).

### Aneesh Aloshious

| Field | Value |
| --- | --- |
| Payroll (import) | $4431.99 |
| Gross (this report) | $4056.62 |
| Diff (Gross − Payroll) | **$-375.37** (-9.25% of gross) |
| Pay-hours total (excl. sleepover allowance hours in total) | 87.25 h |
| Implied $/h (Payroll ÷ pay-hours) | ~$50.80/h |
| Implied $/h (Gross ÷ pay-hours) | ~$46.49/h (from per-staff rates xlsx) |
| Staff rates row in xlsx? | **Yes** (normName match) |
| Weekday band mix (afternoon+night share of m+a+n) | 0% |

**Why Gross is below Payroll (most likely first)**

1. **Gross** used **`calcGrossFromRates`** from the staff-rates xlsx. Remaining gap vs payroll is usually **period/scope** (roster vs FN), **extra pay lines** in payroll, or **name spelling** (rates row is a different person).
2. **Implied rate gap:** payroll ~$50.80/h vs gross ~$46.49/h across these hours — **items in payroll** not in the formula (e.g. leave, allowances outside sheet), or **rate column mismatch** (export not same as pay run).
3. **Period / scope:** roster span may not match the payroll fortnight; payroll can include **leave, adjustments, on-call, or other lines** not in the scheduler CSV.
4. **No** parse-failed rows attributed to this staff name in the CSV error list (other staff may still have failed rows).

### Femina Hubert

| Field | Value |
| --- | --- |
| Payroll (import) | $3339.14 |
| Gross (this report) | $2963.78 |
| Diff (Gross − Payroll) | **$-375.36** (-12.66% of gross) |
| Pay-hours total (excl. sleepover allowance hours in total) | 63 h |
| Implied $/h (Payroll ÷ pay-hours) | ~$53.00/h |
| Implied $/h (Gross ÷ pay-hours) | ~$47.04/h (from per-staff rates xlsx) |
| Staff rates row in xlsx? | **Yes** (normName match) |
| Weekday band mix (afternoon+night share of m+a+n) | 0% |

**Why Gross is below Payroll (most likely first)**

1. **Gross** used **`calcGrossFromRates`** from the staff-rates xlsx. Remaining gap vs payroll is usually **period/scope** (roster vs FN), **extra pay lines** in payroll, or **name spelling** (rates row is a different person).
2. **Implied rate gap:** payroll ~$53.00/h vs gross ~$47.04/h across these hours — **items in payroll** not in the formula (e.g. leave, allowances outside sheet), or **rate column mismatch** (export not same as pay run).
3. **Period / scope:** roster span may not match the payroll fortnight; payroll can include **leave, adjustments, on-call, or other lines** not in the scheduler CSV.
4. **No** parse-failed rows attributed to this staff name in the CSV error list (other staff may still have failed rows).

### Benedict Iwunze

| Field | Value |
| --- | --- |
| Payroll (import) | $4669.60 |
| Gross (this report) | $4297.76 |
| Diff (Gross − Payroll) | **$-371.84** (-8.65% of gross) |
| Pay-hours total (excl. sleepover allowance hours in total) | 66 h |
| Implied $/h (Payroll ÷ pay-hours) | ~$70.75/h |
| Implied $/h (Gross ÷ pay-hours) | ~$65.12/h (from per-staff rates xlsx) |
| Staff rates row in xlsx? | **Yes** (normName match) |
| Weekday band mix (afternoon+night share of m+a+n) | 100% |

**Why Gross is below Payroll (most likely first)**

1. **Gross** used **`calcGrossFromRates`** from the staff-rates xlsx. Remaining gap vs payroll is usually **period/scope** (roster vs FN), **extra pay lines** in payroll, or **name spelling** (rates row is a different person).
2. **Implied rate gap:** payroll ~$70.75/h vs gross ~$65.12/h across these hours — **items in payroll** not in the formula (e.g. leave, allowances outside sheet), or **rate column mismatch** (export not same as pay run).
3. **Period / scope:** roster span may not match the payroll fortnight; payroll can include **leave, adjustments, on-call, or other lines** not in the scheduler CSV.
4. **High afternoon/night share (100%)** — more penalty loading; small errors in **band split** (or sleepover follow-on) change dollars; payroll may use different treatment.
5. **No** parse-failed rows attributed to this staff name in the CSV error list (other staff may still have failed rows).

### Marc Relizan

| Field | Value |
| --- | --- |
| Payroll (import) | $2254.38 |
| Gross (this report) | $1888.62 |
| Diff (Gross − Payroll) | **$-365.76** (-19.37% of gross) |
| Pay-hours total (excl. sleepover allowance hours in total) | 40 h |
| Implied $/h (Payroll ÷ pay-hours) | ~$56.36/h |
| Implied $/h (Gross ÷ pay-hours) | ~$47.22/h (from per-staff rates xlsx) |
| Staff rates row in xlsx? | **Yes** (normName match) |
| Weekday band mix (afternoon+night share of m+a+n) | 0% |

**Why Gross is below Payroll (most likely first)**

1. **Gross** used **`calcGrossFromRates`** from the staff-rates xlsx. Remaining gap vs payroll is usually **period/scope** (roster vs FN), **extra pay lines** in payroll, or **name spelling** (rates row is a different person).
2. **Implied rate gap:** payroll ~$56.36/h vs gross ~$47.22/h across these hours — **items in payroll** not in the formula (e.g. leave, allowances outside sheet), or **rate column mismatch** (export not same as pay run).
3. **Period / scope:** roster span may not match the payroll fortnight; payroll can include **leave, adjustments, on-call, or other lines** not in the scheduler CSV.
4. **No** parse-failed rows attributed to this staff name in the CSV error list (other staff may still have failed rows).

### Patrick Muzima

| Field | Value |
| --- | --- |
| Payroll (import) | $4976.68 |
| Gross (this report) | $4617.40 |
| Diff (Gross − Payroll) | **$-359.28** (-7.78% of gross) |
| Pay-hours total (excl. sleepover allowance hours in total) | 90 h |
| Implied $/h (Payroll ÷ pay-hours) | ~$55.30/h |
| Implied $/h (Gross ÷ pay-hours) | ~$51.30/h (from per-staff rates xlsx) |
| Staff rates row in xlsx? | **Yes** (normName match) |
| Weekday band mix (afternoon+night share of m+a+n) | 100% |

**Why Gross is below Payroll (most likely first)**

1. **Gross** used **`calcGrossFromRates`** from the staff-rates xlsx. Remaining gap vs payroll is usually **period/scope** (roster vs FN), **extra pay lines** in payroll, or **name spelling** (rates row is a different person).
2. **Implied rate gap:** payroll ~$55.30/h vs gross ~$51.30/h across these hours — **items in payroll** not in the formula (e.g. leave, allowances outside sheet), or **rate column mismatch** (export not same as pay run).
3. **Period / scope:** roster span may not match the payroll fortnight; payroll can include **leave, adjustments, on-call, or other lines** not in the scheduler CSV.
4. **High afternoon/night share (100%)** — more penalty loading; small errors in **band split** (or sleepover follow-on) change dollars; payroll may use different treatment.
5. **No** parse-failed rows attributed to this staff name in the CSV error list (other staff may still have failed rows).

### Sebin Sebastian

| Field | Value |
| --- | --- |
| Payroll (import) | $2255.68 |
| Gross (this report) | $1899.52 |
| Diff (Gross − Payroll) | **$-356.16** (-18.75% of gross) |
| Pay-hours total (excl. sleepover allowance hours in total) | 40 h |
| Implied $/h (Payroll ÷ pay-hours) | ~$56.39/h |
| Implied $/h (Gross ÷ pay-hours) | ~$47.49/h (from per-staff rates xlsx) |
| Staff rates row in xlsx? | **Yes** (normName match) |
| Weekday band mix (afternoon+night share of m+a+n) | 0% |

**Why Gross is below Payroll (most likely first)**

1. **Gross** used **`calcGrossFromRates`** from the staff-rates xlsx. Remaining gap vs payroll is usually **period/scope** (roster vs FN), **extra pay lines** in payroll, or **name spelling** (rates row is a different person).
2. **Implied rate gap:** payroll ~$56.39/h vs gross ~$47.49/h across these hours — **items in payroll** not in the formula (e.g. leave, allowances outside sheet), or **rate column mismatch** (export not same as pay run).
3. **Period / scope:** roster span may not match the payroll fortnight; payroll can include **leave, adjustments, on-call, or other lines** not in the scheduler CSV.
4. **No** parse-failed rows attributed to this staff name in the CSV error list (other staff may still have failed rows).

### Lesley Chepchumba

| Field | Value |
| --- | --- |
| Payroll (import) | $2428.00 |
| Gross (this report) | $2076.70 |
| Diff (Gross − Payroll) | **$-351.30** (-16.92% of gross) |
| Pay-hours total (excl. sleepover allowance hours in total) | 47.5 h |
| Implied $/h (Payroll ÷ pay-hours) | ~$51.12/h |
| Implied $/h (Gross ÷ pay-hours) | ~$43.72/h (from per-staff rates xlsx) |
| Staff rates row in xlsx? | **Yes** (normName match) |
| Weekday band mix (afternoon+night share of m+a+n) | 0% |

**Why Gross is below Payroll (most likely first)**

1. **Gross** used **`calcGrossFromRates`** from the staff-rates xlsx. Remaining gap vs payroll is usually **period/scope** (roster vs FN), **extra pay lines** in payroll, or **name spelling** (rates row is a different person).
2. **Implied rate gap:** payroll ~$51.12/h vs gross ~$43.72/h across these hours — **items in payroll** not in the formula (e.g. leave, allowances outside sheet), or **rate column mismatch** (export not same as pay run).
3. **Period / scope:** roster span may not match the payroll fortnight; payroll can include **leave, adjustments, on-call, or other lines** not in the scheduler CSV.
4. **No** parse-failed rows attributed to this staff name in the CSV error list (other staff may still have failed rows).

### Shreya Shony

| Field | Value |
| --- | --- |
| Payroll (import) | $1623.04 |
| Gross (this report) | $1275.28 |
| Diff (Gross − Payroll) | **$-347.76** (-27.27% of gross) |
| Pay-hours total (excl. sleepover allowance hours in total) | 32 h |
| Implied $/h (Payroll ÷ pay-hours) | ~$50.72/h |
| Implied $/h (Gross ÷ pay-hours) | ~$39.85/h (from per-staff rates xlsx) |
| Staff rates row in xlsx? | **Yes** (normName match) |
| Weekday band mix (afternoon+night share of m+a+n) | 0% |

**Why Gross is below Payroll (most likely first)**

1. **Gross** used **`calcGrossFromRates`** from the staff-rates xlsx. Remaining gap vs payroll is usually **period/scope** (roster vs FN), **extra pay lines** in payroll, or **name spelling** (rates row is a different person).
2. **Implied rate gap:** payroll ~$50.72/h vs gross ~$39.85/h across these hours — **items in payroll** not in the formula (e.g. leave, allowances outside sheet), or **rate column mismatch** (export not same as pay run).
3. **Period / scope:** roster span may not match the payroll fortnight; payroll can include **leave, adjustments, on-call, or other lines** not in the scheduler CSV.
4. **No** parse-failed rows attributed to this staff name in the CSV error list (other staff may still have failed rows).

### Alida Saji

| Field | Value |
| --- | --- |
| Payroll (import) | $2566.95 |
| Gross (this report) | $2228.59 |
| Diff (Gross − Payroll) | **$-338.36** (-15.18% of gross) |
| Pay-hours total (excl. sleepover allowance hours in total) | 45 h |
| Implied $/h (Payroll ÷ pay-hours) | ~$57.04/h |
| Implied $/h (Gross ÷ pay-hours) | ~$49.52/h (from per-staff rates xlsx) |
| Staff rates row in xlsx? | **Yes** (normName match) |
| Weekday band mix (afternoon+night share of m+a+n) | 100% |

**Why Gross is below Payroll (most likely first)**

1. **Gross** used **`calcGrossFromRates`** from the staff-rates xlsx. Remaining gap vs payroll is usually **period/scope** (roster vs FN), **extra pay lines** in payroll, or **name spelling** (rates row is a different person).
2. **Implied rate gap:** payroll ~$57.04/h vs gross ~$49.52/h across these hours — **items in payroll** not in the formula (e.g. leave, allowances outside sheet), or **rate column mismatch** (export not same as pay run).
3. **Period / scope:** roster span may not match the payroll fortnight; payroll can include **leave, adjustments, on-call, or other lines** not in the scheduler CSV.
4. **High afternoon/night share (100%)** — more penalty loading; small errors in **band split** (or sleepover follow-on) change dollars; payroll may use different treatment.
5. **No** parse-failed rows attributed to this staff name in the CSV error list (other staff may still have failed rows).

### Nora John

| Field | Value |
| --- | --- |
| Payroll (import) | $2597.00 |
| Gross (this report) | $2263.10 |
| Diff (Gross − Payroll) | **$-333.90** (-14.75% of gross) |
| Pay-hours total (excl. sleepover allowance hours in total) | 51 h |
| Implied $/h (Payroll ÷ pay-hours) | ~$50.92/h |
| Implied $/h (Gross ÷ pay-hours) | ~$44.37/h (from per-staff rates xlsx) |
| Staff rates row in xlsx? | **Yes** (normName match) |
| Weekday band mix (afternoon+night share of m+a+n) | 0% |

**Why Gross is below Payroll (most likely first)**

1. **Gross** used **`calcGrossFromRates`** from the staff-rates xlsx. Remaining gap vs payroll is usually **period/scope** (roster vs FN), **extra pay lines** in payroll, or **name spelling** (rates row is a different person).
2. **Implied rate gap:** payroll ~$50.92/h vs gross ~$44.37/h across these hours — **items in payroll** not in the formula (e.g. leave, allowances outside sheet), or **rate column mismatch** (export not same as pay run).
3. **Period / scope:** roster span may not match the payroll fortnight; payroll can include **leave, adjustments, on-call, or other lines** not in the scheduler CSV.
4. **No** parse-failed rows attributed to this staff name in the CSV error list (other staff may still have failed rows).

### Passang Dema

| Field | Value |
| --- | --- |
| Payroll (import) | $606.16 |
| Gross (this report) | $275.52 |
| Diff (Gross − Payroll) | **$-330.64** (-120.01% of gross) |
| Pay-hours total (excl. sleepover allowance hours in total) | 8 h |
| Implied $/h (Payroll ÷ pay-hours) | ~$75.77/h |
| Implied $/h (Gross ÷ pay-hours) | ~$34.44/h (from per-staff rates xlsx) |
| Staff rates row in xlsx? | **Yes** (normName match) |
| Weekday band mix (afternoon+night share of m+a+n) | 0% |

**Why Gross is below Payroll (most likely first)**

1. **Gross** used **`calcGrossFromRates`** from the staff-rates xlsx. Remaining gap vs payroll is usually **period/scope** (roster vs FN), **extra pay lines** in payroll, or **name spelling** (rates row is a different person).
2. **Implied rate gap:** payroll ~$75.77/h vs gross ~$34.44/h across these hours — **items in payroll** not in the formula (e.g. leave, allowances outside sheet), or **rate column mismatch** (export not same as pay run).
3. **Period / scope:** roster span may not match the payroll fortnight; payroll can include **leave, adjustments, on-call, or other lines** not in the scheduler CSV.
4. **No** parse-failed rows attributed to this staff name in the CSV error list (other staff may still have failed rows).

### Abhilash Krishnalayam

| Field | Value |
| --- | --- |
| Payroll (import) | $3721.13 |
| Gross (this report) | $3394.65 |
| Diff (Gross − Payroll) | **$-326.48** (-9.62% of gross) |
| Pay-hours total (excl. sleepover allowance hours in total) | 73 h |
| Implied $/h (Payroll ÷ pay-hours) | ~$50.97/h |
| Implied $/h (Gross ÷ pay-hours) | ~$46.50/h (from per-staff rates xlsx) |
| Staff rates row in xlsx? | **Yes** (normName match) |
| Weekday band mix (afternoon+night share of m+a+n) | 100% |

**Why Gross is below Payroll (most likely first)**

1. **Gross** used **`calcGrossFromRates`** from the staff-rates xlsx. Remaining gap vs payroll is usually **period/scope** (roster vs FN), **extra pay lines** in payroll, or **name spelling** (rates row is a different person).
2. **Implied rate gap:** payroll ~$50.97/h vs gross ~$46.50/h across these hours — **items in payroll** not in the formula (e.g. leave, allowances outside sheet), or **rate column mismatch** (export not same as pay run).
3. **Period / scope:** roster span may not match the payroll fortnight; payroll can include **leave, adjustments, on-call, or other lines** not in the scheduler CSV.
4. **High afternoon/night share (100%)** — more penalty loading; small errors in **band split** (or sleepover follow-on) change dollars; payroll may use different treatment.
5. **No** parse-failed rows attributed to this staff name in the CSV error list (other staff may still have failed rows).

### Jaimon James

| Field | Value |
| --- | --- |
| Payroll (import) | $4570.68 |
| Gross (this report) | $4244.20 |
| Diff (Gross − Payroll) | **$-326.48** (-7.69% of gross) |
| Pay-hours total (excl. sleepover allowance hours in total) | 84 h |
| Implied $/h (Payroll ÷ pay-hours) | ~$54.41/h |
| Implied $/h (Gross ÷ pay-hours) | ~$50.53/h (from per-staff rates xlsx) |
| Staff rates row in xlsx? | **Yes** (normName match) |
| Weekday band mix (afternoon+night share of m+a+n) | 86% |

**Why Gross is below Payroll (most likely first)**

1. **Gross** used **`calcGrossFromRates`** from the staff-rates xlsx. Remaining gap vs payroll is usually **period/scope** (roster vs FN), **extra pay lines** in payroll, or **name spelling** (rates row is a different person).
2. **Implied rate gap:** payroll ~$54.41/h vs gross ~$50.53/h across these hours — **items in payroll** not in the formula (e.g. leave, allowances outside sheet), or **rate column mismatch** (export not same as pay run).
3. **Period / scope:** roster span may not match the payroll fortnight; payroll can include **leave, adjustments, on-call, or other lines** not in the scheduler CSV.
4. **High afternoon/night share (86%)** — more penalty loading; small errors in **band split** (or sleepover follow-on) change dollars; payroll may use different treatment.
5. **No** parse-failed rows attributed to this staff name in the CSV error list (other staff may still have failed rows).

### Natalia Sesay

| Field | Value |
| --- | --- |
| Payroll (import) | $2047.92 |
| Gross (this report) | $1721.44 |
| Diff (Gross − Payroll) | **$-326.48** (-18.97% of gross) |
| Pay-hours total (excl. sleepover allowance hours in total) | 40 h |
| Implied $/h (Payroll ÷ pay-hours) | ~$51.20/h |
| Implied $/h (Gross ÷ pay-hours) | ~$43.04/h (from per-staff rates xlsx) |
| Staff rates row in xlsx? | **Yes** (normName match) |
| Weekday band mix (afternoon+night share of m+a+n) | 100% |

**Why Gross is below Payroll (most likely first)**

1. **Gross** used **`calcGrossFromRates`** from the staff-rates xlsx. Remaining gap vs payroll is usually **period/scope** (roster vs FN), **extra pay lines** in payroll, or **name spelling** (rates row is a different person).
2. **Implied rate gap:** payroll ~$51.20/h vs gross ~$43.04/h across these hours — **items in payroll** not in the formula (e.g. leave, allowances outside sheet), or **rate column mismatch** (export not same as pay run).
3. **Period / scope:** roster span may not match the payroll fortnight; payroll can include **leave, adjustments, on-call, or other lines** not in the scheduler CSV.
4. **High afternoon/night share (100%)** — more penalty loading; small errors in **band split** (or sleepover follow-on) change dollars; payroll may use different treatment.
5. **No** parse-failed rows attributed to this staff name in the CSV error list (other staff may still have failed rows).

### Olufemi Olatunde

| Field | Value |
| --- | --- |
| Payroll (import) | $4180.86 |
| Gross (this report) | $3855.43 |
| Diff (Gross − Payroll) | **$-325.43** (-8.44% of gross) |
| Pay-hours total (excl. sleepover allowance hours in total) | 72.75 h |
| Implied $/h (Payroll ÷ pay-hours) | ~$57.47/h |
| Implied $/h (Gross ÷ pay-hours) | ~$53.00/h (from per-staff rates xlsx) |
| Staff rates row in xlsx? | **Yes** (normName match) |
| Weekday band mix (afternoon+night share of m+a+n) | 100% |

**Why Gross is below Payroll (most likely first)**

1. **Gross** used **`calcGrossFromRates`** from the staff-rates xlsx. Remaining gap vs payroll is usually **period/scope** (roster vs FN), **extra pay lines** in payroll, or **name spelling** (rates row is a different person).
2. **Implied rate gap:** payroll ~$57.47/h vs gross ~$53.00/h across these hours — **items in payroll** not in the formula (e.g. leave, allowances outside sheet), or **rate column mismatch** (export not same as pay run).
3. **Period / scope:** roster span may not match the payroll fortnight; payroll can include **leave, adjustments, on-call, or other lines** not in the scheduler CSV.
4. **High afternoon/night share (100%)** — more penalty loading; small errors in **band split** (or sleepover follow-on) change dollars; payroll may use different treatment.
5. **No** parse-failed rows attributed to this staff name in the CSV error list (other staff may still have failed rows).

### Roniya Mary Reji

| Field | Value |
| --- | --- |
| Payroll (import) | $3218.80 |
| Gross (this report) | $2895.84 |
| Diff (Gross − Payroll) | **$-322.96** (-11.15% of gross) |
| Pay-hours total (excl. sleepover allowance hours in total) | 67.5 h |
| Implied $/h (Payroll ÷ pay-hours) | ~$47.69/h |
| Implied $/h (Gross ÷ pay-hours) | ~$42.90/h (from per-staff rates xlsx) |
| Staff rates row in xlsx? | **Yes** (normName match) |
| Weekday band mix (afternoon+night share of m+a+n) | 59% |

**Why Gross is below Payroll (most likely first)**

1. **Gross** used **`calcGrossFromRates`** from the staff-rates xlsx. Remaining gap vs payroll is usually **period/scope** (roster vs FN), **extra pay lines** in payroll, or **name spelling** (rates row is a different person).
2. **Implied rate gap:** payroll ~$47.69/h vs gross ~$42.90/h across these hours — **items in payroll** not in the formula (e.g. leave, allowances outside sheet), or **rate column mismatch** (export not same as pay run).
3. **Period / scope:** roster span may not match the payroll fortnight; payroll can include **leave, adjustments, on-call, or other lines** not in the scheduler CSV.
4. **High afternoon/night share (59%)** — more penalty loading; small errors in **band split** (or sleepover follow-on) change dollars; payroll may use different treatment.
5. **No** parse-failed rows attributed to this staff name in the CSV error list (other staff may still have failed rows).

### Chinmay Dash

| Field | Value |
| --- | --- |
| Payroll (import) | $3546.41 |
| Gross (this report) | $3232.08 |
| Diff (Gross − Payroll) | **$-314.33** (-9.73% of gross) |
| Pay-hours total (excl. sleepover allowance hours in total) | 68.5 h |
| Implied $/h (Payroll ÷ pay-hours) | ~$51.77/h |
| Implied $/h (Gross ÷ pay-hours) | ~$47.18/h (from per-staff rates xlsx) |
| Staff rates row in xlsx? | **Yes** (normName match) |
| Weekday band mix (afternoon+night share of m+a+n) | 93% |

**Why Gross is below Payroll (most likely first)**

1. **Gross** used **`calcGrossFromRates`** from the staff-rates xlsx. Remaining gap vs payroll is usually **period/scope** (roster vs FN), **extra pay lines** in payroll, or **name spelling** (rates row is a different person).
2. **Implied rate gap:** payroll ~$51.77/h vs gross ~$47.18/h across these hours — **items in payroll** not in the formula (e.g. leave, allowances outside sheet), or **rate column mismatch** (export not same as pay run).
3. **Period / scope:** roster span may not match the payroll fortnight; payroll can include **leave, adjustments, on-call, or other lines** not in the scheduler CSV.
4. **High afternoon/night share (93%)** — more penalty loading; small errors in **band split** (or sleepover follow-on) change dollars; payroll may use different treatment.
5. **No** parse-failed rows attributed to this staff name in the CSV error list (other staff may still have failed rows).

### Beryl Chepngetich

| Field | Value |
| --- | --- |
| Payroll (import) | $4124.57 |
| Gross (this report) | $3832.77 |
| Diff (Gross − Payroll) | **$-291.80** (-7.61% of gross) |
| Pay-hours total (excl. sleepover allowance hours in total) | 65 h |
| Implied $/h (Payroll ÷ pay-hours) | ~$63.45/h |
| Implied $/h (Gross ÷ pay-hours) | ~$58.97/h (from per-staff rates xlsx) |
| Staff rates row in xlsx? | **Yes** (normName match) |
| Weekday band mix (afternoon+night share of m+a+n) | 56% |

**Why Gross is below Payroll (most likely first)**

1. **Gross** used **`calcGrossFromRates`** from the staff-rates xlsx. Remaining gap vs payroll is usually **period/scope** (roster vs FN), **extra pay lines** in payroll, or **name spelling** (rates row is a different person).
2. **Implied rate gap:** payroll ~$63.45/h vs gross ~$58.97/h across these hours — **items in payroll** not in the formula (e.g. leave, allowances outside sheet), or **rate column mismatch** (export not same as pay run).
3. **Period / scope:** roster span may not match the payroll fortnight; payroll can include **leave, adjustments, on-call, or other lines** not in the scheduler CSV.
4. **High afternoon/night share (56%)** — more penalty loading; small errors in **band split** (or sleepover follow-on) change dollars; payroll may use different treatment.
5. **No** parse-failed rows attributed to this staff name in the CSV error list (other staff may still have failed rows).

### Mariya Tony

| Field | Value |
| --- | --- |
| Payroll (import) | $1990.24 |
| Gross (this report) | $1698.56 |
| Diff (Gross − Payroll) | **$-291.68** (-17.17% of gross) |
| Pay-hours total (excl. sleepover allowance hours in total) | 47 h |
| Implied $/h (Payroll ÷ pay-hours) | ~$42.35/h |
| Implied $/h (Gross ÷ pay-hours) | ~$36.14/h (from per-staff rates xlsx) |
| Staff rates row in xlsx? | **Yes** (normName match) |
| Weekday band mix (afternoon+night share of m+a+n) | 51% |

**Why Gross is below Payroll (most likely first)**

1. **Gross** used **`calcGrossFromRates`** from the staff-rates xlsx. Remaining gap vs payroll is usually **period/scope** (roster vs FN), **extra pay lines** in payroll, or **name spelling** (rates row is a different person).
2. **Implied rate gap:** payroll ~$42.35/h vs gross ~$36.14/h across these hours — **items in payroll** not in the formula (e.g. leave, allowances outside sheet), or **rate column mismatch** (export not same as pay run).
3. **Period / scope:** roster span may not match the payroll fortnight; payroll can include **leave, adjustments, on-call, or other lines** not in the scheduler CSV.
4. **High afternoon/night share (51%)** — more penalty loading; small errors in **band split** (or sleepover follow-on) change dollars; payroll may use different treatment.
5. **No** parse-failed rows attributed to this staff name in the CSV error list (other staff may still have failed rows).

### Winnie Tung

| Field | Value |
| --- | --- |
| Payroll (import) | $1120.85 |
| Gross (this report) | $832.20 |
| Diff (Gross − Payroll) | **$-288.65** (-34.69% of gross) |
| Pay-hours total (excl. sleepover allowance hours in total) | 18.25 h |
| Implied $/h (Payroll ÷ pay-hours) | ~$61.42/h |
| Implied $/h (Gross ÷ pay-hours) | ~$45.60/h (from per-staff rates xlsx) |
| Staff rates row in xlsx? | **Yes** (normName match) |
| Weekday band mix (afternoon+night share of m+a+n) | 0% |

**Why Gross is below Payroll (most likely first)**

1. **Gross** used **`calcGrossFromRates`** from the staff-rates xlsx. Remaining gap vs payroll is usually **period/scope** (roster vs FN), **extra pay lines** in payroll, or **name spelling** (rates row is a different person).
2. **Implied rate gap:** payroll ~$61.42/h vs gross ~$45.60/h across these hours — **items in payroll** not in the formula (e.g. leave, allowances outside sheet), or **rate column mismatch** (export not same as pay run).
3. **Period / scope:** roster span may not match the payroll fortnight; payroll can include **leave, adjustments, on-call, or other lines** not in the scheduler CSV.
4. **No** parse-failed rows attributed to this staff name in the CSV error list (other staff may still have failed rows).

### Rizalyn Acero

| Field | Value |
| --- | --- |
| Payroll (import) | $769.80 |
| Gross (this report) | $492.84 |
| Diff (Gross − Payroll) | **$-276.96** (-56.2% of gross) |
| Pay-hours total (excl. sleepover allowance hours in total) | 11 h |
| Implied $/h (Payroll ÷ pay-hours) | ~$69.98/h |
| Implied $/h (Gross ÷ pay-hours) | ~$44.80/h (from per-staff rates xlsx) |
| Staff rates row in xlsx? | **Yes** (normName match) |
| Weekday band mix (afternoon+night share of m+a+n) | 41% |

**Why Gross is below Payroll (most likely first)**

1. **Gross** used **`calcGrossFromRates`** from the staff-rates xlsx. Remaining gap vs payroll is usually **period/scope** (roster vs FN), **extra pay lines** in payroll, or **name spelling** (rates row is a different person).
2. **Implied rate gap:** payroll ~$69.98/h vs gross ~$44.80/h across these hours — **items in payroll** not in the formula (e.g. leave, allowances outside sheet), or **rate column mismatch** (export not same as pay run).
3. **Period / scope:** roster span may not match the payroll fortnight; payroll can include **leave, adjustments, on-call, or other lines** not in the scheduler CSV.
4. **High afternoon/night share (41%)** — more penalty loading; small errors in **band split** (or sleepover follow-on) change dollars; payroll may use different treatment.
5. **No** parse-failed rows attributed to this staff name in the CSV error list (other staff may still have failed rows).

### Farai Kandenga

| Field | Value |
| --- | --- |
| Payroll (import) | $1182.82 |
| Gross (this report) | $906.64 |
| Diff (Gross − Payroll) | **$-276.18** (-30.46% of gross) |
| Pay-hours total (excl. sleepover allowance hours in total) | 16 h |
| Implied $/h (Payroll ÷ pay-hours) | ~$73.93/h |
| Implied $/h (Gross ÷ pay-hours) | ~$56.67/h (from per-staff rates xlsx) |
| Staff rates row in xlsx? | **Yes** (normName match) |
| Weekday band mix (afternoon+night share of m+a+n) | 100% |

**Why Gross is below Payroll (most likely first)**

1. **Gross** used **`calcGrossFromRates`** from the staff-rates xlsx. Remaining gap vs payroll is usually **period/scope** (roster vs FN), **extra pay lines** in payroll, or **name spelling** (rates row is a different person).
2. **Implied rate gap:** payroll ~$73.93/h vs gross ~$56.67/h across these hours — **items in payroll** not in the formula (e.g. leave, allowances outside sheet), or **rate column mismatch** (export not same as pay run).
3. **Period / scope:** roster span may not match the payroll fortnight; payroll can include **leave, adjustments, on-call, or other lines** not in the scheduler CSV.
4. **High afternoon/night share (100%)** — more penalty loading; small errors in **band split** (or sleepover follow-on) change dollars; payroll may use different treatment.
5. **No** parse-failed rows attributed to this staff name in the CSV error list (other staff may still have failed rows).

### Pilipinas Nicerio

| Field | Value |
| --- | --- |
| Payroll (import) | $1600.40 |
| Gross (this report) | $1324.22 |
| Diff (Gross − Payroll) | **$-276.18** (-20.86% of gross) |
| Pay-hours total (excl. sleepover allowance hours in total) | 24 h |
| Implied $/h (Payroll ÷ pay-hours) | ~$66.68/h |
| Implied $/h (Gross ÷ pay-hours) | ~$55.18/h (from per-staff rates xlsx) |
| Staff rates row in xlsx? | **Yes** (normName match) |
| Weekday band mix (afternoon+night share of m+a+n) | 78% |

**Why Gross is below Payroll (most likely first)**

1. **Gross** used **`calcGrossFromRates`** from the staff-rates xlsx. Remaining gap vs payroll is usually **period/scope** (roster vs FN), **extra pay lines** in payroll, or **name spelling** (rates row is a different person).
2. **Implied rate gap:** payroll ~$66.68/h vs gross ~$55.18/h across these hours — **items in payroll** not in the formula (e.g. leave, allowances outside sheet), or **rate column mismatch** (export not same as pay run).
3. **Period / scope:** roster span may not match the payroll fortnight; payroll can include **leave, adjustments, on-call, or other lines** not in the scheduler CSV.
4. **High afternoon/night share (78%)** — more penalty loading; small errors in **band split** (or sleepover follow-on) change dollars; payroll may use different treatment.
5. **No** parse-failed rows attributed to this staff name in the CSV error list (other staff may still have failed rows).

### Mandy Hewitt

| Field | Value |
| --- | --- |
| Payroll (import) | $1645.92 |
| Gross (this report) | $1371.60 |
| Diff (Gross − Payroll) | **$-274.32** (-20% of gross) |
| Pay-hours total (excl. sleepover allowance hours in total) | 36 h |
| Implied $/h (Payroll ÷ pay-hours) | ~$45.72/h |
| Implied $/h (Gross ÷ pay-hours) | ~$38.10/h (from per-staff rates xlsx) |
| Staff rates row in xlsx? | **Yes** (normName match) |
| Weekday band mix (afternoon+night share of m+a+n) | 0% |

**Why Gross is below Payroll (most likely first)**

1. **Gross** used **`calcGrossFromRates`** from the staff-rates xlsx. Remaining gap vs payroll is usually **period/scope** (roster vs FN), **extra pay lines** in payroll, or **name spelling** (rates row is a different person).
2. **Implied rate gap:** payroll ~$45.72/h vs gross ~$38.10/h across these hours — **items in payroll** not in the formula (e.g. leave, allowances outside sheet), or **rate column mismatch** (export not same as pay run).
3. **Period / scope:** roster span may not match the payroll fortnight; payroll can include **leave, adjustments, on-call, or other lines** not in the scheduler CSV.
4. **No** parse-failed rows attributed to this staff name in the CSV error list (other staff may still have failed rows).

### Merin Shaju

| Field | Value |
| --- | --- |
| Payroll (import) | $1979.65 |
| Gross (this report) | $1706.16 |
| Diff (Gross − Payroll) | **$-273.49** (-16.03% of gross) |
| Pay-hours total (excl. sleepover allowance hours in total) | 46 h |
| Implied $/h (Payroll ÷ pay-hours) | ~$43.04/h |
| Implied $/h (Gross ÷ pay-hours) | ~$37.09/h (from per-staff rates xlsx) |
| Staff rates row in xlsx? | **Yes** (normName match) |
| Weekday band mix (afternoon+night share of m+a+n) | 0% |

**Why Gross is below Payroll (most likely first)**

1. **Gross** used **`calcGrossFromRates`** from the staff-rates xlsx. Remaining gap vs payroll is usually **period/scope** (roster vs FN), **extra pay lines** in payroll, or **name spelling** (rates row is a different person).
2. **Implied rate gap:** payroll ~$43.04/h vs gross ~$37.09/h across these hours — **items in payroll** not in the formula (e.g. leave, allowances outside sheet), or **rate column mismatch** (export not same as pay run).
3. **Period / scope:** roster span may not match the payroll fortnight; payroll can include **leave, adjustments, on-call, or other lines** not in the scheduler CSV.
4. **No** parse-failed rows attributed to this staff name in the CSV error list (other staff may still have failed rows).

### Katrina Hibberd

| Field | Value |
| --- | --- |
| Payroll (import) | $2783.02 |
| Gross (this report) | $2519.24 |
| Diff (Gross − Payroll) | **$-263.78** (-10.47% of gross) |
| Pay-hours total (excl. sleepover allowance hours in total) | 54.5 h |
| Implied $/h (Payroll ÷ pay-hours) | ~$51.06/h |
| Implied $/h (Gross ÷ pay-hours) | ~$46.22/h (from per-staff rates xlsx) |
| Staff rates row in xlsx? | **Yes** (normName match) |
| Weekday band mix (afternoon+night share of m+a+n) | 0% |

**Why Gross is below Payroll (most likely first)**

1. **Gross** used **`calcGrossFromRates`** from the staff-rates xlsx. Remaining gap vs payroll is usually **period/scope** (roster vs FN), **extra pay lines** in payroll, or **name spelling** (rates row is a different person).
2. **Implied rate gap:** payroll ~$51.06/h vs gross ~$46.22/h across these hours — **items in payroll** not in the formula (e.g. leave, allowances outside sheet), or **rate column mismatch** (export not same as pay run).
3. **Period / scope:** roster span may not match the payroll fortnight; payroll can include **leave, adjustments, on-call, or other lines** not in the scheduler CSV.
4. **No** parse-failed rows attributed to this staff name in the CSV error list (other staff may still have failed rows).

### Tiya Franklin

| Field | Value |
| --- | --- |
| Payroll (import) | $2094.95 |
| Gross (this report) | $1835.19 |
| Diff (Gross − Payroll) | **$-259.76** (-14.15% of gross) |
| Pay-hours total (excl. sleepover allowance hours in total) | 37.75 h |
| Implied $/h (Payroll ÷ pay-hours) | ~$55.50/h |
| Implied $/h (Gross ÷ pay-hours) | ~$48.61/h (from per-staff rates xlsx) |
| Staff rates row in xlsx? | **Yes** (normName match) |
| Weekday band mix (afternoon+night share of m+a+n) | 80% |

**Why Gross is below Payroll (most likely first)**

1. **Gross** used **`calcGrossFromRates`** from the staff-rates xlsx. Remaining gap vs payroll is usually **period/scope** (roster vs FN), **extra pay lines** in payroll, or **name spelling** (rates row is a different person).
2. **Implied rate gap:** payroll ~$55.50/h vs gross ~$48.61/h across these hours — **items in payroll** not in the formula (e.g. leave, allowances outside sheet), or **rate column mismatch** (export not same as pay run).
3. **Period / scope:** roster span may not match the payroll fortnight; payroll can include **leave, adjustments, on-call, or other lines** not in the scheduler CSV.
4. **High afternoon/night share (80%)** — more penalty loading; small errors in **band split** (or sleepover follow-on) change dollars; payroll may use different treatment.
5. **No** parse-failed rows attributed to this staff name in the CSV error list (other staff may still have failed rows).

### Robin Mathew

| Field | Value |
| --- | --- |
| Payroll (import) | $2537.83 |
| Gross (this report) | $2289.85 |
| Diff (Gross − Payroll) | **$-247.98** (-10.83% of gross) |
| Pay-hours total (excl. sleepover allowance hours in total) | 46.5 h |
| Implied $/h (Payroll ÷ pay-hours) | ~$54.58/h |
| Implied $/h (Gross ÷ pay-hours) | ~$49.24/h (from per-staff rates xlsx) |
| Staff rates row in xlsx? | **Yes** (normName match) |
| Weekday band mix (afternoon+night share of m+a+n) | 100% |

**Why Gross is below Payroll (most likely first)**

1. **Gross** used **`calcGrossFromRates`** from the staff-rates xlsx. Remaining gap vs payroll is usually **period/scope** (roster vs FN), **extra pay lines** in payroll, or **name spelling** (rates row is a different person).
2. **Implied rate gap:** payroll ~$54.58/h vs gross ~$49.24/h across these hours — **items in payroll** not in the formula (e.g. leave, allowances outside sheet), or **rate column mismatch** (export not same as pay run).
3. **Period / scope:** roster span may not match the payroll fortnight; payroll can include **leave, adjustments, on-call, or other lines** not in the scheduler CSV.
4. **High afternoon/night share (100%)** — more penalty loading; small errors in **band split** (or sleepover follow-on) change dollars; payroll may use different treatment.
5. **No** parse-failed rows attributed to this staff name in the CSV error list (other staff may still have failed rows).

### Karishma Arjunan

| Field | Value |
| --- | --- |
| Payroll (import) | $3447.03 |
| Gross (this report) | $3217.22 |
| Diff (Gross − Payroll) | **$-229.81** (-7.14% of gross) |
| Pay-hours total (excl. sleepover allowance hours in total) | 69 h |
| Implied $/h (Payroll ÷ pay-hours) | ~$49.96/h |
| Implied $/h (Gross ÷ pay-hours) | ~$46.63/h (from per-staff rates xlsx) |
| Staff rates row in xlsx? | **Yes** (normName match) |
| Weekday band mix (afternoon+night share of m+a+n) | 100% |

**Why Gross is below Payroll (most likely first)**

1. **Gross** used **`calcGrossFromRates`** from the staff-rates xlsx. Remaining gap vs payroll is usually **period/scope** (roster vs FN), **extra pay lines** in payroll, or **name spelling** (rates row is a different person).
2. **Implied rate gap:** payroll ~$49.96/h vs gross ~$46.63/h across these hours — **items in payroll** not in the formula (e.g. leave, allowances outside sheet), or **rate column mismatch** (export not same as pay run).
3. **Period / scope:** roster span may not match the payroll fortnight; payroll can include **leave, adjustments, on-call, or other lines** not in the scheduler CSV.
4. **High afternoon/night share (100%)** — more penalty loading; small errors in **band split** (or sleepover follow-on) change dollars; payroll may use different treatment.
5. **No** parse-failed rows attributed to this staff name in the CSV error list (other staff may still have failed rows).

### Mackenzie Hewitt

| Field | Value |
| --- | --- |
| Payroll (import) | $3214.56 |
| Gross (this report) | $2985.96 |
| Diff (Gross − Payroll) | **$-228.60** (-7.66% of gross) |
| Pay-hours total (excl. sleepover allowance hours in total) | 73 h |
| Implied $/h (Payroll ÷ pay-hours) | ~$44.04/h |
| Implied $/h (Gross ÷ pay-hours) | ~$40.90/h (from per-staff rates xlsx) |
| Staff rates row in xlsx? | **Yes** (normName match) |
| Weekday band mix (afternoon+night share of m+a+n) | 0% |

**Why Gross is below Payroll (most likely first)**

1. **Gross** used **`calcGrossFromRates`** from the staff-rates xlsx. Remaining gap vs payroll is usually **period/scope** (roster vs FN), **extra pay lines** in payroll, or **name spelling** (rates row is a different person).
2. **Implied rate gap:** payroll ~$44.04/h vs gross ~$40.90/h across these hours — **items in payroll** not in the formula (e.g. leave, allowances outside sheet), or **rate column mismatch** (export not same as pay run).
3. **Period / scope:** roster span may not match the payroll fortnight; payroll can include **leave, adjustments, on-call, or other lines** not in the scheduler CSV.
4. **No** parse-failed rows attributed to this staff name in the CSV error list (other staff may still have failed rows).

### Timothy Goodwin

| Field | Value |
| --- | --- |
| Payroll (import) | $3696.90 |
| Gross (this report) | $3468.30 |
| Diff (Gross − Payroll) | **$-228.60** (-6.59% of gross) |
| Pay-hours total (excl. sleepover allowance hours in total) | 78 h |
| Implied $/h (Payroll ÷ pay-hours) | ~$47.40/h |
| Implied $/h (Gross ÷ pay-hours) | ~$44.47/h (from per-staff rates xlsx) |
| Staff rates row in xlsx? | **Yes** (normName match) |
| Weekday band mix (afternoon+night share of m+a+n) | 0% |

**Why Gross is below Payroll (most likely first)**

1. **Gross** used **`calcGrossFromRates`** from the staff-rates xlsx. Remaining gap vs payroll is usually **period/scope** (roster vs FN), **extra pay lines** in payroll, or **name spelling** (rates row is a different person).
2. **Implied rate gap:** payroll ~$47.40/h vs gross ~$44.47/h across these hours — **items in payroll** not in the formula (e.g. leave, allowances outside sheet), or **rate column mismatch** (export not same as pay run).
3. **Period / scope:** roster span may not match the payroll fortnight; payroll can include **leave, adjustments, on-call, or other lines** not in the scheduler CSV.
4. **No** parse-failed rows attributed to this staff name in the CSV error list (other staff may still have failed rows).

### Dona Thannickamattathil Eldhose

| Field | Value |
| --- | --- |
| Payroll (import) | $2964.70 |
| Gross (this report) | $2736.18 |
| Diff (Gross − Payroll) | **$-228.52** (-8.35% of gross) |
| Pay-hours total (excl. sleepover allowance hours in total) | 48.5 h |
| Implied $/h (Payroll ÷ pay-hours) | ~$61.13/h |
| Implied $/h (Gross ÷ pay-hours) | ~$56.42/h (from per-staff rates xlsx) |
| Staff rates row in xlsx? | **Yes** (normName match) |
| Weekday band mix (afternoon+night share of m+a+n) | 72% |

**Why Gross is below Payroll (most likely first)**

1. **Gross** used **`calcGrossFromRates`** from the staff-rates xlsx. Remaining gap vs payroll is usually **period/scope** (roster vs FN), **extra pay lines** in payroll, or **name spelling** (rates row is a different person).
2. **Implied rate gap:** payroll ~$61.13/h vs gross ~$56.42/h across these hours — **items in payroll** not in the formula (e.g. leave, allowances outside sheet), or **rate column mismatch** (export not same as pay run).
3. **Period / scope:** roster span may not match the payroll fortnight; payroll can include **leave, adjustments, on-call, or other lines** not in the scheduler CSV.
4. **High afternoon/night share (72%)** — more penalty loading; small errors in **band split** (or sleepover follow-on) change dollars; payroll may use different treatment.
5. **No** parse-failed rows attributed to this staff name in the CSV error list (other staff may still have failed rows).

### Julie-Anne Seager

| Field | Value |
| --- | --- |
| Payroll (import) | $4266.33 |
| Gross (this report) | $4047.45 |
| Diff (Gross − Payroll) | **$-218.88** (-5.41% of gross) |
| Pay-hours total (excl. sleepover allowance hours in total) | 68 h |
| Implied $/h (Payroll ÷ pay-hours) | ~$62.74/h |
| Implied $/h (Gross ÷ pay-hours) | ~$59.52/h (from per-staff rates xlsx) |
| Staff rates row in xlsx? | **Yes** (normName match) |
| Weekday band mix (afternoon+night share of m+a+n) | 0% |

**Why Gross is below Payroll (most likely first)**

1. **Gross** used **`calcGrossFromRates`** from the staff-rates xlsx. Remaining gap vs payroll is usually **period/scope** (roster vs FN), **extra pay lines** in payroll, or **name spelling** (rates row is a different person).
2. **Implied rate gap:** payroll ~$62.74/h vs gross ~$59.52/h across these hours — **items in payroll** not in the formula (e.g. leave, allowances outside sheet), or **rate column mismatch** (export not same as pay run).
3. **Period / scope:** roster span may not match the payroll fortnight; payroll can include **leave, adjustments, on-call, or other lines** not in the scheduler CSV.
4. **No** parse-failed rows attributed to this staff name in the CSV error list (other staff may still have failed rows).

### Pisi Faaauro

| Field | Value |
| --- | --- |
| Payroll (import) | $1179.43 |
| Gross (this report) | $987.41 |
| Diff (Gross − Payroll) | **$-192.02** (-19.45% of gross) |
| Pay-hours total (excl. sleepover allowance hours in total) | 19.75 h |
| Implied $/h (Payroll ÷ pay-hours) | ~$59.72/h |
| Implied $/h (Gross ÷ pay-hours) | ~$50.00/h (from per-staff rates xlsx) |
| Staff rates row in xlsx? | **Yes** (normName match) |
| Weekday band mix (afternoon+night share of m+a+n) | 46% |

**Why Gross is below Payroll (most likely first)**

1. **Gross** used **`calcGrossFromRates`** from the staff-rates xlsx. Remaining gap vs payroll is usually **period/scope** (roster vs FN), **extra pay lines** in payroll, or **name spelling** (rates row is a different person).
2. **Implied rate gap:** payroll ~$59.72/h vs gross ~$50.00/h across these hours — **items in payroll** not in the formula (e.g. leave, allowances outside sheet), or **rate column mismatch** (export not same as pay run).
3. **Period / scope:** roster span may not match the payroll fortnight; payroll can include **leave, adjustments, on-call, or other lines** not in the scheduler CSV.
4. **High afternoon/night share (46%)** — more penalty loading; small errors in **band split** (or sleepover follow-on) change dollars; payroll may use different treatment.
5. **No** parse-failed rows attributed to this staff name in the CSV error list (other staff may still have failed rows).

### Ann Mathew

| Field | Value |
| --- | --- |
| Payroll (import) | $2629.48 |
| Gross (this report) | $2453.66 |
| Diff (Gross − Payroll) | **$-175.82** (-7.17% of gross) |
| Pay-hours total (excl. sleepover allowance hours in total) | 63.75 h |
| Implied $/h (Payroll ÷ pay-hours) | ~$41.25/h |
| Implied $/h (Gross ÷ pay-hours) | ~$38.49/h (from per-staff rates xlsx) |
| Staff rates row in xlsx? | **Yes** (normName match) |
| Weekday band mix (afternoon+night share of m+a+n) | 90% |

**Why Gross is below Payroll (most likely first)**

1. **Gross** used **`calcGrossFromRates`** from the staff-rates xlsx. Remaining gap vs payroll is usually **period/scope** (roster vs FN), **extra pay lines** in payroll, or **name spelling** (rates row is a different person).
2. **Implied rate gap:** payroll ~$41.25/h vs gross ~$38.49/h across these hours — **items in payroll** not in the formula (e.g. leave, allowances outside sheet), or **rate column mismatch** (export not same as pay run).
3. **Period / scope:** roster span may not match the payroll fortnight; payroll can include **leave, adjustments, on-call, or other lines** not in the scheduler CSV.
4. **High afternoon/night share (90%)** — more penalty loading; small errors in **band split** (or sleepover follow-on) change dollars; payroll may use different treatment.
5. **No** parse-failed rows attributed to this staff name in the CSV error list (other staff may still have failed rows).

### Sherin Mathew

| Field | Value |
| --- | --- |
| Payroll (import) | $3131.68 |
| Gross (this report) | $2962.22 |
| Diff (Gross − Payroll) | **$-169.46** (-5.72% of gross) |
| Pay-hours total (excl. sleepover allowance hours in total) | 72 h |
| Implied $/h (Payroll ÷ pay-hours) | ~$43.50/h |
| Implied $/h (Gross ÷ pay-hours) | ~$41.14/h (from per-staff rates xlsx) |
| Staff rates row in xlsx? | **Yes** (normName match) |
| Weekday band mix (afternoon+night share of m+a+n) | 46% |

**Why Gross is below Payroll (most likely first)**

1. **Gross** used **`calcGrossFromRates`** from the staff-rates xlsx. Remaining gap vs payroll is usually **period/scope** (roster vs FN), **extra pay lines** in payroll, or **name spelling** (rates row is a different person).
2. **Implied rate gap:** payroll ~$43.50/h vs gross ~$41.14/h across these hours — **items in payroll** not in the formula (e.g. leave, allowances outside sheet), or **rate column mismatch** (export not same as pay run).
3. **Period / scope:** roster span may not match the payroll fortnight; payroll can include **leave, adjustments, on-call, or other lines** not in the scheduler CSV.
4. **High afternoon/night share (46%)** — more penalty loading; small errors in **band split** (or sleepover follow-on) change dollars; payroll may use different treatment.
5. **No** parse-failed rows attributed to this staff name in the CSV error list (other staff may still have failed rows).

### Swapnajith Sajith Sasikala

| Field | Value |
| --- | --- |
| Payroll (import) | $1934.74 |
| Gross (this report) | $1786.30 |
| Diff (Gross − Payroll) | **$-148.44** (-8.31% of gross) |
| Pay-hours total (excl. sleepover allowance hours in total) | 30 h |
| Implied $/h (Payroll ÷ pay-hours) | ~$64.49/h |
| Implied $/h (Gross ÷ pay-hours) | ~$59.54/h (from per-staff rates xlsx) |
| Staff rates row in xlsx? | **Yes** (normName match) |
| Weekday band mix (afternoon+night share of m+a+n) | 100% |

**Why Gross is below Payroll (most likely first)**

1. **Gross** used **`calcGrossFromRates`** from the staff-rates xlsx. Remaining gap vs payroll is usually **period/scope** (roster vs FN), **extra pay lines** in payroll, or **name spelling** (rates row is a different person).
2. **Implied rate gap:** payroll ~$64.49/h vs gross ~$59.54/h across these hours — **items in payroll** not in the formula (e.g. leave, allowances outside sheet), or **rate column mismatch** (export not same as pay run).
3. **Period / scope:** roster span may not match the payroll fortnight; payroll can include **leave, adjustments, on-call, or other lines** not in the scheduler CSV.
4. **High afternoon/night share (100%)** — more penalty loading; small errors in **band split** (or sleepover follow-on) change dollars; payroll may use different treatment.
5. **No** parse-failed rows attributed to this staff name in the CSV error list (other staff may still have failed rows).

### Zoran Knezevic

| Field | Value |
| --- | --- |
| Payroll (import) | $1366.82 |
| Gross (this report) | $1219.17 |
| Diff (Gross − Payroll) | **$-147.65** (-12.11% of gross) |
| Pay-hours total (excl. sleepover allowance hours in total) | 26.75 h |
| Implied $/h (Payroll ÷ pay-hours) | ~$51.10/h |
| Implied $/h (Gross ÷ pay-hours) | ~$45.58/h (at $35 casual default) |
| Staff rates row in xlsx? | **No** (normName match) |
| Weekday band mix (afternoon+night share of m+a+n) | 70% |

**Why Gross is below Payroll (most likely first)**

1. **No staff-rates match** for this name — this report used **$35/h** casual `calcGross` for them. If the calculator in the app shows a rate from your rates XLSX, **re-run** with the same `[staff-rates.xlsx]` so gross matches.
2. **Implied rate gap:** payroll ~$51.10/h vs gross ~$45.58/h across these hours — **higher** rates in payroll than a **$35** casual build, or **items not modelled** in the flat build.
3. **Period / scope:** roster span may not match the payroll fortnight; payroll can include **leave, adjustments, on-call, or other lines** not in the scheduler CSV.
4. **High afternoon/night share (70%)** — more penalty loading; small errors in **band split** (or sleepover follow-on) change dollars; payroll may use different treatment.
5. **No** parse-failed rows attributed to this staff name in the CSV error list (other staff may still have failed rows).

### Khent John Medrozo Teo

| Field | Value |
| --- | --- |
| Payroll (import) | $1228.32 |
| Gross (this report) | $1091.16 |
| Diff (Gross − Payroll) | **$-137.16** (-12.57% of gross) |
| Pay-hours total (excl. sleepover allowance hours in total) | 22 h |
| Implied $/h (Payroll ÷ pay-hours) | ~$55.83/h |
| Implied $/h (Gross ÷ pay-hours) | ~$49.60/h (from per-staff rates xlsx) |
| Staff rates row in xlsx? | **Yes** (normName match) |
| Weekday band mix (afternoon+night share of m+a+n) | 0% |

**Why Gross is below Payroll (most likely first)**

1. **Gross** used **`calcGrossFromRates`** from the staff-rates xlsx. Remaining gap vs payroll is usually **period/scope** (roster vs FN), **extra pay lines** in payroll, or **name spelling** (rates row is a different person).
2. **Implied rate gap:** payroll ~$55.83/h vs gross ~$49.60/h across these hours — **items in payroll** not in the formula (e.g. leave, allowances outside sheet), or **rate column mismatch** (export not same as pay run).
3. **Period / scope:** roster span may not match the payroll fortnight; payroll can include **leave, adjustments, on-call, or other lines** not in the scheduler CSV.
4. **No** parse-failed rows attributed to this staff name in the CSV error list (other staff may still have failed rows).

### Arya Vijay

| Field | Value |
| --- | --- |
| Payroll (import) | $3260.97 |
| Gross (this report) | $3138.54 |
| Diff (Gross − Payroll) | **$-122.43** (-3.9% of gross) |
| Pay-hours total (excl. sleepover allowance hours in total) | 72 h |
| Implied $/h (Payroll ÷ pay-hours) | ~$45.29/h |
| Implied $/h (Gross ÷ pay-hours) | ~$43.59/h (from per-staff rates xlsx) |
| Staff rates row in xlsx? | **Yes** (normName match) |
| Weekday band mix (afternoon+night share of m+a+n) | 100% |

**Why Gross is below Payroll (most likely first)**

1. **Gross** used **`calcGrossFromRates`** from the staff-rates xlsx. Remaining gap vs payroll is usually **period/scope** (roster vs FN), **extra pay lines** in payroll, or **name spelling** (rates row is a different person).
2. **Implied rate gap:** payroll ~$45.29/h vs gross ~$43.59/h across these hours — **items in payroll** not in the formula (e.g. leave, allowances outside sheet), or **rate column mismatch** (export not same as pay run).
3. **Period / scope:** roster span may not match the payroll fortnight; payroll can include **leave, adjustments, on-call, or other lines** not in the scheduler CSV.
4. **High afternoon/night share (100%)** — more penalty loading; small errors in **band split** (or sleepover follow-on) change dollars; payroll may use different treatment.
5. **No** parse-failed rows attributed to this staff name in the CSV error list (other staff may still have failed rows).

### Heri Mwaka

| Field | Value |
| --- | --- |
| Payroll (import) | $1380.24 |
| Gross (this report) | $1260.00 |
| Diff (Gross − Payroll) | **$-120.24** (-9.54% of gross) |
| Pay-hours total (excl. sleepover allowance hours in total) | 36 h |
| Implied $/h (Payroll ÷ pay-hours) | ~$38.34/h |
| Implied $/h (Gross ÷ pay-hours) | ~$35.00/h (at $35 casual default) |
| Staff rates row in xlsx? | **No** (normName match) |
| Weekday band mix (afternoon+night share of m+a+n) | 0% |

**Why Gross is below Payroll (most likely first)**

1. **No staff-rates match** for this name — this report used **$35/h** casual `calcGross` for them. If the calculator in the app shows a rate from your rates XLSX, **re-run** with the same `[staff-rates.xlsx]` so gross matches.
2. **Implied rate gap:** payroll ~$38.34/h vs gross ~$35.00/h across these hours — **higher** rates in payroll than a **$35** casual build, or **items not modelled** in the flat build.
3. **Period / scope:** roster span may not match the payroll fortnight; payroll can include **leave, adjustments, on-call, or other lines** not in the scheduler CSV.
4. **No** parse-failed rows attributed to this staff name in the CSV error list (other staff may still have failed rows).

### Arjun Ram

| Field | Value |
| --- | --- |
| Payroll (import) | $3930.40 |
| Gross (this report) | $3830.40 |
| Diff (Gross − Payroll) | **$-100.00** (-2.61% of gross) |
| Pay-hours total (excl. sleepover allowance hours in total) | 72 h |
| Implied $/h (Payroll ÷ pay-hours) | ~$54.59/h |
| Implied $/h (Gross ÷ pay-hours) | ~$53.20/h (from per-staff rates xlsx) |
| Staff rates row in xlsx? | **Yes** (normName match) |
| Weekday band mix (afternoon+night share of m+a+n) | 0% |

**Why Gross is below Payroll (most likely first)**

1. **Gross** used **`calcGrossFromRates`** from the staff-rates xlsx. Remaining gap vs payroll is usually **period/scope** (roster vs FN), **extra pay lines** in payroll, or **name spelling** (rates row is a different person).
2. **Implied rate gap:** payroll ~$54.59/h vs gross ~$53.20/h across these hours — **items in payroll** not in the formula (e.g. leave, allowances outside sheet), or **rate column mismatch** (export not same as pay run).
3. **Period / scope:** roster span may not match the payroll fortnight; payroll can include **leave, adjustments, on-call, or other lines** not in the scheduler CSV.
4. **No** parse-failed rows attributed to this staff name in the CSV error list (other staff may still have failed rows).

### Erica Cox

| Field | Value |
| --- | --- |
| Payroll (import) | $4308.20 |
| Gross (this report) | $4209.70 |
| Diff (Gross − Payroll) | **$-98.50** (-2.34% of gross) |
| Pay-hours total (excl. sleepover allowance hours in total) | 74 h |
| Implied $/h (Payroll ÷ pay-hours) | ~$58.22/h |
| Implied $/h (Gross ÷ pay-hours) | ~$56.89/h (from per-staff rates xlsx) |
| Staff rates row in xlsx? | **Yes** (normName match) |
| Weekday band mix (afternoon+night share of m+a+n) | 100% |

**Why Gross is below Payroll (most likely first)**

1. **Gross** used **`calcGrossFromRates`** from the staff-rates xlsx. Remaining gap vs payroll is usually **period/scope** (roster vs FN), **extra pay lines** in payroll, or **name spelling** (rates row is a different person).
2. **Implied rate gap:** payroll ~$58.22/h vs gross ~$56.89/h across these hours — **items in payroll** not in the formula (e.g. leave, allowances outside sheet), or **rate column mismatch** (export not same as pay run).
3. **Period / scope:** roster span may not match the payroll fortnight; payroll can include **leave, adjustments, on-call, or other lines** not in the scheduler CSV.
4. **High afternoon/night share (100%)** — more penalty loading; small errors in **band split** (or sleepover follow-on) change dollars; payroll may use different treatment.
5. **No** parse-failed rows attributed to this staff name in the CSV error list (other staff may still have failed rows).

### Mahesh Pillai

| Field | Value |
| --- | --- |
| Payroll (import) | $2621.71 |
| Gross (this report) | $2535.09 |
| Diff (Gross − Payroll) | **$-86.62** (-3.42% of gross) |
| Pay-hours total (excl. sleepover allowance hours in total) | 48.5 h |
| Implied $/h (Payroll ÷ pay-hours) | ~$54.06/h |
| Implied $/h (Gross ÷ pay-hours) | ~$52.27/h (from per-staff rates xlsx) |
| Staff rates row in xlsx? | **Yes** (normName match) |
| Weekday band mix (afternoon+night share of m+a+n) | 49% |

**Why Gross is below Payroll (most likely first)**

1. **Gross** used **`calcGrossFromRates`** from the staff-rates xlsx. Remaining gap vs payroll is usually **period/scope** (roster vs FN), **extra pay lines** in payroll, or **name spelling** (rates row is a different person).
2. **Implied rate gap:** payroll ~$54.06/h vs gross ~$52.27/h across these hours — **items in payroll** not in the formula (e.g. leave, allowances outside sheet), or **rate column mismatch** (export not same as pay run).
3. **Period / scope:** roster span may not match the payroll fortnight; payroll can include **leave, adjustments, on-call, or other lines** not in the scheduler CSV.
4. **High afternoon/night share (49%)** — more penalty loading; small errors in **band split** (or sleepover follow-on) change dollars; payroll may use different treatment.
5. **No** parse-failed rows attributed to this staff name in the CSV error list (other staff may still have failed rows).

### Jimel E Dennis

| Field | Value |
| --- | --- |
| Payroll (import) | $3576.38 |
| Gross (this report) | $3491.93 |
| Diff (Gross − Payroll) | **$-84.45** (-2.42% of gross) |
| Pay-hours total (excl. sleepover allowance hours in total) | 70.75 h |
| Implied $/h (Payroll ÷ pay-hours) | ~$50.55/h |
| Implied $/h (Gross ÷ pay-hours) | ~$49.36/h (from per-staff rates xlsx) |
| Staff rates row in xlsx? | **Yes** (normName match) |
| Weekday band mix (afternoon+night share of m+a+n) | 88% |

**Why Gross is below Payroll (most likely first)**

1. **Gross** used **`calcGrossFromRates`** from the staff-rates xlsx. Remaining gap vs payroll is usually **period/scope** (roster vs FN), **extra pay lines** in payroll, or **name spelling** (rates row is a different person).
2. **Implied rate gap:** payroll ~$50.55/h vs gross ~$49.36/h across these hours — **items in payroll** not in the formula (e.g. leave, allowances outside sheet), or **rate column mismatch** (export not same as pay run).
3. **Period / scope:** roster span may not match the payroll fortnight; payroll can include **leave, adjustments, on-call, or other lines** not in the scheduler CSV.
4. **High afternoon/night share (88%)** — more penalty loading; small errors in **band split** (or sleepover follow-on) change dollars; payroll may use different treatment.
5. **No** parse-failed rows attributed to this staff name in the CSV error list (other staff may still have failed rows).

### Anthony Sionepeni

| Field | Value |
| --- | --- |
| Payroll (import) | $744.94 |
| Gross (this report) | $664.80 |
| Diff (Gross − Payroll) | **$-80.14** (-12.05% of gross) |
| Pay-hours total (excl. sleepover allowance hours in total) | 16 h |
| Implied $/h (Payroll ÷ pay-hours) | ~$46.56/h |
| Implied $/h (Gross ÷ pay-hours) | ~$41.55/h (from per-staff rates xlsx) |
| Staff rates row in xlsx? | **Yes** (normName match) |
| Weekday band mix (afternoon+night share of m+a+n) | 100% |

**Why Gross is below Payroll (most likely first)**

1. **Gross** used **`calcGrossFromRates`** from the staff-rates xlsx. Remaining gap vs payroll is usually **period/scope** (roster vs FN), **extra pay lines** in payroll, or **name spelling** (rates row is a different person).
2. **Implied rate gap:** payroll ~$46.56/h vs gross ~$41.55/h across these hours — **items in payroll** not in the formula (e.g. leave, allowances outside sheet), or **rate column mismatch** (export not same as pay run).
3. **Period / scope:** roster span may not match the payroll fortnight; payroll can include **leave, adjustments, on-call, or other lines** not in the scheduler CSV.
4. **High afternoon/night share (100%)** — more penalty loading; small errors in **band split** (or sleepover follow-on) change dollars; payroll may use different treatment.
5. **No** parse-failed rows attributed to this staff name in the CSV error list (other staff may still have failed rows).

### Egline Jerop

| Field | Value |
| --- | --- |
| Payroll (import) | $2802.44 |
| Gross (this report) | $2724.18 |
| Diff (Gross − Payroll) | **$-78.26** (-2.87% of gross) |
| Pay-hours total (excl. sleepover allowance hours in total) | 58 h |
| Implied $/h (Payroll ÷ pay-hours) | ~$48.32/h |
| Implied $/h (Gross ÷ pay-hours) | ~$46.97/h (from per-staff rates xlsx) |
| Staff rates row in xlsx? | **Yes** (normName match) |
| Weekday band mix (afternoon+night share of m+a+n) | 100% |

**Why Gross is below Payroll (most likely first)**

1. **Gross** used **`calcGrossFromRates`** from the staff-rates xlsx. Remaining gap vs payroll is usually **period/scope** (roster vs FN), **extra pay lines** in payroll, or **name spelling** (rates row is a different person).
2. **Implied rate gap:** payroll ~$48.32/h vs gross ~$46.97/h across these hours — **items in payroll** not in the formula (e.g. leave, allowances outside sheet), or **rate column mismatch** (export not same as pay run).
3. **Period / scope:** roster span may not match the payroll fortnight; payroll can include **leave, adjustments, on-call, or other lines** not in the scheduler CSV.
4. **High afternoon/night share (100%)** — more penalty loading; small errors in **band split** (or sleepover follow-on) change dollars; payroll may use different treatment.
5. **No** parse-failed rows attributed to this staff name in the CSV error list (other staff may still have failed rows).

### Lucie Kahindo

| Field | Value |
| --- | --- |
| Payroll (import) | $2379.38 |
| Gross (this report) | $2301.12 |
| Diff (Gross − Payroll) | **$-78.26** (-3.4% of gross) |
| Pay-hours total (excl. sleepover allowance hours in total) | 48 h |
| Implied $/h (Payroll ÷ pay-hours) | ~$49.57/h |
| Implied $/h (Gross ÷ pay-hours) | ~$47.94/h (from per-staff rates xlsx) |
| Staff rates row in xlsx? | **Yes** (normName match) |
| Weekday band mix (afternoon+night share of m+a+n) | 100% |

**Why Gross is below Payroll (most likely first)**

1. **Gross** used **`calcGrossFromRates`** from the staff-rates xlsx. Remaining gap vs payroll is usually **period/scope** (roster vs FN), **extra pay lines** in payroll, or **name spelling** (rates row is a different person).
2. **Implied rate gap:** payroll ~$49.57/h vs gross ~$47.94/h across these hours — **items in payroll** not in the formula (e.g. leave, allowances outside sheet), or **rate column mismatch** (export not same as pay run).
3. **Period / scope:** roster span may not match the payroll fortnight; payroll can include **leave, adjustments, on-call, or other lines** not in the scheduler CSV.
4. **High afternoon/night share (100%)** — more penalty loading; small errors in **band split** (or sleepover follow-on) change dollars; payroll may use different treatment.
5. **No** parse-failed rows attributed to this staff name in the CSV error list (other staff may still have failed rows).

### Tomseena Tomy

| Field | Value |
| --- | --- |
| Payroll (import) | $2448.96 |
| Gross (this report) | $2370.70 |
| Diff (Gross − Payroll) | **$-78.26** (-3.3% of gross) |
| Pay-hours total (excl. sleepover allowance hours in total) | 58 h |
| Implied $/h (Payroll ÷ pay-hours) | ~$42.22/h |
| Implied $/h (Gross ÷ pay-hours) | ~$40.87/h (from per-staff rates xlsx) |
| Staff rates row in xlsx? | **Yes** (normName match) |
| Weekday band mix (afternoon+night share of m+a+n) | 46% |

**Why Gross is below Payroll (most likely first)**

1. **Gross** used **`calcGrossFromRates`** from the staff-rates xlsx. Remaining gap vs payroll is usually **period/scope** (roster vs FN), **extra pay lines** in payroll, or **name spelling** (rates row is a different person).
2. **Implied rate gap:** payroll ~$42.22/h vs gross ~$40.87/h across these hours — **items in payroll** not in the formula (e.g. leave, allowances outside sheet), or **rate column mismatch** (export not same as pay run).
3. **Period / scope:** roster span may not match the payroll fortnight; payroll can include **leave, adjustments, on-call, or other lines** not in the scheduler CSV.
4. **High afternoon/night share (46%)** — more penalty loading; small errors in **band split** (or sleepover follow-on) change dollars; payroll may use different treatment.
5. **No** parse-failed rows attributed to this staff name in the CSV error list (other staff may still have failed rows).

### Adhith Issac

| Field | Value |
| --- | --- |
| Payroll (import) | $1966.54 |
| Gross (this report) | $1897.66 |
| Diff (Gross − Payroll) | **$-68.88** (-3.63% of gross) |
| Pay-hours total (excl. sleepover allowance hours in total) | 45.5 h |
| Implied $/h (Payroll ÷ pay-hours) | ~$43.22/h |
| Implied $/h (Gross ÷ pay-hours) | ~$41.71/h (from per-staff rates xlsx) |
| Staff rates row in xlsx? | **Yes** (normName match) |
| Weekday band mix (afternoon+night share of m+a+n) | 0% |

**Why Gross is below Payroll (most likely first)**

1. **Gross** used **`calcGrossFromRates`** from the staff-rates xlsx. Remaining gap vs payroll is usually **period/scope** (roster vs FN), **extra pay lines** in payroll, or **name spelling** (rates row is a different person).
2. **Implied rate gap:** payroll ~$43.22/h vs gross ~$41.71/h across these hours — **items in payroll** not in the formula (e.g. leave, allowances outside sheet), or **rate column mismatch** (export not same as pay run).
3. **Period / scope:** roster span may not match the payroll fortnight; payroll can include **leave, adjustments, on-call, or other lines** not in the scheduler CSV.
4. **No** parse-failed rows attributed to this staff name in the CSV error list (other staff may still have failed rows).

### Austin Santhosh

| Field | Value |
| --- | --- |
| Payroll (import) | $2261.90 |
| Gross (this report) | $2193.02 |
| Diff (Gross − Payroll) | **$-68.88** (-3.14% of gross) |
| Pay-hours total (excl. sleepover allowance hours in total) | 48 h |
| Implied $/h (Payroll ÷ pay-hours) | ~$47.12/h |
| Implied $/h (Gross ÷ pay-hours) | ~$45.69/h (from per-staff rates xlsx) |
| Staff rates row in xlsx? | **Yes** (normName match) |
| Weekday band mix (afternoon+night share of m+a+n) | 100% |

**Why Gross is below Payroll (most likely first)**

1. **Gross** used **`calcGrossFromRates`** from the staff-rates xlsx. Remaining gap vs payroll is usually **period/scope** (roster vs FN), **extra pay lines** in payroll, or **name spelling** (rates row is a different person).
2. **Implied rate gap:** payroll ~$47.12/h vs gross ~$45.69/h across these hours — **items in payroll** not in the formula (e.g. leave, allowances outside sheet), or **rate column mismatch** (export not same as pay run).
3. **Period / scope:** roster span may not match the payroll fortnight; payroll can include **leave, adjustments, on-call, or other lines** not in the scheduler CSV.
4. **High afternoon/night share (100%)** — more penalty loading; small errors in **band split** (or sleepover follow-on) change dollars; payroll may use different treatment.
5. **No** parse-failed rows attributed to this staff name in the CSV error list (other staff may still have failed rows).

### Gajal Verma

| Field | Value |
| --- | --- |
| Payroll (import) | $1795.19 |
| Gross (this report) | $1750.80 |
| Diff (Gross − Payroll) | **$-44.39** (-2.54% of gross) |
| Pay-hours total (excl. sleepover allowance hours in total) | 34.75 h |
| Implied $/h (Payroll ÷ pay-hours) | ~$51.66/h |
| Implied $/h (Gross ÷ pay-hours) | ~$50.38/h (from per-staff rates xlsx) |
| Staff rates row in xlsx? | **Yes** (normName match) |
| Weekday band mix (afternoon+night share of m+a+n) | 100% |

**Why Gross is below Payroll (most likely first)**

1. **Gross** used **`calcGrossFromRates`** from the staff-rates xlsx. Remaining gap vs payroll is usually **period/scope** (roster vs FN), **extra pay lines** in payroll, or **name spelling** (rates row is a different person).
2. **Implied rate gap:** payroll ~$51.66/h vs gross ~$50.38/h across these hours — **items in payroll** not in the formula (e.g. leave, allowances outside sheet), or **rate column mismatch** (export not same as pay run).
3. **Period / scope:** roster span may not match the payroll fortnight; payroll can include **leave, adjustments, on-call, or other lines** not in the scheduler CSV.
4. **High afternoon/night share (100%)** — more penalty loading; small errors in **band split** (or sleepover follow-on) change dollars; payroll may use different treatment.
5. **No** parse-failed rows attributed to this staff name in the CSV error list (other staff may still have failed rows).

### Christine Nicholson

| Field | Value |
| --- | --- |
| Payroll (import) | $1412.41 |
| Gross (this report) | $1377.41 |
| Diff (Gross − Payroll) | **$-35.00** (-2.54% of gross) |
| Pay-hours total (excl. sleepover allowance hours in total) | 35 h |
| Implied $/h (Payroll ÷ pay-hours) | ~$40.35/h |
| Implied $/h (Gross ÷ pay-hours) | ~$39.35/h (from per-staff rates xlsx) |
| Staff rates row in xlsx? | **Yes** (normName match) |
| Weekday band mix (afternoon+night share of m+a+n) | 0% |

**Why Gross is below Payroll (most likely first)**

1. **Gross** used **`calcGrossFromRates`** from the staff-rates xlsx. Remaining gap vs payroll is usually **period/scope** (roster vs FN), **extra pay lines** in payroll, or **name spelling** (rates row is a different person).
2. **Implied rate gap:** payroll ~$40.35/h vs gross ~$39.35/h across these hours — **items in payroll** not in the formula (e.g. leave, allowances outside sheet), or **rate column mismatch** (export not same as pay run).
3. **Period / scope:** roster span may not match the payroll fortnight; payroll can include **leave, adjustments, on-call, or other lines** not in the scheduler CSV.
4. **No** parse-failed rows attributed to this staff name in the CSV error list (other staff may still have failed rows).

### Mohammed Lakhal

| Field | Value |
| --- | --- |
| Payroll (import) | $2232.12 |
| Gross (this report) | $2201.64 |
| Diff (Gross − Payroll) | **$-30.48** (-1.38% of gross) |
| Pay-hours total (excl. sleepover allowance hours in total) | 40 h |
| Implied $/h (Payroll ÷ pay-hours) | ~$55.80/h |
| Implied $/h (Gross ÷ pay-hours) | ~$55.04/h (from per-staff rates xlsx) |
| Staff rates row in xlsx? | **Yes** (normName match) |
| Weekday band mix (afternoon+night share of m+a+n) | 100% |

**Why Gross is below Payroll (most likely first)**

1. **Gross** used **`calcGrossFromRates`** from the staff-rates xlsx. Remaining gap vs payroll is usually **period/scope** (roster vs FN), **extra pay lines** in payroll, or **name spelling** (rates row is a different person).
2. **Implied rate gap:** payroll ~$55.80/h vs gross ~$55.04/h across these hours — **items in payroll** not in the formula (e.g. leave, allowances outside sheet), or **rate column mismatch** (export not same as pay run).
3. **Period / scope:** roster span may not match the payroll fortnight; payroll can include **leave, adjustments, on-call, or other lines** not in the scheduler CSV.
4. **High afternoon/night share (100%)** — more penalty loading; small errors in **band split** (or sleepover follow-on) change dollars; payroll may use different treatment.
5. **No** parse-failed rows attributed to this staff name in the CSV error list (other staff may still have failed rows).

### Naomi Prescott

| Field | Value |
| --- | --- |
| Payroll (import) | $3059.10 |
| Gross (this report) | $3031.38 |
| Diff (Gross − Payroll) | **$-27.72** (-0.91% of gross) |
| Pay-hours total (excl. sleepover allowance hours in total) | 63 h |
| Implied $/h (Payroll ÷ pay-hours) | ~$48.56/h |
| Implied $/h (Gross ÷ pay-hours) | ~$48.12/h (from per-staff rates xlsx) |
| Staff rates row in xlsx? | **Yes** (normName match) |
| Weekday band mix (afternoon+night share of m+a+n) | 0% |

**Why Gross is below Payroll (most likely first)**

1. **Gross** used **`calcGrossFromRates`** from the staff-rates xlsx. Remaining gap vs payroll is usually **period/scope** (roster vs FN), **extra pay lines** in payroll, or **name spelling** (rates row is a different person).
2. **Period / scope:** roster span may not match the payroll fortnight; payroll can include **leave, adjustments, on-call, or other lines** not in the scheduler CSV.
3. **No** parse-failed rows attributed to this staff name in the CSV error list (other staff may still have failed rows).

### Joan Segaruma Mutesi

| Field | Value |
| --- | --- |
| Payroll (import) | $2615.84 |
| Gross (this report) | $2588.16 |
| Diff (Gross − Payroll) | **$-27.68** (-1.07% of gross) |
| Pay-hours total (excl. sleepover allowance hours in total) | 51 h |
| Implied $/h (Payroll ÷ pay-hours) | ~$51.29/h |
| Implied $/h (Gross ÷ pay-hours) | ~$50.75/h (from per-staff rates xlsx) |
| Staff rates row in xlsx? | **Yes** (normName match) |
| Weekday band mix (afternoon+night share of m+a+n) | 73% |

**Why Gross is below Payroll (most likely first)**

1. **Gross** used **`calcGrossFromRates`** from the staff-rates xlsx. Remaining gap vs payroll is usually **period/scope** (roster vs FN), **extra pay lines** in payroll, or **name spelling** (rates row is a different person).
2. **Implied rate gap:** payroll ~$51.29/h vs gross ~$50.75/h across these hours — **items in payroll** not in the formula (e.g. leave, allowances outside sheet), or **rate column mismatch** (export not same as pay run).
3. **Period / scope:** roster span may not match the payroll fortnight; payroll can include **leave, adjustments, on-call, or other lines** not in the scheduler CSV.
4. **High afternoon/night share (73%)** — more penalty loading; small errors in **band split** (or sleepover follow-on) change dollars; payroll may use different treatment.
5. **No** parse-failed rows attributed to this staff name in the CSV error list (other staff may still have failed rows).

### Goutham Jinesh Chitteth

| Field | Value |
| --- | --- |
| Payroll (import) | $1815.11 |
| Gross (this report) | $1796.99 |
| Diff (Gross − Payroll) | **$-18.12** (-1.01% of gross) |
| Pay-hours total (excl. sleepover allowance hours in total) | 47 h |
| Implied $/h (Payroll ÷ pay-hours) | ~$38.62/h |
| Implied $/h (Gross ÷ pay-hours) | ~$38.23/h (from per-staff rates xlsx) |
| Staff rates row in xlsx? | **Yes** (normName match) |
| Weekday band mix (afternoon+night share of m+a+n) | 0% |

**Why Gross is below Payroll (most likely first)**

1. **Gross** used **`calcGrossFromRates`** from the staff-rates xlsx. Remaining gap vs payroll is usually **period/scope** (roster vs FN), **extra pay lines** in payroll, or **name spelling** (rates row is a different person).
2. **Period / scope:** roster span may not match the payroll fortnight; payroll can include **leave, adjustments, on-call, or other lines** not in the scheduler CSV.
3. **No** parse-failed rows attributed to this staff name in the CSV error list (other staff may still have failed rows).

### Sona Sara Paul

| Field | Value |
| --- | --- |
| Payroll (import) | $3109.64 |
| Gross (this report) | $3094.68 |
| Diff (Gross − Payroll) | **$-14.96** (-0.48% of gross) |
| Pay-hours total (excl. sleepover allowance hours in total) | 66 h |
| Implied $/h (Payroll ÷ pay-hours) | ~$47.12/h |
| Implied $/h (Gross ÷ pay-hours) | ~$46.89/h (from per-staff rates xlsx) |
| Staff rates row in xlsx? | **Yes** (normName match) |
| Weekday band mix (afternoon+night share of m+a+n) | 78% |

**Why Gross is below Payroll (most likely first)**

1. **Gross** used **`calcGrossFromRates`** from the staff-rates xlsx. Remaining gap vs payroll is usually **period/scope** (roster vs FN), **extra pay lines** in payroll, or **name spelling** (rates row is a different person).
2. **Period / scope:** roster span may not match the payroll fortnight; payroll can include **leave, adjustments, on-call, or other lines** not in the scheduler CSV.
3. **High afternoon/night share (78%)** — more penalty loading; small errors in **band split** (or sleepover follow-on) change dollars; payroll may use different treatment.
4. **No** parse-failed rows attributed to this staff name in the CSV error list (other staff may still have failed rows).

### Abdullateef Kuranga

| Field | Value |
| --- | --- |
| Payroll (import) | $4312.40 |
| Gross (this report) | $4299.28 |
| Diff (Gross − Payroll) | **$-13.12** (-0.31% of gross) |
| Pay-hours total (excl. sleepover allowance hours in total) | 72.5 h |
| Implied $/h (Payroll ÷ pay-hours) | ~$59.48/h |
| Implied $/h (Gross ÷ pay-hours) | ~$59.30/h (from per-staff rates xlsx) |
| Staff rates row in xlsx? | **Yes** (normName match) |
| Weekday band mix (afternoon+night share of m+a+n) | 100% |

**Why Gross is below Payroll (most likely first)**

1. **Gross** used **`calcGrossFromRates`** from the staff-rates xlsx. Remaining gap vs payroll is usually **period/scope** (roster vs FN), **extra pay lines** in payroll, or **name spelling** (rates row is a different person).
2. **Period / scope:** roster span may not match the payroll fortnight; payroll can include **leave, adjustments, on-call, or other lines** not in the scheduler CSV.
3. **High afternoon/night share (100%)** — more penalty loading; small errors in **band split** (or sleepover follow-on) change dollars; payroll may use different treatment.
4. **No** parse-failed rows attributed to this staff name in the CSV error list (other staff may still have failed rows).

### Kiran Sabu

| Field | Value |
| --- | --- |
| Payroll (import) | $2877.88 |
| Gross (this report) | $2866.04 |
| Diff (Gross − Payroll) | **$-11.84** (-0.41% of gross) |
| Pay-hours total (excl. sleepover allowance hours in total) | 50 h |
| Implied $/h (Payroll ÷ pay-hours) | ~$57.56/h |
| Implied $/h (Gross ÷ pay-hours) | ~$57.32/h (from per-staff rates xlsx) |
| Staff rates row in xlsx? | **Yes** (normName match) |
| Weekday band mix (afternoon+night share of m+a+n) | 100% |

**Why Gross is below Payroll (most likely first)**

1. **Gross** used **`calcGrossFromRates`** from the staff-rates xlsx. Remaining gap vs payroll is usually **period/scope** (roster vs FN), **extra pay lines** in payroll, or **name spelling** (rates row is a different person).
2. **Period / scope:** roster span may not match the payroll fortnight; payroll can include **leave, adjustments, on-call, or other lines** not in the scheduler CSV.
3. **High afternoon/night share (100%)** — more penalty loading; small errors in **band split** (or sleepover follow-on) change dollars; payroll may use different treatment.
4. **No** parse-failed rows attributed to this staff name in the CSV error list (other staff may still have failed rows).

### Jibin Karekkatt Thomas

| Field | Value |
| --- | --- |
| Payroll (import) | $2257.36 |
| Gross (this report) | $2246.25 |
| Diff (Gross − Payroll) | **$-11.11** (-0.49% of gross) |
| Pay-hours total (excl. sleepover allowance hours in total) | 50 h |
| Implied $/h (Payroll ÷ pay-hours) | ~$45.15/h |
| Implied $/h (Gross ÷ pay-hours) | ~$44.93/h (from per-staff rates xlsx) |
| Staff rates row in xlsx? | **Yes** (normName match) |
| Weekday band mix (afternoon+night share of m+a+n) | 94% |

**Why Gross is below Payroll (most likely first)**

1. **Gross** used **`calcGrossFromRates`** from the staff-rates xlsx. Remaining gap vs payroll is usually **period/scope** (roster vs FN), **extra pay lines** in payroll, or **name spelling** (rates row is a different person).
2. **Period / scope:** roster span may not match the payroll fortnight; payroll can include **leave, adjustments, on-call, or other lines** not in the scheduler CSV.
3. **High afternoon/night share (94%)** — more penalty loading; small errors in **band split** (or sleepover follow-on) change dollars; payroll may use different treatment.
4. **No** parse-failed rows attributed to this staff name in the CSV error list (other staff may still have failed rows).

### Willimina Giple

| Field | Value |
| --- | --- |
| Payroll (import) | $318.55 |
| Gross (this report) | $308.71 |
| Diff (Gross − Payroll) | **$-9.84** (-3.19% of gross) |
| Pay-hours total (excl. sleepover allowance hours in total) | 8 h |
| Implied $/h (Payroll ÷ pay-hours) | ~$39.82/h |
| Implied $/h (Gross ÷ pay-hours) | ~$38.59/h (at $35 casual default) |
| Staff rates row in xlsx? | **No** (normName match) |
| Weekday band mix (afternoon+night share of m+a+n) | 0% |

**Why Gross is below Payroll (most likely first)**

1. **No staff-rates match** for this name — this report used **$35/h** casual `calcGross` for them. If the calculator in the app shows a rate from your rates XLSX, **re-run** with the same `[staff-rates.xlsx]` so gross matches.
2. **Implied rate gap:** payroll ~$39.82/h vs gross ~$38.59/h across these hours — **higher** rates in payroll than a **$35** casual build, or **items not modelled** in the flat build.
3. **Period / scope:** roster span may not match the payroll fortnight; payroll can include **leave, adjustments, on-call, or other lines** not in the scheduler CSV.
4. **No** parse-failed rows attributed to this staff name in the CSV error list (other staff may still have failed rows).

### Anakha mariya Sabu

| Field | Value |
| --- | --- |
| Payroll (import) | $2516.10 |
| Gross (this report) | $2506.56 |
| Diff (Gross − Payroll) | **$-9.54** (-0.38% of gross) |
| Pay-hours total (excl. sleepover allowance hours in total) | 48.75 h |
| Implied $/h (Payroll ÷ pay-hours) | ~$51.61/h |
| Implied $/h (Gross ÷ pay-hours) | ~$51.42/h (from per-staff rates xlsx) |
| Staff rates row in xlsx? | **Yes** (normName match) |
| Weekday band mix (afternoon+night share of m+a+n) | 41% |

**Why Gross is below Payroll (most likely first)**

1. **Gross** used **`calcGrossFromRates`** from the staff-rates xlsx. Remaining gap vs payroll is usually **period/scope** (roster vs FN), **extra pay lines** in payroll, or **name spelling** (rates row is a different person).
2. **Period / scope:** roster span may not match the payroll fortnight; payroll can include **leave, adjustments, on-call, or other lines** not in the scheduler CSV.
3. **High afternoon/night share (41%)** — more penalty loading; small errors in **band split** (or sleepover follow-on) change dollars; payroll may use different treatment.
4. **No** parse-failed rows attributed to this staff name in the CSV error list (other staff may still have failed rows).

### Zainab Jalloh

| Field | Value |
| --- | --- |
| Payroll (import) | $936.40 |
| Gross (this report) | $928.12 |
| Diff (Gross − Payroll) | **$-8.28** (-0.89% of gross) |
| Pay-hours total (excl. sleepover allowance hours in total) | 19.5 h |
| Implied $/h (Payroll ÷ pay-hours) | ~$48.02/h |
| Implied $/h (Gross ÷ pay-hours) | ~$47.60/h (from per-staff rates xlsx) |
| Staff rates row in xlsx? | **Yes** (normName match) |
| Weekday band mix (afternoon+night share of m+a+n) | 59% |

**Why Gross is below Payroll (most likely first)**

1. **Gross** used **`calcGrossFromRates`** from the staff-rates xlsx. Remaining gap vs payroll is usually **period/scope** (roster vs FN), **extra pay lines** in payroll, or **name spelling** (rates row is a different person).
2. **Period / scope:** roster span may not match the payroll fortnight; payroll can include **leave, adjustments, on-call, or other lines** not in the scheduler CSV.
3. **High afternoon/night share (59%)** — more penalty loading; small errors in **band split** (or sleepover follow-on) change dollars; payroll may use different treatment.
4. **No** parse-failed rows attributed to this staff name in the CSV error list (other staff may still have failed rows).

### Jyoti Kaur

| Field | Value |
| --- | --- |
| Payroll (import) | $2900.53 |
| Gross (this report) | $2892.71 |
| Diff (Gross − Payroll) | **$-7.82** (-0.27% of gross) |
| Pay-hours total (excl. sleepover allowance hours in total) | 68 h |
| Implied $/h (Payroll ÷ pay-hours) | ~$42.65/h |
| Implied $/h (Gross ÷ pay-hours) | ~$42.54/h (from per-staff rates xlsx) |
| Staff rates row in xlsx? | **Yes** (normName match) |
| Weekday band mix (afternoon+night share of m+a+n) | 95% |

**Why Gross is below Payroll (most likely first)**

1. **Gross** used **`calcGrossFromRates`** from the staff-rates xlsx. Remaining gap vs payroll is usually **period/scope** (roster vs FN), **extra pay lines** in payroll, or **name spelling** (rates row is a different person).
2. **Period / scope:** roster span may not match the payroll fortnight; payroll can include **leave, adjustments, on-call, or other lines** not in the scheduler CSV.
3. **High afternoon/night share (95%)** — more penalty loading; small errors in **band split** (or sleepover follow-on) change dollars; payroll may use different treatment.
4. **No** parse-failed rows attributed to this staff name in the CSV error list (other staff may still have failed rows).

### Riya Elizabath George

| Field | Value |
| --- | --- |
| Payroll (import) | $1113.58 |
| Gross (this report) | $1105.76 |
| Diff (Gross − Payroll) | **$-7.82** (-0.71% of gross) |
| Pay-hours total (excl. sleepover allowance hours in total) | 33 h |
| Implied $/h (Payroll ÷ pay-hours) | ~$33.74/h |
| Implied $/h (Gross ÷ pay-hours) | ~$33.51/h (from per-staff rates xlsx) |
| Staff rates row in xlsx? | **Yes** (normName match) |
| Weekday band mix (afternoon+night share of m+a+n) | 24% |

**Why Gross is below Payroll (most likely first)**

1. **Gross** used **`calcGrossFromRates`** from the staff-rates xlsx. Remaining gap vs payroll is usually **period/scope** (roster vs FN), **extra pay lines** in payroll, or **name spelling** (rates row is a different person).
2. **Period / scope:** roster span may not match the payroll fortnight; payroll can include **leave, adjustments, on-call, or other lines** not in the scheduler CSV.
3. **No** parse-failed rows attributed to this staff name in the CSV error list (other staff may still have failed rows).

### Marion Jepleting

| Field | Value |
| --- | --- |
| Payroll (import) | $979.89 |
| Gross (this report) | $973.41 |
| Diff (Gross − Payroll) | **$-6.48** (-0.67% of gross) |
| Pay-hours total (excl. sleepover allowance hours in total) | 21 h |
| Implied $/h (Payroll ÷ pay-hours) | ~$46.66/h |
| Implied $/h (Gross ÷ pay-hours) | ~$46.35/h (from per-staff rates xlsx) |
| Staff rates row in xlsx? | **Yes** (normName match) |
| Weekday band mix (afternoon+night share of m+a+n) | 43% |

**Why Gross is below Payroll (most likely first)**

1. **Gross** used **`calcGrossFromRates`** from the staff-rates xlsx. Remaining gap vs payroll is usually **period/scope** (roster vs FN), **extra pay lines** in payroll, or **name spelling** (rates row is a different person).
2. **Period / scope:** roster span may not match the payroll fortnight; payroll can include **leave, adjustments, on-call, or other lines** not in the scheduler CSV.
3. **High afternoon/night share (43%)** — more penalty loading; small errors in **band split** (or sleepover follow-on) change dollars; payroll may use different treatment.
4. **No** parse-failed rows attributed to this staff name in the CSV error list (other staff may still have failed rows).

### Michael Angelo Eribaren

| Field | Value |
| --- | --- |
| Payroll (import) | $3095.45 |
| Gross (this report) | $3089.69 |
| Diff (Gross − Payroll) | **$-5.76** (-0.19% of gross) |
| Pay-hours total (excl. sleepover allowance hours in total) | 56 h |
| Implied $/h (Payroll ÷ pay-hours) | ~$55.28/h |
| Implied $/h (Gross ÷ pay-hours) | ~$55.17/h (from per-staff rates xlsx) |
| Staff rates row in xlsx? | **Yes** (normName match) |
| Weekday band mix (afternoon+night share of m+a+n) | 33% |

**Why Gross is below Payroll (most likely first)**

1. **Gross** used **`calcGrossFromRates`** from the staff-rates xlsx. Remaining gap vs payroll is usually **period/scope** (roster vs FN), **extra pay lines** in payroll, or **name spelling** (rates row is a different person).
2. **Period / scope:** roster span may not match the payroll fortnight; payroll can include **leave, adjustments, on-call, or other lines** not in the scheduler CSV.
3. **No** parse-failed rows attributed to this staff name in the CSV error list (other staff may still have failed rows).

### Alexandra Lucas

| Field | Value |
| --- | --- |
| Payroll (import) | $1839.74 |
| Gross (this report) | $1834.23 |
| Diff (Gross − Payroll) | **$-5.51** (-0.3% of gross) |
| Pay-hours total (excl. sleepover allowance hours in total) | 41.5 h |
| Implied $/h (Payroll ÷ pay-hours) | ~$44.33/h |
| Implied $/h (Gross ÷ pay-hours) | ~$44.20/h (from per-staff rates xlsx) |
| Staff rates row in xlsx? | **Yes** (normName match) |
| Weekday band mix (afternoon+night share of m+a+n) | 29% |

**Why Gross is below Payroll (most likely first)**

1. **Gross** used **`calcGrossFromRates`** from the staff-rates xlsx. Remaining gap vs payroll is usually **period/scope** (roster vs FN), **extra pay lines** in payroll, or **name spelling** (rates row is a different person).
2. **Period / scope:** roster span may not match the payroll fortnight; payroll can include **leave, adjustments, on-call, or other lines** not in the scheduler CSV.
3. **No** parse-failed rows attributed to this staff name in the CSV error list (other staff may still have failed rows).

### Manasiben Thakkar

| Field | Value |
| --- | --- |
| Payroll (import) | $2913.73 |
| Gross (this report) | $2909.05 |
| Diff (Gross − Payroll) | **$-4.68** (-0.16% of gross) |
| Pay-hours total (excl. sleepover allowance hours in total) | 61.5 h |
| Implied $/h (Payroll ÷ pay-hours) | ~$47.38/h |
| Implied $/h (Gross ÷ pay-hours) | ~$47.30/h (from per-staff rates xlsx) |
| Staff rates row in xlsx? | **Yes** (normName match) |
| Weekday band mix (afternoon+night share of m+a+n) | 16% |

**Why Gross is below Payroll (most likely first)**

1. **Gross** used **`calcGrossFromRates`** from the staff-rates xlsx. Remaining gap vs payroll is usually **period/scope** (roster vs FN), **extra pay lines** in payroll, or **name spelling** (rates row is a different person).
2. **Period / scope:** roster span may not match the payroll fortnight; payroll can include **leave, adjustments, on-call, or other lines** not in the scheduler CSV.
3. **No** parse-failed rows attributed to this staff name in the CSV error list (other staff may still have failed rows).

### Melowdy Zahau

| Field | Value |
| --- | --- |
| Payroll (import) | $440.32 |
| Gross (this report) | $435.64 |
| Diff (Gross − Payroll) | **$-4.68** (-1.07% of gross) |
| Pay-hours total (excl. sleepover allowance hours in total) | 8 h |
| Implied $/h (Payroll ÷ pay-hours) | ~$55.04/h |
| Implied $/h (Gross ÷ pay-hours) | ~$54.46/h (from per-staff rates xlsx) |
| Staff rates row in xlsx? | **Yes** (normName match) |
| Weekday band mix (afternoon+night share of m+a+n) | 100% |

**Why Gross is below Payroll (most likely first)**

1. **Gross** used **`calcGrossFromRates`** from the staff-rates xlsx. Remaining gap vs payroll is usually **period/scope** (roster vs FN), **extra pay lines** in payroll, or **name spelling** (rates row is a different person).
2. **Implied rate gap:** payroll ~$55.04/h vs gross ~$54.46/h across these hours — **items in payroll** not in the formula (e.g. leave, allowances outside sheet), or **rate column mismatch** (export not same as pay run).
3. **Period / scope:** roster span may not match the payroll fortnight; payroll can include **leave, adjustments, on-call, or other lines** not in the scheduler CSV.
4. **High afternoon/night share (100%)** — more penalty loading; small errors in **band split** (or sleepover follow-on) change dollars; payroll may use different treatment.
5. **No** parse-failed rows attributed to this staff name in the CSV error list (other staff may still have failed rows).

### Netsayi Kunaka

| Field | Value |
| --- | --- |
| Payroll (import) | $4053.07 |
| Gross (this report) | $4048.39 |
| Diff (Gross − Payroll) | **$-4.68** (-0.12% of gross) |
| Pay-hours total (excl. sleepover allowance hours in total) | 77 h |
| Implied $/h (Payroll ÷ pay-hours) | ~$52.64/h |
| Implied $/h (Gross ÷ pay-hours) | ~$52.58/h (from per-staff rates xlsx) |
| Staff rates row in xlsx? | **Yes** (normName match) |
| Weekday band mix (afternoon+night share of m+a+n) | 100% |

**Why Gross is below Payroll (most likely first)**

1. **Gross** used **`calcGrossFromRates`** from the staff-rates xlsx. Remaining gap vs payroll is usually **period/scope** (roster vs FN), **extra pay lines** in payroll, or **name spelling** (rates row is a different person).
2. **Period / scope:** roster span may not match the payroll fortnight; payroll can include **leave, adjustments, on-call, or other lines** not in the scheduler CSV.
3. **High afternoon/night share (100%)** — more penalty loading; small errors in **band split** (or sleepover follow-on) change dollars; payroll may use different treatment.
4. **No** parse-failed rows attributed to this staff name in the CSV error list (other staff may still have failed rows).

### Allyssa Mae Guzman

| Field | Value |
| --- | --- |
| Payroll (import) | $2833.25 |
| Gross (this report) | $2828.93 |
| Diff (Gross − Payroll) | **$-4.32** (-0.15% of gross) |
| Pay-hours total (excl. sleepover allowance hours in total) | 67 h |
| Implied $/h (Payroll ÷ pay-hours) | ~$42.29/h |
| Implied $/h (Gross ÷ pay-hours) | ~$42.22/h (from per-staff rates xlsx) |
| Staff rates row in xlsx? | **Yes** (normName match) |
| Weekday band mix (afternoon+night share of m+a+n) | 11% |

**Why Gross is below Payroll (most likely first)**

1. **Gross** used **`calcGrossFromRates`** from the staff-rates xlsx. Remaining gap vs payroll is usually **period/scope** (roster vs FN), **extra pay lines** in payroll, or **name spelling** (rates row is a different person).
2. **Period / scope:** roster span may not match the payroll fortnight; payroll can include **leave, adjustments, on-call, or other lines** not in the scheduler CSV.
3. **No** parse-failed rows attributed to this staff name in the CSV error list (other staff may still have failed rows).

### Michelle Rabach

| Field | Value |
| --- | --- |
| Payroll (import) | $1282.00 |
| Gross (this report) | $1277.68 |
| Diff (Gross − Payroll) | **$-4.32** (-0.34% of gross) |
| Pay-hours total (excl. sleepover allowance hours in total) | 29 h |
| Implied $/h (Payroll ÷ pay-hours) | ~$44.21/h |
| Implied $/h (Gross ÷ pay-hours) | ~$44.06/h (from per-staff rates xlsx) |
| Staff rates row in xlsx? | **Yes** (normName match) |
| Weekday band mix (afternoon+night share of m+a+n) | 27% |

**Why Gross is below Payroll (most likely first)**

1. **Gross** used **`calcGrossFromRates`** from the staff-rates xlsx. Remaining gap vs payroll is usually **period/scope** (roster vs FN), **extra pay lines** in payroll, or **name spelling** (rates row is a different person).
2. **Period / scope:** roster span may not match the payroll fortnight; payroll can include **leave, adjustments, on-call, or other lines** not in the scheduler CSV.
3. **No** parse-failed rows attributed to this staff name in the CSV error list (other staff may still have failed rows).

### Shantale Apolina

| Field | Value |
| --- | --- |
| Payroll (import) | $1744.83 |
| Gross (this report) | $1740.51 |
| Diff (Gross − Payroll) | **$-4.32** (-0.25% of gross) |
| Pay-hours total (excl. sleepover allowance hours in total) | 34 h |
| Implied $/h (Payroll ÷ pay-hours) | ~$51.32/h |
| Implied $/h (Gross ÷ pay-hours) | ~$51.19/h (from per-staff rates xlsx) |
| Staff rates row in xlsx? | **Yes** (normName match) |
| Weekday band mix (afternoon+night share of m+a+n) | 82% |

**Why Gross is below Payroll (most likely first)**

1. **Gross** used **`calcGrossFromRates`** from the staff-rates xlsx. Remaining gap vs payroll is usually **period/scope** (roster vs FN), **extra pay lines** in payroll, or **name spelling** (rates row is a different person).
2. **Period / scope:** roster span may not match the payroll fortnight; payroll can include **leave, adjustments, on-call, or other lines** not in the scheduler CSV.
3. **High afternoon/night share (82%)** — more penalty loading; small errors in **band split** (or sleepover follow-on) change dollars; payroll may use different treatment.
4. **No** parse-failed rows attributed to this staff name in the CSV error list (other staff may still have failed rows).

### Ann Mary Augustin

| Field | Value |
| --- | --- |
| Payroll (import) | $1958.24 |
| Gross (this report) | $1955.64 |
| Diff (Gross − Payroll) | **$-2.60** (-0.13% of gross) |
| Pay-hours total (excl. sleepover allowance hours in total) | 44.5 h |
| Implied $/h (Payroll ÷ pay-hours) | ~$44.01/h |
| Implied $/h (Gross ÷ pay-hours) | ~$43.95/h (from per-staff rates xlsx) |
| Staff rates row in xlsx? | **Yes** (normName match) |
| Weekday band mix (afternoon+night share of m+a+n) | 20% |

**Why Gross is below Payroll (most likely first)**

1. **Gross** used **`calcGrossFromRates`** from the staff-rates xlsx. Remaining gap vs payroll is usually **period/scope** (roster vs FN), **extra pay lines** in payroll, or **name spelling** (rates row is a different person).
2. **Period / scope:** roster span may not match the payroll fortnight; payroll can include **leave, adjustments, on-call, or other lines** not in the scheduler CSV.
3. **No** parse-failed rows attributed to this staff name in the CSV error list (other staff may still have failed rows).

### Carol Brigil Francis

| Field | Value |
| --- | --- |
| Payroll (import) | $1012.74 |
| Gross (this report) | $1010.14 |
| Diff (Gross − Payroll) | **$-2.60** (-0.26% of gross) |
| Pay-hours total (excl. sleepover allowance hours in total) | 25 h |
| Implied $/h (Payroll ÷ pay-hours) | ~$40.51/h |
| Implied $/h (Gross ÷ pay-hours) | ~$40.41/h (from per-staff rates xlsx) |
| Staff rates row in xlsx? | **Yes** (normName match) |
| Weekday band mix (afternoon+night share of m+a+n) | 25% |

**Why Gross is below Payroll (most likely first)**

1. **Gross** used **`calcGrossFromRates`** from the staff-rates xlsx. Remaining gap vs payroll is usually **period/scope** (roster vs FN), **extra pay lines** in payroll, or **name spelling** (rates row is a different person).
2. **Period / scope:** roster span may not match the payroll fortnight; payroll can include **leave, adjustments, on-call, or other lines** not in the scheduler CSV.
3. **No** parse-failed rows attributed to this staff name in the CSV error list (other staff may still have failed rows).

### Helan John

| Field | Value |
| --- | --- |
| Payroll (import) | $1523.64 |
| Gross (this report) | $1521.04 |
| Diff (Gross − Payroll) | **$-2.60** (-0.17% of gross) |
| Pay-hours total (excl. sleepover allowance hours in total) | 43.25 h |
| Implied $/h (Payroll ÷ pay-hours) | ~$35.23/h |
| Implied $/h (Gross ÷ pay-hours) | ~$35.17/h (from per-staff rates xlsx) |
| Staff rates row in xlsx? | **Yes** (normName match) |
| Weekday band mix (afternoon+night share of m+a+n) | 15% |

**Why Gross is below Payroll (most likely first)**

1. **Gross** used **`calcGrossFromRates`** from the staff-rates xlsx. Remaining gap vs payroll is usually **period/scope** (roster vs FN), **extra pay lines** in payroll, or **name spelling** (rates row is a different person).
2. **Period / scope:** roster span may not match the payroll fortnight; payroll can include **leave, adjustments, on-call, or other lines** not in the scheduler CSV.
3. **No** parse-failed rows attributed to this staff name in the CSV error list (other staff may still have failed rows).
