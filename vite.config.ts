import { defineConfig, loadEnv } from 'vite';
import react from '@vitejs/plugin-react';
import path from 'path';

/**
 * Cấu hình cho `vite dev` và `vite build`. KHÔNG cấu hình test ở đây.
 *
 * File này từng khai một khối `test` mà không lần chạy nào đọc tới: vitest tìm
 * `vitest.config.ts` trước, và khi file đó tồn tại thì nó thay thế hoàn toàn chứ
 * không hợp nhất. Hai chỗ khai cùng một thứ, một chỗ im lặng không có tác dụng —
 * người sửa ngưỡng hay `environment` ở đây sẽ tưởng mình đã đổi được gì đó.
 *
 * Cấu hình test — môi trường, setup, ngưỡng độ phủ theo tầng — nằm ở
 * `vitest.config.ts`, và chỉ ở đó.
 */
export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), '');

  return {
    plugins: [react()],
    server: {
      proxy: {
        // AppBack đọc `Origin` để so với `PUBLIC_BASE_URL`; dev server phải đặt
        // biến đó bằng origin của Vite (mặc định http://localhost:5173), không
        // thì POST /api/auth/* trả 403 ORIGIN_MISMATCH (BE-00 §5). Vì vậy không
        // rewrite path và không đổi Origin ở đây — proxy chỉ chuyển tiếp nguyên
        // trạng.
        '/api': {
          target: env.VITE_API_PROXY_TARGET || 'http://localhost:8080',
          changeOrigin: false,
        },
      },
    },
    build: {
      // terser thay vì esbuild: chậm hơn vài giây mỗi lần dựng, đổi lấy ~1,5%
      // gzip trên toàn bộ JS — đúng tinh thần cổng kích thước gói: sửa cách dựng,
      // không nới ngưỡng. Không mangle property nào; `passes: 2` cho terser nén
      // thêm một lượt (thêm ~2 s dựng, bớt ~2 KiB gzip nữa).
      minify: 'terser',
      terserOptions: { compress: { passes: 2, pure_getters: true } },
      // `dist/.vite/manifest.json` — bật vì cổng kích thước gói cần ĐỒ THỊ nhập,
      // không chỉ danh sách file. Từ khi router `lazy()` 25 màn, "tổng JS" không
      // còn là "chi phí màn hình đầu tiên": muốn biết cái sau thì phải đi từ chunk
      // `isEntry` theo `imports` (nhập tĩnh) và tách riêng `dynamicImports` (nhập
      // động, tải muộn). Manifest là chỗ duy nhất vite ghi sẵn đồ thị đó ra đĩa;
      // không có nó thì `scripts/check-bundle-size.mjs` chỉ cộng được kích thước
      // file và lại đo nhầm thứ nó sinh ra để chặn. Xem `docs/notes/bundle-size.md`.
      // File này chỉ nằm trong `dist/`, không được nhập vào gói và không đi ra dây.
      manifest: true,
      // Runtime React (react + react-dom + scheduler) vào một chunk riêng. React 19
      // nặng hơn 18 khoảng 25 KiB gzip; để chung với chunk vào thì chunk đó vượt trần
      // 170 KiB của "chunk JS lớn nhất". Tách ra là cách script cổng tự khuyên — sửa
      // cách dựng, không nới ngân sách. "Màn hình đầu tiên" vẫn tính cả hai file
      // (chunk vào nhập tĩnh chunk này), nên cổng đó không được lợi gì từ việc tách.
      rollupOptions: {
        output: {
          manualChunks: (id) =>
            /[\\/]node_modules[\\/](react|react-dom|scheduler)[\\/]/.test(id) ? 'react' : undefined,
        },
      },
    },
    resolve: {
      alias: {
        '@': path.resolve(__dirname, './src'),
      },
    },
  };
});
