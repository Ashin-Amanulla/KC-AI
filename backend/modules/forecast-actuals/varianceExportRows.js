/**
 * Pure helpers for variance export row assembly (testable without MongoDB).
 */

export function buildVarianceExportRowList(deletedRecords, additionalRecords, varianceRecords) {
  const rows = [];
  for (const record of deletedRecords) {
    rows.push({ record, typeLabel: 'Deleted' });
  }
  for (const record of additionalRecords) {
    rows.push({ record, typeLabel: 'Additional' });
  }
  for (const record of varianceRecords) {
    const typeLabel = record.source === 'forecast' ? 'Variance - Forecast' : 'Variance - Actuals';
    rows.push({ record, typeLabel });
  }
  return rows;
}

export function countVarianceExportRows(deletedRecords, additionalRecords, varianceRecords) {
  return (
    (deletedRecords?.length || 0) +
    (additionalRecords?.length || 0) +
    (varianceRecords?.length || 0)
  );
}
