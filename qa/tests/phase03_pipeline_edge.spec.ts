/**
 * Phase 3 — EDGE CASES, Track A (admin): SCR-08 project settings, SCR-09 floor manager, SCR-10 floor upload,
 * SCR-11 input quality gate, SCR-12 processing, SCR-13 pipeline graph, SCR-15 CAD branch confirm. Gaps left by
 * `phase03_pipeline.spec.ts` (serial, CP-2 → CP-5); inventory in `qa/coverage/phase03.md` (FE stamp dbdc0d1c).
 *
 * Every expected result cites the FE source @ 8dce4ba8 (QA-03; re-mapped from dbdc0d1c) or, written `BE:`, AppBack (`apps/api/…`).
 *   PS  src/screens/project/ProjectSettings/ProjectSettings.tsx   UPS useProjectSettings.ts   UPM useProjectMembers.ts
 *   GT  …/ProjectSettings/GeneralTab.tsx  UT …/UnitsTab.tsx  MT …/MembersTab.tsx  AMF …/AddMemberForm.tsx
 *   DZ  …/ProjectSettings/DangerZoneTab.tsx  RD …/ProjectSettingsReloadDialog.tsx  MRD …/MemberRemoveDialog.tsx
 *   SE  …/ProjectSettings/settingsErrors.ts  PSG …/projectSettingsGateway.ts  NF src/hooks/useNumericField.ts
 *   FM  src/screens/qc/FloorManager/FloorManager.tsx  FT …/FloorTable.tsx  FTR …/FloorTableRow.tsx
 *   FSC …/FloorSectionCut.tsx  UFM …/useFloorManager.ts  FMG …/floorManagerGateway.ts  FMC …/FloorManager.container.tsx
 *   FU  src/screens/upload/FloorUploadScreen/FloorUploadScreen.tsx  FUC …/FloorUploadCard.tsx  FUD …/FloorUploadDropZone.tsx
 *   FUT …/FloorUploadTray.tsx  FUF …/FloorUploadFooter.tsx  UFU …/useFloorUploadScreen.ts  FUG …/floorUploadGateway.ts
 *   VAL src/lib/upload/validate.ts
 *   IQ  src/screens/upload/InputQualityGate/InputQualityGate.tsx  IQF …/InputQualityGateFooter.tsx  UIQ …/useInputQualityGate.ts
 *   PR  src/screens/pipeline/ProcessingScreen/ProcessingScreen.tsx  UPR …/useProcessingScreen.ts  PLP …/ProcessingLogPanel.tsx
 *   PSU …/ProcessingSummary.tsx  PRG …/processingGateway.ts
 *   PG  src/screens/pipeline/PipelineGraph/PipelineGraph.tsx  PGT …/pipelineGraphText.ts  PGG …/pipelineGraphGateway.ts
 *   CB  src/screens/pipeline/CadBranchConfirm/CadBranchConfirm.tsx  CBD …/CadBranchConfirmDialog.tsx
 *   UCB …/useCadBranchConfirm.ts  CBT …/cadBranchConfirmText.ts
 *   PSGATE src/components/feedback/ProjectSpatialGate.tsx  TST src/components/feedback/Toast.tsx
 *   NH  src/components/feedback/NotificationHost.tsx  I18N src/i18n/vi.json (`errors.*`)
 *
 * ## Non-serial
 * Every test opens its OWN browser context from the stored admin session (`ADMIN_STORAGE_STATE_FILE`, refreshed by
 * `ensureAdminSession`; a dead session costs one UI sign-in), creates its OWN project through the real API
 * (`POST /api/projects`, name `qa-<runId>-e03-…`, floors given in the body) and deletes it in `finally`. Nothing reads
 * the Phase 3 checkpoints (CP-2…CP-5): CP-2, its floors and its drawing are never touched. "Unknown project" cases use
 * a run-unique id that is not a `prj_<ULID>` (BE:apps/api/projects/access.py:28-33 → 404 without a DB read).
 *
 * ## Mocks — "[mocked response]" in the title (1 of 50)
 * - `GET /api/projects/:id/floors` 500 (SCR-09) — unpairable: 5xx is not producible on the shared stack. Needs its
 *   "unpairable" row in `coverage/phase03-be.md` (BE agent).
 * Everything else is the real stack: the 404s, the 409 settings conflict (a real API write in between), the 422s
 * (bidi name/notes BE:projects/schemas.py:33-43, project_settings/schemas.py:24-31; MEMBER_USER_UNAVAILABLE /
 * MEMBER_LAST_EDITOR BE:project_members/service.py:32-52; CAD_NOT_SUPPORTED BE:drawings/uploads.py:101-109).
 *
 * ## Writes on the real stack (own `qa-<runId>-e03-…` projects only)
 * Projects created/deleted, their floors added/renamed/deleted/re-created, their settings PUT, two real PNG uploads
 * (`E2E_DRAWING_PNG`, each starts one fake-ML pipeline run), one refused `.dwg` upload init, one refused member add,
 * one refused self-removal. No mail, no invitation, no admin account change.
 *
 * ## Real-backend budget per run (BE defaults; QA stack override `qa-limits.override.yml`)
 * - `POST /api/auth/login` (120 / 60 s per IP on the QA stack): 0 when the stored session is alive; 1 UI sign-in when it
 *   is dead; Playwright restarts the worker after a failed test, still 0 (the session file is rewritten after every
 *   test). No failed login.
 * - `POST /api/auth/refresh` (300 / 60 s): 2 per test (session check + fixture token) + 1 per page load ≈ 4–6 per test.
 * - `POST /api/projects`: 44 (one per test except the 6 unknown-project cases), every one deleted in `finally`; no
 *   rate limit on that route (BE:apps/api/projects/router.py:54).
 * - `POST /api/projects/:id/members` (`members_add` 60 / 3600 s per actor, BE:project_members/router.py:26-30): 1.
 * - `POST …/floors/:fid/drawings/uploads` (`drawings_init` 60 per window per user, BE:drawings/router.py:39-46): 3.
 * - `PUT /api/projects/:id/settings`: ~8 (UI autosave) + 1 (API, conflict test). No limit.
 */
import { closeSync, existsSync, ftruncateSync, openSync, rmSync, writeFileSync } from 'node:fs';

import { expect, test } from '@playwright/test';
import type { Browser, BrowserContext, Locator, Page, Route } from '@playwright/test';

import { ROUTES } from '../../e2e/fixtures/routes';
import { waitForApi, watchApi } from '../../e2e/fullstack/apiWatch';
import type { ApiEntry } from '../../e2e/fullstack/apiWatch';
import { PIPELINE_TIMEOUT_MS, readBaseUrl } from '../../e2e/fullstack/env';
import { ensureAdminSession, readAdminCredentials } from './support/auth';
import { TEST_DATA_PREFIX, attachJson, captureEvidence, testEmail } from './support/evidence';
import { ADMIN_STORAGE_STATE_FILE } from './support/state';

/* ---------------------------------------------------------------- constants (each cites its source) */

const DESKTOP = { width: 1440, height: 900 } as const;
const COMPACT = { width: 375, height: 812 } as const;
type Viewport = { readonly width: number; readonly height: number };

/** Autosave fires 800 ms after the last edit (UPS:16, `createAutosave`); a "nothing was sent" claim waits past it. */
const QUIET_MS = 2_500;
const FLOOR_HEIGHT_MM = 3_000;
const REFRESH_API = '/api/auth/refresh';
const PROJECTS_API = '/api/projects';
/** `src/lib/upload/validate.ts:47` — 100 MiB. */
const MAX_UPLOAD_FILE_SIZE_BYTES = 100 * 1024 * 1024;

/* SCR-08 copy. */
const SETTINGS_TABS = 'Nhóm cài đặt'; // PS:52
const NAME_LABEL = 'Tên dự án'; // GT:40
const CODE_LABEL = 'Mã dự án'; // GT:48
const ADDRESS_LABEL = 'Địa chỉ'; // GT:57
const NOTES_LABEL = 'Ghi chú'; // GT:82
const SNAP_LABEL = 'Dung sai bắt điểm'; // UT:59
const NAME_EMPTY = 'Chưa nhập tên dự án.'; // UPS:423
const NAME_TOO_SHORT = 'Tên dự án cần ít nhất 3 ký tự.'; // UPS:424-425 (PROJECT_LIMITS.nameMinLength 3)
const EMPTY_BLOCKED = 'Bản này chưa xoá trống được.'; // SE:113, UPS:433-446
const NOTES_TOO_LONG = 'Ghi chú không quá 500 ký tự.'; // UPS:451-452, PSG:191
const FIELD_REJECTED = 'Máy chủ không nhận giá trị này. Kiểm tra lại ô này.'; // SE:111, UPS:943
const SAVE_FAILURE_TITLE = 'Chưa lưu hết'; // PS:98
const CONFLICT_TITLE = 'Cài đặt đã đổi ở nơi khác'; // PS:91
const CONFLICT_SENTENCE = 'Cài đặt dự án vừa được đổi ở nơi khác. Tải lại để xem bản mới nhất.'; // SE:110
const RELOAD_DIALOG = 'Tải lại sẽ bỏ thay đổi chưa lưu'; // RD:20
const SAVED_TOAST = 'Đã lưu cài đặt dự án.'; // UPS:606
const UNDO = 'Hoàn tác'; // TST:149
const LOAD_ERROR_SETTINGS = 'Không tải được cài đặt dự án'; // PS:104
const BACK_TO_PROJECTS = 'Về danh sách dự án'; // PSGATE:39
const NOT_FOUND_TITLE = 'Không tìm thấy dự án này'; // PSGATE:36
const NOT_FOUND_SENTENCE = 'Dự án có thể đã bị xoá, đường dẫn chưa đúng, hoặc bạn chưa được thêm vào dự án.'; // PSGATE:37-38
const GENERIC_NOT_FOUND = 'Nội dung này có thể đã bị xoá, hoặc đường dẫn chưa đúng.'; // I18N errors.notFound.description
const MEMBER = {
  email: 'Email người cần thêm', // AMF:29
  add: 'Thêm thành viên', // AMF:45
  required: 'Chưa nhập địa chỉ email.', // UPM:30
  already: 'Người này đã là thành viên.', // UPM:31
  unavailable: 'Không thêm được: địa chỉ này chưa có tài khoản đang hoạt động.', // UPM:32
  lastEditor: 'Không gỡ được: dự án cần ít nhất một người sửa được cài đặt.', // UPM:35
  keep: 'Để nguyên', // UPM:38
  remove: 'Gỡ', // UPM:39
  selfMessage: 'Bạn sẽ mất quyền xem dự án này. Muốn quay lại phải nhờ người khác thêm lại.', // UPM:269
} as const;
const DANGER = {
  deleteProjectTitle: 'Xoá dự án này?', // UPS:522
  deleteProject: 'Xoá dự án', // UPS:534, DZ:90
  typeName: 'Gõ lại tên dự án để xác nhận', // PS:163
  keep: 'Để nguyên', // PS:174
  deletedNotice: 'Đã xoá dự án.', // UPS:256
  deleteFloorsTitle: 'Xoá mọi tầng của dự án?', // UPS:521
  deleteFloors: 'Xoá mọi tầng', // UPS:533, DZ:68
  noFloorsTitle: 'Chưa có tầng nào', // DZ:74 (EmptyState title)
} as const;

/* SCR-09 copy. */
const SECTION_REGION = 'Lát cắt các tầng theo đúng tỷ lệ chiều cao'; // FSC:41
const AUTO_ELEVATION = 'Tự động tính cao độ'; // FT:82
const RENAME_REFUSED = 'Chưa đổi được tên tầng'; // UFM:188
const RENAME_REASONS = {
  empty: 'Tên tầng không được để trống.', // FMG:829
  tooLong: 'Tên tầng dài quá 120 ký tự, hãy rút gọn lại.', // FMG:830
  bidi: 'Tên tầng có ký tự điều khiển hoặc ký tự đảo chiều chữ, hãy xoá chúng đi.', // FMG:831-832
} as const;
const FLOOR_LIST_ERROR = 'Không đọc được danh sách tầng'; // FT:77
const FLOOR_EMPTY_NOTICE = 'Thêm tầng đầu tiên, hoặc nhập số tầng từ màn hình tạo dự án.'; // UFM:178

