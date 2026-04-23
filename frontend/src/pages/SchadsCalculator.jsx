import React, { useState, useMemo, useCallback, useEffect, useRef } from 'react';
import { Link } from 'react-router-dom';
import * as XLSX from 'xlsx';
import { Plus, X, AlertCircle, Upload, FileSpreadsheet, ChevronDown, UserPlus, EyeOff, Trash2 } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '../ui/card';
import { Button } from '../ui/button';
import { Input } from '../ui/input';
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from '../ui/table';
import { usePayHours } from '../api/payHours';
import { LoadingScreen } from '../ui/LoadingSpinner';
import {
  DAILY_ORD,
  WEEKLY_ORD,
  BROKEN_ALLOWANCE_1,
  BROKEN_ALLOWANCE_2,
  MEAL_ALLOWANCE,
  VEHICLE_RATE,
  OT_1,
  OT_2,
  r2,
  calcGrossFromRates,
  calcBreakdownFromRates,
  calcGross,
  calcAllowances,
  staffTotalHours,
  totalOtHrs,
  calcBreakdown,
  effectiveSleepoverRate,
} from '../lib/schadsWageCalc';

const fmt = (n) => '$' + n.toFixed(2).replace(/\B(?=(\d{3})+(?!\d))/g, ',');
const fmtH = (n) => n.toFixed(2) + 'h';

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

function computeManual(baseRate, empType, days, customAllowances = []) {
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
  const brokenAllowancePay = brokenDays * BROKEN_ALLOWANCE_1;
  if (brokenAllowancePay > 0) tableRows.push({ dayName: '—', segLabel: 'Broken shift allowance', hours: null, type: `$${BROKEN_ALLOWANCE_1}/shift × ${brokenDays}`, cls: 'allow', pay: brokenAllowancePay, isAllow: true });

  const customAllowancePay = customAllowances
    .map(a => ({ label: (a?.label || '').trim() || 'Custom allowance', amount: Number(a?.amount || 0) }))
    .filter(a => a.amount > 0)
    .reduce((sum, a) => {
      tableRows.push({ dayName: '—', segLabel: a.label, hours: null, type: 'Custom allowance', cls: 'allow', pay: a.amount, isAllow: true });
      return sum + a.amount;
    }, 0);

  const allowances = brokenAllowancePay + customAllowancePay;

  const totalHours = allShifts.reduce((a, s) => a + s.seg.hours, 0);
  const ordHours   = totalHours - totalOtHours;
  const gross      = basePay + penaltyExtra + otPay + allowances;
  return { gross, basePay, penaltyExtra, otPay, allowances, totalHours, ordHours, totalOtHours, tableRows };
}

const ROW_CLS = { sat: 'text-purple-700', sun: 'text-red-600', ph: 'text-blue-700', ot: 'text-orange-600', allow: 'text-amber-700' };
function rowClass(cls) { if (!cls) return ''; for (const c of cls.split(' ')) if (ROW_CLS[c]) return ROW_CLS[c]; return ''; }

// ── Pay Breakdown panel (rendered inside the table as an expanded row) ──
const CAT_STYLE = {
  ord:     { cls: 'text-foreground',     label: 'Ordinary',           bg: '' },
  penalty: { cls: 'text-orange-600',     label: 'Penalty loading',    bg: 'bg-orange-50/40' },
  ot:      { cls: 'text-rose-600 font-semibold', label: 'Overtime',   bg: 'bg-rose-50/40' },
  ot76:    { cls: 'text-rose-700 font-semibold', label: 'OT >76h',    bg: 'bg-rose-100/50' },
};

const PayBreakdownPanel = ({ mrow, staffName, baseRate, empType, isCasual, staffRates }) => {
  const bd = staffRates ? calcBreakdownFromRates(mrow, staffRates) : calcBreakdown(mrow, baseRate, empType);
  if (!bd) return (
    <div className="p-4 text-sm text-muted-foreground">Enter a base rate above to see the pay breakdown.</div>
  );

  const pct = (n, total) => total > 0 ? ` (${((n / total) * 100).toFixed(0)}%)` : '';

  return (
    <div className="p-4 space-y-4 bg-muted/5 border-t border-border/40 w-full overflow-x-hidden">
      {/* Hero */}
      <div className="flex items-end justify-between flex-wrap gap-3 bg-foreground text-background rounded p-4">
        <div>
          <p className="text-[10px] uppercase tracking-widest opacity-60 mb-1">Gross Pay — {staffName}</p>
          <p className="font-bold text-2xl font-mono">{fmt(bd.gross)}</p>
          {bd.fromRates
            ? <p className="text-[11px] opacity-70 mt-0.5">Rates from file · daytime ${bd.base.toFixed(2)}/h</p>
            : isCasual && <p className="text-[11px] opacity-70 mt-0.5">Casual rate · base ${(bd.base||0).toFixed(2)}/h + ${(bd.load||0).toFixed(2)} loading</p>
          }
        </div>
        <div className="text-right">
          <p className="text-[10px] uppercase tracking-widest opacity-60 mb-1">Total Hours</p>
          <p className="font-bold text-xl font-mono">{fmtH(bd.totalHours)}</p>
        </div>
      </div>

      {/* Mini summary grid */}
      <div className="grid grid-cols-3 sm:grid-cols-6 gap-px bg-border rounded overflow-hidden text-xs">
        {[
          { label: 'Base Pay',         val: fmt(bd.basePay),      cls: '' },
          { label: 'Penalty Loadings', val: fmt(bd.penaltyExtra), cls: 'text-orange-600' },
          { label: 'Overtime Pay',     val: fmt(bd.otPay),        cls: 'text-rose-600' },
          { label: 'Allowances',       val: fmt(bd.allow.total),  cls: 'text-amber-600' },
          { label: 'Ordinary Hrs',     val: fmtH(bd.ordHours),    cls: '' },
          { label: 'OT Hours',         val: fmtH(bd.otHours),     cls: 'text-rose-600' },
        ].map(({ label, val, cls }) => (
          <div key={label} className="bg-background p-3">
            <p className="text-[10px] uppercase tracking-wider text-muted-foreground">{label}</p>
            <p className={`font-bold text-sm mt-0.5 font-mono ${cls}`}>{val}</p>
          </div>
        ))}
      </div>

      {/* Line-by-line table */}
      <div className="rounded border border-border overflow-x-auto">
        <div className="bg-muted/40 px-3 py-2 text-[10px] uppercase tracking-wider font-semibold border-b border-border">
          Line-by-line Calculation
        </div>
        <table className="w-full text-xs border-collapse">
          <thead>
            <tr className="bg-muted/20 text-[10px] uppercase tracking-wider text-muted-foreground">
              <th className="text-left px-3 py-2 font-medium">Category</th>
              <th className="text-right px-3 py-2 font-medium">Hours</th>
              <th className="text-right px-3 py-2 font-medium">Mult / Rate</th>
              <th className="text-right px-3 py-2 font-medium">Pay</th>
            </tr>
          </thead>
          <tbody>
            {bd.lines.map((l, i) => {
              const style = CAT_STYLE[l.cat] || CAT_STYLE.ord;
              return (
                <tr key={i} className={`border-t border-border/30 ${style.bg}`}>
                  <td className={`px-3 py-2 ${style.cls}`}>
                    {l.label}
                    <span className="ml-1.5 text-[9px] font-normal text-muted-foreground/60 uppercase">{style.label}</span>
                  </td>
                  <td className="text-right px-3 py-2 font-mono">{fmtH(l.hours)}</td>
                  <td className="text-right px-3 py-2 font-mono text-muted-foreground">
                    {l.mult != null ? `${l.mult.toFixed(2)}×` : `$${l.effRate.toFixed(2)}/h`}
                  </td>
                  <td className={`text-right px-3 py-2 font-mono font-semibold ${style.cls}`}>{fmt(l.pay)}</td>
                </tr>
              );
            })}
            {/* Allowances */}
            {(mrow.brokenShiftCount || 0) > 0 && (
              <tr className="border-t border-border/30 bg-amber-50/30">
                <td className="px-3 py-2 text-amber-700">
                  Broken shift — 1 break ({mrow.brokenShiftCount} × ${staffRates ? staffRates.brokenShift.toFixed(2) : BROKEN_ALLOWANCE_1})
                  <span className="ml-1.5 text-[9px] font-normal text-muted-foreground/60 uppercase">Allowance</span>
                </td>
                <td className="text-right px-3 py-2 font-mono text-muted-foreground">{mrow.brokenShiftCount}</td>
                <td className="text-right px-3 py-2 font-mono text-muted-foreground">—</td>
                <td className="text-right px-3 py-2 font-mono font-semibold text-amber-700">{fmt(bd.allow.broken1Allow ?? bd.allow.brokenAllow)}</td>
              </tr>
            )}
            {(mrow.brokenShift2BreakCount || 0) > 0 && (
              <tr className="border-t border-border/30 bg-amber-50/30">
                <td className="px-3 py-2 text-amber-700">
                  Broken shift — 2 breaks ({mrow.brokenShift2BreakCount} × ${BROKEN_ALLOWANCE_2})
                  <span className="ml-1.5 text-[9px] font-normal text-muted-foreground/60 uppercase">Allowance</span>
                </td>
                <td className="text-right px-3 py-2 font-mono text-muted-foreground">{mrow.brokenShift2BreakCount}</td>
                <td className="text-right px-3 py-2 font-mono text-muted-foreground">—</td>
                <td className="text-right px-3 py-2 font-mono font-semibold text-amber-700">{fmt(bd.allow.broken2Allow ?? 0)}</td>
              </tr>
            )}
            {bd.allow.sleepAllow > 0 && (
              <tr className="border-t border-border/30 bg-amber-50/30">
                <td className="px-3 py-2 text-amber-700">
                  Sleepover allowance ({mrow.sleepoversCount} × ${staffRates ? effectiveSleepoverRate(staffRates).toFixed(2) : '0.00'})
                  {(staffRates?.sleepoverExtra || 0) > 0 && (
                    <span className="block text-[10px] font-normal text-muted-foreground mt-0.5">
                      base ${staffRates.sleepover.toFixed(2)} + extra ${staffRates.sleepoverExtra.toFixed(2)}/night
                    </span>
                  )}
                  <span className="ml-1.5 text-[9px] font-normal text-muted-foreground/60 uppercase">Allowance</span>
                </td>
                <td className="text-right px-3 py-2 font-mono text-muted-foreground">{mrow.sleepoversCount}</td>
                <td className="text-right px-3 py-2 font-mono text-muted-foreground">—</td>
                <td className="text-right px-3 py-2 font-mono font-semibold text-amber-700">{fmt(bd.allow.sleepAllow)}</td>
              </tr>
            )}
            {bd.allow.mealAllow > 0 && (
              <tr className="border-t border-border/30 bg-amber-50/30">
                <td className="px-3 py-2 text-amber-600">
                  Meal allowance ({mrow.mealAllowanceCount || 0} × ${MEAL_ALLOWANCE})
                  <span className="ml-1.5 text-[9px] font-normal text-muted-foreground/60 uppercase">Allowance</span>
                </td>
                <td className="text-right px-3 py-2 font-mono text-muted-foreground">—</td>
                <td className="text-right px-3 py-2 font-mono text-muted-foreground">—</td>
                <td className="text-right px-3 py-2 font-mono font-semibold text-amber-600">{fmt(bd.allow.mealAllow)}</td>
              </tr>
            )}
            {(bd.allow.mileageAllow || 0) > 0 && (
              <tr className="border-t border-border/30 bg-emerald-50/30">
                <td className="px-3 py-2 text-emerald-700">
                  Mileage allowance ({mrow.totalKm || 0} km × ${(staffRates?.kmRate || VEHICLE_RATE).toFixed(2)}/km)
                  <span className="ml-1.5 text-[9px] font-normal text-muted-foreground/60 uppercase">Allowance</span>
                </td>
                <td className="text-right px-3 py-2 font-mono text-muted-foreground">{mrow.totalKm || 0} km</td>
                <td className="text-right px-3 py-2 font-mono text-muted-foreground">${(staffRates?.kmRate || VEHICLE_RATE).toFixed(2)}/km</td>
                <td className="text-right px-3 py-2 font-mono font-semibold text-emerald-700">{fmt(bd.allow.mileageAllow)}</td>
              </tr>
            )}
            {/* Total row */}
            <tr className="border-t-2 border-border bg-muted/20 font-bold">
              <td className="px-3 py-2.5 text-sm">Total</td>
              <td className="text-right px-3 py-2.5 font-mono">{fmtH(bd.totalHours)}</td>
              <td className="text-right px-3 py-2.5 text-muted-foreground">—</td>
              <td className="text-right px-3 py-2.5 font-mono text-base">{fmt(bd.gross)}</td>
            </tr>
          </tbody>
        </table>
      </div>

      {/* Pct breakdown bar */}
      <div className="space-y-1">
        <p className="text-[10px] uppercase tracking-wider text-muted-foreground">Pay composition</p>
        <div className="flex rounded overflow-hidden h-3 text-[0px]">
          {bd.basePay > 0 && <div title={`Base ${fmt(bd.basePay)}`} style={{ width: `${(bd.basePay / bd.gross) * 100}%` }} className="bg-slate-400" />}
          {bd.penaltyExtra > 0 && <div title={`Penalty ${fmt(bd.penaltyExtra)}`} style={{ width: `${(bd.penaltyExtra / bd.gross) * 100}%` }} className="bg-orange-400" />}
          {bd.otPay > 0 && <div title={`OT ${fmt(bd.otPay)}`} style={{ width: `${(bd.otPay / bd.gross) * 100}%` }} className="bg-rose-500" />}
          {bd.allow.total > 0 && <div title={`Allow. ${fmt(bd.allow.total)}`} style={{ width: `${(bd.allow.total / bd.gross) * 100}%` }} className="bg-amber-400" />}
        </div>
        <div className="flex gap-4 flex-wrap text-[10px] text-muted-foreground">
          <span><span className="inline-block w-2 h-2 rounded-sm bg-slate-400 mr-1" />Base {pct(bd.basePay, bd.gross)}</span>
          <span><span className="inline-block w-2 h-2 rounded-sm bg-orange-400 mr-1" />Penalty {pct(bd.penaltyExtra, bd.gross)}</span>
          <span><span className="inline-block w-2 h-2 rounded-sm bg-rose-500 mr-1" />OT {pct(bd.otPay, bd.gross)}</span>
          {bd.allow.total > 0 && <span><span className="inline-block w-2 h-2 rounded-sm bg-amber-400 mr-1" />Allow. {pct(bd.allow.total, bd.gross)}</span>}
        </div>
      </div>
    </div>
  );
};

