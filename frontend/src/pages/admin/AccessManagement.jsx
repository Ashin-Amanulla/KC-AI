import { useState } from 'react';
import { UsersPanel } from './UsersPanel';
import { RolesPanel } from './RolesPanel';
import { usePermissions } from '../../hooks/usePermissions';
import { Button } from '../../ui/button';
import { cn } from '../../lib/utils';

export const AccessManagement = () => {
  const { canManageUsers, canManageRoles } = usePermissions();
  const defaultTab = canManageUsers ? 'users' : 'roles';
  const [tab, setTab] = useState(defaultTab);

  const tabs = [
    canManageUsers && { id: 'users', label: 'Users' },
    (canManageRoles || canManageUsers) && { id: 'roles', label: 'Roles & permissions' },
  ].filter(Boolean);

  if (!tabs.length) {
    return (
      <div className="py-12 text-center text-muted-foreground">
        You do not have permission to access this area.
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-3xl font-bold">Access management</h2>
        <p className="text-muted-foreground mt-1">
          Assign each person a role to control what they can see and do. Use plain-language permission
          descriptions when editing roles.
        </p>
      </div>

      {tabs.length > 1 && (
        <div className="flex gap-2 border-b">
          {tabs.map((t) => (
            <Button
              key={t.id}
              type="button"
              variant="ghost"
              className={cn(
                'rounded-none border-b-2 border-transparent',
                tab === t.id && 'border-primary text-foreground'
              )}
              onClick={() => setTab(t.id)}
            >
              {t.label}
            </Button>
          ))}
        </div>
      )}

      {tab === 'users' && canManageUsers && <UsersPanel />}
      {tab === 'roles' && (
        <RolesPanel readOnly={!canManageRoles} />
      )}
    </div>
  );
};
