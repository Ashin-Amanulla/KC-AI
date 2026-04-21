import mongoose from 'mongoose';
import { parse } from 'csv-parse/sync';
import { config } from '../../config/index.js';
import { Location } from '../locations/location.model.js';
import {
  buildLookupMaps,
  fetchAllClients,
  fetchAllStaff,
} from './directory.service.js';
import {
  buildNormalizedColumns,
  getRowValue,
  moneyEqual,
  parseBoolean,
  parseDate,
  parseDateTime,
  parseDecimal,
  roundMoney,
  validateHeaders,
} from './csvForecastActuals.js';
import { ForecastRecord } from './forecastRecord.model.js';
import { ActualsRecord } from './actualsRecord.model.js';
import { buildSummaryPdf } from './summaryPdf.js';

const PAGE_SIZE = () => config.forecastActuals.pageSize;

function locObjectId(locationId) {
  return new mongoose.Types.ObjectId(locationId);
}

function listFilter(locationId, staffId, clientId) {
  const q = { location: locObjectId(locationId) };
  if (staffId && staffId !== 'all') q.staffDirectoryId = staffId;
  if (clientId && clientId !== 'all') q.clientDirectoryId = clientId;
  return q;
}

function shiftcareMatchExtras(locationId, staffId, clientId) {
  const m = {
    location: locObjectId(locationId),
    shiftcareId: { $nin: [null, ''] },
  };
  if (staffId && staffId !== 'all') m.staffDirectoryId = staffId;
  if (clientId && clientId !== 'all') m.clientDirectoryId = clientId;
  return m;
}

export async function getDirectoryOptions(credentials) {
  const [clients, staff] = await Promise.all([
    fetchAllClients(credentials),
    fetchAllStaff(credentials),
  ]);
  return {
    staff: [{ value: 'all', label: 'All Staff' }].concat(
      staff.map((s) => ({ value: s.id, label: s.displayName }))
    ),
    clients: [{ value: 'all', label: 'All Clients' }].concat(
      clients.map((c) => ({ value: c.id, label: c.displayName }))
    ),
  };
}

function processRowCommon(row, normalizedColumns, staffMap, clientMap, rowNum) {
  const getVal = (col) => getRowValue(row, col, normalizedColumns);

  const clientName = getVal('client name');
  const dateStr = getVal('date');
  const staffName = getVal('staff');
  const startTimeStr = getVal('start date time');
  const endTimeStr = getVal('end date time');
  const durationStr = getVal('duration');
  const costStr = getVal('cost');
  const totalCostStr = getVal('total cost');
  const shiftId = getVal('shift id');
  const shiftDesc = getVal('shift');
  const additionalCostStr = getVal('additional cost');
  const kmsStr = getVal('kms');
  const absentStr = getVal('absent');
  const status = getVal('status');
  const invoiceNos = getVal('invoice nos.');
  const rateGroups = getVal('rate groups');
  const referenceNo = getVal('reference no');
  const shiftType = getVal('shift type');
  const additionalShiftType = getVal('additional shift type');
  const clientType = getVal('client type');

  let staffEntry = null;
  if (staffName) {
    staffEntry = staffMap.get(staffName.toLowerCase()) || null;
  }

  if (!clientName) return { error: `Row ${rowNum}: Client name is required` };

  const clientEntry = clientMap.get(clientName.toLowerCase());
  if (!clientEntry) return { error: `Row ${rowNum}: Client '${clientName}' not found` };

  const shiftDate = parseDate(dateStr);
  if (!shiftDate) return { error: `Row ${rowNum}: Invalid date format '${dateStr}'` };

  const startDatetime = parseDateTime(startTimeStr);
  if (!startDatetime) return { error: `Row ${rowNum}: Invalid start time format '${startTimeStr}'` };

  const endDatetime = parseDateTime(endTimeStr);
  if (!endDatetime) return { error: `Row ${rowNum}: Invalid end time format '${endTimeStr}'` };

  if (endDatetime <= startDatetime) {
    return { error: `Row ${rowNum}: End time must be after start time` };
  }

  const duration = parseDecimal(durationStr);
  if (duration == null) return { error: `Row ${rowNum}: Invalid duration '${durationStr}'` };

  const cost = parseDecimal(costStr);
  if (cost == null) return { error: `Row ${rowNum}: Invalid cost '${costStr}'` };

  const totalCost = parseDecimal(totalCostStr);
  if (totalCost == null) return { error: `Row ${rowNum}: Invalid total cost '${totalCostStr}'` };

  const additionalCost = parseDecimal(additionalCostStr) ?? 0;
  const kms = parseDecimal(kmsStr) ?? 0;
  const isAbsent = parseBoolean(absentStr);

  return {
    doc: {
      clientDirectoryId: clientEntry.id,
      staffDirectoryId: staffEntry ? staffEntry.id : null,
      clientName,
      staffName,
      shiftDescription: shiftDesc,
      shiftcareId: shiftId,
      shiftDate,
      startDatetime,
      endDatetime,
      duration: roundMoney(duration),
      cost: roundMoney(cost),
      additionalCost: roundMoney(additionalCost),
      kms: roundMoney(kms),
      totalCost: roundMoney(totalCost),
      isAbsent,
      status,
      invoiceNumbers: invoiceNos,
      rateGroups,
      referenceNo,
      shiftType,
      additionalShiftType,
      clientType,
    },
  };
}

