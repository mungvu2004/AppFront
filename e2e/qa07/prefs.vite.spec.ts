/**
 * QA phase 07 S - SCR-33 Giao dien on Vite + mocked API (layout only; jsdom cannot measure it).
 *
 * FL-33R-09 / 33R-F-004 (BUG-499): the label of a switch row and the switch share one centre line (abs(dy) <= 4 px)
 * at 1920/1440/1024; at 768 the label sits above the switch. Measured value that decided the case (p07-rr
 * phase07-ui results.json): dy = 8 px at every width >= 1024 for all three switch rows.
 * Run: `E2E_PORT=<own port> pnpm exec playwright test e2e/qa07/prefs.vite.spec.ts` against
 * `VITE_USE_MOCK_API=true pnpm exec vite --host 127.0.0.1 --port $E2E_PORT`.
 */
import { expect, test } from '@playwright/test';
import type { Locator, Page } from '@playwright/test';

const ACCOUNT_URL = '/tai-khoan';
const FIRST_PAINT_TIMEOUT_MS = 15_000;
const TOLERANCE_PX = 4; // catalog 33R-F-004
const SWITCHES = ['Dùng nền tối cho khung nhìn 3D', 'Giảm chuyển động', 'Hiện lưới 100 mm']; // AppearanceSection.tsx FieldRow labels
const WIDTHS = [1920, 1440, 1024, 768];

const appearance = (page: Page): Locator => page.locator('section[aria-labelledby="account-appearance"]'); // AccountSettings.tsx:131

async function centreAndEdges(loc: Locator): Promise<{ top: number; bottom: number }> {
  const box = await loc.boundingBox();
  if (!box) throw new Error('element has no box');
  return { top: box.y, bottom: box.y + box.height };
}

for (const width of WIDTHS) {
  test(`SCR-33 [mocked response] 33R-F-004 switch rows aligned at ${String(width)}`, async ({ page }) => {
    await page.setViewportSize({ width, height: 900 });
    await page.goto(ACCOUNT_URL);
    for (const name of SWITCHES) {
      const switchEl = appearance(page).getByRole('switch', { name, exact: true });
      await expect(switchEl).toBeVisible({ timeout: FIRST_PAINT_TIMEOUT_MS });
      const label = await centreAndEdges(appearance(page).getByText(name, { exact: true }).first());
      const control = await centreAndEdges(switchEl);
      if (width >= 1024) {
        const dy = Math.abs((label.top + label.bottom) / 2 - (control.top + control.bottom) / 2);
        expect.soft(dy, `${String(width)}: "${name}" label vs switch centre`).toBeLessThanOrEqual(TOLERANCE_PX);
      } else {
        expect.soft(label.bottom, `${String(width)}: "${name}" label above the switch`).toBeLessThanOrEqual(control.top + 1);
      }
    }
  });
}
