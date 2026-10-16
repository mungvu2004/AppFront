/**
 * QA-10 P1 — SCR-39 NotFound layout on the real stack, 4 desktop widths. Flow FL-10N-05 (flows-C1.md).
 * Seed DP3 = three own projects (support/p10/P1.ts); removed in afterAll.
 */
import { expect, test } from '@playwright/test';

import { DESKTOP_VIEWPORTS } from './support/p10/viewports';
import { VIEWPORT_1920, NOT_FOUND_PATH, openAdminPage, recentHeading, seedDp3, type Dp3 } from './support/p10/P1';
import { verifyUi } from './support/ui-verify';

let dp3: Dp3;

test.beforeAll(async () => {
  dp3 = await seedDp3('ui');
});

test.afterAll(async () => {
  await dp3.cleanup();
});

test('SCR-39 · FL-10N-05 · admin · bố cục success 4 khổ (DP3)', async ({ browser }) => {
  test.setTimeout(120_000);
  const { context, page } = await openAdminPage(browser, VIEWPORT_1920);
  try {
    await test.step('[10N-F-001] không tràn ngang; minh hoạ ≥1024, ẩn ở 768; cột 560 px', async () => {
      const metrics = await verifyUi(
        page,
        'N10_10N-F-001_success',
        async (p) => {
          await p.goto(NOT_FOUND_PATH);
          await expect(recentHeading(p)).toBeVisible();
        },
        DESKTOP_VIEWPORTS,
      );
      expect.soft(metrics, 'one measurement per width').toHaveLength(DESKTOP_VIEWPORTS.length);
      for (const vp of DESKTOP_VIEWPORTS) {
        await page.setViewportSize(vp);
        await page.goto(NOT_FOUND_PATH);
        await expect(recentHeading(page)).toBeVisible();
        // NotFound.tsx: PlanFragment only when !isCompact (NARROW_QUERY < 1024).
        await expect.soft(page.getByRole('main').locator('svg[aria-hidden="true"]')).toHaveCount(vp.width >= 1024 ? 1 : 0);
        const column = await page.locator('div.nf-notfound-enter, div.nf-notfound-fade').first().boundingBox();
        // CONTENT_COLUMN_PX = 560; a flex child may shrink below it in a narrow main (768).
        if (vp.width >= 1024) expect.soft(column?.width, `content column at ${String(vp.width)}`).toBe(560);
        else expect.soft(column?.width, `content column at ${String(vp.width)}`).toBeLessThanOrEqual(560);
      }
    });
  } finally {
    await context.close();
  }
});
