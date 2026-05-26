import { useState } from 'react';
import { toast } from 'sonner';
import { Button } from '../ui/button';
import { Input } from '../ui/input';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '../ui/table';
import { LoadingScreen } from '../ui/LoadingSpinner';
import { cn } from '../lib/utils';
import { getErrorMessage } from '../utils/api';
import { Upload, Download, Plus, Pencil, Trash2 } from 'lucide-react';
import {
  useCreateForecast,
  useUpdateForecast,
  useDeleteForecast,
  useCreateActuals,
  useUpdateActuals,
  useDeleteActuals,
} from '../api/forecastActuals';

export const FORECAST_ACTUALS_COLUMNS = [
  { key: 'shiftDate', label: 'Date', kind: 'date' },
  { key: 'clientName', label: 'Client name', kind: 'text' },
  { key: 'startDatetime', label: 'Start date time', kind: 'dt' },
  { key: 'endDatetime', label: 'End date time', kind: 'dt' },
  { key: 'duration', label: 'Duration', kind: 'num' },
  { key: 'cost', label: 'Cost', kind: 'money' },
  { key: 'totalCost', label: 'Total cost', kind: 'money' },
  { key: 'shiftcareId', label: 'Shift id', kind: 'text' },
  { key: 'shiftDescription', label: 'Shift', kind: 'text' },
  { key: 'additionalCost', label: 'Additional cost', kind: 'money' },
  { key: 'kms', label: 'Kms', kind: 'num' },
  { key: 'isAbsent', label: 'Absent', kind: 'bool' },
  { key: 'status', label: 'Status', kind: 'text' },
  { key: 'invoiceNumbers', label: 'Invoice nos.', kind: 'text' },
  { key: 'rateGroups', label: 'Rate groups', kind: 'text' },
  { key: 'referenceNo', label: 'Reference no', kind: 'text' },
  { key: 'shiftType', label: 'Shift type', kind: 'text' },
  { key: 'additionalShiftType', label: 'Additional shift type', kind: 'text' },
  { key: 'clientType', label: 'Client type', kind: 'text' },
  { key: 'ratio', label: 'Ratio', kind: 'text' },
];

const EMPTY_ROW_FORM = {
  clientDirectoryId: '',
  staffDirectoryId: '',
  shiftDate: '',
  startDatetime: '',
  endDatetime: '',
  duration: '',
  cost: '',
  totalCost: '',
  shiftcareId: '',
  shiftDescription: '',
  additionalCost: '0',
  kms: '0',
  isAbsent: false,
  status: '',
  invoiceNumbers: '',
  rateGroups: '',
  referenceNo: '',
  shiftType: '',
  additionalShiftType: '',
  clientType: '',
  ratio: '',
};

function formatDate(d) {
  if (!d) return '—';
  return new Date(d).toLocaleDateString();
}

function formatDt(d) {
  if (!d) return '—';
  return new Date(d).toLocaleString();
}

function formatMoneyVal(v) {
  if (v == null || v === '') return '—';
  const n = typeof v === 'number' ? v : Number(v);
  return Number.isFinite(n) ? n.toFixed(2) : '—';
}

function formatNumVal(v) {
  if (v == null || v === '') return '—';
  const n = typeof v === 'number' ? v : Number(v);
  if (!Number.isFinite(n)) return '—';
  return Number.isInteger(n) ? String(n) : n.toFixed(2);
}

function toDatetimeLocal(d) {
  if (!d) return '';
  const x = new Date(d);
  const pad = (n) => String(n).padStart(2, '0');
  return `${x.getFullYear()}-${pad(x.getMonth() + 1)}-${pad(x.getDate())}T${pad(x.getHours())}:${pad(x.getMinutes())}`;
}