/** Collapsible pay-hours grid (same metrics as summary row) below payslip breakdown. */
const PayHoursSnapshot = ({ mrow, allow: allowProp }) => {
  const allow = allowProp || calcAllowances(mrow);
  const fmtSnap = (label, val) => {
    if (val == null || (typeof val === 'number' && val <= 0)) return '—';
    if (label.includes('$')) return fmt(val);
    if (label === 'Km') return `${val} km`;
    if (label.endsWith('#')) return String(val);
    return fmtH(val);
  };
  const cells = [
    ['Morning', mrow.morningHours, 'text-yellow-700'],
    ['Afternoon', mrow.afternoonHours, 'text-orange-700'],
    ['Night', mrow.nightHours, 'text-indigo-700'],
    ['WD OT ≤2h', mrow.weekdayOtUpto2, 'text-orange-600'],
    ['WD OT >2h', mrow.weekdayOtAfter2, 'text-orange-700'],
    ['Saturday', mrow.saturdayHours, 'text-cyan-700'],
    ['Sat OT ≤2h', mrow.saturdayOtUpto2, 'text-cyan-600'],
    ['Sat OT >2h', mrow.saturdayOtAfter2, 'text-cyan-600'],
    ['Sunday (all)', r2((mrow.sundayHours || 0) + (mrow.sundayOtUpto2 || 0) + (mrow.sundayOtAfter2 || 0)), 'text-red-700'],
    ['Holiday (all)', r2((mrow.holidayHours || 0) + (mrow.holidayOtUpto2 || 0) + (mrow.holidayOtAfter2 || 0)), 'text-blue-700'],
    ['Nursing', mrow.nursingCareHours, 'text-teal-700'],
    ['Broken #', mrow.brokenShiftCount, 'text-orange-700'],
    ['Sleepovers #', mrow.sleepoversCount, 'text-purple-700'],
    ['OT >76 WD', mrow.otAfter76Weekday, 'text-rose-700'],
    ['OT >76 Sat', mrow.otAfter76Saturday, 'text-rose-600'],
    ['OT >76 Sun', mrow.otAfter76Sunday, 'text-rose-500'],
    ['OT >76 PH', mrow.otAfter76Holiday, 'text-rose-800'],
    ['Km', mrow.totalKm, 'text-emerald-700'],
    ['Broken $', allow.brokenAllow, 'text-amber-700'],
    ['Meal $', allow.mealAllow, 'text-amber-600'],
    ['Mileage $', allow.mileageAllow, 'text-emerald-600'],
  ];
  return (
    <details className="group border-t border-border/40 bg-muted/10">
      <summary className="flex cursor-pointer items-center gap-2 px-4 py-2.5 text-xs font-semibold text-muted-foreground hover:bg-muted/30 list-none [&::-webkit-details-marker]:hidden">
        <ChevronDown className="h-4 w-4 shrink-0 transition-transform group-open:rotate-180" />
        Pay hours detail
      </summary>
      <div className="px-4 pb-4 grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-2 text-[11px]">
        {cells.map(([label, val, cls]) => (
          <div key={label} className="rounded border border-border/50 bg-background px-2 py-1.5">
            <div className="text-[9px] uppercase tracking-wider text-muted-foreground">{label}</div>
            <div className={`font-mono font-medium tabular-nums ${cls}`}>{fmtSnap(label, val)}</div>
          </div>
        ))}
      </div>
    </details>
  );
};

const EMPTY_PAY_HOURS = (staffName) => ({
  staffName,
  morningHours: 0,
  afternoonHours: 0,
  nightHours: 0,
  weekdayOtUpto2: 0,
  weekdayOtAfter2: 0,
  saturdayHours: 0,
  saturdayOtUpto2: 0,
  saturdayOtAfter2: 0,
  sundayHours: 0,
  sundayOtUpto2: 0,
  sundayOtAfter2: 0,
  holidayHours: 0,
  holidayOtUpto2: 0,
  holidayOtAfter2: 0,
  nursingCareHours: 0,
  otAfter76Hours: 0,
  otAfter76Weekday: 0,
  otAfter76Saturday: 0,
  otAfter76Sunday: 0,
  otAfter76Holiday: 0,
  brokenShiftCount: 0,
  brokenShift2BreakCount: 0,
  mealAllowanceCount: 0,
  sleepoversCount: 0,
  totalKm: 0,
  _manualOnly: true,
});

function schadsStorageKey(locationId) {
  return `schads-calculator-v1:${locationId || 'global'}`;
}

// ── Right-click editable field registry ──────────────────────────────
const EDITABLE_FIELDS = {
  morningHours:      'Morning Hours',
  afternoonHours:    'Afternoon Hours',
  nightHours:        'Night Hours',
  weekdayOtUpto2:    'WD OT ≤2h',
  weekdayOtAfter2:   'WD OT >2h',
  saturdayHours:     'Saturday Hours',
  saturdayOtUpto2:   'Sat OT ≤2h',
  saturdayOtAfter2:  'Sat OT >2h',
  sundayHours:       'Sunday Hours',
  sundayOtUpto2:     'Sun OT ≤2h',
  sundayOtAfter2:    'Sun OT >2h',
  holidayHours:      'Holiday Hours',
  holidayOtUpto2:    'Hol OT ≤2h',
  holidayOtAfter2:   'Hol OT >2h',
  nursingCareHours:  'Nursing Hours',
  brokenShiftCount:  'Broken Shifts #',
  sleepoversCount:   'Sleepovers #',
  otAfter76Weekday:  'OT >76h (Weekday)',
  otAfter76Saturday: 'OT >76h (Saturday)',
  otAfter76Sunday:   'OT >76h (Sunday)',
  otAfter76Holiday:  'OT >76h (Holiday)',
};

// ── Floating context-menu editor ─────────────────────────────────────
const CellContextMenu = ({ menu, overrides, onSave, onClear, onClose }) => {
  const ref      = useRef(null);
  const inputRef = useRef(null);
  const overrideKey = menu ? `${menu.staffName}:${menu.field}` : null;
  const isOverridden = overrideKey && (overrideKey in overrides);
  const [draft, setDraft] = useState('');

  // Seed draft with current override or original value when menu opens
  useEffect(() => {
    if (!menu) return;
    setDraft(isOverridden ? String(overrides[overrideKey]) : String(menu.original ?? 0));
    setTimeout(() => inputRef.current?.select(), 0);
  }, [menu]);

  // Close on Escape or outside click
  useEffect(() => {
    if (!menu) return;
    const onKey  = (e) => { if (e.key === 'Escape') onClose(); };
    const onDown = (e) => { if (ref.current && !ref.current.contains(e.target)) onClose(); };
    document.addEventListener('keydown', onKey);
    document.addEventListener('mousedown', onDown);
    return () => { document.removeEventListener('keydown', onKey); document.removeEventListener('mousedown', onDown); };
  }, [menu, onClose]);

  if (!menu) return null;

  const handleSave = () => {
    const n = parseFloat(draft);
    if (!isNaN(n) && n >= 0) onSave(menu.staffName, menu.field, n);
    onClose();
  };

  // Keep menu inside viewport
  const vpW = window.innerWidth, vpH = window.innerHeight;
  const W = 260, H = 160;
  const left = Math.min(menu.x + 4, vpW - W - 12);
  const top  = Math.min(menu.y + 4, vpH - H - 12);

  return (
    <div
      ref={ref}
      style={{ position: 'fixed', left, top, zIndex: 9999, width: W }}
      className="bg-popover border border-border rounded-lg shadow-xl p-3 space-y-2"
    >
      <div className="flex items-center justify-between">
        <p className="text-xs font-semibold text-foreground">{EDITABLE_FIELDS[menu.field]}</p>
        {isOverridden && (
          <span className="text-[10px] bg-blue-100 text-blue-700 px-1.5 py-0.5 rounded font-medium">overridden</span>
        )}
      </div>
      <p className="text-[11px] text-muted-foreground">
        Staff: <span className="font-medium text-foreground">{menu.staffName}</span>
        &nbsp;·&nbsp;Original: <span className="font-mono">{menu.original ?? 0}</span>
      </p>
      <input
        ref={inputRef}
        type="number"
        step="0.01"
        min="0"
        value={draft}
        onChange={e => setDraft(e.target.value)}
        onKeyDown={e => { if (e.key === 'Enter') handleSave(); }}
        className="w-full h-8 rounded-md border border-input bg-background px-2 text-sm font-mono focus:outline-none focus:ring-2 focus:ring-ring"
      />
      <div className="flex gap-2">
        <button
          onClick={handleSave}
          className="flex-1 h-7 rounded bg-primary text-primary-foreground text-xs font-medium hover:bg-primary/90"
        >
          Save
        </button>
        {isOverridden && (
          <button
            onClick={() => { onClear(menu.staffName, menu.field); onClose(); }}
            className="flex-1 h-7 rounded border border-input text-xs text-muted-foreground hover:bg-muted"
          >
            Clear override
          </button>
        )}
        <button
          onClick={onClose}
          className="h-7 px-2 rounded border border-input text-xs text-muted-foreground hover:bg-muted"
        >
          ✕
        </button>
      </div>
    </div>
  );
};
function pillCls(type, isPH) {
  if (isPH) return 'border-blue-400 text-blue-700 bg-blue-50';
  if (type === 'saturday') return 'border-purple-400 text-purple-700 bg-purple-50';
  if (type === 'sunday')   return 'border-red-400 text-red-600 bg-red-50';
  return 'border-border text-muted-foreground bg-background';
}

