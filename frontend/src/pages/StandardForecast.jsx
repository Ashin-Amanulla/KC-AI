import { useMemo, useState } from 'react';
import { useDropzone } from 'react-dropzone';
import { toast } from 'sonner';
import {
  useStandardDirectory,
  useStandardList,
  useUploadStandard,
  exportStandardCsv,
} from '../api/standardForecast';
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
import { Upload, Download } from 'lucide-react';

function formatMoney(v) {
  if (v == null || v === '') return '—';
  const n = typeof v === 'number' ? v : Number(v);
  return Number.isFinite(n) ? n.toFixed(2) : '—';
}

export function StandardForecast() {
  const { data: locData, isLoading: locLoading } = useLocations();
  const locations = locData?.locations ?? [];
  const [locationId, setLocationId] = useState('');
  const [client, setClient] = useState('all');
  const [page, setPage] = useState(1);

  const listParams = useMemo(() => ({ locationId, client, page }), [locationId, client, page]);

  const { data: directory, isLoading: dirLoading } = useStandardDirectory(Boolean(locationId));
  const listQ = useStandardList(listParams, Boolean(locationId));
  const uploadM = useUploadStandard();

  const onDrop = async (files) => {
    const f = files?.[0];
    if (!f || !locationId) return;
    const validation = validateCsvFile(f);
    if (!validation.valid) {
      toast.error(validation.error);
      return;
    }
    try {
      const res = await uploadM.mutateAsync({ locationId, file: f });
      toast.success(`Standard upload: ${res.recordsCreated} rows created`);
      setPage(1);
    } catch (e) {
      toast.error(getErrorMessage(e));
    }
  };

  const dropzone = useDropzone({
    onDrop,
    accept: CSV_ACCEPT,
    multiple: false,
    disabled: !locationId || uploadM.isPending,
  });

  const clientOptions = directory?.clients || [{ value: 'all', label: 'All Clients' }];
  const exportBase = { locationId, client };

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-3xl font-bold">Standard</h2>
        <p className="text-sm text-muted-foreground">Weekly shift templates</p>
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
        <Card>
          <CardHeader className="flex flex-row flex-wrap items-center justify-between gap-2">
            <CardTitle>Standard data</CardTitle>
            <div className="flex flex-wrap gap-2">
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={() => exportStandardCsv(exportBase).catch((e) => toast.error(getErrorMessage(e)))}
              >
                <Download className="mr-2 h-4 w-4" />
                Export CSV
              </Button>
            </div>
          </CardHeader>
          <CardContent className="space-y-4">
            <div
              {...dropzone.getRootProps()}
              className={cn(
                'border-2 border-dashed rounded-lg p-8 text-center cursor-pointer transition-colors',
                dropzone.isDragActive ? 'border-primary bg-primary/5' : 'border-muted-foreground/25',
                (!locationId || uploadM.isPending) && 'opacity-50 cursor-not-allowed'
              )}
            >
              <input {...dropzone.getInputProps()} />
              <Upload className="mx-auto h-8 w-8 text-muted-foreground mb-2" />
              <p className="text-sm text-muted-foreground">
                {uploadM.isPending ? 'Uploading…' : 'Drop CSV here or click to upload standard templates'}
              </p>
            </div>

            {listQ.isLoading ? (
              <LoadingScreen message="Loading standard records…" />
            ) : (
              <>
                <div className="rounded-md border">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Day</TableHead>
                        <TableHead>Client</TableHead>
                        <TableHead>Start</TableHead>
                        <TableHead>End</TableHead>
                        <TableHead className="text-right">Duration</TableHead>
                        <TableHead className="text-right">Cost</TableHead>
                        <TableHead>Shift type</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {(listQ.data?.records ?? []).length === 0 ? (
                        <TableRow>
                          <TableCell colSpan={7} className="text-center text-muted-foreground py-8">
                            No standard records found. Upload a CSV file to get started.
                          </TableCell>
                        </TableRow>
                      ) : (
                        listQ.data.records.map((r) => (
                          <TableRow key={r.id}>
                            <TableCell>{r.day}</TableCell>
                            <TableCell>{r.clientName}</TableCell>
                            <TableCell>{r.startTime}</TableCell>
                            <TableCell>{r.endTime}</TableCell>
                            <TableCell className="text-right">{r.duration}</TableCell>
                            <TableCell className="text-right">{formatMoney(r.totalCost)}</TableCell>
                            <TableCell>{r.shiftType || '—'}</TableCell>
                          </TableRow>
                        ))
                      )}
                    </TableBody>
                  </Table>
                </div>
                {listQ.data?.total > 0 && (
                  <div className="flex items-center justify-between text-sm text-muted-foreground">
                    <span>
                      Showing {listQ.data.startIndex}–{listQ.data.endIndex} of {listQ.data.total}
                    </span>
                    <div className="flex gap-2">
                      <Button
                        type="button"
                        variant="outline"
                        size="sm"
                        disabled={!listQ.data.hasPrev}
                        onClick={() => setPage((p) => Math.max(1, p - 1))}
                      >
                        Previous
                      </Button>
                      <Button
                        type="button"
                        variant="outline"
                        size="sm"
                        disabled={!listQ.data.hasNext}
                        onClick={() => setPage((p) => p + 1)}
                      >
                        Next
                      </Button>
                    </div>
                  </div>
                )}
              </>
            )}
          </CardContent>
        </Card>
      )}
    </div>
  );
}
