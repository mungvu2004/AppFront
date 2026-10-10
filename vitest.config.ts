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
     * `pool: 'threads'` thay `forks` (mặc định của vitest). Số đo A-pool
     * (TEST-SPEED-ISSUES.md) trên cả bộ: 149 s so với 192–207 s (−25 %),
     * 8.905/8.905 xanh — chỉ đổi pool, không đổi gì khác. Chỉ áp cho
     * `pnpm test`; khối `coverage` không chạm (coverage + threads từng sập,
     * nghi hết bộ nhớ — FE-10 lo).
     *
     * `maxThreads: 8`: máy đo có 12 lõi logic (`os.cpus().length`). `pnpm
     * verify` chạy toàn bộ trên mọi lõi cùng lúc và **thường có agent khác
     * chạy song song** (đã nói ở chú thích `testTimeout` dưới) — để trần ở
     * 8 chứ không phải 12 là chừa ~4 lõi cho IDE/dev server/agent khác, cùng
     * hướng với mức 4–6 mà A14 gợi ý cho nhánh coverage (nặng hơn vì có v8).
     * `minThreads: 1` để không giữ luồng rảnh khi chạy một nhóm file nhỏ.
     */
    pool: 'threads',
    poolOptions: {
      threads: {
        maxThreads: 8,
        minThreads: 1,
      },
    },

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
     * thêm vào. Những thư mục/tệp KHÔNG có mặt ở đây đã được thử **nguyên cả
     * thư mục** và hỏng — chúng chạm `window`, `IndexedDB`, `canvas`,
     * `EventSource` hoặc React. Vẫn còn hỏng nguyên thư mục (có file lẻ xanh,
     * liệt kê riêng dưới "PERF-01/FE-1" bên dưới):
     *
     *     lib/screen-state · lib/three (trừ build/camera/interaction/perf/preview)
     *     api/__tests__ (trừ contracts) · store/__tests__ · components · hooks
     *     screens (trừ các tệp lẻ liệt kê dưới)
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

      /**
       * PERF-01/FE-1 — 116 tệp đo ở TEST-SPEED-ISSUES A12 (`do-cu/node-ok-files.txt`,
       * đo 2026-10-09 trên `origin/master` cũ). Kiểm lại trên nhánh này 2026-10-10
       * bằng `--environment node --maxWorkers=2`: 115/116 còn xanh —
       * `src/screens/admin/UserManagement/useUserManagement.test.ts` nay dùng
       * `renderHook` (chạm `document`), bỏ khỏi danh sách, ở lại jsdom. 115 tệp
       * còn lại xanh trọn vẹn, 2.772/2.772 bài. Nguyên cả thư mục xanh thì ghi
       * một dòng; còn lại (thư mục có file jsdom trộn với file node) thì ghi
       * đích danh từng tệp.
       */
      ['eslint-rules/__tests__/**', 'node'],
      ['scripts/__tests__/**', 'node'],
      ['src/api/__tests__/contracts/**', 'node'],
      ['src/api/schemas/__tests__/**', 'node'],
      ['src/lib/export/__tests__/**', 'node'],
      ['src/lib/three/build/__tests__/**', 'node'],
      ['src/lib/three/camera/__tests__/**', 'node'],
      ['src/lib/three/interaction/__tests__/**', 'node'],
      ['src/lib/three/perf/__tests__/**', 'node'],
      ['src/lib/three/preview/__tests__/**', 'node'],
      ['src/mocks/**', 'node'],
      ['src/screens/pipeline/pipelineErrorText.test.ts', 'node'],
      ['src/store/*.test.ts', 'node'],

      // `src/api/__tests__` còn 3 tệp jsdom (adminMlClient, adminMlJobsClient,
      // appClient) — không nguyên cả thư mục được, nên liệt tên 14 tệp xanh.
      [
        'src/api/__tests__/{authRecovery,client,drawings,floorLayerGraph,library,me,mockLayerState,notifications,projectGroups,quality,spatial,urlJoiners,users,versions}.test.ts',
        'node',
      ],
      ['src/components/canvas/materialMap.test.ts', 'node'],
      ['src/components/pascal/__tests__/pascalScene.test.ts', 'node'],
      ['src/hooks/useGridLayer.test.ts', 'node'],
      ['src/i18n/vi.units.test.ts', 'node'],
      ['src/lib/auth/__tests__/{bootstrap,permissionMatrix,permissions}.test.ts', 'node'],
      [
        'src/lib/autosave/__tests__/{beforeUnload,spatialLayerSave,toSaveIndicatorState}.test.ts',
        'node',
      ],
      ['src/lib/errors/__tests__/{describeError,kinds,toAppError,wireError}.test.ts', 'node'],
      [
        'src/lib/input/__tests__/{dragDrop,shortcutRegistry,shortcutRegistryListing}.test.ts',
        'node',
      ],
      ['src/lib/telemetry/__tests__/userRoleChangeEvent.test.ts', 'node'],
      ['src/lib/testing/__tests__/{fixtures,noRawColor}.test.ts', 'node'],
      [
        'src/lib/three/present/__tests__/{assets,director,occlusion,plan,planLoader}.test.ts',
        'node',
      ],
      ['src/lib/upload/__tests__/{index,uploadTask,validate}.test.ts', 'node'],
      [
        'src/screens/account/AccountSettings/{accountAuthGateway,accountSettingsGateway}.test.ts',
        'node',
      ],
      // `useUserManagement.test.ts` dùng `renderHook`/React — chạm `document`,
      // ở lại jsdom. Chỉ `activityKindLabel.test.ts` (hàm thuần) qua node.
      ['src/screens/admin/UserManagement/activityKindLabel.test.ts', 'node'],
      ['src/screens/auth/fragmentToken.test.ts', 'node'],
      ['src/screens/dashboard/ProjectDashboard/projectsGateway.test.ts', 'node'],
      [
        'src/screens/export/VersionHistory/{versionHistoryFixtures,versionHistoryGateway,versionSnapshotAdapter}.test.ts',
        'node',
      ],
      ['src/screens/project/ProjectSettings/{projectSettingsGateway,settingsErrors}.test.ts', 'node'],
      ['src/screens/qc/DimensionOcrReview/dimensionOcrReviewGateway.nullGraph.test.ts', 'node'],
      ['src/screens/qc/RoomLabelReview/roomLabelFixture.test.ts', 'node'],
      ['src/screens/rules/RuleSettings/ruleSettingsGateway.test.ts', 'node'],
      ['src/screens/system/CollaborationLayer/conflictChain.test.tsx', 'node'],
      ['src/screens/upload/InputQualityGate/inputQualityWriteErrors.test.ts', 'node'],
      ['src/screens/viewer/MeasurementTool/measurementToolGateway.test.ts', 'node'],
      ['src/screens/viewer/OverlayComparison/overlayComparisonGateway.test.ts', 'node'],
      ['src/screens/viewer/Viewer3D/roomSearch.test.ts', 'node'],
      ['src/screens/viewer/ViewerShell/viewerShellGateway.test.ts', 'node'],
      [
        'src/store/__tests__/{commitRun,draftPreview,projectHydration,resetUserScopedState,ruleConfig,selectors,slices}.test.ts',
        'node',
      ],

      /**
       * PERF-01/FE-11 A15 — `happy-dom` thay `jsdom` cho 3 thư mục render React
       * còn lại (`screens`, `components`, `routes`). Đo 2026-10-11 trên nhánh
       * này, `--maxWorkers=2 --minWorkers=1`:
       *
       *     135 tệp (92 screens + 35 components + 8 routes), 2.379 bài:
       *     jsdom 128,5 s (hai lượt) · happy-dom 104,7–110,6 s (ba lượt xanh)
       *
       * `environmentMatchGlobs` thắng theo thứ tự KHỚP ĐẦU TIÊN trong mảng, nên
       * ba mục trên đã xếp screens/components/routes vào `node` khi là hàm
       * thuần — các mục đó đứng trước, vẫn thắng. Ba tệp còn đỏ trên happy-dom
       * (ShareDialog F-06, FloorManager NGHIEM-4, usePascalViewer B-V10-01) tự
       * ghim lại `jsdom` bằng pragma `// @vitest-environment jsdom` đầu tệp —
       * không cần liệt ở đây.
       */
      ['src/screens/**', 'happy-dom'],
      ['src/components/**', 'happy-dom'],
      ['src/routes/**', 'happy-dom'],
    ],

    /**
     * Trần của một bài và của một hook: 30 s, không phải 5 s / 10 s mặc định.
     *
     * Trần mặc định đo trên máy rảnh; `pnpm verify` thì chạy 439 tệp trên mọi
     * lõi cùng lúc, có độ phủ v8, và thường có agent khác chạy song song. Số đo
     * 2026-10-09 (QA-01c nợ #12) trên 14 tệp màn đỏ ở verify:
     *
     *     chạy từng tệp một:      414/414 xanh, bài async chậm nhất ~2,3 s
     *     14 tệp cùng lúc, 5 s:   25 đỏ — 13 "Test timed out in 5000ms", phần còn
     *                             lại là bài sau trong cùng tệp dựng ra cây rỗng
     *     14 tệp cùng lúc, 60 s:  22/25 xanh lại, cùng bài chạy 8–11 s (×4–5)
     *
     * Cùng một bài, cùng phép kiểm, chỉ chậm theo tải: không bài nào treo. Và một
     * bài hết giờ giữa chừng một `await act(...)` bỏ lại phạm vi `act` của React
     * mở, nên mọi `render` sau nó trong cùng tệp ra `<div />` rỗng — một lần hết
     * giờ thành tám dòng đỏ. 30 s là ~12 lần bài async chậm nhất lúc rảnh; bài
     * treo thật vẫn đỏ, chỉ đỏ muộn hơn.
     */
    testTimeout: 30_000,
    hookTimeout: 30_000,

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
