/**
 * Phase 4 — real viewer / engineer / non-member flows across every QC screen (QA-04c P7, flow-plan.md
 * "phase04_roles_edge.spec.ts", FL-R-01..FL-R-09). One test per flow, one `test.step('[<row id>] …')` per catalog row.
 *
 * ## Rules of this pack
 * - Viewer / engineer are REAL members: pool user (`poolUser`) + N3 `addProjectMember` + one browser login (`openFlow`).
 *   Nothing is mocked; the `_(mock)_` rows 14-D-006 / 16-D-010 are asserted on the real stack with a real member.
 * - FL-R-08 demotes the pool engineer of slot `p04-demote` to viewer with #41 (`PATCH /api/users/:id/role`, admin only) while
 *   three screens are open, and puts the role back in `finally` (also when the test fails).
 * - Steps marked ⚑ assert the CORRECT behaviour from the source / spec with `expect.soft`: they stay red while the app is
 *   wrong (candidate bugs: 16-D-006, 16-D-007, 16-D-008, 17-D-004, 17-D-007, 17-D-011, 19-D-005, 20-D-006, 21-D-001,
 *   21-D-003, 22-D-004, X4-D-003, 14-D-008, 14-G-016, 14-D-009, 22-D-008).
 * - No `waitForTimeout`: a "nothing was sent" claim first runs {@link quiet} (Ctrl+S flush + a same-origin round trip).
 *
 * Source (FE @ master 6c662bcb), short names: WLR src/screens/qc/WallLayerReview/ (WTR ToolRail, WI Inspector, WL List, WCV Canvas,
 * UW useWallLayerReview.ts, FSB FloorLayerSaveBanner) · OLR …/ObjectLayerReview/ (OT ToolRail, OS StatusBar, OI Inspector, OCV Canvas,
 * UO useObjectLayerReview.ts, OG objectLayerReviewGateway.ts) · RLR …/RoomLabelReview/ (RLP LeftPanel, RIN Inspector, RCV Canvas,
 * URR useRoomLabelReview.ts) · TSR …/ThicknessStandardization/ (TV view, UT hook) · AGM …/AxisGridManager/ (AGV view, ALP LeftPanel,
 * ACV Canvas, UAG hook, AFL FloorAlignList) · SCC src/screens/pipeline/ScaleCalibration/ (SC view, SCP Panel, SCV Canvas, USC hook) ·
 * OVC src/screens/viewer/OverlayComparison/ (OC view, OCT Toolbar, OCP Panel, OCD Divider, UOC hook) ·
 * SLS src/lib/autosave/spatialLayerSave.ts · FLRF src/screens/qc/shared/floorLayerReadFailure.ts · PSGATE ProjectSpatialGate.tsx.
 *
 * ## Budget per run (BE defaults; QA stack override qa-limits.override.yml)
 * - logins: per test 1 main admin API + 1 pool-admin API (`openRolesEnv`) + 1 browser per member context (FL-R-04 2, FL-R-09 1 admin);
 *   9 tests ≈ 25 logins (LOGIN_IP_LIMIT 120 / 60 s). Anonymous deep links: 0 (no login).
 * - `GET /api/users` 1 per `poolUser` (an invitation only when a pool slot is empty: `admin:p04-roles`, `viewer:p04-roles`,
 *   `engineer:p04-roles`, `engineer:p04-demote`; users_invite 30 / 3600 s).
 * - uploads (`drawings_init` 60 / 600 s per user, billed to the pool admin `p04-roles`): FL-R-05 1 (DF), FL-R-06 1 (D1), FL-R-07 1 (DF),
 *   FL-R-09 1 (D1) = 4 per run, each one fake-ML run.
 * - `POST /api/projects` 11 (+ same DELETE in `finally`), `POST …/members` 12, #35 PUT 2-4 per seeded layer, #41 PATCH 2 (FL-R-08).
 */
import { expect, test, type Locator, type Page } from '@playwright/test';

import { ROUTES } from '../../e2e/fixtures/routes';
import { TOUR_APPEAR_TIMEOUT_MS, dismissTour } from '../../e2e/fixtures/tour';
import { describeEntry, waitForApi, watchApi, type ApiResult } from '../../e2e/fullstack/apiWatch';
import { readBaseUrl } from '../../e2e/fullstack/env';
import { readAdminCredentials } from './support/auth';
import { attachJson, captureEvidence } from './support/evidence';
import { poolUser } from './support/phase03Seed';
import { spaGo, pathOf } from './support/p03/P11';
import { closeFlow, openFlow, recordAnnouncements } from './support/p03/P5';
import { flush } from './support/p04/P5';
import {
  DEMOTE_SLOT,
  closeRolesEnv,
  escapeRegExp,
  framedFloor,
  memberFlow,
  objects1Wall,
  openLayerScreen,
  openRolesEnv,
  q1Project,
  q2Project,
  realFloor,
  region,
  roomsViewer,
  setRole,
  viewer2119,
  writesSince,
  type Flow,
  type Member,
  type RolesEnv,
} from './support/p04/P7.roles';

/* ---------------------------------------------------------------- constants (each cites its source) */

const MOD = process.platform === 'darwin' ? 'Meta' : 'Control';
/**
 * Marker before a "nothing was sent" claim, no fixed wait: Ctrl+S flushes any autosave still in its 800 ms debounce right now
 * (router.tsx:230-238 global.save -> flushAutosaves), then a same-origin round trip lets the page's own requests reach the
 * log (`support/p04/P5.ts` flush). A write the screen queued is therefore in `flow.sent` when the count is read.
 */
const quiet = (page: Page): Promise<void> => flush(page);

/* SCR-16 */
const WALL = {
  screen: 'Duyệt lớp tường', // WLR.tsx:SCREEN_ARIA_LABEL
  list: 'Danh sách đoạn tường', // WL:LIST_ARIA_LABEL
  rail: 'Công cụ lớp tường', // WTR:RAIL_ARIA_LABEL
  select: 'Chọn (phím V)', // WTR TOOLS select
  measure: 'Đo (phím M)', // WTR TOOLS measure
  draw: 'Vẽ tường (phím W)', // WTR TOOLS drawWall
  split: 'Tách đoạn', // WTR TOOLS splitWall
  collapse: 'Thu gọn hai panel', // WTR:COLLAPSE_LABEL
  expand: 'Mở lại hai panel', // WTR:EXPAND_LABEL
  approve: 'Duyệt đoạn này', // WI:APPROVE_LABEL
  skip: 'Bỏ qua', // WI:SKIP_LABEL
  thickness: 'Độ dày tường', // WI:THICKNESS_ARIA_LABEL
  viewerNotice:
    'Bạn đang xem với vai người xem, nên không duyệt hay sửa được đoạn tường nào. Nhờ người có quyền sửa dự án duyệt giúp.', // UW WALL_LAYER_TEXT.viewerRoleNotice
  canvasNote:
    'Bản vẽ vẫn xem và phóng to được, nhưng không chọn hay sửa được đoạn tường nào. Nhờ người có quyền sửa dự án duyệt giúp.', // WCV:FORBIDDEN_DESCRIPTION
  canvasNoteId: 'wall-layer-canvas-forbidden', // WCV:FORBIDDEN_DESCRIPTION_ID
  legend: 'Lọc theo độ dày tường', // WallThicknessLegend role=group
  emptyTitle: 'Chưa có đoạn tường nào', // WL:EMPTY_LIST_TITLE
  emptyNotice:
    'Chưa phát hiện được đoạn tường nào ở tầng này. Bạn có thể vẽ tường thủ công bằng phím W, hoặc chạy lại với ngưỡng thấp hơn.', // UW emptyNotice
  noMatch: 'Không có đoạn tường nào khớp bộ lọc đang bật. Bỏ bớt một bộ lọc để thấy lại danh sách.', // WL:NO_MATCH_MESSAGE
  forbidden: 'Bạn không còn quyền sửa tầng này.', // SLS LAYER_SAVE_MESSAGES.forbidden
  reload: 'Tải lại', // FSB
} as const;
/** `MeasurementLabel` pill (components/canvas/MeasurementLabel.tsx: `bg-bg-surface-92`). */
const MEASURE_PILL = 'span.bg-bg-surface-92';

/* SCR-17 */
const OBJ = {
  screen: 'Lớp đối tượng', // OV:SCREEN_ARIA_LABEL
  rail: 'Công cụ lớp đối tượng', // OT:RAIL_ARIA_LABEL
  list: 'Danh sách đối tượng', // ObjectLayerList LIST_LABEL
  doors: 'Cửa đi', // OBJECT_LAYER_LABELS.door
  status: 'Thanh trạng thái', // OS:STATUS_BAR_ARIA_LABEL
  undo: 'Hoàn tác', // OS:UNDO_LABEL
  collapse: 'Thu gọn hai panel', // OS:COLLAPSE_LABEL
  expand: 'Mở lại hai panel', // OS:EXPAND_LABEL
  approve: 'Duyệt đối tượng này', // OI:APPROVE_LABEL
  type: 'Loại đối tượng', // OI:TYPE_SELECT_LABEL
  swing: 'Hướng mở', // OI:SWING_LABEL
  position: 'Vị trí trên tường', // OI:POSITION_LABEL
  inspectorEmpty: 'Chọn một đối tượng trên bản vẽ hoặc trong danh sách để xem chi tiết.', // OI:EMPTY_MESSAGE
  addManually: 'Thêm thủ công', // OV:EMPTY_ACTION
  copyWrong: 'Bạn không có quyền xem lớp đối tượng của dự án này', // UO/OG OBJECT_LAYER_TEXT.forbidden
  canvasNote:
    'Mặt bằng vẫn xem và phóng to được, nhưng không chọn hay sửa được đối tượng nào. Nhờ người có quyền sửa dự án duyệt giúp.', // OSY readOnlyNotice
  canvasNoteId: 'object-layer-canvas-read-only', // OSY OBJECT_CANVAS_READ_ONLY_ID
} as const;

/* SCR-20 */
const ROOM = {
  screen: 'Duyệt tên phòng', // RLR:SCREEN_TITLE
  list: 'Danh sách phòng', // RoomLabelList LIST_ARIA_LABEL
  canvas: 'Khung xem bản vẽ duyệt tên phòng', // RLR:CANVAS_SECTION_LABEL
  canvasNoteId: 'room-label-canvas-forbidden', // RCV:FORBIDDEN_DESCRIPTION_ID
  canvasNote: 'Bản vẽ vẫn xem được, nhưng không chọn được phòng nào ở đây. Nhờ người có quyền sửa dự án duyệt giúp.', // RCG forbiddenNotice
  forbiddenTitle: 'Không có quyền sửa lớp phòng', // RLR:FORBIDDEN_TITLE
  viewerNotice:
    'Bạn đang xem với vai người xem: đổi tên, đổi công năng, gộp, tách và duyệt đều tắt. Nhờ người quản trị dự án đổi vai nếu bạn cần sửa lớp phòng.', // URR ROOM_LABEL_SCREEN_TEXT.viewerRoleNotice
  emptyTitle: 'Chưa dò ra phòng nào', // RLR:EMPTY_TITLE
  emptyNotice:
    'Chưa dò ra phòng nào ở tầng này: vòng tường bao quanh các phòng chưa khép kín. Sang lớp tường khép các đoạn còn hở, rồi bấm "Kiểm tra lại vòng hở" để dò lại.', // URR emptyNotice
  filterNoMatch: 'Không có phòng nào khớp bộ lọc đang bật. Tắt bộ lọc "Chưa đặt tên" để thấy lại cả danh sách.', // RLL EMPTY_DESCRIPTION
  noRoomTitle: 'Chưa có phòng nào', // RLL EMPTY_TITLE
  normalize: 'Chuẩn hoá tên', // RLP:NORMALIZE_LABEL
  name: 'Tên phòng', // RNF:NAME_LABEL
  usage: 'Công năng', // RIN:USAGE_LABEL
  approve: 'Duyệt phòng này', // RIN:APPROVE_LABEL
  merge: 'Gộp phòng', // RIN:MERGE_LABEL
  split: 'Tách phòng', // RIN:SPLIT_LABEL
  checkGaps: 'Kiểm tra lại vòng hở', // RLP:CHECK_GAPS_LABEL
  toWalls: 'Xem tại lớp tường', // RLP:NAVIGATE_WALLS_LABEL
  gaps: 'Vòng tường hở', // RLP:GAPS_TITLE
} as const;

