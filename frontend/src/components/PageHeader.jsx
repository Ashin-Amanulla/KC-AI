/**
 * Compact page header: title + one-line description on the left, actions
 * (filters, buttons, badges) on the right. Keeps vertical space for data.
 */
export function PageHeader({ title, description, children }) {
  return (
    <div className="flex flex-wrap items-center justify-between gap-x-6 gap-y-2">
      <div className="min-w-0">
        <h2 className="text-xl font-bold tracking-tight">{title}</h2>
        {description && <p className="text-[13px] text-muted-foreground">{description}</p>}
      </div>
      {children && <div className="flex flex-wrap items-center gap-2">{children}</div>}
    </div>
  );
}
