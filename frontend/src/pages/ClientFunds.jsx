import { useMemo } from 'react';
import { useFundsDashboard } from '../api/shiftcare';
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
import { Wallet, Clock, AlertTriangle } from 'lucide-react';

function formatMoney(n) {
  if (n == null) return '—';
  return `$${Number(n).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

function formatDate(v) {
  if (!v) return '—';
  return new Date(v).toLocaleDateString('en-AU', { day: 'numeric', month: 'short', year: 'numeric' });
}

export function ClientFundsPage() {
  const { data, isLoading, isError, error, refetch } = useFundsDashboard();

  const rows = data?.clients ?? [];
  const stats = useMemo(() => {
    const now = Date.now();
    const in30 = now + 30 * 86400000;
    let lowBalance = 0;
    let expiringSoon = 0;
    let totalBalance = 0;
    for (const r of rows) {
      if (r.balanceAmount != null) totalBalance += r.balanceAmount;
      if (r.balanceAmount != null && r.balanceAmount < 1000) lowBalance += 1;
      if (r.expiresAt && new Date(r.expiresAt).getTime() <= in30) expiringSoon += 1;
    }
    return { lowBalance, expiringSoon, totalBalance, fundCount: rows.length };
  }, [rows]);

  return (
    <div className="page-stack">
      <PageHeader
        title="Client funds"
        hint="NDIS fund balances from ShiftCare — burn-down and expiry alerts."
      />

      {isLoading ? (
        <LoadingScreen message="Loading client funds…" />
      ) : isError ? (
        <QueryErrorState error={error} title="Failed to load funds" onRetry={refetch} />
      ) : (
        <>
          <div className="grid gap-2 sm:grid-cols-3">
            <StatCard icon={Wallet} label="Funds tracked" value={stats.fundCount} className="px-3 py-2" />
            <StatCard icon={Wallet} tone="primary" label="Total balance" value={formatMoney(stats.totalBalance)} className="px-3 py-2" />
            <StatCard icon={AlertTriangle} tone="warning" label="Expiring ≤30 days" value={stats.expiringSoon} className="px-3 py-2" />
          </div>

          <Card>
            <CardHeader>
              <CardTitle>Fund balances</CardTitle>
            </CardHeader>
            <CardContent className="p-0 pb-4">
              {rows.length === 0 ? (
                <p className="px-4 py-8 text-center text-sm text-muted-foreground">No fund data available</p>
              ) : (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Client</TableHead>
                      <TableHead>Fund</TableHead>
                      <TableHead className="text-right">Allocated</TableHead>
                      <TableHead className="text-right">Balance</TableHead>
                      <TableHead className="text-right">Hours</TableHead>
                      <TableHead>Expires</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {rows.map((r) => (
                      <TableRow key={`${r.clientId}-${r.fundId}`}>
                        <TableCell className="font-medium">{r.clientName}</TableCell>
                        <TableCell>{r.fundName}</TableCell>
                        <TableCell className="text-right tabular-nums">{formatMoney(r.amount)}</TableCell>
                        <TableCell className="text-right tabular-nums">
                          {r.balanceAmount != null && r.balanceAmount < 1000 ? (
                            <Badge variant="warning">{formatMoney(r.balanceAmount)}</Badge>
                          ) : (
                            formatMoney(r.balanceAmount)
                          )}
                        </TableCell>
                        <TableCell className="text-right tabular-nums">
                          <span className="inline-flex items-center gap-1">
                            <Clock className="h-3 w-3 text-faint" />
                            {r.balanceHours ?? r.hours ?? '—'}
                          </span>
                        </TableCell>
                        <TableCell className="text-xs">{formatDate(r.expiresAt)}</TableCell>
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
}
