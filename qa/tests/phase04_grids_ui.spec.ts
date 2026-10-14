/**
 * Phase 4 — SCR-19 axes, dedicated UI-verification flow (skill `qa-verify-ui`; QA-04c P4, FL-19-U1). One test, one
 * `test.step('[<row id>] …')` per catalog row, each state shot at 1440 / 1024 / 768 / 375 by `verifyUi`
 * (`U04_<row id>_<slug>_<width>.png` + `.json`); extra measurements are attached as JSON.
 *
 * Source (FE, this branch): AGV src/screens/qc/AxisGridManager/AxisGridManager.tsx · ALP …/AxisGridLeftPanel.tsx ·
 * ACV …/AxisGridCanvas.tsx · AOP …/AxisGridOriginPanel.tsx · AFL …/AxisGridFloorAlignList.tsx · Toast.tsx · FLS
 * src/screens/qc/shared/FloorLayerReadFailureScreen.tsx.
 *
 * Data: ONE project of three floors ("Tầng 1" rectangle, "Tầng 2" the same rectangle shifted 200 mm, "Tầng trống"), made by
 * the shared admin, the pool viewer made a member. Mock: [19-F-011] only (the real N16 request is held, then released).
 * The 2-floor warning pair is entered through the floors screen (client-side hop), the way a 2-floor store exists at all.
 *
 * Budget: 1 API login (beforeAll) + 2 browser sessions (admin, viewer); 1 project; invitation 0 (shared viewer slot) or 1;
 * ≈ 60 page loads (4 widths × 14 states), each one `POST /api/auth/refresh`.
 */
import { expect, test, type APIRequestContext, type Page } from '@playwright/test';

import { ROUTES } from '../../e2e/fixtures/routes';
import { signedInApi } from './support/api';
import { readAdminCredentials } from './support/auth';
import { attachJson, captureEvidence } from './support/evidence';
import { addProjectMember, deleteSeededProject, poolUser } from './support/phase03Seed';
import { closeFlow, openFlow, type Flow } from './support/p03/P5';
import { holdFirst } from './support/p03/P4';
import { spaGo } from './support/p03/P11';
import { UI_VIEWPORTS, verifyUi } from './support/ui-verify';
import { CANVAS_LABEL, dragAxis, gridsUiProject, type Built } from './support/p04/P4';
import { leaveOnBeforeUnload } from './support/p04/P3';

const SCREEN = 'Quản lý trục và gốc toạ độ';
const H_GROUP = 'Trục ngang';
const V_GROUP = 'Trục dọc';

let adminApi: APIRequestContext;

test.beforeAll(async () => {
  const admin = readAdminCredentials();
  adminApi = await signedInApi(admin.email, admin.password);
});

test.afterAll(async () => {
  await adminApi?.dispose();
});

const region = (page: Page) => page.getByRole('region', { name: SCREEN, exact: true });
const group = (page: Page, title: string) => page.getByRole('listbox', { name: title, exact: true });

async function openFloor(page: Page, built: Built, index: number): Promise<void> {
  await page.goto(ROUTES.project.grids(built.project.projectId, built.floorIds[index] as string));
  await expect(region(page)).toBeVisible();
}

async function openRect(page: Page, built: Built): Promise<void> {
  await openFloor(page, built, 0);
  await expect(group(page, H_GROUP)).toBeVisible();
}

