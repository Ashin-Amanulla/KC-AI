import { Link } from 'react-router-dom';
import { useMemo } from 'react';
import { useStaff } from '../api/staff';
import { useClients } from '../api/clients';
import { useDashboardSummary } from '../api/dashboard';
import { useShiftCareKpis } from '../api/shiftcare';
import { useAuthStore } from '../store/auth';
import { PERMISSIONS, hasAnyPermission } from '../config/permissions';
import { usePeriodState } from '../hooks/usePeriodState';
import { PeriodSelector } from '../components/PeriodSelector';
import { Card, CardContent, CardHeader, CardTitle } from '../ui/card';
import { QueryErrorState } from '../components/QueryErrorState';
import { StatCard } from '../ui/stat-card';
import { PageHeader } from '../components/PageHeader';
import { InfoHint } from '../components/InfoHint';
import { Badge } from '../ui/badge';
import { Button } from '../ui/button';
import {
  Users2,
  HeartHandshake,
  Banknote,
  Clock,
  CheckCircle2,
  CircleDashed,
  ExternalLink,
  CalendarClock,
} from 'lucide-react';
import { SHIFTCARE_SCHEDULER_URL } from '../utils/fortnight';

const JOB_STATUS_META = {
  completed: { label: 'Completed', variant: 'success' },
  processing: { label: 'Processing', variant: 'primary' },
  pending: { label: 'Pending', variant: 'default' },
  failed: { label: 'Failed', variant: 'destructive' },
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
              <Badge variant={JOB_STATUS_META[payRun.status]?.variant ?? JOB_STATUS_META.pending.variant}>
                {JOB_STATUS_META[payRun.status]?.label ?? payRun.status}
              </Badge>
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
          <p className="rounded-md bg-warning/10 px-3 py-2 text-warning">
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
              <div className="flex items-center gap-1">
                <div className="text-sm font-medium">{row.label}</div>
                <InfoHint content={row.hint} label={row.label} />
              </div>
              <Badge
                variant={row.count > 0 ? (row.severe ? 'destructive' : 'warning') : 'success'}
                className="px-2.5 py-1 text-sm font-semibold tabular-nums"
              >
                {row.count}
              </Badge>
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

function PayRunReadinessCard({ kpis }) {
  const ts = kpis?.timesheets?.summary;
  if (!ts) return null;
  const pct = ts.approvalRate ?? 0;
  return (
    <Card>
      <CardHeader className="pb-2">
        <CardTitle className="text-base">Pay-run readiness</CardTitle>
      </CardHeader>
      <CardContent className="space-y-3 text-sm">
        <div className="flex items-center justify-between gap-2">
          <span className="text-muted-foreground">Timesheet approval</span>
          <span className="font-semibold tabular-nums text-ink">{pct}%</span>
        </div>
        <div className="h-2 overflow-hidden rounded-full bg-secondary">
          <div
            className="h-full rounded-full bg-primary transition-all"
            style={{ width: `${Math.min(100, pct)}%` }}
          />
        </div>
        <p className="text-xs text-muted-foreground">
          {ts.approvedCount} approved · {ts.pendingCount} pending · {ts.staffCount} staff with entries
        </p>
        <Button asChild variant="secondary" size="sm" className="h-8">
          <Link to="/timesheets">Review timesheet exceptions →</Link>
        </Button>
      </CardContent>
    </Card>
  );
}

export const Dashboard = () => {
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

  const user = useAuthStore((s) => s.user);
  const canViewRuleEngine = hasAnyPermission(user?.permissions ?? [], [
    PERMISSIONS.RULE_ENGINE_VIEW,
    PERMISSIONS.PAY_HOURS_TESTS_VIEW,
  ]);

  const kpiParams = useMemo(
    () => ({
      from: range.from,
      to: range.to,
      time_zone: 'Australia/Brisbane',
    }),
    [range.from, range.to]
  );

  const { data: kpis, isLoading: kpisLoading, isError: kpisError, error: kpisQueryError, refetch: refetchKpis } =
    useShiftCareKpis(kpiParams);
  const { data: staffData, isLoading: staffLoading, isError: staffError, error: staffQueryError, refetch: refetchStaff } =
    useStaff({ per_page: 1, include_metadata: true });
  const { data: clientsData, isLoading: clientsLoading, isError: clientsError, error: clientsQueryError, refetch: refetchClients } =
    useClients({ per_page: 1, include_metadata: true });
  const { data: summary, isLoading: summaryLoading, isError: summaryError, error: summaryQueryError, refetch: refetchSummary } =
    useDashboardSummary();

  const tsSummary = kpis?.timesheets?.summary;
  const shiftSummary = kpis?.shifts?.summary;
  const totalStaff = staffData?._metadata?.total_count || staffData?.staff?.length || 0;
  const totalClients = clientsData?._metadata?.total_count || clientsData?.clients?.length || 0;

  const exceptions = summary?.exceptions;
  const totalExceptions = exceptions
    ? exceptions.minimumEngagement + exceptions.shortTurnaround + exceptions.brokenShift + exceptions.missingRateCard
    : 0;

  const hasQueryError = summaryError || kpisError || staffError || clientsError;
  const primaryQueryError = summaryQueryError || kpisQueryError || staffQueryError || clientsQueryError;

  return (
    <div className="space-y-4">
      <PageHeader
        title="Dashboard"
        hint="Fortnight operations snapshot — pay-run health, ShiftCare timesheets, and exceptions."
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
        <Button asChild variant="ghost" size="sm" className="h-8 gap-1.5 text-muted-foreground">
          <a href={SHIFTCARE_SCHEDULER_URL} target="_blank" rel="noopener noreferrer">
            Scheduler <ExternalLink className="h-3.5 w-3.5" />
          </a>
        </Button>
      </PageHeader>

      {hasQueryError && (
        <QueryErrorState
          error={primaryQueryError}
          title="Some dashboard data could not be loaded"
          onRetry={() => {
            if (summaryError) refetchSummary();
            if (kpisError) refetchKpis();
            if (staffError) refetchStaff();
            if (clientsError) refetchClients();
          }}
        />
      )}

      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        <StatCard
          icon={Clock}
          tone="primary"
          label="Total hours"
          value={kpisLoading ? '…' : `${tsSummary?.totalHours ?? 0}h`}
          sub={`${tsSummary?.totalRecords ?? 0} timesheet records`}
        />
        <StatCard
          icon={CheckCircle2}
          tone="success"
          label="Approved hours"
          value={kpisLoading ? '…' : `${tsSummary?.approvedHours ?? 0}h`}
          sub={`${tsSummary?.approvalRate ?? 0}% approval rate`}
        />
        <StatCard
          icon={CircleDashed}
          tone="warning"
          label="Pending approval"
          value={kpisLoading ? '…' : tsSummary?.pendingCount ?? 0}
          sub="Unapproved timesheets"
        />
        <StatCard
          icon={CalendarClock}
          label="Scheduled shifts"
          value={kpisLoading ? '…' : shiftSummary?.totalShifts ?? 0}
          sub={`${shiftSummary?.unapproved ?? 0} unapproved · ${shiftSummary?.unassigned ?? 0} unassigned`}
        />
      </div>

      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        <StatCard icon={Users2} label="Total Staff" value={staffLoading ? '…' : totalStaff} sub="Active staff members" />
        <StatCard icon={HeartHandshake} label="Total Clients" value={clientsLoading ? '…' : totalClients} sub="Active clients" />
        <StatCard
          icon={Banknote}
          tone={totalExceptions > 0 ? 'warning' : 'success'}
          label="Gross pay (computed)"
          value={summaryLoading ? '…' : `$${(summary?.totalGross ?? 0).toLocaleString()}`}
          sub="Latest SCHADS pay-hours run"
        />
        <StatCard
          icon={Banknote}
          label="Timesheet amount"
          value={kpisLoading ? '…' : `$${(tsSummary?.totalAmount ?? 0).toLocaleString()}`}
          sub="ShiftCare payable total"
        />
      </div>

      <div className="grid gap-3 lg:grid-cols-4">
        <PayRunReadinessCard kpis={kpis} />
        {summary && (
          <>
            <ExceptionQueue exceptions={exceptions} canViewRuleEngine={canViewRuleEngine} />
            <PayRunStatusCard payRun={summary.payRun} />
            <RuleEngineHealthCard awardRates={summary.awardRates} canViewRuleEngine={canViewRuleEngine} />
          </>
        )}
      </div>

      {!summaryLoading && totalExceptions > 0 && (
        <p className="text-xs text-muted-foreground">
          {totalExceptions} pay exception{totalExceptions === 1 ? '' : 's'} flagged across the latest computed
          pay hours — review them before finalising payroll.
        </p>
      )}
    </div>
  );
};