// ════════════════════════════════════════════════════════════════════
// Main Component
// ════════════════════════════════════════════════════════════════════
export function SchadsCalculator({ locationId: locationIdProp, onStaffRatesMapChange } = {}) {
  const normName = useCallback((s) => s?.toString().toLowerCase().replace(/\s+/g, ' ').trim() ?? '', []);

  const [view, setView] = useState('summary'); // 'summary' | 'manual'

  // ── Staff Summary state ──────────────────────────────────────────
  const [baseRates, setBaseRates] = useState({});       // { staffName: string }
  const [defaultRate, setDefaultRate] = useState('');
  const [empTypes, setEmpTypes] = useState({});          // { staffName: 'permanent' | 'casual' }
  const [defaultEmpType, setDefaultEmpType] = useState('casual');

  // ── Breakdown expand state ───────────────────────────────────────
  const [expandedBreakdown, setExpandedBreakdown] = useState({});
  const toggleBreakdown = useCallback((staffName) =>
    setExpandedBreakdown(prev => ({ ...prev, [staffName]: !prev[staffName] })), []);

  // ── Cell override state ──────────────────────────────────────────
  // key: `${staffName}:${field}`, value: number
  const [overrides, setOverrides] = useState({});
  const [ctxMenu, setCtxMenu]     = useState(null); // { x, y, staffName, field, original }

  const [manualStaffNames, setManualStaffNames] = useState([]);
  const [hiddenNormNames, setHiddenNormNames] = useState([]);
  const [addStaffDraft, setAddStaffDraft] = useState('');
  const unifiedDocRef = useRef(null);

  const saveOverride  = useCallback((staffName, field, value) => {
    setOverrides(prev => ({ ...prev, [`${staffName}:${field}`]: value }));
  }, []);
  const clearOverride = useCallback((staffName, field) => {
    setOverrides(prev => { const n = { ...prev }; delete n[`${staffName}:${field}`]; return n; });
  }, []);
  const closeCtx = useCallback(() => setCtxMenu(null), []);

  // Merge backend row with any manual overrides before passing to calculators
  const getMergedRow = useCallback((row) => {
    const merged = { ...row };
    for (const field of Object.keys(EDITABLE_FIELDS)) {
      const key = `${row.staffName}:${field}`;
      if (key in overrides) merged[field] = overrides[key];
    }
    return merged;
  }, [overrides]);

  // Right-click handler for numeric data cells
  const handleCtx = useCallback((e, staffName, field, original) => {
    e.preventDefault();
    setCtxMenu({ x: e.clientX, y: e.clientY, staffName, field, original });
  }, []);

  const payHoursQueryParams = useMemo(() => {
    const p = {};
    if (locationIdProp) p.locationId = locationIdProp;
    return p;
  }, [locationIdProp]);

  const { data: payHoursData, isLoading: phLoading, error: phError } = usePayHours(payHoursQueryParams);

  const apiRows = useMemo(
    () => (payHoursData?.payHours || []).slice().sort((a, b) => a.staffName.localeCompare(b.staffName)),
    [payHoursData]
  );

  const staffRows = useMemo(() => {
    const byNorm = new Map();
    for (const row of apiRows) {
      byNorm.set(normName(row.staffName), { ...row });
    }
    for (const name of manualStaffNames) {
      const trimmed = name.trim();
      if (!trimmed) continue;
      const k = normName(trimmed);
      if (!byNorm.has(k)) byNorm.set(k, EMPTY_PAY_HOURS(trimmed));
    }
    return Array.from(byNorm.values()).sort((a, b) => a.staffName.localeCompare(b.staffName));
  }, [apiRows, manualStaffNames, normName]);

  const displayRows = useMemo(
    () => staffRows.filter((r) => !hiddenNormNames.includes(normName(r.staffName))),
    [staffRows, hiddenNormNames, normName]
  );

  const storageKey = useMemo(() => schadsStorageKey(locationIdProp), [locationIdProp]);

  const getEmpType = useCallback((staffName) => empTypes[staffName] ?? defaultEmpType, [empTypes, defaultEmpType]);

  // Totals row
  const totals = useMemo(() => {
    const COLS = ['morningHours','afternoonHours','nightHours','weekdayOtUpto2','weekdayOtAfter2',
      'saturdayHours','saturdayOtUpto2','saturdayOtAfter2','sundayHours','sundayOtUpto2','sundayOtAfter2',
      'holidayHours','holidayOtUpto2','holidayOtAfter2','nursingCareHours','brokenShiftCount','sleepoversCount',
      'otAfter76Hours'];
    const t = Object.fromEntries(COLS.map(c => [c, 0]));
    t.totalHours = 0; t.gross = 0; t.brokenAllow = 0; t.mealAllow = 0; t.mileageAllow = 0; t.totalOT = 0; t.totalKm = 0;
    let grossCount = 0;
    for (const row of displayRows) {
      const mrow = getMergedRow(row);
      for (const col of COLS) t[col] = r2((t[col] || 0) + (mrow[col] || 0));
      t.totalHours = r2(t.totalHours + staffTotalHours(mrow));
      t.totalOT    = r2(t.totalOT    + totalOtHrs(mrow));
      t.totalKm    = r2(t.totalKm    + (mrow.totalKm || 0));
      const allow = calcAllowances(mrow);
      t.brokenAllow   = r2(t.brokenAllow   + allow.brokenAllow);
      t.mealAllow     = r2(t.mealAllow     + allow.mealAllow);
      t.mileageAllow  = r2(t.mileageAllow  + allow.mileageAllow);
      const rate = baseRates[row.staffName] ?? defaultRate;
      const empT = empTypes[row.staffName] ?? defaultEmpType;
      const g = calcGross(mrow, rate, empT);
      if (g !== null) { t.gross = r2(t.gross + g); grossCount++; }
    }
    return { ...t, grossReady: displayRows.length > 0 && grossCount === displayRows.length };
  }, [displayRows, baseRates, defaultRate, empTypes, defaultEmpType, getMergedRow]);

  // Count staff with any exception (OT, OT>76, or broken shifts)
  const exceptionCount = useMemo(() =>
    displayRows.filter(row => {
      const m = getMergedRow(row);
      return totalOtHrs(m) > 0 || (m.brokenShiftCount || 0) > 0 ||
        (m.otAfter76Weekday||0) > 0 || (m.otAfter76Saturday||0) > 0 ||
        (m.otAfter76Sunday||0) > 0  || (m.otAfter76Holiday||0) > 0;
    }).length,
  [displayRows, getMergedRow]);

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

  // ── Payroll comparison state ─────────────────────────────────────
  const payrollFileRef = useRef(null);
  const ratesFileRef   = useRef(null);
  const [payrollData,   setPayrollData]   = useState(null); // Map: normName → { name, earnings }
  const [staffRatesMap, setStaffRatesMap] = useState(null); // Map: normName → rates object
  const [ratesFileName, setRatesFileName] = useState(null);
  const [schadsHydrated, setSchadsHydrated] = useState(false);

  useEffect(() => {
    setSchadsHydrated(false);
    try {
      const raw = localStorage.getItem(storageKey);
      if (raw) {
        const s = JSON.parse(raw);
        if (s.baseRates && typeof s.baseRates === 'object') setBaseRates(s.baseRates);
        if (s.empTypes && typeof s.empTypes === 'object') setEmpTypes(s.empTypes);
        if (typeof s.defaultRate === 'string') setDefaultRate(s.defaultRate);
        if (typeof s.defaultEmpType === 'string') setDefaultEmpType(s.defaultEmpType);
        if (Array.isArray(s.manualStaffNames)) setManualStaffNames(s.manualStaffNames);
        if (Array.isArray(s.hiddenNormNames)) setHiddenNormNames(s.hiddenNormNames);
        if (Array.isArray(s.staffRatesEntries) && s.staffRatesEntries.length > 0) {
          const m = new Map();
          for (const e of s.staffRatesEntries) {
            const { k, ...rest } = e;
            if (k) m.set(k, rest);
          }
          setStaffRatesMap(m);
          if (s.ratesFileName) onStaffRatesMapChange?.(m, s.ratesFileName);
        }
        if (s.ratesFileName) setRatesFileName(s.ratesFileName);
      }
    } catch (_) { /* ignore */ }
    setSchadsHydrated(true);
  }, [storageKey, onStaffRatesMapChange]);

  useEffect(() => {
    if (!schadsHydrated) return;
    try {
      const staffRatesEntries = staffRatesMap
        ? Array.from(staffRatesMap.entries()).map(([k, v]) => ({ k, ...v }))
        : [];
      localStorage.setItem(
        storageKey,
        JSON.stringify({
          baseRates,
          empTypes,
          defaultRate,
          defaultEmpType,
          manualStaffNames,
          hiddenNormNames,
          staffRatesEntries,
          ratesFileName,
        })
      );
    } catch (_) { /* ignore */ }
  }, [schadsHydrated, storageKey, baseRates, empTypes, defaultRate, defaultEmpType, manualStaffNames, hiddenNormNames, staffRatesMap, ratesFileName]);

  const ingestRatesWorkbook = useCallback((wb, fileLabel) => {
    const ws = wb.Sheets[wb.SheetNames[0]];
    const rows = XLSX.utils.sheet_to_json(ws, { header: 1, defval: '' });
    let headerIdx = -1;
    for (let i = 0; i < rows.length; i++) {
      const r = rows[i].map(c => c?.toString().toLowerCase().trim());
      if (r.some(h => h === 'employee name') && r.some(h => h.includes('daytime'))) { headerIdx = i; break; }
    }
    if (headerIdx === -1) { alert('Could not find Employee Name / Daytime Shift columns.'); return; }
    const h = rows[headerIdx].map(c => c?.toString().toLowerCase().trim());
    const ci = (keyword) => h.findIndex(x => x.includes(keyword));
    const sleepoverExtraCol = h.findIndex(
      (x) => x.includes('sleepover') && (x.includes('extra') || x.includes('bonus') || x.includes('additional'))
    );
    const idx = {
      emp:        h.findIndex(x => x === 'employee name'),
      daytime:    ci('daytime'),
      afternoon:  ci('afternoon'),
      night:      ci('night'),
      otUpto2:    h.findIndex(x => x === 'ot upto 2 hours'),
      otAfter2:   h.findIndex(x => x === 'ot after 2 hours'),
      saturday:   h.findIndex(x => x === 'saturday'),
      satOtAfter2:ci('saturday ot after'),
      sunday:     h.findIndex(x => x === 'sunday'),
      ph:         h.findIndex(x => x === 'public holiday'),
      mealAllow:  ci('overtime meal'),
      brokenShift:h.findIndex(x => x === 'broken shift'),
      sleepover:  ci('sleepover'),
      kmRate:     ci('mileage'),
    };
    const map = new Map();
    for (let i = headerIdx + 1; i < rows.length; i++) {
      const name = rows[i][idx.emp]?.toString().trim();
      if (!name) continue;
      const g = (k) => { const v = parseFloat(rows[i][idx[k]]); return isNaN(v) ? 0 : r2(v); };
      const gx = (col) => {
        if (col < 0) return 0;
        const v = parseFloat(rows[i][col]);
        return isNaN(v) ? 0 : r2(v);
      };
        const row = {
          name,
          daytime:    g('daytime'),
          afternoon:  g('afternoon'),
          night:      g('night'),
          otUpto2:    g('otUpto2'),
          otAfter2:   g('otAfter2'),
          saturday:   g('saturday'),
          satOtAfter2:g('satOtAfter2'),
          sunday:     g('sunday'),
          ph:         g('ph'),
          mealAllow:  g('mealAllow'),
          brokenShift:g('brokenShift'),
          sleepover:  g('sleepover'),
          kmRate:     g('kmRate') || VEHICLE_RATE,
        };
        if (sleepoverExtraCol >= 0) row.sleepoverExtra = gx(sleepoverExtraCol);
        map.set(normName(name), row);
    }
    setStaffRatesMap((prev) => {
      const next = new Map(prev || []);
      for (const [k, v] of map) {
        const cur = next.get(k);
        next.set(k, cur ? { ...cur, ...v, name: v.name || cur.name } : v);
      }
      onStaffRatesMapChange?.(next, fileLabel);
      return next;
    });
    setRatesFileName(fileLabel);
  }, [normName, onStaffRatesMapChange]);

  const ingestPayrollWorkbook = useCallback((wb) => {
    const ws = wb.Sheets[wb.SheetNames[0]];
    const rows = XLSX.utils.sheet_to_json(ws, { header: 1, defval: '' });
    let headerIdx = -1;
    for (let i = 0; i < rows.length; i++) {
      const r = rows[i].map(c => c?.toString().toLowerCase());
      if (r.includes('employee') && r.includes('earnings')) { headerIdx = i; break; }
    }
    if (headerIdx === -1) { alert('Could not find Employee/Earnings columns in this file.'); return; }
    const headers = rows[headerIdx].map(c => c?.toString().toLowerCase());
    const empIdx  = headers.indexOf('employee');
    const earnIdx = headers.indexOf('earnings');
    const map = new Map();
    for (let i = headerIdx + 1; i < rows.length; i++) {
      const name = rows[i][empIdx]?.toString().trim();
      const earn = parseFloat(rows[i][earnIdx]);
      if (name && !isNaN(earn)) map.set(normName(name), { name, earnings: earn });
    }
    setPayrollData(map);
  }, [normName]);

  const parseRatesFile = useCallback((file) => {
    const reader = new FileReader();
    reader.onload = (e) => {
      const wb = XLSX.read(e.target.result, { type: 'array' });
      ingestRatesWorkbook(wb, file.name);
    };
    reader.readAsArrayBuffer(file);
  }, [ingestRatesWorkbook]);

  const parsePayrollFile = useCallback((file) => {
    const reader = new FileReader();
    reader.onload = (e) => {
      const wb = XLSX.read(e.target.result, { type: 'array' });
      ingestPayrollWorkbook(wb);
    };
    reader.readAsArrayBuffer(file);
  }, [ingestPayrollWorkbook]);

  const parseUnifiedDoc = useCallback(
    (file) => {
      const reader = new FileReader();
      reader.onload = (e) => {
        const wb = XLSX.read(e.target.result, { type: 'array' });
        const ws = wb.Sheets[wb.SheetNames[0]];
        const rows = XLSX.utils.sheet_to_json(ws, { header: 1, defval: '' });
        let kind = null;
        for (let i = 0; i < Math.min(rows.length, 40); i++) {
          const r = rows[i].map((c) => c?.toString().toLowerCase().trim());
          if (r.includes('employee') && r.includes('earnings')) {
            kind = 'payroll';
            break;
          }
          if (r.some((h) => h === 'employee name') && r.some((h) => h.includes('daytime'))) {
            kind = 'rates';
            break;
          }
        }
        if (kind === 'payroll') ingestPayrollWorkbook(wb);
        else if (kind === 'rates') ingestRatesWorkbook(wb, file.name);
        else alert('Could not detect file type. Use a rates workbook (Employee Name + Daytime) or payroll export (Employee + Earnings).');
      };
      reader.readAsArrayBuffer(file);
    },
    [ingestPayrollWorkbook, ingestRatesWorkbook]
  );

  // ── Manual calculator state ──────────────────────────────────────
  const [manualRate, setManualRate]     = useState('');
  const [manualRateErr, setManualRateErr] = useState(false);
  const [manualEmpType, setManualEmpType] = useState('pt');
  const [manualDays, setManualDays]     = useState(() =>
    Array(7).fill(null).map(() => ({ open: false, isPH: false, segments: [] }))
  );
  const [manualCustomAllowances, setManualCustomAllowances] = useState([{ id: `ma-${Date.now()}`, label: '', amount: '' }]);
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

  const addManualCustomAllowance = useCallback(() => {
    setManualCustomAllowances(prev => [...prev, { id: `ma-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`, label: '', amount: '' }]);
  }, []);

  const removeManualCustomAllowance = useCallback((id) => {
    setManualCustomAllowances(prev => (prev.length > 1 ? prev.filter(a => a.id !== id) : prev));
  }, []);

  const updateManualCustomAllowance = useCallback((id, field, value) => {
    setManualCustomAllowances(prev => prev.map(a => (a.id === id ? { ...a, [field]: value } : a)));
  }, []);

  const runManual = useCallback(() => {
    const n = parseFloat(manualRate);
    const bad = !n || n < 10 || n > 200;
    setManualRateErr(bad);
    if (bad) return;
    if (manualDays.some(d => hasOverlap(d.segments))) { alert('Overlapping shift times. Please fix before calculating.'); return; }
    const r = computeManual(n, manualEmpType, manualDays, manualCustomAllowances);
    if (!r) { alert('Please enter at least one shift.'); return; }
    setManualResults(r);
  }, [manualRate, manualEmpType, manualDays, manualCustomAllowances]);

  const isLoading = phLoading;

  // Track scroll container width to constrain breakdown panel
  const tableContainerRef = useRef(null);
  const [tableContainerWidth, setTableContainerWidth] = useState(0);
  useEffect(() => {
    const el = tableContainerRef.current;
    if (!el) return;
    const ro = new ResizeObserver(([entry]) => setTableContainerWidth(entry.contentRect.width));
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  // ════════════════════════════════════════════════════════════════
  // Render
  // ════════════════════════════════════════════════════════════════
  const addStaffRow = useCallback(() => {
    const t = addStaffDraft.trim();
    if (!t) return;
    const k = normName(t);
    if (manualStaffNames.some((n) => normName(n) === k)) {
      setAddStaffDraft('');
      return;
    }
    setManualStaffNames((prev) => [...prev, t]);
    setAddStaffDraft('');
  }, [addStaffDraft, manualStaffNames, normName]);

  const summaryColSpan = 27 + (payrollData ? 3 : 0);

  return (
    <div className="space-y-4">
      {/* Floating cell editor (context menu) */}
      <CellContextMenu
        menu={ctxMenu}
        overrides={overrides}
        onSave={saveOverride}
        onClear={clearOverride}
        onClose={closeCtx}
      />

      <Card className="border-dashed border-2 border-primary/25 bg-primary/5">
        <CardHeader className="pb-2">
          <CardTitle className="text-sm flex items-center gap-2">
            <Upload className="h-4 w-4 text-primary" />
            Step 1 — Documents
          </CardTitle>
        </CardHeader>
        <CardContent className="text-sm space-y-3 pt-0">
          <ol className="list-decimal list-inside space-y-1.5 text-muted-foreground text-xs leading-relaxed">
            <li>
              Upload shift CSV and click <strong>Compute Pay Hours</strong> in{' '}
              <Link to="/workforce#workforce-pay-hours" className="text-primary underline font-medium">
                Workforce → Setup → Pay hours
              </Link>
              .
            </li>
            <li>Upload your award <strong>rates</strong> workbook and optional <strong>payroll</strong> export for comparison (buttons in summary card or auto-detect below).</li>
          </ol>
          <input
            ref={unifiedDocRef}
            type="file"
            accept=".xlsx,.xls"
            className="hidden"
            onChange={(e) => {
              if (e.target.files[0]) parseUnifiedDoc(e.target.files[0]);
              e.target.value = '';
            }}
          />
          <Button type="button" size="sm" variant="secondary" className="gap-2" onClick={() => unifiedDocRef.current?.click()}>
            <FileSpreadsheet className="h-4 w-4" />
            Upload spreadsheet (auto-detect rates or payroll)
          </Button>
        </CardContent>
      </Card>

      <div className="flex flex-wrap items-end gap-2">
        <div className="space-y-1">
          <label className="text-xs uppercase tracking-wider text-muted-foreground">Add staff (manual row)</label>
          <div className="flex gap-2">
            <Input
              placeholder="Name"
              value={addStaffDraft}
              onChange={(e) => setAddStaffDraft(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && addStaffRow()}
              className="h-9 w-48 text-sm"
            />
            <Button type="button" size="sm" variant="outline" className="gap-1" onClick={addStaffRow}>
              <UserPlus className="h-4 w-4" />
              Add
            </Button>
          </div>
        </div>
        {hiddenNormNames.length > 0 && (
          <Button type="button" size="sm" variant="ghost" className="text-xs text-muted-foreground" onClick={() => setHiddenNormNames([])}>
            Show all hidden ({hiddenNormNames.length})
          </Button>
        )}
      </div>

      {/* View toggle */}
      <div className="flex gap-2">
        <Button size="sm" variant={view === 'summary'    ? 'default' : 'outline'} onClick={() => setView('summary')}>Staff Pay Summary</Button>
        <Button size="sm" variant={view === 'exceptions' ? 'default' : 'outline'} onClick={() => setView('exceptions')}>
          Exceptions
          {view !== 'exceptions' && exceptionCount > 0 && (
            <span className="ml-1.5 inline-flex items-center justify-center rounded-full bg-orange-500 text-white text-[10px] font-bold w-4 h-4">{exceptionCount}</span>
          )}
        </Button>
        <Button size="sm" variant={view === 'manual'     ? 'default' : 'outline'} onClick={() => setView('manual')}>Manual Scenario</Button>
      </div>

      {/* ── STAFF SUMMARY ──────────────────────────────────────── */}
      {view === 'summary' && (
        <>
          {/* Controls */}
          <Card>
            <CardContent className="pt-4">
              <div className="flex flex-wrap gap-4 items-end">
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
                <div className="space-y-1 ml-auto self-end">
                  <input ref={payrollFileRef} type="file" accept=".xlsx,.xls" className="hidden"
                    onChange={e => { if (e.target.files[0]) parsePayrollFile(e.target.files[0]); e.target.value = ''; }} />
                  <input ref={ratesFileRef} type="file" accept=".xlsx,.xls" className="hidden"
                    onChange={e => { if (e.target.files[0]) parseRatesFile(e.target.files[0]); e.target.value = ''; }} />
                  <div className="flex flex-wrap items-center gap-2">
                    <button
                      onClick={() => ratesFileRef.current?.click()}
                      className="inline-flex items-center gap-1.5 h-9 px-3 rounded-md border border-input bg-background text-sm hover:bg-accent transition-colors"
                    >
                      <FileSpreadsheet className="h-4 w-4 text-blue-600" />
                      {ratesFileName ? 'Replace rates file' : 'Upload rates file'}
                    </button>
                    {ratesFileName && (
                      <span className="text-xs text-muted-foreground max-w-[160px] truncate" title={ratesFileName}>{ratesFileName}</span>
                    )}
                    {ratesFileName && (
                      <button
                        onClick={() => {
                          setRatesFileName(null);
                          setStaffRatesMap(null);
                          onStaffRatesMapChange?.(null, null);
                        }}
                        className="text-xs text-muted-foreground hover:text-destructive"
                      >
                        ✕
                      </button>
                    )}
                    <div className="w-px h-5 bg-border" />
                    <button
                      onClick={() => payrollFileRef.current?.click()}
                      className="inline-flex items-center gap-1.5 h-9 px-3 rounded-md border border-input bg-background text-sm hover:bg-accent transition-colors"
                    >
                      <FileSpreadsheet className="h-4 w-4 text-green-600" />
                      {payrollData ? 'Replace payroll file' : 'Upload payroll file'}
                    </button>
                    {payrollData && (
                      <span className="text-xs text-muted-foreground">{payrollData.size} matched</span>
                    )}
                    {payrollData && (
                      <button onClick={() => setPayrollData(null)} className="text-xs text-muted-foreground hover:text-destructive">✕</button>
                    )}
                  </div>
                </div>
              </div>
              {/* Casual rate info */}
              {defaultRate && parseFloat(defaultRate) > 0 && (() => {
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
              ) : displayRows.length === 0 ? (
                <div className="py-12 text-center text-muted-foreground text-sm">
                  All staff are hidden.{' '}
                  <button type="button" className="text-primary underline font-medium" onClick={() => setHiddenNormNames([])}>Show all</button>
                </div>
              ) : (
                <div className="overflow-x-auto" ref={tableContainerRef}>
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
                        {payrollData && <TableHead colSpan={3} className="text-center text-emerald-800 border-l border-border/50 py-1">Payroll Comparison</TableHead>}
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
                        <TableHead className="text-right text-emerald-700 whitespace-nowrap">KM</TableHead>
                        <TableHead className="text-right text-emerald-600 border-r border-border/50 whitespace-nowrap">Km Allow<br/><span className="text-[9px] font-normal opacity-70">${VEHICLE_RATE}/km</span></TableHead>
                        <TableHead className="text-right font-semibold whitespace-nowrap min-w-[100px]">Gross Pay</TableHead>
                        {payrollData && <>
                          <TableHead className="text-right text-emerald-700 whitespace-nowrap border-l border-border/50 min-w-[100px]">Payroll</TableHead>
                          <TableHead className="text-right text-slate-600 whitespace-nowrap min-w-[100px]">Diff</TableHead>
                          <TableHead className="text-right text-slate-500 whitespace-nowrap min-w-[60px]">Δ%</TableHead>
                        </>}
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {displayRows.map((row) => {
                        const mrow      = getMergedRow(row);
                        const rateVal   = baseRates[row.staffName] ?? defaultRate;
                        const empT      = getEmpType(row.staffName);
                        const staffRates = staffRatesMap?.get(normName(row.staffName)) ?? null;
                        const gross     = staffRates ? calcGrossFromRates(mrow, staffRates) : calcGross(mrow, rateVal, empT);
                        const allow     = calcAllowances(mrow);
                        const otTotal   = totalOtHrs(mrow);
                        const sunAll    = r2((mrow.sundayHours||0)+(mrow.sundayOtUpto2||0)+(mrow.sundayOtAfter2||0));
                        const sunOT     = r2((mrow.sundayOtUpto2||0)+(mrow.sundayOtAfter2||0));
                        const holAll    = r2((mrow.holidayHours||0)+(mrow.holidayOtUpto2||0)+(mrow.holidayOtAfter2||0));
                        const holOT     = r2((mrow.holidayOtUpto2||0)+(mrow.holidayOtAfter2||0));
                        // Helper: render an editable cell value with override indicator
                        const ov = (field, val, cls = '') => {
                          const key = `${row.staffName}:${field}`;
                          const isOv = key in overrides;
                          return (
                            <TableCell
                              key={field}
                              className={`text-right tabular-nums cursor-context-menu select-none ${cls} ${isOv ? 'ring-1 ring-inset ring-blue-400 bg-blue-50/40' : ''}`}
                              onContextMenu={e => handleCtx(e, row.staffName, field, row[field] ?? 0)}
                              title="Right-click to edit"
                            >
                              {val}
                              {isOv && <span className="ml-0.5 inline-block w-1.5 h-1.5 rounded-full bg-blue-500 align-middle" />}
                            </TableCell>
                          );
                        };
                        const isCasual  = empT === 'casual';
                        const h = (v) => v ? fmtH(v) : <span className="text-muted-foreground/30">—</span>;
                        const n = (v) => v ? String(v) : <span className="text-muted-foreground/30">—</span>;
                        const hasOT     = otTotal > 0;
                        const hasBroken = (mrow.brokenShiftCount || 0) > 0;
                        const isManualOnly = row._manualOnly === true;
                        const hideRow = () =>
                          setHiddenNormNames((h) => (h.includes(normName(row.staffName)) ? h : [...h, normName(row.staffName)]));
                        const removeManual = () => {
                          setManualStaffNames((prev) => prev.filter((n) => normName(n) !== normName(row.staffName)));
                          setHiddenNormNames((prev) => prev.filter((k) => k !== normName(row.staffName)));
                        };
                        return (
                          <React.Fragment key={row.staffName}>
                          <TableRow className={`hover:bg-muted/30 text-xs ${isCasual ? 'bg-blue-50/30' : ''}`}>
                            <TableCell className={`font-medium sticky left-0 z-10 text-sm border-r border-border/50 ${isCasual ? 'bg-blue-50/60' : 'bg-background'}`}>
                              <div className="flex items-center gap-1.5 min-w-0">
                                <button
                                  type="button"
                                  onClick={() => toggleBreakdown(row.staffName)}
                                  title="Show pay breakdown"
                                  className={`shrink-0 w-5 h-5 flex items-center justify-center rounded border text-[11px] transition-all duration-200 ${
                                    expandedBreakdown[row.staffName]
                                      ? 'bg-foreground text-background border-foreground rotate-90'
                                      : 'text-muted-foreground border-border hover:border-foreground hover:text-foreground'
                                  }`}
                                  style={{ transform: expandedBreakdown[row.staffName] ? 'rotate(90deg)' : 'rotate(0deg)', transition: 'transform 0.2s ease' }}
                                >
                                  ▸
                                </button>
                                <span className="truncate">{row.staffName}</span>
                                {isManualOnly && (
                                  <button
                                    type="button"
                                    title="Remove manual row"
                                    onClick={removeManual}
                                    className="shrink-0 p-0.5 rounded text-muted-foreground hover:text-destructive"
                                  >
                                    <Trash2 className="h-3.5 w-3.5" />
                                  </button>
                                )}
                                <button
                                  type="button"
                                  title="Hide from list"
                                  onClick={hideRow}
                                  className="shrink-0 p-0.5 rounded text-muted-foreground hover:text-foreground"
                                >
                                  <EyeOff className="h-3.5 w-3.5" />
                                </button>
                              </div>
                            </TableCell>
                            <TableCell>
                              {staffRates ? (
                                <div className="text-xs font-mono text-foreground">
                                  ${staffRates.daytime.toFixed(2)}
                                  <div className="text-[9px] text-emerald-600 font-medium">from file</div>
                                </div>
                              ) : (
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
                              )}
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
                            {ov('morningHours',   h(mrow.morningHours),   'text-yellow-700')}
                            {ov('afternoonHours', h(mrow.afternoonHours), 'text-orange-700')}
                            {ov('nightHours',     h(mrow.nightHours),     'text-indigo-700 border-r border-border/50')}
                            {/* WD overtime */}
                            {ov('weekdayOtUpto2',  h(mrow.weekdayOtUpto2),  'text-orange-600')}
                            {ov('weekdayOtAfter2', h(mrow.weekdayOtAfter2), 'text-orange-700 border-r border-border/50')}
                            {/* Saturday */}
                            {ov('saturdayHours',    h(mrow.saturdayHours),    'text-cyan-700')}
                            {ov('saturdayOtUpto2',  h(mrow.saturdayOtUpto2),  'text-cyan-600')}
                            {ov('saturdayOtAfter2', h(mrow.saturdayOtAfter2), 'text-cyan-600 border-r border-border/50')}
                            {/* Sunday — editable individually, display consolidated */}
                            {ov('sundayHours',   sunAll ? <span className="font-medium">{fmtH(sunAll)}</span> : <span className="text-muted-foreground/30">—</span>, 'text-red-700')}
                            {ov('sundayOtUpto2', sunOT > 0 ? <span className="font-medium">{fmtH(sunOT)}</span> : <span className="text-muted-foreground/30">—</span>, `border-r border-border/50 ${sunOT > 0 ? 'text-orange-600' : 'text-muted-foreground/30'}`)}
                            {/* Holiday */}
                            {ov('holidayHours',   holAll ? <span className="font-medium">{fmtH(holAll)}</span> : <span className="text-muted-foreground/30">—</span>, 'text-blue-700')}
                            {ov('holidayOtUpto2', holOT > 0 ? <span className="font-medium">{fmtH(holOT)}</span> : <span className="text-muted-foreground/30">—</span>, `border-r border-border/50 ${holOT > 0 ? 'text-orange-600' : 'text-muted-foreground/30'}`)}
                            {/* Nursing */}
                            {ov('nursingCareHours', h(mrow.nursingCareHours), 'text-teal-700 border-r border-border/50')}
                            {/* Exceptions */}
                            <TableCell className={`text-right tabular-nums ${hasOT ? 'text-orange-600 font-semibold' : 'text-muted-foreground/30'}`}>{hasOT ? fmtH(otTotal) : '—'}</TableCell>
                            {ov('brokenShiftCount', n(mrow.brokenShiftCount), `border-r border-border/50 ${hasBroken ? 'text-orange-700 font-semibold' : 'text-muted-foreground/30'}`)}
                            {/* OT>76 by day type */}
                            {ov('otAfter76Weekday',  (mrow.otAfter76Weekday||0)  > 0 ? fmtH(mrow.otAfter76Weekday)  : '—', `${(mrow.otAfter76Weekday||0)  > 0 ? 'text-rose-700 font-medium' : 'text-muted-foreground/30'}`)}
                            {ov('otAfter76Saturday', (mrow.otAfter76Saturday||0) > 0 ? fmtH(mrow.otAfter76Saturday) : '—', `${(mrow.otAfter76Saturday||0) > 0 ? 'text-rose-600 font-medium' : 'text-muted-foreground/30'}`)}
                            {ov('otAfter76Sunday',   (mrow.otAfter76Sunday||0)   > 0 ? fmtH(mrow.otAfter76Sunday)   : '—', `${(mrow.otAfter76Sunday||0)   > 0 ? 'text-rose-500 font-medium' : 'text-muted-foreground/30'}`)}
                            {ov('otAfter76Holiday',  (mrow.otAfter76Holiday||0)  > 0 ? fmtH(mrow.otAfter76Holiday)  : '—', `border-r border-border/50 ${(mrow.otAfter76Holiday||0) > 0 ? 'text-rose-800 font-medium' : 'text-muted-foreground/30'}`)}
                            {/* Allowances — derived, not directly editable */}
                            <TableCell className={`text-right tabular-nums ${allow.brokenAllow > 0 ? 'text-amber-700' : 'text-muted-foreground/30'}`}>{allow.brokenAllow > 0 ? fmt(allow.brokenAllow) : '—'}</TableCell>
                            <TableCell className={`text-right tabular-nums border-r border-border/50 ${allow.mealAllow > 0 ? 'text-amber-600' : 'text-muted-foreground/30'}`}>{allow.mealAllow > 0 ? fmt(allow.mealAllow) : '—'}</TableCell>
                            {/* KM */}
                            <TableCell className={`text-right tabular-nums ${(mrow.totalKm || 0) > 0 ? 'text-emerald-700' : 'text-muted-foreground/30'}`}>
                              {(mrow.totalKm || 0) > 0 ? `${mrow.totalKm} km` : '—'}
                            </TableCell>
                            <TableCell className={`text-right tabular-nums border-r border-border/50 ${allow.mileageAllow > 0 ? 'text-emerald-600' : 'text-muted-foreground/30'}`}>
                              {allow.mileageAllow > 0 ? fmt(allow.mileageAllow) : '—'}
                            </TableCell>
                            {/* Gross pay */}
                            <TableCell className="text-right tabular-nums font-bold text-sm">
                              {gross !== null ? <span className={isCasual ? 'text-blue-700' : ''}>{fmt(gross)}</span> : <span className="text-muted-foreground font-normal text-xs">enter rate</span>}
                            </TableCell>
                            {/* Payroll comparison */}
                            {payrollData && (() => {
                              const match = payrollData.get(normName(row.staffName));
                              if (!match) return (
                                <TableCell colSpan={3} className="text-center text-xs text-muted-foreground/40 border-l border-border/50">no match</TableCell>
                              );
                              const payrollEarn = match.earnings;
                              const diff = gross !== null ? r2(gross - payrollEarn) : null;
                              const pct  = gross !== null && payrollEarn > 0 ? ((diff / payrollEarn) * 100).toFixed(1) : null;
                              const diffCls = diff === null ? '' : diff > 0.5 ? 'text-rose-600 font-semibold' : diff < -0.5 ? 'text-amber-600 font-semibold' : 'text-emerald-600';
                              return (<>
                                <TableCell className="text-right tabular-nums font-medium text-emerald-700 border-l border-border/50">{fmt(payrollEarn)}</TableCell>
                                <TableCell className={`text-right tabular-nums ${diffCls}`}>
                                  {diff !== null ? (diff >= 0 ? '+' : '') + fmt(diff) : '—'}
                                </TableCell>
                                <TableCell className={`text-right tabular-nums text-xs ${diffCls}`}>
                                  {pct !== null ? (parseFloat(pct) >= 0 ? '+' : '') + pct + '%' : '—'}
                                </TableCell>
                              </>);
                            })()}
                          </TableRow>

                          {/* Breakdown panel — always rendered, animated via grid-template-rows */}
                          <TableRow className="hover:bg-transparent border-0">
                            <TableCell colSpan={summaryColSpan} className="p-0 border-0" style={{ width: tableContainerWidth || '100%' }}>
                              <div
                                style={{
                                  display: 'grid',
                                  gridTemplateRows: expandedBreakdown[row.staffName] ? '1fr' : '0fr',
                                  transition: 'grid-template-rows 0.3s ease',
                                  overflow: 'hidden',
                                  width: tableContainerWidth ? `${tableContainerWidth}px` : '100%',
                                }}
                              >
                                <div style={{ overflow: 'hidden', minWidth: 0 }}>
                                  <PayBreakdownPanel
                                    mrow={mrow}
                                    staffName={row.staffName}
                                    baseRate={rateVal}
                                    empType={empT}
                                    isCasual={isCasual}
                                    staffRates={staffRates}
                                  />
                                  <PayHoursSnapshot mrow={mrow} allow={allow} />
                                </div>
                              </div>
                            </TableCell>
                          </TableRow>
                          </React.Fragment>
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
                        <TableCell className="text-right text-emerald-700">{totals.totalKm > 0 ? `${totals.totalKm} km` : '—'}</TableCell>
                        <TableCell className="text-right text-emerald-600 border-r border-border/50">{totals.mileageAllow > 0 ? fmt(r2(totals.mileageAllow)) : '—'}</TableCell>
                        <TableCell className="text-right">
                          {totals.grossReady ? fmt(r2(totals.gross)) : <span className="text-muted-foreground font-normal text-xs">enter rates</span>}
                        </TableCell>
                        {payrollData && (() => {
                          let totalPayroll = 0, matched = 0;
                          for (const row of displayRows) {
                            const m = payrollData.get(normName(row.staffName));
                            if (m) { totalPayroll = r2(totalPayroll + m.earnings); matched++; }
                          }
                          const totalDiff = totals.grossReady ? r2(totals.gross - totalPayroll) : null;
                          const diffCls = totalDiff === null ? '' : totalDiff > 0.5 ? 'text-rose-600' : totalDiff < -0.5 ? 'text-amber-600' : 'text-emerald-600';
                          return (<>
                            <TableCell className="text-right text-emerald-700 border-l border-border/50">
                              {fmt(totalPayroll)}
                              <div className="text-[10px] font-normal text-muted-foreground">{matched}/{displayRows.length} matched</div>
                            </TableCell>
                            <TableCell className={`text-right ${diffCls}`}>
                              {totalDiff !== null ? (totalDiff >= 0 ? '+' : '') + fmt(totalDiff) : '—'}
                            </TableCell>
                            <TableCell className={`text-right text-xs ${diffCls}`}>
                              {totalDiff !== null && totalPayroll > 0 ? (totalDiff >= 0 ? '+' : '') + ((totalDiff / totalPayroll) * 100).toFixed(1) + '%' : '—'}
                            </TableCell>
                          </>);
                        })()}
                      </TableRow>
                    </TableBody>
                  </Table>
                </div>
              )}
            </CardContent>
          </Card>

          {/* Override hint */}
          {displayRows.length > 0 && (
            <p className="text-[11px] text-muted-foreground/70 text-center -mt-2">
              Right-click any hour cell to override its value. Overridden cells are highlighted in blue and recalculate gross pay instantly.
              {Object.keys(overrides).length > 0 && (
                <button
                  onClick={() => setOverrides({})}
                  className="ml-2 underline text-blue-600 hover:text-blue-800"
                >
                  Clear all {Object.keys(overrides).length} overrides
                </button>
              )}
            </p>
          )}

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
                <span>Weekday ordinary cap / shift:</span><span className="font-medium text-foreground">4h before OT</span>
                <span>Sat/Sun/PH cap / shift:</span><span className="font-medium text-foreground">10h before OT</span>
                <span>Sun / PH OT:</span><span className="font-medium text-foreground">same as Sun/PH rate</span>
                <span>OT &gt; 76h — WD/Sat:</span><span className="font-medium text-foreground">1.5× / 2× (tiered)</span>
                <span>OT &gt; 76h — Sunday:</span><span className="font-medium text-foreground">2.0× flat</span>
                <span>OT &gt; 76h — PH:</span><span className="font-medium text-foreground">2.5× flat</span>
              </div>
              <div className="border-t border-border mt-2 pt-2 grid grid-cols-2 gap-x-4 gap-y-0.5 text-muted-foreground text-[11px]">
                <span>Broken shift (1 break):</span><span className="font-medium text-foreground">${BROKEN_ALLOWANCE_1.toFixed(2)}</span>
                <span>Broken shift (2 breaks):</span><span className="font-medium text-foreground">${BROKEN_ALLOWANCE_2.toFixed(2)}</span>
                <span>Meal allowance (OT &gt;1h/shift):</span><span className="font-medium text-foreground">${MEAL_ALLOWANCE.toFixed(2)} × 1</span>
                <span>Meal allowance (OT &gt;4h/shift):</span><span className="font-medium text-foreground">${MEAL_ALLOWANCE.toFixed(2)} × 2</span>
                <span>Vehicle allowance:</span><span className="font-medium text-foreground">${VEHICLE_RATE}/km (from rates file)</span>
              </div>
              <p className="text-muted-foreground/70 text-[10px] pt-1">★ Sunday &amp; Holiday OT = same rate as ordinary (2.0× / 2.5×). Meal allowance counted per-shift by backend. Casual: effective rate = (Base÷1.25 × Multiplier) + Loading.</p>
            </div>
            <div className="bg-amber-50 border border-amber-300 rounded p-3 text-xs text-amber-800 space-y-1">
              <p className="font-semibold">⚠ SCHADS Award Rules Applied</p>
              <ul className="list-disc list-inside space-y-0.5 text-[11px] leading-relaxed">
                <li><strong>OT triggers:</strong> &gt;76h/fortnight; weekday &gt;4h/shift; Sat/Sun/PH &gt;10h/shift — same hour paid once, not double-counted</li>
                <li><strong>OT &gt; 76h rates:</strong> Weekday/Sat shifts use 1.5× (first 2h) then 2×; Sun shifts 2.0×; PH shifts 2.5×</li>
                <li><strong>Sunday/PH OT:</strong> Same rate as ordinary day (2.0× / 2.5×) — no separate OT brackets</li>
                <li><strong>Broken shifts:</strong> $20.82 per shift (1 break), $27.56 for 2 breaks (cap not tracked per-shift)</li>
                <li><strong>Meal allowance:</strong> $16.62 per shift where OT &gt;1h; +$16.62 on same shift where OT &gt;4h (counted per-shift by backend)</li>
              </ul>
              <p className="text-amber-700 pt-1">Always verify against the <a href="https://www.fairwork.gov.au" target="_blank" rel="noopener noreferrer" className="underline">Fair Work pay guide</a>.</p>
            </div>
          </div>
        </>
      )}

      {/* ── EXCEPTIONS ─────────────────────────────────────────── */}
      {view === 'exceptions' && (() => {
        if (isLoading) return <div className="py-12"><LoadingScreen message="Loading pay hours…" /></div>;
        if (staffRows.length === 0) return (
          <Card>
            <CardContent className="py-12 text-center text-muted-foreground text-sm">
              No pay hours data. Go to <strong>Pay Hours</strong>, upload a CSV and click "Compute Pay Hours" first.
            </CardContent>
          </Card>
        );

        // Build per-staff exception rows
        const exRows = displayRows.map(row => {
          const m   = getMergedRow(row);
          const ot  = totalOtHrs(m);
          const broken = m.brokenShiftCount || 0;
          const sleep  = m.sleepoversCount  || 0;
          const ot76wd  = m.otAfter76Weekday  || 0;
          const ot76sat = m.otAfter76Saturday || 0;
          const ot76sun = m.otAfter76Sunday   || 0;
          const ot76hol = m.otAfter76Holiday  || 0;
          const ot76tot = r2(ot76wd + ot76sat + ot76sun + ot76hol);
          const allow   = calcAllowances(m);
          const rate    = baseRates[row.staffName] ?? defaultRate;
          const empT    = getEmpType(row.staffName);
          const gross   = calcGross(m, rate, empT);
          const hasAny  = ot > 0 || broken > 0 || ot76tot > 0;
          return { row, m, ot, broken, sleep, ot76wd, ot76sat, ot76sun, ot76hol, ot76tot, allow, gross, hasAny };
        });

        const allHaveExceptions = exRows.every(r => r.hasAny);
        const visible = exRows.filter(r => r.hasAny);

        // Totals
        const totBroken    = r2(visible.reduce((s, r) => s + r.broken, 0));
        const totSleep     = r2(visible.reduce((s, r) => s + r.sleep, 0));
        const totOT        = r2(visible.reduce((s, r) => s + r.ot, 0));
        const totOt76wd    = r2(visible.reduce((s, r) => s + r.ot76wd, 0));
        const totOt76sat   = r2(visible.reduce((s, r) => s + r.ot76sat, 0));
        const totOt76sun   = r2(visible.reduce((s, r) => s + r.ot76sun, 0));
        const totOt76hol   = r2(visible.reduce((s, r) => s + r.ot76hol, 0));
        const totOt76      = r2(visible.reduce((s, r) => s + r.ot76tot, 0));
        const totBrokAllow = r2(visible.reduce((s, r) => s + r.allow.brokenAllow, 0));
        const totMealAllow = r2(visible.reduce((s, r) => s + r.allow.mealAllow, 0));
        const totAllow     = r2(totBrokAllow + totMealAllow);
        const totGross     = visible.every(r => r.gross !== null) ? r2(visible.reduce((s, r) => s + (r.gross || 0), 0)) : null;

        return (
          <>
            {/* Summary cards */}
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
              <Card className="border-orange-200">
                <CardContent className="pt-4">
                  <div className="text-2xl font-bold text-orange-600">{visible.length}</div>
                  <p className="text-xs text-muted-foreground">Staff with exceptions</p>
                  <p className="text-[11px] text-muted-foreground/70 mt-0.5">
                    {displayRows.length} visible · {staffRows.length} in list
                  </p>
                </CardContent>
              </Card>
              <Card className="border-orange-200">
                <CardContent className="pt-4">
                  <div className="text-2xl font-bold text-orange-600">{fmtH(totOT)}</div>
                  <p className="text-xs text-muted-foreground">Total overtime hours</p>
                  <p className="text-[11px] text-muted-foreground/70 mt-0.5">WD + Sat + Sun + PH</p>
                </CardContent>
              </Card>
              <Card className="border-rose-200">
                <CardContent className="pt-4">
                  <div className="text-2xl font-bold text-rose-600">{fmtH(totOt76)}</div>
                  <p className="text-xs text-muted-foreground">Total OT&nbsp;&gt;&nbsp;76h</p>
                  <p className="text-[11px] text-muted-foreground/70 mt-0.5">Fortnight cap overflow</p>
                </CardContent>
              </Card>
              <Card className="border-amber-200">
                <CardContent className="pt-4">
                  <div className="text-2xl font-bold text-amber-700">{totBroken} shifts</div>
                  <p className="text-xs text-muted-foreground">Broken shifts</p>
                  <p className="text-[11px] text-muted-foreground/70 mt-0.5">{r2(visible.reduce((s,r)=>s+(r.m.totalKm||0),0))} km total</p>
                </CardContent>
              </Card>
            </div>

            {visible.length === 0 ? (
              <Card>
                <CardContent className="py-10 text-center">
                  <p className="text-lg font-medium text-green-600">✓ No exceptions</p>
                  <p className="text-sm text-muted-foreground mt-1">No staff have overtime, OT&nbsp;&gt;&nbsp;76h, or broken shifts this period.</p>
                </CardContent>
              </Card>
            ) : (
              <>
                {/* ── OT & Broken exceptions ── */}
                <Card>
                  <CardHeader className="pb-2">
                    <CardTitle className="text-sm flex items-center gap-2">
                      <span className="text-orange-500">⚠</span> Overtime &amp; Broken Shifts
                      <span className="text-xs font-normal text-muted-foreground">({visible.filter(r => r.ot > 0 || r.broken > 0).length} staff)</span>
                    </CardTitle>
                  </CardHeader>
                  <CardContent className="p-0">
                    <div className="overflow-x-auto">
                      <Table>
                        <TableHeader>
                          <TableRow className="bg-muted/40 text-[11px]">
                            <TableHead className="min-w-[160px]">Staff</TableHead>
                            <TableHead className="text-right text-orange-600 whitespace-nowrap">Total OT<br/><span className="font-normal opacity-70">all days</span></TableHead>
                            <TableHead className="text-right text-orange-600 whitespace-nowrap">WD OT ≤2h<br/><span className="font-normal opacity-70">1.5×</span></TableHead>
                            <TableHead className="text-right text-orange-700 whitespace-nowrap">WD OT &gt;2h<br/><span className="font-normal opacity-70">2×</span></TableHead>
                            <TableHead className="text-right text-cyan-600 whitespace-nowrap">Sat OT ≤2h</TableHead>
                            <TableHead className="text-right text-cyan-700 whitespace-nowrap">Sat OT &gt;2h</TableHead>
                            <TableHead className="text-right text-red-600 whitespace-nowrap">Sun OT hrs<br/><span className="font-normal opacity-70">2×</span></TableHead>
                            <TableHead className="text-right text-blue-600 whitespace-nowrap">Hol OT hrs<br/><span className="font-normal opacity-70">2.5×</span></TableHead>
                            <TableHead className="text-right text-orange-700 whitespace-nowrap">Broken#</TableHead>
                            <TableHead className="text-right text-emerald-600 whitespace-nowrap">KMs</TableHead>
                            <TableHead className="text-right text-emerald-700 whitespace-nowrap">Mileage Allow</TableHead>
                          </TableRow>
                        </TableHeader>
                        <TableBody>
                          {visible.filter(r => r.ot > 0 || r.broken > 0).map(({ row, m, ot, broken, allow }) => {
                            const d = (v, cls = '') => v > 0
                              ? <span className={`font-medium ${cls}`}>{fmtH(v)}</span>
                              : <span className="text-muted-foreground/30">—</span>;
                            const n = (v, cls = '') => v > 0
                              ? <span className={`font-medium ${cls}`}>{v}</span>
                              : <span className="text-muted-foreground/30">—</span>;
                            return (
                              <TableRow key={row.staffName} className="text-xs hover:bg-muted/30">
                                <TableCell className="font-medium">{row.staffName}</TableCell>
                                <TableCell className="text-right">{d(ot, 'text-orange-600')}</TableCell>
                                <TableCell className="text-right">{d(m.weekdayOtUpto2 || 0, 'text-orange-500')}</TableCell>
                                <TableCell className="text-right">{d(m.weekdayOtAfter2 || 0, 'text-orange-700')}</TableCell>
                                <TableCell className="text-right">{d(m.saturdayOtUpto2 || 0, 'text-cyan-600')}</TableCell>
                                <TableCell className="text-right">{d(m.saturdayOtAfter2 || 0, 'text-cyan-700')}</TableCell>
                                <TableCell className="text-right">{d(r2((m.sundayOtUpto2||0)+(m.sundayOtAfter2||0)), 'text-red-600')}</TableCell>
                                <TableCell className="text-right">{d(r2((m.holidayOtUpto2||0)+(m.holidayOtAfter2||0)), 'text-blue-600')}</TableCell>
                                <TableCell className="text-right">
                                  {broken > 0 ? (
                                    <span className="inline-flex items-center gap-1 font-medium text-orange-700">
                                      {broken}
                                      <span className="text-[10px] bg-orange-100 text-orange-700 px-1 rounded">broken</span>
                                    </span>
                                  ) : <span className="text-muted-foreground/30">—</span>}
                                </TableCell>
                                <TableCell className="text-right">
                                  {(m.totalKm || 0) > 0
                                    ? <span className="font-medium text-emerald-700">{m.totalKm} km</span>
                                    : <span className="text-muted-foreground/30">—</span>}
                                </TableCell>
                                <TableCell className="text-right">
                                  {(allow.mileageAllow || 0) > 0
                                    ? <span className="font-medium text-emerald-600">{fmt(allow.mileageAllow)}</span>
                                    : <span className="text-muted-foreground/30">—</span>}
                                </TableCell>
                              </TableRow>
                            );
                          })}
                          {/* Totals */}
                          <TableRow className="border-t-2 font-bold text-xs bg-muted/20">
                            <TableCell>Totals</TableCell>
                            <TableCell className="text-right text-orange-600">{fmtH(totOT)}</TableCell>
                            <TableCell className="text-right">{fmtH(r2(visible.reduce((s,r)=>s+(r.m.weekdayOtUpto2||0),0)))}</TableCell>
                            <TableCell className="text-right">{fmtH(r2(visible.reduce((s,r)=>s+(r.m.weekdayOtAfter2||0),0)))}</TableCell>
                            <TableCell className="text-right">{fmtH(r2(visible.reduce((s,r)=>s+(r.m.saturdayOtUpto2||0),0)))}</TableCell>
                            <TableCell className="text-right">{fmtH(r2(visible.reduce((s,r)=>s+(r.m.saturdayOtAfter2||0),0)))}</TableCell>
                            <TableCell className="text-right">{fmtH(r2(visible.reduce((s,r)=>s+r2((r.m.sundayOtUpto2||0)+(r.m.sundayOtAfter2||0)),0)))}</TableCell>
                            <TableCell className="text-right">{fmtH(r2(visible.reduce((s,r)=>s+r2((r.m.holidayOtUpto2||0)+(r.m.holidayOtAfter2||0)),0)))}</TableCell>
                            <TableCell className="text-right text-orange-700">{totBroken || '—'}</TableCell>
                            <TableCell className="text-right text-emerald-700">{r2(visible.reduce((s,r)=>s+(r.m.totalKm||0),0)) || '—'} km</TableCell>
                            <TableCell className="text-right text-emerald-600">{r2(visible.reduce((s,r)=>s+(r.allow.mileageAllow||0),0)) > 0 ? fmt(r2(visible.reduce((s,r)=>s+(r.allow.mileageAllow||0),0))) : '—'}</TableCell>
                          </TableRow>
                        </TableBody>
                      </Table>
                    </div>
                  </CardContent>
                </Card>

                {/* ── OT > 76h detail ── */}
                {totOt76 > 0 && (
                  <Card>
                    <CardHeader className="pb-2">
                      <CardTitle className="text-sm flex items-center gap-2">
                        <span className="text-rose-600">⏱</span> OT &gt; 76h — Fortnight Cap Overflow
                        <span className="text-xs font-normal text-muted-foreground">({visible.filter(r => r.ot76tot > 0).length} staff)</span>
                      </CardTitle>
                      <p className="text-[11px] text-muted-foreground mt-0.5">
                        Hours that exceed the 76h fortnightly cap. Weekday &amp; Saturday: tiered (1.5× first 2h, 2× after). Sunday: 2.0×. Public Holiday: 2.5×. Same hour is not double-counted with daily OT.
                      </p>
                    </CardHeader>
                    <CardContent className="p-0">
                      <div className="overflow-x-auto">
                        <Table>
                          <TableHeader>
                            <TableRow className="bg-rose-50/60 text-[11px]">
                              <TableHead className="min-w-[160px]">Staff</TableHead>
                              <TableHead className="text-right text-rose-700 whitespace-nowrap">Total OT&gt;76<br/><span className="font-normal opacity-70">all days</span></TableHead>
                              <TableHead className="text-right text-rose-700 whitespace-nowrap">Weekday<br/><span className="font-normal opacity-70">1.5×/2×</span></TableHead>
                              <TableHead className="text-right text-rose-600 whitespace-nowrap">Saturday<br/><span className="font-normal opacity-70">1.5×/2×</span></TableHead>
                              <TableHead className="text-right text-rose-500 whitespace-nowrap">Sunday<br/><span className="font-normal opacity-70">2.0× flat</span></TableHead>
                              <TableHead className="text-right text-rose-800 whitespace-nowrap">Holiday<br/><span className="font-normal opacity-70">2.5× flat</span></TableHead>
                              <TableHead className="text-right whitespace-nowrap">WD tier 1<br/><span className="font-normal opacity-70 text-muted-foreground">≤2h @ 1.5×</span></TableHead>
                              <TableHead className="text-right whitespace-nowrap">WD tier 2<br/><span className="font-normal opacity-70 text-muted-foreground">&gt;2h @ 2×</span></TableHead>
                              <TableHead className="text-right whitespace-nowrap">Sat tier 1<br/><span className="font-normal opacity-70 text-muted-foreground">≤2h @ 1.5×</span></TableHead>
                              <TableHead className="text-right whitespace-nowrap">Sat tier 2<br/><span className="font-normal opacity-70 text-muted-foreground">&gt;2h @ 2×</span></TableHead>
                            </TableRow>
                          </TableHeader>
                          <TableBody>
                            {visible.filter(r => r.ot76tot > 0).map(({ row, ot76wd, ot76sat, ot76sun, ot76hol, ot76tot }) => {
                              const wdT1 = r2(Math.min(ot76wd, 2));
                              const wdT2 = r2(Math.max(0, ot76wd - 2));
                              const sT1  = r2(Math.min(ot76sat, 2));
                              const sT2  = r2(Math.max(0, ot76sat - 2));
                              const cell = (v, cls = 'text-rose-700') => v > 0
                                ? <span className={`font-medium ${cls}`}>{fmtH(v)}</span>
                                : <span className="text-muted-foreground/30">—</span>;
                              return (
                                <TableRow key={row.staffName} className="text-xs hover:bg-rose-50/30">
                                  <TableCell className="font-medium">{row.staffName}</TableCell>
                                  <TableCell className="text-right">{cell(ot76tot)}</TableCell>
                                  <TableCell className="text-right">{cell(ot76wd)}</TableCell>
                                  <TableCell className="text-right">{cell(ot76sat, 'text-rose-600')}</TableCell>
                                  <TableCell className="text-right">{cell(ot76sun, 'text-rose-500')}</TableCell>
                                  <TableCell className="text-right">{cell(ot76hol, 'text-rose-800')}</TableCell>
                                  <TableCell className="text-right text-muted-foreground">{cell(wdT1, 'text-orange-500')}</TableCell>
                                  <TableCell className="text-right text-muted-foreground">{cell(wdT2, 'text-orange-700')}</TableCell>
                                  <TableCell className="text-right text-muted-foreground">{cell(sT1,  'text-cyan-500')}</TableCell>
                                  <TableCell className="text-right text-muted-foreground">{cell(sT2,  'text-cyan-700')}</TableCell>
                                </TableRow>
                              );
                            })}
                            {/* Totals */}
                            <TableRow className="border-t-2 font-bold text-xs bg-rose-50/20">
                              <TableCell>Totals</TableCell>
                              <TableCell className="text-right text-rose-700">{fmtH(totOt76)}</TableCell>
                              <TableCell className="text-right">{totOt76wd  > 0 ? fmtH(totOt76wd)  : '—'}</TableCell>
                              <TableCell className="text-right">{totOt76sat > 0 ? fmtH(totOt76sat) : '—'}</TableCell>
                              <TableCell className="text-right">{totOt76sun > 0 ? fmtH(totOt76sun) : '—'}</TableCell>
                              <TableCell className="text-right">{totOt76hol > 0 ? fmtH(totOt76hol) : '—'}</TableCell>
                              <TableCell className="text-right">{fmtH(r2(visible.reduce((s,r)=>s+Math.min(r.ot76wd,2),0)))}</TableCell>
                              <TableCell className="text-right">{fmtH(r2(visible.reduce((s,r)=>s+Math.max(0,r.ot76wd-2),0)))}</TableCell>
                              <TableCell className="text-right">{fmtH(r2(visible.reduce((s,r)=>s+Math.min(r.ot76sat,2),0)))}</TableCell>
                              <TableCell className="text-right">{fmtH(r2(visible.reduce((s,r)=>s+Math.max(0,r.ot76sat-2),0)))}</TableCell>
                            </TableRow>
                          </TableBody>
                        </Table>
                      </div>
                    </CardContent>
                  </Card>
                )}

                {/* ── Allowances detail ── */}
                <Card>
                  <CardHeader className="pb-2">
                    <CardTitle className="text-sm flex items-center gap-2">
                      <span className="text-amber-600">$</span> Allowances
                      <span className="text-xs font-normal text-muted-foreground">({visible.filter(r => r.allow.total > 0).length} staff with allowances)</span>
                    </CardTitle>
                  </CardHeader>
                  <CardContent className="p-0">
                    <div className="overflow-x-auto">
                      <Table>
                        <TableHeader>
                          <TableRow className="bg-amber-50/60 text-[11px]">
                            <TableHead className="min-w-[160px]">Staff</TableHead>
                            <TableHead className="text-right text-orange-700 whitespace-nowrap">Broken#</TableHead>
                            <TableHead className="text-right text-amber-700 whitespace-nowrap">Broken allow.<br/><span className="font-normal opacity-70">${BROKEN_ALLOWANCE_1}/shift</span></TableHead>
                            <TableHead className="text-right text-amber-600 whitespace-nowrap">Meal allow.~<br/><span className="font-normal opacity-70">${MEAL_ALLOWANCE}/OT event</span></TableHead>
                            <TableHead className="text-right font-semibold whitespace-nowrap">Total allow.</TableHead>
                            <TableHead className="text-right whitespace-nowrap">Gross pay<br/><span className="font-normal opacity-70">incl. allowances</span></TableHead>
                          </TableRow>
                        </TableHeader>
                        <TableBody>
                          {visible.map(({ row, broken, allow, gross }) => (
                            <TableRow key={row.staffName} className="text-xs hover:bg-amber-50/20">
                              <TableCell className="font-medium">{row.staffName}</TableCell>
                              <TableCell className="text-right">
                                {broken > 0
                                  ? <span className="font-medium text-orange-700">{broken}</span>
                                  : <span className="text-muted-foreground/30">—</span>}
                              </TableCell>
                              <TableCell className="text-right">
                                {allow.brokenAllow > 0
                                  ? <span className="font-medium text-amber-700">{fmt(allow.brokenAllow)}</span>
                                  : <span className="text-muted-foreground/30">—</span>}
                              </TableCell>
                              <TableCell className="text-right">
                                {allow.mealAllow > 0
                                  ? <span className="font-medium text-amber-600">{fmt(allow.mealAllow)}</span>
                                  : <span className="text-muted-foreground/30">—</span>}
                              </TableCell>
                              <TableCell className="text-right font-semibold">
                                {allow.total > 0 ? fmt(allow.total) : <span className="text-muted-foreground/30">—</span>}
                              </TableCell>
                              <TableCell className="text-right font-bold">
                                {gross !== null
                                  ? <span className={getEmpType(row.staffName) === 'casual' ? 'text-blue-700' : ''}>{fmt(gross)}</span>
                                  : <span className="text-muted-foreground text-xs font-normal">enter rate</span>}
                              </TableCell>
                            </TableRow>
                          ))}
                          {/* Totals */}
                          <TableRow className="border-t-2 font-bold text-xs bg-amber-50/20">
                            <TableCell>Totals</TableCell>
                            <TableCell className="text-right text-orange-700">{totBroken || '—'}</TableCell>
                            <TableCell className="text-right text-amber-700">{totBrokAllow > 0 ? fmt(totBrokAllow) : '—'}</TableCell>
                            <TableCell className="text-right text-amber-600">{totMealAllow > 0 ? fmt(totMealAllow) : '—'}</TableCell>
                            <TableCell className="text-right">{totAllow > 0 ? fmt(totAllow) : '—'}</TableCell>
                            <TableCell className="text-right">{totGross !== null ? fmt(totGross) : <span className="text-muted-foreground font-normal text-xs">enter rates</span>}</TableCell>
                          </TableRow>
                        </TableBody>
                      </Table>
                    </div>
                  </CardContent>
                </Card>

                {/* Rules reminder */}
                <div className="bg-orange-50 border border-orange-200 rounded-lg p-3 text-[11px] text-orange-800 space-y-1">
                  <p className="font-semibold text-xs">SCHADS Award — Exception Rules (MA000100)</p>
                  <ul className="list-disc list-inside space-y-0.5 leading-relaxed">
                    <li><strong>Daily OT trigger:</strong> &gt;10h active hours in a single day — same hour not double-counted with 76h cap OT</li>
                    <li><strong>Fortnightly OT trigger:</strong> &gt;76h total hours across the fortnight</li>
                    <li><strong>WD/Sat OT rate:</strong> 1.5× for the first 2h of OT, 2× for hours beyond 2h</li>
                    <li><strong>Sunday OT:</strong> 2.0× (same as ordinary Sunday — no separate OT bracket)</li>
                    <li><strong>Public Holiday OT:</strong> 2.5× (same as ordinary PH rate)</li>
                    <li><strong>Broken shift allowance:</strong> ${BROKEN_ALLOWANCE_1.toFixed(2)} per shift with 1 break · ${BROKEN_ALLOWANCE_2.toFixed(2)} for 2 breaks (cap not tracked per-shift)</li>
                    <li><strong>Meal allowance:</strong> ${MEAL_ALLOWANCE.toFixed(2)} per shift where OT &gt;1h · +${MEAL_ALLOWANCE.toFixed(2)} on same shift where OT &gt;4h (counted per-shift by backend)</li>
                  </ul>
                </div>
              </>
            )}
          </>
        );
      })()}

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

          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-sm uppercase tracking-widest flex items-center gap-2">
                <span className="inline-flex items-center justify-center w-5 h-5 bg-foreground text-background text-xs font-bold">3</span>
                Custom Allowances
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              {manualCustomAllowances.map((allow) => (
                <div key={allow.id} className="grid grid-cols-1 sm:grid-cols-[1.5fr_1fr_auto] gap-2 items-end">
                  <div className="space-y-1">
                    <label className="text-xs uppercase tracking-wider text-muted-foreground">Allowance Name</label>
                    <Input
                      type="text"
                      placeholder="e.g. Laundry allowance"
                      value={allow.label}
                      onChange={e => updateManualCustomAllowance(allow.id, 'label', e.target.value)}
                    />
                  </div>
                  <div className="space-y-1">
                    <label className="text-xs uppercase tracking-wider text-muted-foreground">Amount ($)</label>
                    <Input
                      type="number"
                      min="0"
                      step="0.01"
                      placeholder="0.00"
                      value={allow.amount}
                      onChange={e => updateManualCustomAllowance(allow.id, 'amount', e.target.value)}
                    />
                  </div>
                  <button
                    onClick={() => removeManualCustomAllowance(allow.id)}
                    className="h-10 w-10 border border-border flex items-center justify-center text-muted-foreground hover:border-destructive hover:text-destructive rounded-sm"
                    aria-label="Remove custom allowance"
                    type="button"
                  >
                    <X className="h-4 w-4" />
                  </button>
                </div>
              ))}
              <button
                onClick={addManualCustomAllowance}
                className="w-full border border-dashed border-border px-4 py-2 text-sm text-muted-foreground hover:border-foreground hover:text-foreground flex items-center justify-center gap-2 rounded-sm"
                type="button"
              >
                <Plus className="h-4 w-4" /> Add custom allowance
              </button>
            </CardContent>
          </Card>

          <Button onClick={runManual} disabled={!manualRate} className="w-full h-12 text-base font-bold uppercase tracking-widest">
            Calculate My Pay →
          </Button>

          {manualResults && (
            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="text-sm uppercase tracking-widest flex items-center gap-2">
                  <span className="inline-flex items-center justify-center w-5 h-5 bg-foreground text-background text-xs font-bold">4</span>
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
