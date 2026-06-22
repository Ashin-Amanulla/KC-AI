import * as XLSX from 'xlsx';
import { CIR_SHEET_NAME, CIR_EXPORT_HEADERS } from './cir.constants.js';
import {
  buildNormalizedColumns,
  getRowValue,
  parseDate,
  normalizeColumnName,
} from '../crm/crmExcelImport.js';

function formatDateExport(value) {
  if (!value) return '';
  const d = value instanceof Date ? value : new Date(value);
  if (Number.isNaN(d.getTime())) return '';
  const day = String(d.getDate()).padStart(2, '0');
  const month = String(d.getMonth() + 1).padStart(2, '0');
  const year = d.getFullYear();
  return `${day}/${month}/${year}`;
}

function isHeaderOrTitleRow(row) {
  const first = String(row[0] ?? '').trim();
  if (!first) return true;
  const upper = first.toUpperCase();
  if (upper.includes('CONTINUOUS IMPROVEMENT REGISTER')) return true;
  if (upper === 'IDENTIFICATION') return true;
  if (upper === 'CIR ID') return true;
  return false;
}

export function parseCirWorkbookBuffer(buffer) {
  const workbook = XLSX.read(buffer, { type: 'buffer', cellDates: true });
  const sheet = workbook.Sheets[CIR_SHEET_NAME];
  if (!sheet) return [];

  const aoa = XLSX.utils.sheet_to_json(sheet, { header: 1, defval: '', raw: true });
  const dataRows = aoa.filter((row) => !isHeaderOrTitleRow(row));
  if (dataRows.length === 0) return [];

  const headerRow = aoa.find((row) => String(row[0] ?? '').trim().toUpperCase() === 'CIR ID');
  if (!headerRow) return [];

  const objects = dataRows.map((cells) => {
    const obj = {};
    headerRow.forEach((col, idx) => {
      if (col) obj[col] = cells[idx] ?? '';
    });
    return obj;
  });

  return objects
    .map(parseCirRow)
    .filter(Boolean);
}

export function parseCirRow(row) {
  const cols = buildNormalizedColumns(Object.keys(row));
  const cirId = String(getRowValue(row, 'CIR ID', cols) || getRowValue(row, 'cir id', cols)).trim();
  if (!cirId || cirId.toUpperCase() === 'CIR ID') return null;

  return {
    cirId,
    dateRaised: parseDate(getRowValue(row, 'Date Raised', cols)),
    clientArea: String(getRowValue(row, 'Client / Area', cols)).trim(),
    issueDescription: String(getRowValue(row, 'Issue / Task Description', cols)).trim(),
    issueSource: String(getRowValue(row, 'Issue Source', cols)).trim(),
    priority: String(getRowValue(row, 'Priority', cols)).trim(),
    enteredByName: String(getRowValue(row, 'Entered By (Name)', cols) || getRowValue(row, 'Entered By', cols)).trim(),
    dateEntered: parseDate(getRowValue(row, 'Date Entered', cols)),
    responsibleOfficer: String(getRowValue(row, 'Responsible Officer', cols)).trim(),
    department: String(getRowValue(row, 'Department', cols)).trim(),
    actions: String(getRowValue(row, 'Actions', cols) || getRowValue(row, 'Actions ', cols)).trim(),
    rootCause: String(getRowValue(row, 'Root Cause', cols)).trim(),
    dueDate: parseDate(getRowValue(row, 'Due Date', cols)),
    reviewDate: parseDate(getRowValue(row, 'Review Date', cols)),
    status: String(getRowValue(row, 'Status', cols)).trim() || 'Open',
    outcomeEvidence: String(getRowValue(row, 'Outcome / Evidence', cols)).trim(),
    dateClosed: parseDate(getRowValue(row, 'Date Closed', cols)),
    notes: String(getRowValue(row, 'Notes', cols)).trim(),
  };
}

export function cirToExportRow(doc) {
  return [
    doc.cirId ?? '',
    formatDateExport(doc.dateRaised),
    doc.clientArea ?? '',
    doc.issueDescription ?? '',
    doc.issueSource ?? '',
    doc.priority ?? '',
    doc.enteredByName ?? '',
    formatDateExport(doc.dateEntered),
    doc.responsibleOfficer ?? '',
    doc.department ?? '',
    doc.actions ?? '',
    doc.rootCause ?? '',
    formatDateExport(doc.dueDate),
    formatDateExport(doc.reviewDate),
    doc.status ?? '',
    doc.outcomeEvidence ?? '',
    formatDateExport(doc.dateClosed),
    doc.notes ?? '',
  ];
}

export function buildCirWorkbook(records) {
  const workbook = XLSX.utils.book_new();
  const sheet = XLSX.utils.aoa_to_sheet([
    ['KANGAROO CARE SERVICES — CONTINUOUS IMPROVEMENT REGISTER'],
    ['IDENTIFICATION', '', '', 'ISSUE DETAILS', '', '', 'ENTRY', '', '', 'OWNERSHIP & ACTION', '', '', 'TIMELINE', '', '', 'OUTCOME & CLOSE-OUT', '', ''],
    CIR_EXPORT_HEADERS,
    ...records.map(cirToExportRow),
  ]);
  XLSX.utils.book_append_sheet(workbook, sheet, CIR_SHEET_NAME);
  return XLSX.write(workbook, { type: 'buffer', bookType: 'xlsx' });
}

export { CIR_EXPORT_HEADERS, normalizeColumnName };
