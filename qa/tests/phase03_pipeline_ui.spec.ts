/**
 * Phase 3 — dedicated UI-verification cases (skill `qa-verify-ui`): one test per visible state of SCR-08 (settings),
 * SCR-09 (floors), SCR-10 (upload), SCR-11 (quality gate), SCR-12 (processing), SCR-13 (pipeline graph) and SCR-15
 * (CAD branch confirm), each at 1440 / 1024 / 768 / 375 (`support/ui-verify.ts`), evidence `U03_<state>_<width>.png` +
 * `U03_<state>.json`. Reviewed by the "verify ui" step with the qa-review-ui checklist. Models: `phase01_auth_ui.spec.ts`,
 * `phase02_dashboard_ui.spec.ts`.
 *
 * Data:
 *   - CP-2 project (`project.projectId`, Phase 2) for the data states. After the Phase 3 main layer it also holds CP-3..CP-5;
 *     states that need a drawing or a finished run (SCR-11 report/corners/straighten/acknowledgement, SCR-12 done/log/step
 *     detail) SKIP with a `data:` reason when CP-2 has none (the screen then shows its empty state, shot by the cases below).
 *   - One run-unique project with an 80-character name and NO floors (`qa-<runId>-u03-…`), created through the API before the
 *     group and deleted after it: the empty states of SCR-09/10/11/12, the "no floors" danger tab, the long name in the
 *     settings field / delete dialog / processing breadcrumb. No "name over 80" state: the field has `maxLength` 80
 *     (GeneralTab.tsx:43), so a person cannot type the 81st character.
 *   - One run-unique project whose only floor holds the env PNG turned 8° (`support/drawingSeed.ts`, BUG-364), uploaded
 *     through the API before its group and deleted after it: "Tự động nắn" (SKEW_DETECTED) and the acknowledgement hint
 *     ("poor" skew), which the straight env drawing never shows.
 *   - SCR-15 needs a floor id: `floors.workFloorId` (Phase 3 main) when set, else the first row of
 *     `GET /api/projects/:id/floors` (BE apps/api/floors/router.py:46) of CP-2.
 *
 * Budget — logins: 2 real admin API logins (`signedInApi`: the empty project, the skewed drawing); a browser login only to
 * replace a dead stored session (`ensureAdminSession`). Writes: 2 `POST /api/projects` + 2
 * `DELETE /api/projects/:id` + one upload (init / chunk / complete → one fake-ML run) of the skewed drawing (API), nothing else:
 *   - settings: only an EMPTY "Tên dự án" is typed — a local problem, so autosave sends nothing
 *     (`useProjectSettings.ts` getChanges returns undefined while `hasLocalProblem`); the delete dialog is never confirmed
 *     (its button needs the name typed, `canConfirmDanger`);
 *   - floors: selection, "Nhân bản tầng" (local `duplicatingFloorId`, FloorTable.tsx:235) — "Nhân bản" never clicked —, the
 *     row menu, "Ẩn khỏi mô hình 3D" (session only, no write: phase03_pipeline.spec.ts), the "Tự động tính cao độ" switch
 *     (view state, useFloorManager.ts:1073);
 *   - upload: a .txt is refused in the browser; the env PNG lands in "Tệp chưa gán tầng" (its name names no floor, so
 *     `guessFloor` matches nothing and `startUpload` is not called, useFloorUploadScreen.ts:723-745) and is never assigned;
 *     "Bắt đầu xử lý" with a file-less floor only shows the block notice (`submit`, no request);
 *   - quality: "Tự động nắn" dialog never confirmed, corner pick never applied, "Tiếp tục xử lý" only clicked while the
 *     acknowledgement is unticked (stays on the page);
 *   - CAD: "Huỷ" only.
 * Sessions: every test opens its OWN context from Phase 1's admin storage state and writes the rotated refresh cookie back
 * in `finally` (phase01 chain): 33 tests × (4 loads + 1 session check) = 165 `POST /api/auth/refresh` over several minutes
 * (`auth_refresh_total` 300 / 60 s per sid).
 * No faked response: every state is the real stack. Non-serial: each test uses its own context and page.
 * BUG-143: framer-motion overlays end with `settled(<overlay>)`. Below 1024 px the quality report sits UNDER the drawing in
 * the page flow (InputQualityGate.tsx:156-168, FIX-1381 / BUG-291; it was a `fixed` bottom sheet, BUG-161), so SCR-11
 * report states shoot the full page like every other state — a viewport shot would cut the report off at 768 / 375.
 */
import { existsSync, writeFileSync } from 'node:fs';

import { expect, test, type APIRequestContext, type Browser, type Locator, type Page } from '@playwright/test';

import { ROUTES } from '../../e2e/fixtures/routes';
import { PIPELINE_TIMEOUT_MS, readBaseUrl } from '../../e2e/fullstack/env';
import { signedInApi } from './support/api';
import { ensureAdminSession, readAdminCredentials } from './support/auth';
import { TEST_DATA_PREFIX } from './support/evidence';
import { ADMIN_STORAGE_STATE_FILE, readState, requireState } from './support/state';
import { createSkewedDrawingProject, deleteSeededProject, rotatedPng, SKEW_DEG, type SeededDrawing } from './support/drawingSeed';
import { UI_VIEWPORTS, verifyUi } from './support/ui-verify';

