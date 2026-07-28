import { useMemo } from 'react';
import { useShiftCareKpis } from '../api/shiftcare';
import { usePeriodState } from '../hooks/usePeriodState';
import { PeriodSelector } from '../components/PeriodSelector';
import { Card, CardContent, CardHeader, CardTitle } from '../ui/card';
import { LoadingScreen } from '../ui/LoadingSpinner';
import { QueryErrorState } from '../components/QueryErrorState';
import { PageHeader } from '../components/PageHeader';
import { StatCard } from '../ui/stat-card';
import { Badge } from '../ui/badge';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '../ui/table';
import {
  ClipboardList,
  Clock,
  CheckCircle2,
  CircleDashed,
  AlertTriangle,
  Users2,
} from 'lucide-react';

const EXCEPTION_ROWS = [
  { key: 'unapproved', label: 'Unapproved timesheets' },
  { key: 'zeroDuration', label: 'Zero or negative duration' },
  { key: 'noPayItems', label: 'No pay items' },
  { key: 'zeroAmount', label: 'Zero amount (missing rate)' },
  { key: 'longShift', label: 'Excessively long shift (>16h)' },
  { key: 'approvedWithoutApprover', label: 'Approved without approver' },
];

function formatHours(minutes) {
  if (!minutes && minutes !== 0) return '—';
  const h = Math.floor(minutes / 60);
  const m = minutes % 60;
  if (h === 0) return `${m}m`;
  if (m === 0) return `${h}h`;
  return `${h}h ${m}m`;
}

function formatDate(dateString) {
  if (!dateString) return '—';
  return new Date(dateString).toLocaleDateString('en-AU', {
    weekday: 'short',
    day: 'numeric',
    month: 'short',
  });
}

export const Timesheets = () => {
  const {
    mode,
    setMode,
    customFrom,
    setCustomFrom,
    customTo,
    setCustomTo,
    period,
    range,
  } = usePeriodState('fortnight');

  const kpiParams = useMemo(
    () => ({
      from: range.from,
      to: range.to,
      time_zone: 'Australia/Brisbane',
    }),
    [range.from, range.to]
  );

  const { data: kpis, isLoading, isError, error, refetch } = useShiftCareKpis(kpiParams);

  const ts = kpis?.timesheets;
  const summary = ts?.summary;
  const shiftEx = kpis?.shifts?.exceptionCounts;

  return (
    <div className="page-stack">
      <PageHeader
        title="Timesheets"
        hint="Fortnight KPIs and exceptions from live ShiftCare data — no raw record list."
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
      </PageHeader>

      {isLoading ? (
        <LoadingScreen message="Loading timesheet KPIs…" />
      ) : isError ? (
        <QueryErrorState error={error} title="Failed to load timesheet KPIs" onRetry={refetch} />
      ) : (
        <>
          <div className="grid gap-2 sm:grid-cols-2 xl:grid-cols-5">
            <StatCard icon={ClipboardList} label="Total records" value={summary?.totalRecords ?? 0} className="px-3 py-2" />
            <StatCard icon={Clock} label="Total hours" value={`${summary?.totalHours ?? 0}h`} className="px-3 py-2" />
            <StatCard icon={CheckCircle2} tone="success" label="Approved" value={summary?.approvedCount ?? 0} className="px-3 py-2" />
            <StatCard icon={CircleDashed} tone="warning" label="Pending" value={summary?.pendingCount ?? 0} className="px-3 py-2" />
            <StatCard icon={Users2} label="Staff with entries" value={summary?.staffCount ?? 0} className="px-3 py-2" />
          </div>

          <div className="grid gap-3 lg:grid-cols-2">
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="flex items-center gap-2 text-sm">
                  <AlertTriangle className="h-4 w-4 text-warning" />
                  Timesheet exceptions
                </CardTitle>
              </CardHeader>
              <CardContent className="divide-y p-0">
                {EXCEPTION_ROWS.map(({ key, label }) => {
                  const count = ts?.exceptionCounts?.[key] ?? 0;
                  const items = ts?.exceptions?.[key] ?? [];
                  return (
                    <div key={key} className="px-4 py-3">
                      <div className="flex items-center justify-between gap-2">
                        <span className="text-sm">{label}</span>
                        <Badge variant={count > 0 ? 'warning' : 'success'} className="tabular-nums">
                          {count}
                        </Badge>
                      </div>
                      {items.length > 0 && (
                        <ul className="mt-2 space-y-1 text-xs text-muted-foreground">
                          {items.slice(0, 5).map((ex, i) => (
                            <li key={`${key}-${i}`}>
                              {ex.staffName} · {formatDate(ex.date)}
                              {ex.id != null && <span className="font-mono"> · #{ex.id}</span>}
                            </li>
                          ))}
                          {items.length > 5 && (
                            <li className="text-faint">+{items.length - 5} more</li>
                          )}
                        </ul>
                      )}
                    </div>
                  );
                })}
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm">Shift exceptions (scheduler)</CardTitle>
              </CardHeader>
              <CardContent className="divide-y p-0">
                {[
                  { key: 'unapproved', label: 'Unapproved shifts' },
                  { key: 'unassigned', label: 'Unassigned shifts' },
                  { key: 'clockVariance', label: 'Clock-in variance (>15 min)' },
                  { key: 'incompleteTasks', label: 'Incomplete mandatory tasks' },
                  { key: 'cancelled', label: 'Cancelled shifts' },
                ].map(({ key, label }) => (
                  <div key={key} className="flex items-center justify-between gap-2 px-4 py-3">
                    <span className="text-sm">{label}</span>
                    <Badge variant={(shiftEx?.[key] ?? 0) > 0 ? 'warning' : 'success'} className="tabular-nums">
                      {shiftEx?.[key] ?? 0}
                    </Badge>
                  </div>
                ))}
              </CardContent>
            </Card>
          </div>

          <Card>
            <CardHeader>
              <CardTitle>Per-staff summary</CardTitle>
            </CardHeader>
            <CardContent className="p-0 pb-4">
              {(ts?.staffRows?.length ?? 0) === 0 ? (
                <p className="px-4 py-8 text-center text-sm text-muted-foreground">No timesheets in this period</p>
              ) : (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Staff</TableHead>
                      <TableHead className="text-right">Records</TableHead>
                      <TableHead className="text-right">Hours</TableHead>
                      <TableHead className="text-right">Approved</TableHead>
                      <TableHead className="text-right">Pending</TableHead>
                      <TableHead className="text-right">Amount</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {ts.staffRows.map((row) => (
                      <TableRow key={row.staffId ?? row.staffName}>
                        <TableCell className="font-medium">{row.staffName}</TableCell>
                        <TableCell className="text-right tabular-nums">{row.records}</TableCell>
                        <TableCell className="text-right tabular-nums">{formatHours(row.totalMinutes)}</TableCell>
                        <TableCell className="text-right tabular-nums">{row.approved}</TableCell>
                        <TableCell className="text-right tabular-nums">{row.pending}</TableCell>
                        <TableCell className="text-right tabular-nums">
                          ${row.totalAmount.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              )}
            </CardContent>
          </Card>
        </>
      )}
    </div>
  );
};
