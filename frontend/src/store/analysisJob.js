import { create } from 'zustand';

const ACTIVE_JOB_KEY = 'analysis_active_job';

const getStoredJobId = () => localStorage.getItem(ACTIVE_JOB_KEY);
const setStoredJobId = (id) => {
  if (id) localStorage.setItem(ACTIVE_JOB_KEY, id);
  else localStorage.removeItem(ACTIVE_JOB_KEY);
};

export const useAnalysisJobStore = create((set, get) => ({
  activeJobId: getStoredJobId(),
  estimatedSeconds: null,
  totalRows: null,

  setActiveJob: (jobId, meta = {}) => {
    setStoredJobId(jobId);
    set({
      activeJobId: jobId,
      estimatedSeconds: meta.estimatedSeconds ?? null,
      totalRows: meta.totalRows ?? null,
    });
  },

  clearActiveJob: () => {
    setStoredJobId(null);
    set({
      activeJobId: null,
      estimatedSeconds: null,
      totalRows: null,
    });
  },

  getActiveJobId: () => get().activeJobId,
}));
