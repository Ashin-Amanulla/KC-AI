import mongoose from 'mongoose';
import { parse } from 'csv-parse/sync';
import { config } from '../../config/index.js';
import { Location } from '../locations/location.model.js';
import { ForecastRecord } from '../forecast-actuals/forecastRecord.model.js';
import { buildLookupMaps, fetchAllClients } from '../forecast-actuals/directory.service.js';
import { buildSummaryPdf } from '../forecast-actuals/summaryPdf.js';
import { StandardForecast } from './standardForecast.model.js';
import {
  buildNormalizedColumns,
  getRowValue,
  parseDecimal,
  parseTime,
  roundMoney,
  validateHeaders,
} from './csvStandardForecast.js';
import {
  formatUtcDateForCsv,
  moneyEqual,
} from '../forecast-actuals/csvForecastActuals.js';
import {
  compareTemplateKeys,
  sortStandardRecords,
  sortTemplateKeys,
} from '../../utils/weekdaySort.js';
import { normalizeRatio } from '../../utils/normalizeRatio.js';
import {
  applyShiftDateRange,
  resolveForecastRangeFromFilter,
} from '../forecast-actuals/shiftDateRange.js';

export { sortStandardRecords };

const DAY_KEYS = ['monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday', 'sunday'];

function locObjectId(locationId) {
  return new mongoose.Types.ObjectId(locationId);
}

function listFilter(locationId, clientId) {
  const q = { location: locObjectId(locationId) };
  if (clientId && clientId !== 'all') q.clientDirectoryId = String(clientId);
  return q;
}

function forecastListFilter(locationId, clientId, dateFrom, dateTo) {
  const q = listFilter(locationId, clientId);
  applyShiftDateRange(q, dateFrom, dateTo);
  return q;
}

function serializeDoc(d) {
  return {
    id: d._id.toString(),
    clientDirectoryId: d.clientDirectoryId,
    clientName: d.clientName,
    day: d.day,
    startTime: d.startTime,
    endTime: d.endTime,
    duration: d.duration,
    totalCost: d.totalCost,
    rateGroups: d.rateGroups,
    referenceNo: d.referenceNo,
    shiftType: d.shiftType,
    ratio: normalizeRatio(d.ratio),
  };
}

export async function getDirectoryOptions(credentials) {
  const clients = await fetchAllClients(credentials);
  return {
    clients: [{ value: 'all', label: 'All Clients' }].concat(
      clients.map((c) => ({ value: c.id, label: c.displayName }))
    ),
  };
}

/** Shared validation for CSV rows and manual create */
export function buildStandardDocFromFields(fields, errorPrefix = '') {
  const prefix = errorPrefix ? `${errorPrefix}: ` : '';
  const {
    clientDirectoryId,
    clientName,
    day,
    startTimeStr,
    endTimeStr,
    duration: durationRaw,
    totalCost: totalCostRaw,
    rateGroups = '',
    referenceNo = '',
    shiftType = '',
    ratio = '',
  } = fields;

  if (!clientDirectoryId) return { error: `${prefix}Client is required` };
  if (!clientName) return { error: `${prefix}Client name is required` };
  if (!String(day || '').trim()) return { error: `${prefix}Day is required` };

  const startTime = parseTime(startTimeStr);
  if (!startTime) return { error: `${prefix}Invalid start time '${startTimeStr}'` };

  const endTime = parseTime(endTimeStr);
  if (!endTime) return { error: `${prefix}Invalid end time '${endTimeStr}'` };

  const duration = parseDecimal(durationRaw);
  if (duration == null) return { error: `${prefix}Invalid duration '${durationRaw}'` };

  const totalCost = parseDecimal(totalCostRaw);
  if (totalCost == null) return { error: `${prefix}Invalid total cost '${totalCostRaw}'` };

  return {
    doc: {
      clientDirectoryId,
      clientName,
      day: String(day).trim(),
      startTime,
      endTime,
      duration: roundMoney(duration),
      totalCost: roundMoney(totalCost),
      rateGroups: String(rateGroups || '').trim(),
      referenceNo: String(referenceNo || '').trim(),
      shiftType: String(shiftType || '').trim(),
      ratio: normalizeRatio(ratio),
    },
  };
}

function processStandardRow(row, normalizedColumns, clientMap, rowNum) {
  const getVal = (col) => getRowValue(row, col, normalizedColumns);
  const clientName = getVal('client name');
  if (!clientName) return { error: `Row ${rowNum}: Client name is required` };
  const clientEntry = clientMap.get(clientName.toLowerCase());
  if (!clientEntry) return { error: `Row ${rowNum}: Client '${clientName}' not found` };

  return buildStandardDocFromFields(
    {
      clientDirectoryId: clientEntry.id,
      clientName,
      day: getVal('day'),
      startTimeStr: getVal('start date time'),
      endTimeStr: getVal('end date time'),
      duration: getVal('duration'),
      totalCost: getVal('total cost'),
      rateGroups: getVal('rate groups'),
      referenceNo: getVal('reference no'),
      shiftType: getVal('shift type'),
      ratio: getVal('ratio'),
    },
    `Row ${rowNum}`
  );
}

