import { createContext, useContext, useMemo, useState } from 'react';
import { useCrmBdmOwners } from '../../api/crm';
import { usePermissions } from '../../hooks/usePermissions';
import { PERMISSIONS } from '../../config/permissions';

const CrmBdmContext = createContext(null);

export function CrmBdmProvider({ children }) {
  const { hasPermission } = usePermissions();
  const canViewAll =
    hasPermission(PERMISSIONS.CRM_VIEW_ALL) || hasPermission(PERMISSIONS.USERS_MANAGE);
  const [bdmOwnerId, setBdmOwnerId] = useState('all');
  const { data } = useCrmBdmOwners(canViewAll);

  const bdmParams = useMemo(() => {
    if (!canViewAll) return {};
    if (!bdmOwnerId || bdmOwnerId === 'all') return {};
    return { bdmOwnerId };
  }, [canViewAll, bdmOwnerId]);

  const value = useMemo(
    () => ({
      canViewAll,
      bdmOwnerId: canViewAll ? bdmOwnerId : null,
      setBdmOwnerId,
      bdmOwners: data?.bdmOwners ?? [],
      bdmParams,
    }),
    [canViewAll, bdmOwnerId, data?.bdmOwners, bdmParams]
  );

  return <CrmBdmContext.Provider value={value}>{children}</CrmBdmContext.Provider>;
}

export function useCrmBdm() {
  const ctx = useContext(CrmBdmContext);
  if (!ctx) {
    throw new Error('useCrmBdm must be used within CrmBdmProvider');
  }
  return ctx;
}
