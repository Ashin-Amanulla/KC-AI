import { Fragment, useMemo, useState } from 'react';
import { useDropzone } from 'react-dropzone';
import { toast } from 'sonner';
import {
  useForecastDirectory,
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
} from '../api/forecastActuals';
import { useLocations } from '../api/locations';
import { getErrorMessage } from '../utils/api';
import { validateCsvFile, CSV_ACCEPT } from '../config/upload';
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
import { cn } from '../lib/utils';
import { ChevronRight, Download, FileSpreadsheet } from 'lucide-react';
import { ForecastActualsRowPanel } from './ForecastActualsRowPanel';
import {
  formatDate,
  formatDt,
  fmtMoney,
  fmtNum,
  makeVarianceRowClass,
  makeDiffCell,
  diffPanelCell,
  TypePill,
} from './varianceUI';

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

const DIFF_KEYS = {
  startDatetime: 'start_datetime',
  endDatetime: 'end_datetime',
  duration: 'duration',
  cost: 'cost',
  totalCost: 'total_cost',
  rateGroups: 'rate_groups',
  referenceNo: 'reference_no',
};

const varianceRowClass = makeVarianceRowClass('forecast');
const diffCell = makeDiffCell('actuals', DIFF_KEYS);
const diffActualCell = diffPanelCell;

const DIFF_LABEL = {
  start_datetime: 'Start',
  end_datetime: 'End',
  duration: 'Duration',
  cost: 'Cost',
  total_cost: 'Total Cost',
  rate_groups: 'Rate Group',
  reference_no: 'Ref No',
};

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
                    <th className="px-2 py-1.5 text-left font-medium">Staff</th>
                    <th className="px-2 py-1.5 text-left font-medium">Client</th>
                    <th className="px-2 py-1.5 text-left font-medium">Start</th>
                    <th className="px-2 py-1.5 text-left font-medium">End</th>
                    <th className="px-2 py-1.5 text-right font-medium">Duration</th>
                    <th className="px-2 py-1.5 text-right font-medium">Cost</th>
                    <th className="px-2 py-1.5 text-right font-medium">Total</th>
                  </tr>
                </thead>
                <tbody className="bg-background divide-y divide-blue-100">
                  {data.forecastRecords.map((fr) => (
                    <tr key={fr.id}>
                      <td className="px-2 py-1.5">{fr.staffName || '—'}</td>
                      <td className="px-2 py-1.5">{fr.clientName || '—'}</td>
                      <td className="px-2 py-1.5 whitespace-nowrap">{formatDt(fr.startDatetime)}</td>
                      <td className="px-2 py-1.5 whitespace-nowrap">{formatDt(fr.endDatetime)}</td>
                      <td className="px-2 py-1.5 text-right">{fmtNum(fr.duration)}</td>
                      <td className="px-2 py-1.5 text-right">{fmtMoney(fr.cost)}</td>
                      <td className="px-2 py-1.5 text-right">{fmtMoney(fr.totalCost)}</td>
                    </tr>
                  ))}
                </tbody>
                {fAgg && (
                  <tfoot className="bg-blue-100 font-medium text-blue-800">
                    <tr>
                      <td colSpan={4} className="px-2 py-1.5">Aggregated Total</td>
                      <td className="px-2 py-1.5 text-right">{fmtNum(fAgg.duration)}</td>
                      <td className="px-2 py-1.5 text-right">{fmtMoney(fAgg.cost)}</td>
                      <td className="px-2 py-1.5 text-right">{fmtMoney(fAgg.totalCost)}</td>
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
                    <th className="px-2 py-1.5 text-left font-medium">Staff</th>
                    <th className="px-2 py-1.5 text-left font-medium">Client</th>
                    <th className="px-2 py-1.5 text-left font-medium">Start</th>
                    <th className="px-2 py-1.5 text-left font-medium">End</th>
                    <th className="px-2 py-1.5 text-right font-medium">Duration</th>
                    <th className="px-2 py-1.5 text-right font-medium">Cost</th>
                    <th className="px-2 py-1.5 text-right font-medium">Total</th>
                  </tr>
                </thead>
                <tbody className="bg-background divide-y divide-green-100">
                  {data.actualsRecords.map((ar) => (
                    <tr key={ar.id}>
                      <td className="px-2 py-1.5">{ar.staffName || '—'}</td>
                      <td className="px-2 py-1.5">{ar.clientName || '—'}</td>
                      <td className={cn('px-2 py-1.5 whitespace-nowrap', diffActualCell(diff, 'start_datetime'))}>
                        {formatDt(ar.startDatetime)}
                      </td>
                      <td className={cn('px-2 py-1.5 whitespace-nowrap', diffActualCell(diff, 'end_datetime'))}>
                        {formatDt(ar.endDatetime)}
                      </td>
                      <td className={cn('px-2 py-1.5 text-right', diffActualCell(diff, 'duration'))}>
                        {fmtNum(ar.duration)}
                      </td>
                      <td className={cn('px-2 py-1.5 text-right', diffActualCell(diff, 'cost'))}>
                        {fmtMoney(ar.cost)}
                      </td>
                      <td className={cn('px-2 py-1.5 text-right', diffActualCell(diff, 'total_cost'))}>
                        {fmtMoney(ar.totalCost)}
                      </td>
                    </tr>
                  ))}
                </tbody>
                {aAgg && (
                  <tfoot className="bg-green-100 font-medium text-green-800">
                    <tr>
                      <td colSpan={4} className="px-2 py-1.5">Aggregated Total</td>
                      <td className={cn('px-2 py-1.5 text-right', diff.includes('duration') && 'bg-yellow-200')}>
                        {fmtNum(aAgg.duration)}
                      </td>
                      <td className={cn('px-2 py-1.5 text-right', diff.includes('cost') && 'bg-yellow-200')}>
                        {fmtMoney(aAgg.cost)}
                      </td>
                      <td className={cn('px-2 py-1.5 text-right', diff.includes('total_cost') && 'bg-yellow-200')}>
                        {fmtMoney(aAgg.totalCost)}
                      </td>
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
            {diff.map((f) => DIFF_LABEL[f] || f).join(', ')}
          </span>
        </div>
      )}
    </div>
  );
}