export async function uploadForecastFromCsv({
  locationId,
  fileBuffer,
  credentials,
  uploadedBy,
}) {
  const clients = await fetchAllClients(credentials);
  const staff = await fetchAllStaff(credentials);
  const { clientMap, staffMap } = buildLookupMaps(clients, staff);

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
      errors: ['CSV file is empty or has no data rows'],
    };
  }

  const fieldnames = Object.keys(records[0]);
  const normalizedColumns = buildNormalizedColumns(fieldnames);
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

  const locObj = locObjectId(locationId);
  const toInsert = [];
  const errors = [];
  let rowsProcessed = 0;
  let recordsSkipped = 0;
  let rowNum = 1;

  for (const row of records) {
    rowNum += 1;
    rowsProcessed += 1;
    const r = processRowCommon(row, normalizedColumns, staffMap, clientMap, rowNum);
    if (r.error) {
      errors.push(r.error);
      recordsSkipped += 1;
      continue;
    }
    toInsert.push({
      ...r.doc,
      location: locObj,
      uploadedBy: uploadedBy || null,
    });
  }

  if (toInsert.length) {
    await ForecastRecord.deleteMany({ location: locObj });
    await ForecastRecord.insertMany(toInsert);
  }

  return {
    success: true,
    rowsProcessed,
    recordsCreated: toInsert.length,
    recordsSkipped,
    errors: errors.slice(0, 50),
  };
}

export async function uploadActualsFromCsv({
  locationId,
  fileBuffer,
  credentials,
  uploadedBy,
}) {
  const clients = await fetchAllClients(credentials);
  const staff = await fetchAllStaff(credentials);
  const { clientMap, staffMap } = buildLookupMaps(clients, staff);

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
      errors: ['CSV file is empty or has no data rows'],
    };
  }

  const fieldnames = Object.keys(records[0]);
  const normalizedColumns = buildNormalizedColumns(fieldnames);
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

  const locObj = locObjectId(locationId);
  const toInsert = [];
  const errors = [];
  let rowsProcessed = 0;
  let recordsSkipped = 0;
  let rowNum = 1;

  for (const row of records) {
    rowNum += 1;
    rowsProcessed += 1;
    const r = processRowCommon(row, normalizedColumns, staffMap, clientMap, rowNum);
    if (r.error) {
      errors.push(r.error);
      recordsSkipped += 1;
      continue;
    }
    toInsert.push({
      ...r.doc,
      location: locObj,
      uploadedBy: uploadedBy || null,
    });
  }

  if (toInsert.length) {
    await ActualsRecord.deleteMany({ location: locObj });
    await ActualsRecord.insertMany(toInsert);
  }

  return {
    success: true,
    rowsProcessed,
    recordsCreated: toInsert.length,
    recordsSkipped,
    errors: errors.slice(0, 50),
  };
}

function serializeDoc(d) {
  if (!d) return null;
  const o = d.toObject ? d.toObject() : { ...d };
  o.id = String(o._id);
  delete o._id;
  delete o.__v;
  return o;
}

export async function listForecast({ locationId, staffId, clientId, page }) {
  const filter = listFilter(locationId, staffId, clientId);
  const sort = { shiftDate: -1, startDatetime: -1 };
  const total = await ForecastRecord.countDocuments(filter);
  const pageSize = PAGE_SIZE();
  const p = Math.max(1, parseInt(page, 10) || 1);
  const skip = (p - 1) * pageSize;
  const items = await ForecastRecord.find(filter).sort(sort).skip(skip).limit(pageSize).lean();

  const dr = await ForecastRecord.aggregate([
    { $match: { location: locObjectId(locationId) } },
    { $group: { _id: null, minD: { $min: '$shiftDate' }, maxD: { $max: '$shiftDate' } } },
  ]);

  const startIndex = total > 0 ? skip + 1 : 0;
  const endIndex = Math.min(skip + pageSize, total);
  const totalPages = total > 0 ? Math.ceil(total / pageSize) : 1;

  return {
    records: items.map(serializeDoc),
    total,
    page: p,
    pageSize,
    totalPages,
    startIndex,
    endIndex,
    hasNext: p < totalPages,
    hasPrev: p > 1,
    dateRangeStart: dr[0]?.minD ?? null,
    dateRangeEnd: dr[0]?.maxD ?? null,
  };
}

