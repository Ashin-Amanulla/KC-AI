import { useEffect } from 'react';
import { Link, useLocation } from 'react-router-dom';
import {
  LayoutDashboard,
  Users,
  UserCheck,
  Clock,
  FileBarChart,
  Shield,
  ChevronLeft,
  ChevronRight,
  ChevronDown,
  CalendarDays,
  Calendar,
  TrendingDown,
  GitCompare,
  Layers,
  Briefcase,
  ClipboardList,
  ListChecks,
  BookOpen,
  FileText,
  Wallet,
  ShieldAlert,
  Receipt,
  Webhook,
  Calculator,
  Puzzle,
  Boxes,
} from 'lucide-react';
import { useAuthStore } from '../store/auth';
import { useUiPreferencesStore } from '../store/uiPreferences';
import { useCustomModules } from '../api/customModules';
import { getNavGroupsForPermissions } from '../config/nav';
import { PERMISSIONS } from '../config/permissions';
import { cn } from '../lib/utils';

const iconMap = {
  LayoutDashboard,
  Users,
  UserCheck,
  Clock,
  FileBarChart,
  Shield,
  CalendarDays,
  Calendar,
  TrendingDown,
  GitCompare,
  Layers,
  Briefcase,
  ClipboardList,
  ListChecks,
  BookOpen,
  FileText,
  Wallet,
  ShieldAlert,
  Receipt,
  Webhook,
  Calculator,
  Puzzle,
  Boxes,
};

function isItemActive(item, pathname, hasFullRoster) {
  if (item.path === '/roster-coverage') {
    return pathname.startsWith('/roster-coverage') && hasFullRoster;
  }
  if (item.path === '/rule-engine') {
    return pathname.startsWith('/rule-engine');
  }
  if (item.path === '/crm') {
    return pathname.startsWith('/crm');
  }
  return pathname === item.path || (item.path !== '/' && pathname.startsWith(`${item.path}/`));
}

