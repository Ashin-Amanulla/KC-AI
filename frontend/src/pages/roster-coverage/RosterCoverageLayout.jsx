import { NavLink, Outlet } from 'react-router-dom';
import { cn } from '../../lib/utils';

const links = [
  { to: '/roster-coverage', end: true, label: 'Home' },
  { to: '/roster-coverage/find-cover', label: 'Find cover' },
  { to: '/roster-coverage/participants', label: 'Participants' },
  { to: '/roster-coverage/team', label: 'Team' },
  { to: '/roster-coverage/timesheet', label: 'Timesheet upload' },
  { to: '/roster-coverage/reports', label: 'Reports' },
];

export function RosterCoverageLayout() {
  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-2xl font-bold tracking-tight md:text-3xl">Roster coverage</h2>
        <p className="text-sm text-muted-foreground">
          Sick call and vacant shift coverage — eligibility, hours, and rest gaps.
        </p>
      </div>
      <nav className="flex flex-wrap gap-2 border-b pb-2">
        {links.map(({ to, end, label }) => (
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
