import { useMemo, useState } from 'react';
import { Search } from 'lucide-react';
import { Badge } from '../../ui/badge';
import { Input } from '../../ui/input';
import { LoadingSpinner } from '../../ui/LoadingSpinner';
import { useSopGuide } from '../../api/ruleEngine';

export function SopGuide() {
  const { data, isLoading, isError } = useSopGuide();
  const [query, setQuery] = useState('');

  const sections = useMemo(() => {
    const list = data?.sections ?? [];
    const q = query.trim().toLowerCase();
    if (!q) return list;
    return list
      .map((section) => {
        const hay = [
          section.title,
          ...section.rules,
          ...section.examples.flatMap((e) => [e.caseId, e.when, e.expect, ...(e.ruleIds || [])]),
        ]
          .join(' ')
          .toLowerCase();
        if (hay.includes(q)) return section;
        const examples = section.examples.filter((e) =>
          [e.caseId, e.when, e.expect].join(' ').toLowerCase().includes(q)
        );
        if (examples.length) return { ...section, examples };
        return null;
      })
      .filter(Boolean);
  }, [data, query]);

  if (isLoading) return <LoadingSpinner className="py-8" />;
  if (isError) {
    return <p className="text-sm text-destructive">Failed to load SOP guide.</p>;
  }

  return (
    <div className="page-stack-dense">
      <div className="flex items-center gap-2">
        <div className="relative flex-1 max-w-xs">
          <Search className="absolute left-2 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted-foreground" />
          <Input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search rules or case IDs…"
            className="h-8 pl-8 text-sm"
          />
        </div>
      </div>

      <div className="scroll-pane max-h-[calc(100vh-12rem)] space-y-4 pr-1">
        {sections.map((section) => (
          <section key={section.id} className="rounded-lg border border-border bg-card text-card-foreground">
            <header className="sticky top-0 z-10 border-b border-border bg-card/95 px-4 py-2 backdrop-blur">
              <h2 className="text-sm font-semibold text-foreground">{section.title}</h2>
            </header>
            <div className="space-y-3 p-4">
              <ul className="space-y-1 text-sm text-foreground">
                {section.rules.map((rule) => (
                  <li key={rule} className="leading-snug">
                    {rule}
                  </li>
                ))}
              </ul>
              {section.examples.length > 0 && (
                <div className="border-t border-border pt-3">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="text-left text-2xs font-medium uppercase tracking-wide text-muted-foreground">
                        <th className="pb-1.5 pr-3 font-medium">Case</th>
                        <th className="pb-1.5 pr-3 font-medium">Rules</th>
                        <th className="pb-1.5 pr-3 font-medium">When</th>
                        <th className="pb-1.5 font-medium">Expected</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-border/60">
                      {section.examples.map((ex) => (
                        <tr key={ex.caseId} className="text-foreground">
                          <td className="py-1.5 pr-3 align-top">
                            <Badge variant="default" className="font-mono text-2xs">
                              {ex.caseId}
                            </Badge>
                          </td>
                          <td className="py-1.5 pr-3 align-top">
                            <div className="flex flex-wrap gap-1">
                              {(ex.ruleIds || []).map((rid) => (
                                <Badge key={rid} variant="outline" className="font-mono text-2xs">
                                  {rid}
                                </Badge>
                              ))}
                            </div>
                          </td>
                          <td className="py-1.5 pr-3 align-top text-muted-foreground">{ex.when}</td>
                          <td className="py-1.5 align-top font-medium">{ex.expect}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          </section>
        ))}
        {sections.length === 0 && (
          <p className="text-sm text-muted-foreground">No sections match your search.</p>
        )}
      </div>
    </div>
  );
}
