import { useState, useEffect } from 'react';
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
import { LoadingScreen } from '../ui/LoadingSpinner';

export const Clients = () => {
  const [searchTerm, setSearchTerm] = useState('');
  const [debouncedSearchTerm, setDebouncedSearchTerm] = useState('');
  const [page, setPage] = useState(1);
  const perPage = 20;

  // Debounce the search terms
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

  const { data, isLoading, error } = useClients(params);

  const clients = data?.clients || [];
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
        <h2 className="text-3xl font-bold">Clients</h2>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Client List</CardTitle>
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
            <LoadingScreen message="Loading clients..." />
          ) : error ? (
            <div className="text-center py-8 text-destructive">
              Error loading clients: {error.message}
            </div>
          ) : clients.length === 0 ? (
            <div className="text-center py-8 text-muted-foreground">
              No clients found
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
                      <TableHead>Phone</TableHead>
                      <TableHead>Address</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {clients.map((client) => (
                      <TableRow key={client.id}>
                        <TableCell className="font-medium">{client.id}</TableCell>
                        <TableCell>
                          {client.display_name ||
                            `${client.first_name} ${client.family_name}`}
                        </TableCell>
                        <TableCell>{client.email || 'N/A'}</TableCell>
                        <TableCell>
                          {client.mobile_number || client.phone_number || 'N/A'}
                        </TableCell>
                        <TableCell>{client.address || 'N/A'}</TableCell>
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
