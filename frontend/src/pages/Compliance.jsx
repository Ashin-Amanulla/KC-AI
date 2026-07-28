import { useMemo } from 'react';
import { useComplianceDashboard } from '../api/shiftcare';
import { usePeriodState } from '../hooks/usePeriodState';
import { PeriodSelector } from '../components/PeriodSelector';
import { PageHeader } from '../components/PageHeader';
import { Card, CardContent, CardHeader, CardTitle } from '../ui/card';
import { StatCard } from '../ui/stat-card';
import { Badge } from '../ui/badge';
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
import { ShieldAlert, CalendarOff, FileWarning } from 'lucide-react';

function formatDate(v) {
  if (!v) return '—';
  return new Date(v).toLocaleDateString('en-AU', { day: 'numeric', month: 'short', year: 'numeric' });
}

export function CompliancePage() {
  const { mode, setMode, customFrom, setCustomFrom, customTo, setCustomTo, period } =
    usePeriodState('fortnight');

  const params = useMemo(
    () => ({
      from_date: period.fromDate,
      to_date: period.toDate,
    }),
    [period.fromDate, period.toDate]
  );

  const { data, isLoading, isError, error, refetch } = useComplianceDashboard(params);

  const quals = data?.expiringQualifications ?? [];
  const leaves = data?.leaves ?? [];
  const expired = quals.filter((q) => q.expired).length;

  return (
    <div className="page-stack">
      <PageHeader
        title="Compliance"
        hint="Staff qualifications expiring soon and leave in the selected period."
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
        <LoadingScreen message="Loading compliance data…" />
      ) : isError ? (
        <QueryErrorState error={error} title="Failed to load compliance data" onRetry={refetch} />
      ) : (
        <>
          <div className="grid gap-2 sm:grid-cols-3">
            <StatCard icon={FileWarning} tone="warning" label="Qualifications ≤30 days" value={quals.length} className="px-3 py-2" />
            <StatCard icon={ShieldAlert} tone="destructive" label="Already expired" value={expired} className="px-3 py-2" />
            <StatCard icon={CalendarOff} label="Leave records" value={leaves.length} className="px-3 py-2" />
          </div>

          <div className="grid gap-3 lg:grid-cols-2">
            <Card>
              <CardHeader>
                <CardTitle>Expiring qualifications</CardTitle>
              </CardHeader>
              <CardContent className="p-0 pb-4">
                {quals.length === 0 ? (
                  <p className="px-4 py-6 text-sm text-muted-foreground">No qualifications expiring in the next 30 days</p>
                ) : (
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Staff</TableHead>
                        <TableHead>Expires</TableHead>
                        <TableHead>Status</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {quals.map((q, i) => (
                        <TableRow key={`${q.staffId}-${i}`}>
                          <TableCell>{q.staffName}</TableCell>
                          <TableCell className="text-xs">{formatDate(q.expiresAt)}</TableCell>
                          <TableCell>
                            <Badge variant={q.expired ? 'destructive' : 'warning'}>
                              {q.expired ? 'Expired' : 'Expiring'}
                            </Badge>
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                )}
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle>Leave in period</CardTitle>
              </CardHeader>
              <CardContent className="p-0 pb-4">
                {leaves.length === 0 ? (
                  <p className="px-4 py-6 text-sm text-muted-foreground">No leave records in this period</p>
                ) : (
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Staff</TableHead>
                        <TableHead>Type</TableHead>
                        <TableHead>From</TableHead>
                        <TableHead>To</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {leaves.slice(0, 50).map((lv) => (
                        <TableRow key={lv.id}>
                          <TableCell>{lv.user_id ?? '—'}</TableCell>
                          <TableCell>{lv.title ?? lv.reason ?? '—'}</TableCell>
                          <TableCell className="text-xs">{formatDate(lv.start_at)}</TableCell>
                          <TableCell className="text-xs">{formatDate(lv.end_at)}</TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                )}
              </CardContent>
            </Card>
          </div>
        </>
      )}
    </div>
  );
}
