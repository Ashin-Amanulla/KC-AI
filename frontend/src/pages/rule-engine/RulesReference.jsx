import { useMemo, useState } from 'react';
import { Card, CardContent } from '../../ui/card';
import { LoadingSpinner } from '../../ui/LoadingSpinner';
import { cn } from '../../lib/utils';
import { useRuleCatalog } from '../../api/ruleEngine';

const STATUS_META = {
  implemented: { label: 'Implemented', cls: 'bg-emerald-500/15 text-emerald-700 dark:text-emerald-400' },
  'needs-verification': { label: 'Needs verification', cls: 'bg-amber-500/15 text-amber-700 dark:text-amber-400' },
  flagged: { label: 'Flag only', cls: 'bg-sky-500/15 text-sky-700 dark:text-sky-400' },
  'not-implemented': { label: 'Not implemented', cls: 'bg-muted text-muted-foreground' },
};

const TEST_DOT = {
  pass: 'bg-emerald-500',
  fail: 'bg-destructive',
  untested: 'bg-muted-foreground/40',
};

function StatusBadge({ status }) {
  const meta = STATUS_META[status] ?? STATUS_META.implemented;
  return (
    <span className={cn('rounded-full px-2 py-0.5 text-[11px] font-medium whitespace-nowrap', meta.cls)}>
      {meta.label}
    </span>
  );
}

