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
  combineDateAndTime,
  getRowValue,
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
import { compareShiftDateRows } from '../../utils/weekdaySort.js';

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

const VARIANCE_PAIR_SEP = '|';

/** Unique variance identity: shift id + client (directory id preferred, else normalized name). */
export function buildVariancePairKey(shiftcareId, clientDirectoryId, clientName) {
  const sid = String(shiftcareId || '').trim();
  const cid = String(clientDirectoryId || '').trim();
  const clientKey = cid
    ? `id:${cid}`
    : `name:${String(clientName || '').trim().toLowerCase()}`;
  return `${sid}${VARIANCE_PAIR_SEP}${clientKey}`;
}

export function parseVariancePairKey(pairKey) {
  const raw = String(pairKey || '');
  const sep = raw.indexOf(VARIANCE_PAIR_SEP);
  if (sep < 0) {
    return { shiftcareId: raw.trim(), clientKey: null, legacyShiftOnly: true };
  }
  return {
    shiftcareId: raw.slice(0, sep).trim(),
    clientKey: raw.slice(sep + 1),
    legacyShiftOnly: false,
  };
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

  const shiftDate = parseDate(dateStr);
  if (!shiftDate) return { error: `Row ${rowNum}: Invalid date format '${dateStr}'` };

  const startDatetime = combineDateAndTime(shiftDate, startTimeStr);
  if (!startDatetime) {
    return { error: `Row ${rowNum}: Invalid start time format '${startTimeStr}'` };
  }

  let endDatetime = combineDateAndTime(shiftDate, endTimeStr);
  if (!endDatetime) {
    return { error: `Row ${rowNum}: Invalid end time format '${endTimeStr}'` };
  }

  if (endDatetime <= startDatetime) {
    endDatetime = new Date(endDatetime.getTime() + 24 * 60 * 60 * 1000);
  }

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
      ratio,
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

  const shiftDate = body.shiftDate ? parseDate(body.shiftDate) : parseDate(body.date);
  if (!shiftDate) return { error: `${prefix}Invalid date` };

  const startDatetime = parseDateTime(body.startDatetime || body.startTime);
  if (!startDatetime) return { error: `${prefix}Invalid start time` };

  const endDatetime = parseDateTime(body.endDatetime || body.endTime);
  if (!endDatetime) return { error: `${prefix}Invalid end time` };

  if (endDatetime <= startDatetime) return { error: `${prefix}End time must be after start time` };

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
      ratio: String(body.ratio || '').trim(),
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
    await ForecastRecord.deleteMany({ location: locObj });
    await ForecastRecord.insertMany(toInsert);
  }

  return {
    success: toInsert.length > 0,
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
    await ActualsRecord.deleteMany({ location: locObj });
    await ActualsRecord.insertMany(toInsert);
  }

  return {
    success: toInsert.length > 0,
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
  const sort = { shiftDate: 1, startDatetime: 1 };
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
  const sort = { shiftDate: 1, startDatetime: 1 };
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

/** Aligned with `csvForecastActuals` + `processRowCommon` (import) column names */
const FORECAST_ACTUALS_CSV_HEADER = [
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
].join(',');

function formatCsvShiftDate(d, tz) {
  if (!d) return '';
  return new Date(d).toLocaleDateString('en-AU', { timeZone: tz, day: '2-digit', month: '2-digit', year: 'numeric' });
}

/** `dd/mm/yyyy hh:mm` 24h — matches `parseDateTime` au24 in csvForecastActuals */
function formatCsvDateTimeForImport(d, tz) {
  if (!d) return '';
  const t = new Date(d);
  const dmy = t.toLocaleDateString('en-AU', { timeZone: tz, day: '2-digit', month: '2-digit', year: 'numeric' });
  const hm = t.toLocaleTimeString('en-GB', { timeZone: tz, hour: '2-digit', minute: '2-digit', hour12: false });
  return `${dmy} ${hm}`.trim();
}

function forecastActualsRowToCsvLine(r, tz) {
  return [
    csvEscape(r.clientName || ''),
    formatCsvShiftDate(r.shiftDate, tz),
    csvEscape(r.staffName || ''),
    formatCsvDateTimeForImport(r.startDatetime, tz),
    formatCsvDateTimeForImport(r.endDatetime, tz),
    r.duration ?? '',
    r.cost ?? '',
    r.totalCost ?? '',
    csvEscape(r.shiftcareId || ''),
    csvEscape(r.shiftDescription || ''),
    r.additionalCost ?? '',
    r.kms ?? '',
    r.isAbsent ? 'Yes' : 'No',
    csvEscape(r.status || ''),
    csvEscape(r.invoiceNumbers || ''),
    csvEscape(r.rateGroups || ''),
    csvEscape(r.referenceNo || ''),
    csvEscape(r.shiftType || ''),
    csvEscape(r.additionalShiftType || ''),
    csvEscape(r.clientType || ''),
    csvEscape(r.ratio || ''),
  ].join(',');
}

export async function exportForecastCsv({ locationId, staffId, clientId, timezone }) {
  const filter = listFilter(locationId, staffId, clientId);
  const rows = await ForecastRecord.find(filter).sort({ shiftDate: 1, startDatetime: 1 }).lean();
  const tz = timezone || 'Australia/Brisbane';
  const lines = [FORECAST_ACTUALS_CSV_HEADER, ...rows.map((r) => forecastActualsRowToCsvLine(r, tz))];
  const loc = await Location.findById(locationId).select('code').lean();
  const code = (loc?.code || 'loc').toLowerCase();
  const ts = new Date().toISOString().replace(/[-:]/g, '').slice(0, 15);
  const filename = `forecast_${code}_${ts}.csv`;
  return { filename, body: '\uFEFF' + lines.join('\n') };
}

export async function exportActualsCsv({ locationId, staffId, clientId, timezone }) {
  const filter = listFilter(locationId, staffId, clientId);
  const rows = await ActualsRecord.find(filter).sort({ shiftDate: 1, startDatetime: 1 }).lean();
  const tz = timezone || 'Australia/Brisbane';
  const lines = [FORECAST_ACTUALS_CSV_HEADER, ...rows.map((r) => forecastActualsRowToCsvLine(r, tz))];
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

async function getVariancePairKeySets(locationId, staffId, clientId) {
  const m = shiftcareMatchExtras(locationId, staffId, clientId);
  const collect = async (Model) => {
    const rows = await Model.aggregate([
      { $match: m },
      {
        $group: {
          _id: {
            shiftcareId: '$shiftcareId',
            clientDirectoryId: { $ifNull: ['$clientDirectoryId', ''] },
            clientName: { $first: '$clientName' },
          },
        },
      },
    ]);
    return rows.map((r) =>
      buildVariancePairKey(r._id.shiftcareId, r._id.clientDirectoryId, r._id.clientName)
    );
  };
  const [fKeys, aKeys] = await Promise.all([collect(ForecastRecord), collect(ActualsRecord)]);
  return {
    forecastKeys: new Set(fKeys),
    actualsKeys: new Set(aKeys),
  };
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
  if (String(fRec.ratio || '') !== String(aRec.ratio || '')) diff.push('ratio');
  return diff;
}

async function aggregateByVariancePairKeys(Model, locationId, pairKeys, staffId, clientId, source) {
  const keys = [...pairKeys].filter((x) => x != null && String(x).trim() !== '');
  if (!keys.length) return new Map();

  const orConditions = keys.map((k) => {
    const { shiftcareId, clientKey, legacyShiftOnly } = parseVariancePairKey(k);
    if (legacyShiftOnly) return { shiftcareId };
    return { shiftcareId, ...pairKeyClientFilter(clientKey) };
  });

  const match = {
    ...shiftcareMatchExtras(locationId, staffId, clientId),
    $or: orConditions,
  };

  const pipeline = [
    { $match: match },
    {
      $addFields: {
        varianceClientKey: {
          $cond: [
            {
              $and: [
                { $ne: ['$clientDirectoryId', null] },
                { $ne: ['$clientDirectoryId', ''] },
              ],
            },
            { $concat: ['id:', '$clientDirectoryId'] },
            {
              $concat: [
                'name:',
                { $toLower: { $trim: { input: { $ifNull: ['$clientName', ''] } } } },
              ],
            },
          ],
        },
      },
    },
    { $sort: { startDatetime: 1 } },
    {
      $group: {
        _id: { shiftcareId: '$shiftcareId', clientKey: '$varianceClientKey' },
        minShiftDate: { $min: '$shiftDate' },
        minStart: { $min: '$startDatetime' },
        maxEnd: { $max: '$endDatetime' },
        sumDuration: { $sum: '$duration' },
        sumCost: { $sum: '$cost' },
        sumTotalCost: { $sum: '$totalCost' },
        clientName: { $first: '$clientName' },
        clientDirectoryId: { $first: '$clientDirectoryId' },
        rateGroups: { $first: '$rateGroups' },
        shiftType: { $first: '$shiftType' },
        ratio: { $first: '$ratio' },
      },
    },
  ];

  const agg = await Model.aggregate(pipeline);
  const map = new Map();
  for (const item of agg) {
    const variancePairKey = `${item._id.shiftcareId}${VARIANCE_PAIR_SEP}${item._id.clientKey}`;
    map.set(variancePairKey, {
      variancePairKey,
      shiftcareId: item._id.shiftcareId,
      shiftDate: item.minShiftDate,
      clientName: item.clientName || '',
      clientDirectoryId: item.clientDirectoryId || '',
      startDatetime: item.minStart,
      endDatetime: item.maxEnd,
      duration: roundMoney(item.sumDuration || 0),
      cost: roundMoney(item.sumCost || 0),
      totalCost: roundMoney(item.sumTotalCost || 0),
      rateGroups: item.rateGroups || '',
      shiftType: item.shiftType || '',
      ratio: item.ratio || '',
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

  const { forecastKeys, actualsKeys } = await getVariancePairKeySets(locationId, staffId, clientId);
  const deletedKeys = new Set([...forecastKeys].filter((k) => !actualsKeys.has(k)));
  const additionalKeys = new Set([...actualsKeys].filter((k) => !forecastKeys.has(k)));
  const commonKeys = new Set([...forecastKeys].filter((k) => actualsKeys.has(k)));

  const varianceKeys = new Set();
  if (commonKeys.size) {
    const fAgg = await aggregateByVariancePairKeys(
      ForecastRecord,
      locationId,
      commonKeys,
      staffId,
      clientId,
      'forecast'
    );
    const aAgg = await aggregateByVariancePairKeys(
      ActualsRecord,
      locationId,
      commonKeys,
      staffId,
      clientId,
      'actuals'
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
    const deletedAgg = await aggregateByVariancePairKeys(
      ForecastRecord,
      locationId,
      deletedKeys,
      staffId,
      clientId,
      'forecast'
    );
    for (const pairKey of [...deletedKeys]) {
      const rec = deletedAgg.get(pairKey);
      if (rec) {
        rec.recordType = 'deleted';
        records.push(rec);
      }
    }
    const additionalAgg = await aggregateByVariancePairKeys(
      ActualsRecord,
      locationId,
      additionalKeys,
      staffId,
      clientId,
      'actuals'
    );
    for (const pairKey of [...additionalKeys]) {
      const rec = additionalAgg.get(pairKey);
      if (rec) {
        rec.recordType = 'additional';
        records.push(rec);
      }
    }
    const sortedVarKeys = [...varianceKeys];
    const vF = await aggregateByVariancePairKeys(
      ForecastRecord,
      locationId,
      varianceKeys,
      staffId,
      clientId,
      'forecast'
    );
    const vA = await aggregateByVariancePairKeys(
      ActualsRecord,
      locationId,
      varianceKeys,
      staffId,
      clientId,
      'actuals'
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
    const agg = await aggregateByVariancePairKeys(
      ForecastRecord,
      locationId,
      deletedKeys,
      staffId,
      clientId,
      'forecast'
    );
    records = [...agg.values()];
    records.sort(compareShiftDateRows);
  } else if (t === 'additional') {
    const agg = await aggregateByVariancePairKeys(
      ActualsRecord,
      locationId,
      additionalKeys,
      staffId,
      clientId,
      'actuals'
    );
    records = [...agg.values()];
    records.sort(compareShiftDateRows);
  } else if (t === 'variance') {
    const forecastAgg = await aggregateByVariancePairKeys(
      ForecastRecord,
      locationId,
      varianceKeys,
      staffId,
      clientId,
      'forecast'
    );
    const actualsAgg = await aggregateByVariancePairKeys(
      ActualsRecord,
      locationId,
      varianceKeys,
      staffId,
      clientId,
      'actuals'
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

  const lines = [
    [
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
    ].join(','),
  ];

  function formatDateCsv(dt) {
    if (!dt) return '';
    const d = new Date(dt);
    return d.toLocaleDateString('en-AU', {
      timeZone: tz,
      day: '2-digit',
      month: '2-digit',
      year: 'numeric',
    });
  }

  function writeRecord(record, typeLabel) {
    lines.push(
      [
        csvEscape(typeLabel),
        csvEscape(formatDateCsv(record.shiftDate)),
        csvEscape(record.clientName || ''),
        csvEscape(formatDt(record.startDatetime)),
        csvEscape(formatDt(record.endDatetime)),
        record.duration,
        record.totalCost,
        csvEscape(record.shiftcareId),
        csvEscape(record.rateGroups || ''),
        csvEscape(record.shiftType || ''),
        csvEscape(record.ratio || ''),
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

export async function getVarianceDetail({ locationId, variancePairKey }) {
  const locObj = locObjectId(locationId);
  const { shiftcareId, clientKey, legacyShiftOnly } = parseVariancePairKey(variancePairKey);
  const clientFilter = legacyShiftOnly ? {} : pairKeyClientFilter(clientKey);
  const rowFilter = { location: locObj, shiftcareId, ...clientFilter };

  const forecastRecords = await ForecastRecord.find(rowFilter).sort({ startDatetime: 1 }).lean();
  const actualsRecords = await ActualsRecord.find(rowFilter).sort({ startDatetime: 1 }).lean();

  let lookupKey = variancePairKey;
  if (legacyShiftOnly) {
    const sample = forecastRecords[0] || actualsRecords[0];
    if (sample) {
      lookupKey = buildVariancePairKey(
        sample.shiftcareId,
        sample.clientDirectoryId,
        sample.clientName
      );
    } else {
      lookupKey = shiftcareId;
    }
  }
  const fAgg = await aggregateByVariancePairKeys(
    ForecastRecord,
    locationId,
    new Set([lookupKey]),
    'all',
    'all',
    'forecast'
  );
  const aAgg = await aggregateByVariancePairKeys(
    ActualsRecord,
    locationId,
    new Set([lookupKey]),
    'all',
    'all',
    'actuals'
  );

  const forecastAgg = fAgg.get(lookupKey) || null;
  const actualsAgg = aAgg.get(lookupKey) || null;

  let diffFields = [];
  if (forecastAgg && actualsAgg) {
    diffFields = computeDiffFields(forecastAgg, actualsAgg);
  }

  return {
    variancePairKey: forecastAgg?.variancePairKey || actualsAgg?.variancePairKey || variancePairKey,
    shiftcareId,
    diffFields,
    forecastRecords: forecastRecords.map(serializeDoc),
    actualsRecords: actualsRecords.map(serializeDoc),
    forecastAggregated: forecastAgg ? serializeVarianceRow(forecastAgg) : null,
    actualsAggregated: actualsAgg ? serializeVarianceRow(actualsAgg) : null,
  };
}
