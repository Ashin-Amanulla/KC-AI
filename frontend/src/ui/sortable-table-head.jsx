import { ArrowDown, ArrowUp, ArrowUpDown } from 'lucide-react';
import { cn } from '../lib/utils';
import { TableHead } from './table';

export function SortableTableHead({
  label,
  sortKey,
  activeSortKey,
  sortType,
  onSort,
  className,
  children,
  suffix,
}) {
  const active = activeSortKey === sortKey;
  const Icon = active ? (sortType === 'asc' ? ArrowUp : ArrowDown) : ArrowUpDown;
  const content = children ?? label;

  return (
    <TableHead className={className}>
      <div className="inline-flex items-center gap-0.5">
        <button
          type="button"
          onClick={() => onSort(sortKey)}
          className={cn(
            '-mx-0.5 inline-flex items-center gap-0.5 rounded px-0.5 text-2xs font-semibold uppercase tracking-wide transition-colors',
            'hover:text-foreground focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring',
            active ? 'text-foreground' : 'text-muted-foreground'
          )}
        >
          {content}
          <Icon className="h-2.5 w-2.5 shrink-0 opacity-60" aria-hidden />
        </button>
        {suffix}
      </div>
    </TableHead>
  );
}
