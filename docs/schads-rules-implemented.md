# SCHADS Rules Implemented in Calculation

Line-by-line inventory of SCHADS Award (MA000100) rules encoded in this codebase.  
**Sources:** `backend/modules/pay-hours/services/payHoursCalculator.js`, `backend/modules/shifts/shiftCsvParser.js`, `frontend/src/lib/schadsWageCalc.js`, `frontend/src/lib/ot76GlobalTier.js`.

---

## Constants & thresholds

1. Weekday daytime band starts at **06:00** local (`MORNING_START = 6`).
2. Weekday evening band starts at **20:00** local (`AFTERNOON_START = 20`).
3. Time-band splits use **06:01** and **20:01** boundaries when splitting sleepover excess by band (`splitWeekdayByTimeBand`).
4. Daily ordinary cap before daily OT: **10 hours** active (`MAX_REGULAR_HOURS` / `MAX_REGULAR_HOURS_WEEKDAY`).
5. Daily OT tier 1 cap: first **2 hours** at 1.5× (`OT_TIER_1_MAX = 2`).
6. Fortnightly ordinary-hours cap before OT>76: **76 hours** (`TOTAL_HOURS_CAP = 76`).
7. Broken-shift short span threshold: **12 hours** (`BROKEN_SHIFT_SHORT_SPAN`).
8. Sleepover non-billable deduction: **8 hours** (`SLEEPOVER_DEDUCTION = 8`).
9. Standard minimum break between shifts (short-turnaround): **10 hours** (`MIN_BREAK_BETWEEN_SHIFTS_MS`).
10. Minimum break after sleepover-linked shift: **8 hours** (`MIN_BREAK_AFTER_SLEEPOVER_MS`).
11. Sleepover follow-on attach window for next PC/nursing shift: **8 hours** (`SLEEPOVER_FOLLOWON_GAP_MS`).
12. Contiguous-shift tolerance (rounding): **1 minute** (`GAP_CONTIGUOUS_TOLERANCE_MS`).
13. Broken-shift gap — Personal Care predecessor: **10 hours** (`BROKEN_SHIFT_GAP_PERSONAL_CARE_MS`).
14. Broken-shift gap — Sleepover predecessor: **8 hours** (`BROKEN_SHIFT_GAP_SLEEPOVER_MS`).
15. Broken-shift gap — Nursing Support predecessor: **10 hours** (`BROKEN_SHIFT_GAP_NURSING_SUPPORT_MS`).
16. Broken-shift allowance (1 break): **$20.82** (`BROKEN_ALLOWANCE_1`).
17. Broken-shift allowance (2 breaks): **$27.56** (`BROKEN_ALLOWANCE_2`).
18. Meal allowance per qualifying event: **$16.62** (`MEAL_ALLOWANCE`).
19. Default vehicle/km rate: **$0.99/km** (`VEHICLE_RATE`).
20. Manual calculator daily ordinary: **7.6 h/day** (`DAILY_ORD`).
21. Manual calculator weekly ordinary: **38 h/week** (`WEEKLY_ORD`).
22. OT multipliers: **1.5×** tier 1 (`OT_1`), **2.0×** tier 2 (`OT_2`).
23. OT>76 global shared 1.5× band: **2 hours** total across weekday + Saturday (`OT76_GLOBAL_TIER1_MAX`).

---

## Day type classification

24. Saturday (local weekday index 5) → `saturday` day type.
25. Sunday (local weekday index 6) → `sunday` day type.
26. Monday–Friday → `weekday` day type.
27. Date in configured `holidaySet` (YYYY-MM-DD local) → `holiday` day type.
28. **Christmas Eve (24 Dec):** before 18:00 local → regular weekday/Sat/Sun classification.
29. **Christmas Eve (24 Dec):** at or after 18:00 local → `holiday` day type.
30. Christmas Eve 6pm split takes priority over midnight split when shift spans 18:00 on 24 Dec.
31. Cross-midnight shift ending at/before **00:01** local treated as same calendar day (no midnight split).

---

## Weekday time-band classification (whole shift)

32. Shift starting before **06:00** local → **night** band.
33. Shift crossing midnight and ending after **00:00** (not exactly midnight) → **night** band.
34. Same-day shift ending after **20:00** local → **evening** band.
35. Same-day shift ending at or before **20:00** local → **daytime** band.
36. Shift ending exactly at **00:00** is treated as at/before midnight (not forced to night by cross-midnight rule).
37. Weekday classification applies to the **whole qualifying shift** (not split at 6am/8pm) except sleepover excess.

---

## Cross-midnight & special-day splits