/* SCR-21 */
const THICK = {
  screen: 'Chuẩn hoá độ dày tường', // TV:SCREEN_TITLE
  tables: 'Bảng nhóm và bảng chi tiết từng đoạn', // TV:TABLES_SECTION_LABEL
  forbiddenTitle: 'Không có quyền sửa độ dày tường', // TV:FORBIDDEN_TITLE
  viewerNotice:
    'Bạn đang xem với vai người xem: áp chuẩn hoá, gán nhóm và sửa dung sai đều tắt. Nhờ người quản trị dự án đổi vai nếu bạn cần sửa độ dày tường.', // UT THICKNESS_SCREEN_TEXT.viewerRoleNotice
  emptyTitle: 'Chưa có đoạn tường nào để chuẩn hoá', // TV:EMPTY_TITLE
  screenDescription: 'Đối chiếu số đo độ dày của từng đoạn tường với bốn nhóm chuẩn, xem trước rồi áp một lượt duy nhất.', // TV:SCREEN_DESCRIPTION
  emptyNoMeasurement:
    'Chưa có số đo độ dày nào cho công trình này. Sang lớp tường để dò lại các đoạn tường, rồi quay lại đây để chuẩn hoá độ dày.', // UT emptyNoMeasurementNotice
  preview: 'Xem trước', // TAB:56
  apply: 'Áp dụng', // TAB:58
  changeThickness: 'Đổi độ dày', // TableActionBar
  slider: 'Ngưỡng giữa 110 mm và 220 mm', // ThicknessHistogram threshold label
} as const;

/* SCR-19 */
const AXIS = {
  screen: 'Quản lý trục và gốc toạ độ', // AGV:SCREEN_TITLE
  forbiddenTitle: 'Không có quyền sửa trục', // AGV:FORBIDDEN_TITLE
  viewerNotice: 'Vai trò hiện tại chỉ được xem, không được chỉnh sửa các trục. Liên hệ quản trị dự án nếu cần.', // UAG AXIS_GRID_TEXT.viewerRoleNotice
  canvasNoteId: 'axis-grid-canvas-read-only', // ACV:CANVAS_READ_ONLY_NOTICE_ID
  addH: 'Thêm trục ngang', // UAG group addButtonLabel
  addV: 'Thêm trục dọc', // UAG group addButtonLabel
  autoAlign: 'Căn chỉnh tự động', // AFL:AUTO_ALIGN_BUTTON_LABEL
  ghost: 'Hiện bóng ma tầng dưới', // ALP:GHOST_TOGGLE_LABEL
  anchor: 'Chọn giao trục neo', // AGM origin panel SELECT_LABEL
  emptyTitle: 'Chưa có trục nào', // AGV:EMPTY_TITLE
  derive: 'Suy ra từ tường bao', // AGV:EMPTY_ACTION_LABEL
  canvasEmpty: 'Chưa có trục nào để hiện trên bản vẽ.', // AGV:CANVAS_EMPTY_NOTICE
  rowPattern: /^Trục (.+?), cách trục kế là /u, // ALP:axisRowAriaLabel
  pinned:
    'Đã ghim gốc toạ độ cho phiên làm việc này. Hệ thống chưa có chỗ lưu lựa chọn đó, nên nó mất sau khi tải lại trang.', // UAG originNotPersisted
} as const;

/* SCR-14 */
const SCALE = {
  screen: 'Màn hiệu chỉnh tỷ lệ', // SC:SCREEN_ARIA_LABEL
  notice: 'Trạng thái của màn hiệu chỉnh tỷ lệ', // SC:NOTICE_REGION_ARIA_LABEL
  forbiddenTitle: 'Bạn không có quyền hiệu chỉnh tỷ lệ', // SC:FORBIDDEN_TITLE
  forbiddenNotice:
    'Bản vẽ vẫn xem và phóng to được, nhưng không kéo được đường tham chiếu. Nhờ người có quyền sửa dự án đặt tỷ lệ giúp.', // USC forbiddenNotice
  canvas: 'Bản vẽ đã nắn, kéo để vẽ đường tham chiếu', // SCV:CANVAS_ARIA_LABEL
  canvasNoteId: 'scale-calibration-canvas-forbidden', // SCV:FORBIDDEN_DESCRIPTION_ID
  handleStart: 'Đầu đoạn tham chiếu, dùng phím mũi tên để nhích', // SCV HANDLE_ARIA_LABEL
  handleEnd: 'Cuối đoạn tham chiếu, dùng phím mũi tên để nhích', // SCV HANDLE_ARIA_LABEL
  methods: 'Chọn cách xác định tỷ lệ', // SCP:METHOD_ARIA_LABEL
  reference: 'Vẽ đường tham chiếu', // USC method option
  realLength: 'Chiều dài thật', // SMR label
  apply: 'Áp dụng tỷ lệ', // SCP:APPLY_PRIMARY
  scope: 'Phạm vi áp tỷ lệ', // SCP:SCOPE_ARIA_LABEL
  thisFloor: 'Tầng này', // USC scope option
  collapse: 'Thu gọn bảng', // SCP:COLLAPSE_LABEL
  expand: 'Bung bảng', // SCP:EXPAND_LABEL
  applyFailed:
    'Chưa lưu được tỷ lệ lên máy chủ, tầng giữ tỷ lệ cũ. Tài khoản của bạn chưa có quyền xem hoặc thay đổi nội dung này. Liên hệ quản trị dự án.', // USC applyFailed + errors.forbidden
  warpedTitle: 'Không tìm thấy khung bản vẽ, ảnh có thể chưa thẳng', // SC:ERROR_TITLE
} as const;

/* SCR-22 */
const OVERLAY = {
  screen: 'Màn đối chiếu bản vẽ', // OC:SCREEN_ARIA_LABEL
  notice: 'Trạng thái của màn đối chiếu bản vẽ', // OC:NOTICE_REGION_ARIA_LABEL
  forbidden: 'Bạn chỉ được xem; việc đổi căn chỉnh dành cho người có quyền sửa.', // UOC COPY.forbiddenNotice
  readOnlyLine: 'Bạn không có quyền sửa, các điều khiển đang tắt.', // OCT:READ_ONLY_NOTICE
  frameMissing: 'Không tìm được khung bản vẽ nên chưa căn được ảnh quét vào mô hình.', // UOC COPY.errorFrameNotice
  noFloor: 'Dự án này chưa có tầng nào để đối chiếu.', // UOC COPY.noFloorNotice
  floor: 'Chọn tầng', // OCT:FLOOR_SELECT_LABEL
  modes: 'Kiểu đối chiếu', // OCT:COMPARE_MODE_ARIA_LABEL
  swipe: 'Trượt', // types COMPARE_MODE_LABELS
  opacity: 'Độ mờ ảnh nguồn', // OCT:SCAN_OPACITY_ARIA_LABEL
  lock: 'Khoá căn', // OCT:ALIGNMENT_LOCK_LABEL
  tolerance: 'Dung sai', // UOC COPY.toleranceLabel
  confirm: 'Xác nhận mô hình khớp bản vẽ', // UOC COPY.confirmButton
  divider: 'Đường chia đôi, dùng phím mũi tên trái và phải để dịch', // OCD:DIVIDER_ARIA_LABEL
} as const;

/** 404 project on a QC route (FLRF:57-64, PSGATE:37-40). */
const NOT_FOUND = {
  title: 'Không tìm thấy dự án này',
  back: 'Về danh sách dự án',
  scaleCode: 'Mã lỗi: NOT_FOUND', // 14-D-009: what the SCR-14 read error shows today
  unknownBody: 'Nội dung này có thể đã bị xoá, hoặc đường dẫn chưa đúng.', // 14-D-009 catalog
} as const;
const SIGN_IN_REQUIRED = 'Hãy đăng nhập để tiếp tục.'; // vi.json:201 (SessionBootstrap, BUG-007)

/* ---------------------------------------------------------------- small helpers */

const must = <T>(value: T | undefined, what: string): T => {
  if (value === undefined) throw new Error(`seed: ${what}`);
  return value;
};

/** Code of a list row from its aria-label `<code> — <status>`. */
const codeOf = async (option: Locator): Promise<string> => ((await option.getAttribute('aria-label')) ?? '').split(' — ')[0] ?? '';

const layerRe = (projectId: string, floorId: string): RegExp =>
  new RegExp(`^/api/projects/${escapeRegExp(projectId)}/floors/${escapeRegExp(floorId)}/spatial/layer$`, 'u');

/** Next `PUT …/spatial/layer` with one of `statuses`. Register BEFORE the action. */
const nextPut = (page: Page, projectId: string, floorId: string, statuses: readonly number[]): Promise<ApiResult> =>
  waitForApi(page, 'PUT', layerRe(projectId, floorId), statuses);

const alertWith = (page: Page, text: string | RegExp): Locator => page.getByRole('alert').filter({ hasText: text });

/** Checkbox / Radio.Item are sr-only inputs under a drawn box: focus + Space. */
async function pressSpaceOn(control: Locator): Promise<void> {
  await control.focus();
  await control.page().keyboard.press('Space');
}

async function openWalls(flow: Flow, projectId: string, floorId: string): Promise<void> {
  await openLayerScreen(flow.page, ROUTES.project.walls(projectId, floorId), projectId, floorId);
  await expect(region(flow.page, WALL.screen)).toBeVisible();
  await dismissTour(flow.page, { waitMs: 0 }); // the walls screen mounts the editor tour (only SCR-16 does)
}

const openOn = async (flow: Flow, url: string, projectId: string, floorId: string, screen: string): Promise<void> => {
  await openLayerScreen(flow.page, url, projectId, floorId);
  await expect(region(flow.page, screen)).toBeVisible();
};

const wallOptions = (page: Page): Locator => page.getByRole('listbox', { name: WALL.list, exact: true }).getByRole('option');
const wallInspector = (page: Page): Locator => page.getByRole('heading', { name: 'Đoạn tường', exact: true, level: 3 }).locator('xpath=../..');
const objectInspector = (page: Page): Locator => page.getByRole('heading', { name: 'Đối tượng', exact: true, level: 3 }).locator('xpath=../..');
const roomInspector = (page: Page): Locator => page.getByRole('heading', { name: 'Phòng', exact: true, level: 3 }).locator('xpath=../..');
const doorOptions = (page: Page): Locator => page.getByRole('listbox', { name: OBJ.doors, exact: true }).getByRole('option');
const roomOptions = (page: Page): Locator => page.getByRole('listbox', { name: ROOM.list, exact: true }).getByRole('option');
const axisRows = (page: Page): Locator => page.getByRole('option', { name: AXIS.rowPattern });
const scaleCanvas = (page: Page): Locator => page.getByRole('group', { name: SCALE.canvas, exact: true });
const scaleRegion = (page: Page): Locator => region(page, SCALE.screen);

/** Transform of the zoomable plane (wheel zoom / middle pan move it). */
const transformOf = (plane: Locator): Promise<string> => plane.evaluate((el) => (el as HTMLElement).style.transform);

/** Wheel over the centre of `host`, then a middle-button drag: both must move `plane` (no role check in the source). */
async function zoomAndPan(page: Page, host: Locator, plane: Locator): Promise<{ readonly zoomed: boolean; readonly panned: boolean }> {
  const box = must((await host.boundingBox()) ?? undefined, 'canvas has no bounding box');
  const cx = box.x + box.width / 2;
  const cy = box.y + box.height / 2;
  const before = await transformOf(plane);
  await page.mouse.move(cx, cy);
  await page.mouse.wheel(0, -240);
  const zoomed = await expect
    .poll(() => transformOf(plane), { message: 'wheel zoom moves the plane' })
    .not.toBe(before)
    .then(() => true, () => false);
  const afterZoom = await transformOf(plane);
  await page.mouse.move(cx, cy);
  await page.mouse.down({ button: 'middle' });
  await page.mouse.move(cx + 60, cy + 40, { steps: 6 });
  await page.mouse.up({ button: 'middle' });
  const panned = await expect
    .poll(() => transformOf(plane), { message: 'middle drag pans the plane' })
    .not.toBe(afterZoom)
    .then(() => true, () => false);
  return { zoomed, panned };
}

/** Draws the reference line 20 % → 80 % at 50 % of the SCR-14 canvas, enters 5000 mm + Enter (as the main chain does). */
async function drawReference(page: Page): Promise<void> {
  await page.getByRole('radiogroup', { name: SCALE.methods, exact: true }).getByRole('radio', { name: SCALE.reference, exact: true }).click();
  const box = must((await scaleCanvas(page).boundingBox()) ?? undefined, 'scale canvas has no bounding box');
  await page.mouse.move(box.x + box.width * 0.2, box.y + box.height * 0.5);
  await page.mouse.down();
  await page.mouse.move(box.x + box.width * 0.8, box.y + box.height * 0.5, { steps: 8 });
  await page.mouse.up();
  await expect(page.getByRole('button', { name: SCALE.handleStart, exact: true })).toBeVisible();
  const realLength = page.getByLabel(SCALE.realLength, { exact: true });
  await realLength.fill('5000');
  await realLength.press('Enter');
  await expect(page.getByLabel('Phép tính ra tỷ lệ', { exact: true })).toContainText('mm/px');
}

