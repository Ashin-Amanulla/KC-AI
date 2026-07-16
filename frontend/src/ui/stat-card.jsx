import { Card } from './card';
import { cn } from '../lib/utils';

const TONE_VALUE = {
  default: 'text-foreground',
  primary: 'text-primary',
  warning: 'text-warning',
  destructive: 'text-destructive',
  success: 'text-success',
};

const TONE_ICON = {
  default: 'bg-muted text-muted-foreground',
  primary: 'bg-primary/12 text-primary',
  warning: 'bg-warning/15 text-warning',
  destructive: 'bg-destructive/12 text-destructive',
  success: 'bg-success/15 text-success',
};

/**
 * Compact KPI tile: label + big value + optional sub-line and icon.
 * Dense by design — admin screens favour data over whitespace.
 */
export function StatCard({ label, value, sub, icon: Icon, tone = 'default', className }) {
  return (
    <Card className={cn('flex items-center gap-3 px-4 py-3', className)}>
      {Icon && (
        <span className={cn('flex h-9 w-9 shrink-0 items-center justify-center rounded-lg', TONE_ICON[tone])}>
          <Icon className="h-4.5 w-4.5" />
        </span>
      )}
      <div className="min-w-0">
        <div className="truncate text-xs font-medium text-muted-foreground">{label}</div>
        <div className={cn('text-xl font-bold leading-tight tabular-nums', TONE_VALUE[tone])}>{value}</div>
        {sub && <div className="truncate text-2xs text-muted-foreground">{sub}</div>}
      </div>
    </Card>
  );
}
