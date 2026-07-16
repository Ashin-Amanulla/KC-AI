import { LogOut, Menu, Monitor, Moon, Sun } from 'lucide-react';
import { useLocation, useNavigate, useSearchParams } from 'react-router-dom';
import { useAuthStore } from '../store/auth';
import { cn } from '../lib/utils';
import { resolvePageContext, userHasFullRoster } from '../lib/pageContext';
import { useTheme } from '../hooks/useTheme';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '../ui/dropdown-menu';
import { Tooltip, TooltipContent, TooltipTrigger } from '../ui/tooltip';

const THEME_OPTIONS = [
  { value: 'system', label: 'System', icon: Monitor },
  { value: 'light', label: 'Light', icon: Sun },
  { value: 'dark', label: 'Dark', icon: Moon },
];

export const TOP_BAR_HEIGHT = 56;

function ThemeToggle() {
  const { theme, setTheme } = useTheme();

  return (
    <div
      className="flex items-center rounded-md border border-border bg-muted/40 p-0.5"
      role="group"
      aria-label="Theme"
    >
      {THEME_OPTIONS.map(({ value, label, icon: Icon }) => (
        <Tooltip key={value}>
          <TooltipTrigger asChild>
            <button
              type="button"
              onClick={() => setTheme(value)}
              className={cn(
                'inline-flex h-8 w-8 items-center justify-center rounded-sm transition-colors',
                theme === value
                  ? 'bg-background text-foreground shadow-xs'
                  : 'text-muted-foreground hover:text-foreground'
              )}
              aria-label={`${label} theme`}
              aria-pressed={theme === value}
            >
              <Icon className="h-4 w-4" />
            </button>
          </TooltipTrigger>
          <TooltipContent side="bottom">{label}</TooltipContent>
        </Tooltip>
      ))}
    </div>
  );
}

function getUserInitials(user) {
  const displayName = user?.name || user?.email || 'User';
  return displayName
    .split(/\s+/)
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase() ?? '')
    .join('');
}

function UserMenu() {
  const navigate = useNavigate();
  const { user, logout } = useAuthStore();

  if (!user) return null;

  const displayName = user.name || user.email || 'User';
  const initials = getUserInitials(user);

  const handleLogout = async () => {
    await logout();
    navigate('/');
  };

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <button
          type="button"
          className="inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-primary/10 text-xs font-semibold text-primary outline-none ring-offset-background transition-colors hover:bg-primary/15 focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
          aria-label="Open user menu"
        >
          {initials || 'U'}
        </button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-56">
        <DropdownMenuLabel className="font-normal">
          <div className="flex flex-col space-y-1">
            <p className="text-sm font-medium leading-none">{displayName}</p>
            {user.email && (
              <p className="text-xs leading-none text-muted-foreground">{user.email}</p>
            )}
          </div>
        </DropdownMenuLabel>
        <DropdownMenuSeparator />
        <DropdownMenuItem
          onClick={handleLogout}
          className="cursor-pointer text-destructive focus:text-destructive"
        >
          <LogOut />
          Logout
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

export function TopBar({ onOpenMobileMenu, sidebarWidth }) {
  const location = useLocation();
  const [searchParams] = useSearchParams();
  const user = useAuthStore((s) => s.user);
  const permissions = user?.permissions ?? [];

  const pageContext = resolvePageContext(location.pathname, searchParams, {
    hasFullRoster: userHasFullRoster(permissions),
  });

  const showSubTitle = pageContext.title !== pageContext.section;

  return (
    <header
      className={cn(
        'fixed top-0 right-0 z-20 flex h-14 items-center gap-3 border-b border-border bg-background/95 px-4 backdrop-blur supports-[backdrop-filter]:bg-background/80',
        'left-0 transition-[left] duration-200 md:left-[var(--sidebar-width)]'
      )}
      style={{ '--sidebar-width': `${sidebarWidth}px` }}
    >
      <button
        type="button"
        className="inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-md text-foreground hover:bg-accent md:hidden"
        onClick={onOpenMobileMenu}
        aria-label="Open menu"
      >
        <Menu className="h-5 w-5" />
      </button>

      <div className="min-w-0 flex-1">
        {pageContext.group && (
          <p className="truncate text-2xs font-medium uppercase tracking-wide text-muted-foreground">
            {pageContext.group}
          </p>
        )}
        <div className="flex min-w-0 items-center gap-2">
          <h1 className="truncate text-sm font-semibold text-foreground md:text-base">
            {pageContext.section}
          </h1>
          {showSubTitle && (
            <>
              <span className="text-muted-foreground/60" aria-hidden>
                /
              </span>
              <p className="truncate text-sm text-muted-foreground">{pageContext.title}</p>
            </>
          )}
        </div>
      </div>

      <ThemeToggle />
      <UserMenu />
    </header>
  );
}