/* Copy — every string checked in src/ (file noted). */
const SETTINGS_TABS = 'Nhóm cài đặt'; // ProjectSettings.tsx TAB_GROUP_LABEL (tablist ≥1024, Select <1024)
const TAB = { general: 'Chung', units: 'Đơn vị đo', members: 'Thành viên', danger: 'Vùng nguy hiểm' } as const; // useProjectSettings.ts:507-512
const NAME_LABEL = 'Tên dự án'; // GeneralTab.tsx:40
const NAME_REQUIRED = 'Chưa nhập tên dự án.'; // useProjectSettings.ts:423
const LENGTH_UNIT_LABEL = 'Đơn vị chiều dài'; // UnitsTab.tsx:46
const MEMBER_EMAIL_LABEL = 'Email người cần thêm'; // AddMemberForm.tsx:29
const ADD_MEMBER = 'Thêm thành viên'; // AddMemberForm.tsx
const DELETE_PROJECT = 'Xoá dự án'; // DangerZoneTab.tsx
const DELETE_ALL_FLOORS = 'Xoá mọi tầng'; // DangerZoneTab.tsx
const DANGER_NO_FLOORS = 'Chưa có tầng nào'; // DangerZoneTab.tsx:74
const DELETE_DIALOG_TITLE = 'Xoá dự án này?'; // useProjectSettings.ts:522
const DELETE_CONFIRM_FIELD = 'Gõ lại tên dự án để xác nhận'; // ProjectSettings.tsx Modal
const KEEP = 'Để nguyên'; // ProjectSettings.tsx Modal
/* SCR-09: FloorManager.tsx, FloorTable.tsx, FloorTableRow.tsx, FloorSectionCut.tsx. */
const FLOORS_TITLE = 'Quản lý tầng';
const SECTION_LABEL = 'Lát cắt các tầng theo đúng tỷ lệ chiều cao';
const COLLAPSE_SECTION = 'Thu gọn lát cắt';
const EXPAND_SECTION = 'Hiện lát cắt';
const DUPLICATE_SELECTED = 'Nhân bản tầng'; // FloorTable.tsx:79
const CONFIRM_DUPLICATE = 'Nhân bản'; // FloorTableRow.tsx:76 — never clicked
const COPY_FURNITURE = 'Sao chép nội thất sang tầng mới'; // FloorTableRow.tsx:57
const AUTO_ELEVATION = 'Tự động tính cao độ';
const HIDE_IN_3D = 'Ẩn khỏi mô hình 3D';
// floorManagerGateway.ts:212 (FIX-1424, BUG-287); shares one `<p>` with the floor-contents sentence → substring match.
const HIDE_3D_NOTICE = 'Tầng đang ẩn khỏi mô hình 3D sẽ hiện lại sau khi tải lại trang.';
const FLOORS_EMPTY_TITLE = 'Chưa có tầng nào'; // FloorTable.tsx:76
const FLOORS_EMPTY_NOTICE = 'Thêm tầng đầu tiên, hoặc nhập số tầng từ màn hình tạo dự án.'; // useFloorManager.ts:178
/* SCR-10: FloorUploadScreen.tsx, FloorUploadDropZone.tsx, FloorUploadFooter.tsx, useFloorUploadScreen.ts. */
const DROPZONE = 'floor-upload-dropzone';
const FILE_INPUT = 'floor-upload-file-input';
const BLOCK_NOTICE = 'floor-upload-block-notice';
const START_PROCESSING = 'Bắt đầu xử lý';
const BLOCKED_TITLE = 'Không thể bắt đầu xử lý';
const TRAY_TITLE = 'Tệp chưa gán tầng'; // useFloorUploadScreen.ts:103
const ASSIGN_FLOOR = 'Gán cho tầng khác';
const REJECTED = /^Định dạng .+ chưa nhận được\./u;
const UPLOAD_NO_FLOORS = 'Dự án chưa có tầng nào'; // FloorUploadScreen.tsx NO_FLOORS_TITLE
const UPLOAD_ADD_FLOORS = 'Thêm tầng'; // FloorUploadScreen.tsx:80 ADD_FLOORS_LABEL (FIX-1400, BUG-298)
const BREADCRUMB_NAV = 'Đường dẫn trang'; // Breadcrumb.tsx:19 NAV_LABEL
/* SCR-11: InputQualityGate.tsx, useInputQualityGate.ts COPY, InputQualityGateFooter.tsx. */
const QUALITY_REPORT = 'Báo cáo chất lượng';
const NO_DRAWING_TITLE = 'Chưa có bản vẽ để kiểm tra'; // InputQualityGate.tsx:65
const PICK_CORNERS = 'Chọn góc thủ công';
const CORNER_GROUP = 'Bốn góc bản vẽ, kéo để chỉnh khung';
const STRAIGHTEN = 'Tự động nắn';
const STRAIGHTEN_DIALOG = /^Nắn thẳng bản vẽ tầng /u;
const CONTINUE = 'Tiếp tục xử lý';
const ACK_LABEL = 'Tôi đã đọc cảnh báo và vẫn muốn xử lý bản vẽ này';
const ACK_BLOCKED = 'Đánh dấu ô xác nhận bên trên rồi thử lại.';
/* SCR-12: ProcessingScreen.tsx, ProcessingStepList.tsx, useProcessingScreen.ts:174. */
const PIPELINE_NAV = 'Xử lý';
// useProcessingScreen.ts:186 renders "Đã xử lý xong N/N tầng" (older builds: "Đã xong …"); accept both.
const DONE = /^Đã (?:xử lý )?xong ([1-9]\d*)\/\1 tầng/u;
const FAILURE_COPY = 'Sao chép mã lỗi';
const PIPELINE_EMPTY = 'Chưa có bước nào để theo dõi';
const PIPELINE_TABS = 'Xem trước hoặc nhật ký';
const LOG_TAB = 'Nhật ký';
const OPEN_DETAIL = 'Mở chi tiết bước';
const ALL_STEPS = 'Xem tất cả các bước'; // ProcessingScreen.tsx:87 ALL_STEPS_LABEL (FIX-1383, BUG-294)
const CLOSE_DETAIL = 'Đóng chi tiết bước';
/* SCR-13 / SCR-15. */
const GRAPH_EMPTY = 'Chưa có lượt xử lý nào để kể lại'; // pipelineGraphText.ts:208
const CAD_DIALOG = 'Phát hiện tệp CAD'; // cadBranchConfirmText.ts:30
const CAD_EMPTY = 'Chưa có lớp nào để ánh xạ'; // CadBranchConfirm.tsx:86
const CANCEL = 'Huỷ';

