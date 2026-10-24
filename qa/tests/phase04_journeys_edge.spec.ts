/**
 * Phase 4 — X cross-screen journeys, EDGE layer, REAL stack: four sequential flows (QA-04c P1, `flow-plan.md`
 * "phase04_journeys_edge.spec.ts"): FL-X-01 editor tour, FL-X-02 layer-tree hops / Back / Forward / reload, FL-X-03 provisional
 * scale banner → SCR-14 → Back, FL-X-04 /3d ↔ overlay. One `test()` per flow, one `test.step('[<row id>] …')` per catalog
 * row, in the planned order (one source-forced move, see below). `H` rows use a hard `expect`; `⚑` rows assert the CORRECT
 * behaviour and stay red while the app is wrong. Each step captures `E04_<row id>_<slug>.png`.
 *
 * Deviation from the planned order, named here and in the report: FL-X-03 runs [X4-A-021] and [21-B-010] (the banner on
 * SCR-17 / SCR-20 / SCR-21 and its hop) BEFORE [X4-A-019] (apply on SCR-14): a floor has ONE provisional scale, and the
 * apply clears the banner on every screen, so the later order could not show it. [14-A-004] (the hop from SCR-16/17/20/21)
 * stays second.
 *
 * Source (FE `F:/App/AppFront/src`, this branch): ET src/screens/system/EditorTour/ (UET useEditorTour.ts, ETV EditorTour.tsx)
 * · W src/screens/qc/WallLayerReview/ (WLP WallLayerLeftPanel.tsx) · OLP src/screens/qc/ObjectLayerReview/ObjectLayerLeftPanel.tsx
 * · UAS src/hooks/useAutosave.ts · SLS src/lib/autosave/spatialLayerSave.ts · CMT src/store/commit.ts · US
 * src/screens/pipeline/ScaleCalibration/useScaleCalibration.ts · UOC src/screens/viewer/OverlayComparison/useOverlayComparison.ts ·
 * OCT …/OverlayComparisonToolbar.tsx · V3C src/screens/viewer/Viewer3D/Viewer3D.container.tsx · PSB
 * src/screens/qc/shared/ProvisionalScaleBanner.tsx · PSN …/provisionalScaleNotice.ts · QK src/lib/query/queryKeys.ts ·
 * CP src/lib/query/cachePolicy.ts · UFL src/hooks/useFloorLayer.ts.
 *
 * ## Users and data
 * Projects are owned by the POOL ADMIN of this file (`poolUser(admin, 'admin', 'p04-journeys-edge')`, own `drawings_init` bucket;
 * the env admin is at ~57/60 per 600 s in a full run). FL-X-01 signs in as the FRESH pool engineer (`p04-fresh`, a member of
 * its two projects; a new browser context has no tour storage). D1 = `createPipelineDrawingProject` (env drawing after the
 * fake-ML run: provisional scale, AI layer); DM = a 2-floor project with the drawing on floor 1 only (floor 2 has no scan,
 * no geometry). Q-projects: `createQcProject`. Every project is deleted in `finally` by its owner.
 *
 * ## Request budget per full run
 * - `POST /api/auth/login`: per flow 1 owner API + 1 browser (+ 1 env admin API for the pool, + 1 fresh engineer in FL-X-01) ≈ 10.
 * - `drawings_init`: FL-X-01 1, FL-X-03 1, FL-X-04 1 = 3 (pool admin `p04-journeys-edge`); 3 fake-ML runs awaited in each seed.
 * - `POST /api/projects` 5; #35 PUT: ≈ 6 per D1 flow; `POST …/members` 3; no invitations once the pool slots exist (else 2).
 */
import { expect, test, type Locator, type Page } from '@playwright/test';

import { ROUTES } from '../../e2e/fixtures/routes';
import { TOUR_APPEAR_TIMEOUT_MS, TOUR_CHIP_NAME, TOUR_SKIP_NAME, dismissTour } from '../../e2e/fixtures/tour';
import { waitForApi } from '../../e2e/fullstack/apiWatch';
import { PIPELINE_TIMEOUT_MS } from '../../e2e/fullstack/env';
import { signedInApi } from './support/api';
import { attachJson } from './support/evidence';
import { writeLayer, qcLayer } from './support/layerSeed';
import { markShell, shellKept, spaGo } from './support/p03/P11';
import { framedPng } from './support/p03/P12';
import {
  addProjectMember,
  createDrawingProject,
  createPipelineDrawingProject,
  deleteSeededProject,
  envDrawingPng,
  poolUser,
  waitForRunOutcome,
  type PoolUser,
} from './support/phase03Seed';
import {
  WALL,
  adminClient,
  approveButton,
  asRecord,
  asRecords,
  canvasFrame,
  checkbox,
  closeWallsRun,
  codeOfLabel,
  waitForLayerPut,
  type Json,
  counter,
  ev,
  inspector,
  layerApiOf,
  layerPath,
  layerRe,
  openWalls,
  openWallsRun,
  pathOf,
  putsSince,
  quiet,
  readLayer,
  readWalls,
  rowLabels,
  seedQc,
  selectRow,
  selectedRows,
  statusBar,
  thickenFirst,
  secondWriter,
  thicknessGroup,
  wallOption,
  wallRows,
  writesSince,
  type WallsRun,
} from './support/p04/P1';
import type { APIRequestContext } from '@playwright/test';

const TOUR_PREFIX = 'appfront:system-editor-tour-seen:';
const TOUR_FIRST_TITLE = 'Chọn công cụ ở ray bên trái';
const TOUR_SUMMARY_TITLE = 'Bấy nhiêu phím là đủ dùng';
const TOUR_FINISH = 'Bắt đầu làm việc';
const PROVISIONAL = 'Tỷ lệ tạm — số đo chưa tin được, hãy hiệu chỉnh tỷ lệ.';
const CALIBRATE = 'Hiệu chỉnh tỷ lệ';

/** Pool admin of this file + the env admin client (pool bookkeeping only). */
async function ownerOf(slot: string): Promise<{ admin: APIRequestContext; pool: PoolUser; owner: APIRequestContext }> {
  const admin = await adminClient();
  const pool = await poolUser(admin, 'admin', slot);
  return { admin, pool, owner: await signedInApi(pool.email, pool.password) };
}

const tourCard = (page: Page, title = TOUR_FIRST_TITLE): Locator => page.getByRole('region', { name: title, exact: true });
const tourSkip = (page: Page): Locator => page.getByRole('button', { name: TOUR_SKIP_NAME, exact: true });
const tourChip = (page: Page): Locator => page.getByRole('button', { name: TOUR_CHIP_NAME, exact: true });
const tourDots = (page: Page): Locator => page.getByRole('group', { name: 'Tiến độ hướng dẫn', exact: true }).getByRole('button');

/** Stored tour flags of the page's origin: `{ key suffix → value }`. */
const tourFlags = (page: Page): Promise<Record<string, string>> =>
  page.evaluate((prefix) => {
    const found: Record<string, string> = {};
    for (const [key, value] of Object.entries(window.localStorage)) if (key.startsWith(prefix)) found[key.slice(prefix.length)] = value;
    return found;
  }, TOUR_PREFIX);

/** Forgets every tour flag, reloads the walls screen: the tour shows again. */
async function resetTour(page: Page, projectId: string, floorId: string): Promise<void> {
  await page.evaluate((prefix) => {
    for (const key of Object.keys(window.localStorage)) if (key.startsWith(prefix)) window.localStorage.removeItem(key);
  }, TOUR_PREFIX);
  await openWalls(page, projectId, floorId, { tour: false });
  await expect(tourCard(page)).toBeVisible({ timeout: TOUR_APPEAR_TIMEOUT_MS });
}

