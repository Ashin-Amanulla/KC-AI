import { useMemo, useState } from 'react';
import { Card, CardContent } from '../../ui/card';
import { LoadingSpinner } from '../../ui/LoadingSpinner';
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
        <p className="max-w-2xl text-sm text-muted-foreground">
          Scans imported shifts and computed pay for the data problems that cause wrong pay:
          overlapping rostered time, zero/implausible durations, negative pay buckets, and effective
          hourly rates outside sane SCHADS bounds.
        </p>
        <div className="flex gap-4 text-sm">
          <span>
            <strong className={cn('tabular-nums', data.totals.error > 0 ? 'text-destructive' : 'text-emerald-600 dark:text-emerald-400')}>
              {data.totals.error ?? 0}
            </strong>{' '}
            <span className="text-muted-foreground">errors</span>
          </span>
          <span>
            <strong className="tabular-nums text-amber-600 dark:text-amber-400">{data.totals.warning ?? 0}</strong>{' '}
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
                <span
                  className={cn(
                    'mt-0.5 rounded-full px-2 py-0.5 text-[11px] font-medium whitespace-nowrap',
                    a.severity === 'error'
                      ? 'bg-destructive/15 text-destructive'
                      : 'bg-amber-500/15 text-amber-700 dark:text-amber-400'
                  )}
                >
                  {TYPE_LABELS[a.type] ?? a.type}
                </span>
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