export async function createStandardForecastRecord({
  locationId,
  clientDirectoryId,
  day,
  startTime,
  endTime,
  duration,
  totalCost,
  rateGroups,
  referenceNo,
  shiftType,
  ratio,
  credentials,
  uploadedBy,
}) {
  const clients = await fetchAllClients(credentials);
  const client = clients.find((c) => c.id === clientDirectoryId);
  if (!client) {
    return { success: false, errors: ['Client not found'] };
  }

  const built = buildStandardDocFromFields({
    clientDirectoryId: client.id,
    clientName: client.displayName,
    day,
    startTimeStr: startTime,
    endTimeStr: endTime,
    duration,
    totalCost,
    rateGroups,
    referenceNo,
    shiftType,
    ratio,
  });
  if (built.error) {
    return { success: false, errors: [built.error] };
  }

  const created = await StandardForecast.create({
    ...built.doc,
    location: locObjectId(locationId),
    uploadedBy: uploadedBy || null,
  });

  return { success: true, record: serializeDoc(created.toObject()) };
}

export async function updateStandardForecastRecord({
  id,
  locationId,
  clientDirectoryId,
  day,
  startTime,
  endTime,
  duration,
  totalCost,
  rateGroups,
  referenceNo,
  shiftType,
  ratio,
  credentials,
}) {
  if (!mongoose.Types.ObjectId.isValid(id)) {
    return { success: false, errors: ['Invalid record id'] };
  }
  const existing = await StandardForecast.findOne({ _id: id, location: locObjectId(locationId) });
  if (!existing) return { success: false, errors: ['Record not found'] };

  const clients = await fetchAllClients(credentials);
  const client = clients.find((c) => c.id === clientDirectoryId);
  if (!client) return { success: false, errors: ['Client not found'] };

  const built = buildStandardDocFromFields({
    clientDirectoryId: client.id,
    clientName: client.displayName,
    day,
    startTimeStr: startTime,
    endTimeStr: endTime,
    duration,
    totalCost,
    rateGroups,
    referenceNo,
    shiftType,
    ratio,
  });
  if (built.error) return { success: false, errors: [built.error] };

  Object.assign(existing, built.doc);
  await existing.save();
  return { success: true, record: serializeDoc(existing.toObject()) };
}

export async function deleteStandardForecastRecord({ id, locationId }) {
  if (!mongoose.Types.ObjectId.isValid(id)) {
    return { success: false, errors: ['Invalid record id'] };
  }
  const result = await StandardForecast.deleteOne({ _id: id, location: locObjectId(locationId) });
  if (result.deletedCount === 0) return { success: false, errors: ['Record not found'] };
  return { success: true };
}

export async function uploadStandardForecastFromCsv({ locationId, fileBuffer, credentials, uploadedBy }) {
  const clients = await fetchAllClients(credentials);
  const { clientMap } = buildLookupMaps(clients, []);

  let records;
  try {
    records = parse(fileBuffer, {
      columns: true,
      skip_empty_lines: true,
      trim: true,
      bom: true,
      relax_column_count: true,
    });
  } catch (e) {
    return {
      success: false,
      rowsProcessed: 0,
      recordsCreated: 0,
      recordsSkipped: 0,
      errors: [`CSV parsing error: ${e.message}`],
    };
  }

  if (!records.length) {
    return {
      success: false,
      rowsProcessed: 0,
      recordsCreated: 0,
      recordsSkipped: 0,
      errors: ['CSV file is empty'],
    };
  }

  const normalizedColumns = buildNormalizedColumns(Object.keys(records[0]));
  const headerErrors = validateHeaders(new Set(normalizedColumns.keys()));
  if (headerErrors.length) {
    return {
      success: false,
      rowsProcessed: 0,
      recordsCreated: 0,
      recordsSkipped: 0,
      errors: headerErrors,
    };
  }

  const docs = [];
  const errors = [];
  let rowNum = 1;

  for (const row of records) {
    rowNum += 1;
    const result = processStandardRow(row, normalizedColumns, clientMap, rowNum);
    if (result.error) {
      errors.push(result.error);
      continue;
    }
    docs.push({
      ...result.doc,
      location: locObjectId(locationId),
      uploadedBy: uploadedBy || null,
    });
  }

  if (errors.length && !docs.length) {
    return {
      success: false,
      rowsProcessed: records.length,
      recordsCreated: 0,
      recordsSkipped: errors.length,
      errors,
    };
  }

  await StandardForecast.deleteMany({ location: locObjectId(locationId) });
  if (docs.length) {
    await StandardForecast.insertMany(docs);
  }

  return {
    success: true,
    rowsProcessed: records.length,
    recordsCreated: docs.length,
    recordsSkipped: errors.length,
    errors,
  };
}

export async function listStandardForecast({ locationId, clientId }) {
  const filter = listFilter(locationId, clientId);
  const items = await StandardForecast.find(filter).lean();
  const records = sortStandardRecords(items.map(serializeDoc));
  const total = records.length;

  return {
    records,
    total,
    startIndex: total > 0 ? 1 : 0,
    endIndex: total,
    hasNext: false,
    hasPrev: false,
  };
}

const STANDARD_CSV_HEADER = [
  'Day',
  'Client Name',
  'Start Time',
  'End Time',
  'Duration',
  'Cost',
  'Shift Type',
  'Ratio',
];

function standardRowToCsvLine(r) {
  return [
    r.day,
    r.clientName,
    r.startTime,
    r.endTime,
    r.duration,
    r.totalCost,
    r.shiftType || '',
    normalizeRatio(r.ratio || ''),
  ]
    .map((c) => {
      const s = String(c ?? '');
      return s.includes(',') || s.includes('"') ? `"${s.replace(/"/g, '""')}"` : s;
    })
    .join(',');
}

