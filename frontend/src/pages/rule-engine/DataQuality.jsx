import { useMemo, useState } from 'react';
import { Card, CardContent } from '../../ui/card';
import { Badge } from '../../ui/badge';
import { LoadingSpinner } from '../../ui/LoadingSpinner';
import { CardTitleHint } from '../../components/InfoHint';
import { cn } from '../../lib/utils';
import { useAnomalies } from '../../api/ruleEngine';

const TYPE_LABELS = {
  'overlapping-shifts': 'Overlapping shifts',
  'zero-duration-shift': 'Zero-duration shifts',
  'implausible-duration': 'Implausible durations',
  'negative-bucket': 'Negative pay buckets',
  'effective-rate-out-of-bounds': 'Effective rate out of bounds',
};

export function DataQuality() {
  const { data, isLoading, error } = useAnomalies();
  const [typeFilter, setTypeFilter] = useState('all');

  const byType = useMemo(() => {
    const counts = {};
    for (const a of data?.anomalies ?? []) counts[a.type] = (counts[a.type] || 0) + 1;
    return counts;
  }, [data]);

  if (isLoading) return <LoadingSpinner />;
  if (error) return <p className="text-sm text-destructive">Failed to run the data-quality scan.</p>;

  const anomalies = (data?.anomalies ?? []).filter((a) => typeFilter === 'all' || a.type === typeFilter);

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <CardTitleHint
          hint="Scans imported shifts and computed pay for overlapping time, zero/implausible durations, negative buckets, and out-of-bounds effective rates."
        >
          Data quality scan
        </CardTitleHint>
        <div className="flex gap-4 text-sm">
          <span>
            <strong className={cn('tabular-nums', data.totals.error > 0 ? 'text-destructive' : 'text-success')}>
              {data.totals.error ?? 0}
            </strong>{' '}
            <span className="text-muted-foreground">errors</span>
          </span>
          <span>
            <strong className="tabular-nums text-warning">{data.totals.warning ?? 0}</strong>{' '}
            <span className="text-muted-foreground">warnings</span>
          </span>
          <span className="text-muted-foreground">
            {data.scannedShifts} shifts · {data.scannedPayHours} pay rows scanned
          </span>
        </div>
      </div>

      <div className="flex flex-wrap gap-2">
        <button
          type="button"
          onClick={() => setTypeFilter('all')}
          className={cn(
            'rounded-full px-3 py-1 text-xs font-medium transition-colors',
            typeFilter === 'all' ? 'bg-primary text-primary-foreground' : 'bg-muted text-muted-foreground hover:text-foreground'
          )}
        >
          All {data.anomalies?.length ?? 0}
        </button>
        {Object.entries(TYPE_LABELS).map(([type, label]) => (
          <button
            key={type}
            type="button"
            onClick={() => setTypeFilter(type === typeFilter ? 'all' : type)}
            className={cn(
              'rounded-full px-3 py-1 text-xs font-medium transition-colors',
              typeFilter === type ? 'bg-primary text-primary-foreground' : 'bg-muted text-muted-foreground hover:text-foreground'
            )}
          >
            {label} {byType[type] ?? 0}
          </button>
        ))}
      </div>

      {!anomalies.length ? (
        <Card>
          <CardContent className="py-10 text-center text-sm text-muted-foreground">
            ✓ No anomalies found — imported shifts and computed pay look internally consistent.
          </CardContent>
        </Card>
      ) : (
        <Card>
          <CardContent className="divide-y p-0">
            {anomalies.map((a, i) => (
              <div key={i} className="flex items-start gap-3 px-4 py-2 text-sm">
                <Badge variant={a.severity === 'error' ? 'destructive' : 'warning'} className="mt-0.5 shrink-0">
                  {TYPE_LABELS[a.type] ?? a.type}
                </Badge>
                <div className="min-w-0">
                  <span className="font-medium">{a.staffName}</span>
                  <span className="ml-2 break-words text-muted-foreground">{a.detail}</span>
                </div>
              </div>
            ))}
          </CardContent>
        </Card>
      )}
    </div>
  );
}
