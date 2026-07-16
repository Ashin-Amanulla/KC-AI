import { Link } from 'react-router-dom';
import { useRosterAudit } from '../../api/rosterCoverage';
import { CardTitleHint } from '../../components/InfoHint';
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
    <div className="page-stack-dense">
      <section className="overflow-hidden rounded-lg border bg-card">
        <div className="border-b border-border/60 px-3 py-2">
          <CardTitleHint
            titleClassName="text-2sm"
            hintLabel="About audit log"
            hint={
              <>
                PDF and Excel exports for ineligible team members run from{' '}
                <Link className="text-primary underline" to="/roster-coverage/find-cover">
                  Find cover
                </Link>{' '}
                after a search. This table shows find-cover runs, timesheet uploads, and contact confirmations.
              </>
            }
          >
            Audit log
          </CardTitleHint>
        </div>
        <div className="overflow-x-auto">
          {isLoading ? (
            <p className="px-3 py-6 text-2sm text-muted-foreground">Loading…</p>
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
                    <TableCell className="whitespace-nowrap text-2xs">
                      {new Date(r.createdAt).toLocaleString()}
                    </TableCell>
                    <TableCell className="text-2sm">{r.action}</TableCell>
                    <TableCell className="max-w-md truncate text-2xs text-muted-foreground">
                      {r.payload ? JSON.stringify(r.payload) : '—'}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </div>
      </section>
    </div>
  );
}
