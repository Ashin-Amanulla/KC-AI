import { broadcastSpreadsheetChange, broadcastSpreadsheetBulkReload } from '../crm/crmCollaborationWs.js';

export const CIR_SPREADSHEET_ROOM = 'cir:register';

function toPlain(doc) {
  if (!doc) return doc;
  return doc.toObject ? doc.toObject() : { ...doc };
}

export function notifyCirRowCreated(doc) {
  broadcastSpreadsheetChange(CIR_SPREADSHEET_ROOM, { type: 'row:created', row: toPlain(doc) });
}

export function notifyCirRowUpdated(doc) {
  broadcastSpreadsheetChange(CIR_SPREADSHEET_ROOM, { type: 'row:updated', row: toPlain(doc) });
}

export function notifyCirRowDeleted(rowId) {
  broadcastSpreadsheetChange(CIR_SPREADSHEET_ROOM, { type: 'row:deleted', rowId: String(rowId) });
}

export function notifyCirImportComplete() {
  broadcastSpreadsheetBulkReload([CIR_SPREADSHEET_ROOM]);
}