/** Bold **text** and `code` spans from catalog descriptions. */
function RichDescription({ text }) {
  const parts = text.split(/(\*\*[^*]+\*\*|`[^`]+`)/g);
  return (
    <span>
      {parts.map((part, i) => {
        if (part.startsWith('**') && part.endsWith('**')) {
          return <strong key={i} className="text-foreground">{part.slice(2, -2)}</strong>;
        }
        if (part.startsWith('`') && part.endsWith('`')) {
          return (
            <code key={i} className="rounded bg-muted px-1 py-0.5 font-mono text-[11px]">
              {part.slice(1, -1)}
            </code>
          );
        }
        return part;
      })}
    </span>
  );
}

export function RulesReference() {
  const { data, isLoading, error } = useRuleCatalog();
  const [activeCategory, setActiveCategory] = useState(null);
  const [statusFilter, setStatusFilter] = useState('all');
  const [search, setSearch] = useState('');

  const grouped = useMemo(() => {
    if (!data) return [];
    const q = search.trim().toLowerCase();
    return data.categories
      .map((category) => ({
        ...category,
        rules: data.rules.filter(
          (rule) =>
            rule.category === category.slug &&
            (statusFilter === 'all' || rule.status === statusFilter) &&
            (!q ||
              rule.id.toLowerCase().includes(q) ||
              rule.title.toLowerCase().includes(q) ||
              rule.description.toLowerCase().includes(q))
        ),
      }))
      .filter((category) => category.rules.length > 0);
  }, [data, statusFilter, search]);

  const statusCounts = useMemo(() => {
    const counts = { all: data?.rules.length ?? 0 };
    for (const rule of data?.rules ?? []) counts[rule.status] = (counts[rule.status] || 0) + 1;
    return counts;
  }, [data]);

  if (isLoading) return <LoadingSpinner />;
  if (error) return <p className="text-sm text-destructive">Failed to load rules catalog.</p>;

  const visible = activeCategory ? grouped.filter((c) => c.slug === activeCategory) : grouped;

  return (
    <div className="flex flex-col gap-4 lg:flex-row">
      {/* Category rail */}
      <aside className="w-full shrink-0 lg:w-64">
        <div className="sticky top-4 space-y-1">
          <button
            type="button"
            onClick={() => setActiveCategory(null)}
            className={cn(
              'w-full rounded-md px-3 py-1.5 text-left text-sm transition-colors',
              !activeCategory ? 'bg-accent font-medium text-foreground' : 'text-muted-foreground hover:bg-accent/50'
            )}
          >
            All categories
          </button>
          {(data?.categories ?? []).map((category) => {
            const count = data.rules.filter((r) => r.category === category.slug).length;
            return (
              <button
                key={category.slug}
                type="button"
                onClick={() => setActiveCategory(category.slug === activeCategory ? null : category.slug)}
                className={cn(
                  'flex w-full items-center justify-between gap-2 rounded-md px-3 py-1.5 text-left text-sm transition-colors',
                  activeCategory === category.slug
                    ? 'bg-accent font-medium text-foreground'
                    : 'text-muted-foreground hover:bg-accent/50'
                )}
              >
                <span className="truncate">{category.title}</span>
                <span className="text-xs tabular-nums text-muted-foreground">{count}</span>
              </button>
            );
          })}
        </div>
      </aside>

      {/* Rules list */}
      <div className="min-w-0 flex-1 space-y-4">
        <div className="flex flex-wrap items-center gap-2">
          <input
            type="search"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search rules (id, title, text)…"
            className="h-9 w-64 rounded-md border border-input bg-background px-3 text-sm shadow-sm focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
          />
          {['all', 'implemented', 'needs-verification', 'flagged', 'not-implemented'].map((status) => (
            <button
              key={status}
              type="button"
              onClick={() => setStatusFilter(status)}
              className={cn(
                'rounded-full px-3 py-1 text-xs font-medium transition-colors',
                statusFilter === status
                  ? 'bg-primary text-primary-foreground'
                  : 'bg-muted text-muted-foreground hover:text-foreground'
              )}
            >
              {status === 'all' ? 'All' : (STATUS_META[status]?.label ?? status)}
              <span className="ml-1 tabular-nums opacity-70">{statusCounts[status] ?? 0}</span>
            </button>
          ))}
        </div>

        {visible.map((category) => (
          <section key={category.slug}>
            <h3 className="mb-2 text-sm font-semibold uppercase tracking-wide text-muted-foreground">
              {category.title}
            </h3>
            <Card>
              <CardContent className="divide-y p-0">
                {category.rules.map((rule) => (
                  <div key={rule.id} className="flex flex-col gap-1.5 px-4 py-3">
                    <div className="flex flex-wrap items-center gap-2">
                      <span
                        className={cn('h-2 w-2 shrink-0 rounded-full', TEST_DOT[rule.lastStatus] ?? TEST_DOT.untested)}
                        title={`Latest test run: ${rule.lastStatus}`}
                      />
                      <span className="font-mono text-xs font-semibold text-muted-foreground">{rule.id}</span>
                      <span className="text-sm font-medium">{rule.title}</span>
                      <StatusBadge status={rule.status} />
                      {rule.awardRef && (
                        <span className="rounded bg-muted px-1.5 py-0.5 text-[11px] text-muted-foreground">
                          {rule.awardRef}
                        </span>
                      )}
                    </div>
                    <p className="text-sm leading-relaxed text-muted-foreground">
                      <RichDescription text={rule.description} />
                    </p>
                    {rule.tests?.length > 0 && (
                      <div className="flex flex-wrap gap-1.5">
                        {rule.tests.map((t) => (
                          <span
                            key={t.testName}
                            title={t.error || t.testName}
                            className={cn(
                              'max-w-md truncate rounded px-1.5 py-0.5 text-[11px]',
                              t.status === 'pass'
                                ? 'bg-emerald-500/10 text-emerald-700 dark:text-emerald-400'
                                : 'bg-destructive/10 text-destructive'
                            )}
                          >
                            {t.status === 'pass' ? '✓' : '✗'} {t.testName.replace(/\[R\d{3}\]/g, '').trim()}
                          </span>
                        ))}
                      </div>
                    )}
                  </div>
                ))}
              </CardContent>
            </Card>
          </section>
        ))}

        {!visible.length && (
          <p className="py-8 text-center text-sm text-muted-foreground">No rules match the current filters.</p>
        )}
      </div>
    </div>
  );
}
