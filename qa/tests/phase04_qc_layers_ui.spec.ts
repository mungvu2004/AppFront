/**
 * Phase 4 — dedicated UI-verification cases (skill `qa-verify-ui`): one test per visible state of SCR-16 (walls),
 * SCR-17 (objects), SCR-18 (dimension OCR), SCR-19 (axes), SCR-20 (rooms), SCR-21 (thickness), SCR-14 (scale) and
 * SCR-22 (overlay), each at 1440 / 1024 / 768 / 375 (`support/ui-verify.ts`), evidence `U04_<state>_<width>.png` +
 * `U04_<state>.json`. Reviewed by the "verify ui" step with the qa-review-ui checklist. Models: `phase01_auth_ui.spec.ts`,
 * `phase03_pipeline_ui.spec.ts` (helpers `verifyAsAdmin` / `settled` copied from there).
 *
 * Data:
 *   - BUG-323: walls, objects, axes, rooms and thickness states run on the test's OWN project (`qa-<runId>-u04-…`, one floor),
 *     created through the API and its layer written through #35 (`support/layerSeed.ts` qcLayer) before the page opens,
 *     deleted in `finally` (`verifySeeded`). They never read Phase 3, so they reach their state whatever CP-5 did.
 *   - Only the states that need the pipeline output read Phase 3's CP-5 work floor (`project.projectId` +
 *     `floors.workFloorId`): dimensions (OCR), scale (the warped drawing), overlay (the source scan). `verifyOnWorkFloor`
 *     SKIPS them with an `Environment:` reason when CP-5 is not recorded or that floor's GET …/spatial/layer is not 200
 *     (run-22: CP-5 recorded, 404 — BUG-346); a state whose rows the floor lacks (fake ML) SKIPS with a `data:` reason.
 *   - One run-unique project with an 80-character name and ONE floor with a 65-character name (`qa-<runId>-u04-…`),
 *     created through the API before its group and deleted after it. Its floor has no drawing and no layer: GET
 *     `…/spatial/layer` answers an empty document (BE apps/api/spatial_read/router.py:71-86 `empty_document`), so every
 *     screen shows its empty state there — with the long names in floor nav / floor select. Scale and overlay read the
 *     floor's drawing, which it lacks: scale shows its `error` notice (NOT_FOUND), overlay "Không đọc được ảnh bản vẽ gốc…".
 *
 * Budget — logins: 1 real admin API login (`signedInApi`, empty-project group; again after a failed test, which starts a new
 * worker); a browser login only to replace a dead stored session (`ensureAdminSession`). The seeded and work-floor states
 * take their fixture token from their own context (`layerApiOf`, 1 refresh, no login). Writes through the API only: the
 * empty project (1 `POST /api/projects` with 1 floor, BE #25 `floors`, + 1 DELETE) and 14 seeded projects (each 1 POST +
 * 1 #35 PUT + 1 DELETE, no rate limit) — every test also asserts that the browser sent NO non-GET request under
 * `/api/projects/` (`verifyIn` guard):
 *   - selection, filters, "Thu gọn hai panel", "Thông số nâng cao", "Lọc theo loại", keyboard mode, "Thu gọn bảng" are view
 *     state; "Thêm trục ngang" is in memory only (F-08, `useAxisGridManager.ts` persistAxisGrid unsupported);
 *   - dialogs are opened and never confirmed: "Xem trước chuẩn hoá tên", "Gộp hai phòng", "Áp tỉ lệ này cho N tầng…"
 *     (only GET floors + GET spatial, phase04_qc_layers.spec.ts SCR-14 all-floors case), thickness "Xem trước" (the PUT
 *     is "Áp dụng", never clicked); the reference line is drawn and its length typed, "Áp dụng tỷ lệ" is not clicked
 *     for this-floor scope.
 * Sessions: every test opens its OWN context from Phase 1's admin storage state and writes the rotated refresh cookie back
 * in `finally` (phase03 chain): 31 tests × (4 loads + 1 session check) + at most 15 fixture tokens (14 seeded tests + 1
 * work-floor probe) = 170 `POST /api/auth/refresh` over several minutes (`auth_refresh_total` 300 / 60 s per sid).
 * BUG-347: actions inside `open` time out after 10 s (`OPEN_ACTION_TIMEOUT_MS`), so a control pushed off-screen at one
 * width costs 10 s, not the 30 s ACTION_TIMEOUT_MS, before `verifyUi` records it as `openError`.
 * No faked response: every state is the real stack. Non-serial: each test uses its own context and page.
 * G6: the editor tour only mounts on the walls screen (`EditorTourContainer hostId="wall-layer-review"`); it is dismissed
 * with the product's own "Bỏ qua hướng dẫn" (`e2e/fixtures/tour.ts`). BUG-143: framer-motion overlays end with `settled()`.
 */
import { expect, test, type APIRequestContext, type Browser, type BrowserContext, type Locator, type Page } from '@playwright/test';

import { ROUTES } from '../../e2e/fixtures/routes';
import { TOUR_APPEAR_TIMEOUT_MS, dismissTour } from '../../e2e/fixtures/tour';
import { NAVIGATION_TIMEOUT_MS, readBaseUrl } from '../../e2e/fullstack/env';
import { signedInApi } from './support/api';
import { ensureAdminSession, readAdminCredentials } from './support/auth';
import { TEST_DATA_PREFIX } from './support/evidence';
import { createQcProject, deleteProject, layerApiOf, layerStatus } from './support/layerSeed';
import { ADMIN_STORAGE_STATE_FILE, readState } from './support/state';
import { UI_VIEWPORTS, verifyUi } from './support/ui-verify';

