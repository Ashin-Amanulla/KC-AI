import { useState, useMemo, useCallback } from 'react';
import { ChevronDown, ChevronUp, Plus, X, AlertCircle } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '../ui/card';
import { Button } from '../ui/button';
import { Input } from '../ui/input';
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from '../ui/table';
import { useShifts } from '../api/shifts';
import { useHolidays } from '../api/holidays';
import { LoadingScreen } from '../ui/LoadingSpinner';

// ── SCHADS Award Constants (MA000100, effective 01/07/2024) ──────────
const DAILY_ORD        = 7.6;
const WEEKLY_ORD       = 38.0;
const RATES            = { weekday: 1.00, saturday: 1.50, sunday: 2.00, ph: 2.50 };
const OT_1             = 1.50;
const OT_2             = 2.00;
const BROKEN_ALLOWANCE = 18.43;
const OT_BRACKET       = { pt: 2.0, ft: 3.0 };

// ── Formatting ───────────────────────────────────────────────────────
const fmt  = (n) => '$' + n.toFixed(2).replace(/\B(?=(\d{3})+(?!\d))/g, ',');
const r2   = (n) => Math.round(n * 100) / 100;
const fmtH = (n) => n.toFixed(2) + 'h';

// ── Timezone helpers ─────────────────────────────────────────────────
function offsetMins(offsetStr) {
  if (!offsetStr) return 600; // default +10:00
  const sign = offsetStr[0] === '+' ? 1 : -1;
  const [h, m] = offsetStr.slice(1).split(':').map(Number);
  return sign * (h * 60 + m);
}

// Convert UTC Date → "local" Date (UTC fields represent local time)
function toLocalDate(utcMs, offMins) {
  return new Date(utcMs + offMins * 60000);
}

// ── Split a DB shift into local-day segments ─────────────────────────
// Returns [{ localDayMs, localStartMs, weekMondayMs, dayOfWeek (0=Mon…6=Sun), hours, isBroken }]
function getShiftSegments(shift) {
  const off = offsetMins(shift.timezoneOffset);
  const MS_DAY = 86400000;

  const startLocalMs = new Date(shift.startDatetime).getTime() + off * 60000;
  const endLocalMs   = new Date(shift.endDatetime).getTime()   + off * 60000;

  if (endLocalMs <= startLocalMs) return [];

  const segments = [];
  let dayStartMs = Math.floor(startLocalMs / MS_DAY) * MS_DAY;
  let dayEndMs   = dayStartMs + MS_DAY;
  let cur        = startLocalMs;

  while (cur < endLocalMs) {
    const segEndMs = Math.min(dayEndMs, endLocalMs);
    const hours    = r2((segEndMs - cur) / 3600000);
    if (hours <= 0) { cur = dayEndMs; dayStartMs = dayEndMs; dayEndMs += MS_DAY; continue; }

    // dayOfWeek from shifted UTC day: getUTCDay() gives 0=Sun…6=Sat
    const utcDow = new Date(dayStartMs).getUTCDay();
    const dow    = (utcDow + 6) % 7; // 0=Mon…6=Sun

    // ISO week key: Monday of this week
    const weekMondayMs = dayStartMs - dow * MS_DAY;

    segments.push({
      localDayMs:   dayStartMs,
      localStartMs: cur,
      weekMondayMs,
      dayOfWeek:    dow,
      hours,
      isBroken:     shift.isBrokenShift || false,
    });

    cur        = dayEndMs;
    dayStartMs = dayEndMs;
    dayEndMs  += MS_DAY;
  }
  return segments;
}

// ── Public holiday check ─────────────────────────────────────────────
function buildHolidaySet(holidays) {
  const s = new Set();
  for (const h of holidays) {
    // DB stores holiday dates as UTC midnight; we match on YYYY-MM-DD
    const d = new Date(h.date);
    s.add(`${d.getUTCFullYear()}-${String(d.getUTCMonth()+1).padStart(2,'0')}-${String(d.getUTCDate()).padStart(2,'0')}`);
  }
  return s;
}

function isHoliday(localDayMs, holidaySet) {
  const d = new Date(localDayMs);
  const key = `${d.getUTCFullYear()}-${String(d.getUTCMonth()+1).padStart(2,'0')}-${String(d.getUTCDate()).padStart(2,'0')}`;
  return holidaySet.has(key);
}

