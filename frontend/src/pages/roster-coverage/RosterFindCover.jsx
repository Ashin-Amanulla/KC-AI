import { useState, useRef, useEffect, useMemo, useCallback } from 'react';
import { useSearchParams } from 'react-router-dom';
import { ChevronDown, X } from 'lucide-react';
import { toast } from 'sonner';
import {
  useFindCover,
  useRosterParticipants,
  downloadIneligibilityPdf,
  downloadIneligibilityXlsx,
  usePatchContactStatus,
} from '../../api/rosterCoverage';
import { Button } from '../../ui/button';
import { Input } from '../../ui/input';
import { Label } from '../../ui/label';
import { InfoHint } from '../../components/InfoHint';
import { CardTitleHint, FieldLabel } from '../../components/InfoHint';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '../../ui/select';
import { getErrorMessage } from '../../utils/api';
import { getRosterTimesheetWindow } from '../../utils/rosterCoveragePayPeriod';
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
          <TableHead className="text-right">Worked</TableHead>
          <TableHead className="text-right">Cap</TableHead>
          <TableHead className="text-right">Cap headroom (fn)</TableHead>
          <TableHead className="w-[140px]">Actions</TableHead>
        </TableRow>
      </TableHeader>
      <TableBody>
        {rows?.length === 0 && (
          <TableRow>
            <TableCell colSpan={6} className="text-muted-foreground">
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
              <TableCell className="text-right text-muted-foreground">
                {s?.contractedFortnightlyHours != null ? s.contractedFortnightlyHours : '—'}
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
  const [searchParams] = useSearchParams();
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
  const [linkedVacantId, setLinkedVacantId] = useState(null);
  const [result, setResult] = useState(null);
  const [participantPickerOpen, setParticipantPickerOpen] = useState(false);
  const [participantSearch, setParticipantSearch] = useState('');
  const participantPickerRef = useRef(null);
  const autoRanRef = useRef(false);

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

  const runFindCover = useCallback(async () => {
    const startDatetime = toIsoLocal(dateStr, startTime);
    const endDatetime = toIsoLocal(dateStr, endTime);
    if (!participantId || !startDatetime || !endDatetime) {
      toast.error('Choose participant, date, and times.');
      return;
    }
    try {
      const w = getRosterTimesheetWindow();
      const data = await findCover.mutateAsync({
        rosterParticipantId: participantId,
        startDatetime,
        endDatetime,
        sleepover,
        sleepoverStart: sleepover && sleepoverStart ? toIsoLocal(dateStr, sleepoverStart) : null,
        reason,
        vacantShiftId: linkedVacantId || undefined,
        persistVacant: linkedVacantId ? false : persistVacant,
        ...(w?.start && w?.end ? { timesheetFrom: w.start, timesheetTo: w.end } : {}),
      });
      setResult(data);
      const et = data.eligibleTeam?.length ?? 0;
      const it = data.ineligibleTeam?.length ?? 0;
      const op = data.openPoolEligible?.length ?? 0;
      toast.success(`Eligible team: ${et} · Ineligible team: ${it} · Open pool: ${op}`);
    } catch (err) {
      toast.error(getErrorMessage(err));
    }
  }, [
    dateStr,
    endTime,
    findCover,
    linkedVacantId,
    participantId,
    persistVacant,
    reason,
    sleepover,
    sleepoverStart,
    startTime,
  ]);

  const handleSubmit = async (e) => {
    e.preventDefault();
    await runFindCover();
  };

  useEffect(() => {
    const participant = searchParams.get('participant');
    const date = searchParams.get('date');
    const start = searchParams.get('start');
    const end = searchParams.get('end');
    const reasonParam = searchParams.get('reason');
    const vacant = searchParams.get('vacant');
    if (participant) setParticipantId(participant);
    if (date) setDateStr(date);
    if (start) setStartTime(start);
    if (end) setEndTime(end);
    if (reasonParam) setReason(reasonParam);
    if (vacant) setLinkedVacantId(vacant);
  }, [searchParams]);

  useEffect(() => {
    if (searchParams.get('auto') !== '1' || autoRanRef.current) return;
    if (!participantId || !dateStr || !startTime || !endTime) return;
    autoRanRef.current = true;
    runFindCover();
  }, [searchParams, participantId, dateStr, startTime, endTime, runFindCover]);

  const ineligibleRows =
    result?.ineligibleTeam?.map((r) => ({
      fullName: r.staff?.fullName,
      reasons: r.reasons,
    })) ?? [];

  const vacantId = linkedVacantId || result?.vacantShiftId;

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
    <div className="page-stack-dense">
      <section className="rounded-lg border bg-card p-3 space-y-2.5">
        <CardTitleHint
          titleClassName="text-2sm"
          hintLabel="About worked totals and cap"
          hint={
            <>
              Eligible tables match the Team page: Worked, Cap, and Cap headroom. If a timesheet window is set from
              Timesheet upload, worked uses the full span of that file’s shifts; otherwise the fortnight containing this
              shift’s start is used.
            </>
          }
        >
          Vacant shift
        </CardTitleHint>
        <form onSubmit={handleSubmit} className="grid gap-2.5 sm:grid-cols-2 lg:grid-cols-4">
            <div className="relative sm:col-span-2 lg:col-span-4" ref={participantPickerRef}>
              <FieldLabel htmlFor="participant-combobox-trigger">Participant</FieldLabel>
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
                  className="flex h-8 min-w-0 flex-1 items-center justify-between gap-2 rounded-md border border-input bg-background px-2.5 text-left text-2sm outline-none ring-offset-background focus-visible:ring-2 focus-visible:ring-ring"
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
                    className="flex h-8 w-8 shrink-0 items-center justify-center rounded-md border border-input bg-background text-muted-foreground hover:bg-accent hover:text-foreground"
                    aria-label="Clear participant"
                  >
                    <X className="h-4 w-4" />
                  </button>
                ) : null}
              </div>
              {participantPickerOpen && (
                <div
                  className="absolute left-0 right-0 z-50 mt-1 rounded-md border border-input bg-background shadow-popover dark:shadow-none"
                  role="listbox"
                  aria-labelledby="participant-combobox-label"
                >
                  <div className="border-b border-input p-1.5">
                    <Input
                      type="search"
                      autoComplete="off"
                      placeholder="Search by name or location…"
                      value={participantSearch}
                      onChange={(e) => setParticipantSearch(e.target.value)}
                      className="h-8 border-0 bg-transparent text-2sm shadow-none"
                      aria-label="Filter participants"
                    />
                  </div>
                  <div className="max-h-48 overflow-y-auto py-0.5">
                    {participants.length === 0 ? (
                      <div className="px-2.5 py-1.5 text-2sm text-muted-foreground">No participants</div>
                    ) : filteredParticipants.length === 0 ? (
                      <div className="px-2.5 py-1.5 text-2sm text-muted-foreground">No matches</div>
                    ) : (
                      filteredParticipants.map((p) => (
                        <button
                          key={p._id}
                          type="button"
                          role="option"
                          aria-selected={p._id === participantId}
                          className={`flex w-full flex-col items-start px-2.5 py-1.5 text-left text-2sm hover:bg-accent ${p._id === participantId ? 'bg-accent/60' : ''}`}
                          onClick={() => {
                            setParticipantId(p._id);
                            setParticipantPickerOpen(false);
                            setParticipantSearch('');
                          }}
                        >
                          <span className="font-medium">{p.name}</span>
                          {(p.locationLabel || (p.location && p.location.name)) && (
                            <span className="text-2xs text-muted-foreground">
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
            <div className="space-y-1">
              <FieldLabel htmlFor="find-cover-date">Date</FieldLabel>
              <Input id="find-cover-date" type="date" value={dateStr} onChange={(e) => setDateStr(e.target.value)} className="h-8 filter-control-date w-full" />
            </div>
            <div className="space-y-1">
              <FieldLabel htmlFor="find-cover-start">Start</FieldLabel>
              <Input id="find-cover-start" type="time" value={startTime} onChange={(e) => setStartTime(e.target.value)} className="h-8 text-2sm" />
            </div>
            <div className="space-y-1">
              <FieldLabel htmlFor="find-cover-end">End</FieldLabel>
              <Input id="find-cover-end" type="time" value={endTime} onChange={(e) => setEndTime(e.target.value)} className="h-8 text-2sm" />
            </div>
            <div className="flex items-center gap-2">
              <input
                id="so"
                type="checkbox"
                checked={sleepover}
                onChange={(e) => setSleepover(e.target.checked)}
                className="h-3.5 w-3.5"
              />
              <Label htmlFor="so" className="text-2sm font-normal">
                Sleepover
              </Label>
            </div>
            {sleepover && (
              <div className="space-y-1">
                <FieldLabel htmlFor="find-cover-sleepover">Sleepover start</FieldLabel>
                <Input
                  id="find-cover-sleepover"
                  type="time"
                  value={sleepoverStart}
                  onChange={(e) => setSleepoverStart(e.target.value)}
                  className="h-8 text-2sm"
                />
              </div>
            )}
            <div className="space-y-1">
              <FieldLabel>Reason</FieldLabel>
              <Select value={reason} onValueChange={setReason}>
                <SelectTrigger className="h-8 text-2sm">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="sick_call">Sick call</SelectItem>
                  <SelectItem value="vacancy">Vacancy</SelectItem>
                  <SelectItem value="other">Other</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="flex items-center gap-2 sm:col-span-2">
              <input
                id="pv"
                type="checkbox"
                checked={persistVacant}
                onChange={(e) => setPersistVacant(e.target.checked)}
                className="h-3.5 w-3.5"
              />
              <Label htmlFor="pv" className="text-2sm font-normal">
                Save as open vacancy
              </Label>
            </div>
            <div className="sm:col-span-2 lg:col-span-4">
              <Button type="submit" size="sm" disabled={findCover.isPending}>
                {findCover.isPending ? 'Searching…' : 'Find cover'}
              </Button>
            </div>
          </form>
      </section>

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
            <div className="muted-strip flex flex-wrap items-center gap-1.5 py-1.5">
              <span className="font-medium text-foreground">Worked totals range:</span>
              <span>
                {new Date(result.fortnight.start).toLocaleString()} —{' '}
                {new Date(result.fortnight.end).toLocaleString()} · {result.fortnight.timezone}
              </span>
              <InfoHint
                label="How worked totals are calculated"
                side="bottom"
                content={
                  <>
                    {result.payPeriodAnchor ? (
                      <p className="mb-2">
                        Midpoint reference: {new Date(result.payPeriodAnchor).toLocaleString()}
                        {result.usedTimesheetWindow || result.usedUploadedPayReference
                          ? ' (totals window = imported timesheet date span — same as Team page).'
                          : ' (from vacant shift start — clear timesheet window on Timesheet upload to use this default).'}
                      </p>
                    ) : null}
                    <p>
                      Worked sums every non-cancelled shift overlapping the range above. Cap is contracted hours per
                      fortnight. Cap headroom is cap minus worked.
                    </p>
                  </>
                }
              />
            </div>
          )}

          <section className="overflow-hidden rounded-lg border bg-card">
            <div className="border-b border-border/60 px-3 py-1.5">
              <h3 className="section-label">Eligible staff</h3>
            </div>
            <div className="overflow-x-auto">
              <EligibleStaffTable
                rows={result.eligibleTeam}
                vacantId={vacantId}
                emptyLabel="No eligible staff on this participant’s approved team."
                contactMut={contactMut}
              />
            </div>
          </section>

          <section className="rounded-lg border bg-card p-3 space-y-2">
            <h3 className="section-label">Ineligible team</h3>
            {result.ineligibleTeam?.length === 0 && (
              <p className="text-2sm text-muted-foreground">No ineligible team members.</p>
            )}
            {result.ineligibleTeam?.map((row) => (
              <div key={row.staff._id} className="rounded-md border p-2 text-2sm">
                <div className="font-medium">{row.staff.fullName}</div>
                <ul className="mt-1 list-disc pl-4 text-2xs text-muted-foreground">
                  {row.reasons.map((r) => (
                    <li key={r}>{r}</li>
                  ))}
                </ul>
              </div>
            ))}
          </section>

          <section className="overflow-hidden rounded-lg border bg-card">
            <div className="flex items-center gap-1.5 border-b border-border/60 px-3 py-1.5">
              <h3 className="section-label">Open pool</h3>
              <InfoHint
                label="About open pool staff"
                content="Not on this participant’s approved team, but available on hours, overlap, and rest rules."
              />
            </div>
            <div className="overflow-x-auto">
              <EligibleStaffTable
                rows={result.openPoolEligible}
                vacantId={vacantId}
                emptyLabel="No open-pool staff pass logistics for this shift."
                contactMut={contactMut}
              />
            </div>
          </section>
        </>
      )}
    </div>
  );
}
