/**
 * Phase 4 — SCR-22 Overlay Comparison, EDGE layer, real stack (QA-04c P7, flow-plan.md "phase04_overlay_edge.spec.ts").
 * Five sequential user flows, one `test()` each, one `test.step('[<row id>] …')` per catalog row in the planned order.
 * `H` rows use a hard `expect`, `S` rows `expect.soft`; rows marked ⚑ assert the EXPECTED behaviour (a red step is an
 * app-bug candidate, never loosened). Mocked responses live in `phase04_overlay_mocked_edge.spec.ts`.
 *
 * Source (FE @ this branch): OC src/screens/viewer/OverlayComparison/OverlayComparison.tsx · OCT …Toolbar.tsx · OCP …Panel.tsx
 * · OCV …Canvas.tsx · OCD …CanvasDivider.tsx · OCL …CanvasLayers.tsx · UOC useOverlayComparison.ts · OCG
 * overlayComparisonGateway.ts · SEG src/components/ui/SegmentedControl.tsx · SLD …/Slider.tsx · UNF src/hooks/useNumericField.ts.
 * What the real stack gives: the env drawing (D1) has no frame (#30 lists FRAME_NOT_FOUND) so SCR-22 opens on the
 * frame-missing error; a framed drawing (DF) gives `partial` (≥ 1280) / `collapsed` (< 1280). The gateway returns
 * `unsupported` for deviation regions, so nothing is ever measured (metrics "—", confirm disabled).
 *
 * ## Users and data
 * Every overlay project that holds a drawing is owned by the pool admin of slot `p04-overlay` (own `drawings_init` bucket).
 * D1 is shared by FL-22-01 / FL-22-02 (read-only walks, one seed per file worker); FL-22-03 seeds DF; FL-22-04 seeds the
 * two-scale project (no drawing); FL-22-05 seeds a no-drawing project, a FILE_CORRUPT run and uploads the env drawing
 * through the SCR-10 tray. Everything is deleted in `finally` / `afterAll`.
 *
 * ## Request budget per full run
 * - `POST /api/auth/login` (120 / 60 s per IP): 2 API per file (main admin for the pool lookup + pool admin) + 1 browser
 *   session per flow (5) + 1 anonymous page (no login) = ~8.
 * - `POST /api/users/invitations`: 0 (slot `p04-overlay` exists; else 1 admin invitation).
 * - Uploads (`drawings_init` 60 / 600 s per user, pool admin): D1 1, DF 1, FILE_CORRUPT 1, tray upload 1 = 4.
 * - `POST /api/projects`: 5 (+5 DELETE); `PUT …/spatial/layer`: 4 (FL-22-04 seed).
 * - `POST /api/auth/refresh`: ~1 per page load (≈ 25).
 */
import { expect, test, type Page } from '@playwright/test';

import { ROUTES } from '../../e2e/fixtures/routes';
import { PIPELINE_TIMEOUT_MS, readBaseUrl } from '../../e2e/fullstack/env';
import { captureEvidence } from './support/evidence';
import { createDrawingProject, deleteSeededProject } from './support/phase03Seed';
import { typeHeight } from './support/numeric-field';
import { closeFlow, openFlow, type Flow } from './support/p03/P5';
import { bogusFloorId } from './support/p03/P10';
import { markShell, shellKept, uploadViaTray } from './support/p03/P11';
import { framedPng } from './support/p03/P12';
import {
  OV,
  alertWith,
  divider,
  floorSelect,
  geometryPaths,
  lockSwitch,
  modeGroup,
  bigWhitePng,
  modeRadio,
  noticeText,
  noticeRegion,
  hopToOverlay,
  openOverlay,
  openViewer,
  opacitySlider,
  overlayLayers,
  ownerApi,
  panel,
  quiet,
  screenRegion,
  seedD1,
  seedDF,
  seedNoDrawing,
  seedOverlayScales,
  toleranceField,
  toolbar,
  type Owner,
} from './support/p04/P7';

/* ---------------------------------------------------------------- small helpers */

const note = (description: string): void => {
  test.info().annotations.push({ type: 'note', description });
};
const ev = (page: Page, row: string, slug: string, caption?: string): Promise<string> =>
  captureEvidence(page, `E04_${row}_${slug}.png`, caption === undefined ? {} : { caption });
const pathOf = (page: Page): string => new URL(page.url()).pathname;
const canvasFrame = (page: Page) => page.getByRole('group', { name: OV.canvasGroup, exact: true }).last();

interface Plane {
  readonly x: number;
  readonly y: number;
  readonly zoom: number;
}

/** Camera of the nth `[data-comparison-plane]` (inline `translate(Xpx, Ypx) scale(Z)`, OCV:99-110). */
async function plane(page: Page, index = 0): Promise<Plane> {
  return page.locator('[data-comparison-plane]').nth(index).evaluate((el) => {
    const match = /translate\((-?[\d.e+-]+)px, (-?[\d.e+-]+)px\) scale\((-?[\d.e+-]+)\)/u.exec((el as HTMLElement).style.transform);
    if (match === null) throw new Error(`plane transform not parsed: ${(el as HTMLElement).style.transform}`);
    return { x: Number(match[1]), y: Number(match[2]), zoom: Number(match[3]) };
  });
}

/** `count` wheel events on the canvas root at (clientX, clientY), one per two animation frames (React must re-render between notches: the zoom is computed from the props, OCV:228-251). */
async function wheel(page: Page, count: number, deltaY: number, at: { x: number; y: number }): Promise<void> {
  await page.evaluate(
    async ({ n, dy, x, y }) => {
      const root = document.querySelector('[role="group"][aria-label="Khung đối chiếu bản vẽ và mô hình"]');
      if (root === null) throw new Error('canvas root not found');
      const frames = (): Promise<void> => new Promise((resolve) => requestAnimationFrame(() => requestAnimationFrame(() => resolve())));
      for (let i = 0; i < n; i += 1) {
        root.dispatchEvent(new WheelEvent('wheel', { bubbles: true, cancelable: true, clientX: x, clientY: y, deltaY: dy }));
        await frames();
      }
    },
    { n: count, dy: deltaY, x: at.x, y: at.y },
  );
}

async function centreOf(locator: ReturnType<Page['locator']>): Promise<{ x: number; y: number; width: number; height: number; cx: number; cy: number }> {
  const box = await locator.boundingBox();
  if (box === null) throw new Error('no bounding box');
  return { ...box, cx: box.x + box.width / 2, cy: box.y + box.height / 2 };
}

const swipeOn = async (page: Page): Promise<void> => {
  await modeRadio(page, OV.swipe).click();
  await expect(divider(page)).toBeVisible();
};

/* ---------------------------------------------------------------- shared D1 (FL-22-01, FL-22-02) */

