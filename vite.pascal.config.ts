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
import { defineConfig, transformWithEsbuild, type Alias, type Plugin, type PluginOption } from 'vite';
import react from '@vitejs/plugin-react';
import path from 'path';
import { existsSync, readFileSync } from 'fs';
import { createRequire } from 'module';
import tailwindcss from '@tailwindcss/postcss';

import { pascalCatalogLocal } from './scripts/pascal-catalog-local.mjs';
import { pascalMaterialLocal } from './scripts/pascal-material-local.mjs';
import { pascalCssScope } from './scripts/pascal-css-scope.mjs';
import { pascalNoEval } from './scripts/pascal-no-eval.mjs';
import { pascalRealism } from './scripts/pascal-realism.mjs';
import { pascalRender } from './scripts/pascal-render.mjs';
import { PASCAL_REALISM_ALIASES } from './vite.pascal.aliases';
import { pascalSelfHost, WORKER_SELF_HOST_RULES } from './scripts/pascal-self-host.mjs';
import { pascalVi } from './scripts/pascal-vi.mjs';
import { pascalUiPatch } from './scripts/pascal-ui-patch.mjs';

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

/**
 * Dev không thay chữ trong mã: client của vite gán từng khoá lên `globalThis` theo thứ tự,
 * nên `'process.env': '{}'` (gán sau cùng) xoá mất các khoá trên → vật liệu lại xin CDN
 * `editor.pascal.app`. Bỏ khoá đó; React bản development để Fast Refresh vẽ lại được.
 */
function devDefines() {
  const defines = Object.entries(PASCAL_ENV_DEFINES).filter(([key]) => key !== 'process.env');
  return { ...Object.fromEntries(defines), 'process.env.NODE_ENV': '"development"' };
}

/**
 * `pnpm dev:3d` (`scripts/dev-3d.mjs`): trang 3D chạy từ mã nguồn, có HMR, thay vì từ
 * bản dựng tĩnh. Phục vụ `/editor3d.html` (dev server chính chuyển tiếp tới đây) từ chính
 * `public/editor3d.html`, đổi bó đã dựng sang lối vào nguồn. Bỏ `style.css`: ở dev, CSS
 * đi theo `import` trong JS.
 */
function pascalDevPage(): Plugin {
  const builtScript = '/assets/pascal/pascal-page.js';
  const builtStyle = /\s*<link rel="stylesheet" href="\/assets\/pascal\/style\.css" \/>/;
  return {
    name: 'pascal-dev-page',
    apply: 'serve',
    configureServer(server) {
      server.middlewares.use(async (req, res, next) => {
        if (req.url?.split('?')[0] !== '/editor3d.html') return next();
        const html = readFileSync(path.resolve(__dirname, 'public/editor3d.html'), 'utf8');
        if (!html.includes(builtScript) || !builtStyle.test(html)) {
          return next(new Error('pascal-dev-page: public/editor3d.html đã đổi thẻ nạp bó — cập nhật vite.pascal.config.ts'));
        }
        // Đường tính từ gốc dự án; `transformIndexHtml` tự thêm `base`.
        const dev = html.replace(builtStyle, '').replace(builtScript, '/src/pascal-page/main.tsx');
        res.setHeader('Content-Type', 'text/html; charset=utf-8');
        res.end(await server.transformIndexHtml('/editor3d.html', dev));
      });
    },
  };
}

/**
 * Ở dev, module chỉ được biến đổi khi trình duyệt xin tới, nên phép kiểm "mọi luật đều
 * khớp" ở `buildEnd` của các plugin `pascal-*` (chạy lúc đóng server) chỉ báo đỏ giả.
 * Gói trong `node_modules` (drei, zod) được vite gói sẵn, không qua plugin: ở dev drei
 * còn trỏ CDN Draco, zod còn dò `new Function` — dev không có CSP nên vẫn chạy.
 */
function devPlugins(command: 'build' | 'serve', plugins: Plugin[]): PluginOption[] {
  return command === 'build' ? plugins : plugins.map((plugin) => ({ ...plugin, buildEnd: undefined }));
}

