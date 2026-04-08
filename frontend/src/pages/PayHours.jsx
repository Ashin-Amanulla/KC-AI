import { useState, useCallback } from 'react';
import { useDropzone } from 'react-dropzone';
import { toast } from 'sonner';
import { Upload, Download, ChevronRight, Plus, Trash2, AlertCircle, Calculator } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '../ui/card';
import { Button } from '../ui/button';
import { Input } from '../ui/input';
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from '../ui/table';
import { useUploadShifts } from '../api/shifts';
import { useHolidays, useCreateHoliday, useDeleteHoliday } from '../api/holidays';
import { usePayHours, useShiftPayHours, useComputePayHours, usePayHoursJobStatus } from '../api/payHours';
import { LoadingScreen } from '../ui/LoadingSpinner';

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

const HolidayManager = () => {
  const [newDate, setNewDate] = useState('');
  const [newName, setNewName] = useState('');
  const [collapsed, setCollapsed] = useState(true);

  const { data } = useHolidays();
  const createMutation = useCreateHoliday();
  const deleteMutation = useDeleteHoliday();

  const holidays = data?.holidays || [];

  const handleAdd = async () => {
    if (!newDate || !newName.trim()) return;
    try {
      await createMutation.mutateAsync({ date: newDate, name: newName.trim() });
      setNewDate('');
      setNewName('');
      toast.success('Holiday added');
    } catch (err) {
      toast.error(err.response?.data?.error || 'Failed to add holiday');
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

  return (
    <Card>
      <CardHeader className="pb-2 cursor-pointer select-none" onClick={() => setCollapsed(!collapsed)}>
        <CardTitle className="text-base flex items-center justify-between">
          <span>Holiday Manager ({holidays.length} holidays)</span>
          <ChevronRight className={`h-4 w-4 transition-transform ${collapsed ? '' : 'rotate-90'}`} />
        </CardTitle>
      </CardHeader>
      {!collapsed && (
        <CardContent className="space-y-4">
          <div className="flex gap-3 flex-wrap">
            <Input type="date" value={newDate} onChange={(e) => setNewDate(e.target.value)} className="w-44" />
            <Input placeholder="Holiday name" value={newName} onChange={(e) => setNewName(e.target.value)} className="w-56" />
            <Button onClick={handleAdd} disabled={!newDate || !newName.trim() || createMutation.isPending} size="sm">
              <Plus className="h-4 w-4 mr-1" /> Add Holiday
            </Button>
          </div>

          {holidays.length > 0 ? (
            <div className="rounded-md border overflow-hidden">
              <Table>
                <TableHeader>
                  <TableRow className="bg-muted/50">
                    <TableHead>Date</TableHead>
                    <TableHead>Name</TableHead>
                    <TableHead className="w-16"></TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {holidays.map((h) => (
                    <TableRow key={h._id}>
                      <TableCell>{new Date(h.date).toLocaleDateString('en-AU', { day: 'numeric', month: 'long', year: 'numeric' })}</TableCell>
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
            <p className="text-sm text-muted-foreground">No holidays configured. Add public holidays to ensure correct pay rate calculations.</p>
          )}
        </CardContent>
      )}
    </Card>
  );
};

// ─── Main Page ────────────────────────────────────────────────────────────────

export const PayHours = () => {
  const [staffFilter, setStaffFilter] = useState('');
  const [expandedRows, setExpandedRows] = useState({});
  const [selectedFile, setSelectedFile] = useState(null);
  const [uploadResult, setUploadResult] = useState(null);
  const [activeJobId, setActiveJobId] = useState(null);

  const uploadMutation = useUploadShifts();
  const computeMutation = useComputePayHours();
  const { data: jobStatus } = usePayHoursJobStatus(activeJobId);

  const { data: payHoursData, isLoading, refetch } = usePayHours(
    staffFilter ? { staffName: staffFilter } : {}
  );

  const payHours = payHoursData?.payHours || [];
  const periodStart = payHoursData?.periodStart;
  const periodEnd = payHoursData?.periodEnd;

  // When job completes, refetch pay hours
  if (activeJobId && jobStatus?.status === 'completed') {
    refetch();
  }

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
    disabled: uploadMutation.isPending || computeMutation.isPending,
  });

  const handleUpload = async () => {
    if (!selectedFile) return;
    try {
      const result = await uploadMutation.mutateAsync(selectedFile);
      setUploadResult(result);
      setSelectedFile(null);
      if (result.errors?.length > 0) {
        toast.warning(`Upload complete with ${result.errors.length} row errors`);
      } else {
        toast.success(`Uploaded ${result.shiftsCreated} shifts`);
      }
    } catch (err) {
      toast.error(err.response?.data?.error || err.message || 'Upload failed');
    }
  };

  const handleCompute = async () => {
    try {
      const result = await computeMutation.mutateAsync();
      setActiveJobId(result.jobId);
      toast.info('Pay hours computation started');
    } catch (err) {
      toast.error(err.response?.data?.error || 'Failed to start computation');
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

  const isJobActive = activeJobId && jobStatus && !['completed', 'failed'].includes(jobStatus.status);

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h2 className="text-3xl font-bold">Pay Hours</h2>
        {payHours.length > 0 && (
          <a
            href="/api/pay-hours/export"
            className="inline-flex items-center gap-2 rounded-md border border-input bg-background px-4 py-2 text-sm font-medium shadow-sm hover:bg-accent"
          >
            <Download className="h-4 w-4" />
            Export CSV
          </a>
        )}
      </div>

      {/* Upload + Compute Section */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-lg">Upload Shifts & Compute Pay Hours</CardTitle>
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
              <Button onClick={handleUpload} disabled={uploadMutation.isPending}>
                {uploadMutation.isPending ? 'Uploading…' : 'Upload Shifts'}
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
      <HolidayManager />

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
        <CardContent>
          {isLoading ? (
            <LoadingScreen message="Loading pay hours…" />
          ) : payHours.length === 0 ? (
            <div className="text-center py-12 text-muted-foreground">
              <Calculator className="mx-auto h-12 w-12 mb-3 opacity-30" />
              <p className="text-lg">No pay hours computed yet</p>
              <p className="text-sm mt-1">Upload shifts CSV and click "Compute Pay Hours" to generate results</p>
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
                    <TableHead className="text-right">OT&gt;76h</TableHead>
                    <TableHead className="text-right">Broken</TableHead>
                    <TableHead className="text-right">Sleep</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {payHours.map((ph) => (
                    <>
                      <TableRow
                        key={ph._id}
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
                        <TableCell className="text-right text-xs font-semibold">{h(ph.otAfter76Hours)}</TableCell>
                        <TableCell className="text-right text-xs">{ph.brokenShiftCount ?? 0}</TableCell>
                        <TableCell className="text-right text-xs">{ph.sleepoversCount ?? 0}</TableCell>
                      </TableRow>

                      {expandedRows[ph._id] && (
                        <TableRow key={`${ph._id}-detail`}>
                          <TableCell colSpan={20} className="p-0 bg-muted/10">
                            <ShiftDetail payHoursId={ph._id} />
                          </TableCell>
                        </TableRow>
                      )}
                    </>
                  ))}
                </TableBody>
              </Table>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
};
