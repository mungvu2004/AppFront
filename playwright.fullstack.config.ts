import { defineConfig, devices } from '@playwright/test';

import {
  ACTION_TIMEOUT_MS,
  CHAIN_TIMEOUT_MS,
  EXPECT_TIMEOUT_MS,
  NAVIGATION_TIMEOUT_MS,
  readBaseUrl,
} from './e2e/fullstack/env';

/* F-14 — chuỗi FE + BE trên compose của AppBack. Chỉ ghép: mọi logic ở `e2e/fullstack/*.ts`
   (file này nằm ngoài `tsconfig.json`). Không `webServer`, không `bypassCSP`: CSP của nginx
   là thứ chuỗi kiểm. Trace bật trong spec SAU đăng nhập, chỉ lưu khi hỏng. */
export default defineConfig({
  testDir: './e2e/fullstack',
  testMatch: /\.fullstack\.ts$/,
  fullyParallel: false,
  workers: 1,
  retries: 0,
  forbidOnly: true,
  timeout: CHAIN_TIMEOUT_MS,
  expect: { timeout: EXPECT_TIMEOUT_MS },
  globalSetup: './e2e/fullstack/globalSetup.ts',
  outputDir: 'test-results/fullstack',
  reporter: [['line'], ['html', { outputFolder: 'playwright-report/fullstack', open: 'never' }]],
  use: {
    baseURL: readBaseUrl(),
    actionTimeout: ACTION_TIMEOUT_MS,
    navigationTimeout: NAVIGATION_TIMEOUT_MS,
    trace: 'off',
  },
  projects: [
    {
      name: 'chromium',
      use: { ...devices['Desktop Chrome'], channel: 'chrome', viewport: { width: 1440, height: 900 } },
    },
  ],
});
