import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { toast } from 'sonner';
import { Plus, Search, Trash2, ArrowUp, ArrowDown, ArrowUpDown } from 'lucide-react';
import { Card, CardContent, CardHeader } from '../../ui/card';
import { Button } from '../../ui/button';
import { Input } from '../../ui/input';
import { SkeletonTable } from '../../ui/Skeleton';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow, TableScrollArea } from '../../ui/table';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '../../ui/dialog';
import { getErrorMessage } from '../../utils/api';
import { cn } from '../../lib/utils';
import { fetchCrmNextId } from '../../api/crm';
import { ActionUpdateThread } from '../../components/ActionUpdateThread';
import {
  buildEmptyDraft,
  compareCellValues,
  draftToBody,
  formatCellDisplay,
  parseFieldValue,
  rowToDraft,
  validateDraft,
} from './crmColumnDefs';
import { formatBooleanDisplay } from './crmFormUtils.jsx';
import { nativeSelectClass } from '../../ui/select';
import { useSpreadsheetCollaboration } from '../../hooks/useSpreadsheetCollaboration';

const ROW_NUM_WIDTH = 40;

function stickyFrozenCellClass({ rowIndex, isDraft, isHeader, isIdColumn }) {
  if (isHeader) {
    return cn(
      'bg-card',
      isIdColumn && 'shadow-[4px_0_8px_-4px_rgba(0,0,0,0.08)] dark:shadow-[4px_0_8px_-4px_rgba(0,0,0,0.35)]'
    );
  }
  return cn(
    'bg-card',
    rowIndex % 2 === 1 && 'bg-muted',
    isDraft && 'bg-warning/20',
    'group-hover:bg-accent',
    isIdColumn && 'shadow-[4px_0_8px_-4px_rgba(0,0,0,0.08)] dark:shadow-[4px_0_8px_-4px_rgba(0,0,0,0.35)]'
  );
}

function sortStorageKey(title) {
  return `crm-sort:${title}`;
}

function loadSortState(title) {
  try {
    const raw = sessionStorage.getItem(sortStorageKey(title));
    if (!raw) return { sortKey: null, sortDir: 'asc' };
    const parsed = JSON.parse(raw);
    return {
      sortKey: parsed.sortKey ?? null,
      sortDir: parsed.sortDir === 'desc' ? 'desc' : 'asc',
    };
  } catch {
    return { sortKey: null, sortDir: 'asc' };
  }
}

function saveSortState(title, sortKey, sortDir) {
  try {
    sessionStorage.setItem(sortStorageKey(title), JSON.stringify({ sortKey, sortDir }));
  } catch {}
}

function isDraftRow(row) {
  return String(row._id || '').startsWith('draft-');
}

function isIdReadOnly(col, row, autoIdEntity) {
  if (!col.isId) return false;
  if (!isDraftRow(row)) return true;
  return !!autoIdEntity;
}

function isCellReadOnly(col, row, autoIdEntity, canManage) {
  if (!canManage || col.computed) return true;
  return isIdReadOnly(col, row, autoIdEntity);
}

function isCustomSelectValue(value, col) {
  if (!col.allowOther) return false;
  const v = String(value ?? '').trim();
  if (!v || v === 'Other') return false;
  return !(col.options || []).includes(v);
}

function resolveSelectCommitValue(selectVal, otherText, col) {
  if (!col.allowOther) return selectVal;
  if (selectVal === 'Other') {
    const custom = String(otherText ?? '').trim();
    return custom || 'Other';
  }
  return selectVal;
}

