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

/**
 * Bảy biến `process.env.NEXT_PUBLIC_*` mà mã Pascal đọc ở TẦNG MODULE.
 * Giữ khớp với `vite.config.ts` — lý do đầy đủ nằm ở đó.
 */
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
  // Đặt riêng, KHÔNG để rỗng: dòng khai của Pascal là
  // `process.env.X || 'https://editor.pascal.app'`, mà `''` là falsy nên chuỗi
  // rỗng rơi thẳng về CDN ngoài. Phải trỏ về chính mình.
  'process.env.NEXT_PUBLIC_ASSETS_CDN_URL': '"/pascal"',
};

export default defineConfig({
  plugins: [react()],
  define: PASCAL_ENV_DEFINES,
  test: {
    environment: 'jsdom',

    /**
     * Test hàm thuần chạy `node`, không dựng jsdom.
     *
     * `src/domain` là mô hình nghiệp vụ thuần — không DOM, không React, không
     * mạng (mục 0.4). Dựng một jsdom cho mỗi file ở đó là trả tiền cho thứ
     * không bao giờ được chạm tới, và hoá đơn lớn hơn phần việc thật rất nhiều.
     * Số đo trên 1.148 bài của `src/domain`, 36 file:
     *
     *     jsdom:  tests 2,09 s · environment 34,15 s · setup 26,20 s
     *     node:   tests 2,09 s · environment 0,01 s  · setup 0 s
     *
     * Hơn một phút biến mất mà không một phép kiểm nào đổi. Con số ấy nhân lên
     * theo số lõi đang tranh nhau: chính nó là thứ đẩy một bài A11 vượt hạn
     * 5000 ms khi cả bộ chạy song song.
     *
     * Danh sách dưới đây **đo từng thư mục một**, không suy từ tên tầng. Mỗi
     * mục đã được chạy với `--environment node` và xanh trọn vẹn trước khi được
     * thêm vào. Những thư mục KHÔNG có mặt ở đây đã được thử và hỏng — chúng
     * chạm `window`, `IndexedDB`, `canvas`, `EventSource` hoặc React:
     *
     *     lib/errors · lib/screen-state · lib/auth · lib/upload · lib/telemetry
     *     lib/autosave · lib/three · lib/testing · api · store · components
     *     hooks · screens
     *
     * Đừng thêm thư mục vào đây bằng phán đoán. Chạy
     * `npx vitest run <đường dẫn> --environment node` trước; nếu đỏ thì nó
     * thuộc jsdom, và lý do thường nằm ở một dòng duy nhất chạm DOM.
     */
    environmentMatchGlobs: [
      ['src/domain/**', 'node'],
      ['src/lib/format/**', 'node'],
      ['src/lib/geometry/**', 'node'],
      ['src/lib/versioning/**', 'node'],
      ['src/lib/coloring/**', 'node'],
      ['src/lib/selection/**', 'node'],
      ['src/lib/viewmodel/**', 'node'],
      ['src/lib/commands/**', 'node'],
      ['src/lib/tools/**', 'node'],
      ['src/lib/mutations/**', 'node'],
      ['src/lib/query/**', 'node'],
      ['src/lib/http/**', 'node'],
      ['src/lib/offline/**', 'node'],
      ['src/lib/realtime/**', 'node'],
      ['src/lib/motion/**', 'node'],
      // Bộ đổi dữ liệu Pascal: thuần, không chạm DOM. Đã chạy
      // `npx vitest run src/lib/pascal --environment node` trước khi thêm dòng
      // này — 36/36 xanh, 0,9 s so với 36 s dưới jsdom.
      ['src/lib/pascal/**', 'node'],
    ],

    globals: true,
    setupFiles: './vitest.setup.ts',
    // `vendor/**` giữ mã Pascal đã chép vào (`vendor/pascal/NGUON.md`). Bài
    // kiểm của họ chạy bằng `bun test`, không bằng vitest, và chúng cần bộ
    // công cụ riêng — để vitest tự nhặt chúng là chuốc lấy một rừng đỏ không
    // liên quan tới AppFront. `qa/**` là bộ Playwright QA (`qa/tsconfig.json` riêng).
    exclude: ['**/node_modules/**', '**/dist/**', '**/e2e/**', '**/vendor/**', 'qa/**'],
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
        // Dữ liệu demo cho 9 màn demo, không phải mã sản phẩm. `spatial.ts` là
        // 1.612 dòng hằng số: chỉ cần một file import nó là toàn bộ được tính
        // "đã phủ 100%", nên nó bơm 1.610 câu lệnh dễ dãi vào tử số và làm con
        // số độ phủ tổng đẹp hơn sự thật. Loại ra thì số còn lại nói đúng phần
        // mã có nhánh để test.
        //
        // Ngưỡng theo tầng (`src/domain` 90%, `src/lib` 80%) không đổi vì
        // `src/mocks` không nằm trong hai tầng đó — đây là sửa cho số trung thực,
        // không phải nới ngưỡng.
        'src/mocks/**',
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
      // Giữ khớp với `vite.config.ts`: vitest KHÔNG hợp nhất cấu hình của
      // vite, nó thay thế hoàn toàn (xem khối chú thích đầu `vite.config.ts`).
      // Thiếu hai dòng này thì mọi bài kiểm chạm tới `vendor/pascal` sẽ hỏng ở
      // `next/image` dù bản dựng sản phẩm vẫn chạy.
      'next/image': path.resolve(__dirname, './vendor/pascal/shims/next-image.tsx'),
      'next/link': path.resolve(__dirname, './vendor/pascal/shims/next-link.tsx'),
    },
  },
});
