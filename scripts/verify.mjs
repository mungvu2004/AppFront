/**
 * Lệnh kiểm tổng — `pnpm verify`.
 *
 * Một lệnh chạy hết những gì quyết định "xong": kiểu, luật, test, độ phủ, kích
 * thước gói, độ dài file, import vòng. Dừng ở bước hỏng đầu tiên, vì bước sau
 * đọc kết quả bước trước (đo kích thước gói cần bản dựng) và vì một trang log
 * toàn lỗi từ bảy bước cùng lúc thì không ai đọc.
 *
 * Vì sao "test" và "độ phủ" là MỘT bước: `vitest run --coverage` chạy đúng bộ
 * test đó một lần rồi đối chiếu ngưỡng trong `vitest.config.ts`. Tách làm hai
 * lệnh thì bộ test chạy hai lượt, tốn gấp đôi thời gian CI mà không biết thêm
 * điều gì. Bước này hỏng khi có test đỏ HOẶC độ phủ dưới ngưỡng.
 *
 * `typecheck` và `lint`+`import vòng` chạy SONG SONG (PERF-01 FE-8 / C1): cả ba
 * chỉ cần mã nguồn, không phụ thuộc nhau, nên không có lý do bắt cái sau chờ
 * cái trước. `lint` và `import vòng` còn dùng CHUNG một lượt gọi ESLint (C3):
 * `import/no-cycle` tự nó đã phải dựng đồ thị phụ thuộc của toàn bộ `src`, phần
 * tốn thời gian nhất, bất kể có chạy kèm luật nào khác — tách thành lệnh eslint
 * thứ hai chỉ để lọc riêng một luật là trả giá đó hai lần. Một lượt API, lọc
 * message theo `ruleId` thành hai "bước" để báo cáo, tốn đúng một lần.
 *
 * `build` của verify KHÔNG gọi `tsc` lần hai (PERF-01 FE-8 / C2): bước
 * `typecheck` ở trên đã xác nhận kiểu rồi, nên ở đây chỉ cần dựng Pascal rồi
 * `vite build` để đo kích thước gói. `pnpm build` (lệnh cho người dùng chạy
 * ngoài verify) vẫn giữ nguyên `tsc && vite build`.
 *
 * Cấm báo "đạt" cho bước chưa chạy (CLAUDE.md mục E.10). Bảng tổng kết cuối chỉ
 * in trạng thái lấy từ mã thoát thật, và bước chưa tới thì ghi "chưa chạy".
 * Output từng bước được đệm rồi in theo đúng thứ tự bước — kể cả hai bước chạy
 * song song — để không trộn log.
 */
import { spawn, spawnSync } from 'node:child_process';
import { ESLint } from 'eslint';

const PENDING = 'chưa chạy';
const PASSED = 'đạt';
const FAILED = 'HỎNG';

/** Luật chặn import vòng — cùng tham số với `check-import-cycles.mjs`. */
const CYCLE_RULE = { 'import/no-cycle': ['error', { maxDepth: '∞', ignoreExternal: true }] };

/** Bảy bước, đúng thứ tự phụ thuộc — chỉ dùng để in nhãn/mô tả và bảng tổng kết. */
const STEPS = [
  { name: 'typecheck', description: 'tsc --noEmit' },
  { name: 'lint', description: 'bộ luật dự án, --max-warnings 0' },
  { name: 'import vòng', description: 'import/no-cycle — cùng lượt ESLint với lint (C3)' },
  { name: 'test + độ phủ', description: 'vitest run --coverage, ngưỡng domain 90% / lib 80%' },
  { name: 'build', description: 'pnpm pascal && vite build — tsc đã chạy ở bước typecheck' },
  { name: 'kích thước gói', description: 'ngân sách gzip' },
  { name: 'độ dài file', description: 'R-21/R-22 — dòng có nội dung, nhắc 250, hỏng 400' },
];

/** Chạy một lệnh con, đệm stdout/stderr để in sau mà không trộn với lệnh khác. */
function runBuffered(command, args) {
  return new Promise((resolve) => {
    const chunks = [];
    const child = spawn(command, args, { shell: true });
    child.stdout.on('data', (chunk) => chunks.push(chunk));
    child.stderr.on('data', (chunk) => chunks.push(chunk));
    child.on('close', (code) => resolve({ code: code ?? 1, output: Buffer.concat(chunks).toString('utf8') }));
  });
}

