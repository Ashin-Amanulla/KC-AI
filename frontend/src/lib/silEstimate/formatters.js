export function fmtMoney(n) {
  if (!isFinite(n)) return '$0';
  return n.toLocaleString('en-AU', { style: 'currency', currency: 'AUD', maximumFractionDigits: 0 });
}

export function fmtMult(n) {
  if (!isFinite(n)) return '0.00';
  return n.toFixed(2);
}

export function toISODate(d) {
  return d.toISOString().slice(0, 10);
}

export function fmtDMY(iso) {
  if (!iso) return '';
  const [y, m, d] = iso.split('-');
  if (!y || !m || !d) return '';
  return `${d}/${m}/${y}`;
}
