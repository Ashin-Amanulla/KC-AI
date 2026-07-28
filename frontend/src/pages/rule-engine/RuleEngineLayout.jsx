import { Outlet } from 'react-router-dom';
import { InfoHint } from '../../components/InfoHint';
import { Badge } from '../../ui/badge';
import { TabNav, TabNavLink } from '../../ui/tabs';
import { useAwardRatesStore } from '../../store/awardRates';

const LINKS = [
  { to: '/rule-engine', end: true, label: 'Rules' },
  { to: '/rule-engine/sop', label: 'SOP' },
  { to: '/rule-engine/tests', label: 'Tests' },
  { to: '/rule-engine/rates', label: 'Rates' },
  { to: '/rule-engine/coverage', label: 'Coverage' },
  { to: '/rule-engine/data-quality', label: 'Quality' },
];

export function RuleEngineLayout() {
  const { setLabel, status, isFallback } = useAwardRatesStore();

  return (
    <div className="space-y-2.5">
      <div className="flex flex-wrap items-center gap-2">
        <InfoHint
          content="How we pay under the SCHADS Award (MA000100) — every encoded rule, its test coverage, and the effective award rates."
          label="About SCHADS Rule Engine"
          variant="help"
        />
        <span className="text-2xs text-muted-foreground">Rate set</span>
        {isFallback ? (
          <Badge variant="destructive" className="text-2xs">
            fallback — no rate set
          </Badge>
        ) : (
          <Badge variant={status === 'needs-verification' ? 'warning' : 'success'} className="text-2xs">
            {setLabel}
            {status === 'needs-verification' ? ' · verify' : ''}
          </Badge>
        )}
      </div>
      <TabNav>
        {LINKS.map(({ to, end, label }) => (
          <TabNavLink key={to} to={to} end={end} className="px-2.5 py-1 text-xs">
            {label}
          </TabNavLink>
        ))}
      </TabNav>
      <Outlet />
    </div>
  );
}
