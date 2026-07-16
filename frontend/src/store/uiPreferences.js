import { create } from 'zustand';
import { persist } from 'zustand/middleware';

const LEGACY_COLLAPSED_KEY = 'sidebar_collapsed';
const LEGACY_OPEN_GROUPS_KEY = 'sidebar_open_groups';

function readLegacyPrefs() {
  try {
    if (localStorage.getItem('ui-preferences')) return null;

    const sidebarCollapsed = localStorage.getItem(LEGACY_COLLAPSED_KEY) === 'true';
    const raw = localStorage.getItem(LEGACY_OPEN_GROUPS_KEY);
    const sidebarOpenGroups = raw ? JSON.parse(raw) : [];

    return { sidebarCollapsed, sidebarOpenGroups };
  } catch {
    return null;
  }
}

const legacyPrefs = typeof window !== 'undefined' ? readLegacyPrefs() : null;

export function resolveTheme(theme) {
  if (theme === 'system') {
    if (typeof window !== 'undefined') {
      return window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
    }
    return 'dark';
  }
  return theme === 'light' ? 'light' : 'dark';
}

export const useUiPreferencesStore = create(
  persist(
    (set) => ({
      theme: 'dark',
      sidebarCollapsed: legacyPrefs?.sidebarCollapsed ?? false,
      sidebarOpenGroups: legacyPrefs?.sidebarOpenGroups ?? [],

      setTheme: (theme) => set({ theme }),

      setSidebarCollapsed: (sidebarCollapsed) => set({ sidebarCollapsed }),

      toggleSidebarCollapsed: () =>
        set((state) => ({ sidebarCollapsed: !state.sidebarCollapsed })),

      setOpenGroups: (sidebarOpenGroups) =>
        set({ sidebarOpenGroups: [...sidebarOpenGroups] }),

      toggleOpenGroup: (groupId) =>
        set((state) => {
          const next = new Set(state.sidebarOpenGroups);
          if (next.has(groupId)) next.delete(groupId);
          else next.add(groupId);
          return { sidebarOpenGroups: [...next] };
        }),

      ensureOpenGroup: (groupId) =>
        set((state) => {
          if (state.sidebarOpenGroups.includes(groupId)) return state;
          return { sidebarOpenGroups: [...state.sidebarOpenGroups, groupId] };
        }),
    }),
    {
      name: 'ui-preferences',
      partialize: (state) => ({
        theme: state.theme,
        sidebarCollapsed: state.sidebarCollapsed,
        sidebarOpenGroups: state.sidebarOpenGroups,
      }),
    }
  )
);

export function selectSidebarWidth(collapsed) {
  return collapsed ? 72 : 256;
}
