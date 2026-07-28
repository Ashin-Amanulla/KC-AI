import { useState, useEffect, useMemo, useCallback, useRef } from 'react';
import { toast } from 'sonner';
import { useAllStaff, fetchAllStaffForRatesImport } from '../api/staff';
import { useLocations } from '../api/locations';
import { useStaffRates, useUpsertStaffRate, useDeleteStaffRate, useBulkImportStaffRates } from '../api/staffRates';
import { loadStaffRatesMapFromXlsx } from '../lib/staffRatesFromXlsx';
import { useAuthStore } from '../store/auth';
import { getErrorMessage } from '../utils/api';
import { cn } from '../lib/utils';
import { STAFF_RATES_TABLE_FIELDS, STAFF_RATES_NUMERIC_KEYS } from '../lib/staffRateFieldMeta';
import { r2, VEHICLE_RATE, normName } from '../lib/schadsWageCalc';
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
import { LoadingScreen } from '../ui/LoadingSpinner';
import { QueryErrorState } from '../components/QueryErrorState';
import { PageHeader } from '../components/PageHeader';
import { FieldLabel, InfoHint } from '../components/InfoHint';
import { Badge } from '../ui/badge';
import { Label } from '../ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '../ui/select';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '../ui/dialog';
import { Tabs, TabsList, TabsTrigger, TabsContent } from '../ui/tabs';
import { Pencil, FileSpreadsheet, Users, CheckCircle2, XCircle, AlertCircle } from 'lucide-react';
import { StatCard } from '../ui/stat-card';

function defaultRatesRow(displayName) {
  const v = 0;
  return {
    name: displayName.trim(),
    daytime: v,
    nursingDaytime: v,
    nursingAfternoon: v,
    nursingNight: v,
    nursingSaturday: v,
    nursingSunday: v,
    nursingPh: v,
    afternoon: v,
    night: v,
    otUpto2: v,
    otAfter2: v,
    saturday: v,
    satOtAfter2: v,
    sunday: v,
    ph: v,
    mealAllow: 0,
    brokenShift: 0,
    sleepover: 90,
    sleepoverExtra: 0,
    kmRate: VEHICLE_RATE,
    allowance: 0,
    capRate: 0,
  };
}

function ratesToDraft(existing) {
  if (!existing) return null;
  const d = { ...defaultRatesRow(existing.name || 'Staff') };
  for (const k of STAFF_RATES_NUMERIC_KEYS) {
    if (existing[k] != null) d[k] = r2(parseFloat(existing[k]) || 0);
  }
  if (existing.sleepoverExtra != null) d.sleepoverExtra = r2(parseFloat(existing.sleepoverExtra) || 0);
  d.name = existing.name || d.name;
  return d;
}

function staffByNormName(members) {
  const m = new Map();
  for (const mem of members) {
    const display = mem.name || `${mem.first_name || ''} ${mem.family_name || ''}`.trim();
    const k = normName(display);
    if (!k) continue;
    if (!m.has(k)) m.set(k, { id: mem.id, displayName: display });
  }
  return m;
}

function memberDisplayName(member) {
  return member.name || `${member.first_name || ''} ${member.family_name || ''}`.trim();
}

function memberPhone(member) {
  return member.mobile_number || member.phone_number || '';
}

function filterStaffByName(rows, term) {
  const q = term.trim().toLowerCase();
  if (!q) return rows;
  return rows.filter((member) => memberDisplayName(member).toLowerCase().includes(q));
}

function sortStaff(rows, sortBy, sortType, ratesByStaffId, locationId) {
  const dir = sortType === 'asc' ? 1 : -1;
  return [...rows].sort((a, b) => {
    let cmp = 0;
    switch (sortBy) {
      case 'id':
        cmp = String(a.id).localeCompare(String(b.id), undefined, { numeric: true });
        break;
      case 'name':
        cmp = memberDisplayName(a).localeCompare(memberDisplayName(b));
        break;
      case 'alias': {
        const aliasA = (ratesByStaffId.get(String(a.id))?.aliases || []).join(', ');
        const aliasB = (ratesByStaffId.get(String(b.id))?.aliases || []).join(', ');
        cmp = aliasA.localeCompare(aliasB);
        break;
      }
      case 'email':
        cmp = (a.email || '').localeCompare(b.email || '');
        break;
      case 'role':
        cmp = (a.role || '').localeCompare(b.role || '');
        break;
      case 'phone':
        cmp = memberPhone(a).localeCompare(memberPhone(b), undefined, { numeric: true });
        break;
      case 'rates':
        if (locationId) {
          const aHas = ratesByStaffId.has(String(a.id)) ? 1 : 0;
          const bHas = ratesByStaffId.has(String(b.id)) ? 1 : 0;
          cmp = aHas - bHas;
        }
        break;
      default:
        cmp = memberDisplayName(a).localeCompare(memberDisplayName(b));
    }
    if (cmp !== 0) return cmp * dir;
    return memberDisplayName(a).localeCompare(memberDisplayName(b)) * dir;
  });
}

