import { AlertTriangle, CheckCircle2, Info } from 'lucide-react';
import { Card, CardContent } from '../../../ui/card';
import { Badge } from '../../../ui/badge';
import { Input } from '../../../ui/input';
import { fmtMoney, fmtDMY } from '../../../lib/silEstimate/formatters';
import { cn } from '../../../lib/utils';

export function BudgetSummaryBar({ calc, budget, planStart, onBudgetChange, canManage }) {
  const overBudget = calc.variance < 0;
  const barPct = Math.min(Math.max(calc.pctOfBudget * 100, 0), 100);

  return (
    <Card className="sticky top-4 z-10 shadow-md">
      <CardContent className="grid grid-cols-1 items-center gap-6 p-5 lg:grid-cols-5">
        <div>
          <label className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
            Total allocated SIL budget
          </label>
          <div className="mt-1 flex items-center">
            <span className="mr-1 text-lg text-muted-foreground">$</span>
            <Input
              type="number"
              value={budget}
              onChange={(e) => onBudgetChange(Number(e.target.value))}
              className="border-0 border-b-2 border-border bg-transparent px-0 text-xl font-bold shadow-none focus-visible:ring-0"
              disabled={!canManage}
            />
          </div>
        </div>

        <div className="text-sm">
          <div className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
            Days in plan period
          </div>
          <div className="text-lg font-bold">{calc.dateError ? '—' : calc.totalDays}</div>
          <div className="text-2xs text-muted-foreground">
            {calc.dateError ? '' : `incl. ${calc.phWithinPeriod} public holiday${calc.phWithinPeriod === 1 ? '' : 's'}`}
          </div>
        </div>

        <div className="text-sm">
          <div className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
            Typical week (reference)
          </div>
          <div className="text-lg font-bold">{fmtMoney(calc.weeklyTypical)}</div>
          <div className="text-2xs text-muted-foreground">at Weekday/Sat/Sun rates, no PH</div>
        </div>

        {calc.sleepoverNights > 0 && (
          <div className="text-sm">
            <div className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
              Sleepover cost
            </div>
            <div className="text-lg font-bold">{fmtMoney(calc.sleepoverCost)}</div>
            <div className="text-2xs text-muted-foreground">
              {calc.sleepoverNights} night{calc.sleepoverNights === 1 ? '' : 's'}
              {calc.periodTotal > 0 ? ` · ${Math.round((calc.sleepoverCost / calc.periodTotal) * 100)}% of total` : ''}
            </div>
          </div>
        )}

        <div>
          <div className="mb-1 flex justify-between text-xs font-semibold uppercase tracking-wide text-muted-foreground">
            <span>Period total cost</span>
            <span>{calc.dateError ? '' : `${Math.round(calc.pctOfBudget * 100)}%`}</span>
          </div>
          <div className="h-4 w-full overflow-hidden rounded-full bg-muted">
            <div
              className={cn('h-full rounded-full transition-all duration-300', overBudget ? 'bg-destructive' : 'bg-emerald-600')}
              style={{ width: `${barPct}%` }}
            />
          </div>
          <div className="mt-2 flex items-center justify-between">
            <span className={cn('text-xl font-bold', overBudget ? 'text-destructive' : 'text-emerald-700')}>
              {calc.dateError ? '—' : fmtMoney(calc.periodTotal)}
            </span>
            {!calc.dateError && (
              <Badge variant={overBudget ? 'destructive' : 'secondary'}>
                {overBudget ? (
                  <>
                    <AlertTriangle className="size-3" />
                    Over by {fmtMoney(Math.abs(calc.variance))}
                  </>
                ) : (
                  <>
                    <CheckCircle2 className="size-3" />
                    {fmtMoney(calc.variance)} left
                  </>
                )}
              </Badge>
            )}
          </div>
        </div>
      </CardContent>

      {!calc.dateError && (
        <div className="mx-5 mb-5 flex items-center gap-1.5 rounded-lg bg-muted/50 px-3 py-2 text-xs text-muted-foreground">
          <Info className="size-3.5 shrink-0" />
          Whole plan priced using the{' '}
          <strong className="font-semibold text-foreground">
            {calc.usingOldRates ? 'Before 1 July 2026' : 'From 1 July 2026'}
          </strong>{' '}
          rate card — based on plan start ({fmtDMY(planStart)}).
        </div>
      )}
      {calc.dateError && (
        <div className="mx-5 mb-5 flex items-center gap-1.5 rounded-lg bg-destructive/10 px-3 py-2 text-xs font-semibold text-destructive">
          <AlertTriangle className="size-3.5" />
          {calc.dateError}
        </div>
      )}
    </Card>
  );
}
