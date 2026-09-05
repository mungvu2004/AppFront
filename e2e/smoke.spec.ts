import { expect, test } from '@playwright/test';

/**
 * `/` used to be the nine-screen demo picker; it is now `ProjectDashboardRoute`
 * (`src/routes/router.tsx`). This test protects A11's one hard rule — the app
 * boots and the real entry screen draws something, never a blank page — so it
 * asserts on the dashboard's own heading and project list rather than on the
 * demo picker's "Demo App" label, which no longer lives at this route.
 */
test('smoke test displays the app shell', async ({ page }) => {
  await page.goto('/');
  await expect(page.getByRole('heading', { name: 'Dự án của tôi' })).toBeVisible();
  await expect(page.getByRole('list', { name: 'Danh sách dự án' })).toBeVisible();
});