38. Both days weekday, crosses midnight past 00:01 → entire shift classified as **weekday night** (no day split).
39. Crosses midnight with different day types → split at local midnight.
40. Pre-midnight portion of cross-midnight weekday shift → **night** band.
41. Post-midnight portion starting at 00:00 on weekday → **night** band (< 06:00).
42. Weekday → holiday cross-midnight: pre-midnight weekday → night; post-midnight → holiday.
43. Non-holiday cross-day: day-1 penalty day (Sat/Sun/PH) keeps its day type for pre-midnight hours.
44. Post-midnight day-2 weekday → night band.
45. Post-midnight day-2 Sat/Sun/PH → respective penalty day type, no time sub-band.

---

## Sleepover rules

46. Sleepover active (billable) hours = total shift hours minus **8** (`calculateActiveHours`).
47. Sleepover with ≤0 excess hours → allowance only (`sleepoversCount`); no payable hour segments.
48. Sleepover excess hours split at **06:01 / 20:01** bands on weekdays (`splitWeekdayByTimeBand`).
49. Sleepover excess on Sat/Sun/PH → single segment at that day type (no time sub-band).
50. Each sleepover shift increments `sleepoversCount` by 1.
51. Sleepover crossing midnight: 8h deduction applied across day-1/day-2 boundary (`splitSleepoverAtMidnight`).
52. Sleepover crossing Christmas Eve 6pm: deduction split across pre-6pm / post-6pm / post-midnight (`splitSleepoverAtChristmasEve6pm`).
53. PC shift touching sleepover (gap ≤ 1 min) → flagged **pre-sleepover** (`isPreSleepover`).
54. PC/nursing within **8h** after sleepover end → flagged **post-sleepover** (`isPostSleepover`).
55. Post-sleepover weekday PC → forced to **night** band regardless of clock time.
56. Pre-sleepover weekday PC uses highest time band of whole shift (no 6am/8pm split).
57. Sleepover with no excess on weekday adds **night** placeholder for chain influence.
58. Continuous chains **snap at sleepover boundary** — pre/post sleepover loadings decoupled for OT/cap logic.
59. After sleepover-linked shift, short-turnaround threshold uses **8h** break requirement (not 10h).

---

## Nursing support rules

60. Nursing shifts split at midnight for Sat/Sun/PH penalty rates.
61. Weekday nursing hours accumulate in `nursingCareHours` (paid at nursing daytime rate).
62. Saturday nursing → `nursingSaturdayHours` + `saturdayHours` ledger.
63. Sunday nursing → `nursingSundayHours` + `sundayHours` ledger.
64. Public holiday nursing → `nursingHolidayHours` + `holidayHours` ledger.
65. Nursing evening/night on weekday tracked separately: `nursingAfternoonHours`, `nursingNightHours`.
66. Broken-shift retroactive loading moves weekday nursing from `nursingCareHours` to evening/night nursing fields when applicable.
67. Short-turnaround reclassification removes weekday nursing from `nursingCareHours` ledger.

---

## Broken shift — detection (import)

68. Broken shifts detected per staff, chronological order (`detectBrokenShifts`).
69. **BR-BS-001:** Current shift broken if previous was **Personal Care** and **0 < gap < 10h**.
70. **BR-BS-002:** Current shift broken if previous was **Sleepover** and **0 < gap < 8h**.
71. **BR-BS-003:** Current shift broken if previous was **Nursing Support** and **0 < gap < 10h**.
72. Gap exactly at threshold (10h or 8h) → **not** broken (adequate rest).
73. Gap ≤ 0 (touching/overlapping) → **not** broken via gap rule.
74. Broken only if same local start day **or** previous shift end date equals current shift start date.
75. Sets `isBrokenShift: true` on shift record for calculator.

---

## Broken shift — span collection (calculation)

76. Walks backward through processed shifts to build broken-shift span (`collectBrokenShiftSpanPrevious`).
77. Overlapping shifts (gap ≤ 0): chain if same local start day; stop at sleepover.
78. Gap below threshold: include if same start day **or** previous end date equals current start date.
79. Gap threshold per predecessor shift type matches import rules (10h PC/nursing, 8h sleepover).

---

## Broken shift — allowances & OT

80. Broken allowance tier based on **unpaid gap count** in span, not shift count.
81. **1 unpaid break** in span → `brokenShiftCount` += 1 ($20.82 or staff rate).
82. **2+ unpaid breaks** in span → decrement one `brokenShiftCount`, `brokenShift2BreakCount` += 1 ($27.56).
83. Minimum allowance tier is 1 break when broken.
84. Short-turnaround reclassified shift **excludes** broken-shift OT stacking on same hours.
85. Span **< 12h** total: OT at **1.5×** for active hours beyond daily 10h cap.
86. Span **≥ 12h**: **entire last shift** reclassified to **2×** (tier 2 OT); overrides prior classification.
87. Span ≥ 12h breach applies to full last shift regardless of where 12h mark falls.
88. Broken-shift OT meal: +1 allowance if OT extra **> 1h**; +1 more if **> 4h** (per OT event).
89. Retroactive evening/night loading: if broken span ends after 20:00 same day → all weekday segments in span → **evening**.
90. Retroactive loading: if broken span ends on next calendar day → all weekday segments in span → **night**.
91. Retroactive loading applies to nursing weekday segments (moves to `nursingAfternoonHours` / `nursingNightHours`).