/** The N of "1 / N" on the tour card. */
async function tourLength(page: Page): Promise<number> {
  const text = (await tourCard(page).getByText(/^\d+ \/ \d+$/u).textContent()) ?? '';
  return Number(text.split('/')[1]?.trim());
}

/** Draws the SCR-14 reference line (20 % → 80 %), types `mm`, picks the scope; the apply button is NOT pressed. */
async function drawReference(page: Page, mm = 5_000, scope: 'Chỉ áp cho tầng này' | 'Áp cho mọi tầng' = 'Chỉ áp cho tầng này'): Promise<void> {
  const canvas = page.getByRole('group', { name: 'Bản vẽ đã nắn, kéo để vẽ đường tham chiếu', exact: true });
  await expect(canvas).toBeVisible({ timeout: PIPELINE_TIMEOUT_MS });
  const method = page.getByRole('radiogroup', { name: 'Chọn cách xác định tỷ lệ', exact: true }).getByRole('radio', { name: 'Vẽ đường tham chiếu', exact: true });
  await method.click();
  const box = await canvas.boundingBox();
  if (box === null) throw new Error('scale canvas has no bounding box');
  await page.mouse.move(box.x + box.width * 0.2, box.y + box.height * 0.5);
  await page.mouse.down();
  await page.mouse.move(box.x + box.width * 0.8, box.y + box.height * 0.5, { steps: 8 });
  await page.mouse.up();
  const length = page.getByLabel('Chiều dài thật', { exact: true });
  await length.fill(String(mm));
  await length.press('Enter');
  await expect(page.getByLabel('Phép tính ra tỷ lệ', { exact: true })).toContainText('mm/px');
  await page.getByRole('radiogroup', { name: 'Phạm vi áp tỷ lệ', exact: true }).getByRole('radio', { name: scope, exact: true }).click();
}
const applyScale = (page: Page): Locator => page.getByRole('button', { name: 'Áp dụng tỷ lệ', exact: true });
const bannerOf = (page: Page): Locator => page.getByText(PROVISIONAL, { exact: true });
const calibrateButton = (page: Page): Locator => page.getByRole('button', { name: CALIBRATE, exact: true });

