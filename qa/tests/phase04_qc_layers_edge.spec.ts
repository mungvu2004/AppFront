/**
 * Phase 4 — EDGE CASES, Track A (admin): SCR-16 walls, SCR-17 objects, SCR-18 dimensions, SCR-19 axes, SCR-20 rooms,
 * SCR-21 thickness, SCR-14 scale, SCR-22 overlay. Gaps left by `phase04_qc_layers.spec.ts` (serial, CP-5 work floor);
 * inventory in `qa/coverage/phase04.md` (FE stamp 60778e96).
 *
 * Every expected result cites the FE source of `F:/App/AppFront` @ 60778e96 (8f03047b for tests authored before it) or, written `BE:`, AppBack (`apps/api/…`,
 * `packages/…`). Short names:
 *   W   src/screens/qc/WallLayerReview/  (UW useWallLayerReview.ts, WG wallLayerReviewGateway.ts, WLP WallLayerLeftPanel.tsx,
 *       WL WallLayerList.tsx, WI WallLayerInspector.tsx, WTR WallLayerToolRail.tsx, FSB FloorLayerSaveBanner.tsx,
 *       FSC FloorLayerSaveConfirm.tsx)
 *   O   src/screens/qc/ObjectLayerReview/ (UO useObjectLayerReview.ts, OG objectLayerReviewGateway.ts, OV ObjectLayerReview.tsx,
 *       OI ObjectLayerInspector.tsx)
 *   D   src/screens/qc/DimensionOcrReview/ (DV DimensionOcrReview.tsx, DT dimensionOcrText.ts)
 *   A   src/screens/qc/AxisGridManager/ (UA useAxisGridManager.ts, AV AxisGridManager.tsx, ALP AxisGridLeftPanel.tsx)
 *   R   src/screens/qc/RoomLabelReview/ (UR useRoomLabelReview.ts, RV RoomLabelReview.tsx, RNF RoomLabelNameField.tsx,
 *       RNP RoomLabelNormalizePreview.tsx, RAD RoomLabelActionDialogs.tsx, RLP RoomLabelLeftPanel.tsx, RG roomLabelReviewGateway.ts)
 *   T   src/screens/qc/ThicknessStandardization/ (UT useThicknessStandardization.ts, TV ThicknessStandardization.tsx,
 *       TAB ThicknessApplyBar.tsx, TGT ThicknessGroupTable.tsx)
 *   S   src/screens/pipeline/ScaleCalibration/ (US useScaleCalibration.ts, SV ScaleCalibration.tsx, SP ScaleCalibrationPanel.tsx,
 *       SMR ScaleCalibrationMethodReference.tsx)
 *   V   src/screens/viewer/OverlayComparison/ (UV useOverlayComparison.ts, VV OverlayComparison.tsx, VT OverlayComparisonToolbar.tsx,
 *       VP OverlayComparisonPanel.tsx, VG overlayComparisonGateway.ts)
 *   UFL src/hooks/useFloorLayer.ts   UAS src/hooks/useAutosave.ts   SLS src/lib/autosave/spatialLayerSave.ts
 *   FLRF src/screens/qc/shared/floorLayerReadFailure.ts (a failed first layer read replaces the whole screen, BUG-326)
 *   PSGATE src/components/feedback/ProjectSpatialGate.tsx
 *   I18N src/i18n/vi.json (`errors.*`)   MOD src/components/overlay/Modal.tsx
 *
 * ## Non-serial
 * Every test opens its OWN browser context from the stored admin session (`ADMIN_STORAGE_STATE_FILE`, refreshed by
 * `ensureAdminSession`; a dead session costs one UI sign-in) and creates its OWN project through the real API
 * (`POST /api/projects`, name `qa-<runId>-e04-…`, one floor "Tầng 1") that it deletes in `finally`. The layer a test needs
 * is written through the REAL #35 route (`PUT …/floors/:f/spatial/layer`, BE:apps/api/spatial_write/router.py:45-67) with
 * W4 ids (`W-…`/`D-…`/`R-…`, BE:packages/core/ids.py:23-31,92-94) and no critical integrity issue
 * (BE:packages/domain/spatial/integrity.py:38-98). Nothing reads the Phase 3/4 checkpoints (CP-2…CP-6): the shared work
 * floor is never touched. One test uploads the real `E2E_DRAWING_PNG` to its own floor (scale reference line).
 *
 * ## Mocks — "[mocked response]" in the title (1 of 30)
 * - `GET …/spatial/layer` 500 on SCR-16 — unpairable: 5xx is not producible on the shared stack. Needs its
 *   "unpairable" row in `coverage/phase04-be.md` (BE agent).
 * Everything else is the real stack: 404 floor / 404 project, the 409 W20 conflict (a real API write in between),
 * all layer PUTs.
 *
 * ## Writes on the real stack (own `qa-<runId>-e04-…` projects only)
 * Projects created/deleted; their layer written by API and by the screens; one real PNG upload (it starts one fake-ML
 * pipeline run on its own project). No mail, no account change, no registry change.
 *
 * ## Real-backend budget per run (BE defaults; QA stack override `qa-limits.override.yml`)
 * - `POST /api/auth/login` (120 / 60 s per IP on the QA stack): 0 when the stored session is alive; 1 UI sign-in when it is
 *   dead. No failed login.
 * - `POST /api/auth/refresh` (300 / 60 s): 2 per test (session check + fixture token) + 1 per page load ≈ 4–6 per test,
 *   ≈ 165 for the 30 tests spread over several minutes.
 * - `POST /api/projects`: 29 (every test except the unknown-project one), each deleted in `finally`; no rate limit
 *   (BE:apps/api/projects/router.py:54).
 * - `PUT …/spatial/layer`: ≈ 2 per seeded test (API seed + screen writes); no rate limit (BE:spatial_write/router.py).
 * - `POST …/floors/:fid/drawings/uploads` (`drawings_init` 60 per window per user, BE:drawings/router.py:39-46): 1.
 */
import { existsSync } from 'node:fs';

import { expect, test } from '@playwright/test';
import type { Browser, BrowserContext, Locator, Page, Route } from '@playwright/test';

import { displayCodesOf } from '../../src/domain/spatial/ids';
import { ROUTES } from '../../e2e/fixtures/routes';
import { TOUR_APPEAR_TIMEOUT_MS, dismissTour } from '../../e2e/fixtures/tour';
import { navigateThenWaitForApi, waitForApi, waitForApiWhere, watchApi } from '../../e2e/fullstack/apiWatch';
import type { ApiEntry, ApiResult } from '../../e2e/fullstack/apiWatch';
import { AUTOSAVE_TIMEOUT_MS, PIPELINE_TIMEOUT_MS, readBaseUrl } from '../../e2e/fullstack/env';
import { ensureAdminSession } from './support/auth';
import { TEST_DATA_PREFIX, attachJson, captureEvidence } from './support/evidence';
import { ADMIN_STORAGE_STATE_FILE } from './support/state';

/* ---------------------------------------------------------------- constants (each cites its source) */

const DESKTOP = { width: 1440, height: 900 } as const;
/** UV:165 `(width < 1280px)` → collapsed. */
const NARROW = { width: 1024, height: 800 } as const;
/** Phone width the Modal.Footer wrap targets (MOD:208 `flex-wrap`, c2a90d5e "stay inside 375 px"). */
const PHONE = { width: 375, height: 812 } as const;
type Viewport = { readonly width: number; readonly height: number };

/** Autosave fires 800 ms after the last change (UAS, A7); a "nothing was sent" claim waits past it plus a round trip. */
const QUIET_MS = 2_500;
const REFRESH_API = '/api/auth/refresh';
const PROJECTS_API = '/api/projects';
const FLOOR_NAME = 'Tầng 1';
const FLOOR_HEIGHT_MM = 3_000;

const TOASTS = 'Thông báo'; // components/feedback/Toast.tsx:176

/* SCR-16 copy. */
const WALL = {
  screen: 'Duyệt lớp tường', // W/WallLayerReview.tsx:84
  list: 'Danh sách đoạn tường', // WL:58
  emptyTitle: 'Chưa có đoạn tường nào', // WL:59
  emptyNotice:
    'Chưa phát hiện được đoạn tường nào ở tầng này. Bạn có thể vẽ tường thủ công bằng phím W, hoặc chạy lại với ngưỡng thấp hơn.', // UW:205
  noMatch: 'Không có đoạn tường nào khớp bộ lọc đang bật. Bỏ bớt một bộ lọc để thấy lại danh sách.', // WL:60-61
  inspectorEmpty: 'Chọn một đoạn tường trên bản vẽ hoặc trong danh sách để xem chi tiết.', // WI:51
  approve: 'Duyệt đoạn này', // WI:49
  thickness: 'Độ dày tường', // WI:48
  advanced: 'Thông số nâng cao', // WI:40
  onlyUnreviewed: 'Chỉ hiện chưa duyệt', // WLP:77
  onlyNonStandard: 'Chỉ hiện độ dày không chuẩn', // WLP:79
  continue: 'Sang lớp cửa và nội thất', // WLP:95
  rail: 'Công cụ lớp tường', // WTR:77
  merge: 'nối đoạn', // WTR:75
  reviewed: 'Đã duyệt', // WL:72
  conflict: 'Tầng này vừa được sửa ở nơi khác. Tải lại để xem bản mới nhất.', // SLS:83
  reload: 'Tải lại', // FSB:37
  confirmTitle: 'Bỏ thay đổi chưa lưu của tầng này?', // FSC:63
  confirmReload: 'Tải lại và bỏ thay đổi', // FSC:61
  cancel: 'Huỷ', // FSC:62
  floorGone: 'Tầng này không còn tồn tại.', // UFL:31
} as const;
/* 404 project on a QC layer route: FLRF:55-61 reuses the project 404 copy. */
const PROJECT_NOT_FOUND_TITLE = 'Không tìm thấy dự án này'; // PSGATE:36
const PROJECT_NOT_FOUND_SENTENCE = 'Dự án có thể đã bị xoá, đường dẫn chưa đúng, hoặc bạn chưa được thêm vào dự án.'; // PSGATE:37-38
const BACK_TO_PROJECTS = 'Về danh sách dự án'; // PSGATE:39
/* 404 floor: FLRF:64-71; the description opens with WALL.floorGone (FLRF:23, UFL:31). */
const FLOOR_MISSING_TITLE = 'Không mở được tầng này'; // FLRF:21
const BACK_TO_FLOORS = 'Về quản lý tầng'; // FLRF:24
const RETRY_READ = 'Thử lại'; // FLRF:25 (any other read error, FLRF:73-75)
const GENERIC_UNKNOWN = 'Hệ thống đã ghi nhận và sẽ kiểm tra. Hãy thử lại sau ít phút.'; // vi.json:63 errors.unknown.description (FIX-1387, BUG-209)

/* SCR-17 copy. */
const OBJ = {
  screen: 'Lớp đối tượng', // OV:65
  list: 'Danh sách đối tượng', // ObjectLayerList.tsx:47
  doors: 'Cửa đi', // listbox per group (main spec SCR-17 edit)
  emptyTitle: 'Chưa nhận ra đối tượng nào', // OV:67, OG:1250
  emptyExplanation:
    'Nhận diện nội thất phụ thuộc kiểu vẽ của bản gốc, nên bản vẽ ít ký hiệu quy ước có thể không ra kết quả nào.', // OG:1251-1252
  addManually: 'Thêm thủ công', // OV:68
  addNoWall: 'Tầng này chưa có đoạn tường nào để đặt đối tượng mới lên.', // OG:1261
  approve: 'Duyệt đối tượng này', // OI:184
  inspectorEmpty: 'Chọn một đối tượng trên bản vẽ hoặc trong danh sách để xem chi tiết.', // OI:185
} as const;

