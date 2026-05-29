/**
 * Shared variance UI helpers used by Forecast vs Actuals and
 * Standard vs Forecast variance views.
 */

import { TableCell, TableHead } from '../ui/table';
import { cn } from '../lib/utils';
import { formatUtcDate, formatUtcDateTime, normalizeRatio } from '../utils/normalizeRatio';

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
  shift_type: 'Shift type',
  ratio: 'Ratio',
};

export function varianceColSpan(showType) {
  return VARIANCE_COLUMNS.length + (showType ? 1 : 0);
}

export function VarianceColumnHeaders({ showType = false }) {
  return (
    <>
      {showType && <TableHead className="w-[110px]">Type</TableHead>}
      {VARIANCE_COLUMNS.map((col) => (
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

export function varianceCellValue(r, key) {
  switch (key) {
    case 'shiftDate':
      if (r.shiftDate) return formatDate(r.shiftDate);
      if (r.day) return String(r.day);
      return '—';
    case 'clientName':
      return r.clientName || '—';
    case 'startDatetime':
      if (r.startDatetime) return formatDt(r.startDatetime);
      if (r.startTime) return String(r.startTime);
      return '—';
    case 'endDatetime':
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
    case 'shiftType':
      return r.shiftType || '—';
    case 'ratio':
      return normalizeRatio(r.ratio) || '—';
    default:
      return '—';
  }
}

export function VarianceDataCells({ row, diffCell, shiftIdPrefix = null }) {
  return (
    <>
      {VARIANCE_COLUMNS.map((col) => (
        <TableCell
          key={col.key}
          className={cn(
            col.align === 'right' ? 'text-right whitespace-nowrap' : 'whitespace-nowrap',
            col.key === 'shiftcareId' && 'font-mono text-xs',
            col.key === 'clientName' && 'max-w-[200px] truncate',
            diffCell(row, col.key)
          )}
        >
          {col.key === 'shiftcareId' && shiftIdPrefix ? (
            <span className="flex items-center gap-1.5">
              {shiftIdPrefix}
              {varianceCellValue(row, col.key)}
            </span>
          ) : (
            varianceCellValue(row, col.key)
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
    if (r.recordType === 'deleted') return 'bg-red-50 hover:bg-red-100';
    if (r.recordType === 'additional') return 'bg-sky-50 hover:bg-sky-100';
    if (r.recordType === 'variance') {
      return r.source === blueSource
        ? 'bg-blue-50 hover:bg-blue-100 cursor-pointer'
        : 'bg-green-50 hover:bg-green-100 cursor-pointer';
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
    return Array.isArray(r.diffFields) && r.diffFields.includes(diffName) ? 'bg-yellow-200' : '';
  };
}

export function diffPanelCell(diffFields, key) {
  return Array.isArray(diffFields) && diffFields.includes(key) ? 'bg-yellow-100' : '';
}

export function TypePill({ recordType }) {
  if (recordType === 'deleted')
    return (
      <span className="inline-flex items-center rounded-full bg-red-100 px-2 py-0.5 text-xs font-medium text-red-700">
        Deleted
      </span>
    );
  if (recordType === 'additional')
    return (
      <span className="inline-flex items-center rounded-full bg-sky-100 px-2 py-0.5 text-xs font-medium text-sky-700">
        Additional
      </span>
    );
  if (recordType === 'variance')
    return (
      <span className="inline-flex items-center rounded-full bg-amber-100 px-2 py-0.5 text-xs font-medium text-amber-700">
        Variance
      </span>
    );
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
