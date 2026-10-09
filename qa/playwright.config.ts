import { defineConfig, devices } from '@playwright/test';

import {
  ACTION_TIMEOUT_MS,
  EXPECT_TIMEOUT_MS,
  NAVIGATION_TIMEOUT_MS,
  readBaseUrl,
} from '../e2e/fullstack/env';

/* QA phase suite (E2E-TEST-PLAN.md v2). Chạy từ thư mục `qa/`:
   `npx playwright test tests/phase01_auth.spec.ts --headed`.
   Tách khỏi `playwright.config.ts` gốc (testDir `./e2e`, mock) và `playwright.fullstack.config.ts`
   (F-14) để không đổi hai bộ đang có. Track A mặc định là compose (`E2E_FULLSTACK_BASE_URL`);
   file Track B (mock) tự `test.use({ baseURL: MOCK_BASE_URL })`. Một worker, tuần tự: các phase
   dùng chung một dự án thật qua `tests/.state/runtime-session.json`. */

/* Mọi kết quả của một lượt nằm dưới `<E2E_RESULTS_DIR>/<E2E_RUN_ID>/<E2E_TAG>/` (JSON, log, HTML, ảnh lỗi,
   video) — không còn bị `test-results/` xoá hay `playwright-report/` ghi đè. Ảnh evidence:
   `<E2E_RESULTS_DIR>/<E2E_RUN_ID>/evidence/` (`tests/support/evidence.ts`). */
const RESULTS_DIR = process.env.E2E_RESULTS_DIR ?? 'F:/App/qa-results';
const RUN_DIR = `${RESULTS_DIR}/${process.env.E2E_RUN_ID ?? 'run-01'}/${process.env.E2E_TAG ?? 'adhoc'}`;

export default defineConfig({
  testDir: './tests',
  testMatch: /phase\d{2}_[a-z0-9_]+\.spec\.ts$/u,
  fullyParallel: false,
  workers: 1,
  retries: 0,
  forbidOnly: true,
  timeout: 120_000,
  expect: { timeout: EXPECT_TIMEOUT_MS },
  outputDir: `${RUN_DIR}/artifacts`,
  reporter: [
    ['list'],
    ['html', { outputFolder: `${RUN_DIR}/report`, open: 'never' }],
    // Đọc bởi `tools/check-evidence.mjs` (mỗi case ≥ 1 ảnh).
    ['json', { outputFile: `${RUN_DIR}/results.json` }],
  ],
  use: {
    baseURL: readBaseUrl(),
    actionTimeout: ACTION_TIMEOUT_MS,
    navigationTimeout: NAVIGATION_TIMEOUT_MS,
    // Trace ghi giá trị `fill` của ô mật khẩu ở dạng rõ (mọi lượt `signInAdmin`), nên mặc định TẮT.
    // Bật bằng E2E_TRACE=1 chỉ trên máy mình, và đừng chia sẻ tệp trace đó (chain F-14 cũng chỉ bật sau đăng nhập).
    trace: process.env.E2E_TRACE === '1' ? 'on' : 'off',
    video: 'on',
    screenshot: 'only-on-failure',
    // ponytail: slowMo chung cho mọi lượt; đặt E2E_SLOWMO_MS=0 cho lượt không cần quan sát.
    launchOptions: { slowMo: Number(process.env.E2E_SLOWMO_MS ?? '400') },
  },
  projects: [
    {
      name: 'chromium',
      use: { ...devices['Desktop Chrome'], channel: 'chrome', viewport: { width: 1440, height: 900 } },
    },
  ],
});
