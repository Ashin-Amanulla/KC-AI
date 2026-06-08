import mongoose from 'mongoose';
import { config } from '../../config/index.js';
import { parseTabularBuffer } from '../../utils/tabularFile.js';
import { buildTabularExport } from '../../utils/tabularExport.js';
import { Location } from '../locations/location.model.js';
import {
  buildLookupMaps,
  fetchAllClients,
  fetchAllStaff,
} from './directory.service.js';
import {
  buildNormalizedColumns,
  combineDateAndTime,
  formatUtcDateForCsv,
  formatUtcDateTimeForCsv,
  getRowValue,
  resolveForecastShiftTimes,
  isBlankCsvRow,
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
import { normalizeRatio } from '../../utils/normalizeRatio.js';
import { buildVarianceExportRowList } from './varianceExportRows.js';
import { applyShiftDateRange } from './shiftDateRange.js';
import { compareShiftDateRows } from '../../utils/weekdaySort.js';

const PAGE_SIZE = () => config.forecastActuals.pageSize;

function locObjectId(locationId) {
  return new mongoose.Types.ObjectId(locationId);
}

function listFilter(locationId, staffId, clientId, dateFrom, dateTo) {
  const q = { location: locObjectId(locationId) };
  if (staffId && staffId !== 'all') q.staffDirectoryId = staffId;
  if (clientId && clientId !== 'all') q.clientDirectoryId = clientId;
  applyShiftDateRange(q, dateFrom, dateTo);
  return q;
}

function shiftcareMatchExtras(locationId, staffId, clientId, dateFrom, dateTo) {
  const m = {
    location: locObjectId(locationId),
    shiftcareId: { $nin: [null, ''] },
  };
  if (staffId && staffId !== 'all') m.staffDirectoryId = staffId;
  if (clientId && clientId !== 'all') m.clientDirectoryId = clientId;
  applyShiftDateRange(m, dateFrom, dateTo);
  return m;
}

const VARIANCE_PAIR_SEP = '|';
const VARIANCE_START_PREFIX = 'start:';

/** Unique variance identity: shift id + client + start datetime (one CSV row per key). */
export function buildVariancePairKey(shiftcareId, clientDirectoryId, clientName, startDatetime) {
  const sid = String(shiftcareId || '').trim();
  const cid = String(clientDirectoryId || '').trim();
  const clientKey = cid
    ? `id:${cid}`
    : `name:${String(clientName || '').trim().toLowerCase()}`;
  const startMs = startDatetime ? new Date(startDatetime).getTime() : 0;
  return `${sid}${VARIANCE_PAIR_SEP}${clientKey}${VARIANCE_PAIR_SEP}${VARIANCE_START_PREFIX}${startMs}`;
}

export function parseVariancePairKey(pairKey) {
  const raw = String(pairKey || '');
  const parts = raw.split(VARIANCE_PAIR_SEP);
  if (parts.length >= 3 && parts[2].startsWith(VARIANCE_START_PREFIX)) {
    const startMs = parseInt(parts[2].slice(VARIANCE_START_PREFIX.length), 10);
    return {
      shiftcareId: parts[0].trim(),
      clientKey: parts[1],
      startMs: Number.isFinite(startMs) ? startMs : null,
      legacyShiftOnly: false,
    };
  }
  const sep = raw.indexOf(VARIANCE_PAIR_SEP);
  if (sep < 0) {
    return { shiftcareId: raw.trim(), clientKey: null, startMs: null, legacyShiftOnly: true };
  }
  return {
    shiftcareId: raw.slice(0, sep).trim(),
    clientKey: raw.slice(sep + 1),
    startMs: null,
    legacyShiftOnly: true,
  };
}

function pairKeyToRowFilter(pairKey) {
  const { shiftcareId, clientKey, startMs, legacyShiftOnly } = parseVariancePairKey(pairKey);
  const filter = { shiftcareId };
  if (!legacyShiftOnly || clientKey) {
    Object.assign(filter, pairKeyClientFilter(clientKey));
  }
  if (startMs != null) {
    filter.startDatetime = new Date(startMs);
  }
  return filter;
}

function pairKeyClientFilter(clientKey) {
  if (!clientKey) return {};
  if (clientKey.startsWith('id:')) {
    return { clientDirectoryId: clientKey.slice(3) };
  }
  if (clientKey.startsWith('name:')) {
    const name = clientKey.slice(5);
    const escaped = name.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    return { clientName: new RegExp(`^${escaped}$`, 'i') };
  }
  return {};
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

export function processRowCommon(row, normalizedColumns, staffMap, clientMap, rowNum) {
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
  const ratio = getVal('ratio');

  let staffEntry = null;
  if (staffName) {
    staffEntry = staffMap.get(staffName.toLowerCase()) || null;
  }

  if (!clientName) return { error: `Row ${rowNum}: Client name is required` };

  const clientEntry = clientMap.get(clientName.toLowerCase());
  if (!clientEntry) return { error: `Row ${rowNum}: Client '${clientName}' not found` };

  const resolved = resolveForecastShiftTimes({ dateStr, startTimeStr, endTimeStr });
  if (resolved.error === 'invalid_date') {
    return { error: `Row ${rowNum}: Invalid date format '${dateStr}'` };
  }
  if (resolved.error === 'invalid_start') {
    return { error: `Row ${rowNum}: Invalid start time format '${startTimeStr}'` };
  }
  if (resolved.error === 'invalid_end') {
    return { error: `Row ${rowNum}: Invalid end time format '${endTimeStr}'` };
  }
  const { shiftDate, startDatetime, endDatetime } = resolved;

  const duration = parseDecimal(durationStr);
  if (duration == null) return { error: `Row ${rowNum}: Invalid duration '${durationStr}'` };

  const cost = parseDecimal(costStr);
  if (cost == null) return { error: `Row ${rowNum}: Invalid cost '${costStr}'` };

  const totalCostParsed = parseDecimal(totalCostStr);
  const totalCost = totalCostParsed != null ? totalCostParsed : cost;

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
      ratio: normalizeRatio(ratio),
    },
  };
}

