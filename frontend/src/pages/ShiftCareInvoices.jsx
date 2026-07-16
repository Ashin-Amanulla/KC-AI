import { useMemo, useState } from 'react';
import { useInvoices } from '../api/shiftcare';
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
import { Receipt, DollarSign, AlertCircle } from 'lucide-react';

function formatMoney(n) {
  if (n == null) return '—';
  return `$${Number(n).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

function formatDate(v) {
  if (!v) return '—';
  return new Date(v).toLocaleDateString('en-AU', { day: 'numeric', month: 'short', year: 'numeric' });
}

export function ShiftCareInvoicesPage() {
  const { mode, setMode, customFrom, setCustomFrom, customTo, setCustomTo, period } =
    usePeriodState('fortnight');
  const [page, setPage] = useState(1);

  const params = useMemo(
    () => ({
      from_date: period.fromDate,
      to_date: period.toDate,
      include_metadata: true,
      include_client: true,
      per_page: 20,
      page,
      time_zone: 'Australia/Brisbane',
    }),
    [period.fromDate, period.toDate, page]
  );

  const { data, isLoading, isError, error, refetch } = useInvoices(params);

  const invoices = data?.invoices ?? [];
  const meta = data?._metadata;

  const stats = useMemo(() => {
    let total = 0;
    let outstanding = 0;
    let unpaid = 0;
    for (const inv of invoices) {
      total += Number(inv.total_amount) || 0;
      outstanding += Number(inv.balance) || 0;
      if (Number(inv.balance) > 0) unpaid += 1;
    }
    return { total, outstanding, unpaid };
  }, [invoices]);

  return (
    <div className="page-stack">
      <PageHeader title="Invoices" hint="ShiftCare billing invoices for the selected period.">
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
        <LoadingScreen message="Loading invoices…" />
      ) : isError ? (
        <QueryErrorState error={error} title="Failed to load invoices" onRetry={refetch} />
      ) : (
        <>
          <div className="grid gap-2 sm:grid-cols-3">
            <StatCard icon={Receipt} label="On this page" value={invoices.length} sub={`${meta?.total_count ?? 0} in period`} className="px-3 py-2" />
            <StatCard icon={DollarSign} label="Page total" value={formatMoney(stats.total)} className="px-3 py-2" />
            <StatCard icon={AlertCircle} tone="warning" label="With balance due" value={stats.unpaid} className="px-3 py-2" />
          </div>

          <Card>
            <CardHeader>
              <CardTitle>Invoice list</CardTitle>
            </CardHeader>
            <CardContent className="p-0 pb-4">
              {invoices.length === 0 ? (
                <p className="px-4 py-8 text-center text-sm text-muted-foreground">No invoices in this period</p>
              ) : (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Ref</TableHead>
                      <TableHead>Client</TableHead>
                      <TableHead>Status</TableHead>
                      <TableHead>Issued</TableHead>
                      <TableHead className="text-right">Total</TableHead>
                      <TableHead className="text-right">Balance</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {invoices.map((inv) => (
                      <TableRow key={inv.id}>
                        <TableCell className="font-mono text-xs">{inv.reference_number ?? inv.id}</TableCell>
                        <TableCell>{inv.client?.display_name ?? inv.client_id ?? '—'}</TableCell>
                        <TableCell>
                          <Badge variant={Number(inv.balance) > 0 ? 'warning' : 'success'}>{inv.status}</Badge>
                        </TableCell>
                        <TableCell className="text-xs">{formatDate(inv.issued_at)}</TableCell>
                        <TableCell className="text-right tabular-nums">{formatMoney(inv.total_amount)}</TableCell>
                        <TableCell className="text-right tabular-nums">{formatMoney(inv.balance)}</TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              )}
              {meta && meta.total_pages > 1 && (
                <div className="mt-3 flex items-center justify-between px-4 text-xs text-muted-foreground">
                  <span>Page {meta.current_page} of {meta.total_pages}</span>
                  <div className="flex gap-2">
                    <button type="button" className="text-primary disabled:opacity-50" disabled={page <= 1} onClick={() => setPage((p) => p - 1)}>Previous</button>
                    <button type="button" className="text-primary disabled:opacity-50" disabled={page >= meta.total_pages} onClick={() => setPage((p) => p + 1)}>Next</button>
                  </div>
                </div>
              )}
            </CardContent>
          </Card>
        </>
      )}
    </div>
  );
}
