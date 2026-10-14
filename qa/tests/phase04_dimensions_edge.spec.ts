/**
 * Phase 4 — SCR-18 "Đọc kích thước OCR", EDGE layer, REAL stack: three sequential user flows (QA-04c P3, `flow-plan.md`
 * "phase04_dimensions_edge.spec.ts", FL-18-01..03). One `test()` per flow, one `test.step('[<row id>] …')` per catalog
 * row (catalog-C2.md, plus 14-A-003 / X4-A-022 from C4 / C5), in plan order. `H` rows hard `expect`, `S` rows
 * `expect.soft`; every step captures `E04_<row id>_<slug>.png`. ⚑ steps assert the CORRECT behaviour (red while the
 * bug is real).
 *
 * No mock: own projects through the real API (`layerSeed.createQcProject`: Q2 = layered floor + empty floor, Q3 = three
 * floors, two layered, Q1 = one layered floor), the env drawing through the real pipeline for FL-18-03 (D1, as the
 * file's pool admin `p04-p3`: own `drawings_init` bucket), the pool admin as a NON-member (404 project, K08), and an
 * anonymous context.
 *
 * Source (FE `F:/App/AppFront` master): DV DimensionOcrReview.tsx · DC DimensionOcrReview.container.tsx · UD
 * useDimensionOcrReview.ts · DG dimensionOcrReviewGateway.ts · DT dimensionOcrText.ts · DCV DimensionOcrCanvas.tsx · DK
 * DimensionOcrKeyboardMode.tsx (src/screens/qc/DimensionOcrReview/) · UAS src/hooks/useAutosave.ts · SLS
 * src/lib/autosave/spatialLayerSave.ts · UPT src/hooks/useProjectConfidenceThreshold.ts.
 *
 * Row moved (reported): [18-C-018] (plan: FL-18-02) needs dimension rows in the store on the SPA path, which only the N16
 * mock gives → it runs in FL-18-M6 (`phase04_dimensions_mocked_edge.spec.ts`). FL-18-02 keeps 3 of its 4 steps.
 *
 * ## Request budget per full run
 * - `POST /api/auth/login`: 1 admin API (beforeAll) + 3 admin flow sessions + 1 pool-admin API + 1 pool-admin session = 6.
 * - `POST /api/users/invitations`: 0 when the `admin:p04-p3` pool slot exists, else 1.
 * - `POST /api/projects` 4 (Q2, Q3, Q1, D1) + #35 PUT 4 + `DELETE` 4. Upload init 1 (`drawings_init` of the pool admin)
 *   + chunk + complete, one fake-ML run (≤ PIPELINE_TIMEOUT_MS).
 * - `POST /api/auth/refresh` ≈ 1 per page load (≈ 15).
 */
import { expect, test, type APIRequestContext, type Page } from '@playwright/test';

import { ROUTES } from '../../e2e/fixtures/routes';
import { dismissTour, TOUR_APPEAR_TIMEOUT_MS } from '../../e2e/fixtures/tour';
import { PIPELINE_TIMEOUT_MS, readBaseUrl } from '../../e2e/fullstack/env';
import { signedInApi } from './support/api';
import { readAdminCredentials } from './support/auth';
import { captureEvidence } from './support/evidence';
import { createQcProject, type LayerApi, type SeededFloor } from './support/layerSeed';
import { createPipelineDrawingProject, deleteSeededProject, envDrawingPng, poolUser } from './support/phase03Seed';
import { closeFlow, openFlow, writesSince, type Flow } from './support/p03/P5';
import { bogusFloorId, unknownProjectId } from './support/p03/P10';
import { markShell, shellKept, spaGo } from './support/p03/P11';
import { DIM, canvasFrame, errorAlert, keyboardSection, note, openDims, panel, region } from './support/p04/P3';

