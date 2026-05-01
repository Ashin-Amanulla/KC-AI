import { useState } from 'react';
import { toast } from 'sonner';
import { useUploadRosterTimesheet } from '../../api/rosterCoverage';
import { Card, CardContent, CardHeader, CardTitle } from '../../ui/card';
import { Button } from '../../ui/button';
import { Input } from '../../ui/input';
import { getErrorMessage } from '../../utils/api';

export function RosterTimesheetUpload() {
  const upload = useUploadRosterTimesheet();
  const [file, setFile] = useState(null);
  const [columnMapJson, setColumnMapJson] = useState('');

  const onSubmit = async (e) => {
    e.preventDefault();
    if (!file) {
      toast.error('Choose a CSV or XLSX file');
      return;
    }
    let columnMap;
    if (columnMapJson.trim()) {
      try {
        columnMap = JSON.parse(columnMapJson);
      } catch {
        toast.error('Column map must be valid JSON');
        return;
      }
    }
    try {
      const res = await upload.mutateAsync({ file, columnMap });
      toast.success(`Imported ${res.shiftsCreated} shifts (${res.rowsProcessed} rows)`);
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
            Upload <strong className="text-foreground">CSV or XLSX</strong> with headers the importer can detect:
          </p>
          <ul className="list-disc pl-5">
            <li>Staff name (or Staff)</li>
            <li>Participant name (or Client name)</li>
            <li>Shift date</li>
            <li>Start time</li>
            <li>End time</li>
            <li>Optional: Sleepover (Yes/No), Sleepover start, Shift status (Active/Completed/Cancelled)</li>
          </ul>
          <p>
            Staff and participant names must match roster records exactly. Use JSON column map below only if your
            headers differ (keys: staffName, participantName, date, start, end, sleepover, sleepoverStart, status —
            each value is an array of aliases).
          </p>
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
                accept=".csv,.xlsx"
                className="mt-1"
                onChange={(e) => setFile(e.target.files?.[0] ?? null)}
              />
            </div>
            <div>
              <label className="text-sm font-medium">Optional column map (JSON)</label>
              <textarea
                className="mt-1 flex min-h-[100px] w-full rounded-md border border-input bg-background px-3 py-2 text-sm font-mono"
                value={columnMapJson}
                onChange={(e) => setColumnMapJson(e.target.value)}
                placeholder='{"staffName":["Employee"],"participantName":["Client"]}'
              />
            </div>
            <Button type="submit" disabled={upload.isPending}>
              {upload.isPending ? 'Uploading…' : 'Upload'}
            </Button>
          </form>
        </CardContent>
      </Card>
    </div>
  );
}
