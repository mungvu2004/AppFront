/**
 * Bỏ qua `pnpm pascal` (4.906 module, ~39 s) khi mọi đầu vào của lượt dựng không đổi
 * so với lần chạy trước.
 *
 * Băm sha256 nội dung của `vendor/pascal/**`, `vendor/basis/**`, cả `src/**` (entry
 * `src/components/pascal/pascalMount.tsx` kéo theo `src/lib/**`, `src/domain/**` qua
 * import — liệt kê từng thư mục sẽ lệch khi đồ thị import đổi), các tệp cấu hình/kịch
 * bản dựng, `package.json` và `pnpm-lock.yaml` (khoá luôn phiên bản gói Pascal đang cài). So với dấu ghi ở `node_modules/.cache/pascal-build/stamp.json` — thư mục đó
 * nằm trong `node_modules/`, đã bị `.gitignore` sẵn, nên không cần thêm dòng nào.
 *
 * Khớp dấu **và** bốn đích dựng (`public/pascal`, `public/basis`,
 * `public/assets/pascal`, `public/draco`) còn tệp bên trong → bỏ qua. Khác đi, hoặc một đích rỗng/mất
 * (ai đó `rm -rf public` mà không đụng mã) → chạy `pascal:assets` rồi `build:pascal`
 * như cũ, rồi ghi dấu mới.
 */
import { createHash } from 'node:crypto';
import { spawnSync } from 'node:child_process';
import { existsSync, mkdirSync, readFileSync, readdirSync, statSync, writeFileSync } from 'node:fs';
import { basename, join, relative } from 'node:path';

export const INPUT_PATHS = [
  'vendor/pascal',
  'vendor/basis',
  'src',
  'vite.pascal.config.ts',
  'tsconfig.json',
  'scripts/copy-pascal-assets.mjs',
  'scripts/copy-draco.mjs',
  'package.json',
  'pnpm-lock.yaml',
];

export const OUTPUT_DIRS = ['public/pascal', 'public/basis', 'public/assets/pascal', 'public/draco'];

const STAMP_PATH = join('node_modules', '.cache', 'pascal-build', 'stamp.json');

/**
 * Mọi tệp dưới `root` (root là tệp thì trả về chính nó), đường dẫn tương đối, đã sắp.
 *
 * Bỏ qua mọi thư mục `node_modules`: bốn gói Pascal là workspace package, pnpm vật
 * chất hoá `node_modules/` thật ngay trong `vendor/pascal/packages/*` (đo được
 * **~80.000** tệp, so với ~4.700 tệp mã+tài sản thật). Phiên bản phụ thuộc của chúng
 * đã nằm trong `pnpm-lock.yaml` — một trong các tệp ăn vào băm — nên quét lại
 * `node_modules` không thêm thông tin, chỉ thêm vài chục giây liệt kê đĩa.
 */
export function listFiles(root) {
  if (!existsSync(root)) return [];
  if (statSync(root).isFile()) return [root.split('\\').join('/')];

  const out = [];
  const stack = [root];
  while (stack.length > 0) {
    const dir = stack.pop();
    for (const entry of readdirSync(dir, { withFileTypes: true })) {
      if (entry.name === 'node_modules') continue;
      const full = join(dir, entry.name);
      if (entry.isDirectory()) {
        stack.push(full);
      } else {
        out.push(full.split('\\').join('/'));
      }
    }
  }
  return out.sort();
}

/** Băm nội dung + đường dẫn tương đối của mọi tệp dưới các `paths` — một chuỗi hex. */
export function hashInputs(paths, cwd = process.cwd()) {
  const hash = createHash('sha256');
  for (const path of paths) {
    for (const file of listFiles(path)) {
      hash.update(relative(cwd, file).split('\\').join('/'));
      hash.update(readFileSync(file));
    }
  }
  return hash.digest('hex');
}

/** Một đích dựng "còn đủ" khi nó tồn tại và chứa ít nhất một tệp. */
export function outputsComplete(dirs) {
  return dirs.every((dir) => listFiles(dir).length > 0);
}

export function readStamp(path = STAMP_PATH) {
  if (!existsSync(path)) return null;
  try {
    return JSON.parse(readFileSync(path, 'utf8'));
  } catch {
    return null;
  }
}

export function writeStamp(hash, path = STAMP_PATH) {
  mkdirSync(join(path, '..'), { recursive: true });
  writeFileSync(path, JSON.stringify({ hash }));
}

/** Băm khớp dấu cũ VÀ đích dựng còn đủ → bỏ qua được. */
export function shouldSkip(currentHash, stamp, dirs) {
  return stamp?.hash === currentHash && outputsComplete(dirs);
}

function run(command, args) {
  // `shell: true` vì trên Windows `pnpm` là file .cmd — cùng lý do với verify.mjs.
  return spawnSync(command, args, { stdio: 'inherit', shell: true }).status ?? 1;
}

function main() {
  const currentHash = hashInputs(INPUT_PATHS);
  const stamp = readStamp();

  if (shouldSkip(currentHash, stamp, OUTPUT_DIRS)) {
    console.log('pascal-cached: bỏ qua, băm khớp');
    return;
  }

  const assetsCode = run('pnpm', ['pascal:assets']);
  if (assetsCode !== 0) process.exit(assetsCode);

  const buildCode = run('pnpm', ['build:pascal']);
  if (buildCode !== 0) process.exit(buildCode);

  writeStamp(currentHash);
}

/*
 * Chỉ chạy khi file này được gọi thẳng — cùng khuôn với `check-bundle-size.mjs`.
 * Khi bộ test `import` nó, đoạn dưới không chạy, nên nạp module không kéo theo
 * một lượt dựng Pascal thật.
 */
if (process.argv[1] !== undefined && import.meta.url.endsWith(basename(process.argv[1]))) {
  main();
}
