const MAX_SHIFT_HOURS = 16;

function minutesBetween(start, end) {
  if (!start || !end) return 0;
  const ms = new Date(end).getTime() - new Date(start).getTime();
  return Math.max(0, Math.round(ms / 60000));
}

function isApprovedTimesheet(ts) {
  const status = (ts.status || '').toLowerCase();
  return ts.approved === true || ts.is_approved === true || status === 'approved';
}

function timesheetMinutes(ts) {
  if (ts.total_minutes != null) return Number(ts.total_minutes);
  if (ts.duration_minutes != null) return Number(ts.duration_minutes);
  const items = ts.items || ts.pay_items || [];
  return items.reduce((sum, item) => {
    if (item.amount != null && typeof item.amount === 'number') return sum + item.amount * 60;
    if (item.minutes != null) return sum + Number(item.minutes);
    return sum;
  }, 0);
}

function timesheetAmount(ts) {
  if (ts.total_amount != null) return Number(ts.total_amount);
  if (ts.amount != null) return Number(ts.amount);
  const items = ts.items || ts.pay_items || [];
  return items.reduce((sum, item) => sum + (Number(item.amount ?? item.total) || 0), 0);
}

function staffKey(ts) {
  const id = ts.staff_id ?? ts.staff?.id;
  const name = ts.staff?.name || ts.staff?.first_name || 'Unknown';
  return id != null ? String(id) : name;
}

function staffLabel(ts) {
  return ts.staff?.name || ts.staff?.first_name || ts.staffName || 'Unknown';
}

export function aggregateTimesheetKpis(timesheets = []) {
  let totalMinutes = 0;
  let approvedMinutes = 0;
  let approvedCount = 0;
  let pendingCount = 0;
  let totalAmount = 0;
  const staffMap = new Map();
  const exceptions = {
    unapproved: [],
    zeroDuration: [],
    noPayItems: [],
    zeroAmount: [],
    longShift: [],
    approvedWithoutApprover: [],
  };

  for (const ts of timesheets) {
    const mins = timesheetMinutes(ts);
    const amount = timesheetAmount(ts);
    const approved = isApprovedTimesheet(ts);
    const payItems = ts.items || ts.pay_items || [];
    const key = staffKey(ts);

    totalMinutes += mins;
    totalAmount += amount;
    if (approved) {
      approvedCount += 1;
      approvedMinutes += mins;
    } else {
      pendingCount += 1;
    }

    if (!staffMap.has(key)) {
      staffMap.set(key, {
        staffId: ts.staff_id ?? ts.staff?.id ?? null,
        staffName: staffLabel(ts),
        records: 0,
        totalMinutes: 0,
        approved: 0,
        pending: 0,
        totalAmount: 0,
      });
    }
    const row = staffMap.get(key);
    row.records += 1;
    row.totalMinutes += mins;
    row.totalAmount += amount;
    if (approved) row.approved += 1;
    else row.pending += 1;

    const exBase = {
      id: ts.id ?? ts.shift_id,
      staffName: staffLabel(ts),
      date: ts.date || ts.start_at,
    };

    if (!approved) exceptions.unapproved.push(exBase);
    if (mins <= 0) exceptions.zeroDuration.push(exBase);
    if (!payItems.length) exceptions.noPayItems.push(exBase);
    if (amount === 0 && payItems.length > 0) exceptions.zeroAmount.push(exBase);
    if (mins > MAX_SHIFT_HOURS * 60) exceptions.longShift.push(exBase);
    if (approved && !ts.approved_at && !ts.approved_by) {
      exceptions.approvedWithoutApprover.push(exBase);
    }
  }

  const staffCount = staffMap.size;
  const approvalRate = timesheets.length
    ? Math.round((approvedCount / timesheets.length) * 100)
    : 0;

  return {
    summary: {
      totalRecords: timesheets.length,
      totalMinutes,
      totalHours: Math.round((totalMinutes / 60) * 10) / 10,
      approvedMinutes,
      approvedHours: Math.round((approvedMinutes / 60) * 10) / 10,
      approvedCount,
      pendingCount,
      approvalRate,
      totalAmount: Math.round(totalAmount * 100) / 100,
      staffCount,
    },
    staffRows: [...staffMap.values()].sort((a, b) => b.totalMinutes - a.totalMinutes),
    exceptions,
    exceptionCounts: {
      unapproved: exceptions.unapproved.length,
      zeroDuration: exceptions.zeroDuration.length,
      noPayItems: exceptions.noPayItems.length,
      zeroAmount: exceptions.zeroAmount.length,
      longShift: exceptions.longShift.length,
      approvedWithoutApprover: exceptions.approvedWithoutApprover.length,
      total:
        exceptions.unapproved.length +
        exceptions.zeroDuration.length +
        exceptions.noPayItems.length +
        exceptions.zeroAmount.length +
        exceptions.longShift.length +
        exceptions.approvedWithoutApprover.length,
    },
  };
}

