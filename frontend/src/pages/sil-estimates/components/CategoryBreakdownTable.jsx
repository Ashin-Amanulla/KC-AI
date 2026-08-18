import { Card, CardContent, CardHeader, CardTitle } from '../../../ui/card';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '../../../ui/table';
import {
  RATE_DAY_TYPES,
  INTENSITIES,
  DAY_META,
  PH_COLOR,
} from '../../../lib/silEstimate/constants';
import { fmtMoney } from '../../../lib/silEstimate/formatters';

function dayTypeColor(dt) {
  if (dt === 'Public Holiday') return PH_COLOR;
  if (dt === 'Saturday') return DAY_META.Sat.color;
  if (dt === 'Sunday') return DAY_META.Sun.color;
  return DAY_META.Mon.color;
}

export function CategoryBreakdownTable({ calc }) {
  if (!calc || calc.dateError) return null;

  // Active (non-sleepover) rows: sorted by day type > period > intensity > ratio
  const periodOrder = ['AM', 'PM', 'Night', 'Day'];
  const activeRows = Object.values(calc.categoryBreakdown)
    .filter((r) => r.period !== 'Sleepover' && r.hours > 0)
    .sort((a, b) => {
      const dtd = RATE_DAY_TYPES.indexOf(a.rateType) - RATE_DAY_TYPES.indexOf(b.rateType);
      if (dtd) return dtd;
      const pd = periodOrder.indexOf(a.period) - periodOrder.indexOf(b.period);
      if (pd) return pd;
      const id = INTENSITIES.indexOf(a.intensity) - INTENSITIES.indexOf(b.intensity);
      if (id) return id;
      return (a.ratioLabel || '').localeCompare(b.ratioLabel || '');
    });

  // Sleepover rows: use sleepoverByType for per-day-type breakdown
  const sleepoverSplit = calc.sleepoverSplitNeeded;
  const sleepoverRows = sleepoverSplit
    ? RATE_DAY_TYPES.map((dt) => {
        const row = calc.sleepoverByType?.[dt];
        if (!row || row.nights === 0) return null;
        return { dt, row };
      }).filter(Boolean)
    : [];

  const totalHours = Object.values(calc.categoryBreakdown).reduce((s, r) => s + r.hours, 0);

  return (
    <Card>
      <CardHeader className="pb-3">
        <CardTitle className="text-sm font-semibold">
          Total hours & cost by category — whole plan period
        </CardTitle>
      </CardHeader>
      <CardContent className="overflow-x-auto pt-0">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Day type</TableHead>
              <TableHead>Period</TableHead>
              <TableHead>Intensity</TableHead>
              <TableHead>Ratio</TableHead>
              <TableHead className="text-right">Rate/hr</TableHead>
              <TableHead className="text-right">Total hours</TableHead>
              <TableHead className="text-right">Total cost</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {activeRows.map((row) => {
              const dt = row.rateType;
              const color = dayTypeColor(dt);
              const effectiveRate = row.rate * row.mult;
              return (
                <TableRow key={`${dt}-${row.period}-${row.intensity}-${row.ratioLabel}`}>
                  <TableCell className="font-semibold" style={{ color }}>
                    {dt}
                  </TableCell>
                  <TableCell>{row.period === 'Day' ? 'All day' : row.period}</TableCell>
                  <TableCell className="text-muted-foreground">
                    {row.intensity === 'High Intensity' ? 'High Int.' : row.intensity}
                  </TableCell>
                  <TableCell className="font-medium">{row.ratioLabel || '—'}</TableCell>
                  <TableCell className="text-right text-muted-foreground">
                    ${effectiveRate.toFixed(2)}
                    <span className="block leading-tight text-[10px] text-muted-foreground/60">
                      (${row.rate.toFixed(2)} base)
                    </span>
                  </TableCell>
                  <TableCell className="text-right font-medium">{row.hours.toFixed(1)}</TableCell>
                  <TableCell className="text-right font-semibold">{fmtMoney(row.cost)}</TableCell>
                </TableRow>
              );
            })}

            {sleepoverSplit && sleepoverRows.map(({ dt, row }) => (
              <TableRow key={`sleepover-${dt}`} className="bg-muted/50">
                <TableCell className="font-semibold text-muted-foreground">{dt}</TableCell>
                <TableCell className="text-muted-foreground">Sleepover</TableCell>
                <TableCell className="text-muted-foreground">—</TableCell>
                <TableCell className="font-medium text-muted-foreground">—</TableCell>
                <TableCell className="text-right text-muted-foreground">
                  flat/night
                </TableCell>
                <TableCell className="text-right font-medium text-muted-foreground">
                  {row.nights} night{row.nights === 1 ? '' : 's'}
                </TableCell>
                <TableCell className="text-right font-semibold">{fmtMoney(row.cost)}</TableCell>
              </TableRow>
            ))}

            {calc.sleepoverNights > 0 && (
              <TableRow className="bg-muted/50 font-semibold text-muted-foreground">
                <TableCell colSpan={3}>Sleepover (all day types)</TableCell>
                <TableCell className="text-muted-foreground">flat/night</TableCell>
                <TableCell className="text-right text-muted-foreground">—</TableCell>
                <TableCell className="text-right font-medium text-muted-foreground">
                  {calc.sleepoverNights} night{calc.sleepoverNights === 1 ? '' : 's'}
                </TableCell>
                <TableCell className="text-right font-semibold">{fmtMoney(calc.sleepoverCost)}</TableCell>
              </TableRow>
            )}

            <TableRow className="border-t-2 font-bold">
              <TableCell colSpan={5}>Total</TableCell>
              <TableCell className="text-right">{totalHours.toFixed(1)}</TableCell>
              <TableCell className="text-right">{fmtMoney(calc.periodTotal)}</TableCell>
            </TableRow>
          </TableBody>
        </Table>
      </CardContent>
    </Card>
  );
}
