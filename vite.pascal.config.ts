/**
 * Lượt dựng **thứ hai**: gói Pascal thành một bó độc lập, tách khỏi gói chính.
 *
 * Lý do đầy đủ nằm ở đầu `src/components/pascal/pascalMount.tsx`. Tóm tắt: cổng
 * "chi phí thêm cho một màn" còn dư **0,4 KiB / 280**, mà màn Pascal nặng khoảng
 * 1,5 MB gzip — nên nó không đi qua gói chính được, kể cả qua `lazy()`.
 *
 * Ba dòng dưới đây mỗi dòng chặn một cách hỏng đã từng xảy ra thật:
 *
 *   - **`publicDir: false`** — thiếu nó, vite chép cả `public/` của AppFront vào
 *     thư mục ra và ta đếm tài sản của chính mình thành "dung lượng Pascal". Đo
 *     được ở một lượt trước: sai 7,8 MB. Tôi đã tự bước vào bẫy này một lần.
 *   - **`base`** — thiếu nó, các chunk nạp muộn của Pascal xin theo đường gốc `/`
 *     và rơi vào router của app chính thay vì vào tệp tĩnh.
 *   - **`emptyOutDir`** — thiếu nó, lượt dựng sau xếp chồng lên lượt trước và
 *     thư mục phình lên trong im lặng. Đo được ở một lượt trước: 463 tệp thay vì
 *     235, tổng đọc ra sai **29 %**.
 *
 * Đích nằm **trong** `public/` để lượt dựng chính chép nó sang `dist/` như tài sản
 * tĩnh. Bốn cổng dung lượng cũ không đếm nhầm nó theo cấu tạo: `readAssets()`
 * không đệ quy và lọc theo đuôi tệp, mà `assets/pascal` là một thư mục.
 *
 * Chạy: `pnpm build:pascal`. Phải chạy **trước** `pnpm build`.
 */
import { defineConfig, type Alias } from 'vite';
import react from '@vitejs/plugin-react';
import path from 'path';
import { existsSync, readFileSync } from 'fs';
import { createRequire } from 'module';
import tailwindcss from '@tailwindcss/postcss';

import { pascalCatalogLocal } from './scripts/pascal-catalog-local.mjs';
import { pascalCssScope } from './scripts/pascal-css-scope.mjs';
import { pascalNoEval } from './scripts/pascal-no-eval.mjs';
import { pascalSelfHost, WORKER_SELF_HOST_RULES } from './scripts/pascal-self-host.mjs';
import { pascalVi } from './scripts/pascal-vi.mjs';

const PASCAL_PACKAGES = path.resolve(__dirname, './vendor/pascal/packages');
const EDITOR_DIR = path.join(PASCAL_PACKAGES, 'editor');

/**
 * Gói Pascal gốc (không sửa) khai `exports` trỏ vào `dist/` — ta không dựng `dist`.
 * Đổi mỗi lối vào `./dist/x.js` thành `src/x.ts(x)` bằng alias khớp đúng tên.
 */