/* SCR-18 / SCR-19 copy. */
const DIM = {
  screen: 'Đọc kích thước OCR', // DT:209
  emptyTitle: 'Chưa đọc được chuỗi kích thước nào', // DT:140
  emptyDescription:
    'Chuỗi kích thước trên bản vẽ có nét mảnh hoặc không rõ, nên OCR không tách được số. Hiệu chỉnh tỷ lệ bằng tay để đo độ dài từ bản vẽ.', // DT:142
  toScale: 'Hiệu chỉnh tỷ lệ', // DT:143, DV:148
} as const;
const AXIS = {
  screen: 'Quản lý trục và gốc toạ độ', // AV:92
  emptyTitle: 'Chưa có trục nào', // AV:96
  emptyNotice: 'Bạn có thể vẽ trục thủ công từ bản vẽ, hoặc cho hệ thống suy ra trục từ hình học tường bao.', // UA:159-160
  derive: 'Suy ra từ tường bao', // AV:97
  addVertical: 'Thêm trục dọc', // UA:156
  ghost: 'Hiện bóng ma tầng dưới', // ALP:61
  rowPattern: /^Trục (.+?), cách trục kế là /u, // ALP:81
} as const;

/* SCR-20 copy. */
const ROOM = {
  screen: 'Duyệt tên phòng', // RV:80
  list: 'Danh sách phòng', // RoomLabelList.tsx:35
  emptyTitle: 'Chưa dò ra phòng nào', // RV:84
  emptyNotice:
    'Chưa dò ra phòng nào ở tầng này: vòng tường bao quanh các phòng chưa khép kín. Sang lớp tường khép các đoạn còn hở, rồi bấm "Kiểm tra lại vòng hở" để dò lại.', // UR:153-154
  emptyFiltered:
    'Không còn phòng nào chưa đặt tên. Tắt bộ lọc "Chưa đặt tên" để xem lại toàn bộ phòng của tầng.', // UR:155-156
  checkGaps: 'Kiểm tra lại vòng hở', // RV:85
  unnamedFilter: 'Chưa đặt tên', // RLP:44
  name: 'Tên phòng', // RNF:34
  nameEmpty: 'Tên phòng không được để trống.', // RNF:37
  normalize: 'Chuẩn hoá tên', // RLP:50
  normalizeDialog: 'Xem trước chuẩn hoá tên', // RNP:35
  apply: 'Áp dụng', // RNP:43
  merge: 'Gộp phòng', // R/RoomLabelInspector.tsx:87
  mergeDialog: 'Gộp hai phòng', // RAD:25
  mergeEmpty: 'Không còn phòng nào khác ở tầng này để gộp.', // RAD:28
} as const;

/* SCR-21 copy. */
const THICK = {
  screen: 'Chuẩn hoá độ dày tường', // TV:105 (region aria-label TV:169)
  emptyTitle: 'Chưa có đoạn tường nào để chuẩn hoá', // TV:112
  emptyNoMeasurement:
    'Chưa có số đo độ dày nào cho công trình này. Sang lớp tường để dò lại các đoạn tường, rồi quay lại đây để chuẩn hoá độ dày.', // UT:127-128
  allStandard:
    'Mọi đoạn tường đã ở đúng nhóm chuẩn, không còn gì để áp. Kéo một ngưỡng trên biểu đồ hoặc nới ô dung sai nếu bạn muốn gom thêm đoạn vào một nhóm khác.', // UT:125-126
  preview: 'Xem trước', // TAB:56
  cancel: 'Huỷ', // TAB:57
  apply: 'Áp dụng', // TAB:58
  undo: 'Hoàn tác', // TAB:55
  accept: /^Đồng ý chuẩn hoá \d+ tường /u, // TGT:43
  /** Preview line of no accepted row: `${n} tường → ${g} nhóm chuẩn.` (thicknessStandardizationGateway.ts:786). */
  previewNothing: '0 tường → 0 nhóm chuẩn.',
  previewTwo: /^2 tường → 1 nhóm chuẩn\./u,
  /** Toast title of the bulk apply (thicknessStandardizationGateway.ts:836-837 standardizeDescription). */
  appliedTwo: 'Chuẩn hoá độ dày 2 tường.',
  /** Segment row "Độ dày đo được" of a 200 mm wall: one decimal, comma (thicknessStandardizationGateway.ts:516-533). */
  measured200: /^200,0\s*mm$/u,
} as const;

/* SCR-14 / SCR-22 copy. */
const SCALE = {
  screen: 'Màn hiệu chỉnh tỷ lệ', // SV:67
  notice: 'Trạng thái của màn hiệu chỉnh tỷ lệ', // SV:69
  backToPreprocessing: 'Quay lại bước tiền xử lý', // SV:77
  retry: 'Tải lại ảnh', // SV:78
  canvas: 'Bản vẽ đã nắn, kéo để vẽ đường tham chiếu', // ScaleCalibrationCanvas.tsx:70
  handleStart: 'Đầu đoạn tham chiếu, dùng phím mũi tên để nhích', // ScaleCalibrationCanvas.tsx:73
  handleEnd: 'Cuối đoạn tham chiếu, dùng phím mũi tên để nhích', // ScaleCalibrationCanvas.tsx:74
  methods: 'Chọn cách xác định tỷ lệ', // SP:51
  reference: 'Vẽ đường tham chiếu', // US:170
  realLength: 'Chiều dài thật', // SMR:39
  remeasure: 'Đo lại', // SMR:42
  incomplete: 'Còn thiếu một vế, nên chưa ra được tỷ lệ.', // SP:57
  apply: 'Áp dụng tỷ lệ', // SP:61
  collapse: 'Thu gọn bảng', // SP:45
  expand: 'Bung bảng', // SP:46
} as const;
const OVERLAY = {
  screen: 'Màn đối chiếu bản vẽ', // VV:74
  readError: 'Không đọc được ảnh bản vẽ gốc của tầng này.', // UV:111
  toScale: 'Sang màn hiệu chỉnh tỷ lệ', // VV:78
  modes: 'Kiểu đối chiếu', // VT:59
  sideBySide: 'Cạnh nhau', // V/types.ts:153
  sideBySideDisabled: 'Khung quá hẹp để đặt hai khung nhìn cạnh nhau; hãy dùng trượt.', // UV:122
  confirm: 'Xác nhận mô hình khớp bản vẽ', // UV:104
  lock: 'Khoá căn', // VT:61
} as const;

/** SCR-11 quality gate empty state, the target of "Quay lại bước tiền xử lý" (InputQualityGate.tsx:65, vi.json:856). */
const QUALITY_NO_DRAWING = 'Chưa có bản vẽ để kiểm tra';

/* SCR-10 upload (fixture for the scale test, same path as phase03 edge). */
const FILE_INPUT = 'floor-upload-file-input'; // FloorUploadDropZone.tsx:33
const TRAY = 'Tệp chưa gán tầng'; // useFloorUploadScreen.ts:103
const ASSIGN = 'Gán cho tầng khác'; // FloorUploadTray.tsx:20
const ATTACHED = 'Đã gắn kèm'; // useFloorUploadScreen.ts:123

/* ---------------------------------------------------------------- small helpers */

type Json = Record<string, unknown>;

const asRecord = (value: unknown, what: string): Json => {
  if (typeof value !== 'object' || value === null || Array.isArray(value)) throw new Error(`${what}: not a JSON object`);
  return value as Json;
};

const stringField = (value: unknown, key: string, what: string): string => {
  const field = asRecord(value, what)[key];
  if (typeof field !== 'string' || field === '') throw new Error(`${what}: no string "${key}"`);
  return field;
};

const arrayOf = (value: unknown, what: string): Json[] => {
  if (!Array.isArray(value)) throw new Error(`${what}: not an array`);
  return value.map((item, index) => asRecord(item, `${what}[${String(index)}]`));
};

const uniq = (): string => `${Date.now().toString(36)}${Math.random().toString(36).slice(2, 6)}`;
/** W4 id body: `[0-9A-Z]{10,64}` (BE:packages/core/ids.py:92-94). */
const idBody = (): string => `QAE04${Date.now().toString(36).toUpperCase()}${Math.random().toString(36).slice(2, 6).toUpperCase()}`;
const escapeRegExp = (text: string): string => text.replace(/[.*+?^${}()|[\]\\]/gu, '\\$&');
const pathOf = (page: Page): string => new URL(page.url()).pathname;
const quiet = (page: Page): Promise<void> => page.waitForTimeout(QUIET_MS);

const layerRe = (projectId: string, floorId: string): RegExp =>
  new RegExp(`^/api/projects/${escapeRegExp(projectId)}/floors/${escapeRegExp(floorId)}/spatial/layer$`, 'u');

/** Writes the page sent since `mark`, minus session/telemetry chatter (not the screen's own action). */
const writesSince = (log: readonly ApiEntry[], mark: number): string[] =>
  log
    .slice(mark)
    .filter((entry) => entry.method !== 'GET' && entry.path !== REFRESH_API && !entry.path.startsWith('/api/telemetry'))
    .map((entry) => `${entry.method} ${entry.path} ${String(entry.status)}`);

const countSince = (log: readonly ApiEntry[], mark: number, method: string, path: RegExp): number =>
  log.slice(mark).filter((entry) => entry.method === method && path.test(entry.path)).length;

/** Checkbox / Radio.Item: focus + Space (sr-only input under a drawn box, main spec `pressSpaceOn`). */
async function pressSpaceOn(control: Locator): Promise<void> {
  await control.focus();
  await control.page().keyboard.press('Space');
}

const toastsRegion = (page: Page): Locator => page.getByRole('region', { name: TOASTS, exact: true });

/* ---------------------------------------------------------------- admin context + API fixtures */

interface FloorRef {
  readonly id: string;
  readonly name: string;
}

interface ProjectRef {
  readonly id: string;
  readonly name: string;
  readonly floor: FloorRef;
}

interface Admin {
  readonly context: BrowserContext;
  readonly page: Page;
  readonly api: ApiEntry[];
  /** Access token of this context's own refresh — sent as Bearer by the fixture calls, never logged. */
  readonly token: string;
  /** Project ids this test owns; deleted when the context closes. */
  readonly cleanup: string[];
}

interface AdminOptions {
  readonly viewport?: Viewport;
  readonly reducedMotion?: 'reduce';
}

/** Refresh body: `accessToken`/`access_token`, optional `data` wrapper (src/lib/auth/refresh.ts:85-100). */
function readAccessToken(json: unknown): string {
  const body = asRecord(json, 'POST /api/auth/refresh');
  const root = typeof body.data === 'object' && body.data !== null ? asRecord(body.data, 'refresh.data') : body;
  const token =
    typeof root.accessToken === 'string' ? root.accessToken : typeof root.access_token === 'string' ? root.access_token : '';
  if (token === '') throw new Error('POST /api/auth/refresh: no access token in the body');
  return token;
}

