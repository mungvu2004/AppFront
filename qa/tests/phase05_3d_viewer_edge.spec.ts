/**
 * Phase 5 — EDGE CASES, Track A (admin): SCR-23 Viewer 3D, SCR-24 Exploded View, SCR-25 Measurement Tool,
 * SCR-26 Pascal Viewer, SCR-27 Mobile Viewer. Gaps left by `phase05_3d_viewer.spec.ts` (serial, CP-5 work floor);
 * inventory in `qa/coverage/phase05.md` (FE stamp fa991a0d).
 *
 * Every expected result cites the FE source of `F:/App/AppFront` @ fa991a0d or, written `BE:`, AppBack. Short names:
 *   V3   src/screens/viewer/Viewer3D/        (V3V Viewer3D.tsx, V3C Viewer3D.container.tsx, V3P Viewer3DPanels.tsx,
 *        OS ObjectSearch.tsx, UV3 useViewer3D.ts)
 *   VS   src/screens/viewer/ViewerShell/     (VVP ViewerViewport.tsx, VTB ViewerTopBar.tsx, VTR ViewerToolRail.tsx,
 *        VSR ViewerStoreyRail.tsx, VCH ViewerChrome.tsx, VOV ViewerOverlays.tsx, VIN ViewerInspector.tsx,
 *        VSB ViewerStatusBar.tsx, UVS useViewerShell.ts, VSS viewerShellShortcuts.ts, VSG viewerShellGateway.ts)
 *   EX   src/screens/viewer/ExplodedView/    (EXV ExplodedView.tsx, EXR ExplodedViewRail.tsx, EXF ExplodedViewFloorCards.tsx,
 *        UEX useExplodedView.ts, EXT explodedViewTypes.ts)
 *   MT   src/screens/viewer/MeasurementTool/ (MTV MeasurementTool.tsx, MTL MeasurementList.tsx, UMT useMeasurementTool.ts,
 *        MTG measurementToolGateway.ts, MTT measurementToolTypes.ts)
 *   PV   src/screens/viewer/PascalViewer/    (PVV PascalViewer.tsx, UPV usePascalViewer.ts, PVT pascalViewerTypes.ts)
 *   MV   src/screens/system/MobileViewer/    (MVV MobileViewer.tsx, MVB MobileViewerBottomBar.tsx, MVI MobileViewerInfoSheet.tsx)
 *   PSG  src/components/feedback/ProjectSpatialGate.tsx    RAP src/screens/viewer/RoomAreaPanel/RoomAreaPanel(.chrome).tsx
 *   PI   src/screens/viewer/PropertyInspector/            WGE src/screens/viewer/WallGeometryEditor/
 *   I18N src/i18n/vi.json (`errors.*`)
 *
 * ## Non-serial
 * Every test opens its OWN browser context from the stored admin session (`ADMIN_STORAGE_STATE_FILE`, checked by
 * `ensureAdminSession`; a dead session costs one UI sign-in) and creates its OWN project through the real API
 * (`POST /api/projects`, name `qa-<runId>-e05-…`, one or two floors) that it deletes in `finally`. Geometry is written
 * through the real #35 route (`PUT …/floors/:f/spatial/layer`, BE:apps/api/spatial_write/router.py) with W4 ids; the
 * screens read it back through N15 (`GET /api/projects/:id/spatial`, BE:apps/api/spatial_read/router.py:65-67).
 * Measurements are seeded through #17 (`POST /api/projects/:id/measurements`, BE:apps/api/measurements/router.py:30-38).
 * Nothing reads the Phase 2/3 checkpoints (CP-2…CP-6): the shared work floor is never touched.
 *
 * ## Mocks — "[mocked response]" in the title (4 of 32)
 * - `GET /api/projects/:id/spatial` 500 on SCR-23 — unpairable: 5xx is not producible on the shared stack.
 * - `GET /api/projects/:id/measurements` 500 on SCR-25 — unpairable: 5xx is not producible on the shared stack.
 * - `/assets/pascal/pascal-mount.js` network loss on SCR-26 — unpairable: loss of a static asset (network), not an API.
 * - `GET /api/feature-flags` with `scene.pascal-viewer: false` on SCR-26 — unpairable: the flag is a stack-wide env
 *   setting (`FEATURE_FLAGS`, CP-0); turning it off would break every other Pascal test. The real response is fetched
 *   and only that key is overridden.
 * Each needs its "unpairable" row in `coverage/phase05-be.md` (BE agent).
 *
 * ## Writes on the real stack (own `qa-<runId>-e05-…` projects only)
 * Projects created/deleted; their layers written by API; measurements created/deleted by API and by the screen.
 * No mail, no account change, no registry change, no feature-flag change.
 *
 * ## Real-backend budget per run (BE defaults; QA stack override `qa-limits.override.yml`)
 * - `POST /api/auth/login` (120 / 60 s per IP on the QA stack): 0 when the stored session is alive; 1 UI sign-in when it
 *   is dead. No failed login.
 * - `POST /api/auth/refresh` (300 / 60 s): 2 per test (session check + fixture token) + 1 per page load ≈ 4–6 per test,
 *   ≈ 170 for the 32 tests spread over several minutes.
 * - `POST /api/projects`: 30 (every test except the two unknown-project ones), each deleted in `finally`; no rate limit
 *   (BE:apps/api/projects/router.py:54).
 * - `PUT …/spatial/layer`: 1–2 per seeded test; no rate limit.
 * - `POST /api/projects/:id/measurements`: 1 per SCR-25 seeded test (5); `DELETE`: ≤ 2 per test; no rate limit
 *   (BE:apps/api/measurements/router.py).
 */
import { existsSync } from 'node:fs';

import { expect, test } from '@playwright/test';
import type { Browser, BrowserContext, Locator, Page, Route } from '@playwright/test';
import sharp from 'sharp';

import { ROUTES } from '../../e2e/fixtures/routes';
import { TOUR_APPEAR_TIMEOUT_MS, dismissTour } from '../../e2e/fixtures/tour';
import { navigateThenWaitForApi, waitForApi, waitForApiWhere, watchApi } from '../../e2e/fullstack/apiWatch';
import type { ApiEntry } from '../../e2e/fullstack/apiWatch';
import { PASCAL_RENDER_TIMEOUT_MS, readBaseUrl } from '../../e2e/fullstack/env';
import { ensureAdminSession } from './support/auth';
import { TEST_DATA_PREFIX, attachJson, captureEvidence } from './support/evidence';
import { ADMIN_STORAGE_STATE_FILE } from './support/state';

/* ---------------------------------------------------------------- constants (each cites its source) */

const DESKTOP = { width: 1440, height: 900 } as const;
/** MV: 375 is not compact; < 360 px is (`mobileViewerTypes.ts` MOBILE_VIEWER_COMPACT_WIDTH_PX, useMobileViewer.ts:220). */
const PHONE = { width: 375, height: 812 } as const;
const COMPACT_PHONE = { width: 320, height: 640 } as const;
type Viewport = { readonly width: number; readonly height: number };

/** A "nothing was sent" claim waits past autosave (800 ms, A7) plus a round trip. */
const QUIET_MS = 2_500;
/** Scene build under the real BE. */
const SCENE_TIMEOUT_MS = 60_000;
/** react-query retries a failed read before the error state paints. */
const ERROR_PAINT_TIMEOUT_MS = 30_000;
const HEAVY_TEST_TIMEOUT_MS = 240_000;
/** Undo toast window is 8 s (G5, `UNDO_WINDOW_MS`); a reload after this proves the delete stuck. */
const UNDO_WINDOW_MS = 8_000;
const REFRESH_API = '/api/auth/refresh';
const PROJECTS_API = '/api/projects';
const FLOOR_HEIGHT_MM = 3_000;

/* Shared gate (PSG). */
const GATE = {
  notFoundTitle: 'Không tìm thấy dự án này', // PSG:36
  notFoundDescription: 'Dự án có thể đã bị xoá, đường dẫn chưa đúng, hoặc bạn chưa được thêm vào dự án.', // PSG:37-38
  backToProjects: 'Về danh sách dự án', // PSG:39
} as const;
const GENERIC_UNKNOWN_TITLE = 'Có trục trặc'; // I18N errors.unknown.title (500 → unknown, lib/errors/toAppError.ts:10-18)
const GENERIC_UNKNOWN = 'Hệ thống đã ghi nhận và sẽ kiểm tra. Hãy thử lại sau ít phút.'; // I18N errors.unknown.description
const DASHBOARD_TITLE = 'Dự án của tôi'; // ProjectDashboard.tsx h1 (support/auth.ts DASHBOARD_TITLE)

/* SCR-23 copy. */
const V3 = {
  viewport: 'Khung nhìn mô hình', // VVP:91
  emptyText: 'Mô hình 3D sẽ xuất hiện sau khi bạn duyệt lớp tường.', // V3V:50
  emptyLink: 'Quay lại xem lớp tường', // V3V:53
  storeyReady: 'Tầng đã dựng xong', // V3V:104
  noPartsSuffix: ' — chưa có tường hay phòng nào', // UV3:126
  breadcrumb: 'Đường dẫn màn hình', // VCH:46
  breadcrumbLeaf: 'Mô hình 3D', // UVS:1063
  statusBar: 'Thanh trạng thái', // VSB:26
  zoomGroup: 'Cụm thu phóng', // VCH:134
  zoomOut: 'Thu nhỏ', // VCH:141
  zoomIn: 'Phóng to', // VCH:158
  fitAll: 'Vừa khung hình', // VCH:162
  zoomLabel: /^Mức thu phóng (.+), bấm để về mức chuẩn$/u, // VCH:146
  cube: 'Khối định hướng', // VOV:45
  preset: 'Góc nhìn sẵn', // VTB:72
  tools: 'Công cụ khung nhìn', // VTR:49
  separation: 'Độ tách', // UVS:1099, VSR:114-115 (label wraps the range input)
  inspector: 'Thanh tra đối tượng', // VIN:55
  nothingSelected: 'Chưa chọn đối tượng', // VIN:100
  searchTrigger: 'Tìm phòng', // OS:58
  searchInput: 'Tìm phòng theo tên hoặc mã', // OS:61
  searchList: 'Kết quả tìm phòng', // OS:64
  noMatch: 'Không có phòng nào khớp', // OS:67
  panels: 'Bảng phụ của khung nhìn 3D', // V3P:98
  roomsPanel: 'Diện tích phòng', // V3P:87
  selectedSection: 'Thuộc tính đối tượng đã chọn', // V3P:118
  enterWallEdit: 'Sửa hình học tường', // V3P:123
  exitWallEdit: 'Thoát chế độ sửa hình học', // V3P:124
} as const;
const PROPS = {
  region: 'Thuộc tính đối tượng', // PI PropertyInspector.tsx:69
  close: 'Đóng', // PI PropertyInspectorHeader.tsx:18,46
  name: 'Tên', // PI usePropertyInspector.ts:215
} as const;
const ROOMS_PANEL = {
  region: 'Bảng diện tích phòng', // RAP RoomAreaPanel.chrome.tsx:43
  emptyTitle: 'Chưa khép được vòng phòng nào', // RAP RoomAreaPanel.chrome.tsx:57
  emptyAction: 'Kiểm tra khe hở tường', // RAP RoomAreaPanel.chrome.tsx:60
} as const;
const WALL_EDITOR = {
  region: 'Sửa hình học tường', // WGE wallGeometryEditorTypes.ts:501
  xPattern: /^Toạ độ x /u, // WGE wallGeometryEditorTypes.ts:527, WallGeometryVertexTable.tsx:113
  cellInvalid: 'Giá trị chưa hợp lệ nên toạ độ đã trở về số cũ.', // WGE wallGeometryEditorTypes.ts:530
} as const;
const WALLS_SCREEN = 'Duyệt lớp tường'; // src/screens/qc/WallLayerReview/WallLayerReview.tsx:84 (phase04 edge WALL.screen)