test.describe('E04 journeys — real-stack flows (QA-04c P1)', () => {
  test('SCR-X · FL-X-01 · editor tour: first visit, skip, Esc, backdrop, steps, reopen, per host, screens without tour', async ({ browser }) => {
    test.setTimeout(PIPELINE_TIMEOUT_MS + 240_000);
    const { admin, owner } = await ownerOf('p04-journeys-edge');
    let run: WallsRun | undefined;
    const projects: string[] = [];
    try {
      const fresh = await poolUser(admin, 'engineer', 'p04-fresh');
      const d1 = await createPipelineDrawingProject(owner, 'e04-x-01', envDrawingPng());
      projects.push(d1.projectId);
      const q1 = await seedQc(owner, 'e04-x-01-q1');
      projects.push(q1.projectId);
      await addProjectMember(owner, d1.projectId, fresh.email);
      await addProjectMember(owner, q1.projectId, fresh.email);
      run = await openWallsRun(browser, { who: fresh, clock: false });
      const { page } = run;
      const writesMark = run.flow.sent.length;

      await test.step('[X4-A-010] First SCR-16 visit of a user: tour card "Chọn công cụ ở ray bên trái"; "Bỏ qua hướng dẫn" → chip "Xem hướng dẫn"; the flag is local', async () => {
        await openWalls(page, d1.projectId, d1.floorId, { tour: false });
        await expect(tourCard(page)).toBeVisible({ timeout: TOUR_APPEAR_TIMEOUT_MS });
        await expect.soft(tourCard(page).getByText(/^1 \/ \d+$/u)).toBeVisible();
        await expect.soft(tourSkip(page)).toBeVisible();
        await ev(page, 'X4-A-010', 'tour-first-visit');
        await tourSkip(page).click();
        await expect.soft(tourCard(page)).toHaveCount(0);
        await expect.soft(tourChip(page)).toBeVisible();
        const flags = await tourFlags(page);
        await attachJson('E04_X4-A-010_tour-flags.json', { flags });
        expect.soft(Object.values(flags), 'one stored flag, finished').toEqual(['true']);
      });

      await test.step('[16-A-079] "Bỏ qua hướng dẫn" closes the tour and is remembered; the chip "Xem hướng dẫn" reopens it', async () => {
        await tourChip(page).click();
        await expect.soft(tourCard(page)).toBeVisible();
        await tourSkip(page).click();
        await expect(tourCard(page)).toHaveCount(0);
        await page.reload();
        await expect(wallRows(page).first()).toBeVisible();
        expect.soft(await dismissTour(page, { waitMs: 2_000 }), 'no tour after a reload').toBe(false);
        await expect.soft(tourChip(page)).toHaveCount(0);
        await ev(page, '16-A-079', 'tour-remembered');
      });

      await test.step('[X4-G-001] The tour writes only localStorage (no request)', async () => {
        const mark = run!.flow.sent.length;
        await resetTour(page, d1.projectId, d1.floorId);
        const afterOpen = run!.flow.sent.length;
        await tourSkip(page).click();
        await tourChip(page).click();
        await tourSkip(page).click();
        const sent = run!.flow.sent.slice(afterOpen).filter((r) => !r.path.startsWith('/api/telemetry'));
        await attachJson('E04_X4-G-001_tour-requests.json', { sinceOpen: sent.map((r) => `${r.method} ${r.path}`), writesSinceStart: writesSince(run!, writesMark), openedAt: mark });
        expect.soft(sent.map((r) => `${r.method} ${r.path}`), 'requests caused by skip / chip / skip').toEqual([]);
        await ev(page, 'X4-G-001', 'tour-no-requests');
      });

      await test.step('[X4-A-012] Esc with the tour open skips it; the wall selection is not cleared by the same press', async () => {
        await resetTour(page, d1.projectId, d1.floorId);
        await page.keyboard.press('j'); // canvas-scope shortcuts work under the tour backdrop
        await expect(selectedRows(page)).toHaveCount(1);
        await page.keyboard.press('Escape');
        await expect.soft(tourCard(page)).toHaveCount(0);
        await expect.soft(tourChip(page)).toBeVisible();
        await expect.soft(selectedRows(page), 'the selection survives the Esc that skipped the tour').toHaveCount(1);
        await ev(page, 'X4-A-012', 'esc-skips-tour');
      });

      await test.step('[X4-A-013] Clicking the dark backdrop skips the tour; the clicked control is not activated', async () => {
        await resetTour(page, d1.projectId, d1.floorId);
        // A point on the backdrop outside the card and the cutout: the zoom "Phóng to" button, right of the canvas.
        const zoomIn = await page.getByRole('button', { name: 'Phóng to', exact: true }).boundingBox();
        if (zoomIn === null) throw new Error('zoom-in button has no box');
        await page.mouse.click(zoomIn.x + zoomIn.width / 2, zoomIn.y + zoomIn.height / 2);
        await expect.soft(tourCard(page)).toHaveCount(0);
        await expect.soft(tourChip(page)).toBeVisible();
        await expect.soft(page.getByRole('button', { name: /^Mức thu phóng 100%/u }), 'the control under the backdrop was not activated').toBeVisible();
        await ev(page, 'X4-A-013', 'backdrop-skips-tour');
      });

      await test.step('[X4-A-014] "Tiếp theo" through every step, then "Bắt đầu làm việc"; dots "Tới bước {n}: {title}" with aria-current "step"', async () => {
        await resetTour(page, d1.projectId, d1.floorId);
        const total = await tourLength(page);
        expect.soft(total, 'steps in the tour').toBeGreaterThanOrEqual(2);
        await expect.soft(tourDots(page)).toHaveCount(total);
        for (let i = 1; i <= total; i += 1) {
          await expect.soft(page.getByText(`${String(i)} / ${String(total)}`, { exact: true })).toBeVisible();
          await expect.soft(tourDots(page).nth(i - 1)).toHaveAttribute('aria-current', 'step');
          await expect.soft(tourDots(page).nth(i - 1)).toHaveAccessibleName(new RegExp(`^Tới bước ${String(i)}: `, 'u'));
          if (i === 1) {
            await ev(page, 'X4-A-014', 'tour-step-1');
            await tourDots(page).nth(Math.min(2, total - 1)).click(); // a dot jumps to its step
            await expect.soft(tourDots(page).nth(Math.min(2, total - 1))).toHaveAttribute('aria-current', 'step');
            await tourDots(page).nth(0).click();
          }
          await page.getByRole('button', { name: 'Tiếp theo', exact: true }).click();
        }
        await expect.soft(page.getByRole('region', { name: TOUR_SUMMARY_TITLE, exact: true })).toBeVisible();
        await ev(page, 'X4-A-014', 'tour-summary');
        await page.getByRole('button', { name: TOUR_FINISH, exact: true }).click();
        await expect.soft(page.getByRole('region', { name: TOUR_SUMMARY_TITLE, exact: true })).toHaveCount(0);
        expect.soft(Object.values(await tourFlags(page))).toEqual(['true']);
      });

      await test.step('[X4-A-015] ⚑ "Xem hướng dẫn" reopens the tour at the stopped step', async () => {
        await resetTour(page, d1.projectId, d1.floorId);
        const total = await tourLength(page);
        const stopAt = Math.min(3, total);
        await tourDots(page).nth(stopAt - 1).click();
        await expect(page.getByText(`${String(stopAt)} / ${String(total)}`, { exact: true })).toBeVisible();
        await tourSkip(page).click();
        await tourChip(page).click();
        // UET onReopen resets the active step; the catalog says the chip resumes where the user stopped.
        await expect.soft(page.getByText(`${String(stopAt)} / ${String(total)}`, { exact: true })).toBeVisible();
        await ev(page, 'X4-A-015', 'tour-reopen-stopped-step');
        await tourSkip(page).click();
      });

      await test.step('[X4-A-011] Second visit (any floor, any project, same user): no tour', async () => {
        await openWalls(page, q1.projectId, q1.floors[0]!.id, { tour: false });
        await expect(wallRows(page).first()).toBeVisible();
        expect.soft(await dismissTour(page, { waitMs: 2_500 }), 'no tour on another project').toBe(false);
        await openWalls(page, d1.projectId, d1.floorId, { tour: false });
        expect.soft(await dismissTour(page, { waitMs: 2_500 }), 'no tour on the first project either').toBe(false);
        await ev(page, 'X4-A-011', 'tour-not-again');
      });

      await test.step('[X4-A-017] SCR-14/17/18/19/20/21/22 mount no tour', async () => {
        await page.evaluate((prefix) => {
          for (const key of Object.keys(window.localStorage)) if (key.startsWith(prefix)) window.localStorage.removeItem(key);
        }, TOUR_PREFIX);
        const screens: readonly (readonly [string, string, string])[] = [
          ['SCR-17', ROUTES.project.objects(d1.projectId, d1.floorId), 'Lớp đối tượng'],
          ['SCR-18', ROUTES.project.dimensions(d1.projectId, d1.floorId), 'Đọc kích thước OCR'],
          ['SCR-19', ROUTES.project.grids(d1.projectId, d1.floorId), 'Quản lý trục và gốc toạ độ'],
          ['SCR-20', ROUTES.project.rooms(d1.projectId, d1.floorId), 'Duyệt tên phòng'],
          ['SCR-21', ROUTES.project.thickness(d1.projectId, d1.floorId), 'Chuẩn hoá độ dày tường'],
          ['SCR-14', ROUTES.project.scale(d1.projectId, d1.floorId), 'Màn hiệu chỉnh tỷ lệ'],
          ['SCR-22', ROUTES.project.overlay(d1.projectId, d1.floorId), 'Màn đối chiếu bản vẽ'],
        ];
        const seen: Record<string, number> = {};
        for (const [name, route, label] of screens) {
          await page.goto(route);
          await expect(page.getByLabel(label, { exact: true }).first(), `${name} painted`).toBeVisible({ timeout: 60_000 });
          seen[name] = await tourSkip(page).count();
          expect.soft(seen[name], `${name}: "Bỏ qua hướng dẫn" present`).toBe(0);
        }
        await attachJson('E04_X4-A-017_screens-without-tour.json', { skipButtons: seen });
        await ev(page, 'X4-A-017', 'no-tour-elsewhere');
      });

      await test.step('[X4-A-016] Tour flags are per host: finishing on SCR-16 shows no tour on /3d (Pascal viewer, no tour host) but still on export', async () => {
        await resetTour(page, d1.projectId, d1.floorId);
        await tourSkip(page).click(); // the SCR-16 host is now finished
        await page.goto(ROUTES.project.viewer(d1.projectId));
        const on3d = await dismissTour(page, { waitMs: 20_000 });
        expect.soft(on3d, 'no tour on /3d').toBe(false);
        await page.goto(ROUTES.project.export(d1.projectId));
        const onExport = await dismissTour(page, { waitMs: 20_000 });
        expect.soft(onExport, 'the tour shows on export').toBe(true);
        await attachJson('E04_X4-A-016_tour-hosts.json', { viewer: on3d, export: onExport, flags: await tourFlags(page) });
        await ev(page, 'X4-A-016', 'tour-per-host');
      });
    } finally {
      await closeWallsRun(run);
      for (const id of projects) await deleteSeededProject(owner, id);
      await owner.dispose();
      await admin.dispose();
    }
  });

  test('SCR-X · FL-X-02 · layer-tree hops, Back / Forward, caches, floor nav after a deep link, reload on every route, unknown floor', async ({ browser }) => {
    test.setTimeout(240_000);
    const api = await adminClient();
    let run: WallsRun | undefined;
    let projectId: string | undefined;
    try {
      const q2 = await seedQc(api, 'e04-x-02', ['Tầng 1', 'Tầng trống'], 1);
      projectId = q2.projectId;
      const one = q2.floors[0]!;
      run = await openWallsRun(browser, { clock: false });
      const { page } = run;
      const tree = (): Locator => page.getByRole('tree', { name: WALL.tree, exact: true });
      const hop = async (label: string): Promise<void> => {
        await tree().getByRole('treeitem', { name: label, exact: true }).click();
      };
      const layerReads = (floorId: string): number => run!.reads.filter((path) => path.includes(`/floors/${floorId}/`)).length;
      const hops: readonly (readonly [string, string])[] = [
        ['Cửa và nội thất', ROUTES.project.objects(q2.projectId, one.id)],
        ['Kích thước', ROUTES.project.dimensions(q2.projectId, one.id)],
        ['Trục', ROUTES.project.grids(q2.projectId, one.id)],
        ['Phòng', ROUTES.project.rooms(q2.projectId, one.id)],
      ];

      await test.step('[X4-A-004] Back after each tree hop returns to SCR-16 with the list restored, no write, no second tour', async () => {
        await openWalls(page, q2.projectId, one.id);
        const rows = await rowLabels(page);
        await markShell(page);
        const mark = run!.flow.sent.length;
        for (const [label, route] of hops) {
          await hop(label);
          await expect.poll(() => pathOf(page), { message: `hop "${label}"` }).toBe(route);
          await page.goBack();
          await expect.poll(() => pathOf(page)).toBe(ROUTES.project.walls(q2.projectId, one.id));
          await expect(wallRows(page).first()).toBeVisible();
          expect.soft(await rowLabels(page), `list restored after "${label}"`).toEqual(rows);
          expect.soft(await tourSkip(page).count(), 'no second tour').toBe(0);
        }
        expect.soft(await shellKept(page), 'SPA history: no document reload').toBe(true);
        expect.soft(writesSince(run!, mark), 'hops write nothing').toEqual([]);
        await ev(page, 'X4-A-004', 'back-after-hops');
      });

      await test.step('[X4-A-005] The "Tường" treeitem is the current item: aria-current "page", aria-selected true; clicking it does nothing', async () => {
        const walls = tree().getByRole('treeitem', { name: 'Tường', exact: true });
        await expect.soft(walls).toHaveAttribute('aria-current', 'page');
        await expect.soft(walls).toHaveAttribute('aria-selected', 'true');
        const mark = run!.flow.sent.length;
        await walls.click();
        expect.soft(pathOf(page)).toBe(ROUTES.project.walls(q2.projectId, one.id));
        expect.soft(run!.flow.sent.length - mark, 'requests caused by the click').toBe(0);
        await ev(page, 'X4-A-005', 'walls-treeitem-current');
      });

      await test.step('[X4-A-006] SCR-17 "Cây lớp" items are visibility toggles, not navigation', async () => {
        await hop('Cửa và nội thất');
        await expect.poll(() => pathOf(page)).toBe(ROUTES.project.objects(q2.projectId, one.id));
        const objectsTree = page.getByRole('tree', { name: 'Cây lớp', exact: true });
        const item = objectsTree.getByRole('treeitem', { name: 'Cửa đi', exact: true });
        await expect(item).toBeVisible();
        const eye = objectsTree.getByRole('button', { name: /^(Ẩn|Hiện) lớp cửa đi$/u });
        const before = await eye.getAttribute('aria-pressed');
        await item.click();
        expect.soft(pathOf(page), 'no route change').toBe(ROUTES.project.objects(q2.projectId, one.id));
        expect.soft(await eye.getAttribute('aria-pressed'), 'the click toggled the layer').not.toBe(before);
        await ev(page, 'X4-A-006', 'objects-tree-toggles');
      });

      await test.step('[X4-G-002] Layer-tree hops inside 30 s reuse the layer.byFloor / space.byFloor caches: no second N16 GET for the floor just read', async () => {
        await openWalls(page, q2.projectId, one.id);
        const before = layerReads(one.id);
        await markShell(page);
        await hop('Cửa và nội thất');
        await expect.poll(() => pathOf(page)).toBe(ROUTES.project.objects(q2.projectId, one.id));
        await expect(page.getByRole('region', { name: 'Lớp đối tượng', exact: true })).toBeVisible();
        const after = layerReads(one.id);
        await attachJson('E04_X4-G-002_cache-reads.json', { before, after });
        expect.soft(after - before, 'N16 GETs caused by the hop').toBe(0);
        await ev(page, 'X4-G-002', 'hop-reuses-cache');
      });

      await test.step('[X4-A-029] Back / Forward walls → objects → walls → Forward: no duplicate write, the cached N16 is reused inside 30 s', async () => {
        const reads = layerReads(one.id);
        const mark = run!.flow.sent.length;
        await page.goBack();
        await expect.poll(() => pathOf(page)).toBe(ROUTES.project.walls(q2.projectId, one.id));
        await page.goForward();
        await expect.poll(() => pathOf(page)).toBe(ROUTES.project.objects(q2.projectId, one.id));
        expect.soft(writesSince(run!, mark), 'history moves write nothing').toEqual([]);
        expect.soft(layerReads(one.id) - reads, 'N16 GETs caused by Back / Forward').toBe(0);
        await ev(page, 'X4-A-029', 'back-forward-cache');
      });

      await test.step('[X4-A-008] ⚑ After a deep link the floor nav lists every project floor', async () => {
        await openWalls(page, q2.projectId, one.id);
        const nav = page.getByRole('navigation', { name: WALL.floorNav, exact: true });
        const listed = await nav.getByRole('button').allInnerTexts();
        await attachJson('E04_X4-A-008_floor-nav.json', { listed });
        // C1/C4: the nav reads the levels already in the store, i.e. one floor after a deep link (nav hidden).
        expect.soft(listed.map((name) => name.trim()), 'every floor of the project').toEqual(['Tầng 1', 'Tầng trống']);
        await ev(page, 'X4-A-008', 'floor-nav-deep-link');
      });

      await test.step('[X4-A-028] Reload on each layer route keeps the route and renders the screen again (walls after an edit)', async () => {
        await selectRow(page, q2.codes.get(String(q2.walls[0]?.id)) as string);
        const put = waitForApi(page, 'PUT', layerRe(q2.projectId, one.id), [200]);
        await approveButton(page).click();
        await put;
        const routes: readonly (readonly [string, string, string])[] = [
          ['walls', ROUTES.project.walls(q2.projectId, one.id), 'Duyệt lớp tường'],
          ['objects', ROUTES.project.objects(q2.projectId, one.id), 'Lớp đối tượng'],
          ['dimensions', ROUTES.project.dimensions(q2.projectId, one.id), 'Đọc kích thước OCR'],
          ['grids', ROUTES.project.grids(q2.projectId, one.id), 'Quản lý trục và gốc toạ độ'],
          ['rooms', ROUTES.project.rooms(q2.projectId, one.id), 'Duyệt tên phòng'],
          ['thickness', ROUTES.project.thickness(q2.projectId, one.id), 'Chuẩn hoá độ dày tường'],
          ['scale', ROUTES.project.scale(q2.projectId, one.id), 'Màn hiệu chỉnh tỷ lệ'],
          ['overlay', ROUTES.project.overlay(q2.projectId, one.id), 'Màn đối chiếu bản vẽ'],
        ];
        const outcome: Record<string, string> = {};
        for (const [name, route, label] of routes) {
          await page.goto(route);
          await expect(page.getByLabel(label, { exact: true }).first(), `${name} painted`).toBeVisible();
          await page.reload();
          await expect(page.getByLabel(label, { exact: true }).first(), `${name} after a reload`).toBeVisible();
          outcome[name] = pathOf(page);
          expect.soft(pathOf(page), `${name} keeps its route`).toBe(route);
        }
        await page.goto(ROUTES.project.walls(q2.projectId, one.id));
        await dismissTour(page, { waitMs: 2_000 });
        await expect.soft(wallOption(page, q2.codes.get(String(q2.walls[0]?.id)) as string)).toHaveAccessibleName(new RegExp(`— ${WALL.reviewed}$`, 'u'));
        await attachJson('E04_X4-A-028_reload-routes.json', outcome);
        await ev(page, 'X4-A-028', 'reload-every-route');
      });

      await test.step('[X4-A-036] An unknown floor id across the layer screens gives three different answers', async () => {
        const missing = `L-QAXMISSING${Date.now().toString(36).toUpperCase()}`;
        const answers: Record<string, string> = {};
        const read = async (route: string, region: Locator): Promise<string> => {
          await page.goto(route);
          await expect(region).toBeVisible({ timeout: 30_000 });
          // The overlay region exists while it still loads: read the settled answer, not the "Đang tải …" frame (RF 2026-10-15
          // read "Đang tải ảnh bản vẽ gốc." under a loaded stack; green when idle).
          await expect(region).not.toContainText(/Đang tải/u, { timeout: 30_000 });
          return ((await region.innerText()) ?? '').replace(/\s+/gu, ' ').trim();
        };
        answers.walls = await read(ROUTES.project.walls(q2.projectId, missing), page.getByRole('alert').filter({ hasText: 'Tầng này không còn tồn tại.' }));
        answers.scale = await read(ROUTES.project.scale(q2.projectId, missing), page.getByRole('region', { name: 'Màn hiệu chỉnh tỷ lệ', exact: true })); // unknown floor: the read-failure screen replaces the working screen inside this region (ScaleCalibration.tsx:186-192); the status region exists only on the working screen
        answers.overlay = await read(ROUTES.project.overlay(q2.projectId, missing), page.getByRole('region', { name: 'Màn đối chiếu bản vẽ', exact: true }));
        await attachJson('E04_X4-A-036_unknown-floor.json', answers);
        expect.soft(answers.walls).toContain('Tầng này không còn tồn tại.');
        // Expectation changed (BUG-326, floorLayerReadFailure.ts:1-3): every QC/overlay screen now shows the SAME shared
        // "Không mở được tầng này" screen for a missing floor, not three different answers.
        for (const [name, text] of Object.entries(answers)) {
          expect.soft(text, `${name} says the floor no longer exists`).toContain('Tầng này không còn tồn tại.');
        }
        expect.soft(answers.scale, 'scale shows the shared way out').toContain('Về quản lý tầng');
        expect.soft(answers.overlay, 'overlay shows the shared way out').toContain('Về quản lý tầng');
        await ev(page, 'X4-A-036', 'unknown-floor-three-answers');
      });
    } finally {
      await closeWallsRun(run);
      if (projectId !== undefined) await deleteSeededProject(api, projectId);
      await api.dispose();
    }
  });

  test('SCR-X · FL-X-03 · provisional banner → scale → Back, rescale, pending edit + scale, undo, cache collisions, 409 block', async ({ browser }) => {
    test.setTimeout(PIPELINE_TIMEOUT_MS + 420_000);
    const { admin, pool, owner } = await ownerOf('p04-journeys-edge');
    let run: WallsRun | undefined;
    let projectId: string | undefined;
    try {
      // D1 + W2: the env drawing after the fake-ML run (provisional scale, AI layer); the second writer is `secondWriter`.
      const d1 = await createPipelineDrawingProject(owner, 'e04-x-03', envDrawingPng());
      projectId = d1.projectId;
      run = await openWallsRun(browser, { who: pool });
      const { page } = run;
      const onFloor = { projectId: d1.projectId, floorId: d1.floorId };
      const on = (route: string): Promise<void> => spaGo(page, route);
      const screens = {
        objects: ROUTES.project.objects(d1.projectId, d1.floorId),
        rooms: ROUTES.project.rooms(d1.projectId, d1.floorId),
        thickness: ROUTES.project.thickness(d1.projectId, d1.floorId),
        scale: ROUTES.project.scale(d1.projectId, d1.floorId),
        walls: ROUTES.project.walls(d1.projectId, d1.floorId),
        dimensions: ROUTES.project.dimensions(d1.projectId, d1.floorId),
        overlay: ROUTES.project.overlay(d1.projectId, d1.floorId),
        quality: ROUTES.project.quality(d1.projectId),
        pipeline: ROUTES.project.pipeline(d1.projectId),
      } as const;
      const scaleScreen = (): Locator => page.getByLabel('Màn hiệu chỉnh tỷ lệ', { exact: true }).first();
      const wallsBack = async (): Promise<void> => {
        await expect.poll(() => pathOf(page)).toBe(screens.walls);
        await expect(wallRows(page).first()).toBeVisible();
      };
      const screenLabels: Record<'objects' | 'rooms' | 'thickness', string> = { objects: 'Lớp đối tượng', rooms: 'Duyệt tên phòng', thickness: 'Chuẩn hoá độ dày tường' };
      let scaleBefore: unknown;
      let wallsBefore: Json[] = [];

      await test.step('[X4-A-018] The provisional banner on SCR-16: "Hiệu chỉnh tỷ lệ" opens SCR-14 of the same floor (SPA)', async () => {
        await openWalls(page, onFloor.projectId, onFloor.floorId);
        await expect(bannerOf(page)).toBeVisible();
        await markShell(page);
        await calibrateButton(page).click();
        await expect.poll(() => pathOf(page)).toBe(screens.scale);
        expect.soft(await shellKept(page), 'a client-side route change').toBe(true);
        await expect.soft(scaleScreen()).toBeVisible({ timeout: PIPELINE_TIMEOUT_MS });
        await ev(page, 'X4-A-018', 'banner-to-scale');
      });

      await test.step('[14-A-004] The banner action "Hiệu chỉnh tỷ lệ" on SCR-16 / 17 / 20 / 21 (SPA) opens SCR-14', async () => {
        await page.goBack();
        await wallsBack();
        for (const name of ['objects', 'rooms', 'thickness'] as const) {
          await on(screens[name]);
          await expect(page.getByLabel(screenLabels[name], { exact: true }).first(), name).toBeVisible({ timeout: 60_000 });
          await expect(bannerOf(page), `banner on ${name}`).toBeVisible();
          await calibrateButton(page).click();
          await expect.poll(() => pathOf(page), { message: `hop from ${name}` }).toBe(screens.scale);
          await page.goBack();
          await expect.poll(() => pathOf(page)).toBe(screens[name]);
        }
        await ev(page, '14-A-004', 'hops-from-17-20-21');
      });

      await test.step('[X4-A-021] The same banner and hop from SCR-17, SCR-20 and SCR-21', async () => {
        for (const name of ['objects', 'rooms', 'thickness'] as const) {
          await on(screens[name]);
          await expect(page.getByLabel(screenLabels[name], { exact: true }).first()).toBeVisible({ timeout: 60_000 });
          await expect.soft(bannerOf(page), `banner text on ${name}`).toBeVisible();
          await expect.soft(calibrateButton(page), `action on ${name}`).toBeVisible();
        }
        await ev(page, 'X4-A-021', 'banner-on-three-screens');
      });

      await test.step('[21-B-010] SCR-21: the provisional banner + "Hiệu chỉnh tỷ lệ"', async () => {
        await on(screens.thickness);
        await expect(bannerOf(page)).toBeVisible();
        await ev(page, '21-B-010', 'thickness-banner');
        await calibrateButton(page).click();
        await expect.poll(() => pathOf(page)).toBe(screens.scale);
      });

      await test.step('[X4-A-019] Apply on SCR-14, Back → SCR-16: the banner is gone (scaleSent drops scaleStatus)', async () => {
        await on(screens.walls);
        await wallsBack();
        wallsBefore = await readWalls(owner, d1.projectId, d1.floorId);
        scaleBefore = asRecord((await readLayer(owner, d1.projectId, d1.floorId)).level, 'level').scaleMillimetresPerPixel;
        // One wall is human-reviewed first: the rescale rule leaves it alone ([X4-A-020]).
        await wallRows(page).first().click();
        const approved = waitForLayerPut(page, onFloor.projectId, onFloor.floorId);
        await approveButton(page).click();
        await approved;
        wallsBefore = await readWalls(owner, d1.projectId, d1.floorId);
        // Full load: the SPA entry shows a blank SCR-14 canvas (open app bug); no SPA state is needed for this apply.
        await page.goto(screens.scale);
        await drawReference(page, 5_000);
        const applied = waitForLayerPut(page, onFloor.projectId, onFloor.floorId, (body) => typeof body.scaleMillimetresPerPixel === 'number');
        await applyScale(page).click();
        expect((await applied).response.status()).toBe(200);
        await expect(page.getByRole('heading', { name: 'Đã áp tỷ lệ cho bản vẽ' })).toBeVisible();
        await page.goBack();
        await wallsBack();
        await expect.soft(bannerOf(page), 'banner gone after the apply').toHaveCount(0);
        await ev(page, 'X4-A-019', 'banner-gone-after-apply');
      });

      await test.step('[X4-A-020] A new scale k× the provisional one: SCR-16 / SCR-21 show BE-rescaled unreviewed walls (thickness × k), reviewed walls unchanged', async () => {
        const doc = await readLayer(owner, d1.projectId, d1.floorId);
        const scaleAfter = asRecord(doc.level, 'level').scaleMillimetresPerPixel;
        const after = asRecords(asRecord(doc.layer, 'layer').walls, 'walls');
        const rows = wallsBefore.map((wall) => {
          const now = after.find((candidate) => candidate.id === wall.id);
          return { id: String(wall.id), reviewed: wall.reviewed === true, before: Number(wall.thicknessMm), after: Number(now?.thicknessMm) };
        });
        await attachJson('E04_X4-A-020_rescale.json', { scaleBefore, scaleAfter, rows: rows.slice(0, 12) });
        const reviewed = rows.filter((row) => row.reviewed);
        const unreviewed = rows.filter((row) => !row.reviewed);
        expect.soft(reviewed.length, 'a reviewed wall exists').toBeGreaterThan(0);
        for (const row of reviewed) expect.soft(row.after, `reviewed ${row.id} unchanged`).toBe(row.before);
        const ratios = unreviewed.map((row) => row.after / row.before);
        expect(typeof scaleBefore, 'setup: provisional scale is a number').toBe('number');
        expect(typeof scaleAfter, 'setup: applied scale is a number').toBe('number');
        const k = (scaleAfter as number) / (scaleBefore as number);
        expect(unreviewed.length, 'an unreviewed wall exists').toBeGreaterThan(0);
        for (const ratio of ratios) expect.soft(ratio, 'unreviewed thickness × k').toBeCloseTo(k, 1);
        await expect.soft(bannerOf(page)).toHaveCount(0);
        // UI side: an unreviewed wall selected on SCR-16 shows a BE-rescaled thickness (a checked radio, if any, is one of the new values).
        const unreviewedLabel = (await rowLabels(page)).find((label) => !/đã duyệt/iu.test(label)) ?? '';
        expect(unreviewedLabel, 'setup: an unreviewed row on SCR-16').not.toBe('');
        await selectRow(page, codeOfLabel(unreviewedLabel));
        const checked = thicknessGroup(page).getByRole('radio', { checked: true });
        if ((await checked.count()) > 0) {
          const text = (await checked.first().innerText()).trim();
          expect.soft(unreviewed.map((row) => `${String(row.after)} mm`), 'SCR-16 shows a rescaled thickness').toContain(text);
        }
        await ev(page, 'X4-A-020', 'rescaled-walls');
      });

      await test.step('[X4-A-026] An unsaved SCR-16 edit (inside the 800 ms debounce), then SPA to SCR-14 and apply: ONE PUT with { layer, scaleMillimetresPerPixel }', async () => {
        const code = codeOfLabel((await rowLabels(page))[1] ?? '');
        await selectRow(page, code);
        // A paused page.clock freezes Suspense/react-query/framer timers (SCR-14 never paints: RR + R1 reds). The page clock
        // keeps running; only the autosave timers (createAutosave.ts:83-84: debounce 800 ms, max-wait 5000 ms) are swallowed.
        await page.evaluate(() => {
          const real = window.setTimeout.bind(window);
          (window as unknown as { __realSetTimeout: typeof window.setTimeout }).__realSetTimeout = window.setTimeout;
          window.setTimeout = ((fn: TimerHandler, ms?: number, ...rest: unknown[]) =>
            ms === 800 || ms === 5_000 ? 0 : real(fn, ms, ...rest)) as typeof window.setTimeout;
        });
        // Restore on EVERY path: a failure here must not leak the hijack into the 409 / cache-collision steps that follow.
        let mark = run!.puts.length;
        let sent: Awaited<ReturnType<typeof waitForLayerPut>>;
        try {
          await page.keyboard.press('3');
          await on(screens.scale);
          await drawReference(page, 4_000);
          mark = run!.puts.length;
          const both = waitForLayerPut(page, onFloor.projectId, onFloor.floorId, (body) => typeof body.scaleMillimetresPerPixel === 'number');
          await applyScale(page).click();
          sent = await both;
        } finally {
          await page.evaluate(() => {
            const w = window as unknown as { __realSetTimeout?: typeof window.setTimeout };
            if (w.__realSetTimeout !== undefined) window.setTimeout = w.__realSetTimeout;
          });
        }
        expect(sent.response.status()).toBe(200);
        const bodyKeys = Object.keys(asRecord(asRecord(sent.response.request().postDataJSON(), '#35').body, '#35.body'));
        await quiet(page);
        await attachJson('E04_X4-A-026_one-put.json', { bodyKeys, putsSinceApply: putsSince(run!, mark).length });
        expect.soft(bodyKeys.sort(), 'the PUT carries the layer and the scale').toEqual(['layer', 'scaleMillimetresPerPixel']);
        expect.soft(putsSince(run!, mark), 'one PUT for the edit and the scale').toHaveLength(1);
        await ev(page, 'X4-A-026', 'pending-edit-plus-scale');
      });

      await test.step('[X4-A-027] ⚑ Ctrl+Z on SCR-16 right after a scale apply (Back): a reverted scale is written back', async () => {
        await page.goBack();
        await wallsBack();
        const scaleLabel = (): Promise<string> => statusBar(page).locator('span').nth(1).innerText();
        const before = await scaleLabel();
        const mark = run!.puts.length;
        await page.keyboard.press('Control+z');
        await quiet(page);
        const after = await scaleLabel();
        const scalePuts = putsSince(run!, mark).filter((put) => put.scale !== null);
        await attachJson('E04_X4-A-027_undo-after-scale.json', { before, after, scalePuts: scalePuts.length, allPuts: putsSince(run!, mark).length });
        // If the store Level scale reverted (label changed) the old ratio must be saved too; otherwise nothing may have moved.
        expect.soft(after === before || scalePuts.length >= 1, 'a reverted scale label without a scale PUT').toBe(true);
        await ev(page, 'X4-A-027', 'undo-after-scale');
      });

      await test.step('[X4-A-023] ⚑ Cache collision queryKeys.drawing.byFloor: SCR-18 → Back → SCR-14 keeps its drawing', async () => {
        await on(screens.scale);
        const canvas = page.getByRole('group', { name: 'Bản vẽ đã nắn, kéo để vẽ đường tham chiếu', exact: true });
        await expect(canvas).toBeVisible({ timeout: PIPELINE_TIMEOUT_MS });
        await on(screens.dimensions);
        await expect(page.getByLabel('Đọc kích thước OCR', { exact: true }).first()).toBeVisible({ timeout: 60_000 });
        await page.goBack();
        await expect.poll(() => pathOf(page)).toBe(screens.scale);
        // C4 suspected: SCR-18 stores { imageUrl, imageAlt, widthMm, heightMm } under the key SCR-14 reads a different record from.
        await expect.soft(canvas, 'SCR-14 still has its drawing').toBeVisible({ timeout: 15_000 });
        // The env drawing has no frame: SCR-14 shows the "may be warped" alert by design until a scale is applied (useScaleCalibration.ts:1699-1703,
        // BUG-567), so "no alert at all" was a wrong check. The collision symptom is the "no drawing" notice (scaleCalibration.state.noDrawingTitle, vi.json:1184).
        const noDrawingAlert = page.getByRole('region', { name: 'Trạng thái của màn hiệu chỉnh tỷ lệ', exact: true }).getByRole('alert').filter({ hasText: 'Tầng này chưa có bản vẽ' });
        await expect.soft(noDrawingAlert, 'SCR-14 shows no "no drawing" notice').toHaveCount(0);
        await ev(page, 'X4-A-023', 'drawing-cache-shape');
      });

      await test.step('[X4-A-024] ⚑ Cache collision queryKeys.quality.assessment: SCR-22 → SCR-11 keeps the assessment shape', async () => {
        await on(screens.quality);
        await expect(page.getByText('Kiểm tra chất lượng đầu vào').first()).toBeVisible({ timeout: 60_000 });
        await on(screens.overlay);
        await expect(page.getByLabel('Màn đối chiếu bản vẽ', { exact: true }).first()).toBeVisible({ timeout: 60_000 });
        // The floor has a drawing: the "no drawing" notice (shape-collision symptom) must not appear on SCR-22.
        await expect.soft(page.getByText(/^Tầng này chưa có bản vẽ nào/u), 'SCR-22 has a drawing').toHaveCount(0);
        await on(screens.quality);
        await expect.soft(page.getByText('Kiểm tra chất lượng đầu vào').first()).toBeVisible({ timeout: 15_000 });
        await expect.soft(page.getByText(/^Tầng này chưa có bản vẽ nào/u), 'no "no drawing" notice after SCR-22 → SCR-11').toHaveCount(0);
        await ev(page, 'X4-A-024', 'quality-cache-shape');
      });

      await test.step('[X4-A-025] A scale-only 409 on SCR-14 shows its own "Tải lại" banner (BUG-598), does not lock SCR-16; the reload clears it', async () => {
        // Changed from the catalog row (SCR-14 has no "Tải lại", SCR-16 shows the shared-saver block): BUG-598 fix, source
        // useScaleCalibration.ts:689-690 ("409 của thân CHỈ tỷ lệ không khoá lớp ... màn tự dựng dải Tải lại") + vitest ScaleCalibration.test.tsx:1013.
        await on(screens.scale);
        await drawReference(page, 3_000);
        await secondWriter(owner, d1.projectId, d1.floorId, thickenFirst); // W2
        const conflict = waitForApi(page, 'PUT', layerRe(d1.projectId, d1.floorId), [409]);
        await applyScale(page).click();
        await conflict;
        const scaleBanner = page.getByRole('alert').filter({ hasText: 'Tầng này vừa được sửa ở nơi khác. Tải lại để xem bản mới nhất rồi áp lại tỷ lệ.' }); // useScaleCalibration.ts:222
        const scaleReload = scaleBanner.getByRole('button', { name: WALL.reload, exact: true });
        await expect.soft(scaleBanner, 'SCR-14 shows the conflict banner').toBeVisible();
        await expect.soft(scaleReload, 'SCR-14 banner has "Tải lại"').toBeVisible();
        await ev(page, 'X4-A-025', 'scale-409-banner-on-scr14');
        await scaleReload.click();
        await expect.soft(scaleBanner, 'the reload clears the SCR-14 banner').toHaveCount(0);
        // A scale-only body does not lock the layer in the shared saver: SCR-16 (SPA) shows no save block.
        await on(screens.walls);
        await expect(wallRows(page).first()).toBeVisible({ timeout: 30_000 });
        await expect.soft(page.getByRole('alert').filter({ hasText: WALL.conflict }), 'SCR-16 is not blocked by a scale-only 409').toHaveCount(0);
      });

      await test.step('[X4-A-030] SCR-12 summary → SCR-14 → apply → Back: the summary is still finished, no new upload', async () => {
        const mark = run!.flow.sent.length;
        await on(screens.pipeline);
        // useProcessingScreen.ts:186 renders "Đã xử lý xong N/N tầng" (older builds: "Đã xong …"); accept both.
        await expect(page.getByText(/^Đã (?:xử lý )?xong ([1-9]\d*)\/\1 tầng/u)).toBeVisible({ timeout: 60_000 });
        await page.getByRole('button', { name: 'Hiệu chỉnh tỷ lệ', exact: true }).click();
        await expect.poll(() => pathOf(page)).toBe(screens.scale);
        await drawReference(page, 6_000);
        const applied = waitForLayerPut(page, onFloor.projectId, onFloor.floorId, (body) => typeof body.scaleMillimetresPerPixel === 'number');
        await applyScale(page).click();
        expect((await applied).response.status()).toBe(200);
        await page.goBack();
        await expect.poll(() => pathOf(page)).toBe(screens.pipeline);
        await expect.soft(page.getByText(/^Đã (?:xử lý )?xong ([1-9]\d*)\/\1 tầng/u)).toBeVisible();
        const uploads = run!.flow.sent.slice(mark).filter((r) => r.method === 'POST' && /\/drawings\/uploads/u.test(r.path));
        expect.soft(uploads, 'no new upload after Back').toHaveLength(0);
        await ev(page, 'X4-A-030', 'summary-still-finished');
      });

      await test.step('[X4-A-034] SCR-22 "Sang màn hiệu chỉnh tỷ lệ" → SCR-14 → apply → Back → SCR-22 re-reads #30', async () => {
        await on(screens.overlay);
        await expect(page.getByLabel('Màn đối chiếu bản vẽ', { exact: true }).first()).toBeVisible({ timeout: 60_000 });
        const toScale = page.getByRole('button', { name: 'Sang màn hiệu chỉnh tỷ lệ', exact: true }).or(page.getByRole('link', { name: 'Sang màn hiệu chỉnh tỷ lệ', exact: true }));
        await expect(toScale.first()).toBeVisible({ timeout: 30_000 });
        await toScale.first().click();
        await expect.poll(() => pathOf(page)).toBe(screens.scale);
        await drawReference(page, 7_000);
        const qualityReads = (): number => run!.flow.sent.filter((r) => r.method === 'GET' && r.path === `/api/projects/${d1.projectId}/floors/${d1.floorId}/quality`).length;
        const before = qualityReads();
        const applied = waitForLayerPut(page, onFloor.projectId, onFloor.floorId, (body) => typeof body.scaleMillimetresPerPixel === 'number');
        await applyScale(page).click();
        expect((await applied).response.status()).toBe(200);
        await page.goBack();
        await expect.poll(() => pathOf(page)).toBe(screens.overlay);
        await expect(page.getByLabel('Màn đối chiếu bản vẽ', { exact: true }).first()).toBeVisible({ timeout: 60_000 });
        await expect.poll(() => qualityReads() - before, { timeout: 15_000, message: 'SCR-22 re-reads #30 after the new scale' }).toBeGreaterThanOrEqual(1);
        await ev(page, 'X4-A-034', 'overlay-rereads-quality');
      });
    } finally {
      await closeWallsRun(run);
      if (projectId !== undefined) await deleteSeededProject(owner, projectId);
      await owner.dispose();
      await admin.dispose();
    }
  });

  test('SCR-X · FL-X-04 · /3d ↔ overlay: store floors, "Chọn tầng", active floor beats the URL', async ({ browser }) => {
    test.setTimeout(PIPELINE_TIMEOUT_MS + 240_000);
    const { admin, pool, owner } = await ownerOf('p04-journeys-edge');
    let run: WallsRun | undefined;
    let projectId: string | undefined;
    try {
      // DM: two floors, the drawing on floor 1 only (floor 2: no scan, no geometry).
      // A framed drawing: the env drawing has no frame, so floor 1 would be the frame-missing `error` (UOC:589-614) and no partial notice can show.
      const dm = await createDrawingProject(owner, 'e04-x-04', framedPng(), ['Tầng 1', 'Tầng 2']);
      projectId = dm.projectId;
      const outcome = await waitForRunOutcome(owner, dm.projectId, dm.uploadId);
      expect(outcome.status, 'fake-ML run of floor 1').toBe('completed');
      const floors = (await owner.get(`/api/projects/${dm.projectId}`).then((res) => res.json())) as { floors: { id: string; name: string; order: number }[] };
      const sorted = [...floors.floors].sort((a, b) => a.order - b.order);
      const [f1, f2] = [sorted[0]!, sorted[1]!];
      // The fake ML finds no walls in the crafted page: give floor 1 geometry so only floor 2 is "chưa dựng hình học" (as P7 seedDF).
      await writeLayer(layerApiOf(owner), dm.projectId, f1.id, qcLayer);
      run = await openWallsRun(browser, { who: pool, clock: false });
      const { page } = run;
      const overlayOf = (floorId: string): string => ROUTES.project.overlay(dm.projectId, floorId);
      const picker = (): Locator => page.getByRole('combobox', { name: 'Chọn tầng', exact: true });
      const layerGets = (): number => run!.flow.sent.filter((r) => r.method === 'GET' && /\/spatial\/layer$/u.test(r.path)).length;

      await test.step('[X4-A-031] SCR-16 (store holds graph + floors) → SCR-22 (SPA): no N16 GET, every floor in "Chọn tầng"', async () => {
        // /3d is the Pascal viewer (no sibling nav, no spatial store; SCR-22 entry moved, 5fcaf502): fill the store on SCR-16, then hop client-side.
        await page.goto(ROUTES.project.walls(dm.projectId, f1.id));
        await expect.poll(layerGets, { message: 'SCR-16 reads N16' }).toBeGreaterThanOrEqual(1);
        await dismissTour(page, { waitMs: TOUR_APPEAR_TIMEOUT_MS });
        const before = layerGets();
        await markShell(page);
        await spaGo(page, overlayOf(f1.id));
        await expect.poll(() => pathOf(page)).toBe(overlayOf(f1.id));
        await expect(page.getByLabel('Màn đối chiếu bản vẽ', { exact: true }).first()).toBeVisible({ timeout: 60_000 });
        expect.soft(await shellKept(page), 'a client-side route change').toBe(true);
        expect.soft(layerGets() - before, 'N16 GETs caused by the hop').toBe(0);
        await picker().click();
        await expect.soft(page.getByRole('option')).toHaveCount(2);
        await ev(page, 'X4-A-031', 'overlay-from-3d');
        await page.keyboard.press('Escape');
      });

      await test.step('[22-A-016] "Chọn tầng" lists the store floors; a floor without a scan reads "{name} — Không có ảnh bản vẽ gốc"', async () => {
        await picker().click();
        await expect.soft(page.getByRole('option', { name: 'Tầng 1', exact: true })).toBeVisible();
        await expect.soft(page.getByRole('option', { name: 'Tầng 2 — Không có ảnh bản vẽ gốc', exact: true })).toBeVisible();
        await ev(page, '22-A-016', 'floor-select-options');
        await page.keyboard.press('Escape');
      });

      await test.step('[22-E-005] The "Chọn tầng" label is sr-only and tied by htmlFor; the options open with the keyboard', async () => {
        const trigger = picker();
        await expect.soft(trigger).toBeVisible();
        await trigger.focus();
        await page.keyboard.press('Enter');
        await expect.soft(page.getByRole('listbox')).toBeVisible();
        await page.keyboard.press('ArrowDown');
        await ev(page, '22-E-005', 'floor-select-keyboard');
        await page.keyboard.press('Escape');
      });

      await test.step('[22-A-017] Picking another floor → setActiveFloor, a new GET #30 for it, the URL follows to the picked floor (BUG-600)', async () => {
        const quality = waitForApi(page, 'GET', new RegExp(`^/api/projects/${dm.projectId}/floors/${f2.id}/quality$`, 'u'), [200, 404]);
        await picker().click();
        await page.getByRole('option', { name: /^Tầng 2/u }).click();
        await quality;
        // App: useOverlayComparison.ts selectFloor navigates to ROUTES.project.overlay(projectId, floorId) (URL is the source of truth, BUG-600).
        await expect.soft(page, 'URL follows the picked floor').toHaveURL(new RegExp(`/floors/${f2.id}/overlay`, 'u'));
        await ev(page, '22-A-017', 'picked-other-floor');
      });

      await test.step('[22-B-011] The partial notice for a floor without geometry: "Còn 1 tầng chưa dựng hình học."', async () => {
        // QD-003 (docs/decisions.md:27-36): a floor without a scan is 'empty' (useOverlayComparison.ts:690-696), so the partial
        // notices are checked on 'Tầng 1' (has a scan): Back to floor 1 here, Forward to floor 2 after 22-B-012 (X4-A-032 needs it).
        await page.goBack();
        await expect.poll(() => pathOf(page)).toBe(overlayOf(f1.id));
        await expect(page.getByLabel('Màn đối chiếu bản vẽ', { exact: true }).first()).toBeVisible({ timeout: 60_000 });
        // The partial sentences are joined into ONE notice paragraph (useOverlayComparison.ts:898-912 sentences.join(' ')): match the sentence inside it, not the whole element.
        await expect.soft(page.getByText('Còn 1 tầng chưa dựng hình học.').first()).toBeVisible();
        await ev(page, '22-B-011', 'partial-no-geometry');
      });

      await test.step('[22-B-012] The partial notice when not every floor has a scan: "Chỉ 1 trong 2 tầng có ảnh gốc để đối chiếu."', async () => {
        await expect.soft(page.getByText('Chỉ 1 trong 2 tầng có ảnh gốc để đối chiếu.').first()).toBeVisible();
        await ev(page, '22-B-012', 'partial-no-scan');
        await page.goForward();
        await expect.poll(() => pathOf(page)).toBe(overlayOf(f2.id));
      });

      await test.step('[X4-A-032] ⚑ "Chọn tầng" changes the active floor → the URL follows (BUG-600, useOverlayComparison.ts:1056-1062 pushes the overlay route); Back returns to floor 1', async () => {
        const overlayUrl = pathOf(page);
        // Source: BUG-600 — "Chọn tầng" and the URL agree after a pick (was: URL stayed on floor 1, UOC:941-944).
        expect.soft(overlayUrl, '"Chọn tầng" and the URL agree').toBe(overlayOf(f2.id));
        await page.goBack();
        await expect.poll(() => pathOf(page)).toBe(overlayOf(f1.id));
        await expect(page.getByLabel('Màn đối chiếu bản vẽ', { exact: true }).first()).toBeVisible({ timeout: 60_000 });
        await attachJson('E04_X4-A-032_active-floor.json', { overlayUrl, selectedFloor: f2.name, afterBack: pathOf(page) });
        expect.soft((await picker().innerText()).trim(), 'after Back the select follows the URL floor').toContain('Tầng 1');
        await ev(page, 'X4-A-032', 'active-floor-vs-url');
      });

      await test.step('[X4-A-033] ⚑ The URL floor wins on SPA Back / Forward: Forward to the overlay URL of floor 2, the select shows floor 2', async () => {
        await page.goForward();
        await expect.poll(() => pathOf(page)).toBe(overlayOf(f2.id));
        await expect(page.getByLabel('Màn đối chiếu bản vẽ', { exact: true }).first()).toBeVisible({ timeout: 60_000 });
        const shown = (await picker().innerText()).trim();
        await attachJson('E04_X4-A-033_forward.json', { url: pathOf(page), picker: shown });
        // The URL names floor 2; the screen must follow it.
        expect.soft(shown, 'the select follows the URL floor').toContain('Tầng 2');
        await ev(page, 'X4-A-033', 'store-beats-url');
      });
    } finally {
      await closeWallsRun(run);
      if (projectId !== undefined) await deleteSeededProject(owner, projectId);
      await owner.dispose();
      await admin.dispose();
    }
  });
});
