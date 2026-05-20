import { useMemo, useState } from 'react';
import { toast } from 'sonner';
import {
  useStandardDirectory,
  useStandardVsForecastSummary,
  exportStandardVsForecastCsv,
  exportStandardVsForecastPdf,
} from '../api/standardForecast';
import { useLocations } from '../api/locations';
import { getErrorMessage } from '../utils/api';
import { Card, CardContent, CardHeader, CardTitle } from '../ui/card';
import { Button } from '../ui/button';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '../ui/table';
import { LoadingScreen } from '../ui/LoadingSpinner';
import { Download, FileSpreadsheet } from 'lucide-react';

function formatDate(d) {
  if (!d) return '—';
  return new Date(d).toLocaleDateString();
}

function formatMoney(v) {
  if (v == null || v === '') return '—';
  const n = typeof v === 'number' ? v : Number(v);
  return Number.isFinite(n) ? n.toFixed(2) : '—';
}

function varianceClass(v) {
  if (v > 0) return 'text-red-600';
  if (v < 0) return 'text-green-600';
  return '';
}

export function StandardVsForecast() {
  const { data: locData, isLoading: locLoading } = useLocations();
  const locations = locData?.locations ?? [];
  const [locationId, setLocationId] = useState('');
  const [client, setClient] = useState('all');

  const summaryParams = useMemo(() => ({ locationId, client }), [locationId, client]);

  const { data: directory, isLoading: dirLoading } = useStandardDirectory(Boolean(locationId));
  const summaryQ = useStandardVsForecastSummary(summaryParams, Boolean(locationId));

  const clientOptions = directory?.clients || [{ value: 'all', label: 'All Clients' }];
  const exportBase = { locationId, client };

  const periodLabel =
    summaryQ.data?.forecastDateRangeStart && summaryQ.data?.forecastDateRangeEnd
      ? `Forecast period: ${formatDate(summaryQ.data.forecastDateRangeStart)} – ${formatDate(summaryQ.data.forecastDateRangeEnd)}`
      : 'No forecast data available';

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-3xl font-bold">Standard vs forecast</h2>
        <p className="text-sm text-muted-foreground">{periodLabel}</p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Scope</CardTitle>
        </CardHeader>
        <CardContent className="flex flex-col gap-4 md:flex-row md:flex-wrap md:items-end">
          <div className="space-y-1">
            <label className="text-sm font-medium">Location</label>
            {locLoading ? (
              <LoadingScreen message="Loading locations…" />
            ) : (
              <select
                className="flex h-10 w-full md:w-64 rounded-md border border-input bg-background px-3 py-2 text-sm"
                value={locationId}
                onChange={(e) => {
                  setLocationId(e.target.value);
                  setClient('all');
                }}
              >
                <option value="">Select location…</option>
                {locations.map((loc) => (
                  <option key={loc._id || loc.id} value={loc._id || loc.id}>
                    {loc.name} ({loc.code})
                  </option>
                ))}
              </select>
            )}
          </div>
          <div className="space-y-1">
            <label className="text-sm font-medium">Client</label>
            <select
              className="flex h-10 w-full md:w-56 rounded-md border border-input bg-background px-3 py-2 text-sm"
              value={client}
              onChange={(e) => setClient(e.target.value)}
              disabled={!locationId || dirLoading}
            >
              {clientOptions.map((o) => (
                <option key={o.value} value={o.value}>
                  {o.label}
                </option>
              ))}
            </select>
          </div>
        </CardContent>
      </Card>

      {!locationId ? (
        <p className="text-sm text-muted-foreground">Select a location to continue.</p>
      ) : (
        <Card>
          <CardHeader className="flex flex-row flex-wrap items-center justify-between gap-2">
            <CardTitle>Comparison</CardTitle>
            <div className="flex flex-wrap gap-2">
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={() =>
                  exportStandardVsForecastCsv(exportBase).catch((e) => toast.error(getErrorMessage(e)))
                }
              >
                <Download className="mr-2 h-4 w-4" />
                Export CSV
              </Button>
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={() =>
                  exportStandardVsForecastPdf(exportBase).catch((e) => toast.error(getErrorMessage(e)))
                }
              >
                <FileSpreadsheet className="mr-2 h-4 w-4" />
                Export PDF
              </Button>
            </div>
          </CardHeader>
          <CardContent>
            {summaryQ.isLoading ? (
              <LoadingScreen message="Loading summary…" />
            ) : (
              <div className="rounded-md border">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Client name</TableHead>
                      <TableHead className="text-right">Standard budget</TableHead>
                      <TableHead className="text-right">Forecast budget</TableHead>
                      <TableHead className="text-right">Variance</TableHead>
                      <TableHead className="text-right">Variance %</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {(summaryQ.data?.records ?? []).length === 0 ? (
                      <TableRow>
                        <TableCell colSpan={5} className="text-center text-muted-foreground py-8">
                          Upload standard and forecast data to see the comparison.
                        </TableCell>
                      </TableRow>
                    ) : (
                      <>
                        {summaryQ.data.records.map((r) => (
                          <TableRow key={r.clientId}>
                            <TableCell className="font-medium">{r.clientName}</TableCell>
                            <TableCell className="text-right font-mono text-xs">
                              {formatMoney(r.standardBudget)}
                            </TableCell>
                            <TableCell className="text-right font-mono text-xs">
                              {formatMoney(r.forecastBudget)}
                            </TableCell>
                            <TableCell
                              className={`text-right font-mono text-xs ${varianceClass(r.variance)}`}
                            >
                              {formatMoney(r.variance)}
                            </TableCell>
                            <TableCell
                              className={`text-right font-mono text-xs ${varianceClass(r.variance)}`}
                            >
                              {r.variancePercentage != null
                                ? `${formatMoney(r.variancePercentage)}%`
                                : '—'}
                            </TableCell>
                          </TableRow>
                        ))}
                        {summaryQ.data?.totals && (
                          <TableRow className="bg-muted/50 font-semibold border-t-2">
                            <TableCell>{summaryQ.data.totals.clientName}</TableCell>
                            <TableCell className="text-right font-mono text-xs">
                              {formatMoney(summaryQ.data.totals.standardBudget)}
                            </TableCell>
                            <TableCell className="text-right font-mono text-xs">
                              {formatMoney(summaryQ.data.totals.forecastBudget)}
                            </TableCell>
                            <TableCell
                              className={`text-right font-mono text-xs ${varianceClass(summaryQ.data.totals.variance)}`}
                            >
                              {formatMoney(summaryQ.data.totals.variance)}
                            </TableCell>
                            <TableCell
                              className={`text-right font-mono text-xs ${varianceClass(summaryQ.data.totals.variance)}`}
                            >
                              {summaryQ.data.totals.variancePercentage != null
                                ? `${formatMoney(summaryQ.data.totals.variancePercentage)}%`
                                : '—'}
                            </TableCell>
                          </TableRow>
                        )}
                      </>
                    )}
                  </TableBody>
                </Table>
              </div>
            )}
            {summaryQ.data?.records?.length > 0 && (
              <p className="mt-4 text-sm text-muted-foreground">
                Showing {summaryQ.data.records.length} client
                {summaryQ.data.records.length !== 1 ? 's' : ''}
              </p>
            )}
          </CardContent>
        </Card>
      )}
    </div>
  );
}
