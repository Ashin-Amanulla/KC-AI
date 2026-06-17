import {
  broadcastSpreadsheetBulkReload,
  broadcastSpreadsheetChange,
  SPREADSHEET_ROOMS,
} from './crmCollaborationWs.js';

function toPlain(doc) {
  if (!doc) return doc;
  return doc.toObject ? doc.toObject() : { ...doc };
}

export function notifyRowCreated(room, doc) {
  broadcastSpreadsheetChange(room, { type: 'row:created', row: toPlain(doc) });
}

export function notifyRowUpdated(room, doc) {
  broadcastSpreadsheetChange(room, { type: 'row:updated', row: toPlain(doc) });
}

export function notifyRowDeleted(room, rowId) {
  broadcastSpreadsheetChange(room, { type: 'row:deleted', rowId: String(rowId) });
}

export function notifyCrmImportComplete() {
  broadcastSpreadsheetBulkReload(Object.values(SPREADSHEET_ROOMS));
}

export { SPREADSHEET_ROOMS };
