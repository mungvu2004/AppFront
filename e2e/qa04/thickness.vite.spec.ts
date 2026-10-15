/**
 * Phase 4 — SCR-21 thickness, layout on Vite with the mock API (no stack): BUG-405 (detail table clipped at 1440/1024/768),
 * BUG-406 (x-axis labels glued at 1024/768), BUG-611 (summary numbers carry the "approved" green). Seed: `seedQcb` (48 walls).
 * Run: VITE_USE_MOCK_API=true pnpm exec vite --host 127.0.0.1 --port $E2E_PORT, then
 *   E2E_PORT=<port> pnpm exec playwright test -c playwright.config.ts e2e/qa04/thickness.vite.spec.ts
 * Request budget: 0 API calls (mock). Viewports 1920/1440/1024/768 only.
 */
import { expect, test, type Page } from '@playwright/test';

import { ROUTES } from '../fixtures/routes';
import { QCB_FLOOR, QCB_PROJECT, seedQcb } from '../v7/seedQcb';
import { MOCK_BASE_URL } from '../../qa/tests/support/auth';
import { captureEvidence } from '../../qa/tests/support/evidence';

test.use({ baseURL: MOCK_BASE_URL });

const SCREEN = 'Chuẩn hoá độ dày tường'; // ThicknessStandardization.tsx title
const TOTAL_LABEL = 'Tổng số đoạn tường'; // thicknessTypes.ts THICKNESS_SUMMARY_LABELS.segmentCount
const VIEWPORTS = [
  { width: 1920, height: 1080 },
  { width: 1440, height: 900 },
  { width: 1024, height: 768 },
  { width: 768, height: 1024 },
] as const;

async function openSeeded(page: Page, width: number, height: number): Promise<void> {
  await page.setViewportSize({ width, height });
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await page.goto(ROUTES.project.thickness(QCB_PROJECT, QCB_FLOOR.thickness));
  await expect(page.getByRole('heading', { name: SCREEN })).toBeVisible({ timeout: 15_000 });
  await seedQcb(page, 'thickness');
  await expect(page.getByRole('status').filter({ hasText: TOTAL_LABEL })).toHaveText(/^[1-9]\d*\s/u); // seeded floor shows its own walls (16 of the 48 on the URL's level)
}

test.describe('E04 SCR-21 thickness — layout on Vite [mocked response]', () => {
  for (const { width, height } of VIEWPORTS) {
    test(`SCR-21 · FL-21-V1 · BUG-405/406/611 at ${String(width)}`, async ({ page }) => {
      await openSeeded(page, width, height);

      await test.step(`[BUG-405] detail table: no clipped column at ${String(width)}`, async () => {
        const headers = page.getByRole('columnheader');
        expect(await headers.count()).toBeGreaterThan(3);
        const clipped = await headers.evaluateAll((els) =>
          els.flatMap((el) => {
            const r = el.getBoundingClientRect();
            const bad = r.right > window.innerWidth + 1 || el.scrollWidth > el.clientWidth + 1;
            return bad ? [`${el.textContent ?? ''} right=${String(Math.round(r.right))}`] : [];
          }),
        );
        const scroller = await page.getByRole('table').first().evaluate((t) => {
          let p: HTMLElement | null = t.parentElement;
          while (p !== null && getComputedStyle(p).overflowX === 'visible') p = p.parentElement;
          return p === null ? 0 : p.scrollWidth - p.clientWidth;
        });
        expect.soft(clipped, 'clipped headers').toEqual([]);
        expect.soft(scroller, 'scroll box hides columns (px)').toBeLessThanOrEqual(1);
        await captureEvidence(page, `U04_thickness_table_${String(width)}.png`);
      });

      await test.step(`[BUG-406] x-axis labels do not touch at ${String(width)}`, async () => {
        const ticks = page.locator('section span.font-mono.tabular-nums').filter({ hasText: /^\d{3}$/u });
        expect(await ticks.count()).toBeGreaterThan(1);
        const boxes = await ticks.evaluateAll((els) =>
          els.map((el) => el.getBoundingClientRect()).map((r) => ({ l: r.left, r: r.right })),
        );
        const glued = boxes.flatMap((b, i) => (i > 0 && b.l < (boxes[i - 1]?.r ?? 0) + 4 ? [i] : []));
        expect.soft(glued, 'ticks closer than 4 px').toEqual([]);
      });

      await test.step(`[BUG-611] summary numbers are plain text, not the approved green at ${String(width)}`, async () => {
        const numbers = page.getByRole('group', { name: 'Tóm tắt chuẩn hoá độ dày tường' }).locator('p > span.font-mono');
        expect(await numbers.count()).toBe(4);
        const classes = await numbers.evaluateAll((els) => els.map((el) => el.className));
        for (const c of classes) expect.soft(c).toContain('text-text-primary');
        for (const c of classes) expect.soft(c).not.toMatch(/success|verified|green/u);
      });
    });
  }
});