export async function listActuals({ locationId, staffId, clientId, page }) {
  const filter = listFilter(locationId, staffId, clientId);
  const sort = { shiftDate: -1, startDatetime: -1 };
  const total = await ActualsRecord.countDocuments(filter);
  const pageSize = PAGE_SIZE();
  const p = Math.max(1, parseInt(page, 10) || 1);
  const skip = (p - 1) * pageSize;
  const items = await ActualsRecord.find(filter).sort(sort).skip(skip).limit(pageSize).lean();

  const dr = await ActualsRecord.aggregate([
    { $match: { location: locObjectId(locationId) } },
    { $group: { _id: null, minD: { $min: '$shiftDate' }, maxD: { $max: '$shiftDate' } } },
  ]);

  const startIndex = total > 0 ? skip + 1 : 0;
  const endIndex = Math.min(skip + pageSize, total);
  const totalPages = total > 0 ? Math.ceil(total / pageSize) : 1;

  return {
    records: items.map(serializeDoc),
    total,
    page: p,
    pageSize,
    totalPages,
    startIndex,
    endIndex,
    hasNext: p < totalPages,
    hasPrev: p > 1,
    dateRangeStart: dr[0]?.minD ?? null,
    dateRangeEnd: dr[0]?.maxD ?? null,
  };
}

function buildSummaryRecord(clientId, clientName, forecastBudget, netActuals, mileage) {
  const fb = roundMoney(Number(forecastBudget) || 0);
  const na = roundMoney(Number(netActuals) || 0);
  const mi = roundMoney(Number(mileage) || 0);
  const gross = roundMoney(na + mi);
  const variance = roundMoney(na - fb);
  let variancePct = null;
  if (fb > 0) {
    variancePct = roundMoney((variance / fb) * 100);
  }
  return {
    clientId,
    clientName,
    forecastBudget: fb,
    netActuals: na,
    mileage: mi,
    grossActuals: gross,
    variance,
    variancePercentage: variancePct,
  };
}

export async function getSummary({ locationId, staffId, clientId, credentials }) {
  const clients = await fetchAllClients(credentials);
  let clientList = clients;
  if (clientId && clientId !== 'all') {
    clientList = clients.filter((c) => c.id === clientId);
  }

  const allClientsMap = new Map(clientList.map((c) => [c.id, c.displayName]));

  const baseF = { location: locObjectId(locationId) };
  const baseA = { location: locObjectId(locationId) };
  if (staffId && staffId !== 'all') {
    baseF.staffDirectoryId = staffId;
    baseA.staffDirectoryId = staffId;
  }
  if (clientId && clientId !== 'all') {
    baseF.clientDirectoryId = clientId;
    baseA.clientDirectoryId = clientId;
  }

  const fAgg = await ForecastRecord.aggregate([
    { $match: baseF },
    {
      $group: {
        _id: '$clientDirectoryId',
        forecast_budget: { $sum: '$cost' },
      },
    },
  ]);
  const aAgg = await ActualsRecord.aggregate([
    { $match: baseA },
    {
      $group: {
        _id: '$clientDirectoryId',
        net_actuals: { $sum: '$cost' },
        mileage: { $sum: '$kms' },
      },
    },
  ]);

  const fMap = new Map(fAgg.map((x) => [x._id, x.forecast_budget]));
  const aMap = new Map(
    aAgg.map((x) => [x._id, { net_actuals: x.net_actuals, mileage: x.mileage }])
  );

  const records = [];
  for (const cid of allClientsMap.keys()) {
    const name = allClientsMap.get(cid);
    const fa = fMap.get(cid) ?? 0;
    const aa = aMap.get(cid) || { net_actuals: 0, mileage: 0 };
    records.push(
      buildSummaryRecord(cid, name, fa, aa.net_actuals ?? 0, aa.mileage ?? 0)
    );
  }
  records.sort((a, b) => a.clientName.localeCompare(b.clientName, undefined, { sensitivity: 'base' }));

  const totals = buildSummaryRecord(
    null,
    'TOTAL',
    records.reduce((s, r) => s + r.forecastBudget, 0),
    records.reduce((s, r) => s + r.netActuals, 0),
    records.reduce((s, r) => s + r.mileage, 0)
  );

  const fDr = await ForecastRecord.aggregate([
    { $match: { location: locObjectId(locationId) } },
    { $group: { _id: null, minD: { $min: '$shiftDate' }, maxD: { $max: '$shiftDate' } } },
  ]);
  const aDr = await ActualsRecord.aggregate([
    { $match: { location: locObjectId(locationId) } },
    { $group: { _id: null, minD: { $min: '$shiftDate' }, maxD: { $max: '$shiftDate' } } },
  ]);

  return {
    records,
    totals,
    forecastDateRangeStart: fDr[0]?.minD ?? null,
    forecastDateRangeEnd: fDr[0]?.maxD ?? null,
    actualsDateRangeStart: aDr[0]?.minD ?? null,
    actualsDateRangeEnd: aDr[0]?.maxD ?? null,
  };
}