/** UVS:167-169 `storeyInlineName` (BUG-384): "Tầng 1" → "tầng 1", "Mái" → "tầng Mái"; the rail eye reads "Ẩn {this}" (VSR:87-89). */
const storeyInlineName = (name: string): string => (/^tầng(\s|$)/iu.test(name) ? `t${name.slice(1)}` : `tầng ${name}`);

/* SCR-24 copy. */
const EX = {
  empty: 'Tách tầng xuất hiện khi bản vẽ có từ hai tầng trở lên.', // UEX:143, EXV:42-48,85
  presets: 'Mức tách sẵn', // EXR:90
  merged: 'Gộp', // EXT:133
  medium: 'Tách vừa', // EXT:136
  /* FIX-1724: the normal (non-collapsed) screen has no slider of its own; separation is the shell storey rail's
     "Độ tách" (VSR:114-130, name from the wrapping <label>, UVS:1099). "Độ tách các tầng" is only the collapsed rail (EXR:103). */
  slider: 'Độ tách', // VSR:114-130
  sliderSelector: '[aria-label="Tầng"] input[type=range]', // VSR:53,116 (the input itself has no aria-label)
  collapsedSlider: 'Độ tách các tầng', // EXR:103, collapsed only
  capture: 'Chụp ảnh khung nhìn', // EXV:121
  captureError: 'Chưa chụp được khung nhìn. Đợi mô hình dựng xong rồi bấm chụp lại.', // UEX:152-153
  livePrefix: 'Đã tách ', // UEX:149
  cardPrefix: 'Chọn tầng ', // EXF:132-135
  /* EXF:134-135 "Chọn tầng {floor.name}, cao độ …" today ("Chọn tầng Tầng 1"); the BUG-384 card patch makes it
     "Chọn {storeyInlineName}" ("Chọn tầng 1"). The card pattern accepts both. */
  card: (name: string): RegExp =>
    new RegExp(`^Chọn (${escapeRegExp(`tầng ${name}`)}|${escapeRegExp(storeyInlineName(name))}), cao độ `, 'u'),
} as const;

/* SCR-25 copy. */
const MT = {
  list: 'Phép đo', // MTL:60,201
  emptyHint: 'Chưa có phép đo nào. Nhấn M rồi chọn hai điểm trên mô hình.', // MTL:61, MTV:82
  unit: 'đơn vị', // MTL:62
  collapse: 'Thu gọn mục Phép đo', // MTL:63,208
  expandPattern: /^Mở mục Phép đo, 1 phép đo$/u, // MTL:183, MTG:322,434
  chip: /^1 phép đo — mở lại danh sách phép đo$/u, // MTV:198-211 countLabel + sr-only suffix (MTG:322,434)
  modes: 'Chọn chế độ đo', // MTV:162
  modeLabels: ['Điểm đến điểm', 'Vuông góc với bề mặt', 'Chiều cao', 'Diện tích mặt sàn'], // MTT:45-50
  toggleTool: 'Bật tắt công cụ đo (phím M)', // MTV:191
  railTool: 'đo (M)', // UVS:169, VTR:59
  railIdle: 'Quay quanh mô hình (R)', // UVS:167, UMT:186
  deleteGone: 'Phép đo này đã bị xoá ở nơi khác', // UMT:216
  loadError: 'Chưa tải được danh sách phép đo của dự án. Kiểm tra kết nối rồi thử lại.', // UMT:195
  retry: 'Thử lại', // MTV:229
  undo: 'Hoàn tác', // I18N common.undo (main spec SCR-25 manage)
} as const;

/* SCR-26 copy. */
const PV = {
  frame: 'Mô hình 3D', // PVT:101, PVV:25
  emptyTitle: 'Chưa có gì để dựng', // PVV:66
  emptyCaption: 'Bản vẽ chưa có đối tượng nào để dựng.', // PVT:92
  collapsedTitle: 'Khung xem đang thu gọn', // PVV:123
  expand: 'Mở khung xem', // PVV:125
  errorTitle: 'Không nạp được khung dựng hình', // PVV:106
  retry: 'Thử lại', // PVV:112
  forbiddenTitle: 'Chưa bật cho tài khoản này', // PVV:54
  forbiddenCaption: 'Màn xem 3D mới chưa bật cho tài khoản này.', // PVT:96
  flagKey: 'scene.pascal-viewer', // UPV:216
  rendered: /^(Đã dựng xong toàn bộ bản vẽ\.|Đã dựng xong, nhưng một số đối tượng chưa chuyển sang được\.)$/u, // PVT:93-94
  mountPath: '/assets/pascal/pascal-mount.js', // UPV:42
} as const;

/* SCR-27 copy. */
const MV = {
  region: 'Xem mô hình 3D trên điện thoại', // MVV:208
  tools: 'Công cụ xem mô hình', // MVB:195
  floors: 'Tầng', // MVB:44
  view: 'Chế độ xem', // MVB:45
  measure: 'Đo', // MVB:46
  info: 'Thông tin', // MVB:47
  emptyTitle: 'Chưa có mô hình để xem', // MVV:111
  partialRooms: 'Mô hình mới có một phần: một số tầng chưa có phòng nào được dựng từ bản vẽ.', // MVV:143
  noRoomsBadge: 'Chưa có phòng', // MVB:150
  measureEmpty: 'Chưa có phép đo nào. Chạm hai điểm trên mô hình để đo.', // MVB:176
  infoSheet: 'Thông tin đối tượng đang chọn', // MVI:202
  infoEmpty: 'Chưa chọn đối tượng nào. Chạm vào mô hình để xem thông tin của nó.', // MVI:250
  expandSheet: 'Mở rộng tấm thông tin', // MVI:228
  shrinkSheet: 'Thu gọn tấm thông tin', // MVI:228
  closeSheet: 'Đóng tấm thông tin', // MVI:238
} as const;

/* ---------------------------------------------------------------- small helpers */

type Json = Record<string, unknown>;
type Point = readonly [number, number];

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
const idBody = (): string => `QAE05${Date.now().toString(36).toUpperCase()}${Math.random().toString(36).slice(2, 6).toUpperCase()}`;
const escapeRegExp = (text: string): string => text.replace(/[.*+?^${}()|[\]\\]/gu, '\\$&');
const pathOf = (page: Page): string => new URL(page.url()).pathname;
const quiet = (page: Page): Promise<void> => page.waitForTimeout(QUIET_MS);

const spatialRe = (projectId: string): RegExp => new RegExp(`^/api/projects/${escapeRegExp(projectId)}/spatial$`, 'u');
const measurementsRe = (projectId: string): RegExp =>
  new RegExp(`^/api/projects/${escapeRegExp(projectId)}/measurements$`, 'u');
const measurementRe = (projectId: string): RegExp =>
  new RegExp(`^/api/projects/${escapeRegExp(projectId)}/measurements/[^/]+$`, 'u');

/** Writes the page sent since `mark`, minus session/telemetry chatter. */
const writesSince = (log: readonly ApiEntry[], mark: number): string[] =>
  log
    .slice(mark)
    .filter((entry) => entry.method !== 'GET' && entry.path !== REFRESH_API && !entry.path.startsWith('/api/telemetry'))
    .map((entry) => `${entry.method} ${entry.path} ${String(entry.status)}`);

/** Vietnamese percent text (`125%`, `87,5 %`) → number. */
const percentOf = (text: string): number => Number.parseFloat(text.replace(/[^\d,]/gu, '').replace(',', '.'));

/* ---------------------------------------------------------------- admin context + API fixtures */

interface FloorRef {
  readonly id: string;
  readonly name: string;
}

interface ProjectRef {
  readonly id: string;
  readonly name: string;
  readonly floors: readonly FloorRef[];
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
  readonly mobile?: boolean;
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
    ...(options.mobile === true ? { isMobile: true, hasTouch: true } : {}),
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
 * `FloorDraftIn` drafts, 3 m each, stacked). Floor ids are read back from `GET /api/projects/:id`, never invented.
 */
async function createProject(admin: Admin, slug: string, floorNames: readonly string[] = ['Tầng 1']): Promise<ProjectRef> {
  const name = `${TEST_DATA_PREFIX}e05-${slug}-${uniq()}`;
  expect(name.length, `fixture name "${name}" fits NAME_MAX 80`).toBeLessThanOrEqual(80);
  const created = await admin.context.request.post(PROJECTS_API, {
    headers: bearer(admin),
    data: {
      name,
      floors: floorNames.map((floor, order) => ({
        name: floor,
        order,
        elevationMm: order * FLOOR_HEIGHT_MM,
        heightMm: FLOOR_HEIGHT_MM,
      })),
    },
  });
  expect(created.status(), `fixture POST ${PROJECTS_API} "${name}"`).toBe(201);
  const id = stringField(await created.json(), 'id', 'POST /api/projects');
  admin.cleanup.push(id);

  const read = await admin.context.request.get(`${PROJECTS_API}/${id}`, { headers: bearer(admin) });
  expect(read.status(), `fixture GET ${PROJECTS_API}/${id}`).toBe(200);
  const floors = arrayOf(asRecord(await read.json(), 'GET /api/projects/:id').floors, 'floors').map((floor, index) => ({
    id: stringField(floor, 'id', `floors[${String(index)}]`),
    name: stringField(floor, 'name', `floors[${String(index)}]`),
  }));
  expect(floors.map((floor) => floor.name).sort(), 'fixture floors as created').toEqual([...floorNames].sort());
  return { id, name, floors: floorNames.map((floorName) => floors.find((floor) => floor.name === floorName) as FloorRef) };
}

const firstFloor = (project: ProjectRef): FloorRef => {
  const floor = project.floors[0];
  if (floor === undefined) throw new Error('fixture project has no floor');
  return floor;
};

/* ---- layer fixture (wire shape: src/api/schemas/spatial.ts, same as phase04 edge) ---- */

const AI_UNREVIEWED = { confidence: 0.9, reviewed: false, source: 'ai' } as const;
const wallId = (): string => `W-${idBody()}`;
const roomId = (): string => `R-${idBody()}`;

/** A 4 × 4 m box of four partition walls, plus one room inside it when `roomName` is given. */
function boxLayer(levelId: string, roomName: string | null): Json {
  const corners: readonly { x: number; y: number }[] = [
    { x: 0, y: 0 },
    { x: 4000, y: 0 },
    { x: 4000, y: 4000 },
    { x: 0, y: 4000 },
  ];
  const walls = corners.map((start, index) => ({
    ...AI_UNREVIEWED,
    centreline: { start, end: corners[(index + 1) % corners.length] },
    heightMm: FLOOR_HEIGHT_MM,
    id: wallId(),
    kind: 'partition',
    levelId,
    openingIds: [],
    thicknessMm: 220,
  }));
  return {
    furniture: [],
    openings: [],
    rooms:
      roomName === null
        ? []
        : [
            {
              ...AI_UNREVIEWED,
              areaM2: 16,
              id: roomId(),
              levelId,
              name: roomName,
              outline: corners,
              usage: 'bedroom',
              wallIds: walls.map((wall) => wall.id),
            },
          ],
    walls,
  };
}