function SelectCellEditor({ col, value, onChange, onCommit, onCancel, inputRef }) {
  const opts = col.options || [];
  const custom = isCustomSelectValue(value, col);
  const [selectVal, setSelectVal] = useState(custom ? 'Other' : (value ?? ''));
  const [otherText, setOtherText] = useState(custom ? String(value) : '');

  const commitSelect = () => {
    const resolved = resolveSelectCommitValue(selectVal, otherText, col);
    onChange(resolved);
    onCommit(resolved);
  };

  return (
    <div className="flex min-w-[140px] flex-col gap-1">
      <select
        ref={inputRef}
        className={cn('h-7 w-full min-w-0 px-1 text-xs', nativeSelectClass)}
        value={selectVal}
        onChange={(e) => {
          const next = e.target.value;
          setSelectVal(next);
          if (!col.allowOther || next !== 'Other') {
            onChange(next);
          }
        }}
        onBlur={() => {
          if (!col.allowOther || selectVal !== 'Other') commitSelect();
        }}
        onKeyDown={(e) => {
          if (e.key === 'Enter') {
            e.preventDefault();
            commitSelect();
          }
          if (e.key === 'Escape') {
            e.preventDefault();
            onCancel();
          }
        }}
        autoFocus
      >
        <option value="">—</option>
        {opts.map((o) => (
          <option key={o} value={o}>
            {o}
          </option>
        ))}
      </select>
      {col.allowOther && selectVal === 'Other' && (
        <Input
          type="text"
          value={otherText}
          onChange={(e) => setOtherText(e.target.value)}
          onBlur={commitSelect}
          onKeyDown={(e) => {
            if (e.key === 'Enter') {
              e.preventDefault();
              commitSelect();
            }
          }}
          placeholder="Specify other…"
          className="h-7 px-1.5 text-xs"
          autoFocus
        />
      )}
    </div>
  );
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
      <SelectCellEditor
        col={col}
        value={value}
        onChange={onChange}
        onCommit={onCommit}
        onCancel={onCancel}
        inputRef={inputRef}
      />
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

function OverflowTextCell({ row, col, onExpand, multiline }) {
  const text = formatCellDisplay(row, col);
  const canExpand = text.length > 0;

  if (multiline) {
    return (
      <span
        className={cn(
          'block max-w-[220px] truncate tabular-nums',
          canExpand && 'cursor-pointer',
          !canExpand && 'text-muted-foreground/50'
        )}
        title={canExpand ? 'Click to open editor' : 'Click to add text'}
      >
        {text || '—'}
      </span>
    );
  }

  return (
    <span
      className={cn(
        'block max-w-[220px] truncate tabular-nums',
        canExpand && text.length > 40 && 'cursor-zoom-in'
      )}
      title={canExpand && text.length > 40 ? 'Double-click to view full text' : text || undefined}
      onDoubleClick={(e) => {
        if (!canExpand || text.length <= 40) return;
        e.stopPropagation();
        onExpand({ title: col.label, text, readOnly: true });
      }}
    >
      {text}
    </span>
  );
}

function DisplayCell({ row, col, onExpand, livePreview, multiline }) {
  if (livePreview?.value != null && String(livePreview.value) !== '') {
    return (
      <span
        className="block max-w-[220px] truncate tabular-nums italic"
        style={{ color: livePreview.color }}
        title={`${livePreview.userName} is editing…`}
      >
        {String(livePreview.value)}
      </span>
    );
  }
  if (col.actionsPanel) {
    const text = formatCellDisplay(row, col);
    const count = (row.actionUpdates ?? []).length;
    return (
      <span
        className="block max-w-[220px] truncate cursor-pointer tabular-nums"
        title={count > 0 ? `${count} update(s) — click to open` : 'Click to open actions'}
      >
        {text || '—'}
        {count > 0 && (
          <span className="ml-1 rounded-full bg-muted px-1.5 py-0.5 text-2xs font-medium text-muted-foreground">
            {count}
          </span>
        )}
      </span>
    );
  }
  if (col.type === 'boolean') {
    return <span className="tabular-nums">{formatBooleanDisplay(row[col.key], col.booleanStyle)}</span>;
  }
  return <OverflowTextCell row={row} col={col} onExpand={onExpand} multiline={multiline} />;
}

export function CrmSpreadsheet({
  title,
  columns,
  rows = [],
  idField,
  idLabel,
  autoIdEntity,
  fetchNextId = fetchCrmNextId,
  isLoading,
  canManage,
  searchValue = '',
  onSearchChange,
  onCreate,
  onUpdate,
  onDelete,
  onAppendActionUpdate,
  deleteConfirm,
  isSaving = false,
  collaborationRoom,
  queryKeyPrefix,
  rowsKey,
}) {
  const [draftRows, setDraftRows] = useState([]);
  const [editing, setEditing] = useState(null);
  const [editValue, setEditValue] = useState('');
  const [savingCell, setSavingCell] = useState(false);
  const [addingRow, setAddingRow] = useState(false);
  const [expandEditor, setExpandEditor] = useState(null);
  const [actionsPanel, setActionsPanel] = useState(null);
  const [postingActionUpdate, setPostingActionUpdate] = useState(false);
  const [{ sortKey, sortDir }, setSortState] = useState(() => loadSortState(title));
  const inputRef = useRef(null);
  const expandTextareaRef = useRef(null);
  const editingRef = useRef(null);

  useEffect(() => {
    editingRef.current = editing
      ? { rowId: String(editing.rowId), colKey: editing.colKey }
      : null;
  }, [editing]);

  const collaboration = useSpreadsheetCollaboration({
    room: collaborationRoom,
    queryKeyPrefix: queryKeyPrefix || [],
    rowsKey: rowsKey || '',
    editingRef,
  });

  const { connected, peers, cellFocus, livePreviews, notifyFocus, notifyBlur, notifyPreview } =
    collaboration;

  useEffect(() => {
    saveSortState(title, sortKey, sortDir);
  }, [title, sortKey, sortDir]);

  const sortedSavedRows = useMemo(() => {
    if (!sortKey) return rows;
    const col = columns.find((c) => c.key === sortKey);
    if (!col) return rows;
    const copy = [...rows];
    copy.sort((a, b) => {
      const cmp = compareCellValues(a, b, col);
      return sortDir === 'desc' ? -cmp : cmp;
    });
    return copy;
  }, [rows, sortKey, sortDir, columns]);

  const allRows = useMemo(() => [...sortedSavedRows, ...draftRows], [sortedSavedRows, draftRows]);

  useEffect(() => {
    if (!actionsPanel?.row?._id || isDraftRow(actionsPanel.row)) return;
    const fresh = rows.find((r) => String(r._id) === String(actionsPanel.row._id));
    if (fresh) {
      setActionsPanel((prev) => (prev ? { ...prev, row: fresh } : prev));
    }
  }, [rows, actionsPanel?.row?._id]);

  const clearEditing = useCallback(() => {
    const e = editingRef.current;
    if (e && collaborationRoom) {
      notifyBlur(e.rowId, e.colKey);
    }
    setEditing(null);
    setEditValue('');
  }, [collaborationRoom, notifyBlur]);

  useEffect(() => {
    if (!editing || !collaborationRoom) return undefined;
    const timer = setTimeout(() => {
      notifyPreview(editing.rowId, editing.colKey, editValue);
    }, 120);
    return () => clearTimeout(timer);
  }, [editValue, editing, collaborationRoom, notifyPreview]);

  useEffect(() => {
    if (editing && inputRef.current) {
      inputRef.current.focus?.();
      inputRef.current.select?.();
    }
  }, [editing]);

  useEffect(() => {
    if (expandEditor && expandTextareaRef.current) {
      expandTextareaRef.current.focus();
      const len = expandTextareaRef.current.value.length;
      expandTextareaRef.current.setSelectionRange(len, len);
    }
  }, [expandEditor]);

  const closeExpandEditor = useCallback(() => {
    if (expandEditor && collaborationRoom && !expandEditor.readOnly) {
      notifyBlur(expandEditor.row._id, expandEditor.col.key);
    }
    setExpandEditor(null);
  }, [collaborationRoom, expandEditor, notifyBlur]);

  const handleSort = (colKey) => {
    setSortState((prev) => {
      if (prev.sortKey === colKey) {
        return { sortKey: colKey, sortDir: prev.sortDir === 'asc' ? 'desc' : 'asc' };
      }
      return { sortKey: colKey, sortDir: 'asc' };
    });
  };

  const startEdit = (rowIndex, colKey, row) => {
    if (!canManage || savingCell) return;
    const col = columns.find((c) => c.key === colKey);
    if (!col) return;
    if (isCellReadOnly(col, row, autoIdEntity, canManage)) return;

    const draft = isDraftRow(row) ? row : rowToDraft(row, columns);
    if (editing && (editing.rowId !== row._id || editing.colKey !== colKey)) {
      notifyBlur(editing.rowId, editing.colKey);
    }
    setEditing({ rowIndex, colKey, rowId: row._id, originalDraft: draft });
    setEditValue(draft[colKey] ?? (col.type === 'boolean' ? false : ''));
    if (collaborationRoom) notifyFocus(row._id, colKey);
  };

  const closeActionsPanel = useCallback(() => {
    if (actionsPanel?.row && collaborationRoom) {
      notifyBlur(actionsPanel.row._id, 'actions');
    }
    setActionsPanel(null);
  }, [actionsPanel, collaborationRoom, notifyBlur]);

  const openActionsPanel = (rowIndex, row) => {
    clearEditing();
    const draft = isDraftRow(row) ? row : rowToDraft(row, columns);
    setActionsPanel({
      row,
      rowIndex,
      actionsValue: draft.actions ?? '',
      originalDraft: draft,
    });
    if (collaborationRoom) notifyFocus(row._id, 'actions');
  };

  const saveActionsPanel = async () => {
    if (!actionsPanel || savingCell) return;
    const { row, actionsValue, originalDraft } = actionsPanel;
    if (String(actionsValue ?? '') === String(originalDraft.actions ?? '')) {
      closeActionsPanel();
      return;
    }

    const mergedDraft = { ...originalDraft, actions: actionsValue };
    setSavingCell(true);
    try {
      if (isDraftRow(row)) {
        setDraftRows((prev) =>
          prev.map((d) => (d._id === row._id ? { ...d, actions: actionsValue } : d))
        );
        const idErr = validateDraft(mergedDraft, idField, idLabel);
        if (idErr) {
          closeActionsPanel();
          return;
        }
        await onCreate(draftToBody(mergedDraft, columns));
        setDraftRows((prev) => prev.filter((d) => d._id !== row._id));
        toast.success('Created');
      } else {
        await onUpdate({ id: row._id, actions: parseFieldValue(actionsValue, { type: 'text' }) });
        toast.success('Updated');
      }
      closeActionsPanel();
    } catch (e) {
      toast.error(getErrorMessage(e));
    } finally {
      setSavingCell(false);
    }
  };

  const postActionUpdate = async ({ text, authorName }) => {
    if (!actionsPanel?.row?._id || isDraftRow(actionsPanel.row) || !onAppendActionUpdate) return;
    setPostingActionUpdate(true);
    try {
      const res = await onAppendActionUpdate({
        id: actionsPanel.row._id,
        text,
        authorName,
      });
      const updated = res?.record ?? res;
      if (updated) {
        setActionsPanel((prev) =>
          prev ? { ...prev, row: { ...prev.row, ...updated } } : prev
        );
      }
      toast.success('Update posted');
    } catch (e) {
      toast.error(getErrorMessage(e));
    } finally {
      setPostingActionUpdate(false);
    }
  };

  const openExpandEditor = (rowIndex, colKey, row, readOnly = false) => {
    const col = columns.find((c) => c.key === colKey);
    if (!col) return;
    clearEditing();
    const draft = isDraftRow(row) ? row : rowToDraft(row, columns);
    setExpandEditor({
      title: col.label,
      value: draft[colKey] ?? '',
      originalDraft: draft,
      row,
      col,
      rowIndex,
      readOnly,
    });
    if (collaborationRoom && !readOnly) notifyFocus(row._id, colKey);
  };

  const handleCellClick = (rowIndex, colKey, row) => {
    const col = columns.find((c) => c.key === colKey);
    if (!col) return;
    const cellReadOnly = isCellReadOnly(col, row, autoIdEntity, canManage);
    if (col.actionsPanel) {
      openActionsPanel(rowIndex, row);
      return;
    }
    if (col.multiline) {
      openExpandEditor(rowIndex, colKey, row, cellReadOnly);
      return;
    }
    if (cellReadOnly) return;
    startEdit(rowIndex, colKey, row);
  };

  const moveEdit = (direction) => {
    if (!editing) return;
    const row = allRows[editing.rowIndex];
    const colIndex = columns.findIndex((c) => c.key === editing.colKey);
    let nextCol = colIndex + direction;
    while (nextCol >= 0 && nextCol < columns.length) {
      const col = columns[nextCol];
      if (!isCellReadOnly(col, row, autoIdEntity, canManage)) {
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
        const patch = { [col.key]: parseFieldValue(newValue, col) };
        await onUpdate({ id: row._id, ...patch });
        toast.success('Updated');
      }
      clearEditing();
    } catch (e) {
      toast.error(getErrorMessage(e));
    } finally {
      setSavingCell(false);
    }
  };

  const saveExpandEditor = async () => {
    if (!expandEditor || expandEditor.readOnly || savingCell) return;

    const { row, col, value, originalDraft } = expandEditor;
    const prevValue = originalDraft[col.key];
    const valuesEqual = String(value ?? '') === String(prevValue ?? '');

    if (valuesEqual) {
      closeExpandEditor();
      return;
    }

    const mergedDraft = { ...originalDraft, [col.key]: value };
    const err = validateDraft(mergedDraft, idField, idLabel);
    if (err && col.isId) {
      toast.error(err);
      closeExpandEditor();
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
          closeExpandEditor();
          return;
        }
        await onCreate(body);
        setDraftRows((prev) => prev.filter((d) => d._id !== row._id));
        toast.success('Created');
      } else {
        const patch = { [col.key]: parseFieldValue(value, col) };
        await onUpdate({ id: row._id, ...patch });
        toast.success('Updated');
      }
      closeExpandEditor();
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

  const addRow = async () => {
    setAddingRow(true);
    try {
      const draft = buildEmptyDraft(columns);
      if (autoIdEntity) {
        const { id } = await fetchNextId(autoIdEntity);
        draft[idField] = id;
      }
      setDraftRows((prev) => [...prev, { _id: `draft-${Date.now()}`, ...draft }]);
    } catch (e) {
      toast.error(getErrorMessage(e));
    } finally {
      setAddingRow(false);
    }
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

  const SortIcon = ({ colKey }) => {
    if (sortKey !== colKey) {
      return <ArrowUpDown className="ml-1 inline h-3 w-3 opacity-40" />;
    }
    return sortDir === 'asc' ? (
      <ArrowUp className="ml-1 inline h-3 w-3" />
    ) : (
      <ArrowDown className="ml-1 inline h-3 w-3" />
    );
  };

  return (
    <Card>
      <Dialog open={!!actionsPanel} onOpenChange={(open) => !open && closeActionsPanel()}>
        <DialogContent className="flex max-h-[85vh] w-[min(42rem,92vw)] flex-col gap-3 sm:max-w-2xl">
          <DialogHeader>
            <DialogTitle>Actions — {actionsPanel?.row?.[idField] || 'New record'}</DialogTitle>
          </DialogHeader>
          <div>
            <p className="mb-2 text-xs font-medium text-muted-foreground">Planned action</p>
            <textarea
              value={actionsPanel?.actionsValue ?? ''}
              readOnly={!canManage}
              onChange={(e) =>
                setActionsPanel((prev) => (prev ? { ...prev, actionsValue: e.target.value } : prev))
              }
              className="min-h-[120px] w-full resize-y rounded-md border border-input bg-background px-3 py-2 text-sm leading-relaxed focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
              placeholder="Describe the planned action…"
            />
          </div>
          <ActionUpdateThread
            notes={actionsPanel?.row?.actionUpdates ?? []}
            canPost={canManage && actionsPanel?.row && !isDraftRow(actionsPanel.row) && !!onAppendActionUpdate}
            onPost={postActionUpdate}
            isPosting={postingActionUpdate}
          />
          <div className="flex justify-end gap-2">
            <Button type="button" variant="outline" onClick={closeActionsPanel}>
              Close
            </Button>
            {canManage && (
              <Button type="button" onClick={saveActionsPanel} disabled={savingCell}>
                {savingCell ? 'Saving…' : 'Save action'}
              </Button>
            )}
          </div>
        </DialogContent>
      </Dialog>

      <Dialog open={!!expandEditor} onOpenChange={(open) => !open && closeExpandEditor()}>
        <DialogContent className="flex max-h-[85vh] w-[min(42rem,92vw)] flex-col gap-3 sm:max-w-2xl">
          <DialogHeader>
            <DialogTitle>{expandEditor?.title || 'Cell content'}</DialogTitle>
          </DialogHeader>
          <textarea
            ref={expandTextareaRef}
            value={expandEditor?.value ?? ''}
            readOnly={expandEditor?.readOnly}
            onChange={(e) =>
              setExpandEditor((prev) => (prev ? { ...prev, value: e.target.value } : prev))
            }
            onKeyDown={(e) => {
              if (e.key === 'Escape') {
                e.preventDefault();
                closeExpandEditor();
              }
              if ((e.metaKey || e.ctrlKey) && e.key === 'Enter' && !expandEditor?.readOnly) {
                e.preventDefault();
                saveExpandEditor();
              }
            }}
            className="min-h-[260px] w-full flex-1 resize-y rounded-md border border-input bg-background px-3 py-2 text-sm leading-relaxed focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
            placeholder={expandEditor?.readOnly ? undefined : 'Type here…'}
          />
          <div className="flex justify-end gap-2">
            <Button type="button" variant="outline" onClick={closeExpandEditor}>
              {expandEditor?.readOnly ? 'Close' : 'Cancel'}
            </Button>
            {!expandEditor?.readOnly && (
              <Button type="button" onClick={saveExpandEditor} disabled={savingCell}>
                {savingCell ? 'Saving…' : 'Save'}
              </Button>
            )}
          </div>
        </DialogContent>
      </Dialog>

      <CardHeader className="space-y-0 border-b py-2.5">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <span className="text-sm font-semibold">{title}</span>
          <div className="filter-toolbar py-1">
            <div className="relative">
              <Search className="absolute left-2 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted-foreground" />
              <Input
                value={searchValue}
                onChange={(e) => onSearchChange?.(e.target.value)}
                placeholder="Search…"
                className="filter-control h-8 w-44 pl-7"
              />
            </div>
            <span className="text-2xs text-muted-foreground tabular-nums">
              {allRows.length} record{allRows.length === 1 ? '' : 's'}
            </span>
            {canManage && (
              <Button
                type="button"
                size="sm"
                variant="outline"
                className="h-8"
                onClick={addRow}
                disabled={isSaving || savingCell || addingRow}
              >
                <Plus className="mr-1 h-3.5 w-3.5" />
                {addingRow ? 'Adding…' : 'Add row'}
              </Button>
            )}
          </div>
        </div>
        {collaborationRoom && (
          <div className="mt-2 flex flex-wrap items-center gap-1.5 text-2xs">
            <span
              className={cn(
                'inline-flex items-center gap-1.5 rounded-full px-2 py-0.5',
                connected ? 'bg-success/15 text-success' : 'bg-muted text-muted-foreground'
              )}
            >
              <span
                className={cn('h-1.5 w-1.5 rounded-full', connected ? 'bg-success' : 'bg-muted-foreground')}
              />
              {connected ? 'Live' : 'Reconnecting…'}
            </span>
            {peers.length > 0 && (
              <>
                <span className="text-muted-foreground">Viewing:</span>
                {peers.map((p) => (
                  <span
                    key={p.userId}
                    className="inline-flex items-center gap-1 rounded-full bg-muted px-2 py-0.5"
                    title={p.name}
                  >
                    <span className="h-2 w-2 rounded-full" style={{ backgroundColor: p.color }} />
                    {p.name}
                  </span>
                ))}
              </>
            )}
          </div>
        )}
      </CardHeader>
      <CardContent className="p-0 pb-4">
        {isLoading ? (
          <div className="px-4">
            <SkeletonTable rows={8} cols={Math.min(columns.length, 6)} />
          </div>
        ) : (
          <TableScrollArea>
            <Table scrollable={false}>
              <TableHeader className="sticky top-0 z-20 bg-card shadow-[0_1px_0_0_var(--border)]">
                <TableRow>
                  <TableHead
                    className={cn(
                      'sticky left-0 top-0 z-40 text-center',
                      stickyFrozenCellClass({ isHeader: true })
                    )}
                    style={{ width: ROW_NUM_WIDTH, minWidth: ROW_NUM_WIDTH }}
                  >
                    #
                  </TableHead>
                  {columns.map((col) => (
                    <TableHead
                      key={col.key}
                      className={cn(
                        'sticky top-0 select-none bg-card',
                        col.isId && cn(
                          'sticky z-40 border-r-2 border-r-border',
                          stickyFrozenCellClass({ isHeader: true, isIdColumn: true })
                        ),
                        !col.isId && 'z-30',
                        'cursor-pointer hover:bg-muted/80'
                      )}
                      style={{
                        minWidth: col.minWidth || 100,
                        ...(col.isId ? { left: stickyIdLeft } : {}),
                      }}
                      onClick={() => handleSort(col.key)}
                      title={`Sort by ${col.label}`}
                    >
                      <span className="inline-flex items-center">
                        {col.label}
                        <SortIcon colKey={col.key} />
                      </span>
                    </TableHead>
                  ))}
                  {canManage && (
                    <TableHead className="sticky top-0 z-30 bg-card w-10 px-1" />
                  )}
                </TableRow>
              </TableHeader>
              <TableBody striped={false}>
                {allRows.length === 0 ? (
                  <TableRow>
                    <TableCell
                      colSpan={columns.length + (canManage ? 2 : 1)}
                      className="px-4 py-8 text-center text-muted-foreground"
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
                          'group',
                          'hover:bg-muted/30',
                          rowIndex % 2 === 1 && 'bg-muted/10',
                          isDraft && 'bg-warning/10'
                        )}
                      >
                        <TableCell
                          className={cn(
                            'sticky left-0 z-20 text-center text-muted-foreground tabular-nums',
                            stickyFrozenCellClass({ rowIndex, isDraft })
                          )}
                          style={{ width: ROW_NUM_WIDTH, minWidth: ROW_NUM_WIDTH }}
                        >
                          {rowIndex + 1}
                        </TableCell>
                        {columns.map((col) => {
                          const isEditing =
                            editing?.rowIndex === rowIndex && editing?.colKey === col.key;
                          const readOnly = isCellReadOnly(col, row, autoIdEntity, canManage);
                          const focusKey = `${row._id}:${col.key}`;
                          const peerFocus = cellFocus[focusKey];
                          const livePreview = livePreviews[focusKey];
                          return (
                            <TableCell
                              key={col.key}
                              className={cn(
                                'relative',
                                !readOnly && 'cursor-cell',
                                isEditing && 'bg-background ring-2 ring-inset ring-primary',
                                peerFocus && !isEditing && 'bg-background',
                                col.isId && cn(
                                  'sticky z-20 border-r-2 border-r-border font-medium',
                                  stickyFrozenCellClass({ rowIndex, isDraft, isIdColumn: true })
                                )
                              )}
                              style={{
                                minWidth: col.minWidth || 100,
                                ...(col.isId ? { left: stickyIdLeft } : {}),
                                ...(peerFocus && !isEditing
                                  ? { boxShadow: `inset 0 0 0 2px ${peerFocus.color}` }
                                  : {}),
                              }}
                              onClick={() => !isEditing && handleCellClick(rowIndex, col.key, row)}
                              onKeyDown={isEditing ? handleKeyNav : undefined}
                            >
                              {peerFocus && !isEditing && (
                                <span
                                  className="absolute -top-2 left-1 z-20 max-w-[120px] truncate rounded px-1 text-[9px] font-medium text-white"
                                  style={{ backgroundColor: peerFocus.color }}
                                >
                                  {peerFocus.userName}
                                </span>
                              )}
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
                                <DisplayCell
                                  row={displayRow}
                                  col={col}
                                  multiline={!!col.multiline}
                                  onExpand={({ title, text, readOnly }) => {
                                    if (readOnly) {
                                      setExpandEditor({
                                        title,
                                        value: text,
                                        originalDraft: rowToDraft(row, columns),
                                        row,
                                        col,
                                        rowIndex,
                                        readOnly: true,
                                      });
                                      return;
                                    }
                                    openExpandEditor(rowIndex, col.key, row, false);
                                  }}
                                  livePreview={livePreview}
                                />
                              )}
                            </TableCell>
                          );
                        })}
                        {canManage && (
                          <TableCell className="text-center">
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
          </TableScrollArea>
        )}
      </CardContent>
    </Card>
  );
}