const PROJECTS_PATH = '/api/projects';
const NAME_MAX_LENGTH = 80;
/** Exactly 80 chars, run-unique: `qa-<runId>-u03-<base36 time> ` + Vietnamese filler, ending in a letter. */
const LONG_NAME = `${`${TEST_DATA_PREFIX}u03-${Date.now().toString(36)} ${'Khu phức hợp văn phòng Bình Minh '.repeat(4)}`.slice(0, NAME_MAX_LENGTH - 1)}A`;
if (LONG_NAME.length !== NAME_MAX_LENGTH) throw new Error(`LONG_NAME is ${LONG_NAME.length} chars`);

/* ---- helpers ---- */

const cp2 = (): string => requireState((s) => s.project.projectId, 'project.projectId', 'Phase 2');
const floorRows = (page: Page): Locator => page.getByRole('row', { name: /, cao độ /u });

/** Own context from the admin storage state; the rotated refresh cookie goes back to the file (phase02 `verifyAsAdmin`). */
async function verifyAsAdmin(
  browser: Browser,
  name: string,
  open: (page: Page) => Promise<void>,
  shot: { readonly fullPage?: boolean } = {},
  watch?: (page: Page) => void,
): Promise<void> {
  // The only reader/writer of the stored admin session in the ui layer (QA-03d flow files sign in per context), so
  // `--workers 4` cannot rotate its cookie under it. No file yet (phase 1 not run here) → ensureAdminSession signs in once.
  const context = await browser.newContext({
    baseURL: readBaseUrl(),
    ...(existsSync(ADMIN_STORAGE_STATE_FILE) ? { storageState: ADMIN_STORAGE_STATE_FILE } : {}),
  });
  try {
    await ensureAdminSession(context, ADMIN_STORAGE_STATE_FILE);
    const page = await context.newPage();
    watch?.(page);
    await verifyUi(page, name, open, UI_VIEWPORTS, shot);
  } finally {
    await context.storageState({ path: ADMIN_STORAGE_STATE_FILE });
    await context.close();
  }
}

/** BUG-143: finite animations under `target` done, then its box and opacity hold still for 3 frames (phase02 `settled`). */
async function settled(target: Locator): Promise<void> {
  await expect(target).toBeVisible();
  const still = await target.evaluate(async (el, budgetMs) => {
    const deadline = performance.now() + budgetMs;
    const finite = el
      .getAnimations({ subtree: true })
      .filter((animation) => Number.isFinite(Number(animation.effect?.getComputedTiming().endTime)));
    await Promise.race([
      Promise.all(finite.map((animation) => animation.finished.catch(() => undefined))),
      new Promise((resolve) => setTimeout(resolve, budgetMs)),
    ]);
    const sample = (): string => {
      const r = el.getBoundingClientRect();
      return `${r.x},${r.y},${r.width},${r.height},${getComputedStyle(el).opacity}`;
    };
    let last = sample();
    let steady = 0;
    while (steady < 3) {
      if (performance.now() > deadline) return false;
      await new Promise((resolve) => requestAnimationFrame(resolve));
      const now = sample();
      steady = now === last ? steady + 1 : 0;
      last = now;
    }
    return true;
  }, 5_000);
  expect(still, 'overlay still moving after 5 s').toBe(true);
}

/** Settings loaded, then `tab` chosen: tablist ≥1024, the "Nhóm cài đặt" Select below (`isCollapsed`, ProjectSettings.tsx). */
async function openSettingsTab(page: Page, projectId: string, tab: string): Promise<void> {
  await page.goto(ROUTES.project.settings(projectId));
  const tablist = page.getByRole('tablist', { name: SETTINGS_TABS, exact: true });
  const select = page.getByRole('combobox', { name: SETTINGS_TABS, exact: true });
  await expect(tablist.or(select)).toBeVisible({ timeout: 15_000 });
  if (await tablist.isVisible()) {
    await tablist.getByRole('tab', { name: tab, exact: true }).click();
  } else {
    await select.click();
    await page.getByRole('option', { name: tab, exact: true }).click();
  }
}

async function openFloors(page: Page, projectId: string): Promise<string[]> {
  await page.goto(ROUTES.project.floors(projectId));
  await expect(page.getByRole('heading', { name: FLOORS_TITLE, exact: true })).toBeVisible({ timeout: 15_000 });
  await expect(floorRows(page).first()).toBeVisible({ timeout: 15_000 });
  const labels = await floorRows(page).evaluateAll((rows) => rows.map((row) => row.getAttribute('aria-label') ?? ''));
  return labels.map((label) => label.replace(/, cao độ .*$/su, ''));
}

async function openUpload(page: Page, projectId: string): Promise<void> {
  await page.goto(ROUTES.project.upload(projectId));
  await expect(page.getByTestId(DROPZONE)).toBeVisible({ timeout: 15_000 });
}

