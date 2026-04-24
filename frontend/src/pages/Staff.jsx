import { useState, useEffect, useMemo, useCallback, useRef } from 'react';
import { toast } from 'sonner';
import { useStaff, fetchAllStaffForRatesImport } from '../api/staff';
import { useLocations } from '../api/locations';
import { useStaffRates, useUpsertStaffRate, useDeleteStaffRate, useBulkImportStaffRates } from '../api/staffRates';
import { loadStaffRatesMapFromXlsx } from '../lib/staffRatesFromXlsx';
import { useAuthStore } from '../store/auth';
import { getErrorMessage } from '../utils/api';
import { STAFF_RATES_TABLE_FIELDS, STAFF_RATES_NUMERIC_KEYS } from '../lib/staffRateFieldMeta';
import { r2, VEHICLE_RATE, normName } from '../lib/schadsWageCalc';
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
import { Pencil, X, FileSpreadsheet } from 'lucide-react';

function defaultRatesRow(displayName) {
  const v = 0;
  return {
    name: displayName.trim(),
    daytime: v,
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
    sleepover: 0,
    sleepoverExtra: 0,
    kmRate: VEHICLE_RATE,
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
  const perPage = 20;

  useEffect(() => {
    const timer = setTimeout(() => {
      setDebouncedSearchTerm(searchTerm);
      setPage(1);
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
  const { data: staffRatesData, isLoading: ratesLoading } = useStaffRates(locationId);
  const upsertMutation = useUpsertStaffRate();
  const deleteMutation = useDeleteStaffRate();
  const bulkImportMutation = useBulkImportStaffRates();
  const ratesImportInputRef = useRef(null);
  const [importingXlsx, setImportingXlsx] = useState(false);

  const staff = data?.staff || [];
  const metadata = data?._metadata;

  const ratesByStaffId = useMemo(() => {
    const m = new Map();
    for (const r of staffRatesData?.staffRates || []) {
      m.set(String(r.shiftcareStaffId), r);
    }
    return m;
  }, [staffRatesData]);

  const [editing, setEditing] = useState(null);
  const [draft, setDraft] = useState(null);

  const openEdit = (member) => {
    const displayName = member.name || `${member.first_name || ''} ${member.family_name || ''}`.trim();
    const existing = ratesByStaffId.get(String(member.id))?.rates;
    setDraft(ratesToDraft({ ...defaultRatesRow(displayName), ...existing, name: displayName }));
    setEditing({ member, displayName });
  };

  const closeEdit = () => {
    setEditing(null);
    setDraft(null);
  };

  const saveRates = useCallback(async () => {
    if (!editing || !draft || !locationId) return;
    const { member, displayName } = editing;
    try {
      await upsertMutation.mutateAsync({
        locationId,
        shiftcareStaffId: String(member.id),
        staffName: displayName,
        rates: {
          name: displayName,
          ...Object.fromEntries(STAFF_RATES_NUMERIC_KEYS.map((k) => [k, draft[k] ?? 0])),
          sleepoverExtra: draft.sleepoverExtra ?? 0,
        },
      });
      toast.success('SCHADS rates saved');
      closeEdit();
    } catch (e) {
      toast.error(getErrorMessage(e) || 'Save failed');
    }
  }, [editing, draft, locationId, upsertMutation]);

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
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h2 className="text-3xl font-bold">Staff</h2>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Location for SCHADS rates</CardTitle>
          <p className="text-sm text-muted-foreground">
            Pay rates are stored per <strong>site</strong> (and ShiftCare ID). Select a location before editing.
          </p>
          <div className="pt-2 max-w-md">
            <label className="text-xs text-muted-foreground block mb-1">Location</label>
            <select
              className="w-full h-9 rounded-md border border-input bg-background px-2 text-sm"
              value={locationId}
              onChange={(e) => setLocationId(e.target.value)}
            >
              <option value="">— Select —</option>
              {locations.map((loc) => (
                <option key={loc._id} value={loc._id}>
                  {loc.name} ({loc.code})
                </option>
              ))}
            </select>
            {!locations.length && (
              <p className="text-xs text-amber-700 mt-1">Create a location under Workforce → Setup first.</p>
            )}
          </div>
          <div className="pt-4 border-t border-border/60 space-y-2">
            <p className="text-sm text-muted-foreground">
              Upload a <strong>Support Staff Rates</strong>–style .xlsx (first sheet: Employee name, daytime, afternoon, …). Rows are
              matched to ShiftCare staff by <strong>name</strong> and stored for the selected location.
            </p>
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
              className="gap-2"
              disabled={!locationId || !canEditRates || importingXlsx}
              onClick={() => ratesImportInputRef.current?.click()}
            >
              <FileSpreadsheet className="h-4 w-4" />
              {importingXlsx || bulkImportMutation.isPending ? 'Importing…' : 'Import rates from Excel'}
            </Button>
            {!canEditRates && (
              <p className="text-xs text-muted-foreground">Import requires super admin or finance role.</p>
            )}
          </div>
        </CardHeader>
      </Card>

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
            <LoadingScreen message="Loading staff..." />
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
                      <TableHead className="w-[200px]">SCHADS rates</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {staff.map((member) => {
                      const hasRate = locationId && ratesByStaffId.has(String(member.id));
                      return (
                        <TableRow key={member.id}>
                          <TableCell className="font-medium">{member.id}</TableCell>
                          <TableCell>{member.name || `${member.first_name} ${member.family_name}`}</TableCell>
                          <TableCell>{member.email || 'N/A'}</TableCell>
                          <TableCell>{member.role || 'N/A'}</TableCell>
                          <TableCell>{member.mobile_number || member.phone_number || 'N/A'}</TableCell>
                          <TableCell>
                            {!locationId ? (
                              <span className="text-xs text-muted-foreground">Select a location</span>
                            ) : (
                              <div className="flex items-center gap-2">
                                {hasRate && (
                                  <span className="text-[10px] uppercase font-medium text-emerald-700 bg-emerald-50 px-1.5 py-0.5 rounded">
                                    Saved
                                  </span>
                                )}
                                {ratesLoading && (
                                  <span className="text-xs text-muted-foreground">…</span>
                                )}
                                <Button
                                  type="button"
                                  size="sm"
                                  variant="outline"
                                  className="h-8 gap-1"
                                  onClick={() => openEdit(member)}
                                >
                                  <Pencil className="h-3.5 w-3.5" />
                                  {hasRate ? 'Edit' : 'Set'}
                                </Button>
                              </div>
                            )}
                          </TableCell>
                        </TableRow>
                      );
                    })}
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

      {editing && draft && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-background/80 backdrop-blur-sm"
          role="dialog"
          aria-modal="true"
        >
          <Card className="w-full max-w-4xl max-h-[90vh] overflow-y-auto shadow-lg">
            <CardHeader className="flex flex-row items-center justify-between space-y-0">
              <CardTitle className="text-lg">
                SCHADS rates — {editing.displayName}
              </CardTitle>
              <Button type="button" variant="ghost" size="icon" onClick={closeEdit} aria-label="Close">
                <X className="h-4 w-4" />
              </Button>
            </CardHeader>
            <CardContent className="space-y-4">
              <p className="text-xs text-muted-foreground">
                Location-scoped. Calculator and cost for this site use these values unless overridden by a rates file in
                the award calculator.
              </p>
              <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-2">
                {STAFF_RATES_TABLE_FIELDS.map(([field, label]) => (
                  <div key={field} className="space-y-1">
                    <span className="text-[10px] uppercase text-muted-foreground">{label}</span>
                    <Input
                      type="number"
                      step="0.01"
                      min="0"
                      readOnly={!canEditRates}
                      className="h-8 text-xs"
                      value={draft[field] ?? ''}
                      onChange={(e) =>
                        setDraft((d) => ({ ...d, [field]: r2(parseFloat(e.target.value) || 0) }))
                      }
                    />
                  </div>
                ))}
              </div>
              <div className="flex flex-wrap gap-2 pt-2">
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
                  <p className="text-sm text-muted-foreground">View only. Ask an admin to change rates.</p>
                )}
                <Button type="button" variant="outline" onClick={closeEdit}>
                  Cancel
                </Button>
              </div>
            </CardContent>
          </Card>
        </div>
      )}
    </div>
  );
};
