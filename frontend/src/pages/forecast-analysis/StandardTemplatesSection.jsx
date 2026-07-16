import { useEffect, useMemo, useState } from 'react';
import { useDropzone } from 'react-dropzone';
import { toast } from 'sonner';
import {
  useStandardList,
  useUploadStandard,
  useCreateStandardRow,
  useUpdateStandardRow,
  useDeleteStandardRow,
  exportStandardCsv,
} from '../../api/standardForecast';
import { getErrorMessage } from '../../utils/api';
import { normalizeRatio } from '../../utils/normalizeRatio';
import { validateTabularFile, TABULAR_ACCEPT } from '../../config/upload';
import { TabularExportButtons } from '../../components/TabularExportButtons';
import { Card, CardContent, CardHeader } from '../../ui/card';
import { CardTitleHint, InfoHint } from '../../components/InfoHint';
import { Button } from '../../ui/button';
import { Input } from '../../ui/input';
import { Label } from '../../ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue, nativeSelectClass } from '../../ui/select';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '../../ui/table';
import { LoadingScreen } from '../../ui/LoadingSpinner';
import { cn } from '../../lib/utils';
import { sortByWeekdayThenTime } from '../../utils/weekdaySort';
import { Upload, Plus, Pencil, Trash2 } from 'lucide-react';
import { VARIANCE_COLUMNS, varianceCellValue } from '../varianceUI';

const WEEKDAYS = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday'];

const EMPTY_ROW_FORM = {
  clientDirectoryId: '',
  day: 'Monday',
  startTime: '',
  endTime: '',
  duration: '',
  totalCost: '',
  rateGroups: '',
  referenceNo: '',
  shiftType: '',
  ratio: '',
};

function recordToStandardForm(r) {
  return {
    clientDirectoryId: r.clientDirectoryId || '',
    day: r.day || 'Monday',
    startTime: r.startTime || '',
    endTime: r.endTime || '',
    duration: r.duration != null ? String(r.duration) : '',
    totalCost: r.totalCost != null ? String(r.totalCost) : '',
    rateGroups: r.rateGroups || '',
    referenceNo: r.referenceNo || '',
    shiftType: r.shiftType || '',
    ratio: r.ratio || '',
  };
}

const TEMPLATE_TABLE_COLUMNS = VARIANCE_COLUMNS.filter((col) => col.key !== 'shiftcareId');
const TEMPLATE_TABLE_COLSPAN = TEMPLATE_TABLE_COLUMNS.length + 1;