export async function exportForecastCsv({ locationId, staffId, clientId, timezone }) {
  const filter = listFilter(locationId, staffId, clientId);
  const rows = await ForecastRecord.find(filter).sort({ shiftDate: 1, startDatetime: 1 }).lean();

  const lines = [
    [
      'Date',
      'Staff Name',
      'Client Name',
      'Start Time',
      'End Time',
      'Duration (hrs)',
      'Cost',
      'Additional Cost',
      'Total Cost',
      'Status',
      'Shift Type',
    ].join(','),
  ];

  const tz = timezone || 'Australia/Brisbane';
  for (const r of rows) {
    const sd = r.shiftDate ? new Date(r.shiftDate) : null;
    const dateStr = sd
      ? sd.toLocaleDateString('en-AU', { timeZone: tz, day: '2-digit', month: '2-digit', year: 'numeric' })
      : '';
    const st = r.startDatetime ? new Date(r.startDatetime) : null;
    const en = r.endDatetime ? new Date(r.endDatetime) : null;
    const startStr = st
      ? st.toLocaleTimeString('en-AU', { timeZone: tz, hour: '2-digit', minute: '2-digit', hour12: false })
      : '';
    const endStr = en
      ? en.toLocaleTimeString('en-AU', { timeZone: tz, hour: '2-digit', minute: '2-digit', hour12: false })
      : '';

    lines.push(
      [
        dateStr,
        csvEscape(r.staffName || ''),
        csvEscape(r.clientName || ''),
        startStr,
        endStr,
        r.duration,
        r.cost,
        r.additionalCost,
        r.totalCost,
        csvEscape(r.status || ''),
        csvEscape(r.shiftType || ''),
      ].join(',')
    );
  }

  const loc = await Location.findById(locationId).select('code').lean();
  const code = (loc?.code || 'loc').toLowerCase();
  const ts = new Date().toISOString().replace(/[-:]/g, '').slice(0, 15);
  const filename = `forecast_${code}_${ts}.csv`;
  return { filename, body: '\uFEFF' + lines.join('\n') };
}

export async function exportActualsCsv({ locationId, staffId, clientId, timezone }) {
  const filter = listFilter(locationId, staffId, clientId);
  const rows = await ActualsRecord.find(filter).sort({ shiftDate: 1, startDatetime: 1 }).lean();

  const lines = [
    [
      'Date',
      'Staff Name',
      'Client Name',
      'Start Time',
      'End Time',
      'Duration (hrs)',
      'Cost',
      'Additional Cost',
      'Total Cost',
      'Status',
      'Shift Type',
    ].join(','),
  ];

  const tz = timezone || 'Australia/Brisbane';
  for (const r of rows) {
    const sd = r.shiftDate ? new Date(r.shiftDate) : null;
    const dateStr = sd
      ? sd.toLocaleDateString('en-AU', { timeZone: tz, day: '2-digit', month: '2-digit', year: 'numeric' })
      : '';
    const st = r.startDatetime ? new Date(r.startDatetime) : null;
    const en = r.endDatetime ? new Date(r.endDatetime) : null;
    const startStr = st
      ? st.toLocaleTimeString('en-AU', { timeZone: tz, hour: '2-digit', minute: '2-digit', hour12: false })
      : '';
    const endStr = en
      ? en.toLocaleTimeString('en-AU', { timeZone: tz, hour: '2-digit', minute: '2-digit', hour12: false })
      : '';

    lines.push(
      [
        dateStr,
        csvEscape(r.staffName || ''),
        csvEscape(r.clientName || ''),
        startStr,
        endStr,
        r.duration,
        r.cost,
        r.additionalCost,
        r.totalCost,
        csvEscape(r.status || ''),
        csvEscape(r.shiftType || ''),
      ].join(',')
    );
  }

  const loc = await Location.findById(locationId).select('code').lean();
  const code = (loc?.code || 'loc').toLowerCase();
  const ts = new Date().toISOString().replace(/[-:]/g, '').slice(0, 15);
  const filename = `actuals_${code}_${ts}.csv`;
  return { filename, body: '\uFEFF' + lines.join('\n') };
}

