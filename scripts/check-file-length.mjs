/**
 * R-21 / R-22 — độ dài file component.
 *
 * Một file component dài không hỏng lúc chạy; nó hỏng lúc đọc. Quá một màn hình
 * thì không ai giữ được toàn bộ file trong đầu, nên người sửa tiếp theo thêm
 * nhánh mới vào cuối thay vì tách — và file dài thêm. Cổng này biến "hơi dài"
 * thành một con số phải nhìn.
 *
 * ĐƠN VỊ ĐẾM: **dòng có nội dung**, tức `line.trim() !== ''`. Dòng trống không
 * tính. Hai cách đếm cho ra hai bộ số khác nhau trên cùng cây mã (8/2 so với
 * 12/3), nên đơn vị phải nói ra chứ không để người đọc đoán.
 *
 * HAI NGƯỠNG:
 *   - 250 — nhắc. In ra, không làm hỏng lệnh. Đây là R-21, mức NÊN.
 *   - 400 — hỏng. Thoát mã 1. Đây là R-22.
 *
 * Ngưỡng chọn theo phân bố thật của repo, không chọn theo cảm giác: trung vị
 * `.tsx` sản phẩm khoảng 110 dòng, phân vị 90 khoảng 330. Mức 400 hiện bắt đúng
 * hai file, nên nó không biến mã cũ thành bãi lỗi — nó chặn file thứ ba.
 *
 * NGƯỠNG KHÔNG ĐƯỢC NỚI ĐỂ CHO QUA. Vượt thì tách file, không sửa số ở đây.
 */
import { readdirSync, readFileSync, statSync } from 'node:fs';
import { join } from 'node:path';

/** Chỉ quét mã sản phẩm trong `src`. */
const ROOT = 'src';

/** Ngưỡng nhắc — R-21. */
const WARN_AT = 250;

/** Ngưỡng hỏng mặc định — R-22. Ghi đè bằng `--max <số>`. */
const DEFAULT_FAIL_AT = 400;

/**
 * File không phải mã sản phẩm: bộ test và story.
 *
 * Chúng dài là chuyện bình thường — một story đủ bảy trạng thái của A11 thì
 * phải có bảy khối. Áp ngưỡng lên chúng chỉ tạo áp lực viết ít test đi.
 */
const NOT_PRODUCT = /\.test\.tsx$|\.stories\.tsx$/;

/** Thư mục bỏ qua hoàn toàn. */
const SKIP_DIRS = new Set(['__tests__', 'node_modules']);

/** Đọc `--max <số>`; không có thì dùng mặc định. */
function readFailThreshold(argv) {
  const index = argv.indexOf('--max');

  if (index === -1) {
    return DEFAULT_FAIL_AT;
  }

  const value = Number(argv[index + 1]);

  if (!Number.isInteger(value) || value <= 0) {
    throw new Error(`--max cần một số nguyên dương, nhận được: ${argv[index + 1] ?? '(trống)'}`);
  }

  return value;
}

/**
 * Liệt kê `.tsx` sản phẩm dưới `dir`, đệ quy.
 *
 * Dùng `readdirSync` chứ không dùng `globSync`: `node:fs` chỉ xuất `globSync`
 * từ Node 22 và ở đó nó vẫn là API thử nghiệm, còn `.github/workflows/ci.yml`
 * chốt `node-version: '20'`.
 */
function listProductComponents(dir) {
  const found = [];

  for (const entry of readdirSync(dir)) {
    const path = join(dir, entry);

    if (statSync(path).isDirectory()) {
      if (!SKIP_DIRS.has(entry)) {
        found.push(...listProductComponents(path));
      }
      continue;
    }

    if (entry.endsWith('.tsx') && !NOT_PRODUCT.test(entry)) {
      found.push(path);
    }
  }

  return found;
}

/** Số dòng có nội dung của một file. */
function countContentLines(path) {
  return readFileSync(path, 'utf8')
    .split('\n')
    .filter((line) => line.trim() !== '').length;
}

function main() {
  const failAt = readFailThreshold(process.argv.slice(2));

  const measured = listProductComponents(ROOT)
    .map((path) => ({ path: path.replace(/\\/g, '/'), lines: countContentLines(path) }))
    .sort((left, right) => right.lines - left.lines);

  const failed = measured.filter((file) => file.lines > failAt);
  const warned = measured.filter((file) => file.lines > WARN_AT && file.lines <= failAt);

  console.log(`\nĐộ dài file component (dòng có nội dung) — nhắc ${WARN_AT}, hỏng ${failAt}\n`);

  for (const file of failed) {
    console.log(`  HỎNG  ${String(file.lines).padStart(4)} dòng  ${file.path}`);
  }

  for (const file of warned) {
    console.log(`  nhắc  ${String(file.lines).padStart(4)} dòng  ${file.path}`);
  }

  if (failed.length === 0 && warned.length === 0) {
    console.log('  (không file nào vượt ngưỡng)');
  }

  // Số "vượt 250" tính GỘP cả file đã vượt 400 — R-21 là "quá 250 dòng", và một
  // file 460 dòng cũng quá 250. Tách hai con số rời nhau thì tổng của R-21 biến mất.
  console.log(
    `\n${measured.length} file đã quét · ${warned.length + failed.length} vượt ${WARN_AT} · ` +
      `${failed.length} vượt ${failAt}\n`,
  );

  if (failed.length > 0) {
    throw new Error(
      `${failed.length} file vượt ${failAt} dòng. Tách trước, rồi sửa. Không nới ngưỡng để cho qua.`,
    );
  }

  console.log('Độ dài file: đạt.\n');
}

try {
  main();
} catch (error) {
  console.error(`\n${error instanceof Error ? error.message : String(error)}\n`);
  process.exit(1);
}