const SCALE_SCREEN = 'Màn hiệu chỉnh tỷ lệ'; // src/screens/pipeline/ScaleCalibration/ScaleCalibration.tsx:66
const FLOOR_MISSING = 'Không mở được tầng này'; // src/screens/qc/shared/floorLayerReadFailure.ts:21 FLOOR_MISSING_TITLE (BUG-326 screen; the sentence 'Tầng này không còn tồn tại.' is only its description, :23)
const PROJECT_NOT_FOUND = 'Không tìm thấy dự án này'; // ProjectSpatialGate.tsx:36
const N16_PATH = /^\/api\/projects\/[^/]+\/floors\/[^/]+\/spatial\/layer$/u;
const SLOT = 'p04-p3';

let adminApi: APIRequestContext;
let adminLayer: LayerApi;

test.beforeAll(async () => {
  const { email, password } = readAdminCredentials();
  adminApi = await signedInApi(email, password);
  adminLayer = { request: adminApi, headers: {} };
});

test.afterAll(async () => {
  await adminApi?.dispose();
});

const ev = (page: Page, row: string, slug: string, caption?: string): Promise<string> =>
  captureEvidence(page, `E04_${row}_${slug}.png`, caption === undefined ? {} : { caption });
const pathOf = (page: Page): string => new URL(page.url()).pathname;
const n16Gets = (flow: Flow, mark: number, floorId?: string): number =>
  flow.log
    .slice(mark)
    .filter((e) => e.method === 'GET' && N16_PATH.test(e.path) && (floorId === undefined || e.path.includes(`/floors/${floorId}/`))).length;

const floorAt = (floors: readonly SeededFloor[], index: number): SeededFloor => {
  const floor = floors[index];
  if (floor === undefined) throw new Error(`fixture: floor #${String(index)} missing`);
  return floor;
};

/** Seeds `floorNames` (first `layered` layered), opens an admin flow, runs `body`, cleans up. */
async function withSeed(
  browser: Parameters<typeof openFlow>[0],
  slug: string,
  floorNames: readonly string[],
  layered: number,
  body: (flow: Flow, floors: SeededFloor[]) => Promise<void>,
): Promise<void> {
  const floors = await createQcProject(adminLayer, slug, floorNames, layered);
  let flow: Flow | undefined;
  try {
    flow = await openFlow(browser, readAdminCredentials());
    await body(flow, floors);
  } finally {
    if (flow !== undefined) await closeFlow(flow);
    const problem = await deleteSeededProject(adminApi, floorAt(floors, 0).projectId);
    if (problem !== null) note(`cleanup: ${problem}`);
  }
}

