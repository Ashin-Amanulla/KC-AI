import { useState } from 'react';
import { toast } from 'sonner';
import { ShieldPlus, Pencil } from 'lucide-react';
import { useRoles, useCreateRole, useUpdateRole } from '../../api/roles';
import { usePermissions } from '../../hooks/usePermissions';
import { getErrorMessage } from '../../utils/api';
import { Card, CardContent, CardHeader } from '../../ui/card';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '../../ui/table';
import { Button } from '../../ui/button';
import { Input } from '../../ui/input';
import { Label } from '../../ui/label';
import { Badge } from '../../ui/badge';
import { Switch } from '../../ui/switch';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '../../ui/dialog';
import { LoadingScreen } from '../../ui/LoadingSpinner';
import { QueryErrorState } from '../../components/QueryErrorState';
import { InfoHint } from '../../components/InfoHint';
import { Tooltip, TooltipContent, TooltipTrigger } from '../../ui/tooltip';
import { PermissionPicker } from './PermissionPicker';
import { RolePermissionSummary } from './RolePermissionSummary';

const emptyForm = () => ({
  name: '',
  description: '',
  permissions: [],
});

export const RolesPanel = ({ readOnly = false }) => {
  const [showForm, setShowForm] = useState(false);
  const [editingId, setEditingId] = useState(null);
  const [form, setForm] = useState(emptyForm());

  const { data, isLoading, error } = useRoles();
  const createRole = useCreateRole();
  const updateRole = useUpdateRole();
  const { canManageRoles } = usePermissions();

  const roles = data?.roles || [];
  const catalog = data?.catalog || [];

  const resetForm = () => {
    setForm(emptyForm());
    setEditingId(null);
    setShowForm(false);
  };

  const handleCreate = async (e) => {
    e.preventDefault();
    try {
      await createRole.mutateAsync(form);
      toast.success('Role created');
      resetForm();
    } catch (err) {
      toast.error(getErrorMessage(err) || 'Failed to create role');
    }
  };

  const handleUpdate = async (e) => {
    e.preventDefault();
    if (!editingId) return;
    try {
      await updateRole.mutateAsync({ id: editingId, ...form });
      toast.success('Role updated');
      resetForm();
    } catch (err) {
      toast.error(getErrorMessage(err) || 'Failed to update role');
    }
  };

  const handleEdit = (role) => {
    setEditingId(role._id);
    setForm({
      name: role.name,
      description: role.description || '',
      permissions: [...(role.permissions || [])],
    });
    setShowForm(true);
  };

  const handleToggleActive = async (role, next) => {
    try {
      await updateRole.mutateAsync({ id: role._id, isActive: next });
      toast.success(next ? 'Role activated' : 'Role deactivated');
    } catch (err) {
      toast.error(getErrorMessage(err) || 'Failed to update role');
    }
  };

  const openCreate = () => {
    resetForm();
    setShowForm(true);
  };

  const canEdit = canManageRoles && !readOnly;

  return (
    <>
      <Card>
        <CardHeader className="flex-row flex-wrap items-center justify-between gap-2 space-y-0 border-b py-2.5">
          <div className="flex items-center gap-2">
            <span className="text-sm font-semibold">Roles & permissions</span>
            <InfoHint
              content="A role is a template of what someone can see and do. Assign roles to users on the Users tab."
              label="About roles"
            />
            {!isLoading && (
              <Badge variant="default">{roles.length}</Badge>
            )}
          </div>
          {canEdit && (
            <Tooltip>
              <TooltipTrigger asChild>
                <Button type="button" size="icon" variant="outline" onClick={openCreate} aria-label="Add role">
                  <ShieldPlus className="h-4 w-4" />
                </Button>
              </TooltipTrigger>
              <TooltipContent>Add role</TooltipContent>
            </Tooltip>
          )}
        </CardHeader>
        {readOnly && (
          <div className="border-b px-4 py-2">
            <p className="flex items-center gap-1.5 text-2xs text-muted-foreground">
              View only
              <InfoHint content="Role management permission required to edit roles." label="Why view only" />
            </p>
          </div>
        )}
        <CardContent className="p-0 pb-4">
          {isLoading ? (
            <div className="px-4 py-8">
              <LoadingScreen message="Loading roles…" />
            </div>
          ) : error ? (
            <div className="px-4 py-4">
              <QueryErrorState error={error} title="Failed to load roles" className="border-0 shadow-none" />
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Role</TableHead>
                  <TableHead>Users</TableHead>
                  <TableHead>Access summary</TableHead>
                  <TableHead>Status</TableHead>
                  {canEdit && <TableHead className="w-[52px] text-right">Edit</TableHead>}
                </TableRow>
              </TableHeader>
              <TableBody>
                {roles.map((role) => (
                  <TableRow key={role._id}>
                    <TableCell>
                      <div className="font-medium">{role.name}</div>
                      {role.description && (
                        <div className="mt-0.5 max-w-xs text-2xs text-muted-foreground">{role.description}</div>
                      )}
                      {role.isSystem && (
                        <Badge variant="outline" className="mt-1 text-2xs uppercase">
                          Built-in
                        </Badge>
                      )}
                    </TableCell>
                    <TableCell>{role.userCount ?? 0}</TableCell>
                    <TableCell>
                      <RolePermissionSummary
                        permissionKeys={role.permissions || []}
                        catalog={catalog}
                      />
                    </TableCell>
                    <TableCell>
                      {canEdit ? (
                        <div className="flex items-center gap-2">
                          <Switch
                            checked={role.isActive !== false}
                            onCheckedChange={(next) => handleToggleActive(role, next)}
                            disabled={role.isSystem || updateRole.isPending}
                            aria-label={`${role.name} ${role.isActive !== false ? 'active' : 'inactive'}`}
                          />
                          <span className="text-2xs text-muted-foreground">
                            {role.isActive !== false ? 'Active' : 'Inactive'}
                          </span>
                        </div>
                      ) : (
                        <Badge variant={role.isActive !== false ? 'success' : 'default'} className="uppercase">
                          {role.isActive !== false ? 'Active' : 'Inactive'}
                        </Badge>
                      )}
                    </TableCell>
                    {canEdit && (
                      <TableCell className="text-right">
                        <Tooltip>
                          <TooltipTrigger asChild>
                            <Button
                              variant="outline"
                              size="icon"
                              className="h-7 w-7"
                              onClick={() => handleEdit(role)}
                              aria-label={`Edit ${role.name}`}
                            >
                              <Pencil className="h-3.5 w-3.5" />
                            </Button>
                          </TooltipTrigger>
                          <TooltipContent>Edit</TooltipContent>
                        </Tooltip>
                      </TableCell>
                    )}
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

      {canEdit && (
        <Dialog
          open={showForm}
          onOpenChange={(open) => {
            if (!open) resetForm();
            else setShowForm(true);
          }}
        >
          <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle>{editingId ? 'Edit role' : 'Create role'}</DialogTitle>
            </DialogHeader>
            <form onSubmit={editingId ? handleUpdate : handleCreate} className="space-y-3">
              <div className="space-y-1.5">
                <Label className="text-2xs uppercase text-muted-foreground">Role name</Label>
                <Input
                  value={form.name}
                  onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))}
                  placeholder="e.g. BDM, Finance team"
                  required
                  className="h-8 text-xs"
                />
              </div>
              <div className="space-y-1.5">
                <Label className="text-2xs uppercase text-muted-foreground">Description</Label>
                <Input
                  value={form.description}
                  onChange={(e) => setForm((f) => ({ ...f, description: e.target.value }))}
                  placeholder="Who is this role for?"
                  className="h-8 text-xs"
                />
              </div>
              <div className="space-y-1.5">
                <Label className="text-2xs uppercase text-muted-foreground">Access</Label>
                <PermissionPicker
                  catalog={catalog}
                  selectedKeys={form.permissions}
                  onChange={(permissions) => setForm((f) => ({ ...f, permissions }))}
                />
              </div>
              <div className="flex gap-2 pt-1">
                <Button type="submit" size="sm" disabled={createRole.isPending || updateRole.isPending}>
                  {editingId ? 'Save role' : 'Create role'}
                </Button>
                <Button type="button" variant="outline" size="sm" onClick={resetForm}>
                  Cancel
                </Button>
              </div>
            </form>
          </DialogContent>
        </Dialog>
      )}
    </>
  );
};
