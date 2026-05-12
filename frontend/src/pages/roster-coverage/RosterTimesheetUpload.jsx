import { useState } from 'react';
import { toast } from 'sonner';
import { useUploadRosterTimesheet } from '../../api/rosterCoverage';
import { Card, CardContent, CardHeader, CardTitle } from '../../ui/card';
import { Button } from '../../ui/button';
import { Input } from '../../ui/input';
import { getErrorMessage } from '../../utils/api';

function formatUploadInstant(iso) {
  if (!iso) return '';
  return new Date(iso).toLocaleString(undefined, { dateStyle: 'medium', timeStyle: 'short' });
}

export function RosterTimesheetUpload() {
  const upload = useUploadRosterTimesheet();
  const [file, setFile] = useState(null);
  const [lastUpload, setLastUpload] = useState(null);

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
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Fortnightly timesheet</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4 text-sm text-muted-foreground">
          <p>
            Upload the same <strong className="text-foreground">ShiftCare export CSV</strong> used on{' '}
            <strong className="text-foreground">Workforce</strong> (staff name, start time, end time, shift type,
            client name / Name column).
          </p>
          <ul className="list-disc pl-5">
            <li>Staff and participant names must match roster records (same spelling as in Roster coverage).</li>
            <li>Sleepover shifts are taken from the Shift type column.</li>
            <li>Cancelled / absent rows follow the same rules as the workforce importer.</li>
          </ul>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Upload</CardTitle>
        </CardHeader>
        <CardContent>
          <form onSubmit={onSubmit} className="space-y-4 max-w-xl">
            <div>
              <label className="text-sm font-medium">File</label>
              <Input
                type="file"
                accept=".csv"
                className="mt-1"
                onChange={(e) => setFile(e.target.files?.[0] ?? null)}
              />
            </div>
            <Button type="submit" disabled={upload.isPending}>
              {upload.isPending ? 'Uploading…' : 'Upload'}
            </Button>
            {lastUpload && (
              <div className="rounded-md border border-input bg-muted/30 p-3 text-sm">
                <p className="font-medium text-foreground">Last upload</p>
                {lastUpload.shiftsCreated > 0 ? (
                  <ul className="mt-2 space-y-1 text-muted-foreground">
                    {lastUpload.timesheetSpan ? (
                      <li>
                        <span className="text-foreground">Date range (imported shifts): </span>
                        {formatUploadInstant(lastUpload.timesheetSpan.start)} —{' '}
                        {formatUploadInstant(lastUpload.timesheetSpan.end)}
                      </li>
                    ) : null}
                    <li>
                      <span className="text-foreground">Total shift hours: </span>
                      {Number(lastUpload.totalHoursImported).toFixed(1)} h
                    </li>
                    <li className="text-xs">
                      {lastUpload.shiftsCreated} shift{lastUpload.shiftsCreated === 1 ? '' : 's'} ·{' '}
                      {lastUpload.rowsProcessed} CSV row{lastUpload.rowsProcessed === 1 ? '' : 's'}
                    </li>
                  </ul>
                ) : (
                  <p className="mt-2 text-muted-foreground">
                    No shifts were imported, so there is no duration to show. Fix row errors and try again.
                  </p>
                )}
              </div>
            )}
          </form>
        </CardContent>
      </Card>
    </div>
  );
}
