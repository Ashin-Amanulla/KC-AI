import { useMemo, useState } from 'react';
import { useProgressNotes } from '../api/shiftcare';
import { usePeriodState } from '../hooks/usePeriodState';
import { PeriodSelector } from '../components/PeriodSelector';
import { PageHeader } from '../components/PageHeader';
import { Card, CardContent, CardHeader, CardTitle } from '../ui/card';
import { StatCard } from '../ui/stat-card';
import { Badge } from '../ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '../ui/select';
import { LoadingScreen } from '../ui/LoadingSpinner';
import { QueryErrorState } from '../components/QueryErrorState';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '../ui/table';
import { FileText, AlertTriangle, StickyNote } from 'lucide-react';

const CATEGORIES = [
  { key: 'all', label: 'All categories' },
  { key: 'notes', label: 'Notes' },
  { key: 'incident', label: 'Incident' },
  { key: 'injury', label: 'Injury' },
  { key: 'feedback', label: 'Feedback' },
  { key: 'enquiry', label: 'Enquiry' },
  { key: 'mileage', label: 'Mileage' },
];

const EXCEPTION_CATEGORIES = new Set(['incident', 'injury', 'feedback']);

function formatDateTime(v) {
  if (!v) return '—';
  return new Date(v).toLocaleString('en-AU', { dateStyle: 'medium', timeStyle: 'short' });
}

export function ProgressNotesPage() {
  const { mode, setMode, customFrom, setCustomFrom, customTo, setCustomTo, period } =
    usePeriodState('fortnight');
  const [category, setCategory] = useState('all');
  const [page, setPage] = useState(1);

  const params = useMemo(
    () => ({
      shift_date_from: period.fromDate,
      shift_date_to: period.toDate,
      time_zone: 'Australia/Brisbane',
      include_metadata: true,
      per_page: 20,
      page,
      ...(category !== 'all' ? { category } : {}),
    }),
    [period.fromDate, period.toDate, category, page]
  );

  const { data, isLoading, isError, error, refetch } = useProgressNotes(params);

  const notes = data?.progress_notes ?? [];
  const meta = data?._metadata;
  const incidentCount = notes.filter((n) => EXCEPTION_CATEGORIES.has(n.category)).length;
  const lazyCount = notes.filter((n) => !n.message || n.message.trim().length < 20).length;

  return (
    <div className="page-stack">
      <PageHeader
        title="Progress notes"
        hint="Live ShiftCare progress notes — filter by fortnight and category."
      >
        <PeriodSelector
          mode={mode}
          onModeChange={setMode}
          customFrom={customFrom}
          customTo={customTo}
          onCustomFromChange={setCustomFrom}
          onCustomToChange={setCustomTo}
          periodLabel={period.label}
        />
        <Select value={category} onValueChange={(v) => { setCategory(v); setPage(1); }}>
          <SelectTrigger className="filter-control h-8 w-[9rem]">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {CATEGORIES.map(({ key, label }) => (
              <SelectItem key={key} value={key} className="text-2xs">{label}</SelectItem>
            ))}
          </SelectContent>
        </Select>
      </PageHeader>

      {isLoading ? (
        <LoadingScreen message="Loading progress notes…" />
      ) : isError ? (
        <QueryErrorState error={error} title="Failed to load progress notes" onRetry={refetch} />
      ) : (
        <>
          <div className="grid gap-2 sm:grid-cols-3">
            <StatCard icon={FileText} label="On this page" value={notes.length} sub={`${meta?.total_count ?? 0} total in period`} className="px-3 py-2" />
            <StatCard icon={AlertTriangle} tone="warning" label="Incidents / feedback" value={incidentCount} className="px-3 py-2" />
            <StatCard icon={StickyNote} label="Short notes (<20 chars)" value={lazyCount} className="px-3 py-2" />
          </div>

          <Card>
            <CardHeader>
              <CardTitle>Notes</CardTitle>
            </CardHeader>
            <CardContent className="p-0 pb-4">
              {notes.length === 0 ? (
                <p className="px-4 py-8 text-center text-sm text-muted-foreground">No notes in this period</p>
              ) : (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Date</TableHead>
                      <TableHead>Category</TableHead>
                      <TableHead>Client</TableHead>
                      <TableHead>Staff</TableHead>
                      <TableHead>Message</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {notes.map((note) => (
                      <TableRow key={note.id}>
                        <TableCell className="whitespace-nowrap text-xs">{formatDateTime(note.created_at)}</TableCell>
                        <TableCell>
                          <Badge variant={EXCEPTION_CATEGORIES.has(note.category) ? 'warning' : 'default'}>
                            {note.category}
                          </Badge>
                        </TableCell>
                        <TableCell className="text-sm">{note.client?.display_name ?? '—'}</TableCell>
                        <TableCell className="text-sm">{note.staff?.display_name ?? '—'}</TableCell>
                        <TableCell className="max-w-md truncate text-sm" title={note.message}>
                          {note.message || '—'}
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              )}
              {meta && meta.total_pages > 1 && (
                <div className="mt-3 flex items-center justify-between px-4 text-xs text-muted-foreground">
                  <span>Page {meta.current_page} of {meta.total_pages}</span>
                  <div className="flex gap-2">
                    <button type="button" className="text-primary disabled:opacity-50" disabled={page <= 1} onClick={() => setPage((p) => p - 1)}>Previous</button>
                    <button type="button" className="text-primary disabled:opacity-50" disabled={page >= meta.total_pages} onClick={() => setPage((p) => p + 1)}>Next</button>
                  </div>
                </div>
              )}
            </CardContent>
          </Card>
        </>
      )}
    </div>
  );
}
