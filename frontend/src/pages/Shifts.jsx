import { useState, useCallback } from 'react';
import { useDropzone } from 'react-dropzone';
import { toast } from 'sonner';
import { Upload, Download, ChevronRight, AlertCircle, MapPin } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '../ui/card';
import { Button } from '../ui/button';
import { Input } from '../ui/input';
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from '../ui/table';
import { useShifts, useUploadShifts } from '../api/shifts';
import { useLocations } from '../api/locations';
import { LoadingScreen } from '../ui/LoadingSpinner';
import { SchadsCalculator } from './SchadsCalculator';

const SHIFT_TYPE_LABELS = {
  personal_care: 'Personal Care',
  sleepover: 'Sleepover',
  nursing_support: 'Nursing Support',
};

const SHIFT_TYPE_COLORS = {
  personal_care: 'bg-blue-100 text-blue-800',
  sleepover: 'bg-purple-100 text-purple-800',
  nursing_support: 'bg-green-100 text-green-800',
};

export const Shifts = () => {
  const [activeTab, setActiveTab] = useState('shifts');
  const [search, setSearch] = useState('');
  const [shiftTypeFilter, setShiftTypeFilter] = useState('all');
  const [page, setPage] = useState(1);
  const [expandedRows, setExpandedRows] = useState({});
  const [uploadResult, setUploadResult] = useState(null);
  const [selectedFile, setSelectedFile] = useState(null);
  const [locationId, setLocationId] = useState('');

  const { data: locationsData } = useLocations();
  const locations = locationsData?.locations || [];

  const params = {
    search: search || undefined,
    shiftType: shiftTypeFilter !== 'all' ? shiftTypeFilter : undefined,
    broken: shiftTypeFilter === 'broken' ? 'true' : undefined,
    page,
    perPage: 50,
  };

  const { data, isLoading, error } = useShifts(params);
  const uploadMutation = useUploadShifts();

  const shifts = data?.shifts || [];
  const stats = data?.stats || {};
  const total = data?.total || 0;
  const totalPages = data?.totalPages || 1;

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
  });

  const handleUpload = async () => {
    if (!selectedFile) return;
    try {
      const result = await uploadMutation.mutateAsync({ file: selectedFile, locationId: locationId || null });
      setUploadResult(result);
      setSelectedFile(null);
      setPage(1);
      if (result.errors?.length > 0) {
        toast.warning(`Upload complete with ${result.errors.length} row errors`);
      } else {
        toast.success(`Uploaded ${result.shiftsCreated} shifts successfully`);
      }
    } catch (err) {
      toast.error(err.response?.data?.error || err.message || 'Upload failed');
    }
  };

  const handleFilterChange = (type) => {
    setShiftTypeFilter(type);
    setPage(1);
  };

  const toggleRow = (id) => {
    setExpandedRows(prev => ({ ...prev, [id]: !prev[id] }));
  };

  const formatDateTime = (dt) => {
    if (!dt) return '-';
    return new Date(dt).toLocaleString('en-AU', { dateStyle: 'short', timeStyle: 'short' });
  };

  const formatDate = (dt) => {
    if (!dt) return '-';
    return new Date(dt).toLocaleDateString('en-AU', { weekday: 'short', day: 'numeric', month: 'short', year: 'numeric' });
  };

  const filterButtons = [
    { key: 'all', label: 'All' },
    { key: 'personal_care', label: 'Personal Care' },
    { key: 'sleepover', label: 'Sleepover' },
    { key: 'nursing_support', label: 'Nursing' },
    { key: 'broken', label: 'Broken Shifts' },
  ];

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h2 className="text-3xl font-bold">Shifts</h2>
        <div className="flex items-center gap-2">
          <Button
            variant={activeTab === 'shifts' ? 'default' : 'outline'}
            size="sm"
            onClick={() => setActiveTab('shifts')}
          >
            Shifts
          </Button>
          <Button
            variant={activeTab === 'calculator' ? 'default' : 'outline'}
            size="sm"
            onClick={() => setActiveTab('calculator')}
          >
            Pay Calculator
          </Button>
          {activeTab === 'shifts' && (
            <a
              href="/api/shifts/export"
              className="inline-flex items-center gap-2 rounded-md border border-input bg-background px-4 py-2 text-sm font-medium shadow-sm hover:bg-accent"
            >
              <Download className="h-4 w-4" />
              Export CSV
            </a>
          )}
        </div>
      </div>

      {activeTab === 'calculator' && <SchadsCalculator />}

      {activeTab === 'shifts' && <>
      {/* Upload Section */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-lg">Upload Shifts CSV</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          {/* Location selector */}
          <div className="flex items-center gap-3">
            <MapPin className="h-4 w-4 text-muted-foreground shrink-0" />
            <span className="text-sm font-medium">Location</span>
            <select
              value={locationId}
              onChange={e => setLocationId(e.target.value)}
              className="h-9 rounded-md border border-input bg-background px-3 text-sm min-w-[200px]"
            >
              <option value="">No location</option>
              {locations.map(loc => (
                <option key={loc._id} value={loc._id}>{loc.name} ({loc.code})</option>
              ))}
            </select>
          </div>

          <div
            {...getRootProps()}
            className={`flex flex-col items-center justify-center rounded-lg border-2 border-dashed p-8 text-center cursor-pointer transition-colors ${
              isDragActive ? 'border-primary bg-primary/5' : 'border-muted-foreground/25 hover:border-primary/50'
            }`}
          >
            <input {...getInputProps()} />
            <Upload className="mb-2 h-8 w-8 text-muted-foreground" />
            {selectedFile ? (
              <p className="text-sm font-medium">{selectedFile.name}</p>
            ) : isDragActive ? (
              <p className="text-sm text-muted-foreground">Drop the CSV file here</p>
            ) : (
              <>
                <p className="text-sm font-medium">Drag and drop a ShiftCare export CSV</p>
                <p className="text-xs text-muted-foreground mt-1">or click to browse</p>
              </>
            )}
          </div>

          {selectedFile && (
            <div className="flex items-center gap-3">
              <Button
                onClick={handleUpload}
                disabled={uploadMutation.isPending}
              >
                {uploadMutation.isPending ? 'Uploading…' : 'Upload Shifts'}
              </Button>
              <Button variant="outline" onClick={() => setSelectedFile(null)}>
                Clear
              </Button>
            </div>
          )}

          {uploadResult && (
            <div className={`rounded-md p-4 text-sm ${uploadResult.success ? 'bg-green-50 text-green-800' : 'bg-red-50 text-red-800'}`}>
              <p className="font-medium">
                {uploadResult.success ? 'Upload successful' : 'Upload failed'}
              </p>
              <p>Rows processed: {uploadResult.rowsProcessed} | Shifts created: {uploadResult.shiftsCreated} | Skipped: {uploadResult.shiftsSkipped}</p>
              {uploadResult.errors?.slice(0, 5).map((e, i) => (
                <p key={i} className="mt-1 flex items-start gap-1">
                  <AlertCircle className="h-3 w-3 mt-0.5 shrink-0" />
                  {e}
                </p>
              ))}
              {uploadResult.errors?.length > 5 && (
                <p className="mt-1 text-muted-foreground">…and {uploadResult.errors.length - 5} more errors</p>
              )}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Summary Stats */}
      {stats.totalCount > 0 && (
        <div className="grid gap-4 md:grid-cols-6">
          {[
            { label: 'Total Shifts', value: stats.totalCount },
            { label: 'Broken Shifts', value: stats.brokenCount, className: 'text-orange-600' },
            { label: 'Total Hours', value: stats.totalHours?.toFixed(2) },
            { label: 'Personal Care', value: stats.personalCareCount },
            { label: 'Sleepovers', value: stats.sleepoversCount },
            { label: 'Nursing', value: stats.nursingCount },
          ].map(({ label, value, className }) => (
            <Card key={label}>
              <CardContent className="pt-6">
                <div className={`text-2xl font-bold ${className || ''}`}>{value ?? 0}</div>
                <p className="text-xs text-muted-foreground">{label}</p>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      {stats.minStart && (
        <p className="text-sm text-muted-foreground">
          Date range: <span className="font-medium">{formatDate(stats.minStart)}</span> — <span className="font-medium">{formatDate(stats.maxEnd)}</span>
        </p>
      )}

      {/* Filters */}
      <Card>
        <CardContent className="pt-4">
          <div className="flex flex-wrap gap-3 items-center">
            <Input
              placeholder="Search staff or client…"
              value={search}
              onChange={(e) => { setSearch(e.target.value); setPage(1); }}
              className="w-64"
            />
            <div className="flex gap-2 flex-wrap">
              {filterButtons.map(({ key, label }) => (
                <Button
                  key={key}
                  variant={shiftTypeFilter === key ? 'default' : 'outline'}
                  size="sm"
                  onClick={() => handleFilterChange(key)}
                >
                  {label}
                </Button>
              ))}
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Shifts Table */}
      <Card>
        <CardHeader>
          <CardTitle>Shift Records {total > 0 && <span className="text-sm font-normal text-muted-foreground">({total} total)</span>}</CardTitle>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <LoadingScreen message="Loading shifts…" />
          ) : error ? (
            <div className="text-center py-8 text-destructive">
              <p>Error loading shifts: {error.message}</p>
            </div>
          ) : shifts.length === 0 ? (
            <div className="text-center py-12 text-muted-foreground">
              <p className="text-lg">No shifts found</p>
              <p className="text-sm mt-1">Upload a ShiftCare CSV to get started</p>
            </div>
          ) : (
            <>
              <div className="rounded-md border overflow-hidden overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow className="bg-muted/50">
                      <TableHead className="w-8"></TableHead>
                      <TableHead>Staff</TableHead>
                      <TableHead>Client</TableHead>
                      <TableHead>Date</TableHead>
                      <TableHead>Start</TableHead>
                      <TableHead>End</TableHead>
                      <TableHead>Hours</TableHead>
                      <TableHead>Type</TableHead>
                      <TableHead>Broken</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {shifts.map((shift) => (
                      <>
                        <TableRow
                          key={shift._id}
                          className="cursor-pointer hover:bg-muted/50"
                          onClick={() => toggleRow(shift._id)}
                        >
                          <TableCell>
                            <ChevronRight className={`h-4 w-4 transition-transform ${expandedRows[shift._id] ? 'rotate-90' : ''}`} />
                          </TableCell>
                          <TableCell className="font-medium">{shift.staffName}</TableCell>
                          <TableCell className="text-muted-foreground">{shift.clientName || '-'}</TableCell>
                          <TableCell>{formatDate(shift.startDatetime)}</TableCell>
                          <TableCell className="font-mono text-sm">
                            {shift.startDatetime ? new Date(shift.startDatetime).toLocaleTimeString('en-AU', { hour: '2-digit', minute: '2-digit' }) : '-'}
                          </TableCell>
                          <TableCell className="font-mono text-sm">
                            {shift.endDatetime ? new Date(shift.endDatetime).toLocaleTimeString('en-AU', { hour: '2-digit', minute: '2-digit' }) : '-'}
                          </TableCell>
                          <TableCell className="font-semibold">{shift.hours?.toFixed(2)}</TableCell>
                          <TableCell>
                            <span className={`inline-flex items-center px-2 py-0.5 rounded text-xs font-medium ${SHIFT_TYPE_COLORS[shift.shiftType] || 'bg-gray-100 text-gray-800'}`}>
                              {SHIFT_TYPE_LABELS[shift.shiftType] || shift.shiftType}
                            </span>
                          </TableCell>
                          <TableCell>
                            {shift.isBrokenShift && (
                              <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-orange-100 text-orange-800">
                                Broken
                              </span>
                            )}
                          </TableCell>
                        </TableRow>

                        {expandedRows[shift._id] && (
                          <TableRow key={`${shift._id}-detail`}>
                            <TableCell colSpan={9} className="bg-muted/20 p-0">
                              <div className="p-4 grid grid-cols-2 md:grid-cols-4 gap-4 text-sm">
                                {shift.address && (
                                  <div>
                                    <span className="text-muted-foreground block">Address</span>
                                    <span>{shift.address}</span>
                                  </div>
                                )}
                                {shift.notes && (
                                  <div className="col-span-2">
                                    <span className="text-muted-foreground block">Notes</span>
                                    <span>{shift.notes}</span>
                                  </div>
                                )}
                                {shift.mileage != null && (
                                  <div>
                                    <span className="text-muted-foreground block">Mileage</span>
                                    <span>{shift.mileage} km</span>
                                  </div>
                                )}
                                {shift.expense != null && (
                                  <div>
                                    <span className="text-muted-foreground block">Expense</span>
                                    <span>${shift.expense}</span>
                                  </div>
                                )}
                                {shift.clockinDatetime && (
                                  <div>
                                    <span className="text-muted-foreground block">Clock In</span>
                                    <span>{formatDateTime(shift.clockinDatetime)}</span>
                                  </div>
                                )}
                                {shift.clockoutDatetime && (
                                  <div>
                                    <span className="text-muted-foreground block">Clock Out</span>
                                    <span>{formatDateTime(shift.clockoutDatetime)}</span>
                                  </div>
                                )}
                                {shift.shiftStatus && (
                                  <div>
                                    <span className="text-muted-foreground block">Status</span>
                                    <span className="capitalize">{shift.shiftStatus}</span>
                                  </div>
                                )}
                                <div>
                                  <span className="text-muted-foreground block">Timezone</span>
                                  <span>{shift.timezoneOffset}</span>
                                </div>
                              </div>
                            </TableCell>
                          </TableRow>
                        )}
                      </>
                    ))}
                  </TableBody>
                </Table>
              </div>

              {/* Pagination */}
              {totalPages > 1 && (
                <div className="mt-4 flex items-center justify-between">
                  <p className="text-sm text-muted-foreground">
                    Page {page} of {totalPages} ({total} shifts)
                  </p>
                  <div className="flex gap-2">
                    <Button variant="outline" size="sm" onClick={() => setPage(p => Math.max(1, p - 1))} disabled={page === 1}>
                      ← Previous
                    </Button>
                    <Button variant="outline" size="sm" onClick={() => setPage(p => p + 1)} disabled={page >= totalPages}>
                      Next →
                    </Button>
                  </div>
                </div>
              )}
            </>
          )}
        </CardContent>
      </Card>
      </>}
    </div>
  );
};