const ev = (id: string, slug: string): string => `R04_${id}_${slug}.png`;

/* ================================================================= FL-R-01 */

test.describe('Phase 4 roles — real members on every QC screen', () => {
  test('SCR-16 · FL-R-01 · viewer member on SCR-16', async ({ browser }) => {
    test.setTimeout(180_000);
    let env: RolesEnv | undefined;
    let member: Member | undefined;
    try {
      env = await openRolesEnv();
      const seed = await q2Project(env, 'r04-fl-r-01');
      const floor = must(seed.floors[0], 'floor 1');
      const emptyFloor = must(seed.floors[1], 'empty floor');
      member = await memberFlow(browser, env, [seed.projectId], 'viewer');
      const { flow } = member;
      const { page } = flow;
      const rail = page.getByRole('toolbar', { name: WALL.rail, exact: true });
      const canvasGroup = page.locator(`[aria-describedby="${WALL.canvasNoteId}"]`);

      await test.step('[X4-D-001] H: viewer on SCR-16: selected wall shows the notice; no "Duyệt đoạn này", no "Độ dày tường" radiogroup', async () => {
        await openWalls(flow, seed.projectId, floor.floorId);
        await expect(wallOptions(page).first()).toBeVisible();
        await wallOptions(page).first().click();
        await expect(wallOptions(page).first()).toHaveAttribute('aria-selected', 'true');
        await expect(page.getByText(WALL.viewerNotice, { exact: true })).toBeVisible();
        await expect.soft(page.getByRole('button', { name: WALL.approve, exact: true })).toHaveCount(0);
        await expect.soft(page.getByRole('radiogroup', { name: WALL.thickness, exact: true })).toHaveCount(0);
        await captureEvidence(page, ev('X4-D-001', 'viewer_wall_notice'));
      });

      await test.step('[16-D-001] viewer: rail keeps only "chọn (phím V)" and the collapse button; "đo" is an edit tool (BUG-601, WallLayerToolRail.tsx:75,130)', async () => {
        await expect.soft(rail.getByRole('button', { name: WALL.select, exact: true })).toBeVisible();
        await expect.soft(rail.getByRole('button', { name: WALL.measure, exact: true })).toHaveCount(0);
        await expect.soft(rail.getByRole('button', { name: WALL.collapse, exact: true })).toBeVisible();
        await expect.soft(rail.getByRole('button', { name: WALL.draw, exact: true })).toHaveCount(0);
        await expect.soft(rail.getByRole('button', { name: WALL.split, exact: true })).toHaveCount(0);
        await expect.soft(rail.getByRole('button', { name: /^nối đoạn/u })).toHaveCount(0);
        await expect.soft(rail.getByRole('button'), 'exactly two rail buttons').toHaveCount(2);
        await captureEvidence(page, ev('16-D-001', 'viewer_rail'));
      });

      await test.step('[16-D-002] viewer: inspector shows the notice and the read-only thickness group, no approve / skip', async () => {
        const inspector = wallInspector(page);
        await expect.soft(inspector.getByText(WALL.viewerNotice, { exact: true })).toBeVisible();
        const group = inspector.getByRole('group', { name: WALL.thickness, exact: true });
        await expect.soft(group).toBeVisible();
        // The choice shown as current is the selected wall's own thickness (WallLayerInspector.tsx:58-79 `choice === value`),
        // read from the selected row's badge (WallLayerList.tsx:176-183); a thickness off the 110/220/330 bands bolds none.
        const listed = /(\d+)\s*mm/u.exec(await wallOptions(page).first().innerText())?.[1];
        const current = group.locator('span.font-semibold');
        if (listed === '110' || listed === '220' || listed === '330') await expect.soft(current).toHaveText(`${listed} mm`);
        else await expect.soft(current, `selected wall is ${String(listed)} mm: no band is current`).toHaveCount(0);
        await expect.soft(inspector.getByRole('radiogroup')).toHaveCount(0);
        await expect.soft(inspector.getByRole('button', { name: WALL.approve, exact: true })).toHaveCount(0);
        await expect.soft(inspector.getByRole('button', { name: WALL.skip, exact: true })).toHaveCount(0);
        await captureEvidence(page, ev('16-D-002', 'viewer_inspector'));
      });

      await test.step('[16-D-003] viewer: canvas not interactive, described for AT', async () => {
        await expect.soft(canvasGroup).toHaveCount(1);
        await expect.soft(page.locator(`#${WALL.canvasNoteId}`)).toHaveText(WALL.canvasNote);
        const figures = canvasGroup.locator('g[role="presentation"][aria-label]');
        expect.soft(await figures.count(), 'wall polygons drawn').toBeGreaterThan(0);
        expect.soft(await figures.evaluateAll((nodes) => nodes.filter((n) => !n.getAttribute('class')?.includes('pointer-events-none')).length), 'polygons that take pointer events').toBe(0);
        await figures.first().dispatchEvent('contextmenu');
        await expect.soft(page.getByRole('menu')).toHaveCount(0);
        await captureEvidence(page, ev('16-D-003', 'viewer_canvas_described'));
      });

      await test.step('[16-D-004] viewer: Backspace, digits, W, Mod+Z do nothing; no PUT', async () => {
        const rows = await wallOptions(page).count();
        const mark = flow.sent.length;
        await wallOptions(page).first().focus();
        for (const key of ['Backspace', '1', '2', '3', 'w', `${MOD}+z`]) await page.keyboard.press(key);
        await expect.soft(rail.getByRole('button', { name: WALL.draw, exact: true })).toHaveCount(0);
        await expect.soft(wallOptions(page)).toHaveCount(rows);
        await quiet(page);
        expect.soft(writesSince(flow, mark), 'a viewer sends no write').toEqual([]);
        await captureEvidence(page, ev('16-D-004', 'viewer_keys_inert'));
      });

      await test.step('[16-D-005] viewer: list click and J/K still select', async () => {
        const total = await wallOptions(page).count();
        expect(total, 'seeded floor has more than one wall').toBeGreaterThan(1);
        const first = wallOptions(page).first();
        await first.click();
        await expect.soft(first).toHaveAttribute('aria-selected', 'true');
        const firstCode = await codeOf(first);
        await page.keyboard.press('j');
        await expect.soft(first).toHaveAttribute('aria-selected', 'false');
        const moved = page.locator('[role="listbox"] [role="option"][aria-selected="true"]');
        await expect.soft(moved).toHaveCount(1);
        expect.soft(await codeOf(moved), 'J moved the selection').not.toBe(firstCode);
        await page.keyboard.press('k');
        await expect.soft(first).toHaveAttribute('aria-selected', 'true');
        await captureEvidence(page, ev('16-D-005', 'viewer_list_jk'));
      });

      await test.step('[16-D-006] ⚑ viewer: the "đo" tool is not offered (BUG-601, WallLayerToolRail.tsx:75,130) and canvas clicks measure nothing', async () => {
        await expect.soft(rail.getByRole('button', { name: WALL.measure, exact: true })).toHaveCount(0);
        const svg = canvasGroup.locator('svg[role="img"]').first();
        const pill = page.locator(MEASURE_PILL);
        const before = await pill.count();
        await svg.click({ position: { x: 120, y: 140 } });
        await svg.click({ position: { x: 360, y: 200 } });
        await expect.soft(pill, 'no measurement label appears after the two clicks').toHaveCount(before);
        await captureEvidence(page, ev('16-D-006', 'viewer_measure_tool'));
      });

      await test.step('[16-D-007] ⚑ viewer: "Thu gọn hai panel" hides both panels', async () => {
        const toggle = rail.getByRole('button', { name: /^(Thu gọn|Mở lại) hai panel$/u });
        await toggle.click();
        await expect.soft(page.getByRole('listbox', { name: WALL.list, exact: true }), 'the left panel list is gone').toBeHidden();
        await expect.soft(page.getByRole('heading', { name: 'Đoạn tường', exact: true, level: 3 }), 'the inspector is gone').toBeHidden();
        await captureEvidence(page, ev('16-D-007', 'viewer_collapse'));
        await toggle.click(); // put the panels back whatever the label said
        await expect(rail.getByRole('button', { name: WALL.collapse, exact: true })).toBeVisible();
      });

      await test.step('[16-D-009] viewer: legend still shown', async () => {
        await expect.soft(page.getByRole('group', { name: WALL.legend, exact: true })).toBeVisible();
        await captureEvidence(page, ev('16-D-009', 'viewer_legend'));
      });

      await test.step('[16-D-008] ⚑ viewer on an empty floor / while loading: the empty notice / the skeleton, not the filter no-match line', async () => {
        // loading: hold the real N16 answer of the empty floor until the screen has been looked at (no data is mocked).
        let release: () => void = () => undefined;
        const gate = new Promise<void>((resolve) => {
          release = resolve;
        });
        // page.route tests a RegExp against the FULL url (http://host/api/...) but layerRe is anchored on the path: match the pathname.
        const re = layerRe(seed.projectId, emptyFloor.floorId);
        const isLayerUrl = (url: URL): boolean => re.test(url.pathname);
        await page.route(isLayerUrl, async (route) => {
          if (route.request().method() === 'GET') await gate;
          await route.continue();
        });
        try {
          await page.goto(ROUTES.project.walls(seed.projectId, emptyFloor.floorId), { waitUntil: 'commit' });
          await expect(region(page, WALL.screen)).toBeVisible();
          await expect.soft(page.getByRole('status', { name: WALL.list, exact: true }), 'list skeleton while the read is pending').toBeVisible();
          await captureEvidence(page, ev('16-D-008', 'viewer_loading_skeleton'));
        } finally {
          release();
          await page.unroute(isLayerUrl);
        }
        await expect(page.getByRole('status', { name: WALL.list, exact: true })).toHaveCount(0);
        await dismissTour(page, { waitMs: 0 });
        await expect.soft(page.getByText(WALL.emptyTitle, { exact: true }), 'empty-floor title').toBeVisible();
        await expect.soft(page.getByText(WALL.emptyNotice, { exact: true }), 'empty-floor notice').toBeVisible();
        await expect.soft(page.getByText(WALL.noMatch, { exact: true }), 'no filter is on, so the filter line is wrong').toHaveCount(0);
        await captureEvidence(page, ev('16-D-008', 'viewer_empty_floor'));
        // UNKNOWN — NEED VERIFICATION: the "after a refetch error" variant needs a 5xx answer, which the real stack cannot produce.
      });
    } finally {
      if (member !== undefined) await closeFlow(member.flow);
      await closeRolesEnv(env);
    }
  });

  /* ================================================================= FL-R-02 */

  test('SCR-17 · FL-R-02 · viewer member on SCR-17', async ({ browser }) => {
    test.setTimeout(150_000);
    let env: RolesEnv | undefined;
    let member: Member | undefined;
    try {
      env = await openRolesEnv();
      const seed = await objects1Wall(env, 'r04-fl-r-02');
      const full = must(seed.floors[0], 'objects floor');
      const oneWall = must(seed.floors[1], '1-wall floor');
      member = await memberFlow(browser, env, [seed.projectId], 'viewer');
      const { flow } = member;
      const { page } = flow;
      const toolbar = page.getByRole('toolbar', { name: OBJ.rail, exact: true });
      const status = page.getByRole('status', { name: OBJ.status, exact: true });
      const canvasGroup = page.locator(`[aria-describedby="${OBJ.canvasNoteId}"]`);

      await test.step('[X4-D-004] H: viewer on SCR-17: the tool rail has no buttons', async () => {
        await openOn(flow, ROUTES.project.objects(seed.projectId, full.floorId), seed.projectId, full.floorId, OBJ.screen);
        await expect(doorOptions(page).first()).toBeVisible();
        await expect.soft(toolbar.getByRole('button')).toHaveCount(0);
        await captureEvidence(page, ev('X4-D-004', 'viewer_object_rail'));
      });

      await test.step('[17-D-003] viewer: toolbar "Công cụ lớp đối tượng" has no "Chọn nhóm …" button', async () => {
        await expect.soft(toolbar).toHaveCount(1);
        await expect.soft(page.getByRole('button', { name: /^Chọn nhóm /u })).toHaveCount(0);
        await captureEvidence(page, ev('17-D-003', 'viewer_object_toolbar'));
      });

      await test.step('[17-D-004] ⚑ viewer: the status bar notice must not say the viewer cannot view (the viewer CAN view)', async () => {
        await expect(status).toBeVisible();
        const text = (await status.innerText()).trim();
        test.info().annotations.push({ type: 'observed', description: `17-D-004 status bar: ${text}` });
        expect.soft(text, 'copy claims the viewer cannot view although the floor is shown').not.toContain(OBJ.copyWrong);
        await captureEvidence(page, ev('17-D-004', 'viewer_object_status_copy'));
      });

      await test.step('[17-D-005] viewer: symbols not clickable; right-click opens no menu', async () => {
        const symbols = canvasGroup.locator('g[role="presentation"][aria-label]');
        expect.soft(await symbols.count(), 'symbols drawn').toBeGreaterThan(0);
        expect.soft(await symbols.evaluateAll((nodes) => nodes.filter((n) => !n.getAttribute('class')?.includes('pointer-events-none')).length), 'symbols that take pointer events').toBe(0);
        await symbols.first().dispatchEvent('click');
        await symbols.first().dispatchEvent('contextmenu');
        await expect.soft(page.getByRole('menu')).toHaveCount(0);
        await expect.soft(page.locator('[role="option"][aria-selected="true"]'), 'a click on a symbol selects nothing').toHaveCount(0);
        await captureEvidence(page, ev('17-D-005', 'viewer_object_symbols'));
      });

      await test.step('[17-D-006] viewer: list rows still select; inspector read-only (type as text, swing icons, position as labels, no approve)', async () => {
        const first = doorOptions(page).first();
        await first.click();
        await expect.soft(first).toHaveAttribute('aria-selected', 'true');
        const inspector = objectInspector(page);
        await expect.soft(inspector.getByRole('combobox', { name: OBJ.type, exact: true })).toHaveCount(0);
        await expect.soft(inspector.getByRole('group', { name: OBJ.swing, exact: true })).toBeVisible();
        await expect.soft(inspector.getByRole('radiogroup')).toHaveCount(0);
        await expect.soft(inspector.getByRole('slider', { name: OBJ.position, exact: true })).toHaveCount(0);
        await expect.soft(inspector.getByRole('button', { name: OBJ.approve, exact: true })).toHaveCount(0);
        await captureEvidence(page, ev('17-D-006', 'viewer_object_inspector'));
      });

      await test.step('[17-D-007] ⚑ viewer: the canvas sr-only text must match reality (it claims zoom, and that no object can be selected, but rows select)', async () => {
        const note = page.locator(`#${OBJ.canvasNoteId}`);
        await expect.soft(note).toHaveCount(1);
        const text = (await note.textContent()) ?? '';
        test.info().annotations.push({ type: 'observed', description: `17-D-007 sr text: ${text}` });
        expect.soft(text, 'the objects canvas has no zoom control').not.toContain('phóng to');
        await expect.soft(page.locator('[role="option"][aria-selected="true"]'), 'a row IS selected').toHaveCount(1);
        expect.soft(text, 'rows can be selected').not.toContain('không chọn');
        await captureEvidence(page, ev('17-D-007', 'viewer_object_sr_text'));
      });

      await test.step('[17-D-008] viewer: status bar has no "Hoàn tác" button (BUG-601; ObjectLayerStatusBar.tsx:73-74 renders null for viewer)', async () => {
        const mark = flow.sent.length;
        const undo = status.getByRole('button', { name: OBJ.undo, exact: true });
        await expect.soft(undo, 'viewer gets no dead undo button').toHaveCount(0);
        await expect.soft(doorOptions(page).first()).toHaveAttribute('aria-selected', 'true');
        await quiet(page);
        expect.soft(writesSince(flow, mark), '"Hoàn tác" writes nothing').toEqual([]);
        await captureEvidence(page, ev('17-D-008', 'viewer_object_undo_noop'));
      });

      await test.step('[17-D-009] viewer: D / W / F / 1 / 2 / 3 / Mod+Z inert; Esc still closes the inspector', async () => {
        const mark = flow.sent.length;
        const before = (await objectInspector(page).innerText()).trim();
        for (const key of ['d', 'w', 'f', '1', '2', '3', `${MOD}+z`]) await page.keyboard.press(key);
        expect.soft((await objectInspector(page).innerText()).trim(), 'the inspector did not change').toBe(before);
        await expect.soft(doorOptions(page).first()).toHaveAttribute('aria-selected', 'true');
        await quiet(page);
        expect.soft(writesSince(flow, mark), 'a viewer sends no write').toEqual([]);
        await page.keyboard.press('Escape');
        await expect.soft(objectInspector(page).getByText(OBJ.inspectorEmpty, { exact: true })).toBeVisible();
        await captureEvidence(page, ev('17-D-009', 'viewer_object_keys'));
      });

      await test.step('[17-D-011] ⚑ viewer on a floor with one wall and no object: no "Thêm thủ công"', async () => {
        await openOn(flow, ROUTES.project.objects(seed.projectId, oneWall.floorId), seed.projectId, oneWall.floorId, OBJ.screen);
        const add = page.getByRole('button', { name: OBJ.addManually, exact: true });
        await expect(page.getByText('Chưa nhận ra đối tượng nào', { exact: true })).toBeVisible();
        await expect.soft(add, 'a viewer cannot add objects').toHaveCount(0);
        if ((await add.count()) > 0) {
          const mark = flow.sent.length;
          await add.click();
          await quiet(page);
          expect.soft(writesSince(flow, mark), 'the shown button does nothing').toEqual([]);
        }
        await captureEvidence(page, ev('17-D-011', 'viewer_object_add_manually'));
      });

      await test.step('[17-D-012] viewer: "Thu gọn hai panel" works', async () => {
        const list = page.getByRole('group', { name: OBJ.list, exact: true });
        await openOn(flow, ROUTES.project.objects(seed.projectId, full.floorId), seed.projectId, full.floorId, OBJ.screen);
        await expect(list).toBeVisible();
        await status.getByRole('button', { name: OBJ.collapse, exact: true }).click();
        await expect.soft(list).toBeHidden();
        await expect.soft(status.getByRole('button', { name: OBJ.expand, exact: true })).toBeVisible();
        await captureEvidence(page, ev('17-D-012', 'viewer_object_collapsed'));
        await status.getByRole('button', { name: OBJ.expand, exact: true }).click();
        await expect.soft(list).toBeVisible();
      });
    } finally {
      if (member !== undefined) await closeFlow(member.flow);
      await closeRolesEnv(env);
    }
  });

  /* ================================================================= FL-R-03 */

  test('SCR-20 · FL-R-03 · viewer member on SCR-20', async ({ browser }) => {
    test.setTimeout(150_000);
    let env: RolesEnv | undefined;
    let member: Member | undefined;
    try {
      env = await openRolesEnv();
      const seed = await roomsViewer(env, 'r04-fl-r-03');
      const withRooms = must(seed.floors[0], 'rooms floor');
      const noRoom = must(seed.floors[1], 'empty floor');
      const gapFloor = must(seed.floors[2], 'open-loop floor');
      member = await memberFlow(browser, env, [seed.projectId], 'viewer');
      const { flow } = member;
      const { page } = flow;

      await test.step('[X4-D-005] H: viewer on SCR-20: "Không có quyền sửa lớp phòng" + the viewer sentence', async () => {
        await openOn(flow, ROUTES.project.rooms(seed.projectId, withRooms.floorId), seed.projectId, withRooms.floorId, ROOM.screen);
        await expect(roomOptions(page).first()).toBeVisible();
        const notice = alertWith(page, ROOM.forbiddenTitle);
        await expect(notice).toBeVisible();
        await expect.soft(notice).toContainText(ROOM.viewerNotice);
        await captureEvidence(page, ev('X4-D-005', 'viewer_room_notice'));
      });

      await test.step('[20-D-001] viewer: forbidden notice (title + message)', async () => {
        const notice = alertWith(page, ROOM.forbiddenTitle);
        await expect.soft(notice.getByText(ROOM.forbiddenTitle, { exact: true })).toBeVisible();
        await expect.soft(notice.getByText(ROOM.viewerNotice, { exact: true })).toBeVisible();
        await captureEvidence(page, ev('20-D-001', 'viewer_room_forbidden'));
      });

      await test.step('[20-D-002] viewer: "Chuẩn hoá tên" hidden', async () => {
        await expect.soft(page.getByRole('button', { name: ROOM.normalize, exact: true })).toHaveCount(0);
        await captureEvidence(page, ev('20-D-002', 'viewer_room_normalize_hidden'));
      });

      await test.step('[20-D-003] viewer: inspector read-only (name and usage as text, no approve / merge / split), paragraph = the viewer notice', async () => {
        const first = roomOptions(page).first();
        await first.click();
        const inspector = roomInspector(page);
        await expect.soft(inspector.getByText(ROOM.name, { exact: true })).toBeVisible();
        await expect.soft(inspector.getByRole('textbox', { name: ROOM.name, exact: true })).toHaveCount(0);
        await expect.soft(inspector.getByText(ROOM.usage, { exact: true })).toBeVisible();
        await expect.soft(inspector.getByRole('combobox', { name: ROOM.usage, exact: true })).toHaveCount(0);
        for (const label of [ROOM.approve, ROOM.merge, ROOM.split]) {
          await expect.soft(inspector.getByRole('button', { name: label, exact: true })).toHaveCount(0);
        }
        // BUG-636: the sentence lives in the banner above the list; the inspector only carries the "Chỉ xem" badge
        // (RoomLabelInspector.tsx:158-165, VIEWER_BADGE_LABEL).
        await expect.soft(inspector.getByText(ROOM.viewerNotice, { exact: true })).toHaveCount(0);
        await expect.soft(inspector.getByText('Chỉ xem', { exact: true })).toBeVisible();
        await captureEvidence(page, ev('20-D-003', 'viewer_room_inspector'));
      });

      await test.step('[20-D-004] viewer: canvas buttons disabled + the sr-only reason', async () => {
        const canvas = page.getByRole('region', { name: ROOM.canvas, exact: true });
        const picks = canvas.locator('button[aria-pressed]');
        expect.soft(await picks.count(), 'one select button per room').toBeGreaterThan(0);
        await expect.soft(canvas.locator('button[aria-pressed]:not([disabled])')).toHaveCount(0);
        await expect.soft(page.locator(`#${ROOM.canvasNoteId}`)).toHaveText(ROOM.canvasNote);
        await captureEvidence(page, ev('20-D-004', 'viewer_room_canvas_disabled'));
      });

      await test.step('[20-D-005] viewer: list selection still opens the read-only inspector', async () => {
        const options = roomOptions(page);
        const second = options.nth(1);
        await second.click();
        await expect.soft(second).toHaveAttribute('aria-selected', 'true');
        // BUG-636: the viewer notice is ONE top banner of the screen, not inside the inspector.
        await expect.soft(page.getByText(ROOM.viewerNotice, { exact: true })).toBeVisible();
        await captureEvidence(page, ev('20-D-005', 'viewer_room_list_select'));
      });

      await test.step('[20-D-006] ⚑ viewer on a floor with no room: the empty notice, not the filter no-match line', async () => {
        await openOn(flow, ROUTES.project.rooms(seed.projectId, noRoom.floorId), seed.projectId, noRoom.floorId, ROOM.screen);
        await expect(alertWith(page, ROOM.forbiddenTitle)).toBeVisible();
        await expect.soft(page.getByText(ROOM.emptyNotice, { exact: true }), 'empty-floor copy for a viewer').toBeVisible();
        await expect.soft(page.getByText(ROOM.filterNoMatch, { exact: true }), 'no filter is on').toHaveCount(0);
        await captureEvidence(page, ev('20-D-006', 'viewer_room_empty_floor'));
      });

      await test.step('[20-D-007] viewer: "Kiểm tra lại vòng hở" works (GET only) and "Xem tại lớp tường" navigates', async () => {
        await openOn(flow, ROUTES.project.rooms(seed.projectId, gapFloor.floorId), seed.projectId, gapFloor.floorId, ROOM.screen);
        const gaps = page.getByRole('region', { name: ROOM.gaps, exact: true });
        await expect(gaps.getByRole('button', { name: ROOM.toWalls, exact: true })).toBeVisible();
        const mark = flow.sent.length;
        const reread = waitForApi(page, 'GET', layerRe(seed.projectId, gapFloor.floorId), [200]);
        await page.getByRole('button', { name: ROOM.checkGaps, exact: true }).click();
        await reread;
        expect.soft(writesSince(flow, mark), 'the re-check only reads').toEqual([]);
        await captureEvidence(page, ev('20-D-007', 'viewer_room_check_gaps'));
        await gaps.getByRole('button', { name: ROOM.toWalls, exact: true }).click();
        await expect.poll(() => pathOf(page)).toBe(ROUTES.project.walls(seed.projectId, gapFloor.floorId));
      });
    } finally {
      if (member !== undefined) await closeFlow(member.flow);
      await closeRolesEnv(env);
    }
  });

  /* ================================================================= FL-R-04 */

  test('SCR-QC · FL-R-04 · viewer member on SCR-21 and SCR-19', async ({ browser }) => {
    test.setTimeout(180_000);
    let env: RolesEnv | undefined;
    let member: Member | undefined;
    let engineer: Member | undefined;
    try {
      env = await openRolesEnv();
      const seed = await viewer2119(env, 'r04-fl-r-04');
      const mix = must(seed.floors[0], 'thickness floor');
      const empty = must(seed.floors[1], 'empty floor');
      const rect = must(seed.floors[2], 'rectangle floor');
      member = await memberFlow(browser, env, [seed.projectId], 'viewer');
      const { flow } = member;
      const { page } = flow;
      const announced = await recordAnnouncements(page);
      await page.emulateMedia({ reducedMotion: 'reduce' }); // group rows slide (layoutId): no Space on a moving row
      const tables = page.getByRole('region', { name: THICK.tables, exact: true });
      const thickRegion = region(page, THICK.screen);

      await test.step('[X4-D-006] H: viewer on SCR-21: "Không có quyền sửa độ dày tường" + the viewer sentence', async () => {
        await openOn(flow, ROUTES.project.thickness(seed.projectId, mix.floorId), seed.projectId, mix.floorId, THICK.screen);
        const notice = alertWith(page, THICK.forbiddenTitle);
        await expect(notice).toBeVisible();
        await expect.soft(notice).toContainText(THICK.viewerNotice);
        await captureEvidence(page, ev('X4-D-006', 'viewer_thickness_notice'));
      });

      await test.step('[21-D-001] ⚑ viewer: group checkboxes, row controls, row checkboxes and the "Đổi độ dày" picker must not be live', async () => {
        const accept = tables.getByRole('checkbox', { name: /^Đồng ý chuẩn hoá \d+ tường /u });
        const rowBoxes = tables.getByRole('checkbox', { name: /^Chọn dòng /u });
        const rowGroups = tables.getByRole('radiogroup', { name: /^Độ dày chuẩn hoá của đoạn /u });
        // Soft: the fix may well remove the group checkboxes for a viewer; the counts below then pass on 0 (review QA-04c).
        await expect(tables.locator('tbody tr').first(), 'the tables have their rows (loaded marker)').toBeVisible();
        const live = page.locator(':enabled');
        await expect.soft(accept.and(live), 'enabled group checkboxes').toHaveCount(0);
        await expect.soft(rowBoxes.and(live), 'enabled row checkboxes').toHaveCount(0);
        await expect.soft(rowGroups.getByRole('radio').and(live), 'enabled row group radios').toHaveCount(0);
        // The reported effect (21-D-001): if the controls are live, the picker "Áp dụng" must still write nothing.
        if ((await rowBoxes.and(live).count()) > 0) {
          const mark = flow.sent.length;
          await pressSpaceOn(rowBoxes.first());
          await expect(rowBoxes.first()).toBeChecked();
          await page.getByRole('button', { name: THICK.changeThickness, exact: true }).click();
          await page.getByRole('group', { name: 'Chọn nhóm áp cho các đoạn đã chọn', exact: true }).getByRole('button', { name: THICK.apply, exact: true }).click();
          await quiet(page);
          expect.soft(writesSince(flow, mark), 'the picker "Áp dụng" writes nothing').toEqual([]);
        }
        await captureEvidence(page, ev('21-D-001', 'viewer_thickness_controls'));
      });

      await test.step('[21-D-002] viewer: threshold sliders still recompute; no PUT', async () => {
        const mark = flow.sent.length;
        const slider = page.getByRole('slider', { name: THICK.slider, exact: true });
        await expect(slider).toBeVisible();
        const start = (await slider.getAttribute('aria-valuenow')) ?? '';
        await slider.focus();
        await page.keyboard.press('ArrowRight');
        await expect.soft(slider).not.toHaveAttribute('aria-valuenow', start);
        await page.keyboard.press('ArrowLeft');
        await expect.soft(slider).toHaveAttribute('aria-valuenow', start);
        await quiet(page);
        expect.soft(writesSince(flow, mark), 'moving a threshold writes nothing').toEqual([]);
        await captureEvidence(page, ev('21-D-002', 'viewer_thickness_slider'));
      });

      await test.step('[21-D-003] ⚑ viewer on an empty floor: the "no measurement" notice, not the screen description', async () => {
        await openOn(flow, ROUTES.project.thickness(seed.projectId, empty.floorId), seed.projectId, empty.floorId, THICK.screen);
        await expect(thickRegion.getByText(THICK.emptyTitle, { exact: true })).toBeVisible();
        await expect.soft(thickRegion.getByText(THICK.emptyNoMeasurement, { exact: true }), 'empty-floor notice for a viewer').toBeVisible();
        await captureEvidence(page, ev('21-D-003', 'viewer_thickness_empty_floor'));
      });

      await test.step('[19-D-001] viewer: SCR-19 forbidden notice in the left column', async () => {
        await openOn(flow, ROUTES.project.grids(seed.projectId, rect.floorId), seed.projectId, rect.floorId, AXIS.screen);
        const notice = alertWith(page, AXIS.forbiddenTitle);
        await expect(notice).toBeVisible();
        await expect.soft(notice.getByText(AXIS.viewerNotice, { exact: true })).toBeVisible();
        await captureEvidence(page, ev('19-D-001', 'viewer_axis_notice'));
      });

      await test.step('[19-D-002] viewer: no "Thêm trục ngang" / "Thêm trục dọc", no "Xoá trục X"; "Ẩn trục X" still present', async () => {
        await expect(axisRows(page).first()).toBeVisible();
        await expect.soft(page.getByRole('button', { name: AXIS.addH, exact: true })).toHaveCount(0);
        await expect.soft(page.getByRole('button', { name: AXIS.addV, exact: true })).toHaveCount(0);
        await expect.soft(page.getByRole('button', { name: /^Xoá trục /u })).toHaveCount(0);
        await expect.soft(page.getByRole('button', { name: /^Ẩn trục /u }).first()).toBeVisible();
        await captureEvidence(page, ev('19-D-002', 'viewer_axis_buttons'));
      });

      await test.step('[19-D-003] viewer: canvas read-only (axes take no pointer events; described by the same notice)', async () => {
        const canvasGroup = page.locator(`[aria-describedby="${AXIS.canvasNoteId}"]`);
        await expect.soft(canvasGroup).toHaveCount(1);
        await expect.soft(page.locator(`#${AXIS.canvasNoteId}`)).toHaveText(AXIS.viewerNotice);
        const axes = canvasGroup.locator('g[role="presentation"][aria-label]');
        expect.soft(await axes.count(), 'axes drawn').toBeGreaterThan(0);
        expect.soft(await axes.evaluateAll((nodes) => nodes.filter((n) => !n.getAttribute('class')?.includes('pointer-events-none')).length), 'axes that take pointer events').toBe(0);
        await captureEvidence(page, ev('19-D-003', 'viewer_axis_canvas'));
      });

      await test.step('[19-D-004] viewer: Mod+Z is bound off', async () => {
        const mark = flow.sent.length;
        const before = await axisRows(page).count();
        await page.keyboard.press(`${MOD}+z`);
        await expect.soft(axisRows(page)).toHaveCount(before);
        await quiet(page);
        expect.soft(writesSince(flow, mark)).toEqual([]);
        await captureEvidence(page, ev('19-D-004', 'viewer_axis_undo'));
      });

      await test.step('[19-D-005] ⚑ viewer: "Căn chỉnh tự động" is disabled (an enabled button that does nothing gives no feedback)', async () => {
        const auto = page.getByRole('button', { name: AXIS.autoAlign, exact: true });
        await expect.soft(auto).toBeDisabled();
        if (await auto.isEnabled()) {
          const mark = flow.sent.length;
          await auto.click();
          await quiet(page);
          expect.soft(writesSince(flow, mark), 'the enabled button writes nothing').toEqual([]);
        }
        await captureEvidence(page, ev('19-D-005', 'viewer_axis_auto_align'));
      });

      await test.step('[19-D-006] viewer on an empty floor: no EmptyState, no "Suy ra từ tường bao"; empty groups + the canvas line', async () => {
        await openOn(flow, ROUTES.project.grids(seed.projectId, empty.floorId), seed.projectId, empty.floorId, AXIS.screen);
        await expect(page.getByText(AXIS.canvasEmpty, { exact: true })).toBeVisible();
        await expect.soft(page.getByText(AXIS.emptyTitle, { exact: true })).toHaveCount(0);
        await expect.soft(page.getByRole('button', { name: AXIS.derive, exact: true })).toHaveCount(0);
        await expect.soft(axisRows(page)).toHaveCount(0);
        await captureEvidence(page, ev('19-D-006', 'viewer_axis_empty_floor'));
      });

      await test.step('[19-D-007] viewer may still pick an anchor and toggle the ghost (view state)', async () => {
        await openOn(flow, ROUTES.project.grids(seed.projectId, rect.floorId), seed.projectId, rect.floorId, AXIS.screen);
        const first = axisRows(page).first();
        await expect(first).toBeVisible();
        await first.click();
        await expect.soft(first).toHaveAttribute('aria-selected', 'true');
        const ghost = page.getByRole('switch', { name: AXIS.ghost, exact: true });
        const was = await ghost.getAttribute('aria-checked');
        await ghost.click();
        await expect.soft(ghost).not.toHaveAttribute('aria-checked', was ?? '');
        const anchor = page.getByRole('combobox', { name: AXIS.anchor });
        await anchor.click();
        const listId = await anchor.getAttribute('aria-controls');
        const options = page.locator(`[id="${listId ?? ''}"]`).getByRole('option');
        await options.last().click();
        await expect.poll(async () => (await announced()).includes(AXIS.pinned), { message: 'announcement 19-A-026' }).toBe(true);
        await captureEvidence(page, ev('19-D-007', 'viewer_axis_view_state'));
      });

      await test.step('[19-D-009] roles come from the session (account role), not the project: an engineer member of the same project gets the edit controls', async () => {
        engineer = await memberFlow(browser, env as RolesEnv, [seed.projectId], 'engineer');
        const e = engineer.flow.page;
        await openOn(engineer.flow, ROUTES.project.grids(seed.projectId, rect.floorId), seed.projectId, rect.floorId, AXIS.screen);
        await expect(axisRows(e).first()).toBeVisible();
        await expect.soft(e.getByRole('button', { name: AXIS.addH, exact: true })).toBeVisible();
        await expect.soft(e.getByRole('button', { name: /^Xoá trục /u }).first()).toBeVisible();
        await expect.soft(alertWith(e, AXIS.forbiddenTitle)).toHaveCount(0);
        await expect.soft(page.getByRole('button', { name: AXIS.addH, exact: true }), 'the viewer of the same project still has none').toHaveCount(0);
        await captureEvidence(e, ev('19-D-009', 'engineer_axis_controls_same_project'));
      });

      await test.step('[21-B-008] viewer: attention alert "Không có quyền sửa độ dày tường" + sentence; no apply bar', async () => {
        await openOn(flow, ROUTES.project.thickness(seed.projectId, mix.floorId), seed.projectId, mix.floorId, THICK.screen);
        const notice = alertWith(page, THICK.forbiddenTitle);
        await expect.soft(notice).toBeVisible();
        await expect.soft(notice).toContainText(THICK.viewerNotice);
        await expect.soft(thickRegion.getByRole('button', { name: THICK.preview, exact: true })).toHaveCount(0);
        await captureEvidence(page, ev('21-B-008', 'viewer_thickness_no_apply_bar'));
      });
    } finally {
      if (engineer !== undefined) await closeFlow(engineer.flow);
      if (member !== undefined) await closeFlow(member.flow);
      await closeRolesEnv(env);
    }
  });

  /* ================================================================= FL-R-05 */

  test('SCR-QC · FL-R-05 · viewer member on SCR-14 and SCR-22 of a framed floor', async ({ browser }) => {
    test.setTimeout(240_000);
    let env: RolesEnv | undefined;
    let member: Member | undefined;
    try {
      env = await openRolesEnv();
      const df = await framedFloor(env, 'r04-fl-r-05');
      member = await memberFlow(browser, env, [df.projectId], 'viewer');
      const { flow } = member;
      const { page } = flow;
      const notice = page.getByRole('region', { name: SCALE.notice, exact: true });

      await test.step('[X4-D-002] H: viewer on SCR-14 (framed floor): "Bạn không có quyền hiệu chỉnh tỷ lệ", no "Áp dụng tỷ lệ"', async () => {
        await openOn(flow, ROUTES.project.scale(df.projectId, df.floorId), df.projectId, df.floorId, SCALE.screen);
        await expect(scaleCanvas(page)).toBeVisible();
        await expect.soft(notice.getByText(SCALE.forbiddenTitle, { exact: true })).toBeVisible();
        await expect.soft(page.getByRole('button', { name: SCALE.apply, exact: true })).toHaveCount(0);
        await captureEvidence(page, ev('X4-D-002', 'viewer_scale_notice'));
      });

      await test.step('[14-D-003] viewer on a framed floor: forbidden notice, the drawing is still shown', async () => {
        await expect.soft(notice.getByText(SCALE.forbiddenTitle, { exact: true })).toBeVisible();
        await expect.soft(notice.getByText(SCALE.forbiddenNotice, { exact: true })).toBeVisible();
        await expect.soft(scaleCanvas(page).getByRole('img').first()).toBeVisible();
        await captureEvidence(page, ev('14-D-003', 'viewer_scale_forbidden_drawing'));
      });

      await test.step('[14-D-004] viewer: canvas not draggable (cursor not-allowed, sr description, no handles)', async () => {
        const canvas = scaleCanvas(page);
        await expect.soft(canvas).toHaveClass(/cursor-not-allowed/u);
        await expect.soft(canvas).toHaveAttribute('aria-describedby', SCALE.canvasNoteId);
        await expect.soft(page.locator(`#${SCALE.canvasNoteId}`)).toHaveText(SCALE.forbiddenNotice);
        const box = must((await canvas.boundingBox()) ?? undefined, 'scale canvas box');
        await page.mouse.move(box.x + box.width * 0.2, box.y + box.height * 0.5);
        await page.mouse.down();
        await page.mouse.move(box.x + box.width * 0.8, box.y + box.height * 0.5, { steps: 6 });
        await page.mouse.up();
        await expect.soft(page.getByRole('button', { name: SCALE.handleStart, exact: true })).toHaveCount(0);
        await expect.soft(page.getByRole('button', { name: SCALE.handleEnd, exact: true })).toHaveCount(0);
        await captureEvidence(page, ev('14-D-004', 'viewer_scale_canvas'));
      });

      await test.step('[14-D-005] viewer: method control disabled, method block aria-disabled + pointer-events none', async () => {
        const methods = page.getByRole('radiogroup', { name: SCALE.methods, exact: true });
        const radios = methods.getByRole('radio');
        expect.soft(await radios.count(), 'method options').toBeGreaterThan(0);
        await expect.soft(radios.and(page.locator(':enabled')), 'enabled method options').toHaveCount(0);
        const block = scaleRegion(page).locator('section[aria-disabled="true"]');
        await expect.soft(block).toHaveCount(1);
        await expect.soft(block).toHaveClass(/pointer-events-none/u);
        await captureEvidence(page, ev('14-D-005', 'viewer_scale_method_disabled'));
      });

      await test.step('[14-D-006] viewer (real member, was _(mock)_): the apply footer is hidden', async () => {
        await expect.soft(page.getByRole('button', { name: SCALE.apply, exact: true })).toHaveCount(0);
        await expect.soft(page.getByRole('radiogroup', { name: SCALE.scope, exact: true })).toHaveCount(0);
        await captureEvidence(page, ev('14-D-006', 'viewer_scale_footer_hidden'));
      });

      await test.step('[14-D-007] viewer: "Thu gọn bảng", wheel zoom and middle pan still work', async () => {
        const plane = scaleCanvas(page).locator('div.origin-top-left').first();
        const moved = await zoomAndPan(page, scaleCanvas(page), plane);
        expect.soft(moved.zoomed, 'wheel zoom moved the drawing').toBe(true);
        expect.soft(moved.panned, 'middle drag moved the drawing').toBe(true);
        const collapse = page.getByRole('button', { name: SCALE.collapse, exact: true });
        await collapse.click();
        await expect.soft(page.getByRole('button', { name: SCALE.expand, exact: true })).toBeVisible();
        await captureEvidence(page, ev('14-D-007', 'viewer_scale_zoom_pan_collapse'));
        await page.getByRole('button', { name: SCALE.expand, exact: true }).click();
      });

      await test.step('[X4-D-009] SCR-22 viewer (absent from the plan R-V rows) → 22-D-003 / 22-D-004', async () => {
        await openOn(flow, ROUTES.project.overlay(df.projectId, df.floorId), df.projectId, df.floorId, OVERLAY.screen);
        await expect(page.getByRole('toolbar', { name: 'Thanh công cụ đối chiếu bản vẽ', exact: true })).toBeVisible();
        await captureEvidence(page, ev('X4-D-009', 'viewer_overlay_open'));
      });

      await test.step('[22-D-003] viewer on a framed floor: forbidden notice + the toolbar read-only line', async () => {
        const state = page.locator(`[aria-label="${OVERLAY.notice}"]`);
        await expect.soft(state.getByText(OVERLAY.forbidden, { exact: true })).toBeVisible();
        // One viewer notice only (d3b2c765): OverlayComparison key `readOnlyNotice` (vi.json:2931) is unused, so the
        // separate toolbar line is gone; the notice above is useOverlayComparison.ts:128 forbiddenNotice.
        await expect.soft(page.getByText(OVERLAY.readOnlyLine, { exact: true })).toHaveCount(0);
        await captureEvidence(page, ev('22-D-003', 'viewer_overlay_forbidden'));
      });

      await test.step('[22-D-004] ⚑ viewer: "Chọn tầng", "Kiểu đối chiếu", "Độ mờ ảnh nguồn" stay usable (view-only actions); "Khoá căn" is checked + disabled', async () => {
        await expect.soft(page.getByRole('combobox', { name: OVERLAY.floor }), 'floor select').toBeEnabled();
        const modes = page.getByRole('radiogroup', { name: OVERLAY.modes, exact: true });
        await expect.soft(modes.getByRole('radio', { name: OVERLAY.swipe, exact: true }), 'compare mode').toBeEnabled();
        // Slider.tsx:144 — a disabled slider only gets tabIndex -1 (no aria-disabled), so "usable" = not -1.
        await expect.soft(page.getByRole('slider', { name: OVERLAY.opacity, exact: true }), 'scan opacity').not.toHaveAttribute('tabindex', '-1');
        // BUG-599: "Khoá căn" is not drawn at all while the image placement is unsupported (overlayComparisonGateway.ts:339).
        await expect.soft(page.getByRole('switch', { name: OVERLAY.lock, exact: true })).toHaveCount(0);
        await captureEvidence(page, ev('22-D-004', 'viewer_overlay_view_controls'));
      });

      await test.step('[22-D-005] viewer: "Trượt" unavailable so no divider; "Dung sai" and the confirm button disabled', async () => {
        // UNKNOWN — NEED VERIFICATION: the divider (tabIndex -1, pointer / key ignored, OCD:99-101,138-140,180) only mounts in "Trượt",
        // which a viewer cannot select (its radio group is disabled), so those three facts cannot be driven from the UI.
        await expect.soft(page.getByRole('slider', { name: OVERLAY.divider, exact: true })).toHaveCount(0);
        await expect.soft(page.getByLabel(OVERLAY.tolerance, { exact: true })).toBeDisabled();
        await expect.soft(page.getByRole('button', { name: OVERLAY.confirm, exact: true })).toBeDisabled();
        await captureEvidence(page, ev('22-D-005', 'viewer_overlay_tolerance_confirm'));
      });

      await test.step('[22-D-006] viewer: wheel zoom and middle pan still work', async () => {
        const plane = page.locator('[data-comparison-plane]').first();
        const host = page.getByRole('region', { name: 'Khung đối chiếu bản vẽ gốc và mô hình', exact: true });
        const moved = await zoomAndPan(page, host, plane);
        expect.soft(moved.zoomed, 'wheel zoom moved the plane').toBe(true);
        expect.soft(moved.panned, 'middle drag moved the plane').toBe(true);
        await captureEvidence(page, ev('22-D-006', 'viewer_overlay_zoom_pan'));
      });
    } finally {
      if (member !== undefined) await closeFlow(member.flow);
      await closeRolesEnv(env);
    }
  });

  /* ================================================================= FL-R-06 */

  test('SCR-QC · FL-R-06 · viewer member on the warped real default + read-only journey across every QC screen', async ({ browser }) => {
    test.setTimeout(240_000);
    let env: RolesEnv | undefined;
    let member: Member | undefined;
    try {
      env = await openRolesEnv();
      const d1 = await realFloor(env, 'r04-fl-r-06');
      member = await memberFlow(browser, env, [d1.projectId], 'viewer');
      const { flow } = member;
      const { page } = flow;
      const notice = page.getByRole('region', { name: SCALE.notice, exact: true });
      const apply = page.getByRole('button', { name: SCALE.apply, exact: true });

      await test.step('[X4-D-003] H: viewer on SCR-14 of the real default (warped) floor must get the forbidden notice (14-D-008)', async () => {
        await openOn(flow, ROUTES.project.scale(d1.projectId, d1.floorId), d1.projectId, d1.floorId, SCALE.screen);
        await expect(scaleCanvas(page)).toBeVisible();
        await expect(notice).toBeVisible();
        test.info().annotations.push({ type: 'observed', description: `X4-D-003 notice: ${(await notice.innerText()).replace(/\s+/gu, ' ').trim()}` });
        await expect.soft(notice.getByText(SCALE.forbiddenTitle, { exact: true }), 'forbidden notice for a viewer').toBeVisible();
        await captureEvidence(page, ev('X4-D-003', 'viewer_scale_warped_notice'));
      });

      await test.step('[14-D-008] ⚑ viewer on the warped real default: read-only controls (canvas not draggable, no "Áp dụng tỷ lệ"); `error` must not outrank `forbidden`', async () => {
        await expect.soft(scaleCanvas(page)).toHaveClass(/cursor-not-allowed/u);
        await expect.soft(apply, 'apply control shown to a viewer').toHaveCount(0);
        const radios = page.getByRole('radiogroup', { name: SCALE.methods, exact: true }).getByRole('radio');
        await expect.soft(radios.and(page.locator(':enabled')), 'enabled method options').toHaveCount(0);
        await captureEvidence(page, ev('14-D-008', 'viewer_scale_warped_controls'));
      });

      await test.step('[14-G-016] ⚑ viewer: no apply control exists; if it is shown, its PUT answers 403 FORBIDDEN with the failure notice', async () => {
        await expect.soft(apply, 'a viewer must have no apply control, so no 403 can be provoked').toHaveCount(0);
        if ((await apply.count()) > 0) {
          await drawReference(page);
          await page.getByRole('radiogroup', { name: SCALE.scope, exact: true }).getByRole('radio', { name: SCALE.thisFloor, exact: true }).click();
          const put = nextPut(page, d1.projectId, d1.floorId, [403]);
          await apply.click();
          const result = await put;
          expect.soft((result.json as { code?: unknown }).code, 'errors.forbidden').toBe('FORBIDDEN');
          await expect.soft(page.getByText(SCALE.applyFailed, { exact: false })).toBeVisible();
        }
        await captureEvidence(page, ev('14-G-016', 'viewer_scale_apply_403'));
      });

      await test.step('[22-D-007] viewer on the frame-missing default (SCR-22): error alert, no forbidden notice, controls disabled', async () => {
        await openOn(flow, ROUTES.project.overlay(d1.projectId, d1.floorId), d1.projectId, d1.floorId, OVERLAY.screen);
        const state = page.locator(`[aria-label="${OVERLAY.notice}"]`);
        await expect(state).toBeVisible();
        await expect.soft(state.getByText(OVERLAY.frameMissing, { exact: true })).toBeVisible();
        await expect.soft(page.getByText(OVERLAY.forbidden, { exact: true })).toHaveCount(0);
        // BUG-599: no lock switch while the gateway cannot place the image (overlayComparisonGateway.ts:339, OverlayComparisonToolbar.tsx:~226).
        await expect.soft(page.getByRole('switch', { name: OVERLAY.lock, exact: true })).toHaveCount(0);
        await captureEvidence(page, ev('22-D-007', 'viewer_overlay_frame_missing'));
      });

      await test.step('[22-C-004] state order loading → error → empty → forbidden: the viewer sees the error alert and the controls stay disabled', async () => {
        await expect.soft(alertWith(page, OVERLAY.frameMissing)).toBeVisible();
        // 22-D-004 (catalog-C4.md:328, OCT:90,137): "Chọn tầng" is a view-only action and stays usable for a viewer, also here.
        await expect.soft(page.getByRole('combobox', { name: OVERLAY.floor })).toBeEnabled();
        // 22-D-004 also keeps "Kiểu đối chiếu" usable for a viewer (view-only); 22-C-004's "controls stay disabled" is the edit
        // controls (lock, tolerance: OverlayComparison.tsx:117, OverlayComparisonToolbar.tsx:222). R1 p04-r1 PNG: 3 radios enabled.
        await expect.soft(page.getByRole('radiogroup', { name: OVERLAY.modes, exact: true }).getByRole('radio').and(page.locator(':enabled'))).toHaveCount(3);
        // Opacity is a view control too (catalog-C4.md:328 22-D-004 "expected view controls stay usable"; OverlayComparisonToolbar.test.tsx:148): tabindex 0, not -1.
        await expect.soft(page.getByRole('slider', { name: OVERLAY.opacity, exact: true })).toHaveAttribute('tabindex', '0'); // Slider.tsx:144
        await captureEvidence(page, ev('22-C-004', 'viewer_overlay_error_outranks_forbidden'));
      });

      await test.step('[X4-D-007] viewer walking SCR-16 → tree → 17/18/19/20 → SCR-14 → SCR-22: zero PUT/POST/PATCH/DELETE on any click or key', async () => {
        const mark = flow.sent.length;
        const walls = ROUTES.project.walls(d1.projectId, d1.floorId);
        await openWalls(flow, d1.projectId, d1.floorId);
        const stops: ReadonlyArray<readonly [string, string, string]> = [
          ['Cửa và nội thất', ROUTES.project.objects(d1.projectId, d1.floorId), OBJ.screen],
          ['Kích thước', ROUTES.project.dimensions(d1.projectId, d1.floorId), 'Đọc kích thước OCR'],
          ['Trục', ROUTES.project.grids(d1.projectId, d1.floorId), AXIS.screen],
          ['Phòng', ROUTES.project.rooms(d1.projectId, d1.floorId), ROOM.screen],
        ];
        for (const [label, target, screen] of stops) {
          await page.getByRole('tree', { name: 'Cây lớp', exact: true }).getByRole('treeitem', { name: label, exact: true }).click();
          await expect.poll(() => pathOf(page)).toBe(target);
          await expect(region(page, screen)).toBeVisible();
          for (const key of ['Backspace', 'Delete', `${MOD}+z`]) await page.keyboard.press(key);
          await spaGo(page, walls);
          await expect(region(page, WALL.screen)).toBeVisible();
        }
        for (const [target, screen] of [
          [ROUTES.project.scale(d1.projectId, d1.floorId), SCALE.screen],
          [ROUTES.project.overlay(d1.projectId, d1.floorId), OVERLAY.screen],
        ] as const) {
          await spaGo(page, target);
          await expect(region(page, screen)).toBeVisible();
          for (const key of ['Backspace', 'Delete', `${MOD}+z`]) await page.keyboard.press(key);
        }
        await quiet(page);
        expect.soft(writesSince(flow, mark), 'a viewer walking every QC screen writes nothing').toEqual([]);
        await captureEvidence(page, ev('X4-D-007', 'viewer_journey_zero_writes'));
      });
    } finally {
      if (member !== undefined) await closeFlow(member.flow);
      await closeRolesEnv(env);
    }
  });

  /* ================================================================= FL-R-07 */

  test('SCR-QC · FL-R-07 · engineer member walks every QC screen with edit controls', async ({ browser }) => {
    test.setTimeout(300_000);
    let env: RolesEnv | undefined;
    let member: Member | undefined;
    try {
      env = await openRolesEnv();
      const q1 = await q1Project(env, 'r04-fl-r-07');
      const q1Floor = must(q1.floors[0], 'Q1 floor');
      const df = await framedFloor(env, 'r04-fl-r-07df');
      member = await memberFlow(browser, env, [q1.projectId, df.projectId], 'engineer');
      const { flow } = member;
      const { page } = flow;
      const enabled = page.locator(':enabled');

      await test.step('[X4-D-008] H: engineer walking the same journey: every edit control present and enabled (role = account role)', async () => {
        await openWalls(flow, q1.projectId, q1Floor.floorId);
        await wallOptions(page).first().click();
        await expect.soft(page.getByRole('button', { name: WALL.draw, exact: true }).and(enabled)).toHaveCount(1);
        await expect.soft(page.getByRole('button', { name: WALL.approve, exact: true }).and(enabled)).toHaveCount(1);
        await openOn(flow, ROUTES.project.objects(q1.projectId, q1Floor.floorId), q1.projectId, q1Floor.floorId, OBJ.screen);
        await expect.soft(page.getByRole('button', { name: /^Chọn nhóm /u }).first()).toBeEnabled();
        await openOn(flow, ROUTES.project.grids(q1.projectId, q1Floor.floorId), q1.projectId, q1Floor.floorId, AXIS.screen);
        await expect.soft(page.getByRole('button', { name: AXIS.addH, exact: true })).toBeEnabled();
        await openOn(flow, ROUTES.project.rooms(q1.projectId, q1Floor.floorId), q1.projectId, q1Floor.floorId, ROOM.screen);
        await expect.soft(page.getByRole('button', { name: ROOM.normalize, exact: true })).toBeEnabled();
        await openOn(flow, ROUTES.project.thickness(q1.projectId, q1Floor.floorId), q1.projectId, q1Floor.floorId, THICK.screen);
        await expect.soft(page.getByRole('button', { name: THICK.preview, exact: true })).toBeEnabled();
        await openOn(flow, ROUTES.project.scale(df.projectId, df.floorId), df.projectId, df.floorId, SCALE.screen);
        await expect.soft(page.getByRole('button', { name: SCALE.apply, exact: true })).toBeVisible();
        await openOn(flow, ROUTES.project.overlay(df.projectId, df.floorId), df.projectId, df.floorId, OVERLAY.screen);
        // BUG-599: the lock switch is drawn only when the image placement is supported (overlayComparisonGateway.ts:339 = false).
        await expect.soft(page.getByRole('switch', { name: OVERLAY.lock, exact: true })).toHaveCount(0);
        await captureEvidence(page, ev('X4-D-008', 'engineer_journey_controls'));
      });

      await test.step('[16-D-010] engineer (real member, was _(mock)_): approve enabled, radiogroup "Độ dày tường" present', async () => {
        await openWalls(flow, q1.projectId, q1Floor.floorId);
        const first = wallOptions(page).first();
        await first.click();
        await expect.soft(page.getByRole('button', { name: WALL.approve, exact: true })).toBeEnabled();
        await expect.soft(page.getByRole('radiogroup', { name: WALL.thickness, exact: true })).toBeVisible();
        await expect.soft(alertWith(page, WALL.viewerNotice)).toHaveCount(0);
        await captureEvidence(page, ev('16-D-010', 'engineer_wall_controls'));
      });

      await test.step('[17-D-002] engineer member: same controls; approve → PUT 200', async () => {
        await openOn(flow, ROUTES.project.objects(q1.projectId, q1Floor.floorId), q1.projectId, q1Floor.floorId, OBJ.screen);
        const first = doorOptions(page).first();
        await first.click();
        const approve = page.getByRole('button', { name: OBJ.approve, exact: true });
        await expect(approve).toBeEnabled();
        const put = nextPut(page, q1.projectId, q1Floor.floorId, [200]);
        await approve.click();
        await put;
        await captureEvidence(page, ev('17-D-002', 'engineer_object_approve_put'));
      });

      await test.step('[19-D-008] engineer member edits like admin: add and remove an axis', async () => {
        await openOn(flow, ROUTES.project.grids(q1.projectId, q1Floor.floorId), q1.projectId, q1Floor.floorId, AXIS.screen);
        await expect(axisRows(page).first()).toBeVisible();
        const before = await axisRows(page).count();
        await page.getByRole('button', { name: AXIS.addH, exact: true }).click();
        await expect.soft(axisRows(page)).toHaveCount(before + 1);
        await page.getByRole('button', { name: /^Xoá trục /u }).last().click();
        await page.getByRole('dialog').getByRole('button', { name: /^Xoá trục /u }).click(); // ConfirmDeleteDialog
        await expect.soft(axisRows(page)).toHaveCount(before);
        await captureEvidence(page, ev('19-D-008', 'engineer_axis_add_remove'));
      });

      await test.step('[20-D-009] engineer member edits normally: rename a room → PUT 200', async () => {
        await openOn(flow, ROUTES.project.rooms(q1.projectId, q1Floor.floorId), q1.projectId, q1Floor.floorId, ROOM.screen);
        await roomOptions(page).first().click();
        const name = page.getByRole('textbox', { name: ROOM.name });
        await expect(name).toBeEditable();
        const newName = (await name.inputValue()) === 'Phòng QA' ? 'Phòng QA 2' : 'Phòng QA';
        const put = nextPut(page, q1.projectId, q1Floor.floorId, [200]);
        await name.fill(newName);
        await name.press('Enter');
        await put;
        await captureEvidence(page, ev('20-D-009', 'engineer_room_rename_put'));
      });

      await test.step('[21-D-004] engineer: apply bar present, "Xem trước" and "Áp dụng" enabled, apply works', async () => {
        await page.emulateMedia({ reducedMotion: 'reduce' }); // group rows slide (layoutId): no click on a moving row
        await openOn(flow, ROUTES.project.thickness(q1.projectId, q1Floor.floorId), q1.projectId, q1Floor.floorId, THICK.screen);
        const thick = region(page, THICK.screen);
        const accept = thick.getByRole('checkbox', { name: /^Đồng ý chuẩn hoá \d+ tường /u }).first();
        await expect(accept).toBeVisible();
        await pressSpaceOn(accept);
        await expect(accept).toBeChecked();
        await thick.getByRole('button', { name: THICK.preview, exact: true }).click();
        const apply = thick.getByRole('button', { name: THICK.apply, exact: true });
        await expect(apply).toBeEnabled();
        const put = nextPut(page, q1.projectId, q1Floor.floorId, [200]);
        await apply.click();
        await put;
        await captureEvidence(page, ev('21-D-004', 'engineer_thickness_apply_put'));
      });

      await test.step('[14-D-002] engineer: canvas draggable, controls enabled, apply → PUT 200', async () => {
        await openOn(flow, ROUTES.project.scale(df.projectId, df.floorId), df.projectId, df.floorId, SCALE.screen);
        await expect(scaleCanvas(page)).toBeVisible();
        await expect.soft(scaleCanvas(page)).not.toHaveClass(/cursor-not-allowed/u);
        await drawReference(page);
        await page.getByRole('radiogroup', { name: SCALE.scope, exact: true }).getByRole('radio', { name: SCALE.thisFloor, exact: true }).click();
        const apply = page.getByRole('button', { name: SCALE.apply, exact: true });
        await expect(apply).toBeEnabled();
        const put = nextPut(page, df.projectId, df.floorId, [200]);
        await apply.click();
        await put;
        await captureEvidence(page, ev('14-D-002', 'engineer_scale_apply_put'));
      });

      await test.step('[22-D-002] engineer: SCR-22 same as admin (no forbidden notice, view controls and "Khoá căn" enabled)', async () => {
        await openOn(flow, ROUTES.project.overlay(df.projectId, df.floorId), df.projectId, df.floorId, OVERLAY.screen);
        await expect.soft(page.getByText(OVERLAY.forbidden, { exact: true })).toHaveCount(0);
        await expect.soft(page.getByText(OVERLAY.readOnlyLine, { exact: true })).toHaveCount(0);
        await expect.soft(page.getByRole('combobox', { name: OVERLAY.floor })).toBeEnabled();
        // BUG-599: no lock switch for anyone while the image placement is unsupported (overlayComparisonGateway.ts:339).
        await expect.soft(page.getByRole('switch', { name: OVERLAY.lock, exact: true })).toHaveCount(0);
        await expect.soft(page.getByLabel(OVERLAY.tolerance, { exact: true })).toBeEnabled();
        await captureEvidence(page, ev('22-D-002', 'engineer_overlay_controls'));
      });
    } finally {
      if (member !== undefined) await closeFlow(member.flow);
      await closeRolesEnv(env);
    }
  });

  /* ================================================================= FL-R-08 */

  test('SCR-QC · FL-R-08 · engineer member demoted to viewer mid-session → save 403 on SCR-16, SCR-17, SCR-20', async ({ browser }) => {
    test.setTimeout(240_000);
    let env: RolesEnv | undefined;
    let member: Member | undefined;
    let restore: (() => Promise<number>) | undefined;
    try {
      env = await openRolesEnv();
      const roles = env;
      const q1 = await q1Project(env, 'r04-fl-r-08');
      const floor = must(q1.floors[0], 'Q1 floor');
      const user = await poolUser(env.main, 'engineer', DEMOTE_SLOT);
      // The original role of the `engineer:p04-demote` slot is the slot role (PoolUser.role); #38 is capped, so it is not read back.
      restore = () => setRole(roles, user, user.role);
      // Baseline BEFORE the login: a leftover viewer role from a crashed run is put back first (#41 bumps the token version).
      expect(await setRole(env, user, user.role), 'setup: baseline role engineer (idempotent #41)').toBe(200);
      member = await memberFlow(browser, env, [q1.projectId], 'engineer', DEMOTE_SLOT);
      const wallsPage = member.flow.page;
      const objectsPage = await member.flow.context.newPage();
      const roomsPage = await member.flow.context.newPage();
      const roomsLog = watchApi(roomsPage);

      // The three screens are opened and a target is selected while the account is still an engineer.
      await openWalls(member.flow, q1.projectId, floor.floorId);
      await wallOptions(wallsPage).first().click();
      await expect(wallsPage.getByRole('button', { name: WALL.approve, exact: true })).toBeEnabled();
      await openLayerScreen(objectsPage, ROUTES.project.objects(q1.projectId, floor.floorId), q1.projectId, floor.floorId);
      await expect(region(objectsPage, OBJ.screen)).toBeVisible();
      await doorOptions(objectsPage).first().click();
      await expect(objectsPage.getByRole('button', { name: OBJ.approve, exact: true })).toBeEnabled();
      await openLayerScreen(roomsPage, ROUTES.project.rooms(q1.projectId, floor.floorId), q1.projectId, floor.floorId);
      await expect(region(roomsPage, ROOM.screen)).toBeVisible();
      await roomOptions(roomsPage).first().click();
      await expect(roomsPage.getByRole('button', { name: ROOM.approve, exact: true })).toBeEnabled();
      // A fourth screen for 20-D-008: after its first refused save a screen flips to read-only (the refreshed role), so the
      // rename needs its own page that is still showing the engineer controls when the demotion happens.
      const renamePage = await member.flow.context.newPage();
      await openLayerScreen(renamePage, ROUTES.project.rooms(q1.projectId, floor.floorId), q1.projectId, floor.floorId);
      await expect(region(renamePage, ROOM.screen)).toBeVisible();
      await roomOptions(renamePage).nth(1).click();
      await expect(renamePage.getByRole('textbox', { name: ROOM.name })).toBeEditable();

      expect(await setRole(env, user, 'viewer'), 'setup: #41 engineer → viewer while the three screens are open').toBe(200);

      let objectPut: ApiResult | undefined;

      await test.step('[16-B-024] H: PUT 403 (role removed while open) → violation banner "Bạn không còn quyền sửa tầng này.", no "Tải lại"', async () => {
        await wallsPage.bringToFront(); // a background tab cannot be screenshotted
        const put = nextPut(wallsPage, q1.projectId, floor.floorId, [403]);
        await wallsPage.getByRole('button', { name: WALL.approve, exact: true }).click();
        await put;
        const banner = alertWith(wallsPage, WALL.forbidden);
        await expect(banner).toBeVisible();
        await expect.soft(banner, 'violation level (FloorLayerSaveBanner.tsx:27, InlineAlert.tsx:33)').toHaveClass(/border-state-violation/u);
        await expect.soft(banner.getByRole('button', { name: WALL.reload, exact: true })).toHaveCount(0);
        await captureEvidence(wallsPage, ev('16-B-024', 'demoted_wall_save_403'));
      });

      await test.step('[17-B-022] save 403 on SCR-17 → violation banner "Bạn không còn quyền sửa tầng này." (no button)', async () => {
        await objectsPage.bringToFront();
        // 200 too, so [17-G-015] reads the status the server really gave instead of one the wait filtered for.
        const put = nextPut(objectsPage, q1.projectId, floor.floorId, [200, 403]);
        await objectsPage.getByRole('button', { name: OBJ.approve, exact: true }).click();
        objectPut = await put;
        const banner = alertWith(objectsPage, WALL.forbidden);
        await expect(banner).toBeVisible();
        await expect.soft(banner).toHaveClass(/border-state-violation/u); // FloorLayerSaveBanner.tsx:27, InlineAlert.tsx:33
        await expect.soft(banner.getByRole('button')).toHaveCount(0);
        await captureEvidence(objectsPage, ev('17-B-022', 'demoted_object_save_403'));
      });

      await test.step('[17-G-015] PUT 403 FORBIDDEN → forbidden banner (17-B-022)', async () => {
        expect(objectPut, 'the SCR-17 PUT of the previous step').toBeDefined();
        expect(objectPut?.response.status(), 'the server refused the demoted account').toBe(403);
        expect.soft((objectPut?.json as { code?: unknown } | undefined)?.code, 'wire error code').toBe('FORBIDDEN');
        await expect.soft(alertWith(objectsPage, WALL.forbidden)).toBeVisible();
        await captureEvidence(objectsPage, ev('17-G-015', 'demoted_object_forbidden_code'));
      });

      await test.step('[20-G-011] PUT 403 on SCR-20 → blocked banner "Bạn không còn quyền sửa tầng này."', async () => {
        await roomsPage.bringToFront();
        const put = nextPut(roomsPage, q1.projectId, floor.floorId, [403]);
        put.catch(() => undefined);
        await roomsPage.getByRole('button', { name: ROOM.approve, exact: true }).click();
        try {
          await put;
        } catch (error) {
          await attachJson('R04_20-G-011_rooms_page_log.json', { url: roomsPage.url(), log: roomsLog.map(describeEntry) });
          await captureEvidence(roomsPage, ev('20-G-011', 'demoted_room_save_no_put'));
          throw error;
        }
        await expect.soft(alertWith(roomsPage, WALL.forbidden)).toBeVisible();
        await captureEvidence(roomsPage, ev('20-G-011', 'demoted_room_save_403'));
      });

      await test.step('[20-D-008] account role engineer in the page, viewer on the server: the controls are on, the rename is refused (PUT 403 → banner)', async () => {
        await renamePage.bringToFront();
        const name = renamePage.getByRole('textbox', { name: ROOM.name });
        await expect.soft(name, 'the page still offers the edit controls').toBeEditable();
        await captureEvidence(renamePage, ev('20-D-008', 'demoted_room_controls_on')); // before the rename: the stale engineer UI
        const current = await name.inputValue();
        const put = nextPut(renamePage, q1.projectId, floor.floorId, [403]);
        await name.fill(`${current} QA`);
        await name.press('Enter');
        await put;
        await expect.soft(alertWith(renamePage, WALL.forbidden)).toBeVisible();
        await captureEvidence(renamePage, ev('20-D-008', 'demoted_room_rename_403'));
      });
    } finally {
      if (restore !== undefined) {
        const status = await restore().catch(() => -1);
        test.info().annotations.push({ type: 'role-restore', description: `#41 back to the slot role → ${String(status)}` });
        expect.soft(status, 'cleanup: the demoted pool engineer got its role back').toBe(200);
      }
      if (member !== undefined) await closeFlow(member.flow);
      await closeRolesEnv(env);
    }
  });

  /* ================================================================= FL-R-09 */

  test('SCR-QC · FL-R-09 · non-member admin and anonymous deep links on every QC route', async ({ browser }) => {
    test.setTimeout(300_000);
    let env: RolesEnv | undefined;
    let outsider: Flow | undefined;
    let anon: Awaited<ReturnType<typeof browser.newContext>> | undefined;
    try {
      env = await openRolesEnv();
      const q1 = await q1Project(env, 'r04-fl-r-09');
      const q1Floor = must(q1.floors[0], 'Q1 floor');
      const d1 = await realFloor(env, 'r04-fl-r-09d1');
      // A2: the MAIN admin account is an admin and not a member of the projects of the pool admin.
      const { email, password } = readAdminCredentials();
      outsider = await openFlow(browser, { email, password });
      const page = outsider.page;

      const notFound = async (url: string, screen: string): Promise<void> => {
        await page.goto(url);
        await expect(region(page, screen)).toBeVisible();
        await expect.soft(page.getByText(NOT_FOUND.title, { exact: true })).toBeVisible();
        await expect.soft(page.getByRole('button', { name: NOT_FOUND.back, exact: true })).toBeVisible();
      };

      await test.step('[16-D-011] H: admin who is not a member opens SCR-16 → N16 404 project → "Không tìm thấy dự án này"', async () => {
        await notFound(ROUTES.project.walls(q1.projectId, q1Floor.floorId), WALL.screen);
        await captureEvidence(page, ev('16-D-011', 'outsider_walls_not_found'));
      });

      await test.step('[17-D-013] non-member deep link SCR-17 → "Không tìm thấy dự án này"', async () => {
        await notFound(ROUTES.project.objects(q1.projectId, q1Floor.floorId), OBJ.screen);
        await captureEvidence(page, ev('17-D-013', 'outsider_objects_not_found'));
      });

      await test.step('[19-D-010] non-member admin SCR-19 → read-failure screen "Không tìm thấy dự án này"', async () => {
        await notFound(ROUTES.project.grids(q1.projectId, q1Floor.floorId), AXIS.screen);
        await captureEvidence(page, ev('19-D-010', 'outsider_grids_not_found'));
      });

      await test.step('[20-D-010] non-member admin SCR-20 → "Không tìm thấy dự án này"', async () => {
        await notFound(ROUTES.project.rooms(q1.projectId, q1Floor.floorId), ROOM.screen);
        await captureEvidence(page, ev('20-D-010', 'outsider_rooms_not_found'));
      });

      await test.step('[21-D-005] admin not a member, SCR-21 → 404 project screen', async () => {
        await notFound(ROUTES.project.thickness(q1.projectId, q1Floor.floorId), THICK.screen);
        await captureEvidence(page, ev('21-D-005', 'outsider_thickness_not_found'));
      });

      await test.step('[14-D-009] ⚑ non-member deep link SCR-14: the project not-found screen (no ProjectSpatialGate today → a read error with a code)', async () => {
        await page.goto(ROUTES.project.scale(d1.projectId, d1.floorId));
        await expect(scaleRegion(page)).toBeVisible();
        await expect(page.getByText(NOT_FOUND.scaleCode).or(page.getByText(NOT_FOUND.title, { exact: true })).first()).toBeVisible();
        await expect.soft(page.getByText(NOT_FOUND.title, { exact: true }), 'project not-found screen').toBeVisible();
        await expect.soft(page.getByText(NOT_FOUND.scaleCode), 'raw code is not for the reader').toHaveCount(0);
        await captureEvidence(page, ev('14-D-009', 'outsider_scale_not_found'));
      });

      await test.step('[22-D-008] ⚑ non-member / unknown project SCR-22: the project not-found screen, not "Dự án này chưa có tầng nào để đối chiếu."', async () => {
        await page.goto(ROUTES.project.overlay(d1.projectId, d1.floorId));
        await expect(region(page, OVERLAY.screen)).toBeVisible();
        await expect(page.getByText(NOT_FOUND.title, { exact: true }).or(page.getByText(OVERLAY.noFloor, { exact: true })).first()).toBeVisible();
        await expect.soft(page.getByText(NOT_FOUND.title, { exact: true }), 'project not-found screen').toBeVisible();
        await expect.soft(page.getByText(OVERLAY.noFloor, { exact: true }), 'wrong "no floors" copy').toHaveCount(0);
        await captureEvidence(page, ev('22-D-008', 'outsider_overlay_not_found'));
      });

      await test.step('[14-D-010] anonymous deep link on every QC route → /login?next=… with "Hãy đăng nhập để tiếp tục."', async () => {
        anon = await browser.newContext({ baseURL: readBaseUrl() });
        const routes = [
          ROUTES.project.walls(q1.projectId, q1Floor.floorId),
          ROUTES.project.objects(q1.projectId, q1Floor.floorId),
          ROUTES.project.dimensions(q1.projectId, q1Floor.floorId),
          ROUTES.project.grids(q1.projectId, q1Floor.floorId),
          ROUTES.project.rooms(q1.projectId, q1Floor.floorId),
          ROUTES.project.thickness(q1.projectId, q1Floor.floorId),
          ROUTES.project.scale(d1.projectId, d1.floorId),
          ROUTES.project.overlay(d1.projectId, d1.floorId),
        ];
        let last: Page | undefined;
        for (const route of routes) {
          const anonPage = await anon.newPage();
          await anonPage.goto(route);
          await expect.poll(() => `${pathOf(anonPage)}${new URL(anonPage.url()).search}`).toBe(`/login?next=${encodeURIComponent(route)}`);
          await expect.soft(alertWith(anonPage, SIGN_IN_REQUIRED), route).toBeVisible();
          if (last !== undefined) await last.close();
          last = anonPage;
        }
        if (last !== undefined) await captureEvidence(last, ev('14-D-010', 'anonymous_deep_link_login'));
      });
    } finally {
      if (anon !== undefined) await anon.close().catch(() => undefined);
      if (outsider !== undefined) await closeFlow(outsider);
      await closeRolesEnv(env);
    }
  });
});

