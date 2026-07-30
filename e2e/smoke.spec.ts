import { test, expect } from '@playwright/test';

test('smoke test - displays success message', async ({ page }) => {
  await page.goto('/');
  await expect(page.getByText('Khởi tạo thành công')).toBeVisible();
});
