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
import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import path from 'path';

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
};

export default defineConfig({
  plugins: [react()],
  publicDir: false,
  base: '/assets/pascal/',
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src'),
      'next/image': path.resolve(__dirname, './vendor/pascal/shims/next-image.tsx'),
      'next/link': path.resolve(__dirname, './vendor/pascal/shims/next-link.tsx'),
    },
  },
  define: PASCAL_ENV_DEFINES,
  build: {
    outDir: 'public/assets/pascal',
    emptyOutDir: true,
    minify: 'terser',
    terserOptions: { compress: { passes: 2, pure_getters: true } },
    lib: {
      entry: path.resolve(__dirname, './src/components/pascal/pascalMount.tsx'),
      formats: ['es'],
      fileName: () => 'pascal-mount.js',
    },
  },
});