async function openAdmin(browser: Browser, options: AdminOptions = {}): Promise<Admin> {
  const context = await browser.newContext({
    baseURL: readBaseUrl(),
    viewport: options.viewport ?? DESKTOP,
    ...(options.reducedMotion === undefined ? {} : { reducedMotion: options.reducedMotion }),
    ...(existsSync(ADMIN_STORAGE_STATE_FILE) ? { storageState: ADMIN_STORAGE_STATE_FILE } : {}),
  });
  try {
    // One refresh checks the stored session (a 401 is answered by one UI sign-in); a second one hands this test its
    // own access token for the fixture calls. Sequential: the refresh cookie rotates on every call.
    await ensureAdminSession(context, ADMIN_STORAGE_STATE_FILE);
    const refreshed = await context.request.post(REFRESH_API, { headers: { Origin: readBaseUrl() } });
    expect(refreshed.status(), 'POST /api/auth/refresh (fixture token)').toBe(200);
    const token = readAccessToken(await refreshed.json());
    const page = await context.newPage();
    return { context, page, api: watchApi(page), token, cleanup: [] };
  } catch (error) {
    await context.close();
    throw error;
  }
}

const bearer = (admin: Admin): Record<string, string> => ({
  Origin: readBaseUrl(),
  Authorization: `Bearer ${admin.token}`,
});

async function closeAdmin(admin: Admin): Promise<void> {
  for (const id of admin.cleanup) {
    await admin.context.request.delete(`${PROJECTS_API}/${id}`, { headers: bearer(admin) }).catch(() => undefined);
  }
  await admin.context.storageState({ path: ADMIN_STORAGE_STATE_FILE }).catch(() => undefined);
  await admin.context.close().catch(() => undefined);
}

async function withAdmin(browser: Browser, body: (admin: Admin) => Promise<void>, options: AdminOptions = {}): Promise<void> {
  const admin = await openAdmin(browser, options);
  try {
    await body(admin);
  } finally {
    await closeAdmin(admin);
  }
}

/**
 * Fixture project through the real API (BE:apps/api/projects/router.py:54-63; `name` 3–80 chars; `floors` =
 * `FloorDraftIn` drafts): one 3 m floor "Tầng 1". Its id is read back from `GET /api/projects/:id`, never invented.
 */
async function createProject(admin: Admin, slug: string): Promise<ProjectRef> {
  const name = `${TEST_DATA_PREFIX}e04-${slug}-${uniq()}`;
  expect(name.length, `fixture name "${name}" fits NAME_MAX 80`).toBeLessThanOrEqual(80);
  const created = await admin.context.request.post(PROJECTS_API, {
    headers: bearer(admin),
    data: { name, floors: [{ name: FLOOR_NAME, order: 0, elevationMm: 0, heightMm: FLOOR_HEIGHT_MM }] },
  });
  expect(created.status(), `fixture POST ${PROJECTS_API} "${name}"`).toBe(201);
  const id = stringField(await created.json(), 'id', 'POST /api/projects');
  admin.cleanup.push(id);

  const read = await admin.context.request.get(`${PROJECTS_API}/${id}`, { headers: bearer(admin) });
  expect(read.status(), `fixture GET ${PROJECTS_API}/${id}`).toBe(200);
  const floors = arrayOf(asRecord(await read.json(), 'GET /api/projects/:id').floors, 'floors');
  expect(floors.length, 'fixture floors as created').toBe(1);
  return { id, name, floor: { id: stringField(floors[0], 'id', 'floors[0]'), name: stringField(floors[0], 'name', 'floors[0]') } };
}

/* ---- layer fixture (wire shape: src/api/schemas/spatial.ts WallSchema/OpeningSchema/RoomSchema) ---- */

interface Pt {
  readonly x: number;
  readonly y: number;
}

interface WallSeed {
  readonly id: string;
  readonly start: Pt;
  readonly end: Pt;
  readonly thicknessMm?: number;
  readonly kind?: 'loadBearing' | 'partition' | 'envelope';
  readonly reviewed?: boolean;
  readonly openingIds?: readonly string[];
}

interface LayerSeed {
  readonly walls?: readonly WallSeed[];
  readonly openings?: readonly Json[];
  readonly rooms?: readonly Json[];
}

const AI_UNREVIEWED = { confidence: 0.9, reviewed: false, source: 'ai' } as const;
/** A5: `reviewed: true` only with `source: 'human'` (schemas/spatial.ts humanOnlyReview; BE REVIEW_BY_AI_FORBIDDEN). */
const HUMAN_REVIEWED = { confidence: 1, reviewed: true, source: 'human' } as const;

const wireWall = (seed: WallSeed, levelId: string): Json => ({
  ...(seed.reviewed === true ? HUMAN_REVIEWED : AI_UNREVIEWED),
  centreline: { start: seed.start, end: seed.end },
  heightMm: FLOOR_HEIGHT_MM,
  id: seed.id,
  kind: seed.kind ?? 'partition',
  levelId,
  openingIds: [...(seed.openingIds ?? [])],
  thicknessMm: seed.thicknessMm ?? 220,
});

const wallId = (): string => `W-${idBody()}`;
const openingId = (): string => `D-${idBody()}`;
const roomId = (): string => `R-${idBody()}`;

interface Seeded {
  readonly revision: number;
  readonly levelId: string;
  readonly layer: Json;
}

/** Reads N16 (`revision`, `level.id`), then writes the layer through #35 with that `baseVersion`. */
async function seedLayer(admin: Admin, project: ProjectRef, build: (levelId: string) => LayerSeed): Promise<Seeded> {
  const path = `${PROJECTS_API}/${project.id}/floors/${project.floor.id}/spatial/layer`;
  const read = await admin.context.request.get(path, { headers: bearer(admin) });
  expect(read.status(), `fixture GET ${path}`).toBe(200);
  const doc = asRecord(await read.json(), 'N16');
  const revision = doc.revision as number;
  const levelId = stringField(doc.level, 'id', 'N16.level');
  const seed = build(levelId);
  const layer = {
    furniture: [],
    openings: [...(seed.openings ?? [])],
    rooms: [...(seed.rooms ?? [])],
    walls: (seed.walls ?? []).map((wall) => wireWall(wall, levelId)),
  };
  const put = await admin.context.request.put(path, {
    headers: bearer(admin),
    data: { baseVersion: revision, body: { layer } },
  });
  expect(put.status(), `fixture PUT ${path} (#35): ${(await put.text()).slice(0, 300)}`).toBe(200);
  const result = asRecord(await put.json(), '#35 result');
  return { revision: result.revision as number, levelId, layer: asRecord(result.layer, '#35.layer') };
}

/** List code of each wall id, exactly as the screen derives it (`displayCodesOf`, WG wallLabelOf). */
const wallCodes = (ids: readonly string[]): Map<string, string> => {
  const codes = displayCodesOf(ids);
  return new Map(ids.map((id) => [id, `#${codes.get(id) ?? id}`] as const));
};

/* ---- screen helpers ---- */

/** Opens a layer screen with a fresh document load and waits for its N16 read (200). */
async function openLayerScreen(page: Page, url: string, project: ProjectRef, floorId: string = project.floor.id): Promise<ApiResult> {
  return navigateThenWaitForApi(page, () => page.goto(url, { waitUntil: 'commit' }), 'GET', layerRe(project.id, floorId), [200]);
}

const wallList = (page: Page): Locator => page.getByRole('listbox', { name: WALL.list, exact: true });
const wallOption = (page: Page, code: string): Locator =>
  wallList(page).getByRole('option', { name: new RegExp(`^${escapeRegExp(code)} — `, 'u') });
/** WI: root > div.h-14 > h3 "Đoạn tường" (main spec `wallInspector`). */
const wallInspector = (page: Page): Locator =>
  page.getByRole('heading', { name: 'Đoạn tường', exact: true, level: 3 }).locator('xpath=../..');

async function openWalls(page: Page, project: ProjectRef): Promise<void> {
  await openLayerScreen(page, ROUTES.project.walls(project.id, project.floor.id), project);
  await expect(page.getByRole('region', { name: WALL.screen, exact: true })).toBeVisible();
  // G6: the walls screen hosts the lazy EditorTour (W/WallLayerReview.container.tsx:262); the seen-flag may already be stored.
  await dismissTour(page, { waitMs: TOUR_APPEAR_TIMEOUT_MS });
}

/** Next `PUT …/spatial/layer` (any status) whose sent `body` passes `sent`. Register BEFORE the action. */
function waitForLayerPut(page: Page, project: ProjectRef, sent?: (body: Json) => boolean): Promise<ApiResult> {
  const re = layerRe(project.id, project.floor.id);
  return waitForApiWhere(
    page,
    (response) => {
      if (response.request().method() !== 'PUT' || !re.test(new URL(response.url()).pathname)) return false;
      if (sent === undefined) return true;
      try {
        return sent(asRecord(asRecord(response.request().postDataJSON(), '#35').body, '#35.body'));
      } catch {
        return false;
      }
    },
    AUTOSAVE_TIMEOUT_MS,
    'PUT …/spatial/layer',
  );
}

const sentBody = (result: ApiResult): Json => asRecord(asRecord(result.response.request().postDataJSON(), '#35').body, '#35.body');
const sentWalls = (body: Json): Json[] => arrayOf(asRecord(body.layer, '#35.layer').walls, '#35.layer.walls');

/* ---- SCR-10 upload fixture (same path as phase03 edge `uploadDrawingTo`) ---- */

function drawingPng(): string {
  const value = process.env.E2E_DRAWING_PNG?.trim();
  if (value === undefined || value === '' || !value.toLowerCase().endsWith('.png') || !existsSync(value)) {
    throw new Error('E2E_DRAWING_PNG is not an existing .png file (qa.config.json env.vars)');
  }
  return value;
}

async function uploadDrawing(page: Page, project: ProjectRef): Promise<void> {
  await page.goto(ROUTES.project.upload(project.id));
  const card = page.locator(`[data-floor-id="${project.floor.id}"]`);
  await expect(card).toBeVisible();
  const complete = waitForApi(
    page,
    'POST',
    new RegExp(`^/api/projects/${escapeRegExp(project.id)}/drawings/uploads/[^/]+/complete$`, 'u'),
    [200],
  );
  await page.getByTestId(FILE_INPUT).setInputFiles(drawingPng());
  await page.getByRole('region', { name: TRAY, exact: true }).getByRole('combobox', { name: ASSIGN }).click();
  await page.getByRole('option', { name: project.floor.name, exact: true }).click();
  await complete;
  await expect(card.getByText(ATTACHED, { exact: true })).toBeVisible();
}

/* ================================================================= SCR-16 wall layer review */