/* Copy — every string checked in src/ (file noted). */
/* SCR-16: WallLayerReview.tsx, WallLayerList.tsx, WallLayerInspector.tsx, WallLayerLeftPanel.tsx, WallLayerToolRail.tsx. */
const WALLS_SCREEN = 'Duyệt lớp tường';
const WALL_LIST = 'Danh sách đoạn tường';
const WALLS_EMPTY_TITLE = 'Chưa có đoạn tường nào'; // WallLayerList.tsx:59
const WALLS_EMPTY_NOTICE =
  'Chưa phát hiện được đoạn tường nào ở tầng này. Bạn có thể vẽ tường thủ công bằng phím W, hoặc chạy lại với ngưỡng thấp hơn.'; // useWallLayerReview.ts:204
const APPROVE_WALL = 'Duyệt đoạn này';
const WALL_ADVANCED = 'Thông số nâng cao';
const WALL_LOW_CONFIDENCE = 'Chỉ hiện độ tin cậy thấp'; // phase04_qc_layers.spec.ts view-controls case
const WALL_NO_MATCH = 'Không có đoạn tường nào khớp bộ lọc đang bật. Bỏ bớt một bộ lọc để thấy lại danh sách.';
const COLLAPSE_PANELS = 'Thu gọn hai panel';
const EXPAND_PANELS = 'Mở lại hai panel';
const FLOOR_NAV = 'Tầng của bản vẽ';
/* SCR-17: ObjectLayerReview.tsx, ObjectLayerList.tsx, ObjectLayerInspector.tsx, ObjectLayerLeftPanel.tsx. */
const OBJECTS_SCREEN = 'Lớp đối tượng';
const OBJECT_LIST = 'Danh sách đối tượng';
const OBJECTS_EMPTY_TITLE = 'Chưa nhận ra đối tượng nào';
const OBJECTS_EMPTY_ACTION = 'Thêm thủ công';
const APPROVE_OBJECT = 'Duyệt đối tượng này';
const OBJECT_FILTER = 'Lọc theo loại';
/* SCR-18: dimensionOcrText.ts. */
const DIMS_SCREEN = 'Đọc kích thước OCR';
const DIM_LIST = 'Danh sách kích thước đọc được';
const DIMS_EMPTY_TITLE = 'Chưa đọc được chuỗi kích thước nào';
const DIMS_COMPARE_BAR = 'Thanh so sánh với hình học';
const KEYBOARD_ON = 'Bật chế độ duyệt bàn phím';
const KEYBOARD_OFF = 'Tắt chế độ duyệt bàn phím';
const KEYBOARD_CAPTION = 'Chế độ duyệt bàn phím — đường nhanh nhất để đi qua danh sách kích thước';
/* SCR-19: AxisGridManager.tsx, useAxisGridManager.ts:155. */
const GRIDS_SCREEN = 'Quản lý trục và gốc toạ độ';
const GRIDS_EMPTY_TITLE = 'Chưa có trục nào';
const ADD_HORIZONTAL_AXIS = 'Thêm trục ngang';
const AXIS_ROW = /^Trục (.+?), cách trục kế là /u; // phase04_qc_layers.spec.ts AXIS_LABEL_PATTERN
/* SCR-20: RoomLabelReview.tsx, RoomLabelList.tsx, RoomLabelInspector.tsx, RoomLabelNormalizePreview.tsx, RoomLabelActionDialogs.tsx. */
const ROOMS_SCREEN = 'Duyệt tên phòng';
const ROOM_LIST = 'Danh sách phòng';
const ROOMS_EMPTY_TITLE = 'Chưa dò ra phòng nào';
const APPROVE_ROOM = 'Duyệt phòng này';
const NORMALIZE = 'Chuẩn hoá tên';
const NORMALIZE_DIALOG = 'Xem trước chuẩn hoá tên';
const MERGE_ROOM = 'Gộp phòng';
const MERGE_DIALOG = 'Gộp hai phòng';
/* SCR-21: ThicknessStandardization.tsx, ThicknessGroupTable.tsx, ThicknessApplyBar.tsx. */
const THICKNESS_TITLE = 'Chuẩn hoá độ dày tường';
const THICKNESS_EMPTY_TITLE = 'Chưa có đoạn tường nào để chuẩn hoá';
const THICKNESS_ACCEPT = /^Đồng ý chuẩn hoá \d+ tường /u;
const THICKNESS_PREVIEW = 'Xem trước';
const THICKNESS_APPLY = 'Áp dụng'; // never clicked
/* SCR-14: ScaleCalibration.tsx, ScaleCalibrationPanel.tsx, ScaleCalibrationCanvas.tsx, useScaleCalibration.ts COPY. */
const SCALE_SCREEN = 'Màn hiệu chỉnh tỷ lệ';
const SCALE_PANEL_TITLE = 'Hiệu chỉnh tỷ lệ';
const SCALE_NOTICE = 'Trạng thái của màn hiệu chỉnh tỷ lệ';
const SCALE_COLLAPSE = 'Thu gọn bảng';
const SCALE_EXPAND = 'Bung bảng';
const SCALE_CANVAS = 'Bản vẽ đã nắn, kéo để vẽ đường tham chiếu';
const SCALE_DRAWING_ALT = /^Bản vẽ đã nắn của /u; // useScaleCalibration.ts:165,1657
const SCALE_METHODS = 'Chọn cách xác định tỷ lệ';
const SCALE_REFERENCE = 'Vẽ đường tham chiếu';
const SCALE_HANDLE_START = 'Đầu đoạn tham chiếu, dùng phím mũi tên để nhích';
const SCALE_REAL_LENGTH = 'Chiều dài thật';
const SCALE_COMPUTATION = 'Phép tính ra tỷ lệ';
const SCALE_SCOPE = 'Phạm vi áp tỷ lệ';
const SCALE_ALL_FLOORS = 'Áp cho mọi tầng';
const SCALE_APPLY = 'Áp dụng tỷ lệ';
const SCALE_ALL_FLOORS_DIALOG = /^Áp tỉ lệ này cho \d+ tầng có bản vẽ\?$/u;
/* SCR-22: OverlayComparison.tsx, OverlayComparisonToolbar.tsx, OverlayComparisonPanel.tsx, useOverlayComparison.ts COPY. */
const OVERLAY_SCREEN = 'Màn đối chiếu bản vẽ';
const OVERLAY_TOOLBAR = 'Thanh công cụ đối chiếu bản vẽ';
const OVERLAY_PANEL = 'Kết quả đối chiếu bản vẽ và mô hình';
const OVERLAY_LOADING = 'Đang tải ảnh bản vẽ gốc.';
const OVERLAY_NO_SCAN = 'Tầng này nhập từ CAD nên không có ảnh bản vẽ gốc để đối chiếu.'; // useOverlayComparison.ts:109,766
/** A floor with no drawing: the scan read fails → state `error` (useOverlayComparison.ts:111,584,762). */
const OVERLAY_READ_FAILED = 'Không đọc được ảnh bản vẽ gốc của tầng này.';
const OVERLAY_MODES = 'Kiểu đối chiếu';
const OVERLAY_SWIPE = 'Trượt';
const OVERLAY_DIVIDER = 'Đường chia đôi, dùng phím mũi tên trái và phải để dịch';

