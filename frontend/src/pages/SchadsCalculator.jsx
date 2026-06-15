import React, { useState, useMemo, useCallback, useEffect, useRef } from 'react';
import { Link } from 'react-router-dom';
import * as XLSX from 'xlsx';
import { Plus, X, AlertCircle, Upload, FileSpreadsheet, ChevronDown, UserPlus, EyeOff, Trash2, Download } from 'lucide-react';
import { toast } from 'sonner';
import { Card, CardContent, CardHeader, CardTitle } from '../ui/card';
import { Button } from '../ui/button';
import { Input } from '../ui/input';
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from '../ui/table';
import {
  usePayHours,
  useShiftPayHours,
  usePatchPayHoursManual,
  useClearPayHoursManual,
  usePatchShiftPayHoursManual,
} from '../api/payHours';
import { useStaffRates, staffRatesArrayToMap, useUpsertStaffRate } from '../api/staffRates';
import { STAFF_RATES_TABLE_FIELDS } from '../lib/staffRateFieldMeta';
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
  shiftRowPayableHours,
  totalOtHrs,
  calcBreakdown,
  effectiveSleepoverRate,
  calcOtAndBrokenPay,
  calcOt76MonetaryPay,
} from '../lib/schadsWageCalc';
import { downloadStaffPaySummaryCsv } from '../lib/staffPaySummaryExport';

const fmt = (n) => '$' + n.toFixed(2).replace(/\B(?=(\d{3})+(?!\d))/g, ',');
const fmtH = (n) => n.toFixed(2) + 'h';

const fmtExDate = (dt, tzOffset) => {
  if (!dt) return '—';
  const d = new Date(dt);
  if (!tzOffset) return d.toLocaleDateString('en-AU', { day: 'numeric', month: 'short', year: 'numeric' });
  const sign = tzOffset[0] === '+' ? 1 : -1;
  const clean = tzOffset.slice(1).replace(':', '');
  const h = parseInt(clean.slice(0, 2), 10);
  const m = parseInt(clean.slice(2, 4), 10);
  const adjustedMs = d.getTime() + sign * (h * 60 + m) * 60000;
  const adjusted = new Date(adjustedMs);
  return adjusted.toISOString().slice(0, 10);
};
const fmtPayPeriod = (row) => {
  if (!row?.periodStart && !row?.periodEnd) return '—';
  return `${fmtExDate(row.periodStart)} – ${fmtExDate(row.periodEnd)}`;
};

/** SCHADS casual defaults derived from a base daytime rate (includes 25% casual loading). */
function schadsFlatRatesRow(displayName, baseHourly) {
  const v = r2(parseFloat(String(baseHourly).replace(',', '')) || 0);
  return {
    name: displayName.trim(),
    daytime: v,
    nursingDaytime: 0,
    nursingAfternoon: 0,
    nursingNight: 0,
    nursingSaturday: 0,
    nursingSunday: 0,
    nursingPh: 0,
    afternoon: r2(v * 1.1),
    night: r2(v * 1.12),
    otUpto2: r2(v * 1.4),
    otAfter2: r2(v * 1.8),
    saturday: r2(v * 1.4),
    satOtAfter2: r2(v * 1.8),
    sunday: r2(v * 1.8),
    ph: r2(v * 2.2),
    mealAllow: 16.62,
    brokenShift: 20.82,
    sleepover: 90,
    kmRate: VEHICLE_RATE,
    allowance: 0,
  };
}

