import { Plus, Trash2, CheckCircle2, AlertTriangle } from 'lucide-react';
import { Button } from '../../../ui/button';
import { Card, CardContent } from '../../../ui/card';
import {
  PERIODS,
  INTENSITIES,
  RATIO_PRESETS,
  WEEK_DAYS,
  DAY_META,
} from '../../../lib/silEstimate/constants';
import { fmtMoney, fmtMult } from '../../../lib/silEstimate/formatters';
import { cn } from '../../../lib/utils';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '../../../ui/select';

function ShiftBlockRow({ day, block, blockCost, onUpdate, onUpdateTime, onSetMode, onRemove, canManage }) {
  return (
    <div className="rounded-lg border border-border/50 bg-muted/20 p-2">
      <div className="flex items-start gap-1">
        <input
          value={block.label}
          onChange={(e) => onUpdate(day, block.id, { label: e.target.value })}
          className="min-w-0 flex-1 border-b border-transparent bg-transparent text-2xs font-medium outline-none focus:border-primary"
          disabled={!canManage}
        />
        {canManage && (
          <button type="button" onClick={() => onRemove(day, block.id)} className="text-muted-foreground hover:text-destructive">
            <Trash2 className="size-3" />
          </button>
        )}
      </div>
      <div className="mt-1.5 grid grid-cols-2 gap-1">
        <Select
          value={block.period}
          onValueChange={(v) => onUpdate(day, block.id, { period: v })}
          disabled={!canManage}
        >
          <SelectTrigger className="h-7 text-2xs">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {PERIODS.map((p) => (
              <SelectItem key={p} value={p}>
                {p}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        <Select
          value={block.intensity}
          onValueChange={(v) => onUpdate(day, block.id, { intensity: v })}
          disabled={!canManage}
        >
          <SelectTrigger className="h-7 text-2xs">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {INTENSITIES.map((i) => (
              <SelectItem key={i} value={i}>
                {i === 'High Intensity' ? 'High Int.' : i}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        <div>
          <div className="mb-0.5 flex gap-0.5">
            <button
              type="button"
              onClick={() => onSetMode(day, block.id, 'hours')}
              className={cn(
                'rounded px-1 text-2xs',
                (block.mode || 'hours') === 'hours' ? 'bg-foreground text-background' : 'border text-muted-foreground'
              )}
              disabled={!canManage}
            >
              Hrs
            </button>
            <button
              type="button"
              onClick={() => onSetMode(day, block.id, 'time')}
              className={cn(
                'rounded px-1 text-2xs',
                block.mode === 'time' ? 'bg-foreground text-background' : 'border text-muted-foreground'
              )}
              disabled={!canManage}
            >
              Time
            </button>
          </div>
          {block.mode === 'time' ? (
            <div className="flex items-center gap-0.5">
              <input
                type="time"
                value={block.startTime || '00:00'}
                onChange={(e) => onUpdateTime(day, block.id, 'startTime', e.target.value)}
                className="w-16 border-b border-border bg-transparent text-2xs outline-none"
                disabled={!canManage}
              />
              <span className="text-2xs text-muted-foreground">–</span>
              <input
                type="time"
                value={block.endTime || '00:00'}
                onChange={(e) => onUpdateTime(day, block.id, 'endTime', e.target.value)}
                className="w-16 border-b border-border bg-transparent text-2xs outline-none"
                disabled={!canManage}
              />
            </div>
          ) : (
            <input
              type="number"
              step="0.5"
              min="0"
              value={block.hours}
              onChange={(e) => onUpdate(day, block.id, { hours: Number(e.target.value) })}
              className="w-full border-b border-border bg-transparent text-2xs outline-none"
              disabled={!canManage}
            />
          )}
          {block.mode === 'time' && (
            <div className="mt-0.5 text-2xs text-muted-foreground">{block.hours.toFixed(2)} hrs</div>
          )}
        </div>
        <Select
          value={block.ratio}
          onValueChange={(v) => onUpdate(day, block.id, { ratio: v })}
          disabled={!canManage}
        >
          <SelectTrigger className="h-7 text-2xs">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {RATIO_PRESETS.map((r) => (
              <SelectItem key={r.key} value={r.key}>
                {r.label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>
      {block.ratio === 'custom' && (
        <div className="mt-1 flex items-center gap-1">
          <input
            type="number"
            value={block.customW}
            onChange={(e) => onUpdate(day, block.id, { customW: e.target.value })}
            className="w-8 border-b border-border text-2xs outline-none"
            disabled={!canManage}
          />
          <span className="text-2xs text-muted-foreground">:</span>
          <input
            type="number"
            value={block.customP}
            onChange={(e) => onUpdate(day, block.id, { customP: e.target.value })}
            className="w-8 border-b border-border text-2xs outline-none"
            disabled={!canManage}
          />
        </div>
      )}
      <div className="mt-1 text-right text-2xs text-muted-foreground">
        {blockCost?.isFlat ? 'flat' : `$${blockCost?.rate?.toFixed(0)}/hr`} · ×{fmtMult(blockCost?.mult ?? 0)} ={' '}
        <span className="font-bold text-foreground">{fmtMoney(blockCost?.cost ?? 0)}</span>
      </div>
    </div>
  );
}

function DayCard({
  day,
  blocks,
  dayData,
  onUpdate,
  onUpdateTime,
  onSetMode,
  onAdd,
  onRemove,
  onCopyTo,
  canManage,
}) {
  const meta = DAY_META[day];
  const hoursOk = Math.abs((dayData?.hoursSum ?? 0) - 24) < 0.001;

  return (
    <Card className="flex flex-col overflow-hidden">
      <div className="flex items-center justify-between px-3 py-2" style={{ backgroundColor: meta.light }}>
        <div className="text-sm font-bold" style={{ color: meta.color }}>
          {day}
        </div>
        <div className="text-sm font-bold" style={{ color: meta.color }}>
          {fmtMoney(dayData?.cost ?? 0)}
        </div>
      </div>
      <CardContent className="flex flex-1 flex-col space-y-2 p-2.5">
        {(blocks || []).map((b) => {
          const bc = dayData?.details?.find((x) => x.id === b.id);
          return (
            <ShiftBlockRow
              key={b.id}
              day={day}
              block={b}
              blockCost={bc}
              onUpdate={onUpdate}
              onUpdateTime={onUpdateTime}
              onSetMode={onSetMode}
              onRemove={onRemove}
              canManage={canManage}
            />
          );
        })}
        {canManage && (
          <Button variant="ghost" size="sm" className="h-7 justify-start px-1 text-2xs" onClick={() => onAdd(day)}>
            <Plus className="size-3" />
            Add block
          </Button>
        )}
        <div
          className={cn(
            'flex items-center gap-1 rounded-md px-1.5 py-1 text-2xs font-medium',
            hoursOk ? 'bg-emerald-50 text-emerald-700' : 'bg-amber-50 text-amber-700'
          )}
        >
          {hoursOk ? <CheckCircle2 className="size-3" /> : <AlertTriangle className="size-3" />}
          {(dayData?.hoursSum ?? 0).toFixed(1)}/24 hrs
        </div>
        {canManage && (
          <select
            defaultValue=""
            onChange={(e) => {
              if (e.target.value) onCopyTo(day, e.target.value);
              e.target.value = '';
            }}
            className="mt-1 w-full rounded border border-border px-1 py-1 text-2xs text-muted-foreground"
          >
            <option value="">Copy this day to…</option>
            {WEEK_DAYS.filter((d) => d !== day).map((d) => (
              <option key={d} value={d}>
                {d}
              </option>
            ))}
          </select>
        )}
      </CardContent>
    </Card>
  );
}

export function WeeklyRosterGrid({
  schedule,
  perDayTypical,
  templateName,
  onUpdate,
  onUpdateTime,
  onSetMode,
  onAdd,
  onRemove,
  onCopyTo,
  canManage,
}) {
  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-1">
        <span className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Monday – Friday</span>
        <span className="text-xs font-semibold text-emerald-700">Editing: {templateName}</span>
      </div>
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-3 lg:grid-cols-5">
        {['Mon', 'Tue', 'Wed', 'Thu', 'Fri'].map((d) => (
          <DayCard
            key={d}
            day={d}
            blocks={schedule?.[d]}
            dayData={perDayTypical?.[d]}
            onUpdate={onUpdate}
            onUpdateTime={onUpdateTime}
            onSetMode={onSetMode}
            onAdd={onAdd}
            onRemove={onRemove}
            onCopyTo={onCopyTo}
            canManage={canManage}
          />
        ))}
      </div>
      <div className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Weekend</div>
      <div className="grid max-w-2xl grid-cols-1 gap-3 sm:grid-cols-2">
        {['Sat', 'Sun'].map((d) => (
          <DayCard
            key={d}
            day={d}
            blocks={schedule?.[d]}
            dayData={perDayTypical?.[d]}
            onUpdate={onUpdate}
            onUpdateTime={onUpdateTime}
            onSetMode={onSetMode}
            onAdd={onAdd}
            onRemove={onRemove}
            onCopyTo={onCopyTo}
            canManage={canManage}
          />
        ))}
      </div>
    </div>
  );
}
