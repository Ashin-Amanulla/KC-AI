import { Sidebar } from './Sidebar';
import { cn } from '../lib/utils';
import { selectSidebarWidth, useUiPreferencesStore } from '../store/uiPreferences';

export const Layout = ({ children }) => {
  const sidebarCollapsed = useUiPreferencesStore((s) => s.sidebarCollapsed);
  const sidebarWidth = selectSidebarWidth(sidebarCollapsed);

  return (
    <div className="min-h-screen bg-background">
      <Sidebar />
      <main
        className={cn(
          'min-h-screen transition-[margin] duration-200',
          'pt-14 md:pt-0 md:ml-[var(--sidebar-width)]'
        )}
        style={{ '--sidebar-width': `${sidebarWidth}px` }}
      >
        <div className="w-full px-4 py-4 md:px-5 md:py-5">{children}</div>
      </main>
    </div>
  );
};
