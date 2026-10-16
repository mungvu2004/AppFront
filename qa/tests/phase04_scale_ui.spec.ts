/**
 * Phase 4 — SCR-14 scale calibration, UI layer (skill `qa-verify-ui`): two sequential flows, one `test.step('[<row id>] …')` per
 * catalog row (QA-04c P6, `flow-plan.md` FL-14-U1 / FL-14-U2). Each visual state is opened by `verifyUi` at the four review widths
 * (1440 / 1024 / 768 / 375), measured (horizontal scroll, controls off-screen, broken images, clipped text, overlaps, small
 * targets) and shot as `U04_<row id>_<slug>_<width>.png`; the soft failures of `verifyUi` are the hard defects.
 *
 * FL-14-U1 walks the drawing floor (D1: env drawing after a finished fake-ML run, warped, provisional scale) and writes the scale
 * (success, then a failed apply after W2). FL-14-U2 is `[mocked response]` only for its loading step (#30 is held at the wire and then
 * continued to the real BE, never answered by the test); its other states are real: DF (framed drawing: the empty state, the only
 * way to it), Q (one framed drawing + 20 floors without one: the long all-floors report), V (a real pool viewer who is a member).
 *
 * Source (FE, this branch): SC ScaleCalibration.tsx · SCV …Canvas.tsx · SCP …Panel.tsx · USC useScaleCalibration.ts ·
 * SMR …MethodReference.tsx · ZoomCluster/MiniMap src/components/canvas · provisionalScale src/lib/viewmodel/provisionalScale.ts.
 *
 * ## Request budget per file run
 * - `POST /api/auth/login`: 2 owners + 2 flow sessions + 1 viewer = 5 (limit 120 / 60 s); refresh ≈ 1 per page load (≈ 90: four widths × states).
 * - Upload init (pool admin `p04-scale` bucket): D1 1, Q 1 = 2; pipeline runs 2; `POST /api/projects` 2, deleted in `finally`.
 * - #35 PUTs: 1 (F-008) + 1 refused (F-010) per width = 8; plus 4 for the report (B-022). Viewer: reads only.
 */
import { expect, test, type Page } from '@playwright/test';

import { ROUTES } from '../../e2e/fixtures/routes';
import { attachJson, captureEvidence } from './support/evidence';
import { closeSession, openSession, type Session } from './support/p03/P2';
import { addProjectMember, poolUser } from './support/phase03Seed';
import { verifyUi } from './support/ui-verify';
import {
  SCALE,
  btn,
  canvasOf,
  deleteSeededProject,
  dragLine,
  drawStandard,
  framedPng,
  handleEnd,
  lengthField,
  noticeOf,
  openOwner,
  openScale,
  panelOf,
  scopeRadio,
  seedD1,
  seedFloors,
  staleWrite,
  viewOf,
  type Owner,
} from './support/p04/P6';

const step = (id: string, title: string, body: () => Promise<void>): Promise<void> => test.step(`[${id}] ${title}`, body);
const dialogName = (n: number): string => `Áp tỷ lệ này cho ${String(n)} tầng có bản vẽ?`;
const apply = (page: Page) => btn(page, SCALE.apply);

let owner: Owner;

test.beforeAll(async () => {
  test.setTimeout(120_000);
  owner = await openOwner();
});

test.afterAll(async () => {
  await owner?.dispose();
});

