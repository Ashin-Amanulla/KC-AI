import { useState } from 'react';
import { toast } from 'sonner';
import { Beaker, Play, CheckCircle2, XCircle, Clock3 } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '../ui/card';
import { Button } from '../ui/button';
import { useRunPayHoursTests } from '../api/payHours';
import { getErrorMessage } from '../utils/api';

function parseTestItems(output) {
  if (!output) return [];
  const stripAnsi = (s) => s.replace(/\u001b\[[0-9;]*m/g, '');
  const lines = output
    .split('\n')
    .map((l) => stripAnsi(l).replace(/\r/g, '').trim())
    .filter(Boolean);
  const items = [];

  for (const line of lines) {
    // Spec reporter format
    if (/^[✔✓]\s+/.test(line)) {
      items.push({ status: 'passed', label: line.replace(/^[✔✓]\s+/, '').trim() });
      continue;
    }
    if (/^[✖✗xX]\s+/.test(line)) {
      items.push({ status: 'failed', label: line.replace(/^[✖✗xX]\s+/, '').trim() });
      continue;
    }

    // TAP reporter format (common in non-TTY runs)
    if (/^ok\s+\d+\s+-\s+/.test(line)) {
      const label = line.replace(/^ok\s+\d+\s+-\s+/, '').trim();
      // Ignore suite headers like "ok 1 - suite name"
      if (label && !label.startsWith('tests ') && !label.startsWith('suite ')) {
        items.push({ status: 'passed', label });
      }
      continue;
    }
    if (/^not ok\s+\d+\s+-\s+/.test(line)) {
      const label = line.replace(/^not ok\s+\d+\s+-\s+/, '').trim();
      if (label) {
        items.push({ status: 'failed', label });
      }
      continue;
    }
  }

  // De-duplicate repeated lines from nested suite output
  const seen = new Set();
  const parsed = items.filter((item) => {
    const key = `${item.status}:${item.label}`;
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });

  if (parsed.length > 0) return parsed;

  // Fallback: still render meaningful rows if reporter format is unexpected.
  const skipPrefixes = ['ℹ tests', 'ℹ suites', 'ℹ pass', 'ℹ fail', 'ℹ cancelled', 'ℹ skipped', 'ℹ todo', 'ℹ duration_ms'];
  return lines
    .filter((line) => !skipPrefixes.some((p) => line.startsWith(p)))
    .map((line) => {
      const lower = line.toLowerCase();
      if (lower.includes('fail') || lower.includes('not ok')) return { status: 'failed', label: line };
      if (lower.includes('pass') || lower.includes('ok')) return { status: 'passed', label: line };
      return { status: 'passed', label: line };
    });
}

export function PayHoursTests() {
  const [testRunResult, setTestRunResult] = useState(null);
  const runTestsMutation = useRunPayHoursTests();

  const handleRunEngineTests = async () => {
    try {
      const result = await runTestsMutation.mutateAsync();
      setTestRunResult(result);
      toast.success('Pay-hours test suite passed');
    } catch (err) {
      const payload = err?.response?.data;
      setTestRunResult(payload || null);
      toast.error(payload?.output ? 'Pay-hours test suite failed' : (getErrorMessage(err) || 'Failed to run pay-hours tests'));
    }
  };

  const statusLabel = runTestsMutation.isPending
    ? 'Running'
    : testRunResult
      ? (testRunResult.ok ? 'Passed' : 'Failed')
      : 'Not run';
  const testItems = parseTestItems(testRunResult?.output || '');
  const passedCount = testItems.filter((i) => i.status === 'passed').length;
  const failedCount = testItems.filter((i) => i.status === 'failed').length;

  return (
    <div className="space-y-6">
      <div className="rounded-lg border bg-gradient-to-r from-primary/10 to-background p-5">
        <div className="flex items-center gap-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-md bg-primary/15">
            <Beaker className="h-5 w-5 text-primary" />
          </div>
          <div>
            <h2 className="text-3xl font-bold">Pay Hours Tests</h2>
            <p className="text-sm text-muted-foreground mt-1">
              Validate shift banding, overtime rules, and edge-case calculations in one click.
            </p>
          </div>
        </div>
      </div>

      <div className="grid gap-3 sm:grid-cols-3">
        <Card>
          <CardContent className="pt-4">
            <p className="text-[11px] uppercase tracking-wide text-muted-foreground">Status</p>
            <div className="mt-1 flex items-center gap-2">
              {statusLabel === 'Passed' && <CheckCircle2 className="h-4 w-4 text-emerald-600" />}
              {statusLabel === 'Failed' && <XCircle className="h-4 w-4 text-destructive" />}
              {statusLabel === 'Running' && <Clock3 className="h-4 w-4 text-amber-600" />}
              <p className="text-lg font-semibold">{statusLabel}</p>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="pt-4">
            <p className="text-[11px] uppercase tracking-wide text-muted-foreground">Tests</p>
            <p className="mt-1 text-lg font-semibold font-mono">
              {testItems.length ? `${passedCount} passed` : '-'}
            </p>
            {failedCount > 0 && (
              <p className="text-xs text-destructive mt-0.5">{failedCount} failed</p>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardContent className="pt-4">
            <p className="text-[11px] uppercase tracking-wide text-muted-foreground">Last Run</p>
            <p className="mt-1 text-sm font-medium">
              {testRunResult?.ranAt ? new Date(testRunResult.ranAt).toLocaleString() : 'Not run yet'}
            </p>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-lg">Run Test Suite</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          <div className="flex items-center gap-3 flex-wrap">
            <Button onClick={handleRunEngineTests} disabled={runTestsMutation.isPending} className="gap-2">
              <Play className="h-4 w-4" />
              {runTestsMutation.isPending ? 'Running tests…' : 'Run pay-hours tests'}
            </Button>
            {testRunResult && (
              <span className={`text-xs font-medium ${testRunResult.ok ? 'text-emerald-700' : 'text-destructive'}`}>
                {testRunResult.ok ? 'Latest run passed' : 'Latest run failed'}
              </span>
            )}
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-lg">Test Results</CardTitle>
        </CardHeader>
        <CardContent>
          {testItems.length > 0 ? (
            <div className="space-y-2 max-h-[32rem] overflow-y-auto pr-1">
              {testItems.map((item, idx) => (
                <div
                  key={`${item.label}-${idx}`}
                  className={`rounded-md border px-3 py-2 text-sm flex items-start gap-2 ${
                    item.status === 'passed'
                      ? 'bg-emerald-50/60 border-emerald-200'
                      : 'bg-red-50/60 border-red-200'
                  }`}
                >
                  {item.status === 'passed' ? (
                    <CheckCircle2 className="h-4 w-4 mt-0.5 text-emerald-600 shrink-0" />
                  ) : (
                    <XCircle className="h-4 w-4 mt-0.5 text-destructive shrink-0" />
                  )}
                  <span className={item.status === 'passed' ? 'text-emerald-900' : 'text-red-900'}>
                    {item.label}
                  </span>
                </div>
              ))}
            </div>
          ) : (
            <div className="rounded-md border border-dashed p-6 text-center text-sm text-muted-foreground">
              No test results yet. Run the suite to see each test item here.
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