/**
 * Minify từng chunk JS sau khi Rollup ghép xong.
 *
 * Chế độ `lib` + `formats: ['es']` của Vite 5 KHÔNG minify chunk, dù `build.minify: 'terser'`
 * (đo 2026-10-24: `ids-*.js` 16 MB nguyên khoảng trắng và tên biến dài, 3,6 MB gzip). Bó này
 * chạy thẳng trên trình duyệt, không qua bundler nào nữa, nên mất chú thích `@__PURE__` không
 * hại gì. Dùng esbuild (không terser) vì nhanh hơn nhiều trên một bó cỡ này.
 * Kết quả: 16 → 9,5 MB thô, 3,6 → 2,8 MB gzip.
 */
function pascalMinify(): Plugin {
  return {
    name: 'pascal-minify',
    apply: 'build',
    async renderChunk(code, chunk) {
      const out = await transformWithEsbuild(code, chunk.fileName, {
        loader: 'js',
        format: 'esm',
        target: 'es2022',
        minify: true,
        legalComments: 'none',
      });

      return { code: out.code, map: null };
    },
  };
}

export default defineConfig(({ command }) => ({
  plugins: [
    ...devPlugins(command, [
      pascalVi({ packagesDir: PASCAL_PACKAGES }),
      pascalUiPatch({ packagesDir: PASCAL_PACKAGES }),
      pascalRender(),
      // Sau pascalRender: luật editor-realism (scripts/realism/*.mjs) có thể neo trên chuỗi đã vá.
      pascalRealism(),
      pascalSelfHost(),
      // zod 4 dò `new Function` → vi phạm CSP `script-src eval` trên editor3d.html.
      pascalNoEval(),
      pascalCatalogLocal(),
      pascalMaterialLocal(),
    ]),
    react(),
    pascalDevPage(),
    pascalMinify(),
  ],
  // Worker có đồ thị plugin riêng: không có dòng này thì luật tự host không chạm tới nó.
  worker: { plugins: () => [pascalSelfHost({ rules: WORKER_SELF_HOST_RULES })] },
  // Dev (`pnpm dev:3d`): app chính chuyển cả `/assets/pascal/**` sang đây, mà trình xem
  // (`usePascalViewer`) vẫn nạp bó ĐÃ DỰNG `pascal-mount.js` + chunk của nó — phục vụ chúng
  // như tệp tĩnh.
  publicDir: command === 'build' ? false : 'public/assets/pascal',
  // `pnpm dev:3d` chạy hai dev server cùng gốc: chung `node_modules/.vite` thì chúng
  // giành nhau thư mục gói sẵn (Windows: EPERM khi đổi tên `deps`).
  cacheDir: 'node_modules/.vite-pascal',
  // Dev: bộ gói sẵn khoá theo TÊN gói, nên zod 3 (`src/**`, viewer) và zod 4 (core, editor)
  // gộp làm một → "z.templateLiteral is not a function". zod là ESM thuần: phục vụ thẳng.
  optimizeDeps: { exclude: ['zod'] },
  base: '/assets/pascal/',
  resolve: {
    alias: [
      ...pascalSourceAliases(),
      ...EDITOR_DEP_ALIASES,
      ...PASCAL_REALISM_ALIASES,
      { find: '@', replacement: path.resolve(__dirname, './src') },
      { find: 'next/image', replacement: path.resolve(__dirname, './vendor/pascal/shims/next-image.tsx') },
      { find: 'next/link', replacement: path.resolve(__dirname, './vendor/pascal/shims/next-link.tsx') },
      // `blob-stream` gốc cần `stream` của Node (Vite dựng thành rỗng) → xuất PDF hỏng; xem tệp thay.
      { find: /^blob-stream$/, replacement: path.resolve(__dirname, './src/pascal-page/blobStream.ts') },
    ],
  },
  define: command === 'build' ? PASCAL_ENV_DEFINES : devDefines(),
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
}));