export function aggregateShiftKpis(shifts = []) {
  let approved = 0;
  let unapproved = 0;
  let cancelled = 0;
  let unassigned = 0;
  let clockVarianceCount = 0;
  let incompleteTasks = 0;
  let totalTasks = 0;
  const exceptions = {
    unapproved: [],
    unassigned: [],
    cancelled: [],
    clockVariance: [],
    incompleteTasks: [],
  };

  for (const shift of shifts) {
    const base = {
      id: shift.id,
      startAt: shift.start_at,
      endAt: shift.end_at,
    };

    if (shift.cancelled_at) {
      cancelled += 1;
      exceptions.cancelled.push({ ...base, reason: shift.cancelled_reason });
      continue;
    }

    if (shift.is_approved) approved += 1;
    else {
      unapproved += 1;
      exceptions.unapproved.push(base);
    }

    const staffList = shift.staff || [];
    if (!staffList.length) {
      unassigned += 1;
      exceptions.unassigned.push(base);
    }

    for (const s of staffList) {
      if (s.clockin_at && shift.start_at) {
        const varMins = Math.abs(minutesBetween(shift.start_at, s.clockin_at));
        if (varMins > 15) {
          clockVarianceCount += 1;
          exceptions.clockVariance.push({
            ...base,
            staffName: s.name,
            scheduledStart: shift.start_at,
            clockIn: s.clockin_at,
            varianceMinutes: varMins,
          });
          break;
        }
      }
    }

    for (const task of shift.tasks || []) {
      totalTasks += 1;
      if (task.mandatory && !task.completed_at) {
        incompleteTasks += 1;
        exceptions.incompleteTasks.push({
          ...base,
          taskId: task.id,
          description: task.description,
        });
      }
    }
  }

  return {
    summary: {
      totalShifts: shifts.length,
      approved,
      unapproved,
      cancelled,
      unassigned,
      clockVarianceCount,
      incompleteTasks,
      totalTasks,
    },
    exceptions,
    exceptionCounts: {
      unapproved: exceptions.unapproved.length,
      unassigned: exceptions.unassigned.length,
      cancelled: exceptions.cancelled.length,
      clockVariance: exceptions.clockVariance.length,
      incompleteTasks: exceptions.incompleteTasks.length,
      total:
        exceptions.unapproved.length +
        exceptions.unassigned.length +
        exceptions.cancelled.length +
        exceptions.clockVariance.length +
        exceptions.incompleteTasks.length,
    },
  };
}

export function buildShiftCareKpis(timesheets, shifts) {
  const timesheetKpis = aggregateTimesheetKpis(timesheets);
  const shiftKpis = aggregateShiftKpis(shifts);
  return {
    timesheets: timesheetKpis,
    shifts: shiftKpis,
    generatedAt: new Date().toISOString(),
  };
}