const PROJECTS_PATH = '/api/projects';
const NAME_MAX_LENGTH = 80;
/** Exactly 80 chars, run-unique: `qa-<runId>-u04-<base36 time> ` + Vietnamese filler, ending in a letter. */
const LONG_NAME = `${`${TEST_DATA_PREFIX}u04-${Date.now().toString(36)} ${'Khu phức hợp văn phòng Bình Minh '.repeat(4)}`.slice(0, NAME_MAX_LENGTH - 1)}A`;
if (LONG_NAME.length !== NAME_MAX_LENGTH) throw new Error(`LONG_NAME is ${LONG_NAME.length} chars`);
/** 65 chars; the FE sets no floor-name cap, the BE draft name only `min_length=1` (projects/schemas.py:54). */
const LONG_FLOOR_NAME = 'Tầng kỹ thuật mái và phòng máy bơm nước sinh hoạt khu B phía Đông';

/* ---- helpers ---- */

/** A floor a state opens on: this test's seeded one, or Phase 3's CP-5 work floor. */
interface Floor {
  readonly projectId: string;
  readonly floorId: string;
}
type Shot = { readonly fullPage?: boolean };

/** BUG-347: an action in `open` that cannot happen (control off-screen) fails fast; navigation keeps its own timeout. */
const OPEN_ACTION_TIMEOUT_MS = 10_000;

/** Own context from the admin storage state; the rotated refresh cookie goes back to the file (phase03 `verifyAsAdmin`). */
async function inAdminContext(browser: Browser, body: (context: BrowserContext) => Promise<void>): Promise<void> {
  const context = await browser.newContext({ baseURL: readBaseUrl(), storageState: ADMIN_STORAGE_STATE_FILE });
  try {
    await ensureAdminSession(context, ADMIN_STORAGE_STATE_FILE);
    await body(context);
  } finally {
    await context.storageState({ path: ADMIN_STORAGE_STATE_FILE });
    await context.close();
  }
}

/** `verifyUi` on a new page of `context`, recording every non-GET request under `/api/projects/`: a UI case never writes. */
async function verifyIn(context: BrowserContext, name: string, open: (page: Page) => Promise<void>, shot: Shot): Promise<void> {
  const page = await context.newPage();
  page.setDefaultTimeout(OPEN_ACTION_TIMEOUT_MS);
  page.setDefaultNavigationTimeout(NAVIGATION_TIMEOUT_MS);
  const writes: string[] = [];
  page.on('request', (request) => {
    const path = new URL(request.url()).pathname;
    if (request.method() !== 'GET' && path.startsWith(`${PROJECTS_PATH}/`)) writes.push(`${request.method()} ${path}`);
  });
  await verifyUi(page, name, open, UI_VIEWPORTS, shot);
  expect.soft(writes, 'a UI case sends no write under /api/projects/').toEqual([]);
}

async function verifyAsAdmin(browser: Browser, name: string, open: (page: Page) => Promise<void>, shot: Shot = {}): Promise<void> {
  await inAdminContext(browser, (context) => verifyIn(context, name, open, shot));
}

/** BUG-323: a state the layer alone produces, on this test's OWN seeded project (`qcLayer`), deleted in `finally`. */
async function verifySeeded(
  browser: Browser,
  name: string,
  open: (page: Page, floor: Floor) => Promise<void>,
  shot: Shot = {},
): Promise<void> {
  await inAdminContext(browser, async (context) => {
    // Before the first page: the fixture token's refresh rotates the context's cookie (`layerApiOf`).
    const api = await layerApiOf(context);
    const [floor] = await createQcProject(api, name.toLowerCase().replace(/_/gu, '-'));
    if (floor === undefined) throw new Error('setup: the seeded project has no floor');
    try {
      await verifyIn(context, name, (page) => open(page, floor), shot);
    } finally {
      const failed = await deleteProject(api, floor.projectId);
      if (failed !== null) test.info().annotations.push({ type: 'cleanup', description: failed });
    }
  });
}

