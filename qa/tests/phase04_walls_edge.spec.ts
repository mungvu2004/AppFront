/**
 * Phase 4 — SCR-16 walls (`WallLayerReview`), EDGE layer, REAL stack: thirteen sequential user flows (QA-04c P1,
 * `flow-plan.md` "phase04_walls_edge.spec.ts"). One `test()` per flow, one `test.step('[<row id>] …')` per catalog
 * row, in the planned order. `H` rows use a hard `expect`; every other row `expect.soft`. `⚑` rows assert the CORRECT
 * behaviour and stay red while the app is wrong. Each step captures `E04_<row id>_<slug>.png`.
 *
 * Source (FE `F:/App/AppFront/src`, this branch): W src/screens/qc/WallLayerReview/ (UW useWallLayerReview.ts,
 * WG wallLayerReviewGateway.ts, WLP WallLayerLeftPanel.tsx, WL WallLayerList.tsx, WI WallLayerInspector.tsx,
 * WTR WallLayerToolRail.tsx, WSB WallLayerStatusBar.tsx, WC WallLayerCanvas.tsx, WSF WallLayerShapeFigure.tsx,
 * FSB FloorLayerSaveBanner.tsx, FSC FloorLayerSaveConfirm.tsx) · UAS src/hooks/useAutosave.ts · SLS
 * src/lib/autosave/spatialLayerSave.ts · CA src/lib/autosave/createAutosave.ts · NB src/lib/mutations/notificationBus.ts ·
 * UFL src/hooks/useFloorLayer.ts · FLRF src/screens/qc/shared/floorLayerReadFailure.ts.
 *
 * ## Users and data
 * The env admin signs in once per flow (`openFlow`, one `POST /api/auth/login`) and owns the flow's own project
 * `qa-<runId>-e04-…` (Q1 = `layerSeed.createQcProject`, QC:<name> = a crafted layer written through #35). Wall ids are
 * `W-<TAG><NNN>` so list codes are `#W-001`… in creation order. Every project is deleted in `finally`
 * (`deleteSeededProject`). FL-16-11 uploads the env drawing as the pool admin `p04-walls` (own `drawings_init` bucket).
 * The tour is closed with `dismissTour` after every open (FL-X-01 owns the tour).
 *
 * ## Time
 * `page.clock` is installed (time flows) in every flow: "nothing was sent" claims run `quiet()` (clock +2.5 s, then
 * network idle); the debounce / max-wait / 8 s toast / 60 s label steps freeze the clock and move it with `runFor`.
 * No `waitForTimeout`.
 *
 * ## Request budget per full run (13 flows)
 * - `POST /api/auth/login`: 13 flow sessions + 13 API clients (+ 1 pool admin API for FL-16-11, + invitation 0 / 1).
 * - `POST /api/projects` 13 (+ DELETE in `finally`); N16 GET + #35 PUT: 2 per layered floor + the screen's own.
 * - `POST /api/auth/refresh`: ~1 per page load (≈ 40 loads).
 * - `drawings_init`: 1 (FL-16-11, pool admin `p04-walls`).
 */
import { expect, test, type APIRequestContext, type BrowserContext, type Locator, type Page } from '@playwright/test';

import { ROUTES } from '../../e2e/fixtures/routes';
import { TOUR_APPEAR_TIMEOUT_MS, dismissTour } from '../../e2e/fixtures/tour';
import { waitForApi } from '../../e2e/fullstack/apiWatch';
import { PIPELINE_TIMEOUT_MS, readBaseUrl } from '../../e2e/fullstack/env';
import { signedInApi } from './support/api';
import { dashboardLoaded } from './support/auth';
import { attachJson } from './support/evidence';
import { createPipelineDrawingProject, deleteSeededProject, envDrawingPng, poolUser } from './support/phase03Seed';
import { recordAnnouncements } from './support/p03/P5';
import {
  WALL,
  adminClient,
  approveButton,
  asRecord,
  asRecords,
  layerPath,
  pathOf,
  reviewRegion,
  uniq,
  esc,
  type Box,
  type WallSpec,
  clickAt,
  canvasSvg,
  gapPoint,
  polygonBox,
  wallPolygon,
  doorOn,
  idTag,
  openingIdOf,
  readWalls,
  sentBody,
  wallShape,
  canvasFrame,
  checkbox,
  closeWallsRun,
  codeOfLabel,
  codesOf,
  counter,
  ev,
  floorOf,
  freezeClock,
  inspector,
  layerRe,
  openWalls,
  openWallsRun,
  putsSince,
  quiet,
  rail,
  railButton,
  readLayer,
  recordTexts,
  rowLabels,
  secondWriter,
  seedQc,
  seedWalls,
  selectRow,
  selectedRows,
  sentWalls,
  stackOfWalls,
  statusBar,
  thicknessGroup,
  thickenFirst,
  tick,
  toggleCheckbox,
  toasts,
  waitForLayerPut,
  wallList,
  wallOption,
  wallRows,
  writesSince,
  SAVE_LABEL,
  type Json,
  type WallsRun,
} from './support/p04/P1';

/* ---------------------------------------------------------------- shared small helpers */

/** The wall of a Q1 layer that runs (0,0) → (4000,0): a 220 mm load-bearing wall with known length and points. */
function wallAt(walls: readonly Json[], x0: number, y0: number, x1: number, y1: number): Json {
  const found = walls.find((wall) => {
    const line = asRecord(wall.centreline, 'centreline');
    const [start, end] = [asRecord(line.start, 'start'), asRecord(line.end, 'end')];
    return start.x === x0 && start.y === y0 && end.x === x1 && end.y === y1;
  });
  if (found === undefined) throw new Error(`setup: no wall ${String(x0)},${String(y0)} → ${String(x1)},${String(y1)}`);
  return found;
}

/** `aria-checked` radio of the thickness group, as its visible label ("220 mm"), or `null` when none is checked. */
async function checkedThickness(page: Page): Promise<string | null> {
  const checked = thicknessGroup(page).getByRole('radio', { checked: true });
  return (await checked.count()) === 0 ? null : ((await checked.first().textContent()) ?? '').trim();
}

const radio = (page: Page, mm: number): Locator => thicknessGroup(page).getByRole('radio', { name: `${String(mm)} mm`, exact: true });

/** Label of the selected row's code, e.g. `#W-003`. */
async function selectedCode(page: Page): Promise<string> {
  const labels = await selectedRows(page).evaluateAll((rows) => rows.map((row) => row.getAttribute('aria-label') ?? ''));
  return (labels[0] ?? '').replace(/ — .*$/u, '');
}

/** Escape, then J until row `index` is selected (the list is virtualised: its row may not be in the DOM before). */
async function selectByKeys(page: Page, index: number, expectedCode: string): Promise<void> {
  await page.keyboard.press('Escape');
  for (let i = 0; i <= index; i += 1) await page.keyboard.press('j');
  await expect(inspector(page).getByText(expectedCode, { exact: true })).toBeVisible();
}

/** Runs the page clock past the 8 s undo window and the 5 s grouping window: no toast is left, no group is open. */
async function expireToasts(page: Page): Promise<void> {
  await page.clock.runFor(9_000);
  await expect(toasts(page).getByRole('status')).toHaveCount(0);
}

/* ================================================================= flows */