function csvEscape(s) {
  if (s.includes(',') || s.includes('"') || s.includes('\n')) {
    return `"${s.replace(/"/g, '""')}"`;
  }
  return s;
}

export async function exportSummaryCsv({ locationId, staffId, clientId, credentials }) {
  const result = await getSummary({ locationId, staffId, clientId, credentials });
  const lines = [
    ['Client Name', 'Forecast Budget', 'Net Actuals', 'Mileage', 'Gross Actuals', 'Variance', 'Variance %'].join(
      ','
    ),
  ];
  for (const r of result.records) {
    const pct = r.variancePercentage != null ? `${r.variancePercentage.toFixed(2)}%` : '';
    lines.push(
      [
        csvEscape(r.clientName),
        r.forecastBudget.toFixed(2),
        r.netActuals.toFixed(2),
        r.mileage.toFixed(2),
        r.grossActuals.toFixed(2),
        r.variance.toFixed(2),
        pct,
      ].join(',')
    );
  }
  const t = result.totals;
  const tpct = t.variancePercentage != null ? `${t.variancePercentage.toFixed(2)}%` : '';
  lines.push(
    [
      csvEscape(t.clientName),
      t.forecastBudget.toFixed(2),
      t.netActuals.toFixed(2),
      t.mileage.toFixed(2),
      t.grossActuals.toFixed(2),
      t.variance.toFixed(2),
      tpct,
    ].join(',')
  );

  const loc = await Location.findById(locationId).select('code').lean();
  const code = (loc?.code || 'loc').toLowerCase();
  const ts = new Date().toISOString().replace(/[-:]/g, '').slice(0, 15);
  const filename = `summary_${code}_${ts}.csv`;
  return { filename, body: '\uFEFF' + lines.join('\n') };
}

export async function exportSummaryPdf({ locationId, staffId, clientId, credentials }) {
  const loc = await Location.findById(locationId).select('code timezone').lean();
  const result = await getSummary({ locationId, staffId, clientId, credentials });
  const title = `Forecast vs Actuals Summary - ${loc?.code || ''}`;

  const headers = [
    'Client Name',
    'Forecast Budget',
    'Net Actuals',
    'Mileage',
    'Gross Actuals',
    'Variance',
    'Variance %',
  ];
  const rows = result.records.map((r) => [
    r.clientName,
    `$${r.forecastBudget.toFixed(2)}`,
    `$${r.netActuals.toFixed(2)}`,
    `$${r.mileage.toFixed(2)}`,
    `$${r.grossActuals.toFixed(2)}`,
    `$${r.variance.toFixed(2)}`,
    r.variancePercentage != null ? `${r.variancePercentage.toFixed(2)}%` : '',
  ]);
  const t = result.totals;
  const totalsRow = [
    t.clientName,
    `$${t.forecastBudget.toFixed(2)}`,
    `$${t.netActuals.toFixed(2)}`,
    `$${t.mileage.toFixed(2)}`,
    `$${t.grossActuals.toFixed(2)}`,
    `$${t.variance.toFixed(2)}`,
    t.variancePercentage != null ? `${t.variancePercentage.toFixed(2)}%` : '',
  ];

  const pdfBuffer = await buildSummaryPdf({ title, headers, rows, totalsRow });
  const code = (loc?.code || 'loc').toLowerCase();
  const ts = new Date().toISOString().replace(/[-:]/g, '').slice(0, 15);
  const filename = `summary_${code}_${ts}.pdf`;
  return { filename, body: pdfBuffer };
}

async function getShiftcareIdSets(locationId, staffId, clientId) {
  const m = shiftcareMatchExtras(locationId, staffId, clientId);
  const fIds = await ForecastRecord.distinct('shiftcareId', m);
  const aIds = await ActualsRecord.distinct('shiftcareId', m);
  const forecastIds = new Set(fIds.filter((id) => id != null && String(id).trim() !== ''));
  const actualsIds = new Set(aIds.filter((id) => id != null && String(id).trim() !== ''));
  return { forecastIds, actualsIds };
}