/* SCR-10 copy. */
const DROPZONE = 'floor-upload-dropzone'; // FUD:30
const FILE_INPUT = 'floor-upload-file-input'; // FUD:33
const BLOCK_NOTICE = 'floor-upload-block-notice'; // FUF:22
const COUNTER = 'floor-upload-counter-number'; // FUF:25
const TRAY = 'Tệp chưa gán tầng'; // UFU:103, FUT:35
const ASSIGN = 'Gán cho tầng khác'; // FUT:20, FUC:39
const SUBMIT = 'Bắt đầu xử lý'; // UFU:112
const ATTACHED = 'Đã gắn kèm'; // UFU:123
const WAITING = 'Chờ xử lý'; // UFU:121 — a floor holding a file that is not uploaded yet
/**
 * Card status of a floor with no drawing at all: the same words as the block notice "… chưa có bản vẽ." and the
 * FloorManager badge (BUG-263, R-src fix/qa03-ra). Was WAITING before that fix.
 */
const NO_DRAWING_STATUS = 'Chưa có bản vẽ';
const STATUS_ERROR = 'Lỗi'; // UFU:124
const CAD_PILL = 'Nhánh CAD · độ chính xác cao'; // FUC:41
const CAD_SENTENCE = 'Bản vẽ CAD (.dwg) chưa được hỗ trợ; hãy xuất sang PDF rồi tải lại.'; // FUG:85
const UPLOAD_EMPTY = 'Chưa có tầng nào có bản vẽ. Kéo thả tệp đầu tiên để bắt đầu.'; // UFU:105
const NO_FLOORS_TITLE = 'Dự án chưa có tầng nào'; // FU:74
const UPLOAD_LOAD_ERROR = 'Không tải được danh sách tầng'; // FU:68
const SELECT_FILE = 'Chọn tệp'; // UFU:100
const PICK_PAGE = 'Chọn trang'; // FUC:40
const DISMISS = 'Đóng'; // FUC:45, FUT:21

/* SCR-11 / 12 / 13 / 15 copy. */
const QUALITY = {
  noDrawingTitle: 'Chưa có bản vẽ để kiểm tra', // IQ:65
  noDrawingNotice: 'Dự án chưa có bản vẽ nào được tải lên, nên chưa có gì để đo.', // UIQ:153
  uploadAction: 'Tải bản vẽ lên', // IQ:66
  continue: 'Tiếp tục xử lý', // UIQ:145
  secondary: 'Tải bản vẽ khác', // UIQ:146
  noDrawingReason: 'Chưa có bản vẽ nào để xử lý; hãy tải bản vẽ lên trước.', // UIQ:152
} as const;
const PROCESSING = {
  nav: 'Xử lý', // PR:60
  emptyTitle: 'Chưa có bước nào để theo dõi', // PR:80
  emptyDescription: 'Khi bản vẽ được đưa vào hàng đợi, các bước xử lý sẽ hiện ở đây.', // PR:81
  emptyAction: 'Tải bản vẽ', // PR:82
  noRun: 'Chưa có lượt xử lý nào đang chạy.', // UPR:181
  background: 'Để chạy nền và thông báo cho tôi', // PR:64
  cancel: 'Huỷ xử lý', // PR:65
  retry: 'Thử lại', // PR:72
  support: 'Liên hệ hỗ trợ', // PR:71
  copyLog: 'Sao chép nhật ký', // PLP:29
  logEmpty: 'Chưa có dòng nhật ký nào', // PLP:30
  calibrate: 'Hiệu chỉnh tỷ lệ', // PSU:20
  tabs: 'Xem trước hoặc nhật ký', // PR:74
} as const;
const GRAPH = {
  title: 'Sơ đồ xử lý', // PGT:141
  emptyTitle: 'Chưa có lượt xử lý nào để kể lại', // PGT:208
  reasonNoReport: 'Chưa có lượt xử lý nào, nên chưa biết hồ sơ đi nhánh nào.', // PGT:159
  detail: 'Chi tiết kỹ thuật', // PGT:181
  switch: 'Đổi sang nhánh ảnh quét', // PGT:174
} as const;
const CAD = {
  dialog: 'Phát hiện tệp CAD', // CBT:30
  useCad: 'Dùng đường từ CAD', // CBT:84
  useAi: 'Vẫn dùng AI', // CBT:87
  remember: 'Ghi nhớ lựa chọn cho dự án này', // CBT:93
  handoffTitle: 'Chuyển sang nhánh nhận dạng ảnh', // CB:92
  aiNotice: 'Nếu bạn chọn nhánh AI, sẽ cần hiệu chỉnh tỷ lệ sau khi nhập hình học.', // CBT:163-164
  stageTwo: 'Ánh xạ lớp và xem trước hình học', // CB:82
  collapse: 'Thu gọn bảng lớp', // CB:95
  expand: 'Mở bảng lớp', // CB:96
} as const;

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

const uniq = (): string => `${Date.now().toString(36)}${Math.random().toString(36).slice(2, 6)}`;
const escapeRegExp = (text: string): string => text.replace(/[.*+?^${}()|[\]\\]/gu, '\\$&');
const pathOf = (page: Page): string => new URL(page.url()).pathname;
const quiet = (page: Page): Promise<void> => page.waitForTimeout(QUIET_MS);

/** Writes the page sent since `mark`, minus the session/telemetry chatter that is not the screen's own action. */
const writesSince = (log: readonly ApiEntry[], mark: number): string[] =>
  log
    .slice(mark)
    .filter((entry) => entry.method !== 'GET' && entry.path !== REFRESH_API && !entry.path.startsWith('/api/telemetry'))
    .map((entry) => `${entry.method} ${entry.path} ${String(entry.status)}`);

const countSince = (log: readonly ApiEntry[], mark: number, method: string, path: RegExp): number =>
  log.slice(mark).filter((entry) => entry.method === method && path.test(entry.path)).length;

const projectRe = (id: string): RegExp => new RegExp(`^/api/projects/${escapeRegExp(id)}$`, 'u');
const settingsRe = (id: string): RegExp => new RegExp(`^/api/projects/${escapeRegExp(id)}/settings$`, 'u');
const floorsRe = (id: string): RegExp => new RegExp(`^/api/projects/${escapeRegExp(id)}/floors$`, 'u');
const floorDeleteRe = /^\/api\/floors\/[^/]+$/u;
const spatialRe = (id: string): RegExp => new RegExp(`^/api/projects/${escapeRegExp(id)}/floors/[^/]+/spatial$`, 'u');
const reorderRe = /^\/api\/floors\/reorder$/u;
const uploadInitRe = (id: string): RegExp =>
  new RegExp(`^/api/projects/${escapeRegExp(id)}/floors/[^/]+/drawings/uploads$`, 'u');

/** Toast / notice by its text (TST:120 `role="status"`; NH:59-61 joins title — description). */
const toastWith = (page: Page, text: string): Locator => page.getByRole('status').filter({ hasText: text });

/** Page wider than the viewport = a horizontal scroll bar. */
const horizontalOverflow = (page: Page): Promise<number> =>
  page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);

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

/** Refresh body: `accessToken`/`access_token`, optional `data` wrapper (src/lib/auth/refresh.ts:85-100). */
function readAccessToken(json: unknown): string {
  const body = asRecord(json, 'POST /api/auth/refresh');
  const root = typeof body.data === 'object' && body.data !== null ? asRecord(body.data, 'refresh.data') : body;
  const token =
    typeof root.accessToken === 'string' ? root.accessToken : typeof root.access_token === 'string' ? root.access_token : '';
  if (token === '') throw new Error('POST /api/auth/refresh: no access token in the body');
  return token;
}

