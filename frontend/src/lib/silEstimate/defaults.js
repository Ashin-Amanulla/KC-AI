import { defaultRates, defaultOldRates } from './constants.js';
import { loadHolidaysForState } from './holidays.js';

let blockUid = 1;
let templateUid = 1;
let segUid = 1;

export const nextBlockId = () => blockUid++;
export const nextTemplateId = () => `tmpl_${templateUid++}`;
export const nextSegId = () => segUid++;

export function resetIdCounters() {
  blockUid = 1;
  templateUid = 1;
  segUid = 1;
}

export function defaultDayBlocks(dayName) {
  if (dayName === 'Sat') {
    return [
      {
        id: nextBlockId(),
        label: 'Personal Care',
        period: 'AM',
        intensity: 'High Intensity',
        hours: 4,
        mode: 'time',
        startTime: '06:00',
        endTime: '10:00',
        ratio: '1:2',
        customW: 1,
        customP: 2,
      },
      {
        id: nextBlockId(),
        label: 'Personal Care',
        period: 'PM',
        intensity: 'High Intensity',
        hours: 8,
        mode: 'time',
        startTime: '14:00',
        endTime: '22:00',
        ratio: '1:2',
        customW: 1,
        customP: 2,
      },
      {
        id: nextBlockId(),
        label: 'Night-Time Sleepover',
        period: 'Sleepover',
        intensity: 'High Intensity',
        hours: 8,
        mode: 'time',
        startTime: '22:00',
        endTime: '06:00',
        ratio: '1:2',
        customW: 1,
        customP: 2,
      },
    ];
  }
  if (dayName === 'Sun') {
    return [
      {
        id: nextBlockId(),
        label: 'Personal Care',
        period: 'AM',
        intensity: 'High Intensity',
        hours: 4,
        mode: 'time',
        startTime: '06:00',
        endTime: '10:00',
        ratio: '1:2',
        customW: 1,
        customP: 2,
      },
      {
        id: nextBlockId(),
        label: 'Personal Care',
        period: 'PM',
        intensity: 'High Intensity',
        hours: 4,
        mode: 'time',
        startTime: '10:00',
        endTime: '14:00',
        ratio: '1:1',
        customW: 1,
        customP: 1,
      },
      {
        id: nextBlockId(),
        label: 'Personal Care',
        period: 'PM',
        intensity: 'High Intensity',
        hours: 8,
        mode: 'time',
        startTime: '14:00',
        endTime: '22:00',
        ratio: '1:2',
        customW: 1,
        customP: 2,
      },
      {
        id: nextBlockId(),
        label: 'Night-Time Sleepover',
        period: 'Sleepover',
        intensity: 'High Intensity',
        hours: 8,
        mode: 'time',
        startTime: '22:00',
        endTime: '06:00',
        ratio: '1:2',
        customW: 1,
        customP: 2,
      },
    ];
  }
  return [
    {
      id: nextBlockId(),
      label: 'Personal Care',
      period: 'AM',
      intensity: 'High Intensity',
      hours: 4,
      mode: 'time',
      startTime: '06:00',
      endTime: '10:00',
      ratio: '1:2',
      customW: 1,
      customP: 2,
    },
    {
      id: nextBlockId(),
      label: 'Personal Care',
      period: 'PM',
      intensity: 'High Intensity',
      hours: 2,
      mode: 'time',
      startTime: '14:00',
      endTime: '16:00',
      ratio: '1:1',
      customW: 1,
      customP: 1,
    },
    {
      id: nextBlockId(),
      label: 'Personal Care',
      period: 'PM',
      intensity: 'High Intensity',
      hours: 6,
      mode: 'time',
      startTime: '16:00',
      endTime: '22:00',
      ratio: '1:2',
      customW: 1,
      customP: 2,
    },
    {
      id: nextBlockId(),
      label: 'Night-Time Sleepover',
      period: 'Sleepover',
      intensity: 'High Intensity',
      hours: 8,
      mode: 'time',
      startTime: '22:00',
      endTime: '06:00',
      ratio: '1:2',
      customW: 1,
      customP: 2,
    },
  ];
}

export function buildDefaultSchedule() {
  const s = {};
  ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'].forEach((d) => {
    s[d] = defaultDayBlocks(d);
  });
  return s;
}

export function cloneBlocks(blocks) {
  return (blocks || []).map((b) => ({ ...b, id: nextBlockId() }));
}

const DEFAULT_PLAN_START = '2026-07-01';
const DEFAULT_PLAN_END = '2027-06-30';

export function createDefaultParticipant(name = 'Participant 1') {
  const templateId = nextTemplateId();
  const segId = nextSegId();
  return {
    participant: {
      name,
      budget: 0,
      planStart: DEFAULT_PLAN_START,
      planEnd: DEFAULT_PLAN_END,
      activeTemplateId: templateId,
      segments: [
        {
          id: segId,
          label: 'Whole plan period',
          start: DEFAULT_PLAN_START,
          end: DEFAULT_PLAN_END,
          templateId,
        },
      ],
    },
    template: {
      id: templateId,
      name: `${name} — Roster`,
      schedule: buildDefaultSchedule(),
    },
  };
}

export function createEmptyWorkspace(name = 'New SIL estimate') {
  resetIdCounters();
  const { participant, template } = createDefaultParticipant();
  return {
    name,
    state: 'QLD',
    ratesNew: defaultRates(),
    ratesOld: defaultOldRates(),
    oldRatesConfirmed: true,
    holidays: loadHolidaysForState('QLD'),
    templates: { [template.id]: template },
    participants: [participant],
    activeParticipantName: participant.name,
  };
}

export function workspaceToPayload(workspace) {
  const { _id, createdAt, updatedAt, computedSummary, createdBy, ...rest } = workspace;
  return rest;
}

export function getActiveParticipant(workspace) {
  if (!workspace) return null;
  const name = workspace.activeParticipantName || workspace.participants?.[0]?.name;
  return workspace.participants?.find((p) => p.name === name) || workspace.participants?.[0] || null;
}