test.describe('SCR-22 overlay — drawing floor D1 (read-only walks)', () => {
  let owner: Owner | undefined;
  let d1: { projectId: string; floorId: string; floorName: string } | undefined;

  test.beforeAll(async () => {
    test.info().setTimeout(PIPELINE_TIMEOUT_MS + 90_000);
    owner = await ownerApi();
    d1 = await seedD1(owner.api, '22-d1');
  });

  test.afterAll(async () => {
    try {
      if (owner !== undefined && d1 !== undefined) await deleteSeededProject(owner.api, d1.projectId);
    } finally {
      await owner?.dispose();
    }
  });

  const need = (): { owner: Owner; d1: { projectId: string; floorId: string; floorName: string } } => {
    if (owner === undefined || d1 === undefined) throw new Error('setup: D1 was not seeded');
    return { owner, d1 };
  };

  test('SCR-22 · FL-22-01 · overlay default: layers, frame-missing alert, divider by keys / drag / hit area, opacity, scale link', async ({ browser }) => {
    test.setTimeout(150_000);
    const { owner: o, d1: floor } = need();
    let flow: Flow | undefined;
    try {
      flow = await openFlow(browser, o.user);
      const { page } = flow;
      await openOverlay(page, floor.projectId, floor.floorId);
      await expect(alertWith(page, OV.frameMissing)).toBeVisible();

      await test.step('[22-A-002] "Chồng lớp" checked by default; one group holds exactly the 3 overlay layers', async () => {
        await expect(modeRadio(page, OV.overlay)).toHaveAttribute('aria-checked', 'true');
        await expect(overlayLayers(page)).toHaveCount(3);
        await expect(canvasFrame(page).locator('[data-overlay-layer]')).toHaveCount(3);
        const ids = await overlayLayers(page).evaluateAll((els) => els.map((el) => el.getAttribute('data-overlay-layer')));
        expect(ids, 'layer order: scan, geometry, deviation').toEqual(['scan', 'geometry', 'deviation']);
        await ev(page, '22-A-002', 'default_layers');
      });

      await test.step('[22-B-003] error, frame missing: violation alert + "Sang màn hiệu chỉnh tỷ lệ" link', async () => {
        await expect.soft(alertWith(page, OV.frameMissing)).toBeVisible();
        await expect.soft(page.getByRole('link', { name: OV.toScale, exact: true })).toBeVisible();
        await ev(page, '22-B-003', 'frame_missing');
      });

      await test.step('[22-E-001] names: screen region, canvas section, canvas group, toolbar, panel', async () => {
        await expect.soft(screenRegion(page)).toBeVisible();
        await expect.soft(page.getByRole('region', { name: OV.canvasSection, exact: true })).toBeVisible();
        await expect.soft(page.getByRole('group', { name: OV.canvasGroup, exact: true }).first()).toBeVisible();
        await expect.soft(toolbar(page)).toBeVisible();
        await expect.soft(panel(page)).toBeVisible();
      });

      await test.step('[22-E-002] ⚑ the root group and the inner frame group do not share one accessible name', async () => {
        const names = await page
          .locator('[role="group"][aria-label]')
          .evaluateAll((els) => els.filter((el) => el.querySelector('[data-overlay-layer]') !== null).map((el) => el.getAttribute('aria-label')));
        expect.soft(names.length, 'nested groups holding the layers').toBeGreaterThan(1);
        expect.soft(new Set(names).size, `group names ${JSON.stringify(names)} are distinct`).toBe(names.length);
      });

      await test.step('[22-E-003] ⚑ the notice wrapper that carries aria-label has a role (so the name is exposed)', async () => {
        const wrapper = noticeRegion(page);
        await expect.soft(wrapper).toHaveCount(1);
        expect.soft(await wrapper.getAttribute('role'), 'role of the labelled notice wrapper').not.toBeNull();
      });

      await test.step('[22-E-014] layer images "Ảnh quét gốc" / "Hình học sinh ra"; the empty "vùng lệch" layer is aria-hidden', async () => {
        await expect.soft(page.getByRole('img', { name: OV.layerScan, exact: true })).toHaveCount(1);
        await expect.soft(page.getByRole('img', { name: OV.layerGeometry, exact: true })).toHaveCount(1);
        await expect.soft(page.getByRole('img', { name: OV.layerDeviation, exact: true })).toHaveCount(0);
        await expect.soft(page.locator('[data-overlay-layer="deviation"]')).toHaveAttribute('aria-hidden', 'true');
      });

      await test.step('[22-A-005] divider: Home → 0, End → 1; further presses stay clamped', async () => {
        await swipeOn(page);
        const handle = divider(page);
        await handle.focus();
        await page.keyboard.press('Home');
        await expect.soft(handle).toHaveAttribute('aria-valuenow', '0');
        await page.keyboard.press('ArrowLeft');
        await expect.soft(handle).toHaveAttribute('aria-valuenow', '0');
        await page.keyboard.press('End');
        await expect.soft(handle).toHaveAttribute('aria-valuenow', '1');
        await page.keyboard.press('ArrowRight');
        await expect.soft(handle).toHaveAttribute('aria-valuenow', '1');
        await page.keyboard.press('Home');
        await page.keyboard.press('ArrowRight');
        await ev(page, '22-A-005', 'divider_keys');
      });

      await test.step('[22-A-006] dragging the divider: aria-valuenow follows the pointer (clamped 0..1), clip transition dropped while dragging', async () => {
        const frame = await centreOf(canvasFrame(page));
        const handle = await centreOf(divider(page));
        await page.mouse.move(handle.cx, handle.cy);
        await page.mouse.down();
        const target = frame.x + frame.width * 0.25;
        await page.mouse.move(target, handle.cy, { steps: 6 });
        const now = Number(await divider(page).getAttribute('aria-valuenow'));
        expect.soft(Math.abs(now - 0.25), `valuenow ${String(now)} follows the pointer at 0.25`).toBeLessThan(0.02);
        const during = await page.locator('[data-overlay-layer="scan"]').evaluate((el) => getComputedStyle(el).transitionProperty);
        expect.soft(during, 'while dragging only opacity transitions (OCV:292-297)').toBe('opacity');
        await page.mouse.move(frame.x - 120, handle.cy, { steps: 4 });
        expect.soft(await divider(page).getAttribute('aria-valuenow'), 'dragged past the left edge').toBe('0');
        await page.mouse.move(frame.x + frame.width + 120, handle.cy, { steps: 4 });
        expect.soft(await divider(page).getAttribute('aria-valuenow'), 'dragged past the right edge').toBe('1');
        await page.mouse.up();
        const after = await page.locator('[data-overlay-layer="scan"]').evaluate((el) => getComputedStyle(el).transitionProperty);
        expect.soft(after, 'after the drag the clip-path transition is back').toContain('clip-path');
        await ev(page, '22-A-006', 'divider_drag');
      });

      await test.step('[22-A-007] pointer-down in the 32 px hit area (away from the 4 px bar) jumps the divider there', async () => {
        await divider(page).focus();
        await page.keyboard.press('Home');
        await page.keyboard.press('ArrowRight'); // 0.02, hit area centred near the left edge
        const frame = await centreOf(canvasFrame(page));
        const hit = await centreOf(divider(page));
        expect.soft(Math.round(hit.width), 'hit area width').toBe(32);
        const x = hit.x + hit.width - 3; // inside the hit area, 13 px right of the bar
        await page.mouse.move(x, hit.cy);
        await page.mouse.down();
        await page.mouse.up();
        const expected = (x - frame.x) / frame.width;
        const now = Number(await divider(page).getAttribute('aria-valuenow'));
        expect.soft(Math.abs(now - expected), `valuenow ${String(now)} jumped to the pointer ratio ${String(expected)}`).toBeLessThan(0.01);
      });

      await test.step('[22-E-009] the divider announces the raw 0..1 ratio, with no aria-valuetext', async () => {
        const handle = divider(page);
        const now = Number(await handle.getAttribute('aria-valuenow'));
        expect.soft(now >= 0 && now <= 1, 'aria-valuenow is a 0..1 ratio').toBe(true);
        expect.soft(await handle.getAttribute('aria-valuemin')).toBe('0');
        expect.soft(await handle.getAttribute('aria-valuemax')).toBe('1');
        await expect.soft(handle).not.toHaveAttribute('aria-valuetext');
      });

      let initialOpacityText = '';
      let initialOpacityNow = '';
      await test.step('[22-A-014] opacity slider: Home → "0%" (scan layer invisible), End → "100%"', async () => {
        const slider = opacitySlider(page);
        initialOpacityNow = (await slider.getAttribute('aria-valuenow')) ?? '';
        initialOpacityText = (await toolbar(page).getByText(/^\d+%$/u).innerText()).trim();
        await slider.focus();
        await page.keyboard.press('Home');
        await expect.soft(toolbar(page).getByText('0%', { exact: true })).toBeVisible();
        await expect.soft(page.locator('[data-overlay-layer="scan"]')).toHaveCSS('opacity', '0');
        await page.keyboard.press('End');
        await expect.soft(toolbar(page).getByText('100%', { exact: true })).toBeVisible();
        await expect.soft(page.locator('[data-overlay-layer="scan"]')).toHaveCSS('opacity', '1');
      });

      await test.step('[22-E-008] opacity slider aria-valuemin 0 / max 100 / now; visible "25%" at the start', async () => {
        const slider = opacitySlider(page);
        expect.soft(await slider.getAttribute('aria-valuemin')).toBe('0');
        expect.soft(await slider.getAttribute('aria-valuemax')).toBe('100');
        expect.soft(initialOpacityNow, 'default value').toBe('25');
        expect.soft(initialOpacityText, 'default visible text').toBe('25%');
        expect.soft(await slider.getAttribute('aria-valuenow'), 'now = 100 after End').toBe('100');
      });

      await test.step('[22-A-019] "Sang màn hiệu chỉnh tỷ lệ": href = scale route; click is a full load to SCR-14', async () => {
        const link = page.getByRole('link', { name: OV.toScale, exact: true });
        await expect.soft(link).toHaveAttribute('href', ROUTES.project.scale(floor.projectId, floor.floorId));
        // ⚑ BUG-325: the link target is 160 × 24 — below 44 px for a text link under 640 px.
        await page.setViewportSize({ width: 375, height: 812 });
        const small = await link.boundingBox();
        expect.soft(small?.height ?? 0, `link target ${String(small?.width)} × ${String(small?.height)} at 375`).toBeGreaterThanOrEqual(44);
        await page.setViewportSize({ width: 1440, height: 900 });
        await markShell(page);
        await link.click();
        await expect.poll(() => pathOf(page)).toBe(ROUTES.project.scale(floor.projectId, floor.floorId));
        // Marker: SCR-14 is painted (ScaleCalibration.tsx:66,184-186), so a full load has finished and the evaluate has a live context.
        await expect(page.getByRole('region', { name: 'Màn hiệu chỉnh tỷ lệ', exact: true })).toBeVisible();
        await page.waitForLoadState('domcontentloaded');
        expect.soft(await shellKept(page), 'the click is a plain <a href>: a full document load').toBe(false);
        await ev(page, '22-A-019', 'scale_link_target');
      });

      await test.step('[22-C-008] hook clamps: swipe ratio 0..1, opacity 0..100 (integer), tolerance ≥ 0', async () => {
        await openOverlay(page, floor.projectId, floor.floorId);
        await expect(alertWith(page, OV.frameMissing)).toBeVisible();
        await swipeOn(page);
        await divider(page).focus();
        await page.keyboard.press('End');
        await page.keyboard.press('ArrowRight');
        expect.soft(await divider(page).getAttribute('aria-valuenow'), 'swipe ratio ≤ 1').toBe('1');
        await page.keyboard.press('Home');
        await page.keyboard.press('ArrowLeft');
        expect.soft(await divider(page).getAttribute('aria-valuenow'), 'swipe ratio ≥ 0').toBe('0');
        await opacitySlider(page).focus();
        await page.keyboard.press('End');
        await page.keyboard.press('ArrowRight');
        expect.soft(await opacitySlider(page).getAttribute('aria-valuenow'), 'opacity ≤ 100').toBe('100');
        await page.keyboard.press('Home');
        await page.keyboard.press('ArrowLeft');
        expect.soft(await opacitySlider(page).getAttribute('aria-valuenow'), 'opacity ≥ 0').toBe('0');
        const value = Number(await opacitySlider(page).getAttribute('aria-valuenow'));
        expect.soft(Number.isInteger(value), 'opacity is a whole percent').toBe(true);
        await typeHeight(toleranceField(page), '0');
        await toleranceField(page).focus();
        await page.keyboard.press('ArrowDown');
        await expect.soft(toleranceField(page), 'tolerance never goes below 0').toHaveValue('0');
        await ev(page, '22-C-008', 'clamps');
      });
    } finally {
      if (flow !== undefined) await closeFlow(flow);
    }
  });

  test('SCR-22 · FL-22-02 · zoom / pan, lock, tolerance, reload reset, no writes', async ({ browser }) => {
    test.setTimeout(150_000);
    const { owner: o, d1: floor } = need();
    let flow: Flow | undefined;
    try {
      flow = await openFlow(browser, o.user);
      const { page } = flow;
      await openOverlay(page, floor.projectId, floor.floorId);
      await expect(alertWith(page, OV.frameMissing)).toBeVisible();
      const writesFrom = flow.sent.length;
      const canvas = await centreOf(page.getByRole('group', { name: OV.canvasGroup, exact: true }).first());
      let committed = 20;

      await test.step('[22-A-010] wheel zooms ×1.1 around the pointer, clamped 0.25..8; in "Cạnh nhau" both frames move together', async () => {
        const at = { x: canvas.x + 300, y: canvas.y + 200 };
        const start = await plane(page);
        expect.soft(start.zoom).toBe(1);
        await wheel(page, 1, -100, at);
        const one = await plane(page);
        expect.soft(one.zoom, 'one notch in').toBeCloseTo(1.1, 5);
        expect.soft(one.x, 'the point under the pointer stays: x = ax − (ax − x0)·1.1').toBeCloseTo((at.x - canvas.x) - ((at.x - canvas.x) - start.x) * 1.1, 3);
        await wheel(page, 40, -100, at);
        expect.soft((await plane(page)).zoom, 'clamped at 8').toBe(8);
        await wheel(page, 120, 100, at);
        expect.soft((await plane(page)).zoom, 'clamped at 0.25').toBe(0.25);
        await wheel(page, 14, -100, at); // 0.25 × 1.1^14 ≈ 0.95: back to a mid camera
        await modeRadio(page, OV.sideBySide).click();
        await expect(page.getByRole('group', { name: OV.sourceFrame, exact: true })).toBeVisible();
        await wheel(page, 3, -100, { x: canvas.x + 200, y: canvas.y + 150 });
        const left = await plane(page, 0);
        const right = await plane(page, 1);
        expect.soft(right, 'both frames share one camera').toEqual(left);
        await ev(page, '22-A-010', 'wheel_zoom');
        await modeRadio(page, OV.overlay).click();
      });

      await test.step('[22-A-011] middle-button drag pans (cursor-grabbing); left drag does nothing', async () => {
        const before = await plane(page);
        const root = page.getByRole('group', { name: OV.canvasGroup, exact: true }).first();
        const from = { x: canvas.x + 400, y: canvas.y + 300 };
        await page.mouse.move(from.x, from.y);
        await page.mouse.down({ button: 'left' });
        await page.mouse.move(from.x + 80, from.y + 40, { steps: 4 });
        await page.mouse.up({ button: 'left' });
        expect.soft(await plane(page), 'a left drag leaves the camera alone').toEqual(before);
        await page.mouse.move(from.x, from.y);
        await page.mouse.down({ button: 'middle' });
        await page.mouse.move(from.x + 60, from.y + 30, { steps: 5 });
        await expect.soft(root).toHaveClass(/cursor-grabbing/u);
        await page.mouse.up({ button: 'middle' });
        const after = await plane(page);
        expect.soft(after.x - before.x, 'panned by the pointer travel (x)').toBeCloseTo(60, 0);
        expect.soft(after.y - before.y, 'panned by the pointer travel (y)').toBeCloseTo(30, 0);
        await expect.soft(root).not.toHaveClass(/cursor-grabbing/u);
      });

      await test.step('[22-A-012] ⚑ a reset control for zoom / pan exists', async () => {
        const reset = page.getByRole('button', { name: /đặt lại|vừa khung|căn lại|khôi phục.*(khung|nhìn)|reset|fit/iu });
        await expect.soft(reset, 'no fit / reset button on the screen').not.toHaveCount(0);
        await ev(page, '22-A-012', 'no_reset');
      });

      await test.step('[22-E-016] ⚑ the canvas can be zoomed and panned from the keyboard (A12)', async () => {
        const before = await plane(page);
        await page.getByRole('group', { name: OV.canvasGroup, exact: true }).first().focus().catch(() => undefined);
        for (const key of ['+', '=', '-', 'ArrowLeft', 'ArrowDown']) await page.keyboard.press(key);
        expect.soft(await plane(page), 'a key moved the camera').not.toEqual(before);
      });

      await test.step('[22-C-005] ⚑ "Khoá căn" on locks divider, zoom, pan and opacity', async () => {
        await swipeOn(page);
        await lockSwitch(page).click();
        await expect(lockSwitch(page)).toHaveAttribute('aria-checked', 'true');
        const camera = await plane(page);
        const handle = divider(page);
        const dividerBefore = await handle.getAttribute('aria-valuenow');
        await handle.focus();
        await page.keyboard.press('ArrowRight');
        expect.soft(await handle.getAttribute('aria-valuenow'), 'divider keys are ignored while locked').toBe(dividerBefore);
        await wheel(page, 1, -100, { x: canvas.x + 200, y: canvas.y + 200 });
        expect.soft((await plane(page)).zoom, 'wheel zoom ignored while locked').toBe(camera.zoom);
        const opacityBefore = await opacitySlider(page).getAttribute('aria-valuenow');
        await opacitySlider(page).focus();
        await page.keyboard.press('ArrowRight');
        expect.soft(await opacitySlider(page).getAttribute('aria-valuenow'), 'opacity ignored while locked').toBe(opacityBefore);
        await ev(page, '22-C-005', 'lock_no_effect');
      });

      await test.step('[22-A-021] "Dung sai": 50 committed on blur; ArrowUp +1, Shift+ArrowUp +10, Esc restores', async () => {
        await typeHeight(toleranceField(page), '50');
        committed = 50;
        await expect.soft(toleranceField(page)).toHaveValue('50');
        await toleranceField(page).focus();
        await page.keyboard.press('ArrowUp');
        await expect.soft(toleranceField(page)).toHaveValue('51');
        await page.keyboard.press('Shift+ArrowUp');
        await expect.soft(toleranceField(page)).toHaveValue('61');
        await page.keyboard.press('Escape');
        await expect.soft(toleranceField(page), 'Esc restores the committed value').toHaveValue(String(committed));
      });

      await test.step('[22-A-022] "Dung sai" -5 → "Giá trị không nhỏ hơn 0 mm.", not committed', async () => {
        await toleranceField(page).focus();
        await page.keyboard.press('Control+A');
        await page.keyboard.insertText('-5');
        await expect.soft(page.getByText('Giá trị không nhỏ hơn 0 mm.', { exact: true })).toBeVisible();
        await page.keyboard.press('Tab');
        await expect.soft(page.getByText('Giá trị không nhỏ hơn 0 mm.', { exact: true })).toBeVisible();
        await toleranceField(page).focus();
        await page.keyboard.press('Escape');
        await expect.soft(toleranceField(page), 'the invalid value was never committed').toHaveValue(String(committed));
        await ev(page, '22-A-022', 'tolerance_negative');
      });

      await test.step('[22-A-023] "Dung sai" emptied → ignored, the value stays', async () => {
        await typeHeight(toleranceField(page), '');
        await expect.soft(toleranceField(page)).toHaveValue(String(committed));
      });

      await test.step('[22-E-012] "Dung sai" label + unit "mm"; the inline error is tied to the input', async () => {
        await expect.soft(toleranceField(page)).toBeVisible();
        await expect.soft(panel(page).getByText('mm', { exact: true }).first()).toBeVisible();
        await toleranceField(page).focus();
        await page.keyboard.press('Control+A');
        await page.keyboard.insertText('-1');
        const message = page.getByText('Giá trị không nhỏ hơn 0 mm.', { exact: true });
        await expect.soft(message).toBeVisible();
        const describedBy = (await toleranceField(page).getAttribute('aria-describedby')) ?? '';
        const messageId = (await message.getAttribute('id')) ?? '';
        expect.soft(messageId !== '' && describedBy.split(/\s+/u).includes(messageId), `aria-describedby "${describedBy}" → error id "${messageId}"`).toBe(true);
        expect.soft(await toleranceField(page).getAttribute('aria-invalid')).toBe('true');
        await page.keyboard.press('Escape');
      });

      await test.step('[22-E-013] over-tolerance stat: digits aria-hidden, role status reads "— số vùng vượt ngưỡng"', async () => {
        const status = panel(page).getByRole('status');
        await expect.soft(status).toHaveText(`— ${OV.overToleranceLabel}`);
        await expect.soft(panel(page).locator('span[aria-hidden="true"]').filter({ hasText: '—' })).toHaveCount(1);
      });

      await test.step('[22-B-014] metrics are never "0 mm" while unmeasured: "—" ×3', async () => {
        const dashes = panel(page).getByText('—', { exact: true });
        await expect.soft(dashes).toHaveCount(3);
        await expect.soft(panel(page).getByText(/^0(,0+)? mm$/u)).toHaveCount(0);
        await expect.soft(panel(page).getByText(OV.measuring, { exact: true })).toBeVisible();
      });

      await test.step('[22-A-025] "Xác nhận mô hình khớp bản vẽ" is disabled (nothing measured)', async () => {
        await expect.soft(panel(page).getByRole('button', { name: OV.confirm, exact: true })).toBeDisabled();
      });

      await test.step('[22-A-024] reload resets mode / opacity / divider / lock / tolerance to "Chồng lớp" / 25% / 0.5 / off / 20', async () => {
        await opacitySlider(page).focus();
        await page.keyboard.press('Home');
        await page.reload();
        await expect(screenRegion(page)).toBeVisible();
        await expect(alertWith(page, OV.frameMissing)).toBeVisible();
        await expect.soft(modeRadio(page, OV.overlay)).toHaveAttribute('aria-checked', 'true');
        await expect.soft(opacitySlider(page)).toHaveAttribute('aria-valuenow', '25');
        await expect.soft(toolbar(page).getByText('25%', { exact: true })).toBeVisible();
        await expect.soft(lockSwitch(page)).toHaveAttribute('aria-checked', 'false');
        await expect.soft(toleranceField(page)).toHaveValue('20');
        await swipeOn(page);
        await expect.soft(divider(page)).toHaveAttribute('aria-valuenow', '0.5');
        expect.soft((await plane(page)).zoom, 'camera reset by the reload').toBe(1);
      });

      await test.step('[22-G-012] no write request on any control (mode, opacity, divider, lock, tolerance, floor)', async () => {
        await lockSwitch(page).click();
        await divider(page).focus();
        await page.keyboard.press('ArrowRight');
        await typeHeight(toleranceField(page), '30');
        await floorSelect(page).click();
        await page.getByRole('option').first().click();
        await quiet(page);
        const writes = flow!.sent.slice(writesFrom).filter((r) => r.method !== 'GET' && r.path !== '/api/auth/refresh' && !r.path.startsWith('/api/telemetry'));
        expect.soft(writes.map((r) => `${r.method} ${r.path}`), 'no PUT / POST / PATCH / DELETE from the overlay controls').toEqual([]);
      });

      await test.step('[22-G-011] the scan image GET (sourceUrl) answers 200 and paints', async () => {
        const img = page.locator('[data-overlay-layer="scan"] img');
        await expect(img).toHaveCount(1);
        const src = (await img.getAttribute('src')) ?? '';
        expect.soft(src, 'scan sourceUrl').not.toBe('');
        const res = await page.request.get(src);
        expect.soft(res.status(), `GET sourceUrl → ${String(res.status())}`).toBe(200);
        expect.soft(await img.evaluate((el: HTMLImageElement) => el.complete && el.naturalWidth > 0), 'the image decoded').toBe(true);
        await ev(page, '22-G-011', 'scan_image');
      });
    } finally {
      if (flow !== undefined) await closeFlow(flow);
    }
  });
});

