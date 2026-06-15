import { useCallback, useEffect, useRef, useState } from 'react';
import { toast } from 'sonner';
import { Plus, Search, Trash2 } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '../../ui/card';
import { Button } from '../../ui/button';
import { Input } from '../../ui/input';
import { SkeletonTable } from '../../ui/Skeleton';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '../../ui/table';
import { getErrorMessage } from '../../utils/api';
import { cn } from '../../lib/utils';
import {
  buildEmptyDraft,
  draftToBody,
  formatCellDisplay,
  rowToDraft,
  validateDraft,
} from './crmColumnDefs';
import { formatBooleanDisplay } from './crmFormUtils.jsx';

const ROW_NUM_WIDTH = 40;

function isDraftRow(row) {
  return String(row._id || '').startsWith('draft-');
}

function CellEditor({ col, value, onChange, onCommit, onCancel, inputRef }) {
  if (col.type === 'boolean') {
    return (
      <input
        ref={inputRef}
        type="checkbox"
        checked={!!value}
        onChange={(e) => {
          onChange(e.target.checked);
          onCommit(e.target.checked);
        }}
        className="h-4 w-4"
      />
    );
  }

  if (col.type === 'select') {
    return (
      <select
        ref={inputRef}
        className="h-7 w-full min-w-0 rounded border border-input bg-background px-1 text-xs"
        value={value ?? ''}
        onChange={(e) => onChange(e.target.value)}
        onBlur={() => onCommit()}
        onKeyDown={(e) => {
          if (e.key === 'Enter') {
            e.preventDefault();
            onCommit();
          }
          if (e.key === 'Escape') {
            e.preventDefault();
            onCancel();
          }
        }}
        autoFocus
      >
        <option value="">—</option>
        {(col.options || []).map((o) => (
          <option key={o} value={o}>
            {o}
          </option>
        ))}
      </select>
    );
  }

  const inputType =
    col.type === 'date' ? 'date' : col.type === 'datetime' ? 'datetime-local' : col.type === 'number' ? 'number' : 'text';

  return (
    <Input
      ref={inputRef}
      type={inputType}
      value={value ?? ''}
      onChange={(e) => onChange(e.target.value)}
      onBlur={() => onCommit()}
      onKeyDown={(e) => {
        if (e.key === 'Enter') {
          e.preventDefault();
          onCommit();
        }
        if (e.key === 'Escape') {
          e.preventDefault();
          onCancel();
        }
      }}
      className="h-7 px-1.5 text-xs"
      autoFocus
    />
  );
}

function DisplayCell({ row, col }) {
  if (col.type === 'boolean') {
    return <span className="tabular-nums">{formatBooleanDisplay(row[col.key], col.booleanStyle)}</span>;
  }
  const text = formatCellDisplay(row, col);
  return (
    <span className="block max-w-[220px] truncate tabular-nums" title={text}>
      {text}
    </span>
  );
}

