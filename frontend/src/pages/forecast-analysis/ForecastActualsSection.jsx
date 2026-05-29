import { Fragment, useMemo, useState } from 'react';
import { useDropzone } from 'react-dropzone';
import { toast } from 'sonner';
import {
  useForecastList,
  useActualsList,
  useForecastSummary,
  useVarianceList,
  useVarianceDetail,
  useUploadForecast,
  useUploadActuals,
  exportForecastCsv,
  exportActualsCsv,
  exportSummaryCsv,
  exportSummaryPdf,
  exportVarianceCsv,
} from '../../api/forecastActuals';
import { getErrorMessage } from '../../utils/api';
import { validateCsvFile, CSV_ACCEPT } from '../../config/upload';
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
import { cn } from '../../lib/utils';
import { ChevronRight, Download, FileSpreadsheet } from 'lucide-react';
import { ForecastActualsRowPanel } from '../ForecastActualsRowPanel';
import {
  formatDate,
  formatDt,
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
} from '../varianceUI';

const SECTIONS = [
  { id: 'forecast', label: 'Forecast' },
  { id: 'actuals', label: 'Actuals' },
  { id: 'summary', label: 'Summary' },
  { id: 'variance', label: 'Variance' },
];

const VARIANCE_TABS = [
  { id: 'all', label: 'All', countKey: 'allCount' },
  { id: 'deleted', label: 'Deleted Shifts', countKey: 'deletedCount' },
  { id: 'additional', label: 'Additional Shifts', countKey: 'additionalCount' },
  { id: 'variance', label: 'Variance', countKey: 'varianceCount' },
];

const varianceRowClass = makeVarianceRowClass('forecast');
const diffCell = makeDiffCell('actuals', VARIANCE_DIFF_KEYS);
const diffActualCell = diffPanelCell;

function variancePairKey(r) {
  return r?.variancePairKey || r?.shiftcareId;
}

