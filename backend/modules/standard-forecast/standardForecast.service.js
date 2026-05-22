import mongoose from 'mongoose';
import { parse } from 'csv-parse/sync';
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

const DAY_KEYS = ['monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday', 'sunday'];

const WEEKDAY_ORDER = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday'];

function weekdayIndex(day) {
  const i = WEEKDAY_ORDER.findIndex((d) => d.toLowerCase() === String(day || '').trim().toLowerCase());
  return i >= 0 ? i : WEEKDAY_ORDER.length;
}

/** Sort by calendar day (Mon→Sun), then start time ascending */
export function sortStandardRecords(records) {
  return [...records].sort((a, b) => {
    const dayDiff = weekdayIndex(a.day) - weekdayIndex(b.day);
    if (dayDiff !== 0) return dayDiff;
    return String(a.startTime || '').localeCompare(String(b.startTime || ''));
  });
}

function locObjectId(locationId) {
  return new mongoose.Types.ObjectId(locationId);
}

function listFilter(locationId, clientId) {
  const q = { location: locObjectId(locationId) };
  if (clientId && clientId !== 'all') q.clientDirectoryId = String(clientId);
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
    ratio: d.ratio,
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
      ratio: String(ratio || '').trim(),
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
    r.ratio || '',
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

export async function getStandardVsForecastSummary({ locationId, clientId, credentials }) {
  const fDr = await ForecastRecord.aggregate([
    { $match: { location: locObjectId(locationId) } },
    { $group: { _id: null, minD: { $min: '$shiftDate' }, maxD: { $max: '$shiftDate' } } },
  ]);

  const forecastStart = fDr[0]?.minD ?? null;
  const forecastEnd = fDr[0]?.maxD ?? null;

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

  const baseF = listFilter(locationId, clientId);
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

export async function exportStandardVsForecastCsv({ locationId, clientId, credentials }) {
  const result = await getStandardVsForecastSummary({ locationId, clientId, credentials });
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

export async function exportStandardVsForecastPdf({ locationId, clientId, credentials }) {
  const result = await getStandardVsForecastSummary({ locationId, clientId, credentials });
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
