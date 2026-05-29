import { useMemo } from 'react';
import { toast } from 'sonner';
import {
  useStandardVsForecastSummary,
  useStandardForecastVarianceList,
  exportStandardVsForecastCsv,
  exportStandardVsForecastPdf,
  exportStandardVsForecastVarianceCsv,
} from '../../api/standardForecast';
import { getErrorMessage } from '../../utils/api';
import { Card, CardContent, CardHeader, CardTitle } from '../../ui/card';
import { Button } from '../../ui/button';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '../../ui/table';
import { LoadingScreen } from '../../ui/LoadingSpinner';
import { Download, FileSpreadsheet } from 'lucide-react';
import { cn } from '../../lib/utils';
import {
  formatDate,
  makeVarianceRowClass,
  makeDiffCell,
  TypePill,
  STANDARD_VS_FORECAST_VARIANCE_COLUMNS,
  VARIANCE_DIFF_KEYS,
  VarianceColumnHeaders,
  VarianceDataCells,
  varianceColSpan,
} from '../varianceUI';

const SVF_VARIANCE_CELL_OPTS = { timeOnly: true };

const SECTIONS = [
  { id: 'summary', label: 'Summary' },
  { id: 'variance', label: 'Variance' },
];

const VARIANCE_TABS = [
  { id: 'all', label: 'All', countKey: 'allCount' },
  { id: 'deleted', label: 'Deleted Shifts', countKey: 'deletedCount' },
  { id: 'additional', label: 'Additional Shifts', countKey: 'additionalCount' },
  { id: 'variance', label: 'Variance', countKey: 'varianceCount' },
];

const varianceRowClass = makeVarianceRowClass('standard');
const diffCell = makeDiffCell('forecast', VARIANCE_DIFF_KEYS);

function formatMoney(v) {
  if (v == null || v === '') return '—';
  const n = typeof v === 'number' ? v : Number(v);
  return Number.isFinite(n) ? n.toFixed(2) : '—';
}

function summaryVarianceClass(v) {
  if (v > 0) return 'text-red-600';
  if (v < 0) return 'text-green-600';
  return '';
}

function scopeDateQuery(dateFrom, dateTo) {
  const q = {};
  if (dateFrom) q.dateFrom = dateFrom;
  if (dateTo) q.dateTo = dateTo;
  return q;
}