/** Reads N16 (`revision`, `level.id`), then writes the box layer through #35 with that `baseVersion`. */
async function seedBox(admin: Admin, project: ProjectRef, floor: FloorRef, roomName: string | null): Promise<void> {
  const path = `${PROJECTS_API}/${project.id}/floors/${floor.id}/spatial/layer`;
  const read = await admin.context.request.get(path, { headers: bearer(admin) });
  expect(read.status(), `fixture GET ${path}`).toBe(200);
  const doc = asRecord(await read.json(), 'N16');
  const levelId = stringField(doc.level, 'id', 'N16.level');
  const put = await admin.context.request.put(path, {
    headers: bearer(admin),
    data: { baseVersion: doc.revision, body: { layer: boxLayer(levelId, roomName) } },
  });
  expect(put.status(), `fixture PUT ${path} (#35): ${(await put.text()).slice(0, 300)}`).toBe(200);
}

const roomNameFor = (slug: string): string => `${TEST_DATA_PREFIX}phong-${slug}`;

/** #17 record (BE:apps/api/measurements/schemas.py MeasurementRecordIn; id `^MS-[0-9]{4,15}$`). */
async function seedMeasurement(admin: Admin, project: ProjectRef, name: string): Promise<string> {
  const id = `MS-${String(1000 + Math.floor(Math.random() * 8999))}`;
  const created = await admin.context.request.post(`${PROJECTS_API}/${project.id}/measurements`, {
    headers: bearer(admin),
    data: { id, name, mode: 'pointToPoint', points: [{ x: 0, y: 0 }, { x: 4000, y: 0 }], rawValueMm: 4000 },
  });
  expect(created.status(), `fixture POST measurements: ${(await created.text()).slice(0, 300)}`).toBe(201);
  return id;
}

/* ---- screen helpers ---- */

const viewport = (page: Page): Locator => page.getByRole('main', { name: V3.viewport, exact: true });
const inspector = (page: Page): Locator => page.getByRole('complementary', { name: V3.inspector, exact: true });
const toolRail = (page: Page): Locator => page.getByRole('toolbar', { name: V3.tools, exact: true });

/** Opens a 3D route with a fresh document load and waits for its N15 read (200). */
async function openSpatialRoute(page: Page, url: string, project: ProjectRef): Promise<void> {
  await navigateThenWaitForApi(page, () => page.goto(url, { waitUntil: 'commit' }), 'GET', spatialRe(project.id), [200]);
}

/** `/3d` with its lazy EditorTour dismissed (G6) and the scene no longer busy (VVP:90). */
async function openViewer(page: Page, project: ProjectRef): Promise<void> {
  await openSpatialRoute(page, ROUTES.project.viewer(project.id), project);
  await expect(viewport(page)).toBeVisible();
  await dismissTour(page, { waitMs: TOUR_APPEAR_TIMEOUT_MS });
  await expect(viewport(page)).toHaveAttribute('aria-busy', 'false', { timeout: SCENE_TIMEOUT_MS });
}

/** Canvas-scope shortcuts need the viewport focused (VVP:116 `tabIndex=-1`; main spec `pressOnCanvas`). */
async function pressOnCanvas(page: Page, key: string): Promise<void> {
  await viewport(page).focus();
  await page.keyboard.press(key);
}

async function choosePreset(page: Page, label: string): Promise<void> {
  const select = page.getByRole('combobox', { name: V3.preset, exact: true });
  await select.click();
  await page.getByRole('option', { name: label, exact: true }).click();
  await expect(select).toHaveText(label);
}

async function zoomText(page: Page): Promise<string> {
  const label = await page
    .getByRole('group', { name: V3.zoomGroup, exact: true })
    .getByRole('button', { name: V3.zoomLabel })
    .getAttribute('aria-label');
  return V3.zoomLabel.exec(label ?? '')?.[1] ?? '';
}

/* ---- canvas pixels (sharp, a devDependency of AppFront) for the wall pick ---- */

interface CanvasShot {
  readonly png: Buffer;
  readonly box: { readonly x: number; readonly y: number; readonly width: number; readonly height: number };
}

/** Screenshot of the viewport canvas with every DOM overlay of the viewport hidden (CSSOM only, restored after). */
async function canvasOnlyShot(page: Page): Promise<CanvasShot> {
  const main = viewport(page);
  const box = await main.locator('canvas').first().boundingBox();
  if (box === null) throw new Error('viewport canvas has no bounding box');
  // A handle, not the role locator: `visibility: hidden` drops <main> from the accessibility tree while hidden.
  const handle = await main.elementHandle();
  if (handle === null) throw new Error('viewport <main> not found');
  const toggle = (only: boolean): Promise<void> =>
    handle.evaluate((element, canvasOnly) => {
      const root = element as HTMLElement;
      const canvas = root.querySelector('canvas');
      root.style.visibility = canvasOnly ? 'hidden' : '';
      if (canvas !== null) canvas.style.visibility = canvasOnly ? 'visible' : '';
    }, only);
  await toggle(true);
  try {
    return { png: await page.screenshot({ clip: box }), box };
  } finally {
    await toggle(false);
  }
}

/** Canvas pixels once two consecutive shots are identical (the scene renders on demand). */
async function settledCanvas(page: Page): Promise<CanvasShot> {
  let last = await canvasOnlyShot(page);
  await expect
    .poll(
      async () => {
        const now = await canvasOnlyShot(page);
        const same = now.png.equals(last.png);
        last = now;
        return same;
      },
      { message: 'canvas never settled (two identical frames)', intervals: [400], timeout: SCENE_TIMEOUT_MS },
    )
    .toBe(true);
  return last;
}

/**
 * Page points of non-background pixels (background = dominant colour, geometry = |ΔR|+|ΔG|+|ΔB| > 30), FARTHEST from
 * the canvas centre first: in the top view of the seeded box the walls are the outer ring and the room slab the inside.
 */
async function geometryPoints(shot: CanvasShot): Promise<Point[]> {
  const { data, info } = await sharp(shot.png).removeAlpha().raw().toBuffer({ resolveWithObject: true });
  const scale = info.width / shot.box.width;
  const step = Math.max(1, Math.round(6 * scale));
  const rgbAt = (x: number, y: number): readonly [number, number, number] => {
    const at = (y * info.width + x) * info.channels;
    return [data[at] ?? 0, data[at + 1] ?? 0, data[at + 2] ?? 0];
  };
  const counts = new Map<number, { n: number; rgb: readonly [number, number, number] }>();
  const samples: { x: number; y: number; rgb: readonly [number, number, number] }[] = [];
  for (let y = 0; y < info.height; y += step) {
    for (let x = 0; x < info.width; x += step) {
      const rgb = rgbAt(x, y);
      const key = ((rgb[0] >> 3) << 10) | ((rgb[1] >> 3) << 5) | (rgb[2] >> 3);
      const entry = counts.get(key);
      if (entry === undefined) counts.set(key, { n: 1, rgb });
      else entry.n += 1;
      samples.push({ x, y, rgb });
    }
  }
  const background = [...counts.values()].sort((left, right) => right.n - left.n)[0]?.rgb ?? [0, 0, 0];
  const centre: Point = [shot.box.x + shot.box.width / 2, shot.box.y + shot.box.height / 2];
  return samples
    .filter(({ rgb }) => Math.abs(rgb[0] - background[0]) + Math.abs(rgb[1] - background[1]) + Math.abs(rgb[2] - background[2]) > 30)
    .map(({ x, y }): Point => [shot.box.x + x / scale, shot.box.y + y / scale])
    .filter(([x, y]) => x > shot.box.x + 24 && x < shot.box.x + shot.box.width - 24 && y > shot.box.y + 24 && y < shot.box.y + shot.box.height - 24)
    .sort((p, q) => Math.hypot(q[0] - centre[0], q[1] - centre[1]) - Math.hypot(p[0] - centre[0], p[1] - centre[1]));
}

/** `null` when a click at (x, y) reaches the canvas itself (the picker listens on the canvas). */
async function blockerAt(page: Page, [x, y]: Point): Promise<string | null> {
  return page.evaluate(([px, py]) => {
    const hit = document.elementFromPoint(px ?? 0, py ?? 0);
    if (hit === null) return 'nothing';
    return hit.tagName === 'CANVAS' ? null : hit.tagName.toLowerCase();
  }, [x, y]);
}

/* ================================================================= SCR-23 Viewer 3D */