/* ================================================================= FL-22-03 framed floor */

test.describe('SCR-22 overlay — framed floor DF', () => {
  test('SCR-22 · FL-22-03 · framed floor: partial, side by side, resize fallback, mode radios, stretched geometry', async ({ browser }) => {
    test.setTimeout(PIPELINE_TIMEOUT_MS + 180_000);
    const owner = await ownerApi();
    let flow: Flow | undefined;
    let df: { projectId: string; floorId: string; floorName: string } | undefined;
    try {
      df = await seedDF(owner.api, '22-df');
      flow = await openFlow(browser, owner.user);
      const { page } = flow;
      await openOverlay(page, df.projectId, df.floorId);
      await expect(panel(page)).toBeVisible();
      await expect(alertWith(page, OV.frameMissing)).toHaveCount(0);

      await test.step('[22-B-010] partial on a framed floor (≥ 1280): no notice; metrics "—" and status "— số vùng vượt ngưỡng"; list text', async () => {
        await expect(noticeRegion(page), 'no state notice on a framed admin floor').toHaveCount(0);
        await expect.soft(panel(page).getByText('—', { exact: true })).toHaveCount(3);
        await expect.soft(panel(page).getByRole('status')).toHaveText(`— ${OV.overToleranceLabel}`);
        await expect.soft(panel(page).getByText(OV.measuring, { exact: true })).toBeVisible();
        await ev(page, '22-B-010', 'framed_partial');
      });

      await test.step('[22-A-008] "Cạnh nhau" → groups "Khung bản vẽ nguồn" and "Khung mô hình sinh ra"; still 3 layers', async () => {
        await modeRadio(page, OV.sideBySide).click();
        await expect.soft(page.getByRole('group', { name: OV.sourceFrame, exact: true })).toBeVisible();
        await expect.soft(page.getByRole('group', { name: OV.resultFrame, exact: true })).toBeVisible();
        await expect.soft(page.getByRole('group', { name: OV.sourceFrame, exact: true }).locator('[data-overlay-layer="scan"]')).toHaveCount(1);
        await expect.soft(page.getByRole('group', { name: OV.resultFrame, exact: true }).locator('[data-overlay-layer]')).toHaveCount(2);
        await expect.soft(overlayLayers(page)).toHaveCount(3);
        await ev(page, '22-A-008', 'side_by_side');
      });

      const sampleDissolve = async (click: () => Promise<void>): Promise<{ min: number; last: number; ms: number }> => {
        await page.evaluate(() => {
          const w = window as unknown as { __qaDissolve?: { t: number; o: number }[]; __qaStop?: boolean };
          w.__qaDissolve = [];
          w.__qaStop = false;
          const root = document.querySelector('[role="group"][aria-label="Khung đối chiếu bản vẽ và mô hình"]');
          const tick = (t: number): void => {
            const el = root?.children[1] as HTMLElement | undefined;
            if (el !== undefined) w.__qaDissolve?.push({ t, o: Number(getComputedStyle(el).opacity) });
            if (w.__qaStop !== true) requestAnimationFrame(tick);
          };
          requestAnimationFrame(tick);
        });
        await click();
        await expect.poll(async () => page.evaluate(() => {
          const s = (window as unknown as { __qaDissolve: { o: number }[] }).__qaDissolve;
          return s.length > 0 && s[s.length - 1]?.o === 1;
        })).toBe(true);
        return page.evaluate(() => {
          const w = window as unknown as { __qaDissolve: { t: number; o: number }[]; __qaStop: boolean };
          w.__qaStop = true;
          const s = w.__qaDissolve;
          return { min: Math.min(...s.map((x) => x.o)), last: s[s.length - 1]?.o ?? -1, ms: (s[s.length - 1]?.t ?? 0) - (s[0]?.t ?? 0) };
        });
      };

      await test.step('[22-A-009] a mode change dissolves in 340 ms (opacity 0 → 1)', async () => {
        const sample = await sampleDissolve(() => modeRadio(page, OV.overlay).click());
        expect.soft(sample.min, 'the new canvas starts transparent').toBeLessThan(0.5);
        expect.soft(sample.last).toBe(1);
        expect.soft(sample.ms, `dissolve took ${String(Math.round(sample.ms))} ms`).toBeGreaterThan(150);
        expect.soft(sample.ms).toBeLessThan(700);
      });

      await test.step('[22-E-017] reduced motion: the dissolve is a cut', async () => {
        await page.emulateMedia({ reducedMotion: 'reduce' });
        const sample = await sampleDissolve(() => modeRadio(page, OV.swipe).click());
        expect.soft(sample.min, 'with reduced motion no frame is below full opacity').toBe(1);
        await page.emulateMedia({ reducedMotion: 'no-preference' });
        await modeRadio(page, OV.overlay).click();
      });

      await test.step('[22-E-006] "Kiểu đối chiếu": arrows move between enabled modes; the arrow onto disabled "Cạnh nhau" changes nothing', async () => {
        await page.setViewportSize({ width: 1024, height: 800 });
        await expect(modeRadio(page, OV.sideBySide)).toBeDisabled();
        await modeRadio(page, OV.overlay).focus();
        await page.keyboard.press('ArrowRight');
        await expect.soft(modeRadio(page, OV.swipe)).toHaveAttribute('aria-checked', 'true');
        await page.keyboard.press('ArrowRight');
        await expect.soft(modeRadio(page, OV.swipe), 'onto the disabled mode: unchanged').toHaveAttribute('aria-checked', 'true');
        await expect.soft(modeRadio(page, OV.sideBySide)).toHaveAttribute('aria-checked', 'false');
        await modeRadio(page, OV.swipe).focus();
        await page.keyboard.press('ArrowLeft');
        await expect.soft(modeRadio(page, OV.overlay)).toHaveAttribute('aria-checked', 'true');
        await ev(page, '22-E-006', 'mode_arrows_1024');
      });

      await test.step('[22-A-026] resize below 1280 while "Cạnh nhau" is chosen → shown as "Trượt"; back ≥ 1280 → "Cạnh nhau" again', async () => {
        await page.setViewportSize({ width: 1440, height: 900 });
        await expect(modeRadio(page, OV.sideBySide)).toBeEnabled();
        await modeRadio(page, OV.sideBySide).click();
        await expect(modeRadio(page, OV.sideBySide)).toHaveAttribute('aria-checked', 'true');
        await page.setViewportSize({ width: 1100, height: 900 });
        await expect.soft(modeRadio(page, OV.swipe)).toHaveAttribute('aria-checked', 'true');
        await expect.soft(divider(page)).toBeVisible();
        await page.setViewportSize({ width: 1440, height: 900 });
        await expect.soft(modeRadio(page, OV.sideBySide), 'the request is remembered').toHaveAttribute('aria-checked', 'true');
        await expect.soft(page.getByRole('group', { name: OV.sourceFrame, exact: true })).toBeVisible();
      });

      await test.step('[22-B-013] collapsed (< 1280, framed, admin): toolbar stacks, "Cạnh nhau" disabled with its caption, no notice', async () => {
        await page.setViewportSize({ width: 1100, height: 900 });
        await expect.soft(toolbar(page)).toHaveClass(/flex-col/u);
        await expect.soft(modeRadio(page, OV.sideBySide)).toBeDisabled();
        await expect.soft(page.getByText(`${OV.sideBySide} — ${OV.sideBySideDisabled}`, { exact: true })).toBeVisible();
        await expect.soft(noticeRegion(page)).toHaveCount(0);
        await ev(page, '22-B-013', 'collapsed_1100');
      });

      await test.step('[22-E-007] the disabled-mode reason is visible text under the control, not a title', async () => {
        const caption = page.getByText(`${OV.sideBySide} — ${OV.sideBySideDisabled}`, { exact: true });
        await expect.soft(caption).toBeVisible();
        expect.soft(await modeRadio(page, OV.sideBySide).getAttribute('title'), 'no title attribute carrying the reason').toBeNull();
      });

      await test.step('[22-E-011] "Khoá căn" is a labelled switch with aria-checked', async () => {
        const lock = lockSwitch(page);
        await expect.soft(lock).toBeVisible();
        const was = await lock.getAttribute('aria-checked');
        await lock.click();
        await expect.soft(lock).toHaveAttribute('aria-checked', was === 'true' ? 'false' : 'true');
        await lock.click();
      });

      await test.step('[22-C-006] geometry is stretched to the frame on X and Y separately (preserveAspectRatio none) while the scan keeps object-contain', async () => {
        await page.setViewportSize({ width: 1440, height: 900 });
        const count = await geometryPaths(page).count();
        note(`geometry polylines on DF: ${String(count)}`);
        const svg = page.locator('[data-overlay-layer="geometry"] svg');
        expect.soft(await svg.getAttribute('preserveAspectRatio')).toBe('none');
        expect.soft(await svg.getAttribute('viewBox')).toBe('0 0 1 1');
        const extent = await geometryPaths(page).evaluateAll((paths) => {
          const nums = paths.flatMap((p) => (p.getAttribute('d') ?? '').match(/-?[\d.]+(?:e-?\d+)?/gu)?.map(Number) ?? []);
          const xs = nums.filter((_, i) => i % 2 === 0);
          const ys = nums.filter((_, i) => i % 2 === 1);
          return { n: paths.length, x: [Math.min(...xs), Math.max(...xs)], y: [Math.min(...ys), Math.max(...ys)] };
        });
        if (extent.n > 0) {
          expect.soft(extent.x[0], 'bbox x min → 0').toBeCloseTo(0, 3);
          expect.soft(extent.x[1], 'bbox x max → 1').toBeCloseTo(1, 3);
          expect.soft(extent.y[0], 'bbox y min → 0').toBeCloseTo(0, 3);
          expect.soft(extent.y[1], 'bbox y max → 1').toBeCloseTo(1, 3);
        }
        await expect.soft(page.locator('[data-overlay-layer="scan"] img')).toHaveCSS('object-fit', 'contain');
        await ev(page, '22-C-006', 'geometry_stretch');
      });

      await test.step('[22-A-015] "Khoá căn" toggles aria-checked and sends no request', async () => {
        const mark = flow!.sent.length;
        const lock = lockSwitch(page);
        const was = await lock.getAttribute('aria-checked');
        await lock.click();
        await expect.soft(lock).toHaveAttribute('aria-checked', was === 'true' ? 'false' : 'true');
        await quiet(page);
        expect.soft(flow!.sent.slice(mark).filter((r) => r.path !== '/api/auth/refresh').map((r) => `${r.method} ${r.path}`), 'the toggle is local').toEqual([]);
      });
    } finally {
      if (flow !== undefined) await closeFlow(flow);
      if (df !== undefined) await deleteSeededProject(owner.api, df.projectId);
      await owner.dispose();
    }
  });
});

