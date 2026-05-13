/**
 * Writes tmp/test/Scheduler_Timesheet_Export_SCHADS_RULES_FIXTURE.csv
 * Header matches ShiftCare export (backend/uploads/1778342728970-Scheduler_Timesheet_Export_2026-05-05-00-42.csv).
 */
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.join(__dirname, '..');
const outPath = path.join(root, 'tmp/test/Scheduler_Timesheet_Export_SCHADS_RULES_FIXTURE.csv');

const HEADER =
  'Shift ID,Name,Address,Staff,Staff ID,Start Date Time,End Date Time,Hours,Mileage,Expense,Absent,Shift Status,Cancelled Reason,Clockin Date Time,Clockout Date Time,Shift Type,Additional Shift Types,URL,Note';

function at(ymd, hour, minute = 0) {
  const [y, mo, d] = ymd.split('-').map(Number);
  const localMidnightUtc = Date.UTC(y, mo - 1, d, 0, 0, 0) - 10 * 3600000;
  return new Date(localMidnightUtc + hour * 3600000 + minute * 60000);
}

function toShiftCare(d) {
  const f = new Intl.DateTimeFormat('en-CA', {
    timeZone: 'Australia/Brisbane',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
    hour12: false,
  });
  const o = {};
  for (const x of f.formatToParts(d)) {
    if (x.type !== 'literal') o[x.type] = x.value;
  }
  return `${o.year}-${o.month}-${o.day} ${o.hour}:${o.minute}:${o.second} +1000`;
}

function r2(n) {
  return Math.round(n * 100) / 100;
}

