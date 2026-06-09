import { useState } from 'react';
import { toast } from 'sonner';
import {
  useCrmLeads,
  useCreateCrmLead,
  useUpdateCrmLead,
  useDeleteCrmLead,
} from '../../api/crm';
import { usePermissions } from '../../hooks/usePermissions';
import { PERMISSIONS } from '../../config/permissions';
import { Card, CardContent, CardHeader, CardTitle } from '../../ui/card';
import { Button } from '../../ui/button';
import { Input } from '../../ui/input';
import { getErrorMessage } from '../../utils/api';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '../../ui/table';
import { SelectField, toDateInput, toDateTimeInput, parseDateInput } from './crmFormUtils.jsx';

const PARTICIPANT_TYPES = ['SIL Only', 'In Home Care', 'MTA', 'ILO'];
const LEAD_STAGES = ['Active', 'Discharge Pending', 'Inquiry', 'Lost/Deferred'];
const LEAD_STATUSES = ['New', 'Active', 'Converted', 'Hold', 'Lost'];

const emptyForm = () => ({
  leadId: '',
  dateReceived: '',
  name: '',
  referralSource: '',
  referralPhone: '',
  referralEmail: '',
  requirementSummary: '',
  participantType: '',
  currentStage: '',
  status: '',
  lastContactDate: '',
  followUpNotes: '',
  meetAndGreetPlanned: false,
  meetAndGreetDateTime: '',
  estAnnualValue: '',
  daysStale: '',
  lostReason: '',
});

export function CrmLeads() {
  const { hasPermission } = usePermissions();
  const canManage = hasPermission(PERMISSIONS.CRM_MANAGE);
  const { data, isLoading } = useCrmLeads();
  const createM = useCreateCrmLead();
  const updateM = useUpdateCrmLead();
  const deleteM = useDeleteCrmLead();

  const rows = data?.leads ?? [];
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
      leadId: row.leadId || '',
      dateReceived: toDateInput(row.dateReceived),
      name: row.name || '',
      referralSource: row.referralSource || '',
      referralPhone: row.referralPhone || '',
      referralEmail: row.referralEmail || '',
      requirementSummary: row.requirementSummary || '',
      participantType: row.participantType || '',
      currentStage: row.currentStage || '',
      status: row.status || '',
      lastContactDate: toDateInput(row.lastContactDate),
      followUpNotes: row.followUpNotes || '',
      meetAndGreetPlanned: !!row.meetAndGreetPlanned,
      meetAndGreetDateTime: toDateTimeInput(row.meetAndGreetDateTime),
      estAnnualValue: row.estAnnualValue ?? '',
      daysStale: row.daysStale ?? '',
      lostReason: row.lostReason || '',
    });
  };

  const buildBody = () => ({
    leadId: form.leadId.trim(),
    dateReceived: parseDateInput(form.dateReceived),
    name: form.name.trim(),
    referralSource: form.referralSource.trim(),
    referralPhone: form.referralPhone.trim(),
    referralEmail: form.referralEmail.trim(),
    requirementSummary: form.requirementSummary.trim(),
    participantType: form.participantType,
    currentStage: form.currentStage,
    status: form.status,
    lastContactDate: parseDateInput(form.lastContactDate),
    followUpNotes: form.followUpNotes.trim(),
    meetAndGreetPlanned: form.meetAndGreetPlanned,
    meetAndGreetDateTime: parseDateInput(form.meetAndGreetDateTime),
    estAnnualValue: form.estAnnualValue === '' ? null : Number(form.estAnnualValue),
    daysStale: form.daysStale === '' ? null : Number(form.daysStale),
    lostReason: form.lostReason.trim(),
  });

  const submit = async (e) => {
    e.preventDefault();
    if (!form.leadId.trim()) {
      toast.error('Lead ID required');
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
    if (!confirm('Delete this lead?')) return;
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
            <CardTitle className="text-base">{editingId ? 'Edit lead' : 'New lead'}</CardTitle>
          </CardHeader>
          <CardContent>
            <form onSubmit={submit} className="max-h-[70vh] space-y-3 overflow-y-auto pr-1">
              <div>
                <label className="text-sm font-medium">Lead ID</label>
                <Input value={form.leadId} onChange={(e) => set('leadId', e.target.value)} className="mt-1" disabled={!!editingId} />
              </div>
              <div>
                <label className="text-sm font-medium">Name</label>
                <Input value={form.name} onChange={(e) => set('name', e.target.value)} className="mt-1" />
              </div>
              <div>
                <label className="text-sm font-medium">Date received</label>
                <Input type="date" value={form.dateReceived} onChange={(e) => set('dateReceived', e.target.value)} className="mt-1" />
              </div>
              <div>
                <label className="text-sm font-medium">Referral source</label>
                <Input value={form.referralSource} onChange={(e) => set('referralSource', e.target.value)} className="mt-1" />
              </div>
              <div className="grid gap-3 sm:grid-cols-2">
                <div>
                  <label className="text-sm font-medium">Referral phone</label>
                  <Input value={form.referralPhone} onChange={(e) => set('referralPhone', e.target.value)} className="mt-1" />
                </div>
                <div>
                  <label className="text-sm font-medium">Referral email</label>
                  <Input value={form.referralEmail} onChange={(e) => set('referralEmail', e.target.value)} className="mt-1" />
                </div>
              </div>
              <SelectField label="Participant type" value={form.participantType} onChange={(v) => set('participantType', v)} options={PARTICIPANT_TYPES} />
              <SelectField label="Current stage" value={form.currentStage} onChange={(v) => set('currentStage', v)} options={LEAD_STAGES} />
              <SelectField label="Status" value={form.status} onChange={(v) => set('status', v)} options={LEAD_STATUSES} />
              <div>
                <label className="text-sm font-medium">Follow-up notes</label>
                <Input value={form.followUpNotes} onChange={(e) => set('followUpNotes', e.target.value)} className="mt-1" />
              </div>
              <label className="flex items-center gap-2 text-sm">
                <input type="checkbox" checked={form.meetAndGreetPlanned} onChange={(e) => set('meetAndGreetPlanned', e.target.checked)} />
                Meet &amp; greet planned
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
          <CardTitle className="text-base">Potential leads</CardTitle>
        </CardHeader>
        <CardContent className="overflow-x-auto">
          {isLoading ? (
            <p className="text-sm text-muted-foreground">Loading…</p>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Lead ID</TableHead>
                  <TableHead>Name</TableHead>
                  <TableHead>Stage</TableHead>
                  <TableHead>Status</TableHead>
                  {canManage && <TableHead />}
                </TableRow>
              </TableHeader>
              <TableBody>
                {rows.map((row) => (
                  <TableRow key={row._id}>
                    <TableCell>{row.leadId}</TableCell>
                    <TableCell>{row.name}</TableCell>
                    <TableCell>{row.currentStage}</TableCell>
                    <TableCell>{row.status}</TableCell>
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