const SCHADS_RATE_FIELDS = STAFF_RATES_TABLE_FIELDS.filter(([field]) => field !== 'capRate');

function getStaffRoleBadge(role) {
  const raw = (role || '').trim();
  const key = raw.toLowerCase();
  if (!key) return { variant: 'default', label: 'N/A' };

  if (key.includes('admin')) return { variant: 'destructive', label: raw };
  if (key.includes('manager')) return { variant: 'warning', label: raw };
  if (key.includes('coordinator')) return { variant: 'primary', label: raw };
  if (key.includes('nurse') || key.includes('nursing')) return { variant: 'success', label: raw };
  if (
    key.includes('staff') ||
    key.includes('support') ||
    key.includes('carer') ||
    key.includes('worker')
  ) {
    return { variant: 'outline', label: raw };
  }

  return { variant: 'default', label: raw };
}

function hasCapRateSaved(dbRow) {
  return Number(dbRow?.rates?.capRate) > 0;
}

function hasSchadsRatesSaved(dbRow) {
  if (!dbRow?.rates) return false;
  const r = dbRow.rates;
  return SCHADS_RATE_FIELDS.some(([field]) => Number(r[field]) > 0);
}

function RateStatusCell({ saved, value, onEdit, loading, canEdit }) {
  return (
    <div className="flex items-center justify-end gap-1.5 min-w-[72px]">
      {loading ? (
        <span className="text-2xs text-muted-foreground">…</span>
      ) : saved ? (
        <CheckCircle2 className="h-4 w-4 text-success shrink-0" aria-label="Saved" />
      ) : (
        <XCircle className="h-4 w-4 text-destructive shrink-0" aria-label="Not saved" />
      )}
      {value ? <span className="tabular-nums text-xs text-body">{value}</span> : null}
      {canEdit && (
        <Button
          type="button"
          size="sm"
          variant="ghost"
          className="h-7 w-7 p-0 shrink-0 text-muted-foreground hover:text-ink"
          onClick={onEdit}
          title="Edit"
        >
          <Pencil className="h-3.5 w-3.5" />
        </Button>
      )}
    </div>
  );
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

export const Staff = () => {
  const user = useAuthStore((s) => s.user);
  const canEditRates = user?.role === 'super_admin' || user?.role === 'finance';

  const { data: locationsData } = useLocations();
  const locations = locationsData?.locations || [];
  const [locationId, setLocationId] = useState('');

  useEffect(() => {
    if (locationId || !locations.length) return;
    setLocationId(locations[0]._id);
  }, [locationId, locations]);

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

  const { data: allStaff = [], isLoading, error } = useAllStaff();
  const { data: staffRatesData, isLoading: ratesLoading } = useStaffRates(locationId);
  const upsertMutation = useUpsertStaffRate();
  const deleteMutation = useDeleteStaffRate();
  const bulkImportMutation = useBulkImportStaffRates();
  const ratesImportInputRef = useRef(null);
  const [importingXlsx, setImportingXlsx] = useState(false);

  const ratesByStaffId = useMemo(() => {
    const m = new Map();
    for (const r of staffRatesData?.staffRates || []) {
      m.set(String(r.shiftcareStaffId), r);
    }
    return m;
  }, [staffRatesData]);

  const { displayedStaff, metadata, hasResults } = useMemo(() => {
    const filtered = filterStaffByName(allStaff, debouncedSearchTerm);
    const sorted = sortStaff(filtered, sortBy, sortType, ratesByStaffId, locationId);
    const { slice, metadata: pageMeta } = paginateList(sorted, page, perPage);
    return {
      displayedStaff: slice,
      metadata: pageMeta,
      hasResults: filtered.length > 0,
    };
  }, [allStaff, debouncedSearchTerm, sortBy, sortType, ratesByStaffId, locationId, page, perPage]);

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

  const rateKpis = useMemo(() => {
    const total = allStaff.length;
    if (!locationId) {
      return { total, saved: null, notSet: null, coverage: null };
    }
    const saved = staffRatesData?.staffRates?.length ?? 0;
    const notSet = Math.max(0, total - saved);
    const coverage = total > 0 ? Math.round((saved / total) * 100) : 0;
    return { total, saved, notSet, coverage };
  }, [allStaff.length, locationId, staffRatesData?.staffRates?.length]);

  const [editing, setEditing] = useState(null);
  const [editTab, setEditTab] = useState('schads');
  const [draft, setDraft] = useState(null);
  const [aliasesDraft, setAliasesDraft] = useState('');

  const openEdit = (member, tab = 'schads') => {
    const displayName = member.name || `${member.first_name || ''} ${member.family_name || ''}`.trim();
    const dbRow = ratesByStaffId.get(String(member.id));
    const existing = dbRow?.rates;
    setDraft(ratesToDraft({ ...defaultRatesRow(displayName), ...existing, name: displayName }));
    setAliasesDraft((dbRow?.aliases || []).join(', '));
    setEditTab(tab);
    setEditing({ member, displayName });
  };

  const closeEdit = () => {
    setEditing(null);
    setEditTab('schads');
    setDraft(null);
    setAliasesDraft('');
  };

  const saveRates = useCallback(async () => {
    if (!editing || !draft || !locationId) return;
    const { member, displayName } = editing;
    try {
      await upsertMutation.mutateAsync({
        locationId,
        shiftcareStaffId: String(member.id),
        staffName: displayName,
        aliases: aliasesDraft.split(',').map(a => a.trim()).filter(Boolean),
        rates: {
          name: displayName,
          ...Object.fromEntries(STAFF_RATES_NUMERIC_KEYS.map((k) => [k, draft[k] ?? 0])),
          sleepoverExtra: draft.sleepoverExtra ?? 0,
        },
      });
      toast.success('Rates saved');
      closeEdit();
    } catch (e) {
      toast.error(getErrorMessage(e) || 'Save failed');
    }
  }, [editing, draft, aliasesDraft, locationId, upsertMutation]);

  const clearRates = useCallback(async () => {
    if (!editing || !locationId) return;
    const { member } = editing;
    if (!window.confirm('Remove saved SCHADS rates for this staff at this location?')) return;
    try {
      await deleteMutation.mutateAsync({
        locationId,
        shiftcareStaffId: String(member.id),
      });
      toast.success('Saved rates removed');
      closeEdit();
    } catch (e) {
      toast.error(getErrorMessage(e) || 'Delete failed');
    }
  }, [editing, locationId, deleteMutation]);

  const handleSearch = (e) => {
    e.preventDefault();
    setDebouncedSearchTerm(searchTerm);
    setPage(1);
  };

  const handleRatesXlsx = useCallback(
    async (e) => {
      const file = e.target.files?.[0];
      e.target.value = '';
      if (!file) return;
      if (!locationId) {
        toast.error('Select a location first');
        return;
      }
      if (!canEditRates) {
        toast.error('You do not have permission to import rates');
        return;
      }
      setImportingXlsx(true);
      try {
        const buf = await file.arrayBuffer();
        const rateMap = loadStaffRatesMapFromXlsx(buf);
        if (rateMap.size === 0) {
          toast.error('No data found — use a workbook with "Employee name" and daytime columns (e.g. Support Staff Rates).');
          return;
        }
        const allStaff = await fetchAllStaffForRatesImport();
        const byNorm = staffByNormName(allStaff);
        const rows = [];
        const unmatched = [];
        for (const [k, rateRow] of rateMap) {
          const st = byNorm.get(k);
          if (!st) {
            unmatched.push(rateRow.name);
            continue;
          }
          rows.push({
            shiftcareStaffId: String(st.id),
            staffName: st.displayName,
            rates: { ...rateRow, name: st.displayName },
          });
        }
        if (rows.length === 0) {
          const sample = unmatched.length
            ? ` Examples from file: ${unmatched.slice(0, 5).join(', ')}${unmatched.length > 5 ? '…' : ''}.`
            : '';
          toast.error(`No rows matched ShiftCare staff names.${sample}`);
          return;
        }
        const res = await bulkImportMutation.mutateAsync({ locationId, rows });
        const extra =
          unmatched.length > 0
            ? ` ${unmatched.length} file row(s) had no matching ShiftCare staff (e.g. ${unmatched.slice(0, 3).join(', ')}).`
            : '';
        toast.success(`Saved ${res.saved} rate row(s) to the database for this location.${extra}`);
      } catch (err) {
        toast.error(getErrorMessage(err) || 'Import failed');
      } finally {
        setImportingXlsx(false);
      }
    },
    [locationId, canEditRates, bulkImportMutation]
  );

  return (
    <div className="page-stack">
      <PageHeader title="Staff" />

      <div className={cn('grid gap-2', locationId ? 'sm:grid-cols-2 lg:grid-cols-4' : 'sm:grid-cols-1 max-w-xs')}>
        <StatCard icon={Users} label="Total staff" value={rateKpis.total} className="px-3 py-2" />
        {locationId && (
          <>
            <StatCard
              icon={CheckCircle2}
              tone="success"
              label="Rates saved"
              value={ratesLoading ? '…' : rateKpis.saved}
              sub={`${rateKpis.coverage}% coverage`}
              className="px-3 py-2"
            />
            <StatCard
              icon={AlertCircle}
              tone={rateKpis.notSet > 0 ? 'warning' : 'default'}
              label="Not set"
              value={ratesLoading ? '…' : rateKpis.notSet}
              sub="No rates at this site"
              className="px-3 py-2"
            />
            <StatCard
              label="This page"
              value={displayedStaff.length}
              sub={
                displayedStaff.length
                  ? `${displayedStaff.filter((m) => ratesByStaffId.has(String(m.id))).length} saved · ${displayedStaff.filter((m) => !ratesByStaffId.has(String(m.id))).length} not set`
                  : undefined
              }
              className="px-3 py-2"
            />
          </>
        )}
      </div>

      <Card>
        <CardHeader className="gap-4 border-b pb-4">
          <div className="flex flex-wrap items-end gap-x-6 gap-y-4">
            <div className="min-w-[220px] flex-1 max-w-sm space-y-1.5">
              <FieldLabel
                hint={
                  <>
                    Pay rates are stored per <strong>site</strong> and ShiftCare staff ID. Pick a location before
                    editing or importing rates.
                  </>
                }
                hintLabel="About location selection"
              >
                Location
              </FieldLabel>
              <Select value={locationId} onValueChange={setLocationId}>
                <SelectTrigger className="w-full">
                  <SelectValue placeholder="Select location…" />
                </SelectTrigger>
                <SelectContent>
                  {locations.map((loc) => (
                    <SelectItem key={loc._id} value={loc._id}>
                      {loc.name} ({loc.code})
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              {!locations.length && (
                <Badge variant="warning" className="mt-1">
                  No locations — add under Workforce → Setup
                </Badge>
              )}
            </div>

            <div className="flex items-center gap-1.5">
              <input
                ref={ratesImportInputRef}
                type="file"
                accept=".xlsx,.xls,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet,application/vnd.ms-excel"
                className="hidden"
                onChange={handleRatesXlsx}
              />
              <Button
                type="button"
                variant="secondary"
                size="sm"
                className="gap-2"
                disabled={!locationId || !canEditRates || importingXlsx}
                onClick={() => ratesImportInputRef.current?.click()}
                title={!canEditRates ? 'Requires super admin or finance role' : undefined}
              >
                <FileSpreadsheet className="h-4 w-4" />
                {importingXlsx || bulkImportMutation.isPending ? 'Importing…' : 'Import Excel'}
              </Button>
              <InfoHint
                variant="help"
                side="bottom"
                label="How Excel import works"
                content={
                  <>
                    Upload a <strong>Support Staff Rates</strong> workbook (.xlsx). The first sheet should include{' '}
                    <strong>Employee name</strong>, daytime, afternoon, and other rate columns. Rows are matched to
                    ShiftCare staff by name and saved for the selected location.
                    {!canEditRates && (
                      <>
                        {' '}
                        Import requires <strong>super admin</strong> or <strong>finance</strong> role.
                      </>
                    )}
                  </>
                }
              />
            </div>
          </div>
        </CardHeader>

        <CardContent className="p-0 pb-4">
          <div className="flex flex-wrap items-center justify-between gap-3 border-b px-4 py-2.5">
            <span className="text-sm font-semibold">Directory</span>
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

          {isLoading ? (
            <div className="px-4 py-8">
              <LoadingScreen message="Loading staff..." />
            </div>
          ) : error ? (
            <div className="px-4 py-4">
              <QueryErrorState error={error} title="Failed to load staff" className="border-0 shadow-none" />
            </div>
          ) : !hasResults ? (
            <div className="px-4 py-8 text-center text-muted-foreground">
              No staff found
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
                        label="Alias"
                        sortKey="alias"
                        activeSortKey={sortBy}
                        sortType={sortType}
                        onSort={handleSort}
                        className="min-w-[120px]"
                        suffix={
                          <InfoHint
                            side="bottom"
                            label="About alias column"
                            content="Official or alternate names used in payroll/Xero exports. Set in the SCHADS Rate editor — helps match ShiftCare roster names to payroll sheets."
                          />
                        }
                      />
                      <SortableTableHead
                        label="Email"
                        sortKey="email"
                        activeSortKey={sortBy}
                        sortType={sortType}
                        onSort={handleSort}
                      />
                      <SortableTableHead
                        label="Role"
                        sortKey="role"
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
                        label="Cap Rate"
                        sortKey="rates"
                        activeSortKey={sortBy}
                        sortType={sortType}
                        onSort={handleSort}
                        className="w-[88px] text-right"
                        suffix={
                          <InfoHint
                            side="left"
                            label="About cap rate column"
                            content="Reference cap rate per staff at the selected location. Display only — not used in pay calculation."
                          />
                        }
                      />
                      <SortableTableHead
                        label="SCHADS"
                        sortKey="rates"
                        activeSortKey={sortBy}
                        sortType={sortType}
                        onSort={handleSort}
                        className="w-[88px] text-right"
                        suffix={
                          <InfoHint
                            side="left"
                            label="About SCHADS rates column"
                            content="Per-location hourly rates used by the pay calculator and cost analysis. A green tick means SCHADS rates are saved for this staff member at the selected location."
                          />
                        }
                      />
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {displayedStaff.map((member) => {
                      const dbRow = ratesByStaffId.get(String(member.id));
                      const capSaved = hasCapRateSaved(dbRow);
                      const schadsSaved = hasSchadsRatesSaved(dbRow);
                      const cap = dbRow?.rates?.capRate;
                      const capDisplay = cap > 0 ? `$${Number(cap).toFixed(2)}` : null;
                      return (
                        <TableRow key={member.id}>
                          <TableCell className="font-medium">{member.id}</TableCell>
                          <TableCell>{member.name || `${member.first_name} ${member.family_name}`}</TableCell>
                          <TableCell className="max-w-[180px]">
                            {!locationId ? (
                              <span className="text-2xs text-muted-foreground">—</span>
                            ) : (() => {
                              const aliases = dbRow?.aliases;
                              const text = Array.isArray(aliases) && aliases.length ? aliases.join(', ') : null;
                              return text ? (
                                <span className="text-xs text-muted-foreground truncate block" title={text}>
                                  {text}
                                </span>
                              ) : (
                                <span className="text-2xs text-muted-foreground">—</span>
                              );
                            })()}
                          </TableCell>
                          <TableCell>{member.email || 'N/A'}</TableCell>
                          <TableCell>
                            {(() => {
                              const { variant, label } = getStaffRoleBadge(member.role);
                              return <Badge variant={variant}>{label}</Badge>;
                            })()}
                          </TableCell>
                          <TableCell>{member.mobile_number || member.phone_number || 'N/A'}</TableCell>
                          <TableCell className="text-right">
                            {!locationId ? (
                              <span className="text-2xs text-muted-foreground">—</span>
                            ) : (
                              <RateStatusCell
                                saved={capSaved}
                                value={capDisplay}
                                loading={ratesLoading}
                                canEdit={canEditRates}
                                onEdit={() => openEdit(member, 'cap')}
                              />
                            )}
                          </TableCell>
                          <TableCell className="text-right">
                            {!locationId ? (
                              <span className="text-2xs text-muted-foreground">—</span>
                            ) : (
                              <RateStatusCell
                                saved={schadsSaved}
                                loading={ratesLoading}
                                canEdit={canEditRates}
                                onEdit={() => openEdit(member, 'schads')}
                              />
                            )}
                          </TableCell>
                        </TableRow>
                      );
                    })}
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

      {editing && draft && (
        <Dialog open onOpenChange={(open) => { if (!open) closeEdit(); }}>
          <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
            <DialogHeader>
              <div className="flex items-center gap-2 pr-8">
                <DialogTitle>Rates — {editing.displayName}</DialogTitle>
                <InfoHint
                  label="About location-scoped rates"
                  content="Cap rate and SCHADS rates apply at the selected location. The award calculator and cost analysis use SCHADS rates unless overridden by an uploaded rates file."
                />
              </div>
            </DialogHeader>
            <Tabs value={editTab} onValueChange={setEditTab}>
              <TabsList>
                <TabsTrigger value="cap">Cap Rate</TabsTrigger>
                <TabsTrigger value="schads">SCHADS Rate</TabsTrigger>
              </TabsList>

              <TabsContent value="cap">
                <div className="space-y-1.5 max-w-xs">
                  <FieldLabel
                    hint="Reference cap rate for this staff member. Display only — not used in pay calculation."
                    hintLabel="About cap rate"
                  >
                    Cap Rate ($)
                  </FieldLabel>
                  <Input
                    type="number"
                    step="0.01"
                    min="0"
                    readOnly={!canEditRates}
                    className="h-8 text-xs tabular-nums"
                    value={draft.capRate > 0 ? draft.capRate : ''}
                    onChange={(e) =>
                      setDraft((d) => ({
                        ...d,
                        capRate: r2(parseFloat(e.target.value) || 0),
                      }))
                    }
                    placeholder="0.00"
                  />
                </div>
              </TabsContent>

              <TabsContent value="schads">
                <div className="space-y-4">
                  {canEditRates && (
                    <div className="space-y-1.5">
                      <FieldLabel
                        hint="Alternate spellings or nicknames used in Excel imports, comma-separated (e.g. J. Smith, John S)."
                        hintLabel="About aliases"
                      >
                        Aliases
                      </FieldLabel>
                      <Input
                        type="text"
                        className="h-8 text-xs"
                        value={aliasesDraft}
                        onChange={(e) => setAliasesDraft(e.target.value)}
                        placeholder="e.g. J. Smith, John S"
                      />
                    </div>
                  )}
                  <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-2">
                    {SCHADS_RATE_FIELDS.map(([field, label]) => (
                      <div key={field} className="space-y-1">
                        <Label className="block text-2xs font-normal uppercase text-muted-foreground">{label}</Label>
                        <Input
                          type="number"
                          step="0.01"
                          min="0"
                          readOnly={!canEditRates}
                          className="h-8 text-xs"
                          value={
                            field === 'allowance'
                              ? draft.allowance ? draft.allowance : ''
                              : draft[field] ?? ''
                          }
                          onChange={(e) =>
                            setDraft((d) => ({
                              ...d,
                              [field]: r2(parseFloat(e.target.value) || 0),
                            }))
                          }
                        />
                      </div>
                    ))}
                  </div>
                </div>
              </TabsContent>
            </Tabs>

            <div className="flex flex-wrap gap-2 pt-4">
                {canEditRates ? (
                  <>
                    <Button
                      type="button"
                      onClick={saveRates}
                      disabled={upsertMutation.isPending}
                    >
                      {upsertMutation.isPending ? 'Saving…' : 'Save'}
                    </Button>
                    {ratesByStaffId.has(String(editing.member.id)) && (
                      <Button
                        type="button"
                        variant="destructive"
                        onClick={clearRates}
                        disabled={deleteMutation.isPending}
                      >
                        {deleteMutation.isPending ? '…' : 'Delete saved rates'}
                      </Button>
                    )}
                  </>
                ) : (
                  <p className="flex items-center gap-1.5 text-sm text-muted-foreground">
                    View only
                    <InfoHint
                      content="Only super admin and finance roles can edit SCHADS rates."
                      label="Why view only"
                    />
                  </p>
                )}
                <Button type="button" variant="outline" onClick={closeEdit}>
                  Cancel
                </Button>
              </div>
          </DialogContent>
        </Dialog>
      )}
    </div>
  );
};
