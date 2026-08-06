import { useState } from 'react';
import { Info, AlertTriangle } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '../../../ui/card';
import { Tabs, TabsList, TabsTrigger } from '../../../ui/tabs';
import {
  RATE_DAY_TYPES,
  INTENSITIES,
  DAY_META,
  PH_COLOR,
  PH_LIGHT,
  periodsForRateCard,
} from '../../../lib/silEstimate/constants';

export function RateCardPanel({
  ratesNew,
  ratesOld,
  oldRatesConfirmed,
  onUpdateRate,
  canManage,
}) {
  const [open, setOpen] = useState(false);
  const [tab, setTab] = useState('new');

  const rates = tab === 'old' ? ratesOld : ratesNew;

  return (
    <Card>
      <CardHeader className="cursor-pointer pb-3" onClick={() => setOpen((v) => !v)}>
        <CardTitle className="flex items-center justify-between text-sm font-semibold">
          <span className="flex items-center gap-2">
            <Info className="size-4 text-muted-foreground" />
            Rate card
          </span>
          <span className="text-2xs text-muted-foreground">{open ? 'Hide' : 'Show'}</span>
        </CardTitle>
      </CardHeader>
      {open && (
        <CardContent className="space-y-3 pt-0">
          <Tabs value={tab} onValueChange={setTab}>
            <TabsList>
              <TabsTrigger value="old">Before 1 July 2026</TabsTrigger>
              <TabsTrigger value="new">From 1 July 2026</TabsTrigger>
            </TabsList>
          </Tabs>

          {tab === 'old' && !oldRatesConfirmed && (
            <div className="flex items-start gap-1.5 rounded-lg bg-amber-50 px-3 py-2 text-xs text-amber-800 dark:bg-amber-950/30">
              <AlertTriangle className="mt-0.5 size-3.5 shrink-0" />
              Placeholder pre-indexation rates — edit to confirm.
            </div>
          )}

          <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
            {RATE_DAY_TYPES.map((dt) => {
              const meta =
                dt === 'Public Holiday'
                  ? { light: PH_LIGHT, color: PH_COLOR }
                  : DAY_META[dt === 'Saturday' ? 'Sat' : dt === 'Sunday' ? 'Sun' : 'Mon'];
              return (
                <div key={dt} className="overflow-hidden rounded-lg border">
                  <div
                    className="px-3 py-1.5 text-xs font-bold"
                    style={{ backgroundColor: meta.light, color: meta.color }}
                  >
                    {dt}
                  </div>
                  <table className="w-full text-xs">
                    <thead>
                      <tr className="text-2xs uppercase text-muted-foreground">
                        <td className="px-3 py-1">Period</td>
                        <td className="px-2 py-1 text-right">Standard</td>
                        <td className="px-2 py-1 text-right">High Int.</td>
                      </tr>
                    </thead>
                    <tbody>
                      {periodsForRateCard(dt).map((p) => (
                        <tr key={p} className="border-t border-border/50">
                          <td className="px-3 py-1.5 font-medium">
                            {p === 'Day' ? 'AM / PM / Night' : p}
                          </td>
                          {INTENSITIES.map((intn) => (
                            <td key={intn} className="px-2 py-1 text-right">
                              <input
                                type="number"
                                step="0.01"
                                value={rates?.[dt]?.[p]?.[intn] ?? 0}
                                onChange={(e) => onUpdateRate(tab, dt, p, intn, e.target.value)}
                                className="w-16 border-b border-border bg-transparent text-right font-semibold outline-none focus:border-primary"
                                disabled={!canManage}
                              />
                            </td>
                          ))}
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              );
            })}
          </div>
        </CardContent>
      )}
    </Card>
  );
}
