import React, { useState, useMemo, useCallback } from 'react';
import * as XLSX from 'xlsx';
import { usePayHours } from '../api/payHours';
import { buildAwardCostMapFromPayHours, r2 as r2Schads, VEHICLE_RATE } from '../lib/schadsWageCalc';
import { useDropzone } from 'react-dropzone';
import {
  Upload, TrendingDown, DollarSign, Clock, Users, AlertTriangle,
  ChevronDown, ChevronUp, Info, BarChart2, Calendar, UserX,
  FileSpreadsheet, TrendingUp,
} from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '../ui/card';
import { Button } from '../ui/button';
import { Input } from '../ui/input';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '../ui/table';

// ─── Helpers ──────────────────────────────────────────────────────────────────
const r2 = (n) => Math.round(n * 100) / 100;
const fmt = (n) => '$' + n.toFixed(2).replace(/\B(?=(\d{3})+(?!\d))/g, ',');
const fmtK = (n) => n >= 1000 ? '$' + (n / 1000).toFixed(1) + 'k' : fmt(n);
const pct = (part, total) => total > 0 ? ((part / total) * 100).toFixed(1) + '%' : '0%';
const normName = (n) => n?.toLowerCase().replace(/\s+/g, ' ').trim() ?? '';

// ─── Payroll file parser (ShiftCare Payroll Employee Summary XLSX) ────────────
function parsePayrollXlsx(arrayBuffer) {
  const wb = XLSX.read(arrayBuffer, { type: 'array' });
  const ws = wb.Sheets[wb.SheetNames[0]];
  const rows = XLSX.utils.sheet_to_json(ws, { header: 1, defval: '' });

  // Find header row — looks for a row containing 'Employee' and 'Earnings'
  let headerIdx = -1;
  for (let i = 0; i < rows.length; i++) {
    const lower = rows[i].map(c => c?.toString().toLowerCase());
    if (lower.includes('employee') && lower.includes('earnings')) { headerIdx = i; break; }
  }
  if (headerIdx === -1) throw new Error('Could not find Employee/Earnings header row in payroll file');

  const headers = rows[headerIdx].map(c => c?.toString().toLowerCase().trim());
  const empIdx    = headers.indexOf('employee');
  const earnIdx   = headers.indexOf('earnings');
  const superIdx  = headers.findIndex(h => h.includes('super'));
  const taxIdx    = headers.indexOf('tax');
  const netIdx    = headers.findIndex(h => h.includes('net'));

  const map = new Map();
  for (let i = headerIdx + 1; i < rows.length; i++) {
    const name = rows[i][empIdx]?.toString().trim();
    const earnings = parseFloat(rows[i][earnIdx]);
    if (!name || isNaN(earnings) || earnings <= 0) continue;
    const nl = name.toLowerCase();
    if (nl === 'total' || nl === 'totals' || nl === 'subtotal' || nl === 'summary') continue;
    const superAmt = superIdx >= 0 ? (parseFloat(rows[i][superIdx]) || 0) : 0;
    const tax      = taxIdx   >= 0 ? (parseFloat(rows[i][taxIdx])   || 0) : 0;
    const net      = netIdx   >= 0 ? (parseFloat(rows[i][netIdx])   || 0) : 0;
    map.set(normName(name), { name, earnings, superAmt, tax, net, totalCost: r2(earnings + superAmt) });
  }
  return map;
}

function parseAwardRatesXlsx(arrayBuffer) {
  const wb = XLSX.read(arrayBuffer, { type: 'array' });
  const ws = wb.Sheets[wb.SheetNames[0]];
  const rows = XLSX.utils.sheet_to_json(ws, { header: 1, defval: '' });
  let headerIdx = -1;
  for (let i = 0; i < rows.length; i++) {
    const r = rows[i].map(c => c?.toString().toLowerCase().trim());
    if (r.some(h => h === 'employee name') && r.some(h => h.includes('daytime'))) {
      headerIdx = i;
      break;
    }
  }
  if (headerIdx === -1) throw new Error('Could not find Employee Name / Daytime Shift columns in rates file');
  const h = rows[headerIdx].map(c => c?.toString().toLowerCase().trim());
  const ci = (keyword) => h.findIndex(x => x.includes(keyword));
  const idx = {
    emp: h.findIndex(x => x === 'employee name'),
    daytime: ci('daytime'),
    afternoon: ci('afternoon'),
    night: ci('night'),
    otUpto2: h.findIndex(x => x === 'ot upto 2 hours'),
    otAfter2: h.findIndex(x => x === 'ot after 2 hours'),
    saturday: h.findIndex(x => x === 'saturday'),
    satOtAfter2: ci('saturday ot after'),
    sunday: h.findIndex(x => x === 'sunday'),
    ph: h.findIndex(x => x === 'public holiday'),
    mealAllow: ci('overtime meal'),
    brokenShift: h.findIndex(x => x === 'broken shift'),
    sleepover: ci('sleepover'),
    kmRate: ci('mileage'),
  };
  const map = new Map();
  for (let i = headerIdx + 1; i < rows.length; i++) {
    const name = rows[i][idx.emp]?.toString().trim();
    if (!name) continue;
    const g = (k) => {
      const v = parseFloat(rows[i][idx[k]]);
      return isNaN(v) ? 0 : r2Schads(v);
    };
    map.set(normName(name), {
      name,
      daytime: g('daytime'),
      afternoon: g('afternoon'),
      night: g('night'),
      otUpto2: g('otUpto2'),
      otAfter2: g('otAfter2'),
      saturday: g('saturday'),
      satOtAfter2: g('satOtAfter2'),
      sunday: g('sunday'),
      ph: g('ph'),
      mealAllow: g('mealAllow'),
      brokenShift: g('brokenShift'),
      sleepover: g('sleepover'),
      kmRate: g('kmRate') || VEHICLE_RATE,
    });
  }
  return map;
}

// ─── Staff profitability analysis ─────────────────────────────────────────────
function analyzeStaffProfitability(rows, payrollMap) {
  // Aggregate revenue, hours, and raw billing rows per staff
  const byStaff = {};
  for (const r of rows) {
    const staff = r.staff?.trim();
    if (!staff) continue;
    const key = normName(staff);
    if (!byStaff[key]) byStaff[key] = { name: staff, revenue: 0, hours: 0, clients: new Set(), shifts: new Set(), billingRows: [] };
    byStaff[key].revenue = r2(byStaff[key].revenue + r.totalCost);
    byStaff[key].hours   = r2(byStaff[key].hours + r.duration);
    byStaff[key].clients.add(r.client);
    byStaff[key].shifts.add(r.shiftId);
    byStaff[key].billingRows.push(r);
  }

  const staffRows = [];
  let matchedCount = 0;
  // Only sum matched staff for the overall margin (apples-to-apples)
  let matchedRevenue = 0, matchedWages = 0, matchedSuper = 0;
  const totalRevenue = r2(Object.values(byStaff).reduce((s, d) => s + d.revenue, 0));
  const byClient = {};

  for (const r of rows) {
    if (!r.client) continue;
    if (!byClient[r.client]) byClient[r.client] = {
      name: r.client,
      revenue: 0,
      hours: 0,
      shifts: new Set(),
      staff: new Set(),
      billingRows: [],
      staffAlloc: {},
      matchedRevenue: 0,
      allocWages: 0,
      allocSuper: 0,
      allocEmployerCost: 0,
    };
    byClient[r.client].revenue = r2(byClient[r.client].revenue + r.totalCost);
    byClient[r.client].hours   = r2(byClient[r.client].hours + r.duration);
    byClient[r.client].shifts.add(r.shiftId);
    if (r.staff) byClient[r.client].staff.add(r.staff);
    byClient[r.client].billingRows.push(r);
  }

  for (const [key, d] of Object.entries(byStaff)) {
    const payroll  = payrollMap.get(key);
    const wages    = payroll?.earnings ?? null;
    const superAmt = payroll?.superAmt ?? null;
    const employerCost = wages !== null ? r2(wages + (superAmt || 0)) : null;
    const margin       = employerCost !== null ? r2(d.revenue - employerCost) : null;
    const marginPct    = (margin !== null && d.revenue > 0) ? r2((margin / d.revenue) * 100) : null;
    const revenuePerHour = d.hours > 0 ? r2(d.revenue / d.hours) : 0;
    const costPerHour    = (employerCost !== null && d.hours > 0) ? r2(employerCost / d.hours) : null;

    if (payroll) {
      matchedCount++;
      matchedRevenue += d.revenue;
      matchedWages   += wages;
      matchedSuper   += superAmt || 0;

      // Allocate this staff member's payroll cost to clients by hours worked for each client.
      const totalStaffHours = d.hours || 0;
      if (totalStaffHours > 0) {
        for (const br of d.billingRows) {
          if (!br.client || !byClient[br.client]) continue;
          const share = (br.duration || 0) / totalStaffHours;
          const wageShare = r2(wages * share);
          const superShare = r2((superAmt || 0) * share);
          const employerShare = r2((wages + (superAmt || 0)) * share);

          byClient[br.client].matchedRevenue = r2(byClient[br.client].matchedRevenue + br.totalCost);
          byClient[br.client].allocWages = r2(byClient[br.client].allocWages + wageShare);
          byClient[br.client].allocSuper = r2(byClient[br.client].allocSuper + superShare);
          byClient[br.client].allocEmployerCost = r2(byClient[br.client].allocEmployerCost + employerShare);
          const staffKey = key;
          if (!byClient[br.client].staffAlloc[staffKey]) {
            byClient[br.client].staffAlloc[staffKey] = {
              staffName: d.name,
              hours: 0,
              revenue: 0,
              wages: 0,
              superAmt: 0,
              employerCost: 0,
            };
          }
          byClient[br.client].staffAlloc[staffKey].hours = r2(byClient[br.client].staffAlloc[staffKey].hours + (br.duration || 0));
          byClient[br.client].staffAlloc[staffKey].revenue = r2(byClient[br.client].staffAlloc[staffKey].revenue + br.totalCost);
          byClient[br.client].staffAlloc[staffKey].wages = r2(byClient[br.client].staffAlloc[staffKey].wages + wageShare);
          byClient[br.client].staffAlloc[staffKey].superAmt = r2(byClient[br.client].staffAlloc[staffKey].superAmt + superShare);
          byClient[br.client].staffAlloc[staffKey].employerCost = r2(byClient[br.client].staffAlloc[staffKey].employerCost + employerShare);
        }
      }
    }

    // Sort billing rows by date then start time
    const billingRows = d.billingRows.slice().sort((a, b) => {
      const da = new Date(a.startDt), db = new Date(b.startDt);
      return da - db;
    });

    staffRows.push({
      name: d.name, revenue: d.revenue, hours: d.hours,
      wages, superAmt, employerCost, margin, marginPct,
      revenuePerHour, costPerHour,
      clients: d.clients.size, shifts: d.shifts.size,
      billingRows,
    });
  }

  // Staff in payroll but no shifts in this billing file
  const billedKeys = new Set(Object.keys(byStaff));
  const paidNotBilled = [];
  for (const [key, p] of payrollMap.entries()) {
    if (!billedKeys.has(key)) {
      paidNotBilled.push({ name: p.name, wages: p.earnings, superAmt: p.superAmt, employerCost: p.totalCost });
    }
  }

  staffRows.sort((a, b) => b.revenue - a.revenue);

  // Matched totals only — valid cross-comparison
  const matchedEmployerCost = r2(matchedWages + matchedSuper);
  const matchedMargin       = r2(matchedRevenue - matchedEmployerCost);
  const matchedMarginPct    = matchedRevenue > 0 ? r2((matchedMargin / matchedRevenue) * 100) : 0;
  const clientRows = Object.values(byClient)
    .map((c) => {
      const margin = r2(c.revenue - c.allocEmployerCost);
      const marginPct = c.revenue > 0 ? r2((margin / c.revenue) * 100) : 0;
      const payrollCoveragePct = c.revenue > 0 ? r2((c.matchedRevenue / c.revenue) * 100) : 0;
      return {
        name: c.name,
        revenue: c.revenue,
        hours: c.hours,
        shifts: c.shifts.size,
        staffCount: c.staff.size,
        billingRows: c.billingRows,
        staffAllocRows: Object.values(c.staffAlloc).sort((a, b) => b.employerCost - a.employerCost),
        matchedRevenue: c.matchedRevenue,
        allocWages: c.allocWages,
        allocSuper: c.allocSuper,
        allocEmployerCost: c.allocEmployerCost,
        margin,
        marginPct,
        payrollCoveragePct,
        revPerHour: c.hours > 0 ? r2(c.revenue / c.hours) : 0,
        costPerHour: c.hours > 0 ? r2(c.allocEmployerCost / c.hours) : 0,
      };
    })
    .sort((a, b) => b.revenue - a.revenue);

  return {
    staffRows,
    clientRows,
    paidNotBilled,
    matchedCount,
    totalRevenue,
    // Matched comparisons
    matchedRevenue:      r2(matchedRevenue),
    matchedWages:        r2(matchedWages),
    matchedSuper:        r2(matchedSuper),
    matchedEmployerCost,
    matchedMargin,
    matchedMarginPct,
    // Total payroll (all staff in payroll file)
    totalPayrollWages:   r2([...payrollMap.values()].reduce((s, p) => s + p.earnings, 0)),
    totalPayrollSuper:   r2([...payrollMap.values()].reduce((s, p) => s + p.superAmt, 0)),
  };
}