test.describe('E04 SCR-16 wall layer review', () => {
  test('E04 · SCR-16 floor with no wall → "Chưa có đoạn tường nào" + notice, inspector prompt, no write on load', async ({ browser }) => {
    await withAdmin(browser, async (admin) => {
      const { page, api } = admin;
      const project = await createProject(admin, 'walls-empty');
      const mark = api.length;
      await openWalls(page, project);

      await expect(page.getByText(WALL.emptyTitle, { exact: true })).toBeVisible(); // WL:247-250
      await expect(page.getByText(WALL.emptyNotice, { exact: true })).toBeVisible(); // UW:205, UW:1718
      await expect(wallList(page)).toHaveCount(0);
      await expect(page.getByText(WALL.inspectorEmpty, { exact: true })).toBeVisible(); // WI:106
      await expect(page.getByRole('button', { name: WALL.approve, exact: true })).toHaveCount(0);
      await quiet(page);
      expect(writesSince(api, mark), 'opening an empty floor writes nothing').toEqual([]);
      await captureEvidence(page, 'E04_walls_empty.png');
    });
  });

  test('E04 · SCR-16 every wall approved → "Sang lớp cửa và nội thất" opens objects; "Chỉ hiện chưa duyệt" → no-match line', async ({ browser }) => {
    await withAdmin(browser, async (admin) => {
      const { page, api } = admin;
      const project = await createProject(admin, 'walls-done');
      const ids = [wallId(), wallId()];
      await seedLayer(admin, project, () => ({
        walls: [
          { id: ids[0] as string, start: { x: 0, y: 0 }, end: { x: 4000, y: 0 }, reviewed: true },
          { id: ids[1] as string, start: { x: 0, y: 3000 }, end: { x: 4000, y: 3000 }, reviewed: true },
        ],
      }));
      await openWalls(page, project);
      const codes = wallCodes(ids);
      for (const id of ids) {
        await expect(wallOption(page, codes.get(id) as string)).toHaveAccessibleName(`${codes.get(id) as string} — ${WALL.reviewed}`);
      }

      const mark = api.length;
      const unreviewed = page.getByRole('checkbox', { name: WALL.onlyUnreviewed, exact: true });
      await pressSpaceOn(unreviewed);
      await expect(unreviewed).toBeChecked();
      await expect(page.getByText(WALL.noMatch, { exact: true })).toBeVisible(); // WL:264 (rows empty, state success)
      await captureEvidence(page, 'E04_walls_filter_no_match.png');
      await pressSpaceOn(unreviewed);
      await expect(wallList(page).getByRole('option')).toHaveCount(2);

      // WLP:305-307 — the button renders only in state `success` (UW:540 reviewed === total).
      await page.getByRole('button', { name: WALL.continue, exact: true }).click();
      await expect.poll(() => pathOf(page)).toBe(ROUTES.project.objects(project.id, project.floor.id));
      await expect(page.getByRole('region', { name: OBJ.screen, exact: true })).toBeVisible();
      expect(writesSince(api, mark), 'filters and navigation write nothing').toEqual([]);
      await captureEvidence(page, 'E04_walls_continue_objects.png');
    });
  });

  test('E04 · SCR-16 "Chỉ hiện độ dày không chuẩn" keeps only the 150 mm wall; Ctrl+S with nothing changed sends no PUT', async ({ browser }) => {
    await withAdmin(browser, async (admin) => {
      const { page, api } = admin;
      const project = await createProject(admin, 'walls-nonstd');
      const odd = wallId();
      const standard = wallId();
      await seedLayer(admin, project, () => ({
        walls: [
          { id: odd, start: { x: 0, y: 0 }, end: { x: 4000, y: 0 }, thicknessMm: 150 },
          { id: standard, start: { x: 0, y: 3000 }, end: { x: 4000, y: 3000 }, thicknessMm: 220 },
        ],
      }));
      await openWalls(page, project);
      const codes = wallCodes([odd, standard]);
      await expect(wallList(page).getByRole('option')).toHaveCount(2);

      const mark = api.length;
      const box = page.getByRole('checkbox', { name: WALL.onlyNonStandard, exact: true });
      await pressSpaceOn(box);
      await expect(box).toBeChecked();
      // UW:461 + WG:1216-1217: standard = one of 110/220/330 (W/types.ts:168).
      await expect(wallList(page).getByRole('option')).toHaveCount(1);
      await expect(wallOption(page, codes.get(odd) as string)).toBeVisible();
      await expect(wallOption(page, codes.get(standard) as string)).toHaveCount(0);

      await wallOption(page, codes.get(odd) as string).click();
      await page.keyboard.press('Control+s'); // router.tsx global.save → flushAutosaves(): nothing dirty
      await quiet(page);
      expect(countSince(api, mark, 'PUT', layerRe(project.id, project.floor.id)), 'no PUT without a change').toBe(0);
      await captureEvidence(page, 'E04_walls_nonstandard_filter.png');
      await attachJson('E04_walls_nonstandard_filter.json', { writesSinceFilter: writesSince(api, mark) });
    });
  });

  test('E04 · SCR-16 keyboard: digit 2 sets 220 mm (PUT), "Thông số nâng cao" expands, Esc clears the selection', async ({ browser }) => {
    await withAdmin(browser, async (admin) => {
      const { page } = admin;
      const project = await createProject(admin, 'walls-keys');
      const id = wallId();
      await seedLayer(admin, project, () => ({ walls: [{ id, start: { x: 0, y: 0 }, end: { x: 4000, y: 0 }, thicknessMm: 150 }] }));
      await openWalls(page, project);
      const code = wallCodes([id]).get(id) as string;

      await wallOption(page, code).click();
      await expect(wallInspector(page).getByText(code, { exact: true })).toBeVisible();
      // UW:1317-1335 digits 1/2/3 → WALL_THICKNESS_CHOICES[0..2] = 110/220/330 (W/types.ts:168); canvas scope, row focused.
      const put = waitForLayerPut(page, project, (body) => sentWalls(body).some((wall) => wall.id === id && wall.thicknessMm === 220));
      await page.keyboard.press('2');
      expect((await put).response.status(), 'PUT …/spatial/layer after digit 2').toBe(200);
      await expect(
        page.getByRole('radiogroup', { name: WALL.thickness, exact: true }).getByRole('radio', { checked: true }),
      ).toHaveAccessibleName(/220/u);

      const advanced = wallInspector(page).getByRole('button', { name: WALL.advanced });
      await advanced.click();
      await expect(advanced).toHaveAttribute('aria-expanded', 'true'); // WI:152-157

      await wallOption(page, code).focus();
      await page.keyboard.press('Escape'); // UW:1287-1304 → onSelect(null)
      await expect(page.getByText(WALL.inspectorEmpty, { exact: true })).toBeVisible();
      await expect(wallOption(page, code)).toHaveAttribute('aria-selected', 'false');
      await captureEvidence(page, 'E04_walls_keyboard.png');
    });
  });

  test('E04 · SCR-16 double click "Duyệt đoạn này" → one PUT, button disabled; reload keeps "Đã duyệt"', async ({ browser }) => {
    await withAdmin(browser, async (admin) => {
      const { page, api } = admin;
      const project = await createProject(admin, 'walls-dbl');
      const id = wallId();
      await seedLayer(admin, project, () => ({ walls: [{ id, start: { x: 0, y: 0 }, end: { x: 4000, y: 0 } }] }));
      await openWalls(page, project);
      const code = wallCodes([id]).get(id) as string;
      await wallOption(page, code).click();

      const mark = api.length;
      const approve = page.getByRole('button', { name: WALL.approve, exact: true });
      const put = waitForLayerPut(page, project);
      await approve.dblclick();
      const sent = await put;
      expect(sent.response.status(), 'PUT …/spatial/layer').toBe(200);
      expect(sentWalls(sentBody(sent)).find((wall) => wall.id === id)?.reviewed, '#35 wall reviewed').toBe(true);
      await expect(approve).toBeDisabled(); // WI:200 disabled={isSelectedReviewed}; UW:859 early return when reviewed
      await quiet(page);
      expect(countSince(api, mark, 'PUT', layerRe(project.id, project.floor.id)), 'one PUT for a double click').toBe(1);

      // Back/refresh: the server copy is the truth (N16 re-read on a fresh load).
      await openLayerScreen(page, ROUTES.project.walls(project.id, project.floor.id), project);
      await expect(wallOption(page, code)).toHaveAccessibleName(`${code} — ${WALL.reviewed}`);
      await captureEvidence(page, 'E04_walls_double_approve_reload.png');
      await attachJson('E04_walls_double_approve_reload.json', { layerPutsAfterDoubleClick: countSince(api, mark, 'PUT', layerRe(project.id, project.floor.id)) });
    });
  });

  test('E04 · SCR-16 "nối đoạn" on two perpendicular walls → enabled, but nothing merges and no PUT', async ({ browser }) => {
    await withAdmin(browser, async (admin) => {
      const { page, api } = admin;
      const project = await createProject(admin, 'walls-merge');
      const a = wallId();
      const b = wallId();
      await seedLayer(admin, project, () => ({
        walls: [
          { id: a, start: { x: 0, y: 0 }, end: { x: 4000, y: 0 } },
          { id: b, start: { x: 4000, y: 0 }, end: { x: 4000, y: 3000 } },
        ],
      }));
      await openWalls(page, project);
      const codes = wallCodes([a, b]);
      await wallOption(page, codes.get(a) as string).click();
      const rail = page.getByRole('toolbar', { name: WALL.rail, exact: true });
      await expect(rail.getByRole('button', { name: `${WALL.merge} — Chọn hai đoạn tường để gộp`, exact: true })).toBeDisabled(); // WTR:108-109
      await wallOption(page, codes.get(b) as string).click({ modifiers: ['Control'] }); // WL:148 ctrl → toggle
      const merge = rail.getByRole('button', { name: WALL.merge, exact: true });
      await expect(merge).toBeEnabled(); // UW:1384,1410 canMerge = two selected

      const mark = api.length;
      await merge.click();
      // mergeWalls refuses a 90° pair (domain/walls/edit.ts angle < 2°) → builder returns null → run() returns (UW:913-919, 842-844).
      await quiet(page);
      await expect(wallList(page).getByRole('option')).toHaveCount(2);
      expect(countSince(api, mark, 'PUT', layerRe(project.id, project.floor.id)), 'refused merge sends no PUT').toBe(0);
      await captureEvidence(page, 'E04_walls_merge_refused.png');
    });
  });

  test('E04 · SCR-16 409 after a write elsewhere → "Tải lại" banner, A9 dialog "Huỷ" keeps it, "Tải lại và bỏ thay đổi" re-reads', async ({ browser }) => {
    await withAdmin(browser, async (admin) => {
      const { page } = admin;
      const project = await createProject(admin, 'walls-409');
      const a = wallId();
      const b = wallId();
      const seeded = await seedLayer(admin, project, () => ({
        walls: [
          { id: a, start: { x: 0, y: 0 }, end: { x: 4000, y: 0 } },
          { id: b, start: { x: 0, y: 3000 }, end: { x: 4000, y: 3000 } },
        ],
      }));
      await openWalls(page, project);
      const codes = wallCodes([a, b]);

      // A second writer bumps the revision after the screen read it (real #35 write, BE:spatial_write/writer.py:347-372).
      const path = `${PROJECTS_API}/${project.id}/floors/${project.floor.id}/spatial/layer`;
      const walls = arrayOf(seeded.layer.walls, 'seed walls').map((wall) => (wall.id === b ? { ...wall, thicknessMm: 330 } : wall));
      const elsewhere = await admin.context.request.put(path, {
        headers: bearer(admin),
        data: { baseVersion: seeded.revision, body: { layer: { ...seeded.layer, walls } } },
      });
      expect(elsewhere.status(), 'second writer PUT').toBe(200);

      await wallOption(page, codes.get(a) as string).click();
      const conflict = waitForApi(page, 'PUT', layerRe(project.id, project.floor.id), [409]);
      await page.getByRole('button', { name: WALL.approve, exact: true }).click();
      await conflict; // stale baseVersion → 409 W20

      // SLS:93-94 409 → 'reload'; SLS:83 copy; FSB:34-38 attention alert + "Tải lại".
      const banner = page.getByRole('alert').filter({ hasText: WALL.conflict });
      await expect(banner).toBeVisible();
      await captureEvidence(page, 'E04_walls_conflict_banner.png');

      // UAS:621-623: the floor is unsaved (blocked floors count, SLS:195) → A9 dialog first.
      await banner.getByRole('button', { name: WALL.reload, exact: true }).click();
      const dialog = page.getByRole('dialog', { name: WALL.confirmTitle, exact: true });
      await expect(dialog).toBeVisible();
      await dialog.getByRole('button', { name: WALL.cancel, exact: true }).click();
      await expect(dialog).toHaveCount(0);
      await expect(banner).toBeVisible();

      await banner.getByRole('button', { name: WALL.reload, exact: true }).click();
      const reread = waitForApi(page, 'GET', layerRe(project.id, project.floor.id), [200]);
      await page.getByRole('dialog', { name: WALL.confirmTitle, exact: true }).getByRole('button', { name: WALL.confirmReload, exact: true }).click();
      await reread; // UAS:579-585 reloadFloor → readLayer
      await expect(page.getByRole('alert').filter({ hasText: WALL.conflict })).toHaveCount(0);
      // The server copy wins: wall a is back to unapproved.
      await expect(wallOption(page, codes.get(a) as string)).not.toHaveAccessibleName(`${codes.get(a) as string} — ${WALL.reviewed}`);
      await captureEvidence(page, 'E04_walls_conflict_reloaded.png');
    });
  });

  test('E04 · SCR-16 409 at 375 px → A9 dialog keeps "Huỷ" and "Tải lại và bỏ thay đổi" inside the viewport; Esc closes it, no re-read', async ({ browser }) => {
    await withAdmin(browser, async (admin) => {
      const { page, api } = admin;
      const project = await createProject(admin, 'walls-409-375');
      const a = wallId();
      const seeded = await seedLayer(admin, project, () => ({
        walls: [{ id: a, start: { x: 0, y: 0 }, end: { x: 4000, y: 0 } }],
      }));
      await openWalls(page, project);
      const code = wallCodes([a]).get(a) as string;

      // Second writer bumps the revision (real #35 write) so the screen's next PUT is a 409 W20 (SLS:93-94).
      const path = `${PROJECTS_API}/${project.id}/floors/${project.floor.id}/spatial/layer`;
      const walls = arrayOf(seeded.layer.walls, 'seed walls').map((wall) => ({ ...wall, thicknessMm: 330 }));
      const elsewhere = await admin.context.request.put(path, {
        headers: bearer(admin),
        data: { baseVersion: seeded.revision, body: { layer: { ...seeded.layer, walls } } },
      });
      expect(elsewhere.status(), 'second writer PUT').toBe(200);

      await wallOption(page, code).click();
      const conflict = waitForApi(page, 'PUT', layerRe(project.id, project.floor.id), [409]);
      await page.getByRole('button', { name: WALL.approve, exact: true }).click();
      await conflict;
      const banner = page.getByRole('alert').filter({ hasText: WALL.conflict }); // SLS:83, FSB:34-38
      await expect(banner).toBeVisible();

      // The walls screen has no breakpoint logic of its own; the dialog is the shared Modal (FSC:12-19 legacy API →
      // MOD:258-279 Modal.Footer, now `flex-wrap` at MOD:208), so at 375 px both footer buttons must stay on screen.
      await page.setViewportSize(PHONE);
      await banner.getByRole('button', { name: WALL.reload, exact: true }).click();
      const dialog = page.getByRole('dialog', { name: WALL.confirmTitle, exact: true });
      await expect(dialog).toBeVisible();
      const buttons = { cancel: dialog.getByRole('button', { name: WALL.cancel, exact: true }), reload: dialog.getByRole('button', { name: WALL.confirmReload, exact: true }) };
      const boxes: Record<string, { x: number; y: number; width: number; height: number }> = {};
      for (const [key, button] of Object.entries(buttons)) {
        await expect(button).toBeVisible();
        const box = await button.boundingBox();
        expect(box, `"${key}" has a box`).not.toBeNull();
        if (box === null) return;
        boxes[key] = box;
        expect(box.x, `"${key}" left edge inside 375 px`).toBeGreaterThanOrEqual(0);
        expect(box.x + box.width, `"${key}" right edge inside 375 px`).toBeLessThanOrEqual(PHONE.width);
      }
      const pageOverflow = await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
      await captureEvidence(page, 'E04_walls_conflict_dialog_375.png');
      await attachJson('E04_walls_conflict_dialog_375.json', { viewport: PHONE, buttonBoxes: boxes, documentOverflowPx: pageOverflow });

      // A12 / MOD:58-63: Esc → onClose = confirm.onCancel (FSC:14) — same as "Huỷ": dialog gone, banner stays, no re-read.
      const mark = api.length;
      await page.keyboard.press('Escape');
      await expect(dialog).toHaveCount(0);
      await expect(banner).toBeVisible();
      await quiet(page);
      const rereads = countSince(api, mark, 'GET', layerRe(project.id, project.floor.id));
      expect(rereads, 'Esc re-reads nothing').toBe(0);
      expect(writesSince(api, mark), 'Esc writes nothing').toEqual([]);
      await captureEvidence(page, 'E04_walls_conflict_dialog_esc.png');
      await attachJson('E04_walls_conflict_dialog_esc.json', { layerGetsAfterEsc: rereads, writesAfterEsc: writesSince(api, mark) });
    });
  });

  test('E04 · SCR-16 unknown floor id in an own project → "Tầng này không còn tồn tại." (404 floor), no write', async ({ browser }) => {
    await withAdmin(browser, async (admin) => {
      const { page, api } = admin;
      const project = await createProject(admin, 'walls-nofloor');
      const missing = `L-QAE04MISSING${Date.now().toString(36).toUpperCase()}`;
      const mark = api.length;
      const notFound = waitForApi(page, 'GET', layerRe(project.id, missing), [404]);
      await page.goto(ROUTES.project.walls(project.id, missing));
      await notFound; // BE:spatial_read/router.py:71-75 `_floor_or_404`
      // FLRF:64-71: a 404 floor replaces the whole screen with one exit (BUG-326, qc/shared/FloorLayerReadFailureScreen.tsx).
      const gone = page.getByRole('alert').filter({ hasText: WALL.floorGone });
      await expect(gone).toBeVisible();
      await expect(gone.getByRole('heading', { name: FLOOR_MISSING_TITLE, exact: true })).toBeVisible();
      await expect(gone.getByRole('button', { name: BACK_TO_FLOORS, exact: true })).toBeVisible();
      await quiet(page);
      expect(writesSince(api, mark), 'an unknown floor writes nothing').toEqual([]);
      await captureEvidence(page, 'E04_walls_unknown_floor.png');
    });
  });

  test('E04 · SCR-16 unknown project id → project 404 screen + "Về danh sách dự án", no write', async ({ browser }) => {
    await withAdmin(browser, async (admin) => {
      const { page, api } = admin;
      // Not a `prj_<ULID>`: BE answers 404 `project` before any DB read (BE:apps/api/projects/access.py:28-33).
      const projectId = `prj_qa-e04-${uniq()}`;
      const floorId = `L-QAE04NOPROJ${Date.now().toString(36).toUpperCase()}`;
      const mark = api.length;
      const notFound = waitForApi(page, 'GET', layerRe(projectId, floorId), [404]);
      await page.goto(ROUTES.project.walls(projectId, floorId));
      await notFound;
      // QC layer routes have no ProjectSpatialGate (router.tsx:373); FLRF:55-61 404 `project` → the project 404 copy.
      const missing = page.getByRole('alert').filter({ hasText: PROJECT_NOT_FOUND_SENTENCE });
      await expect(missing).toBeVisible();
      await expect(missing.getByRole('heading', { name: PROJECT_NOT_FOUND_TITLE, exact: true })).toBeVisible();
      await expect(missing.getByRole('button', { name: BACK_TO_PROJECTS, exact: true })).toBeVisible();
      await quiet(page);
      expect(writesSince(api, mark), 'an unknown project writes nothing').toEqual([]);
      await captureEvidence(page, 'E04_walls_unknown_project.png');
    });
  });

  test('E04 · SCR-16 [mocked response] GET …/spatial/layer 500 → read-failure screen with "Thử lại", screen not blank', async ({ browser }) => {
    await withAdmin(browser, async (admin) => {
      const { page } = admin;
      const project = await createProject(admin, 'walls-500');
      const matcher = layerRe(project.id, project.floor.id);
      const handler = async (route: Route): Promise<void> => {
        if (route.request().method() !== 'GET' || !matcher.test(new URL(route.request().url()).pathname)) {
          await route.fallback();
          return;
        }
        await route.fulfill({ status: 500, contentType: 'application/json', body: JSON.stringify({ detail: 'qa-e04 mocked 500' }) });
      };
      await page.route('**/api/projects/**', handler);
      await page.goto(ROUTES.project.walls(project.id, project.floor.id));
      // I18N errors.unknown (500 has no KNOWN_HTTP_STATUS_KIND, lib/errors/toAppError.ts:10-18,211) via FLRF:73-75.
      // BUG-326: the failed first read replaces the whole screen (WallLayerReview.tsx:123-129) — no tool rail, one exit.
      const failure = page.getByRole('alert').filter({ hasText: GENERIC_UNKNOWN });
      await expect(failure).toBeVisible();
      await expect(failure.getByRole('button', { name: RETRY_READ, exact: true })).toBeVisible();
      await expect(page.getByRole('region', { name: WALL.screen, exact: true })).toBeVisible(); // A11: never blank
      await expect(page.getByRole('toolbar', { name: WALL.rail, exact: true })).toHaveCount(0);
      await captureEvidence(page, 'E04_walls_read_500.png');
      await page.unroute('**/api/projects/**', handler);
    });
  });
});

