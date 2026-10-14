/**
 * Phase 4 — SCR-21 wall-thickness standardization (ThicknessStandardization), EDGE layer, real stack: eight sequential
 * user flows (QA-04c P4, `flow-plan.md` "phase04_thickness_edge.spec.ts"). One `test()` per flow, one
 * `test.step('[<row id>] …')` per catalog row, in the planned order. `H` rows use a hard `expect`, `S` rows `expect.soft`;
 * a row marked ⚑ asserts the CORRECT behaviour and stays red when the app is wrong (never loosened to turn green).
 *
 * Source (FE, this branch): TV src/screens/qc/ThicknessStandardization/ThicknessStandardization.tsx · UT …/useThicknessStandardization.ts ·
 * TG …/thicknessStandardizationGateway.ts · TAB …/ThicknessApplyBar.tsx · TGT …/ThicknessGroupTable.tsx · TST …/ThicknessSegmentTable.tsx ·
 * TH …/ThicknessHistogram.tsx · TSUM …/ThicknessSummary.tsx · TPC …/ThicknessPreviewCanvas.tsx · TT …/thicknessTypes.ts ·
 * SLS src/lib/autosave/spatialLayerSave.ts · FSB …/FloorLayerSaveBanner.tsx · FLR src/screens/qc/shared/floorLayerReadFailure.ts ·
 * UFL src/hooks/useFloorLayer.ts · STD src/lib/geometry/standardize.ts (M-05).
 *
 * ## Users and data
 * The shared admin; every flow signs in once in its own context WITH reduced motion (the group rows are motion rows, clicks
 * during their slide miss — [21-E-012]) and owns its project(s): `POST /api/projects`, walls written through the real #35,
 * deleted in `finally`. Wall thickness values are the catalog's (150 / 189 / 190 / 200 / 220 … mm). No upload, no mock.
 * Deviation from the plan seed `QX:thk-tol`: floor A also holds a 220 mm wall and a reviewed 200 mm wall so the four row
 * badges ("Đã duyệt" / "Vi phạm" / "Cần chú ý" / "Trung tính") all exist ([21-B-015]).
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
import { typeHeight } from './support/numeric-field';
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

const SCREEN = 'Chuẩn hoá độ dày tường'; // TV:105
const HIST_SECTION = 'Phân bố độ dày đo được'; // TV:HISTOGRAM_SECTION_LABEL
const TABLES_SECTION = 'Bảng nhóm và bảng chi tiết từng đoạn'; // TV:TABLES_SECTION_LABEL
const PREVIEW_BTN = 'Xem trước'; // TAB:OPEN_PREVIEW_LABEL
const APPLY = 'Áp dụng';
const CANCEL = 'Huỷ';
const UNDO = 'Hoàn tác';
const REAPPLY = 'Áp dụng lại bộ lọc';
const TOLERANCE = 'Dung sai';
const EMPTY_TITLE = 'Chưa có đoạn tường nào để chuẩn hoá'; // TV:EMPTY_TITLE
const NO_MEASUREMENT =
  'Chưa có số đo độ dày nào cho công trình này. Sang lớp tường để dò lại các đoạn tường, rồi quay lại đây để chuẩn hoá độ dày.'; // UT:128-129
const ALL_STANDARD =
  'Mọi đoạn tường đã ở đúng nhóm chuẩn, không còn gì để áp. Kéo một ngưỡng trên biểu đồ hoặc nới ô dung sai nếu bạn muốn gom thêm đoạn vào một nhóm khác.'; // UT:126-127
const GROUP_EMPTY = 'Chưa có nhóm nào để chuẩn hoá.'; // TGT:EMPTY_MESSAGE
const WARNING_TITLE = 'Áp dụng lại bộ lọc sẽ đổi tường đã duyệt'; // TAB:REAPPLY_WARNING_TITLE
const EXCLUDE_AND_REAPPLY = 'Loại tường đã duyệt ra rồi áp lại'; // TAB:61
const APPLY_TO_ALL = 'Vẫn áp dụng cho tất cả'; // TAB:62
const COLLAPSE = 'Thu gọn khung xem trước'; // TV:COLLAPSE_PREVIEW_LABEL
const EXPANDED = 'Khung xem trước đang thu gọn'; // TV:EXPAND_PREVIEW_LABEL
const TOASTS = 'Thông báo';
const CHANGE_THICKNESS = 'Đổi độ dày'; // TableActionBar
const PICKER = 'Chọn nhóm áp cho các đoạn đã chọn'; // TST:CHOOSE_GROUP_LABEL
const CONFLICT = 'Tầng này vừa được sửa ở nơi khác. Tải lại để xem bản mới nhất.'; // SLS:83
const RELOAD = 'Tải lại'; // FSB:37
const TOLERANCE_WARNING_RE = /Áp dụng lại bộ lọc sẽ đổi tường đã duyệt/u;
const STAT_LABELS = {
  total: 'Tổng số đoạn tường',
  normalized: 'Đã ở đúng nhóm chuẩn',
  exceeding: 'Lệch quá dung sai',
  column: 'Cột bê tông cốt thép',
} as const; // TT:289-294
const SLIDERS = ['Ngưỡng giữa 110 mm và 220 mm', 'Ngưỡng giữa 220 mm và 330 mm', 'Ngưỡng giữa 330 mm và cột bê tông cốt thép'] as const; // TH:88-92
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
const segTable = (page: Page): Locator => region(page).getByRole('table').filter({ has: page.getByRole('columnheader', { name: 'Mã', exact: true }) });
const groupTable = (page: Page): Locator => region(page).getByRole('table').filter({ has: page.getByRole('columnheader', { name: 'Nhóm chuẩn đề xuất' }) });
const segRows = (page: Page): Locator => segTable(page).locator('tbody tr');
const groupRows = (page: Page): Locator => groupTable(page).locator('tbody tr');
const button = (page: Page, name: string): Locator => region(page).getByRole('button', { name, exact: true });
const acceptBox = (page: Page, measured?: number): Locator =>
  region(page).getByRole('checkbox', { name: measured === undefined ? /^Đồng ý chuẩn hoá \d+ tường / : new RegExp(`^Đồng ý chuẩn hoá \\d+ tường ${measured} mm `, 'u') });
const toasts = (page: Page): Locator => page.getByRole('region', { name: TOASTS, exact: true });
const toastText = (page: Page, text: string | RegExp): Locator => toasts(page).getByText(text);
const stat = (page: Page, label: string): Locator => region(page).getByRole('group', { name: 'Tóm tắt chuẩn hoá độ dày tường' }).getByRole('status').filter({ hasText: label });
const slider = (page: Page, index: number): Locator => page.getByRole('slider', { name: SLIDERS[index] as string, exact: true });
const previewLine = (page: Page, text: string | RegExp): Locator => region(page).getByText(text);
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
  await expect(page.getByRole('region', { name: 'Biểu đồ phân bố độ dày tường theo mi-li-mét', exact: true })).toBeVisible();
}

/** Texts of one column of the segment table (0 = checkbox, 1 = code, 2 = measured, 4 = deviation, 6 = floor, 7 = status). */
async function column(page: Page, index: number): Promise<string[]> {
  return segRows(page).evaluateAll((rows, at) => rows.map((row) => (row.querySelectorAll('td')[at as number]?.textContent ?? '').replace(/\s+/gu, ' ').trim()), index);
}

/** Row of the segment table showing `code`. */
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

/** Closes an open apply preview ("Xem trước" is not offered while one is open). */
async function closePreview(page: Page): Promise<void> {
  const cancel = button(page, CANCEL);
  if (await cancel.isVisible().catch(() => false)) await cancel.click();
}

/** Ticks the group of `measured`, opens the preview, applies and waits for the PUT; returns it. */
async function applyGroup(page: Page, built: Built, floorIndex: number, measured: number): Promise<ApiResult> {
  const box = acceptBox(page, measured);
  if (!(await box.isChecked())) await tick(box);
  await button(page, PREVIEW_BTN).click();
  const put = waitForPut(page, built.project.projectId, built.floorIds[floorIndex] as string);
  await button(page, APPLY).click();
  return put;
}

/* ================================================================= flows */

