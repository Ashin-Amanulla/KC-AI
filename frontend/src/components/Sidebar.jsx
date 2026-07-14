import { useState, useEffect } from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
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
  Menu,
  LogOut,
  Calculator,
  CalendarDays,
  Calendar,
  TrendingDown,
  GitCompare,
  Layers,
  Briefcase,
  ClipboardList,
  ListChecks,
  BookOpen,
  FlaskConical,
  DollarSign,
} from 'lucide-react';
import { useAuthStore } from '../store/auth';
import { useUiPreferencesStore } from '../store/uiPreferences';
import { getNavGroupsForPermissions } from '../config/nav';
import { PERMISSIONS } from '../config/permissions';
import { Button } from '../ui/button';
import { cn } from '../lib/utils';

const iconMap = {
  LayoutDashboard,
  Users,
  UserCheck,
  Clock,
  FileBarChart,
  Shield,
  Calculator,
  CalendarDays,
  Calendar,
  TrendingDown,
  GitCompare,
  Layers,
  Briefcase,
  ClipboardList,
  ListChecks,
  BookOpen,
  FlaskConical,
  DollarSign,
};

function isItemActive(item, pathname, hasFullRoster) {
  if (item.path === '/roster-coverage') {
    return pathname.startsWith('/roster-coverage') && hasFullRoster;
  }
  if (item.path === '/rule-engine') {
    return pathname === '/rule-engine';
  }
  return pathname === item.path || (item.path !== '/' && pathname.startsWith(`${item.path}/`));
}

export function Sidebar() {
  const location = useLocation();
  const navigate = useNavigate();
  const { user, logout } = useAuthStore();
  const collapsed = useUiPreferencesStore((s) => s.sidebarCollapsed);
  const sidebarOpenGroups = useUiPreferencesStore((s) => s.sidebarOpenGroups);
  const toggleSidebarCollapsed = useUiPreferencesStore((s) => s.toggleSidebarCollapsed);
  const toggleOpenGroup = useUiPreferencesStore((s) => s.toggleOpenGroup);
  const ensureOpenGroup = useUiPreferencesStore((s) => s.ensureOpenGroup);
  const setOpenGroups = useUiPreferencesStore((s) => s.setOpenGroups);
  const [mobileOpen, setMobileOpen] = useState(false);

  const permissions = user?.permissions ?? [];
  const navGroups = getNavGroupsForPermissions(permissions);
  const hasFullRoster = permissions.includes(PERMISSIONS.ROSTER_VIEW);

  useEffect(() => {
    if (sidebarOpenGroups.length === 0 && navGroups.length > 0) {
      setOpenGroups(navGroups.map((group) => group.id));
    }
  }, [navGroups, sidebarOpenGroups.length, setOpenGroups]);

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

  const handleLogout = async () => {
    setMobileOpen(false);
    await logout();
    navigate('/');
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
            <span className="truncate text-[11px] text-sidebar-foreground/60">
              Workforce console
            </span>
          </span>
        )}
      </div>
      <nav className="flex flex-1 flex-col gap-0.5 overflow-y-auto p-2">
        {navGroups.map((group) => {
          const isSingleItem = group.items.length === 1 && group.id === 'overview';
          const open = collapsed || isSingleItem || sidebarOpenGroups.includes(group.id);
          return (
            <div key={group.id} className="flex flex-col">
              {!collapsed && !isSingleItem && (
                <button
                  type="button"
                  onClick={() => toggleGroup(group.id)}
                  className="mt-1.5 flex items-center justify-between rounded-md px-3 py-1 text-left text-[10.5px] font-semibold uppercase tracking-wider text-sidebar-foreground/50 hover:text-sidebar-foreground"
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
                          'flex items-center gap-2.5 rounded-md px-3 py-1.5 text-[13px] font-medium transition-colors',
                          isActive
                            ? 'bg-sidebar-primary text-sidebar-primary-foreground'
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
        {!collapsed && user && (
          <div className="mb-1 px-3 py-1.5 text-[11px] text-sidebar-foreground/60">
            <div className="truncate text-xs font-medium text-sidebar-accent-foreground">
              {user.name || user.email}
            </div>
            <div className="truncate">{user.email}</div>
          </div>
        )}
        <div className="flex items-center gap-1">
          <Button
            variant="ghost"
            size="sm"
            className="flex-1 justify-start gap-2.5 text-sidebar-foreground/80 hover:bg-sidebar-accent hover:text-sidebar-accent-foreground"
            onClick={handleLogout}
            title={collapsed ? 'Logout' : undefined}
          >
            <LogOut className="h-4 w-4 shrink-0" />
            {!collapsed && <span>Logout</span>}
          </Button>
          <button
            type="button"
            onClick={toggleSidebarCollapsed}
            className="flex items-center justify-center rounded-md p-2 text-sidebar-foreground/60 hover:bg-sidebar-accent hover:text-sidebar-accent-foreground"
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
      </div>
    </>
  );

  return (
    <>
      {/* Mobile menu button */}
      <button
        type="button"
        className="fixed left-4 top-4 z-50 rounded-lg p-2 md:hidden"
        onClick={() => setMobileOpen(true)}
        aria-label="Open menu"
      >
        <Menu className="h-6 w-6" />
      </button>

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