test.describe('E04 SCR-19 axes — UI verify (QA-04c P4)', () => {
  test('SCR-19 · FL-19-U1 · [mocked response] grid states incl. viewer and loading', async ({ browser }) => {
    test.setTimeout(900_000);
    const built = await gridsUiProject(adminApi, '19-U1');
    const viewer = await poolUser(adminApi, 'viewer');
    await addProjectMember(adminApi, built.project.projectId, viewer.email);
    let admin: Flow | undefined;
    let guest: Flow | undefined;
    try {
      admin = await openFlow(browser, readAdminCredentials());
      const { page } = admin;
      leaveOnBeforeUnload(page); // a dirty step raises beforeunload; verifyUi's goto('about:blank') hangs unless it is accepted
      const layerRead = (u: URL, method: string): boolean => method === 'GET' && /\/spatial\/layer$/u.test(u.pathname);

      await test.step('[19-F-001] preview list loaded', async () => {
        await verifyUi(page, 'U04_19-F-001_preview-list', (p) => openRect(p, built));
      });

      await test.step('[19-F-004] axis selected (row + canvas accent)', async () => {
        await verifyUi(page, 'U04_19-F-004_axis-selected', async (p) => {
          await openRect(p, built);
          await group(p, H_GROUP).getByRole('option').first().click();
          await expect(group(p, H_GROUP).getByRole('option').first()).toHaveAttribute('aria-selected', 'true'); // AGV, ACV:124
        });
      });

      await test.step('[19-F-002] axis added (in memory)', async () => {
        await verifyUi(page, 'U04_19-F-002_axis-added', async (p) => {
          await openRect(p, built);
          await p.getByRole('button', { name: 'Thêm trục ngang', exact: true }).click();
          await expect(group(p, H_GROUP).getByRole('option')).toHaveCount(3);
        });
      });

      await test.step('[19-F-006] axis hidden (eye off)', async () => {
        await verifyUi(page, 'U04_19-F-006_axis-hidden', async (p) => {
          await openRect(p, built);
          const eye = p.getByRole('button', { name: 'Ẩn trục A', exact: true });
          await eye.click();
          await expect(p.getByRole('button', { name: 'Hiện trục A', exact: true })).toHaveAttribute('aria-pressed', 'false'); // ALP:119-125
        });
      });

      await test.step('[19-F-007] anchor chosen (offset rows filled)', async () => {
        await verifyUi(page, 'U04_19-F-007_anchor-chosen', async (p) => {
          await openRect(p, built);
          await p.getByRole('combobox', { name: 'Chọn giao trục neo', exact: true }).click();
          await p.getByRole('option', { name: 'B-2', exact: true }).click();
          await expect(p.getByRole('combobox', { name: 'Chọn giao trục neo', exact: true })).toContainText('B-2'); // AOP:102-111
        });
      });

      await test.step('[19-F-005] spacing notice shown', async () => {
        await verifyUi(page, 'U04_19-F-005_spacing-notice', async (p) => {
          await openRect(p, built);
          await p.getByRole('button', { name: 'Thêm trục dọc', exact: true }).click();
          await expect(group(p, V_GROUP).getByRole('option')).toHaveCount(3);
          await dragAxis(p, '3', 'vertical', 9_000, 20); // snaps to the corner vertex = axis 2: distance 0 < 100
          await expect(region(p).locator('[role="status"]').filter({ hasText: /không thể đặt/u })).toBeVisible(); // AGV:234-238
        });
      });

      await test.step('[19-F-013] undo toast over the panels (375: top edge)', async () => {
        await verifyUi(
          page,
          'U04_19-F-013_undo-toast',
          async (p) => {
            await openRect(p, built);
            await p.getByRole('button', { name: 'Thêm trục dọc', exact: true }).click();
            await p.getByRole('button', { name: 'Xoá trục 3', exact: true }).click();
            await expect(p.getByRole('region', { name: 'Thông báo', exact: true }).getByText('Đã xoá trục 3.', { exact: true })).toBeVisible(); // Toast.tsx
          },
          UI_VIEWPORTS,
          { fullPage: false },
        );
      });

      await test.step('[19-F-012] ⚑ < 1024: columns stack, the canvas is 360 px high, no horizontal scroll (BUG-319 / BUG-404)', async () => {
        const metrics: Record<string, unknown>[] = [];
        await verifyUi(page, 'U04_19-F-012_stacked-layout', async (p) => {
          await openRect(p, built);
          const frame = p.locator(`section[aria-label="${CANVAS_LABEL}"]`);
          const left = group(p, H_GROUP);
          const [frameBox, leftBox] = [await frame.boundingBox(), await left.boundingBox()];
          metrics.push({
            width: p.viewportSize()?.width,
            canvasHeight: Math.round(frameBox?.height ?? 0),
            canvasWidth: Math.round(frameBox?.width ?? 0),
            stacked: leftBox !== null && frameBox !== null && frameBox.y >= leftBox.y + leftBox.height - 1,
            scrollsX: await p.evaluate(() => document.documentElement.scrollWidth > document.documentElement.clientWidth),
          });
        });
        await attachJson('U04_19-F-012_metrics.json', { metrics });
        for (const m of metrics) {
          if (Number(m['width']) < 1024) {
            expect.soft(m['stacked'], `${String(m['width'])}: the canvas sits below the list`).toBe(true); // AGV:244-252
            expect.soft(m['canvasHeight'], `${String(m['width'])}: the canvas frame is 360 px high`).toBe(360);
          }
          expect.soft(m['scrollsX'], `${String(m['width'])}: no horizontal page scroll`).toBe(false);
        }
      });

      await test.step('[19-E-012] focus ring visible on rows, eye / trash and the add buttons', async () => {
        await page.setViewportSize(UI_VIEWPORTS[0]);
        await openRect(page, built);
        await page.getByRole('button', { name: 'Thêm trục dọc', exact: true }).click(); // store, so the trash exists on every row
        const targets = [
          group(page, H_GROUP).getByRole('option').first(),
          page.getByRole('button', { name: 'Ẩn trục A', exact: true }),
          page.getByRole('button', { name: 'Xoá trục A', exact: true }),
          page.getByRole('button', { name: 'Thêm trục ngang', exact: true }),
        ];
        const rings: string[] = [];
        for (const target of targets) {
          await target.focus();
          await page.keyboard.press('Shift+Tab'); // a keyboard interaction: focus-visible applies
          await page.keyboard.press('Tab');
          const ring = await target.evaluate((node) => {
            const style = getComputedStyle(node);
            return `${style.outlineStyle}|${style.outlineWidth}|${style.boxShadow}`;
          });
          rings.push(ring);
          expect.soft(ring, 'a visible focus indicator (outline or ring shadow)').not.toMatch(/^none\|[^|]*\|none$/u); // ALP:105-108
        }
        await attachJson('U04_19-E-012_rings.json', { rings });
        await captureEvidence(page, 'U04_19-E-012_focus-ring_1440.png');
      });

      await test.step('[19-F-003] empty floor', async () => {
        await verifyUi(page, 'U04_19-F-003_empty-floor', async (p) => {
          await openFloor(p, built, 2);
          await expect(p.getByText('Chưa có trục nào', { exact: true })).toBeVisible();
        });
      });

      await test.step('[19-F-008] two floors with the warning banner + "Xem trên bản vẽ"', async () => {
        await verifyUi(page, 'U04_19-F-008_warning-banner', async (p) => {
          await p.goto(ROUTES.project.floors(built.project.projectId));
          await expect(p.getByRole('row', { name: /, cao độ /u })).toHaveCount(3);
          await spaGo(p, ROUTES.project.grids(built.project.projectId, built.floorIds[0] as string));
          await expect(group(p, H_GROUP)).toBeVisible();
          await p.getByRole('button', { name: 'Thêm trục dọc', exact: true }).click(); // F1 stored; F2 / F3 have no stored axes
          await expect(region(p).getByRole('alert').getByRole('button', { name: 'Xem trên bản vẽ', exact: true })).toBeVisible(); // AFL:144-155
        });
      });

      await test.step('[19-F-010] read failure (unknown floor)', async () => {
        await verifyUi(page, 'U04_19-F-010_read-failure', async (p) => {
          await p.goto(ROUTES.project.grids(built.project.projectId, `L-QAE04MISSING${Date.now().toString(36).toUpperCase()}`));
          await expect(p.getByRole('alert').getByRole('heading', { name: 'Không mở được tầng này', exact: true })).toBeVisible(); // FLS
        });
      });

      await test.step('[19-F-011] [mocked response] loading skeleton (the real read is held)', async () => {
        let held: Awaited<ReturnType<typeof holdFirst>> | undefined;
        try {
          await verifyUi(page, 'U04_19-F-011_loading', async (p) => {
            await held?.release(); // the previous width's read goes on now; this width holds its own
            held = await holdFirst(p, layerRead);
            await p.goto(ROUTES.project.grids(built.project.projectId, built.floorIds[0] as string));
            await held.seen;
            await expect(p.locator('div.flex.items-center.gap-4.p-3.w-full:has(> .animate-pulse)')).toHaveCount(6); // AGV:166-174
          });
        } finally {
          await held?.release();
        }
      });

      await test.step('[19-F-009] viewer: forbidden notice', async () => {
        guest = await openFlow(browser, viewer);
        leaveOnBeforeUnload(guest.page);
        await verifyUi(guest.page, 'U04_19-F-009_viewer-forbidden', async (p) => {
          await openRect(p, built);
          await expect(p.getByText('Không có quyền sửa trục', { exact: true })).toBeVisible(); // AGV:178-185
          await expect(p.getByRole('button', { name: 'Thêm trục ngang', exact: true })).toHaveCount(0);
        });
      });
    } finally {
      // a flow that never opened is undefined: closeFlow(undefined) would throw here and mask the real failure
      if (admin !== undefined) await closeFlow(admin);
      if (guest !== undefined) await closeFlow(guest);
      await deleteSeededProject(adminApi, built.project.projectId);
    }
  });
});
