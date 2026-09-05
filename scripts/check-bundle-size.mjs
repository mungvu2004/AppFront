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
 * ---
 *
 * VÌ SAO CÁC NGƯỠNG CÓ HÌNH DẠNG NÀY — nguồn: `docs/notes/bundle-size.md`.
 *
 * Bản đầu của file này đo ba thứ: tổng JS, tổng CSS, chunk lớn nhất. Nó đặt số
 * từ bản dựng ngày 2026-08-18, khi bản dựng có **đúng một chunk**. Lúc ấy "tổng
 * JS" và "chi phí màn hình đầu tiên" là **cùng một con số**, nên đo cái này là
 * đo cái kia.
 *
 * Từ khi `RouterProvider` được gắn và 25 màn được `lazy()`, hai đại lượng đó
 * tách hẳn nhau (số đo 2026-09-05):
 *
 *   - chi phí màn hình đầu tiên: **124,7 KiB** — chunk vào đóng kín, `imports: []`;
 *   - tổng mọi chunk từng được dựng ra: **760,8 KiB** — chưa ai tải chừng ấy bao giờ.
 *
 * Cổng cũ vì thế đo tổng khối lượng mã của một ứng dụng 25 màn, chứ không đo thứ
 * đoạn văn đầu file này nói là nó sinh ra để chặn. Nó đỏ thêm mỗi lần có màn mới,
 * kể cả một màn `lazy()` hoàn hảo.
 *
 * Nên bây giờ nó đo **bốn** đại lượng, và mức nghiêm khắc thì giữ nguyên — chỉ
 * đổi *thứ được đo*, không đổi *mức được phép*:
 *
 *   - `entry` 175 KiB — đúng con số cũ, đặt lên đại lượng mà nó luôn muốn chặn;
 *   - `largestJsChunk` 170 KiB — không đổi một KiB nào;
 *   - `routeChunk` 280 KiB — mới: chi phí thêm khi người dùng bước vào một màn;
 *   - `css` 12 KiB — không đổi.
 *
 * Còn tổng JS xuống làm **cảnh báo có mốc 800 KiB**: nó vẫn in ra mỗi lượt để đà
 * tăng không đi im lặng, nhưng nó không còn làm hỏng cổng — vì một màn `lazy()`
 * mới làm nó tăng mà không làm ai chậm đi.
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

/**
 * Đồ thị nhập của bản dựng, do `build.manifest` trong `vite.config.ts` ghi ra.
 *
 * Danh sách file trong `assets/` chỉ cho biết *có bao nhiêu KiB*, không cho biết
 * *ai kéo ai*. Hai trong bốn ngưỡng dưới đây cần đồ thị: phải đi từ chunk
 * `isEntry` theo `imports` (nhập tĩnh, tải ngay) và tách riêng `dynamicImports`
 * (nhập động, tải muộn). Manifest là chỗ duy nhất vite ghi sẵn đồ thị đó ra đĩa.
 */
const MANIFEST_PATH = join('dist', '.vite', 'manifest.json');

const KIB = 1024;

/**
 * Ngân sách CỔNG, tính bằng KiB sau gzip. Vượt là hỏng, mã thoát 1.
 *
 * Ngân sách rộng gấp đôi số đo thật thì không phải cổng, chỉ là số trang trí:
 * nó xanh cho tới lúc đã quá muộn để sửa rẻ. Mọi khoảng dư dưới đây nằm trong
 * khoảng 6–40%: một tính năng bình thường không làm đỏ CI, một dependency nặng
 * đi nhầm chỗ thì có.
 */
const BUDGETS_KIB = {
  /**
   * Chi phí màn hình đầu tiên: chunk `isEntry` **cộng bao đóng nhập tĩnh của
   * nó**, không phải mỗi file entry.
   *
   * BAO ĐÓNG MỚI LÀ ĐIỂM CHÍNH, đừng rút gọn thành "kích thước file entry". Hôm
   * nay chunk vào có `imports: []` nên hai cách tính ra cùng một số — nhưng nếu
   * ngày mai ai đó viết `import { Scene } from 'three'` trên đường khởi động
   * (`main.tsx`, `router.tsx`, một component mà mọi màn đều dùng…), Rollup sẽ để
   * `three` ở một chunk riêng rồi cho chunk vào **nhập tĩnh** chunk đó. Kích
   * thước file entry gần như không đổi; thứ người dùng phải tải trước khi thấy gì
   * tăng thêm ~137 KiB. Chỉ có cách đọc `chunk.imports` đệ quy mới thấy, và cổng
   * này PHẢI đỏ khi đó — đó là toàn bộ lý do nó tồn tại.
   *
   * 175 KiB là đúng con số ngân sách "tổng JS" cũ: mức nghiêm khắc giữ nguyên,
   * chỉ đại lượng được đo là đổi. Số đo 2026-09-05: 124,7 KiB.
   */
  entry: 175,
  /**
   * Chunk JS lớn nhất — chặn riêng, vì một chunk khổng lồ là thứ chặn màn hình
   * đầu tiên *khi nó rơi vào đường khởi động*, và là thứ khiến cả một màn tải
   * muộn cũng phải chờ lâu. Ngưỡng thấp hơn tổng là cố ý: lối thoát khi JS phình
   * ra là tách chunk, không phải nới số. Số đo 2026-09-05: 137,3 KiB (`scene-*`,
   * chứa `three`).
   */
  largestJsChunk: 170,
  /**
   * Chi phí **thêm** lớn nhất khi người dùng bước vào một màn: bao đóng nhập
   * tĩnh của một chunk tải muộn, **trừ đi** những chunk đã có trong bao đóng
   * khởi động — không tính trùng, vì người dùng đã tải phần đó rồi.
   *
   * Đây là "cú nhảy thứ hai": trang đầu nhẹ không có nghĩa gì nếu bấm vào một
   * mục menu thì phải chờ thêm nửa MiB. Số đo 2026-09-05: 264,8 KiB
   * (`screens/viewer/Viewer3D` — `three` + GLTFLoader + DRACO).
   */
  routeChunk: 280,
  /** Toàn bộ CSS. Tailwind đã purge. Số đo 2026-09-05: 9,8 KiB. */
  css: 12,
};

