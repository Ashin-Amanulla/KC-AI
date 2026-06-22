import { NavLink, Outlet } from 'react-router-dom';
import { cn } from '../../lib/utils';
import { CrmBdmProvider, useCrmBdm } from './CrmBdmContext';

const LINKS = [
  { to: '/crm', end: true, label: 'Dashboard' },
  { to: '/crm/support-coordinators', label: 'Support Coordinators' },
  { to: '/crm/leads', label: 'Leads' },
  { to: '/crm/marketing', label: 'Marketing' },
  { to: '/crm/import-export', label: 'Import / Export' },
];

function CrmBdmSelector() {
  const { canViewAll, bdmOwnerId, setBdmOwnerId, bdmOwners } = useCrmBdm();
  if (!canViewAll) return null;

  return (
    <div className="flex flex-wrap items-center gap-2">
      <label htmlFor="crm-bdm-select" className="text-sm text-muted-foreground">
        BDM list
      </label>
      <select
        id="crm-bdm-select"
        value={bdmOwnerId}
        onChange={(e) => setBdmOwnerId(e.target.value)}
        className="h-9 rounded-md border border-input bg-background px-3 text-sm shadow-sm focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
      >
        <option value="all">All BDMs</option>
        <option value="unassigned">Unassigned</option>
        {bdmOwners.map((owner) => (
          <option key={owner.id} value={owner.id}>
            {owner.name || owner.email || owner.id}
          </option>
        ))}
      </select>
    </div>
  );
}

export function CrmLayout() {
  return (
    <CrmBdmProvider>
      <div className="space-y-4">
        <div className="flex flex-wrap items-end justify-between gap-4">
          <div>
            <h2 className="text-2xl font-bold tracking-tight md:text-3xl">CRM</h2>
            <p className="text-sm text-muted-foreground">
              Business development tracker — support coordinators, leads, and marketing.
            </p>
          </div>
          <CrmBdmSelector />
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
    </CrmBdmProvider>
  );
}
