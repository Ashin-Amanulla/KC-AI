import { useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import * as XLSX from 'xlsx';
import { ArrowLeft, ArrowRightCircle } from 'lucide-react';
import { toast } from 'sonner';
import { PageHeader } from '../../components/PageHeader';
import { QueryErrorState } from '../../components/QueryErrorState';
import { LoadingSpinner } from '../../ui/LoadingSpinner';
import { Button } from '../../ui/button';
import { Badge } from '../../ui/badge';
import { Input } from '../../ui/input';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '../../ui/select';
import { Card, CardContent } from '../../ui/card';
import { usePermissions } from '../../hooks/usePermissions';
import { PERMISSIONS } from '../../config/permissions';
import { useSilEstimateWorkspace } from './hooks/useSilEstimateWorkspace';
import { useSilEstimateCalc } from './hooks/useSilEstimateCalc';
import { ParticipantPlanTable } from './components/ParticipantPlanTable';
import { BudgetSummaryBar } from './components/BudgetSummaryBar';
import { DayTypeSummaryCards } from './components/DayTypeSummaryCards';
import { CategoryBreakdownTable } from './components/CategoryBreakdownTable';
import { HolidaysPanel } from './components/HolidaysPanel';
import { RosterTemplatesPanel } from './components/RosterTemplatesPanel';
import { PlanSegmentsPanel } from './components/PlanSegmentsPanel';
import { RateCardPanel } from './components/RateCardPanel';
import { WeeklyRosterGrid } from './components/WeeklyRosterGrid';
import {
  nextBlockId,
  nextTemplateId,
  nextSegId,
  cloneBlocks,
  buildDefaultSchedule,
  createDefaultParticipant,
} from '../../lib/silEstimate/defaults';
import { computeHoursFromTime } from '../../lib/silEstimate/calculations';
import {
  sheetToObjects,
  parseCSV,
  buildScheduleFromRows,
  parsePlanDatesRows,
  getField,
} from '../../lib/silEstimate/importParsers';
import { WEEKDAY_ONLY } from '../../lib/silEstimate/constants';

function saveStatusLabel(status) {
  if (status === 'saving') return 'Saving…';
  if (status === 'unsaved') return 'Unsaved changes';
  if (status === 'error') return 'Save failed';
  return 'Saved';
}

export function SilEstimateEditor() {
  const { id } = useParams();
  const { hasPermission } = usePermissions();
  const canManage = hasPermission(PERMISSIONS.ESTIMATES_MANAGE);
  const { workspace, setWorkspace, activeParticipant, isLoading, error, refetch, saveStatus } =
    useSilEstimateWorkspace(id, { canManage });
  const calc = useSilEstimateCalc(workspace, activeParticipant);
  const [newParticipantInput, setNewParticipantInput] = useState('');

  if (isLoading || !workspace) return <LoadingSpinner />;
  if (error) return <QueryErrorState error={error} onRetry={refetch} />;

  const participants = workspace.participants || [];
  const activeName = workspace.activeParticipantName || participants[0]?.name;
  const active = activeParticipant;
  const activeTemplateId = active?.activeTemplateId;
  const activeTemplate = workspace.templates?.[activeTemplateId];
  const segments = active?.segments || [];

  const persistActiveParticipant = (patch) => {
    setWorkspace((prev) => ({
      ...prev,
      participants: prev.participants.map((p) =>
        p.name === activeName ? { ...p, ...patch } : p
      ),
    }));
  };

  const switchParticipant = (newName) => {
    if (!newName || newName === activeName) return;
    setWorkspace((prev) => {
      const current = prev.participants.find((p) => p.name === activeName);
      const updated = prev.participants.map((p) => (p.name === activeName ? { ...p, ...current } : p));
      const meta = updated.find((p) => p.name === newName);
      return {
        ...prev,
        participants: updated,
        activeParticipantName: newName,
      };
    });
  };

  const addParticipant = (rawName) => {
    const name = (rawName || '').trim();
    if (!name) return;
    if (participants.some((p) => p.name === name)) {
      switchParticipant(name);
      return;
    }
    const { participant, template } = createDefaultParticipant(name);
    setWorkspace((prev) => ({
      ...prev,
      templates: { ...prev.templates, [template.id]: template },
      participants: [...prev.participants, participant],
      activeParticipantName: name,
    }));
    toast.success(`Added "${name}"`);
  };

  const updateParticipantDates = (name, field, iso) => {
    const syncSegments = (segs) => {
      if (segs?.length === 1 && segs[0].label === 'Whole plan period') {
        return [
          {
            ...segs[0],
            start: field === 'start' ? iso : segs[0].start,
            end: field === 'end' ? iso : segs[0].end,
          },
        ];
      }
      return segs;
    };
    setWorkspace((prev) => ({
      ...prev,
      participants: prev.participants.map((p) => {
        if (p.name !== name) return p;
        return {
          ...p,
          planStart: field === 'start' ? iso : p.planStart,
          planEnd: field === 'end' ? iso : p.planEnd,
          segments: syncSegments(p.segments),
        };
      }),
    }));
  };

  const updateParticipantBudget = (name, value) => {
    const num = Number(value) || 0;
    setWorkspace((prev) => ({
      ...prev,
      participants: prev.participants.map((p) => (p.name === name ? { ...p, budget: num } : p)),
    }));
  };

  const updateActiveSchedule = (mutator) => {
    if (!activeTemplateId) return;
    setWorkspace((prev) => {
      const t = prev.templates[activeTemplateId];
      if (!t) return prev;
      return {
        ...prev,
        templates: {
          ...prev.templates,
          [activeTemplateId]: { ...t, schedule: mutator(t.schedule) },
        },
      };
    });
  };

  const updateBlock = (day, blockId, patch) => {
    updateActiveSchedule((sched) => ({
      ...sched,
      [day]: sched[day].map((b) => (b.id === blockId ? { ...b, ...patch } : b)),
    }));
  };

  const updateBlockTime = (day, blockId, field, value) => {
    updateActiveSchedule((sched) => ({
      ...sched,
      [day]: sched[day].map((b) => {
        if (b.id !== blockId) return b;
        const next = { ...b, [field]: value };
        return { ...next, hours: computeHoursFromTime(next.startTime, next.endTime) };
      }),
    }));
  };

  const setBlockMode = (day, blockId, mode) => {
    updateActiveSchedule((sched) => ({
      ...sched,
      [day]: sched[day].map((b) => {
        if (b.id !== blockId) return b;
        if (mode === 'time') return { ...b, mode, hours: computeHoursFromTime(b.startTime, b.endTime) };
        return { ...b, mode };
      }),
    }));
  };

  const addBlock = (day) => {
    updateActiveSchedule((sched) => ({
      ...sched,
      [day]: [
        ...sched[day],
        {
          id: nextBlockId(),
          label: 'New block',
          period: 'AM',
          intensity: 'Standard',
          hours: 0,
          mode: 'hours',
          startTime: '09:00',
          endTime: '17:00',
          ratio: '1:1',
          customW: 1,
          customP: 1,
        },
      ],
    }));
  };

  const removeBlock = (day, blockId) => {
    updateActiveSchedule((sched) => ({
      ...sched,
      [day]: sched[day].filter((b) => b.id !== blockId),
    }));
  };

  const copyDayTo = (sourceDay, targetDay) => {
    updateActiveSchedule((sched) => ({
      ...sched,
      [targetDay]: cloneBlocks(sched[sourceDay]),
    }));
  };

  const applyMondayToWeekdays = () => {
    updateActiveSchedule((sched) => {
      const next = { ...sched };
      WEEKDAY_ONLY.slice(1).forEach((d) => {
        next[d] = cloneBlocks(sched.Mon);
      });
      return next;
    });
  };

  const addTemplate = () => {
    const tid = nextTemplateId();
    setWorkspace((prev) => ({
      ...prev,
      templates: {
        ...prev.templates,
        [tid]: { id: tid, name: `Roster ${Object.keys(prev.templates).length + 1}`, schedule: buildDefaultSchedule() },
      },
    }));
    persistActiveParticipant({ activeTemplateId: tid });
  };

  const duplicateTemplate = (tid) => {
    const newId = nextTemplateId();
    setWorkspace((prev) => {
      const src = prev.templates[tid];
      const clonedSchedule = {};
      Object.keys(src.schedule).forEach((d) => {
        clonedSchedule[d] = cloneBlocks(src.schedule[d]);
      });
      return {
        ...prev,
        templates: {
          ...prev.templates,
          [newId]: { id: newId, name: `${src.name} (copy)`, schedule: clonedSchedule },
        },
      };
    });
    persistActiveParticipant({ activeTemplateId: newId });
  };

  const renameTemplate = (tid, name) => {
    setWorkspace((prev) => ({
      ...prev,
      templates: { ...prev.templates, [tid]: { ...prev.templates[tid], name } },
    }));
  };

  const deleteTemplate = (tid) => {
    const ids = Object.keys(workspace.templates);
    if (ids.length <= 1) return;
    const fallbackId = ids.find((k) => k !== tid);
    setWorkspace((prev) => {
      const { [tid]: _removed, ...rest } = prev.templates;
      return {
        ...prev,
        templates: rest,
        participants: prev.participants.map((p) => ({
          ...p,
          activeTemplateId: p.activeTemplateId === tid ? fallbackId : p.activeTemplateId,
          segments: p.segments.map((s) =>
            s.templateId === tid ? { ...s, templateId: fallbackId } : s
          ),
        })),
      };
    });
  };

  const addSegment = () => {
    const lastEnd = segments.length ? segments[segments.length - 1].end : active.planStart;
    const d = new Date(lastEnd + 'T00:00:00Z');
    d.setUTCDate(d.getUTCDate() + 1);
    const nextStart = d.toISOString().slice(0, 10);
    persistActiveParticipant({
      segments: [
        ...segments,
        {
          id: nextSegId(),
          label: `Segment ${segments.length + 1}`,
          start: nextStart > active.planEnd ? active.planStart : nextStart,
          end: active.planEnd,
          templateId: activeTemplateId,
        },
      ],
    });
  };

  const updateSegment = (segId, patch) => {
    persistActiveParticipant({
      segments: segments.map((s) => (s.id === segId ? { ...s, ...patch } : s)),
    });
  };

  const removeSegment = (segId) => {
    if (segments.length <= 1) return;
    persistActiveParticipant({ segments: segments.filter((s) => s.id !== segId) });
  };

  const updateRate = (which, dayType, period, intensity, value) => {
    const key = which === 'old' ? 'ratesOld' : 'ratesNew';
    setWorkspace((prev) => ({
      ...prev,
      oldRatesConfirmed: which === 'old' ? true : prev.oldRatesConfirmed,
      [key]: {
        ...prev[key],
        [dayType]: {
          ...prev[key][dayType],
          [period]: {
            ...prev[key][dayType][period],
            [intensity]: Number(value),
          },
        },
      },
    }));
  };

  const handleFileUpload = (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const isExcel = /\.xlsx?$/i.test(file.name);
    const reader = new FileReader();
    reader.onload = (evt) => {
      try {
        let rows;
        if (isExcel) {
          const wb = XLSX.read(evt.target.result, { type: 'array' });
          const sheet = wb.Sheets[wb.SheetNames[0]];
          rows = sheetToObjects(sheet, { raw: false, XLSX });
        } else {
          rows = parseCSV(String(evt.target.result));
        }
        const uniqueNames = new Set(
          rows
            .map((r) => String(getField(r, ['Client Name', 'Participant Name', 'Participant', 'Name']) || '').trim())
            .filter(Boolean)
        );
        if (uniqueNames.size > 1) {
          bulkImportParticipants(rows, file.name);
        } else {
          importScheduleFromRows(rows, file.name);
        }
      } catch {
        toast.error("Couldn't read that file — check format.");
      }
    };
    reader.onerror = () => toast.error("Couldn't read that file.");
    if (isExcel) reader.readAsArrayBuffer(file);
    else reader.readAsText(file);
    e.target.value = '';
  };

  const importScheduleFromRows = (rows, fileName) => {
    const { schedule, count } = buildScheduleFromRows(rows, nextBlockId);
    if (count === 0) {
      toast.error("Couldn't find usable shift rows.");
      return;
    }
    const nameFromRows = String(getField(rows[0], ['Client Name', 'Participant Name', 'Participant', 'Name']) || '').trim();
    const newId = nextTemplateId();
    const label = nameFromRows || fileName.replace(/\.[^.]+$/, '') || `Imported ${Object.keys(workspace.templates).length + 1}`;
    setWorkspace((prev) => {
      const next = {
        ...prev,
        templates: { ...prev.templates, [newId]: { id: newId, name: label, schedule } },
      };
      if (nameFromRows) {
        const existing = prev.participants.find((p) => p.name === nameFromRows);
        if (existing) {
          next.participants = prev.participants.map((p) =>
            p.name === nameFromRows ? { ...p, activeTemplateId: newId } : p
          );
          next.activeParticipantName = nameFromRows;
        } else {
          const segId = nextSegId();
          next.participants = [
            ...prev.participants,
            {
              name: nameFromRows,
              budget: 0,
              planStart: active.planStart,
              planEnd: active.planEnd,
              activeTemplateId: newId,
              segments: [
                {
                  id: segId,
                  label: 'Whole plan period',
                  start: active.planStart,
                  end: active.planEnd,
                  templateId: newId,
                },
              ],
            },
          ];
          next.activeParticipantName = nameFromRows;
        }
      } else {
        next.participants = prev.participants.map((p) =>
          p.name === activeName ? { ...p, activeTemplateId: newId } : p
        );
      }
      return next;
    });
    toast.success(`Imported ${count} shift${count === 1 ? '' : 's'} into "${label}".`);
  };

  const bulkImportParticipants = (rows, fileName) => {
    const groups = {};
    rows.forEach((r) => {
      const name = String(getField(r, ['Client Name', 'Participant Name', 'Participant', 'Name']) || '').trim();
      if (!name) return;
      if (!groups[name]) groups[name] = [];
      groups[name].push(r);
    });
    const names = Object.keys(groups);
    if (names.length === 0) {
      toast.error('No usable rows found.');
      return;
    }
    const newTemplates = {};
    const newParticipants = [];
    let importedShifts = 0;
    let firstTemplateId = null;
    let firstName = names[0];

    names.forEach((name) => {
      const { schedule, count } = buildScheduleFromRows(groups[name], nextBlockId);
      importedShifts += count;
      const tid = nextTemplateId();
      if (!firstTemplateId) firstTemplateId = tid;
      newTemplates[tid] = { id: tid, name, schedule };
      const segId = nextSegId();
      newParticipants.push({
        name,
        budget: 0,
        planStart: active.planStart,
        planEnd: active.planEnd,
        activeTemplateId: tid,
        segments: [
          {
            id: segId,
            label: 'Whole plan period',
            start: active.planStart,
            end: active.planEnd,
            templateId: tid,
          },
        ],
      });
    });

    setWorkspace((prev) => ({
      ...prev,
      templates: { ...prev.templates, ...newTemplates },
      participants: [...prev.participants, ...newParticipants.filter((np) => !prev.participants.some((p) => p.name === np.name))],
      activeParticipantName: firstName,
    }));
    toast.success(`Imported ${names.length} participants (${importedShifts} shifts) from "${fileName}".`);
  };

  const handlePlanDatesUpload = (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (evt) => {
      try {
        const wb = XLSX.read(evt.target.result, { type: 'array', cellDates: true });
        const sheet = wb.Sheets[wb.SheetNames[0]];
        const rows = sheetToObjects(sheet, { raw: true, XLSX });
        const { matched, unmatched, updates } = parsePlanDatesRows(
          rows,
          participants.map((p) => p.name)
        );
        if (matched === 0) {
          toast.error(`No names in "${file.name}" matched loaded participants.`);
          return;
        }
        updates.forEach(({ name, start, end }) => {
          if (start) updateParticipantDates(name, 'start', start);
          if (end) updateParticipantDates(name, 'end', end);
        });
        const extra =
          unmatched.length > 0
            ? ` ${unmatched.length} unmatched: ${unmatched.slice(0, 6).join(', ')}${unmatched.length > 6 ? '…' : ''}`
            : '';
        toast.success(`Matched plan dates for ${matched} participant${matched === 1 ? '' : 's'}.${extra}`);
      } catch {
        toast.error("Couldn't read plan dates file.");
      }
    };
    reader.readAsArrayBuffer(file);
    e.target.value = '';
  };

  return (
    <div className="page-stack-tight">
      <div className="flex flex-wrap items-center gap-3">
        <Button variant="ghost" size="sm" asChild>
          <Link to="/sil-estimates">
            <ArrowLeft className="size-4" />
            All estimates
          </Link>
        </Button>
        <Badge variant={saveStatus === 'saved' ? 'secondary' : 'outline'}>{saveStatusLabel(saveStatus)}</Badge>
      </div>

      <PageHeader
        title="SIL Cost Calculator"
        description="Set plan dates, budget and public holidays to calculate exact SIL costs for the plan period."
      >
        <Input
          value={workspace.name}
          onChange={(e) => setWorkspace((prev) => ({ ...prev, name: e.target.value }))}
          className="h-9 w-48 font-medium"
          disabled={!canManage}
        />
      </PageHeader>

      <div className="flex flex-wrap items-center gap-2">
        <span className="text-sm text-muted-foreground">Participant:</span>
        {participants.length > 1 ? (
          <Select value={activeName} onValueChange={switchParticipant}>
            <SelectTrigger className="h-8 w-56">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {participants.map((p) => (
                <SelectItem key={p.name} value={p.name}>
                  {p.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        ) : (
          <Input
            value={activeName}
            onChange={(e) => {
              const newName = e.target.value;
              setWorkspace((prev) => ({
                ...prev,
                activeParticipantName: newName,
                participants: prev.participants.map((p, i) =>
                  i === 0 ? { ...p, name: newName } : p
                ),
              }));
            }}
            className="h-8 w-56 font-semibold"
            disabled={!canManage}
          />
        )}
      </div>

      <ParticipantPlanTable
        participants={participants}
        activeName={activeName}
        newParticipantInput={newParticipantInput}
        onNewParticipantInputChange={setNewParticipantInput}
        onAddParticipant={addParticipant}
        onSwitchParticipant={switchParticipant}
        onUpdateDates={updateParticipantDates}
        onUpdateBudget={updateParticipantBudget}
        onPlanDatesUpload={handlePlanDatesUpload}
        canManage={canManage}
      />

      <BudgetSummaryBar
        calc={calc}
        budget={active?.budget ?? 0}
        planStart={active?.planStart}
        onBudgetChange={(v) => updateParticipantBudget(activeName, v)}
        canManage={canManage}
      />

      <DayTypeSummaryCards
        calc={calc}
        planStart={active?.planStart}
        planEnd={active?.planEnd}
        onPlanStartChange={(iso) => updateParticipantDates(activeName, 'start', iso)}
        onPlanEndChange={(iso) => updateParticipantDates(activeName, 'end', iso)}
        canManage={canManage}
      />

      <CategoryBreakdownTable calc={calc} />

      <HolidaysPanel
        state={workspace.state}
        holidays={workspace.holidays}
        planStart={active?.planStart}
        planEnd={active?.planEnd}
        dateError={calc.dateError}
        onStateChange={(s) => setWorkspace((prev) => ({ ...prev, state: s }))}
        onHolidaysChange={(h) => setWorkspace((prev) => ({ ...prev, holidays: h }))}
        canManage={canManage}
      />

      <RosterTemplatesPanel
        templates={workspace.templates}
        activeTemplateId={activeTemplateId}
        onSetActive={(tid) => persistActiveParticipant({ activeTemplateId: tid })}
        onRename={renameTemplate}
        onAdd={addTemplate}
        onDuplicate={duplicateTemplate}
        onDelete={deleteTemplate}
        onFileUpload={handleFileUpload}
        canManage={canManage}
      />

      <PlanSegmentsPanel
        segments={segments}
        templates={workspace.templates}
        calc={calc}
        onAdd={addSegment}
        onUpdate={updateSegment}
        onRemove={removeSegment}
        canManage={canManage}
      />

      {canManage && (
        <div className="flex justify-end">
          <Button size="sm" onClick={applyMondayToWeekdays}>
            <ArrowRightCircle className="size-4" />
            Apply Monday to Tue–Fri
          </Button>
        </div>
      )}

      <RateCardPanel
        ratesNew={workspace.ratesNew}
        ratesOld={workspace.ratesOld}
        oldRatesConfirmed={workspace.oldRatesConfirmed}
        onUpdateRate={updateRate}
        canManage={canManage}
      />

      <WeeklyRosterGrid
        schedule={activeTemplate?.schedule}
        perDayTypical={calc.perDayTypical}
        templateName={activeTemplate?.name}
        onUpdate={updateBlock}
        onUpdateTime={updateBlockTime}
        onSetMode={setBlockMode}
        onAdd={addBlock}
        onRemove={removeBlock}
        onCopyTo={copyDayTo}
        canManage={canManage}
      />

      <Card>
        <CardContent className="py-4 text-2xs leading-relaxed text-muted-foreground">
          Default rates are drawn from the NDIS Pricing Schedule 2026-27. This tool shows funding feasibility only —
          any roster produced must still be checked against the participant&apos;s assessed support needs before
          finalising a Schedule of Support.
        </CardContent>
      </Card>
    </div>
  );
}