/* ================================================================= SCR-17 object layer review */

const objectInspector = (page: Page): Locator =>
  page.getByRole('heading', { name: 'Đối tượng', exact: true, level: 3 }).locator('xpath=../..');

async function openObjects(page: Page, project: ProjectRef): Promise<void> {
  await openLayerScreen(page, ROUTES.project.objects(project.id, project.floor.id), project);
  await expect(page.getByRole('region', { name: OBJ.screen, exact: true })).toBeVisible();
}

/** One 6 m wall hosting a door (offset 1000) and a window (offset 3500). */
function doorAndWindow(ids: { wall: string; door: string; window: string }): LayerSeed {
  return {
    walls: [{ id: ids.wall, start: { x: 0, y: 0 }, end: { x: 6000, y: 0 }, openingIds: [ids.door, ids.window] }],
    openings: [
      { ...AI_UNREVIEWED, heightMm: 2100, id: ids.door, kind: 'door', offsetMm: 1000, sillHeightMm: 0, swing: 'left', wallId: ids.wall, widthMm: 900 },
      { ...AI_UNREVIEWED, heightMm: 1200, id: ids.window, kind: 'window', offsetMm: 3500, sillHeightMm: 900, swing: 'fixed', wallId: ids.wall, widthMm: 1200 },
    ],
  };
}