test.describe('E04 SCR-18 dimension OCR review — real flows (QA-04c P3)', () => {
  test('SCR-18 · FL-18-01 · empty floor: empty state, keyboard mode without a row, dead zoom, names, link to the scale screen', async ({ browser }) => {
    test.setTimeout(180_000);
    await withSeed(browser, 'fl18-01', ['Tầng 1', 'Tầng trống'], 1, async (flow, floors) => {
      const { page } = flow;
      const floor = floorAt(floors, 1); // "Tầng trống": no layer, no drawing → N16 empty document
      const path = ROUTES.project.dimensions(floor.projectId, floor.floorId);
      const scalePath = ROUTES.project.scale(floor.projectId, floor.floorId);
      const mark = flow.log.length;
      let open = 0;

      await test.step('[18-E-001] names: region, section, canvas group, svg img (and background img alt) "Bản vẽ lớp kích thước OCR"', async () => {
        await openDims(page, floor.projectId, floor.floorId, path);
        open = flow.sent.length;
        await expect(region(page)).toBeVisible();
        await expect.soft(page.locator(`section[aria-label="${DIM.canvas}"]`)).toHaveCount(1);
        await expect.soft(canvasFrame(page)).toBeVisible();
        await expect.soft(canvasFrame(page).getByRole('img', { name: DIM.canvas, exact: true })).toHaveCount(1);
        const images = await canvasFrame(page).locator('img').count();
        if (images > 0) await expect.soft(canvasFrame(page).locator('img').first()).toHaveAttribute('alt', DIM.canvas);
        else note('18-E-001: this floor has no drawing, so no background <img>; its alt (DG:1007) is checked on the D1 floor in FL-18-03 [18-G-005].');
        await ev(page, '18-E-001', 'accessible_names');
      });

      await test.step('[18-B-002] empty: title, explanation and link "Hiệu chỉnh tỷ lệ"', async () => {
        await expect.soft(panel(page).getByText(DIM.emptyTitle, { exact: true })).toBeVisible();
        await expect.soft(panel(page).getByText(DIM.emptyDescription, { exact: true })).toBeVisible();
        await expect.soft(panel(page).getByRole('link', { name: DIM.toScale, exact: true })).toBeVisible();
        await ev(page, '18-B-002', 'empty_state');
      });

      await test.step('[18-C-024] ⚑ ZoomCluster buttons zoom the drawing', async () => {
        const scaleOf = (): Promise<number> =>
          canvasFrame(page).locator('svg[role="img"]').evaluate((svg) => (svg as SVGSVGElement).getScreenCTM()?.a ?? 1);
        const before = await scaleOf();
        await canvasFrame(page).getByRole('button', { name: DIM.zoomIn, exact: true }).click();
        // ⚑ DCV:223 `<ZoomCluster />` is uncontrolled: its own label changes, the drawing does not.
        expect.soft(await scaleOf(), '⚑ "Phóng to" scales the drawing layer').toBeGreaterThan(before);
        await ev(page, '18-C-024', 'zoom_dead');
      });

      await test.step('[18-A-019] keyboard mode with no row → stays in the panel footer with caption + off button', async () => {
        await page.getByRole('button', { name: DIM.keyboardOn, exact: true }).click();
        await expect.soft(panel(page).getByRole('region', { name: DIM.keyboardCaption, exact: true })).toBeVisible();
        await expect.soft(panel(page).getByRole('button', { name: DIM.keyboardOff, exact: true })).toBeVisible();
        await expect.soft(canvasFrame(page)).toBeVisible();
        await ev(page, '18-A-019', 'keyboard_mode_no_row');
      });

      await test.step('[18-A-021] "Tắt chế độ duyệt bàn phím" → back to the two-pane layout', async () => {
        await page.getByRole('button', { name: DIM.keyboardOff, exact: true }).click();
        await expect.soft(keyboardSection(page)).toHaveCount(0);
        await expect.soft(page.getByRole('button', { name: DIM.keyboardOn, exact: true })).toBeVisible();
        await expect.soft(panel(page)).toBeVisible();
        await ev(page, '18-A-021', 'keyboard_mode_off');
      });

      await test.step('[18-C-031] no request on keyboard-mode toggle (no list here: filter / selection need rows)', async () => {
        expect.soft(writesSince(flow, open), 'no write').toEqual([]);
        expect.soft(n16Gets(flow, mark), 'one GET N16 (the load)').toBe(1);
        note('18-C-031: an empty floor has no filter and no row; filter / selection without a request are walked in FL-18-M3 / FL-18-M6 (G-009).');
        await ev(page, '18-C-031', 'no_request_toggle');
      });

      await test.step('[18-A-024] empty-state link "Hiệu chỉnh tỷ lệ" → scale route of this floor', async () => {
        await expect.soft(panel(page).getByRole('link', { name: DIM.toScale, exact: true })).toHaveAttribute('href', scalePath);
        await ev(page, '18-A-024', 'link_href');
      });

      await test.step('[14-A-003] entry from the SCR-18 empty-state link (full load, `<a href>`)', async () => {
        await markShell(page);
        await panel(page).getByRole('link', { name: DIM.toScale, exact: true }).click();
        await expect.poll(() => pathOf(page)).toBe(scalePath);
        await expect.soft(page.getByRole('region', { name: SCALE_SCREEN, exact: true })).toBeVisible();
        expect.soft(await shellKept(page), 'a document load (the shell tag is gone)').toBe(false);
        await ev(page, '14-A-003', 'scale_from_dims_link');
      });

      await test.step('[X4-A-022] SCR-18 empty-state link → SCR-14 (full load)', async () => {
        const nav = await page.evaluate(() => {
          const entry = performance.getEntriesByType('navigation')[0] as PerformanceNavigationTiming | undefined;
          return { type: entry?.type ?? '', name: entry?.name ?? '' };
        });
        expect.soft(nav.type, 'navigation entry of the scale page').toBe('navigate');
        expect.soft(new URL(nav.name).pathname).toBe(scalePath);
        expect.soft(writesSince(flow, open), 'the journey writes nothing').toEqual([]);
        await ev(page, 'X4-A-022', 'journey_dims_to_scale', `navigation ${nav.type} ${nav.name}`);
      });
    });
  });

  test('SCR-18 · FL-18-02 · SPA from SCR-16: store reuse, no N16, other floor rows, hidden PUT', async ({ browser }) => {
    test.setTimeout(150_000);
    await withSeed(browser, 'fl18-02', ['Tầng 1', 'Tầng 2', 'Tầng 3'], 2, async (flow, floors) => {
      const { page } = flow;
      const f1 = floorAt(floors, 0);
      const f2 = floorAt(floors, 1);
      let mark = 0;

      await test.step('[18-A-002] entry from SCR-16 "Cây lớp" item "Kích thước" (SPA)', async () => {
        await page.goto(ROUTES.project.walls(f1.projectId, f1.floorId));
        await dismissTour(page, { waitMs: TOUR_APPEAR_TIMEOUT_MS });
        await expect(page.getByRole('tree', { name: 'Cây lớp', exact: true })).toBeVisible();
        await expect.poll(() => n16Gets(flow, 0, f1.floorId), { message: 'SCR-16 read N16' }).toBeGreaterThanOrEqual(1);
        mark = flow.log.length;
        await page.getByRole('tree', { name: 'Cây lớp', exact: true }).getByRole('treeitem', { name: 'Kích thước', exact: true }).click();
        await expect.poll(() => pathOf(page)).toBe(ROUTES.project.dimensions(f1.projectId, f1.floorId));
        await expect(region(page)).toBeVisible();
        await ev(page, '18-A-002', 'spa_entry_from_tree');
      });

      await test.step('[18-G-002] no GET N16 when the store already holds a graph (SPA entry)', async () => {
        await expect(panel(page).getByText(DIM.emptyTitle, { exact: true })).toBeVisible();
        expect.soft(n16Gets(flow, mark), 'GET N16 after the SPA entry').toBe(0);
        await ev(page, '18-G-002', 'no_n16_spa', `GET N16 since the tree click: ${String(n16Gets(flow, mark))}`);
      });

      await test.step('[18-C-016] ⚑ store holds floor 1 → SCR-18 of floor 2 reads floor 2', async () => {
        const before = flow.log.length;
        await spaGo(page, ROUTES.project.dimensions(f2.projectId, f2.floorId));
        await expect(region(page)).toBeVisible();
        // ⚑ C2 bug: DG:1110 returns whatever graph the store has (UD:424-434); no read of the route floor.
        await expect
          .configure({ soft: true })
          .poll(() => n16Gets(flow, before, f2.floorId), { message: '⚑ GET N16 of the route floor (floor 2)', timeout: 5_000 })
          .toBeGreaterThanOrEqual(1);
        note('18-C-016: the route change is client-side (spaGo, P11); SCR-18 has no floor nav of its own.');
        await ev(page, '18-C-016', 'stale_store_other_floor');
      });
    });
  });

  test('SCR-18 · FL-18-03 · unknown ids, non-member, anonymous, background and settings reads', async ({ browser }) => {
    test.setTimeout(Math.max(120_000, 2 * (60_000 + PIPELINE_TIMEOUT_MS)));
    const poolAdmin = await poolUser(adminApi, 'admin', SLOT);
    const poolApi = await signedInApi(poolAdmin.email, poolAdmin.password);
    let drawingProject = '';
    try {
      await withSeed(browser, 'fl18-03', ['Tầng 1'], 1, async (flow, floors) => {
        const { page } = flow;
        const floor = floorAt(floors, 0);
        const floorPrefix = floor.floorId.includes('_') ? floor.floorId.slice(0, floor.floorId.indexOf('_')) : 'flr';
        const missingFloor = bogusFloorId(floorPrefix);
        const missingProject = unknownProjectId();
        let floor404 = '';
        let project404 = '';

        await test.step('[18-B-006] N16 404 floor → ⚑ floor-missing screen (today: generic alert + "Thử lại")', async () => {
          await page.goto(ROUTES.project.dimensions(floor.projectId, missingFloor));
          await expect(errorAlert(page).or(page.getByText(FLOOR_MISSING, { exact: true })).first()).toBeVisible();
          const read = flow.log.filter((e) => e.method === 'GET' && N16_PATH.test(e.path)).at(-1);
          floor404 = `${String(read?.status)} ${String(read?.code)}`;
          // ⚑ BUG-326 class: the read-failure screen of SCR-16/17 (useFloorLayer.ts:31) was not applied to SCR-18 (UD:437,1019).
          await expect.soft(page.getByText(FLOOR_MISSING, { exact: true }), '⚑ floor-missing screen').toBeVisible();
          await ev(page, '18-B-006', 'n16_404_floor', `GET N16 → ${floor404}`);
        });

        await test.step('[18-B-007] N16 404 project → ⚑ project not-found screen ("Thử lại" only repeats the 404)', async () => {
          await page.goto(ROUTES.project.dimensions(missingProject, floor.floorId));
          await expect(errorAlert(page).or(page.getByText(PROJECT_NOT_FOUND, { exact: true })).first()).toBeVisible();
          const before = flow.log.length;
          const retry = errorAlert(page).getByRole('button', { name: DIM.retry, exact: true });
          if ((await retry.count()) > 0) {
            await retry.click();
            await expect.poll(() => n16Gets(flow, before)).toBeGreaterThanOrEqual(1);
            const again = flow.log.slice(before).find((e) => e.method === 'GET' && N16_PATH.test(e.path));
            note(`18-B-007: "Thử lại" re-sent GET N16 → ${String(again?.status)} (repeats the 404).`);
          }
          const read = flow.log.filter((e) => e.method === 'GET' && N16_PATH.test(e.path)).at(-1);
          project404 = `${String(read?.status)} ${String(read?.code)}`;
          // ⚑ BUG-326 class (UD:437): a project 404 shows the generic alert, not the project not-found screen.
          await expect.soft(page.getByText(PROJECT_NOT_FOUND, { exact: true }), '⚑ project not-found screen').toBeVisible();
          await ev(page, '18-B-007', 'n16_404_project', `GET N16 → ${project404}`);
        });

        await test.step('[18-G-003] N16 404 project / 404 floor → generic error', async () => {
          expect.soft(floor404.startsWith('404'), `404 floor read (${floor404})`).toBe(true);
          expect.soft(project404.startsWith('404'), `404 project read (${project404})`).toBe(true);
          await expect.soft(errorAlert(page)).toContainText(DIM.errorDescription);
          await ev(page, '18-G-003', 'n16_404_generic', `floor: ${floor404} · project: ${project404}`);
        });

        let pool: Flow | undefined;
        try {
          pool = await openFlow(browser, poolAdmin);
          const poolFlow: Flow = pool;
          const poolPage = poolFlow.page;

          await test.step('[18-D-009] non-member deep link → N16 404 project → ⚑ project not-found screen', async () => {
            await poolPage.goto(ROUTES.project.dimensions(floor.projectId, floor.floorId));
            await expect(errorAlert(poolPage).or(poolPage.getByText(PROJECT_NOT_FOUND, { exact: true })).first()).toBeVisible();
            const read = poolFlow.log.filter((e) => e.method === 'GET' && N16_PATH.test(e.path)).at(-1);
            // ⚑ BUG-326 class (UD:437, router.tsx:375): a non-member sees the generic "Không đọc được kích thước".
            await expect.soft(poolPage.getByText(PROJECT_NOT_FOUND, { exact: true }), '⚑ project not-found screen for a non-member').toBeVisible();
            await ev(poolPage, '18-D-009', 'non_member_404', `pool admin (not a member): GET N16 → ${String(read?.status)} ${String(read?.code)}`);
          });

          await test.step('[18-A-026] anonymous deep link → /login?next=…', async () => {
            const anon = await browser.newContext({ baseURL: readBaseUrl() });
            try {
              const anonPage = await anon.newPage();
              const target = ROUTES.project.dimensions(floor.projectId, floor.floorId);
              await anonPage.goto(target);
              await expect.poll(() => pathOf(anonPage)).toBe(ROUTES.login);
              expect.soft(new URL(anonPage.url()).searchParams.get('next')).toBe(target);
              await ev(anonPage, '18-A-026', 'anonymous_login_redirect');
            } finally {
              await anon.close();
            }
          });

          await test.step('[18-G-005] GET …/floors/{f}/spatial → drawings[0].url used for background and crops (D1)', async () => {
            const d1 = await createPipelineDrawingProject(poolApi, 'fl18-03-d1', envDrawingPng());
            drawingProject = d1.projectId;
            const mark = poolFlow.log.length;
            await openDims(poolPage, d1.projectId, d1.floorId, ROUTES.project.dimensions(d1.projectId, d1.floorId));
            await expect.poll(() => poolFlow.log.slice(mark).some((e) => e.method === 'GET' && e.path === `/api/projects/${d1.projectId}/floors/${d1.floorId}/spatial`)).toBe(true);
            const read = poolFlow.log.slice(mark).find((e) => e.method === 'GET' && e.path === `/api/projects/${d1.projectId}/floors/${d1.floorId}/spatial`);
            const url = ((read?.json as { drawings?: { url?: string }[] } | undefined)?.drawings?.[0]?.url) ?? '';
            expect(url, '#33 drawings[0].url').not.toBe('');
            const img = canvasFrame(poolPage).locator('img');
            await expect.soft(img).toHaveAttribute('src', url);
            await expect.soft(img).toHaveAttribute('alt', DIM.canvas);
            const crops = panel(poolPage).getByRole('img', { name: /^Cắt vùng gốc của chuỗi kích thước /u });
            const cropCount = await crops.count();
            if (cropCount > 0) expect.soft((await crops.first().getAttribute('style')) ?? '').toContain(url);
            else note('18-G-005: fake-ML OCR read no dimension on D1 (empty state) — crops not shown; background asserted.');
            await ev(poolPage, '18-G-005', 'background_from_33', `#33 drawings[0].url = ${url.slice(0, 120)} · crops: ${String(cropCount)}`);
          });

          await test.step('[18-G-007] GET /api/projects/{p}/settings → confidenceThreshold', async () => {
            const read = poolFlow.log.filter((e) => e.method === 'GET' && e.path === `/api/projects/${drawingProject}/settings`).at(-1);
            expect.soft(read?.status, 'GET settings 200').toBe(200);
            expect.soft(typeof (read?.json as { confidenceThreshold?: unknown } | undefined)?.confidenceThreshold).toBe('number');
            await ev(poolPage, '18-G-007', 'settings_threshold_read', `GET settings → ${String(read?.status)} confidenceThreshold ${String((read?.json as { confidenceThreshold?: unknown } | undefined)?.confidenceThreshold)}`);
          });
        } finally {
          if (pool !== undefined) await closeFlow(pool);
        }
      });
    } finally {
      if (drawingProject !== '') {
        const problem = await deleteSeededProject(poolApi, drawingProject);
        if (problem !== null) note(`cleanup D1: ${problem}`);
      }
      await poolApi.dispose();
    }
  });
});