function recordToForm(r) {
  return {
    clientDirectoryId: r.clientDirectoryId || '',
    staffDirectoryId: r.staffDirectoryId || '',
    shiftDate: r.shiftDate ? new Date(r.shiftDate).toISOString().slice(0, 10) : '',
    startDatetime: toDatetimeLocal(r.startDatetime),
    endDatetime: toDatetimeLocal(r.endDatetime),
    duration: r.duration != null ? String(r.duration) : '',
    cost: r.cost != null ? String(r.cost) : '',
    totalCost: r.totalCost != null ? String(r.totalCost) : '',
    shiftcareId: r.shiftcareId || '',
    shiftDescription: r.shiftDescription || '',
    additionalCost: r.additionalCost != null ? String(r.additionalCost) : '0',
    kms: r.kms != null ? String(r.kms) : '0',
    isAbsent: Boolean(r.isAbsent),
    status: r.status || '',
    invoiceNumbers: r.invoiceNumbers || '',
    rateGroups: r.rateGroups || '',
    referenceNo: r.referenceNo || '',
    shiftType: r.shiftType || '',
    additionalShiftType: r.additionalShiftType || '',
    clientType: r.clientType || '',
    ratio: r.ratio || '',
  };
}

function renderCell(r, col) {
  const v = r[col.key];
  switch (col.kind) {
    case 'date':
      return formatDate(v);
    case 'dt':
      return formatDt(v);
    case 'money':
      return formatMoneyVal(v);
    case 'num':
      return formatNumVal(v);
    case 'bool':
      return v === true ? 'Yes' : v === false ? 'No' : '—';
    default:
      return v != null && String(v).trim() !== '' ? String(v) : '—';
  }
}

function useRowMutations(variant) {
  const createForecast = useCreateForecast();
  const updateForecast = useUpdateForecast();
  const deleteForecast = useDeleteForecast();
  const createActuals = useCreateActuals();
  const updateActuals = useUpdateActuals();
  const deleteActuals = useDeleteActuals();
  if (variant === 'forecast') {
    return { createM: createForecast, updateM: updateForecast, deleteM: deleteForecast };
  }
  return { createM: createActuals, updateM: updateActuals, deleteM: deleteActuals };
}

