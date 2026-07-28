# SCHADS calculator — MA000100

Standalone Rust calculator accepting JSON shift data and a supplied applicable base hourly rate.

```bash
cargo run --manifest-path schads-calculator/Cargo.toml -- schads-calculator/example.json
cargo test --manifest-path schads-calculator/Cargo.toml
```

## Implemented pipeline

`calculate_pay()` calls, in order:

- `validate_input`
- `build_timeline`
- `apply_minimum_engagement`
- `apply_ordinary_hours`
- `apply_evening_penalties`
- `apply_saturday`
- `apply_sunday`
- `apply_public_holiday`
- `apply_overtime`
- `apply_broken_shift`
- `apply_sleepover`
- `apply_allowances`
- `apply_casual_loading`
- `apply_rounding`
- `generate_audit_log`

## Award source and scope

Rules were checked from the Fair Work Commission consolidated *Social, Community, Home Care and Disability Services Industry Award 2010* (`MA000100`) retrieved on 28 July 2026. Its displayed latest variations include PR799380, operative 1 July 2026. Implemented source clauses include 10.4–10.5 (casual loading/minimum engagement), 20.12 (broken-shift allowances), 25.6–25.7 (broken shifts/sleepovers), 26 (weekend work), 28 (overtime), and 34 (public holidays).

This is deliberately **not** a complete payroll engine. It expects the caller to provide the correct classification/date-specific base rate and public-holiday calendar. Do not use it to determine statutory pay without payroll/legal review. In particular, it currently does not split a single shift across day boundaries or partially apply rates within a shift; submit those as separate shift segments. It also does not calculate every classification-specific allowance, meal-break rule, TOIL, remote work, 24-hour care, leave, or state/territory public-holiday observance.

## JSON

See `example.json`. Dates/times are local award times without timezone offsets. Monetary fields are decimal strings to avoid floating point errors.

`allowances` accepts already-calculated dollar allowances such as travel; each is preserved in the audit log.
