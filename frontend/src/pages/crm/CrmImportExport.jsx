import { useCallback } from 'react';
import { useDropzone } from 'react-dropzone';
import { toast } from 'sonner';
import { useCrmImport, exportCrmWorkbook } from '../../api/crm';
import { useCrmBdm } from './CrmBdmContext';
import { usePermissions } from '../../hooks/usePermissions';
import { PERMISSIONS } from '../../config/permissions';
import { TABULAR_ACCEPT, validateTabularFile } from '../../config/upload';
import { Button } from '../../ui/button';
import { InfoHint } from '../../components/InfoHint';
import { getErrorMessage } from '../../utils/api';
import { cn } from '../../lib/utils';

export function CrmImportExport() {
  const { hasPermission } = usePermissions();
  const { bdmParams } = useCrmBdm();
  const canManage = hasPermission(PERMISSIONS.CRM_MANAGE);
  const importM = useCrmImport();

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
        const r = res.results || {};
        toast.success(
          `Import complete — SC: ${r.supportCoordinators?.upserted ?? 0}, Leads: ${r.leads?.upserted ?? 0}, Activities: ${r.marketingActivities?.upserted ?? 0}, Staffing: ${r.staffingRequirements?.upserted ?? 0}`
        );
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
      await exportCrmWorkbook(bdmParams);
      toast.success('Export downloaded');
    } catch (e) {
      toast.error(getErrorMessage(e));
    }
  };

  return (
    <div className="grid gap-2 sm:grid-cols-2">
      <div className="rounded-lg border border-border/60 bg-card p-3 shadow-card dark:shadow-none">
        <div className="mb-2 flex items-center gap-1.5">
          <span className="text-sm font-semibold">Import</span>
          <InfoHint
            content="BDM Master Tracker .xlsx — imports Support Coordinators, Leads, Marketing Activities, and Staffing Requirements sheets."
            label="About CRM import"
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
            <InfoHint content="Manage permission required to import CRM data." label="Import permission" />
          </p>
        )}
      </div>
      <div className="rounded-lg border border-border/60 bg-card p-3 shadow-card dark:shadow-none">
        <div className="mb-2 flex items-center gap-1.5">
          <span className="text-sm font-semibold">Export</span>
          <InfoHint content="Download CRM data as Excel for the selected BDM filter." label="About CRM export" />
        </div>
        <Button type="button" size="sm" onClick={handleExport}>
          Download Excel
        </Button>
      </div>
    </div>
  );
}