// ── Core SCHADS bucketing ────────────────────────────────────────────
// Returns { x1, x1_5, x2, x2_5, allowances, totalHours }
function computeStaffBuckets(shifts, holidaySet, empType) {
  const otBracket = OT_BRACKET[empType] || 2.0;
  if (!shifts.length) return { x1: 0, x1_5: 0, x2: 0, x2_5: 0, allowances: 0, totalHours: 0 };

  // Expand all shifts into local-day segments
  const allSegs = [];
  for (const shift of shifts) {
    for (const seg of getShiftSegments(shift)) {
      allSegs.push(seg);
    }
  }

  // Group by week → day
  const byWeek = {};
  for (const seg of allSegs) {
    const wk = seg.weekMondayMs;
    const dk = seg.localDayMs;
    if (!byWeek[wk]) byWeek[wk] = {};
    if (!byWeek[wk][dk]) byWeek[wk][dk] = { dow: seg.dayOfWeek, segs: [] };
    byWeek[wk][dk].segs.push(seg);
  }

  let x1 = 0, x1_5 = 0, x2 = 0, x2_5 = 0;

  // Track broken-shift breaks per local day: { dayKey → breakCount }
  const brokenBreaksPerDay = {};

  // Process week by week in chronological order
  for (const wk of Object.keys(byWeek).sort((a, b) => Number(a) - Number(b))) {
    let weeklyOrdWorked = 0;
    const dailyOrdWorked = {};
    const dailyOtAccrued = {};

    const sortedDays = Object.entries(byWeek[wk])
      .sort(([a], [b]) => Number(a) - Number(b));

    for (const [dk, { dow, segs }] of sortedDays) {
      dailyOrdWorked[dk] = dailyOrdWorked[dk] || 0;
      dailyOtAccrued[dk] = dailyOtAccrued[dk] || 0;

      const ph      = isHoliday(Number(dk), holidaySet);
      const dayType = ph ? 'ph' : dow === 5 ? 'saturday' : dow === 6 ? 'sunday' : 'weekday';

      // Count broken breaks: each segment with isBroken=true is one break
      const brokenCount = segs.filter(s => s.isBroken).length;
      if (brokenCount > 0) {
        brokenBreaksPerDay[dk] = Math.min(2, (brokenBreaksPerDay[dk] || 0) + brokenCount);
      }

      // Sort segments chronologically within the day
      const sorted = [...segs].sort((a, b) => a.localStartMs - b.localStartMs);

      for (const seg of sorted) {
        const hours = seg.hours;
        const dailyOrdLeft  = Math.max(0, DAILY_ORD  - dailyOrdWorked[dk]);
        const weeklyOrdLeft = Math.max(0, WEEKLY_ORD - weeklyOrdWorked);
        const ordChunk = r2(Math.min(hours, dailyOrdLeft, weeklyOrdLeft));
        const otChunk  = r2(hours - ordChunk);

        // Bucket ordinary portion by day type
        if (ordChunk > 0) {
          if      (dayType === 'weekday')  x1   += ordChunk;
          else if (dayType === 'saturday') x1_5 += ordChunk;
          else if (dayType === 'sunday')   x2   += ordChunk;
          else if (dayType === 'ph')       x2_5 += ordChunk;
          dailyOrdWorked[dk] += ordChunk;
          weeklyOrdWorked    += ordChunk;
        }

        // Bucket OT portion
        if (otChunk > 0) {
          if (dayType === 'ph') {
            // PH OT stays at 2.5×
            x2_5 += otChunk;
          } else if (dayType === 'sunday') {
            // Sunday OT stays at 2.0×
            x2 += otChunk;
          } else {
            // Standard brackets (weekday + saturday OT)
            const firstLeft = Math.max(0, otBracket - dailyOtAccrued[dk]);
            const first     = r2(Math.min(otChunk, firstLeft));
            x1_5 += first;
            x2   += r2(otChunk - first);
            dailyOtAccrued[dk] += otChunk;
          }
        }
      }
    }
  }

  const allowances  = Object.values(brokenBreaksPerDay).reduce((s, n) => s + n * BROKEN_ALLOWANCE, 0);
  const totalHours  = r2(x1 + x1_5 + x2 + x2_5);

  return { x1: r2(x1), x1_5: r2(x1_5), x2: r2(x2), x2_5: r2(x2_5), allowances: r2(allowances), totalHours };
}

