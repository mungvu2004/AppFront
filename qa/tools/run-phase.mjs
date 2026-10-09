// One deterministic run of a phase: typecheck, then the layers main → ui → api → edge, one Playwright
// process each, strictly sequential (they share the real stack's rate limits), then the evidence check.
// Usage (from qa/): node tools/run-phase.mjs --phase 01 --run-id run-03 [--layers main,ui,api,edge]
//                   [--grep "SCR-01|SCR-02"] [--no-watch] [--no-typecheck]
// Default (config.defaults.watch): headed + config.defaults.slowMoMs, so the run can be watched; --no-watch = headless, slowMo 0.
// Results: <resultsDir>/<runId>/<tag>[-api|-edge]/ (results.json, run.log, report/, artifacts/) and a
// machine summary <resultsDir>/<runId>/<tag>/layers.json (also the last stdout line, prefixed LAYERS_JSON=).
// Secrets come from config.env.secretsFile (KEY=VALUE lines) and are never printed.
import { spawn, spawnSync } from 'node:child_process';
import { createWriteStream, existsSync, mkdirSync, readFileSync, readdirSync, writeFileSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const SUITE = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const cfg = JSON.parse(readFileSync(join(SUITE, 'qa.config.json'), 'utf8'));

const argv = process.argv.slice(2);
const flag = (n) => argv.includes(`--${n}`);
const opt = (n, d) => (argv.includes(`--${n}`) ? argv[argv.indexOf(`--${n}`) + 1] : d);
const NN = String(opt('phase', '')).padStart(2, '0');
if (!/^\d{2}$/u.test(NN)) {
  console.error('usage: node tools/run-phase.mjs --phase NN --run-id run-XX [--layers main,api,edge] [--grep re] [--watch]');
  process.exit(2);
}
const RUN_ID = opt('run-id', cfg.defaults.runId);
const TAG = opt('tag', `phase${NN}`);
const LAYERS = opt('layers', 'main,ui,api,edge').split(',').filter(Boolean);
const GREP = opt('grep', '');
const WATCH = flag('no-watch') ? false : flag('watch') || cfg.defaults.watch !== false;
const fill = (s) => s.replaceAll('{resultsDir}', cfg.resultsDir).replaceAll('{runId}', RUN_ID);

// Layer of a spec file: *_api → api, *_edge → edge, *_ui → ui (dedicated UI-verification cases), else → main.
const specs = readdirSync(join(SUITE, 'tests')).filter((f) => f.startsWith(`phase${NN}_`) && f.endsWith('.spec.ts'));
const layerOf = (f) => (f.match(/_(api|edge|ui)\.spec\.ts$/u)?.[1] ?? 'main');

const env = { ...process.env, ...cfg.env.vars, E2E_SLOWMO_MS: WATCH ? String(cfg.defaults.slowMoMs) : '0' };
if (cfg.env.secretsFile && existsSync(cfg.env.secretsFile)) {
  for (const line of readFileSync(cfg.env.secretsFile, 'utf8').split(/\r?\n/u)) {
    const m = line.match(/^\s*(?:export\s+)?([A-Za-z_][A-Za-z0-9_]*)=(.*)$/u);
    if (m) env[m[1]] = m[2].trim().replace(/^(['"])(.*)\1$/u, '$2');
  }
}

const out = { phase: NN, runId: RUN_ID, tag: TAG, watch: WATCH, startedAt: new Date().toISOString(), typecheck: null, layers: [] };
const summaryDir = join(fill(cfg.resultsDir), RUN_ID, TAG);
mkdirSync(summaryDir, { recursive: true });
const finish = (code) => {
  out.finishedAt = new Date().toISOString();
  writeFileSync(join(summaryDir, 'layers.json'), JSON.stringify(out, null, 2));
  console.log(`LAYERS_JSON=${join(summaryDir, 'layers.json')}`);
  process.exit(code);
};

if (!flag('no-typecheck')) {
  const tc = spawnSync(cfg.typecheck, { cwd: resolve(SUITE, cfg.typecheckCwd), shell: true, encoding: 'utf8' });
  out.typecheck = { ok: tc.status === 0, output: `${tc.stdout}${tc.stderr}`.trim().slice(-4000) };
  if (!out.typecheck.ok) {
    console.error(out.typecheck.output);
    finish(3);
  }
}

const EVIDENCE_NAME = /^[A-Za-z0-9][A-Za-z0-9_-]*\.(png|json)$/u;
// Evidence paths point at the named file in <runId>/evidence/ (what reviewers open and group by name), not at
// Playwright's hashed copy under artifacts/.
const EVIDENCE_DIR = join(fill(cfg.resultsDir), RUN_ID, 'evidence');
const evidencePath = (a) => (existsSync(join(EVIDENCE_DIR, a.name)) ? join(EVIDENCE_DIR, a.name) : a.path);
const readReport = (file) => {
  const tests = [];
  const walk = (suite, titles) => {
    for (const spec of suite.specs ?? []) {
      for (const t of spec.tests ?? []) {
        const r = t.results?.at(-1) ?? {};
        const att = r.attachments ?? [];
        tests.push({
          file: spec.file,
          title: [...titles, spec.title].join(' › '),
          status: r.status ?? t.status ?? 'unknown',
          mocked: spec.title.includes('[mocked response]'),
          error: (r.error?.message ?? '').replace(/\u001b\[[0-9;]*m/gu, '').split('\n').find((l) => l.trim()) ?? '',
          evidence: att.filter((a) => EVIDENCE_NAME.test(a.name) && a.path).map(evidencePath),
          failureShots: att.filter((a) => a.contentType === 'image/png' && !EVIDENCE_NAME.test(a.name) && a.path).map((a) => a.path),
        });
      }
    }
    for (const c of suite.suites ?? []) walk(c, c.title ? [...titles, c.title] : titles);
  };
  for (const s of JSON.parse(readFileSync(file, 'utf8')).suites ?? []) walk(s, []);
  return tests;
};

for (const layer of LAYERS) {
  const files = specs.filter((f) => layerOf(f) === layer).map((f) => `tests/${f}`);
  const tag = layer === 'main' ? TAG : `${TAG}-${layer}`;
  const dir = join(fill(cfg.resultsDir), RUN_ID, tag);
  if (files.length === 0) {
    out.layers.push({ layer, tag, specs: [], status: 'NO_SPEC' });
    continue;
  }
  mkdirSync(dir, { recursive: true });
  const args = ['playwright', 'test', ...files, ...(WATCH ? ['--headed'] : []), ...(GREP ? ['--grep', GREP] : [])];
  const t0 = Date.now();
  const log = createWriteStream(join(dir, 'run.log'));
  const code = await new Promise((done) => {
    const p = spawn('npx', args, { cwd: SUITE, shell: true, env: { ...env, E2E_RESULTS_DIR: cfg.resultsDir, E2E_RUN_ID: RUN_ID, E2E_TAG: tag } });
    for (const s of [p.stdout, p.stderr]) s.on('data', (d) => (process.stdout.write(d), log.write(d)));
    p.on('close', done);
  });
  log.end();
  const jsonReport = join(dir, 'results.json');
  const row = { layer, tag, specs: files, exitCode: code, durationSec: Math.round((Date.now() - t0) / 1000), jsonReport, logFile: join(dir, 'run.log') };
  if (!existsSync(jsonReport)) {
    out.layers.push({ ...row, status: 'ERROR' });
    continue;
  }
  const tests = readReport(jsonReport);
  const count = (...s) => tests.filter((t) => s.includes(t.status)).length;
  const executed = tests.filter((t) => ['passed', 'failed', 'timedOut', 'interrupted'].includes(t.status));
  const missing = executed.filter((t) => t.evidence.length === 0 && !(t.status !== 'passed' && t.failureShots.length)).map((t) => t.title);
  out.layers.push({
    ...row,
    status: count('failed', 'timedOut', 'interrupted') ? 'FAIL' : 'PASS',
    total: tests.length,
    passed: count('passed'),
    failed: count('failed', 'timedOut', 'interrupted'),
    skipped: count('skipped'),
    mocked: tests.filter((t) => t.mocked).length,
    evidenceOk: missing.length === 0,
    missingEvidence: missing,
    failures: tests.filter((t) => ['failed', 'timedOut', 'interrupted'].includes(t.status)).map((t) => ({ title: t.title, file: t.file, error: t.error, shots: t.failureShots, evidence: t.evidence })),
    evidence: tests.flatMap((t) => t.evidence.map((path) => ({ path, test: t.title, status: t.status }))),
  });
}

// Mock share counts the UI layers only (an API test never mocks).
const ui = out.layers.filter((l) => l.layer !== 'api' && l.total);
out.uiTotal = ui.reduce((n, l) => n + l.total, 0);
out.mocked = ui.reduce((n, l) => n + l.mocked, 0);
out.mockShare = out.uiTotal ? +(out.mocked / out.uiTotal).toFixed(3) : 0;
out.mockShareOver = out.mockShare > (cfg.rules?.maxMockedShare ?? 1);
const bad = out.layers.some((l) => ['FAIL', 'ERROR'].includes(l.status));
for (const l of out.layers) console.log(`${l.layer.padEnd(4)} ${l.status} ${l.passed ?? 0}/${l.total ?? 0} in ${l.durationSec ?? 0}s, evidence ${l.evidenceOk === false ? `MISSING ${l.missingEvidence.length}` : 'ok'}`);
finish(bad ? 1 : 0);
