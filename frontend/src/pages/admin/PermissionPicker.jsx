import { useMemo, useState } from 'react';
import { Input } from '../../ui/input';
import { Badge } from '../../ui/badge';
import { cn } from '../../lib/utils';
import {
  ACCESS_LEVEL_LABELS,
  filterCatalogGroups,
  groupCatalogByCategory,
} from '../../config/permissionDisplay';

const ACCESS_LEVEL_VARIANT = { view: 'primary', edit: 'warning', admin: 'destructive' };

function AccessBadge({ level }) {
  const cfg = ACCESS_LEVEL_LABELS[level] || ACCESS_LEVEL_LABELS.view;
  return (
    <Badge variant={ACCESS_LEVEL_VARIANT[level] || 'primary'} className="shrink-0 uppercase tracking-wide">
      {cfg.label}
    </Badge>
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
    <div className="space-y-2.5">
      <div className="muted-strip">
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
        className="h-8 text-xs"
        disabled={disabled}
      />

      <div className="scroll-pane max-h-[24rem] space-y-3 rounded-md border border-border/60 p-2.5">
        {Object.keys(visibleGroups).length === 0 ? (
          <p className="text-2sm text-muted-foreground">No permissions match your search.</p>
        ) : (
          Object.entries(visibleGroups).map(([category, items]) => {
            const allSelected = items.every((i) => selectedKeys.includes(i.key));
            return (
              <section key={category} className="space-y-1.5">
                <div className="section-label flex flex-wrap items-center justify-between gap-2 border-b border-border/60 pb-1.5">
                  <span>{category}</span>
                  {!disabled && (
                    <button
                      type="button"
                      className="normal-case text-2xs font-medium text-primary hover:underline"
                      onClick={() => toggleCategory(items, !allSelected)}
                    >
                      {allSelected ? 'Clear section' : 'Select all'}
                    </button>
                  )}
                </div>
                <div className="grid gap-1.5">
                  {items.map((item) => {
                    const checked = selectedKeys.includes(item.key);
                    return (
                      <label
                        key={item.key}
                        className={cn(
                          'flex cursor-pointer gap-2.5 rounded-md border px-2.5 py-2 transition-colors',
                          checked ? 'border-primary/40 bg-primary/5' : 'border-border/60 hover:bg-muted/40',
                          disabled && 'cursor-default opacity-70'
                        )}
                      >
                        <input
                          type="checkbox"
                          checked={checked}
                          onChange={() => toggle(item.key)}
                          disabled={disabled}
                          className="mt-0.5 h-3.5 w-3.5 shrink-0 rounded border-border"
                        />
                        <div className="min-w-0 flex-1 space-y-0.5">
                          <div className="flex flex-wrap items-center gap-1.5">
                            <span className="text-2sm font-medium leading-snug">{item.label}</span>
                            {item.accessLevel && <AccessBadge level={item.accessLevel} />}
                          </div>
                          {item.description && (
                            <p className="text-2xs leading-relaxed text-muted-foreground">{item.description}</p>
                          )}
                          {item.areas?.length > 0 && (
                            <p className="text-2xs text-muted-foreground">
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

      <p className="text-2xs text-muted-foreground">
        {selectedKeys.length} permission{selectedKeys.length === 1 ? '' : 's'} selected
      </p>
    </div>
  );
}
