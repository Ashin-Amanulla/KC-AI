# SCHADS Rules Implemented in Calculation

<!-- GENERATED FILE — do not edit by hand. -->
<!-- Source of truth: backend/modules/rule-engine/rulesCatalog.js -->
<!-- Regenerate with: cd backend && npm run docs:rules -->

Rule-by-rule inventory of SCHADS Award (MA000100) rules encoded in this codebase.  
**Sources:** `backend/modules/pay-hours/services/payHoursCalculator.js`, `backend/modules/shifts/shiftCsvParser.js`, `frontend/src/lib/schadsWageCalc.js`, `backend/modules/pay-hours/utils/ot76GlobalTier.js`.

Legend: ⚠️ needs verification against the award/pay guide · 🏳️ engine flags only (no pay effect) · 🚫 known award rule not implemented.

---

## Constants & thresholds

- **R001** — Weekday daytime band starts at **06:00** local (`MORNING_START = 6`).
- **R002** — Weekday evening band starts at **20:00** local (`AFTERNOON_START = 20`).
- **R003** — Time-band splits use **06:01** and **20:01** boundaries when splitting sleepover excess by band (`splitWeekdayByTimeBand`).
- **R004** — Daily ordinary cap before daily OT: **10 hours** active (`MAX_REGULAR_HOURS` / `MAX_REGULAR_HOURS_WEEKDAY`). _(MA000100 cl. 25.1)_
- **R005** — Daily OT tier 1 cap: first **2 hours** at 1.5× (`OT_TIER_1_MAX = 2`). _(MA000100 cl. 28.1)_
- **R006** — Fortnightly ordinary-hours cap before OT>76: **76 hours** (`TOTAL_HOURS_CAP = 76`). _(MA000100 cl. 25.1)_
- **R007** — Broken-shift span clock threshold: **> 12 hours** from span start (`BROKEN_SHIFT_SHORT_SPAN`). Hours worked after the mark at **2×**; overlap with daily OT upgrades to 2×. _(MA000100 cl. 25.6)_
- **R008** — Sleepover non-billable deduction: **8 hours** (`SLEEPOVER_DEDUCTION = 8`). _(MA000100 cl. 25.7)_
- **R009** — Standard minimum break between shifts (short-turnaround): **10 hours** (`MIN_BREAK_BETWEEN_SHIFTS_MS`). _(MA000100 cl. 25.4)_
- **R010** — Minimum break after sleepover-linked shift: **8 hours** (`MIN_BREAK_AFTER_SLEEPOVER_MS`).
- **R011** — Sleepover follow-on attach window for next PC/nursing shift: **8 hours** (`SLEEPOVER_FOLLOWON_GAP_MS`).
- **R012** — Contiguous-shift tolerance (rounding): **1 minute** (`GAP_CONTIGUOUS_TOLERANCE_MS`).
- **R013** — Broken-shift gap — Personal Care predecessor: **10 hours** (`BROKEN_SHIFT_GAP_PERSONAL_CARE_MS`).
- **R014** — Broken-shift gap — Sleepover predecessor: **8 hours** (`BROKEN_SHIFT_GAP_SLEEPOVER_MS`).
- **R015** — Broken-shift gap — Nursing Support predecessor: **10 hours** (`BROKEN_SHIFT_GAP_NURSING_SUPPORT_MS`).
- **R016** — Broken-shift allowance (1 break): **$20.82** default (`brokenShiftAllowance1`). Award formula: 1.7% of the standard rate, FWC-indexed each 1 July — served per financial year by the award-rates module. _(MA000100 cl. 20.11)_ ⚠️ *needs verification*
- **R017** — Broken-shift allowance (2 breaks): **$27.56** default (`brokenShiftAllowance2`). Award formula: 2.25% of the standard rate, FWC-indexed each 1 July. _(MA000100 cl. 20.11)_ ⚠️ *needs verification*
- **R018** — Meal allowance per qualifying event: **$16.62** default (`mealAllowance`), FWC-indexed. _(MA000100 cl. 20.3)_ ⚠️ *needs verification*
- **R019** — Default vehicle/km rate: **$0.99/km** (`vehicleKmRate`), FWC-indexed. _(MA000100 cl. 20.7)_ ⚠️ *needs verification*
- **R020** — Manual calculator daily ordinary: **7.6 h/day** (`dailyOrdHours`).
- **R021** — Manual calculator weekly ordinary: **38 h/week** (`weeklyOrdHours`). _(MA000100 cl. 25.1)_
- **R022** — OT multipliers: **1.5×** tier 1 (`otTier1Mult`), **2.0×** tier 2 (`otTier2Mult`). _(MA000100 cl. 28.1)_
- **R023** — OT>76 global shared 1.5× band: **2 hours** total across weekday + Saturday (`OT76_GLOBAL_TIER1_MAX`).

