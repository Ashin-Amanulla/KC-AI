import { useState, useMemo } from 'react';
import { toast } from 'sonner';
import {
  useRosterParticipants,
  useCreateParticipant,
  usePatchParticipant,
  useDeleteParticipant,
  useRosterStaffList,
} from '../../api/rosterCoverage';
import { useLocations } from '../../api/locations';
import { Card, CardContent, CardHeader, CardTitle } from '../../ui/card';
import { Button } from '../../ui/button';
import { Input } from '../../ui/input';
import { getErrorMessage } from '../../utils/api';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '../../ui/table';

export function RosterParticipants() {
  const { data, isLoading } = useRosterParticipants();
  const { data: staffData } = useRosterStaffList();
  const { data: locData } = useLocations();
  const createP = useCreateParticipant();
  const patchP = usePatchParticipant();
  const deleteP = useDeleteParticipant();

  const participants = data?.participants ?? [];
  const staff = staffData?.staff ?? [];
  const locations = locData?.locations ?? [];

  const [name, setName] = useState('');
  const [locationLabel, setLocationLabel] = useState('');
  const [locationId, setLocationId] = useState('');
  const [timezone, setTimezone] = useState('');
  const [editingId, setEditingId] = useState(null);
  const [selectedStaff, setSelectedStaff] = useState([]);
  const [approvedStaffSearch, setApprovedStaffSearch] = useState('');

  const filteredStaff = useMemo(() => {
    const q = approvedStaffSearch.trim().toLowerCase();
    if (!q) return staff;
    return staff.filter((s) => (s.fullName || '').toLowerCase().includes(q));
  }, [staff, approvedStaffSearch]);

  const resetForm = () => {
    setName('');
    setLocationLabel('');
    setLocationId('');
    setTimezone('');
    setEditingId(null);
    setSelectedStaff([]);
    setApprovedStaffSearch('');
  };

  const startEdit = (p) => {
    setEditingId(p._id);
    setName(p.name);
    setLocationLabel(p.locationLabel || '');
    setLocationId(String(p.location?._id || p.location || ''));
    setTimezone(p.timezone || '');
    setSelectedStaff((p.approvedStaffIds || []).map(String));
    setApprovedStaffSearch('');
  };

  const submit = async (e) => {
    e.preventDefault();
    if (!name.trim()) {
      toast.error('Name required');
      return;
    }
    const body = {
      name: name.trim(),
      locationLabel: locationLabel.trim(),
      location: locationId || null,
      timezone: timezone.trim() || null,
      approvedStaffIds: selectedStaff,
    };
    try {
      if (editingId) {
        await patchP.mutateAsync({ id: editingId, ...body });
        toast.success('Participant updated');
      } else {
        await createP.mutateAsync(body);
        toast.success('Participant created');
      }
      resetForm();
    } catch (err) {
      toast.error(getErrorMessage(err));
    }
  };

  const remove = async (id) => {
    if (!confirm('Delete this participant and related worked shifts?')) return;
    try {
      await deleteP.mutateAsync(id);
      toast.success('Deleted');
      if (editingId === id) resetForm();
    } catch (err) {
      toast.error(getErrorMessage(err));
    }
  };

  return (
    <div className="grid gap-6 lg:grid-cols-2">
      <Card>
        <CardHeader>
          <CardTitle className="text-base">{editingId ? 'Edit participant' : 'New participant'}</CardTitle>
        </CardHeader>
        <CardContent>
          <form onSubmit={submit} className="space-y-3">
            <div>
              <label className="text-sm font-medium">Name</label>
              <Input value={name} onChange={(e) => setName(e.target.value)} className="mt-1" />
            </div>
            <div>
              <label className="text-sm font-medium">Location label</label>
              <Input
                value={locationLabel}
                onChange={(e) => setLocationLabel(e.target.value)}
                className="mt-1"
                placeholder="House / site"
              />
            </div>
            <div>
              <label className="text-sm font-medium">Link location (optional)</label>
              <select
                className="mt-1 flex h-10 w-full rounded-md border border-input bg-background px-3 text-sm"
                value={locationId}
                onChange={(e) => setLocationId(e.target.value)}
              >
                <option value="">None</option>
                {locations.map((l) => (
                  <option key={l._id} value={l._id}>
                    {l.name} ({l.timezone})
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label className="text-sm font-medium">Timezone override (IANA)</label>
              <Input
                value={timezone}
                onChange={(e) => setTimezone(e.target.value)}
                className="mt-1"
                placeholder="Australia/Brisbane"
              />
            </div>
            <div>
              <label className="text-sm font-medium">Approved staff</label>
              <div className="mt-2 overflow-hidden rounded-md border">
                <div className="border-b border-input p-2">
                  <Input
                    type="search"
                    autoComplete="off"
                    placeholder="Search by name…"
                    value={approvedStaffSearch}
                    onChange={(e) => setApprovedStaffSearch(e.target.value)}
                    className="h-9"
                    aria-label="Filter approved staff"
                  />
                </div>
                <div className="max-h-40 space-y-1 overflow-y-auto p-2">
                  {staff.length === 0 ? (
                    <p className="text-sm text-muted-foreground">No staff</p>
                  ) : filteredStaff.length === 0 ? (
                    <p className="text-sm text-muted-foreground">No matches</p>
                  ) : (
                    filteredStaff.map((s) => {
                      const id = String(s._id);
                      const on = selectedStaff.includes(id);
                      return (
                        <label key={id} className="flex items-center gap-2 text-sm">
                          <input
                            type="checkbox"
                            checked={on}
                            onChange={() => {
                              setSelectedStaff((prev) =>
                                on ? prev.filter((x) => x !== id) : [...prev, id]
                              );
                            }}
                          />
                          {s.fullName}
                        </label>
                      );
                    })
                  )}
                </div>
              </div>
            </div>
            <div className="flex flex-wrap gap-2">
              <Button type="submit" disabled={createP.isPending || patchP.isPending}>
                {editingId ? 'Save' : 'Create'}
              </Button>
              {editingId && (
                <Button type="button" variant="outline" onClick={resetForm}>
                  Cancel
                </Button>
              )}
            </div>
          </form>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">All participants</CardTitle>
        </CardHeader>
        <CardContent className="overflow-x-auto">
          {isLoading ? (
            <p className="text-sm text-muted-foreground">Loading…</p>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Name</TableHead>
                  <TableHead>Approved #</TableHead>
                  <TableHead />
                </TableRow>
              </TableHeader>
              <TableBody>
                {participants.map((p) => (
                  <TableRow key={p._id}>
                    <TableCell>{p.name}</TableCell>
                    <TableCell>{p.approvedStaffIds?.length ?? 0}</TableCell>
                    <TableCell className="space-x-2 text-right">
                      <Button type="button" variant="ghost" size="sm" onClick={() => startEdit(p)}>
                        Edit
                      </Button>
                      <Button type="button" variant="ghost" size="sm" onClick={() => remove(p._id)}>
                        Delete
                      </Button>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
