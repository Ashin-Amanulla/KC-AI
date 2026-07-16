import { InfoHint } from './InfoHint';

/**
 * Compact page header: title (+ optional hint tooltip) on the left, actions
 * (filters, buttons, badges) on the right. Keeps vertical space for data.
 */
export function PageHeader({ title, description, hint, children }) {
  return (
    <div className="flex flex-wrap items-center justify-between gap-x-6 gap-y-2">
      <div className="min-w-0">
        <div className="flex items-center gap-1.5">
          <h2 className="text-xl font-bold tracking-tight">{title}</h2>
          {hint && <InfoHint content={hint} label={`About ${title}`} />}
        </div>
        {description && <p className="text-2sm text-muted-foreground">{description}</p>}
      </div>
      {children && <div className="flex flex-wrap items-center gap-2">{children}</div>}
    </div>
  );
}
