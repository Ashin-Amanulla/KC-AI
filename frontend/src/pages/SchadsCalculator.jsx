import { useState, useMemo, useCallback } from 'react';
import { ChevronDown, ChevronUp, Plus, X, AlertCircle } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '../ui/card';
import { Button } from '../ui/button';
import { Input } from '../ui/input';
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from '../ui/table';
import { usePayHours } from '../api/payHours';
import { LoadingScreen } from '../ui/LoadingSpinner';

// ── SCHADS Award Constants (MA000100, effective 01/07/2024) ──────────
const DAILY_ORD          = 7.6;
const WEEKLY_ORD         = 38.0;
const OT_BRACKET         = { pt: 2.0, ft: 3.0 };
const BROKEN_ALLOWANCE_1 = 20.82;   // 1 break per broken shift
const BROKEN_ALLOWANCE_2 = 27.56;   // 2 breaks per broken shift
const MEAL_ALLOWANCE     = 16.62;   // per qualifying OT meal break

// ── Formatting ───────────────────────────────────────────────────────
const fmt  = (n) => '$' + n.toFixed(2).replace(/\B(?=(\d{3})+(?!\d))/g, ',');
const r2   = (n) => Math.round(n * 100) / 100;
const fmtH = (n) => n.toFixed(2) + 'h';

// ── Casual pay: (base × mult) + loading, where base = rate/1.25, loading = rate×0.2
// Effective per-hour rate at multiplier M = rate × (M/1.25 + 0.2)
const casualEff = (rate, mult) => rate * (mult / 1.25 + 0.2);

// ── Gross pay (permanent or casual) ─────────────────────────────────
function calcGross(ph, baseRate, empType = 'permanent') {
  const rate = parseFloat(baseRate);
  if (!rate || rate <= 0) return null;

  const sunAll = (ph.sundayHours||0) + (ph.sundayOtUpto2||0) + (ph.sundayOtAfter2||0);
  const holAll = (ph.holidayHours||0) + (ph.holidayOtUpto2||0) + (ph.holidayOtAfter2||0);

  // OT>76 split by day type — correct rates per SCHADS rules
  const ot76Wd  = ph.otAfter76Weekday  || 0;  // weekday: 1.5× first 2h, 2× after
  const ot76Sat = ph.otAfter76Saturday || 0;  // Sat: 1.5× first 2h, 2× after
  const ot76Sun = ph.otAfter76Sunday   || 0;  // Sun: 2.0× flat
  const ot76Hol = ph.otAfter76Holiday  || 0;  // PH:  2.5× flat

  // Weekday OT>76: apply first 2h at 1.5×, rest at 2×
  const ot76WdT1 = r2(Math.min(ot76Wd, 2));
  const ot76WdT2 = r2(Math.max(0, ot76Wd - 2));
  // Saturday OT>76: same bracket structure
  const ot76SatT1 = r2(Math.min(ot76Sat, 2));
  const ot76SatT2 = r2(Math.max(0, ot76Sat - 2));

  let pay = 0;
  if (empType === 'casual') {
    const ce = (m) => casualEff(rate, m);
    pay =
      (ph.morningHours     || 0) * ce(1.0)   +
      (ph.afternoonHours   || 0) * ce(1.125)  +
      (ph.nightHours       || 0) * ce(1.15)   +
      (ph.weekdayOtUpto2   || 0) * ce(1.5)    +
      (ph.weekdayOtAfter2  || 0) * ce(2.0)    +
      (ph.saturdayHours    || 0) * ce(1.5)    +
      (ph.saturdayOtUpto2  || 0) * ce(1.5)    +
      (ph.saturdayOtAfter2 || 0) * ce(2.0)    +
      sunAll                     * ce(2.0)    +
      holAll                     * ce(2.5)    +
      (ph.nursingCareHours || 0) * ce(1.0)    +
      // OT>76 by day type — correct rates
      ot76WdT1                   * ce(1.5)    +
      ot76WdT2                   * ce(2.0)    +
      ot76SatT1                  * ce(1.5)    +
      ot76SatT2                  * ce(2.0)    +
      ot76Sun                    * ce(2.0)    +
      ot76Hol                    * ce(2.5);
  } else {
    pay = rate * (
      (ph.morningHours     || 0) * 1.0  +
      (ph.afternoonHours   || 0) * 1.0  +
      (ph.nightHours       || 0) * 1.0  +
      (ph.weekdayOtUpto2   || 0) * 1.5  +
      (ph.weekdayOtAfter2  || 0) * 2.0  +
      (ph.saturdayHours    || 0) * 1.5  +
      (ph.saturdayOtUpto2  || 0) * 1.5  +
      (ph.saturdayOtAfter2 || 0) * 2.0  +
      sunAll                     * 2.0  +
      holAll                     * 2.5  +
      (ph.nursingCareHours || 0) * 1.0  +
      // OT>76 by day type — correct rates
      ot76WdT1                   * 1.5  +
      ot76WdT2                   * 2.0  +
      ot76SatT1                  * 1.5  +
      ot76SatT2                  * 2.0  +
      ot76Sun                    * 2.0  +
      ot76Hol                    * 2.5
    );
  }

  return r2(pay + calcAllowances(ph).total);
}

// ── Allowances ────────────────────────────────────────────────────────
function calcAllowances(ph) {
  const broken = ph.brokenShiftCount || 0;
  // Treat each broken shift as 1 break ($20.82); 2-break shifts ($27.56) not tracked per-shift
  const brokenAllow = r2(broken * BROKEN_ALLOWANCE_1);

  // Meal allowance approximated from total OT (per-shift detail not available at summary level)
  const totOT = r2(
    (ph.weekdayOtUpto2||0) + (ph.weekdayOtAfter2||0) +
    (ph.saturdayOtUpto2||0) + (ph.saturdayOtAfter2||0) +
    (ph.sundayOtUpto2||0) + (ph.sundayOtAfter2||0) +
    (ph.holidayOtUpto2||0) + (ph.holidayOtAfter2||0)
  );
  const mealAllow = totOT > 4 ? r2(MEAL_ALLOWANCE * 2) : totOT > 1 ? MEAL_ALLOWANCE : 0;

  return { brokenAllow, mealAllow, total: r2(brokenAllow + mealAllow) };
}

function staffTotalHours(ph) {
  return r2(
    (ph.morningHours||0)+(ph.afternoonHours||0)+(ph.nightHours||0)+
    (ph.weekdayOtUpto2||0)+(ph.weekdayOtAfter2||0)+
    (ph.saturdayHours||0)+(ph.saturdayOtUpto2||0)+(ph.saturdayOtAfter2||0)+
    (ph.sundayHours||0)+(ph.sundayOtUpto2||0)+(ph.sundayOtAfter2||0)+
    (ph.holidayHours||0)+(ph.holidayOtUpto2||0)+(ph.holidayOtAfter2||0)+
    (ph.nursingCareHours||0)
  );
}

