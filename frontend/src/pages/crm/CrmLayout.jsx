import { NavLink, Outlet } from 'react-router-dom';
import { cn } from '../../lib/utils';

const LINKS = [
  { to: '/crm', end: true, label: 'Dashboard' },
  { to: '/crm/support-coordinators', label: 'Support Coordinators' },
  { to: '/crm/leads', label: 'Leads' },
  { to: '/crm/marketing', label: 'Marketing' },
  { to: '/crm/staffing', label: 'Staffing' },
  { to: '/crm/import-export', label: 'Import / Export' },
];

export function CrmLayout() {
  return (
    <div className="space-y-4">
      <div>
        <h2 className="text-2xl font-bold tracking-tight md:text-3xl">CRM</h2>
        <p className="text-sm text-muted-foreground">
          Business development tracker — support coordinators, leads, marketing, and staffing.
        </p>
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
