/**
 * R-05 — cổng import vòng.
 *
 * Một vòng import không làm hỏng gì cho tới ngày nó hỏng, và hôm đó triệu chứng
 * là một biến `undefined` ở giữa một module chẳng liên quan, lúc chạy, chỉ trong
 * bản dựng sản phẩm nơi thứ tự nạp khác bản dev. Rẻ nhất là không bao giờ có
 * vòng nào; repo hiện có **0**, và cổng này tồn tại để giữ nguyên con số đó.
 *
 * VÌ SAO LÀ MỘT SCRIPT RIÊNG CHỨ KHÔNG BẬT TRONG `.eslintrc.cjs`:
 * `import/no-cycle` phải dựng đồ thị phụ thuộc của toàn bộ cây nguồn, nên nó
 * chậm thấy rõ trên hơn 500 file — đủ chậm để làm hỏng vòng lặp sửa-lint lúc
 * phát triển. Tách ra thì `pnpm lint` giữ được tốc độ, còn `pnpm verify` và CI
 * vẫn chặn thật.
 *
 * Luật truyền bằng `--rule` thay vì khai trong `eslint-rules/configs/project.js`
 * cũng vì lý do đó: khai ở đó là bật cho MỌI lần chạy eslint, kể cả lần chạy
 * trong trình soạn thảo.
 */
import { spawnSync } from 'node:child_process';

/**
 * Luật, viết thẳng thành chuỗi.
 *
 * `maxDepth: "∞"` là cách `eslint-plugin-import` nhận "không giới hạn độ sâu" —
 * mặc định của luật chỉ bắt vòng trực tiếp, mà vòng thật thường đi qua ba bốn
 * module. Không dùng `JSON.stringify` với `Infinity`: nó cho ra `null`.
 * `ignoreExternal` bỏ qua `node_modules`, nơi ta không sửa được gì.
 */
const RULE = '{"import/no-cycle":["error",{"maxDepth":"∞","ignoreExternal":true}]}';

function main() {
  console.log('\nImport vòng (import/no-cycle) — quét src/\n');

  const run = spawnSync(
    'npx',
    ['eslint', 'src', '--ext', 'ts,tsx', '--rule', RULE, '--max-warnings', '0'],
    { stdio: 'inherit', shell: true },
  );

  const code = run.status ?? 1;

  if (code !== 0) {
    throw new Error(
      'Có import vòng. Cắt vòng bằng cách đưa phần dùng chung xuống một module thấp hơn ' +
        'trong ranh giới tầng của CLAUDE.md mục 0.4 — không nới luật để cho qua.',
    );
  }

  console.log('Import vòng: không có.\n');
}

try {
  main();
} catch (error) {
  console.error(`\n${error instanceof Error ? error.message : String(error)}\n`);
  process.exit(1);
}