export async function exportStandardForecastCsv({ locationId, clientId }) {
  const filter = listFilter(locationId, clientId);
  const items = await StandardForecast.find(filter).lean();
  const rows = sortStandardRecords(items.map(serializeDoc));

  const lines = [STANDARD_CSV_HEADER.join(','), ...rows.map(standardRowToCsvLine)];
  const body = Buffer.from(lines.join('\n'), 'utf-8');

  const loc = await Location.findById(locationId).lean();
  const code = (loc?.code || 'loc').toLowerCase();
  const ts = new Date().toISOString().replace(/[-:]/g, '').slice(0, 15);
  const filename = `standard_forecast_${code}_${ts}.csv`;
  return { filename, body };
}

/** Count weekday occurrences in inclusive date range (keys: monday..sunday) */
export function countDaysInRange(startDate, endDate) {
  const counts = Object.fromEntries(DAY_KEYS.map((d) => [d, 0]));
  const start = new Date(startDate);
  const end = new Date(endDate);
  start.setUTCHours(12, 0, 0, 0);
  end.setUTCHours(12, 0, 0, 0);

  const current = new Date(start);
  while (current <= end) {
    const weekday = current.getUTCDay();
    const dayKey = DAY_KEYS[weekday === 0 ? 6 : weekday - 1];
    counts[dayKey] += 1;
    current.setUTCDate(current.getUTCDate() + 1);
  }
  return counts;
}

/** Standard budget per clientDirectoryId for a date range */
export async function computeStandardBudgetForRange(locationId, startDate, endDate) {
  const dayCounts = countDaysInRange(startDate, endDate);
  const records = await StandardForecast.find({ location: locObjectId(locationId) }).lean();
  const budgets = new Map();

  for (const rec of records) {
    const dayKey = String(rec.day || '').trim().toLowerCase();
    const dayCount = dayCounts[dayKey] || 0;
    if (dayCount > 0) {
      const contribution = roundMoney(rec.totalCost * dayCount);
      budgets.set(rec.clientDirectoryId, roundMoney((budgets.get(rec.clientDirectoryId) || 0) + contribution));
    }
  }
  return budgets;
}

export function buildStandardVsForecastRecord(
  clientId,
  clientName,
  standardBudget,
  forecastBudget
) {
  const sb = roundMoney(Number(standardBudget) || 0);
  const fb = roundMoney(Number(forecastBudget) || 0);
  const variance = roundMoney(fb - sb);
  let variancePercentage = null;
  if (sb > 0) {
    variancePercentage = roundMoney((variance / sb) * 100);
  }
  return {
    clientId,
    clientName,
    standardBudget: sb,
    forecastBudget: fb,
    variance,
    variancePercentage,
  };
}

export async function getStandardVsForecastSummary({
  locationId,
  clientId,
  credentials,
  dateFrom,
  dateTo,
}) {
  const rangeMatch = forecastListFilter(locationId, clientId, dateFrom, dateTo);
  const fDr = await ForecastRecord.aggregate([
    { $match: rangeMatch },
    { $group: { _id: null, minD: { $min: '$shiftDate' }, maxD: { $max: '$shiftDate' } } },
  ]);

  const dataMin = fDr[0]?.minD ?? null;
  const dataMax = fDr[0]?.maxD ?? null;
  const { start: forecastStart, end: forecastEnd } = resolveForecastRangeFromFilter(
    dateFrom,
    dateTo,
    dataMin,
    dataMax
  );

  if (!forecastStart || !forecastEnd) {
    const emptyTotals = buildStandardVsForecastRecord(null, 'TOTAL', 0, 0);
    return {
      records: [],
      totals: emptyTotals,
      forecastDateRangeStart: null,
      forecastDateRangeEnd: null,
    };
  }

  const clients = await fetchAllClients(credentials);
  let clientList = clients;
  if (clientId && clientId !== 'all') {
    clientList = clients.filter((c) => c.id === clientId);
  }
  const allClientsMap = new Map(clientList.map((c) => [c.id, c.displayName]));

  const standardBudgets = await computeStandardBudgetForRange(locationId, forecastStart, forecastEnd);

  const baseF = forecastListFilter(locationId, clientId, dateFrom, dateTo);
  const fAgg = await ForecastRecord.aggregate([
    { $match: baseF },
    {
      $group: {
        _id: '$clientDirectoryId',
        forecast_budget: { $sum: '$totalCost' },
      },
    },
  ]);
  const forecastMap = new Map(fAgg.map((x) => [x._id, x.forecast_budget]));

  const records = [];
  for (const cid of allClientsMap.keys()) {
    records.push(
      buildStandardVsForecastRecord(
        cid,
        allClientsMap.get(cid),
        standardBudgets.get(cid) ?? 0,
        forecastMap.get(cid) ?? 0
      )
    );
  }
  records.sort((a, b) => a.clientName.localeCompare(b.clientName, undefined, { sensitivity: 'base' }));

  const totals = {
    clientId: null,
    clientName: 'TOTAL',
    standardBudget: roundMoney(records.reduce((s, r) => s + r.standardBudget, 0)),
    forecastBudget: roundMoney(records.reduce((s, r) => s + r.forecastBudget, 0)),
    variance: roundMoney(records.reduce((s, r) => s + r.variance, 0)),
    variancePercentage: null,
  };
  if (totals.standardBudget > 0) {
    totals.variancePercentage = roundMoney((totals.variance / totals.standardBudget) * 100);
  }

  return {
    records,
    totals,
    forecastDateRangeStart: forecastStart,
    forecastDateRangeEnd: forecastEnd,
  };
}

