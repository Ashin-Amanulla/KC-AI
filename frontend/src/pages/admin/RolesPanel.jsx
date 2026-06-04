import { useState, useMemo } from 'react';
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

  const catalogByCategory = useMemo(() => {
    const groups = {};
    for (const item of catalog) {
      const cat = item.category || 'Other';
      if (!groups[cat]) groups[cat] = [];
      groups[cat].push(item);
    }
    return groups;
  }, [catalog]);

  const resetForm = () => {
    setForm(emptyForm());
    setEditingId(null);
    setShowForm(false);
  };

  const togglePermission = (key) => {
    setForm((f) => ({
      ...f,
      permissions: f.permissions.includes(key)
        ? f.permissions.filter((p) => p !== key)
        : [...f.permissions, key],
    }));
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
        <h3 className="text-xl font-semibold">Roles & permissions</h3>
        {canEdit && (
          <Button onClick={() => { resetForm(); setShowForm(true); }}>Add Role</Button>
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
            <CardTitle>{editingId ? 'Edit Role' : 'Create Role'}</CardTitle>
          </CardHeader>
          <CardContent>
            <form
              onSubmit={editingId ? handleUpdate : handleCreate}
              className="flex flex-col gap-4"
            >
              <div>
                <label className="text-sm font-medium">Name</label>
                <Input
                  value={form.name}
                  onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))}
                  required
                  className="mt-1"
                />
              </div>
              <div>
                <label className="text-sm font-medium">Description</label>
                <Input
                  value={form.description}
                  onChange={(e) => setForm((f) => ({ ...f, description: e.target.value }))}
                  className="mt-1"
                />
              </div>
              <div>
                <label className="text-sm font-medium mb-2 block">Permissions</label>
                <div className="space-y-4 max-h-96 overflow-y-auto border rounded-md p-4">
                  {Object.entries(catalogByCategory).map(([category, items]) => (
                    <div key={category}>
                      <p className="text-xs font-semibold text-muted-foreground uppercase mb-2">
                        {category}
                      </p>
                      <div className="grid gap-2 sm:grid-cols-2">
                        {items.map((item) => (
                          <label
                            key={item.key}
                            className="flex items-start gap-2 text-sm cursor-pointer"
                          >
                            <input
                              type="checkbox"
                              checked={form.permissions.includes(item.key)}
                              onChange={() => togglePermission(item.key)}
                              className="mt-1"
                            />
                            <span>
                              <span className="font-medium">{item.label}</span>
                              {item.path && (
                                <span className="block text-xs text-muted-foreground">
                                  {item.path}
                                </span>
                              )}
                            </span>
                          </label>
                        ))}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
              <div className="flex gap-2">
                <Button type="submit" disabled={createRole.isPending || updateRole.isPending}>
                  {editingId ? 'Update' : 'Create'}
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
                  <TableHead>Name</TableHead>
                  <TableHead>Slug</TableHead>
                  <TableHead>Users</TableHead>
                  <TableHead>Permissions</TableHead>
                  <TableHead>Status</TableHead>
                  {canEdit && <TableHead className="text-right">Actions</TableHead>}
                </TableRow>
              </TableHeader>
              <TableBody>
                {roles.map((role) => (
                  <TableRow key={role._id}>
                    <TableCell>
                      {role.name}
                      {role.isSystem && (
                        <span className="ml-2 text-xs bg-muted px-1.5 py-0.5 rounded">System</span>
                      )}
                    </TableCell>
                    <TableCell className="font-mono text-xs">{role.slug}</TableCell>
                    <TableCell>{role.userCount ?? 0}</TableCell>
                    <TableCell className="text-xs text-muted-foreground max-w-xs truncate">
                      {(role.permissions || []).length} granted
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
