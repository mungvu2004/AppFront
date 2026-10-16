// Self-check: a run whose selected layer ran 0 tests must exit non-zero (phase 04 RR #1 reported "0 failing" after
// 12 s because its --grep matched nothing). No stack: the grep matches no test, so Playwright never opens a page.
// Usage (from qa/): node tools/check-zero-tests.mjs
import { spawnSync } from 'node:child_process';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const SUITE = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const tmp = mkdtempSync(join(tmpdir(), 'qa-zero-'));
const env = { ...process.env, QA_RESULTS_DIR: tmp };
let bad = 0;
const cases = [
  ['--grep matches nothing in a layer', ['--phase', '01', '--layers', 'api', '--grep', 'zz-no-such-test-zz']],
  ['explicit layer with no spec file', ['--phase', '99', '--layers', 'edge']],
  // --allow-empty never turns an all-empty run green (it only forgives empty layers next to one that ran).
  ['--allow-empty with every layer empty', ['--phase', '01', '--layers', 'api,edge', '--grep', 'zz-no-such-test-zz', '--allow-empty']],
];
for (const [name, args] of cases) {
  const r = spawnSync(process.execPath, ['tools/run-full.mjs', '--run-id', 'zero', '--no-build', '--no-prev', ...args], { cwd: SUITE, env, encoding: 'utf8' });
  const ok = r.status !== 0 && /EMPTY/u.test(r.stdout);
  if (!ok) bad++;
  console.log(`${ok ? 'ok  ' : 'FAIL'} ${name}: exit ${r.status}${ok ? '' : `\n${`${r.stdout}${r.stderr}`.trim().split('\n').slice(-6).join('\n')}`}`);
}
rmSync(tmp, { recursive: true, force: true });
process.exit(bad ? 1 : 0);