export function CrmSpreadsheet({
  title,
  columns,
  rows = [],
  idField,
  idLabel,
  isLoading,
  canManage,
  searchValue = '',
  onSearchChange,
  onCreate,
  onUpdate,
  onDelete,
  deleteConfirm,
  isSaving = false,
}) {
  const [draftRows, setDraftRows] = useState([]);
  const [editing, setEditing] = useState(null);
  const [editValue, setEditValue] = useState('');
  const [savingCell, setSavingCell] = useState(false);
  const inputRef = useRef(null);

  const allRows = [...rows, ...draftRows];

  const clearEditing = useCallback(() => {
    setEditing(null);
    setEditValue('');
  }, []);

  useEffect(() => {
    if (editing && inputRef.current) {
      inputRef.current.focus?.();
      inputRef.current.select?.();
    }
  }, [editing]);

  const startEdit = (rowIndex, colKey, row) => {
    if (!canManage || savingCell) return;
    const col = columns.find((c) => c.key === colKey);
    if (!col) return;
    if (col.isId && !isDraftRow(row)) return;

    const draft = isDraftRow(row) ? row : rowToDraft(row, columns);
    setEditing({ rowIndex, colKey, rowId: row._id, originalDraft: draft });
    setEditValue(draft[colKey] ?? (col.type === 'boolean' ? false : ''));
  };

  const moveEdit = (direction) => {
    if (!editing) return;
    const row = allRows[editing.rowIndex];
    const colIndex = columns.findIndex((c) => c.key === editing.colKey);
    let nextCol = colIndex + direction;
    while (nextCol >= 0 && nextCol < columns.length) {
      const col = columns[nextCol];
      const canEditCol = !(col.isId && !isDraftRow(row));
      if (canEditCol) {
        startEdit(editing.rowIndex, col.key, row);
        return;
      }
      nextCol += direction;
    }
    clearEditing();
  };

  const commitEdit = async (overrideValue) => {
    if (!editing || savingCell) return;

    const row = allRows[editing.rowIndex];
    const col = columns.find((c) => c.key === editing.colKey);
    if (!col) {
      clearEditing();
      return;
    }

    const newValue = overrideValue !== undefined ? overrideValue : editValue;
    const prevValue = editing.originalDraft[col.key];
    const valuesEqual =
      col.type === 'boolean'
        ? !!newValue === !!prevValue
        : String(newValue ?? '') === String(prevValue ?? '');

    if (valuesEqual) {
      clearEditing();
      return;
    }

    const mergedDraft = { ...editing.originalDraft, [col.key]: newValue };
    const err = validateDraft(mergedDraft, idField, idLabel);
    if (err && col.isId) {
      toast.error(err);
      clearEditing();
      return;
    }

    setSavingCell(true);
    try {
      const body = draftToBody(mergedDraft, columns);

      if (isDraftRow(row)) {
      const idErr = validateDraft(mergedDraft, idField, idLabel);
      setDraftRows((prev) =>
        prev.map((d) => (d._id === row._id ? { ...d, ...mergedDraft } : d))
      );
      if (idErr) {
        clearEditing();
        return;
      }
      await onCreate(body);
      setDraftRows((prev) => prev.filter((d) => d._id !== row._id));
      toast.success('Created');
    } else {
        await onUpdate({ id: row._id, ...body });
        toast.success('Updated');
      }
      clearEditing();
    } catch (e) {
      toast.error(getErrorMessage(e));
    } finally {
      setSavingCell(false);
    }
  };

  const handleKeyNav = async (e) => {
    if (e.key === 'Tab') {
      e.preventDefault();
      await commitEdit();
      moveEdit(e.shiftKey ? -1 : 1);
    }
  };

  const addRow = () => {
    const draft = buildEmptyDraft(columns);
    setDraftRows((prev) => [...prev, { _id: `draft-${Date.now()}`, ...draft }]);
  };

  const removeRow = async (row) => {
    if (!confirm(deleteConfirm)) return;
    if (isDraftRow(row)) {
      setDraftRows((prev) => prev.filter((d) => d._id !== row._id));
      if (editing?.rowId === row._id) clearEditing();
      return;
    }
    try {
      await onDelete(row._id);
      toast.success('Deleted');
      if (editing?.rowId === row._id) clearEditing();
    } catch (e) {
      toast.error(getErrorMessage(e));
    }
  };

  const getRowData = (row) => {
    if (isDraftRow(row)) return row;
    if (editing?.rowId === row._id) {
      return { ...row, ...editing.originalDraft, ...(editing ? { [editing.colKey]: editValue } : {}) };
    }
    return row;
  };

  const stickyIdLeft = ROW_NUM_WIDTH;

  return (
    <Card>
      <CardHeader className="space-y-3 pb-3">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <CardTitle className="text-base">{title}</CardTitle>
          <div className="flex flex-wrap items-center gap-2">
            <div className="relative">
              <Search className="absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted-foreground" />
              <Input
                value={searchValue}
                onChange={(e) => onSearchChange?.(e.target.value)}
                placeholder="Search…"
                className="h-8 w-48 pl-8 text-xs"
              />
            </div>
            <span className="text-xs text-muted-foreground tabular-nums">
              {allRows.length} record{allRows.length === 1 ? '' : 's'}
            </span>
            {canManage && (
              <Button type="button" size="sm" variant="outline" onClick={addRow} disabled={isSaving || savingCell}>
                <Plus className="mr-1 h-3.5 w-3.5" />
                Add row
              </Button>
            )}
          </div>
        </div>
      </CardHeader>
      <CardContent className="p-0 pb-4">
        {isLoading ? (
          <div className="px-4">
            <SkeletonTable rows={8} cols={Math.min(columns.length, 6)} />
          </div>
        ) : (
          <div className="max-h-[calc(100vh-12rem)] overflow-auto border-t">
            <Table className="border-collapse text-xs">
              <TableHeader className="sticky top-0 z-20 bg-muted/90 backdrop-blur-sm">
                <TableRow className="hover:bg-muted/90">
                  <TableHead
                    className="sticky left-0 z-30 h-8 border border-border/60 bg-muted/90 px-2 py-1 text-center font-semibold"
                    style={{ width: ROW_NUM_WIDTH, minWidth: ROW_NUM_WIDTH }}
                  >
                    #
                  </TableHead>
                  {columns.map((col) => (
                    <TableHead
                      key={col.key}
                      className={cn(
                        'h-8 border border-border/60 px-2 py-1 font-semibold whitespace-nowrap',
                        col.isId && 'sticky z-30 bg-muted/90 border-r-2 border-r-border'
                      )}
                      style={{
                        minWidth: col.minWidth || 100,
                        ...(col.isId ? { left: stickyIdLeft } : {}),
                      }}
                    >
                      {col.label}
                    </TableHead>
                  ))}
                  {canManage && (
                    <TableHead className="h-8 w-10 border border-border/60 px-1 py-1" />
                  )}
                </TableRow>
              </TableHeader>
              <TableBody>
                {allRows.length === 0 ? (
                  <TableRow>
                    <TableCell
                      colSpan={columns.length + (canManage ? 2 : 1)}
                      className="border border-border/60 px-4 py-8 text-center text-muted-foreground"
                    >
                      No records found
                    </TableCell>
                  </TableRow>
                ) : (
                  allRows.map((row, rowIndex) => {
                    const displayRow = getRowData(row);
                    const isDraft = isDraftRow(row);
                    return (
                      <TableRow
                        key={row._id}
                        className={cn(
                          'hover:bg-muted/30',
                          rowIndex % 2 === 1 && 'bg-muted/10',
                          isDraft && 'bg-amber-50/50 dark:bg-amber-950/20'
                        )}
                      >
                        <TableCell
                          className="sticky left-0 z-10 border border-border/60 bg-background px-2 py-1 text-center text-muted-foreground tabular-nums"
                          style={{ width: ROW_NUM_WIDTH, minWidth: ROW_NUM_WIDTH }}
                        >
                          {rowIndex + 1}
                        </TableCell>
                        {columns.map((col) => {
                          const isEditing =
                            editing?.rowIndex === rowIndex && editing?.colKey === col.key;
                          const readOnly = !canManage || (col.isId && !isDraft);
                          return (
                            <TableCell
                              key={col.key}
                              className={cn(
                                'border border-border/60 px-2 py-1',
                                !readOnly && 'cursor-cell',
                                isEditing && 'ring-2 ring-inset ring-primary bg-background',
                                col.isId && 'sticky z-10 bg-background border-r-2 border-r-border font-medium'
                              )}
                              style={{
                                minWidth: col.minWidth || 100,
                                ...(col.isId ? { left: stickyIdLeft } : {}),
                              }}
                              onClick={() => !readOnly && !isEditing && startEdit(rowIndex, col.key, row)}
                              onKeyDown={isEditing ? handleKeyNav : undefined}
                            >
                              {isEditing ? (
                                <CellEditor
                                  col={col}
                                  value={editValue}
                                  onChange={setEditValue}
                                  onCommit={commitEdit}
                                  onCancel={clearEditing}
                                  inputRef={inputRef}
                                />
                              ) : (
                                <DisplayCell row={displayRow} col={col} />
                              )}
                            </TableCell>
                          );
                        })}
                        {canManage && (
                          <TableCell className="border border-border/60 px-1 py-1 text-center">
                            <Button
                              type="button"
                              variant="ghost"
                              size="icon"
                              className="h-7 w-7 text-muted-foreground hover:text-destructive"
                              onClick={() => removeRow(row)}
                              disabled={savingCell}
                              aria-label="Delete row"
                            >
                              <Trash2 className="h-3.5 w-3.5" />
                            </Button>
                          </TableCell>
                        )}
                      </TableRow>
                    );
                  })
                )}
              </TableBody>
            </Table>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