let workFloorStatus: Promise<number> | undefined;

/**
 * A state that needs the pipeline output (OCR dimensions, the warped drawing, the source scan): Phase 3's CP-5 work floor.
 * SKIPS with an `Environment:` reason when CP-5 is not recorded or that floor's N16 read is not 200 (BUG-346; probed once
 * per worker) — the no-data states are the U04_*_empty / _no_drawing cases.
 */
async function verifyOnWorkFloor(
  browser: Browser,
  name: string,
  open: (page: Page, floor: Floor) => Promise<void>,
  shot: Shot = {},
): Promise<void> {
  const state = readState();
  const floor: Floor = { projectId: state.project.projectId ?? '', floorId: state.floors.workFloorId ?? '' };
  test.skip(
    !state.checkpoints.pipelineComplete || floor.projectId === '' || floor.floorId === '',
    'Environment: CP-5 not recorded by Phase 3 (checkpoints.pipelineComplete / work floor id missing)',
  );
  await inAdminContext(browser, async (context) => {
    workFloorStatus ??= layerApiOf(context).then((api) => layerStatus(api, floor.projectId, floor.floorId));
    const status = await workFloorStatus;
    test.skip(status !== 200, `Environment: CP-5 work floor GET …/spatial/layer answered ${String(status)}, not 200 (no pipeline layer on the stack)`);
    await verifyIn(context, name, (page) => open(page, floor), shot);
  });
}

/** BUG-143: finite animations under `target` done, then its box and opacity hold still for 3 frames (phase03 `settled`). */
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

/** Checkbox / Radio.Item: focus + Space (sr-only input under a drawn box, phase04_qc_layers.spec.ts `pressSpaceOn`). */
async function pressSpaceOn(control: Locator): Promise<void> {
  await control.focus();
  await control.page().keyboard.press('Space');
}

/**
 * Walls screen loaded on `floorId`; the tour (G6) is dismissed. The first call of a test may wait for the tour to mount
 * (`TOUR_APPEAR_TIMEOUT_MS`); skipping it stores "seen" in the context, so the later widths only re-check.
 */
function wallsOpener(): (page: Page, projectId: string, floorId: string) => Promise<void> {
  let tourPending = true;
  return async (page, projectId, floorId) => {
    await page.goto(ROUTES.project.walls(projectId, floorId));
    await expect(page.getByRole('region', { name: WALLS_SCREEN, exact: true })).toBeVisible({ timeout: 15_000 });
    const list = page.getByRole('listbox', { name: WALL_LIST, exact: true }).getByRole('option').first();
    await expect(list.or(page.getByText(WALLS_EMPTY_TITLE, { exact: true }))).toBeVisible({ timeout: 15_000 });
    await dismissTour(page, { waitMs: tourPending ? TOUR_APPEAR_TIMEOUT_MS : 0 });
    tourPending = false;
  };
}

/** Walls of the seeded floor; its first row (qcLayer seeds ten walls, so an empty list fails the open). */
async function openWallsData(page: Page, openWalls: ReturnType<typeof wallsOpener>, floor: Floor): Promise<Locator> {
  await openWalls(page, floor.projectId, floor.floorId);
  const first = page.getByRole('listbox', { name: WALL_LIST, exact: true }).getByRole('option').first();
  await expect(first, 'seeded walls listed').toBeVisible();
  return first;
}

/** A layer screen of the seeded floor, waited for until `ready` (its seeded rows) shows. */
async function openSeeded(page: Page, url: string, ready: Locator): Promise<void> {
  await page.goto(url);
  await expect(ready).toBeVisible({ timeout: 15_000 });
}

/** A layer screen of the CP-5 work floor: waits for `ready` or `empty`, SKIPS when `empty` shows. */
async function openDataOrSkip(page: Page, url: string, ready: Locator, empty: Locator, reason: string): Promise<void> {
  await page.goto(url);
  await expect(ready.or(empty).first()).toBeVisible({ timeout: 15_000 });
  test.skip(await empty.first().isVisible(), `data: ${reason}`);
}

const objectOptions = (page: Page): Locator => page.getByRole('group', { name: OBJECT_LIST, exact: true }).getByRole('option');
const dimOptions = (page: Page): Locator => page.getByRole('group', { name: DIM_LIST, exact: true }).getByRole('option');
const roomOptions = (page: Page): Locator => page.getByRole('listbox', { name: ROOM_LIST, exact: true }).getByRole('option');
const axisRows = (page: Page): Locator => page.getByRole('option', { name: AXIS_ROW });

async function openObjectsData(page: Page, floor: Floor): Promise<void> {
  await openSeeded(page, ROUTES.project.objects(floor.projectId, floor.floorId), objectOptions(page).first());
}

async function openDimsData(page: Page, floor: Floor): Promise<void> {
  await openDataOrSkip(
    page,
    ROUTES.project.dimensions(floor.projectId, floor.floorId),
    dimOptions(page).first(),
    page.getByText(DIMS_EMPTY_TITLE, { exact: true }),
    'OCR read no dimension string on the work floor (fake ML); the empty state is U04_dims_empty',
  );
}

async function openRoomsData(page: Page, floor: Floor): Promise<void> {
  await openSeeded(page, ROUTES.project.rooms(floor.projectId, floor.floorId), roomOptions(page).first());
}

/** N16 sends `axes: []`; the rows are previewed from the seeded load-bearing rectangle (useAxisGridManager.ts:447-458). */
async function openGridsData(page: Page, floor: Floor): Promise<void> {
  await openSeeded(page, ROUTES.project.grids(floor.projectId, floor.floorId), axisRows(page).first());
  await expect(page.getByRole('button', { name: ADD_HORIZONTAL_AXIS, exact: true })).toBeVisible();
}

