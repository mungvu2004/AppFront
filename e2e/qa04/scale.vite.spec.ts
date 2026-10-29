/**
 * Phase 4 - SCR-14 "Hieu chinh ty le", Playwright on Vite (mock API): BUG-609 (collapsed panel frees the column) and
 * BUG-410 (scope switch thumb sits inside the active option). Catalog expectation: BUG-LOG-P04.md BUG-609 / BUG-410 "Mong doi".
 * Run: VITE_USE_MOCK_API=true pnpm exec vite --host 127.0.0.1 --port $E2E_PORT, then
 *   E2E_PORT=<port> pnpm exec playwright test -c playwright.config.ts e2e/qa04/scale.vite.spec.ts
 * Request budget: 0 uploads, 0 logins (mock API, no session).
 */
import { expect, test } from '@playwright/test';

import { ROUTES } from '../fixtures/routes';
import { PROJECT_ID } from '../v4v5/files';
import { MOCK_BASE_URL } from '../../qa/tests/support/auth';
import { captureEvidence } from '../../qa/tests/support/evidence';
import { SCALE, canvasOf } from '../../qa/tests/support/p04/P6';

const MOCK_FLOOR = 'L2'; // e2e/v4v5/scale.spec.ts:openScale
const PX_TOLERANCE = 1.5;

test.use({ baseURL: MOCK_BASE_URL, viewport: { width: 1440, height: 900 } });

/* BUG-609 (thu gọn bảng) không còn đối tượng: bố cục L23 bỏ nút thu gọn; dưới 1024 cột việc là ngăn kéo. */

for (const width of [1024, 768]) {
  test(`SCR-14 · FL-14-V2 [mocked response] BUG-410 con truot nam trong lua chon dang chon @${String(width)}`, async ({ page }) => {
    page.on('dialog', (dialog) => void dialog.dismiss());
    await page.setViewportSize({ width, height: 900 });
    await page.goto(ROUTES.project.scale(PROJECT_ID, MOCK_FLOOR));
    await expect(canvasOf(page)).toBeVisible({ timeout: 15_000 });

    await test.step(`[BUG-410] thumb is inside the checked option and the group at ${String(width)}`, async () => {
      const group = page.getByRole('radiogroup', { name: SCALE.scope, exact: true });
      await group.scrollIntoViewIfNeeded();
      const checked = group.getByRole('radio', { checked: true });
      const thumb = checked.locator('[data-segment-thumb]');
      await expect(thumb).toHaveCount(1);
      const [g, c, t] = await Promise.all([group.boundingBox(), checked.boundingBox(), thumb.boundingBox()]);
      expect.soft(t?.x ?? -1, 'thumb left >= option left').toBeGreaterThanOrEqual((c?.x ?? 0) - PX_TOLERANCE);
      expect.soft((t?.x ?? 0) + (t?.width ?? 0), 'thumb right <= option right').toBeLessThanOrEqual((c?.x ?? 0) + (c?.width ?? 0) + PX_TOLERANCE);
      expect.soft(t?.y ?? -1, 'thumb top >= option top').toBeGreaterThanOrEqual((c?.y ?? 0) - PX_TOLERANCE);
      expect.soft((t?.x ?? 0) + (t?.width ?? 0), 'thumb right <= group right').toBeLessThanOrEqual((g?.x ?? 0) + (g?.width ?? 0) + PX_TOLERANCE);
      await captureEvidence(page, `U04_scale_scope_thumb_${String(width)}.png`);
    });
  });
}
