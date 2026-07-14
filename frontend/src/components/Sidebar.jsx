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
import { getNavGroupsForPermissions } from '../config/nav';
import { PERMISSIONS } from '../config/permissions';
import { Button } from '../ui/button';
import { cn } from '../lib/utils';

const SIDEBAR_COLLAPSED_KEY = 'sidebar_collapsed';
const SIDEBAR_OPEN_GROUPS_KEY = 'sidebar_open_groups';

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

function loadOpenGroups() {
  try {
    const raw = localStorage.getItem(SIDEBAR_OPEN_GROUPS_KEY);
    return raw ? new Set(JSON.parse(raw)) : null;
  } catch {
    return null;
  }
}

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
  const [collapsed, setCollapsed] = useState(() => {
    try {
      return localStorage.getItem(SIDEBAR_COLLAPSED_KEY) === 'true';
    } catch {
      return false;
    }
  });
  const [mobileOpen, setMobileOpen] = useState(false);

  const permissions = user?.permissions ?? [];
  const navGroups = getNavGroupsForPermissions(permissions);
  const hasFullRoster = permissions.includes(PERMISSIONS.ROSTER_VIEW);

  const [openGroups, setOpenGroups] = useState(() => {
    const stored = loadOpenGroups();
    if (stored) return stored;
    // Default: every group open on first visit.
    return new Set(navGroups.map((g) => g.id));
  });

  useEffect(() => {
    try {
      localStorage.setItem(SIDEBAR_COLLAPSED_KEY, String(collapsed));
    } catch {}
  }, [collapsed]);

  // Auto-expand whichever group contains the active route.
  useEffect(() => {
    const activeGroup = navGroups.find((group) =>
      group.items.some((item) => isItemActive(item, location.pathname, hasFullRoster))
    );
    if (activeGroup && !openGroups.has(activeGroup.id)) {
      setOpenGroups((prev) => {
        const next = new Set(prev);
        next.add(activeGroup.id);
        try {
          localStorage.setItem(SIDEBAR_OPEN_GROUPS_KEY, JSON.stringify([...next]));
        } catch {}
        return next;
      });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [location.pathname]);

  const toggleGroup = (groupId) => {
    setOpenGroups((prev) => {
      const next = new Set(prev);
      if (next.has(groupId)) next.delete(groupId);
      else next.add(groupId);
      try {
        localStorage.setItem(SIDEBAR_OPEN_GROUPS_KEY, JSON.stringify([...next]));
      } catch {}
      return next;
    });
  };

  const handleLogout = async () => {
    setMobileOpen(false);
    await logout();
    navigate('/');
  };

  const sidebarContent = (
    <>
      <div className="flex h-14 items-center border-b px-4">
        {!collapsed && (
          <span className="text-lg font-semibold">ShiftCare Viewer</span>
        )}
        {collapsed && (
          <span className="text-lg font-semibold" title="ShiftCare Viewer">
            S
          </span>
        )}
      </div>
      <nav className="flex flex-1 flex-col gap-1 overflow-y-auto p-2">
        {navGroups.map((group) => {
          const isSingleItem = group.items.length === 1 && group.id === 'overview';
          const open = collapsed || isSingleItem || openGroups.has(group.id);
          return (
            <div key={group.id} className="flex flex-col">
              {!collapsed && !isSingleItem && (
                <button
                  type="button"
                  onClick={() => toggleGroup(group.id)}
                  className="flex items-center justify-between rounded-md px-3 py-1.5 text-left text-[11px] font-semibold uppercase tracking-wide text-muted-foreground hover:text-foreground"
                >
                  <span>{group.label}</span>
                  <ChevronDown className={cn('h-3.5 w-3.5 transition-transform', !open && '-rotate-90')} />
                </button>
              )}
              {open && (
                <div className="flex flex-col gap-1">
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
                          'flex items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium transition-colors',
                          isActive
                            ? 'bg-primary text-primary-foreground'
                            : 'text-muted-foreground hover:bg-accent hover:text-foreground'
                        )}
                      >
                        {Icon && <Icon className="h-5 w-5 shrink-0" />}
                        {!collapsed && <span>{item.label}</span>}
                      </Link>
                    );
                  })}
                </div>
              )}
            </div>
          );
        })}
      </nav>
      <div className="border-t p-2">
        {!collapsed && user && (
          <div className="mb-2 px-3 py-2 text-xs text-muted-foreground">
            <div className="truncate font-medium text-foreground">
              {user.name || user.email}
            </div>
            <div className="truncate">{user.email}</div>
            <div className="capitalize">{user.role?.replace('_', ' ')}</div>
          </div>
        )}
        <Button
          variant="ghost"
          size="sm"
          className="w-full justify-start gap-3"
          onClick={handleLogout}
          title={collapsed ? 'Logout' : undefined}
        >
          <LogOut className="h-5 w-5 shrink-0" />
          {!collapsed && <span>Logout</span>}
        </Button>
        <button
          type="button"
          onClick={() => {
            const next = !collapsed;
            setCollapsed(next);
            window.dispatchEvent(new CustomEvent('sidebar-toggle', { detail: { collapsed: next } }));
          }}
          className="mt-2 flex w-full items-center justify-center rounded-lg p-2 text-muted-foreground hover:bg-accent hover:text-foreground"
          title={collapsed ? 'Expand sidebar' : 'Collapse sidebar'}
          aria-label={collapsed ? 'Expand sidebar' : 'Collapse sidebar'}
        >
          {collapsed ? (
            <ChevronRight className="h-5 w-5" />
          ) : (
            <ChevronLeft className="h-5 w-5" />
          )}
        </button>
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
          'fixed left-0 top-0 z-30 hidden h-screen flex-col border-r bg-background transition-[width] duration-200 md:flex',
          collapsed ? 'w-[72px]' : 'w-64'
        )}
      >
        {sidebarContent}
      </aside>

      {/* Mobile drawer */}
      <aside
        className={cn(
          'fixed left-0 top-0 z-40 flex h-screen w-64 flex-col border-r bg-background transition-transform duration-200 md:hidden',
          mobileOpen ? 'translate-x-0' : '-translate-x-full'
        )}
      >
        {sidebarContent}
      </aside>
    </>
  );
}
