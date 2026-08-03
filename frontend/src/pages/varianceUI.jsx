/**
 * Shared variance UI helpers used by Forecast vs Actuals and
 * Standard vs Forecast variance views.
 */

import { TableCell, TableHead } from '../ui/table';
import { cn } from '../lib/utils';
import { Badge } from '../ui/badge';
import { formatUtcDate, formatUtcDateTime, formatUtcTime, normalizeRatio } from '../utils/normalizeRatio';

/** Main variance table columns (both Forecast vs Actuals and Standard vs Forecast). */
export const VARIANCE_COLUMNS = [
  { key: 'shiftDate', label: 'Date', align: 'left' },
  { key: 'clientName', label: 'Client name', align: 'left' },
  { key: 'startDatetime', label: 'Start date time', align: 'left' },
  { key: 'endDatetime', label: 'End date time', align: 'left' },
  { key: 'duration', label: 'Duration', align: 'right' },
  { key: 'totalCost', label: 'Total cost', align: 'right' },
  { key: 'shiftcareId', label: 'Shift id', align: 'left' },
  { key: 'rateGroups', label: 'Rate groups', align: 'left' },
  { key: 'referenceNo', label: 'Reference no', align: 'left' },
  { key: 'shiftType', label: 'Shift type', align: 'left' },
  { key: 'ratio', label: 'Ratio', align: 'left' },
];

export const VARIANCE_DIFF_KEYS = {
  shiftDate: 'shift_date',
  clientName: 'client_name',
  startDatetime: 'start_datetime',
  endDatetime: 'end_datetime',
  duration: 'duration',
  totalCost: 'total_cost',
  shiftcareId: 'shift_id',
  rateGroups: 'rate_groups',
  referenceNo: 'reference_no',
  shiftType: 'shift_type',
  ratio: 'ratio',
};

export const VARIANCE_DIFF_LABELS = {
  shift_date: 'Date',
  client_name: 'Client name',
  start_datetime: 'Start date time',
  end_datetime: 'End date time',
  duration: 'Duration',
  total_cost: 'Total cost',
  shift_id: 'Shift id',
  rate_groups: 'Rate groups',
  reference_no: 'Reference no',
  shift_type: 'Shift type',
  ratio: 'Ratio',
};

export const STANDARD_VS_FORECAST_VARIANCE_COLUMNS = VARIANCE_COLUMNS.map((col) => {
  if (col.key === 'startDatetime') return { ...col, label: 'Start time' };
  if (col.key === 'endDatetime') return { ...col, label: 'End time' };
  return col;
});

export function varianceColSpan(showType, columns = VARIANCE_COLUMNS) {
  return columns.length + (showType ? 1 : 0);
}

export function VarianceColumnHeaders({ showType = false, columns = VARIANCE_COLUMNS }) {
  return (
    <>
      {showType && <TableHead className="w-[110px]">Type</TableHead>}
      {columns.map((col) => (
        <TableHead
          key={col.key}
          className={col.align === 'right' ? 'text-right' : undefined}
        >
          {col.label}
        </TableHead>
      ))}
    </>
  );
}

function varianceTimeValue(r, datetimeKey, timeKey) {
  if (r[timeKey]) return String(r[timeKey]);
  if (r[datetimeKey]) return formatUtcTime(r[datetimeKey]);
  return '—';
}

export function varianceCellValue(r, key, options = {}) {
  const { timeOnly = false } = options;
  switch (key) {
    case 'shiftDate':
      if (r.shiftDate) return formatDate(r.shiftDate);
      if (r.day) return String(r.day);
      return '—';
    case 'clientName':
      return r.clientName || '—';
    case 'startDatetime':
      if (timeOnly) return varianceTimeValue(r, 'startDatetime', 'startTime');
      if (r.startDatetime) return formatDt(r.startDatetime);
      if (r.startTime) return String(r.startTime);
      return '—';
    case 'endDatetime':
      if (timeOnly) return varianceTimeValue(r, 'endDatetime', 'endTime');
      if (r.endDatetime) return formatDt(r.endDatetime);
      if (r.endTime) return String(r.endTime);
      return '—';
    case 'duration':
      return fmtNum(r.duration);
    case 'totalCost':
      return fmtMoney(r.totalCost);
    case 'shiftcareId':
      return r.shiftcareId || r.templateKey || '—';
    case 'rateGroups':
      return r.rateGroups || '—';
    case 'referenceNo':
      return r.referenceNo || '—';
    case 'shiftType':
      return r.shiftType || '—';
    case 'ratio':
      return normalizeRatio(r.ratio) || '—';
    default:
      return '—';
  }
}

