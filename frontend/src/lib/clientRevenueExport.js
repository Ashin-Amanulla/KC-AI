import * as XLSX from 'xlsx';

function fmtMoney(n) {
  if (n == null || Number.isNaN(n)) return '';
  return Number(n);
}

function fmtPct(n) {
  if (n == null || Number.isNaN(n)) return '';
  return Number(n);
}

/**
 * Build and download Client Revenue vs Staff Wages workbook (Summary + Staff by client).
 */
export function downloadClientRevenueVsWagesXlsx({
  clientRows = [],
  matchedTotals = {},
  locationCode = 'loc',
  periodLabel = '',
}) {
  if (!clientRows.length) {
    throw new Error('No client rows to export');
  }

  const summaryHeaders = [
    'Client',
    'Client Paid',
    'Staff Wages',
    'Super',
    'Staff Cost',
    'Margin',
    'Margin %',
    'Coverage %',
    'Hours',
    'Workers',
  ];

  const summaryRows = clientRows.map((c) => [
    c.name,
    fmtMoney(c.revenue),
    fmtMoney(c.allocWages),
    fmtMoney(c.allocSuper),
    fmtMoney(c.allocEmployerCost),
    fmtMoney(c.margin),
    fmtPct(c.marginPct),
    fmtPct(c.payrollCoveragePct),
    c.hours ?? 0,
    c.staffCount ?? 0,
  ]);

  if (matchedTotals.matchedRevenue != null) {
    summaryRows.push([
      'MATCHED TOTAL',
      fmtMoney(matchedTotals.matchedRevenue),
      fmtMoney(matchedTotals.matchedWages),
      fmtMoney(matchedTotals.matchedSuper),
      fmtMoney(matchedTotals.matchedEmployerCost),
      fmtMoney(matchedTotals.matchedMargin),
      fmtPct(matchedTotals.matchedMarginPct),
      '',
      '',
      matchedTotals.matchedCount ?? '',
    ]);
  }

  const staffHeaders = [
    'Client',
    'Staff',
    'Hours',
    'Revenue',
    'Wages',
    'Super',
    'Employer Cost',
  ];

  const staffRows = [];
  for (const client of clientRows) {
    for (const s of client.staffAllocRows || []) {
      staffRows.push([
        client.name,
        s.staffName,
        s.hours ?? 0,
        fmtMoney(s.revenue),
        fmtMoney(s.wages),
        fmtMoney(s.superAmt),
        fmtMoney(s.employerCost),
      ]);
    }
  }

  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(
    wb,
    XLSX.utils.aoa_to_sheet([summaryHeaders, ...summaryRows]),
    'Summary'
  );
  XLSX.utils.book_append_sheet(
    wb,
    XLSX.utils.aoa_to_sheet([staffHeaders, ...staffRows]),
    'Staff by client'
  );

  const safePeriod = (periodLabel || new Date().toISOString().slice(0, 10)).replace(/[^\d-]/g, '');
  const code = String(locationCode || 'loc').toLowerCase();
  const filename = `client_revenue_vs_wages_${code}_${safePeriod}.xlsx`;
  XLSX.writeFile(wb, filename);
}