test.describe('E05 SCR-23 Viewer 3D', () => {
  test('E05 · SCR-23 unknown project id → "Không tìm thấy dự án này" + "Về danh sách dự án" → dashboard', async ({ browser }) => {
    await withAdmin(browser, async (admin) => {
      const { page, api } = admin;
      // Not a `prj_<ULID>`: BE answers 404 `project` (phase04 edge, BE:apps/api/projects/access.py:28-33).
      const projectId = `prj_qa-e05-${uniq()}`;
      const mark = api.length;
      const notFound = waitForApi(page, 'GET', /^\/api\/projects\/[^/]+(\/spatial)?$/u, [404]);
      await page.goto(ROUTES.project.viewer(projectId));
      await notFound;
      // PSG:73-75 status notFound → ProjectNotFound, wrapped in <main> (V3C:424 wrapFallbackInMain).
      const alert = page.getByRole('alert').filter({ hasText: GATE.notFoundTitle });
      await expect(alert).toBeVisible();
      await expect(alert).toContainText(GATE.notFoundDescription);
      await expect(viewport(page)).toHaveCount(0);
      await captureEvidence(page, 'E05_viewer_unknown_project.png');

      await alert.getByRole('button', { name: GATE.backToProjects, exact: true }).click(); // PSG:56
      await expect.poll(() => pathOf(page)).toBe(ROUTES.dashboard);
      await expect(page.getByRole('heading', { level: 1, name: DASHBOARD_TITLE, exact: true })).toBeVisible();
      expect(writesSince(api, mark), 'an unknown project writes nothing').toEqual([]);
      await attachJson('E05_viewer_unknown_project.json', { projectId, landedOn: pathOf(page), writes: writesSince(api, mark) });
    });
  });

  test('E05 · SCR-23 floor without walls → empty "Mô hình 3D sẽ xuất hiện…" + "Quay lại xem lớp tường" opens that floor\'s walls', async ({ browser }) => {
    await withAdmin(browser, async (admin) => {
      const { page } = admin;
      const project = await createProject(admin, 'v3-empty');
      const floor = firstFloor(project);
      await openSpatialRoute(page, ROUTES.project.viewer(project.id), project);
      await dismissTour(page, { waitMs: TOUR_APPEAR_TIMEOUT_MS });
      // UV3:681-683 no level with buildable parts → 'empty'; V3V:46-57.
      await expect(page.getByText(V3.emptyText, { exact: true })).toBeVisible({ timeout: SCENE_TIMEOUT_MS });
      const link = page.getByRole('link', { name: V3.emptyLink, exact: true });
      // UV3:754-757 qcHref = walls(projectId, first storey) — the storey id is the floor (level) id.
      await expect(link).toHaveAttribute('href', ROUTES.project.walls(project.id, floor.id));
      // OS:172-174 no room → no search trigger.
      await expect(page.getByRole('button', { name: V3.searchTrigger, exact: true })).toHaveCount(0);
      await captureEvidence(page, 'E05_viewer_empty.png');

      await link.click();
      await expect.poll(() => pathOf(page)).toBe(ROUTES.project.walls(project.id, floor.id));
      await expect(page.getByRole('region', { name: WALLS_SCREEN, exact: true })).toBeVisible();
      await dismissTour(page, { waitMs: TOUR_APPEAR_TIMEOUT_MS });
      await captureEvidence(page, 'E05_viewer_empty_to_walls.png');
    });
  });

  test('E05 · SCR-23 two floors, one without walls → partial: "Tầng đã dựng xong" + "{name} — chưa có tường hay phòng nào"', async ({ browser }) => {
    await withAdmin(browser, async (admin) => {
      const { page } = admin;
      const project = await createProject(admin, 'v3-partial', ['Tầng 1', 'Tầng 2']);
      const [built, bare] = project.floors as [FloorRef, FloorRef];
      await seedBox(admin, project, built, roomNameFor('partial'));
      await openViewer(page, project);
      // UVS:598 / UV3:685-686 a storey without rooms (VSG:184 isPartial) → 'partial'; V3V:124-150 one block per storey.
      await expect(page.getByText(V3.storeyReady, { exact: true })).toBeVisible({ timeout: SCENE_TIMEOUT_MS });
      await expect(page.getByText(`${bare.name}${V3.noPartsSuffix}`, { exact: true })).toBeVisible(); // UV3:653-662
      await captureEvidence(page, 'E05_viewer_partial.png');
    });
  });

  test('E05 · SCR-23 [mocked response] GET …/spatial 500 → gate error "Có trục trặc", never blank; reload recovers', async ({ browser }) => {
    test.setTimeout(HEAVY_TEST_TIMEOUT_MS);
    await withAdmin(browser, async (admin) => {
      const { page } = admin;
      const project = await createProject(admin, 'v3-500');
      await seedBox(admin, project, firstFloor(project), roomNameFor('500'));
      const matcher = spatialRe(project.id);
      let served = 0;
      const handler = async (route: Route): Promise<void> => {
        if (route.request().method() !== 'GET' || !matcher.test(new URL(route.request().url()).pathname)) {
          await route.fallback();
          return;
        }
        served += 1;
        await route.fulfill({ status: 500, contentType: 'application/json', body: JSON.stringify({ detail: 'qa-e05 mocked 500' }) });
      };
      await page.route('**/api/projects/**', handler);
      await page.goto(ROUTES.project.viewer(project.id));
      // PSG:77-90 N15 failed with no graph in the store → error EmptyState; 500 → errors.unknown (not retryable: no button).
      const alert = page.getByRole('alert').filter({ hasText: GENERIC_UNKNOWN });
      await expect(alert).toBeVisible({ timeout: ERROR_PAINT_TIMEOUT_MS });
      await expect(alert).toContainText(GENERIC_UNKNOWN_TITLE);
      await expect(page.getByRole('main')).toHaveCount(1); // V3C:424 wrapFallbackInMain — landmark kept
      await captureEvidence(page, 'E05_viewer_spatial_500.png');
      await attachJson('E05_viewer_spatial_500.json', { mockedSpatialResponses: served, status: 500 });

      await page.unroute('**/api/projects/**', handler);
      await openViewer(page, project);
      await expect(alert).toHaveCount(0);
    });
  });

  test('E05 · SCR-23 breadcrumb + status bar: project name, "Mô hình 3D" current page, "1 tầng · 1 phòng"; reload keeps the route', async ({ browser }) => {
    await withAdmin(browser, async (admin) => {
      const { page, api } = admin;
      const project = await createProject(admin, 'v3-crumb');
      await seedBox(admin, project, firstFloor(project), roomNameFor('crumb'));
      await openViewer(page, project);
      const crumbs = page.getByRole('navigation', { name: V3.breadcrumb, exact: true });
      await expect(crumbs).toContainText(project.name); // UVS:1062 projectQuery (readProjectName)
      await expect(crumbs.locator('[aria-current="page"]')).toHaveText(V3.breadcrumbLeaf); // VCH:56-65
      // VSB:25-28 a <footer> inside the shell <section> has no contentinfo role in Chromium: located by its aria-label.
      const status = page.locator(`footer[aria-label="${V3.statusBar}"]`);
      await expect(status).toContainText('1 tầng'); // UVS:979-980
      await expect(status).toContainText('1 phòng');

      const mark = api.length;
      await openSpatialRoute(page, ROUTES.project.viewer(project.id), project); // fresh document load = reload
      await expect(viewport(page)).toBeVisible();
      await dismissTour(page, { waitMs: TOUR_APPEAR_TIMEOUT_MS });
      expect(pathOf(page)).toBe(ROUTES.project.viewer(project.id));
      await expect(crumbs).toContainText(project.name);
      await expect(status).toContainText('1 phòng');
      expect(writesSince(api, mark), 'reloading the viewer writes nothing').toEqual([]);
      await captureEvidence(page, 'E05_viewer_breadcrumb_status.png');
      await attachJson('E05_viewer_breadcrumb_status.json', { path: pathOf(page), writesOnReload: writesSince(api, mark) });
    });
  });

  test('E05 · SCR-23 zoom cluster: "Phóng to" / "Thu nhỏ" move "Mức thu phóng …"; the label button and "Vừa khung hình" return it', async ({ browser }) => {
    await withAdmin(browser, async (admin) => {
      const { page } = admin;
      const project = await createProject(admin, 'v3-zoom');
      await seedBox(admin, project, firstFloor(project), roomNameFor('zoom'));
      await openViewer(page, project);
      const group = page.getByRole('group', { name: V3.zoomGroup, exact: true });
      const reset = group.getByRole('button', { name: V3.zoomLabel });

      // Start from the framed view (UVS:1108 reset = fit all) so "chuẩn" is a known value.
      await reset.click();
      await expect.poll(() => zoomText(page)).not.toBe('');
      await page.waitForTimeout(1_000); // camera transition settles (UVS:1002-1010 label follows the camera tick)
      const framed = await zoomText(page);

      await group.getByRole('button', { name: V3.zoomIn, exact: true }).click();
      await expect.poll(async () => percentOf(await zoomText(page)), { message: '"Phóng to" raises the zoom label' }).toBeGreaterThan(percentOf(framed));
      await reset.click();
      await expect.poll(() => zoomText(page), { message: 'label button returns to the framed level' }).toBe(framed);

      await group.getByRole('button', { name: V3.zoomOut, exact: true }).click();
      await expect.poll(async () => percentOf(await zoomText(page)), { message: '"Thu nhỏ" lowers the zoom label' }).toBeLessThan(percentOf(framed));
      const zoomedOut = await zoomText(page);
      await group.getByRole('button', { name: V3.fitAll, exact: true }).click(); // VCH:162 onFitAll
      await expect.poll(() => zoomText(page), { message: '"Vừa khung hình" returns to the framed level' }).toBe(framed);
      await captureEvidence(page, 'E05_viewer_zoom_cluster.png');
      await attachJson('E05_viewer_zoom_cluster.json', { framed, zoomedOut });
    });
  });

  test('E05 · SCR-23 ViewCube face "Trên xuống" drives "Góc nhìn sẵn" (two-way)', async ({ browser }) => {
    await withAdmin(browser, async (admin) => {
      const { page } = admin;
      const project = await createProject(admin, 'v3-cube');
      await seedBox(admin, project, firstFloor(project), roomNameFor('cube'));
      await openViewer(page, project);
      const cube = page.getByRole('group', { name: V3.cube, exact: true });
      const select = page.getByRole('combobox', { name: V3.preset, exact: true });

      await expect(cube.getByRole('button', { name: 'Phối cảnh', exact: true })).toHaveAttribute('aria-pressed', 'true'); // UVS:461
      await cube.getByRole('button', { name: 'Trên xuống', exact: true }).click(); // VOV:51-67 onCubeFaceSelect
      await expect(select).toHaveText('Trên xuống');
      await expect(cube.getByRole('button', { name: 'Trên xuống', exact: true })).toHaveAttribute('aria-pressed', 'true');
      await expect(cube.getByRole('button', { name: 'Phối cảnh', exact: true })).toHaveAttribute('aria-pressed', 'false');

      await choosePreset(page, 'Trục đo'); // UVS:178
      await expect(cube.getByRole('button', { name: 'Trục đo', exact: true })).toHaveAttribute('aria-pressed', 'true');
      await captureEvidence(page, 'E05_viewer_cube_preset.png');
    });
  });

  test('E05 · SCR-23 storey rail: digit 2, Shift+click adds, eye "Ẩn tầng {n}" ↔ "Hiện tầng {n}"', async ({ browser }) => {
    await withAdmin(browser, async (admin) => {
      const { page } = admin;
      const project = await createProject(admin, 'v3-storeys', ['Tầng 1', 'Tầng 2']);
      const [lower, upper] = project.floors as [FloorRef, FloorRef];
      await seedBox(admin, project, lower, roomNameFor('storey-1'));
      await seedBox(admin, project, upper, roomNameFor('storey-2'));
      await openViewer(page, project);
      // VSR:61-62 option "{name}, cao độ {elevation}", aria-selected.
      const option = (floor: FloorRef): Locator => page.getByRole('option', { name: new RegExp(`^${escapeRegExp(floor.name)}, cao độ `, 'u') });

      await expect(option(lower)).toHaveAttribute('aria-selected', 'false'); // UVS:463 none active at start
      await pressOnCanvas(page, '2'); // VSS:44,133-141 digit n → n-th storey from the bottom
      await expect(option(upper)).toHaveAttribute('aria-selected', 'true');
      await expect(option(lower)).toHaveAttribute('aria-selected', 'false');

      await option(lower).click({ modifiers: ['Shift'] }); // VSR:73 event.shiftKey → additive (UVS:622-630)
      await expect(option(lower)).toHaveAttribute('aria-selected', 'true');
      await expect(option(upper)).toHaveAttribute('aria-selected', 'true');

      const lowerInline = storeyInlineName(lower.name); // "Tầng 1" → "tầng 1"
      await page.getByRole('button', { name: `Ẩn ${lowerInline}`, exact: true }).click(); // VSR:86-90
      const show = page.getByRole('button', { name: `Hiện ${lowerInline}`, exact: true });
      await expect(show).toHaveAttribute('aria-pressed', 'false');
      await captureEvidence(page, 'E05_viewer_storey_rail.png');
      await show.click();
      await expect(page.getByRole('button', { name: `Ẩn ${lowerInline}`, exact: true })).toHaveAttribute('aria-pressed', 'true');
    });
  });

  test('E05 · SCR-23 separation "Độ tách": key E jumps to 0,5 and back to 0', async ({ browser }) => {
    await withAdmin(browser, async (admin) => {
      const { page } = admin;
      const project = await createProject(admin, 'v3-sep', ['Tầng 1', 'Tầng 2']);
      for (const floor of project.floors) await seedBox(admin, project, floor, roomNameFor(`sep-${floor.name}`));
      await openViewer(page, project);
      const slider = page.getByRole('slider', { name: V3.separation, exact: true });
      await expect(slider).toHaveValue('0'); // UVS:465
      await pressOnCanvas(page, 'E'); // VSS:62, UVS:848-849 → rememberedSeparation = SEPARATION_STEP 0.5 (UVS:142,466)
      await expect(slider).toHaveValue('0.5');
      await captureEvidence(page, 'E05_viewer_separation_key.png');
      await pressOnCanvas(page, 'E');
      await expect(slider).toHaveValue('0');
    });
  });

  test('E05 · SCR-23 tool rail keys R / H / C / V / M and "cô lập (Alt+H)" click set aria-pressed', async ({ browser }) => {
    await withAdmin(browser, async (admin) => {
      const { page } = admin;
      const project = await createProject(admin, 'v3-tools');
      await seedBox(admin, project, firstFloor(project), roomNameFor('tools'));
      await openViewer(page, project);
      const rail = toolRail(page);
      // UVS:167-173 labels, VTR:59-60 "{label} ({key})" + aria-pressed; VSS:73-79 keys.
      const byKey: readonly (readonly [string, string])[] = [
        ['H', 'kéo màn (H)'],
        ['C', 'mặt cắt (C)'],
        ['V', 'chọn (V)'],
        ['M', 'đo (M)'],
        ['R', 'Quay quanh mô hình (R)'],
      ];
      await expect(rail.getByRole('button', { name: 'Quay quanh mô hình (R)', exact: true })).toHaveAttribute('aria-pressed', 'true'); // UVS:460
      for (const [key, name] of byKey) {
        await pressOnCanvas(page, key);
        await expect(rail.getByRole('button', { name, exact: true }), `key ${key}`).toHaveAttribute('aria-pressed', 'true');
      }
      expect(pathOf(page), 'M on /3d switches the tool, not the route').toBe(ROUTES.project.viewer(project.id));
      await rail.getByRole('button', { name: 'cô lập (Alt+H)', exact: true }).click();
      await expect(rail.getByRole('button', { name: 'cô lập (Alt+H)', exact: true })).toHaveAttribute('aria-pressed', 'true');
      await expect(rail.getByRole('button', { name: 'Quay quanh mô hình (R)', exact: true })).toHaveAttribute('aria-pressed', 'false');
      await captureEvidence(page, 'E05_viewer_tool_keys.png');
    });
  });

  test('E05 · SCR-23 room search: no match → "Không có phòng nào khớp"; Enter selects; Esc returns focus to "Tìm phòng"', async ({ browser }) => {
    await withAdmin(browser, async (admin) => {
      const { page } = admin;
      const project = await createProject(admin, 'v3-search');
      const roomName = roomNameFor('search');
      await seedBox(admin, project, firstFloor(project), roomName);
      await openViewer(page, project);
      const trigger = page.getByRole('button', { name: V3.searchTrigger, exact: true });
      const box = page.getByRole('combobox', { name: V3.searchInput, exact: true });

      await trigger.click(); // OS:188
      await dismissTour(page, { waitMs: TOUR_APPEAR_TIMEOUT_MS });
      await expect(box).toBeFocused(); // OS:127-131
      await box.fill('zzz-khong-co-phong-nay');
      await expect(page.getByText(V3.noMatch, { exact: true })).toBeVisible(); // OS:258-262
      await expect(page.getByRole('listbox', { name: V3.searchList, exact: true }).getByRole('option')).toHaveCount(0);
      await captureEvidence(page, 'E05_viewer_search_no_match.png');

      await box.fill(roomName.slice(-8));
      await expect(page.getByRole('listbox', { name: V3.searchList, exact: true }).getByRole('option')).toHaveCount(1);
      await box.press('ArrowDown'); // OS:156-161 wraps on one option
      await box.press('Enter'); // OS:164-167 choose(active) + close
      await expect(inspector(page)).toContainText(roomName);
      await expect(box).toHaveCount(0);
      await expect(trigger).toBeFocused(); // OS:132-133 focus back to the trigger after close

      await pressOnCanvas(page, '/'); // VSS:92
      await expect(box).toBeFocused();
      await box.press('Escape'); // OS:149-153
      await expect(box).toHaveCount(0);
      await expect(trigger).toBeFocused();
      await expect(inspector(page)).toContainText(roomName, { timeout: 5_000 }); // Esc in the box does not deselect (stopPropagation)
      await captureEvidence(page, 'E05_viewer_search_keyboard.png');
    });
  });

  test('E05 · SCR-23 selected room → "Thuộc tính đối tượng" (Tên = room), no "Sửa hình học tường"; "Đóng" clears the selection', async ({ browser }) => {
    await withAdmin(browser, async (admin) => {
      const { page, api } = admin;
      const project = await createProject(admin, 'v3-props');
      const roomName = roomNameFor('props');
      await seedBox(admin, project, firstFloor(project), roomName);
      await openViewer(page, project);
      await page.getByRole('button', { name: V3.searchTrigger, exact: true }).click();
      await dismissTour(page, { waitMs: TOUR_APPEAR_TIMEOUT_MS });
      await page.getByRole('listbox', { name: V3.searchList, exact: true }).getByRole('option').filter({ hasText: roomName }).click();

      const section = page.getByRole('region', { name: V3.selectedSection, exact: true }); // V3P:228-244
      const props = section.getByRole('region', { name: PROPS.region, exact: true });
      await expect(props).toBeVisible();
      await expect(props.getByRole('textbox', { name: PROPS.name, exact: true })).toHaveValue(roomName);
      // V3C:305-307 wall-geometry mode only for a W- selection.
      await expect(page.getByRole('button', { name: V3.enterWallEdit, exact: true })).toHaveCount(0);
      await captureEvidence(page, 'E05_viewer_room_inspector.png');

      const mark = api.length;
      await props.getByRole('button', { name: PROPS.close, exact: true }).click(); // PI header onClose → V3C:325 clearSelection
      await expect(section).toHaveCount(0);
      await expect(inspector(page)).toContainText(V3.nothingSelected);
      await quiet(page);
      expect(writesSince(api, mark), 'closing the inspector writes nothing').toEqual([]);
      await captureEvidence(page, 'E05_viewer_room_inspector_closed.png');
    });
  });

  test('E05 · SCR-23 "Diện tích phòng" with no room → "Chưa khép được vòng phòng nào" + "Kiểm tra khe hở tường" → walls; second click closes', async ({ browser }) => {
    await withAdmin(browser, async (admin) => {
      const { page } = admin;
      const project = await createProject(admin, 'v3-rooms-empty');
      const floor = firstFloor(project);
      await seedBox(admin, project, floor, null);
      await openViewer(page, project);
      const nav = page.getByRole('navigation', { name: V3.panels, exact: true });
      const toggle = nav.getByRole('button', { name: V3.roomsPanel, exact: true });

      await toggle.click();
      await dismissTour(page, { waitMs: TOUR_APPEAR_TIMEOUT_MS });
      await expect(toggle).toHaveAttribute('aria-expanded', 'true');
      await toggle.click(); // V3P:193-195 same id → close
      await expect(toggle).toHaveAttribute('aria-expanded', 'false');
      await expect(page.locator('#viewer-3d-panel-rooms')).toHaveCount(0);
      await toggle.click();

      const panel = page.getByRole('region', { name: ROOMS_PANEL.region, exact: true });
      await expect(panel.getByText(ROOMS_PANEL.emptyTitle, { exact: true })).toBeVisible(); // RAP useRoomAreaPanel.model.ts:575-576
      await captureEvidence(page, 'E05_viewer_rooms_panel_empty.png');
      await panel.getByRole('button', { name: ROOMS_PANEL.emptyAction, exact: true }).click(); // V3C:272-280 onCheckWallGaps
      await expect.poll(() => pathOf(page)).toBe(ROUTES.project.walls(project.id, floor.id));
      await expect(page.getByRole('region', { name: WALLS_SCREEN, exact: true })).toBeVisible();
      await dismissTour(page, { waitMs: TOUR_APPEAR_TIMEOUT_MS });
      await captureEvidence(page, 'E05_viewer_rooms_panel_to_walls.png');
    });
  });

  test('E05 · SCR-23 wall picked → invalid vertex "abc" → "Giá trị chưa hợp lệ…", reverted, no PUT; "Thoát chế độ sửa hình học"', async ({ browser }) => {
    test.setTimeout(HEAVY_TEST_TIMEOUT_MS);
    await withAdmin(browser, async (admin) => {
      const { page, api } = admin;
      const project = await createProject(admin, 'v3-wall-edit');
      await seedBox(admin, project, firstFloor(project), roomNameFor('wall-edit'));
      await openViewer(page, project);
      await choosePreset(page, 'Trên xuống');
      await page.mouse.move(5, 5);
      const points = await geometryPoints(await settledCanvas(page));
      const enter = page.getByRole('button', { name: V3.enterWallEdit, exact: true });
      let picked = false;
      let tried = 0;
      for (const point of points) {
        if (tried >= 40) break;
        if ((await blockerAt(page, point)) !== null) continue;
        tried += 1;
        await page.mouse.click(point[0], point[1]);
        if (await enter.waitFor({ state: 'visible', timeout: 1_500 }).then(() => true, () => false)) {
          picked = true;
          break;
        }
      }
      if (!picked) {
        test.fixme(true, `UNKNOWN - NEED VERIFICATION: no canvas click selected a wall (${String(points.length)} model pixels, ${String(tried)} clicks reached the canvas).`);
        return;
      }

      await enter.click(); // V3P:246-265
      await expect(page.getByRole('button', { name: V3.exitWallEdit, exact: true })).toHaveAttribute('aria-pressed', 'true');
      const editor = page.getByRole('region', { name: WALL_EDITOR.region, exact: true });
      const xField = editor.getByRole('textbox', { name: WALL_EDITOR.xPattern }).first();
      await expect(xField).toBeVisible();
      const original = await xField.inputValue();

      const mark = api.length;
      await xField.fill('abc');
      await xField.press('Enter'); // WallGeometryVertexTable.tsx:48-49 commit; useWallGeometryEditor.ts:927-944 invalid cell
      await expect(editor.getByText(WALL_EDITOR.cellInvalid, { exact: true })).toBeVisible();
      await quiet(page);
      expect(writesSince(api, mark), 'an invalid vertex value sends no layer PUT').toEqual([]);
      await captureEvidence(page, 'E05_viewer_wall_invalid_vertex.png');
      const shown = await xField.inputValue();
      await attachJson('E05_viewer_wall_invalid_vertex.json', { original, typed: 'abc', shownAfterCommit: shown, writes: writesSince(api, mark) });
      // The message says the coordinate went back to the old number (wallGeometryEditorTypes.ts:530), so the field must
      // show it; WallGeometryVertexTable.tsx:41 shows `draftValue` while the cell status is 'invalid'.
      expect.soft(shown, 'field shows the old coordinate, as the message "…đã trở về số cũ" says').toBe(original);

      await page.getByRole('button', { name: V3.exitWallEdit, exact: true }).click(); // V3C:309-311 toggle off
      await expect(editor).toHaveCount(0);
      await expect(enter).toHaveAttribute('aria-pressed', 'false');
    });
  });
});