/** qcLayer's two 200 mm partitions form one group to standardise (the accept box). */
async function openThicknessData(page: Page, floor: Floor): Promise<void> {
  await page.emulateMedia({ reducedMotion: 'reduce' }); // group rows are `motion.tr` (phase04_qc_layers.spec.ts SCR-21)
  await openSeeded(page, ROUTES.project.thickness(floor.projectId, floor.floorId), page.getByRole('checkbox', { name: THICKNESS_ACCEPT }).first());
}

/** Scale screen of the work floor with its drawing; SKIPS when the floor has none (CP-4 not reached). */
async function openScaleData(page: Page, floor: Floor): Promise<void> {
  await page.goto(ROUTES.project.scale(floor.projectId, floor.floorId));
  await expect(page.getByRole('region', { name: SCALE_SCREEN, exact: true })).toBeVisible({ timeout: 15_000 });
  const drawing = page.getByRole('img', { name: SCALE_DRAWING_ALT });
  // Loaded = the drawing, or a notice (loading has no notice, `NOTICE_LEVELS.loading` null).
  await expect(drawing.or(page.getByRole('region', { name: SCALE_NOTICE, exact: true })).first()).toBeVisible({ timeout: 15_000 });
  test.skip((await drawing.count()) === 0, 'data: the work floor has no drawing (CP-4 not reached); the no-drawing state is U04_scale_no_drawing');
}

/** "Vẽ đường tham chiếu"; box-relative drag 20 % → 80 % at 50 %; 5000 + Enter (phase04_qc_layers.spec.ts `openScaleAndDraw`). */
async function drawReferenceLine(page: Page): Promise<void> {
  await page.getByRole('radiogroup', { name: SCALE_METHODS, exact: true }).getByRole('radio', { name: SCALE_REFERENCE, exact: true }).click();
  const canvas = page.getByRole('group', { name: SCALE_CANVAS, exact: true });
  await canvas.scrollIntoViewIfNeeded();
  const box = await canvas.boundingBox();
  if (box === null) throw new Error('scale canvas has no bounding box');
  await page.mouse.move(box.x + box.width * 0.2, box.y + box.height * 0.5);
  await page.mouse.down();
  await page.mouse.move(box.x + box.width * 0.8, box.y + box.height * 0.5, { steps: 8 });
  await page.mouse.up();
  await expect(page.getByRole('button', { name: SCALE_HANDLE_START, exact: true })).toBeVisible();
  const realLength = page.getByLabel(SCALE_REAL_LENGTH, { exact: true });
  await realLength.fill('5000');
  await realLength.press('Enter');
  await expect(page.getByLabel(SCALE_COMPUTATION, { exact: true })).toContainText('mm/px');
}

/** Overlay of the work floor with a scan; SKIPS when the floor has none (CP-4 not reached). */
async function openOverlayData(page: Page, floor: Floor): Promise<void> {
  await page.goto(ROUTES.project.overlay(floor.projectId, floor.floorId));
  await expect(page.getByRole('toolbar', { name: OVERLAY_TOOLBAR, exact: true })).toBeVisible({ timeout: 15_000 });
  await expect(page.getByText(OVERLAY_LOADING, { exact: true })).toHaveCount(0, { timeout: 15_000 });
  test.skip(
    await page.getByText(OVERLAY_NO_SCAN, { exact: true }).or(page.getByText(OVERLAY_READ_FAILED, { exact: true })).first().isVisible(),
    'data: the work floor has no readable source scan (CP-4 not reached); the no-drawing state is U04_overlay_no_drawing',
  );
  await expect(page.getByRole('region', { name: OVERLAY_PANEL, exact: true })).toBeVisible();
}

/* ========================================================================== */
/* Data states: seeded floor per test (BUG-323); pipeline states on CP-5     */
/* ========================================================================== */

test.describe('U04 UI verify — SCR-16 walls (own seeded floor)', () => {
  test('U04 · SCR-16 walls, list', async ({ browser }) => {
    const openWalls = wallsOpener();
    await verifySeeded(browser, 'U04_walls_list', async (p, floor) => {
      await openWallsData(p, openWalls, floor);
      await expect(p.getByRole('navigation', { name: FLOOR_NAV, exact: true })).toBeVisible();
    });
  });

  test('U04 · SCR-16 walls, wall selected → inspector "Đoạn tường"', async ({ browser }) => {
    const openWalls = wallsOpener();
    await verifySeeded(browser, 'U04_walls_selected', async (p, floor) => {
      const first = await openWallsData(p, openWalls, floor);
      await first.click();
      await expect(first).toHaveAttribute('aria-selected', 'true');
      await expect(p.getByRole('button', { name: APPROVE_WALL, exact: true })).toBeVisible();
    });
  });

  test('U04 · SCR-16 walls, "Thông số nâng cao" open', async ({ browser }) => {
    const openWalls = wallsOpener();
    await verifySeeded(browser, 'U04_walls_advanced', async (p, floor) => {
      const first = await openWallsData(p, openWalls, floor);
      await first.click();
      const advanced = p.getByRole('button', { name: WALL_ADVANCED, exact: true });
      await advanced.click();
      await expect(advanced).toHaveAttribute('aria-expanded', 'true');
      await settled(p.locator(`[id="${(await advanced.getAttribute('aria-controls')) ?? ''}"]`));
    });
  });

  test('U04 · SCR-16 walls, "Chỉ hiện độ tin cậy thấp" on', async ({ browser }) => {
    const openWalls = wallsOpener();
    await verifySeeded(browser, 'U04_walls_low_confidence', async (p, floor) => {
      await openWallsData(p, openWalls, floor);
      const box = p.getByRole('checkbox', { name: WALL_LOW_CONFIDENCE, exact: true });
      await pressSpaceOn(box);
      await expect(box).toBeChecked();
      // Either the narrowed list or the no-match copy (data-dependent, WallLayerList.tsx NO_MATCH_MESSAGE).
      await expect(
        p.getByRole('listbox', { name: WALL_LIST, exact: true }).or(p.getByText(WALL_NO_MATCH, { exact: true })).first(),
      ).toBeVisible();
    });
  });

  test('U04 · SCR-16 walls, "Thu gọn hai panel"', async ({ browser }) => {
    const openWalls = wallsOpener();
    await verifySeeded(browser, 'U04_walls_collapsed', async (p, floor) => {
      await openWallsData(p, openWalls, floor);
      await p.getByRole('button', { name: COLLAPSE_PANELS, exact: true }).click();
      await expect(p.getByRole('button', { name: EXPAND_PANELS, exact: true })).toBeVisible();
      await expect(p.getByRole('listbox', { name: WALL_LIST, exact: true })).toHaveCount(0);
    });
  });
});

