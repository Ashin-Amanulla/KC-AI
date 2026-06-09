import { useState } from 'react';
import { toast } from 'sonner';
import {
  useCrmStaffingRequirements,
  useCreateCrmStaffingRequirement,
  useUpdateCrmStaffingRequirement,
  useDeleteCrmStaffingRequirement,
} from '../../api/crm';
import { usePermissions } from '../../hooks/usePermissions';
import { PERMISSIONS } from '../../config/permissions';
import { Card, CardContent, CardHeader, CardTitle } from '../../ui/card';
import { Button } from '../../ui/button';
import { Input } from '../../ui/input';
import { getErrorMessage } from '../../utils/api';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '../../ui/table';
import { toDateInput, parseDateInput } from './crmFormUtils.jsx';

const emptyForm = () => ({
  participant: '',
  staffRequired: '',
  supportWorkerAge: '',
  sex: '',
  drivingLicenseRequired: '',
  vehicleRequired: '',
  location: '',
  dueDate: '',
  notes: '',
  completed: false,
});

export function CrmStaffingRequirements() {
  const { hasPermission } = usePermissions();
  const canManage = hasPermission(PERMISSIONS.CRM_MANAGE);
  const { data, isLoading } = useCrmStaffingRequirements();
  const createM = useCreateCrmStaffingRequirement();
  const updateM = useUpdateCrmStaffingRequirement();
  const deleteM = useDeleteCrmStaffingRequirement();

  const rows = data?.staffingRequirements ?? [];
  const [form, setForm] = useState(emptyForm());
  const [editingId, setEditingId] = useState(null);

  const set = (field, value) => setForm((f) => ({ ...f, [field]: value }));

  const resetForm = () => {
    setForm(emptyForm());
    setEditingId(null);
  };

  const startEdit = (row) => {
    setEditingId(row._id);
    setForm({
      participant: row.participant || '',
      staffRequired: row.staffRequired ?? '',
      supportWorkerAge: row.supportWorkerAge || '',
      sex: row.sex || '',
      drivingLicenseRequired: row.drivingLicenseRequired || '',
      vehicleRequired: row.vehicleRequired || '',
      location: row.location || '',
      dueDate: toDateInput(row.dueDate),
      notes: row.notes || '',
      completed: !!row.completed,
    });
  };

  const buildBody = () => ({
    participant: form.participant.trim(),
    staffRequired: form.staffRequired === '' ? null : Number(form.staffRequired),
    supportWorkerAge: form.supportWorkerAge.trim(),
    sex: form.sex.trim(),
    drivingLicenseRequired: form.drivingLicenseRequired.trim(),
    vehicleRequired: form.vehicleRequired.trim(),
    location: form.location.trim(),
    dueDate: parseDateInput(form.dueDate),
    notes: form.notes.trim(),
    completed: form.completed,
  });

  const submit = async (e) => {
    e.preventDefault();
    if (!form.participant.trim()) {
      toast.error('Participant required');
      return;
    }
    try {
      const body = buildBody();
      if (editingId) {
        await updateM.mutateAsync({ id: editingId, ...body });
        toast.success('Updated');
      } else {
        await createM.mutateAsync(body);
        toast.success('Created');
      }
      resetForm();
    } catch (err) {
      toast.error(getErrorMessage(err));
    }
  };

  const remove = async (id) => {
    if (!confirm('Delete this staffing requirement?')) return;
    try {
      await deleteM.mutateAsync(id);
      toast.success('Deleted');
      if (editingId === id) resetForm();
    } catch (err) {
      toast.error(getErrorMessage(err));
    }
  };

  return (
    <div className="grid gap-6 lg:grid-cols-2">
      {canManage && (
        <Card>
          <CardHeader>
            <CardTitle className="text-base">
              {editingId ? 'Edit staffing requirement' : 'New staffing requirement'}
            </CardTitle>
          </CardHeader>
          <CardContent>
            <form onSubmit={submit} className="space-y-3">
              <div>
                <label className="text-sm font-medium">Participant</label>
                <Input value={form.participant} onChange={(e) => set('participant', e.target.value)} className="mt-1" />
              </div>
              <div className="grid gap-3 sm:grid-cols-2">
                <div>
                  <label className="text-sm font-medium">Staff required</label>
                  <Input type="number" min="0" value={form.staffRequired} onChange={(e) => set('staffRequired', e.target.value)} className="mt-1" />
                </div>
                <div>
                  <label className="text-sm font-medium">Due date</label>
                  <Input type="date" value={form.dueDate} onChange={(e) => set('dueDate', e.target.value)} className="mt-1" />
                </div>
              </div>
              <div>
                <label className="text-sm font-medium">Location</label>
                <Input value={form.location} onChange={(e) => set('location', e.target.value)} className="mt-1" />
              </div>
              <div>
                <label className="text-sm font-medium">Notes</label>
                <Input value={form.notes} onChange={(e) => set('notes', e.target.value)} className="mt-1" />
              </div>
              <label className="flex items-center gap-2 text-sm">
                <input type="checkbox" checked={form.completed} onChange={(e) => set('completed', e.target.checked)} />
                Completed
              </label>
              <div className="flex flex-wrap gap-2">
                <Button type="submit" disabled={createM.isPending || updateM.isPending}>
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
      )}

      <Card className={canManage ? '' : 'lg:col-span-2'}>
        <CardHeader>
          <CardTitle className="text-base">Staffing requirements</CardTitle>
        </CardHeader>
        <CardContent className="overflow-x-auto">
          {isLoading ? (
            <p className="text-sm text-muted-foreground">Loading…</p>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Participant</TableHead>
                  <TableHead>Staff</TableHead>
                  <TableHead>Location</TableHead>
                  <TableHead>Due</TableHead>
                  <TableHead>Done</TableHead>
                  {canManage && <TableHead />}
                </TableRow>
              </TableHeader>
              <TableBody>
                {rows.map((row) => (
                  <TableRow key={row._id}>
                    <TableCell>{row.participant}</TableCell>
                    <TableCell>{row.staffRequired ?? '—'}</TableCell>
                    <TableCell>{row.location}</TableCell>
                    <TableCell>{row.dueDate ? new Date(row.dueDate).toLocaleDateString() : ''}</TableCell>
                    <TableCell>{row.completed ? 'Yes' : 'No'}</TableCell>
                    {canManage && (
                      <TableCell className="space-x-2 text-right">
                        <Button type="button" variant="ghost" size="sm" onClick={() => startEdit(row)}>
                          Edit
                        </Button>
                        <Button type="button" variant="ghost" size="sm" onClick={() => remove(row._id)}>
                          Delete
                        </Button>
                      </TableCell>
                    )}
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
