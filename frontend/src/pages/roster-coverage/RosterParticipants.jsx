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
import { Button } from '../../ui/button';
import { Input } from '../../ui/input';
import { CardTitleHint, FieldLabel } from '../../components/InfoHint';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '../../ui/select';
import { getErrorMessage } from '../../utils/api';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '../../ui/table';

const NONE_LOCATION = '__none__';

export function RosterParticipants() {
  const { data, isLoading } = useRosterParticipants();
  const { data: staffData } = useRosterStaffList();
  const { data: locData } = useLocations();
  const createP = useCreateParticipant();
  const patchP = usePatchParticipant();
  const deleteP = useDeleteParticipant();

  const participants = data?.participants ?? [];
  const staff = useMemo(() => staffData?.staff ?? [], [staffData]);
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
    <div className="page-stack-dense">
      <div className="grid gap-3 lg:grid-cols-2">
        <section className="rounded-lg border bg-card p-3 space-y-2.5">
          <CardTitleHint titleClassName="text-2sm">
            {editingId ? 'Edit participant' : 'New participant'}
          </CardTitleHint>
          <form onSubmit={submit} className="space-y-2.5">
            <div className="space-y-1">
              <FieldLabel htmlFor="participant-name">Name</FieldLabel>
              <Input id="participant-name" value={name} onChange={(e) => setName(e.target.value)} className="h-8 text-2sm" />
            </div>
            <div className="space-y-1">
              <FieldLabel htmlFor="participant-location-label">Location label</FieldLabel>
              <Input
                id="participant-location-label"
                value={locationLabel}
                onChange={(e) => setLocationLabel(e.target.value)}
                className="h-8 text-2sm"
                placeholder="House / site"
              />
            </div>
            <div className="space-y-1">
              <FieldLabel>Link location</FieldLabel>
              <Select
                value={locationId || NONE_LOCATION}
                onValueChange={(value) => setLocationId(value === NONE_LOCATION ? '' : value)}
              >
                <SelectTrigger className="h-8 text-2sm">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value={NONE_LOCATION}>None</SelectItem>
                  {locations.map((l) => (
                    <SelectItem key={l._id} value={l._id}>
                      {l.name} ({l.timezone})
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1">
              <FieldLabel htmlFor="participant-timezone">Timezone override</FieldLabel>
              <Input
                id="participant-timezone"
                value={timezone}
                onChange={(e) => setTimezone(e.target.value)}
                className="h-8 text-2sm"
                placeholder="Australia/Brisbane"
              />
            </div>
            <div className="space-y-1">
              <FieldLabel>Approved staff</FieldLabel>
              <div className="overflow-hidden rounded-md border">
                <div className="border-b border-input p-1.5">
                  <Input
                    type="search"
                    autoComplete="off"
                    placeholder="Search by name…"
                    value={approvedStaffSearch}
                    onChange={(e) => setApprovedStaffSearch(e.target.value)}
                    className="h-8 border-0 bg-transparent text-2sm shadow-none"
                    aria-label="Filter approved staff"
                  />
                </div>
                <div className="max-h-36 space-y-0.5 overflow-y-auto p-1.5">
                  {staff.length === 0 ? (
                    <p className="text-2sm text-muted-foreground">No staff</p>
                  ) : filteredStaff.length === 0 ? (
                    <p className="text-2sm text-muted-foreground">No matches</p>
                  ) : (
                    filteredStaff.map((s) => {
                      const id = String(s._id);
                      const on = selectedStaff.includes(id);
                      return (
                        <label key={id} className="flex items-center gap-2 text-2sm">
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
            <div className="flex flex-wrap gap-2 pt-0.5">
              <Button type="submit" size="sm" disabled={createP.isPending || patchP.isPending}>
                {editingId ? 'Save' : 'Create'}
              </Button>
              {editingId && (
                <Button type="button" variant="outline" size="sm" onClick={resetForm}>
                  Cancel
                </Button>
              )}
            </div>
          </form>
        </section>

        <section className="rounded-lg border bg-card p-3 space-y-2.5">
          <CardTitleHint titleClassName="text-2sm">All participants</CardTitleHint>
          <div className="overflow-x-auto">
            {isLoading ? (
              <p className="text-2sm text-muted-foreground">Loading…</p>
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
          </div>
        </section>
      </div>
    </div>
  );
}
