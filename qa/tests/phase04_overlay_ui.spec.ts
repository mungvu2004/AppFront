/**
 * Phase 4 — SCR-22 Overlay Comparison, dedicated UI-verification flows (skill `qa-verify-ui`, QA-04c P7, flow-plan.md
 * "phase04_overlay_ui.spec.ts"). One `test()` per flow, one `test.step('[<row id>] …')` per catalog row; each state is
 * captured at 1440 / 1024 / 768 / 375 by `verifyUi` (support/ui-verify.ts): `U04_<row id>_<state>_<width>.png` +
 * `U04_<row id>_<state>.json` (layout metrics for the review). Rows that are not a 4-width state measure one thing and
 * shoot one `captureEvidence` image.
 *
 * Data:
 *   - FL-22-U1: D1 (env drawing, run finished, frame missing) + Q (one floor without a drawing, 65-char name) + QX:overlay-scales
 *     (two floors at 5 / 8 mm/px, entered from /3d), all owned by the pool admin of slot `p04-overlay`.
 *   - FL-22-U2 `[mocked response]`: DF (framed drawing + QC layer) + DM (two floors with 65-char names, one drawn) + the shared
 *     pool viewer as a member. #30 is held / answered 500 by route mocks only in the two rows marked `[mock]`.
 * Source: OC src/screens/viewer/OverlayComparison/OverlayComparison.tsx · OCT …Toolbar.tsx · OCP …Panel.tsx · OCV …Canvas.tsx ·
 * OCD …CanvasDivider.tsx · OCL …CanvasLayers.tsx · UOC useOverlayComparison.ts.
 *
 * ## Request budget per full run
 * - Logins: 2 API (main admin lookup + pool admin) per flow + 1 browser session per flow (+1 viewer in U2) = ~7.
 * - Uploads (pool admin `drawings_init`): U1 1 (D1) · U2 2 (DF, DM) = 3. `POST /api/projects` 5 (+5 DELETE), `PUT …/spatial/layer` 5.
 * - `POST /api/auth/refresh`: ~1 per page load (4 widths × ~12 states + /3d hops ≈ 70).
 */
import { expect, test, type Page } from '@playwright/test';

import { ROUTES } from '../../e2e/fixtures/routes';
import { PIPELINE_TIMEOUT_MS } from '../../e2e/fullstack/env';
import { captureEvidence } from './support/evidence';
import { addProjectMember, createProject, deleteSeededProject, poolUser } from './support/phase03Seed';
import { closeFlow, openFlow, type Flow } from './support/p03/P5';
import { UI_VIEWPORTS, verifyUi } from './support/ui-verify';
import {
  LONG_FLOOR_A,
  OV,
  alertWith,
  divider,
  floorSelect,
  holdAll,
  modeRadio,
  noticeRegion,
  openOverlay,
  ownerApi,
  panel,
  screenRegion,
  seedD1,
  seedDF,
  seedDM,
  seedOverlayScales,
  toolbar,
} from './support/p04/P7';

const QUALITY = /^\/api\/projects\/[^/]+\/floors\/[^/]+\/quality$/u;
const note = (description: string): void => {
  test.info().annotations.push({ type: 'note', description });
};
const ev = (page: Page, row: string, slug: string, caption?: string): Promise<string> =>
  captureEvidence(page, `U04_${row}_${slug}.png`, caption === undefined ? {} : { caption });
const widthOf = (page: Page): number => page.viewportSize()?.width ?? 0;
const shown = (page: Page, row: string, state: string, open: (p: Page) => Promise<void>) => verifyUi(page, `U04_${row}_${state}`, open);

