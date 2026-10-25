/**
 * Phase 4 — SCR-21 thickness, dedicated UI-verification flow (skill `qa-verify-ui`; QA-04c P4, FL-21-U1). One test, one
 * `test.step('[<row id>] …')` per catalog row, each state shot at 1440 / 1024 / 768 / 375 by `verifyUi`
 * (`U04_<row id>_<slug>_<width>.png` + `.json`); extra measurements are attached as JSON.
 *
 * Source (FE, this branch): TV src/screens/qc/ThicknessStandardization/ThicknessStandardization.tsx · TBP …/ThicknessBatchPanel.tsx ·
 * TST …/ThicknessSegmentTable.tsx (drawer "Bảng từng đoạn tường") · TH …/ThicknessHistogram.tsx · TPC …/ThicknessPreviewCanvas.tsx ·
 * FSB src/screens/qc/WallLayerReview/FloorLayerSaveBanner.tsx · FLS src/screens/qc/shared/FloorLayerReadFailureScreen.tsx.
 *
 * Bản Z (S-21): the panel is the preview (groups never pre-ticked, "Đổi N đoạn" applies), no collapse toggle, no reapply
 * warning (reviewed walls never enter the batch). Rows of removed controls shoot the equivalent state.
 *
 * Data: ONE project of five floors made by the shared admin ("Tầng hỗn hợp" 260 x 3 + 340 + 220, "Tầng 340" 2 x 340 mm,
 * "Tầng đã duyệt" a reviewed + an unreviewed 260 mm wall, "Tầng chuẩn" 2 x 220 mm, "Tầng trống"); the pool viewer is made a
 * member. States that change the floor ([21-F-014] apply, [21-F-013] 409) re-write it through the API before each width
 * (`reseed`), so every width opens the same state. The 409 is a real one: a write elsewhere (the API re-write) between the
 * page's read and its apply. Mock: [21-F-010] only (the real N16 request is held, then released).
 *
 * Budget: 1 API login (beforeAll) + 2 browser sessions (admin, viewer); 1 project; ≈ 65 page loads (13 states x 4 widths + the
 * extra loads of the apply states); ≈ 8 API re-writes (#35).
 */
import { expect, test, type APIRequestContext, type Page } from '@playwright/test';

import { ROUTES } from '../../e2e/fixtures/routes';
import { signedInApi } from './support/api';
import { readAdminCredentials } from './support/auth';
import { attachJson } from './support/evidence';
import { addProjectMember, deleteSeededProject, poolUser } from './support/phase03Seed';
import { closeFlow, openFlow, type Flow } from './support/p03/P5';
import { holdFirst } from './support/p03/P4';
import { UI_VIEWPORTS, verifyUi } from './support/ui-verify';
import { reseed, thkUiProject, type Built } from './support/p04/P4';

const SCREEN = 'Chuẩn hoá độ dày tường';

let adminApi: APIRequestContext;

test.beforeAll(async () => {
  const admin = readAdminCredentials();
  adminApi = await signedInApi(admin.email, admin.password);
});

test.afterAll(async () => {
  await adminApi?.dispose();
});

const region = (page: Page) => page.getByRole('region', { name: SCREEN, exact: true });
const button = (page: Page, name: string) => region(page).getByRole('button', { name, exact: true });
const histogram = (page: Page) => page.getByRole('region', { name: 'Biểu đồ phân bố độ dày tường theo mi-li-mét', exact: true });
const toasts = (page: Page) => page.getByRole('region', { name: 'Thông báo', exact: true });
/** Group checkbox "Đồng ý đổi các đoạn {range} về {target} mm" (TBP). */
const acceptBox = (page: Page, target: number) => region(page).getByRole('checkbox', { name: new RegExp(`^Đồng ý đổi các đoạn .+ về ${target} mm$`, 'u') });
const changeBtn = (page: Page) => region(page).getByRole('button', { name: /^Đổi \d+ đoạn/u });
const drawer = (page: Page) => page.getByRole('dialog', { name: 'Bảng từng đoạn tường', exact: true });
async function openDetail(page: Page): Promise<void> {
  await region(page).getByRole('button', { name: /^Xem bảng từng đoạn \(\d+\)$/u }).click();
  await expect(drawer(page)).toBeVisible();
}

async function tick(box: ReturnType<typeof acceptBox>): Promise<void> {
  await box.focus();
  await box.page().keyboard.press('Space');
}

