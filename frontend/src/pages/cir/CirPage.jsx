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
import { Card, CardContent, CardHeader, CardTitle } from '../../ui/card';
import { Button } from '../../ui/button';
import { getErrorMessage } from '../../utils/api';
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
    <div className="space-y-4">
      <div>
        <h2 className="text-2xl font-bold tracking-tight md:text-3xl">Continuous Improvement Register</h2>
        <p className="text-sm text-muted-foreground">
          Live register for tracking issues, actions, and outcomes across Kangaroo Care Services.
        </p>
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Import workbook</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            <p className="text-sm text-muted-foreground">
              Upload a CIR Excel file (.xlsx). Records are upserted by CIR ID.
            </p>
            {canManage ? (
              <div
                {...getRootProps()}
                className={`cursor-pointer rounded-lg border-2 border-dashed p-6 text-center text-sm transition-colors ${
                  isDragActive ? 'border-primary bg-primary/5' : 'border-muted-foreground/25'
                }`}
              >
                <input {...getInputProps()} />
                {importM.isPending
                  ? 'Importing…'
                  : isDragActive
                    ? 'Drop file here'
                    : 'Drag & drop an Excel file, or click to browse'}
              </div>
            ) : (
              <p className="text-sm text-muted-foreground">You need manage permission to import.</p>
            )}
          </CardContent>
        </Card>
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Export workbook</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            <p className="text-sm text-muted-foreground">Download all CIR records as Excel.</p>
            <Button type="button" onClick={handleExport}>
              Download Excel
            </Button>
          </CardContent>
        </Card>
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
