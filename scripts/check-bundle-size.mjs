/**
 * Cổng kích thước gói.
 *
 * Bản dựng lớn dần theo cách không ai nhận ra: mỗi lượt thêm vài KB, không lượt
 * nào đáng nói, rồi một ngày màn hình đầu tiên mất hai giây mới hiện trên máy
 * chậm. Cổng này biến "vài KB" thành một con số phải nhìn: vượt ngân sách thì
 * lệnh hỏng, và người thêm phải nói rõ đổi gì lấy gì.
 *
 * Đo theo **gzip**, vì đó là thứ đi qua dây. Kích thước thô cũng in ra để so,
 * nhưng không phải thứ bị chặn.
 *
 * NGÂN SÁCH KHÔNG ĐƯỢC NỚI ĐỂ CHO QUA. Vượt thì tách chunk, bỏ dependency, hoặc
 * lazy-load màn hình — sửa mã chứ không sửa ngưỡng. Nới ngân sách là một quyết
 * định riêng, có người duyệt, kèm lý do trong PR.
 */
import { gzipSync } from 'node:zlib';
import { readdirSync, readFileSync, statSync } from 'node:fs';
import { join } from 'node:path';

/** Thư mục vite ghi bản dựng ra. */
const ASSETS_DIR = join('dist', 'assets');

const KIB = 1024;

/**
 * Ngân sách, tính bằng KiB sau gzip.
 *
 * Đặt từ số đo thật của bản dựng ngày 2026-08-18 — JS 155,7 KiB, CSS 7,6 KiB,
 * một chunk duy nhất — cộng khoảng dư vừa đủ. Dư ~12%: một tính năng bình thường
 * không làm đỏ CI, một dependency nặng thì có.
 *
 * Ngân sách rộng gấp đôi số đo thật thì không phải cổng, chỉ là số trang trí:
 * nó xanh cho tới lúc đã quá muộn để sửa rẻ.
 */
const BUDGETS_KIB = {
  /** Toàn bộ JavaScript. Phần lớn là three.js + react. */
  js: 175,
  /** Toàn bộ CSS. Tailwind đã purge. */
  css: 12,
  /**
   * Chunk JS lớn nhất — chặn riêng, vì một chunk khổng lồ là thứ chặn màn hình
   * đầu tiên. Hiện bản dựng chỉ có một chunk nên số này gần bằng tổng JS; nó
   * bắt đầu có ý nghĩa riêng ngay khi có code-splitting, và ngưỡng thấp hơn tổng
   * là cố ý: lối thoát khi JS phình ra là tách chunk, không phải nới số.
   */
  largestJsChunk: 170,
};

/** KiB, một chữ số thập phân, dấu phẩy theo A15. */
const formatKib = (bytes) => (bytes / KIB).toFixed(1).replace('.', ',');

/** Đọc mọi asset đã dựng, kèm kích thước thô và kích thước sau gzip. */
function readAssets() {
  let entries;

  try {
    entries = readdirSync(ASSETS_DIR);
  } catch {
    throw new Error(
      `Không thấy ${ASSETS_DIR}. Chạy \`pnpm build\` trước khi đo kích thước gói.`,
    );
  }

  return entries
    .filter((name) => name.endsWith('.js') || name.endsWith('.css'))
    .map((name) => {
      const path = join(ASSETS_DIR, name);
      const contents = readFileSync(path);

      return {
        name,
        kind: name.endsWith('.js') ? 'js' : 'css',
        rawBytes: statSync(path).size,
        gzipBytes: gzipSync(contents).length,
      };
    })
    .sort((left, right) => right.gzipBytes - left.gzipBytes);
}

function main() {
  const assets = readAssets();

  if (assets.length === 0) {
    throw new Error(`${ASSETS_DIR} rỗng. Chạy \`pnpm build\` trước khi đo kích thước gói.`);
  }

  const totalGzip = (kind) =>
    assets.filter((asset) => asset.kind === kind).reduce((sum, asset) => sum + asset.gzipBytes, 0);

  const jsAssets = assets.filter((asset) => asset.kind === 'js');
  const largestJsChunk = jsAssets.length === 0 ? 0 : Math.max(...jsAssets.map((a) => a.gzipBytes));

  console.log('\nKích thước gói (gzip)\n');
  for (const asset of assets) {
    console.log(
      `  ${asset.name.padEnd(34)} ${formatKib(asset.gzipBytes).padStart(8)} KiB` +
        `   (thô ${formatKib(asset.rawBytes)} KiB)`,
    );
  }

  const checks = [
    { label: 'tổng JS', actual: totalGzip('js'), budgetKib: BUDGETS_KIB.js },
    { label: 'tổng CSS', actual: totalGzip('css'), budgetKib: BUDGETS_KIB.css },
    { label: 'chunk JS lớn nhất', actual: largestJsChunk, budgetKib: BUDGETS_KIB.largestJsChunk },
  ];

  console.log('');
  const over = [];

  for (const check of checks) {
    const budgetBytes = check.budgetKib * KIB;
    const failed = check.actual > budgetBytes;
    const headroom = formatKib(Math.abs(budgetBytes - check.actual));

    console.log(
      `  ${failed ? 'VƯỢT ' : 'đạt  '} ${check.label.padEnd(20)} ` +
        `${formatKib(check.actual).padStart(8)} KiB / ${String(check.budgetKib).padStart(4)} KiB ` +
        `(${failed ? 'quá' : 'còn dư'} ${headroom} KiB)`,
    );

    if (failed) {
      over.push(check);
    }
  }

  console.log('');

  if (over.length > 0) {
    const names = over.map((check) => check.label).join(', ');

    throw new Error(
      `Vượt ngân sách kích thước gói: ${names}.\n` +
        'Tách chunk, bỏ dependency, hoặc lazy-load màn hình. Không nới ngân sách để cho qua.',
    );
  }

  console.log('Kích thước gói: đạt.\n');
}

try {
  main();
} catch (error) {
  console.error(`\n${error instanceof Error ? error.message : String(error)}\n`);
  process.exit(1);
}
