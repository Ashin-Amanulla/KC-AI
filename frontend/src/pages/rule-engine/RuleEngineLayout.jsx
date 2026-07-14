import { NavLink, Outlet } from 'react-router-dom';
import { cn } from '../../lib/utils';
import { useAwardRatesStore } from '../../store/awardRates';

const LINKS = [
  { to: '/rule-engine', end: true, label: 'Rules Reference' },
  { to: '/rule-engine/tests', label: 'Test Monitor' },
  { to: '/rule-engine/rates', label: 'Award Rates' },
  { to: '/rule-engine/coverage', label: 'Rate-card Coverage' },
];

export function RuleEngineLayout() {
  const { setLabel, status, isFallback } = useAwardRatesStore();

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h2 className="text-2xl font-bold tracking-tight md:text-3xl">SCHADS Rule Engine</h2>
          <p className="text-sm text-muted-foreground">
            How we pay under the SCHADS Award (MA000100) — every encoded rule, its test coverage,
            and the effective award rates.
          </p>
        </div>
        <div className="flex items-center gap-2 text-sm">
          <span className="text-muted-foreground">Active rate set:</span>
          {isFallback ? (
            <span className="rounded-full bg-destructive/10 px-2.5 py-0.5 font-medium text-destructive">
              fallback constants — no rate set for today
            </span>
          ) : (
            <span
              className={cn(
                'rounded-full px-2.5 py-0.5 font-medium',
                status === 'needs-verification'
                  ? 'bg-amber-500/15 text-amber-700 dark:text-amber-400'
                  : 'bg-emerald-500/15 text-emerald-700 dark:text-emerald-400'
              )}
            >
              {setLabel}
              {status === 'needs-verification' ? ' · needs verification' : ''}
            </span>
          )}
        </div>
      </div>
      <nav className="flex flex-wrap gap-2 border-b pb-2">
        {LINKS.map(({ to, end, label }) => (
          <NavLink
            key={to}
            to={to}
            end={end}
            className={({ isActive }) =>
              cn(
                'rounded-md px-3 py-1.5 text-sm font-medium transition-colors',
                isActive
                  ? 'bg-primary text-primary-foreground'
                  : 'text-muted-foreground hover:bg-accent hover:text-foreground'
              )
            }
          >
            {label}
          </NavLink>
        ))}
      </nav>
      <Outlet />
    </div>
  );
}
