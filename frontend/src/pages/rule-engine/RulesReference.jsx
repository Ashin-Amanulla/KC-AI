import { useMemo, useState } from 'react';
import { BookOpen, Search } from 'lucide-react';
import { Badge } from '../../ui/badge';
import { Button } from '../../ui/button';
import { Input } from '../../ui/input';
import { LoadingSpinner } from '../../ui/LoadingSpinner';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '../../ui/select';
import { Tooltip, TooltipContent, TooltipTrigger } from '../../ui/tooltip';
import { cn } from '../../lib/utils';
import { useRuleCatalog } from '../../api/ruleEngine';
import { RuleScenarioModal } from './RuleScenarioModal';
import { RichDescription } from './rulesReferenceUtils';

const STATUS_META = {
  implemented: { label: 'Implemented', dot: 'bg-success' },
  'needs-verification': { label: 'Needs verification', dot: 'bg-warning' },
  flagged: { label: 'Flag only', dot: 'bg-primary' },
  'not-implemented': { label: 'Not implemented', dot: 'bg-muted-foreground/40' },
};

const STATUS_FILTERS = [
  { key: 'all', label: 'All statuses' },
  { key: 'implemented', label: 'Implemented' },
  { key: 'needs-verification', label: 'Needs verification' },
  { key: 'flagged', label: 'Flag only' },
  { key: 'not-implemented', label: 'Not implemented' },
];

const TEST_DOT = {
  pass: 'bg-success',
  fail: 'bg-destructive',
  untested: 'bg-muted-foreground/30',
};

function StatusDot({ status }) {
  const meta = STATUS_META[status] ?? STATUS_META.implemented;
  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <span className={cn('mt-1.5 h-1.5 w-1.5 shrink-0 rounded-full', meta.dot)} />
      </TooltipTrigger>
      <TooltipContent side="left" className="text-2xs">
        {meta.label}
      </TooltipContent>
    </Tooltip>
  );
}

function RuleRow({ rule, onOpenScenario }) {
  const failCount = rule.tests?.filter((t) => t.status === 'fail').length ?? 0;

  return (
    <div className="group flex gap-2 border-b border-border/50 px-2.5 py-1.5 last:border-b-0 hover:bg-muted/25">
      <StatusDot status={rule.status} />
      <div className="min-w-0 flex-1">
        <div className="flex min-w-0 items-baseline gap-1.5">
          <span className="shrink-0 font-mono text-2xs font-medium text-muted-foreground">{rule.id}</span>
          <span className="truncate text-xs font-medium">{rule.title}</span>
          {rule.awardRef && (
            <span className="hidden shrink-0 font-mono text-2xs text-muted-foreground/60 lg:inline">
              {rule.awardRef}
            </span>
          )}
          {failCount > 0 && (
            <Badge variant="destructive" className="shrink-0 px-1.5 py-0 text-2xs">
              {failCount} fail
            </Badge>
          )}
        </div>
        <p className="line-clamp-1 text-2xs leading-snug text-muted-foreground">
          <RichDescription text={rule.description} />
        </p>
      </div>
      <Tooltip>
        <TooltipTrigger asChild>
          <Button
            type="button"
            variant="ghost"
            size="icon"
            className="h-6 w-6 shrink-0 opacity-60 group-hover:opacity-100"
            onClick={() => onOpenScenario(rule)}
            aria-label={`View real-life scenario for ${rule.id}`}
          >
            <BookOpen className="h-3.5 w-3.5" />
          </Button>
        </TooltipTrigger>
        <TooltipContent side="left" className="text-2xs">
          Real-life scenario
        </TooltipContent>
      </Tooltip>
      <Tooltip>
        <TooltipTrigger asChild>
          <span
            className={cn(
              'mt-1.5 h-1.5 w-1.5 shrink-0 rounded-full',
              TEST_DOT[rule.lastStatus] ?? TEST_DOT.untested
            )}
          />
        </TooltipTrigger>
        <TooltipContent side="left" className="text-2xs">
          Test: {rule.lastStatus ?? 'untested'}
        </TooltipContent>
      </Tooltip>
    </div>
  );
}

