import { useState } from 'react';
import { Sidebar } from './Sidebar';
import { TopBar, TOP_BAR_HEIGHT } from './TopBar';
import { cn } from '../lib/utils';
import { selectSidebarWidth, useUiPreferencesStore } from '../store/uiPreferences';
import { TooltipProvider } from '../ui/tooltip';
import { useTheme } from '../hooks/useTheme';

export const Layout = ({ children }) => {
  useTheme();
  const sidebarCollapsed = useUiPreferencesStore((s) => s.sidebarCollapsed);
  const sidebarWidth = selectSidebarWidth(sidebarCollapsed);
  const [mobileOpen, setMobileOpen] = useState(false);

  return (
    <TooltipProvider delayDuration={300}>
      <div className="min-h-screen bg-background">
        <Sidebar mobileOpen={mobileOpen} onMobileOpenChange={setMobileOpen} />
        <TopBar
          onOpenMobileMenu={() => setMobileOpen(true)}
          sidebarWidth={sidebarWidth}
        />
        <main
          className={cn(
            'min-h-screen transition-[margin] duration-200',
            'md:ml-[var(--sidebar-width)]'
          )}
          style={{
            '--sidebar-width': `${sidebarWidth}px`,
            paddingTop: `${TOP_BAR_HEIGHT}px`,
          }}
        >
          <div className="w-full px-4 py-4 md:px-5 md:py-5">{children}</div>
        </main>
      </div>
    </TooltipProvider>
  );
};
