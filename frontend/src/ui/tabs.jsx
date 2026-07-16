import * as React from 'react';
import { Tabs as TabsPrimitive } from 'radix-ui';
import { NavLink } from 'react-router-dom';
import { cn } from '../lib/utils';

const Tabs = TabsPrimitive.Root;

const TabsList = React.forwardRef(({ className, ...props }, ref) => (
  <TabsPrimitive.List
    ref={ref}
    className={cn('flex flex-wrap items-center gap-1 border-b border-border', className)}
    {...props}
  />
));
TabsList.displayName = TabsPrimitive.List.displayName;

const tabTriggerClass =
  'relative px-3 py-1.5 text-sm font-medium text-muted-foreground outline-none transition-colors hover:text-foreground focus-visible:text-foreground disabled:pointer-events-none disabled:opacity-50 data-[state=active]:text-foreground data-[state=active]:after:absolute data-[state=active]:after:inset-x-1 data-[state=active]:after:-bottom-px data-[state=active]:after:h-0.5 data-[state=active]:after:rounded-full data-[state=active]:after:bg-primary';

const TabsTrigger = React.forwardRef(({ className, ...props }, ref) => (
  <TabsPrimitive.Trigger ref={ref} className={cn(tabTriggerClass, className)} {...props} />
));
TabsTrigger.displayName = TabsPrimitive.Trigger.displayName;

const TabsContent = React.forwardRef(({ className, ...props }, ref) => (
  <TabsPrimitive.Content
    ref={ref}
    className={cn('mt-4 outline-none', className)}
    {...props}
  />
));
TabsContent.displayName = TabsPrimitive.Content.displayName;

function TabNav({ className, children, ...props }) {
  return (
    <div className={cn('flex flex-wrap items-center gap-1 border-b border-border', className)} {...props}>
      {children}
    </div>
  );
}

const TabNavLink = React.forwardRef(({ className, ...props }, ref) => (
  <NavLink
    ref={ref}
    className={({ isActive }) => cn(tabTriggerClass, isActive && 'text-foreground after:absolute after:inset-x-1 after:-bottom-px after:h-0.5 after:rounded-full after:bg-primary', className)}
    {...props}
  />
));
TabNavLink.displayName = 'TabNavLink';

export { Tabs, TabsList, TabsTrigger, TabsContent, TabNav, TabNavLink };
