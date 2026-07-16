import { NAV_GROUPS, NAV_ITEMS } from '../config/nav';
import { PERMISSIONS } from '../config/permissions';
import { PRIMARY_TABS, primaryTabFromSearch } from '../pages/forecast-analysis/forecastAnalysisTabs';

const NESTED_SECTIONS = [
  {
    basePath: '/crm',
    section: 'CRM',
    group: 'Growth',
    links: [
      { path: '/crm', label: 'Dashboard', exact: true },
      { path: '/crm/support-coordinators', label: 'Coordinators' },
      { path: '/crm/leads', label: 'Leads' },
      { path: '/crm/marketing', label: 'Marketing' },
      { path: '/crm/import-export', label: 'Import' },
    ],
  },
  {
    basePath: '/rule-engine',
    section: 'SCHADS Rule Engine',
    group: 'Rule Engine',
    links: [
      { path: '/rule-engine', label: 'Rules Reference', exact: true },
      { path: '/rule-engine/tests', label: 'Test Monitor' },
      { path: '/rule-engine/rates', label: 'Award Rates' },
      { path: '/rule-engine/coverage', label: 'Rate-card Coverage' },
      { path: '/rule-engine/data-quality', label: 'Data Quality' },
    ],
  },
  {
    basePath: '/hr-requirements',
    section: 'HR requirements',
    group: 'Growth',
    links: [{ path: '/hr-requirements', label: 'HR requirements', exact: true }],
  },
  {
    basePath: '/continuous-improvement',
    section: 'Continuous Improvement',
    group: 'Growth',
    links: [{ path: '/continuous-improvement', label: 'CIR register', exact: true }],
  },
  {
    basePath: '/roster-coverage',
    section: 'Roster coverage',
    group: 'Operations',
    links: [
      { path: '/roster-coverage', label: 'Home', exact: true },
      { path: '/roster-coverage/shift-log', label: 'Shift Log' },
      { path: '/roster-coverage/find-cover', label: 'Find cover' },
      { path: '/roster-coverage/participants', label: 'Participants' },
      { path: '/roster-coverage/team', label: 'Team' },
      { path: '/roster-coverage/timesheet', label: 'Timesheet upload' },
      { path: '/roster-coverage/reports', label: 'Reports' },
      { path: '/roster-coverage/team', label: 'Staff profile' },
    ],
  },
];

function pathMatches(pathname, path, exact = false) {
  if (exact) return pathname === path;
  return pathname === path || pathname.startsWith(`${path}/`);
}

function findNavItem(pathname, hasFullRoster) {
  const sorted = [...NAV_ITEMS].sort((a, b) => b.path.length - a.path.length);

  return sorted.find((item) => {
    if (item.path === '/roster-coverage') {
      return pathname.startsWith('/roster-coverage') && hasFullRoster;
    }
    if (item.path === '/rule-engine') {
      return pathname.startsWith('/rule-engine');
    }
    if (item.path === '/crm') {
      return pathname.startsWith('/crm');
    }
    return pathMatches(pathname, item.path);
  });
}

function findNavGroupForItem(item) {
  if (!item) return null;
  return NAV_GROUPS.find((group) => group.items.some((navItem) => navItem.path === item.path)) ?? null;
}

/**
 * Resolve breadcrumb labels for the global top bar from the current route.
 */
export function resolvePageContext(pathname, searchParams, { hasFullRoster = true } = {}) {
  if (pathname === '/forecast-analysis' || pathname.startsWith('/forecast-analysis/')) {
    const tab = primaryTabFromSearch(searchParams);
    const tabMeta = PRIMARY_TABS.find((entry) => entry.id === tab);
    return {
      group: 'Insights',
      section: 'Forecast analysis',
      title: tabMeta?.label ?? 'Forecast analysis',
    };
  }

  for (const section of NESTED_SECTIONS) {
    if (!pathname.startsWith(section.basePath)) continue;

    const sortedLinks = [...section.links].sort((a, b) => b.path.length - a.path.length);
    const activeLink = sortedLinks.find((link) => pathMatches(pathname, link.path, link.exact));

    return {
      group: section.group,
      section: section.section,
      title: activeLink?.label ?? section.section,
    };
  }

  const navItem = findNavItem(pathname, hasFullRoster);
  if (navItem) {
    const group = findNavGroupForItem(navItem);
    return {
      group: group?.label ?? null,
      section: navItem.label,
      title: navItem.label,
    };
  }

  return {
    group: null,
    section: 'Kangaroo Care',
    title: 'Workforce console',
  };
}

export function userHasFullRoster(permissions = []) {
  return permissions.includes(PERMISSIONS.ROSTER_VIEW);
}
