/**
 * Custom node:test reporter emitting NDJSON, one object per test event:
 *   { event: 'pass'|'fail', name, file, suite, durationMs, error? }
 * Suite-level events are skipped; the runner parses this stream into
 * structured RuleTestRun results (rule ids come from [Rxxx] tags in names).
 */
export default async function* jsonReporter(source) {
  for await (const event of source) {
    if (event.type !== 'test:pass' && event.type !== 'test:fail') continue;
    const data = event.data || {};
    // Skip suite/describe aggregation events — only leaf tests count.
    if (data.details?.type === 'suite') continue;
    const record = {
      event: event.type === 'test:pass' ? 'pass' : 'fail',
      name: data.name || '',
      file: data.file || '',
      durationMs: data.details?.duration_ms ?? null,
    };
    if (event.type === 'test:fail') {
      const err = data.details?.error;
      record.error = err ? String(err.cause?.message || err.message || err).slice(0, 2000) : 'failed';
    }
    yield `${JSON.stringify(record)}\n`;
  }
}
