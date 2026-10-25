/**
 * Phase 4 - SCR-22 "Doi chieu ban ve", Playwright on Vite (mock API): BUG-331 (empty/error state layout).
 * Catalog expectation (BUG-LOG-P04.md BUG-331 "Mong doi"): the frame takes the remaining height (not ~290 px with
 * ~70% of the page empty), no stat tile shows a bare dash and no label carries a leading dash ("— so vung vuot nguong").
 * Run: VITE_USE_MOCK_API=true pnpm exec vite --host 127.0.0.1 --port $E2E_PORT, then
 *   E2E_PORT=<port> pnpm exec playwright test -c playwright.config.ts e2e/qa04/overlay.vite.spec.ts
 * Lives in e2e/ (root config) because run-full runs qa/tests on the real stack, where there is no Vite on 5173.
 * Request budget: 0 uploads, 0 logins (mock API, no session).
 */
import { expect, test } from '@playwright/test';

import { MOCK_BASE_URL } from '../../qa/tests/support/auth';
import { captureEvidence } from '../../qa/tests/support/evidence';
import { OVERLAY_PATH } from '../v9/v9';

const VIEWPORT = { width: 1440, height: 900 } as const;
/** The bug left the frame ~290 px tall in a 900 px page; the fix makes the screen as tall as the viewport. */
const MIN_FRAME_SHARE = 0.6;
/** vi labels of the screen regions (OverlayComparison.tsx:79-81, :80). */
const SCREEN_REGION = 'So với bản vẽ';
const CANVAS_REGION = 'Khung đối chiếu bản vẽ gốc và mô hình';

test.use({ baseURL: MOCK_BASE_URL, viewport: VIEWPORT });

test('SCR-22 · FL-22-V1 [mocked response] BUG-331 khung chiem het chieu cao, khong o gach ngang', async ({ page }) => {
  page.on('dialog', (dialog) => void dialog.dismiss());
  await page.goto(OVERLAY_PATH);
  await expect(page.getByRole('region', { name: SCREEN_REGION })).toBeVisible({ timeout: 15_000 });
  const canvas = page.getByRole('region', { name: CANVAS_REGION });
  await expect(canvas).toBeVisible();

  await test.step('[BUG-331] the frame fills the remaining height', async () => {
    const box = await canvas.boundingBox();
    expect.soft(box?.height ?? 0).toBeGreaterThanOrEqual(VIEWPORT.height * MIN_FRAME_SHARE);
    await captureEvidence(page, 'U04_overlay_vite_default_1440.png');
  });

  await test.step('[BUG-331] no bare-dash stat tile and no label with a leading dash', async () => {
    await expect.soft(page.getByText('—', { exact: true })).toHaveCount(0);
    await expect.soft(page.getByText(/^—\s*số vùng vượt ngưỡng/u)).toHaveCount(0);
  });
});