---

## Short turnaround (inadequate rest, non-broken)

92. Applies when gap **> 0** and **< required break** and shift is **not** `isBrokenShift`.
93. Default required break: **10h** between shifts.
94. After sleepover-linked shift: required break **8h**.
95. Short turnaround: all active hours → `shortTurnaroundHours` (paid at **2×** / double time).
96. Short turnaround adds shift to `reclassifiedFullDoubleTimeShiftIds` (excluded from ordinary chain OT).
97. Short turnaround suppresses broken-shift OT on same shift.

---

## Continuous shift chains (gap = 0)

98. Back-to-back shifts (0 gap), neither sleepover → treated as **continuous chain**.
99. Continuous PC chain ending after midnight or after 20:00 → retroactive evening/night loading on earlier weekday segments.
100. Continuous chain daily OT: combined **active hours** across chain vs 10h cap.
101. Chain originating as **night** on weekday: first 10h locked to **night** band before OT extraction.
102. OT beyond cap deducted from **end** of chain entries (`deductOtFromEnd`).
103. Daily OT tiered: first **2h** at 1.5×, remainder at 2× (`applyOtByDayType`).
104. Continuous chain meal allowance: +1 if chain OT **> 1h**; +1 more if **> 4h**.
105. Post-sleepover ordinary hours **not** combined with pre-sleepover chain for daily-cap OT.
106. Broken shifts in chain disable continuous-chain OT logic (broken rules apply instead).

---

## Per-shift daily OT (non-chain / segment level)

107. `processOvertime`: active hours **> 10h** on a segment/day type triggers daily OT.
108. OT tier 1: min(OT hours, 2) at 1.5×.
109. OT tier 2: remainder at 2×.
110. Applied per day type: weekday, Saturday, Sunday, holiday buckets.

---

## Fortnightly 76-hour cap

111. Total ordinary hours = morning + afternoon + night + Sat + Sun + PH + nursing care + nursing afternoon + nursing night.
112. If total ordinary **> 76h**, excess → `otAfter76Hours`.
113. Excess deducted from **latest** ledger entries first (date descending).
114. Deducted hours tracked by day type: `otAfter76Weekday`, `otAfter76Saturday`, `otAfter76Sunday`, `otAfter76Holiday`.
115. Nursing Sat/Sun/PH deductions also reduce `nursingSaturdayHours` / `nursingSundayHours` / `nursingHolidayHours`.
116. Nursing weekday evening/night deductions reduce `nursingAfternoonHours` / `nursingNightHours`.
117. Per-shift OT>76 attribution stored in shift breakdowns.

---

## OT>76 pay tier allocation

118. Weekday + Saturday OT>76 share **one** global 1.5× band of **2 hours** total.
119. Weekday OT>76 consumes the 1.5× band **first**.
120. Remaining weekday OT>76 after band → 2× (`otAfter76WeekdayAfter2`).
121. Saturday OT>76 gets 1.5× only if band capacity remains (`otAfter76SaturdayUpto2`).
122. Remaining Saturday OT>76 → 2× at Saturday OT-after-2 rate (`satOtAfter2`).
123. Sunday OT>76 → paid at **Sunday** rate (2.0×) — no separate OT bracket.
124. Public holiday OT>76 → paid at **PH** rate (2.5×) — no separate OT bracket.

---

## Minimum engagement (exception flags)

125. Personal care shift **> 0h and < 2h** → `minimumEngagementException` flag.
126. Consecutive PC shifts with **zero gap** link into one engagement for 2h review.
127. Any unpaid break starts new engagement assessment.
128. Linked PC chain summing **≥ 2h** clears minimum-engagement exception on all PC shifts in chain.
129. Sleepover-adjacent PC: per-segment 2h minimum does not apply (flag cleared).
130. PC **< 4h** adjacent to sleepover → `minimum4hEngagementReview` flag.
131. Flanked PC–sleepover–PC: **4h minimum** assessed across combined active PC hours.
132. Flags are for exception reporting; hours are **not** auto-top-up to minimum.

---

## Hours normalization & data quality

133. Shift hours derived from timestamps when CSV `hours` missing, ≤ 0, or mismatches timestamps by **> 0.05h**.
134. Negative CSV hours ignored when timestamps yield positive duration.
135. All hour totals rounded to **2 decimal places** (`r2`).

---

