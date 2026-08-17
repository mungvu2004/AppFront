import { expect, test } from '@playwright/test';

/**
 * The motion demo at 1440px.
 *
 * Captured at rest — no handover running and the staggered list settled — so the
 * baseline is stable. Playwright disables CSS animations for screenshots, and
 * the scene layers are driven by inline opacity and transform that sit at their
 * resting values until something is clicked.
 */
test('captures the motion demo at desktop width', async ({ page }) => {
  await page.setViewportSize({ width: 1440, height: 900 });
  await page.goto('/');

  await page.getByRole('button', { name: 'Motion & Transitions' }).click();
  await expect(page.getByRole('heading', { name: 'Chuyển cảnh và nhịp' })).toBeVisible();

  await expect(page).toHaveScreenshot('motion-1440.png', { fullPage: true });
});