/** Quality gate settled on the report; SKIPS when the project (CP-2 by default) has no drawing yet (CP-4 not reached). */
async function openQualityReport(page: Page, projectId: string = cp2()): Promise<Locator> {
  await page.goto(ROUTES.project.quality(projectId));
  const report = page.getByRole('region', { name: QUALITY_REPORT, exact: true });
  const noDrawing = page.getByText(NO_DRAWING_TITLE, { exact: true });
  await expect(report.or(noDrawing)).toBeVisible({ timeout: 15_000 });
  test.skip(await noDrawing.isVisible(), 'data: CP-2 has no drawing (CP-4 not reached); the empty state is U03_quality_no_drawing');
  return report;
}

/** Processing screen settled; SKIPS when CP-2 has no run (CP-5 not reached this run). */
async function openPipelineDone(page: Page): Promise<void> {
  await page.goto(ROUTES.project.pipeline(cp2()));
  await expect(page.getByRole('navigation', { name: PIPELINE_NAV, exact: true })).toBeVisible({ timeout: 15_000 });
  const done = page.getByText(DONE).first();
  const empty = page.getByText(PIPELINE_EMPTY, { exact: true });
  await expect(done.or(empty).or(page.getByRole('button', { name: FAILURE_COPY })).first()).toBeVisible({ timeout: 15_000 });
  test.skip(await empty.isVisible(), 'data: CP-2 has no processing run (CP-5 not reached); the empty state is U03_pipeline_empty');
  await expect(done).toBeVisible();
  await openAllSteps(page);
}

/**
 * Below 1024 px the screen shows one step bar and keeps the six steps behind a native `<details>` "Xem tất cả các bước"
 * (ProcessingScreen.tsx:202-212, FIX-1383 / BUG-294): open it so the 768 / 375 shots show every step. No-op ≥ 1024 px.
 */
async function openAllSteps(page: Page): Promise<void> {
  const toggle = page.getByText(ALL_STEPS, { exact: true });
  if (!(await toggle.isVisible())) return;
  const details = page.locator('details').filter({ has: toggle });
  if ((await details.getAttribute('open')) === null) await toggle.click();
  await expect(details).toHaveAttribute('open', '');
}

/* ========================================================================== */
/* Data states on CP-2                                                        */
/* ========================================================================== */

test.describe('U03 UI verify — SCR-08 settings (CP-2)', () => {
  test('U03 · SCR-08 settings, "Chung" tab', async ({ browser }) => {
    await verifyAsAdmin(browser, 'U03_settings_general', async (p) => {
      await openSettingsTab(p, cp2(), TAB.general);
      await expect(p.getByRole('textbox', { name: NAME_LABEL, exact: true })).toBeVisible();
    });
  });

  test('U03 · SCR-08 settings, empty "Tên dự án" → field error (nothing saved)', async ({ browser }) => {
    await verifyAsAdmin(browser, 'U03_settings_name_required', async (p) => {
      await openSettingsTab(p, cp2(), TAB.general);
      const name = p.getByRole('textbox', { name: NAME_LABEL, exact: true });
      await name.fill('');
      await name.blur();
      await expect(p.getByText(NAME_REQUIRED, { exact: true })).toBeVisible();
    });
  });

  test('U03 · SCR-08 settings, "Đơn vị đo" tab', async ({ browser }) => {
    await verifyAsAdmin(browser, 'U03_settings_units', async (p) => {
      await openSettingsTab(p, cp2(), TAB.units);
      await expect(p.getByRole('combobox', { name: LENGTH_UNIT_LABEL, exact: true })).toBeVisible();
    });
  });

  test('U03 · SCR-08 settings, "Thành viên" tab', async ({ browser }) => {
    await verifyAsAdmin(browser, 'U03_settings_members', async (p) => {
      await openSettingsTab(p, cp2(), TAB.members);
      await expect(p.getByLabel(MEMBER_EMAIL_LABEL, { exact: true })).toBeVisible();
      await expect(p.getByRole('button', { name: ADD_MEMBER, exact: true })).toBeVisible();
    });
  });

  test('U03 · SCR-08 settings, "Vùng nguy hiểm" tab (project with floors)', async ({ browser }) => {
    await verifyAsAdmin(browser, 'U03_settings_danger', async (p) => {
      await openSettingsTab(p, cp2(), TAB.danger);
      await expect(p.getByRole('button', { name: DELETE_ALL_FLOORS, exact: true })).toBeVisible();
      await expect(p.getByRole('button', { name: DELETE_PROJECT, exact: true })).toBeVisible();
    });
  });
});

