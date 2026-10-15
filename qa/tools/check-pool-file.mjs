// Self-check for tests/support/poolFile.ts (no stack, no Playwright). Usage (from qa/):
//   node tools/check-pool-file.mjs          -> new logic; exit 0 = green
//   node tools/check-pool-file.mjs --old    -> the pre-fix writePool (write the pool read earlier, bare rename); expected RED
// (1) 4 processes each add 50 distinct slots to one file -> all 200 slots survive, no process crashes.
// (2) 429 fallback: first inviter 429 RATE_LIMITED, next one 201 -> 201; all 429 -> stops after 5 alternatives.
// (3) stale pool password: login 401 -> one re-invite -> login 204 with the fresh user; 500 and "no slot" are not refreshed.
//     --old uses the pre-fix pool login (one login, status taken as is) and is RED on (3).
import { spawn } from 'node:child_process';
import { existsSync, mkdirSync, mkdtempSync, readFileSync, renameSync, rmSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';

import { inviteWithFallback, loginOrRefresh as newLoginOrRefresh, mergeWriteJsonFile } from '../tests/support/poolFile.ts';

// Pre-fix signInPoolUser: one login, whatever it answers is final (401 -> "expected 204 received 401").
const oldLoginOrRefresh = async (user, login) => ({ status: await login(user), user });
const loginOrRefresh = process.argv.includes('--old') ? oldLoginOrRefresh : newLoginOrRefresh;

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

const stale = { id: 'u1', password: 'old' };
const fresh = { id: 'u2', password: 'new' };
const loginAs = (answers) => async (who) => answers[who.password];
let refreshed = 0;
const refresh = async () => (refreshed += 1, fresh);
let out = await loginOrRefresh(stale, loginAs({ old: 401, new: 204 }), refresh);
if (out.status !== 204 || out.user !== fresh || refreshed !== 1) failures.push(`stale 401: ${out.status}, refreshed ${refreshed}x (want 204 after 1 re-invite)`);
refreshed = 0;
out = await loginOrRefresh(stale, loginAs({ old: 500, new: 204 }), refresh);
if (out.status !== 500 || refreshed !== 0) failures.push(`non-401 must not refresh: ${out.status}, refreshed ${refreshed}x`);
out = await loginOrRefresh(stale, loginAs({ old: 401, new: 204 }), null);
if (out.status !== 401) failures.push(`no slot: ${out.status} (want 401 unchanged)`);
refreshed = 0;
out = await loginOrRefresh(stale, loginAs({ old: 401, new: 401 }), refresh);
if (out.status !== 401 || refreshed !== 1) failures.push(`fresh user still 401: ${out.status}, refreshed ${refreshed}x (want 401 after exactly 1 re-invite)`);

if (failures.length) {
  console.error(`check-pool-file${OLD ? ' --old' : ''}: RED - ${failures.join(' | ')}`);
  process.exit(1);
}
console.log(`check-pool-file${OLD ? ' --old' : ''}: GREEN - ${PROCS * PER_PROC} slots from ${PROCS} processes, 429 fallback ok`);
