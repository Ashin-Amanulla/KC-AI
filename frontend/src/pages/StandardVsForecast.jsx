import { Fragment, useMemo, useState } from 'react';
import { toast } from 'sonner';
import {
  useStandardDirectory,
  useStandardVsForecastSummary,
  useStandardForecastVarianceList,
  useStandardForecastVarianceDetail,
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
import { ChevronRight, Download, FileSpreadsheet } from 'lucide-react';
import { cn } from '../lib/utils';
import {
  formatDate,
  fmtMoney,
  fmtNum,
  makeVarianceRowClass,
  makeDiffCell,
  diffPanelCell,
  TypePill,
  VARIANCE_COLUMNS,
  VARIANCE_DIFF_KEYS,
  VARIANCE_DIFF_LABELS,
  VarianceColumnHeaders,
  VarianceDataCells,
  varianceColSpan,
  varianceCellValue,
} from './varianceUI';

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

function StandardVarianceDetailPanel({ data }) {
  const diff = data.diffFields || [];
  const sAgg = data.standardAggregated;
  const fAgg = data.forecastAggregated;
  const standardRecords = data.standardRecords || [];
  const forecastRecords = data.forecastRecords || [];

  const standardRows =
    standardRecords.length > 0
      ? standardRecords
      : sAgg
        ? [{ id: 'agg-standard', ...sAgg, totalCost: sAgg.totalCost }]
        : [];

  return (
    <div className="space-y-3">
      <div className="text-sm font-semibold text-foreground">
        {sAgg?.clientName || fAgg?.clientName || 'Template'} · {sAgg?.day || fAgg?.day || '—'} ·{' '}
        {sAgg?.startTime || fAgg?.startTime || '—'}–{sAgg?.endTime || fAgg?.endTime || '—'}
      </div>
      <div className="grid gap-4 lg:grid-cols-2">
        <div>
          <h4 className="mb-2 flex items-center gap-2 text-sm font-semibold text-blue-700">
            <span className="inline-block h-3 w-3 rounded border border-blue-300 bg-blue-100" />
            Standard template ({standardRows.length})
          </h4>
          {standardRows.length ? (
            <div className="overflow-x-auto rounded border border-blue-200">
              <table className="w-full text-xs">
                <thead className="bg-blue-50 text-blue-700">
                  <tr>
                    {VARIANCE_COLUMNS.map((col) => (
                      <th
                        key={col.key}
                        className={cn(
                          'px-2 py-1.5 font-medium',
                          col.align === 'right' ? 'text-right' : 'text-left'
                        )}
                      >
                        {col.label}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody className="bg-background divide-y divide-blue-100">
                  {standardRows.map((sr) => (
                    <tr key={sr.id}>
                      {VARIANCE_COLUMNS.map((col) => (
                        <td
                          key={col.key}
                          className={cn(
                            'px-2 py-1.5',
                            col.align === 'right' ? 'text-right' : '',
                            col.key === 'shiftcareId' && 'font-mono'
                          )}
                        >
                          {varianceCellValue(
                            {
                              ...sr,
                              shiftDate: sr.shiftDate ?? null,
                              shiftcareId: sr.shiftcareId || data.templateKey,
                              totalCost:
                                col.key === 'totalCost' && data.dayCount
                                  ? (sr.totalCost || 0) * data.dayCount
                                  : sr.totalCost,
                            },
                            col.key
                          )}
                        </td>
                      ))}
                    </tr>
                  ))}
                </tbody>
                {sAgg && data.dayCount > 0 && (
                  <tfoot className="bg-blue-100 font-medium text-blue-800">
                    <tr>
                      <td colSpan={4} className="px-2 py-1.5">
                        Standard total ({data.dayCount} day{data.dayCount === 1 ? '' : 's'})
                      </td>
                      <td className="px-2 py-1.5 text-right">{fmtNum(sAgg.duration)}</td>
                      <td className="px-2 py-1.5 text-right">{fmtMoney(sAgg.totalCost)}</td>
                      <td colSpan={4} />
                    </tr>
                  </tfoot>
                )}
              </table>
            </div>
          ) : (
            <p className="text-sm italic text-muted-foreground">No standard template found.</p>
          )}
        </div>
        <div>
          <h4 className="mb-2 flex items-center gap-2 text-sm font-semibold text-green-700">
            <span className="inline-block h-3 w-3 rounded border border-green-300 bg-green-100" />
            Forecast occurrences ({forecastRecords.length})
          </h4>
          {forecastRecords.length ? (
            <div className="overflow-x-auto rounded border border-green-200">
              <table className="w-full text-xs">
                <thead className="bg-green-50 text-green-700">
                  <tr>
                    {VARIANCE_COLUMNS.map((col) => (
                      <th
                        key={col.key}
                        className={cn(
                          'px-2 py-1.5 font-medium',
                          col.align === 'right' ? 'text-right' : 'text-left'
                        )}
                      >
                        {col.label}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody className="bg-background divide-y divide-green-100">
                  {forecastRecords.map((fr) => (
                    <tr key={fr.id}>
                      {VARIANCE_COLUMNS.map((col) => {
                        const diffKey = VARIANCE_DIFF_KEYS[col.key];
                        return (
                          <td
                            key={col.key}
                            className={cn(
                              'px-2 py-1.5',
                              col.align === 'right' ? 'text-right' : '',
                              col.key === 'shiftcareId' && 'font-mono',
                              diffPanelCell(diff, diffKey)
                            )}
                          >
                            {varianceCellValue(
                              { ...fr, shiftcareId: fr.shiftcareId || data.templateKey },
                              col.key
                            )}
                          </td>
                        );
                      })}
                    </tr>
                  ))}
                </tbody>
                {fAgg && (
                  <tfoot className="bg-green-100 font-medium text-green-800">
                    <tr>
                      <td colSpan={4} className="px-2 py-1.5">
                        Aggregated total
                      </td>
                      <td className={cn('px-2 py-1.5 text-right', diff.includes('duration') && 'bg-yellow-200')}>
                        {fmtNum(fAgg.duration)}
                      </td>
                      <td className={cn('px-2 py-1.5 text-right', diff.includes('total_cost') && 'bg-yellow-200')}>
                        {fmtMoney(fAgg.totalCost)}
                      </td>
                      <td colSpan={4} />
                    </tr>
                  </tfoot>
                )}
              </table>
            </div>
          ) : (
            <p className="text-sm italic text-muted-foreground">No forecast occurrences found.</p>
          )}
        </div>
      </div>
      {diff.length > 0 && (
        <div className="rounded border border-yellow-200 bg-yellow-50 p-2 text-xs">
          <span className="font-medium text-yellow-800">Differences found in:</span>{' '}
          <span className="text-yellow-700">
            {diff.map((f) => VARIANCE_DIFF_LABELS[f] || f).join(', ')}
          </span>
        </div>
      )}
    </div>
  );
}

export function StandardVsForecast() {
  const { data: locData, isLoading: locLoading } = useLocations();
  const locations = locData?.locations ?? [];
  const [locationId, setLocationId] = useState('');
  const [client, setClient] = useState('all');
  const [section, setSection] = useState('summary');
  const [page, setPage] = useState(1);
  const [varianceTab, setVarianceTab] = useState('all');
  const [expandedKey, setExpandedKey] = useState(null);

  const summaryParams = useMemo(() => ({ locationId, client }), [locationId, client]);
  const varianceParams = useMemo(
    () => ({ locationId, client, tab: varianceTab, page }),
    [locationId, client, varianceTab, page]
  );

  const { data: directory, isLoading: dirLoading } = useStandardDirectory(Boolean(locationId));
  const summaryQ = useStandardVsForecastSummary(summaryParams, Boolean(locationId) && section === 'summary');
  const varianceQ = useStandardForecastVarianceList(varianceParams, section === 'variance');
  const detailQ = useStandardForecastVarianceDetail(
    locationId,
    expandedKey,
    Boolean(expandedKey && section === 'variance')
  );

  const clientOptions = directory?.clients || [{ value: 'all', label: 'All Clients' }];
  const exportBase = { locationId, client };

  const periodSource = section === 'summary' ? summaryQ.data : varianceQ.data;
  const periodLabel =
    periodSource?.forecastDateRangeStart && periodSource?.forecastDateRangeEnd
      ? `Forecast period: ${formatDate(periodSource.forecastDateRangeStart)} – ${formatDate(periodSource.forecastDateRangeEnd)}`
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
                  setPage(1);
                  setExpandedKey(null);
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
              onChange={(e) => {
                setClient(e.target.value);
                setPage(1);
                setExpandedKey(null);
              }}
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
        <>
          <div className="flex flex-wrap gap-2 border-b pb-2">
            {SECTIONS.map((s) => (
              <Button
                key={s.id}
                type="button"
                variant={section === s.id ? 'default' : 'outline'}
                size="sm"
                onClick={() => {
                  setSection(s.id);
                  setPage(1);
                  setExpandedKey(null);
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
              <CardHeader>
                <CardTitle>Template-level variance</CardTitle>
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
                            setVarianceTab(t.id);
                            setPage(1);
                            setExpandedKey(null);
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
                        <span className="text-xs italic text-muted-foreground">
                          Click any variance pair to see individual records
                        </span>
                      </div>
                    )}
                    <div className="rounded-md border overflow-x-auto">
                      <Table>
                        <TableHeader>
                          <TableRow>
                            <VarianceColumnHeaders showType={varianceTab === 'all'} />
                          </TableRow>
                        </TableHeader>
                        <TableBody>
                          {(varianceQ.data?.records || []).length === 0 ? (
                            <TableRow>
                              <TableCell
                                colSpan={varianceColSpan(varianceTab === 'all')}
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
                            (varianceQ.data?.records || []).map((r, idx, arr) => {
                              const rowKey = r.shiftcareId || r.templateKey;
                              const open = expandedKey === rowKey && r.recordType === 'variance';
                              const isClickable = r.recordType === 'variance';
                              const isLastOfPair =
                                expandedKey === rowKey &&
                                r.recordType === 'variance' &&
                                (idx === arr.length - 1 ||
                                  (arr[idx + 1].shiftcareId || arr[idx + 1].templateKey) !== rowKey);
                              return (
                                <Fragment key={`${rowKey}-${idx}-${r.source || ''}`}>
                                  <TableRow
                                    className={varianceRowClass(r)}
                                    onClick={
                                      isClickable
                                        ? () =>
                                            setExpandedKey(expandedKey === rowKey ? null : rowKey)
                                        : undefined
                                    }
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
                                      shiftIdPrefix={
                                        r.recordType === 'variance' && r.source === 'standard' ? (
                                          <ChevronRight
                                            className={cn(
                                              'h-4 w-4 shrink-0 text-muted-foreground transition-transform',
                                              open && 'rotate-90'
                                            )}
                                          />
                                        ) : null
                                      }
                                    />
                                  </TableRow>
                                  {isLastOfPair && (
                                    <TableRow>
                                      <TableCell
                                        colSpan={varianceColSpan(varianceTab === 'all')}
                                        className="bg-muted/10 p-4 align-top"
                                      >
                                        {detailQ.isLoading ? (
                                          <LoadingScreen message="Loading detail…" />
                                        ) : detailQ.data ? (
                                          <StandardVarianceDetailPanel data={detailQ.data} />
                                        ) : null}
                                      </TableCell>
                                    </TableRow>
                                  )}
                                </Fragment>
                              );
                            })
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
                          onClick={() => setPage((p) => Math.max(1, p - 1))}
                        >
                          Previous
                        </Button>
                        <Button
                          type="button"
                          variant="outline"
                          size="sm"
                          disabled={!varianceQ.data?.hasNext}
                          onClick={() => setPage((p) => p + 1)}
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
        </>
      )}
    </div>
  );
}
