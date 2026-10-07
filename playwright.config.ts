import { defineConfig, devices } from '@playwright/test';

export default defineConfig({
  testDir: './e2e',
  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 2 : 0,
  ...(process.env.CI ? { workers: 1 } : {}),
  reporter: 'html',
  use: {
    /* Cùng biến và cùng mặc định với `scripts/run-playwright.mjs` — xem khối
       chú thích ở đầu tệp ấy. Hai nguồn lệch nhau là cách chắc chắn nhất để
       Playwright đi gõ cửa một máy chủ khác với máy chủ nó vừa dựng. */
    baseURL: `http://127.0.0.1:${process.env.E2E_PORT ?? '5173'}`,
    trace: 'on-first-retry',
  },
  projects: [
    {
      name: 'chromium',
      use: { ...devices['Desktop Chrome'], channel: 'chrome' },
    },
  ],
});
