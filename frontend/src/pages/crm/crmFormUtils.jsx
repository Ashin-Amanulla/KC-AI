import { Label } from '../../ui/label';
import { nativeSelectClass } from '../../ui/select';
import { cn } from '../../lib/utils';

export function toDateInput(value) {
  if (!value) return '';
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return '';
  return d.toISOString().slice(0, 10);
}

export function toDateTimeInput(value) {
  if (!value) return '';
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return '';
  const pad = (n) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

export function parseDateInput(value) {
  const s = String(value || '').trim();
  if (!s) return null;
  const t = new Date(s).getTime();
  return Number.isFinite(t) ? new Date(t) : null;
}

export function formatBooleanDisplay(value, style = 'yes') {
  if (style === 'yn') return value ? 'Y' : 'N';
  return value ? 'Yes' : 'No';
}

export function parseBooleanInput(value) {
  const s = String(value ?? '').trim().toLowerCase();
  if (!s) return false;
  return s === 'y' || s === 'yes' || s === 'true' || s === '1';
}

export function parseLinkedIds(value) {
  return String(value ?? '')
    .split(/[,;]/)
    .map((s) => s.trim())
    .filter(Boolean);
}

export function formatLinkedIds(ids) {
  return (ids || []).join(', ');
}

export function SelectField({ label, value, onChange, options, className = '' }) {
  return (
    <div className={className}>
      <Label>{label}</Label>
      <select
        className={cn('mt-1 w-full', nativeSelectClass)}
        value={value}
        onChange={(e) => onChange(e.target.value)}
      >
        <option value="">—</option>
        {options.map((o) => (
          <option key={o} value={o}>
            {o}
          </option>
        ))}
      </select>
    </div>
  );
}
