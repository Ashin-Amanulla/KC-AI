/**
 * Illustrative pay calculations and visual segments for rule scenarios.
 * Uses example SCHADS Level 2 base rate — not staff-specific.
 */

const BASE = 33.5;
const r2 = (n) => Math.round(n * 100) / 100;

/** @param {string} bucket @param {number} hours @param {number} mult @param {string} color */
function hourLine(bucket, hours, mult, color) {
  return { bucket, hours, mult, rate: BASE, amount: r2(hours * BASE * mult), color };
}

/** @param {string} label @param {number} amount @param {string} color */
function fixedLine(label, amount, color = 'allowance') {
  return { bucket: label, hours: null, mult: null, rate: null, amount, fixed: true, color };
}

function calcTotal(lines) {
  return r2(lines.reduce((s, l) => s + l.amount, 0));
}

function wrap(rule, partial, lines, steps, formula, note) {
  const total = calcTotal(lines);
  return {
    baseRate: BASE,
    formula: formula ?? 'gross = Σ (hours × base rate × multiplier) + allowances',
    steps,
    lines,
    total,
    note: note ?? `Illustrative · example Level 2 base $${BASE}/hr`,
    ...partial.payCalc,
  };
}

const CATEGORY_PAY = {
  constants(rule) {
    const lines =
      rule.id === 'R016' || rule.id === 'R017'
        ? [fixedLine(rule.id === 'R016' ? 'Broken allowance (1 break)' : 'Broken allowance (2 breaks)', rule.id === 'R016' ? 20.82 : 27.56)]
        : rule.id === 'R018'
          ? [fixedLine('Meal allowance', 16.62)]
          : [hourLine('Ordinary (up to cap)', 8, 1, 'daytime')];
    return wrap(
      rule,
      {},
      lines,
      [
        `Threshold: ${rule.title}`,
        `Engine applies ${rule.constants?.[0] || 'constant'} before pay buckets are finalised`,
        'Each classified hour is multiplied by base rate × award multiplier',
      ],
      rule.constants?.length ? `${rule.constants[0]} gates classification & caps` : undefined
    );
  },

  'day-type'(rule) {
    const map = {
      R024: { hours: 6, mult: 1.5, color: 'saturday', label: 'Saturday penalty' },
      R025: { hours: 6, mult: 2.0, color: 'sunday', label: 'Sunday penalty' },
      R027: { hours: 6, mult: 2.5, color: 'holiday', label: 'Public holiday' },
    };
    const d = map[rule.id] ?? { hours: 7, mult: 1.0, color: 'daytime', label: 'Weekday ordinary' };
    const lines = [hourLine(d.label, d.hours, d.mult, d.color)];
    return wrap(rule, {}, lines, [
      '1. Read shift local date → assign day type',
      `2. ${d.hours}h classified as ${d.label.toLowerCase()}`,
      `3. Pay = ${d.hours} × $${BASE} × ${d.mult}`,
    ]);
  },

  'weekday-bands'(rule) {
    const evening =
      rule.id === 'R032'
        ? { h: 5, mult: 1.15, color: 'night', label: 'Night' }
        : rule.id === 'R033'
          ? { h: 8, mult: 1.15, color: 'night', label: 'Night (cross-midnight)' }
          : rule.id === 'R034'
            ? { h: 7, mult: 1.125, color: 'evening', label: 'Evening (>8pm)' }
            : { h: 7, mult: 1.0, color: 'daytime', label: 'Daytime (≤8pm)' };
    const lines = [hourLine(evening.label, evening.h, evening.mult, evening.color)];
    return wrap(rule, {}, lines, [
      '1. Whole shift band assigned from start/end times',
      `2. ${evening.h}h → ${evening.label} bucket`,
      `3. Pay = ${evening.h} × $${BASE} × ${evening.mult}`,
    ]);
  },

  'cross-midnight'(rule) {
    const lines = [
      hourLine('Pre-midnight night', 4, 1.15, 'night'),
      hourLine('Post-midnight night', 4, 1.15, 'night'),
    ];
    return wrap(rule, {}, lines, [
      '1. Split shift at local midnight',
      '2. Each portion classified by day type + time band',
      '3. Sum both portions: 4h + 4h @ night 1.15×',
    ]);
  },

  sleepover(rule) {
    const lines = [
      { bucket: 'Sleepover (8h deducted)', hours: 0, mult: 0, rate: BASE, amount: 0, color: 'unpaid' },
      hourLine('Active excess', 2, 1.15, 'night'),
      fixedLine('Sleepover allowance', 90, 'allowance'),
    ];
    return wrap(rule, {}, lines, [
      '1. Total 10h sleepover − 8h deduction = 2h active',
      `2. Active 2h @ night 1.15× = $${r2(2 * BASE * 1.15)}`,
      '3. Add flat sleepover allowance $90/night',
    ]);
  },

  nursing(rule) {
    const lines = [hourLine('Nursing Saturday', 5, 1.5, 'saturday')];
    return wrap(rule, {}, lines, [
      '1. Nursing shift classified separately from PC',
      '2. Hours land in nursing ledger bucket',
      '3. Pay = nursing rate card category × hours',
    ], 'gross = nursing rate × hours (rate card) or base × multiplier');
  },

  'broken-detection'(rule) {
    return wrap(rule, {}, [hourLine('Shift 2 ordinary', 4, 1.0, 'daytime')], [
      '1. Gap detected → isBrokenShift = true',
      '2. Span rules collect earlier shifts',
      '3. Allowance & OT applied in next steps',
    ], 'Detection only — pay effect in span/allowance rules');
  },

  'broken-span'(rule) {
    return wrap(rule, {}, [hourLine('Span ordinary hours', 9, 1.0, 'daytime')], [
      '1. Walk backward to collect all shifts in span',
      '2. Sum active hours across span = 9h',
      '3. Allowance tier based on unpaid gaps in span',
    ]);
  },

  'broken-allowances-ot'(rule) {
    const lines = [
      hourLine('Span ordinary', 10, 1.0, 'daytime'),
      hourLine('Daily OT (span <12h)', 1.5, 1.5, 'ot1'),
      fixedLine('Broken allowance (1 break)', 20.82, 'allowance'),
    ];
    if (['R086', 'R087', 'R085'].includes(rule.id)) {
      lines[1] = hourLine('Last shift @ 2× (span ≥12h)', 4, 2.0, 'ot2');
    }
    return wrap(rule, {}, lines, [
      '1. Count unpaid gaps → allowance tier',
      '2. Span hours vs 10h daily cap → OT',
      ['R086', 'R087', 'R085'].includes(rule.id)
        ? '3. Span ≥12h → entire last shift @ 2×'
        : '3. Add broken allowance flat fee',
    ]);
  },

  'short-turnaround'(rule) {
    const lines = [hourLine('Short turnaround (2×)', 3, 2.0, 'ot2')];
    return wrap(rule, {}, lines, [
      '1. Gap < required break & not broken',
      '2. All 3 active hours → shortTurnaroundHours',
      `3. Pay = 3 × $${BASE} × 2.0 = $${r2(3 * BASE * 2)}`,
    ]);
  },

  'continuous-chains'(rule) {
    const lines = [
      hourLine('Chain ordinary', 10, 1.0, 'daytime'),
      hourLine('Chain OT ≤2h', 2, 1.5, 'ot1'),
      hourLine('Chain OT >2h', 1, 2.0, 'ot2'),
    ];
    return wrap(rule, {}, lines, [
      '1. Zero-gap shifts merged into chain',
      '2. Combined 13h active → 10h ord + 3h OT',
      '3. OT tiered: 2h @ 1.5× + 1h @ 2×',
    ]);
  },

  'daily-ot'(rule) {
    const lines = [
      hourLine('Ordinary', 10, 1.0, 'daytime'),
      hourLine('OT tier 1', 2, 1.5, 'ot1'),
      hourLine('OT tier 2', 0.5, 2.0, 'ot2'),
    ];
    return wrap(rule, {}, lines, [
      '1. Active hours 12.5h > 10h cap',
      '2. OT = 2.5h → first 2h @ 1.5×, rest @ 2×',
      '3. Pay each bucket separately',
    ]);
  },

  'fortnight-cap'(rule) {
    const lines = [
      hourLine('Ordinary (within 76h)', 76, 1.0, 'daytime'),
      hourLine('Reclassified OT>76', 2, 1.5, 'ot1'),
    ];
    return wrap(rule, {}, lines, [
      '1. Sum all ordinary buckets for fortnight = 78h',
      '2. Excess 2h deducted from latest entries',
      '3. OT>76 tier rules apply to excess',
    ]);
  },

  'ot76-tiers'(rule) {
    const lines = [
      hourLine('OT>76 WD @ 1.5×', 2, 1.5, 'ot1'),
      hourLine('OT>76 WD @ 2×', 2, 2.0, 'ot2'),
    ];
    return wrap(rule, {}, lines, [
      '1. Shared 2h global band for WD+Sat OT>76',
      '2. Weekday consumes band first',
      '3. Remainder @ 2×',
    ]);
  },

  'minimum-engagement'(rule) {
    const lines = [hourLine('Actual hours paid', 1.5, 1.0, 'daytime')];
    return wrap(
      rule,
      {},
      lines,
      [
        '1. Shift logged at 1.5h active',
        '2. Flag raised — award may require 2h minimum',
        '3. Engine pays actual hours; top-up is manual (R196)',
      ],
      'Flag only — no auto top-up yet'
    );
  },

  normalization(rule) {
    return wrap(rule, {}, [hourLine('Corrected hours', 7.5, 1.0, 'daytime')], [
      '1. CSV said 7.0h, timestamps show 7.5h',
      '2. Engine trusts timestamps (Δ > 0.05h)',
      `3. Pay = 7.5 × $${BASE} × multiplier`,
    ]);
  },

  'rate-card'(rule) {
    const lines = [hourLine('Rate card category', 6, 1.125, 'evening')];
    return wrap(
      rule,
      {},
      lines,
      [
        '1. Classified bucket mapped to staff rate card row',
        '2. evening rate from card (or base × 1.125 fallback)',
        '3. gross += hours × card rate',
      ],
      'gross = Σ (hours × staff rate card category)'
    );
  },

  'multiplier-fallback'(rule) {
    const mult =
      rule.id === 'R152' ? 1.125
      : rule.id === 'R153' ? 1.15
      : rule.id === 'R157' ? 2.0
      : rule.id === 'R158' ? 2.5
      : rule.id === 'R160' ? 2.0
      : 1.0;
    const lines = [hourLine(rule.title, 5, mult, mult > 1 ? 'evening' : 'daytime')];
    return wrap(rule, {}, lines, [
      '1. No rate card row — use multiplier fallback',
      `2. ${rule.title}: ${mult}× on base rate`,
      `3. Pay = 5 × $${BASE} × ${mult}`,
    ]);
  },

  'breakdown-lines'(rule) {
    const lines = [hourLine('Payslip line item', 4, 1.125, 'evening')];
    return wrap(rule, {}, lines, [
      '1. Internal bucket → display label',
      '2. Split base + penalty loading on payslip',
      '3. User sees readable breakdown row',
    ], 'Display mapping — same dollars as rate-card calc');
  },

  aggregation(rule) {
    return wrap(rule, {}, [hourLine('Counted in staffTotalHours', 40, 1.0, 'daytime')], [
      '1. Shift row hours summed per bucket',
      '2. Allowances excluded from hour totals',
      '3. Dashboard shows aggregated payable hours',
    ], 'Hours roll-up — not a separate pay step');
  },

  timezone(rule) {
    return wrap(rule, {}, [hourLine('Locally classified hours', 6, 1.0, 'daytime')], [
      '1. UTC timestamps + +10:00 offset → local time',
      '2. Local date drives PH & broken-shift tests',
      '3. Correct band/day type → correct multiplier',
    ]);
  },

  'out-of-scope'(rule) {
    return wrap(rule, {}, [], [
      '1. Rule documented but not auto-calculated',
      '2. Payroll handles manually outside engine',
      '3. No automated pay line generated',
    ], 'Out of scope — manual payroll step');
  },
};