function csvEscape(s) {
  const v = String(s ?? '');
  return v.includes(',') || v.includes('"') ? `"${v.replace(/"/g, '""')}"` : v;
}

export async function exportStandardVsForecastCsv({
  locationId,
  clientId,
  credentials,
  dateFrom,
  dateTo,
}) {
  const result = await getStandardVsForecastSummary({
    locationId,
    clientId,
    credentials,
    dateFrom,
    dateTo,
  });
  const header = ['Client Name', 'Standard Budget', 'Forecast Budget', 'Variance', 'Variance %'];
  const lines = [header.join(',')];

  for (const r of result.records) {
    const pct = r.variancePercentage != null ? `${r.variancePercentage.toFixed(2)}%` : '';
    lines.push(
      [
        csvEscape(r.clientName),
        r.standardBudget.toFixed(2),
        r.forecastBudget.toFixed(2),
        r.variance.toFixed(2),
        pct,
      ].join(',')
    );
  }

  const t = result.totals;
  const totalsPct = t.variancePercentage != null ? `${t.variancePercentage.toFixed(2)}%` : '';
  lines.push(
    [
      csvEscape(t.clientName),
      t.standardBudget.toFixed(2),
      t.forecastBudget.toFixed(2),
      t.variance.toFixed(2),
      totalsPct,
    ].join(',')
  );

  const body = Buffer.from(lines.join('\n'), 'utf-8');
  const loc = await Location.findById(locationId).lean();
  const code = (loc?.code || 'loc').toLowerCase();
  const ts = new Date().toISOString().replace(/[-:]/g, '').slice(0, 15);
  const filename = `standard_vs_forecast_${code}_${ts}.csv`;
  return { filename, body };
}

export async function exportStandardVsForecastPdf({
  locationId,
  clientId,
  credentials,
  dateFrom,
  dateTo,
}) {
  const result = await getStandardVsForecastSummary({
    locationId,
    clientId,
    credentials,
    dateFrom,
    dateTo,
  });
  const loc = await Location.findById(locationId).lean();

  const fmtDate = (d) =>
    d
      ? new Date(d).toLocaleDateString('en-AU', { day: '2-digit', month: 'short', year: 'numeric' })
      : '';

  let title = `Standard vs Forecast Summary - ${loc?.code || ''}`;
  if (result.forecastDateRangeStart && result.forecastDateRangeEnd) {
    title += `\nForecast Period: ${fmtDate(result.forecastDateRangeStart)} - ${fmtDate(result.forecastDateRangeEnd)}`;
  }

  const headers = ['Client Name', 'Standard Budget', 'Forecast Budget', 'Variance', 'Variance %'];
  const rows = result.records.map((r) => [
    r.clientName,
    `$${r.standardBudget.toFixed(2)}`,
    `$${r.forecastBudget.toFixed(2)}`,
    `$${r.variance.toFixed(2)}`,
    r.variancePercentage != null ? `${r.variancePercentage.toFixed(2)}%` : '',
  ]);

  const t = result.totals;
  const totalsRow = [
    t.clientName,
    `$${t.standardBudget.toFixed(2)}`,
    `$${t.forecastBudget.toFixed(2)}`,
    `$${t.variance.toFixed(2)}`,
    t.variancePercentage != null ? `${t.variancePercentage.toFixed(2)}%` : '',
  ];

  const pdfBuffer = await buildSummaryPdf({ title, headers, rows, totalsRow });
  const code = (loc?.code || 'loc').toLowerCase();
  const ts = new Date().toISOString().replace(/[-:]/g, '').slice(0, 15);
  const filename = `standard_vs_forecast_${code}_${ts}.pdf`;
  return { filename, body: pdfBuffer };
}

const PAGE_SIZE_VARIANCE = () => config.standardForecast.pageSize;

/** Build a stable template key. */
export function buildTemplateKey({ clientDirectoryId, day, startTime }) {
  return `${clientDirectoryId}|${String(day || '').trim().toLowerCase()}|${startTime}`;
}

export function parseTemplateKey(key) {
  const [clientDirectoryId, day, startTime] = String(key || '').split('|');
  return { clientDirectoryId, day, startTime };
}

const DAY_LABEL = {
  monday: 'Monday',
  tuesday: 'Tuesday',
  wednesday: 'Wednesday',
  thursday: 'Thursday',
  friday: 'Friday',
  saturday: 'Saturday',
  sunday: 'Sunday',
};

const UTC_DAY_KEYS = ['sunday', 'monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday'];

function dayKeyFromLabel(day) {
  if (!day) return '';
  return String(day).trim().toLowerCase();
}

function dayKeyFromShiftDate(d) {
  if (!d) return '';
  return UTC_DAY_KEYS[new Date(d).getUTCDay()] || '';
}

