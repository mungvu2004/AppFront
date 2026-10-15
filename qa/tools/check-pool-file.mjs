// Self-check for tests/support/poolFile.ts (no stack, no Playwright). Usage (from qa/):
//   node tools/check-pool-file.mjs          -> new logic; exit 0 = green
//   node tools/check-pool-file.mjs --old    -> the pre-fix writePool (write the pool read earlier, bare rename); expected RED
// (1) 4 processes each add 50 distinct slots to one file -> all 200 slots survive, no process crashes.
// (2) 429 fallback: first inviter 429 RATE_LIMITED, next one 201 -> 201; all 429 -> stops after 5 alternatives.
import { spawn } from 'node:child_process';
import { existsSync, mkdirSync, mkdtempSync, readFileSync, renameSync, rmSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';

import { inviteWithFallback, mergeWriteJsonFile } from '../tests/support/poolFile.ts';

const TMP = fileURLToPath(new URL('../test-results', import.meta.url)); // F:, never C:
const OLD = process.argv.includes('--old');
const PROCS = 4;
const PER_PROC = 50;
const read = (file) => (existsSync(file) ? JSON.parse(readFileSync(file, 'utf8')) : {});

// Pre-fix writePool, verbatim: the caller passes `{ ...readPool(), [key]: fresh }`.
const oldAdd = (file, key) => {
  const pool = { ...read(file), [key]: { id: key } };
  mkdirSync(join(file, '..'), { recursive: true });
  const tmp = `${file}.${process.pid}.tmp`;
  writeFileSync(tmp, `${JSON.stringify(pool, null, 2)}\n`, 'utf8');
  renameSync(tmp, file);
};

if (process.argv[2] === '--child') {
  const [file, who] = process.argv.slice(3);
  for (let i = 0; i < PER_PROC; i += 1) {
    const key = `p${who}-${i}`;
    if (process.argv.includes('--old')) oldAdd(file, key);
    else mergeWriteJsonFile(file, { [key]: { id: key } });
  }
  process.exit(0);
}

const dir = (mkdirSync(TMP, { recursive: true }), mkdtempSync(join(TMP, 'pool-check-')));
const file = join(dir, 'pool.json');
const failures = [];
try {
  const self = fileURLToPath(import.meta.url);
  const codes = await Promise.all(
    Array.from({ length: PROCS }, (_, n) =>
      new Promise((resolve) => {
        const child = spawn(process.execPath, [self, '--child', file, String(n), ...(OLD ? ['--old'] : [])], { stdio: ['ignore', 'ignore', 'pipe'] });
        let err = '';
        child.stderr.on('data', (d) => (err += d));
        child.on('close', (code) => resolve({ code, err: err.split('\n').find((l) => /Error/u.test(l)) ?? '' }));
      }),
    ),
  );
  const crashed = codes.filter((c) => c.code !== 0);
  const have = Object.keys(read(file)).length;
  if (crashed.length) failures.push(`${crashed.length}/${PROCS} writer processes crashed: ${crashed[0].err}`);
  if (have !== PROCS * PER_PROC) failures.push(`pool file holds ${have}/${PROCS * PER_PROC} slots`);
} finally {
  rmSync(dir, { recursive: true, force: true });
}

const limited = { status: 429, text: '{"code": "RATE_LIMITED"}' };
const created = { status: 201, text: '[]' };
const calls = [];
const stub = (name, answer) => async () => (calls.push(name), answer);
let got = await inviteWithFallback(stub('seed', limited), [stub('adminA', created), stub('adminB', created)]);
if (got.status !== 201 || calls.join() !== 'seed,adminA') failures.push(`fallback: ${got.status} via ${calls.join()} (want 201 via seed,adminA)`);
calls.length = 0;
got = await inviteWithFallback(stub('seed', limited), Array.from({ length: 8 }, (_, i) => stub(`a${i}`, limited)));
if (got.status !== 429 || calls.length !== 6) failures.push(`fallback cap: ${got.status} after ${calls.length} calls (want 429 after 1+5)`);
calls.length = 0;
got = await inviteWithFallback(stub('seed', { status: 400, text: 'bad' }), [stub('adminA', created)]);
if (got.status !== 400 || calls.length !== 1) failures.push(`fallback only on 429: ${got.status} after ${calls.length} calls`);

if (failures.length) {
  console.error(`check-pool-file${OLD ? ' --old' : ''}: RED - ${failures.join(' | ')}`);
  process.exit(1);
}
console.log(`check-pool-file${OLD ? ' --old' : ''}: GREEN - ${PROCS * PER_PROC} slots from ${PROCS} processes, 429 fallback ok`);