/* ================================================================= FL-22-04 scales */

test.describe('SCR-22 overlay — geometry and scale conflict', () => {
  test('SCR-22 · FL-22-04 · geometry from the layer, scale conflict across floors, deep-link floor list', async ({ browser }) => {
    test.setTimeout(150_000);
    const owner = await ownerApi();
    let flow: Flow | undefined;
    let project: Awaited<ReturnType<typeof seedOverlayScales>> | undefined;
    try {
      project = await seedOverlayScales(owner.api, '22-scales');
      flow = await openFlow(browser, owner.user);
      const { page } = flow;
      const { projectId, layered, oneWall } = project;
      const toViewerAndOverlay = async (): Promise<void> => {
        await openViewer(page, projectId);
        await hopToOverlay(page);
      };

      await openOverlay(page, projectId, layered.id);

      await test.step('[22-A-027] geometry layer: walls open paths, rooms closed, one path per entity, accent stroke 2 px non-scaling', async () => {
        await expect(geometryPaths(page)).toHaveCount(12); // qcLayer: 10 walls + 2 rooms
        const shapes = await geometryPaths(page).evaluateAll((paths) =>
          paths.map((p) => ({
            closed: /Z\s*$/u.test(p.getAttribute('d') ?? ''),
            stroke: p.getAttribute('stroke'),
            width: p.getAttribute('stroke-width'),
            effect: p.getAttribute('vector-effect'),
          })),
        );
        expect.soft(shapes.filter((s) => s.closed).length, 'closed paths = rooms').toBe(2);
        expect.soft(shapes.filter((s) => !s.closed).length, 'open paths = walls').toBe(10);
        expect.soft(new Set(shapes.map((s) => `${s.stroke}|${s.width}|${s.effect}`)).size).toBe(1);
        expect.soft(shapes[0]?.stroke).toBe('var(--accent)');
        expect.soft(shapes[0]?.width).toBe('2');
        expect.soft(shapes[0]?.effect).toBe('non-scaling-stroke');
        await ev(page, '22-A-027', 'geometry_paths');
      });

      await test.step('[22-A-028] geometry is empty when every point is collinear (one wall)', async () => {
        await openOverlay(page, projectId, oneWall.id);
        await expect(page.locator('[data-overlay-layer="geometry"]')).toHaveCount(1);
        await expect.soft(geometryPaths(page)).toHaveCount(0);
        await ev(page, '22-A-028', 'geometry_one_wall');
      });

      await test.step('[22-B-005] scale conflict (store floors at 5 and 8 mm/px, entered from /3d): error + link to the active floor\'s scale', async () => {
        await toViewerAndOverlay();
        await expect.soft(alertWith(page, OV.scaleConflict)).toBeVisible();
        const link = page.getByRole('link', { name: OV.toScale, exact: true });
        await expect.soft(link).toBeVisible();
        const href = (await link.getAttribute('href')) ?? '';
        expect.soft(href, 'the link goes to the active floor\'s scale route').toMatch(new RegExp(`^/projects/${projectId}/floors/[^/]+/scale$`, 'u'));
        await ev(page, '22-B-005', 'scale_conflict');
      });

      await test.step('[22-B-006] ⚑ the conflict counts only the floors being compared (no drawing → nothing to compare → no conflict)', async () => {
        await expect.soft(alertWith(page, OV.scaleConflict), 'neither floor has a drawing, so there is nothing to align').toHaveCount(0);
      });

      await test.step('[22-A-018] a deep link lists only the route floor', async () => {
        await openOverlay(page, projectId, layered.id);
        await floorSelect(page).click();
        await expect.soft(page.getByRole('option')).toHaveCount(1);
        await page.keyboard.press('Escape');
      });

      await test.step('[22-G-008] N16 is read only when the store is empty; none when the store already holds the graph (from /3d)', async () => {
        const n16 = (from: number) => flow!.log.slice(from).filter((e) => e.method === 'GET' && /\/spatial\/layer$/u.test(e.path));
        const deepLink = flow!.log.length;
        await openOverlay(page, projectId, oneWall.id);
        await expect.poll(() => n16(deepLink).length, { message: 'a deep link reads N16 of the route floor' }).toBeGreaterThanOrEqual(1);
        await openViewer(page, projectId);
        const afterViewer = flow!.log.length;
        await hopToOverlay(page);
        await expect(toolbar(page)).toBeVisible();
        await quiet(page);
        expect.soft(n16(afterViewer).map((e) => e.path), 'no N16 GET for the SPA hop from /3d').toEqual([]);
      });
    } finally {
      if (flow !== undefined) await closeFlow(flow);
      if (project !== undefined) await deleteSeededProject(owner.api, project.projectId);
      await owner.dispose();
    }
  });
});

