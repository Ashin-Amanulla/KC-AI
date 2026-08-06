export const RATIO_PRESETS = [
  { key: '1:1', label: '1:1', multiplier: 1 },
  { key: '2:1', label: '2:1', multiplier: 2 },
  { key: '3:1', label: '3:1', multiplier: 3 },
  { key: '1:2', label: '1:2', multiplier: 0.5 },
  { key: '1:3', label: '1:3', multiplier: 1 / 3 },
  { key: '1:4', label: '1:4', multiplier: 0.25 },
  { key: 'custom', label: 'Custom…', multiplier: null },
];

export const PERIODS = ['AM', 'PM', 'Night', 'Sleepover'];
export const INTENSITIES = ['Standard', 'High Intensity'];
export const RATE_DAY_TYPES = ['Weekday', 'Saturday', 'Sunday', 'Public Holiday'];
export const WEEK_DAYS = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];
export const WEEKDAY_ONLY = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri'];
export const JS_DAY_TO_NAME = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

export const DAY_META = {
  Mon: { color: '#1F3864', light: '#E8ECF3', rateType: 'Weekday' },
  Tue: { color: '#1F3864', light: '#E8ECF3', rateType: 'Weekday' },
  Wed: { color: '#1F3864', light: '#E8ECF3', rateType: 'Weekday' },
  Thu: { color: '#1F3864', light: '#E8ECF3', rateType: 'Weekday' },
  Fri: { color: '#1F3864', light: '#E8ECF3', rateType: 'Weekday' },
  Sat: { color: '#2E7D6E', light: '#E7F2EF', rateType: 'Saturday' },
  Sun: { color: '#8A5A2B', light: '#F3ECE3', rateType: 'Sunday' },
};

export const PH_COLOR = '#8B2F3B';
export const PH_LIGHT = '#F5E9EB';
export const MAX_PERIOD_DAYS = 1100;
export const INDEXATION_DATE = '2026-07-01';
export const STATES = ['NSW', 'VIC', 'QLD', 'WA', 'SA', 'TAS', 'ACT', 'NT'];

export function defaultRates() {
  return {
    Weekday: {
      AM: { Standard: 73.58, 'High Intensity': 79.6 },
      PM: { Standard: 81.07, 'High Intensity': 87.7 },
      Night: { Standard: 82.57, 'High Intensity': 89.32 },
      Sleepover: { Standard: 311.79, 'High Intensity': 311.79 },
    },
    Saturday: {
      Day: { Standard: 103.54, 'High Intensity': 112.01 },
      Sleepover: { Standard: 311.79, 'High Intensity': 311.79 },
    },
    Sunday: {
      Day: { Standard: 133.5, 'High Intensity': 144.42 },
      Sleepover: { Standard: 311.79, 'High Intensity': 311.79 },
    },
    'Public Holiday': {
      Day: { Standard: 163.46, 'High Intensity': 176.84 },
      Sleepover: { Standard: 311.79, 'High Intensity': 311.79 },
    },
  };
}

export function defaultOldRates() {
  return {
    Weekday: {
      AM: { Standard: 70.23, 'High Intensity': 75.98 },
      PM: { Standard: 77.38, 'High Intensity': 83.72 },
      Night: { Standard: 78.81, 'High Intensity': 85.27 },
      Sleepover: { Standard: 297.6, 'High Intensity': 297.6 },
    },
    Saturday: {
      Day: { Standard: 98.83, 'High Intensity': 106.93 },
      Sleepover: { Standard: 297.6, 'High Intensity': 297.6 },
    },
    Sunday: {
      Day: { Standard: 127.43, 'High Intensity': 137.87 },
      Sleepover: { Standard: 297.6, 'High Intensity': 297.6 },
    },
    'Public Holiday': {
      Day: { Standard: 156.03, 'High Intensity': 168.81 },
      Sleepover: { Standard: 297.6, 'High Intensity': 297.6 },
    },
  };
}

export function getRate(rates, dayType, period, intensity) {
  if (dayType === 'Weekday') return rates.Weekday?.[period]?.[intensity] ?? 0;
  const key = period === 'Sleepover' ? 'Sleepover' : 'Day';
  return rates[dayType]?.[key]?.[intensity] ?? 0;
}

export function periodsForRateCard(dayType) {
  return dayType === 'Weekday' ? ['AM', 'PM', 'Night', 'Sleepover'] : ['Day', 'Sleepover'];
}

export function multiplierOf(block) {
  if (block.ratio === 'custom') {
    const w = Number(block.customW) || 0;
    const p = Number(block.customP) || 0;
    return p > 0 ? w / p : 0;
  }
  const preset = RATIO_PRESETS.find((r) => r.key === block.ratio);
  return preset ? preset.multiplier : 0;
}
