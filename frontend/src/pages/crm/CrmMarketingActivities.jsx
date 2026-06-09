import { useState } from 'react';
import { toast } from 'sonner';
import {
  useCrmMarketingActivities,
  useCreateCrmMarketingActivity,
  useUpdateCrmMarketingActivity,
  useDeleteCrmMarketingActivity,
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
  activityId: '',
  date: '',
  activityType: '',
  relatedScOrLeadId: '',
  organisationName: '',
  channel: '',
  objective: '',
  outcome: '',
  followUpRequired: false,
  followUpOwner: '',
  nextActionDate: '',
  notes: '',
});

export function CrmMarketingActivities() {
  const { hasPermission } = usePermissions();
  const canManage = hasPermission(PERMISSIONS.CRM_MANAGE);
  const { data, isLoading } = useCrmMarketingActivities();
  const createM = useCreateCrmMarketingActivity();
  const updateM = useUpdateCrmMarketingActivity();
  const deleteM = useDeleteCrmMarketingActivity();

  const rows = data?.marketingActivities ?? [];
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
      activityId: row.activityId || '',
      date: toDateInput(row.date),
      activityType: row.activityType || '',
      relatedScOrLeadId: row.relatedScOrLeadId || '',
      organisationName: row.organisationName || '',
      channel: row.channel || '',
      objective: row.objective || '',
      outcome: row.outcome || '',
      followUpRequired: !!row.followUpRequired,
      followUpOwner: row.followUpOwner || '',
      nextActionDate: toDateInput(row.nextActionDate),
      notes: row.notes || '',
    });
  };

  const buildBody = () => ({
    activityId: form.activityId.trim(),
    date: parseDateInput(form.date),
    activityType: form.activityType.trim(),
    relatedScOrLeadId: form.relatedScOrLeadId.trim(),
    organisationName: form.organisationName.trim(),
    channel: form.channel.trim(),
    objective: form.objective.trim(),
    outcome: form.outcome.trim(),
    followUpRequired: form.followUpRequired,
    followUpOwner: form.followUpOwner.trim(),
    nextActionDate: parseDateInput(form.nextActionDate),
    notes: form.notes.trim(),
  });

  const submit = async (e) => {
    e.preventDefault();
    if (!form.activityId.trim()) {
      toast.error('Activity ID required');
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
    if (!confirm('Delete this marketing activity?')) return;
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
              {editingId ? 'Edit marketing activity' : 'New marketing activity'}
            </CardTitle>
          </CardHeader>
          <CardContent>
            <form onSubmit={submit} className="space-y-3">
              <div>
                <label className="text-sm font-medium">Activity ID</label>
                <Input value={form.activityId} onChange={(e) => set('activityId', e.target.value)} className="mt-1" disabled={!!editingId} />
              </div>
              <div>
                <label className="text-sm font-medium">Date</label>
                <Input type="date" value={form.date} onChange={(e) => set('date', e.target.value)} className="mt-1" />
              </div>
              <div>
                <label className="text-sm font-medium">Activity type</label>
                <Input value={form.activityType} onChange={(e) => set('activityType', e.target.value)} className="mt-1" />
              </div>
              <div>
                <label className="text-sm font-medium">Related SC / Lead ID</label>
                <Input value={form.relatedScOrLeadId} onChange={(e) => set('relatedScOrLeadId', e.target.value)} className="mt-1" />
              </div>
              <div>
                <label className="text-sm font-medium">Organisation / name</label>
                <Input value={form.organisationName} onChange={(e) => set('organisationName', e.target.value)} className="mt-1" />
              </div>
              <div>
                <label className="text-sm font-medium">Channel</label>
                <Input value={form.channel} onChange={(e) => set('channel', e.target.value)} className="mt-1" />
              </div>
              <div>
                <label className="text-sm font-medium">Next action date</label>
                <Input type="date" value={form.nextActionDate} onChange={(e) => set('nextActionDate', e.target.value)} className="mt-1" />
              </div>
              <label className="flex items-center gap-2 text-sm">
                <input type="checkbox" checked={form.followUpRequired} onChange={(e) => set('followUpRequired', e.target.checked)} />
                Follow-up required
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
          <CardTitle className="text-base">Marketing activities</CardTitle>
        </CardHeader>
        <CardContent className="overflow-x-auto">
          {isLoading ? (
            <p className="text-sm text-muted-foreground">Loading…</p>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>ID</TableHead>
                  <TableHead>Type</TableHead>
                  <TableHead>Date</TableHead>
                  <TableHead>Related</TableHead>
                  {canManage && <TableHead />}
                </TableRow>
              </TableHeader>
              <TableBody>
                {rows.map((row) => (
                  <TableRow key={row._id}>
                    <TableCell>{row.activityId}</TableCell>
                    <TableCell>{row.activityType}</TableCell>
                    <TableCell>{row.date ? new Date(row.date).toLocaleDateString() : ''}</TableCell>
                    <TableCell>{row.relatedScOrLeadId}</TableCell>
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
