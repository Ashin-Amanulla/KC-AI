import { useParams, Link } from 'react-router-dom';
import { useRosterStaffProfile } from '../../api/rosterCoverage';
import { Card, CardContent, CardHeader, CardTitle } from '../../ui/card';
import { LoadingScreen } from '../../ui/LoadingSpinner';
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
      <p className="text-sm text-destructive">
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

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center gap-2">
        <Link to="/roster-coverage/team" className="text-sm text-primary hover:underline">
          ← Team
        </Link>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">{staff.fullName}</CardTitle>
          {fortnight ? (
            <p className="text-xs font-normal text-muted-foreground">
              {usedTimesheetWindow ? (
                <>
                  Totals window from last timesheet upload: {new Date(fortnight.start).toLocaleString()} —{' '}
                  {new Date(fortnight.end).toLocaleString()} (every imported shift between those bounds).
                </>
              ) : (
                <>
                  Pay fortnight: {new Date(fortnight.start).toLocaleString()} — {new Date(fortnight.end).toLocaleString()}
                  {payPeriodAnchor
                    ? ` · Midpoint reference ${new Date(payPeriodAnchor).toLocaleString()} (today’s fortnight if no upload window is set).`
                    : null}
                </>
              )}
            </p>
          ) : null}
        </CardHeader>
        <CardContent className="grid gap-2 text-sm sm:grid-cols-2">
          <div>
            <span className="text-muted-foreground">Phone</span>
            <div>{staff.phone || '—'}</div>
          </div>
          <div>
            <span className="text-muted-foreground">Email</span>
            <div>{staff.email || '—'}</div>
          </div>
          <div>
            <span className="text-muted-foreground">Role</span>
            <div>{staff.role}</div>
          </div>
          <div>
            <span className="text-muted-foreground">Contracted / fortnight</span>
            <div>{staff.contractedFortnightlyHours} h</div>
          </div>
          <div>
            <span className="text-muted-foreground">Worked (window)</span>
            <div>{workedHoursThisFortnight?.toFixed?.(1)} h</div>
            <p className="mt-1 text-xs text-muted-foreground">
              Hours from shifts overlapping the date range above — same rule as the Team page.
            </p>
          </div>
          <div>
            <span className="text-muted-foreground">Cap headroom (fn)</span>
            <div>{hoursRemaining?.toFixed?.(1)} h</div>
            <p className="mt-1 text-xs text-muted-foreground">
              Contracted cap minus worked in the window above (upload span or current fortnight).
            </p>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Approved participants</CardTitle>
        </CardHeader>
        <CardContent>
          {approvedParticipants?.length ? (
            <ul className="list-disc pl-5 text-sm">
              {approvedParticipants.map((p) => (
                <li key={p._id}>
                  {p.name}
                  {p.locationLabel ? ` — ${p.locationLabel}` : ''}
                </li>
              ))}
            </ul>
          ) : (
            <p className="text-sm text-muted-foreground">None linked — add this staff on each participant record.</p>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">
            Shifts overlapping totals window
            {fortnight && (
              <span className="block text-xs font-normal text-muted-foreground">
                {new Date(fortnight.start).toLocaleDateString()} — {new Date(fortnight.end).toLocaleDateString()}
              </span>
            )}
          </CardTitle>
        </CardHeader>
        <CardContent className="overflow-x-auto">
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
                  <TableCell colSpan={4} className="text-muted-foreground">
                    No shifts in this fortnight window (see dates under the title). Imports attach by ShiftCare staff ID
                    or name; shifts from other pay fortnights are stored but not listed here.
                  </TableCell>
                </TableRow>
              )}
              {recentWorkedShifts?.map((w) => (
                <TableRow key={w._id}>
                  <TableCell className="whitespace-nowrap text-xs">
                    {new Date(w.startDatetime).toLocaleString()}
                  </TableCell>
                  <TableCell className="whitespace-nowrap text-xs">
                    {new Date(w.endDatetime).toLocaleString()}
                  </TableCell>
                  <TableCell>{w.rosterParticipantId?.name ?? '—'}</TableCell>
                  <TableCell>{w.shiftStatus}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </div>
  );
}
