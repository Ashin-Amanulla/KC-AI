import { useMemo, useState } from 'react';
import { toast } from 'sonner';
import { Card, CardContent, CardHeader, CardTitle } from '../../ui/card';
import { Button } from '../../ui/button';
import { LoadingSpinner } from '../../ui/LoadingSpinner';
import { cn } from '../../lib/utils';
import { useTestRuns, useTestRun, useExecuteTestRun } from '../../api/ruleEngine';

function formatDuration(ms) {
  if (ms == null) return '—';
  return ms >= 1000 ? `${(ms / 1000).toFixed(1)}s` : `${Math.round(ms)}ms`;
}

function RunSummaryBar({ run }) {
  const passRate = run.totals?.total ? Math.round((run.totals.pass / run.totals.total) * 100) : 0;
  return (
    <div className="flex flex-wrap items-center gap-x-6 gap-y-2 text-sm">
      <span
        className={cn(
          'rounded-full px-3 py-1 font-semibold',
          run.ok
            ? 'bg-emerald-500/15 text-emerald-700 dark:text-emerald-400'
            : 'bg-destructive/15 text-destructive'
        )}
      >
        {run.ok ? 'ALL PASSING' : `${run.totals?.fail ?? '?'} FAILING`}
      </span>
      <span>
        <strong className="tabular-nums">{run.totals?.pass ?? 0}</strong>
        <span className="text-muted-foreground"> / {run.totals?.total ?? 0} tests · {passRate}%</span>
      </span>
      <span className="text-muted-foreground">
        {new Date(run.ranAt).toLocaleString()} · {formatDuration(run.durationMs)}
        {run.gitSha ? ` · ${run.gitSha}` : ''}
        {run.awardRateSetLabel ? ` · rates ${run.awardRateSetLabel}` : ''}
        {run.ranBy ? ` · by ${run.ranBy}` : ''}
      </span>
    </div>
  );
}

function ResultsByFile({ results }) {
  const [openFiles, setOpenFiles] = useState(() => new Set());
  const byFile = useMemo(() => {
    const map = new Map();
    for (const result of results) {
      if (!map.has(result.file)) map.set(result.file, []);
      map.get(result.file).push(result);
    }
    return [...map.entries()];
  }, [results]);

  const toggle = (file) =>
    setOpenFiles((prev) => {
      const next = new Set(prev);
      if (next.has(file)) next.delete(file);
      else next.add(file);
      return next;
    });

  return (
    <div className="space-y-2">
      {byFile.map(([file, fileResults]) => {
        const fails = fileResults.filter((r) => r.status === 'fail');
        const open = openFiles.has(file) || fails.length > 0;
        return (
          <Card key={file}>
            <button
              type="button"
              onClick={() => toggle(file)}
              className="flex w-full items-center justify-between gap-3 px-4 py-3 text-left"
            >
              <span className="truncate font-mono text-xs">{file || '(unknown file)'}</span>
              <span className="flex shrink-0 items-center gap-2 text-xs">
                <span className="text-emerald-600 dark:text-emerald-400 tabular-nums">
                  ✓ {fileResults.length - fails.length}
                </span>
                {fails.length > 0 && <span className="text-destructive tabular-nums">✗ {fails.length}</span>}
                <span className="text-muted-foreground">{open ? '▾' : '▸'}</span>
              </span>
            </button>
            {open && (
              <CardContent className="border-t p-0">
                <ul className="divide-y">
                  {fileResults.map((result) => (
                    <li key={result.testName} className="px-4 py-2 text-sm">
                      <div className="flex items-start gap-2">
                        <span className={result.status === 'pass' ? 'text-emerald-600 dark:text-emerald-400' : 'text-destructive'}>
                          {result.status === 'pass' ? '✓' : '✗'}
                        </span>
                        <div className="min-w-0">
                          <span className="break-words">{result.testName}</span>
                          <span className="ml-2 text-xs text-muted-foreground">{formatDuration(result.durationMs)}</span>
                          {result.ruleIds?.length > 0 && (
                            <span className="ml-2 space-x-1">
                              {result.ruleIds.map((id) => (
                                <span key={id} className="rounded bg-muted px-1 py-0.5 font-mono text-[10px] text-muted-foreground">
                                  {id}
                                </span>
                              ))}
                            </span>
                          )}
                          {result.error && (
                            <pre className="mt-1 max-h-48 overflow-auto rounded bg-destructive/5 p-2 text-xs text-destructive">
                              {result.error}
                            </pre>
                          )}
                        </div>
                      </div>
                    </li>
                  ))}
                </ul>
              </CardContent>
            )}
          </Card>
        );
      })}
    </div>
  );
}

