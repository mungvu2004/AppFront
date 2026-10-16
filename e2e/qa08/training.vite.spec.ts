/**
 * QA phase 08 S - SCR-35 Training jobs on Vite + mocked API (layout only).
 *
 * FL-35T-F-001/F-004: at 1024x768 with the detail aside open, the left column (min 640) + gap 24 + aside 400
 * exceeded the 960 content width, so the page scrolled sideways (horizontalOverflowPx 72).
 * Proof: no page horizontal scroll AND the jobs table stays >= 640 px wide (it scrolls inside its own box).
 * Run: `E2E_PORT=5184 node scripts/run-playwright.mjs e2e/qa08/training.vite.spec.ts --workers 1`.
 */
import { expect, test } from '@playwright/test';

import { signInAs } from '../fixtures/session';
import { ROUTES } from '../fixtures/routes';

const FIRST_PAINT_TIMEOUT_MS = 15_000;
const TITLE = 'Huấn luyện model AI'; // TrainingJobs.tsx TEXT.title
const DETAIL = 'Chi tiết lượt huấn luyện'; // fallback only, aside is matched by role complementary
const MIN_TABLE_PX = 640;

test('SCR-35 [mocked response] 35T-F-004 jobs table fits 1024x768 with aside open', async ({ page }) => {
  await signInAs(page, 'admin', ROUTES.adminTrainingJobs);
  await page.setViewportSize({ width: 1024, height: 768 });
  await expect(page.getByRole('heading', { level: 1, name: TITLE, exact: true })).toBeVisible({ timeout: FIRST_PAINT_TIMEOUT_MS });
  const firstJob = page.locator('button[aria-pressed]').first();
  await expect(firstJob).toBeVisible();
  await firstJob.click();
  await expect(page.getByRole('complementary').first(), DETAIL).toBeVisible();
  const [scroll, client] = await page.evaluate(() => {
    const el = document.scrollingElement ?? document.documentElement;
    return [el.scrollWidth, el.clientWidth];
  });
  expect.soft(scroll, '1024x768 page scrolls horizontally').toBeLessThanOrEqual(client);
  const tableWidth = await page.locator('table').first().evaluate((el) => el.getBoundingClientRect().width);
  expect(tableWidth, 'jobs table narrower than 640').toBeGreaterThanOrEqual(MIN_TABLE_PX);
});