/**
 * Một lượt ESLint phục vụ cả "lint" và "import vòng". Lọc message theo
 * `ruleId` để tách thành hai bộ đếm/báo cáo, nhưng đồ thị phụ thuộc (phần
 * chậm) chỉ dựng một lần.
 */
async function runLintAndCycles() {
  const eslint = new ESLint({
    extensions: ['ts', 'tsx'],
    reportUnusedDisableDirectives: 'error',
    overrideConfig: { rules: CYCLE_RULE },
  });
  const results = await eslint.lintFiles(['.']);
  const formatter = await eslint.loadFormatter('stylish');

  const bucket = (isCycle) => {
    const filtered = results.map((result) => {
      const messages = result.messages.filter((m) => (m.ruleId === 'import/no-cycle') === isCycle);
      return {
        ...result,
        messages,
        errorCount: messages.filter((m) => m.severity === 2).length,
        warningCount: messages.filter((m) => m.severity === 1).length,
      };
    });
    const problems = filtered.reduce((n, r) => n + r.errorCount + r.warningCount, 0);
    // `--max-warnings 0`: một cảnh báo cũng là hỏng, giống `pnpm lint`.
    return { code: problems > 0 ? 1 : 0, output: formatter.format(filtered) };
  };

  return { lint: bucket(false), cycles: bucket(true) };
}

function printStep(label, output) {
  console.log(`\n${'='.repeat(72)}`);
  console.log(`▶ ${label}`);
  console.log('='.repeat(72));
  if (output) process.stdout.write(output.endsWith('\n') ? output : `${output}\n`);
}

async function main() {
  const results = STEPS.map((step) => ({ step, status: PENDING }));
  const byName = Object.fromEntries(results.map((r) => [r.step.name, r]));
  let failedAt = null;

  // Nhóm song song: typecheck ∥ (lint + import vòng), không phụ thuộc nhau.
  const [typecheckResult, lintAndCycles] = await Promise.all([
    runBuffered('pnpm', ['typecheck']),
    runLintAndCycles(),
  ]);

  const parallelOutcomes = [
    { name: 'typecheck', label: `${STEPS[0].name} — ${STEPS[0].description}`, ...typecheckResult },
    { name: 'lint', label: `${STEPS[1].name} — ${STEPS[1].description}`, ...lintAndCycles.lint },
    { name: 'import vòng', label: `${STEPS[2].name} — ${STEPS[2].description}`, ...lintAndCycles.cycles },
  ];

  for (const outcome of parallelOutcomes) {
    printStep(outcome.label, outcome.output);
    byName[outcome.name].status = outcome.code === 0 ? PASSED : FAILED;
    if (failedAt === null && outcome.code !== 0) {
      failedAt = { step: byName[outcome.name].step, code: outcome.code };
    }
  }

  // Phần tuần tự: chỉ chạy nếu cả nhóm song song ở trên đều đạt. `build` ở đây
  // không gọi lại `tsc` — xem chú thích đầu file (C2).
  const SEQUENTIAL_STEPS = [
    { name: 'test + độ phủ', command: 'pnpm', args: ['coverage', '--coverage.reporter=text', '--coverage.reporter=json-summary'] },
    { name: 'build', command: 'pnpm pascal && pnpm exec vite build', args: [] },
    { name: 'kích thước gói', command: 'pnpm', args: ['size'] },
    { name: 'độ dài file', command: 'pnpm', args: ['length'] },
  ];

  if (failedAt === null) {
    for (const { name, command, args } of SEQUENTIAL_STEPS) {
      const step = byName[name].step;
      printStep(`${step.name} — ${step.description}`, '');

      // `shell: true` vì trên Windows `pnpm` là file .cmd, không phải file thực thi.
      const run = spawnSync(command, args, { stdio: 'inherit', shell: true });
      const code = run.status ?? 1;

      if (code === 0) {
        byName[name].status = PASSED;
        continue;
      }

      byName[name].status = FAILED;
      failedAt = { step, code };
      break;
    }
  }

  console.log(`\n${'='.repeat(72)}`);
  console.log('KIỂM TỔNG');
  console.log('='.repeat(72));

  for (const { step, status } of results) {
    console.log(`  ${status.padEnd(9)} ${step.name}`);
  }

  console.log('');

  if (failedAt !== null) {
    console.error(
      `Dừng ở bước "${failedAt.step.name}" (mã thoát ${failedAt.code}). ` +
        'Sửa mã cho đạt, không hạ ngưỡng và không tắt luật.\n',
    );
    process.exit(failedAt.code);
  }

  console.log('Tất cả các bước đều đạt.\n');
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
