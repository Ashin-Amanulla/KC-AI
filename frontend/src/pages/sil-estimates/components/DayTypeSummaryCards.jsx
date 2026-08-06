import { CalendarDays } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '../../../ui/card';
import { RATE_DAY_TYPES, DAY_META, PH_COLOR } from '../../../lib/silEstimate/constants';
import { fmtMoney } from '../../../lib/silEstimate/formatters';
import { DateInputDMY } from './DateInputDMY';

function dayTypeColor(dt) {
  if (dt === 'Public Holiday') return PH_COLOR;
  if (dt === 'Saturday') return DAY_META.Sat.color;
  if (dt === 'Sunday') return DAY_META.Sun.color;
  return DAY_META.Mon.color;
}

export function DayTypeSummaryCards({ calc, planStart, planEnd, onPlanStartChange, onPlanEndChange, canManage }) {
  return (
    <Card>
      <CardHeader className="pb-3">
        <CardTitle className="flex items-center gap-2 text-sm font-semibold">
          <CalendarDays className="size-4 text-muted-foreground" />
          Plan / agreement period
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4 pt-0">
        <div className="flex flex-wrap items-end gap-6">
          <div>
            <label className="mb-1 block text-2xs font-semibold text-muted-foreground">Start date</label>
            <DateInputDMY
              value={planStart}
              onChange={onPlanStartChange}
              className="w-28 border-b border-border bg-transparent text-sm font-semibold outline-none focus:border-primary"
              disabled={!canManage}
            />
          </div>
          <div>
            <label className="mb-1 block text-2xs font-semibold text-muted-foreground">End date</label>
            <DateInputDMY
              value={planEnd}
              onChange={onPlanEndChange}
              className="w-28 border-b border-border bg-transparent text-sm font-semibold outline-none focus:border-primary"
              disabled={!canManage}
            />
          </div>
        </div>

        {!calc.dateError && (
          <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
            {RATE_DAY_TYPES.map((dt) => (
              <div key={dt} className="rounded-lg border px-3 py-2">
                <div className="text-2xs font-bold" style={{ color: dayTypeColor(dt) }}>
                  {dt}
                </div>
                <div className="text-lg font-bold">
                  {calc.counts[dt]}{' '}
                  <span className="text-xs font-normal text-muted-foreground">days</span>
                </div>
                <div className="text-2xs text-muted-foreground">{fmtMoney(calc.costByType[dt])}</div>
              </div>
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
