/**
 * Phase 4 — SCR-21 wall-thickness standardization (ThicknessStandardization), EDGE layer, real stack: eight sequential
 * user flows (QA-04c P4, `flow-plan.md` "phase04_thickness_edge.spec.ts"). One `test()` per flow, one
 * `test.step('[<row id>] …')` per catalog row, in the planned order. `H` rows use a hard `expect`, `S` rows `expect.soft`;
 * a row marked ⚑ asserts the CORRECT behaviour and stays red when the app is wrong (never loosened to turn green).
 *
 * Bản Z (S-21, UI-redesign): the screen is a left panel (head, histogram, the three target groups, the walls left for a
 * manual review, ONE sticky main button) + the drawing; the per-wall table lives in the drawer "Bảng từng đoạn tường".
 * Rule (owner-approved): within 30 mm of 110/220/330 is standard and never changed; otherwise 80–165 → 110,
 * 166–275 → 220, 276–399 → 330; under 80 mm ("nghi AI nhận nhầm") and from 400 mm ("dày bất thường") are left for a
 * manual review. Reviewed walls never enter the batch. Rows of removed controls (the separate preview, "Áp lại cho mọi
 * tường lệch nhóm", the four summary tiles, the "Dung sai" field, the collapse toggle) keep their id and check the same
 * idea on the new UI, or note why it is gone.
 *
 * Source (FE, this branch): TV src/screens/qc/ThicknessStandardization/ThicknessStandardization.tsx · TBP …/ThicknessBatchPanel.tsx ·
 * TB …/thicknessBatch.ts · UT …/useThicknessStandardization.ts · TG …/thicknessStandardizationGateway.ts · TST …/ThicknessSegmentTable.tsx ·
 * TH …/ThicknessHistogram.tsx · TPC …/ThicknessPreviewCanvas.tsx · TT …/thicknessTypes.ts · DWT src/domain/walls/thicknessTolerance.ts ·
 * SLS src/lib/autosave/spatialLayerSave.ts · FSB …/FloorLayerSaveBanner.tsx · FLR src/screens/qc/shared/floorLayerReadFailure.ts ·
 * UFL src/hooks/useFloorLayer.ts · STD src/lib/geometry/standardize.ts (M-05).
 *
 * ## Users and data
 * The shared admin; every flow signs in once in its own context WITH reduced motion and owns its project(s):
 * `POST /api/projects`, walls written through the real #35, deleted in `finally`. Wall thickness values: `support/p04/P4.ts`
 * (180 mm = 40 mm off 220, so it is changed; 200 mm would now be standard). No upload, no mock.
 *
 * ## Request budget per full run
 * - `POST /api/auth/login`: 1 (beforeAll) + 8 flow sessions + 1 anonymous probe (no login) = 9 (limit 120 / 60 s per IP).
 * - `POST /api/projects` 8 (+8 DELETE), `PUT …/spatial/layer` ≈ 40 (fixtures and the screen's own applies), `GET …/layer` ≈ 60.
 * - `POST /api/auth/refresh`: ≈ 1 per page load (≈ 50). No upload init, no invitation.
 */
import { expect, test, type APIRequestContext, type Browser, type Locator, type Page } from '@playwright/test';

import { ROUTES } from '../../e2e/fixtures/routes';
import { waitForApi, waitForApiWhere, type ApiResult } from '../../e2e/fullstack/apiWatch';
import { AUTOSAVE_TIMEOUT_MS } from '../../e2e/fullstack/env';
import { signedInApi } from './support/api';
import { readAdminCredentials } from './support/auth';
import { attachJson, captureEvidence } from './support/evidence';
import { deleteSeededProject } from './support/phase03Seed';
import { closeFlow, openFlow, writesSince, type Flow } from './support/p03/P5';
import { spaGo } from './support/p03/P11';
import {
  seedWalls,
  thkEntries,
  thkMix,
  thkReapply,
  thkSpread,
  thkTol,
  viNumber,
  wallCode,
  type Built,
} from './support/p04/P4';

/* ---------------------------------------------------------------- copy (each cites its source) */

const SCREEN = 'Chuẩn hoá độ dày tường'; // TV:SCREEN_TITLE
const PANEL = 'Bảng chuẩn hoá độ dày'; // TV:PANEL_LABEL
const HIST_SECTION = 'Phân bố độ dày đo được'; // TV:HISTOGRAM_SECTION_LABEL
const GROUPS_SECTION = 'Nhóm đổi về chuẩn'; // TBP:TEXT.groupsTitle
const DETAIL = 'Bảng từng đoạn tường'; // TV:DETAIL_TITLE (drawer)
const APPLY = 'Áp dụng'; // picker of the per-wall table (TST)
const CANCEL = 'Huỷ';
const UNDO = 'Hoàn tác';
const TOLERANCE = 'Dung sai'; // removed field (bản Z): tolerance is the domain's 30 mm
const EMPTY_TITLE = 'Chưa có đoạn tường nào để chuẩn hoá'; // TV:EMPTY_TITLE
const NO_MEASUREMENT =
  'Chưa có số đo độ dày nào cho công trình này. Sang lớp tường để dò lại các đoạn tường, rồi quay lại đây để chuẩn hoá độ dày.'; // UT:THICKNESS_SCREEN_TEXT
const NOTHING_LEFT = 'Không còn đoạn nào cần đổi.'; // TB:THICKNESS_BATCH_TEXT.nothingLeft
const IDLE = 'Chưa đổi gì. Tích nhóm muốn đổi, bản vẽ sáng các đoạn của nhóm khi rê chuột.'; // TB:THICKNESS_BATCH_TEXT.idle
const TOO_THIN = 'Nghi AI nhận nhầm'; // TB
const TOO_THICK = 'Dày bất thường, có thể là cột BTCT'; // TB
const MANUAL_LABEL = 'Xem tay'; // TST:OPTION_LABELS.CONCRETE_COLUMN
const COLLAPSE = 'Thu gọn khung xem trước'; // removed (bản Z): the drawing is the main view
const TOASTS = 'Thông báo';
const CHANGE_THICKNESS = 'Đổi độ dày'; // TableActionBar
const PICKER = 'Chọn nhóm áp cho các đoạn đã chọn'; // TST:CHOOSE_GROUP_LABEL
const CONFLICT = 'Tầng này vừa được sửa ở nơi khác. Tải lại để xem bản mới nhất.'; // SLS:83
const RELOAD = 'Tải lại'; // FSB:37
const SLIDERS = ['Ngưỡng giữa 110 mm và 220 mm', 'Ngưỡng giữa 220 mm và 330 mm', 'Ngưỡng giữa 330 mm và xem tay (≥ 400 mm)'] as const; // TH
const HISTOGRAM = 'Biểu đồ phân bố độ dày tường theo mi-li-mét'; // TH:HISTOGRAM_LABEL
const PROJECT_NOT_FOUND = 'Không tìm thấy dự án này';
const FLOOR_MISSING = 'Không mở được tầng này';
const FLOOR_GONE = 'Tầng này không còn tồn tại. Mở Quản lý tầng để chọn một tầng khác.';

/* ---------------------------------------------------------------- session and locators */

const softly = expect.configure({ soft: true });

let adminApi: APIRequestContext;

test.beforeAll(async () => {
  const admin = readAdminCredentials();
  adminApi = await signedInApi(admin.email, admin.password);
});

test.afterAll(async () => {
  await adminApi?.dispose();
});

const region = (page: Page): Locator => page.getByRole('region', { name: SCREEN, exact: true });
const panel = (page: Page): Locator => region(page).locator(`aside[aria-label="${PANEL}"]`);
const drawer = (page: Page): Locator => page.getByRole('dialog', { name: DETAIL, exact: true });
const segTable = (page: Page): Locator => drawer(page).getByRole('table');
const segRows = (page: Page): Locator => segTable(page).locator('tbody tr');
const groupRows = (page: Page): Locator => region(page).locator('[data-testid^="thickness-group-"]');
const groupRow = (page: Page, target: number): Locator => region(page).getByTestId(`thickness-group-${String(target)}`);
const button = (page: Page, name: string): Locator => region(page).getByRole('button', { name, exact: true });
/** The group checkbox "Đồng ý đổi các đoạn {range} về {target} mm" (TBP:TEXT.acceptGroup). */
const acceptBox = (page: Page, target?: number): Locator =>
  region(page).getByRole('checkbox', {
    name: target === undefined ? /^Đồng ý đổi các đoạn / : new RegExp(`^Đồng ý đổi các đoạn .+ về ${String(target)} mm$`, 'u'),
  });
/** The panel's ONE main button before a group is ticked: "Chọn cả N nhóm (M đoạn)" / "Chọn nhóm này (M đoạn)". */
const selectAllBtn = (page: Page): Locator => region(page).getByRole('button', { name: /^Chọn (cả \d+ nhóm|nhóm này) \(\d+ đoạn\)$/u });
/** The panel's ONE main button once a group is ticked: "Đổi N đoạn" (+ the Enter key cap). */
const changeBtn = (page: Page, count?: number): Locator =>
  region(page).getByRole('button', { name: count === undefined ? /^Đổi \d+ đoạn/u : new RegExp(`^Đổi ${String(count)} đoạn`, 'u') });
