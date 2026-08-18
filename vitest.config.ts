import { defineConfig } from 'vitest/config';
import react from '@vitejs/plugin-react';
import path from 'path';

/**
 * Ngưỡng độ phủ, đặt theo tầng chứ không đặt một con số cho cả repo.
 *
 * `src/domain` là mô hình nghiệp vụ — trục, tường, phòng, ô mở, đơn vị. Nó là
 * hàm thuần, không DOM, không mạng, nên không có lý do gì để một nhánh ở đây
 * không được test; ngưỡng 90%.
 *
 * `src/lib` cũng thuần nhưng rộng hơn và có phần chạm vào trình duyệt (autosave,
 * offline, http, three). Ngưỡng 80%.
 *
 * Số thấp hơn ngưỡng thì `pnpm coverage` hỏng. Cách xử lý là viết thêm test,
 * KHÔNG phải hạ ngưỡng — hạ ngưỡng là đổi định nghĩa "xong" để khỏi phải làm.
 */
const DOMAIN_THRESHOLD = 90;
const LIBRARY_THRESHOLD = 80;

export default defineConfig({
  plugins: [react()],
  test: {
    environment: 'jsdom',
    globals: true,
    setupFiles: './vitest.setup.ts',
    exclude: ['**/node_modules/**', '**/dist/**', '**/e2e/**'],
    coverage: {
      provider: 'v8',
      // `text` để đọc ngay trên terminal, `json-summary` để script đọc máy được,
      // `html` để lần theo dòng nào chưa chạy.
      reporter: ['text', 'json-summary', 'html'],

      // Đo mã sản phẩm. `all: true` để file chưa có test nào cũng bị tính là 0%
      // thay vì lặng lẽ biến mất khỏi mẫu số.
      all: true,
      include: ['src/**/*.{ts,tsx}'],
      exclude: [
        // Chính bộ test.
        '**/__tests__/**',
        '**/*.test.{ts,tsx}',
        '**/*.stories.{ts,tsx}',
        // `src/lib/testing/**` là hạ tầng kiểm thử, không phải mã sản phẩm: nó
        // chạy trong mọi test nhưng không có gì để bảo đảm về nó ngoài việc các
        // test khác xanh.
        'src/lib/testing/**',
        // Khai báo kiểu không sinh mã chạy được.
        'src/types/**',
        '**/*.d.ts',
        // Điểm khởi động, không có nhánh nào để test.
        'src/main.tsx',
      ],

      thresholds: {
        'src/domain/**': {
          branches: DOMAIN_THRESHOLD,
          functions: DOMAIN_THRESHOLD,
          lines: DOMAIN_THRESHOLD,
          statements: DOMAIN_THRESHOLD,
        },
        'src/lib/**': {
          branches: LIBRARY_THRESHOLD,
          functions: LIBRARY_THRESHOLD,
          lines: LIBRARY_THRESHOLD,
          statements: LIBRARY_THRESHOLD,
        },
      },
    },
  },
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src'),
    },
  },
});
