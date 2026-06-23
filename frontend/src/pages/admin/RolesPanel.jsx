import { useState } from 'react';
import { toast } from 'sonner';
import { useRoles, useCreateRole, useUpdateRole, useDeleteRole } from '../../api/roles';
import { usePermissions } from '../../hooks/usePermissions';
import { getErrorMessage } from '../../utils/api';
import { Card, CardContent, CardHeader, CardTitle } from '../../ui/card';
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
  const deleteRole = useDeleteRole();
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

  const handleDeactivate = async (id, name) => {
    if (!window.confirm(`Deactivate role "${name}"?`)) return;
    try {
      await deleteRole.mutateAsync(id);
      toast.success('Role deactivated');
    } catch (err) {
      toast.error(getErrorMessage(err) || 'Failed to deactivate role');
    }
  };

  const canEdit = canManageRoles && !readOnly;

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h3 className="text-xl font-semibold">Roles & permissions</h3>
          <p className="text-sm text-muted-foreground mt-1">
            A role is a template of what someone can see and do. Assign roles to users on the Users tab.
          </p>
        </div>
        {canEdit && (
          <Button onClick={() => { resetForm(); setShowForm(true); }}>Add role</Button>
        )}
      </div>

      {readOnly && (
        <p className="text-sm text-muted-foreground">
          You can view roles but need role management permission to edit.
        </p>
      )}

      {showForm && canEdit && (
        <Card>
          <CardHeader>
            <CardTitle>{editingId ? 'Edit role' : 'Create role'}</CardTitle>
          </CardHeader>
          <CardContent>
            <form
              onSubmit={editingId ? handleUpdate : handleCreate}
              className="flex flex-col gap-4"
            >
              <div>
                <label className="text-sm font-medium">Role name</label>
                <Input
                  value={form.name}
                  onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))}
                  placeholder="e.g. BDM, Finance team"
                  required
                  className="mt-1"
                />
              </div>
              <div>
                <label className="text-sm font-medium">Description (optional)</label>
                <Input
                  value={form.description}
                  onChange={(e) => setForm((f) => ({ ...f, description: e.target.value }))}
                  placeholder="Who is this role for?"
                  className="mt-1"
                />
              </div>
              <div>
                <label className="text-sm font-medium mb-2 block">What can this role access?</label>
                <PermissionPicker
                  catalog={catalog}
                  selectedKeys={form.permissions}
                  onChange={(permissions) => setForm((f) => ({ ...f, permissions }))}
                />
              </div>
              <div className="flex gap-2">
                <Button type="submit" disabled={createRole.isPending || updateRole.isPending}>
                  {editingId ? 'Save role' : 'Create role'}
                </Button>
                <Button type="button" variant="outline" onClick={resetForm}>
                  Cancel
                </Button>
              </div>
            </form>
          </CardContent>
        </Card>
      )}

      <Card>
        <CardContent className="pt-6">
          {isLoading ? (
            <div className="py-8 text-center">Loading roles...</div>
          ) : error ? (
            <div className="py-8 text-center text-destructive">
              Error: {getErrorMessage(error)}
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Role</TableHead>
                  <TableHead>Users</TableHead>
                  <TableHead>Access summary</TableHead>
                  <TableHead>Status</TableHead>
                  {canEdit && <TableHead className="text-right">Actions</TableHead>}
                </TableRow>
              </TableHeader>
              <TableBody>
                {roles.map((role) => (
                  <TableRow key={role._id}>
                    <TableCell>
                      <div className="font-medium">{role.name}</div>
                      {role.description && (
                        <div className="text-xs text-muted-foreground mt-0.5 max-w-xs">{role.description}</div>
                      )}
                      {role.isSystem && (
                        <span className="mt-1 inline-block text-xs bg-muted px-1.5 py-0.5 rounded">Built-in role</span>
                      )}
                    </TableCell>
                    <TableCell>{role.userCount ?? 0}</TableCell>
                    <TableCell>
                      <RolePermissionSummary
                        permissionKeys={role.permissions || []}
                        catalog={catalog}
                      />
                    </TableCell>
                    <TableCell>{role.isActive !== false ? 'Active' : 'Inactive'}</TableCell>
                    {canEdit && (
                      <TableCell className="text-right">
                        <Button
                          variant="outline"
                          size="sm"
                          className="mr-2"
                          onClick={() => handleEdit(role)}
                        >
                          Edit
                        </Button>
                        {!role.isSystem && role.isActive !== false && (
                          <Button
                            variant="destructive"
                            size="sm"
                            onClick={() => handleDeactivate(role._id, role.name)}
                          >
                            Deactivate
                          </Button>
                        )}
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
};
