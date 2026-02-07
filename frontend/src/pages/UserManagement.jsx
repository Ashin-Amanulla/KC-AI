import { useState } from 'react';
import { useUsers, useCreateUser, useUpdateUser, useDeleteUser } from '../api/users';
import { Card, CardContent, CardHeader, CardTitle } from '../ui/card';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '../ui/table';
import { Button } from '../ui/button';
import { Input } from '../ui/input';

const ROLE_LABELS = {
  super_admin: 'Super Admin',
  finance: 'Finance',
  viewer: 'Viewer',
};

export const UserManagement = () => {
  const [showForm, setShowForm] = useState(false);
  const [editingId, setEditingId] = useState(null);
  const [form, setForm] = useState({ email: '', password: '', name: '', role: 'viewer' });

  const { data, isLoading, error } = useUsers();
  const createUser = useCreateUser();
  const updateUser = useUpdateUser();
  const deleteUser = useDeleteUser();

  const users = data?.users || [];

  const resetForm = () => {
    setForm({ email: '', password: '', name: '', role: 'viewer' });
    setEditingId(null);
    setShowForm(false);
  };

  const handleCreate = async (e) => {
    e.preventDefault();
    try {
      await createUser.mutateAsync({
        email: form.email,
        password: form.password,
        name: form.name,
        role: form.role,
      });
      resetForm();
    } catch (err) {
      console.error(err);
    }
  };

  const handleUpdate = async (e) => {
    e.preventDefault();
    if (!editingId) return;
    try {
      await updateUser.mutateAsync({
        id: editingId,
        name: form.name,
        role: form.role,
        isActive: form.isActive,
        ...(form.password ? { password: form.password } : {}),
      });
      resetForm();
    } catch (err) {
      console.error(err);
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
    } catch (err) {
      console.error(err);
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h2 className="text-3xl font-bold">User Management</h2>
        <Button onClick={() => { resetForm(); setShowForm(true); }}>
          Add User
        </Button>
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
                  className="mt-1"
                />
              </div>
              <div>
                <label className="text-sm font-medium">Role</label>
                <select
                  value={form.role}
                  onChange={(e) => setForm((f) => ({ ...f, role: e.target.value }))}
                  className="mt-1 flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
                >
                  {Object.entries(ROLE_LABELS).map(([value, label]) => (
                    <option key={value} value={value}>{label}</option>
                  ))}
                </select>
              </div>
              {editingId && (
                <div className="flex items-center gap-2">
                  <input
                    type="checkbox"
                    id="isActive"
                    checked={form.isActive}
                    onChange={(e) => setForm((f) => ({ ...f, isActive: e.target.checked }))}
                  />
                  <label htmlFor="isActive" className="text-sm font-medium">Active</label>
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
        <CardHeader>
          <CardTitle>Users</CardTitle>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <div className="py-8 text-center">Loading users...</div>
          ) : error ? (
            <div className="py-8 text-center text-destructive">
              Error: {error.message}
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
                    <TableCell>{ROLE_LABELS[user.role] || user.role}</TableCell>
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