test.describe('E04 SCR-17 object layer review', () => {
  test('E04 · SCR-17 no wall, no object → empty state; "Thêm thủ công" → "Tầng này chưa có đoạn tường nào…" toast, no write', async ({ browser }) => {
    await withAdmin(browser, async (admin) => {
      const { page, api } = admin;
      const project = await createProject(admin, 'obj-empty');
      await openObjects(page, project);
      await expect(page.getByText(OBJ.emptyTitle, { exact: true })).toBeVisible(); // OV:83-90
      // UO:1294 emptyNotice; shown by the list EmptyState (OV:83-90) and the status bar (ObjectLayerStatusBar.tsx).
      await expect(page.getByText(OBJ.emptyExplanation, { exact: true }).first()).toBeVisible();
      const mark = api.length;
      await page.getByRole('button', { name: OBJ.addManually, exact: true }).click();
      // UO:946-962: no wall to host a door → notification bus publishes addNoWall.
      await expect(toastsRegion(page).getByText(OBJ.addNoWall)).toBeVisible();
      await quiet(page);
      expect(writesSince(api, mark), '"Thêm thủ công" without a wall writes nothing').toEqual([]);
      await captureEvidence(page, 'E04_objects_add_no_wall.png');
    });
  });

  test('E04 · SCR-17 one wall, no object → "Thêm thủ công" adds a door on it (PUT with one opening)', async ({ browser }) => {
    await withAdmin(browser, async (admin) => {
      const { page } = admin;
      const project = await createProject(admin, 'obj-add');
      const id = wallId();
      await seedLayer(admin, project, () => ({ walls: [{ id, start: { x: 0, y: 0 }, end: { x: 6000, y: 0 } }] }));
      await openObjects(page, project);
      await expect(page.getByText(OBJ.emptyTitle, { exact: true })).toBeVisible();

      const put = waitForLayerPut(page, project, (body) => arrayOf(asRecord(body.layer, 'layer').openings, 'openings').length === 1);
      await page.getByRole('button', { name: OBJ.addManually, exact: true }).click(); // UO:953-980 manualDoorProposalOf → door
      const sent = sentBody(await put);
      const opening = arrayOf(asRecord(sent.layer, 'layer').openings, 'openings')[0] as Json;
      expect(opening.kind, '#35 new opening kind').toBe('door');
      expect(opening.wallId, '#35 new opening host wall').toBe(id);
      await expect(page.getByRole('listbox', { name: OBJ.doors, exact: true }).getByRole('option')).toHaveCount(1);
      await captureEvidence(page, 'E04_objects_add_door.png');
    });
  });

  test('E04 · SCR-17 double click "Duyệt đối tượng này" → one PUT; Mod+Z reverts (PUT); Esc closes the inspector', async ({ browser }) => {
    await withAdmin(browser, async (admin) => {
      const { page, api } = admin;
      const project = await createProject(admin, 'obj-approve');
      const ids = { wall: wallId(), door: openingId(), window: openingId() };
      await seedLayer(admin, project, () => doorAndWindow(ids));
      await openObjects(page, project);

      const door = page.getByRole('listbox', { name: OBJ.doors, exact: true }).getByRole('option').first();
      await door.click();
      await expect(door).toHaveAttribute('aria-selected', 'true');
      const approve = objectInspector(page).getByRole('button', { name: OBJ.approve, exact: true });
      const mark = api.length;
      const approved = waitForLayerPut(page, project, (body) =>
        arrayOf(asRecord(body.layer, 'layer').openings, 'openings').some((o) => o.id === ids.door && o.reviewed === true),
      );
      await approve.dblclick();
      expect((await approved).response.status(), 'approve PUT').toBe(200);
      await expect(approve).toBeDisabled();
      await quiet(page);
      expect(countSince(api, mark, 'PUT', layerRe(project.id, project.floor.id)), 'one PUT for a double click').toBe(1);

      // UO:1149-1157 Mod+Z (canvas scope) → onUndo; focus on the row, not an input.
      const reverted = waitForLayerPut(page, project, (body) =>
        arrayOf(asRecord(body.layer, 'layer').openings, 'openings').some((o) => o.id === ids.door && o.reviewed === false),
      );
      await door.focus();
      await page.keyboard.press('Control+z');
      expect((await reverted).response.status(), 'undo PUT').toBe(200);
      await expect(approve).toBeEnabled();

      await door.focus();
      await page.keyboard.press('Escape'); // UO:1167-1173 → onSelect(null)
      await expect(page.getByText(OBJ.inspectorEmpty, { exact: true })).toBeVisible(); // OI:185
      await captureEvidence(page, 'E04_objects_approve_undo_escape.png');
    });
  });
});

/* ================================================================= SCR-18 dimensions / SCR-19 axes */

test.describe('E04 SCR-18 / SCR-19 dimension OCR and axes', () => {
  test('E04 · SCR-18 no dimension on the floor → empty state; "Hiệu chỉnh tỷ lệ" link opens the scale screen', async ({ browser }) => {
    await withAdmin(browser, async (admin) => {
      const { page, api } = admin;
      const project = await createProject(admin, 'dims-empty');
      const mark = api.length;
      await page.goto(ROUTES.project.dimensions(project.id, project.floor.id));
      await expect(page.getByText(DIM.emptyTitle, { exact: true })).toBeVisible(); // DV:135-152
      await expect(page.getByText(DIM.emptyDescription, { exact: true })).toBeVisible();
      const link = page.getByRole('link', { name: DIM.toScale, exact: true });
      await expect(link).toHaveAttribute('href', ROUTES.project.scale(project.id, project.floor.id)); // DimensionOcrReview.container.tsx:132-135
      await captureEvidence(page, 'E04_dims_empty.png');
      await link.click();
      await expect.poll(() => pathOf(page)).toBe(ROUTES.project.scale(project.id, project.floor.id));
      await expect(page.getByRole('region', { name: SCALE.screen, exact: true })).toBeVisible();
      expect(writesSince(api, mark), 'empty dimensions + link write nothing').toEqual([]);
      await captureEvidence(page, 'E04_dims_link_scale.png');
    });
  });

  test('E04 · SCR-19 no wall → "Chưa có trục nào"; "Suy ra từ tường bao" has nothing to derive (still empty, no write)', async ({ browser }) => {
    await withAdmin(browser, async (admin) => {
      const { page, api } = admin;
      const project = await createProject(admin, 'axes-empty');
      await page.goto(ROUTES.project.grids(project.id, project.floor.id));
      await expect(page.getByRole('region', { name: AXIS.screen, exact: true })).toBeVisible();
      await expect(page.getByText(AXIS.emptyTitle, { exact: true })).toBeVisible(); // AV:140-149
      await expect(page.getByText(AXIS.emptyNotice, { exact: true })).toBeVisible(); // UA:159-160
      const mark = api.length;
      await page.getByRole('button', { name: AXIS.derive, exact: true }).click(); // UA:916-925: preview empty → return
      await quiet(page);
      await expect(page.getByText(AXIS.emptyTitle, { exact: true })).toBeVisible();
      expect(writesSince(api, mark), '"Suy ra từ tường bao" on an empty floor writes nothing').toEqual([]);
      await captureEvidence(page, 'E04_axes_empty_derive.png');
    });
  });

  test('E04 · SCR-19 load-bearing rectangle → axes previewed from walls; "Thêm trục dọc" adds one; ghost toggle; no PUT', async ({ browser }) => {
    await withAdmin(browser, async (admin) => {
      const { page, api } = admin;
      const project = await createProject(admin, 'axes-walls');
      // domain/axes/detect.ts:49,243 MIN_WALLS_PER_AXIS = 2: each grid line is two collinear load-bearing segments.
      const segments: readonly (readonly [Pt, Pt])[] = [
        [{ x: 0, y: 0 }, { x: 4000, y: 0 }],
        [{ x: 4000, y: 0 }, { x: 8000, y: 0 }],
        [{ x: 0, y: 6000 }, { x: 4000, y: 6000 }],
        [{ x: 4000, y: 6000 }, { x: 8000, y: 6000 }],
        [{ x: 0, y: 0 }, { x: 0, y: 3000 }],
        [{ x: 0, y: 3000 }, { x: 0, y: 6000 }],
        [{ x: 8000, y: 0 }, { x: 8000, y: 3000 }],
        [{ x: 8000, y: 3000 }, { x: 8000, y: 6000 }],
      ];
      await seedLayer(admin, project, () => ({
        walls: segments.map(([start, end]) => ({ id: wallId(), start, end, kind: 'loadBearing' as const })),
      }));
      const mark = api.length;
      await page.goto(ROUTES.project.grids(project.id, project.floor.id));
      await expect(page.getByRole('region', { name: AXIS.screen, exact: true })).toBeVisible();
      // UA:447-458: no stored axis → detectAxesOfLevel(walls) preview.
      const rows = page.getByRole('option', { name: AXIS.rowPattern });
      await expect(rows.first()).toBeVisible();
      const before = await rows.count();

      await page.getByRole('button', { name: AXIS.addVertical, exact: true }).click();
      // Plan SCR-19 / main spec: "Thêm trục …" adds ONE row to what is listed. UA:455-462 drops the whole wall preview as
      // soon as one axis is stored, so the listed preview rows vanish (suspected app bug) — soft, the rest still runs.
      await expect.soft(rows, '"Thêm trục dọc" adds one row to the listed axes').toHaveCount(before + 1);

      const ghost = page.getByRole('switch', { name: AXIS.ghost, exact: true }); // ALP:216, Toggle role=switch
      const was = await ghost.getAttribute('aria-checked');
      await ghost.click();
      await expect(ghost).not.toHaveAttribute('aria-checked', was ?? '');
      await quiet(page);
      // Axes have no persistence path (A/axisGridManagerGateway.ts:155, plan F-08).
      expect(countSince(api, mark, 'PUT', layerRe(project.id, project.floor.id)), 'axes write no layer').toBe(0);
      expect(writesSince(api, mark), 'axes write nothing').toEqual([]);
      await captureEvidence(page, 'E04_axes_preview_add.png');
      await attachJson('E04_axes_preview_add.json', { axisRowsBefore: before, writes: writesSince(api, mark) });
    });
  });
});

/* ================================================================= SCR-20 room label review */

const roomOptions = (page: Page): Locator => page.getByRole('listbox', { name: ROOM.list, exact: true }).getByRole('option');

/** A 4 × 4 m room inside four partition walls. */
function roomLayer(levelId: string, names: readonly string[]): LayerSeed {
  const corners: readonly Pt[] = [
    { x: 0, y: 0 },
    { x: 4000, y: 0 },
    { x: 4000, y: 4000 },
    { x: 0, y: 4000 },
  ];
  const walls = corners.map((start, index) => ({ id: wallId(), start, end: corners[(index + 1) % corners.length] as Pt }));
  return {
    walls,
    rooms: names.map((name, index) => ({
      ...AI_UNREVIEWED,
      areaM2: 16,
      id: roomId(),
      levelId,
      name,
      outline: corners.map((p) => ({ x: p.x + index * 4000, y: p.y })),
      usage: 'bedroom',
      wallIds: index === 0 ? walls.map((wall) => wall.id) : [],
    })),
  };
}

async function openRooms(page: Page, project: ProjectRef): Promise<void> {
  await openLayerScreen(page, ROUTES.project.rooms(project.id, project.floor.id), project);
  await expect(page.getByRole('region', { name: ROOM.screen, exact: true })).toBeVisible();
}

