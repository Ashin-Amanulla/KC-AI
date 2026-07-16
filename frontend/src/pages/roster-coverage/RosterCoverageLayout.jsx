import { Outlet } from 'react-router-dom';
import { InfoHint } from '../../components/InfoHint';
import { TabNav, TabNavLink } from '../../ui/tabs';
import { useAuthStore } from '../../store/auth';

const ALL_LINKS = [
  { to: '/roster-coverage', end: true, label: 'Home', short: 'Home' },
  { to: '/roster-coverage/shift-log', label: 'Shift Log', short: 'Shifts' },
  { to: '/roster-coverage/find-cover', label: 'Find cover', short: 'Cover' },
  { to: '/roster-coverage/participants', label: 'Participants', short: 'Participants' },
  { to: '/roster-coverage/team', label: 'Team', short: 'Team' },
  { to: '/roster-coverage/timesheet', label: 'Timesheet upload', short: 'Timesheet' },
  { to: '/roster-coverage/reports', label: 'Reports', short: 'Reports' },
];

export function RosterCoverageLayout() {
  const role = useAuthStore((s) => s.user?.role);
  const links =
    role === 'shifts_viewer'
      ? ALL_LINKS.filter(
          (l) =>
            l.to === '/roster-coverage/shift-log' || l.to === '/roster-coverage/find-cover'
        )
      : ALL_LINKS;

  const isViewer = role === 'shifts_viewer';

  return (
    <div className="page-stack-tight">
      {!isViewer && (
        <InfoHint
          variant="help"
          label="About roster coverage"
          content="Sick call and vacant shift coverage — eligibility, hours, and rest gaps."
        />
      )}
      {links.length > 1 && (
        <TabNav>
          {links.map(({ to, end, short, label }) => (
            <TabNavLink key={to} to={to} end={end} className="px-2.5 py-1 text-xs">
              {short ?? label}
            </TabNavLink>
          ))}
        </TabNav>
      )}
      <Outlet />
    </div>
  );
}
