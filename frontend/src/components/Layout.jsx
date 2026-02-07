import { useState, useEffect } from 'react';
import { Sidebar } from './Sidebar';
import { cn } from '../lib/utils';

const SIDEBAR_COLLAPSED_KEY = 'sidebar_collapsed';

export const Layout = ({ children }) => {
  const [sidebarWidth, setSidebarWidth] = useState(256); // w-64 = 16rem = 256px

  useEffect(() => {
    const getWidth = () => {
      try {
        return localStorage.getItem(SIDEBAR_COLLAPSED_KEY) === 'true' ? 72 : 256;
      } catch {
        return 256;
      }
    };
    setSidebarWidth(getWidth());
    const handleStorage = () => setSidebarWidth(getWidth());
    window.addEventListener('storage', handleStorage);
    return () => window.removeEventListener('storage', handleStorage);
  }, []);

  // Sync width when sidebar toggle happens (same tab)
  useEffect(() => {
    const handler = (e) => setSidebarWidth(e.detail?.collapsed ? 72 : 256);
    window.addEventListener('sidebar-toggle', handler);
    return () => window.removeEventListener('sidebar-toggle', handler);
  }, []);

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
        <div className="container mx-auto px-4 py-6 md:px-6 md:py-8">
          {children}
        </div>
      </main>
    </div>
  );
};
