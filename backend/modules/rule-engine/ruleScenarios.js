/**
 * Real-life NDIS / SCHADS scenarios for each catalog rule.
 * Consumed by the rules reference UI — one scenario per rule id.
 */

import { buildPayCalcForRule, buildVisualFromPayCalc } from './ruleScenarioPayCalc.js';

const WORKERS = {
  pc: { name: 'Sarah Chen', role: 'Support Worker · Level 2', employment: 'Permanent part-time' },
  pc2: { name: 'Tom Nguyen', role: 'Support Worker · Level 3', employment: 'Casual' },
  nursing: { name: 'Lisa Park', role: 'Nursing Support Worker', employment: 'Permanent full-time' },
  casual: { name: 'Emma Walsh', role: 'Support Worker · Level 2', employment: 'Casual' },
};

const PARTICIPANTS = {
  james: { name: "James O'Brien", detail: 'Lives independently — morning & evening personal care' },
  maya: { name: 'Maya Patel', detail: 'High-needs participant — 24/7 roster with sleepovers' },
  noah: { name: 'Noah Williams', detail: 'Community access & nursing support on weekends' },
  elena: { name: 'Elena Rossi', detail: 'Shared SIL house — rotating support workers' },
};

/** @typedef {{ time: string, label: string, detail: string, accent?: 'primary'|'warning'|'success'|'muted', icon?: string }} TimelineStep */
/** @typedef {{ title: string, worker: object, participant: object, setting: string, timeline: TimelineStep[], outcome: string, payNote?: string, payCalc?: object, visual?: object }} RuleScenario */

