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
  periodsForRateCard,
} from '../../../lib/silEstimate/constants';
import { fmtMoney } from '../../../lib/silEstimate/formatters';

function dayTypeColor(dt) {
  if (dt === 'Public Holiday') return PH_COLOR;
  if (dt === 'Saturday') return DAY_META.Sat.color;
  if (dt === 'Sunday') return DAY_META.Sun.color;
  return DAY_META.Mon.color;
}

export function CategoryBreakdownTable({ calc }) {
  if (calc.dateError) return null;

  const rows = RATE_DAY_TYPES.flatMap((dt) =>
    periodsForRateCard(dt).flatMap((p) =>
      INTENSITIES.map((intn) => {
        const key = `${dt}|${p}|${intn}`;
        const row = calc.categoryBreakdown[key];
        if (!row || row.hours === 0) return null;
        return { key, dt, p, intn, row };
      }).filter(Boolean)
    )
  );

  const totalHours = Object.values(calc.categoryBreakdown).reduce((s, r) => s + r.hours, 0);

  return (
    <Card>
      <CardHeader className="pb-3">
        <CardTitle className="text-sm font-semibold">Total hours & cost by category</CardTitle>
      </CardHeader>
      <CardContent className="overflow-x-auto pt-0">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Day type</TableHead>
              <TableHead>Period</TableHead>
              <TableHead>Intensity</TableHead>
              <TableHead className="text-right">Total hours</TableHead>
              <TableHead className="text-right">Total cost</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {rows.map(({ key, dt, p, intn, row }) => (
              <TableRow key={key}>
                <TableCell className="font-semibold" style={{ color: dayTypeColor(dt) }}>
                  {dt}
                </TableCell>
                <TableCell>{p === 'Day' ? 'All day' : p}</TableCell>
                <TableCell className="text-muted-foreground">
                  {intn === 'High Intensity' ? 'High Int.' : intn}
                </TableCell>
                <TableCell className="text-right font-medium">{row.hours.toFixed(1)}</TableCell>
                <TableCell className="text-right font-semibold">{fmtMoney(row.cost)}</TableCell>
              </TableRow>
            ))}
            <TableRow className="border-t-2 font-bold">
              <TableCell colSpan={3}>Total</TableCell>
              <TableCell className="text-right">{totalHours.toFixed(1)}</TableCell>
              <TableCell className="text-right">{fmtMoney(calc.periodTotal)}</TableCell>
            </TableRow>
          </TableBody>
        </Table>
      </CardContent>
    </Card>
  );
}
