import { useParams, Link } from 'react-router-dom';
import { useRosterStaffProfile } from '../../api/rosterCoverage';
import { LoadingScreen } from '../../ui/LoadingSpinner';
import { CardTitleHint } from '../../components/InfoHint';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '../../ui/table';

export function RosterStaffProfile() {
  const { staffId } = useParams();
  const { data, isLoading, error } = useRosterStaffProfile(staffId);

  if (isLoading) return <LoadingScreen message="Loading profile…" />;
  if (error || !data?.staff) {
    return (
      <p className="text-2sm text-destructive">
        Could not load profile. <Link to="/roster-coverage/team" className="underline">Back to team</Link>
      </p>
    );
  }

  const {
    staff,
    approvedParticipants,
    fortnight,
    payPeriodAnchor,
    usedTimesheetWindow,
    workedHoursThisFortnight,
    hoursRemaining,
    recentWorkedShifts,
  } = data;

  const fortnightHint = fortnight
    ? usedTimesheetWindow
      ? `Totals window from last timesheet upload: ${new Date(fortnight.start).toLocaleString()} — ${new Date(fortnight.end).toLocaleString()}.`
      : `Pay fortnight: ${new Date(fortnight.start).toLocaleString()} — ${new Date(fortnight.end).toLocaleString()}${
          payPeriodAnchor
            ? ` · Midpoint ${new Date(payPeriodAnchor).toLocaleString()} if no upload window is set.`
            : ''
        }`
    : null;

  return (
    <div className="page-stack-dense">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h2 className="text-base font-semibold tracking-tight">{staff.fullName}</h2>
        <Link to="/roster-coverage/team" className="text-2sm text-primary hover:underline">
          ← Team
        </Link>
      </div>

      <section className="rounded-lg border bg-card p-3 space-y-2.5">
        <CardTitleHint titleClassName="text-2sm" hint={fortnightHint} hintLabel="About fortnight totals">
          Fortnight totals
        </CardTitleHint>
        <div className="grid gap-2 text-2sm sm:grid-cols-2 lg:grid-cols-3">
          <div>
            <span className="text-2xs uppercase tracking-wide text-muted-foreground">Phone</span>
            <div>{staff.phone || '—'}</div>
          </div>
          <div>
            <span className="text-2xs uppercase tracking-wide text-muted-foreground">Email</span>
            <div>{staff.email || '—'}</div>
          </div>
          <div>
            <span className="text-2xs uppercase tracking-wide text-muted-foreground">Role</span>
            <div>{staff.role}</div>
          </div>
          <div>
            <span className="text-2xs uppercase tracking-wide text-muted-foreground">Contracted / fn</span>
            <div>{staff.contractedFortnightlyHours} h</div>
          </div>
          <div>
            <span className="text-2xs uppercase tracking-wide text-muted-foreground">Worked</span>
            <div>{workedHoursThisFortnight?.toFixed?.(1)} h</div>
          </div>
          <div>
            <span className="text-2xs uppercase tracking-wide text-muted-foreground">Cap headroom</span>
            <div>{hoursRemaining?.toFixed?.(1)} h</div>
          </div>
        </div>
      </section>

      <section className="rounded-lg border bg-card p-3 space-y-2">
        <CardTitleHint titleClassName="text-2sm">Approved participants</CardTitleHint>
        {approvedParticipants?.length ? (
          <ul className="list-disc pl-4 text-2sm">
            {approvedParticipants.map((p) => (
              <li key={p._id}>
                {p.name}
                {p.locationLabel ? ` — ${p.locationLabel}` : ''}
              </li>
            ))}
          </ul>
        ) : (
          <p className="text-2sm text-muted-foreground">None linked — add this staff on each participant record.</p>
        )}
      </section>

      <section className="overflow-hidden rounded-lg border bg-card">
        <div className="border-b border-border/60 px-3 py-2">
          <CardTitleHint titleClassName="text-2sm">
            Shifts in totals window
            {fortnight && (
              <span className="ml-2 font-normal normal-case text-2xs text-muted-foreground">
                {new Date(fortnight.start).toLocaleDateString()} — {new Date(fortnight.end).toLocaleDateString()}
              </span>
            )}
          </CardTitleHint>
        </div>
        <div className="overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Start</TableHead>
                <TableHead>End</TableHead>
                <TableHead>Participant</TableHead>
                <TableHead>Status</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {recentWorkedShifts?.length === 0 && (
                <TableRow>
                  <TableCell colSpan={4} className="text-2sm text-muted-foreground">
                    No shifts in this window.
                  </TableCell>
                </TableRow>
              )}
              {recentWorkedShifts?.map((w) => (
                <TableRow key={w._id}>
                  <TableCell className="whitespace-nowrap text-2xs">
                    {new Date(w.startDatetime).toLocaleString()}
                  </TableCell>
                  <TableCell className="whitespace-nowrap text-2xs">
                    {new Date(w.endDatetime).toLocaleString()}
                  </TableCell>
                  <TableCell className="text-2sm">{w.rosterParticipantId?.name ?? '—'}</TableCell>
                  <TableCell className="text-2sm">{w.shiftStatus}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      </section>
    </div>
  );
}
