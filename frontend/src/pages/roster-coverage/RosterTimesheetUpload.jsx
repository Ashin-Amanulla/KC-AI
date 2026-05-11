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

  const onSubmit = async (e) => {
    e.preventDefault();
    if (!file) {
      toast.error('Choose a CSV file');
      return;
    }
    try {
      const res = await upload.mutateAsync({ file });
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
          </form>
        </CardContent>
      </Card>
    </div>
  );
}