/** @returns {RuleScenario} */
function baseScenario(rule, partial) {
  const payCalc = buildPayCalcForRule(rule, partial);
  return {
    title: partial.title ?? rule.title,
    worker: partial.worker ?? WORKERS.pc,
    participant: partial.participant ?? PARTICIPANTS.james,
    setting: partial.setting ?? 'Brisbane (UTC+10) · SCHADS disability services',
    timeline: partial.timeline ?? [],
    outcome: partial.outcome ?? rule.description.replace(/\*\*/g, '').replace(/`([^`]+)`/g, '$1'),
    payNote: partial.payNote ?? null,
    payCalc,
    visual: partial.visual ?? buildVisualFromPayCalc(payCalc, partial.timeline),
  };
}

/** Per-rule handcrafted scenarios for high-impact rules. */
const SCENARIO_OVERRIDES = {
  R004: {
    title: 'Long Tuesday shift hits the 10-hour daily cap',
    worker: WORKERS.pc2,
    participant: PARTICIPANTS.maya,
    setting: 'Tuesday · Personal care + community access',
    timeline: [
      { time: '7:00 AM', label: 'Shift starts', detail: 'Morning routine and breakfast support', accent: 'muted' },
      { time: '5:00 PM', label: 'Shift ends', detail: '10.0 active hours worked — hits the daily ordinary cap', accent: 'warning' },
      { time: 'After cap', label: 'Daily OT begins', detail: 'Any further hours on this shift move into OT tiers (1.5× then 2×)', accent: 'primary' },
    ],
    outcome: 'The first 10 active hours stay ordinary; hours beyond 10 trigger daily overtime.',
    payNote: 'First 2 OT hours at 1.5×, remainder at 2× (R005/R108).',
  },
  R046: {
    title: 'Friday night sleepover at a SIL house',
    worker: WORKERS.pc,
    participant: PARTICIPANTS.maya,
    setting: 'Friday 10:00 PM → Saturday 6:00 AM',
    timeline: [
      { time: '10:00 PM', label: 'Sleepover starts', detail: 'Worker on-site for overnight passive support', accent: 'muted' },
      { time: 'Overnight', label: '8h non-billable', detail: 'Standard 8-hour sleepover deduction applied', accent: 'warning' },
      { time: '6:00 AM', label: 'Active hours', detail: 'Only excess beyond 8h is paid as active time', accent: 'primary' },
    ],
    outcome: 'A 10h sleepover yields 2h active hours; the 8h deduction is non-billable.',
    payNote: 'Sleepover allowance also applies per night (R145).',
  },
  R069: {
    title: 'Back-to-back personal care with only 3 hours rest',
    worker: WORKERS.pc,
    participant: PARTICIPANTS.elena,
    setting: 'Wednesday · SIL shared house',
    timeline: [
      { time: '6:00 AM', label: 'Morning PC shift', detail: 'Personal care ends 8:00 AM', accent: 'muted' },
      { time: '8:00 AM → 11:00 AM', label: '3h unpaid gap', detail: 'Gap is greater than 0 but less than the 10h PC threshold', accent: 'warning' },
      { time: '11:00 AM', label: 'Second PC shift', detail: 'Flagged as broken shift (BR-BS-001)', accent: 'primary' },
    ],
    outcome: 'The 11 AM shift is marked broken because the rest gap was under 10 hours after personal care.',
    payNote: 'Broken-shift allowance and span rules may also apply (R080+).',
  },
  R092: {
    title: 'Worker called back after only 6 hours sleep',
    worker: WORKERS.casual,
    participant: PARTICIPANTS.james,
    setting: 'Thursday · Inadequate rest between shifts',
    timeline: [
      { time: '9:00 PM', label: 'Evening shift ends', detail: 'Worker finishes evening personal care', accent: 'muted' },
      { time: '3:00 AM', label: '6h gap', detail: 'Roster gap is under the 10h minimum break requirement', accent: 'warning' },
      { time: '3:00 AM', label: 'Emergency call-back', detail: 'Participant needs support — shift is not a broken shift, but rest was inadequate', accent: 'primary' },
    ],
    outcome: 'All active hours on the call-back shift are paid at double time (short turnaround).',
    payNote: 'Paid at 2× — short turnaround hours, not broken-shift OT.',
  },
  R098: {
    title: 'Two shifts booked back-to-back with no gap',
    worker: WORKERS.pc,
    participant: PARTICIPANTS.james,
    setting: 'Monday · Continuous support block',
    timeline: [
      { time: '8:00 AM', label: 'Shift A ends', detail: 'Morning personal care finishes on the dot', accent: 'muted' },
      { time: '8:00 AM', label: 'Shift B starts', detail: 'Community access begins immediately — zero gap', accent: 'primary' },
      { time: 'Combined', label: 'Continuous chain', detail: 'Active hours are summed for daily OT and retro loading', accent: 'success' },
    ],
    outcome: 'Back-to-back shifts form a continuous chain; daily OT is assessed on combined active hours.',
    payNote: 'If the chain ends after 8 PM, earlier segments may get retro evening loading (R099).',
  },
  R112: {
    title: 'Support worker exceeds 76 ordinary hours in a fortnight',
    worker: WORKERS.pc2,
    participant: PARTICIPANTS.maya,
    setting: 'Fortnight ending 14 Jul · High-utilisation roster',
    timeline: [
      { time: 'Week 1–2', label: '78h ordinary', detail: 'Morning, evening, and Saturday shifts accumulate', accent: 'muted' },
      { time: 'Fortnight close', label: '76h cap reached', detail: 'Ordinary-hour cap is 76h per fortnight', accent: 'warning' },
      { time: 'Excess', label: '2h → OT>76', detail: 'Latest ledger entries are reduced first', accent: 'primary' },
    ],
    outcome: 'Two hours are reclassified as OT>76 and paid at the OT>76 tier rates.',
    payNote: 'Weekday OT>76 uses a shared 2h band at 1.5× before 2× (R118).',
  },
  R125: {
    title: 'Quick 90-minute welfare check',
    worker: WORKERS.casual,
    participant: PARTICIPANTS.james,
    setting: 'Tuesday · One-off personal care visit',
    timeline: [
      { time: '2:00 PM', label: 'Shift starts', detail: 'Brief medication reminder and welfare check', accent: 'muted' },
      { time: '3:30 PM', label: 'Shift ends', detail: 'Only 1.5 active hours — below 2h minimum engagement', accent: 'warning' },
      { time: 'Flag raised', label: 'Exception review', detail: 'minimumEngagementException flagged for payroll review', accent: 'primary' },
    ],
    outcome: 'The engine flags the shift for minimum-engagement review; hours are not auto-topped up.',
    payNote: 'Award requires 2h minimum payment — flag only until top-up is implemented (R196).',
  },
  R133: {
    title: 'Timesheet CSV shows wrong hours',
    worker: WORKERS.pc,
    participant: PARTICIPANTS.elena,
    setting: 'Roster import · ShiftCare export',
    timeline: [
      { time: 'Import', label: 'CSV says 7.0h', detail: 'Exported hours field from roster system', accent: 'muted' },
      { time: 'Timestamps', label: 'Actual 7.5h', detail: 'Start/end timestamps differ by more than 0.05h', accent: 'warning' },
      { time: 'Engine', label: 'Uses timestamps', detail: 'Trusts clock times over the mismatched CSV value', accent: 'primary' },
    ],
    outcome: 'Hours are recalculated from timestamps when CSV hours are missing or unreliable.',
    payNote: 'Prevents under-payment from bad export data.',
  },
};

/** Category-level scenario templates — used when no override exists. */
const BROKEN_GAP_CONSTANTS = {
  R013: { gapH: 10, pred: 'Personal Care', worker: WORKERS.pc, participant: PARTICIPANTS.elena },
  R014: { gapH: 8, pred: 'Sleepover', worker: WORKERS.pc, participant: PARTICIPANTS.maya },
  R015: { gapH: 10, pred: 'Nursing Support', worker: WORKERS.nursing, participant: PARTICIPANTS.noah },
};

const CATEGORY_BUILDERS = {
  constants(rule) {
    const brokenGap = BROKEN_GAP_CONSTANTS[rule.id];
    if (brokenGap) {
      const desc = rule.description.replace(/\*\*/g, '').replace(/`([^`]+)`/g, '$1');
      return baseScenario(rule, {
        title: `Gap after ${brokenGap.pred} — is it broken?`,
        worker: brokenGap.worker,
        participant: brokenGap.participant,
        setting: 'Same staff · Two shifts · gap measured in local time',
        timeline: [
          {
            time: '7:00 AM',
            label: `${brokenGap.pred} shift ends`,
            detail: `Lisa finishes a ${brokenGap.pred.toLowerCase()} shift. The engine records the end time for gap calculation.`,
            accent: 'muted',
          },
          {
            time: '5h later',
            label: `${brokenGap.gapH}h threshold`,
            detail: desc,
            accent: 'warning',
          },
          {
            time: '12:00 PM',
            label: 'Return shift starts',
            detail: `Gap is > 0 but < ${brokenGap.gapH}h — predecessor was ${brokenGap.pred}, so broken-shift detection uses ${rule.constants?.[0] || 'this constant'}.`,
            accent: 'primary',
          },
        ],
        outcome: `If the unpaid gap falls between 0 and ${brokenGap.gapH} hours after ${brokenGap.pred}, the return shift is flagged broken.`,
        payNote: rule.awardRef ? `Award reference: ${rule.awardRef}` : `Constant: ${rule.constants?.join(', ')}`,
      });
    }

    const desc = rule.description.replace(/\*\*/g, '').replace(/`([^`]+)`/g, '$1');
    return baseScenario(rule, {
      title: `Roster planning — ${rule.title}`,
      setting: 'Payroll configuration · applies across all rosters',
      timeline: [
        { time: 'Config', label: rule.title, detail: desc, accent: 'primary' },
        {
          time: 'Roster',
          label: 'Applied on import',
          detail: `When Sarah's fortnight is calculated, ${rule.constants?.[0] || 'this threshold'} is checked on every shift before hours are classified and capped.`,
          accent: 'muted',
        },
        {
          time: 'Pay run',
          label: 'Effect on pay',
          detail: `This constant gates engine behaviour — changing it changes classification, OT caps, or allowances for all staff at that site.`,
          accent: 'success',
        },
      ],
      outcome: `This threshold is baked into every pay calculation for disability support shifts.`,
      payNote: rule.awardRef ? `Award reference: ${rule.awardRef}` : undefined,
    });
  },

  'day-type'(rule) {
    const isHoliday = rule.id === 'R027';
    const isSat = rule.id === 'R024';
    const isSun = rule.id === 'R025';
    const date = isHoliday ? '26 Jan (Australia Day)' : isSat ? 'Saturday 12 Jul' : isSun ? 'Sunday 13 Jul' : 'Wednesday 9 Jul';
    return baseScenario(rule, {
      title: `Classifying ${date}`,
      participant: isHoliday ? PARTICIPANTS.noah : PARTICIPANTS.james,
      setting: `${date} · Brisbane local date`,
      timeline: [
        { time: '9:00 AM', label: 'Shift booked', detail: 'Personal care shift entered in the roster', accent: 'muted' },
        { time: date, label: rule.title, detail: rule.description.replace(/\*\*/g, '').replace(/`([^`]+)`/g, '$1'), accent: 'primary' },
        { time: 'Pay run', label: 'Day type locked', detail: 'Penalty rates follow the classified day type for the whole segment', accent: 'success' },
      ],
      outcome: `The engine assigns the correct day type before time-band and penalty logic runs.`,
      payNote: rule.awardRef ? `Award reference: ${rule.awardRef}` : undefined,
    });
  },

  'weekday-bands'(rule) {
    const evening = ['R034', 'R035'].includes(rule.id);
    const start = evening ? '2:00 PM' : '10:00 PM';
    const end = evening ? '9:00 PM' : '6:00 AM';
    return baseScenario(rule, {
      title: `${start} → ${end} weekday shift`,
      timeline: [
        { time: start, label: 'Clock on', detail: 'Support worker arrives at participant\'s home', accent: 'muted' },
        { time: end, label: 'Clock off', detail: rule.description.replace(/\*\*/g, '').replace(/`([^`]+)`/g, '$1'), accent: 'primary' },
        { time: 'Classification', label: rule.title, detail: 'Whole-shift banding applied for weekday penalty loading', accent: 'success' },
      ],
      outcome: `Shift band determines whether daytime, evening, or night penalty rates apply.`,
      payNote: rule.awardRef ? `Award reference: ${rule.awardRef}` : undefined,
    });
  },

  'cross-midnight'(rule) {
    return baseScenario(rule, {
      title: 'Overnight shift crossing midnight',
      participant: PARTICIPANTS.maya,
      setting: 'Monday 8:00 PM → Tuesday 4:00 AM',
      timeline: [
        { time: 'Mon 8:00 PM', label: 'Shift starts', detail: 'Evening personal care at SIL house', accent: 'muted' },
        { time: 'Midnight', label: 'Day boundary', detail: 'Calendar day changes — split rules evaluated', accent: 'warning' },
        { time: 'Tue 4:00 AM', label: 'Shift ends', detail: rule.description.replace(/\*\*/g, '').replace(/`([^`]+)`/g, '$1'), accent: 'primary' },
      ],
      outcome: `Cross-midnight logic splits or classifies hours so penalties match each calendar day and time band.`,
    });
  },

  sleepover(rule) {
    return baseScenario(rule, {
      title: 'SIL sleepover roster pattern',
      worker: WORKERS.pc,
      participant: PARTICIPANTS.maya,
      setting: 'Friday 10:00 PM → Saturday 8:00 AM · Sleepover shift',
      timeline: [
        { time: '10:00 PM', label: 'Sleepover begins', detail: 'Passive overnight support on-site', accent: 'muted' },
        { time: 'Overnight', label: 'Sleepover rules', detail: rule.description.replace(/\*\*/g, '').replace(/`([^`]+)`/g, '$1'), accent: 'primary' },
        { time: '8:00 AM', label: 'Handover', detail: 'Day shift may follow — follow-on window rules apply', accent: 'success' },
      ],
      outcome: `Sleepover-specific rules adjust active hours, allowances, and how the next shift is classified.`,
      payNote: rule.awardRef ? `Award reference: ${rule.awardRef}` : undefined,
    });
  },

  nursing(rule) {
    return baseScenario(rule, {
      title: 'Nursing support on a weekend',
      worker: WORKERS.nursing,
      participant: PARTICIPANTS.noah,
      setting: 'Saturday · Medication & clinical support',
      timeline: [
        { time: '8:00 AM', label: 'Nursing shift', detail: 'Lisa provides nursing support in the community', accent: 'muted' },
        { time: 'Classification', label: rule.title, detail: rule.description.replace(/\*\*/g, '').replace(/`([^`]+)`/g, '$1'), accent: 'primary' },
        { time: 'Pay run', label: 'Nursing ledger', detail: 'Hours tracked in nursing-specific buckets for correct rate card', accent: 'success' },
      ],
      outcome: `Nursing hours are separated from standard PC buckets for award-correct nursing rates.`,
    });
  },

  'broken-detection'(rule) {
    return baseScenario(rule, {
      title: 'Roster gap triggers broken-shift detection',
      participant: PARTICIPANTS.elena,
      setting: 'Same staff · Two shifts same day',
      timeline: [
        { time: 'Shift 1', label: 'Earlier shift ends', detail: 'Personal care or sleepover predecessor', accent: 'muted' },
        { time: 'Gap', label: 'Rest period', detail: rule.description.replace(/\*\*/g, '').replace(/`([^`]+)`/g, '$1'), accent: 'warning' },
        { time: 'Shift 2', label: 'Return shift', detail: 'isBrokenShift flag set on import if gap rule matches', accent: 'primary' },
      ],
      outcome: `Broken-shift detection runs per staff member in chronological order at import.`,
      payNote: rule.awardRef ? `Award reference: ${rule.awardRef}` : undefined,
    });
  },

  'broken-span'(rule) {
    return baseScenario(rule, {
      title: 'Building the broken-shift span',
      participant: PARTICIPANTS.elena,
      setting: 'Wednesday · Multiple shifts same staff',
      timeline: [
        { time: 'Morning', label: 'First shift', detail: 'Broken span walks backward through earlier shifts', accent: 'muted' },
        { time: 'Afternoon', label: 'Broken shift', detail: rule.description.replace(/\*\*/g, '').replace(/`([^`]+)`/g, '$1'), accent: 'primary' },
        { time: 'Calculation', label: 'Span collected', detail: 'Allowances and OT use the full span, not just the last shift', accent: 'success' },
      ],
      outcome: `The engine collects all shifts in the broken span before applying allowance and OT rules.`,
    });
  },

  'broken-allowances-ot'(rule) {
    return baseScenario(rule, {
      title: 'Broken shift with multiple unpaid breaks',
      participant: PARTICIPANTS.elena,
      setting: 'Long day · 3 shifts with short gaps',
      timeline: [
        { time: '6 AM', label: 'Shift 1', detail: 'Morning personal care', accent: 'muted' },
        { time: 'Gaps', label: 'Unpaid breaks', detail: rule.description.replace(/\*\*/g, '').replace(/`([^`]+)`/g, '$1'), accent: 'warning' },
        { time: '8 PM', label: 'Final shift', detail: 'Allowance tier and OT rules applied to the collected span', accent: 'primary' },
      ],
      outcome: `Broken-shift allowances and OT stack on the span according to gap count and total span hours.`,
      payNote: rule.awardRef ? `Award reference: ${rule.awardRef}` : undefined,
    });
  },

  'short-turnaround'(rule) {
    return baseScenario(rule, {
      title: 'Insufficient rest between rostered shifts',
      worker: WORKERS.casual,
      participant: PARTICIPANTS.james,
      setting: 'Night call-back after evening shift',
      timeline: [
        { time: '9:00 PM', label: 'First shift ends', detail: 'Evening support completed', accent: 'muted' },
        { time: 'Gap', label: 'Short rest', detail: rule.description.replace(/\*\*/g, '').replace(/`([^`]+)`/g, '$1'), accent: 'warning' },
        { time: 'Call-back', label: 'Second shift', detail: 'Not flagged as broken — inadequate rest triggers double time', accent: 'primary' },
      ],
      outcome: `Short turnaround pays all active hours at double time and suppresses conflicting OT rules.`,
      payNote: rule.awardRef ? `Award reference: ${rule.awardRef}` : undefined,
    });
  },

  'continuous-chains'(rule) {
    return baseScenario(rule, {
      title: 'Back-to-back shifts with zero gap',
      participant: PARTICIPANTS.james,
      setting: 'Monday · Morning PC flows into community access',
      timeline: [
        { time: '8:00 AM', label: 'Shift A → B', detail: 'No gap between consecutive shifts', accent: 'muted' },
        { time: 'Chain', label: rule.title, detail: rule.description.replace(/\*\*/g, '').replace(/`([^`]+)`/g, '$1'), accent: 'primary' },
        { time: 'OT check', label: 'Combined hours', detail: 'Daily OT assessed on total active hours across the chain', accent: 'success' },
      ],
      outcome: `Continuous chains combine hours for OT, retro loading, and meal allowances.`,
    });
  },

  'daily-ot'(rule) {
    return baseScenario(rule, {
      title: 'Single shift longer than 10 hours',
      worker: WORKERS.pc2,
      participant: PARTICIPANTS.maya,
      setting: 'Tuesday · Extended support day',
      timeline: [
        { time: '7:00 AM', label: 'Long shift', detail: '11.5 active hours in one continuous shift', accent: 'muted' },
        { time: '10h mark', label: 'Ordinary cap', detail: rule.description.replace(/\*\*/g, '').replace(/`([^`]+)`/g, '$1'), accent: 'warning' },
        { time: 'Pay', label: 'OT tiers', detail: '1.5× for first 2 OT hours, then 2× for remainder', accent: 'primary' },
      ],
      outcome: `Daily OT is tiered per day type when active hours exceed the 10-hour cap.`,
      payNote: rule.awardRef ? `Award reference: ${rule.awardRef}` : undefined,
    });
  },

  'fortnight-cap'(rule) {
    return baseScenario(rule, {
      title: 'Fortnightly hour accumulation',
      worker: WORKERS.pc2,
      participant: PARTICIPANTS.maya,
      setting: 'Pay fortnight · 76-hour ordinary cap',
      timeline: [
        { time: 'Week 1', label: 'Ordinary hours', detail: 'Daytime, evening, night, and penalty hours accumulate', accent: 'muted' },
        { time: 'Week 2', label: 'Approaching cap', detail: rule.description.replace(/\*\*/g, '').replace(/`([^`]+)`/g, '$1'), accent: 'warning' },
        { time: 'Cap breach', label: 'OT>76', detail: 'Excess ordinary hours reclassified from latest entries', accent: 'primary' },
      ],
      outcome: `Fortnightly ordinary hours are capped at 76; overflow becomes OT>76.`,
      payNote: rule.awardRef ? `Award reference: ${rule.awardRef}` : undefined,
    });
  },

  'ot76-tiers'(rule) {
    return baseScenario(rule, {
      title: 'Paying OT beyond the 76-hour cap',
      worker: WORKERS.pc2,
      participant: PARTICIPANTS.maya,
      setting: 'Fortnight close · 4h OT>76 to allocate',
      timeline: [
        { time: 'Excess', label: 'OT>76 hours', detail: 'Ordinary cap already exceeded this fortnight', accent: 'muted' },
        { time: 'Tiering', label: rule.title, detail: rule.description.replace(/\*\*/g, '').replace(/`([^`]+)`/g, '$1'), accent: 'primary' },
        { time: 'Payslip', label: 'Rate applied', detail: 'Weekday/Sat/Sun/PH each have distinct OT>76 treatment', accent: 'success' },
      ],
      outcome: `OT>76 hours are split into 1.5× and 2× tiers with a shared weekday+Saturday band.`,
      payNote: rule.awardRef ? `Award reference: ${rule.awardRef}` : undefined,
    });
  },

  'minimum-engagement'(rule) {
    return baseScenario(rule, {
      title: 'Short or linked personal care visits',
      worker: WORKERS.casual,
      participant: PARTICIPANTS.james,
      setting: 'Exception flagging · no auto top-up',
      timeline: [
        { time: 'Roster', label: 'Short shift', detail: 'Brief PC visit or sleepover-adjacent support', accent: 'muted' },
        { time: 'Review', label: rule.title, detail: rule.description.replace(/\*\*/g, '').replace(/`([^`]+)`/g, '$1'), accent: 'warning' },
        { time: 'Flag', label: 'Payroll review', detail: 'Exception surfaced for HR — hours not automatically increased', accent: 'primary' },
      ],
      outcome: `Minimum engagement rules flag exceptions for review rather than silently adjusting pay.`,
      payNote: rule.awardRef ? `Award reference: ${rule.awardRef}` : undefined,
    });
  },

  normalization(rule) {
    return baseScenario(rule, {
      title: 'Cleaning up imported roster data',
      setting: 'ShiftCare / timesheet import pipeline',
      timeline: [
        { time: 'Import', label: 'Raw shift row', detail: 'CSV hours, timestamps, or negative values arrive from export', accent: 'muted' },
        { time: 'Normalize', label: rule.title, detail: rule.description.replace(/\*\*/g, '').replace(/`([^`]+)`/g, '$1'), accent: 'primary' },
        { time: 'Calculate', label: 'Trusted hours', detail: 'Pay engine uses consistent 2dp hour values', accent: 'success' },
      ],
      outcome: `Data quality rules ensure pay is calculated from reliable hour values.`,
    });
  },

  'rate-card'(rule) {
    return baseScenario(rule, {
      title: 'Staff rate card → gross pay',
      worker: WORKERS.pc,
      setting: 'Fortnightly pay run · individual SCHADS rate card',
      timeline: [
        { time: 'Buckets', label: 'Classified hours', detail: 'Daytime, penalties, OT, nursing, allowances separated', accent: 'muted' },
        { time: 'Rates', label: rule.title, detail: rule.description.replace(/\*\*/g, '').replace(/`([^`]+)`/g, '$1'), accent: 'primary' },
        { time: 'Gross', label: 'Line items', detail: 'Each bucket multiplied by the staff member\'s rate card category', accent: 'success' },
      ],
      outcome: `Rate card calculation turns classified hours into dollar amounts on the payslip.`,
      payNote: rule.awardRef ? `Award reference: ${rule.awardRef}` : undefined,
    });
  },

  'multiplier-fallback'(rule) {
    return baseScenario(rule, {
      title: 'Fallback pay when no rate card category exists',
      worker: WORKERS.casual,
      setting: 'Manual estimate · multiplier-based gross',
      timeline: [
        { time: 'Hours', label: 'Classified buckets', detail: 'Engine has hours but needs a simple multiplier path', accent: 'muted' },
        { time: 'Mult', label: rule.title, detail: rule.description.replace(/\*\*/g, '').replace(/`([^`]+)`/g, '$1'), accent: 'primary' },
        { time: 'Estimate', label: 'Gross pay', detail: 'Base rate × award multiplier × hours', accent: 'success' },
      ],
      outcome: `Multiplier fallback provides gross estimates when detailed rate cards are unavailable.`,
      payNote: rule.awardRef ? `Award reference: ${rule.awardRef}` : undefined,
    });
  },

  'breakdown-lines'(rule) {
    return baseScenario(rule, {
      title: 'What appears on the pay breakdown',
      worker: WORKERS.pc,
      setting: 'Payslip / cost analysis display',
      timeline: [
        { time: 'Calc', label: 'Hour buckets', detail: 'Engine finishes classifying the fortnight', accent: 'muted' },
        { time: 'Display', label: rule.title, detail: rule.description.replace(/\*\*/g, '').replace(/`([^`]+)`/g, '$1'), accent: 'primary' },
        { time: 'Report', label: 'Readable lines', detail: 'Pay breakdown shows separate ordinary, penalty, OT, and allowance lines', accent: 'success' },
      ],
      outcome: `Breakdown lines translate internal buckets into human-readable payslip rows.`,
    });
  },

  aggregation(rule) {
    return baseScenario(rule, {
      title: 'Summing hours for dashboards and reports',
      worker: WORKERS.pc2,
      setting: 'Fortnight totals · staff & shift views',
      timeline: [
        { time: 'Per shift', label: 'Row hours', detail: 'Each shift row carries payable hour components', accent: 'muted' },
        { time: 'Roll-up', label: rule.title, detail: rule.description.replace(/\*\*/g, '').replace(/`([^`]+)`/g, '$1'), accent: 'primary' },
        { time: 'Dashboard', label: 'Totals shown', detail: 'Staff total hours and OT summaries feed reporting screens', accent: 'success' },
      ],
      outcome: `Aggregation rules define which buckets count toward displayed hour totals.`,
    });
  },

  timezone(rule) {
    return baseScenario(rule, {
      title: 'Brisbane roster with explicit timezone offset',
      setting: 'Queensland · UTC+10 (no DST)',
      timeline: [
        { time: 'Export', label: 'Shift timestamps', detail: 'ShiftCare provides UTC times + +10:00 offset', accent: 'muted' },
        { time: 'Local', label: rule.title, detail: rule.description.replace(/\*\*/g, '').replace(/`([^`]+)`/g, '$1'), accent: 'primary' },
        { time: 'Classify', label: 'Correct day', detail: 'Holiday and broken-shift same-day tests use local calendar date', accent: 'success' },
      ],
      outcome: `All day-type, band, and broken-shift logic respects the shift's local timezone.`,
    });
  },

  'out-of-scope'(rule) {
    return baseScenario(rule, {
      title: 'Known limitation in this calculator',
      setting: 'Rule engine scope boundary',
      timeline: [
        { time: 'Expectation', label: 'Award requirement', detail: 'Some award rules need manual payroll judgment', accent: 'muted' },
        { time: 'Engine', label: rule.title, detail: rule.description.replace(/\*\*/g, '').replace(/`([^`]+)`/g, '$1'), accent: 'warning' },
        { time: 'Action', label: 'Manual follow-up', detail: 'Payroll team handles outside the automated calculator', accent: 'primary' },
      ],
      outcome: `This rule is documented but not fully automated — review manually when it applies.`,
      payNote: rule.awardRef ? `Award reference: ${rule.awardRef}` : undefined,
    });
  },
};

/**
 * @param {{ id: string, category: string, title: string, description: string, awardRef?: string | null, constants?: string[] }} rule
 * @returns {RuleScenario}
 */
export function getScenarioForRule(rule) {
  if (SCENARIO_OVERRIDES[rule.id]) {
    return baseScenario(rule, SCENARIO_OVERRIDES[rule.id]);
  }
  const builder = CATEGORY_BUILDERS[rule.category];
  if (builder) return builder(rule);
  return baseScenario(rule, {
    title: rule.title,
    timeline: [
      {
        time: 'Scenario',
        label: rule.title,
        detail: rule.description.replace(/\*\*/g, '').replace(/`([^`]+)`/g, '$1'),
        accent: 'primary',
      },
    ],
  });
}

/**
 * @param {typeof import('./rulesCatalog.js').RULES_CATALOG} catalog
 */
export function attachScenariosToCatalog(catalog) {
  return catalog.map((rule) => ({
    ...rule,
    scenario: getScenarioForRule(rule),
  }));
}
