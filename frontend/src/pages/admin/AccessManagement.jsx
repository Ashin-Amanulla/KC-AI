import { useState } from 'react';
import { UsersPanel } from './UsersPanel';
import { RolesPanel } from './RolesPanel';
import { usePermissions } from '../../hooks/usePermissions';
import { InfoHint } from '../../components/InfoHint';
import { Tabs, TabsList, TabsTrigger, TabsContent } from '../../ui/tabs';

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
      <div className="py-12 text-center text-sm text-muted-foreground">
        You do not have permission to access this area.
      </div>
    );
  }

  return (
    <div className="page-stack-tight">
      <div className="flex items-center gap-2">
        <InfoHint
          content="Assign roles to control what each person can see and do. Edit roles for plain-language permission descriptions."
          label="About access management"
          variant="help"
        />
        <span className="text-2xs text-muted-foreground">Manage users and role templates</span>
      </div>

      <Tabs value={tab} onValueChange={setTab}>
        {tabs.length > 1 && (
          <TabsList className="gap-0.5">
            {tabs.map((t) => (
              <TabsTrigger key={t.id} value={t.id} className="px-2.5 py-1 text-xs">
                {t.label}
              </TabsTrigger>
            ))}
          </TabsList>
        )}

        <TabsContent value="users" className={tabs.length > 1 ? 'mt-3' : 'mt-0'}>
          {canManageUsers && <UsersPanel />}
        </TabsContent>
        <TabsContent value="roles" className={tabs.length > 1 ? 'mt-3' : 'mt-0'}>
          <RolesPanel readOnly={!canManageRoles} />
        </TabsContent>
      </Tabs>
    </div>
  );
};