---

## Day type classification

- **R024** — Saturday (local weekday index 5) → `saturday` day type. _(MA000100 cl. 26)_
- **R025** — Sunday (local weekday index 6) → `sunday` day type. _(MA000100 cl. 26)_
- **R026** — Monday–Friday → `weekday` day type.
- **R027** — Date in configured `holidaySet` (YYYY-MM-DD local) → `holiday` day type. _(MA000100 cl. 27; NES)_
- **R028** — **Christmas Eve (24 Dec):** before 18:00 local → regular weekday/Sat/Sun classification. ⚠️ *needs verification*
- **R029** — **Christmas Eve (24 Dec):** at or after 18:00 local → `holiday` day type. Part-day public holiday — applies in QLD/SA/NT only; currently applied for all locations and must be keyed off the location state. ⚠️ *needs verification*
- **R030** — Christmas Eve 6pm split takes priority over midnight split when shift spans 18:00 on 24 Dec. ⚠️ *needs verification*
- **R031** — Cross-midnight shift ending at/before **00:01** local treated as same calendar day (no midnight split).

---

## Weekday time-band classification (whole shift)

- **R032** — Shift starting before **06:00** local → **night** band. _(MA000100 cl. 29 (shiftwork))_
- **R033** — Shift crossing midnight and ending after **00:00** (not exactly midnight) → **night** band.
- **R034** — Same-day shift ending after **20:00** local → **evening** band. _(MA000100 cl. 29 (shiftwork))_ ⚠️ *needs verification*
- **R035** — Same-day shift ending at or before **20:00** local → **daytime** band.
- **R036** — Shift ending exactly at **00:00** is treated as at/before midnight (not forced to night by the cross-midnight rule).
- **R037** — Weekday classification applies to the **whole qualifying shift** (not split at 6am/8pm) except sleepover excess. Verify against MA000100 whether the loading applies to the whole shift or only the post-8pm portion. ⚠️ *needs verification*

---

## Cross-midnight & special-day splits

- **R038** — Both days weekday, crosses midnight past 00:01 → entire shift classified as **weekday night** (no day split).
- **R039** — Crosses midnight with different day types → split at local midnight.
- **R040** — Pre-midnight portion of cross-midnight weekday shift → **night** band.
- **R041** — Post-midnight portion starting at 00:00 on weekday → **night** band (< 06:00).
- **R042** — Weekday → holiday cross-midnight: pre-midnight weekday → night; post-midnight → holiday.
- **R043** — Non-holiday cross-day: day-1 penalty day (Sat/Sun/PH) keeps its day type for pre-midnight hours.
- **R044** — Post-midnight day-2 weekday → night band.
- **R045** — Post-midnight day-2 Sat/Sun/PH → respective penalty day type, no time sub-band.

---

## Sleepover rules

