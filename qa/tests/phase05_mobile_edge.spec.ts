/**
 * Phase 5 — SCR-27 mobile viewer (`/m/du-an/:projectId`), EDGE layer, real stack: ten user flows (QA-05c P6, flows-C5
 * "phase05_mobile_edge.spec.ts"). One `test()` per flow on its own data, one `test.step('[<row id>] …')` per catalog
 * row in the planned order; `H` steps use a hard `expect`, every other step `expect.soft`. Each step captures one
 * evidence `E05_<row id>_<slug>.png`. `⚑` = suspected bug, written as the CORRECT behaviour (red while the bug lives):
 * 27-E-010, 27-A-007, 27-A-012, 27-C-004, 27-E-006, 27-E-013, 27-A-037.
 *
 * Source (FE d50bb248, src/screens/system/MobileViewer/): MVV MobileViewer.tsx · MVB MobileViewerBottomBar.tsx · MVI
 * MobileViewerInfoSheet.tsx · MVR MobileViewer.container.tsx · UMV useMobileViewer.ts · MVG mobileViewerGateway.ts · MVP
 * mobileViewerPascal.ts · MVT mobileViewerTypes.ts; PSG src/components/feedback/ProjectSpatialGate.tsx; PP
 * src/components/pascal/pascalPick.ts; NM src/lib/offline/networkMonitor.ts. Seeds: Q1/Q2/Q3e (`createQcProject`),
 * QC:wall-one / room-one / table-one, E0L (80-char name) — `support/p05/P6.ts`.
 *
 * ## Request budget per full run (10 flows, one browser context each)
 * - `POST /api/auth/login`: 10 (limit 120 / 60 s per IP). `POST /api/auth/refresh`: 10 fixture tokens + ~1 per page load
 *   (≈ 25 loads) of the 300 / 60 s budget.
 * - `POST /api/projects` 11 (FL-27-08 makes two), `GET /api/projects/:id` 11, N16 GET + #35 PUT: 1 per layered floor
 *   (≈ 14), `DELETE /api/projects/:id` 11; none is rate limited. FL-27-10 seeds nothing.
 * - The screen itself only reads: #24, N15, N21 and `HEAD /` (network monitor); every flow asserts no other write.
 *
 * ## Risks recorded while writing (not verified — the stack was not run)
 * - Taps and drags go to the canvas host box by coordinates (`tapCanvas`); `<main>` (MVV:236) is a positioned sibling
 *   above the host, so a tap that never reaches Pascal would fail every pick step at once — look at the first pick
 *   evidence (27-A-021) before reading the rest.
 * - Q3e (27-B-006): whether N15 carries a level for the floor without a layer decides partial vs success; recorded as a note.
 */
import { expect, test, type Page } from '@playwright/test';

import { captureEvidence } from './support/evidence';
import {
  COMPACT_PHONE,
  MV,
  PHONE,
  SCENE_TIMEOUT_MS,
  SHEET_PX,
  afterFrames,
  annotate,
  canvasDiff,
  closeMobileFlow,
  createLongNameProject,
  dragCanvas,
  dragHandle,
  findKey,
  floorRows,
  group,
  hitsCanvas,
  holdRoute,
  host,
  loadingSeen,
  measureRows,
  mobileUrl,
  mountRe,
  nav,
  note,
  openMobile,
  openMobileFlow,
  projectRe,
  region,
  roomOne,
  ruleConfigRe,
  seedLayer,
  seedQc,
  settledShot,
  sheet,
  sheetHeight,
  spaNavigate,
  spatialRe,
  successText,
  tableOne,
  tapCanvas,
  toggleMeasure,
  tool,
  uniq,
  waitBuilt,
  wallOne,
  watchLoading,
  type MobileFlow,
} from './support/p05/P6';

const softly = expect.configure({ soft: true });
const shot = (page: Page, id: string, slug: string): Promise<string> => captureEvidence(page, `E05_${id}_${slug}.png`);
/** NBSP-safe text (FMT:95-139 may join the unit with U+00A0). */
const clean = (text: string | null): string => (text ?? '').replace(/ /gu, ' ').trim();
const LENGTH_RE = /^(\d+ mm|\d{1,3}(\.\d{3})*,\d{2} m)$/u; // FMT:95-139
const closeAll = async (flow: MobileFlow | undefined): Promise<void> => {
  expect.soft(await closeMobileFlow(flow), 'fixture cleanup').toEqual([]);
};

