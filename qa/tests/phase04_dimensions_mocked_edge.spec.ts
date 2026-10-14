/**
 * Phase 4 — SCR-18 "Đọc kích thước OCR", EDGE layer, MOCKED RESPONSES: eight sequential user flows (QA-04c P3,
 * `flow-plan.md` "phase04_dimensions_mocked_edge.spec.ts", FL-18-M1..M8). One `test()` per flow, one
 * `test.step('[<row id>] …')` per catalog row (catalog-C2.md), in plan order. `H` rows use a hard `expect`, `S` rows
 * `expect.soft`; every step captures `E04_<row id>_<slug>.png`. ⚑ steps assert the CORRECT behaviour and stay red
 * while the bug is real.
 *
 * Why mocked (catalog C2 summary): #35 cannot write `dimensions` (FE body = layer + scale, BE spatial_write/router.py:
 * 58-62, row 18-G-012) and the fake-ML OCR reads none, so every row with a dimension needs GET N16 answered with a
 * `dimensions` array. What is real: the project, its floor(s) and layer (`layerSeed.createQcProject`, #25 + #35), the
 * level / walls / revision inside N16 (the mock fetches the real N16 and only adds `dimensions`, plus a calibrated
 * `level.scaleMillimetresPerPixel` of 10 mm/px so chains sit inside the canvas), GET …/settings (M3: a real PUT to 0,9),
 * the pool engineer / viewer and their membership (M8), and auth. Pairs (real side): A4 pipeline run reads dimensions
 * (BE4-G-030), BE4-G-063 (#35 refuses body.dimensions), BE4-G-301/305/307, BE5-G-008/011 (settings), FL-A4-02/08.
 * Mocks: `support/p04/P3.ts` routeDims (N16), routeDrawing (#33 + the env PNG at /qa-p3/drawing.png), plus in-flow
 * GET …/settings 500 (M7). Held responses use a promise released after the capture (no fixed wait).
 *
 * Source (FE `F:/App/AppFront` master): DV DimensionOcrReview.tsx · UD useDimensionOcrReview.ts · DG
 * dimensionOcrReviewGateway.ts · DT dimensionOcrText.ts · DL DimensionOcrList.tsx · DR DimensionOcrRow.tsx · DCV
 * DimensionOcrCanvas.tsx · DK DimensionOcrKeyboardMode.tsx · DB DimensionOcrCompareBar.tsx (all under
 * src/screens/qc/DimensionOcrReview/) · UNF src/hooks/useNumericField.ts · SR src/lib/input/shortcutRegistry.ts ·
 * UFL src/hooks/useFloorLayer.ts · UAS src/hooks/useAutosave.ts · USI src/hooks/useSaveIndicator.ts.
 *
 * Row moved (reported): [18-C-018] is planned in FL-18-02 (real file) but needs dimension rows in the store on the SPA
 * path, which only the N16 mock gives; it runs in FL-18-M6 right after the SPA return from SCR-16 ([18-C-019]).
 *
 * ## Request budget per full run
 * - `POST /api/auth/login`: 1 admin API (beforeAll, per worker) + 8 flow sessions + 2 (M8 engineer, viewer) = 11.
 * - `POST /api/users/invitations`: 0 when the `p04-p3` engineer / viewer slots exist, else ≤ 2 (pool, reused).
 * - `POST /api/projects` 8 + #35 PUT 9 (createQcProject) + `DELETE` 8; `PUT …/settings` 1 (M3); `POST …/members` 2.
 * - No upload init. `POST /api/auth/refresh` ≈ 1 per page load (≈ 45 loads) + the 401 retry of M7.
 */
import { expect, test, type APIRequestContext, type Page } from '@playwright/test';

import { ROUTES } from '../../e2e/fixtures/routes';
import { dismissTour, TOUR_APPEAR_TIMEOUT_MS } from '../../e2e/fixtures/tour';
import { signedInApi } from './support/api';
import { readAdminCredentials } from './support/auth';
import { captureEvidence } from './support/evidence';
import { createQcProject, type LayerApi, type SeededFloor } from './support/layerSeed';
import { addProjectMember, deleteSeededProject, envDrawingPng, poolUser } from './support/phase03Seed';
import { closeFlow, openFlow, recordAnnouncements, writesSince, type Flow } from './support/p03/P5';
import { spaGo } from './support/p03/P11';
import {
  DIM,
  approveButton,
  canvasFrame,
  chain,
  compareBar,
  compareText,
  dimCode,
  dimId,
  errorAlert,
  field,
  fieldText,
  filterGroup,
  gate,
  insideBox,
  keyboardSection,
  listGroup,
  lowNotice,
  mm,
  note,
  openDims,
  option,
  options,
  outlierText,
  painted,
  panel,
  progress,
  progressText,
  buttonText,
  leaveOnBeforeUnload,
  putThreshold,
  radio,
  region,
  routeDims,
  routeDrawing,
  selectRow,
  shownCodes,
  skeletonRows,
  toast,
  wallCode,
  writeWithin,
  type DimRow,
} from './support/p04/P3';

/* ---------------------------------------------------------------- fixtures */

/** Calibrated floor in the mock: 10 mm per px, so a 2 000–4 000 mm chain is 200–400 px inside the canvas frame. */
const SCALE = 10;
const COL_A = 500;
const COL_B = 4_500;
const ROW_Y = [800, 1_900, 3_000, 4_100] as const;
const y = (i: 0 | 1 | 2 | 3): number => ROW_Y[i];
const at = (x: number, yy: number, length: number): DimRow['line'] => [x, yy, x + length, yy];

/**
 * Eight rows, every confidence ≥ 0,85 (above the project default 0,75 → default filter "Tất cả", UD:473-474), no outlier
 * (values 2 030–3 000: median 2 600, MAD 250 → no modified z-score above 3, domain/units/outliers.ts). M-001 deviates
 * 1,5 % (neutral bar), M-002 13 % (attention bar, > 2 % levelAgreementLimit).
 */
const BASE8: readonly DimRow[] = [
  { n: 1, valueMm: 2_030, confidence: 0.95, line: at(COL_A, y(0), 2_000) },
  { n: 2, valueMm: 2_600, confidence: 0.9, line: at(COL_A, y(1), 2_300) },
  { n: 3, valueMm: 2_600, confidence: 0.85, line: at(COL_A, y(2), 2_600) },
  { n: 4, valueMm: 2_900, confidence: 0.92, line: at(COL_A, y(3), 2_900) },
  { n: 5, valueMm: 2_100, confidence: 0.88, line: at(COL_B, y(0), 2_100) },
  { n: 6, valueMm: 2_400, confidence: 0.9, line: at(COL_B, y(1), 2_400) },
  { n: 7, valueMm: 2_700, confidence: 0.97, line: at(COL_B, y(2), 2_700) },
  { n: 8, valueMm: 3_000, confidence: 0.93, line: at(COL_B, y(3), 3_000) },
];
const BASE4 = BASE8.slice(0, 4);

/** M3: project threshold 0,9 → M-002 (0,80) and M-003 (0,85) are "low"; M-001 already reviewed by a person. */
const THRESHOLD6: readonly DimRow[] = [
  { n: 1, valueMm: 2_030, confidence: 0.95, line: at(COL_A, y(0), 2_000), reviewed: true },
  { n: 2, valueMm: 2_600, confidence: 0.8, line: at(COL_A, y(1), 2_300) },
  { n: 3, valueMm: 2_600, confidence: 0.85, line: at(COL_A, y(2), 2_600) },
  { n: 4, valueMm: 2_900, confidence: 0.97, line: at(COL_A, y(3), 2_900) },
  { n: 5, valueMm: 2_100, confidence: 0.92, line: at(COL_B, y(0), 2_100) },
  { n: 6, valueMm: 2_400, confidence: 0.99, line: at(COL_B, y(1), 2_400) },
];

/** M4: three unreviewed rows, one reviewed. */
const KEYBOARD4: readonly DimRow[] = [...BASE8.slice(0, 3), { ...BASE8[3]!, reviewed: true }];

/**
 * M5: compare / outliers / canvas. Values 2 000–4 100 plus 99 999 (M-005, first outlier) and 55 555 (M-006, second):
 * median 3 300, MAD 780 → only those two exceed 3 σ. M-002 reads 3 600 on a 3 000 mm line (20 %, attention), M-004
 * 2 540 on 2 500 (1,6 %), M-003 references the floor's first wall, M-007 lies outside the canvas frame (x 12–15 m),
 * M-008 carries an override (label 4 100 instead of the read 4 000).
 */