function totalOtHrs(ph) {
  return r2(
    (ph.weekdayOtUpto2||0)+(ph.weekdayOtAfter2||0)+
    (ph.saturdayOtUpto2||0)+(ph.saturdayOtAfter2||0)+
    (ph.sundayOtUpto2||0)+(ph.sundayOtAfter2||0)+
    (ph.holidayOtUpto2||0)+(ph.holidayOtAfter2||0)
  );
}

// ── Manual calculator helpers ─────────────────────────────────────────
const DAYS_CFG = [
  { name: 'Monday',    short: 'MON', type: 'weekday' },
  { name: 'Tuesday',   short: 'TUE', type: 'weekday' },
  { name: 'Wednesday', short: 'WED', type: 'weekday' },
  { name: 'Thursday',  short: 'THU', type: 'weekday' },
  { name: 'Friday',    short: 'FRI', type: 'weekday' },
  { name: 'Saturday',  short: 'SAT', type: 'saturday' },
  { name: 'Sunday',    short: 'SUN', type: 'sunday'   },
];

const MANUAL_RATES = { weekday: 1.00, saturday: 1.50, sunday: 2.00, ph: 2.50 };

let _segId = 0;
const newSeg = (start = '', end = '') => ({ id: `s${++_segId}`, start, end });

const toMins  = (t) => { const [h, m] = t.split(':').map(Number); return h * 60 + m; };
const fmtMins = (m) => { const h = Math.floor(m / 60), mn = m % 60; return mn ? `${h}h ${mn}m` : `${h}h`; };
const segH    = (s)  => { if (!s.start || !s.end) return null; const e = toMins(s.end), st = toMins(s.start); return e > st ? (e - st) / 60 : null; };

function hasOverlap(segments) {
  const v = segments.filter(s => segH(s) !== null);
  for (let i = 0; i < v.length; i++) for (let j = i + 1; j < v.length; j++) {
    if (toMins(v[i].start) < toMins(v[j].end) && toMins(v[j].start) < toMins(v[i].end)) return true;
  }
  return false;
}

function computeManual(baseRate, empType, days) {
  const otBracket = empType === 'ft' ? 3.0 : 2.0;
  let allShifts = [];
  for (let di = 0; di < 7; di++) {
    const { isPH, segments } = days[di];
    const valid = segments.filter(s => segH(s) !== null);
    if (!valid.length) continue;
    valid.forEach(seg => allShifts.push({
      di, dayName: DAYS_CFG[di].name,
      dayType: isPH ? 'ph' : DAYS_CFG[di].type,
      seg: { start: toMins(seg.start), end: toMins(seg.end), hours: segH(seg), label: `${seg.start}–${seg.end}` },
    }));
  }
  if (!allShifts.length) return null;
  allShifts.sort((a, b) => a.di - b.di || a.seg.start - b.seg.start);

  let weeklyOrdWorked = 0, basePay = 0, penaltyExtra = 0, otPay = 0, totalOtHours = 0;
  const tableRows = [], dailyOrdWorked = {}, dailyOtAccrued = {};

  for (const { di, dayName, dayType, seg } of allShifts) {
    if (!dailyOrdWorked[di]) dailyOrdWorked[di] = 0;
    if (!dailyOtAccrued[di]) dailyOtAccrued[di] = 0;
    const ordChunk = Math.min(seg.hours, Math.max(0, DAILY_ORD - dailyOrdWorked[di]), Math.max(0, WEEKLY_ORD - weeklyOrdWorked));
    const otChunk  = seg.hours - ordChunk;
    const rate     = MANUAL_RATES[dayType] || 1.0;
    const tdCls    = dayType === 'ph' ? 'ph' : dayType === 'saturday' ? 'sat' : dayType === 'sunday' ? 'sun' : '';

    if (ordChunk > 0) {
      const gross = baseRate * rate * ordChunk;
      basePay      += baseRate * ordChunk;
      penaltyExtra += (rate - 1.0) * baseRate * ordChunk;
      dailyOrdWorked[di]  += ordChunk;
      weeklyOrdWorked     += ordChunk;
      const rLabel = dayType === 'ph' ? '2.50× PH' : dayType === 'saturday' ? '1.50× SAT' : dayType === 'sunday' ? '2.00× SUN' : '1.00× ORD';
      tableRows.push({ dayName, segLabel: seg.label, hours: ordChunk, type: rLabel, cls: tdCls, pay: gross });
    }
    if (otChunk > 0) {
      totalOtHours += otChunk;
      let rem = otChunk;
      if (dayType === 'ph') {
        const pay = baseRate * 2.5 * rem;
        otPay += pay;
        tableRows.push({ dayName, segLabel: seg.label + ' OT', hours: rem, type: '2.50× PH OT', cls: 'ph ot', pay });
      } else {
        const firstLeft = Math.max(0, otBracket - dailyOtAccrued[di]);
        const first = Math.min(rem, firstLeft);
        if (first > 0) { const pay = baseRate * OT_1 * first; otPay += pay; tableRows.push({ dayName, segLabel: seg.label + ' OT', hours: first, type: `1.50× OT (first ${otBracket}h)`, cls: 'ot', pay }); dailyOtAccrued[di] += first; rem -= first; }
        if (rem > 0) { const pay = baseRate * OT_2 * rem; otPay += pay; tableRows.push({ dayName, segLabel: seg.label + ' OT', hours: rem, type: '2.00× OT (after bracket)', cls: 'ot', pay }); dailyOtAccrued[di] += rem; }
      }
    }
  }

  let brokenDays = 0;
  for (let di = 0; di < 7; di++) if (days[di].segments.filter(s => segH(s) !== null).length > 1) brokenDays++;
  const allowances = brokenDays * BROKEN_ALLOWANCE_1;
  if (allowances > 0) tableRows.push({ dayName: '—', segLabel: 'Broken shift allowance', hours: null, type: `$${BROKEN_ALLOWANCE_1}/shift × ${brokenDays}`, cls: 'allow', pay: allowances, isAllow: true });

  const totalHours = allShifts.reduce((a, s) => a + s.seg.hours, 0);
  const ordHours   = totalHours - totalOtHours;
  const gross      = basePay + penaltyExtra + otPay + allowances;
  return { gross, basePay, penaltyExtra, otPay, allowances, totalHours, ordHours, totalOtHours, tableRows };
}

const ROW_CLS = { sat: 'text-purple-700', sun: 'text-red-600', ph: 'text-blue-700', ot: 'text-orange-600', allow: 'text-amber-700' };
function rowClass(cls) { if (!cls) return ''; for (const c of cls.split(' ')) if (ROW_CLS[c]) return ROW_CLS[c]; return ''; }
function pillCls(type, isPH) {
  if (isPH) return 'border-blue-400 text-blue-700 bg-blue-50';
  if (type === 'saturday') return 'border-purple-400 text-purple-700 bg-purple-50';
  if (type === 'sunday')   return 'border-red-400 text-red-600 bg-red-50';
  return 'border-border text-muted-foreground bg-background';
}