// ── Gross pay calc ───────────────────────────────────────────────────
function calcGross(buckets, baseRate) {
  const r = parseFloat(baseRate);
  if (!r || r <= 0) return null;
  return r2(r * (1.0 * buckets.x1 + 1.5 * buckets.x1_5 + 2.0 * buckets.x2 + 2.5 * buckets.x2_5) + buckets.allowances);
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
  const allowances = brokenDays * 2 * BROKEN_ALLOWANCE;
  if (allowances > 0) tableRows.push({ dayName: '—', segLabel: 'Broken shift allowance', hours: null, type: `$${BROKEN_ALLOWANCE}/break × ${brokenDays*2}`, cls: 'allow', pay: allowances, isAllow: true });

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
  const [empType, setEmpType]     = useState('pt');
  const [baseRates, setBaseRates] = useState({}); // { staffName: string }
  const [defaultRate, setDefaultRate] = useState('');

  // ── Fetch data ───────────────────────────────────────────────────
  const { data: shiftsData, isLoading: shiftsLoading, error: shiftsError } = useShifts({ perPage: 5000 });
  const { data: holidaysData, isLoading: holidaysLoading } = useHolidays();

  const allShifts  = shiftsData?.shifts || [];
  const allHolidays = holidaysData?.holidays || holidaysData || [];

  // ── Computed data ────────────────────────────────────────────────
  const holidaySet = useMemo(() => buildHolidaySet(allHolidays), [allHolidays]);

  const staffBuckets = useMemo(() => {
    if (!allShifts.length) return [];
    // Group by staffName
    const byStaff = {};
    for (const s of allShifts) {
      if (!byStaff[s.staffName]) byStaff[s.staffName] = [];
      byStaff[s.staffName].push(s);
    }
    return Object.entries(byStaff)
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([staffName, shifts]) => ({
        staffName,
        ...computeStaffBuckets(shifts, holidaySet, empType),
      }));
  }, [allShifts, holidaySet, empType]);

  // Totals row
  const totals = useMemo(() => {
    const t = { x1: 0, x1_5: 0, x2: 0, x2_5: 0, allowances: 0, totalHours: 0, gross: 0 };
    let grossReady = true;
    for (const row of staffBuckets) {
      t.x1       += row.x1;
      t.x1_5     += row.x1_5;
      t.x2       += row.x2;
      t.x2_5     += row.x2_5;
      t.allowances += row.allowances;
      t.totalHours += row.totalHours;
      const rate = baseRates[row.staffName] ?? defaultRate;
      const g = calcGross(row, rate);
      if (g !== null) t.gross += g;
      else grossReady = false;
    }
    return { ...t, grossReady };
  }, [staffBuckets, baseRates, defaultRate]);

  const setRate = useCallback((staffName, val) => {
    setBaseRates(prev => ({ ...prev, [staffName]: val }));
  }, []);

  const applyDefault = useCallback(() => {
    if (!defaultRate) return;
    const patch = {};
    for (const row of staffBuckets) patch[row.staffName] = defaultRate;
    setBaseRates(patch);
  }, [defaultRate, staffBuckets]);

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

  const isLoading = shiftsLoading || holidaysLoading;

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
                  <label className="text-xs uppercase tracking-wider text-muted-foreground">Employment Type</label>
                  <select
                    value={empType}
                    onChange={e => setEmpType(e.target.value)}
                    className="flex h-9 rounded-md border border-input bg-background px-3 py-1 text-sm focus:outline-none focus:ring-2 focus:ring-ring"
                  >
                    <option value="pt">Part-time / Disability (OT after 2h)</option>
                    <option value="ft">Full-time (OT after 3h)</option>
                  </select>
                </div>
                <div className="space-y-1">
                  <label className="text-xs uppercase tracking-wider text-muted-foreground">Default Base Rate ($)</label>
                  <div className="flex gap-2">
                    <Input
                      type="number"
                      placeholder="e.g. 37.35"
                      step="0.01"
                      value={defaultRate}
                      onChange={e => setDefaultRate(e.target.value)}
                      className="w-32 h-9"
                    />
                    <Button size="sm" variant="outline" onClick={applyDefault} disabled={!defaultRate}>
                      Apply to all
                    </Button>
                  </div>
                </div>
                {allShifts.length > 0 && (
                  <p className="text-xs text-muted-foreground ml-auto self-end pb-1">
                    {allShifts.length} shifts · {staffBuckets.length} staff members
                  </p>
                )}
              </div>
            </CardContent>
          </Card>

          {/* Table */}
          <Card>
            <CardContent className="p-0">
              {isLoading ? (
                <div className="py-12"><LoadingScreen message="Computing pay hours…" /></div>
              ) : shiftsError ? (
                <div className="py-8 text-center text-destructive text-sm px-4">
                  <AlertCircle className="h-5 w-5 mx-auto mb-2" />
                  Error loading shifts: {shiftsError.message}
                </div>
              ) : staffBuckets.length === 0 ? (
                <div className="py-12 text-center text-muted-foreground text-sm">
                  No shifts found. Upload a ShiftCare CSV on the Shifts tab first.
                </div>
              ) : (
                <div className="overflow-x-auto">
                  <Table>
                    <TableHeader>
                      <TableRow className="bg-muted/40">
                        <TableHead className="text-xs uppercase tracking-wider min-w-[180px]">Staff Member</TableHead>
                        <TableHead className="text-xs uppercase tracking-wider min-w-[130px]">Base Rate ($)</TableHead>
                        <TableHead className="text-xs uppercase tracking-wider text-right whitespace-nowrap">1.0× Hrs<br/><span className="text-muted-foreground font-normal normal-case tracking-normal">Weekday ord.</span></TableHead>
                        <TableHead className="text-xs uppercase tracking-wider text-right whitespace-nowrap">1.5× Hrs<br/><span className="text-purple-600 font-normal normal-case tracking-normal">Sat / OT-1</span></TableHead>
                        <TableHead className="text-xs uppercase tracking-wider text-right whitespace-nowrap">2.0× Hrs<br/><span className="text-red-500 font-normal normal-case tracking-normal">Sun / OT-2</span></TableHead>
                        <TableHead className="text-xs uppercase tracking-wider text-right whitespace-nowrap">2.5× Hrs<br/><span className="text-blue-600 font-normal normal-case tracking-normal">Public Hol.</span></TableHead>
                        <TableHead className="text-xs uppercase tracking-wider text-right">Total Hrs</TableHead>
                        <TableHead className="text-xs uppercase tracking-wider text-right">Allowances</TableHead>
                        <TableHead className="text-xs uppercase tracking-wider text-right min-w-[110px]">Gross Pay</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {staffBuckets.map((row) => {
                        const rateVal = baseRates[row.staffName] ?? defaultRate;
                        const gross   = calcGross(row, rateVal);
                        return (
                          <TableRow key={row.staffName} className="hover:bg-muted/30">
                            <TableCell className="font-medium text-sm">{row.staffName}</TableCell>
                            <TableCell>
                              <div className="flex items-center gap-1">
                                <span className="text-muted-foreground text-sm">$</span>
                                <Input
                                  type="number"
                                  placeholder="0.00"
                                  step="0.01"
                                  value={baseRates[row.staffName] ?? defaultRate}
                                  onChange={e => setRate(row.staffName, e.target.value)}
                                  className="h-7 w-24 text-sm px-2"
                                />
                              </div>
                            </TableCell>
                            <TableCell className="text-right text-sm tabular-nums">{fmtH(row.x1)}</TableCell>
                            <TableCell className="text-right text-sm tabular-nums text-purple-700">{fmtH(row.x1_5)}</TableCell>
                            <TableCell className="text-right text-sm tabular-nums text-red-600">{fmtH(row.x2)}</TableCell>
                            <TableCell className="text-right text-sm tabular-nums text-blue-700">{fmtH(row.x2_5)}</TableCell>
                            <TableCell className="text-right text-sm tabular-nums font-medium">{fmtH(row.totalHours)}</TableCell>
                            <TableCell className="text-right text-sm tabular-nums text-amber-700">
                              {row.allowances > 0 ? fmt(row.allowances) : '—'}
                            </TableCell>
                            <TableCell className="text-right text-sm tabular-nums font-bold">
                              {gross !== null ? fmt(gross) : <span className="text-muted-foreground font-normal">—</span>}
                            </TableCell>
                          </TableRow>
                        );
                      })}

                      {/* Totals */}
                      <TableRow className="border-t-2 border-border bg-muted/20 font-bold">
                        <TableCell className="text-sm">Totals</TableCell>
                        <TableCell />
                        <TableCell className="text-right text-sm tabular-nums">{fmtH(r2(totals.x1))}</TableCell>
                        <TableCell className="text-right text-sm tabular-nums text-purple-700">{fmtH(r2(totals.x1_5))}</TableCell>
                        <TableCell className="text-right text-sm tabular-nums text-red-600">{fmtH(r2(totals.x2))}</TableCell>
                        <TableCell className="text-right text-sm tabular-nums text-blue-700">{fmtH(r2(totals.x2_5))}</TableCell>
                        <TableCell className="text-right text-sm tabular-nums">{fmtH(r2(totals.totalHours))}</TableCell>
                        <TableCell className="text-right text-sm tabular-nums text-amber-700">
                          {totals.allowances > 0 ? fmt(r2(totals.allowances)) : '—'}
                        </TableCell>
                        <TableCell className="text-right text-sm tabular-nums">
                          {totals.grossReady ? fmt(r2(totals.gross)) : <span className="text-muted-foreground font-normal text-xs">enter rates</span>}
                        </TableCell>
                      </TableRow>
                    </TableBody>
                  </Table>
                </div>
              )}
            </CardContent>
          </Card>

          {/* Disclaimer */}
          <div className="bg-amber-50 border border-amber-400 p-3 text-xs text-amber-800 leading-relaxed rounded-sm">
            ⚠ <strong>Estimates only.</strong> Based on SCHADS Award MA000100 (effective 01/07/2024). Ordinary time: 7.6h/day and 38h/week thresholds. Broken shift allowance: $18.43/break (max 2/day). Public holidays must be configured in the Holiday Manager on the Pay Hours page. Always verify against the{' '}
            <a href="https://www.fairwork.gov.au" target="_blank" rel="noopener noreferrer" className="underline text-amber-700">official Fair Work pay guide</a>.
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
