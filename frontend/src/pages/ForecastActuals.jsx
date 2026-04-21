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
import { ChevronDown, ChevronRight, Upload, Download, FileSpreadsheet } from 'lucide-react';

const SECTIONS = [
  { id: 'forecast', label: 'Forecast' },
  { id: 'actuals', label: 'Actuals' },
  { id: 'summary', label: 'Summary' },
  { id: 'variance', label: 'Variance' },
];

const VARIANCE_TABS = [
  { id: 'all', label: 'All' },
  { id: 'deleted', label: 'Deleted' },
  { id: 'additional', label: 'Additional' },
  { id: 'variance', label: 'Variance' },
];

function formatDate(d) {
  if (!d) return '—';
  return new Date(d).toLocaleDateString();
}

function formatDt(d) {
  if (!d) return '—';
  return new Date(d).toLocaleString();
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
    const err = validateCsvFile(f);
    if (err) {
      toast.error(err);
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
    const err = validateCsvFile(f);
    if (err) {
      toast.error(err);
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
              <CardHeader className="flex flex-row flex-wrap items-center justify-between gap-2">
                <CardTitle>Forecast data</CardTitle>
                <div className="flex flex-wrap gap-2">
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    onClick={() => exportForecastCsv(exportBase).catch((e) => toast.error(getErrorMessage(e)))}
                  >
                    <Download className="mr-2 h-4 w-4" />
                    Export CSV
                  </Button>
                </div>
              </CardHeader>
              <CardContent className="space-y-4">
                <div
                  {...fzForecast.getRootProps()}
                  className={cn(
                    'cursor-pointer rounded-lg border border-dashed p-6 text-center text-sm text-muted-foreground',
                    fzForecast.isDragActive && 'border-primary bg-accent'
                  )}
                >
                  <input {...fzForecast.getInputProps()} />
                  <Upload className="mx-auto mb-2 h-8 w-8 opacity-50" />
                  Drop forecast CSV here, or click to select (full replace for this location)
                </div>
                {forecastQ.isLoading ? (
                  <LoadingScreen message="Loading forecast…" />
                ) : forecastQ.error ? (
                  <p className="text-destructive">{getErrorMessage(forecastQ.error)}</p>
                ) : (
                  <>
                    <p className="text-xs text-muted-foreground">
                      {forecastQ.data?.dateRangeStart && forecastQ.data?.dateRangeEnd
                        ? `Date range: ${formatDate(forecastQ.data.dateRangeStart)} – ${formatDate(forecastQ.data.dateRangeEnd)}`
                        : 'No forecast rows yet'}
                      {forecastQ.data?.total != null ? ` · ${forecastQ.data.total} rows` : ''}
                    </p>
                    <div className="rounded-md border overflow-x-auto">
                      <Table>
                        <TableHeader>
                          <TableRow>
                            <TableHead>Date</TableHead>
                            <TableHead>Client</TableHead>
                            <TableHead>Staff</TableHead>
                            <TableHead>Start</TableHead>
                            <TableHead>End</TableHead>
                            <TableHead className="text-right">Cost</TableHead>
                            <TableHead className="text-right">Total</TableHead>
                          </TableRow>
                        </TableHeader>
                        <TableBody>
                          {(forecastQ.data?.records || []).map((r) => (
                            <TableRow key={r.id}>
                              <TableCell>{formatDate(r.shiftDate)}</TableCell>
                              <TableCell>{r.clientName}</TableCell>
                              <TableCell>{r.staffName || '—'}</TableCell>
                              <TableCell>{formatDt(r.startDatetime)}</TableCell>
                              <TableCell>{formatDt(r.endDatetime)}</TableCell>
                              <TableCell className="text-right">{r.cost?.toFixed?.(2) ?? r.cost}</TableCell>
                              <TableCell className="text-right">{r.totalCost?.toFixed?.(2) ?? r.totalCost}</TableCell>
                            </TableRow>
                          ))}
                        </TableBody>
                      </Table>
                    </div>
                    <div className="flex items-center justify-between text-sm">
                      <span>
                        {forecastQ.data?.startIndex != null && forecastQ.data?.endIndex != null
                          ? `${forecastQ.data.startIndex}–${forecastQ.data.endIndex} of ${forecastQ.data.total}`
                          : ''}
                      </span>
                      <div className="flex gap-2">
                        <Button
                          type="button"
                          variant="outline"
                          size="sm"
                          disabled={!forecastQ.data?.hasPrev}
                          onClick={() => setPage((p) => Math.max(1, p - 1))}
                        >
                          Previous
                        </Button>
                        <Button
                          type="button"
                          variant="outline"
                          size="sm"
                          disabled={!forecastQ.data?.hasNext}
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

          {section === 'actuals' && (
            <Card>
              <CardHeader className="flex flex-row flex-wrap items-center justify-between gap-2">
                <CardTitle>Actuals data</CardTitle>
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={() => exportActualsCsv(exportBase).catch((e) => toast.error(getErrorMessage(e)))}
                >
                  <Download className="mr-2 h-4 w-4" />
                  Export CSV
                </Button>
              </CardHeader>
              <CardContent className="space-y-4">
                <div
                  {...fzActuals.getRootProps()}
                  className={cn(
                    'cursor-pointer rounded-lg border border-dashed p-6 text-center text-sm text-muted-foreground',
                    fzActuals.isDragActive && 'border-primary bg-accent'
                  )}
                >
                  <input {...fzActuals.getInputProps()} />
                  <Upload className="mx-auto mb-2 h-8 w-8 opacity-50" />
                  Drop actuals CSV here, or click to select (full replace for this location)
                </div>
                {actualsQ.isLoading ? (
                  <LoadingScreen message="Loading actuals…" />
                ) : actualsQ.error ? (
                  <p className="text-destructive">{getErrorMessage(actualsQ.error)}</p>
                ) : (
                  <>
                    <p className="text-xs text-muted-foreground">
                      {actualsQ.data?.dateRangeStart && actualsQ.data?.dateRangeEnd
                        ? `Date range: ${formatDate(actualsQ.data.dateRangeStart)} – ${formatDate(actualsQ.data.dateRangeEnd)}`
                        : 'No actuals rows yet'}
                      {actualsQ.data?.total != null ? ` · ${actualsQ.data.total} rows` : ''}
                    </p>
                    <div className="rounded-md border overflow-x-auto">
                      <Table>
                        <TableHeader>
                          <TableRow>
                            <TableHead>Date</TableHead>
                            <TableHead>Client</TableHead>
                            <TableHead>Staff</TableHead>
                            <TableHead>Start</TableHead>
                            <TableHead>End</TableHead>
                            <TableHead className="text-right">Cost</TableHead>
                            <TableHead className="text-right">Total</TableHead>
                          </TableRow>
                        </TableHeader>
                        <TableBody>
                          {(actualsQ.data?.records || []).map((r) => (
                            <TableRow key={r.id}>
                              <TableCell>{formatDate(r.shiftDate)}</TableCell>
                              <TableCell>{r.clientName}</TableCell>
                              <TableCell>{r.staffName || '—'}</TableCell>
                              <TableCell>{formatDt(r.startDatetime)}</TableCell>
                              <TableCell>{formatDt(r.endDatetime)}</TableCell>
                              <TableCell className="text-right">{r.cost?.toFixed?.(2) ?? r.cost}</TableCell>
                              <TableCell className="text-right">{r.totalCost?.toFixed?.(2) ?? r.totalCost}</TableCell>
                            </TableRow>
                          ))}
                        </TableBody>
                      </Table>
                    </div>
                    <div className="flex items-center justify-between text-sm">
                      <span>
                        {actualsQ.data?.startIndex != null && actualsQ.data?.endIndex != null
                          ? `${actualsQ.data.startIndex}–${actualsQ.data.endIndex} of ${actualsQ.data.total}`
                          : ''}
                      </span>
                      <div className="flex gap-2">
                        <Button
                          type="button"
                          variant="outline"
                          size="sm"
                          disabled={!actualsQ.data?.hasPrev}
                          onClick={() => setPage((p) => Math.max(1, p - 1))}
                        >
                          Previous
                        </Button>
                        <Button
                          type="button"
                          variant="outline"
                          size="sm"
                          disabled={!actualsQ.data?.hasNext}
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
                          {(summaryQ.data?.records || []).map((r) => (
                            <TableRow key={r.clientId}>
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
                            <TableRow className="bg-muted/50 font-medium">
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
                <div className="flex flex-wrap gap-2">
                  {VARIANCE_TABS.map((t) => (
                    <Button
                      key={t.id}
                      type="button"
                      size="sm"
                      variant={varianceTab === t.id ? 'default' : 'outline'}
                      onClick={() => {
                        setVarianceTab(t.id);
                        setPage(1);
                        setExpandedSid(null);
                      }}
                    >
                      {t.label}
                      {t.id === 'all' && varianceQ.data?.allCount != null ? ` (${varianceQ.data.allCount})` : ''}
                      {t.id === 'deleted' && varianceQ.data?.deletedCount != null
                        ? ` (${varianceQ.data.deletedCount})`
                        : ''}
                      {t.id === 'additional' && varianceQ.data?.additionalCount != null
                        ? ` (${varianceQ.data.additionalCount})`
                        : ''}
                      {t.id === 'variance' && varianceQ.data?.varianceCount != null
                        ? ` (${varianceQ.data.varianceCount})`
                        : ''}
                    </Button>
                  ))}
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
                    <div className="rounded-md border overflow-x-auto">
                      <Table>
                        <TableHeader>
                          <TableRow>
                            <TableHead className="w-8" />
                            <TableHead>Type</TableHead>
                            <TableHead>Source</TableHead>
                            <TableHead>Shift ID</TableHead>
                            <TableHead>Shift</TableHead>
                            <TableHead>Start</TableHead>
                            <TableHead>End</TableHead>
                            <TableHead className="text-right">Duration</TableHead>
                            <TableHead className="text-right">Cost</TableHead>
                            <TableHead className="text-right">Total</TableHead>
                          </TableRow>
                        </TableHeader>
                        <TableBody>
                          {(varianceQ.data?.records || []).map((r, idx) => {
                            const open = expandedSid === r.shiftcareId;
                            return (
                              <Fragment key={`${r.shiftcareId}-${idx}-${r.source || ''}`}>
                                <TableRow>
                                  <TableCell>
                                    <Button
                                      type="button"
                                      variant="ghost"
                                      size="icon"
                                      className="h-8 w-8"
                                      onClick={() =>
                                        setExpandedSid(open ? null : r.shiftcareId)
                                      }
                                    >
                                      {open ? (
                                        <ChevronDown className="h-4 w-4" />
                                      ) : (
                                        <ChevronRight className="h-4 w-4" />
                                      )}
                                    </Button>
                                  </TableCell>
                                  <TableCell>{r.recordType || '—'}</TableCell>
                                  <TableCell>{r.source || '—'}</TableCell>
                                  <TableCell className="font-mono text-xs">{r.shiftcareId}</TableCell>
                                  <TableCell className="max-w-[200px] truncate">{r.shiftDescription}</TableCell>
                                  <TableCell>{formatDt(r.startDatetime)}</TableCell>
                                  <TableCell>{formatDt(r.endDatetime)}</TableCell>
                                  <TableCell className="text-right">{r.duration}</TableCell>
                                  <TableCell className="text-right">{r.cost}</TableCell>
                                  <TableCell className="text-right">{r.totalCost}</TableCell>
                                </TableRow>
                                {open && (
                                  <TableRow>
                                    <TableCell colSpan={10} className="bg-muted/30 p-4 align-top">
                                      {detailQ.isLoading ? (
                                        <LoadingScreen message="Loading detail…" />
                                      ) : detailQ.data ? (
                                        <div className="space-y-2 text-sm">
                                          <p className="font-medium">
                                            Diff fields:{' '}
                                            {(detailQ.data.diffFields || []).join(', ') || '—'}
                                          </p>
                                          <div className="grid gap-4 md:grid-cols-2">
                                            <div>
                                              <p className="mb-1 font-medium">Forecast rows</p>
                                              <ul className="list-inside list-disc text-xs text-muted-foreground">
                                                {(detailQ.data.forecastRecords || []).map((fr) => (
                                                  <li key={fr.id}>
                                                    {formatDt(fr.startDatetime)} – {formatDt(fr.endDatetime)} · cost{' '}
                                                    {fr.cost}
                                                  </li>
                                                ))}
                                              </ul>
                                            </div>
                                            <div>
                                              <p className="mb-1 font-medium">Actuals rows</p>
                                              <ul className="list-inside list-disc text-xs text-muted-foreground">
                                                {(detailQ.data.actualsRecords || []).map((ar) => (
                                                  <li key={ar.id}>
                                                    {formatDt(ar.startDatetime)} – {formatDt(ar.endDatetime)} · cost{' '}
                                                    {ar.cost}
                                                  </li>
                                                ))}
                                              </ul>
                                            </div>
                                          </div>
                                        </div>
                                      ) : null}
                                    </TableCell>
                                  </TableRow>
                                )}
                              </Fragment>
                            );
                          })}
                        </TableBody>
                      </Table>
                    </div>
                    <div className="flex items-center justify-between text-sm">
                      <span>
                        {varianceQ.data?.startIndex != null && varianceQ.data?.endIndex != null
                          ? `${varianceQ.data.startIndex}–${varianceQ.data.endIndex} of ${varianceQ.data.total}`
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
