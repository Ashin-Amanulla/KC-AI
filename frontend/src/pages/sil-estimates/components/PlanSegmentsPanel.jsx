import { Plus, Trash2, AlertTriangle } from 'lucide-react';
import { Button } from '../../../ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '../../../ui/card';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '../../../ui/select';
import { DateInputDMY } from './DateInputDMY';

export function PlanSegmentsPanel({
  segments,
  templates,
  calc,
  onAdd,
  onUpdate,
  onRemove,
  canManage,
}) {
  const templateList = Object.values(templates || {});

  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between pb-3">
        <CardTitle className="text-sm font-semibold">Plan segments — which template applies when</CardTitle>
        {canManage && (
          <Button size="sm" variant="outline" onClick={onAdd}>
            <Plus className="size-3.5" />
            Add segment
          </Button>
        )}
      </CardHeader>
      <CardContent className="space-y-2 pt-0">
        {segments.map((s) => (
          <div
            key={s.id}
            className="flex flex-wrap items-center gap-2 rounded-lg border px-2 py-1.5"
          >
            <input
              value={s.label}
              onChange={(e) => onUpdate(s.id, { label: e.target.value })}
              className="w-32 bg-transparent text-xs font-medium outline-none"
              disabled={!canManage}
            />
            <DateInputDMY
              value={s.start}
              onChange={(iso) => onUpdate(s.id, { start: iso })}
              className="w-24 bg-transparent text-xs outline-none"
            />
            <span className="text-xs text-muted-foreground">→</span>
            <DateInputDMY
              value={s.end}
              onChange={(iso) => onUpdate(s.id, { end: iso })}
              className="w-24 bg-transparent text-xs outline-none"
            />
            <Select
              value={s.templateId}
              onValueChange={(v) => onUpdate(s.id, { templateId: v })}
              disabled={!canManage}
            >
              <SelectTrigger className="h-7 w-36 text-xs">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {templateList.map((t) => (
                  <SelectItem key={t.id} value={t.id}>
                    {t.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            {canManage && segments.length > 1 && (
              <Button variant="ghost" size="icon" className="ml-auto size-7" onClick={() => onRemove(s.id)}>
                <Trash2 className="size-3.5" />
              </Button>
            )}
          </div>
        ))}

        {(calc.uncoveredDays > 0 || calc.overlapDays > 0) && (
          <div className="space-y-1.5 pt-2">
            {calc.uncoveredDays > 0 && (
              <div className="flex items-center gap-1.5 rounded-lg bg-amber-50 px-3 py-2 text-xs font-semibold text-amber-800 dark:bg-amber-950/30 dark:text-amber-200">
                <AlertTriangle className="size-3.5" />
                {calc.uncoveredDays} day(s) not covered by any segment.
              </div>
            )}
            {calc.overlapDays > 0 && (
              <div className="flex items-center gap-1.5 rounded-lg bg-amber-50 px-3 py-2 text-xs font-semibold text-amber-800 dark:bg-amber-950/30 dark:text-amber-200">
                <AlertTriangle className="size-3.5" />
                {calc.overlapDays} day(s) have overlapping segments — later segment wins.
              </div>
            )}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
