import { useState, useMemo } from 'react';
import { Link } from 'react-router-dom';
import { useShifts } from '../api/shifts';
import { useStaff } from '../api/staff';
import { useClients } from '../api/clients';
import { useDashboardSummary } from '../api/dashboard';
import { useAuthStore } from '../store/auth';
import { PERMISSIONS, hasAnyPermission } from '../config/permissions';
import { Card, CardContent, CardHeader, CardTitle } from '../ui/card';
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
import { QueryErrorState } from '../components/QueryErrorState';
import { StatCard } from '../ui/stat-card';
import { PageHeader } from '../components/PageHeader';
import { CalendarClock, Users2, HeartHandshake, Banknote } from 'lucide-react';
import { cn } from '../lib/utils';

const JOB_STATUS_META = {
  completed: { label: 'Completed', cls: 'bg-emerald-500/15 text-emerald-700 dark:text-emerald-400' },
  processing: { label: 'Processing', cls: 'bg-sky-500/15 text-sky-700 dark:text-sky-400' },
  pending: { label: 'Pending', cls: 'bg-muted text-muted-foreground' },
  failed: { label: 'Failed', cls: 'bg-destructive/15 text-destructive' },
};

function PayRunStatusCard({ payRun }) {
  return (
    <Card>
      <CardHeader className="pb-2">
        <CardTitle className="text-base">Last pay run</CardTitle>
      </CardHeader>
      <CardContent>
        {!payRun ? (
          <p className="text-sm text-muted-foreground">No pay-hours computation has been run yet.</p>
        ) : (
          <div className="space-y-1 text-sm">
            <div className="flex items-center gap-2">
              <span
                className={cn(
                  'rounded-full px-2 py-0.5 text-xs font-medium',
                  JOB_STATUS_META[payRun.status]?.cls ?? JOB_STATUS_META.pending.cls
                )}
              >
                {JOB_STATUS_META[payRun.status]?.label ?? payRun.status}
              </span>
              {payRun.errorCount > 0 && (
                <span className="text-xs text-destructive">{payRun.errorCount} errors</span>
              )}
            </div>
            <p className="text-muted-foreground">
              {payRun.staffProcessed ?? 0} staff · {payRun.payHoursCreated ?? 0} pay-hours rows
            </p>
            {payRun.completedAt && (
              <p className="text-xs text-muted-foreground">
                Completed {new Date(payRun.completedAt).toLocaleString()}
              </p>
            )}
          </div>
        )}
      </CardContent>
    </Card>
  );
}

function RuleEngineHealthCard({ awardRates, canViewRuleEngine }) {
  return (
    <Card>
      <CardHeader className="pb-2">
        <CardTitle className="text-base">Rule engine health</CardTitle>
      </CardHeader>
      <CardContent className="space-y-2 text-sm">
        {awardRates?.needsAttention ? (
          <p className="rounded-md bg-amber-500/10 px-3 py-2 text-amber-700 dark:text-amber-400">
            ⚠️ {awardRates.isFallback
              ? 'No award rate set covers today — using fallback constants.'
              : `${awardRates.setLabel} rates need verification against the FWC determination.`}
          </p>
        ) : (
          <p className="text-muted-foreground">
            Active rate set: <span className="font-medium text-foreground">{awardRates?.setLabel}</span>
          </p>
        )}
        {canViewRuleEngine && (
          <Link to="/rule-engine/rates" className="text-sm font-medium text-primary hover:underline">
            Review award rates →
          </Link>
        )}
      </CardContent>
    </Card>
  );
}

