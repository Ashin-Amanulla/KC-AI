import { useCallback } from 'react';
import { useDropzone } from 'react-dropzone';
import { toast } from 'sonner';
import { useCrmImport, exportCrmWorkbook } from '../../api/crm';
import { usePermissions } from '../../hooks/usePermissions';
import { PERMISSIONS } from '../../config/permissions';
import { TABULAR_ACCEPT, validateTabularFile } from '../../config/upload';
import { Card, CardContent, CardHeader, CardTitle } from '../../ui/card';
import { Button } from '../../ui/button';
import { getErrorMessage } from '../../utils/api';

export function CrmImportExport() {
  const { hasPermission } = usePermissions();
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
      await exportCrmWorkbook();
      toast.success('Export downloaded');
    } catch (e) {
      toast.error(getErrorMessage(e));
    }
  };

  return (
    <div className="grid gap-6 lg:grid-cols-2">
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Import workbook</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <p className="text-sm text-muted-foreground">
            Upload a BDM Master Tracker Excel file (.xlsx). All four data sheets will be imported
            (Support Coordinators, Potential Leads, Marketing Activities, Staffing Requirements).
          </p>
          {canManage ? (
            <div
              {...getRootProps()}
              className={`cursor-pointer rounded-lg border-2 border-dashed p-8 text-center transition-colors ${
                isDragActive ? 'border-primary bg-primary/5' : 'border-muted-foreground/25'
              }`}
            >
              <input {...getInputProps()} />
              <p className="text-sm">
                {importM.isPending
                  ? 'Importing…'
                  : isDragActive
                    ? 'Drop file here'
                    : 'Drag & drop an Excel file, or click to browse'}
              </p>
            </div>
          ) : (
            <p className="text-sm text-muted-foreground">You need CRM manage permission to import.</p>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Export workbook</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <p className="text-sm text-muted-foreground">
            Download all CRM data as an Excel workbook matching the BDM Master Tracker format.
          </p>
          <Button type="button" onClick={handleExport}>
            Download Excel
          </Button>
        </CardContent>
      </Card>
    </div>
  );
}
