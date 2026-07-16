import { useCallback, useEffect, useState } from 'react';
import { useDropzone } from 'react-dropzone';
import { toast } from 'sonner';
import {
  useCirRecords,
  useCreateCirRecord,
  useUpdateCirRecord,
  useDeleteCirRecord,
  useAppendCirActionUpdate,
  useCirImport,
  exportCirWorkbook,
  fetchCirNextId,
} from '../../api/cir';
import { usePermissions } from '../../hooks/usePermissions';
import { PERMISSIONS } from '../../config/permissions';
import { TABULAR_ACCEPT, validateTabularFile } from '../../config/upload';
import { Button } from '../../ui/button';
import { InfoHint } from '../../components/InfoHint';
import { getErrorMessage } from '../../utils/api';
import { cn } from '../../lib/utils';
import { CrmSpreadsheet } from '../crm/CrmSpreadsheet';
import { CIR_ENTITY_CONFIG } from './cirColumnDefs';

const config = CIR_ENTITY_CONFIG;

export function CirPage() {
  const { hasPermission } = usePermissions();
  const canManage = hasPermission(PERMISSIONS.CIR_MANAGE);
  const [search, setSearch] = useState('');
  const [debouncedSearch, setDebouncedSearch] = useState('');

  useEffect(() => {
    const timer = setTimeout(() => setDebouncedSearch(search), 300);
    return () => clearTimeout(timer);
  }, [search]);

  const { data, isLoading } = useCirRecords({ search: debouncedSearch || undefined });
  const createM = useCreateCirRecord();
  const updateM = useUpdateCirRecord();
  const deleteM = useDeleteCirRecord();
  const actionUpdateM = useAppendCirActionUpdate();
  const importM = useCirImport();

  const onDrop = useCallback(
    async (files) => {
      const file = files[0];
      if (!file) return;
      const check = validateTabularFile(file);
      if (!check.valid) {
        toast.error(check.error);
        return;
      }
      try {
        const res = await importM.mutateAsync(file);
        toast.success(`Import complete — ${res.results?.upserted ?? 0} records upserted`);
      } catch (e) {
        toast.error(getErrorMessage(e));
      }
    },
    [importM]
  );

  const { getRootProps, getInputProps, isDragActive } = useDropzone({
    onDrop,
    accept: TABULAR_ACCEPT,
    maxFiles: 1,
    disabled: !canManage || importM.isPending,
  });

  const handleExport = async () => {
    try {
      await exportCirWorkbook();
      toast.success('Export downloaded');
    } catch (e) {
      toast.error(getErrorMessage(e));
    }
  };

  return (
    <div className="page-stack-tight">
      <div className="flex items-center gap-2">
        <InfoHint
          content="Track issues, actions, and outcomes across Kangaroo Care Services."
          label="About continuous improvement"
          variant="help"
        />
        <span className="text-2xs text-muted-foreground">Growth · CIR register</span>
      </div>

      <div className="grid gap-2 sm:grid-cols-2">
        <div className="rounded-lg border border-border/60 bg-card p-3 shadow-card dark:shadow-none">
          <div className="mb-2 flex items-center gap-1.5">
            <span className="text-sm font-semibold">Import</span>
            <InfoHint
              content="Upload a CIR Excel file (.xlsx). Records upsert by CIR ID."
              label="About CIR import"
            />
          </div>
          {canManage ? (
            <div
              {...getRootProps()}
              className={cn(
                'cursor-pointer rounded-md border border-dashed px-3 py-4 text-center text-2sm transition-colors',
                isDragActive ? 'border-primary bg-primary/5' : 'border-border/60 text-muted-foreground hover:bg-muted/30'
              )}
            >
              <input {...getInputProps()} />
              {importM.isPending
                ? 'Importing…'
                : isDragActive
                  ? 'Drop file here'
                  : 'Drag & drop or click to browse'}
            </div>
          ) : (
            <p className="flex items-center gap-1.5 text-2xs text-muted-foreground">
              View only
              <InfoHint content="Manage permission required to import CIR records." label="Import permission" />
            </p>
          )}
        </div>
        <div className="rounded-lg border border-border/60 bg-card p-3 shadow-card dark:shadow-none">
          <div className="mb-2 flex items-center gap-1.5">
            <span className="text-sm font-semibold">Export</span>
            <InfoHint content="Download all CIR records as Excel." label="About CIR export" />
          </div>
          <Button type="button" size="sm" onClick={handleExport}>
            Download Excel
          </Button>
        </div>
      </div>

      <CrmSpreadsheet
        title="CIR register"
        columns={config.columns}
        rows={data?.[config.rowsKey] ?? []}
        idField={config.idField}
        idLabel={config.idLabel}
        autoIdEntity={config.autoIdEntity}
        fetchNextId={fetchCirNextId}
        isLoading={isLoading}
        canManage={canManage}
        searchValue={search}
        onSearchChange={setSearch}
        onCreate={createM.mutateAsync}
        onUpdate={updateM.mutateAsync}
        onDelete={deleteM.mutateAsync}
        onAppendActionUpdate={actionUpdateM.mutateAsync}
        deleteConfirm={config.deleteConfirm}
        isSaving={
          createM.isPending ||
          updateM.isPending ||
          deleteM.isPending ||
          actionUpdateM.isPending
        }
        collaborationRoom={config.collaborationRoom}
        queryKeyPrefix={config.queryKeyPrefix}
        rowsKey={config.rowsKey}
      />
    </div>
  );
}