test.describe('U03 UI verify — SCR-09 floors (CP-2)', () => {
  test('U03 · SCR-09 floors, table + section cut', async ({ browser }) => {
    await verifyAsAdmin(browser, 'U03_floors_list', async (p) => {
      await openFloors(p, cp2());
      await expect(p.getByRole('region', { name: SECTION_LABEL, exact: true })).toBeVisible();
    });
  });

  test('U03 · SCR-09 floors, section cut collapsed', async ({ browser }) => {
    await verifyAsAdmin(browser, 'U03_floors_collapsed', async (p) => {
      await openFloors(p, cp2());
      await p.getByRole('button', { name: COLLAPSE_SECTION, exact: true }).click();
      await expect(p.getByRole('button', { name: EXPAND_SECTION, exact: true })).toBeVisible();
      await expect(p.getByRole('region', { name: SECTION_LABEL, exact: true })).toHaveCount(0);
    });
  });

  test('U03 · SCR-09 floors, band click → row selected + "Nhân bản tầng"', async ({ browser }) => {
    await verifyAsAdmin(browser, 'U03_floors_row_selected', async (p) => {
      const [first] = await openFloors(p, cp2());
      // `bandLabel` = "{name} · {height}" (phase03_pipeline.spec.ts SCR-09 section case).
      await p
        .getByRole('region', { name: SECTION_LABEL, exact: true })
        .getByRole('button', { name: new RegExp(`^${escapeRegExp(first ?? '')} · `, 'u') })
        .click();
      await expect(floorRows(p).first()).toHaveAttribute('aria-selected', 'true');
      await expect(p.getByRole('button', { name: DUPLICATE_SELECTED, exact: true })).toBeVisible();
    });
  });

  test('U03 · SCR-09 floors, "Nhân bản tầng" → inline confirm (not confirmed)', async ({ browser }) => {
    await verifyAsAdmin(browser, 'U03_floors_duplicate_confirm', async (p) => {
      const [first] = await openFloors(p, cp2());
      await p
        .getByRole('region', { name: SECTION_LABEL, exact: true })
        .getByRole('button', { name: new RegExp(`^${escapeRegExp(first ?? '')} · `, 'u') })
        .click();
      await p.getByRole('button', { name: DUPLICATE_SELECTED, exact: true }).click();
      const confirm = p.getByRole('button', { name: CONFIRM_DUPLICATE, exact: true });
      await expect(confirm).toBeVisible();
      await expect(p.getByLabel(COPY_FURNITURE).first()).toBeVisible();
      // BUG-264: run-18 shot a plain table because the inline confirm sat past the table's `overflow-auto` edge
      // (FloorTable.tsx:246). Since FIX-1284 it spans the row's last five cells (FloorTableRow.tsx:335-350) and the rows
      // stack while the section cut is open or below 1024 px, but the row can still be below the fold: scroll it in and
      // require it on screen, the shot is taken in this state.
      await confirm.scrollIntoViewIfNeeded();
      await expect(confirm).toBeInViewport();
    });
  });

  test('U03 · SCR-09 floors, "Tự động tính cao độ" off → elevation inputs', async ({ browser }) => {
    await verifyAsAdmin(browser, 'U03_floors_manual_elevation', async (p) => {
      await openFloors(p, cp2());
      const auto = p.getByRole('switch', { name: AUTO_ELEVATION, exact: true });
      const elevationInputs = p.getByRole('textbox', { name: /^Cao độ tầng /u });
      // BUG-264: the switch starts off (useFloorManager.ts:516), so "off" alone is the plain table. Prove the switch
      // drives the inputs: on → elevations are read-only text (FloorTableRow.tsx:278), then off → inputs again (the shot).
      if ((await auto.getAttribute('aria-checked')) !== 'true') await auto.click();
      await expect(auto).toHaveAttribute('aria-checked', 'true');
      await expect(elevationInputs).toHaveCount(0);
      await auto.click();
      await expect(auto).toHaveAttribute('aria-checked', 'false');
      await expect(elevationInputs.first()).toBeVisible();
      // BUG-264 (run-20): "off" alone still shoots like the plain table, so focus the first elevation field — the shot shows
      // a field taking manual input. Focus without typing commits nothing (useNumericField.ts handleBlur: only `isTyping`).
      await elevationInputs.first().focus();
      await expect(elevationInputs.first()).toBeFocused();
    });
  });

  test('U03 · SCR-09 floors, row menu "Thao tác khác cho tầng …" open', async ({ browser }) => {
    await verifyAsAdmin(browser, 'U03_floors_row_menu', async (p) => {
      const [first] = await openFloors(p, cp2());
      await p.getByRole('button', { name: `Thao tác khác cho tầng ${first ?? ''}`, exact: true }).click();
      await settled(p.getByRole('menuitem', { name: HIDE_IN_3D, exact: true }));
    });
  });

  test('U03 · SCR-09 floors, "Ẩn khỏi mô hình 3D" → row faded (session only)', async ({ browser }) => {
    await verifyAsAdmin(browser, 'U03_floors_hidden_in_3d', async (p) => {
      const [first] = await openFloors(p, cp2());
      await p.getByRole('button', { name: `Thao tác khác cho tầng ${first ?? ''}`, exact: true }).click();
      await p.getByRole('menuitem', { name: HIDE_IN_3D, exact: true }).click();
      // The click fades the row (`opacity-50`) and dashes its band (FloorSectionCut.tsx), and only now adds HIDE_3D_NOTICE
      // to the "chưa được lưu" strip (`unsupportedNotices` needs a hidden floor, useFloorManager.ts:1655-1664, BUG-287).
      await expect(p.locator('tr.opacity-50')).toHaveCount(1);
      await expect(p.getByText(HIDE_3D_NOTICE, { exact: false }).first()).toBeVisible();
    });
  });
});