export function TestMonitor() {
  const { data: runsData, isLoading } = useTestRuns(20);
  const [selectedRunId, setSelectedRunId] = useState(null);
  const runs = runsData?.runs ?? [];
  const activeRunId = selectedRunId ?? runs[0]?._id ?? null;
  const { data: runDetail, isLoading: detailLoading } = useTestRun(activeRunId);
  const executeRun = useExecuteTestRun();

  const handleRun = () => {
    toast.info('Running the pay-engine test suite…');
    executeRun.mutate(undefined, {
      onSuccess: ({ run }) => {
        setSelectedRunId(run._id);
        if (run.ok) toast.success(`All ${run.totals.total} engine tests passed.`);
        else toast.error(`${run.totals.fail} of ${run.totals.total} engine tests FAILED.`);
      },
      onError: (err) => toast.error(err?.response?.data?.error || 'Test run failed to start.'),
    });
  };

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <p className="max-w-2xl text-sm text-muted-foreground">
          Runs every engine test (rule tags, regression guards, and golden blessed fixtures) against
          the current code. Run this after any engine or rates change — a failing golden fixture
          means a pay calculation changed.
        </p>
        <Button onClick={handleRun} disabled={executeRun.isPending}>
          {executeRun.isPending ? 'Running…' : 'Run engine tests'}
        </Button>
      </div>

      {isLoading && <LoadingSpinner />}

      {!isLoading && !runs.length && (
        <Card>
          <CardContent className="py-10 text-center text-sm text-muted-foreground">
            No runs yet — hit “Run engine tests” to record the first baseline.
          </CardContent>
        </Card>
      )}

      {runDetail?.run && (
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-base">Latest selected run</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <RunSummaryBar run={runDetail.run} />
            {detailLoading ? <LoadingSpinner /> : <ResultsByFile results={runDetail.run.results ?? []} />}
          </CardContent>
        </Card>
      )}

      {runs.length > 0 && (
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-base">Run history</CardTitle>
          </CardHeader>
          <CardContent className="p-0">
            <ul className="divide-y">
              {runs.map((run) => (
                <li key={run._id}>
                  <button
                    type="button"
                    onClick={() => setSelectedRunId(run._id)}
                    className={cn(
                      'flex w-full flex-wrap items-center gap-3 px-4 py-2 text-left text-sm transition-colors hover:bg-accent/50',
                      activeRunId === run._id && 'bg-accent/60'
                    )}
                  >
                    <span className={cn('h-2.5 w-2.5 rounded-full', run.ok ? 'bg-emerald-500' : 'bg-destructive')} />
                    <span className="tabular-nums">
                      {run.totals?.pass ?? 0}/{run.totals?.total ?? 0}
                    </span>
                    <span className="text-muted-foreground">{new Date(run.ranAt).toLocaleString()}</span>
                    {run.gitSha && <span className="font-mono text-xs text-muted-foreground">{run.gitSha}</span>}
                    {run.awardRateSetLabel && (
                      <span className="text-xs text-muted-foreground">rates {run.awardRateSetLabel}</span>
                    )}
                  </button>
                </li>
              ))}
            </ul>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