export function RulesReference() {
  const { data, isLoading, error } = useRuleCatalog();
  const [activeCategory, setActiveCategory] = useState('all');
  const [statusFilter, setStatusFilter] = useState('all');
  const [search, setSearch] = useState('');
  const [scenarioRule, setScenarioRule] = useState(null);

  const filteredRules = useMemo(() => {
    if (!data) return [];
    const q = search.trim().toLowerCase();
    return data.rules.filter(
      (rule) =>
        (activeCategory === 'all' || rule.category === activeCategory) &&
        (statusFilter === 'all' || rule.status === statusFilter) &&
        (!q ||
          rule.id.toLowerCase().includes(q) ||
          rule.title.toLowerCase().includes(q) ||
          rule.description.toLowerCase().includes(q))
    );
  }, [data, activeCategory, statusFilter, search]);

  const grouped = useMemo(() => {
    if (!data) return [];
    const map = new Map();
    for (const rule of filteredRules) {
      if (!map.has(rule.category)) map.set(rule.category, []);
      map.get(rule.category).push(rule);
    }
    return data.categories
      .filter((category) => map.has(category.slug))
      .map((category) => ({
        ...category,
        rules: map.get(category.slug),
      }));
  }, [data, filteredRules]);

  const statusCounts = useMemo(() => {
    const base =
      activeCategory === 'all'
        ? data?.rules ?? []
        : (data?.rules ?? []).filter((r) => r.category === activeCategory);
    const counts = { all: base.length };
    for (const rule of base) counts[rule.status] = (counts[rule.status] || 0) + 1;
    return counts;
  }, [data, activeCategory]);

  if (isLoading) return <LoadingSpinner />;
  if (error) return <p className="text-xs text-destructive">Failed to load rules catalog.</p>;

  return (
    <div className="page-stack-dense">
      <div className="filter-toolbar">
        <div className="relative min-w-[140px] flex-1 sm:max-w-xs">
          <Search className="pointer-events-none absolute left-2 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted-foreground" />
          <Input
            type="search"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search rules…"
            className="filter-control pl-7"
          />
        </div>

        <Select value={activeCategory} onValueChange={setActiveCategory}>
          <SelectTrigger className="filter-control w-[168px]">
            <SelectValue placeholder="Category" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all" className="text-xs">
              All categories ({data?.rules.length ?? 0})
            </SelectItem>
            {(data?.categories ?? []).map((category) => {
              const count = data.rules.filter((r) => r.category === category.slug).length;
              return (
                <SelectItem key={category.slug} value={category.slug} className="text-xs">
                  {category.title} ({count})
                </SelectItem>
              );
            })}
          </SelectContent>
        </Select>

        <Select value={statusFilter} onValueChange={setStatusFilter}>
          <SelectTrigger className="filter-control w-[148px]">
            <SelectValue placeholder="Status" />
          </SelectTrigger>
          <SelectContent>
            {STATUS_FILTERS.map(({ key, label }) => (
              <SelectItem key={key} value={key} className="text-xs">
                {label}
                {key !== 'all' && statusCounts[key] != null ? ` (${statusCounts[key]})` : ''}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>

        <span className="ml-auto text-2xs tabular-nums text-muted-foreground">
          {filteredRules.length} rule{filteredRules.length !== 1 ? 's' : ''}
        </span>
      </div>

      <div
        className="scroll-pane rounded-lg border border-border/60"
        style={{ '--scroll-offset': '11.5rem' }}
      >
        {grouped.map((category) => (
          <section key={category.slug}>
            <h3 className="section-label section-label-sticky">
              {category.title}
              <span className="ml-1.5 font-normal tabular-nums text-muted-foreground/70">
                {category.rules.length}
              </span>
            </h3>
            {category.rules.map((rule) => (
              <RuleRow key={rule.id} rule={rule} onOpenScenario={setScenarioRule} />
            ))}
          </section>
        ))}

        {!grouped.length && (
          <p className="py-8 text-center text-xs text-muted-foreground">No rules match the current filters.</p>
        )}
      </div>

      <RuleScenarioModal
        rule={scenarioRule}
        open={Boolean(scenarioRule)}
        onOpenChange={(open) => {
          if (!open) setScenarioRule(null);
        }}
      />
    </div>
  );
}
