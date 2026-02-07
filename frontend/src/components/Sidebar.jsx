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
  Menu,
  LogOut,
} from 'lucide-react';
import { useAuthStore } from '../store/auth';
import { getNavItemsForRole } from '../config/nav';
import { Button } from '../ui/button';
import { cn } from '../lib/utils';

const SIDEBAR_COLLAPSED_KEY = 'sidebar_collapsed';

const iconMap = {
  LayoutDashboard,
  Users,
  UserCheck,
  Clock,
  FileBarChart,
  Shield,
};

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

  useEffect(() => {
    try {
      localStorage.setItem(SIDEBAR_COLLAPSED_KEY, String(collapsed));
    } catch {}
  }, [collapsed]);

  const role = user?.role || 'viewer';
  const navItems = getNavItemsForRole(role);

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
      <nav className="flex flex-1 flex-col gap-1 p-2">
        {navItems.map((item) => {
          const Icon = iconMap[item.icon];
          const isActive = location.pathname === item.path;
          const link = (
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
          return link;
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
