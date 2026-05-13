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
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '../../ui/card';
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
    <div className="grid gap-6 lg:grid-cols-2">
      <Card>
        <CardHeader>
          <CardTitle className="text-base">{editingId ? 'Edit team member' : 'New team member'}</CardTitle>
        </CardHeader>
        <CardContent>
          <form onSubmit={submit} className="space-y-3">
            <div>
              <label className="text-sm font-medium">Full name</label>
              <Input value={fullName} onChange={(e) => setFullName(e.target.value)} className="mt-1" />
            </div>
            <div>
              <label className="text-sm font-medium">ShiftCare staff ID (optional)</label>
              <Input
                value={shiftcareStaffId}
                onChange={(e) => setShiftcareStaffId(e.target.value)}
                className="mt-1"
                placeholder="Matches CSV Staff ID column for imports"
              />
            </div>
            <div>
              <label className="text-sm font-medium">Phone</label>
              <Input value={phone} onChange={(e) => setPhone(e.target.value)} className="mt-1" />
            </div>
            <div>
              <label className="text-sm font-medium">Email</label>
              <Input value={email} onChange={(e) => setEmail(e.target.value)} className="mt-1" />
            </div>
            <div>
              <label className="text-sm font-medium">Role</label>
              <Input value={role} onChange={(e) => setRole(e.target.value)} className="mt-1" />
            </div>
            <div>
              <label className="text-sm font-medium">Contracted hours / fortnight</label>
              <Input value={hours} onChange={(e) => setHours(e.target.value)} className="mt-1" type="number" min="0" step="0.5" />
            </div>
            <div>
              <label className="text-sm font-medium">Timezone (optional)</label>
              <Input value={timezone} onChange={(e) => setTimezone(e.target.value)} className="mt-1" />
            </div>
            <div>
              <label className="text-sm font-medium">Location (optional)</label>
              <select
                className="mt-1 flex h-10 w-full rounded-md border border-input bg-background px-3 text-sm"
                value={locationId}
                onChange={(e) => setLocationId(e.target.value)}
              >
                <option value="">None</option>
                {locations.map((l) => (
                  <option key={l._id} value={l._id}>
                    {l.name}
                  </option>
                ))}
              </select>
            </div>
            <div className="flex flex-wrap gap-2">
              <Button type="submit" disabled={createS.isPending || patchS.isPending}>
                {editingId ? 'Save' : 'Create'}
              </Button>
              {editingId && (
                <Button type="button" variant="outline" onClick={reset}>
                  Cancel
                </Button>
              )}
            </div>
          </form>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Team</CardTitle>
          <CardDescription>
            Worked (fn) sums hours from every shift that overlaps the <strong className="text-foreground">saved
            timesheet window</strong> (earliest to latest shift time from your last successful Timesheet upload). Cap is
            contracted hours per fortnight from each roster record. Clear the window on Timesheet upload to fall back to
            today’s pay fortnight.
          </CardDescription>
        </CardHeader>
        <CardContent className="overflow-x-auto">
          {isLoading ? (
            <p className="text-sm text-muted-foreground">Loading…</p>
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
                    <TableCell className="font-mono text-xs text-muted-foreground">{s.shiftcareStaffId || '—'}</TableCell>
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
        </CardContent>
      </Card>
    </div>
  );
}