/* ================================================================= SCR-24 Exploded View */

test.describe('E05 SCR-24 Exploded View', () => {
  test('E05 · SCR-24 one floor → empty "Tách tầng xuất hiện khi bản vẽ có từ hai tầng trở lên.", no rail, no capture', async ({ browser }) => {
    await withAdmin(browser, async (admin) => {
      const { page } = admin;
      const project = await createProject(admin, 'ex-one');
      await seedBox(admin, project, firstFloor(project), roomNameFor('ex-one'));
      await openSpatialRoute(page, ROUTES.project.exploded(project.id), project);
      await dismissTour(page);
      // UEX:849-860 fewer than 2 storeys → 'empty'; EXV:73-75,89 screen controls hidden.
      await expect(page.getByText(EX.empty, { exact: true })).toBeVisible({ timeout: SCENE_TIMEOUT_MS });
      // The shell rail keeps its one "Độ tách" (VS/ViewerShell.tsx:133-145); the screen adds no second one (FIX-1724).
      await expect(page.getByRole('slider', { name: EX.slider, exact: true })).toHaveCount(1);
      await expect(page.getByRole('slider', { name: EX.collapsedSlider, exact: true })).toHaveCount(0);
      await expect(page.getByRole('button', { name: EX.capture, exact: true })).toHaveCount(0);
      await expect(page.getByRole('radiogroup', { name: EX.presets, exact: true })).toHaveCount(0);
      await captureEvidence(page, 'E05_exploded_one_floor.png');
    });
  });

  test('E05 · SCR-24 presets "Gộp" / "Tách vừa": floor cards only above 20 %, live "Đã tách 50 %"; Space cycles', async ({ browser }) => {
    test.setTimeout(HEAVY_TEST_TIMEOUT_MS);
    await withAdmin(browser, async (admin) => {
      const { page } = admin;
      const project = await createProject(admin, 'ex-presets', ['Tầng 1', 'Tầng 2']);
      for (const floor of project.floors) await seedBox(admin, project, floor, roomNameFor(`ex-${floor.name}`));
      await openSpatialRoute(page, ROUTES.project.exploded(project.id), project);
      await dismissTour(page);
      const slider = page.getByRole('slider', { name: EX.slider, exact: true }); // shell rail, UEX:786-790 same value
      const presets = page.getByRole('radiogroup', { name: EX.presets, exact: true });
      await expect(presets).toBeVisible({ timeout: SCENE_TIMEOUT_MS }); // EXV:75,89-102 screen controls
      await expect(page.getByRole('slider', { name: EX.collapsedSlider, exact: true }), 'one separation control (FIX-1724)').toHaveCount(0);
      const cards = page.getByRole('button', { name: new RegExp(`^${EX.cardPrefix}`, 'u') });

      await presets.getByRole('radio', { name: EX.merged, exact: true }).click(); // EXT:133 separation 0
      await expect(slider).toHaveValue('0');
      await expect(cards).toHaveCount(0); // UEX:399 areLabelsVisible = separation > 0.2 (EXT:170); EXF:352-354

      await presets.getByRole('radio', { name: EX.medium, exact: true }).click(); // EXT:134-137 (0+1)/2
      await expect(slider).toHaveValue('0.5');
      await expect(cards).toHaveCount(2);
      // UEX:411 liveMessage "Đã tách {percent}" in an aria-live region (EXV:133-135).
      await expect(page.locator('[aria-live="polite"]').filter({ hasText: /^Đã tách 50\s?%$/u })).toHaveCount(1);
      await captureEvidence(page, 'E05_exploded_medium.png');

      // UEX:798-812 Space: MAX, then back to the previous value after cycleHalfMs (EXT:194). Sample every frame.
      await viewport(page).focus();
      const sampled = page.evaluate((selector) => new Promise<string[]>((resolve) => {
        const input = document.querySelector<HTMLInputElement>(selector);
        const seen = new Set<string>();
        const end = performance.now() + 3_000;
        const tick = (): void => {
          if (input !== null) seen.add(input.value);
          if (performance.now() < end) requestAnimationFrame(tick);
          else resolve([...seen]);
        };
        tick();
      }), EX.sliderSelector);
      await page.keyboard.press('Space');
      const values = await sampled;
      expect(values, 'Space reaches full separation').toContain('1');
      await expect(slider).toHaveValue('0.5');
      await captureEvidence(page, 'E05_exploded_presets_cycle.png');
      await attachJson('E05_exploded_presets_cycle.json', { sliderValuesDuringSpace: values });
    });
  });

  test('E05 · SCR-24 floor card "Chọn tầng {name}…" selects that storey on the rail', async ({ browser }) => {
    await withAdmin(browser, async (admin) => {
      const { page } = admin;
      const project = await createProject(admin, 'ex-card', ['Tầng 1', 'Tầng 2']);
      for (const floor of project.floors) await seedBox(admin, project, floor, roomNameFor(`card-${floor.name}`));
      // The lower card; the top card's clickability (cards left of the minimap, EXT:171 cardsRightPx) is the test below.
      const [lower] = project.floors as [FloorRef, FloorRef];
      await openSpatialRoute(page, ROUTES.project.exploded(project.id), project);
      await dismissTour(page);
      await expect(page.getByRole('radiogroup', { name: EX.presets, exact: true })).toBeVisible({ timeout: SCENE_TIMEOUT_MS });
      await page.getByRole('radiogroup', { name: EX.presets, exact: true }).getByRole('radio', { name: EX.medium, exact: true }).click();

      await page.getByRole('button', { name: EX.card(lower.name) }).click(); // EXF:130-135
      // UEX:377-384 onFloorActivate → onStoreyActivate(id, false) → rail option aria-selected (VSR:62).
      await expect(page.getByRole('option', { name: new RegExp(`^${escapeRegExp(lower.name)}, cao độ `, 'u') })).toHaveAttribute('aria-selected', 'true');
      await captureEvidence(page, 'E05_exploded_card_select.png');
    });
  });

  test('E05 · SCR-24 "Chụp ảnh khung nhìn" and the top floor card receive a mouse click (not covered by ViewCube / minimap)', async ({ browser }) => {
    await withAdmin(browser, async (admin) => {
      const { page } = admin;
      const project = await createProject(admin, 'ex-click', ['Tầng 1', 'Tầng 2']);
      for (const floor of project.floors) await seedBox(admin, project, floor, roomNameFor(`click-${floor.name}`));
      const [, upper] = project.floors as [FloorRef, FloorRef];
      await openSpatialRoute(page, ROUTES.project.exploded(project.id), project);
      await dismissTour(page);
      await expect(page.getByRole('radiogroup', { name: EX.presets, exact: true })).toBeVisible({ timeout: SCENE_TIMEOUT_MS });
      await page.getByRole('radiogroup', { name: EX.presets, exact: true }).getByRole('radio', { name: EX.medium, exact: true }).click();
      // EXV:116-119 capture at `right: captureRightPx` 88 (EXT:165, left of the ViewCube); EXF:95-96 cards at `cardsRightPx`
      // 176 (EXT:171, left of the minimap); shell ViewCube + minimap at `right-2 top-2` (BUG-371, FIX-1721).
      const targets = {
        capture: page.getByRole('button', { name: EX.capture, exact: true }),
        topCard: page.getByRole('button', { name: EX.card(upper.name) }),
      };
      const reachable: Record<string, string> = {};
      const plain = (text: string): string => text.replace(/\u001b\[[0-9;]*m/gu, '').trim();
      for (const [key, target] of Object.entries(targets)) {
        await expect(target).toBeVisible();
        reachable[key] = await target.click({ trial: true, timeout: 5_000 }).then(
          () => 'clickable',
          (error: unknown) => {
            const lines = error instanceof Error ? error.message.split('\n') : [];
            return plain(lines.find((line) => line.includes('intercepts')) ?? 'not clickable');
          },
        );
      }
      await captureEvidence(page, 'E05_exploded_top_right_click.png');
      await attachJson('E05_exploded_top_right_click.json', reachable);
      expect.soft(reachable.capture, '"Chụp ảnh khung nhìn" receives the click').toBe('clickable');
      expect.soft(reachable.topCard, `"Chọn tầng ${upper.name}…" receives the click`).toBe('clickable');
      if (reachable.capture === 'clickable') {
        await targets.capture.click(); // UEX:768-774
        await expect(targets.capture).toBeEnabled();
        await quiet(page);
        await expect(page.getByText(EX.captureError, { exact: true })).toHaveCount(0);
      }
    });
  });
});

/* ================================================================= SCR-25 Measurement Tool */

const measureList = (page: Page): Locator => page.getByRole('region', { name: MT.list, exact: true });

async function openMeasure(page: Page, project: ProjectRef): Promise<void> {
  await navigateThenWaitForApi(
    page,
    () => page.goto(ROUTES.project.measure(project.id), { waitUntil: 'commit' }),
    'GET',
    measurementsRe(project.id),
    [200],
  );
  await dismissTour(page);
  await expect(viewport(page)).toHaveAttribute('aria-busy', 'false', { timeout: SCENE_TIMEOUT_MS });
}

test.describe('E05 SCR-25 Measurement Tool', () => {
  test('E05 · SCR-25 no measurement → "Chưa có phép đo nào. Nhấn M rồi chọn hai điểm trên mô hình." in "Phép đo"', async ({ browser }) => {
    await withAdmin(browser, async (admin) => {
      const { page } = admin;
      const project = await createProject(admin, 'mt-empty');
      await seedBox(admin, project, firstFloor(project), roomNameFor('mt-empty'));
      await openMeasure(page, project);
      await expect(measureList(page).getByText(MT.emptyHint, { exact: true })).toBeVisible(); // MTL:229-231
      await expect(measureList(page).getByRole('listitem')).toHaveCount(0);
      // MTV:150 the tool overlay shows the same invitation in state 'empty' (UMT:949-950).
      await expect(page.getByText(MT.emptyHint, { exact: true })).toHaveCount(2);
      await captureEvidence(page, 'E05_measure_empty.png');
    });
  });

  test('E05 · SCR-25 seeded record: unit cm relabels; "Thu gọn mục Phép đo" → overlay chip "1 phép đo" → expanded again', async ({ browser }) => {
    await withAdmin(browser, async (admin) => {
      const { page } = admin;
      const project = await createProject(admin, 'mt-unit');
      await seedBox(admin, project, firstFloor(project), roomNameFor('mt-unit'));
      const name = `${TEST_DATA_PREFIX}do-unit`;
      await seedMeasurement(admin, project, name);
      await openMeasure(page, project);
      const row = measureList(page).getByRole('listitem').filter({ has: page.getByRole('button', { name: `Ẩn ${name}`, exact: true }) });
      await expect(row).toHaveCount(1);
      const unit = page.getByRole('combobox', { name: MT.unit, exact: true });
      await unit.click();
      await page.getByRole('option', { name: 'cm', exact: true }).click(); // MTT:206-210
      await expect(unit).toHaveText('cm');
      await expect(row).toContainText(/\d cm\b/u);
      await expect(row).not.toContainText(/\d mm\b/u);

      await page.getByRole('button', { name: MT.collapse, exact: true }).click(); // MTL:208 → UMT:995-997
      // UMT:939-940 'collapsed' collapses the shell too (VS/ViewerShell.tsx:112,208-218: inspector width 0, aria-hidden),
      // so the list's own "Mở mục Phép đo, …" button (MTL:180-196) is out of reach; the re-open path is the overlay
      // chip `{countLabel}` (MTV:198-211, MTG:322,434).
      const reopen = page.getByRole('button', { name: MT.chip });
      await expect(reopen).toBeVisible();
      await expect(row).toHaveCount(0);
      await expect(page.getByRole('button', { name: MT.expandPattern })).toHaveCount(0);
      await captureEvidence(page, 'E05_measure_collapsed.png');
      await reopen.click();
      await expect(measureList(page)).toBeVisible();
      await expect(row).toHaveCount(1);
      await captureEvidence(page, 'E05_measure_unit_collapse.png');
    });
  });

  test('E05 · SCR-25 "Ẩn {name}" is local: after reload the row is visible again and still listed (GET 200)', async ({ browser }) => {
    await withAdmin(browser, async (admin) => {
      const { page, api } = admin;
      const project = await createProject(admin, 'mt-hide');
      await seedBox(admin, project, firstFloor(project), roomNameFor('mt-hide'));
      const name = `${TEST_DATA_PREFIX}do-hide`;
      const id = await seedMeasurement(admin, project, name);
      await openMeasure(page, project);

      const mark = api.length;
      await page.getByRole('button', { name: `Ẩn ${name}`, exact: true }).click(); // MTL:137 → UMT:848-858 local Set
      await expect(page.getByRole('button', { name: `Hiện ${name}`, exact: true })).toBeVisible();
      await quiet(page);
      expect(writesSince(api, mark), 'hiding a measurement writes nothing').toEqual([]);

      await openMeasure(page, project); // reload
      await expect(page.getByRole('button', { name: `Ẩn ${name}`, exact: true })).toBeVisible();
      await expect(page.getByRole('button', { name: `Hiện ${name}`, exact: true })).toHaveCount(0);
      await captureEvidence(page, 'E05_measure_hidden_reload.png');
      await attachJson('E05_measure_hidden_reload.json', { measurementId: id, writesWhileHiding: writesSince(api, mark) });
    });
  });

  test('E05 · SCR-25 deleted elsewhere → "Xoá {name}" → DELETE 404 → toast "Phép đo này đã bị xoá ở nơi khác", row gone', async ({ browser }) => {
    await withAdmin(browser, async (admin) => {
      const { page } = admin;
      const project = await createProject(admin, 'mt-gone');
      await seedBox(admin, project, firstFloor(project), roomNameFor('mt-gone'));
      const name = `${TEST_DATA_PREFIX}do-gone`;
      const id = await seedMeasurement(admin, project, name);
      await openMeasure(page, project);
      await expect(page.getByRole('button', { name: `Xoá ${name}`, exact: true })).toBeVisible();

      const elsewhere = await admin.context.request.delete(`${PROJECTS_API}/${project.id}/measurements/${id}`, { headers: bearer(admin) });
      expect(elsewhere.status(), 'DELETE from "another session" (#18)').toBe(204);

      const gone = waitForApi(page, 'DELETE', measurementRe(project.id), [404]);
      await page.getByRole('button', { name: `Xoá ${name}`, exact: true }).click(); // MTL:154
      const { json } = await gone; // BE:apps/api/measurements/service.py:141-154 NOT_FOUND resource measurement
      await expect(page.getByText(MT.deleteGone, { exact: true })).toBeVisible(); // UMT:826-836
      await expect(page.getByRole('button', { name: `Ẩn ${name}`, exact: true })).toHaveCount(0); // UMT:842-844 invalidate
      await captureEvidence(page, 'E05_measure_deleted_elsewhere.png');
      await attachJson('E05_measure_deleted_elsewhere.json', { measurementId: id, apiDelete: 204, uiDelete: 404, body: json });
    });
  });

  test('E05 · SCR-25 Delete key on the hovered row → DELETE 204; after the 8 s undo window a reload still has no row', async ({ browser }) => {
    test.setTimeout(HEAVY_TEST_TIMEOUT_MS);
    await withAdmin(browser, async (admin) => {
      const { page, api } = admin;
      const project = await createProject(admin, 'mt-delkey');
      await seedBox(admin, project, firstFloor(project), roomNameFor('mt-delkey'));
      const name = `${TEST_DATA_PREFIX}do-delkey`;
      const id = await seedMeasurement(admin, project, name);
      await openMeasure(page, project);
      const row = measureList(page).getByRole('listitem').filter({ has: page.getByRole('button', { name: `Ẩn ${name}`, exact: true }) });

      await row.hover(); // MTL:110-115 onMouseEnter → highlightedId
      const removed = waitForApi(page, 'DELETE', measurementRe(project.id), [204]);
      await page.keyboard.press('Delete'); // UMT:170,915-925
      await removed;
      await expect(row).toHaveCount(0);
      const undo = page.getByRole('button', { name: MT.undo, exact: true });
      await expect(undo).toBeVisible();
      await page.mouse.move(5, 5); // hovering the toast pauses its timer (G5)
      await expect(undo).toHaveCount(0, { timeout: UNDO_WINDOW_MS + 7_000 });

      const mark = api.length;
      const reread = navigateThenWaitForApi(page, () => page.goto(ROUTES.project.measure(project.id), { waitUntil: 'commit' }), 'GET', measurementsRe(project.id), [200]);
      const { json } = await reread;
      const ids = Array.isArray(json) ? json.map((record) => asRecord(record, 'measurement').id) : [];
      expect(ids, 'GET measurements after the undo window').not.toContain(id);
      await dismissTour(page);
      await expect(page.getByRole('button', { name: `Ẩn ${name}`, exact: true })).toHaveCount(0);
      expect(api.slice(mark).filter((entry) => entry.method === 'POST' && measurementsRe(project.id).test(entry.path))).toEqual([]);
      await captureEvidence(page, 'E05_measure_delete_key.png');
      await attachJson('E05_measure_delete_key.json', { measurementId: id, idsAfterReload: ids });
    });
  });

  test('E05 · SCR-25 four modes in "Chọn chế độ đo"; "Bật tắt công cụ đo (phím M)" toggles the rail tool', async ({ browser }) => {
    await withAdmin(browser, async (admin) => {
      const { page } = admin;
      const project = await createProject(admin, 'mt-modes');
      await seedBox(admin, project, firstFloor(project), roomNameFor('mt-modes'));
      await openMeasure(page, project);
      const modes = page.getByRole('radiogroup', { name: MT.modes, exact: true });
      await expect(modes.getByRole('radio')).toHaveCount(4); // MTV:76-79
      for (const label of MT.modeLabels) {
        await modes.getByRole('radio', { name: label, exact: true }).click();
        await expect(modes.getByRole('radio', { name: label, exact: true }), label).toHaveAttribute('aria-checked', 'true');
      }

      const railTool = toolRail(page).getByRole('button', { name: MT.railTool, exact: true });
      const idle = toolRail(page).getByRole('button', { name: MT.railIdle, exact: true });
      await expect(railTool).toHaveAttribute('aria-pressed', 'false'); // UVS:460 shell starts on orbit
      await page.getByRole('button', { name: MT.toggleTool, exact: true }).click(); // UMT:781-784
      await expect(railTool).toHaveAttribute('aria-pressed', 'true');
      await captureEvidence(page, 'E05_measure_modes_toggle.png');
      await page.getByRole('button', { name: MT.toggleTool, exact: true }).click();
      await expect(railTool).toHaveAttribute('aria-pressed', 'false');
      await expect(idle).toHaveAttribute('aria-pressed', 'true'); // UMT:186 IDLE_SHELL_TOOL_ID orbit
    });
  });

  test('E05 · SCR-25 [mocked response] GET measurements 500 → "Chưa tải được danh sách phép đo…" + "Thử lại" refetches', async ({ browser }) => {
    test.setTimeout(HEAVY_TEST_TIMEOUT_MS);
    await withAdmin(browser, async (admin) => {
      const { page } = admin;
      const project = await createProject(admin, 'mt-500');
      await seedBox(admin, project, firstFloor(project), roomNameFor('mt-500'));
      const name = `${TEST_DATA_PREFIX}do-500`;
      await seedMeasurement(admin, project, name);
      const matcher = measurementsRe(project.id);
      let served = 0;
      const handler = async (route: Route): Promise<void> => {
        if (route.request().method() !== 'GET' || !matcher.test(new URL(route.request().url()).pathname)) {
          await route.fallback();
          return;
        }
        served += 1;
        await route.fulfill({ status: 500, contentType: 'application/json', body: JSON.stringify({ detail: 'qa-e05 mocked 500' }) });
      };
      await page.route('**/api/projects/**', handler);
      await page.goto(ROUTES.project.measure(project.id));
      await dismissTour(page);
      // UMT:936-937 rowsQuery.isError → 'error'; UMT:310-323 LOAD_ERROR; MTV:226-233 alert + "Thử lại".
      const alert = page.getByRole('alert').filter({ hasText: MT.loadError });
      await expect(alert).toBeVisible({ timeout: ERROR_PAINT_TIMEOUT_MS });
      await expect(viewport(page)).toBeVisible(); // never blank (A11)
      await captureEvidence(page, 'E05_measure_list_500.png');

      await page.unroute('**/api/projects/**', handler);
      const refetch = waitForApi(page, 'GET', matcher, [200]);
      await alert.getByRole('button', { name: MT.retry, exact: true }).click(); // UMT:886-890 refetch
      await refetch;
      await expect(alert).toHaveCount(0);
      await expect(page.getByRole('button', { name: `Ẩn ${name}`, exact: true })).toBeVisible();
      await captureEvidence(page, 'E05_measure_list_retry.png');
      await attachJson('E05_measure_list_500.json', { mockedListResponses: served, afterRetry: 200 });
    });
  });
});

/* ================================================================= SCR-26 Pascal Viewer */

async function openPascal(page: Page, project: ProjectRef): Promise<void> {
  await openSpatialRoute(page, ROUTES.project.viewerPascal(project.id), project);
}

const pascalFrame = (page: Page): Locator => page.getByRole('region', { name: PV.frame, exact: true });

test.describe('E05 SCR-26 Pascal Viewer', () => {
  test('E05 · SCR-26 floor without geometry → "Chưa có gì để dựng" + "Bản vẽ chưa có đối tượng nào để dựng."', async ({ browser }) => {
    await withAdmin(browser, async (admin) => {
      const { page } = admin;
      const project = await createProject(admin, 'pv-empty');
      await openPascal(page, project);
      // UPV:248-253 isEmpty (no wall, room, opening, furniture) → 'empty'; PVV:61-71.
      await expect(page.getByRole('heading', { name: PV.emptyTitle, exact: true })).toBeVisible({ timeout: PASCAL_RENDER_TIMEOUT_MS });
      await expect(pascalFrame(page)).toContainText(PV.emptyCaption);
      await expect(page.getByTestId('pascal-canvas')).toHaveCount(0);
      await captureEvidence(page, 'E05_pascal_empty.png');
    });
  });

  test('E05 · SCR-26 summary Tầng 1 / Tường 4 / Ô mở 0 / Phòng 1; Esc → "Mở khung xem" button re-opens', async ({ browser }) => {
    test.setTimeout(HEAVY_TEST_TIMEOUT_MS);
    await withAdmin(browser, async (admin) => {
      const { page } = admin;
      const project = await createProject(admin, 'pv-summary');
      await seedBox(admin, project, firstFloor(project), roomNameFor('pv-summary'));
      await openPascal(page, project);
      const caption = page.getByRole('status').filter({ hasText: PV.rendered });
      await expect(caption).toHaveText(PV.rendered, { timeout: PASCAL_RENDER_TIMEOUT_MS });
      // UPV:422-430 summary from the graph; PVV:165-183.
      const summary = pascalFrame(page).locator('dl');
      const valueOf = (term: string): Locator => summary.locator('div').filter({ has: page.locator('dt', { hasText: new RegExp(`^${term}$`, 'u') }) }).locator('dd');
      await expect(valueOf('Tầng')).toHaveText('1');
      await expect(valueOf('Tường')).toHaveText('4');
      await expect(valueOf('Ô mở')).toHaveText('0');
      await expect(valueOf('Phòng')).toHaveText('1');
      await captureEvidence(page, 'E05_pascal_summary.png');

      await page.keyboard.press('Escape'); // UPV:360-367
      const expand = page.getByRole('button', { name: PV.expand, exact: true });
      await expect(page.getByRole('heading', { name: PV.collapsedTitle, exact: true })).toBeVisible();
      await expand.click(); // PVV:125 onExpand (UPV:337-340)
      await expect(page.getByTestId('pascal-canvas')).toBeVisible();
      await expect(caption).toHaveText(PV.rendered, { timeout: PASCAL_RENDER_TIMEOUT_MS });
      await captureEvidence(page, 'E05_pascal_summary_collapse.png');
    });
  });

  test('E05 · SCR-26 [mocked response] pascal-mount.js network loss → "Không nạp được khung dựng hình" PASCAL-01; R retries', async ({ browser }) => {
    test.setTimeout(HEAVY_TEST_TIMEOUT_MS);
    await withAdmin(browser, async (admin) => {
      const { page } = admin;
      const project = await createProject(admin, 'pv-mount');
      await seedBox(admin, project, firstFloor(project), roomNameFor('pv-mount'));
      const aborted: string[] = [];
      const handler = async (route: Route): Promise<void> => {
        aborted.push(new URL(route.request().url()).search);
        await route.abort('internetdisconnected');
      };
      await page.route(`**${PV.mountPath}*`, handler);
      await openPascal(page, project);
      // UPV:165-176 script error → reject; UPV:327-329 PASCAL-01; PVV:101-115.
      await expect(page.getByRole('heading', { name: PV.errorTitle, exact: true })).toBeVisible({ timeout: PASCAL_RENDER_TIMEOUT_MS });
      await expect(pascalFrame(page)).toContainText('PASCAL-01');
      await expect(page.getByRole('button', { name: PV.retry, exact: true })).toBeVisible();
      await captureEvidence(page, 'E05_pascal_mount_failed.png');

      await page.unroute(`**${PV.mountPath}*`, handler);
      await page.keyboard.press('r'); // UPV:370-378 R only while failing
      await expect(page.getByTestId('pascal-canvas')).toBeVisible({ timeout: PASCAL_RENDER_TIMEOUT_MS });
      await expect(page.getByRole('status').filter({ hasText: PV.rendered })).toHaveText(PV.rendered, { timeout: PASCAL_RENDER_TIMEOUT_MS });
      await captureEvidence(page, 'E05_pascal_mount_retry.png');
      await attachJson('E05_pascal_mount_failed.json', { abortedMountRequests: aborted.length, queries: aborted });
    });
  });

  test('E05 · SCR-26 [mocked response] flag "scene.pascal-viewer" off → "Chưa bật cho tài khoản này", no mount script', async ({ browser }) => {
    await withAdmin(browser, async (admin) => {
      const { page } = admin;
      const project = await createProject(admin, 'pv-flag');
      await seedBox(admin, project, firstFloor(project), roomNameFor('pv-flag'));
      const handler = async (route: Route): Promise<void> => {
        const response = await route.fetch();
        const json = asRecord(await response.json(), 'GET /api/feature-flags');
        await route.fulfill({ response, json: { ...json, [PV.flagKey]: false } });
      };
      await page.route('**/api/feature-flags', handler);
      const mountRequests: string[] = [];
      page.on('request', (request) => {
        if (new URL(request.url()).pathname === PV.mountPath) mountRequests.push(request.url());
      });
      await openPascal(page, project);
      // UPV:216,407 !enabled → 'forbidden'; PVV:49-59; PVT:96.
      await expect(page.getByRole('heading', { name: PV.forbiddenTitle, exact: true })).toBeVisible({ timeout: PASCAL_RENDER_TIMEOUT_MS });
      await expect(pascalFrame(page)).toContainText(PV.forbiddenCaption);
      await quiet(page);
      expect(mountRequests, 'flag off: the mount script is never requested (UPV:267,290)').toEqual([]);
      await captureEvidence(page, 'E05_pascal_flag_off.png');
      await attachJson('E05_pascal_flag_off.json', { mountRequests });
    });
  });
});

/* ================================================================= SCR-27 Mobile Viewer */

const mobileRegion = (page: Page): Locator => page.getByRole('region', { name: MV.region, exact: true });
const mobileTool = (page: Page, label: string): Locator =>
  page.getByRole('navigation', { name: MV.tools, exact: true }).getByRole('button', { name: label, exact: true });

test.describe('E05 SCR-27 Mobile Viewer', () => {
  test('E05 · SCR-27 unknown project id at 375 px → "Không tìm thấy dự án này"', async ({ browser }) => {
    await withAdmin(
      browser,
      async (admin) => {
        const { page } = admin;
        const projectId = `prj_qa-e05-${uniq()}`;
        const notFound = waitForApi(page, 'GET', /^\/api\/projects\/[^/]+(\/spatial)?$/u, [404]);
        await page.goto(ROUTES.mobileViewer(projectId));
        await notFound;
        const alert = page.getByRole('alert').filter({ hasText: GATE.notFoundTitle }); // MobileViewer.container.tsx:147, PSG:73-75
        await expect(alert).toBeVisible();
        await expect(alert.getByRole('button', { name: GATE.backToProjects, exact: true })).toBeVisible();
        await expect(mobileRegion(page)).toHaveCount(0);
        await captureEvidence(page, 'E05_mobile_unknown_project.png');
      },
      { viewport: PHONE, mobile: true },
    );
  });

  test('E05 · SCR-27 floor without geometry → "Chưa có mô hình để xem"', async ({ browser }) => {
    await withAdmin(
      browser,
      async (admin) => {
        const { page } = admin;
        const project = await createProject(admin, 'mv-empty');
        await openSpatialRoute(page, ROUTES.mobileViewer(project.id), project);
        await expect(mobileRegion(page)).toBeVisible({ timeout: SCENE_TIMEOUT_MS });
        // useMobileViewer.ts:698-699 !hasGeometry → 'empty'; MVV:105-114.
        const title = page.getByRole('heading', { name: MV.emptyTitle, exact: true });
        await expect(title).toBeVisible({ timeout: SCENE_TIMEOUT_MS });
        await captureEvidence(page, 'E05_mobile_empty.png');
        // MVV:236 `<main className="relative min-h-0 flex-1">` is the model area between the top bar and the bottom bar:
        // the state layer must actually be on screen, not clipped to a zero-height area.
        const area = await mobileRegion(page).locator('main').boundingBox();
        await attachJson('E05_mobile_empty.json', { modelAreaHeightPx: area?.height ?? null, viewportHeightPx: PHONE.height });
        expect(area?.height ?? 0, 'model area of the mobile viewer has a usable height').toBeGreaterThan(PHONE.height / 3);
        await expect(title).toBeInViewport({ ratio: 1 });
      },
      { viewport: PHONE, mobile: true },
    );
  });

  test('E05 · SCR-27 walls without room → partial note + "Chưa có phòng"; "Đo" sheet empty text; second tap and Esc close panels', async ({ browser }) => {
    await withAdmin(
      browser,
      async (admin) => {
        const { page } = admin;
        const project = await createProject(admin, 'mv-partial');
        await seedBox(admin, project, firstFloor(project), null);
        await openSpatialRoute(page, ROUTES.mobileViewer(project.id), project);
        await expect(mobileRegion(page)).toBeVisible({ timeout: SCENE_TIMEOUT_MS });
        // useMobileViewer.ts:675-681,701-702 data.isPartial → 'missing-rooms'; MVV:138-145.
        await expect(page.getByText(MV.partialRooms, { exact: true })).toBeVisible({ timeout: SCENE_TIMEOUT_MS });

        await mobileTool(page, MV.floors).click();
        const floorsPanel = page.getByRole('group', { name: MV.floors, exact: true });
        await expect(floorsPanel.getByText(MV.noRoomsBadge, { exact: true })).toBeVisible(); // MVB:150
        await mobileTool(page, MV.floors).click(); // MVB:205-207 same tool → null
        await expect(mobileTool(page, MV.floors)).toHaveAttribute('aria-pressed', 'false');
        await expect(floorsPanel).toHaveCount(0);

        await mobileTool(page, MV.measure).click();
        const measurePanel = page.getByRole('group', { name: MV.measure, exact: true });
        await expect(measurePanel.getByText(MV.measureEmpty, { exact: true })).toBeVisible(); // MVB:174-177 (local list, useMobileViewer.ts:409)
        await captureEvidence(page, 'E05_mobile_partial_panels.png');
        await page.keyboard.press('Escape'); // MVV:187-203 Esc closes the open tool
        await expect(measurePanel).toHaveCount(0);
        await expect(mobileTool(page, MV.measure)).toHaveAttribute('aria-pressed', 'false');
      },
      { viewport: PHONE, mobile: true },
    );
  });

  test('E05 · SCR-27 320 px compact: three tools, "Chế độ xem" row inside "Tầng" keeps that sheet; info sheet expand / close', async ({ browser }) => {
    await withAdmin(
      browser,
      async (admin) => {
        const { page } = admin;
        const project = await createProject(admin, 'mv-compact');
        await seedBox(admin, project, firstFloor(project), roomNameFor('mv-compact'));
        await openSpatialRoute(page, ROUTES.mobileViewer(project.id), project);
        await expect(mobileRegion(page)).toBeVisible({ timeout: SCENE_TIMEOUT_MS });
        const nav = page.getByRole('navigation', { name: MV.tools, exact: true });
        // mobileViewerTypes.ts MOBILE_VIEWER_TOOLS_COMPACT: floors, measure, info (MVB:125).
        await expect(nav.getByRole('button')).toHaveCount(3);
        await expect(mobileTool(page, MV.view)).toHaveCount(0);

        await mobileTool(page, MV.floors).click();
        const floorsPanel = page.getByRole('group', { name: MV.floors, exact: true });
        const viewRow = floorsPanel.getByRole('button', { name: MV.view, exact: true }); // MVB:158-167
        await expect(viewRow).toHaveAttribute('aria-pressed', 'false');
        await viewRow.click();
        // useMobileViewer.ts:648-653 at compact width `view` is folded into `floors`: the row keeps the floor sheet open.
        await expect(floorsPanel).toBeVisible();
        await expect(viewRow).toHaveAttribute('aria-pressed', 'false');
        await expect(mobileTool(page, MV.floors)).toHaveAttribute('aria-pressed', 'true');
        await captureEvidence(page, 'E05_mobile_compact.png');

        await mobileTool(page, MV.info).click();
        const sheet = page.getByRole('dialog', { name: MV.infoSheet, exact: true });
        await expect(sheet).toBeVisible();
        await expect(sheet).toContainText(MV.infoEmpty); // MVI:248-251
        await expect(sheet.getByRole('button', { name: MV.expandSheet, exact: true }), 'sheet header on screen').toBeInViewport();
        await sheet.getByRole('button', { name: MV.expandSheet, exact: true }).click(); // MVI:227-235
        await expect(sheet.getByRole('button', { name: MV.shrinkSheet, exact: true })).toBeVisible();
        await captureEvidence(page, 'E05_mobile_info_sheet.png');
        await sheet.getByRole('button', { name: MV.closeSheet, exact: true }).click(); // MVI:238 → MVV:174-180 dismissSheet
        await expect(sheet).toHaveCount(0);
        await expect(mobileTool(page, MV.info)).toHaveAttribute('aria-pressed', 'false');
      },
      { viewport: COMPACT_PHONE, mobile: true },
    );
  });
});
