import { useEffect, useState } from 'react';
import {
  useCrmMarketingActivities,
  useCreateCrmMarketingActivity,
  useUpdateCrmMarketingActivity,
  useDeleteCrmMarketingActivity,
} from '../../api/crm';
import { usePermissions } from '../../hooks/usePermissions';
import { PERMISSIONS } from '../../config/permissions';
import { CrmSpreadsheet } from './CrmSpreadsheet';
import { CRM_ENTITY_CONFIG } from './crmColumnDefs';

const config = CRM_ENTITY_CONFIG.marketingActivities;

export function CrmMarketingActivities() {
  const { hasPermission } = usePermissions();
  const canManage = hasPermission(PERMISSIONS.CRM_MANAGE);
  const [search, setSearch] = useState('');
  const [debouncedSearch, setDebouncedSearch] = useState('');

  useEffect(() => {
    const timer = setTimeout(() => setDebouncedSearch(search), 300);
    return () => clearTimeout(timer);
  }, [search]);

  const { data, isLoading } = useCrmMarketingActivities({ search: debouncedSearch || undefined });
  const createM = useCreateCrmMarketingActivity();
  const updateM = useUpdateCrmMarketingActivity();
  const deleteM = useDeleteCrmMarketingActivity();

  return (
    <CrmSpreadsheet
      title="Marketing activities"
      columns={config.columns}
      rows={data?.[config.rowsKey] ?? []}
      idField={config.idField}
      idLabel={config.idLabel}
      autoIdEntity={config.autoIdEntity}
      isLoading={isLoading}
      canManage={canManage}
      searchValue={search}
      onSearchChange={setSearch}
      onCreate={createM.mutateAsync}
      onUpdate={updateM.mutateAsync}
      onDelete={deleteM.mutateAsync}
      deleteConfirm={config.deleteConfirm}
      isSaving={createM.isPending || updateM.isPending || deleteM.isPending}
      collaborationRoom={config.collaborationRoom}
      queryKeyPrefix={config.queryKeyPrefix}
      rowsKey={config.rowsKey}
    />
  );
}