function pascalSourceAliases(): Alias[] {
  const aliases: Alias[] = [];
  for (const pkg of ['core', 'viewer', 'nodes', 'editor']) {
    const dir = path.join(PASCAL_PACKAGES, pkg);
    const { name, exports } = JSON.parse(readFileSync(path.join(dir, 'package.json'), 'utf8')) as {
      name: string;
      exports: Record<string, string | { import: string }>;
    };
    for (const [sub, target] of Object.entries(exports)) {
      const file = typeof target === 'string' ? target : target.import;
      const base = path.join(dir, file.replace(/^\.\/dist\//, './src/').replace(/\.js$/, ''));
      const src = ['', '.ts', '.tsx'].map((ext) => base + ext).find((f) => /\.tsx?$/.test(f) && existsSync(f));
      if (!src) throw new Error(`Không tìm thấy nguồn cho ${name}${sub.slice(1)} (${file})`);
      const id = name + sub.slice(1);
      aliases.push({ find: new RegExp(`^${id}$`), replacement: src });
    }
  }
  return aliases;
}

/** Gói mà `src/pascal-page/upstream` (chép từ apps/editor) nhập: lấy đúng bản editor dùng. */
const EDITOR_DEP_ALIASES: Alias[] = [
  ...['@radix-ui/react-tooltip', 'lucide-react'].map((dep) => ({
    find: new RegExp(`^${dep}$`),
    replacement: path.join(EDITOR_DIR, 'node_modules', dep),
  })),
  // Bản offline (ESM): không tự gọi api.iconify.design; icon nạp sẵn ở src/pascal-page/icons.ts.
  {
    find: /^@iconify\/react$/,
    replacement: createRequire(path.join(EDITOR_DIR, 'package.json')).resolve('@iconify/react/dist/offline.js'),
  },
];

/** Chỉ khoanh CSS của mount nhúng cũ; trang 3D (`src/pascal-page`) sở hữu cả tài liệu. */
function scopeOutsidePage() {
  const scope = pascalCssScope();
  const pageDir = path.resolve(__dirname, './src/pascal-page');
  return {
    ...scope,
    OnceExit(root: Parameters<NonNullable<typeof scope.OnceExit>>[0], helpers: Parameters<NonNullable<typeof scope.OnceExit>>[1]) {
      const file = root.source?.input.file ?? '';
      if (path.resolve(file).startsWith(pageDir)) return;
      return scope.OnceExit?.(root, helpers);
    },
  };
}

/** Bảy biến `process.env.NEXT_PUBLIC_*` mà mã Pascal đọc ở TẦNG MODULE. */
const PASCAL_ENV_DEFINES = {
  ...Object.fromEntries(
    [
      'NEXT_PUBLIC_SUPABASE_URL',
      'NEXT_PUBLIC_SUPABASE_ANON_KEY',
      'NEXT_PUBLIC_APP_URL',
      'NEXT_PUBLIC_VERCEL_ENV',
      'NEXT_PUBLIC_VERCEL_URL',
      'NEXT_PUBLIC_VERCEL_PROJECT_PRODUCTION_URL',
    ].map((key) => [`process.env.${key}`, '""']),
  ),
  // KHÔNG để rỗng: dòng khai của Pascal là `process.env.X || '<CDN>'`, và `''`
  // là falsy nên chuỗi rỗng rơi thẳng về CDN ngoài.
  'process.env.NEXT_PUBLIC_ASSETS_CDN_URL': '"/pascal"',
  // Hai khoá này KHÔNG phải `NEXT_PUBLIC_*`, và ở lượt dựng **lib** vite không
  // tự điền `NODE_ENV` như nó làm cho một app thường. Thiếu chúng thì gói ném
  // `process is not defined` ngay lúc nhập module — đã đo, 38 chỗ đọc
  // `NODE_ENV` và 1 chỗ đọc `PORT` còn sót lại trong bản dựng.
  'process.env.NODE_ENV': '"production"',
  'process.env.PORT': '""',
  // Các cờ gỡ lỗi khác (`PASCAL_*_AUDIT`, `DUPLICATE_CAPTURE_*`…) đọc từ `process.env`.
  'process.env': '{}',
};

export default defineConfig({
  plugins: [
    pascalVi({ packagesDir: PASCAL_PACKAGES }),
    pascalSelfHost(),
    // zod 4 dò `new Function` → vi phạm CSP `script-src eval` trên editor3d.html.
    pascalNoEval(),
    pascalCatalogLocal(),
    react(),
  ],
  // Worker có đồ thị plugin riêng: không có dòng này thì luật tự host không chạm tới nó.
  worker: { plugins: () => [pascalSelfHost({ rules: WORKER_SELF_HOST_RULES })] },
  publicDir: false,
  base: '/assets/pascal/',
  resolve: {
    alias: [
      ...pascalSourceAliases(),
      ...EDITOR_DEP_ALIASES,
      { find: '@', replacement: path.resolve(__dirname, './src') },
      { find: 'next/image', replacement: path.resolve(__dirname, './vendor/pascal/shims/next-image.tsx') },
      { find: 'next/link', replacement: path.resolve(__dirname, './vendor/pascal/shims/next-link.tsx') },
    ],
  },
  define: PASCAL_ENV_DEFINES,
  // CSS của chính Pascal: Tailwind v4 như app gốc, rồi khoanh vào `.pascal-root`
  // (lý do ở `scripts/pascal-css-scope.mjs`). Cấu hình nội tuyến nên
  // `postcss.config.js` (Tailwind 3 của AppFront) không chạy ở lượt dựng này.
  // `optimize` để Lightning CSS gỡ CSS lồng trước khi ta tiền tố selector.
  css: { postcss: { plugins: [tailwindcss({ optimize: true }), scopeOutsidePage()] } },
  build: {
    outDir: 'public/assets/pascal',
    emptyOutDir: true,
    minify: 'terser',
    terserOptions: { compress: { passes: 2, pure_getters: true } },
    lib: {
      entry: {
        'pascal-mount': path.resolve(__dirname, './src/components/pascal/pascalMount.tsx'),
        'pascal-page': path.resolve(__dirname, './src/pascal-page/main.tsx'),
      },
      formats: ['es'],
      fileName: (_format, entryName) => `${entryName}.js`,
    },
  },
});
