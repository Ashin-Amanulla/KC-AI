import { Link } from 'react-router-dom';
import { useMemo } from 'react';
import { Users, UsersRound, AlertTriangle, CalendarClock } from 'lucide-react';
import { useRosterDashboard, useRosterVacantShifts } from '../../api/rosterCoverage';
import { LoadingScreen } from '../../ui/LoadingSpinner';
import { QueryErrorState } from '../../components/QueryErrorState';
import { Button } from '../../ui/button';
import { Badge } from '../../ui/badge';
import { StatCard } from '../../ui/stat-card';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
  TableScrollArea,
} from '../../ui/table';

const REASON_LABELS = {
  sick_call: 'Sick call',
  vacancy: 'Vacant shift',
  other: 'Other',
};

const PRIORITY_VARIANT = {
  critical: 'destructive',
  high: 'warning',
  medium: 'warning',
  low: 'default',
};

function formatShiftDateTime(value) {
  return new Date(value).toLocaleString([], { dateStyle: 'short', timeStyle: 'short' });
}

export function RosterDashboard() {
  const { data: dash, isLoading, isError, error, refetch } = useRosterDashboard();
  const { data: vacantData, isLoading: vacantLoading } = useRosterVacantShifts('open');
  const vacancies = vacantData?.vacantShifts ?? [];

  const sortedVacancies = useMemo(
    () => [...vacancies].sort((a, b) => new Date(a.startDatetime) - new Date(b.startDatetime)),
    [vacancies]
  );

  if (isLoading) {
    return <LoadingScreen message="Loading roster summary…" />;
  }

  if (isError) {
    return (
      <QueryErrorState
        error={error}
        title="Failed to load roster dashboard"
        onRetry={refetch}
      />
    );
  }

  return (
    <div className="page-stack-dense">
      <div className="flex flex-wrap items-center justify-end gap-2">
        <Button asChild size="sm">
          <Link to="/roster-coverage/find-cover">Find cover</Link>
        </Button>
        <Button variant="outline" size="sm" asChild>
          <Link to="/roster-coverage/participants">Participants</Link>
        </Button>
        <Button variant="outline" size="sm" asChild>
          <Link to="/roster-coverage/shift-log">Shift log</Link>
        </Button>
      </div>

      <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-4">
        <StatCard label="Participants" value={dash?.participantCount ?? 0} icon={Users} className="px-3 py-2" />
        <StatCard label="Roster team" value={dash?.staffCount ?? 0} icon={UsersRound} className="px-3 py-2" />
        <StatCard
          label="Open vacancies"
          value={dash?.openVacancies ?? 0}
          icon={AlertTriangle}
          tone={dash?.openVacancies ? 'destructive' : 'default'}
          className="px-3 py-2"
        />
        <StatCard
          label="On shift today"
          value={dash?.onShiftToday ?? 0}
          icon={CalendarClock}
          tone="success"
          sub={`Local date ${dash?.localDate} (${dash?.timezone})`}
          className="px-3 py-2"
        />
      </div>

      <section className="overflow-hidden rounded-lg border border-border/60">
        <div className="flex flex-wrap items-center justify-between gap-2 border-b border-border/60 px-3 py-1.5">
          <h3 className="section-label">Open vacant shifts</h3>
          <span className="text-2xs tabular-nums text-muted-foreground">
            {sortedVacancies.length} shift{sortedVacancies.length === 1 ? '' : 's'}
          </span>
        </div>
        {vacantLoading ? (
          <p className="px-3 py-6 text-2sm text-muted-foreground">Loading vacant shifts…</p>
        ) : sortedVacancies.length === 0 ? (
          <p className="px-3 py-6 text-2sm text-muted-foreground">No open vacant shifts.</p>
        ) : (
          <TableScrollArea>
            <Table scrollable={false}>
              <TableHeader>
                <TableRow>
                  <TableHead>Participant</TableHead>
                  <TableHead className="whitespace-nowrap">Start</TableHead>
                  <TableHead className="whitespace-nowrap">End</TableHead>
                  <TableHead>Reason</TableHead>
                  <TableHead>Priority</TableHead>
                  <TableHead className="text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {sortedVacancies.map((shift) => (
                  <TableRow key={shift._id}>
                    <TableCell className="font-medium">
                      {shift.rosterParticipantId?.name ?? 'Participant'}
                    </TableCell>
                    <TableCell className="whitespace-nowrap tabular-nums">
                      {formatShiftDateTime(shift.startDatetime)}
                    </TableCell>
                    <TableCell className="whitespace-nowrap tabular-nums">
                      {formatShiftDateTime(shift.endDatetime)}
                    </TableCell>
                    <TableCell>
                      {REASON_LABELS[shift.reason] ?? shift.reason ?? '—'}
                    </TableCell>
                    <TableCell>
                      <Badge
                        variant={PRIORITY_VARIANT[shift.priority] ?? PRIORITY_VARIANT.medium}
                        className="capitalize"
                      >
                        {shift.priority ?? 'medium'}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-right">
                      <Button asChild variant="outline" size="sm" className="h-7 text-2xs">
                        <Link to="/roster-coverage/find-cover">Find cover</Link>
                      </Button>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </TableScrollArea>
        )}
      </section>
    </div>
  );
}