const CANVAS8: readonly DimRow[] = [
  { n: 1, valueMm: 3_000, confidence: 0.95, line: at(COL_A, y(0), 3_000) },
  { n: 2, valueMm: 3_600, confidence: 0.9, line: at(COL_A, y(1), 3_000) },
  { n: 3, valueMm: 2_000, confidence: 0.9, line: at(COL_A, y(2), 2_000), walls: [0] },
  { n: 4, valueMm: 2_540, confidence: 0.92, line: at(COL_A, y(3), 2_500) },
  { n: 5, valueMm: 99_999, confidence: 0.9, line: at(COL_B, y(0), 2_500) },
  { n: 6, valueMm: 55_555, confidence: 0.9, line: at(COL_B, y(1), 2_500) },
  { n: 7, valueMm: 3_000, confidence: 0.9, line: at(12_000, y(2), 3_000) },
  { n: 8, valueMm: 4_000, confidence: 0.93, line: at(COL_B, y(3), 4_000), overrideValueMm: 4_100 },
];

/** M6 second floor: its own codes (#M-011..#M-013) so a mixed list is visible. */
const FLOOR2_3: readonly DimRow[] = [
  { n: 11, valueMm: 2_200, confidence: 0.9, line: at(COL_A, y(0), 2_200) },
  { n: 12, valueMm: 2_500, confidence: 0.9, line: at(COL_A, y(1), 2_500) },
  { n: 13, valueMm: 2_800, confidence: 0.9, line: at(COL_A, y(2), 2_800) },
];

/** M7: M-001 at 0,72 — "low" under the real default 0,75, NOT low under the FE fallback 0,70 (18-G-008). */
const SETTINGS3: readonly DimRow[] = [
  { n: 1, valueMm: 2_000, confidence: 0.72, line: at(COL_A, y(0), 2_000) },
  { n: 2, valueMm: 2_300, confidence: 0.9, line: at(COL_A, y(1), 2_300) },
  { n: 3, valueMm: 2_600, confidence: 0.95, line: at(COL_A, y(2), 2_600) },
];

/* ---------------------------------------------------------------- shared */

const SLOT = 'p04-p3';
const N16_PATH = /^\/api\/projects\/[^/]+\/floors\/[^/]+\/spatial\/layer$/u;

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

const dimsPath = (floor: SeededFloor): string => ROUTES.project.dimensions(floor.projectId, floor.floorId);

/** GETs of `path` the page received since `mark` (index into `flow.log`). */
const gets = (flow: Flow, mark: number, path: RegExp): number =>
  flow.log.slice(mark).filter((entry) => entry.method === 'GET' && path.test(entry.path)).length;

/**
 * Full load of SCR-18 that must come back FRESH (F-08: nothing persisted), checked on the counter. run-51-P3-r2 once
 * showed a non-fresh list after `page.reload()` in FL-18-M3; the hard check makes such a load fail here, with the
 * dialogs the page raised in the message.
 */
async function freshLoad(page: Page, flow: Flow, path: string, counter: string): Promise<void> {
  await page.goto(path);
  await expect(region(page)).toBeVisible();
  await expect(progress(page), `fresh counter after a full load (dialogs: ${JSON.stringify(flow.dialogs)})`).toHaveText(counter);
}

const rowClass = async (page: Page, n: number): Promise<string> => (await option(page, n).getAttribute('class')) ?? '';

/** Seeds a Q1 (or Q2 with `floors`) project, opens an admin flow, runs `body`, cleans up. */
async function withSeed(
  browser: Parameters<typeof openFlow>[0],
  slug: string,
  body: (flow: Flow, floors: SeededFloor[]) => Promise<void>,
  floorNames: readonly string[] = ['Tầng 1'],
): Promise<void> {
  const floors = await createQcProject(adminLayer, slug, floorNames, 1);
  const projectId = floors[0]?.projectId ?? '';
  let flow: Flow | undefined;
  try {
    flow = await openFlow(browser, readAdminCredentials());
    leaveOnBeforeUnload(flow.page);
    await body(flow, floors);
  } finally {
    if (flow !== undefined) await closeFlow(flow);
    const problem = await deleteSeededProject(adminApi, projectId);
    if (problem !== null) note(`cleanup: ${problem}`);
  }
}

const first = (floors: readonly SeededFloor[]): SeededFloor => {
  const floor = floors[0];
  if (floor === undefined) throw new Error('fixture: no floor');
  return floor;
};

/* ================================================================= flows */

