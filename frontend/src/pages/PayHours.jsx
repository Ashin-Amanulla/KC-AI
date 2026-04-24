import React, { useState, useCallback } from 'react';
import { useDropzone } from 'react-dropzone';
import { toast } from 'sonner';
import { Upload, Download, ChevronRight, Plus, Trash2, AlertCircle, Calculator, MapPin } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '../ui/card';
import { Button } from '../ui/button';
import { Input } from '../ui/input';
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from '../ui/table';
import { useUploadShifts } from '../api/shifts';
import { useHolidays, useCreateHoliday, useDeleteHoliday } from '../api/holidays';
import { useLocations, useCreateLocation, useDeleteLocation, useLoadHolidayFixture } from '../api/locations';
import { usePayHours, useShiftPayHours, useComputePayHours, usePayHoursJobStatus } from '../api/payHours';
import { getErrorMessage } from '../utils/api';
import { LoadingScreen } from '../ui/LoadingSpinner';
import { VEHICLE_RATE } from '../lib/schadsWageCalc';

// ─── Shift Pay Hours Detail (lazy-loaded on row expand) ──────────────────────

const ShiftDetail = ({ payHoursId }) => {
  const { data, isLoading } = useShiftPayHours(payHoursId, true);

  if (isLoading) return <div className="p-4 text-sm text-muted-foreground">Loading shifts…</div>;

  const shifts = data?.shifts || [];
  if (!shifts.length) return <div className="p-4 text-sm text-muted-foreground">No shift breakdown available</div>;

  const formatTime = (dt) => {
    if (!dt) return '-';
    return new Date(dt).toLocaleTimeString('en-AU', { hour: '2-digit', minute: '2-digit' });
  };

  const formatDate = (dt) => {
    if (!dt) return '-';
    return new Date(dt).toLocaleDateString('en-AU', { day: 'numeric', month: 'short', year: 'numeric' });
  };

  const h = (v) => (v ? v.toFixed(2) : '-');

  return (
    <div className="overflow-x-auto">
      <Table>
        <TableHeader>
          <TableRow className="bg-muted/30">
            <TableHead>Date</TableHead>
            <TableHead>Start</TableHead>
            <TableHead>End</TableHead>
            <TableHead>Client</TableHead>
            <TableHead>Type</TableHead>
            <TableHead className="text-right">Total Hrs</TableHead>
            <TableHead className="text-right">Morning</TableHead>
            <TableHead className="text-right">Afternoon</TableHead>
            <TableHead className="text-right">Night</TableHead>
            <TableHead className="text-right">Sat</TableHead>
            <TableHead className="text-right">Sun</TableHead>
            <TableHead className="text-right">Holiday</TableHead>
            <TableHead className="text-right">Nursing</TableHead>
            <TableHead className="text-right">KM</TableHead>
            <TableHead className="text-right">Km Allow</TableHead>
            <TableHead>Flags</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {shifts.map((shift) => (
            <TableRow key={shift._id}>
              <TableCell>{formatDate(shift.shiftDate)}</TableCell>
              <TableCell className="font-mono text-xs">{formatTime(shift.shiftStart)}</TableCell>
              <TableCell className="font-mono text-xs">{formatTime(shift.shiftEnd)}</TableCell>
              <TableCell className="text-muted-foreground text-xs">{shift.clientName || '-'}</TableCell>
              <TableCell>
                <span className="text-xs capitalize">{shift.shiftType?.replace('_', ' ')}</span>
              </TableCell>
              <TableCell className="text-right font-semibold text-xs">{h(shift.totalHours)}</TableCell>
              <TableCell className="text-right text-xs text-yellow-700">{h(shift.morningHours)}</TableCell>
              <TableCell className="text-right text-xs text-orange-700">{h(shift.afternoonHours)}</TableCell>
              <TableCell className="text-right text-xs text-indigo-700">{h(shift.nightHours)}</TableCell>
              <TableCell className="text-right text-xs text-cyan-700">{h(shift.saturdayHours)}</TableCell>
              <TableCell className="text-right text-xs text-teal-700">{h(shift.sundayHours)}</TableCell>
              <TableCell className="text-right text-xs text-red-700">{h(shift.holidayHours)}</TableCell>
              <TableCell className="text-right text-xs text-blue-700">{h(shift.nursingCareHours)}</TableCell>
              <TableCell className="text-right text-xs text-emerald-700">
                {shift.mileage != null ? `${shift.mileage} km` : '-'}
              </TableCell>
              <TableCell className="text-right text-xs text-emerald-600">
                {shift.mileage != null && shift.mileage > 0
                  ? `$${(shift.mileage * VEHICLE_RATE).toFixed(2)}`
                  : '-'}
              </TableCell>
              <TableCell>
                <div className="flex gap-1">
                  {shift.isBrokenShift && <span className="inline-block px-1.5 py-0.5 rounded text-[10px] bg-orange-100 text-orange-800">Broken</span>}
                  {shift.isSleepover && <span className="inline-block px-1.5 py-0.5 rounded text-[10px] bg-purple-100 text-purple-800">Sleepover</span>}
                </div>
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </div>
  );
};

// ─── Holiday Manager ──────────────────────────────────────────────────────────

export const HolidayManager = ({ locationId, locations }) => {
  const y = new Date().getFullYear();
  const [newDate, setNewDate] = useState('');
  const [newName, setNewName] = useState('');
  const [newRule, setNewRule] = useState('');
  const [collapsed, setCollapsed] = useState(true);

  const { data } = useHolidays(locationId ? { locationId, sampleYear: y } : {});
  const createMutation = useCreateHoliday();
  const deleteMutation = useDeleteHoliday();
  const loadFixtureMutation = useLoadHolidayFixture();

  const holidays = data?.holidays || [];
  const ruleOptions = data?.rules || [];
  const location = locations.find(l => l._id === locationId);

  const handleAdd = async () => {
    if (!newName.trim() || !locationId) return;
    if (!newRule && !newDate) {
      toast.error('Pick a recurring rule or a calendar day (year is ignored; repeats annually)');
      return;
    }
    try {
      if (newRule) {
        await createMutation.mutateAsync({ name: newName.trim(), locationId, rule: newRule });
      } else {
        await createMutation.mutateAsync({ name: newName.trim(), locationId, date: newDate });
      }
      setNewDate('');
      setNewName('');
      setNewRule('');
      toast.success('Holiday added');
    } catch (err) {
      toast.error(getErrorMessage(err) || 'Failed to add holiday');
    }
  };

  const handleDelete = async (id) => {
    try {
      await deleteMutation.mutateAsync(id);
      toast.success('Holiday deleted');
    } catch (err) {
      toast.error('Failed to delete holiday');
    }
  };

  const handleLoadFixture = async () => {
    if (!locationId) return;
    try {
      const result = await loadFixtureMutation.mutateAsync({ locationId });
      toast.success(`Loaded ${result.created} public holidays from fixture (${result.skipped} already existed)`);
      if (result.errors?.length) toast.warning(`${result.errors.length} errors during load`);
    } catch (err) {
      toast.error(getErrorMessage(err) || 'Failed to load holiday fixture');
    }
  };

  if (!locationId) {
    return (
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-base">Holiday Manager</CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-sm text-muted-foreground">Select a location above to manage its public holidays.</p>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader className="pb-2 cursor-pointer select-none" onClick={() => setCollapsed(!collapsed)}>
        <CardTitle className="text-base flex items-center justify-between">
          <span>Holiday Manager — {location?.name} ({holidays.length} holidays)</span>
          <ChevronRight className={`h-4 w-4 transition-transform ${collapsed ? '' : 'rotate-90'}`} />
        </CardTitle>
      </CardHeader>
      {!collapsed && (
        <CardContent className="space-y-4">
          {/* Load fixture row */}
          <div className="flex gap-3 items-center flex-wrap p-3 rounded-md bg-muted/40 border">
            <span className="text-sm font-medium">Load recurring public holidays (state-appropriate) from built-in list:</span>
            <Button
              size="sm"
              variant="outline"
              onClick={handleLoadFixture}
              disabled={loadFixtureMutation.isPending}
            >
              {loadFixtureMutation.isPending ? 'Loading…' : `Load ${location?.code ?? ''} Holidays`}
            </Button>
          </div>

          {/* Manual add row */}
          <div className="flex flex-col gap-2">
            <p className="text-xs text-muted-foreground">Add by rule (Easter, nth Monday, …) or by fixed month/day — the date picker's year is ignored; the same day repeats every year.</p>
            <div className="flex gap-3 flex-wrap items-end">
              <div className="flex flex-col gap-1">
                <label className="text-xs text-muted-foreground">Recurring rule (optional)</label>
                <select
                  value={newRule}
                  onChange={e => setNewRule(e.target.value)}
                  className="h-9 rounded-md border border-input bg-background px-2 text-sm min-w-[14rem]"
                >
                  <option value="">— Fixed day (use date below) —</option>
                  {ruleOptions.map((r) => (
                    <option key={r} value={r}>{r.replace(/_/g, ' ')}</option>
                  ))}
                </select>
              </div>
              <div className="flex flex-col gap-1">
                <label className="text-xs text-muted-foreground">Date (for fixed day only)</label>
                <Input type="date" value={newDate} onChange={(e) => setNewDate(e.target.value)} className="w-44" disabled={Boolean(newRule)} />
              </div>
              <Input placeholder="Holiday name" value={newName} onChange={(e) => setNewName(e.target.value)} className="w-56" />
              <Button onClick={handleAdd} disabled={(!newRule && !newDate) || !newName.trim() || createMutation.isPending} size="sm">
                <Plus className="h-4 w-4 mr-1" /> Add
              </Button>
            </div>
          </div>

          {holidays.length > 0 ? (
            <div className="rounded-md border overflow-hidden">
              <Table>
                <TableHeader>
                  <TableRow className="bg-muted/50">
                    <TableHead>Recurrence</TableHead>
                    <TableHead>Example in {y}</TableHead>
                    <TableHead>Name</TableHead>
                    <TableHead className="w-16"></TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {holidays.map((h) => (
                    <TableRow key={h._id}>
                      <TableCell className="text-sm">{h.displaySchedule || '—'}</TableCell>
                      <TableCell className="text-sm tabular-nums">
                        {h.sampleYmd
                          ? h.sampleYmd
                          : '—'}
                      </TableCell>
                      <TableCell>{h.name}</TableCell>
                      <TableCell>
                        <Button variant="ghost" size="sm" onClick={() => handleDelete(h._id)} className="text-destructive hover:text-destructive">
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          ) : (
            <p className="text-sm text-muted-foreground">No holidays configured. Use "Load Holidays" above or add manually.</p>
          )}
        </CardContent>
      )}
    </Card>
  );
};

// ─── Main Page ────────────────────────────────────────────────────────────────

export const PayHours = ({
  embedWorkforce = false,
  locationId: controlledLocationId,
  setLocationId: controlledSetLocationId,
  payHoursJobId: parentJobId,
  setPayHoursJobId: setParentJobId,
} = {}) => {
  const [internalLocationId, setInternalLocationId] = useState('');
  const locationId = controlledLocationId !== undefined ? controlledLocationId : internalLocationId;
  const setLocationId = controlledSetLocationId ?? setInternalLocationId;
  const [staffFilter, setStaffFilter] = useState('');
  const [expandedRows, setExpandedRows] = useState({});
  const [selectedFile, setSelectedFile] = useState(null);
  const [uploadResult, setUploadResult] = useState(null);
  const [internalJobId, setInternalJobId] = useState(null);
  const jobFromParent = embedWorkforce && typeof setParentJobId === 'function';
  const activeJobId = jobFromParent ? parentJobId ?? null : internalJobId;
  const setActiveJobId = jobFromParent ? setParentJobId : setInternalJobId;

  const { data: locationsData } = useLocations();
  const locations = locationsData?.locations || [];
  const createLocationMutation = useCreateLocation();
  const deleteLocationMutation = useDeleteLocation();
  const [showNewLocation, setShowNewLocation] = useState(false);
  const [newLocName, setNewLocName]   = useState('');
  const [newLocCode, setNewLocCode]   = useState('');
  const [newLocTz, setNewLocTz]       = useState('Australia/Brisbane');

  const handleCreateLocation = async () => {
    if (!newLocName.trim() || !newLocCode.trim()) return;
    try {
      await createLocationMutation.mutateAsync({ name: newLocName.trim(), code: newLocCode.trim().toUpperCase(), timezone: newLocTz });
      toast.success(`Location "${newLocName.trim()}" created`);
      setNewLocName(''); setNewLocCode(''); setShowNewLocation(false);
    } catch (err) {
      toast.error(getErrorMessage(err) || 'Failed to create location');
    }
  };

  const handleDeleteLocation = async (id, name) => {
    if (!window.confirm(`Delete location "${name}"? This cannot be undone.`)) return;
    try {
      await deleteLocationMutation.mutateAsync(id);
      if (locationId === id) setLocationId('');
      toast.success('Location deleted');
    } catch (err) {
      toast.error(getErrorMessage(err) || 'Failed to delete location');
    }
  };

  const uploadMutation = useUploadShifts();
  const computeMutation = useComputePayHours();
  const { data: jobStatus } = usePayHoursJobStatus(activeJobId);

  const payHoursParams = {};
  if (locationId) payHoursParams.locationId = locationId;
  if (staffFilter) payHoursParams.staffName = staffFilter;

  const { data: payHoursData, isLoading, refetch } = usePayHours(payHoursParams);

  const payHours = payHoursData?.payHours || [];
  const periodStart = payHoursData?.periodStart;
  const periodEnd = payHoursData?.periodEnd;

  // When job completes, refetch pay hours
  if (activeJobId && jobStatus?.status === 'completed') {
    refetch();
  }

  const isJobActive = activeJobId && jobStatus && !['completed', 'failed'].includes(jobStatus.status);

  const onDrop = useCallback((acceptedFiles) => {
    if (acceptedFiles.length > 0) {
      setSelectedFile(acceptedFiles[0]);
      setUploadResult(null);
    }
  }, []);

  const { getRootProps, getInputProps, isDragActive } = useDropzone({
    onDrop,
    accept: { 'text/csv': ['.csv'], 'application/csv': ['.csv'] },
    maxFiles: 1,
    disabled: uploadMutation.isPending || computeMutation.isPending || isJobActive,
  });

  const handleUpload = async () => {
    if (!selectedFile) return;
    try {
      const result = await uploadMutation.mutateAsync({ file: selectedFile, locationId: locationId || null });
      setUploadResult(result);
      setSelectedFile(null);
      if (result.success === false) {
        toast.error('Upload did not complete — fix CSV issues and try again');
        return;
      }
      try {
        const cr = await computeMutation.mutateAsync({ locationId: locationId || null });
        setActiveJobId(cr.jobId);
        if (result.errors?.length > 0) {
          toast.warning(
            `Uploaded with ${result.errors.length} row issues (${result.shiftsCreated} shifts). Pay hours running…`
          );
        } else {
          toast.success(`Uploaded ${result.shiftsCreated} shifts. Pay hours running…`);
        }
      } catch (computeErr) {
        if (result.errors?.length > 0) {
          toast.warning(`Upload finished with ${result.errors.length} row issues`);
        } else {
          toast.success(`Uploaded ${result.shiftsCreated} shifts`);
        }
        toast.error(
          getErrorMessage(computeErr) || 'Pay hours could not start — use Compute Pay Hours to try again'
        );
      }
    } catch (err) {
      toast.error(getErrorMessage(err) || 'Upload failed');
    }
  };

  const handleCompute = async () => {
    try {
      const result = await computeMutation.mutateAsync({ locationId: locationId || null });
      setActiveJobId(result.jobId);
      toast.info('Pay hours computation started');
    } catch (err) {
      toast.error(getErrorMessage(err) || 'Failed to start computation');
    }
  };

  const toggleRow = (id) => {
    setExpandedRows(prev => ({ ...prev, [id]: !prev[id] }));
  };

  const formatDate = (dt) => {
    if (!dt) return '-';
    return new Date(dt).toLocaleDateString('en-AU', { day: 'numeric', month: 'short', year: 'numeric' });
  };

  const h = (v) => (v != null ? v.toFixed(2) : '-');

  const exportUrl = `/api/pay-hours/export${locationId ? `?locationId=${locationId}` : ''}`;

  const payHoursTableBody = (
    <>
      {isLoading ? (
        <LoadingScreen message="Loading pay hours…" />
      ) : payHours.length === 0 ? (
        <div className="text-center py-12 text-muted-foreground">
          <Calculator className="mx-auto h-12 w-12 mb-3 opacity-30" />
          <p className="text-lg">No pay hours yet</p>
          <p className="text-sm mt-1 max-w-sm mx-auto">
            Upload a ShiftCare CSV above. Shifts are imported and pay hours compute automatically — or click{' '}
            <span className="font-medium text-foreground">Compute pay hours</span> to re-run.
          </p>
        </div>
      ) : (
        <div className="overflow-x-auto rounded-md border">
          <Table>
            <TableHeader>
              <TableRow className="bg-muted/50">
                <TableHead className="w-8"></TableHead>
                <TableHead className="min-w-[160px]">Staff</TableHead>
                <TableHead className="text-right bg-yellow-50/50 text-yellow-800">Morn</TableHead>
                <TableHead className="text-right bg-orange-50/50 text-orange-800">Aft</TableHead>
                <TableHead className="text-right bg-indigo-50/50 text-indigo-800">Night</TableHead>
                <TableHead className="text-right bg-gray-50">WD OT≤2</TableHead>
                <TableHead className="text-right bg-gray-50">WD OT&gt;2</TableHead>
                <TableHead className="text-right bg-cyan-50/50 text-cyan-800">Sat</TableHead>
                <TableHead className="text-right bg-cyan-50/50">Sat OT≤2</TableHead>
                <TableHead className="text-right bg-cyan-50/50">Sat OT&gt;2</TableHead>
                <TableHead className="text-right bg-teal-50/50 text-teal-800">Sun</TableHead>
                <TableHead className="text-right bg-teal-50/50">Sun OT≤2</TableHead>
                <TableHead className="text-right bg-teal-50/50">Sun OT&gt;2</TableHead>
                <TableHead className="text-right bg-red-50/50 text-red-800">Hol</TableHead>
                <TableHead className="text-right bg-red-50/50">Hol OT≤2</TableHead>
                <TableHead className="text-right bg-red-50/50">Hol OT&gt;2</TableHead>
                <TableHead className="text-right bg-blue-50/50 text-blue-800">Nursing</TableHead>
                <TableHead className="text-right">Broken#</TableHead>
                <TableHead className="text-right">Sleep#</TableHead>
                <TableHead className="text-right">OT&gt;76</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {payHours.map((ph) => (
                <React.Fragment key={ph._id}>
                  <TableRow
                    className="cursor-pointer hover:bg-muted/50"
                    onClick={() => toggleRow(ph._id)}
                  >
                    <TableCell>
                      <ChevronRight className={`h-4 w-4 transition-transform ${expandedRows[ph._id] ? 'rotate-90' : ''}`} />
                    </TableCell>
                    <TableCell className="font-medium">{ph.staffName}</TableCell>
                    <TableCell className="text-right text-xs">{h(ph.morningHours)}</TableCell>
                    <TableCell className="text-right text-xs">{h(ph.afternoonHours)}</TableCell>
                    <TableCell className="text-right text-xs">{h(ph.nightHours)}</TableCell>
                    <TableCell className="text-right text-xs">{h(ph.weekdayOtUpto2)}</TableCell>
                    <TableCell className="text-right text-xs">{h(ph.weekdayOtAfter2)}</TableCell>
                    <TableCell className="text-right text-xs">{h(ph.saturdayHours)}</TableCell>
                    <TableCell className="text-right text-xs">{h(ph.saturdayOtUpto2)}</TableCell>
                    <TableCell className="text-right text-xs">{h(ph.saturdayOtAfter2)}</TableCell>
                    <TableCell className="text-right text-xs">{h(ph.sundayHours)}</TableCell>
                    <TableCell className="text-right text-xs">{h(ph.sundayOtUpto2)}</TableCell>
                    <TableCell className="text-right text-xs">{h(ph.sundayOtAfter2)}</TableCell>
                    <TableCell className="text-right text-xs">{h(ph.holidayHours)}</TableCell>
                    <TableCell className="text-right text-xs">{h(ph.holidayOtUpto2)}</TableCell>
                    <TableCell className="text-right text-xs">{h(ph.holidayOtAfter2)}</TableCell>
                    <TableCell className="text-right text-xs">{h(ph.nursingCareHours)}</TableCell>
                    <TableCell className="text-right text-xs">{ph.brokenShiftCount ?? 0}</TableCell>
                    <TableCell className="text-right text-xs">{ph.sleepoversCount ?? 0}</TableCell>
                    <TableCell className="text-right text-xs font-semibold">{h(ph.otAfter76Hours)}</TableCell>
                  </TableRow>
                  {expandedRows[ph._id] && (
                    <TableRow>
                      <TableCell colSpan={20} className="p-0 bg-muted/10">
                        <ShiftDetail payHoursId={ph._id} />
                      </TableCell>
                    </TableRow>
                  )}
                </React.Fragment>
              ))}
            </TableBody>
          </Table>
        </div>
      )}
    </>
  );

  if (embedWorkforce) {
    return (
      <div id="workforce-roster" className="scroll-mt-4">
        <Card className="shadow-sm border-dashed">
          <CardHeader className="pb-3">
            <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
              <div className="min-w-0">
                <CardTitle className="text-lg">Shifts &amp; pay hours</CardTitle>
                <p className="text-sm text-muted-foreground font-normal mt-1.5 leading-relaxed">
                  One place for your roster: upload a <strong className="text-foreground font-medium">ShiftCare CSV</strong> (shifts
                  are saved and pay hours compute automatically). Expand a staff row to review <strong className="text-foreground font-medium">individual shifts</strong>.
                  Use <strong className="text-foreground font-medium">Compute pay hours</strong> to recalculate without uploading again.
                </p>
              </div>
              {payHours.length > 0 && (
                <a
                  href={exportUrl}
                  className="inline-flex shrink-0 items-center gap-2 rounded-md border border-input bg-background px-4 py-2 text-sm font-medium shadow-sm hover:bg-accent"
                >
                  <Download className="h-4 w-4" />
                  Export pay hours CSV
                </a>
              )}
            </div>
          </CardHeader>
          <CardContent className="space-y-4">
            <div
              {...getRootProps()}
              className={`flex flex-col items-center justify-center rounded-lg border-2 border-dashed p-6 text-center cursor-pointer transition-colors ${
                isDragActive ? 'border-primary bg-primary/5' : 'border-muted-foreground/25 hover:border-primary/50'
              }`}
            >
              <input {...getInputProps()} />
              <Upload className="mb-2 h-6 w-6 text-muted-foreground" />
              {selectedFile ? (
                <p className="text-sm font-medium">{selectedFile.name}</p>
              ) : (
                <p className="text-sm text-muted-foreground">Drop a ShiftCare CSV or click to browse</p>
              )}
            </div>

            <div className="flex gap-3 flex-wrap">
              {selectedFile && (
                <Button onClick={handleUpload} disabled={uploadMutation.isPending || computeMutation.isPending}>
                  {uploadMutation.isPending ? 'Uploading…' : 'Upload & compute pay hours'}
                </Button>
              )}
              <Button
                onClick={handleCompute}
                disabled={computeMutation.isPending || isJobActive}
                variant="default"
              >
                <Calculator className="h-4 w-4 mr-2" />
                {computeMutation.isPending || isJobActive ? 'Computing…' : 'Compute pay hours'}
              </Button>
            </div>

            {uploadResult && (
              <div className={`rounded-md p-3 text-sm ${uploadResult.success ? 'bg-green-50 text-green-800' : 'bg-red-50 text-red-800'}`}>
                <p>Shifts uploaded: {uploadResult.shiftsCreated} | Skipped: {uploadResult.shiftsSkipped}</p>
                {uploadResult.errors?.slice(0, 3).map((e, i) => (
                  <p key={i} className="flex gap-1 mt-1">
                    <AlertCircle className="h-3 w-3 mt-0.5 shrink-0" />
                    {e}
                  </p>
                ))}
              </div>
            )}

            {activeJobId && jobStatus && (
              <div className="rounded-lg border bg-muted/30 p-4 space-y-2">
                <div className="flex justify-between text-sm">
                  <span>
                    {jobStatus.status === 'completed'
                      ? '✓ Computation complete'
                      : jobStatus.status === 'failed'
                        ? '✗ Computation failed'
                        : `Computing pay hours… (${jobStatus.staffProcessed || 0} staff processed)`}
                  </span>
                  <span className="font-medium">{jobStatus.progress || 0}%</span>
                </div>
                <div className="h-2 rounded-full bg-muted overflow-hidden">
                  <div
                    className={`h-full rounded-full transition-all ${jobStatus.status === 'failed' ? 'bg-destructive' : 'bg-primary'}`}
                    style={{ width: `${jobStatus.progress || 0}%` }}
                  />
                </div>
                {jobStatus.status === 'completed' && (
                  <p className="text-xs text-green-600">
                    {jobStatus.payHoursCreated} pay hours records created
                    {periodStart && ` for period ${formatDate(jobStatus.periodStart)} – ${formatDate(jobStatus.periodEnd)}`}
                  </p>
                )}
                {jobStatus.errors?.length > 0 && (
                  <p className="text-xs text-destructive">{jobStatus.errors.length} errors encountered</p>
                )}
              </div>
            )}

            <div className="border-t pt-4 space-y-3">
              <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
                <div>
                  <p className="text-sm font-semibold text-foreground">Staff totals</p>
                  {periodStart && (
                    <p className="text-xs text-muted-foreground mt-0.5">
                      Period: {formatDate(periodStart)} — {formatDate(periodEnd)}
                    </p>
                  )}
                </div>
                <Input
                  placeholder="Filter by staff name…"
                  value={staffFilter}
                  onChange={(e) => setStaffFilter(e.target.value)}
                  className="w-full sm:w-56"
                />
              </div>
              {payHoursTableBody}
            </div>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {!embedWorkforce && (
      <div className="flex items-center justify-between">
        <h2 className="text-3xl font-bold">Pay Hours</h2>
        {payHours.length > 0 && (
          <a
            href={exportUrl}
            className="inline-flex items-center gap-2 rounded-md border border-input bg-background px-4 py-2 text-sm font-medium shadow-sm hover:bg-accent"
          >
            <Download className="h-4 w-4" />
            Export CSV
          </a>
        )}
      </div>
      )}

      {/* Location Selector */}
      {!embedWorkforce && (
      <Card>
        <CardContent className="pt-4 space-y-3">
          <div className="flex items-center gap-3 flex-wrap">
            <MapPin className="h-4 w-4 text-muted-foreground shrink-0" />
            <span className="text-sm font-medium">Location</span>
            <select
              value={locationId}
              onChange={e => setLocationId(e.target.value)}
              className="h-9 rounded-md border border-input bg-background px-3 text-sm min-w-[200px]"
            >
              <option value="">All Locations</option>
              {locations.map(loc => (
                <option key={loc._id} value={loc._id}>{loc.name} ({loc.code})</option>
              ))}
            </select>
            <Button size="sm" variant="outline" onClick={() => setShowNewLocation(v => !v)}>
              <Plus className="h-3.5 w-3.5 mr-1" /> Add Location
            </Button>
            {locationId && (
              <button
                onClick={() => handleDeleteLocation(locationId, locations.find(l => l._id === locationId)?.name)}
                className="text-xs text-destructive hover:underline ml-auto"
              >
                <Trash2 className="h-3.5 w-3.5 inline mr-1" />Delete selected
              </button>
            )}
          </div>

          {/* Inline create form */}
          {showNewLocation && (
            <div className="flex flex-wrap items-end gap-2 pt-1 border-t border-border">
              <div className="space-y-1">
                <label className="text-xs text-muted-foreground">Name</label>
                <Input placeholder="e.g. Brisbane Office" value={newLocName} onChange={e => setNewLocName(e.target.value)} className="h-8 w-44 text-sm" />
              </div>
              <div className="space-y-1">
                <label className="text-xs text-muted-foreground">Code</label>
                <Input placeholder="e.g. BRISBANE" value={newLocCode} onChange={e => setNewLocCode(e.target.value)} className="h-8 w-32 text-sm uppercase" />
              </div>
              <div className="space-y-1">
                <label className="text-xs text-muted-foreground">Timezone</label>
                <select value={newLocTz} onChange={e => setNewLocTz(e.target.value)} className="h-8 rounded-md border border-input bg-background px-2 text-sm">
                  <option value="Australia/Brisbane">Brisbane (AEST, no DST)</option>
                  <option value="Australia/Sydney">Sydney (AEDT)</option>
                  <option value="Australia/Melbourne">Melbourne (AEDT)</option>
                  <option value="Australia/Perth">Perth (AWST)</option>
                  <option value="Australia/Adelaide">Adelaide (ACDT)</option>
                  <option value="Australia/Darwin">Darwin (ACST)</option>
                  <option value="Australia/Hobart">Hobart (AEDT)</option>
                </select>
              </div>
              <Button size="sm" onClick={handleCreateLocation} disabled={createLocationMutation.isPending || !newLocName.trim() || !newLocCode.trim()}>
                {createLocationMutation.isPending ? 'Creating…' : 'Create'}
              </Button>
              <Button size="sm" variant="ghost" onClick={() => setShowNewLocation(false)}>Cancel</Button>
            </div>
          )}

          {locations.length > 0 && (
            <div className="flex flex-wrap gap-2 pt-1">
              {locations.map(loc => (
                <span key={loc._id} className={`inline-flex items-center gap-1.5 text-xs px-2 py-0.5 rounded-full border ${locationId === loc._id ? 'bg-foreground text-background border-foreground' : 'border-border text-muted-foreground'}`}>
                  <MapPin className="h-2.5 w-2.5" />{loc.name} <span className="opacity-60">({loc.code})</span>
                </span>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
      )}

      {/* Upload + Compute Section */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-lg">Upload Shifts & Compute Pay Hours</CardTitle>
          <p className="text-sm text-muted-foreground font-normal pt-1">
            After a successful CSV upload, pay hours start automatically. Use Compute Pay Hours to re-run on the same file without re-uploading.
          </p>
        </CardHeader>
        <CardContent className="space-y-4">
          <div
            {...getRootProps()}
            className={`flex flex-col items-center justify-center rounded-lg border-2 border-dashed p-6 text-center cursor-pointer transition-colors ${
              isDragActive ? 'border-primary bg-primary/5' : 'border-muted-foreground/25 hover:border-primary/50'
            }`}
          >
            <input {...getInputProps()} />
            <Upload className="mb-2 h-6 w-6 text-muted-foreground" />
            {selectedFile ? (
              <p className="text-sm font-medium">{selectedFile.name}</p>
            ) : (
              <p className="text-sm text-muted-foreground">Drop a ShiftCare CSV or click to browse</p>
            )}
          </div>

          <div className="flex gap-3 flex-wrap">
            {selectedFile && (
              <Button onClick={handleUpload} disabled={uploadMutation.isPending || computeMutation.isPending}>
                {uploadMutation.isPending ? 'Uploading…' : 'Upload & compute pay hours'}
              </Button>
            )}
            <Button
              onClick={handleCompute}
              disabled={computeMutation.isPending || isJobActive}
              variant="default"
            >
              <Calculator className="h-4 w-4 mr-2" />
              {computeMutation.isPending || isJobActive ? 'Computing…' : 'Compute Pay Hours'}
            </Button>
          </div>

          {uploadResult && (
            <div className={`rounded-md p-3 text-sm ${uploadResult.success ? 'bg-green-50 text-green-800' : 'bg-red-50 text-red-800'}`}>
              <p>Shifts uploaded: {uploadResult.shiftsCreated} | Skipped: {uploadResult.shiftsSkipped}</p>
              {uploadResult.errors?.slice(0, 3).map((e, i) => (
                <p key={i} className="flex gap-1 mt-1"><AlertCircle className="h-3 w-3 mt-0.5 shrink-0" />{e}</p>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Job Status */}
      {activeJobId && jobStatus && (
        <Card>
          <CardContent className="pt-4">
            <div className="space-y-2">
              <div className="flex justify-between text-sm">
                <span>
                  {jobStatus.status === 'completed' ? '✓ Computation complete' :
                   jobStatus.status === 'failed' ? '✗ Computation failed' :
                   `Computing pay hours… (${jobStatus.staffProcessed || 0} staff processed)`}
                </span>
                <span className="font-medium">{jobStatus.progress || 0}%</span>
              </div>
              <div className="h-2 rounded-full bg-muted overflow-hidden">
                <div
                  className={`h-full rounded-full transition-all ${jobStatus.status === 'failed' ? 'bg-destructive' : 'bg-primary'}`}
                  style={{ width: `${jobStatus.progress || 0}%` }}
                />
              </div>
              {jobStatus.status === 'completed' && (
                <p className="text-xs text-green-600">
                  {jobStatus.payHoursCreated} pay hours records created
                  {periodStart && ` for period ${formatDate(jobStatus.periodStart)} – ${formatDate(jobStatus.periodEnd)}`}
                </p>
              )}
              {jobStatus.errors?.length > 0 && (
                <p className="text-xs text-destructive">{jobStatus.errors.length} errors encountered</p>
              )}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Holiday Manager */}
      <HolidayManager locationId={locationId} locations={locations} />

      {/* Pay Hours Table */}
      <Card>
        <CardHeader className="pb-3">
          <div className="flex items-center justify-between">
            <div>
              <CardTitle>Pay Hours</CardTitle>
              {periodStart && (
                <p className="text-sm text-muted-foreground mt-1">
                  Period: {formatDate(periodStart)} — {formatDate(periodEnd)}
                </p>
              )}
            </div>
            <Input
              placeholder="Filter by staff name…"
              value={staffFilter}
              onChange={(e) => setStaffFilter(e.target.value)}
              className="w-56"
            />
          </div>
        </CardHeader>
        <CardContent>{payHoursTableBody}</CardContent>
      </Card>
    </div>
  );
};
