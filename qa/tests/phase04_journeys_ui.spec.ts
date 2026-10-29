/**
 * Phase 4 — X cross-screen journeys, UI-VERIFY layer (skill `qa-verify-ui`): one sequential flow (QA-04c P1, `flow-plan.md`
 * "phase04_journeys_ui.spec.ts"): FL-X-U1, the provisional / stacked banners of the drawing floor across the QC screens.
 * One `test.step('[<row id>] …')` per catalog row; each step is ONE screen state × the four review widths
 * (`support/ui-verify.ts` `verifyUi`: re-opens the state per width, measures layout defects, shoots
 * `U04_<row id>_<slug>_<width>.png`, attaches `U04_<row id>_<slug>.json`). `H` rows use a hard `expect`.
 *
 * Data: D1 (`createPipelineDrawingProject` as the POOL ADMIN `p04-journeys-ui`: own `drawings_init` bucket, one fake-ML run,
 * provisional scale, AI layer) + W2 (a second writer, `secondWriter`, only for the 409 banner of [17-F-010]). The browser
 * session is the pool admin. No mock, no clock. Request budget: 3 logins, 1 `POST /api/projects`, 1 `drawings_init`,
 * ≤ 4 second-writer PUTs (one per width of [17-F-010]).
 *
 * Source (FE `F:/App/AppFront/src`): PSB src/screens/qc/shared/ProvisionalScaleBanner.tsx · PSN …/provisionalScaleNotice.ts ·
 * FSB src/screens/qc/WallLayerReview/FloorLayerSaveBanner.tsx · RIF src/screens/qc/RoomLabelReview/RoomLabelInspector.tsx.
 */
import { expect, test, type Locator, type Page } from '@playwright/test';

import { ROUTES } from '../../e2e/fixtures/routes';
import { TOUR_APPEAR_TIMEOUT_MS, dismissTour } from '../../e2e/fixtures/tour';
import { PIPELINE_TIMEOUT_MS } from '../../e2e/fullstack/env';
import { signedInApi } from './support/api';
import { spaGo } from './support/p03/P11';
import { createPipelineDrawingProject, deleteSeededProject, envDrawingPng, poolUser } from './support/phase03Seed';
import {
  WALL,
  adminClient,
  approveButton,
  closeWallsRun,
  openWalls,
  openWallsRun,
  secondWriter,
  uiName,
  wallRows,
  type WallsRun,
} from './support/p04/P1';
import { waitForApi } from '../../e2e/fullstack/apiWatch';
import { layerRe } from './support/p04/P1';
import { verifyUi } from './support/ui-verify';

const PROVISIONAL = 'Tỷ lệ tạm — số đo chưa tin được, hãy hiệu chỉnh tỷ lệ.';
const banner = (page: Page): Locator => page.getByText(PROVISIONAL, { exact: true });

test.describe('E04 journeys — UI verification flow (QA-04c P1)', () => {
  test('SCR-X · FL-X-U1 · provisional / stacked banners on the drawing floor across QC screens', async ({ browser }) => {
    test.setTimeout(PIPELINE_TIMEOUT_MS + 420_000);
    const admin = await adminClient();
    let owner: Awaited<ReturnType<typeof signedInApi>> | undefined;
    let run: WallsRun | undefined;
    let projectId: string | undefined;
    try {
      const pool = await poolUser(admin, 'admin', 'p04-journeys-ui');
      owner = await signedInApi(pool.email, pool.password);
      const d1 = await createPipelineDrawingProject(owner, 'e04-x-u1', envDrawingPng());
      projectId = d1.projectId;
      run = await openWallsRun(browser, { who: pool, clock: false, acceptDialogs: true });
      const { page } = run;
      page.setDefaultTimeout(20_000);
      const onFloor = { projectId: d1.projectId, floorId: d1.floorId };

      await test.step('[16-F-013] Provisional scale banner on SCR-16', async () => {
        await verifyUi(page, uiName('16-F-013', 'provisional-walls'), async (p) => {
          await openWalls(p, onFloor.projectId, onFloor.floorId, { tour: false });
          await dismissTour(p, { waitMs: TOUR_APPEAR_TIMEOUT_MS });
          await expect(banner(p)).toBeVisible();
          await expect(p.getByRole('button', { name: 'Đặt tỷ lệ', exact: true })).toBeVisible();
        });
      });

      await test.step('[17-F-010] The 409 banner and the provisional banner stacked above the work area (SCR-17)', async () => {
        let opens = 0; // the 409 means nothing is saved: a different row per width keeps the approve button live
        await verifyUi(page, uiName('17-F-010', 'stacked-banners'), async (p) => {
          await openWalls(p, onFloor.projectId, onFloor.floorId, { tour: false });
          await dismissTour(p, { waitMs: TOUR_APPEAR_TIMEOUT_MS });
          await wallRows(p).nth(opens).click();
          opens += 1;
          // a distinct thickness per width: an identical write is a no-op (applied=false, no revision bump, so no 409)
          await secondWriter(owner!, onFloor.projectId, onFloor.floorId, (walls) =>
            walls.map((w, i) => (i === 0 ? { ...w, thicknessMm: 300 + 10 * opens } : w)),
          );
          const conflict = waitForApi(p, 'PUT', layerRe(onFloor.projectId, onFloor.floorId), [409]);
          await approveButton(p).click();
          await conflict;
          await spaGo(p, ROUTES.project.objects(onFloor.projectId, onFloor.floorId));
          await expect(p.getByRole('region', { name: 'Lớp đối tượng', exact: true })).toBeVisible({ timeout: 60_000 });
          await expect(p.getByRole('alert').filter({ hasText: WALL.conflict })).toBeVisible();
          await expect(banner(p)).toBeVisible();
        });
      });

      await test.step('[20-F-009] Provisional scale banner on SCR-20', async () => {
        await verifyUi(page, uiName('20-F-009', 'provisional-rooms'), async (p) => {
          await p.goto(ROUTES.project.rooms(onFloor.projectId, onFloor.floorId));
          await expect(p.getByLabel('Duyệt phòng', { exact: true }).first()).toBeVisible({ timeout: 60_000 });
          await expect(banner(p)).toBeVisible();
        });
      });

      // [20-F-016] BUG-329 (đệm đáy thẻ chi tiết phòng): L23 bỏ cột thanh tra phải, chi tiết nằm trong thẻ hỏi neo trên bản vẽ — không còn đối tượng.
      test.info().annotations.push({ type: 'skip', description: '[20-F-016] BUG-329: L23 đã bỏ thẻ chi tiết phòng ở cột phải' });

      await test.step('[21-F-012] Provisional banner on SCR-21', async () => {
        await verifyUi(page, uiName('21-F-012', 'provisional-thickness'), async (p) => {
          await p.goto(ROUTES.project.thickness(onFloor.projectId, onFloor.floorId));
          await expect(p.getByLabel('Độ dày tường', { exact: true }).first()).toBeVisible({ timeout: 60_000 });
          await expect(banner(p)).toBeVisible();
        });
      });
    } finally {
      await closeWallsRun(run);
      if (owner !== undefined && projectId !== undefined) await deleteSeededProject(owner, projectId);
      await owner?.dispose();
      await admin.dispose();
    }
  });
});
