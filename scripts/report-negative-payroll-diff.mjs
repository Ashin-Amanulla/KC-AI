/**
 * For each person where calculator gross < payroll (negative Diff in UI),
 * writes a markdown file with data-driven reasons.
 *
 * Run: node scripts/report-negative-payroll-diff.mjs [scheduler.csv] [payroll.xlsx] [staff-rates.xlsx] [out.md]
 * If only 3 args and arg3 is .md, it is the output path (no staff rates file).
 * Staff rates: same SCHADS sheet as SchadsCalculator. Env: SCHADS_RATES_XLSX
 */
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { createRequire } from 'module';
const require = createRequire(import.meta.url);
const XLSX = require('../frontend/node_modules/xlsx/xlsx.js');
import { parseShiftCsvBuffer, detectBrokenShifts } from '../backend/modules/shifts/shiftCsvParser.js';
import { computePayHoursForStaff } from '../backend/modules/pay-hours/services/payHoursCalculator.js';
import { calcGross, calcGrossFromRates, normName, r2, VEHICLE_RATE } from '../frontend/src/lib/schadsWageCalc.js';
import { loadStaffRatesMap } from './lib/staffRatesFromXlsx.mjs';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const DEFAULT_CSV = '/home/cntrlx/Downloads/Scheduler_Timesheet_Export_2026-04-24-01-37.csv';
const DEFAULT_XLSX = '/home/cntrlx/Downloads/Payroll Employee Summary - FN ending 19th April (2).xlsx';
const DEFAULT_OUT = path.join(__dirname, 'output', 'payroll-negative-diff-reasons.md');

const TEST_BASE = 35;

/** Resolve [csv, payroll, ?rates, ?out] from argv */
function parseReportArgs() {
  const a = process.argv.slice(2);
  const envRates = process.env.SCHADS_RATES_XLSX;
  if (a.length === 0) {
    return { csvPath: DEFAULT_CSV, xlsxPath: DEFAULT_XLSX, staffRatesXlsx: envRates, outPath: DEFAULT_OUT };
  }
  if (a.length === 1) {
    return { csvPath: a[0], xlsxPath: DEFAULT_XLSX, staffRatesXlsx: envRates, outPath: DEFAULT_OUT };
  }
  if (a.length === 2) {
    return { csvPath: a[0], xlsxPath: a[1], staffRatesXlsx: envRates, outPath: DEFAULT_OUT };
  }
  if (a.length === 3) {
    const third = a[2];
    if (/\.(md|markdown)$/i.test(third)) {
      return { csvPath: a[0], xlsxPath: a[1], staffRatesXlsx: envRates, outPath: path.resolve(third) };
    }
    return { csvPath: a[0], xlsxPath: a[1], staffRatesXlsx: third, outPath: DEFAULT_OUT };
  }
  return { csvPath: a[0], xlsxPath: a[1], staffRatesXlsx: a[2], outPath: a[3] ? path.resolve(a[3]) : DEFAULT_OUT };
}

function parseCsvLine(line) {
  const result = [];
  let current = '';
  let inQuotes = false;
  for (let i = 0; i < line.length; i++) {
    const ch = line[i];
    if (ch === '"') {
      if (inQuotes && line[i + 1] === '"') {
        current += '"';
        i++;
      } else inQuotes = !inQuotes;
    } else if (ch === ',' && !inQuotes) {
      result.push(current);
      current = '';
    } else current += ch;
  }
  result.push(current);
  return result;
}

function loadPayrollMap(buf) {
  const wb = XLSX.read(buf, { type: 'buffer' });
  const ws = wb.Sheets[wb.SheetNames[0]];
  const rows = XLSX.utils.sheet_to_json(ws, { header: 1, defval: '' });
  let headerIdx = -1;
  for (let i = 0; i < rows.length; i++) {
    const r = rows[i].map((c) => c?.toString().toLowerCase());
    if (r.includes('employee') && r.includes('earnings')) {
      headerIdx = i;
      break;
    }
  }
  if (headerIdx < 0) throw new Error('No Employee + Earnings header row in payroll xlsx');
  const headers = rows[headerIdx].map((c) => c?.toString().toLowerCase());
  const empIdx = headers.indexOf('employee');
  const earnIdx = headers.indexOf('earnings');
  if (empIdx < 0 || earnIdx < 0) throw new Error('Need Employee and Earnings columns');
  const map = new Map();
  for (let i = headerIdx + 1; i < rows.length; i++) {
    const name = rows[i][empIdx]?.toString().trim();
    const earn = parseFloat(rows[i][earnIdx]);
    if (!name || isNaN(earn) || earn <= 0) continue;
    const nl = name.toLowerCase();
    if (nl === 'total' || nl === 'totals' || nl === 'subtotal' || nl === 'summary') continue;
    map.set(normName(name), { name, earnings: earn });
  }
  return map;
}