const statusLine = (page: Page): Locator => region(page).getByText(/đoạn không chuẩn,/u);
const batchLine = (page: Page): Locator => panel(page).locator('p[aria-live="polite"]');
const manualLink = (page: Page, code: string): Locator => region(page).getByRole('button', { name: `Mở đoạn ${code} ở màn duyệt tường`, exact: true });
const toasts = (page: Page): Locator => page.getByRole('region', { name: TOASTS, exact: true });
const toastText = (page: Page, text: string | RegExp): Locator => toasts(page).getByText(text);
const slider = (page: Page, index: number): Locator => page.getByRole('slider', { name: SLIDERS[index] as string, exact: true });
const polygons = (page: Page): Locator => page.locator('aside[aria-label="Mặt bằng xem trước theo nhóm độ dày"] svg polygon');

/** Checkbox / radio drawn over an sr-only input: focus + Space (the old specs' `pressSpaceOn`). */
async function tick(box: Locator): Promise<void> {
  await box.focus();
  await box.page().keyboard.press('Space');
}

const ev = (page: Page, row: string, slug: string, caption?: string): Promise<string> =>
  captureEvidence(page, `E04_${row}_${slug}.png`, caption === undefined ? {} : { caption });

const note = (description: string): void => {
  test.info().annotations.push({ type: 'note', description });
};

const LAYER_PATH = /\/floors\/([^/]+)\/spatial\/layer$/u;
/** PUTs to `floorId`'s layer sent since `from` (index into `flow.sent`). */
const putsTo = (flow: Flow, floorId: string, from = 0): number =>
  flow.sent.slice(from).filter((request) => request.method === 'PUT' && LAYER_PATH.exec(request.path)?.[1] === floorId).length;

/** Next PUT of `floorId`'s layer whose sent walls pass `sent`. Register BEFORE the action. */
function waitForPut(page: Page, projectId: string, floorId: string, sent?: (walls: Record<string, unknown>[]) => boolean): Promise<ApiResult> {
  const path = `/api/projects/${projectId}/floors/${floorId}/spatial/layer`;
  return waitForApiWhere(
    page,
    (response) => {
      if (response.request().method() !== 'PUT' || new URL(response.url()).pathname !== path) return false;
      if (sent === undefined) return true;
      try {
        return sent(sentWalls(response.request().postDataJSON() as unknown));
      } catch {
        return false;
      }
    },
    AUTOSAVE_TIMEOUT_MS,
    'PUT …/spatial/layer',
  );
}

function sentWalls(body: unknown): Record<string, unknown>[] {
  const layer = ((body as { body?: { layer?: { walls?: unknown } } }).body?.layer ?? {}) as { walls?: unknown };
  return Array.isArray(layer.walls) ? (layer.walls as Record<string, unknown>[]) : [];
}

const wallsOfPut = (result: ApiResult): Record<string, unknown>[] => sentWalls(result.response.request().postDataJSON() as unknown);
const thicknessOf = (walls: Record<string, unknown>[], id: string): unknown => walls.find((wall) => wall['id'] === id)?.['thicknessMm'];

/** Opens SCR-21 of floor `index` (deep link) and waits until the histogram is drawn (not the loading shell). */
async function openThickness(page: Page, built: Built, index = 0): Promise<void> {
  await page.goto(ROUTES.project.thickness(built.project.projectId, built.floorIds[index] as string));
  await expect(region(page)).toBeVisible();
  await expect(page.getByRole('region', { name: HISTOGRAM, exact: true })).toBeVisible();
}

/** Opens the drawer "Bảng từng đoạn tường" (the per-wall table) unless it is open. */
async function openDetail(page: Page): Promise<void> {
  if (await drawer(page).isVisible().catch(() => false)) return;
  await region(page).getByRole('button', { name: /^Xem bảng từng đoạn \(\d+\)$/u }).click();
  await expect(drawer(page)).toBeVisible();
}

/** Closes the drawer (it is modal: the panel and the drawing are behind it). */
async function closeDetail(page: Page): Promise<void> {
  if (!(await drawer(page).isVisible().catch(() => false))) return;
  await page.keyboard.press('Escape');
  await expect(drawer(page)).toHaveCount(0);
}

/** Texts of one column of the per-wall table (0 = checkbox, 1 = code, 2 = measured, 4 = deviation, 6 = floor, 7 = status). */
async function column(page: Page, index: number): Promise<string[]> {
  await openDetail(page);
  return segRows(page).evaluateAll((rows, at) => rows.map((row) => (row.querySelectorAll('td')[at as number]?.textContent ?? '').replace(/\s+/gu, ' ').trim()), index);
}

/** Row of the per-wall table showing `code`. */
const rowOfCode = (page: Page, code: string): Locator => segRows(page).filter({ has: page.getByText(code, { exact: true }) });

async function withFlow(
  browser: Browser,
  builts: readonly Built[],
  body: (flow: Flow) => Promise<void>,
  options: { readonly reducedMotion?: boolean } = {},
): Promise<void> {
  let flow: Flow | undefined;
  try {
    flow = await openFlow(browser, readAdminCredentials(), { reducedMotion: options.reducedMotion ?? true });
    await body(flow);
  } finally {
    await closeFlow(flow as Flow);
    for (const built of builts) {
      const problem = await deleteSeededProject(adminApi, built.project.projectId);
      if (problem !== null) note(problem);
    }
  }
}

/** Ticks the group of `target` mm, presses "Đổi N đoạn" and waits for the PUT; returns it. */
async function applyGroup(page: Page, built: Built, floorIndex: number, target: number): Promise<ApiResult> {
  await closeDetail(page);
  const box = acceptBox(page, target);
  if (!(await box.isChecked())) await tick(box);
  const put = waitForPut(page, built.project.projectId, built.floorIds[floorIndex] as string);
  await changeBtn(page).click();
  return put;
}

/* ================================================================= flows */

