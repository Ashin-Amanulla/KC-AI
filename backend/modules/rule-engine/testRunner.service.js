import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const execFileAsync = promisify(execFile);
const __dirname = path.dirname(fileURLToPath(import.meta.url));
const BACKEND_ROOT = path.join(__dirname, '../..');
const REPORTER_PATH = path.join(__dirname, 'testJsonReporter.mjs');

/** Test suites covered by the rule-engine monitor. */
const TEST_DIRS = ['modules/pay-hours', 'modules/rule-engine', 'modules/shifts'];

function collectTestFiles() {
  const files = [];
  for (const dir of TEST_DIRS) {
    const abs = path.join(BACKEND_ROOT, dir);
    if (!fs.existsSync(abs)) continue;
    const stack = [abs];
    while (stack.length) {
      const current = stack.pop();
      for (const entry of fs.readdirSync(current, { withFileTypes: true })) {
        if (entry.name === 'node_modules') continue;
        const full = path.join(current, entry.name);
        if (entry.isDirectory()) stack.push(full);
        else if (entry.name.endsWith('.test.js')) files.push(full);
      }
    }
  }
  return files.sort();
}

export function parseRuleIds(testName) {
  return [...testName.matchAll(/\[(R\d{3})\]/g)].map((m) => m[1]);
}

async function resolveGitSha() {
  try {
    const { stdout } = await execFileAsync('git', ['rev-parse', '--short', 'HEAD'], {
      cwd: BACKEND_ROOT,
      timeout: 5000,
    });
    return stdout.trim() || null;
  } catch {
    return null;
  }
}

function parseNdjson(output) {
  const results = [];
  for (const line of output.split('\n')) {
    const trimmed = line.trim();
    if (!trimmed.startsWith('{')) continue;
    try {
      const rec = JSON.parse(trimmed);
      if (rec.event !== 'pass' && rec.event !== 'fail') continue;
      results.push({
        testName: rec.name,
        ruleIds: parseRuleIds(rec.name),
        file: rec.file ? path.relative(BACKEND_ROOT, rec.file) : '',
        status: rec.event,
        durationMs: rec.durationMs != null ? Math.round(rec.durationMs * 100) / 100 : null,
        error: rec.error || null,
      });
    } catch {
      // non-JSON noise on the stream — ignore
    }
  }
  return results;
}

/**
 * Runs the pay-engine test suites with the NDJSON reporter and returns
 * structured results. Never throws for test failures — only for runner
 * breakage (missing files, timeout).
 */
export async function runEngineTests() {
  const startedAt = Date.now();
  const files = collectTestFiles();
  if (!files.length) throw new Error('No engine test files found');

  let stdout = '';
  let stderr = '';
  try {
    ({ stdout, stderr } = await execFileAsync(
      process.execPath,
      ['--test', `--test-reporter=${REPORTER_PATH}`, ...files],
      { cwd: BACKEND_ROOT, maxBuffer: 20 * 1024 * 1024, timeout: 120000 }
    ));
  } catch (error) {
    // node --test exits non-zero when any test fails; NDJSON is still on stdout.
    if (!error?.stdout) throw error;
    stdout = error.stdout;
    stderr = error.stderr || '';
  }

  const results = parseNdjson(stdout);
  const pass = results.filter((r) => r.status === 'pass').length;
  const fail = results.length - pass;

  return {
    results,
    totals: { pass, fail, total: results.length },
    ok: fail === 0 && results.length > 0,
    durationMs: Date.now() - startedAt,
    gitSha: await resolveGitSha(),
    stderr: stderr?.slice(0, 4000) || null,
  };
}