function staffColumnIndex(headerLine) {
  const parts = parseCsvLine(headerLine).map((h) => h.trim().toLowerCase());
  const idx = parts.findIndex((h) => h === 'staff name' || h === 'staff' || h.includes('staff name'));
  return idx >= 0 ? idx : 0;
}

function errorsByNormStaff(errors, csvPath) {
  const text = fs.readFileSync(csvPath, 'utf-8').replace(/^\uFEFF/, '');
  const lines = text.split(/\r?\n/);
  if (lines.length < 2) return new Map();
  const staffCol = staffColumnIndex(lines[0]);
  const map = new Map();
  for (const e of errors) {
    const m = e.match(/^Row (\d+):\s*(.*)$/);
    if (!m) continue;
    const rowNum = parseInt(m[1], 10);
    const rest = m[2];
    if (rowNum < 2 || rowNum > lines.length) continue;
    const values = parseCsvLine(lines[rowNum - 1]);
    const name = (values[staffCol] || '').trim();
    if (!name) continue;
    const k = normName(name);
    if (!map.has(k)) map.set(k, []);
    map.get(k).push(rest);
  }
  return map;
}

function totalPhHours(d) {
  return r2(
    (d.morningHours || 0) +
      (d.afternoonHours || 0) +
      (d.nightHours || 0) +
      (d.weekdayOtUpto2 || 0) +
      (d.weekdayOtAfter2 || 0) +
      (d.saturdayHours || 0) +
      (d.saturdayOtUpto2 || 0) +
      (d.saturdayOtAfter2 || 0) +
      (d.sundayHours || 0) +
      (d.sundayOtUpto2 || 0) +
      (d.sundayOtAfter2 || 0) +
      (d.holidayHours || 0) +
      (d.holidayOtUpto2 || 0) +
      (d.holidayOtAfter2 || 0) +
      (d.nursingCareHours || 0) +
      (d.otAfter76Weekday || 0) +
      (d.otAfter76Saturday || 0) +
      (d.otAfter76Sunday || 0) +
      (d.otAfter76Holiday || 0)
  );
}

