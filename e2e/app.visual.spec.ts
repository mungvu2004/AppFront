import { expect, test } from '@playwright/test';

test('captures the app shell at desktop width', async ({ page }) => {
  await page.setViewportSize({ width: 1440, height: 900 });
  await page.goto('/');
  await expect(page.getByText('Demo App')).toBeVisible();
  await expect(page).toHaveScreenshot('app-shell-1440.png', { fullPage: true });
});