function computeDiffFields(fRec, aRec) {
  const diff = [];
  const t = (d) => (d ? new Date(d).getTime() : 0);
  if (t(fRec.startDatetime) !== t(aRec.startDatetime)) diff.push('start_datetime');
  if (t(fRec.endDatetime) !== t(aRec.endDatetime)) diff.push('end_datetime');
  if (!moneyEqual(fRec.duration, aRec.duration)) diff.push('duration');
  if (!moneyEqual(fRec.cost, aRec.cost)) diff.push('cost');
  if (!moneyEqual(fRec.totalCost, aRec.totalCost)) diff.push('total_cost');
  if (String(fRec.rateGroups || '') !== String(aRec.rateGroups || '')) diff.push('rate_groups');
  if (String(fRec.referenceNo || '') !== String(aRec.referenceNo || '')) diff.push('reference_no');
  return diff;
}

async function aggregateByShiftcareId(Model, locationId, shiftcareIds, staffId, clientId, source) {
  const ids = [...shiftcareIds].filter((x) => x != null && String(x).trim() !== '');
  if (!ids.length) return new Map();

  const match = {
    ...shiftcareMatchExtras(locationId, staffId, clientId),
    shiftcareId: { $in: ids },
  };

  const pipeline = [
    { $match: match },
    { $sort: { startDatetime: 1 } },
    {
      $group: {
        _id: '$shiftcareId',
        minStart: { $min: '$startDatetime' },
        maxEnd: { $max: '$endDatetime' },
        sumDuration: { $sum: '$duration' },
        sumCost: { $sum: '$cost' },
        sumTotalCost: { $sum: '$totalCost' },
        shiftDescription: { $first: '$shiftDescription' },
        rateGroups: { $first: '$rateGroups' },
        referenceNo: { $first: '$referenceNo' },
      },
    },
  ];

  const agg = await Model.aggregate(pipeline);
  const map = new Map();
  for (const item of agg) {
    map.set(item._id, {
      shiftcareId: item._id,
      shiftDescription: item.shiftDescription || '',
      startDatetime: item.minStart,
      endDatetime: item.maxEnd,
      duration: roundMoney(item.sumDuration || 0),
      cost: roundMoney(item.sumCost || 0),
      totalCost: roundMoney(item.sumTotalCost || 0),
      rateGroups: item.rateGroups || '',
      referenceNo: item.referenceNo || '',
      source,
      diffFields: [],
      recordType: '',
    });
  }
  return map;
}