/** Build forecast/actuals doc from API body (single-row CRUD) */
export async function buildForecastActualsDocFromBody(body, credentials, errorPrefix = '') {
  const prefix = errorPrefix ? `${errorPrefix}: ` : '';
  const [clients, staff] = await Promise.all([
    fetchAllClients(credentials),
    fetchAllStaff(credentials),
  ]);
  const { clientMap, staffMap } = buildLookupMaps(clients, staff);

  let clientEntry = null;
  if (body.clientDirectoryId) {
    clientEntry = clients.find((c) => c.id === body.clientDirectoryId) || null;
  } else if (body.clientName) {
    clientEntry = clientMap.get(String(body.clientName).toLowerCase()) || null;
  }
  if (!clientEntry) return { error: `${prefix}Client not found` };

  let staffEntry = null;
  if (body.staffDirectoryId) {
    staffEntry = staff.find((s) => s.id === body.staffDirectoryId) || null;
  } else if (body.staffName) {
    staffEntry = staffMap.get(String(body.staffName).toLowerCase()) || null;
  }

  const resolved = resolveForecastShiftTimes({
    dateStr: body.shiftDate || body.date,
    startTimeStr: body.startDatetime || body.startTime,
    endTimeStr: body.endDatetime || body.endTime,
  });
  if (resolved.error === 'invalid_date') return { error: `${prefix}Invalid date` };
  if (resolved.error === 'invalid_start') return { error: `${prefix}Invalid start time` };
  if (resolved.error === 'invalid_end') return { error: `${prefix}Invalid end time` };
  const { shiftDate, startDatetime, endDatetime } = resolved;

  const duration = parseDecimal(body.duration);
  if (duration == null) return { error: `${prefix}Invalid duration` };

  const cost = parseDecimal(body.cost);
  if (cost == null) return { error: `${prefix}Invalid cost` };

  const totalCost = parseDecimal(body.totalCost);
  if (totalCost == null) return { error: `${prefix}Invalid total cost` };

  const additionalCost = parseDecimal(body.additionalCost) ?? 0;
  const kms = parseDecimal(body.kms) ?? 0;
  const isAbsent =
    body.isAbsent === true || body.isAbsent === 'true' || String(body.isAbsent).toLowerCase() === 'yes';

  return {
    doc: {
      clientDirectoryId: clientEntry.id,
      staffDirectoryId: staffEntry ? staffEntry.id : null,
      clientName: body.clientName || clientEntry.displayName,
      staffName: body.staffName || (staffEntry ? staffEntry.displayName : ''),
      shiftDescription: body.shiftDescription || body.shift || '',
      shiftcareId: body.shiftcareId || body.shiftId || '',
      shiftDate,
      startDatetime,
      endDatetime,
      duration: roundMoney(duration),
      cost: roundMoney(cost),
      additionalCost: roundMoney(additionalCost),
      kms: roundMoney(kms),
      totalCost: roundMoney(totalCost),
      isAbsent,
      status: body.status || '',
      invoiceNumbers: body.invoiceNumbers || body.invoiceNos || '',
      rateGroups: body.rateGroups || '',
      referenceNo: body.referenceNo || '',
      shiftType: body.shiftType || '',
      additionalShiftType: body.additionalShiftType || '',
      clientType: body.clientType || '',
      ratio: normalizeRatio(body.ratio),
    },
  };
}

async function findScopedRecord(Model, id, locationId) {
  if (!mongoose.Types.ObjectId.isValid(id)) return null;
  return Model.findOne({ _id: id, location: locObjectId(locationId) });
}