export function ForecastActuals() {
  const { data: locData, isLoading: locLoading } = useLocations();
  const locations = locData?.locations ?? [];
  const [locationId, setLocationId] = useState('');
  const [staff, setStaff] = useState('all');
  const [client, setClient] = useState('all');
  const [section, setSection] = useState('forecast');
  const [page, setPage] = useState(1);
  const [varianceTab, setVarianceTab] = useState('all');
  const [expandedSid, setExpandedSid] = useState(null);

  const listParams = useMemo(
    () => ({ locationId, staff, client, page }),
    [locationId, staff, client, page]
  );
  const summaryParams = useMemo(() => ({ locationId, staff, client }), [locationId, staff, client]);
  const varianceParams = useMemo(
    () => ({ locationId, staff, client, tab: varianceTab, page }),
    [locationId, staff, client, varianceTab, page]
  );

  const { data: directory, isLoading: dirLoading } = useForecastDirectory(Boolean(locationId));
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

  const staffOptions = directory?.staff || [{ value: 'all', label: 'All Staff' }];
  const clientOptions = directory?.clients || [{ value: 'all', label: 'All Clients' }];
  const selectableClients = useMemo(
    () => (directory?.clients ?? []).filter((c) => c.value !== 'all'),
    [directory?.clients]
  );
  const selectableStaff = useMemo(
    () => (directory?.staff ?? []).filter((s) => s.value !== 'all'),
    [directory?.staff]
  );

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
        <h2 className="text-3xl font-bold">Forecast vs actuals</h2>
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
                className={cn(
                  'flex h-10 w-full md:w-64 rounded-md border border-input bg-background px-3 py-2 text-sm'
                )}
                value={locationId}
                onChange={(e) => {
                  setLocationId(e.target.value);
                  setStaff('all');
                  setClient('all');
                  setPage(1);
                  setExpandedSid(null);
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
            <label className="text-sm font-medium">Staff</label>
            <select
              className="flex h-10 w-full md:w-56 rounded-md border border-input bg-background px-3 py-2 text-sm"
              value={staff}
              onChange={(e) => {
                setStaff(e.target.value);
                setPage(1);
              }}
              disabled={!locationId || dirLoading}
            >
              {staffOptions.map((o) => (
                <option key={o.value} value={o.value}>
                  {o.label}
                </option>
              ))}
            </select>
          </div>
          <div className="space-y-1">
            <label className="text-sm font-medium">Client</label>
            <select
              className="flex h-10 w-full md:w-56 rounded-md border border-input bg-background px-3 py-2 text-sm"
              value={client}
              onChange={(e) => {
                setClient(e.target.value);
                setPage(1);
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
                  setExpandedSid(null);
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
                  setPage={setPage}
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
                  setPage={setPage}
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
                            setVarianceTab(t.id);
                            setPage(1);
                            setExpandedSid(null);
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
                            {varianceTab === 'all' && <TableHead className="w-[100px]">Type</TableHead>}
                            <TableHead>Shift ID</TableHead>
                            <TableHead>Shift</TableHead>
                            <TableHead>Start</TableHead>
                            <TableHead>End</TableHead>
                            <TableHead className="text-right">Duration</TableHead>
                            <TableHead className="text-right">Cost</TableHead>
                            <TableHead className="text-right">Total Cost</TableHead>
                            <TableHead>Rate Group</TableHead>
                            <TableHead>Ref No</TableHead>
                          </TableRow>
                        </TableHeader>
                        <TableBody>
                          {(varianceQ.data?.records || []).length === 0 ? (
                            <TableRow>
                              <TableCell
                                colSpan={varianceTab === 'all' ? 10 : 9}
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
                              const open = expandedSid === r.shiftcareId && r.recordType === 'variance';
                              const isClickable = r.recordType === 'variance';
                              const isLastOfPair =
                                expandedSid === r.shiftcareId &&
                                r.recordType === 'variance' &&
                                (idx === arr.length - 1 || arr[idx + 1].shiftcareId !== r.shiftcareId);
                              return (
                                <Fragment key={`${r.shiftcareId}-${idx}-${r.source || ''}`}>
                                  <TableRow
                                    className={varianceRowClass(r)}
                                    onClick={
                                      isClickable
                                        ? () =>
                                            setExpandedSid(
                                              expandedSid === r.shiftcareId ? null : r.shiftcareId
                                            )
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
                                    <TableCell className="whitespace-nowrap font-mono text-xs">
                                      <span className="flex items-center gap-1.5">
                                        {r.recordType === 'variance' && r.source === 'forecast' && (
                                          <ChevronRight
                                            className={cn(
                                              'h-4 w-4 text-muted-foreground transition-transform',
                                              open && 'rotate-90'
                                            )}
                                          />
                                        )}
                                        {r.shiftcareId}
                                      </span>
                                    </TableCell>
                                    <TableCell className="max-w-[220px] truncate">
                                      {r.shiftDescription || '—'}
                                    </TableCell>
                                    <TableCell className={cn('whitespace-nowrap', diffCell(r, 'startDatetime'))}>
                                      {formatDt(r.startDatetime)}
                                    </TableCell>
                                    <TableCell className={cn('whitespace-nowrap', diffCell(r, 'endDatetime'))}>
                                      {formatDt(r.endDatetime)}
                                    </TableCell>
                                    <TableCell className={cn('text-right whitespace-nowrap', diffCell(r, 'duration'))}>
                                      {r.duration?.toFixed?.(2) ?? r.duration}
                                    </TableCell>
                                    <TableCell className={cn('text-right whitespace-nowrap', diffCell(r, 'cost'))}>
                                      ${r.cost?.toFixed?.(2) ?? r.cost}
                                    </TableCell>
                                    <TableCell className={cn('text-right whitespace-nowrap', diffCell(r, 'totalCost'))}>
                                      ${r.totalCost?.toFixed?.(2) ?? r.totalCost}
                                    </TableCell>
                                    <TableCell className={cn('whitespace-nowrap', diffCell(r, 'rateGroups'))}>
                                      {r.rateGroups || '—'}
                                    </TableCell>
                                    <TableCell className={cn('whitespace-nowrap', diffCell(r, 'referenceNo'))}>
                                      {r.referenceNo || '—'}
                                    </TableCell>
                                  </TableRow>
                                  {isLastOfPair && (
                                    <TableRow>
                                      <TableCell
                                        colSpan={varianceTab === 'all' ? 10 : 9}
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