/* ================================================================= FL-22-05 no drawing */

test.describe('SCR-22 overlay — no drawing, unmeasured run, unknown floor, anonymous, upload', () => {
  test('SCR-22 · FL-22-05 · no drawing, unmeasured run, unknown floor, anonymous, upload then the drawing appears', async ({ browser }) => {
    test.setTimeout(PIPELINE_TIMEOUT_MS + 240_000);
    const owner = await ownerApi();
    let flow: Flow | undefined;
    const projects: string[] = [];
    try {
      const q2 = await seedNoDrawing(owner.api, '22-q2', 2);
      projects.push(q2.projectId);
      const [first, second] = q2.floors;
      if (first === undefined || second === undefined) throw new Error('setup: fewer than 2 floors');
      flow = await openFlow(browser, owner.user);
      const { page, log } = flow;
      await openOverlay(page, q2.projectId, first.id);
      await expect(alertWith(page, OV.noDrawing)).toBeVisible();

      await test.step('[22-A-020] "Tải bản vẽ lên" on a floor without a drawing → href /projects/{p}/upload', async () => {
        await expect(page.getByRole('link', { name: OV.toUpload, exact: true })).toHaveAttribute('href', ROUTES.project.upload(q2.projectId));
      });

      await test.step('[22-B-007] empty, no drawing: attention alert + upload link; no scale link; confirm disabled', async () => {
        await expect.soft(alertWith(page, OV.noDrawing)).toBeVisible();
        await expect.soft(page.getByRole('link', { name: OV.toScale })).toHaveCount(0);
        await expect.soft(page.getByRole('button', { name: OV.confirm, exact: true })).toBeDisabled();
        await ev(page, '22-B-007', 'no_drawing');
      });

      await test.step('[22-G-002] GET #30 answers 404 `upload` for the floor → the "no drawing" branch', async () => {
        const quality = log.filter((e) => e.method === 'GET' && e.path === `/api/projects/${q2.projectId}/floors/${first.id}/quality`);
        expect.soft(quality.length, 'one #30 read').toBeGreaterThanOrEqual(1);
        expect.soft(quality[0]?.status).toBe(404);
        expect.soft(JSON.stringify(quality[0]?.json ?? ''), 'resource upload').toContain('upload');
      });

      await test.step('[22-E-004] the state alert uses role alert', async () => {
        await expect.soft(page.getByRole('alert').filter({ hasText: OV.noDrawing })).toHaveCount(1);
      });

      await test.step('[22-B-008] ⚑ a drawing uploaded but not measured yet is not reported as a CAD import', async () => {
        // A 27 MP white page keeps the fake-ML run busy for seconds, so #30 lists the floor with `isMeasured` false while
        // the screen opens. A run that already finished (fast machine) shows the measured drawing instead: accepted, noted.
        const busy = await createDrawingProject(owner.api, '22-b-008', bigWhitePng(), ['Tầng 1']);
        projects.push(busy.projectId);
        await openOverlay(page, busy.projectId, busy.floorId);
        await expect(noticeRegion(page)).toBeVisible();
        const shown = await noticeText(page);
        note(`22-B-008: notice at open = "${shown ?? ''}"`);
        await ev(page, '22-B-008', 'unmeasured_floor', `notice: ${shown ?? ''}`);
        await expect.soft(page.getByText(OV.cadOnly, { exact: true }), 'wrong cause: the floor was uploaded as a raster, not imported from CAD').toHaveCount(0);
      });

      await test.step('[22-G-010] ⚑ N16 404 `floor` (unknown floor id in an own project) is not reported as "no floors"', async () => {
        const mark = log.length;
        await page.goto(ROUTES.project.overlay(q2.projectId, bogusFloorId('flr')));
        await expect(screenRegion(page)).toBeVisible();
        await expect(page.getByRole('toolbar', { name: OV.toolbar, exact: true }).or(page.getByRole('alert')).first()).toBeVisible();
        await ev(page, '22-G-010', 'unknown_floor');
        await expect.soft(page.getByText(OV.noFloor, { exact: true }), 'wrong notice for a missing floor').toHaveCount(0);
        expect.soft(log.slice(mark).filter((e) => /\/quality$/u.test(e.path)).length, 'no #30 call for a floor N16 did not find').toBe(0);
      });

      await test.step('[22-A-029] anonymous deep link → /login?next=… with "Hãy đăng nhập để tiếp tục."', async () => {
        const anon = await browser.newContext({ baseURL: readBaseUrl() });
        try {
          const anonPage = await anon.newPage();
          await anonPage.goto(ROUTES.project.overlay(q2.projectId, first.id));
          await expect.poll(() => pathOf(anonPage)).toBe('/login');
          expect.soft(new URL(anonPage.url()).searchParams.get('next')).toBe(ROUTES.project.overlay(q2.projectId, first.id));
          await expect.soft(anonPage.getByText('Hãy đăng nhập để tiếp tục.', { exact: true })).toBeVisible();
          await ev(anonPage, '22-A-029', 'anonymous_login');
        } finally {
          await anon.close();
        }
      });

      await test.step('[X4-A-035] "Tải bản vẽ lên" → SCR-10 → upload → after the run the same overlay route shows the drawing', async () => {
        await openOverlay(page, q2.projectId, second.id);
        await expect(alertWith(page, OV.noDrawing)).toBeVisible();
        await page.getByRole('link', { name: OV.toUpload, exact: true }).click();
        await expect.poll(() => pathOf(page)).toBe(ROUTES.project.upload(q2.projectId));
        await uploadViaTray(page, q2.projectId, second, { name: 'qa-22-upload.png', mimeType: 'image/png', buffer: framedPng() });
        await expect
          .poll(
            async () => {
              await openOverlay(page, q2.projectId, second.id);
              await expect(noticeRegion(page).or(toolbar(page)).first()).toBeVisible();
              return page.getByText(OV.noDrawing, { exact: true }).count();
            },
            { message: 'the run finished and the overlay reads the drawing', timeout: PIPELINE_TIMEOUT_MS, intervals: [2_000] },
          )
          .toBe(0);
        await expect.soft(page.getByText(OV.noDrawing, { exact: true })).toHaveCount(0);
        await expect.soft(page.locator('[data-overlay-layer="scan"] img')).toHaveCount(1);
        await ev(page, 'X4-A-035', 'drawing_after_upload');
      });
    } finally {
      if (flow !== undefined) await closeFlow(flow);
      for (const id of projects) await deleteSeededProject(owner.api, id);
      await owner.dispose();
    }
  });
});

