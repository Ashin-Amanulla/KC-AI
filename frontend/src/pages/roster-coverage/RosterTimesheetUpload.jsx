import { useState, useMemo } from 'react';
import { toast } from 'sonner';
import { useQueryClient } from '@tanstack/react-query';
import { Upload } from 'lucide-react';
import { useUploadRosterTimesheet, useRosterPayPeriodTag } from '../../api/rosterCoverage';
import { Button } from '../../ui/button';
import { Input } from '../../ui/input';
import { CardTitleHint } from '../../components/InfoHint';
import { getErrorMessage } from '../../utils/api';
import { setRosterTimesheetWindow } from '../../utils/rosterCoveragePayPeriod';

function formatUploadInstant(iso) {
  if (!iso) return '';
  return new Date(iso).toLocaleString(undefined, { dateStyle: 'medium', timeStyle: 'short' });
}

export function RosterTimesheetUpload() {
  const qc = useQueryClient();
  const upload = useUploadRosterTimesheet();
  const payTag = useRosterPayPeriodTag();
  const activeWindow = useMemo(() => {
    if (!payTag) return null;
    try {
      const [start, end] = JSON.parse(payTag);
      return start && end ? { start, end } : null;
    } catch {
      return null;
    }
  }, [payTag]);
  const [file, setFile] = useState(null);
  const [lastUpload, setLastUpload] = useState(null);

  const clearTimesheetWindow = () => {
    setRosterTimesheetWindow(null);
    qc.invalidateQueries({ queryKey: ['roster-coverage'] });
    toast.message('Timesheet window cleared — Team and profiles use today’s fortnight again.');
  };

  const onSubmit = async (e) => {
    e.preventDefault();
    if (!file) {
      toast.error('Choose a CSV file');
      return;
    }
    try {
      const res = await upload.mutateAsync({ file });
      setLastUpload({
        shiftsCreated: res.shiftsCreated ?? 0,
        rowsProcessed: res.rowsProcessed ?? 0,
        timesheetSpan: res.timesheetSpan ?? null,
        totalHoursImported: res.totalHoursImported ?? 0,
      });
      const hrs = Number(res.totalHoursImported ?? 0);
      toast.success(
        res.shiftsCreated
          ? `Imported ${res.shiftsCreated} shifts · ${hrs.toFixed(1)} h total (${res.rowsProcessed} rows)`
          : `No shifts imported (${res.rowsProcessed} rows)`
      );
      if (res.errors?.length) {
        toast.message(`${res.errors.length} row errors — check response in network tab`);
      }
      setFile(null);
    } catch (err) {
      toast.error(getErrorMessage(err));
    }
  };

  return (
    <div className="page-stack-dense">
      <section className="rounded-lg border bg-card p-3 space-y-2.5">
        <CardTitleHint
          titleClassName="text-2sm"
          hintLabel="About timesheet import"
          hint={
            <>
              After import, Team and Find cover use the full date span of shifts in the file. Upload the same ShiftCare
              export CSV as Workforce. Staff and participant names must match roster records.
            </>
          }
        >
          Upload
        </CardTitleHint>

        <form onSubmit={onSubmit} className="space-y-2.5">
          {activeWindow ? (
            <div className="muted-strip flex flex-wrap items-center justify-between gap-2 py-1.5">
              <span>
                Active window:{' '}
                <span className="font-medium text-foreground">
                  {formatUploadInstant(activeWindow.start)} — {formatUploadInstant(activeWindow.end)}
                </span>
              </span>
              <Button type="button" variant="outline" size="sm" onClick={clearTimesheetWindow}>
                Clear
              </Button>
            </div>
          ) : null}

          <div className="flex flex-wrap items-center gap-2">
            <Input
              type="file"
              accept=".csv"
              className="h-8 max-w-xs text-2sm file:text-2sm"
              onChange={(e) => setFile(e.target.files?.[0] ?? null)}
            />
            <Button type="submit" size="sm" disabled={upload.isPending || !file}>
              <Upload className="mr-1.5 h-3.5 w-3.5" />
              {upload.isPending ? 'Uploading…' : 'Upload'}
            </Button>
          </div>

          {lastUpload && (
            <div className="detail-panel space-y-1 p-3 text-2sm">
              <p className="font-medium text-foreground">Last upload</p>
              {lastUpload.shiftsCreated > 0 ? (
                <ul className="space-y-0.5 text-muted-foreground">
                  {lastUpload.timesheetSpan ? (
                    <li>
                      Range: {formatUploadInstant(lastUpload.timesheetSpan.start)} —{' '}
                      {formatUploadInstant(lastUpload.timesheetSpan.end)}
                    </li>
                  ) : null}
                  <li>Total hours: {Number(lastUpload.totalHoursImported).toFixed(1)} h</li>
                  <li className="text-2xs">
                    {lastUpload.shiftsCreated} shift{lastUpload.shiftsCreated === 1 ? '' : 's'} ·{' '}
                    {lastUpload.rowsProcessed} row{lastUpload.rowsProcessed === 1 ? '' : 's'}
                  </li>
                </ul>
              ) : (
                <p className="text-muted-foreground">No shifts imported — fix row errors and try again.</p>
              )}
            </div>
          )}
        </form>
      </section>
    </div>
  );
}
