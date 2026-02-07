import { useState, useEffect } from 'react';
import { useStaff } from '../api/staff';
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

export const Staff = () => {
  const [searchTerm, setSearchTerm] = useState('');
  const [debouncedSearchTerm, setDebouncedSearchTerm] = useState('');
  const [page, setPage] = useState(1);
  const perPage = 20;

  // Debounce the search term
  useEffect(() => {
    const timer = setTimeout(() => {
      setDebouncedSearchTerm(searchTerm);
      setPage(1); // Reset to page 1 when search changes
    }, 300);
    return () => clearTimeout(timer);
  }, [searchTerm]);

  const params = {
    filter_by_name: debouncedSearchTerm || undefined,
    include_metadata: true,
    per_page: perPage,
    page,
    sort_by: 'name',
    sort_type: 'asc',
  };

  const { data, isLoading, error } = useStaff(params);

  const staff = data?.staff || [];
  const metadata = data?._metadata;

  const handleSearch = (e) => {
    e.preventDefault();
    // Immediate search on form submit
    setDebouncedSearchTerm(searchTerm);
    setPage(1);
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h2 className="text-3xl font-bold">Staff</h2>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Staff List</CardTitle>
          <form onSubmit={handleSearch} className="mt-4">
            <div className="flex gap-2">
              <Input
                type="text"
                placeholder="Search by name..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="max-w-sm"
              />
              <Button type="submit">Search</Button>
            </div>
          </form>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <div className="text-center py-8">Loading staff...</div>
          ) : error ? (
            <div className="text-center py-8 text-destructive">
              Error loading staff: {error.message}
            </div>
          ) : staff.length === 0 ? (
            <div className="text-center py-8 text-muted-foreground">
              No staff found
            </div>
          ) : (
            <>
              <div className="rounded-md border">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>ID</TableHead>
                      <TableHead>Name</TableHead>
                      <TableHead>Email</TableHead>
                      <TableHead>Role</TableHead>
                      <TableHead>Phone</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {staff.map((member) => (
                      <TableRow key={member.id}>
                        <TableCell className="font-medium">{member.id}</TableCell>
                        <TableCell>{member.name || `${member.first_name} ${member.family_name}`}</TableCell>
                        <TableCell>{member.email || 'N/A'}</TableCell>
                        <TableCell>{member.role || 'N/A'}</TableCell>
                        <TableCell>{member.mobile_number || member.phone_number || 'N/A'}</TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
              {metadata && (
                <div className="mt-4 flex items-center justify-between">
                  <div className="text-sm text-muted-foreground">
                    Showing page {metadata.current_page} of {metadata.total_pages} (
                    {metadata.total_count} total)
                  </div>
                  <div className="flex gap-2">
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => setPage((p) => Math.max(1, p - 1))}
                      disabled={page === 1}
                    >
                      Previous
                    </Button>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => setPage((p) => p + 1)}
                      disabled={page >= metadata.total_pages}
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
    </div>
  );
};