/** Diff between an aggregated standard bucket and an aggregated forecast bucket. */
export function computeStandardVarianceDiff(std, fcs) {
  const diff = [];
  const t = (d) => (d ? new Date(d).getTime() : 0);
  // Standard templates use weekday; forecast rows use calendar shiftDate — compare day-of-week, not timestamps.
  if (std.shiftDate && fcs.shiftDate) {
    if (t(std.shiftDate) !== t(fcs.shiftDate)) diff.push('shift_date');
  } else {
    const stdDay = dayKeyFromLabel(std.day);
    const fcsDay = dayKeyFromLabel(fcs.day) || dayKeyFromShiftDate(fcs.shiftDate);
    if (stdDay && fcsDay && stdDay !== fcsDay) diff.push('shift_date');
  }
  if (String(std.clientName || '') !== String(fcs.clientName || '')) diff.push('client_name');
  if (String(std.startTime || '') !== String(fcs.startTime || '')) diff.push('start_datetime');
  if (String(std.endTime || '') !== String(fcs.endTime || '')) diff.push('end_datetime');
  if (!moneyEqual(std.duration, fcs.duration)) diff.push('duration');
  if (!moneyEqual(std.totalCost, fcs.totalCost)) diff.push('total_cost');
  if (String(std.shiftcareId || std.templateKey || '') !== String(fcs.shiftcareId || fcs.templateKey || '')) {
    diff.push('shift_id');
  }
  if (String(std.rateGroups || '') !== String(fcs.rateGroups || '')) diff.push('rate_groups');
  if (String(std.shiftType || '') !== String(fcs.shiftType || '')) diff.push('shift_type');
  if (normalizeRatio(std.ratio) !== normalizeRatio(fcs.ratio)) diff.push('ratio');
  return diff;
}

function serializeStandardTemplateRow(stdRow, dayCount) {
  const totalCost = roundMoney((stdRow.totalCost || 0) * dayCount);
  const templateKey = buildTemplateKey({
    clientDirectoryId: stdRow.clientDirectoryId,
    day: stdRow.day,
    startTime: stdRow.startTime,
  });
  const dayLabel = DAY_LABEL[String(stdRow.day || '').trim().toLowerCase()] || stdRow.day;
  return {
    templateKey,
    shiftcareId: templateKey,
    source: 'standard',
    recordType: '',
    clientDirectoryId: stdRow.clientDirectoryId,
    clientName: stdRow.clientName,
    day: dayLabel,
    shiftDate: null,
    startDatetime: null,
    endDatetime: null,
    startTime: stdRow.startTime,
    endTime: stdRow.endTime,
    duration: roundMoney(stdRow.duration || 0),
    totalCost,
    rateGroups: stdRow.rateGroups || '',
    shiftType: stdRow.shiftType || '',
    ratio: stdRow.ratio || '',
    diffFields: [],
  };
}

function serializeForecastBucketRow(bucket, clientNameMap) {
  const occurrences = bucket.occurrences || 0;
  const duration = occurrences > 0 ? roundMoney(bucket.sumDuration / occurrences) : 0;
  const templateKey = buildTemplateKey({
    clientDirectoryId: bucket.clientDirectoryId,
    day: bucket.dayKey,
    startTime: bucket.startTime,
  });
  return {
    templateKey,
    shiftcareId: templateKey,
    source: 'forecast',
    recordType: '',
    clientDirectoryId: bucket.clientDirectoryId,
    clientName: clientNameMap.get(bucket.clientDirectoryId) || bucket.clientName || '',
    day: DAY_LABEL[bucket.dayKey] || bucket.dayKey,
    shiftDate: bucket.minShiftDate ?? null,
    startDatetime: bucket.minStart ?? null,
    endDatetime: bucket.maxEnd ?? null,
    startTime: bucket.startTime,
    endTime: bucket.endTime,
    duration,
    totalCost: roundMoney(bucket.totalCost || 0),
    rateGroups: bucket.rateGroups || '',
    shiftType: bucket.shiftType || '',
    ratio: bucket.ratio || '',
    diffFields: [],
  };
}

/** Sunday=1..Saturday=7 → monday/tuesday/.../sunday */
const MONGO_DAY_TO_KEY = {
  1: 'sunday',
  2: 'monday',
  3: 'tuesday',
  4: 'wednesday',
  5: 'thursday',
  6: 'friday',
  7: 'saturday',
};

async function getForecastTemplateBuckets(locationId, clientId, rangeStart, rangeEnd) {
  const match = {
    location: locObjectId(locationId),
    shiftDate: { $gte: new Date(rangeStart), $lte: new Date(rangeEnd) },
  };
  if (clientId && clientId !== 'all') match.clientDirectoryId = String(clientId);

  const pipeline = [
    { $match: match },
    {
      $project: {
        clientDirectoryId: 1,
        totalCost: 1,
        cost: 1,
        duration: 1,
        startDatetime: 1,
        endDatetime: 1,
        shiftDate: 1,
        rateGroups: 1,
        shiftType: 1,
        ratio: 1,
        dayOfWeek: { $dayOfWeek: '$shiftDate' },
        startTime: { $dateToString: { format: '%H:%M', date: '$startDatetime' } },
        endTime: { $dateToString: { format: '%H:%M', date: '$endDatetime' } },
      },
    },
    {
      $group: {
        _id: {
          clientDirectoryId: '$clientDirectoryId',
          dayOfWeek: '$dayOfWeek',
          startTime: '$startTime',
        },
        endTime: { $first: '$endTime' },
        minShiftDate: { $min: '$shiftDate' },
        minStart: { $min: '$startDatetime' },
        maxEnd: { $max: '$endDatetime' },
        occurrences: { $sum: 1 },
        totalCost: { $sum: '$totalCost' },
        sumCost: { $sum: '$cost' },
        sumDuration: { $sum: '$duration' },
        rateGroups: { $first: '$rateGroups' },
        shiftType: { $first: '$shiftType' },
        ratio: { $first: '$ratio' },
      },
    },
  ];

  const agg = await ForecastRecord.aggregate(pipeline);
  const buckets = [];
  for (const item of agg) {
    const dayKey = MONGO_DAY_TO_KEY[item._id.dayOfWeek];
    if (!dayKey) continue;
    buckets.push({
      clientDirectoryId: item._id.clientDirectoryId,
      dayKey,
      startTime: item._id.startTime,
      endTime: item.endTime || '',
      minShiftDate: item.minShiftDate,
      minStart: item.minStart,
      maxEnd: item.maxEnd,
      occurrences: item.occurrences,
      totalCost: item.totalCost,
      sumCost: item.sumCost,
      sumDuration: item.sumDuration,
      rateGroups: item.rateGroups,
      shiftType: item.shiftType,
      ratio: item.ratio,
    });
  }
  return buckets;
}