- **R046** — Sleepover active (billable) hours = total shift hours minus **8** (`calculateActiveHours`). _(MA000100 cl. 25.7)_
- **R047** — Sleepover with ≤0 excess hours → allowance only (`sleepoversCount`); no payable hour segments.
- **R048** — Sleepover excess hours split at **06:01 / 20:01** bands on weekdays (`splitWeekdayByTimeBand`).
- **R049** — Sleepover excess on Sat/Sun/PH → single segment at that day type (no time sub-band).
- **R050** — Each sleepover shift increments `sleepoversCount` by 1.
- **R051** — Sleepover crossing midnight: 8h deduction applied across day-1/day-2 boundary (`splitSleepoverAtMidnight`).
- **R052** — Sleepover crossing Christmas Eve 6pm: deduction split across pre-6pm / post-6pm / post-midnight (`splitSleepoverAtChristmasEve6pm`). ⚠️ *needs verification*
- **R053** — PC shift touching sleepover (gap ≤ 1 min) → flagged **pre-sleepover** (`isPreSleepover`).
- **R054** — PC/nursing within **8h** after sleepover end → flagged **post-sleepover** (`isPostSleepover`).
- **R055** — Post-sleepover weekday PC is **NOT** forced to the night band: loadings before and after a sleepover are decoupled (SCHADS split-loading), so the shift keeps its own time-band classification.
- **R056** — Pre-sleepover weekday PC uses highest time band of whole shift (no 6am/8pm split). ⚠️ *needs verification*
- **R057** — Sleepover with no excess on weekday adds **night** placeholder for chain influence.
- **R058** — Continuous chains **snap at sleepover boundary** — pre/post sleepover loadings decoupled for OT/cap logic.
- **R059** — After sleepover-linked shift, short-turnaround threshold uses **8h** break requirement (not 10h).
- **R199** — Gap **> 0 and < 8h** before a sleepover → `preSleepoverInsufficientBreak` review flag on the preceding shift (I-07b). 🏳️ *flag only*

---

## Nursing support rules

- **R060** — Nursing shifts split at midnight for Sat/Sun/PH penalty rates.
- **R061** — Weekday nursing hours accumulate in `nursingCareHours` (paid at nursing daytime rate).
- **R062** — Saturday nursing → `nursingSaturdayHours` + `saturdayHours` ledger.
- **R063** — Sunday nursing → `nursingSundayHours` + `sundayHours` ledger.
- **R064** — Public holiday nursing → `nursingHolidayHours` + `holidayHours` ledger.
- **R065** — Nursing evening/night on weekday tracked separately: `nursingAfternoonHours`, `nursingNightHours`.
- **R066** — Broken-shift spans use **per-period** time bands — nursing weekday segments keep their own band (retro loading removed).
- **R067** — Short-turnaround reclassification removes weekday nursing from `nursingCareHours` ledger.

---

## Broken shift — detection (import)

- **R068** — Broken shifts detected per staff, chronological order (`detectBrokenShifts`).
- **R069** — **BR-BS-001:** Current shift broken if previous was **Personal Care** and **0 < gap < 10h**. _(MA000100 cl. 25.6)_
- **R070** — **BR-BS-002:** Current shift broken if previous was **Sleepover** and **0 < gap < 8h**.
- **R071** — **BR-BS-003:** Current shift broken if previous was **Nursing Support** and **0 < gap < 10h**.
- **R072** — Gap exactly at threshold (10h or 8h) → **not** broken (adequate rest). Regression-guarded: a June 2026 change to `<=` wrongly flagged exactly-10h gaps; fixed 15 Jun 2026.
- **R073** — Gap ≤ 0 (touching/overlapping) → **not** broken via gap rule.
- **R074** — Broken only if same local start day **or** previous shift end date equals current shift start date.
- **R075** — Sets `isBrokenShift: true` on shift record for calculator.

---

## Broken shift — span collection (calculation)

- **R076** — Walks backward through processed shifts to build broken-shift span (`collectBrokenShiftSpanPrevious`).
- **R077** — Overlapping shifts (gap ≤ 0): chain if same local start day; stop at sleepover.
- **R078** — Gap below threshold: include if same start day **or** previous end date equals current start date.
- **R079** — Gap threshold per predecessor shift type matches import rules (10h PC/nursing, 8h sleepover).

---

## Broken shift — allowances & OT

