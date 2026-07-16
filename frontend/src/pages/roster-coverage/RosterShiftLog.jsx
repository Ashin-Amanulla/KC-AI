import { useState, useCallback, useMemo, Fragment } from 'react';
import { useNavigate } from 'react-router-dom';
import { useDropzone } from 'react-dropzone';
import { toast } from 'sonner';
import {
  Search,
  Plus,
  Upload,
  Trash2,
  LayoutGrid,
  Table2,
  ChevronDown,
  ChevronRight,
  Clock,
  UserSearch,
  Play,
  CheckCircle2,
} from 'lucide-react';
import {
  useShiftDashboard,
  useCreateVacantShift,
  usePatchVacantShift,
  useAddVacantShiftUpdate,
  useRosterParticipants,
  useUploadVacantShifts,
  useDeleteVacantShift,
  useClearVacantShifts,
} from '../../api/rosterCoverage';
import { TABULAR_ACCEPT, validateTabularFile } from '../../config/upload';
import { getErrorMessage } from '../../utils/api';
import { cn } from '../../lib/utils';
import { Card, CardContent } from '../../ui/card';
import { Button } from '../../ui/button';
import { Input } from '../../ui/input';
import { Label } from '../../ui/label';
import { Badge } from '../../ui/badge';
import { StatCard } from '../../ui/stat-card';
import { InfoHint } from '../../components/InfoHint';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '../../ui/select';
import { LoadingScreen } from '../../ui/LoadingSpinner';
import { QueryErrorState } from '../../components/QueryErrorState';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '../../ui/dialog';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
  TableScrollArea,
} from '../../ui/table';

const VIEW_STORAGE_KEY = 'roster-shift-log-view';

const REASON_CFG = {
  sick_call: { label: 'Sick call', dotClass: 'bg-rose-500' },
  vacancy: { label: 'Vacant shift', dotClass: 'bg-warning' },
  other: { label: 'Other', dotClass: 'bg-violet-500' },
};

const STATUS_CFG = {
  open: { label: 'Open', variant: 'destructive' },
  in_progress: { label: 'In progress', variant: 'warning' },
  filled: { label: 'Filled', variant: 'success' },
  cancelled: { label: 'Cancelled', variant: 'default' },
};

const PRI_CFG = {
  critical: { label: 'Critical', dotClass: 'bg-destructive' },
  high: { label: 'High', dotClass: 'bg-warning' },
  medium: { label: 'Medium', dotClass: 'bg-warning/60' },
  low: { label: 'Low', dotClass: 'bg-muted-foreground' },
};

const STATUS_FILTERS = [
  { key: 'all', label: 'All statuses' },
  { key: 'open', label: 'Open' },
  { key: 'in_progress', label: 'In progress' },
  { key: 'filled', label: 'Filled' },
  { key: 'cancelled', label: 'Cancelled' },
];

const PRIORITY_FILTERS = [
  { key: 'all', label: 'All priority' },
  { key: 'critical', label: 'Critical' },
  { key: 'high', label: 'High' },
  { key: 'medium', label: 'Medium' },
  { key: 'low', label: 'Low' },
];

const KANBAN_COLUMNS = [
  { key: 'open', label: 'Open' },
  { key: 'in_progress', label: 'In progress' },
  { key: 'filled', label: 'Filled' },
  { key: 'cancelled', label: 'Cancelled' },
];

function shiftToFindCoverSearchParams(shift) {
  const start = new Date(shift.startDatetime);
  const end = new Date(shift.endDatetime);
  const pad = (n) => String(n).padStart(2, '0');
  const participantId = shift.rosterParticipantId?._id ?? shift.rosterParticipantId ?? '';
  return new URLSearchParams({
    participant: participantId,
    date: `${start.getFullYear()}-${pad(start.getMonth() + 1)}-${pad(start.getDate())}`,
    start: `${pad(start.getHours())}:${pad(start.getMinutes())}`,
    end: `${pad(end.getHours())}:${pad(end.getMinutes())}`,
    reason: shift.reason || 'vacancy',
    vacant: shift._id,
    auto: '1',
  });
}