test.describe('E04 SCR-16 walls — real-stack flows (QA-04c P1)', () => {
  test('SCR-16 · FL-16-01 · list selection and keyboard: J/K bounds, Enter/Space, Ctrl+click, Ctrl+Enter, Esc', async ({ browser }) => {
    const api = await adminClient();
    let run: WallsRun | undefined;
    let projectId: string | undefined;
    try {
      const q1 = await seedQc(api, 'e04-16-01');
      projectId = q1.projectId;
      const floor = q1.floors[0]!;
      let codes: string[] = [];
      run = await openWallsRun(browser);
      const { page } = run;

      await test.step('[16-A-008] J with nothing selected selects the first row', async () => {
        await openWalls(page, q1.projectId, floor.id);
        await expect(wallRows(page)).toHaveCount(q1.walls.length);
        // The list is in graph order (N16 order), not code order.
        codes = (await rowLabels(page)).map(codeOfLabel);
        expect(codes.slice().sort(), 'the list shows every seeded wall').toEqual([...q1.codes.values()].sort());
        await expect(selectedRows(page)).toHaveCount(0);
        await page.keyboard.press('j');
        await expect(selectedRows(page)).toHaveCount(1);
        expect(await selectedCode(page), 'first row of the list').toBe(codes[0]);
        await expect(wallRows(page).first()).toHaveAttribute('aria-selected', 'true');
        await ev(page, '16-A-008', 'j-first-row');
      });

      await test.step('[16-A-007] J on the last row / K on the first row stays put', async () => {
        await page.keyboard.press('k');
        expect.soft(await selectedCode(page), 'K on the first row').toBe(codes[0]);
        for (let i = 0; i < codes.length + 2; i += 1) await page.keyboard.press('j');
        await expect.soft(selectedRows(page)).toHaveCount(1);
        expect.soft(await selectedCode(page), 'J past the last row').toBe(codes[codes.length - 1]);
        await page.keyboard.press('j');
        expect.soft(await selectedCode(page), 'one more J').toBe(codes[codes.length - 1]);
        await ev(page, '16-A-007', 'bounds-last-row');
      });

      await test.step('[16-A-010] Enter or Space on a focused row selects it', async () => {
        await wallOption(page, codes[2]!).focus();
        await page.keyboard.press('Enter');
        await expect.soft(wallOption(page, codes[2]!)).toHaveAttribute('aria-selected', 'true');
        await wallOption(page, codes[4]!).focus();
        await page.keyboard.press('Space');
        await expect.soft(wallOption(page, codes[4]!)).toHaveAttribute('aria-selected', 'true');
        await expect.soft(selectedRows(page)).toHaveCount(1);
        await ev(page, '16-A-010', 'enter-space-select');
      });

      await test.step('[16-E-002] Every row is its own Tab stop (tabIndex 0, no roving focus)', async () => {
        const tabindex = await wallRows(page).evaluateAll((rows) => rows.map((row) => row.getAttribute('tabindex')));
        expect.soft(tabindex, 'every row tabindex=0').toEqual(codes.map(() => '0'));
        await wallOption(page, codes[0]!).focus();
        const walked: string[] = [codes[0]!];
        for (let i = 1; i < codes.length; i += 1) {
          await page.keyboard.press('Tab');
          walked.push(await page.evaluate(() => (document.activeElement?.getAttribute('aria-label') ?? '').replace(/ — .*$/u, '')));
        }
        expect.soft(walked, 'Tab walks all rows in order').toEqual(codes);
        await page.keyboard.press('Tab');
        const after = await page.evaluate(() => document.activeElement?.getAttribute('role') ?? document.activeElement?.tagName ?? '');
        expect.soft(after, 'the Tab after the last row leaves the list').not.toBe('option');
        await ev(page, '16-E-002', 'tab-stops');
      });

      await test.step('[16-A-011] Ctrl+click adds a row; Ctrl+click again removes it', async () => {
        // The list marks only the LAST selected wall aria-selected (UW selectedWallId); the count shows in "nối đoạn".
        await wallOption(page, codes[0]!).click();
        await expect.soft(wallOption(page, codes[0]!)).toHaveAttribute('aria-selected', 'true');
        await expect.soft(railButton(page, WALL.mergeHint)).toBeDisabled();
        await wallOption(page, codes[1]!).click({ modifiers: ['Control'] });
        await expect.soft(railButton(page, WALL.merge)).toBeEnabled(); // two walls selected
        await expect.soft(wallOption(page, codes[1]!)).toHaveAttribute('aria-selected', 'true');
        await ev(page, '16-A-011', 'ctrl-click-two');
        await wallOption(page, codes[1]!).click({ modifiers: ['Control'] });
        await expect.soft(railButton(page, WALL.mergeHint)).toBeDisabled(); // back to one
        await expect.soft(wallOption(page, codes[0]!)).toHaveAttribute('aria-selected', 'true');
      });

      await test.step('[16-A-012] Ctrl+Enter on a focused row toggles it (keyboard multi-select)', async () => {
        await wallOption(page, codes[3]!).focus();
        await page.keyboard.press('Control+Enter');
        await expect.soft(railButton(page, WALL.merge)).toBeEnabled(); // codes[0] + codes[3]
        await expect.soft(wallOption(page, codes[3]!)).toHaveAttribute('aria-selected', 'true');
        await ev(page, '16-A-012', 'ctrl-enter-multi');
      });

      await test.step('[16-E-016] Shortcuts are inert while the focus is in a field and live on a focused row', async () => {
        await wallOption(page, codes[0]!).click();
        const filter = checkbox(page, WALL.onlyUnreviewed);
        await filter.focus();
        await page.keyboard.press('j');
        // isTextEntryTarget (shortcuts.ts:199-209): every <input> counts, so the filter checkbox is a field.
        expect.soft(await selectedCode(page), 'J inside a field').toBe(codes[0]);
        await wallOption(page, codes[0]!).focus();
        await page.keyboard.press('j');
        expect.soft(await selectedCode(page), 'J on a focused row').toBe(codes[1]);
        await ev(page, '16-E-016', 'shortcuts-in-field');
      });

      await test.step('[16-A-038] Esc clears the selection', async () => {
        await wallOption(page, codes[1]!).focus();
        await page.keyboard.press('Escape');
        await expect.soft(selectedRows(page)).toHaveCount(0);
        await expect.soft(page.getByText(WALL.inspectorEmpty, { exact: true })).toBeVisible();
        await ev(page, '16-A-038', 'esc-clears');
      });

      await test.step('[16-E-003] ⚑ the counter has an announced name (a role that supports aria-label)', async () => {
        const total = codes.length;
        const bar = counter(page);
        await expect.soft(bar).toHaveAttribute('aria-label', `0/${String(total)} tường đã duyệt`);
        const role = await bar.getAttribute('role');
        // WLP:262-270: aria-label sits on a plain <div>; a role-less div is ignored by most assistive technology.
        expect.soft(role, 'the counter carries a role that exposes its aria-label').not.toBeNull();
        await ev(page, '16-E-003', 'counter-name');
      });
    } finally {
      await closeWallsRun(run);
      if (projectId !== undefined) await deleteSeededProject(api, projectId);
      await api.dispose();
    }
  });

  test('SCR-16 · FL-16-02 · approve walk: filtered J/K, graph-order advance, wrap, last wall → success → "Sang lớp cửa và nội thất"', async ({ browser }) => {
    const api = await adminClient();
    let run: WallsRun | undefined;
    let projectId: string | undefined;
    try {
      // QC:walls-review. W1 unreviewed, W2 reviewed, W3 unreviewed (150 mm), W4 reviewed, W5 unreviewed, W6 reviewed.
      // Graph order W1..W6 (ids sort in creation order).
      const specs = stackOfWalls(6, (i) => ({
        reviewed: i === 1 || i === 3 || i === 5,
        ...(i === 2 ? { thicknessMm: 150 } : {}),
      }));
      const seeded = await seedWalls(api, 'e04-16-02', specs);
      projectId = seeded.project.projectId;
      const floor = floorOf(seeded.project);
      const code = (n: number): string => seeded.codes.get(seeded.ids[n - 1] as string) as string;
      run = await openWallsRun(browser);
      const { page } = run;
      let continueBefore = -1;
      // [16-C-016] is measured during the double click of [16-A-020] (the only 5 → 6 transition of the flow).
      const countUp: { labelAtClick: string | null; digitAt100: string | null; digitAt300: string | null } = {
        labelAtClick: null,
        digitAt100: null,
        digitAt300: null,
      };
      const reviewedDigits = (): Locator => counter(page).locator('span.font-mono.font-semibold');

      await test.step('[16-A-009] J / K walk the filtered rows only', async () => {
        await openWalls(page, seeded.project.projectId, floor.id);
        continueBefore = await page.getByRole('button', { name: WALL.continue, exact: true }).count();
        await toggleCheckbox(page, WALL.onlyUnreviewed);
        await expect(checkbox(page, WALL.onlyUnreviewed)).toBeChecked();
        await expect(wallRows(page)).toHaveCount(3);
        await wallOption(page, code(1)).click();
        await page.keyboard.press('j');
        expect(await selectedCode(page), 'J skips the reviewed W2').toBe(code(3));
        await page.keyboard.press('j');
        expect(await selectedCode(page), 'J skips the reviewed W4').toBe(code(5));
        await page.keyboard.press('k');
        expect(await selectedCode(page), 'K back to W3').toBe(code(3));
        await ev(page, '16-A-009', 'filtered-jk');
      });

      await test.step('[16-C-013] Approve auto-advance follows graph order, not the filtered list', async () => {
        await toggleCheckbox(page, WALL.onlyNonStandard);
        await expect(wallRows(page)).toHaveCount(1); // only W3 (150 mm, unreviewed)
        const put = waitForLayerPut(page, seeded.project.projectId, floor.id);
        await approveButton(page).click();
        expect.soft((await put).response.status()).toBe(200);
        // UW:859-868 nextUnreviewedWallId(walls, id): all walls of the level, not `rows`.
        await expect.soft(inspector(page).getByText(code(5), { exact: true })).toBeVisible();
        await expect.soft(wallOption(page, code(5))).toHaveCount(0);
        await ev(page, '16-C-013', 'advance-to-hidden-row');
      });

      await test.step('[16-A-017] Auto-advance wraps to the first unreviewed wall above when none is left below', async () => {
        const put = waitForLayerPut(page, seeded.project.projectId, floor.id);
        await approveButton(page).click(); // W5: below it only the reviewed W6
        expect.soft((await put).response.status()).toBe(200);
        await expect.soft(inspector(page).getByText(code(1), { exact: true })).toBeVisible();
        await ev(page, '16-A-017', 'wrap-to-first');
      });

      await test.step('[16-A-020] Double click "Duyệt đoạn này" sends one PUT', async () => {
        // Both filters off: W1 is back in the list (the approve button reads `rows`, see the note at [16-A-019]).
        await toggleCheckbox(page, WALL.onlyNonStandard);
        await toggleCheckbox(page, WALL.onlyUnreviewed);
        await expect(wallRows(page)).toHaveCount(6);
        const mark = run!.puts.length;
        const put = waitForLayerPut(page, seeded.project.projectId, floor.id);
        // Frozen clock: the 260 ms count-up (UW:1219-1220, WLP:264, rAF) only moves with runFor.
        await freezeClock(page);
        await approveButton(page).dblclick(); // W1 is the last unreviewed wall: nothing to advance to
        // The command applies async (UW:878 run().then): wait until W1 is reviewed (button disabled) before reading the label.
        await expect(approveButton(page)).toBeDisabled();
        countUp.labelAtClick = await counter(page).getAttribute('aria-label');
        await page.clock.runFor(100);
        countUp.digitAt100 = await reviewedDigits().textContent();
        await page.clock.runFor(200);
        countUp.digitAt300 = await reviewedDigits().textContent();
        await page.clock.runFor(700); // past the 800 ms autosave debounce
        expect.soft((await put).response.status()).toBe(200);
        await page.clock.resume();
        await quiet(page);
        expect.soft(putsSince(run!, mark), 'PUTs after a double click').toHaveLength(1);
        await ev(page, '16-A-020', 'double-click-one-put');
      });

      await test.step('[16-A-019] "Duyệt đoạn này" is disabled on an already reviewed wall', async () => {
        await expect.soft(approveButton(page)).toBeDisabled();
        await expect.soft(wallOption(page, code(1))).toHaveAccessibleName(`${code(1)} — ${WALL.reviewed}`);
        await ev(page, '16-A-019', 'approve-disabled');
      });

      await test.step('[16-A-018] Approving the last unreviewed wall: selection stays, state becomes success', async () => {
        expect.soft(await selectedCode(page), 'selection stays on W1').toBe(code(1));
        await expect.soft(inspector(page).getByText(code(1), { exact: true })).toBeVisible();
        await expect.soft(counter(page)).toHaveAttribute('aria-label', '6/6 tường đã duyệt');
        await expect.soft(approveButton(page)).toBeDisabled();
        await expect.soft(reviewedDigits()).toHaveClass(/text-state-verified/u);
        // WLP:294-300: the bar width is progressFraction * 100 %.
        await expect.soft(counter(page).locator('div.bg-state-verified')).toHaveAttribute('style', /width: 100%/u);
        await expect.soft(page.getByRole('button', { name: WALL.continue, exact: true })).toBeVisible();
        await ev(page, '16-A-018', 'last-wall-success');
      });

      await test.step('[16-B-004] Success: counter text-state-verified, bar bg-state-verified, button "Sang lớp cửa và nội thất"', async () => {
        const panel = counter(page);
        await expect.soft(panel.locator('span.font-mono.font-semibold')).toHaveClass(/text-state-verified/u);
        await expect.soft(panel.locator('div.bg-state-verified')).toHaveCount(1);
        await expect.soft(panel.locator('div.bg-state-verified')).toHaveAttribute('style', /width: 100%/u);
        await expect.soft(page.getByRole('button', { name: WALL.continue, exact: true })).toBeVisible();
        await ev(page, '16-B-004', 'success-state');
      });

      await test.step('[16-C-016] Count-up of the reviewed counter (260 ms) ends on the exact value', async () => {
        // Values captured at the [16-A-020] double click (clock frozen). Catalog: the aria-label is exact at once, only the
        // digits run. ⚑ UW:1219-1220 builds the label from reviewedCount.text (the running count), so it may read 5/6.
        await attachJson('E04_16-C-016_count-up.json', countUp);
        expect.soft(countUp.labelAtClick, '⚑ aria-label exact right after the approve').toBe('6/6 tường đã duyệt');
        expect.soft(countUp.digitAt100, 'mid-run digit is a whole number between 5 and 6').toMatch(/^[56]$/u);
        expect.soft(countUp.digitAt300, 'digits settled after the 260 ms run').toBe('6');
        await expect.soft(reviewedDigits()).toHaveText('6');
        await ev(page, '16-C-016', 'counter-settled');
      });

      await test.step('[16-A-022] "Bỏ qua" when no other unreviewed wall exists leaves the selection unchanged', async () => {
        const mark = run!.puts.length;
        await page.getByRole('button', { name: WALL.skip, exact: true }).click();
        expect.soft(await selectedCode(page)).toBe(code(1));
        await quiet(page);
        expect.soft(putsSince(run!, mark), 'Bỏ qua writes nothing').toHaveLength(0);
        await ev(page, '16-A-022', 'skip-nothing-left');
      });

      await test.step('[16-A-061] No row matches the filters → the no-match line', async () => {
        await toggleCheckbox(page, WALL.onlyUnreviewed); // every wall is approved now
        await expect.soft(page.getByText(WALL.noMatch, { exact: true })).toBeVisible();
        await expect.soft(wallList(page)).toHaveCount(0);
        await ev(page, '16-A-061', 'no-match-line');
      });

      await test.step('[16-A-077] Reload after an edit shows the server copy', async () => {
        await openWalls(page, seeded.project.projectId, floor.id);
        await expect.soft(wallOption(page, code(1))).toHaveAccessibleName(`${code(1)} — ${WALL.reviewed}`);
        await expect.soft(wallOption(page, code(5))).toHaveAccessibleName(`${code(5)} — ${WALL.reviewed}`);
        await ev(page, '16-A-077', 'reload-server-copy');
      });

      await test.step('[16-A-070] "Sang lớp cửa và nội thất" (success) opens objects', async () => {
        await page.getByRole('button', { name: WALL.continue, exact: true }).click();
        await expect.poll(() => new URL(page.url()).pathname).toBe(ROUTES.project.objects(seeded.project.projectId, floor.id));
        await ev(page, '16-A-070', 'objects-opened');
      });

      await test.step('[X4-A-009] "Sang lớp cửa và nội thất" shows only once every wall is approved → objects', async () => {
        expect.soft(continueBefore, 'the button was absent while walls were unreviewed').toBe(0);
        await expect.soft(page.getByRole('region', { name: 'Lớp đối tượng', exact: true })).toBeVisible();
        await ev(page, 'X4-A-009', 'continue-only-when-done');
      });

      await test.step('[17-A-003] Entry from SCR-16 "Sang lớp cửa và nội thất" once every wall is approved', async () => {
        await expect.soft(page.getByRole('region', { name: 'Lớp đối tượng', exact: true })).toBeVisible();
        expect.soft(new URL(page.url()).pathname).toBe(ROUTES.project.objects(seeded.project.projectId, floor.id));
        await ev(page, '17-A-003', 'objects-from-walls');
      });
    } finally {
      await closeWallsRun(run);
      if (projectId !== undefined) await deleteSeededProject(api, projectId);
      await api.dispose();
    }
  });

  test('SCR-16 · FL-16-03 · thickness radios, digits, autosave timing and save label, 100-step undo cap', async ({ browser }) => {
    test.setTimeout(300_000);
    const api = await adminClient();
    let run: WallsRun | undefined;
    let projectId: string | undefined;
    try {
      const q1 = await seedQc(api, 'e04-16-03');
      projectId = q1.projectId;
      const floor = q1.floors[0]!;
      const idOf = (wall: Json): string => String(wall.id);
      const codeOf = (wall: Json): string => q1.codes.get(idOf(wall)) as string;
      const wallA = wallAt(q1.walls, 0, 0, 4_000, 0);
      const partition = q1.walls.find((wall) => wall.thicknessMm === 200 && (wall.confidence as number) > 0.8);
      if (partition === undefined) throw new Error('setup: Q1 has no 200 mm partition');
      run = await openWallsRun(browser);
      const { page } = run;
      const labels = await recordTexts(page, SAVE_LABEL);
      const announced = await recordAnnouncements(page);
      const onFloor = { projectId: q1.projectId, floorId: floor.id };
      /** Presses `key` on the canvas scope and returns once the PUT it causes answered (registered first, so no race). */
      const editAndSave = async (key: string): Promise<void> => {
        const put = waitForLayerPut(page, onFloor.projectId, onFloor.floorId);
        await page.keyboard.press(key);
        expect((await put).response.status(), `PUT after "${key}"`).toBe(200);
      };

      await test.step('[16-B-019] Save label before any change', async () => {
        await openWalls(page, onFloor.projectId, onFloor.floorId);
        await expect(statusBar(page)).toContainText('Chưa có thay đổi');
        await ev(page, '16-B-019', 'save-label-idle');
      });

      await test.step('[16-E-007] Status bar role status; save label aria-live polite; the save is spoken through the announcer', async () => {
        await expect.soft(statusBar(page)).toBeVisible();
        await expect.soft(page.locator(SAVE_LABEL)).toHaveAttribute('aria-live', 'polite');
        await selectRow(page, codeOf(wallA));
        await editAndSave('1'); // 110 mm
        await expect.poll(async () => (await announced()).filter((text) => /^Đã lưu lúc \d{1,2}:\d{2}$/u.test(text)).length, { timeout: 5_000 }).toBeGreaterThan(0);
        await ev(page, '16-E-007', 'save-announced');
      });

      await test.step('[16-A-024] Click the radio that is already checked: no PUT', async () => {
        await expect(radio(page, 110)).toHaveAttribute('aria-checked', 'true');
        const mark = run!.puts.length;
        await radio(page, 110).click();
        await quiet(page);
        expect.soft(putsSince(run!, mark), 'same-value command').toHaveLength(0);
        await ev(page, '16-A-024', 'same-radio-no-put');
      });

      await test.step('[16-A-025] ArrowRight / ArrowLeft inside the radiogroup cycles 110 → 220 → 330 → 110: one PUT per key, focus moves', async () => {
        await radio(page, 110).focus();
        for (const next of [220, 330, 110]) {
          await editAndSave('ArrowRight');
          await expect.soft(radio(page, next)).toHaveAttribute('aria-checked', 'true');
          expect.soft(await page.evaluate(() => document.activeElement?.getAttribute('data-value')), `focus on ${String(next)}`).toBe(String(next));
        }
        await editAndSave('ArrowLeft');
        await expect.soft(radio(page, 330)).toHaveAttribute('aria-checked', 'true');
        await ev(page, '16-A-025', 'arrow-cycle');
      });

      await test.step('[16-A-026] Digits 1 / 2 / 3 set 110 / 220 / 330 mm on the selected wall', async () => {
        await wallOption(page, codeOf(wallA)).focus();
        for (const [key, mm] of [['1', 110], ['2', 220], ['3', 330]] as const) {
          await editAndSave(key);
          await expect.soft(radio(page, mm), `digit ${key}`).toHaveAttribute('aria-checked', 'true');
        }
        await ev(page, '16-A-026', 'digits-set-thickness');
      });

      await test.step('[16-A-027] Digits with nothing selected do nothing', async () => {
        await wallOption(page, codeOf(wallA)).focus();
        await page.keyboard.press('Escape');
        await expect(selectedRows(page)).toHaveCount(0);
        const mark = run!.puts.length;
        await page.keyboard.press('2');
        await quiet(page);
        expect.soft(putsSince(run!, mark), 'digit 2 with no selection').toHaveLength(0);
        await ev(page, '16-A-027', 'digit-no-selection');
      });

      await test.step('[16-B-034] Non-standard thickness: the radiogroup has no checked radio', async () => {
        await selectRow(page, codeOf(partition));
        expect.soft(await checkedThickness(page), '200 mm wall').toBeNull();
        await ev(page, '16-B-034', 'no-radio-checked');
      });

      await test.step('[16-B-035] Inspector values are formatted (length, height, material, advanced)', async () => {
        await selectRow(page, codeOf(wallA));
        const panel = inspector(page);
        await expect.soft(panel.getByText('4.000,00 mm', { exact: true })).toBeVisible();
        await expect.soft(panel.getByText('3.000,00 mm', { exact: true })).toBeVisible();
        await expect.soft(panel.getByText('tường chịu lực', { exact: true })).toBeVisible();
        await panel.getByRole('button', { name: WALL.advanced }).click();
        await expect.soft(panel.getByText(/^-?\d+,\d m$/u).first()).toBeVisible(); // Lệch Z
        await expect.soft(panel.getByText('(0; 0) mm', { exact: true })).toBeVisible();
        await expect.soft(panel.getByText('(4.000; 0) mm', { exact: true })).toBeVisible();
        await ev(page, '16-B-035', 'inspector-formats');
      });

      await test.step('[16-E-017] The advanced section button has aria-expanded / aria-controls', async () => {
        const button = inspector(page).getByRole('button', { name: WALL.advanced });
        await expect.soft(button).toHaveAttribute('aria-expanded', 'true');
        const controls = await button.getAttribute('aria-controls');
        expect.soft(controls, 'aria-controls').not.toBeNull();
        await expect.soft(page.locator(`[id="${controls ?? ''}"]`)).toBeVisible();
        await button.click();
        await expect.soft(button).toHaveAttribute('aria-expanded', 'false');
        await ev(page, '16-E-017', 'advanced-aria');
      });

      await test.step('[16-B-018] Save label sequence after an edit: dirty → saving → saved HH:mm; after 60 s "Đã lưu N phút trước"', async () => {
        const before = (await labels()).length;
        await wallOption(page, codeOf(wallA)).focus();
        await editAndSave('2');
        await expect.poll(async () => (await labels()).slice(before).some((text) => /^Đã lưu lúc \d{1,2}:\d{2}$/u.test(text)), { timeout: 5_000 }).toBe(true);
        const seen = (await labels()).slice(before);
        await attachJson('E04_16-B-018_label-sequence.json', { seen });
        const dirty = seen.indexOf('Có thay đổi chờ đồng bộ');
        const saving = seen.indexOf('Đang lưu…');
        expect.soft(dirty, 'dirty label seen').toBeGreaterThanOrEqual(0);
        expect.soft(saving, 'saving label seen after the dirty one').toBeGreaterThan(dirty);
        expect.soft(seen.findIndex((text) => /^Đã lưu lúc/u.test(text)), 'saved label after saving').toBeGreaterThan(saving);
        await ev(page, '16-B-018', 'label-saved');
        await page.clock.fastForward(61_000);
        await expect.soft(statusBar(page)).toContainText('Đã lưu 1 phút trước');
      });

      await test.step('[16-C-010] Autosave debounce 800 ms, max wait 5 s under continuous edits', async () => {
        await wallOption(page, codeOf(wallA)).focus();
        await freezeClock(page);
        // (a) one edit: nothing before 800 ms, one PUT after.
        const mark = run!.puts.length;
        await page.keyboard.press('1');
        await page.clock.runFor(799);
        await tick(page);
        expect.soft(putsSince(run!, mark), 'no PUT before the 800 ms debounce').toHaveLength(0);
        const first = waitForLayerPut(page, onFloor.projectId, onFloor.floorId);
        await page.clock.runFor(2);
        expect((await first).response.status()).toBe(200);
        // (b) 1 / 2 every 500 ms: the debounce never settles, the 5 s max wait sends.
        const mark2 = run!.puts.length;
        await page.keyboard.press('2');
        for (let i = 1; i <= 9; i += 1) {
          await page.clock.runFor(500);
          await page.keyboard.press(i % 2 === 1 ? '1' : '2');
        }
        await page.clock.runFor(400); // 4.9 s after the first edit of the burst
        await tick(page);
        expect.soft(putsSince(run!, mark2), 'no PUT before the 5 s max wait while editing continues').toHaveLength(0);
        const forced = waitForLayerPut(page, onFloor.projectId, onFloor.floorId);
        await page.clock.runFor(200);
        const sent = await forced;
        expect(sent.response.status()).toBe(200);
        expect.soft(sentWalls(sent).find((wall) => wall.id === idOf(wallA))?.thicknessMm, 'the PUT carries the last edit').toBe(110);
        await page.clock.runFor(900);
        await tick(page);
        await page.clock.resume(); // evidence waits for a real rAF; the paused clock would hang it
        await ev(page, '16-C-010', 'debounce-max-wait');
      });

      await test.step('[16-C-011] Several edits inside 800 ms coalesce into one PUT carrying all of them', async () => {
        const rows = (await rowLabels(page)).map(codeOfLabel);
        await page.clock.resume();
        await selectRow(page, rows[0] as string);
        await freezeClock(page);
        const mark = run!.puts.length;
        await page.keyboard.press('3');
        await page.keyboard.press('j');
        await page.keyboard.press('3');
        await page.keyboard.press('j');
        await page.keyboard.press('3');
        const one = waitForLayerPut(page, onFloor.projectId, onFloor.floorId);
        await page.clock.runFor(900);
        const sent = await one;
        await tick(page);
        const byCode = (code: string): Json | undefined => sentWalls(sent).find((wall) => q1.codes.get(idOf(wall)) === code);
        expect.soft(putsSince(run!, mark), 'one PUT for three edits').toHaveLength(1);
        for (const code of rows.slice(0, 3)) expect.soft(byCode(code)?.thicknessMm, `${code} in the same PUT`).toBe(330);
        await ev(page, '16-C-011', 'coalesced-put');
      });

      await test.step('[16-C-015] Undo history is capped at 100 steps: 101 edits, 100 Mod+Z reach the first edit, not before', async () => {
        await page.clock.resume();
        await selectRow(page, codeOf(partition)); // 200 mm: no radio checked before the first edit
        await freezeClock(page);
        const digits = ['1', '2', '3'] as const; // edit k sets digits[(k - 1) % 3]; the first edit is 110 mm
        for (let k = 1; k <= 101; k += 1) await page.keyboard.press(digits[(k - 1) % 3] as string);
        for (let n = 1; n <= 100; n += 1) await page.keyboard.press('Control+z');
        expect.soft(await checkedThickness(page), 'after 100 undos the state is the first edit').toBe('110 mm');
        await page.keyboard.press('Control+z');
        expect.soft(await checkedThickness(page), 'a 101st undo reaches nothing (the original 200 mm is out of the history)').toBe('110 mm');
        await ev(page, '16-C-015', 'undo-cap-100');
        await page.clock.resume();
      });
    } finally {
      await closeWallsRun(run);
      if (projectId !== undefined) await deleteSeededProject(api, projectId);
      await api.dispose();
    }
  });

  test('SCR-16 · FL-16-04 · delete, shared toast, undo stack, toast after a later edit', async ({ browser }) => {
    test.setTimeout(180_000);
    const api = await adminClient();
    let run: WallsRun | undefined;
    let projectId: string | undefined;
    try {
      // QC:walls-q1-door: eight 220 mm walls, a door hosted by wall 5 (index 4). Counter-led ids: codes #W-100.. do not shift.
      const tag = idTag();
      const doorId = openingIdOf(tag, 0);
      const seeded = await seedWalls(api, 'e04-16-04', stackOfWalls(8, (i) => (i === 4 ? { openingIds: [doorId] } : {})), {
        tag,
        openings: [doorOn(tag, 4)],
      });
      projectId = seeded.project.projectId;
      const floor = floorOf(seeded.project);
      const idAt = (n: number): string => seeded.ids[n] as string;
      const codeAt = (n: number): string => seeded.codes.get(idAt(n)) as string;
      run = await openWallsRun(browser);
      const { page } = run;
      const onFloor = { projectId: seeded.project.projectId, floorId: floor.id };
      const putWith = (present: readonly string[], absent: readonly string[] = [], openingsAbsent: readonly string[] = []) =>
        waitForLayerPut(page, onFloor.projectId, onFloor.floorId, (body) => {
          const layer = asRecord(body.layer, '#35.layer');
          const wallIds = asRecords(layer.walls, 'walls').map((wall) => String(wall.id));
          const openingIds = asRecords(layer.openings, 'openings').map((opening) => String(opening.id));
          return present.every((id) => wallIds.includes(id)) && absent.every((id) => !wallIds.includes(id)) && openingsAbsent.every((id) => !openingIds.includes(id));
        });
      const rowCount = (): Promise<number> => wallRows(page).count();

      await test.step('[16-A-032] Backspace with nothing selected does nothing, 0 PUT', async () => {
        await openWalls(page, onFloor.projectId, onFloor.floorId);
        await expect(wallRows(page)).toHaveCount(8);
        const mark = run!.puts.length;
        await page.keyboard.press('Backspace');
        await quiet(page);
        expect.soft(putsSince(run!, mark), 'Backspace with no selection').toHaveLength(0);
        await expect.soft(wallRows(page)).toHaveCount(8);
        await expect.soft(toasts(page).getByRole('status')).toHaveCount(0);
        await ev(page, '16-A-032', 'backspace-no-selection');
      });

      await test.step('[16-A-034] Mod+Z with an empty stack does nothing, 0 PUT', async () => {
        const mark = run!.puts.length;
        await page.keyboard.press('Control+z');
        await quiet(page);
        expect.soft(putsSince(run!, mark), 'Mod+Z with an empty stack').toHaveLength(0);
        await expect.soft(wallRows(page)).toHaveCount(8);
        await ev(page, '16-A-034', 'undo-empty-stack');
      });

      await test.step('[16-C-004] Deleting a wall removes its openings in the same PUT; undo restores both', async () => {
        await selectRow(page, codeAt(4));
        const removed = putWith([], [idAt(4)], [doorId]);
        await page.keyboard.press('Backspace');
        expect.soft((await removed).response.status(), 'PUT without the wall and its door').toBe(200);
        await expect.soft(wallRows(page)).toHaveCount(7);
        await ev(page, '16-C-004', 'delete-host-wall');
        const restored = putWith([idAt(4)]);
        await page.keyboard.press('Control+z');
        const sent = await restored;
        expect.soft(asRecords(asRecord(sentBody(sent).layer, 'layer').openings, 'openings').map((opening) => opening.id), 'door back in the same PUT').toContain(doorId);
        await expect.soft(wallRows(page)).toHaveCount(8);
      });

      await test.step('[16-C-009] Display codes match across list, canvas aria-label, inspector and toast', async () => {
        await expireToasts(page);
        const code = codeAt(2);
        await selectRow(page, code);
        expect.soft(await selectedCode(page), 'list').toBe(code);
        await expect.soft(wallShape(page, code), 'canvas g[aria-label]').toHaveCount(1);
        await expect.soft(inspector(page).getByText(code, { exact: true })).toBeVisible();
        const removed = putWith([], [idAt(2)]);
        await page.keyboard.press('Backspace');
        await expect.soft(toasts(page).getByText(`Đã xoá tường ${code}.`, { exact: true })).toBeVisible();
        await removed;
        await ev(page, '16-C-009', 'codes-match-toast');
        const restored = putWith([idAt(2)]);
        await page.keyboard.press('Control+z');
        await restored;
      });

      await test.step('[16-E-013] Toast region "Thông báo"; "Hoàn tác" is reachable by Tab', async () => {
        await expireToasts(page);
        await selectRow(page, codeAt(3));
        const removed = putWith([], [idAt(3)]);
        await page.keyboard.press('Backspace');
        await removed;
        await expect.soft(toasts(page)).toBeVisible();
        const undo = toasts(page).getByRole('button', { name: 'Hoàn tác', exact: true });
        await expect(undo).toBeVisible();
        await wallRows(page).last().focus();
        let reached = false;
        for (let i = 0; i < 80 && !reached; i += 1) {
          await page.keyboard.press('Tab');
          reached = await page.evaluate(
            () => document.activeElement?.textContent?.includes('Hoàn tác') === true && document.activeElement.closest('[aria-label="Thông báo"]') !== null,
          );
        }
        expect.soft(reached, 'Tab reaches the toast "Hoàn tác"').toBe(true);
        await ev(page, '16-E-013', 'toast-undo-tab');
        const restored = putWith([idAt(3)]);
        await page.keyboard.press('Enter');
        await restored;
        await expect.soft(wallRows(page)).toHaveCount(8);
      });

      await test.step('[16-A-030] Two deletes within 5 s share one toast; "Hoàn tác" restores both', async () => {
        await expireToasts(page);
        await selectRow(page, codeAt(0));
        await page.keyboard.press('Backspace');
        await expect(wallRows(page)).toHaveCount(7);
        await page.keyboard.press('j'); // nothing selected after a delete: J selects the first remaining row
        await page.keyboard.press('Backspace');
        await expect(wallRows(page)).toHaveCount(6);
        await expect.soft(toasts(page).getByRole('status')).toHaveCount(1);
        await expect.soft(toasts(page).getByText(/Hoàn tác 2 thay đổi/u)).toBeVisible(); // NB:162-181 "{title} — Hoàn tác 2 thay đổi"
        await ev(page, '16-A-030', 'grouped-toast');
        await toasts(page).getByRole('button', { name: 'Hoàn tác', exact: true }).click();
        await expect.soft(wallRows(page)).toHaveCount(8);
        await quiet(page);
      });

      await test.step('[16-C-014] ⚑ The delete toast "Hoàn tác" after a later edit restores the DELETED wall and keeps B\'s edit', async () => {
        await expireToasts(page);
        await selectRow(page, codeAt(0));
        await page.keyboard.press('Backspace'); // A deleted
        await expect(wallRows(page)).toHaveCount(7);
        await page.keyboard.press('j'); // B = the first remaining row
        await expect(selectedRows(page)).toHaveCount(1);
        expect.soft(await selectedCode(page), 'B is the second seeded wall').toBe(codeAt(1));
        await page.keyboard.press('3'); // B → 330 mm (a later edit)
        await expect.soft(radio(page, 330)).toHaveAttribute('aria-checked', 'true');
        await toasts(page).getByRole('button', { name: 'Hoàn tác', exact: true }).click();
        await quiet(page);
        const server = await readWalls(api, onFloor.projectId, onFloor.floorId);
        await attachJson('E04_16-C-014_after-toast-undo.json', { walls: server.map((wall) => ({ id: wall.id, thicknessMm: wall.thicknessMm })) });
        // C1 Notes: the toast ticket pops the TOP of the screen stack (B's edit), so A stays deleted and B is back to 220.
        expect.soft(server.some((wall) => wall.id === idAt(0)), 'the deleted wall A is back').toBe(true);
        expect.soft(server.find((wall) => wall.id === idAt(1))?.thicknessMm, "B keeps its 330 mm edit").toBe(330);
        await ev(page, '16-C-014', 'toast-undo-after-edit');
      });

      await test.step('[16-A-035] ⚑ Ctrl+Shift+Z (redo) changes nothing the screen did not write', async () => {
        await openWalls(page, onFloor.projectId, onFloor.floorId); // a clean baseline: the server copy
        const rows = await wallRows(page).count();
        await selectRow(page, codeAt(5));
        const before = { labels: await rowLabels(page), checked: await checkedThickness(page), counter: await counter(page).getAttribute('aria-label') };
        const mark = run!.puts.length;
        await page.keyboard.press('Control+Shift+z');
        await quiet(page);
        const after = { labels: await rowLabels(page), checked: await checkedThickness(page), counter: await counter(page).getAttribute('aria-label') };
        await attachJson('E04_16-A-035_redo.json', { rows, before, after, puts: putsSince(run!, mark).length });
        // RT:223-225 / UW:1285: the screen has no redo binding; Ctrl+Shift+Z must not reach the global zundo redo.
        expect.soft(after, 'screen state after Ctrl+Shift+Z').toEqual(before);
        expect.soft(putsSince(run!, mark), 'Ctrl+Shift+Z writes nothing').toHaveLength(0);
        await ev(page, '16-A-035', 'redo-chord');
      });

      await test.step('[16-A-031] The delete toast leaves after its 8 s window; Mod+Z still undoes', async () => {
        await expireToasts(page);
        const before = await rowCount();
        await selectRow(page, codeAt(6));
        await page.keyboard.press('Backspace');
        await expect(wallRows(page)).toHaveCount(before - 1);
        await expect(toasts(page).getByRole('status')).toHaveCount(1);
        await page.clock.runFor(8_100);
        await expect.soft(toasts(page).getByRole('status')).toHaveCount(0);
        await ev(page, '16-A-031', 'toast-gone');
        await page.keyboard.press('Control+z');
        await expect.soft(wallRows(page)).toHaveCount(before);
      });
    } finally {
      await closeWallsRun(run);
      if (projectId !== undefined) await deleteSeededProject(api, projectId);
      await api.dispose();
    }
  });

  test('SCR-16 · FL-16-05 · canvas tools: rail, draw (W), split by tool and menu, centrelines', async ({ browser }) => {
    test.setTimeout(180_000);
    const api = await adminClient();
    let run: WallsRun | undefined;
    let projectId: string | undefined;
    try {
      // QC:walls-tools: a 4 m wall at y = 0 (the one that gets split) and two more 2.5 m below it.
      const seeded = await seedWalls(api, 'e04-16-05', [
        { from: [0, 0], to: [4_000, 0] },
        { from: [0, 2_500], to: [4_000, 2_500] },
        { from: [0, 5_000], to: [4_000, 5_000] },
      ]);
      projectId = seeded.project.projectId;
      const floor = floorOf(seeded.project);
      const code = (n: number): string => seeded.codes.get(seeded.ids[n] as string) as string;
      run = await openWallsRun(browser);
      const { page } = run;
      const onFloor = { projectId: seeded.project.projectId, floorId: floor.id };
      const tool = (name: string | RegExp): Locator => railButton(page, name);
      const totalIs = (n: number) => waitForLayerPut(page, onFloor.projectId, onFloor.floorId, (body) => asRecords(asRecord(body.layer, 'layer').walls, 'walls').length === n);
      let splitPut: ReturnType<typeof totalIs> | undefined;
      const lengthOf = (wall: Json): number => {
        const line = asRecord(wall.centreline, 'centreline');
        const [a, b] = [asRecord(line.start, 'start'), asRecord(line.end, 'end')];
        return Math.hypot(Number(b.x) - Number(a.x), Number(b.y) - Number(a.y));
      };

      await test.step('[16-E-004] Rail toolbar "Công cụ lớp tường", vertical; the active tool has aria-pressed', async () => {
        await openWalls(page, onFloor.projectId, onFloor.floorId);
        await expect(wallRows(page)).toHaveCount(3);
        await expect(rail(page)).toBeVisible();
        await expect.soft(rail(page)).toHaveAttribute('aria-orientation', 'vertical');
        await expect.soft(tool('chọn (phím V)')).toHaveAttribute('aria-pressed', 'true');
        await expect.soft(tool('vẽ tường (phím W)')).toHaveAttribute('aria-pressed', 'false');
        await ev(page, '16-E-004', 'rail-toolbar');
      });

      await test.step('[16-E-014] ⚑ Rail labels follow A6 sentence case', async () => {
        const names = await rail(page).getByRole('button').evaluateAll((buttons) => buttons.map((button) => button.getAttribute('aria-label') ?? ''));
        await attachJson('E04_16-E-014_rail-labels.json', { names });
        const lower = names.filter((name) => !/^\p{Lu}/u.test(name));
        // WTR:62-70: "chọn", "vẽ tường", "đo", "nối đoạn" are lower-case beside "Tách đoạn" and "Thu gọn hai panel".
        expect.soft(lower, 'rail labels that do not start with a capital').toEqual([]);
        await ev(page, '16-E-014', 'rail-label-case');
      });

      await test.step('[16-E-015] ⚑ "Tách đoạn" carries its X shortcut', async () => {
        await expect.soft(tool(/^Tách đoạn \(phím X\)$/u)).toHaveCount(1); // shortcutForTool('splitWall') is X
        await page.keyboard.press('x');
        await expect.soft(tool(/^Tách đoạn/u)).toHaveAttribute('aria-pressed', 'true');
        await ev(page, '16-E-015', 'split-shortcut-x');
        await page.keyboard.press('v');
        await expect(tool('chọn (phím V)')).toHaveAttribute('aria-pressed', 'true');
      });

      await test.step('[16-A-041] W key activates the draw tool', async () => {
        await page.keyboard.press('w');
        await expect.soft(tool('vẽ tường (phím W)')).toHaveAttribute('aria-pressed', 'true');
        await ev(page, '16-A-041', 'w-draw-tool');
      });

      await test.step('[16-A-040] Two canvas clicks draw a new 110 mm wall; the tool stays active', async () => {
        const [a, b] = [await gapPoint(page, code(0), code(1), 0.25), await gapPoint(page, code(0), code(1), 0.75)];
        const put = totalIs(4);
        await clickAt(page, a);
        await clickAt(page, b);
        const sent = await put;
        expect.soft(sent.response.status()).toBe(200);
        await expect.soft(wallRows(page)).toHaveCount(4);
        const added = sentWalls(sent).filter((wall) => !seeded.ids.includes(String(wall.id)));
        expect.soft(added, 'one new wall in the PUT').toHaveLength(1);
        expect.soft(added[0]?.thicknessMm, 'new wall thickness').toBe(110);
        await expect.soft(tool('vẽ tường (phím W)')).toHaveAttribute('aria-pressed', 'true');
        await ev(page, '16-A-040', 'wall-drawn');
      });

      await test.step('[16-C-007] Two draw clicks on the same point: no wall, no PUT', async () => {
        const mark = run!.puts.length;
        const point = await gapPoint(page, code(1), code(2), 0.5);
        await clickAt(page, point);
        await clickAt(page, point);
        await quiet(page);
        await expect.soft(wallRows(page)).toHaveCount(4);
        expect.soft(putsSince(run!, mark), 'zero-length wall').toHaveLength(0);
        await ev(page, '16-C-007', 'same-point-no-wall');
      });

      await test.step('[16-A-063] "Hiện tim tường" draws centrelines; draw / split tools turn them on until the user overrides', async () => {
        const lines = canvasSvg(page).locator('g[aria-label] > line');
        await expect.soft(checkbox(page, WALL.centrelines)).toBeChecked(); // draw tool is active
        await expect.soft(lines).toHaveCount(4);
        await ev(page, '16-A-063', 'centrelines-on');
        await toggleCheckbox(page, WALL.centrelines);
        await expect.soft(lines).toHaveCount(0); // the user's override beats the tool default
        await toggleCheckbox(page, WALL.centrelines);
        await page.keyboard.press('v');
        await expect.soft(lines).toHaveCount(4); // still the override, with the select tool
      });

      await test.step('[16-A-039] Esc after the first click of a draw gesture cancels it and keeps the selection', async () => {
        await page.keyboard.press('w');
        await selectRow(page, code(1));
        const point = await gapPoint(page, code(1), code(2), 0.4);
        const mark = run!.puts.length;
        await clickAt(page, point); // first point only
        await page.keyboard.press('Escape');
        await expect.soft(wallOption(page, code(1))).toHaveAttribute('aria-selected', 'true'); // UW:1287-1304 cancels first, then deselects
        await clickAt(page, point); // would complete the wall if the gesture had survived Esc
        await quiet(page);
        await expect.soft(wallRows(page)).toHaveCount(4);
        expect.soft(putsSince(run!, mark), 'a cancelled gesture writes nothing').toHaveLength(0);
        await page.keyboard.press('Escape');
        await ev(page, '16-A-039', 'esc-cancels-gesture');
      });

      await test.step('[16-A-042] ⚑ "Tách đoạn" rail tool, then ONE click on a wall splits it', async () => {
        await page.keyboard.press('v');
        await tool(/^Tách đoạn/u).click();
        await expect(tool(/^Tách đoạn/u)).toHaveAttribute('aria-pressed', 'true');
        splitPut = totalIs(5);
        await wallPolygon(page, code(0)).click();
        const sent = await splitPut;
        expect.soft(sent.response.status()).toBe(200);
        await expect.soft(wallRows(page)).toHaveCount(5);
        await ev(page, '16-A-042', 'split-by-tool');
      });

      await test.step('[16-C-006] Split keeps the total length; the two pieces have distinct ids', async () => {
        const sent = await splitPut!;
        const pieces = sentWalls(sent).filter((wall) => {
          const line = asRecord(wall.centreline, 'centreline');
          return asRecord(line.start, 'start').y === 0 && asRecord(line.end, 'end').y === 0;
        });
        expect.soft(pieces, 'two walls on the split line').toHaveLength(2);
        expect.soft(new Set(pieces.map((wall) => wall.id)).size, 'distinct ids').toBe(2);
        expect.soft(pieces.reduce((sum, wall) => sum + lengthOf(wall), 0), 'summed length').toBeCloseTo(4_000, 0);
        await ev(page, '16-C-006', 'split-total-length');
      });

      await test.step('[16-A-043] Context menu "Tách đoạn", then one click on the wall splits at the click point', async () => {
        await wallPolygon(page, code(1)).click({ button: 'right' });
        const menu = page.getByRole('menu', { name: 'Tuỳ chọn', exact: true });
        await expect(menu).toBeVisible();
        await menu.getByRole('menuitem', { name: 'Tách đoạn', exact: true }).click();
        const box = await polygonBox(page, code(1));
        const put = totalIs(6);
        await clickAt(page, { x: box.x + box.width * 0.25, y: box.y + box.height / 2 });
        const sent = await put;
        expect.soft(sent.response.status()).toBe(200);
        await expect.soft(wallRows(page)).toHaveCount(6);
        const pieces = sentWalls(sent).filter((wall) => asRecord(asRecord(wall.centreline, 'c').start, 's').y === 2_500);
        const shorter = Math.min(...pieces.map(lengthOf));
        expect.soft(shorter, 'cut near a quarter of the 4 m wall').toBeGreaterThan(700);
        expect.soft(shorter, 'cut near a quarter of the 4 m wall').toBeLessThan(1_300);
        await ev(page, '16-A-043', 'split-by-menu');
      });

      await test.step('[16-A-044] A split click outside every wall changes nothing and sends no PUT', async () => {
        await tool(/^Tách đoạn/u).click();
        const mark = run!.puts.length;
        await clickAt(page, await gapPoint(page, code(1), code(2), 0.5));
        await quiet(page);
        await expect.soft(wallRows(page)).toHaveCount(6);
        expect.soft(putsSince(run!, mark), 'split outside a wall').toHaveLength(0);
        await ev(page, '16-A-044', 'split-outside-wall');
      });
    } finally {
      await closeWallsRun(run);
      if (projectId !== undefined) await deleteSeededProject(api, projectId);
      await api.dispose();
    }
  });

  test('SCR-16 · FL-16-06 · measure tool, polygon multi-select, merge rules', async ({ browser }) => {
    test.setTimeout(150_000);
    const api = await adminClient();
    let run: WallsRun | undefined;
    let projectId: string | undefined;
    try {
      // QC:walls-merge: a collinear pair of different thickness (0 + 1), a perpendicular pair (2 + 3) and a third wall (4).
      const seeded = await seedWalls(api, 'e04-16-06', [
        { from: [0, 0], to: [2_000, 0], thicknessMm: 220 },
        { from: [2_000, 0], to: [4_000, 0], thicknessMm: 110 },
        { from: [0, 2_000], to: [2_000, 2_000] },
        { from: [2_000, 2_000], to: [2_000, 4_000] },
        { from: [0, 5_000], to: [4_000, 5_000] },
      ]);
      projectId = seeded.project.projectId;
      const floor = floorOf(seeded.project);
      const code = (n: number): string => seeded.codes.get(seeded.ids[n] as string) as string;
      run = await openWallsRun(browser);
      const { page } = run;
      const tool = (name: string | RegExp): Locator => railButton(page, name);
      const measureLabel = canvasFrame(page).getByText(/^\d{1,3}(\.\d{3})*,\d{2} mm$/u);
      const merge = (): Locator => railButton(page, WALL.merge);
      const mergeDisabled = (): Locator => railButton(page, WALL.mergeHint);
      /** Two clicks of the measure tool in the band between the y = 0 walls and the y = 2000 walls. */
      const measureOnce = async (fromFx: number, toFx: number): Promise<void> => {
        await clickAt(page, await gapPoint(page, code(0), code(2), fromFx));
        await page.mouse.move((await gapPoint(page, code(0), code(2), toFx)).x, (await gapPoint(page, code(0), code(2), toFx)).y);
        await clickAt(page, await gapPoint(page, code(0), code(2), toFx));
      };

      await test.step('[16-A-048] "đo (phím M)": first click, move, second click → live label, then a committed label', async () => {
        await openWalls(page, seeded.project.projectId, floor.id);
        await expect(wallRows(page)).toHaveCount(5);
        await page.keyboard.press('m');
        await expect(tool('đo (phím M)')).toHaveAttribute('aria-pressed', 'true');
        await clickAt(page, await gapPoint(page, code(0), code(2), 0.2));
        const away = await gapPoint(page, code(0), code(2), 0.8);
        await page.mouse.move(away.x, away.y);
        await expect.soft(measureLabel, 'live label while moving').toHaveCount(1);
        await ev(page, '16-A-048', 'measure-live');
        await clickAt(page, away);
        await expect.soft(measureLabel, 'committed label').toHaveCount(1);
        const text = await measureLabel.first().textContent();
        await attachJson('E04_16-A-048_measure.json', { committedLabel: text });
        expect.soft(text, 'x.xxx,xx mm').toMatch(/^\d{1,3}(\.\d{3})*,\d{2} mm$/u);
        await ev(page, '16-A-048', 'measure-committed');
      });

      await test.step('[16-A-049] The measurement label clears on a tool switch, Esc, or a new first click', async () => {
        await page.keyboard.press('v');
        await expect.soft(measureLabel, 'tool switch').toHaveCount(0);
        await page.keyboard.press('m');
        await measureOnce(0.3, 0.6);
        await expect(measureLabel).toHaveCount(1);
        await page.keyboard.press('Escape');
        await expect.soft(measureLabel, 'Esc').toHaveCount(0);
        await measureOnce(0.3, 0.7);
        await expect(measureLabel).toHaveCount(1);
        const committed = await measureLabel.first().textContent();
        await clickAt(page, await gapPoint(page, code(0), code(2), 0.1)); // a new first click
        // The old committed label is gone; a live label (distance 0 from the new start) may take its place.
        await expect.soft(measureLabel.filter({ hasText: committed ?? 'x' })).toHaveCount(0);
        await ev(page, '16-A-049', 'measure-cleared');
      });

      await test.step('[16-A-050] V returns to the select tool', async () => {
        await page.keyboard.press('Escape');
        await page.keyboard.press('v');
        await expect.soft(tool('chọn (phím V)')).toHaveAttribute('aria-pressed', 'true');
        await expect.soft(tool('đo (phím M)')).toHaveAttribute('aria-pressed', 'false');
        await ev(page, '16-A-050', 'v-select-tool');
      });

      await test.step('[16-A-014] Ctrl+click a polygon toggles it in the selection', async () => {
        await wallPolygon(page, code(2)).click();
        await wallPolygon(page, code(3)).click({ modifiers: ['Control'] });
        await page.mouse.move(2, 2); // no hover outline
        await expect.soft(merge(), 'two polygons selected').toBeEnabled();
        await expect.soft(canvasSvg(page).locator('polygon.opacity-100'), 'two outlined polygons').toHaveCount(2);
        await ev(page, '16-A-014', 'ctrl-click-polygons');
      });

      await test.step('[16-A-046] "nối đoạn" on a perpendicular pair: enabled, nothing merges, no PUT, no message', async () => {
        const mark = run!.puts.length;
        await merge().click();
        await quiet(page);
        await expect.soft(wallRows(page)).toHaveCount(5);
        expect.soft(putsSince(run!, mark), 'refused merge').toHaveLength(0);
        await expect.soft(page.getByRole('alert')).toHaveCount(0);
        await expect.soft(toasts(page).getByRole('status')).toHaveCount(0);
        await ev(page, '16-A-046', 'perpendicular-merge-refused');
      });

      await test.step('[16-E-011] Merge button name when disabled', async () => {
        await wallPolygon(page, code(4)).click(); // a plain click replaces the selection
        await expect.soft(mergeDisabled()).toBeDisabled();
        await expect.soft(mergeDisabled()).toHaveAccessibleName('nối đoạn — Chọn hai đoạn tường để gộp');
        await ev(page, '16-E-011', 'merge-disabled-name');
      });

      await test.step('[16-A-047] Three walls selected: "nối đoạn" is disabled', async () => {
        await wallPolygon(page, code(2)).click({ modifiers: ['Control'] });
        await wallPolygon(page, code(3)).click({ modifiers: ['Control'] });
        await page.mouse.move(2, 2);
        await expect.soft(canvasSvg(page).locator('polygon.opacity-100')).toHaveCount(3);
        await expect.soft(mergeDisabled()).toBeDisabled();
        await ev(page, '16-A-047', 'three-selected');
      });

      await test.step('[16-C-005] Merge is refused for collinear walls of different thickness', async () => {
        await wallPolygon(page, code(0)).click();
        await wallPolygon(page, code(1)).click({ modifiers: ['Control'] });
        await expect.soft(merge()).toBeEnabled();
        const mark = run!.puts.length;
        await merge().click();
        await quiet(page);
        await expect.soft(wallRows(page)).toHaveCount(5);
        expect.soft(putsSince(run!, mark), '220 + 110 mm').toHaveLength(0);
        await ev(page, '16-C-005', 'thickness-mismatch-merge-refused');
      });
    } finally {
      await closeWallsRun(run);
      if (projectId !== undefined) await deleteSeededProject(api, projectId);
      await api.dispose();
    }
  });

  test('SCR-16 · FL-16-07 · wall context menu by mouse and keyboard', async ({ browser }) => {
    test.setTimeout(150_000);
    const api = await adminClient();
    let run: WallsRun | undefined;
    let projectId: string | undefined;
    try {
      // QC:walls-q1-reviewed: wall 0 human + reviewed, the others AI.
      const seeded = await seedWalls(api, 'e04-16-07', stackOfWalls(5, (i) => ({ reviewed: i === 0 })));
      projectId = seeded.project.projectId;
      const floor = floorOf(seeded.project);
      const code = (n: number): string => seeded.codes.get(seeded.ids[n] as string) as string;
      run = await openWallsRun(browser);
      const { page } = run;
      const onFloor = { projectId: seeded.project.projectId, floorId: floor.id };
      const menu = page.getByRole('menu', { name: 'Tuỳ chọn', exact: true });
      const item = (name: string): Locator => menu.getByRole('menuitem', { name, exact: true });
      const openMenu = async (n: number): Promise<void> => {
        await wallPolygon(page, code(n)).click({ button: 'right' });
        await expect(menu).toBeVisible();
      };

      await test.step('[16-A-051] Right-click a wall opens the context menu and selects the wall', async () => {
        await openWalls(page, onFloor.projectId, onFloor.floorId);
        await openMenu(1);
        for (const name of ['Duyệt', 'Đổi độ dày', 'Tách đoạn', 'Xoá']) await expect.soft(item(name)).toBeVisible();
        await expect.soft(wallOption(page, code(1))).toHaveAttribute('aria-selected', 'true');
        await ev(page, '16-A-051', 'context-menu-open');
        await page.keyboard.press('Escape');
        await expect(menu).toHaveCount(0);
      });

      await test.step('[16-A-052] ⚑ Menu "Duyệt" approves (PUT); on a reviewed wall it is not offered', async () => {
        await openMenu(1);
        const put = waitForLayerPut(page, onFloor.projectId, onFloor.floorId);
        await item('Duyệt').click();
        const sent = await put;
        expect.soft(sentWalls(sent).find((wall) => wall.id === seeded.ids[1])?.reviewed, 'wall 1 reviewed in the PUT').toBe(true);
        await openMenu(0); // wall 0 is already reviewed
        const approve = menu.getByRole('menuitem', { name: 'Duyệt', exact: true });
        // WC:handleOpenMenu offers "Duyệt" for every wall; on a reviewed wall it is a silent no-op today.
        const offered = (await approve.count()) > 0 && (await approve.isEnabled());
        expect.soft(offered, '"Duyệt" absent or disabled on a reviewed wall').toBe(false);
        await ev(page, '16-A-052', 'approve-on-reviewed');
        await page.keyboard.press('Escape');
        await expect(menu).toHaveCount(0);
      });

      await test.step('[16-A-053] ⚑ Menu "Đổi độ dày" selects the wall and moves the focus to the thickness radios', async () => {
        await openMenu(2);
        await item('Đổi độ dày').click();
        await expect.soft(thicknessGroup(page)).toBeVisible();
        const inside = await page.evaluate(() => document.activeElement?.closest('[role="radiogroup"]') !== null && document.activeElement !== null);
        // WH comment: the entry should move the focus to the radios; today it only selects the wall.
        expect.soft(inside, 'focus is on the thickness radios').toBe(true);
        await ev(page, '16-A-053', 'change-thickness-entry');
      });

      await test.step('[16-A-054] Menu "Xoá" deletes with the undo toast', async () => {
        await openMenu(3);
        const put = waitForLayerPut(page, onFloor.projectId, onFloor.floorId, (body) => !asRecords(asRecord(body.layer, 'layer').walls, 'walls').some((wall) => wall.id === seeded.ids[3]));
        await item('Xoá').click();
        await expect.soft(toasts(page).getByText(`Đã xoá tường ${code(3)}.`, { exact: true })).toBeVisible();
        expect.soft((await put).response.status()).toBe(200);
        await expect.soft(wallRows(page)).toHaveCount(4);
        await ev(page, '16-A-054', 'menu-delete-toast');
      });

      await test.step('[16-A-055] Esc or an outside click closes the menu and changes nothing', async () => {
        const mark = run!.puts.length;
        await openMenu(4);
        await page.keyboard.press('Escape');
        await expect.soft(menu).toHaveCount(0);
        await openMenu(4);
        await page.getByRole('status', { name: WALL.statusBar, exact: true }).click({ position: { x: 5, y: 5 } });
        await expect.soft(menu).toHaveCount(0);
        await quiet(page);
        expect.soft(putsSince(run!, mark), 'closing the menu writes nothing').toHaveLength(0);
        await ev(page, '16-A-055', 'menu-closed');
      });

      await test.step('[16-E-009] Context menu keyboard: ArrowDown / ArrowUp move, Enter runs, Esc closes', async () => {
        await openMenu(4);
        await expect.soft(item('Duyệt')).toBeFocused();
        await page.keyboard.press('ArrowDown');
        await expect.soft(item('Đổi độ dày')).toBeFocused();
        await page.keyboard.press('ArrowUp');
        await expect.soft(item('Duyệt')).toBeFocused();
        await page.keyboard.press('ArrowUp'); // wraps to the last item
        await expect.soft(item('Xoá')).toBeFocused();
        await ev(page, '16-E-009', 'menu-arrow-keys');
        await page.keyboard.press('ArrowUp');
        await expect.soft(item('Tách đoạn')).toBeFocused();
        await page.keyboard.press('Enter'); // runs "Tách đoạn": selects the wall and activates the split tool
        await expect.soft(menu).toHaveCount(0);
        await expect.soft(railButton(page, /^Tách đoạn/u)).toHaveAttribute('aria-pressed', 'true');
        await page.keyboard.press('v');
        await openMenu(4);
        await page.keyboard.press('Escape');
        await expect.soft(menu).toHaveCount(0);
      });

      await test.step('[16-E-010] ⚑ A keyboard way to open the wall context menu (ContextMenu key / Shift+F10)', async () => {
        await wallOption(page, code(4)).focus();
        await page.keyboard.press('ContextMenu');
        const viaKey = await menu.count();
        if (viaKey > 0) await page.keyboard.press('Escape');
        await wallOption(page, code(4)).focus();
        await page.keyboard.press('Shift+F10');
        const viaShift = await menu.count();
        await attachJson('E04_16-E-010_keyboard-menu.json', { contextMenuKey: viaKey, shiftF10: viaShift });
        expect.soft(viaKey + viaShift, 'a keyboard gesture opens the wall menu').toBeGreaterThan(0);
        await ev(page, '16-E-010', 'keyboard-open-menu');
      });
    } finally {
      await closeWallsRun(run);
      if (projectId !== undefined) await deleteSeededProject(api, projectId);
      await api.dispose();
    }
  });

  test('SCR-16 · FL-16-08 · filters, project threshold, row status, legend bands', async ({ browser }) => {
    test.setTimeout(150_000);
    const api = await adminClient();
    let run: WallsRun | undefined;
    let projectId: string | undefined;
    try {
      // QC:walls-filters. 0: .50 · 1: .69 · 2: .70 · 3: .95 + 150 mm · 4: reviewed + 200 mm · 5: .60 + 150 mm · 6: .80 · 7: .95
      const seeded = await seedWalls(api, 'e04-16-08', [
        { ...stackOfWalls(8)[0]!, confidence: 0.5 },
        { ...stackOfWalls(8)[1]!, confidence: 0.69 },
        { ...stackOfWalls(8)[2]!, confidence: 0.7 },
        { ...stackOfWalls(8)[3]!, confidence: 0.95, thicknessMm: 150 },
        { ...stackOfWalls(8)[4]!, reviewed: true, thicknessMm: 200 },
        { ...stackOfWalls(8)[5]!, confidence: 0.6, thicknessMm: 150 },
        { ...stackOfWalls(8)[6]!, confidence: 0.8 },
        { ...stackOfWalls(8)[7]!, confidence: 0.95 },
      ]);
      projectId = seeded.project.projectId;
      // The backend default threshold is 0.75, so wall 2 (0.70) would be low: pin the documented 0.70 first.
      const pinned = await api.put(`/api/projects/${seeded.project.projectId}/settings`, {
        data: { buildingType: 'residential', lengthUnit: 'mm', snapToleranceMm: 50, confidenceThreshold: 0.7, defaultScaleMmPerPx: 1 },
      });
      expect(pinned.status(), `setup: PUT settings ${(await pinned.text()).slice(0, 200)}`).toBe(200);
      const floor = floorOf(seeded.project);
      const code = (n: number): string => seeded.codes.get(seeded.ids[n] as string) as string;
      const codesIn = async (page: Page): Promise<string[]> => (await rowLabels(page)).map(codeOfLabel);
      const expectRows = async (page: Page, wanted: readonly number[], why: string): Promise<void> => {
        await expect(wallRows(page)).toHaveCount(wanted.length);
        expect.soft(await codesIn(page), why).toEqual(wanted.map(code));
      };
      run = await openWallsRun(browser);
      const { page } = run;
      const onFloor = { projectId: seeded.project.projectId, floorId: floor.id };

      await test.step('[16-B-030] A low-confidence unreviewed row and polygon: 45° hatch at 6 % + attention dot, never red', async () => {
        await openWalls(page, onFloor.projectId, onFloor.floorId);
        await expect(wallRows(page)).toHaveCount(8);
        const hatch = (n: number): Locator => wallOption(page, code(n)).locator('span[style*="repeating-linear-gradient"]');
        await expect.soft(hatch(0)).toHaveCount(1);
        await expect.soft(hatch(2), 'conf 0.70 is not low').toHaveCount(0);
        const style = (await hatch(0).getAttribute('style')) ?? '';
        expect.soft(style).toContain('45deg');
        expect.soft(style).toContain('opacity: 0.06');
        expect.soft(style, 'attention colour, not violation').not.toContain('violation');
        await expect.soft(wallShape(page, code(0)).locator('circle'), 'attention dot on the canvas').toHaveCount(1);
        await expect.soft(wallShape(page, code(0)).locator('polygon[fill^="url("]'), 'hatch polygon').toHaveCount(1);
        await expect.soft(wallShape(page, code(2)).locator('circle')).toHaveCount(0);
        await ev(page, '16-B-030', 'low-confidence-hatch');
      });

      await test.step('[16-B-031] Row status: unreviewed non-standard → "Cần chú ý"; reviewed → "Đã duyệt"; else "Bình thường"', async () => {
        await expect.soft(wallOption(page, code(3))).toHaveAccessibleName(`${code(3)} — Cần chú ý`);
        await expect.soft(wallOption(page, code(3)).getByText('Cần chú ý', { exact: true })).toBeVisible();
        await expect.soft(wallOption(page, code(4))).toHaveAccessibleName(`${code(4)} — Đã duyệt`);
        await expect.soft(wallOption(page, code(4)).locator('[title="Đã duyệt"]')).toHaveCount(1);
        await expect.soft(wallOption(page, code(7))).toHaveAccessibleName(`${code(7)} — Bình thường`);
        await expect.soft(wallOption(page, code(7)).locator('[title="Bình thường"]')).toHaveCount(1);
        await ev(page, '16-B-031', 'row-statuses');
      });

      await test.step('[16-B-032] ⚑ The legend lists only the bands present plus "Khác" for other thicknesses (BUG-416)', async () => {
        const legend = canvasFrame(page).getByRole('group', { name: 'Lọc theo độ dày tường', exact: true });
        await expect.soft(legend).toBeVisible();
        await expect.soft(legend.getByText('220 mm', { exact: true })).toBeVisible();
        await expect.soft(legend.getByText('Khác', { exact: true })).toBeVisible(); // 150 and 200 mm walls
        await expect.soft(legend.getByText('110 mm', { exact: true })).toHaveCount(0);
        await expect.soft(legend.getByText('330 mm', { exact: true })).toHaveCount(0);
        await ev(page, '16-B-032', 'legend-bands');
      });

      await test.step('[16-A-057] "Chỉ hiện độ tin cậy thấp" keeps confidence < the project threshold (default 0,70)', async () => {
        await toggleCheckbox(page, WALL.onlyLow);
        await expect(checkbox(page, WALL.onlyLow)).toBeChecked();
        await expectRows(page, [0, 1, 5], 'rows below 0.70');
        await ev(page, '16-A-057', 'low-confidence-filter');
      });

      await test.step('[16-C-001] Low confidence is a strict < threshold: 0,70 is not low, 0,69 is', async () => {
        await expect.soft(wallOption(page, code(1))).toHaveCount(1);
        await expect.soft(wallOption(page, code(2))).toHaveCount(0);
        await ev(page, '16-C-001', 'strict-threshold');
      });

      await test.step('[16-A-059] "Chỉ hiện độ dày không chuẩn" keeps the rows that are not 110 / 220 / 330 mm', async () => {
        await toggleCheckbox(page, WALL.onlyLow);
        await toggleCheckbox(page, WALL.onlyNonStandard);
        await expectRows(page, [3, 4, 5], 'non-standard thickness');
        await ev(page, '16-A-059', 'non-standard-filter');
      });

      await test.step('[16-A-060] Filters combine (AND): unreviewed AND low AND non-standard', async () => {
        await toggleCheckbox(page, WALL.onlyLow);
        await toggleCheckbox(page, WALL.onlyUnreviewed);
        await expectRows(page, [5], 'all three filters');
        await ev(page, '16-A-060', 'filters-and');
      });

      await test.step('[16-A-062] Filters narrow only the list: the canvas still draws every wall', async () => {
        await expect.soft(canvasSvg(page).locator('g[aria-label]')).toHaveCount(8);
        await ev(page, '16-A-062', 'canvas-unfiltered');
      });

      await test.step('[16-A-037] Ctrl+S with nothing dirty sends no PUT', async () => {
        const mark = run!.puts.length;
        await page.keyboard.press('Control+s');
        await quiet(page);
        expect.soft(putsSince(run!, mark), 'Ctrl+S with nothing changed').toHaveLength(0);
        await ev(page, '16-A-037', 'ctrl-s-nothing-dirty');
      });

      await test.step('[16-A-058] The low-confidence filter uses the project threshold from Settings (BUG-354 fix)', async () => {
        const saved = await api.put(`/api/projects/${seeded.project.projectId}/settings`, {
          data: { buildingType: 'residential', lengthUnit: 'mm', snapToleranceMm: 50, confidenceThreshold: 0.9, defaultScaleMmPerPx: 1 },
        });
        expect(saved.status(), `setup: PUT settings ${(await saved.text()).slice(0, 200)}`).toBe(200);
        await openWalls(page, onFloor.projectId, onFloor.floorId);
        await toggleCheckbox(page, WALL.onlyLow);
        await expectRows(page, [0, 1, 2, 5, 6], 'rows below 0.90');
        await expect.soft(wallOption(page, code(6)), 'a 0.80 wall counts as low').toHaveCount(1);
        await ev(page, '16-A-058', 'project-threshold-0.90');
      });
    } finally {
      await closeWallsRun(run);
      if (projectId !== undefined) await deleteSeededProject(api, projectId);
      await api.dispose();
    }
  });

  test('SCR-16 · FL-16-09 · canvas view: fit once, zoom, F, minimap, cursor, hover, 300 walls virtualised, reduced motion', async ({ browser }) => {
    test.setTimeout(240_000);
    const api = await adminClient();
    let run: WallsRun | undefined;
    let projectId: string | undefined;
    try {
      // QC:walls-300: 20 rows x 15 columns of 3 m walls (#W-100 .. #W-399), none overlapping.
      const specs: WallSpec[] = Array.from({ length: 300 }, (_, i) => {
        const [row, col] = [i % 20, Math.floor(i / 20)];
        return { from: [col * 3_500, row * 600], to: [col * 3_500 + 3_000, row * 600] } as const;
      });
      const seeded = await seedWalls(api, 'e04-16-09', specs);
      projectId = seeded.project.projectId;
      const floor = floorOf(seeded.project);
      const code = (n: number): string => seeded.codes.get(seeded.ids[n] as string) as string;
      run = await openWallsRun(browser);
      const { page } = run;
      const onFloor = { projectId: seeded.project.projectId, floorId: floor.id };
      const zoomLabel = (): Promise<string> => page.getByRole('button', { name: /^Mức thu phóng / }).getAttribute('aria-label').then((label) => label ?? '');
      const zoomButton = (name: string): Locator => canvasFrame(page).getByRole('button', { name, exact: true });
      /** Union of the wall polygons in page space, plus the frame box. */
      const extent = async (): Promise<{ left: number; top: number; right: number; bottom: number; frame: Box }> =>
        canvasSvg(page).evaluate((svg) => {
          const frame = svg.getBoundingClientRect();
          const boxes = [...svg.querySelectorAll('g[aria-label] polygon:first-of-type')].map((el) => el.getBoundingClientRect());
          return {
            left: Math.min(...boxes.map((b) => b.left)),
            top: Math.min(...boxes.map((b) => b.top)),
            right: Math.max(...boxes.map((b) => b.right)),
            bottom: Math.max(...boxes.map((b) => b.bottom)),
            frame: { x: frame.x, y: frame.y, width: frame.width, height: frame.height },
          };
        });
      let fitted: Awaited<ReturnType<typeof extent>> | undefined;
      const centreOf = async (n: number): Promise<{ x: number; y: number }> => {
        const box = await polygonBox(page, code(n));
        return { x: box.x + box.width / 2, y: box.y + box.height / 2 };
      };

      await test.step('[16-B-036] ⚑ The canvas draws one polygon per wall, fitted inside the frame (BUG-403)', async () => {
        await openWalls(page, onFloor.projectId, onFloor.floorId);
        await expect(canvasSvg(page).locator('g[aria-label]')).toHaveCount(300);
        fitted = await extent();
        await attachJson('E04_16-B-036_extent.json', fitted);
        const { left, top, right, bottom, frame } = fitted;
        expect.soft(left, 'left edge inside the frame').toBeGreaterThanOrEqual(frame.x - 1);
        expect.soft(top, 'top edge inside the frame').toBeGreaterThanOrEqual(frame.y - 1);
        expect.soft(right, 'right edge inside the frame').toBeLessThanOrEqual(frame.x + frame.width + 1);
        expect.soft(bottom, 'bottom edge inside the frame').toBeLessThanOrEqual(frame.y + frame.height + 1);
        await ev(page, '16-B-036', 'fitted-plan');
      });

      await test.step('[16-A-074] ⚑ Opening a floor fits the whole plan once at 100 %; a later edit does not re-zoom (BUG-403)', async () => {
        await expect.soft(page.getByRole('button', { name: /^Mức thu phóng 100%/ })).toBeVisible();
        await selectRow(page, code(0));
        const put = waitForLayerPut(page, onFloor.projectId, onFloor.floorId);
        await page.keyboard.press('3'); // a thickness change
        await put;
        const after = await extent();
        expect.soft(Math.abs(after.right - after.left - (fitted!.right - fitted!.left)), 'plan width unchanged by the edit').toBeLessThan(3);
        expect.soft(Math.abs(after.left - fitted!.left), 'plan left edge unchanged by the edit').toBeLessThan(3);
        await ev(page, '16-A-074', 'no-rezoom-after-edit');
      });

      await test.step('[16-E-008] Canvas: frame group and svg img share one label; wall <g role="presentation"> is not keyboard reachable', async () => {
        const label = await canvasFrame(page).getAttribute('aria-label');
        await expect.soft(canvasSvg(page)).toHaveAttribute('aria-label', label ?? '');
        const shapes = await canvasSvg(page).locator('g[aria-label]').evaluateAll((nodes) => ({
          roles: [...new Set(nodes.map((node) => node.getAttribute('role')))],
          tabbable: nodes.filter((node) => node.hasAttribute('tabindex')).length,
        }));
        expect.soft(shapes.roles).toEqual(['presentation']);
        expect.soft(shapes.tabbable, 'wall <g> elements with a tabindex').toBe(0);
        await ev(page, '16-E-008', 'canvas-labels');
      });

      await test.step('[16-A-071] "Phóng to" / "Thu nhỏ" step 25 %, clamped 10 %..1000 %', async () => {
        await zoomButton('Phóng to').click();
        expect.soft(await zoomLabel()).toBe('Mức thu phóng 125%, bấm để về 100%');
        await ev(page, '16-A-071', 'zoom-125');
        for (let i = 0; i < 8; i += 1) await zoomButton('Thu nhỏ').click();
        expect.soft(await zoomLabel(), 'clamped at the minimum').toBe('Mức thu phóng 10%, bấm để về 100%');
        for (let i = 0; i < 45; i += 1) await zoomButton('Phóng to').click();
        expect.soft(await zoomLabel(), 'clamped at the maximum').toBe('Mức thu phóng 1000%, bấm để về 100%');
      });

      await test.step('[16-A-072] The zoom % button resets to 100 %; "Vừa khung nhìn" fits the selected wall, else every wall', async () => {
        await page.getByRole('button', { name: /^Mức thu phóng / }).click();
        expect.soft(await zoomLabel()).toBe('Mức thu phóng 100%, bấm để về 100%');
        const target = code(130);
        await selectByKeys(page, 130, target);
        await zoomButton('Vừa khung nhìn').click();
        const box = await polygonBox(page, target);
        const frame = (await extent()).frame;
        expect.soft(Math.abs(box.x + box.width / 2 - (frame.x + frame.width / 2)), 'selected wall centred horizontally').toBeLessThan(60);
        expect.soft(Math.abs(box.y + box.height / 2 - (frame.y + frame.height / 2)), 'selected wall centred vertically').toBeLessThan(60);
        await ev(page, '16-A-072', 'fit-selected-wall');
        await page.keyboard.press('Escape');
        await zoomButton('Vừa khung nhìn').click();
        const all = await extent();
        expect.soft(all.left, 'every wall left of the fit').toBeGreaterThanOrEqual(all.frame.x - 1);
        expect.soft(all.right, 'every wall right of the fit').toBeLessThanOrEqual(all.frame.x + all.frame.width + 1);
      });

      await test.step('[16-A-073] The F key fits the selected wall (or the whole layer)', async () => {
        await page.getByRole('button', { name: /^Mức thu phóng / }).click();
        const target = code(40);
        await selectByKeys(page, 40, target);
        await page.keyboard.press('f');
        const box = await polygonBox(page, target);
        const frame = (await extent()).frame;
        expect.soft(Math.abs(box.x + box.width / 2 - (frame.x + frame.width / 2)), 'F centres the selected wall').toBeLessThan(60);
        expect.soft(await zoomLabel(), 'F zooms in').not.toBe('Mức thu phóng 100%, bấm để về 100%');
        await ev(page, '16-A-073', 'f-key-fit');
        await page.keyboard.press('Escape');
        await page.keyboard.press('f');
        const all = await extent();
        expect.soft(all.left).toBeGreaterThanOrEqual(all.frame.x - 1);
        expect.soft(all.right).toBeLessThanOrEqual(all.frame.x + all.frame.width + 1);
      });

      await test.step('[16-A-075] Mini map: click / drag moves the view; Enter or Space centres', async () => {
        await page.getByRole('button', { name: /^Mức thu phóng / }).click();
        await zoomButton('Phóng to').click();
        await zoomButton('Phóng to').click();
        await zoomButton('Phóng to').click();
        const map = page.getByRole('region', { name: 'Bản đồ thu nhỏ', exact: true });
        const surface = map.getByRole('button', { name: 'Bấm để di chuyển vùng nhìn', exact: true });
        const frameRect = map.locator('div.border-accent');
        const read = async (): Promise<string> => (await frameRect.getAttribute('style')) ?? '';
        const before = await read();
        const probe = await centreOf(0).catch(() => null); // null = no box: the check below then fails, never passes
        const box = await surface.boundingBox();
        if (box === null) throw new Error('mini map has no box');
        await surface.click({ position: { x: box.width * 0.15, y: box.height * 0.2 } });
        const moved = await read();
        expect.soft(moved, 'the viewport frame of the mini map moved').not.toBe(before);
        const probeAfter = await centreOf(0).catch(() => null);
        expect.soft(probe !== null && probeAfter !== null && (probe.x !== probeAfter.x || probe.y !== probeAfter.y), `the canvas moved with it: ${JSON.stringify({ probe, probeAfter })}`).toBe(true);
        await surface.click({ position: { x: box.width * 0.85, y: box.height * 0.8 } });
        expect.soft(await read(), 'a second click moves it again').not.toBe(moved);
        await surface.focus();
        await page.keyboard.press('Enter');
        const centred = await read();
        await attachJson('E04_16-A-075_minimap.json', { before, moved, centred });
        const [left, width] = [Number(/left:\s*([\d.]+)%/u.exec(centred)?.[1]), Number(/width:\s*([\d.]+)%/u.exec(centred)?.[1])];
        expect.soft(Math.abs(left + width / 2 - 50), 'Enter centres the mini map frame').toBeLessThan(2);
        await ev(page, '16-A-075', 'minimap');
      });

      await test.step('[16-A-076] Status bar cursor: idle text → "(x; y) mm" on move → idle again on leaving the frame', async () => {
        await page.mouse.move(2, 2);
        const cursor = statusBar(page).locator('span').first();
        await expect.soft(cursor).toHaveText('Chưa rê chuột lên bản vẽ');
        const frame = (await extent()).frame;
        await page.mouse.move(frame.x + frame.width / 2, frame.y + frame.height / 2);
        await page.mouse.move(frame.x + frame.width / 2 + 7, frame.y + frame.height / 2 + 5);
        await expect.soft(cursor).toHaveText(/^\(?-?[\d.,]+;\s*-?[\d.,]+\)?/u);
        await ev(page, '16-A-076', 'cursor-on-canvas');
        await page.mouse.move(2, 2);
        await expect.soft(cursor).toHaveText('Chưa rê chuột lên bản vẽ');
      });

      await test.step('[16-A-015] Hover a row ↔ hover the polygon (cross highlight)', async () => {
        await page.getByRole('button', { name: /^Mức thu phóng / }).click();
        await page.keyboard.press('f');
        const target = code(3);
        await page.keyboard.press('Escape');
        await wallOption(page, target).hover();
        await expect.soft(canvasSvg(page).locator(`g[aria-label="${target}"] polygon.opacity-100`), 'outline on hover of the row').toHaveCount(1);
        await ev(page, '16-A-015', 'hover-row');
        await wallPolygon(page, target).hover();
        await expect.soft(wallOption(page, target)).toHaveClass(/bg-bg-hover/u);
      });

      await test.step('[16-A-013] Click a wall polygon on the canvas selects it and scrolls its row into view', async () => {
        const target = code(250);
        await selectByKeys(page, 250, target);
        await page.keyboard.press('f'); // the canvas now shows wall 250 large
        await page.keyboard.press('Escape');
        await page.keyboard.press('j'); // the list scrolls back to the top; the canvas keeps its view
        await expect(wallOption(page, target)).toHaveCount(0);
        await wallPolygon(page, target).click();
        await expect.soft(wallOption(page, target)).toHaveAttribute('aria-selected', 'true');
        await expect.soft(wallOption(page, target)).toBeInViewport();
        await ev(page, '16-A-013', 'canvas-click-scrolls-row');
      });

      await test.step('[16-B-037] 300 walls: the list is virtualised, J reaches the last row', async () => {
        const rendered = await wallRows(page).count();
        expect.soft(rendered, 'rows in the DOM').toBeLessThan(120);
        await page.keyboard.press('Escape');
        for (let i = 0; i < 305; i += 1) await page.keyboard.press('j');
        await expect.soft(wallOption(page, code(299))).toHaveAttribute('aria-selected', 'true');
        await attachJson('E04_16-B-037_virtualised.json', { renderedRows: rendered, total: 300 });
        await ev(page, '16-B-037', 'virtualised-last-row');
      });

      await test.step('[16-B-033] ⚑ Collapsed legend sits right of the floating rail (BUG-398); "Mở lại hai panel" is not covered', async () => {
        await page.getByRole('button', { name: WALL.collapse, exact: true }).click();
        const legend = canvasFrame(page).getByRole('group', { name: 'Lọc theo độ dày tường', exact: true });
        const rows: { width: number; legendLeft: number; overlap: boolean }[] = [];
        for (const width of [1440, 1024, 375]) {
          await page.setViewportSize({ width, height: width === 375 ? 812 : width === 1024 ? 768 : 900 });
          await expect(legend).toBeVisible();
          const [legendBox, expandBox, frameBox] = [await legend.boundingBox(), await page.getByRole('button', { name: WALL.expand, exact: true }).boundingBox(), await canvasFrame(page).boundingBox()];
          if (legendBox === null || expandBox === null || frameBox === null) throw new Error('collapsed layout has no boxes');
          const overlap = legendBox.x < expandBox.x + expandBox.width && expandBox.x < legendBox.x + legendBox.width && legendBox.y < expandBox.y + expandBox.height && expandBox.y < legendBox.y + legendBox.height;
          rows.push({ width, legendLeft: Math.round(legendBox.x - frameBox.x), overlap });
          expect.soft(overlap, `${String(width)} px: the legend covers "Mở lại hai panel"`).toBe(false);
          expect.soft(legendBox.x - frameBox.x, `${String(width)} px: legend left offset >= 64 px`).toBeGreaterThanOrEqual(63);
        }
        await attachJson('E04_16-B-033_collapsed-legend.json', { rows });
        await ev(page, '16-B-033', 'collapsed-legend');
        await page.setViewportSize({ width: 1440, height: 900 });
        await page.getByRole('button', { name: WALL.expand, exact: true }).click();
      });

      await test.step('[16-E-018] Reduced motion: polygon colour and outline transitions are off', async () => {
        const transition = (): Promise<string[]> =>
          canvasSvg(page).locator('g[aria-label]').first().locator('polygon').evaluateAll((nodes) => nodes.map((node) => getComputedStyle(node).transitionProperty));
        await page.emulateMedia({ reducedMotion: 'no-preference' });
        const normal = await transition();
        await page.emulateMedia({ reducedMotion: 'reduce' });
        const reduced = await transition();
        await attachJson('E04_16-E-018_transitions.json', { normal, reduced });
        expect.soft(normal.some((value) => value !== 'none'), 'transitions run by default').toBe(true);
        expect.soft(reduced, 'motion-reduce:transition-none').toEqual(reduced.map(() => 'none'));
        await ev(page, '16-E-018', 'reduced-motion');
        await page.emulateMedia({ reducedMotion: null });
      });
    } finally {
      await closeWallsRun(run);
      if (projectId !== undefined) await deleteSeededProject(api, projectId);
      await api.dispose();
    }
  });

  test('SCR-16 · FL-16-10 · entries and navigation: dashboard card, tree, floor nav, leave guard, anonymous', async ({ browser }) => {
    test.setTimeout(150_000);
    const api = await adminClient();
    let run: WallsRun | undefined;
    let anon: BrowserContext | undefined;
    let projectId: string | undefined;
    try {
      // Q3: three floors, the first two layered.
      const q3 = await seedQc(api, 'e04-16-10', ['Tầng 1', 'Tầng 2', 'Tầng 3'], 2);
      projectId = q3.projectId;
      const first = q3.floors[0]!;
      const projectName = q3.name;
      run = await openWallsRun(browser);
      const { page } = run;
      const code0 = q3.codes.get(String(q3.walls[0]?.id)) as string;

      await test.step('[16-A-003] Entry from the dashboard card (default floor) opens that floor\'s walls', async () => {
        await page.goto(ROUTES.dashboard);
        await dashboardLoaded(page);
        await page.getByRole('searchbox', { name: 'Tìm dự án', exact: true }).fill(projectName);
        const card = page.getByRole('listitem', { name: projectName, exact: true });
        await expect(card).toBeVisible();
        await card.click();
        // The seeded project is backend status 'processing': the card routes to the pipeline (useProjectDashboard.ts:254-262).
        await expect.poll(() => pathOf(page)).toBe(ROUTES.project.pipeline(q3.projectId));
        await page.goto(ROUTES.project.walls(q3.projectId, first.id));
        await expect(reviewRegion(page)).toBeVisible();
        await dismissTour(page, { waitMs: TOUR_APPEAR_TIMEOUT_MS });
        await ev(page, '16-A-003', 'dashboard-card-entry');
      });

      await test.step('[16-A-067] The tree row "Tường" is the current layer and does nothing on click', async () => {
        const tree = page.getByRole('tree', { name: WALL.tree, exact: true });
        const wallsItem = tree.getByRole('treeitem', { name: 'Tường', exact: true });
        await expect.soft(wallsItem).toHaveAttribute('aria-current', 'page');
        await expect.soft(wallsItem).toHaveAttribute('aria-selected', 'true');
        const mark = run!.flow.sent.length;
        await wallsItem.click();
        expect.soft(pathOf(page)).toBe(ROUTES.project.walls(q3.projectId, first.id));
        expect.soft(run!.flow.sent.slice(mark).filter((r) => r.path.startsWith('/api/projects') && r.method !== 'GET'), 'no write').toHaveLength(0);
        await ev(page, '16-A-067', 'tree-current-layer');
      });

      await test.step('[16-E-005] The tree "Cây lớp" has treeitems but no arrow-key navigation (Tab only)', async () => {
        const tree = page.getByRole('tree', { name: WALL.tree, exact: true });
        const items = tree.getByRole('treeitem');
        expect.soft(await items.count(), 'five layers').toBe(5);
        const wallsItem = items.first();
        await wallsItem.focus();
        await page.keyboard.press('ArrowDown');
        await expect.soft(wallsItem, 'ArrowDown does not move the focus').toBeFocused();
        await ev(page, '16-E-005', 'tree-no-arrow-keys');
      });

      await test.step('[16-A-069] ⚑ The floor nav lists every floor of the project after a fresh load', async () => {
        await openWalls(page, q3.projectId, first.id);
        const nav = page.getByRole('navigation', { name: WALL.floorNav, exact: true });
        const names = await nav.getByRole('button').allInnerTexts();
        await attachJson('E04_16-A-069_floor-nav.json', { listed: names, project: ['Tầng 1', 'Tầng 2', 'Tầng 3'] });
        // C1 suspected: the nav reads the levels already in the store, i.e. only floors opened this session.
        expect.soft(names.map((name) => name.trim()), 'every floor of the project').toEqual(['Tầng 1', 'Tầng 2', 'Tầng 3']);
        await ev(page, '16-A-069', 'floor-nav-after-fresh-load');
      });

      await test.step('[16-E-006] The floor nav marks the current floor aria-current="page"', async () => {
        const nav = page.getByRole('navigation', { name: WALL.floorNav, exact: true });
        await expect.soft(nav.locator('[aria-current="page"]')).toHaveCount(1);
        await expect.soft(nav.getByRole('button', { name: 'Tầng 1', exact: true })).toHaveAttribute('aria-current', 'page');
        await ev(page, '16-E-006', 'floor-nav-current');
      });

      await test.step('[16-A-078] Leaving the page within 800 ms of an edit raises the browser prompt', async () => {
        await freezeClock(page); // the 800 ms debounce cannot fire: the floor stays unsaved
        await selectRow(page, code0);
        const prompts: string[] = [];
        page.once('dialog', (dialog) => {
          prompts.push(dialog.type());
          void dialog.dismiss();
        });
        await page.keyboard.press('3');
        await page.goto('about:blank').catch(() => undefined);
        expect.soft(prompts, 'beforeunload prompt').toEqual(['beforeunload']);
        await ev(page, '16-A-078', 'leave-guard');
        await page.clock.resume();
        await quiet(page);
      });

      await test.step('[16-A-080] An anonymous deep link goes to /login?next=… with "Hãy đăng nhập để tiếp tục."', async () => {
        anon = await browser.newContext({ baseURL: readBaseUrl() });
        const visitor = await anon.newPage();
        await visitor.goto(ROUTES.project.walls(q3.projectId, first.id));
        await expect.poll(() => new URL(visitor.url()).pathname).toBe(ROUTES.login);
        expect.soft(new URL(visitor.url()).searchParams.get('next')).toBe(ROUTES.project.walls(q3.projectId, first.id));
        await expect.soft(visitor.getByText('Hãy đăng nhập để tiếp tục.', { exact: true })).toBeVisible();
        await ev(visitor, '16-A-080', 'anonymous-deep-link');
      });
    } finally {
      await anon?.close().catch(() => undefined);
      await closeWallsRun(run);
      if (projectId !== undefined) await deleteSeededProject(api, projectId);
      await api.dispose();
    }
  });

  test('SCR-16 · FL-16-11 · drawing floor: SCR-12 entry, names, provisional banner → scale', async ({ browser }) => {
    test.setTimeout(PIPELINE_TIMEOUT_MS + 120_000);
    const admin = await adminClient();
    let owner: APIRequestContext | undefined;
    let run: WallsRun | undefined;
    let projectId: string | undefined;
    try {
      const poolAdmin = await poolUser(admin, 'admin', 'p04-walls');
      owner = await signedInApi(poolAdmin.email, poolAdmin.password);
      // D1: the env drawing after the fake-ML run (provisional scale, AI layer).
      const d1 = await createPipelineDrawingProject(owner, 'e04-16-11', envDrawingPng());
      projectId = d1.projectId;
      run = await openWallsRun(browser, { who: poolAdmin });
      const { page } = run;

      await test.step('[16-A-002] Entry from the SCR-12 summary "Duyệt lớp tường" lands on this floor\'s walls', async () => {
        await page.goto(ROUTES.project.pipeline(d1.projectId));
        await expect(page.getByText(/^Đã xong ([1-9]\d*)\/\1 tầng/u)).toBeVisible();
        const read = waitForApi(page, 'GET', layerRe(d1.projectId, d1.floorId), [200]);
        await page.getByRole('button', { name: WALL.screen, exact: true }).click();
        await read;
        await expect.poll(() => pathOf(page)).toBe(ROUTES.project.walls(d1.projectId, d1.floorId));
        await expect(reviewRegion(page)).toBeVisible();
        await dismissTour(page, { waitMs: TOUR_APPEAR_TIMEOUT_MS });
        await ev(page, '16-A-002', 'entry-from-summary');
      });

      await test.step('[16-E-001] Screen region and canvas section names', async () => {
        await expect.soft(reviewRegion(page)).toBeVisible();
        await expect.soft(page.getByRole('region', { name: `Bản vẽ gốc của ${d1.floorName}, dùng làm nền để đối chiếu lớp tường.`, exact: true })).toBeVisible();
        await ev(page, '16-E-001', 'region-names');
      });

      await test.step('[16-B-014] Provisional scale: banner + "Hiệu chỉnh tỉ lệ"; the inspector length reads "Chưa có — tỉ lệ tạm"', async () => {
        await expect.soft(page.getByText('Tỉ lệ tạm — số đo chưa tin được, hãy hiệu chỉnh tỉ lệ.', { exact: true })).toBeVisible();
        await expect.soft(page.getByRole('button', { name: 'Hiệu chỉnh tỉ lệ', exact: true })).toBeVisible();
        await wallRows(page).first().click();
        await expect.soft(inspector(page).getByText('Chưa có — tỉ lệ tạm', { exact: true })).toBeVisible();
        await ev(page, '16-B-014', 'provisional-banner');
      });

      await test.step('[16-B-015] "Hiệu chỉnh tỉ lệ" opens the scale screen', async () => {
        await page.getByRole('button', { name: 'Hiệu chỉnh tỉ lệ', exact: true }).click();
        await expect.poll(() => pathOf(page)).toBe(ROUTES.project.scale(d1.projectId, d1.floorId));
        await ev(page, '16-B-015', 'scale-screen');
      });
    } finally {
      await closeWallsRun(run);
      if (owner !== undefined && projectId !== undefined) await deleteSeededProject(owner, projectId);
      await owner?.dispose();
      await admin.dispose();
    }
  });

  test('SCR-16 · FL-16-12 · empty floor, scale in the status bar, unknown floor / project, floor deleted while open', async ({ browser }) => {
    test.setTimeout(150_000);
    const api = await adminClient();
    let run: WallsRun | undefined;
    let projectId: string | undefined;
    try {
      const q2 = await seedQc(api, 'e04-16-12', ['Tầng 1', 'Tầng trống'], 1);
      projectId = q2.projectId;
      const [layered, empty] = [q2.floors[0]!, q2.floors[1]!];
      run = await openWallsRun(browser);
      const { page } = run;
      const scaleSpan = (): Locator => statusBar(page).locator('span').nth(1);

      await test.step('[16-B-002] Empty floor: "Chưa có đoạn tường nào" + the notice', async () => {
        const mark = run!.flow.sent.length;
        await openWalls(page, q2.projectId, empty.id);
        await expect(page.getByText(WALL.emptyTitle, { exact: true })).toBeVisible();
        await expect.soft(page.getByText(WALL.emptyNotice, { exact: true })).toBeVisible();
        await expect.soft(wallList(page)).toHaveCount(0);
        await expect.soft(page.getByText(WALL.inspectorEmpty, { exact: true })).toBeVisible();
        await quiet(page);
        expect.soft(writesSince(run!, mark), 'opening an empty floor writes nothing').toEqual([]);
        await ev(page, '16-B-002', 'empty-floor');
      });

      await test.step('[16-B-013] A floor without a drawing and without walls: canvas placeholder + region "Bản vẽ gốc của Tầng trống…"', async () => {
        await expect.soft(canvasFrame(page).getByRole('img', { name: 'Chưa có ảnh bản vẽ của tầng này', exact: true })).toBeVisible();
        await expect.soft(page.getByRole('region', { name: /^Bản vẽ gốc của Tầng trống/u })).toBeVisible();
        await ev(page, '16-B-013', 'no-drawing-placeholder');
      });

      await test.step('[16-B-016] Uncalibrated floor: the status bar scale is "—"', async () => {
        await expect.soft(scaleSpan()).toHaveText('—');
        await ev(page, '16-B-016', 'scale-uncalibrated');
      });

      await test.step('[16-B-017] Calibrated floor: the status bar scale reads "{n} mm/px"', async () => {
        const doc = await readLayer(api, q2.projectId, layered.id);
        const saved = await api.put(layerPath(q2.projectId, layered.id), { data: { baseVersion: doc.revision, body: { scaleMillimetresPerPixel: 2.5 } } });
        expect(saved.status(), `setup: PUT scale ${(await saved.text()).slice(0, 200)}`).toBe(200);
        await openWalls(page, q2.projectId, layered.id);
        await expect.soft(scaleSpan()).toHaveText('2,5 mm/px');
        await ev(page, '16-B-017', 'scale-calibrated');
      });

      await test.step('[16-B-007] Unknown floor id (404 floor): "Không mở được tầng này" + "Về quản lý tầng"', async () => {
        const missing = `L-QAP1MISSING${Date.now().toString(36).toUpperCase()}`;
        const notFound = waitForApi(page, 'GET', layerRe(q2.projectId, missing), [404]);
        await page.goto(ROUTES.project.walls(q2.projectId, missing));
        await notFound;
        const gone = page.getByRole('alert').filter({ hasText: 'Tầng này không còn tồn tại.' });
        await expect.soft(gone.getByRole('heading', { name: 'Không mở được tầng này', exact: true })).toBeVisible();
        await expect.soft(gone.getByText('Tầng này không còn tồn tại. Mở Quản lý tầng để chọn một tầng khác.', { exact: true })).toBeVisible();
        await expect.soft(gone.getByRole('button', { name: 'Về quản lý tầng', exact: true })).toBeVisible();
        await ev(page, '16-B-007', 'unknown-floor');
      });

      await test.step('[16-B-008] "Về quản lý tầng" opens the floor manager', async () => {
        await page.getByRole('button', { name: 'Về quản lý tầng', exact: true }).click();
        await expect.poll(() => pathOf(page)).toBe(ROUTES.project.floors(q2.projectId));
        await ev(page, '16-B-008', 'to-floor-manager');
      });

      await test.step('[16-B-009] Unknown project (404 project): the project not-found screen; "Về danh sách dự án" goes to /', async () => {
        const ghost = `prj_qa-p1-${uniq()}`;
        const notFound = waitForApi(page, 'GET', layerRe(ghost, 'L-QAP1NOPROJECT'), [404]);
        await page.goto(ROUTES.project.walls(ghost, 'L-QAP1NOPROJECT'));
        await notFound;
        const missing = page.getByRole('alert').filter({ hasText: 'Dự án có thể đã bị xoá, đường dẫn chưa đúng, hoặc bạn chưa được thêm vào dự án.' });
        await expect.soft(missing.getByRole('heading', { name: 'Không tìm thấy dự án này', exact: true })).toBeVisible();
        await ev(page, '16-B-009', 'unknown-project');
        await missing.getByRole('button', { name: 'Về danh sách dự án', exact: true }).click();
        await expect.poll(() => pathOf(page)).toBe(ROUTES.dashboard);
      });

      await test.step('[16-G-009] A floor deleted while the screen is open: the next save answers 404 floor and the screen blocks', async () => {
        await openWalls(page, q2.projectId, layered.id);
        const removed = await api.delete(`/api/floors/${layered.id}`);
        expect(removed.status(), 'setup: DELETE floor').toBeLessThan(300);
        const code = q2.codes.get(String(q2.walls[0]?.id)) as string;
        await selectRow(page, code);
        const put = waitForApi(page, 'PUT', layerRe(q2.projectId, layered.id), [404]);
        await page.keyboard.press('3');
        await put;
        await expect.soft(page.getByRole('alert').filter({ hasText: 'Không lưu được thay đổi của tầng này.' })).toBeVisible();
        await ev(page, '16-G-009', 'floor-deleted-while-open');
      });
    } finally {
      await closeWallsRun(run);
      if (projectId !== undefined) await deleteSeededProject(api, projectId);
      await api.dispose();
    }
  });

  test('SCR-16 · FL-16-13 · 409 from a second writer, A9 dialog, reload, offline', async ({ browser }) => {
    test.setTimeout(150_000);
    const api = await adminClient();
    let run: WallsRun | undefined;
    let projectId: string | undefined;
    try {
      const q1 = await seedQc(api, 'e04-16-13');
      projectId = q1.projectId;
      const floor = q1.floors[0]!;
      run = await openWallsRun(browser);
      const { page } = run;
      const code = (n: number): string => q1.codes.get(String(q1.walls[n]?.id)) as string;
      const banner = page.getByRole('alert').filter({ hasText: WALL.conflict });
      const dialog = page.getByRole('dialog', { name: WALL.confirmTitle, exact: true });

      await test.step('[16-B-020] 409 after a write elsewhere: reload banner, then the A9 dialog', async () => {
        await openWalls(page, q1.projectId, floor.id);
        await secondWriter(api, q1.projectId, floor.id, thickenFirst); // W2: revision moves on
        await selectRow(page, code(1));
        const conflict = waitForApi(page, 'PUT', layerRe(q1.projectId, floor.id), [409]);
        await approveButton(page).click();
        await conflict;
        await expect(banner).toBeVisible();
        await expect.soft(banner.getByRole('button', { name: WALL.reload, exact: true })).toBeVisible();
        await banner.getByRole('button', { name: WALL.reload, exact: true }).click();
        await expect(dialog).toBeVisible();
        await expect.soft(dialog.getByRole('button', { name: WALL.cancel, exact: true })).toBeVisible();
        await expect.soft(dialog.getByRole('button', { name: WALL.confirmReload, exact: true })).toBeVisible();
        await ev(page, '16-B-020', 'conflict-dialog');
      });

      await test.step('[16-E-012] A9 dialog: the focus is trapped; Esc = "Huỷ" and re-reads nothing', async () => {
        const mark = run!.reads.length;
        for (let i = 0; i < 6; i += 1) {
          await page.keyboard.press('Tab');
          expect.soft(await page.evaluate(() => document.activeElement?.closest('[role="dialog"]') !== null), `Tab #${String(i + 1)} stays in the dialog`).toBe(true);
        }
        await page.keyboard.press('Escape');
        await expect.soft(dialog).toHaveCount(0);
        await expect.soft(banner).toBeVisible();
        await quiet(page);
        expect.soft(run!.reads.length - mark, 'Esc re-reads nothing').toBe(0);
        await ev(page, '16-E-012', 'dialog-esc-cancels');
      });

      await test.step('[16-B-021] ⚑ After "Tải lại và bỏ thay đổi": toast, clean label, no banner (BUG-415)', async () => {
        await banner.getByRole('button', { name: WALL.reload, exact: true }).click();
        const reread = waitForApi(page, 'GET', layerRe(q1.projectId, floor.id), [200]);
        await dialog.getByRole('button', { name: WALL.confirmReload, exact: true }).click();
        await reread;
        await expect.soft(toasts(page).getByText('Đã tải lại bản mới nhất của tầng; các thay đổi chưa lưu đã bị bỏ.', { exact: true })).toBeVisible();
        await expect.soft(statusBar(page)).not.toContainText('Lưu thất bại');
        await expect.soft(banner).toHaveCount(0);
        await ev(page, '16-B-021', 'conflict-reloaded');
      });

      await test.step('[16-B-023] After a server reload the undo stack is cleared: Mod+Z does nothing, 0 PUT', async () => {
        const mark = run!.puts.length;
        const labelsBefore = await rowLabels(page);
        await page.keyboard.press('Control+z');
        await quiet(page);
        expect.soft(putsSince(run!, mark), 'Mod+Z after a reload').toHaveLength(0);
        expect.soft(await rowLabels(page)).toEqual(labelsBefore);
        await ev(page, '16-B-023', 'undo-cleared');
      });

      await test.step('[16-B-029] Offline: the label says so, and the PUT is sent when the network is back (5 s recheck)', async () => {
        await run!.flow.context.setOffline(true);
        await selectRow(page, code(2));
        await page.keyboard.press('3');
        await page.clock.runFor(900); // the debounce fires: the save attempt finds the browser offline
        await expect(statusBar(page)).toContainText('Ngoại tuyến — sẽ lưu khi có mạng');
        await ev(page, '16-B-029', 'offline-label');
        const mark = run!.puts.length;
        await run!.flow.context.setOffline(false);
        const put = waitForLayerPut(page, q1.projectId, floor.id);
        await page.clock.runFor(5_100); // OFFLINE_RECHECK_MS
        expect.soft((await put).response.status()).toBe(200);
        await quiet(page);
        expect.soft(putsSince(run!, mark), 'one PUT once online').toHaveLength(1);
      });
    } finally {
      await run?.flow.context.setOffline(false).catch(() => undefined);
      await closeWallsRun(run);
      if (projectId !== undefined) await deleteSeededProject(api, projectId);
      await api.dispose();
    }
  });
});
