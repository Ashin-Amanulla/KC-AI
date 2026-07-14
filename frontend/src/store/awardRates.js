import { create } from 'zustand';
import api from '../utils/api';
import { applyAwardConstants } from '../lib/schadsWageCalc';

/**
 * Effective-dated SCHADS award constants, hydrated once at app boot from
 * GET /award-rates/effective. On success the resolved constants are pushed
 * into lib/schadsWageCalc so every wage calculation and display uses the
 * rate set that applies today instead of hardcoded values.
 */
export const useAwardRatesStore = create((set, get) => ({
  constants: null,
  setLabel: null,
  status: null, // 'active' | 'draft' | 'needs-verification'
  isFallback: true, // true until hydrated from a real rate set
  hydrated: false,
  error: null,

  hydrate: async () => {
    if (get().hydrated) return;
    try {
      const { data } = await api.get('/api/award-rates/effective');
      applyAwardConstants(data.constants);
      set({
        constants: data.constants,
        setLabel: data.setLabel,
        status: data.status || null,
        isFallback: !!data.isFallback,
        hydrated: true,
        error: null,
      });
    } catch (err) {
      // Keep hardcoded fallbacks; surface the miss so pages can warn.
      set({ hydrated: true, isFallback: true, error: err?.message || 'Failed to load award rates' });
    }
  },
}));
