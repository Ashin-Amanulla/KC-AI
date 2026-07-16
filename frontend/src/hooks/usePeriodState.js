import { useMemo, useState } from 'react';
import { getPeriodWindow, toTimesheetRange } from '../utils/fortnight';

export function usePeriodState(defaultMode = 'fortnight') {
  const [mode, setMode] = useState(defaultMode);
  const [customFrom, setCustomFrom] = useState(() => getPeriodWindow('fortnight').fromDate);
  const [customTo, setCustomTo] = useState(() => getPeriodWindow('fortnight').toDate);

  const period = useMemo(
    () => getPeriodWindow(mode, { customFrom, customTo }),
    [mode, customFrom, customTo]
  );

  const range = useMemo(
    () => toTimesheetRange(period.fromDate, period.toDate),
    [period.fromDate, period.toDate]
  );

  return {
    mode,
    setMode,
    customFrom,
    setCustomFrom,
    customTo,
    setCustomTo,
    period,
    range,
  };
}
