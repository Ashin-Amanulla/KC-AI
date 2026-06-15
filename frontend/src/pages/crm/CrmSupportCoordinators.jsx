import { useEffect, useState } from 'react';
import {
  useCrmSupportCoordinators,
  useCreateCrmSupportCoordinator,
  useUpdateCrmSupportCoordinator,
  useDeleteCrmSupportCoordinator,
} from '../../api/crm';
import { usePermissions } from '../../hooks/usePermissions';
import { PERMISSIONS } from '../../config/permissions';
import { CrmSpreadsheet } from './CrmSpreadsheet';
import { CRM_ENTITY_CONFIG } from './crmColumnDefs';

const config = CRM_ENTITY_CONFIG.supportCoordinators;

export function CrmSupportCoordinators() {
  const { hasPermission } = usePermissions();
  const canManage = hasPermission(PERMISSIONS.CRM_MANAGE);
  const [search, setSearch] = useState('');
  const [debouncedSearch, setDebouncedSearch] = useState('');

  useEffect(() => {
    const timer = setTimeout(() => setDebouncedSearch(search), 300);
    return () => clearTimeout(timer);
  }, [search]);

  const { data, isLoading } = useCrmSupportCoordinators({ search: debouncedSearch || undefined });
  const createM = useCreateCrmSupportCoordinator();
  const updateM = useUpdateCrmSupportCoordinator();
  const deleteM = useDeleteCrmSupportCoordinator();

  return (
    <CrmSpreadsheet
      title="Support coordinators"
      columns={config.columns}
      rows={data?.[config.rowsKey] ?? []}
      idField={config.idField}
      idLabel={config.idLabel}
      isLoading={isLoading}
      canManage={canManage}
      searchValue={search}
      onSearchChange={setSearch}
      onCreate={createM.mutateAsync}
      onUpdate={updateM.mutateAsync}
      onDelete={deleteM.mutateAsync}
      deleteConfirm={config.deleteConfirm}
      isSaving={createM.isPending || updateM.isPending || deleteM.isPending}
    />
  );
}
