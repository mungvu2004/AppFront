// End-of-run cleanup: removes only garbage a QA run leaves behind. Usage (from qa/):
//   node tools/cleanup.mjs --run-id run-06 [--dry-run]
// Removes:
//   - videos of PASSED tests of this run (failed tests keep theirs; evidence images are never touched)
//   - leftover Mailpit mails to @<rules.testEmailDomain>
//   - leftover Testcontainers containers and exited AppBack verify containers (skipped while a verify run is live)
//   - orphan images: untagged AND without a repo digest (pinned-by-digest images such as trivy/gitleaks stay)
//   - Docker build cache unused for 7 days
// Never touches: tagged images, volumes (appback-work = pytest venv cache, stack data, other projects), the
// running stack, results/evidence of any run. Prints a summary; last line CLEANUP_JSON=<path>.
import { execFileSync } from 'node:child_process';
import { existsSync, readFileSync, readdirSync, rmSync, statSync, writeFileSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const SUITE = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const cfg = JSON.parse(readFileSync(join(SUITE, 'qa.config.json'), 'utf8'));
const argv = process.argv.slice(2);
const RUN_ID = argv.includes('--run-id') ? argv[argv.indexOf('--run-id') + 1] : '';
const DRY = argv.includes('--dry-run');
if (!/^run-\d+$/u.test(RUN_ID)) {
  console.error('usage: node tools/cleanup.mjs --run-id run-NN [--dry-run]');
  process.exit(2);
}
const RUN_DIR = join(cfg.resultsDir, RUN_ID);
const out = { runId: RUN_ID, dryRun: DRY, videos: { removed: 0, bytes: 0 }, mails: 0, containers: [], images: [], buildCache: '', skipped: [], errors: [] };

const docker = (...args) => execFileSync('docker', args, { encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'] }).trim();
const lines = (s) => s.split('\n').map((l) => l.trim()).filter(Boolean);
const step = (name, fn) => {
  try {
    fn();
  } catch (error) {
    out.errors.push(`${name}: ${String(error.message ?? error).split('\n')[0]}`);
  }
};

// 1. Videos of passed tests (every layer of this run).
step('videos', () => {
  if (!existsSync(RUN_DIR)) return;
  for (const tag of readdirSync(RUN_DIR)) {
    const report = join(RUN_DIR, tag, 'results.json');
    if (!existsSync(report)) continue;
    const walk = (suite) => {
      for (const spec of suite.specs ?? []) {
        for (const t of spec.tests ?? []) {
          const r = t.results?.at(-1);
          if (r?.status !== 'passed') continue;
          for (const a of r.attachments ?? []) {
            if (a.name !== 'video' || !a.path || !existsSync(a.path)) continue;
            out.videos.removed += 1;
            out.videos.bytes += statSync(a.path).size;
            if (!DRY) rmSync(a.path);
          }
        }
      }
      for (const c of suite.suites ?? []) walk(c);
    };
    for (const s of JSON.parse(readFileSync(report, 'utf8')).suites ?? []) walk(s);
  }
});

// 2. Leftover test mails (tests delete their own; this sweeps what a crashed test left).
const mailpit = cfg.env?.mailpitUrl;
const domain = cfg.rules?.testEmailDomain;
if (mailpit && domain) {
  const query = encodeURIComponent(`to:"@${domain}"`);
  try {
    const found = await (await fetch(`${mailpit}/api/v1/search?query=${query}&limit=1`)).json();
    out.mails = found.messages_count ?? found.total ?? 0;
    if (!DRY && out.mails > 0) await fetch(`${mailpit}/api/v1/search?query=${query}`, { method: 'DELETE' });
  } catch (error) {
    out.errors.push(`mailpit: ${error.message}`);
  }
}

// 3. Containers: leftover Testcontainers + exited verify containers. A live verify run owns its testcontainers.
step('containers', () => {
  if (lines(docker('ps', '-q', '--filter', 'name=appback-verify', '--filter', 'status=running')).length) {
    out.skipped.push('containers: an AppBack verify run is live');
    return;
  }
  const ids = [
    ...lines(docker('ps', '-aq', '--filter', 'label=org.testcontainers=true')),
    ...lines(docker('ps', '-aq', '--filter', 'name=appback-verify', '--filter', 'status=exited')),
  ];
  for (const id of new Set(ids)) {
    out.containers.push(docker('inspect', '--format', '{{.Name}} {{.Config.Image}}', id));
    if (!DRY) docker('rm', '-f', '-v', id);
  }
});

// 4. Orphan images: no tag and no repo digest (left by rebuilds). Pulled-by-digest images keep their digest.
step('images', () => {
  for (const row of lines(docker('images', '--filter', 'dangling=true', '--format', '{{.ID}} {{.Digest}} {{.Size}}'))) {
    const [id, digest, size] = row.split(' ');
    if (digest && digest !== '<none>') continue;
    if (lines(docker('ps', '-aq', '--filter', `ancestor=${id}`)).length) continue;
    out.images.push(`${id} ${size}`);
    if (!DRY) docker('rmi', id);
  }
});

// 5. Build cache unused for a week (recent cache keeps the verify image rebuild fast).
step('build cache', () => {
  out.buildCache = DRY ? 'dry-run' : lines(docker('builder', 'prune', '-f', '--filter', 'until=168h')).at(-1) ?? '';
});

const file = join(RUN_DIR, 'cleanup.json');
if (existsSync(RUN_DIR)) writeFileSync(file, JSON.stringify(out, null, 2));
console.log(`${DRY ? '[dry-run] ' : ''}videos of passed tests: ${out.videos.removed} (${(out.videos.bytes / 1048576).toFixed(1)} MB)`);
console.log(`test mails: ${out.mails} - containers: ${out.containers.length} - orphan images: ${out.images.length} - build cache: ${out.buildCache || '-'}`);
for (const s of out.skipped) console.log(`skipped ${s}`);
for (const e of out.errors) console.log(`error ${e}`);
console.log(`CLEANUP_JSON=${file}`);