test.describe('U03 UI verify — SCR-10 upload (CP-2)', () => {
  test('U03 · SCR-10 upload, drop zone + floor cards', async ({ browser }) => {
    await verifyAsAdmin(browser, 'U03_upload_cards', async (p) => {
      await openUpload(p, cp2());
      await expect(p.locator('[data-floor-id]').first()).toBeVisible();
    });
  });

  test('U03 · SCR-10 upload, "Bắt đầu xử lý" with a file-less floor → block notice', async ({ browser }) => {
    await verifyAsAdmin(browser, 'U03_upload_blocked', async (p) => {
      await openUpload(p, cp2());
      await expect(p.locator('[data-floor-id]').first()).toBeVisible();
      await p.getByRole('button', { name: START_PROCESSING, exact: true }).click();
      await expect(p.getByTestId(BLOCK_NOTICE)).toContainText(BLOCKED_TITLE);
    });
  });

  test('U03 · SCR-10 upload, PNG not matched to a floor → "Tệp chưa gán tầng" (not assigned)', async ({ browser }) => {
    const drawing = process.env.E2E_DRAWING_PNG?.trim() ?? '';
    test.skip(drawing === '', 'environment: E2E_DRAWING_PNG is not set (qa.config.json env.vars)');
    const inits: string[] = [];
    await verifyAsAdmin(
      browser,
      'U03_upload_tray_unassigned',
      async (p) => {
        await openUpload(p, cp2());
        await p.getByTestId(FILE_INPUT).setInputFiles(drawing);
        const tray = p.getByRole('region', { name: TRAY_TITLE, exact: true });
        await expect(tray).toBeVisible();
        // BUG-301: scoped to the tray — a floor card that already holds a drawing has its own "Gán cho tầng khác"
        // picker (FloorUploadCard.tsx), and CP-2 has one after the main layer. The tray item: picker + remove (FloorUploadTray.tsx).
        await expect(tray.getByRole('combobox', { name: ASSIGN_FLOOR })).toBeVisible();
        await expect(tray.getByRole('button', { name: /^Xoá bản vẽ /u })).toBeVisible();
      },
      {},
      (page) =>
        page.on('request', (request) => {
          if (request.method() === 'POST' && /\/drawings\/uploads$/u.test(new URL(request.url()).pathname)) inits.push(request.url());
        }),
    );
    expect(inits, 'an unassigned file never inits an upload').toEqual([]);
  });

  test('U03 · SCR-10 upload, .txt → rejection on the attachment', async ({ browser }, testInfo) => {
    const txt = testInfo.outputPath('khong-phai-ban-ve.txt');
    writeFileSync(txt, 'not a drawing\n', 'utf8');
    await verifyAsAdmin(browser, 'U03_upload_rejected', async (p) => {
      await openUpload(p, cp2());
      await p.getByTestId(FILE_INPUT).setInputFiles(txt);
      await expect(p.getByRole('region', { name: TRAY_TITLE, exact: true }).getByText(REJECTED)).toBeVisible();
    });
  });
});

test.describe('U03 UI verify — SCR-11 quality gate (CP-2, needs CP-4)', () => {
  test('U03 · SCR-11 quality, report', async ({ browser }) => {
    await verifyAsAdmin(
      browser,
      'U03_quality_report',
      async (p) => {
        await openQualityReport(p);
      },
    );
  });

  test('U03 · SCR-11 quality, "Chọn góc thủ công" → corner handles', async ({ browser }) => {
    await verifyAsAdmin(
      browser,
      'U03_quality_corners',
      async (p) => {
        await openQualityReport(p);
        const pick = p.getByRole('button', { name: PICK_CORNERS, exact: true });
        test.skip((await pick.count()) === 0, 'data: no finding offers "Chọn góc thủ công" for this drawing');
        await pick.click();
        await expect(p.getByRole('group', { name: CORNER_GROUP, exact: true })).toBeVisible();
      },
    );
  });
});

/*
 * BUG-364: the env drawing is straight, so CP-2 never shows "Tự động nắn" nor a "poor" metric (run-23: both cases skipped
 * on `data:`). These two states run on a project of their own whose drawing is the env PNG turned 8° (support/drawingSeed.ts):
 * SKEW_DETECTED gives "Tự động nắn", 8° ≥ 5° is "poor" and brings the acknowledgement checkbox. Neither is confirmed.
 */
test.describe('U03 UI verify — SCR-11 quality gate, skewed drawing (this file uploads it)', () => {
  let admin: APIRequestContext | undefined;
  let seeded: SeededDrawing | undefined;

  test.beforeAll(async ({ browser }, testInfo) => {
    const drawing = process.env.E2E_DRAWING_PNG?.trim() ?? '';
    test.skip(drawing === '', 'environment: E2E_DRAWING_PNG is not set (qa.config.json env.vars)');
    testInfo.setTimeout(PIPELINE_TIMEOUT_MS + 60_000);
    const { email, password } = readAdminCredentials();
    admin = await signedInApi(email, password);
    seeded = await createSkewedDrawingProject(admin, 'u03-skew', await rotatedPng(browser, drawing, SKEW_DEG));
  });

  test.afterAll(async () => {
    try {
      const failure = admin && seeded ? await deleteSeededProject(admin, seeded.projectId) : null;
      if (failure !== null) test.info().annotations.push({ type: 'cleanup', description: failure });
    } finally {
      await admin?.dispose();
    }
  });

  const skewed = (): string => {
    if (seeded === undefined) throw new Error('setup: the skewed-drawing project was not created');
    return seeded.projectId;
  };

  test('U03 · SCR-11 quality, "Tự động nắn" → confirm dialog (not confirmed)', async ({ browser }) => {
    await verifyAsAdmin(
      browser,
      'U03_quality_straighten_dialog',
      async (p) => {
        await openQualityReport(p, skewed());
        await p.getByRole('button', { name: STRAIGHTEN, exact: true }).click();
        await settled(p.getByRole('dialog', { name: STRAIGHTEN_DIALOG }));
      },
    );
  });

  test('U03 · SCR-11 quality, "Tiếp tục xử lý" without the acknowledgement → hint', async ({ browser }) => {
    await verifyAsAdmin(
      browser,
      'U03_quality_ack_blocked',
      async (p) => {
        await openQualityReport(p, skewed());
        // A "poor" metric renders the checkbox; without it "Tiếp tục xử lý" would leave for /pipeline.
        await expect(p.getByRole('checkbox', { name: ACK_LABEL, exact: true })).toBeVisible();
        await p.getByRole('button', { name: CONTINUE, exact: true }).click();
        await expect(p.getByText(ACK_BLOCKED, { exact: true })).toBeVisible();
      },
    );
  });
});