export function StandardVsForecastSection({
  locationId,
  client,
  dateFrom = '',
  dateTo = '',
  section,
  onSectionChange,
  page,
  onPageChange,
  varianceTab,
  onVarianceTabChange,
}) {

  const summaryParams = useMemo(
    () => ({ locationId, client, ...scopeDateQuery(dateFrom, dateTo) }),
    [locationId, client, dateFrom, dateTo]
  );
  const varianceParams = useMemo(
    () => ({
      locationId,
      client,
      tab: varianceTab,
      page,
      ...scopeDateQuery(dateFrom, dateTo),
    }),
    [locationId, client, varianceTab, page, dateFrom, dateTo]
  );

  const summaryQ = useStandardVsForecastSummary(summaryParams, Boolean(locationId) && section === 'summary');
  const varianceQ = useStandardForecastVarianceList(varianceParams, section === 'variance');

  const exportBase = { locationId, client, ...scopeDateQuery(dateFrom, dateTo) };

  const periodSource = section === 'summary' ? summaryQ.data : varianceQ.data;
  const periodLabel =
    periodSource?.forecastDateRangeStart && periodSource?.forecastDateRangeEnd
      ? `Forecast period: ${formatDate(periodSource.forecastDateRangeStart)} – ${formatDate(periodSource.forecastDateRangeEnd)}`
      : 'No forecast data available';

  return (
    <div className="space-y-4">
      <p className="text-sm text-muted-foreground">{periodLabel}</p>

      <div className="flex flex-wrap gap-2 border-b pb-2">
        {SECTIONS.map((s) => (
          <Button
            key={s.id}
            type="button"
            variant={section === s.id ? 'default' : 'outline'}
            size="sm"
            onClick={() => {
              onSectionChange(s.id);
              onPageChange(1);
            }}
          >
            {s.label}
          </Button>
        ))}
      </div>

          {section === 'summary' && (
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
                                  className={`text-right font-mono text-xs ${summaryVarianceClass(r.variance)}`}
                                >
                                  {formatMoney(r.variance)}
                                </TableCell>
                                <TableCell
                                  className={`text-right font-mono text-xs ${summaryVarianceClass(r.variance)}`}
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
                                  className={`text-right font-mono text-xs ${summaryVarianceClass(summaryQ.data.totals.variance)}`}
                                >
                                  {formatMoney(summaryQ.data.totals.variance)}
                                </TableCell>
                                <TableCell
                                  className={`text-right font-mono text-xs ${summaryVarianceClass(summaryQ.data.totals.variance)}`}
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

          {section === 'variance' && (
            <Card>
              <CardHeader className="flex flex-row flex-wrap items-center justify-between gap-2">
                <CardTitle>Template-level variance</CardTitle>
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={() =>
                    exportStandardVsForecastVarianceCsv(exportBase).catch((e) =>
                      toast.error(getErrorMessage(e))
                    )
                  }
                >
                  <Download className="mr-2 h-4 w-4" />
                  Export CSV
                </Button>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="border-b border-border">
                  <nav className="-mb-px flex flex-wrap gap-x-6">
                    {VARIANCE_TABS.map((t) => {
                      const active = varianceTab === t.id;
                      const count = varianceQ.data?.[t.countKey];
                      return (
                        <button
                          key={t.id}
                          type="button"
                          onClick={() => {
                            onVarianceTabChange(t.id);
                            onPageChange(1);
                          }}
                          className={cn(
                            'border-b-2 py-2 px-1 text-sm font-medium transition-colors',
                            active
                              ? 'border-primary text-primary'
                              : 'border-transparent text-muted-foreground hover:text-foreground hover:border-border'
                          )}
                        >
                          {t.label}
                          {count != null && (
                            <span
                              className={cn(
                                'ml-2 rounded-full px-2 py-0.5 text-xs',
                                active
                                  ? 'bg-primary text-primary-foreground'
                                  : 'bg-muted text-muted-foreground'
                              )}
                            >
                              {count}
                            </span>
                          )}
                        </button>
                      );
                    })}
                  </nav>
                </div>
                {varianceQ.isLoading ? (
                  <LoadingScreen message="Loading variance…" />
                ) : varianceQ.error ? (
                  <p className="text-destructive">{getErrorMessage(varianceQ.error)}</p>
                ) : (
                  <>
                    <p className="text-xs text-muted-foreground">
                      Forecast period: {formatDate(varianceQ.data?.forecastDateRangeStart)} –{' '}
                      {formatDate(varianceQ.data?.forecastDateRangeEnd)}
                    </p>
                    {(varianceTab === 'all' || varianceTab === 'variance') && (
                      <div className="flex flex-wrap items-center justify-between gap-2 text-sm">
                        <div className="flex flex-wrap items-center gap-3">
                          <span className="text-muted-foreground">Legend:</span>
                          {varianceTab === 'all' && (
                            <>
                              <span className="inline-flex items-center gap-1.5">
                                <span className="inline-block h-3.5 w-3.5 rounded border border-red-200 bg-red-50" />
                                Deleted
                              </span>
                              <span className="inline-flex items-center gap-1.5">
                                <span className="inline-block h-3.5 w-3.5 rounded border border-sky-200 bg-sky-50" />
                                Additional
                              </span>
                            </>
                          )}
                          <span className="inline-flex items-center gap-1.5">
                            <span className="inline-block h-3.5 w-3.5 rounded border border-blue-200 bg-blue-50" />
                            Standard
                          </span>
                          <span className="inline-flex items-center gap-1.5">
                            <span className="inline-block h-3.5 w-3.5 rounded border border-green-200 bg-green-50" />
                            Forecast
                          </span>
                          <span className="inline-flex items-center gap-1.5">
                            <span className="inline-block h-3.5 w-3.5 rounded border border-yellow-300 bg-yellow-200" />
                            Difference
                          </span>
                        </div>
                      </div>
                    )}
                    <div className="rounded-md border overflow-x-auto">
                      <Table>
                        <TableHeader>
                          <TableRow>
                            <VarianceColumnHeaders
                              showType={varianceTab === 'all'}
                              columns={STANDARD_VS_FORECAST_VARIANCE_COLUMNS}
                            />
                          </TableRow>
                        </TableHeader>
                        <TableBody>
                          {(varianceQ.data?.records || []).length === 0 ? (
                            <TableRow>
                              <TableCell
                                colSpan={varianceColSpan(
                                  varianceTab === 'all',
                                  STANDARD_VS_FORECAST_VARIANCE_COLUMNS
                                )}
                                className="text-center text-muted-foreground py-8"
                              >
                                {varianceTab === 'deleted'
                                  ? 'No deleted templates. Every standard template has forecast occurrences.'
                                  : varianceTab === 'additional'
                                    ? 'No additional buckets. Every forecast bucket matches a standard template.'
                                    : varianceTab === 'variance'
                                      ? 'No variance found. All matched templates agree with their forecast totals.'
                                      : 'No records found. Upload standard and forecast data to see variance analysis.'}
                              </TableCell>
                            </TableRow>
                          ) : (
                            (varianceQ.data?.records || []).map((r, idx) => (
                              <TableRow
                                key={`${r.shiftcareId || r.templateKey}-${idx}-${r.source || ''}`}
                                className={varianceRowClass(r)}
                              >
                                {varianceTab === 'all' && (
                                  <TableCell className="whitespace-nowrap">
                                    {r.source === 'standard' || r.recordType !== 'variance' ? (
                                      <TypePill recordType={r.recordType} />
                                    ) : null}
                                  </TableCell>
                                )}
                                <VarianceDataCells
                                  row={r}
                                  diffCell={diffCell}
                                  timeOnly
                                  columns={STANDARD_VS_FORECAST_VARIANCE_COLUMNS}
                                />
                              </TableRow>
                            ))
                          )}
                        </TableBody>
                      </Table>
                    </div>
                    <div className="flex items-center justify-between text-sm">
                      <span>
                        {varianceQ.data?.startIndex != null && varianceQ.data?.endIndex != null
                          ? `Showing ${varianceQ.data.startIndex}–${varianceQ.data.endIndex} of ${varianceQ.data.total} ${
                              varianceTab === 'variance' || varianceTab === 'all' ? 'pairs' : 'records'
                            }`
                          : ''}
                      </span>
                      <div className="flex gap-2">
                        <Button
                          type="button"
                          variant="outline"
                          size="sm"
                          disabled={!varianceQ.data?.hasPrev}
                          onClick={() => onPageChange(Math.max(1, page - 1))}
                        >
                          Previous
                        </Button>
                        <Button
                          type="button"
                          variant="outline"
                          size="sm"
                          disabled={!varianceQ.data?.hasNext}
                          onClick={() => onPageChange(page + 1)}
                        >
                          Next
                        </Button>
                      </div>
                    </div>
                  </>
                )}
              </CardContent>
            </Card>
          )}
    </div>
  );
}