test.describe('U04 UI verify — SCR-17 objects (own seeded floor)', () => {
  test('U04 · SCR-17 objects, object selected → inspector "Đối tượng"', async ({ browser }) => {
    await verifySeeded(browser, 'U04_objects_selected', async (p, floor) => {
      await openObjectsData(p, floor);
      const first = objectOptions(p).first();
      await first.click();
      await expect(first).toHaveAttribute('aria-selected', 'true');
      await expect(p.getByRole('button', { name: APPROVE_OBJECT, exact: true })).toBeVisible();
    });
  });

  test('U04 · SCR-17 objects, "Lọc theo loại" chip on', async ({ browser }) => {
    await verifySeeded(browser, 'U04_objects_filter', async (p, floor) => {
      await openObjectsData(p, floor);
      const chip = p.getByRole('group', { name: OBJECT_FILTER, exact: true }).getByRole('button').first();
      await chip.click();
      await expect(chip).toHaveAttribute('aria-pressed', 'true');
    });
  });
});

test.describe('U04 UI verify — SCR-18 dimensions (CP-5 work floor)', () => {
  test('U04 · SCR-18 dimensions, list', async ({ browser }) => {
    await verifyOnWorkFloor(browser, 'U04_dims_list', async (p, floor) => {
      await openDimsData(p, floor);
    });
  });

  test('U04 · SCR-18 dimensions, row selected → "Thanh so sánh với hình học"', async ({ browser }) => {
    await verifyOnWorkFloor(browser, 'U04_dims_selected', async (p, floor) => {
      await openDimsData(p, floor);
      await dimOptions(p).first().click();
      await expect(p.getByLabel(DIMS_COMPARE_BAR, { exact: true })).toBeVisible();
    });
  });
});

test.describe('U04 UI verify — SCR-19 axes (own seeded floor)', () => {
  test('U04 · SCR-19 axes, list', async ({ browser }) => {
    await verifySeeded(browser, 'U04_grids_list', async (p, floor) => {
      await openGridsData(p, floor);
    });
  });

  test('U04 · SCR-19 axes, "Thêm trục ngang" → new row (in memory, F-08)', async ({ browser }) => {
    await verifySeeded(browser, 'U04_grids_axis_added', async (p, floor) => {
      await openGridsData(p, floor);
      const before = await axisRows(p).count();
      await p.getByRole('button', { name: ADD_HORIZONTAL_AXIS, exact: true }).click();
      await expect(axisRows(p)).toHaveCount(before + 1);
    });
  });
});

test.describe('U04 UI verify — SCR-20 rooms (own seeded floor)', () => {
  test('U04 · SCR-20 rooms, room selected → inspector "Phòng"', async ({ browser }) => {
    await verifySeeded(browser, 'U04_rooms_selected', async (p, floor) => {
      await openRoomsData(p, floor);
      await roomOptions(p).first().click();
      await expect(p.getByRole('button', { name: APPROVE_ROOM, exact: true })).toBeVisible();
    });
  });

  test('U04 · SCR-20 rooms, "Chuẩn hoá tên" → preview dialog (not applied)', async ({ browser }) => {
    await verifySeeded(browser, 'U04_rooms_normalize_preview', async (p, floor) => {
      await openRoomsData(p, floor);
      await p.getByRole('button', { name: NORMALIZE, exact: true }).click();
      await settled(p.getByRole('dialog', { name: NORMALIZE_DIALOG, exact: true }));
    });
  });

  test('U04 · SCR-20 rooms, "Gộp phòng" → dialog "Gộp hai phòng" (not confirmed)', async ({ browser }) => {
    await verifySeeded(browser, 'U04_rooms_merge_dialog', async (p, floor) => {
      await openRoomsData(p, floor);
      await roomOptions(p).first().click();
      await p.getByRole('button', { name: MERGE_ROOM, exact: true }).click();
      await settled(p.getByRole('dialog', { name: MERGE_DIALOG, exact: true }));
    });
  });
});