export async function createForecastRecord({ locationId, body, credentials, uploadedBy }) {
  const built = await buildForecastActualsDocFromBody(body, credentials);
  if (built.error) return { success: false, errors: [built.error] };
  const created = await ForecastRecord.create({
    ...built.doc,
    location: locObjectId(locationId),
    uploadedBy: uploadedBy || null,
  });
  return { success: true, record: serializeDoc(created.toObject()) };
}

export async function updateForecastRecord({ id, locationId, body, credentials }) {
  const existing = await findScopedRecord(ForecastRecord, id, locationId);
  if (!existing) return { success: false, errors: ['Record not found'] };
  const built = await buildForecastActualsDocFromBody(body, credentials);
  if (built.error) return { success: false, errors: [built.error] };
  Object.assign(existing, built.doc);
  await existing.save();
  return { success: true, record: serializeDoc(existing.toObject()) };
}

export async function deleteForecastRecord({ id, locationId }) {
  const result = await ForecastRecord.deleteOne({ _id: id, location: locObjectId(locationId) });
  if (result.deletedCount === 0) return { success: false, errors: ['Record not found'] };
  return { success: true };
}

export async function createActualsRecord({ locationId, body, credentials, uploadedBy }) {
  const built = await buildForecastActualsDocFromBody(body, credentials);
  if (built.error) return { success: false, errors: [built.error] };
  const created = await ActualsRecord.create({
    ...built.doc,
    location: locObjectId(locationId),
    uploadedBy: uploadedBy || null,
  });
  return { success: true, record: serializeDoc(created.toObject()) };
}

export async function updateActualsRecord({ id, locationId, body, credentials }) {
  const existing = await findScopedRecord(ActualsRecord, id, locationId);
  if (!existing) return { success: false, errors: ['Record not found'] };
  const built = await buildForecastActualsDocFromBody(body, credentials);
  if (built.error) return { success: false, errors: [built.error] };
  Object.assign(existing, built.doc);
  await existing.save();
  return { success: true, record: serializeDoc(existing.toObject()) };
}

export async function deleteActualsRecord({ id, locationId }) {
  const result = await ActualsRecord.deleteOne({ _id: id, location: locObjectId(locationId) });
  if (result.deletedCount === 0) return { success: false, errors: ['Record not found'] };
  return { success: true };
}

