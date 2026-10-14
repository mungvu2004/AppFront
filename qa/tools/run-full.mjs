// One command for a phase run on the f14 stack, with the steps that were done by hand (and got forgotten):
//   1. BE build source (backendSourceRoot) at origin/main; web image built from a commit whose tree equals HEAD
//      outside qa/ (a qa-only commit does not need a rebuild). Either stale → `chuoi.sh build` + `up`.
//   2. Static check: fixed waits in this phase's specs (setTimeout in a route handler, waitForTimeout) — listed,
//      not failed; they caused FL-11-09 / CP-5 style flakes in phase 03.
//   3. Previous phase's main chain (its .state project feeds this phase's main), then run-phase.mjs for phase NN.
//   4. Failing tests run once more in the same run (--retries 1): red-red = real, red-green = "flaky" (back to the author, never
//      accepted). Failure table with each test's recent history, and <runId>/reds.json grouped by error signature for triage.
//   Headless by default (slowMo 0); --watch = headed + config slowMo, for the acceptance run only.
// Usage (from qa/, under the stack lock):
//   node F:/App/qa-results/tools/stack-lock.mjs node tools/run-full.mjs --phase 04 --run-id run-50 [--workers 4]
//        [--layers main,ui,api,edge] [--grep re] [--no-prev] [--no-build] [--history 6] [--watch] [--retries 1] [--check]
//        [--dry-run]  (run-phase only prints the --grep it received; tools/check-grep-passthrough.mjs uses it)
//        [--allow-empty]  (a selected layer that ran 0 tests is EMPTY = red; this lets it pass while another layer ran)
// Exit code = run-phase's (non-zero when a selected layer ran 0 tests, tools/check-zero-tests.mjs). Never prunes images/volumes.
import { spawnSync } from 'node:child_process';
import { existsSync, readFileSync, readdirSync, rmSync, statSync, writeFileSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const SUITE = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const REPO = resolve(SUITE, '..');
const cfg = JSON.parse(readFileSync(join(SUITE, 'qa.config.json'), 'utf8'));
// QA_RESULTS_DIR: results root override (self-checks write to a temp dir, never into qa-results).
if (process.env.QA_RESULTS_DIR) cfg.resultsDir = process.env.QA_RESULTS_DIR;
const argv = process.argv.slice(2);
const flag = (n) => argv.includes(`--${n}`);
const opt = (n, d) => (argv.includes(`--${n}`) ? argv[argv.indexOf(`--${n}`) + 1] : d);
const NN = String(opt('phase', '')).padStart(2, '0');
const RUN_ID = opt('run-id', '');
if (!/^\d{2}$/u.test(NN) || RUN_ID === '') {
  console.error('usage: node tools/run-full.mjs --phase NN --run-id run-XX [--workers 4] [--layers ...] [--grep re] [--no-prev] [--no-build]');
  process.exit(2);
}
const WORKERS = opt('workers', '4');
const HISTORY = Number(opt('history', '6'));
const F14 = 'F:/App/AppBack/backend/dieu-phoi/chay/F-14';
// chuoi.sh builds from this detached worktree (its BE default), not from config.backendSourceRoot (the main checkout).
const BE_SRC = 'C:/Users/mxuan/orca/workspaces/AppBack/qa-main';
const STAMP = join(F14, '.built-be');

const sh = (cmd, cwd = SUITE) => spawnSync(cmd, { cwd, shell: true, encoding: 'utf8' });
const out = (cmd, cwd) => sh(cmd, cwd).stdout.trim();
// No shell: cmd.exe would split a --grep regex at `|` (QA-06b run-063); an argv array reaches run-phase verbatim.
const runPhase = (args) => spawnSync(process.execPath, ['tools/run-phase.mjs', ...args], { cwd: SUITE, stdio: 'inherit' }).status ?? 1;
const say = (s) => console.log(`[run-full] ${s}`);

/* 1. versions */
if (!flag('no-build')) {
  sh('git fetch -q origin', BE_SRC);
  const beHead = out('git rev-parse --short HEAD', BE_SRC);
  const beMain = out('git rev-parse --short origin/main', BE_SRC);
  if (beHead !== beMain) {
    say(`BE build source ${beHead} ≠ origin/main ${beMain} → checkout --detach origin/main`);
    if (sh('git checkout -q --detach origin/main', BE_SRC).status !== 0) {
      say('BE source has local changes; fix by hand');
      process.exit(2);
    }
  }
  const builtBe = existsSync(STAMP) ? readFileSync(STAMP, 'utf8').trim() : '';
  const label = out(`docker inspect ${cfg.versionCheck.webImage} --format "{{index .Config.Labels \\"${cfg.versionCheck.webRevisionLabel}\\"}}"`);
  const head = out('git rev-parse --short HEAD', REPO);
  // Same app tree as HEAD outside qa/, e2e/ and unit tests → the image is current even if its label is an older commit.
  const webOk = label !== '' && sh(`git diff --quiet ${label} HEAD -- . ":(exclude)qa" ":(exclude)e2e" ":(glob,exclude)**/*.test.ts" ":(glob,exclude)**/*.test.tsx" ":(glob,exclude)**/__tests__/**"`, REPO).status === 0;
  // Only image inputs count: a docs/DEBT-only commit on main does not need a rebuild.
  const beOk = builtBe !== '' && sh(`git diff --quiet ${builtBe} origin/main -- apps packages deploy pyproject.toml uv.lock`, BE_SRC).status === 0;
  say(`web image ${label || '?'} (HEAD ${head}) ${webOk ? 'current' : 'STALE'}; api/worker ${builtBe || '?'} vs ${beMain} ${beOk ? 'current' : 'STALE'}`);
  if (!webOk || !beOk) {
    for (const d of readdirSync(F14).filter((d) => d.startsWith('web-ctx-'))) rmSync(join(F14, d), { recursive: true, force: true });
    // chuoi.sh is Git Bash; `shell: true` is cmd.exe on Windows, so call bash directly.
    const built = spawnSync('bash', ['-c', `WEB_SHA=${head} bash chuoi.sh build && bash chuoi.sh up`], { cwd: F14, stdio: 'inherit' });
    if (built.status !== 0) {
      say('build/up failed');
      process.exit(1);
    }
    writeFileSync(STAMP, `${beMain}\n`);
  } else {
    // A prebuilt tag (prebuild.sh) leaves the old container running: compare the running image with the tag, not only the label
    // (phase 06 RR ran the S fixes against the R1 web image).
    const stale = [['f14-web-1', 'appback-web:f14'], ['f14-api-1', 'appback-api:f14'], ['f14-worker-1', 'appback-worker:f14']]
      .filter(([c, tag]) => out(`docker inspect ${c} --format "{{.Image}}"`) !== out(`docker image inspect ${tag} --format "{{.Id}}"`));
    if (stale.length) {
      say(`containers older than their tags: ${stale.map(([c]) => c).join(', ')} → chuoi.sh up`);
      if (spawnSync('bash', ['-c', 'bash chuoi.sh up'], { cwd: F14, stdio: 'inherit' }).status !== 0) {
        say('build/up failed');
        process.exit(1);
      }
    }
  }
  const health = out(`curl -s -o /dev/null -w "%{http_code}" ${cfg.env.healthUrl}`);
  if (health !== '200') {
    say(`health ${health}: bring the stack up (${cfg.env.bringUp})`);
    process.exit(1);
  }
}

/* 1b. env preflight (QA-04 run-041: 3 invalid runs = 1h15): login locks left by an earlier run, admin missing on a rebuilt
 *     stack, .state project absent from a fresh DB. Fails in seconds instead of after a full run. */
if (!flag('no-build')) {
  sh(`docker exec f14-redis-broker-1 sh -c "redis-cli -n 2 --scan --pattern 'auth:login:*' | xargs -r redis-cli -n 2 del; redis-cli -n 2 --scan --pattern 'rl:auth_login_ip:*' | xargs -r redis-cli -n 2 del"`);
  const secrets = Object.fromEntries(
    readFileSync(cfg.env.secretsFile, 'utf8').split(/\r?\n/u).map((l) => l.replace(/^export\s+/u, '').match(/^([A-Z0-9_]+)=(.*)$/u)).filter(Boolean)
      .map((m) => [m[1], m[2].replace(/^["']|["']$/gu, '')]),
  );
  const base = cfg.env.vars.E2E_FULLSTACK_BASE_URL;
  const post = (path, init = {}) => fetch(`${base}${path}`, { method: 'POST', ...init, headers: { Origin: base, 'Content-Type': 'application/json', ...(init.headers ?? {}) } });
  const fail = (why) => { say(`preflight: ${why}`); process.exit(2); };
  const login = await post('/api/auth/login', { body: JSON.stringify({ email: secrets.E2E_ADMIN_EMAIL, password: secrets.E2E_ADMIN_PASSWORD, rememberMe: false }) });
  if (login.status !== 204) {
    fail(`admin login ${login.status} (401 = admin missing on a rebuilt stack: run "chuoi.sh seed" create-admin step; 429 = login lock)`);
  }
  const cookie = login.headers.getSetCookie().map((c) => c.split(';')[0]).join('; ');
  const token = (await (await post('/api/auth/refresh', { headers: { Cookie: cookie } })).json().catch(() => ({}))).accessToken;
  const stateFile = join(SUITE, 'tests', '.state', 'runtime-session.json');
  // A run that replays the main chain 01..NN-1 (step 3) makes a fresh .state project itself: only a run that reuses .state needs it alive.
  const replaysChain = !flag('no-prev') && opt('layers', 'main,ui,api,edge').split(',').includes('main');
  if (token && existsSync(stateFile) && Number(NN) > 2 && !replaysChain) {
    const id = JSON.parse(readFileSync(stateFile, 'utf8')).project?.projectId;
    const r = id ? await fetch(`${base}/api/projects/${id}`, { headers: { Authorization: `Bearer ${token}` } }) : null;
    if (!r || r.status !== 200) fail(`.state project ${id ?? '?'} → ${r?.status ?? 'none'}: stale state from another stack; rebuild with run-phase --phase 01..${String(Number(NN) - 1).padStart(2, '0')} --layers main`);
  }
  say('preflight: admin login 204, login locks cleared, .state project reachable');
}

if (flag('check')) {
  say('--check: versions ok, no run');
  process.exit(0);
}

/* 2. fixed waits */
const specs = readdirSync(join(SUITE, 'tests')).filter((f) => f.startsWith(`phase${NN}_`) && f.endsWith('.ts'));
const waits = [];
for (const f of specs) {
  readFileSync(join(SUITE, 'tests', f), 'utf8')
    .split('\n')
    .forEach((line, i) => {
      if (/waitForTimeout\(|setTimeout\(\s*resolve\s*,\s*\d/u.test(line) && !/fixed-wait-ok/u.test(line)) waits.push(`${f}:${i + 1}`);
    });
}
if (waits.length) say(`fixed waits (flake risk; mark intended ones with "fixed-wait-ok"): ${waits.length}\n  ${waits.join('\n  ')}`);

/* 2b. shared main-chain state: worktrees start without it (QA-04c run-52 failed on it) */
const STATE = join(SUITE, 'tests', '.state', 'runtime-session.json');
if (!existsSync(STATE) && Number(NN) > 2 && opt('layers', 'main').split(',').includes('main')) {
  say(`missing ${STATE}: copy F:/App/AppFront/qa/tests/.state/ into this suite (or run with --layers ui,api,edge)`);
  process.exit(2);
}

/* 3. run */
const prev = String(Number(NN) - 1).padStart(2, '0');
const layers = opt('layers', 'main,ui,api,edge');
const extra = [...(opt('grep', '') ? ['--grep', opt('grep', '')] : []), ...(opt('repeat', '') ? ['--repeat', opt('repeat', '')] : []), '--layers', layers, ...['dry-run', 'allow-empty'].filter(flag).map((f) => `--${f}`)];
if (!flag('no-prev') && layers.split(',').includes('main') && Number(NN) > 1) {
  // Replay the WHOLE chain 01..NN-1: phase 02 creates a fresh .state project. Replaying only NN-1 reused the project of an
  // earlier run, so every replay piled up floors/drawings and the fixed counts of NN-1 main went red (phase 04 RF 2026-10-15).
  for (let p = 1; p <= Number(prev); p += 1) {
    const id = String(p).padStart(2, '0');
    say(`phase ${id} main (chain to a fresh .state project for phase ${NN} main)`);
    sh(`docker exec f14-redis-broker-1 sh -c "redis-cli -n 2 --scan --pattern 'auth:login:*' | xargs -r redis-cli -n 2 del; redis-cli -n 2 --scan --pattern 'rl:auth_login_ip:*' | xargs -r redis-cli -n 2 del"`);
    if (runPhase(['--phase', id, '--run-id', RUN_ID, '--layers', 'main', '--no-typecheck', '--no-watch']) !== 0) say(`phase ${id} main red — phase ${NN} main may fail on state`);
  }
}
const watch = flag('watch') ? [] : ['--no-watch'];
const code = runPhase(['--phase', NN, '--run-id', RUN_ID, '--workers', WORKERS, '--retries', opt('retries', '1'), ...watch, ...extra]);
if (flag('dry-run')) process.exit(code);

/* 4. failures with history */
const root = cfg.resultsDir;
const runs = readdirSync(root)
  .filter((d) => d.startsWith('run-') && statSync(join(root, d)).isDirectory())
  .sort((a, b) => statSync(join(root, a)).mtimeMs - statSync(join(root, b)).mtimeMs);
const detail = new Map();
const statuses = (run) => {
  const map = new Map();
  for (const tag of [`phase${NN}`, `phase${NN}-ui`, `phase${NN}-api`, `phase${NN}-edge`]) {
    const file = join(root, run, tag, 'results.json');
    if (!existsSync(file)) continue;
    const walk = (s) => {
      for (const x of s.suites ?? []) walk(x);
      for (const sp of s.specs ?? [])
        for (const t of sp.tests) {
          const last = t.results.at(-1);
          const status = { expected: 'passed', unexpected: last?.status === 'timedOut' ? 'timedOut' : 'failed', flaky: 'flaky', skipped: 'skipped' }[t.status] ?? last?.status;
          const error = (t.results.find((r) => r.error)?.error?.message ?? '').replace(/\u001b\[[0-9;]*m/gu, '').split('\n').find((l) => l.trim()) ?? '';
          map.set(sp.title, status);
          if (run === RUN_ID) detail.set(sp.title, { file: sp.file, line: sp.line, tag, error: error.trim().slice(0, 300) });
        }
    };
    try {
      walk(JSON.parse(readFileSync(file, 'utf8')));
    } catch {
      /* partial run */
    }
  }
  return map;
};
const now = statuses(RUN_ID);
const past = runs.filter((r) => r !== RUN_ID).map((r) => statuses(r));
const red = [...now].filter(([, s]) => s === 'failed' || s === 'timedOut' || s === 'flaky');
say(`${red.filter(([, s]) => s !== 'flaky').length} failing, ${red.filter(([, s]) => s === 'flaky').length} flaky test(s) in ${RUN_ID}`);
if (code !== 0 && red.length === 0) say(`exit ${code} with 0 failing: a layer is EMPTY (ran 0 tests: wrong --grep/--layers) or ERROR, see layers.json`);
// Triage input: one group per error signature (numbers, ids, quoted values stripped), so one agent takes a group, not a test.
const signature = (e) => e.replace(/"[^"]*"|'[^']*'|`[^`]*`/gu, '…').replace(/\d+/gu, 'N').slice(0, 160);
const groups = {};
for (const [title, s] of red) {
  const d = detail.get(title) ?? {};
  const key = s === 'flaky' ? 'flaky' : signature(d.error ?? '');
  (groups[key] ??= []).push({ title, status: s, ...d });
}
writeFileSync(join(root, RUN_ID, 'reds.json'), JSON.stringify(groups, null, 2));
say(`${Object.keys(groups).length} group(s) → ${join(root, RUN_ID, 'reds.json')}`);
for (const [title, s] of red) {
  // Last HISTORY runs that ran this test (oldest → newest): P pass, F fail, s skip.
  const hist = past.filter((m) => m.has(title)).slice(-HISTORY).map((m) => ({ passed: 'P', skipped: 's' })[m.get(title)] ?? 'F').join('');
  const greens = (hist.match(/P/gu) ?? []).length;
  console.log(`  ${{ timedOut: 'T', flaky: '~' }[s] ?? 'F'} [${hist}] ${greens >= 2 && s !== 'flaky' ? 'flaky? ' : ''}${title.slice(0, 140)}`);
}
process.exit(code);
