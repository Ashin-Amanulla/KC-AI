import { useMemo, useState } from 'react';
import { Input } from '../../ui/input';
import { cn } from '../../lib/utils';
import {
  ACCESS_LEVEL_LABELS,
  filterCatalogGroups,
  groupCatalogByCategory,
} from '../../config/permissionDisplay';

function AccessBadge({ level }) {
  const cfg = ACCESS_LEVEL_LABELS[level] || ACCESS_LEVEL_LABELS.view;
  return (
    <span className={cn('shrink-0 rounded px-1.5 py-0.5 text-[10px] font-semibold uppercase tracking-wide', cfg.className)}>
      {cfg.label}
    </span>
  );
}

export function PermissionPicker({ catalog, selectedKeys, onChange, disabled = false }) {
  const [search, setSearch] = useState('');
  const grouped = useMemo(() => groupCatalogByCategory(catalog), [catalog]);
  const visibleGroups = useMemo(() => filterCatalogGroups(grouped, search), [grouped, search]);

  const toggle = (key) => {
    if (disabled) return;
    if (selectedKeys.includes(key)) {
      onChange(selectedKeys.filter((k) => k !== key));
    } else {
      onChange([...selectedKeys, key]);
    }
  };

  const toggleCategory = (items, selectAll) => {
    if (disabled) return;
    const keys = items.map((i) => i.key);
    if (selectAll) {
      const merged = new Set([...selectedKeys, ...keys]);
      onChange([...merged]);
    } else {
      onChange(selectedKeys.filter((k) => !keys.includes(k)));
    }
  };

  return (
    <div className="space-y-3">
      <div className="rounded-md border border-border/60 bg-muted/30 px-3 py-2 text-xs text-muted-foreground">
        <p className="font-medium text-foreground">What do these mean?</p>
        <ul className="mt-1 list-inside list-disc space-y-0.5">
          <li><strong>View only</strong> — open the page and read data</li>
          <li><strong>Can edit</strong> — create, change, or delete records</li>
          <li><strong>Admin</strong> — manage users, roles, or see all teams&apos; data</li>
        </ul>
      </div>

      <Input
        value={search}
        onChange={(e) => setSearch(e.target.value)}
        placeholder="Search permissions…"
        className="h-9"
        disabled={disabled}
      />

      <div className="max-h-[28rem] space-y-4 overflow-y-auto rounded-md border p-4">
        {Object.keys(visibleGroups).length === 0 ? (
          <p className="text-sm text-muted-foreground">No permissions match your search.</p>
        ) : (
          Object.entries(visibleGroups).map(([category, items]) => {
            const allSelected = items.every((i) => selectedKeys.includes(i.key));
            const someSelected = items.some((i) => selectedKeys.includes(i.key));
            return (
              <section key={category} className="space-y-2">
                <div className="flex flex-wrap items-center justify-between gap-2 border-b pb-2">
                  <h4 className="text-sm font-semibold">{category}</h4>
                  {!disabled && (
                    <button
                      type="button"
                      className="text-xs font-medium text-primary hover:underline"
                      onClick={() => toggleCategory(items, !allSelected)}
                    >
                      {allSelected ? 'Clear section' : 'Select all in section'}
                    </button>
                  )}
                </div>
                <div className="grid gap-2">
                  {items.map((item) => {
                    const checked = selectedKeys.includes(item.key);
                    return (
                      <label
                        key={item.key}
                        className={cn(
                          'flex cursor-pointer gap-3 rounded-lg border p-3 transition-colors',
                          checked ? 'border-primary/40 bg-primary/5' : 'border-border/60 hover:bg-muted/40',
                          disabled && 'cursor-default opacity-70'
                        )}
                      >
                        <input
                          type="checkbox"
                          checked={checked}
                          onChange={() => toggle(item.key)}
                          disabled={disabled}
                          className="mt-1 h-4 w-4 shrink-0"
                        />
                        <div className="min-w-0 flex-1 space-y-1">
                          <div className="flex flex-wrap items-center gap-2">
                            <span className="text-sm font-medium leading-snug">{item.label}</span>
                            {item.accessLevel && <AccessBadge level={item.accessLevel} />}
                          </div>
                          {item.description && (
                            <p className="text-xs leading-relaxed text-muted-foreground">{item.description}</p>
                          )}
                          {item.areas?.length > 0 && (
                            <p className="text-xs text-muted-foreground">
                              Pages: {item.areas.join(' · ')}
                            </p>
                          )}
                        </div>
                      </label>
                    );
                  })}
                </div>
              </section>
            );
          })
        )}
      </div>

      <p className="text-xs text-muted-foreground">
        {selectedKeys.length} permission{selectedKeys.length === 1 ? '' : 's'} selected
      </p>
    </div>
  );
}