const PAY_OVERRIDES = {
  R004: {
    lines: [hourLine('Ordinary', 10, 1.0, 'daytime'), hourLine('Would-be OT', 1, 1.5, 'ot1')],
    steps: ['1. 10h active hits daily cap', '2. Hour 11+ → OT tiers', '3. Cap constant = MAX_REGULAR_HOURS'],
  },
  R046: {
    lines: [
      { bucket: 'Deducted (non-billable)', hours: 8, mult: 0, rate: 0, amount: 0, color: 'unpaid' },
      hourLine('Active night', 2, 1.15, 'night'),
      fixedLine('Sleepover allowance', 90, 'allowance'),
    ],
    steps: ['1. 10h roster − 8h = 2h active', '2. 2h @ 1.15× night', '3. + $90 allowance'],
    total: r2(2 * BASE * 1.15 + 90),
  },
  R069: {
    lines: [hourLine('Shift 2 ordinary', 4, 1.0, 'daytime'), fixedLine('Broken allowance (1 break)', 20.82, 'allowance')],
    steps: ['1. 3h gap after PC → broken', '2. Pay shift hours ordinarily', '3. + $20.82 broken allowance'],
  },
  R092: {
    lines: [hourLine('Call-back @ 2×', 2.5, 2.0, 'ot2')],
    steps: ['1. 6h rest < 10h required', '2. 2.5h → shortTurnaroundHours', `3. Pay = 2.5 × $${BASE} × 2`],
  },
  R098: {
    lines: [hourLine('Chain ordinary', 10, 1.0, 'daytime'), hourLine('Chain OT', 3, 1.5, 'ot1')],
    steps: ['1. 0-gap chain = 13h combined', '2. 10h ord + 3h OT', '3. Retro loading if ends after 8pm'],
  },
  R112: {
    lines: [hourLine('Ordinary (76h cap)', 76, 1.0, 'daytime'), hourLine('OT>76', 2, 1.5, 'ot1')],
    steps: ['1. Fortnight ordinary = 78h', '2. 2h excess → OT>76', '3. Latest shifts reduced first'],
  },
  R125: {
    lines: [hourLine('Paid (actual)', 1.5, 1.0, 'daytime')],
    steps: ['1. Only 1.5h worked', '2. Flag for 2h minimum review', '3. Pays actual — no auto top-up'],
    formula: 'pay = actual hours × rate (flag for minimum review)',
  },
  R133: {
    lines: [hourLine('Corrected from timestamps', 7.5, 1.0, 'daytime')],
    steps: ['1. CSV 7.0h ignored', '2. Timestamps → 7.5h', `3. Pay = 7.5 × $${BASE}`],
  },
};

