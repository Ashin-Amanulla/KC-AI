import { useState, useMemo } from 'react';
import { useShifts } from '../api/shifts';
import { useStaff } from '../api/staff';
import { useClients } from '../api/clients';
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

export const Dashboard = () => {
  const [fromDate, setFromDate] = useState(() => {
    const date = new Date();
    date.setDate(date.getDate() - 7); // Default to 7 days ago
    return date.toISOString().split('T')[0];
  });
  const [toDate, setToDate] = useState(() => {
    return new Date().toISOString().split('T')[0];
  });

  const shiftsParams = useMemo(
    () => ({
      from_date: fromDate,
      to_date: toDate,
      include_clients: true,
      include_metadata: true,
      per_page: 20,
      page: 1,
    }),
    [fromDate, toDate]
  );

  const { data: shiftsData, isLoading: shiftsLoading } = useShifts(shiftsParams);
  const { data: staffData, isLoading: staffLoading } = useStaff({ per_page: 1, include_metadata: true });
  const { data: clientsData, isLoading: clientsLoading } = useClients({ per_page: 1, include_metadata: true });

  const shifts = shiftsData?.shifts || [];
  const shiftsMetadata = shiftsData?._metadata;
  const totalShifts = shiftsMetadata?.total_count || shifts.length;
  const totalStaff = staffData?._metadata?.total_count || staffData?.staff?.length || 0;
  const totalClients = clientsData?._metadata?.total_count || clientsData?.clients?.length || 0;

  const formatDateTime = (dateString) => {
    if (!dateString) return 'N/A';
    const date = new Date(dateString);
    return date.toLocaleString();
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h2 className="text-3xl font-bold">Dashboard</h2>
        <div className="flex items-center space-x-4">
          <div>
            <label className="text-sm font-medium mr-2">From:</label>
            <Input
              type="date"
              value={fromDate}
              onChange={(e) => setFromDate(e.target.value)}
              className="w-40"
            />
          </div>
          <div>
            <label className="text-sm font-medium mr-2">To:</label>
            <Input
              type="date"
              value={toDate}
              onChange={(e) => setToDate(e.target.value)}
              className="w-40"
            />
          </div>
        </div>
      </div>

      {/* Summary Cards */}
      <div className="grid gap-4 md:grid-cols-3">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total Shifts</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {shiftsLoading ? '...' : totalShifts}
            </div>
            <p className="text-xs text-muted-foreground">
              In selected date range
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total Staff</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {staffLoading ? '...' : totalStaff}
            </div>
            <p className="text-xs text-muted-foreground">Active staff members</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total Clients</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {clientsLoading ? '...' : totalClients}
            </div>
            <p className="text-xs text-muted-foreground">Active clients</p>
          </CardContent>
        </Card>
      </div>

      {/* Shifts Table */}
      <Card>
        <CardHeader>
          <CardTitle>Recent Shifts</CardTitle>
        </CardHeader>
        <CardContent>
          {shiftsLoading ? (
            <div className="text-center py-8">Loading shifts...</div>
          ) : shifts.length === 0 ? (
            <div className="text-center py-8 text-muted-foreground">
              No shifts found in the selected date range
            </div>
          ) : (
            <div className="rounded-md border">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>ID</TableHead>
                    <TableHead>Start Time</TableHead>
                    <TableHead>End Time</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead>Clients</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {shifts.map((shift) => (
                    <TableRow key={shift.id}>
                      <TableCell className="font-medium">{shift.id}</TableCell>
                      <TableCell>{formatDateTime(shift.start_at)}</TableCell>
                      <TableCell>{formatDateTime(shift.end_at)}</TableCell>
                      <TableCell>
                        <span
                          className={`px-2 py-1 rounded-full text-xs ${
                            shift.is_approved
                              ? 'bg-green-100 text-green-800'
                              : 'bg-yellow-100 text-yellow-800'
                          }`}
                        >
                          {shift.is_approved ? 'Approved' : 'Pending'}
                        </span>
                      </TableCell>
                      <TableCell>
                        {shift.clients?.length > 0
                          ? shift.clients.map((c) => c.display_name || c.first_name).join(', ')
                          : 'N/A'}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          )}
          {shiftsMetadata && (
            <div className="mt-4 text-sm text-muted-foreground">
              Showing page {shiftsMetadata.current_page} of {shiftsMetadata.total_pages} (
              {shiftsMetadata.total_count} total)
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
};