export function ForecastActualsRowPanel({
  variant,
  title,
  locationId,
  selectableClients,
  selectableStaff,
  listData,
  listLoading,
  listError,
  dropzone,
  onExport,
  page,
  setPage,
}) {
  const { createM, updateM, deleteM } = useRowMutations(variant);
  const [showForm, setShowForm] = useState(false);
  const [editingId, setEditingId] = useState(null);
  const [rowForm, setRowForm] = useState(EMPTY_ROW_FORM);

  const updateField = (field, value) => setRowForm((prev) => ({ ...prev, [field]: value }));

  const resetForm = () => {
    setRowForm(EMPTY_ROW_FORM);
    setEditingId(null);
    setShowForm(false);
  };

  const rowPayload = () => ({
    locationId,
    clientDirectoryId: rowForm.clientDirectoryId,
    staffDirectoryId: rowForm.staffDirectoryId || undefined,
    shiftDate: rowForm.shiftDate,
    startDatetime: rowForm.startDatetime,
    endDatetime: rowForm.endDatetime,
    duration: rowForm.duration,
    cost: rowForm.cost,
    totalCost: rowForm.totalCost,
    shiftcareId: rowForm.shiftcareId,
    shiftDescription: rowForm.shiftDescription,
    additionalCost: rowForm.additionalCost,
    kms: rowForm.kms,
    isAbsent: rowForm.isAbsent,
    status: rowForm.status,
    invoiceNumbers: rowForm.invoiceNumbers,
    rateGroups: rowForm.rateGroups,
    referenceNo: rowForm.referenceNo,
    shiftType: rowForm.shiftType,
    additionalShiftType: rowForm.additionalShiftType,
    clientType: rowForm.clientType,
    ratio: rowForm.ratio,
  });

  const handleSave = async (e) => {
    e.preventDefault();
    if (!locationId || !rowForm.clientDirectoryId) {
      toast.error('Select a client');
      return;
    }
    try {
      if (editingId) {
        await updateM.mutateAsync({ id: editingId, ...rowPayload() });
        toast.success('Row updated');
      } else {
        await createM.mutateAsync(rowPayload());
        toast.success('Row added');
      }
      resetForm();
      setPage(1);
    } catch (err) {
      const data = err.response?.data;
      toast.error(data?.errors?.join(', ') || getErrorMessage(err));
    }
  };

  const handleEdit = (r) => {
    setEditingId(r.id);
    setRowForm(recordToForm(r));
    setShowForm(true);
  };

  const handleDelete = async (r) => {
    if (!window.confirm(`Delete shift ${r.shiftcareId || r.id}?`)) return;
    try {
      await deleteM.mutateAsync({ id: r.id, locationId });
      toast.success('Row deleted');
      if (editingId === r.id) resetForm();
    } catch (err) {
      toast.error(getErrorMessage(err));
    }
  };

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap gap-2 justify-end">
        <Button
          type="button"
          variant={showForm ? 'secondary' : 'default'}
          size="sm"
          onClick={() => (showForm ? resetForm() : setShowForm(true))}
          disabled={selectableClients.length === 0}
        >
          <Plus className="mr-2 h-4 w-4" />
          {showForm ? 'Cancel' : 'Add row'}
        </Button>
        <Button type="button" variant="outline" size="sm" onClick={onExport}>
          <Download className="mr-2 h-4 w-4" />
          Export CSV
        </Button>
      </div>

      {showForm && (
        <form
          onSubmit={handleSave}
          className="rounded-lg border border-border bg-muted/30 p-4 space-y-4"
        >
          <p className="text-sm font-medium">{editingId ? `Edit ${title} row` : `Add ${title} row`}</p>
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            <div className="space-y-1">
              <label className="text-sm font-medium">Client</label>
              <select
                className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
                value={rowForm.clientDirectoryId}
                onChange={(e) => updateField('clientDirectoryId', e.target.value)}
                required
              >
                <option value="">Select client…</option>
                {selectableClients.map((c) => (
                  <option key={c.value} value={c.value}>
                    {c.label}
                  </option>
                ))}
              </select>
            </div>
            <div className="space-y-1">
              <label className="text-sm font-medium">Staff</label>
              <select
                className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
                value={rowForm.staffDirectoryId}
                onChange={(e) => updateField('staffDirectoryId', e.target.value)}
              >
                <option value="">Optional</option>
                {selectableStaff.map((s) => (
                  <option key={s.value} value={s.value}>
                    {s.label}
                  </option>
                ))}
              </select>
            </div>
            <div className="space-y-1">
              <label className="text-sm font-medium">Date</label>
              <Input
                type="date"
                value={rowForm.shiftDate}
                onChange={(e) => updateField('shiftDate', e.target.value)}
                required
              />
            </div>
            <div className="space-y-1">
              <label className="text-sm font-medium">Start</label>
              <Input
                type="datetime-local"
                value={rowForm.startDatetime}
                onChange={(e) => updateField('startDatetime', e.target.value)}
                required
              />
            </div>
            <div className="space-y-1">
              <label className="text-sm font-medium">End</label>
              <Input
                type="datetime-local"
                value={rowForm.endDatetime}
                onChange={(e) => updateField('endDatetime', e.target.value)}
                required
              />
            </div>
            <div className="space-y-1">
              <label className="text-sm font-medium">Duration</label>
              <Input
                type="number"
                step="0.01"
                value={rowForm.duration}
                onChange={(e) => updateField('duration', e.target.value)}
                required
              />
            </div>
            <div className="space-y-1">
              <label className="text-sm font-medium">Cost</label>
              <Input
                type="number"
                step="0.01"
                value={rowForm.cost}
                onChange={(e) => updateField('cost', e.target.value)}
                required
              />
            </div>
            <div className="space-y-1">
              <label className="text-sm font-medium">Total cost</label>
              <Input
                type="number"
                step="0.01"
                value={rowForm.totalCost}
                onChange={(e) => updateField('totalCost', e.target.value)}
                required
              />
            </div>
            <div className="space-y-1">
              <label className="text-sm font-medium">Shift id</label>
              <Input value={rowForm.shiftcareId} onChange={(e) => updateField('shiftcareId', e.target.value)} />
            </div>
            <div className="space-y-1">
              <label className="text-sm font-medium">Shift description</label>
              <Input
                value={rowForm.shiftDescription}
                onChange={(e) => updateField('shiftDescription', e.target.value)}
              />
            </div>
            <div className="space-y-1">
              <label className="text-sm font-medium">Ratio</label>
              <Input placeholder="1:02" value={rowForm.ratio} onChange={(e) => updateField('ratio', e.target.value)} />
            </div>
            <div className="space-y-1">
              <label className="text-sm font-medium">Rate groups</label>
              <Input value={rowForm.rateGroups} onChange={(e) => updateField('rateGroups', e.target.value)} />
            </div>
            <div className="space-y-1">
              <label className="text-sm font-medium">Shift type</label>
              <Input value={rowForm.shiftType} onChange={(e) => updateField('shiftType', e.target.value)} />
            </div>
          </div>
          <div className="flex gap-2">
            <Button type="submit" size="sm" disabled={createM.isPending || updateM.isPending}>
              {createM.isPending || updateM.isPending ? 'Saving…' : editingId ? 'Update row' : 'Save row'}
            </Button>
            <Button type="button" variant="outline" size="sm" onClick={resetForm}>
              Cancel
            </Button>
          </div>
        </form>
      )}

      <div
        {...dropzone.getRootProps()}
        className={cn(
          'cursor-pointer rounded-lg border border-dashed p-6 text-center text-sm text-muted-foreground',
          dropzone.isDragActive && 'border-primary bg-accent'
        )}
      >
        <input {...dropzone.getInputProps()} />
        <Upload className="mx-auto mb-2 h-8 w-8 opacity-50" />
        Drop {title.toLowerCase()} CSV here, or click to select (full replace for this location)
      </div>

      {listLoading ? (
        <LoadingScreen message={`Loading ${title.toLowerCase()}…`} />
      ) : listError ? (
        <p className="text-destructive">{getErrorMessage(listError)}</p>
      ) : (
        <>
          <p className="text-xs text-muted-foreground">
            {listData?.dateRangeStart && listData?.dateRangeEnd
              ? `Date range: ${formatDate(listData.dateRangeStart)} – ${formatDate(listData.dateRangeEnd)}`
              : `No ${title.toLowerCase()} rows yet`}
            {listData?.total != null ? ` · ${listData.total} rows` : ''}
          </p>
          <div className="rounded-md border overflow-x-auto max-w-full">
            <Table>
              <TableHeader>
                <TableRow>
                  {FORECAST_ACTUALS_COLUMNS.map((col) => (
                    <TableHead
                      key={col.key}
                      className={cn(
                        (col.kind === 'money' || col.kind === 'num') && 'text-right whitespace-nowrap',
                        'whitespace-nowrap text-xs font-medium min-w-[5rem]'
                      )}
                    >
                      {col.label}
                    </TableHead>
                  ))}
                  <TableHead className="w-[100px]">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {(listData?.records || []).map((r, ri) => (
                  <TableRow key={r.id ?? `fa-row-${ri}`}>
                    {FORECAST_ACTUALS_COLUMNS.map((col) => (
                      <TableCell
                        key={col.key}
                        className={cn(
                          'text-xs p-2 align-top',
                          (col.kind === 'money' || col.kind === 'num') && 'text-right tabular-nums whitespace-nowrap'
                        )}
                      >
                        {renderCell(r, col)}
                      </TableCell>
                    ))}
                    <TableCell className="p-2">
                      <div className="flex gap-1">
                        <Button
                          type="button"
                          variant="ghost"
                          size="icon"
                          className="h-8 w-8"
                          onClick={() => handleEdit(r)}
                          title="Edit"
                        >
                          <Pencil className="h-4 w-4" />
                        </Button>
                        <Button
                          type="button"
                          variant="ghost"
                          size="icon"
                          className="h-8 w-8 text-destructive"
                          onClick={() => handleDelete(r)}
                          disabled={deleteM.isPending}
                          title="Delete"
                        >
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </div>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
          <div className="flex items-center justify-between text-sm">
            <span>
              {listData?.startIndex != null && listData?.endIndex != null
                ? `${listData.startIndex}–${listData.endIndex} of ${listData.total}`
                : ''}
            </span>
            <div className="flex gap-2">
              <Button
                type="button"
                variant="outline"
                size="sm"
                disabled={!listData?.hasPrev}
                onClick={() => setPage((p) => Math.max(1, p - 1))}
              >
                Previous
              </Button>
              <Button
                type="button"
                variant="outline"
                size="sm"
                disabled={!listData?.hasNext}
                onClick={() => setPage((p) => p + 1)}
              >
                Next
              </Button>
            </div>
          </div>
        </>
      )}
    </div>
  );
}
