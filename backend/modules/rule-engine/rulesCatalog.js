/**
 * SCHADS rules catalog — the single source of truth for every award rule
 * encoded in the pay engine.
 *
 * docs/schads-rules-implemented.md is GENERATED from this file
 * (`npm run docs:rules` in backend/); rulesCatalog.test.js fails if the
 * committed doc drifts from this catalog. Edit rules HERE, never in the doc.
 *
 * Statuses:
 *  - implemented:        encoded in the engine and believed award-correct
 *  - needs-verification: encoded, but must be confirmed against MA000100 /
 *                        the current FWC pay guide before being relied on
 *  - flagged:            engine only flags the condition for review; no pay effect
 *  - not-implemented:    known award rule that the engine intentionally omits
 *
 * Tests reference rules by tagging test names with [Rxxx]; the rule-engine
 * monitor joins catalog <-> test results at runtime via those tags.
 */

export const RULE_CATEGORIES = [
  { slug: 'constants', title: 'Constants & thresholds' },
  { slug: 'day-type', title: 'Day type classification' },
  { slug: 'weekday-bands', title: 'Weekday time-band classification (whole shift)' },
  { slug: 'cross-midnight', title: 'Cross-midnight & special-day splits' },
  { slug: 'sleepover', title: 'Sleepover rules' },
  { slug: 'nursing', title: 'Nursing support rules' },
  { slug: 'broken-detection', title: 'Broken shift — detection (import)' },
  { slug: 'broken-span', title: 'Broken shift — span collection (calculation)' },
  { slug: 'broken-allowances-ot', title: 'Broken shift — allowances & OT' },
  { slug: 'short-turnaround', title: 'Short turnaround (inadequate rest, non-broken)' },
  { slug: 'continuous-chains', title: 'Continuous shift chains (gap = 0)' },
  { slug: 'daily-ot', title: 'Per-shift daily OT (non-chain / segment level)' },
  { slug: 'fortnight-cap', title: 'Fortnightly 76-hour cap' },
  { slug: 'ot76-tiers', title: 'OT>76 pay tier allocation' },
  { slug: 'minimum-engagement', title: 'Minimum engagement (exception flags)' },
  { slug: 'normalization', title: 'Hours normalization & data quality' },
  { slug: 'rate-card', title: 'Wage calculation — rate card (calcGrossFromRates)' },
  { slug: 'multiplier-fallback', title: 'Wage calculation — multiplier fallback (calcGross)' },
  { slug: 'breakdown-lines', title: 'Pay breakdown line items (calcBreakdownFromRates)' },
  { slug: 'aggregation', title: 'Total hours aggregation' },
  { slug: 'timezone', title: 'Timezone handling' },
  { slug: 'out-of-scope', title: 'Not implemented / out of scope in calculator' },
];

const r = (num, category, title, description, extra = {}) => ({
  id: `R${String(num).padStart(3, '0')}`,
  category,
  title,
  description,
  awardRef: extra.awardRef ?? null,
  constants: extra.constants ?? [],
  status: extra.status ?? 'implemented',
  verification: extra.verification ?? null,
});