test.describe('U03 UI verify — SCR-12 processing (CP-2, needs CP-5)', () => {
  test('U03 · SCR-12 processing, run finished ("Đã xong N/N tầng")', async ({ browser }) => {
    await verifyAsAdmin(browser, 'U03_pipeline_done', openPipelineDone);
  });

  test('U03 · SCR-12 processing, "Nhật ký" tab', async ({ browser }) => {
    await verifyAsAdmin(browser, 'U03_pipeline_log', async (p) => {
      await openPipelineDone(p);
      await p.getByRole('tablist', { name: PIPELINE_TABS, exact: true }).getByRole('tab', { name: LOG_TAB, exact: true }).click();
      await expect(p.getByRole('log')).toBeVisible();
    });
  });

  test('U03 · SCR-12 processing, step detail open', async ({ browser }) => {
    await verifyAsAdmin(browser, 'U03_pipeline_step_detail', async (p) => {
      await openPipelineDone(p);
      const open = p.getByRole('button', { name: new RegExp(`^${OPEN_DETAIL} `, 'u') }).first();
      // A step only offers the button when it has detail lines (`ProcessingStepList.tsx` hasDetail).
      // Confirmed product gap, not data (BUG-364): the real gateway answers `stepDetails` unsupported
      // (processingGateway.ts PROCESSING_MISSING_CAPABILITIES, `readStepDetails` → unsupported), so `detailLabels` is always
      // empty and no step offers the button. The case runs by itself once that endpoint is wired.
      test.skip((await open.count()) === 0, 'product: step details not wired (processingGateway.ts stepDetails unsupported)');
      const step = ((await open.getAttribute('aria-label')) ?? '').slice(OPEN_DETAIL.length + 1);
      await open.click();
      await expect(p.getByRole('button', { name: `${CLOSE_DETAIL} ${step}`, exact: true })).toHaveAttribute('aria-expanded', 'true');
    });
  });
});

test.describe('U03 UI verify — SCR-13 / SCR-15 (CP-2)', () => {
  test('U03 · SCR-13 pipeline graph, empty (F-06)', async ({ browser }) => {
    await verifyAsAdmin(browser, 'U03_graph_empty', async (p) => {
      await p.goto(ROUTES.project.pipelineGraph(cp2()));
      await expect(p.getByText(GRAPH_EMPTY, { exact: true })).toBeVisible({ timeout: 15_000 });
    });
  });

  test.describe('SCR-15 on a CP-2 floor', () => {
    let floorId = '';

    test.beforeAll(async () => {
      const work = readState().floors.workFloorId;
      if (work !== null) {
        floorId = work;
        return;
      }
      const { email, password } = readAdminCredentials();
      const admin = await signedInApi(email, password);
      try {
        const res = await admin.get(`${PROJECTS_PATH}/${cp2()}/floors`);
        expect(res.status(), 'setup: GET /api/projects/:id/floors').toBe(200);
        const rows = (await res.json()) as readonly { readonly id?: unknown }[];
        const first = rows.find((row) => typeof row.id === 'string');
        if (first === undefined) throw new Error('setup: CP-2 has no floor');
        floorId = String(first.id);
      } finally {
        await admin.dispose();
      }
    });

    test('U03 · SCR-15 CAD confirm, "Phát hiện tệp CAD" dialog', async ({ browser }) => {
      await verifyAsAdmin(browser, 'U03_cad_dialog', async (p) => {
        await p.goto(ROUTES.project.cadConfirm(cp2(), floorId));
        await settled(p.getByRole('dialog', { name: CAD_DIALOG, exact: true }));
      });
    });

    test('U03 · SCR-15 CAD confirm, "Huỷ" → no named layers (F-07)', async ({ browser }) => {
      await verifyAsAdmin(browser, 'U03_cad_empty', async (p) => {
        await p.goto(ROUTES.project.cadConfirm(cp2(), floorId));
        const dialog = p.getByRole('dialog', { name: CAD_DIALOG, exact: true });
        await expect(dialog).toBeVisible({ timeout: 15_000 });
        await dialog.getByRole('button', { name: CANCEL, exact: true }).click();
        await expect(dialog).toHaveCount(0);
        await expect(p.getByText(CAD_EMPTY, { exact: true }).first()).toBeVisible();
      });
    });
  });
});

/* ========================================================================== */
/* Empty states + long name on a project this file creates (no floors)        */
/* ========================================================================== */

