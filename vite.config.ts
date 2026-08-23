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
    // không nới ngưỡng. Cấu hình mặc định, không mangle property nào.
    minify: 'terser',
  },
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src'),
    },
  },
});
