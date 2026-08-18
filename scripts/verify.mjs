/**
 * Lệnh kiểm tổng — `pnpm verify`.
 *
 * Một lệnh chạy hết những gì quyết định "xong": kiểu, luật, test, độ phủ, kích
 * thước gói. Chạy TUẦN TỰ và dừng ở bước hỏng đầu tiên, vì bước sau đọc kết quả
 * bước trước (đo kích thước gói cần bản dựng) và vì một trang log toàn lỗi từ
 * năm bước cùng lúc thì không ai đọc.
 *
 * Vì sao "test" và "độ phủ" là MỘT bước: `vitest run --coverage` chạy đúng bộ
 * test đó một lần rồi đối chiếu ngưỡng trong `vitest.config.ts`. Tách làm hai
 * lệnh thì bộ test chạy hai lượt, tốn gấp đôi thời gian CI mà không biết thêm
 * điều gì. Bước này hỏng khi có test đỏ HOẶC độ phủ dưới ngưỡng.
 *
 * Cấm báo "đạt" cho bước chưa chạy (CLAUDE.md mục E.10). Bảng tổng kết cuối chỉ
 * in trạng thái lấy từ mã thoát thật, và bước chưa tới thì ghi "chưa chạy".
 */
import { spawnSync } from 'node:child_process';

/** Năm bước, đúng thứ tự phụ thuộc. */
const STEPS = [
  {
    name: 'typecheck',
    description: 'tsc --noEmit',
    command: 'pnpm',
    args: ['typecheck'],
  },
  {
    name: 'lint',
    description: 'bộ luật dự án, --max-warnings 0',
    command: 'pnpm',
    args: ['lint'],
  },
  {
    name: 'test + độ phủ',
    description: 'vitest run --coverage, ngưỡng domain 90% / lib 80%',
    command: 'pnpm',
    args: ['coverage'],
  },
  {
    name: 'build',
    description: 'tsc && vite build — bước đo kích thước cần bản dựng',
    command: 'pnpm',
    args: ['build'],
  },
  {
    name: 'kích thước gói',
    description: 'ngân sách gzip',
    command: 'pnpm',
    args: ['size'],
  },
];

const PENDING = 'chưa chạy';
const PASSED = 'đạt';
const FAILED = 'HỎNG';

function main() {
  const results = STEPS.map((step) => ({ step, status: PENDING }));
  let failedAt = null;

  for (const result of results) {
    const { step } = result;
    const label = `${step.name} — ${step.description}`;

    console.log(`\n${'='.repeat(72)}`);
    console.log(`▶ ${label}`);
    console.log('='.repeat(72));

    // `shell: true` vì trên Windows `pnpm` là file .cmd, không phải file thực thi.
    const run = spawnSync(step.command, step.args, { stdio: 'inherit', shell: true });
    const code = run.status ?? 1;

    if (code === 0) {
      result.status = PASSED;
      continue;
    }

    result.status = FAILED;
    failedAt = { step, code };
    break;
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

main();
