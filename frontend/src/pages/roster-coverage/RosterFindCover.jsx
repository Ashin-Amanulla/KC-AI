import { useState } from 'react';
import { toast } from 'sonner';
import {
  useFindCover,
  useRosterParticipants,
  downloadIneligibilityPdf,
  downloadIneligibilityXlsx,
  usePatchContactStatus,
} from '../../api/rosterCoverage';
import { Card, CardContent, CardHeader, CardTitle } from '../../ui/card';
import { Button } from '../../ui/button';
import { Input } from '../../ui/input';
import { getErrorMessage } from '../../utils/api';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '../../ui/table';

function toIsoLocal(dateStr, timeStr) {
  if (!dateStr || !timeStr) return null;
  const d = new Date(`${dateStr}T${timeStr}`);
  return Number.isNaN(d.getTime()) ? null : d.toISOString();
}

export function RosterFindCover() {
  const { data: partData } = useRosterParticipants();
  const participants = partData?.participants ?? [];
  const findCover = useFindCover();
  const contactMut = usePatchContactStatus();

  const [participantId, setParticipantId] = useState('');
  const [dateStr, setDateStr] = useState(() => new Date().toISOString().slice(0, 10));
  const [startTime, setStartTime] = useState('07:00');
  const [endTime, setEndTime] = useState('15:00');
  const [sleepover, setSleepover] = useState(false);
  const [sleepoverStart, setSleepoverStart] = useState('');
  const [reason, setReason] = useState('vacancy');
  const [persistVacant, setPersistVacant] = useState(false);
  const [result, setResult] = useState(null);

  const handleSubmit = async (e) => {
    e.preventDefault();
    const startDatetime = toIsoLocal(dateStr, startTime);
    const endDatetime = toIsoLocal(dateStr, endTime);
    if (!participantId || !startDatetime || !endDatetime) {
      toast.error('Choose participant, date, and times.');
      return;
    }
    try {
      const data = await findCover.mutateAsync({
        rosterParticipantId: participantId,
        startDatetime,
        endDatetime,
        sleepover,
        sleepoverStart: sleepover && sleepoverStart ? toIsoLocal(dateStr, sleepoverStart) : null,
        reason,
        persistVacant,
      });
      setResult(data);
      toast.success(`Eligible: ${data.eligible?.length ?? 0} · Ineligible: ${data.ineligible?.length ?? 0}`);
    } catch (err) {
      toast.error(getErrorMessage(err));
    }
  };

  const ineligibleRows =
    result?.ineligible?.map((r) => ({
      fullName: r.staff?.fullName,
      reasons: r.reasons,
    })) ?? [];

  const vacantId = result?.vacantShiftId;

  const exportPdf = async () => {
    if (!ineligibleRows.length) {
      toast.message('No ineligible rows to export');
      return;
    }
    try {
      await downloadIneligibilityPdf(ineligibleRows, 'Ineligibility report');
    } catch (err) {
      toast.error(getErrorMessage(err));
    }
  };

  const exportXlsx = async () => {
    if (!ineligibleRows.length) {
      toast.message('No ineligible rows to export');
      return;
    }
    try {
      await downloadIneligibilityXlsx(ineligibleRows);
    } catch (err) {
      toast.error(getErrorMessage(err));
    }
  };

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Vacant shift</CardTitle>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSubmit} className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            <div className="sm:col-span-2 lg:col-span-3">
              <label className="text-sm font-medium">Participant</label>
              <select
                className="mt-1 flex h-10 w-full rounded-md border border-input bg-background px-3 text-sm"
                value={participantId}
                onChange={(e) => setParticipantId(e.target.value)}
              >
                <option value="">Select…</option>
                {participants.map((p) => (
                  <option key={p._id} value={p._id}>
                    {p.name}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label className="text-sm font-medium">Date</label>
              <Input type="date" value={dateStr} onChange={(e) => setDateStr(e.target.value)} className="mt-1" />
            </div>
            <div>
              <label className="text-sm font-medium">Start</label>
              <Input type="time" value={startTime} onChange={(e) => setStartTime(e.target.value)} className="mt-1" />
            </div>
            <div>
              <label className="text-sm font-medium">End</label>
              <Input type="time" value={endTime} onChange={(e) => setEndTime(e.target.value)} className="mt-1" />
            </div>
            <div className="flex items-center gap-2 sm:col-span-2">
              <input
                id="so"
                type="checkbox"
                checked={sleepover}
                onChange={(e) => setSleepover(e.target.checked)}
              />
              <label htmlFor="so" className="text-sm">
                Sleepover
              </label>
            </div>
            {sleepover && (
              <div>
                <label className="text-sm font-medium">Sleepover starts (local)</label>
                <Input
                  type="time"
                  value={sleepoverStart}
                  onChange={(e) => setSleepoverStart(e.target.value)}
                  className="mt-1"
                />
              </div>
            )}
            <div>
              <label className="text-sm font-medium">Reason</label>
              <select
                className="mt-1 flex h-10 w-full rounded-md border border-input bg-background px-3 text-sm"
                value={reason}
                onChange={(e) => setReason(e.target.value)}
              >
                <option value="sick_call">Sick call</option>
                <option value="vacancy">Vacancy</option>
                <option value="other">Other</option>
              </select>
            </div>
            <div className="flex items-center gap-2 sm:col-span-2">
              <input
                id="pv"
                type="checkbox"
                checked={persistVacant}
                onChange={(e) => setPersistVacant(e.target.checked)}
              />
              <label htmlFor="pv" className="text-sm">
                Save as open vacancy on dashboard
              </label>
            </div>
            <div className="sm:col-span-2 lg:col-span-3">
              <Button type="submit" disabled={findCover.isPending}>
                {findCover.isPending ? 'Searching…' : 'Find cover'}
              </Button>
            </div>
          </form>
        </CardContent>
      </Card>

      {result && (
        <>
          <div className="flex flex-wrap gap-2">
            <Button type="button" variant="outline" size="sm" onClick={exportPdf}>
              Export ineligible PDF
            </Button>
            <Button type="button" variant="outline" size="sm" onClick={exportXlsx}>
              Export ineligible Excel
            </Button>
          </div>
          {result.fortnight && (
            <p className="text-xs text-muted-foreground">
              Fortnight window (engine): {new Date(result.fortnight.start).toLocaleString()} —{' '}
              {new Date(result.fortnight.end).toLocaleString()} · {result.fortnight.timezone}
            </p>
          )}

          <Card>
            <CardHeader>
              <CardTitle className="text-base">Eligible staff</CardTitle>
            </CardHeader>
            <CardContent className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Name</TableHead>
                    <TableHead>Phone</TableHead>
                    <TableHead className="text-right">Worked (fn)</TableHead>
                    <TableHead className="text-right">Remaining</TableHead>
                    <TableHead className="w-[140px]">Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {result.eligible?.length === 0 && (
                    <TableRow>
                      <TableCell colSpan={5} className="text-muted-foreground">
                        No eligible staff.
                      </TableCell>
                    </TableRow>
                  )}
                  {result.eligible?.map((row) => {
                    const s = row.staff;
                    const tel = (s?.phone || '').replace(/\s/g, '');
                    return (
                      <TableRow key={s._id}>
                        <TableCell className="font-medium">{s.fullName}</TableCell>
                        <TableCell>{s.phone || '—'}</TableCell>
                        <TableCell className="text-right">{row.workedHoursThisFortnight?.toFixed?.(1)}</TableCell>
                        <TableCell className="text-right">{row.hoursRemaining?.toFixed?.(1)}</TableCell>
                        <TableCell>
                          <div className="flex flex-wrap gap-1">
                            {tel && (
                              <>
                                <a
                                  className="text-primary text-xs underline"
                                  href={`tel:${tel}`}
                                >
                                  Call
                                </a>
                                <a
                                  className="text-primary text-xs underline"
                                  href={`sms:${tel}`}
                                >
                                  SMS
                                </a>
                              </>
                            )}
                            {vacantId && (
                              <>
                                <button
                                  type="button"
                                  className="text-xs text-primary underline"
                                  onClick={async () => {
                                    try {
                                      await contactMut.mutateAsync({
                                        vacantId,
                                        staffId: s._id,
                                        contacted: true,
                                      });
                                      toast.success('Marked contacted');
                                    } catch (err) {
                                      toast.error(getErrorMessage(err));
                                    }
                                  }}
                                >
                                  Contacted
                                </button>
                                <button
                                  type="button"
                                  className="text-xs text-primary underline"
                                  onClick={async () => {
                                    try {
                                      await contactMut.mutateAsync({
                                        vacantId,
                                        staffId: s._id,
                                        confirmed: true,
                                      });
                                      toast.success('Marked confirmed');
                                    } catch (err) {
                                      toast.error(getErrorMessage(err));
                                    }
                                  }}
                                >
                                  Confirmed
                                </button>
                              </>
                            )}
                          </div>
                        </TableCell>
                      </TableRow>
                    );
                  })}
                </TableBody>
              </Table>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="text-base">Ineligible report</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              {result.ineligible?.map((row) => (
                <div key={row.staff._id} className="rounded-md border p-3 text-sm">
                  <div className="font-medium">{row.staff.fullName}</div>
                  <ul className="mt-2 list-disc pl-5 text-muted-foreground">
                    {row.reasons.map((r) => (
                      <li key={r}>{r}</li>
                    ))}
                  </ul>
                </div>
              ))}
            </CardContent>
          </Card>
        </>
      )}
    </div>
  );
}
