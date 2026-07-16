import * as React from 'react';
import { cn } from '../lib/utils';

const Switch = React.forwardRef(
  ({ className, checked = false, disabled = false, onCheckedChange, id, ...props }, ref) => (
    <button
      type="button"
      role="switch"
      id={id}
      ref={ref}
      aria-checked={checked}
      disabled={disabled}
      onClick={() => onCheckedChange?.(!checked)}
      className={cn(
        'relative inline-flex h-5 w-9 shrink-0 rounded-full border transition-colors',
        'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2',
        checked ? 'border-primary/50 bg-primary/25' : 'border-border bg-muted',
        disabled && 'cursor-not-allowed opacity-50',
        className
      )}
      {...props}
    >
      <span
        aria-hidden
        className={cn(
          'pointer-events-none absolute top-0.5 left-0.5 h-3.5 w-3.5 rounded-full bg-background shadow-sm transition-transform',
          checked && 'translate-x-4'
        )}
      />
    </button>
  )
);
Switch.displayName = 'Switch';

export { Switch };