## Wage calculation — rate card (`calcGrossFromRates`)

136. Base rate categories: daytime, afternoon, night, Saturday, Sunday, PH.
137. OT rate categories: `otUpto2` (1.5× tier), `otAfter2` (2× tier), `satOtAfter2` (Saturday 2× tier).
138. Nursing rate categories: nursingDaytime, nursingAfternoon, nursingNight, nursingSaturday, nursingSunday, nursingPh.
139. Imported rate sheet values **below** daytime treated as **loading deltas** added to base (additive normalization).
140. Nursing rates default to daytime × nursing factor when not explicitly set.
141. Weekday evening/night pay splits base PC vs nursing hours (no double-count).
142. Sunday/PH ordinary hours include same-day OT buckets in penalty pay (`sunAll`, `holAll`).
143. Short turnaround hours paid at `otAfter2` rate (double time).
144. Broken shift: `brokenShiftCount` × rate (default $20.82) + `brokenShift2BreakCount` × $27.56.
145. Sleepover allowance: `sleepoversCount` × (sleepover + sleepoverExtra).
146. Meal allowance: `mealAllowanceCount` × staff meal rate (default $16.62).
147. Mileage: `totalKm` × km rate (default $0.99).
148. Flat per-fortnight `allowance` field added to gross.

---

## Wage calculation — multiplier fallback (`calcGross` without rate card)

149. **Casual** effective rate: `rate × (mult / 1.25 + 0.2)` (`casualEff`).
150. **Permanent** penalty loadings on base rate directly.
151. Weekday daytime: **1.0×**.
152. Weekday evening: **1.125×**.
153. Weekday night: **1.15×**.
154. Weekday daily OT ≤2h: **1.5×**.
155. Weekday daily OT >2h: **2.0×**.
156. Saturday: **1.5×**; Sat OT ≤2h: **1.5×**; Sat OT >2h: **2.0×**.
157. Sunday (incl. same-day OT): **2.0×**.
158. Public holiday (incl. same-day OT): **2.5×**.
159. Nursing care (weekday): **1.0×**.
160. Short turnaround: **2.0×**.
161. OT>76 tiers use same multipliers as daily OT by day type.
162. Allowances added via `calcAllowances` (broken + meal + mileage).

---

## Pay breakdown line items (`calcBreakdownFromRates`)

163. Daytime (≤8pm) — ordinary.
164. Evening (>8pm) — penalty.
165. Nursing Evening — penalty at nursing afternoon rate.
166. Night — penalty.
167. Nursing Night — penalty at nursing night rate.
168. WD OT ≤2h — overtime.
169. WD OT >2h — overtime.
170. Saturday — penalty.
171. Nursing Saturday — penalty.
172. Sat OT ≤2h — overtime.
173. Sat OT >2h — overtime.
174. Sunday (incl. OT) — penalty.
175. Nursing Sunday — penalty.
176. Public Holiday (incl. OT) — penalty.
177. Nursing Holiday — penalty.
178. Nursing Care — ordinary.
179. Double Time (No Break) — short turnaround at 2× rate.
180. OT >76h WD ≤2h — ot76 tier.
181. OT >76h WD >2h — ot76 tier.
182. OT >76h Sat ≤2h — ot76 tier.
183. OT >76h Sat >2h — ot76 tier.
184. OT >76h Sun — ot76 at Sunday rate.
185. OT >76h PH — ot76 at PH rate.
186. Penalty lines split into base pay + penalty loading for display.
187. Allowance block: broken (1-break), broken (2-break), meal, sleepover, mileage, other.

---

## Total hours aggregation

188. `staffTotalHours` sums all payable hour buckets including OT>76 reclassified hours.
189. `shiftRowPayableHours` same logic per shift row.
190. `totalOtHrs` sums daily OT buckets only (not OT>76).
191. Sleepovers, broken allowances, meal/mileage are **not** included in hour totals.

---

## Timezone handling

192. All day-type and time-band logic uses shift `timezoneOffset` (e.g. `+10:00`).
193. Local date strings (YYYY-MM-DD) drive holiday and broken-shift same-day tests.
194. Default offset when missing: **+10:00** (Brisbane).

---

## Not implemented / out of scope in calculator

195. `computeSleepovernAttachedNight` currently returns **all false** — sleepover-attached night override via that export is disabled.
196. Minimum engagement hours are **flagged** only; no automatic pay top-up to 2h or 4h.
197. Manual week-mode calculator in `SchadsCalculator.jsx` uses separate 7.6h daily / 38h weekly ordinary logic (not shift-import path).
198. Superannuation, tax, and net pay are outside `calcGross` (handled separately in cost analysis).

---

*Generated from codebase audit. Verify against [Fair Work SCHADS Award MA000100](https://www.fairwork.gov.au) and current pay guide rates.*
