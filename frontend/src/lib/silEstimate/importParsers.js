import { RATIO_PRESETS, WEEK_DAYS } from './constants.js';
import { computeHoursFromTime } from './calculations.js';

export function sheetToObjects(sheet, opts) {
  const XLSX = opts?.XLSX;
  if (!XLSX) throw new Error('XLSX required');
  const rowsArr = XLSX.utils.sheet_to_json(sheet, { header: 1, raw: true, defval: '', ...opts });
  const headerIdx = rowsArr.findIndex(
    (row) => Array.isArray(row) && row.filter((c) => String(c || '').trim() !== '').length >= 2
  );
  if (headerIdx === -1) return [];
  const headers = rowsArr[headerIdx].map((h) => String(h || '').trim());
  return rowsArr
    .slice(headerIdx + 1)
    .map((row) => {
      const obj = {};
      headers.forEach((h, i) => {
        if (h) obj[h] = row[i] !== undefined ? row[i] : '';
      });
      return obj;
    })
    .filter((obj) => Object.values(obj).some((v) => String(v).trim() !== ''));
}

const CSV_DAY_MAP = {
  monday: 'Mon',
  tuesday: 'Tue',
  wednesday: 'Wed',
  thursday: 'Thu',
  friday: 'Fri',
  saturday: 'Sat',
  sunday: 'Sun',
  mon: 'Mon',
  tue: 'Tue',
  wed: 'Wed',
  thu: 'Thu',
  fri: 'Fri',
  sat: 'Sat',
  sun: 'Sun',
};

export function getField(row, aliases) {
  if (!row) return '';
  const keys = Object.keys(row);
  for (const alias of aliases) {
    const found = keys.find((k) => k.trim().toLowerCase() === alias.toLowerCase());
    if (found) return row[found];
  }
  for (const alias of aliases) {
    const found = keys.find((k) => k.trim().toLowerCase().includes(alias.toLowerCase()));
    if (found) return row[found];
  }
  return '';
}

export function normalizeTimeString(raw) {
  if (raw === null || raw === undefined || raw === '') return '';
  if (raw instanceof Date) {
    return `${String(raw.getHours()).padStart(2, '0')}:${String(raw.getMinutes()).padStart(2, '0')}`;
  }
  const s = String(raw).trim();
  const ampm = /^(\d{1,2}):(\d{2})(?::\d{2})?\s*([AaPp][Mm])$/.exec(s);
  if (ampm) {
    let h = parseInt(ampm[1], 10);
    const m = ampm[2];
    const suffix = ampm[3].toUpperCase();
    if (suffix === 'AM') {
      if (h === 12) h = 0;
    } else if (h !== 12) {
      h += 12;
    }
    return `${String(h).padStart(2, '0')}:${m}`;
  }
  const plain = /^(\d{1,2}):(\d{2})/.exec(s);
  if (plain) return `${plain[1].padStart(2, '0')}:${plain[2]}`;
  return '';
}

export function parseAnyDateToISO(raw) {
  if (raw === null || raw === undefined || raw === '') return '';
  if (raw instanceof Date) {
    if (isNaN(raw.getTime())) return '';
    return `${raw.getUTCFullYear()}-${String(raw.getUTCMonth() + 1).padStart(2, '0')}-${String(raw.getUTCDate()).padStart(2, '0')}`;
  }
  const s = String(raw).trim();
  const dmy = /^(\d{1,2})\/(\d{1,2})\/(\d{4})$/.exec(s);
  if (dmy) return `${dmy[3]}-${dmy[2].padStart(2, '0')}-${dmy[1].padStart(2, '0')}`;
  if (/^\d{4}-\d{2}-\d{2}/.test(s)) return s.slice(0, 10);
  return '';
}

export function normalizeName(s) {
  return String(s || '')
    .replace(/\u00a0/g, ' ')
    .trim()
    .toLowerCase()
    .replace(/\s+/g, ' ');
}

function levenshtein(a, b) {
  const m = a.length;
  const n = b.length;
  const dp = Array.from({ length: m + 1 }, () => new Array(n + 1).fill(0));
  for (let i = 0; i <= m; i++) dp[i][0] = i;
  for (let j = 0; j <= n; j++) dp[0][j] = j;
  for (let i = 1; i <= m; i++) {
    for (let j = 1; j <= n; j++) {
      dp[i][j] =
        a[i - 1] === b[j - 1] ? dp[i - 1][j - 1] : 1 + Math.min(dp[i - 1][j - 1], dp[i - 1][j], dp[i][j - 1]);
    }
  }
  return dp[m][n];
}

