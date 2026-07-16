import { useState, useEffect, useMemo, useCallback } from 'react';
import { useAllClients } from '../api/clients';
import { Card, CardContent, CardHeader } from '../ui/card';
import { Input } from '../ui/input';
import {
  Table,
  TableBody,
  TableCell,
  TableHeader,
  TableRow,
} from '../ui/table';
import { SortableTableHead } from '../ui/sortable-table-head';
import { Button } from '../ui/button';
import { Badge } from '../ui/badge';
import { LoadingScreen } from '../ui/LoadingSpinner';
import { QueryErrorState } from '../components/QueryErrorState';
import { PageHeader } from '../components/PageHeader';

function clientDisplayName(client) {
  return client.display_name || `${client.first_name || ''} ${client.family_name || ''}`.trim();
}

function clientPhone(client) {
  return client.mobile_number || client.phone_number || '';
}

function filterClientsByName(rows, term) {
  const q = term.trim().toLowerCase();
  if (!q) return rows;
  return rows.filter((client) => clientDisplayName(client).toLowerCase().includes(q));
}

function sortClients(rows, sortBy, sortType) {
  const dir = sortType === 'asc' ? 1 : -1;
  return [...rows].sort((a, b) => {
    let cmp = 0;
    switch (sortBy) {
      case 'id':
        cmp = String(a.id).localeCompare(String(b.id), undefined, { numeric: true });
        break;
      case 'name':
        cmp = clientDisplayName(a).localeCompare(clientDisplayName(b));
        break;
      case 'email':
        cmp = (a.email || '').localeCompare(b.email || '');
        break;
      case 'phone':
        cmp = clientPhone(a).localeCompare(clientPhone(b), undefined, { numeric: true });
        break;
      case 'address':
        cmp = (a.address || '').localeCompare(b.address || '');
        break;
      default:
        cmp = clientDisplayName(a).localeCompare(clientDisplayName(b));
    }
    if (cmp !== 0) return cmp * dir;
    return clientDisplayName(a).localeCompare(clientDisplayName(b)) * dir;
  });
}

function paginateList(rows, page, perPage) {
  const totalCount = rows.length;
  const totalPages = Math.max(1, Math.ceil(totalCount / perPage));
  const currentPage = Math.min(Math.max(1, page), totalPages);
  const start = (currentPage - 1) * perPage;
  return {
    slice: rows.slice(start, start + perPage),
    metadata: {
      total_count: totalCount,
      total_pages: totalPages,
      current_page: currentPage,
    },
  };
}

export const Clients = () => {
  const [searchTerm, setSearchTerm] = useState('');
  const [debouncedSearchTerm, setDebouncedSearchTerm] = useState('');
  const [page, setPage] = useState(1);
  const [sortBy, setSortBy] = useState('name');
  const [sortType, setSortType] = useState('asc');
  const perPage = 20;

  useEffect(() => {
    const timer = setTimeout(() => {
      setDebouncedSearchTerm(searchTerm);
      setPage(1);
    }, 300);
    return () => clearTimeout(timer);
  }, [searchTerm]);

  const { data: allClients = [], isLoading, error } = useAllClients();

  const { displayedClients, metadata, hasResults } = useMemo(() => {
    const filtered = filterClientsByName(allClients, debouncedSearchTerm);
    const sorted = sortClients(filtered, sortBy, sortType);
    const { slice, metadata: pageMeta } = paginateList(sorted, page, perPage);
    return {
      displayedClients: slice,
      metadata: pageMeta,
      hasResults: filtered.length > 0,
    };
  }, [allClients, debouncedSearchTerm, sortBy, sortType, page, perPage]);

  useEffect(() => {
    if (page > metadata.total_pages) {
      setPage(metadata.total_pages);
    }
  }, [page, metadata.total_pages]);

  const handleSort = useCallback((key) => {
    setPage(1);
    setSortBy((prev) => {
      if (prev === key) {
        setSortType((t) => (t === 'asc' ? 'desc' : 'asc'));
        return prev;
      }
      setSortType('asc');
      return key;
    });
  }, []);

  const handleSearch = (e) => {
    e.preventDefault();
    setDebouncedSearchTerm(searchTerm);
    setPage(1);
  };

  return (
    <div className="space-y-4">
      <PageHeader
        title="Clients"
        hint="ShiftCare participant directory — synced from your roster system."
      />

      <Card>
        <CardHeader className="border-b pb-3">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div className="flex items-center gap-2">
              <span className="text-sm font-semibold">Directory</span>
              {allClients.length > 0 && (
                <Badge variant="default">{allClients.length}</Badge>
              )}
            </div>
            <form onSubmit={handleSearch} className="flex gap-2">
              <Input
                type="search"
                placeholder="Search by name…"
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="h-8 w-48 sm:w-56"
              />
              <Button type="submit" size="sm">
                Search
              </Button>
            </form>
          </div>
        </CardHeader>
        <CardContent className="p-0 pb-4">
          {isLoading ? (
            <div className="px-4 py-8">
              <LoadingScreen message="Loading clients..." />
            </div>
          ) : error ? (
            <div className="px-4 py-4">
              <QueryErrorState error={error} title="Failed to load clients" className="border-0 shadow-none" />
            </div>
          ) : !hasResults ? (
            <div className="px-4 py-8 text-center text-muted-foreground">
              No clients found
            </div>
          ) : (
            <>
              <Table>
                <TableHeader>
                  <TableRow>
                    <SortableTableHead
                      label="ID"
                      sortKey="id"
                      activeSortKey={sortBy}
                      sortType={sortType}
                      onSort={handleSort}
                    />
                    <SortableTableHead
                      label="Name"
                      sortKey="name"
                      activeSortKey={sortBy}
                      sortType={sortType}
                      onSort={handleSort}
                    />
                    <SortableTableHead
                      label="Email"
                      sortKey="email"
                      activeSortKey={sortBy}
                      sortType={sortType}
                      onSort={handleSort}
                    />
                    <SortableTableHead
                      label="Phone"
                      sortKey="phone"
                      activeSortKey={sortBy}
                      sortType={sortType}
                      onSort={handleSort}
                    />
                    <SortableTableHead
                      label="Address"
                      sortKey="address"
                      activeSortKey={sortBy}
                      sortType={sortType}
                      onSort={handleSort}
                    />
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {displayedClients.map((client) => (
                    <TableRow key={client.id}>
                      <TableCell className="font-medium">{client.id}</TableCell>
                      <TableCell>{clientDisplayName(client)}</TableCell>
                      <TableCell>{client.email || 'N/A'}</TableCell>
                      <TableCell>{clientPhone(client) || 'N/A'}</TableCell>
                      <TableCell>{client.address || 'N/A'}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
              {metadata && (
                <div className="flex items-center justify-between px-4 pt-4">
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
                      disabled={page >= metadata.total_pages || metadata.current_page >= metadata.total_pages}
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