async function getForecastRangeAndClients(locationId, clientId, credentials, dateFrom, dateTo) {
  const rangeMatch = forecastListFilter(locationId, clientId, dateFrom, dateTo);
  const fDr = await ForecastRecord.aggregate([
    { $match: rangeMatch },
    { $group: { _id: null, minD: { $min: '$shiftDate' }, maxD: { $max: '$shiftDate' } } },
  ]);
  const dataMin = fDr[0]?.minD ?? null;
  const dataMax = fDr[0]?.maxD ?? null;
  const { start: forecastStart, end: forecastEnd } = resolveForecastRangeFromFilter(
    dateFrom,
    dateTo,
    dataMin,
    dataMax
  );

  let clientNameMap = new Map();
  if (credentials) {
    const clients = await fetchAllClients(credentials);
    clientNameMap = new Map(clients.map((c) => [c.id, c.displayName]));
  }
  if (!clientNameMap.size) {
    const standardClients = await StandardForecast.aggregate([
      { $match: { location: locObjectId(locationId) } },
      { $group: { _id: '$clientDirectoryId', clientName: { $first: '$clientName' } } },
    ]);
    for (const c of standardClients) {
      if (c._id && !clientNameMap.has(c._id)) clientNameMap.set(c._id, c.clientName || '');
    }
  }

  return { forecastStart, forecastEnd, clientNameMap };
}

