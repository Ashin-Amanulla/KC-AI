import { useState } from 'react';
import { Download, Plus, Trash2 } from 'lucide-react';
import { Button } from '../../../ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '../../../ui/card';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '../../../ui/select';
import { STATES } from '../../../lib/silEstimate/constants';
import { loadHolidaysForState } from '../../../lib/silEstimate/holidays';
import { DateInputDMY } from './DateInputDMY';
import { cn } from '../../../lib/utils';

export function HolidaysPanel({
  state,
  holidays,
  planStart,
  planEnd,
  dateError,
  onStateChange,
  onHolidaysChange,
  canManage,
}) {
  const [open, setOpen] = useState(false);

  const loadStateHolidays = () => {
    onHolidaysChange(loadHolidaysForState(state));
  };

  const addHoliday = () => {
    onHolidaysChange([...holidays, { id: Date.now(), date: planStart, name: '' }]);
  };

  const updateHoliday = (id, patch) => {
    onHolidaysChange(holidays.map((h) => (h.id === id ? { ...h, ...patch } : h)));
  };

  const removeHoliday = (id) => {
    onHolidaysChange(holidays.filter((h) => h.id !== id));
  };

  return (
    <Card>
      <CardHeader className="cursor-pointer pb-3" onClick={() => setOpen((v) => !v)}>
        <CardTitle className="flex items-center justify-between text-sm font-semibold">
          <span>
            Public holidays
            {holidays.length > 0 && (
              <span className="ml-2 font-normal text-muted-foreground">({holidays.length} loaded)</span>
            )}
          </span>
          <span className="text-2xs text-muted-foreground">{open ? 'Hide' : 'Show'}</span>
        </CardTitle>
      </CardHeader>
      {open && (
        <CardContent className="space-y-3 pt-0">
          {canManage && (
            <div className="flex flex-wrap items-center gap-2">
              <Select value={state} onValueChange={onStateChange}>
                <SelectTrigger className="h-8 w-24">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {STATES.map((s) => (
                    <SelectItem key={s} value={s}>
                      {s}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <Button size="sm" variant="secondary" onClick={loadStateHolidays}>
                <Download className="size-3.5" />
                Load {state} holidays
              </Button>
              <Button size="sm" variant="outline" onClick={addHoliday}>
                <Plus className="size-3.5" />
                Add holiday
              </Button>
            </div>
          )}
          <div className="grid grid-cols-1 gap-2 sm:grid-cols-2 lg:grid-cols-3">
            {[...holidays]
              .sort((a, b) => (a.date || '').localeCompare(b.date || ''))
              .map((h) => {
                const inPeriod = h.date >= planStart && h.date <= planEnd && !dateError;
                return (
                  <div
                    key={h.id}
                    className={cn(
                      'flex items-center gap-2 rounded-lg border px-2 py-1.5',
                      !inPeriod && 'opacity-50'
                    )}
                  >
                    <DateInputDMY
                      value={h.date}
                      onChange={(iso) => updateHoliday(h.id, { date: iso })}
                      className="w-24 bg-transparent text-xs font-semibold outline-none"
                    />
                    <input
                      value={h.name}
                      onChange={(e) => updateHoliday(h.id, { name: e.target.value })}
                      placeholder="Holiday name"
                      className="min-w-0 flex-1 bg-transparent text-xs outline-none"
                      disabled={!canManage}
                    />
                    {canManage && (
                      <button
                        type="button"
                        onClick={() => removeHoliday(h.id)}
                        className="shrink-0 text-muted-foreground hover:text-destructive"
                      >
                        <Trash2 className="size-3.5" />
                      </button>
                    )}
                  </div>
                );
              })}
          </div>
        </CardContent>
      )}
    </Card>
  );
}