test.describe('E04 SCR-21 thickness — real-stack flows (QA-04c P4)', () => {
  test('SCR-21 · FL-21-01 · accept, preview, apply in one PUT, bar / toast undo, Ctrl+S', async ({ browser }) => {
    test.setTimeout(300_000);
    const built = await thkMix(adminApi, '21-01');
    const ids = built.walls[0] as string[]; // 5 x 200, 150, 220
    const floorId = built.floorIds[0] as string;
    await withFlow(browser, [built], async (flow) => {
      const { page } = flow;
      await openThickness(page, built);
      const sent: number[] = [];
      let applied: ApiResult | undefined;

      await test.step('[21-E-001] region "Chuẩn hoá độ dày tường" and its two sections', async () => {
        await expect(region(page)).toBeVisible(); // TV:316-362
        await expect.soft(region(page).getByRole('region', { name: HIST_SECTION, exact: true })).toBeVisible();
        await expect.soft(region(page).getByRole('region', { name: TABLES_SECTION, exact: true })).toBeVisible();
        await ev(page, '21-E-001', 'screen');
      });

      await test.step('[21-B-004] ⚑ partial state: the four summary stats, each number shown once (BUG-340)', async () => {
        await expect.soft(stat(page, STAT_LABELS.total)).toHaveText(`7 ${STAT_LABELS.total}`); // TSUM:40-72
        await expect.soft(stat(page, STAT_LABELS.normalized)).toHaveText(`1 ${STAT_LABELS.normalized}`);
        await expect.soft(stat(page, STAT_LABELS.exceeding)).toHaveText(`1 ${STAT_LABELS.exceeding}`);
        await expect.soft(stat(page, STAT_LABELS.column)).toHaveText(`0 ${STAT_LABELS.column}`);
        const text = await region(page).getByRole('group', { name: 'Tóm tắt chuẩn hoá độ dày tường' }).evaluate((node) => (node as HTMLElement).innerText);
        const sevens = text.split(/\s+/u).filter((token) => token === '7').length;
        await attachJson('E04_21-B-004_summary.json', { text, sevens });
        expect.soft(sevens, 'the total "7" is shown once, not as a big number plus the sentence').toBe(1);
        expect.soft(await groupRows(page).count(), 'group rows: 150 and 200; no 220 row (BUG-421)').toBe(2); // C-004 hidden-row case
        await ev(page, '21-B-004', 'summary-stats');
      });

      await test.step('[21-A-010] "Áp dụng" with no group accepted: "0 tường → 0 nhóm chuẩn.", no PUT', async () => {
        await button(page, PREVIEW_BTN).click(); // TAB:130-134,165-207
        await expect(previewLine(page, '0 tường → 0 nhóm chuẩn.')).toBeVisible();
        const from = flow.sent.length;
        await button(page, APPLY).click(); // UT:615 empty batch -> return
        await expect.soft(previewLine(page, '0 tường → 0 nhóm chuẩn.')).toHaveCount(0);
        expect.soft(putsTo(flow, floorId, from)).toBe(0);
        await ev(page, '21-A-010', 'apply-nothing');
      });

      await test.step('[21-A-006] "Xem trước" opens the preview line with "Huỷ" / "Áp dụng"', async () => {
        await tick(acceptBox(page, 200));
        await expect(acceptBox(page, 200)).toBeChecked(); // TGT:42-44
        await button(page, PREVIEW_BTN).click();
        await expect.soft(previewLine(page, /^5 tường → 1 nhóm chuẩn\./u)).toBeVisible();
        await expect.soft(button(page, CANCEL)).toBeVisible();
        await expect.soft(button(page, APPLY)).toBeVisible();
        await ev(page, '21-A-006', 'preview-open');
      });

      await test.step('[21-C-011] labels have one decimal and a comma: "200,0 mm", "20,0 mm"', async () => {
        const measured = await column(page, 2);
        const deviation = await column(page, 4);
        expect.soft(measured.filter((text) => /^200,0\s*mm$/u.test(text))).toHaveLength(5); // TG:514-517
        expect.soft(deviation).toContain('20,0 mm');
        await attachJson('E04_21-C-011_labels.json', { measured, deviation });
      });

      await test.step('[21-A-011] "Huỷ" and Esc close the preview, nothing applied', async () => {
        await acceptBox(page, 200).focus();
        await page.keyboard.press('Escape'); // UT:831-848 scope canvas
        await expect.soft(previewLine(page, /tường → \d+ nhóm chuẩn/u)).toHaveCount(0);
        await button(page, PREVIEW_BTN).click();
        await button(page, CANCEL).click(); // TAB:88-91
        await expect.soft(previewLine(page, /tường → \d+ nhóm chuẩn/u)).toHaveCount(0);
        expect.soft(putsTo(flow, floorId)).toBe(0);
      });

      await test.step('[21-A-005] untick the group: unchecked, the preview counts drop', async () => {
        await tick(acceptBox(page, 200));
        await expect.soft(acceptBox(page, 200)).not.toBeChecked(); // UT:686
        await button(page, PREVIEW_BTN).click();
        await expect.soft(previewLine(page, '0 tường → 0 nhóm chuẩn.')).toBeVisible();
        await button(page, CANCEL).click();
        await tick(acceptBox(page, 200)); // accept again for the apply below
        await expect(acceptBox(page, 200)).toBeChecked();
      });

      await test.step('[21-A-009] "Áp dụng" applies in ONE PUT: toast with undo, no row left at 200,0 mm, the group row is gone', async () => {
        await button(page, PREVIEW_BTN).click();
        const put = waitForPut(page, built.project.projectId, floorId);
        await button(page, APPLY).click();
        const result = await put;
        sent.push(result.response.status());
        applied = result;
        await expect.soft(toastText(page, 'Chuẩn hoá độ dày 5 tường.')).toBeVisible(); // UT:613-646,714-734; TG:838-839
        await expect.soft(toasts(page).getByRole('button', { name: UNDO, exact: true })).toBeVisible();
        expect.soft((await column(page, 2)).filter((text) => /^200,0/u.test(text))).toEqual([]);
        await expect.soft(acceptBox(page, 200)).toHaveCount(0);
        expect.soft(putsTo(flow, floorId), 'exactly one PUT for the whole apply').toBe(1);
        await attachJson('E04_21-A-009_put.json', { status: result.response.status(), walls: wallsOfPut(result).map((wall) => [wall['id'], wall['thicknessMm']]) });
        await ev(page, '21-A-009', 'applied');
      });

      await test.step('[21-C-005] accepting a group changes every wall with that measurement (except those over tolerance)', async () => {
        const walls = applied === undefined ? [] : wallsOfPut(applied);
        expect(walls.length, 'the apply PUT of [21-A-009]').toBeGreaterThan(0);
        for (const id of ids.slice(0, 5)) expect.soft(thicknessOf(walls, id), `wall ${id}`).toBe(220); // TG:872-899
        expect.soft(thicknessOf(walls, ids[5] as string), 'the 150 mm wall is not in an accepted group').toBe(150);
        expect.soft(thicknessOf(walls, ids[6] as string)).toBe(220);
      });

      await test.step('[21-C-007] one apply = one history step and one toast, whatever N', async () => {
        await expect.soft(toastText(page, 'Chuẩn hoá độ dày 5 tường.')).toHaveCount(1);
        await expect.soft(toasts(page).getByRole('button', { name: UNDO, exact: true })).toHaveCount(1);
      });

      await test.step('[21-A-012] "Hoàn tác" reverts the whole apply in one PUT', async () => {
        const put = waitForPut(page, built.project.projectId, floorId, (walls) => ids.slice(0, 5).every((id) => thicknessOf(walls, id) === 200));
        // the toast (fixed bottom-right, 30 s window) covers the bar button at 1440x900, so the toast's own "Hoàn tác" is clicked
        await toasts(page).getByRole('button', { name: UNDO, exact: true }).click(); // UT:583-602
        sent.push((await put).response.status());
        await expect.poll(async () => (await column(page, 2)).filter((text) => /^200,0/u.test(text)).length).toBe(5);
        await ev(page, '21-A-012', 'bar-undo');
      });

      await test.step('[21-G-003] undo sends one PUT restoring the old thickness', async () => {
        expect.soft(putsTo(flow, floorId), 'apply PUT + undo PUT').toBe(2);
        expect.soft(sent).toEqual([200, 200]);
      });

      await test.step('[21-A-013] the toast "Hoàn tác" reverts the apply', async () => {
        const applied = await applyGroup(page, built, 0, 200);
        expect(applied.response.status()).toBe(200);
        const put = waitForPut(page, built.project.projectId, floorId, (walls) => ids.slice(0, 5).every((id) => thicknessOf(walls, id) === 200));
        // The newest toast of THIS apply (NotificationHost.tsx:96-98 renders newest first), not an older toast still in its window.
        const toast = toasts(page).getByRole('status').filter({ hasText: 'Chuẩn hoá độ dày 5 tường.' }).first();
        await toast.getByRole('button', { name: UNDO, exact: true }).click(); // UT:630-643
        expect.soft((await put).response.status()).toBe(200);
        await expect.poll(async () => (await column(page, 2)).filter((text) => /^200,0/u.test(text)).length).toBe(5);
        await ev(page, '21-A-013', 'toast-undo');
      });

      await test.step('[21-A-014] "Hoàn tác" with nothing to undo does nothing (the button stays enabled)', async () => {
        const from = flow.sent.length;
        await expect.soft(button(page, UNDO)).toBeEnabled(); // TAB:127
        await button(page, UNDO).click(); // UT:590-592
        await button(page, UNDO).click();
        expect.soft((await column(page, 2)).filter((text) => /^200,0/u.test(text))).toHaveLength(5);
        expect.soft(putsTo(flow, floorId, from)).toBe(0);
      });

      await test.step('[21-A-043] Ctrl+S right after "Áp dụng": the PUT is sent before the 800 ms debounce', async () => {
        if (!(await acceptBox(page, 200).isChecked())) await tick(acceptBox(page, 200));
        await button(page, PREVIEW_BTN).click();
        // Fake clock, paused: the 800 ms autosave debounce cannot fire on its own, so a PUT can only come from the Ctrl+S
        // flush (RT:233-235). A wall-clock threshold from "Áp dụng" passed on the debounce alone (review QA-04c).
        await page.clock.install();
        await page.clock.pauseAt(await page.evaluate(() => Date.now() + 100));
        const put = waitForPut(page, built.project.projectId, floorId);
        try {
          await button(page, APPLY).click(); // UT:613-620: the apply goes through the store, i.e. the debounced autosave
          await page.keyboard.press('Control+S'); // RT:233-235 flush
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

  test('SCR-21 · FL-21-02 · tolerance: unchanged walls, "Dung sai", success after the last group, reload', async ({ browser }) => {
    test.setTimeout(300_000);
    const built = await thkTol(adminApi, '21-02');
    const ids = built.walls[0] as string[]; // 150, 189, 190, 200, 220, 200 (reviewed)
    const floorId = built.floorIds[0] as string;
    await withFlow(browser, [built], async (flow) => {
      const { page } = flow;
      await openThickness(page, built);
      const field = (): Locator => page.getByLabel(TOLERANCE, { exact: true });
      const code = (index: number): string => wallCode(ids[index] as string, ids);

      await test.step('[21-A-007] preview with an accepted group whose wall exceeds the tolerance', async () => {
        await tick(acceptBox(page, 189));
        await tick(acceptBox(page, 190));
        await button(page, PREVIEW_BTN).click();
        await expect.soft(previewLine(page, /^2 tường → 1 nhóm chuẩn\. 1 tường lệch quá 30 mm sẽ không đổi\.$/u)).toBeVisible(); // TG:782-805
        await expect.soft(previewLine(page, '1 tường không đổi được:')).toBeVisible(); // TAB:68,169-197
        await expect.soft(region(page).getByText(code(1), { exact: true }).first()).toBeVisible();
        await ev(page, '21-A-007', 'preview-unchanged');
      });

      await test.step('[21-A-008] "Xem" / "Ẩn" on an unchanged wall: detail line, aria-expanded toggles', async () => {
        const view = button(page, 'Xem');
        await expect(view).toHaveAttribute('aria-expanded', 'false'); // TAB:70-71,183-192
        await view.click();
        await expect.soft(region(page).getByText(/^Lệch 31,0 mm · Độ tin cậy: .+ · Tầng A$/u)).toBeVisible();
        await expect.soft(button(page, 'Ẩn')).toHaveAttribute('aria-expanded', 'true');
        await button(page, 'Ẩn').click();
        await expect.soft(region(page).getByText(/^Lệch 31,0 mm/u)).toHaveCount(0);
      });

      await test.step('[21-C-002] tolerance is strict: 190 vs 220 at 30 is applicable, 189 is "Vi phạm" and is not applied', async () => {
        const statuses = await column(page, 7);
        const codes = await column(page, 1);
        const statusOf = (index: number): string | undefined => statuses[codes.indexOf(code(index))];
        expect.soft(statusOf(1)).toBe('Vi phạm'); // TG:520-545,561-565: 189 -> deviation 31 > 30
        expect.soft(statusOf(2)).toBe('Cần chú ý'); // 190 -> deviation 30, applicable
        await attachJson('E04_21-C-002_statuses.json', { codes, statuses });
      });

      await test.step('[21-A-021] "Dung sai" 50 (typed, committed): rows re-evaluated, the over-tolerance count changes', async () => {
        await expect.soft(stat(page, STAT_LABELS.exceeding)).toHaveText(`2 ${STAT_LABELS.exceeding}`);
        await typeHeight(field(), '50'); // useNumericField commits on blur (800 ms debounce otherwise)
        await expect.soft(stat(page, STAT_LABELS.exceeding)).toHaveText(`0 ${STAT_LABELS.exceeding}`); // TAB:53,103-120; UT:656-660
        await expect.soft(region(page).getByText(TOLERANCE_WARNING_RE)).toHaveCount(0);
        await ev(page, '21-A-021', 'tolerance-50');
      });

      await test.step('[21-A-022] ArrowUp / ArrowDown in "Dung sai" step ±1 (Shift ±10)', async () => {
        await field().focus();
        await page.keyboard.press('ArrowUp');
        await expect.soft(field()).toHaveValue(/^51/u); // useNumericField.ts:149-153
        await page.keyboard.press('ArrowDown');
        await expect.soft(field()).toHaveValue(/^50/u);
        await page.keyboard.press('Shift+ArrowUp');
        await expect.soft(field()).toHaveValue(/^60/u);
        await page.keyboard.press('Shift+ArrowDown');
        await expect.soft(field()).toHaveValue(/^50/u);
        await field().press('Tab');
      });

      await test.step('[21-A-042] ⚑ "Dung sai" typed "abc": expected an error (source ignores the value)', async () => {
        await typeHeight(field(), 'abc');
        await attachJson('E04_21-A-042_field.json', { value: await field().inputValue(), invalid: await field().getAttribute('aria-invalid') });
        await expect.soft(field(), 'a non-number is refused with a message').toHaveAttribute('aria-invalid', 'true'); // TAB:103-107
        await ev(page, '21-A-042', 'tolerance-abc');
        await typeHeight(field(), '50');
      });

      await test.step('[21-C-008] a negative tolerance is accepted (no min): every row "Vi phạm", nothing applicable', async () => {
        await closePreview(page); // left open by [21-A-007]
        await typeHeight(field(), '-5'); // TAB:114-120
        await expect.poll(async () => (await column(page, 7)).filter((text) => text === 'Vi phạm').length).toBe(5);
        await expect.soft(stat(page, STAT_LABELS.exceeding)).toHaveText(`6 ${STAT_LABELS.exceeding}`);
        await tick(acceptBox(page, 200));
        await button(page, PREVIEW_BTN).click();
        await expect.soft(previewLine(page, /^\d+ tường → \d+ nhóm chuẩn\./u)).toContainText('→ 0 nhóm chuẩn');
        await button(page, CANCEL).click();
        await tick(acceptBox(page, 200)); // untick again
        await typeHeight(field(), '30');
      });

      await test.step('[21-B-015] row status badges and the tolerance dot', async () => {
        const statuses = await column(page, 7);
        expect.soft(new Set(statuses)).toEqual(new Set(['Đã duyệt', 'Vi phạm', 'Cần chú ý', 'Trung tính'])); // TST:66-71,213-228
        const withDot = await segRows(page).evaluateAll((rows) => rows.filter((row) => row.querySelectorAll('td')[4]?.querySelector('span[aria-hidden="true"]') !== null).length);
        await attachJson('E04_21-B-015_badges.json', { statuses, rowsWithDot: withDot });
        expect.soft(withDot, 'attention dot only beside "Sai lệch" over the tolerance (150 and 189)').toBe(2); // TG:481-497
        await ev(page, '21-B-015', 'row-badges');
      });

      await test.step('[21-B-005] success after applying the last group (BUG-421): the notice is back, the over-tolerance count is verified-green', async () => {
        await typeHeight(field(), '50');
        for (const measured of [150, 189, 190, 200]) {
          if (!(await acceptBox(page, measured).isChecked())) await tick(acceptBox(page, measured));
        }
        await button(page, PREVIEW_BTN).click();
        const put = waitForPut(page, built.project.projectId, floorId);
        await button(page, APPLY).click();
        expect((await put).response.status()).toBe(200);
        await expect.soft(region(page).getByText(ALL_STANDARD, { exact: true })).toBeVisible(); // UT:252-253,869-877
        await expect.soft(stat(page, STAT_LABELS.exceeding)).toHaveText(`0 ${STAT_LABELS.exceeding}`);
        const classes = await region(page).getByRole('group', { name: 'Tóm tắt chuẩn hoá độ dày tường' }).locator('span[aria-hidden="true"]').evaluateAll((nodes) => nodes.map((node) => node.className));
        expect.soft(classes[2], '"Lệch quá dung sai" = 0 reads in the verified colour').toContain('text-state-verified-text'); // TSUM:62-69
        await ev(page, '21-B-005', 'all-standard');
      });

      await test.step('[21-A-041] reload after an apply: the server copy has the standard thicknesses and no group row left', async () => {
        await page.reload();
        await expect(region(page)).toBeVisible();
        await expect(segRows(page)).toHaveCount(6);
        expect.soft((await column(page, 2)).sort()).toEqual(['110,0 mm', '220,0 mm', '220,0 mm', '220,0 mm', '220,0 mm', '220,0 mm']); // UFL:120-135
        await expect.soft(acceptBox(page)).toHaveCount(0);
        await expect.soft(groupTable(page)).toContainText(GROUP_EMPTY);
        await ev(page, '21-A-041', 'after-reload');
      });
    });
  });

  test('SCR-21 · FL-21-03 · thresholds: grouping edges, drag, keys, Home/End, crossing, histogram, live summary', async ({ browser }) => {
    test.setTimeout(300_000);
    const built = await thkSpread(adminApi, '21-03');
    const ids = built.walls[0] as string[]; // 164 165 180 200 240 275 350 400
    const floorId = built.floorIds[0] as string;
    await withFlow(browser, [built], async (flow) => {
      const { page } = flow;
      const groupLabelOf = async (index: number): Promise<string> =>
        rowOfCode(page, wallCode(ids[index] as string, ids)).getByRole('radio', { checked: true }).innerText();
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

      await test.step('[21-C-001] default grouping at the thresholds 165 / 275 / 350 follows standardizeThickness', async () => {
        expect.soft(await groupLabelOf(0)).toBe('110 mm'); // 164 -> 110 (STD: < 165)
        expect.soft(await groupLabelOf(1)).toBe('220 mm'); // 165 -> 220
        expect.soft(await groupLabelOf(5)).toBe('330 mm'); // 275 -> 330
        expect.soft(await groupLabelOf(6)).toBe('330 mm'); // 350 -> 330 (<= 350)
        expect.soft(await groupLabelOf(7)).toBe('Cột BTCT'); // 400 -> column side
        await ev(page, '21-C-001', 'default-grouping');
      });

      await test.step('[21-A-016] drag a threshold line with the mouse: 5 mm steps, bands and rows regroup, no PUT', async () => {
        const from = flow.sent.length;
        await dragSlider(0, 185);
        const now = await value(0);
        expect.soft(now % 5, 'moves in 5 mm steps').toBe(0); // TH:205-255
        expect.soft(now).toBeGreaterThan(170);
        await expect.soft(slider(page, 0)).toHaveAttribute('aria-valuetext', `${now} mm`);
        expect.soft(await groupLabelOf(1), '165 mm is now below the threshold').toBe('110 mm');
        expect.soft(putsTo(flow, floorId, from)).toBe(0);
        await ev(page, '21-A-016', 'threshold-dragged');
      });

      await test.step('[21-A-018] Home / End jump to the axis ends', async () => {
        const min = await limit(0, 'min');
        await slider(page, 0).focus();
        await page.keyboard.press('Home'); // TH:268-271
        expect.soft(await value(0), 'Home on the first line = the axis minimum').toBe(min);
        const max = await limit(2, 'max');
        await slider(page, 2).focus();
        await page.keyboard.press('End');
        expect.soft(await value(2), 'End on the last line = the axis maximum').toBe(max);
      });

      await test.step('[21-A-019] ⚑ push a threshold past its neighbour: it crosses or stops, focus stays on the dragged one', async () => {
        await page.reload();
        await expect(slider(page, 0)).toBeVisible();
        await slider(page, 0).focus();
        await page.keyboard.press('End'); // first line to the axis end, beyond both neighbours
        const max = await limit(0, 'max');
        const focused = await page.evaluate(() => Number(document.activeElement?.getAttribute('aria-valuenow')));
        await attachJson('E04_21-A-019_focus.json', { focused, max, values: [await value(0), await value(1), await value(2)] });
        expect.soft(focused, 'focus stays on the line that was moved (it carries the dragged value)').toBe(max); // TG:382-410, TH:374-394
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
        expect.soft(new Set(seen).size, 'Home gives the same value every time').toBe(1); // TH:117-131,268-269
        expect.soft(Math.min(...seen), 'never below zero').toBeGreaterThanOrEqual(0);
      });

      await test.step('[21-C-013] dragging thresholds never writes and never adds undo steps', async () => {
        await page.reload();
        await expect(slider(page, 0)).toBeVisible();
        const from = flow.sent.length;
        for (const target of [180, 190, 175, 185, 170]) await dragSlider(0, target);
        const after = await value(0);
        await button(page, UNDO).click(); // UT:12-16,652-654
        expect.soft(await value(0), '"Hoàn tác" does not move a threshold').toBe(after);
        expect.soft(putsTo(flow, floorId, from)).toBe(0);
      });

      await test.step('[21-C-003] the concrete-column group: counted separately and never applicable', async () => {
        await page.reload();
        await expect(slider(page, 0)).toBeVisible();
        await expect.soft(stat(page, STAT_LABELS.column)).toHaveText(`1 ${STAT_LABELS.column}`); // TG:451-470,675-705
        const from = flow.sent.length;
        await tick(acceptBox(page, 400));
        await button(page, PREVIEW_BTN).click();
        await expect.soft(previewLine(page, '1 tường → 0 nhóm chuẩn.')).toBeVisible();
        await button(page, APPLY).click();
        expect.soft(putsTo(flow, floorId, from), 'a column wall has no value to apply').toBe(0);
      });

      await test.step('[21-C-004] group table: one row per distinct measurement, ascending (a measurement equal to its standard is hidden)', async () => {
        const measured = (await groupRows(page).evaluateAll((rows) => rows.map((row) => row.querySelector('td')?.textContent?.trim() ?? ''))).map(viNumber);
        expect.soft(measured).toEqual([164, 165, 180, 200, 240, 275, 350, 400]); // TG:581-617
        note('[21-C-004] the hidden-row case (a 220 mm wall has no row) is asserted in FL-21-01 [21-B-004]');
      });

      await test.step('[21-B-013] ⚑ histogram: 5 mm bins, labels "165 mm" / "275 mm" / "350 mm", x ticks at least 32 px apart (BUG-394 / 406)', async () => {
        await page.reload();
        await expect(slider(page, 0)).toBeVisible();
        const hist = page.getByRole('region', { name: 'Biểu đồ phân bố độ dày tường theo mi-li-mét', exact: true });
        for (const label of ['165 mm', '275 mm', '350 mm']) await expect.soft(hist.getByText(label, { exact: true }).first()).toBeVisible(); // TT:169,185
        expect.soft(await hist.locator('[aria-hidden="true"].bg-text-muted').count(), 'bins 160 … 400 in 5 mm steps').toBe(49);
        const ticks = hist.locator('div.relative.h-4.w-full').last().locator('span.absolute:not(.right-0)');
        const xs: number[] = [];
        for (const tick of await ticks.all()) {
          const box = await tick.boundingBox();
          if (box !== null) xs.push(box.x);
        }
        const gaps = xs.slice(1).map((x, index) => x - (xs[index] as number));
        await attachJson('E04_21-B-013_ticks.json', { xs, gaps });
        expect.soft(Math.min(...gaps), 'x tick gaps (px)').toBeGreaterThanOrEqual(32); // TH:185-202,307-319,402-414
        await ev(page, '21-B-013', 'histogram');
      });

      await test.step('[21-E-002] three sliders with their names and aria-valuetext', async () => {
        for (const [index, name] of SLIDERS.entries()) {
          await expect.soft(slider(page, index)).toHaveAccessibleName(name); // TH:88-92,374-394
        }
        await expect.soft(slider(page, 0)).toHaveAttribute('aria-valuetext', '165 mm');
        await expect.soft(slider(page, 1)).toHaveAttribute('aria-valuetext', '275 mm');
        await expect.soft(slider(page, 2)).toHaveAttribute('aria-valuetext', '350 mm');
      });

      await test.step('[21-E-003] histogram bars are aria-hidden: per-bin counts are not exposed', async () => {
        const bars = page.getByRole('region', { name: 'Biểu đồ phân bố độ dày tường theo mi-li-mét', exact: true }).locator('[aria-hidden="true"].bg-text-muted');
        const exposed = await bars.evaluateAll((nodes) => nodes.filter((node) => (node.textContent ?? '').trim() !== '' || node.getAttribute('aria-label') !== null).length);
        expect.soft(await bars.count()).toBeGreaterThan(0); // TH:361-368
        expect.soft(exposed, 'bars carry no text or label').toBe(0);
      });

      await test.step('[21-E-004] the four summary lines are role=status (live)', async () => {
        await expect.soft(region(page).getByRole('group', { name: 'Tóm tắt chuẩn hoá độ dày tường' }).getByRole('status')).toHaveCount(4); // TSUM:54
      });

      await test.step('[21-A-039] ⚑ hover a histogram bin: the other bars dim to 0,45 and the canvas highlights that bin\'s walls', async () => {
        const bars = page.getByRole('region', { name: 'Biểu đồ phân bố độ dày tường theo mi-li-mét', exact: true }).locator('[aria-hidden="true"].bg-text-muted');
        const before = await polygons(page).evaluateAll((nodes) => nodes.map((node) => node.getAttribute('fill-opacity')));
        const target = bars.nth(8); // the bin of 200 mm (index (200 - 160) / 5)
        const parent = target.locator('xpath=..');
        await parent.hover();
        // the bars animate (transition-opacity), so the dimmed count is polled
        await expect
          .poll(
            async () => (await bars.evaluateAll((nodes) => nodes.map((node) => Number(getComputedStyle(node).opacity)))).filter((o) => Math.abs(o - 0.45) < 0.01).length,
            { message: 'every other bar dims' },
          )
          .toBeGreaterThan(40); // TH:345-371
        const after = await polygons(page).evaluateAll((nodes) => nodes.map((node) => node.getAttribute('fill-opacity')));
        await attachJson('E04_21-A-039_canvas.json', { before, after });
        expect.soft(after, 'the canvas shows which walls are in the bin (bin.wallIds)').not.toEqual(before);
        await ev(page, '21-A-039', 'bin-hover');
      });

      await test.step('[21-A-037] hover a group row: its walls are highlighted on the preview, the others dimmed', async () => {
        await groupRows(page).filter({ hasText: '200 mm' }).first().hover();
        const matched = await polygons(page).evaluateAll((nodes) => nodes.filter((node) => Math.abs(Number(node.getAttribute('fill-opacity')) - 0.9) < 0.01).length);
        const dimmed = await polygons(page).evaluateAll((nodes) => nodes.filter((node) => Math.abs(Number(node.getAttribute('fill-opacity')) - 0.18) < 0.01).length);
        await attachJson('E04_21-A-037_hover.json', { matched, dimmed });
        expect.soft(matched, 'walls of the 220 mm group (165, 180, 200, 240)').toBe(4); // TGT:62-69, TPC:135-177
        expect.soft(dimmed).toBe(4);
      });
    });
  });

  test('SCR-21 · FL-21-04 · "Áp dụng lại bộ lọc" and its warning', async ({ browser }) => {
    test.setTimeout(300_000);
    const built = await thkReapply(adminApi, '21-04');
    await withFlow(browser, [built], async (flow) => {
      const { page } = flow;
      const project = built.project.projectId;
      const [reviewedFloor, plainFloor] = built.floorIds as [string, string, string];
      const [reviewedWalls] = built.walls as [string[], string[], string[]];
      const warning = (): Locator => region(page).getByText(WARNING_TITLE, { exact: true });

      await test.step('[21-A-023] "Áp dụng lại bộ lọc" with no reviewed target applies every applicable wall at once (one PUT + toast)', async () => {
        await openThickness(page, built, 1);
        const put = waitForPut(page, project, plainFloor);
        await button(page, REAPPLY).click(); // TAB:54,121-123; UT:767-806
        expect((await put).response.status()).toBe(200);
        await expect.soft(toastText(page, 'Chuẩn hoá độ dày 2 tường.')).toBeVisible();
        expect.soft(putsTo(flow, plainFloor)).toBe(1);
        await ev(page, '21-A-023', 'reapply-plain');
      });

      await test.step('[21-A-024] "Áp dụng lại bộ lọc" with reviewed targets: warning, no write', async () => {
        await openThickness(page, built, 0);
        const from = flow.sent.length;
        await button(page, REAPPLY).click();
        await expect(warning()).toBeVisible(); // TAB:63-66,138-145
        await expect.soft(region(page).getByText('1 tường đã duyệt sẽ bị đổi. Đề nghị loại các tường này khỏi lượt áp dụng lại.', { exact: true })).toBeVisible();
        expect.soft(putsTo(flow, reviewedFloor, from)).toBe(0);
        await ev(page, '21-A-024', 'reapply-warning');
      });

      await test.step('[21-E-007] Esc closes the preview first, then the reapply warning', async () => {
        await tick(acceptBox(page, 200));
        await button(page, PREVIEW_BTN).click();
        await expect(previewLine(page, /tường → \d+ nhóm chuẩn/u)).toBeVisible();
        await acceptBox(page, 200).focus();
        await page.keyboard.press('Escape'); // UT:817,831-848
        await expect.soft(previewLine(page, /tường → \d+ nhóm chuẩn/u)).toHaveCount(0);
        await expect.soft(warning()).toBeVisible();
        await page.keyboard.press('Escape');
        await expect.soft(warning()).toHaveCount(0);
        await page.keyboard.press('Escape'); // neither open: goes to the global handler, nothing breaks
        await expect.soft(region(page)).toBeVisible();
        await tick(acceptBox(page, 200)); // untick
      });

      await test.step('[21-A-027] the warning\'s "Huỷ" (and Esc) closes it without a write', async () => {
        const from = flow.sent.length;
        await button(page, REAPPLY).click();
        await expect(warning()).toBeVisible();
        await button(page, CANCEL).click(); // TAB:154-160
        await expect.soft(warning()).toHaveCount(0);
        await button(page, REAPPLY).click();
        await expect(warning()).toBeVisible();
        await page.locator('body').click({ position: { x: 2, y: 2 } });
        await page.keyboard.press('Escape');
        await expect.soft(warning()).toHaveCount(0);
        expect.soft(putsTo(flow, reviewedFloor, from)).toBe(0);
      });

      await test.step('[21-A-025] "Loại tường đã duyệt ra rồi áp lại" changes only the unreviewed walls', async () => {
        await button(page, REAPPLY).click();
        await expect(warning()).toBeVisible();
        const put = waitForPut(page, project, reviewedFloor);
        await region(page).getByRole('button', { name: EXCLUDE_AND_REAPPLY, exact: true }).click(); // TAB:61,141
        const walls = wallsOfPut(await put);
        expect.soft(thicknessOf(walls, reviewedWalls[0] as string), 'the reviewed wall keeps 200 mm').toBe(200);
        expect.soft(thicknessOf(walls, reviewedWalls[1] as string), 'the unreviewed wall is 220 mm').toBe(220);
        await ev(page, '21-A-025', 'excluded');
      });

      await test.step('[21-A-026] "Vẫn áp dụng cho tất cả" changes the reviewed wall too', async () => {
        await button(page, REAPPLY).click();
        await expect(warning()).toBeVisible();
        const put = waitForPut(page, project, reviewedFloor);
        await region(page).getByRole('button', { name: APPLY_TO_ALL, exact: true }).click(); // TAB:62,147-153
        const walls = wallsOfPut(await put);
        expect.soft(thicknessOf(walls, reviewedWalls[0] as string), 'the reviewed wall is 220 mm now').toBe(220);
      });

      await test.step('[21-C-006] a normal "Áp dụng" changes reviewed walls without any warning', async () => {
        const undo = waitForPut(page, project, reviewedFloor, (walls) => thicknessOf(walls, reviewedWalls[0] as string) === 200);
        await button(page, UNDO).click(); // back to the reviewed 200 mm wall
        await undo;
        await expect(acceptBox(page, 200)).toBeVisible();
        await tick(acceptBox(page, 200));
        await button(page, PREVIEW_BTN).click();
        const put = waitForPut(page, project, reviewedFloor);
        await button(page, APPLY).click(); // UT:714-734 vs 767-784
        const walls = wallsOfPut(await put);
        expect.soft(thicknessOf(walls, reviewedWalls[0] as string)).toBe(220);
        await expect.soft(warning()).toHaveCount(0);
        await ev(page, '21-C-006', 'normal-apply-reviewed');
      });

      await test.step('[21-A-028] "Áp dụng lại bộ lọc" with nothing applicable does nothing (no toast)', async () => {
        const from = flow.sent.length;
        const toastsBefore = await toasts(page).getByRole('button', { name: UNDO, exact: true }).count();
        await button(page, REAPPLY).click(); // UT:615
        await expect.soft(warning()).toHaveCount(0);
        expect.soft(await toasts(page).getByRole('button', { name: UNDO, exact: true }).count()).toBe(toastsBefore);
        expect.soft(putsTo(flow, reviewedFloor, from)).toBe(0);
      });

      await test.step('[21-C-010] ⚑ the toast "Hoàn tác" of an apply reverts ITS apply, even after a later apply', async () => {
        // two applies through the row picker: wall 1 -> 110, then wall 2 -> 110; then the FIRST toast's "Hoàn tác".
        await page.reload();
        await expect(segRows(page)).toHaveCount(2);
        const ids = reviewedWalls;
        const pick = async (wallId: string): Promise<void> => {
          await tick(region(page).getByRole('checkbox', { name: `Chọn dòng ${wallId}`, exact: true }));
          await button(page, CHANGE_THICKNESS).click();
          const group = region(page).getByRole('group', { name: PICKER, exact: true });
          const put = waitForPut(page, project, reviewedFloor);
          await group.getByRole('button', { name: APPLY, exact: true }).click();
          await put;
          await expect(toastText(page, 'Chuẩn hoá độ dày 1 tường.').first()).toBeVisible();
        };
        await pick(ids[0] as string);
        await pick(ids[1] as string);
        const undoButtons = toasts(page).getByRole('button', { name: UNDO, exact: true });
        const count = await undoButtons.count();
        await attachJson('E04_21-C-010_toasts.json', { undoButtons: count });
        const put = waitForPut(page, project, reviewedFloor);
        await undoButtons.last().click(); // the older toast
        const walls = wallsOfPut(await put);
        expect.soft(thicknessOf(walls, ids[0] as string), 'its own apply (wall 1) is reverted to 220').toBe(220); // UT:630-636
        expect.soft(thicknessOf(walls, ids[1] as string), 'the later apply (wall 2) stays at 110').toBe(110);
        await ev(page, '21-C-010', 'toast-undo-order');
      });
    });
  });

  test('SCR-21 · FL-21-05 · row overrides, row selection, "Đổi độ dày" picker', async ({ browser }) => {
    test.setTimeout(300_000);
    const built = await thkMix(adminApi, '21-05');
    const ids = built.walls[0] as string[]; // 5 x 200, 150, 220
    const floorId = built.floorIds[0] as string;
    await withFlow(browser, [built], async (flow) => {
      const { page } = flow;
      await openThickness(page, built);
      const radios = (index: number): Locator => region(page).getByRole('radiogroup', { name: `Độ dày chuẩn hoá của đoạn ${wallCode(ids[index] as string, ids)}`, exact: true });
      const rowBox = (index: number): Locator => region(page).getByRole('checkbox', { name: `Chọn dòng ${ids[index] as string}`, exact: true });
      const toolbar = (count: number): Locator => region(page).getByRole('toolbar', { name: `Thanh hành động: đã chọn ${String(count)} tường`, exact: true });
      const picker = (): Locator => region(page).getByRole('group', { name: PICKER, exact: true });

      await test.step('[21-A-029] a row set to another group is a local override only: deviation, status and group table recompute', async () => {
        const from = flow.sent.length;
        await radios(0).getByRole('radio', { name: '330 mm', exact: true }).click(); // TST:122,205-210; UT:692-694
        await expect.soft(radios(0).getByRole('radio', { name: '330 mm', exact: true })).toHaveAttribute('aria-checked', 'true');
        const row = rowOfCode(page, wallCode(ids[0] as string, ids));
        await expect.soft(row).toContainText('130,0 mm'); // |200 - 330|
        await expect.soft(row).toContainText('Vi phạm');
        expect.soft(putsTo(flow, floorId, from), 'an override is not a write').toBe(0);
        await ev(page, '21-A-029', 'row-override');
      });

      await test.step('[21-E-005] row radiogroup "Độ dày chuẩn hoá của đoạn #…" with radios 110 / 220 / 330 / Cột BTCT; arrows move', async () => {
        const group = radios(1);
        await expect.soft(group.getByRole('radio')).toHaveText(['110 mm', '220 mm', '330 mm', 'Cột BTCT']);
        const current = group.getByRole('radio', { checked: true });
        await current.focus();
        await page.keyboard.press('ArrowRight'); // TST:109-122
        await expect.soft(group.getByRole('radio', { name: '330 mm', exact: true }), 'ArrowRight moves the selection').toHaveAttribute('aria-checked', 'true');
        await page.keyboard.press('ArrowLeft');
        await expect.soft(group.getByRole('radio', { name: '220 mm', exact: true })).toHaveAttribute('aria-checked', 'true');
      });

      await test.step('[21-C-012] row overrides survive an apply (never reset)', async () => {
        await tick(acceptBox(page, 200));
        await button(page, PREVIEW_BTN).click();
        const put = waitForPut(page, built.project.projectId, floorId);
        await button(page, APPLY).click();
        await put;
        await expect.soft(radios(0).getByRole('radio', { name: '330 mm', exact: true })).toHaveAttribute('aria-checked', 'true'); // UT:692-694
        await ev(page, '21-C-012', 'override-survives');
      });

      await test.step('[21-A-030] a row checkbox selects: "Đã chọn N tường" and the action toolbar', async () => {
        await tick(rowBox(1));
        await expect.soft(toolbar(1)).toBeVisible(); // TST:197-201, TAB2:56,69
        await expect.soft(toolbar(1)).toContainText('Đã chọn 1 tường');
        await ev(page, '21-A-030', 'row-selected');
      });

      await test.step('[21-E-006] the row checkbox is named "Chọn dòng {machine id}", not the "#W-00N" code', async () => {
        const name = await rowBox(1).getAttribute('aria-label');
        expect.soft(name).toBe(`Chọn dòng ${ids[1] as string}`); // TBL:333
        expect.soft(name).not.toContain('#');
      });

      await test.step('[21-A-031] "Chọn tất cả" selects all; a partial selection shows indeterminate', async () => {
        await tick(region(page).getByRole('checkbox', { name: 'Chọn tất cả', exact: true }));
        await expect.soft(toolbar(7)).toBeVisible(); // TBL:307-312, TST:145-146,171
        await tick(rowBox(1)); // untick one
        await expect.soft(toolbar(6)).toBeVisible();
        const mixed = await region(page).getByRole('checkbox', { name: 'Chọn tất cả', exact: true }).evaluate((node) => (node as HTMLInputElement).indeterminate || node.getAttribute('aria-checked') === 'mixed');
        expect.soft(mixed, 'header checkbox is indeterminate').toBe(true);
        await ev(page, '21-A-031', 'select-all-partial');
        await tick(region(page).getByRole('checkbox', { name: 'Chọn tất cả', exact: true })); // all selected again
        await tick(region(page).getByRole('checkbox', { name: 'Chọn tất cả', exact: true })); // none
        await expect.soft(region(page).getByRole('toolbar')).toHaveCount(0);
      });

      await test.step('[21-A-032] "Đổi độ dày" -> picker -> "Áp dụng": one PUT and the toast', async () => {
        await tick(rowBox(1));
        await tick(rowBox(2));
        await button(page, CHANGE_THICKNESS).click();
        await expect.soft(region(page).getByText('Chọn nhóm áp cho 2 tường đã chọn:', { exact: true })).toBeVisible(); // TST:61-63,120,124,236-264
        await expect.soft(picker().getByRole('radio', { name: '110 mm', exact: true })).toHaveAttribute('aria-checked', 'true');
        const put = waitForPut(page, built.project.projectId, floorId);
        await picker().getByRole('button', { name: APPLY, exact: true }).click(); // UT:736-755
        await put;
        await expect.soft(toastText(page, 'Chuẩn hoá độ dày 2 tường.')).toBeVisible();
        await ev(page, '21-A-032', 'picker-applied');
      });

      await test.step('[21-A-033] picker "Huỷ": closed, no write', async () => {
        await tick(rowBox(3));
        await button(page, CHANGE_THICKNESS).click();
        await expect(picker()).toBeVisible();
        const from = flow.sent.length;
        await picker().getByRole('button', { name: CANCEL, exact: true }).click(); // TST:250
        await expect.soft(picker()).toHaveCount(0);
        expect.soft(putsTo(flow, floorId, from)).toBe(0);
      });

      await test.step('[21-A-034] ⚑ picker "Cột BTCT" -> "Áp dụng": expected a change or a refusal, not a silent no-op', async () => {
        await button(page, CHANGE_THICKNESS).click();
        const column = picker().getByRole('radio', { name: 'Cột BTCT', exact: true });
        if ((await column.count()) === 0) {
          note('[21-A-034] the picker offers no "Cột BTCT" option: nothing to apply');
          return;
        }
        await column.click();
        const from = flow.sent.length;
        const toastsBefore = await toasts(page).getByRole('button', { name: UNDO, exact: true }).count();
        await picker().getByRole('button', { name: APPLY, exact: true }).click(); // TST:109-112, TG:901-925,927-940
        await softly
          .poll(
            async () => putsTo(flow, floorId, from) > 0 || (await toasts(page).getByRole('button', { name: UNDO, exact: true }).count()) > toastsBefore || (await region(page).getByRole('alert').count()) > 0,
            { timeout: 4_000, message: 'a PUT, a toast or an alert follows "Áp dụng" on "Cột BTCT"' },
          )
          .toBe(true);
        await ev(page, '21-A-034', 'picker-column');
      });

      await test.step('[21-A-035] "Bỏ chọn" or Esc clears the selection', async () => {
        await page.reload();
        await expect(segRows(page)).toHaveCount(7);
        await tick(rowBox(1));
        await expect(toolbar(1)).toBeVisible();
        await region(page).getByRole('button', { name: 'Bỏ chọn tất cả', exact: true }).click(); // TAB2:41-49,125-130
        await expect.soft(region(page).getByRole('toolbar')).toHaveCount(0);
        await tick(rowBox(1));
        await expect(toolbar(1)).toBeVisible();
        await page.keyboard.press('Escape');
        await expect.soft(region(page).getByRole('toolbar')).toHaveCount(0); // TST:152-155
      });
    });
  });

  test('SCR-21 · FL-21-06 · sorting, hover, preview collapse, a11y, Ctrl+Z', async ({ browser }) => {
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
        expect.soft(await numbers(4), 'default: deviation descending').toEqual([40, 20, 20, 20, 20, 20, 0]); // TST:74-79,148,164-180; UT:267-286
        await head('Độ dày đo được').click();
        expect.soft(await numbers(2), 'measured ascending').toEqual([150, 200, 200, 200, 200, 200, 220]);
        await head('Sai lệch').click();
        expect.soft(await numbers(4), 'deviation descending again').toEqual([40, 20, 20, 20, 20, 20, 0]);
        await head('Độ tin cậy').click();
        await head('Tầng').click();
        await expect.soft(segRows(page)).toHaveCount(7);
        await ev(page, '21-A-036', 'sorted');
      });

      await test.step('[21-C-009] sort orders: deviation desc; measured / confidence asc; floor by localeCompare', async () => {
        await head('Sai lệch').click();
        const dev = await numbers(4);
        expect.soft(dev).toEqual([...dev].sort((a, b) => b - a)); // UT:267-286
        await head('Độ dày đo được').click();
        const measured = await numbers(2);
        expect.soft(measured).toEqual([...measured].sort((a, b) => a - b));
        await head('Tầng').click();
        const floors = await column(page, 6);
        expect.soft(floors).toEqual([...floors].sort((a, b) => a.localeCompare(b)));
      });

      await test.step('[21-E-010] sortable headers expose aria-sort', async () => {
        await head('Độ dày đo được').click();
        await expect.soft(head('Độ dày đo được')).toHaveAttribute('aria-sort', 'ascending'); // TBL sort heads, TST:172-180
        await expect.soft(head('Sai lệch')).toHaveAttribute('aria-sort', 'none');
        await head('Sai lệch').click();
        await expect.soft(head('Sai lệch')).toHaveAttribute('aria-sort', 'descending');
        await expect.soft(head('Mã')).not.toHaveAttribute('aria-sort', /./u);
      });

      await test.step('[21-A-038] hover a segment row <-> hover a preview polygon', async () => {
        const row = rowOfCode(page, wallCode(ids[0] as string, ids));
        await row.hover(); // TST:192-193, TPC:154-156
        await expect.soft(row).toHaveClass(/bg-bg-hover/u);
        const matched = await polygons(page).evaluateAll((nodes) => nodes.filter((node) => Math.abs(Number(node.getAttribute('fill-opacity')) - 0.9) < 0.01).length);
        expect.soft(matched, 'the hovered wall (and its group) is highlighted').toBeGreaterThan(0);
        const polygon = polygons(page).nth(5);
        await polygon.hover({ force: true });
        await expect.poll(async () => segRows(page).evaluateAll((rows) => rows.filter((r) => r.className.includes('bg-bg-hover')).length)).toBeGreaterThan(0);
        await ev(page, '21-A-038', 'row-polygon-hover');
      });

      await test.step('[21-A-040] "Thu gọn khung xem trước" -> "Khung xem trước đang thu gọn" restores', async () => {
        await page.getByRole('button', { name: COLLAPSE, exact: true }).click(); // TV:116-117,246-271
        await expect.soft(page.locator('aside[aria-label="Mặt bằng xem trước theo nhóm độ dày"]')).toHaveCount(0);
        await page.getByRole('button', { name: EXPANDED, exact: true }).click();
        await expect.soft(page.locator('aside[aria-label="Mặt bằng xem trước theo nhóm độ dày"]')).toBeVisible();
      });

      await test.step('[21-E-009] the collapse toggle names a state and has no aria-expanded', async () => {
        await page.getByRole('button', { name: COLLAPSE, exact: true }).click();
        const toggle = page.getByRole('button', { name: EXPANDED, exact: true });
        await expect.soft(toggle).toBeVisible(); // TV:117,249-251
        await expect.soft(toggle).not.toHaveAttribute('aria-expanded', /./u);
        await toggle.click();
      });

      await test.step('[21-E-008] preview aside "Mặt bằng xem trước theo nhóm độ dày" (svg aria-hidden) and the legend list', async () => {
        const aside = page.locator('aside[aria-label="Mặt bằng xem trước theo nhóm độ dày"]');
        await expect.soft(aside).toBeVisible(); // TPC:65-66,110-113,129-133,183-185
        await expect.soft(aside.locator('svg')).toHaveAttribute('aria-hidden', 'true');
        await expect.soft(page.getByRole('list', { name: 'Chú giải độ dày tường', exact: true })).toBeVisible();
      });

      await test.step('[21-E-011] the "Dung sai" field has its label and the unit "mm"', async () => {
        await expect.soft(page.getByLabel(TOLERANCE, { exact: true })).toBeVisible(); // TAB:114-120
        await expect.soft(page.getByLabel(TOLERANCE, { exact: true }).locator('xpath=..')).toContainText('mm');
      });

      await test.step('[21-E-012] group rows are motion rows: with reduced motion a click on a group checkbox lands at once', async () => {
        expect.soft(await page.evaluate(() => matchMedia('(prefers-reduced-motion: reduce)').matches), 'context emulates reduced motion').toBe(true); // TGT:62-65
        await head('Độ dày đo được').click();
        await tick(acceptBox(page, 200));
        await expect.soft(acceptBox(page, 200)).toBeChecked();
        await tick(acceptBox(page, 200));
      });

      await test.step('[21-A-015] ⚑ Ctrl+Z on this screen: the screen\'s own undo, and "Hoàn tác" afterwards must not re-apply', async () => {
        const applied = await applyGroup(page, built, 0, 200);
        expect(applied.response.status()).toBe(200);
        await expect.poll(async () => (await numbers(2)).filter((value) => value === 200).length).toBe(0);
        await page.locator('body').click({ position: { x: 2, y: 2 } });
        const put = waitForPut(page, built.project.projectId, floorId, (walls) => ids.slice(0, 5).every((id) => thicknessOf(walls, id) === 200)).catch(() => null);
        await page.keyboard.press('Control+Z'); // RT:219-221, UT:831-848
        await put;
        await expect.poll(async () => (await numbers(2)).filter((value) => value === 200).length, { message: 'Ctrl+Z reverts the apply' }).toBe(5);
        await button(page, UNDO).click(); // the bar must have nothing left to undo
        const after = await numbers(2);
        await attachJson('E04_21-A-015_after.json', { after });
        expect.soft(after.filter((value) => value === 200), '"Hoàn tác" after Ctrl+Z does not re-apply the inverse').toHaveLength(5);
        await ev(page, '21-A-015', 'ctrl-z');
      });

      await test.step('[21-B-014] the preview legend lists only the present groups', async () => {
        await page.reload();
        await expect(segRows(page)).toHaveCount(7);
        const legend = page.getByRole('list', { name: 'Chú giải độ dày tường', exact: true });
        await expect.soft(legend.getByRole('listitem')).toHaveText(['110 mm', '220 mm']); // TG:707-720, TPC:182-203
        await expect.soft(legend).not.toContainText('330 mm');
        await expect.soft(legend).not.toContainText('Cột bê tông cốt thép');
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
        const link = ROUTES.project.thickness(project, built.floorIds[0] as string); // notificationCenterGateway.ts:130
        await page.goto(link);
        await expect(region(page)).toBeVisible();
        expect.soft(new URL(page.url()).pathname).toBe(link);
        note('[21-A-002] no API creates a notification with place "thickness" on the real stack; the link target the notification gateway builds is what is entered');
      });

      await test.step('[21-A-003] ⚑ no in-app way to reach the walls layer from here: expected a link or a button (dead end)', async () => {
        await expect(page.getByText(EMPTY_TITLE, { exact: true })).toBeVisible();
        const exits = await region(page).locator('a[href], button').filter({ hasText: /lớp tường|Sang duyệt tường|Duyệt lớp tường/iu }).count();
        expect.soft(exits, 'the empty notice says "Sang lớp tường…" — a link or button must take the reader there').toBeGreaterThan(0); // UT:128-129, TV:182-186
        await ev(page, '21-A-003', 'dead-end');
      });

      await test.step('[21-B-002] no wall: the empty state, the notice, the preview placeholder and a disabled "Xem trước"', async () => {
        await expect.soft(page.getByText(EMPTY_TITLE, { exact: true })).toBeVisible(); // TV:115,178-191
        await expect.soft(region(page).getByText(NO_MEASUREMENT, { exact: true })).toBeVisible();
        await expect.soft(region(page).getByText('Chưa có hình tường để xem trước', { exact: true })).toBeVisible();
        await expect.soft(button(page, PREVIEW_BTN)).toBeDisabled();
        await ev(page, '21-B-002', 'no-wall');
      });

      await test.step('[21-B-003] every wall already standard: the notice and "Chưa có nhóm nào để chuẩn hoá."', async () => {
        await openThickness(page, built, 1);
        await expect.soft(region(page).getByText(ALL_STANDARD, { exact: true })).toBeVisible(); // UT:126-127, TV:195-199
        await expect.soft(groupTable(page)).toContainText(GROUP_EMPTY);
        await ev(page, '21-B-003', 'all-standard');
      });

      await test.step('[21-B-006] first read fails (404 floor, 404 project): the shared read-failure screen inside the region', async () => {
        const floorId = `L-QAE04MISSING${Date.now().toString(36).toUpperCase()}`;
        const gone = waitForApi(page, 'GET', new RegExp(`^/api/projects/${project}/floors/${floorId}/spatial/layer$`, 'u'), [404]);
        await page.goto(ROUTES.project.thickness(project, floorId));
        await gone;
        const alert = region(page).getByRole('alert').filter({ hasText: FLOOR_GONE }); // TV:307-313
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

      await test.step('[21-B-016] ⚑ a store that holds a second floor: only this floor\'s walls in the tables, histogram and preview', async () => {
        await page.goto(ROUTES.project.floors(project));
        await expect(page.getByRole('row', { name: /, cao độ /u })).toHaveCount(2);
        await spaGo(page, ROUTES.project.thickness(project, floorA)); // client-side hop: the store keeps both floors
        await expect(region(page)).toBeVisible();
        await expect(segRows(page).first()).toBeVisible();
        const floors = await column(page, 6);
        await attachJson('E04_21-B-016_floors.json', { floors });
        expect.soft(new Set(floors), 'every row is of this floor').toEqual(new Set(['Tầng A'])); // UT:388-395, TG:342-345
        expect.soft(floors.length, 'six walls on floor A').toBe(6);
        await ev(page, '21-B-016', 'two-floor-store');
      });

      await test.step('[21-G-005] ⚑ "Áp dụng" with two floors in the store writes only this floor', async () => {
        const from = flow.sent.length;
        const put = waitForPut(page, project, floorA);
        await tick(acceptBox(page, 200));
        await button(page, PREVIEW_BTN).click();
        await button(page, APPLY).click();
        await put;
        // The autosave of a second floor, if any, follows the first within its 800 ms debounce: outlast it, then count.
        await page.waitForTimeout(1_500); // fixed-wait-ok: absence of a write, no signal exists for "nothing sent"
        expect.soft(putsTo(flow, floorB, from), 'no PUT to the other floor').toBe(0); // UT:388, SLS:178-190
        await ev(page, '21-G-005', 'apply-two-floors');
      });

      await test.step('[21-B-012] ⚑ save status: a visible "Đã lưu lúc…" after the save (A7)', async () => {
        const shown = await page.getByText(/Đã lưu lúc/u).count();
        expect.soft(shown, 'useSaveIndicator result is shown, not only announced').toBeGreaterThan(0); // UT:548
      });

      await test.step('[21-B-011] 409: a write elsewhere, then an apply here shows the reload banner (shared FSB copy)', async () => {
        await seedWalls(adminApi, project, floorA, [{ from: [0, 0], to: [4_000, 0], thicknessMm: 200 }, { from: [0, 1_500], to: [4_000, 1_500], thicknessMm: 200 }]);
        await toasts(page).getByRole('button', { name: UNDO, exact: true }).first().click();
        await expect(region(page).getByText(CONFLICT, { exact: true })).toBeVisible({ timeout: 15_000 }); // FSB:37, SLS:83
        await expect.soft(region(page).getByRole('button', { name: RELOAD, exact: true })).toBeVisible();
        await ev(page, '21-B-011', 'conflict-banner');
      });

      await test.step('[21-G-004] the PUT answered 409 and "Tải lại" reloads the floor', async () => {
        const statuses = flow.log.filter((entry) => entry.method === 'PUT' && LAYER_PATH.exec(entry.path)?.[1] === floorA).map((entry) => entry.status);
        expect.soft(statuses, 'last PUT of floor A').toContain(409); // SLS:93
        await region(page).getByRole('button', { name: RELOAD, exact: true }).click();
        await expect.soft(region(page).getByText(CONFLICT, { exact: true })).toHaveCount(0);
        await ev(page, '21-G-004', 'after-reload');
      });
    });
  });
});
