import { useEffect, useState } from 'react';
import {
  useCrmStaffingRequirements,
  useCreateCrmStaffingRequirement,
  useUpdateCrmStaffingRequirement,
  useDeleteCrmStaffingRequirement,
} from '../../api/crm';
import { usePermissions } from '../../hooks/usePermissions';
import { PERMISSIONS } from '../../config/permissions';
import { CrmSpreadsheet } from './CrmSpreadsheet';
import { CRM_ENTITY_CONFIG } from './crmColumnDefs';

const config = CRM_ENTITY_CONFIG.staffingRequirements;

export function CrmStaffingRequirements() {
  const { hasPermission } = usePermissions();
  const canManage = hasPermission(PERMISSIONS.CRM_MANAGE);
  const [search, setSearch] = useState('');
  const [debouncedSearch, setDebouncedSearch] = useState('');

  useEffect(() => {
    const timer = setTimeout(() => setDebouncedSearch(search), 300);
    return () => clearTimeout(timer);
  }, [search]);

  const { data, isLoading } = useCrmStaffingRequirements({ search: debouncedSearch || undefined });
  const createM = useCreateCrmStaffingRequirement();
  const updateM = useUpdateCrmStaffingRequirement();
  const deleteM = useDeleteCrmStaffingRequirement();

  return (
    <CrmSpreadsheet
      title="Staffing requirements"
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