export const RULES_CATALOG = [
  // ── Constants & thresholds ──────────────────────────────────────────────
  r(1, 'constants', 'Daytime band start', 'Weekday daytime band starts at **06:00** local (`MORNING_START = 6`).', { constants: ['MORNING_START'] }),
  r(2, 'constants', 'Evening band start', 'Weekday evening band starts at **20:00** local (`AFTERNOON_START = 20`).', { constants: ['AFTERNOON_START'] }),
  r(3, 'constants', 'Band-split boundaries', 'Time-band splits use **06:01** and **20:01** boundaries when splitting sleepover excess by band (`splitWeekdayByTimeBand`).'),
  r(4, 'constants', 'Daily ordinary cap', 'Daily ordinary cap before daily OT: **10 hours** active (`MAX_REGULAR_HOURS` / `MAX_REGULAR_HOURS_WEEKDAY`).', { constants: ['MAX_REGULAR_HOURS'], awardRef: 'MA000100 cl. 25.1' }),
  r(5, 'constants', 'Daily OT tier 1 cap', 'Daily OT tier 1 cap: first **2 hours** at 1.5× (`OT_TIER_1_MAX = 2`).', { constants: ['OT_TIER_1_MAX'], awardRef: 'MA000100 cl. 28.1' }),
  r(6, 'constants', 'Fortnightly ordinary cap', 'Fortnightly ordinary-hours cap before OT>76: **76 hours** (`TOTAL_HOURS_CAP = 76`).', { constants: ['TOTAL_HOURS_CAP'], awardRef: 'MA000100 cl. 25.1' }),
  r(7, 'constants', 'Broken-shift short span threshold', 'Broken-shift short span threshold: **12 hours** (`BROKEN_SHIFT_SHORT_SPAN`).', { constants: ['BROKEN_SHIFT_SHORT_SPAN'], awardRef: 'MA000100 cl. 25.6', status: 'needs-verification' }),
  r(8, 'constants', 'Sleepover deduction', 'Sleepover non-billable deduction: **8 hours** (`SLEEPOVER_DEDUCTION = 8`).', { constants: ['SLEEPOVER_DEDUCTION'], awardRef: 'MA000100 cl. 25.7' }),
  r(9, 'constants', 'Minimum break between shifts', 'Standard minimum break between shifts (short-turnaround): **10 hours** (`MIN_BREAK_BETWEEN_SHIFTS_MS`).', { constants: ['MIN_BREAK_BETWEEN_SHIFTS_MS'], awardRef: 'MA000100 cl. 25.4' }),
  r(10, 'constants', 'Minimum break after sleepover', 'Minimum break after sleepover-linked shift: **8 hours** (`MIN_BREAK_AFTER_SLEEPOVER_MS`).', { constants: ['MIN_BREAK_AFTER_SLEEPOVER_MS'] }),
  r(11, 'constants', 'Sleepover follow-on window', 'Sleepover follow-on attach window for next PC/nursing shift: **8 hours** (`SLEEPOVER_FOLLOWON_GAP_MS`).', { constants: ['SLEEPOVER_FOLLOWON_GAP_MS'] }),
  r(12, 'constants', 'Contiguous tolerance', 'Contiguous-shift tolerance (rounding): **1 minute** (`GAP_CONTIGUOUS_TOLERANCE_MS`).', { constants: ['GAP_CONTIGUOUS_TOLERANCE_MS'] }),
  r(13, 'constants', 'Broken gap — PC', 'Broken-shift gap — Personal Care predecessor: **10 hours** (`BROKEN_SHIFT_GAP_PERSONAL_CARE_MS`).', { constants: ['BROKEN_SHIFT_GAP_PERSONAL_CARE_MS'] }),
  r(14, 'constants', 'Broken gap — sleepover', 'Broken-shift gap — Sleepover predecessor: **8 hours** (`BROKEN_SHIFT_GAP_SLEEPOVER_MS`).', { constants: ['BROKEN_SHIFT_GAP_SLEEPOVER_MS'] }),
  r(15, 'constants', 'Broken gap — nursing', 'Broken-shift gap — Nursing Support predecessor: **10 hours** (`BROKEN_SHIFT_GAP_NURSING_SUPPORT_MS`).', { constants: ['BROKEN_SHIFT_GAP_NURSING_SUPPORT_MS'] }),
  r(16, 'constants', 'Broken allowance (1 break)', 'Broken-shift allowance (1 break): **$20.82** default (`brokenShiftAllowance1`). Award formula: 1.7% of the standard rate, FWC-indexed each 1 July — served per financial year by the award-rates module.', { constants: ['brokenShiftAllowance1'], awardRef: 'MA000100 cl. 20.11', status: 'needs-verification' }),
  r(17, 'constants', 'Broken allowance (2 breaks)', 'Broken-shift allowance (2 breaks): **$27.56** default (`brokenShiftAllowance2`). Award formula: 2.25% of the standard rate, FWC-indexed each 1 July.', { constants: ['brokenShiftAllowance2'], awardRef: 'MA000100 cl. 20.11', status: 'needs-verification' }),
  r(18, 'constants', 'Meal allowance', 'Meal allowance per qualifying event: **$16.62** default (`mealAllowance`), FWC-indexed.', { constants: ['mealAllowance'], awardRef: 'MA000100 cl. 20.3', status: 'needs-verification' }),
  r(19, 'constants', 'Vehicle rate', 'Default vehicle/km rate: **$0.99/km** (`vehicleKmRate`), FWC-indexed.', { constants: ['vehicleKmRate'], awardRef: 'MA000100 cl. 20.7', status: 'needs-verification' }),
  r(20, 'constants', 'Manual calculator daily ordinary', 'Manual calculator daily ordinary: **7.6 h/day** (`dailyOrdHours`).', { constants: ['dailyOrdHours'] }),
  r(21, 'constants', 'Manual calculator weekly ordinary', 'Manual calculator weekly ordinary: **38 h/week** (`weeklyOrdHours`).', { constants: ['weeklyOrdHours'], awardRef: 'MA000100 cl. 25.1' }),
  r(22, 'constants', 'OT multipliers', 'OT multipliers: **1.5×** tier 1 (`otTier1Mult`), **2.0×** tier 2 (`otTier2Mult`).', { constants: ['otTier1Mult', 'otTier2Mult'], awardRef: 'MA000100 cl. 28.1' }),
  r(23, 'constants', 'OT>76 global 1.5× band', 'OT>76 global shared 1.5× band: **2 hours** total across weekday + Saturday (`OT76_GLOBAL_TIER1_MAX`).', { constants: ['OT76_GLOBAL_TIER1_MAX'] }),

  // ── Day type classification ─────────────────────────────────────────────
  r(24, 'day-type', 'Saturday', 'Saturday (local weekday index 5) → `saturday` day type.', { awardRef: 'MA000100 cl. 26' }),
  r(25, 'day-type', 'Sunday', 'Sunday (local weekday index 6) → `sunday` day type.', { awardRef: 'MA000100 cl. 26' }),
  r(26, 'day-type', 'Weekday', 'Monday–Friday → `weekday` day type.'),
  r(27, 'day-type', 'Public holiday set', 'Date in configured `holidaySet` (YYYY-MM-DD local) → `holiday` day type.', { awardRef: 'MA000100 cl. 27; NES' }),
  r(28, 'day-type', 'Christmas Eve before 6pm', '**Christmas Eve (24 Dec):** before 18:00 local → regular weekday/Sat/Sun classification.', { status: 'needs-verification' }),
  r(29, 'day-type', 'Christmas Eve after 6pm', '**Christmas Eve (24 Dec):** at or after 18:00 local → `holiday` day type. Part-day public holiday — applies in QLD/SA/NT only; currently applied for all locations and must be keyed off the location state.', { status: 'needs-verification' }),
  r(30, 'day-type', 'Christmas Eve split priority', 'Christmas Eve 6pm split takes priority over midnight split when shift spans 18:00 on 24 Dec.', { status: 'needs-verification' }),
  r(31, 'day-type', 'Midnight-tolerance same day', 'Cross-midnight shift ending at/before **00:01** local treated as same calendar day (no midnight split).'),

  // ── Weekday time bands ──────────────────────────────────────────────────
  r(32, 'weekday-bands', 'Pre-6am start → night', 'Shift starting before **06:00** local → **night** band.', { awardRef: 'MA000100 cl. 29 (shiftwork)' }),
  r(33, 'weekday-bands', 'Cross-midnight → night', 'Shift crossing midnight and ending after **00:00** (not exactly midnight) → **night** band.'),
  r(34, 'weekday-bands', 'Ends after 8pm → evening', 'Same-day shift ending after **20:00** local → **evening** band.', { awardRef: 'MA000100 cl. 29 (shiftwork)', status: 'needs-verification' }),
  r(35, 'weekday-bands', 'Ends by 8pm → daytime', 'Same-day shift ending at or before **20:00** local → **daytime** band.'),
  r(36, 'weekday-bands', 'Exact-midnight end', 'Shift ending exactly at **00:00** is treated as at/before midnight (not forced to night by the cross-midnight rule).'),
  r(37, 'weekday-bands', 'Whole-shift banding', 'Weekday classification applies to the **whole qualifying shift** (not split at 6am/8pm) except sleepover excess. Verify against MA000100 whether the loading applies to the whole shift or only the post-8pm portion.', { status: 'needs-verification' }),

  // ── Cross-midnight & special-day splits ─────────────────────────────────
  r(38, 'cross-midnight', 'Weekday→weekday overnight', 'Both days weekday, crosses midnight past 00:01 → entire shift classified as **weekday night** (no day split).'),
  r(39, 'cross-midnight', 'Different day types split', 'Crosses midnight with different day types → split at local midnight.'),
  r(40, 'cross-midnight', 'Pre-midnight → night', 'Pre-midnight portion of cross-midnight weekday shift → **night** band.'),
  r(41, 'cross-midnight', 'Post-midnight weekday → night', 'Post-midnight portion starting at 00:00 on weekday → **night** band (< 06:00).'),
  r(42, 'cross-midnight', 'Weekday→holiday split', 'Weekday → holiday cross-midnight: pre-midnight weekday → night; post-midnight → holiday.'),
  r(43, 'cross-midnight', 'Penalty day keeps type pre-midnight', 'Non-holiday cross-day: day-1 penalty day (Sat/Sun/PH) keeps its day type for pre-midnight hours.'),
  r(44, 'cross-midnight', 'Day-2 weekday → night', 'Post-midnight day-2 weekday → night band.'),
  r(45, 'cross-midnight', 'Day-2 penalty day type', 'Post-midnight day-2 Sat/Sun/PH → respective penalty day type, no time sub-band.'),

  // ── Sleepover ───────────────────────────────────────────────────────────
  r(46, 'sleepover', 'Active hours = total − 8', 'Sleepover active (billable) hours = total shift hours minus **8** (`calculateActiveHours`).', { awardRef: 'MA000100 cl. 25.7' }),
  r(47, 'sleepover', 'No-excess sleepover', 'Sleepover with ≤0 excess hours → allowance only (`sleepoversCount`); no payable hour segments.'),
  r(48, 'sleepover', 'Excess split by band', 'Sleepover excess hours split at **06:01 / 20:01** bands on weekdays (`splitWeekdayByTimeBand`).'),
  r(49, 'sleepover', 'Excess on penalty days', 'Sleepover excess on Sat/Sun/PH → single segment at that day type (no time sub-band).'),
  r(50, 'sleepover', 'Sleepover count', 'Each sleepover shift increments `sleepoversCount` by 1.'),
  r(51, 'sleepover', 'Cross-midnight deduction', 'Sleepover crossing midnight: 8h deduction applied across day-1/day-2 boundary (`splitSleepoverAtMidnight`).'),
  r(52, 'sleepover', 'Christmas Eve deduction split', 'Sleepover crossing Christmas Eve 6pm: deduction split across pre-6pm / post-6pm / post-midnight (`splitSleepoverAtChristmasEve6pm`).', { status: 'needs-verification' }),
  r(53, 'sleepover', 'Pre-sleepover flag', 'PC shift touching sleepover (gap ≤ 1 min) → flagged **pre-sleepover** (`isPreSleepover`).'),
  r(54, 'sleepover', 'Post-sleepover flag', 'PC/nursing within **8h** after sleepover end → flagged **post-sleepover** (`isPostSleepover`).'),
  r(55, 'sleepover', 'Post-sleepover banding (split-loading)', 'Post-sleepover weekday PC is **NOT** forced to the night band: loadings before and after a sleepover are decoupled (SCHADS split-loading), so the shift keeps its own time-band classification.'),
  r(56, 'sleepover', 'Pre-sleepover banding', 'Pre-sleepover weekday PC uses highest time band of whole shift (no 6am/8pm split).', { status: 'needs-verification' }),
  r(57, 'sleepover', 'Night placeholder', 'Sleepover with no excess on weekday adds **night** placeholder for chain influence.'),
  r(58, 'sleepover', 'Chains snap at sleepover', 'Continuous chains **snap at sleepover boundary** — pre/post sleepover loadings decoupled for OT/cap logic.'),
  r(59, 'sleepover', '8h turnaround after sleepover', 'After sleepover-linked shift, short-turnaround threshold uses **8h** break requirement (not 10h).'),

  // ── Nursing support ─────────────────────────────────────────────────────
  r(60, 'nursing', 'Nursing midnight split', 'Nursing shifts split at midnight for Sat/Sun/PH penalty rates.'),
  r(61, 'nursing', 'Weekday nursing ledger', 'Weekday nursing hours accumulate in `nursingCareHours` (paid at nursing daytime rate).'),
  r(62, 'nursing', 'Saturday nursing', 'Saturday nursing → `nursingSaturdayHours` + `saturdayHours` ledger.'),
  r(63, 'nursing', 'Sunday nursing', 'Sunday nursing → `nursingSundayHours` + `sundayHours` ledger.'),
  r(64, 'nursing', 'PH nursing', 'Public holiday nursing → `nursingHolidayHours` + `holidayHours` ledger.'),
  r(65, 'nursing', 'Nursing evening/night ledger', 'Nursing evening/night on weekday tracked separately: `nursingAfternoonHours`, `nursingNightHours`.'),
  r(66, 'nursing', 'Broken retro loading (nursing)', 'Broken-shift retroactive loading moves weekday nursing from `nursingCareHours` to evening/night nursing fields when applicable.'),
  r(67, 'nursing', 'Short-turnaround removes nursing ledger', 'Short-turnaround reclassification removes weekday nursing from `nursingCareHours` ledger.'),

  // ── Broken shift — detection (import) ───────────────────────────────────
  r(68, 'broken-detection', 'Per-staff chronological detection', 'Broken shifts detected per staff, chronological order (`detectBrokenShifts`).'),
  r(69, 'broken-detection', 'BR-BS-001 PC gap', '**BR-BS-001:** Current shift broken if previous was **Personal Care** and **0 < gap < 10h**.', { awardRef: 'MA000100 cl. 25.6' }),
  r(70, 'broken-detection', 'BR-BS-002 sleepover gap', '**BR-BS-002:** Current shift broken if previous was **Sleepover** and **0 < gap < 8h**.'),
  r(71, 'broken-detection', 'BR-BS-003 nursing gap', '**BR-BS-003:** Current shift broken if previous was **Nursing Support** and **0 < gap < 10h**.'),
  r(72, 'broken-detection', 'Exact threshold not broken', 'Gap exactly at threshold (10h or 8h) → **not** broken (adequate rest). Regression-guarded: a June 2026 change to `<=` wrongly flagged exactly-10h gaps; fixed 15 Jun 2026.'),
  r(73, 'broken-detection', 'Touching not broken', 'Gap ≤ 0 (touching/overlapping) → **not** broken via gap rule.'),
  r(74, 'broken-detection', 'Same-local-day requirement', 'Broken only if same local start day **or** previous shift end date equals current shift start date.'),
  r(75, 'broken-detection', 'isBrokenShift flag', 'Sets `isBrokenShift: true` on shift record for calculator.'),

  // ── Broken shift — span collection ──────────────────────────────────────
  r(76, 'broken-span', 'Backward span walk', 'Walks backward through processed shifts to build broken-shift span (`collectBrokenShiftSpanPrevious`).'),
  r(77, 'broken-span', 'Overlap chaining', 'Overlapping shifts (gap ≤ 0): chain if same local start day; stop at sleepover.'),
  r(78, 'broken-span', 'Below-threshold inclusion', 'Gap below threshold: include if same start day **or** previous end date equals current start date.'),
  r(79, 'broken-span', 'Per-type gap thresholds', 'Gap threshold per predecessor shift type matches import rules (10h PC/nursing, 8h sleepover).'),

  // ── Broken shift — allowances & OT ──────────────────────────────────────
  r(80, 'broken-allowances-ot', 'Tier by unpaid gap count', 'Broken allowance tier based on **unpaid gap count** in span, not shift count.', { awardRef: 'MA000100 cl. 20.11' }),
  r(81, 'broken-allowances-ot', '1-break allowance', '**1 unpaid break** in span → `brokenShiftCount` += 1 ($20.82 or staff rate).', { awardRef: 'MA000100 cl. 20.11' }),
  r(82, 'broken-allowances-ot', '2-break allowance', '**2+ unpaid breaks** in span → decrement one `brokenShiftCount`, `brokenShift2BreakCount` += 1 ($27.56).', { awardRef: 'MA000100 cl. 20.11' }),
  r(83, 'broken-allowances-ot', 'Minimum tier', 'Minimum allowance tier is 1 break when broken.'),
  r(84, 'broken-allowances-ot', 'No OT stacking on turnaround', 'Short-turnaround reclassified shift **excludes** broken-shift OT stacking on same hours.'),
  r(85, 'broken-allowances-ot', 'Span < 12h OT', 'Span **< 12h** total: OT at **1.5×** for active hours beyond daily 10h cap.', { status: 'needs-verification' }),
  r(86, 'broken-allowances-ot', 'Span ≥ 12h double time', 'Span **≥ 12h**: **entire last shift** reclassified to **2×** (tier 2 OT); overrides prior classification.', { status: 'needs-verification' }),
  r(87, 'broken-allowances-ot', '12h breach whole-shift scope', 'Span ≥ 12h breach applies to full last shift regardless of where the 12h mark falls.', { status: 'needs-verification' }),
  r(88, 'broken-allowances-ot', 'Broken OT meal allowance', 'Broken-shift OT meal: +1 allowance if OT extra **> 1h**; +1 more if **> 4h** (per OT event).'),
  r(89, 'broken-allowances-ot', 'Retro evening loading', 'Retroactive evening/night loading: if broken span ends after 20:00 same day → all weekday segments in span → **evening**.'),
  r(90, 'broken-allowances-ot', 'Retro night loading', 'Retroactive loading: if broken span ends on next calendar day → all weekday segments in span → **night**.'),
  r(91, 'broken-allowances-ot', 'Retro loading (nursing)', 'Retroactive loading applies to nursing weekday segments (moves to `nursingAfternoonHours` / `nursingNightHours`).'),

  // ── Short turnaround ────────────────────────────────────────────────────
  r(92, 'short-turnaround', 'Applicability', 'Applies when gap **> 0** and **< required break** and shift is **not** `isBrokenShift`.', { awardRef: 'MA000100 cl. 25.4' }),
  r(93, 'short-turnaround', 'Default 10h break', 'Default required break: **10h** between shifts.', { awardRef: 'MA000100 cl. 25.4' }),
  r(94, 'short-turnaround', '8h after sleepover', 'After sleepover-linked shift: required break **8h**.'),
  r(95, 'short-turnaround', 'Double time', 'Short turnaround: all active hours → `shortTurnaroundHours` (paid at **2×** / double time).', { awardRef: 'MA000100 cl. 25.4' }),
  r(96, 'short-turnaround', 'Excluded from chain OT', 'Short turnaround adds shift to `reclassifiedFullDoubleTimeShiftIds` (excluded from ordinary chain OT).'),
  r(97, 'short-turnaround', 'Suppresses broken OT', 'Short turnaround suppresses broken-shift OT on same shift.'),

  // ── Continuous chains ───────────────────────────────────────────────────
  r(98, 'continuous-chains', 'Zero-gap chain', 'Back-to-back shifts (0 gap), neither sleepover → treated as **continuous chain**.'),
  r(99, 'continuous-chains', 'Chain retro loading', 'Continuous PC chain ending after midnight or after 20:00 → retroactive evening/night loading on earlier weekday segments.'),
  r(100, 'continuous-chains', 'Chain daily OT', 'Continuous chain daily OT: combined **active hours** across chain vs 10h cap.'),
  r(101, 'continuous-chains', 'Night-origin lock', 'Chain originating as **night** on weekday: first 10h locked to **night** band before OT extraction.'),
  r(102, 'continuous-chains', 'OT from chain end', 'OT beyond cap deducted from **end** of chain entries (`deductOtFromEnd`).'),
  r(103, 'continuous-chains', 'Tiered chain OT', 'Daily OT tiered: first **2h** at 1.5×, remainder at 2× (`applyOtByDayType`).'),
  r(104, 'continuous-chains', 'Chain meal allowance', 'Continuous chain meal allowance: +1 if chain OT **> 1h**; +1 more if **> 4h**.'),
  r(105, 'continuous-chains', 'Post-sleepover cap isolation', 'Post-sleepover ordinary hours **not** combined with pre-sleepover chain for daily-cap OT.'),
  r(106, 'continuous-chains', 'Broken disables chain OT', 'Broken shifts in chain disable continuous-chain OT logic (broken rules apply instead).'),

  // ── Per-shift daily OT ──────────────────────────────────────────────────
  r(107, 'daily-ot', '10h trigger', '`processOvertime`: active hours **> 10h** on a segment/day type triggers daily OT.', { awardRef: 'MA000100 cl. 28.1' }),
  r(108, 'daily-ot', 'Tier 1', 'OT tier 1: min(OT hours, 2) at 1.5×.', { awardRef: 'MA000100 cl. 28.1' }),
  r(109, 'daily-ot', 'Tier 2', 'OT tier 2: remainder at 2×.', { awardRef: 'MA000100 cl. 28.1' }),
  r(110, 'daily-ot', 'Per-day-type buckets', 'Applied per day type: weekday, Saturday, Sunday, holiday buckets.'),

  // ── Fortnightly 76-hour cap ─────────────────────────────────────────────
  r(111, 'fortnight-cap', 'Ordinary total', 'Total ordinary hours = morning + afternoon + night + Sat + Sun + PH + nursing care + nursing afternoon + nursing night.'),
  r(112, 'fortnight-cap', 'Excess → OT>76', 'If total ordinary **> 76h**, excess → `otAfter76Hours`.', { awardRef: 'MA000100 cl. 28.1(b)' }),
  r(113, 'fortnight-cap', 'Latest-first deduction', 'Excess deducted from **latest** ledger entries first (date descending).'),
  r(114, 'fortnight-cap', 'Day-type tracking', 'Deducted hours tracked by day type: `otAfter76Weekday`, `otAfter76Saturday`, `otAfter76Sunday`, `otAfter76Holiday`.'),
  r(115, 'fortnight-cap', 'Nursing penalty deductions', 'Nursing Sat/Sun/PH deductions also reduce `nursingSaturdayHours` / `nursingSundayHours` / `nursingHolidayHours`.'),
  r(116, 'fortnight-cap', 'Nursing weekday deductions', 'Nursing weekday evening/night deductions reduce `nursingAfternoonHours` / `nursingNightHours`.'),
  r(117, 'fortnight-cap', 'Per-shift attribution', 'Per-shift OT>76 attribution stored in shift breakdowns.'),

  // ── OT>76 pay tier allocation ───────────────────────────────────────────
  r(118, 'ot76-tiers', 'Shared global band', 'Weekday + Saturday OT>76 share **one** global 1.5× band of **2 hours** total.'),
  r(119, 'ot76-tiers', 'Weekday first', 'Weekday OT>76 consumes the 1.5× band **first**.'),
  r(120, 'ot76-tiers', 'Weekday remainder 2×', 'Remaining weekday OT>76 after band → 2× (`otAfter76WeekdayAfter2`).'),
  r(121, 'ot76-tiers', 'Saturday band leftovers', 'Saturday OT>76 gets 1.5× only if band capacity remains (`otAfter76SaturdayUpto2`).'),
  r(122, 'ot76-tiers', 'Saturday remainder 2×', 'Remaining Saturday OT>76 → 2× at Saturday OT-after-2 rate (`satOtAfter2`).'),
  r(123, 'ot76-tiers', 'Sunday OT>76 at Sunday rate', 'Sunday OT>76 → paid at **Sunday** rate (2.0×) — no separate OT bracket.', { awardRef: 'MA000100 cl. 28.1(d)' }),
  r(124, 'ot76-tiers', 'PH OT>76 at PH rate', 'Public holiday OT>76 → paid at **PH** rate (2.5×) — no separate OT bracket.', { awardRef: 'MA000100 cl. 28.1(e)' }),

  // ── Minimum engagement ──────────────────────────────────────────────────
  r(125, 'minimum-engagement', '2h exception flag', 'Personal care shift **> 0h and < 2h** → `minimumEngagementException` flag.', { awardRef: 'MA000100 cl. 10.5 / 11.6', status: 'flagged' }),
  r(126, 'minimum-engagement', 'Zero-gap linking', 'Consecutive PC shifts with **zero gap** link into one engagement for 2h review.', { status: 'flagged' }),
  r(127, 'minimum-engagement', 'Unpaid break resets', 'Any unpaid break starts new engagement assessment.', { status: 'flagged' }),
  r(128, 'minimum-engagement', 'Linked chain clears flag', 'Linked PC chain summing **≥ 2h** clears minimum-engagement exception on all PC shifts in chain.', { status: 'flagged' }),
  r(129, 'minimum-engagement', 'Sleepover-adjacent exemption', 'Sleepover-adjacent PC: per-segment 2h minimum does not apply (flag cleared).', { status: 'flagged' }),
  r(130, 'minimum-engagement', '4h sleepover-adjacent review', 'PC **< 4h** adjacent to sleepover → `minimum4hEngagementReview` flag.', { status: 'flagged' }),
  r(131, 'minimum-engagement', 'Flanked 4h assessment', 'Flanked PC–sleepover–PC: **4h minimum** assessed across combined active PC hours.', { status: 'flagged' }),
  r(132, 'minimum-engagement', 'No auto top-up', 'Flags are for exception reporting; hours are **not** auto-topped-up to minimum. NOTE: the award requires *payment* of the minimum engagement — a pay top-up (auditable `minimumEngagementTopUpHours`) is pending verification/decision.', { awardRef: 'MA000100 cl. 10.5 / 11.6', status: 'needs-verification' }),

  // ── Normalization ───────────────────────────────────────────────────────
  r(133, 'normalization', 'Hours from timestamps', 'Shift hours derived from timestamps when CSV `hours` missing, ≤ 0, or mismatches timestamps by **> 0.05h**.'),
  r(134, 'normalization', 'Negative hours ignored', 'Negative CSV hours ignored when timestamps yield positive duration.'),
  r(135, 'normalization', '2dp rounding', 'All hour totals rounded to **2 decimal places** (`r2`).'),

  // ── Rate card wage calc ─────────────────────────────────────────────────
  r(136, 'rate-card', 'Base rate categories', 'Base rate categories: daytime, afternoon, night, Saturday, Sunday, PH.'),
  r(137, 'rate-card', 'OT rate categories', 'OT rate categories: `otUpto2` (1.5× tier), `otAfter2` (2× tier), `satOtAfter2` (Saturday 2× tier).'),
  r(138, 'rate-card', 'Nursing rate categories', 'Nursing rate categories: nursingDaytime, nursingAfternoon, nursingNight, nursingSaturday, nursingSunday, nursingPh.'),
  r(139, 'rate-card', 'Additive normalization', 'Imported rate sheet values **below** daytime treated as **loading deltas** added to base (additive normalization).'),
  r(140, 'rate-card', 'Nursing defaults', 'Nursing rates default to daytime × nursing factor when not explicitly set.'),
  r(141, 'rate-card', 'No double-count PC/nursing', 'Weekday evening/night pay splits base PC vs nursing hours (no double-count).'),
  r(142, 'rate-card', 'Sunday/PH include same-day OT', 'Sunday/PH ordinary hours include same-day OT buckets in penalty pay (`sunAll`, `holAll`).'),
  r(143, 'rate-card', 'Turnaround at otAfter2', 'Short turnaround hours paid at `otAfter2` rate (double time).'),
  r(144, 'rate-card', 'Broken allowance pay', 'Broken shift: `brokenShiftCount` × rate (default $20.82) + `brokenShift2BreakCount` × $27.56.'),
  r(145, 'rate-card', 'Sleepover allowance pay', 'Sleepover allowance: `sleepoversCount` × (sleepover + sleepoverExtra). Default sleepover rate $90; award formula is 4.9% of the standard rate per night.', { awardRef: 'MA000100 cl. 25.7', status: 'needs-verification' }),
  r(146, 'rate-card', 'Meal allowance pay', 'Meal allowance: `mealAllowanceCount` × staff meal rate (default $16.62).'),
  r(147, 'rate-card', 'Mileage pay', 'Mileage: `totalKm` × km rate (default $0.99).'),
  r(148, 'rate-card', 'Flat allowance', 'Flat per-fortnight `allowance` field added to gross.'),

  // ── Multiplier fallback wage calc ───────────────────────────────────────
  r(149, 'multiplier-fallback', 'Casual effective rate', '**Casual** effective rate: `rate × (mult / 1.25 + 0.2)` (`casualEff`) — assumes the stored rate already includes the 25% casual loading. Verify the loading interaction with penalties and overtime against MA000100.', { awardRef: 'MA000100 cl. 10.4', status: 'needs-verification' }),
  r(150, 'multiplier-fallback', 'Permanent loadings', '**Permanent** penalty loadings on base rate directly.'),
  r(151, 'multiplier-fallback', 'Weekday daytime 1.0×', 'Weekday daytime: **1.0×**.'),
  r(152, 'multiplier-fallback', 'Weekday evening 1.125×', 'Weekday evening: **1.125×**.', { awardRef: 'MA000100 cl. 29' }),
  r(153, 'multiplier-fallback', 'Weekday night 1.15×', 'Weekday night: **1.15×**.', { awardRef: 'MA000100 cl. 29' }),
  r(154, 'multiplier-fallback', 'WD OT ≤2h 1.5×', 'Weekday daily OT ≤2h: **1.5×**.', { awardRef: 'MA000100 cl. 28.1' }),
  r(155, 'multiplier-fallback', 'WD OT >2h 2.0×', 'Weekday daily OT >2h: **2.0×**.', { awardRef: 'MA000100 cl. 28.1' }),
  r(156, 'multiplier-fallback', 'Saturday tiers', 'Saturday: **1.5×**; Sat OT ≤2h: **1.5×**; Sat OT >2h: **2.0×**.', { awardRef: 'MA000100 cl. 26 / 28.1' }),
  r(157, 'multiplier-fallback', 'Sunday 2.0×', 'Sunday (incl. same-day OT): **2.0×**.', { awardRef: 'MA000100 cl. 26 / 28.1(d)' }),
  r(158, 'multiplier-fallback', 'PH 2.5×', 'Public holiday (incl. OT): **2.5×**.', { awardRef: 'MA000100 cl. 27 / 28.1(e)' }),
  r(159, 'multiplier-fallback', 'Nursing weekday 1.0×', 'Nursing care (weekday): **1.0×**.'),
  r(160, 'multiplier-fallback', 'Turnaround 2.0×', 'Short turnaround: **2.0×**.'),
  r(161, 'multiplier-fallback', 'OT>76 multipliers', 'OT>76 tiers use same multipliers as daily OT by day type.'),
  r(162, 'multiplier-fallback', 'Allowance add-on', 'Allowances added via `calcAllowances` (broken + meal + mileage).'),

  // ── Breakdown line items ────────────────────────────────────────────────
  r(163, 'breakdown-lines', 'Daytime line', 'Daytime (≤8pm) — ordinary.'),
  r(164, 'breakdown-lines', 'Evening line', 'Evening (>8pm) — penalty.'),
  r(165, 'breakdown-lines', 'Nursing evening line', 'Nursing Evening — penalty at nursing afternoon rate.'),
  r(166, 'breakdown-lines', 'Night line', 'Night — penalty.'),
  r(167, 'breakdown-lines', 'Nursing night line', 'Nursing Night — penalty at nursing night rate.'),
  r(168, 'breakdown-lines', 'WD OT ≤2h line', 'WD OT ≤2h — overtime.'),
  r(169, 'breakdown-lines', 'WD OT >2h line', 'WD OT >2h — overtime.'),
  r(170, 'breakdown-lines', 'Saturday line', 'Saturday — penalty.'),
  r(171, 'breakdown-lines', 'Nursing Saturday line', 'Nursing Saturday — penalty.'),
  r(172, 'breakdown-lines', 'Sat OT ≤2h line', 'Sat OT ≤2h — overtime.'),
  r(173, 'breakdown-lines', 'Sat OT >2h line', 'Sat OT >2h — overtime.'),
  r(174, 'breakdown-lines', 'Sunday line', 'Sunday (incl. OT) — penalty.'),
  r(175, 'breakdown-lines', 'Nursing Sunday line', 'Nursing Sunday — penalty.'),
  r(176, 'breakdown-lines', 'PH line', 'Public Holiday (incl. OT) — penalty.'),
  r(177, 'breakdown-lines', 'Nursing holiday line', 'Nursing Holiday — penalty.'),
  r(178, 'breakdown-lines', 'Nursing care line', 'Nursing Care — ordinary.'),
  r(179, 'breakdown-lines', 'Double time (no break) line', 'Double Time (No Break) — short turnaround at 2× rate.'),
  r(180, 'breakdown-lines', 'OT>76 WD ≤2h line', 'OT >76h WD ≤2h — ot76 tier.'),
  r(181, 'breakdown-lines', 'OT>76 WD >2h line', 'OT >76h WD >2h — ot76 tier.'),
  r(182, 'breakdown-lines', 'OT>76 Sat ≤2h line', 'OT >76h Sat ≤2h — ot76 tier.'),
  r(183, 'breakdown-lines', 'OT>76 Sat >2h line', 'OT >76h Sat >2h — ot76 tier.'),
  r(184, 'breakdown-lines', 'OT>76 Sun line', 'OT >76h Sun — ot76 at Sunday rate.'),
  r(185, 'breakdown-lines', 'OT>76 PH line', 'OT >76h PH — ot76 at PH rate.'),
  r(186, 'breakdown-lines', 'Penalty split display', 'Penalty lines split into base pay + penalty loading for display.'),
  r(187, 'breakdown-lines', 'Allowance block', 'Allowance block: broken (1-break), broken (2-break), meal, sleepover, mileage, other.'),

  // ── Aggregation ─────────────────────────────────────────────────────────
  r(188, 'aggregation', 'staffTotalHours', '`staffTotalHours` sums all payable hour buckets including OT>76 reclassified hours.'),
  r(189, 'aggregation', 'shiftRowPayableHours', '`shiftRowPayableHours` same logic per shift row.'),
  r(190, 'aggregation', 'totalOtHrs', '`totalOtHrs` sums daily OT buckets only (not OT>76).'),
  r(191, 'aggregation', 'Allowances excluded from hours', 'Sleepovers, broken allowances, meal/mileage are **not** included in hour totals.'),

  // ── Timezone ────────────────────────────────────────────────────────────
  r(192, 'timezone', 'Local offset for classification', 'All day-type and time-band logic uses shift `timezoneOffset` (e.g. `+10:00`).'),
  r(193, 'timezone', 'Local date strings', 'Local date strings (YYYY-MM-DD) drive holiday and broken-shift same-day tests.'),
  r(194, 'timezone', 'Default +10:00', 'Default offset when missing: **+10:00** (Brisbane).'),

  // ── Out of scope ────────────────────────────────────────────────────────
  r(195, 'out-of-scope', 'Sleepover-attached night export disabled', '`computeSleepovernAttachedNight` currently returns **all false** — sleepover-attached night override via that export is disabled.', { status: 'not-implemented' }),
  r(196, 'out-of-scope', 'No minimum-engagement top-up', 'Minimum engagement hours are **flagged** only; no automatic pay top-up to 2h or 4h.', { awardRef: 'MA000100 cl. 10.5 / 11.6', status: 'not-implemented' }),
  r(197, 'out-of-scope', 'Manual week-mode calculator', 'Manual week-mode calculator in `SchadsCalculator.jsx` uses separate 7.6h daily / 38h weekly ordinary logic (not shift-import path).', { status: 'not-implemented' }),
  r(198, 'out-of-scope', 'Super/tax out of scope', 'Superannuation, tax, and net pay are outside `calcGross` (handled separately in cost analysis).', { status: 'not-implemented' }),
];

export function getRuleById(id) {
  return RULES_CATALOG.find((rule) => rule.id === id) || null;
}

export function getRulesByCategory() {
  const byCat = new Map(RULE_CATEGORIES.map((c) => [c.slug, { ...c, rules: [] }]));
  for (const rule of RULES_CATALOG) {
    byCat.get(rule.category)?.rules.push(rule);
  }
  return [...byCat.values()];
}