function parseDateDOW(dateStr) {
  if (!dateStr) return null;
  const [m, d, y] = dateStr.split('/').map(Number);
  return new Date(y, m - 1, d).getDay(); // 0=Sun, 6=Sat
}

function parseHour(dtStr) {
  if (!dtStr) return null;
  // Format: MM/DD/YYYY HH:MM AM/PM  or  MM/DD/YYYY HH:MM
  const parts = dtStr.trim().split(' ');
  if (parts.length < 2) return null;
  const [h, m] = parts[1].split(':').map(Number);
  const isPM = parts[2]?.toLowerCase() === 'pm';
  let hour = h;
  if (isPM && h !== 12) hour += 12;
  if (!isPM && h === 12) hour = 0;
  return hour;
}

function parseCsv(text) {
  const lines = text.trim().split('\n');
  if (lines.length < 2) return [];
  const headers = lines[0].split(',').map(h => h.trim().replace(/^"|"$/g, ''));
  const idx = {};
  headers.forEach((h, i) => { idx[h] = i; });

  const rows = [];
  for (let i = 1; i < lines.length; i++) {
    const parts = lines[i].split(',');
    if (parts.length < 10) continue;
    const get = (key) => {
      const v = parts[idx[key]];
      return v !== undefined ? v.trim().replace(/^"|"$/g, '') : '';
    };
    rows.push({
      client:     get('Client Name'),
      date:       get('Date'),
      shiftId:    get('Shift ID'),
      staff:      get('Staff'),
      startDt:    get('Start Date Time'),
      endDt:      get('End Date Time'),
      duration:   parseFloat(get('Duration')) || 0,
      cost:       parseFloat(get('Cost')) || 0,
      additionalCost: parseFloat(get('Additional Cost')) || 0,
      kms:        parseFloat(get('Kms')) || 0,
      totalCost:  parseFloat(get('Total Cost')) || 0,
      absent:     get('Absent') === 'true',
      status:     get('Status'),
      rateGroup:  get('Rate Groups'),
      shiftType:  get('Shift Type'),
      clientType: get('Client Type'),
    });
  }
  return rows.filter(r => r.client && r.duration > 0);
}

function sharedShiftKey(row) {
  return `${normName(row.staff)}|${row.shiftId || ''}|${row.startDt || ''}|${row.endDt || ''}`;
}

function analyzeRows(rows) {
  const totalCost  = r2(rows.reduce((s, r) => s + r.totalCost, 0));
  const totalHours = r2(rows.reduce((s, r) => s + r.duration, 0));
  const avgRate    = totalHours > 0 ? r2(totalCost / totalHours) : 0;

  // ── Day type breakdown ──
  const dayBuckets = { weekday: { h: 0, cost: 0, n: 0 }, saturday: { h: 0, cost: 0, n: 0 }, sunday: { h: 0, cost: 0, n: 0 } };
  for (const r of rows) {
    const dow = parseDateDOW(r.date);
    if (dow === null) continue;
    const type = dow === 0 ? 'sunday' : dow === 6 ? 'saturday' : 'weekday';
    dayBuckets[type].h    = r2(dayBuckets[type].h + r.duration);
    dayBuckets[type].cost = r2(dayBuckets[type].cost + r.totalCost);
    dayBuckets[type].n++;
  }
  const weekdayRate  = dayBuckets.weekday.h  > 0 ? r2(dayBuckets.weekday.cost  / dayBuckets.weekday.h)  : 0;
  const weekendHours = r2(dayBuckets.saturday.h + dayBuckets.sunday.h);
  const weekendCost  = r2(dayBuckets.saturday.cost + dayBuckets.sunday.cost);
  const weekendAvgRate = weekendHours > 0 ? r2(weekendCost / weekendHours) : 0;
  const weekendPremium = r2((weekendAvgRate - weekdayRate) * weekendHours);

  // ── Time of day breakdown ──
  const timeBuckets = { am: { h: 0, cost: 0 }, pm: { h: 0, cost: 0 }, night: { h: 0, cost: 0 }, sleepover: { h: 0, cost: 0 }, other: { h: 0, cost: 0 } };
  for (const r of rows) {
    const rg = (r.rateGroup || '').toLowerCase();
    const bucket = rg.includes('sleepover') ? 'sleepover'
      : rg.includes(' am') || rg.includes('_am') ? 'am'
      : rg.includes(' pm') || rg.includes('_pm') ? 'pm'
      : rg.includes('night') ? 'night'
      : 'other';
    timeBuckets[bucket].h    = r2(timeBuckets[bucket].h + r.duration);
    timeBuckets[bucket].cost = r2(timeBuckets[bucket].cost + r.totalCost);
  }

  // ── High Intensity ──
  let hiCost = 0, hiH = 0, stdCost = 0, stdH = 0;
  for (const r of rows) {
    const rg = (r.rateGroup || '').toLowerCase();
    if (rg.includes('high intensity')) { hiCost = r2(hiCost + r.totalCost); hiH = r2(hiH + r.duration); }
    else { stdCost = r2(stdCost + r.totalCost); stdH = r2(stdH + r.duration); }
  }
  const hiRate  = hiH  > 0 ? r2(hiCost  / hiH)  : 0;
  const stdRate = stdH > 0 ? r2(stdCost / stdH) : 0;

  // ── Short shifts (≤2h) ──
  const shortShifts = rows.filter(r => r.duration <= 2);
  const shortCost  = r2(shortShifts.reduce((s, r) => s + r.totalCost, 0));
  const shortHours = r2(shortShifts.reduce((s, r) => s + r.duration, 0));
  const longShifts = rows.filter(r => r.duration >= 4);
  const longRate   = longShifts.length > 0 ? r2(longShifts.reduce((s, r) => s + r.totalCost, 0) / longShifts.reduce((s, r) => s + r.duration, 0)) : 0;
  const shortRate  = shortHours > 0 ? r2(shortCost / shortHours) : 0;
  const shortPremium = r2((shortRate - longRate) * shortHours);

  // ── Pending / unfilled ──
  const pending = rows.filter(r => r.status === 'pending');
  const pendingCost  = r2(pending.reduce((s, r) => s + r.totalCost, 0));
  const pendingHours = r2(pending.reduce((s, r) => s + r.duration, 0));

  // ── Client breakdown ──
  const byClient = {};
  for (const r of rows) {
    if (!byClient[r.client]) byClient[r.client] = { cost: 0, h: 0, staff: new Set(), shifts: new Set(), n: 0, weekendH: 0, weekendCost: 0 };
    byClient[r.client].cost = r2(byClient[r.client].cost + r.totalCost);
    byClient[r.client].h    = r2(byClient[r.client].h + r.duration);
    byClient[r.client].staff.add(r.staff);
    byClient[r.client].shifts.add(r.shiftId);
    byClient[r.client].n++;
    const dow = parseDateDOW(r.date);
    if (dow === 0 || dow === 6) {
      byClient[r.client].weekendH    = r2(byClient[r.client].weekendH + r.duration);
      byClient[r.client].weekendCost = r2(byClient[r.client].weekendCost + r.totalCost);
    }
  }
  const clientRows = Object.entries(byClient)
    .map(([name, d]) => ({
      name,
      cost:         d.cost,
      hours:        d.h,
      avgRate:      d.h > 0 ? r2(d.cost / d.h) : 0,
      staffCount:   d.staff.size,
      shiftCount:   d.shifts.size,
      weekendH:     d.weekendH,
      weekendCost:  d.weekendCost,
      weekendPct:   d.h > 0 ? r2((d.weekendH / d.h) * 100) : 0,
    }))
    .sort((a, b) => b.cost - a.cost);

  // ── Rate group breakdown ──
  const byRateGroup = {};
  for (const r of rows) {
    const rg = r.rateGroup || 'Unknown';
    if (!byRateGroup[rg]) byRateGroup[rg] = { cost: 0, h: 0, n: 0 };
    byRateGroup[rg].cost = r2(byRateGroup[rg].cost + r.totalCost);
    byRateGroup[rg].h    = r2(byRateGroup[rg].h + r.duration);
    byRateGroup[rg].n++;
  }
  const rateGroupRows = Object.entries(byRateGroup)
    .map(([name, d]) => ({ name, cost: d.cost, hours: d.h, count: d.n, rate: d.h > 0 ? r2(d.cost / d.h) : 0 }))
    .sort((a, b) => b.cost - a.cost);

  // ── Staff fragmentation: clients with many workers ──
  const highFragClients = clientRows.filter(c => c.staffCount >= 5).sort((a, b) => b.staffCount - a.staffCount);

  // ── Optimisation: if weekend was at weekday rate ──
  // ── Optimisation: if short shifts were consolidated ──
  const totalSavingsPotential = r2(weekendPremium + Math.max(0, shortPremium) + pendingCost);

  return {
    totalCost, totalHours, avgRate,
    dayBuckets, weekdayRate, weekendHours, weekendCost, weekendAvgRate, weekendPremium,
    timeBuckets,
    hiCost, hiH, hiRate, stdCost, stdH, stdRate,
    shortShifts: shortShifts.length, shortCost, shortHours, shortRate, longRate, shortPremium,
    pending: pending.length, pendingCost, pendingHours,
    clientRows, rateGroupRows, highFragClients,
    totalSavingsPotential,
    uniqueClients: new Set(rows.map(r => r.client)).size,
    uniqueStaff: new Set(rows.map(r => r.staff).filter(Boolean)).size,
  };
}