async function uploadForecastActualsFromFile({
  locationId,
  fileBuffer,
  originalFilename,
  uploadedBy,
  Model,
  clientMap,
  staffMap,
}) {
  let records;
  try {
    records = parseTabularBuffer(fileBuffer, originalFilename);
  } catch (e) {
    return {
      success: false,
      rowsProcessed: 0,
      recordsCreated: 0,
      recordsSkipped: 0,
      errors: [`File parsing error: ${e.message}`],
    };
  }

  if (!records.length) {
    return {
      success: false,
      rowsProcessed: 0,
      recordsCreated: 0,
      recordsSkipped: 0,
      errors: ['File is empty or has no data rows'],
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
    if (isBlankCsvRow(row)) continue;
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
    await Model.deleteMany({ location: locObj });
    await Model.insertMany(toInsert);
  }

  return {
    success: toInsert.length > 0,
    rowsProcessed,
    recordsCreated: toInsert.length,
    recordsSkipped,
    errors: errors.slice(0, 50),
  };
}

export async function uploadForecastFromCsv({
  locationId,
  fileBuffer,
  originalFilename = '',
  credentials,
  uploadedBy,
}) {
  const clients = await fetchAllClients(credentials);
  const staff = await fetchAllStaff(credentials);
  const { clientMap, staffMap } = buildLookupMaps(clients, staff);

  return uploadForecastActualsFromFile({
    locationId,
    fileBuffer,
    originalFilename,
    uploadedBy,
    Model: ForecastRecord,
    clientMap,
    staffMap,
  });
}

export async function uploadActualsFromCsv({
  locationId,
  fileBuffer,
  originalFilename = '',
  credentials,
  uploadedBy,
}) {
  const clients = await fetchAllClients(credentials);
  const staff = await fetchAllStaff(credentials);
  const { clientMap, staffMap } = buildLookupMaps(clients, staff);

  return uploadForecastActualsFromFile({
    locationId,
    fileBuffer,
    originalFilename,
    uploadedBy,
    Model: ActualsRecord,
    clientMap,
    staffMap,
  });
}

function serializeDoc(d) {
  if (!d) return null;
  const o = d.toObject ? d.toObject() : { ...d };
  o.id = String(o._id);
  delete o._id;
  delete o.__v;
  if (o.ratio != null) o.ratio = normalizeRatio(o.ratio);
  return o;
}

export async function listForecast({ locationId, staffId, clientId, page, dateFrom, dateTo }) {
  const filter = listFilter(locationId, staffId, clientId, dateFrom, dateTo);
  const sort = { shiftDate: 1, startDatetime: 1 };
  const total = await ForecastRecord.countDocuments(filter);
  const pageSize = PAGE_SIZE();
  const p = Math.max(1, parseInt(page, 10) || 1);
  const skip = (p - 1) * pageSize;
  const items = await ForecastRecord.find(filter).sort(sort).skip(skip).limit(pageSize).lean();

  const dr = await ForecastRecord.aggregate([
    { $match: filter },
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

export async function listActuals({ locationId, staffId, clientId, page, dateFrom, dateTo }) {
  const filter = listFilter(locationId, staffId, clientId, dateFrom, dateTo);
  const sort = { shiftDate: 1, startDatetime: 1 };
  const total = await ActualsRecord.countDocuments(filter);
  const pageSize = PAGE_SIZE();
  const p = Math.max(1, parseInt(page, 10) || 1);
  const skip = (p - 1) * pageSize;
  const items = await ActualsRecord.find(filter).sort(sort).skip(skip).limit(pageSize).lean();

  const dr = await ActualsRecord.aggregate([
    { $match: filter },
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

export function buildSummaryRecord(clientId, clientName, forecastBudget, netActuals, mileage) {
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

export async function getSummary({ locationId, staffId, clientId, credentials, dateFrom, dateTo }) {
  const clients = await fetchAllClients(credentials);
  let clientList = clients;
  if (clientId && clientId !== 'all') {
    clientList = clients.filter((c) => c.id === clientId);
  }

  const allClientsMap = new Map(clientList.map((c) => [c.id, c.displayName]));

  const baseF = listFilter(locationId, staffId, clientId, dateFrom, dateTo);
  const baseA = listFilter(locationId, staffId, clientId, dateFrom, dateTo);

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

  // Totals: sum per-row values (matches KC Studio — not recomputed from aggregate sums)
  const totals = {
    clientId: null,
    clientName: 'TOTAL',
    forecastBudget: roundMoney(records.reduce((s, r) => s + r.forecastBudget, 0)),
    netActuals: roundMoney(records.reduce((s, r) => s + r.netActuals, 0)),
    mileage: roundMoney(records.reduce((s, r) => s + r.mileage, 0)),
    grossActuals: roundMoney(records.reduce((s, r) => s + r.grossActuals, 0)),
    variance: roundMoney(records.reduce((s, r) => s + r.variance, 0)),
    variancePercentage: null,
  };
  if (totals.forecastBudget > 0) {
    totals.variancePercentage = roundMoney((totals.variance / totals.forecastBudget) * 100);
  }

  const fDr = await ForecastRecord.aggregate([
    { $match: baseF },
    { $group: { _id: null, minD: { $min: '$shiftDate' }, maxD: { $max: '$shiftDate' } } },
  ]);
  const aDr = await ActualsRecord.aggregate([
    { $match: baseA },
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

/** Aligned with `csvForecastActuals` + `processRowCommon` (import) column names */
const FORECAST_ACTUALS_EXPORT_HEADERS = [
  'client name',
  'date',
  'staff',
  'start date time',
  'end date time',
  'duration',
  'cost',
  'total cost',
  'shift id',
  'shift',
  'additional cost',
  'kms',
  'absent',
  'status',
  'invoice nos.',
  'rate groups',
  'reference no',
  'shift type',
  'additional shift type',
  'client type',
  'ratio',
];

function forecastActualsRowToExportArray(r) {
  return [
    r.clientName || '',
    formatUtcDateForCsv(r.shiftDate),
    r.staffName || '',
    formatUtcDateTimeForCsv(r.startDatetime),
    formatUtcDateTimeForCsv(r.endDatetime),
    r.duration ?? '',
    r.cost ?? '',
    r.totalCost ?? '',
    r.shiftcareId || '',
    r.shiftDescription || '',
    r.additionalCost ?? '',
    r.kms ?? '',
    r.isAbsent ? 'Yes' : 'No',
    r.status || '',
    r.invoiceNumbers || '',
    r.rateGroups || '',
    r.referenceNo || '',
    r.shiftType || '',
    r.additionalShiftType || '',
    r.clientType || '',
    normalizeRatio(r.ratio || ''),
  ];
}

export async function exportForecastCsv({
  locationId,
  staffId,
  clientId,
  timezone,
  dateFrom,
  dateTo,
  format = 'csv',
}) {
  const filter = listFilter(locationId, staffId, clientId, dateFrom, dateTo);
  const rows = await ForecastRecord.find(filter).sort({ shiftDate: 1, startDatetime: 1 }).lean();
  const loc = await Location.findById(locationId).select('code').lean();
  const code = (loc?.code || 'loc').toLowerCase();
  const ts = new Date().toISOString().replace(/[-:]/g, '').slice(0, 15);
  return buildTabularExport({
    headers: FORECAST_ACTUALS_EXPORT_HEADERS,
    rows: rows.map((r) => forecastActualsRowToExportArray(r)),
    baseFilename: `forecast_${code}_${ts}`,
    format,
  });
}

export async function exportActualsCsv({
  locationId,
  staffId,
  clientId,
  timezone,
  dateFrom,
  dateTo,
  format = 'csv',
}) {
  const filter = listFilter(locationId, staffId, clientId, dateFrom, dateTo);
  const rows = await ActualsRecord.find(filter).sort({ shiftDate: 1, startDatetime: 1 }).lean();
  const loc = await Location.findById(locationId).select('code').lean();
  const code = (loc?.code || 'loc').toLowerCase();
  const ts = new Date().toISOString().replace(/[-:]/g, '').slice(0, 15);
  return buildTabularExport({
    headers: FORECAST_ACTUALS_EXPORT_HEADERS,
    rows: rows.map((r) => forecastActualsRowToExportArray(r)),
    baseFilename: `actuals_${code}_${ts}`,
    format,
  });
}

export async function exportSummaryCsv({
  locationId,
  staffId,
  clientId,
  credentials,
  dateFrom,
  dateTo,
  format = 'csv',
}) {
  const result = await getSummary({ locationId, staffId, clientId, credentials, dateFrom, dateTo });
  const headers = [
    'Client Name',
    'Forecast Budget',
    'Net Actuals',
    'Mileage',
    'Gross Actuals',
    'Variance',
    'Variance %',
  ];
  const dataRows = result.records.map((r) => [
    r.clientName,
    r.forecastBudget.toFixed(2),
    r.netActuals.toFixed(2),
    r.mileage.toFixed(2),
    r.grossActuals.toFixed(2),
    r.variance.toFixed(2),
    r.variancePercentage != null ? `${r.variancePercentage.toFixed(2)}%` : '',
  ]);
  const t = result.totals;
  dataRows.push([
    t.clientName,
    t.forecastBudget.toFixed(2),
    t.netActuals.toFixed(2),
    t.mileage.toFixed(2),
    t.grossActuals.toFixed(2),
    t.variance.toFixed(2),
    t.variancePercentage != null ? `${t.variancePercentage.toFixed(2)}%` : '',
  ]);

  const loc = await Location.findById(locationId).select('code').lean();
  const code = (loc?.code || 'loc').toLowerCase();
  const ts = new Date().toISOString().replace(/[-:]/g, '').slice(0, 15);
  return buildTabularExport({
    headers,
    rows: dataRows,
    baseFilename: `summary_${code}_${ts}`,
    format,
  });
}

export async function exportSummaryPdf({ locationId, staffId, clientId, credentials, dateFrom, dateTo }) {
  const loc = await Location.findById(locationId).select('code timezone').lean();
  const result = await getSummary({ locationId, staffId, clientId, credentials, dateFrom, dateTo });
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

async function getVariancePairKeySets(locationId, staffId, clientId, dateFrom, dateTo) {
  const m = shiftcareMatchExtras(locationId, staffId, clientId, dateFrom, dateTo);
  const collect = async (Model) => {
    const rows = await Model.find(m)
      .select('shiftcareId clientDirectoryId clientName startDatetime')
      .lean();
    return rows
      .filter((r) => String(r.shiftcareId || '').trim() !== '')
      .map((r) =>
        buildVariancePairKey(r.shiftcareId, r.clientDirectoryId, r.clientName, r.startDatetime)
      );
  };
  const [fKeys, aKeys] = await Promise.all([collect(ForecastRecord), collect(ActualsRecord)]);
  return {
    forecastKeys: new Set(fKeys),
    actualsKeys: new Set(aKeys),
  };
}

function rowToVarianceView(row, source, variancePairKey) {
  return {
    variancePairKey,
    shiftcareId: row.shiftcareId,
    shiftDate: row.shiftDate,
    clientName: row.clientName || '',
    clientDirectoryId: row.clientDirectoryId || '',
    startDatetime: row.startDatetime,
    endDatetime: row.endDatetime,
    duration: row.duration,
    cost: row.cost,
    totalCost: row.totalCost,
    rateGroups: row.rateGroups || '',
    shiftType: row.shiftType || '',
    ratio: row.ratio || '',
    source,
    diffFields: [],
    recordType: '',
  };
}

/** Load one row per variance pair key (no min/max merge across times). */
async function buildVarianceRowMap(Model, locationId, pairKeys, staffId, clientId, source, dateFrom, dateTo) {
  const keySet = new Set([...pairKeys].filter((k) => k != null && String(k).trim() !== ''));
  if (!keySet.size) return new Map();

  const rows = await Model.find(shiftcareMatchExtras(locationId, staffId, clientId, dateFrom, dateTo)).lean();
  const map = new Map();
  for (const row of rows) {
    const pk = buildVariancePairKey(
      row.shiftcareId,
      row.clientDirectoryId,
      row.clientName,
      row.startDatetime
    );
    if (!keySet.has(pk) || map.has(pk)) continue;
    map.set(pk, rowToVarianceView(row, source, pk));
  }
  return map;
}

function computeDiffFields(fRec, aRec) {
  const diff = [];
  const t = (d) => (d ? new Date(d).getTime() : 0);
  if (t(fRec.shiftDate) !== t(aRec.shiftDate)) diff.push('shift_date');
  if (t(fRec.startDatetime) !== t(aRec.startDatetime)) diff.push('start_datetime');
  if (t(fRec.endDatetime) !== t(aRec.endDatetime)) diff.push('end_datetime');
  if (!moneyEqual(fRec.duration, aRec.duration)) diff.push('duration');
  if (!moneyEqual(fRec.totalCost, aRec.totalCost)) diff.push('total_cost');
  if (String(fRec.rateGroups || '') !== String(aRec.rateGroups || '')) diff.push('rate_groups');
  if (String(fRec.shiftType || '') !== String(aRec.shiftType || '')) diff.push('shift_type');
  if (normalizeRatio(fRec.ratio) !== normalizeRatio(aRec.ratio)) diff.push('ratio');
  return diff;
}

async function buildVarianceExportRecords({ locationId, staffId, clientId, dateFrom, dateTo }) {
  const { forecastKeys, actualsKeys } = await getVariancePairKeySets(
    locationId,
    staffId,
    clientId,
    dateFrom,
    dateTo
  );
  const deletedKeys = new Set([...forecastKeys].filter((k) => !actualsKeys.has(k)));
  const additionalKeys = new Set([...actualsKeys].filter((k) => !forecastKeys.has(k)));
  const commonKeys = new Set([...forecastKeys].filter((k) => actualsKeys.has(k)));

  const varianceKeys = new Set();
  let commonForecastAgg = new Map();
  let commonActualsAgg = new Map();
  if (commonKeys.size) {
    commonForecastAgg = await buildVarianceRowMap(
      ForecastRecord,
      locationId,
      commonKeys,
      staffId,
      clientId,
      'forecast',
      dateFrom,
      dateTo
    );
    commonActualsAgg = await buildVarianceRowMap(
      ActualsRecord,
      locationId,
      commonKeys,
      staffId,
      clientId,
      'actuals',
      dateFrom,
      dateTo
    );
    for (const pairKey of commonKeys) {
      const f = commonForecastAgg.get(pairKey);
      const a = commonActualsAgg.get(pairKey);
      if (f && a && computeDiffFields(f, a).length > 0) {
        varianceKeys.add(pairKey);
      }
    }
  }

  const [deletedAgg, additionalAgg, vF, vA] = await Promise.all([
    buildVarianceRowMap(
      ForecastRecord,
      locationId,
      deletedKeys,
      staffId,
      clientId,
      'forecast',
      dateFrom,
      dateTo
    ),
    buildVarianceRowMap(
      ActualsRecord,
      locationId,
      additionalKeys,
      staffId,
      clientId,
      'actuals',
      dateFrom,
      dateTo
    ),
    buildVarianceRowMap(
      ForecastRecord,
      locationId,
      varianceKeys,
      staffId,
      clientId,
      'forecast',
      dateFrom,
      dateTo
    ),
    buildVarianceRowMap(
      ActualsRecord,
      locationId,
      varianceKeys,
      staffId,
      clientId,
      'actuals',
      dateFrom,
      dateTo
    ),
  ]);

  const deletedRecords = [];
  for (const pairKey of deletedKeys) {
    const rec = deletedAgg.get(pairKey);
    if (rec) {
      rec.recordType = 'deleted';
      deletedRecords.push(rec);
    }
  }
  deletedRecords.sort(compareShiftDateRows);

  const additionalRecords = [];
  for (const pairKey of additionalKeys) {
    const rec = additionalAgg.get(pairKey);
    if (rec) {
      rec.recordType = 'additional';
      additionalRecords.push(rec);
    }
  }
  additionalRecords.sort(compareShiftDateRows);

  const varianceRecords = [];
  for (const pairKey of varianceKeys) {
    const fRec = vF.get(pairKey);
    const aRec = vA.get(pairKey);
    if (fRec) {
      fRec.recordType = 'variance';
      varianceRecords.push(fRec);
    }
    if (aRec && fRec) {
      aRec.recordType = 'variance';
      aRec.diffFields = computeDiffFields(fRec, aRec);
      varianceRecords.push(aRec);
    } else if (aRec) {
      aRec.recordType = 'variance';
      varianceRecords.push(aRec);
    }
  }
  varianceRecords.sort(compareShiftDateRows);

  return {
    deletedRecords,
    additionalRecords,
    varianceRecords,
    deletedCount: deletedKeys.size,
    additionalCount: additionalKeys.size,
    varianceCount: varianceKeys.size,
  };
}


export async function listVariance({ locationId, tab, staffId, clientId, page, dateFrom, dateTo }) {
  const pageSize = PAGE_SIZE();
  const p = Math.max(1, parseInt(page, 10) || 1);
  const t = ['all', 'deleted', 'additional', 'variance'].includes(tab) ? tab : 'all';

  const { forecastKeys, actualsKeys } = await getVariancePairKeySets(
    locationId,
    staffId,
    clientId,
    dateFrom,
    dateTo
  );
  const deletedKeys = new Set([...forecastKeys].filter((k) => !actualsKeys.has(k)));
  const additionalKeys = new Set([...actualsKeys].filter((k) => !forecastKeys.has(k)));
  const commonKeys = new Set([...forecastKeys].filter((k) => actualsKeys.has(k)));

  const varianceKeys = new Set();
  if (commonKeys.size) {
    const fAgg = await buildVarianceRowMap(
      ForecastRecord,
      locationId,
      commonKeys,
      staffId,
      clientId,
      'forecast',
      dateFrom,
      dateTo
    );
    const aAgg = await buildVarianceRowMap(
      ActualsRecord,
      locationId,
      commonKeys,
      staffId,
      clientId,
      'actuals',
      dateFrom,
      dateTo
    );
    for (const pairKey of commonKeys) {
      const f = fAgg.get(pairKey);
      const a = aAgg.get(pairKey);
      if (f && a && computeDiffFields(f, a).length > 0) {
        varianceKeys.add(pairKey);
      }
    }
  }

  const deletedCount = deletedKeys.size;
  const additionalCount = additionalKeys.size;
  const varianceCount = varianceKeys.size;
  const allCount = deletedCount + additionalCount + varianceCount;

  let records = [];

  if (t === 'all') {
    const deletedAgg = await buildVarianceRowMap(
      ForecastRecord,
      locationId,
      deletedKeys,
      staffId,
      clientId,
      'forecast',
      dateFrom,
      dateTo
    );
    for (const pairKey of [...deletedKeys]) {
      const rec = deletedAgg.get(pairKey);
      if (rec) {
        rec.recordType = 'deleted';
        records.push(rec);
      }
    }
    const additionalAgg = await buildVarianceRowMap(
      ActualsRecord,
      locationId,
      additionalKeys,
      staffId,
      clientId,
      'actuals',
      dateFrom,
      dateTo
    );
    for (const pairKey of [...additionalKeys]) {
      const rec = additionalAgg.get(pairKey);
      if (rec) {
        rec.recordType = 'additional';
        records.push(rec);
      }
    }
    const sortedVarKeys = [...varianceKeys];
    const vF = await buildVarianceRowMap(
      ForecastRecord,
      locationId,
      varianceKeys,
      staffId,
      clientId,
      'forecast',
      dateFrom,
      dateTo
    );
    const vA = await buildVarianceRowMap(
      ActualsRecord,
      locationId,
      varianceKeys,
      staffId,
      clientId,
      'actuals',
      dateFrom,
      dateTo
    );
    for (const pairKey of sortedVarKeys) {
      const fRec = vF.get(pairKey);
      const aRec = vA.get(pairKey);
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
    records.sort(compareShiftDateRows);
  } else if (t === 'deleted') {
    const agg = await buildVarianceRowMap(
      ForecastRecord,
      locationId,
      deletedKeys,
      staffId,
      clientId,
      'forecast',
      dateFrom,
      dateTo
    );
    records = [...agg.values()];
    records.sort(compareShiftDateRows);
  } else if (t === 'additional') {
    const agg = await buildVarianceRowMap(
      ActualsRecord,
      locationId,
      additionalKeys,
      staffId,
      clientId,
      'actuals',
      dateFrom,
      dateTo
    );
    records = [...agg.values()];
    records.sort(compareShiftDateRows);
  } else if (t === 'variance') {
    const forecastAgg = await buildVarianceRowMap(
      ForecastRecord,
      locationId,
      varianceKeys,
      staffId,
      clientId,
      'forecast',
      dateFrom,
      dateTo
    );
    const actualsAgg = await buildVarianceRowMap(
      ActualsRecord,
      locationId,
      varianceKeys,
      staffId,
      clientId,
      'actuals',
      dateFrom,
      dateTo
    );
    const sortedVarianceKeys = [...varianceKeys].sort((a, b) => {
      const ra = forecastAgg.get(a) || actualsAgg.get(a) || {};
      const rb = forecastAgg.get(b) || actualsAgg.get(b) || {};
      return compareShiftDateRows(ra, rb);
    });
    const pairStart = (p - 1) * pageSize;
    const pairEnd = pairStart + pageSize;
    for (const pairKey of sortedVarianceKeys.slice(pairStart, pairEnd)) {
      const fRec = forecastAgg.get(pairKey);
      const aRec = actualsAgg.get(pairKey);
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
    total = varianceKeys.size;
    const startIdx = (p - 1) * pageSize;
    const endIdx = startIdx + pageSize;
    pageRecords = records;
    startIndex = total > 0 ? startIdx + 1 : 0;
    endIndex = Math.min(endIdx, total);
  } else if (t === 'all') {
    total = allCount;
    const seenIds = [];
    for (const rec of records) {
      const pk = rec.variancePairKey || rec.shiftcareId;
      if (!seenIds.includes(pk)) seenIds.push(pk);
    }
    const startIdx = (p - 1) * pageSize;
    const endIdx = startIdx + pageSize;
    const pageIdSet = new Set(seenIds.slice(startIdx, endIdx));
    pageRecords = records.filter((r) => pageIdSet.has(r.variancePairKey || r.shiftcareId));
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

  const fMatch = listFilter(locationId, staffId, clientId, dateFrom, dateTo);
  const aMatch = listFilter(locationId, staffId, clientId, dateFrom, dateTo);
  const fDr = await ForecastRecord.aggregate([
    { $match: fMatch },
    { $group: { _id: null, minD: { $min: '$shiftDate' }, maxD: { $max: '$shiftDate' } } },
  ]);
  const aDr = await ActualsRecord.aggregate([
    { $match: aMatch },
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
    variancePairKey: r.variancePairKey || r.shiftcareId,
    shiftcareId: r.shiftcareId,
    shiftDate: r.shiftDate,
    clientName: r.clientName,
    startDatetime: r.startDatetime,
    endDatetime: r.endDatetime,
    duration: r.duration,
    totalCost: r.totalCost,
    rateGroups: r.rateGroups,
    shiftType: r.shiftType,
    ratio: r.ratio,
    source: r.source,
    diffFields: r.diffFields || [],
    recordType: r.recordType || '',
  };
}

export async function exportVarianceCsv({
  locationId,
  staffId,
  clientId,
  dateFrom,
  dateTo,
  format = 'csv',
}) {
  const loc = await Location.findById(locationId).select('code timezone').lean();
  const { deletedRecords, additionalRecords, varianceRecords } = await buildVarianceExportRecords({
    locationId,
    staffId,
    clientId,
    dateFrom,
    dateTo,
  });

  const headers = [
    'Type',
    'Date',
    'Client name',
    'Start date time',
    'End date time',
    'Duration',
    'Total cost',
    'Shift id',
    'Rate groups',
    'Shift type',
    'Ratio',
  ];

  const exportRows = buildVarianceExportRowList(
    deletedRecords,
    additionalRecords,
    varianceRecords
  ).map(({ record, typeLabel }) => [
    typeLabel,
    formatUtcDateForCsv(record.shiftDate),
    record.clientName || '',
    formatUtcDateTimeForCsv(record.startDatetime),
    formatUtcDateTimeForCsv(record.endDatetime),
    record.duration,
    record.totalCost,
    record.shiftcareId || '',
    record.rateGroups || '',
    record.shiftType || '',
    normalizeRatio(record.ratio || ''),
  ]);

  const code = (loc?.code || 'loc').toLowerCase();
  const ts = new Date().toISOString().replace(/[-:]/g, '').slice(0, 15);
  return buildTabularExport({
    headers,
    rows: exportRows,
    baseFilename: `variance_all_${code}_${ts}`,
    format,
  });
}

export async function getVarianceDetail({ locationId, variancePairKey }) {
  const locObj = locObjectId(locationId);
  const { shiftcareId, startMs } = parseVariancePairKey(variancePairKey);
  const rowFilter = { location: locObj, ...pairKeyToRowFilter(variancePairKey) };

  const forecastRecords = await ForecastRecord.find(rowFilter).sort({ startDatetime: 1 }).lean();
  const actualsRecords = await ActualsRecord.find(rowFilter).sort({ startDatetime: 1 }).lean();

  const sample = forecastRecords[0] || actualsRecords[0];
  const lookupKey = sample
    ? buildVariancePairKey(
        sample.shiftcareId,
        sample.clientDirectoryId,
        sample.clientName,
        startMs != null ? new Date(startMs) : sample.startDatetime
      )
    : variancePairKey;

  const forecastRow = forecastRecords[0]
    ? rowToVarianceView(forecastRecords[0], 'forecast', lookupKey)
    : null;
  const actualsRow = actualsRecords[0]
    ? rowToVarianceView(actualsRecords[0], 'actuals', lookupKey)
    : null;

  let diffFields = [];
  if (forecastRow && actualsRow) {
    diffFields = computeDiffFields(forecastRow, actualsRow);
  }

  return {
    variancePairKey: lookupKey,
    shiftcareId,
    diffFields,
    forecastRecords: forecastRecords.map(serializeDoc),
    actualsRecords: actualsRecords.map(serializeDoc),
    forecastAggregated: forecastRow ? serializeVarianceRow(forecastRow) : null,
    actualsAggregated: actualsRow ? serializeVarianceRow(actualsRow) : null,
  };
}