test.describe('U04 UI verify — SCR-14 scale calibration (QA-04c P6)', () => {
  test('SCR-14 · FL-14-U1 · scale states on the drawing floor', async ({ browser }) => {
    test.setTimeout(900_000);
    const d1 = await seedD1(owner.api, '14-u1');
    const s: Session = await openSession(browser, owner.user);
    const { page } = s;
    const open = (after: (page: Page) => Promise<void> = async () => undefined) => async (p: Page): Promise<void> => {
      await openScale(p, d1.projectId, d1.floorId);
      await after(p);
    };
    try {
      await step('14-F-001', 'drawing loaded = the real default (provisional banner + warped notice + back / retry)', async () => {
        await verifyUi(page, 'U04_14-F-001_drawing-loaded', open(async (p) => {
          await expect(p.getByText(SCALE.warpedTitle, { exact: true })).toBeVisible();
          await expect(btn(p, SCALE.retry)).toBeVisible();
        }));
      });

      await step('14-F-009', 'provisional banner', async () => {
        await verifyUi(page, 'U04_14-F-009_provisional', open(async (p) => {
          await expect(p.getByText(SCALE.provisional, { exact: true })).toBeVisible();
        }));
      });

      await step('14-F-006', 'warped error with back / retry', async () => {
        await verifyUi(page, 'U04_14-F-006_warped', open(async (p) => {
          await expect(noticeOf(p).getByText(SCALE.warpedTitle, { exact: true })).toBeVisible();
          await expect(btn(noticeOf(p), SCALE.backToPreprocessing)).toBeVisible();
        }));
      });

      await step('14-F-002', 'panel collapsed', async () => {
        await verifyUi(page, 'U04_14-F-002_collapsed', open(async (p) => {
          await btn(p, SCALE.collapse).click();
          await expect(btn(p, SCALE.expand)).toBeVisible();
        }));
      });

      await step('14-F-003', 'reference line drawn + "Chiều dài thật" typed', async () => {
        await verifyUi(page, 'U04_14-F-003_line-and-length', open(async (p) => {
          await drawStandard(p);
          await expect(handleEnd(p)).toBeVisible();
        }));
      });

      await step('14-F-007', 'invalid length: the inline error', async () => {
        await verifyUi(page, 'U04_14-F-007_invalid-length', open(async (p) => {
          await drawStandard(p, 'abc');
          await expect(p.getByText(SCALE.realInvalid, { exact: true })).toBeVisible();
        }));
      });

      await step('14-F-004', 'A9 all-floors dialog', async () => {
        await verifyUi(page, 'U04_14-F-004_all-floors-dialog', open(async (p) => {
          await scopeRadio(p, SCALE.allFloors).click();
          await drawStandard(p);
          await apply(p).click();
          await expect(p.getByRole('dialog', { name: dialogName(1), exact: true })).toBeVisible();
        }), undefined, { fullPage: false });
      });

      await step('14-F-008', 'success after apply (badge "đã duyệt", verified notice)', async () => {
        await verifyUi(page, 'U04_14-F-008_success', open(async (p) => {
          await drawStandard(p);
          await apply(p).click();
          await expect(noticeOf(p).getByText(SCALE.successTitle, { exact: true })).toBeVisible();
          await expect(panelOf(p).getByText(SCALE.badge, { exact: true })).toBeVisible();
        }));
      });

      await step('14-F-010', 'apply failure in the panel footer', async () => {
        await verifyUi(page, 'U04_14-F-010_apply-failure', open(async (p) => {
          await staleWrite(owner.api, d1); // written after the screen loaded: its base is stale
          await drawStandard(p);
          await apply(p).click();
          await expect(panelOf(p).getByText(new RegExp(`^${SCALE.failed}`, 'u'))).toBeVisible();
        }));
      });

      await step('14-F-013', 'below 1024 px the panel sits under the canvas; ZoomCluster / MiniMap do not cover "Chiều dài thật" (BUG-333)', async () => {
        const overlaps: string[] = [];
        await verifyUi(page, 'U04_14-F-013_narrow-overlap', open(async (p) => {
          await drawStandard(p);
          const field = await lengthField(p).boundingBox();
          const width = p.viewportSize()?.width ?? 0;
          for (const name of ['Phóng to', 'Bấm để di chuyển vùng nhìn']) {
            const box = await btn(p, name).boundingBox();
            if (field !== null && box !== null) {
              const w = Math.min(field.x + field.width, box.x + box.width) - Math.max(field.x, box.x);
              const h = Math.min(field.y + field.height, box.y + box.height) - Math.max(field.y, box.y);
              if (w > 2 && h > 2) overlaps.push(`${String(width)}: "${name}" ∩ "Chiều dài thật" (${String(Math.round(w))}×${String(Math.round(h))})`);
            }
          }
          if (width < 1024) {
            const [canvas, panel] = [await canvasOf(p).boundingBox(), await panelOf(p).boundingBox()];
            if (canvas !== null && panel !== null) expect.soft(panel.y, `${String(width)}: the panel is below the canvas`).toBeGreaterThanOrEqual(canvas.y + canvas.height - 1);
          }
        }));
        await attachJson('U04_14-F-013_overlaps.json', { overlaps });
        expect.soft(overlaps, 'ZoomCluster / MiniMap over the "Chiều dài thật" field').toEqual([]); // SCP:63-66
      });

      await step('14-E-012', 'handles stay 10 px on screen at any zoom, and the hit area reaches 24 px (WCAG 2.5.8)', async () => {
        await open()(page);
        await page.setViewportSize({ width: 1440, height: 900 });
        await openScale(page, d1.projectId, d1.floorId);
        await dragLine(page, [0.4, 0.5], [0.6, 0.5]);
        const sizeOf = async (): Promise<{ w: number; h: number }> => {
          const box = await handleEnd(page).boundingBox();
          return { w: box?.width ?? 0, h: box?.height ?? 0 };
        };
        const base = await sizeOf();
        const frame = await canvasOf(page).boundingBox();
        if (frame === null) throw new Error('no frame');
        await page.mouse.move(frame.x + frame.width * 0.5, frame.y + frame.height * 0.5);
        for (let i = 0; i < 4; i += 1) await page.mouse.wheel(0, -300);
        await expect.poll(async () => (await viewOf(page)).zoom).toBeGreaterThan(1.3);
        // The zoom is a CSS transition on the content layer (ScaleCalibrationCanvas.tsx:337) while the handle's counter-scale is
        // not: measure only after the transition has finished, not mid-flight.
        await page.evaluate(() => Promise.all(document.getAnimations().map((a) => a.finished.catch(() => undefined))));
        const zoomed = await sizeOf();
        await attachJson('U04_14-E-012_handle-size.json', { base, zoomed, zoom: (await viewOf(page)).zoom });
        expect.soft(Math.abs(zoomed.w - base.w), 'handle width does not scale with the zoom').toBeLessThanOrEqual(1); // SCV:111-116
        expect.soft(Math.min(zoomed.w, zoomed.h), 'target size ≥ 24 px (WCAG 2.5.8)').toBeGreaterThanOrEqual(24);
        await captureEvidence(page, 'U04_14-E-012_handles-zoomed.png');
      });

      await step('14-C-039', 'the copy uses one spelling of "tỷ lệ" / "tỉ lệ" on one journey ⚑', async () => {
        await openScale(page, d1.projectId, d1.floorId);
        const text = await page.locator('body').innerText();
        const spellings = { y: /t[ỷ]\s+l[ệ]/iu.test(text), i: /t[ỉ]\s+l[ệ]/iu.test(text) };
        await attachJson('U04_14-C-039_spellings.json', spellings);
        expect.soft(spellings.y && spellings.i, 'both "tỷ lệ" and "tỉ lệ" on the same screen').toBe(false); // USC:207-219, provisionalScale.ts
        await captureEvidence(page, 'U04_14-C-039_spelling.png');
      });
    } finally {
      await closeSession(s);
      await deleteSeededProject(owner.api, d1.projectId);
    }
  });

  test('SCR-14 · FL-14-U2 · [mocked response] framed empty, viewer, no drawing, loading, long all-floors report', async ({ browser }) => {
    test.setTimeout(900_000);
    const floorNames = Array.from({ length: 21 }, (_, i) => `Tầng ${String(i + 1)}`);
    const q = await seedFloors(owner.api, '14-u2', floorNames, [{ index: 0, png: framedPng() }]); // DF + 20 floors without a drawing
    const drawn = q.floors[0]!;
    const bare = q.floors[1]!;
    const s: Session = await openSession(browser, owner.user);
    const { page } = s;
    let viewer: Session | undefined;
    try {
      await step('14-F-014', 'empty state on a framed drawing', async () => {
        await verifyUi(page, 'U04_14-F-014_empty', async (p) => {
          await openScale(p, q.projectId, drawn.id);
          await expect(noticeOf(p).getByText(SCALE.emptyTitle, { exact: true })).toBeVisible();
        });
      });

      await step('14-F-011', 'viewer: "Bạn không có quyền hiệu chỉnh tỷ lệ"', async () => {
        const admin = owner.api;
        const user = await poolUser(admin, 'viewer');
        await addProjectMember(admin, q.projectId, user.email);
        viewer = await openSession(browser, user);
        await verifyUi(viewer.page, 'U04_14-F-011_viewer', async (p) => {
          await openScale(p, q.projectId, drawn.id);
          await expect(noticeOf(p).getByText(SCALE.forbiddenTitle, { exact: true })).toBeVisible();
        });
      });

      await step('14-F-005', 'no-drawing error', async () => {
        await verifyUi(page, 'U04_14-F-005_no-drawing', async (p) => {
          await p.goto(ROUTES.project.scale(q.projectId, bare.id));
          await expect(noticeOf(p).getByText(SCALE.noDrawingTitle, { exact: true })).toBeVisible({ timeout: 45_000 });
        });
      });

      await step('14-F-012', 'loading skeletons (#30 held at the wire, continued afterwards)', async () => {
        let release = (): void => undefined;
        const gate = new Promise<void>((resolve) => {
          release = resolve;
        });
        await page.route(new RegExp(`/api/projects/${q.projectId}/floors/${drawn.id}/quality$`, 'u'), async (route) => {
          if (route.request().method() !== 'GET') return route.fallback();
          await gate;
          return route.continue().catch(() => undefined);
        });
        try {
          await verifyUi(page, 'U04_14-F-012_loading', async (p) => {
            await p.goto(ROUTES.project.scale(q.projectId, drawn.id));
            await expect(canvasOf(p).locator('.animate-pulse').first()).toBeVisible({ timeout: 45_000 }); // SCV:328-329, SCP:102-104
            await expect(panelOf(p).locator('.animate-pulse').first()).toBeVisible();
          });
        } finally {
          release();
          await page.unrouteAll({ behavior: 'ignoreErrors' });
        }
      });

      await step('14-B-022', 'all-floors report with many skipped floors (long text) wraps inside the panel', async () => {
        await verifyUi(page, 'U04_14-B-022_long-report', async (p) => {
          await openScale(p, q.projectId, drawn.id);
          await scopeRadio(p, SCALE.allFloors).click();
          await drawStandard(p);
          await apply(p).click();
          await p.getByRole('dialog').getByRole('button', { name: SCALE.allFloors, exact: true }).click();
          const report = panelOf(p).getByText(/^Đã áp tỷ lệ cho 1 tầng\. Bỏ qua vì chưa có bản vẽ: /u);
          await expect(report).toBeVisible({ timeout: 45_000 });
          const [box, panel] = [await report.boundingBox(), await panelOf(p).boundingBox()];
          if (box !== null && panel !== null) expect.soft(box.x + box.width, 'the report stays inside the panel').toBeLessThanOrEqual(panel.x + panel.width + 1);
        });
      });
    } finally {
      await closeSession(s);
      if (viewer !== undefined) await closeSession(viewer);
      await deleteSeededProject(owner.api, q.projectId);
    }
  });
});