export function StandardTemplatesSection({ locationId, client, directory, dirLoading }) {
  const [showAddForm, setShowAddForm] = useState(false);
  const [editingId, setEditingId] = useState(null);
  const [rowForm, setRowForm] = useState(EMPTY_ROW_FORM);

  const listParams = useMemo(() => ({ locationId, clientId: client }), [locationId, client]);

  const listQ = useStandardList(listParams, Boolean(locationId));
  const uploadM = useUploadStandard();
  const createM = useCreateStandardRow();
  const updateM = useUpdateStandardRow();
  const deleteM = useDeleteStandardRow();

  const selectableClients = useMemo(
    () => (directory?.clients ?? []).filter((c) => c.value !== 'all'),
    [directory?.clients]
  );

  const onDrop = async (files) => {
    const f = files?.[0];
    if (!f || !locationId) return;
    const validation = validateTabularFile(f);
    if (!validation.valid) {
      toast.error(validation.error);
      return;
    }
    try {
      const res = await uploadM.mutateAsync({ locationId, file: f });
      if (res.errors?.length) {
        const preview = res.errors.slice(0, 5).join('; ');
        const suffix = res.errors.length > 5 ? ` (+${res.errors.length - 5} more)` : '';
        toast.warning(
          `Standard upload: ${res.recordsCreated} rows created, ${res.recordsSkipped} skipped. ${preview}${suffix}`
        );
      } else {
        toast.success(`Standard upload: ${res.recordsCreated} rows created`);
      }
    } catch (e) {
      const rowErrors = e?.response?.data?.errors;
      if (Array.isArray(rowErrors) && rowErrors.length) {
        const preview = rowErrors.slice(0, 5).join('; ');
        const suffix = rowErrors.length > 5 ? ` (+${rowErrors.length - 5} more)` : '';
        toast.error(`Standard upload failed: ${preview}${suffix}`);
      } else {
        toast.error(getErrorMessage(e));
      }
    }
  };

  const dropzone = useDropzone({
    onDrop,
    accept: TABULAR_ACCEPT,
    multiple: false,
    disabled: !locationId || uploadM.isPending,
  });

  const clientOptions = directory?.clients || [{ value: 'all', label: 'All Clients' }];
  const exportBase = { locationId, clientId: client };

  const selectedClientLabel = useMemo(
    () => clientOptions.find((o) => o.value === client)?.label,
    [clientOptions, client]
  );

  const tableRecords = useMemo(() => {
    const rows = listQ.data?.records ?? [];
    const filtered =
      client === 'all'
        ? rows
        : rows.filter((r) => String(r.clientDirectoryId) === String(client));
    return sortByWeekdayThenTime(filtered);
  }, [listQ.data?.records, client]);

  const updateRowField = (field, value) => {
    setRowForm((prev) => ({ ...prev, [field]: value }));
  };

  const resetRowForm = () => {
    setRowForm(EMPTY_ROW_FORM);
    setEditingId(null);
    setShowAddForm(false);
  };

  useEffect(() => {
    resetRowForm();
  }, [client]);

  const rowPayload = () => ({
    locationId,
    clientDirectoryId: rowForm.clientDirectoryId,
    day: rowForm.day,
    startTime: rowForm.startTime,
    endTime: rowForm.endTime,
    duration: rowForm.duration,
    totalCost: rowForm.totalCost,
    rateGroups: rowForm.rateGroups,
    referenceNo: rowForm.referenceNo,
    shiftType: rowForm.shiftType,
    ratio: rowForm.ratio,
  });

  const handleSaveRow = async (e) => {
    e.preventDefault();
    if (!locationId) return;
    if (!rowForm.clientDirectoryId) {
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
      resetRowForm();
    } catch (err) {
      const data = err.response?.data;
      const msg = data?.errors?.join(', ') || getErrorMessage(err);
      toast.error(msg);
    }
  };

  const handleEditRow = (r) => {
    setEditingId(r.id);
    setRowForm(recordToStandardForm(r));
    setShowAddForm(true);
  };

  const handleDeleteRow = async (r) => {
    if (!locationId) return;
    if (!window.confirm(`Delete this ${r.day} shift for ${r.clientName}?`)) return;
    try {
      await deleteM.mutateAsync({ id: r.id, locationId });
      toast.success('Row deleted');
      if (editingId === r.id) resetRowForm();
    } catch (err) {
      toast.error(getErrorMessage(err));
    }
  };

  if (!locationId) {
    return (
      <p className="flex items-center gap-1.5 text-2sm text-muted-foreground">
        Select a location in Scope above
        <InfoHint content="Standard templates are stored per location." label="Location required" />
      </p>
    );
  }

  return (
    <Card>
          <CardHeader className="flex flex-row flex-wrap items-center justify-between gap-2 border-b pb-3">
            <CardTitleHint hint="Baseline shift patterns per client. Bulk upload (CSV/Excel) replaces all rows for this location; use Add row for single entries.">
              Standard data
            </CardTitleHint>
            <div className="flex flex-wrap gap-2">
              <Button
                type="button"
                variant={showAddForm ? 'secondary' : 'default'}
                size="sm"
                onClick={() => {
                  if (showAddForm) resetRowForm();
                  else {
                    setShowAddForm(true);
                    if (client !== 'all') {
                      setRowForm({ ...EMPTY_ROW_FORM, clientDirectoryId: client });
                    }
                  }
                }}
                disabled={dirLoading || selectableClients.length === 0}
              >
                <Plus className="mr-2 h-4 w-4" />
                {showAddForm ? 'Cancel' : 'Add row'}
              </Button>
              <TabularExportButtons
                onExportCsv={() =>
                  exportStandardCsv(exportBase).catch((e) => toast.error(getErrorMessage(e)))
                }
                onExportXlsx={() =>
                  exportStandardCsv({ ...exportBase, format: 'xlsx' }).catch((e) =>
                    toast.error(getErrorMessage(e))
                  )
                }
              />
            </div>
          </CardHeader>
          <CardContent className="space-y-4">
            {showAddForm && (
              <form
                onSubmit={handleSaveRow}
                className="rounded-lg border border-border bg-muted/30 p-4 space-y-4"
              >
                <p className="text-sm font-medium">{editingId ? 'Edit shift line' : 'Add a shift line'}</p>
                <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
                  <div className="space-y-1 sm:col-span-2 lg:col-span-1">
                    <Label>Client</Label>
                    <select
                      className={cn(nativeSelectClass, 'w-full')}
                      value={rowForm.clientDirectoryId}
                      onChange={(e) => updateRowField('clientDirectoryId', e.target.value)}
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
                    <Label>Day</Label>
                    <Select value={rowForm.day} onValueChange={(v) => updateRowField('day', v)}>
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        {WEEKDAYS.map((d) => (
                          <SelectItem key={d} value={d}>
                            {d}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-1">
                    <Label>Start time</Label>
                    <Input
                      placeholder="06:00 or 6:00 AM"
                      value={rowForm.startTime}
                      onChange={(e) => updateRowField('startTime', e.target.value)}
                      required
                    />
                  </div>
                  <div className="space-y-1">
                    <Label>End time</Label>
                    <Input
                      placeholder="10:00 or 10:00 AM"
                      value={rowForm.endTime}
                      onChange={(e) => updateRowField('endTime', e.target.value)}
                      required
                    />
                  </div>
                  <div className="space-y-1">
                    <Label>Duration (hours)</Label>
                    <Input
                      type="number"
                      step="0.01"
                      min="0"
                      placeholder="4"
                      value={rowForm.duration}
                      onChange={(e) => updateRowField('duration', e.target.value)}
                      required
                    />
                  </div>
                  <div className="space-y-1">
                    <Label>Total cost</Label>
                    <Input
                      type="number"
                      step="0.01"
                      min="0"
                      placeholder="151.96"
                      value={rowForm.totalCost}
                      onChange={(e) => updateRowField('totalCost', e.target.value)}
                      required
                    />
                  </div>
                  <div className="space-y-1 sm:col-span-2">
                    <Label>Rate groups</Label>
                    <Input
                      value={rowForm.rateGroups}
                      onChange={(e) => updateRowField('rateGroups', e.target.value)}
                    />
                  </div>
                  <div className="space-y-1">
                    <Label>Reference no</Label>
                    <Input
                      value={rowForm.referenceNo}
                      onChange={(e) => updateRowField('referenceNo', e.target.value)}
                    />
                  </div>
                  <div className="space-y-1">
                    <Label>Shift type</Label>
                    <Input
                      placeholder="Personal Care"
                      value={rowForm.shiftType}
                      onChange={(e) => updateRowField('shiftType', e.target.value)}
                    />
                  </div>
                  <div className="space-y-1">
                    <Label>Ratio</Label>
                    <Input
                      placeholder="1:2"
                      value={rowForm.ratio}
                      onChange={(e) => updateRowField('ratio', e.target.value)}
                      onBlur={(e) => updateRowField('ratio', normalizeRatio(e.target.value))}
                    />
                  </div>
                </div>
                <div className="flex gap-2">
                  <Button type="submit" size="sm" disabled={createM.isPending || updateM.isPending}>
                    {createM.isPending || updateM.isPending ? 'Saving…' : editingId ? 'Update row' : 'Save row'}
                  </Button>
                  <Button type="button" variant="outline" size="sm" onClick={resetRowForm}>
                    Cancel
                  </Button>
                </div>
              </form>
            )}

            <div
              {...dropzone.getRootProps()}
              className={cn(
                'border-2 border-dashed rounded-lg p-8 text-center cursor-pointer transition-colors',
                dropzone.isDragActive ? 'border-primary bg-primary/5' : 'border-muted-foreground/25',
                (!locationId || uploadM.isPending) && 'opacity-50 cursor-not-allowed'
              )}
            >
              <input {...dropzone.getInputProps()} />
              <Upload className="mx-auto h-6 w-6 text-muted-foreground mb-1" />
              <p className="text-2sm text-muted-foreground">
                {uploadM.isPending ? 'Uploading…' : 'Drop CSV/Excel or click to bulk-replace'}
              </p>
            </div>

            {listQ.isLoading ? (
              <LoadingScreen message="Loading standard records…" />
            ) : (
              <>
                <div className="rounded-md border overflow-x-auto">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        {TEMPLATE_TABLE_COLUMNS.map((col) => (
                          <TableHead
                            key={col.key}
                            className={col.align === 'right' ? 'text-right' : undefined}
                          >
                            {col.label}
                          </TableHead>
                        ))}
                        <TableHead className="w-[100px]">Actions</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {tableRecords.length === 0 ? (
                        <TableRow>
                          <TableCell
                            colSpan={TEMPLATE_TABLE_COLSPAN}
                            className="text-center text-muted-foreground py-8"
                          >
                            {client === 'all'
                              ? 'No standard records yet. Add a row or upload a CSV.'
                              : `No standard records for ${selectedClientLabel || 'this client'}.`}
                          </TableCell>
                        </TableRow>
                      ) : (
                        tableRecords.map((r) => (
                          <TableRow key={r.id}>
                            {TEMPLATE_TABLE_COLUMNS.map((col) => (
                              <TableCell
                                key={col.key}
                                className={cn(
                                  col.align === 'right' ? 'text-right whitespace-nowrap' : 'whitespace-nowrap',
                                  col.key === 'clientName' && 'max-w-[200px] truncate',
                                  col.key === 'rateGroups' && 'max-w-[240px] truncate'
                                )}
                                title={col.key === 'rateGroups' ? r.rateGroups || undefined : undefined}
                              >
                                {varianceCellValue(r, col.key)}
                              </TableCell>
                            ))}
                            <TableCell>
                              <div className="flex gap-1">
                                <Button
                                  type="button"
                                  variant="ghost"
                                  size="icon"
                                  className="h-8 w-8"
                                  onClick={() => handleEditRow(r)}
                                  title="Edit"
                                >
                                  <Pencil className="h-4 w-4" />
                                </Button>
                                <Button
                                  type="button"
                                  variant="ghost"
                                  size="icon"
                                  className="h-8 w-8 text-destructive"
                                  onClick={() => handleDeleteRow(r)}
                                  disabled={deleteM.isPending}
                                  title="Delete"
                                >
                                  <Trash2 className="h-4 w-4" />
                                </Button>
                              </div>
                            </TableCell>
                          </TableRow>
                        ))
                      )}
                    </TableBody>
                  </Table>
                </div>
                {tableRecords.length > 0 && (
                  <p className="text-2xs text-muted-foreground tabular-nums">
                    {tableRecords.length} row{tableRecords.length === 1 ? '' : 's'}
                    {client !== 'all' && selectedClientLabel ? ` · ${selectedClientLabel}` : ''}
                  </p>
                )}
              </>
            )}
          </CardContent>
        </Card>
  );
}