export function VarianceDataCells({
  row,
  diffCell,
  shiftIdPrefix = null,
  timeOnly = false,
  columns = VARIANCE_COLUMNS,
}) {
  const cellOpts = timeOnly ? { timeOnly: true } : {};
  return (
    <>
      {columns.map((col) => (
        <TableCell
          key={col.key}
          className={cn(
            col.align === 'right' ? 'text-right whitespace-nowrap' : 'whitespace-nowrap',
            col.key === 'shiftcareId' && 'font-mono text-xs',
            col.key === 'clientName' && 'max-w-[200px] truncate',
            col.key === 'rateGroups' && 'max-w-[240px] truncate',
            col.key === 'referenceNo' && 'max-w-[160px] truncate',
            diffCell(row, col.key)
          )}
        >
          {col.key === 'shiftcareId' && shiftIdPrefix ? (
            <span className="flex items-center gap-1.5">
              {shiftIdPrefix}
              {varianceCellValue(row, col.key)}
            </span>
          ) : (
            varianceCellValue(row, col.key, cellOpts)
          )}
        </TableCell>
      ))}
    </>
  );
}

export function formatDate(d) {
  return formatUtcDate(d);
}

export function formatDt(d) {
  return formatUtcDateTime(d);
}

export function fmtMoney(v) {
  const n = Number(v);
  return Number.isFinite(n) ? `$${n.toFixed(2)}` : '—';
}

export function fmtNum(v) {
  const n = Number(v);
  return Number.isFinite(n) ? n.toFixed(2) : '—';
}

/**
 * Row class colour-coded by record type. For variance pairs we paint
 * the "expected" side (`blueSource`) blue and the "compared" side green.
 */
export function makeVarianceRowClass(blueSource) {
  return function varianceRowClass(r) {
    if (r.recordType === 'deleted') return 'bg-destructive/10 hover:bg-destructive/15';
    if (r.recordType === 'additional') return 'bg-primary/10 hover:bg-primary/15';
    if (r.recordType === 'variance') {
      return r.source === blueSource
        ? 'bg-primary/10 hover:bg-primary/15'
        : 'bg-success/10 hover:bg-success/15';
    }
    return 'hover:bg-muted/30';
  };
}

/**
 * Cell highlighter for the "compared" (green) source — paints yellow when
 * the underlying backend diff list includes the mapped field.
 *
 * @param {string} diffSource - which row.source should be highlighted (e.g. 'actuals' or 'forecast')
 * @param {Record<string,string>} diffKeys - mapping from UI key → backend diff field name
 */
export function makeDiffCell(diffSource, diffKeys) {
  return function diffCell(r, fieldKey) {
    if (r.source !== diffSource) return '';
    const diffName = diffKeys[fieldKey];
    return Array.isArray(r.diffFields) && r.diffFields.includes(diffName) ? 'bg-warning/25' : '';
  };
}

export function diffPanelCell(diffFields, key) {
  return Array.isArray(diffFields) && diffFields.includes(key) ? 'bg-warning/15' : '';
}

export function TypePill({ recordType }) {
  if (recordType === 'deleted') return <Badge variant="destructive">Deleted</Badge>;
  if (recordType === 'additional') return <Badge variant="primary">Additional</Badge>;
  if (recordType === 'variance') return <Badge variant="warning">Variance</Badge>;
  return null;
}

/**
 * Coloured legend strip rendered above variance tables.
 * Pass child swatches; this component just provides the consistent wrapper.
 */
export function VarianceLegend({ children }) {
  return (
    <div className="flex flex-wrap items-center gap-3 rounded border bg-muted/30 px-3 py-2 text-xs text-muted-foreground">
      {children}
    </div>
  );
}

export function LegendSwatch({ swatchClass, label }) {
  return (
    <span className="inline-flex items-center gap-1.5">
      <span className={`inline-block h-3 w-3 rounded ${swatchClass}`} />
      {label}
    </span>
  );
}
