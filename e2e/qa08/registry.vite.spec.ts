/**
 * QA phase 08 S - SCR-36 Model AI registry on Vite + mocked API (layout only; jsdom cannot measure it).
 *
 * FL-36R-U1/U2/U3/U5 = BUG-P08-012: at 1024x768 the two-column layout needs 1072 px (32+640+24+344+32,
 * useModelRegistry.ts COLLAPSE_BREAKPOINT_PX) but collapsed only below 1024, so the page scrolled sideways.
 * Value that decided the case (p08-r1 phase08-ui, U08-36R-F-013-registry-1024): "1024x768: page scrolls horizontally".
 * Proof: document.scrollingElement.scrollWidth <= clientWidth on the registry at 1024 for the three families,
 * with a version detail open and with the activate dialog open.
 * Run: `E2E_PORT=5181 pnpm exec playwright test e2e/qa08/registry.vite.spec.ts` against
 * `VITE_USE_MOCK_API=true pnpm exec vite --host 127.0.0.1 --port 5181`.
 */
import { expect, test } from '@playwright/test';
import type { Page } from '@playwright/test';

import { signInAs } from '../fixtures/session';
import { ROUTES } from '../fixtures/routes';

const FIRST_PAINT_TIMEOUT_MS = 15_000;
const TITLE = 'Mô hình AI của chuỗi xử lý'; // ModelRegistry.tsx:30
const PICKER = 'Họ model'; // ModelRegistry.tsx:30
const FAMILIES = ['Tách lớp tường', 'Nhận diện cửa và đồ đạc', 'Đọc kích thước']; // useModelRegistry.ts:71-75
const ACTIVATE = 'Kích hoạt'; // ModelRegistryVersionTable.tsx:17
const DETAIL = 'Chi tiết phiên bản'; // ModelRegistry.tsx:40

async function noSideScroll(page: Page, what: string): Promise<void> {
  const [scroll, client] = await page.evaluate(() => {
    const el = document.scrollingElement ?? document.documentElement;
    return [el.scrollWidth, el.clientWidth];
  });
  expect.soft(scroll, `1024x768 ${what}: page scrolls horizontally`).toBeLessThanOrEqual(client);
}

test('SCR-36 [mocked response] 36R-F-013 registry fits 1024x768 without horizontal scroll', async ({ page }) => {
  await signInAs(page, 'admin', ROUTES.adminTrainingModels);
  await page.setViewportSize({ width: 1024, height: 768 });
  await expect(page.getByRole('heading', { level: 1, name: TITLE, exact: true })).toBeVisible({ timeout: FIRST_PAINT_TIMEOUT_MS });
  const picker = page.getByRole('radiogroup', { name: PICKER, exact: true });
  for (const family of FAMILIES) {
    const radio = picker.getByRole('radio', { name: family, exact: true });
    await radio.click();
    await expect(radio).toHaveAttribute('aria-checked', 'true');
    const labels = page.locator('button[aria-pressed]').first(); // MRV:32 version label (table row or collapsed card)
    await expect(labels.or(page.getByText('Chưa có phiên bản', { exact: true }))).toBeVisible();
    await noSideScroll(page, `${family} list`);
  }
  await picker.getByRole('radio', { name: 'Nhận diện cửa và đồ đạc', exact: true }).click(); // mock: the wall family has no versions
  const firstLabel = page.locator('button[aria-pressed]').first();
  await expect(firstLabel).toBeVisible();
  await firstLabel.click();
  await expect(page.getByRole('complementary', { name: DETAIL, exact: true }).or(page.getByRole('dialog'))).toBeVisible();
  await noSideScroll(page, 'version detail');
  await page.keyboard.press('Escape');
  const activate = page.getByRole('button', { name: ACTIVATE, exact: true }).and(page.locator(':enabled')).first();
  if ((await activate.count()) > 0) {
    await activate.click();
    await expect(page.getByRole('dialog')).toBeVisible();
    await noSideScroll(page, 'activate dialog');
  }
});
