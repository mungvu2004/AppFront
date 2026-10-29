/**
 * Phase 4 — SCR-21 thickness, layout on Vite with the mock API (no stack): BUG-405 (detail table clipped at 1440/1024/768),
 * BUG-406 (x-axis labels glued at 1024/768), BUG-611 (summary numbers carry the "approved" green). Seed: `seedQcb` (48 walls).
 * S-21 Z: the four summary cards are gone (the numbers live in the QcPanelHead status sentence) and the per-wall table
 * moved into the "Xem bảng từng đoạn" drawer, so BUG-405 opens the drawer and BUG-611 checks the status sentence.
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

const SCREEN = 'Độ dày tường'; // ThicknessStandardization.tsx title
/** QcPanelHead status sentence (thicknessBatch.ts statusSentenceOf): "51/81 đoạn không chuẩn, 30 đúng chuẩn". */
const STATUS_SENTENCE = /^\d+\/[1-9]\d* đoạn không chuẩn, \d+ đúng chuẩn$/u;
const HISTOGRAM_SECTION = 'Phân bố độ dày đo được'; // ThicknessStandardization.tsx HISTOGRAM_SECTION_LABEL
const THRESHOLD_TOGGLE = 'Ngưỡng chia nhóm (nâng cao)'; // ThicknessStandardization.tsx THRESHOLD_TOGGLE_LABEL
const DETAIL_BUTTON = /^Xem bảng từng đoạn \(\d+\)$/u; // ThicknessBatchPanel.tsx TEXT.detail
const DETAIL_DRAWER = 'Bảng từng đoạn tường'; // ThicknessStandardization.tsx DETAIL_TITLE
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
  await expect(page.getByText(STATUS_SENTENCE)).toBeVisible(); // seeded floor shows its own walls (16 of the 48 on the URL's level)
}

test.describe('E04 SCR-21 thickness — layout on Vite [mocked response]', () => {
  for (const { width, height } of VIEWPORTS) {
    test(`SCR-21 · FL-21-V1 · BUG-405/406/611 at ${String(width)}`, async ({ page }) => {
      await openSeeded(page, width, height);

      await test.step(`[BUG-406] threshold labels do not touch at ${String(width)}`, async () => {
        // UX-R1 (d44757b2): biểu đồ ngưỡng gập sau nút "Ngưỡng chia nhóm (nâng cao)", đóng mặc định — mở ra trước.
        // UX 26/10: trục dưới biểu đồ đã bỏ; nhãn ngưỡng nằm trên biểu đồ, xếp so le hai hàng. Mỗi nhãn mang đúng chữ
        // `aria-valuetext` của con trượt ngưỡng cùng chỉ số, nên tìm nhãn theo chữ đó thay vì theo lớp tiện ích.
        const section = page.getByRole('region', { name: HISTOGRAM_SECTION });
        await section.getByRole('button', { name: THRESHOLD_TOGGLE }).click();
        const sliders = section.getByRole('slider');
        await expect(sliders.first()).toBeVisible();
        const texts = await sliders.evaluateAll((els) => els.map((el) => el.getAttribute('aria-valuetext') ?? ''));
        expect(texts.length).toBeGreaterThan(1);
        const boxes = await Promise.all(
          texts.map(async (text) => {
            const label = section.getByText(text, { exact: true });
            await expect(label).toBeVisible();
            const r = (await label.boundingBox()) ?? { x: 0, y: 0, width: 0, height: 0 };
            return { l: r.x, r: r.x + r.width, t: r.y, b: r.y + r.height };
          }),
        );
        const glued = boxes.flatMap((x, i) =>
          boxes.slice(0, i).some((y) => x.l < y.r + 4 && y.l < x.r + 4 && x.t < y.b && y.t < x.b) ? [i] : [],
        );
        expect.soft(glued, 'labels overlapping or closer than 4 px').toEqual([]);
      });

      await test.step(`[BUG-611] the status sentence numbers are plain text, not the approved green at ${String(width)}`, async () => {
        const sentence = page.getByText(STATUS_SENTENCE);
        const className = await sentence.evaluate((el) => el.className);
        expect.soft(className).toContain('text-text-primary');
        expect.soft(className).not.toMatch(/success|verified|green/u);
      });

      await test.step(`[BUG-405] detail table: no clipped column at ${String(width)}`, async () => {
        await page.getByRole('button', { name: DETAIL_BUTTON }).click();
        const drawer = page.getByRole('dialog', { name: DETAIL_DRAWER });
        await expect(drawer).toBeVisible();
        const headers = drawer.getByRole('columnheader');
        expect(await headers.count()).toBeGreaterThan(3);
        const clipped = await headers.evaluateAll((els) =>
          els.flatMap((el) => {
            const r = el.getBoundingClientRect();
            const bad = r.right > window.innerWidth + 1 || el.scrollWidth > el.clientWidth + 1;
            return bad ? [`${el.textContent ?? ''} right=${String(Math.round(r.right))}`] : [];
          }),
        );
        const scroller = await drawer.getByRole('table').first().evaluate((t) => {
          let p: HTMLElement | null = t.parentElement;
          while (p !== null && getComputedStyle(p).overflowX === 'visible') p = p.parentElement;
          return p === null ? 0 : p.scrollWidth - p.clientWidth;
        });
        expect.soft(clipped, 'clipped headers').toEqual([]);
        expect.soft(scroller, 'scroll box hides columns (px)').toBeLessThanOrEqual(1);
        await captureEvidence(page, `U04_thickness_table_${String(width)}.png`);
      });
    });
  }
});