test.describe('E04 SCR-18 dimension OCR review — mocked-response flows (QA-04c P3)', () => {
  test('SCR-18 · FL-18-M1 · [mocked response] list, select, approve, toast undo', async ({ browser }) => {
    test.setTimeout(240_000);
    await withSeed(browser, 'fl18-m1', async (flow, floors) => {
      const { page } = flow;
      const floor = first(floors);
      await routeDims(page, { [floor.floorId]: { rows: BASE8, scale: SCALE } });
      const mark = flow.log.length;

      await test.step('[18-A-001] fresh deep link: GET N16 + …/spatial + …/settings; screen renders', async () => {
        await openDims(page, floor.projectId, floor.floorId, dimsPath(floor));
        await expect(panel(page)).toBeVisible();
        await expect(progress(page)).toHaveText(progressText(0, 8));
        await expect.poll(() => gets(flow, mark, /\/spatial$/u), { message: 'GET …/spatial (#33)' }).toBeGreaterThanOrEqual(1);
        await expect.poll(() => gets(flow, mark, /\/settings$/u), { message: 'GET …/settings' }).toBeGreaterThanOrEqual(1);
        await ev(page, '18-A-001', 'fresh_deep_link');
      });

      await test.step('[18-G-001] GET …/spatial/layer on the fresh load (store empty) → dimensions', async () => {
        expect.soft(gets(flow, mark, N16_PATH), 'one GET N16 on a full load').toBe(1);
        await expect.soft(options(page)).toHaveCount(8);
        await ev(page, '18-G-001', 'n16_read_fresh', `GET N16 since open: ${String(gets(flow, mark, N16_PATH))}`);
      });

      await test.step('[18-E-002] aside "Kích thước đọc được"; group "Danh sách kích thước đọc được"', async () => {
        await expect.soft(panel(page)).toBeVisible();
        await expect.soft(panel(page).getByRole('group', { name: DIM.list, exact: true })).toBeVisible();
        await ev(page, '18-E-002', 'aside_group_names');
      });

      await test.step('[18-B-009] list rows: crop, code, value field "mm", confidence meter, status dot, approve button', async () => {
        const row = option(page, 1);
        await expect.soft(row.getByRole('img', { name: `Cắt vùng gốc của chuỗi kích thước ${dimCode(1)}`, exact: true })).toBeVisible();
        await expect.soft(row.getByText(dimCode(1), { exact: true })).toBeVisible();
        await expect.soft(field(page, 1)).toHaveValue(fieldText(2_030));
        await expect.soft(row.getByText('mm', { exact: true })).toBeVisible();
        await expect.soft(row.getByRole('meter')).toBeVisible();
        await expect.soft(row.locator('span[aria-hidden="true"].rounded-full')).toHaveCount(1);
        await expect.soft(approveButton(page, 1)).toBeVisible();
        await ev(page, '18-B-009', 'row_anatomy');
      });

      await test.step('[18-E-006] option name "#M-001", tabIndex 0, Space selects (Enter: see 18-C-013)', async () => {
        await expect.soft(option(page, 3)).toHaveAttribute('tabindex', '0');
        await option(page, 3).focus();
        await page.keyboard.press('Space');
        await expect.soft(option(page, 3)).toHaveAttribute('aria-selected', 'true');
        note('18-E-006: Enter on a focused row also approves it (double action) — asserted in FL-18-M2 [18-C-013].');
        await ev(page, '18-E-006', 'option_space_selects');
      });

      await test.step('[18-E-004] the listbox has no accessible name', async () => {
        const name = await listGroup(page).getByRole('listbox').evaluate((el) => el.getAttribute('aria-label') ?? el.getAttribute('aria-labelledby') ?? '');
        expect.soft(name, 'listbox aria-label / aria-labelledby (DL:156: none)').toBe('');
        await ev(page, '18-E-004', 'listbox_unnamed');
      });

      await test.step('[18-E-005] options contain a text field and a button (nested interactive content)', async () => {
        await expect.soft(option(page, 2).getByRole('textbox')).toHaveCount(1);
        await expect.soft(option(page, 2).getByRole('button')).toHaveCount(1);
        await ev(page, '18-E-005', 'option_nested_controls');
      });

      await test.step('[18-A-003] click a row → aria-selected, accent border; compare bar appears', async () => {
        await selectRow(page, 1);
        await expect.soft(option(page, 1)).toHaveAttribute('aria-selected', 'true');
        expect.soft(await rowClass(page, 1)).toContain('border-accent');
        await expect.soft(compareBar(page)).toBeVisible();
        await ev(page, '18-A-003', 'row_selected_compare');
      });

      await test.step('[18-E-012] compare bar group "Thanh so sánh với hình học"', async () => {
        await expect.soft(page.getByRole('group', { name: DIM.compareBar, exact: true })).toHaveCount(1);
        await ev(page, '18-E-012', 'compare_bar_group');
      });

      await test.step('[18-B-014] normal deviation → neutral background, comparison line', async () => {
        await expect.soft(compareBar(page)).toHaveText(compareText(mm(2_030), mm(2_000), '1,5%'));
        expect.soft((await compareBar(page).getAttribute('class')) ?? '').toContain('bg-bg-surface');
        await ev(page, '18-B-014', 'compare_neutral');
      });

      await test.step('[18-A-005] select another row → previous deselected; an uncommitted draft is dropped', async () => {
        await field(page, 1).fill('2222');
        await expect(compareBar(page)).toHaveText(/2\.222 mm/u); // UNF:104-109: the 800 ms commit reached the hook draft
        await selectRow(page, 2);
        await expect.soft(option(page, 1)).toHaveAttribute('aria-selected', 'false');
        await expect.soft(option(page, 2)).toHaveAttribute('aria-selected', 'true');
        await expect.soft(field(page, 1)).toHaveValue(fieldText(2_030));
        await ev(page, '18-A-005', 'draft_dropped_on_select');
      });

      await test.step('[18-A-006] "Duyệt kích thước" → button gone, verified border, counter +1, next unreviewed selected', async () => {
        await approveButton(page, 1).click();
        await expect.soft(approveButton(page, 1)).toHaveCount(0);
        await expect.soft(progress(page)).toHaveText(progressText(1, 8));
        await expect.soft(option(page, 2)).toHaveAttribute('aria-selected', 'true');
        expect.soft(await rowClass(page, 1)).toContain('border-state-verified');
        await ev(page, '18-A-006', 'approved_next_selected');
      });

      await test.step('[18-E-008] approve button named "Duyệt kích thước #M-002", visible text "Duyệt kích thước"', async () => {
        await expect.soft(approveButton(page, 2)).toHaveAccessibleName(`${DIM.approve} ${dimCode(2)}`);
        await expect.soft(buttonText(approveButton(page, 2))).toHaveText(DIM.approve);
        await ev(page, '18-E-008', 'approve_button_name');
      });

      await test.step('[18-A-007] approve shows toast "Duyệt kích thước #M-001" with "Hoàn tác"', async () => {
        const item = toast(page, `${DIM.approve} ${dimCode(1)}`);
        await expect.soft(item).toBeVisible();
        await expect.soft(item.getByRole('button', { name: DIM.undo, exact: true })).toBeVisible();
        await ev(page, '18-A-007', 'approve_toast');
      });

      await test.step('[18-A-008] toast "Hoàn tác" within 8 s → row unreviewed again, counter −1', async () => {
        await toast(page, `${DIM.approve} ${dimCode(1)}`).getByRole('button', { name: DIM.undo, exact: true }).click();
        await expect.soft(approveButton(page, 1)).toBeVisible();
        await expect.soft(progress(page)).toHaveText(progressText(0, 8));
        await ev(page, '18-A-008', 'toast_undo');
      });
    });
  });

  test('SCR-18 · FL-18-M2 · [mocked response] value editing: debounce, Enter, Esc, arrows, invalid input', async ({ browser }) => {
    test.setTimeout(300_000);
    await withSeed(browser, 'fl18-m2', async (flow, floors) => {
      const { page } = flow;
      const floor = first(floors);
      await routeDims(page, { [floor.floorId]: { rows: BASE8, scale: SCALE } });

      await test.step('[18-E-007] field "Giá trị kích thước #M-001" with unit "mm"', async () => {
        await openDims(page, floor.projectId, floor.floorId, dimsPath(floor));
        await expect(field(page, 1)).toBeVisible();
        await expect.soft(option(page, 1).getByText('mm', { exact: true })).toBeVisible();
        await ev(page, '18-E-007', 'value_field');
      });

      await test.step('[18-A-009] type, wait ≥ 800 ms, Enter → override + approve; row shows the new value', async () => {
        await selectRow(page, 1);
        await field(page, 1).fill('2345');
        await expect(compareBar(page)).toHaveText(/2\.345 mm/u); // the 800 ms commit has run (UNF:104-109)
        await field(page, 1).press('Enter');
        await expect.soft(approveButton(page, 1)).toHaveCount(0);
        await expect.soft(field(page, 1)).toHaveValue(fieldText(2_345));
        await ev(page, '18-A-009', 'override_and_approve');
      });

      await test.step('[18-A-010] ⚑ type + Enter at once (< 800 ms) → the typed value must survive', async () => {
        // ⚑ C2 bug (highest impact): DR:217-224 blur → setDraft is queued, UD:689-697 approves with the stale draft.
        await field(page, 2).fill('2555');
        await field(page, 2).press('Enter');
        await expect.soft(approveButton(page, 2)).toHaveCount(0);
        await expect.soft(field(page, 2), '⚑ typed 2 555 kept after Enter within 800 ms').toHaveValue(fieldText(2_555));
        await ev(page, '18-A-010', 'enter_within_debounce');
      });

      await test.step('[18-C-012] click into the selected row\'s field after a committed edit → draft kept (BUG-603)', async () => {
        await selectRow(page, 3);
        await field(page, 3).fill('2777');
        await expect(compareBar(page)).toHaveText(/2\.777 mm/u);
        await field(page, 3).click(); // re-clicking the same field keeps the draft: useDimensionOcrReview.ts:706 (BUG-603)
        await expect.soft(compareBar(page), 'the draft is kept: the bar still reads the typed value').toHaveText(/2\.777 mm/u);
        // field is still focused: NumericField shows the typed text raw and formats only on blur
        await expect.soft(field(page, 3)).toHaveValue(/^2\.?777$/u);
        await ev(page, '18-C-012', 'field_click_keeps_draft');
      });

      await test.step('[18-A-011] edit a reviewed row + Enter → override only; toast "Giá trị kích thước #M-001"', async () => {
        await selectRow(page, 1);
        await field(page, 1).fill('2400');
        await expect(compareBar(page)).toHaveText(/2\.400 mm/u);
        await field(page, 1).press('Enter');
        await expect.soft(toast(page, `Giá trị kích thước ${dimCode(1)}`)).toBeVisible();
        await expect.soft(field(page, 1)).toHaveValue(fieldText(2_400));
        await ev(page, '18-A-011', 'override_only_toast');
      });

      await test.step('[18-C-007] approve with a draft equal to the OCR value → approve only, no override', async () => {
        await selectRow(page, 3);
        await field(page, 3).fill('2601');
        await expect(compareBar(page)).toHaveText(/2\.601 mm/u);
        await field(page, 3).press('ArrowDown');
        await expect(compareBar(page)).toHaveText(/chuỗi đọc được 2\.600 mm/u); // draft 2 600 = OCR value (UD:694)
        await approveButton(page, 3).click();
        await expect.soft(toast(page, `${DIM.approve} ${dimCode(3)}`)).toBeVisible();
        await expect.soft(toast(page, `Giá trị kích thước ${dimCode(3)}`)).toHaveCount(0);
        await ev(page, '18-C-007', 'equal_draft_approve_only');
      });

      await test.step('[18-C-008] reviewed row, no change, Enter → nothing (no toast)', async () => {
        const before = await page.getByRole('region', { name: DIM.toasts, exact: true }).getByRole('status').allInnerTexts();
        await field(page, 3).click();
        await field(page, 3).press('Enter');
        await painted(page);
        const after = await page.getByRole('region', { name: DIM.toasts, exact: true }).getByRole('status').allInnerTexts();
        expect.soft(after.filter((t) => !before.includes(t)), 'no new toast (UD:703-705)').toEqual([]);
        await ev(page, '18-C-008', 'reviewed_enter_noop');
      });

      await test.step('[18-A-012] Esc in the value field → committed value shown again, draft dropped', async () => {
        await selectRow(page, 4);
        await field(page, 4).fill('2950');
        await field(page, 4).press('Escape');
        await expect.soft(field(page, 4)).toHaveValue(fieldText(2_900));
        await ev(page, '18-A-012', 'esc_restores_value');
      });

      await test.step('[18-C-014] ⚑ Esc in the field cancels the edit only (row stays selected)', async () => {
        // ⚑ C2 bug: SR:503-508 lets Escape through from a text field, so UD:945-962 also deselects.
        await expect.soft(option(page, 4), '⚑ M-004 still selected after Esc in its field').toHaveAttribute('aria-selected', 'true');
        await ev(page, '18-C-014', 'esc_in_field_keeps_selection');
      });

      await test.step('[18-C-009] ArrowUp/ArrowDown ±1, Shift ±10, committed after 800 ms', async () => {
        await field(page, 4).click();
        await field(page, 4).press('ArrowUp');
        await expect.soft(field(page, 4)).toHaveValue(fieldText(2_901));
        await field(page, 4).press('Shift+ArrowUp');
        await expect.soft(field(page, 4)).toHaveValue(fieldText(2_911));
        await field(page, 4).press('ArrowDown');
        await expect.soft(field(page, 4)).toHaveValue(fieldText(2_910));
        await expect.soft(compareBar(page)).toHaveText(/2\.910 mm/u);
        await ev(page, '18-C-009', 'arrow_steps');
      });

      await test.step('[18-C-011] field cleared or letters typed → ignored, old value shown again on blur', async () => {
        await field(page, 4).fill('');
        await field(page, 4).press('Tab');
        await expect.soft(field(page, 4)).toHaveValue(fieldText(2_910));
        await field(page, 4).fill('abc');
        await field(page, 4).press('Tab');
        await expect.soft(field(page, 4)).toHaveValue(fieldText(2_910));
        await ev(page, '18-C-011', 'invalid_input_ignored');
      });

      await test.step('[18-C-010] a committed draft updates the compare bar and the outlier notice at once', async () => {
        await field(page, 4).fill('99999');
        await expect.soft(compareBar(page)).toHaveText(/99\.999 mm/u);
        await expect.soft(option(page, 4).getByRole('status')).toHaveText(outlierText(99_999));
        await ev(page, '18-C-010', 'draft_updates_bar_outlier');
        await field(page, 4).press('Escape'); // drop the 99 999 draft
      });

      await test.step('[18-A-013] Esc (focus outside a field), row selected, no draft → deselect, compare bar gone', async () => {
        await selectRow(page, 4);
        await expect(option(page, 4)).toHaveAttribute('aria-selected', 'true');
        await page.keyboard.press('Escape');
        await expect.soft(option(page, 4)).toHaveAttribute('aria-selected', 'false');
        await expect.soft(compareBar(page)).toHaveCount(0);
        await ev(page, '18-A-013', 'esc_deselects');
      });

      await test.step('[18-A-014] Enter with focus outside a field and a row selected → approve + next row', async () => {
        await selectRow(page, 4);
        await progress(page).click(); // focus leaves the row (no focusable ancestor → body)
        await page.keyboard.press('Enter');
        await expect.soft(approveButton(page, 4)).toHaveCount(0);
        await expect.soft(option(page, 5)).toHaveAttribute('aria-selected', 'true');
        await ev(page, '18-A-014', 'enter_approves_next');
      });

      await test.step('[18-C-013] ⚑ Enter on a focused row selects it only (no approve)', async () => {
        // ⚑ C2 bug: DR:282-287 selects, then the Enter shortcut (SR:497-543, no defaultPrevented check) approves.
        await option(page, 6).focus();
        await page.keyboard.press('Enter');
        await expect.soft(option(page, 6)).toHaveAttribute('aria-selected', 'true');
        await expect.soft(approveButton(page, 6), '⚑ M-006 not approved by Enter on its row').toBeVisible();
        await ev(page, '18-C-013', 'enter_on_row_double_action');
      });
    });
  });

  test('SCR-18 · FL-18-M3 · [mocked response] filters, default filter, project threshold, counter', async ({ browser }) => {
    test.setTimeout(300_000);
    await withSeed(browser, 'fl18-m3', async (flow, floors) => {
      const { page } = flow;
      const floor = first(floors);
      await putThreshold(adminApi, floor.projectId, 0.9);
      await routeDims(page, { [floor.floorId]: { rows: THRESHOLD6, scale: SCALE } });
      const all = ['#M-001', '#M-002', '#M-003', '#M-004', '#M-005', '#M-006'];

      await test.step('[18-E-003] radiogroup "Lọc theo trạng thái duyệt" with arrow keys', async () => {
        await openDims(page, floor.projectId, floor.floorId, dimsPath(floor));
        await expect(filterGroup(page)).toBeVisible();
        await expect(filterGroup(page).getByRole('radio')).toHaveCount(3);
        await expect(radio(page, DIM.low)).toHaveAttribute('aria-checked', 'true');
        await radio(page, DIM.low).focus();
        await page.keyboard.press('ArrowRight');
        await expect.soft(radio(page, DIM.unreviewed)).toHaveAttribute('aria-checked', 'true');
        await page.keyboard.press('ArrowLeft');
        await expect.soft(radio(page, DIM.low)).toHaveAttribute('aria-checked', 'true');
        await ev(page, '18-E-003', 'filter_arrow_keys');
      });

      await test.step('[18-A-015] filter "Chưa duyệt" → only unreviewed rows', async () => {
        await radio(page, DIM.unreviewed).click();
        await expect.poll(() => shownCodes(page)).toEqual(all.slice(1));
        await ev(page, '18-A-015', 'filter_unreviewed');
      });

      await test.step('[18-A-016] filter "Độ tin cậy thấp" → rows below the project threshold', async () => {
        await radio(page, DIM.low).click();
        await expect.poll(() => shownCodes(page)).toEqual(['#M-002', '#M-003']);
        await ev(page, '18-A-016', 'filter_low');
      });

      await test.step('[18-A-017] filter "Tất cả" → every row', async () => {
        await radio(page, DIM.all).click();
        await expect.poll(() => shownCodes(page)).toEqual(all);
        await ev(page, '18-A-017', 'filter_all');
      });

      await test.step('[18-C-001] counter counts every dimension, unaffected by the filter', async () => {
        await expect.soft(progress(page)).toHaveText(progressText(1, 6));
        await radio(page, DIM.low).click();
        await expect.soft(progress(page)).toHaveText(progressText(1, 6));
        await ev(page, '18-C-001', 'counter_ignores_filter');
      });

      await test.step('[18-C-002] default filter: "Độ tin cậy thấp" when an unreviewed row is below threshold', async () => {
        await freshLoad(page, flow, dimsPath(floor), progressText(1, 6));
        await expect(region(page)).toBeVisible();
        await expect.soft(radio(page, DIM.low)).toHaveAttribute('aria-checked', 'true');
        note('18-C-002 "else Tất cả" branch: FL-18-M1 opens with every confidence above the threshold and lists all 8 rows.');
        await ev(page, '18-C-002', 'default_filter_low');
      });

      await test.step('[18-C-003] approving the last low row flips the default filter to "Tất cả"', async () => {
        await approveButton(page, 2).click();
        await approveButton(page, 3).click();
        await expect.soft(radio(page, DIM.all)).toHaveAttribute('aria-checked', 'true');
        await expect.poll(() => shownCodes(page)).toEqual(all);
        await ev(page, '18-C-003', 'default_flips_to_all');
      });

      await test.step('[18-C-004] threshold = project setting from GET …/settings (0,9 here)', async () => {
        const read = flow.log.filter((entry) => entry.method === 'GET' && entry.path === `/api/projects/${floor.projectId}/settings`).at(-1);
        expect.soft(read?.status, 'GET settings 200').toBe(200);
        expect.soft((read?.json as { confidenceThreshold?: unknown } | undefined)?.confidenceThreshold).toBe(0.9);
        note('18-C-004: M-002 (0,80) was listed under "Độ tin cậy thấp" in [18-A-016] — low only under the project 0,9, not the default 0,75 / 0,70.');
        await ev(page, '18-C-004', 'project_threshold', `GET settings confidenceThreshold = ${String((read?.json as { confidenceThreshold?: unknown } | undefined)?.confidenceThreshold)}`);
      });

      await test.step('[18-C-005] status: reviewed → verified; below threshold → attention; else neutral', async () => {
        await freshLoad(page, flow, dimsPath(floor), progressText(1, 6));
        await expect(region(page)).toBeVisible();
        await radio(page, DIM.all).click();
        expect.soft(await rowClass(page, 1)).toContain('border-state-verified');
        expect.soft(await rowClass(page, 2)).toContain('border-state-attention');
        expect.soft(await rowClass(page, 4)).toContain('border-border-default');
        await expect.soft(option(page, 1).locator('span.bg-state-verified')).toHaveCount(1);
        await expect.soft(option(page, 2).locator('span.bg-state-attention')).toHaveCount(1);
        await expect.soft(option(page, 4).locator('span.bg-text-muted')).toHaveCount(1);
        await ev(page, '18-C-005', 'status_colours');
      });

      await test.step('[18-C-006] next selection = next unreviewed row in full order, wrapping to the top', async () => {
        await approveButton(page, 6).click();
        await expect.soft(option(page, 2), 'wraps past the end to M-002 (M-001 reviewed)').toHaveAttribute('aria-selected', 'true');
        await ev(page, '18-C-006', 'next_wraps_to_top');
      });

      await test.step('[18-B-010] ⚑ every row reviewed → "Tất cả kích thước đã duyệt" message', async () => {
        for (const n of [2, 3, 4, 5]) await approveButton(page, n).click();
        await expect(progress(page)).toHaveText(progressText(6, 6));
        // ⚑ dead copy: DT:182-185 is never rendered (UD:265-266, DV:126-186).
        await expect.soft(page.getByText(DIM.doneTitle, { exact: true }), '⚑ done message').toBeVisible();
        await ev(page, '18-B-010', 'all_reviewed_message');
      });

      await test.step('[18-B-011] ⚑ low-confidence preset → notice "2 mục dưới ngưỡng tin cậy, đã lọc sẵn"', async () => {
        await freshLoad(page, flow, dimsPath(floor), progressText(1, 6));
        await expect(region(page)).toBeVisible();
        await expect(radio(page, DIM.low)).toHaveAttribute('aria-checked', 'true');
        // ⚑ dead copy: lowConfidencePartialNotice (DT:109-110) is never rendered (UD:473-474).
        await expect.soft(page.getByText(lowNotice(2), { exact: true }), '⚑ preset notice').toBeVisible();
        await ev(page, '18-B-011', 'low_preset_notice');
      });

      await test.step('[18-B-012] a filter with zero matches → empty listbox, no sentence', async () => {
        await radio(page, DIM.unreviewed).click();
        for (const n of [2, 3, 4, 5, 6]) await approveButton(page, n).click();
        await expect.soft(options(page)).toHaveCount(0);
        await expect.soft(listGroup(page).getByRole('listbox')).toHaveText('');
        await ev(page, '18-B-012', 'zero_matches');
      });

      await test.step('[18-E-009] progress text aria-live polite', async () => {
        await expect.soft(progress(page)).toHaveAttribute('aria-live', 'polite');
        await ev(page, '18-E-009', 'progress_live');
      });
    });
  });

  test('SCR-18 · FL-18-M4 · [mocked response] keyboard review mode', async ({ browser }) => {
    test.setTimeout(240_000);
    await withSeed(browser, 'fl18-m4', async (flow, floors) => {
      const { page } = flow;
      const floor = first(floors);
      await routeDims(page, { [floor.floorId]: { rows: KEYBOARD4, scale: SCALE } });

      await test.step('[18-A-018] "Bật chế độ duyệt bàn phím" with a row selected → whole screen replaced', async () => {
        await openDims(page, floor.projectId, floor.floorId, dimsPath(floor));
        await selectRow(page, 1);
        await page.getByRole('button', { name: DIM.keyboardOn, exact: true }).click();
        await expect(keyboardSection(page)).toBeVisible();
        await expect.soft(keyboardSection(page).getByText(DIM.keyboardCaption, { exact: true })).toBeVisible();
        await expect.soft(keyboardSection(page).getByRole('img', { name: `Cắt vùng gốc của chuỗi kích thước ${dimCode(1)}`, exact: true })).toBeVisible();
        await expect.soft(keyboardSection(page).getByText(dimCode(1), { exact: true })).toBeVisible();
        await expect.soft(page.getByRole('button', { name: DIM.keyboardOff, exact: true })).toBeVisible();
        await expect.soft(canvasFrame(page), 'canvas gone: the mode takes the whole screen').toHaveCount(0);
        await ev(page, '18-A-018', 'keyboard_mode_with_row');
      });

      await test.step('[18-E-014] section named by the caption, `dl` key legend, field auto-focused', async () => {
        // DimensionOcrKeyboardMode.tsx:61-65 KEY_LEGEND = Enter, Tab, Esc (BUG-583: no key the screen does not honour)
        await expect.soft(keyboardSection(page).locator('dl dt')).toHaveCount(3);
        await expect.soft(field(page, 1)).toBeFocused();
        await ev(page, '18-E-014', 'keyboard_mode_a11y');
      });

      await test.step('[18-A-020] `R` (focus outside a field) toggles keyboard mode', async () => {
        await keyboardSection(page).getByText(DIM.keyboardCaption, { exact: true }).click(); // focus leaves the field
        await page.keyboard.press('r');
        await expect.soft(keyboardSection(page)).toHaveCount(0);
        await expect.soft(canvasFrame(page)).toBeVisible();
        await panel(page).getByText(DIM.keyboardHint).click();
        await page.keyboard.press('r');
        await expect.soft(keyboardSection(page)).toBeVisible();
        await ev(page, '18-A-020', 'r_toggles_mode');
      });

      await test.step('[18-A-022] keyboard mode Enter → approve, next row\'s crop fades in', async () => {
        await field(page, 1).click();
        await field(page, 1).press('Enter');
        await expect.soft(keyboardSection(page).getByText(dimCode(2), { exact: true })).toBeVisible();
        await expect.soft(keyboardSection(page).getByRole('img', { name: `Cắt vùng gốc của chuỗi kích thước ${dimCode(2)}`, exact: true })).toBeVisible();
        await ev(page, '18-A-022', 'enter_next_crop');
      });

      await test.step('[18-C-028] after Enter focus moves to the next row\'s field', async () => {
        // DimensionOcrKeyboardMode.tsx:147-150: `key={row.id}` remounts the field with `hasAutoFocus`.
        await expect.soft(field(page, 2), 'next row\'s field is auto-focused').toBeFocused();
        await ev(page, '18-C-028', 'field_not_refocused');
      });

      const kbField = (): ReturnType<typeof field> => keyboardSection(page).getByRole('textbox');
      const kbCode = async (): Promise<string> =>
        ((await kbField().getAttribute('aria-label')) ?? '').replace('Giá trị kích thước ', '');

      await test.step('[18-C-029] ⚑ `R` in the auto-focused field must leave keyboard mode (legend says so)', async () => {
        await kbField().focus();
        await page.keyboard.press('r');
        // ⚑ BUG-334 partly fixed: the legend says R = "Tắt chế độ duyệt bàn phím" (DK:59-64) but SR:507 skips text fields.
        await expect.soft(keyboardSection(page), '⚑ R leaves keyboard mode').toHaveCount(0);
        await ev(page, '18-C-029', 'r_in_field', `row in keyboard mode: ${await kbCode().catch(() => '—')}`);
        if ((await keyboardSection(page).count()) === 0) {
          await selectRow(page, 2);
          await page.getByRole('button', { name: DIM.keyboardOn, exact: true }).click();
        }
        // The typed "r" is not a number: the field drops it on blur (DR:240-245). No Esc here — Esc in the field also
        // deselects the row (18-C-014) and would drop the mode to the panel footer.
      });

      await test.step('[18-C-030] legend "Tab — Sang cột sau": Tab goes to the off button', async () => {
        await expect.soft(keyboardSection(page).getByText('Sang cột sau', { exact: true })).toBeVisible();
        if ((await kbField().count()) === 0) {
          note('18-C-030: keyboard mode had no row left selected; M-002 re-selected to bring the field back.');
          await page.getByRole('button', { name: DIM.keyboardOff, exact: true }).click();
          await selectRow(page, 2);
          await page.getByRole('button', { name: DIM.keyboardOn, exact: true }).click();
        }
        await kbField().focus();
        await page.keyboard.press('Tab');
        await expect.soft(page.getByRole('button', { name: DIM.keyboardOff, exact: true })).toBeFocused();
        await ev(page, '18-C-030', 'tab_to_off_button');
      });

      await test.step('[18-A-023] approving the last unreviewed row → row null, mode falls back to the panel footer', async () => {
        // Enter on each row left (M-002, M-003; M-004 is reviewed) until no row is left to review.
        for (let left = 2; left > 0 && (await kbField().count()) > 0; left -= 1) {
          await kbField().focus();
          await page.keyboard.press('Enter');
          await painted(page);
        }
        await expect.soft(canvasFrame(page)).toBeVisible();
        await expect.soft(panel(page).getByRole('region', { name: DIM.keyboardCaption, exact: true })).toBeVisible();
        await expect.soft(progress(page)).toHaveText(progressText(4, 4));
        await ev(page, '18-A-023', 'last_row_footer');
      });
    });
  });

  test('SCR-18 · FL-18-M5 · [mocked response] compare bar, outliers, canvas chains, crops', async ({ browser }) => {
    test.setTimeout(300_000);
    await withSeed(browser, 'fl18-m5', async (flow, floors) => {
      const { page } = flow;
      const floor = first(floors);
      const dims = await routeDims(page, { [floor.floorId]: { rows: CANVAS8, scale: SCALE } });
      const drawing = await routeDrawing(page, envDrawingPng());
      const answer = dims.floors[floor.floorId]!;

      await test.step('[18-B-013] compare bar, significant deviation → attention tint', async () => {
        await openDims(page, floor.projectId, floor.floorId, dimsPath(floor));
        await expect(options(page)).toHaveCount(8);
        await selectRow(page, 2);
        await expect(compareBar(page)).toHaveText(compareText(mm(3_600), mm(3_000), '20%'));
        expect.soft((await compareBar(page).getAttribute('class')) ?? '').toContain('bg-state-attention-tint');
        await ev(page, '18-B-013', 'compare_significant');
      });

      await test.step('[18-B-015] implausible value: first outlier row shows the role status notice', async () => {
        await expect.soft(option(page, 5).getByRole('status')).toHaveText(outlierText(99_999));
        await ev(page, '18-B-015', 'outlier_notice');
      });

      await test.step('[18-E-011] outlier notice is role status', async () => {
        await expect.soft(option(page, 5).getByRole('status')).toHaveCount(1);
        await ev(page, '18-E-011', 'outlier_role_status');
      });

      await test.step('[18-C-026] only the first outlier row gets the notice; keyboard mode shows the selected row\'s', async () => {
        await expect.soft(option(page, 6).getByRole('status')).toHaveCount(0);
        await selectRow(page, 6);
        await page.getByRole('button', { name: DIM.keyboardOn, exact: true }).click();
        await expect.soft(keyboardSection(page).getByRole('status')).toHaveText(outlierText(55_555));
        await ev(page, '18-C-026', 'second_outlier_keyboard');
        await page.getByRole('button', { name: DIM.keyboardOff, exact: true }).click();
      });

      await test.step('[18-B-016] row caption "Gắn với #W-…" when referenceIds hits a wall', async () => {
        const body = dims.bodies[floor.floorId];
        const code = body === undefined ? '#W-?' : wallCode(body, 0);
        await expect.soft(option(page, 3).getByText(`Gắn với ${code}`, { exact: true })).toBeVisible();
        await ev(page, '18-B-016', 'wall_reference_caption');
      });

      await test.step('[18-C-020] compare line: mm with dot thousands, percent with comma decimals', async () => {
        await selectRow(page, 4);
        await expect.soft(compareBar(page)).toHaveText(compareText('2.540 mm', '2.500 mm', '1,6%'));
        await ev(page, '18-C-020', 'number_formats');
      });

      await test.step('[18-C-021] chain label = override or read; reviewed chains verified; selected chain accent box', async () => {
        await expect.soft(chain(page, 8).locator('text')).toHaveText(mm(4_100));
        await expect.soft(chain(page, 1).locator('text')).toHaveText(mm(3_000));
        await approveButton(page, 1).click();
        await expect.soft(chain(page, 1).locator('rect').first()).toHaveAttribute('stroke', 'var(--state-verified)');
        await selectRow(page, 4);
        await expect.soft(chain(page, 4).locator('rect[stroke="var(--accent)"]')).toHaveCount(1);
        await ev(page, '18-C-021', 'chain_colours_labels');
      });

      await test.step('[18-C-022] ⚑ chains aligned with the drawing (svg viewBox, image not stretched)', async () => {
        const viewBox = await canvasFrame(page).locator('svg[role="img"]').getAttribute('viewBox');
        // ⚑ BUG-335 family: DCV:198-211 svg has no viewBox (raw px at the floor scale), img inset-0 h-full w-full.
        expect.soft(viewBox, '⚑ svg viewBox maps floor px onto the drawing').not.toBeNull();
        await ev(page, '18-C-022', 'canvas_alignment');
      });

      await test.step('[18-C-023] ⚑ selecting a row brings its chain into view', async () => {
        await selectRow(page, 7);
        await painted(page);
        // ⚑ UD:513,753-759 flyToBounds moves a viewport DimensionOcrCanvas never reads (DCV:180-231).
        expect.soft(await insideBox(chain(page, 7).locator('text'), canvasFrame(page)), '⚑ M-007 label inside the canvas frame').toBe(true);
        await ev(page, '18-C-023', 'select_brings_chain_into_view');
      });

      await test.step('[18-C-025] crops cut the drawing at the dimension midpoint (uncalibrated 1 mm/px)', async () => {
        answer.scale = undefined; // the real level has no scale → UNCALIBRATED_SCALE (DG:520-529)
        await page.reload();
        await expect(options(page)).toHaveCount(8);
        const crop = option(page, 1).getByRole('img');
        // M-001 midpoint (2 000, 800) mm = px at 1 mm/px; box 160 × 96 around it (DG:646-678).
        await expect.soft(crop).toHaveCSS('background-position', '-1920px -752px');
        expect.soft((await crop.getAttribute('style')) ?? '').toContain(drawing.url);
        await ev(page, '18-C-025', 'crop_at_midpoint');
        answer.scale = SCALE;
        await page.reload();
        await expect(options(page)).toHaveCount(8);
      });

      await test.step('[18-A-004] click a chain on the canvas → its row is selected and scrolled into view', async () => {
        const scrollBox = listGroup(page).locator('div.overflow-y-auto').first();
        await chain(page, 8).locator('text').click();
        await expect.soft(option(page, 8)).toHaveAttribute('aria-selected', 'true');
        await expect.poll(() => insideBox(option(page, 8), scrollBox), { message: 'M-008 row inside the list scroll box' }).toBe(true);
        await ev(page, '18-A-004', 'chain_click_selects_row');
      });

      await test.step('[18-E-010] crop role img "Cắt vùng gốc của chuỗi kích thước #M-001"', async () => {
        await expect.soft(page.getByRole('img', { name: `Cắt vùng gốc của chuỗi kích thước ${dimCode(1)}`, exact: true })).toHaveCount(1);
        await ev(page, '18-E-010', 'crop_img_name');
      });

      await test.step('[18-E-013] canvas chains not keyboard reachable; label = machine id, not "#M-001"', async () => {
        const g = chain(page, 1);
        await expect.soft(g).toHaveAttribute('aria-label', dimId(1));
        expect.soft(await g.getAttribute('tabindex'), 'no tabindex on a chain').toBeNull();
        await expect.soft(g).toHaveAttribute('role', 'presentation');
        await ev(page, '18-E-013', 'chain_machine_id');
      });

      await test.step('[18-E-016] reduced motion: chain colour transition and crop fade off', async () => {
        await page.emulateMedia({ reducedMotion: 'reduce' });
        // DCV:98 `motion-reduce:transition-none` = transition-property none (the duration class stays).
        await expect.soft(chain(page, 2)).toHaveCSS('transition-property', 'none');
        await selectRow(page, 2);
        await page.getByRole('button', { name: DIM.keyboardOn, exact: true }).click();
        // DK:84 useTransition('fast') jumps to its end under reduced motion. ponytail: with slowMo 400 the 180 ms fade
        // would also be over by now, so this reads the end state only; the transition-property check above is the proof.
        const fade = keyboardSection(page).locator('div[style*="opacity"]').first();
        expect.soft(await fade.evaluate((el) => getComputedStyle(el).opacity)).toBe('1');
        await ev(page, '18-E-016', 'reduced_motion');
      });
    });
  });

  test('SCR-18 · FL-18-M6 · [mocked response] F-08: no request, reload loses approvals, flush, leave, floor change', async ({ browser }) => {
    test.setTimeout(300_000);
    await withSeed(
      browser,
      'fl18-m6',
      async (flow, floors) => {
        const { page } = flow;
        const floor = first(floors);
        const second = floors[1];
        if (second === undefined) throw new Error('fixture: Q2 second floor missing');
        const dims = await routeDims(page, {
          [floor.floorId]: { rows: BASE4, scale: SCALE },
          [second.floorId]: { rows: FLOOR2_3, scale: SCALE },
        });
        const announced = await recordAnnouncements(page);
        let open = 0;

        await test.step('[18-B-018] after an approve nothing is sent and the announcer says no "Đã lưu lúc HH:mm" (F-08, 5fcaf502)', async () => {
          await openDims(page, floor.projectId, floor.floorId, dimsPath(floor));
          open = flow.sent.length;
          await approveButton(page, 1).click();
          await expect(approveButton(page, 1)).toBeVisible();
          expect.soft((await announced()).some((text) => /^Đã lưu lúc \d{2}:\d{2}$/u.test(text)), 'no "Đã lưu" announcement when nothing was saved').toBe(false);
          expect.soft(writesSince(flow, open), 'F-08: no write').toEqual([]);
          await ev(page, '18-B-018', 'saved_without_request', `announced: ${(await announced()).join(' | ')}`);
        });

        await test.step('[18-E-015] save state reaches screen readers only through the announcer — nothing visible', async () => {
          // src/lib/input/announcer.ts:41-58: one polite region, hidden by a 1 x 1 px clip (not display: none).
          const polite = page.locator('[data-announcer="polite"]');
          await expect(polite).toHaveCount(1);
          const box = await polite.boundingBox();
          expect.soft(box !== null && box.width <= 1 && box.height <= 1, `announcer is visually hidden (1 px), box ${JSON.stringify(box)}`).toBe(true);
          await expect.soft(region(page).getByText(/Đã lưu/u)).toHaveCount(0);
          await ev(page, '18-E-015', 'announcer_only');
        });

        await test.step('[18-C-017] F-08, fresh page: approve / edit / keyboard approve send no PUT/PATCH/POST', async () => {
          await selectRow(page, 2);
          await field(page, 2).fill('2456');
          await expect(compareBar(page)).toHaveText(/2\.456 mm/u);
          await field(page, 2).press('Enter');
          await selectRow(page, 3);
          await page.getByRole('button', { name: DIM.keyboardOn, exact: true }).click();
          await field(page, 3).press('Enter');
          await page.getByRole('button', { name: DIM.keyboardOff, exact: true }).click();
          expect.soft(await writeWithin(page), 'no write within the autosave window').toBeNull();
          expect.soft(writesSince(flow, open)).toEqual([]);
          await ev(page, '18-C-017', 'no_write_fresh');
        });

        await test.step('[18-G-009] no PUT/PATCH/POST for any SCR-18 action on a fresh load (F-08)', async () => {
          expect.soft(writesSince(flow, 0), 'every write the page sent in this flow').toEqual([]);
          await ev(page, '18-G-009', 'no_write_total', `writes: ${JSON.stringify(writesSince(flow, 0))}`);
        });

        await test.step('[18-G-010] approve → invalidation re-reads the store graph, no GET N16 either', async () => {
          expect.soft(dims.hits.filter((id) => id === floor.floorId).length, 'GET N16 of floor 1 = the one load').toBe(1);
          await ev(page, '18-G-010', 'no_n16_after_approve', `N16 hits: ${JSON.stringify(dims.hits)}`);
        });

        await test.step('[18-A-027] Ctrl+S after an approve → engine flushed, still no request', async () => {
          await approveButton(page, 4).click();
          await progress(page).click();
          await page.keyboard.press('Control+s');
          expect.soft(await writeWithin(page), 'Ctrl+S flushes nothing to the server').toBeNull();
          await ev(page, '18-A-027', 'ctrl_s_no_request');
        });

        await test.step('[18-A-025] reload after approvals → every approval gone (F-08)', async () => {
          await page.reload();
          await expect(options(page)).toHaveCount(4);
          await expect.soft(progress(page)).toHaveText(progressText(0, 4));
          await expect.soft(page.getByRole('button', { name: new RegExp(`^${DIM.approve} #M-`, 'u') })).toHaveCount(4);
          await ev(page, '18-A-025', 'reload_loses_approvals');
        });

        await test.step('[18-C-019] local approvals are kept when leaving for SCR-16 and back (revision unchanged: store not replaced)', async () => {
          await approveButton(page, 1).click();
          await expect(approveButton(page, 1)).toHaveCount(0);
          await spaGo(page, ROUTES.project.walls(floor.projectId, floor.floorId));
          await dismissTour(page, { waitMs: TOUR_APPEAR_TIMEOUT_MS });
          await page.getByRole('tree', { name: 'Cây lớp', exact: true }).getByRole('treeitem', { name: 'Kích thước', exact: true }).click();
          await expect(region(page)).toBeVisible();
          await expect.soft(approveButton(page, 1), 'M-001 approval kept: store not replaced when revision is unchanged').toHaveCount(0);
          await ev(page, '18-C-019', 'approvals_kept_via_scr16');
        });

        await test.step('[18-C-018] ⚑ moved from FL-18-02: SPA path approve sends NO #35 PUT', async () => {
          const pending = writeWithin(page, 3_000);
          await approveButton(page, 2).click();
          // ⚑ C2 suspected F-08 break: UAS:395-422 saver of SCR-16 still subscribed, SLS:51-67 marks the floor dirty.
          expect.soft(await pending, '⚑ no PUT …/spatial/layer after an SPA approve').toBeNull();
          await ev(page, '18-C-018', 'spa_approve_no_put');
        });

        await test.step('[18-C-027] undo only on the toast: no Mod+Z binding, no "Hoàn tác" on the screen', async () => {
          // Fresh load first (the catalog's context): on the SPA path after SCR-16, run-51-P3-r1 saw Ctrl+Z revert an
          // approve — a binding left from the SCR-16 visit (source not traced), not this screen's own (UD:539-541).
          await page.reload();
          await expect(options(page)).toHaveCount(4);
          await approveButton(page, 3).click();
          await expect(approveButton(page, 3)).toHaveCount(0);
          await expect.soft(region(page).getByRole('button', { name: DIM.undo, exact: true }), 'no "Hoàn tác" control on the screen').toHaveCount(0);
          await progress(page).click();
          await page.keyboard.press('Control+z');
          await painted(page);
          // Catalog row under review (QA-04c review-mau-P23): the screen binds no Mod+Z (UD:539-541 onUndo unused), but the
          // shell's app-wide Ctrl+Z (src/routes/router.tsx:222 'global.undo') may take the approve back. Recorded, not asserted,
          // until the coordinator settles the catalog line.
          const reverted = await approveButton(page, 3).isVisible();
          note(`18-C-027: after Ctrl+Z the approve of #M-003 is ${reverted ? 'reverted (shell global.undo)' : 'kept'}; catalog says "no Mod+Z binding".`);
          await ev(page, '18-C-027', 'no_undo_key', `Ctrl+Z reverted the approve: ${String(reverted)}`);
        });

        await test.step('[18-C-015] ⚑ SCR-18 of floor 2 after visiting floor 1 lists only floor 2\'s dimensions', async () => {
          const hitsBefore = dims.hits.length;
          await spaGo(page, ROUTES.project.walls(floor.projectId, second.floorId));
          await expect.poll(() => dims.hits.slice(hitsBefore).includes(second.floorId), { message: 'SCR-16 read N16 of floor 2' }).toBe(true);
          await spaGo(page, dimsPath(second));
          await expect(region(page)).toBeVisible();
          // ⚑ C2 bug: dimensionsOf takes every dimension of the store graph (DG:344-345, UD:447-450).
          await expect.configure({ soft: true }).poll(() => shownCodes(page), { message: '⚑ floor 2 lists only its own rows (#M-011..#M-013)' }).toEqual(['#M-011', '#M-012', '#M-013']);
          note('18-C-015: SCR-16 → floor 2 and SCR-16 → "Kích thước" are client-side route changes (spaGo = history.pushState + popstate, P11).');
          await ev(page, '18-C-015', 'floor2_rows_mixed');
        });

        await test.step('[18-A-028] change :floorId in the URL (full load) → the other floor\'s dimensions', async () => {
          await page.goto(dimsPath(second));
          await expect(region(page)).toBeVisible();
          await expect.poll(() => shownCodes(page)).toEqual(['#M-011', '#M-012', '#M-013']);
          await ev(page, '18-A-028', 'url_floor_change');
        });
      },
      ['Tầng 1', 'Tầng trống'],
    );
  });

  test('SCR-18 · FL-18-M7 · [mocked response] read errors: held, 500, retry, abort, background, settings, 401', async ({ browser }) => {
    test.setTimeout(240_000);
    await withSeed(browser, 'fl18-m7', async (flow, floors) => {
      const { page } = flow;
      const floor = first(floors);
      const held = gate();
      const dims = await routeDims(page, { [floor.floorId]: { rows: SETTINGS3, scale: SCALE, hold: held.promise } });
      const answer = dims.floors[floor.floorId]!;

      await test.step('[18-B-001] loading: 4 skeleton rows in the panel', async () => {
        await page.goto(dimsPath(floor));
        await expect(region(page)).toBeVisible();
        await expect(skeletonRows(page)).toHaveCount(4);
        await ev(page, '18-B-001', 'loading_skeleton');
        answer.hold = undefined;
        held.release();
        await expect(options(page).first()).toBeVisible();
      });

      await test.step('[18-B-004] N16 500 → InlineAlert "Không đọc được kích thước" + "Thử lại"', async () => {
        answer.fail = 500;
        await page.reload();
        await expect.soft(errorAlert(page)).toBeVisible();
        await expect.soft(errorAlert(page)).toContainText(DIM.errorDescription);
        await expect.soft(errorAlert(page).getByRole('button', { name: DIM.retry, exact: true })).toBeVisible();
        await ev(page, '18-B-004', 'n16_500_alert');
      });

      await test.step('[18-B-005] "Thử lại" refetches N16 and recovers', async () => {
        answer.fail = undefined;
        const before = dims.hits.length;
        await errorAlert(page).getByRole('button', { name: DIM.retry, exact: true }).click();
        await expect.soft(options(page).first()).toBeVisible();
        expect.soft(dims.hits.length - before, 'one more GET N16').toBeGreaterThanOrEqual(1);
        await ev(page, '18-B-005', 'retry_recovers');
      });

      await test.step('[18-B-008] N16 network failure → same generic alert', async () => {
        answer.fail = 'abort';
        await page.reload();
        await expect.soft(errorAlert(page)).toBeVisible({ timeout: 20_000 }); // HTTP ladder 300 + 900 + 2 700 ms first
        await ev(page, '18-B-008', 'n16_network_alert');
      });

      await test.step('[18-G-004] N16 500 / network → generic error with "Thử lại"', async () => {
        await expect.soft(errorAlert(page).getByRole('button', { name: DIM.retry, exact: true })).toBeVisible();
        note('18-G-004: the 500 branch is [18-B-004], the network branch this page (route.abort "failed").');
        await ev(page, '18-G-004', 'generic_error_retry');
      });

      await test.step('[18-B-017] background read fails → canvas plain, crops empty boxes, no error', async () => {
        answer.fail = undefined;
        const drawing = await routeDrawing(page, envDrawingPng());
        drawing.fail = 500;
        await page.reload();
        await expect(options(page).first()).toBeVisible();
        await expect.soft(canvasFrame(page).locator('img')).toHaveCount(0);
        const bg = await options(page).first().getByRole('img').evaluate((el) => getComputedStyle(el).backgroundImage);
        expect.soft(bg, 'crop has no drawing image (imageUrl "")').not.toMatch(/\.png/u);
        await expect.soft(errorAlert(page)).toHaveCount(0);
        await ev(page, '18-B-017', 'background_fail_plain');
      });

      await test.step('[18-G-006] background GET error → silent', async () => {
        const failed = flow.log.filter((entry) => entry.method === 'GET' && /\/spatial$/u.test(entry.path) && entry.status === 500).length;
        expect.soft(failed, '#33 answered 500').toBeGreaterThanOrEqual(1);
        await expect.soft(page.getByRole('alert')).toHaveCount(0);
        await ev(page, '18-G-006', 'background_error_silent');
      });

      await test.step('[18-G-008] settings GET 500 → default 0,70, no message', async () => {
        await page.route(
          (url) => url.pathname === `/api/projects/${floor.projectId}/settings`,
          (route) => (route.request().method() === 'GET' ? route.fulfill({ status: 500, contentType: 'application/json', body: JSON.stringify({ code: 'INTERNAL_ERROR', requestId: 'qa-p3-mock' }) }) : route.fallback()),
        );
        await page.reload();
        await expect(options(page)).toHaveCount(3);
        // M-001 at 0,72: low under the real 0,75, not under the fallback 0,70 → default "Tất cả", neutral border.
        await expect.soft(radio(page, DIM.all)).toHaveAttribute('aria-checked', 'true');
        expect.soft(await rowClass(page, 1)).toContain('border-border-default');
        await expect.soft(page.getByRole('alert')).toHaveCount(0);
        await ev(page, '18-G-008', 'settings_500_default');
      });

      await test.step('[18-G-011] N16 401 → SessionBootstrap login redirect', async () => {
        answer.fail = 401;
        await page.reload();
        await expect.poll(() => new URL(page.url()).pathname, { timeout: 30_000 }).toBe(ROUTES.login);
        expect.soft(new URL(page.url()).searchParams.get('next')).toBe(dimsPath(floor));
        await ev(page, '18-G-011', 'n16_401_login');
      });
    });
  });

  test('SCR-18 · FL-18-M8 · [mocked response] roles: admin, engineer, viewer (loading, forbidden copy)', async ({ browser }) => {
    test.setTimeout(300_000);
    await withSeed(browser, 'fl18-m8', async (flow, floors) => {
      const floor = first(floors);
      const engineer = await poolUser(adminApi, 'engineer', SLOT);
      const viewer = await poolUser(adminApi, 'viewer', SLOT);
      await addProjectMember(adminApi, floor.projectId, engineer.email);
      await addProjectMember(adminApi, floor.projectId, viewer.email);
      const onFloor = { rows: BASE4, scale: SCALE };
      await routeDims(flow.page, { [floor.floorId]: { ...onFloor } });
      let eng: Flow | undefined;
      let view: Flow | undefined;
      try {
        await test.step('[18-D-001] admin: fields enabled, approve buttons, keyboard-mode entry', async () => {
          const { page } = flow;
          await openDims(page, floor.projectId, floor.floorId, dimsPath(floor));
          await expect(options(page)).toHaveCount(4);
          await expect.soft(field(page, 1)).toBeEnabled();
          await expect.soft(page.getByRole('button', { name: new RegExp(`^${DIM.approve} #M-`, 'u') })).toHaveCount(4);
          await expect.soft(page.getByRole('button', { name: DIM.keyboardOn, exact: true })).toBeVisible();
          await ev(page, '18-D-001', 'admin_controls');
        });

        await test.step('[18-D-002] engineer member: same controls, still no request', async () => {
          eng = await openFlow(browser, engineer);
          const { page } = eng;
          await routeDims(page, { [floor.floorId]: { ...onFloor } });
          await openDims(page, floor.projectId, floor.floorId, dimsPath(floor));
          await expect(options(page)).toHaveCount(4);
          await expect.soft(field(page, 1)).toBeEnabled();
          await expect.soft(page.getByRole('button', { name: DIM.keyboardOn, exact: true })).toBeVisible();
          const mark = eng.sent.length;
          await approveButton(page, 1).click();
          await expect.soft(approveButton(page, 1)).toHaveCount(0);
          expect.soft(await writeWithin(page)).toBeNull();
          expect.soft(writesSince(eng, mark)).toEqual([]);
          await ev(page, '18-D-002', 'engineer_controls');
        });

        view = await openFlow(browser, viewer);
        const viewPage = view.page;
        const viewDims = await routeDims(viewPage, { [floor.floorId]: { rows: null } });
        const viewAnswer = viewDims.floors[floor.floorId]!;

        await test.step('[18-D-008] viewer on an empty floor → empty state + link (link allowed)', async () => {
          await openDims(viewPage, floor.projectId, floor.floorId, dimsPath(floor));
          await expect.soft(viewPage.getByText(DIM.emptyTitle, { exact: true })).toBeVisible();
          await expect.soft(viewPage.getByRole('link', { name: DIM.toScale, exact: true })).toHaveAttribute('href', ROUTES.project.scale(floor.projectId, floor.floorId));
          await ev(viewPage, '18-D-008', 'viewer_empty_link');
        });

        await test.step('[18-D-003] viewer: fields disabled, no approve buttons, forbidden footer text', async () => {
          viewAnswer.rows = BASE4;
          viewAnswer.scale = SCALE;
          await viewPage.reload();
          await expect(options(viewPage)).toHaveCount(4);
          await expect.soft(field(viewPage, 1)).toBeDisabled();
          await expect.soft(viewPage.getByRole('button', { name: new RegExp(`^${DIM.approve} #M-`, 'u') })).toHaveCount(0);
          await expect.soft(panel(viewPage).getByText(DIM.forbiddenDescription, { exact: true })).toBeVisible();
          await expect.soft(viewPage.getByRole('button', { name: DIM.keyboardOn, exact: true })).toHaveCount(0);
          await ev(viewPage, '18-D-003', 'viewer_read_only');
        });

        await test.step('[18-D-004] viewer: `R` and Enter inert; Esc still deselects', async () => {
          await selectRow(viewPage, 1);
          await expect(option(viewPage, 1)).toHaveAttribute('aria-selected', 'true');
          await progress(viewPage).click();
          await viewPage.keyboard.press('r');
          await viewPage.keyboard.press('Enter');
          await painted(viewPage);
          await expect.soft(keyboardSection(viewPage)).toHaveCount(0);
          await expect.soft(progress(viewPage)).toHaveText(progressText(0, 4));
          await viewPage.keyboard.press('Escape');
          await expect.soft(option(viewPage, 1)).toHaveAttribute('aria-selected', 'false');
          await ev(viewPage, '18-D-004', 'viewer_keys');
        });

        await test.step('[18-D-005] viewer: canvas chains not clickable; sr-only forbidden description', async () => {
          await expect.soft(chain(viewPage, 1)).toHaveCSS('pointer-events', 'none');
          await chain(viewPage, 1).locator('text').click({ force: true });
          await expect.soft(option(viewPage, 1)).toHaveAttribute('aria-selected', 'false');
          const describedBy = (await canvasFrame(viewPage).getAttribute('aria-describedby')) ?? '';
          expect.soft(describedBy).not.toBe('');
          await expect.soft(viewPage.locator(`[id="${describedBy}"]`)).toHaveText(DIM.forbiddenDescription);
          await ev(viewPage, '18-D-005', 'viewer_canvas_inert');
        });

        await test.step('[18-D-006] viewer: rows still selectable → compare bar shows', async () => {
          await selectRow(viewPage, 2);
          await expect.soft(option(viewPage, 2)).toHaveAttribute('aria-selected', 'true');
          await expect.soft(compareBar(viewPage)).toBeVisible();
          await ev(viewPage, '18-D-006', 'viewer_compare');
        });

        await test.step('[18-D-007] ⚑ viewer while N16 loads → skeleton (same as other roles)', async () => {
          const hold = gate();
          viewAnswer.hold = hold.promise;
          await viewPage.reload();
          await expect(region(viewPage)).toBeVisible();
          // ⚑ UD:245-247: `forbidden` wins over `loading` → no skeleton, "0/0 kích thước đã duyệt" (same as 17-D-010).
          await expect.soft(skeletonRows(viewPage), '⚑ skeleton for a viewer while N16 loads').toHaveCount(4);
          await ev(viewPage, '18-D-007', 'viewer_loading', `N16 held; progress: ${(await progress(viewPage).textContent().catch(() => null)) ?? '—'}`);
          viewAnswer.hold = undefined;
          hold.release();
          await expect(options(viewPage)).toHaveCount(4);
        });

        await test.step('[18-D-010] ⚑ forbidden title "Không có quyền duyệt kích thước" renders', async () => {
          // ⚑ dead copy: DT:191 is never rendered (DV:284-288 shows the description only).
          await expect.soft(viewPage.getByText(DIM.forbiddenTitle, { exact: true }), '⚑ forbidden title').toBeVisible();
          await ev(viewPage, '18-D-010', 'viewer_forbidden_title');
        });
      } finally {
        if (eng !== undefined) await closeFlow(eng);
        if (view !== undefined) await closeFlow(view);
      }
    });
  });
});
