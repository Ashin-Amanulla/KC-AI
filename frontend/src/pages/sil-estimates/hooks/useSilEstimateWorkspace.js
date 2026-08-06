import { useState, useEffect, useCallback, useRef } from 'react';
import { toast } from 'sonner';
import { useSilEstimate, useUpdateSilEstimate } from '../../../api/silEstimates';
import { getActiveParticipant } from '../../../lib/silEstimate/defaults';
import { getErrorMessage } from '../../../utils/api';

const AUTOSAVE_MS = 1500;

export function useSilEstimateWorkspace(id, { canManage = true } = {}) {
  const { data, isLoading, error, refetch } = useSilEstimate(id);
  const updateM = useUpdateSilEstimate();
  const [workspace, setWorkspace] = useState(null);
  const [saveStatus, setSaveStatus] = useState('saved');
  const saveTimer = useRef(null);
  const pendingRef = useRef(null);

  useEffect(() => {
    if (data?.estimate) {
      setWorkspace(data.estimate);
      setSaveStatus('saved');
    }
  }, [data?.estimate]);

  const scheduleSave = useCallback(
    (next) => {
      if (!canManage) return;
      pendingRef.current = next;
      setSaveStatus('unsaved');
      if (saveTimer.current) clearTimeout(saveTimer.current);
      saveTimer.current = setTimeout(async () => {
        const payload = pendingRef.current;
        if (!payload || !id) return;
        setSaveStatus('saving');
        try {
          const { _id, createdAt, updatedAt, computedSummary, createdBy, ...body } = payload;
          await updateM.mutateAsync({ id, body });
          setSaveStatus('saved');
        } catch (e) {
          setSaveStatus('error');
          toast.error(getErrorMessage(e) || 'Failed to save');
        }
      }, AUTOSAVE_MS);
    },
    [id, updateM, canManage]
  );

  useEffect(() => () => {
    if (saveTimer.current) clearTimeout(saveTimer.current);
  }, []);

  const updateWorkspace = useCallback(
    (updater) => {
      setWorkspace((prev) => {
        if (!prev) return prev;
        const next = typeof updater === 'function' ? updater(prev) : { ...prev, ...updater };
        scheduleSave(next);
        return next;
      });
    },
    [scheduleSave]
  );

  const activeParticipant = workspace ? getActiveParticipant(workspace) : null;

  return {
    workspace,
    setWorkspace: updateWorkspace,
    activeParticipant,
    isLoading,
    error,
    refetch,
    saveStatus,
    isSaving: saveStatus === 'saving',
  };
}