function shiftLocation(shift) {
  const label = shift.rosterParticipantId?.locationLabel;
  if (label) return label;
  const notes = shift.notes || '';
  const m = notes.match(/Address:\s*(.+)/);
  return m ? m[1].trim() : '';
}

function StatusBadge({ status, className }) {
  const cfg = STATUS_CFG[status] ?? STATUS_CFG.open;
  return (
    <Badge variant={cfg.variant} className={className}>
      {cfg.label}
    </Badge>
  );
}

function PriorityIndicator({ priority }) {
  const cfg = PRI_CFG[priority] ?? PRI_CFG.medium;
  return (
    <span className="inline-flex items-center gap-1.5 text-xs text-muted-foreground">
      <span className={cn('h-2 w-2 rounded-full', cfg.dotClass)} />
      {cfg.label}
    </span>
  );
}

function ViewToggle({ mode, onChange }) {
  return (
    <div className="inline-flex rounded-md border border-border p-0.5">
      <Button
        type="button"
        size="sm"
        variant={mode === 'cards' ? 'default' : 'ghost'}
        className="h-8 gap-1.5"
        onClick={() => onChange('cards')}
      >
        <LayoutGrid className="h-3.5 w-3.5" />
        Board
      </Button>
      <Button
        type="button"
        size="sm"
        variant={mode === 'table' ? 'default' : 'ghost'}
        className="h-8 gap-1.5"
        onClick={() => onChange('table')}
      >
        <Table2 className="h-3.5 w-3.5" />
        Table
      </Button>
    </div>
  );
}

