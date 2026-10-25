/**
 * Phase 4 - SCR-20 "Duyet ten phong", Playwright on Vite (mock API): BUG-329 (inspector card has no bottom padding).
 * Catalog expectation (BUG-LOG-P04.md BUG-329 "Mong doi"): the card has bottom padding equal to the top padding, so the
 * last line ("... de xem chi tiet.") does not touch the card edge.
 * Run: VITE_USE_MOCK_API=true pnpm exec vite --host 127.0.0.1 --port $E2E_PORT, then
 *   E2E_PORT=<port> pnpm exec playwright test -c playwright.config.ts e2e/qa04/rooms.vite.spec.ts
 * Request budget: 0 uploads, 0 logins (mock API, no session).
 */
import { expect, test } from '@playwright/test';

import { ROUTES } from '../fixtures/routes';
import { PROJECT_ID } from '../v9/v9';
import { MOCK_BASE_URL } from '../../qa/tests/support/auth';
import { captureEvidence } from '../../qa/tests/support/evidence';

const VIEWPORTS = [
  { width: 1440, height: 900 },
  { width: 1024, height: 768 },
] as const;
/** The message carries the 20 px of `pb-5` (RoomLabelInspector.tsx:116), never ~0. */
const MIN_BOTTOM_GAP_PX = 16;
/** vi text of the inspector (RoomLabelInspector.tsx:83,85); the title is an h2 since 13a0ba40 (one heading level per panel). */
const PANEL_TITLE = 'Phòng';
const EMPTY_MESSAGE = 'Chọn một phòng trên bản vẽ hoặc trong danh sách để xem chi tiết.';

test.use({ baseURL: MOCK_BASE_URL });

for (const viewport of VIEWPORTS) {
  test(`SCR-20 · FL-20-V1 [mocked response] BUG-329 the unselected inspector card keeps a bottom padding at ${String(viewport.width)}`, async ({
    page,
  }) => {
    page.on('dialog', (dialog) => void dialog.dismiss());
    await page.setViewportSize(viewport);
    await page.goto(ROUTES.project.rooms(PROJECT_ID, 'L1'));
    // 1024-1279: the inspector is a drawer over the canvas edge, hidden while nothing is selected (QcWorkspace).
    if (viewport.width < 1280) await page.getByRole('button', { name: 'Hiện chi tiết' }).click({ timeout: 15_000 });
    await expect(page.getByRole('heading', { name: PANEL_TITLE, level: 2, exact: true })).toBeVisible({ timeout: 15_000 });
    const message = page.getByText(EMPTY_MESSAGE, { exact: true });
    await expect(message).toBeVisible();

    await test.step('[BUG-329] the last line has a bottom padding, not ~0', async () => {
      // The card is stretched to the frame, so the visible gap hides a missing padding: measure the padding itself.
      const gap = await message.evaluate((node) => Number.parseFloat(getComputedStyle(node).paddingBottom));
      expect.soft(gap).toBeGreaterThanOrEqual(MIN_BOTTOM_GAP_PX);
      await captureEvidence(page, `U04_rooms_vite_inspector_${String(viewport.width)}.png`);
    });
  });
}