/** @param {object} payCalc @param {object[]} timeline */
export function buildVisualFromPayCalc(payCalc, timeline = []) {
  const shiftBar = (payCalc.lines ?? [])
    .filter((l) => (l.hours > 0) || l.fixed)
    .map((l) => ({
      label: l.bucket,
      hours: l.fixed ? null : l.hours,
      color: l.color ?? 'daytime',
      fixed: Boolean(l.fixed),
      amount: l.fixed ? l.amount : null,
    }));

  if (!shiftBar.length && timeline.length) {
    return {
      shiftBar: timeline.map((t) => ({
        label: t.label,
        hours: 1,
        color: t.accent === 'warning' ? 'ot1' : t.accent === 'primary' ? 'evening' : 'daytime',
      })),
      flow: ['classify', 'bucket', 'multiply', 'total'],
    };
  }

  return { shiftBar, flow: ['classify', 'bucket', 'multiply', 'total'] };
}

/**
 * @param {{ id: string, category: string, title: string }} rule
 * @param {object} partial
 */
export function buildPayCalcForRule(rule, partial = {}) {
  if (partial.payCalc) return partial.payCalc;
  if (PAY_OVERRIDES[rule.id]) {
    const o = PAY_OVERRIDES[rule.id];
    const lines = o.lines ?? [];
    return {
      baseRate: BASE,
      formula: o.formula ?? 'gross = Σ (hours × base rate × multiplier) + allowances',
      steps: o.steps ?? [],
      lines,
      total: o.total ?? calcTotal(lines),
      note: `Illustrative · example Level 2 base $${BASE}/hr`,
    };
  }
  const builder = CATEGORY_PAY[rule.category];
  if (builder) return builder(rule);
  return wrap(rule, {}, [hourLine('Ordinary', 6, 1.0, 'daytime')], [
    '1. Classify shift hours',
    '2. Apply award multiplier',
    '3. Multiply by base rate',
  ]);
}
