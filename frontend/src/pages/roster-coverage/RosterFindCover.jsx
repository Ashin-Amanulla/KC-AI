import { useState, useRef, useEffect, useMemo } from 'react';
import { ChevronDown, X } from 'lucide-react';
import { toast } from 'sonner';
import {
  useFindCover,
  useRosterParticipants,
  downloadIneligibilityPdf,
  downloadIneligibilityXlsx,
  usePatchContactStatus,
} from '../../api/rosterCoverage';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '../../ui/card';
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

function participantSearchHaystack(p) {
  const locName = p.location && typeof p.location === 'object' ? p.location.name : '';
  return [p.name, p.locationLabel, locName].filter(Boolean).join(' ').toLowerCase();
}

function EligibleStaffTable({ rows, vacantId, emptyLabel, contactMut }) {
  return (
    <Table>
      <TableHeader>
        <TableRow>
          <TableHead>Name</TableHead>
          <TableHead>Phone</TableHead>
          <TableHead className="text-right">Worked (fn)</TableHead>
          <TableHead className="text-right">Hours left (fn)</TableHead>
          <TableHead className="w-[140px]">Actions</TableHead>
        </TableRow>
      </TableHeader>
      <TableBody>
        {rows?.length === 0 && (
          <TableRow>
            <TableCell colSpan={5} className="text-muted-foreground">
              {emptyLabel}
            </TableCell>
          </TableRow>
        )}
        {rows?.map((row) => {
          const s = row.staff;
          const tel = (s?.phone || '').replace(/\s/g, '');
          return (
            <TableRow key={s._id}>
              <TableCell className="font-medium">{s.fullName}</TableCell>
              <TableCell>{s.phone || '—'}</TableCell>
              <TableCell className="text-right text-muted-foreground">
                {row.workedHoursThisFortnight != null ? row.workedHoursThisFortnight.toFixed(1) : '—'}
              </TableCell>
              <TableCell className="text-right">{row.hoursRemaining?.toFixed?.(1)}</TableCell>
              <TableCell>
                <div className="flex flex-wrap gap-1">
                  {tel && (
                    <>
                      <a className="text-primary text-xs underline" href={`tel:${tel}`}>
                        Call
                      </a>
                      <a className="text-primary text-xs underline" href={`sms:${tel}`}>
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
  );
}

export function RosterFindCover() {
  const { data: partData } = useRosterParticipants();
  const participants = useMemo(() => partData?.participants ?? [], [partData]);
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
  const [participantPickerOpen, setParticipantPickerOpen] = useState(false);
  const [participantSearch, setParticipantSearch] = useState('');
  const participantPickerRef = useRef(null);

  const filteredParticipants = useMemo(() => {
    const q = participantSearch.trim().toLowerCase();
    if (!q) return participants;
    return participants.filter((p) => participantSearchHaystack(p).includes(q));
  }, [participants, participantSearch]);

  const selectedParticipant = useMemo(
    () => participants.find((p) => p._id === participantId),
    [participants, participantId]
  );

  useEffect(() => {
    if (!participantPickerOpen) return;
    function handlePointerDown(e) {
      if (participantPickerRef.current && !participantPickerRef.current.contains(e.target)) {
        setParticipantPickerOpen(false);
      }
    }
    document.addEventListener('mousedown', handlePointerDown);
    document.addEventListener('touchstart', handlePointerDown);
    return () => {
      document.removeEventListener('mousedown', handlePointerDown);
      document.removeEventListener('touchstart', handlePointerDown);
    };
  }, [participantPickerOpen]);

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
      const et = data.eligibleTeam?.length ?? 0;
      const it = data.ineligibleTeam?.length ?? 0;
      const op = data.openPoolEligible?.length ?? 0;
      toast.success(`Eligible team: ${et} · Ineligible team: ${it} · Open pool: ${op}`);
    } catch (err) {
      toast.error(getErrorMessage(err));
    }
  };

  const ineligibleRows =
    result?.ineligibleTeam?.map((r) => ({
      fullName: r.staff?.fullName,
      reasons: r.reasons,
    })) ?? [];

  const vacantId = result?.vacantShiftId;

  const exportPdf = async () => {
    if (!ineligibleRows.length) {
      toast.message('No ineligible team rows to export');
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
      toast.message('No ineligible team rows to export');
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
            <div className="relative sm:col-span-2 lg:col-span-3" ref={participantPickerRef}>
              <label className="text-sm font-medium" id="participant-combobox-label">
                Participant
              </label>
              <div className="mt-1 flex gap-1">
                <button
                  type="button"
                  id="participant-combobox-trigger"
                  aria-labelledby="participant-combobox-label participant-combobox-trigger"
                  aria-expanded={participantPickerOpen}
                  aria-haspopup="listbox"
                  onClick={() => {
                    setParticipantPickerOpen((o) => !o);
                    if (!participantPickerOpen) setParticipantSearch('');
                  }}
                  className="flex h-10 min-w-0 flex-1 items-center justify-between gap-2 rounded-md border border-input bg-background px-3 text-left text-sm outline-none ring-offset-background focus-visible:ring-2 focus-visible:ring-ring"
                >
                  <span className={selectedParticipant ? 'truncate text-foreground' : 'text-muted-foreground'}>
                    {selectedParticipant
                      ? [selectedParticipant.name, selectedParticipant.locationLabel].filter(Boolean).join(' · ') ||
                        selectedParticipant.name
                      : 'Select participant…'}
                  </span>
                  <ChevronDown
                    className={`h-4 w-4 shrink-0 text-muted-foreground transition-transform ${participantPickerOpen ? 'rotate-180' : ''}`}
                    aria-hidden
                  />
                </button>
                {participantId ? (
                  <button
                    type="button"
                    onClick={() => {
                      setParticipantId('');
                      setParticipantSearch('');
                      setParticipantPickerOpen(false);
                    }}
                    className="flex h-10 w-10 shrink-0 items-center justify-center rounded-md border border-input bg-background text-muted-foreground hover:bg-accent hover:text-foreground"
                    aria-label="Clear participant"
                  >
                    <X className="h-4 w-4" />
                  </button>
                ) : null}
              </div>
              {participantPickerOpen && (
                <div
                  className="absolute left-0 right-0 z-50 mt-1 rounded-md border border-input bg-background shadow-md"
                  role="listbox"
                  aria-labelledby="participant-combobox-label"
                >
                  <div className="border-b border-input p-2">
                    <Input
                      type="search"
                      autoComplete="off"
                      placeholder="Search by name or location…"
                      value={participantSearch}
                      onChange={(e) => setParticipantSearch(e.target.value)}
                      className="h-9"
                      aria-label="Filter participants"
                    />
                  </div>
                  <div className="max-h-60 overflow-y-auto py-1">
                    {participants.length === 0 ? (
                      <div className="px-3 py-2 text-sm text-muted-foreground">No participants</div>
                    ) : filteredParticipants.length === 0 ? (
                      <div className="px-3 py-2 text-sm text-muted-foreground">No matches</div>
                    ) : (
                      filteredParticipants.map((p) => (
                        <button
                          key={p._id}
                          type="button"
                          role="option"
                          aria-selected={p._id === participantId}
                          className={`flex w-full flex-col items-start px-3 py-2 text-left text-sm hover:bg-accent ${p._id === participantId ? 'bg-accent/60' : ''}`}
                          onClick={() => {
                            setParticipantId(p._id);
                            setParticipantPickerOpen(false);
                            setParticipantSearch('');
                          }}
                        >
                          <span className="font-medium">{p.name}</span>
                          {(p.locationLabel || (p.location && p.location.name)) && (
                            <span className="text-xs text-muted-foreground">
                              {[p.locationLabel, p.location && p.location.name].filter(Boolean).join(' · ')}
                            </span>
                          )}
                        </button>
                      ))
                    )}
                  </div>
                </div>
              )}
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
              Export ineligible team PDF
            </Button>
            <Button type="button" variant="outline" size="sm" onClick={exportXlsx}>
              Export ineligible team Excel
            </Button>
          </div>
          {result.fortnight && (
            <p className="text-xs text-muted-foreground">
              Fortnight window (engine): {new Date(result.fortnight.start).toLocaleString()} —{' '}
              {new Date(result.fortnight.end).toLocaleString()} · {result.fortnight.timezone}
              <span className="mt-1 block">
                <strong className="font-medium text-foreground">Worked (fn)</strong> sums{' '}
                <em>every</em> non-cancelled shift we have for that worker (roster timesheet imports and
                workforce imports), but only the portion of each shift that falls inside this pay
                fortnight. If your CSV spans two fortnights, each row still counts—all of its hours
                go into whichever fortnight(s) the shift times overlap. Rows entirely outside this
                window count toward a different fortnight’s cap, not this search.
              </span>
            </p>
          )}

          <Card>
            <CardHeader>
              <CardTitle className="text-base">Eligible staff</CardTitle>
            </CardHeader>
            <CardContent className="overflow-x-auto">
              <EligibleStaffTable
                rows={result.eligibleTeam}
                vacantId={vacantId}
                emptyLabel="No eligible staff on this participant’s approved team."
                contactMut={contactMut}
              />
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="text-base">Ineligible team members</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              {result.ineligibleTeam?.length === 0 && (
                <p className="text-sm text-muted-foreground">No ineligible team members.</p>
              )}
              {result.ineligibleTeam?.map((row) => (
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

          <Card>
            <CardHeader>
              <CardTitle className="text-base">Open pool staff</CardTitle>
              <CardDescription>
                Not on this participant’s approved team, but available on hours, overlap, and rest rules.
              </CardDescription>
            </CardHeader>
            <CardContent className="overflow-x-auto">
              <EligibleStaffTable
                rows={result.openPoolEligible}
                vacantId={vacantId}
                emptyLabel="No open-pool staff pass logistics for this shift."
                contactMut={contactMut}
              />
            </CardContent>
          </Card>
        </>
      )}
    </div>
  );
}