async function openAdmin(
  browser: Browser,
  options: { readonly viewport?: Viewport; readonly clipboard?: boolean } = {},
): Promise<Admin> {
  const context = await browser.newContext({
    baseURL: readBaseUrl(),
    viewport: options.viewport ?? DESKTOP,
    ...(existsSync(ADMIN_STORAGE_STATE_FILE) ? { storageState: ADMIN_STORAGE_STATE_FILE } : {}),
    ...(options.clipboard === true ? { permissions: ['clipboard-read', 'clipboard-write'] } : {}),
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

async function withAdmin(
  browser: Browser,
  body: (admin: Admin) => Promise<void>,
  options: { readonly viewport?: Viewport; readonly clipboard?: boolean } = {},
): Promise<void> {
  const admin = await openAdmin(browser, options);
  try {
    await body(admin);
  } finally {
    await closeAdmin(admin);
  }
}

const floorName = (index: number): string => `Tầng ${String(index + 1)}`;

/**
 * Fixture project through the real API (BE:apps/api/projects/router.py:54-63; `name` 3–80 chars, schemas.py:25-28;
 * `floors` = `FloorDraftIn` drafts, schemas.py:56-66): `floorCount` stacked 3 m floors named "Tầng 1"… Floor ids are
 * read back from `GET /api/projects/:id`, never invented.
 */
async function createProject(
  admin: Admin,
  slug: string,
  floorCount = 0,
  extra: { readonly code?: string; readonly address?: string } = {},
): Promise<ProjectRef> {
  const name = `${TEST_DATA_PREFIX}e03-${slug}-${uniq()}`;
  expect(name.length, `fixture name "${name}" fits NAME_MAX 80`).toBeLessThanOrEqual(80);
  const floors = Array.from({ length: floorCount }, (_unused, index) => ({
    name: floorName(index),
    order: index,
    elevationMm: index * FLOOR_HEIGHT_MM,
    heightMm: FLOOR_HEIGHT_MM,
  }));
  const created = await admin.context.request.post(PROJECTS_API, {
    headers: bearer(admin),
    data: { name, ...extra, ...(floorCount > 0 ? { floors } : {}) },
  });
  expect(created.status(), `fixture POST ${PROJECTS_API} "${name}"`).toBe(201);
  const id = stringField(await created.json(), 'id', 'POST /api/projects');
  admin.cleanup.push(id);

  const read = await admin.context.request.get(`${PROJECTS_API}/${id}`, { headers: bearer(admin) });
  expect(read.status(), `fixture GET ${PROJECTS_API}/${id}`).toBe(200);
  const rawFloors = asRecord(await read.json(), 'GET /api/projects/:id').floors;
  const list = (Array.isArray(rawFloors) ? rawFloors : []).map((floor, index) => {
    const record = asRecord(floor, `floors[${String(index)}]`);
    return {
      id: stringField(record, 'id', `floors[${String(index)}]`),
      name: stringField(record, 'name', `floors[${String(index)}]`),
      order: typeof record.order === 'number' ? record.order : index,
    };
  });
  list.sort((first, second) => first.order - second.order);
  expect(list.map((floor) => floor.name), 'fixture floors as created').toEqual(floors.map((floor) => floor.name));
  return { id, name, floors: list.map(({ id: floorId, name: floorLabel }) => ({ id: floorId, name: floorLabel })) };
}

function firstFloor(project: ProjectRef): FloorRef {
  const floor = project.floors[0];
  if (floor === undefined) throw new Error(`${project.name}: no floor`);
  return floor;
}

/** A run-unique project id that is not `prj_<ULID>`: BE answers 404 `project` before any DB read (access.py:28-33). */
const unknownProjectId = (): string => `prj_qa-e03-${uniq()}`;

/* ---------------------------------------------------------------- screen helpers */

async function openSettings(page: Page, project: ProjectRef): Promise<void> {
  await page.goto(ROUTES.project.settings(project.id));
  await expect(page.getByRole('textbox', { name: NAME_LABEL, exact: true })).toHaveValue(project.name);
}

const settingsTab = (page: Page, label: string): Locator =>
  page.getByRole('tablist', { name: SETTINGS_TABS, exact: true }).getByRole('tab', { name: label, exact: true });

/** `<tr aria-label="{name}, cao độ …">` (FTR:199). */
const floorRows = (page: Page): Locator => page.getByRole('row', { name: /, cao độ /u });
const floorRow = (page: Page, name: string): Locator =>
  page.getByRole('row', { name: new RegExp(`^${escapeRegExp(name)}, cao độ `, 'u') });

async function floorRowNames(page: Page): Promise<string[]> {
  const labels = await floorRows(page).evaluateAll((rows) => rows.map((row) => row.getAttribute('aria-label') ?? ''));
  return labels.map((label) => label.replace(/, cao độ .*$/su, ''));
}

async function openFloors(page: Page, project: ProjectRef): Promise<void> {
  await page.goto(ROUTES.project.floors(project.id));
  await expect(floorRows(page)).toHaveCount(project.floors.length);
}

async function openRowMenu(page: Page, name: string): Promise<void> {
  // FTR:385-394 IconButton → FT:152-184 ContextMenu.
  await page.getByRole('button', { name: `Thao tác khác cho tầng ${name}`, exact: true }).click();
}

async function openUpload(page: Page, project: ProjectRef): Promise<void> {
  await page.goto(ROUTES.project.upload(project.id));
  await expect(page.getByTestId(DROPZONE)).toBeVisible();
  for (const floor of project.floors) await expect(page.locator(`[data-floor-id="${floor.id}"]`)).toBeVisible();
}

const tray = (page: Page): Locator => page.getByRole('region', { name: TRAY, exact: true });
const card = (page: Page, floor: FloorRef): Locator => page.locator(`[data-floor-id="${floor.id}"]`);

function drawingPng(): string {
  const value = process.env.E2E_DRAWING_PNG?.trim();
  if (value === undefined || value === '' || !value.toLowerCase().endsWith('.png') || !existsSync(value)) {
    throw new Error('E2E_DRAWING_PNG is not an existing .png file (qa.config.json env.vars)');
  }
  return value;
}

const drawingName = (): string => drawingPng().replace(/^.*[\\/]/u, '');

/** Real upload through the tray (main spec SCR-10 path): file → tray → "Gán cho tầng khác" = floor → init/chunks/complete. */
async function uploadDrawingTo(page: Page, project: ProjectRef, floor: FloorRef): Promise<void> {
  const complete = waitForApi(
    page,
    'POST',
    new RegExp(`^/api/projects/${escapeRegExp(project.id)}/drawings/uploads/[^/]+/complete$`, 'u'),
    [200],
  );
  await page.getByTestId(FILE_INPUT).setInputFiles(drawingPng());
  await tray(page).getByRole('combobox', { name: ASSIGN }).click();
  await page.getByRole('option', { name: floor.name, exact: true }).click();
  await complete;
  await expect(card(page, floor).getByText(ATTACHED, { exact: true })).toBeVisible();
}

/* ================================================================= SCR-08 project settings */

test.describe('E03 SCR-08 project settings', () => {
  test('E03 · SCR-08 "Tên dự án" blank / spaces / 2 characters → field message, no PATCH; maxlength 80', async ({ browser }) => {
    await withAdmin(browser, async (admin) => {
      const { page, api } = admin;
      const project = await createProject(admin, 'name');
      await openSettings(page, project);
      const name = page.getByRole('textbox', { name: NAME_LABEL, exact: true });
      await expect(name).toHaveAttribute('maxlength', '80'); // GT:43, PSG:188

      const mark = api.length;
      for (const [typed, message] of [
        ['', NAME_EMPTY],
        ['   ', NAME_EMPTY], // trimmed (UPS:422)
        ['ab', NAME_TOO_SHORT],
      ] as const) {
        await name.fill(typed);
        await expect(page.getByText(message, { exact: true })).toBeVisible();
      }
      await quiet(page);
      // Local problems block the autosave (UPS:765-767 "Lời phàn nàn cục bộ chặn tự lưu").
      expect(countSince(api, mark, 'PATCH', projectRe(project.id)), 'no PATCH while the name is refused').toBe(0);
      await captureEvidence(page, 'E03_settings_name_bounds.png');
      await attachJson('E03_settings_name_bounds.json', { patchSinceEdit: writesSince(api, mark) });
    });
  });

  test('E03 · SCR-08 saved "Mã dự án" / "Địa chỉ" cannot be emptied; maxlength 32 / 200', async ({ browser }) => {
    await withAdmin(browser, async (admin) => {
      const { page, api } = admin;
      const project = await createProject(admin, 'code', 0, { code: 'QA-E03', address: 'qa địa chỉ e03' });
      await openSettings(page, project);
      const code = page.getByRole('textbox', { name: CODE_LABEL, exact: true });
      const address = page.getByRole('textbox', { name: ADDRESS_LABEL, exact: true });
      await expect(code).toHaveValue('QA-E03');
      await expect(address).toHaveValue('qa địa chỉ e03');
      await expect(code).toHaveAttribute('maxlength', '32'); // GT:51, PSG:189
      await expect(address).toHaveAttribute('maxlength', '200'); // GT:60, PSG:190

      const mark = api.length;
      await code.fill('');
      await address.fill('');
      // UPS:431-446: a saved value cannot be cleared (#26 refuses ""), one sentence under each field.
      await expect(page.getByText(EMPTY_BLOCKED, { exact: true })).toHaveCount(2);
      await quiet(page);
      expect(countSince(api, mark, 'PATCH', projectRe(project.id)), 'no PATCH with an emptied code/address').toBe(0);
      await captureEvidence(page, 'E03_settings_code_address_empty.png');
    });
  });

  test('E03 · SCR-08 "Ghi chú" 500 characters saves (PUT), 501 → "Ghi chú không quá 500 ký tự." and no PUT', async ({ browser }) => {
    await withAdmin(browser, async (admin) => {
      const { page, api } = admin;
      const project = await createProject(admin, 'notes');
      await openSettings(page, project);
      const notes = page.getByRole('textbox', { name: NOTES_LABEL, exact: true });

      const put = waitForApi(page, 'PUT', settingsRe(project.id), [200]);
      await notes.fill('a'.repeat(500));
      const { response } = await put;
      const body = asRecord(asRecord(response.request().postDataJSON() as unknown, 'PUT settings').body, 'PUT settings body');
      expect(typeof body.notes === 'string' ? body.notes.length : -1, 'PUT body.notes length').toBe(500);
      await expect(page.getByText('500 / 500 ký tự', { exact: true })).toBeVisible(); // UPS:1313-1315

      const mark = api.length;
      await notes.fill('a'.repeat(501));
      await expect(page.getByText(NOTES_TOO_LONG, { exact: true })).toBeVisible(); // UPS:451-452
      await quiet(page);
      expect(countSince(api, mark, 'PUT', settingsRe(project.id)), 'no PUT over 500 characters').toBe(0);
      await captureEvidence(page, 'E03_settings_notes_bounds.png');
    });
  });

  test('E03 · SCR-08 toast "Hoàn tác" after a save → a second PUT puts the previous notes back', async ({ browser }) => {
    await withAdmin(browser, async (admin) => {
      const { page } = admin;
      const project = await createProject(admin, 'undo');
      await openSettings(page, project);
      const notes = page.getByRole('textbox', { name: NOTES_LABEL, exact: true });
      await expect(notes).toHaveValue('');
      const value = `qa ghi chú ${uniq()}`;

      const first = waitForApi(page, 'PUT', settingsRe(project.id), [200]);
      await notes.fill(value);
      const firstBody = asRecord(asRecord((await first).response.request().postDataJSON() as unknown, 'PUT #1').body, 'PUT #1 body');
      expect(firstBody.notes).toBe(value);

      // UPS:1020-1039: one undo ticket per save; undo restores the previous draft and saves again.
      const second = waitForApi(page, 'PUT', settingsRe(project.id), [200]);
      await toastWith(page, SAVED_TOAST).first().getByRole('button', { name: UNDO, exact: true }).click();
      const secondBody = asRecord(asRecord((await second).response.request().postDataJSON() as unknown, 'PUT #2').body, 'PUT #2 body');
      // PSG:279-282: empty notes travel as an absent key (BE: "vắng = xoá ghi chú", project_settings/schemas.py:64-66).
      expect(secondBody.notes, 'undo PUT clears the notes again').toBeUndefined();
      await expect(notes).toHaveValue('');
      await captureEvidence(page, 'E03_settings_notes_undo.png');
      await attachJson('E03_settings_notes_undo.json', { firstPutNotes: firstBody.notes, secondPutHasNotes: 'notes' in secondBody });
    });
  });

  test('E03 · SCR-08 "Dung sai bắt điểm" 0 / 121 refused by the field, Escape restores, 120 saves', async ({ browser }) => {
    await withAdmin(browser, async (admin) => {
      const { page, api } = admin;
      const project = await createProject(admin, 'snap');
      await openSettings(page, project);
      await settingsTab(page, 'Đơn vị đo').click();
      const snap = page.getByRole('textbox', { name: SNAP_LABEL, exact: true });
      const before = await snap.inputValue();

      const mark = api.length;
      // NF:67-72 refuses outside [min, max] (UT:62-63 → PSG:192-193: 1…120 mm, snap.ts:65).
      await snap.fill('0');
      await expect(page.getByText('Giá trị không nhỏ hơn 1 mm.', { exact: true })).toBeVisible();
      await snap.fill('121');
      await expect(page.getByText('Giá trị không quá 120 mm.', { exact: true })).toBeVisible();
      await captureEvidence(page, 'E03_settings_snap_refused.png');
      await snap.press('Escape'); // NF:142-147
      await expect(page.getByText('Giá trị không quá 120 mm.', { exact: true })).toHaveCount(0);
      await expect(snap).toHaveValue(before);
      await quiet(page);
      expect(countSince(api, mark, 'PUT', settingsRe(project.id)), 'refused values send no PUT').toBe(0);

      const put = waitForApi(page, 'PUT', settingsRe(project.id), [200]);
      await snap.fill('120');
      await snap.press('Tab');
      const body = asRecord(asRecord((await put).response.request().postDataJSON() as unknown, 'PUT').body, 'PUT body');
      expect(body.snapToleranceMm, 'upper bound 120 is accepted').toBe(120);
    });
  });

  test('E03 · SCR-08 "Ghi chú" with a bidi mark → server 422 → field message + "Chưa lưu hết" (units part)', async ({ browser }) => {
    await withAdmin(browser, async (admin) => {
      const { page } = admin;
      const project = await createProject(admin, 'notesbidi');
      await openSettings(page, project);
      const put = waitForApi(page, 'PUT', settingsRe(project.id), [422]);
      // BE:project_settings/schemas.py:24-31 refuses direction marks in notes; the FE has no such local rule (UPS:449-454).
      await page.getByRole('textbox', { name: NOTES_LABEL, exact: true }).fill('qa \u202Eghi chú');
      await put;
      await expect(page.getByText(FIELD_REJECTED, { exact: true })).toBeVisible(); // SE:96, UPS:938-944
      const failure = page.getByRole('alert').filter({ hasText: SAVE_FAILURE_TITLE });
      // SE:117-140: notes belong to the "units" part (UPS:366-369), so the sentence names "đơn vị đo".
      await expect(failure).toContainText('Chưa lưu được đơn vị đo.');
      await captureEvidence(page, 'E03_settings_notes_bidi_422.png');
    });
  });

  test('E03 · SCR-08 "Tên dự án" with a bidi mark → server 422 → field message + "Chưa lưu được thông tin chung."', async ({ browser }) => {
    await withAdmin(browser, async (admin) => {
      const { page } = admin;
      const project = await createProject(admin, 'namebidi');
      await openSettings(page, project);
      const patch = waitForApi(page, 'PATCH', projectRe(project.id), [422]);
      // BE:projects/schemas.py:33-43 (clean_text, bidi_marks) → 422 field "name"; FE nameProblemFor checks length only (UPS:421-431).
      await page.getByRole('textbox', { name: NAME_LABEL, exact: true }).fill(`${project.name}\u202E`);
      await patch;
      await expect(page.getByText(FIELD_REJECTED, { exact: true })).toBeVisible();
      await expect(page.getByRole('alert').filter({ hasText: SAVE_FAILURE_TITLE })).toContainText('Chưa lưu được thông tin chung.');
      await captureEvidence(page, 'E03_settings_name_bidi_422.png');
    });
  });

  test('E03 · SCR-08 settings changed elsewhere → 409 "Cài đặt đã đổi ở nơi khác"; "Tải lại" asks first, then loads the server copy', async ({ browser }) => {
    await withAdmin(browser, async (admin) => {
      const { page } = admin;
      const project = await createProject(admin, 'conflict');
      await openSettings(page, project);

      // A real write from "elsewhere": the same N6 the screen uses (BE:project_settings/router.py:30-38).
      const read = await admin.context.request.get(`${PROJECTS_API}/${project.id}/settings`, { headers: bearer(admin) });
      expect(read.status()).toBe(200);
      const current = asRecord(await read.json(), 'GET settings');
      const apiNotes = `qa api ${uniq()}`;
      const written = await admin.context.request.put(`${PROJECTS_API}/${project.id}/settings`, {
        headers: bearer(admin),
        data: {
          baseVersion: current.revision,
          body: {
            buildingType: current.buildingType,
            lengthUnit: current.lengthUnit,
            snapToleranceMm: current.snapToleranceMm,
            confidenceThreshold: current.confidenceThreshold,
            defaultScaleMmPerPx: current.defaultScaleMmPerPx,
            notes: apiNotes,
          },
        },
      });
      expect(written.status(), 'API PUT settings (the other writer)').toBe(200);

      const notes = page.getByRole('textbox', { name: NOTES_LABEL, exact: true });
      const uiNotes = `qa ui ${uniq()}`;
      const conflict = waitForApi(page, 'PUT', settingsRe(project.id), [409]);
      await notes.fill(uiNotes);
      await conflict;
      const alert = page.getByRole('alert').filter({ hasText: CONFLICT_TITLE }); // PS:88-95
      await expect(alert).toContainText(CONFLICT_SENTENCE);
      await captureEvidence(page, 'E03_settings_conflict_409.png');

      // UPS:1360-1367: unsaved draft → A9 dialog first.
      await alert.getByRole('button', { name: 'Tải lại', exact: true }).click();
      const dialog = page.getByRole('dialog', { name: RELOAD_DIALOG, exact: true });
      await expect(dialog).toBeVisible();
      await dialog.getByRole('button', { name: 'Giữ thay đổi', exact: true }).click();
      await expect(dialog).toHaveCount(0);
      await expect(notes).toHaveValue(uiNotes);

      await alert.getByRole('button', { name: 'Tải lại', exact: true }).click();
      const refetch = waitForApi(page, 'GET', settingsRe(project.id), [200]);
      await dialog.getByRole('button', { name: 'Tải lại', exact: true }).click();
      await refetch;
      await expect(notes).toHaveValue(apiNotes);
      await expect(page.getByRole('alert').filter({ hasText: CONFLICT_TITLE })).toHaveCount(0);
    });
  });

  test('E03 · SCR-08 "Thành viên": empty email, an existing member, an address with no account → three refusals', async ({ browser }) => {
    await withAdmin(browser, async (admin) => {
      const { page, api } = admin;
      const project = await createProject(admin, 'member');
      await openSettings(page, project);
      await settingsTab(page, 'Thành viên').click();
      await expect(page.getByText('1 thành viên', { exact: true })).toBeVisible(); // UPS:1330
      const email = page.getByRole('textbox', { name: MEMBER.email, exact: true });
      const add = page.getByRole('button', { name: MEMBER.add, exact: true });
      const membersRe = new RegExp(`^/api/projects/${escapeRegExp(project.id)}/members$`, 'u');

      const mark = api.length;
      await add.click();
      await expect(page.getByText(MEMBER.required, { exact: true })).toBeVisible(); // UPM:157-161

      // PSG:456-468: the gateway reads the project first; an existing member never reaches the POST.
      await email.fill(readAdminCredentials().email.toUpperCase());
      await add.click();
      await expect(page.getByText(MEMBER.already, { exact: true })).toBeVisible();
      expect(countSince(api, mark, 'POST', membersRe), 'no POST for an existing member').toBe(0);

      const post = waitForApi(page, 'POST', membersRe, [422]);
      await email.fill(testEmail('e03-nomember'));
      await add.click();
      await post; // BE:project_members/service.py:32-39 MEMBER_USER_UNAVAILABLE
      await expect(page.getByText(MEMBER.unavailable, { exact: true })).toBeVisible(); // UPM:97-99
      await expect(page.getByText('1 thành viên', { exact: true })).toBeVisible();
      await captureEvidence(page, 'E03_settings_member_refusals.png');
      await attachJson('E03_settings_member_refusals.json', { memberPosts: writesSince(api, mark) });
    });
  });

  test('E03 · SCR-08 "Gỡ" yourself as the only editor → dialog, 422 shown inside it; Esc / "Để nguyên" close it', async ({ browser }) => {
    await withAdmin(browser, async (admin) => {
      const { page } = admin;
      const project = await createProject(admin, 'selfrm');
      const read = await admin.context.request.get(`${PROJECTS_API}/${project.id}`, { headers: bearer(admin) });
      const members = asRecord(await read.json(), 'GET project').members;
      const self = Array.isArray(members) ? asRecord(members[0], 'members[0]') : {};
      const selfName = typeof self.name === 'string' ? self.name : '';
      expect(selfName, 'creator is the only member').not.toBe('');

      await openSettings(page, project);
      await settingsTab(page, 'Thành viên').click();
      const removeSelf = page.getByRole('button', { name: `Gỡ ${selfName}`, exact: true }); // UPS:1271, MT:69
      const dialog = page.getByRole('dialog', { name: `Gỡ ${selfName} khỏi dự án?`, exact: true }); // UPM:266

      await removeSelf.click();
      await expect(dialog).toContainText(MEMBER.selfMessage); // UPM:268-270 (isSelf)
      await page.keyboard.press('Escape'); // MRD:21 onClose → cancelRemoveMember
      await expect(dialog).toHaveCount(0);

      await removeSelf.click();
      const del = waitForApi(page, 'DELETE', new RegExp(`^/api/projects/${escapeRegExp(project.id)}/members/[^/]+$`, 'u'), [422]);
      await dialog.getByRole('button', { name: MEMBER.remove, exact: true }).click();
      await del; // BE:project_members/service.py:49-52 MEMBER_LAST_EDITOR
      await expect(dialog.getByRole('alert')).toHaveText(MEMBER.lastEditor); // MRD:26-30, UPM:108-113
      await captureEvidence(page, 'E03_settings_self_remove_422.png');
      await dialog.getByRole('button', { name: MEMBER.keep, exact: true }).click();
      await expect(dialog).toHaveCount(0);
      await expect(page.getByText('1 thành viên', { exact: true })).toBeVisible();
    });
  });

  test('E03 · SCR-08 "Xoá dự án": confirm locked until the exact name; Esc / "Để nguyên" send nothing; exact name deletes → "/"', async ({ browser }) => {
    await withAdmin(browser, async (admin) => {
      const { page, api } = admin;
      const project = await createProject(admin, 'delete');
      await openSettings(page, project);
      await settingsTab(page, 'Vùng nguy hiểm').click();
      const open = page.getByRole('tabpanel', { name: 'Vùng nguy hiểm' }).getByRole('button', { name: DANGER.deleteProject, exact: true });
      const dialog = page.getByRole('dialog', { name: DANGER.deleteProjectTitle, exact: true });
      const confirm = dialog.getByRole('button', { name: DANGER.deleteProject, exact: true });
      const typed = dialog.getByRole('textbox', { name: DANGER.typeName, exact: true });

      const mark = api.length;
      await open.click();
      await expect(confirm).toBeDisabled(); // UPS:1203-1208 canConfirmDanger
      await typed.fill(`${project.name}x`);
      await expect(confirm).toBeDisabled();
      await page.keyboard.press('Escape'); // PS:156 onClose → cancelDanger
      await expect(dialog).toHaveCount(0);
      await open.click();
      await dialog.getByRole('button', { name: DANGER.keep, exact: true }).click();
      await expect(dialog).toHaveCount(0);
      expect(countSince(api, mark, 'DELETE', projectRe(project.id)), 'cancel paths send no DELETE').toBe(0);

      await open.click();
      await expect(typed).toHaveValue(''); // UPS:1123-1127 openDanger clears the text
      await typed.fill(project.name);
      await expect(confirm).toBeEnabled();
      const del = waitForApi(page, 'DELETE', projectRe(project.id), [200, 204]);
      await confirm.click();
      await del;
      await expect.poll(() => pathOf(page)).toBe(ROUTES.dashboard); // container onProjectDeleted → navigate('/')
      await expect(toastWith(page, DANGER.deletedNotice).first()).toBeVisible();
      await captureEvidence(page, 'E03_settings_delete_project.png');
    });
  });

  test('E03 · SCR-08 "Xoá mọi tầng" → DELETE every floor → toast "Đã xoá 2 tầng của dự án." → "Chưa có tầng nào"', async ({ browser }) => {
    await withAdmin(browser, async (admin) => {
      const { page, api } = admin;
      const project = await createProject(admin, 'delfloors', 2);
      await openSettings(page, project);
      await settingsTab(page, 'Vùng nguy hiểm').click();
      const panel = page.getByRole('tabpanel', { name: 'Vùng nguy hiểm' });
      await expect(panel).toContainText('Xoá toàn bộ 2 tầng cùng bản vẽ và mô hình của chúng. Không hoàn tác được.'); // UPS:1333-1335

      const mark = api.length;
      await panel.getByRole('button', { name: DANGER.deleteFloors, exact: true }).click();
      const dialog = page.getByRole('dialog', { name: DANGER.deleteFloorsTitle, exact: true });
      await expect(dialog.getByRole('textbox')).toHaveCount(0); // PS:161 only "Xoá dự án" asks for the name
      await dialog.getByRole('button', { name: DANGER.deleteFloors, exact: true }).click();
      await expect.poll(() => countSince(api, mark, 'DELETE', floorDeleteRe)).toBe(2); // PSG:509-540
      await expect(toastWith(page, 'Đã xoá 2 tầng của dự án.').first()).toBeVisible(); // UPS:1170-1176
      await expect(panel.getByText(DANGER.noFloorsTitle, { exact: true })).toBeVisible(); // DZ:71-76
      await captureEvidence(page, 'E03_settings_delete_all_floors.png');
    });
  });

  test('E03 · SCR-08 at 375 px the tab strip is the "Nhóm cài đặt" select (collapsed)', async ({ browser }) => {
    await withAdmin(
      browser,
      async (admin) => {
        const { page } = admin;
        const project = await createProject(admin, 'compact');
        await openSettings(page, project);
        // PS:112-128: below 1024 px (UPS:578-597) the tablist is replaced by a Select.
        await expect(page.getByRole('tablist', { name: SETTINGS_TABS })).toHaveCount(0);
        const select = page.getByRole('combobox', { name: SETTINGS_TABS, exact: true });
        await select.click();
        await page.getByRole('option', { name: 'Vùng nguy hiểm', exact: true }).click();
        await expect(page.getByRole('button', { name: DANGER.deleteProject, exact: true })).toBeVisible();
        expect(await horizontalOverflow(page), 'no horizontal scroll at 375 px').toBeLessThanOrEqual(0);
        await captureEvidence(page, 'E03_settings_compact_select.png');
      },
      { viewport: COMPACT },
    );
  });
});

/* ================================================================= SCR-09 floor manager */

test.describe('E03 SCR-09 floor manager', () => {
  test('E03 · SCR-09 "Tên tầng" empty / 121 characters / bidi mark → "Chưa đổi được tên tầng" toast, no PATCH, saved name back', async ({ browser }) => {
    await withAdmin(browser, async (admin) => {
      const { page, api } = admin;
      const project = await createProject(admin, 'fname', 3);
      await openFloors(page, project);
      const target = project.floors[1] ?? firstFloor(project);
      const input = page.getByRole('textbox', { name: `Tên tầng ${target.name}`, exact: true }); // FTR:253

      const mark = api.length;
      for (const [typed, reason] of [
        ['', RENAME_REASONS.empty],
        ['x'.repeat(121), RENAME_REASONS.tooLong],
        [`Tầng\u202E2`, RENAME_REASONS.bidi],
      ] as const) {
        await input.fill(typed);
        await input.press('Enter'); // FTR:258-261 Enter blurs → commit (UFM:1180-1188)
        await expect(toastWith(page, `${RENAME_REFUSED} — ${reason}`).first()).toBeVisible(); // UFM:686-696, NH:59-61
        await expect(input).toHaveValue(target.name); // draft cleared (UFM:1175-1181)
      }
      await quiet(page);
      expect(countSince(api, mark, 'PATCH', spatialRe(project.id)), 'refused names send no PATCH').toBe(0);
      await captureEvidence(page, 'E03_floors_rename_refused.png');
    });
  });

  test('E03 · SCR-09 "Thêm tầng" → toast "Đã thêm tầng." → "Hoàn tác" deletes the new floor', async ({ browser }) => {
    await withAdmin(browser, async (admin) => {
      const { page } = admin;
      const project = await createProject(admin, 'fadd', 3);
      await openFloors(page, project);

      const post = waitForApi(page, 'POST', floorsRe(project.id), [200, 201]);
      await page.getByRole('button', { name: 'Thêm tầng', exact: true }).click();
      const { json } = await post;
      const added = stringField(json, 'name', 'POST floors');
      // UFM:369-378 nextNewFloorName (BUG-277): 3 floors at elevation >= 0 → number 3; "Tầng 3" is taken → "Tầng 4".
      expect(added, 'nextNewFloorName: floors at elevation >= 0, skipping taken names (UFM:369-378)').toBe('Tầng 4');
      await expect(floorRows(page)).toHaveCount(4);

      const del = waitForApi(page, 'DELETE', floorDeleteRe, [200, 204]);
      await toastWith(page, 'Đã thêm tầng.').first().getByRole('button', { name: UNDO, exact: true }).click(); // FMG:595
      await del; // inverse plan of an add = remove (UFM:885-889)
      await expect(floorRows(page)).toHaveCount(3);
      await expect(floorRow(page, added)).toHaveCount(0);
      await captureEvidence(page, 'E03_floors_add_undo.png');
    });
  });

  test('E03 · SCR-09 row menu "Xoá tầng" (no confirm) → DELETE + toast → "Hoàn tác" re-creates it', async ({ browser }) => {
    await withAdmin(browser, async (admin) => {
      const { page } = admin;
      const project = await createProject(admin, 'fdel', 3);
      await openFloors(page, project);
      const top = project.floors[2] ?? firstFloor(project);

      const del = waitForApi(page, 'DELETE', new RegExp(`^/api/floors/${escapeRegExp(top.id)}$`, 'u'), [200, 204]);
      await openRowMenu(page, top.name);
      await page.getByRole('menuitem', { name: 'Xoá tầng', exact: true }).click(); // FT:175-180, no dialog (F-05)
      await del;
      await expect(floorRow(page, top.name)).toHaveCount(0);
      const toast = toastWith(page, `Đã xoá tầng ${top.name}.`).first(); // FMG:585
      await expect(toast).toBeVisible();

      const post = waitForApi(page, 'POST', floorsRe(project.id), [200, 201]);
      await toast.getByRole('button', { name: UNDO, exact: true }).click();
      await post; // inverse of a remove = create (UFM:890-891), within FLOOR_RESTORE_WINDOW_MS (UFM:204)
      await expect(floorRow(page, top.name)).toHaveCount(1);
      await captureEvidence(page, 'E03_floors_delete_undo.png');
    });
  });

  test('E03 · SCR-09 row menu "Nhân bản": in-row confirm; Escape cancels it; confirm → POST "… (bản sao)" + toast', async ({ browser }) => {
    await withAdmin(browser, async (admin) => {
      const { page, api } = admin;
      const project = await createProject(admin, 'fdup', 2);
      await openFloors(page, project);
      const source = firstFloor(project);
      const row = floorRow(page, source.name);
      const copySwitch = row.getByRole('switch', { name: 'Sao chép nội thất sang tầng mới', exact: true }); // FTR:340-345

      const mark = api.length;
      await openRowMenu(page, source.name);
      await page.getByRole('menuitem', { name: 'Nhân bản', exact: true }).click(); // FT:163-169
      await expect(copySwitch).toBeVisible();
      await copySwitch.focus();
      await page.keyboard.press('Escape'); // FTR:173-177
      await expect(copySwitch).toHaveCount(0);
      expect(countSince(api, mark, 'POST', floorsRe(project.id)), 'cancel sends no POST').toBe(0);

      await openRowMenu(page, source.name);
      await page.getByRole('menuitem', { name: 'Nhân bản', exact: true }).click();
      await expect(copySwitch).toHaveAttribute('aria-checked', 'false'); // FT:165-166 reset to off
      const post = waitForApi(page, 'POST', floorsRe(project.id), [200, 201]);
      await row.getByRole('button', { name: 'Nhân bản', exact: true }).click(); // FTR:346-348
      const { json } = await post;
      expect(stringField(json, 'name', 'POST floors (duplicate)')).toBe(`${source.name} (bản sao)`); // UFM:381-388
      await expect(toastWith(page, `Đã nhân bản tầng ${source.name}.`).first()).toBeVisible(); // FMG:588-589
      await expect(floorRows(page)).toHaveCount(3);
      await captureEvidence(page, 'E03_floors_duplicate.png');
    });
  });

  test('E03 · SCR-09 row menu "Đổi tên" focuses "Tên tầng …"; breadcrumb "Dự án" → "/"', async ({ browser }) => {
    await withAdmin(browser, async (admin) => {
      const { page } = admin;
      const project = await createProject(admin, 'fmenu', 2);
      await openFloors(page, project);
      const floor = firstFloor(project);
      await openRowMenu(page, floor.name);
      await page.getByRole('menuitem', { name: 'Đổi tên', exact: true }).click(); // FT:158-161
      await expect(page.getByRole('textbox', { name: `Tên tầng ${floor.name}`, exact: true })).toBeFocused();
      await captureEvidence(page, 'E03_floors_menu_rename_focus.png');

      await page
        .getByRole('navigation', { name: 'Đường dẫn trang' })
        .getByRole('button', { name: 'Dự án', exact: true })
        .click(); // FM:100-110 → FMC handleBackToProjects
      await expect.poll(() => pathOf(page)).toBe(ROUTES.dashboard);
    });
  });

  test('E03 · SCR-09 Alt+ArrowUp on the first row / Alt+ArrowDown on the last row → no reorder', async ({ browser }) => {
    await withAdmin(browser, async (admin) => {
      const { page, api } = admin;
      const project = await createProject(admin, 'fedge', 3);
      await openFloors(page, project);
      const before = await floorRowNames(page);
      const first = before[0];
      const last = before.at(-1);
      if (first === undefined || last === undefined) throw new Error('no rows');

      const mark = api.length;
      await floorRow(page, first).focus();
      await page.keyboard.press('Alt+ArrowUp'); // FTR:80-85 reorderedIds → null at the edge
      await floorRow(page, last).focus();
      await page.keyboard.press('Alt+ArrowDown');
      await quiet(page);
      expect(countSince(api, mark, 'PATCH', reorderRe), 'no reorder PATCH at the stack edges').toBe(0);
      expect(await floorRowNames(page)).toEqual(before);
      await captureEvidence(page, 'E03_floors_reorder_edges.png');
      await attachJson('E03_floors_reorder_edges.json', { before, after: await floorRowNames(page), writes: writesSince(api, mark) });
    });
  });

  test('E03 · SCR-09 middle floor "Cao độ tầng" moved into its neighbour → violation notice names the floor, no PATCH', async ({ browser }) => {
    await withAdmin(browser, async (admin) => {
      const { page, api } = admin;
      const project = await createProject(admin, 'felev', 3);
      await openFloors(page, project);
      const middle = project.floors[1] ?? firstFloor(project);
      // UFM:516: auto elevation starts OFF, so the "Cao độ tầng …" inputs are already editable (FTR:278-288).
      await expect(page.getByRole('switch', { name: AUTO_ELEVATION, exact: true })).toHaveAttribute('aria-checked', 'false');
      const elevation = page.getByRole('textbox', { name: `Cao độ tầng ${middle.name}`, exact: true }); // FTR:279-288

      const mark = api.length;
      await elevation.focus();
      await elevation.press('ArrowUp'); // NF:148-162 +1 m → 4 m, inside "Tầng 3" (6 m) once its 3 m height is added
      await elevation.blur();
      // UFM:1205-1215 + FMG:465-512: the refusal names the floor in quotes; FM:137-141 InlineAlert role="status".
      const notice = page.getByRole('status').filter({ hasText: `"${middle.name}"` });
      await expect(notice.first()).toBeVisible();
      await quiet(page);
      expect(countSince(api, mark, 'PATCH', spatialRe(project.id)), 'a refused elevation sends no PATCH').toBe(0);
      await captureEvidence(page, 'E03_floors_elevation_conflict.png');
      await attachJson('E03_floors_elevation_conflict.json', { notice: await notice.first().innerText(), writes: writesSince(api, mark) });
    });
  });

  test('E03 · SCR-09 "Tải lên" on a row without a drawing → /projects/:id/upload', async ({ browser }) => {
    await withAdmin(browser, async (admin) => {
      const { page } = admin;
      const project = await createProject(admin, 'fupl', 2);
      await openFloors(page, project);
      const floor = firstFloor(project);
      const row = floorRow(page, floor.name);
      // An editor's row reads "Chưa có bản vẽ" once: the badge (FTR:314-317); the count text (UFM:267-270) is drawn only
      // for a reader (FTR:329-331), not next to the badge (BUG-250, FIX-1284).
      await expect(row.getByText('Chưa có bản vẽ', { exact: true })).toHaveCount(1);
      await captureEvidence(page, 'E03_floors_upload_link.png');
      await row.getByRole('button', { name: 'Tải lên', exact: true }).click(); // FTR:318-327
      await expect.poll(() => pathOf(page)).toBe(ROUTES.project.upload(project.id)); // FMC handleNavigateToDrawings
    });
  });

  test('E03 · SCR-09 project with no floor → "Chưa có tầng nào" empty state; its "Thêm tầng" creates the first floor', async ({ browser }) => {
    await withAdmin(browser, async (admin) => {
      const { page } = admin;
      const project = await createProject(admin, 'fempty');
      await page.goto(ROUTES.project.floors(project.id));
      await expect(page.getByText('Chưa có tầng nào', { exact: true })).toBeVisible(); // FT:76, FT:188-198
      await expect(page.getByText(FLOOR_EMPTY_NOTICE, { exact: true })).toBeVisible();
      await captureEvidence(page, 'E03_floors_empty.png');

      const post = waitForApi(page, 'POST', floorsRe(project.id), [200, 201]);
      await page.getByRole('button', { name: 'Thêm tầng', exact: true }).click();
      await post;
      await expect(floorRow(page, 'Tầng 1')).toBeVisible();
    });
  });

  test('E03 · SCR-09 Enter on a section band selects its row (keyboard path)', async ({ browser }) => {
    await withAdmin(browser, async (admin) => {
      const { page } = admin;
      const project = await createProject(admin, 'fband', 3);
      await openFloors(page, project);
      const floor = project.floors[1] ?? firstFloor(project);
      const band = page
        .getByRole('region', { name: SECTION_REGION, exact: true })
        .getByRole('button', { name: new RegExp(`^${escapeRegExp(floor.name)} · `, 'u') }); // FSC:94-117
      await band.focus();
      await page.keyboard.press('Enter'); // FSC:106-111
      await expect(floorRow(page, floor.name)).toHaveAttribute('aria-selected', 'true');
      await expect(band).toHaveAttribute('aria-pressed', 'true');
      await expect(band).toHaveAttribute('aria-label', new RegExp(', đang chọn$', 'u')); // FSC:95
      await captureEvidence(page, 'E03_floors_band_keyboard.png');
    });
  });

  test('E03 · SCR-09 at 375 px the section cut goes below the table (FMC `isCompact`)', async ({ browser }) => {
    await withAdmin(
      browser,
      async (admin) => {
        const { page } = admin;
        const project = await createProject(admin, 'fcompact', 3);
        await openFloors(page, project);
        const section = page.getByRole('region', { name: SECTION_REGION, exact: true });
        const table = page.getByRole('table');
        const sectionBox = await section.boundingBox();
        const tableBox = await table.boundingBox();
        await captureEvidence(page, 'E03_floors_compact.png', { fullPage: true });
        await attachJson('E03_floors_compact.json', { sectionBox, tableBox, horizontalOverflow: await horizontalOverflow(page) });
        // FMC:113 "Dưới 1.024px lát cắt xuống dưới bảng; màn cha đo bề rộng và truyền vào" + FM:144-163 (order-2 when compact).
        expect(sectionBox !== null && tableBox !== null && sectionBox.y >= tableBox.y + tableBox.height - 1, 'section cut below the table at 375 px').toBe(true);
      },
      { viewport: COMPACT },
    );
  });

  test('E03 · SCR-09 [mocked response] GET floors 500 → "Không đọc được danh sách tầng" + "Thử lại" recovers', async ({ browser }) => {
    await withAdmin(browser, async (admin) => {
      const { page } = admin;
      const project = await createProject(admin, 'f500', 2);
      const listPath = `/api/projects/${project.id}/floors`;
      const handler = async (route: Route): Promise<void> => {
        if (route.request().method() !== 'GET') {
          await route.fallback();
          return;
        }
        await route.fulfill({ status: 500, contentType: 'application/json', body: JSON.stringify({ detail: 'qa-e03 mocked 500' }) });
      };
      const matcher = (url: URL): boolean => url.pathname === listPath;
      await page.route(matcher, handler);
      await page.goto(ROUTES.project.floors(project.id));
      const alert = page.getByRole('alert').filter({ hasText: FLOOR_LIST_ERROR }); // FT:213-222
      await expect(alert).toBeVisible();
      await expect(page.getByRole('region', { name: SECTION_REGION })).toHaveCount(0); // FM:95, FM:145
      await captureEvidence(page, 'E03_floors_list_500.png');

      await page.unroute(matcher, handler);
      await alert.getByRole('button', { name: 'Thử lại', exact: true }).click(); // UFM:1119-1121 refetch
      await expect(floorRows(page)).toHaveCount(2);
    });
  });
});

/* ================================================================= SCR-10 floor upload */

test.describe('E03 SCR-10 floor upload', () => {
  test('E03 · SCR-10 project with no floor → "Dự án chưa có tầng nào"; "Bắt đầu xử lý" does nothing; breadcrumb → "/"', async ({ browser }) => {
    await withAdmin(browser, async (admin) => {
      const { page, api } = admin;
      const project = await createProject(admin, 'unofloor');
      await page.goto(ROUTES.project.upload(project.id));
      await expect(page.getByText(NO_FLOORS_TITLE, { exact: true })).toBeVisible(); // FU:149-150
      await expect(page.getByTestId(COUNTER)).toHaveText('0 / 0 tầng đã có bản vẽ'); // FUF:99-106, UFU:1138-1140

      const mark = api.length;
      await page.getByRole('button', { name: SUBMIT, exact: true }).click();
      await quiet(page);
      // UFU:974-992: no reason to list (no floor) → `first === undefined` → return: no notice, no navigation.
      await expect(page.getByTestId(BLOCK_NOTICE)).toHaveCount(0);
      expect(pathOf(page)).toBe(ROUTES.project.upload(project.id));
      expect(writesSince(api, mark)).toEqual([]);
      await captureEvidence(page, 'E03_upload_no_floor_submit.png');
      await attachJson('E03_upload_no_floor_submit.json', { path: pathOf(page), writes: writesSince(api, mark), blockNotice: 0 });

      await page.getByRole('navigation', { name: 'Đường dẫn trang' }).getByRole('button', { name: 'Dự án', exact: true }).click(); // FU:194-204
      await expect.poll(() => pathOf(page)).toBe(ROUTES.dashboard);
    });
  });

  test('E03 · SCR-10 floors without drawings: empty invitation, "0 / 2", "Chưa có bản vẽ"; submit lists every floor', async ({ browser }) => {
    await withAdmin(browser, async (admin) => {
      const { page } = admin;
      const project = await createProject(admin, 'unodraw', 2);
      await openUpload(page, project);
      await expect(page.getByText(UPLOAD_EMPTY, { exact: true })).toBeVisible(); // FU:156-158 (state 'empty')
      await expect(page.getByTestId(COUNTER)).toHaveText('0 / 2 tầng đã có bản vẽ');
      // BUG-263: the card agrees with the notice below — no drawing, not "Chờ xử lý".
      for (const floor of project.floors) {
        await expect(card(page, floor).getByText(NO_DRAWING_STATUS, { exact: true })).toBeVisible();
        await expect(card(page, floor).getByText(WAITING, { exact: true })).toHaveCount(0);
      }

      await page.getByRole('button', { name: SUBMIT, exact: true }).click();
      const notice = page.getByTestId(BLOCK_NOTICE);
      await expect(notice).toHaveAttribute('role', 'alert'); // FUF:73-78
      await expect(notice).toContainText('Không thể bắt đầu xử lý');
      for (const floor of project.floors) await expect(notice).toContainText(`${floor.name} chưa có bản vẽ.`); // UFU:906-915
      await captureEvidence(page, 'E03_upload_blocked_all.png');
    });
  });

  test('E03 · SCR-10 "Chọn tệp" opens a multi-file chooser (.png,.jpg,.pdf); formats line; a chosen .txt is refused', async ({ browser }, testInfo) => {
    await withAdmin(browser, async (admin) => {
      const { page, api } = admin;
      const project = await createProject(admin, 'uchooser', 1);
      await openUpload(page, project);
      await expect(page.getByTestId(FILE_INPUT)).toHaveAttribute('accept', '.png,.jpg,.pdf'); // UFU:1211, VAL:62-66
      await expect(page.getByTestId(DROPZONE)).toContainText(/Định dạng hỗ trợ: \.png, \.jpg, \.pdf\. Kích thước tối đa: .+\./u); // UFU:1208-1210

      const txt = testInfo.outputPath('ghi-chu.txt');
      writeFileSync(txt, 'not a drawing\n', 'utf8');
      const mark = api.length;
      const chooser = page.waitForEvent('filechooser');
      await page.getByTestId(DROPZONE).getByRole('button', { name: SELECT_FILE, exact: true }).click(); // FUD:91-98
      const fileChooser = await chooser;
      expect(fileChooser.isMultiple(), 'input[multiple] (FUD:77)').toBe(true);
      await fileChooser.setFiles(txt);
      await expect(tray(page)).toContainText('Định dạng .txt chưa nhận được. Định dạng hỗ trợ: .png, .jpg, .pdf.'); // UFU:178-182
      expect(countSince(api, mark, 'POST', uploadInitRe(project.id)), 'a refused file never inits an upload').toBe(0);
      await captureEvidence(page, 'E03_upload_chooser_txt.png');
    });
  });

  test('E03 · SCR-10 drag over the page lights the drop zone; drag leave clears it; a dropped .docx is refused', async ({ browser }) => {
    await withAdmin(browser, async (admin) => {
      const { page } = admin;
      const project = await createProject(admin, 'udrag', 1);
      await openUpload(page, project);
      const zone = page.getByTestId(DROPZONE);
      const dataTransfer = await page.evaluateHandle(() => {
        const transfer = new DataTransfer();
        transfer.items.add(new File(['not a drawing'], 'ghi-chu.docx', { type: 'application/octet-stream' }));
        return transfer;
      });

      await zone.dispatchEvent('dragenter', { dataTransfer }); // FU:177-180 → UFU:1226-1228
      await expect(zone).toHaveAttribute('data-drag-active', 'true'); // FUD:61
      await captureEvidence(page, 'E03_upload_drag_active.png');
      await zone.dispatchEvent('dragleave', { dataTransfer }); // UFU:1229-1231
      await expect(zone).toHaveAttribute('data-drag-active', 'false');

      await zone.dispatchEvent('dragenter', { dataTransfer });
      await zone.dispatchEvent('drop', { dataTransfer }); // FU:188-191 → UFU:1221-1224 (depth reset)
      await expect(zone).toHaveAttribute('data-drag-active', 'false');
      await expect(tray(page)).toContainText('Định dạng .docx chưa nhận được.');
    });
  });

  test('E03 · SCR-10 file over 100 MiB → "Tệp nặng …, vượt trần … của một tệp." in the tray; no upload init', async ({ browser }, testInfo) => {
    const big = testInfo.outputPath('qua-nang.png');
    // Sparse file: size MAX + 1 without writing 100 MiB of bytes; VAL:246-255 checks the size first.
    const fd = openSync(big, 'w');
    ftruncateSync(fd, MAX_UPLOAD_FILE_SIZE_BYTES + 1);
    closeSync(fd);
    try {
      await withAdmin(browser, async (admin) => {
        const { page, api } = admin;
        const project = await createProject(admin, 'ubig', 1);
        await openUpload(page, project);
        const mark = api.length;
        await page.getByTestId(FILE_INPUT).setInputFiles(big);
        const item = tray(page).getByText(/^Tệp nặng .+, vượt trần .+ của một tệp\.$/u); // UFU:173-177
        await expect(item).toBeVisible();
        await quiet(page);
        expect(countSince(api, mark, 'POST', uploadInitRe(project.id)), 'no init for a file over the cap').toBe(0);
        await captureEvidence(page, 'E03_upload_too_large.png');
        await attachJson('E03_upload_too_large.json', { sizeBytes: MAX_UPLOAD_FILE_SIZE_BYTES + 1, sentence: await item.innerText() });
      });
    } finally {
      rmSync(big, { force: true });
    }
  });

  test('E03 · SCR-10 unreadable .pdf and a 21-page .pdf → two tray refusals; "Đóng" dismisses one', async ({ browser }, testInfo) => {
    const broken = testInfo.outputPath('khong-doc-duoc.pdf');
    const tooMany = testInfo.outputPath('qua-nhieu-trang.pdf');
    writeFileSync(broken, 'this is not a pdf\n', 'utf8'); // VAL:306-339 no "%PDF-" → null → unreadable
    writeFileSync(tooMany, '%PDF-1.4\n1 0 obj << /Type /Pages /Count 21 >> endobj\n%%EOF\n', 'utf8'); // VAL:280-285
    await withAdmin(browser, async (admin) => {
      const { page } = admin;
      const project = await createProject(admin, 'updf', 1);
      await openUpload(page, project);
      await page.getByTestId(FILE_INPUT).setInputFiles([broken, tooMany]);
      await expect(tray(page)).toContainText('Không đọc được nội dung tệp .pdf.'); // UFU:188-189
      await expect(tray(page)).toContainText('Tệp có 21 trang, vượt trần 20 trang.'); // UFU:183-186
      await expect(tray(page)).toContainText('2 tệp'); // UFU:1129
      await captureEvidence(page, 'E03_upload_pdf_refusals.png');

      const alerts = tray(page).getByRole('alert');
      await expect(alerts).toHaveCount(2);
      await alerts.first().getByRole('button', { name: DISMISS, exact: true }).click(); // FUT:86-96
      await expect(alerts).toHaveCount(1);
    });
  });

  test('E03 · SCR-10 3-page .pdf assigned to a floor waits for "Chọn trang" (no init); submit says "… chưa tải xong bản vẽ."', async ({ browser }, testInfo) => {
    const threePages = testInfo.outputPath('ba-trang.pdf');
    writeFileSync(threePages, '%PDF-1.4\n1 0 obj << /Type /Pages /Count 3 >> endobj\n%%EOF\n', 'utf8');
    await withAdmin(browser, async (admin) => {
      const { page, api } = admin;
      const project = await createProject(admin, 'upages', 1);
      const floor = firstFloor(project);
      await openUpload(page, project);
      await page.getByTestId(FILE_INPUT).setInputFiles(threePages);
      await expect(tray(page)).toContainText('ba-trang.pdf'); // name · size · "3 trang" (UFU:1027-1030)
      await expect(tray(page)).toContainText('3 trang');

      const mark = api.length;
      await tray(page).getByRole('combobox', { name: ASSIGN }).click();
      await page.getByRole('option', { name: floor.name, exact: true }).click();
      const picker = card(page, floor).getByRole('combobox', { name: PICK_PAGE }); // FUC:265-281
      await expect(picker).toBeVisible();
      await expect(card(page, floor).getByText(WAITING, { exact: true })).toBeVisible();
      await picker.click();
      await expect(page.getByRole('option', { name: /^Trang [1-3]$/u })).toHaveCount(3); // UFU:1017-1020
      await page.keyboard.press('Escape');
      await quiet(page);
      // UFU:245-251 + 583-587: a multi-page PDF without a page is assigned but not uploaded.
      expect(countSince(api, mark, 'POST', uploadInitRe(project.id)), 'no init before a page is chosen').toBe(0);

      await page.getByRole('button', { name: SUBMIT, exact: true }).click();
      await expect(page.getByTestId(BLOCK_NOTICE)).toContainText(`${floor.name} chưa tải xong bản vẽ.`); // UFU:903-914
      await captureEvidence(page, 'E03_upload_pdf_pick_page.png');
    });
  });

  test('E03 · SCR-10 .dwg (not offered by the picker) assigned → CAD pill + server 422 → CAD sentence on the card; "Đóng" clears it', async ({ browser }, testInfo) => {
    const dwg = testInfo.outputPath('ban-ve.dwg');
    writeFileSync(dwg, 'AC1027 qa-e03 not a real drawing\n', 'utf8');
    await withAdmin(browser, async (admin) => {
      const { page } = admin;
      const project = await createProject(admin, 'udwg', 1);
      const floor = firstFloor(project);
      await openUpload(page, project);
      // VAL:57-60: the picker omits .dwg but a dropped/forced .dwg still validates (branch 'cad').
      await page.getByTestId(FILE_INPUT).setInputFiles(dwg);
      await expect(tray(page)).toContainText('ban-ve.dwg');

      const init = waitForApi(page, 'POST', uploadInitRe(project.id), [422]);
      await tray(page).getByRole('combobox', { name: ASSIGN }).click();
      await page.getByRole('option', { name: floor.name, exact: true }).click();
      await init; // BE:drawings/uploads.py:101-109 CAD_NOT_SUPPORTED
      const floorCard = card(page, floor);
      await expect(floorCard.getByText(CAD_PILL, { exact: true })).toBeVisible(); // FUC:241
      await expect(floorCard.getByRole('alert')).toContainText(CAD_SENTENCE); // FUG:194-199, FUC:285-297
      await expect(floorCard.getByText(STATUS_ERROR, { exact: true })).toBeVisible();
      await captureEvidence(page, 'E03_upload_dwg_422.png');

      await floorCard.getByRole('alert').getByRole('button', { name: DISMISS, exact: true }).click();
      await expect(floorCard.getByRole('alert')).toHaveCount(0);
    });
  });

  test('E03 · SCR-10 tray trash "Xoá bản vẽ …" → toast "Đã xoá bản vẽ …" → "Hoàn tác" puts it back', async ({ browser }, testInfo) => {
    const txt = testInfo.outputPath('ghi-chu-xoa.txt');
    writeFileSync(txt, 'not a drawing\n', 'utf8');
    await withAdmin(browser, async (admin) => {
      const { page, api } = admin;
      const project = await createProject(admin, 'utrash', 1);
      await openUpload(page, project);
      await page.getByTestId(FILE_INPUT).setInputFiles(txt);
      await expect(tray(page)).toContainText('ghi-chu-xoa.txt');

      const mark = api.length;
      await tray(page).getByRole('button', { name: 'Xoá bản vẽ ghi-chu-xoa.txt', exact: true }).click(); // FUT:76-83, UFU:1119
      await expect(tray(page)).toHaveCount(0); // FUT:29-31 empty tray is not drawn
      const toast = toastWith(page, 'Đã xoá bản vẽ ghi-chu-xoa.txt').first(); // UFU:879-884
      await expect(toast).toBeVisible();
      await captureEvidence(page, 'E03_upload_tray_remove_toast.png');
      await toast.getByRole('button', { name: UNDO, exact: true }).click();
      await expect(tray(page)).toContainText('ghi-chu-xoa.txt');
      expect(writesSince(api, mark), 'tray removal and undo are local').toEqual([]);
    });
  });

  test('E03 · SCR-10 attached drawing: card menu Esc; "Xoá bản vẽ …" is local (no request), "Hoàn tác" restores; reload shows the server copy', async ({ browser }) => {
    test.setTimeout(240_000);
    await withAdmin(browser, async (admin) => {
      const { page, api } = admin;
      const project = await createProject(admin, 'uattach', 1);
      const floor = firstFloor(project);
      const file = drawingName();
      await openUpload(page, project);
      await uploadDrawingTo(page, project, floor);

      const menuButton = card(page, floor).getByRole('button', { name: `Tuỳ chọn của tầng ${floor.name}`, exact: true }); // FUC:100-108
      const remove = card(page, floor).getByRole('button', { name: `Xoá bản vẽ ${file}`, exact: true });
      await menuButton.click();
      await expect(menuButton).toHaveAttribute('aria-expanded', 'true');
      await page.keyboard.press('Escape'); // FUC:93-98
      await expect(menuButton).toHaveAttribute('aria-expanded', 'false');
      await expect(remove).toHaveCount(0);

      const mark = api.length;
      await menuButton.click();
      await remove.click(); // FUC:138-150 → UFU:833-885
      const toast = toastWith(page, `Đã xoá bản vẽ ${file}`).first();
      await expect(toast).toBeVisible();
      await toast.getByRole('button', { name: UNDO, exact: true }).click();
      await expect(card(page, floor).getByText(ATTACHED, { exact: true })).toBeVisible(); // UFU:843-852 "đã gắn kèm vẫn là đã gắn kèm"
      // UFU:847: "xoá không gọi máy chủ" — neither the removal nor its undo sends a request.
      const localWrites = writesSince(api, mark);
      expect(localWrites, 'removal + undo send no request').toEqual([]);

      await menuButton.click();
      await remove.click();
      await page.reload();
      await expect(card(page, floor).getByText(ATTACHED, { exact: true })).toBeVisible(); // UFU:1045-1050 server drawing
      // FUC:82-86: a server-side drawing offers nothing to remove → no menu button at all.
      await expect(menuButton).toHaveCount(0);
      await captureEvidence(page, 'E03_upload_remove_is_local.png');
      await attachJson('E03_upload_remove_is_local.json', { writesDuringRemoveAndUndo: localWrites, afterReload: ATTACHED });
    });
  });

  test('E03 · SCR-10 every floor attached → "Bắt đầu xử lý" opens /pipeline with no request; SCR-12 log copy; no summary actions (extraction unsupported)', async ({ browser }) => {
    test.setTimeout(PIPELINE_TIMEOUT_MS + 180_000);
    await withAdmin(
      browser,
      async (admin) => {
        const { page, api } = admin;
        const project = await createProject(admin, 'usubmit', 1);
        const floor = firstFloor(project);
        await openUpload(page, project);
        await uploadDrawingTo(page, project, floor);
        await expect(page.getByTestId(COUNTER)).toHaveText('1 / 1 tầng đã có bản vẽ');

        const mark = api.length;
        await page.getByRole('button', { name: SUBMIT, exact: true }).click();
        await expect.poll(() => pathOf(page)).toBe(ROUTES.project.pipeline(project.id)); // UFU:994-997 navigate only
        const submitWrites = writesSince(api, mark);
        expect(submitWrites, '"Bắt đầu xử lý" itself sends no request').toEqual([]);

        const done = page.getByText(/^Đã xong ([1-9]\d*)\/\1 tầng/u); // UPR:172-178
        const failure = page.getByRole('button', { name: 'Sao chép mã lỗi' });
        await expect(done.or(failure).first()).toBeVisible({ timeout: PIPELINE_TIMEOUT_MS });
        if (await failure.first().isVisible()) throw new Error('pipeline failed on the fixture project (see screenshot)');

        await page.getByRole('tablist', { name: PROCESSING.tabs }).getByRole('tab', { name: 'Nhật ký', exact: true }).click();
        const emptyLog = await page.getByText(PROCESSING.logEmpty, { exact: true }).isVisible();
        await page.getByRole('button', { name: PROCESSING.copyLog, exact: true }).click(); // PLP:79-84 → UPR:781-783
        const copied = await page.evaluate(() => navigator.clipboard.readText());
        // UPR:781-783 joins "<time> <text>" per log line: an empty log copies "", a non-empty one copies its lines.
        if (emptyLog) expect(copied).toBe('');
        else expect(copied.trim().length, 'clipboard holds the log').toBeGreaterThan(0);
        await captureEvidence(page, 'E03_pipeline_submit_log_copy.png');
        await attachJson('E03_pipeline_submit_log_copy.json', {
          submitWrites,
          logEmpty: emptyLog,
          copiedLineCount: copied === '' ? 0 : copied.split('\n').length,
        });

        // PRG:788, 975 `extractionSummary` unsupported → UPR:632-666 no `extraction` → UPR:1186-1193 summary undefined →
        // PR:264 no "Báo cáo tổng kết": neither "Duyệt lớp tường" nor "Hiệu chỉnh tỷ lệ" (PSU:19-20) is offered after a
        // finished run on the real stack (finding F10: /pipeline is a dead end once done).
        await expect(page.getByRole('button', { name: PROCESSING.calibrate, exact: true })).toHaveCount(0);
        await expect(page.getByRole('button', { name: 'Duyệt lớp tường', exact: true })).toHaveCount(0);
      },
      { clipboard: true },
    );
  });

  test('E03 · SCR-10 at 375 px the upload screen has no horizontal scroll (collapsed cards)', async ({ browser }) => {
    await withAdmin(
      browser,
      async (admin) => {
        const { page } = admin;
        const project = await createProject(admin, 'ucompact', 2);
        await openUpload(page, project);
        const overflow = await horizontalOverflow(page);
        await captureEvidence(page, 'E03_upload_compact.png', { fullPage: true });
        await attachJson('E03_upload_compact.json', { horizontalOverflowPx: overflow });
        // UFU:1167 `collapsed` below 1024 px (FUC:201 stacked card); qa-review-ui: no horizontal scroll at 375.
        expect(overflow, 'no horizontal scroll at 375 px').toBeLessThanOrEqual(0);
      },
      { viewport: COMPACT },
    );
  });
});

/* ================================================================= SCR-11 input quality gate */

test.describe('E03 SCR-11 input quality gate', () => {
  test('E03 · SCR-11 floors without a drawing → "Chưa có bản vẽ để kiểm tra"; "Tiếp tục xử lý" aria-disabled with its reason; "Tải bản vẽ lên" → /upload', async ({ browser }) => {
    await withAdmin(browser, async (admin) => {
      const { page } = admin;
      const project = await createProject(admin, 'qnodraw', 2);
      await page.goto(ROUTES.project.quality(project.id));
      // BE:quality/assessments.py:273-275 404 `upload` → UIQ:517-521 null → empty state (IQ:145-153).
      await expect(page.getByText(QUALITY.noDrawingTitle, { exact: true })).toBeVisible();
      await expect(page.getByText(QUALITY.noDrawingNotice, { exact: true })).toBeVisible();
      const proceed = page.getByRole('button', { name: QUALITY.continue, exact: true });
      await expect(proceed).toHaveAttribute('aria-disabled', 'true'); // IQF:70-77, UIQ:1020-1027
      await expect(proceed).toHaveAccessibleDescription(QUALITY.noDrawingReason); // IQF:60-71 aria-describedby
      await proceed.click({ force: true }); // aria-disabled: Playwright treats it as not enabled; IQF:73 drops onClick
      await quiet(page);
      expect(pathOf(page), 'aria-disabled continue does not navigate').toBe(ROUTES.project.quality(project.id));
      await captureEvidence(page, 'E03_quality_no_drawing.png');

      await page.getByRole('button', { name: QUALITY.uploadAction, exact: true }).click(); // IQ:146-149 → UIQ:1270
      await expect.poll(() => pathOf(page)).toBe(ROUTES.project.upload(project.id));
    });
  });

  test('E03 · SCR-11 footer "Tải bản vẽ khác" → /upload; Back; breadcrumb "Dự án" → "/"', async ({ browser }) => {
    await withAdmin(browser, async (admin) => {
      const { page } = admin;
      const project = await createProject(admin, 'qnav', 1);
      await page.goto(ROUTES.project.quality(project.id));
      const secondary = page.getByRole('button', { name: QUALITY.secondary, exact: true }); // IQF:67-69
      await expect(secondary).toBeVisible();
      await captureEvidence(page, 'E03_quality_footer_nav.png');
      await secondary.click();
      await expect.poll(() => pathOf(page)).toBe(ROUTES.project.upload(project.id));
      await page.goBack();
      await expect.poll(() => pathOf(page)).toBe(ROUTES.project.quality(project.id));
      await page.getByRole('navigation', { name: 'Đường dẫn trang' }).getByRole('button', { name: 'Dự án', exact: true }).click(); // IQ:203-208
      await expect.poll(() => pathOf(page)).toBe(ROUTES.dashboard);
    });
  });
});

/* ================================================================= SCR-12 processing */

test.describe('E03 SCR-12 processing', () => {
  test('E03 · SCR-12 project with no run → "Chưa có bước nào để theo dõi"; no background/cancel; "Tải bản vẽ" → /upload', async ({ browser }) => {
    await withAdmin(browser, async (admin) => {
      const { page } = admin;
      const project = await createProject(admin, 'pempty', 1);
      await page.goto(ROUTES.project.pipeline(project.id));
      await expect(page.getByText(PROCESSING.emptyTitle, { exact: true })).toBeVisible(); // PR:196-202, UPR:737-742
      await expect(page.getByText(PROCESSING.emptyDescription, { exact: true })).toBeVisible();
      await expect(page.getByText(PROCESSING.noRun, { exact: true })).toBeVisible(); // UPR:1251
      await expect(page.getByRole('button', { name: PROCESSING.background, exact: true })).toHaveCount(0); // UPR:802-803
      await expect(page.getByRole('button', { name: PROCESSING.cancel, exact: true })).toHaveCount(0); // UPR:801
      await captureEvidence(page, 'E03_pipeline_empty.png');
      await page.getByRole('button', { name: PROCESSING.emptyAction, exact: true }).click(); // UPR:806-808
      await expect.poll(() => pathOf(page)).toBe(ROUTES.project.upload(project.id));
    });
  });

  test('E03 · SCR-12 at 375 px a project with no run still shows the empty state (not two empty columns)', async ({ browser }) => {
    await withAdmin(
      browser,
      async (admin) => {
        const { page } = admin;
        const project = await createProject(admin, 'pcompact', 1);
        await page.goto(ROUTES.project.pipeline(project.id));
        // UPR:737-742: `empty` is checked before `collapsed` (BUG-111 on this screen).
        await expect(page.getByText(PROCESSING.emptyTitle, { exact: true })).toBeVisible();
        await expect(page.getByRole('button', { name: PROCESSING.emptyAction, exact: true })).toBeVisible();
        expect(await horizontalOverflow(page), 'no horizontal scroll at 375 px').toBeLessThanOrEqual(0);
        await captureEvidence(page, 'E03_pipeline_empty_compact.png');
      },
      { viewport: COMPACT },
    );
  });
});

/* ================================================================= SCR-13 pipeline graph / SCR-15 CAD */

test.describe('E03 SCR-13 / SCR-15 dead routes', () => {
  test('E03 · SCR-13 own project: empty story + reason line; no "Chi tiết kỹ thuật", no branch switch, no API read', async ({ browser }) => {
    await withAdmin(browser, async (admin) => {
      const { page, api } = admin;
      const project = await createProject(admin, 'graph', 1);
      const mark = api.length;
      await page.goto(ROUTES.project.pipelineGraph(project.id));
      await expect(page.getByRole('heading', { level: 1, name: GRAPH.title, exact: true })).toBeVisible(); // PG:66
      await expect(page.getByText(GRAPH.emptyTitle, { exact: true })).toBeVisible(); // PG:147-152
      await expect(page.getByText(GRAPH.reasonNoReport, { exact: true })).toBeVisible(); // PGT:159, UPG model.reasonLine
      await expect(page.getByRole('button', { name: GRAPH.detail })).toHaveCount(0); // PG:146-153 empty → no disclosure
      await expect(page.getByRole('button', { name: GRAPH.switch })).toHaveCount(0); // PGG:297 switchBranch false
      const projectReads = api.slice(mark).filter((entry) => entry.path.includes(project.id)).map((entry) => `${entry.method} ${entry.path}`);
      // PGG:343-345: the real gateway answers "unsupported" without a request.
      expect(projectReads, 'the graph never reads this project').toEqual([]);
      await captureEvidence(page, 'E03_graph_empty.png');
      await attachJson('E03_graph_empty.json', { projectReads });
    });
  });

  test('E03 · SCR-15 "Vẫn dùng AI" in the dialog → /pipeline, no write; no "Ghi nhớ lựa chọn…" checkbox', async ({ browser }) => {
    await withAdmin(browser, async (admin) => {
      const { page, api } = admin;
      const project = await createProject(admin, 'cadai', 1);
      const floor = firstFloor(project);
      await page.goto(ROUTES.project.cadConfirm(project.id, floor.id));
      const dialog = page.getByRole('dialog', { name: CAD.dialog, exact: true });
      await expect(dialog).toBeVisible();
      await expect(dialog.getByRole('checkbox', { name: CAD.remember })).toHaveCount(0); // CBD:57 canRememberChoice false (UCB:435)
      await captureEvidence(page, 'E03_cad_dialog.png');

      const mark = api.length;
      await dialog.getByRole('button', { name: CAD.useAi, exact: true }).click(); // CBD:79-85 → UCB:707-714
      await expect.poll(() => pathOf(page)).toBe(ROUTES.project.pipeline(project.id));
      const writes = writesSince(api, mark);
      expect(writes, 'setProcessingBranch is unsupported: no write').toEqual([]);
      await attachJson('E03_cad_use_ai.json', { path: pathOf(page), writes });
    });
  });

  test('E03 · SCR-15 Esc closes the dialog → hand-off; "Dùng đường từ CAD" opens layer mapping; "Thu gọn bảng lớp" ↔ "Mở bảng lớp"', async ({ browser }) => {
    await withAdmin(browser, async (admin) => {
      const { page } = admin;
      const project = await createProject(admin, 'cadmap', 1);
      const floor = firstFloor(project);
      await page.goto(ROUTES.project.cadConfirm(project.id, floor.id));
      const dialog = page.getByRole('dialog', { name: CAD.dialog, exact: true });
      await expect(dialog).toBeVisible();
      await page.keyboard.press('Escape'); // Modal onClose → UCB:719-721 onDismiss
      await expect(dialog).toHaveCount(0);

      const handoff = page.getByRole('alert').filter({ hasText: CAD.handoffTitle }); // CB:239-258
      await expect(handoff).toContainText(CAD.aiNotice);
      await captureEvidence(page, 'E03_cad_handoff.png');

      await page.getByRole('button', { name: CAD.useCad, exact: true }).click(); // CB:245-251 → UCB:701-705
      const stageTwo = page.getByRole('region', { name: CAD.stageTwo, exact: true }); // CB:343-346
      await expect(stageTwo).toBeVisible();
      await stageTwo.getByRole('button', { name: CAD.collapse, exact: true }).click(); // CB:347-350
      await expect(stageTwo.getByRole('button', { name: CAD.expand, exact: true })).toBeVisible();
      await captureEvidence(page, 'E03_cad_stage_two.png');
    });
  });
});

/* ================================================================= unknown project, every screen */

interface UnknownCase {
  readonly screen: string;
  readonly slug: string;
  readonly path: (id: string) => string;
  readonly check: (page: Page, api: readonly ApiEntry[], id: string) => Promise<void>;
}

const UNKNOWN_CASES: readonly UnknownCase[] = [
  {
    screen: 'SCR-08',
    slug: 'settings',
    path: (id) => ROUTES.project.settings(id),
    check: async (page) => {
      // PS:61-66, 101-107: 404 → title + describeError(notFound) + "Về danh sách dự án" (UPS:1295-1297).
      const alert = page.getByRole('alert').filter({ hasText: LOAD_ERROR_SETTINGS });
      await expect(alert).toContainText(GENERIC_NOT_FOUND);
      await captureEvidence(page, 'E03_unknown_settings.png');
      await alert.getByRole('button', { name: BACK_TO_PROJECTS, exact: true }).click();
      await expect.poll(() => pathOf(page)).toBe(ROUTES.dashboard);
    },
  },
  {
    screen: 'SCR-09',
    slug: 'floors',
    path: (id) => ROUTES.project.floors(id),
    check: async (page) => {
      // FT:200-211 + UFM:1630-1643; FM:95 no session notices / section cut on a load error.
      const alert = page.getByRole('alert').filter({ hasText: NOT_FOUND_TITLE });
      await expect(alert).toContainText(NOT_FOUND_SENTENCE);
      await expect(page.getByRole('region', { name: SECTION_REGION })).toHaveCount(0);
      await captureEvidence(page, 'E03_unknown_floors.png');
      await alert.getByRole('button', { name: BACK_TO_PROJECTS, exact: true }).click();
      await expect.poll(() => pathOf(page)).toBe(ROUTES.dashboard);
    },
  },
  {
    screen: 'SCR-10',
    slug: 'upload',
    path: (id) => ROUTES.project.upload(id),
    check: async (page) => {
      // FU:137-142: load error of the floor list; the alert has no action, the breadcrumb is the way out.
      await expect(page.getByRole('alert').filter({ hasText: UPLOAD_LOAD_ERROR })).toBeVisible();
      await captureEvidence(page, 'E03_unknown_upload.png');
      await page.getByRole('navigation', { name: 'Đường dẫn trang' }).getByRole('button', { name: 'Dự án', exact: true }).click();
      await expect.poll(() => pathOf(page)).toBe(ROUTES.dashboard);
    },
  },
  {
    screen: 'SCR-11',
    slug: 'quality',
    path: (id) => ROUTES.project.quality(id),
    check: async (page) => {
      // IQ:131-144 + UIQ:856-859 isProjectMissing; IQF:57 / UIQ:1038 footer hidden on error.
      const alert = page.getByRole('alert').filter({ hasText: NOT_FOUND_TITLE });
      await expect(alert).toContainText(NOT_FOUND_SENTENCE);
      await expect(page.getByRole('button', { name: QUALITY.continue, exact: true })).toHaveCount(0);
      await captureEvidence(page, 'E03_unknown_quality.png');
      await alert.getByRole('button', { name: BACK_TO_PROJECTS, exact: true }).click();
      await expect.poll(() => pathOf(page)).toBe(ROUTES.dashboard);
    },
  },
  {
    screen: 'SCR-12',
    slug: 'pipeline',
    path: (id) => ROUTES.project.pipeline(id),
    check: async (page) => {
      // UPR:1274-1289 errorAlert = describeError(notFound) (PRG:678-690) + "Thử lại" + code + "Liên hệ hỗ trợ" (PR:243-258).
      const alert = page.getByRole('alert').filter({ hasText: GENERIC_NOT_FOUND });
      await expect(alert).toContainText('Không tìm thấy');
      await expect(alert.getByRole('button', { name: PROCESSING.retry, exact: true })).toBeVisible();
      await captureEvidence(page, 'E03_unknown_pipeline.png');
      await page.getByRole('button', { name: PROCESSING.support, exact: true }).click(); // UPR:790-799 → ROUTES.account
      await expect.poll(() => pathOf(page)).toBe(ROUTES.account);
    },
  },
  {
    screen: 'SCR-13',
    slug: 'graph',
    path: (id) => ROUTES.project.pipelineGraph(id),
    check: async (page, api, id) => {
      // PGG:343-345: no read at all, so a missing project shows the same empty story (no 404 path).
      await expect(page.getByText(GRAPH.emptyTitle, { exact: true })).toBeVisible();
      const reads = api.filter((entry) => entry.path.includes(id)).map((entry) => `${entry.method} ${entry.path} ${String(entry.status)}`);
      expect(reads, 'no request names the unknown project').toEqual([]);
      await captureEvidence(page, 'E03_unknown_graph.png');
      await attachJson('E03_unknown_graph.json', { reads });
    },
  },
];

test.describe('E03 unknown project id (real 404, BE:projects/access.py:28-33)', () => {
  for (const unknownCase of UNKNOWN_CASES) {
    test(`E03 · ${unknownCase.screen} unknown project → its own not-found state and way out`, async ({ browser }) => {
      await withAdmin(browser, async (admin) => {
        const { page, api } = admin;
        const id = unknownProjectId();
        await page.goto(unknownCase.path(id));
        await unknownCase.check(page, api, id);
        const notFound = api.filter((entry) => entry.path.includes(id)).map((entry) => `${entry.method} ${entry.path} ${String(entry.status)}`);
        await attachJson(`E03_unknown_${unknownCase.slug}_requests.json`, { projectId: id, requests: notFound });
      });
    });
  }
});