function VarianceDetailPanel({ data }) {
  const diff = data.diffFields || [];
  const fAgg = data.forecastAggregated;
  const aAgg = data.actualsAggregated;
  return (
    <div className="space-y-3">
      <div className="grid gap-4 lg:grid-cols-2">
        <div>
          <h4 className="mb-2 flex items-center gap-2 text-sm font-semibold text-blue-700">
            <span className="inline-block h-3 w-3 rounded border border-blue-300 bg-blue-100" />
            Forecast Records ({(data.forecastRecords || []).length})
          </h4>
          {(data.forecastRecords || []).length ? (
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
                  {data.forecastRecords.map((fr) => (
                    <tr key={fr.id}>
                      {VARIANCE_COLUMNS.map((col) => (
                        <td
                          key={col.key}
                          className={cn(
                            'px-2 py-1.5',
                            col.align === 'right' ? 'text-right' : '',
                            col.key === 'shiftcareId' && 'font-mono'
                          )}
                        >
                          {varianceCellValue(fr, col.key)}
                        </td>
                      ))}
                    </tr>
                  ))}
                </tbody>
                {fAgg && (
                  <tfoot className="bg-blue-100 font-medium text-blue-800">
                    <tr>
                      <td colSpan={4} className="px-2 py-1.5">
                        Aggregated total
                      </td>
                      <td className="px-2 py-1.5 text-right">{fmtNum(fAgg.duration)}</td>
                      <td className="px-2 py-1.5 text-right">{fmtMoney(fAgg.totalCost)}</td>
                      <td colSpan={4} />
                    </tr>
                  </tfoot>
                )}
              </table>
            </div>
          ) : (
            <p className="text-sm italic text-muted-foreground">No forecast records found.</p>
          )}
        </div>
        <div>
          <h4 className="mb-2 flex items-center gap-2 text-sm font-semibold text-green-700">
            <span className="inline-block h-3 w-3 rounded border border-green-300 bg-green-100" />
            Actuals Records ({(data.actualsRecords || []).length})
          </h4>
          {(data.actualsRecords || []).length ? (
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
                  {data.actualsRecords.map((ar) => (
                    <tr key={ar.id}>
                      {VARIANCE_COLUMNS.map((col) => {
                        const diffKey = VARIANCE_DIFF_KEYS[col.key];
                        return (
                          <td
                            key={col.key}
                            className={cn(
                              'px-2 py-1.5',
                              col.align === 'right' ? 'text-right' : '',
                              col.key === 'shiftcareId' && 'font-mono',
                              diffActualCell(diff, diffKey)
                            )}
                          >
                            {varianceCellValue(ar, col.key)}
                          </td>
                        );
                      })}
                    </tr>
                  ))}
                </tbody>
                {aAgg && (
                  <tfoot className="bg-green-100 font-medium text-green-800">
                    <tr>
                      <td colSpan={4} className="px-2 py-1.5">
                        Aggregated total
                      </td>
                      <td className={cn('px-2 py-1.5 text-right', diff.includes('duration') && 'bg-yellow-200')}>
                        {fmtNum(aAgg.duration)}
                      </td>
                      <td className={cn('px-2 py-1.5 text-right', diff.includes('total_cost') && 'bg-yellow-200')}>
                        {fmtMoney(aAgg.totalCost)}
                      </td>
                      <td colSpan={4} />
                    </tr>
                  </tfoot>
                )}
              </table>
            </div>
          ) : (
            <p className="text-sm italic text-muted-foreground">No actuals records found.</p>
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

export function ForecastActualsSection({
  locationId,
  staff,
  client,
  directory,
  section,
  onSectionChange,
  page,
  onPageChange,
  varianceTab,
  onVarianceTabChange,
  expandedSid,
  onExpandedSidChange,
}) {

  const listParams = useMemo(
    () => ({ locationId, staff, client, page }),
    [locationId, staff, client, page]
  );
  const summaryParams = useMemo(() => ({ locationId, staff, client }), [locationId, staff, client]);
  const varianceParams = useMemo(
    () => ({ locationId, staff, client, tab: varianceTab, page }),
    [locationId, staff, client, varianceTab, page]
  );

  const forecastQ = useForecastList(listParams, section === 'forecast');
  const actualsQ = useActualsList(listParams, section === 'actuals');
  const summaryQ = useForecastSummary(summaryParams, section === 'summary');
  const varianceQ = useVarianceList(varianceParams, section === 'variance');
  const detailQ = useVarianceDetail(locationId, expandedSid, Boolean(expandedSid && section === 'variance'));

  const uploadForecastM = useUploadForecast();
  const uploadActualsM = useUploadActuals();

  const onDropForecast = async (files) => {
    const f = files?.[0];
    if (!f || !locationId) return;
    const validation = validateCsvFile(f);
    if (!validation.valid) {
      toast.error(validation.error);
      return;
    }
    try {
      const res = await uploadForecastM.mutateAsync({ locationId, file: f });
      toast.success(`Forecast upload: ${res.recordsCreated} rows created`);
    } catch (e) {
      toast.error(getErrorMessage(e));
    }
  };

  const onDropActuals = async (files) => {
    const f = files?.[0];
    if (!f || !locationId) return;
    const validation = validateCsvFile(f);
    if (!validation.valid) {
      toast.error(validation.error);
      return;
    }
    try {
      const res = await uploadActualsM.mutateAsync({ locationId, file: f });
      toast.success(`Actuals upload: ${res.recordsCreated} rows created`);
    } catch (e) {
      toast.error(getErrorMessage(e));
    }
  };

  const fzForecast = useDropzone({
    onDrop: onDropForecast,
    accept: CSV_ACCEPT,
    multiple: false,
    disabled: !locationId || uploadForecastM.isPending,
  });
  const fzActuals = useDropzone({
    onDrop: onDropActuals,
    accept: CSV_ACCEPT,
    multiple: false,
    disabled: !locationId || uploadActualsM.isPending,
  });

  const exportBase = { locationId, staff, client };

  const selectableClients = useMemo(
    () => (directory?.clients ?? []).filter((c) => c.value !== 'all'),
    [directory?.clients]
  );
  const selectableStaff = useMemo(
    () => (directory?.staff ?? []).filter((s) => s.value !== 'all'),
    [directory?.staff]
  );

  return (
    <div className="space-y-4">
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
              onExpandedSidChange(null);
            }}
          >
            {s.label}
          </Button>
        ))}
      </div>

          {section === 'forecast' && (
            <Card>
              <CardHeader>
                <CardTitle>Forecast data</CardTitle>
              </CardHeader>
              <CardContent>
                <ForecastActualsRowPanel
                  variant="forecast"
                  title="Forecast"
                  locationId={locationId}
                  selectableClients={selectableClients}
                  selectableStaff={selectableStaff}
                  listData={forecastQ.data}
                  listLoading={forecastQ.isLoading}
                  listError={forecastQ.error}
                  dropzone={fzForecast}
                  onExport={() => exportForecastCsv(exportBase).catch((e) => toast.error(getErrorMessage(e)))}
                  page={page}
                  setPage={onPageChange}
                />
              </CardContent>
            </Card>
          )}

          {section === 'actuals' && (
            <Card>
              <CardHeader>
                <CardTitle>Actuals data</CardTitle>
              </CardHeader>
              <CardContent>
                <ForecastActualsRowPanel
                  variant="actuals"
                  title="Actuals"
                  locationId={locationId}
                  selectableClients={selectableClients}
                  selectableStaff={selectableStaff}
                  listData={actualsQ.data}
                  listLoading={actualsQ.isLoading}
                  listError={actualsQ.error}
                  dropzone={fzActuals}
                  onExport={() => exportActualsCsv(exportBase).catch((e) => toast.error(getErrorMessage(e)))}
                  page={page}
                  setPage={onPageChange}
                />
              </CardContent>
            </Card>
          )}

          {section === 'summary' && (
            <Card>
              <CardHeader className="flex flex-row flex-wrap items-center justify-between gap-2">
                <CardTitle>Summary by client</CardTitle>
                <div className="flex flex-wrap gap-2">
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    onClick={() => exportSummaryCsv(exportBase).catch((e) => toast.error(getErrorMessage(e)))}
                  >
                    <FileSpreadsheet className="mr-2 h-4 w-4" />
                    CSV
                  </Button>
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    onClick={() => exportSummaryPdf(exportBase).catch((e) => toast.error(getErrorMessage(e)))}
                  >
                    <Download className="mr-2 h-4 w-4" />
                    PDF
                  </Button>
                </div>
              </CardHeader>
              <CardContent>
                {summaryQ.isLoading ? (
                  <LoadingScreen message="Loading summary…" />
                ) : summaryQ.error ? (
                  <p className="text-destructive">{getErrorMessage(summaryQ.error)}</p>
                ) : (
                  <>
                    <p className="mb-2 text-xs text-muted-foreground">
                      Forecast: {formatDate(summaryQ.data?.forecastDateRangeStart)} –{' '}
                      {formatDate(summaryQ.data?.forecastDateRangeEnd)} · Actuals:{' '}
                      {formatDate(summaryQ.data?.actualsDateRangeStart)} –{' '}
                      {formatDate(summaryQ.data?.actualsDateRangeEnd)}
                    </p>
                    <div className="rounded-md border overflow-x-auto">
                      <Table>
                        <TableHeader>
                          <TableRow>
                            <TableHead>Client</TableHead>
                            <TableHead className="text-right">Forecast</TableHead>
                            <TableHead className="text-right">Net actuals</TableHead>
                            <TableHead className="text-right">Mileage</TableHead>
                            <TableHead className="text-right">Gross</TableHead>
                            <TableHead className="text-right">Variance</TableHead>
                            <TableHead className="text-right">Var %</TableHead>
                          </TableRow>
                        </TableHeader>
                        <TableBody>
                          {(summaryQ.data?.records || []).map((r, ri) => (
                            <TableRow key={r.clientId ?? r.clientName ?? `summary-${ri}`}>
                              <TableCell>{r.clientName}</TableCell>
                              <TableCell className="text-right">{r.forecastBudget?.toFixed(2)}</TableCell>
                              <TableCell className="text-right">{r.netActuals?.toFixed(2)}</TableCell>
                              <TableCell className="text-right">{r.mileage?.toFixed(2)}</TableCell>
                              <TableCell className="text-right">{r.grossActuals?.toFixed(2)}</TableCell>
                              <TableCell className="text-right">{r.variance?.toFixed(2)}</TableCell>
                              <TableCell className="text-right">
                                {r.variancePercentage != null ? `${r.variancePercentage.toFixed(2)}%` : '—'}
                              </TableCell>
                            </TableRow>
                          ))}
                          {summaryQ.data?.totals && (
                            <TableRow key="summary-totals" className="bg-muted/50 font-medium">
                              <TableCell>{summaryQ.data.totals.clientName}</TableCell>
                              <TableCell className="text-right">
                                {summaryQ.data.totals.forecastBudget?.toFixed(2)}
                              </TableCell>
                              <TableCell className="text-right">
                                {summaryQ.data.totals.netActuals?.toFixed(2)}
                              </TableCell>
                              <TableCell className="text-right">
                                {summaryQ.data.totals.mileage?.toFixed(2)}
                              </TableCell>
                              <TableCell className="text-right">
                                {summaryQ.data.totals.grossActuals?.toFixed(2)}
                              </TableCell>
                              <TableCell className="text-right">
                                {summaryQ.data.totals.variance?.toFixed(2)}
                              </TableCell>
                              <TableCell className="text-right">
                                {summaryQ.data.totals.variancePercentage != null
                                  ? `${summaryQ.data.totals.variancePercentage.toFixed(2)}%`
                                  : '—'}
                              </TableCell>
                            </TableRow>
                          )}
                        </TableBody>
                      </Table>
                    </div>
                  </>
                )}
              </CardContent>
            </Card>
          )}

          {section === 'variance' && (
            <Card>
              <CardHeader className="flex flex-row flex-wrap items-center justify-between gap-2">
                <CardTitle>Variance by Shift ID</CardTitle>
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={() => exportVarianceCsv(exportBase).catch((e) => toast.error(getErrorMessage(e)))}
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
                            onExpandedSidChange(null);
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
                      Forecast: {formatDate(varianceQ.data?.forecastDateRangeStart)} –{' '}
                      {formatDate(varianceQ.data?.forecastDateRangeEnd)} · Actuals:{' '}
                      {formatDate(varianceQ.data?.actualsDateRangeStart)} –{' '}
                      {formatDate(varianceQ.data?.actualsDateRangeEnd)}
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
                            Forecast
                          </span>
                          <span className="inline-flex items-center gap-1.5">
                            <span className="inline-block h-3.5 w-3.5 rounded border border-green-200 bg-green-50" />
                            Actuals
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
                                  ? 'No deleted shifts. All forecast shifts are present in actuals.'
                                  : varianceTab === 'additional'
                                    ? 'No additional shifts. All actuals shifts are present in forecast.'
                                    : varianceTab === 'variance'
                                      ? 'No variance found. All matching shifts have the same cost values.'
                                      : 'No records found. Upload forecast and actuals data to see variance analysis.'}
                              </TableCell>
                            </TableRow>
                          ) : (
                            (varianceQ.data?.records || []).map((r, idx, arr) => {
                              const pairKey = variancePairKey(r);
                              const open = expandedSid === pairKey && r.recordType === 'variance';
                              const isClickable = r.recordType === 'variance';
                              const isLastOfPair =
                                expandedSid === pairKey &&
                                r.recordType === 'variance' &&
                                (idx === arr.length - 1 || variancePairKey(arr[idx + 1]) !== pairKey);
                              return (
                                <Fragment key={`${pairKey}-${idx}-${r.source || ''}`}>
                                  <TableRow
                                    className={varianceRowClass(r)}
                                    onClick={
                                      isClickable
                                        ? () =>
                                            onExpandedSidChange(expandedSid === pairKey ? null : pairKey)
                                        : undefined
                                    }
                                  >
                                    {varianceTab === 'all' && (
                                      <TableCell className="whitespace-nowrap">
                                        {r.source === 'forecast' || r.recordType !== 'variance' ? (
                                          <TypePill recordType={r.recordType} />
                                        ) : null}
                                      </TableCell>
                                    )}
                                    <VarianceDataCells
                                      row={r}
                                      diffCell={diffCell}
                                      shiftIdPrefix={
                                        r.recordType === 'variance' && r.source === 'forecast' ? (
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
                                          <VarianceDetailPanel data={detailQ.data} />
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
