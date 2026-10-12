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
 * (MEMBER_USER_UNAVAILABLE /
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
import { randomUUID } from 'node:crypto';
import { closeSync, copyFileSync, existsSync, ftruncateSync, openSync, readFileSync, rmSync, writeFileSync } from 'node:fs';

import { expect, test } from '@playwright/test';
import type { APIRequestContext, Browser, BrowserContext, Locator, Page, Route } from '@playwright/test';

import { ROUTES } from '../../e2e/fixtures/routes';
import { waitForApi, watchApi } from '../../e2e/fullstack/apiWatch';
import type { ApiEntry } from '../../e2e/fullstack/apiWatch';
import { PIPELINE_TIMEOUT_MS, readBaseUrl } from '../../e2e/fullstack/env';
import { newApiContext } from './support/api';
import { ensureAdminSession, readAdminCredentials } from './support/auth';
import {
  createMeasuredFloorsProject,
  createPipelineDrawingProject,
  createSkewedDrawingProject,
  rotatedPng,
  SKEW_DEG,
} from './support/drawingSeed';
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
const EMPTY_BLOCKED = 'Giá trị đã lưu không xoá trống được; hãy nhập giá trị khác.'; // SE:113 (FIX-1420, BUG-299), UPS:433-446
const NOTES_TOO_LONG = 'Ghi chú không quá 500 ký tự.'; // UPS:451-452, PSG:191
const SAVE_FAILURE_TITLE = 'Chưa lưu hết'; // PS:98
/** BUG-356 (FIX-1622): bidi / control characters are refused at the field, naming the code point (UPS:422-438). */
const NOTES_BIDI = 'Ghi chú có ký tự đảo chiều chữ (U+202E); hãy xoá ký tự đó.'; // UPS:436,477
const NAME_BIDI = 'Tên dự án có ký tự đảo chiều chữ (U+202E); hãy xoá ký tự đó.'; // UPS:436,450
const UNSAVED_PROBLEMS = 'Chưa lưu vì còn ô cần sửa'; // SE:112, UPS:1361 save indicator while a local problem blocks
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
const CAD_PILL = 'Bản vẽ CAD · độ chính xác cao'; // FUC:41 (FIX-1404, BUG-304)
const CAD_SENTENCE = 'Bản vẽ CAD (.dwg) chưa được hỗ trợ; hãy xuất sang PDF rồi tải lại.'; // FUG:85
const UPLOAD_EMPTY = 'Chưa có tầng nào có bản vẽ. Kéo thả tệp đầu tiên để bắt đầu.'; // UFU:105
const NO_FLOORS_TITLE = 'Dự án chưa có tầng nào'; // FU:76
const NO_FLOORS_ADD = 'Thêm tầng'; // FU:80 ADD_FLOORS_LABEL (FIX-1400, BUG-298)
const BLOCKED_TITLE = 'Không thể bắt đầu xử lý'; // UFU:115 COPY.blockedTitle
const NO_FLOORS_REASON = 'Dự án chưa có tầng nào. Thêm tầng ở màn Quản lý tầng trước khi xử lý.'; // UFU:117 (BUG-298)
const UPLOAD_LOAD_ERROR = 'Không tải được danh sách tầng'; // FU:69 — not for a 404 any more (FIX-1401, BUG-311)
const SELECT_FILE = 'Chọn tệp'; // UFU:100
const PICK_PAGE = 'Chọn trang'; // FUC:40
const DISMISS = 'Đóng'; // FUC:45, FUT:21

/* SCR-11 / 12 / 13 / 15 copy. */
const QUALITY = {
  noDrawingTitle: 'Chưa có bản vẽ để kiểm tra', // IQ:62
  noDrawingNotice: 'Dự án chưa có bản vẽ nào được tải lên, nên chưa có gì để đo.', // UIQ:153
  uploadAction: 'Tải bản vẽ lên', // IQ:63
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
  reviewWalls: 'Duyệt lớp tường', // PSU:19
  summary: 'Báo cáo tổng kết', // PSU:18 section aria-label
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

/**
 * BUG-307: the stack total counts up/down after a change (UFM:629 `useCountUp`, 260 ms) and is drawn twice (FSC:141, FT:319).
 * Waits for the footer to read the final `{floors} tầng · tổng cao {metres}` before a shot, so it is not a mid-count frame.
 */
const expectSettledTotal = (page: Page, floors: number, metres: string): Promise<void> =>
  expect(page.getByText(new RegExp(`^${String(floors)}\\s+tầng\\s+·\\s+tổng cao\\s+${escapeRegExp(metres)}\\s+m\\s+·`, 'u'))).toBeVisible();

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

  test('E03 · SCR-08 "Ghi chú" with a bidi mark → refused at the field (U+202E), "Chưa lưu vì còn ô cần sửa", no PUT (BUG-356)', async ({ browser }) => {
    await withAdmin(browser, async (admin) => {
      const { page, api } = admin;
      const project = await createProject(admin, 'notesbidi');
      await openSettings(page, project);
      const mark = api.length;
      // Same rule as BE:project_settings/schemas.py:24-31 (packages/core/text.py first_forbidden_char), now local
      // (UPS:422-438,473-478): one field sentence that names the code point instead of a server 422.
      await page.getByRole('textbox', { name: NOTES_LABEL, exact: true }).fill('qa \u202Eghi chú');
      await expect(page.getByText(NOTES_BIDI, { exact: true })).toBeVisible();
      await expect(page.getByRole('status').filter({ hasText: UNSAVED_PROBLEMS })).toBeVisible(); // UPS:1361
      await quiet(page);
      // UPS:909 a local problem blocks the autosave: no request, so no "Chưa lưu hết" box either.
      expect(countSince(api, mark, 'PUT', settingsRe(project.id)), 'a refused character sends no PUT').toBe(0);
      await expect(page.getByRole('alert').filter({ hasText: SAVE_FAILURE_TITLE })).toHaveCount(0);
      await captureEvidence(page, 'E03_settings_notes_bidi_blocked.png');
    });
  });

  test('E03 · SCR-08 "Tên dự án" with a bidi mark → refused at the field (U+202E), "Chưa lưu vì còn ô cần sửa", no PATCH (BUG-356)', async ({ browser }) => {
    await withAdmin(browser, async (admin) => {
      const { page, api } = admin;
      const project = await createProject(admin, 'namebidi');
      await openSettings(page, project);
      const mark = api.length;
      // Same rule as BE:projects/schemas.py:33-43 (clean_text, bidi_marks), now local: nameProblemFor UPS:441-451.
      await page.getByRole('textbox', { name: NAME_LABEL, exact: true }).fill(`${project.name}\u202E`);
      await expect(page.getByText(NAME_BIDI, { exact: true })).toBeVisible();
      await expect(page.getByRole('status').filter({ hasText: UNSAVED_PROBLEMS })).toBeVisible();
      await quiet(page);
      expect(countSince(api, mark, 'PATCH', projectRe(project.id)), 'a refused character sends no PATCH').toBe(0);
      await expect(page.getByRole('alert').filter({ hasText: SAVE_FAILURE_TITLE })).toHaveCount(0);
      await captureEvidence(page, 'E03_settings_name_bidi_blocked.png');
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
      // UPS:1024-1030: a 409 with nothing saved shows only the conflict strip, no second "Chưa lưu hết" (FIX-1422, BUG-300).
      await expect(page.getByRole('alert').filter({ hasText: SAVE_FAILURE_TITLE })).toHaveCount(0);
      await captureEvidence(page, 'E03_settings_conflict_409.png');

      // UPS:1360-1367: unsaved draft → A9 dialog first.
      await alert.getByRole('button', { name: 'Tải lại', exact: true }).click();
      const dialog = page.getByRole('dialog', { name: RELOAD_DIALOG, exact: true });
      await expect(dialog).toBeVisible();
      await dialog.getByRole('button', { name: 'Giữ thay đổi', exact: true }).click();
      await expect(dialog).toHaveCount(0);
      await expect(notes).toHaveValue(uiNotes);
      // QA-03d S24: RD:17-23 Modal onClose → cancelReload — Esc closes the dialog like "Giữ thay đổi", the draft stays.
      await alert.getByRole('button', { name: 'Tải lại', exact: true }).click();
      await expect(dialog).toBeVisible();
      await page.keyboard.press('Escape');
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
      // BUG-358: shoot the LOADED dashboard (a card or the "never had a project" state — ProjectDashboard.tsx:109,243), not
      // its skeleton, and prove the deleted project's card is gone (`<article role="listitem" aria-label={name}>`).
      const list = page.getByRole('list', { name: 'Danh sách dự án', exact: true });
      await expect(list.getByRole('listitem').first().or(page.getByText('Chưa có dự án nào', { exact: true }))).toBeVisible();
      await expect(list.getByRole('listitem', { name: project.name, exact: true })).toHaveCount(0);
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
      await expectSettledTotal(page, 3, '9,0'); // 3 × 3 m restored
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
      await expectSettledTotal(page, 3, '9,0'); // 3 × 3 m restored
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
      await row.getByRole('button', { name: 'Tải lên', exact: true }).click(); // FTR:318-327
      await expect.poll(() => pathOf(page)).toBe(ROUTES.project.upload(project.id)); // FMC handleNavigateToDrawings
      // BUG-310: the shot shows where "Tải lên" led (the upload screen with this floor's card), not the untouched table.
      await expect(card(page, floor)).toBeVisible();
      await captureEvidence(page, 'E03_floors_upload_link.png');
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
  test('E03 · SCR-10 project with no floor → "Dự án chưa có tầng nào" + "Thêm tầng", no drop zone; "Bắt đầu xử lý" says why (BUG-298); breadcrumb → "/"', async ({ browser }) => {
    await withAdmin(browser, async (admin) => {
      const { page, api } = admin;
      const project = await createProject(admin, 'unofloor');
      await page.goto(ROUTES.project.upload(project.id));
      await expect(page.getByText(NO_FLOORS_TITLE, { exact: true })).toBeVisible(); // FU:149-150
      await expect(page.getByTestId(COUNTER)).toHaveText('0 / 0 tầng đã có bản vẽ'); // FUF:99-106, UFU:1138-1140
      // FU:160-166 EmptyState action "Thêm tầng" → Quản lý tầng (UFU:1304-1307); UFU:437 canDrop is false with no floor,
      // so FU:229-235 renders no drop zone (a file dropped here could not wait for a floor) (FIX-1400, BUG-298).
      await expect(page.getByRole('button', { name: NO_FLOORS_ADD, exact: true })).toBeVisible();
      await expect(page.getByTestId(DROPZONE)).toHaveCount(0);

      const mark = api.length;
      await page.getByRole('button', { name: SUBMIT, exact: true }).click();
      await quiet(page);
      // UFU:933-934: no floor → one project-level `noFloors` reason; the footer (FUF:72-87) names it, no navigation.
      const notice = page.getByTestId(BLOCK_NOTICE);
      await expect(notice).toContainText(BLOCKED_TITLE);
      await expect(notice).toContainText(NO_FLOORS_REASON);
      expect(pathOf(page)).toBe(ROUTES.project.upload(project.id));
      expect(writesSince(api, mark)).toEqual([]);
      await captureEvidence(page, 'E03_upload_no_floor_submit.png');
      await attachJson('E03_upload_no_floor_submit.json', { path: pathOf(page), writes: writesSince(api, mark), blockNotice: 1 });

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

  test('E03 · SCR-10 3-page .pdf assigned to a floor waits for "Chọn trang" (no init); submit says "… chưa chọn trang của bản vẽ." (BUG-303)', async ({ browser }, testInfo) => {
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
      await expect(page.getByTestId(BLOCK_NOTICE)).toContainText(`${floor.name} chưa chọn trang của bản vẽ.`); // UFU:945-961 (FIX-1403, BUG-303)
      await captureEvidence(page, 'E03_upload_pdf_pick_page.png');
    });
  });

  test('E03 · SCR-10 .dwg (not offered by the picker) assigned → server 422 → CAD sentence on the card, no CAD pill (BUG-304); "Đóng" clears it', async ({ browser }, testInfo) => {
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
      await expect(floorCard.getByRole('alert')).toContainText(CAD_SENTENCE); // FUG:194-199, FUC:285-297
      // UFU:1074 isCadBranch = branch 'cad' && status !== 'error' → a refused file is not promised the CAD branch
      // (FUC:237-241, FIX-1404, BUG-304).
      await expect(floorCard.getByText(CAD_PILL, { exact: true })).toHaveCount(0);
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
      // BUG-310: the local removal itself on record (its toast, UFU:879-884) and still no request; then the reload below
      // shows the server copy back.
      await expect(toastWith(page, `Đã xoá bản vẽ ${file}`).first()).toBeVisible();
      expect(writesSince(api, mark), 'the second removal sends no request either').toEqual([]);
      await captureEvidence(page, 'E03_upload_remove_local_before_reload.png');
      await page.reload();
      await expect(card(page, floor).getByText(ATTACHED, { exact: true })).toBeVisible(); // UFU:1045-1050 server drawing
      // FUC:82-86: a server-side drawing offers nothing to remove → no menu button at all.
      await expect(menuButton).toHaveCount(0);
      await captureEvidence(page, 'E03_upload_remove_is_local.png');
      await attachJson('E03_upload_remove_is_local.json', { writesDuringRemoveAndUndo: localWrites, afterReload: ATTACHED });
    });
  });

  test('E03 · SCR-10 every floor attached → "Bắt đầu xử lý" opens /pipeline with no request; SCR-12 log copy; "Báo cáo tổng kết" offers "Hiệu chỉnh tỷ lệ" + "Duyệt lớp tường" (BUG-285)', async ({ browser }) => {
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
        // BUG-361: the copy now toasts "Đã chép nhật ký" (useProcessingScreen.ts:153,817-820); the shot also carries what the clipboard holds.
        await expect(page.getByText('Đã chép nhật ký', { exact: true })).toBeVisible();
        const copiedLines = copied === '' ? [] : copied.split('\n');
        await captureEvidence(page, 'E03_pipeline_submit_log_copy.png', {
          caption: [
            `"${PROCESSING.copyLog}" clicked → clipboard: ${String(copiedLines.length)} line(s)${emptyLog ? ' (empty log)' : ''}`,
            ...copiedLines.slice(0, 4),
          ],
        });
        await attachJson('E03_pipeline_submit_log_copy.json', {
          submitWrites,
          logEmpty: emptyLog,
          copiedLineCount: copied === '' ? 0 : copied.split('\n').length,
        });

        // FIX-1380 (BUG-285, was finding F10): PRG:808 `extractionSummary: true`, PRG:1006 reads N16 spatial/layer once a
        // floor is done (UPR:733-745); UPR:1208-1276 shows the summary as soon as one floor is done, numbers or not (an
        // N16 failure only drops the counts), and both actions go to that floor (PSU:47-53).
        const summary = page.getByRole('region', { name: PROCESSING.summary, exact: true });
        await expect(summary).toBeVisible();
        await expect(summary.getByRole('button', { name: PROCESSING.reviewWalls, exact: true })).toBeVisible();
        const calibrate = summary.getByRole('button', { name: PROCESSING.calibrate, exact: true });
        await expect(calibrate).toBeVisible();
        await captureEvidence(page, 'E03_pipeline_done_summary.png');
        await calibrate.click();
        await expect.poll(() => pathOf(page)).toBe(ROUTES.project.scale(project.id, floor.id));
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
      // BE:quality/assessments.py:273-275 404 `upload` → UIQ:517-521 null → empty state (IQ:136-144).
      await expect(page.getByText(QUALITY.noDrawingTitle, { exact: true })).toBeVisible();
      await expect(page.getByText(QUALITY.noDrawingNotice, { exact: true })).toBeVisible();
      const proceed = page.getByRole('button', { name: QUALITY.continue, exact: true });
      await expect(proceed).toHaveAttribute('aria-disabled', 'true'); // IQF:70-77, UIQ:1020-1027
      await expect(proceed).toHaveAccessibleDescription(QUALITY.noDrawingReason); // IQF:60-71 aria-describedby
      await proceed.click({ force: true }); // aria-disabled: Playwright treats it as not enabled; IQF:73 drops onClick
      await quiet(page);
      expect(pathOf(page), 'aria-disabled continue does not navigate').toBe(ROUTES.project.quality(project.id));
      await captureEvidence(page, 'E03_quality_no_drawing.png');

      await page.getByRole('button', { name: QUALITY.uploadAction, exact: true }).click(); // IQ:137-140 → UIQ:1270
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
      await secondary.click();
      await expect.poll(() => pathOf(page)).toBe(ROUTES.project.upload(project.id));
      // BUG-309: shot of the click's result (the upload screen), not of the quality page E03_quality_no_drawing already shows.
      await expect(page.getByTestId(DROPZONE)).toBeVisible();
      await captureEvidence(page, 'E03_quality_footer_nav.png');
      await page.goBack();
      await expect.poll(() => pathOf(page)).toBe(ROUTES.project.quality(project.id));
      await page.getByRole('navigation', { name: 'Đường dẫn trang' }).getByRole('button', { name: 'Dự án', exact: true }).click(); // IQ:193-198 (breadcrumb, BUG-362 adds the project level)
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
  test('E03 · SCR-13 own project: empty story + reason line; no "Chi tiết kỹ thuật", no branch switch; only the #24 project read', async ({ browser }) => {
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
      // PGG:304-312 (FIX-1384, BUG-313): the one read is #24 "does this project exist"; branch report / comparison / node
      // detail are still answered "unsupported" without a request (PGG:356-358).
      expect(projectReads, 'the graph reads only #24 for this project').toEqual([`GET ${PROJECTS_API}/${project.id}`]);
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
      // FU:140-153 + UFU:1200-1208: a 404 floor list = the project is missing → the FloorManager / quality wording
      // (PSGATE:36-39) and one way out, not the generic load error; no "Thử lại", no drop zone (FIX-1401, BUG-311).
      const alert = page.getByRole('alert').filter({ hasText: NOT_FOUND_TITLE });
      await expect(alert).toContainText(NOT_FOUND_SENTENCE);
      await expect(page.getByText(UPLOAD_LOAD_ERROR, { exact: true })).toHaveCount(0);
      await expect(alert.getByRole('button', { name: PROCESSING.retry, exact: true })).toHaveCount(0);
      await expect(page.getByTestId(DROPZONE)).toHaveCount(0);
      await captureEvidence(page, 'E03_unknown_upload.png');
      await alert.getByRole('button', { name: BACK_TO_PROJECTS, exact: true }).click();
      await expect.poll(() => pathOf(page)).toBe(ROUTES.dashboard);
    },
  },
  {
    screen: 'SCR-11',
    slug: 'quality',
    path: (id) => ROUTES.project.quality(id),
    check: async (page) => {
      // IQ:122-135 + UIQ:856-859 isProjectMissing; IQF:57 / UIQ:1038 footer hidden on error.
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
      // UPR:752-757 N7 or #24 404 `project` → state 'error'; UPR:1315-1326 + PR:250-257: one InlineAlert with the
      // PSGATE:36-39 wording and "Về danh sách dự án" — no "Thử lại", no technical code, no "Liên hệ hỗ trợ", and
      // PR:275 drops the chips / steps / summary line (FIX-1385, BUG-312).
      const alert = page.getByRole('alert').filter({ hasText: NOT_FOUND_TITLE });
      await expect(alert).toContainText(NOT_FOUND_SENTENCE);
      await expect(page.getByText(GENERIC_NOT_FOUND, { exact: false })).toHaveCount(0);
      await expect(page.getByRole('button', { name: PROCESSING.retry, exact: true })).toHaveCount(0);
      await expect(page.getByRole('button', { name: PROCESSING.support, exact: true })).toHaveCount(0);
      await expect(page.getByText('NOT_FOUND', { exact: false })).toHaveCount(0);
      await captureEvidence(page, 'E03_unknown_pipeline.png');
      await alert.getByRole('button', { name: BACK_TO_PROJECTS, exact: true }).click(); // UPR:1323-1325
      await expect.poll(() => pathOf(page)).toBe(ROUTES.dashboard);
    },
  },
  {
    screen: 'SCR-13',
    slug: 'graph',
    path: (id) => ROUTES.project.pipelineGraph(id),
    check: async (page, api, id) => {
      // PGG:304-312 readProjectExists = #24 GET /api/projects/{id}; a 404 `project` → false → PG:136-148 renders only
      // the PSGATE:36-39 not-found strip, never the empty graph story; PGC:136-139 → "/" (FIX-1384, BUG-313).
      const alert = page.getByRole('alert').filter({ hasText: NOT_FOUND_TITLE });
      await expect(alert).toContainText(NOT_FOUND_SENTENCE);
      await expect(page.getByText(GRAPH.emptyTitle, { exact: true })).toHaveCount(0);
      const reads = api.filter((entry) => entry.path.includes(id)).map((entry) => `${entry.method} ${entry.path} ${String(entry.status)}`);
      expect(reads, 'the project read #24 answered 404').toContain(`GET ${PROJECTS_API}/${id} 404`);
      await captureEvidence(page, 'E03_unknown_graph.png');
      await attachJson('E03_unknown_graph.json', { reads });
      await alert.getByRole('button', { name: BACK_TO_PROJECTS, exact: true }).click();
      await expect.poll(() => pathOf(page)).toBe(ROUTES.dashboard);
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

/* ================================================================= QA-03d gap rows (coverage/phase03.md @ 39016134) */
/*
 * One test per inventory gap row (row id in the title). Same rules as the rest of this file: own admin context, own
 * `qa-<runId>-e03-…` project(s) deleted in `finally`. Seeds that need a drawing use `support/drawingSeed.ts` with this
 * test's Bearer (`seedApi`); the seeded project goes to the same cleanup list.
 *
 * Mocks added here (each named "[mocked response]", each unpairable — see the inventory's mock table): settings read
 * 500 (S36), member add 429 (S35), upload project read 500 (U30), upload chunk 500 (U17), quality read 500 (Q14),
 * quality read with the focus floor still measuring (Q18, the real #30 body with one floor flipped), processing N7
 * 500 (P13). "Held" requests (S38, F28r, U16/U20, U35) are NOT mocks: the real request is only delayed, then goes
 * through and gets the real response.
 *
 * Budget added by this section: `POST /api/projects` 41 (+ deletes); `drawings_init` ≈ 18 (U12 1, U16 1, U17 2, U18 1,
 * U19 2, U32 1, Q3 2, Q15 1, Q16 1, Q18 1, Q20 1, P8 1, P15 1, P18 1) — with the 3 above, ≈ 21 of 60 per 600 s;
 * ≈ 13 fake-ML runs; `members_add` 1 real (S32, skipped without an active non-admin user) + 1 mocked; `POST
 * /api/projects/:id/floors` 2 by API (F32r races). No mail is sent except the member-added notice of S32 (Mailpit).
 */

const FIELD_REJECTED = 'Giá trị này chưa hợp lệ nên chưa được lưu; hãy sửa lại.'; // SE:110 (BUG-356)
const SAVE_CHIP_REJECTED = 'Chưa lưu vì còn ô cần sửa'; // SE:117 chipRejected (UPS:882-887)
const FLOOR_TEXT = {
  sameName: 'Tên tầng không đổi nên không có gì để lưu.', // FMG:878
  addRefused: 'Chưa thêm được tầng', // UFM:187
  persistFailed: 'Chưa lưu được thay đổi tầng', // UFM:181
  undoRefused: 'Chưa hoàn tác được thay đổi tầng', // UFM:189
  limit: 'Dự án đã đủ 50 tầng, thao tác vừa rồi đã được huỷ.', // UFM:191
  listChanged: 'Danh sách tầng vừa đổi ở nơi khác, thứ tự chưa được lưu.', // UFM:192
  undoExpired: 'Đã quá thời gian khôi phục tầng, tầng đã xoá không lấy lại được.', // UFM:196
  contents:
    'Tường, phòng và nội thất đi theo khi nhân bản hay xoá tầng chưa được lưu; tải lại trang sẽ mất phần thay đổi đó.', // FMG:210-211
  captionManual: 'Cao độ đang nhập tay; ô ghi "Ghi đè" khác cao độ tính từ các tầng dưới.', // FT:83
  captionAuto: 'Cao độ tính tự động từ chiều cao các tầng dưới.', // FT:82
} as const;
/** UFM:205 FLOOR_RESTORE_WINDOW_MS. */
const FLOOR_RESTORE_WINDOW_MS = 570_000;
const AUTO_MATCH = 'Ghép tự động từ tên tệp — kiểm tra lại'; // UFU:102
const UPLOADING = 'Đang tải lên'; // UFU:122
const OFFLINE_BANNER = 'Đang làm việc ngoại tuyến'; // UFU:108
const AWAIT_NETWORK =
  'Đang ngoại tuyến: tệp sẽ tự tải lên khi có mạng trở lại; nếu tải lại trang thì cần chọn lại tệp'; // UFU:265-266
const QUALITY_LOAD_ERROR = 'Không đọc được kết quả kiểm tra chất lượng'; // IQ:58
const QUALITY_WRITE_ERROR = 'Chưa xử lý được bản vẽ'; // IQ:66
const QUALITY_WRITE_FALLBACK = 'Chưa xử lý được bản vẽ; hãy thử lại.'; // UIQ:154
const REPORT_REGION = 'Báo cáo chất lượng'; // IQR:281
const REGION_GROUP = 'Vùng có vấn đề trên bản vẽ'; // IQO:32
const CHIPS_LIST = 'Tiến độ theo tầng'; // PFC:20
const OBJECTS_LIST = 'Số đối tượng đã nhận theo tầng'; // PR:77
const STEP_BAR = 'Bước đang xử lý'; // PSB:29
const ALL_STEPS = 'Xem tất cả các bước'; // PR:87
const BACKGROUND_STARTED = 'Sẽ báo cho bạn khi xử lý xong'; // UPR:152

/** Bearer request context for the `drawingSeed.ts` fixtures (they take an `APIRequestContext`). Caller disposes it. */
const seedApi = (admin: Admin): Promise<APIRequestContext> => newApiContext({ Authorization: `Bearer ${admin.token}` });

/** W4 level id `L-<base36 UPPER>` (BE packages/core/ids.py) for a floor written through the API (#10). */
const newLevelId = (): string => `L-${randomUUID().replace(/-/gu, '').toUpperCase().slice(0, 24)}`;

/** A floor added "elsewhere" through the real #10 (BE floors/router.py:30-35), as the API spec's `floorBody`. */
async function addFloorByApi(admin: Admin, project: ProjectRef, order: number): Promise<void> {
  const res = await admin.context.request.post(`${PROJECTS_API}/${project.id}/floors`, {
    headers: bearer(admin),
    data: { id: newLevelId(), name: `${TEST_DATA_PREFIX}api-${String(order)}`, order, elevationMm: order * FLOOR_HEIGHT_MM, heightMm: FLOOR_HEIGHT_MM },
  });
  expect(res.status(), `the other writer: POST ${PROJECTS_API}/:id/floors`).toBe(201);
}

/** Project with free-form floor drafts (#25 `floors`, BE projects/schemas.py:56-66) — for stacks `createProject` never builds. */
async function createProjectWithFloors(
  admin: Admin,
  slug: string,
  floors: readonly { readonly name: string; readonly elevationMm: number; readonly heightMm: number }[],
): Promise<ProjectRef> {
  const name = `${TEST_DATA_PREFIX}e03-${slug}-${uniq()}`;
  const created = await admin.context.request.post(PROJECTS_API, {
    headers: bearer(admin),
    data: { name, floors: floors.map((floor, order) => ({ ...floor, order })) },
  });
  expect(created.status(), `fixture POST ${PROJECTS_API} "${name}": ${(await created.text()).slice(0, 300)}`).toBe(201);
  const id = stringField(await created.json(), 'id', 'POST /api/projects');
  admin.cleanup.push(id);
  return readProjectRef(admin, id);
}

/** `GET /api/projects/:id` → floors in order (ids never invented). */
async function readProjectRef(admin: Admin, id: string): Promise<ProjectRef> {
  const read = await admin.context.request.get(`${PROJECTS_API}/${id}`, { headers: bearer(admin) });
  expect(read.status(), `fixture GET ${PROJECTS_API}/${id}`).toBe(200);
  const body = asRecord(await read.json(), 'GET /api/projects/:id');
  const floors = (Array.isArray(body.floors) ? body.floors : [])
    .map((floor, index) => {
      const record = asRecord(floor, `floors[${String(index)}]`);
      return { id: stringField(record, 'id', 'floor'), name: stringField(record, 'name', 'floor'), order: typeof record.order === 'number' ? record.order : index };
    })
    .sort((first, second) => first.order - second.order)
    .map(({ id: floorId, name }) => ({ id: floorId, name }));
  return { id, name: stringField(body, 'name', 'project'), floors };
}

/** A `drawingSeed.ts` project made with this admin's Bearer, handed to its cleanup, floors read back. */
async function seeded(admin: Admin, seed: (api: APIRequestContext) => Promise<string>): Promise<ProjectRef> {
  const api = await seedApi(admin);
  try {
    const projectId = await seed(api);
    admin.cleanup.push(projectId);
    return await readProjectRef(admin, projectId);
  } finally {
    await api.dispose();
  }
}

/**
 * Holds the FIRST request that `match`es until `release()`, then lets it through to the real backend (`route.continue`):
 * a delay, not a mocked response. Later matching requests pass at once.
 */
async function holdFirst(page: Page, match: (url: URL, method: string) => boolean): Promise<{ readonly seen: Promise<void>; release: () => Promise<void> }> {
  let open: () => void = () => undefined;
  let seenResolve: () => void = () => undefined;
  const gate = new Promise<void>((resolve) => (open = resolve));
  const seen = new Promise<void>((resolve) => (seenResolve = resolve));
  let held = false;
  const handler = async (route: Route): Promise<void> => {
    const request = route.request();
    if (held || !match(new URL(request.url()), request.method())) {
      await route.fallback();
      return;
    }
    held = true;
    seenResolve();
    await gate;
    await route.continue().catch(() => undefined);
  };
  await page.route('**/api/**', handler);
  return {
    seen,
    release: async () => {
      open();
      await page.unroute('**/api/**', handler);
    },
  };
}

/** Records every text the app announcer (`[data-announcer]`, src/lib/input/announcer.ts:52-57) writes; install before `goto`. */
async function recordAnnouncements(page: Page): Promise<() => Promise<string[]>> {
  await page.addInitScript(() => {
    const seen: string[] = [];
    (window as unknown as { __qaAnnounced: string[] }).__qaAnnounced = seen;
    new MutationObserver(() => {
      for (const node of document.querySelectorAll('[data-announcer]')) {
        const text = node.textContent?.trim() ?? '';
        if (text !== '' && !seen.includes(text)) seen.push(text);
      }
    }).observe(document, { subtree: true, childList: true, characterData: true });
  });
  return () => page.evaluate(() => (window as unknown as { __qaAnnounced?: string[] }).__qaAnnounced ?? []);
}

/** Header save indicator (PS:79 `SaveIndicator`, role="status"). */
const saveIndicator = (page: Page): Locator => page.locator('header').getByRole('status');

const projectReadRe = (id: string): RegExp => projectRe(id);

/* ---------------------------------------------------------------- SCR-08 gap rows */

test.describe('E03 SCR-08 project settings — gap rows (QA-03d)', () => {
  test('E03 · SCR-08 [S3] "Chung" tab badge counts the fields that block the autosave (4), "Đơn vị đo" none', async ({ browser }) => {
    await withAdmin(browser, async (admin) => {
      const { page } = admin;
      const project = await createProject(admin, 'badge', 0, { code: 'QA-B3', address: 'qa địa chỉ badge' });
      await openSettings(page, project);
      const tablist = page.getByRole('tablist', { name: SETTINGS_TABS, exact: true });
      const general = tablist.getByRole('tab', { name: /^Chung/u });
      await expect(general).toHaveText('Chung'); // Tabs.tsx:143 a badge only when > 0
      await page.getByRole('textbox', { name: NAME_LABEL, exact: true }).fill('');
      await page.getByRole('textbox', { name: CODE_LABEL, exact: true }).fill('');
      await page.getByRole('textbox', { name: ADDRESS_LABEL, exact: true }).fill('');
      await page.getByRole('textbox', { name: NOTES_LABEL, exact: true }).fill('a'.repeat(501));
      // UPS:834 generalProblemCount = name + code + address + notes; PS:124 `badge={tab.problemCount}`.
      await expect(general).toHaveText(/^Chung\s*4$/u);
      await expect(tablist.getByRole('tab', { name: /^Đơn vị đo/u })).toHaveText('Đơn vị đo');
      await captureEvidence(page, 'E03_settings_tab_badge.png');
    });
  });

  test('E03 · SCR-08 [S14] "Loại công trình" → "Công nghiệp" → PUT settings buildingType "industrial"; kept after reload', async ({ browser }) => {
    await withAdmin(browser, async (admin) => {
      const { page, api } = admin;
      const project = await createProject(admin, 'btype');
      await openSettings(page, project);
      const select = page.getByRole('combobox', { name: 'Loại công trình', exact: true }); // GT:64-70
      const mark = api.length;
      const put = waitForApi(page, 'PUT', settingsRe(project.id), [200]);
      await select.click();
      await page.getByRole('option', { name: 'Công nghiệp', exact: true }).click(); // UPS:517-523
      const body = asRecord(asRecord((await put).response.request().postDataJSON() as unknown, 'PUT').body, 'PUT body');
      expect(body.buildingType, 'UPS:1427 setBuildingType → N6 body').toBe('industrial');
      expect(countSince(api, mark, 'PATCH', projectRe(project.id)), 'building type is not a #26 field').toBe(0);
      await expect(toastWith(page, SAVED_TOAST).first()).toBeVisible();
      await page.reload();
      await expect(page.getByRole('combobox', { name: 'Loại công trình', exact: true })).toContainText('Công nghiệp');
      await captureEvidence(page, 'E03_settings_building_type.png');
    });
  });

  test('E03 · SCR-08 [S19] "Mã dự án" of three spaces passes the field, server 422 `code` → one sentence at the field, no "Chưa lưu hết"', async ({ browser }) => {
    await withAdmin(browser, async (admin) => {
      const { page } = admin;
      const project = await createProject(admin, 'code422');
      await openSettings(page, project);
      // UPS:458-465 codeProblemFor checks length + forbidden characters of the trimmed text only; PSG:267-277 sends
      // the untrimmed "   " and BE projects/schemas.py ProjectCode (strip → min_length 1) refuses it.
      const patch = waitForApi(page, 'PATCH', projectRe(project.id), [422]);
      await page.getByRole('textbox', { name: CODE_LABEL, exact: true }).fill('   ');
      const { json } = await patch;
      expect(asRecord(json, '422').field, 'BE names the field').toBe('code');
      await expect(page.getByText(FIELD_REJECTED, { exact: true })).toHaveCount(1); // UPS:976-979, SE:110
      await expect(page.getByRole('alert').filter({ hasText: SAVE_FAILURE_TITLE })).toHaveCount(0); // UPS:1058-1066
      await expect(saveIndicator(page)).toContainText(SAVE_CHIP_REJECTED); // UPS:882-887
      await captureEvidence(page, 'E03_settings_code_422_field.png');
      await attachJson('E03_settings_code_422_field.json', { response: json as Json });
    });
  });

  test('E03 · SCR-08 [S20] "Ghi chú" of only spaces → server 422 `body.notes` → the sentence under "Ghi chú", no "Chưa lưu hết"', async ({ browser }) => {
    await withAdmin(browser, async (admin) => {
      const { page } = admin;
      const project = await createProject(admin, 'notes422');
      await openSettings(page, project);
      // UPS:473-477 notesProblemFor: length ≤ 500 and no forbidden character in the trimmed text → accepted; PSG:280-290
      // sends notes "   " (only "" is dropped); BE project_settings/schemas.py Notes strips → "" → min_length 1 → 422.
      const put = waitForApi(page, 'PUT', settingsRe(project.id), [422]);
      await page.getByRole('textbox', { name: NOTES_LABEL, exact: true }).fill('   ');
      const { json } = await put;
      expect(asRecord(json, '422').field).toBe('body.notes'); // SE:94 PROBLEM_KEY_BY_WIRE_FIELD
      await expect(page.getByText(FIELD_REJECTED, { exact: true })).toHaveCount(1);
      await expect(page.getByRole('alert').filter({ hasText: SAVE_FAILURE_TITLE })).toHaveCount(0);
      await captureEvidence(page, 'E03_settings_notes_422_field.png');
      await attachJson('E03_settings_notes_422_field.json', { response: json as Json });
    });
  });

  test('E03 · SCR-08 [S21] name + code in one PATCH, 422 on `code` → "Chưa lưu hết": "Chưa lưu được tên dự án và mã dự án. …"', async ({ browser }) => {
    await withAdmin(browser, async (admin) => {
      const { page } = admin;
      const project = await createProject(admin, 'mixed422');
      await openSettings(page, project);
      const patch = waitForApi(page, 'PATCH', projectRe(project.id), [422]);
      // Both edits inside one 800 ms autosave window (UPS:16) → one #26 body with name and code.
      await page.getByRole('textbox', { name: NAME_LABEL, exact: true }).fill(`${project.name}x`.slice(-80));
      await page.getByRole('textbox', { name: CODE_LABEL, exact: true }).fill('   ');
      const { response } = await patch;
      const sent = asRecord(response.request().postDataJSON() as unknown, 'PATCH body');
      expect(Object.keys(sent).sort(), 'one PATCH carries name and code').toEqual(['code', 'name']);
      // UPS:1040-1066: the name has no sentence of its own → the box names every unsaved field, SE:150-160 + NEXT_STEP.
      const box = page.getByRole('alert').filter({ hasText: SAVE_FAILURE_TITLE });
      await expect(box).toContainText('Chưa lưu được tên dự án và mã dự án. Sửa lại giá trị đó, hệ thống sẽ tự lưu tiếp.');
      await expect(page.getByText(FIELD_REJECTED, { exact: true })).toHaveCount(1); // only at "Mã dự án"
      await captureEvidence(page, 'E03_settings_mixed_422_box.png');
    });
  });

  test('E03 · SCR-08 [S26 S28] "Đơn vị diện tích" line; "Ngưỡng tin cậy" refuses 1,5 and -1, Escape restores, 0,5 saves as "50%"', async ({ browser }) => {
    await withAdmin(browser, async (admin) => {
      const { page, api } = admin;
      const project = await createProject(admin, 'confidence');
      await openSettings(page, project);
      await settingsTab(page, 'Đơn vị đo').click();
      await expect(page.getByText('Mét vuông — ví dụ 248,60 m²', { exact: true })).toBeVisible(); // UPS:1392, UT:53-56
      const field = page.getByRole('textbox', { name: 'Ngưỡng tin cậy', exact: true }); // UT:70-79
      const before = await field.inputValue();
      const mark = api.length;
      await field.fill('1,5');
      await expect(page.getByText('Giá trị không quá 1.', { exact: true })).toBeVisible(); // NF:67-72, PSG:194-195
      await field.fill('-1');
      await expect(page.getByText('Giá trị không nhỏ hơn 0.', { exact: true })).toBeVisible();
      await captureEvidence(page, 'E03_settings_confidence_refused.png');
      await field.press('Escape');
      await expect(field).toHaveValue(before);
      await quiet(page);
      expect(countSince(api, mark, 'PUT', settingsRe(project.id)), 'refused values send no PUT').toBe(0);

      const put = waitForApi(page, 'PUT', settingsRe(project.id), [200]);
      await field.fill('0,5');
      await field.press('Tab');
      const body = asRecord(asRecord((await put).response.request().postDataJSON() as unknown, 'PUT').body, 'PUT body');
      expect(body.confidenceThreshold).toBe(0.5);
      await expect(page.getByText(/^50\s?%$/u)).toBeVisible(); // UPS:1398 formatPercent hint
    });
  });

  test('E03 · SCR-08 [S29] "Tỉ lệ bản vẽ" refuses 0 and 1001; 2,5 saves and the preview reads "100 điểm ảnh ứng với 250 mm ngoài thực tế."', async ({ browser }) => {
    await withAdmin(browser, async (admin) => {
      const { page, api } = admin;
      const project = await createProject(admin, 'scale');
      await openSettings(page, project);
      await settingsTab(page, 'Đơn vị đo').click();
      const field = page.getByRole('textbox', { name: 'Tỉ lệ bản vẽ', exact: true }); // UT:81-91
      const mark = api.length;
      await field.fill('0');
      await expect(page.getByText('Giá trị không nhỏ hơn 0,01.', { exact: true })).toBeVisible(); // PSG:196
      await field.fill('1001');
      await expect(page.getByText('Giá trị không quá 1.000.', { exact: true })).toBeVisible(); // PSG:197
      await field.press('Escape');
      await quiet(page);
      expect(countSince(api, mark, 'PUT', settingsRe(project.id)), 'refused values send no PUT').toBe(0);

      const put = waitForApi(page, 'PUT', settingsRe(project.id), [200]);
      await field.fill('2,5');
      await field.press('Tab');
      const body = asRecord(asRecord((await put).response.request().postDataJSON() as unknown, 'PUT').body, 'PUT body');
      expect(body.defaultScaleMmPerPx).toBe(2.5);
      // UPS:560-574 scalePreviewLabelFor: 100 px × 2,5 mm = 250 mm (formatLength < 1 m stays in mm).
      await expect(page.getByText('100 điểm ảnh ứng với 250 mm ngoài thực tế.', { exact: true })).toBeVisible();
      await expect(page.getByText('2,5 milimét trên mỗi điểm ảnh', { exact: true })).toBeVisible(); // UPS:1400
      await captureEvidence(page, 'E03_settings_scale_preview.png');
    });
  });

  test('E03 · SCR-08 [S32] add an active user → "2 thành viên" + toast "Đã thêm …"; "Hoàn tác" removes them again', async ({ browser }) => {
    await withAdmin(browser, async (admin) => {
      const { page } = admin;
      // #38 GET /api/users (admin only, BE users/router.py:49-52): an existing active non-admin account, so no invitation.
      const list = await admin.context.request.get('/api/users', { headers: bearer(admin) });
      expect(list.status(), 'GET /api/users').toBe(200);
      const users = asRecord(await list.json(), 'GET /api/users').users;
      const adminEmail = readAdminCredentials().email.toLowerCase();
      const candidate = (Array.isArray(users) ? users : [])
        .map((user) => asRecord(user, 'user'))
        .find((user) => user.status === 'active' && user.role !== 'admin' && typeof user.email === 'string' && user.email.toLowerCase() !== adminEmail);
      test.skip(candidate === undefined, 'data: no active non-admin account on this stack (an invitation would spend POST /api/users/invitations)');
      const email = String(candidate?.email);
      const name = String(candidate?.name);

      const project = await createProject(admin, 'memberadd');
      await openSettings(page, project);
      await settingsTab(page, 'Thành viên').click();
      const membersRe = new RegExp(`^/api/projects/${escapeRegExp(project.id)}/members$`, 'u');
      const post = waitForApi(page, 'POST', membersRe, [200, 201]);
      await page.getByRole('textbox', { name: MEMBER.email, exact: true }).fill(email);
      await page.getByRole('button', { name: MEMBER.add, exact: true }).click();
      await post;
      await expect(page.getByText('2 thành viên', { exact: true })).toBeVisible(); // UPS:1403
      await expect(page.getByRole('listitem').filter({ hasText: name })).toBeVisible(); // MT:57-75
      const toast = toastWith(page, `Đã thêm ${name}; hoàn tác sẽ gỡ người này`).first(); // UPM:206
      await expect(toast).toBeVisible();
      await captureEvidence(page, 'E03_settings_member_added.png');

      const del = waitForApi(page, 'DELETE', new RegExp(`^/api/projects/${escapeRegExp(project.id)}/members/[^/]+$`, 'u'), [200, 204]);
      await toast.getByRole('button', { name: UNDO, exact: true }).click(); // UPM:191-200 undo → removeMemberById
      await del;
      await expect(page.getByText('1 thành viên', { exact: true })).toBeVisible();
    });
  });

  test('E03 · SCR-08 [S35] [mocked response] member add 429 → "Bạn đã thêm nhiều thành viên…" and "Thêm thành viên" locked', async ({ browser }) => {
    await withAdmin(browser, async (admin) => {
      const { page } = admin;
      const project = await createProject(admin, 'member429');
      await openSettings(page, project);
      await settingsTab(page, 'Thành viên').click();
      const membersPath = `/api/projects/${project.id}/members`;
      // BE shape of a 429 (core/errors.py:84 `{code, requestId}` + Retry-After, project_members/router.py:26-30).
      await page.route(
        (url) => url.pathname === membersPath,
        async (route) => {
          if (route.request().method() !== 'POST') return route.fallback();
          await route.fulfill({
            status: 429,
            headers: { 'Retry-After': '5' },
            contentType: 'application/json',
            body: JSON.stringify({ code: 'RATE_LIMITED', requestId: 'qa-e03-mock' }),
          });
        },
      );
      await page.getByRole('textbox', { name: MEMBER.email, exact: true }).fill(testEmail('e03-ratelimit'));
      const add = page.getByRole('button', { name: MEMBER.add, exact: true });
      await add.click();
      await expect(page.getByText('Bạn đã thêm nhiều thành viên trong giờ này; hãy thử lại sau.', { exact: true })).toBeVisible(); // UPM:34, 91-94
      await expect(add).toBeDisabled(); // UPM:143-149 lock ≥ 60 s (RATE_LIMIT_LOCK_FLOOR_SECONDS)
      await captureEvidence(page, 'E03_settings_member_429.png');
    });
  });

  test('E03 · SCR-08 [S36] [mocked response] settings read 500 → "Không tải được cài đặt dự án" + "Thử lại" (no save indicator); retry loads', async ({ browser }) => {
    await withAdmin(browser, async (admin) => {
      const { page } = admin;
      const project = await createProject(admin, 'settings500');
      const settingsPath = `/api/projects/${project.id}/settings`;
      const handler = async (route: Route): Promise<void> => {
        if (route.request().method() !== 'GET') return route.fallback();
        await route.fulfill({ status: 500, contentType: 'application/json', body: JSON.stringify({ code: 'INTERNAL', requestId: 'qa-e03-mock' }) });
      };
      const matcher = (url: URL): boolean => url.pathname === settingsPath;
      await page.route(matcher, handler);
      await page.goto(ROUTES.project.settings(project.id));
      // PSG:410-414 reads #24 + N6 together; PS:61-66: not a 404 → "Thử lại" when `canRetryLoad` (UPS:1370).
      const alert = page.getByRole('alert').filter({ hasText: LOAD_ERROR_SETTINGS });
      await expect(alert).toBeVisible({ timeout: 45_000 });
      const retry = alert.getByRole('button', { name: 'Thử lại', exact: true });
      await expect(retry).toBeVisible();
      await expect(alert.getByRole('button', { name: BACK_TO_PROJECTS })).toHaveCount(0);
      await expect(saveIndicator(page)).toHaveCount(0); // PS:59 no save indicator on a load error (BUG-078)
      await captureEvidence(page, 'E03_settings_load_500.png');
      await page.unroute(matcher, handler);
      await retry.click();
      await expect(page.getByRole('textbox', { name: NAME_LABEL, exact: true })).toHaveValue(project.name);
    });
  });

  test('E03 · SCR-08 [S38] while the settings read is held → "property-panel" skeleton, no form; released → the form', async ({ browser }) => {
    await withAdmin(browser, async (admin) => {
      const { page } = admin;
      const project = await createProject(admin, 'settingsload');
      const settingsPath = `/api/projects/${project.id}/settings`;
      const hold = await holdFirst(page, (url, method) => method === 'GET' && url.pathname === settingsPath);
      try {
        await page.goto(ROUTES.project.settings(project.id));
        await hold.seen;
        await expect(page.locator('.animate-pulse').first()).toBeVisible(); // PS:108-109 Skeleton preset (Skeleton.tsx:20)
        await expect(page.getByRole('textbox', { name: NAME_LABEL, exact: true })).toHaveCount(0);
        await captureEvidence(page, 'E03_settings_loading.png');
      } finally {
        await hold.release();
      }
      await expect(page.getByRole('textbox', { name: NAME_LABEL, exact: true })).toHaveValue(project.name);
    });
  });

  test('E03 · SCR-08 [S39] header save indicator: "Chưa có thay đổi" on load → "Đã lưu lúc HH:MM" after a save', async ({ browser }) => {
    await withAdmin(browser, async (admin) => {
      const { page } = admin;
      const project = await createProject(admin, 'indicator');
      await openSettings(page, project);
      await expect(saveIndicator(page)).toHaveText('Chưa có thay đổi'); // vi.json autosave.idle (useSaveIndicator.ts:37)
      const put = waitForApi(page, 'PUT', settingsRe(project.id), [200]);
      await page.getByRole('textbox', { name: NOTES_LABEL, exact: true }).fill(`qa indicator ${uniq()}`);
      await put;
      await expect(saveIndicator(page)).toHaveText(/^Đã lưu lúc \d{1,2}:\d{2}$/u); // common.saved_at (useSaveIndicator.ts:40)
      await captureEvidence(page, 'E03_settings_save_indicator.png');
    });
  });

  test('E03 · SCR-08 [S44] project deleted elsewhere → "Xoá mọi tầng" and "Xoá dự án" fail inside their dialog (404 sentence), dialog stays', async ({ browser }) => {
    await withAdmin(browser, async (admin) => {
      const { page } = admin;
      const project = await createProject(admin, 'dangerfail', 1);
      await openSettings(page, project);
      await settingsTab(page, 'Vùng nguy hiểm').click();
      const panel = page.getByRole('tabpanel', { name: 'Vùng nguy hiểm' });
      // The other writer: the real #27 DELETE, so the dialog's own calls meet a real 404.
      const gone = await admin.context.request.delete(`${PROJECTS_API}/${project.id}`, { headers: bearer(admin) });
      expect(gone.status(), 'the other writer deletes the project').toBe(200);

      await panel.getByRole('button', { name: DANGER.deleteFloors, exact: true }).click();
      const floorsDialog = page.getByRole('dialog', { name: DANGER.deleteFloorsTitle, exact: true });
      const read = waitForApi(page, 'GET', projectReadRe(project.id), [404]);
      await floorsDialog.getByRole('button', { name: DANGER.deleteFloors, exact: true }).click();
      await read; // PSG:513-517 reads #24 first
      // UPS:1220-1226 + 1413-1414: the failure replaces the dialog message; the dialog stays open.
      await expect(floorsDialog).toContainText(GENERIC_NOT_FOUND);
      await captureEvidence(page, 'E03_settings_danger_floors_404.png');
      await floorsDialog.getByRole('button', { name: DANGER.keep, exact: true }).click();
      await expect(floorsDialog).toHaveCount(0);

      await panel.getByRole('button', { name: DANGER.deleteProject, exact: true }).click();
      const projectDialog = page.getByRole('dialog', { name: DANGER.deleteProjectTitle, exact: true });
      await projectDialog.getByRole('textbox', { name: DANGER.typeName, exact: true }).fill(project.name);
      const del = waitForApi(page, 'DELETE', projectRe(project.id), [404]);
      await projectDialog.getByRole('button', { name: DANGER.deleteProject, exact: true }).click();
      await del;
      await expect(projectDialog).toContainText(GENERIC_NOT_FOUND); // UPS:1247-1252
      expect(pathOf(page), 'a failed delete does not leave the screen').toBe(ROUTES.project.settings(project.id));
      await captureEvidence(page, 'E03_settings_danger_project_404.png');
    });
  });
});

/* ---------------------------------------------------------------- SCR-09 gap rows */

test.describe('E03 SCR-09 floor manager — gap rows (QA-03d)', () => {
  test('E03 · SCR-09 [F5r] rename to the same name → "Chưa đổi được tên tầng — Tên tầng không đổi …", no PATCH', async ({ browser }) => {
    await withAdmin(browser, async (admin) => {
      const { page, api } = admin;
      const project = await createProject(admin, 'fsame', 2);
      await openFloors(page, project);
      const floor = firstFloor(project);
      const input = page.getByRole('textbox', { name: `Tên tầng ${floor.name}`, exact: true });
      const mark = api.length;
      await input.fill(`${floor.name}x`);
      await input.fill(floor.name); // a draft equal to the saved name (UFM:1140-1153 onFloorFieldChange)
      await input.press('Enter');
      await expect(toastWith(page, `${RENAME_REFUSED} — ${FLOOR_TEXT.sameName}`).first()).toBeVisible(); // FMG:876-880, UFM:1195-1199
      await quiet(page);
      expect(countSince(api, mark, 'PATCH', spatialRe(project.id)), 'an unchanged name sends nothing').toBe(0);
      await captureEvidence(page, 'E03_floors_rename_same.png');
    });
  });

  test('E03 · SCR-09 [F9r] drag the last row\'s grip onto the first row → insertion line, PATCH reorder, new order', async ({ browser }) => {
    await withAdmin(browser, async (admin) => {
      const { page } = admin;
      const project = await createProject(admin, 'fdrag', 3);
      await openFloors(page, project);
      const before = await floorRowNames(page);
      const first = before[0];
      const last = before.at(-1);
      if (first === undefined || last === undefined) throw new Error('no rows');
      const dataTransfer = await page.evaluateHandle(() => new DataTransfer());
      // FTR:240-249 grip `draggable` → onDragHandleStart; FTR:215-229 row dragover/drop; FT:122-142 handleDrop.
      await page.getByRole('button', { name: `Đổi thứ tự tầng ${last}`, exact: true }).dispatchEvent('dragstart', { dataTransfer });
      const target = floorRow(page, first);
      await target.dispatchEvent('dragover', { dataTransfer });
      await expect(target).toHaveClass(/border-t-accent/u); // FTR:209 showInsertionLineBefore
      await captureEvidence(page, 'E03_floors_drag_insertion.png');
      const reorder = waitForApi(page, 'PATCH', reorderRe, [200]);
      await target.dispatchEvent('drop', { dataTransfer });
      await reorder;
      await expect.poll(() => floorRowNames(page)).toEqual([last, ...before.slice(0, -1)]);
      await attachJson('E03_floors_drag_reorder.json', { before, after: await floorRowNames(page) });
    });
  });

  test('E03 · SCR-09 [F19r] "Nhân bản" with "Sao chép nội thất" on → POST + the contents sentence is announced (session only)', async ({ browser }) => {
    await withAdmin(browser, async (admin) => {
      const { page } = admin;
      const project = await createProject(admin, 'fdupc', 2);
      const announced = await recordAnnouncements(page);
      await openFloors(page, project);
      const source = firstFloor(project);
      const row = floorRow(page, source.name);
      await openRowMenu(page, source.name);
      await page.getByRole('menuitem', { name: 'Nhân bản', exact: true }).click();
      const copySwitch = row.getByRole('switch', { name: 'Sao chép nội thất sang tầng mới', exact: true });
      await copySwitch.click();
      await expect(copySwitch).toHaveAttribute('aria-checked', 'true');
      const post = waitForApi(page, 'POST', floorsRe(project.id), [200, 201]);
      await row.getByRole('button', { name: 'Nhân bản', exact: true }).click();
      await post;
      // UFM:1373-1382: persistFloorContents is unsupported → `announce(contents.notice)` (FMG:210-211).
      await expect.poll(announced, { timeout: 15_000 }).toContain(FLOOR_TEXT.contents);
      await captureEvidence(page, 'E03_floors_duplicate_contents.png');
      await attachJson('E03_floors_duplicate_contents.json', { announced: await announced() });
    });
  });

  test('E03 · SCR-09 [F21r] undo a floor delete after the 570 s restore window → "Đã quá thời gian khôi phục tầng…", no POST', async ({ browser }) => {
    await withAdmin(browser, async (admin) => {
      const { page, api } = admin;
      const project = await createProject(admin, 'fexpire', 3);
      await page.clock.install(); // time keeps flowing; only `setSystemTime` below jumps Date.now (UFM gateway.now)
      await openFloors(page, project);
      const top = project.floors[2] ?? firstFloor(project);
      const del = waitForApi(page, 'DELETE', new RegExp(`^/api/floors/${escapeRegExp(top.id)}$`, 'u'), [200, 204]);
      await openRowMenu(page, top.name);
      await page.getByRole('menuitem', { name: 'Xoá tầng', exact: true }).click();
      await del;
      await expect(floorRow(page, top.name)).toHaveCount(0);
      await page.clock.setSystemTime(Date.now() + FLOOR_RESTORE_WINDOW_MS + 1_000);
      const mark = api.length;
      await floorRow(page, firstFloor(project).name).focus();
      await page.keyboard.press('Control+z'); // UFM:1459-1472 Mod+Z → undo; UFM:952-965 isExpired
      await expect(toastWith(page, `${FLOOR_TEXT.undoRefused} — ${FLOOR_TEXT.undoExpired}`).first()).toBeVisible();
      await quiet(page);
      expect(countSince(api, mark, 'POST', floorsRe(project.id)), 'an expired restore is not sent').toBe(0);
      await expect(floorRow(page, top.name)).toHaveCount(0);
      await captureEvidence(page, 'E03_floors_undo_expired.png');
    });
  });

  test('E03 · SCR-09 [F22r] 50 floors → "Thêm tầng" says "Chưa thêm được tầng — Dự án đã đủ 50 tầng…", no POST', async ({ browser }) => {
    await withAdmin(browser, async (admin) => {
      const { page, api } = admin;
      const project = await createProject(admin, 'f50', 50);
      await openFloors(page, project);
      const mark = api.length;
      await page.getByRole('button', { name: 'Thêm tầng', exact: true }).click();
      // UFM:1295-1306 isAtFloorLimit (PROJECT_LIMITS.floorCountMax 50) → say, no command.
      await expect(toastWith(page, `${FLOOR_TEXT.addRefused} — ${FLOOR_TEXT.limit}`).first()).toBeVisible();
      await quiet(page);
      expect(countSince(api, mark, 'POST', floorsRe(project.id)), 'no POST at the cap').toBe(0);
      await expect(floorRows(page)).toHaveCount(50);
      await captureEvidence(page, 'E03_floors_limit_local.png');
    });
  });

  test('E03 · SCR-09 [F28r] while the floor list is held → table skeleton + pulsing section; released → rows', async ({ browser }) => {
    await withAdmin(browser, async (admin) => {
      const { page } = admin;
      const project = await createProject(admin, 'floading', 2);
      const listPath = `/api/projects/${project.id}/floors`;
      const hold = await holdFirst(page, (url, method) => method === 'GET' && url.pathname === listPath);
      try {
        await page.goto(ROUTES.project.floors(project.id));
        await hold.seen;
        await expect(page.locator('.animate-pulse').first()).toBeVisible(); // FT:263-265 Table.Skeleton, FSC:163
        await expect(floorRows(page)).toHaveCount(0);
        await captureEvidence(page, 'E03_floors_loading.png');
      } finally {
        await hold.release();
      }
      await expect(floorRows(page)).toHaveCount(2);
    });
  });

  test('E03 · SCR-09 [F31r] footer "3 tầng · tổng cao 9,0 m · …"; caption follows "Tự động tính cao độ"', async ({ browser }) => {
    await withAdmin(browser, async (admin) => {
      const { page } = admin;
      const project = await createProject(admin, 'ffooter', 3);
      await openFloors(page, project);
      await expectSettledTotal(page, 3, '9,0'); // FT:320-322
      await expect(page.getByText(FLOOR_TEXT.captionManual, { exact: true })).toBeVisible(); // FT:311 (auto starts OFF, UFM:516)
      const auto = page.getByRole('switch', { name: AUTO_ELEVATION, exact: true });
      await auto.click();
      await expect(page.getByText(FLOOR_TEXT.captionAuto, { exact: true })).toBeVisible();
      await captureEvidence(page, 'E03_floors_footer_caption.png');
      await auto.click();
      await expect(page.getByText(FLOOR_TEXT.captionManual, { exact: true })).toBeVisible();
    });
  });

  test('E03 · SCR-09 [F32r] a floor added elsewhere at 49 → "Thêm tầng" meets the server cap: "Chưa lưu được thay đổi tầng — Dự án đã đủ 50 tầng…"', async ({ browser }) => {
    await withAdmin(browser, async (admin) => {
      const { page } = admin;
      const project = await createProject(admin, 'f49', 49);
      await openFloors(page, project);
      await addFloorByApi(admin, project, 49); // the 50th, unseen by this page
      const post = waitForApi(page, 'POST', floorsRe(project.id), [422]);
      await page.getByRole('button', { name: 'Thêm tầng', exact: true }).click();
      const { json } = await post; // BE floors/service.py:86-89 FLOOR_LIMIT_REACHED
      expect(asRecord(json, '422').code).toBe('FLOOR_LIMIT_REACHED');
      await expect(toastWith(page, `${FLOOR_TEXT.persistFailed} — ${FLOOR_TEXT.limit}`).first()).toBeVisible(); // UFM:207-213, 703-706
      await expect(floorRows(page)).toHaveCount(49); // "thao tác vừa rồi đã được huỷ"
      await captureEvidence(page, 'E03_floors_limit_server.png');
    });
  });

  test('E03 · SCR-09 [F32r] list changed elsewhere → Alt+ArrowUp meets FLOOR_REORDER_MISMATCH: "Danh sách tầng vừa đổi ở nơi khác…", order kept', async ({ browser }) => {
    await withAdmin(browser, async (admin) => {
      const { page } = admin;
      const project = await createProject(admin, 'fmismatch', 3);
      await openFloors(page, project);
      const before = await floorRowNames(page);
      await addFloorByApi(admin, project, 3);
      const middle = before[1];
      if (middle === undefined) throw new Error('no middle row');
      const reorder = waitForApi(page, 'PATCH', reorderRe, [422]);
      await floorRow(page, middle).focus();
      await page.keyboard.press('Alt+ArrowUp');
      const { json } = await reorder; // BE floors/resolvers.py:102-113 / service.py:219-222
      expect(asRecord(json, '422').code).toBe('FLOOR_REORDER_MISMATCH');
      await expect(toastWith(page, `${FLOOR_TEXT.persistFailed} — ${FLOOR_TEXT.listChanged}`).first()).toBeVisible();
      await expect.poll(() => floorRowNames(page)).toEqual(before);
      await captureEvidence(page, 'E03_floors_reorder_mismatch.png');
    });
  });
});

/* ---------------------------------------------------------------- SCR-10 gap rows */

test.describe('E03 SCR-10 floor upload — gap rows (QA-03d)', () => {
  test('E03 · SCR-10 [U12] 3-page .pdf: picking "Trang 2" starts the upload with pageIndex 1', async ({ browser }, testInfo) => {
    const threePages = testInfo.outputPath('ba-trang-chon.pdf');
    writeFileSync(threePages, '%PDF-1.4\n1 0 obj << /Type /Pages /Count 3 >> endobj\n%%EOF\n', 'utf8');
    await withAdmin(browser, async (admin) => {
      const { page } = admin;
      const project = await createProject(admin, 'upick', 1);
      const floor = firstFloor(project);
      await openUpload(page, project);
      await page.getByTestId(FILE_INPUT).setInputFiles(threePages);
      await tray(page).getByRole('combobox', { name: ASSIGN }).click();
      await page.getByRole('option', { name: floor.name, exact: true }).click();
      const picker = card(page, floor).getByRole('combobox', { name: PICK_PAGE });
      const init = page.waitForRequest((request) => request.method() === 'POST' && uploadInitRe(project.id).test(new URL(request.url()).pathname));
      await picker.click();
      await page.getByRole('option', { name: 'Trang 2', exact: true }).click(); // UFU:808-820 pickPdfPage → startUpload
      const body = asRecord((await init).postDataJSON() as unknown, 'init body');
      expect(body.pageIndex, 'UFU:268-271 page 2 → pageIndex 1 (uploadTask.ts:430)').toBe(1);
      expect(body.fileName).toBe('ba-trang-chon.pdf');
      await expect(card(page, floor).getByText(WAITING, { exact: true })).toHaveCount(0); // left "Chờ xử lý"
      await captureEvidence(page, 'E03_upload_pdf_page_picked.png');
      await attachJson('E03_upload_pdf_page_picked.json', { init: body, status: await card(page, floor).getByRole('status').allInnerTexts().catch(() => []) });
    });
  });

  test('E03 · SCR-10 [U16 U20] chunk held → "Đang tải lên" + progressbar; card menu "Huỷ" → back to "Chờ xử lý", no complete', async ({ browser }) => {
    await withAdmin(browser, async (admin) => {
      const { page, api } = admin;
      const project = await createProject(admin, 'ucancel', 1);
      const floor = firstFloor(project);
      await openUpload(page, project);
      const hold = await holdFirst(page, (url, method) => method === 'POST' && /\/drawings\/uploads\/[^/]+\/chunks$/u.test(url.pathname));
      try {
        await page.getByTestId(FILE_INPUT).setInputFiles(drawingPng());
        await tray(page).getByRole('combobox', { name: ASSIGN }).click();
        await page.getByRole('option', { name: floor.name, exact: true }).click();
        await hold.seen;
        const floorCard = card(page, floor);
        await expect(floorCard.getByText(UPLOADING, { exact: true })).toBeVisible(); // UFU:122
        // FUC:171-190 ProgressRail: sr-only role="progressbar" named "Đã tải N% của <file>" (UFU:1136-1139).
        await expect(floorCard.getByRole('progressbar')).toHaveAccessibleName(new RegExp(`^Đã tải \\d+\\s?% của ${escapeRegExp(drawingName())}$`, 'u'));
        await captureEvidence(page, 'E03_upload_uploading.png');
        const menu = floorCard.getByRole('button', { name: `Tuỳ chọn của tầng ${floor.name}`, exact: true });
        await menu.click();
        const mark = api.length;
        await floorCard.getByRole('button', { name: 'Huỷ', exact: true }).click(); // FUC:112-124 → UFU:1291-1293 cancelTask
        await expect(floorCard.getByText(WAITING, { exact: true })).toBeVisible(); // UFU:298 cancelled → waiting
        await expect(floorCard.getByRole('progressbar')).toHaveCount(0);
        await quiet(page);
        expect(countSince(api, mark, 'POST', /\/drawings\/uploads\/[^/]+\/complete$/u), 'a cancelled upload never completes').toBe(0);
        await captureEvidence(page, 'E03_upload_cancelled.png');
      } finally {
        await hold.release();
      }
    });
  });

  test('E03 · SCR-10 [U17] [mocked response] chunk 500 → card "Lỗi" + sentence; menu "Thử lại" (real backend) → "Đã gắn kèm"', async ({ browser }) => {
    test.setTimeout(240_000);
    await withAdmin(browser, async (admin) => {
      const { page } = admin;
      const project = await createProject(admin, 'uretry', 1);
      const floor = firstFloor(project);
      await openUpload(page, project);
      const handler = async (route: Route): Promise<void> => {
        if (route.request().method() !== 'POST') return route.fallback();
        await route.fulfill({ status: 500, contentType: 'application/json', body: JSON.stringify({ code: 'INTERNAL', requestId: 'qa-e03-mock' }) });
      };
      const matcher = (url: URL): boolean => /\/drawings\/uploads\/[^/]+\/chunks$/u.test(url.pathname);
      await page.route(matcher, handler);
      await page.getByTestId(FILE_INPUT).setInputFiles(drawingPng());
      await tray(page).getByRole('combobox', { name: ASSIGN }).click();
      await page.getByRole('option', { name: floor.name, exact: true }).click();
      const floorCard = card(page, floor);
      // uploadTask.ts:61-68 three attempts per chunk, then `failed`; a 500 is retryable and not terminal (FUG:323-326).
      await expect(floorCard.getByText(STATUS_ERROR, { exact: true })).toBeVisible({ timeout: 60_000 });
      await expect(floorCard.getByRole('alert')).toBeVisible(); // FUC:285-297
      await captureEvidence(page, 'E03_upload_chunk_500.png');
      await page.unroute(matcher, handler);
      const complete = waitForApi(page, 'POST', new RegExp(`^/api/projects/${escapeRegExp(project.id)}/drawings/uploads/[^/]+/complete$`, 'u'), [200]);
      await floorCard.getByRole('button', { name: `Tuỳ chọn của tầng ${floor.name}`, exact: true }).click();
      await floorCard.getByRole('button', { name: 'Thử lại', exact: true }).click(); // FUC:125-137 → UFU:1294-1302
      await complete;
      await expect(floorCard.getByText(ATTACHED, { exact: true })).toBeVisible();
    });
  });

  test('E03 · SCR-10 [U18] "mat-bang-tang-2.png" is matched to "Tầng 2" by name → uploads at once, hint "Ghép tự động từ tên tệp — kiểm tra lại"', async ({ browser }, testInfo) => {
    test.setTimeout(240_000);
    const named = testInfo.outputPath('mat-bang-tang-2.png');
    copyFileSync(drawingPng(), named);
    await withAdmin(browser, async (admin) => {
      const { page } = admin;
      const project = await createProject(admin, 'umatch', 2);
      const second = project.floors[1] ?? firstFloor(project);
      await openUpload(page, project);
      const init = page.waitForRequest((request) => request.method() === 'POST' && uploadInitRe(project.id).test(new URL(request.url()).pathname));
      await page.getByTestId(FILE_INPUT).setInputFiles(named);
      // UFU:764-786 guessFloor(file) === guessFloor(floor) (VAL:350-377) → floorId set, isAutoMatched, startUpload.
      const body = asRecord((await init).postDataJSON() as unknown, 'init body');
      expect(body.floorId, 'matched to "Tầng 2"').toBe(second.id);
      await expect(tray(page)).toHaveCount(0);
      const secondCard = card(page, second);
      await expect(secondCard.getByText(AUTO_MATCH, { exact: true })).toBeVisible(); // FUC:243-245, UFU:1134
      await expect(secondCard.getByText(ATTACHED, { exact: true })).toBeVisible({ timeout: 60_000 });
      await captureEvidence(page, 'E03_upload_auto_match.png');
    });
  });

  test('E03 · SCR-10 [U19] a second file assigned to an occupied floor sends the first back to the tray (announced)', async ({ browser }, testInfo) => {
    test.setTimeout(240_000);
    const fileA = testInfo.outputPath('ban-ve-a.png');
    const fileB = testInfo.outputPath('ban-ve-b.png');
    copyFileSync(drawingPng(), fileA);
    copyFileSync(drawingPng(), fileB);
    await withAdmin(browser, async (admin) => {
      const { page } = admin;
      const project = await createProject(admin, 'udisplace', 1);
      const floor = firstFloor(project);
      const announced = await recordAnnouncements(page);
      await openUpload(page, project);
      await page.getByTestId(FILE_INPUT).setInputFiles([fileA, fileB]);
      await expect(tray(page)).toContainText('2 tệp');
      const item = (name: string): Locator => tray(page).getByRole('listitem').filter({ hasText: name });
      await item('ban-ve-a.png').getByRole('combobox', { name: ASSIGN }).click();
      await page.getByRole('option', { name: floor.name, exact: true }).click();
      await expect(card(page, floor).getByText(ATTACHED, { exact: true })).toBeVisible({ timeout: 60_000 });

      await item('ban-ve-b.png').getByRole('combobox', { name: ASSIGN }).click();
      await page.getByRole('option', { name: floor.name, exact: true }).click(); // UFU:826-839 displaced → toTray()
      await expect(item('ban-ve-a.png')).toBeVisible();
      await expect(card(page, floor)).toContainText('ban-ve-b.png');
      // UFU:1334-1336 displacedSentence.
      await expect.poll(announced).toContain('ban-ve-a.png đã về khay tệp chưa gán tầng vì tầng ấy đã có tệp khác');
      await captureEvidence(page, 'E03_upload_displaced.png');
    });
  });

  test('E03 · SCR-10 [U25] overlapping floors → submit names the overlap ("… hai tầng chồng lấn … mm.")', async ({ browser }) => {
    await withAdmin(browser, async (admin) => {
      const { page } = admin;
      // Tầng 2 starts at 1 m, inside Tầng 1 (0 m + 3 m): alignFloors overlap (src/domain/axes/alignFloors.ts:505-521).
      const project = await createProjectWithFloors(admin, 'uoverlap', [
        { name: 'Tầng 1', elevationMm: 0, heightMm: FLOOR_HEIGHT_MM },
        { name: 'Tầng 2', elevationMm: 1_000, heightMm: FLOOR_HEIGHT_MM },
      ]);
      await openUpload(page, project);
      await page.getByRole('button', { name: SUBMIT, exact: true }).click();
      const notice = page.getByTestId(BLOCK_NOTICE);
      await expect(notice).toContainText(BLOCKED_TITLE);
      // UFU:986-1001 duplicateElevation reason = the domain sentence as it is.
      await expect(notice).toContainText(/Tầng Tầng 2 bắt đầu ở cao độ .+ m, thấp hơn trần tầng Tầng 1 ở .+ m: hai tầng chồng lấn .+ mm\./u);
      await captureEvidence(page, 'E03_upload_blocked_overlap.png');
    });
  });

  test('E03 · SCR-10 [U30] [mocked response] project read 500 → "Không tải được danh sách tầng" + "Thử lại", no drop zone; retry loads', async ({ browser }) => {
    await withAdmin(browser, async (admin) => {
      const { page } = admin;
      const project = await createProject(admin, 'u500', 1);
      const readPath = `/api/projects/${project.id}`;
      const handler = async (route: Route): Promise<void> => {
        if (route.request().method() !== 'GET') return route.fallback();
        await route.fulfill({ status: 500, contentType: 'application/json', body: JSON.stringify({ code: 'INTERNAL', requestId: 'qa-e03-mock' }) });
      };
      const matcher = (url: URL): boolean => url.pathname === readPath;
      await page.route(matcher, handler);
      await page.goto(ROUTES.project.upload(project.id));
      // FUG:220-227 readFloors = #24; FU:140-153 not a 404 → LOAD_ERROR_TITLE + "Thử lại" when retryable (UFU:1251).
      const alert = page.getByRole('alert').filter({ hasText: UPLOAD_LOAD_ERROR });
      await expect(alert).toBeVisible({ timeout: 45_000 });
      await expect(page.getByTestId(DROPZONE)).toHaveCount(0);
      const retry = alert.getByRole('button', { name: 'Thử lại', exact: true });
      await expect(retry).toBeVisible();
      await captureEvidence(page, 'E03_upload_load_500.png');
      await page.unroute(matcher, handler);
      await retry.click(); // UFU:1303-1305 floorsQuery.refetch
      await expect(page.getByTestId(DROPZONE)).toBeVisible();
    });
  });

  test('E03 · SCR-10 [U32] offline → "Đang làm việc ngoại tuyến"; a file assigned waits for the network; back online it uploads', async ({ browser }) => {
    test.setTimeout(240_000);
    await withAdmin(browser, async (admin) => {
      const { page, api } = admin;
      const project = await createProject(admin, 'uoffline', 1);
      const floor = firstFloor(project);
      await openUpload(page, project);
      await admin.context.setOffline(true);
      try {
        await expect(page.getByText(OFFLINE_BANNER, { exact: true })).toBeVisible(); // FU:222-224, UFU:1253
        await page.getByTestId(FILE_INPUT).setInputFiles(drawingPng());
        const mark = api.length;
        await tray(page).getByRole('combobox', { name: ASSIGN }).click();
        await page.getByRole('option', { name: floor.name, exact: true }).click();
        // UFU:626-660: offline → waiting + awaitingNetwork, the banner turns into the await-network sentence.
        await expect(card(page, floor).getByText(WAITING, { exact: true })).toBeVisible();
        // The announcer (src/lib/input/announcer.ts) repeats the sentence off screen; the banner comes first in the DOM.
        await expect(page.getByText(AWAIT_NETWORK, { exact: true }).first()).toBeVisible();
        expect(countSince(api, mark, 'POST', uploadInitRe(project.id)), 'no init while offline').toBe(0);
        await captureEvidence(page, 'E03_upload_offline_waiting.png');
      } finally {
        await admin.context.setOffline(false);
      }
      await expect(card(page, floor).getByText(ATTACHED, { exact: true })).toBeVisible({ timeout: 90_000 }); // UFU:696-700 resume
      await expect(page.getByText(OFFLINE_BANNER, { exact: true })).toHaveCount(0);
    });
  });

  test('E03 · SCR-10 [U35] while the project read is held → three skeleton rows; released → drop zone and cards', async ({ browser }) => {
    await withAdmin(browser, async (admin) => {
      const { page } = admin;
      const project = await createProject(admin, 'uloading', 1);
      const readPath = `/api/projects/${project.id}`;
      const hold = await holdFirst(page, (url, method) => method === 'GET' && url.pathname === readPath);
      try {
        await page.goto(ROUTES.project.upload(project.id));
        await hold.seen;
        await expect(page.locator('.animate-pulse').first()).toBeVisible(); // FU:143-148 SKELETON_ROW_COUNT × table-row
        await expect(page.locator('[data-floor-id]')).toHaveCount(0);
        await captureEvidence(page, 'E03_upload_loading.png');
      } finally {
        await hold.release();
      }
      await expect(card(page, firstFloor(project))).toBeVisible();
    });
  });
});

/* ---------------------------------------------------------------- SCR-11 gap rows */

test.describe('E03 SCR-11 input quality gate — gap rows (QA-03d)', () => {
  test('E03 · SCR-11 [Q3] two measured floors: "Các tầng đã đo" click / Enter / ArrowRight move aria-current', async ({ browser }) => {
    test.setTimeout(PIPELINE_TIMEOUT_MS + 120_000);
    await withAdmin(browser, async (admin) => {
      const { page } = admin;
      const project = await seeded(admin, async (api) => (await createMeasuredFloorsProject(api, 'e03-qtable', readFileSync(drawingPng()), ['Tầng 1', 'Tầng 2'])).projectId);
      await page.goto(ROUTES.project.quality(project.id));
      const report = page.getByRole('region', { name: REPORT_REGION, exact: true });
      const row = (name: string): Locator => report.getByRole('row').filter({ hasText: name });
      await expect(row('Tầng 1')).toHaveAttribute('aria-current', 'true'); // IQR:229-243, BE focus = first floor
      await row('Tầng 2').click();
      await expect(row('Tầng 2')).toHaveAttribute('aria-current', 'true');
      await expect(row('Tầng 1')).not.toHaveAttribute('aria-current', 'true');
      await captureEvidence(page, 'E03_quality_floor_table.png');
      await row('Tầng 1').focus();
      await page.keyboard.press('Enter'); // IQR:236-240
      await expect(row('Tầng 1')).toHaveAttribute('aria-current', 'true');
      await page.locator('body').click({ position: { x: 5, y: 5 } });
      await page.keyboard.press('ArrowRight'); // UIQ:1089-1103 next floor
      await expect(row('Tầng 2')).toHaveAttribute('aria-current', 'true');
    });
  });

  test('E03 · SCR-11 [Q14] [mocked response] quality read 500 → "Không đọc được kết quả kiểm tra chất lượng" + "Thử lại", no footer; retry reads', async ({ browser }) => {
    await withAdmin(browser, async (admin) => {
      const { page } = admin;
      const project = await createProject(admin, 'q500', 1);
      const handler = async (route: Route): Promise<void> => {
        if (route.request().method() !== 'GET') return route.fallback();
        await route.fulfill({ status: 500, contentType: 'application/json', body: JSON.stringify({ code: 'INTERNAL', requestId: 'qa-e03-mock' }) });
      };
      const matcher = (url: URL): boolean => url.pathname.startsWith(`/api/projects/${project.id}/floors/`) && url.pathname.endsWith('/quality');
      await page.route(matcher, handler);
      await page.goto(ROUTES.project.quality(project.id));
      const alert = page.getByRole('alert').filter({ hasText: QUALITY_LOAD_ERROR }); // IQ:133-145
      await expect(alert).toBeVisible({ timeout: 45_000 });
      const retry = alert.getByRole('button', { name: 'Thử lại', exact: true });
      await expect(retry).toBeVisible();
      await expect(page.getByRole('button', { name: QUALITY.continue, exact: true })).toHaveCount(0); // UIQ:1038 actions hidden
      await captureEvidence(page, 'E03_quality_load_500.png');
      await page.unroute(matcher, handler);
      await retry.click();
      await expect(page.getByText(QUALITY.noDrawingTitle, { exact: true })).toBeVisible(); // real #30 404 upload → empty
    });
  });

  test('E03 · SCR-11 [Q15] floor deleted elsewhere → "Nắn thẳng" fails: "Chưa xử lý được bản vẽ" strip, focus back on the action', async ({ browser }) => {
    test.setTimeout(PIPELINE_TIMEOUT_MS + 120_000);
    await withAdmin(browser, async (admin) => {
      const { page } = admin;
      const project = await seeded(admin, async (api) => (await createSkewedDrawingProject(api, 'e03-qwrite', await rotatedPng(browser, drawingPng(), SKEW_DEG))).projectId);
      await page.goto(ROUTES.project.quality(project.id));
      const straighten = page.getByRole('button', { name: 'Tự động nắn', exact: true });
      await expect(straighten).toBeVisible();
      const floor = firstFloor(project);
      const gone = await admin.context.request.delete(`/api/floors/${floor.id}`, { headers: bearer(admin) });
      expect(gone.status(), 'the other writer deletes the floor').toBe(200);

      await straighten.click();
      const dialog = page.getByRole('dialog', { name: /^Nắn thẳng bản vẽ tầng /u });
      const write = waitForApi(page, 'POST', /\/quality\/straighten$/u, [404]);
      await dialog.getByRole('button', { name: 'Nắn thẳng', exact: true }).click();
      await write;
      // IQ:150-158 WRITE_ERROR_TITLE; inputQualityWriteErrors.ts: a 404 has no own sentence → UIQ:154 fallback.
      const strip = page.getByRole('alert').filter({ hasText: QUALITY_WRITE_ERROR });
      await expect(strip).toContainText(QUALITY_WRITE_FALLBACK);
      // IQ:110-118: focus goes back to the action that failed, or to the strip when that button is gone.
      const focused = await page.evaluate(() => {
        const active = document.activeElement;
        return { action: active?.getAttribute('data-quality-action') ?? null, isStripBox: active?.getAttribute('tabindex') === '-1' };
      });
      expect(focused.action === 'straighten' || focused.isStripBox, `focus after the failed write: ${JSON.stringify(focused)}`).toBe(true);
      await captureEvidence(page, 'E03_quality_write_error.png');
      await attachJson('E03_quality_write_error.json', { focused });
    });
  });

  test('E03 · SCR-11 [Q16] hovering / focusing a finding lights its image region (border-2), the others stay thin', async ({ browser }) => {
    test.setTimeout(PIPELINE_TIMEOUT_MS + 120_000);
    await withAdmin(browser, async (admin) => {
      const { page } = admin;
      const project = await seeded(admin, async (api) => (await createSkewedDrawingProject(api, 'e03-qhover', await rotatedPng(browser, drawingPng(), SKEW_DEG))).projectId);
      await page.goto(ROUTES.project.quality(project.id));
      const report = page.getByRole('region', { name: REPORT_REGION, exact: true });
      const regions = page.getByRole('group', { name: REGION_GROUP, exact: true }).getByRole('button'); // IQO:149-185
      await expect(regions.first()).toBeVisible();
      await expect(page.locator('[aria-label^="Vùng ảnh có vấn đề:"].border-2')).toHaveCount(0);
      // IQR:150-185 the finding card (tabIndex 0) → onHoverFinding + onHoverRegion(regionId).
      const findingCard = report.getByRole('listitem').filter({ has: page.getByRole('button', { name: 'Tự động nắn', exact: true }) }).locator('div[tabindex="0"]').first();
      await findingCard.hover();
      await expect(page.locator('[aria-label^="Vùng ảnh có vấn đề:"].border-2')).toHaveCount(1); // IQO:165
      await captureEvidence(page, 'E03_quality_hover_region.png');
      await page.mouse.move(1, 1);
      await expect(page.locator('[aria-label^="Vùng ảnh có vấn đề:"].border-2')).toHaveCount(0);
      await findingCard.focus(); // keyboard path: onFocus = beginHover
      await expect(page.locator('[aria-label^="Vùng ảnh có vấn đề:"].border-2')).toHaveCount(1);
    });
  });

  test('E03 · SCR-11 [Q18] [mocked response] focus floor still measuring → "Mới có 0/1 tầng đo xong. … Còn chờ: Tầng 1."', async ({ browser }) => {
    test.setTimeout(PIPELINE_TIMEOUT_MS + 120_000);
    await withAdmin(browser, async (admin) => {
      const { page } = admin;
      const project = await seeded(admin, async (api) => (await createPipelineDrawingProject(api, 'e03-qpartial', readFileSync(drawingPng()))).projectId);
      // The real #30 body with its one floor flipped to "not measured yet" (a state the fake ML leaves within seconds).
      await page.route(
        (url) => url.pathname.endsWith('/quality') && url.pathname.includes(project.id),
        async (route) => {
          if (route.request().method() !== 'GET') return route.fallback();
          const real = await route.fetch();
          const body = asRecord(await real.json(), '#30');
          const floors = Array.isArray(body.floors) ? body.floors.map((floor) => asRecord(floor, 'floor')) : [];
          const pending = floors.map((floor) => {
            const { measurement: _m, expectedConfidence: _c, frame: _f, ...rest } = floor;
            return { ...rest, isMeasured: false, findings: [] };
          });
          await route.fulfill({ response: real, json: { ...body, floors: pending } });
        },
      );
      await page.goto(ROUTES.project.quality(project.id));
      // UIQ:896-898 partial; UIQ:928-946 counted + activeLine + pendingLine.
      const report = page.getByRole('region', { name: REPORT_REGION, exact: true });
      await expect(report).toContainText('Mới có 0/1 tầng đo xong.');
      await expect(report).toContainText('Còn chờ: Tầng 1.');
      await captureEvidence(page, 'E03_quality_partial.png');
    });
  });

  test('E03 · SCR-11 [Q20] at 375 px the report sits under the drawing in the page flow (no horizontal scroll)', async ({ browser }) => {
    test.setTimeout(PIPELINE_TIMEOUT_MS + 120_000);
    await withAdmin(
      browser,
      async (admin) => {
        const { page } = admin;
        const project = await seeded(admin, async (api) => (await createPipelineDrawingProject(api, 'e03-qcompact', readFileSync(drawingPng()))).projectId);
        await page.goto(ROUTES.project.quality(project.id));
        const report = page.getByRole('region', { name: REPORT_REGION, exact: true });
        const drawing = page.getByRole('img', { name: /^Bản vẽ tầng .+ đang xem để kiểm tra chất lượng đầu vào$/u }); // UIQ:143-144
        await expect(report).toBeVisible();
        await expect(drawing).toBeVisible();
        const reportBox = await report.boundingBox();
        const drawingBox = await drawing.boundingBox();
        const overflow = await horizontalOverflow(page);
        await captureEvidence(page, 'E03_quality_compact.png', { fullPage: true });
        await attachJson('E03_quality_compact.json', { reportBox, drawingBox, horizontalOverflow: overflow });
        // IQ:174-177 "Dưới 1024px báo cáo xếp dưới bản vẽ" (FIX-1381, BUG-291).
        expect(reportBox !== null && drawingBox !== null && reportBox.y >= drawingBox.y + drawingBox.height - 1, 'report under the drawing').toBe(true);
        expect(overflow, 'no horizontal scroll at 375 px').toBeLessThanOrEqual(0);
      },
      { viewport: COMPACT },
    );
  });
});

/* ---------------------------------------------------------------- SCR-12 gap rows */

test.describe('E03 SCR-12 processing — gap rows (QA-03d)', () => {
  test('E03 · SCR-12 [P8] an upload still receiving → "Để chạy nền và thông báo cho tôi"; click → "Sẽ báo cho bạn khi xử lý xong"', async ({ browser }) => {
    await withAdmin(browser, async (admin) => {
      const { page } = admin;
      const project = await createProject(admin, 'pbackground', 1);
      const floor = firstFloor(project);
      const png = readFileSync(drawingPng());
      // #5 init + #6 chunk 0 and NO #7: the upload stays `receiving`, which N7 lists (BE drawings/latest.py:67) — a run
      // that is not final (UPR:470-478), the only state the button is drawn for (UPR:844, PR:97-101).
      const init = await admin.context.request.post(`${PROJECTS_API}/${project.id}/floors/${floor.id}/drawings/uploads`, {
        headers: bearer(admin),
        data: { fileName: `${TEST_DATA_PREFIX}e03-receiving.png`, floorId: floor.id, mimeType: 'image/png', projectId: project.id, sizeBytes: png.length },
      });
      expect(init.status(), 'setup: upload init (#5)').toBe(200);
      const uploadId = stringField(await init.json(), 'id', 'init');
      const chunk = await admin.context.request.post(`${PROJECTS_API}/${project.id}/drawings/uploads/${uploadId}/chunks`, {
        headers: bearer(admin),
        data: { chunk: png.toString('base64'), chunkIndex: 0 },
      });
      expect(chunk.status(), 'setup: upload chunk 0 (#6)').toBe(200);

      await page.goto(ROUTES.project.pipeline(project.id));
      const background = page.getByRole('button', { name: PROCESSING.background, exact: true });
      await expect(background).toBeVisible();
      await expect(page.getByRole('button', { name: PROCESSING.cancel, exact: true })).toHaveCount(0); // cancel unsupported
      await background.click(); // UPR:880-926 runInBackground (supported) → notice
      await expect(page.getByText(BACKGROUND_STARTED, { exact: true }).first()).toBeVisible();
      await captureEvidence(page, 'E03_pipeline_background.png');
    });
  });

  test('E03 · SCR-12 [P13] [mocked response] N7 read 500 → alert "Thử lại" + technical code + "Liên hệ hỗ trợ" (→ /tai-khoan); retry reads', async ({ browser }) => {
    await withAdmin(browser, async (admin) => {
      const { page } = admin;
      const project = await createProject(admin, 'p500', 1);
      const latestPath = `/api/projects/${project.id}/drawings/uploads/latest`; // endpoints.ts:100-102
      const handler = async (route: Route): Promise<void> => {
        if (route.request().method() !== 'GET') return route.fallback();
        await route.fulfill({ status: 500, contentType: 'application/json', body: JSON.stringify({ code: 'INTERNAL', requestId: 'qa-e03-mock' }) });
      };
      const matcher = (url: URL): boolean => url.pathname === latestPath;
      await page.route(matcher, handler);
      await page.goto(ROUTES.project.pipeline(project.id));
      // PR:258-272: not a missing project → InlineAlert + "Thử lại", then the code and "Liên hệ hỗ trợ".
      const retry = page.getByRole('alert').getByRole('button', { name: PROCESSING.retry, exact: true });
      await expect(retry).toBeVisible({ timeout: 45_000 });
      const support = page.getByRole('button', { name: PROCESSING.support, exact: true });
      await expect(support).toBeVisible();
      await expect(page.locator('span.font-mono').first()).toHaveText(/\S+/u); // PR:265 technicalCode
      await captureEvidence(page, 'E03_pipeline_read_500.png');
      await attachJson('E03_pipeline_read_500.json', { technicalCode: await page.locator('span.font-mono').first().innerText() });
      await page.unroute(matcher, handler);
      await retry.click();
      await expect(page.getByText(PROCESSING.emptyTitle, { exact: true })).toBeVisible();

      await page.route(matcher, handler);
      await page.reload();
      await expect(support).toBeVisible({ timeout: 45_000 });
      await support.click(); // UPR:831-840 → ROUTES.account
      await expect.poll(() => pathOf(page)).toBe(ROUTES.account);
      await page.unroute(matcher, handler);
    });
  });

  test('E03 · SCR-12 [P15 P16] finished run: "Tiến độ theo tầng" chip aria-current + "đã xong"; "Số đối tượng đã nhận theo tầng" row', async ({ browser }) => {
    test.setTimeout(PIPELINE_TIMEOUT_MS + 120_000);
    await withAdmin(browser, async (admin) => {
      const { page } = admin;
      const project = await seeded(admin, async (api) => (await createPipelineDrawingProject(api, 'e03-pchips', readFileSync(drawingPng()))).projectId);
      await page.goto(ROUTES.project.pipeline(project.id));
      await expect(page.getByText(/^Đã xong 1\/1 tầng/u)).toBeVisible();
      const floor = firstFloor(project);
      const chip = page.getByRole('list', { name: CHIPS_LIST, exact: true }).getByRole('listitem'); // PFC:20-50
      await expect(chip).toHaveCount(1);
      await expect(chip).toHaveAttribute('aria-current', 'true');
      await expect(chip).toContainText(floor.name);
      await expect(chip).toContainText('đã xong'); // UPR:147
      const objects = page.getByRole('list', { name: OBJECTS_LIST, exact: true }).getByRole('listitem'); // PR:161-180
      await expect(objects).toHaveCount(1);
      await expect(objects).toContainText(floor.name);
      await expect(objects).toContainText(/\d+\s+đối tượng/u); // UPR:951-954 countLabel (N16 extraction)
      await captureEvidence(page, 'E03_pipeline_floor_chips.png');
    });
  });

  test('E03 · SCR-12 [P18] at 375 px a finished run shows the step bar "Bước đang xử lý" + "Xem tất cả các bước" (opens the list)', async ({ browser }) => {
    test.setTimeout(PIPELINE_TIMEOUT_MS + 120_000);
    await withAdmin(
      browser,
      async (admin) => {
        const { page } = admin;
        const project = await seeded(admin, async (api) => (await createPipelineDrawingProject(api, 'e03-pbar', readFileSync(drawingPng()))).projectId);
        await page.goto(ROUTES.project.pipeline(project.id));
        await expect(page.getByText(/^Đã xong 1\/1 tầng/u)).toBeVisible();
        // PR:182-196 isSheet below 1024 px: ProcessingStepBar (PSB:56-75) + <details> "Xem tất cả các bước".
        await expect(page.getByRole('group', { name: STEP_BAR, exact: true })).toBeVisible();
        const details = page.locator('details').filter({ has: page.getByText(ALL_STEPS, { exact: true }) });
        await expect(details).not.toHaveAttribute('open', '');
        await page.getByText(ALL_STEPS, { exact: true }).click();
        await expect(details).toHaveAttribute('open', '');
        expect(await horizontalOverflow(page), 'no horizontal scroll at 375 px').toBeLessThanOrEqual(0);
        await captureEvidence(page, 'E03_pipeline_compact_steps.png', { fullPage: true });
      },
      { viewport: COMPACT },
    );
  });
});