function autofillNonNursingRatesFromBase(row, baseVal) {
  const defaults = schadsFlatRatesRow(row?.name || '', baseVal);
  const next = { ...(row || {}) };
  for (const [field] of STAFF_RATES_TABLE_FIELDS) {
    if (field.startsWith('nursing')) continue;
    next[field] = defaults[field];
  }
  return next;
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

  const addAl = r2(Number(mrow.additionalAllowance) || 0);
  const showGross = r2(bd.gross + addAl);

  const pct = (n, total) => total > 0 ? ` (${((n / total) * 100).toFixed(0)}%)` : '';

  return (
    <div className="p-4 space-y-4 bg-muted/5 border-t border-border/40 w-full overflow-x-hidden">
      {/* Hero */}
      <div className="flex items-end justify-between flex-wrap gap-3 bg-foreground text-background rounded p-4">
        <div>
          <p className="text-[10px] uppercase tracking-widest opacity-60 mb-1">Gross Pay — {staffName}</p>
          <p className="font-bold text-2xl font-mono">{fmt(showGross)}</p>
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
          { label: 'Allowances',       val: fmt(r2(bd.allow.total + addAl)),  cls: 'text-amber-600' },
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
                  Broken shift — 1 break ({mrow.brokenShiftCount} × ${
                    (staffRates && Number(staffRates.brokenShift) > 0)
                      ? Number(staffRates.brokenShift).toFixed(2)
                      : BROKEN_ALLOWANCE_1
                  })
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
            {addAl > 0 && (
              <tr className="border-t border-border/30 bg-amber-50/30">
                <td className="px-3 py-2 text-amber-800">
                  Additional allowance (summary)
                  <span className="ml-1.5 text-[9px] font-normal text-muted-foreground/60 uppercase">Allowance</span>
                </td>
                <td className="text-right px-3 py-2 font-mono text-muted-foreground">—</td>
                <td className="text-right px-3 py-2 font-mono text-muted-foreground">—</td>
                <td className="text-right px-3 py-2 font-mono font-semibold text-amber-800">{fmt(addAl)}</td>
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
            {staffRates && (bd.allow.otherAllow || 0) > 0 && (
              <tr className="border-t border-border/30 bg-amber-50/30">
                <td className="px-3 py-2 text-amber-700">
                  Allowance (rates)
                  <span className="ml-1.5 text-[9px] font-normal text-muted-foreground/60 uppercase">Allowance</span>
                </td>
                <td className="text-right px-3 py-2 font-mono text-muted-foreground">—</td>
                <td className="text-right px-3 py-2 font-mono text-muted-foreground">—</td>
                <td className="text-right px-3 py-2 font-mono font-semibold text-amber-700">{fmt(bd.allow.otherAllow)}</td>
              </tr>
            )}
            {/* Total row */}
            <tr className="border-t-2 border-border bg-muted/20 font-bold">
              <td className="px-3 py-2.5 text-sm">Total</td>
              <td className="text-right px-3 py-2.5 font-mono">{fmtH(bd.totalHours)}</td>
              <td className="text-right px-3 py-2.5 text-muted-foreground">—</td>
              <td className="text-right px-3 py-2.5 font-mono text-base">{fmt(showGross)}</td>
            </tr>
          </tbody>
        </table>
      </div>

      {/* Pct breakdown bar */}
      <div className="space-y-1">
        <p className="text-[10px] uppercase tracking-wider text-muted-foreground">Pay composition</p>
        <div className="flex rounded overflow-hidden h-3 text-[0px]">
          {showGross > 0 && bd.basePay > 0 && <div title={`Base ${fmt(bd.basePay)}`} style={{ width: `${(bd.basePay / showGross) * 100}%` }} className="bg-slate-400" />}
          {showGross > 0 && bd.penaltyExtra > 0 && <div title={`Penalty ${fmt(bd.penaltyExtra)}`} style={{ width: `${(bd.penaltyExtra / showGross) * 100}%` }} className="bg-orange-400" />}
          {showGross > 0 && bd.otPay > 0 && <div title={`OT ${fmt(bd.otPay)}`} style={{ width: `${(bd.otPay / showGross) * 100}%` }} className="bg-rose-500" />}
          {showGross > 0 && bd.allow.total > 0 && <div title={`Allow. ${fmt(bd.allow.total)}`} style={{ width: `${(bd.allow.total / showGross) * 100}%` }} className="bg-amber-400" />}
          {showGross > 0 && addAl > 0 && <div title={`Add’l ${fmt(addAl)}`} style={{ width: `${(addAl / showGross) * 100}%` }} className="bg-amber-600" />}
        </div>
        <div className="flex gap-4 flex-wrap text-[10px] text-muted-foreground">
          <span><span className="inline-block w-2 h-2 rounded-sm bg-slate-400 mr-1" />Base {pct(bd.basePay, showGross)}</span>
          <span><span className="inline-block w-2 h-2 rounded-sm bg-orange-400 mr-1" />Penalty {pct(bd.penaltyExtra, showGross)}</span>
          <span><span className="inline-block w-2 h-2 rounded-sm bg-rose-500 mr-1" />OT {pct(bd.otPay, showGross)}</span>
          {bd.allow.total > 0 && <span><span className="inline-block w-2 h-2 rounded-sm bg-amber-400 mr-1" />Allow. {pct(bd.allow.total, showGross)}</span>}
          {addAl > 0 && <span><span className="inline-block w-2 h-2 rounded-sm bg-amber-600 mr-1" />Add’l {pct(addAl, showGross)}</span>}
        </div>
      </div>
    </div>
  );
};

/** Per-shift rows from the same pay-hours job that produced the summary (lazy-fetch when expanded). */
const PayHoursShiftsBreakdown = ({ payHoursId, expanded, isManualOnly, mrow, onShiftCtx }) => {
  const enabled = Boolean(payHoursId && expanded && !isManualOnly);
  const { data, isLoading, isError, error } = useShiftPayHours(payHoursId, enabled);

  const formatTime = (dt, tzOffset) => {
    if (!dt) return '—';
    const d = new Date(dt);
    if (!tzOffset) return d.toLocaleTimeString('en-AU', { hour: '2-digit', minute: '2-digit' });
    // Apply timezone offset to show original shift time
    const sign = tzOffset[0] === '+' ? 1 : -1;
    const clean = tzOffset.slice(1).replace(':', '');
    const h = parseInt(clean.slice(0, 2), 10);
    const m = parseInt(clean.slice(2, 4), 10);
    const adjustedMs = d.getTime() + sign * (h * 60 + m) * 60000;
    const adjusted = new Date(adjustedMs);
    return adjusted.toISOString().slice(11, 16);
  };
  const formatDate = (dt, tzOffset) => {
    if (!dt) return '—';
    const d = new Date(dt);
    const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
    if (!tzOffset) {
      return `${d.getUTCDate()} ${months[d.getUTCMonth()]} ${d.getUTCFullYear()}`;
    }
    // Apply timezone offset to show original shift date
    const sign = tzOffset[0] === '+' ? 1 : -1;
    const clean = tzOffset.slice(1).replace(':', '');
    const h = parseInt(clean.slice(0, 2), 10);
    const m = parseInt(clean.slice(2, 4), 10);
    const adjustedMs = d.getTime() + sign * (h * 60 + m) * 60000;
    const adjusted = new Date(adjustedMs);
    return `${adjusted.getUTCDate()} ${months[adjusted.getUTCMonth()]} ${adjusted.getUTCFullYear()}`;
  };
  const h = (v) => (v != null && v > 0 ? v.toFixed(2) : '—');
  const shiftOv = (shift, field, val, cls = '') => {
    const isOv = shift.manualFields?.[field] != null;
    return (
      <TableCell
        className={`text-right font-mono cursor-context-menu ${cls} ${isOv ? 'ring-1 ring-inset ring-blue-400 bg-blue-50/50' : ''}`}
        onContextMenu={
          onShiftCtx
            ? (e) => onShiftCtx(e, payHoursId, shift._id, field, val ?? 0)
            : undefined
        }
        title={onShiftCtx ? 'Right-click to edit' : undefined}
      >
        {h(val)}
      </TableCell>
    );
  };

  const shifts = data?.shifts || [];

  let body;
  if (isManualOnly || !payHoursId) {
    body = (
      <p className="text-xs text-muted-foreground leading-relaxed max-w-2xl">
        No shift list for this row — it is manual-only or not linked to a pay-hours record. Add shifts on{' '}
        <strong className="text-foreground">Pay Hours</strong> (upload CSV and compute) to see per-shift breakdown here.
      </p>
    );
  } else if (!expanded) {
    body = null;
  } else if (isLoading) {
    body = <p className="text-xs text-muted-foreground">Loading shifts…</p>;
  } else if (isError) {
    body = <p className="text-xs text-destructive">{error?.message || 'Could not load shifts'}</p>;
  } else if (!shifts.length) {
    body = <p className="text-xs text-muted-foreground">No shift breakdown found for this pay period.</p>;
  } else {
    body = (
      <div className="overflow-x-auto -mx-1">
        <Table>
          <TableHeader>
            <TableRow className="bg-muted/30">
              <TableHead className="text-[10px] whitespace-nowrap">Date</TableHead>
              <TableHead className="text-[10px] whitespace-nowrap">Start</TableHead>
              <TableHead className="text-[10px] whitespace-nowrap">End</TableHead>
              <TableHead className="text-[10px] whitespace-nowrap">Client</TableHead>
              <TableHead className="text-[10px] whitespace-nowrap">Type</TableHead>
              <TableHead className="text-right text-[10px] whitespace-nowrap">Hrs</TableHead>
              <TableHead className="text-right text-[10px] text-yellow-800 whitespace-nowrap" title="Weekday ordinary: local 6am–8pm (1× base), not clock AM">Day</TableHead>
              <TableHead className="text-right text-[10px] text-orange-800 whitespace-nowrap" title="After 8pm local (1.125×), not clock afternoon">Eve</TableHead>
              <TableHead className="text-right text-[10px] text-indigo-800 whitespace-nowrap">Night</TableHead>
              <TableHead className="text-right text-[10px] text-cyan-800 whitespace-nowrap">Sat</TableHead>
              <TableHead className="text-right text-[10px] text-red-800 whitespace-nowrap">Sun</TableHead>
              <TableHead className="text-right text-[10px] text-blue-800 whitespace-nowrap">Hol</TableHead>
              <TableHead className="text-right text-[10px] text-teal-800 whitespace-nowrap">Nursing</TableHead>
              <TableHead className="text-right text-[10px] text-emerald-800 whitespace-nowrap">km</TableHead>
              <TableHead className="text-[10px] whitespace-nowrap">Flags</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {shifts.map((shift) => (
              <TableRow key={shift._id} className="text-[11px]">
                <TableCell>{formatDate(shift.shiftDate, shift.timezoneOffset)}</TableCell>
                <TableCell className="font-mono">{formatTime(shift.shiftStart, shift.timezoneOffset)}</TableCell>
                <TableCell className="font-mono">{formatTime(shift.shiftEnd, shift.timezoneOffset)}</TableCell>
                <TableCell className="text-muted-foreground max-w-[140px] truncate" title={shift.clientName || ''}>
                  {shift.clientName || '—'}
                </TableCell>
                <TableCell>
                  <span className="capitalize">{String(shift.shiftType || '').replace(/_/g, ' ')}</span>
                </TableCell>
                <TableCell className="text-right font-mono font-medium">
                  {h(shiftRowPayableHours(shift))}
                </TableCell>
                {shiftOv(shift, 'morningHours', shift.morningHours, 'text-yellow-800')}
                {shiftOv(shift, 'afternoonHours', shift.afternoonHours, 'text-orange-800')}
                {shiftOv(shift, 'nightHours', shift.nightHours, 'text-indigo-800')}
                <TableCell className="text-right font-mono text-cyan-800">
                  {h(r2((shift.saturdayHours || 0) + (shift.saturdayOtUpto2 || 0) + (shift.saturdayOtAfter2 || 0)))}
                </TableCell>
                <TableCell className="text-right font-mono text-red-800">
                  {h(r2((shift.sundayHours || 0) + (shift.sundayOtUpto2 || 0) + (shift.sundayOtAfter2 || 0)))}
                </TableCell>
                <TableCell className="text-right font-mono text-blue-800">
                  {h(r2((shift.holidayHours || 0) + (shift.holidayOtUpto2 || 0) + (shift.holidayOtAfter2 || 0)))}
                </TableCell>
                <TableCell className="text-right font-mono text-teal-800">{h(shift.nursingCareHours)}</TableCell>
                <TableCell className="text-right font-mono text-emerald-800">
                  {shift.mileage != null && shift.mileage > 0 ? `${shift.mileage}` : '—'}
                </TableCell>
                <TableCell>
                  <div className="flex flex-wrap gap-1">
                    {shift.isBrokenShift && (
                      <span className="inline-block px-1 py-0.5 rounded text-[9px] bg-orange-100 text-orange-800">Broken</span>
                    )}
                    {shift.isSleepover && (
                      <span className="inline-block px-1 py-0.5 rounded text-[9px] bg-purple-100 text-purple-800">Sleepover</span>
                    )}
                    {shift.minimumEngagementException && (
                      <span className="inline-block px-1 py-0.5 rounded text-[9px] bg-amber-100 text-amber-900" title="Personal care shift under 2h — review minimum payment / adjust hours manually">
                        Min 2h review
                      </span>
                    )}
                    {(shift.shortTurnaroundHours || 0) > 0 && (
                      <span className="inline-block px-1 py-0.5 rounded text-[9px] bg-fuchsia-100 text-fuchsia-800" title="Double Time (No Break)">
                        No-break DT {h(shift.shortTurnaroundHours)}
                      </span>
                    )}
                    {(() => {
                      const ot76 = r2(
                        (shift.otAfter76Weekday || 0) +
                          (shift.otAfter76Saturday || 0) +
                          (shift.otAfter76Sunday || 0) +
                          (shift.otAfter76Holiday || 0)
                      );
                      if (ot76 <= 0) return null;
                      return (
                        <span className="inline-block px-1 py-0.5 rounded text-[9px] bg-rose-100 text-rose-800" title="Hours reclassified to OT>76h cap">
                          OT&gt;76 {h(ot76)}
                        </span>
                      );
                    })()}
                    {(() => {
                      const wdOt = r2((shift.weekdayOtUpto2 || 0) + (shift.weekdayOtAfter2 || 0));
                      const satOt = r2((shift.saturdayOtUpto2 || 0) + (shift.saturdayOtAfter2 || 0));
                      const sunOt = r2((shift.sundayOtUpto2 || 0) + (shift.sundayOtAfter2 || 0));
                      const holOt = r2((shift.holidayOtUpto2 || 0) + (shift.holidayOtAfter2 || 0));
                      const totalOt = r2(wdOt + satOt + sunOt + holOt);
                      if (totalOt <= 0) return null;
                      const parts = [];
                      if (wdOt > 0) parts.push(`WD ${wdOt.toFixed(2)}h`);
                      if (satOt > 0) parts.push(`Sat ${satOt.toFixed(2)}h`);
                      if (sunOt > 0) parts.push(`Sun ${sunOt.toFixed(2)}h`);
                      if (holOt > 0) parts.push(`Hol ${holOt.toFixed(2)}h`);
                      return (
                        <span
                          className="inline-block px-1 py-0.5 rounded text-[9px] bg-rose-100 text-rose-800"
                          title={parts.join(' · ')}
                        >
                          OT {totalOt.toFixed(2)}h
                        </span>
                      );
                    })()}
                  </div>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
          {mrow && (
            <tfoot>
              <tr className="border-t-2 border-foreground/20 bg-foreground/5 text-[11px] font-semibold">
                <td colSpan={5} className="px-3 py-2 text-[10px] uppercase tracking-wider text-muted-foreground">
                  Used in calculation
                </td>
                <td className="text-right px-3 py-2 font-mono font-bold">
                  {h(staffTotalHours(mrow))}
                </td>
                <td className="text-right px-3 py-2 font-mono text-yellow-800" title="Weekday day hours (ordinary, not OT)">
                  {h(mrow.morningHours)}
                </td>
                <td className="text-right px-3 py-2 font-mono text-orange-800" title="Weekday evening hours (ordinary, not OT)">
                  {h(mrow.afternoonHours)}
                </td>
                <td className="text-right px-3 py-2 font-mono text-indigo-800">
                  {h(mrow.nightHours)}
                </td>
                <td className="text-right px-3 py-2 font-mono text-cyan-800" title="Includes Sat OT">
                  {h(r2((mrow.saturdayHours || 0) + (mrow.saturdayOtUpto2 || 0) + (mrow.saturdayOtAfter2 || 0)))}
                </td>
                <td className="text-right px-3 py-2 font-mono text-red-800" title="Includes Sun OT">
                  {h(r2((mrow.sundayHours || 0) + (mrow.sundayOtUpto2 || 0) + (mrow.sundayOtAfter2 || 0)))}
                </td>
                <td className="text-right px-3 py-2 font-mono text-blue-800" title="Includes Holiday OT">
                  {h(r2((mrow.holidayHours || 0) + (mrow.holidayOtUpto2 || 0) + (mrow.holidayOtAfter2 || 0)))}
                </td>
                <td className="text-right px-3 py-2 font-mono text-teal-800">
                  {h(mrow.nursingCareHours)}
                </td>
                <td className="text-right px-3 py-2 font-mono text-emerald-800">
                  {(mrow.totalKm || 0) > 0 ? mrow.totalKm : '—'}
                </td>
                <td className="px-3 py-2 text-[10px] text-muted-foreground">
                  <div className="flex flex-wrap gap-1">
                    {(mrow.weekdayOtUpto2 || 0) + (mrow.weekdayOtAfter2 || 0) > 0 && (
                      <span className="inline-block px-1 py-0.5 rounded bg-rose-100 text-rose-800 whitespace-nowrap">
                        WD OT {h(r2((mrow.weekdayOtUpto2 || 0) + (mrow.weekdayOtAfter2 || 0)))}
                      </span>
                    )}
                    {(mrow.saturdayOtUpto2 || 0) + (mrow.saturdayOtAfter2 || 0) > 0 && (
                      <span className="inline-block px-1 py-0.5 rounded bg-rose-100 text-rose-800 whitespace-nowrap">
                        Sat OT {h(r2((mrow.saturdayOtUpto2 || 0) + (mrow.saturdayOtAfter2 || 0)))}
                      </span>
                    )}
                    {(mrow.sundayOtUpto2 || 0) + (mrow.sundayOtAfter2 || 0) > 0 && (
                      <span className="inline-block px-1 py-0.5 rounded bg-rose-100 text-rose-800 whitespace-nowrap">
                        Sun OT {h(r2((mrow.sundayOtUpto2 || 0) + (mrow.sundayOtAfter2 || 0)))}
                      </span>
                    )}
                    {(mrow.holidayOtUpto2 || 0) + (mrow.holidayOtAfter2 || 0) > 0 && (
                      <span className="inline-block px-1 py-0.5 rounded bg-rose-100 text-rose-800 whitespace-nowrap">
                        Hol OT {h(r2((mrow.holidayOtUpto2 || 0) + (mrow.holidayOtAfter2 || 0)))}
                      </span>
                    )}
                  </div>
                </td>
              </tr>
            </tfoot>
          )}
        </Table>
      </div>
    );
  }

  return (
    <details className="group border-t border-border/40 bg-muted/10">
      <summary className="flex cursor-pointer items-center gap-2 px-4 py-2.5 text-xs font-semibold text-muted-foreground hover:bg-muted/30 list-none [&::-webkit-details-marker]:hidden">
        <ChevronDown className="h-4 w-4 shrink-0 transition-transform group-open:rotate-180" />
        Shifts used in calculation
      </summary>
      <div className="px-4 pb-4">{body}</div>
    </details>
  );
};

const ExpandChevronButton = ({ expanded, onClick, title = 'Show shift breakdown' }) => (
  <button
    type="button"
    onClick={onClick}
    title={title}
    className={`shrink-0 w-5 h-5 flex items-center justify-center rounded border text-[11px] transition-all duration-200 ${
      expanded
        ? 'bg-foreground text-background border-foreground'
        : 'text-muted-foreground border-border hover:border-foreground hover:text-foreground'
    }`}
    style={{ transform: expanded ? 'rotate(90deg)' : 'rotate(0deg)', transition: 'transform 0.2s ease' }}
  >
    ▸
  </button>
);

const ShiftBreakdownExpandRow = ({ expanded, colSpan, containerWidth, children }) => (
  <TableRow className="hover:bg-transparent border-0">
    <TableCell colSpan={colSpan} className="p-0 border-0" style={{ width: containerWidth || '100%' }}>
      <div
        style={{
          display: 'grid',
          gridTemplateRows: expanded ? '1fr' : '0fr',
          transition: 'grid-template-rows 0.3s ease',
          overflow: 'hidden',
          width: containerWidth ? `${containerWidth}px` : '100%',
        }}
      >
        <div style={{ overflow: 'hidden', minWidth: 0 }}>{children}</div>
      </div>
    </TableCell>
  </TableRow>
);

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
  nursingAfternoonHours: 0,
  nursingNightHours: 0,
  nursingSaturdayHours: 0,
  nursingSundayHours: 0,
  nursingHolidayHours: 0,
  otAfter76Hours: 0,
  otAfter76Weekday: 0,
  otAfter76Saturday: 0,
  otAfter76Sunday: 0,
  otAfter76Holiday: 0,
  shortTurnaroundHours: 0,
  brokenShiftCount: 0,
  brokenShift2BreakCount: 0,
  mealAllowanceCount: 0,
  sleepoversCount: 0,
  minimumEngagementExceptionCount: 0,
  totalKm: 0,
  _manualOnly: true,
});

function schadsStorageKey(locationId) {
  return `schads-calculator-v1:${locationId || 'global'}`;
}

// ── Right-click editable field registry ──────────────────────────────
const EDITABLE_FIELDS = {
    morningHours:      'Daytime Hours (≤8pm local, 1×)',
    afternoonHours:    'Evening Hours (>8pm local, 1.125×)',
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
  additionalAllowance: 'Additional allowance ($)',
};

const SHIFT_EDITABLE_FIELDS = {
  morningHours: 'Day Hours',
  afternoonHours: 'Eve Hours',
  nightHours: 'Night Hours',
  saturdayHours: 'Saturday',
  sundayHours: 'Sunday',
  holidayHours: 'Holiday',
  nursingCareHours: 'Nursing',
  shortTurnaroundHours: 'Short Turnaround',
  weekdayOtUpto2: 'WD OT ≤2h',
  weekdayOtAfter2: 'WD OT >2h',
  saturdayOtUpto2: 'Sat OT ≤2h',
  saturdayOtAfter2: 'Sat OT >2h',
  sundayOtUpto2: 'Sun OT ≤2h',
  sundayOtAfter2: 'Sun OT >2h',
  holidayOtUpto2: 'Hol OT ≤2h',
  holidayOtAfter2: 'Hol OT >2h',
};

function overridesFromPayHoursRows(rows) {
  const out = {};
  for (const row of rows) {
    const mf = row.manualFields || {};
    for (const [field, val] of Object.entries(mf)) {
      out[`${row.staffName}:${field}`] = val;
    }
  }
  return out;
}

// ── Floating context-menu editor ─────────────────────────────────────
const CellContextMenu = ({ menu, overrides, onSave, onClear, onClose, fieldLabels = EDITABLE_FIELDS }) => {
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
    if (!isNaN(n)) onSave(menu.staffName, menu.field, n);
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
        <p className="text-xs font-semibold text-foreground">{fieldLabels[menu.field] || menu.field}</p>
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
        <button
          onClick={() => { onClear(menu.staffName, menu.field); onClose(); }}
          disabled={!isOverridden}
          className="flex-1 h-7 rounded border border-input text-xs text-muted-foreground enabled:hover:bg-muted disabled:opacity-50 disabled:cursor-not-allowed"
        >
          Clear
        </button>
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
const StaffRatesEditModal = ({ edit, displayNameForRateKey, onSave, onClose }) => {
  const ref = useRef(null);
  const [draft, setDraft] = useState(null);
  const [aliasesStr, setAliasesStr] = useState('');

  useEffect(() => {
    if (!edit) { setDraft(null); setAliasesStr(''); return; }
    const row = { ...edit.row };
    if (!row.sleepover) row.sleepover = 90;
    setDraft(row);
    setAliasesStr((edit.aliases || []).join(', '));
  }, [edit]);

  useEffect(() => {
    if (!edit) return;
    const onKey = (e) => { if (e.key === 'Escape') onClose(); };
    const onDown = (e) => { if (ref.current && !ref.current.contains(e.target)) onClose(); };
    document.addEventListener('keydown', onKey);
    document.addEventListener('mousedown', onDown);
    return () => { document.removeEventListener('keydown', onKey); document.removeEventListener('mousedown', onDown); };
  }, [edit, onClose]);

  if (!edit || !draft) return null;

  const patch = (field, raw) => {
    const num = r2(parseFloat(String(raw).replace(',', '')) || 0);
    setDraft((d) => {
      if (field === 'daytime') return autofillNonNursingRatesFromBase(d, num);
      return { ...d, [field]: num };
    });
  };

  const handleSaveAll = () => {
    const parsedAliases = aliasesStr.split(',').map(a => a.trim()).filter(Boolean);
    onSave(edit.key, draft, parsedAliases);
    onClose();
  };
  const handleClearAll = () => {
    setDraft((prev) => {
      const next = { ...prev };
      for (const [field] of STAFF_RATES_TABLE_FIELDS) next[field] = 0;
      return next;
    });
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-background/80 backdrop-blur-sm"
      role="dialog"
      aria-modal="true"
    >
      <Card ref={ref} className="w-full max-w-3xl max-h-[90vh] overflow-y-auto shadow-lg">
        <CardHeader className="flex flex-row items-center justify-between space-y-0">
          <CardTitle className="text-base">Edit SCHADS rates — {displayNameForRateKey(edit.key)}</CardTitle>
          <Button type="button" variant="ghost" size="icon" onClick={onClose} aria-label="Close">
            <X className="h-4 w-4" />
          </Button>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-1">
            <span className="text-[10px] uppercase text-muted-foreground">Aliases (comma-separated)</span>
            <Input
              type="text"
              className="h-8 text-xs"
              value={aliasesStr}
              onChange={(e) => setAliasesStr(e.target.value)}
              placeholder="e.g. J. Smith, John S"
            />
          </div>
          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-2">
            {STAFF_RATES_TABLE_FIELDS.map(([field, label]) => (
              <div key={field} className="space-y-1">
                <span className="text-[10px] uppercase text-muted-foreground">{label}</span>
                <Input
                  type="number"
                  step="0.01"
                  min="0"
                  className="h-8 text-xs"
                  value={
                    field === 'allowance'
                      ? draft[field] ? draft[field] : ''
                      : draft[field] ?? ''
                  }
                  onChange={(e) => patch(field, e.target.value)}
                />
              </div>
            ))}
          </div>
          <div className="flex gap-2 pt-2">
            <Button type="button" onClick={handleSaveAll}>Save All</Button>
            <Button type="button" variant="outline" onClick={handleClearAll}>Clear</Button>
            <Button type="button" variant="outline" onClick={onClose}>Cancel</Button>
          </div>
        </CardContent>
      </Card>
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

  const [view, setView] = useState('summary'); // 'summary' | 'exceptions' | 'rates' | 'manual'

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
  const [shiftCtxMenu, setShiftCtxMenu] = useState(null);
  const [ctxMenu, setCtxMenu]     = useState(null); // { x, y, staffName, field, original }
  const [ratesEdit, setRatesEdit] = useState(null); // { key, row } — popup for rates section

  const [manualStaffNames, setManualStaffNames] = useState([]);
  const [hiddenNormNames, setHiddenNormNames] = useState([]);
  const [addStaffDraft, setAddStaffDraft] = useState('');
  const [ratesAddName, setRatesAddName] = useState('');
  const [ratesAddBase, setRatesAddBase] = useState('');
  const unifiedDocRef = useRef(null);

  const closeCtx = useCallback(() => setCtxMenu(null), []);
  const closeShiftCtx = useCallback(() => setShiftCtxMenu(null), []);

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
  const patchPayHoursM = usePatchPayHoursManual();
  const clearPayHoursM = useClearPayHoursManual();
  const patchShiftPayHoursM = usePatchShiftPayHoursManual();
  const apiRows = useMemo(
    () => (payHoursData?.payHours || []).slice().sort((a, b) => a.staffName.localeCompare(b.staffName)),
    [payHoursData]
  );

  const saveOverride = useCallback(
    async (staffName, field, value) => {
      setOverrides((prev) => ({ ...prev, [`${staffName}:${field}`]: value }));
      const row = apiRows.find((r) => r.staffName === staffName);
      if (!row?._id) return;
      try {
        await patchPayHoursM.mutateAsync({ payHoursId: row._id, fields: { [field]: value } });
      } catch (e) {
        toast.error(e?.response?.data?.error || 'Failed to save pay hours override');
      }
    },
    [apiRows, patchPayHoursM]
  );
  const clearOverride = useCallback(
    async (staffName, field) => {
      const row = apiRows.find((r) => r.staffName === staffName);
      if (!row?._id) {
        setOverrides((prev) => {
          const n = { ...prev };
          delete n[`${staffName}:${field}`];
          return n;
        });
        return;
      }
      try {
        const remaining = { ...(row.manualFields || {}) };
        delete remaining[field];
        if (Object.keys(remaining).length === 0) {
          await clearPayHoursM.mutateAsync(row._id);
        } else {
          await patchPayHoursM.mutateAsync({ payHoursId: row._id, unset: [field] });
        }
        setOverrides((prev) => {
          const n = { ...prev };
          delete n[`${staffName}:${field}`];
          return n;
        });
      } catch (e) {
        toast.error(e?.response?.data?.error || 'Failed to clear override');
      }
    },
    [apiRows, patchPayHoursM, clearPayHoursM]
  );
  const saveShiftOverride = useCallback(
    async (payHoursId, shiftPayHoursId, field, value) => {
      try {
        await patchShiftPayHoursM.mutateAsync({
          payHoursId,
          shiftPayHoursId,
          fields: { [field]: value },
        });
      } catch (e) {
        toast.error(e?.response?.data?.error || 'Failed to save shift override');
      }
    },
    [patchShiftPayHoursM]
  );
  const handleShiftCtx = useCallback((e, payHoursId, shiftPayHoursId, field, original) => {
    e.preventDefault();
    setShiftCtxMenu({ x: e.clientX, y: e.clientY, payHoursId, shiftPayHoursId, field, original });
  }, []);

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
  const payHoursRowsSignature = useMemo(
    () => apiRows
      .map((r) => ([
        String(r._id || ''),
        String(r.computedAt || ''),
        Number(r.morningHours || 0),
        Number(r.afternoonHours || 0),
        Number(r.nightHours || 0),
        Number(r.weekdayOtUpto2 || 0),
        Number(r.weekdayOtAfter2 || 0),
        Number(r.shortTurnaroundHours || 0),
        Number(r.brokenShiftCount || 0),
      ].join(':')))
      .sort()
      .join('|'),
    [apiRows]
  );

  const storageKey = useMemo(() => schadsStorageKey(locationIdProp), [locationIdProp]);

  const getEmpType = useCallback((staffName) => empTypes[staffName] ?? defaultEmpType, [empTypes, defaultEmpType]);

  // ── Payroll / staff rates (declared before totals so gross sum uses rates file) ──
  const payrollFileRef = useRef(null);
  const ratesFileRef = useRef(null);
  const [payrollData, setPayrollData] = useState(null); // Map: normName → { name, earnings }
  /** When true, Gross column uses imported payroll Earnings for name-matched staff so Diff = $0 (model unchanged; expand row for breakdown). */
  const [alignGrossToPayroll, setAlignGrossToPayroll] = useState(false);
  const [staffRatesMap, setStaffRatesMap] = useState(null); // Map: normName → rates object (XLSX/session overrides; wins over DB for same key)
  const [ratesFileName, setRatesFileName] = useState(null);
  const [schadsHydrated, setSchadsHydrated] = useState(false);
  const [overrideResetNotice, setOverrideResetNotice] = useState('');
  const lastAppliedRowsSigRef = useRef(null);

  const { data: staffRatesApiData } = useStaffRates(locationIdProp || undefined);
  const { mutate: upsertStaffRate } = useUpsertStaffRate();
  const staffRatesFromDbMap = useMemo(
    () => staffRatesArrayToMap(staffRatesApiData?.staffRates),
    [staffRatesApiData]
  );
  /** DB (per location) + local/XLSX overrides: overrides replace same normName. */
  const resolvedStaffRatesMap = useMemo(() => {
    const m = new Map(staffRatesFromDbMap);
    if (staffRatesMap) for (const [k, v] of staffRatesMap) m.set(k, v);
    return m;
  }, [staffRatesFromDbMap, staffRatesMap]);

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
      const staffRates = resolvedStaffRatesMap.get(normName(row.staffName)) ?? null;
      const g = staffRates ? calcGrossFromRates(mrow, staffRates) : calcGross(mrow, rate, empT);
      const addAl = r2(Number(mrow.additionalAllowance) || 0);
      t.additionalAllowanceSum = r2((t.additionalAllowanceSum || 0) + addAl);
      if (g !== null) { t.gross = r2(t.gross + g + addAl); grossCount++; }
    }
    return { ...t, grossReady: displayRows.length > 0 && grossCount === displayRows.length };
  }, [displayRows, baseRates, defaultRate, empTypes, defaultEmpType, getMergedRow, resolvedStaffRatesMap, normName]);

  /** Sum of Gross column (uses payroll Earnings per row when alignGrossToPayroll + match). */
  const payrollFooterStats = useMemo(() => {
    if (!payrollData) return null;
    let totalPayroll = 0;
    let totalDisplayGross = 0;
    let matched = 0;
    for (const row of displayRows) {
      const mrow = getMergedRow(row);
      const rateVal = baseRates[row.staffName] ?? defaultRate;
      const empT = getEmpType(row.staffName);
      const staffRates = resolvedStaffRatesMap.get(normName(row.staffName)) ?? null;
      const modeled = staffRates ? calcGrossFromRates(mrow, staffRates) : calcGross(mrow, rateVal, empT);
      const addAl = r2(Number(mrow.additionalAllowance) || 0);
      const modeledWithAdd = modeled != null ? r2(modeled + addAl) : null;
      const p = payrollData.get(normName(row.staffName));
      if (p) {
        totalPayroll = r2(totalPayroll + p.earnings);
        matched++;
      }
      const show = (alignGrossToPayroll && p) ? p.earnings : modeledWithAdd;
      if (show != null) totalDisplayGross = r2(totalDisplayGross + show);
    }
    return {
      totalPayroll,
      totalDisplayGross,
      totalDiff: r2(totalDisplayGross - totalPayroll),
      matched,
    };
  }, [displayRows, payrollData, getMergedRow, baseRates, defaultRate, getEmpType, resolvedStaffRatesMap, normName, alignGrossToPayroll]);

  const payrollVarianceStats = useMemo(() => {
    if (!payrollData) return null;
    let matched = 0;
    let zeroVariance = 0;
    let withVariance = 0;
    for (const row of displayRows) {
      const match = payrollData.get(normName(row.staffName));
      if (!match) continue;
      matched++;
      const mrow = getMergedRow(row);
      const rateVal = baseRates[row.staffName] ?? defaultRate;
      const empT = getEmpType(row.staffName);
      const staffRates = resolvedStaffRatesMap.get(normName(row.staffName)) ?? null;
      const modeled = staffRates ? calcGrossFromRates(mrow, staffRates) : calcGross(mrow, rateVal, empT);
      if (modeled === null) continue;
      const addAl = r2(Number(mrow.additionalAllowance) || 0);
      const modeledWithAdd = r2(modeled + addAl);
      const diff = Math.abs(r2(modeledWithAdd - match.earnings));
      if (diff <= 0.01) zeroVariance++;
      else withVariance++;
    }
    return { matched, zeroVariance, withVariance };
  }, [payrollData, displayRows, normName, getMergedRow, baseRates, defaultRate, getEmpType, resolvedStaffRatesMap]);

  // Count staff with any exception (OT, OT>76, broken shifts, or short PC minimum-engagement flags)
  const exceptionCount = useMemo(() =>
    displayRows.filter(row => {
      const m = getMergedRow(row);
      return totalOtHrs(m) > 0 || (m.brokenShiftCount || 0) > 0 ||
        (m.otAfter76Weekday||0) > 0 || (m.otAfter76Saturday||0) > 0 ||
        (m.otAfter76Sunday||0) > 0  || (m.otAfter76Holiday||0) > 0 ||
        (m.minimumEngagementExceptionCount || 0) > 0;
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
  }, [storageKey, onStaffRatesMapChange, payHoursRowsSignature]);

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
          payHoursRowsSignature,
        })
      );
    } catch (_) { /* ignore */ }
  }, [schadsHydrated, storageKey, baseRates, empTypes, defaultRate, defaultEmpType, manualStaffNames, hiddenNormNames, staffRatesMap, ratesFileName, payHoursRowsSignature]);

  useEffect(() => {
    if (!apiRows.length) {
      setOverrides({});
      return;
    }
    setOverrides(overridesFromPayHoursRows(apiRows));
    lastAppliedRowsSigRef.current = payHoursRowsSignature;
  }, [apiRows, payHoursRowsSignature]);

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
      allowance:  h.findIndex((x) => x === 'allowance' || x === 'other allowance'),
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
          allowance:  idx.allowance >= 0 ? g('allowance') : 0,
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
      if (!name || isNaN(earn) || earn < 0) continue;
      const nLower = name.toLowerCase();
      if (nLower === 'total' || nLower === 'totals' || nLower === 'subtotal' || nLower === 'summary') continue;
      map.set(normName(name), { name, earnings: earn });
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

  const displayNameForRateKey = useCallback(
    (key) =>
      staffRatesMap?.get(key)?.name ??
      staffRatesFromDbMap.get(key)?.name ??
      staffRows.find((r) => normName(r.staffName) === key)?.staffName ??
      staffRatesApiData?.staffRates?.find((r) => r.normName === key)?.staffName ??
      key,
    [staffRatesMap, staffRatesFromDbMap, staffRows, staffRatesApiData, normName],
  );

  const getAliasesForKey = useCallback((key) => {
    const dbRow = staffRatesApiData?.staffRates?.find((r) => r.normName === key);
    return dbRow?.aliases || [];
  }, [staffRatesApiData]);

  const closeRatesEdit = useCallback(() => setRatesEdit(null), []);
  const handleRatesCtx = useCallback((e, key, row) => {
    e.preventDefault();
    setRatesEdit({ key, row, aliases: getAliasesForKey(key) });
  }, [getAliasesForKey]);
  const saveRatesEdit = useCallback((key, updatedRow, aliases) => {
    const mergedRates = {
      ...(staffRatesFromDbMap.get(key) || {}),
      ...updatedRow,
    };
    setStaffRatesMap((prev) => {
      const m = new Map(prev || []);
      const name = displayNameForRateKey(key);
      const cur = m.get(key) || staffRatesFromDbMap.get(key) || schadsFlatRatesRow(name, defaultRate || 0);
      m.set(key, { ...cur, ...mergedRates });
      onStaffRatesMapChange?.(m, ratesFileName || 'rates');
      return m;
    });
    if (locationIdProp) {
      const dbRow = staffRatesApiData?.staffRates?.find((r) => r.normName === key);
      if (dbRow) {
        upsertStaffRate({
          locationId: locationIdProp,
          shiftcareStaffId: dbRow.shiftcareStaffId,
          staffName: dbRow.staffName,
          aliases: aliases ?? dbRow.aliases ?? [],
          rates: mergedRates,
        }).catch(() => {});
      }
    }
  }, [displayNameForRateKey, defaultRate, onStaffRatesMapChange, ratesFileName, staffRatesFromDbMap, staffRatesApiData, locationIdProp, upsertStaffRate]);

  const staffRatesTabRowKeys = useMemo(() => {
    const keys = new Set();
    for (const r of staffRows) keys.add(normName(r.staffName));
    if (staffRatesMap) for (const k of staffRatesMap.keys()) keys.add(k);
    for (const k of staffRatesFromDbMap.keys()) keys.add(k);
    return [...keys].sort((a, b) =>
      displayNameForRateKey(a).localeCompare(displayNameForRateKey(b), undefined, { sensitivity: 'base' }),
    );
  }, [staffRows, staffRatesMap, staffRatesFromDbMap, normName, displayNameForRateKey]);

  const patchStaffRatesField = useCallback(
    (key, field, rawVal) => {
      const num = r2(parseFloat(String(rawVal).replace(',', '')) || 0);
      setStaffRatesMap((prev) => {
        const m = new Map(prev || []);
        const name = displayNameForRateKey(key);
        const cur = m.get(key) || staffRatesFromDbMap.get(key) || schadsFlatRatesRow(name, defaultRate || 0);
        m.set(key, { ...cur, [field]: num });
        onStaffRatesMapChange?.(m, ratesFileName || 'rates');
        return m;
      });
    },
    [displayNameForRateKey, defaultRate, onStaffRatesMapChange, ratesFileName, staffRatesFromDbMap],
  );

  const applyFlatBaseToStaffKey = useCallback(
    (key, rawVal) => {
      const v = r2(parseFloat(String(rawVal).replace(',', '')) || 0);
      setStaffRatesMap((prev) => {
        const m = new Map(prev || []);
        const name = displayNameForRateKey(key);
        m.set(key, schadsFlatRatesRow(name, v));
        onStaffRatesMapChange?.(m, ratesFileName || 'rates');
        return m;
      });
    },
    [displayNameForRateKey, onStaffRatesMapChange, ratesFileName],
  );

  const removeStaffRatesRow = useCallback(
    (key) => {
      setStaffRatesMap((prev) => {
        if (!prev) return null;
        const m = new Map(prev);
        m.delete(key);
        const next = m.size > 0 ? m : null;
        onStaffRatesMapChange?.(next, next ? ratesFileName : null);
        return next;
      });
    },
    [onStaffRatesMapChange, ratesFileName],
  );

  const addStaffRatesEntry = useCallback(() => {
    const name = ratesAddName.trim();
    if (!name) return;
    const k = normName(name);
    setManualStaffNames((prev) => (prev.some((n) => normName(n) === k) ? prev : [...prev, name]));
    const base = ratesAddBase.trim() || defaultRate || '0';
    setStaffRatesMap((prev) => {
      const m = new Map(prev || []);
      m.set(k, schadsFlatRatesRow(name, base));
      onStaffRatesMapChange?.(m, ratesFileName || 'rates');
      return m;
    });
    setRatesAddName('');
    setRatesAddBase('');
  }, [ratesAddName, ratesAddBase, defaultRate, normName, onStaffRatesMapChange, ratesFileName]);

  const summaryColSpan = 28 + (payrollData ? 3 : 0);

  const handleExportEmployeeHours = useCallback(() => {
    if (!displayRows.length) {
      toast.message('No staff rows to export');
      return;
    }
    try {
      downloadStaffPaySummaryCsv(displayRows, {
        getMergedRow,
        getGrossPay: (row, mrow) => {
          const rateVal = baseRates[row.staffName] ?? defaultRate;
          const empT = getEmpType(row.staffName);
          const staffRates = resolvedStaffRatesMap.get(normName(row.staffName)) ?? null;
          const modeledBase = staffRates
            ? calcGrossFromRates(mrow, staffRates)
            : calcGross(mrow, rateVal, empT);
          const addAlRow = r2(Number(mrow.additionalAllowance) || 0);
          const modeledGross = modeledBase !== null ? r2(modeledBase + addAlRow) : null;
          const payrollForGross = payrollData?.get(normName(row.staffName));
          if (alignGrossToPayroll && payrollForGross) return payrollForGross.earnings;
          return modeledGross;
        },
      });
    } catch (err) {
      toast.error(err?.message || 'Export failed');
    }
  }, [
    displayRows,
    getMergedRow,
    baseRates,
    defaultRate,
    getEmpType,
    resolvedStaffRatesMap,
    normName,
    payrollData,
    alignGrossToPayroll,
  ]);

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
      <CellContextMenu
        menu={
          shiftCtxMenu
            ? {
                x: shiftCtxMenu.x,
                y: shiftCtxMenu.y,
                staffName: '_shift_',
                field: shiftCtxMenu.field,
                original: shiftCtxMenu.original,
              }
            : null
        }
        overrides={{}}
        fieldLabels={SHIFT_EDITABLE_FIELDS}
        onSave={(_staffName, field, value) => {
          if (!shiftCtxMenu) return;
          saveShiftOverride(
            shiftCtxMenu.payHoursId,
            shiftCtxMenu.shiftPayHoursId,
            field,
            value
          );
        }}
        onClear={() => closeShiftCtx()}
        onClose={closeShiftCtx}
      />

      {/* Staff rates edit popup (right-click on rates table rows) */}
      <StaffRatesEditModal
        edit={ratesEdit}
        displayNameForRateKey={displayNameForRateKey}
        onSave={saveRatesEdit}
        onClose={closeRatesEdit}
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
              <Link to="/workforce#workforce-roster" className="text-primary underline font-medium">
                Workforce → Setup → Shifts &amp; pay hours
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
      <div className="flex flex-wrap gap-2 items-center">
        <Button size="sm" variant={view === 'summary'    ? 'default' : 'outline'} onClick={() => setView('summary')}>Staff Pay Summary</Button>
        <Button size="sm" variant={view === 'exceptions' ? 'default' : 'outline'} onClick={() => setView('exceptions')}>
          Exceptions
          {view !== 'exceptions' && exceptionCount > 0 && (
            <span className="ml-1.5 inline-flex items-center justify-center rounded-full bg-orange-500 text-white text-[10px] font-bold w-4 h-4">{exceptionCount}</span>
          )}
        </Button>
        <Button size="sm" variant={view === 'rates' ? 'default' : 'outline'} onClick={() => setView('rates')}>
          Staff rates
        </Button>
        <Button size="sm" variant={view === 'manual'     ? 'default' : 'outline'} onClick={() => setView('manual')}>Manual Scenario</Button>
        {view === 'summary' && displayRows.length > 0 && (
          <Button
            type="button"
            size="sm"
            variant="outline"
            className="gap-1.5 ml-auto"
            onClick={handleExportEmployeeHours}
          >
            <Download className="h-4 w-4" />
            Export employee hours
          </Button>
        )}
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
                    {payrollData && payrollVarianceStats && (
                      <span className="text-xs text-muted-foreground">
                        {payrollVarianceStats.matched} matched · {payrollVarianceStats.zeroVariance} zero variance · {payrollVarianceStats.withVariance} variance
                      </span>
                    )}
                    {payrollData && (
                      <label className="inline-flex items-center gap-1.5 text-xs text-foreground cursor-pointer select-none" title="Sets Gross Pay to the imported Earnings for each name that exists in both lists. Diff becomes $0 for those rows. Expand a row to see the modeled SCHADS breakdown (unchanged).">
                        <input
                          type="checkbox"
                          className="rounded border-input"
                          checked={alignGrossToPayroll}
                          onChange={(e) => setAlignGrossToPayroll(e.target.checked)}
                        />
                        <span>Align Gross to payroll</span>
                      </label>
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
                        ['Evening / >8pm (1.125×)', `$${r2(base*1.125+load).toFixed(2)}/h`],
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
                        <TableHead colSpan={5} className="text-center text-green-800 border-r border-border/50 py-1">Allowances</TableHead>
                        <TableHead colSpan={1} className="text-center" />
                        {payrollData && (
                          <TableHead
                            colSpan={3}
                            className="text-center text-emerald-800 border-l border-border/50 py-1"
                            title="Diff = Gross Pay (this screen) minus Payroll (file). $0 only if the same pay run, the same hours in Pay Hours, and the same effective rates/allowances as ShiftCare. Payroll often includes adjustments, on‑call, higher classification, or a different date range than the roster used here."
                          >
                            Payroll Comparison
                          </TableHead>
                        )}
                      </TableRow>
                      {/* Column header row */}
                      <TableRow className="bg-muted/30 text-[11px]">
                        <TableHead className="min-w-[160px] sticky left-0 bg-muted/30 z-10 border-r border-border/50">Staff</TableHead>
                        <TableHead className="min-w-[90px]">Rate ($)</TableHead>
                        <TableHead className="min-w-[100px] border-r border-border/50">Type</TableHead>
                        <TableHead className="text-right text-yellow-700 whitespace-nowrap" title="Ordinary weekday hours up to 8pm local (1×). Not clock AM.">Day<br/><span className="text-[9px] font-normal opacity-70">≤8pm</span></TableHead>
                        <TableHead className="text-right text-orange-700 whitespace-nowrap" title="After 8pm local (1.125×). Not clock afternoon.">Eve<br/><span className="text-[9px] font-normal opacity-70">1.125×</span></TableHead>
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
                        <TableHead className="text-right text-amber-600 whitespace-nowrap">Meal<br/><span className="text-[9px] font-normal opacity-70">allow.~</span></TableHead>
                        <TableHead className="text-right text-amber-800 border-r border-border/50 whitespace-nowrap" title="Right-click to add a one-off allowance (saved with overrides)">Add’l $<br/><span className="text-[9px] font-normal opacity-70">edit</span></TableHead>
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
                        const staffRates = resolvedStaffRatesMap.get(normName(row.staffName)) ?? null;
                        const modeledBase = staffRates ? calcGrossFromRates(mrow, staffRates) : calcGross(mrow, rateVal, empT);
                        const addAlRow = r2(Number(mrow.additionalAllowance) || 0);
                        const modeledGross = modeledBase !== null ? r2(modeledBase + addAlRow) : null;
                        const payrollForGross = payrollData?.get(normName(row.staffName));
                        const displayGross =
                          alignGrossToPayroll && payrollForGross
                            ? payrollForGross.earnings
                            : modeledGross;
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
                                <ExpandChevronButton
                                  expanded={!!expandedBreakdown[row.staffName]}
                                  onClick={() => toggleBreakdown(row.staffName)}
                                  title="Show pay breakdown"
                                />
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
                            <TableCell
                              className="cursor-context-menu"
                              onContextMenu={(e) => {
                                e.preventDefault();
                                const key = normName(row.staffName);
                                const existing = resolvedStaffRatesMap.get(key);
                                const rowData = existing ? { ...existing } : schadsFlatRatesRow(row.staffName, rateVal || defaultRate || 0);
                                if (!rowData.sleepover) rowData.sleepover = 90;
                                setRatesEdit({ key, row: rowData, aliases: getAliasesForKey(key) });
                              }}
                              title="Right-click to edit all SCHADS rates for this staff"
                            >
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
                            <TableCell className={`text-right tabular-nums ${allow.mealAllow > 0 ? 'text-amber-600' : 'text-muted-foreground/30'}`}>{allow.mealAllow > 0 ? fmt(allow.mealAllow) : '—'}</TableCell>
                            {(() => {
                              const k = `${row.staffName}:additionalAllowance`;
                              const isOv = k in overrides;
                              return (
                                <TableCell
                                  className={`text-right tabular-nums border-r border-border/50 cursor-context-menu select-none ${addAlRow > 0 || isOv ? 'text-amber-800 font-medium' : 'text-muted-foreground/30'} ${isOv ? 'ring-1 ring-inset ring-blue-400 bg-blue-50/40' : ''}`}
                                  onContextMenu={(e) => handleCtx(e, row.staffName, 'additionalAllowance', row.additionalAllowance ?? 0)}
                                  title="Right-click to edit additional allowance ($)"
                                >
                                  {(addAlRow > 0 || isOv) ? fmt(addAlRow) : '—'}
                                  {isOv && <span className="ml-0.5 inline-block w-1.5 h-1.5 rounded-full bg-blue-500 align-middle" />}
                                </TableCell>
                              );
                            })()}
                            {/* KM */}
                            <TableCell className={`text-right tabular-nums ${(mrow.totalKm || 0) > 0 ? 'text-emerald-700' : 'text-muted-foreground/30'}`}>
                              {(mrow.totalKm || 0) > 0 ? `${mrow.totalKm} km` : '—'}
                            </TableCell>
                            <TableCell className={`text-right tabular-nums border-r border-border/50 ${allow.mileageAllow > 0 ? 'text-emerald-600' : 'text-muted-foreground/30'}`}>
                              {allow.mileageAllow > 0 ? fmt(allow.mileageAllow) : '—'}
                            </TableCell>
                            {/* Gross pay (displayGross = payroll Earnings when "Align" on + name match) */}
                            <TableCell
                              className="text-right tabular-nums font-bold text-sm"
                              title={alignGrossToPayroll && payrollForGross && modeledGross != null && Math.abs(r2(payrollForGross.earnings - modeledGross)) > 0.01 ? `Modeled (incl. add’l): ${fmt(modeledGross)}` : undefined}
                            >
                              {modeledGross !== null ? (
                                <span className={isCasual && !alignGrossToPayroll ? 'text-blue-700' : isCasual ? 'text-blue-800' : ''}>
                                  {fmt(displayGross ?? modeledGross)}
                                </span>
                              ) : (
                                <span className="text-muted-foreground font-normal text-xs">enter rate</span>
                              )}
                            </TableCell>
                            {/* Payroll comparison */}
                            {payrollData && (() => {
                              const match = payrollData.get(normName(row.staffName));
                              if (!match) return (
                                <TableCell colSpan={3} className="text-center text-xs text-muted-foreground/40 border-l border-border/50">no match</TableCell>
                              );
                              const payrollEarn = match.earnings;
                              const diff = modeledGross !== null ? r2(displayGross - payrollEarn) : null;
                              const pct  = modeledGross !== null && payrollEarn > 0 ? ((diff / payrollEarn) * 100).toFixed(1) : null;
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

                          <ShiftBreakdownExpandRow
                            expanded={!!expandedBreakdown[row.staffName]}
                            colSpan={summaryColSpan}
                            containerWidth={tableContainerWidth}
                          >
                            <PayBreakdownPanel
                              mrow={mrow}
                              staffName={row.staffName}
                              baseRate={rateVal}
                              empType={empT}
                              isCasual={isCasual}
                              staffRates={staffRates}
                            />
                            <PayHoursShiftsBreakdown
                              payHoursId={row._id}
                              expanded={!!expandedBreakdown[row.staffName]}
                              isManualOnly={isManualOnly}
                              mrow={mrow}
                              onShiftCtx={handleShiftCtx}
                            />
                          </ShiftBreakdownExpandRow>
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
                        <TableCell className="text-right text-amber-600">{totals.mealAllow > 0 ? fmt(r2(totals.mealAllow)) : '—'}</TableCell>
                        <TableCell className="text-right text-amber-800 border-r border-border/50">{(totals.additionalAllowanceSum || 0) > 0 ? fmt(r2(totals.additionalAllowanceSum)) : '—'}</TableCell>
                        <TableCell className="text-right text-emerald-700">{totals.totalKm > 0 ? `${totals.totalKm} km` : '—'}</TableCell>
                        <TableCell className="text-right text-emerald-600 border-r border-border/50">{totals.mileageAllow > 0 ? fmt(r2(totals.mileageAllow)) : '—'}</TableCell>
                        <TableCell className="text-right">
                          {totals.grossReady
                            ? fmt(r2(alignGrossToPayroll && payrollFooterStats ? payrollFooterStats.totalDisplayGross : totals.gross))
                            : <span className="text-muted-foreground font-normal text-xs">enter rates</span>}
                        </TableCell>
                        {payrollData && payrollFooterStats && (() => {
                          const { totalPayroll, totalDiff, matched } = payrollFooterStats;
                          const diffCls = totalDiff === null ? '' : totalDiff > 0.5 ? 'text-rose-600' : totalDiff < -0.5 ? 'text-amber-600' : 'text-emerald-600';
                          return (<>
                            <TableCell className="text-right text-emerald-700 border-l border-border/50">
                              {fmt(totalPayroll)}
                              <div className="text-[10px] font-normal text-muted-foreground">{matched}/{displayRows.length} matched</div>
                            </TableCell>
                            <TableCell className={`text-right ${diffCls}`}>
                              {totals.grossReady ? (totalDiff >= 0 ? '+' : '') + fmt(totalDiff) : '—'}
                            </TableCell>
                            <TableCell className={`text-right text-xs ${diffCls}`}>
                              {totals.grossReady && totalPayroll > 0 ? (totalDiff >= 0 ? '+' : '') + ((totalDiff / totalPayroll) * 100).toFixed(1) + '%' : '—'}
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
            <div className="-mt-2 space-y-2">
              {overrideResetNotice && (
                <div className="mx-auto max-w-3xl rounded border border-amber-300 bg-amber-50 px-3 py-2 text-xs text-amber-900">
                  <span>{overrideResetNotice}</span>
                  <button
                    onClick={() => setOverrideResetNotice('')}
                    className="ml-2 underline"
                  >
                    Dismiss
                  </button>
                </div>
              )}
              <p className="text-[11px] text-muted-foreground/70 text-center">
                Right-click any hour cell or the <strong>Add’l $</strong> allowance column to override (saved to server). Expand a staff row to edit per-shift buckets. Overridden cells are highlighted in blue.
                {Object.keys(overrides).length > 0 && (
                  <button
                    type="button"
                    onClick={async () => {
                      const adjusted = apiRows.filter(
                        (r) => r.isManuallyAdjusted || Object.keys(r.manualFields || {}).length > 0
                      );
                      try {
                        for (const row of adjusted) {
                          await clearPayHoursM.mutateAsync(row._id);
                        }
                        setOverrides({});
                        toast.success('Cleared all pay hours overrides');
                      } catch (e) {
                        toast.error(e?.response?.data?.error || 'Failed to clear overrides');
                      }
                    }}
                    className="ml-2 underline text-blue-600 hover:text-blue-800"
                  >
                    Clear all {Object.keys(overrides).length} overrides
                  </button>
                )}
              </p>
            </div>
          )}

          {/* Legend & Disclaimer */}
          <div className="grid gap-3 sm:grid-cols-2">
            <div className="bg-muted/20 border border-border rounded p-3 text-xs space-y-1.5">
              <p className="font-semibold text-[11px] uppercase tracking-wider">Pay Rate Multipliers</p>
              <div className="grid grid-cols-2 gap-x-4 gap-y-0.5 text-muted-foreground text-[11px]">
                <span>Weekday ordinary:</span><span className="font-medium text-foreground">1.0×</span>
                <span>Evening (after 8pm local):</span><span className="font-medium text-foreground">1.125×</span>
                <span>Night (before 6am):</span><span className="font-medium text-foreground">1.15×</span>
                <span>Saturday ordinary:</span><span className="font-medium text-foreground">1.5×</span>
                <span>Sunday:</span><span className="font-medium text-foreground">2.0×</span>
                <span>Public Holiday:</span><span className="font-medium text-foreground">2.5×</span>
                <span>WD/Sat OT — first 2h:</span><span className="font-medium text-foreground">1.5×</span>
                <span>WD/Sat OT — after 2h:</span><span className="font-medium text-foreground">2.0×</span>
                <span>Ordinary cap / shift (WD / Sat / Sun / PH):</span><span className="font-medium text-foreground">10h before OT</span>
                <span>Sun / PH OT:</span><span className="font-medium text-foreground">same as Sun/PH rate</span>
                <span>OT &gt; 76h — WD/Sat:</span><span className="font-medium text-foreground">1.5× first 2h total, then 2×</span>
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
                <li><strong>OT triggers:</strong> &gt;76h/fortnight; &gt;10h active hours/shift (daily OT) — same hour paid once, not double-counted</li>
                <li><strong>OT &gt; 76h rates:</strong> Weekday + Saturday share one 1.5× band (first 2h total), then 2×; Sun 2.0×; PH 2.5×</li>
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
          const staffRates = resolvedStaffRatesMap.get(normName(row.staffName)) ?? null;
          const gross   = calcGross(m, rate, empT);
          const otBrokenPay = calcOtAndBrokenPay(m, { staffRates, baseRate: rate, empType: empT });
          const ot76Monetary = calcOt76MonetaryPay(m, { staffRates, baseRate: rate, empType: empT });
          const minEng  = m.minimumEngagementExceptionCount || 0;
          const hasAny  = ot > 0 || broken > 0 || ot76tot > 0 || minEng > 0;
          return {
            row, m, ot, broken, sleep, ot76wd, ot76sat, ot76sun, ot76hol, ot76tot, allow, gross, hasAny, minEng,
            otBrokenPay, ot76Monetary,
          };
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
        const totMinEng    = r2(visible.reduce((s, r) => s + (r.minEng || 0), 0));
        const obPayRows = visible.filter((r) => r.ot > 0 || r.broken > 0);
        const totOtBroken$ = obPayRows.length && obPayRows.every((r) => r.otBrokenPay != null)
          ? r2(obPayRows.reduce((s, r) => s + r.otBrokenPay.total, 0))
          : null;
        const o76PayRows = visible.filter((r) => r.ot76tot > 0);
        const totOt76$ = o76PayRows.length && o76PayRows.every((r) => r.ot76Monetary != null)
          ? r2(o76PayRows.reduce((s, r) => s + r.ot76Monetary, 0))
          : null;

        return (
          <>
            {/* Summary cards */}
            <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-5 gap-3">
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
              <Card className="border-amber-300 lg:col-span-1 col-span-2">
                <CardContent className="pt-4">
                  <div className="text-2xl font-bold text-amber-900">{totMinEng}</div>
                  <p className="text-xs text-muted-foreground">Short PC shifts (&lt;2h)</p>
                  <p className="text-[11px] text-muted-foreground/70 mt-0.5">Minimum engagement — review / manual hours</p>
                </CardContent>
              </Card>
            </div>

            {visible.length === 0 ? (
              <Card>
                <CardContent className="py-10 text-center">
                  <p className="text-lg font-medium text-green-600">✓ No exceptions</p>
                  <p className="text-sm text-muted-foreground mt-1">No staff have overtime, OT&nbsp;&gt;&nbsp;76h, broken shifts, or short personal-care shifts this period.</p>
                </CardContent>
              </Card>
            ) : (
              <>
                {/* ── Minimum engagement (short PC) ── */}
                {totMinEng > 0 && (
                  <Card className="border-amber-300">
                    <CardHeader className="pb-2">
                      <CardTitle className="text-sm flex items-center gap-2">
                        <span className="text-amber-700">⚠</span> Minimum engagement — short personal care
                        <span className="text-xs font-normal text-muted-foreground">
                          ({visible.filter((r) => r.minEng > 0).length} staff · {totMinEng} shift{totMinEng === 1 ? '' : 's'})
                        </span>
                      </CardTitle>
                      <p className="text-[11px] text-muted-foreground mt-0.5">
                        Shifts under 2 hours are paid at actual hours in the calculator; flag them here for payroll review or manual adjustment.
                      </p>
                    </CardHeader>
                    <CardContent className="p-0">
                      <div className="overflow-x-auto">
                        <Table>
                          <TableHeader>
                            <TableRow className="bg-amber-50/60 text-[11px]">
                              <TableHead className="min-w-[180px]">Staff</TableHead>
                              <TableHead className="whitespace-nowrap">Pay period</TableHead>
                              <TableHead className="text-right whitespace-nowrap">Short PC shifts</TableHead>
                            </TableRow>
                          </TableHeader>
                          <TableBody>
                            {visible.filter((r) => r.minEng > 0).map(({ row, m, minEng }) => (
                              <React.Fragment key={row.staffName}>
                                <TableRow className="text-xs hover:bg-muted/30">
                                  <TableCell>
                                    <div className="flex items-center gap-1.5 min-w-0">
                                      <ExpandChevronButton
                                        expanded={!!expandedBreakdown[row.staffName]}
                                        onClick={() => toggleBreakdown(row.staffName)}
                                      />
                                      <span className="font-medium truncate">{row.staffName}</span>
                                    </div>
                                  </TableCell>
                                  <TableCell className="text-muted-foreground">{fmtPayPeriod(row)}</TableCell>
                                  <TableCell className="text-right font-medium text-amber-900">{minEng}</TableCell>
                                </TableRow>
                                <ShiftBreakdownExpandRow
                                  expanded={!!expandedBreakdown[row.staffName]}
                                  colSpan={3}
                                >
                                  <PayHoursShiftsBreakdown
                                    payHoursId={row._id}
                                    expanded={!!expandedBreakdown[row.staffName]}
                                    isManualOnly={row._manualOnly === true}
                                    mrow={m}
                                    onShiftCtx={handleShiftCtx}
                                  />
                                </ShiftBreakdownExpandRow>
                              </React.Fragment>
                            ))}
                          </TableBody>
                        </Table>
                      </div>
                    </CardContent>
                  </Card>
                )}

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
                            <TableHead className="min-w-[140px] whitespace-nowrap">Pay period</TableHead>
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
                            <TableHead className="text-right whitespace-nowrap">OT + broken pay<br/><span className="font-normal opacity-70 text-muted-foreground">excl. meal / km</span></TableHead>
                          </TableRow>
                        </TableHeader>
                        <TableBody>
                          {visible.filter(r => r.ot > 0 || r.broken > 0).map(({ row, m, ot, broken, allow, otBrokenPay }) => {
                            const d = (v, cls = '') => v > 0
                              ? <span className={`font-medium ${cls}`}>{fmtH(v)}</span>
                              : <span className="text-muted-foreground/30">—</span>;
                            return (
                              <React.Fragment key={row.staffName}>
                              <TableRow className="text-xs hover:bg-muted/30">
                                <TableCell>
                                  <div className="flex items-center gap-1.5 min-w-0">
                                    <ExpandChevronButton
                                      expanded={!!expandedBreakdown[row.staffName]}
                                      onClick={() => toggleBreakdown(row.staffName)}
                                    />
                                    <span className="font-medium truncate">{row.staffName}</span>
                                  </div>
                                </TableCell>
                                <TableCell className="text-muted-foreground text-[11px] whitespace-nowrap">{fmtPayPeriod(row)}</TableCell>
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
                                <TableCell className="text-right font-mono font-semibold">
                                  {otBrokenPay != null
                                    ? <span>{fmt(otBrokenPay.total)}</span>
                                    : <span className="text-muted-foreground/50 font-normal">—</span>}
                                </TableCell>
                              </TableRow>
                              <ShiftBreakdownExpandRow
                                expanded={!!expandedBreakdown[row.staffName]}
                                colSpan={13}
                              >
                                <PayHoursShiftsBreakdown
                                  payHoursId={row._id}
                                  expanded={!!expandedBreakdown[row.staffName]}
                                  isManualOnly={row._manualOnly === true}
                                  mrow={m}
                                  onShiftCtx={handleShiftCtx}
                                />
                              </ShiftBreakdownExpandRow>
                              </React.Fragment>
                            );
                          })}
                          {/* Totals */}
                          <TableRow className="border-t-2 font-bold text-xs bg-muted/20">
                            <TableCell>Totals</TableCell>
                            <TableCell className="text-muted-foreground font-normal">—</TableCell>
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
                            <TableCell className="text-right font-mono">{totOtBroken$ != null ? fmt(totOtBroken$) : '—'}</TableCell>
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
                        Hours that exceed the 76h fortnightly cap. Weekday &amp; Saturday share one 1.5× band (first 2h combined), then 2×. Sunday: 2.0×. Public Holiday: 2.5×. Same hour is not double-counted with daily OT.
                      </p>
                    </CardHeader>
                    <CardContent className="p-0">
                      <div className="overflow-x-auto">
                        <Table>
                          <TableHeader>
                            <TableRow className="bg-rose-50/60 text-[11px]">
                              <TableHead className="min-w-[160px]">Staff</TableHead>
                              <TableHead className="min-w-[140px] whitespace-nowrap">Pay period</TableHead>
                              <TableHead className="text-right text-rose-700 whitespace-nowrap">Total OT&gt;76<br/><span className="font-normal opacity-70">all days</span></TableHead>
                              <TableHead className="text-right text-rose-700 whitespace-nowrap">Weekday<br/><span className="font-normal opacity-70">global 1.5×/2×</span></TableHead>
                              <TableHead className="text-right text-rose-600 whitespace-nowrap">Saturday<br/><span className="font-normal opacity-70">2× after WD tier</span></TableHead>
                              <TableHead className="text-right text-rose-500 whitespace-nowrap">Sunday<br/><span className="font-normal opacity-70">2.0× flat</span></TableHead>
                              <TableHead className="text-right text-rose-800 whitespace-nowrap">Holiday<br/><span className="font-normal opacity-70">2.5× flat</span></TableHead>
                              <TableHead className="text-right whitespace-nowrap">WD tier 1<br/><span className="font-normal opacity-70 text-muted-foreground">≤2h @ 1.5×</span></TableHead>
                              <TableHead className="text-right whitespace-nowrap">WD tier 2<br/><span className="font-normal opacity-70 text-muted-foreground">&gt;2h @ 2×</span></TableHead>
                              <TableHead className="text-right whitespace-nowrap">Sat tier 1<br/><span className="font-normal opacity-70 text-muted-foreground">≤2h @ 1.5×</span></TableHead>
                              <TableHead className="text-right whitespace-nowrap">Sat tier 2<br/><span className="font-normal opacity-70 text-muted-foreground">&gt;2h @ 2×</span></TableHead>
                              <TableHead className="text-right whitespace-nowrap">OT&gt;76 pay</TableHead>
                            </TableRow>
                          </TableHeader>
                          <TableBody>
                            {visible.filter(r => r.ot76tot > 0).map(({ row, m, ot76wd, ot76sat, ot76sun, ot76hol, ot76tot, ot76Monetary }) => {
                              const wdT1 = r2(Math.min(ot76wd, 2));
                              const wdT2 = r2(Math.max(0, ot76wd - 2));
                              const sT1  = r2(Math.min(ot76sat, 2));
                              const sT2  = r2(Math.max(0, ot76sat - 2));
                              const cell = (v, cls = 'text-rose-700') => v > 0
                                ? <span className={`font-medium ${cls}`}>{fmtH(v)}</span>
                                : <span className="text-muted-foreground/30">—</span>;
                              return (
                                <React.Fragment key={row.staffName}>
                                <TableRow className="text-xs hover:bg-rose-50/30">
                                  <TableCell>
                                    <div className="flex items-center gap-1.5 min-w-0">
                                      <ExpandChevronButton
                                        expanded={!!expandedBreakdown[row.staffName]}
                                        onClick={() => toggleBreakdown(row.staffName)}
                                      />
                                      <span className="font-medium truncate">{row.staffName}</span>
                                    </div>
                                  </TableCell>
                                  <TableCell className="text-muted-foreground text-[11px] whitespace-nowrap">{fmtPayPeriod(row)}</TableCell>
                                  <TableCell className="text-right">{cell(ot76tot)}</TableCell>
                                  <TableCell className="text-right">{cell(ot76wd)}</TableCell>
                                  <TableCell className="text-right">{cell(ot76sat, 'text-rose-600')}</TableCell>
                                  <TableCell className="text-right">{cell(ot76sun, 'text-rose-500')}</TableCell>
                                  <TableCell className="text-right">{cell(ot76hol, 'text-rose-800')}</TableCell>
                                  <TableCell className="text-right text-muted-foreground">{cell(wdT1, 'text-orange-500')}</TableCell>
                                  <TableCell className="text-right text-muted-foreground">{cell(wdT2, 'text-orange-700')}</TableCell>
                                  <TableCell className="text-right text-muted-foreground">{cell(sT1,  'text-cyan-500')}</TableCell>
                                  <TableCell className="text-right text-muted-foreground">{cell(sT2,  'text-cyan-700')}</TableCell>
                                  <TableCell className="text-right font-mono font-semibold">
                                    {ot76Monetary != null
                                      ? <span>{fmt(ot76Monetary)}</span>
                                      : <span className="text-muted-foreground/50 font-normal">—</span>}
                                  </TableCell>
                                </TableRow>
                                <ShiftBreakdownExpandRow
                                  expanded={!!expandedBreakdown[row.staffName]}
                                  colSpan={12}
                                >
                                  <PayHoursShiftsBreakdown
                                    payHoursId={row._id}
                                    expanded={!!expandedBreakdown[row.staffName]}
                                    isManualOnly={row._manualOnly === true}
                                    mrow={m}
                                    onShiftCtx={handleShiftCtx}
                                  />
                                </ShiftBreakdownExpandRow>
                                </React.Fragment>
                              );
                            })}
                            {/* Totals */}
                            <TableRow className="border-t-2 font-bold text-xs bg-rose-50/20">
                              <TableCell>Totals</TableCell>
                              <TableCell className="text-muted-foreground font-normal">—</TableCell>
                              <TableCell className="text-right text-rose-700">{fmtH(totOt76)}</TableCell>
                              <TableCell className="text-right">{totOt76wd  > 0 ? fmtH(totOt76wd)  : '—'}</TableCell>
                              <TableCell className="text-right">{totOt76sat > 0 ? fmtH(totOt76sat) : '—'}</TableCell>
                              <TableCell className="text-right">{totOt76sun > 0 ? fmtH(totOt76sun) : '—'}</TableCell>
                              <TableCell className="text-right">{totOt76hol > 0 ? fmtH(totOt76hol) : '—'}</TableCell>
                              <TableCell className="text-right">{fmtH(r2(visible.reduce((s,r)=>s+Math.min(r.ot76wd,2),0)))}</TableCell>
                              <TableCell className="text-right">{fmtH(r2(visible.reduce((s,r)=>s+Math.max(0,r.ot76wd-2),0)))}</TableCell>
                              <TableCell className="text-right">{fmtH(r2(visible.reduce((s,r)=>s+Math.min(r.ot76sat,2),0)))}</TableCell>
                              <TableCell className="text-right">{fmtH(r2(visible.reduce((s,r)=>s+Math.max(0,r.ot76sat-2),0)))}</TableCell>
                              <TableCell className="text-right font-mono">{totOt76$ != null ? fmt(totOt76$) : '—'}</TableCell>
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
                          {visible.map(({ row, m, broken, allow, gross }) => (
                            <React.Fragment key={row.staffName}>
                            <TableRow className="text-xs hover:bg-amber-50/20">
                              <TableCell>
                                <div className="flex items-center gap-1.5 min-w-0">
                                  <ExpandChevronButton
                                    expanded={!!expandedBreakdown[row.staffName]}
                                    onClick={() => toggleBreakdown(row.staffName)}
                                  />
                                  <span className="font-medium truncate">{row.staffName}</span>
                                </div>
                              </TableCell>
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
                            <ShiftBreakdownExpandRow
                              expanded={!!expandedBreakdown[row.staffName]}
                              colSpan={6}
                            >
                              <PayHoursShiftsBreakdown
                                payHoursId={row._id}
                                expanded={!!expandedBreakdown[row.staffName]}
                                isManualOnly={row._manualOnly === true}
                                mrow={m}
                                onShiftCtx={handleShiftCtx}
                              />
                            </ShiftBreakdownExpandRow>
                            </React.Fragment>
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
                    <li><strong>Daily WD/Sat OT rate:</strong> 1.5× for the first 2h of daily OT per day, 2× beyond</li>
                    <li><strong>OT &gt;76h WD/Sat:</strong> one shared 1.5× band (first 2h total; weekday first), then 2×</li>
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

      {/* ── STAFF RATES (SCHADS workbook) ───────────────────────── */}
      {view === 'rates' && (
        <div className="space-y-4">
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-base">Staff SCHADS rates</CardTitle>
              <p className="text-xs text-muted-foreground font-normal leading-relaxed">
                Per-staff $/h columns match the award rates workbook. Values merge with pay hours for gross pay in{' '}
                <strong>Staff Pay Summary</strong> and flow to Workforce step 5 when you use the calculator there. Changes save automatically in this browser (same store as the summary tab).
              </p>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="flex flex-wrap items-center gap-2">
                <input
                  ref={ratesFileRef}
                  type="file"
                  accept=".xlsx,.xls"
                  className="hidden"
                  onChange={(e) => {
                    if (e.target.files[0]) parseRatesFile(e.target.files[0]);
                    e.target.value = '';
                  }}
                />
                <Button type="button" size="sm" variant="outline" className="gap-1" onClick={() => ratesFileRef.current?.click()}>
                  <FileSpreadsheet className="h-4 w-4 text-blue-600" />
                  {ratesFileName ? 'Replace rates workbook' : 'Upload rates workbook'}
                </Button>
                {ratesFileName && (
                  <span className="text-xs text-muted-foreground max-w-[200px] truncate" title={ratesFileName}>
                    {ratesFileName}
                  </span>
                )}
                {ratesFileName && (
                  <Button
                    type="button"
                    size="sm"
                    variant="ghost"
                    className="text-xs text-destructive h-8"
                    onClick={() => {
                      setRatesFileName(null);
                      setStaffRatesMap(null);
                      onStaffRatesMapChange?.(null, null);
                    }}
                  >
                    Clear file &amp; map
                  </Button>
                )}
              </div>
              <div className="flex flex-wrap items-end gap-2 border-t border-border pt-4">
                <div className="space-y-1">
                  <label className="text-xs uppercase tracking-wider text-muted-foreground">Add staff + flat SCHADS row</label>
                  <div className="flex flex-wrap gap-2">
                    <Input
                      placeholder="Name"
                      value={ratesAddName}
                      onChange={(e) => setRatesAddName(e.target.value)}
                      onKeyDown={(e) => e.key === 'Enter' && addStaffRatesEntry()}
                      className="h-9 w-44 text-sm"
                    />
                    <Input
                      type="number"
                      step="0.01"
                      min="0"
                      placeholder={`Base $/h${defaultRate ? ` (${defaultRate})` : ''}`}
                      value={ratesAddBase}
                      onChange={(e) => setRatesAddBase(e.target.value)}
                      className="h-9 w-32 text-sm"
                    />
                    <Button type="button" size="sm" variant="secondary" className="gap-1" onClick={addStaffRatesEntry}>
                      <Plus className="h-4 w-4" />
                      Add
                    </Button>
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>

          {staffRatesTabRowKeys.length === 0 ? (
            <Card>
              <CardContent className="py-10 text-center text-muted-foreground text-sm">
                No staff yet. Add a name above, use <strong>Add staff (manual row)</strong> at the top, or load pay hours from the API.
              </CardContent>
            </Card>
          ) : (
            <Card>
              <CardContent className="p-0">
                <div className="overflow-x-auto">
                  <Table>
                    <TableHeader>
                      <TableRow className="bg-muted/50 text-[10px]">
                        <TableHead className="sticky left-0 bg-muted/50 z-10 min-w-[140px] border-r">Staff</TableHead>
                        <TableHead className="text-center whitespace-nowrap min-w-[88px] border-r" title="Apply one $/h to all hourly columns">
                          Flat base
                        </TableHead>
                        {STAFF_RATES_TABLE_FIELDS.map(([id, label]) => (
                          <TableHead key={id} className="text-right whitespace-nowrap min-w-[72px] text-[10px]">
                            {label}
                          </TableHead>
                        ))}
                        <TableHead className="w-12 text-center"> </TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {staffRatesTabRowKeys.map((key) => {
                        const row = resolvedStaffRatesMap.get(key);
                        const label = displayNameForRateKey(key);
                        return (
                          <TableRow
                            key={key}
                            className="text-xs cursor-context-menu"
                            onContextMenu={(e) => handleRatesCtx(e, key, row)}
                            title="Right-click to edit all rates for this staff"
                          >
                            <TableCell className="sticky left-0 bg-background z-10 font-medium border-r">{label}</TableCell>
                            <TableCell className="border-r">
                              <Input
                                type="number"
                                step="0.01"
                                min="0"
                                className="h-8 w-20 text-xs"
                                placeholder="—"
                                title="Auto-fill SCHADS casual rates from base"
                                onKeyDown={(e) => {
                                  if (e.key !== 'Enter') return;
                                  applyFlatBaseToStaffKey(key, e.currentTarget.value);
                                }}
                                onBlur={(e) => {
                                  if (e.target.value === '') return;
                                  applyFlatBaseToStaffKey(key, e.target.value);
                                }}
                              />
                            </TableCell>
                            {STAFF_RATES_TABLE_FIELDS.map(([field]) => (
                              <TableCell key={field} className="p-1">
                                <Input
                                  type="number"
                                  step="0.01"
                                  min="0"
                                  className="h-8 w-[68px] text-xs px-1"
                                  value={
                                    row
                                      ? field === 'allowance'
                                        ? row[field] ? row[field] : ''
                                        : row[field] ?? ''
                                      : ''
                                  }
                                  placeholder={row ? '' : '—'}
                                  onChange={(e) => patchStaffRatesField(key, field, e.target.value)}
                                />
                              </TableCell>
                            ))}
                            <TableCell className="text-center p-1">
                              <Button
                                type="button"
                                size="sm"
                                variant="ghost"
                                className="h-8 w-8 p-0 text-destructive"
                                title="Remove custom rates for this staff"
                                onClick={() => removeStaffRatesRow(key)}
                              >
                                <Trash2 className="h-4 w-4" />
                              </Button>
                            </TableCell>
                          </TableRow>
                        );
                      })}
                    </TableBody>
                  </Table>
                </div>
                <p className="text-[10px] text-muted-foreground px-4 py-2 border-t">
                  Empty cells until you type: row is created from default base rate or zero. <strong>Flat base</strong> + Enter applies one rate to Day through PH; edit columns for fine control. Trash removes only the custom rate row (summary then uses default base rate).
                </p>
              </CardContent>
            </Card>
          )}
        </div>
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
