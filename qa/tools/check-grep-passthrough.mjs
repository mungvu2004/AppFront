// Self-check: a --grep regex with shell metacharacters reaches run-phase verbatim through run-full
// (cmd.exe used to split "FL-30-U2|FL-28-U1" at `|`, QA-06b run-063). No stack, no Playwright: --dry-run.
// Usage (from qa/): node tools/check-grep-passthrough.mjs
import { spawnSync } from 'node:child_process';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const SUITE = resolve(dirname(fileURLToPath(import.meta.url)), '..');
let bad = 0;
for (const re of ['FL-30-U2|FL-28-U1', 'a|b', '^SCR-0[12] & "x" %PATH% >nul']) {
  const r = spawnSync(process.execPath, ['tools/run-full.mjs', '--phase', '01', '--run-id', 'dry', '--no-build', '--no-prev', '--layers', 'api', '--grep', re, '--dry-run'], { cwd: SUITE, encoding: 'utf8' });
  const got = r.stdout.match(/^DRY_GREP=(.*)$/mu)?.[1];
  const ok = r.status === 0 && got === JSON.stringify(re);
  if (!ok) bad++;
  console.log(`${ok ? 'ok  ' : 'FAIL'} ${JSON.stringify(re)} -> ${got ?? `(none) exit ${r.status} ${r.stderr.trim()}`}`);
}
process.exit(bad ? 1 : 0);