async function openFloor(page: Page, built: Built, index: number): Promise<void> {
  await page.goto(ROUTES.project.thickness(built.project.projectId, built.floorIds[index] as string));
  await expect(region(page)).toBeVisible();
  await expect(histogram(page)).toBeVisible();
}

test.describe('E04 SCR-21 thickness — UI verify (QA-04c P4)', () => {
  test('SCR-21 · FL-21-U1 · [mocked response] thickness states incl. viewer, 409 and loading', async ({ browser }) => {
    test.setTimeout(1_200_000);
    const built = await thkUiProject(adminApi, '21-U1');
    const viewer = await poolUser(adminApi, 'viewer');
    await addProjectMember(adminApi, built.project.projectId, viewer.email);
    let admin: Flow | undefined;
    let guest: Flow | undefined;
    try {
      admin = await openFlow(browser, readAdminCredentials(), { reducedMotion: true });
      const { page } = admin;
      // openFlow's own dialog listener only records, so Playwright never answers it: an apply leaves an autosave pending, the
      // next `goto('about:blank')` of verifyUi opens `beforeunload` and hangs 30 s (run p04-r1 phase04-ui :62). Leave the page.
      page.on('dialog', (dialog) => {
        void dialog.accept();
      });
      const layerRead = (u: URL, method: string): boolean => method === 'GET' && /\/spatial\/layer$/u.test(u.pathname);

      await test.step('[21-F-001] ⚑ histogram + groups: no clipped columns (BUG-394 / 405 / 406)', async () => {
        const metrics = await verifyUi(page, 'U04_21-F-001_histogram-groups', (p) => openFloor(p, built, 0));
        await attachJson('U04_21-F-001_clipped.json', { clipped: metrics.map((m) => ({ viewport: m.viewport, clipped: m.clipped })) });
        for (const m of metrics) expect.soft(m.clipped, `${m.viewport}: clipped columns`).toEqual([]);
      });

      await test.step('[21-F-002] group ticked: the panel shows the batch and "Đổi N đoạn"', async () => {
        await verifyUi(page, 'U04_21-F-002_batch-ticked', async (p) => {
          await openFloor(p, built, 0);
          await tick(acceptBox(p, 220));
          await expect(changeBtn(p)).toBeVisible();
        });
      });

      await test.step('[21-F-005] the batch with what stays out (the reviewed wall)', async () => {
        await verifyUi(page, 'U04_21-F-005_unchanged-list', async (p) => {
          await openFloor(p, built, 2);
          await tick(acceptBox(p, 220));
          await expect(region(p).getByText('1 đoạn về 1 nhóm chuẩn. 1 tường đã duyệt không nằm trong lô.', { exact: true })).toBeVisible();
        });
      });

      await test.step('[21-F-007] rows selected in the drawer: the action bar + the group picker', async () => {
        await verifyUi(page, 'U04_21-F-007_picker', async (p) => {
          await openFloor(p, built, 0);
          await openDetail(p);
          const rows = drawer(p).getByRole('checkbox', { name: /^Chọn dòng tường /u });
          await tick(rows.nth(0));
          await tick(rows.nth(1));
          await drawer(p).getByRole('button', { name: 'Đổi độ dày', exact: true }).click();
          await expect(drawer(p).getByText('Chọn nhóm áp cho 2 tường đã chọn:', { exact: true })).toBeVisible();
        });
      });

      await test.step('[21-F-009] the drawing is the main view: no collapse toggle, the legend floats on it', async () => {
        await verifyUi(page, 'U04_21-F-009_drawing', async (p) => {
          await openFloor(p, built, 0);
          await expect(button(p, 'Thu gọn khung xem trước')).toHaveCount(0);
          await expect(p.getByRole('list', { name: 'Chú giải độ dày tường', exact: true })).toBeVisible();
        });
      });

      await test.step('[21-F-014] after an apply: the toast + the flashing rows', async () => {
        await verifyUi(
          page,
          'U04_21-F-014_applied',
          async (p) => {
            await openFloor(p, built, 0);
            await reseed(adminApi, built, 0); // same state at every width; the page's own read is replaced below
            await openFloor(p, built, 0);
            await tick(acceptBox(p, 220));
            // The apply's autosave must land before the next width reseeds, or that reseed gets 409 (run p04-rr 18:32Z).
            const saved = p.waitForResponse(
              (r) => r.request().method() === 'PUT' && /\/spatial\/layer$/u.test(new URL(r.url()).pathname),
              { timeout: 15_000 },
            );
            await changeBtn(p).click();
            await expect(toasts(p).getByText('Chuẩn hoá độ dày 3 tường.', { exact: true })).toBeVisible();
            expect((await saved).status(), 'the apply is saved').toBe(200);
          },
          UI_VIEWPORTS,
          { fullPage: false },
        );
        await reseed(adminApi, built, 0);
      });

      await test.step('[21-F-004] the "all standard" state', async () => {
        await verifyUi(page, 'U04_21-F-004_all-standard', async (p) => {
          await openFloor(p, built, 3);
          await expect(region(p).getByText('Đã chuẩn hoá', { exact: true })).toBeVisible();
          await expect(region(p).getByText('Không còn đoạn nào cần đổi.', { exact: true })).toBeVisible(); // TB:nothingLeft
        });
      });

      await test.step('[21-F-006] reviewed walls out of the batch (was the reapply warning)', async () => {
        await verifyUi(page, 'U04_21-F-006_reviewed-out', async (p) => {
          await openFloor(p, built, 2);
          await expect(region(p).getByRole('button', { name: 'Chọn nhóm này (1 đoạn)', exact: true })).toBeVisible();
        });
      });

      await test.step('[21-F-003] ⚑ no wall (BUG-332 / 412)', async () => {
        await verifyUi(page, 'U04_21-F-003_no-wall', async (p) => {
          await p.goto(ROUTES.project.thickness(built.project.projectId, built.floorIds[4] as string));
          await expect(region(p)).toBeVisible();
          await expect(region(p).getByText('Chưa có đoạn tường nào để chuẩn hoá', { exact: true })).toBeVisible();
        });
      });

      await test.step('[21-F-011] the read-failure screen', async () => {
        await verifyUi(page, 'U04_21-F-011_read-failure', async (p) => {
          await p.goto(ROUTES.project.thickness(built.project.projectId, `L-QAE04MISSING${Date.now().toString(36).toUpperCase()}`));
          await expect(region(p).getByRole('alert').getByRole('heading', { name: 'Không mở được tầng này', exact: true })).toBeVisible();
        });
      });

      await test.step('[21-F-008] viewer: "Không có quyền sửa độ dày tường"', async () => {
        guest = await openFlow(browser, viewer, { reducedMotion: true });
        await verifyUi(guest.page, 'U04_21-F-008_viewer', async (p) => {
          await openFloor(p, built, 0);
          await expect(region(p).getByText('Không có quyền sửa độ dày tường', { exact: true })).toBeVisible();
          await expect(changeBtn(p)).toHaveCount(0);
          await expect(region(p).getByRole('button', { name: /^Chọn (cả \d+ nhóm|nhóm này)/u })).toHaveCount(0);
        });
      });

      await test.step('[21-F-013] the 409 reload banner (a write elsewhere between the read and the apply)', async () => {
        await verifyUi(
          page,
          'U04_21-F-013_conflict-banner',
          async (p) => {
            await openFloor(p, built, 0);
            await reseed(adminApi, built, 0); // the write elsewhere: the floor's revision moves on
            await tick(acceptBox(p, 220));
            await changeBtn(p).click();
            await expect(region(p).getByText('Tầng này vừa được sửa ở nơi khác. Tải lại để xem bản mới nhất.', { exact: true })).toBeVisible({ timeout: 15_000 });
          },
          UI_VIEWPORTS,
          { fullPage: false },
        );
      });

      await test.step('[21-F-010] [mocked response] loading (the real read is held)', async () => {
        let held: Awaited<ReturnType<typeof holdFirst>> | undefined;
        try {
          await verifyUi(page, 'U04_21-F-010_loading', async (p) => {
            await held?.release(); // the previous width's read goes on now; this width holds its own
            held = await holdFirst(p, layerRead);
            await p.goto(ROUTES.project.thickness(built.project.projectId, built.floorIds[0] as string));
            await held.seen;
            await expect(p.getByRole('region', { name: 'Đang tải biểu đồ phân bố độ dày', exact: true })).toHaveAttribute('aria-busy', 'true'); // TH:291-302
          });
        } finally {
          await held?.release();
        }
      });
    } finally {
      // a flow that never opened is undefined: closeFlow(undefined) would throw and mask the real failure
      if (admin !== undefined) await closeFlow(admin);
      if (guest !== undefined) await closeFlow(guest);
      await deleteSeededProject(adminApi, built.project.projectId);
    }
  });
});
