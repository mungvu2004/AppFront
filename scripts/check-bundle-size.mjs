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
 * đổi *thứ được đo*, không đổi *mức được phép*. (Từ 2026-09-29 có thêm **ba**
 * đại lượng nữa cho vách ngăn Pascal — xem `PASCAL_BUDGETS_KIB` bên dưới. Bốn
 * cái đầu đo gzip của bản dựng chính; ba cái sau đo thô của một lượt dựng riêng,
 * và hai nhóm ấy không so được với nhau.)
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
import { existsSync, readdirSync, readFileSync, statSync } from 'node:fs';
import { basename, join } from 'node:path';

/** Thư mục vite ghi bản dựng ra. */
const ASSETS_DIR = join('dist', 'assets');

/**
 * Đồ thị nhập của bản dựng, do `build.manifest` trong `vite.config.ts` ghi ra.
 *
 * Danh sách file trong `assets/` chỉ cho biết *có bao nhiêu KiB*, không cho biết
 * *ai kéo ai*. Hai trong bốn ngưỡng gzip dưới đây cần đồ thị: phải đi từ chunk
 * `isEntry` theo `imports` (nhập tĩnh, tải ngay) và tách riêng `dynamicImports`
 * (nhập động, tải muộn). Manifest là chỗ duy nhất vite ghi sẵn đồ thị đó ra đĩa.
 */
const MANIFEST_PATH = join('dist', '.vite', 'manifest.json');

const KIB = 1024;

/**
 * Bảy màn demo chỉ bản dev (`buildDevOnlyRoutes`, `src/routes/router.tsx`) —
 * mỗi màn một chuỗi chỉ nó có. Bản dựng production mang chuỗi nào là hỏng.
 *
 * Chuỗi chứ không khoá manifest: một `import` tĩnh lỡ tay gộp màn demo vào chunk
 * của màn khác thì manifest không còn khoá riêng cho nó, còn chuỗi vẫn ở đó.
 * `scripts/__tests__/check-bundle-size.test.mjs` kiểm mỗi chuỗi còn trong đúng
 * tệp nguồn — đổi chữ màn demo mà quên bảng này thì bộ test đỏ, không phải cổng
 * này lặng lẽ xanh mãi.
 */
const DEV_ONLY_MARKERS = [
  { source: 'src/App.tsx', marker: 'Motion & Transitions' },
  { source: 'src/screens/DesignSystem.tsx', marker: 'Quiet Blueprint v1.1' },
  { source: 'src/screens/DataEntryDemo.tsx', marker: 'Data Entry Components' },
  { source: 'src/screens/ListReviewDemo.tsx', marker: 'Duyệt dữ liệu thành công!' },
  { source: 'src/screens/ShellDemo.tsx', marker: 'Cmd+K to search' },
  { source: 'src/screens/CanvasOverlaysDemo.tsx', marker: 'Canvas Overlays Demo' },
  { source: 'src/screens/FeedbackDemo.tsx', marker: 'Test Undo Toast' },
];

/** Cặp (chuỗi đánh dấu, tệp dựng) nào có mặt. `files`: `{ name, text }[]`. */
function findDevOnlyLeaks(files, markers = DEV_ONLY_MARKERS) {
  return markers.flatMap(({ source, marker }) =>
    files.filter((file) => file.text.includes(marker)).map((file) => ({ source, marker, file: file.name })),
  );
}

/**
 * Quét bản dựng tìm chỗ dựng mã từ chuỗi — CSP thật không có `'unsafe-eval'`
 * (`AppBack/deploy/nginx/snippets/security_headers.conf:6`), nên mỗi chỗ là một
 * EvalError lúc chạy mà máy dev không gửi CSP thì không bao giờ thấy (FIX-380).
 *
 * Mẫu cố ý KHÔNG chỉ là `new Function`: hai nguồn thật đều trượt chuỗi ấy —
 * embind gọi `newFunc(Function,args)`, zod 4 viết `const F = Function; new F(…)`.
 * Bí danh thì vô tận (`(0,eval)(…)`, `self.Function(…)`, `return Function`,
 * `{c:Function}`…), nên bắt MỌI token `Function`/`eval` đứng riêng, rồi chỉ loại
 * những ngữ cảnh chắc chắn không dựng mã — xem {@link isHarmlessEvalToken}.
 * Thêm `setTimeout`/`setInterval` nhận chuỗi, và `newFunc(` của embind.
 *
 * Ngoài phạm vi, cố ý: `(function(){}).constructor(s)` và các đường đi qua
 * `.constructor` — không có token nào để bắt mà không bắn vào mọi lớp; và bí
 * danh BIẾN của đối tượng toàn cục (`var g=globalThis;g.Function(…)`) — vô tận.
 */