function ExceptionQueue({ exceptions, canViewRuleEngine }) {
  const rows = [
    {
      label: 'Minimum engagement flags',
      count: exceptions.minimumEngagement,
      to: '/rule-engine',
      hint: 'Shifts under the 2h/4h award minimum',
    },
    {
      label: 'Short turnaround (double time)',
      count: exceptions.shortTurnaround,
      to: '/rule-engine',
      hint: 'Inadequate rest between shifts',
    },
    {
      label: 'Broken shifts',
      count: exceptions.brokenShift,
      to: '/rule-engine',
      hint: 'Unpaid gaps triggering broken-shift allowance',
    },
    {
      label: 'Missing rate cards',
      count: exceptions.missingRateCard,
      to: '/rule-engine/coverage',
      hint: 'Staff falling back to default pay rates',
      severe: true,
    },
  ];

  return (
    <Card>
      <CardHeader className="pb-2">
        <CardTitle className="text-base">Exceptions to review</CardTitle>
      </CardHeader>
      <CardContent className="divide-y p-0">
        {rows.map((row) => {
          const content = (
            <div className="flex items-center justify-between gap-3 px-4 py-3">
              <div>
                <div className="text-sm font-medium">{row.label}</div>
                <div className="text-xs text-muted-foreground">{row.hint}</div>
              </div>
              <span
                className={cn(
                  'rounded-full px-2.5 py-1 text-sm font-semibold tabular-nums',
                  row.count > 0
                    ? row.severe
                      ? 'bg-destructive/15 text-destructive'
                      : 'bg-amber-500/15 text-amber-700 dark:text-amber-400'
                    : 'bg-emerald-500/15 text-emerald-700 dark:text-emerald-400'
                )}
              >
                {row.count}
              </span>
            </div>
          );
          return canViewRuleEngine ? (
            <Link key={row.label} to={row.to} className="block transition-colors hover:bg-accent/50">
              {content}
            </Link>
          ) : (
            <div key={row.label}>{content}</div>
          );
        })}
      </CardContent>
    </Card>
  );
}