test.describe('U04 UI verify — SCR-21 thickness (own seeded floor)', () => {
  test('U04 · SCR-21 thickness, histogram + groups', async ({ browser }) => {
    await verifySeeded(browser, 'U04_thickness_groups', async (p, floor) => {
      await openThicknessData(p, floor);
      await expect(p.getByRole('heading', { name: THICKNESS_TITLE })).toBeVisible();
    });
  });

  test('U04 · SCR-21 thickness, group ticked + "Xem trước" (not applied)', async ({ browser }) => {
    await verifySeeded(browser, 'U04_thickness_preview', async (p, floor) => {
      await openThicknessData(p, floor);
      const accept = p.getByRole('checkbox', { name: THICKNESS_ACCEPT }).first();
      await pressSpaceOn(accept);
      await expect(accept).toBeChecked();
      await p.getByRole('button', { name: THICKNESS_PREVIEW, exact: true }).click();
      await expect(p.getByRole('button', { name: THICKNESS_APPLY, exact: true })).toBeVisible();
    });
  });
});

test.describe('U04 UI verify — SCR-14 scale (CP-5 work floor)', () => {
  test('U04 · SCR-14 scale, drawing loaded', async ({ browser }) => {
    await verifyOnWorkFloor(browser, 'U04_scale_drawing', openScaleData);
  });

  test('U04 · SCR-14 scale, "Thu gọn bảng" → panel collapsed', async ({ browser }) => {
    await verifyOnWorkFloor(browser, 'U04_scale_panel_collapsed', async (p, floor) => {
      await openScaleData(p, floor);
      // On the work floor so the collapsed panel sits beside a drawing. Since BUG-322 (FIX-1503) the toggle also works in
      // the `error` state: useScaleCalibration.ts:1464,1747 `isPanelCollapsed` follows the button, not `state`.
      await p.getByRole('button', { name: SCALE_COLLAPSE, exact: true }).click();
      await expect(p.getByRole('button', { name: SCALE_EXPAND, exact: true })).toBeVisible();
    });
  });

  test('U04 · SCR-14 scale, reference line drawn + "Chiều dài thật" 5000 (not applied)', async ({ browser }) => {
    await verifyOnWorkFloor(browser, 'U04_scale_refline', async (p, floor) => {
      await openScaleData(p, floor);
      await drawReferenceLine(p);
      await expect(p.getByRole('button', { name: SCALE_APPLY, exact: true })).toBeEnabled();
    });
  });

  test('U04 · SCR-14 scale, "Áp cho mọi tầng" → confirm dialog (not confirmed)', async ({ browser }) => {
    await verifyOnWorkFloor(browser, 'U04_scale_all_floors_dialog', async (p, floor) => {
      await openScaleData(p, floor);
      await drawReferenceLine(p);
      const all = p.getByRole('radiogroup', { name: SCALE_SCOPE, exact: true }).getByRole('radio', { name: SCALE_ALL_FLOORS, exact: true });
      await all.click();
      await expect(all).toHaveAttribute('aria-checked', 'true');
      // With this scope "Áp dụng tỷ lệ" only reads #12 floors + N15 and opens the A9 dialog (useScaleCalibration.ts onApply).
      await p.getByRole('button', { name: SCALE_APPLY, exact: true }).click();
      await settled(p.getByRole('dialog', { name: SCALE_ALL_FLOORS_DIALOG }));
    });
  });
});

test.describe('U04 UI verify — SCR-22 overlay (CP-5 work floor)', () => {
  test('U04 · SCR-22 overlay, scan + model', async ({ browser }) => {
    await verifyOnWorkFloor(browser, 'U04_overlay_default', openOverlayData);
  });

  test('U04 · SCR-22 overlay, "Kiểu đối chiếu" → "Trượt" (divider)', async ({ browser }) => {
    await verifyOnWorkFloor(browser, 'U04_overlay_swipe', async (p, floor) => {
      await openOverlayData(p, floor);
      const swipe = p.getByRole('radiogroup', { name: OVERLAY_MODES, exact: true }).getByRole('radio', { name: OVERLAY_SWIPE, exact: true });
      test.skip(await swipe.isDisabled(), 'data: swipe mode disabled for this floor ("Trượt — <reason>")');
      await swipe.click();
      await expect(swipe).toHaveAttribute('aria-checked', 'true');
      await expect(p.getByRole('slider', { name: OVERLAY_DIVIDER, exact: true })).toBeVisible();
    });
  });
});

/* ========================================================================== */
/* Empty states + long names on a project this file creates (1 empty floor)   */
/* ========================================================================== */