- **R080** — Broken allowance tier based on **unpaid gap count** in span, not shift count. _(MA000100 cl. 20.11)_
- **R081** — **1 unpaid break** in span → `brokenShiftCount` += 1 ($20.82 or staff rate). _(MA000100 cl. 20.11)_
- **R082** — **2+ unpaid breaks** in span → decrement one `brokenShiftCount`, `brokenShift2BreakCount` += 1 ($27.56). _(MA000100 cl. 20.11)_
- **R083** — Minimum allowance tier is 1 break when broken.
- **R084** — Short-turnaround reclassified shift **excludes** broken-shift OT stacking on same hours.
- **R085** — Combined span active **> 10h**: standard daily OT tiering — first **2h at 1.5×**, remainder **2×** (`processBrokenShiftOvertime`).
- **R086** — Span clock **> 12h**: worked hours after span-start+12h reclassified to **2×** (tier 2 OT).
- **R087** — Span clock exactly **12h** → no span-DT penalty; daily OT only if active > 10h.
- **R088** — Broken-shift span OT: +1 meal if total span OT **> 1h**; +1 more if **> 4h** (delta-applied per span memo).
- **R089** — Each broken-shift **work period** keeps its own time band from `getTimeCategory` — spans are **not** retro-loaded to the final band.
- **R090** — Cross-midnight broken periods split at midnight; each portion keeps its band (no span-wide retro night loading).
- **R091** — Nursing broken-shift periods follow the same per-period banding — no retro move to `nursingAfternoonHours` / `nursingNightHours`.

---

## Short turnaround (inadequate rest, non-broken)

- **R092** — Applies when gap **> 0** and **< required break** and shift is **not** `isBrokenShift`. _(MA000100 cl. 25.4)_
- **R093** — Default required break: **10h** between shifts. _(MA000100 cl. 25.4)_
- **R094** — After sleepover-linked shift: required break **8h**.
- **R095** — Short turnaround: all active hours → `shortTurnaroundHours` (paid at **2×** / double time). _(MA000100 cl. 25.4)_
- **R096** — Short turnaround adds shift to `reclassifiedFullDoubleTimeShiftIds` (excluded from ordinary chain OT).
- **R097** — Short turnaround suppresses broken-shift OT on same shift.

---

## Continuous shift chains (gap = 0)

- **R098** — Back-to-back shifts (0 gap), neither sleepover → treated as **continuous chain**.
- **R099** — Continuous PC chain ending after midnight or after 20:00 → retroactive evening/night loading on earlier weekday segments.
- **R100** — Continuous chain daily OT: combined **active hours** across chain vs 10h cap.
- **R101** — Chain originating as **night** on weekday: first 10h locked to **night** band before OT extraction.
- **R102** — OT beyond cap deducted from **end** of chain entries (`deductOtFromEnd`).
- **R103** — Daily OT tiered: first **2h** at 1.5×, remainder at 2× (`applyOtByDayType`).
- **R104** — Continuous chain meal allowance: +1 if chain OT **> 1h**; +1 more if **> 4h**.
- **R105** — Post-sleepover ordinary hours **not** combined with pre-sleepover chain for daily-cap OT.
- **R106** — Broken shifts in chain disable continuous-chain OT logic (broken rules apply instead).

---

## Per-shift daily OT (non-chain / segment level)

- **R107** — `processOvertime`: active hours **> 10h** on a segment/day type triggers daily OT. _(MA000100 cl. 28.1)_
- **R108** — OT tier 1: min(OT hours, 2) at 1.5×. _(MA000100 cl. 28.1)_
- **R109** — OT tier 2: remainder at 2×. _(MA000100 cl. 28.1)_
- **R110** — Applied per day type: weekday, Saturday, Sunday, holiday buckets.

---

## Fortnightly 76-hour cap

- **R111** — Total ordinary hours = morning + afternoon + night + Sat + Sun + PH + nursing care + nursing afternoon + nursing night.
- **R112** — If total ordinary **> 76h**, excess → `otAfter76Hours`. _(MA000100 cl. 28.1(b))_
- **R113** — Excess deducted from **latest** ledger entries first (date descending).
- **R114** — Deducted hours tracked by day type: `otAfter76Weekday`, `otAfter76Saturday`, `otAfter76Sunday`, `otAfter76Holiday`.
- **R115** — Nursing Sat/Sun/PH deductions also reduce `nursingSaturdayHours` / `nursingSundayHours` / `nursingHolidayHours`.
- **R116** — Nursing weekday evening/night deductions reduce `nursingAfternoonHours` / `nursingNightHours`.
- **R117** — Per-shift OT>76 attribution stored in shift breakdowns.

---

## OT>76 pay tier allocation