// ════════════════════════════════════════════════════════════════════
// Main Component
// ════════════════════════════════════════════════════════════════════
export const SchadsCalculator = () => {
  const [view, setView] = useState('summary'); // 'summary' | 'manual'

  // ── Staff Summary state ──────────────────────────────────────────
  const [baseRates, setBaseRates] = useState({});       // { staffName: string }
  const [defaultRate, setDefaultRate] = useState('');
  const [empTypes, setEmpTypes] = useState({});          // { staffName: 'permanent' | 'casual' }
  const [defaultEmpType, setDefaultEmpType] = useState('permanent');

  // ── Fetch computed pay hours from backend ────────────────────────
  const { data: payHoursData, isLoading: phLoading, error: phError } = usePayHours({});
  const staffRows = (payHoursData?.payHours || []).slice().sort((a, b) => a.staffName.localeCompare(b.staffName));

  const getEmpType = useCallback((staffName) => empTypes[staffName] ?? defaultEmpType, [empTypes, defaultEmpType]);

  // Totals row
  const totals = useMemo(() => {
    const COLS = ['morningHours','afternoonHours','nightHours','weekdayOtUpto2','weekdayOtAfter2',
      'saturdayHours','saturdayOtUpto2','saturdayOtAfter2','sundayHours','sundayOtUpto2','sundayOtAfter2',
      'holidayHours','holidayOtUpto2','holidayOtAfter2','nursingCareHours','brokenShiftCount','sleepoversCount',
      'otAfter76Hours'];
    const t = Object.fromEntries(COLS.map(c => [c, 0]));
    t.totalHours = 0; t.gross = 0; t.brokenAllow = 0; t.mealAllow = 0; t.totalOT = 0;
    let grossCount = 0;
    for (const row of staffRows) {
      for (const col of COLS) t[col] = r2((t[col] || 0) + (row[col] || 0));
      t.totalHours = r2(t.totalHours + staffTotalHours(row));
      t.totalOT    = r2(t.totalOT    + totalOtHrs(row));
      const allow = calcAllowances(row);
      t.brokenAllow = r2(t.brokenAllow + allow.brokenAllow);
      t.mealAllow   = r2(t.mealAllow   + allow.mealAllow);
      const rate = baseRates[row.staffName] ?? defaultRate;
      const empT = empTypes[row.staffName] ?? defaultEmpType;
      const g = calcGross(row, rate, empT);
      if (g !== null) { t.gross = r2(t.gross + g); grossCount++; }
    }
    return { ...t, grossReady: staffRows.length > 0 && grossCount === staffRows.length };
  }, [staffRows, baseRates, defaultRate, empTypes, defaultEmpType]);

  const setRate = useCallback((staffName, val) => {
    setBaseRates(prev => ({ ...prev, [staffName]: val }));
  }, []);

  const setEmpType = useCallback((staffName, val) => {
    setEmpTypes(prev => ({ ...prev, [staffName]: val }));
  }, []);

  const applyDefault = useCallback(() => {
    const ratePatch = {};
    const typePatch = {};
    for (const row of staffRows) {
      if (defaultRate) ratePatch[row.staffName] = defaultRate;
      typePatch[row.staffName] = defaultEmpType;
    }
    if (defaultRate) setBaseRates(prev => ({ ...prev, ...ratePatch }));
    setEmpTypes(prev => ({ ...prev, ...typePatch }));
  }, [defaultRate, defaultEmpType, staffRows]);

  // ── Manual calculator state ──────────────────────────────────────
  const [manualRate, setManualRate]     = useState('');
  const [manualRateErr, setManualRateErr] = useState(false);
  const [manualEmpType, setManualEmpType] = useState('pt');
  const [manualDays, setManualDays]     = useState(() =>
    Array(7).fill(null).map(() => ({ open: false, isPH: false, segments: [] }))
  );
  const [manualResults, setManualResults] = useState(null);

  const updateManualDay = useCallback((di, patch) =>
    setManualDays(prev => prev.map((d, i) => i === di ? { ...d, ...patch } : d)), []);
  const addManualSeg = useCallback((di) =>
    setManualDays(prev => prev.map((d, i) => i !== di ? d : { ...d, open: true, segments: [...d.segments, newSeg()] })), []);
  const removeManualSeg = useCallback((di, id) =>
    setManualDays(prev => prev.map((d, i) => i !== di ? d : { ...d, segments: d.segments.filter(s => s.id !== id) })), []);
  const updateManualSeg = useCallback((di, id, field, val) =>
    setManualDays(prev => prev.map((d, i) => i !== di ? d : { ...d, segments: d.segments.map(s => s.id === id ? { ...s, [field]: val } : s) })), []);
  const toggleManualDay = useCallback((di) =>
    setManualDays(prev => prev.map((d, i) => {
      if (i !== di) return d;
      const open = !d.open;
      return { ...d, open, segments: open && d.segments.length === 0 ? [newSeg()] : d.segments };
    })), []);

  const runManual = useCallback(() => {
    const n = parseFloat(manualRate);
    const bad = !n || n < 10 || n > 200;
    setManualRateErr(bad);
    if (bad) return;
    if (manualDays.some(d => hasOverlap(d.segments))) { alert('Overlapping shift times. Please fix before calculating.'); return; }
    const r = computeManual(n, manualEmpType, manualDays);
    if (!r) { alert('Please enter at least one shift.'); return; }
    setManualResults(r);
  }, [manualRate, manualEmpType, manualDays]);

  const isLoading = phLoading;

  // ════════════════════════════════════════════════════════════════
  // Render
  // ════════════════════════════════════════════════════════════════
  return (
    <div className="space-y-4">
      {/* View toggle */}
      <div className="flex gap-2">
        <Button size="sm" variant={view === 'summary' ? 'default' : 'outline'} onClick={() => setView('summary')}>Staff Pay Summary</Button>
        <Button size="sm" variant={view === 'manual'  ? 'default' : 'outline'} onClick={() => setView('manual')}>Manual Scenario</Button>
      </div>

      {/* ── STAFF SUMMARY ──────────────────────────────────────── */}
      {view === 'summary' && (
        <>
          {/* Controls */}
          <Card>
            <CardContent className="pt-4">
              <div className="flex flex-wrap gap-4 items-end">
                <div className="space-y-1">
                  <label className="text-xs uppercase tracking-wider text-muted-foreground">Default Employment Type</label>
                  <select
                    value={defaultEmpType}
                    onChange={e => setDefaultEmpType(e.target.value)}
                    className="flex h-9 rounded-md border border-input bg-background px-3 py-1 text-sm focus:outline-none focus:ring-2 focus:ring-ring"
                  >
                    <option value="permanent">Permanent / Part-time</option>
                    <option value="casual">Casual (+25% loading)</option>
                  </select>
                </div>
                <div className="space-y-1">
                  <label className="text-xs uppercase tracking-wider text-muted-foreground">Default Base Rate ($)</label>
                  <div className="flex gap-2">
                    <Input
                      type="number"
                      placeholder="e.g. 36.23"
                      step="0.01"
                      value={defaultRate}
                      onChange={e => setDefaultRate(e.target.value)}
                      className="w-32 h-9"
                    />
                    <Button size="sm" variant="outline" onClick={applyDefault}>
                      Apply to all
                    </Button>
                  </div>
                </div>
                {staffRows.length > 0 && (
                  <p className="text-xs text-muted-foreground ml-auto self-end pb-1">
                    {staffRows.length} staff members
                  </p>
                )}
              </div>
              {/* Casual rate info */}
              {defaultEmpType === 'casual' && defaultRate && parseFloat(defaultRate) > 0 && (() => {
                const rate = parseFloat(defaultRate);
                const base = r2(rate / 1.25);
                const load = r2(rate - base);
                return (
                  <div className="mt-3 p-3 bg-blue-50 border border-blue-200 rounded text-xs text-blue-800 space-y-1">
                    <p className="font-semibold">Casual Loading Breakdown — ${rate.toFixed(2)} casual rate</p>
                    <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 mt-1">
                      {[
                        ['Base (÷1.25)', `$${base.toFixed(2)}`],
                        ['Loading (+25%)', `$${load.toFixed(2)}`],
                        ['Afternoon (1.125×)', `$${r2(base*1.125+load).toFixed(2)}/h`],
                        ['Night (1.15×)', `$${r2(base*1.15+load).toFixed(2)}/h`],
                        ['Saturday (1.5×)', `$${r2(base*1.5+load).toFixed(2)}/h`],
                        ['Sunday (2.0×)', `$${r2(base*2.0+load).toFixed(2)}/h`],
                        ['Public Hol. (2.5×)', `$${r2(base*2.5+load).toFixed(2)}/h`],
                        ['OT 1.5×', `$${r2(base*1.5+load).toFixed(2)}/h`],
                      ].map(([label, value]) => (
                        <div key={label} className="bg-white/60 rounded px-2 py-1">
                          <div className="text-[10px] text-blue-600">{label}</div>
                          <div className="font-semibold">{value}</div>
                        </div>
                      ))}
                    </div>
                  </div>
                );
              })()}
            </CardContent>
          </Card>

          {/* Table */}
          <Card>
            <CardContent className="p-0">
              {isLoading ? (
                <div className="py-12"><LoadingScreen message="Loading pay hours…" /></div>
              ) : phError ? (
                <div className="py-8 text-center text-destructive text-sm px-4">
                  <AlertCircle className="h-5 w-5 mx-auto mb-2" />
                  Error loading pay hours: {phError.message}
                </div>
              ) : staffRows.length === 0 ? (
                <div className="py-12 text-center text-muted-foreground text-sm">
                  No pay hours data. Go to the <strong>Pay Hours</strong> page, upload a CSV and click "Compute Pay Hours" first.
                </div>
              ) : (
                <div className="overflow-x-auto">
                  <Table>
                    <TableHeader>
                      {/* Group header row */}
                      <TableRow className="bg-muted/60 border-b-0 text-[10px] uppercase tracking-wider">
                        <TableHead colSpan={3} className="sticky left-0 bg-muted/60 z-10 border-r border-border/50" />
                        <TableHead colSpan={3} className="text-center text-yellow-800 border-r border-border/50 py-1">Weekday Hrs</TableHead>
                        <TableHead colSpan={2} className="text-center text-orange-800 border-r border-border/50 py-1">WD Overtime</TableHead>
                        <TableHead colSpan={3} className="text-center text-cyan-800 border-r border-border/50 py-1">Saturday</TableHead>
                        <TableHead colSpan={2} className="text-center text-red-800 border-r border-border/50 py-1">Sunday ★</TableHead>
                        <TableHead colSpan={2} className="text-center text-blue-800 border-r border-border/50 py-1">Holiday ★</TableHead>
                        <TableHead colSpan={1} className="text-center text-teal-800 border-r border-border/50 py-1">Nursing</TableHead>
                        <TableHead colSpan={2} className="text-center text-amber-800 border-r border-border/50 py-1">⚠ Exceptions</TableHead>
                        <TableHead colSpan={4} className="text-center text-rose-800 border-r border-border/50 py-1">OT &gt; 76h by Day</TableHead>
                        <TableHead colSpan={2} className="text-center text-green-800 border-r border-border/50 py-1">Allowances</TableHead>
                        <TableHead colSpan={1} className="text-center" />
                      </TableRow>
                      {/* Column header row */}
                      <TableRow className="bg-muted/30 text-[11px]">
                        <TableHead className="min-w-[160px] sticky left-0 bg-muted/30 z-10 border-r border-border/50">Staff</TableHead>
                        <TableHead className="min-w-[90px]">Rate ($)</TableHead>
                        <TableHead className="min-w-[100px] border-r border-border/50">Type</TableHead>
                        <TableHead className="text-right text-yellow-700 whitespace-nowrap">Morn</TableHead>
                        <TableHead className="text-right text-orange-700 whitespace-nowrap">Aft<br/><span className="text-[9px] font-normal opacity-70">1.125×</span></TableHead>
                        <TableHead className="text-right text-indigo-700 border-r border-border/50 whitespace-nowrap">Night<br/><span className="text-[9px] font-normal opacity-70">1.15×</span></TableHead>
                        <TableHead className="text-right text-orange-600 whitespace-nowrap">OT≤2h<br/><span className="text-[9px] font-normal opacity-70">1.5×</span></TableHead>
                        <TableHead className="text-right text-orange-700 border-r border-border/50 whitespace-nowrap">OT&gt;2h<br/><span className="text-[9px] font-normal opacity-70">2×</span></TableHead>
                        <TableHead className="text-right text-cyan-700 whitespace-nowrap">Ord<br/><span className="text-[9px] font-normal opacity-70">1.5×</span></TableHead>
                        <TableHead className="text-right text-cyan-600 whitespace-nowrap">OT≤2h</TableHead>
                        <TableHead className="text-right text-cyan-600 border-r border-border/50 whitespace-nowrap">OT&gt;2h</TableHead>
                        <TableHead className="text-right text-red-700 whitespace-nowrap">All Hrs<br/><span className="text-[9px] font-normal opacity-70">2×</span></TableHead>
                        <TableHead className="text-right text-red-600 border-r border-border/50 whitespace-nowrap">OT hrs</TableHead>
                        <TableHead className="text-right text-blue-700 whitespace-nowrap">All Hrs<br/><span className="text-[9px] font-normal opacity-70">2.5×</span></TableHead>
                        <TableHead className="text-right text-blue-600 border-r border-border/50 whitespace-nowrap">OT hrs</TableHead>
                        <TableHead className="text-right text-teal-700 border-r border-border/50 whitespace-nowrap">Hrs</TableHead>
                        <TableHead className="text-right text-orange-700 whitespace-nowrap" title="Total OT hours from all shifts">OT Total</TableHead>
                        <TableHead className="text-right border-r border-border/50 whitespace-nowrap" title="Broken shift count">Broken#</TableHead>
                        {/* OT>76 by day type */}
                        <TableHead className="text-right text-rose-700 whitespace-nowrap" title="OT>76 from weekday shifts (1.5×/2×)">WD<br/><span className="text-[9px] font-normal opacity-70">1.5×/2×</span></TableHead>
                        <TableHead className="text-right text-rose-600 whitespace-nowrap" title="OT>76 from Saturday shifts (1.5×/2×)">Sat<br/><span className="text-[9px] font-normal opacity-70">1.5×/2×</span></TableHead>
                        <TableHead className="text-right text-rose-500 whitespace-nowrap" title="OT>76 from Sunday shifts (2.0×)">Sun<br/><span className="text-[9px] font-normal opacity-70">2×</span></TableHead>
                        <TableHead className="text-right border-r border-border/50 text-rose-800 whitespace-nowrap" title="OT>76 from Holiday shifts (2.5×)">Hol<br/><span className="text-[9px] font-normal opacity-70">2.5×</span></TableHead>
                        <TableHead className="text-right text-amber-700 whitespace-nowrap">Broken<br/><span className="text-[9px] font-normal opacity-70">allow.</span></TableHead>
                        <TableHead className="text-right text-amber-600 border-r border-border/50 whitespace-nowrap">Meal<br/><span className="text-[9px] font-normal opacity-70">allow.~</span></TableHead>
                        <TableHead className="text-right font-semibold whitespace-nowrap min-w-[100px]">Gross Pay</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {staffRows.map((row) => {
                        const rateVal   = baseRates[row.staffName] ?? defaultRate;
                        const empT      = getEmpType(row.staffName);
                        const gross     = calcGross(row, rateVal, empT);
                        const allow     = calcAllowances(row);
                        const otTotal   = totalOtHrs(row);
                        const sunAll    = r2((row.sundayHours||0)+(row.sundayOtUpto2||0)+(row.sundayOtAfter2||0));
                        const sunOT     = r2((row.sundayOtUpto2||0)+(row.sundayOtAfter2||0));
                        const holAll    = r2((row.holidayHours||0)+(row.holidayOtUpto2||0)+(row.holidayOtAfter2||0));
                        const holOT     = r2((row.holidayOtUpto2||0)+(row.holidayOtAfter2||0));
                        const isCasual  = empT === 'casual';
                        const h = (v) => v ? fmtH(v) : <span className="text-muted-foreground/30">—</span>;
                        const n = (v) => v ? String(v) : <span className="text-muted-foreground/30">—</span>;
                        // Exception flags
                        const hasOT     = otTotal > 0;
                        const hasBroken = (row.brokenShiftCount || 0) > 0;
                        return (
                          <TableRow key={row.staffName} className={`hover:bg-muted/30 text-xs ${isCasual ? 'bg-blue-50/30' : ''}`}>
                            <TableCell className={`font-medium sticky left-0 z-10 text-sm border-r border-border/50 ${isCasual ? 'bg-blue-50/60' : 'bg-background'}`}>
                              {row.staffName}
                            </TableCell>
                            <TableCell>
                              <div className="flex items-center gap-1">
                                <span className="text-muted-foreground text-xs">$</span>
                                <Input
                                  type="number"
                                  placeholder="0.00"
                                  step="0.01"
                                  value={baseRates[row.staffName] ?? defaultRate}
                                  onChange={e => setRate(row.staffName, e.target.value)}
                                  className="h-7 w-20 text-xs px-2"
                                />
                              </div>
                            </TableCell>
                            <TableCell className="border-r border-border/50">
                              <select
                                value={empT}
                                onChange={e => setEmpType(row.staffName, e.target.value)}
                                className={`text-[11px] h-7 rounded border px-1 focus:outline-none focus:ring-1 focus:ring-ring w-full ${isCasual ? 'bg-blue-100 border-blue-300 text-blue-800' : 'bg-background border-input'}`}
                              >
                                <option value="permanent">Permanent</option>
                                <option value="casual">Casual</option>
                              </select>
                            </TableCell>
                            {/* Weekday ordinary */}
                            <TableCell className="text-right tabular-nums text-yellow-700">{h(row.morningHours)}</TableCell>
                            <TableCell className="text-right tabular-nums text-orange-700">{h(row.afternoonHours)}</TableCell>
                            <TableCell className="text-right tabular-nums text-indigo-700 border-r border-border/50">{h(row.nightHours)}</TableCell>
                            {/* WD overtime */}
                            <TableCell className="text-right tabular-nums text-orange-600">{h(row.weekdayOtUpto2)}</TableCell>
                            <TableCell className="text-right tabular-nums text-orange-700 border-r border-border/50">{h(row.weekdayOtAfter2)}</TableCell>
                            {/* Saturday */}
                            <TableCell className="text-right tabular-nums text-cyan-700">{h(row.saturdayHours)}</TableCell>
                            <TableCell className="text-right tabular-nums text-cyan-600">{h(row.saturdayOtUpto2)}</TableCell>
                            <TableCell className="text-right tabular-nums text-cyan-600 border-r border-border/50">{h(row.saturdayOtAfter2)}</TableCell>
                            {/* Sunday consolidated */}
                            <TableCell className="text-right tabular-nums text-red-700 font-medium">{sunAll ? fmtH(sunAll) : <span className="text-muted-foreground/30">—</span>}</TableCell>
                            <TableCell className={`text-right tabular-nums border-r border-border/50 ${sunOT > 0 ? 'text-orange-600 font-medium' : 'text-muted-foreground/30'}`}>{sunOT ? fmtH(sunOT) : '—'}</TableCell>
                            {/* Holiday consolidated */}
                            <TableCell className="text-right tabular-nums text-blue-700 font-medium">{holAll ? fmtH(holAll) : <span className="text-muted-foreground/30">—</span>}</TableCell>
                            <TableCell className={`text-right tabular-nums border-r border-border/50 ${holOT > 0 ? 'text-orange-600 font-medium' : 'text-muted-foreground/30'}`}>{holOT ? fmtH(holOT) : '—'}</TableCell>
                            {/* Nursing */}
                            <TableCell className="text-right tabular-nums text-teal-700 border-r border-border/50">{h(row.nursingCareHours)}</TableCell>
                            {/* Exceptions */}
                            <TableCell className={`text-right tabular-nums ${hasOT ? 'text-orange-600 font-semibold' : 'text-muted-foreground/30'}`}>{hasOT ? fmtH(otTotal) : '—'}</TableCell>
                            <TableCell className={`text-right tabular-nums border-r border-border/50 ${hasBroken ? 'text-orange-700 font-semibold' : 'text-muted-foreground/30'}`}>{n(row.brokenShiftCount)}</TableCell>
                            {/* OT>76 by day type */}
                            <TableCell className={`text-right tabular-nums ${(row.otAfter76Weekday||0) > 0 ? 'text-rose-700 font-medium' : 'text-muted-foreground/30'}`}>{(row.otAfter76Weekday||0) > 0 ? fmtH(row.otAfter76Weekday) : '—'}</TableCell>
                            <TableCell className={`text-right tabular-nums ${(row.otAfter76Saturday||0) > 0 ? 'text-rose-600 font-medium' : 'text-muted-foreground/30'}`}>{(row.otAfter76Saturday||0) > 0 ? fmtH(row.otAfter76Saturday) : '—'}</TableCell>
                            <TableCell className={`text-right tabular-nums ${(row.otAfter76Sunday||0) > 0 ? 'text-rose-500 font-medium' : 'text-muted-foreground/30'}`}>{(row.otAfter76Sunday||0) > 0 ? fmtH(row.otAfter76Sunday) : '—'}</TableCell>
                            <TableCell className={`text-right tabular-nums border-r border-border/50 ${(row.otAfter76Holiday||0) > 0 ? 'text-rose-800 font-medium' : 'text-muted-foreground/30'}`}>{(row.otAfter76Holiday||0) > 0 ? fmtH(row.otAfter76Holiday) : '—'}</TableCell>
                            {/* Allowances */}
                            <TableCell className={`text-right tabular-nums ${allow.brokenAllow > 0 ? 'text-amber-700' : 'text-muted-foreground/30'}`}>{allow.brokenAllow > 0 ? fmt(allow.brokenAllow) : '—'}</TableCell>
                            <TableCell className={`text-right tabular-nums border-r border-border/50 ${allow.mealAllow > 0 ? 'text-amber-600' : 'text-muted-foreground/30'}`}>{allow.mealAllow > 0 ? fmt(allow.mealAllow) : '—'}</TableCell>
                            {/* Gross pay */}
                            <TableCell className="text-right tabular-nums font-bold text-sm">
                              {gross !== null ? <span className={isCasual ? 'text-blue-700' : ''}>{fmt(gross)}</span> : <span className="text-muted-foreground font-normal text-xs">enter rate</span>}
                            </TableCell>
                          </TableRow>
                        );
                      })}

                      {/* Totals */}
                      <TableRow className="border-t-2 border-border bg-muted/20 font-bold text-xs">
                        <TableCell className="sticky left-0 bg-muted/20 z-10 border-r border-border/50">Totals</TableCell>
                        <TableCell /><TableCell className="border-r border-border/50" />
                        <TableCell className="text-right text-yellow-700">{fmtH(r2(totals.morningHours))}</TableCell>
                        <TableCell className="text-right text-orange-700">{fmtH(r2(totals.afternoonHours))}</TableCell>
                        <TableCell className="text-right text-indigo-700 border-r border-border/50">{fmtH(r2(totals.nightHours))}</TableCell>
                        <TableCell className="text-right text-orange-600">{fmtH(r2(totals.weekdayOtUpto2))}</TableCell>
                        <TableCell className="text-right text-orange-700 border-r border-border/50">{fmtH(r2(totals.weekdayOtAfter2))}</TableCell>
                        <TableCell className="text-right text-cyan-700">{fmtH(r2(totals.saturdayHours))}</TableCell>
                        <TableCell className="text-right text-cyan-600">{fmtH(r2(totals.saturdayOtUpto2))}</TableCell>
                        <TableCell className="text-right text-cyan-600 border-r border-border/50">{fmtH(r2(totals.saturdayOtAfter2))}</TableCell>
                        <TableCell className="text-right text-red-700">{fmtH(r2((totals.sundayHours||0)+(totals.sundayOtUpto2||0)+(totals.sundayOtAfter2||0)))}</TableCell>
                        <TableCell className="text-right text-orange-600 border-r border-border/50">{fmtH(r2((totals.sundayOtUpto2||0)+(totals.sundayOtAfter2||0)))}</TableCell>
                        <TableCell className="text-right text-blue-700">{fmtH(r2((totals.holidayHours||0)+(totals.holidayOtUpto2||0)+(totals.holidayOtAfter2||0)))}</TableCell>
                        <TableCell className="text-right text-orange-600 border-r border-border/50">{fmtH(r2((totals.holidayOtUpto2||0)+(totals.holidayOtAfter2||0)))}</TableCell>
                        <TableCell className="text-right text-teal-700 border-r border-border/50">{fmtH(r2(totals.nursingCareHours))}</TableCell>
                        <TableCell className="text-right text-orange-600">{fmtH(r2(totals.totalOT))}</TableCell>
                        <TableCell className="text-right border-r border-border/50">{totals.brokenShiftCount || '—'}</TableCell>
                        {/* OT>76 by day type totals */}
                        <TableCell className="text-right text-rose-700">{totals.otAfter76Weekday > 0 ? fmtH(r2(totals.otAfter76Weekday)) : '—'}</TableCell>
                        <TableCell className="text-right text-rose-600">{totals.otAfter76Saturday > 0 ? fmtH(r2(totals.otAfter76Saturday)) : '—'}</TableCell>
                        <TableCell className="text-right text-rose-500">{totals.otAfter76Sunday > 0 ? fmtH(r2(totals.otAfter76Sunday)) : '—'}</TableCell>
                        <TableCell className="text-right border-r border-border/50 text-rose-800">{totals.otAfter76Holiday > 0 ? fmtH(r2(totals.otAfter76Holiday)) : '—'}</TableCell>
                        <TableCell className="text-right text-amber-700">{totals.brokenAllow > 0 ? fmt(r2(totals.brokenAllow)) : '—'}</TableCell>
                        <TableCell className="text-right text-amber-600 border-r border-border/50">{totals.mealAllow > 0 ? fmt(r2(totals.mealAllow)) : '—'}</TableCell>
                        <TableCell className="text-right">
                          {totals.grossReady ? fmt(r2(totals.gross)) : <span className="text-muted-foreground font-normal text-xs">enter rates</span>}
                        </TableCell>
                      </TableRow>
                    </TableBody>
                  </Table>
                </div>
              )}
            </CardContent>
          </Card>

          {/* Legend & Disclaimer */}
          <div className="grid gap-3 sm:grid-cols-2">
            <div className="bg-muted/20 border border-border rounded p-3 text-xs space-y-1.5">
              <p className="font-semibold text-[11px] uppercase tracking-wider">Pay Rate Multipliers</p>
              <div className="grid grid-cols-2 gap-x-4 gap-y-0.5 text-muted-foreground text-[11px]">
                <span>Weekday ordinary:</span><span className="font-medium text-foreground">1.0×</span>
                <span>Afternoon (after 8pm):</span><span className="font-medium text-foreground">1.125×</span>
                <span>Night (before 6am):</span><span className="font-medium text-foreground">1.15×</span>
                <span>Saturday ordinary:</span><span className="font-medium text-foreground">1.5×</span>
                <span>Sunday:</span><span className="font-medium text-foreground">2.0×</span>
                <span>Public Holiday:</span><span className="font-medium text-foreground">2.5×</span>
                <span>WD/Sat OT — first 2h:</span><span className="font-medium text-foreground">1.5×</span>
                <span>WD/Sat OT — after 2h:</span><span className="font-medium text-foreground">2.0×</span>
                <span>Sun / PH OT:</span><span className="font-medium text-foreground">same as Sun/PH rate</span>
                <span>OT &gt; 76h — WD/Sat:</span><span className="font-medium text-foreground">1.5× / 2× (tiered)</span>
                <span>OT &gt; 76h — Sunday:</span><span className="font-medium text-foreground">2.0× flat</span>
                <span>OT &gt; 76h — PH:</span><span className="font-medium text-foreground">2.5× flat</span>
              </div>
              <div className="border-t border-border mt-2 pt-2 grid grid-cols-2 gap-x-4 gap-y-0.5 text-muted-foreground text-[11px]">
                <span>Broken shift (1 break):</span><span className="font-medium text-foreground">${BROKEN_ALLOWANCE_1.toFixed(2)}</span>
                <span>Broken shift (2 breaks):</span><span className="font-medium text-foreground">${BROKEN_ALLOWANCE_2.toFixed(2)}</span>
                <span>Meal allowance (OT &gt;1h):</span><span className="font-medium text-foreground">${MEAL_ALLOWANCE.toFixed(2)}</span>
                <span>Meal allowance (OT &gt;4h):</span><span className="font-medium text-foreground">${(MEAL_ALLOWANCE*2).toFixed(2)}</span>
              </div>
              <p className="text-muted-foreground/70 text-[10px] pt-1">★ Sunday &amp; Holiday OT = same rate as ordinary (2.0× / 2.5×). ~ Meal allowance approximate (per-shift detail unavailable). Casual: effective rate = (Base÷1.25 × Multiplier) + Loading.</p>
            </div>
            <div className="bg-amber-50 border border-amber-300 rounded p-3 text-xs text-amber-800 space-y-1">
              <p className="font-semibold">⚠ SCHADS Award Rules Applied</p>
              <ul className="list-disc list-inside space-y-0.5 text-[11px] leading-relaxed">
                <li><strong>OT triggers:</strong> &gt;76h/fortnight OR &gt;10h/day — same hour paid once, not double-counted</li>
                <li><strong>OT &gt; 76h rates:</strong> Weekday/Sat shifts use 1.5× (first 2h) then 2×; Sun shifts 2.0×; PH shifts 2.5×</li>
                <li><strong>Sunday/PH OT:</strong> Same rate as ordinary day (2.0× / 2.5×) — no separate OT brackets</li>
                <li><strong>Broken shifts:</strong> $20.82 per shift (1 break), $27.56 for 2 breaks (cap not tracked per-shift)</li>
                <li><strong>Meal allowance:</strong> $16.62 when OT &gt;1h on a shift; +$16.62 when OT &gt;4h (approximated from total OT)</li>
              </ul>
              <p className="text-amber-700 pt-1">Always verify against the <a href="https://www.fairwork.gov.au" target="_blank" rel="noopener noreferrer" className="underline">Fair Work pay guide</a>.</p>
            </div>
          </div>
        </>
      )}

      {/* ── MANUAL SCENARIO ────────────────────────────────────── */}
      {view === 'manual' && (
        <>
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-sm uppercase tracking-widest flex items-center gap-2">
                <span className="inline-flex items-center justify-center w-5 h-5 bg-foreground text-background text-xs font-bold">1</span>
                Rate &amp; Type
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div className="space-y-1.5">
                  <label className="text-xs uppercase tracking-wider text-muted-foreground">Base Hourly Rate ($)</label>
                  <Input type="number" placeholder="e.g. 37.35" step="0.01" min="10" max="200"
                    value={manualRate}
                    onChange={e => { setManualRate(e.target.value); setManualRateErr(false); }}
                    className={manualRateErr ? 'border-destructive' : ''}
                  />
                  {manualRateErr && <p className="text-xs text-destructive flex items-center gap-1"><AlertCircle className="h-3 w-3" /> Enter $10–$200</p>}
                </div>
                <div className="space-y-1.5">
                  <label className="text-xs uppercase tracking-wider text-muted-foreground">Employment Type</label>
                  <select value={manualEmpType} onChange={e => setManualEmpType(e.target.value)}
                    className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-ring">
                    <option value="pt">Part-time / Disability (OT after 2h)</option>
                    <option value="ft">Full-time (OT after 3h)</option>
                  </select>
                </div>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-sm uppercase tracking-widest flex items-center gap-2">
                <span className="inline-flex items-center justify-center w-5 h-5 bg-foreground text-background text-xs font-bold">2</span>
                Enter Shifts — click a day to expand
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-2">
              {DAYS_CFG.map((dc, di) => {
                const day = manualDays[di];
                const validSegs = day.segments.filter(s => segH(s) !== null);
                const totalH = validSegs.reduce((a, s) => a + segH(s), 0);
                const overlap = hasOverlap(day.segments);
                return (
                  <div key={di} className={`border rounded-sm ${validSegs.length ? 'border-border' : 'border-border/50'}`}>
                    <div className="flex items-center gap-3 px-4 py-2.5 cursor-pointer select-none" onClick={() => toggleManualDay(di)}>
                      <span className={`text-xs font-bold px-2 py-0.5 border rounded-sm min-w-[40px] text-center ${pillCls(dc.type, day.isPH)}`}>{dc.short}</span>
                      <span className={`text-sm font-semibold flex-1 ${dc.type === 'saturday' ? 'text-purple-700' : dc.type === 'sunday' ? 'text-red-600' : day.isPH ? 'text-blue-700' : ''}`}>{dc.name}</span>
                      <span className="text-sm text-muted-foreground ml-auto">{totalH > 0 ? <span className="text-foreground font-medium">{totalH.toFixed(1)}h{day.isPH ? ' · PH' : ''}</span> : 'Day off'}</span>
                      <button className="w-6 h-6 border border-border flex items-center justify-center text-muted-foreground hover:border-foreground rounded-sm">{day.open ? '−' : '+'}</button>
                    </div>
                    {day.open && (
                      <div className="px-4 pb-4 pt-1 border-t border-border/50 space-y-3">
                        {day.segments.map(seg => {
                          const h = segH(seg);
                          return (
                            <div key={seg.id} className="grid grid-cols-[1fr_1fr_auto_auto] gap-2 items-end">
                              <div className="space-y-1"><label className="text-xs text-muted-foreground">Start</label><Input type="time" value={seg.start} onChange={e => updateManualSeg(di, seg.id, 'start', e.target.value)} className="h-9" /></div>
                              <div className="space-y-1"><label className="text-xs text-muted-foreground">End</label><Input type="time" value={seg.end} onChange={e => updateManualSeg(di, seg.id, 'end', e.target.value)} className="h-9" /></div>
                              <div className="pb-1 text-sm">{seg.start && seg.end ? h !== null ? <span className="text-green-700 font-medium">{fmtMins(toMins(seg.end) - toMins(seg.start))}</span> : <span className="text-destructive text-xs">end before start</span> : <span className="text-muted-foreground">—</span>}</div>
                              <button onClick={() => removeManualSeg(di, seg.id)} className="h-9 w-9 border border-border flex items-center justify-center text-muted-foreground hover:border-destructive hover:text-destructive rounded-sm"><X className="h-4 w-4" /></button>
                            </div>
                          );
                        })}
                        {overlap && <p className="text-xs text-destructive bg-destructive/10 border border-destructive/30 px-3 py-2 flex items-center gap-1.5"><AlertCircle className="h-3 w-3" /> Shift times overlap.</p>}
                        <button onClick={() => addManualSeg(di)} className="w-full border border-dashed border-border px-4 py-2 text-sm text-muted-foreground hover:border-foreground hover:text-foreground flex items-center gap-2 rounded-sm"><Plus className="h-4 w-4" /> Add segment</button>
                        <label className="flex items-center gap-2 cursor-pointer">
                          <input type="checkbox" checked={day.isPH} onChange={e => updateManualDay(di, { isPH: e.target.checked })} className="w-4 h-4 accent-blue-600" />
                          <span className="text-xs text-muted-foreground">Public Holiday (→ 2.5×)</span>
                        </label>
                      </div>
                    )}
                  </div>
                );
              })}
            </CardContent>
          </Card>

          <Button onClick={runManual} disabled={!manualRate} className="w-full h-12 text-base font-bold uppercase tracking-widest">
            Calculate My Pay →
          </Button>

          {manualResults && (
            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="text-sm uppercase tracking-widest flex items-center gap-2">
                  <span className="inline-flex items-center justify-center w-5 h-5 bg-foreground text-background text-xs font-bold">3</span>
                  Pay Breakdown
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="bg-foreground text-background p-5 flex items-end justify-between flex-wrap gap-4">
                  <div>
                    <p className="text-xs uppercase tracking-widest opacity-60 mb-1">Gross Weekly Pay</p>
                    <p className="text-4xl font-bold">$<span className="text-yellow-300">{manualResults.gross.toFixed(2).replace(/\B(?=(\d{3})+(?!\d))/g, ',')}</span></p>
                  </div>
                  <div className="text-right">
                    <p className="text-xs uppercase tracking-widest opacity-60 mb-1">Total Hours</p>
                    <p className="text-2xl font-bold">{manualResults.totalHours.toFixed(2)}h</p>
                  </div>
                </div>
                <div className="grid grid-cols-3 gap-px bg-border border border-border">
                  {[
                    { label: 'Base Pay',         value: fmt(manualResults.basePay) },
                    { label: 'Penalty Loadings', value: fmt(manualResults.penaltyExtra) },
                    { label: 'Overtime Pay',     value: fmt(manualResults.otPay) },
                    { label: 'Allowances',       value: fmt(manualResults.allowances) },
                    { label: 'Ordinary Hours',   value: manualResults.ordHours.toFixed(2) + 'h' },
                    { label: 'Overtime Hours',   value: manualResults.totalOtHours.toFixed(2) + 'h' },
                  ].map(({ label, value }) => (
                    <div key={label} className="bg-background p-3 flex flex-col gap-1">
                      <span className="text-xs uppercase tracking-wider text-muted-foreground">{label}</span>
                      <span className="text-lg font-bold">{value}</span>
                    </div>
                  ))}
                </div>
                <div className="border border-border overflow-hidden">
                  <div className="bg-muted/30 px-4 py-2 border-b border-border">
                    <p className="text-xs font-bold uppercase tracking-widest">Line-by-line Detail</p>
                  </div>
                  <div className="overflow-x-auto">
                    <Table>
                      <TableHeader>
                        <TableRow className="bg-muted/20">
                          <TableHead className="text-xs uppercase tracking-wider">Day</TableHead>
                          <TableHead className="text-xs uppercase tracking-wider">Shift</TableHead>
                          <TableHead className="text-xs uppercase tracking-wider">Hrs</TableHead>
                          <TableHead className="text-xs uppercase tracking-wider">Type</TableHead>
                          <TableHead className="text-xs uppercase tracking-wider">Rate/h</TableHead>
                          <TableHead className="text-xs uppercase tracking-wider text-right">Pay</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {manualResults.tableRows.map((r, idx) => {
                          const rc = rowClass(r.cls);
                          return (
                            <TableRow key={idx}>
                              <TableCell className={`text-sm ${rc}`}>{r.dayName}</TableCell>
                              <TableCell className="text-xs text-muted-foreground">{r.segLabel}</TableCell>
                              <TableCell className="text-sm">{r.hours != null ? r.hours.toFixed(2) + 'h' : '—'}</TableCell>
                              <TableCell className={`text-sm font-medium ${rc}`}>{r.type}</TableCell>
                              <TableCell className="text-xs text-muted-foreground">{r.hours != null ? '$' + (r.pay / r.hours).toFixed(2) + '/h' : '—'}</TableCell>
                              <TableCell className={`text-right font-semibold ${rc}`}>{fmt(r.pay)}</TableCell>
                            </TableRow>
                          );
                        })}
                        <TableRow className="border-t-2 border-border">
                          <TableCell colSpan={5} className="font-bold text-sm">Gross Weekly Total</TableCell>
                          <TableCell className="text-right font-bold text-sm">{fmt(manualResults.gross)}</TableCell>
                        </TableRow>
                      </TableBody>
                    </Table>
                  </div>
                </div>
                <div className="bg-amber-50 border border-amber-400 p-3 text-xs text-amber-800 leading-relaxed rounded-sm">
                  ⚠ <strong>Estimates only.</strong> Based on SCHADS Award MA000100 (effective 01/07/2024). Always verify against the{' '}
                  <a href="https://www.fairwork.gov.au" target="_blank" rel="noopener noreferrer" className="underline text-amber-700">official Fair Work pay guide</a>.
                </div>
              </CardContent>
            </Card>
          )}
        </>
      )}
    </div>
  );
};
