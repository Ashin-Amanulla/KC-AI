import { Plus, Upload } from 'lucide-react';
import { Button } from '../../../ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '../../../ui/card';
import { Input } from '../../../ui/input';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '../../../ui/table';
import { DateInputDMY } from './DateInputDMY';
import { cn } from '../../../lib/utils';

export function ParticipantPlanTable({
  participants,
  activeName,
  newParticipantInput,
  onNewParticipantInputChange,
  onAddParticipant,
  onSwitchParticipant,
  onUpdateDates,
  onUpdateBudget,
  onPlanDatesUpload,
  canManage,
}) {
  const sorted = [...(participants || [])].sort((a, b) => a.name.localeCompare(b.name));

  return (
    <Card>
      <CardHeader className="flex flex-row flex-wrap items-center justify-between gap-2 pb-3">
        <CardTitle className="text-sm font-semibold">Participant plan dates & budgets</CardTitle>
        {canManage && (
          <div className="flex flex-wrap items-center gap-2">
            <Input
              value={newParticipantInput}
              onChange={(e) => onNewParticipantInputChange(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter' && newParticipantInput.trim()) onAddParticipant(newParticipantInput.trim());
              }}
              placeholder="New participant name"
              className="h-8 w-40 text-xs"
            />
            <Button size="sm" onClick={() => onAddParticipant(newParticipantInput.trim())}>
              <Plus className="size-3.5" />
              Add participant
            </Button>
            <Button size="sm" variant="secondary" asChild>
              <label className="cursor-pointer">
                <Upload className="size-3.5" />
                Upload plan dates
                <input
                  type="file"
                  accept=".xlsx,.xls,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet,application/vnd.ms-excel"
                  onChange={onPlanDatesUpload}
                  className="hidden"
                />
              </label>
            </Button>
          </div>
        )}
      </CardHeader>
      <CardContent className="pt-0">
        <div className="max-h-80 overflow-y-auto rounded-md border">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Participant</TableHead>
                <TableHead>Start date</TableHead>
                <TableHead>End date</TableHead>
                <TableHead className="text-right">Budget</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {sorted.map((p) => {
                const isActive = p.name === activeName;
                return (
                  <TableRow key={p.name} className={cn(isActive && 'bg-primary/5')}>
                    <TableCell>
                      <button
                        type="button"
                        onClick={() => onSwitchParticipant(p.name)}
                        className={cn(
                          'text-left text-sm hover:underline',
                          isActive ? 'font-semibold text-primary' : 'text-muted-foreground'
                        )}
                      >
                        {p.name}
                      </button>
                    </TableCell>
                    <TableCell>
                      <DateInputDMY
                        value={p.planStart}
                        onChange={(iso) => onUpdateDates(p.name, 'start', iso)}
                        className="w-24 border-b border-border bg-transparent text-xs outline-none focus:border-primary"
                      />
                    </TableCell>
                    <TableCell>
                      <DateInputDMY
                        value={p.planEnd}
                        onChange={(iso) => onUpdateDates(p.name, 'end', iso)}
                        className="w-24 border-b border-border bg-transparent text-xs outline-none focus:border-primary"
                      />
                    </TableCell>
                    <TableCell className="text-right">
                      <input
                        type="number"
                        value={p.budget}
                        onChange={(e) => onUpdateBudget(p.name, e.target.value)}
                        className="w-24 border-b border-border bg-transparent text-right text-xs outline-none focus:border-primary"
                        disabled={!canManage}
                      />
                    </TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
        </div>
      </CardContent>
    </Card>
  );
}
