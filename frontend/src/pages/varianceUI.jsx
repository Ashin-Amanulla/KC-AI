/**
 * Shared variance UI helpers used by Forecast vs Actuals and
 * Standard vs Forecast variance views.
 */

export function formatDate(d) {
  if (!d) return '—';
  return new Date(d).toLocaleDateString();
}

export function formatDt(d) {
  if (!d) return '—';
  return new Date(d).toLocaleString();
}

export function fmtMoney(v) {
  const n = Number(v);
  return Number.isFinite(n) ? `$${n.toFixed(2)}` : '—';
}

export function fmtNum(v) {
  const n = Number(v);
  return Number.isFinite(n) ? n.toFixed(2) : '—';
}

/**
 * Row class colour-coded by record type. For variance pairs we paint
 * the "expected" side (`blueSource`) blue and the "compared" side green.
 */
export function makeVarianceRowClass(blueSource) {
  return function varianceRowClass(r) {
    if (r.recordType === 'deleted') return 'bg-red-50 hover:bg-red-100';
    if (r.recordType === 'additional') return 'bg-sky-50 hover:bg-sky-100';
    if (r.recordType === 'variance') {
      return r.source === blueSource
        ? 'bg-blue-50 hover:bg-blue-100 cursor-pointer'
        : 'bg-green-50 hover:bg-green-100 cursor-pointer';
    }
    return 'hover:bg-muted/30';
  };
}

/**
 * Cell highlighter for the "compared" (green) source — paints yellow when
 * the underlying backend diff list includes the mapped field.
 *
 * @param {string} diffSource - which row.source should be highlighted (e.g. 'actuals' or 'forecast')
 * @param {Record<string,string>} diffKeys - mapping from UI key → backend diff field name
 */
export function makeDiffCell(diffSource, diffKeys) {
  return function diffCell(r, fieldKey) {
    if (r.source !== diffSource) return '';
    const diffName = diffKeys[fieldKey];
    return Array.isArray(r.diffFields) && r.diffFields.includes(diffName) ? 'bg-yellow-200' : '';
  };
}

export function diffPanelCell(diffFields, key) {
  return Array.isArray(diffFields) && diffFields.includes(key) ? 'bg-yellow-100' : '';
}

export function TypePill({ recordType }) {
  if (recordType === 'deleted')
    return (
      <span className="inline-flex items-center rounded-full bg-red-100 px-2 py-0.5 text-xs font-medium text-red-700">
        Deleted
      </span>
    );
  if (recordType === 'additional')
    return (
      <span className="inline-flex items-center rounded-full bg-sky-100 px-2 py-0.5 text-xs font-medium text-sky-700">
        Additional
      </span>
    );
  if (recordType === 'variance')
    return (
      <span className="inline-flex items-center rounded-full bg-amber-100 px-2 py-0.5 text-xs font-medium text-amber-700">
        Variance
      </span>
    );
  return null;
}

/**
 * Coloured legend strip rendered above variance tables.
 * Pass child swatches; this component just provides the consistent wrapper.
 */
export function VarianceLegend({ children }) {
  return (
    <div className="flex flex-wrap items-center gap-3 rounded border bg-muted/30 px-3 py-2 text-xs text-muted-foreground">
      {children}
    </div>
  );
}

export function LegendSwatch({ swatchClass, label }) {
  return (
    <span className="inline-flex items-center gap-1.5">
      <span className={`inline-block h-3 w-3 rounded ${swatchClass}`} />
      {label}
    </span>
  );
}
