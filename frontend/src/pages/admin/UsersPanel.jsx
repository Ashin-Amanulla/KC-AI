import { useState, useEffect } from 'react';
import { toast } from 'sonner';
import { useUsers, useCreateUser, useUpdateUser, useDeleteUser } from '../../api/users';
import { useRoles } from '../../api/roles';
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

export const UsersPanel = () => {
  const [showForm, setShowForm] = useState(false);
  const [editingId, setEditingId] = useState(null);
  const [form, setForm] = useState({ email: '', password: '', name: '', role: 'viewer' });

  const { data, isLoading, error } = useUsers();
  const { data: rolesData } = useRoles();
  const createUser = useCreateUser();
  const updateUser = useUpdateUser();
  const deleteUser = useDeleteUser();

  const users = data?.users || [];
  const roles = (rolesData?.roles || []).filter((r) => r.isActive !== false);
  const roleLabel = (slug) => roles.find((r) => r.slug === slug)?.name || slug;
  const defaultRoleSlug = roles[0]?.slug || 'viewer';

  useEffect(() => {
    if (!roles.length) return;
    const validSlugs = new Set(roles.map((r) => r.slug));
    if (!validSlugs.has(form.role)) {
      setForm((f) => ({ ...f, role: defaultRoleSlug }));
    }
  }, [roles, defaultRoleSlug, form.role]);

  const resetForm = () => {
    setForm({ email: '', password: '', name: '', role: defaultRoleSlug });
    setEditingId(null);
    setShowForm(false);
  };

  const handleCreate = async (e) => {
    e.preventDefault();
    const name = form.name.trim();
    const email = form.email.trim();
    if (!name) {
      toast.error('Name is required');
      return;
    }
    if (!email) {
      toast.error('Email is required');
      return;
    }
    if (!form.password || form.password.length < 6) {
      toast.error('Password must be at least 6 characters');
      return;
    }
    if (!roles.some((r) => r.slug === form.role)) {
      toast.error('Please choose a valid role');
      return;
    }
    try {
      await createUser.mutateAsync({
        email,
        password: form.password,
        name,
        role: form.role,
      });
      toast.success('User created');
      resetForm();
    } catch (err) {
      toast.error(getErrorMessage(err) || 'Failed to create user');
    }
  };

  const handleUpdate = async (e) => {
    e.preventDefault();
    if (!editingId) return;
    const name = form.name.trim();
    if (!name) {
      toast.error('Name is required');
      return;
    }
    if (form.password && form.password.length < 6) {
      toast.error('Password must be at least 6 characters');
      return;
    }
    if (!roles.some((r) => r.slug === form.role)) {
      toast.error('Please choose a valid role');
      return;
    }
    try {
      await updateUser.mutateAsync({
        id: editingId,
        name,
        role: form.role,
        isActive: form.isActive,
        ...(form.password ? { password: form.password } : {}),
      });
      toast.success('User updated');
      resetForm();
    } catch (err) {
      toast.error(getErrorMessage(err) || 'Failed to update user');
    }
  };

  const handleEdit = (user) => {
    setEditingId(user._id);
    setForm({
      email: user.email,
      password: '',
      name: user.name,
      role: user.role,
      isActive: user.isActive !== false,
    });
    setShowForm(true);
  };

  const handleDeactivate = async (id) => {
    try {
      await deleteUser.mutateAsync(id);
      toast.success('User deactivated');
    } catch (err) {
      toast.error(getErrorMessage(err) || 'Failed to deactivate user');
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h3 className="text-xl font-semibold">Users</h3>
        <Button onClick={() => { resetForm(); setShowForm(true); }}>Add User</Button>
      </div>

      {showForm && (
        <Card>
          <CardHeader>
            <CardTitle>{editingId ? 'Edit User' : 'Create User'}</CardTitle>
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
                  placeholder="Full name"
                  required
                  className="mt-1"
                />
              </div>
              <div>
                <label className="text-sm font-medium">Email</label>
                <Input
                  type="email"
                  value={form.email}
                  onChange={(e) => setForm((f) => ({ ...f, email: e.target.value }))}
                  placeholder="email@example.com"
                  required
                  disabled={!!editingId}
                  className="mt-1"
                />
              </div>
              <div>
                <label className="text-sm font-medium">
                  Password {editingId && '(leave blank to keep current)'}
                </label>
                <Input
                  type="password"
                  value={form.password}
                  onChange={(e) => setForm((f) => ({ ...f, password: e.target.value }))}
                  placeholder="••••••••"
                  required={!editingId}
                  minLength={editingId ? undefined : 6}
                  className="mt-1"
                />
                <p className="mt-1 text-xs text-muted-foreground">At least 6 characters</p>
              </div>
              <div>
                <label className="text-sm font-medium">Role</label>
                <select
                  value={form.role}
                  onChange={(e) => setForm((f) => ({ ...f, role: e.target.value }))}
                  className="mt-1 flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
                  required
                  disabled={roles.length === 0}
                >
                  {roles.length === 0 ? (
                    <option value="">No roles available</option>
                  ) : (
                    roles.map((r) => (
                      <option key={r.slug} value={r.slug}>
                        {r.name}
                      </option>
                    ))
                  )}
                </select>
                {(() => {
                  const selected = roles.find((r) => r.slug === form.role);
                  if (!selected?.description) return null;
                  return (
                    <p className="mt-1.5 text-xs text-muted-foreground">{selected.description}</p>
                  );
                })()}
              </div>
              {editingId && (
                <div className="flex items-center gap-2">
                  <input
                    type="checkbox"
                    id="isActive"
                    checked={form.isActive}
                    onChange={(e) => setForm((f) => ({ ...f, isActive: e.target.checked }))}
                  />
                  <label htmlFor="isActive" className="text-sm font-medium">
                    Active
                  </label>
                </div>
              )}
              <div className="flex gap-2">
                <Button type="submit" disabled={createUser.isPending || updateUser.isPending}>
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
            <div className="py-8 text-center">Loading users...</div>
          ) : error ? (
            <div className="py-8 text-center text-destructive">
              Error: {getErrorMessage(error)}
            </div>
          ) : users.length === 0 ? (
            <div className="py-8 text-center text-muted-foreground">No users yet.</div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Name</TableHead>
                  <TableHead>Email</TableHead>
                  <TableHead>Role</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead className="text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {users.map((user) => (
                  <TableRow key={user._id}>
                    <TableCell>{user.name}</TableCell>
                    <TableCell>{user.email}</TableCell>
                    <TableCell>{roleLabel(user.role)}</TableCell>
                    <TableCell>{user.isActive !== false ? 'Active' : 'Inactive'}</TableCell>
                    <TableCell className="text-right">
                      <Button
                        variant="outline"
                        size="sm"
                        className="mr-2"
                        onClick={() => handleEdit(user)}
                      >
                        Edit
                      </Button>
                      {user.isActive !== false && (
                        <Button
                          variant="destructive"
                          size="sm"
                          onClick={() => handleDeactivate(user._id)}
                        >
                          Deactivate
                        </Button>
                      )}
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
};