// ─── Sub-components ───────────────────────────────────────────────────────────
function KpiCard({ icon: Icon, label, value, sub, color = 'blue', danger }) {
  const colors = {
    blue:   'text-blue-600 bg-blue-50',
    red:    'text-red-600 bg-red-50',
    amber:  'text-amber-600 bg-amber-50',
    green:  'text-green-600 bg-green-50',
    purple: 'text-purple-600 bg-purple-50',
  };
  return (
    <Card className={danger ? 'border-red-200' : ''}>
      <CardContent className="pt-6">
        <div className="flex items-start justify-between">
          <div>
            <p className="text-sm text-gray-500">{label}</p>
            <p className={`text-2xl font-bold mt-1 ${danger ? 'text-red-600' : 'text-gray-900'}`}>{value}</p>
            {sub && <p className="text-xs text-gray-400 mt-1">{sub}</p>}
          </div>
          <div className={`p-2 rounded-lg ${colors[color]}`}>
            <Icon className="w-5 h-5" />
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

function BarRow({ label, value, maxValue, rate, color = 'bg-blue-500' }) {
  const pctWidth = maxValue > 0 ? Math.min(100, (value / maxValue) * 100) : 0;
  return (
    <div className="flex items-center gap-3 py-1.5">
      <span className="text-xs text-gray-600 w-28 shrink-0 truncate">{label}</span>
      <div className="flex-1 bg-gray-100 rounded-full h-2.5">
        <div className={`${color} h-2.5 rounded-full transition-all`} style={{ width: pctWidth + '%' }} />
      </div>
      <span className="text-sm font-medium text-gray-800 w-20 text-right shrink-0">{fmt(value)}</span>
      {rate !== undefined && <span className="text-xs text-gray-400 w-16 text-right shrink-0">${rate}/hr</span>}
    </div>
  );
}

function SectionToggle({ title, icon: Icon, children, defaultOpen = false, badge, badgeColor = 'bg-red-100 text-red-700' }) {
  const [open, setOpen] = useState(defaultOpen);
  return (
    <Card>
      <button
        onClick={() => setOpen(o => !o)}
        className="w-full flex items-center justify-between p-4 hover:bg-gray-50 transition-colors rounded-lg"
      >
        <div className="flex items-center gap-2">
          {Icon && <Icon className="w-4 h-4 text-gray-500" />}
          <span className="font-semibold text-gray-800">{title}</span>
          {badge && <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${badgeColor}`}>{badge}</span>}
        </div>
        {open ? <ChevronUp className="w-4 h-4 text-gray-400" /> : <ChevronDown className="w-4 h-4 text-gray-400" />}
      </button>
      {open && <CardContent className="pt-0 pb-4">{children}</CardContent>}
    </Card>
  );
}

function InefficientTag({ label }) {
  return <span className="text-xs bg-red-50 text-red-600 border border-red-200 px-1.5 py-0.5 rounded">{label}</span>;
}

// ─── Staff Profitability Section ──────────────────────────────────────────────
function rateGroupShort(rg) {
  // Extract the human-readable part from NDIS rate group string
  return (rg || 'Unknown')
    .replace(/^01\s+/i, '').replace(/^04\s+/i, '')
    .replace(/\bAssistance\b/i, 'Asst').replace(/\bActivities\b/i, 'Act')
    .replace(/\bSupported Independent Living\b/i, 'SIL')
    .replace(/\bSelf Care\b/i, 'Self Care')
    .replace(/\bHigh Intensity\b/i, 'HI').replace(/\bStandard\b/i, 'Std')
    .replace(/\bDelivery Of Health Supports By A Registered Nurse\b/i, 'RN')
    .replace(/\bAccess Community Social And Rec Activ\b/i, 'Comm Access')
    .substring(0, 50);
}

function StaffDetailRows({ s }) {
  // Group billing rows by date for readability
  const byDate = {};
  for (const r of s.billingRows) {
    const key = r.date || '?';
    if (!byDate[key]) byDate[key] = [];
    byDate[key].push(r);
  }
  const sortedDates = Object.keys(byDate).sort((a, b) => new Date(a) - new Date(b));

  const dow = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
  const getDow = (dateStr) => {
    if (!dateStr) return '';
    const [m, d, y] = dateStr.split('/').map(Number);
    return dow[new Date(y, m - 1, d).getDay()] || '';
  };

  // Revenue subtotal by client
  const byClient = {};
  for (const r of s.billingRows) {
    if (!byClient[r.client]) byClient[r.client] = { cost: 0, hours: 0 };
    byClient[r.client].cost  = r2(byClient[r.client].cost + r.totalCost);
    byClient[r.client].hours = r2(byClient[r.client].hours + r.duration);
  }
  const allocStaffPaid = (row) => {
    if (s.employerCost === null || !s.hours || s.hours <= 0) return null;
    return r2((s.employerCost * (row.duration || 0)) / s.hours);
  };

  return (
    <tr>
      <td colSpan={11} className="p-0 bg-slate-50 border-b border-slate-200">
        <div className="px-4 py-4 space-y-4">

          {/* Billing line by line */}
          <div>
            <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-2">Billing Lines ({s.billingRows.length} rows)</p>
            <div className="rounded-lg border border-gray-200 overflow-hidden">
              <table className="w-full text-xs">
                <thead className="bg-gray-100">
                  <tr>
                    <th className="text-left px-3 py-1.5 font-medium text-gray-600">Date</th>
                    <th className="text-left px-3 py-1.5 font-medium text-gray-600">Client</th>
                    <th className="text-left px-3 py-1.5 font-medium text-gray-600">Rate Group</th>
                    <th className="text-left px-3 py-1.5 font-medium text-gray-600">Type</th>
                    <th className="text-right px-3 py-1.5 font-medium text-gray-600">Start</th>
                    <th className="text-right px-3 py-1.5 font-medium text-gray-600">End</th>
                    <th className="text-right px-3 py-1.5 font-medium text-gray-600">Hrs</th>
                    <th className="text-right px-3 py-1.5 font-medium text-gray-600">Base Cost</th>
                    <th className="text-right px-3 py-1.5 font-medium text-gray-600">Km</th>
                    <th className="text-right px-3 py-1.5 font-medium text-gray-600">Total</th>
                    <th className="text-right px-3 py-1.5 font-medium text-gray-600">Staff Paid</th>
                    <th className="text-right px-3 py-1.5 font-medium text-gray-600">$/hr</th>
                  </tr>
                </thead>
                <tbody>
                  {sortedDates.map(date => (
                    <React.Fragment key={date}>
                      {byDate[date].map((r, i) => {
                        const effectiveRate = r.duration > 0 ? r2(r.totalCost / r.duration) : 0;
                        const staffPaid = allocStaffPaid(r);
                        const startTime = r.startDt?.split(' ').slice(1).join(' ') || '';
                        const endTime   = r.endDt?.split(' ').slice(1).join(' ') || '';
                        return (
                          <tr key={`${r.shiftId}-${i}`} className="border-t border-gray-100 hover:bg-white">
                            {i === 0 && (
                              <td rowSpan={byDate[date].length} className="px-3 py-1.5 font-medium text-gray-700 align-top whitespace-nowrap border-r border-gray-100">
                                {date} <span className="text-gray-400">{getDow(date)}</span>
                              </td>
                            )}
                            <td className="px-3 py-1.5 text-gray-700 max-w-[140px] truncate">{r.client}</td>
                            <td className="px-3 py-1.5 text-gray-500 max-w-[180px] truncate" title={r.rateGroup}>{rateGroupShort(r.rateGroup)}</td>
                            <td className="px-3 py-1.5 text-gray-500">{r.shiftType || '—'}</td>
                            <td className="px-3 py-1.5 text-right text-gray-600 whitespace-nowrap">{startTime}</td>
                            <td className="px-3 py-1.5 text-right text-gray-600 whitespace-nowrap">{endTime}</td>
                            <td className="px-3 py-1.5 text-right font-medium">{r.duration}h</td>
                            <td className="px-3 py-1.5 text-right text-gray-600">{fmt(r.cost)}</td>
                            <td className="px-3 py-1.5 text-right text-gray-400">{r.kms > 0 ? r.kms + 'km' : '—'}</td>
                            <td className="px-3 py-1.5 text-right font-semibold text-gray-800">{fmt(r.totalCost)}</td>
                            <td className="px-3 py-1.5 text-right text-gray-600">{staffPaid !== null ? fmt(staffPaid) : '—'}</td>
                            <td className="px-3 py-1.5 text-right text-gray-500">{fmt(effectiveRate)}</td>
                          </tr>
                        );
                      })}
                      {/* Day subtotal if multiple rows */}
                      {byDate[date].length > 1 && (
                        <tr className="bg-blue-50 border-t border-blue-100">
                          <td className="px-3 py-1 text-gray-400 text-right" colSpan={5}>{date} subtotal</td>
                          <td className="px-3 py-1 text-right font-medium">{r2(byDate[date].reduce((s, r) => s + r.duration, 0))}h</td>
                          <td className="px-3 py-1" />
                          <td className="px-3 py-1" />
                          <td className="px-3 py-1 text-right font-semibold text-blue-800">{fmt(r2(byDate[date].reduce((s, r) => s + r.totalCost, 0)))}</td>
                          <td className="px-3 py-1 text-right font-semibold text-blue-800">
                            {s.employerCost !== null
                              ? fmt(r2(byDate[date].reduce((sum, r) => sum + (allocStaffPaid(r) || 0), 0)))
                              : '—'}
                          </td>
                          <td className="px-3 py-1" />
                        </tr>
                      )}
                    </React.Fragment>
                  ))}
                  {/* Grand total row */}
                  <tr className="bg-gray-100 border-t-2 border-gray-300 font-semibold">
                    <td className="px-3 py-2 text-gray-700" colSpan={6}>REVENUE TOTAL</td>
                    <td className="px-3 py-2 text-right">{s.hours}h</td>
                    <td className="px-3 py-2" />
                    <td className="px-3 py-2" />
                    <td className="px-3 py-2 text-right text-gray-900">{fmt(s.revenue)}</td>
                    <td className="px-3 py-2 text-right text-gray-900">{s.employerCost !== null ? fmt(s.employerCost) : '—'}</td>
                    <td className="px-3 py-2 text-right text-gray-600">{fmt(s.revenuePerHour)}</td>
                  </tr>
                </tbody>
              </table>
            </div>
          </div>

          {/* Revenue by client */}
          <div className="flex gap-6 flex-wrap">
            <div className="flex-1 min-w-[200px]">
              <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-2">Revenue by Client</p>
              <div className="space-y-1">
                {Object.entries(byClient).sort((a, b) => b[1].cost - a[1].cost).map(([client, d]) => (
                  <div key={client} className="flex items-center gap-2 text-xs">
                    <span className="text-gray-700 flex-1 truncate">{client}</span>
                    <span className="text-gray-500 shrink-0">{d.hours}h</span>
                    <span className="font-medium text-gray-800 w-20 text-right shrink-0">{fmt(d.cost)}</span>
                  </div>
                ))}
              </div>
            </div>

            {/* Wage calculation breakdown */}
            {s.wages !== null && (
              <div className="flex-1 min-w-[220px]">
                <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-2">Wage Calculation</p>
                <div className="bg-white rounded-lg border border-gray-200 p-3 space-y-1.5 text-xs">
                  <div className="flex justify-between">
                    <span className="text-gray-500">Gross wages</span>
                    <span className="font-medium text-gray-800">{fmt(s.wages)}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-gray-500">Superannuation (11.5%)</span>
                    <span className="font-medium text-gray-800">{fmt(s.superAmt)}</span>
                  </div>
                  <div className="flex justify-between border-t border-gray-100 pt-1.5">
                    <span className="text-gray-600 font-medium">Total employer cost</span>
                    <span className="font-semibold text-gray-900">{fmt(s.employerCost)}</span>
                  </div>
                  <div className="flex justify-between text-gray-400 text-xs">
                    <span>Cost per hour worked</span>
                    <span>{s.costPerHour !== null ? fmt(s.costPerHour) + '/hr' : '—'}</span>
                  </div>
                  <div className={`flex justify-between border-t-2 pt-2 ${s.margin >= 0 ? 'border-green-200' : 'border-red-200'}`}>
                    <span className={`font-semibold ${s.margin >= 0 ? 'text-green-700' : 'text-red-600'}`}>
                      {s.margin >= 0 ? 'Gross surplus' : 'Gross deficit'}
                    </span>
                    <span className={`font-bold text-sm ${s.margin >= 0 ? 'text-green-700' : 'text-red-600'}`}>
                      {s.margin >= 0 ? '+' : ''}{fmt(s.margin)}
                      <span className="text-xs ml-1">({s.marginPct}%)</span>
                    </span>
                  </div>
                  <div className="pt-1 text-gray-400">
                    <div className="flex justify-between">
                      <span>Revenue generated</span>
                      <span>{fmt(s.revenue)}</span>
                    </div>
                    <div className="flex justify-between">
                      <span>Employer cost</span>
                      <span>− {fmt(s.employerCost)}</span>
                    </div>
                    <div className={`flex justify-between font-medium pt-1 border-t border-gray-100 ${s.margin >= 0 ? 'text-green-700' : 'text-red-600'}`}>
                      <span>= Margin</span>
                      <span>{s.margin >= 0 ? '+' : ''}{fmt(s.margin)}</span>
                    </div>
                  </div>
                </div>
              </div>
            )}
          </div>

        </div>
      </td>
    </tr>
  );
}

function ClientDetailRows({ c, lineStaffPaidMap }) {
  const byDate = {};
  for (const r of c.billingRows || []) {
    const key = r.date || '?';
    if (!byDate[key]) byDate[key] = [];
    byDate[key].push(r);
  }
  const sortedDates = Object.keys(byDate).sort((a, b) => new Date(a) - new Date(b));
  const allocStaffPaid = (row) => {
    const mapped = lineStaffPaidMap?.get(row);
    if (mapped !== undefined) return mapped;
    const staffRow = (c.staffAllocRows || []).find((s) => s.staffName === row.staff);
    if (!staffRow || !staffRow.hours || staffRow.hours <= 0) return null;
    return r2((staffRow.employerCost * (row.duration || 0)) / staffRow.hours);
  };

  return (
    <tr>
      <td colSpan={10} className="p-0 bg-slate-50 border-b border-slate-200">
        <div className="px-4 py-4 space-y-4">
          <div>
            <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-2">Allocated Staff Cost</p>
            <div className="rounded-lg border border-gray-200 overflow-hidden">
              <table className="w-full text-xs">
                <thead className="bg-gray-100">
                  <tr>
                    <th className="text-left px-3 py-1.5 font-medium text-gray-600">Staff</th>
                    <th className="text-right px-3 py-1.5 font-medium text-gray-600">Hrs</th>
                    <th className="text-right px-3 py-1.5 font-medium text-gray-600">Revenue</th>
                    <th className="text-right px-3 py-1.5 font-medium text-gray-600">Wages</th>
                    <th className="text-right px-3 py-1.5 font-medium text-gray-600">Super</th>
                    <th className="text-right px-3 py-1.5 font-medium text-gray-600">Employer Cost</th>
                    <th className="text-right px-3 py-1.5 font-medium text-gray-600">Margin</th>
                  </tr>
                </thead>
                <tbody>
                  {(c.staffAllocRows || []).map((s) => {
                    const margin = r2(s.revenue - s.employerCost);
                    return (
                      <tr key={s.staffName} className="border-t border-gray-100">
                        <td className="px-3 py-1.5 text-gray-700">{s.staffName}</td>
                        <td className="px-3 py-1.5 text-right">{s.hours}h</td>
                        <td className="px-3 py-1.5 text-right">{fmt(s.revenue)}</td>
                        <td className="px-3 py-1.5 text-right text-gray-600">{fmt(s.wages)}</td>
                        <td className="px-3 py-1.5 text-right text-gray-500">{fmt(s.superAmt)}</td>
                        <td className="px-3 py-1.5 text-right">{fmt(s.employerCost)}</td>
                        <td className={`px-3 py-1.5 text-right font-medium ${margin >= 0 ? 'text-green-700' : 'text-red-600'}`}>{margin >= 0 ? '+' : ''}{fmt(margin)}</td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>
          <div>
            <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-2">Billing Lines ({(c.billingRows || []).length})</p>
            <div className="rounded-lg border border-gray-200 overflow-hidden">
              <table className="w-full text-xs">
                <thead className="bg-gray-100">
                  <tr>
                    <th className="text-left px-3 py-1.5 font-medium text-gray-600">Date</th>
                    <th className="text-left px-3 py-1.5 font-medium text-gray-600">Staff</th>
                    <th className="text-right px-3 py-1.5 font-medium text-gray-600">Hrs</th>
                    <th className="text-right px-3 py-1.5 font-medium text-gray-600">Total</th>
                    <th className="text-right px-3 py-1.5 font-medium text-gray-600">Staff Paid</th>
                  </tr>
                </thead>
                <tbody>
                  {sortedDates.map((date) => (
                    <React.Fragment key={date}>
                      {byDate[date].map((r, idx) => {
                        const staffPaid = allocStaffPaid(r);
                        return (
                          <tr key={`${r.shiftId}-${idx}`} className="border-t border-gray-100">
                            {idx === 0 && <td rowSpan={byDate[date].length} className="px-3 py-1.5 align-top border-r border-gray-100 text-gray-700">{date}</td>}
                            <td className="px-3 py-1.5 text-gray-700">{r.staff || '—'}</td>
                            <td className="px-3 py-1.5 text-right">{r.duration}h</td>
                            <td className="px-3 py-1.5 text-right font-medium">{fmt(r.totalCost)}</td>
                            <td className="px-3 py-1.5 text-right text-gray-600">{staffPaid !== null ? fmt(staffPaid) : '—'}</td>
                          </tr>
                        );
                      })}
                    </React.Fragment>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      </td>
    </tr>
  );
}

function StaffProfitabilitySection({
  sa,
  payrollMap,
  payrollName,
  payrollLoading,
  payrollError,
  payrollDz,
  onRemovePayroll,
  wageSource,
  onWageSourceChange,
  awardRatesDz,
  awardRatesLoading,
  awardRatesError,
  awardRatesName,
  onRemoveAwardRates,
  superPct,
  onSuperPctChange,
  awardDefaultRate,
  onAwardDefaultRateChange,
  awardEmpType,
  onAwardEmpTypeChange,
  payHoursCount,
  payHoursPeriodText,
  usingHubRates,
}) {
  const [expanded, setExpanded] = useState(new Set());
  const [expandedClients, setExpandedClients] = useState(new Set());
  const [staffTableOpen, setStaffTableOpen] = useState(true);
  const [clientTableOpen, setClientTableOpen] = useState(true);
  const toggleExpand = (name) => setExpanded(prev => {
    const next = new Set(prev);
    next.has(name) ? next.delete(name) : next.add(name);
    return next;
  });
  const toggleClientExpand = (name) => setExpandedClients(prev => {
    const next = new Set(prev);
    next.has(name) ? next.delete(name) : next.add(name);
    return next;
  });
  const lineStaffPaidMap = useMemo(() => {
    if (!sa?.staffRows?.length) return null;
    const map = new WeakMap();
    for (const staffRow of sa.staffRows) {
      if (staffRow.employerCost === null) continue;
      const rows = staffRow.billingRows || [];
      if (!rows.length) continue;
      const groups = new Map();
      for (const row of rows) {
        const key = sharedShiftKey(row);
        if (!groups.has(key)) groups.set(key, []);
        groups.get(key).push(row);
      }

      let dedupHours = 0;
      for (const groupRows of groups.values()) {
        const shiftHrs = Math.max(...groupRows.map((r) => r.duration || 0), 0);
        dedupHours += shiftHrs;
      }
      if (dedupHours <= 0) continue;
      const staffHourlyCost = staffRow.employerCost / dedupHours;

      for (const groupRows of groups.values()) {
        const shiftHrs = Math.max(...groupRows.map((r) => r.duration || 0), 0);
        const shiftPaid = staffHourlyCost * shiftHrs;
        const shareCount = groupRows.length || 1;
        for (const row of groupRows) {
          const share = 1 / shareCount;
          map.set(row, r2(shiftPaid * share));
        }
      }
    }
    return map;
  }, [sa]);
  const costBasisReady = payrollMap && payrollMap.size > 0;
  return (
    <Card>
      <CardHeader className="pb-3">
        <CardTitle className="flex items-center gap-2 text-base">
          <Users className="w-4 h-4 text-gray-500" />
          Staff Revenue vs Wages
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">

        <div className="flex flex-wrap gap-2">
          <Button
            type="button"
            size="sm"
            variant={wageSource === 'award' ? 'default' : 'outline'}
            onClick={() => onWageSourceChange('award')}
          >
            Award calculation
          </Button>
          <Button
            type="button"
            size="sm"
            variant={wageSource === 'payroll' ? 'default' : 'outline'}
            onClick={() => onWageSourceChange('payroll')}
          >
            Payroll file
          </Button>
        </div>

        {wageSource === 'payroll' && (
          <>
            {!payrollMap ? (
              <div>
                <div
                  {...payrollDz.getRootProps()}
                  className={`border-2 border-dashed rounded-xl p-8 text-center cursor-pointer transition-colors ${
                    payrollDz.isDragActive ? 'border-green-400 bg-green-50' : 'border-gray-200 hover:border-green-300 hover:bg-green-50'
                  }`}
                >
                  <input {...payrollDz.getInputProps()} />
                  <FileSpreadsheet className="w-8 h-8 text-gray-300 mx-auto mb-2" />
                  {payrollLoading ? (
                    <p className="text-sm text-gray-500">Parsing payroll file...</p>
                  ) : (
                    <>
                      <p className="font-medium text-gray-700 text-sm">
                        {payrollDz.isDragActive ? 'Drop payroll summary here' : 'Upload Payroll Employee Summary'}
                      </p>
                      <p className="text-xs text-gray-400 mt-1">
                        ShiftCare payroll export (Employee / Earnings columns)
                      </p>
                    </>
                  )}
                </div>
                {payrollError && (
                  <div className="mt-2 flex items-center gap-2 text-red-600 bg-red-50 border border-red-200 rounded-lg p-2 text-sm">
                    <AlertTriangle className="w-4 h-4 shrink-0" />
                    {payrollError}
                  </div>
                )}
              </div>
            ) : (
              <div className="flex items-center gap-3 bg-green-50 border border-green-200 rounded-lg px-3 py-2">
                <FileSpreadsheet className="w-4 h-4 text-green-600 shrink-0" />
                <span className="text-sm text-green-800 font-medium truncate">{payrollName}</span>
                <span className="text-xs text-green-600 shrink-0">· {payrollMap.size} staff</span>
                <button type="button" onClick={onRemovePayroll} className="ml-auto text-xs text-gray-400 hover:text-gray-600 shrink-0">Remove</button>
              </div>
            )}
          </>
        )}

        {wageSource === 'award' && (
          <div className="space-y-3 rounded-lg border border-gray-200 p-4 bg-gray-50/50">
            <p className="text-xs text-gray-600">
              Uses pay hours from the app (same SCHADS logic as the award calculator). Gross pay × super % = employer cost, allocated across clients by billing hours.
              {payHoursPeriodText ? (
                <span className="block mt-1 font-medium text-gray-800">Pay period in app: {payHoursPeriodText}</span>
              ) : null}
            </p>
            {payHoursCount === 0 && (
              <div className="text-sm text-amber-800 bg-amber-50 border border-amber-200 rounded-md px-3 py-2 flex gap-2">
                <AlertTriangle className="w-4 h-4 shrink-0 mt-0.5" />
                No pay hours in the database for this location. Upload shifts and run <strong>Compute pay hours</strong> first.
              </div>
            )}
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
              <div>
                <label className="text-xs text-gray-500 block mb-1">Super % of gross (estimate)</label>
                <Input
                  type="number"
                  step="0.1"
                  min="0"
                  value={superPct}
                  onChange={(e) => onSuperPctChange(parseFloat(e.target.value) || 0)}
                  className="h-9"
                />
              </div>
              <div>
                <label className="text-xs text-gray-500 block mb-1">Default base rate ($/h)</label>
                <Input
                  type="number"
                  step="0.01"
                  min="0"
                  placeholder="If no per-staff rates row"
                  value={awardDefaultRate}
                  onChange={(e) => onAwardDefaultRateChange(e.target.value)}
                  className="h-9"
                />
              </div>
              <div>
                <label className="text-xs text-gray-500 block mb-1">Default employment</label>
                <select
                  value={awardEmpType}
                  onChange={(e) => onAwardEmpTypeChange(e.target.value)}
                  className="h-9 w-full rounded-md border border-gray-200 bg-white px-2 text-sm"
                >
                  <option value="casual">Casual</option>
                  <option value="permanent">Permanent</option>
                </select>
              </div>
              <div className="flex items-end text-xs text-gray-500">
                Pay hours rows: <strong className="ml-1 text-gray-800">{payHoursCount}</strong>
              </div>
            </div>
            {usingHubRates && (
              <div className="text-xs text-green-800 bg-green-50 border border-green-200 rounded-md px-3 py-2">
                Using rates workbook from the Award calculator step. Upload below only if you want to override.
              </div>
            )}
            {!awardRatesName ? (
              <div>
                <div
                  {...awardRatesDz.getRootProps()}
                  className={`border-2 border-dashed rounded-xl p-6 text-center cursor-pointer transition-colors ${
                    awardRatesDz.isDragActive ? 'border-violet-400 bg-violet-50' : 'border-gray-200 hover:border-violet-300 hover:bg-violet-50/50'
                  }`}
                >
                  <input {...awardRatesDz.getInputProps()} />
                  <FileSpreadsheet className="w-7 h-7 text-gray-300 mx-auto mb-2" />
                  {awardRatesLoading ? (
                    <p className="text-sm text-gray-500">Parsing rates file...</p>
                  ) : (
                    <>
                      <p className="font-medium text-gray-700 text-sm">
                        {awardRatesDz.isDragActive ? 'Drop rates file' : 'Upload per-staff rates XLSX (optional)'}
                      </p>
                      <p className="text-xs text-gray-400 mt-1">Same format as the award calculator rates export</p>
                    </>
                  )}
                </div>
                {awardRatesError && (
                  <div className="mt-2 flex items-center gap-2 text-red-600 bg-red-50 border border-red-200 rounded-lg p-2 text-sm">
                    <AlertTriangle className="w-4 h-4 shrink-0" />
                    {awardRatesError}
                  </div>
                )}
              </div>
            ) : (
              <div className="flex items-center gap-3 bg-violet-50 border border-violet-200 rounded-lg px-3 py-2">
                <FileSpreadsheet className="w-4 h-4 text-violet-600 shrink-0" />
                <span className="text-sm text-violet-900 font-medium truncate">{awardRatesName}</span>
                <button type="button" onClick={onRemoveAwardRates} className="ml-auto text-xs text-gray-400 hover:text-gray-600 shrink-0">Remove</button>
              </div>
            )}
            {costBasisReady && (
              <div className="flex items-center gap-3 bg-green-50 border border-green-200 rounded-lg px-3 py-2 text-sm text-green-900">
                <TrendingUp className="w-4 h-4 shrink-0" />
                <span className="font-medium truncate">{payrollName}</span>
                <span className="text-xs text-green-700 shrink-0">· {payrollMap.size} staff with cost basis</span>
              </div>
            )}
          </div>
        )}

        {/* Data — only when both files loaded */}
        {sa && (
          <>
            {/* Scope note */}
            <div className="bg-blue-50 border border-blue-200 rounded-lg px-3 py-2 text-xs text-blue-700 flex items-start gap-2">
              <Info className="w-3.5 h-3.5 shrink-0 mt-0.5" />
              <span>
                Margin calculated for <strong>{sa.matchedCount} matched staff</strong> (found in billing and {wageSource === 'award' ? 'award cost' : 'payroll'} data).
                {sa.paidNotBilled.length > 0 && (
                  <> {sa.paidNotBilled.length} with wages/cost in file but no billing lines this period.</>
                )}
              </span>
            </div>

            {/* KPIs */}
            <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
              <div className="bg-green-50 rounded-lg p-3">
                <p className="text-xs text-gray-500">Revenue (matched staff)</p>
                <p className="text-lg font-bold text-gray-900">{fmtK(sa.matchedRevenue)}</p>
                <p className="text-xs text-gray-400">{sa.matchedCount} of {sa.staffRows.length} staff matched</p>
              </div>
              <div className="bg-blue-50 rounded-lg p-3">
                <p className="text-xs text-gray-500">Wages + Super</p>
                <p className="text-lg font-bold text-gray-900">{fmtK(sa.matchedEmployerCost)}</p>
                <p className="text-xs text-gray-400">{fmt(sa.matchedWages)} wages + {fmt(sa.matchedSuper)} super</p>
              </div>
              <div className={`rounded-lg p-3 ${sa.matchedMargin >= 0 ? 'bg-green-50' : 'bg-red-50'}`}>
                <p className="text-xs text-gray-500">Gross Margin</p>
                <p className={`text-lg font-bold ${sa.matchedMargin >= 0 ? 'text-green-700' : 'text-red-600'}`}>
                  {sa.matchedMargin >= 0 ? '+' : ''}{fmtK(sa.matchedMargin)}
                </p>
                <p className="text-xs text-gray-400">{sa.matchedMarginPct}% · {sa.matchedMargin >= 0 ? 'surplus' : 'deficit'}</p>
              </div>
              <div className="bg-gray-50 rounded-lg p-3">
                <p className="text-xs text-gray-500">Staff Matched</p>
                <p className="text-lg font-bold text-gray-900">{sa.matchedCount} / {sa.staffRows.length}</p>
                <p className="text-xs text-gray-400">{sa.paidNotBilled.length} paid, not in billing</p>
              </div>
            </div>

            {/* Staff table */}
            <div className="space-y-2">
              <button
                type="button"
                onClick={() => setStaffTableOpen(v => !v)}
                className="w-full flex items-center justify-between rounded-lg border border-gray-200 px-3 py-2 hover:bg-gray-50"
              >
                <p className="text-sm font-semibold text-gray-800">Staff Revenue vs Wages Table</p>
                {staffTableOpen ? <ChevronUp className="w-4 h-4 text-gray-500" /> : <ChevronDown className="w-4 h-4 text-gray-500" />}
              </button>
              {staffTableOpen && (
                <div className="overflow-x-auto rounded-lg border border-gray-100">
                  <Table>
                    <TableHeader>
                      <TableRow className="bg-gray-50">
                        <TableHead>Staff Member</TableHead>
                        <TableHead className="text-right">Revenue</TableHead>
                        <TableHead className="text-right">Wages</TableHead>
                        <TableHead className="text-right">Super</TableHead>
                        <TableHead className="text-right">Employer Cost</TableHead>
                        <TableHead className="text-right">Margin</TableHead>
                        <TableHead className="text-right">Margin %</TableHead>
                        <TableHead className="text-right">Rev/hr</TableHead>
                        <TableHead className="text-right">Cost/hr</TableHead>
                        <TableHead className="text-right">Hrs</TableHead>
                        <TableHead className="text-right">Clients</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {sa.staffRows.map(s => {
                        const hasPayroll = s.wages !== null;
                        const isLoss = s.margin !== null && s.margin < 0;
                        const isLowMargin = s.marginPct !== null && s.marginPct < 20 && s.marginPct >= 0;
                        const isOpen = expanded.has(s.name);
                        return (
                          <React.Fragment key={s.name}>
                            <TableRow
                              className={`cursor-pointer hover:bg-slate-50 transition-colors ${isLoss ? 'bg-red-50 hover:bg-red-100' : ''}`}
                              onClick={() => toggleExpand(s.name)}
                            >
                              <TableCell className="font-medium text-sm">
                                <span className="flex items-center gap-1.5">
                                  {isOpen
                                    ? <ChevronUp className="w-3.5 h-3.5 text-gray-400 shrink-0" />
                                    : <ChevronDown className="w-3.5 h-3.5 text-gray-400 shrink-0" />}
                                  {s.name}
                                </span>
                              </TableCell>
                              <TableCell className="text-right font-medium">{fmt(s.revenue)}</TableCell>
                              <TableCell className="text-right text-gray-600">{hasPayroll ? fmt(s.wages) : <span className="text-gray-300">—</span>}</TableCell>
                              <TableCell className="text-right text-gray-500 text-xs">{hasPayroll ? fmt(s.superAmt) : <span className="text-gray-300">—</span>}</TableCell>
                              <TableCell className="text-right text-gray-600">{hasPayroll ? fmt(s.employerCost) : <span className="text-gray-300">—</span>}</TableCell>
                              <TableCell className="text-right">
                                {s.margin !== null ? (
                                  <span className={`font-semibold ${isLoss ? 'text-red-600' : isLowMargin ? 'text-amber-600' : 'text-green-700'}`}>
                                    {s.margin >= 0 ? '+' : ''}{fmt(s.margin)}
                                  </span>
                                ) : <span className="text-gray-300">—</span>}
                              </TableCell>
                              <TableCell className="text-right">
                                {s.marginPct !== null ? (
                                  <span className={`text-sm font-medium ${isLoss ? 'text-red-500' : isLowMargin ? 'text-amber-500' : 'text-green-600'}`}>
                                    {s.marginPct}%
                                  </span>
                                ) : <span className="text-gray-300">—</span>}
                              </TableCell>
                              <TableCell className="text-right text-gray-600 text-sm">{fmt(s.revenuePerHour)}</TableCell>
                              <TableCell className="text-right text-gray-500 text-sm">{s.costPerHour !== null ? fmt(s.costPerHour) : <span className="text-gray-300">—</span>}</TableCell>
                              <TableCell className="text-right text-gray-500 text-sm">{s.hours}h</TableCell>
                              <TableCell className="text-right text-gray-500 text-sm">{s.clients}</TableCell>
                            </TableRow>
                            {isOpen && <StaffDetailRows s={s} />}
                          </React.Fragment>
                        );
                      })}
                      <TableRow className="bg-gray-50 font-semibold border-t-2">
                        <TableCell className="text-xs text-gray-500">MATCHED TOTAL ({sa.matchedCount})</TableCell>
                        <TableCell className="text-right">{fmt(sa.matchedRevenue)}</TableCell>
                        <TableCell className="text-right">{fmt(sa.matchedWages)}</TableCell>
                        <TableCell className="text-right text-sm">{fmt(sa.matchedSuper)}</TableCell>
                        <TableCell className="text-right">{fmt(sa.matchedEmployerCost)}</TableCell>
                        <TableCell className="text-right">
                          <span className={sa.matchedMargin >= 0 ? 'text-green-700' : 'text-red-600'}>
                            {sa.matchedMargin >= 0 ? '+' : ''}{fmt(sa.matchedMargin)}
                          </span>
                        </TableCell>
                        <TableCell className="text-right">
                          <span className={sa.matchedMarginPct >= 0 ? 'text-green-700' : 'text-red-600'}>
                            {sa.matchedMarginPct}%
                          </span>
                        </TableCell>
                        <TableCell colSpan={4} />
                      </TableRow>
                    </TableBody>
                  </Table>
                </div>
              )}
            </div>

            {/* Client revenue vs wages */}
            <div className="space-y-2">
              <button
                type="button"
                onClick={() => setClientTableOpen(v => !v)}
                className="w-full flex items-center justify-between rounded-lg border border-gray-200 px-3 py-2 hover:bg-gray-50"
              >
                <p className="text-sm font-semibold text-gray-800">Client Revenue vs Staff Wages Table</p>
                {clientTableOpen ? <ChevronUp className="w-4 h-4 text-gray-500" /> : <ChevronDown className="w-4 h-4 text-gray-500" />}
              </button>
              {clientTableOpen && (
                <>
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-semibold text-gray-800">Client Revenue vs Staff Wages</p>
                  <p className="text-xs text-gray-500">Staff cost allocated by worked hours per client</p>
                </div>
                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={() => setExpandedClients(new Set(sa.clientRows.map(c => c.name)))}
                    className="text-xs px-2.5 py-1 rounded border border-gray-200 text-gray-600 hover:text-gray-800 hover:border-gray-300"
                  >
                    Expand all
                  </button>
                  <button
                    type="button"
                    onClick={() => setExpandedClients(new Set())}
                    className="text-xs px-2.5 py-1 rounded border border-gray-200 text-gray-600 hover:text-gray-800 hover:border-gray-300"
                  >
                    Collapse all
                  </button>
                </div>
              </div>
              <div className="overflow-x-auto rounded-lg border border-gray-100">
                <Table>
                  <TableHeader>
                    <TableRow className="bg-gray-50">
                      <TableHead>Client</TableHead>
                      <TableHead className="text-right">Client Paid</TableHead>
                      <TableHead className="text-right">Staff Wages</TableHead>
                      <TableHead className="text-right">Super</TableHead>
                      <TableHead className="text-right">Staff Cost</TableHead>
                      <TableHead className="text-right">Margin</TableHead>
                      <TableHead className="text-right">Margin %</TableHead>
                      <TableHead className="text-right">Coverage</TableHead>
                      <TableHead className="text-right">Hrs</TableHead>
                      <TableHead className="text-right">Workers</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {sa.clientRows.map((c) => {
                      const isOpen = expandedClients.has(c.name);
                      return (
                        <React.Fragment key={c.name}>
                          <TableRow className="cursor-pointer hover:bg-slate-50 transition-colors" onClick={() => toggleClientExpand(c.name)}>
                            <TableCell className="font-medium text-sm">
                              <span className="flex items-center gap-1.5">
                                {isOpen
                                  ? <ChevronUp className="w-3.5 h-3.5 text-gray-400 shrink-0" />
                                  : <ChevronDown className="w-3.5 h-3.5 text-gray-400 shrink-0" />}
                                {c.name}
                              </span>
                            </TableCell>
                            <TableCell className="text-right font-medium">{fmt(c.revenue)}</TableCell>
                            <TableCell className="text-right text-gray-600">{fmt(c.allocWages)}</TableCell>
                            <TableCell className="text-right text-gray-500 text-xs">{fmt(c.allocSuper)}</TableCell>
                            <TableCell className="text-right text-gray-600">{fmt(c.allocEmployerCost)}</TableCell>
                            <TableCell className="text-right">
                              <span className={`font-semibold ${c.margin >= 0 ? 'text-green-700' : 'text-red-600'}`}>
                                {c.margin >= 0 ? '+' : ''}{fmt(c.margin)}
                              </span>
                            </TableCell>
                            <TableCell className="text-right">
                              <span className={c.marginPct >= 0 ? 'text-green-700' : 'text-red-600'}>
                                {c.marginPct}%
                              </span>
                            </TableCell>
                            <TableCell className="text-right">
                              <span className={c.payrollCoveragePct >= 90 ? 'text-green-700' : c.payrollCoveragePct >= 60 ? 'text-amber-600' : 'text-red-600'}>
                                {c.payrollCoveragePct}%
                              </span>
                            </TableCell>
                            <TableCell className="text-right text-gray-500 text-sm">{c.hours}h</TableCell>
                            <TableCell className="text-right text-gray-500 text-sm">{c.staffCount}</TableCell>
                          </TableRow>
                          {isOpen && <ClientDetailRows c={c} lineStaffPaidMap={lineStaffPaidMap} />}
                        </React.Fragment>
                      );
                    })}
                  </TableBody>
                </Table>
              </div>
                </>
              )}
            </div>

            {/* Legend */}
            <div className="flex items-center gap-4 text-xs text-gray-400">
              <span className="flex items-center gap-1"><span className="w-2.5 h-2.5 rounded bg-red-200 inline-block" /> Loss</span>
              <span className="flex items-center gap-1"><span className="w-2.5 h-2.5 rounded bg-amber-200 inline-block" /> Low margin (0–20%)</span>
              <span className="flex items-center gap-1"><span className="w-2.5 h-2.5 rounded bg-green-200 inline-block" /> Healthy (&gt;20%)</span>
              <span className="flex items-center gap-1 ml-2"><span className="text-gray-300 font-bold">—</span> No wage match</span>
            </div>

            {/* Paid not billed */}
            {sa.paidNotBilled.length > 0 && (
              <details className="border border-amber-200 rounded-lg">
                <summary className="px-4 py-3 cursor-pointer text-sm font-medium text-amber-800 bg-amber-50 rounded-lg flex items-center justify-between">
                  <span className="flex items-center gap-2">
                    <UserX className="w-4 h-4" />
                    {sa.paidNotBilled.length} staff paid but no billing this period
                    — {fmt(r2(sa.paidNotBilled.reduce((s, p) => s + p.employerCost, 0)))} employer cost
                  </span>
                </summary>
                <div className="p-4">
                  <p className="text-xs text-gray-500 mb-3">These staff received wages but don't appear in the billing export. May be admin, training, leave, or name mismatch.</p>
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Staff Member</TableHead>
                        <TableHead className="text-right">Wages</TableHead>
                        <TableHead className="text-right">Super</TableHead>
                        <TableHead className="text-right">Employer Cost</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {[...sa.paidNotBilled].sort((a, b) => b.wages - a.wages).map(p => (
                        <TableRow key={p.name}>
                          <TableCell className="font-medium">{p.name}</TableCell>
                          <TableCell className="text-right">{fmt(p.wages)}</TableCell>
                          <TableCell className="text-right text-gray-500 text-sm">{fmt(p.superAmt)}</TableCell>
                          <TableCell className="text-right font-medium text-amber-700">{fmt(p.employerCost)}</TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </div>
              </details>
            )}
          </>
        )}
      </CardContent>
    </Card>
  );
}

// ─── Main Component ───────────────────────────────────────────────────────────
export function CostAnalysis({ embedded = false, locationId = '', hubStaffRatesMap = null } = {}) {
  const [rows, setRows]           = useState(null);
  const [payrollMap, setPayrollMap] = useState(null);
  const [payrollName, setPayrollName] = useState('');
  const [error, setError]         = useState('');
  const [payrollError, setPayrollError] = useState('');
  const [loading, setLoading]     = useState(false);
  const [payrollLoading, setPayrollLoading] = useState(false);
  const [wageSource, setWageSource] = useState(embedded ? 'award' : 'payroll');
  const [localAwardRatesMap, setLocalAwardRatesMap] = useState(null);
  const [awardRatesName, setAwardRatesName] = useState('');
  const [awardRatesError, setAwardRatesError] = useState('');
  const [awardRatesLoading, setAwardRatesLoading] = useState(false);
  const [superPct, setSuperPct] = useState(0);
  const [awardDefaultRate, setAwardDefaultRate] = useState('');
  const [awardEmpType, setAwardEmpType] = useState('casual');

  const payHoursQueryParams = useMemo(() => {
    const p = {};
    if (locationId) p.locationId = locationId;
    return p;
  }, [locationId]);

  const { data: payHoursData } = usePayHours(payHoursQueryParams);
  const payHoursRows = payHoursData?.payHours ?? [];
  const payHoursPeriodText =
    payHoursData?.periodStart && payHoursData?.periodEnd
      ? `${new Date(payHoursData.periodStart).toLocaleDateString('en-AU')} — ${new Date(payHoursData.periodEnd).toLocaleDateString('en-AU')}`
      : '';

  const hubXlsxRatesMerge = useMemo(() => {
    const m = new Map();
    if (hubStaffRatesMap) for (const [k, v] of hubStaffRatesMap) m.set(k, v);
    if (localAwardRatesMap && localAwardRatesMap.size > 0) for (const [k, v] of localAwardRatesMap) m.set(k, v);
    return m.size > 0 ? m : null;
  }, [hubStaffRatesMap, localAwardRatesMap]);

  const usingHubRates = Boolean(
    hubStaffRatesMap && hubStaffRatesMap.size > 0 && !(localAwardRatesMap && localAwardRatesMap.size > 0),
  );

  const awardCostMap = useMemo(() => {
    if (wageSource !== 'award' || !payHoursRows.length) return null;
    const map = buildAwardCostMapFromPayHours({
      payHoursRows,
      staffRatesMap: hubXlsxRatesMerge,
      baseRates: {},
      defaultRate: awardDefaultRate,
      empTypes: {},
      defaultEmpType: awardEmpType,
      superPct,
    });
    return map.size > 0 ? map : null;
  }, [wageSource, payHoursRows, hubXlsxRatesMerge, awardDefaultRate, awardEmpType, superPct]);

  const effectiveCostMap = wageSource === 'award' ? awardCostMap : payrollMap;
  const effectiveCostLabel = useMemo(() => {
    if (!effectiveCostMap?.size) return '';
    if (wageSource === 'payroll') return payrollName;
    const parts = ['SCHADS gross + super estimate'];
    if (awardRatesName) parts.push(awardRatesName);
    else if (hubXlsxRatesMerge?.size) parts.push('per-staff rates');
    else if (awardDefaultRate) parts.push(`default $${awardDefaultRate}/h`);
    return parts.join(' · ');
  }, [effectiveCostMap, wageSource, payrollName, awardRatesName, hubXlsxRatesMerge, awardDefaultRate]);

  const onDrop = useCallback((accepted) => {
    const file = accepted[0];
    if (!file) return;
    setError('');
    setLoading(true);
    const reader = new FileReader();
    reader.onload = (e) => {
      try {
        const text = e.target.result;
        const parsed = parseCsv(text);
        if (parsed.length === 0) throw new Error('No valid rows found — check file format');
        setRows(parsed);
      } catch (err) {
        setError(err.message);
      } finally {
        setLoading(false);
      }
    };
    reader.readAsText(file);
  }, []);

  const onDropPayroll = useCallback((accepted) => {
    const file = accepted[0];
    if (!file) return;
    setPayrollError('');
    setPayrollLoading(true);
    const reader = new FileReader();
    reader.onload = (e) => {
      try {
        const parsed = parsePayrollXlsx(e.target.result);
        if (parsed.size === 0) throw new Error('No payroll rows found — check file format');
        setPayrollMap(parsed);
        setPayrollName(file.name);
      } catch (err) {
        setPayrollError(err.message);
      } finally {
        setPayrollLoading(false);
      }
    };
    reader.readAsArrayBuffer(file);
  }, []);

  const { getRootProps, getInputProps, isDragActive } = useDropzone({
    onDrop,
    accept: { 'text/csv': ['.csv'] },
    multiple: false,
  });

  const payrollDz = useDropzone({
    onDrop: onDropPayroll,
    accept: { 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet': ['.xlsx'], 'application/vnd.ms-excel': ['.xls'] },
    multiple: false,
  });

  const onDropAwardRates = useCallback((accepted) => {
    const file = accepted[0];
    if (!file) return;
    setAwardRatesError('');
    setAwardRatesLoading(true);
    const reader = new FileReader();
    reader.onload = (e) => {
      try {
        const parsed = parseAwardRatesXlsx(e.target.result);
        if (parsed.size === 0) throw new Error('No rate rows found — check file format');
        setLocalAwardRatesMap(parsed);
        setAwardRatesName(file.name);
      } catch (err) {
        setAwardRatesError(err.message);
      } finally {
        setAwardRatesLoading(false);
      }
    };
    reader.readAsArrayBuffer(file);
  }, []);

  const awardRatesDz = useDropzone({
    onDrop: onDropAwardRates,
    accept: { 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet': ['.xlsx'], 'application/vnd.ms-excel': ['.xls'] },
    multiple: false,
  });

  const analysis    = useMemo(() => rows ? analyzeRows(rows) : null, [rows]);
  const staffAnalysis = useMemo(
    () => (rows && effectiveCostMap?.size) ? analyzeStaffProfitability(rows, effectiveCostMap) : null,
    [rows, effectiveCostMap],
  );

  if (!rows) {
    return (
      <div className="p-6 max-w-2xl mx-auto">
        <div className="mb-8">
          <h1 className="text-2xl font-bold text-gray-900">Cost Analysis</h1>
          <p className="text-gray-500 mt-1">Upload a ShiftCare billing export to identify inefficiencies and rostering improvements.</p>
        </div>

        <div
          {...getRootProps()}
          className={`border-2 border-dashed rounded-xl p-12 text-center cursor-pointer transition-colors ${
            isDragActive ? 'border-blue-400 bg-blue-50' : 'border-gray-200 hover:border-gray-300 hover:bg-gray-50'
          }`}
        >
          <input {...getInputProps()} />
          {loading ? (
            <div className="text-gray-500">Parsing...</div>
          ) : (
            <>
              <Upload className="w-10 h-10 text-gray-300 mx-auto mb-3" />
              <p className="font-medium text-gray-700">{isDragActive ? 'Drop the file' : 'Drop ShiftCare billing CSV here'}</p>
              <p className="text-sm text-gray-400 mt-1">or click to browse — Cost_Breakdown_Raw_Export_*.csv</p>
            </>
          )}
        </div>

        {error && (
          <div className="mt-4 flex items-center gap-2 text-red-600 bg-red-50 border border-red-200 rounded-lg p-3">
            <AlertTriangle className="w-4 h-4 shrink-0" />
            <span className="text-sm">{error}</span>
          </div>
        )}

        <div className="mt-6 bg-gray-50 rounded-lg p-4 text-sm text-gray-500">
          <p className="font-medium text-gray-700 mb-2">What this analyzes:</p>
          <ul className="space-y-1 list-disc list-inside">
            <li>Weekend vs weekday cost premium</li>
            <li>Short shift rate inefficiency</li>
            <li>Unfilled / pending shift exposure</li>
            <li>High-intensity vs standard rate mix</li>
            <li>Staff fragmentation per client</li>
            <li>Cost by client, rate group, and time period</li>
            <li>Staff revenue vs wages (award calculation from pay hours or payroll file)</li>
          </ul>
        </div>
      </div>
    );
  }

  const a = analysis;

  const resetBillingFile = () => {
    setRows(null);
    setPayrollMap(null);
    setPayrollName('');
    setLocalAwardRatesMap(null);
    setAwardRatesName('');
    setAwardRatesError('');
  };

  return (
    <div className={embedded ? 'p-4 space-y-6' : 'p-6 space-y-6'}>
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          {!embedded && <h1 className="text-2xl font-bold text-gray-900">Cost Analysis</h1>}
          {embedded && <h2 className="text-lg font-semibold text-gray-900">Billing & cost outcomes</h2>}
          <p className="text-gray-500 text-sm mt-0.5">
            {rows.length} billing lines · {a.uniqueClients} clients · {a.uniqueStaff} staff
          </p>
        </div>
        <Button variant="outline" size="sm" onClick={resetBillingFile}>
          <Upload className="w-4 h-4 mr-1" /> New File
        </Button>
      </div>


      {/* Top KPIs */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <KpiCard icon={DollarSign} label="Total Billing Cost" value={fmtK(a.totalCost)} sub={`${a.totalHours}h · avg ${fmt(a.avgRate)}/hr`} color="blue" />
        <KpiCard icon={TrendingDown} label="Potential Savings" value={fmtK(a.totalSavingsPotential)} sub="weekend + short-shift + unfilled" color="red" danger />
        <KpiCard icon={Clock} label="Unfilled Shifts" value={fmt(a.pendingCost)} sub={`${a.pending} shifts · ${a.pendingHours}h at risk`} color="amber" danger={a.pending > 0} />
        <KpiCard icon={Users} label="Weekend Hours" value={`${a.weekendHours}h`} sub={`${pct(a.weekendCost, a.totalCost)} of total cost`} color="purple" />
      </div>

      {/* Savings Summary Banner */}
      <Card className="border-orange-200 bg-orange-50">
        <CardContent className="pt-4 pb-4">
          <div className="flex items-start gap-3">
            <AlertTriangle className="w-5 h-5 text-orange-500 mt-0.5 shrink-0" />
            <div className="flex-1">
              <p className="font-semibold text-orange-900">Rostering Inefficiency Summary</p>
              <div className="mt-3 grid grid-cols-1 md:grid-cols-3 gap-4">
                <div className="bg-white rounded-lg p-3 border border-orange-100">
                  <p className="text-xs text-gray-500">Weekend Rate Premium</p>
                  <p className="text-xl font-bold text-red-600">{fmt(a.weekendPremium)}</p>
                  <p className="text-xs text-gray-400 mt-0.5">
                    {a.weekendHours}h at {fmt(a.weekendAvgRate)}/hr vs {fmt(a.weekdayRate)}/hr weekday
                  </p>
                </div>
                <div className="bg-white rounded-lg p-3 border border-orange-100">
                  <p className="text-xs text-gray-500">Short Shift Premium (≤2h)</p>
                  <p className="text-xl font-bold text-amber-600">{fmt(Math.max(0, a.shortPremium))}</p>
                  <p className="text-xs text-gray-400 mt-0.5">
                    {a.shortShifts} shifts · {a.shortHours}h at {fmt(a.shortRate)}/hr vs {fmt(a.longRate)}/hr
                  </p>
                </div>
                <div className="bg-white rounded-lg p-3 border border-orange-100">
                  <p className="text-xs text-gray-500">Unfilled Shift Exposure</p>
                  <p className="text-xl font-bold text-orange-600">{fmt(a.pendingCost)}</p>
                  <p className="text-xs text-gray-400 mt-0.5">
                    {a.pending} shifts unbooked · {a.pendingHours}h undelivered
                  </p>
                </div>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Weekend Analysis */}
      <SectionToggle title="Weekend vs Weekday Cost" icon={Calendar} defaultOpen badge={fmt(a.weekendPremium) + ' premium'} badgeColor="bg-red-100 text-red-700">
        <div className="mt-2 space-y-2">
          <div className="grid grid-cols-3 gap-4 mb-4">
            {[
              { label: 'Weekday', ...a.dayBuckets.weekday, color: 'bg-blue-500' },
              { label: 'Saturday', ...a.dayBuckets.saturday, color: 'bg-amber-500' },
              { label: 'Sunday', ...a.dayBuckets.sunday, color: 'bg-red-500' },
            ].map(d => (
              <div key={d.label} className="bg-gray-50 rounded-lg p-3">
                <p className="text-xs text-gray-500">{d.label}</p>
                <p className="text-lg font-bold text-gray-900">{fmt(d.cost)}</p>
                <p className="text-xs text-gray-400">{d.h}h · {d.h > 0 ? fmt(r2(d.cost / d.h)) + '/hr' : '—'}</p>
                <div className="mt-2 bg-gray-200 rounded-full h-1.5">
                  <div className={`${d.color} h-1.5 rounded-full`} style={{ width: pct(d.h, a.totalHours) }} />
                </div>
                <p className="text-xs text-gray-400 mt-0.5">{pct(d.h, a.totalHours)} of hours</p>
              </div>
            ))}
          </div>
          <div className="bg-blue-50 rounded-lg p-3 text-sm">
            <p className="font-medium text-blue-900">Rostering Recommendation</p>
            <p className="text-blue-700 mt-1">
              Weekend shifts cost <strong>{fmt(r2(a.weekendAvgRate - a.weekdayRate))}/hr more</strong> on average.
              Where care needs allow flexibility, shifting activities to weekdays saves the most.
              For SIL clients with 24/7 care obligations, explore whether any community activities or
              therapy sessions can be scheduled Mon–Fri to reduce weekend hours billed.
            </p>
          </div>
        </div>
      </SectionToggle>

      {/* Short Shift Analysis */}
      <SectionToggle
        title="Short Shift Efficiency (≤2h)"
        icon={Clock}
        badge={`${a.shortShifts} shifts · ${fmt(Math.max(0, a.shortPremium))} premium`}
        badgeColor="bg-amber-100 text-amber-700"
      >
        <div className="mt-2 space-y-3">
          <div className="grid grid-cols-2 gap-4">
            <div className="bg-amber-50 rounded-lg p-3">
              <p className="text-xs text-gray-500">Short shifts (≤2h)</p>
              <p className="text-lg font-bold">{a.shortShifts} shifts</p>
              <p className="text-xs text-gray-400">{a.shortHours}h · {fmt(a.shortRate)}/hr avg · {fmt(a.shortCost)} total</p>
            </div>
            <div className="bg-green-50 rounded-lg p-3">
              <p className="text-xs text-gray-500">Long shifts (≥4h) avg rate</p>
              <p className="text-lg font-bold">{fmt(a.longRate)}/hr</p>
              <p className="text-xs text-gray-400">Consolidating short shifts = {fmt(Math.max(0, a.shortPremium))} saved</p>
            </div>
          </div>
          <div className="bg-blue-50 rounded-lg p-3 text-sm">
            <p className="font-medium text-blue-900">Rostering Recommendation</p>
            <p className="text-blue-700 mt-1">
              Short standalone shifts attract a higher effective rate due to minimum engagement rules.
              Where two clients are in the same area, <strong>combine visits into 3–4h blocks</strong> or
              link with community access shifts. Aim for minimum 3h shifts for non-SIL clients.
            </p>
          </div>
        </div>
      </SectionToggle>

      {/* High Intensity Analysis */}
      <SectionToggle
        title="High Intensity vs Standard Rate Mix"
        icon={BarChart2}
        badge={`$${a.hiRate}/hr vs $${a.stdRate}/hr`}
        badgeColor="bg-purple-100 text-purple-700"
      >
        <div className="mt-2 space-y-2">
          <BarRow label="High Intensity" value={a.hiCost} maxValue={a.totalCost} rate={a.hiRate} color="bg-purple-500" />
          <BarRow label="Standard" value={a.stdCost} maxValue={a.totalCost} rate={a.stdRate} color="bg-blue-400" />
          <div className="mt-3 bg-blue-50 rounded-lg p-3 text-sm">
            <p className="font-medium text-blue-900">Insight</p>
            <p className="text-blue-700 mt-1">
              High-intensity supports ({a.hiH}h) cost <strong>{fmt(a.hiRate)}/hr vs {fmt(a.stdRate)}/hr</strong> for standard.
              Ensure all high-intensity claims are clinically justified. If a participant's support needs have reduced,
              review whether reclassification to standard rate is appropriate — this is the largest per-hour lever.
            </p>
          </div>
        </div>
      </SectionToggle>

      {/* Staff Fragmentation */}
      <SectionToggle
        title="Staff Fragmentation per Client"
        icon={Users}
        badge={`${a.highFragClients.length} clients with 5+ workers`}
        badgeColor="bg-amber-100 text-amber-700"
      >
        <div className="mt-2">
          <p className="text-sm text-gray-500 mb-3">
            High staff rotation increases handover time, inconsistent care quality, and travel overhead.
            Target: ≤4 regular workers per SIL client, ≤2 for community access clients.
          </p>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Client</TableHead>
                <TableHead className="text-right">Workers</TableHead>
                <TableHead className="text-right">Total Cost</TableHead>
                <TableHead className="text-right">Hours</TableHead>
                <TableHead className="text-right">Avg Rate</TableHead>
                <TableHead className="text-right">Weekend %</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {a.highFragClients.map(c => (
                <TableRow key={c.name}>
                  <TableCell className="font-medium">{c.name}</TableCell>
                  <TableCell className="text-right">
                    <span className={`font-bold ${c.staffCount >= 10 ? 'text-red-600' : c.staffCount >= 7 ? 'text-amber-600' : 'text-gray-800'}`}>
                      {c.staffCount}
                    </span>
                  </TableCell>
                  <TableCell className="text-right">{fmt(c.cost)}</TableCell>
                  <TableCell className="text-right">{c.hours}h</TableCell>
                  <TableCell className="text-right">{fmt(c.avgRate)}/hr</TableCell>
                  <TableCell className="text-right">
                    <span className={c.weekendPct > 40 ? 'text-red-600 font-medium' : 'text-gray-600'}>
                      {c.weekendPct}%
                    </span>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      </SectionToggle>

      {/* Time Period Breakdown */}
      <SectionToggle title="Cost by Time Period" icon={Clock} defaultOpen={false}>
        <div className="mt-2 space-y-2">
          {[
            { label: 'AM (06:00–14:00)', ...a.timeBuckets.am, color: 'bg-sky-400' },
            { label: 'PM (14:00–22:00)', ...a.timeBuckets.pm, color: 'bg-indigo-400' },
            { label: 'Night (22:00–06:00)', ...a.timeBuckets.night, color: 'bg-slate-600' },
            { label: 'Sleepover', ...a.timeBuckets.sleepover, color: 'bg-slate-400' },
            { label: 'Other', ...a.timeBuckets.other, color: 'bg-gray-300' },
          ].filter(b => b.cost > 0).map(b => (
            <BarRow
              key={b.label}
              label={b.label}
              value={b.cost}
              maxValue={a.totalCost}
              rate={b.h > 0 ? r2(b.cost / b.h) : 0}
              color={b.color}
            />
          ))}
          <div className="mt-3 bg-blue-50 rounded-lg p-3 text-sm">
            <p className="font-medium text-blue-900">Rostering Recommendation</p>
            <p className="text-blue-700 mt-1">
              Night and PM rates attract loading. Where a participant's routine allows flexibility,
              scheduling supports in AM blocks reduces the per-hour bill rate. Sleepover rate (fixed per night)
              is most cost-effective for overnight coverage — ensure sleepover is used where clinically appropriate
              instead of an active night shift.
            </p>
          </div>
        </div>
      </SectionToggle>

      {/* Client Breakdown */}
      <SectionToggle title="Cost by Client" icon={DollarSign} defaultOpen={false}>
        <div className="mt-2 overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Client</TableHead>
                <TableHead className="text-right">Total Cost</TableHead>
                <TableHead className="text-right">Hours</TableHead>
                <TableHead className="text-right">Avg Rate</TableHead>
                <TableHead className="text-right">Workers</TableHead>
                <TableHead className="text-right">Weekend %</TableHead>
                <TableHead>Flags</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {a.clientRows.map(c => {
                const flags = [];
                if (c.staffCount >= 10) flags.push('high fragmentation');
                if (c.weekendPct > 50) flags.push('weekend heavy');
                if (c.avgRate > 80) flags.push('high rate');
                return (
                  <TableRow key={c.name}>
                    <TableCell className="font-medium">{c.name}</TableCell>
                    <TableCell className="text-right font-medium">{fmt(c.cost)}</TableCell>
                    <TableCell className="text-right text-gray-600">{c.hours}h</TableCell>
                    <TableCell className="text-right">
                      <span className={c.avgRate > 80 ? 'text-red-600 font-medium' : 'text-gray-800'}>
                        {fmt(c.avgRate)}/hr
                      </span>
                    </TableCell>
                    <TableCell className="text-right text-gray-600">{c.staffCount}</TableCell>
                    <TableCell className="text-right">
                      <span className={c.weekendPct > 40 ? 'text-amber-600' : 'text-gray-500'}>
                        {c.weekendPct}%
                      </span>
                    </TableCell>
                    <TableCell>
                      <div className="flex flex-wrap gap-1">
                        {flags.map(f => <InefficientTag key={f} label={f} />)}
                      </div>
                    </TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
        </div>
      </SectionToggle>

      {/* Rate Group Breakdown */}
      <SectionToggle title="Cost by NDIS Rate Group" icon={BarChart2} defaultOpen={false}>
        <div className="mt-2 space-y-1.5">
          {a.rateGroupRows.slice(0, 20).map(rg => (
            <BarRow
              key={rg.name}
              label={rg.name.replace(/^01\s+/i, '').replace(/^04\s+/i, 'Comm: ').substring(0, 40)}
              value={rg.cost}
              maxValue={a.rateGroupRows[0]?.cost || 1}
              rate={rg.rate}
              color="bg-blue-400"
            />
          ))}
        </div>
      </SectionToggle>

      {/* Staff Profitability — wage basis + data */}
      <StaffProfitabilitySection
        sa={staffAnalysis}
        payrollMap={effectiveCostMap}
        payrollName={effectiveCostLabel}
        payrollLoading={payrollLoading}
        payrollError={payrollError}
        payrollDz={payrollDz}
        onRemovePayroll={() => { setPayrollMap(null); setPayrollName(''); }}
        wageSource={wageSource}
        onWageSourceChange={setWageSource}
        awardRatesDz={awardRatesDz}
        awardRatesLoading={awardRatesLoading}
        awardRatesError={awardRatesError}
        awardRatesName={awardRatesName}
        onRemoveAwardRates={() => {
          setLocalAwardRatesMap(null);
          setAwardRatesName('');
          setAwardRatesError('');
        }}
        superPct={superPct}
        onSuperPctChange={setSuperPct}
        awardDefaultRate={awardDefaultRate}
        onAwardDefaultRateChange={setAwardDefaultRate}
        awardEmpType={awardEmpType}
        onAwardEmpTypeChange={setAwardEmpType}
        payHoursCount={payHoursRows.length}
        payHoursPeriodText={payHoursPeriodText}
        usingHubRates={usingHubRates}
      />

      {/* Recommendations Summary */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Info className="w-4 h-4 text-blue-500" />
            Rostering Improvement Recommendations
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            {[
              {
                rank: 1,
                title: 'Shift weekendable activities to weekdays',
                saving: a.weekendPremium,
                detail: `${a.weekendHours}h of weekend shifts cost ${fmt(r2(a.weekendAvgRate - a.weekdayRate))}/hr more.
                  Community access, therapy, and social activities should default to weekdays.
                  Only necessary care and SIL obligations should fall on weekends.`,
                color: 'border-red-300 bg-red-50',
                label: 'HIGH IMPACT',
                labelColor: 'text-red-600 bg-red-100',
              },
              {
                rank: 2,
                title: 'Consolidate short shifts into longer blocks',
                saving: Math.max(0, a.shortPremium),
                detail: `${a.shortShifts} shifts of ≤2h are billed at ${fmt(a.shortRate)}/hr vs ${fmt(a.longRate)}/hr for longer shifts.
                  Group nearby clients on the same route into 3–4h back-to-back shifts.
                  Use the same worker for sequential clients to eliminate minimum engagement cost.`,
                color: 'border-amber-300 bg-amber-50',
                label: 'MEDIUM IMPACT',
                labelColor: 'text-amber-600 bg-amber-100',
              },
              {
                rank: 3,
                title: 'Fill pending / unfilled shifts urgently',
                saving: a.pendingCost,
                detail: `${a.pending} shifts worth ${fmt(a.pendingCost)} are unbooked.
                  Unfilled shifts create last-minute casual callouts (higher rates), participant dissatisfaction,
                  and potential compliance issues. Build a per-client on-call pool of 2–3 regular backups.`,
                color: 'border-orange-300 bg-orange-50',
                label: 'URGENT',
                labelColor: 'text-orange-600 bg-orange-100',
              },
              {
                rank: 4,
                title: 'Reduce staff fragmentation for high-cost clients',
                saving: null,
                detail: `Clients like Duy Nguyen (17 workers) and Mohammed Sunny Manikam (14 workers) have extreme fragmentation.
                  Each handover adds unproductive overlap time and travel.
                  Assign 3–5 primary workers per SIL client with consistent shift patterns.
                  This also improves care quality and reduces incident risk.`,
                color: 'border-blue-300 bg-blue-50',
                label: 'QUALITY + COST',
                labelColor: 'text-blue-600 bg-blue-100',
              },
              {
                rank: 5,
                title: 'Review sleepover vs active night classification',
                saving: null,
                detail: `Sleepover rate (fixed allowance per night) is significantly cheaper than active night shifts for participants
                  who don't need regular overnight support. Review each night shift in the roster —
                  if the worker is primarily on standby, a sleepover classification may be appropriate and compliant.`,
                color: 'border-slate-300 bg-slate-50',
                label: 'REVIEW',
                labelColor: 'text-slate-600 bg-slate-100',
              },
            ].map(rec => (
              <div key={rec.rank} className={`rounded-lg border p-4 ${rec.color}`}>
                <div className="flex items-start justify-between gap-4">
                  <div className="flex-1">
                    <div className="flex items-center gap-2 mb-1">
                      <span className="text-xs font-bold text-gray-400">#{rec.rank}</span>
                      <span className={`text-xs font-bold px-2 py-0.5 rounded ${rec.labelColor}`}>{rec.label}</span>
                      <p className="font-semibold text-gray-800">{rec.title}</p>
                    </div>
                    <p className="text-sm text-gray-600">{rec.detail}</p>
                  </div>
                  {rec.saving !== null && (
                    <div className="text-right shrink-0">
                      <p className="text-xs text-gray-400">Est. saving</p>
                      <p className="text-lg font-bold text-green-700">{fmt(rec.saving)}</p>
                    </div>
                  )}
                </div>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
