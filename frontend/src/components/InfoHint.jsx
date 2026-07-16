import { CircleHelp, Info } from 'lucide-react';
import { cn } from '../lib/utils';
import { Label } from '../ui/label';
import { CardTitle } from '../ui/card';
import { Tooltip, TooltipContent, TooltipTrigger } from '../ui/tooltip';

/**
 * Compact inline help — icon button reveals explanation in a tooltip.
 * Use instead of paragraph helper text to keep dense admin screens clean.
 */
export function InfoHint({
  content,
  label = 'More information',
  variant = 'info',
  side = 'top',
  className,
  iconClassName,
}) {
  const Icon = variant === 'help' ? CircleHelp : Info;

  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <button
          type="button"
          className={cn(
            'inline-flex h-5 w-5 shrink-0 items-center justify-center rounded-full text-muted-foreground/70 transition-colors',
            'hover:bg-muted hover:text-foreground',
            'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-1',
            className
          )}
          aria-label={label}
        >
          <Icon className={cn('h-3.5 w-3.5', iconClassName)} />
        </button>
      </TooltipTrigger>
      <TooltipContent
        side={side}
        className="max-w-xs px-3 py-2 text-left text-2sm leading-snug"
      >
        {content}
      </TooltipContent>
    </Tooltip>
  );
}

export function FieldLabel({ htmlFor, children, hint, hintLabel, className }) {
  return (
    <div className={cn('flex items-center gap-1', className)}>
      <Label
        htmlFor={htmlFor}
        className="text-2xs font-medium uppercase tracking-wide text-muted-foreground"
      >
        {children}
      </Label>
      {hint && <InfoHint content={hint} label={hintLabel || `About ${children}`} />}
    </div>
  );
}

/** Card section title with optional info tooltip — replaces CardTitle + helper paragraph. */
export function CardTitleHint({ children, hint, hintLabel, className, titleClassName }) {
  return (
    <div className={cn('flex items-center gap-1.5', className)}>
      <CardTitle className={cn('text-base', titleClassName)}>{children}</CardTitle>
      {hint && (
        <InfoHint content={hint} label={hintLabel || `About ${children}`} variant="help" />
      )}
    </div>
  );
}
