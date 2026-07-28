/**
 * Client SCHADS SOP — distilled from KC test checklist (sections A–P) and TC cases.
 * Static reference for the Rule Engine SOP tab.
 */
export const CLIENT_SOP_SECTIONS = [
  {
    id: 'time-bands',
    title: 'Time Bands & Boundaries',
    rules: [
      'Weekday bands: Morning 06:00–20:00, Afternoon 20:00–00:00, Night 00:00–06:00 (local).',
      'Start exactly 06:00 → Morning. End exactly 20:00 → Morning only (no Afternoon escalation).',
      'Start exactly 20:00 → Afternoon. Crosses a higher band → entire shift at the highest band (weekdays only).',
    ],
    examples: [
      { caseId: 'A-01', ruleIds: ['R031', 'R032'], when: 'Mon 08:00–16:00', expect: 'Morning 100%' },
      { caseId: 'A-02', ruleIds: ['R031'], when: 'Starts exactly 06:00', expect: 'Morning rate' },
      { caseId: 'A-03', ruleIds: ['R033'], when: 'Ends exactly 20:00', expect: 'Morning only — no Afternoon' },
      { caseId: 'A-04', ruleIds: ['R036'], when: 'Mon 14:00–22:00', expect: 'Entire shift Afternoon' },
    ],
  },
  {
    id: 'escalation',
    title: 'Shift Escalation (Weekdays)',
    rules: [
      'Weekday only: if a shift crosses Morning→Afternoon or into Night, pay the entire shift at the highest band reached.',
      'Weekends and public holidays do not escalate — Saturday 150%, Sunday 200%, PH 250% flat.',
    ],
    examples: [
      { caseId: 'B-02', ruleIds: ['R036', 'R037'], when: 'Tue 18:00–Wed 02:00 continuous', expect: 'Entire shift Night' },
      { caseId: 'B-05', ruleIds: ['R024'], when: 'Sat 14:00–22:00', expect: 'Saturday 150% all hours' },
      { caseId: 'B-06', ruleIds: ['R025'], when: 'Sun 18:00–22:00', expect: 'Sunday 200% all hours' },
    ],
  },
  {
    id: 'daily-ot',
    title: 'Daily Overtime',
    rules: [
      'After 10 active hours in a shift (or continuous chain): first 2h OT at 1.5×, further OT at 2×.',
      'Sunday daily OT stays at 200% (no tier escalation). PH overrides — all hours at 250%.',
    ],
    examples: [
      { caseId: 'C-02', ruleIds: ['R004', 'R005'], when: '11h weekday shift', expect: '10 ord + 1h @ 1.5×' },
      { caseId: 'C-03', ruleIds: ['R004', 'R005'], when: '13h weekday shift', expect: '10 ord + 2h @ 1.5× + 1h @ 2×' },
      { caseId: 'C-05', ruleIds: ['R025'], when: 'Sun 12h', expect: 'All 12h @ 200%' },
    ],
  },
  {
    id: 'fortnight-ot',
    title: 'Fortnightly OT (>76h)',
    rules: [
      'Ordinary hours cap at 76h per fortnight; excess reclassified OT>76 from latest shifts first.',
      'Global 1.5× band: first 2h total across weekday + Saturday OT>76, then 2×.',
    ],
    examples: [
      { caseId: 'C-08', ruleIds: ['R006', 'R023'], when: '77th hour on weekday', expect: 'Last hour at 1.5× OT>76' },
    ],
  },
  {
    id: 'midnight',
    title: 'Midnight Crossover',
    rules: [
      'Weekday→weekday overnight (no PH): continuous — highest band (usually Night) for full shift.',
      'Crossing Sat/Sun/PH at midnight: SPLIT — each calendar day keeps its own rate; step-down after premium day.',
    ],
    examples: [
      { caseId: 'F-01', ruleIds: ['R098', 'R101'], when: 'Mon 22:00–Tue 06:00', expect: 'Continuous Weekday Night' },
      { caseId: 'F-05', ruleIds: ['R041'], when: 'Sun 22:00–Mon 06:00', expect: 'SPLIT: Sun 200% to midnight, Mon Night step-down' },
      { caseId: 'E-04', ruleIds: ['R027', 'R041'], when: 'Sun 22:00–PH Mon 06:00', expect: 'SPLIT: Sun 200% + PH 250%' },
    ],
  },
  {
    id: 'broken-shifts',
    title: 'Broken Shifts',
    rules: [
      'Each work period keeps its own time band — never retro-load the whole span to the final band.',
      'Span clock > 12h from first start: worked time after the 12h mark at 2×; overlaps daily OT upgrade to 2×.',
      'Span ≤ 12h with active > 10h: standard daily OT tiering on combined active hours.',
      'Allowances: 1 unpaid break $20.82, 2+ breaks $27.56.',
    ],
    examples: [
      { caseId: 'G-02b', ruleIds: ['R086', 'R085'], when: 'Span 13h, break 14:00', expect: '1h after 12h mark @ 2×' },
      { caseId: 'G-05b', ruleIds: ['R087', 'R085'], when: 'Span exactly 12h, 11h worked', expect: '1h daily OT @ 1.5×, no span-DT' },
      { caseId: 'G-06b', ruleIds: ['R086', 'R087'], when: 'Span 13h from 20:00', expect: '1h @ 2× (span-DT + daily OT overlap)' },
      { caseId: 'O-01b', ruleIds: ['R081'], when: '1-break broken shift', expect: 'Allowance $20.82' },
    ],
  },
  {
    id: 'sleepovers',
    title: 'Sleepovers',
    rules: [
      'Sleepover: flat allowance; 8h deducted from billable hours.',
      'Attached active PC (before OR after): ≥ 4h on at least one side → no 4h flags; otherwise flag non-compliant sides.',
      'Gap 0 < break < 8h before sleepover → pre-sleepover insufficient break flag.',
    ],
    examples: [
      { caseId: 'K-04', ruleIds: ['R130'], when: 'Pre-sleepover PC exactly 4h', expect: 'No 4h flag' },
      { caseId: 'K-05', ruleIds: ['R127', 'R130'], when: 'Pre-sleepover PC 1.5h', expect: 'Min 2h + Min 4h flags' },
      { caseId: 'I-07b', ruleIds: ['R199'], when: 'Only 1h gap before sleepover', expect: 'Pre-SO break flag' },
    ],
  },
  {
    id: 'minimums',
    title: 'Minimums & Allowances',
    rules: [
      'PC work period < 2h → minimum engagement flag (no auto top-up — admin adjusts).',
      'Daily OT > 1h → first meal allowance; > 4h → second meal allowance.',
      'Casual loading: rate × (penalty mult / 1.25 + 0.2).',
    ],
    examples: [
      { caseId: 'K-01', ruleIds: ['R132'], when: 'PC 1h45m alone', expect: 'Flag only — pay raw hours' },
      { caseId: 'P-03', ruleIds: ['R088'], when: 'OT 1h 5min', expect: 'First meal allowance' },
      { caseId: 'M-01', ruleIds: ['R149'], when: 'Casual 8h morning', expect: '$36.23/hr effective' },
    ],
  },
];

export function getClientSopGuide() {
  return { sections: CLIENT_SOP_SECTIONS };
}
