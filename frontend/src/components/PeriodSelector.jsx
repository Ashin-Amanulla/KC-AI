import { Input } from '../ui/input';
import { Button } from '../ui/button';
import { cn } from '../lib/utils';

const MODES = [
  { key: 'fortnight', label: 'This fortnight' },
  { key: 'week', label: 'This week' },
  { key: 'custom', label: 'Custom' },
];

export function PeriodSelector({
  mode,
  onModeChange,
  customFrom,
  customTo,
  onCustomFromChange,
  onCustomToChange,
  periodLabel,
  className,
}) {
  return (
    <div className={cn('flex flex-wrap items-center gap-2', className)}>
      <div className="inline-flex rounded-md border border-border bg-secondary p-0.5">
        {MODES.map(({ key, label }) => (
          <Button
            key={key}
            type="button"
            variant="ghost"
            size="sm"
            className={cn(
              'h-7 px-2.5 text-xs',
              mode === key && 'bg-surface text-ink shadow-xs hover:bg-surface'
            )}
            onClick={() => onModeChange(key)}
          >
            {label}
          </Button>
        ))}
      </div>
      {mode === 'custom' && (
        <>
          <div className="flex items-center gap-1.5">
            <span className="text-2xs text-muted-foreground">From</span>
            <Input
              type="date"
              value={customFrom}
              onChange={(e) => onCustomFromChange(e.target.value)}
              className="filter-control-date h-8"
              aria-label="From date"
            />
          </div>
          <div className="flex items-center gap-1.5">
            <span className="text-2xs text-muted-foreground">To</span>
            <Input
              type="date"
              value={customTo}
              onChange={(e) => onCustomToChange(e.target.value)}
              className="filter-control-date h-8"
              aria-label="To date"
            />
          </div>
        </>
      )}
      {periodLabel && (
        <span className="text-2xs text-muted-foreground">{periodLabel}</span>
      )}
    </div>
  );
}