function main() {
  const { csvPath, xlsxPath, staffRatesXlsx, outPath } = parseReportArgs();
  const ratesFile =
    staffRatesXlsx && fs.existsSync(staffRatesXlsx) ? staffRatesXlsx : null;

  if (!fs.existsSync(csvPath)) {
    console.error('CSV not found:', csvPath);
    process.exit(1);
  }
  if (!fs.existsSync(xlsxPath)) {
    console.error('XLSX not found:', xlsxPath);
    process.exit(1);
  }
  fs.mkdirSync(path.dirname(outPath), { recursive: true });

  let staffRatesMap = new Map();
  if (ratesFile) {
    staffRatesMap = loadStaffRatesMap(fs.readFileSync(ratesFile), { normName, r2, VEHICLE_RATE });
  }

  const { shifts: raw, errors } = parseShiftCsvBuffer(fs.readFileSync(csvPath));
  const byStaffErr = errorsByNormStaff(errors, csvPath);
  const shifts = detectBrokenShifts(raw);
  let n = 0;
  for (const s of shifts) s._id = s._id || `csv-${++n}`;

  const min = shifts.length ? new Date(Math.min(...shifts.map((s) => +s.startDatetime))) : null;
  const max = shifts.length ? new Date(Math.max(...shifts.map((s) => +s.endDatetime))) : null;

  const byStaff = new Map();
  for (const s of shifts) {
    if (!byStaff.has(s.staffName)) byStaff.set(s.staffName, []);
    byStaff.get(s.staffName).push(s);
  }
  for (const arr of byStaff.values()) arr.sort((a, b) => a.startDatetime - b.startDatetime);

  const holidaySet = new Set();
  const payRows = [];
  for (const [staffName, staffShifts] of byStaff.entries()) {
    const { data } = computePayHoursForStaff(staffShifts, holidaySet);
    const totalKm = staffShifts.reduce((sum, x) => sum + (x.mileage || 0), 0);
    const ph = { ...data, totalKm, staffName };
    const k = normName(staffName);
    const staffRates = staffRatesMap.get(k) ?? null;
    const gross = staffRates ? calcGrossFromRates(ph, staffRates) : calcGross(ph, String(TEST_BASE), 'casual');
    const th = totalPhHours(data);
    payRows.push({ staffName, ph, gross, th, fromRates: !!staffRates });
  }
  payRows.sort((a, b) => a.staffName.localeCompare(b.staffName));

  const payroll = loadPayrollMap(fs.readFileSync(xlsxPath));
  const payrollKeys = new Set(payroll.keys());
  const payRowKeys = new Set(payRows.map((r) => normName(r.staffName)));
  let nameOnlyCsv = 0;
  let nameOnlyPayroll = 0;
  for (const k of payRowKeys) if (!payrollKeys.has(k)) nameOnlyCsv++;
  for (const k of payrollKeys) if (!payRowKeys.has(k)) nameOnlyPayroll++;

  const negative = [];
  for (const r of payRows) {
    const k = normName(r.staffName);
    if (!payroll.has(k)) continue;
    const p = payroll.get(k);
    const diff = r2((r.gross || 0) - p.earnings);
    if (diff >= 0) continue;
    const pct = r.gross && r.gross > 0 ? r2((diff / r.gross) * 100) : null;
    negative.push({ ...r, payrollEarnings: p.earnings, diff, pct, k });
  }
  negative.sort((a, b) => a.diff - b.diff);

  const lines = [];
  lines.push('# Payroll vs calculator: negative difference (Gross < Payroll)');
  lines.push('');
  lines.push('**Negative difference** = this report’s *Gross* minus *Payroll* is **&lt; 0** (calculator lower than imported payroll).');
  lines.push('');
  const ratesSummary = ratesFile
    ? `**Gross** uses \`calcGrossFromRates\` per employee when a row exists in the staff rates file (**\`${ratesFile}\`**, \`${staffRatesMap.size}\` people); otherwise \`calcGross\` at **$${TEST_BASE}/h casual** — same pattern as **SchadsCalculator** / \`scripts/audit-calculator-vs-payroll.mjs\` with a rates arg.`
    : `**Gross** uses only \`calcGross\` with a flat **$${TEST_BASE}/h casual** base (no staff-rates .xlsx passed; set 3rd arg or \`SCHADS_RATES_XLSX\` to match the live calculator with imported rates).`;
  const fromRatesN = payRows.filter((r) => r.fromRates).length;
  lines.push('## Assumptions in this report');
  lines.push('');
  lines.push(`- **Scheduler file:** \`${csvPath}\``);
  lines.push(`- **Payroll file:** \`${xlsxPath}\``);
  lines.push(`- ${ratesSummary}`);
  lines.push(`- **Gross from staff rates (matched names):** ${fromRatesN} / ${payRows.length} staff; **flat fallback:** ${payRows.length - fromRatesN} staff.`);
  lines.push(`- **Roster date span (included shifts):** ${min ? min.toISOString() : '—'} → ${max ? max.toISOString() : '—'}`);
  const staffWithParseErrors = negative.filter((b) => (byStaffErr.get(b.k)?.length || 0) > 0).length;
  lines.push(
    `- **Parse issues:** ${errors.length} row message(s); **${staffWithParseErrors}** of the people below have at least one failed CSV row attributed to their name.`
  );
  lines.push('');
  lines.push('---');
  lines.push('');
  const negWithRates = negative.filter((x) => x.fromRates).length;
  const negNoRates = negative.length - negWithRates;
  lines.push('## Summary — why Gross can still be below Payroll');
  lines.push('');
  lines.push(
    `- **This run:** **${negative.length}** matched people with **Gross &lt; Payroll** — **${negWithRates}** use **per-staff rates** (\`calcGrossFromRates\`); **${negNoRates}** have **no** rates row (still on **$${TEST_BASE}/h** fallback)${ratesFile ? ` — add/fix names in \`${ratesFile}\` for them` : ''}.`
  );
  lines.push(
    `- **Name alignment:** **${nameOnlyCsv}** staff in the **scheduler CSV** have **no** payroll earnings row (strings differ, e.g. nicknames); **${nameOnlyPayroll}** payroll people are **not** in this CSV — comparisons and sums will not line up until names match.`
  );
  lines.push(
    `- **CSV parse:** **${errors.length}** row(s) dropped (e.g. unknown shift type) — if those hours matter, add them to \`SHIFT_TYPE_MAP\` or they stay out of **all** staff hours.`
  );
  lines.push(
    `- **Scope:** Roster window (above) vs payroll fortnight may differ; payroll can include **leave, back pay, allowances not in the rates columns, on-call**, etc., which this engine does not add automatically.`
  );
  lines.push(
    `- **Even with correct rates:** if **Payroll ÷ hours** is still far above **Gross ÷ hours** (see each table), payroll is paying **more per hour** than the rate grid in the file for that run — check the pay run detail, not only the rate export.`
  );
  lines.push('');
  lines.push('---');
  lines.push('');

  if (!negative.length) {
    lines.push('No matched staff with Gross &lt; Payroll for these inputs.');
  } else {
    lines.push(`## People (${negative.length})`);
    lines.push('');
    for (const m of negative) {
      const impliedPayroll = m.th > 0 ? r2(m.payrollEarnings / m.th) : null;
      const impliedCalc = m.th > 0 ? r2((m.gross || 0) / m.th) : null;
      const ph = m.ph;
      const band =
        (ph.morningHours || 0) + (ph.afternoonHours || 0) + (ph.nightHours || 0) > 0
          ? r2(
              ((ph.afternoonHours || 0) + (ph.nightHours || 0)) /
                ((ph.morningHours || 0) + (ph.afternoonHours || 0) + (ph.nightHours || 0) || 1)
            ) * 100
          : 0;
      lines.push(`### ${m.staffName}`);
      lines.push('');
      lines.push('| Field | Value |');
      lines.push('| --- | --- |');
      lines.push(`| Payroll (import) | $${m.payrollEarnings.toFixed(2)} |`);
      lines.push(`| Gross (this report) | $${(m.gross || 0).toFixed(2)} |`);
      lines.push(`| Diff (Gross − Payroll) | **$${m.diff.toFixed(2)}** (${m.pct != null ? m.pct + '%' : 'n/a'} of gross) |`);
      lines.push(`| Pay-hours total (excl. sleepover allowance hours in total) | ${m.th} h |`);
      if (impliedPayroll != null && impliedCalc != null) {
        lines.push(
          `| Implied $/h (Payroll ÷ pay-hours) | ~$${impliedPayroll.toFixed(2)}/h |`
        );
        const calcLbl = m.fromRates
          ? 'from per-staff rates xlsx'
          : `at $${TEST_BASE} casual default`;
        lines.push(
          `| Implied $/h (Gross ÷ pay-hours) | ~$${impliedCalc.toFixed(2)}/h (${calcLbl}) |`
        );
      }
      lines.push(`| Staff rates row in xlsx? | **${m.fromRates ? 'Yes' : 'No'}** (normName match) |`);
      lines.push(
        `| Weekday band mix (afternoon+night share of m+a+n) | ${band.toFixed(0)}% |`
      );
      lines.push('');
      lines.push('**Why Gross is below Payroll (most likely first)**');
      lines.push('');
      const rs = [];
      if (!m.fromRates) {
        rs.push(
          `**No staff-rates match** for this name — this report used **$${TEST_BASE}/h** casual \`calcGross\` for them. If the calculator in the app shows a rate from your rates XLSX, **re-run** with the same \`[staff-rates.xlsx]\` so gross matches.`
        );
      } else {
        rs.push(
          '**Gross** used **\`calcGrossFromRates\`** from the staff-rates xlsx. Remaining gap vs payroll is usually **period/scope** (roster vs FN), **extra pay lines** in payroll, or **name spelling** (rates row is a different person).'
        );
      }
      if (impliedPayroll != null && impliedCalc != null && impliedPayroll > impliedCalc + 0.5) {
        const tail = m.fromRates
          ? '**items in payroll** not in the formula (e.g. leave, allowances outside sheet), or **rate column mismatch** (export not same as pay run).'
          : '**higher** rates in payroll than a **$' + TEST_BASE + '** casual build, or **items not modelled** in the flat build.';
        rs.push(
          `**Implied rate gap:** payroll ~$${impliedPayroll.toFixed(2)}/h vs gross ~$${impliedCalc.toFixed(2)}/h across these hours — ${tail}`
        );
      }
      if (min && max) {
        rs.push(
          `**Period / scope:** roster span may not match the payroll fortnight; payroll can include **leave, adjustments, on-call, or other lines** not in the scheduler CSV.`
        );
      }
      if (band > 40) {
        rs.push(
          `**High afternoon/night share (${band.toFixed(0)}%)** — more penalty loading; small errors in **band split** (or sleepover follow-on) change dollars; payroll may use different treatment.`
        );
      }
      const personal = byStaffErr.get(m.k) || [];
      if (personal.length) {
        rs.push(
          `**CSV rows not imported for this name** (${personal.length}): ${personal.map((x) => `\`${x}\``).join('; ')} — **missing hours** in the calc would also lower Gross.`
        );
      } else {
        rs.push(
          '**No** parse-failed rows attributed to this staff name in the CSV error list (other staff may still have failed rows).'
        );
      }
      for (let i = 0; i < rs.length; i++) lines.push(`${i + 1}. ${rs[i]}`);
      lines.push('');
    }
  }

  const body = lines.join('\n');
  fs.writeFileSync(outPath, body, 'utf-8');
  console.log('Wrote', outPath, '| people with Gross < Payroll:', negative.length);
}

main();