test.describe('U04 UI verify — SCR-22 overlay flows (QA-04c P7)', () => {
  test('SCR-22 · FL-22-U1 · overlay states on the drawing floor', async ({ browser }) => {
    test.setTimeout(PIPELINE_TIMEOUT_MS + 420_000);
    const owner = await ownerApi();
    let flow: Flow | undefined;
    const projects: string[] = [];
    try {
      const d1 = await seedD1(owner.api, '22-u1');
      projects.push(d1.projectId);
      const q = await createProject(owner.api, '22-f003', [LONG_FLOOR_A]);
      projects.push(q.projectId);
      const scales = await seedOverlayScales(owner.api, '22-u1-scales');
      projects.push(scales.projectId);
      const qFloor = q.floors[0];
      if (qFloor === undefined) throw new Error('setup: the Q project has no floor');
      flow = await openFlow(browser, owner.user);
      const { page } = flow;
      const openDefault = async (p: Page): Promise<void> => {
        await openOverlay(p, d1.projectId, d1.floorId);
        await expect(alertWith(p, OV.frameMissing)).toBeVisible();
      };
      const openSwipe = async (p: Page): Promise<void> => {
        await openDefault(p);
        await modeRadio(p, OV.swipe).click();
        await expect(divider(p)).toBeVisible();
      };

      await test.step('[22-F-001] drawing floor default (frame-missing alert + link) at four widths', async () => {
        const metrics = await shown(page, '22-F-001', 'default', openDefault);
        expect(metrics.map((m) => m.viewport)).toEqual(UI_VIEWPORTS.map((v) => `${String(v.width)}x${String(v.height)}`));
        await expect.soft(page.getByRole('link', { name: OV.toScale, exact: true })).toBeVisible();
      });

      await test.step('[22-F-002] "Trượt" with the divider at four widths', async () => {
        await shown(page, '22-F-002', 'swipe', openSwipe);
        await expect.soft(divider(page)).toHaveAttribute('aria-valuenow', '0.5');
      });

      await test.step('[22-F-004] "Cạnh nhau" chosen: two frames at 1440, the swipe fallback below 1280', async () => {
        const seen: string[] = [];
        await shown(page, '22-F-004', 'side-by-side', async (p) => {
          await openDefault(p);
          if (widthOf(p) >= 1280) {
            await modeRadio(p, OV.sideBySide).click();
            await expect(p.getByRole('group', { name: OV.sourceFrame, exact: true })).toBeVisible();
            await expect(p.getByRole('group', { name: OV.resultFrame, exact: true })).toBeVisible();
            seen.push(`${String(widthOf(p))}: two frames`);
          } else {
            await expect(modeRadio(p, OV.sideBySide)).toBeDisabled();
            await modeRadio(p, OV.swipe).click();
            await expect(divider(p)).toBeVisible();
            seen.push(`${String(widthOf(p))}: swipe fallback`);
          }
        });
        note(`22-F-004: ${seen.join(' | ')}`);
        expect.soft(seen).toEqual(['1440: two frames', '1024: swipe fallback', '768: swipe fallback', '375: swipe fallback']);
      });

      await test.step('[22-F-011] ⚑ below 1024 the panel sits under the canvas (max 45 % height) and the canvas is not 0 px (QA-04 B-3)', async () => {
        const rows: string[] = [];
        for (const vp of UI_VIEWPORTS) {
          await page.setViewportSize(vp);
          await openDefault(page);
          const canvas = await page.getByRole('region', { name: OV.canvasSection, exact: true }).boundingBox();
          const side = await panel(page).boundingBox();
          if (canvas === null || side === null) throw new Error('canvas / panel have no box');
          const stacked = vp.width < 1024;
          rows.push(`${String(vp.width)}: canvas ${String(Math.round(canvas.width))}×${String(Math.round(canvas.height))}, panel ${String(Math.round(side.width))}×${String(Math.round(side.height))} at y ${String(Math.round(side.y))}`);
          expect.soft(canvas.height, `${String(vp.width)}: the canvas keeps a real height`).toBeGreaterThan(150);
          expect.soft(canvas.width, `${String(vp.width)}: the canvas keeps a real width`).toBeGreaterThan(150);
          if (stacked) {
            expect.soft(side.y, `${String(vp.width)}: panel under the canvas`).toBeGreaterThanOrEqual(canvas.y + canvas.height - 1);
            expect.soft(side.height, `${String(vp.width)}: panel ≤ 45 % of the viewport`).toBeLessThanOrEqual(vp.height * 0.45 + 1);
          } else {
            expect.soft(side.x, `${String(vp.width)}: panel beside the canvas`).toBeGreaterThanOrEqual(canvas.x + canvas.width - 1);
          }
        }
        note(`22-F-011: ${rows.join(' | ')}`);
        await page.setViewportSize(UI_VIEWPORTS[3]);
        await ev(page, '22-F-011', 'stacked_375');
        await page.setViewportSize(UI_VIEWPORTS[0]);
      });

      await test.step('[22-E-010] divider: focus-visible outline; the handle grows 4 → 6 px on hover / focus', async () => {
        await openSwipe(page);
        const bar = divider(page).locator('span').first();
        const widthNow = (): Promise<number> => bar.evaluate((el) => el.getBoundingClientRect().width);
        await expect.poll(widthNow, { message: 'idle handle' }).toBeCloseTo(4, 0);
        await divider(page).hover();
        await expect.poll(widthNow, { message: 'hovered handle (120 ms transition)' }).toBeCloseTo(6, 0);
        await page.mouse.move(2, 2);
        await expect.poll(widthNow).toBeCloseTo(4, 0);
        for (let i = 0; i < 40 && !(await divider(page).evaluate((el) => document.activeElement === el)); i += 1) await page.keyboard.press('Tab');
        expect.soft(await divider(page).evaluate((el) => document.activeElement === el), 'the divider is reachable with Tab').toBe(true);
        const outline = await divider(page).evaluate((el) => {
          const s = getComputedStyle(el);
          return { style: s.outlineStyle, width: s.outlineWidth };
        });
        expect.soft(outline.style, 'focus-visible outline').not.toBe('none');
        expect.soft(parseFloat(outline.width), 'outline width (2 px at the device scale)').toBeGreaterThanOrEqual(1.5);
        await expect.poll(widthNow, { message: 'focused handle' }).toBeCloseTo(6, 0);
        await ev(page, '22-E-010', 'divider_focus');
      });

      await test.step('[22-E-015] lowercase labels against A6: "vùng lệch", "số vùng vượt ngưỡng"', async () => {
        await openDefault(page);
        // BUG-331: unmeasured = one notice, no status stat (OverlayComparisonPanel.tsx:129-131).
        await expect.soft(panel(page).getByRole('status')).toHaveCount(0);
        await expect.soft(panel(page).getByText('Chưa có số đo — cần căn ảnh quét vào mô hình trước.', { exact: true })).toBeVisible();
        await expect.soft(page.locator('[data-overlay-layer="deviation"]')).toHaveAttribute('aria-label', OV.layerDeviation);
        const upper = await panel(page).getByText(/^[A-ZÀ-Ỵ]/u).count();
        note(`22-E-015: ${String(upper)} capitalised text node(s) in the panel; the deviation table headers need regions (n/a)`);
        await ev(page, '22-E-015', 'lowercase_labels');
      });

      await test.step('[22-C-007] the scan is drawn through the ink threshold filter, tinted text-primary', async () => {
        const img = page.locator('[data-overlay-layer="scan"] img');
        await expect(img).toHaveCount(1);
        const filter = await img.evaluate((el) => (el as HTMLElement).style.filter);
        expect.soft(filter, 'inline filter on the scan image').toMatch(/^url\(["']?#overlay-scan-ink/u);
        await expect.soft(page.locator('svg filter[id^="overlay-scan-ink"]')).toHaveCount(1);
        await expect.soft(page.locator('[data-overlay-layer="scan"]')).toHaveClass(/text-text-primary/u);
        await ev(page, '22-C-007', 'ink_filter');
      });

      await test.step('[22-F-003] no drawing + upload link + a 65-char floor name at four widths', async () => {
        await shown(page, '22-F-003', 'no-drawing', async (p) => {
          await openOverlay(p, q.projectId, qFloor.id);
          await expect(alertWith(p, OV.noDrawing)).toBeVisible();
          await expect(p.getByRole('link', { name: OV.toUpload, exact: true })).toHaveAttribute('href', ROUTES.project.upload(q.projectId));
          await expect(floorSelect(p)).toBeVisible();
        });
      });

      await test.step('[22-F-009] scale-conflict error + link at four widths (direct URL)', async () => {
        await shown(page, '22-F-009', 'scale-conflict', async (p) => {
          await openOverlay(p, scales.projectId, scales.layered.id);
          await expect(alertWith(p, OV.scaleConflict)).toBeVisible();
          await expect(p.getByRole('link', { name: OV.toScale, exact: true })).toBeVisible();
        });
      });
    } finally {
      if (flow !== undefined) await closeFlow(flow);
      for (const id of projects) await deleteSeededProject(owner.api, id);
      await owner.dispose();
    }
  });

  test('SCR-22 · FL-22-U2 · [mocked response] framed partial, viewer, loading, read error, long floor names', async ({ browser }) => {
    test.setTimeout(PIPELINE_TIMEOUT_MS + 420_000);
    const owner = await ownerApi();
    let admin: Flow | undefined;
    let viewerFlow: Flow | undefined;
    const projects: string[] = [];
    try {
      const df = await seedDF(owner.api, '22-u2-df');
      projects.push(df.projectId);
      const dm = await seedDM(owner.api, '22-u2-dm');
      projects.push(dm.projectId);
      const viewer = await poolUser(owner.main, 'viewer');
      await addProjectMember(owner.api, df.projectId, viewer.email);
      admin = await openFlow(browser, owner.user);
      viewerFlow = await openFlow(browser, viewer);
      const { page } = admin;

      await test.step('[22-F-005] framed floor partial / collapsed (no alert) at four widths', async () => {
        await shown(page, '22-F-005', 'framed', async (p) => {
          await openOverlay(p, df.projectId, df.floorId);
          await expect(panel(p)).toBeVisible();
          await expect(alertWith(p, OV.frameMissing)).toHaveCount(0);
          await expect(noticeRegion(p)).toHaveCount(0);
        });
      });

      await test.step('[22-F-006] viewer forbidden (two read-only notices) at four widths', async () => {
        await shown(viewerFlow!.page, '22-F-006', 'viewer-forbidden', async (p) => {
          await openOverlay(p, df.projectId, df.floorId);
          await expect(alertWith(p, OV.forbidden)).toBeVisible();
          // BUG-636: one banner only, the toolbar repeats no second sentence (OverlayComparisonToolbar.tsx:226-228);
          // BUG-599: no lock switch without an effective alignment (OverlayComparisonToolbar.tsx:~207).
          await expect(toolbar(p).getByText(OV.readOnly, { exact: true })).toHaveCount(0);
          await expect(toolbar(p).getByRole('switch', { name: OV.lock, exact: true })).toHaveCount(0);
        });
      });

      await test.step('[22-F-007] [mock] loading notice at four widths (#30 held)', async () => {
        const hold = await holdAll(page, QUALITY);
        try {
          await shown(page, '22-F-007', 'loading', async (p) => {
            await p.goto(ROUTES.project.overlay(df.projectId, df.floorId));
            await expect(screenRegion(p)).toBeVisible();
            await expect(p.getByRole('status').filter({ hasText: OV.loading })).toBeVisible();
          });
        } finally {
          await hold.release();
        }
      });

      await test.step('[22-F-008] [mock] #30 read error at four widths', async () => {
        await page.route(
          (url) => QUALITY.test(url.pathname),
          (route) =>
            route.request().method() === 'GET'
              ? route.fulfill({ status: 500, contentType: 'application/json', body: JSON.stringify({ code: 'INTERNAL', requestId: 'qa-p7-mock' }) })
              : route.fallback(),
        );
        try {
          await shown(page, '22-F-008', 'read-error', async (p) => {
            await p.goto(ROUTES.project.overlay(df.projectId, df.floorId));
            await expect(alertWith(p, OV.readFailed)).toBeVisible({ timeout: 30_000 });
          });
        } finally {
          await page.unrouteAll({ behavior: 'ignoreErrors' });
        }
      });

      await test.step('[22-F-010] ⚑ "Chọn tầng" open with 65-char names and the "— Không có ảnh bản vẽ gốc" suffix (BUG-414): every option is fully readable', async () => {
        const clipped: string[] = [];
        await shown(page, '22-F-010', 'floor-select-long', async (p) => {
          await openOverlay(p, dm.projectId, dm.floors[0]!.id);
          await floorSelect(p).click();
          const options = p.getByRole('option');
          await expect(options).toHaveCount(2);
          const rows = await options.evaluateAll((els) =>
            els.map((el) => ({ text: (el.textContent ?? '').trim(), cut: el.scrollWidth > el.clientWidth + 1 })),
          );
          for (const row of rows) if (row.cut) clipped.push(`${String(p.viewportSize()?.width)}: ${row.text}`);
          expect(rows.some((row) => row.text.endsWith(`— ${OV.noScanSuffix}`)), 'the floor without a scan carries its suffix').toBe(true);
        });
        note(`22-F-010: clipped options: ${clipped.length === 0 ? 'none' : clipped.join(' | ')}`);
        expect.soft(clipped, 'option text is cut off (suffix unreadable)').toEqual([]);
      });
    } finally {
      if (viewerFlow !== undefined) await closeFlow(viewerFlow);
      if (admin !== undefined) await closeFlow(admin);
      for (const id of projects) await deleteSeededProject(owner.api, id);
      await owner.dispose();
    }
  });
});