test.describe('E04 SCR-20 room label review', () => {
  test('E04 · SCR-20 no room → "Chưa dò ra phòng nào" + notice; "Kiểm tra lại vòng hở" re-reads the layer, no write', async ({ browser }) => {
    await withAdmin(browser, async (admin) => {
      const { page, api } = admin;
      const project = await createProject(admin, 'rooms-empty');
      await openRooms(page, project);
      await expect(page.getByRole('heading', { name: ROOM.emptyTitle })).toBeVisible(); // RV:139-149
      await expect(page.getByText(ROOM.emptyNotice, { exact: true })).toBeVisible();
      const mark = api.length;
      const reread = waitForApi(page, 'GET', layerRe(project.id, project.floor.id), [200]);
      await page.getByRole('button', { name: ROOM.checkGaps, exact: true }).click(); // UR:845-848 invalidate + refetch
      await reread;
      expect(writesSince(api, mark), '"Kiểm tra lại vòng hở" writes nothing').toEqual([]);
      await captureEvidence(page, 'E04_rooms_empty_recheck.png');
    });
  });

  test('E04 · SCR-20 "Tên phòng" blank + Enter → "Tên phòng không được để trống.", name kept; Esc drops a draft; no PUT', async ({ browser }) => {
    await withAdmin(browser, async (admin) => {
      const { page, api } = admin;
      const project = await createProject(admin, 'rooms-name');
      await seedLayer(admin, project, (levelId) => roomLayer(levelId, ['qa phòng e04']));
      await openRooms(page, project);
      await roomOptions(page).first().click();
      const name = page.getByRole('textbox', { name: ROOM.name });
      await expect(name).toHaveValue('qa phòng e04');

      const mark = api.length;
      await name.fill('   ');
      await name.press('Enter');
      await expect(page.getByText(ROOM.nameEmpty, { exact: true })).toBeVisible(); // RNF:66-71
      await expect(name).toHaveValue('qa phòng e04');
      await captureEvidence(page, 'E04_rooms_name_empty.png');

      await name.fill('qa nháp bỏ');
      await name.press('Escape'); // RNF:101-104
      await expect(name).toHaveValue('qa phòng e04');
      await quiet(page);
      expect(countSince(api, mark, 'PUT', layerRe(project.id, project.floor.id)), 'refused / dropped names send no PUT').toBe(0);
      await captureEvidence(page, 'E04_rooms_name_escape.png');
    });
  });

  test('E04 · SCR-20 "Chuẩn hoá tên" with a name to change → preview row, "Áp dụng" → PUT with the canonical name', async ({ browser }) => {
    await withAdmin(browser, async (admin) => {
      const { page } = admin;
      const project = await createProject(admin, 'rooms-norm');
      await seedLayer(admin, project, (levelId) => roomLayer(levelId, ['PHONG NGU 2']));
      await openRooms(page, project);

      await page.getByRole('button', { name: ROOM.normalize, exact: true }).click();
      const dialog = page.getByRole('dialog', { name: ROOM.normalizeDialog, exact: true });
      await expect(dialog).toBeVisible();
      // RG canonicalRoomName: key "phong ngu" → ROOM_USAGE_LABELS.bedroom "phòng ngủ" (domain/rules/registry.ts:423) + ordinal.
      await expect(dialog.getByText('phòng ngủ 2', { exact: true })).toBeVisible();
      await expect(dialog.getByText('PHONG NGU 2', { exact: true })).toBeVisible();
      await captureEvidence(page, 'E04_rooms_normalize_preview.png');

      const put = waitForLayerPut(page, project, (body) =>
        arrayOf(asRecord(body.layer, 'layer').rooms, 'rooms').some((room) => room.name === 'phòng ngủ 2'),
      );
      await dialog.getByRole('button', { name: ROOM.apply, exact: true }).click();
      expect((await put).response.status(), 'normalize PUT').toBe(200);
      await expect(dialog).toHaveCount(0);
      await expect(roomOptions(page).first()).toHaveAccessibleName(/ · phòng ngủ 2 · /u); // RoomLabelList.tsx:70
      await captureEvidence(page, 'E04_rooms_normalize_applied.png');
    });
  });

  test('E04 · SCR-20 "Gộp phòng" with a single room → "Không còn phòng nào khác…", Esc closes, no PUT', async ({ browser }) => {
    await withAdmin(browser, async (admin) => {
      const { page, api } = admin;
      const project = await createProject(admin, 'rooms-merge1');
      await seedLayer(admin, project, (levelId) => roomLayer(levelId, ['qa phòng một']));
      await openRooms(page, project);
      await roomOptions(page).first().click();
      const mark = api.length;
      await page.getByRole('button', { name: ROOM.merge, exact: true }).click();
      const dialog = page.getByRole('dialog', { name: ROOM.mergeDialog, exact: true });
      await expect(dialog).toBeVisible();
      await expect(dialog.getByText(ROOM.mergeEmpty, { exact: true })).toBeVisible(); // RAD:28
      await captureEvidence(page, 'E04_rooms_merge_single.png');
      await page.keyboard.press('Escape'); // A12: Esc closes the top layer (Modal)
      await expect(dialog).toHaveCount(0);
      await quiet(page);
      expect(countSince(api, mark, 'PUT', layerRe(project.id, project.floor.id)), 'merge dialog writes nothing').toBe(0);
    });
  });

  test('E04 · SCR-20 "Chưa đặt tên" filter with every room named → notice says turn it off; the filter must stay reachable', async ({ browser }) => {
    await withAdmin(browser, async (admin) => {
      const { page } = admin;
      const project = await createProject(admin, 'rooms-filter');
      await seedLayer(admin, project, (levelId) => roomLayer(levelId, ['qa phòng có tên']));
      await openRooms(page, project);
      const filter = page.getByRole('button', { name: new RegExp(`^${ROOM.unnamedFilter}`, 'u') });
      await filter.click();
      // UR:876-880 emptyFiltered → emptyFilteredNotice, which tells the user to switch the filter off.
      await expect(page.getByText(ROOM.emptyFiltered, { exact: true })).toBeVisible();
      await captureEvidence(page, 'E04_rooms_unnamed_filter_empty.png');
      // The notice's own instruction needs the toggle on screen; RV:139-149 renders only the EmptyState in this branch.
      await expect(
        page.getByRole('button', { name: new RegExp(`^${ROOM.unnamedFilter}`, 'u') }),
        'the "Chưa đặt tên" toggle the notice tells the user to switch off is still on screen',
      ).toBeVisible();
    });
  });
});

/* ================================================================= SCR-21 thickness standardization */

async function openThickness(page: Page, project: ProjectRef): Promise<void> {
  await openLayerScreen(page, ROUTES.project.thickness(project.id, project.floor.id), project);
  await expect(page.getByRole('heading', { name: THICK.screen })).toBeVisible();
}

const thicknessRegion = (page: Page): Locator => page.getByRole('region', { name: THICK.screen, exact: true });

test.describe('E04 SCR-21 thickness standardization', () => {
  test('E04 · SCR-21 no wall → "Chưa có đoạn tường nào để chuẩn hoá" + no-measurement notice', async ({ browser }) => {
    await withAdmin(browser, async (admin) => {
      const { page, api } = admin;
      const project = await createProject(admin, 'thick-empty');
      const mark = api.length;
      await openThickness(page, project);
      await expect(page.getByRole('heading', { name: THICK.emptyTitle })).toBeVisible(); // TV:166-174
      await expect(page.getByText(THICK.emptyNoMeasurement, { exact: true })).toBeVisible(); // UT:866-870
      await quiet(page);
      expect(writesSince(api, mark), 'empty thickness screen writes nothing').toEqual([]);
      await captureEvidence(page, 'E04_thickness_empty.png');
    });
  });

  test('E04 · SCR-21 every wall already 220 mm → "Mọi đoạn tường đã ở đúng nhóm chuẩn…" notice, no accept box', async ({ browser }) => {
    await withAdmin(browser, async (admin) => {
      const { page } = admin;
      const project = await createProject(admin, 'thick-std');
      await seedLayer(admin, project, () => ({
        walls: [
          { id: wallId(), start: { x: 0, y: 0 }, end: { x: 4000, y: 0 }, thicknessMm: 220 },
          { id: wallId(), start: { x: 0, y: 3000 }, end: { x: 4000, y: 3000 }, thicknessMm: 220 },
        ],
      }));
      await openThickness(page, project);
      await expect(page.getByText(THICK.allStandard, { exact: true })).toBeVisible(); // UT:250-252, 866-870; TV:178-182
      await captureEvidence(page, 'E04_thickness_all_standard.png');
    });
  });

  test('E04 · SCR-21 preview: "Áp dụng" with no group accepted sends nothing; Esc and "Huỷ" close the preview', async ({ browser }) => {
    await withAdmin(browser, async (admin) => {
      const { page, api } = admin;
      const project = await createProject(admin, 'thick-preview');
      await seedLayer(admin, project, () => ({
        walls: [
          // 200 mm: within the 30 mm default tolerance of the 220 mm group (a 150 mm wall is "Lệch quá dung sai" and never applies).
          { id: wallId(), start: { x: 0, y: 0 }, end: { x: 4000, y: 0 }, thicknessMm: 200 },
          { id: wallId(), start: { x: 0, y: 3000 }, end: { x: 4000, y: 3000 }, thicknessMm: 200 },
        ],
      }));
      await openThickness(page, project);
      const accept = page.getByRole('checkbox', { name: THICK.accept }).first();
      await expect(accept).not.toBeChecked();
      const region = thicknessRegion(page);
      const measured200 = region.getByText(THICK.measured200);
      const applied = toastsRegion(page).getByText(THICK.appliedTwo, { exact: true });
      const putsSince = (from: number): number => countSince(api, from, 'PUT', layerRe(project.id, project.floor.id));
      const mark = api.length;

      // BUG-344: the screen's answer to "nothing to apply" is the preview line itself (TAB:163, UT:703-706) — shot open.
      await region.getByRole('button', { name: THICK.preview, exact: true }).click();
      await expect(region.getByText(THICK.previewNothing, { exact: true })).toBeVisible();
      await expect(region.getByRole('button', { name: THICK.apply, exact: true })).toBeVisible(); // TAB:194-204
      await captureEvidence(page, 'E04_thickness_apply_nothing.png', {
        caption: 'No group accepted: "Xem trước" says 0 tường → 0 nhóm chuẩn; "Áp dụng" is clicked next and sends no PUT',
      });
      await region.getByRole('button', { name: THICK.apply, exact: true }).click(); // UT:613-614 empty batch → return
      await quiet(page);
      expect(putsSince(mark), 'nothing accepted → no PUT').toBe(0);
      await expect(applied).toHaveCount(0);
      await expect(measured200).toHaveCount(2);
      await attachJson('E04_thickness_apply_nothing.json', { putsAfterApply: putsSince(mark), writes: writesSince(api, mark) });

      // Accepted group, preview open ("2 tường → 1 nhóm chuẩn."), then closed by Esc and by "Huỷ": nothing applied.
      await pressSpaceOn(accept);
      await expect(accept).toBeChecked();
      const previewTwo = region.getByText(THICK.previewTwo);
      await region.getByRole('button', { name: THICK.preview, exact: true }).click();
      await expect(previewTwo).toBeVisible();
      await accept.focus(); // canvas-scope Esc is inert inside an input; the sr-only checkbox is not a text input
      await page.keyboard.press('Escape'); // UT:829-842 → setPreview(null)
      await expect(previewTwo).toHaveCount(0);
      await expect(region.getByRole('button', { name: THICK.preview, exact: true })).toBeVisible(); // TAB:122-126
      await region.getByRole('button', { name: THICK.preview, exact: true }).click();
      await expect(previewTwo).toBeVisible();
      await region.getByRole('button', { name: THICK.cancel, exact: true }).click(); // TAB:88-91
      await expect(previewTwo).toHaveCount(0);
      await expect(region.getByRole('button', { name: THICK.apply, exact: true })).toHaveCount(0);
      await expect(region.getByRole('button', { name: THICK.preview, exact: true })).toBeVisible();
      await quiet(page);
      expect(putsSince(mark), 'previews write nothing').toBe(0);
      await expect(applied).toHaveCount(0);
      await expect(measured200, 'both walls still 200 mm').toHaveCount(2);
      await captureEvidence(page, 'E04_thickness_preview_closed.png', {
        caption: 'Group accepted, preview closed by Esc and by "Huỷ": no preview panel, both walls still 200,0 mm, no PUT',
      });
    });
  });

  test('E04 · SCR-21 accept + "Áp dụng" → bulk PUT, then "Hoàn tác" of the apply bar → PUT restoring 200 mm', async ({ browser }) => {
    await withAdmin(
      browser,
      async (admin) => {
        const { page } = admin;
        const project = await createProject(admin, 'thick-undo');
        const ids = [wallId(), wallId()];
        await seedLayer(admin, project, () => ({
          walls: ids.map((id, index) => ({ id, start: { x: 0, y: index * 3000 }, end: { x: 4000, y: index * 3000 }, thicknessMm: 200 })),
        }));
        await openThickness(page, project);
        const region = thicknessRegion(page);
        const measured200 = region.getByText(THICK.measured200);
        const accept = page.getByRole('checkbox', { name: THICK.accept }).first();
        await expect(measured200).toHaveCount(2);
        await pressSpaceOn(accept);
        await expect(accept).toBeChecked();
        await region.getByRole('button', { name: THICK.preview, exact: true }).click();

        const applied = waitForLayerPut(page, project, (body) =>
          sentWalls(body).filter((wall) => ids.includes(wall.id as string)).every((wall) => wall.thicknessMm === 220),
        );
        await region.getByRole('button', { name: THICK.apply, exact: true }).click();
        expect((await applied).response.status(), 'apply PUT').toBe(200);
        // BUG-344: the applied state, shot before it is undone (UT:617-640 toast with its own "Hoàn tác").
        await expect(toastsRegion(page).getByText(THICK.appliedTwo, { exact: true })).toBeVisible();
        await expect(measured200, 'no wall left at 200 mm after the apply').toHaveCount(0);
        await captureEvidence(page, 'E04_thickness_applied.png', {
          caption: '"Áp dụng": toast "Chuẩn hoá độ dày 2 tường." and no row at 200,0 mm (PUT with 220 mm sent)',
        });

        const restored = waitForLayerPut(page, project, (body) =>
          sentWalls(body).filter((wall) => ids.includes(wall.id as string)).every((wall) => wall.thicknessMm === 200),
        );
        await region.getByRole('button', { name: THICK.undo, exact: true }).first().click(); // TAB:116-118 → UT:598-600 applyUndo
        expect((await restored).response.status(), 'undo PUT').toBe(200);
        await expect(measured200, 'both walls back to 200 mm after "Hoàn tác"').toHaveCount(2);
        await expect(page.getByRole('checkbox', { name: THICK.accept }).first()).toBeVisible();
        await captureEvidence(page, 'E04_thickness_apply_undo.png', {
          caption: '"Hoàn tác" after "Áp dụng": both walls back at 200,0 mm (PUT restoring 200 mm sent); applied state: E04_thickness_applied',
        });
      },
      { reducedMotion: 'reduce' }, // group rows are motion.tr (main spec SCR-21)
    );
  });
});