/**
 * Mốc CẢNH BÁO. In ra, KHÔNG làm hỏng cổng — mã thoát của bước này không bao giờ
 * đỏ vì con số này.
 *
 * Tổng JS mọi chunk không phải thứ người dùng nào tải. Nhưng để nó biến mất hẳn
 * thì đà tăng đi im lặng, nên nó ở lại làm mốc: qua 800 KiB là dấu hiệu nên đọc
 * lại `docs/notes/bundle-size.md` §6 và siết dần, không phải dấu hiệu chặn PR.
 * Số đo 2026-09-05: 760,8 KiB.
 */
const WARN_KIB = {
  js: 800,
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

/** Đọc đồ thị nhập. Thiếu manifest là lỗi cấu hình, không phải lỗi người chạy. */
function readManifest() {
  try {
    return JSON.parse(readFileSync(MANIFEST_PATH, 'utf8'));
  } catch {
    throw new Error(
      `Không đọc được ${MANIFEST_PATH}.\n` +
        'Cổng này cần đồ thị nhập để tách "chi phí màn hình đầu tiên" khỏi "tổng mọi chunk".\n' +
        'Kiểm tra `build.manifest: true` trong `vite.config.ts`, rồi chạy lại `pnpm build`.',
    );
  }
}

/**
 * Bao đóng của một tập khoá manifest.
 *
 * Mặc định CHỈ đi theo `imports`, tức những chunk trình duyệt BUỘC phải tải cùng
 * lúc. Đây là phép đo dùng cho cả `entry` lẫn `routeChunk`: `dynamicImports` là
 * thứ tải muộn, gộp vào thì mọi màn đều "nặng" như nhau, vì các màn tới được
 * nhau qua điều hướng nên bao đóng động của màn nào cũng là gần cả gói.
 */
function closure(startKeys, manifest, { followDynamic = false } = {}) {
  const seen = new Set();
  const stack = [...startKeys];

  while (stack.length > 0) {
    const key = stack.pop();

    if (seen.has(key) || manifest[key] === undefined) {
      continue;
    }

    seen.add(key);

    for (const next of manifest[key].imports ?? []) {
      stack.push(next);
    }

    if (followDynamic) {
      for (const next of manifest[key].dynamicImports ?? []) {
        stack.push(next);
      }
    }
  }

  return seen;
}

/** Tổng gzip JS của một tập khoá manifest, tra qua bảng kích thước đã đo. */
function closureGzip(keys, manifest, gzipByFile) {
  let total = 0;

  for (const key of keys) {
    const file = manifest[key]?.file;

    if (file !== undefined && file.endsWith('.js')) {
      total += gzipByFile.get(file) ?? 0;
    }
  }

  return total;
}

/**
 * Rút gọn khoá manifest thành tên đọc được: `src/screens/viewer/Viewer3D/index.ts`
 * thành `viewer/Viewer3D`. Chỉ để bảng thẳng cột; không dùng để so sánh gì.
 */
const shortenKey = (key) =>
  key
    .replace(/^src\/screens\//, '')
    .replace(/\/index\.tsx?$/, '')
    .replace(/\.tsx?$/, '');

/** In một dòng kết quả: trạng thái, nhãn, số đo / ngưỡng, khoảng dư. */
function printRow(status, label, actualBytes, limitKib) {
  const limitBytes = limitKib * KIB;
  const over = actualBytes > limitBytes;

  console.log(
    `  ${status.padEnd(11)} ${label.padEnd(46)} ` +
      `${formatKib(actualBytes).padStart(8)} KiB / ${String(limitKib).padStart(4)} KiB ` +
      `(${over ? 'quá' : 'còn dư'} ${formatKib(Math.abs(limitBytes - actualBytes))} KiB)`,
  );
}

function main() {
  const assets = readAssets();

  if (assets.length === 0) {
    throw new Error(`${ASSETS_DIR} rỗng. Chạy \`pnpm build\` trước khi đo kích thước gói.`);
  }

  const manifest = readManifest();
  const gzipByFile = new Map(assets.map((asset) => [`assets/${asset.name}`, asset.gzipBytes]));

  const totalGzip = (kind) =>
    assets.filter((asset) => asset.kind === kind).reduce((sum, asset) => sum + asset.gzipBytes, 0);

  const jsAssets = assets.filter((asset) => asset.kind === 'js');
  const largestJsChunk = jsAssets.length === 0 ? 0 : Math.max(...jsAssets.map((a) => a.gzipBytes));

  // 1 — chi phí màn hình đầu tiên: bao đóng NHẬP TĨNH của mọi chunk `isEntry`.
  const entryKeys = Object.keys(manifest).filter((key) => manifest[key].isEntry);

  if (entryKeys.length === 0) {
    throw new Error(
      `${MANIFEST_PATH} không có chunk nào \`isEntry\`. ` +
        'Bản dựng hỏng, hoặc manifest không phải của bản dựng này.',
    );
  }

  const entryClosure = closure(entryKeys, manifest);
  const entryBytes = closureGzip(entryClosure, manifest, gzipByFile);

  // 2 — chi phí thêm lớn nhất của một chunk tải muộn. Ứng viên là mọi đích của
  // một `import()` bất kỳ; trên cây này chúng chính là 25 màn `lazy()` cộng vài
  // loader nặng (GLTFLoader, DRACO). Trừ đi bao đóng khởi động: người dùng đã
  // tải phần đó rồi, tính lần nữa là đổ oan cho màn.
  const dynamicTargets = new Set();

  for (const key of Object.keys(manifest)) {
    for (const target of manifest[key].dynamicImports ?? []) {
      dynamicTargets.add(target);
    }
  }

  let worstRoute = { key: 'không có chunk tải muộn nào', bytes: 0 };

  for (const target of dynamicTargets) {
    const added = [...closure([target], manifest)].filter((key) => !entryClosure.has(key));
    const bytes = closureGzip(added, manifest, gzipByFile);

    if (bytes > worstRoute.bytes) {
      worstRoute = { key: target, bytes };
    }
  }

  const TOP_ASSETS = 10;

  console.log(`\nKích thước gói (gzip) — ${assets.length} tệp, ${TOP_ASSETS} tệp lớn nhất:\n`);
  for (const asset of assets.slice(0, TOP_ASSETS)) {
    console.log(
      `  ${asset.name.padEnd(34)} ${formatKib(asset.gzipBytes).padStart(8)} KiB` +
        `   (thô ${formatKib(asset.rawBytes)} KiB)`,
    );
  }
  if (assets.length > TOP_ASSETS) {
    console.log(`  … và ${assets.length - TOP_ASSETS} tệp nhỏ hơn.`);
  }

  const gates = [
    {
      label: 'màn hình đầu tiên (chunk vào + nhập tĩnh)',
      actual: entryBytes,
      budgetKib: BUDGETS_KIB.entry,
    },
    {
      label: 'chunk JS lớn nhất',
      actual: largestJsChunk,
      budgetKib: BUDGETS_KIB.largestJsChunk,
    },
    {
      label: `chi phí thêm cho một màn (${shortenKey(worstRoute.key)})`,
      actual: worstRoute.bytes,
      budgetKib: BUDGETS_KIB.routeChunk,
    },
    { label: 'tổng CSS', actual: totalGzip('css'), budgetKib: BUDGETS_KIB.css },
  ];

  console.log('\ncổng — vượt là hỏng:\n');
  const over = [];

  for (const gate of gates) {
    const failed = gate.actual > gate.budgetKib * KIB;

    printRow(failed ? 'VƯỢT' : 'đạt', gate.label, gate.actual, gate.budgetKib);

    if (failed) {
      over.push(gate);
    }
  }

  // Cảnh báo: in ra để đà tăng không đi im lặng, nhưng KHÔNG góp vào `over` và
  // KHÔNG đổi mã thoát. Tổng JS tăng mỗi lần thêm một màn `lazy()`, kể cả một
  // màn hoàn hảo — chặn PR vì con số này là chặn nhầm người.
  const jsTotal = totalGzip('js');
  const overWarn = jsTotal > WARN_KIB.js * KIB;

  console.log('\ncảnh báo — in ra, không làm hỏng cổng:\n');
  printRow(overWarn ? 'QUÁ MỐC' : 'trong mốc', 'tổng JS mọi chunk', jsTotal, WARN_KIB.js);

  if (overWarn) {
    console.log(
      '\n  tổng JS đã qua mốc. không chặn lượt này, nhưng đọc `docs/notes/bundle-size.md` §6\n' +
        '  và siết dần: đưa fixture/mock ra khỏi gói sản phẩm, cắt `vi.json` theo nhóm khoá.',
    );
  }

  console.log('');

  if (over.length > 0) {
    const names = over.map((gate) => gate.label).join(', ');

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