- **R118** — Weekday + Saturday OT>76 share **one** global 1.5× band of **2 hours** total.
- **R119** — Weekday OT>76 consumes the 1.5× band **first**.
- **R120** — Remaining weekday OT>76 after band → 2× (`otAfter76WeekdayAfter2`).
- **R121** — Saturday OT>76 gets 1.5× only if band capacity remains (`otAfter76SaturdayUpto2`).
- **R122** — Remaining Saturday OT>76 → 2× at Saturday OT-after-2 rate (`satOtAfter2`).
- **R123** — Sunday OT>76 → paid at **Sunday** rate (2.0×) — no separate OT bracket. _(MA000100 cl. 28.1(d))_
- **R124** — Public holiday OT>76 → paid at **PH** rate (2.5×) — no separate OT bracket. _(MA000100 cl. 28.1(e))_

---

## Minimum engagement (exception flags)

- **R125** — Personal care shift **> 0h and < 2h** → `minimumEngagementException` flag. _(MA000100 cl. 10.5 / 11.6)_ 🏳️ *flag only*
- **R126** — Consecutive PC shifts with **zero gap** link into one engagement for 2h review. 🏳️ *flag only*
- **R127** — Any unpaid break starts new engagement assessment. 🏳️ *flag only*
- **R128** — Linked PC chain summing **≥ 2h** clears minimum-engagement exception on all PC shifts in chain. 🏳️ *flag only*
- **R129** — Sleepover-adjacent PC: per-segment 2h minimum does not apply (flag cleared). 🏳️ *flag only*
- **R130** — PC **< 4h** adjacent to sleepover → `minimum4hEngagementReview` flag. 🏳️ *flag only*
- **R131** — Flanked PC–sleepover–PC: **4h minimum** assessed per side. If **either** side reaches 4h, the other side has no minimum and is not flagged; only sides under 4h are flagged when neither side reaches 4h. 🏳️ *flag only*
- **R132** — Minimum engagement flags are for admin review; hours are **not** auto-topped-up — adjust manually in payroll. _(MA000100 cl. 10.5 / 11.6)_ 🏳️ *flag only*

---

## Hours normalization & data quality

- **R133** — Shift hours derived from timestamps when CSV `hours` missing, ≤ 0, or mismatches timestamps by **> 0.05h**.
- **R134** — Negative CSV hours ignored when timestamps yield positive duration.
- **R135** — All hour totals rounded to **2 decimal places** (`r2`).

---

## Wage calculation — rate card (calcGrossFromRates)

- **R136** — Base rate categories: daytime, afternoon, night, Saturday, Sunday, PH.
- **R137** — OT rate categories: `otUpto2` (1.5× tier), `otAfter2` (2× tier), `satOtAfter2` (Saturday 2× tier).
- **R138** — Nursing rate categories: nursingDaytime, nursingAfternoon, nursingNight, nursingSaturday, nursingSunday, nursingPh.
- **R139** — Imported rate sheet values **below** daytime treated as **loading deltas** added to base (additive normalization).
- **R140** — Nursing rates default to daytime × nursing factor when not explicitly set.
- **R141** — Weekday evening/night pay splits base PC vs nursing hours (no double-count).
- **R142** — Sunday/PH ordinary hours include same-day OT buckets in penalty pay (`sunAll`, `holAll`).
- **R143** — Short turnaround hours paid at `otAfter2` rate (double time).
- **R144** — Broken shift: `brokenShiftCount` × rate (default $20.82) + `brokenShift2BreakCount` × $27.56.
- **R145** — Sleepover allowance: `sleepoversCount` × (sleepover + sleepoverExtra). Default sleepover rate $90; award formula is 4.9% of the standard rate per night. _(MA000100 cl. 25.7)_ ⚠️ *needs verification*
- **R146** — Meal allowance: `mealAllowanceCount` × staff meal rate (default $16.62).
- **R147** — Mileage: `totalKm` × km rate (default $0.99).
- **R148** — Flat per-fortnight `allowance` field added to gross.

---

## Wage calculation — multiplier fallback (calcGross)

