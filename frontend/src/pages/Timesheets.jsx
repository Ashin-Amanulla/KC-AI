import { useState, useMemo, useEffect } from 'react';
import { useTimesheets } from '../api/timesheets';
import { Card, CardContent, CardHeader, CardTitle } from '../ui/card';
import { Input } from '../ui/input';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '../ui/table';
import { Button } from '../ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '../ui/select';
import { LoadingScreen } from '../ui/LoadingSpinner';
import { QueryErrorState } from '../components/QueryErrorState';
import { PageHeader } from '../components/PageHeader';
import { StatCard } from '../ui/stat-card';
import { Badge } from '../ui/badge';
import { ClipboardList, Clock, CheckCircle2, CircleDashed } from 'lucide-react';

const STATUS_FILTERS = [
  { key: 'all', label: 'All status' },
  { key: 'approved', label: 'Approved only' },
];

export const Timesheets = () => {
  const [fromDate, setFromDate] = useState(() => {
    const date = new Date();
    date.setDate(date.getDate() - 7);
    return date.toISOString().split('T')[0];
  });
  const [toDate, setToDate] = useState(() => {
    return new Date().toISOString().split('T')[0];
  });
  const [page, setPage] = useState(1);
  const [approvedOnly, setApprovedOnly] = useState(false);
  const [expandedRows, setExpandedRows] = useState({});
  const perPage = 20;

  const params = useMemo(() => ({
    from: fromDate ? `${fromDate}T00:00:00Z` : undefined,
    to: toDate ? `${toDate}T23:59:59Z` : undefined,
    approved_only: approvedOnly,
    include_metadata: true,
    include_staff: true,
    include_payable_external_ids: true,
    per_page: perPage,
    page,
  }), [fromDate, toDate, approvedOnly, page]);

  const { data, isLoading, error } = useTimesheets(params);

  const timesheets = data?.timesheets || [];
  const metadata = data?._metadata;

  const toggleRowExpand = (id) => {
    setExpandedRows(prev => ({
      ...prev,
      [id]: !prev[id]
    }));
  };

  const formatDateTime = (dateString) => {
    if (!dateString) return 'N/A';
    const date = new Date(dateString);
    return date.toLocaleString('en-AU', {
      dateStyle: 'medium',
      timeStyle: 'short'
    });
  };

  const formatDate = (dateString) => {
    if (!dateString) return 'N/A';
    const date = new Date(dateString);
    return date.toLocaleDateString('en-AU', {
      weekday: 'short',
      day: 'numeric',
      month: 'short',
      year: 'numeric'
    });
  };

  const formatDuration = (minutes) => {
    if (!minutes && minutes !== 0) return 'N/A';
    const hours = Math.floor(minutes / 60);
    const mins = minutes % 60;
    if (hours === 0) return `${mins}m`;
    if (mins === 0) return `${hours}h`;
    return `${hours}h ${mins}m`;
  };

  const formatCurrency = (amount) => {
    if (!amount && amount !== 0) return '-';
    return new Intl.NumberFormat('en-AU', {
      style: 'currency',
      currency: 'AUD'
    }).format(amount);
  };

  const calculateTotals = () => {
    let totalMinutes = 0;
    let totalAmount = 0;
    let approvedCount = 0;
    let pendingCount = 0;

    timesheets.forEach(ts => {
      totalMinutes += ts.total_minutes || ts.duration_minutes || 0;
      totalAmount += ts.total_amount || ts.amount || 0;
      if (ts.approved || ts.is_approved) {
        approvedCount++;
      } else {
        pendingCount++;
      }
    });

    return { totalMinutes, totalAmount, approvedCount, pendingCount };
  };

  const totals = calculateTotals();
  const statusFilter = approvedOnly ? 'approved' : 'all';

  useEffect(() => {
    setPage(1);
    setExpandedRows({});
  }, [fromDate, toDate, approvedOnly]);

  return (
    <div className="page-stack">
      <PageHeader
        title="Timesheets"
        hint="ShiftCare timesheet entries — filter by date range and approval status."
      />

      <div className="filter-toolbar">
        <div className="flex items-center gap-1.5">
          <span className="text-2xs text-muted-foreground">From</span>
          <Input
            type="date"
            value={fromDate}
            onChange={(e) => setFromDate(e.target.value)}
            aria-label="From date"
            className="filter-control-date"
          />
        </div>
        <div className="flex items-center gap-1.5">
          <span className="text-2xs text-muted-foreground">To</span>
          <Input
            type="date"
            value={toDate}
            onChange={(e) => setToDate(e.target.value)}
            aria-label="To date"
            className="filter-control-date"
          />
        </div>
        <Select
          value={statusFilter}
          onValueChange={(value) => setApprovedOnly(value === 'approved')}
        >
          <SelectTrigger className="filter-control w-[8.5rem]">
            <SelectValue placeholder="Status" />
          </SelectTrigger>
          <SelectContent>
            {STATUS_FILTERS.map(({ key, label }) => (
              <SelectItem key={key} value={key} className="text-2xs">
                {label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        <span className="ml-auto text-2xs tabular-nums text-muted-foreground">
          {isLoading
            ? 'Loading…'
            : `${metadata?.total_count ?? timesheets.length} record${(metadata?.total_count ?? timesheets.length) !== 1 ? 's' : ''}`}
        </span>
      </div>

      {/* Summary Cards */}
      {!isLoading && timesheets.length > 0 && (
        <div className="grid gap-2 sm:grid-cols-4">
          <StatCard icon={ClipboardList} label="Total Records" value={timesheets.length} className="px-3 py-2" />
          <StatCard icon={Clock} label="Total Hours" value={formatDuration(totals.totalMinutes)} className="px-3 py-2" />
          <StatCard icon={CheckCircle2} tone="success" label="Approved" value={totals.approvedCount} className="px-3 py-2" />
          <StatCard icon={CircleDashed} tone="warning" label="Pending" value={totals.pendingCount} className="px-3 py-2" />
        </div>
      )}

      {/* Timesheets Table */}
      <Card>
        <CardHeader>
          <CardTitle>Timesheet Records</CardTitle>
        </CardHeader>
        <CardContent className="p-0 pb-4">
          {isLoading ? (
            <div className="px-4 py-8">
              <LoadingScreen message="Loading timesheets..." />
            </div>
          ) : error ? (
            <div className="px-4 py-4">
              <QueryErrorState error={error} title="Failed to load timesheets" className="border-0 shadow-none" />
            </div>
          ) : timesheets.length === 0 ? (
            <div className="px-4 py-12 text-center text-muted-foreground">
              <p className="text-lg">No timesheets found</p>
              <p className="text-sm mt-1">Try adjusting your date range or filters</p>
            </div>
          ) : (
            <>
              <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead className="w-10"></TableHead>
                      <TableHead>ID</TableHead>
                      <TableHead>Staff</TableHead>
                      <TableHead>Date</TableHead>
                      <TableHead>Start Time</TableHead>
                      <TableHead>End Time</TableHead>
                      <TableHead>Duration</TableHead>
                      <TableHead>Status</TableHead>
                      <TableHead>Pay Items</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {timesheets.map((timesheet) => (
                      <>
                        <TableRow 
                          key={timesheet.id}
                          className="cursor-pointer hover:bg-muted/50 transition-colors"
                          onClick={() => toggleRowExpand(timesheet.id)}
                        >
                          <TableCell className="text-center">
                            <span className={`inline-block transition-transform ${expandedRows[timesheet.id] ? 'rotate-90' : ''}`}>
                              ▶
                            </span>
                          </TableCell>
                          <TableCell className="font-mono text-sm tabular-nums">{timesheet.id}</TableCell>
                          <TableCell>
                            <div className="font-medium">
                              {timesheet.staff?.name || timesheet.staff?.first_name || 'Unknown'}
                            </div>
                            {timesheet.staff?.email && (
                              <div className="text-xs text-muted-foreground">{timesheet.staff.email}</div>
                            )}
                          </TableCell>
                          <TableCell>{formatDate(timesheet.date || timesheet.start_at)}</TableCell>
                          <TableCell className="font-mono text-sm tabular-nums">
                            {timesheet.start_at ? new Date(timesheet.start_at).toLocaleTimeString('en-AU', { hour: '2-digit', minute: '2-digit' }) : '-'}
                          </TableCell>
                          <TableCell className="font-mono text-sm tabular-nums">
                            {timesheet.end_at ? new Date(timesheet.end_at).toLocaleTimeString('en-AU', { hour: '2-digit', minute: '2-digit' }) : '-'}
                          </TableCell>
                          <TableCell>
                            <span className="font-semibold tabular-nums">
                              {formatDuration(timesheet.total_minutes || timesheet.duration_minutes)}
                            </span>
                          </TableCell>
                          <TableCell>
                            <Badge variant={timesheet.approved || timesheet.is_approved ? 'success' : 'warning'}>
                              {timesheet.approved || timesheet.is_approved ? '✓ Approved' : '◐ Pending'}
                            </Badge>
                          </TableCell>
                          <TableCell>
                            <Badge variant="primary">
                              {timesheet.items?.length || timesheet.pay_items?.length || 0} items
                            </Badge>
                          </TableCell>
                        </TableRow>
                        
                        {/* Expanded Details Row */}
                        {expandedRows[timesheet.id] && (
                          <TableRow key={`${timesheet.id}-details`}>
                            <TableCell colSpan={9} className="bg-muted/30 p-0">
                              <div className="p-4 space-y-4">
                                {/* Timesheet Details Grid */}
                                <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm">
                                  <div>
                                    <span className="text-muted-foreground block">Staff ID</span>
                                    <span className="font-mono">{timesheet.staff_id || timesheet.staff?.id || 'N/A'}</span>
                                  </div>
                                  <div>
                                    <span className="text-muted-foreground block">Shift ID</span>
                                    <span className="font-mono">{timesheet.shift_id || 'N/A'}</span>
                                  </div>
                                  <div>
                                    <span className="text-muted-foreground block">Location</span>
                                    <span>{timesheet.location || timesheet.address || 'N/A'}</span>
                                  </div>
                                  <div>
                                    <span className="text-muted-foreground block">Client</span>
                                    <span>{timesheet.client_name || timesheet.client?.name || 'N/A'}</span>
                                  </div>
                                  {timesheet.approved_at && (
                                    <div>
                                      <span className="text-muted-foreground block">Approved At</span>
                                      <span>{formatDateTime(timesheet.approved_at)}</span>
                                    </div>
                                  )}
                                  {timesheet.approved_by && (
                                    <div>
                                      <span className="text-muted-foreground block">Approved By</span>
                                      <span>{timesheet.approved_by}</span>
                                    </div>
                                  )}
                                  {timesheet.break_minutes && (
                                    <div>
                                      <span className="text-muted-foreground block">Break Time</span>
                                      <span>{formatDuration(timesheet.break_minutes)}</span>
                                    </div>
                                  )}
                                  {(timesheet.total_amount || timesheet.amount) && (
                                    <div>
                                      <span className="text-muted-foreground block">Total Amount</span>
                                      <span className="font-semibold text-success tabular-nums">
                                        {formatCurrency(timesheet.total_amount || timesheet.amount)}
                                      </span>
                                    </div>
                                  )}
                                </div>

                                {/* Pay Items Table */}
                                {(timesheet.items?.length > 0 || timesheet.pay_items?.length > 0) && (
                                  <div>
                                    <h4 className="font-medium mb-2">Pay Items</h4>
                                    <div className="rounded border bg-background overflow-hidden">
                                      <Table>
                                        <TableHeader>
                                          <TableRow className="bg-muted/50">
                                            <TableHead>Pay Item</TableHead>
                                            <TableHead>Type</TableHead>
                                            <TableHead>Units</TableHead>
                                            <TableHead>Rate</TableHead>
                                            <TableHead>Amount</TableHead>
                                          </TableRow>
                                        </TableHeader>
                                        <TableBody>
                                          {(timesheet.items || timesheet.pay_items || []).map((item, idx) => (
                                            <TableRow key={idx}>
                                              <TableCell className="font-medium">
                                                {item.pay_item_name || item.name || `Item ${idx + 1}`}
                                              </TableCell>
                                              <TableCell>
                                                <Badge>{item.pay_item_type || item.type || 'Standard'}</Badge>
                                              </TableCell>
                                              <TableCell className="tabular-nums">
                                                {item.units || item.quantity || formatDuration(item.minutes)}
                                              </TableCell>
                                              <TableCell className="tabular-nums">{formatCurrency(item.rate)}</TableCell>
                                              <TableCell className="font-semibold tabular-nums">
                                                {formatCurrency(item.amount || item.total)}
                                              </TableCell>
                                            </TableRow>
                                          ))}
                                        </TableBody>
                                      </Table>
                                    </div>
                                  </div>
                                )}

                                {/* Notes Section */}
                                {timesheet.notes && (
                                  <div>
                                    <h4 className="font-medium mb-1">Notes</h4>
                                    <p className="text-sm text-muted-foreground bg-background p-2 rounded border">
                                      {timesheet.notes}
                                    </p>
                                  </div>
                                )}

                                {/* Raw Data (for debugging) */}
                                <details className="text-xs">
                                  <summary className="cursor-pointer text-muted-foreground hover:text-foreground">
                                    View Raw Data
                                  </summary>
                                  <pre className="mt-2 p-2 bg-background rounded border overflow-x-auto">
                                    {JSON.stringify(timesheet, null, 2)}
                                  </pre>
                                </details>
                              </div>
                            </TableCell>
                          </TableRow>
                        )}
                      </>
                    ))}
                  </TableBody>
              </Table>

              {/* Pagination */}
              {metadata && (
                <div className="mt-4 flex items-center justify-between">
                  <div className="text-sm text-muted-foreground">
                    Page <span className="font-medium">{metadata.current_page}</span> of{' '}
                    <span className="font-medium">{metadata.total_pages}</span>
                    {' '}({metadata.total_count} total records)
                  </div>
                  <div className="flex gap-2">
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => setPage((p) => Math.max(1, p - 1))}
                      disabled={page === 1}
                    >
                      ← Previous
                    </Button>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => setPage((p) => p + 1)}
                      disabled={page >= metadata.total_pages}
                    >
                      Next →
                    </Button>
                  </div>
                </div>
              )}
            </>
          )}
        </CardContent>
      </Card>
    </div>
  );
};