test.describe('E04 SCR-21 thickness — real-stack flows (QA-04c P4)', () => {
  test('SCR-21 · FL-21-01 · tick a group, "Đổi N đoạn" in one PUT, bar / toast undo, Ctrl+S', async ({ browser }) => {
    test.setTimeout(300_000);
    const built = await thkMix(adminApi, '21-01');
    const ids = built.walls[0] as string[]; // 5 x 180, 150, 220
    const floorId = built.floorIds[0] as string;
    await withFlow(browser, [built], async (flow) => {
      const { page } = flow;
      await openThickness(page, built);
      const sent: number[] = [];
      let applied: ApiResult | undefined;

      await test.step('[21-E-001] region "Chuẩn hoá độ dày tường": the panel, its histogram and group sections, the drawing', async () => {
        await expect(region(page)).toBeVisible(); // TV
        await expect.soft(panel(page)).toBeVisible();
        await expect.soft(region(page).getByRole('heading', { level: 1, name: SCREEN, exact: true })).toBeVisible();
        await expect.soft(region(page).getByRole('region', { name: HIST_SECTION, exact: true })).toBeVisible();
        await expect.soft(region(page).getByRole('region', { name: GROUPS_SECTION, exact: true })).toBeVisible();
        await expect.soft(page.locator('aside[aria-label="Mặt bằng xem trước theo nhóm độ dày"]')).toBeVisible();
        await ev(page, '21-E-001', 'screen');
      });

      await test.step('[21-B-004] ⚑ state line: badge + "6/7 đoạn không chuẩn, 1 đúng chuẩn", each number shown once (BUG-340)', async () => {
        await expect.soft(statusLine(page)).toHaveText('6/7 đoạn không chuẩn, 1 đúng chuẩn'); // TB:statusSentenceOf
        await expect.soft(panel(page).getByText('Chưa chuẩn hoá', { exact: true })).toBeVisible();
        const text = await panel(page).evaluate((node) => (node as HTMLElement).innerText);
        const totals = text.split(/\s+/u).filter((token) => token.startsWith('6/7')).length;
        await attachJson('E04_21-B-004_summary.json', { text, totals });
        expect.soft(totals, 'the count "6/7" is shown once').toBe(1);
        expect.soft(await groupRows(page).count(), 'group rows: → 110 and → 220; the 220 mm wall is standard, no row (BUG-421)').toBe(2);
        await ev(page, '21-B-004', 'state-line');
      });

      await test.step('[21-A-010] nothing ticked: the main button leads to the missing step ("Chọn cả 2 nhóm (6 đoạn)"), no "Đổi", no PUT', async () => {
        const from = flow.sent.length;
        await expect.soft(selectAllBtn(page)).toHaveText('Chọn cả 2 nhóm (6 đoạn)'); // TBP:ThicknessBatchFooter
        await expect.soft(changeBtn(page)).toHaveCount(0);
        await expect.soft(batchLine(page)).toHaveText(IDLE);
        expect.soft(putsTo(flow, floorId, from)).toBe(0);
        await ev(page, '21-A-010', 'nothing-ticked');
      });

      await test.step('[21-A-006] tick the → 220 group: the panel itself previews the batch ("5 đoạn về 1 nhóm chuẩn.", "Đổi 5 đoạn", one-undo hint)', async () => {
        await expect(acceptBox(page, 220)).not.toBeChecked(); // never pre-ticked
        await tick(acceptBox(page, 220));
        await expect(acceptBox(page, 220)).toBeChecked();
        await expect.soft(batchLine(page)).toHaveText('5 đoạn về 1 nhóm chuẩn.');
        await expect.soft(changeBtn(page, 5)).toBeVisible();
        await expect.soft(panel(page).getByText('trả lại cả lô', { exact: true })).toBeVisible();
        await ev(page, '21-A-006', 'batch-preview');
      });

      await test.step('[21-C-011] labels have one decimal and a comma: "180,0 mm", "40,0 mm"', async () => {
        const measured = await column(page, 2);
        const deviation = await column(page, 4);
        expect.soft(measured.filter((text) => /^180,0\s*mm$/u.test(text))).toHaveLength(5); // TG:lengthLabel
        expect.soft(deviation).toContain('40,0 mm');
        await attachJson('E04_21-C-011_labels.json', { measured, deviation });
        await closeDetail(page);
      });

      await test.step('[21-A-011] Esc with a group ticked writes nothing (the panel is the preview: no layer to apply from)', async () => {
        await acceptBox(page, 220).focus();
        await page.keyboard.press('Escape');
        await expect.soft(acceptBox(page, 220)).toBeChecked();
        expect.soft(putsTo(flow, floorId)).toBe(0);
      });

      await test.step('[21-A-005] untick the group: unchecked, the batch line and the main button go back', async () => {
        await tick(acceptBox(page, 220));
        await expect.soft(acceptBox(page, 220)).not.toBeChecked();
        await expect.soft(batchLine(page)).toHaveText(IDLE);
        await expect.soft(selectAllBtn(page)).toBeVisible();
        await tick(acceptBox(page, 220)); // tick again for the apply below
        await expect(acceptBox(page, 220)).toBeChecked();
      });

      await test.step('[21-A-009] "Đổi 5 đoạn" applies in ONE PUT: toast with undo, the → 220 group row is gone', async () => {
        const put = waitForPut(page, built.project.projectId, floorId);
        await changeBtn(page, 5).click(); // UT:onApplyBatch
        const result = await put;
        sent.push(result.response.status());
        applied = result;
        await expect.soft(toastText(page, 'Chuẩn hoá độ dày 5 tường.')).toBeVisible();
        await expect.soft(toasts(page).getByRole('button', { name: UNDO, exact: true })).toBeVisible();
        await expect.soft(acceptBox(page, 220)).toHaveCount(0);
        await expect.soft(statusLine(page)).toHaveText('1/7 đoạn không chuẩn, 6 đúng chuẩn');
        expect.soft(putsTo(flow, floorId), 'exactly one PUT for the whole batch').toBe(1);
        await attachJson('E04_21-A-009_put.json', { status: result.response.status(), walls: wallsOfPut(result).map((wall) => [wall['id'], wall['thicknessMm']]) });
        await ev(page, '21-A-009', 'applied');
      });

      await test.step('[21-C-005] a ticked group changes every wall of the group, nothing outside it', async () => {
        const walls = applied === undefined ? [] : wallsOfPut(applied);
        expect(walls.length, 'the apply PUT of [21-A-009]').toBeGreaterThan(0);
        for (const id of ids.slice(0, 5)) expect.soft(thicknessOf(walls, id), `wall ${id}`).toBe(220);
        expect.soft(thicknessOf(walls, ids[5] as string), 'the 150 mm wall is not in a ticked group').toBe(150);
        expect.soft(thicknessOf(walls, ids[6] as string)).toBe(220);
      });

      await test.step('[21-C-007] one apply = one history step and one toast, whatever N', async () => {
        await expect.soft(toastText(page, 'Chuẩn hoá độ dày 5 tường.')).toHaveCount(1);
        await expect.soft(toasts(page).getByRole('button', { name: UNDO, exact: true })).toHaveCount(1);
      });

      await test.step('[21-A-012] "Hoàn tác" reverts the whole batch in one PUT', async () => {
        const put = waitForPut(page, built.project.projectId, floorId, (walls) => ids.slice(0, 5).every((id) => thicknessOf(walls, id) === 180));
        await toasts(page).getByRole('button', { name: UNDO, exact: true }).click();
        sent.push((await put).response.status());
        await expect.soft(statusLine(page)).toHaveText('6/7 đoạn không chuẩn, 1 đúng chuẩn');
        await expect.soft(acceptBox(page, 220)).not.toBeChecked();
        await ev(page, '21-A-012', 'undo');
      });

      await test.step('[21-G-003] undo sends one PUT restoring the old thickness', async () => {
        expect.soft(putsTo(flow, floorId), 'apply PUT + undo PUT').toBe(2);
        expect.soft(sent).toEqual([200, 200]);
      });

      await test.step('[21-A-013] the toast "Hoàn tác" reverts the apply', async () => {
        const result = await applyGroup(page, built, 0, 220);
        expect(result.response.status()).toBe(200);
        const put = waitForPut(page, built.project.projectId, floorId, (walls) => ids.slice(0, 5).every((id) => thicknessOf(walls, id) === 180));
        const toast = toasts(page).getByRole('status').filter({ hasText: 'Chuẩn hoá độ dày 5 tường.' }).first();
        await toast.getByRole('button', { name: UNDO, exact: true }).click();
        expect.soft((await put).response.status()).toBe(200);
        await expect.soft(statusLine(page)).toHaveText('6/7 đoạn không chuẩn, 1 đúng chuẩn');
        await ev(page, '21-A-013', 'toast-undo');
      });

      await test.step('[21-A-014] the bar "Hoàn tác" with nothing to undo does nothing', async () => {
        const from = flow.sent.length;
        await expect.soft(button(page, UNDO)).toBeEnabled(); // QcStatusBar
        await button(page, UNDO).click();
        await button(page, UNDO).click();
        await expect.soft(statusLine(page)).toHaveText('6/7 đoạn không chuẩn, 1 đúng chuẩn');
        expect.soft(putsTo(flow, floorId, from)).toBe(0);
      });

      await test.step('[21-A-043] Ctrl+S right after "Đổi": the PUT is sent before the 800 ms debounce', async () => {
        if (!(await acceptBox(page, 220).isChecked())) await tick(acceptBox(page, 220));
        // Fake clock, paused: the 800 ms autosave debounce cannot fire on its own, so a PUT can only come from the Ctrl+S flush.
        await page.clock.install();
        await page.clock.pauseAt(await page.evaluate(() => Date.now() + 100));
        const put = waitForPut(page, built.project.projectId, floorId);
        try {
          await changeBtn(page, 5).click();
          await page.keyboard.press('Control+S');
          const result = await put.catch(() => null);
          await attachJson('E04_21-A-043_put.json', { status: result?.response.status() ?? null });
          expect.soft(result?.response.status(), 'Ctrl+S sends the PUT while the debounce clock is held').toBe(200);
        } finally {
          await page.clock.resume();
        }
        await ev(page, '21-A-043', 'ctrl-s');
      });
    });
  });

  test('SCR-21 · FL-21-02 · tolerance 30 mm: standard vs changed, walls left for a manual review, success, reload', async ({ browser }) => {
    test.setTimeout(300_000);
    const built = await thkTol(adminApi, '21-02');
    const ids = built.walls[0] as string[]; // 150, 189, 190, 200, 220, 60, 180 (reviewed)
    const floorId = built.floorIds[0] as string;
    await withFlow(browser, [built], async (flow) => {
      const { page } = flow;
      await openThickness(page, built);
      const code = (index: number): string => wallCode(ids[index] as string, ids);

      await test.step('[21-A-007] the batch line names what stays out: the 60 mm wall (manual) and the reviewed wall', async () => {
        await tick(acceptBox(page, 110));
        await tick(acceptBox(page, 220));
        await expect.soft(batchLine(page)).toHaveText('2 đoạn về 2 nhóm chuẩn. 1 đoạn không đổi. 1 tường đã duyệt không nằm trong lô.'); // TB:batchSentenceOf
        await expect.soft(region(page).getByText('Không đổi, giữ ở lớp Tường để xem tay (1)', { exact: true })).toBeVisible();
        await expect.soft(region(page).getByText(TOO_THIN, { exact: true })).toBeVisible();
        await expect.soft(manualLink(page, code(5))).toBeVisible();
        await ev(page, '21-A-007', 'unchanged-listed');
      });

      await test.step('[21-C-002] tolerance is 30 mm, inclusive: 190 vs 220 is standard ("Trung tính"), 189 is changed ("Cần chú ý")', async () => {
        const statuses = await column(page, 7);
        const codes = await column(page, 1);
        const statusOf = (index: number): string | undefined => statuses[codes.indexOf(code(index))];
        expect.soft(statusOf(1)).toBe('Cần chú ý'); // 189 -> deviation 31 > 30, will change (TG:toSegmentRow)
        expect.soft(statusOf(2)).toBe('Trung tính'); // 190 -> deviation 30, standard
        expect.soft(statusOf(5)).toBe('Vi phạm'); // 60 mm -> manual review
        await attachJson('E04_21-C-002_statuses.json', { codes, statuses });
        await closeDetail(page);
      });

      await test.step('[21-A-021] the counts follow the fixed 30 mm tolerance: "4/7 đoạn không chuẩn, 3 đúng chuẩn"; no "Dung sai" field', async () => {
        await expect.soft(statusLine(page)).toHaveText('4/7 đoạn không chuẩn, 3 đúng chuẩn');
        await expect.soft(page.getByLabel(TOLERANCE, { exact: true })).toHaveCount(0);
        note('[21-A-021] bản Z: the "Dung sai" field is gone; the owner fixed the tolerance at 30 mm (DWT:WALL_THICKNESS_TOLERANCE_MM)');
        await ev(page, '21-A-021', 'tolerance-fixed');
      });

      await test.step('[21-A-022] keyboard on the tolerance: n/a (no field); the rule edges are moved on the sliders, FL-21-03', async () => {
        await expect.soft(page.getByLabel(TOLERANCE, { exact: true })).toHaveCount(0);
        note('[21-A-022] keyboard steps are covered on the threshold sliders ([21-A-018] … [21-A-020])');
      });

      await test.step('[21-A-042] ⚑ a non-number tolerance: n/a, no free-text tolerance exists any more', async () => {
        await expect.soft(page.getByLabel(TOLERANCE, { exact: true })).toHaveCount(0);
      });

      await test.step('[21-C-008] a negative tolerance: n/a; the reviewed wall is never in the batch, whatever is ticked', async () => {
        await tick(acceptBox(page, 110)); // untick
        await tick(acceptBox(page, 220)); // untick
        await expect.soft(selectAllBtn(page)).toHaveText('Chọn cả 2 nhóm (2 đoạn)'); // the reviewed 180 mm wall is not counted
      });

      await test.step('[21-B-015] row status badges and the off-standard dot', async () => {
        const statuses = await column(page, 7);
        expect.soft(new Set(statuses)).toEqual(new Set(['Đã duyệt', 'Vi phạm', 'Cần chú ý', 'Trung tính'])); // TST
        const withDot = await segRows(page).evaluateAll((rows) => rows.filter((row) => row.querySelectorAll('td')[4]?.querySelector('span[aria-hidden="true"]') !== null).length);
        await attachJson('E04_21-B-015_badges.json', { statuses, rowsWithDot: withDot });
        expect.soft(withDot, 'dot beside "Sai lệch" only over the tolerance (150, 189, 60, reviewed 180)').toBe(4);
        await ev(page, '21-B-015', 'row-badges');
        await closeDetail(page);
      });

      await test.step('[21-B-005] success after the last group (BUG-421): no group left, "Còn đoạn xem tay", the sentence says why', async () => {
        await selectAllBtn(page).click();
        const put = waitForPut(page, built.project.projectId, floorId);
        await changeBtn(page, 2).click();
        expect((await put).response.status()).toBe(200);
        await expect.soft(batchLine(page)).toHaveText(`${NOTHING_LEFT} 1 đoạn không đổi. 1 tường đã duyệt không nằm trong lô.`);
        await expect.soft(panel(page).getByText('Còn đoạn xem tay', { exact: true })).toBeVisible();
        await expect.soft(acceptBox(page)).toHaveCount(0);
        await expect.soft(changeBtn(page)).toHaveCount(0);
        await ev(page, '21-B-005', 'all-changed');
      });

      await test.step('[21-A-041] reload after an apply: the server copy has the standard thicknesses and no group row left', async () => {
        await page.reload();
        await expect(region(page)).toBeVisible();
        await openDetail(page);
        await expect(segRows(page)).toHaveCount(7);
        expect.soft((await column(page, 2)).sort()).toEqual(['110,0 mm', '180,0 mm', '190,0 mm', '200,0 mm', '220,0 mm', '220,0 mm', '60,0 mm']); // UFL
        await closeDetail(page);
        await expect.soft(acceptBox(page)).toHaveCount(0);
        await expect.soft(region(page).getByRole('region', { name: GROUPS_SECTION, exact: true })).toHaveCount(0);
        await ev(page, '21-A-041', 'after-reload');
      });

      await test.step('[21-A-008] a code in the manual list opens that wall in the walls review', async () => {
        await manualLink(page, code(5)).click(); // UT:onOpenWall
        await expect.soft(page).toHaveURL(new RegExp(`${ROUTES.project.walls(built.project.projectId, floorId)}$`, 'u'));
        await ev(page, '21-A-008', 'open-wall');
      });
    });
  });

  test('SCR-21 · FL-21-03 · thresholds: rounding edges, drag, keys, Home/End, crossing, histogram, live state', async ({ browser }) => {
    test.setTimeout(300_000);
    const built = await thkSpread(adminApi, '21-03');
    const ids = built.walls[0] as string[]; // 79 80 165 166 275 276 399 400
    const floorId = built.floorIds[0] as string;
    await withFlow(browser, [built], async (flow) => {
      const { page } = flow;
      const groupLabelOf = async (index: number): Promise<string> => {
        await openDetail(page);
        return rowOfCode(page, wallCode(ids[index] as string, ids)).getByRole('combobox').innerText();
      };
      const value = async (index: number): Promise<number> => Number(await slider(page, index).getAttribute('aria-valuenow'));
      const limit = async (index: number, which: 'min' | 'max'): Promise<number> => Number(await slider(page, index).getAttribute(`aria-value${which}`));
      const sliderGrip = async (index: number): Promise<{ x: number; y: number }> => {
        const box = await slider(page, index).boundingBox();
        if (box === null) throw new Error('slider has no box');
        return { x: box.x + box.width / 2, y: box.y + box.height / 2 };
      };
      /** Screen x of the histogram axis value `mm` (min / max read from the first slider's aria-valuemin / max). */
      const screenX = async (mm: number): Promise<number> => {
        const [min, max] = [await limit(0, 'min'), await limit(0, 'max')];
        const plot = await slider(page, 0).evaluate((node) => (node.parentElement as HTMLElement).getBoundingClientRect().toJSON() as { x: number; width: number });
        return plot.x + ((mm - min) / (max - min)) * plot.width;
      };
      const dragSlider = async (index: number, toMm: number): Promise<void> => {
        const grip = await sliderGrip(index);
        await page.mouse.move(grip.x, grip.y);
        await page.mouse.down();
        await page.mouse.move(await screenX(toMm), grip.y, { steps: 12 });
        await page.mouse.up();
      };
      await openThickness(page, built);

      await test.step('[21-C-001] default rounding at 80 / 166 / 276 / 400 follows roundWallThickness', async () => {
        expect.soft(await groupLabelOf(2)).toBe('110 mm'); // 165 -> 110
        expect.soft(await groupLabelOf(3)).toBe('220 mm'); // 166 -> 220
        expect.soft(await groupLabelOf(4)).toBe('220 mm'); // 275 -> 220
        expect.soft(await groupLabelOf(5)).toBe('330 mm'); // 276 -> 330
        expect.soft(await groupLabelOf(6)).toBe('330 mm'); // 399 -> 330
        expect.soft(await groupLabelOf(7)).toBe(MANUAL_LABEL); // 400 -> manual review
        await closeDetail(page);
        await expect.soft(region(page).getByText(TOO_THIN, { exact: true })).toBeVisible(); // 79 mm
        await expect.soft(region(page).getByText(TOO_THICK, { exact: true })).toBeVisible(); // 400 mm
        await expect.soft(statusLine(page)).toHaveText('7/8 đoạn không chuẩn, 1 đúng chuẩn'); // 80 mm is 30 off 110: standard
        await ev(page, '21-C-001', 'default-rounding');
      });

      await test.step('[21-A-016] drag a threshold line with the mouse: 5 mm steps, groups regroup, no PUT', async () => {
        const from = flow.sent.length;
        await dragSlider(0, 200);
        const now = await value(0);
        expect.soft(now % 5, 'moves in 5 mm steps').toBe(0); // TH
        expect.soft(now).toBeGreaterThan(180);
        await expect.soft(slider(page, 0)).toHaveAttribute('aria-valuetext', `${now} mm`);
        await expect.soft(groupRow(page, 110)).toContainText('165–166 mm'); // 166 mm is now below the first threshold
        expect.soft(putsTo(flow, floorId, from)).toBe(0);
        await ev(page, '21-A-016', 'threshold-dragged');
      });

      await test.step('[21-A-018] Home / End jump to the axis ends', async () => {
        const min = await limit(0, 'min');
        await slider(page, 0).focus();
        await page.keyboard.press('Home');
        expect.soft(await value(0), 'Home on the first line = the axis minimum').toBe(min);
        const max = await limit(2, 'max');
        await slider(page, 2).focus();
        await page.keyboard.press('End');
        expect.soft(await value(2), 'End on the last line = the axis maximum').toBe(max);
      });

      await test.step('[21-A-019] ⚑ push a threshold past its neighbour: it stops, focus stays on the dragged one', async () => {
        await page.reload();
        await expect(slider(page, 0)).toBeVisible();
        await slider(page, 0).focus();
        await page.keyboard.press('End');
        const max = await limit(0, 'max');
        const focused = await page.evaluate(() => Number(document.activeElement?.getAttribute('aria-valuenow')));
        await attachJson('E04_21-A-019_focus.json', { focused, max, values: [await value(0), await value(1), await value(2)] });
        expect.soft(focused, 'focus stays on the line that was moved').toBe(await value(0)); // TG:withThresholdAt
        expect.soft(await value(0), 'the dragged line never crosses its neighbour').toBeLessThan(await value(1));
      });

      await test.step('[21-A-020] ⚑ Home pressed repeatedly stops at a fixed axis minimum', async () => {
        await page.reload();
        await slider(page, 0).focus();
        const seen: number[] = [];
        for (let press = 0; press < 3; press += 1) {
          await page.keyboard.press('Home');
          seen.push(await value(0));
        }
        await attachJson('E04_21-A-020_home.json', { seen });
        expect.soft(new Set(seen).size, 'Home gives the same value every time').toBe(1);
        expect.soft(Math.min(...seen), 'never below zero').toBeGreaterThanOrEqual(0);
      });

      await test.step('[21-C-013] dragging thresholds never writes and never adds undo steps', async () => {
        await page.reload();
        await expect(slider(page, 0)).toBeVisible();
        const from = flow.sent.length;
        for (const target of [180, 190, 175, 185, 170]) await dragSlider(0, target);
        const after = await value(0);
        await button(page, UNDO).click();
        expect.soft(await value(0), '"Hoàn tác" does not move a threshold').toBe(after);
        expect.soft(putsTo(flow, floorId, from)).toBe(0);
      });

      await test.step('[21-C-003] the manual-review walls (< 80 mm, ≥ 400 mm) are listed apart and never in the batch', async () => {
        await page.reload();
        await expect(slider(page, 0)).toBeVisible();
        await expect.soft(region(page).getByText('Không đổi, giữ ở lớp Tường để xem tay (2)', { exact: true })).toBeVisible();
        await expect.soft(selectAllBtn(page)).toHaveText('Chọn cả 3 nhóm (5 đoạn)'); // 79 and 400 are not counted
        await expect.soft(acceptBox(page)).toHaveCount(3);
      });

      await test.step('[21-C-004] group table: one row per target group, ascending, with the real measured range', async () => {
        const rows = await groupRows(page).evaluateAll((nodes) => nodes.map((node) => node.querySelector('td')?.textContent?.trim() ?? ''));
        expect.soft(rows).toEqual(['165 mm', '166–275 mm', '276–399 mm']); // TB:toTargetGroups
        expect.soft(rows.map((text) => viNumber(text.split(/[–\s]/u)[0] ?? ''))).toEqual([165, 166, 276]);
      });

      await test.step('[21-B-013] ⚑ histogram: 5 mm bins, labels "80 mm" / "166 mm" / "276 mm" / "400 mm", x ticks at least 32 px apart (BUG-394 / 406)', async () => {
        await page.reload();
        await expect(slider(page, 0)).toBeVisible();
        const hist = page.getByRole('region', { name: HISTOGRAM, exact: true });
        for (const label of ['80 mm', '166 mm', '276 mm', '400 mm']) await expect.soft(hist.getByText(label, { exact: true }).first()).toBeVisible();
        expect.soft(await hist.locator('[aria-hidden="true"].bg-text-muted').count(), 'bins 75 … 400 in 5 mm steps').toBe(66);
        const ticks = hist.locator('div.relative.h-4.w-full').last().locator('span.absolute:not(.right-0)');
        const xs: number[] = [];
        for (const tick of await ticks.all()) {
          const box = await tick.boundingBox();
          if (box !== null) xs.push(box.x);
        }
        const gaps = xs.slice(1).map((x, index) => x - (xs[index] as number));
        await attachJson('E04_21-B-013_ticks.json', { xs, gaps });
        expect.soft(Math.min(...gaps), 'x tick gaps (px)').toBeGreaterThanOrEqual(32);
        await ev(page, '21-B-013', 'histogram');
      });

      await test.step('[21-E-002] three sliders with their names and aria-valuetext', async () => {
        for (const [index, name] of SLIDERS.entries()) {
          await expect.soft(slider(page, index)).toHaveAccessibleName(name);
        }
        await expect.soft(slider(page, 0)).toHaveAttribute('aria-valuetext', '166 mm');
        await expect.soft(slider(page, 1)).toHaveAttribute('aria-valuetext', '276 mm');
        await expect.soft(slider(page, 2)).toHaveAttribute('aria-valuetext', '400 mm');
      });

      await test.step('[21-E-003] histogram bars are aria-hidden: per-bin counts are not exposed', async () => {
        const bars = page.getByRole('region', { name: HISTOGRAM, exact: true }).locator('[aria-hidden="true"].bg-text-muted');
        const exposed = await bars.evaluateAll((nodes) => nodes.filter((node) => (node.textContent ?? '').trim() !== '' || node.getAttribute('aria-label') !== null).length);
        expect.soft(await bars.count()).toBeGreaterThan(0);
        expect.soft(exposed, 'bars carry no text or label').toBe(0);
      });

      await test.step('[21-E-004] the batch sentence is live (aria-live polite)', async () => {
        await expect.soft(batchLine(page)).toHaveCount(1); // TBP:ThicknessBatchFooter
        await tick(acceptBox(page, 110));
        await expect.soft(batchLine(page)).toHaveText(/^1 đoạn về 1 nhóm chuẩn\./u);
        await tick(acceptBox(page, 110));
      });

      await test.step('[21-A-039] ⚑ hover a histogram bin: the other bars dim to 0,45 and the drawing highlights that bin\'s walls', async () => {
        const bars = page.getByRole('region', { name: HISTOGRAM, exact: true }).locator('[aria-hidden="true"].bg-text-muted');
        const before = await polygons(page).evaluateAll((nodes) => nodes.map((node) => node.getAttribute('fill-opacity')));
        const target = bars.nth(18); // the bin of 165 mm (index (165 - 75) / 5)
        await target.locator('xpath=..').hover();
        await expect
          .poll(
            async () => (await bars.evaluateAll((nodes) => nodes.map((node) => Number(getComputedStyle(node).opacity)))).filter((o) => Math.abs(o - 0.45) < 0.01).length,
            { message: 'every other bar dims' },
          )
          .toBeGreaterThan(60);
        const after = await polygons(page).evaluateAll((nodes) => nodes.map((node) => node.getAttribute('fill-opacity')));
        await attachJson('E04_21-A-039_canvas.json', { before, after });
        expect.soft(after, 'the drawing shows which walls are in the bin').not.toEqual(before);
        await ev(page, '21-A-039', 'bin-hover');
      });

      await test.step('[21-A-037] hover a group row: its walls are highlighted on the drawing, the others dimmed', async () => {
        await groupRow(page, 220).hover();
        const matched = await polygons(page).evaluateAll((nodes) => nodes.filter((node) => Math.abs(Number(node.getAttribute('fill-opacity')) - 0.9) < 0.01).length);
        const dimmed = await polygons(page).evaluateAll((nodes) => nodes.filter((node) => Math.abs(Number(node.getAttribute('fill-opacity')) - 0.18) < 0.01).length);
        await attachJson('E04_21-A-037_hover.json', { matched, dimmed });
        expect.soft(matched, 'walls of the → 220 mm group (166, 275)').toBe(2); // TPC
        expect.soft(dimmed).toBe(6);
      });
    });
  });

  test('SCR-21 · FL-21-04 · reviewed walls never enter the batch (was "Áp dụng lại bộ lọc" and its warning)', async ({ browser }) => {
    test.setTimeout(300_000);
    const built = await thkReapply(adminApi, '21-04');
    await withFlow(browser, [built], async (flow) => {
      const { page } = flow;
      const project = built.project.projectId;
      const [reviewedFloor, plainFloor, standardFloor] = built.floorIds as [string, string, string];
      const [reviewedWalls] = built.walls as [string[], string[], string[]];
      let excluded: ApiResult | undefined;

      await test.step('[21-A-023] no reviewed wall: "Chọn nhóm này (2 đoạn)" then "Đổi 2 đoạn" changes every off-standard wall at once (one PUT + toast)', async () => {
        await openThickness(page, built, 1);
        await expect.soft(selectAllBtn(page)).toHaveText('Chọn nhóm này (2 đoạn)');
        await selectAllBtn(page).click();
        const put = waitForPut(page, project, plainFloor);
        await changeBtn(page, 2).click();
        expect((await put).response.status()).toBe(200);
        await expect.soft(toastText(page, 'Chuẩn hoá độ dày 2 tường.')).toBeVisible();
        expect.soft(putsTo(flow, plainFloor)).toBe(1);
        await ev(page, '21-A-023', 'batch-plain');
      });

      await test.step('[21-A-024] a reviewed wall in the group: the batch counts 1, the sentence says the reviewed wall stays out, no write', async () => {
        await openThickness(page, built, 0);
        const from = flow.sent.length;
        await expect.soft(groupRow(page, 220)).toContainText('1'); // TB:isBatchCandidate excludes reviewed walls
        await tick(acceptBox(page, 220));
        await expect.soft(batchLine(page)).toHaveText('1 đoạn về 1 nhóm chuẩn. 1 tường đã duyệt không nằm trong lô.');
        expect.soft(putsTo(flow, reviewedFloor, from)).toBe(0);
        await ev(page, '21-A-024', 'reviewed-out');
      });

      await test.step('[21-E-007] Esc closes the top layer (the drawer) first, then does nothing harmful', async () => {
        await openDetail(page);
        await page.keyboard.press('Escape');
        await expect.soft(drawer(page)).toHaveCount(0);
        await page.keyboard.press('Escape'); // nothing open: the global handler, nothing breaks
        await expect.soft(region(page)).toBeVisible();
        await expect.soft(acceptBox(page, 220)).toBeChecked();
      });

      await test.step('[21-A-027] unticking the group drops the batch without a write', async () => {
        const from = flow.sent.length;
        await tick(acceptBox(page, 220));
        await expect.soft(changeBtn(page)).toHaveCount(0);
        expect.soft(putsTo(flow, reviewedFloor, from)).toBe(0);
      });

      await test.step('[21-A-025] "Đổi 1 đoạn" changes only the unreviewed wall', async () => {
        await tick(acceptBox(page, 220));
        const put = waitForPut(page, project, reviewedFloor);
        await changeBtn(page, 1).click();
        excluded = await put;
        const walls = wallsOfPut(excluded);
        expect.soft(thicknessOf(walls, reviewedWalls[0] as string), 'the reviewed wall keeps 180 mm').toBe(180);
        expect.soft(thicknessOf(walls, reviewedWalls[1] as string), 'the unreviewed wall is 220 mm').toBe(220);
        await ev(page, '21-A-025', 'reviewed-kept');
      });

      await test.step('[21-C-006] a batch never changes a reviewed wall and needs no warning', async () => {
        await expect.soft(region(page).getByText(/sẽ đổi tường đã duyệt/u)).toHaveCount(0);
        expect.soft(excluded === undefined ? null : thicknessOf(wallsOfPut(excluded), reviewedWalls[0] as string)).toBe(180);
        await expect.soft(acceptBox(page)).toHaveCount(0); // nothing left in the batch: the reviewed wall is not offered
      });

      await test.step('[21-A-026] changing a reviewed wall on purpose goes through the per-wall table (one PUT)', async () => {
        const code = wallCode(reviewedWalls[0] as string, reviewedWalls);
        await openDetail(page);
        const put = waitForPut(page, project, reviewedFloor);
        await drawer(page).getByRole('combobox', { name: `Độ dày chuẩn hoá của đoạn ${code}`, exact: true }).click();
        await page.getByRole('option', { name: '220 mm', exact: true }).click();
        const walls = wallsOfPut(await put);
        expect.soft(thicknessOf(walls, reviewedWalls[0] as string), 'the reviewed wall is 220 mm now').toBe(220);
        await closeDetail(page);
      });

      await test.step('[21-A-028] nothing off-standard: no group, no main button, no toast', async () => {
        await openThickness(page, built, 2);
        const from = flow.sent.length;
        const toastsBefore = await toasts(page).getByRole('button', { name: UNDO, exact: true }).count();
        await expect.soft(acceptBox(page)).toHaveCount(0);
        await expect.soft(selectAllBtn(page)).toHaveCount(0);
        await expect.soft(changeBtn(page)).toHaveCount(0);
        await expect.soft(batchLine(page)).toHaveText(NOTHING_LEFT);
        await expect.soft(panel(page).getByText('Đã chuẩn hoá', { exact: true })).toBeVisible();
        expect.soft(await toasts(page).getByRole('button', { name: UNDO, exact: true }).count()).toBe(toastsBefore);
        expect.soft(putsTo(flow, standardFloor, from)).toBe(0);
      });

      await test.step('[21-C-010] BUG-579: the OLDER toast "Hoàn tác" after a later apply is REFUSED with the Ctrl+Z notice, no PUT', async () => {
        // Two applies through the per-wall picker past the 5 s notification group window, then the FIRST toast's "Hoàn tác".
        await page.clock.install();
        await openThickness(page, built, 0);
        await openDetail(page);
        await expect(segRows(page)).toHaveCount(2);
        const ids = reviewedWalls;
        const pick = async (wallId: string): Promise<void> => {
          await openDetail(page);
          await tick(drawer(page).getByRole('checkbox', { name: `Chọn dòng tường ${wallCode(wallId, ids)}`, exact: true }));
          await drawer(page).getByRole('button', { name: CHANGE_THICKNESS, exact: true }).click();
          const group = drawer(page).getByRole('group', { name: PICKER, exact: true });
          await group.getByRole('radio', { name: '110 mm', exact: true }).click();
          const put = waitForPut(page, project, reviewedFloor);
          await group.getByRole('button', { name: APPLY, exact: true }).click();
          await put;
          await expect(toastText(page, 'Chuẩn hoá độ dày 1 tường.').first()).toBeVisible();
        };
        await pick(ids[0] as string);
        await page.clock.fastForward(5_050);
        await pick(ids[1] as string);
        await closeDetail(page);
        const undoButtons = toasts(page).getByRole('button', { name: UNDO, exact: true });
        await expect(undoButtons, 'two applies past the group window = two toasts').toHaveCount(2);
        await attachJson('E04_21-C-010_toasts.json', { undoButtons: await undoButtons.count() });
        const from = flow.sent.length;
        await undoButtons.last().click(); // the older toast
        await expect.soft(toastText(page, /^Chưa hoàn tác: đã có \d+ thay đổi sau thay đổi này\. Dùng Ctrl\+Z để hoàn tác lần lượt\.$/u)).toBeVisible();
        expect.soft(putsTo(flow, reviewedFloor, from), 'the refused undo sends no PUT').toBe(0);
        await ev(page, '21-C-010', 'toast-undo-order');
      });
    });
  });

  test('SCR-21 · FL-21-05 · row overrides, row selection, "Đổi độ dày" picker (drawer "Bảng từng đoạn tường")', async ({ browser }) => {
    test.setTimeout(300_000);
    const built = await thkMix(adminApi, '21-05');
    const ids = built.walls[0] as string[]; // 5 x 180, 150, 220
    const floorId = built.floorIds[0] as string;
    await withFlow(browser, [built], async (flow) => {
      const { page } = flow;
      await openThickness(page, built);
      await openDetail(page);
      const code = (index: number): string => wallCode(ids[index] as string, ids);
      const groupSelect = (index: number): Locator => drawer(page).getByRole('combobox', { name: `Độ dày chuẩn hoá của đoạn ${code(index)}`, exact: true });
      const pick = async (index: number, label: string): Promise<void> => {
        await openDetail(page);
        await groupSelect(index).click();
        await page.getByRole('option', { name: label, exact: true }).click();
      };
      const rowBox = (index: number): Locator => drawer(page).getByRole('checkbox', { name: `Chọn dòng tường ${code(index)}`, exact: true });
      const toolbar = (count: number): Locator => drawer(page).getByRole('toolbar', { name: `Thanh hành động: đã chọn ${String(count)} tường`, exact: true });
      const picker = (): Locator => drawer(page).getByRole('group', { name: PICKER, exact: true });

      await test.step('[21-A-029] a row set to another group is a real write (BUG-585): measured becomes the group value, deviation 0, status neutral', async () => {
        const from = flow.sent.length;
        const put = waitForPut(page, built.project.projectId, floorId);
        await pick(0, '330 mm');
        await put;
        await expect.soft(groupSelect(0)).toHaveText('330 mm');
        const row = rowOfCode(page, code(0));
        await expect.soft(row).toContainText('330,0 mm');
        await expect.soft(row).toContainText('0,0 mm');
        await expect.soft(row).toContainText('Trung tính');
        expect.soft(putsTo(flow, floorId, from), 'one group change = one write').toBe(1);
        await ev(page, '21-A-029', 'row-override');
      });

      await test.step('[21-E-005] row group combobox "Độ dày chuẩn hoá của đoạn #…" opens a listbox with 110 / 220 / 330 only', async () => {
        await groupSelect(1).click();
        // BUG-593: the manual-review group ("Xem tay") has no apply command, so the row picker does not offer it.
        await expect.soft(page.getByRole('listbox').getByRole('option')).toHaveText(['110 mm', '220 mm', '330 mm']);
        await page.keyboard.press('Escape');
        await expect.soft(page.getByRole('listbox')).toHaveCount(0);
      });

      await test.step('[21-C-012] row overrides survive a batch (never reset)', async () => {
        const result = await applyGroup(page, built, 0, 220); // closes the drawer first: the remaining 4 x 180 mm
        expect(result.response.status()).toBe(200);
        await openDetail(page);
        await expect.soft(groupSelect(0)).toHaveText('330 mm');
        await ev(page, '21-C-012', 'override-survives');
      });

      await test.step('[21-A-030] a row checkbox selects: "Đã chọn N tường" and the action toolbar', async () => {
        await tick(rowBox(1));
        await expect.soft(toolbar(1)).toBeVisible();
        await expect.soft(toolbar(1)).toContainText('Đã chọn 1 tường');
        await ev(page, '21-A-030', 'row-selected');
      });

      await test.step('[21-E-006] the row checkbox reads the short wall code ("Chọn dòng tường #W-…"), not the machine id', async () => {
        const name = await rowBox(1).getAttribute('aria-label');
        expect.soft(name).toBe(`Chọn dòng tường ${code(1)}`); // TST: rowId = `tường ${row.code}` (Impeccable A3)
        expect.soft(name).not.toContain(ids[1] as string);
      });

      await test.step('[21-A-031] "Chọn tất cả" selects all; a partial selection shows indeterminate', async () => {
        await tick(drawer(page).getByRole('checkbox', { name: 'Chọn tất cả', exact: true }));
        await expect.soft(toolbar(7)).toBeVisible();
        await tick(rowBox(1));
        await expect.soft(toolbar(6)).toBeVisible();
        const mixed = await drawer(page).getByRole('checkbox', { name: 'Chọn tất cả', exact: true }).evaluate((node) => (node as HTMLInputElement).indeterminate || node.getAttribute('aria-checked') === 'mixed');
        expect.soft(mixed, 'header checkbox is indeterminate').toBe(true);
        await ev(page, '21-A-031', 'select-all-partial');
        await tick(drawer(page).getByRole('checkbox', { name: 'Chọn tất cả', exact: true }));
        await tick(drawer(page).getByRole('checkbox', { name: 'Chọn tất cả', exact: true }));
        await expect.soft(drawer(page).getByRole('toolbar')).toHaveCount(0);
      });

      await test.step('[21-A-032] "Đổi độ dày" -> picker -> "Áp dụng": one PUT and the toast', async () => {
        await tick(rowBox(1));
        await tick(rowBox(2));
        await drawer(page).getByRole('button', { name: CHANGE_THICKNESS, exact: true }).click();
        await expect.soft(drawer(page).getByText('Chọn nhóm áp cho 2 tường đã chọn:', { exact: true })).toBeVisible();
        await expect.soft(picker().getByRole('radio', { name: '110 mm', exact: true })).toHaveAttribute('aria-checked', 'true');
        const put = waitForPut(page, built.project.projectId, floorId);
        await picker().getByRole('button', { name: APPLY, exact: true }).click();
        await put;
        await expect.soft(toastText(page, 'Chuẩn hoá độ dày 2 tường.')).toBeVisible();
        await ev(page, '21-A-032', 'picker-applied');
      });

      await test.step('[21-A-033] picker "Huỷ": closed, no write', async () => {
        await tick(rowBox(3));
        await drawer(page).getByRole('button', { name: CHANGE_THICKNESS, exact: true }).click();
        await expect(picker()).toBeVisible();
        const from = flow.sent.length;
        await picker().getByRole('button', { name: CANCEL, exact: true }).click();
        await expect.soft(picker()).toHaveCount(0);
        expect.soft(putsTo(flow, floorId, from)).toBe(0);
      });

      await test.step('[21-A-034] ⚑ picker "Xem tay" -> "Áp dụng": expected a change or a refusal, not a silent no-op', async () => {
        await drawer(page).getByRole('button', { name: CHANGE_THICKNESS, exact: true }).click();
        const manual = picker().getByRole('radio', { name: MANUAL_LABEL, exact: true });
        if ((await manual.count()) === 0) {
          note('[21-A-034] the picker offers no "Xem tay" option: nothing to apply');
          await picker().getByRole('button', { name: CANCEL, exact: true }).click();
          return;
        }
        await manual.click();
        const from = flow.sent.length;
        const toastsBefore = await toasts(page).getByRole('button', { name: UNDO, exact: true }).count();
        await picker().getByRole('button', { name: APPLY, exact: true }).click();
        await softly
          .poll(
            async () => putsTo(flow, floorId, from) > 0 || (await toasts(page).getByRole('button', { name: UNDO, exact: true }).count()) > toastsBefore || (await page.getByRole('alert').count()) > 0,
            { timeout: 4_000, message: 'a PUT, a toast or an alert follows "Áp dụng" on "Xem tay"' },
          )
          .toBe(true);
        await ev(page, '21-A-034', 'picker-manual');
      });

      await test.step('[21-A-035] "Bỏ chọn" clears the selection; Esc leaves no toolbar', async () => {
        await page.reload();
        await openDetail(page);
        await expect(segRows(page)).toHaveCount(7);
        await tick(rowBox(1));
        await expect(toolbar(1)).toBeVisible();
        await drawer(page).getByRole('button', { name: 'Bỏ chọn tất cả', exact: true }).click();
        await expect.soft(drawer(page).getByRole('toolbar')).toHaveCount(0);
        await tick(rowBox(1));
        await expect(toolbar(1)).toBeVisible();
        await page.keyboard.press('Escape');
        await expect.soft(page.getByRole('toolbar', { name: /^Thanh hành động: đã chọn/u })).toHaveCount(0);
      });
    });
  });

  test('SCR-21 · FL-21-06 · sorting, hover, the drawing, a11y, Ctrl+Z', async ({ browser }) => {
    test.setTimeout(300_000);
    const built = await thkMix(adminApi, '21-06');
    const ids = built.walls[0] as string[];
    const floorId = built.floorIds[0] as string;
    await withFlow(browser, [built], async (flow) => {
      const { page } = flow;
      await openThickness(page, built);
      const head = (name: string): Locator => segTable(page).getByRole('columnheader', { name, exact: true });
      const numbers = async (index: number): Promise<number[]> => (await column(page, index)).map(viNumber);

      await test.step('[21-A-036] sort by "Độ dày đo được" / "Sai lệch" / "Độ tin cậy" / "Tầng": default deviation desc, direction fixed per column', async () => {
        expect.soft(await numbers(4), 'default: deviation descending').toEqual([40, 40, 40, 40, 40, 40, 0]);
        await head('Độ dày đo được').click();
        expect.soft(await numbers(2), 'measured ascending').toEqual([150, 180, 180, 180, 180, 180, 220]);
        await head('Sai lệch').click();
        expect.soft(await numbers(4), 'deviation descending again').toEqual([40, 40, 40, 40, 40, 40, 0]);
        await head('Độ tin cậy').click();
        await head('Tầng').click();
        await expect.soft(segRows(page)).toHaveCount(7);
        await ev(page, '21-A-036', 'sorted');
      });

      await test.step('[21-C-009] sort orders: deviation desc; measured / confidence asc; floor by localeCompare', async () => {
        await head('Sai lệch').click();
        const dev = await numbers(4);
        expect.soft(dev).toEqual([...dev].sort((a, b) => b - a));
        await head('Độ dày đo được').click();
        const measured = await numbers(2);
        expect.soft(measured).toEqual([...measured].sort((a, b) => a - b));
        await head('Tầng').click();
        const floors = await column(page, 6);
        expect.soft(floors).toEqual([...floors].sort((a, b) => a.localeCompare(b)));
      });

      await test.step('[21-E-010] sortable headers expose aria-sort', async () => {
        await head('Độ dày đo được').click();
        await expect.soft(head('Độ dày đo được')).toHaveAttribute('aria-sort', 'ascending');
        await expect.soft(head('Sai lệch')).toHaveAttribute('aria-sort', 'none');
        await head('Sai lệch').click();
        await expect.soft(head('Sai lệch')).toHaveAttribute('aria-sort', 'descending');
        await expect.soft(head('Mã')).not.toHaveAttribute('aria-sort', /./u);
      });

      await test.step('[21-A-038] hover a table row -> the wall lights on the drawing; hover a polygon -> it lights too', async () => {
        const row = rowOfCode(page, wallCode(ids[0] as string, ids));
        await row.hover();
        await expect.soft(row).toHaveClass(/bg-bg-hover/u);
        const matched = await polygons(page).evaluateAll((nodes) => nodes.filter((node) => Math.abs(Number(node.getAttribute('fill-opacity')) - 0.9) < 0.01).length);
        expect.soft(matched, 'the hovered wall is highlighted').toBeGreaterThan(0);
        await closeDetail(page); // the drawer is modal: the drawing is behind it
        await polygons(page).nth(5).hover({ force: true });
        await expect.poll(async () => polygons(page).evaluateAll((nodes) => nodes.filter((node) => Math.abs(Number(node.getAttribute('fill-opacity')) - 0.9) < 0.01).length)).toBeGreaterThan(0);
        await ev(page, '21-A-038', 'row-polygon-hover');
      });

      await test.step('[21-A-040] the drawing is the main view (bản Z): no collapse toggle, it is always shown', async () => {
        await expect.soft(page.getByRole('button', { name: COLLAPSE, exact: true })).toHaveCount(0);
        await expect.soft(page.locator('aside[aria-label="Mặt bằng xem trước theo nhóm độ dày"]')).toBeVisible();
      });

      await test.step('[21-E-009] no collapse toggle to name; the drawing region has its own name', async () => {
        await expect.soft(region(page).getByRole('region', { name: 'Bản vẽ theo nhóm độ dày', exact: true })).toBeVisible(); // TV:CANVAS_REGION_LABEL
      });

      await test.step('[21-E-008] the drawing aside "Mặt bằng xem trước theo nhóm độ dày" (svg aria-hidden) and the legend list', async () => {
        const aside = page.locator('aside[aria-label="Mặt bằng xem trước theo nhóm độ dày"]');
        await expect.soft(aside).toBeVisible();
        await expect.soft(aside.locator('svg')).toHaveAttribute('aria-hidden', 'true');
        await expect.soft(page.getByRole('list', { name: 'Chú giải độ dày tường', exact: true })).toBeVisible();
      });

      await test.step('[21-E-011] no "Dung sai" field (fixed 30 mm); the units on the panel are mm', async () => {
        await expect.soft(page.getByLabel(TOLERANCE, { exact: true })).toHaveCount(0);
        await expect.soft(groupRow(page, 220)).toContainText('180 mm');
      });

      await test.step('[21-E-012] with reduced motion a click on a group checkbox lands at once', async () => {
        expect.soft(await page.evaluate(() => matchMedia('(prefers-reduced-motion: reduce)').matches), 'context emulates reduced motion').toBe(true);
        await tick(acceptBox(page, 220));
        await expect.soft(acceptBox(page, 220)).toBeChecked();
        await tick(acceptBox(page, 220));
      });

      await test.step('[21-A-015] ⚑ Ctrl+Z on this screen: the screen\'s own undo, and "Hoàn tác" afterwards must not re-apply', async () => {
        const applied = await applyGroup(page, built, 0, 220);
        expect(applied.response.status()).toBe(200);
        await expect.soft(statusLine(page)).toHaveText('1/7 đoạn không chuẩn, 6 đúng chuẩn');
        await page.locator('body').click({ position: { x: 2, y: 2 } });
        const put = waitForPut(page, built.project.projectId, floorId, (walls) => ids.slice(0, 5).every((id) => thicknessOf(walls, id) === 180)).catch(() => null);
        await page.keyboard.press('Control+Z');
        await put;
        await expect.poll(async () => statusLine(page).innerText(), { message: 'Ctrl+Z reverts the batch' }).toBe('6/7 đoạn không chuẩn, 1 đúng chuẩn');
        await button(page, UNDO).click();
        const after = await numbers(2);
        await attachJson('E04_21-A-015_after.json', { after });
        expect.soft(after.filter((value) => value === 180), '"Hoàn tác" after Ctrl+Z does not re-apply the inverse').toHaveLength(5);
        await closeDetail(page);
        await ev(page, '21-A-015', 'ctrl-z');
      });

      await test.step('[21-B-014] the drawing legend lists only the present groups, plus "Không chuẩn"', async () => {
        await page.reload();
        await expect(region(page)).toBeVisible();
        const legend = page.getByRole('list', { name: 'Chú giải độ dày tường', exact: true });
        await expect.soft(legend.getByRole('listitem')).toHaveText(['110 mm', '220 mm', 'Không chuẩn']); // TG:thicknessLegend, TPC
        await expect.soft(legend).not.toContainText('330 mm');
        await expect.soft(legend).not.toContainText('Xem tay');
      });
    });
  });

  test('SCR-21 · FL-21-07 · entries and dead ends, empty / all-standard, read failure, anonymous', async ({ browser }) => {
    test.setTimeout(240_000);
    const built = await thkEntries(adminApi, '21-07');
    await withFlow(browser, [built], async (flow) => {
      const { page } = flow;
      const project = built.project.projectId;

      await test.step('[21-A-002] entry from a notification link opens the floor\'s thickness route', async () => {
        const link = ROUTES.project.thickness(project, built.floorIds[0] as string);
        await page.goto(link);
        await expect(region(page)).toBeVisible();
        expect.soft(new URL(page.url()).pathname).toBe(link);
        note('[21-A-002] no API creates a notification with place "thickness" on the real stack; the link target the notification gateway builds is what is entered');
      });

      await test.step('[21-A-003] ⚑ a way back to the walls layer from here: a link or a button', async () => {
        await expect(page.getByText(EMPTY_TITLE, { exact: true })).toBeVisible();
        const exits = await region(page).locator('a[href], button').filter({ hasText: /lớp tường|duyệt tường/iu }).count();
        expect.soft(exits, '"Về duyệt tường" in the empty state').toBeGreaterThan(0);
        await ev(page, '21-A-003', 'exit');
      });

      await test.step('[21-B-002] no wall: the empty state, the notice, the drawing placeholder, no main button', async () => {
        await expect.soft(page.getByText(EMPTY_TITLE, { exact: true })).toBeVisible();
        await expect.soft(region(page).getByText(NO_MEASUREMENT, { exact: true })).toBeVisible();
        await expect.soft(region(page).getByText('Chưa có hình tường để xem trước', { exact: true })).toBeVisible();
        await expect.soft(panel(page).getByText('Chưa có số đo', { exact: true })).toBeVisible();
        await expect.soft(selectAllBtn(page)).toHaveCount(0);
        await expect.soft(changeBtn(page)).toHaveCount(0);
        await ev(page, '21-B-002', 'no-wall');
      });

      await test.step('[21-B-003] every wall already standard: "Đã chuẩn hoá", "Không còn đoạn nào cần đổi.", no group', async () => {
        await openThickness(page, built, 1);
        await expect.soft(panel(page).getByText('Đã chuẩn hoá', { exact: true })).toBeVisible();
        await expect.soft(batchLine(page)).toHaveText(NOTHING_LEFT);
        await expect.soft(region(page).getByRole('region', { name: GROUPS_SECTION, exact: true })).toHaveCount(0);
        await ev(page, '21-B-003', 'all-standard');
      });

      await test.step('[21-B-006] first read fails (404 floor, 404 project): the shared read-failure screen inside the region', async () => {
        const floorId = `L-QAE04MISSING${Date.now().toString(36).toUpperCase()}`;
        const gone = waitForApi(page, 'GET', new RegExp(`^/api/projects/${project}/floors/${floorId}/spatial/layer$`, 'u'), [404]);
        await page.goto(ROUTES.project.thickness(project, floorId));
        await gone;
        const alert = region(page).getByRole('alert').filter({ hasText: FLOOR_GONE });
        await expect(alert).toBeVisible();
        await expect.soft(alert.getByRole('heading', { name: FLOOR_MISSING, exact: true })).toBeVisible();
        await ev(page, '21-B-006', 'floor-404');
        const missingProject = `prj_qa-e04-${Date.now().toString(36)}`;
        const notFound = waitForApi(page, 'GET', new RegExp(`^/api/projects/${missingProject}/floors/${floorId}/spatial/layer$`, 'u'), [404]);
        await page.goto(ROUTES.project.thickness(missingProject, floorId));
        await notFound;
        await expect.soft(region(page).getByRole('alert').getByRole('heading', { name: PROJECT_NOT_FOUND, exact: true })).toBeVisible();
        note('[21-B-006] the 500 variant needs a mocked response: FL-21-M1 (mocked file) / pytest BE4-G-218');
      });

      await test.step('[21-A-044] anonymous deep link -> login with next', async () => {
        const anon = await browser.newContext({ baseURL: page.url().split('/').slice(0, 3).join('/') });
        try {
          const guest = await anon.newPage();
          await guest.goto(ROUTES.project.thickness(project, built.floorIds[1] as string));
          await expect(guest).toHaveURL(/\/login\?next=/u);
          await ev(guest, '21-A-044', 'anonymous-login');
        } finally {
          await anon.close();
        }
        expect.soft(writesSince(flow, 0), 'no write in this flow').toEqual([]);
      });
    });
  });

  test('SCR-21 · FL-21-08 · multi-floor store, save status, 409 on apply', async ({ browser }) => {
    test.setTimeout(300_000);
    const built = await thkTol(adminApi, '21-08');
    const [floorA, floorB] = built.floorIds as [string, string];
    await withFlow(browser, [built], async (flow) => {
      const { page } = flow;
      const project = built.project.projectId;

      await test.step('[21-B-016] ⚑ a store that holds a second floor: only this floor\'s walls in the table, histogram and drawing', async () => {
        await page.goto(ROUTES.project.floors(project));
        await expect(page.getByRole('row', { name: /, cao độ /u })).toHaveCount(2);
        await spaGo(page, ROUTES.project.thickness(project, floorA)); // client-side hop: the store keeps both floors
        await expect(region(page)).toBeVisible();
        const floors = await column(page, 6);
        await attachJson('E04_21-B-016_floors.json', { floors });
        expect.soft(new Set(floors), 'every row is of this floor').toEqual(new Set(['Tầng A']));
        expect.soft(floors.length, 'seven walls on floor A').toBe(7);
        await closeDetail(page);
        await ev(page, '21-B-016', 'two-floor-store');
      });

      await test.step('[21-G-005] ⚑ "Đổi" with two floors in the store writes only this floor', async () => {
        const from = flow.sent.length;
        const put = waitForPut(page, project, floorA);
        await tick(acceptBox(page, 220));
        await changeBtn(page).click();
        await put;
        await page.waitForTimeout(1_500); // fixed-wait-ok: absence of a write, no signal exists for "nothing sent"
        expect.soft(putsTo(flow, floorB, from), 'no PUT to the other floor').toBe(0);
        await ev(page, '21-G-005', 'apply-two-floors');
      });

      await test.step('[21-B-012] ⚑ save status: a visible "Đã lưu lúc…" after the save (A7)', async () => {
        const shown = await panel(page).getByText(/Đã lưu lúc/u).count();
        expect.soft(shown, 'the save indicator is shown in the panel head').toBeGreaterThan(0); // TV:QcPanelHead status
      });

      await test.step('[21-B-011] 409: a write elsewhere, then an undo here shows the reload banner (shared FSB copy)', async () => {
        await seedWalls(adminApi, project, floorA, [{ from: [0, 0], to: [4_000, 0], thicknessMm: 180 }, { from: [0, 1_500], to: [4_000, 1_500], thicknessMm: 180 }]);
        await toasts(page).getByRole('button', { name: UNDO, exact: true }).first().click();
        await expect(region(page).getByText(CONFLICT, { exact: true })).toBeVisible({ timeout: 15_000 });
        await expect.soft(region(page).getByRole('button', { name: RELOAD, exact: true })).toBeVisible();
        await ev(page, '21-B-011', 'conflict-banner');
      });

      await test.step('[21-G-004] the PUT answered 409 and "Tải lại" reloads the floor', async () => {
        const statuses = flow.log.filter((entry) => entry.method === 'PUT' && LAYER_PATH.exec(entry.path)?.[1] === floorA).map((entry) => entry.status);
        expect.soft(statuses, 'last PUT of floor A').toContain(409);
        await region(page).getByRole('button', { name: RELOAD, exact: true }).click();
        await page.getByRole('dialog').getByRole('button', { name: 'Tải lại và bỏ thay đổi', exact: true }).click();
        await expect.soft(region(page).getByText(CONFLICT, { exact: true })).toHaveCount(0);
        await ev(page, '21-G-004', 'after-reload');
      });
    });
  });
});