export const Dashboard = () => {
  const [fromDate, setFromDate] = useState(() => {
    const date = new Date();
    date.setDate(date.getDate() - 7); // Default to 7 days ago
    return date.toISOString().split('T')[0];
  });
  const [toDate, setToDate] = useState(() => {
    return new Date().toISOString().split('T')[0];
  });

  const user = useAuthStore((s) => s.user);
  const canViewRuleEngine = hasAnyPermission(user?.permissions ?? [], [
    PERMISSIONS.RULE_ENGINE_VIEW,
    PERMISSIONS.PAY_HOURS_TESTS_VIEW,
  ]);

  const shiftsParams = useMemo(
    () => ({
      from_date: fromDate,
      to_date: toDate,
      include_clients: true,
      include_metadata: true,
      per_page: 20,
      page: 1,
    }),
    [fromDate, toDate]
  );

  const { data: shiftsData, isLoading: shiftsLoading, isError: shiftsError, error: shiftsQueryError, refetch: refetchShifts } = useShifts(shiftsParams);
  const { data: staffData, isLoading: staffLoading, isError: staffError, error: staffQueryError, refetch: refetchStaff } = useStaff({ per_page: 1, include_metadata: true });
  const { data: clientsData, isLoading: clientsLoading, isError: clientsError, error: clientsQueryError, refetch: refetchClients } = useClients({ per_page: 1, include_metadata: true });
  const { data: summary, isLoading: summaryLoading, isError: summaryError, error: summaryQueryError, refetch: refetchSummary } = useDashboardSummary();

  const shifts = shiftsData?.shifts || [];
  const shiftsMetadata = shiftsData?._metadata;
  const totalShifts = shiftsMetadata?.total_count || shifts.length;
  const totalStaff = staffData?._metadata?.total_count || staffData?.staff?.length || 0;
  const totalClients = clientsData?._metadata?.total_count || clientsData?.clients?.length || 0;

  const formatDateTime = (dateString) => {
    if (!dateString) return 'N/A';
    const date = new Date(dateString);
    return date.toLocaleString();
  };

  const exceptions = summary?.exceptions;
  const totalExceptions = exceptions
    ? exceptions.minimumEngagement + exceptions.shortTurnaround + exceptions.brokenShift + exceptions.missingRateCard
    : 0;

  const hasQueryError = summaryError || shiftsError || staffError || clientsError;
  const primaryQueryError = summaryQueryError || shiftsQueryError || staffQueryError || clientsQueryError;

  return (
    <div className="space-y-4">
      <PageHeader title="Dashboard" description="Operations, pay-run health, and exceptions at a glance.">
        <label className="text-xs font-medium text-muted-foreground">From</label>
        <Input
          type="date"
          value={fromDate}
          onChange={(e) => setFromDate(e.target.value)}
          className="h-8 w-36"
        />
        <label className="text-xs font-medium text-muted-foreground">To</label>
        <Input
          type="date"
          value={toDate}
          onChange={(e) => setToDate(e.target.value)}
          className="h-8 w-36"
        />
      </PageHeader>

      {hasQueryError && (
        <QueryErrorState
          error={primaryQueryError}
          title="Some dashboard data could not be loaded"
          onRetry={() => {
            if (summaryError) refetchSummary();
            if (shiftsError) refetchShifts();
            if (staffError) refetchStaff();
            if (clientsError) refetchClients();
          }}
        />
      )}

      {/* Summary Cards */}
      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        <StatCard icon={CalendarClock} tone="primary" label="Total Shifts" value={shiftsLoading ? '…' : totalShifts} sub="In selected date range" />
        <StatCard icon={Users2} label="Total Staff" value={staffLoading ? '…' : totalStaff} sub="Active staff members" />
        <StatCard icon={HeartHandshake} label="Total Clients" value={clientsLoading ? '…' : totalClients} sub="Active clients" />
        <StatCard
          icon={Banknote}
          tone={totalExceptions > 0 ? 'warning' : 'success'}
          label="Gross pay (current)"
          value={summaryLoading ? '…' : `$${(summary?.totalGross ?? 0).toLocaleString()}`}
          sub="Latest computed pay hours"
        />
      </div>

      {summary && (
        <div className="grid gap-3 lg:grid-cols-3">
          <ExceptionQueue exceptions={exceptions} canViewRuleEngine={canViewRuleEngine} />
          <PayRunStatusCard payRun={summary.payRun} />
          <RuleEngineHealthCard awardRates={summary.awardRates} canViewRuleEngine={canViewRuleEngine} />
        </div>
      )}

      {!summaryLoading && totalExceptions > 0 && (
        <p className="text-xs text-muted-foreground">
          {totalExceptions} pay exception{totalExceptions === 1 ? '' : 's'} flagged across the latest computed
          pay hours — review them before finalising payroll.
        </p>
      )}

      {/* Shifts Table */}
      <Card>
        <CardHeader>
          <CardTitle>Recent Shifts</CardTitle>
        </CardHeader>
        <CardContent>
          {shiftsLoading ? (
            <LoadingScreen message="Loading shifts..." />
          ) : shiftsError ? (
            <QueryErrorState
              error={shiftsQueryError}
              title="Failed to load shifts"
              onRetry={refetchShifts}
              className="border-0 shadow-none"
            />
          ) : shifts.length === 0 ? (
            <div className="text-center py-8 text-muted-foreground">
              No shifts found in the selected date range
            </div>
          ) : (
            <div className="rounded-md border">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>ID</TableHead>
                    <TableHead>Start Time</TableHead>
                    <TableHead>End Time</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead>Clients</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {shifts.map((shift, idx) => (
                    <TableRow key={shift.id ?? shift.shiftcare_id ?? `shift-${idx}`}>
                      <TableCell className="font-medium">{shift.id}</TableCell>
                      <TableCell>{formatDateTime(shift.start_at)}</TableCell>
                      <TableCell>{formatDateTime(shift.end_at)}</TableCell>
                      <TableCell>
                        <span
                          className={cn(
                            'px-2 py-1 rounded-full text-xs',
                            shift.is_approved
                              ? 'bg-emerald-500/15 text-emerald-700 dark:text-emerald-400'
                              : 'bg-amber-500/15 text-amber-700 dark:text-amber-400'
                          )}
                        >
                          {shift.is_approved ? 'Approved' : 'Pending'}
                        </span>
                      </TableCell>
                      <TableCell>
                        {shift.clients?.length > 0
                          ? shift.clients.map((c) => c.display_name || c.first_name).join(', ')
                          : 'N/A'}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          )}
          {shiftsMetadata && (
            <div className="mt-4 text-sm text-muted-foreground">
              Showing page {shiftsMetadata.current_page} of {shiftsMetadata.total_pages} (
              {shiftsMetadata.total_count} total)
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
};