test.describe('U04 UI verify — empty floor, 80-char project + 65-char floor name (this file creates it)', () => {
  let admin: APIRequestContext | undefined;
  let projectId = '';
  let floorId = '';

  test.beforeAll(async () => {
    const { email, password } = readAdminCredentials();
    admin = await signedInApi(email, password);
    // BE #25 (apps/api/projects/schemas.py ProjectCreateIn/FloorDraftIn): one floor, no drawing, no layer.
    const res = await admin.post(PROJECTS_PATH, {
      data: { name: LONG_NAME, floors: [{ name: LONG_FLOOR_NAME, order: 0, elevationMm: 0, heightMm: 3000 }] },
    });
    expect(res.status(), 'setup: POST /api/projects').toBe(201);
    const body = (await res.json()) as { id?: unknown; name?: unknown };
    // Recorded BEFORE the checks below, so `afterAll` deletes it even if one fails (phase03).
    if (typeof body.id === 'string') projectId = body.id;
    expect(body.name, 'setup: the server kept the 80-char name').toBe(LONG_NAME);
    // GET /api/projects/:id/floors (BE apps/api/floors/router.py:46, as phase03_pipeline_ui.spec.ts).
    const floors = await admin.get(`${PROJECTS_PATH}/${projectId}/floors`);
    expect(floors.status(), 'setup: GET /api/projects/:id/floors').toBe(200);
    const rows = (await floors.json()) as readonly { readonly id?: unknown; readonly name?: unknown }[];
    const floor = rows.find((row) => row.name === LONG_FLOOR_NAME);
    if (floor === undefined || typeof floor.id !== 'string') throw new Error('setup: the created floor is missing');
    floorId = floor.id;
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

  const own = (): { projectId: string; floorId: string } => {
    if (projectId === '' || floorId === '') throw new Error('setup: the empty project was not created');
    return { projectId, floorId };
  };

  test('U04 · SCR-16 walls, no wall → empty state + long floor name in floor nav', async ({ browser }) => {
    const openWalls = wallsOpener();
    await verifyAsAdmin(browser, 'U04_walls_empty', async (p) => {
      await openWalls(p, own().projectId, own().floorId);
      await expect(p.getByText(WALLS_EMPTY_NOTICE, { exact: true })).toBeVisible();
      await expect(p.getByRole('navigation', { name: FLOOR_NAV, exact: true })).toContainText(LONG_FLOOR_NAME);
    });
  });

  test('U04 · SCR-17 objects, no object → empty state', async ({ browser }) => {
    await verifyAsAdmin(browser, 'U04_objects_empty', async (p) => {
      await p.goto(ROUTES.project.objects(own().projectId, own().floorId));
      await expect(p.getByRole('region', { name: OBJECTS_SCREEN, exact: true })).toBeVisible({ timeout: 15_000 });
      await expect(p.getByText(OBJECTS_EMPTY_TITLE, { exact: true })).toBeVisible({ timeout: 15_000 });
      await expect(p.getByRole('button', { name: OBJECTS_EMPTY_ACTION, exact: true })).toBeVisible();
    });
  });

  test('U04 · SCR-18 dimensions, nothing read → empty state', async ({ browser }) => {
    await verifyAsAdmin(browser, 'U04_dims_empty', async (p) => {
      await p.goto(ROUTES.project.dimensions(own().projectId, own().floorId));
      await expect(p.getByRole('region', { name: DIMS_SCREEN, exact: true })).toBeVisible({ timeout: 15_000 });
      await expect(p.getByText(DIMS_EMPTY_TITLE, { exact: true })).toBeVisible({ timeout: 15_000 });
    });
  });

  test('U04 · SCR-18 dimensions, keyboard review mode on (no row)', async ({ browser }) => {
    await verifyAsAdmin(browser, 'U04_dims_keyboard_mode', async (p) => {
      await p.goto(ROUTES.project.dimensions(own().projectId, own().floorId));
      await expect(p.getByText(DIMS_EMPTY_TITLE, { exact: true })).toBeVisible({ timeout: 15_000 });
      // `onToggleKeyboardMode` has no row precondition (useDimensionOcrReview.ts:765); the mode replaces the whole screen.
      await p.getByRole('button', { name: KEYBOARD_ON, exact: true }).click();
      await expect(p.getByRole('region', { name: KEYBOARD_CAPTION, exact: true })).toBeVisible();
      await expect(p.getByRole('button', { name: KEYBOARD_OFF, exact: true })).toBeVisible();
    });
  });

  test('U04 · SCR-19 axes, no axis → empty state', async ({ browser }) => {
    await verifyAsAdmin(browser, 'U04_grids_empty', async (p) => {
      await p.goto(ROUTES.project.grids(own().projectId, own().floorId));
      await expect(p.getByRole('region', { name: GRIDS_SCREEN, exact: true })).toBeVisible({ timeout: 15_000 });
      await expect(p.getByText(GRIDS_EMPTY_TITLE, { exact: true })).toBeVisible({ timeout: 15_000 });
    });
  });

  test('U04 · SCR-20 rooms, no room → empty state', async ({ browser }) => {
    await verifyAsAdmin(browser, 'U04_rooms_empty', async (p) => {
      await p.goto(ROUTES.project.rooms(own().projectId, own().floorId));
      await expect(p.getByRole('region', { name: ROOMS_SCREEN, exact: true })).toBeVisible({ timeout: 15_000 });
      await expect(p.getByRole('heading', { name: ROOMS_EMPTY_TITLE })).toBeVisible({ timeout: 15_000 });
    });
  });

  test('U04 · SCR-21 thickness, no wall → empty state', async ({ browser }) => {
    await verifyAsAdmin(browser, 'U04_thickness_empty', async (p) => {
      await p.goto(ROUTES.project.thickness(own().projectId, own().floorId));
      await expect(p.getByRole('heading', { name: THICKNESS_EMPTY_TITLE })).toBeVisible({ timeout: 15_000 });
    });
  });

  test('U04 · SCR-14 scale, no drawing → notice (NOT_FOUND)', async ({ browser }) => {
    await verifyAsAdmin(browser, 'U04_scale_no_drawing', async (p) => {
      await p.goto(ROUTES.project.scale(own().projectId, own().floorId));
      await expect(p.getByRole('region', { name: SCALE_SCREEN, exact: true })).toBeVisible({ timeout: 15_000 });
      await expect(p.getByRole('heading', { name: SCALE_PANEL_TITLE, exact: true, level: 2 })).toBeVisible();
      await expect(p.getByRole('region', { name: SCALE_NOTICE, exact: true })).toBeVisible({ timeout: 15_000 });
    });
  });

  test('U04 · SCR-22 overlay, no drawing → read-failed notice + long floor name', async ({ browser }) => {
    await verifyAsAdmin(browser, 'U04_overlay_no_drawing', async (p) => {
      await p.goto(ROUTES.project.overlay(own().projectId, own().floorId));
      await expect(p.getByRole('region', { name: OVERLAY_SCREEN, exact: true })).toBeVisible({ timeout: 15_000 });
      await expect(p.getByText(OVERLAY_READ_FAILED, { exact: true })).toBeVisible({ timeout: 15_000 });
    });
  });
});