const EVAL_PATTERN =
  /(?<![\w$])(?:Function|eval)(?![\w$])|\b(?:setTimeout|setInterval)\s*\(\s*["'`]|\bnewFunc\s*\(/g;

/** Tên của đối tượng toàn cục: `self.Function` là `Function`, `obj.Function` thì không. Nhận cả `?.`. */
const GLOBAL_OBJECT = /\b(?:globalThis|window|self|global|top|parent|frames|opener)\s*\??\.\s*$/;

/**
 * Trần của một chú thích được miễn, tính bằng ký tự. Không có trần thì một `//`
 * hay `/*` nằm trong CHUỖI phía trước trên một dòng minify dài (three: một dòng
 * 369 144 ký tự, `// validated` trong GLSL ở ký tự 7 686) miễn luôn ~361 KB mã
 * phía sau (review FIX-380 lượt 2, N-1). Chú thích dòng thật thì ngắn; khối
 * JSDoc thì phải đóng trong trần, và token phải nằm GIỮA `/*` và `*\/`.
 * Còn lại, cố ý: một cặp `/*`…`*\/` giả nằm trong chuỗi và cách nhau dưới
 * 8 000 ký tự vẫn che được token giữa chúng — quét không phân tích cú pháp.
 */
const LINE_COMMENT_MAX = 120;
const BLOCK_COMMENT_MAX = 8_000;
/*
 * Giữa `//` và token không được có dấu nháy hay `;`: có tức là `//` nằm trong
 * một chuỗi/regex đã ĐÓNG và token là mã thật (`"a //b";var F=Function`). Giá
 * phải trả: chú thích có nháy trước token (`// the "Function" type`) bị chặn —
 * đỏ nhầm thì người ta thấy, xanh nhầm thì không.
 */
const LINE_COMMENT = new RegExp(`(?:^|\\s)//[^\\n"'\`;]{0,${LINE_COMMENT_MAX}}$`);

/** Token nằm giữa `/*` gần nhất phía trước và `*\/` gần nhất phía sau, trong trần. */
function insideBlockComment(text, index) {
  const open = text.lastIndexOf('/*', index);
  if (open === -1 || text.lastIndexOf('*/', index) > open) return false;

  const close = text.indexOf('*/', index);

  return close !== -1 && close - open <= BLOCK_COMMENT_MAX;
}

/**
 * Token `Function`/`eval` ở chỗ không thể dựng mã: kiểm kiểu `instanceof`,
 * `Function.prototype`, thuộc tính của một đối tượng KHÔNG phải toàn cục, dòng
 * chú thích (gói vách ngăn không minify, mang hàng trăm JSDoc `{Function}`), và
 * chữ trong câu báo lỗi (`"Function is not a GLSL code"`, `` `Function '${x}' called` ``).
 */
function isHarmlessEvalToken(text, index, token) {
  if (!/^(?:Function|eval)$/.test(token)) return false;

  const before = text.slice(Math.max(0, index - 40), index);
  const after = text.slice(index + token.length, index + token.length + 20);
  const lineStart = text.lastIndexOf('\n', index - 1) + 1;
  const line = text.slice(lineStart, index);

  return (
    /\binstanceof\s+$/.test(before) ||
    /^\s*\.\s*prototype\b/.test(after) ||
    (/\.\s*$/.test(before) && !GLOBAL_OBJECT.test(before)) ||
    LINE_COMMENT.test(line) ||
    insideBlockComment(text, index) ||
    /^[ \t]+[A-Za-z'"]/.test(after)
  );
}

/**
 * Hai chỗ zod 4 trong gói vách ngăn, miễn THEO NỘI DUNG chứ không theo tệp:
 * cả hai không bao giờ chạy vì `usePascalViewer.ts:157-161` bật `jitless`
 * trước khi nạp gói. Chỗ thứ ba — kể cả trong cùng tệp — vẫn đỏ.
 */
const EVAL_ALLOWED = [
  { reason: 'zod 4 `allowsEval` — tắt bởi jitless', pattern: /const F = Function;\s*new F\(""\);/ },
  { reason: 'zod 4 `Doc.compile` — tắt bởi jitless', pattern: /compile\(\) \{\s*const F = Function;/ },
];

/** Thư mục chứa mã sẽ chạy trên trình duyệt; `findEvalSites` đọc `.js`/`.mjs` dưới chúng. */
const EVAL_SCAN_DIRS = [join('dist', 'assets'), join('dist', 'basis'), join('dist', 'draco')];

/** Mọi chỗ dựng mã từ chuỗi. `files`: `{ name, text }[]`. Trả `{ blocked, allowed }`. */
function findEvalSites(files, allowedList = EVAL_ALLOWED) {
  const blocked = [];
  const allowed = [];

  for (const { name, text } of files) {
    const spans = allowedList.flatMap(({ reason, pattern }) =>
      [...text.matchAll(new RegExp(pattern.source, 'g'))].map((m) => ({
        reason,
        start: m.index,
        end: m.index + m[0].length,
      })),
    );

    for (const match of text.matchAll(EVAL_PATTERN)) {
      if (isHarmlessEvalToken(text, match.index, match[0])) continue;

      const site = { file: name, at: match.index, snippet: text.slice(match.index, match.index + 60) };
      const span = spans.find((s) => match.index >= s.start && match.index < s.end);

      if (span === undefined) blocked.push(site);
      else allowed.push({ ...site, reason: span.reason });
    }
  }

  return { blocked, allowed };
}

/** `.js`/`.mjs` dưới các thư mục quét, đệ quy. Thiếu thư mục ⇒ bỏ qua. */
function readScriptsUnder(dirs) {
  const out = [];
  const visit = (dir) => {
    if (!existsSync(dir)) return;
    for (const entry of readdirSync(dir)) {
      const path = join(dir, entry);
      if (statSync(path).isDirectory()) visit(path);
      else if (/\.m?js$/.test(entry)) out.push({ name: path, text: readFileSync(path, 'utf8') });
    }
  };
  dirs.forEach(visit);
  return out;
}

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
 * Cổng thứ năm — **vách ngăn Pascal**, đo bằng KiB THÔ của cả thư mục.
 *
 * ## Vì sao bốn cổng trên không đo được nó
 *
 * Vách ngăn là một lượt dựng RIÊNG (`vite.pascal.config.ts`) ra
 * `public/assets/pascal/`, cộng hai thư mục tài sản do `pnpm pascal:assets`
 * chép. Bốn cổng trên đọc `dist/assets` **không đệ quy** và lọc theo đuôi
 * `.js`/`.css`, mà `assets/pascal` là một thư mục — thư mục thì không có đuôi.
 * Nên chúng bỏ qua vách ngăn **theo cấu tạo**, và nếu không có cổng này thì
 * 26 MiB lớn dần mà không cổng nào thấy.
 *
 * ## Vì sao đo THÔ chứ không gzip
 *
 * Bốn cổng trên đo gzip vì chúng đo "thứ đi qua dây ở khung hình đầu tiên".
 * Cổng này đo một thứ khác: **khối lượng phải mang đi deploy và phải giữ trên
 * đĩa**. Ảnh `.ktx2` đã nén sẵn, gzip lần nữa không đổi gì, nên gzip ở đây là
 * một con số không nói lên điều gì.
 *
 * ## Ba con số, và chúng đến từ đâu
 *
 * Số đo 2026-09-29, ngay sau khi chép đúng `.ktx2` (bỏ `.webp`/`.jpg` nguồn):
 *
 * | phần | tệp | thô |
 * |---|---|---|
 * | mã vách ngăn `assets/pascal` | 251 | 19 379,3 KiB |
 * | tài sản `pascal` + `basis` | 64 | 7 097,6 KiB |
 * | **tổng-thư-mục** | **315** | **26 476,9 KiB** |
 *
 * Trần dưới đây để dư ~13 %, đúng dải 6–40 % mà bốn cổng trên đang dùng. Ba con
 * số này do người thi công đặt từ số đo, **không phải** một quyết định đã được
 * duyệt: `docs/pascal/00-quyet-dinh.md` ghi T4.2 (2) là câu **chưa hỏi**. Đổi
 * chúng là việc của người duyệt, và nới để cho qua thì vẫn là nới.
 */
const PASCAL_BUDGETS_KIB = {
  code: 22_000,
  assets: 8_000,
  total: 30_000,
};

/** Ba thư mục hợp thành vách ngăn, sau khi `vite build` chép `public/` vào `dist/`. */
const PASCAL_DIRS = {
  code: [join('dist', 'assets', 'pascal')],
  assets: [join('dist', 'pascal'), join('dist', 'basis')],
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

const ZERO_MEASURE = { bytes: 0, files: 0 };

const sumMeasures = (left, right) => ({
  bytes: left.bytes + right.bytes,
  files: left.files + right.files,
});

/** Tổng byte và số tệp dưới một thư mục, đệ quy. Thiếu thư mục ⇒ số không. */
function measureDir(dir) {
  if (!existsSync(dir)) return { bytes: 0, files: 0 };

  let bytes = 0;
  let files = 0;

  for (const entry of readdirSync(dir)) {
    const path = join(dir, entry);
    const stat = statSync(path);

    if (stat.isDirectory()) {
      const inner = measureDir(path);
      bytes += inner.bytes;
      files += inner.files;
    } else {
      bytes += stat.size;
      files += 1;
    }
  }

  return { bytes, files };
}

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

/**
 * Những chunk CHẮC CHẮN ĐÃ HIỆN DIỆN khi `target` được tải.
 *
 * ## Vì sao không gọi chúng là "cha"
 *
 * Một chunk nhập `target` ở dạng TĨNH không tải *trước* nó — nó tải *cùng*. Chữ
 * "cha" gợi quan hệ `dynamic-import`, và ai đọc theo nghĩa đó sẽ lại chỉ gom
 * `dynamicImports` — đúng cái lỗi mô tả ở đoạn dưới. Tính chất mà phép trừ dựa
 * vào không phải thứ tự thời gian mà là **sự hiện diện**: tại lúc `target` chạy,
 * những chunk này chắc chắn đã nằm trong bộ nhớ trình duyệt.
 *
 * ## Vì sao gồm CẢ nhập tĩnh
 *
 * Gom mỗi `dynamicImports` là không đủ. `three.module.js` được **34** chunk nhập,
 * nhưng chỉ **một** nhập ở dạng động; lấy mỗi vế động thì tập thiếu 33, và phép
 * trừ khi ấy ngầm giả định mọi đường tới `three` đều đi qua đúng một màn.
 */
function presentWhenLoaded(target, manifest) {
  const holders = [];

  for (const key of Object.keys(manifest)) {
    const entry = manifest[key];
    const reaches =
      (entry.imports ?? []).includes(target) || (entry.dynamicImports ?? []).includes(target);

    if (reaches) {
      holders.push(key);
    }
  }

  return holders;
}

/**
 * Mốc trừ của một chunk tải muộn: phần người dùng CHẮC CHẮN đã có sẵn.
 *
 * `entryClosure` ∪ **giao** bao đóng **TĨNH** của mọi chunk trong
 * {@link presentWhenLoaded}.
 *
 * ## Vì sao GIAO chứ không phải HỢP
 *
 * Một chunk tới được từ nhiều đường thì chỉ phần **mọi** đường đều có mới chắc
 * chắn đã tải. Hợp sẽ trừ cả thứ chỉ một đường mang theo, tức tạo ra đúng điểm
 * mù mà cổng này tồn tại để chặn. Đo trên bản dựng thật:
 * `lib/export/screenshot.ts` tới được từ `ExportPanel` và `ExplodedView` — giao
 * cho 15,2 KiB, hợp cho 5,1, tức hợp **nuốt mất 10,0 KiB**.
 *
 * ## Vì sao TĨNH chứ không phải toàn phần
 *
 * Sáu panel của trình xem 3D cùng được một chunk nhập động. Dùng bao đóng toàn
 * phần thì mỗi panel bị trừ luôn phần của **các panel anh em** — không panel nào
 * trong chúng đã tải khi một panel khác mở ra.
 *
 * ## Vì sao route không cần nhánh riêng
 *
 * `presentWhenLoaded` của một route là chính chunk vào, và bao đóng tĩnh của
 * chunk vào bằng đúng `entryClosure` — nên mốc trừ của route không đổi một byte
 * so với trước. Đã đo: **0/60** chunk tải muộn có tập rỗng, nên không có nhánh
 * dự phòng nào ở đây; tập rỗng cho `entryClosure`, và điều đó rơi ra tự nhiên
 * từ phép giao trên tập rỗng.
 */
function baselineFor(target, manifest, entryClosure) {
  const holders = presentWhenLoaded(target, manifest);
  let shared;

  for (const holder of holders) {
    const holderClosure = closure([holder], manifest, { followDynamic: false });

    shared =
      shared === undefined
        ? holderClosure
        : new Set([...shared].filter((key) => holderClosure.has(key)));
  }

  return new Set([...entryClosure, ...(shared ?? [])]);
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

  let worstRoute = { key: 'không có chunk tải muộn nào', bytes: 0, rawBytes: 0, holders: [] };

  for (const target of dynamicTargets) {
    const own = closure([target], manifest);
    const baseline = baselineFor(target, manifest, entryClosure);

    const added = [...own].filter((key) => !baseline.has(key));
    const bytes = closureGzip(added, manifest, gzipByFile);

    if (bytes > worstRoute.bytes) {
      worstRoute = {
        key: target,
        bytes,
        rawBytes: closureGzip(
          [...own].filter((key) => !entryClosure.has(key)),
          manifest,
          gzipByFile,
        ),
        holders: presentWhenLoaded(target, manifest),
      };
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

  /*
   * Vách ngăn Pascal. Vắng mặt ⇒ 0 byte và cổng xanh, KHÔNG phải lỗi: một bản
   * dựng chưa chạy `pnpm pascal` là chuyện thường ở máy làm việc, và bắt nó đỏ
   * ở đây là bắt cổng kích thước gánh việc của bước dựng.
   */
  const pascalCode = PASCAL_DIRS.code.map(measureDir).reduce(sumMeasures, ZERO_MEASURE);
  const pascalAssets = PASCAL_DIRS.assets.map(measureDir).reduce(sumMeasures, ZERO_MEASURE);
  const pascalTotal = sumMeasures(pascalCode, pascalAssets);

  if (pascalTotal.files > 0) {
    console.log(
      `
vách ngăn Pascal — đo THÔ, cả thư mục:
` +
        `  mã       ${String(pascalCode.files).padStart(4)} tệp  ${formatKib(pascalCode.bytes)} KiB
` +
        `  tài sản  ${String(pascalAssets.files).padStart(4)} tệp  ${formatKib(pascalAssets.bytes)} KiB
` +
        `  tổng     ${String(pascalTotal.files).padStart(4)} tệp  ${formatKib(pascalTotal.bytes)} KiB`,
    );

    gates.push(
      { label: 'vách ngăn Pascal — mã', actual: pascalCode.bytes, budgetKib: PASCAL_BUDGETS_KIB.code },
      {
        label: 'vách ngăn Pascal — tài sản',
        actual: pascalAssets.bytes,
        budgetKib: PASCAL_BUDGETS_KIB.assets,
      },
      {
        label: 'vách ngăn Pascal — tổng thư mục',
        actual: pascalTotal.bytes,
        budgetKib: PASCAL_BUDGETS_KIB.total,
      },
    );
  }

  /*
   * Chuỗi phép tính của hàng "chi phí thêm", in ra chứ không giấu.
   *
   * Không có dòng này thì con số cuối là một hộp đen: người đọc không kiểm được
   * phần nào đã bị trừ và vì sao. Khi chunk mang `target` không có `src` — đúng
   * trường hợp các panel của trình xem 3D — in thẳng khoá chunk và nói rõ nó là
   * chunk dùng chung, KHÔNG bịa cho nó một tên màn.
   */
  if (worstRoute.holders.length > 0) {
    const subtracted = worstRoute.rawBytes - worstRoute.bytes;
    const holderNames = worstRoute.holders
      .map((key) => (manifest[key]?.src === undefined ? `${key} (chunk dùng chung)` : shortenKey(key)))
      .join(', ');

    console.log(
      `\nchi phí thêm — chuỗi phép tính:\n` +
        `  ${shortenKey(worstRoute.key)}\n` +
        `  ${formatKib(worstRoute.rawBytes)} thô − ${formatKib(subtracted)} ` +
        `(đã hiện diện: ${holderNames}) = ${formatKib(worstRoute.bytes)} KiB`,
    );
  }

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

  const leaks = findDevOnlyLeaks(
    readdirSync(ASSETS_DIR)
      .filter((name) => name.endsWith('.js'))
      .map((name) => ({ name, text: readFileSync(join(ASSETS_DIR, name), 'utf8') })),
  );

  if (leaks.length > 0) {
    throw new Error(
      'Màn demo chỉ bản dev lọt vào bản dựng production:\n' +
        leaks.map((leak) => `  ${leak.source} — "${leak.marker}" trong ${leak.file}`).join('\n'),
    );
  }

  console.log(`màn demo chỉ bản dev trong bản dựng: 0/${DEV_ONLY_MARKERS.length} — đạt\n`);

  const scripts = readScriptsUnder(EVAL_SCAN_DIRS);
  const evalSites = findEvalSites(scripts);

  console.log(`dựng mã từ chuỗi (CSP không có 'unsafe-eval') — ${scripts.length} tệp mã:`);
  for (const site of evalSites.allowed) console.log(`  miễn  ${site.file} — ${site.reason}`);
  for (const site of evalSites.blocked) console.log(`  CHẶN  ${site.file}@${site.at} — ${JSON.stringify(site.snippet)}`);

  if (evalSites.blocked.length > 0) {
    throw new Error(
      `${evalSites.blocked.length} chỗ dựng mã từ chuỗi trong bản dựng — CSP thật ném EvalError ở đó. ` +
        'Dựng lại thư viện không eval (xem `vendor/basis/NGUON.md`), không nới CSP.',
    );
  }

  console.log(`  đạt — 0 chỗ chặn, ${evalSites.allowed.length} chỗ miễn\n`);

  if (over.length > 0) {
    const names = over.map((gate) => gate.label).join(', ');

    throw new Error(
      `Vượt ngân sách kích thước gói: ${names}.\n` +
        'Tách chunk, bỏ dependency, hoặc lazy-load màn hình. Không nới ngân sách để cho qua.',
    );
  }

  console.log('Kích thước gói: đạt.\n');
}

/*
 * Các hàm thuần xuất ra cho `scripts/__tests__/check-bundle-size.test.mjs`.
 *
 * Chúng không đọc đĩa và không in gì: đưa manifest vào, nhận tập khoá ra. Nhờ
 * vậy bộ test khoá được PHÉP TÍNH mà không cần một bản dựng, và bảng đối chiếu
 * của lượt gộp này được sinh bằng CHÍNH những hàm đã cắm vào cổng — chứ không
 * bằng một script riêng rồi hy vọng hai bên khớp nhau.
 */
export {
  closure,
  presentWhenLoaded,
  baselineFor,
  closureGzip,
  findDevOnlyLeaks,
  findEvalSites,
  DEV_ONLY_MARKERS,
};

/*
 * Chỉ chạy cổng khi file này được gọi thẳng. Khi bộ test `import` nó, đoạn dưới
 * không chạy — nếu không, mỗi lần test nạp module là một lượt đọc `dist/`.
 */
if (process.argv[1] !== undefined && import.meta.url.endsWith(basename(process.argv[1]))) {
  try {
    main();
  } catch (error) {
    console.error(`\n${error instanceof Error ? error.message : String(error)}\n`);
    process.exit(1);
  }
}
