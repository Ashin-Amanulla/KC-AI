import { Link } from 'react-router-dom';
import { useRosterAudit } from '../../api/rosterCoverage';
import { Card, CardContent, CardHeader, CardTitle } from '../../ui/card';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '../../ui/table';

export function RosterReports() {
  const { data, isLoading } = useRosterAudit(100);
  const rows = data?.audit ?? [];

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Coverage activity</CardTitle>
        </CardHeader>
        <CardContent className="text-sm text-muted-foreground">
          <p>
            PDF and Excel exports for ineligible team members run from{' '}
            <Link className="text-primary underline" to="/roster-coverage/find-cover">
              Find cover
            </Link>{' '}
            after a search. This table shows find-cover runs, timesheet uploads, and contact confirmations.
          </p>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Audit log</CardTitle>
        </CardHeader>
        <CardContent className="overflow-x-auto">
          {isLoading ? (
            <p className="text-sm text-muted-foreground">Loading…</p>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>When</TableHead>
                  <TableHead>Action</TableHead>
                  <TableHead>Detail</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {rows.length === 0 && (
                  <TableRow>
                    <TableCell colSpan={3} className="text-muted-foreground">
                      No events yet.
                    </TableCell>
                  </TableRow>
                )}
                {rows.map((r) => (
                  <TableRow key={r._id}>
                    <TableCell className="whitespace-nowrap text-xs">
                      {new Date(r.createdAt).toLocaleString()}
                    </TableCell>
                    <TableCell>{r.action}</TableCell>
                    <TableCell className="max-w-md truncate text-xs text-muted-foreground">
                      {r.payload ? JSON.stringify(r.payload) : '—'}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