/* ================================================================= SCR-14 scale calibration */

test.describe('E04 SCR-14 scale calibration', () => {
  test('E04 · SCR-14 floor without drawing → error notice with "Tải lại ảnh" (re-reads) and "Quay lại bước tiền xử lý" (→ quality)', async ({ browser }) => {
    await withAdmin(browser, async (admin) => {
      const { page, api } = admin;
      const project = await createProject(admin, 'scale-nodrawing');
      const qualityRe = new RegExp(`^/api/projects/${escapeRegExp(project.id)}/floors/${escapeRegExp(project.floor.id)}/quality$`, 'u');
      const mark = api.length;
      await page.goto(ROUTES.project.scale(project.id, project.floor.id));
      // US:1466 query error → 'error' (scaleCalibrationGateway.ts:283-310: no entry for the floor); SV:193-212.
      const notice = page.getByRole('region', { name: SCALE.notice, exact: true });
      await expect(notice.getByRole('alert')).toBeVisible();
      await captureEvidence(page, 'E04_scale_no_drawing.png');

      const reread = waitForApi(page, 'GET', qualityRe, [200, 404]);
      await notice.getByRole('button', { name: SCALE.retry, exact: true }).click(); // US:1033 query.refetch()
      await reread;
      await notice.getByRole('button', { name: SCALE.backToPreprocessing, exact: true }).click(); // US:1029
      await expect.poll(() => pathOf(page)).toBe(ROUTES.project.quality(project.id));
      // BUG-343: the lazy route first paints "Đang tải màn hình…"; shoot the quality gate itself (no drawing on this floor).
      await expect(page.getByText(QUALITY_NO_DRAWING, { exact: true })).toBeVisible();
      expect(writesSince(api, mark), 'scale error state writes nothing').toEqual([]);
      await captureEvidence(page, 'E04_scale_back_to_quality.png');
    });
  });

  test('E04 · SCR-14 reference line: "Đo lại" off before a line; length 0 / text → "Còn thiếu một vế…", apply off; "Đo lại" clears; panel collapse', async ({ browser }) => {
    test.setTimeout(PIPELINE_TIMEOUT_MS + 120_000);
    await withAdmin(browser, async (admin) => {
      const { page, api } = admin;
      const project = await createProject(admin, 'scale-ref');
      await uploadDrawing(page, project);
      await page.goto(ROUTES.project.scale(project.id, project.floor.id));
      const canvas = page.getByRole('group', { name: SCALE.canvas, exact: true });
      await expect(canvas).toBeVisible({ timeout: PIPELINE_TIMEOUT_MS });
      await page
        .getByRole('radiogroup', { name: SCALE.methods, exact: true })
        .getByRole('radio', { name: SCALE.reference, exact: true })
        .click();
      const remeasure = page.getByRole('button', { name: SCALE.remeasure, exact: true });
      await expect(remeasure).toBeDisabled(); // SMR:100 canRemeasure false before a line
      const mark = api.length;

      const box = await canvas.boundingBox();
      if (box === null) throw new Error('scale canvas has no bounding box');
      await page.mouse.move(box.x + box.width * 0.2, box.y + box.height * 0.5);
      await page.mouse.down();
      await page.mouse.move(box.x + box.width * 0.8, box.y + box.height * 0.5, { steps: 8 });
      await page.mouse.up();
      await expect(page.getByRole('button', { name: SCALE.handleStart, exact: true })).toBeVisible();

      const realLength = page.getByLabel(SCALE.realLength, { exact: true });
      const apply = page.getByRole('button', { name: SCALE.apply, exact: true });
      // "0" parses (US:672-675), so the computation is "complete" (US:1458) but the ratio is refused (US:688 numerator ≤ 0).
      await realLength.fill('0');
      await realLength.press('Enter');
      await expect(apply).toBeDisabled(); // US:695,1650 proposedRatio null → canApply false; SP:233
      // "abc" does not parse → numerator null → SP:185-188 "Còn thiếu một vế…".
      await realLength.fill('abc');
      await realLength.press('Enter');
      await expect(page.getByText(SCALE.incomplete, { exact: true })).toBeVisible();
      await expect(apply).toBeDisabled();
      await captureEvidence(page, 'E04_scale_length_invalid.png');

      await remeasure.click(); // SMR:100-105 onRemeasure
      await expect(page.getByRole('button', { name: SCALE.handleStart, exact: true })).toHaveCount(0);
      await expect(page.getByRole('button', { name: SCALE.handleEnd, exact: true })).toHaveCount(0);

      // SP:97-99 + US:1024-1026 toggle the panel. US:1466-1476,1735: state 'error' (warped drawing) outranks 'collapsed', so
      // the button can do nothing there (suspected dead control, A2) — soft, the no-write claim still runs.
      await page.getByRole('button', { name: SCALE.collapse, exact: true }).click();
      const expand = page.getByRole('button', { name: SCALE.expand, exact: true });
      await expect.soft(expand, '"Thu gọn bảng" collapses the panel ("Bung bảng" shows)').toBeVisible();
      if ((await expand.count()) > 0) {
        await expand.click();
        await expect(page.getByRole('button', { name: SCALE.collapse, exact: true })).toBeVisible();
      }
      await quiet(page);
      expect(countSince(api, mark, 'PUT', layerRe(project.id, project.floor.id)), 'no scale PUT without a valid length').toBe(0);
      await captureEvidence(page, 'E04_scale_remeasure_collapse.png');
      await attachJson('E04_scale_remeasure_collapse.json', { writesSinceLine: writesSince(api, mark) });
    });
  });
});

/* ================================================================= SCR-22 overlay comparison */

test.describe('E04 SCR-22 overlay comparison', () => {
  test('E04 · SCR-22 floor without drawing → "Không đọc được ảnh bản vẽ gốc…", no scale link, confirm disabled, no write', async ({ browser }) => {
    await withAdmin(browser, async (admin) => {
      const { page, api } = admin;
      const project = await createProject(admin, 'overlay-nodrawing');
      const mark = api.length;
      await page.goto(ROUTES.project.overlay(project.id, project.floor.id));
      await expect(page.getByRole('region', { name: OVERLAY.screen, exact: true })).toBeVisible();
      // VG:356-369 no floor in the assess list → error; UV:584-586,757-762 errorReadNotice (VV:156-163, a plain div + alert);
      // UV:811-817 no fix link.
      await expect(page.getByRole('alert').filter({ hasText: OVERLAY.readError })).toBeVisible();
      await expect(page.getByRole('link', { name: OVERLAY.toScale })).toHaveCount(0);
      // UV:881-891: no measurement (VG:338-343 deviationRegions/matchMetrics unsupported) → canConfirm false.
      await expect(page.getByRole('button', { name: OVERLAY.confirm, exact: true })).toBeDisabled();
      await quiet(page);
      expect(writesSince(api, mark), 'overlay writes nothing').toEqual([]);
      await captureEvidence(page, 'E04_overlay_no_drawing.png');
    });
  });

  test('E04 · SCR-22 viewport 1024 (< 1280) → "Cạnh nhau" disabled with its reason; "Khoá căn" toggles', async ({ browser }) => {
    await withAdmin(
      browser,
      async (admin) => {
        const { page, api } = admin;
        const project = await createProject(admin, 'overlay-narrow');
        await page.goto(ROUTES.project.overlay(project.id, project.floor.id));
        await expect(page.getByRole('region', { name: OVERLAY.screen, exact: true })).toBeVisible();
        const modes = page.getByRole('radiogroup', { name: OVERLAY.modes, exact: true });
        // UV:165,362 narrow → collapsed; UV:830-833 disabledCompareModes.sideBySide; VT:64-65,79-81.
        await expect(modes.getByRole('radio', { name: OVERLAY.sideBySide, exact: true })).toBeDisabled();
        await expect(page.getByText(`${OVERLAY.sideBySide} — ${OVERLAY.sideBySideDisabled}`, { exact: true })).toBeVisible();
        const mark = api.length;
        const lock = page.getByRole('switch', { name: OVERLAY.lock, exact: true }); // VT:164-170
        const was = await lock.getAttribute('aria-checked');
        await lock.click();
        await expect(lock).not.toHaveAttribute('aria-checked', was ?? '');
        await quiet(page);
        expect(writesSince(api, mark), '"Khoá căn" writes nothing').toEqual([]);
        await captureEvidence(page, 'E04_overlay_narrow.png');
      },
      { viewport: NARROW },
    );
  });
});