export async function listStandardVsForecastVariance({
  locationId,
  clientId,
  tab,
  page,
  credentials,
  dateFrom,
  dateTo,
}) {
  const pageSize = PAGE_SIZE_VARIANCE();
  const p = Math.max(1, parseInt(page, 10) || 1);
  const t = ['all', 'deleted', 'additional', 'variance'].includes(tab) ? tab : 'all';

  const empty = {
    records: [],
    total: 0,
    page: p,
    pageSize,
    startIndex: 0,
    endIndex: 0,
    hasNext: false,
    hasPrev: false,
    allCount: 0,
    deletedCount: 0,
    additionalCount: 0,
    varianceCount: 0,
    forecastDateRangeStart: null,
    forecastDateRangeEnd: null,
  };

  const { forecastStart, forecastEnd, clientNameMap } = await getForecastRangeAndClients(
    locationId,
    clientId,
    credentials,
    dateFrom,
    dateTo
  );

  if (!forecastStart || !forecastEnd) return empty;

  const dayCounts = countDaysInRange(forecastStart, forecastEnd);

  const stdFilter = listFilter(locationId, clientId);
  const stdRows = await StandardForecast.find(stdFilter).lean();

  const standardMap = new Map();
  for (const r of stdRows) {
    const dayKey = String(r.day || '').trim().toLowerCase();
    const dayCount = dayCounts[dayKey] || 0;
    if (dayCount <= 0) continue;
    const tplKey = buildTemplateKey({
      clientDirectoryId: r.clientDirectoryId,
      day: r.day,
      startTime: r.startTime,
    });
    if (!standardMap.has(tplKey)) {
      standardMap.set(tplKey, serializeStandardTemplateRow(r, dayCount));
    } else {
      const cur = standardMap.get(tplKey);
      cur.totalCost = roundMoney(cur.totalCost + roundMoney((r.totalCost || 0) * dayCount));
    }
  }

  const fBuckets = await getForecastTemplateBuckets(locationId, clientId, forecastStart, forecastEnd);
  const forecastMap = new Map();
  for (const b of fBuckets) {
    const row = serializeForecastBucketRow(b, clientNameMap);
    forecastMap.set(row.templateKey, row);
  }

  const standardKeys = new Set(standardMap.keys());
  const forecastKeys = new Set(forecastMap.keys());

  const deletedKeys = [];
  for (const k of standardKeys) if (!forecastKeys.has(k)) deletedKeys.push(k);
  sortTemplateKeys(deletedKeys);

  const additionalKeys = [];
  for (const k of forecastKeys) if (!standardKeys.has(k)) additionalKeys.push(k);
  sortTemplateKeys(additionalKeys);

  const varianceKeys = [];
  for (const k of standardKeys) {
    if (!forecastKeys.has(k)) continue;
    const s = standardMap.get(k);
    const f = forecastMap.get(k);
    const diff = computeStandardVarianceDiff(s, f);
    if (diff.length > 0) {
      f.diffFields = diff;
      varianceKeys.push(k);
    }
  }
  sortTemplateKeys(varianceKeys);

  const deletedCount = deletedKeys.length;
  const additionalCount = additionalKeys.length;
  const varianceCount = varianceKeys.length;
  const allCount = deletedCount + additionalCount + varianceCount;

  let total;
  let pageRecords = [];
  if (t === 'deleted') {
    total = deletedCount;
    const slice = deletedKeys.slice((p - 1) * pageSize, (p - 1) * pageSize + pageSize);
    pageRecords = slice.map((k) => {
      const row = { ...standardMap.get(k) };
      row.recordType = 'deleted';
      return row;
    });
  } else if (t === 'additional') {
    total = additionalCount;
    const slice = additionalKeys.slice((p - 1) * pageSize, (p - 1) * pageSize + pageSize);
    pageRecords = slice.map((k) => {
      const row = { ...forecastMap.get(k) };
      row.recordType = 'additional';
      return row;
    });
  } else if (t === 'variance') {
    total = varianceCount;
    const slice = varianceKeys.slice((p - 1) * pageSize, (p - 1) * pageSize + pageSize);
    for (const k of slice) {
      const s = { ...standardMap.get(k) };
      const f = { ...forecastMap.get(k) };
      s.recordType = 'variance';
      f.recordType = 'variance';
      pageRecords.push(s);
      pageRecords.push(f);
    }
  } else {
    total = allCount;
    const combined = [
      ...deletedKeys.map((k) => ({ k, kind: 'deleted' })),
      ...additionalKeys.map((k) => ({ k, kind: 'additional' })),
      ...varianceKeys.map((k) => ({ k, kind: 'variance' })),
    ];
    combined.sort((a, b) => compareTemplateKeys(a.k, b.k));
    const slice = combined.slice((p - 1) * pageSize, (p - 1) * pageSize + pageSize);
    for (const { k, kind } of slice) {
      if (kind === 'deleted') {
        const row = { ...standardMap.get(k) };
        row.recordType = 'deleted';
        pageRecords.push(row);
      } else if (kind === 'additional') {
        const row = { ...forecastMap.get(k) };
        row.recordType = 'additional';
        pageRecords.push(row);
      } else {
        const s = { ...standardMap.get(k) };
        const f = { ...forecastMap.get(k) };
        s.recordType = 'variance';
        f.recordType = 'variance';
        pageRecords.push(s);
        pageRecords.push(f);
      }
    }
  }

  const startIdx = (p - 1) * pageSize;
  const endIdx = startIdx + pageSize;
  const startIndex = total > 0 ? startIdx + 1 : 0;
  const endIndex = Math.min(endIdx, total);

  return {
    records: pageRecords,
    total,
    page: p,
    pageSize,
    startIndex,
    endIndex,
    hasNext: p * pageSize < total,
    hasPrev: p > 1,
    allCount,
    deletedCount,
    additionalCount,
    varianceCount,
    forecastDateRangeStart: forecastStart,
    forecastDateRangeEnd: forecastEnd,
  };
}

function formatUtcTimeForCsv(d) {
  if (!d) return '';
  const t = new Date(d);
  if (Number.isNaN(t.getTime())) return '';
  const pad = (n) => String(n).padStart(2, '0');
  return `${pad(t.getUTCHours())}:${pad(t.getUTCMinutes())}`;
}

function formatStandardVarianceDateForCsv(record) {
  if (record.shiftDate) return formatUtcDateForCsv(record.shiftDate);
  if (record.day) return String(record.day);
  return '';
}

function formatStandardVarianceStartForCsv(record) {
  if (record.startTime) return String(record.startTime);
  return formatUtcTimeForCsv(record.startDatetime);
}

function formatStandardVarianceEndForCsv(record) {
  if (record.endTime) return String(record.endTime);
  return formatUtcTimeForCsv(record.endDatetime);
}

async function fetchAllStandardVarianceTabRecords(args, tab) {
  const first = await listStandardVsForecastVariance({ ...args, tab, page: 1 });
  let records = [...first.records];
  const totalPages = first.pageSize > 0 ? Math.ceil(first.total / first.pageSize) : 1;
  for (let i = 2; i <= totalPages; i += 1) {
    const page = await listStandardVsForecastVariance({ ...args, tab, page: i });
    records.push(...page.records);
  }
  return records;
}