test.describe('E05 SCR-27 mobile viewer — edge flows (QA-05c P6)', () => {
  test('SCR-27 · FL-27-01 · open, landmarks, wire, success, weak network', async ({ browser }) => {
    let flow: MobileFlow | undefined;
    try {
      flow = await openMobileFlow(browser);
      const { page, net, context } = flow;
      const q2 = await seedQc(flow, 'm27-open', ['Tầng 1', 'Tầng 2'], 2); // Q2
      const bundle = await holdRoute(page, 'GET', (path) => mountRe.test(path)); // keeps "Đang tải mô hình" on screen for step 2
      let announced: boolean | null = null;

      await test.step('[27-A-001] Admin opens /m/du-an/:p: region and project name', async () => {
        await page.goto(mobileUrl(q2.id));
        await expect(region(page)).toBeVisible(); // MVV:207-223, MVR:132-156
        await expect(region(page).getByRole('heading', { level: 1, name: q2.name, exact: true })).toBeVisible(); // UMV:210-214
        await shot(page, '27-A-001', 'region_and_name');
      });

      await test.step('[27-A-003] Cold open: floating note while Pascal builds, then gone', async () => {
        await bundle.arrived;
        const floating = note(page, MV.loading); // MVV:129-134, UMV:479-484
        await expect.soft(floating).toBeVisible();
        announced = await floating.evaluate((el) => el.closest('[role="status"], [role="alert"], [aria-live]') !== null);
        await shot(page, '27-A-003', 'loading_note');
        bundle.release();
        await expect.soft(page.getByText(MV.loading)).toHaveCount(0, { timeout: SCENE_TIMEOUT_MS });
      });

      await test.step('[27-E-010] ⚑ the loading note is a live region', async () => {
        // MVV:59-67 renders a plain <p>; MVR:94-96 promises the states are spoken. Read while step 2 saw the note.
        expect.soft(announced, 'the floating loading note sits in role="status" / aria-live').toBe(true);
        await shot(page, '27-E-010', 'loading_note_live');
      });

      await test.step('[27-B-022] Success: sr-only sentence, no floating note', async () => {
        await expect.soft(successText(page)).toBeAttached({ timeout: SCENE_TIMEOUT_MS }); // MVV:152, UMV:496
        await expect.soft(region(page).locator('main p')).toHaveCount(0);
        await shot(page, '27-B-022', 'success');
      });

      await test.step('[27-G-001] Exactly one #24 and one N15, both 200', async () => {
        expect.soft(net.count('GET', projectRe(q2.id)), 'GET /api/projects/:p').toBe(1); // UPS:104-123, MVQ:78-79
        expect.soft(net.count('GET', projectRe(q2.id), 200), 'GET /api/projects/:p 200').toBe(1);
        expect.soft(net.count('GET', spatialRe(q2.id)), 'GET …/spatial').toBe(1);
        expect.soft(net.count('GET', spatialRe(q2.id), 200), 'GET …/spatial 200').toBe(1);
        await shot(page, '27-G-001', 'one_24_one_n15');
      });

      await test.step('[27-G-002] N21 rule config read once', async () => {
        await softly.poll(() => net.count('GET', ruleConfigRe(q2.id)), { message: 'GET …/rule-config after hydration' }).toBe(1); // UPS:68-85, 165-168
        await shot(page, '27-G-002', 'rule_config_once');
      });

      await test.step('[27-G-005] Pascal bundle fetched once', async () => {
        expect.soft(net.count('GET', mountRe), 'GET /assets/pascal/pascal-mount.js').toBe(1); // MVP:32, usePascalViewer.ts:51,198
        await shot(page, '27-G-005', 'bundle_once');
      });

      await test.step('[27-E-001] Landmarks: one region, one main, one h1', async () => {
        await expect.soft(page.getByRole('region', { name: MV.region, exact: true })).toHaveCount(1);
        await expect.soft(page.locator('main')).toHaveCount(1); // MVV:236
        await expect.soft(page.locator('h1')).toHaveCount(1);
        await expect.soft(region(page).getByRole('heading', { level: 1 })).toHaveText(q2.name);
        await shot(page, '27-E-001', 'landmarks');
      });

      await test.step('[27-B-024] "Chia sẻ dự án" is absent', async () => {
        await expect.soft(region(page).getByRole('button', { name: MV.share, exact: true })).toHaveCount(0); // MVV:225-233, SL:354
        await shot(page, '27-B-024', 'share_absent');
      });

      await test.step('[27-C-006] Read-only by construction', async () => {
        await expect.soft(region(page).locator('input, textarea, select, [contenteditable]')).toHaveCount(0); // MVI:40-45
        await shot(page, '27-C-006', 'no_form_controls');
      });

      await test.step('[27-B-007] Offline then online: weak-network note comes and goes', async () => {
        await context.setOffline(true);
        await softly.poll(() => page.evaluate(() => navigator.onLine)).toBe(false);
        await expect.soft(note(page, MV.weakNetwork)).toBeVisible(); // UMV:266-283, NM:131-160
        await shot(page, '27-B-007', 'weak_network_note');
        await context.setOffline(false);
        await softly.poll(() => page.evaluate(() => navigator.onLine)).toBe(true);
        // A ping that failed while offline keeps `pingOnline=false` until the next 20 s tick (NM:40), so allow one tick.
        await expect.soft(note(page, MV.weakNetwork)).toHaveCount(0, { timeout: 30_000 });
      });
    } finally {
      await closeAll(flow);
    }
  });

  test('SCR-27 · FL-27-02 · floors and "Chế độ xem"', async ({ browser }) => {
    let flow: MobileFlow | undefined;
    try {
      flow = await openMobileFlow(browser);
      const { page } = flow;
      const q3e = await seedQc(flow, 'm27-floors', ['Tầng 1', 'Tầng trống'], 1); // Q3e
      let floorOne: Buffer | undefined;

      await test.step('[27-A-004] H: "Tầng" opens group "Tầng" with rows bottom-up', async () => {
        await page.goto(mobileUrl(q3e.id));
        await expect(region(page)).toBeVisible();
        await waitBuilt(page, false);
        await tool(page, MV.floors).click();
        await expect(group(page, MV.floors)).toBeVisible(); // MVB:127, 142-152
        await expect(floorRows(page).locator('span.truncate')).toHaveText(['Tầng 1', 'Tầng trống']); // MVG:141-145, 173-186
        await expect(tool(page, MV.floors)).toHaveAttribute('aria-pressed', 'true');
        await shot(page, '27-A-004', 'floor_group_rows');
      });

      await test.step('[27-B-006] One of two floors has no rooms → partial note', async () => {
        // viewerShellGateway.ts:192 withRooms 1 < storeys 2 — only when N15 carries a level for the empty floor.
        const partial = note(page, MV.partialRooms);
        const shown = await partial.isVisible();
        annotate(`27-B-006 levelPresent in N15 for "Tầng trống": ${String(shown)} (partial note shown = true)`);
        await expect.soft(partial).toBeVisible();
        await shot(page, '27-B-006', 'partial_one_of_two');
      });

      await test.step('[27-A-005] Lowest floor active by default', async () => {
        await expect.soft(floorRows(page).filter({ hasText: 'Tầng 1' })).toHaveAttribute('aria-pressed', 'true'); // UMV:236-240
        floorOne = await settledShot(page);
        await shot(page, '27-A-005', 'lowest_floor_active');
      });

      await test.step('[27-A-006] Tap "Tầng trống": it is pressed, "Tầng 1" is not, the group stays', async () => {
        await floorRows(page).filter({ hasText: 'Tầng trống' }).click(); // UMV:445, MVB:144-149
        await expect.soft(floorRows(page).filter({ hasText: 'Tầng trống' })).toHaveAttribute('aria-pressed', 'true');
        await expect.soft(floorRows(page).filter({ hasText: 'Tầng 1' })).toHaveAttribute('aria-pressed', 'false');
        await expect.soft(group(page, MV.floors)).toBeVisible();
        await shot(page, '27-A-006', 'second_floor_pressed');
      });

      await test.step('[27-A-007] ⚑ the model follows the floor', async () => {
        // `activeFloorId` never reaches `mountScene` (UMV:337-364 deps, MVP:38-62): expected ≥ 1 % of pixels differ.
        const before = floorOne;
        if (before === undefined) throw new Error('27-A-005 took no baseline');
        const diff = await canvasDiff(before, await settledShot(page));
        annotate(`27-A-007 canvas diff Tầng 1 → Tầng trống: ${diff.toFixed(3)} %`);
        expect.soft(diff, 'percent of canvas pixels that changed with the floor').toBeGreaterThanOrEqual(1);
        // Control: re-select "Tầng 1" - the same floor must look like the baseline, else the diff above is post-FX drift, not the floor.
        await floorRows(page).filter({ hasText: 'Tầng 1' }).click();
        await expect.soft(floorRows(page).filter({ hasText: 'Tầng 1' })).toHaveAttribute('aria-pressed', 'true');
        const again = await canvasDiff(before, await settledShot(page));
        expect.soft(again, 'control: percent changed when "Tầng 1" is chosen again').toBeLessThan(1);
        await shot(page, '27-A-007', 'model_follows_floor');
      });

      await test.step('[27-E-003] Floor rows are buttons with aria-pressed in group "Tầng"', async () => {
        await expect.soft(floorRows(page)).toHaveCount(2); // MVB:85-115
        for (const row of await floorRows(page).all()) await expect.soft(row).toHaveAttribute('aria-pressed', /^(true|false)$/u);
        await shot(page, '27-E-003', 'floor_rows_buttons');
      });

      await test.step('[27-A-010] Tap "Tầng" again: unpressed, group gone', async () => {
        await tool(page, MV.floors).click(); // MVB:206 same tool → null
        await expect.soft(tool(page, MV.floors)).toHaveAttribute('aria-pressed', 'false');
        await expect.soft(group(page, MV.floors)).toHaveCount(0);
        await shot(page, '27-A-010', 'group_closed');
      });

      await test.step('[27-A-011] "Chế độ xem" un-presses "Tầng"', async () => {
        await tool(page, MV.floors).click();
        await expect(tool(page, MV.floors)).toHaveAttribute('aria-pressed', 'true');
        await tool(page, MV.view).click(); // UMV:306, 436-443
        await expect.soft(tool(page, MV.view)).toHaveAttribute('aria-pressed', 'true');
        await expect.soft(tool(page, MV.floors)).toHaveAttribute('aria-pressed', 'false');
        await expect.soft(group(page, MV.floors)).toHaveCount(0);
        await shot(page, '27-A-011', 'view_unpresses_floors');
      });

      await test.step('[27-A-012] ⚑ "Chế độ xem" offers a view choice', async () => {
        // MVB:127-128 has no panel for `view` when not compact and UMV:436-443 never reads it: the tap only flips aria-pressed.
        await expect.soft(region(page).getByRole('group'), 'a role group above the bar after the "Chế độ xem" tap').not.toHaveCount(0);
        await shot(page, '27-A-012', 'view_choice');
      });

      await test.step('[27-E-002] Tool bar names and states', async () => {
        await expect.soft(nav(page).getByRole('button')).toHaveCount(4); // MVB:43-48, 194-210
        for (const label of [MV.floors, MV.view, MV.measure, MV.info]) await expect.soft(tool(page, label)).toBeVisible();
        await expect.soft(nav(page).locator('button[aria-pressed="true"]')).toHaveCount(1);
        await shot(page, '27-E-002', 'tool_bar');
      });

      await test.step('[27-A-034] "Thông tin" closes group "Tầng"', async () => {
        await tool(page, MV.floors).click();
        await expect(group(page, MV.floors)).toBeVisible();
        await tool(page, MV.info).click(); // MVB:127, UMV:436-443
        await expect.soft(group(page, MV.floors)).toHaveCount(0);
        await expect.soft(sheet(page)).toBeVisible();
        await shot(page, '27-A-034', 'info_closes_floors');
      });
    } finally {
      await closeAll(flow);
    }
  });

  test('SCR-27 · FL-27-03 · camera and measuring', async ({ browser }) => {
    test.setTimeout(150_000); // three Pascal re-mounts (the "Đo" toggles rebuild the scene)
    let flow: MobileFlow | undefined;
    try {
      flow = await openMobileFlow(browser);
      const { page, net } = flow;
      const q1 = await seedQc(flow, 'm27-cam'); // Q1
      let dragged: Buffer | undefined;
      let firstRow = '';
      let base = { project: 0, spatial: 0 };

      await test.step('[27-A-040] H: one-finger drag moves the camera', async () => {
        await openMobile(page, q1.id);
        await watchLoading(page);
        base = { project: net.count('GET', projectRe(q1.id)), spatial: net.count('GET', spatialRe(q1.id)) };
        const reaches = await hitsCanvas(page, 0.5, 0.45);
        annotate(`27-A-040 elementFromPoint at the canvas centre is inside the host: ${String(reaches)} (false = <main> MVV:236 swallows touches)`);
        expect.soft(reaches, 'a touch at the canvas centre reaches the canvas host, not the <main> overlay').toBe(true);
        const before = await settledShot(page);
        await dragCanvas(page, 120, 0); // MVP:42 cameraControls
        await expect
          .poll(async () => canvasDiff(before, await settledShot(page)), { message: 'percent of canvas pixels changed by a 120 px drag' })
          .toBeGreaterThanOrEqual(1);
        dragged = await settledShot(page);
        await shot(page, '27-A-040', 'camera_dragged');
      });

      await test.step('[27-C-004] ⚑ toggling "Đo" keeps the camera', async () => {
        // UMV:337-364 + 345: `isMeasuring` is a mount dep, so Pascal is rebuilt and the view resets to the initial camera.
        if (dragged === undefined) throw new Error('27-A-040 took no dragged shot');
        await toggleMeasure(page, true);
        expect.soft(await loadingSeen(page), 'times "Đang tải mô hình" showed during the toggle').toBe(0);
        const diff = await canvasDiff(dragged, await settledShot(page));
        annotate(`27-C-004 canvas diff dragged → after "Đo" on: ${diff.toFixed(3)} %`);
        expect.soft(diff, 'percent changed vs the dragged view').toBeLessThan(1);
        await shot(page, '27-C-004', 'camera_kept_on_measure');
      });

      await test.step('[27-A-013] "Đo" shows the empty copy', async () => {
        await expect.soft(group(page, MV.measure).getByText(MV.measureEmpty, { exact: true })).toBeVisible(); // MVB:128, 174-177
        await shot(page, '27-A-013', 'measure_empty');
      });

      await test.step('[27-A-014] One tap: still the empty copy', async () => {
        await tapCanvas(page, 0.35, 0.5); // PP:32-35 first tap stores the point
        await expect.soft(group(page, MV.measure).getByText(MV.measureEmpty, { exact: true })).toBeVisible();
        await expect.soft(measureRows(page)).toHaveCount(0);
        await shot(page, '27-A-014', 'one_tap_no_row');
      });

      await test.step('[27-A-015] Second tap: one row "Khoảng cách hai điểm" + a length', async () => {
        await tapCanvas(page, 0.65, 0.5); // PP:36-38, MVG:309-351
        await expect.soft(measureRows(page)).toHaveCount(1);
        const row = measureRows(page).first();
        await expect.soft(row.locator('span').first()).toHaveText(MV.measureKind); // MVB:179-189
        await expect.soft(row.locator('span').nth(1)).toHaveText(LENGTH_RE);
        firstRow = clean(await row.textContent());
        await shot(page, '27-A-015', 'first_measurement');
      });

      await test.step('[27-A-016] Two more taps: 2 rows, the first unchanged', async () => {
        await tapCanvas(page, 0.4, 0.6);
        await tapCanvas(page, 0.6, 0.4); // PP:36-38 third tap starts a new pair
        await expect.soft(measureRows(page)).toHaveCount(2);
        expect.soft(clean(await measureRows(page).first().textContent()), 'first row text').toBe(firstRow);
        await shot(page, '27-A-016', 'two_measurements');
      });

      await test.step('[27-A-017] Taps while measuring open no info sheet', async () => {
        await expect.soft(sheet(page)).toHaveCount(0); // PP:28-31, MVT:215 — rows reached 2, so the taps were handled
        await shot(page, '27-A-017', 'no_sheet_while_measuring');
      });

      await test.step('[27-A-018] "Đo" off and on keeps the same 2 rows', async () => {
        await toggleMeasure(page, false);
        await toggleMeasure(page, true); // UMV:304, 326 — the list lives in the hook, not in the scene
        await expect.soft(measureRows(page)).toHaveCount(2);
        expect.soft(clean(await measureRows(page).first().textContent()), 'first row text').toBe(firstRow);
        await shot(page, '27-A-018', 'rows_survive_toggle');
      });

      await test.step('[27-C-005] A pending first point is dropped when "Đo" is toggled', async () => {
        await tapCanvas(page, 0.45, 0.55); // pending point
        await toggleMeasure(page, false);
        await toggleMeasure(page, true); // PP:26 new closure per mount
        await tapCanvas(page, 0.55, 0.45); // would pair with the old point if it were kept
        await expect.soft(measureRows(page)).toHaveCount(2);
        await shot(page, '27-C-005', 'pending_point_dropped');
      });

      await test.step('[27-G-007] The toggles re-read nothing', async () => {
        expect.soft(net.count('GET', projectRe(q1.id)) - base.project, 'new GET /api/projects/:p since step 1').toBe(0); // UMV:337-364
        expect.soft(net.count('GET', spatialRe(q1.id)) - base.spatial, 'new GET …/spatial since step 1').toBe(0);
        await shot(page, '27-G-007', 'no_reread');
      });

      await test.step('[27-A-019] Reload: measurements are gone, nothing was written', async () => {
        await page.reload();
        await expect(region(page)).toBeVisible();
        await waitBuilt(page);
        await tool(page, MV.measure).click();
        await expect.soft(group(page, MV.measure).getByText(MV.measureEmpty, { exact: true })).toBeVisible(); // UMV:304 local only
        expect.soft(net.writes(), 'requests other than GET/HEAD in the whole flow').toEqual([]);
        await shot(page, '27-A-019', 'reload_empty');
      });
    } finally {
      await closeAll(flow);
    }
  });

  test('SCR-27 · FL-27-04 · info sheet, snaps, keyboard', async ({ browser }) => {
    let flow: MobileFlow | undefined;
    try {
      flow = await openMobileFlow(browser);
      const { page, pageErrors } = flow;
      const q1 = await seedQc(flow, 'm27-sheet'); // Q1
      const closeButton = (): ReturnType<Page['getByRole']> => sheet(page).getByRole('button', { name: MV.closeSheet, exact: true });
      const expand = (): ReturnType<Page['getByRole']> => sheet(page).getByRole('button', { name: MV.expandSheet, exact: true });
      const shrink = (): ReturnType<Page['getByRole']> => sheet(page).getByRole('button', { name: MV.shrinkSheet, exact: true });

      await test.step('[27-A-020] H: "Thông tin" with nothing selected', async () => {
        await openMobile(page, q1.id);
        await tool(page, MV.info).click();
        await expect(sheet(page)).toBeVisible(); // MVV:177, MVI:202
        await expect(sheet(page).getByRole('heading', { name: MV.info, exact: true })).toBeVisible(); // MVI:224
        await expect(sheet(page).getByText(MV.infoEmpty, { exact: true })).toBeVisible(); // MVI:248-251
        await shot(page, '27-A-020', 'info_empty');
      });

      await test.step('[27-E-005] Dialog and its buttons are named', async () => {
        await expect.soft(expand()).toBeVisible(); // MVI:227-243
        await expect.soft(closeButton()).toBeVisible();
        await shot(page, '27-E-005', 'sheet_named');
      });

      await test.step('[27-E-006] ⚑ focus moves into the sheet', async () => {
        // MVI:201-210: no focus move and no aria-modal; the tool button that opened it keeps focus.
        const inside = await sheet(page).evaluate((dialog) => dialog.contains(document.activeElement));
        expect.soft(inside, 'document.activeElement is inside the dialog').toBe(true);
        await shot(page, '27-E-006', 'focus_in_sheet');
      });

      await test.step('[27-A-026] Opens at the middle snap', async () => {
        await softly.poll(() => sheetHeight(page)).toBe(SHEET_PX.mid); // MVI:96-106,130, MVT:93 round(812·0.45)
        await shot(page, '27-A-026', 'middle_snap');
      });

      await test.step('[27-A-027] Expand then shrink: 731 px then 365 px, label flips', async () => {
        await expand().click(); // MVI:227-235, MVT:96
        await expect.soft(shrink()).toBeVisible();
        await softly.poll(() => sheetHeight(page)).toBe(SHEET_PX.full);
        await shot(page, '27-A-027', 'expanded');
        await shrink().click();
        await expect.soft(expand()).toBeVisible();
        await softly.poll(() => sheetHeight(page)).toBe(SHEET_PX.mid);
      });

      await test.step('[27-A-029] Drag up 80 px → full; again → still full', async () => {
        await dragHandle(page, -80); // MVI:193-195 Δy < −60
        await softly.poll(() => sheetHeight(page)).toBe(SHEET_PX.full);
        await dragHandle(page, -80);
        await softly.poll(() => sheetHeight(page)).toBe(SHEET_PX.full);
        await shot(page, '27-A-029', 'drag_up_full');
      });

      await test.step('[27-A-030] From middle, a slow −40 px drag over 1 s snaps back', async () => {
        await shrink().click();
        await softly.poll(() => sheetHeight(page)).toBe(SHEET_PX.mid);
        await dragHandle(page, -40, 1_000); // MVI:154-157, 183, 193: |Δ| under both thresholds, |v| < 600 px/s
        await softly.poll(() => sheetHeight(page)).toBe(SHEET_PX.mid);
        await shot(page, '27-A-030', 'slow_drag_snaps_back');
      });

      await test.step('[27-A-028] Drag down 140 px → peek 88 px; again → closed, "Thông tin" unpressed', async () => {
        await dragHandle(page, 140); // MVI:183-191 Δy > 100
        await softly.poll(() => sheetHeight(page)).toBe(SHEET_PX.peek);
        await shot(page, '27-A-028', 'peek');
        await dragHandle(page, 140); // at peek → onDismiss (MVV:179-185)
        await expect.soft(sheet(page)).toHaveCount(0);
        await expect.soft(tool(page, MV.info)).toHaveAttribute('aria-pressed', 'false');
      });

      await test.step('[27-A-032] Open, expand, close, reopen → 365 px again', async () => {
        await tool(page, MV.info).click();
        await expand().click();
        await softly.poll(() => sheetHeight(page)).toBe(SHEET_PX.full);
        await closeButton().click();
        await expect(sheet(page)).toHaveCount(0);
        await tool(page, MV.info).click(); // MVI:136-145 snap resets on close
        await softly.poll(() => sheetHeight(page)).toBe(SHEET_PX.mid);
        await shot(page, '27-A-032', 'reopen_middle');
      });

      await test.step('[27-A-031] "Đóng tấm thông tin" closes the sheet and un-presses "Thông tin"', async () => {
        await closeButton().click(); // MVI:237-243, MVV:179-185
        await expect.soft(sheet(page)).toHaveCount(0);
        await expect.soft(tool(page, MV.info)).toHaveAttribute('aria-pressed', 'false');
        await shot(page, '27-A-031', 'closed_by_button');
      });

      await test.step('[27-E-007] Esc with nothing open changes nothing', async () => {
        const pressedBefore = await nav(page).locator('button[aria-pressed="true"]').count();
        await page.keyboard.press('Escape'); // MVV:203 binding disabled
        await afterFrames(page);
        await expect.soft(sheet(page)).toHaveCount(0);
        await expect.soft(nav(page).locator('button[aria-pressed="true"]')).toHaveCount(pressedBefore);
        expect.soft(pageErrors, 'uncaught page errors').toEqual([]);
        await shot(page, '27-E-007', 'esc_nothing_open');
      });

      await test.step('[27-E-004] Keyboard: Tab reaches the four tools in order, Enter opens "Đo", focus ring visible', async () => {
        const focused = (): Promise<string> => page.evaluate(() => document.activeElement?.getAttribute('aria-label') ?? '');
        const ringed = (): Promise<boolean> =>
          page.evaluate(() => {
            const el = document.activeElement;
            return el !== null && getComputedStyle(el).boxShadow !== 'none'; // IconButton.tsx:42 focus-visible:ring-2
          });
        await page.evaluate(() => (document.activeElement as HTMLElement | null)?.blur());
        for (let hop = 0; hop < 14 && (await focused()) !== MV.floors; hop += 1) await page.keyboard.press('Tab');
        const seen = [await focused()];
        const rings = [await ringed()];
        for (let hop = 0; hop < 3; hop += 1) {
          await page.keyboard.press('Tab');
          seen.push(await focused());
          rings.push(await ringed());
        }
        expect.soft(seen, 'focus order').toEqual([MV.floors, MV.view, MV.measure, MV.info]); // MVB:200-210
        expect.soft(rings, 'focus ring (box-shadow) on each tool').toEqual([true, true, true, true]);
        await page.keyboard.press('Shift+Tab');
        expect.soft(await focused()).toBe(MV.measure);
        await page.keyboard.press('Enter');
        await expect.soft(group(page, MV.measure)).toBeVisible();
        await shot(page, '27-E-004', 'keyboard_tools');
      });

      await test.step('[27-E-011] Reduced motion: the sheet does not animate its height', async () => {
        await page.emulateMedia({ reducedMotion: 'reduce' });
        await tool(page, MV.info).click();
        await expect(sheet(page)).toBeVisible();
        // MVI:206 `motion-reduce:transition-none` sets transition-property none; the duration class may stay, so the
        // effective claim is "no property transitions or every duration is 0s".
        const transition = await sheet(page).evaluate((el) => {
          const style = getComputedStyle(el);
          return { property: style.transitionProperty, duration: style.transitionDuration };
        });
        const still = transition.property === 'none' || transition.duration.split(',').every((part) => part.trim() === '0s');
        expect.soft(still, `transition-property "${transition.property}", transition-duration "${transition.duration}"`).toBe(true);
        await shot(page, '27-E-011', 'reduced_motion');
        await closeButton().click();
        await expect(sheet(page)).toHaveCount(0);
      });

      await test.step('[27-E-013] ⚑ BUG-593: tools show visible labels', async () => {
        // MVB:200-210: icon only, name in aria-label (`tooltip={false}`). Expected a visible text under each icon.
        for (const label of [MV.floors, MV.view, MV.measure, MV.info]) {
          await expect.soft(nav(page).getByText(label, { exact: true }), `visible text "${label}" inside the bar`).toBeVisible();
        }
        await shot(page, '27-E-013', 'tool_labels');
      });
    } finally {
      await closeAll(flow);
    }
  });

  test('SCR-27 · FL-27-05 · wall pick, partial, Esc order', async ({ browser }) => {
    let flow: MobileFlow | undefined;
    try {
      flow = await openMobileFlow(browser);
      const { page } = flow;
      const wall = await seedLayer(flow, 'm27-wall', wallOne); // QC:wall-one

      await test.step('[27-B-005] H: walls only → partial note', async () => {
        await openMobile(page, wall.id, false);
        await expect(note(page, MV.partialRooms)).toBeVisible({ timeout: SCENE_TIMEOUT_MS }); // MVV:138-146, UMV:464-470
        await shot(page, '27-B-005', 'partial_walls_only');
      });

      await test.step('[27-A-008] Badge "Chưa có phòng" in the floor row', async () => {
        await tool(page, MV.floors).click();
        await expect.soft(group(page, MV.floors).getByText(MV.noRoomsBadge, { exact: true })).toBeVisible(); // MVB:140-150
        await expect.soft(group(page, MV.floors).getByRole('button', { name: `Tầng 1 ${MV.noRoomsBadge}`, exact: true })).toBeVisible();
        await shot(page, '27-A-008', 'no_rooms_badge');
      });

      await test.step('[27-A-021] Tap the wall: read-only sheet with the wall subset', async () => {
        await tapCanvas(page, 0.5, 0.5);
        const wallSheet = sheet(page);
        await expect.soft(wallSheet.getByRole('heading', { name: /^Tường W-/u })).toBeVisible(); // MVG:193-229, 269-296
        await expect.soft(wallSheet.getByText('Tường', { exact: true })).toBeVisible();
        await expect.soft(wallSheet.locator('dl > div > dt')).toHaveText(['Bề dày', 'Chiều dài']); // TVM:376-385
        await expect.soft(wallSheet.locator('dl > div > dd')).toHaveText(['220 mm', '6,00 m']);
        await shot(page, '27-A-021', 'wall_sheet');
      });

      await test.step('[27-A-033] Esc closes the sheet first, a second Esc the open tool', async () => {
        await sheet(page).getByRole('button', { name: MV.closeSheet, exact: true }).click();
        await expect(sheet(page)).toHaveCount(0);
        await expect(tool(page, MV.floors)).toHaveAttribute('aria-pressed', 'true'); // the group stays open when the sheet closes
        await tapCanvas(page, 0.5, 0.5); // a tap above the group
        await expect(sheet(page)).toBeVisible();
        await page.keyboard.press('Escape'); // MVV:187-204 sheet before tool
        await expect.soft(sheet(page)).toHaveCount(0);
        await expect.soft(tool(page, MV.floors)).toHaveAttribute('aria-pressed', 'true');
        await page.keyboard.press('Escape');
        await expect.soft(tool(page, MV.floors)).toHaveAttribute('aria-pressed', 'false');
        await shot(page, '27-A-033', 'esc_order');
      });

      await test.step('[27-A-025] Tap empty sky after a selection: the sheet closes', async () => {
        await tapCanvas(page, 0.5, 0.5);
        await expect(sheet(page)).toBeVisible();
        await tapCanvas(page, 0.5, 0.1); // top 10 % of the canvas, below the 48 px header
        await expect.soft(sheet(page)).toHaveCount(0); // UMV:313-320 null → selectionOf null
        await shot(page, '27-A-025', 'sky_tap_clears');
      });
    } finally {
      await closeAll(flow);
    }
  });

  test('SCR-27 · FL-27-06 · room pick, hit targets, read-only wire', async ({ browser }) => {
    let flow: MobileFlow | undefined;
    try {
      flow = await openMobileFlow(browser);
      const { page, net } = flow;
      const room = await seedLayer(flow, 'm27-room', roomOne); // QC:room-one

      await test.step('[27-A-022] H: tap the room: heading, badge, area only', async () => {
        await openMobile(page, room.id);
        const reaches = await hitsCanvas(page, 0.5, 0.5);
        annotate(`27-A-022 elementFromPoint at the canvas centre is inside the host: ${String(reaches)}`);
        expect.soft(reaches, 'a tap at the canvas centre reaches the canvas host, not the <main> overlay').toBe(true);
        await tapCanvas(page, 0.5, 0.5);
        await expect(sheet(page).getByRole('heading', { name: 'Phòng QA', exact: true })).toBeVisible(); // MVG:216, TVM:426
        await expect(sheet(page).getByText('Phòng', { exact: true })).toBeVisible();
        await expect(sheet(page).locator('dl > div > dt')).toHaveText(['Diện tích']); // TVM:145-148
        await expect(sheet(page).locator('dl > div > dd')).toHaveText(['400,00 m²']);
        await shot(page, '27-A-022', 'room_sheet');
      });

      await test.step('[27-E-012] Every control is at least 44×44', async () => {
        const small: string[] = [];
        const measure = async (label: string, target: ReturnType<Page['locator']>): Promise<void> => {
          const box = await target.boundingBox();
          if (box === null || Math.min(box.width, box.height) < 44) small.push(`${label} ${box === null ? 'no box' : `${String(box.width)}×${String(box.height)}`}`);
        };
        for (const label of [MV.floors, MV.view, MV.measure, MV.info]) await measure(label, tool(page, label)); // MVT:67, IconButton.tsx:18-22
        await measure(MV.expandSheet, sheet(page).getByRole('button', { name: MV.expandSheet, exact: true }));
        await measure(MV.closeSheet, sheet(page).getByRole('button', { name: MV.closeSheet, exact: true }));
        await sheet(page).getByRole('button', { name: MV.closeSheet, exact: true }).click();
        await tool(page, MV.floors).click();
        for (const row of await floorRows(page).all()) await measure('floor row', row); // MVB:95
        expect.soft(small, 'controls under 44 px on a side').toEqual([]);
        await shot(page, '27-E-012', 'hit_targets');
      });

      await test.step('[27-E-008] The canvas host is hidden from assistive tech', async () => {
        await expect.soft(host(page)).toHaveAttribute('aria-hidden', 'true'); // MVV:213-215
        await shot(page, '27-E-008', 'canvas_aria_hidden');
      });

      await test.step('[27-G-006] Read-only wire after open, pick, drag and sheet snaps', async () => {
        await tool(page, MV.floors).click(); // close the group
        await tapCanvas(page, 0.5, 0.5);
        await expect(sheet(page)).toBeVisible();
        await sheet(page).getByRole('button', { name: MV.expandSheet, exact: true }).click();
        await sheet(page).getByRole('button', { name: MV.shrinkSheet, exact: true }).click();
        await dragHandle(page, -80);
        await sheet(page).getByRole('button', { name: MV.closeSheet, exact: true }).click();
        await dragCanvas(page, 60, 40);
        // Mark: a real read answered after the last gesture (the network monitor's HEAD / or a GET), so "no write" is not vacuous.
        const readsBefore = net.rows.filter((row) => row.method === 'GET' || row.method === 'HEAD').length;
        await page.reload();
        await expect(region(page)).toBeVisible();
        await waitBuilt(page);
        expect(net.rows.filter((row) => row.method === 'GET' || row.method === 'HEAD').length, 'reads answered after the gestures').toBeGreaterThan(readsBefore);
        expect.soft(net.writes(), 'requests other than GET/HEAD (minus refresh, telemetry)').toEqual([]); // UMV:368-427 unreachable
        await shot(page, '27-G-006', 'read_only_wire');
      });
    } finally {
      await closeAll(flow);
    }
  });

  test('SCR-27 · FL-27-07 · furniture-only model, network monitor', async ({ browser }) => {
    let flow: MobileFlow | undefined;
    try {
      flow = await openMobileFlow(browser);
      const { page, net, context } = flow;
      const table = await seedLayer(flow, 'm27-table', tableOne); // QC:table-one
      let headAtMount = 0;

      await test.step('[27-C-002] H: furniture alone is a model', async () => {
        await openMobile(page, table.id, false);
        await expect(note(page, MV.partialRooms)).toBeVisible({ timeout: SCENE_TIMEOUT_MS }); // UMV:224-229
        await expect(page.getByRole('heading', { name: MV.emptyTitle, exact: true })).toHaveCount(0);
        await expect.poll(() => net.count('HEAD', /^\/$/u), { message: 'HEAD / at mount' }).toBeGreaterThanOrEqual(1);
        headAtMount = net.count('HEAD', /^\/$/u);
        await shot(page, '27-C-002', 'furniture_is_a_model');
      });

      await test.step('[27-A-023] Tap the table: badge, width, depth', async () => {
        await tapCanvas(page, 0.5, 0.5);
        await expect.soft(sheet(page).getByText('Đồ nội thất', { exact: true })).toBeVisible(); // MVG:217, TVM:453-461
        await expect.soft(sheet(page).locator('dl > div > dt')).toHaveText(['Chiều rộng', 'Chiều sâu']);
        await expect.soft(sheet(page).locator('dl > div > dd')).toHaveText(['800 mm', '600 mm']);
        await shot(page, '27-A-023', 'table_sheet');
      });

      await test.step('[27-B-009] Missing rooms beats weak network', async () => {
        await context.setOffline(true);
        await softly.poll(() => page.evaluate(() => navigator.onLine)).toBe(false);
        await afterFrames(page);
        await expect.soft(note(page, MV.partialRooms)).toBeVisible(); // UMV:464-470 rooms first
        await expect.soft(page.getByText(MV.weakNetwork, { exact: true })).toHaveCount(0);
        await shot(page, '27-B-009', 'rooms_beat_network');
      });

      await test.step('[27-G-004] The monitor pings HEAD / at mount and stops after leaving', async () => {
        await context.setOffline(false);
        await softly.poll(() => page.evaluate(() => navigator.onLine)).toBe(true);
        expect.soft(headAtMount, 'HEAD / requests seen at mount').toBe(1); // NM:40, 54-66, 131-160
        await spaNavigate(page, '/');
        await expect(page.getByRole('heading', { name: MV.dashboardTitle })).toBeVisible();
        await softly.poll(() => net.count('GET', /^\/api\/projects$/u, 200), { message: 'the dashboard list GET answered' }).toBeGreaterThanOrEqual(1);
        const leftAt = net.count('HEAD', /^\/$/u);
        await afterFrames(page);
        expect.soft(net.count('HEAD', /^\/$/u) - leftAt, 'HEAD / after leaving').toBe(0); // UMV:268-283 monitor.stop()
        await shot(page, '27-G-004', 'monitor_stops');
      });
    } finally {
      await closeAll(flow);
    }
  });

  test('SCR-27 · FL-27-08 · empty, long name, SPA switch', async ({ browser }) => {
    let flow: MobileFlow | undefined;
    try {
      flow = await openMobileFlow(browser);
      const { page, net, context } = flow;
      const empty = await createLongNameProject(flow); // E0L
      const q1 = await seedQc(flow, 'm27-spa'); // Q1

      await test.step('[27-B-003] H: empty project, no bundle requested', async () => {
        await page.goto(mobileUrl(empty.id));
        await expect(region(page)).toBeVisible();
        await expect(page.getByRole('heading', { name: MV.emptyTitle, exact: true })).toBeVisible({ timeout: SCENE_TIMEOUT_MS }); // UMV:224-229, 486-488
        await expect(page.getByText(MV.emptyDesc, { exact: true })).toBeVisible(); // MVV:105-114
        await expect.poll(() => net.count('GET', spatialRe(empty.id), 200)).toBe(1);
        expect.soft(net.count('GET', mountRe), 'GET /assets/pascal/pascal-mount.js').toBe(0); // UMV:338
        await shot(page, '27-B-003', 'empty_project');
      });

      await test.step('[27-B-004] BUG-373: usable area and the title fully on screen', async () => {
        const area = await region(page).locator('main').boundingBox(); // MVR:148-150 h-dvh, MVV:236
        expect.soft(area?.height ?? 0, 'main height (px)').toBeGreaterThan(PHONE.height / 3);
        await expect.soft(page.getByRole('heading', { name: MV.emptyTitle, exact: true })).toBeInViewport({ ratio: 1 });
        await shot(page, '27-B-004', 'usable_height');
      });

      await test.step('[27-B-023] 80-char name truncates in the 48 px header', async () => {
        const h1 = region(page).locator('h1');
        const metrics = await h1.evaluate((el) => {
          const style = getComputedStyle(el);
          return {
            ellipsis: style.textOverflow === 'ellipsis' && style.whiteSpace === 'nowrap',
            truncated: el.scrollWidth > el.clientWidth,
            oneLine: el.clientHeight <= parseFloat(style.lineHeight) * 1.5,
          };
        });
        expect.soft(metrics, 'h1 truncation').toEqual({ ellipsis: true, truncated: true, oneLine: true }); // MVV:217-223
        expect.soft((await region(page).locator('header').boundingBox())?.height, 'header height').toBe(48); // MVT:49
        await expect.soft(page.getByRole('heading', { level: 1, name: empty.name, exact: true })).toBeVisible(); // full accessible name
        await shot(page, '27-B-023', 'long_name');
      });

      await test.step('[27-C-001] Offline on the empty project: still the empty state', async () => {
        await context.setOffline(true);
        await softly.poll(() => page.evaluate(() => navigator.onLine)).toBe(false);
        await afterFrames(page);
        await expect.soft(page.getByRole('heading', { name: MV.emptyTitle, exact: true })).toBeVisible(); // UMV:472-508 empty > partial
        await expect.soft(page.getByText(MV.weakNetwork, { exact: true })).toHaveCount(0);
        await shot(page, '27-C-001', 'offline_empty');
        await context.setOffline(false);
      });

      await test.step('[27-C-003] SPA switch to another project never paints the old model under the new name', async () => {
        // A fresh load of E0L here keeps its #24 inside the 30 s cache window for 27-G-009 (MVQ:20-30).
        await page.goto(mobileUrl(empty.id));
        await expect(page.getByRole('heading', { name: MV.emptyTitle, exact: true })).toBeVisible({ timeout: SCENE_TIMEOUT_MS });
        const held = await holdRoute(page, 'GET', (path) => spatialRe(q1.id).test(path));
        await spaNavigate(page, `/m/du-an/${q1.id}`); // history.pushState + popstate
        await held.arrived;
        await expect.soft(region(page).getByRole('heading', { level: 1, name: q1.name, exact: true })).toBeVisible();
        await expect.soft(note(page, MV.loading)).toBeVisible(); // UMV:197-201 spatialLoading hides the old store
        await expect.soft(page.getByRole('heading', { name: MV.emptyTitle, exact: true })).toHaveCount(0);
        await expect.soft(successText(page)).toHaveCount(0);
        await shot(page, '27-C-003', 'switch_loading');
        held.release();
        await expect.soft(successText(page)).toBeAttached({ timeout: SCENE_TIMEOUT_MS });
      });

      await test.step('[27-G-009] Back to E0L within 30 s: #24 from cache, N15 re-read', async () => {
        const before = { project: net.count('GET', projectRe(empty.id)), spatial: net.count('GET', spatialRe(empty.id)) };
        await page.evaluate(() => window.history.back());
        await expect(page.getByRole('heading', { name: MV.emptyTitle, exact: true })).toBeVisible({ timeout: SCENE_TIMEOUT_MS });
        await softly.poll(() => net.count('GET', spatialRe(empty.id)) - before.spatial).toBe(1); // UPS:121 staleTime 0
        expect.soft(net.count('GET', projectRe(empty.id)) - before.project, 'new GET /api/projects/<E0L>').toBe(0); // MVQ:20-30
        await shot(page, '27-G-009', 'back_uses_cache');
      });
    } finally {
      await closeAll(flow);
    }
  });

  test('SCR-27 · FL-27-09 · compact 320', async ({ browser }) => {
    let flow: MobileFlow | undefined;
    try {
      flow = await openMobileFlow(browser, { viewport: COMPACT_PHONE });
      const { page } = flow;
      const q1 = await seedQc(flow, 'm27-320'); // Q1
      let timeOrigin = 0;

      await test.step('[27-A-035] H: three tools at 320, no "Chế độ xem" on the bar', async () => {
        await openMobile(page, q1.id, false);
        timeOrigin = await page.evaluate(() => performance.timeOrigin);
        await expect(nav(page).getByRole('button')).toHaveCount(3); // MVT:70, 147-151, UMV:164, MVB:126
        for (const label of [MV.floors, MV.measure, MV.info]) await expect(tool(page, label)).toBeVisible();
        await expect(tool(page, MV.view)).toHaveCount(0);
        await shot(page, '27-A-035', 'three_tools');
      });

      await test.step('[27-A-036] "Chế độ xem" row inside "Tầng"', async () => {
        await tool(page, MV.floors).click();
        const row = group(page, MV.floors).getByRole('button', { name: MV.view, exact: true }); // MVB:158-168
        await expect.soft(row).toHaveAttribute('aria-pressed', 'false');
        await shot(page, '27-A-036', 'view_row');
      });

      await test.step('[27-A-037] ⚑ the row switches the view mode', async () => {
        // UMV:440 maps `view` back to `floors` at compact width, so the row is a no-op (MVB:164): expected pressed after the tap.
        const row = group(page, MV.floors).getByRole('button', { name: MV.view, exact: true });
        await row.click();
        await afterFrames(page);
        await expect.soft(row).toHaveAttribute('aria-pressed', 'true');
        await shot(page, '27-A-037', 'view_row_pressed');
      });

      await test.step('[27-A-039] Collapsed state: no floating note, sr-only success', async () => {
        await expect.soft(region(page).locator('main p')).toHaveCount(0); // MVV:148-152, UMV:492-494
        await expect.soft(successText(page)).toBeAttached();
        await shot(page, '27-A-039', 'collapsed');
      });

      await test.step('[27-A-038] Live resize 375 → 320: 4 tools then 3, no reload', async () => {
        await page.setViewportSize(PHONE);
        await expect.soft(nav(page).getByRole('button')).toHaveCount(4); // UMV:248-262 matchMedia listener
        await shot(page, '27-A-038', 'resized_375');
        await page.setViewportSize(COMPACT_PHONE);
        await expect.soft(nav(page).getByRole('button')).toHaveCount(3);
        expect.soft(await page.evaluate(() => performance.timeOrigin), 'performance.timeOrigin (same document)').toBe(timeOrigin);
      });
    } finally {
      await closeAll(flow);
    }
  });

  test('SCR-27 · FL-27-10 · not found and bad routes', async ({ browser }) => {
    let flow: MobileFlow | undefined;
    try {
      flow = await openMobileFlow(browser);
      const { page } = flow;
      const unknown = `prj_qa-e05-${uniq()}`; // no seed
      let notFoundBody: unknown;
      const alert = page.getByRole('alert').filter({ hasText: MV.notFoundTitle });

      await test.step('[27-B-014] H: unknown id → not found, no region', async () => {
        const answered = page.waitForResponse((res) => res.request().method() === 'GET' && projectRe(unknown).test(new URL(res.url()).pathname));
        await page.goto(mobileUrl(unknown));
        const res = await answered;
        expect(res.status(), 'GET /api/projects/:p').toBe(404);
        notFoundBody = await res.json();
        await expect(alert).toBeVisible(); // PSG:37-61, 74-76
        await expect(alert.getByText(MV.notFoundDesc, { exact: true })).toBeVisible();
        await expect(alert.getByRole('button', { name: MV.backToProjects, exact: true })).toBeVisible();
        await expect(region(page)).toHaveCount(0);
        await shot(page, '27-B-014', 'not_found');
      });

      await test.step('[27-G-008] The 404 carries resource "project"', async () => {
        expect.soft(findKey(notFoundBody, 'resource'), 'resource in the 404 body').toBe('project'); // UPS:29-35, 206-209
        await shot(page, '27-G-008', 'not_found_resource');
      });

      await test.step('[27-B-016] BUG-490: the not-found icon is visible', async () => {
        const icon = await alert.evaluate((el) => {
          const circle = el.querySelector('div.rounded-full');
          const svg = circle?.querySelector('svg') ?? null;
          if (circle === null || svg === null) return null;
          const box = svg.getBoundingClientRect();
          return { width: box.width, height: box.height, color: getComputedStyle(svg).color, background: getComputedStyle(circle).backgroundColor };
        });
        expect.soft(icon, 'an svg inside the 48 px circle').not.toBeNull(); // PSG:54, ES:36-47
        expect.soft((icon?.width ?? 0) > 0 && (icon?.height ?? 0) > 0, 'svg box').toBe(true);
        expect.soft(icon?.color, 'svg colour differs from the circle background').not.toBe(icon?.background);
        await shot(page, '27-B-016', 'not_found_icon');
      });

      await test.step('[27-B-015] "Về danh sách dự án" goes to the dashboard', async () => {
        await alert.getByRole('button', { name: MV.backToProjects, exact: true }).click(); // PSG:57
        await softly.poll(() => new URL(page.url()).pathname).toBe('/');
        await shot(page, '27-B-015', 'back_to_dashboard');
      });

      await test.step('[27-B-025] /m/du-an/ without an id → the app not-found page', async () => {
        await page.goto('/m/du-an/');
        await expect.soft(page.getByRole('heading', { name: /^Không tìm thấy trang này\.?$/u })).toBeVisible(); // router:354, useNotFound.ts:98
        await shot(page, '27-B-025', 'bad_route');
      });
    } finally {
      await closeAll(flow);
    }
  });
});
