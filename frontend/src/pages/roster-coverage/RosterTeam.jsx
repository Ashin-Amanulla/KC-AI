import { useState } from 'react';
import { Link } from 'react-router-dom';
import { toast } from 'sonner';
import {
  useRosterStaffList,
  useCreateRosterStaff,
  usePatchRosterStaff,
  useDeleteRosterStaff,
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

export function RosterTeam() {
  const { data, isLoading } = useRosterStaffList();
  const { data: locData } = useLocations();
  const createS = useCreateRosterStaff();
  const patchS = usePatchRosterStaff();
  const deleteS = useDeleteRosterStaff();

  const staff = data?.staff ?? [];
  const locations = locData?.locations ?? [];

  const [fullName, setFullName] = useState('');
  const [shiftcareStaffId, setShiftcareStaffId] = useState('');
  const [phone, setPhone] = useState('');
  const [email, setEmail] = useState('');
  const [role, setRole] = useState('Support Worker');
  const [hours, setHours] = useState('76');
  const [timezone, setTimezone] = useState('');
  const [locationId, setLocationId] = useState('');
  const [editingId, setEditingId] = useState(null);

  const reset = () => {
    setFullName('');
    setShiftcareStaffId('');
    setPhone('');
    setEmail('');
    setRole('Support Worker');
    setHours('76');
    setTimezone('');
    setLocationId('');
    setEditingId(null);
  };

  const startEdit = (s) => {
    setEditingId(s._id);
    setFullName(s.fullName);
    setShiftcareStaffId(s.shiftcareStaffId || '');
    setPhone(s.phone || '');
    setEmail(s.email || '');
    setRole(s.role || 'Support Worker');
    setHours(String(s.contractedFortnightlyHours ?? 76));
    setTimezone(s.timezone || '');
    setLocationId(String(s.location || ''));
  };

  const submit = async (e) => {
    e.preventDefault();
    if (!fullName.trim()) {
      toast.error('Name required');
      return;
    }
    const body = {
      fullName: fullName.trim(),
      shiftcareStaffId: shiftcareStaffId.trim() || null,
      phone,
      email,
      role,
      contractedFortnightlyHours: Number(hours) || 0,
      timezone: timezone.trim() || null,
      location: locationId || null,
    };
    try {
      if (editingId) {
        await patchS.mutateAsync({ id: editingId, ...body });
        toast.success('Updated');
      } else {
        await createS.mutateAsync(body);
        toast.success('Created');
      }
      reset();
    } catch (err) {
      toast.error(getErrorMessage(err));
    }
  };

  const remove = async (id) => {
    if (!confirm('Delete this team member and unlink from participants?')) return;
    try {
      await deleteS.mutateAsync(id);
      toast.success('Deleted');
      if (editingId === id) reset();
    } catch (err) {
      toast.error(getErrorMessage(err));
    }
  };

  return (
    <div className="page-stack-dense">
      <div className="grid gap-3 lg:grid-cols-2">
        <section className="rounded-lg border bg-card p-3 space-y-2.5">
          <CardTitleHint titleClassName="text-2sm">
            {editingId ? 'Edit team member' : 'New team member'}
          </CardTitleHint>
          <form onSubmit={submit} className="space-y-2.5">
            <div className="space-y-1">
              <FieldLabel htmlFor="staff-name">Full name</FieldLabel>
              <Input id="staff-name" value={fullName} onChange={(e) => setFullName(e.target.value)} className="h-8 text-2sm" />
            </div>
            <div className="space-y-1">
              <FieldLabel htmlFor="staff-sc-id">ShiftCare staff ID</FieldLabel>
              <Input
                id="staff-sc-id"
                value={shiftcareStaffId}
                onChange={(e) => setShiftcareStaffId(e.target.value)}
                className="h-8 text-2sm"
                placeholder="Matches CSV Staff ID column"
              />
            </div>
            <div className="grid gap-2.5 sm:grid-cols-2">
              <div className="space-y-1">
                <FieldLabel htmlFor="staff-phone">Phone</FieldLabel>
                <Input id="staff-phone" value={phone} onChange={(e) => setPhone(e.target.value)} className="h-8 text-2sm" />
              </div>
              <div className="space-y-1">
                <FieldLabel htmlFor="staff-email">Email</FieldLabel>
                <Input id="staff-email" value={email} onChange={(e) => setEmail(e.target.value)} className="h-8 text-2sm" />
              </div>
            </div>
            <div className="grid gap-2.5 sm:grid-cols-2">
              <div className="space-y-1">
                <FieldLabel htmlFor="staff-role">Role</FieldLabel>
                <Input id="staff-role" value={role} onChange={(e) => setRole(e.target.value)} className="h-8 text-2sm" />
              </div>
              <div className="space-y-1">
                <FieldLabel htmlFor="staff-hours">Hours / fortnight</FieldLabel>
                <Input
                  id="staff-hours"
                  value={hours}
                  onChange={(e) => setHours(e.target.value)}
                  className="h-8 text-2sm"
                  type="number"
                  min="0"
                  step="0.5"
                />
              </div>
            </div>
            <div className="grid gap-2.5 sm:grid-cols-2">
              <div className="space-y-1">
                <FieldLabel htmlFor="staff-timezone">Timezone</FieldLabel>
                <Input id="staff-timezone" value={timezone} onChange={(e) => setTimezone(e.target.value)} className="h-8 text-2sm" />
              </div>
              <div className="space-y-1">
                <FieldLabel>Location</FieldLabel>
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
                        {l.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>
            <div className="flex flex-wrap gap-2 pt-0.5">
              <Button type="submit" size="sm" disabled={createS.isPending || patchS.isPending}>
                {editingId ? 'Save' : 'Create'}
              </Button>
              {editingId && (
                <Button type="button" variant="outline" size="sm" onClick={reset}>
                  Cancel
                </Button>
              )}
            </div>
          </form>
        </section>

        <section className="rounded-lg border bg-card p-3 space-y-2.5">
          <CardTitleHint
            titleClassName="text-2sm"
            hint="Worked (fn) sums hours from the saved timesheet window (earliest to latest shift from your last upload). Cap is contracted hours per fortnight. Clear the window on Timesheet upload to fall back to today’s pay fortnight."
            hintLabel="About worked hours and cap"
          >
            Team
          </CardTitleHint>
          <div className="overflow-x-auto">
            {isLoading ? (
              <p className="text-2sm text-muted-foreground">Loading…</p>
            ) : (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Name</TableHead>
                    <TableHead>SC ID</TableHead>
                    <TableHead className="text-right">Worked</TableHead>
                    <TableHead className="text-right">Cap</TableHead>
                    <TableHead />
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {staff.map((s) => (
                    <TableRow key={s._id}>
                      <TableCell>
                        <Link className="font-medium text-primary hover:underline" to={`/roster-coverage/team/${s._id}`}>
                          {s.fullName}
                        </Link>
                      </TableCell>
                      <TableCell className="font-mono text-2xs text-muted-foreground">{s.shiftcareStaffId || '—'}</TableCell>
                      <TableCell className="text-right">
                        {s.workedHoursThisFortnight != null ? Number(s.workedHoursThisFortnight).toFixed(1) : '—'}
                      </TableCell>
                      <TableCell className="text-right text-muted-foreground">{s.contractedFortnightlyHours}</TableCell>
                      <TableCell className="space-x-2 text-right">
                        <Button type="button" variant="ghost" size="sm" onClick={() => startEdit(s)}>
                          Edit
                        </Button>
                        <Button type="button" variant="ghost" size="sm" onClick={() => remove(s._id)}>
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
