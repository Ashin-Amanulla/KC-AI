export const PRIMARY_TABS = [
  {
    id: 'templates',
    label: 'Standard templates',
    description: 'Manage weekly shift templates and upload standard CSV or Excel data.',
  },
  {
    id: 'standard-vs-forecast',
    label: 'Standard vs forecast',
    description: 'Compare standard budget to forecast by client and shift template.',
  },
  {
    id: 'forecast-vs-actuals',
    label: 'Forecast vs actuals',
    description: 'Upload forecast and actuals, then compare shifts and variances.',
  },
];

export const DEFAULT_PRIMARY_TAB = 'templates';

export function isValidPrimaryTab(tab) {
  return PRIMARY_TABS.some((t) => t.id === tab);
}

export function primaryTabFromSearch(searchParams) {
  const tab = searchParams.get('tab');
  return isValidPrimaryTab(tab) ? tab : DEFAULT_PRIMARY_TAB;
}
