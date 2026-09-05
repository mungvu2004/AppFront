import { defineConfig } from 'vite';
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
export default defineConfig({
  plugins: [react()],
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
  },
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src'),
    },
  },
});