function ShiftNoteThread({ notes = [], shiftId, onAdd, compact = false }) {
  const [open, setOpen] = useState(false);
  const [draft, setDraft] = useState('');
  const [author, setAuthor] = useState('');

  function post() {
    if (!draft.trim()) return;
    onAdd({ id: shiftId, authorName: author || 'Staff', text: draft.trim() });
    setDraft('');
  }

  return (
    <div className={compact ? 'pt-1' : 'border-t border-border/60 pt-3'}>
      <button
        type="button"
        onClick={() => setOpen((value) => !value)}
        className="flex w-full items-center gap-1 text-left text-2xs text-muted-foreground hover:text-foreground"
      >
        {open ? <ChevronDown className="h-3 w-3" /> : <ChevronRight className="h-3 w-3" />}
        <span>
          {notes.length} update{notes.length !== 1 ? 's' : ''}
        </span>
      </button>

      {open && (
        <div className="mt-2 space-y-2">
          {notes.map((note) => (
            <div key={note._id} className="rounded border border-border/60 bg-muted/30 px-2 py-1.5">
              <div className="mb-0.5 text-2xs text-muted-foreground">
                <span className="font-medium text-foreground">{note.authorName || 'Staff'}</span>
                <span className="mx-1">·</span>
                <span>
                  {new Date(note.createdAt).toLocaleString([], {
                    dateStyle: 'short',
                    timeStyle: 'short',
                  })}
                </span>
              </div>
              <p className="text-xs leading-snug">{note.text}</p>
            </div>
          ))}

          <div className="space-y-1.5">
            <Input
              value={author}
              onChange={(e) => setAuthor(e.target.value)}
              placeholder="Your name (optional)"
              className="h-7 text-xs"
            />
            <textarea
              value={draft}
              onChange={(e) => setDraft(e.target.value)}
              rows={2}
              placeholder="Post a shift update…"
              onKeyDown={(e) => {
                if (e.key === 'Enter' && (e.metaKey || e.ctrlKey)) {
                  e.preventDefault();
                  post();
                }
              }}
              className="w-full resize-y rounded-md border border-input bg-background px-2 py-1.5 text-xs leading-snug focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
            />
            <Button type="button" size="sm" className="h-7 text-xs" onClick={post} disabled={!draft.trim()}>
              Post update
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}

function ShiftCard({ shift, onStatus, onNote, onFindCover, onDelete }) {
  const participantName = shift.rosterParticipantId?.name ?? 'Unknown participant';
  const location = shift.rosterParticipantId?.locationLabel ?? '';
  const start = new Date(shift.startDatetime);
  const end = new Date(shift.endDatetime);
  const dateStr = start.toLocaleDateString([], { day: '2-digit', month: '2-digit' });
  const timeStr = `${start.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}–${end.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}`;
  const filledBy = shift.filledByStaffId?.fullName;
  const nextStatus =
    shift.status === 'open' ? 'in_progress' : shift.status === 'in_progress' ? 'filled' : null;
  const nextLabel = shift.status === 'open' ? 'Start' : shift.status === 'in_progress' ? 'Mark filled' : null;
  const showFindCover = shift.status === 'open' || shift.status === 'in_progress';
  const reasonCfg = REASON_CFG[shift.reason] ?? { label: shift.reason, dotClass: 'bg-muted-foreground' };
  const priCfg = PRI_CFG[shift.priority] ?? PRI_CFG.medium;

  return (
    <div className="rounded-md border border-border/70 bg-card px-2.5 py-2 shadow-sm">
      <div className="flex items-start justify-between gap-1.5">
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-1.5">
            <span className={cn('h-1.5 w-1.5 shrink-0 rounded-full', reasonCfg.dotClass)} />
            <span className="truncate text-xs font-semibold leading-tight">{participantName}</span>
          </div>
          <p className="mt-0.5 truncate text-2xs text-muted-foreground">
            {[reasonCfg.label, location, `${dateStr} ${timeStr}`].filter(Boolean).join(' · ')}
          </p>
          <p className="mt-0.5 truncate text-2xs">
            {filledBy ? (
              <span className="font-medium text-primary">{filledBy}</span>
            ) : (
              <span className="text-muted-foreground">Unassigned</span>
            )}
          </p>
        </div>
        <div className="flex shrink-0 flex-col items-end gap-0.5">
          <span className="inline-flex items-center gap-1 text-2xs text-muted-foreground">
            <span className={cn('h-1.5 w-1.5 rounded-full', priCfg.dotClass)} />
            {priCfg.label}
          </span>
          <StatusBadge status={shift.status} className="h-5 px-1.5 text-2xs" />
        </div>
      </div>

      <div className="mt-1.5 flex items-center gap-0.5">
        {showFindCover && (
          <Button
            type="button"
            size="sm"
            variant="outline"
            className="h-6 px-1.5 text-2xs"
            title="Find cover"
            onClick={() => onFindCover(shift)}
          >
            <UserSearch className="h-3 w-3" />
            <span className="sr-only">Find cover</span>
          </Button>
        )}
        {nextStatus && (
          <Button
            type="button"
            size="sm"
            variant="secondary"
            className="h-6 px-1.5 text-2xs"
            title={nextLabel}
            onClick={() => onStatus({ id: shift._id, status: nextStatus })}
          >
            {shift.status === 'open' ? (
              <Play className="h-3 w-3" />
            ) : (
              <CheckCircle2 className="h-3 w-3" />
            )}
            <span className="sr-only">{nextLabel}</span>
          </Button>
        )}
        <Button
          type="button"
          size="sm"
          variant="ghost"
          className="h-6 px-1.5 text-destructive hover:text-destructive"
          title="Delete"
          onClick={() => onDelete(shift)}
        >
          <Trash2 className="h-3 w-3" />
          <span className="sr-only">Delete</span>
        </Button>
      </div>

      <ShiftNoteThread
        notes={shift.updateLogs ?? []}
        shiftId={shift._id}
        onAdd={onNote}
        compact
      />
    </div>
  );
}

function ShiftLogTable({ shifts, onStatus, onNote, onFindCover, onDelete }) {
  const [expandedId, setExpandedId] = useState(null);
  const sorted = useMemo(
    () => [...shifts].sort((a, b) => new Date(a.startDatetime) - new Date(b.startDatetime)),
    [shifts]
  );

  return (
    <Card>
      <CardContent className="p-0 pb-4">
        <TableScrollArea>
          <Table scrollable={false}>
            <TableHeader>
              <TableRow>
                <TableHead>Status</TableHead>
                <TableHead>Priority</TableHead>
                <TableHead>Participant</TableHead>
                <TableHead className="whitespace-nowrap">Start</TableHead>
                <TableHead className="whitespace-nowrap">End</TableHead>
                <TableHead>Reason</TableHead>
                <TableHead>Location</TableHead>
                <TableHead>Filled by</TableHead>
                <TableHead>Updates</TableHead>
                <TableHead className="text-right">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {sorted.map((shift) => {
                const rc = REASON_CFG[shift.reason] ?? { label: shift.reason };
                const participantName = shift.rosterParticipantId?.name ?? 'Unknown';
                const startStr = new Date(shift.startDatetime).toLocaleString([], {
                  dateStyle: 'short',
                  timeStyle: 'short',
                });
                const endStr = new Date(shift.endDatetime).toLocaleString([], {
                  dateStyle: 'short',
                  timeStyle: 'short',
                });
                const filledBy = shift.filledByStaffId?.fullName;
                const nextStatus =
                  shift.status === 'open'
                    ? 'in_progress'
                    : shift.status === 'in_progress'
                      ? 'filled'
                      : null;
                const nextLabel =
                  shift.status === 'open' ? 'Start' : shift.status === 'in_progress' ? 'Mark filled' : null;
                const showFindCover = shift.status === 'open' || shift.status === 'in_progress';
                const updateCount = (shift.updateLogs ?? []).length;
                const expanded = expandedId === shift._id;

                return (
                  <Fragment key={shift._id}>
                    <TableRow>
                      <TableCell>
                        <StatusBadge status={shift.status} />
                      </TableCell>
                      <TableCell>
                        <PriorityIndicator priority={shift.priority} />
                      </TableCell>
                      <TableCell className="font-medium">{participantName}</TableCell>
                      <TableCell className="whitespace-nowrap tabular-nums">{startStr}</TableCell>
                      <TableCell className="whitespace-nowrap tabular-nums">{endStr}</TableCell>
                      <TableCell>{rc.label}</TableCell>
                      <TableCell className="max-w-[180px] truncate" title={shiftLocation(shift)}>
                        {shiftLocation(shift) || '—'}
                      </TableCell>
                      <TableCell>{filledBy || 'Unassigned'}</TableCell>
                      <TableCell>
                        <Button
                          type="button"
                          size="sm"
                          variant="outline"
                          className="h-7 text-xs"
                          onClick={() => setExpandedId(expanded ? null : shift._id)}
                        >
                          {updateCount} update{updateCount !== 1 ? 's' : ''}
                        </Button>
                      </TableCell>
                      <TableCell className="text-right">
                        <div className="flex flex-wrap justify-end gap-1.5">
                          {showFindCover && (
                            <Button
                              type="button"
                              size="sm"
                              variant="outline"
                              className="h-7 text-xs"
                              onClick={() => onFindCover(shift)}
                            >
                              Find cover
                            </Button>
                          )}
                          {nextStatus && (
                            <Button
                              type="button"
                              size="sm"
                              variant="secondary"
                              className="h-7 text-xs"
                              onClick={() => onStatus({ id: shift._id, status: nextStatus })}
                            >
                              {nextLabel}
                            </Button>
                          )}
                          <Button
                            type="button"
                            size="sm"
                            variant="ghost"
                            className="h-7 text-xs text-destructive hover:text-destructive"
                            onClick={() => onDelete(shift)}
                          >
                            Delete
                          </Button>
                        </div>
                      </TableCell>
                    </TableRow>
                    {expanded && (
                      <TableRow>
                        <TableCell colSpan={10} className="bg-muted/30 px-4 py-3">
                          <ShiftNoteThread
                            notes={shift.updateLogs ?? []}
                            shiftId={shift._id}
                            onAdd={onNote}
                          />
                        </TableCell>
                      </TableRow>
                    )}
                  </Fragment>
                );
              })}
            </TableBody>
          </Table>
        </TableScrollArea>
      </CardContent>
    </Card>
  );
}

function ImportVacantShiftsModal({ open, onClose }) {
  const upload = useUploadVacantShifts();

  const onDrop = useCallback(
    async (files) => {
      const file = files[0];
      if (!file) return;
      const check = validateTabularFile(file);
      if (!check.valid) {
        toast.error(check.error);
        return;
      }
      try {
        const res = await upload.mutateAsync(file);
        toast.success(
          `Import complete — ${res.created ?? 0} created, ${res.kept ?? 0} kept (${res.rowsProcessed ?? 0} rows)`
        );
        if (res.deleted) toast.message(`${res.deleted} stale shift(s) removed`);
        if (res.skipped) toast.message(`${res.skipped} row(s) skipped`);
        if (res.errors?.length) toast.message(`${res.errors.length} row error(s) — see network response`);
        onClose();
      } catch (e) {
        toast.error(getErrorMessage(e));
      }
    },
    [upload, onClose]
  );

  const { getRootProps, getInputProps, isDragActive } = useDropzone({
    onDrop,
    accept: TABULAR_ACCEPT,
    maxFiles: 1,
    disabled: upload.isPending,
  });

  return (
    <Dialog open={open} onOpenChange={(next) => !next && onClose()}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>Import vacant shifts</DialogTitle>
        </DialogHeader>
        <p className="text-sm text-muted-foreground">
          Upload a ShiftCare Vacant Shifts Report (.csv or .xlsx). Rows are upserted by Shift ID.
        </p>
        <div
          {...getRootProps()}
          className={cn(
            'cursor-pointer rounded-lg border-2 border-dashed p-8 text-center text-sm text-muted-foreground transition-colors',
            isDragActive ? 'border-primary bg-primary/5' : 'border-border hover:border-primary/40',
            upload.isPending && 'cursor-wait opacity-60'
          )}
        >
          <input {...getInputProps()} />
          <Upload className="mx-auto mb-2 h-8 w-8 text-muted-foreground" />
          {upload.isPending
            ? 'Importing…'
            : isDragActive
              ? 'Drop file here'
              : 'Drag and drop a file, or click to browse'}
        </div>
      </DialogContent>
    </Dialog>
  );
}

function LogShiftModal({ open, onClose, onSubmit, participants = [] }) {
  const now = new Date();
  const toLocal = (d) => new Date(d - d.getTimezoneOffset() * 60000).toISOString().slice(0, 16);

  const [form, setForm] = useState({
    rosterParticipantId: participants[0]?._id ?? '',
    startDatetime: toLocal(now),
    endDatetime: toLocal(new Date(now.getTime() + 8 * 3600000)),
    reason: 'vacancy',
    priority: 'high',
    notes: '',
  });

  const set = (key, value) => setForm((prev) => ({ ...prev, [key]: value }));

  function submit() {
    if (!form.rosterParticipantId) return;
    onSubmit({
      ...form,
      startDatetime: new Date(form.startDatetime).toISOString(),
      endDatetime: new Date(form.endDatetime).toISOString(),
    });
  }

  return (
    <Dialog open={open} onOpenChange={(next) => !next && onClose()}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>Log vacant shift</DialogTitle>
        </DialogHeader>

        <div className="space-y-4">
          <div className="space-y-1.5">
            <Label>Participant</Label>
            <Select value={form.rosterParticipantId} onValueChange={(value) => set('rosterParticipantId', value)}>
              <SelectTrigger className="h-10">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {participants.map((p) => (
                  <SelectItem key={p._id} value={p._id}>
                    {p.name}
                    {p.locationLabel ? ` — ${p.locationLabel}` : ''}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-1.5">
              <Label>Start</Label>
              <Input
                type="datetime-local"
                value={form.startDatetime}
                onChange={(e) => set('startDatetime', e.target.value)}
              />
            </div>
            <div className="space-y-1.5">
              <Label>End</Label>
              <Input
                type="datetime-local"
                value={form.endDatetime}
                onChange={(e) => set('endDatetime', e.target.value)}
              />
            </div>
          </div>

          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-1.5">
              <Label>Reason</Label>
              <Select value={form.reason} onValueChange={(value) => set('reason', value)}>
                <SelectTrigger className="h-10">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="vacancy">Vacant shift</SelectItem>
                  <SelectItem value="sick_call">Sick call</SelectItem>
                  <SelectItem value="other">Other</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label>Priority</Label>
              <Select value={form.priority} onValueChange={(value) => set('priority', value)}>
                <SelectTrigger className="h-10">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="critical">Critical</SelectItem>
                  <SelectItem value="high">High</SelectItem>
                  <SelectItem value="medium">Medium</SelectItem>
                  <SelectItem value="low">Low</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>

          <div className="space-y-1.5">
            <Label>Initial note</Label>
            <textarea
              value={form.notes}
              onChange={(e) => set('notes', e.target.value)}
              rows={3}
              placeholder="Context, actions taken, coverage status…"
              className="w-full resize-y rounded-md border border-input bg-background px-3 py-2 text-sm leading-relaxed focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
            />
          </div>

          <div className="flex justify-end gap-2">
            <Button type="button" variant="outline" onClick={onClose}>
              Cancel
            </Button>
            <Button type="button" onClick={submit}>
              Log shift
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}

export function RosterShiftLog() {
  const navigate = useNavigate();
  const { data, isLoading, isError, error, refetch, dataUpdatedAt } = useShiftDashboard(15000);
  const { data: participantData } = useRosterParticipants();
  const createShift = useCreateVacantShift();
  const patchShift = usePatchVacantShift();
  const addUpdate = useAddVacantShiftUpdate();
  const deleteShift = useDeleteVacantShift();
  const clearShifts = useClearVacantShifts();

  const [showModal, setShowModal] = useState(false);
  const [showImport, setShowImport] = useState(false);
  const [viewMode, setViewMode] = useState(() => {
    try {
      const stored = localStorage.getItem(VIEW_STORAGE_KEY);
      return stored === 'table' ? 'table' : 'cards';
    } catch {
      return 'cards';
    }
  });
  const [statusF, setStatusF] = useState('all');
  const [priF, setPriF] = useState('all');
  const [search, setSearch] = useState('');

  function setViewModePersisted(mode) {
    setViewMode(mode);
    try {
      localStorage.setItem(VIEW_STORAGE_KEY, mode);
    } catch {}
  }

  const shifts = data?.shifts ?? [];
  const counts = data?.counts ?? { open: 0, in_progress: 0, filled: 0, critical: 0 };
  const participants = participantData?.participants ?? [];

  const lastRefresh = dataUpdatedAt
    ? new Date(dataUpdatedAt).toLocaleTimeString([], {
        hour: '2-digit',
        minute: '2-digit',
        second: '2-digit',
      })
    : '—';

  const visible = shifts.filter((shift) => {
    if (statusF !== 'all' && shift.status !== statusF) return false;
    if (priF !== 'all' && shift.priority !== priF) return false;
    if (search) {
      const q = search.toLowerCase();
      const hay = [
        shift.rosterParticipantId?.name,
        shift.rosterParticipantId?.locationLabel,
        shift.reason,
        shift.status,
        shift.priority,
        shift.notes,
        ...(shift.updateLogs ?? []).map((u) => `${u.authorName} ${u.text}`),
      ]
        .filter(Boolean)
        .join(' ')
        .toLowerCase();
      if (!hay.includes(q)) return false;
    }
    return true;
  });

  const kanbanColumns = useMemo(() => {
    const activeStatuses =
      statusF === 'all'
        ? STATUS_FILTERS.filter(({ key }) => key !== 'all').map(({ key }) => key)
        : [statusF];

    return activeStatuses.map((key) => {
      const column = KANBAN_COLUMNS.find((c) => c.key === key) ?? { key, label: key };
      return {
        ...column,
        shifts: visible
          .filter((shift) => shift.status === key)
          .sort((a, b) => new Date(a.startDatetime) - new Date(b.startDatetime)),
      };
    });
  }, [visible, statusF]);

  function handleCreate(form) {
    createShift.mutate(form, { onSuccess: () => setShowModal(false) });
  }

  function handleStatus({ id, status }) {
    patchShift.mutate({ id, status });
  }

  function handleNote({ id, authorName, text }) {
    addUpdate.mutate({ id, authorName, text });
  }

  function handleFindCover(shift) {
    navigate(`/roster-coverage/find-cover?${shiftToFindCoverSearchParams(shift)}`);
  }

  function handleDelete(shift) {
    const name = shift.rosterParticipantId?.name ?? 'this shift';
    if (!window.confirm(`Delete the shift for ${name}? This cannot be undone.`)) return;
    deleteShift.mutate(shift._id, {
      onSuccess: () => toast.success('Shift deleted'),
      onError: (e) => toast.error(getErrorMessage(e)),
    });
  }

  function handleClearAll() {
    if (shifts.length === 0) return;
    if (!window.confirm(`Delete ALL ${shifts.length} shift(s) in the log? This cannot be undone.`)) return;
    clearShifts.mutate(undefined, {
      onSuccess: (res) => toast.success(`Cleared ${res?.deleted ?? 0} shift(s)`),
      onError: (e) => toast.error(getErrorMessage(e)),
    });
  }

  return (
    <div className="page-stack-dense">
      <div className="flex flex-wrap items-center justify-end gap-2">
        <ViewToggle mode={viewMode} onChange={setViewModePersisted} />
        <span className="inline-flex items-center gap-1.5 text-2xs text-muted-foreground tabular-nums">
          <Clock className="h-3.5 w-3.5" />
          Updated {lastRefresh}
        </span>
        <Button
          type="button"
          variant="outline"
          size="sm"
          onClick={handleClearAll}
          disabled={shifts.length === 0 || clearShifts.isPending}
          className="text-destructive hover:text-destructive"
        >
          {clearShifts.isPending ? 'Clearing…' : 'Clear all'}
        </Button>
        <Button type="button" variant="outline" size="sm" onClick={() => setShowImport(true)}>
          <Upload className="mr-1.5 h-3.5 w-3.5" />
          Import
        </Button>
        <Button type="button" size="sm" onClick={() => setShowModal(true)}>
          <Plus className="mr-1.5 h-3.5 w-3.5" />
          Log vacant shift
        </Button>
      </div>

      <div className="grid gap-2 sm:grid-cols-4">
        <StatCard label="Open" value={counts.open} tone="destructive" className="px-3 py-2" />
        <StatCard label="In progress" value={counts.in_progress} tone="warning" className="px-3 py-2" />
        <StatCard label="Filled" value={counts.filled} tone="success" className="px-3 py-2" />
        <StatCard label="Critical" value={counts.critical} tone="destructive" className="px-3 py-2" />
      </div>

      <div className="filter-toolbar">
        <div className="relative min-w-[160px] flex-1 sm:max-w-xs">
          <Search className="pointer-events-none absolute left-2 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted-foreground" />
          <Input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search…"
            className="filter-control pl-7"
          />
        </div>

        <Select value={statusF} onValueChange={setStatusF}>
          <SelectTrigger className="filter-control w-[128px]">
            <SelectValue placeholder="Status" />
          </SelectTrigger>
          <SelectContent>
            {STATUS_FILTERS.map(({ key, label }) => (
              <SelectItem key={key} value={key} className="text-xs">
                {label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>

        <Select value={priF} onValueChange={setPriF}>
          <SelectTrigger className="filter-control w-[128px]">
            <SelectValue placeholder="Priority" />
          </SelectTrigger>
          <SelectContent>
            {PRIORITY_FILTERS.map(({ key, label }) => (
              <SelectItem key={key} value={key} className="text-xs">
                {label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>

        <span className="ml-auto text-2xs tabular-nums text-muted-foreground">
          {visible.length} shift{visible.length !== 1 ? 's' : ''}
        </span>
      </div>

      {isLoading ? (
        <LoadingScreen message="Loading shift log…" />
      ) : isError ? (
        <QueryErrorState
          error={error}
          title="Failed to load shift log"
          onRetry={refetch}
        />
      ) : visible.length === 0 ? (
        <Card>
          <CardContent className="py-12 text-center">
            <p className="text-sm font-medium">No vacant shifts match your filters.</p>
            <p className="mt-1 text-sm text-muted-foreground">
              Log a shift or adjust filters to see results.
            </p>
            <Button type="button" className="mt-4" size="sm" onClick={() => setShowModal(true)}>
              <Plus className="mr-1.5 h-3.5 w-3.5" />
              Log first shift
            </Button>
          </CardContent>
        </Card>
      ) : viewMode === 'table' ? (
        <ShiftLogTable
          shifts={visible}
          onStatus={handleStatus}
          onNote={handleNote}
          onFindCover={handleFindCover}
          onDelete={handleDelete}
        />
      ) : (
        <div
          className={cn(
            'grid min-h-0 gap-2',
            kanbanColumns.length === 1
              ? 'grid-cols-1'
              : kanbanColumns.length === 2
                ? 'md:grid-cols-2'
                : kanbanColumns.length === 3
                  ? 'md:grid-cols-2 xl:grid-cols-3'
                  : 'md:grid-cols-2 xl:grid-cols-4'
          )}
        >
          {kanbanColumns.map((column) => (
            <div key={column.key} className="flex min-h-0 flex-col">
              <div className="mb-1.5 flex shrink-0 items-center justify-between gap-2 rounded border border-border/60 bg-muted/30 px-2 py-1">
                <h3 className="truncate text-xs font-semibold">{column.label}</h3>
                <Badge variant={STATUS_CFG[column.key]?.variant ?? 'default'} className="shrink-0 px-1.5 text-2xs">
                  {column.shifts.length}
                </Badge>
              </div>
              <div
                className="scroll-pane min-h-0 space-y-1.5 pr-0.5"
                style={{ '--scroll-offset': '15.5rem' }}
              >
                {column.shifts.length === 0 ? (
                  <p className="rounded border border-dashed border-border/60 px-2 py-4 text-center text-2xs text-muted-foreground">
                    No shifts
                  </p>
                ) : (
                  column.shifts.map((shift) => (
                    <ShiftCard
                      key={shift._id}
                      shift={shift}
                      onStatus={handleStatus}
                      onNote={handleNote}
                      onFindCover={handleFindCover}
                      onDelete={handleDelete}
                    />
                  ))
                )}
              </div>
            </div>
          ))}
        </div>
      )}

      <LogShiftModal
        open={showModal}
        onClose={() => setShowModal(false)}
        onSubmit={handleCreate}
        participants={participants}
      />

      <ImportVacantShiftsModal open={showImport} onClose={() => setShowImport(false)} />
    </div>
  );
}
