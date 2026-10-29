/**
 * Phase 4 - SCR-16 walls, Playwright on Vite (mock API): BUG-396 (1440) and BUG-395 (768 only).
 * Catalog expectation (BUG-LOG-P04.md "Mong doi"): BUG-396 every row shows its whole trailing badge and stays inside the
 * panel (no horizontal scroll in the list); BUG-395 the list is tall enough to review many rows (not squeezed to ~3).
 * Run: VITE_USE_MOCK_API=true pnpm exec vite --host 127.0.0.1 --port $E2E_PORT, then
 *   E2E_PORT=<port> pnpm exec playwright test -c playwright.config.ts e2e/qa04/walls.vite.spec.ts
 * Request budget: 0 uploads, 0 logins (mock API, no session).
 */
import { expect, test, type Locator, type Page } from '@playwright/test';

import { ROUTES } from '../fixtures/routes';
import { dismissTour } from '../fixtures/tour';
import { QC_FLOOR, QC_PROJECT, seedQc } from '../v6/seedQc';
import { MOCK_BASE_URL } from '../../qa/tests/support/auth';
import { captureEvidence } from '../../qa/tests/support/evidence';
import { WALL } from '../../qa/tests/support/p04/P1';

test.use({ baseURL: MOCK_BASE_URL });

const FIRST_PAINT_TIMEOUT_MS = 15_000;
/** The seeded screen set has 48 walls (e2e/v6/wall-layer-review.spec.ts FIXTURE_WALLS). */
const SEEDED_WALLS = 48;
/** Of which 12 are already reviewed (FIXTURE_REVIEWED). */
const SEEDED_REVIEWED = 12;
/** One list row is `h-10` = 40 px (WallLayerList.tsx); BUG-395 saw ~3 rows, the report asks for "many rows". */
const ROW_PX = 40;
const MIN_VISIBLE_ROWS = 6;

const list = (page: Page): Locator => page.getByRole('listbox', { name: WALL.list });

async function openSeeded(page: Page, width: number, height: number): Promise<void> {
  await page.setViewportSize({ width, height });
  page.on('dialog', (dialog) => void dialog.dismiss());
  await page.goto(ROUTES.project.walls(QC_PROJECT, QC_FLOOR.walls));
  await expect(page.getByRole('region', { name: WALL.screen })).toBeVisible({ timeout: FIRST_PAINT_TIMEOUT_MS });
  await seedQc(page, 'walls');
  await expect(list(page).getByRole('option').first()).toBeVisible();
  await dismissTour(page);
}

test('SCR-16 · FL-16-V1 [mocked response] BUG-396 hang danh sach khong tran mep phai (1440)', async ({ page }) => {
  await openSeeded(page, 1440, 900);

  await test.step('[BUG-396] no horizontal scroll in the list, every row and its children end inside the list', async () => {
    const box = list(page);
    const metrics = await box.evaluate((el) => {
      const right = el.getBoundingClientRect().right;
      const rows = Array.from(el.querySelectorAll('[role="option"]'));
      const overflowing = rows.filter((row) =>
        [row, ...Array.from(row.querySelectorAll('*'))].some((node) => node.getBoundingClientRect().right > right + 0.5),
      ).length;
      return { rows: rows.length, overflowing, scrollW: el.scrollWidth, clientW: el.clientWidth };
    });
    expect(metrics.rows).toBeGreaterThan(0);
    expect.soft(metrics.scrollW, 'list scrollWidth').toBeLessThanOrEqual(metrics.clientW);
    expect.soft(metrics.overflowing, 'rows with a part past the right edge').toBe(0);
    await captureEvidence(page, 'U04_walls_list_row_edge_1440.png');
  });
});

test('SCR-16 · FL-16-V2 [mocked response] BUG-395 danh sach khong bi nen con ~3 hang (768)', async ({ page }) => {
  await openSeeded(page, 768, 1024);

  await test.step('[BUG-395] the list shows at least 6 rows tall, with the 48 walls present', async () => {
    await expect(list(page).getByRole('option').first()).toBeVisible();
    // Visible height = the list box clipped by every scrolling/clipping ancestor and the viewport (a clipped box and a
    // page that scrolls naturally are told apart: the page itself is not a clip, the viewport bottom is not either).
    const height = await list(page).evaluate((el) => {
      // Below xl the panel sits under the canvas: bring the list to the top of the page scroller before measuring.
      el.scrollIntoView({ block: 'start' });
      const rect = el.getBoundingClientRect();
      let top = rect.top;
      let bottom = rect.bottom;
      for (let node = el.parentElement; node !== null && node !== document.body; node = node.parentElement) {
        if (getComputedStyle(node).overflowY === 'visible') continue;
        const clip = node.getBoundingClientRect();
        top = Math.max(top, clip.top);
        bottom = Math.min(bottom, clip.bottom);
      }
      return Math.max(0, bottom - top);
    });
    expect.soft(height, 'list box height (px)').toBeGreaterThanOrEqual(MIN_VISIBLE_ROWS * ROW_PX);
    /* Bố cục L23: tiến độ ở dòng bước Tường của cột việc ("N cần xem"), không còn bộ đếm a/48 ở đầu panel. */
    const pending = await page
      .getByRole('region', { name: 'Tường' })
      .getByText(`${String(SEEDED_WALLS - SEEDED_REVIEWED)} cần xem`, { exact: true })
      .count();
    expect.soft(pending, 'step row shows the 36 of 48 seeded walls still to review').toBeGreaterThan(0);
    await captureEvidence(page, 'U04_walls_list_height_768.png');
  });
});
