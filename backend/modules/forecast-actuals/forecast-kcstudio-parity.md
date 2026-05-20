# Forecast / actuals: kcai vs KC Studio

## KC Studio source location

- **This workspace:** drop the Python tree under `tmp/kcstudio/` (see `tmp/kcstudio/PLACE_FORECAST_ACTUALS_SERVICE_HERE.txt`).
- **Audited (May 2026):** Python source at `tmp/kcstudio/kc_studio/app/forecast_actuals/services/forecast_actuals_service.py`. kcai matches columns, upload replace-all, summary formulas, variance tabs, and aggregation. Totals row uses sum of per-client variances (aligned with Python).

## kcai module map (for side-by-side review)

| Concern | kcai |
|--------|------|
| CSV column rules | `csvForecastActuals.js`: `REQUIRED_CSV_COLUMNS`, `COLUMN_ALIASES`, `normalizeColumnName`, `validateHeaders` |
| Row → document shape | `forecastActuals.service.js`: `processRowCommon` (used by forecast + actuals upload) |
| CSV parse options | `csv-parse/sync`: `columns: true`, `trim`, `bom`, `relax_column_count`, `skip_empty_lines` |
| Upload behavior | Replace-all per location: `ForecastRecord.deleteMany` / `ActualsRecord.deleteMany` then `insertMany` |
| Summary by client | `getSummary`: aggregate forecast `cost` by `clientDirectoryId`; actuals `cost` + `kms`; `buildSummaryRecord` |
| Summary math | `grossActuals = netActuals + mileage`; `variance = netActuals - forecastBudget`; `variancePct = (variance/forecastBudget)*100` if `forecastBudget > 0` |
| Client list for summary | From ShiftCare directory (`fetchAllClients`), filtered by `clientId`; one row per listed client even if zeros |
| Variance tab | `listVariance`: sets by `shiftcareId` — deleted (forecast only), additional (actuals only), variance (common id, cost/totalCost mismatch after aggregation) |
| Shift aggregation | `aggregateByShiftcareId`: min start, max end, sum duration/cost/totalCost, first description/rateGroups/referenceNo |
| Field-level diff (common shifts) | `computeDiffFields`: start/end time, duration, cost, totalCost, rateGroups, referenceNo |
| PDF | `summaryPdf.js` + `exportSummaryPdf` (declared mirror of KC Studio ReportLab layout) |

## Python checklist (when KC Studio is available)

Compare `forecast_actuals_service.py` (and any routes/templates) to the kcai column names, date/time parsers, money rounding, summary formulas, and variance/deleted/additional rules above. Note any intentional divergences (Mongo schema, API shape, PDF library).

## Golden tests

Automated fixtures live in `csvForecastActuals.test.js` and `forecastActuals.golden.test.js`. Extend with the same CSV run through Python when the reference implementation is available.
