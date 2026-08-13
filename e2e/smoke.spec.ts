import { expect, test } from '@playwright/test';

test('smoke test displays the app shell', async ({ page }) => {
  await page.goto('/');
  await expect(page.getByText('Demo App')).toBeVisible();
});