test.describe('U03 UI verify — empty project with an 80-character name (this file creates it)', () => {
  let admin: APIRequestContext | undefined;
  let projectId = '';

  test.beforeAll(async () => {
    const { email, password } = readAdminCredentials();
    admin = await signedInApi(email, password);
    // BE #25 (apps/api/projects/schemas.py ProjectCreateIn): no `floors` → a project with no floor.
    const res = await admin.post(PROJECTS_PATH, { data: { name: LONG_NAME } });
    expect(res.status(), 'setup: POST /api/projects').toBe(201);
    const body = (await res.json()) as { id?: unknown; name?: unknown };
    // Recorded BEFORE the checks below, so `afterAll` deletes it even if one fails (phase02).
    if (typeof body.id === 'string') projectId = body.id;
    expect(body.name, 'setup: the server kept the 80-char name').toBe(LONG_NAME);
  });

  test.afterAll(async () => {
    try {
      if (admin && projectId !== '') {
        const res = await admin.delete(`${PROJECTS_PATH}/${projectId}`);
        if (res.status() !== 200) test.info().annotations.push({ type: 'cleanup', description: `DELETE project → ${res.status()}` });
      }
    } catch (error) {
      test.info().annotations.push({ type: 'cleanup', description: String(error) });
    } finally {
      await admin?.dispose();
    }
  });

  const ownProject = (): string => {
    if (projectId === '') throw new Error('setup: the empty project was not created');
    return projectId;
  };

  test('U03 · SCR-08 settings, 80-character project name (long data)', async ({ browser }) => {
    await verifyAsAdmin(browser, 'U03_settings_long_name', async (p) => {
      await openSettingsTab(p, ownProject(), TAB.general);
      await expect(p.getByRole('textbox', { name: NAME_LABEL, exact: true })).toHaveValue(LONG_NAME);
    });
  });

  test('U03 · SCR-08 settings, "Vùng nguy hiểm" with no floor', async ({ browser }) => {
    await verifyAsAdmin(browser, 'U03_settings_danger_no_floors', async (p) => {
      await openSettingsTab(p, ownProject(), TAB.danger);
      await expect(p.getByText(DANGER_NO_FLOORS, { exact: true })).toBeVisible();
      await expect(p.getByRole('button', { name: DELETE_PROJECT, exact: true })).toBeVisible();
    });
  });

  test('U03 · SCR-08 settings, "Xoá dự án" → confirm dialog with the long name (not confirmed)', async ({ browser }) => {
    await verifyAsAdmin(browser, 'U03_settings_delete_dialog', async (p) => {
      await openSettingsTab(p, ownProject(), TAB.danger);
      await p.getByRole('button', { name: DELETE_PROJECT, exact: true }).click();
      const dialog = p.getByRole('dialog', { name: DELETE_DIALOG_TITLE, exact: true });
      await settled(dialog);
      await expect(dialog.getByLabel(DELETE_CONFIRM_FIELD)).toBeVisible();
      await expect(dialog.getByRole('button', { name: KEEP, exact: true })).toBeVisible();
    });
  });

  test('U03 · SCR-09 floors, no floor → empty state', async ({ browser }) => {
    await verifyAsAdmin(browser, 'U03_floors_empty', async (p) => {
      await p.goto(ROUTES.project.floors(ownProject()));
      await expect(p.getByText(FLOORS_EMPTY_TITLE, { exact: true })).toBeVisible({ timeout: 15_000 });
      await expect(p.getByText(FLOORS_EMPTY_NOTICE, { exact: true })).toBeVisible();
    });
  });

  test('U03 · SCR-10 upload, no floor → "Dự án chưa có tầng nào" + "Thêm tầng" + long name in the breadcrumb', async ({ browser }) => {
    await verifyAsAdmin(browser, 'U03_upload_no_floors', async (p) => {
      // No `openUpload`: with no floor there is no drop zone to wait for (useFloorUploadScreen.ts:437 canDrop,
      // FloorUploadScreen.tsx:229-235); the empty state offers "Thêm tầng" instead (FloorUploadScreen.tsx:160-166,
      // FIX-1400 / BUG-298).
      await p.goto(ROUTES.project.upload(ownProject()));
      await expect(p.getByText(UPLOAD_NO_FLOORS, { exact: true })).toBeVisible({ timeout: 15_000 });
      await expect(p.getByRole('button', { name: UPLOAD_ADD_FLOORS, exact: true })).toBeVisible();
      await expect(p.getByTestId(DROPZONE)).toHaveCount(0);
      // FIX-1304 (BUG-165): a deep link reads #24 for the name (useFloorUploadScreen.ts:362-373); the breadcrumb level
      // cuts it with "…" and keeps it whole in `title` (Breadcrumb.tsx:129-134).
      await expect(
        p.getByRole('navigation', { name: BREADCRUMB_NAV, exact: true }).getByTitle(LONG_NAME, { exact: true }),
      ).toHaveText(LONG_NAME);
    });
  });

  test('U03 · SCR-11 quality, no drawing → empty state', async ({ browser }) => {
    await verifyAsAdmin(browser, 'U03_quality_no_drawing', async (p) => {
      await p.goto(ROUTES.project.quality(ownProject()));
      await expect(p.getByText(NO_DRAWING_TITLE, { exact: true })).toBeVisible({ timeout: 15_000 });
    });
  });

  test('U03 · SCR-12 processing, no run → empty state + long name in the breadcrumb', async ({ browser }) => {
    await verifyAsAdmin(browser, 'U03_pipeline_empty', async (p) => {
      await p.goto(ROUTES.project.pipeline(ownProject()));
      await expect(p.getByText(PIPELINE_EMPTY, { exact: true })).toBeVisible({ timeout: 15_000 });
      const breadcrumb = p.getByRole('navigation', { name: PIPELINE_NAV, exact: true });
      await expect(breadcrumb).toBeVisible();
      // FIX-1304 (BUG-165): a deep link reads #24 for the name (useProcessingScreen.ts:561-572), cut with "…", whole in
      // `title` (ProcessingScreen.tsx:226-232).
      await expect(breadcrumb.getByTitle(LONG_NAME, { exact: true })).toHaveText(LONG_NAME);
    });
  });
});

function escapeRegExp(text: string): string {
  return text.replace(/[.*+?^${}()|[\]\\]/gu, '\\$&');
}