function escapeCsv(s) {
  const t = String(s ?? '');
  if (/[,"\r\n]/.test(t)) return `"${t.replace(/"/g, '""')}"`;
  return t;
}

let nextId = 920000;

function row(staff, staffNum, name, address, start, end, shiftType, note, mileage = '0.0', hoursOverride = null) {
  const s = start instanceof Date ? start : new Date(start);
  const e = end instanceof Date ? end : new Date(end);
  const derived = r2((e - s) / 3600000);
  const hours = hoursOverride != null ? r2(Number(hoursOverride)) : derived;
  const id = String(++nextId);
  const cells = [
    id,
    escapeCsv(name),
    escapeCsv(address),
    escapeCsv(staff),
    staffNum,
    toShiftCare(s),
    toShiftCare(e),
    hours.toFixed(1),
    mileage,
    '0.0',
    'false',
    'invoiced',
    '',
    '',
    '',
    shiftType,
    '',
    `https://example.invalid/shift/${id}`,
    escapeCsv(note),
  ];
  return cells.join(',');
}

const rows = [];

// SCHADS Weekday Bands
rows.push(row('SCHADS Weekday Bands', '91001', 'TB01', '1 Test St Upper Mount Gravatt QLD', at('2026-04-02', 5, 0), at('2026-04-02', 13, 0), 'Personal Care', 'before 6am night band not PH'));
rows.push(row('SCHADS Weekday Bands', '91001', 'TB02', '1 Test St Upper Mount Gravatt QLD', at('2026-04-08', 9, 0), at('2026-04-08', 17, 0), 'Personal Care', '9am-5pm daytime'));
rows.push(row('SCHADS Weekday Bands', '91001', 'TB03', '1 Test St Upper Mount Gravatt QLD', at('2026-04-09', 12, 0), at('2026-04-09', 20, 0), 'Personal Care', 'ends 8pm daytime'));
rows.push(row('SCHADS Weekday Bands', '91001', 'TB04', '1 Test St Upper Mount Gravatt QLD', at('2026-04-10', 20, 0), at('2026-04-10', 22, 0), 'Personal Care', '8pm-10pm evening'));
rows.push(row('SCHADS Weekday Bands', '91001', 'TB05', '1 Test St Upper Mount Gravatt QLD', at('2026-04-14', 15, 30), at('2026-04-15', 0, 0), 'Personal Care', '330pm-midnight evening'));
rows.push(row('SCHADS Weekday Bands', '91001', 'MC01', '1 Test St Upper Mount Gravatt QLD', at('2026-04-18', 22, 0), at('2026-04-19', 2, 0), 'Personal Care', 'weekday overnight night'));
rows.push(row('SCHADS Weekday Bands', '91001', 'EV01', '1 Test St Upper Mount Gravatt QLD', at('2026-04-16', 14, 0), at('2026-04-16', 22, 0), 'Personal Care', '2pm-10pm evening whole shift'));
rows.push(row('SCHADS Weekday Bands', '91001', 'EV02', '1 Test St Upper Mount Gravatt QLD', at('2026-04-17', 11, 0), at('2026-04-17', 21, 0), 'Personal Care', '11am-9pm evening whole shift'));

// SCHADS Sat Sun PH
rows.push(row('SCHADS Sat Sun PH', '91002', 'DT01', '2 Test St Brisbane QLD', at('2026-04-11', 9, 0), at('2026-04-11', 17, 0), 'Personal Care', 'Saturday'));
rows.push(row('SCHADS Sat Sun PH', '91002', 'DT02', '2 Test St Brisbane QLD', at('2026-04-12', 9, 0), at('2026-04-12', 17, 0), 'Personal Care', 'Sunday'));
rows.push(row('SCHADS Sat Sun PH', '91002', 'DT03', '2 Test St Brisbane QLD', at('2026-04-07', 9, 0), at('2026-04-07', 17, 0), 'Personal Care', 'PH when holidaySet has 2026-04-07'));

// SCHADS Midnight
rows.push(row('SCHADS Midnight', '91003', 'MC2', '3 Test St Brisbane QLD', at('2026-04-10', 22, 0), at('2026-04-11', 2, 0), 'Personal Care', 'Fri 10pm-Sat 2am'));
rows.push(row('SCHADS Midnight', '91003', 'MC2b', '3 Test St Brisbane QLD', at('2026-04-23', 17, 30), at('2026-04-24', 1, 30), 'Personal Care', 'Thu 530pm-Fri 130am'));
rows.push(row('SCHADS Midnight', '91003', 'MC2c', '3 Test St Brisbane QLD', at('2026-04-10', 17, 30), at('2026-04-11', 1, 30), 'Personal Care', 'Fri 530pm-Sat 130am'));
rows.push(row('SCHADS Midnight', '91003', 'MC3', '3 Test St Brisbane QLD', at('2026-04-24', 22, 0), at('2026-04-25', 6, 0), 'Personal Care', 'into ANZAC PH holidaySet 2026-04-25'));
rows.push(row('SCHADS Midnight', '91003', 'MC4', '3 Test St Brisbane QLD', at('2026-04-25', 22, 0), at('2026-04-26', 8, 0), 'Personal Care', 'PH night into Sunday'));

// SCHADS Xmas Eve
rows.push(row('SCHADS Xmas Eve', '91004', 'CE01', '4 Test St Brisbane QLD', at('2026-12-24', 10, 0), at('2026-12-24', 13, 0), 'Personal Care', 'Dec24 morning'));
rows.push(row('SCHADS Xmas Eve', '91004', 'CE02', '4 Test St Brisbane QLD', at('2026-12-24', 16, 0), at('2026-12-24', 21, 0), 'Personal Care', 'Dec24 4pm-9pm'));
rows.push(row('SCHADS Xmas Eve', '91004', 'CE03', '4 Test St Brisbane QLD', at('2026-12-24', 22, 0), at('2026-12-25', 6, 0), 'Personal Care', 'Dec24 10pm-cross'));
rows.push(row('SCHADS Xmas Eve', '91004', 'CE04', '4 Test St Brisbane QLD', at('2026-12-24', 22, 0), at('2026-12-24', 23, 0), 'Personal Care', 'Dec24 10pm-11pm'));

// SCHADS Sleepover
rows.push(row('SCHADS Sleepover', '91005', 'SO01', '5 Test St Brisbane QLD', at('2026-05-30', 8, 0), at('2026-05-30', 16, 0), 'Sleepover', '8h SO no excess'));
rows.push(
  row(
    'SCHADS Sleepover',
    '91005',
    'SO02',
    '5 Test St Brisbane QLD',
    new Date('2026-06-01T22:00:00.000Z'),
    new Date('2026-06-02T07:00:00.000Z'),
    'Sleepover',
    '9h SO billable excess'
  )
);
rows.push(row('SCHADS Sleepover', '91005', 'SO03a', '5 Test St Brisbane QLD', at('2026-06-04', 20, 0), at('2026-06-05', 8, 0), 'Sleepover', '12h SO'));
rows.push(row('SCHADS Sleepover', '91005', 'SO03b', '5 Test St Brisbane QLD', at('2026-06-05', 8, 0), at('2026-06-05', 12, 0), 'Personal Care', 'PC after SO within 8h'));
rows.push(row('SCHADS Sleepover', '91005', 'SO04a', '5 Test St Brisbane QLD', at('2026-06-10', 20, 0), at('2026-06-11', 8, 0), 'Sleepover', '12h SO Jun10'));
rows.push(row('SCHADS Sleepover', '91005', 'SO04b', '5 Test St Brisbane QLD', at('2026-06-11', 17, 0), at('2026-06-11', 21, 0), 'Personal Care', 'PC 9h gap not attached'));

rows.push(row('SCHADS Sleepover', '91005', 'OOTa', '5 Test St Brisbane QLD', at('2026-06-05', 18, 0), at('2026-06-05', 22, 0), 'Personal Care', 'PC before SO'));
rows.push(row('SCHADS Sleepover', '91005', 'OOTb', '5 Test St Brisbane QLD', at('2026-06-05', 22, 0), at('2026-06-06', 6, 0), 'Sleepover', '8h SO'));
rows.push(row('SCHADS Sleepover', '91005', 'OOTc', '5 Test St Brisbane QLD', at('2026-06-06', 6, 0), at('2026-06-06', 12, 0), 'Personal Care', 'PC after SO no OT bridge'));

// SCHADS Turnaround A — st01 sleepover then 8h+ gap to afternoon PC
rows.push(row('SCHADS Turnaround A', '91061', 'ST01a', '6A Test St Brisbane QLD', at('2026-06-01', 22, 0), at('2026-06-02', 6, 0), 'Sleepover', 'SO'));
rows.push(row('SCHADS Turnaround A', '91061', 'ST01b', '6A Test St Brisbane QLD', at('2026-06-02', 14, 0), at('2026-06-02', 18, 0), 'Personal Care', '8h gap OK'));

// SCHADS Turnaround B — st02 under 8h after SO
rows.push(row('SCHADS Turnaround B', '91062', 'ST02a', '6B Test St Brisbane QLD', at('2026-06-03', 22, 0), at('2026-06-04', 6, 0), 'Sleepover', 'SO'));
rows.push(row('SCHADS Turnaround B', '91062', 'ST02b', '6B Test St Brisbane QLD', at('2026-06-04', 13, 0), at('2026-06-04', 17, 0), 'Personal Care', 'under 8h gap penalty'));

// SCHADS Turnaround C — st03 same day PC gap under 10h
rows.push(row('SCHADS Turnaround C', '91063', 'ST03a', '6C Test St Brisbane QLD', at('2026-06-05', 6, 0), at('2026-06-05', 10, 0), 'Personal Care', 'first'));
rows.push(row('SCHADS Turnaround C', '91063', 'ST03b', '6C Test St Brisbane QLD', at('2026-06-05', 19, 0), at('2026-06-05', 23, 0), 'Personal Care', 'second under 10h'));

// SCHADS Turnaround D — st04 chain
rows.push(row('SCHADS Turnaround D', '91064', 'ST04a', '6D Test St Brisbane QLD', at('2026-06-12', 18, 0), at('2026-06-12', 22, 0), 'Personal Care', 'pre SO'));
rows.push(row('SCHADS Turnaround D', '91064', 'ST04b', '6D Test St Brisbane QLD', at('2026-06-12', 22, 0), at('2026-06-13', 6, 0), 'Sleepover', 'SO'));
rows.push(row('SCHADS Turnaround D', '91064', 'ST04c', '6D Test St Brisbane QLD', at('2026-06-13', 6, 0), at('2026-06-13', 6, 30), 'Personal Care', 'post SO'));
rows.push(row('SCHADS Turnaround D', '91064', 'ST04d', '6D Test St Brisbane QLD', at('2026-06-13', 15, 0), at('2026-06-13', 20, 0), 'Personal Care', 'later day'));

// SCHADS Turnaround E — st05 short turnaround no double OT
rows.push(row('SCHADS Turnaround E', '91065', 'ST05a', '6E Test St Brisbane QLD', at('2026-06-14', 6, 0), at('2026-06-14', 6, 30), 'Personal Care', 'first'));
rows.push(row('SCHADS Turnaround E', '91065', 'ST05b', '6E Test St Brisbane QLD', at('2026-06-14', 15, 0), at('2026-06-14', 20, 0), 'Personal Care', 'second'));

// SCHADS Nursing
rows.push(row('SCHADS Nursing', '91007', 'NS01', '7 Test St Brisbane QLD', at('2026-04-08', 9, 0), at('2026-04-08', 17, 0), 'Nursing Support', 'weekday nursing Tue'));
rows.push(row('SCHADS Nursing', '91007', 'NS02', '7 Test St Brisbane QLD', at('2026-04-11', 9, 0), at('2026-04-11', 17, 0), 'Nursing Support', 'Saturday nursing'));
rows.push(row('SCHADS Nursing', '91007', 'NS03a', '7 Test St Brisbane QLD', at('2026-04-11', 23, 0), at('2026-04-12', 0, 0), 'Nursing Support', 'Sat-Sun split a'));
rows.push(row('SCHADS Nursing', '91007', 'NS03b', '7 Test St Brisbane QLD', at('2026-04-12', 0, 0), at('2026-04-12', 4, 0), 'Nursing Support', 'Sat-Sun split b'));

// SCHADS OT Meal
rows.push(row('SCHADS OT Meal', '91008', 'OT01', '8 Test St Brisbane QLD', at('2026-05-05', 9, 0), at('2026-05-05', 21, 0), 'Personal Care', 'weekday 12h OT meal', '12.5'));
rows.push(row('SCHADS OT Meal', '91008', 'OT02', '8 Test St Brisbane QLD', at('2026-04-12', 9, 0), at('2026-04-13', 0, 0), 'Personal Care', 'Sunday 15h OT meals'));
rows.push(row('SCHADS OT Meal', '91008', 'OT04', '8 Test St Brisbane QLD', at('2026-04-11', 9, 0), at('2026-04-11', 21, 0), 'Personal Care', 'Saturday 12h OT'));
rows.push(row('SCHADS OT Meal', '91008', 'OT05', '8 Test St Brisbane QLD', at('2026-05-06', 9, 0), at('2026-05-06', 22, 0), 'Personal Care', 'weekday 13h OT'));
rows.push(row('SCHADS OT Meal', '91008', 'OT06', '8 Test St Brisbane QLD', at('2026-04-25', 9, 0), at('2026-04-25', 22, 0), 'Personal Care', 'PH 13h ANZAC'));
rows.push(row('SCHADS OT Meal', '91008', 'OT07a', '8 Test St Brisbane QLD', at('2026-04-28', 22, 0), at('2026-04-29', 6, 0), 'Personal Care', 'overnight chain A'));
rows.push(row('SCHADS OT Meal', '91008', 'OT07b', '8 Test St Brisbane QLD', at('2026-04-29', 6, 0), at('2026-04-29', 12, 30), 'Personal Care', 'overnight chain B'));

// SCHADS Broken + 2-break same day
rows.push(row('SCHADS Broken', '91009', 'BR1a', '9 Test St Brisbane QLD', at('2026-05-12', 9, 0), at('2026-05-12', 14, 0), 'Personal Care', 'broken part1'));
rows.push(row('SCHADS Broken', '91009', 'BR1b', '9 Test St Brisbane QLD', at('2026-05-12', 14, 30), at('2026-05-12', 19, 30), 'Personal Care', 'broken part2'));
rows.push(row('SCHADS Broken', '91009', 'BR1c', '9 Test St Brisbane QLD', at('2026-05-12', 20, 0), at('2026-05-12', 22, 0), 'Personal Care', 'broken part3 two-break'));

// SCHADS LongSpan
rows.push(row('SCHADS LongSpan', '91010', 'LSa', '10 Test St Brisbane QLD', new Date('2026-03-11T21:00:00.000Z'), new Date('2026-03-12T01:00:00.000Z'), 'Personal Care', 'long span a'));
rows.push(row('SCHADS LongSpan', '91010', 'LSb', '10 Test St Brisbane QLD', new Date('2026-03-12T09:00:00.000Z'), new Date('2026-03-12T13:00:00.000Z'), 'Personal Care', 'long span b'));

// SCHADS Broken UTC — two PC same AU calendar day; gap <10h (CSV detectBrokenShifts)
rows.push(row('SCHADS Broken UTC', '91011', 'BUTCa', '11 Test St Brisbane QLD', new Date('2026-03-09T08:00:00.000Z'), new Date('2026-03-09T10:00:00.000Z'), 'Personal Care', 'AU Mon evening'));
rows.push(row('SCHADS Broken UTC', '91011', 'BUTCb', '11 Test St Brisbane QLD', new Date('2026-03-09T12:00:00.000Z'), new Date('2026-03-09T14:00:00.000Z'), 'Personal Care', 'AU Mon late gap under 10h'));

// SCHADS Cap76
for (let w = 0; w < 10; w++) {
  const start = new Date(Date.UTC(2026, 3, 7 + w * 7, 23, 0, 0));
  const end = new Date(start.getTime() + 8 * 3600000);
  rows.push(row('SCHADS Cap76', '91012', `C76_${w}`, '12 Test St Brisbane QLD', start, end, 'Personal Care', `cap76 ${w}`));
}

// SCHADS MinEngage
rows.push(row('SCHADS MinEngage', '91013', 'ME00', '13 Test St Brisbane QLD', at('2026-05-20', 9, 0), at('2026-05-20', 10, 0), 'Personal Care', '1h alone'));
rows.push(row('SCHADS MinEngage', '91013', 'MinEng ClientA', '13 Test St Brisbane QLD', at('2026-05-21', 9, 0), at('2026-05-21', 10, 0), 'Personal Care', '1h linked A'));
rows.push(row('SCHADS MinEngage', '91013', 'MinEng ClientA', '13 Test St Brisbane QLD', at('2026-05-21', 10, 0), at('2026-05-21', 11, 0), 'Personal Care', '1h linked B'));
rows.push(row('SCHADS MinEngage', '91013', 'MinEng ClientA', '13 Test St Brisbane QLD', at('2026-05-22', 6, 0), at('2026-05-22', 6, 30), 'Personal Care', '30m'));
rows.push(row('SCHADS MinEngage', '91013', 'MinEng ClientA', '13 Test St Brisbane QLD', at('2026-05-22', 7, 0), at('2026-05-22', 14, 30), 'Personal Care', '7.5h same client'));
rows.push(row('SCHADS MinEngage', '91013', 'MinEng ClientA', '13 Test St Brisbane QLD', at('2026-05-23', 9, 0), at('2026-05-23', 10, 0), 'Personal Care', 'unrelated A'));
rows.push(row('SCHADS MinEngage', '91013', 'MinEng ClientB', '13 Test St Brisbane QLD', at('2026-05-23', 14, 0), at('2026-05-23', 15, 0), 'Personal Care', 'unrelated B'));
rows.push(row('SCHADS MinEngage', '91013', 'ME04a', '13 Test St Brisbane QLD', at('2026-06-07', 20, 0), at('2026-06-07', 21, 0), 'Personal Care', 'pre SO'));
rows.push(row('SCHADS MinEngage', '91013', 'ME04b', '13 Test St Brisbane QLD', at('2026-06-07', 21, 0), at('2026-06-08', 6, 0), 'Sleepover', '9h SO'));
rows.push(row('SCHADS MinEngage', '91013', 'ME04c', '13 Test St Brisbane QLD', at('2026-06-08', 6, 0), at('2026-06-08', 6, 30), 'Personal Care', 'post SO short'));
rows.push(row('SCHADS MinEngage', '91013', 'ME05a', '13 Test St Brisbane QLD', at('2026-06-09', 18, 0), at('2026-06-09', 22, 0), 'Personal Care', '4h pre SO'));
rows.push(row('SCHADS MinEngage', '91013', 'ME05b', '13 Test St Brisbane QLD', at('2026-06-09', 22, 0), at('2026-06-10', 6, 0), 'Sleepover', 'SO'));
rows.push(row('SCHADS MinEngage', '91013', 'ME05c', '13 Test St Brisbane QLD', at('2026-06-10', 6, 0), at('2026-06-10', 6, 30), 'Personal Care', 'post SO 30m ok'));

// Negative CSV hours (parser uses timestamps)
rows.push(
  row('SCHADS NegHours', '91014', 'NH01', '14 Test St Brisbane QLD', at('2026-04-07', 20, 0), at('2026-04-08', 2, 0), 'Personal Care', 'negative hours column', '0.0', -18.0)
);

fs.mkdirSync(path.dirname(outPath), { recursive: true });
const out = `${HEADER}\n${rows.join('\n')}\n`;
fs.writeFileSync(outPath, out, 'utf8');
console.log('Wrote', outPath, 'data rows:', rows.length);