export async function listVariance({ locationId, tab, staffId, clientId, page }) {
  const pageSize = PAGE_SIZE();
  const p = Math.max(1, parseInt(page, 10) || 1);
  const t = ['all', 'deleted', 'additional', 'variance'].includes(tab) ? tab : 'all';

  const { forecastIds, actualsIds } = await getShiftcareIdSets(locationId, staffId, clientId);
  const deletedIds = new Set([...forecastIds].filter((id) => !actualsIds.has(id)));
  const additionalIds = new Set([...actualsIds].filter((id) => !forecastIds.has(id)));
  const commonIds = new Set([...forecastIds].filter((id) => actualsIds.has(id)));

  const varianceIds = new Set();
  if (commonIds.size) {
    const fAgg = await aggregateByShiftcareId(
      ForecastRecord,
      locationId,
      commonIds,
      staffId,
      clientId,
      'forecast'
    );
    const aAgg = await aggregateByShiftcareId(
      ActualsRecord,
      locationId,
      commonIds,
      staffId,
      clientId,
      'actuals'
    );
    for (const sid of commonIds) {
      const f = fAgg.get(sid);
      const a = aAgg.get(sid);
      if (f && a && (!moneyEqual(f.cost, a.cost) || !moneyEqual(f.totalCost, a.totalCost))) {
        varianceIds.add(sid);
      }
    }
  }

  const deletedCount = deletedIds.size;
  const additionalCount = additionalIds.size;
  const varianceCount = varianceIds.size;
  const allCount = deletedCount + additionalCount + varianceCount;

  let records = [];

  if (t === 'all') {
    const deletedAgg = await aggregateByShiftcareId(
      ForecastRecord,
      locationId,
      deletedIds,
      staffId,
      clientId,
      'forecast'
    );
    for (const sid of [...deletedIds].sort()) {
      const rec = deletedAgg.get(sid);
      if (rec) {
        rec.recordType = 'deleted';
        records.push(rec);
      }
    }
    const additionalAgg = await aggregateByShiftcareId(
      ActualsRecord,
      locationId,
      additionalIds,
      staffId,
      clientId,
      'actuals'
    );
    for (const sid of [...additionalIds].sort()) {
      const rec = additionalAgg.get(sid);
      if (rec) {
        rec.recordType = 'additional';
        records.push(rec);
      }
    }
    const sortedVarIds = [...varianceIds].sort();
    const vF = await aggregateByShiftcareId(
      ForecastRecord,
      locationId,
      varianceIds,
      staffId,
      clientId,
      'forecast'
    );
    const vA = await aggregateByShiftcareId(
      ActualsRecord,
      locationId,
      varianceIds,
      staffId,
      clientId,
      'actuals'
    );
    for (const sid of sortedVarIds) {
      const fRec = vF.get(sid);
      const aRec = vA.get(sid);
      if (fRec) {
        fRec.recordType = 'variance';
        records.push(fRec);
      }
      if (aRec && fRec) {
        aRec.recordType = 'variance';
        aRec.diffFields = computeDiffFields(fRec, aRec);
        records.push(aRec);
      } else if (aRec) {
        aRec.recordType = 'variance';
        records.push(aRec);
      }
    }
  } else if (t === 'deleted') {
    const agg = await aggregateByShiftcareId(
      ForecastRecord,
      locationId,
      deletedIds,
      staffId,
      clientId,
      'forecast'
    );
    records = [...agg.values()];
    records.sort((a, b) => a.shiftcareId.localeCompare(b.shiftcareId));
  } else if (t === 'additional') {
    const agg = await aggregateByShiftcareId(
      ActualsRecord,
      locationId,
      additionalIds,
      staffId,
      clientId,
      'actuals'
    );
    records = [...agg.values()];
    records.sort((a, b) => a.shiftcareId.localeCompare(b.shiftcareId));
  } else if (t === 'variance') {
    const sortedVarianceIds = [...varianceIds].sort();
    const pairStart = (p - 1) * pageSize;
    const pairEnd = pairStart + pageSize;
    const pageVarianceIds = new Set(sortedVarianceIds.slice(pairStart, pairEnd));
    const forecastAgg = await aggregateByShiftcareId(
      ForecastRecord,
      locationId,
      pageVarianceIds,
      staffId,
      clientId,
      'forecast'
    );
    const actualsAgg = await aggregateByShiftcareId(
      ActualsRecord,
      locationId,
      pageVarianceIds,
      staffId,
      clientId,
      'actuals'
    );
    for (const sid of sortedVarianceIds.slice(pairStart, pairEnd)) {
      const fRec = forecastAgg.get(sid);
      const aRec = actualsAgg.get(sid);
      if (fRec) records.push(fRec);
      if (aRec && fRec) {
        aRec.diffFields = computeDiffFields(fRec, aRec);
        records.push(aRec);
      } else if (aRec) {
        records.push(aRec);
      }
    }
  }

  let total;
  let pageRecords;
  let startIndex;
  let endIndex;

  if (t === 'variance') {
    total = varianceIds.size;
    const startIdx = (p - 1) * pageSize;
    const endIdx = startIdx + pageSize;
    pageRecords = records;
    startIndex = total > 0 ? startIdx + 1 : 0;
    endIndex = Math.min(endIdx, total);
  } else if (t === 'all') {
    total = allCount;
    const seenIds = [];
    for (const rec of records) {
      if (!seenIds.includes(rec.shiftcareId)) seenIds.push(rec.shiftcareId);
    }
    const startIdx = (p - 1) * pageSize;
    const endIdx = startIdx + pageSize;
    const pageIdSet = new Set(seenIds.slice(startIdx, endIdx));
    pageRecords = records.filter((r) => pageIdSet.has(r.shiftcareId));
    startIndex = total > 0 ? startIdx + 1 : 0;
    endIndex = Math.min(endIdx, total);
  } else {
    total = records.length;
    const startIdx = (p - 1) * pageSize;
    const endIdx = startIdx + pageSize;
    pageRecords = records.slice(startIdx, endIdx);
    startIndex = total > 0 ? startIdx + 1 : 0;
    endIndex = Math.min(endIdx, total);
  }

  const totalPages = total > 0 ? Math.ceil(total / pageSize) : 1;

  const fDr = await ForecastRecord.aggregate([
    { $match: { location: locObjectId(locationId) } },
    { $group: { _id: null, minD: { $min: '$shiftDate' }, maxD: { $max: '$shiftDate' } } },
  ]);
  const aDr = await ActualsRecord.aggregate([
    { $match: { location: locObjectId(locationId) } },
    { $group: { _id: null, minD: { $min: '$shiftDate' }, maxD: { $max: '$shiftDate' } } },
  ]);

  return {
    records: pageRecords.map(serializeVarianceRow),
    total,
    page: p,
    pageSize,
    totalPages,
    startIndex,
    endIndex,
    hasNext: p < totalPages,
    hasPrev: p > 1,
    allCount,
    deletedCount,
    additionalCount,
    varianceCount,
    forecastDateRangeStart: fDr[0]?.minD ?? null,
    forecastDateRangeEnd: fDr[0]?.maxD ?? null,
    actualsDateRangeStart: aDr[0]?.minD ?? null,
    actualsDateRangeEnd: aDr[0]?.maxD ?? null,
  };
}

