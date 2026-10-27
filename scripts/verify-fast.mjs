/**
 * Cổng nhanh — `pnpm verify:fast` (PERF-03).
 *
 * Vòng sửa hằng ngày cần biết "mình vừa làm vỡ gì chưa" trong một phút, không cần
 * phán quyết đầy đủ của `pnpm verify`. Lượt này chỉ đụng phần bị đổi so với
 * `origin/master`:
 *
 * - typecheck: `tsc --incremental` (cả app lẫn Pascal) — tsbuildinfo trong
 *   `node_modules/.cache/verify-fast`, nên lượt sau chỉ kiểm lại phần đổi;
 * - lint: ESLint trên đúng các tệp `.ts/.tsx` bị đổi, KHÔNG `import/no-cycle`;
 * - test: `vitest run --changed <gốc>` — test nhập (trực tiếp hay gián tiếp) tệp bị
 *   đổi, KHÔNG độ phủ;
 * - độ dài file: như cổng đầy đủ (rẻ).
 *
 * Không build, không kích thước gói, không ngưỡng độ phủ, không import vòng:
 * `pnpm verify` đầy đủ vẫn chạy trước merge và là phán quyết duy nhất.
 *
 * Bốn bước độc lập nên chạy song song; output đệm rồi in theo thứ tự bước, bảng chỉ
 * in trạng thái từ mã thoát thật (E.10).
 */
import { spawn, spawnSync } from 'node:child_process';
import { existsSync, mkdirSync } from 'node:fs';
import { ESLint } from 'eslint';

const PASSED = 'đạt';
const FAILED = 'HỎNG';
const NOT_APPLICABLE = 'không áp dụng';
const CACHE_DIR = 'node_modules/.cache/verify-fast';
const LINTED = /\.(ts|tsx)$/;

function git(args) {
  const run = spawnSync('git', args, { encoding: 'utf8' });
  return run.status === 0 ? run.stdout.trim() : '';
}

/**
 * Gốc so sánh: `VERIFY_FAST_BASE` nếu đặt (vd `HEAD` = chỉ phần chưa commit), không thì merge-base với
 * `origin/master` (local `master` có thể chậm hơn), rồi `master`.
 */
function baseRef() {
  return process.env.VERIFY_FAST_BASE || git(['merge-base', 'HEAD', 'origin/master']) || git(['merge-base', 'HEAD', 'master']) || 'HEAD';
}

/** Tệp bị đổi so với `base`: đã commit, chưa commit và chưa theo dõi — chỉ tệp còn trên đĩa. */
function changedFiles(base) {
  const lines = [
    ...git(['diff', '--name-only', base]).split('\n'),
    ...git(['ls-files', '--others', '--exclude-standard']).split('\n'),
  ];
  return [...new Set(lines.filter((f) => f && existsSync(f)))];
}

function runBuffered(command, env) {
  return new Promise((resolve) => {
    const started = Date.now();
    const chunks = [];
    const child = spawn(command, { shell: true, env: { ...process.env, ...env } });
    child.stdout.on('data', (chunk) => chunks.push(chunk));
    child.stderr.on('data', (chunk) => chunks.push(chunk));
    child.on('close', (code) =>
      resolve({ code: code ?? 1, output: Buffer.concat(chunks).toString('utf8'), seconds: (Date.now() - started) / 1000 }),
    );
  });
}

/** Chế độ con `--lint` (tệp trong `VERIFY_FAST_FILES`): ESLint chạy ở tiến trình riêng để không chặn vòng sự kiện đọc output vitest. */
async function lintChild(files) {
  const eslint = new ESLint({ extensions: ['ts', 'tsx'], reportUnusedDisableDirectives: 'error' });
  const kept = [];
  for (const file of files) if (!(await eslint.isPathIgnored(file))) kept.push(file);
  if (kept.length === 0) return 0;
  const results = await eslint.lintFiles(kept);
  process.stdout.write((await eslint.loadFormatter('stylish')).format(results));
  // `--max-warnings 0` như `pnpm lint`: một cảnh báo cũng là hỏng.
  return results.some((r) => r.errorCount + r.warningCount > 0) ? 1 : 0;
}

async function main() {
  const started = Date.now();
  const base = baseRef();
  const changed = changedFiles(base);
  const lintable = changed.filter((f) => LINTED.test(f));
  mkdirSync(CACHE_DIR, { recursive: true });
  console.log(`Cổng NHANH — gốc ${base.slice(0, 10)}, ${changed.length} tệp đổi (${lintable.length} tệp ts/tsx).`);

  const tsc = (bin, project, info) =>
    `${bin} --noEmit --incremental --tsBuildInfoFile ${CACHE_DIR}/${info}${project ? ` -p ${project}` : ''}`;
  const steps = [
    {
      name: 'typecheck',
      command:
        `${tsc('pnpm exec tsc', '', 'app.tsbuildinfo')} && ` +
        tsc('node vendor/pascal/packages/core/node_modules/typescript/bin/tsc', 'tsconfig.pascal.json', 'pascal.tsbuildinfo'),
    },
    // Danh sách tệp đi qua biến môi trường: dòng lệnh cmd.exe giới hạn 8.191 ký tự, nhánh dài vượt.
    { name: 'lint (tệp đổi)', command: lintable.length ? 'node scripts/verify-fast.mjs --lint' : null },
    { name: 'test liên quan', command: `pnpm exec vitest run --changed ${base} --passWithNoTests` },
    { name: 'độ dài file', command: 'pnpm length' },
  ];

  const results = await Promise.all(
    steps.map((step) =>
      step.command ? runBuffered(step.command, { VERIFY_FAST_FILES: lintable.join('\n') }) : Promise.resolve(null),
    ),
  );

  let exitCode = 0;
  const rows = [];
  steps.forEach((step, index) => {
    const result = results[index];
    console.log(`\n${'='.repeat(72)}\n▶ ${step.name}\n${'='.repeat(72)}`);
    if (result === null) {
      rows.push([step.name, NOT_APPLICABLE, '']);
      console.log('không có tệp ts/tsx bị đổi');
      return;
    }
    if (result.output) process.stdout.write(result.output.endsWith('\n') ? result.output : `${result.output}\n`);
    rows.push([step.name, result.code === 0 ? PASSED : FAILED, `${result.seconds.toFixed(1)} s`]);
    if (result.code !== 0 && exitCode === 0) exitCode = result.code;
  });

  console.log(`\n${'='.repeat(72)}\nCỔNG NHANH — ${((Date.now() - started) / 1000).toFixed(1)} s\n${'='.repeat(72)}`);
  for (const [name, status, seconds] of rows) console.log(`  ${status.padEnd(14)} ${name.padEnd(18)} ${seconds}`);
  console.log('\nKhông build, không kích thước gói, không độ phủ, không import vòng — chạy `pnpm verify` trước merge.\n');
  process.exit(exitCode);
}

if (process.argv[2] === '--lint') {
  lintChild((process.env.VERIFY_FAST_FILES ?? '').split('\n').filter(Boolean)).then(
    (code) => process.exit(code),
    (error) => {
      console.error(error);
      process.exit(1);
    },
  );
} else {
  main().catch((error) => {
    console.error(error);
    process.exit(1);
  });
}
