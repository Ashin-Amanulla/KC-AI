import { useEffect, useState } from 'react';
import {
  useHrRequirements,
  useCreateHrRequirement,
  useUpdateHrRequirement,
  useDeleteHrRequirement,
} from '../../api/hrRequirements';
import { usePermissions } from '../../hooks/usePermissions';
import { PERMISSIONS } from '../../config/permissions';
import { CrmSpreadsheet } from '../crm/CrmSpreadsheet';
import { HR_REQUIREMENTS_CONFIG } from './hrRequirementsColumnDefs';

const config = HR_REQUIREMENTS_CONFIG;

export function HrRequirementsPage() {
  const { hasPermission } = usePermissions();
  const canManage = hasPermission(PERMISSIONS.CRM_MANAGE);
  const [search, setSearch] = useState('');
  const [debouncedSearch, setDebouncedSearch] = useState('');

  useEffect(() => {
    const timer = setTimeout(() => setDebouncedSearch(search), 300);
    return () => clearTimeout(timer);
  }, [search]);

  const { data, isLoading } = useHrRequirements({ search: debouncedSearch || undefined });
  const createM = useCreateHrRequirement();
  const updateM = useUpdateHrRequirement();
  const deleteM = useDeleteHrRequirement();

  return (
    <div className="space-y-4">
      <div>
        <h2 className="text-2xl font-bold tracking-tight md:text-3xl">HR requirements</h2>
        <p className="text-sm text-muted-foreground">
          Staffing requirements — participant coverage, dates, and completion status.
        </p>
      </div>
      <CrmSpreadsheet
        title="HR requirements"
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
        collaborationRoom={config.collaborationRoom}
        queryKeyPrefix={config.queryKeyPrefix}
        rowsKey={config.rowsKey}
      />
    </div>
  );
}
