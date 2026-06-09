import { useState } from 'react';
import { toast } from 'sonner';
import {
  useCrmSupportCoordinators,
  useCreateCrmSupportCoordinator,
  useUpdateCrmSupportCoordinator,
  useDeleteCrmSupportCoordinator,
} from '../../api/crm';
import { usePermissions } from '../../hooks/usePermissions';
import { PERMISSIONS } from '../../config/permissions';
import { Card, CardContent, CardHeader, CardTitle } from '../../ui/card';
import { Button } from '../../ui/button';
import { Input } from '../../ui/input';
import { getErrorMessage } from '../../utils/api';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '../../ui/table';
import { SelectField, toDateInput, parseDateInput } from './crmFormUtils.jsx';

const RELATIONSHIP_STATUSES = ['Cold', 'Warm', 'Active', 'Strategic'];

const emptyForm = () => ({
  scId: '',
  coordinatorName: '',
  organisation: '',
  phone: '',
  email: '',
  relationshipStatus: '',
  currentParticipants: '',
  location: '',
  lastContactDate: '',
  nextFollowUpDate: '',
  notes: '',
  specialty: '',
  source: '',
  linkedLeadIds: '',
});

export function CrmSupportCoordinators() {
  const { hasPermission } = usePermissions();
  const canManage = hasPermission(PERMISSIONS.CRM_MANAGE);
  const { data, isLoading } = useCrmSupportCoordinators();
  const createM = useCreateCrmSupportCoordinator();
  const updateM = useUpdateCrmSupportCoordinator();
  const deleteM = useDeleteCrmSupportCoordinator();

  const rows = data?.supportCoordinators ?? [];
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
      scId: row.scId || '',
      coordinatorName: row.coordinatorName || '',
      organisation: row.organisation || '',
      phone: row.phone || '',
      email: row.email || '',
      relationshipStatus: row.relationshipStatus || '',
      currentParticipants: row.currentParticipants || '',
      location: row.location || '',
      lastContactDate: toDateInput(row.lastContactDate),
      nextFollowUpDate: toDateInput(row.nextFollowUpDate),
      notes: row.notes || '',
      specialty: row.specialty || '',
      source: row.source || '',
      linkedLeadIds: (row.linkedLeadIds || []).join(', '),
    });
  };

  const buildBody = () => ({
    scId: form.scId.trim(),
    coordinatorName: form.coordinatorName.trim(),
    organisation: form.organisation.trim(),
    phone: form.phone.trim(),
    email: form.email.trim(),
    relationshipStatus: form.relationshipStatus,
    currentParticipants: form.currentParticipants.trim(),
    location: form.location.trim(),
    lastContactDate: parseDateInput(form.lastContactDate),
    nextFollowUpDate: parseDateInput(form.nextFollowUpDate),
    notes: form.notes.trim(),
    specialty: form.specialty.trim(),
    source: form.source.trim(),
    linkedLeadIds: form.linkedLeadIds
      .split(/[,;]/)
      .map((s) => s.trim())
      .filter(Boolean),
  });

  const submit = async (e) => {
    e.preventDefault();
    if (!form.scId.trim()) {
      toast.error('SC ID required');
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
    if (!confirm('Delete this support coordinator?')) return;
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
              {editingId ? 'Edit support coordinator' : 'New support coordinator'}
            </CardTitle>
          </CardHeader>
          <CardContent>
            <form onSubmit={submit} className="space-y-3">
              <div>
                <label className="text-sm font-medium">SC ID</label>
                <Input value={form.scId} onChange={(e) => set('scId', e.target.value)} className="mt-1" disabled={!!editingId} />
              </div>
              <div>
                <label className="text-sm font-medium">Coordinator name</label>
                <Input value={form.coordinatorName} onChange={(e) => set('coordinatorName', e.target.value)} className="mt-1" />
              </div>
              <div>
                <label className="text-sm font-medium">Organisation</label>
                <Input value={form.organisation} onChange={(e) => set('organisation', e.target.value)} className="mt-1" />
              </div>
              <div className="grid gap-3 sm:grid-cols-2">
                <div>
                  <label className="text-sm font-medium">Phone</label>
                  <Input value={form.phone} onChange={(e) => set('phone', e.target.value)} className="mt-1" />
                </div>
                <div>
                  <label className="text-sm font-medium">Email</label>
                  <Input value={form.email} onChange={(e) => set('email', e.target.value)} className="mt-1" />
                </div>
              </div>
              <SelectField label="Relationship status" value={form.relationshipStatus} onChange={(v) => set('relationshipStatus', v)} options={RELATIONSHIP_STATUSES} />
              <div>
                <label className="text-sm font-medium">Current participants</label>
                <Input value={form.currentParticipants} onChange={(e) => set('currentParticipants', e.target.value)} className="mt-1" />
              </div>
              <div>
                <label className="text-sm font-medium">Location</label>
                <Input value={form.location} onChange={(e) => set('location', e.target.value)} className="mt-1" />
              </div>
              <div className="grid gap-3 sm:grid-cols-2">
                <div>
                  <label className="text-sm font-medium">Last contact date</label>
                  <Input type="date" value={form.lastContactDate} onChange={(e) => set('lastContactDate', e.target.value)} className="mt-1" />
                </div>
                <div>
                  <label className="text-sm font-medium">Next follow-up date</label>
                  <Input type="date" value={form.nextFollowUpDate} onChange={(e) => set('nextFollowUpDate', e.target.value)} className="mt-1" />
                </div>
              </div>
              <div>
                <label className="text-sm font-medium">Linked lead IDs</label>
                <Input value={form.linkedLeadIds} onChange={(e) => set('linkedLeadIds', e.target.value)} className="mt-1" placeholder="L-0001, L-0002" />
              </div>
              <div>
                <label className="text-sm font-medium">Notes</label>
                <Input value={form.notes} onChange={(e) => set('notes', e.target.value)} className="mt-1" />
              </div>
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
          <CardTitle className="text-base">Support coordinators</CardTitle>
        </CardHeader>
        <CardContent className="overflow-x-auto">
          {isLoading ? (
            <p className="text-sm text-muted-foreground">Loading…</p>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>SC ID</TableHead>
                  <TableHead>Name</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Org</TableHead>
                  {canManage && <TableHead />}
                </TableRow>
              </TableHeader>
              <TableBody>
                {rows.map((row) => (
                  <TableRow key={row._id}>
                    <TableCell>{row.scId}</TableCell>
                    <TableCell>{row.coordinatorName}</TableCell>
                    <TableCell>{row.relationshipStatus}</TableCell>
                    <TableCell>{row.organisation}</TableCell>
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