export function Sidebar({ mobileOpen = false, onMobileOpenChange }) {
  const location = useLocation();
  const { user } = useAuthStore();
  const collapsed = useUiPreferencesStore((s) => s.sidebarCollapsed);
  const sidebarOpenGroups = useUiPreferencesStore((s) => s.sidebarOpenGroups);
  const toggleSidebarCollapsed = useUiPreferencesStore((s) => s.toggleSidebarCollapsed);
  const toggleOpenGroup = useUiPreferencesStore((s) => s.toggleOpenGroup);
  const ensureOpenGroup = useUiPreferencesStore((s) => s.ensureOpenGroup);
  const setOpenGroups = useUiPreferencesStore((s) => s.setOpenGroups);

  const setMobileOpen = (open) => onMobileOpenChange?.(open);

  const permissions = user?.permissions ?? [];
  const navGroups = getNavGroupsForPermissions(permissions);
  const hasFullRoster = permissions.includes(PERMISSIONS.ROSTER_VIEW);

  // Published custom modules → dynamic "Modules" group (view permission gates the query).
  const canSeeModules = permissions.includes(PERMISSIONS.CUSTOM_MODULES_VIEW);
  const { data: customModules = [] } = useCustomModules();
  const publishedCustomModules = canSeeModules
    ? customModules.filter((m) => m.status === 'published')
    : [];
  const navGroupsWithModules = publishedCustomModules.length
    ? [
        ...navGroups,
        {
          id: 'custom-modules',
          label: 'Modules',
          items: publishedCustomModules.map((m) => ({
            path: `/m/${m.slug}`,
            label: m.name,
            icon: iconMap[m.icon] ? m.icon : 'Puzzle',
          })),
        },
      ]
    : navGroups;

  useEffect(() => {
    if (sidebarOpenGroups.length === 0 && navGroupsWithModules.length > 0) {
      setOpenGroups(navGroupsWithModules.map((group) => group.id));
    }
  }, [navGroupsWithModules, sidebarOpenGroups.length, setOpenGroups]);

  useEffect(() => {
    const activeGroup = navGroups.find((group) =>
      group.items.some((item) => isItemActive(item, location.pathname, hasFullRoster))
    );
    if (activeGroup) {
      ensureOpenGroup(activeGroup.id);
    }
  }, [location.pathname, navGroups, hasFullRoster, ensureOpenGroup]);

  const toggleGroup = (groupId) => {
    toggleOpenGroup(groupId);
  };

  const sidebarContent = (
    <>
      <div className="flex h-14 shrink-0 items-center gap-2.5 border-b border-sidebar-border px-4">
        <span
          className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-sidebar-primary text-sm font-bold text-sidebar-primary-foreground"
          title="Kangaroo Care"
        >
          KC
        </span>
        {!collapsed && (
          <span className="flex min-w-0 flex-col leading-tight">
            <span className="truncate text-sm font-semibold text-sidebar-accent-foreground">
              Kangaroo Care
            </span>
            <span className="truncate text-2xs text-sidebar-foreground/60">
              Workforce console
            </span>
          </span>
        )}
      </div>
      <nav className="flex flex-1 flex-col gap-0.5 overflow-y-auto p-2">
        {navGroupsWithModules.map((group) => {
          const isSingleItem = group.items.length === 1 && group.id === 'overview';
          const open = collapsed || isSingleItem || sidebarOpenGroups.includes(group.id);
          return (
            <div key={group.id} className="flex flex-col">
              {!collapsed && !isSingleItem && (
                <button
                  type="button"
                  onClick={() => toggleGroup(group.id)}
                  className="mt-1.5 flex items-center justify-between rounded-md px-3 py-1 text-left text-2xs font-semibold uppercase tracking-wider text-sidebar-foreground/50 hover:text-sidebar-foreground"
                >
                  <span>{group.label}</span>
                  <ChevronDown className={cn('h-3.5 w-3.5 transition-transform', !open && '-rotate-90')} />
                </button>
              )}
              {open && (
                <div className="flex flex-col gap-0.5">
                  {group.items.map((item) => {
                    const Icon = iconMap[item.icon];
                    const isActive = isItemActive(item, location.pathname, hasFullRoster);
                    return (
                      <Link
                        key={item.path}
                        to={item.path}
                        onClick={() => setMobileOpen(false)}
                        title={collapsed ? item.label : undefined}
                        className={cn(
                          'relative flex items-center gap-2.5 rounded-md px-3 py-1.5 text-2sm font-medium transition-colors',
                          isActive
                            ? 'bg-sidebar-primary text-sidebar-primary-foreground before:absolute before:inset-y-1 before:left-0 before:w-0.5 before:rounded-full before:bg-sidebar-primary-foreground'
                            : 'text-sidebar-foreground/80 hover:bg-sidebar-accent hover:text-sidebar-accent-foreground'
                        )}
                      >
                        {Icon && <Icon className="h-4 w-4 shrink-0" />}
                        {!collapsed && <span className="truncate">{item.label}</span>}
                      </Link>
                    );
                  })}
                </div>
              )}
            </div>
          );
        })}
      </nav>
      <div className="shrink-0 border-t border-sidebar-border p-2">
        <button
          type="button"
          onClick={toggleSidebarCollapsed}
          className={cn(
            'flex w-full items-center justify-center rounded-md p-2 text-sidebar-foreground/60 hover:bg-sidebar-accent hover:text-sidebar-accent-foreground',
            !collapsed && 'justify-end'
          )}
          title={collapsed ? 'Expand sidebar' : 'Collapse sidebar'}
          aria-label={collapsed ? 'Expand sidebar' : 'Collapse sidebar'}
        >
          {collapsed ? (
            <ChevronRight className="h-4 w-4" />
          ) : (
            <ChevronLeft className="h-4 w-4" />
          )}
        </button>
      </div>
    </>
  );

  return (
    <>
      {/* Mobile overlay */}
      {mobileOpen && (
        <div
          className="fixed inset-0 z-40 bg-black/50 md:hidden"
          onClick={() => setMobileOpen(false)}
          aria-hidden
        />
      )}

      {/* Desktop sidebar */}
      <aside
        className={cn(
          'fixed left-0 top-0 z-30 hidden h-screen flex-col border-r border-sidebar-border bg-sidebar transition-[width] duration-200 md:flex',
          collapsed ? 'w-[72px]' : 'w-64'
        )}
      >
        {sidebarContent}
      </aside>

      {/* Mobile drawer */}
      <aside
        className={cn(
          'fixed left-0 top-0 z-40 flex h-screen w-64 flex-col border-r border-sidebar-border bg-sidebar transition-transform duration-200 md:hidden',
          mobileOpen ? 'translate-x-0' : '-translate-x-full'
        )}
      >
        {sidebarContent}
      </aside>
    </>
  );
}