export async function exportStandardVsForecastVarianceCsv({
  locationId,
  clientId,
  credentials,
  dateFrom,
  dateTo,
}) {
  const loc = await Location.findById(locationId).select('code').lean();
  const listArgs = { locationId, clientId, credentials, dateFrom, dateTo };

  const deletedRecords = await fetchAllStandardVarianceTabRecords(listArgs, 'deleted');
  const additionalRecords = await fetchAllStandardVarianceTabRecords(listArgs, 'additional');
  const varianceRecords = await fetchAllStandardVarianceTabRecords(listArgs, 'variance');

  const lines = [
    [
      'Type',
      'Date',
      'Client name',
      'Start time',
      'End time',
      'Duration',
      'Total cost',
      'Rate groups',
      'Shift type',
      'Ratio',
    ].join(','),
  ];

  function writeRecord(record, typeLabel) {
    lines.push(
      [
        csvEscape(typeLabel),
        csvEscape(formatStandardVarianceDateForCsv(record)),
        csvEscape(record.clientName || ''),
        csvEscape(formatStandardVarianceStartForCsv(record)),
        csvEscape(formatStandardVarianceEndForCsv(record)),
        record.duration ?? '',
        record.totalCost ?? '',
        csvEscape(record.rateGroups || ''),
        csvEscape(record.shiftType || ''),
        csvEscape(normalizeRatio(record.ratio || '')),
      ].join(',')
    );
  }

  for (const record of deletedRecords) {
    writeRecord(record, 'Deleted');
  }
  for (const record of additionalRecords) {
    writeRecord(record, 'Additional');
  }
  for (const record of varianceRecords) {
    const label = record.source === 'standard' ? 'Variance - Standard' : 'Variance - Forecast';
    writeRecord(record, label);
  }

  const code = (loc?.code || 'loc').toLowerCase();
  const ts = new Date().toISOString().replace(/[-:]/g, '').slice(0, 15);
  const filename = `standard_vs_forecast_variance_${code}_${ts}.csv`;
  return { filename, body: '\uFEFF' + lines.join('\n') };
}

export async function getStandardVsForecastVarianceDetail({
  locationId,
  templateKey,
  credentials,
}) {
  const { clientDirectoryId, day, startTime } = parseTemplateKey(templateKey);
  if (!clientDirectoryId || !day || !startTime) {
    return {
      templateKey,
      diffFields: [],
      standardRecords: [],
      forecastRecords: [],
      standardAggregated: null,
      forecastAggregated: null,
      dayCount: 0,
    };
  }

  const { forecastStart, forecastEnd, clientNameMap } = await getForecastRangeAndClients(
    locationId,
    null,
    credentials
  );

  const dayCounts = forecastStart && forecastEnd ? countDaysInRange(forecastStart, forecastEnd) : null;
  const dayCount = dayCounts ? dayCounts[day] || 0 : 0;

  const standardDocs = await StandardForecast.find({
    location: locObjectId(locationId),
    clientDirectoryId,
    startTime,
  })
    .lean()
    .then((rows) =>
      rows.filter((r) => String(r.day || '').trim().toLowerCase() === day)
    );

  const standardRecords = sortStandardRecords(
    standardDocs.map((r) => ({
      id: String(r._id),
      shiftcareId: templateKey,
      clientDirectoryId: r.clientDirectoryId,
      clientName: r.clientName,
      day: r.day,
      startTime: r.startTime,
      endTime: r.endTime,
      duration: r.duration,
      totalCost: r.totalCost,
      rateGroups: r.rateGroups,
      shiftType: r.shiftType,
      ratio: r.ratio,
    }))
  );

  let forecastRecords = [];
  let forecastAggregated = null;
  if (forecastStart && forecastEnd) {
    const fBuckets = await getForecastTemplateBuckets(
      locationId,
      clientDirectoryId,
      forecastStart,
      forecastEnd
    );
    const fBucket = fBuckets.find(
      (b) => b.clientDirectoryId === clientDirectoryId && b.dayKey === day && b.startTime === startTime
    );
    if (fBucket) {
      forecastAggregated = serializeForecastBucketRow(fBucket, clientNameMap);
    }

    const mongoDayOfWeek = Object.entries(MONGO_DAY_TO_KEY).find(([, v]) => v === day)?.[0];
    if (mongoDayOfWeek) {
      const docs = await ForecastRecord.aggregate([
        {
          $match: {
            location: locObjectId(locationId),
            clientDirectoryId,
            shiftDate: { $gte: new Date(forecastStart), $lte: new Date(forecastEnd) },
          },
        },
        {
          $project: {
            clientDirectoryId: 1,
            clientName: 1,
            staffName: 1,
            staffDirectoryId: 1,
            shiftDate: 1,
            startDatetime: 1,
            endDatetime: 1,
            duration: 1,
            cost: 1,
            totalCost: 1,
            shiftcareId: 1,
            rateGroups: 1,
            shiftType: 1,
            ratio: 1,
            dayOfWeek: { $dayOfWeek: '$shiftDate' },
            startTimeStr: { $dateToString: { format: '%H:%M', date: '$startDatetime' } },
          },
        },
        {
          $match: {
            dayOfWeek: Number(mongoDayOfWeek),
            startTimeStr: startTime,
          },
        },
        { $sort: { shiftDate: 1 } },
      ]);

      forecastRecords = docs.map((d) => ({
        id: String(d._id),
        shiftcareId: d.shiftcareId || templateKey,
        clientDirectoryId: d.clientDirectoryId,
        clientName: d.clientName,
        shiftDate: d.shiftDate,
        startDatetime: d.startDatetime,
        endDatetime: d.endDatetime,
        duration: d.duration,
        totalCost: d.totalCost,
        rateGroups: d.rateGroups,
        shiftType: d.shiftType,
        ratio: d.ratio,
      }));
    }
  }

  let standardAggregated = null;
  if (standardDocs.length && dayCount > 0) {
    const std = standardDocs[0];
    standardAggregated = serializeStandardTemplateRow(std, dayCount);
  }

  let diffFields = [];
  if (standardAggregated && forecastAggregated) {
    diffFields = computeStandardVarianceDiff(standardAggregated, forecastAggregated);
  }

  return {
    templateKey,
    diffFields,
    standardRecords,
    forecastRecords,
    standardAggregated,
    forecastAggregated,
    dayCount,
  };
}