- **R149** — **Casual** effective rate: `rate × (mult / 1.25 + 0.2)` (`casualEff`) — reproduces client M-01..M-08 test cases. _(MA000100 cl. 10.4)_
- **R150** — **Permanent** penalty loadings on base rate directly.
- **R151** — Weekday daytime: **1.0×**.
- **R152** — Weekday evening: **1.125×**. _(MA000100 cl. 29)_
- **R153** — Weekday night: **1.15×**. _(MA000100 cl. 29)_
- **R154** — Weekday daily OT ≤2h: **1.5×**. _(MA000100 cl. 28.1)_
- **R155** — Weekday daily OT >2h: **2.0×**. _(MA000100 cl. 28.1)_
- **R156** — Saturday: **1.5×**; Sat OT ≤2h: **1.5×**; Sat OT >2h: **2.0×**. _(MA000100 cl. 26 / 28.1)_
- **R157** — Sunday (incl. same-day OT): **2.0×**. _(MA000100 cl. 26 / 28.1(d))_
- **R158** — Public holiday (incl. OT): **2.5×**. _(MA000100 cl. 27 / 28.1(e))_
- **R159** — Nursing care (weekday): **1.0×**.
- **R160** — Short turnaround: **2.0×**.
- **R161** — OT>76 tiers use same multipliers as daily OT by day type.
- **R162** — Allowances added via `calcAllowances` (broken + meal + mileage).

---

## Pay breakdown line items (calcBreakdownFromRates)

- **R163** — Daytime (≤8pm) — ordinary.
- **R164** — Evening (>8pm) — penalty.
- **R165** — Nursing Evening — penalty at nursing afternoon rate.
- **R166** — Night — penalty.
- **R167** — Nursing Night — penalty at nursing night rate.
- **R168** — WD OT ≤2h — overtime.
- **R169** — WD OT >2h — overtime.
- **R170** — Saturday — penalty.
- **R171** — Nursing Saturday — penalty.
- **R172** — Sat OT ≤2h — overtime.
- **R173** — Sat OT >2h — overtime.
- **R174** — Sunday (incl. OT) — penalty.
- **R175** — Nursing Sunday — penalty.
- **R176** — Public Holiday (incl. OT) — penalty.
- **R177** — Nursing Holiday — penalty.
- **R178** — Nursing Care — ordinary.
- **R179** — Double Time (No Break) — short turnaround at 2× rate.
- **R180** — OT >76h WD ≤2h — ot76 tier.
- **R181** — OT >76h WD >2h — ot76 tier.
- **R182** — OT >76h Sat ≤2h — ot76 tier.
- **R183** — OT >76h Sat >2h — ot76 tier.
- **R184** — OT >76h Sun — ot76 at Sunday rate.
- **R185** — OT >76h PH — ot76 at PH rate.
- **R186** — Penalty lines split into base pay + penalty loading for display.
- **R187** — Allowance block: broken (1-break), broken (2-break), meal, sleepover, mileage, other.

---

## Total hours aggregation

- **R188** — `staffTotalHours` sums all payable hour buckets including OT>76 reclassified hours.
- **R189** — `shiftRowPayableHours` same logic per shift row.
- **R190** — `totalOtHrs` sums daily OT buckets only (not OT>76).
- **R191** — Sleepovers, broken allowances, meal/mileage are **not** included in hour totals.

---

## Timezone handling

- **R192** — All day-type and time-band logic uses shift `timezoneOffset` (e.g. `+10:00`).
- **R193** — Local date strings (YYYY-MM-DD) drive holiday and broken-shift same-day tests.
- **R194** — Default offset when missing: **+10:00** (Brisbane).

---

## Not implemented / out of scope in calculator

- **R195** — `computeSleepovernAttachedNight` currently returns **all false** — sleepover-attached night override via that export is disabled. 🚫 *not implemented*
- **R196** — Minimum engagement (2h / 4h sleepover-adjacent) is **flagged** only; admin manually adjusts pay. _(MA000100 cl. 10.5 / 11.6)_ 🏳️ *flag only*
- **R197** — Manual week-mode calculator in `SchadsCalculator.jsx` uses separate 7.6h daily / 38h weekly ordinary logic (not shift-import path). 🚫 *not implemented*
- **R198** — Superannuation, tax, and net pay are outside `calcGross` (handled separately in cost analysis). 🚫 *not implemented*

---

*Generated from `rulesCatalog.js`. Verify ⚠️ items against [Fair Work SCHADS Award MA000100](https://www.fairwork.gov.au) and the current pay guide; indexed dollar amounts are served per financial year by the award-rates module.*