function serializeVarianceRow(r) {
  return {
    shiftcareId: r.shiftcareId,
    shiftDescription: r.shiftDescription,
    startDatetime: r.startDatetime,
    endDatetime: r.endDatetime,
    duration: r.duration,
    cost: r.cost,
    totalCost: r.totalCost,
    rateGroups: r.rateGroups,
    referenceNo: r.referenceNo,
    source: r.source,
    diffFields: r.diffFields || [],
    recordType: r.recordType || '',
  };
}

export async function exportVarianceCsv({ locationId, staffId, clientId, timezone }) {
  const loc = await Location.findById(locationId).select('code timezone').lean();
  const tz = timezone || loc?.timezone || 'Australia/Brisbane';

  const deletedResult = await listVariance({
    locationId,
    tab: 'deleted',
    staffId,
    clientId,
    page: 1,
  });
  let deletedRecords = deletedResult.records;
  if (deletedResult.totalPages > 1) {
    const all = [];
    for (let i = 1; i <= deletedResult.totalPages; i += 1) {
      const vr = await listVariance({
        locationId,
        tab: 'deleted',
        staffId,
        clientId,
        page: i,
      });
      all.push(...vr.records);
    }
    deletedRecords = all;
  }

  const additionalResult = await listVariance({
    locationId,
    tab: 'additional',
    staffId,
    clientId,
    page: 1,
  });
  let additionalRecords = additionalResult.records;
  if (additionalResult.totalPages > 1) {
    const all = [];
    for (let i = 1; i <= additionalResult.totalPages; i += 1) {
      const vr = await listVariance({
        locationId,
        tab: 'additional',
        staffId,
        clientId,
        page: i,
      });
      all.push(...vr.records);
    }
    additionalRecords = all;
  }

  function formatDt(dt) {
    if (!dt) return '';
    const d = new Date(dt);
    return d.toLocaleString('en-AU', {
      timeZone: tz,
      day: '2-digit',
      month: '2-digit',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
      hour12: false,
    });
  }

  const lines = [['Type', 'Shift ID', 'Shift', 'Start', 'End', 'Duration', 'Cost', 'Total Cost', 'Rate Group', 'Ref No'].join(',')];

  function writeRecord(record, typeLabel) {
    lines.push(
      [
        csvEscape(typeLabel),
        csvEscape(record.shiftcareId),
        csvEscape(record.shiftDescription || ''),
        csvEscape(formatDt(record.startDatetime)),
        csvEscape(formatDt(record.endDatetime)),
        record.duration,
        record.cost,
        record.totalCost,
        csvEscape(record.rateGroups || ''),
        csvEscape(record.referenceNo || ''),
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
    const label = record.source === 'forecast' ? 'Variance - Forecast' : 'Variance - Actuals';
    writeRecord(record, label);
  }

  const code = (loc?.code || 'loc').toLowerCase();
  const ts = new Date().toISOString().replace(/[-:]/g, '').slice(0, 15);
  const filename = `variance_all_${code}_${ts}.csv`;
  return { filename, body: '\uFEFF' + lines.join('\n') };
}

export async function getVarianceDetail({ locationId, shiftcareId }) {
  const locObj = locObjectId(locationId);
  const forecastRecords = await ForecastRecord.find({
    location: locObj,
    shiftcareId,
  })
    .sort({ startDatetime: 1 })
    .lean();
  const actualsRecords = await ActualsRecord.find({
    location: locObj,
    shiftcareId,
  })
    .sort({ startDatetime: 1 })
    .lean();

  const fAgg = await aggregateByShiftcareId(
    ForecastRecord,
    locationId,
    new Set([shiftcareId]),
    'all',
    'all',
    'forecast'
  );
  const aAgg = await aggregateByShiftcareId(
    ActualsRecord,
    locationId,
    new Set([shiftcareId]),
    'all',
    'all',
    'actuals'
  );

  const forecastAgg = fAgg.get(shiftcareId) || null;
  const actualsAgg = aAgg.get(shiftcareId) || null;

  let diffFields = [];
  if (forecastAgg && actualsAgg) {
    diffFields = computeDiffFields(forecastAgg, actualsAgg);
  }

  return {
    shiftcareId,
    diffFields,
    forecastRecords: forecastRecords.map(serializeDoc),
    actualsRecords: actualsRecords.map(serializeDoc),
    forecastAggregated: forecastAgg ? serializeVarianceRow(forecastAgg) : null,
    actualsAggregated: actualsAgg ? serializeVarianceRow(actualsAgg) : null,
  };
}