export function findBestParticipantMatch(uploadedName, candidateNames) {
  const target = normalizeName(uploadedName);
  if (!target) return null;
  let match = candidateNames.find((c) => normalizeName(c) === target);
  if (match) return match;
  match = candidateNames.find((c) => {
    const cn = normalizeName(c);
    return cn.startsWith(target) || target.startsWith(cn);
  });
  if (match) return match;
  let best = null;
  let bestDist = Infinity;
  candidateNames.forEach((c) => {
    const cn = normalizeName(c);
    const firstToken = cn.split(' ')[0];
    const d = Math.min(levenshtein(target, cn), levenshtein(target, firstToken));
    if (d < bestDist) {
      bestDist = d;
      best = c;
    }
  });
  const threshold = Math.max(2, Math.round(target.length * 0.25));
  return bestDist <= threshold ? best : null;
}

export function parseCSV(text) {
  const clean = text.replace(/^\uFEFF/, '').replace(/\r\n/g, '\n').replace(/\r/g, '\n');
  const lines = clean.split('\n').filter((l) => l.trim().length > 0);
  if (lines.length === 0) return [];
  const parseLine = (line) => {
    const out = [];
    let cur = '';
    let inQuotes = false;
    for (let i = 0; i < line.length; i++) {
      const ch = line[i];
      if (inQuotes) {
        if (ch === '"') {
          if (line[i + 1] === '"') {
            cur += '"';
            i++;
          } else {
            inQuotes = false;
          }
        } else cur += ch;
      } else if (ch === '"') {
        inQuotes = true;
      } else if (ch === ',') {
        out.push(cur);
        cur = '';
      } else {
        cur += ch;
      }
    }
    out.push(cur);
    return out;
  };
  const headers = parseLine(lines[0]).map((h) => h.trim());
  return lines.slice(1).map((line) => {
    const vals = parseLine(line);
    const obj = {};
    headers.forEach((h, i) => {
      obj[h] = (vals[i] !== undefined ? vals[i] : '').trim();
    });
    return obj;
  });
}

function inferPeriodFromRow(groupName, startTime) {
  const g = (groupName || '').toLowerCase();
  if (g.includes('sleepover')) return 'Sleepover';
  if (g.includes('night')) return 'Night';
  if (g.includes('evening')) return 'PM';
  if (g.includes('daytime') || g.includes('morning')) return 'AM';
  const hour = parseInt((startTime || '0').split(':')[0], 10) || 0;
  if (hour >= 22 || hour < 6) return 'Night';
  return hour < 12 ? 'AM' : 'PM';
}

function inferIntensityFromRow(groupName) {
  return (groupName || '').toLowerCase().includes('high intensity') ? 'High Intensity' : 'Standard';
}

function parseRatioFromRow(ratioStr) {
  const nums = (ratioStr || '')
    .split(':')
    .map((x) => parseInt(x, 10))
    .filter((x) => !Number.isNaN(x));
  const w = nums[0] || 1;
  const p = nums[1] || 1;
  const key = `${w}:${p}`;
  const isPreset = RATIO_PRESETS.some((r) => r.key === key);
  return { ratio: isPreset ? key : 'custom', customW: w, customP: p };
}

export function buildScheduleFromRows(rows, nextBlockId) {
  const schedule = { Mon: [], Tue: [], Wed: [], Thu: [], Fri: [], Sat: [], Sun: [] };
  let count = 0;
  rows.forEach((r) => {
    const dayKey = CSV_DAY_MAP[String(getField(r, ['Day', 'Date']) || '').trim().toLowerCase()];
    const start = normalizeTimeString(getField(r, ['Start Time', 'Start Date Time', 'Start']));
    const end = normalizeTimeString(getField(r, ['End Time', 'End Date Time', 'End Dare Time', 'End']));
    if (!dayKey || !start || !end) return;
    const groupName = String(getField(r, ['Rate Group', 'Rate Groups']) || '');
    const { ratio, customW, customP } = parseRatioFromRow(String(getField(r, ['Ratio']) || ''));
    const label =
      String(getField(r, ['Shift Type']) || '').trim() ||
      groupName.split(' - ')[0] ||
      'Support';
    schedule[dayKey].push({
      id: nextBlockId(),
      label,
      period: inferPeriodFromRow(groupName, start),
      intensity: inferIntensityFromRow(groupName),
      mode: 'time',
      startTime: start,
      endTime: end,
      hours: computeHoursFromTime(start, end),
      ratio,
      customW,
      customP,
    });
    count += 1;
  });
  return { schedule, count };
}

export function parsePlanDatesRows(rows, participantNames) {
  const knownNames = [...participantNames];
  let matched = 0;
  const unmatched = [];
  const updates = [];

  rows.forEach((r) => {
    const rawName = getField(r, ['Participant Name', 'Name', 'Participant']);
    const name = String(rawName || '').replace(/\u00a0/g, ' ').trim();
    if (!name) return;
    const start = parseAnyDateToISO(getField(r, ['Start Date', 'Agreement Start Date', 'Start']));
    const end = parseAnyDateToISO(getField(r, ['End Date', 'Agreement End Date', 'End']));
    if (!start && !end) return;
    const match = findBestParticipantMatch(name, knownNames);
    if (!match) {
      unmatched.push(name);
      return;
    }
    updates.push({ name: match, start, end });
    matched += 1;
  });

  return { matched, unmatched, updates };
}
