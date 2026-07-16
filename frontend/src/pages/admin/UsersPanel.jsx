import { useState, useEffect } from 'react';
import { toast } from 'sonner';
import { UserPlus, Pencil } from 'lucide-react';
import { useUsers, useCreateUser, useUpdateUser } from '../../api/users';
import { useRoles } from '../../api/roles';
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
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '../../ui/select';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '../../ui/dialog';
import { LoadingScreen } from '../../ui/LoadingSpinner';
import { QueryErrorState } from '../../components/QueryErrorState';
import { FieldLabel } from '../../components/InfoHint';
import { Tooltip, TooltipContent, TooltipTrigger } from '../../ui/tooltip';

export const UsersPanel = () => {
  const [showForm, setShowForm] = useState(false);
  const [editingId, setEditingId] = useState(null);
  const [form, setForm] = useState({ email: '', password: '', name: '', role: 'viewer' });

  const { data, isLoading, error } = useUsers();
  const { data: rolesData } = useRoles();
  const createUser = useCreateUser();
  const updateUser = useUpdateUser();

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

  const handleToggleActive = async (user, next) => {
    try {
      await updateUser.mutateAsync({ id: user._id, isActive: next });
      toast.success(next ? 'User activated' : 'User deactivated');
    } catch (err) {
      toast.error(getErrorMessage(err) || 'Failed to update user');
    }
  };

  const openCreate = () => {
    resetForm();
    setShowForm(true);
  };

  const selectedRole = roles.find((r) => r.slug === form.role);

  return (
    <>
      <Card>
        <CardHeader className="flex-row flex-wrap items-center justify-between gap-2 space-y-0 border-b py-2.5">
          <div className="flex items-center gap-2">
            <span className="text-sm font-semibold">Users</span>
            {!isLoading && (
              <Badge variant="default">{users.length}</Badge>
            )}
          </div>
          <Tooltip>
            <TooltipTrigger asChild>
              <Button type="button" size="icon" variant="outline" onClick={openCreate} aria-label="Add user">
                <UserPlus className="h-4 w-4" />
              </Button>
            </TooltipTrigger>
            <TooltipContent>Add user</TooltipContent>
          </Tooltip>
        </CardHeader>
        <CardContent className="p-0 pb-4">
          {isLoading ? (
            <div className="px-4 py-8">
              <LoadingScreen message="Loading users…" />
            </div>
          ) : error ? (
            <div className="px-4 py-4">
              <QueryErrorState error={error} title="Failed to load users" className="border-0 shadow-none" />
            </div>
          ) : users.length === 0 ? (
            <div className="px-4 py-8 text-center text-sm text-muted-foreground">
              No users yet.
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Name</TableHead>
                  <TableHead>Email</TableHead>
                  <TableHead>Role</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead className="w-[52px] text-right">Edit</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {users.map((user) => (
                  <TableRow key={user._id}>
                    <TableCell className="font-medium">{user.name}</TableCell>
                    <TableCell>{user.email}</TableCell>
                    <TableCell>{roleLabel(user.role)}</TableCell>
                    <TableCell>
                      <div className="flex items-center gap-2">
                        <Switch
                          checked={user.isActive !== false}
                          onCheckedChange={(next) => handleToggleActive(user, next)}
                          disabled={updateUser.isPending}
                          aria-label={`${user.name} ${user.isActive !== false ? 'active' : 'inactive'}`}
                        />
                        <span className="text-2xs text-muted-foreground">
                          {user.isActive !== false ? 'Active' : 'Inactive'}
                        </span>
                      </div>
                    </TableCell>
                    <TableCell className="text-right">
                      <Tooltip>
                        <TooltipTrigger asChild>
                          <Button
                            variant="outline"
                            size="icon"
                            className="h-7 w-7"
                            onClick={() => handleEdit(user)}
                            aria-label={`Edit ${user.name}`}
                          >
                            <Pencil className="h-3.5 w-3.5" />
                          </Button>
                        </TooltipTrigger>
                        <TooltipContent>Edit</TooltipContent>
                      </Tooltip>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

      <Dialog open={showForm} onOpenChange={(open) => { if (!open) resetForm(); else setShowForm(true); }}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>{editingId ? 'Edit user' : 'Create user'}</DialogTitle>
          </DialogHeader>
          <form
            onSubmit={editingId ? handleUpdate : handleCreate}
            className="space-y-3"
          >
            <div className="space-y-1.5">
              <Label className="text-2xs uppercase text-muted-foreground">Name</Label>
              <Input
                value={form.name}
                onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))}
                placeholder="Full name"
                required
                className="h-8 text-xs"
              />
            </div>
            <div className="space-y-1.5">
              <Label className="text-2xs uppercase text-muted-foreground">Email</Label>
              <Input
                type="email"
                value={form.email}
                onChange={(e) => setForm((f) => ({ ...f, email: e.target.value }))}
                placeholder="email@example.com"
                required
                disabled={!!editingId}
                className="h-8 text-xs"
              />
            </div>
            <div className="space-y-1.5">
              <FieldLabel
                hint="At least 6 characters. Leave blank when editing to keep the current password."
                hintLabel="About password"
              >
                Password
              </FieldLabel>
              <Input
                type="password"
                value={form.password}
                onChange={(e) => setForm((f) => ({ ...f, password: e.target.value }))}
                placeholder="••••••••"
                required={!editingId}
                minLength={editingId ? undefined : 6}
                className="h-8 text-xs"
              />
            </div>
            <div className="space-y-1.5">
              <Label className="text-2xs uppercase text-muted-foreground">Role</Label>
              <Select
                value={form.role}
                onValueChange={(v) => setForm((f) => ({ ...f, role: v }))}
                disabled={roles.length === 0}
                required
              >
                <SelectTrigger className="h-8 text-xs">
                  <SelectValue placeholder="No roles available" />
                </SelectTrigger>
                <SelectContent>
                  {roles.map((r) => (
                    <SelectItem key={r.slug} value={r.slug}>
                      {r.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              {selectedRole?.description && (
                <p className="text-2xs text-muted-foreground">{selectedRole.description}</p>
              )}
            </div>
            {editingId && (
              <div className="flex items-center gap-2">
                <Switch
                  id="user-active"
                  checked={form.isActive}
                  onCheckedChange={(next) => setForm((f) => ({ ...f, isActive: next }))}
                />
                <Label htmlFor="user-active" className="text-sm font-normal">
                  Active
                </Label>
              </div>
            )}
            <div className="flex gap-2 pt-1">
              <Button type="submit" size="sm" disabled={createUser.isPending || updateUser.isPending}>
                {editingId ? 'Save' : 'Create'}
              </Button>
              <Button type="button" variant="outline" size="sm" onClick={resetForm}>
                Cancel
              </Button>
            </div>
          </form>
        </DialogContent>
      </Dialog>
    </>
  );
};
