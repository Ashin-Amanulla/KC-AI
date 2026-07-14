import { Link } from 'react-router-dom';
import { useRosterDashboard, useRosterVacantShifts } from '../../api/rosterCoverage';
import { Card, CardContent, CardHeader, CardTitle } from '../../ui/card';
import { LoadingScreen } from '../../ui/LoadingSpinner';
import { QueryErrorState } from '../../components/QueryErrorState';
import { Button } from '../../ui/button';

export function RosterDashboard() {
  const { data: dash, isLoading, isError, error, refetch } = useRosterDashboard();
  const { data: vacantData } = useRosterVacantShifts('open');
  const vacancies = vacantData?.vacantShifts ?? [];

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
    <div className="space-y-6">
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium">Participants</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{dash?.participantCount ?? 0}</div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium">Roster team</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{dash?.staffCount ?? 0}</div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium">Open vacancies</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{dash?.openVacancies ?? 0}</div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium">On shift today</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{dash?.onShiftToday ?? 0}</div>
            <p className="text-xs text-muted-foreground">
              Local date {dash?.localDate} ({dash?.timezone})
            </p>
          </CardContent>
        </Card>
      </div>

      <div className="flex flex-wrap gap-2">
        <Button asChild>
          <Link to="/roster-coverage/find-cover">Find cover</Link>
        </Button>
        <Button variant="outline" asChild>
          <Link to="/roster-coverage/participants">Manage participants</Link>
        </Button>
      </div>

      {vacancies.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Open vacant shifts</CardTitle>
          </CardHeader>
          <CardContent className="space-y-2 text-sm">
            {vacancies.slice(0, 8).map((v) => (
              <div key={v._id} className="flex flex-wrap justify-between gap-2 border-b border-border/60 py-2 last:border-0">
                <span>{v.rosterParticipantId?.name ?? 'Participant'}</span>
                <span className="text-muted-foreground">
                  {new Date(v.startDatetime).toLocaleString()} — {new Date(v.endDatetime).toLocaleString()}
                </span>
              </div>
            ))}
          </CardContent>
        </Card>
      )}
    </div>
  );
}
