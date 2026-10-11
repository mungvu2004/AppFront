/**
 * Phase 2 — Dashboard EDGE CASES, Track A (admin): SCR-05 dashboard `/` + the "Tạo dự án mới" wizard,
 * SCR-06 notifications (bell drawer + `/thong-bao`), SCR-07 onboarding `/onboarding`. Gaps left by
 * `phase02_dashboard.spec.ts`; inventory in `qa/coverage/phase02.md` (FE stamp 5afd8b8a).
 *
 * Every expected result cites the FE source of this worktree (5afd8b8a) or, written `BE:`, the AppBack source.
 * Source abbreviations (same as the coverage file):
 *   PD  src/screens/dashboard/ProjectDashboard/ProjectDashboard.tsx      UPD useProjectDashboard.ts (same folder)
 *   PDC ProjectDashboard.container.tsx  DS DashboardSidebar.tsx  PCT ProjectCardTile.tsx  PMG projectMenuGroups.ts
 *   PG  projectsGateway.ts              CPM src/screens/project/CreateProjectModal/CreateProjectModal.tsx
 *   UCPM useCreateProjectModal.ts       SF StepFloors.tsx  CPC CreateProjectModal.container.tsx
 *   NC  src/screens/system/NotificationCenter/NotificationCenter.tsx      UNC useNotificationCenter.ts
 *   NCC NotificationCenter.container.tsx  NM notificationModel.ts  NCG notificationCenterGateway.ts
 *   WS  src/screens/onboarding/WelcomeScreen/WelcomeScreen.tsx  UWS useWelcomeScreen.ts  WSC WelcomeScreen.container.tsx
 *   NF  src/hooks/useNumericField.ts  CM src/components/canvas/ContextMenu.tsx  MOD src/components/overlay/Modal.tsx
 *   DRW src/components/overlay/Drawer.tsx  TST src/components/feedback/Toast.tsx  LIM src/domain/project/limits.ts
 *
 * ## Non-serial
 * Every test opens its OWN browser context and builds its own preconditions: its own projects through the real API
 * (`POST /api/projects`, named `qa-<runId>-…`, deleted in `finally` — also any project the wizard created in that
 * context), its own viewport, its own cleared onboarding flag. No test reads another test's result. The session is
 * the only thing carried: the storage state of the previous test's context (cookie rotated by every page load) is
 * handed to the next one; when that cookie is refused (a test died before saving it) the helper signs in again.
 *
 * ## Mocks ("[mocked response]" in the title) — only states the shared stack cannot produce safely
 * - `GET /api/project-summaries` 500 (dashboard, onboarding, dashboard held-then-500) and `GET /api/notifications`
 *   500 — unpairable: 5xx.
 * - `GET /api/project-summaries` aborted (dashboard offline) and `POST /api/projects` network loss — unpairable:
 *   network loss.
 * - `GET /api/project-summaries` with one extra row the FE cannot decode — unpairable: the BE never emits it.
 * - `GET /api/project-summaries` `{items: []}` — the admin always holds CP-2; pair = an API test with a user who has
 *   no project (listed as "pair needed" in coverage/phase02.md).
 * - `GET /api/project-summaries` split over two cursor pages, and page 2 answered 422 `CURSOR_INVALID` — paired:
 *   `phase02_dashboard_api.spec.ts` "A02 · N1: … id ASC cursor paging, forged cursor → 422 CURSOR_INVALID".
 * - `GET /api/project-summaries` with one fixture row turned "qc" / "done" — unpairable now: those statuses need an
 *   uploaded drawing and reviewed walls (Phase 3/4 data, BE:apps/api/projects/summaries.py:181-187).
 * - `PATCH` / `DELETE /api/projects/:id` 403 `FORBIDDEN` — paired: `phase02_dashboard_api.spec.ts` "A02 · role/owner
 *   matrix" (`role_viewer_member_patch_403`, `role_viewer_member_delete_403`); the admin itself is never refused.
 * - `PATCH` / `DELETE /api/projects/:id` 500 — unpairable: 5xx.
 * Every mocked body is written with an explicit status / content type / body (BUG-142: never `{ response, json }`,
 * which keeps the real `content-length` / `content-encoding`).
 * "[held response]" = the real response, only delayed, to see a transient state (loading, submitting, a race).
 *
 * ## Writes on the real stack
 * Own `qa-<runId>-…` projects only (created/renamed/deleted). CP-2 is never touched: the create toast "Hoàn tác" is
 * clicked only on a project this file just created (R6 forbids it for CP-2). Notifications: "mark read" is
 * irreversible on the server; at most TWO admin notifications are marked read per run (the after-window test and
 * an unread row clicked when no read row exists), and only when they exist.
 *
 * ## Real-backend budget per run (BE:apps/api/auth/settings.py:31-36, login_guard.py)
 * - `POST /api/auth/login` (30 / 60 s per IP): ONE UI sign-in when the worker starts; Playwright restarts the worker
 *   after a failed test, so +1 per failed test (each failure costs ≥ 15 s, so ≤ 4 sign-ins a minute even then),
 *   and +1 if a carried cookie is refused. No failed login attempt at all.
 * - `POST /api/auth/refresh` (300 / 60 s per IP): one per page load, ~2–4 per test (~130 for the file over many
 *   minutes) — never close to the window.
 * - `POST /api/projects`: ~45 API fixtures (~26 from the SCR-05 "errors, races, table, paging" block, 4 for the unreadable-row test) + 1 UI
 *   create (+1 refused 422); every one deleted in `finally` (no rate limit on this route, BE:apps/api/projects/router.py).
 * - `PATCH` / `DELETE /api/projects/:id`: only on this file's own `qa-<runId>-…` projects (~12 real PATCH, ~5 real DELETE).
 * - QA-02 shared-components block (FE 271538cb, last describe): +7 API fixtures (each deleted), 1 real DELETE, 2 real PATCH,
 *   ~18 refreshes, 0 extra sign-in; 1 [mocked response] test (N1 500, unpairable: 5xx).
 * - No recovery / invitation / mail call (Mailpit not needed in this phase).
 * Access tokens live 600 s (BE settings.py:31): each test reuses the token of its own sign-in/refresh, well inside.
 */
import { expect, test } from '@playwright/test';
import type { Browser, BrowserContext, Locator, Page, Response, Route } from '@playwright/test';

import { ROUTES } from '../../e2e/fixtures/routes';
import { waitForApi, waitForApiWhere, watchApi } from '../../e2e/fullstack/apiWatch';
import type { ApiEntry, ApiResult } from '../../e2e/fullstack/apiWatch';
import { readBaseUrl } from '../../e2e/fullstack/env';
import { apiBaseUrl } from './support/api';
import { dashboardLoaded, signInAdmin } from './support/auth';
import { TEST_DATA_PREFIX, attachJson, captureEvidence } from './support/evidence';

/* ---------------------------------------------------------------- constants (each cites its source) */

/** `src/api/endpoints.ts:3,13,188-213,277` under the `/api` base; refresh = `src/lib/auth/session.ts:43`. */
const SUMMARIES_API = '/api/project-summaries';
const SUMMARIES_RE = /^\/api\/project-summaries$/u;
const PROJECTS_API = '/api/projects';
const PROJECTS_RE = /^\/api\/projects$/u;
const NOTIFICATIONS_API = '/api/notifications';
const MARK_READ_API = '/api/notifications/read';
const MARK_READ_RE = /^\/api\/notifications\/read$/u;
const MARK_ALL_READ_API = '/api/notifications/read-all';
const STREAM_PATH = '/api/streams/notifications';
const REFRESH_PATH = '/api/auth/refresh';

/** `src/lib/mutations/undoTicket.ts:18`. */
const UNDO_WINDOW_MS = 8_000;
const SESSION_TIMEOUT_MS = 30_000;
/** Error states sit behind the http client's retry and the query's own retry (`cachePolicy.ts:79-82`). */
const SLOW_STATE_MS = 45_000;

const DESKTOP = { width: 1440, height: 900 } as const;
const COMPACT = { width: 375, height: 812 } as const;
type Viewport = { readonly width: number; readonly height: number };

/** Sr-only screen state, PD:74-82 / CPM:75-83. */
const STATE = {
  empty: 'rỗng',
  loading: 'đang tải',
  partial: 'một phần',
  error: 'lỗi',
  success: 'thành công',
  collapsed: 'thu gọn',
} as const;
const STATE_RE = /^(rỗng|đang tải|một phần|lỗi|thành công|Không có quyền|thu gọn)$/u;

/* SCR-05 dashboard copy. */
const MENU_LABEL = 'Tuỳ chọn'; // CM:102 (NOT "Tùy chọn": tone-mark placement changed in c6e6b126)
const RENAME_RANGE_MESSAGE = 'Tên dự án cần từ 3 đến 80 ký tự.'; // UPD:198, LIM:22-23 (FE length check, before any request)
const RENAME_CHARS_MESSAGE = 'Tên dự án có ký tự không dùng được, như ký tự điều khiển hoặc ký tự đảo chiều chữ. Tên cũ đã được giữ lại.'; // useProjectDashboard.ts (BUG-168: server 422 on control / bidi characters)
const RENAME_GONE = 'Dự án này không còn nữa.'; // UPD:208
const RENAME_FORBIDDEN = 'Bạn không có quyền đổi tên dự án này.'; // UPD:205-206
const RENAME_FAILED = 'Không đổi được tên dự án. Hãy thử lại.'; // UPD:209-210 (any other code, or none)
const DELETE_FORBIDDEN = 'Bạn không có quyền xoá dự án này.'; // UPD:215-217
const DELETE_FAILED = 'Không xoá được dự án. Hãy thử lại.'; // UPD:218
const TABLE_HEADERS = ['Tên dự án', 'Trạng thái', 'Chi tiết', 'Tiến độ duyệt', 'Cập nhật'] as const; // PD:284-288
const reviewProgress = (reviewed: number, total: number): string => `${String(reviewed)}/${String(total)} tường đã duyệt`; // UPD:329
/** The BE error envelope `{code, requestId}` (BE:apps/api/core/errors.py:3, :84); the FE reads `code` (lib/http/client.ts:154-170). */
const wireError = (code: string): Json => ({ code, requestId: 'qa-mocked-response' });
const DELETE_TITLE = 'Xoá dự án?'; // PD:331
const deleteBody = (name: string): string => `"${name}" và toàn bộ bản vẽ, mô hình liên quan sẽ bị xoá vĩnh viễn.`; // PD:336
const NOT_UNDOABLE = 'Không hoàn tác được.'; // PD:340
const KEEP = 'Để nguyên'; // PD:347
const CONFIRM_DELETE = 'Xoá dự án'; // PD:350
const LIST_ERROR_TITLE = 'Không tải được danh sách dự án'; // PD:254
const RETRY = 'Thử lại'; // PD:256, NC:60, WS:69
const EMPTY_TITLE = 'Chưa có dự án nào'; // PD:261
const EMPTY_DESCRIPTION = 'Tạo dự án đầu tiên để bắt đầu số hoá bản vẽ.'; // PD:264 (canCreate)
const EMPTY_ACTION = 'Tạo dự án mới'; // PD:267
const CLEAR_FILTERS = 'Xoá bộ lọc'; // PD:274
const COMPACT_FILTER = 'Lọc theo trạng thái'; // PD:231
const STATS = { all: 'Tổng dự án', done: 'Hoàn thành', qc: 'Cần QC', processing: 'Đang xử lý' } as const; // src/i18n/vi.json:415-418
const FILTERS = { all: 'Tất cả', processing: 'Đang xử lý', qc: 'Cần QC', done: 'Hoàn thành' } as const; // UPD:76-81
const SORT = { updated: 'Cập nhật gần đây', name: 'Tên A–Z', floors: 'Số tầng nhiều nhất', area: 'Diện tích lớn nhất' } as const; // UPD:83-88
const unreadRowsNotice = (count: number): string => `Có ${String(count)} dự án chưa đọc được`; // UPD:482
const renamedToast = (name: string): string => `Đã đổi tên thành "${name}"`; // UPD:424
const createdToast = (name: string): string => `Đã tạo dự án "${name}".`; // UCPM:669

/* Wizard copy. */
const stepLabel = (step: number): string => `Bước ${String(step)} / 3`; // UCPM:684
const NAME_REQUIRED = 'Chưa nhập tên dự án.'; // UCPM:145
const NAME_TOO_SHORT = 'Tên dự án cần ít nhất 3 ký tự.'; // UCPM:148, LIM:22
const CODE_HINT = 'Tự tạo từ tên, sửa được'; // CPM:114
const DISCARD_TITLE = 'Đóng và bỏ các thay đổi chưa lưu?'; // CPM:252
const DISCARD_HINT = 'Nhấn Esc lần nữa hoặc bấm "Đóng, bỏ thay đổi" để đóng.'; // CPM:253
const DISCARD_ACTION = 'Đóng, bỏ thay đổi'; // CPM:254
const CLOSE_DIALOG = 'Đóng hộp thoại'; // MOD:167
const HEIGHT_MISSING = 'Chưa nhập chiều cao thông thuỷ.'; // UCPM:113
const CHAIN_BROKEN = 'Chưa tính được cao độ vì tầng bên dưới còn thiếu chiều cao hợp lệ.'; // UCPM:235
const ELEVATION_LIMIT = /^Cao độ vượt giới hạn cho phép \([-−]30 đến 300 mét\)\.$/u; // UCPM:131-132, LIM:30-31
const NUMERIC_MIN = 'Giá trị không nhỏ hơn 2 m.'; // NF:43, LIM:34 (SF:98,134 pass min)
const NUMERIC_MAX = 'Giá trị không quá 10 m.'; // NF:44, LIM:35
const APPLY_LABEL = 'Chiều cao áp cho mọi tầng'; // SF:131
const APPLY_ALL = 'Áp cho mọi tầng'; // SF:145
const ADD_FLOOR = 'Thêm tầng'; // SF:63,127
const BASEMENT_TOGGLE = 'Có tầng hầm'; // SF:38
const BASEMENT_NAME = 'Tầng hầm'; // UCPM:602
const NO_FLOORS = 'Chưa có tầng nào'; // SF:61
const NO_FLOORS_HINT = 'Thêm ít nhất một tầng để sang bước xem lại.'; // SF:62
const VALIDATION_DESCRIPTION = 'Kiểm tra lại các trường được đánh dấu rồi thử lại.'; // src/i18n/vi.json errors.validation (the wizard shows it only for a 422 that names no field)
const CODE_TOO_LONG = 'Mã dự án không quá 32 ký tự.'; // vi.json project.createModal.problems.codeTooLong
const NETWORK_DESCRIPTION = 'Không liên lạc được với máy chủ. Kiểm tra mạng rồi thử lại.'; // src/i18n/vi.json:15 (errors.network)
const FLOOR_COUNT_MAX = 50; // LIM:27

/* SCR-06 copy. */
const MARK_READ = 'Đánh dấu đã đọc'; // NC:56
const MARK_ALL_READ = 'Đánh dấu tất cả đã đọc'; // NC:55
const NOTIF_SETTINGS = 'Mở cài đặt thông báo'; // NC:57
const NOTIF_FILTER = 'Lọc thông báo'; // NC:58
const VIEW_ALL = 'Xem tất cả'; // NC:59
const NOTIF_EMPTY = 'Không có thông báo mới'; // NotificationCenter.tsx EMPTY_COPY.all
const NOTIF_PARTIAL = 'Có thể chưa cập nhật'; // NotificationCenter.tsx PARTIAL_NOTICE (a failed write; a filter with no match is no longer "partial", BUG-179)
/** One empty-state sentence per tab (BUG-126), with "Hiện mọi thông báo" on the two filtered ones. */
const NOTIF_EMPTY_BY_FILTER = { all: NOTIF_EMPTY, unread: 'Không có thông báo chưa đọc', mentions: 'Chưa có ai nhắc đến bạn' } as const;
const NOTIF_SHOW_EVERYTHING = 'Hiện mọi thông báo';
const NOTIF_ERROR_TITLE = 'Không tải được thông báo'; // NC:68
const NOTIF_FILTERS = { all: 'Tất cả', unread: 'Chưa đọc', mentions: 'Nhắc đến tôi' } as const; // NM:114-118
const MENTION_ACTION = 'Xem bình luận'; // NCG:181 (the only kind filtered by "Nhắc đến tôi", UNC:331-332)
const LIVE = {
  empty: 'Không có thông báo nào', // UNC:156
  allRead: 'Không còn thông báo chưa đọc', // UNC:157
  loadFailed: 'Không đọc được danh sách thông báo', // UNC:158
  unread: (badge: string): string => `Có ${badge} thông báo chưa đọc`, // UNC:166-168
} as const;
const MARKED_READ = 'Đã đánh dấu là đã đọc'; // UNC:161
const MARKED_ALL_READ = 'Đã đánh dấu tất cả là đã đọc'; // UNC:160
const SHEET_GROUP = 'Chiều cao tấm trượt'; // DRW:245
const snapButton = (level: number): string => `Mức ${String(level)}`; // DRW:252
/** "9+" above UNREAD_BADGE_CAP 9 (NM:128, UNC:800-803); empty string = nothing unread (UNC:932). */
const badgeFor = (unread: number): string => (unread === 0 ? '' : unread > 9 ? '9+' : String(unread));

/* SCR-07 copy, UWS:122-146 (STRINGS) and WS:67-70. */
const WELCOME_SEEN_PREFIX = 'appfront:onboarding-welcome-seen:'; // UWS:164
const ONBOARD = {
  step1Title: 'Tạo dự án',
  step1Action: 'Tạo dự án',
  step2Action: 'Tải bản vẽ',
  step2Locked: 'Cần tạo dự án trước.',
  step3Action: 'Duyệt kết quả',
  step3Locked: 'Cần tải bản vẽ trước.',
  sample: 'Xem dự án mẫu',
  tutorial: 'Xem hướng dẫn 2 phút',
  tutorialDisabled: 'Hướng dẫn hai phút chưa sẵn sàng.',
  skip: 'Bỏ qua',
  skipNotice: 'Màn chào sẽ không hiện lại trên trình duyệt này.',
  errorTitle: 'Không đọc được tiến độ', // WS:67
  errorDescription: 'Chưa lấy được danh sách dự án nên chưa biết bạn đang ở bước nào.',
} as const;
const GREETING = /^Chào .+, bắt đầu trong ba bước$/u; // UWS:123-125

/* ---------------------------------------------------------------- small helpers */

type Json = Record<string, unknown>;

const asRecord = (value: unknown, what: string): Json => {
  if (typeof value !== 'object' || value === null || Array.isArray(value)) {
    throw new Error(`${what}: body is not a JSON object`);
  }
  return value as Json;
};

const stringField = (record: Json, key: string, what: string): string => {
  const value = record[key];
  if (typeof value !== 'string' || value === '') throw new Error(`${what}: missing string field "${key}"`);
  return value;
};

const escapeRegExp = (text: string): string => text.replace(/[.*+?^${}()|[\]\\]/gu, '\\$&');
/** BUG-140: `String.raw` keeps the `\D` a template string would drop; "Tất cả1" ends in the count after a non-digit. */
const endsWithCount = (count: number): RegExp => new RegExp(String.raw`(^|\D)${String(count)}$`, 'u');
const pathname = (page: Page): string => new URL(page.url()).pathname;
const projectPathRe = (id: string): RegExp => new RegExp(`^/api/projects/${escapeRegExp(id)}$`, 'u');
const uniqueName = (slug: string): string => `${TEST_DATA_PREFIX}${slug}-${Date.now().toString(36)}`;
const countApi = (api: readonly ApiEntry[], method: string, path: string): number =>
  api.filter((entry) => entry.method === method && entry.path === path).length;

/** A promise the test opens by hand — holds a real response ("[held response]"). */
function gate(): { readonly wait: Promise<void>; readonly open: () => void } {
  let open: () => void = () => undefined;
  const wait = new Promise<void>((resolve) => {
    open = resolve;
  });
  return { wait, open };
}

/** One project as N1 sends it (`src/api/schemas/projectSummaries.ts`). */
interface Summary {
  readonly id: string;
  readonly name: string;
  readonly status: string;
  readonly floorCount: number;
  readonly areaM2: number;
  readonly updatedAtMs: number;
  readonly wallsTotalCount: number;
  readonly wallsReviewedCount: number;
  readonly defaultFloorId: string | undefined;
}

function summariesOf(json: unknown): Summary[] {
  const body = asRecord(json, 'GET /api/project-summaries');
  expect(body.nextCursor, 'N1 fits one page (limit 500, PG:60) — the derivations below read one page').toBeUndefined();
  const items = body.items;
  if (!Array.isArray(items)) throw new Error('GET /api/project-summaries: "items" is not an array');
  return items.map((item, index) => {
    const row = asRecord(item, `items[${String(index)}]`);
    const what = `items[${String(index)}]`;
    return {
      id: stringField(row, 'id', what),
      name: stringField(row, 'name', what),
      status: stringField(row, 'status', what),
      floorCount: Number(row.floorCount),
      areaM2: Number(row.areaM2),
      updatedAtMs: Date.parse(stringField(row, 'updatedAt', what)),
      wallsTotalCount: Number(row.wallsTotalCount),
      wallsReviewedCount: Number(row.wallsReviewedCount),
      defaultFloorId: typeof row.defaultFloorId === 'string' ? row.defaultFloorId : undefined,
    };
  });
}

/** `derivedStatusOf` (UPD:192-196): the green "done" is earned by the review count, never read off `status`. */
const derivedStatus = (s: Summary): 'processing' | 'qc' | 'done' =>
  s.wallsTotalCount > 0 && s.wallsReviewedCount >= s.wallsTotalCount ? 'done' : s.status === 'processing' ? 'processing' : 'qc';

/** `routeForProject` (UPD:221-232). */
const openPathOf = (s: Summary): string => {
  const status = derivedStatus(s);
  if (status === 'processing') return ROUTES.project.pipeline(s.id);
  if (status === 'done') return ROUTES.project.viewer(s.id);
  return s.defaultFloorId === undefined ? ROUTES.project.floors(s.id) : ROUTES.project.walls(s.id, s.defaultFloorId);
};

/** The list order the gateway hands the hook (PG:104-106): newest first, id as the tie-break. */
const gatewayOrder = (list: readonly Summary[]): Summary[] =>
  [...list].sort((a, b) => b.updatedAtMs - a.updatedAtMs || a.id.localeCompare(b.id));

const summaryOf = (list: readonly Summary[], id: string): Summary => {
  const found = list.find((s) => s.id === id);
  if (found === undefined) throw new Error(`project ${id} is not in GET /api/project-summaries`);
  return found;
};

type StatusKey = 'all' | 'processing' | 'qc' | 'done';
/** `statusCounts` (UPD:339-350): over every project of N1, never over the filtered rows. */
function countsOf(list: readonly Summary[]): Record<StatusKey, number> {
  const counts = { all: list.length, processing: 0, qc: 0, done: 0 };
  for (const s of list) counts[derivedStatus(s)] += 1;
  return counts;
}

/** N1 `items` arrays, raw (the shape `route.fetch()` hands back). */
const rawItems = (json: unknown): unknown[] => {
  const items = asRecord(json, 'GET /api/project-summaries').items;
  return Array.isArray(items) ? items : [];
};

/* ---------------------------------------------------------------- locators (labels verified in src/) */

const dashboardHeading = (page: Page): Locator => page.getByRole('heading', { name: 'Dự án của tôi', exact: true }); // PD:198
const projectList = (page: Page): Locator => page.getByRole('list', { name: 'Danh sách dự án', exact: true }); // PD:151
const projectCards = (page: Page): Locator => projectList(page).locator('article[role="listitem"]'); // PCT:68-72
const projectCard = (page: Page, name: string): Locator => projectList(page).getByRole('listitem', { name, exact: true });
const searchBox = (page: Page): Locator => page.getByRole('searchbox', { name: 'Tìm dự án', exact: true }); // PD:175-183
const noMatch = (page: Page): Locator => page.getByText('Không tìm thấy dự án phù hợp', { exact: true }); // PD:272
const wizard = (page: Page): Locator => page.getByRole('dialog', { name: 'Tạo dự án mới', exact: true }); // CPM:243-245
const toastWith = (page: Page, text: string): Locator => page.getByRole('status').filter({ hasText: text }); // TST:117
/** DS:62-74: label + count spans inside one `aria-pressed` button. */
const statusFilterButton = (page: Page, label: string): Locator =>
  page.getByRole('button', { name: new RegExp(`^${escapeRegExp(label)}\\s*\\d+$`, 'u') });
const stateAnnouncement = (scope: Page | Locator): Locator => scope.getByRole('status').filter({ hasText: STATE_RE });
const countLine = (page: Page): Locator => page.getByText(/^\d+ dự án$/u); // PD:187
const sortCombobox = (page: Page, current: string): Locator => page.getByRole('combobox').filter({ hasText: current }); // PD:204-209
const viewMode = (page: Page): Locator => page.getByRole('radiogroup', { name: 'Kiểu xem', exact: true }); // PD:210-218
/** Sidebar stat card value: the number span right before its label (DS:44-57). */
const statValue = (page: Page, label: string): Locator =>
  page.locator('aside > div').first().getByText(label, { exact: true }).locator('xpath=preceding-sibling::span[1]');
/** Table view rows (PD:291-314); `thead th` (BUG-115 fixed: `th` now has scope="col", so getByRole('columnheader') would find the same cells). */
const tableRows = (page: Page): Locator => page.getByRole('main').locator('tbody tr');
const tableHeads = (page: Page): Locator => page.getByRole('main').locator('thead th');
const tableRow = (page: Page, name: string): Locator =>
  tableRows(page).filter({ has: page.locator('td:first-child', { hasText: new RegExp(`^${escapeRegExp(name)}$`, 'u') }) });
const cardMenu = (page: Page): Locator => page.getByRole('menu', { name: MENU_LABEL, exact: true }); // CM:99-102
const deleteDialog = (page: Page): Locator => page.getByRole('dialog', { name: DELETE_TITLE, exact: true }); // PD:329-331
const bell = (page: Page): Locator => page.getByRole('button', { name: 'Thông báo', exact: true }); // NC:389-391
const notificationDrawer = (page: Page): Locator => page.getByRole('dialog', { name: 'Thông báo', exact: true }); // NC:288, DRW:146-148
const nameField = (dialog: Locator): Locator => dialog.getByLabel('Tên dự án'); // CPM:100-108
const codeField = (dialog: Locator): Locator => dialog.getByLabel('Mã dự án'); // CPM:109-115
const nextButton = (dialog: Locator): Locator => dialog.getByRole('button', { name: 'Tiếp tục', exact: true }); // CPM:288-290
const createButton = (dialog: Locator): Locator => dialog.getByRole('button', { name: 'Tạo dự án', exact: true }); // CPM:292-294
const stepText = (dialog: Locator, step: number): Locator => dialog.getByText(stepLabel(step), { exact: true }).first(); // CPM:259-262
/** One floor row of step 2, found by its name box (SF:87-92). */
const floorRow = (dialog: Locator, page: Page, floorName: string): Locator =>
  dialog.getByRole('row').filter({ has: page.getByRole('textbox', { name: `Tên tầng ${floorName}`, exact: true }) });
const elevationCell = (row: Locator): Locator => row.getByRole('cell').nth(2); // SF:106
/** Step 3 value cell: FieldRow label span → its column div → the sibling value column (FieldRow.tsx:66-76). */
const reviewValue = (dialog: Locator, label: string): Locator =>
  dialog.getByText(label, { exact: true }).locator('xpath=../following-sibling::div[1]');

async function openWizard(page: Page): Promise<Locator> {
  // The button carries the `N` shortcut hint, hence the prefix match (PD:188-190, Button.tsx:102-106).
  await page.getByRole('button', { name: /^Dự án mới/u }).click();
  const dialog = wizard(page);
  await expect(dialog).toBeVisible();
  return dialog;
}

/** Dirty form: "Huỷ" asks first, "Đóng, bỏ thay đổi" closes (UCPM:624-639). */
async function discardWizard(dialog: Locator): Promise<void> {
  await dialog.getByRole('button', { name: 'Huỷ', exact: true }).click();
  await dialog.getByRole('button', { name: DISCARD_ACTION, exact: true }).click();
  await expect(dialog).toHaveCount(0);
}

async function toStep2(dialog: Locator, name: string): Promise<void> {
  await nameField(dialog).fill(name);
  await nextButton(dialog).click();
  await expect(stepText(dialog, 2)).toBeVisible();
}

/** Types a shared height, blurs (NF:105-111 commits on blur) and applies it to every row (UCPM:590-594). */
async function applyHeight(dialog: Locator, metres: string): Promise<void> {
  const field = dialog.getByLabel(APPLY_LABEL);
  await field.fill(metres);
  await field.press('Tab');
  const apply = dialog.getByRole('button', { name: APPLY_ALL, exact: true });
  await expect(apply).toBeEnabled();
  await apply.click();
}

async function openCardMenu(page: Page, name: string): Promise<Locator> {
  await page.getByRole('button', { name: `Tuỳ chọn cho ${name}`, exact: true }).click(); // PCT:97-107
  const menu = page.getByRole('menu', { name: MENU_LABEL, exact: true });
  await expect(menu).toBeVisible();
  return menu;
}

/** Menu "Đổi tên" (PMG:24) → the inline box `Đổi tên {name}` with focus (PCT:112-125). */
async function startRename(page: Page, name: string): Promise<Locator> {
  const menu = await openCardMenu(page, name);
  await menu.getByRole('menuitem', { name: 'Đổi tên', exact: true }).click();
  const input = page.getByRole('textbox', { name: `Đổi tên ${name}`, exact: true });
  await expect(input).toBeFocused();
  return input;
}

/** Bell drawer, settled on a day group, the empty state, the "no match" notice or the error (NC:243-285). */
async function openDrawer(page: Page): Promise<Locator> {
  const drawer = notificationDrawer(page);
  if ((await drawer.count()) === 0) await bell(page).click();
  await expect(drawer).toBeVisible();
  await expect(
    drawer
      .locator('section')
      .first()
      .or(drawer.getByText(NOTIF_EMPTY, { exact: true }))
      .or(drawer.getByText(NOTIF_PARTIAL, { exact: true }))
      .or(drawer.getByText(NOTIF_ERROR_TITLE, { exact: true }))
      .first(),
  ).toBeVisible();
  return drawer;
}

async function clearSeenFlags(page: Page): Promise<void> {
  await page.evaluate((prefix) => {
    for (const key of Object.keys(window.localStorage)) {
      if (key.startsWith(prefix)) window.localStorage.removeItem(key);
    }
  }, WELCOME_SEEN_PREFIX);
}

/* ---------------------------------------------------------------- session + fixtures */

type StorageState = Awaited<ReturnType<BrowserContext['storageState']>>;

/** Storage state of the last closed context — its refresh cookie is the live one. Reset with the worker. */
let carriedState: StorageState | undefined;

interface Admin {
  readonly context: BrowserContext;
  readonly page: Page;
  readonly api: ApiEntry[];
  /** Access token of this context's latest refresh — sent as Bearer by the fixture calls, never logged. */
  readonly token: string;
  readonly userId: string;
  /** Project ids this test owns; deleted when the context closes. */
  readonly cleanup: string[];
}

interface SessionInfo {
  readonly token: string;
  readonly userId: string;
}

/** Refresh body: `accessToken`/`access_token`, optional `data` wrapper (src/lib/auth/refresh.ts:85-100). */
function readSession(json: unknown): SessionInfo {
  const body = asRecord(json, 'POST /api/auth/refresh');
  const root = typeof body.data === 'object' && body.data !== null ? asRecord(body.data, 'refresh.data') : body;
  const token =
    typeof root.accessToken === 'string' ? root.accessToken : typeof root.access_token === 'string' ? root.access_token : '';
  if (token === '') throw new Error('POST /api/auth/refresh: no access token in the body');
  return { token, userId: stringField(asRecord(root.user, 'refresh.user'), 'id', 'refresh.user') };
}

const waitSession = (page: Page): Promise<SessionInfo> => {
  const pending = page
    .waitForResponse(
      (r: Response) =>
        r.request().method() === 'POST' && new URL(r.url()).pathname === REFRESH_PATH && r.status() === 200,
      { timeout: SESSION_TIMEOUT_MS },
    )
    .then(async (r) => readSession(await r.json()));
  pending.catch(() => undefined);
  return pending;
};

async function openAdmin(browser: Browser, viewport: Viewport = DESKTOP): Promise<Admin> {
  const context = await browser.newContext({
    baseURL: readBaseUrl(),
    viewport,
    ...(carriedState !== undefined ? { storageState: carriedState } : {}),
  });
  try {
    const page = await context.newPage();
    const api = watchApi(page);
    let session = waitSession(page);
    let landed: 'session' | 'login' = 'login';
    if (carriedState !== undefined) {
      await page.goto(ROUTES.dashboard, { waitUntil: 'commit' });
      landed = await Promise.race([
        session.then(() => 'session' as const),
        page
          .waitForURL((url) => url.pathname === ROUTES.login, { timeout: SESSION_TIMEOUT_MS })
          .then(() => 'login' as const),
      ]);
    }
    if (landed === 'login') {
      // No carried state, or its cookie was refused (SessionBootstrap sent us to /login): one real sign-in.
      session = waitSession(page);
      await signInAdmin(page);
    }
    const { token, userId } = await session;
    await dashboardLoaded(page);
    return { context, page, api, token, userId, cleanup: [] };
  } catch (error) {
    await context.close();
    throw error;
  }
}

const bearer = (admin: Admin): Record<string, string> => ({
  Origin: apiBaseUrl(),
  Authorization: `Bearer ${admin.token}`,
});

/** Fixture project through the real API (BE:apps/api/projects/router.py:54-63, `name` 3–80 chars, schemas.py:25-26). */
async function createProject(
  admin: Admin,
  slug: string,
  name: string = uniqueName(slug),
  floorCount?: number,
): Promise<{ readonly id: string; readonly name: string }> {
  expect(name.startsWith(TEST_DATA_PREFIX), `fixture name "${name}" carries the run's test-data prefix`).toBe(true);
  // `floorCount` (BUG-171): n stacked 3 m floors (`ProjectCreateIn.floors`, wire keys camelCase) so a sort has something to order.
  const floors =
    floorCount === undefined
      ? undefined
      : Array.from({ length: floorCount }, (_unused, index) => ({ name: `Tầng ${String(index + 1)}`, order: index, elevationMm: index * 3000, heightMm: 3000 }));
  const response = await admin.page.request.post(PROJECTS_API, {
    headers: bearer(admin),
    data: floors === undefined ? { name } : { name, floors },
  });
  expect(response.status(), `fixture POST ${PROJECTS_API} "${name}"`).toBe(201);
  const id = stringField(asRecord(await response.json(), 'POST /api/projects'), 'id', 'POST /api/projects');
  admin.cleanup.push(id);
  return { id, name };
}

async function deleteProject(admin: Admin, id: string): Promise<number> {
  const response = await admin.page.request.delete(`${PROJECTS_API}/${id}`, { headers: bearer(admin) });
  return response.status();
}

async function closeAdmin(admin: Admin): Promise<void> {
  // Anything the wizard created in this context is test data too.
  for (const entry of admin.api) {
    if (entry.method === 'POST' && entry.path === PROJECTS_API && (entry.status === 200 || entry.status === 201)) {
      const id = typeof entry.json === 'object' && entry.json !== null ? (entry.json as Json).id : undefined;
      if (typeof id === 'string' && !admin.cleanup.includes(id)) admin.cleanup.push(id);
    }
  }
  for (const id of admin.cleanup) {
    await deleteProject(admin, id).catch(() => 0);
  }
  try {
    carriedState = await admin.context.storageState();
  } catch {
    carriedState = undefined;
  }
  await admin.context.close().catch(() => undefined);
}

async function withAdmin(
  browser: Browser,
  body: (admin: Admin) => Promise<void>,
  viewport: Viewport = DESKTOP,
): Promise<void> {
  const admin = await openAdmin(browser, viewport);
  try {
    await body(admin);
  } finally {
    await closeAdmin(admin);
  }
}

/**
 * BUG-141: the shared `navigateThenWaitForApi` (e2e/fullstack/apiWatch.ts) used to await `navigate()` BEFORE it
 * registered the wait, so an N1 that answers before `reload({ waitUntil: 'commit' })` returns was missed and the test
 * timed out on a page that had loaded. The shared helper registers first since FIX-986 (and ignores responses of the
 * old document); this local one, which waits first and runs both together, is kept as it was.
 */
async function navigateAndWaitForApi(
  page: Page,
  navigate: () => Promise<unknown>,
  method: string,
  pathPattern: RegExp,
  statuses: readonly number[],
): Promise<ApiResult> {
  const [result] = await Promise.all([waitForApi(page, method, pathPattern, statuses), navigate()]);
  return result;
}

/** Full reload of `/`, returning the N1 body the page itself received. */
async function reloadDashboard(page: Page): Promise<Summary[]> {
  const { json } = await navigateAndWaitForApi(page, () => page.reload({ waitUntil: 'commit' }), 'GET', SUMMARIES_RE, [200]);
  await dashboardLoaded(page);
  return summariesOf(json);
}

const routeSummaries = (page: Page, handler: (route: Route) => Promise<void>): Promise<void> =>
  page.route((url) => url.pathname === SUMMARIES_API, handler);

/** Routes ONE method of `/api/projects/{id}`; every other method (and every other path) goes through untouched. */
const routeProject = (page: Page, id: string, method: string, handler: (route: Route) => Promise<void>): Promise<void> =>
  page.route(
    (url) => url.pathname === `${PROJECTS_API}/${id}`,
    async (route) => {
      if (route.request().method() !== method) {
        await route.fallback();
        return;
      }
      await handler(route);
    },
  );

/** BUG-142: an explicit status / content type / body — no header of a real response is carried over. */
const fulfillJson = (route: Route, status: number, body: unknown): Promise<void> =>
  route.fulfill({ status, contentType: 'application/json', body: JSON.stringify(body) });

const isSummariesResponse = (r: Response): boolean =>
  r.request().method() === 'GET' && new URL(r.url()).pathname === SUMMARIES_API;
const cursorOf = (r: Response): string | null => new URL(r.url()).searchParams.get('cursor');

/** Where focus sits now — an aria-label, else the tag (for JSON evidence; never a value). */
const focusedLabel = (page: Page): Promise<string> =>
  page.evaluate(() => {
    const el = document.activeElement;
    return el === null ? 'null' : (el.getAttribute('aria-label') ?? el.tagName.toLowerCase());
  });

/* ================================================================= SCR-05 dashboard */

test.describe('E02 SCR-05 dashboard (/)', () => {
  test('E02 · SCR-05 search ignores case and outer spaces; "Xoá bộ lọc" also resets the status filter', async ({ browser }) => {
    await withAdmin(browser, async (admin) => {
      const { page } = admin;
      const project = await createProject(admin, 'search');
      const list = await reloadDashboard(page);

      // UPD:272-276: `trim().toLowerCase()` + `includes`.
      const typed = `   ${project.name.toUpperCase()}   `;
      await searchBox(page).fill(typed);
      await expect(searchBox(page)).toHaveValue(typed);
      await expect(projectCards(page)).toHaveCount(1);
      await expect(projectCard(page, project.name)).toBeVisible();
      // BUG-135: this shot proves the trim + case match (padded upper-case query in the box, the one card it found).
      await captureEvidence(page, 'E02_search_trim_clear.png', {
        caption: `search "${typed}" (padded, upper case) → 1 card "${project.name}"`,
      });

      // A fixture with no floor is "processing" (BE:summaries.py:189), so "Hoàn thành" + this search match nothing.
      expect(derivedStatus(summaryOf(list, project.id))).toBe('processing');
      await statusFilterButton(page, FILTERS.done).click();
      await expect(noMatch(page)).toBeVisible();

      // `clearFilters` resets BOTH (UPD:490-493).
      await page.getByRole('button', { name: CLEAR_FILTERS, exact: true }).click();
      await expect(searchBox(page)).toHaveValue('');
      await expect(statusFilterButton(page, FILTERS.all)).toHaveAttribute('aria-pressed', 'true');
      await expect(projectCards(page)).toHaveCount(list.length);
      await captureEvidence(page, 'E02_search_trim_clear_reset.png', {
        caption: `"${CLEAR_FILTERS}" after search + "${FILTERS.done}" → search "", filter "${FILTERS.all}", ${String(list.length)} cards back`,
      });
    });
  });

  test('E02 · SCR-05 header and sidebar: "{n} dự án", four counters and filter counts follow N1; avatar shows initials', async ({ browser }) => {
    await withAdmin(browser, async (admin) => {
      const { page } = admin;
      const list = await reloadDashboard(page);
      const counts = countsOf(list); // UPD:339-350

      await expect(page.getByText(`${String(counts.all)} dự án`, { exact: true })).toBeVisible(); // PD:187
      for (const key of ['all', 'done', 'qc', 'processing'] as const) {
        await expect(statValue(page, STATS[key]), `stat card "${STATS[key]}"`).toHaveText(String(counts[key])); // DS:44-57
        await expect(statusFilterButton(page, FILTERS[key])).toHaveText(endsWithCount(counts[key])); // BUG-140
      }
      // BUG-031 regression: initials, never an empty circle (PDC:63, Avatar.tsx:38-43).
      await expect(page.locator('[aria-label="Tài khoản của bạn"]')).toHaveText(/^\S{1,2}$/u);
      await captureEvidence(page, 'E02_header_counts.png');
      await attachJson('E02_header_counts.json', { fromApi: counts, rows: list.length });
    });
  });

  test('E02 · SCR-05 sort "Số tầng nhiều nhất" / "Diện tích lớn nhất" follow N1; the sort list opens on Enter and closes on Esc', async ({ browser }) => {
    await withAdmin(browser, async (admin) => {
      const { page } = admin;
      // BUG-171: three fixtures whose floor-count order differs from the default "newest first" order (6, then 1, then 3
      // floors → newest first is 3,1,6; "Số tầng nhiều nhất" must give 6,3,1), so the shot can tell the two apart.
      const fixtures = [
        await createProject(admin, 'sort-six', undefined, 6),
        await createProject(admin, 'sort-one', undefined, 1),
        await createProject(admin, 'sort-three', undefined, 3),
      ];
      const list = gatewayOrder(await reloadDashboard(page));
      const cardNames = (): Promise<string[]> =>
        projectCards(page).evaluateAll((cards) => cards.map((card) => card.getAttribute('aria-label') ?? ''));

      // Keyboard on the legacy Select (useSelect.ts:40-53): Enter opens, Esc closes and gives focus back.
      const sort = sortCombobox(page, SORT.updated);
      await sort.focus();
      await page.keyboard.press('Enter');
      await expect(page.getByRole('listbox')).toBeVisible();
      await page.keyboard.press('Escape');
      await expect(page.getByRole('listbox')).toHaveCount(0);
      await expect(sort).toBeFocused();

      // UPD:288-291: stable sorts over the gateway order.
      await sort.click();
      await page.getByRole('option', { name: SORT.floors, exact: true }).click();
      await expect(sortCombobox(page, SORT.floors)).toBeVisible();
      const byFloors = [...list].sort((a, b) => b.floorCount - a.floorCount).map((s) => s.name);
      await expect.poll(cardNames).toEqual(byFloors);
      const fixtureOrder = (names: readonly string[]): string[] => names.filter((n) => fixtures.some((f) => f.name === n));
      expect(fixtureOrder(byFloors), 'fixtures by floor count: 6, 3, 1').toEqual([fixtures[0]!.name, fixtures[2]!.name, fixtures[1]!.name]);
      await captureEvidence(page, 'E02_sort_floors.png', { caption: `"${SORT.floors}": ${fixtureOrder(byFloors).map((n) => n.slice(-12)).join(' > ')} (6 > 3 > 1 floors)` });

      await sortCombobox(page, SORT.floors).click();
      await page.getByRole('option', { name: SORT.area, exact: true }).click();
      const byArea = [...list].sort((a, b) => b.areaM2 - a.areaM2).map((s) => s.name);
      await expect.poll(cardNames).toEqual(byArea);
      // Area is the sum of the floors' drawing areas (BE:summaries.py:218), which a fixture without drawings never gets:
      // every card says 0,00 m², so "Diện tích lớn nhất" is a tie that keeps the order — the caption says so.
      await captureEvidence(page, 'E02_sort_floors_area.png', {
        caption: `"${SORT.area}": every area is ${[...new Set(list.map((s) => s.areaM2))].join(', ')} m² → ties keep the gateway order`,
      });
      await attachJson('E02_sort_floors_area.json', { byFloors, byArea });
    });
  });

  test('E02 · SCR-05 keyboard: ArrowRight switches "Kiểu xem" to "Bảng", a row right-click opens the menu, Enter on it opens the project, Back restores the defaults', async ({ browser }) => {
    await withAdmin(browser, async (admin) => {
      const { page } = admin;
      const project = await createProject(admin, 'view');
      const expected = openPathOf(summaryOf(await reloadDashboard(page), project.id));

      await searchBox(page).fill(project.name);
      await expect(projectCards(page)).toHaveCount(1);
      const grid = viewMode(page).getByRole('radio', { name: 'Lưới', exact: true });
      const table = viewMode(page).getByRole('radio', { name: 'Bảng', exact: true });
      await grid.focus();
      await page.keyboard.press('ArrowRight'); // SegmentedControl.tsx:128-140
      await expect(table).toHaveAttribute('aria-checked', 'true');
      await expect(table).toBeFocused();

      const row = page.getByRole('main').locator('tbody tr');
      await expect(row).toHaveCount(1);
      await row.click({ button: 'right' }); // PD:301-304: same menu as the card
      const menu = page.getByRole('menu', { name: MENU_LABEL, exact: true });
      await expect(menu.getByRole('menuitem')).toHaveText(['Mở', 'Đổi tên', 'Xoá']);
      await page.keyboard.press('Escape');
      await expect(menu).toHaveCount(0);
      await row.focus();
      await page.keyboard.press('Enter'); // PD:298-300
      await expect.poll(() => pathname(page)).toBe(expected);

      // View, sort and search are screen state (UPD:241-244): a remount starts from the defaults.
      await page.goBack();
      await expect.poll(() => pathname(page)).toBe(ROUTES.dashboard);
      await dashboardLoaded(page);
      await expect(grid).toHaveAttribute('aria-checked', 'true');
      await expect(searchBox(page)).toHaveValue('');
      await captureEvidence(page, 'E02_view_keyboard_back.png', { caption: `row Enter → ${expected}; Back → / (grid, empty search)` });
      await attachJson('E02_view_keyboard_back.json', { opened: expected, back: ROUTES.dashboard });
    });
  });

  test('E02 · SCR-05 reload: search, sort and view return to "", "Cập nhật gần đây", "Lưới"', async ({ browser }) => {
    await withAdmin(browser, async (admin) => {
      const { page } = admin;
      await sortCombobox(page, SORT.updated).click();
      await page.getByRole('option', { name: SORT.name, exact: true }).click();
      await viewMode(page).getByRole('radio', { name: 'Bảng', exact: true }).click();
      await searchBox(page).fill(`zz-khong-co-${Date.now().toString(36)}`);
      await expect(noMatch(page)).toBeVisible();

      await reloadDashboard(page); // UPD:241-244: plain useState, nothing persisted
      await expect(searchBox(page)).toHaveValue('');
      await expect(sortCombobox(page, SORT.updated)).toBeVisible();
      await expect(viewMode(page).getByRole('radio', { name: 'Lưới', exact: true })).toHaveAttribute('aria-checked', 'true');
      await expect(projectList(page)).toBeVisible();
      await captureEvidence(page, 'E02_reload_defaults.png');
    });
  });

  test('E02 · SCR-05 card keyboard: Enter on a focused card and the "Mở {name}" button both open the project', async ({ browser }) => {
    await withAdmin(browser, async (admin) => {
      const { page } = admin;
      const project = await createProject(admin, 'open');
      const expected = openPathOf(summaryOf(await reloadDashboard(page), project.id));

      await projectCard(page, project.name).focus();
      await page.keyboard.press('Enter'); // PCT:74-76
      await expect.poll(() => pathname(page)).toBe(expected);

      await page.goBack();
      await dashboardLoaded(page);
      await page.getByRole('button', { name: `Mở ${project.name}`, exact: true }).click(); // PCT:151-161
      await expect.poll(() => pathname(page)).toBe(expected);
      await captureEvidence(page, 'E02_card_keyboard_open.png', { caption: `Enter on card and "Mở ${project.name}" → ${expected}` });
      await attachJson('E02_card_keyboard_open.json', { expected, landed: pathname(page) });
    });
  });

  test('E02 · SCR-05 card menu: "Tuỳ chọn" = Mở / Đổi tên / Xoá (no "Nhân bản"), arrow keys move, Esc closes, right-click opens it, "Mở" opens', async ({ browser }) => {
    await withAdmin(browser, async (admin) => {
      const { page } = admin;
      const project = await createProject(admin, 'menu');
      const expected = openPathOf(summaryOf(await reloadDashboard(page), project.id));

      const menu = await openCardMenu(page, project.name);
      const items = menu.getByRole('menuitem');
      await expect(items).toHaveText(['Mở', 'Đổi tên', 'Xoá']); // PMG:16-28
      await expect(menu.getByRole('menuitem', { name: 'Nhân bản' })).toHaveCount(0); // PG:58 supportsDuplicate false
      await expect(items.nth(0)).toBeFocused(); // CM:86-94
      await page.keyboard.press('ArrowDown');
      await expect(items.nth(1)).toBeFocused();
      await page.keyboard.press('End');
      await expect(items.nth(2)).toBeFocused();
      await page.keyboard.press('ArrowDown'); // wraps (CM:58-61)
      await expect(items.nth(0)).toBeFocused();
      await captureEvidence(page, 'E02_card_menu.png');
      await page.keyboard.press('Escape'); // CM:74-76
      await expect(menu).toHaveCount(0);

      await projectCard(page, project.name).click({ button: 'right' }); // PCT:77-80
      await expect(menu).toBeVisible();
      await menu.getByRole('menuitem', { name: 'Mở', exact: true }).click(); // PMG:20
      await expect.poll(() => pathname(page)).toBe(expected);
    });
  });

  test('E02 · SCR-05 rename edges: Esc cancels, empty or unchanged sends nothing, blur commits the trimmed name', async ({ browser }) => {
    await withAdmin(browser, async (admin) => {
      const { page } = admin;
      const project = await createProject(admin, 'rename');
      await reloadDashboard(page);
      const patchPath = `${PROJECTS_API}/${project.id}`;
      const heading = (name: string): Locator => projectCard(page, name).getByRole('heading', { name, exact: true });

      let input = await startRename(page, project.name);
      await input.fill(`${project.name}-esc`);
      await input.press('Escape'); // PCT:122 → cancelRename (UPD:498)
      await expect(input).toHaveCount(0);
      await expect(heading(project.name)).toBeVisible();

      input = await startRename(page, project.name);
      await input.fill('   ');
      await input.press('Enter'); // UPD:434: trimmed '' → nothing
      await expect(input).toHaveCount(0);
      await expect(heading(project.name)).toBeVisible();

      input = await startRename(page, project.name);
      await input.press('Enter'); // draft = current name (UPD:404, :434)
      await expect(input).toHaveCount(0);

      const renamed = `${project.name}-b`;
      input = await startRename(page, project.name);
      await input.fill(`   ${renamed}   `);
      const patched = waitForApi(page, 'PATCH', projectPathRe(project.id), [200]);
      await dashboardHeading(page).click(); // blur commits (PCT:118 → UPD:429-440)
      const { response, json } = await patched;
      expect(asRecord(response.request().postDataJSON() as unknown, 'PATCH body').name).toBe(renamed);
      expect(stringField(asRecord(json, 'PATCH'), 'name', 'PATCH')).toBe(renamed);
      await expect(heading(renamed)).toBeVisible();
      await expect(toastWith(page, renamedToast(renamed))).toBeVisible();
      expect(countApi(admin.api, 'PATCH', patchPath), 'PATCH requests: only the blur commit').toBe(1);
      await captureEvidence(page, 'E02_rename_edges.png', { caption: `Esc / "   " / unchanged → 0 PATCH; blur "   ${renamed}   " → 1 PATCH` });
      await attachJson('E02_rename_edges.json', { patches: countApi(admin.api, 'PATCH', patchPath), sentName: renamed });
    });
  });

  test('E02 · SCR-05 rename bounds: 2 and 81 characters are refused before any request; 3 and 80 are saved', async ({ browser }) => {
    await withAdmin(browser, async (admin) => {
      const { page } = admin;
      const project = await createProject(admin, 'bounds');
      await reloadDashboard(page);
      const patchPath = `${PROJECTS_API}/${project.id}`;

      for (const refused of ['ab', '  ab  ', 'x'.repeat(81)]) {
        const input = await startRename(page, project.name);
        await input.fill(refused);
        await input.press('Enter'); // UPD:435-438
        await expect(toastWith(page, RENAME_RANGE_MESSAGE).first()).toBeVisible();
        await expect(projectCard(page, project.name)).toBeVisible();
      }
      expect(countApi(admin.api, 'PATCH', patchPath), 'out-of-range names never reach the server').toBe(0);

      const three = Math.random().toString(36).slice(2, 5).padEnd(3, 'q');
      let input = await startRename(page, project.name);
      await input.fill(three);
      let patched = waitForApi(page, 'PATCH', projectPathRe(project.id), [200]);
      await input.press('Enter');
      expect(stringField(asRecord((await patched).json, 'PATCH'), 'name', 'PATCH')).toBe(three);
      await expect(projectCard(page, three)).toBeVisible();

      const eighty = `${uniqueName('b80')}-`.padEnd(80, 'y');
      input = await startRename(page, three);
      await input.fill(eighty);
      patched = waitForApi(page, 'PATCH', projectPathRe(project.id), [200]);
      await input.press('Enter');
      expect(stringField(asRecord((await patched).json, 'PATCH'), 'name', 'PATCH')).toBe(eighty);
      await expect(projectCard(page, eighty)).toBeVisible();
      expect(countApi(admin.api, 'PATCH', patchPath)).toBe(2);
      await captureEvidence(page, 'E02_rename_bounds.png', { caption: 'refused: 2, "  ab  ", 81 chars (0 PATCH); saved: 3 and 80 chars (2 PATCH)' });
      await attachJson('E02_rename_bounds.json', { refused: [2, 2, 81], saved: [three.length, eighty.length], patches: 2 });
    });
  });

  test('E02 · SCR-05 rename with a bidi control character: server 422, toast "Tên dự án có ký tự không dùng được…", old name back', async ({ browser }) => {
    await withAdmin(browser, async (admin) => {
      const { page } = admin;
      const project = await createProject(admin, 'bidi');
      await reloadDashboard(page);

      // BE:apps/api/projects/schemas.py:30-38 rejects bidi marks → 422 VALIDATION; the FE maps it to the characters
      // message (BUG-168; the length is checked before sending, so this is not the length copy) and puts the old name back.
      const bidi = 'qa\u202Eedge';
      const input = await startRename(page, project.name);
      await input.fill(bidi);
      const rejected = waitForApi(page, 'PATCH', projectPathRe(project.id), [422]);
      await input.press('Enter');
      const { json } = await rejected;
      await expect(toastWith(page, RENAME_CHARS_MESSAGE)).toBeVisible();
      await expect(projectCard(page, project.name)).toBeVisible();
      await expect(projectCard(page, bidi)).toHaveCount(0);
      await captureEvidence(page, 'E02_rename_bidi_422.png', { caption: 'PATCH name "qa\\u202Eedge" → 422; toast = characters copy; old name restored' });
      await attachJson('E02_rename_bidi_422.json', { status: 422, body: json as unknown });
    });
  });

  test('E02 · SCR-05 project deleted elsewhere: rename → 404 "Dự án này không còn nữa."; delete → 404 counts as done', async ({ browser }) => {
    await withAdmin(browser, async (admin) => {
      const { page } = admin;
      const project = await createProject(admin, 'gone');
      await reloadDashboard(page);
      expect(await deleteProject(admin, project.id), 'background DELETE').toBe(200);

      const input = await startRename(page, project.name);
      await input.fill(`${project.name}-x`);
      const renamed = waitForApi(page, 'PATCH', projectPathRe(project.id), [404]);
      await input.press('Enter');
      await renamed;
      await expect(toastWith(page, RENAME_GONE)).toBeVisible(); // UPD:207-208
      await expect(projectCard(page, project.name)).toBeVisible(); // UPD:418

      const menu = await openCardMenu(page, project.name);
      await menu.getByRole('menuitem', { name: 'Xoá', exact: true }).click();
      const dialog = page.getByRole('dialog', { name: DELETE_TITLE, exact: true });
      const removed = waitForApi(page, 'DELETE', projectPathRe(project.id), [404]);
      await dialog.getByRole('button', { name: CONFIRM_DELETE, exact: true }).click();
      await removed;
      await expect(dialog).toHaveCount(0); // UPD:450-458: NOT_FOUND = the wish is met
      await expect(projectCard(page, project.name)).toHaveCount(0);
      await captureEvidence(page, 'E02_deleted_elsewhere.png', { caption: 'PATCH → 404 (toast), DELETE → 404 → card removed' });
      await attachJson('E02_deleted_elsewhere.json', { patch: 404, delete: 404 });
    });
  });

  test('E02 · SCR-05 delete asks first (A9): "Để nguyên", Esc and "Đóng hộp thoại" send nothing; "Xoá dự án" deletes, no undo toast', async ({ browser }) => {
    await withAdmin(browser, async (admin) => {
      const { page } = admin;
      const project = await createProject(admin, 'delete');
      await reloadDashboard(page);
      const dialog = page.getByRole('dialog', { name: DELETE_TITLE, exact: true });
      const askDelete = async (): Promise<void> => {
        const menu = await openCardMenu(page, project.name);
        await menu.getByRole('menuitem', { name: 'Xoá', exact: true }).click(); // PMG:25
        await expect(dialog).toBeVisible();
      };

      await askDelete();
      await expect(dialog.getByText(deleteBody(project.name), { exact: true })).toBeVisible();
      await expect(dialog.getByText(NOT_UNDOABLE, { exact: true })).toBeVisible();
      await captureEvidence(page, 'E02_delete_confirm.png');
      await dialog.getByRole('button', { name: KEEP, exact: true }).click(); // PD:346-348
      await expect(dialog).toHaveCount(0);

      await askDelete();
      await page.keyboard.press('Escape'); // MOD:64,78 → cancelDelete
      await expect(dialog).toHaveCount(0);

      await askDelete();
      await dialog.getByRole('button', { name: CLOSE_DIALOG, exact: true }).click(); // MOD:167-168
      await expect(dialog).toHaveCount(0);
      expect(countApi(admin.api, 'DELETE', `${PROJECTS_API}/${project.id}`), 'no DELETE before the confirm').toBe(0);

      await askDelete();
      const removed = waitForApi(page, 'DELETE', projectPathRe(project.id), [200]);
      await dialog.getByRole('button', { name: CONFIRM_DELETE, exact: true }).click(); // PD:349-351 → UPD:443-459
      await removed;
      await expect(dialog).toHaveCount(0);
      await expect(projectCard(page, project.name)).toHaveCount(0);
      await expect(toastWith(page, project.name)).toHaveCount(0); // UPD:442: A9 asked, so no undo toast
      await captureEvidence(page, 'E02_delete_done.png', { caption: 'DELETE 200 after "Xoá dự án"; 0 DELETE before; no toast' });
      await attachJson('E02_delete_done.json', { deletes: countApi(admin.api, 'DELETE', `${PROJECTS_API}/${project.id}`) });
    });
  });

  test('E02 · SCR-05 "N" opens the wizard; pristine Esc closes it at once; "N" typed in the search box only types', async ({ browser }) => {
    await withAdmin(browser, async (admin) => {
      const { page } = admin;
      await dashboardHeading(page).click();
      await page.keyboard.press('n'); // UPD:382-385, shortcuts.ts:49-55 (case-insensitive)
      await expect(wizard(page)).toBeVisible();
      await captureEvidence(page, 'E02_shortcut_n.png', { caption: 'key "n" on the dashboard → wizard' });
      await page.keyboard.press('Escape'); // UCPM:626-628: not dirty → dismiss
      await expect(wizard(page)).toHaveCount(0);

      await searchBox(page).click();
      await page.keyboard.press('n'); // shortcutRegistry.ts:23-26 / isTextEntryTarget
      await expect(searchBox(page)).toHaveValue('n');
      await expect(wizard(page)).toHaveCount(0);
    });
  });

  test('E02 · SCR-05 [held response] loading: skeleton cards, "đang tải", no sidebar or count until N1 answers', async ({ browser }) => {
    await withAdmin(browser, async (admin) => {
      const { page } = admin;
      const hold = gate();
      await routeSummaries(page, async (route) => {
        await hold.wait;
        await route.continue();
      });
      await page.reload({ waitUntil: 'commit' });
      await expect(dashboardHeading(page)).toBeVisible();
      await expect(stateAnnouncement(page)).toHaveText(STATE.loading); // UPD:390, PD:355-357
      await expect(page.locator('main .animate-pulse').first()).toBeVisible(); // PD:245-250
      await expect(statusFilterButton(page, FILTERS.all)).toHaveCount(0); // PD:101
      await expect(countLine(page)).toHaveCount(0); // PD:187: no count line while loading
      await captureEvidence(page, 'E02_dash_loading.png');
      hold.open();
      await dashboardLoaded(page);
      await expect(stateAnnouncement(page)).not.toHaveText(STATE.loading);
      await page.unrouteAll({ behavior: 'ignoreErrors' });
    });
  });

  test('E02 · SCR-05 [mocked response] N1 fails (500): "Không tải được danh sách dự án" + "Thử lại" reads again', async ({ browser }) => {
    await withAdmin(browser, async (admin) => {
      const { page } = admin;
      await routeSummaries(page, (route) => route.fulfill({ status: 500, contentType: 'application/json', body: '{}' }));
      await page.reload({ waitUntil: 'commit' });
      const title = page.getByText(LIST_ERROR_TITLE, { exact: true });
      await expect(title).toBeVisible({ timeout: SLOW_STATE_MS }); // PD:251-257
      await expect(stateAnnouncement(page)).toHaveText(STATE.error);
      await expect(statusFilterButton(page, FILTERS.all)).toHaveCount(0); // PD:101
      await captureEvidence(page, 'E02_dash_error.png');

      await page.unrouteAll({ behavior: 'ignoreErrors' });
      const reread = waitForApi(page, 'GET', SUMMARIES_RE, [200]);
      await page.getByRole('button', { name: RETRY, exact: true }).click(); // UPD:509
      await reread;
      await expect(title).toHaveCount(0);
      await expect(projectList(page)).toBeVisible();
    });
  });

  test('E02 · SCR-05 [mocked response] no project: "Chưa có dự án nào", counters at 0, "Tạo dự án mới" opens the wizard', async ({ browser }) => {
    await withAdmin(browser, async (admin) => {
      const { page } = admin;
      // CursorEnvelopeSchema (src/api/schemas/common.ts:65-70): `items` + optional `nextCursor`.
      await routeSummaries(page, (route) => route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ items: [] }) }));
      await page.reload({ waitUntil: 'commit' });
      await expect(page.getByText(EMPTY_TITLE, { exact: true })).toBeVisible(); // PD:258-268
      await expect(page.getByText(EMPTY_DESCRIPTION, { exact: true })).toBeVisible();
      await expect(stateAnnouncement(page)).toHaveText(STATE.empty); // UPD:393
      await expect(statusFilterButton(page, FILTERS.all)).toHaveText(/0$/u);
      await captureEvidence(page, 'E02_dash_empty.png');
      await page.getByRole('button', { name: EMPTY_ACTION, exact: true }).click();
      await expect(wizard(page)).toBeVisible();
      await page.keyboard.press('Escape');
      await expect(wizard(page)).toHaveCount(0);
      await page.unrouteAll({ behavior: 'ignoreErrors' });
    });
  });

  test('E02 · SCR-05 [mocked response] one row the client cannot decode: "Có 1 dự án chưa đọc được" over the readable cards', async ({ browser }) => {
    await withAdmin(browser, async (admin) => {
      const { page } = admin;
      // src/api/schemas/decode.ts:7, :205-224: more than 20 % undecodable rows fails the WHOLE list (full error card).
      // 1 bad row stays within 20 % only next to ≥ 4 readable ones (1/5 = 0.2, not > 0.2), so this test owns 4 fixtures
      // instead of trusting whatever the admin happens to hold.
      const MIN_READABLE = 4;
      for (let index = 0; index < MIN_READABLE; index += 1) await createProject(admin, `unread-${String(index)}`);
      let readable = 0;
      await routeSummaries(page, async (route) => {
        const real = await route.fetch();
        const body = asRecord(await real.json(), 'GET /api/project-summaries');
        const items = Array.isArray(body.items) ? body.items : [];
        readable = items.length;
        // `id` must match /^prj_[0-9A-HJKMNP-TV-Z]{26}$/ (projectSummaries.ts) — this one cannot.
        const broken = { ...(items.length > 0 ? asRecord(items[0], 'items[0]') : {}), id: 'not-a-project-id' };
        // BUG-142: `{ response: real, json }` kept the real content-length / encoding → body unreadable → full error.
        await fulfillJson(route, real.status(), { ...body, items: [...items, broken] });
      });
      await page.reload({ waitUntil: 'commit' });
      await dashboardLoaded(page);
      expect(readable, 'readable rows next to the bad one (decode.ts 20 % rule)').toBeGreaterThanOrEqual(MIN_READABLE);
      await expect(page.getByText(unreadRowsNotice(1), { exact: true })).toBeVisible(); // UPD:482, PD:244, PG:100
      await expect(page.getByText(LIST_ERROR_TITLE, { exact: true })).toHaveCount(0);
      await expect(projectCards(page)).toHaveCount(readable); // A11: one bad row never locks the rest (PG:10-12)
      await expect(countLine(page)).toHaveText(`${String(readable)} dự án`); // PD:187: drawn in "partial" too (BUG-117), counting the readable rows
      await captureEvidence(page, 'E02_dash_unreadable_row.png', { caption: `N1: ${String(readable)} readable + 1 undecodable row (mocked) → notice, ${String(readable)} cards` });
      await attachJson('E02_dash_unreadable_row.json', { readable, invalid: 1, ratio: 1 / (readable + 1) });
      await page.unrouteAll({ behavior: 'ignoreErrors' });
    });
  });

  test('E02 · SCR-05 compact: below 1024 px the sidebar becomes "Lọc theo trạng thái" and the wizard stacks; 1023 → 1024 brings the sidebar back', async ({ browser }) => {
    await withAdmin(
      browser,
      async (admin) => {
        const { page } = admin;
        await expect(stateAnnouncement(page)).toHaveText(STATE.collapsed); // UPD:90-107, :392
        const filter = page.getByRole('radiogroup', { name: COMPACT_FILTER, exact: true }); // PD:229-236
        await expect(filter.getByRole('radio')).toHaveText([FILTERS.all, FILTERS.processing, FILTERS.qc, FILTERS.done]);
        await expect(statusFilterButton(page, FILTERS.all)).toHaveCount(0); // PD:101
        await expect(countLine(page)).toBeVisible(); // PD:187 (collapsed)
        await filter.getByRole('radio', { name: FILTERS.processing, exact: true }).click();
        await expect(filter.getByRole('radio', { name: FILTERS.processing, exact: true })).toHaveAttribute('aria-checked', 'true');
        await captureEvidence(page, 'E02_dash_compact_375.png');

        // The wizard's own narrow probe (UCPM:334-351, CPM:95): one column on step 1.
        await dashboardHeading(page).click();
        await page.keyboard.press('n');
        const dialog = wizard(page);
        await expect(dialog).toBeVisible();
        await expect(stateAnnouncement(dialog)).toHaveText(STATE.collapsed); // UCPM:494
        const nameBox = await nameField(dialog).boundingBox();
        const codeBox = await codeField(dialog).boundingBox();
        expect(nameBox && codeBox && Math.abs(nameBox.x - codeBox.x) < 2 && codeBox.y > nameBox.y, 'Tên/Mã stacked').toBe(true);
        const dialogWidth = await dialog.evaluate((el) => el.getBoundingClientRect().width);
        await attachJson('E02_dash_compact.json', { viewport: COMPACT, nameBox, codeBox, dialogWidth });
        await page.keyboard.press('Escape');
        await expect(dialog).toHaveCount(0);

        await page.setViewportSize({ width: 1023, height: 900 });
        await expect(filter).toBeVisible();
        await page.setViewportSize({ width: 1024, height: 900 });
        await expect(filter).toHaveCount(0);
        // Same `statusFilter` state behind both controls (PD:233, DS:157).
        await expect(statusFilterButton(page, FILTERS.processing)).toHaveAttribute('aria-pressed', 'true');
        await captureEvidence(page, 'E02_dash_compact_1024.png');
      },
      COMPACT,
    );
  });
});

/* ================================================================= SCR-05 dashboard: errors, races, table, paging */

/** Menu "Xoá" (PMG:271) → the A9 dialog (PD:329-353). */
async function askDelete(page: Page, name: string): Promise<Locator> {
  const menu = await openCardMenu(page, name);
  await menu.getByRole('menuitem', { name: 'Xoá', exact: true }).click();
  const dialog = deleteDialog(page);
  await expect(dialog).toBeVisible();
  return dialog;
}

test.describe('E02 SCR-05 dashboard (/) errors, races, table, paging', () => {
  test('E02 · SCR-05 [mocked response] rename answered 500: toast "Không đổi được tên dự án. Hãy thử lại.", old name back, the PATCH sent once', async ({ browser }) => {
    // unpairable: a 5xx on PATCH /api/projects/:id cannot be produced on the shared stack.
    await withAdmin(browser, async (admin) => {
      const { page } = admin;
      const project = await createProject(admin, 'ren500');
      await reloadDashboard(page);
      let patches = 0;
      await routeProject(page, project.id, 'PATCH', async (route) => {
        patches += 1;
        await fulfillJson(route, 500, {});
      });

      const attempted = `${project.name}-x`;
      const input = await startRename(page, project.name);
      await input.fill(attempted);
      const failed = waitForApi(page, 'PATCH', projectPathRe(project.id), [500]);
      await input.press('Enter');
      await failed;
      // UPD:417-420 takes the optimistic name back; a body with no `code` gets the fallback copy (UPD:209-210).
      await expect(toastWith(page, RENAME_FAILED)).toBeVisible();
      await expect(projectCard(page, project.name)).toBeVisible();
      await expect(projectCard(page, attempted)).toHaveCount(0);
      // No Idempotency-Key on a PATCH (lib/http/client.ts:404), so the client never retries it (lib/http/retry.ts:25-26).
      expect(patches, 'PATCH requests').toBe(1);
      await captureEvidence(page, 'E02_rename_500.png', { caption: `PATCH name "${attempted}" → 500 (mocked): toast, old name back, 1 request` });
      await attachJson('E02_rename_500.json', { status: 500, patches, kept: project.name });
      await page.unrouteAll({ behavior: 'ignoreErrors' });
    });
  });

  test('E02 · SCR-05 [mocked response] rename refused 403 FORBIDDEN: toast "Bạn không có quyền đổi tên dự án này.", old name back', async ({ browser }) => {
    // pair: phase02_dashboard_api.spec.ts "A02 · role/owner matrix" → role_viewer_member_patch_403 (the real 403 FORBIDDEN).
    await withAdmin(browser, async (admin) => {
      const { page } = admin;
      const project = await createProject(admin, 'ren403');
      await reloadDashboard(page);
      await routeProject(page, project.id, 'PATCH', (route) => fulfillJson(route, 403, wireError('FORBIDDEN')));

      const attempted = `${project.name}-x`;
      const input = await startRename(page, project.name);
      await input.fill(attempted);
      const refused = waitForApi(page, 'PATCH', projectPathRe(project.id), [403]);
      await input.press('Enter');
      const { json } = await refused;
      await expect(toastWith(page, RENAME_FORBIDDEN)).toBeVisible(); // UPD:205-206
      await expect(projectCard(page, project.name)).toBeVisible(); // UPD:418
      await expect(projectCard(page, attempted)).toHaveCount(0);
      await captureEvidence(page, 'E02_rename_403.png', { caption: 'PATCH → 403 FORBIDDEN (mocked): permission toast, old name back' });
      await attachJson('E02_rename_403.json', { status: 403, body: json as unknown });
      await page.unrouteAll({ behavior: 'ignoreErrors' });
    });
  });

  test('E02 · SCR-05 [mocked response] delete refused 403 FORBIDDEN: "Bạn không có quyền xoá dự án này." inside the open dialog, card kept; reopening starts clean', async ({ browser }) => {
    // pair: phase02_dashboard_api.spec.ts "A02 · role/owner matrix" → role_viewer_member_delete_403 (the real 403 FORBIDDEN).
    await withAdmin(browser, async (admin) => {
      const { page } = admin;
      const project = await createProject(admin, 'del403');
      await reloadDashboard(page);
      await routeProject(page, project.id, 'DELETE', (route) => fulfillJson(route, 403, wireError('FORBIDDEN')));

      let dialog = await askDelete(page, project.name);
      const refused = waitForApi(page, 'DELETE', projectPathRe(project.id), [403]);
      await dialog.getByRole('button', { name: CONFIRM_DELETE, exact: true }).click();
      await refused;
      // UPD:449-453 keeps the dialog open with `deleteErrorMessage`; PD:342 draws it as a violation alert in the body.
      await expect(dialog.getByRole('alert').filter({ hasText: DELETE_FORBIDDEN })).toBeVisible();
      await expect(dialog).toBeVisible();
      await expect(projectCard(page, project.name)).toBeVisible();
      await captureEvidence(page, 'E02_delete_403.png', { caption: 'DELETE → 403 FORBIDDEN (mocked): message in the dialog, card kept' });

      await dialog.getByRole('button', { name: KEEP, exact: true }).click(); // cancelDelete clears it (UPD:503-506)
      await expect(dialog).toHaveCount(0);
      dialog = await askDelete(page, project.name); // requestDelete clears it too (UPD:499-502)
      await expect(dialog.getByRole('alert')).toHaveCount(0);
      await page.keyboard.press('Escape');
      await expect(dialog).toHaveCount(0);
      await attachJson('E02_delete_403.json', { status: 403, dialogKeptOpen: true, cardKept: true });
      await page.unrouteAll({ behavior: 'ignoreErrors' });
    });
  });

  test('E02 · SCR-05 [mocked response] delete answered 500: "Không xoá được dự án. Hãy thử lại." in the dialog; "Xoá dự án" again with the server back deletes', async ({ browser }) => {
    // unpairable: 5xx. The second DELETE is real.
    await withAdmin(browser, async (admin) => {
      const { page } = admin;
      const project = await createProject(admin, 'del500');
      await reloadDashboard(page);
      let mocked = 0;
      await routeProject(page, project.id, 'DELETE', async (route) => {
        mocked += 1;
        await fulfillJson(route, 500, {});
      });

      const dialog = await askDelete(page, project.name);
      const confirm = dialog.getByRole('button', { name: CONFIRM_DELETE, exact: true });
      const failed = waitForApi(page, 'DELETE', projectPathRe(project.id), [500]);
      await confirm.click();
      await failed;
      await expect(dialog.getByRole('alert').filter({ hasText: DELETE_FAILED })).toBeVisible(); // UPD:218, PD:342
      await expect(projectCard(page, project.name)).toBeVisible(); // the row leaves only after a success (UPD:442, :456)
      await captureEvidence(page, 'E02_delete_500.png', { caption: 'DELETE → 500 (mocked): retry message in the dialog, card kept' });

      await page.unrouteAll({ behavior: 'ignoreErrors' });
      const removed = waitForApi(page, 'DELETE', projectPathRe(project.id), [200]);
      await confirm.click(); // confirmDelete clears the message and tries again (UPD:446-448)
      await removed;
      await expect(dialog).toHaveCount(0);
      await expect(projectCard(page, project.name)).toHaveCount(0);
      expect(mocked, 'mocked DELETE answers').toBe(1);
      await attachJson('E02_delete_500.json', { first: 500, second: 200, mockedRequests: mocked });
    });
  });

  test('E02 · SCR-05 [held response] double click on "Xoá dự án" while DELETE is held: one DELETE leaves, then the dialog closes and the card leaves', async ({ browser }) => {
    await withAdmin(browser, async (admin) => {
      const { page } = admin;
      const project = await createProject(admin, 'deldbl');
      await reloadDashboard(page);
      const hold = gate();
      let deletes = 0;
      await routeProject(page, project.id, 'DELETE', async (route) => {
        deletes += 1;
        await hold.wait;
        await route.continue();
      });

      const dialog = await askDelete(page, project.name);
      await dialog.getByRole('button', { name: CONFIRM_DELETE, exact: true }).dblclick();
      // A second request would reach the route at once; one second is ample to see it.
      await page.waitForTimeout(1_000);
      const whileHeld = deletes;
      await captureEvidence(page, 'E02_delete_double_click.png', { caption: `DELETE held after a double click: ${String(whileHeld)} request(s) so far` });
      // The wizard locks its submit against a double click (UCPM:641-643); confirmDelete (UPD:443-459) has no in-flight
      // guard and the button stays enabled (PD:349-351) — expected: one DELETE per confirmation.
      expect.soft(whileHeld, 'DELETE requests for a double click on "Xoá dự án"').toBe(1);
      hold.open();
      await expect(dialog).toHaveCount(0);
      await expect(projectCard(page, project.name)).toHaveCount(0);
      const path = `${PROJECTS_API}/${project.id}`;
      await expect.poll(() => countApi(admin.api, 'DELETE', path)).toBe(whileHeld);
      await attachJson('E02_delete_double_click.json', {
        deleteRequests: whileHeld,
        statuses: admin.api.filter((e) => e.method === 'DELETE' && e.path === path).map((e) => e.status),
      });
      await page.unrouteAll({ behavior: 'ignoreErrors' });
    });
  });

  test('E02 · SCR-05 [held response] rename: the new name shows while PATCH is held, the toast waits for the answer; a second Enter sends nothing and opens nothing', async ({ browser }) => {
    await withAdmin(browser, async (admin) => {
      const { page } = admin;
      const project = await createProject(admin, 'renheld');
      await reloadDashboard(page);
      const hold = gate();
      let patches = 0;
      await routeProject(page, project.id, 'PATCH', async (route) => {
        patches += 1;
        await hold.wait;
        await route.continue();
      });

      const renamed = `${project.name}-h`;
      const input = await startRename(page, project.name);
      await input.fill(renamed);
      const saved = waitForApi(page, 'PATCH', projectPathRe(project.id), [200]);
      await input.press('Enter');
      await expect(input).toHaveCount(0);
      await page.keyboard.press('Enter'); // the box is gone: this press must neither commit again nor open a card
      // UPD:410-416: optimistic — the card carries the new name before the server answers; the toast comes after (UPD:422-426).
      await expect(projectCard(page, renamed).getByRole('heading', { name: renamed, exact: true })).toBeVisible();
      await expect(toastWith(page, renamedToast(renamed))).toHaveCount(0);
      expect(pathname(page)).toBe(ROUTES.dashboard);
      expect(patches, 'PATCH requests while held').toBe(1);
      await captureEvidence(page, 'E02_rename_held_optimistic.png', { caption: `PATCH held: card already "${renamed}", no toast yet, 1 request` });

      hold.open();
      await saved;
      await expect(toastWith(page, renamedToast(renamed))).toBeVisible();
      expect(patches, 'PATCH requests in all').toBe(1);
      expect(pathname(page)).toBe(ROUTES.dashboard);
      await attachJson('E02_rename_held_optimistic.json', { patches, landed: pathname(page), name: renamed });
      await page.unrouteAll({ behavior: 'ignoreErrors' });
    });
  });

  test('E02 · SCR-05 rename toast leaves after the 8 s undo window: no "Hoàn tác" left, no second PATCH, the new name survives a reload', async ({ browser }) => {
    await withAdmin(browser, async (admin) => {
      const { page } = admin;
      const project = await createProject(admin, 'rentimeout');
      await reloadDashboard(page);
      const renamed = `${project.name}-t`;
      const input = await startRename(page, project.name);
      await input.fill(renamed);
      const saved = waitForApi(page, 'PATCH', projectPathRe(project.id), [200]);
      await input.press('Enter');
      await saved;

      const toast = toastWith(page, renamedToast(renamed));
      await expect(toast).toBeVisible();
      await page.mouse.move(0, 0); // a hovered toast stops its clock (TST:69-73, :128-129)
      const shownAt = Date.now();
      // BUG-212: the "before" half of the pair, so the "after" shot below reads as a toast that left, not one never shown.
      await captureEvidence(page, 'E02_rename_toast_timeout_before.png', { caption: `before: toast "${renamedToast(renamed)}" with "Hoàn tác", 8 s clock running` });
      await expect(toast).toHaveCount(0, { timeout: UNDO_WINDOW_MS + 5_000 }); // TST:59, :81-84 (+180 ms exit)
      const goneAfterMs = Date.now() - shownAt;
      expect(goneAfterMs, 'the toast stays for the undo window').toBeGreaterThanOrEqual(UNDO_WINDOW_MS - 1_500);
      await expect(page.getByRole('button', { name: 'Hoàn tác', exact: true })).toHaveCount(0);
      expect(countApi(admin.api, 'PATCH', `${PROJECTS_API}/${project.id}`), 'no undo PATCH after the window').toBe(1);

      const list = await reloadDashboard(page);
      expect(summaryOf(list, project.id).name).toBe(renamed);
      await expect(projectCard(page, renamed)).toBeVisible();
      await captureEvidence(page, 'E02_rename_toast_timeout.png', { caption: `after (pair of E02_rename_toast_timeout_before): toast gone after ${String(goneAfterMs)} ms, no "Hoàn tác"; reload still shows "${renamed}"; 1 PATCH` });
      await attachJson('E02_rename_toast_timeout.json', { goneAfterMs, patches: 1, afterReload: renamed });
    });
  });

  test('E02 · SCR-05 [mocked response] status routing: a "Cần QC" card opens its walls screen, a "Hoàn thành" card opens /3d; badges, review captions and counters follow N1', async ({ browser }) => {
    // unpairable now: "qc"/"done" need an uploaded drawing and reviewed walls (BE:apps/api/projects/summaries.py:181-187),
    // Phase 3/4 data; re-pair with a real card click once CP-5 exists (coverage gap #55). Only two fixture rows are changed.
    await withAdmin(browser, async (admin) => {
      const { page } = admin;
      const qc = await createProject(admin, 'route-qc');
      const done = await createProject(admin, 'route-done');
      const QC_FLOOR = 'L-qa-mocked-qc';
      const DONE_FLOOR = 'L-qa-mocked-done';
      await routeSummaries(page, async (route) => {
        const real = await route.fetch();
        const body = asRecord(await real.json(), 'GET /api/project-summaries');
        // The schema's own rules still hold: qc ⇒ a default floor, floors ⇔ defaultFloorId, done ⇔ all walls reviewed
        // (src/api/schemas/projectSummaries.ts:78-97), so both rows decode.
        const items = rawItems(body).map((item) => {
          const row = asRecord(item, 'items[]');
          if (row.id === qc.id) return { ...row, status: 'qc', floorCount: 1, defaultFloorId: QC_FLOOR, wallsTotalCount: 10, wallsReviewedCount: 3 };
          if (row.id === done.id) return { ...row, status: 'done', floorCount: 1, defaultFloorId: DONE_FLOOR, wallsTotalCount: 4, wallsReviewedCount: 4 };
          return item;
        });
        await fulfillJson(route, real.status(), { ...body, items });
      });

      const list = await reloadDashboard(page);
      const qcPath = openPathOf(summaryOf(list, qc.id));
      const donePath = openPathOf(summaryOf(list, done.id));
      expect(qcPath).toBe(ROUTES.project.walls(qc.id, QC_FLOOR)); // UPD:225-228
      expect(donePath).toBe(ROUTES.project.viewer(done.id)); // UPD:229-230
      await expect(projectCard(page, qc.name)).toContainText(FILTERS.qc); // UPD:317
      await expect(projectCard(page, qc.name)).toContainText(reviewProgress(3, 10)); // UPD:329
      await expect(projectCard(page, done.name)).toContainText(FILTERS.done);
      await expect(projectCard(page, done.name)).toContainText(reviewProgress(4, 4));
      const counts = countsOf(list);
      for (const key of ['all', 'done', 'qc', 'processing'] as const) {
        await expect(statValue(page, STATS[key]), `stat card "${STATS[key]}"`).toHaveText(String(counts[key]));
      }
      await captureEvidence(page, 'E02_status_routing_cards.png', { caption: `mocked N1: "${qc.name}" Cần QC 3/10, "${done.name}" Hoàn thành 4/4` });

      const landed: string[] = [];
      for (const [project, expected] of [[qc, qcPath], [done, donePath]] as const) {
        const navigated = page.waitForURL((url) => url.pathname === expected, { waitUntil: 'commit' });
        await projectCard(page, project.name).click(); // PCT:73
        await navigated;
        landed.push(pathname(page));
        await page.goBack();
        await expect.poll(() => pathname(page)).toBe(ROUTES.dashboard);
        await dashboardLoaded(page);
      }
      await attachJson('E02_status_routing.json', { qcPath, donePath, landed });
      await page.unrouteAll({ behavior: 'ignoreErrors' });
    });
  });

  test('E02 · SCR-05 table view: five plain headers (no aria-sort, a header click sorts nothing), rows follow the sort list ("Tên A–Z" in Vietnamese order), Tab walks row to row', async ({ browser }) => {
    await withAdmin(browser, async (admin) => {
      const { page } = admin;
      const tag = uniqueName('tbl');
      const a = await createProject(admin, 'tbl', `${tag}-a`);
      const b = await createProject(admin, 'tbl', `${tag}-b`);
      const list = await reloadDashboard(page);
      // UPD:283-296: stable sorts over the gateway order (newest first, id tie-break, PG:104-106).
      const byUpdated = gatewayOrder(list).filter((s) => s.id === a.id || s.id === b.id).map((s) => s.name);
      const byName = [a.name, b.name].sort((x, y) => x.localeCompare(y, 'vi')); // UPD:286-287

      await viewMode(page).getByRole('radio', { name: 'Bảng', exact: true }).click();
      await searchBox(page).fill(tag);
      const rows = tableRows(page);
      await expect(rows).toHaveCount(2);
      const rowNames = (): Promise<string[]> => rows.locator('td:first-child').allTextContents();
      await expect(tableHeads(page)).toHaveText([...TABLE_HEADERS]);
      // Table.tsx:158-174: no `sortable` / `sortKey` / `onSort` is passed (PD:284-288) → no aria-sort, no click handler.
      expect(await tableHeads(page).evaluateAll((heads) => heads.filter((head) => head.hasAttribute('aria-sort')).length)).toBe(0);
      await expect.poll(rowNames).toEqual(byUpdated);
      await tableHeads(page).first().click();
      await expect.poll(rowNames).toEqual(byUpdated);
      // BUG-212: shot right after the click (pointer still on the header) — the claim "a header click sorts nothing".
      await captureEvidence(page, 'E02_table_header_click.png', {
        caption: `clicked header "${TABLE_HEADERS[0]}" (pointer on it): rows still ${byUpdated.join(' / ')} (newest first), no aria-sort`,
      });

      await sortCombobox(page, SORT.updated).click();
      await page.getByRole('option', { name: SORT.name, exact: true }).click();
      await expect.poll(rowNames).toEqual(byName);

      await rows.first().focus();
      await page.keyboard.press('Tab'); // PD:295: every row is a tab stop, nothing focusable inside a row
      await expect(rows.nth(1)).toBeFocused();
      await captureEvidence(page, 'E02_table_sort_headers.png', { caption: `table, sort list "${SORT.name}": ${byName.join(' / ')}; header click: E02_table_header_click` });
      await attachJson('E02_table_sort_headers.json', { headers: [...TABLE_HEADERS], byUpdated, byName });
    });
  });

  test('E02 · SCR-05 table view rename: right-click a row → "Đổi tên" puts the box in the row; Esc cancels; a click in the box and Enter save without opening the project', async ({ browser }) => {
    await withAdmin(browser, async (admin) => {
      const { page } = admin;
      const project = await createProject(admin, 'tblren');
      await reloadDashboard(page);
      await viewMode(page).getByRole('radio', { name: 'Bảng', exact: true }).click();
      await searchBox(page).fill(project.name);
      await expect(tableRows(page)).toHaveCount(1);
      const renameFromRow = async (): Promise<Locator> => {
        await tableRow(page, project.name).click({ button: 'right' }); // PD:301-304
        await cardMenu(page).getByRole('menuitem', { name: 'Đổi tên', exact: true }).click(); // PMG:270
        const box = tableRows(page).getByRole('textbox', { name: `Đổi tên ${project.name}`, exact: true }); // PD:106-121
        await expect(box).toBeFocused();
        return box;
      };

      let input = await renameFromRow();
      await input.press('Escape'); // PD:118
      await expect(input).toHaveCount(0);
      await expect(tableRow(page, project.name)).toBeVisible();

      input = await renameFromRow();
      await input.click(); // PD:114 keeps the click from the row's open handler (PD:297)
      expect(pathname(page)).toBe(ROUTES.dashboard);
      const renamed = `${project.name}-t`;
      await input.fill(renamed);
      const saved = waitForApi(page, 'PATCH', projectPathRe(project.id), [200]);
      await input.press('Enter'); // PD:115-117 stops it before the row's Enter (PD:298-300)
      await saved;
      await expect(tableRow(page, renamed)).toBeVisible();
      await expect(toastWith(page, renamedToast(renamed))).toBeVisible();
      expect(pathname(page)).toBe(ROUTES.dashboard);
      expect(countApi(admin.api, 'PATCH', `${PROJECTS_API}/${project.id}`), 'only the Enter commit').toBe(1);
      await captureEvidence(page, 'E02_table_rename.png', { caption: `table row: Esc → no PATCH; Enter → PATCH 200 "${renamed}", still on /` });
      await attachJson('E02_table_rename.json', { patches: 1, landed: pathname(page), name: renamed });
    });
  });

  test('E02 · SCR-05 table view with an 80-character name: the whole name in its cell, no page-level horizontal scroll at 1440, the last column on screen', async ({ browser }) => {
    await withAdmin(browser, async (admin) => {
      const { page } = admin;
      const name = `${uniqueName('long')}-`.padEnd(80, 'w'); // LIM:23 max
      expect(name).toHaveLength(80);
      await createProject(admin, 'long', name);
      await reloadDashboard(page);
      await viewMode(page).getByRole('radio', { name: 'Bảng', exact: true }).click();
      await searchBox(page).fill(name);
      await expect(tableRows(page)).toHaveCount(1);
      await expect(tableRow(page, name)).toBeVisible();

      const metrics = await page.evaluate(() => ({
        scrollWidth: document.documentElement.scrollWidth,
        clientWidth: document.documentElement.clientWidth,
      }));
      const lastHead = await tableHeads(page).last().boundingBox();
      await captureEvidence(page, 'E02_table_long_name.png', { caption: `80-char name in table view; page ${String(metrics.scrollWidth)}/${String(metrics.clientWidth)} px wide` });
      await attachJson('E02_table_long_name.json', { nameLength: name.length, ...metrics, lastHead });
      expect(metrics.scrollWidth, 'no page-level horizontal scroll').toBeLessThanOrEqual(metrics.clientWidth);
      // qa-review-ui: a column pushed past the window is a defect even when the table scrolls inside itself (Table.tsx:37).
      expect.soft(lastHead !== null && lastHead.x + lastHead.width <= DESKTOP.width, `"${TABLE_HEADERS[4]}" header inside the 1440 px window`).toBe(true);
    });
  });

  test('E02 · SCR-05 status filter AND search: both apply together, the sidebar counts ignore the search, switching the filter keeps the query', async ({ browser }) => {
    await withAdmin(browser, async (admin) => {
      const { page } = admin;
      const project = await createProject(admin, 'combo');
      const list = await reloadDashboard(page);
      const counts = countsOf(list);
      expect(derivedStatus(summaryOf(list, project.id)), 'a fixture without floors').toBe('processing'); // BE:summaries.py:186

      await statusFilterButton(page, FILTERS.processing).click();
      await expect(statusFilterButton(page, FILTERS.processing)).toHaveAttribute('aria-pressed', 'true');
      await searchBox(page).fill(project.name);
      await expect(projectCards(page)).toHaveCount(1); // UPD:273-281: search AND status
      await expect(projectCard(page, project.name)).toBeVisible();
      for (const key of ['all', 'done', 'qc', 'processing'] as const) {
        await expect(statValue(page, STATS[key])).toHaveText(String(counts[key])); // UPD:339-350: over all of N1
        await expect(statusFilterButton(page, FILTERS[key])).toHaveText(endsWithCount(counts[key]));
      }

      await statusFilterButton(page, FILTERS.qc).click();
      await expect(noMatch(page)).toBeVisible(); // PD:269-275
      await expect(searchBox(page)).toHaveValue(project.name);
      await captureEvidence(page, 'E02_filter_and_search.png', { caption: `search "${project.name}" + "${FILTERS.qc}" → no match; counters unchanged` });

      await statusFilterButton(page, FILTERS.all).click();
      await expect(projectCards(page)).toHaveCount(1);
      await attachJson('E02_filter_and_search.json', { counts, query: project.name });
    });
  });

  test('E02 · SCR-05 search and Vietnamese marks: upper case with marks matches; the same words without marks, or decomposed (NFD), do not — no accent folding', async ({ browser }) => {
    await withAdmin(browser, async (admin) => {
      const { page } = admin;
      const stamp = Date.now().toString(36);
      const project = await createProject(admin, 'dau', `${TEST_DATA_PREFIX}dau-${stamp}-Nhà Đông Á`);
      await reloadDashboard(page);

      // UPD:272-276: `trim().toLowerCase()` on both sides + `includes` — no `normalize`, no mark folding.
      const withMarks = `${stamp}-NHÀ ĐÔNG Á`.toUpperCase();
      await searchBox(page).fill(withMarks);
      await expect(projectCards(page)).toHaveCount(1);
      await expect(projectCard(page, project.name)).toBeVisible();
      await captureEvidence(page, 'E02_search_marks_match.png', { caption: `"${withMarks}" → "${project.name}"` });

      const refused = [`${stamp}-nha dong a`, `${stamp}-Nhà Đông Á`.normalize('NFD')];
      for (const query of refused) {
        await searchBox(page).fill(query);
        await expect(noMatch(page)).toBeVisible();
      }
      await captureEvidence(page, 'E02_search_marks_nomatch.png', { caption: 'no marks / NFD query → "Không tìm thấy dự án phù hợp" (no accent folding, UPD:276)' });
      await attachJson('E02_search_marks.json', { name: project.name, matched: withMarks, noMatch: refused.map((q) => [...q].length) });
    });
  });

  test('E02 · SCR-05 search with no result: state "một phần" and a "0 dự án" line; emptying the box brings the list, the full count and "thành công" back', async ({ browser }) => {
    await withAdmin(browser, async (admin) => {
      const { page } = admin;
      await createProject(admin, 'empty-search'); // at least one card, so the reset lands on "success"
      const list = await reloadDashboard(page);
      await expect(countLine(page)).toHaveText(`${String(list.length)} dự án`);

      const query = `zz-khong-co-${Date.now().toString(36)}`;
      await searchBox(page).fill(query);
      await expect(noMatch(page)).toBeVisible(); // PD:269-275
      await expect(stateAnnouncement(page)).toHaveText(STATE.partial); // UPD:396
      await expect(countLine(page)).toHaveText('0 dự án'); // PD:187: drawn in "partial" too (BUG-117)
      await captureEvidence(page, 'E02_search_empty.png', { caption: `search "${query}" → no match, state "${STATE.partial}"` });

      await searchBox(page).press('Control+A');
      await searchBox(page).press('Backspace');
      await expect(searchBox(page)).toHaveValue('');
      await expect(projectCards(page)).toHaveCount(list.length);
      await expect(countLine(page)).toHaveText(`${String(list.length)} dự án`);
      await expect(stateAnnouncement(page)).toHaveText(STATE.success); // UPD:397
      await captureEvidence(page, 'E02_search_empty_reset.png', { caption: `box emptied → ${String(list.length)} cards, "${String(list.length)} dự án"` });
    });
  });

  test('E02 · SCR-05 delete re-reads N1: a GET /api/project-summaries follows the DELETE; every counter and "{n} dự án" drop by one without a reload', async ({ browser }) => {
    await withAdmin(browser, async (admin) => {
      const { page } = admin;
      const kept = await createProject(admin, 'cnt-keep');
      const gone = await createProject(admin, 'cnt-gone');
      const before = await reloadDashboard(page);
      const countsBefore = countsOf(before);
      // BUG-175: the "before" state on its own shot (this card still there, "{n} dự án" with the old n), so the "after" shot has something to differ from.
      await expect(projectCard(page, gone.name)).toBeVisible();
      await expect(countLine(page)).toHaveText(`${String(before.length)} dự án`);
      await captureEvidence(page, 'E02_delete_refreshes_counts_before.png', { caption: `before DELETE: ${String(countsBefore.all)} projects, "${gone.name}" listed` });

      const dialog = await askDelete(page, gone.name);
      const removed = waitForApi(page, 'DELETE', projectPathRe(gone.id), [200]);
      const reread = waitForApi(page, 'GET', SUMMARIES_RE, [200]);
      await dialog.getByRole('button', { name: CONFIRM_DELETE, exact: true }).click();
      await removed;
      const after = summariesOf((await reread).json);
      // UPD:456-458: the row leaves at once, then applyInvalidation('deleteProject') re-reads N1 (lib/query/invalidation.ts:304-308).
      const log = admin.api.map((entry) => `${entry.method} ${entry.path}`);
      expect(log.lastIndexOf(`GET ${SUMMARIES_API}`), 'N1 read after the DELETE').toBeGreaterThan(log.lastIndexOf(`DELETE ${PROJECTS_API}/${gone.id}`));
      expect(after.some((s) => s.id === gone.id)).toBe(false);
      expect(after).toHaveLength(before.length - 1);
      const countsAfter = countsOf(after);
      expect(countsAfter.processing, 'the deleted fixture was "processing"').toBe(countsBefore.processing - 1);

      for (const key of ['all', 'done', 'qc', 'processing'] as const) {
        await expect(statValue(page, STATS[key])).toHaveText(String(countsAfter[key]));
        await expect(statusFilterButton(page, FILTERS[key])).toHaveText(endsWithCount(countsAfter[key]));
      }
      await expect(countLine(page)).toHaveText(`${String(after.length)} dự án`);
      await expect(projectCard(page, kept.name)).toBeVisible();
      await expect(projectCard(page, gone.name)).toHaveCount(0);
      await captureEvidence(page, 'E02_delete_refreshes_counts.png', { caption: `after DELETE: ${String(countsBefore.all)} → ${String(countsAfter.all)} projects, no reload` });
      await attachJson('E02_delete_refreshes_counts.json', { countsBefore, countsAfter });
    });
  });

  test('E02 · SCR-05 [mocked response] offline while the list loads (N1 aborted): the read is retried, then "Không tải được danh sách dự án"; "Thử lại" back online shows the list', async ({ browser }) => {
    // unpairable: network loss.
    await withAdmin(browser, async (admin) => {
      const { page } = admin;
      let aborted = 0;
      await routeSummaries(page, async (route) => {
        aborted += 1;
        await route.abort('internetdisconnected');
      });
      await page.reload({ waitUntil: 'commit' });
      const title = page.getByText(LIST_ERROR_TITLE, { exact: true });
      await expect(title).toBeVisible({ timeout: SLOW_STATE_MS }); // PD:251-257
      await expect(stateAnnouncement(page)).toHaveText(STATE.error); // UPD:391
      await expect(statusFilterButton(page, FILTERS.all)).toHaveCount(0); // PD:101
      // lib/http/retry.ts:25-26, :70-96: a GET that hits a network error is retried before the screen gives up.
      expect(aborted, 'N1 attempts while offline').toBeGreaterThanOrEqual(2);
      await captureEvidence(page, 'E02_dash_offline.png', { caption: `N1 aborted ${String(aborted)}× (internetdisconnected) → error card` });
      await attachJson('E02_dash_offline.json', { abortedAttempts: aborted });

      await page.unrouteAll({ behavior: 'ignoreErrors' });
      const reread = waitForApi(page, 'GET', SUMMARIES_RE, [200]);
      await page.getByRole('button', { name: RETRY, exact: true }).click(); // UPD:509
      await reread;
      await expect(title).toHaveCount(0);
      await expect(projectList(page)).toBeVisible();
    });
  });

  test('E02 · SCR-05 [mocked response] N1 held then 500: skeleton first, then the error card; "Thử lại" while the next read is held goes back to the skeleton, then the list', async ({ browser }) => {
    // unpairable: 5xx. The read behind "Thử lại" is the real one, only held.
    await withAdmin(browser, async (admin) => {
      const { page } = admin;
      const failHold = gate();
      const realHold = gate();
      let answer: 'fail' | 'real' = 'fail';
      await routeSummaries(page, async (route) => {
        if (answer === 'fail') {
          await failHold.wait;
          await fulfillJson(route, 500, {});
          return;
        }
        await realHold.wait;
        await route.continue();
      });
      const skeleton = page.locator('main .animate-pulse').first();
      const title = page.getByText(LIST_ERROR_TITLE, { exact: true });

      await page.reload({ waitUntil: 'commit' });
      await expect(dashboardHeading(page)).toBeVisible();
      await expect(stateAnnouncement(page)).toHaveText(STATE.loading); // UPD:390
      await expect(skeleton).toBeVisible(); // PD:245-250
      await captureEvidence(page, 'E02_dash_held_then_500_loading.png', { caption: 'N1 held → skeleton cards' });

      failHold.open();
      await expect(title).toBeVisible({ timeout: SLOW_STATE_MS });
      await expect(stateAnnouncement(page)).toHaveText(STATE.error);
      await captureEvidence(page, 'E02_dash_held_then_500_error.png', { caption: 'held N1 answered 500 (mocked) → error card' });

      answer = 'real';
      const reread = waitForApi(page, 'GET', SUMMARIES_RE, [200]);
      await page.getByRole('button', { name: RETRY, exact: true }).click(); // UPD:509
      // @tanstack/query-core 5.53.1 query.js:351-360 (`fetchState`): a refetch with no data yet puts the query back to
      // "pending", so the screen is "loading" again (UPD:390) while the retry is held — the error card gives way.
      await expect(skeleton).toBeVisible();
      await expect(stateAnnouncement(page)).toHaveText(STATE.loading);
      await expect(title).toHaveCount(0);
      await captureEvidence(page, 'E02_dash_retry_held.png', { caption: '"Thử lại" with the real N1 held → skeleton again' });

      realHold.open();
      await reread;
      await dashboardLoaded(page);
      await expect(projectList(page)).toBeVisible();
      await page.unrouteAll({ behavior: 'ignoreErrors' });
    });
  });

  test('E02 · SCR-05 [mocked response] N1 over two cursor pages: page 2 is read with the cursor and the same limit, every card of both pages shows, the counters add up', async ({ browser }) => {
    // pair: phase02_dashboard_api.spec.ts "A02 · N1: limit 1..500 …, id ASC cursor paging …" (real nextCursor paging).
    await withAdmin(browser, async (admin) => {
      const { page } = admin;
      const fixture = await createProject(admin, 'page2'); // ≥ 2 rows with CP-2, so both pages hold something
      const PAGE2 = 'qa-mocked-page-2';
      let secondPage: unknown[] = [];
      await routeSummaries(page, async (route) => {
        if (new URL(route.request().url()).searchParams.get('cursor') === PAGE2) {
          await fulfillJson(route, 200, { items: secondPage });
          return;
        }
        const real = await route.fetch();
        const items = rawItems(await real.json());
        const cut = Math.ceil(items.length / 2);
        secondPage = items.slice(cut);
        await fulfillJson(route, real.status(), { items: items.slice(0, cut), nextCursor: PAGE2 });
      });

      const [first, second] = await Promise.all([
        waitForApiWhere(page, (r) => isSummariesResponse(r) && r.status() === 200 && cursorOf(r) === null),
        waitForApiWhere(page, (r) => isSummariesResponse(r) && r.status() === 200 && cursorOf(r) === PAGE2),
        page.reload({ waitUntil: 'commit' }),
      ]);
      await dashboardLoaded(page);
      const pageSizes = [rawItems(first.json).length, rawItems(second.json).length];
      expect(pageSizes[1], 'page 2 holds rows').toBeGreaterThan(0);
      // PG:92-102: every page asks the same limit (500) and page 2 carries the cursor page 1 returned.
      for (const { response } of [first, second]) expect(new URL(response.url()).searchParams.get('limit')).toBe('500');
      const all = summariesOf({ items: [...rawItems(first.json), ...rawItems(second.json)] });

      await expect(projectCards(page)).toHaveCount(all.length);
      await expect(projectCard(page, fixture.name)).toBeVisible();
      await expect(countLine(page)).toHaveText(`${String(all.length)} dự án`);
      const counts = countsOf(all);
      for (const key of ['all', 'done', 'qc', 'processing'] as const) {
        await expect(statValue(page, STATS[key])).toHaveText(String(counts[key]));
      }
      await captureEvidence(page, 'E02_dash_two_pages.png', {
        caption: [
          `N1 in 2 pages (${pageSizes.join(' + ')}) → ${String(all.length)} cards, "${String(all.length)} dự án"`,
          `GET ?limit=500 → 200 nextCursor "${PAGE2}"; GET ?limit=500&cursor=${PAGE2} → 200 (no cursor)`,
        ],
      });
      await attachJson('E02_dash_two_pages.json', { pageSizes, total: all.length, cursor: PAGE2 });
      await page.unrouteAll({ behavior: 'ignoreErrors' });
    });
  });

  test('E02 · SCR-05 [mocked response] N1 page 2 answers 422 CURSOR_INVALID: the read restarts from page 1 once, the list is whole, no error, no doubled card', async ({ browser }) => {
    // pair: phase02_dashboard_api.spec.ts "A02 · N1: … forged cursor → 422 CURSOR_INVALID" (the real 422). Closes coverage #3.
    await withAdmin(browser, async (admin) => {
      const { page } = admin;
      await createProject(admin, 'cursor');
      const STALE = 'qa-mocked-stale-cursor';
      const cursors: (string | null)[] = [];
      await routeSummaries(page, async (route) => {
        const cursor = new URL(route.request().url()).searchParams.get('cursor');
        cursors.push(cursor);
        if (cursor === STALE) {
          await fulfillJson(route, 422, wireError('CURSOR_INVALID'));
          return;
        }
        if (cursors.length === 1) {
          const real = await route.fetch();
          await fulfillJson(route, real.status(), { items: rawItems(await real.json()).slice(0, 1), nextCursor: STALE });
          return;
        }
        await route.continue(); // the restart: the real, whole list
      });

      let firstPageAnswers = 0;
      const [, whole] = await Promise.all([
        waitForApi(page, 'GET', SUMMARIES_RE, [422]),
        waitForApiWhere(page, (r) => isSummariesResponse(r) && r.status() === 200 && cursorOf(r) === null && ++firstPageAnswers === 2),
        page.reload({ waitUntil: 'commit' }),
      ]);
      await dashboardLoaded(page);
      const list = summariesOf(whole.json);
      // PG:111-119: CURSOR_INVALID → readAllPages once more from page 1, into a fresh array (nothing doubled).
      expect(cursors).toEqual([null, STALE, null]);
      await expect(page.getByText(LIST_ERROR_TITLE, { exact: true })).toHaveCount(0);
      await expect(projectCards(page)).toHaveCount(list.length);
      await expect(countLine(page)).toHaveText(`${String(list.length)} dự án`);
      await captureEvidence(page, 'E02_dash_cursor_invalid.png', {
        caption: [
          `page 2 → 422 CURSOR_INVALID (mocked) → restart → ${String(list.length)} cards, no error, "${String(list.length)} dự án"`,
          `GET cursor sequence: ${cursors.map((c) => c ?? '(none)').join(' → ')} (1st 200 nextCursor, 2nd 422, 3rd 200)`,
        ],
      });
      await attachJson('E02_dash_cursor_invalid.json', { cursors, cards: list.length });
      await page.unrouteAll({ behavior: 'ignoreErrors' });
    });
  });

  test('E02 · SCR-05 keyboard: Enter on "Tuỳ chọn cho {name}" opens the card menu and stays on / (the card\'s own Enter must not take it)', async ({ browser }) => {
    await withAdmin(browser, async (admin) => {
      const { page } = admin;
      const project = await createProject(admin, 'menu-enter');
      await reloadDashboard(page);
      const trigger = page.getByRole('button', { name: `Tuỳ chọn cho ${project.name}`, exact: true });
      await trigger.focus();
      await page.keyboard.press('Enter');
      // A12: the keyboard is a first-class path. PCT:74-76 opens the project on any Enter keydown reaching the <article>;
      // the menu button inside it (PCT:97-107) only stops the CLICK from bubbling, not the keydown before it.
      const outcome = await Promise.race([
        cardMenu(page).waitFor({ state: 'visible', timeout: 5_000 }).then(() => 'menu' as const),
        page.waitForURL((url) => url.pathname !== ROUTES.dashboard, { timeout: 5_000, waitUntil: 'commit' }).then(() => 'navigated' as const),
      ]).catch(() => 'nothing' as const);
      await page.waitForTimeout(500); // let a late navigation show itself before judging
      await captureEvidence(page, 'E02_menu_enter_key.png', { caption: `Enter on "Tuỳ chọn cho …" → ${outcome}` });
      await attachJson('E02_menu_enter_key.json', { outcome, landed: pathname(page) });
      expect(outcome, `Enter on the menu button → ${outcome} (${pathname(page)})`).toBe('menu');
      expect(pathname(page)).toBe(ROUTES.dashboard);
      await page.keyboard.press('Escape');
      await expect(cardMenu(page)).toHaveCount(0);
    });
  });

  test('E02 · SCR-05 keyboard focus: Space opens the card menu next to its button; Esc gives focus back to that button; the delete dialog closed by Esc does too', async ({ browser }) => {
    await withAdmin(browser, async (admin) => {
      const { page } = admin;
      const project = await createProject(admin, 'focus');
      await reloadDashboard(page);
      const triggerLabel = `Tuỳ chọn cho ${project.name}`;
      const trigger = page.getByRole('button', { name: triggerLabel, exact: true });
      const menu = cardMenu(page);

      await trigger.focus();
      await page.keyboard.press('Space'); // a keyboard click; the article only listens for Enter (PCT:74-76)
      await expect(menu).toBeVisible();
      await expect(menu.getByRole('menuitem').first()).toBeFocused(); // CM:86-94
      const triggerBox = await trigger.boundingBox();
      const menuBox = await menu.boundingBox();
      const near =
        triggerBox !== null &&
        menuBox !== null &&
        Math.abs(menuBox.x - triggerBox.x) <= 240 &&
        menuBox.y >= triggerBox.y - 8 &&
        menuBox.y <= triggerBox.y + triggerBox.height + 240;
      await captureEvidence(page, 'E02_menu_keyboard_focus.png', {
        caption: `Space on "${triggerLabel}": menu at (${String(menuBox?.x)}, ${String(menuBox?.y)}), button at (${String(triggerBox?.x)}, ${String(triggerBox?.y)})`,
      });
      // PCT:100-103 places the menu at the click's clientX/Y, which a keyboard click reports as 0,0 (the top-left corner).
      expect.soft(near, 'the keyboard-opened menu sits next to its button').toBe(true);

      await page.keyboard.press('Escape'); // CM:74-76
      await expect(menu).toHaveCount(0);
      const afterMenu = await focusedLabel(page);
      // WCAG 2.4.3 + A12: closing a menu hands focus back to its opener; CM itself only moves focus IN (CM:86-94).
      expect.soft(afterMenu, 'focus after Esc on the card menu').toBe(triggerLabel);

      await trigger.focus();
      await page.keyboard.press('Space');
      await expect(menu).toBeVisible();
      await page.keyboard.press('End'); // CM:70-72
      await expect(menu.getByRole('menuitem', { name: 'Xoá', exact: true })).toBeFocused();
      await page.keyboard.press('Enter');
      const dialog = deleteDialog(page);
      await expect(dialog).toBeVisible();
      await page.keyboard.press('Escape'); // focusTrap onEscape → cancelDelete (MOD:64)
      await expect(dialog).toHaveCount(0);
      const afterDialog = await focusedLabel(page);
      // focusTrap.ts:19-23 "Focus goes home": the element focused at activate — the menu item is gone by then (MOD:66).
      expect.soft(afterDialog, 'focus after Esc on the delete dialog').toBe(triggerLabel);
      expect(countApi(admin.api, 'DELETE', `${PROJECTS_API}/${project.id}`), 'Esc deletes nothing').toBe(0);
      await attachJson('E02_menu_keyboard_focus.json', { triggerBox, menuBox, near, afterMenu, afterDialog });
    });
  });

  test('E02 · SCR-05 Back/Forward with a status filter: Back from a project lands on "Tất cả" with an empty search; Forward reopens the project', async ({ browser }) => {
    await withAdmin(browser, async (admin) => {
      const { page } = admin;
      const project = await createProject(admin, 'history');
      const expected = openPathOf(summaryOf(await reloadDashboard(page), project.id));

      await statusFilterButton(page, FILTERS.processing).click();
      await searchBox(page).fill(project.name);
      await expect(projectCards(page)).toHaveCount(1);
      await projectCard(page, project.name).click(); // PCT:73
      await expect.poll(() => pathname(page)).toBe(expected);

      await page.goBack();
      await expect.poll(() => pathname(page)).toBe(ROUTES.dashboard);
      await dashboardLoaded(page);
      // UPD:241-244: plain useState — nothing in the URL or storage, so the remount starts from the defaults.
      await expect(statusFilterButton(page, FILTERS.all)).toHaveAttribute('aria-pressed', 'true');
      await expect(statusFilterButton(page, FILTERS.processing)).toHaveAttribute('aria-pressed', 'false');
      await expect(searchBox(page)).toHaveValue('');
      await captureEvidence(page, 'E02_back_forward_filter.png', { caption: `"${FILTERS.processing}" + search → ${expected} → Back: "${FILTERS.all}", empty search` });

      await page.goForward();
      await expect.poll(() => pathname(page)).toBe(expected);
      await attachJson('E02_back_forward_filter.json', { opened: expected, back: ROUTES.dashboard, forward: pathname(page) });
    });
  });

  test('E02 · SCR-05 deep link with query parameters: "/?q=…&status=done&view=table&sort=name" opens the plain defaults (screen state is not in the URL)', async ({ browser }) => {
    await withAdmin(browser, async (admin) => {
      const { page } = admin;
      const target = `${ROUTES.dashboard}?q=zz-khong-co&status=done&view=table&sort=name`;
      const { json } = await navigateAndWaitForApi(page, () => page.goto(target, { waitUntil: 'commit' }), 'GET', SUMMARIES_RE, [200]);
      await dashboardLoaded(page);
      const list = summariesOf(json);
      // UPD:241-244: search, filter, view and sort are useState defaults; nothing reads the query string.
      await expect(searchBox(page)).toHaveValue('');
      await expect(statusFilterButton(page, FILTERS.all)).toHaveAttribute('aria-pressed', 'true');
      await expect(viewMode(page).getByRole('radio', { name: 'Lưới', exact: true })).toHaveAttribute('aria-checked', 'true');
      await expect(sortCombobox(page, SORT.updated)).toBeVisible();
      await expect(projectCards(page)).toHaveCount(list.length);
      await captureEvidence(page, 'E02_deep_link_params.png', { caption: `${target} → defaults, ${String(list.length)} cards` });
      await attachJson('E02_deep_link_params.json', { target, cards: list.length });
    });
  });

  test('E02 · SCR-05 resize 1440 → 900 with a card menu open: the layout collapses, the menu is re-clamped inside the window and "Đổi tên" still renames', async ({ browser }) => {
    await withAdmin(browser, async (admin) => {
      const { page } = admin;
      const project = await createProject(admin, 'resize');
      await reloadDashboard(page);
      const menu = await openCardMenu(page, project.name);
      const before = await menu.boundingBox();

      // 900, not 1023: this test is about the menu across the breakpoint, not the 1023/1024 edge itself.
      const narrow = { width: 900, height: DESKTOP.height };
      await page.setViewportSize(narrow);
      await expect(stateAnnouncement(page)).toHaveText(STATE.collapsed); // UPD:90-107, :392
      await expect(page.getByRole('radiogroup', { name: COMPACT_FILTER, exact: true })).toBeVisible(); // PD:229-236
      await expect(menu).toBeVisible();
      // CM:43-45: left = min(x, innerWidth − 220 − 8), worked out again on the re-render the collapse causes.
      const after = await menu.boundingBox();
      await captureEvidence(page, 'E02_menu_resize_collapsed.png', { caption: `menu open across 1440 → ${String(narrow.width)}: x ${String(before?.x)} → ${String(after?.x)}` });
      expect(after !== null && after.x >= 0 && after.x + after.width <= narrow.width, `menu box ${JSON.stringify(after)} inside ${String(narrow.width)} px`).toBe(true);

      await menu.getByRole('menuitem', { name: 'Đổi tên', exact: true }).click();
      const input = page.getByRole('textbox', { name: `Đổi tên ${project.name}`, exact: true });
      await expect(input).toBeFocused();
      const renamed = `${project.name}-r`;
      await input.fill(renamed);
      const saved = waitForApi(page, 'PATCH', projectPathRe(project.id), [200]);
      await input.press('Enter');
      await saved;
      await expect(projectCard(page, renamed)).toBeVisible();
      await attachJson('E02_menu_resize_collapsed.json', { before, after, viewport: narrow, renamed });
    });
  });

  test.fixme('E02 · SCR-05 telemetry: opening a project posts "project.open" to POST /api/telemetry', async () => {
    // UNKNOWN — NEED VERIFICATION (coverage #54): UPD:251-253, :391 queue the event, but the sender posts only when the
    // telemetry flag is on (src/lib/telemetry/sender.ts resolveTelemetryEnabled) and batches it for FLUSH_INTERVAL_MS
    // (10 s, sender.ts:107-108) or until the page goes away via navigator.sendBeacon. Whether the F-14 build turns the
    // flag on, and whether Playwright surfaces a sendBeacon request, are both unestablished — write it once known.
  });
});

/* ================================================================= SCR-05 create-project wizard */

test.describe('E02 SCR-05 create-project wizard', () => {
  test('E02 · wizard step 1: blank / 2-char names refused, 80-char cap, code slug drops accents and stops once edited', async ({ browser }) => {
    await withAdmin(browser, async (admin) => {
      const { page } = admin;
      const dialog = await openWizard(page);
      const alert = (text: string): Locator => dialog.getByRole('alert').filter({ hasText: text });
      await expect(stepText(dialog, 1)).toBeVisible();
      await expect(dialog.getByRole('combobox')).toContainText('Nhà ở'); // UCPM:72,79

      await nameField(dialog).fill('   ');
      await expect(alert(NAME_REQUIRED)).toBeVisible(); // UCPM:143-146
      await expect(nextButton(dialog)).toBeDisabled();
      await nameField(dialog).fill('ab');
      await expect(alert(NAME_TOO_SHORT)).toBeVisible(); // UCPM:147-149
      await expect(nextButton(dialog)).toBeDisabled();
      await captureEvidence(page, 'E02_wizard_step1_validation.png');

      await nameField(dialog).fill(' abc ');
      await expect(dialog.getByRole('alert')).toHaveCount(0);
      await expect(nextButton(dialog)).toBeEnabled();
      await expect(codeField(dialog)).toHaveValue('DA-ABC'); // UCPM:165-178

      await nameField(dialog).fill('x'.repeat(81));
      await expect(nameField(dialog)).toHaveValue('x'.repeat(80)); // CPM:104 maxLength → "không quá 80" unreachable
      await expect(dialog.getByRole('alert')).toHaveCount(0);
      await expect(codeField(dialog)).toHaveValue(`DA-${'X'.repeat(24)}`); // CODE_SLUG_MAX_LENGTH UCPM:66

      await nameField(dialog).fill('Nhà Đông Á 2');
      await expect(codeField(dialog)).toHaveValue('DA-NHA-DONG-A-2'); // NFD + đ→d (UCPM:166-170)
      await expect(dialog.getByText(CODE_HINT, { exact: true })).toBeVisible();
      await captureEvidence(page, 'E02_wizard_code_slug.png');

      await codeField(dialog).fill('MA-RIENG');
      await nameField(dialog).fill('Tên khác hẳn');
      await expect(codeField(dialog)).toHaveValue('MA-RIENG'); // UCPM:533-541
      await discardWizard(dialog);
    });
  });

  test('E02 · wizard Esc: an open "Loại công trình" list closes alone; dirty Esc warns, typing clears it, second Esc closes; reopen is blank', async ({ browser }) => {
    await withAdmin(browser, async (admin) => {
      const { page } = admin;
      const dialog = await openWizard(page);
      const warning = dialog.getByText(DISCARD_TITLE, { exact: true });
      await nameField(dialog).fill('Dự án nháp Esc');

      await dialog.getByRole('combobox').click();
      await expect(page.getByRole('listbox')).toBeVisible();
      await page.keyboard.press('Escape'); // UCPM:625: requestClose ignored while the list is open
      await expect(page.getByRole('listbox')).toHaveCount(0);
      await expect(dialog).toBeVisible();
      await expect(warning).toHaveCount(0);

      await page.keyboard.press('Escape'); // dirty → warn (UCPM:630-634, CPM:248-257)
      await expect(warning).toBeVisible();
      await expect(dialog.getByText(DISCARD_HINT, { exact: true })).toBeVisible();
      await captureEvidence(page, 'E02_wizard_esc_discard.png');

      await nameField(dialog).press('End');
      await page.keyboard.type(' 2'); // markDirty hides the warning (UCPM:523-526)
      await expect(warning).toHaveCount(0);
      await page.keyboard.press('Escape');
      await expect(warning).toBeVisible();
      await page.keyboard.press('Escape');
      await expect(dialog).toHaveCount(0);

      const again = await openWizard(page); // CPM:309-328: a new key per opening
      await expect(nameField(again)).toHaveValue('');
      await expect(stepText(again, 1)).toBeVisible();
      await page.keyboard.press('Escape');
      await expect(again).toHaveCount(0);
    });
  });

  test('E02 · wizard close controls: "Đóng hộp thoại" and the backdrop warn on a dirty form, close on the second press; pristine closes at once', async ({ browser }) => {
    await withAdmin(browser, async (admin) => {
      const { page } = admin;
      let dialog = await openWizard(page);
      await nameField(dialog).fill('Dự án nháp X');
      const closeX = dialog.getByRole('button', { name: CLOSE_DIALOG, exact: true }); // MOD:163-171 → requestClose
      await closeX.click();
      await expect(dialog.getByText(DISCARD_TITLE, { exact: true })).toBeVisible();
      await captureEvidence(page, 'E02_wizard_close_controls.png');
      await closeX.click();
      await expect(dialog).toHaveCount(0);

      dialog = await openWizard(page);
      await nameField(dialog).fill('Dự án nháp nền');
      await page.mouse.click(8, DESKTOP.height / 2); // backdrop (MOD:108-117)
      await expect(dialog.getByText(DISCARD_TITLE, { exact: true })).toBeVisible();
      await page.mouse.click(8, DESKTOP.height / 2);
      await expect(dialog).toHaveCount(0);

      dialog = await openWizard(page);
      await dialog.getByRole('button', { name: CLOSE_DIALOG, exact: true }).click();
      await expect(dialog).toHaveCount(0);
      expect(countApi(admin.api, 'POST', PROJECTS_API)).toBe(0);
    });
  });

  test('E02 · wizard step 2 heights: four rows start without height and without errors; 1,99 / 10,01 are refused; "3.5" (= 3,5), 2 and 10 accepted; "2,5" stacks 0,0–7,5 m', async ({ browser }) => {
    await withAdmin(browser, async (admin) => {
      const { page } = admin;
      const dialog = await openWizard(page);
      await toStep2(dialog, 'Dự án chiều cao');
      await expect(nextButton(dialog)).toBeDisabled();
      // BUG-120: step 2 opens neutral — a row complains once the stack has been edited, and the shared field is not such an edit.
      await expect(dialog.getByRole('table').getByRole('alert')).toHaveCount(0);
      for (const name of ['Tầng 1', 'Tầng 2', 'Tầng 3']) {
        await expect(elevationCell(floorRow(dialog, page, name))).toHaveText('—'); // SF:106
      }

      const field = dialog.getByLabel(APPLY_LABEL);
      const apply = dialog.getByRole('button', { name: APPLY_ALL, exact: true });
      // useNumericField refuses out-of-range; `parseNumber` keeps a lone "." as the decimal point, so "3.5" is 3,5 (BUG-132).
      for (const [typed, message] of [['1,99', NUMERIC_MIN], ['10,01', NUMERIC_MAX]] as const) {
        await field.fill(typed);
        await field.press('Tab');
        await expect(dialog.getByText(message, { exact: true })).toBeVisible();
        await expect(apply).toBeDisabled(); // never committed → applyHeightM null (UCPM:491)
      }
      await captureEvidence(page, 'E02_wizard_heights_refused.png', { caption: `apply field "10,01" → "${NUMERIC_MAX}", nothing committed` });
      for (const typed of ['3.5', '2', '10']) {
        await field.fill(typed);
        await field.press('Tab');
        await expect(dialog.getByText(/^Giá trị không/u), `"${typed}" is inside 2–10 m`).toHaveCount(0);
        await expect(apply, `"${typed}" is committed`).toBeEnabled();
      }
      await applyHeight(dialog, '2,5');
      const expected = [['Tầng trệt', '0,0 m'], ['Tầng 1', '2,5 m'], ['Tầng 2', '5,0 m'], ['Tầng 3', '7,5 m']] as const; // UCPM:138-140, alignFloors.ts:451-453
      for (const [name, elevation] of expected) {
        await expect(elevationCell(floorRow(dialog, page, name))).toHaveText(elevation);
      }
      await expect(dialog.getByRole('table').getByRole('alert')).toHaveCount(0);
      await expect(nextButton(dialog)).toBeEnabled();
      await captureEvidence(page, 'E02_wizard_heights.png');
      await discardWizard(dialog);
    });
  });

  test('E02 · wizard step 2 rows: basement goes first at a negative level, "Thêm tầng" adds "Tầng 4", rows rename and delete, no row → "Chưa có tầng nào"', async ({ browser }) => {
    await withAdmin(browser, async (admin) => {
      const { page } = admin;
      const dialog = await openWizard(page);
      await toStep2(dialog, 'Dự án các tầng');
      const basement = dialog.getByRole('switch', { name: BASEMENT_TOGGLE }); // SF:34-40, Toggle.tsx:82-86
      await basement.click();
      await expect(basement).toHaveAttribute('aria-checked', 'true');
      await expect(dialog.getByRole('textbox', { name: /^Tên tầng /u }).first()).toHaveAttribute('aria-label', `Tên tầng ${BASEMENT_NAME}`); // UCPM:602
      await applyHeight(dialog, '3');
      await expect(elevationCell(floorRow(dialog, page, BASEMENT_NAME))).toHaveText(/^[-−]3,0 m$/u); // UCPM:285-289
      await expect(elevationCell(floorRow(dialog, page, 'Tầng trệt'))).toHaveText('0,0 m');
      await basement.click();
      await expect(floorRow(dialog, page, BASEMENT_NAME)).toHaveCount(0);

      await dialog.getByRole('button', { name: ADD_FLOOR, exact: true }).click(); // UCPM:559-566 → nextFloorName(4)
      await expect(floorRow(dialog, page, 'Tầng 4').getByRole('alert')).toHaveText(HEIGHT_MISSING);
      await expect(nextButton(dialog)).toBeDisabled();
      await captureEvidence(page, 'E02_wizard_floor_rows.png');
      await dialog.getByRole('button', { name: 'Xoá Tầng 4', exact: true }).click(); // SF:108-113
      await expect(floorRow(dialog, page, 'Tầng 4')).toHaveCount(0);
      await expect(nextButton(dialog)).toBeEnabled();

      await dialog.getByRole('textbox', { name: 'Tên tầng Tầng 3', exact: true }).fill('Tầng mái'); // UCPM:573-576
      await expect(dialog.getByRole('textbox', { name: 'Tên tầng Tầng mái', exact: true })).toHaveValue('Tầng mái');

      for (const name of ['Tầng trệt', 'Tầng 1', 'Tầng 2', 'Tầng mái']) {
        await dialog.getByRole('button', { name: `Xoá ${name}`, exact: true }).click();
      }
      await expect(dialog.getByText(NO_FLOORS, { exact: true })).toBeVisible(); // SF:58-64
      await expect(dialog.getByText(NO_FLOORS_HINT, { exact: true })).toBeVisible();
      await expect(nextButton(dialog)).toBeDisabled(); // UCPM:487
      await expect(stateAnnouncement(dialog)).toHaveText(STATE.empty); // UCPM:498
      await captureEvidence(page, 'E02_wizard_no_floors.png');
      await dialog.getByRole('button', { name: ADD_FLOOR, exact: true }).click();
      await expect(dialog.getByRole('textbox', { name: 'Tên tầng Tầng trệt', exact: true })).toBeVisible(); // nextFloorName(0)
      await discardWizard(dialog);
    });
  });

  test('E02 · wizard floor cap: "Thêm tầng" disables at 50 floors; 10 m each puts "Tầng 31" over the 300 m elevation limit', async ({ browser }) => {
    test.setTimeout(240_000);
    await withAdmin(browser, async (admin) => {
      const { page } = admin;
      const dialog = await openWizard(page);
      await toStep2(dialog, 'Dự án năm mươi tầng');
      const add = dialog.getByRole('button', { name: ADD_FLOOR, exact: true });
      for (let floors = 4; floors < FLOOR_COUNT_MAX; floors += 1) await add.click();
      await expect(dialog.getByRole('textbox', { name: /^Tên tầng /u })).toHaveCount(FLOOR_COUNT_MAX);
      await expect(add).toBeDisabled(); // UCPM:490, SF:125
      // BUG-136: the cap itself on the shot — the disabled "Thêm tầng" scrolled into view, the 50th row above it.
      await add.scrollIntoViewIfNeeded();
      await expect(add).toBeInViewport();
      await captureEvidence(page, 'E02_wizard_floor_cap_50.png', {
        caption: `${String(FLOOR_COUNT_MAX)} floor rows (LIM:27); "${ADD_FLOOR}" disabled`,
      });

      await applyHeight(dialog, '10');
      await expect(elevationCell(floorRow(dialog, page, 'Tầng 30'))).toHaveText('300,0 m'); // 30 × 10 m, inside LIM:31
      const row31 = floorRow(dialog, page, 'Tầng 31');
      await row31.scrollIntoViewIfNeeded();
      await expect(row31.getByRole('alert')).toHaveText(ELEVATION_LIMIT); // UCPM:127-136, :260-265
      await expect(floorRow(dialog, page, 'Tầng 32').getByRole('alert')).toHaveText(CHAIN_BROKEN);
      await expect(nextButton(dialog)).toBeDisabled();
      await captureEvidence(page, 'E02_wizard_floor_cap.png', { caption: '10 m per floor: "Tầng 31" over the 300 m elevation limit (LIM:31)' });
      await discardWizard(dialog);
    });
  });

  test('E02 · wizard review (step 3) shows every field with "—" for blanks; "Quay lại" keeps what was typed', async ({ browser }) => {
    await withAdmin(browser, async (admin) => {
      const { page } = admin;
      const dialog = await openWizard(page);
      const name = `Dự án xem lại ${Date.now().toString(36)}`;
      await nameField(dialog).fill(name);
      await dialog.getByLabel('Địa chỉ').fill('Số 1 Phố Huế');
      await dialog.getByRole('combobox').click();
      await page.getByRole('option', { name: 'Thương mại', exact: true }).click(); // UCPM:73
      await dialog.getByLabel('Ghi chú').fill('Ghi chú thử');
      const code = await codeField(dialog).inputValue();
      await nextButton(dialog).click();
      await applyHeight(dialog, '3');
      await nextButton(dialog).click();
      await expect(stepText(dialog, 3)).toBeVisible();

      // CPM:163-193
      await expect(reviewValue(dialog, 'Tên dự án')).toHaveText(name);
      await expect(reviewValue(dialog, 'Mã dự án')).toHaveText(code);
      await expect(reviewValue(dialog, 'Địa chỉ')).toHaveText('Số 1 Phố Huế');
      await expect(reviewValue(dialog, 'Loại công trình')).toHaveText('Thương mại');
      await expect(reviewValue(dialog, 'Ghi chú')).toHaveText('Ghi chú thử');
      await expect(reviewValue(dialog, 'Số tầng')).toHaveText('4');
      await expect(dialog.getByText('9,0 m', { exact: true })).toBeVisible(); // "Tầng 3" at 3 × 3 m
      await captureEvidence(page, 'E02_wizard_review.png');

      await dialog.getByRole('button', { name: 'Quay lại', exact: true }).click(); // UCPM:614-616
      await expect(stepText(dialog, 2)).toBeVisible();
      await expect(elevationCell(floorRow(dialog, page, 'Tầng 1'))).toHaveText('3,0 m');
      await dialog.getByRole('button', { name: 'Quay lại', exact: true }).click();
      await expect(stepText(dialog, 1)).toBeVisible();
      await expect(nameField(dialog)).toHaveValue(name);
      await expect(dialog.getByLabel('Địa chỉ')).toHaveValue('Số 1 Phố Huế');
      await expect(dialog.getByRole('combobox')).toContainText('Thương mại');
      await expect(dialog.getByLabel('Ghi chú')).toHaveValue('Ghi chú thử');

      await dialog.getByLabel('Địa chỉ').fill('');
      await dialog.getByLabel('Ghi chú').fill('');
      await codeField(dialog).fill('');
      await nextButton(dialog).click();
      await nextButton(dialog).click();
      for (const label of ['Mã dự án', 'Địa chỉ', 'Ghi chú']) await expect(reviewValue(dialog, label)).toHaveText('—'); // CPM:175-178
      await discardWizard(dialog);
      expect(countApi(admin.api, 'POST', PROJECTS_API)).toBe(0);
    });
  });

  test('E02 · wizard [held response] create: busy state while POST is held, a double click sends ONE POST; its toast "Hoàn tác" deletes the new project', async ({ browser }) => {
    await withAdmin(browser, async (admin) => {
      const { page } = admin;
      const name = uniqueName('wizard');
      const hold = gate();
      let posts = 0;
      await page.route((url) => url.pathname === PROJECTS_API, async (route) => {
        if (route.request().method() !== 'POST') {
          await route.fallback();
          return;
        }
        posts += 1;
        await hold.wait;
        await route.continue();
      });

      const dialog = await openWizard(page);
      await toStep2(dialog, name);
      await applyHeight(dialog, '3');
      await nextButton(dialog).click();
      const created = waitForApi(page, 'POST', PROJECTS_RE, [200, 201]);
      await createButton(dialog).dblclick();
      // CPM:276-296: every footer button locked while submitting; state "đang tải" (UCPM:496).
      await expect(createButton(dialog)).toBeDisabled();
      await expect(dialog.getByRole('button', { name: 'Huỷ', exact: true })).toBeDisabled();
      await expect(dialog.getByRole('button', { name: 'Quay lại', exact: true })).toBeDisabled();
      await expect(stateAnnouncement(dialog)).toHaveText(STATE.loading);
      await captureEvidence(page, 'E02_wizard_creating.png', { caption: 'POST /api/projects held' });
      hold.open();

      const { response, json } = await created;
      const id = stringField(asRecord(json, 'POST /api/projects'), 'id', 'POST /api/projects');
      admin.cleanup.push(id);
      expect(posts, 'POST /api/projects requests for a double click (UCPM:641-643)').toBe(1);
      expect(response.request().headers()['idempotency-key'] ?? '', 'Idempotency-Key (CPC:90, lib/http/client.ts:30)').not.toBe('');
      await page.unrouteAll({ behavior: 'ignoreErrors' });
      await expect(dialog).toHaveCount(0);
      await expect(projectCard(page, name)).toBeVisible();

      // A8 on a project THIS test made (R6 forbids it only for CP-2): undo removes exactly what was created (UCPM:666-673).
      const toast = toastWith(page, createdToast(name));
      await expect(toast).toBeVisible();
      // BUG-215: the "before" half — the new card and its toast; hovering the toast stops its 8 s clock (TST:69-73).
      await toast.hover();
      await captureEvidence(page, 'E02_wizard_create_undo_before.png', { caption: `before undo: card "${name}" + toast "${createdToast(name)}" with "Hoàn tác"` });
      const removed = waitForApi(page, 'DELETE', projectPathRe(id), [200]);
      await toast.getByRole('button', { name: 'Hoàn tác', exact: true }).click();
      await removed;
      await page.mouse.move(0, 0);
      await expect(projectCard(page, name), 'the undone project leaves the list (A8)').toHaveCount(0);
      await captureEvidence(page, 'E02_wizard_create_undone.png', {
        caption: [
          `after "Hoàn tác": card "${name}" gone from the list (pair: E02_wizard_create_undo_before)`,
          `1 POST (201) then DELETE /api/projects/${id} (200)`,
        ],
      });
      await attachJson('E02_wizard_create_undone.json', { posts, created: response.status(), deleted: 200, id });
    });
  });

  test('E02 · wizard: a 33-character "Mã dự án" is refused at step 1 — "Mã dự án" names the limit, "Tiếp tục" is locked, nothing is sent; 32 passes', async ({ browser }) => {
    await withAdmin(browser, async (admin) => {
      const { page } = admin;
      // BUG-176: the FE counts like the BE (trim + NFC, BE:apps/api/projects/schemas.py:27,52) and refuses at step 1.
      // The server-422 → field mapping has its [mocked response] tests in phase02_wizard_edge.spec.ts and the U02 spec.
      const dialog = await openWizard(page);
      await nameField(dialog).fill(uniqueName('code'));
      await codeField(dialog).fill('C'.repeat(33));
      await expect(dialog.getByText(CODE_TOO_LONG, { exact: true })).toBeVisible();
      await expect(codeField(dialog)).toHaveAttribute('aria-invalid', 'true');
      await expect(nameField(dialog)).not.toHaveAttribute('aria-invalid', 'true');
      await expect(nextButton(dialog)).toBeDisabled();
      await expect(dialog.getByText(VALIDATION_DESCRIPTION, { exact: true })).toHaveCount(0);
      await captureEvidence(page, 'E02_wizard_code_33.png', { caption: 'code 33×"C" → "Mã dự án không quá 32 ký tự.", "Tiếp tục" locked' });
      expect(countApi(admin.api, 'POST', PROJECTS_API), 'nothing was sent').toBe(0);

      await codeField(dialog).fill('C'.repeat(32));
      await expect(dialog.getByText(CODE_TOO_LONG, { exact: true })).toHaveCount(0);
      await expect(nextButton(dialog)).toBeEnabled();
      await discardWizard(dialog);
    });
  });

  test('E02 · wizard [mocked response] network lost on create: "Không liên lạc được với máy chủ…" notice, nothing created', async ({ browser }) => {
    await withAdmin(browser, async (admin) => {
      const { page } = admin;
      await page.route((url) => url.pathname === PROJECTS_API, async (route) => {
        if (route.request().method() !== 'POST') {
          await route.fallback();
          return;
        }
        await route.abort('internetdisconnected');
      });
      const dialog = await openWizard(page);
      await toStep2(dialog, uniqueName('offline'));
      await applyHeight(dialog, '3');
      await nextButton(dialog).click();
      await createButton(dialog).click();
      // UCPM:199-208 → describeError(network) (src/lib/http/client.ts:591-598, vi.json:15).
      await expect(dialog.getByText(NETWORK_DESCRIPTION, { exact: true }).first()).toBeVisible({ timeout: SLOW_STATE_MS });
      await expect(createButton(dialog), 'a failure that names no field marks nothing: "Tạo dự án" stays usable to retry (BUG-129)').toBeEnabled();
      await expect(stateAnnouncement(dialog)).toHaveText(STATE.error);
      await captureEvidence(page, 'E02_wizard_network_lost.png');
      await page.unrouteAll({ behavior: 'ignoreErrors' });
      await discardWizard(dialog);
    });
  });
});

/* ================================================================= SCR-06 notifications */

test.describe('E02 SCR-06 notifications', () => {
  test('E02 · SCR-06 bell badge = unread rows (cap "9+"), drawer header and live region agree; SSE subscribed; Esc returns focus to the bell; backdrop closes', async ({ browser }) => {
    await withAdmin(browser, async (admin) => {
      const { page } = admin;
      const sse = page.waitForRequest((r) => new URL(r.url()).pathname === STREAM_PATH, { timeout: SESSION_TIMEOUT_MS }); // NCG:304-319
      await page.reload();
      await dashboardLoaded(page);
      await sse;

      const drawer = await openDrawer(page);
      await expect(bell(page)).toHaveAttribute('aria-expanded', 'true');
      const rows = await drawer.locator('li').count();
      const unread = await drawer.getByRole('button', { name: MARK_READ, exact: true }).count(); // NC:187-198 (unread rows only)
      const badge = badgeFor(unread);
      await expect(bell(page)).toHaveText(badge); // NC:401-409
      if (badge === '') await expect(drawer.locator('h3 + span')).toHaveCount(0);
      else await expect(drawer.locator('h3 + span')).toHaveText(badge); // NC:303-307
      const live = unread > 0 ? LIVE.unread(badge) : rows === 0 ? LIVE.empty : LIVE.allRead; // UNC:915-922
      await expect(drawer.locator('p[role="status"]')).toHaveText(live);
      await captureEvidence(page, 'E02_notif_badge_drawer.png', { caption: `drawer: ${String(rows)} rows, ${String(unread)} unread, live "${live}"` });
      await attachJson('E02_notif_badge.json', { rows, unread, badge, live, sseRequested: STREAM_PATH });

      await page.keyboard.press('Escape'); // DRW:83,95
      await expect(drawer).toHaveCount(0);
      await expect(bell(page)).toHaveAttribute('aria-expanded', 'false');
      await expect(bell(page)).toBeFocused(); // DRW:74-75 focus back to the opener
      // BUG-134: the open drawer covers the header bell, so the badge is shot once the drawer has left.
      await expect(bell(page)).toBeInViewport();
      await expect(bell(page)).toHaveText(badge);
      // BUG-134 (run-15): the admin's inbox is usually all read, so the caption names the state shot and where the
      // counted badge is proven for real (phase02_notify_edge: a second user with real unread invites).
      await captureEvidence(page, 'E02_notif_badge.png', {
        caption: [
          badge === ''
            ? `bell (focused, top right) shows NO badge: ${String(unread)} unread row(s) in the drawer`
            : `bell (focused, top right) badge "${badge}" = ${String(unread)} unread row(s) (cap "9+" over 9)`,
          'counted badge on real unread rows: E02_ntf_two_invites.png (badge 2), E02_ntf_realtime_arrival.png (badge 1)',
        ],
      });

      // Backdrop click closes too (DRW:131-141); the drawer sits on the right 400 px (DRW:67, :159).
      await openDrawer(page);
      await page.mouse.click(8, DESKTOP.height / 2);
      await expect(notificationDrawer(page)).toHaveCount(0);
    });
  });

  test('E02 · SCR-06 filters by keyboard: "Chưa đọc" keeps unread rows, "Nhắc đến tôi" keeps comment mentions, no match → an empty state worded per tab', async ({ browser }) => {
    await withAdmin(browser, async (admin) => {
      const { page } = admin;
      const drawer = await openDrawer(page);
      const rows = drawer.locator('li');
      const all = await rows.count();
      const unread = await drawer.getByRole('button', { name: MARK_READ, exact: true }).count();
      const mentions = await rows.filter({ has: page.getByRole('button', { name: MENTION_ACTION, exact: true }) }).count();
      const group = drawer.getByRole('radiogroup', { name: NOTIF_FILTER, exact: true });

      // No row to show (empty inbox or no match) is the 'empty' state, worded per tab (BUG-126/179); never the "partial" strip.
      const expectFiltered = async (expected: number, marker: string, tab: keyof typeof NOTIF_EMPTY_BY_FILTER): Promise<void> => {
        if (expected === 0) {
          await expect(drawer.getByText(NOTIF_EMPTY_BY_FILTER[tab], { exact: true })).toBeVisible();
          await expect(drawer.getByRole('button', { name: NOTIF_SHOW_EVERYTHING, exact: true })).toBeVisible(); // filtered tabs only
          await expect(drawer.getByText(NOTIF_PARTIAL, { exact: true })).toHaveCount(0);
          await expect(rows).toHaveCount(0);
        } else {
          await expect(rows).toHaveCount(expected);
          await expect(rows.filter({ hasNot: page.getByRole('button', { name: marker, exact: true }) })).toHaveCount(0);
        }
      };

      await group.getByRole('radio', { name: NOTIF_FILTERS.all, exact: true }).focus();
      await page.keyboard.press('ArrowRight'); // NM:109 order all → unread → mentions
      await expect(group.getByRole('radio', { name: NOTIF_FILTERS.unread, exact: true })).toHaveAttribute('aria-checked', 'true');
      await expectFiltered(unread, MARK_READ, 'unread'); // UNC:329-330
      await captureEvidence(page, 'E02_notif_filters.png', { caption: `filter "Chưa đọc": ${String(unread)} of ${String(all)}` });

      await page.keyboard.press('ArrowRight');
      await expect(group.getByRole('radio', { name: NOTIF_FILTERS.mentions, exact: true })).toHaveAttribute('aria-checked', 'true');
      await expectFiltered(mentions, MENTION_ACTION, 'mentions'); // UNC:331-332

      await page.keyboard.press('ArrowRight'); // wraps
      await expect(group.getByRole('radio', { name: NOTIF_FILTERS.all, exact: true })).toHaveAttribute('aria-checked', 'true');
      await expect(rows).toHaveCount(all);
      await attachJson('E02_notif_filters.json', { all, unread, mentions });
    });
  });

  test('E02 · SCR-06 "Đánh dấu tất cả đã đọc": disabled with nothing unread, else marks every row, "Hoàn tác" restores and nothing is sent', async ({ browser }) => {
    await withAdmin(browser, async (admin) => {
      const { page } = admin;
      let drawer = await openDrawer(page);
      const markAll = drawer.getByRole('button', { name: MARK_ALL_READ, exact: true });
      const markButtons = (scope: Locator): Locator => scope.getByRole('button', { name: MARK_READ, exact: true });
      const unread = await markButtons(drawer).count();
      if (unread === 0) {
        await expect(markAll).toBeDisabled(); // NC:239
        await captureEvidence(page, 'E02_notif_mark_all.png', { caption: 'no unread notification → "Đánh dấu tất cả đã đọc" disabled' });
        await attachJson('E02_notif_mark_all.json', { unread, branch: 'disabled' });
        return;
      }

      await markAll.click(); // UNC:793-798 → deferMarkRead (UNC:687-708)
      await expect(markButtons(drawer)).toHaveCount(0);
      await expect(bell(page)).toHaveText('');
      await page.keyboard.press('Escape');
      await expect(drawer).toHaveCount(0);
      await toastWith(page, MARKED_ALL_READ).getByRole('button', { name: 'Hoàn tác', exact: true }).click();
      await page.mouse.move(0, 0);
      await expect(bell(page)).toHaveText(badgeFor(unread));
      drawer = await openDrawer(page);
      await expect(markButtons(drawer)).toHaveCount(unread);
      await captureEvidence(page, 'E02_notif_mark_all.png', { caption: `mark all (${String(unread)}) → "Hoàn tác" → back to ${String(unread)} unread` });

      const leaked = await page
        .waitForResponse(
          (r) => r.request().method() === 'POST' && [MARK_READ_API, MARK_ALL_READ_API].includes(new URL(r.url()).pathname),
          { timeout: UNDO_WINDOW_MS + 2_000 },
        )
        .then(() => true, () => false);
      expect(leaked, 'mark-read sent despite "Hoàn tác"').toBe(false);
      await attachJson('E02_notif_mark_all.json', { unread, branch: 'undone', postSent: leaked });
    });
  });

  test('E02 · SCR-06 mark one read: the POST leaves when the 8 s window ends even while the toast is hovered; a late "Hoàn tác" changes nothing', async ({ browser }) => {
    await withAdmin(browser, async (admin) => {
      const { page } = admin;
      let drawer = await openDrawer(page);
      const markButtons = (scope: Locator): Locator => scope.getByRole('button', { name: MARK_READ, exact: true });
      const unread = await markButtons(drawer).count();
      test.skip(unread === 0, 'data: no unread notification for the admin now (needs e.g. CP-5); nothing to mark read');

      // `has` is resolved inside each <li>, so the inner locator starts from the page, not from the drawer.
      const row = drawer.locator('li').filter({ has: page.getByRole('button', { name: MARK_READ, exact: true }) }).first();
      await row.hover();
      const sent = page.waitForResponse(
        (r) => r.request().method() === 'POST' && new URL(r.url()).pathname === MARK_READ_API,
        { timeout: UNDO_WINDOW_MS + 15_000 },
      );
      const clickedAt = Date.now();
      await row.getByRole('button', { name: MARK_READ, exact: true }).click();
      await expect(markButtons(drawer)).toHaveCount(unread - 1);
      await page.keyboard.press('Escape');
      await expect(drawer).toHaveCount(0);

      // The hook's timer (UNC:695) is not the toast's: hovering only pauses the toast bar (TST:66-70, :128-129).
      const toast = toastWith(page, MARKED_READ);
      await toast.hover();
      const response = await sent;
      const elapsed = Date.now() - clickedAt;
      expect(response.ok(), `POST ${MARK_READ_API}`).toBe(true);
      const ids = asRecord(response.request().postDataJSON() as unknown, 'POST read body').ids;
      expect(Array.isArray(ids) ? ids.length : -1, 'one id').toBe(1);
      expect(elapsed, 'sent at the end of the undo window').toBeGreaterThanOrEqual(UNDO_WINDOW_MS - 1_000);

      // Ticket expired (undoTicket.ts:51-62, NotificationHost.tsx:68-69): the click is a no-op.
      await expect(toast).toBeVisible();
      await toast.getByRole('button', { name: 'Hoàn tác', exact: true }).click();
      await page.mouse.move(0, 0);
      drawer = await openDrawer(page);
      await expect(markButtons(drawer)).toHaveCount(unread - 1);
      await captureEvidence(page, 'E02_notif_markread_sent.png', { caption: `POST /api/notifications/read after ${String(elapsed)} ms; late "Hoàn tác" ignored` });
      await attachJson('E02_notif_markread_sent.json', { unreadBefore: unread, elapsedMs: elapsed, status: response.status(), ids: 1 });
    });
  });

  test('E02 · SCR-06 clicking a notification opens its project screen (never the dashboard) and closes the drawer', async ({ browser }) => {
    await withAdmin(browser, async (admin) => {
      const { page } = admin;
      const drawer = await openDrawer(page);
      const rows = drawer.locator('li');
      const total = await rows.count();
      test.skip(total === 0, 'data: the admin has no notification yet (they come from the pipeline, Phase 3)');

      // Prefer a row already read: no write. Unread → POST /read right away (UNC:726-738).
      const readRows = rows.filter({ hasNot: page.getByRole('button', { name: MARK_READ, exact: true }) });
      const useRead = (await readRows.count()) > 0;
      const posted = useRead ? null : waitForApi(page, 'POST', MARK_READ_RE, [200, 204]);
      await (useRead ? readRows : rows).first().getByRole('button').first().click(); // sentence button (NC:161-169)
      await expect.poll(() => pathname(page)).not.toBe(ROUTES.dashboard);
      expect(pathname(page)).toMatch(/^\/projects\/[^/]+\//u); // NCG:107-138: no branch returns the dashboard
      await expect(notificationDrawer(page)).toHaveCount(0);
      if (posted !== null) await posted;
      await captureEvidence(page, 'E02_notif_item_open.png', { caption: `notification → ${pathname(page)}` });
      await attachJson('E02_notif_item_open.json', { landed: pathname(page), wasUnread: !useRead });
    });
  });

  test('E02 · SCR-06 "Mở cài đặt thông báo" goes to /tai-khoan and closes the drawer', async ({ browser }) => {
    await withAdmin(browser, async (admin) => {
      const { page } = admin;
      const drawer = await openDrawer(page);
      await drawer.getByRole('button', { name: NOTIF_SETTINGS, exact: true }).click(); // UNC:772-775
      await expect.poll(() => pathname(page)).toBe(ROUTES.account);
      await expect(notificationDrawer(page)).toHaveCount(0);
      await captureEvidence(page, 'E02_notif_settings.png', { caption: `"${NOTIF_SETTINGS}" → ${ROUTES.account}` });
    });
  });

  test('E02 · SCR-06 "Xem tất cả" opens /thong-bao; Esc there goes back to / through history', async ({ browser }) => {
    await withAdmin(browser, async (admin) => {
      const { page } = admin;
      const drawer = await openDrawer(page);
      // BUG-214: the "from" half — the drawer over the dashboard, before "Xem tất cả" leaves it.
      await captureEvidence(page, 'E02_notif_viewall_from.png', { caption: `before: drawer open over the dashboard (${ROUTES.dashboard}), "${VIEW_ALL}" at its foot` });
      await drawer.getByRole('button', { name: VIEW_ALL, exact: true }).click(); // UNC:767-770
      await expect.poll(() => pathname(page)).toBe(ROUTES.notifications);
      await expect(notificationDrawer(page)).toBeVisible(); // NCC:223 pinned open
      await expect(dashboardHeading(page)).toHaveCount(0);
      await captureEvidence(page, 'E02_notif_viewall.png', {
        caption: [
          `after "${VIEW_ALL}": ${ROUTES.dashboard} → ${ROUTES.notifications}; the dashboard behind is gone (pair: E02_notif_viewall_from)`,
          `${ROUTES.notifications} is the drawer pinned open over an empty backdrop by design (NotificationCenterRoute, NCC:223)`,
        ],
      });

      await page.keyboard.press('Escape'); // NCC:212-221: in-app history → navigate(-1)
      await expect.poll(() => pathname(page)).toBe(ROUTES.dashboard);
      await expect(dashboardHeading(page)).toBeVisible();
      await expect(notificationDrawer(page)).toHaveCount(0);
      await attachJson('E02_notif_viewall_back.json', { viewAll: ROUTES.notifications, afterEsc: pathname(page) });
    });
  });

  test('E02 · SCR-06 on /thong-bao, "Xem tất cả" keeps the route open and Esc still leaves it', async ({ browser }) => {
    await withAdmin(browser, async (admin) => {
      const { page } = admin;
      await page.goto(ROUTES.notifications);
      const drawer = notificationDrawer(page);
      await expect(drawer).toBeVisible();
      await drawer.getByRole('button', { name: VIEW_ALL, exact: true }).click();
      await expect.poll(() => pathname(page)).toBe(ROUTES.notifications);
      await expect(drawer).toBeVisible();
      await captureEvidence(page, 'E02_notif_route_viewall.png', {
        caption: `opened ${ROUTES.notifications} by URL, then "${VIEW_ALL}" at the drawer's foot: no navigation, still ${ROUTES.notifications}, drawer kept open`,
      });

      // NCC:167-171 + A12: on the route "close" means leaving it; Esc (DRW:83,95) reaches `goBack` (NCC:212-221).
      // NCC:204-209 sets `hasLeftRef` on that same-route navigation — this asserts Esc is not left dead by it.
      await page.keyboard.press('Escape');
      await expect.poll(() => pathname(page), { timeout: 10_000 }).not.toBe(ROUTES.notifications);
      await attachJson('E02_notif_route_viewall.json', { afterEsc: pathname(page) });
    });
  });

  test('E02 · SCR-06 [mocked response] list read held then 500: skeleton rows and disabled "mark all", then "Không tải được thông báo" + "Thử lại"', async ({ browser }) => {
    await withAdmin(browser, async (admin) => {
      const { page } = admin;
      const hold = gate();
      await page.route((url) => url.pathname === NOTIFICATIONS_API, async (route) => {
        if (route.request().method() !== 'GET') {
          await route.fallback();
          return;
        }
        await hold.wait;
        await route.fulfill({ status: 500, contentType: 'application/json', body: '{}' });
      });
      await page.reload();
      await dashboardLoaded(page);
      await bell(page).click();
      const drawer = notificationDrawer(page);
      await expect(drawer).toBeVisible();
      await expect(drawer.locator('.animate-pulse').first()).toBeVisible(); // NC:243-244
      await expect(drawer.getByRole('button', { name: MARK_ALL_READ, exact: true })).toBeDisabled(); // NC:239
      await captureEvidence(page, 'E02_notif_loading.png');

      hold.open();
      await expect(drawer.getByText(NOTIF_ERROR_TITLE, { exact: true })).toBeVisible({ timeout: SLOW_STATE_MS }); // NC:245-253
      await expect(drawer.locator('p[role="status"]')).toHaveText(LIVE.loadFailed); // UNC:916-917
      await expect(drawer.getByRole('button', { name: MARK_ALL_READ, exact: true })).toBeDisabled();
      await captureEvidence(page, 'E02_notif_error.png');

      await page.unrouteAll({ behavior: 'ignoreErrors' });
      await drawer.getByRole('button', { name: RETRY, exact: true }).click(); // UNC:902-904
      await expect(drawer.getByText(NOTIF_ERROR_TITLE, { exact: true })).toHaveCount(0, { timeout: SLOW_STATE_MS });
    });
  });

  test('E02 · SCR-06 compact: /thong-bao is a bottom sheet with "Mức 1–3"; "Mức 2" lowers it to 40 % of the screen; Esc leaves', async ({ browser }) => {
    await withAdmin(
      browser,
      async (admin) => {
        const { page } = admin;
        await page.goto(ROUTES.notifications);
        const sheet = notificationDrawer(page); // DRW:70 (max-width 1023px) → BottomSheet (DRW:205-210)
        await expect(sheet).toBeVisible();
        const group = sheet.getByRole('group', { name: SHEET_GROUP, exact: true });
        await expect(group.getByRole('button', { name: snapButton(3), exact: true })).toHaveAttribute('aria-pressed', 'true'); // DRW:72
        // BUG-137: the sheet slides in with a JS spring (DRW:196-221, `y: 100% → 0`), which `animations: 'disabled'` does
        // not stop. Shoot once its top has come to rest at the "Mức 3" height (90 %, DRW:29-33) for two reads in a row.
        const restingTop = COMPACT.height - Math.round(COMPACT.height * 0.9);
        const sheetTop = (): Promise<number> => sheet.evaluate((el) => el.getBoundingClientRect().top);
        await expect
          .poll(async () => {
            const before = await sheetTop();
            await page.waitForTimeout(150);
            const after = await sheetTop();
            return Math.abs(after - before) < 0.5 && Math.abs(after - restingTop) <= 2;
          })
          .toBe(true);
        await captureEvidence(page, 'E02_notif_sheet_375.png', { caption: `sheet at rest, "Mức 3": top ${String(restingTop)} px` });

        await group.getByRole('button', { name: snapButton(2), exact: true }).click();
        await expect(group.getByRole('button', { name: snapButton(2), exact: true })).toHaveAttribute('aria-pressed', 'true');
        const target = Math.round(COMPACT.height * 0.4); // DRW:29-33
        await expect
          .poll(async () => Math.abs((await sheet.evaluate((el) => el.getBoundingClientRect().height)) - target))
          .toBeLessThanOrEqual(2);
        await attachJson('E02_notif_sheet_375.json', { viewport: COMPACT, snap2HeightPx: target });

        await page.keyboard.press('Escape'); // direct load → `/` (NCC:215-218)
        await expect.poll(() => pathname(page)).toBe(ROUTES.dashboard);
      },
      COMPACT,
    );
  });
});

/* ================================================================= SCR-07 onboarding */

test.describe('E02 SCR-07 onboarding (/onboarding)', () => {
  test('E02 · SCR-07 cards follow the newest project: step 1 done, "Tải bản vẽ" open → /projects/{id}/upload, "Duyệt kết quả" locked with its reason', async ({ browser }) => {
    await withAdmin(browser, async (admin) => {
      const { page } = admin;
      const project = await createProject(admin, 'onboard');
      await clearSeenFlags(page);
      const { json } = await navigateAndWaitForApi(page, () => page.goto(ROUTES.onboarding, { waitUntil: 'commit' }), 'GET', SUMMARIES_RE, [200]);
      const latest = gatewayOrder(summariesOf(json))[0]; // UWS:222-228 (most recently updated)
      expect(latest?.id, 'the fixture is the newest project').toBe(project.id);

      await expect(page.getByRole('heading', { level: 1 })).toHaveText(GREETING);
      // walls 0 → step 2 open, step 3 locked (UWS:268-273, :345-396).
      await expect(page.getByRole('button', { name: ONBOARD.step1Action, exact: true })).toBeEnabled();
      await expect(page.getByRole('button', { name: ONBOARD.step2Action, exact: true })).toBeEnabled();
      await expect(page.getByText(ONBOARD.step2Locked, { exact: true })).toHaveCount(0);
      const review = page.getByRole('button', { name: ONBOARD.step3Action, exact: true });
      await expect(review).toBeDisabled(); // WS:228
      await expect(review).toHaveAccessibleDescription(ONBOARD.step3Locked); // WS:230, :234-237
      await captureEvidence(page, 'E02_onboard_cards.png');

      await page.getByRole('button', { name: ONBOARD.step2Action, exact: true }).click(); // UWS:325-328
      await expect.poll(() => pathname(page)).toBe(ROUTES.project.upload(project.id));
      // Partial progress never sets the seen flag (UWS:294-297).
      expect(await page.evaluate((key) => window.localStorage.getItem(key), `${WELCOME_SEEN_PREFIX}${admin.userId}`)).toBeNull();
      await attachJson('E02_onboard_cards.json', { latest: project.id, landed: pathname(page), seenFlag: null });
    });
  });

  test('E02 · SCR-07 "Xem hướng dẫn 2 phút" is aria-disabled with its reason; "Xem dự án mẫu" leaves to / without setting the seen flag', async ({ browser }) => {
    await withAdmin(browser, async (admin) => {
      const { page } = admin;
      await createProject(admin, 'sample'); // newest = 0 walls → "partial", so the flag is not set on its own
      await clearSeenFlags(page);
      await page.goto(ROUTES.onboarding);
      const tutorial = page.getByRole('button', { name: ONBOARD.tutorial, exact: true });
      await expect(tutorial).toHaveAttribute('aria-disabled', 'true'); // WS:158-185, UWS:413-420
      await expect(tutorial).toHaveAccessibleDescription(ONBOARD.tutorialDisabled);
      await expect(page.getByRole('button', { name: ONBOARD.skip, exact: true })).toHaveAccessibleDescription(ONBOARD.skipNotice); // WS:336-341
      // aria-disabled keeps it in the Tab order (WS:150-157); Enter on it does nothing (onClick undefined, WS:167).
      await tutorial.focus();
      await page.keyboard.press('Enter');
      expect(pathname(page)).toBe(ROUTES.onboarding);
      await captureEvidence(page, 'E02_onboard_links.png');

      await page.getByRole('button', { name: ONBOARD.sample, exact: true }).click(); // UWS:341-343, :405-408
      await expect.poll(() => pathname(page)).toBe(ROUTES.dashboard);
      const seenKey = `${WELCOME_SEEN_PREFIX}${admin.userId}`;
      expect(await page.evaluate((key) => window.localStorage.getItem(key), seenKey)).toBeNull();
      await page.goto(ROUTES.onboarding); // WSC:136-142: not seen → the screen again
      await expect(page.getByRole('heading', { level: 1 })).toHaveText(GREETING);
      expect(pathname(page)).toBe(ROUTES.onboarding);
      await attachJson('E02_onboard_links.json', { afterSample: ROUTES.dashboard, seenFlag: null, reopened: pathname(page) });
    });
  });

  test('E02 · SCR-07 card 1 "Tạo dự án" opens the create dialog on /onboarding itself', async ({ browser }) => {
    await withAdmin(browser, async (admin) => {
      const { page } = admin;
      await clearSeenFlags(page);
      await page.goto(ROUTES.onboarding);
      await page.getByRole('button', { name: ONBOARD.step1Action, exact: true }).click(); // UWS:317-323 → WSC:82-103
      const dialog = wizard(page);
      await expect(dialog).toBeVisible();
      expect(pathname(page)).toBe(ROUTES.onboarding);
      await captureEvidence(page, 'E02_onboard_create_dialog.png');
      await page.keyboard.press('Escape');
      await expect(dialog).toHaveCount(0);
      expect(pathname(page)).toBe(ROUTES.onboarding);
    });
  });

  test('E02 · SCR-07 [mocked response] N1 held then 500: busy cards without links, then "Không đọc được tiến độ" + "Thử lại"', async ({ browser }) => {
    await withAdmin(browser, async (admin) => {
      const { page } = admin;
      await clearSeenFlags(page);
      const hold = gate();
      await routeSummaries(page, async (route) => {
        await hold.wait;
        await route.fulfill({ status: 500, contentType: 'application/json', body: '{}' });
      });
      await page.goto(ROUTES.onboarding);
      await expect(page.locator('[role="status"][aria-busy="true"]')).toBeVisible(); // WS:245-257
      await expect(page.getByRole('button', { name: ONBOARD.skip, exact: true })).toHaveCount(0); // WS:322
      await captureEvidence(page, 'E02_onboard_loading.png');

      hold.open();
      await expect(page.getByText(ONBOARD.errorTitle, { exact: true })).toBeVisible({ timeout: SLOW_STATE_MS }); // WS:294-301
      await expect(page.getByText(ONBOARD.errorDescription, { exact: true })).toBeVisible(); // UWS:145, :449
      await expect(page.getByRole('button', { name: ONBOARD.skip, exact: true })).toBeVisible();
      await captureEvidence(page, 'E02_onboard_error.png');

      await page.unrouteAll({ behavior: 'ignoreErrors' });
      await page.getByRole('button', { name: RETRY, exact: true }).click(); // UWS:429-433
      await expect(page.getByRole('heading', { level: 2, name: ONBOARD.step1Title, exact: true })).toBeVisible({ timeout: SLOW_STATE_MS });
    });
  });

  test('E02 · SCR-07 compact (375): the three cards stack in one column', async ({ browser }) => {
    await withAdmin(
      browser,
      async (admin) => {
        const { page } = admin;
        await clearSeenFlags(page);
        await page.goto(ROUTES.onboarding);
        const cards = page.getByRole('listitem');
        await expect(cards).toHaveCount(3);
        const boxes = await Promise.all([0, 1, 2].map((index) => cards.nth(index).boundingBox()));
        const [first, second, third] = boxes;
        // WS:88-93: `flex-col` below `lg` (1024 px).
        expect(
          first && second && third && Math.abs(first.x - second.x) < 2 && Math.abs(second.x - third.x) < 2 && first.y < second.y && second.y < third.y,
          'cards stacked',
        ).toBe(true);
        await captureEvidence(page, 'E02_onboard_compact_375.png', { fullPage: true });
        await attachJson('E02_onboard_compact_375.json', { viewport: COMPACT, boxes });
      },
      COMPACT,
    );
  });

  test('E02 · SCR-07 double click on "Bỏ qua": one navigation to /, the seen flag set once', async ({ browser }) => {
    await withAdmin(browser, async (admin) => {
      const { page } = admin;
      await clearSeenFlags(page);
      await page.goto(ROUTES.onboarding);
      const skip = page.getByRole('button', { name: ONBOARD.skip, exact: true });
      await expect(skip).toBeVisible();
      const before = await page.evaluate(() => window.history.length);
      await skip.dblclick(); // UWS:256-264: a second click while dissolving queues nothing
      await expect.poll(() => pathname(page)).toBe(ROUTES.dashboard);
      await expect(dashboardHeading(page)).toBeVisible();
      const after = await page.evaluate(() => window.history.length);
      expect(after, 'history entries added by the double click').toBe(before + 1);
      const seenKey = `${WELCOME_SEEN_PREFIX}${admin.userId}`;
      expect(await page.evaluate((key) => window.localStorage.getItem(key), seenKey)).toBe('true'); // UWS:190-198
      await captureEvidence(page, 'E02_onboard_double_skip.png', { caption: `history +${String(after - before)}; flag ${seenKey}=true` });
      await attachJson('E02_onboard_double_skip.json', { historyBefore: before, historyAfter: after, seenFlag: 'true' });
    });
  });
});

/* ================================================================= QA-02 shared components (FE 271538cb)
 * Gaps left by the shared-component changes merged in 271538cb (coverage/phase02.md rows S1-S9). Sources cited by
 * file at 271538cb: Table.tsx = src/components/ui/Table.tsx, TST = src/components/feedback/Toast.tsx,
 * MOD = src/components/overlay/Modal.tsx, DRW = src/components/overlay/Drawer.tsx, TT = src/components/ui/Tooltip.tsx,
 * BV = src/components/ui/buttonVariants.ts, ES = src/components/feedback/EmptyState.tsx, BC = src/components/shell/Breadcrumb.tsx,
 * CPN = src/lib/query/cachedProjectName.ts, SR = src/lib/input/shortcutRegistry.ts; PD / UPD at their 271538cb lines.
 * Budget of this block: 7 fixture projects (POST + DELETE), ~2 refreshes per test, no login beyond the worker's own,
 * one [mocked response] test (N1 500, unpairable: 5xx).
 */

/** DRW:32 — what each snap dot does, said as its description and as its tooltip. */
const SNAP_HINTS = { 1: 'Thu gọn', 2: 'Nửa màn hình', 3: 'Gần toàn màn hình' } as const;
/** DRW:34-36: "Mức 1" (snap 0) is the 88 px peek. */
const SNAP_PEEK_PX = 88;
/** src/i18n/vi.json:63 `errors.unknown.description` (read at run time by describeError.ts:3) — the copy changed in 271538cb. */
const UNKNOWN_ERROR_DESCRIPTION = 'Hệ thống đã ghi nhận và sẽ kiểm tra. Hãy thử lại thao tác vừa làm.';
const OLD_UNKNOWN_TAIL = 'Bạn có thể tải lại rồi thử lại.'; // 5afd8b8a copy, must be gone
const NO_MATCH_DESCRIPTION = 'Không có dự án nào khớp với bộ lọc hiện tại.'; // PD:264
const PIPELINE_NAV = 'Xử lý'; // ProcessingScreen.tsx:60 (BREADCRUMB_PIPELINE = the nav's aria-label, :223)
const BREADCRUMB_NAV = 'Đường dẫn trang'; // BC:19
const UNDO = 'Hoàn tác'; // TST:144
/** BC:130 / ProcessingScreen.tsx:62 `max-w-[140px]` below 640 px. */
const CRUMB_MAX_PX = 140;

/** One unbroken word of exactly 80 characters (LIM:23 max) carrying the run prefix — no space to wrap at. */
const unbroken80 = (slug: string): string => {
  const name = `${uniqueName(slug)}-`.padEnd(80, 'w');
  expect(name).toHaveLength(80);
  expect(/\s/u.test(name), 'no break opportunity in the name').toBe(false);
  return name;
};

/** The colours a `danger` button must paint (BV:12): `--state-violation-text` fill, `--bg-surface` text. */
async function dangerPaint(button: Locator): Promise<{ bg: string; fg: string; wantBg: string; wantFg: string }> {
  return button.evaluate((el) => {
    const probe = document.createElement('span');
    probe.style.backgroundColor = 'var(--state-violation-text)';
    probe.style.color = 'var(--bg-surface)';
    document.body.append(probe);
    const want = getComputedStyle(probe);
    const wantBg = want.backgroundColor;
    const wantFg = want.color;
    probe.remove();
    const own = getComputedStyle(el);
    return { bg: own.backgroundColor, fg: own.color, wantBg, wantFg };
  });
}

interface CrumbMetrics {
  readonly width: number;
  readonly scroll: number;
  readonly client: number;
  readonly textOverflow: string;
  readonly lineHeight: string;
  readonly title: string | null;
}

/** A truncated crumb: its box, whether its text overflows it, and the `text-overflow` that draws the "…". */
const crumbMetrics = (crumb: Locator): Promise<CrumbMetrics> =>
  crumb.evaluate((el) => {
    const cs = getComputedStyle(el);
    return {
      width: el.getBoundingClientRect().width,
      scroll: el.scrollWidth,
      client: el.clientWidth,
      textOverflow: cs.textOverflow,
      lineHeight: cs.lineHeight,
      title: el.getAttribute('title'),
    };
  });

test.describe('E02 QA-02 shared components (FE 271538cb) — SCR-05 / SCR-06 / SCR-07', () => {
  test('E02 · SCR-05 table view headers are real column headers: five `columnheader` roles, every `th` scope="col" (BUG-115)', async ({ browser }) => {
    await withAdmin(browser, async (admin) => {
      const { page } = admin;
      const tag = uniqueName('thscope');
      await createProject(admin, 'thscope', tag);
      await reloadDashboard(page);
      await viewMode(page).getByRole('radio', { name: 'Bảng', exact: true }).click();
      await searchBox(page).fill(tag);
      await expect(tableRows(page)).toHaveCount(1);
      // Table.tsx:177-179 `scope="col"` on every Table.Head; ProjectTable.tsx:33-37 the five headers.
      const headers = page.getByRole('main').getByRole('columnheader');
      await expect(headers).toHaveText([...TABLE_HEADERS]);
      const scopes = await tableHeads(page).evaluateAll((heads) => heads.map((head) => head.getAttribute('scope')));
      expect(scopes).toEqual(TABLE_HEADERS.map(() => 'col'));
      await captureEvidence(page, 'E02_dash_th_scope.png', { caption: `table view: ${String(scopes.length)} th, scope=${scopes.join(',')}; getByRole('columnheader') finds all five` });
      await attachJson('E02_dash_th_scope.json', { headers: await headers.allTextContents(), scopes });
    });
  });

  test('E02 · SCR-05 delete dialog by keyboard: Enter on "Để nguyên" closes it (nothing sent), Space on "Xoá dự án" deletes; "Xoá dự án" is the solid danger button (BUG-151, BUG-155)', async ({ browser }) => {
    await withAdmin(browser, async (admin) => {
      const { page } = admin;
      const project = await createProject(admin, 'delkbd');
      await reloadDashboard(page);
      const dialog = deleteDialog(page);
      const askDelete = async (): Promise<void> => {
        const menu = await openCardMenu(page, project.name);
        await menu.getByRole('menuitem', { name: 'Xoá', exact: true }).click();
        await expect(dialog).toBeVisible();
      };
      const keep = dialog.getByRole('button', { name: KEEP, exact: true }); // PD:312-314 (ghost)
      const confirm = dialog.getByRole('button', { name: CONFIRM_DELETE, exact: true }); // PD:315-321 variant="danger"

      await askDelete();
      // BV:12 solid danger: `bg-state-violation-text text-bg-surface` (a pale tint before 271538cb, BUG-155).
      const paint = await dangerPaint(confirm);
      const keepBg = await keep.evaluate((el) => getComputedStyle(el).backgroundColor);
      expect(paint.bg, '"Xoá dự án" filled with --state-violation-text').toBe(paint.wantBg);
      expect(paint.fg, '"Xoá dự án" text in --bg-surface').toBe(paint.wantFg);
      expect(keepBg, '"Để nguyên" does not share the danger fill').not.toBe(paint.bg);

      await keep.focus();
      await expect(keep).toBeFocused();
      await captureEvidence(page, 'E02_dash_delete_kbd_keep.png', { caption: 'focus on "Để nguyên" (Enter next); "Xoá dự án" solid danger' });
      // SR:552-557: a modal scope no longer preventDefaults a lone key, so Enter activates the focused button (BUG-151).
      await page.keyboard.press('Enter');
      await expect(dialog).toHaveCount(0);
      expect(countApi(admin.api, 'DELETE', `${PROJECTS_API}/${project.id}`), 'Enter on "Để nguyên" sends no DELETE').toBe(0);

      await askDelete();
      await confirm.focus();
      const removed = waitForApi(page, 'DELETE', projectPathRe(project.id), [200]);
      await page.keyboard.press('Space'); // same lone-key path (SR:552-557) → confirmDelete (UPD:458)
      await removed;
      await expect(dialog).toHaveCount(0);
      await expect(projectCard(page, project.name)).toHaveCount(0);
      await captureEvidence(page, 'E02_dash_delete_kbd_space.png', { caption: 'Space on "Xoá dự án" → DELETE 200, card gone' });
      await attachJson('E02_dash_delete_kbd.json', { paint, keepBg, deletes: countApi(admin.api, 'DELETE', `${PROJECTS_API}/${project.id}`) });
    });
  });

  test('E02 · SCR-05 rename toast with an 80-character unbroken name: the message wraps inside the 320 px toast and "Hoàn tác" stays inside and works (BUG-131)', async ({ browser }) => {
    await withAdmin(browser, async (admin) => {
      const { page } = admin;
      const project = await createProject(admin, 'toastlong');
      await reloadDashboard(page);
      const long = unbroken80('tl');
      const input = await startRename(page, project.name);
      await input.fill(long);
      const patched = waitForApi(page, 'PATCH', projectPathRe(project.id), [200]);
      await input.press('Enter'); // UPD:439 toast "Đã đổi tên thành …" with undo
      await patched;
      const toast = toastWith(page, renamedToast(long));
      await expect(toast).toBeVisible();
      const undo = toast.getByRole('button', { name: UNDO, exact: true });
      await expect(undo).toBeVisible();
      // TST:133-134 `min-w-0 break-words` on the message; the toast is `overflow-hidden` (TST:121): a clipped button = BUG-131.
      const layout = await toast.evaluate((el) => {
        const box = el.getBoundingClientRect();
        const message = el.querySelector('span.flex-1');
        const button = [...el.querySelectorAll('button')].find((b) => (b.textContent ?? '').trim() === 'Hoàn tác');
        const b = button?.getBoundingClientRect();
        return {
          toast: { left: box.left, right: box.right, width: box.width },
          button: b === undefined ? null : { left: b.left, right: b.right, width: b.width },
          message: message === null ? null : { scroll: message.scrollWidth, client: message.clientWidth, height: message.getBoundingClientRect().height },
        };
      });
      const inside = layout.button !== null && layout.button.left >= layout.toast.left && layout.button.right <= layout.toast.right + 0.5;
      await captureEvidence(page, 'E02_dash_toast_long_name.png', { caption: `80-char unbroken name: message ${String(Math.round(layout.message?.height ?? 0))} px high, "Hoàn tác" ${inside ? 'inside' : 'CLIPPED'}` });
      await attachJson('E02_dash_toast_long_name.json', layout);
      expect(inside, '"Hoàn tác" inside the toast box').toBe(true);
      expect(layout.message !== null && layout.message.scroll <= layout.message.client + 1, 'message wraps, no overflow past its column').toBe(true);

      const restored = waitForApi(page, 'PATCH', projectPathRe(project.id), [200]);
      await undo.click(); // within the 8 s window (UT:18)
      expect(stringField(asRecord((await restored).json, 'PATCH'), 'name', 'PATCH')).toBe(project.name);
      await expect(projectCard(page, project.name)).toBeVisible();
      await captureEvidence(page, 'E02_dash_toast_long_undo.png', { caption: '"Hoàn tác" → second PATCH, old name back' });
    });
  });

  test('E02 · SCR-05 375 px delete dialog for an 80-character unbroken name stays inside the 343 px frame; no page-level sideways scroll (Modal max-w-full)', async ({ browser }) => {
    await withAdmin(
      browser,
      async (admin) => {
        const { page } = admin;
        const project = await createProject(admin, 'dl375', unbroken80('dl'));
        await reloadDashboard(page);
        const menu = await openCardMenu(page, project.name);
        await menu.getByRole('menuitem', { name: 'Xoá', exact: true }).click();
        const dialog = deleteDialog(page);
        await expect(dialog).toBeVisible();
        // MOD:131-133 `max-w-full` inside the `p-4` frame: 375 − 2×16 = 343 px whatever the content's min-content width.
        const frame = COMPACT.width - 2 * 16;
        await expect.poll(async () => Math.round((await dialog.boundingBox())?.width ?? Number.POSITIVE_INFINITY)).toBeLessThanOrEqual(frame);
        const layout = {
          viewport: COMPACT,
          dialog: await dialog.boundingBox(),
          page: await page.evaluate(() => ({ scroll: document.documentElement.scrollWidth, client: document.documentElement.clientWidth })),
          // PD:301 the sentence has no break-words: with no space in the name the line may still overflow its own box.
          bodyLine: await dialog.getByText(deleteBody(project.name), { exact: true }).evaluate((el) => ({ scroll: el.scrollWidth, client: el.clientWidth })),
        };
        await captureEvidence(page, 'E02_dash_delete_375_long.png', { caption: `dialog ${String(Math.round(layout.dialog?.width ?? 0))} px wide (frame ${String(frame)}); sentence scroll ${String(layout.bodyLine.scroll)} / client ${String(layout.bodyLine.client)}` });
        await attachJson('E02_dash_delete_375_long.json', layout);
        const box = layout.dialog;
        expect(box !== null && box.x >= 15 && box.x + box.width <= COMPACT.width - 15, 'dialog inside the 16 px gutters').toBe(true);
        expect(layout.page.scroll, 'no page-level sideways scroll').toBeLessThanOrEqual(layout.page.client);
        // Finding candidate (UI/Low) when this fails: the unbroken name overflows the sentence box inside the dialog.
        expect.soft(layout.bodyLine.scroll, 'the delete sentence wraps the long name inside the dialog').toBeLessThanOrEqual(layout.bodyLine.client + 1);
        await dialog.getByRole('button', { name: KEEP, exact: true }).click();
        await expect(dialog).toHaveCount(0);
        expect(countApi(admin.api, 'DELETE', `${PROJECTS_API}/${project.id}`)).toBe(0);
      },
      COMPACT,
    );
  });

  test('E02 · SCR-05 no-match empty state: the description is set with `text-wrap: pretty` (BUG-170)', async ({ browser }) => {
    await withAdmin(browser, async (admin) => {
      const { page } = admin;
      await createProject(admin, 'nomatch'); // own row, so the list (and its search box) shows whatever else the account holds
      await reloadDashboard(page);
      await searchBox(page).fill(`${TEST_DATA_PREFIX}khong-khop-${Date.now().toString(36)}`);
      await expect(noMatch(page)).toBeVisible(); // PD:261-266 EmptyState
      const description = page.getByText(NO_MATCH_DESCRIPTION, { exact: true });
      await expect(description).toBeVisible();
      // ES:50-51 `text-pretty` (Tailwind 3.4.6 → `text-wrap: pretty`); Chromium reports it on `text-wrap` or, split, on `text-wrap-style`.
      const wrap = await description.evaluate((el) => {
        const cs = getComputedStyle(el);
        return { textWrap: cs.getPropertyValue('text-wrap'), textWrapStyle: cs.getPropertyValue('text-wrap-style'), className: el.className };
      });
      await captureEvidence(page, 'E02_dash_nomatch_pretty.png', { caption: `no-match description: text-wrap "${wrap.textWrap}" / style "${wrap.textWrapStyle}"` });
      await attachJson('E02_dash_nomatch_pretty.json', wrap);
      expect(`${wrap.textWrap} ${wrap.textWrapStyle}`).toContain('pretty');
      await page.getByRole('button', { name: CLEAR_FILTERS, exact: true }).click();
      await expect(noMatch(page)).toHaveCount(0);
    });
  });

  test('E02 · SCR-05 [mocked response] N1 fails (500, unpairable: 5xx): the error card says the new "unknown" sentence, not the old "tải lại" one', async ({ browser }) => {
    await withAdmin(browser, async (admin) => {
      const { page } = admin;
      await routeSummaries(page, (route) => route.fulfill({ status: 500, contentType: 'application/json', body: '{}' }));
      await page.reload({ waitUntil: 'commit' });
      await expect(page.getByText(LIST_ERROR_TITLE, { exact: true })).toBeVisible({ timeout: SLOW_STATE_MS }); // PD:240-246
      // UPD:371 describeError(toAppError(error)).description; a bare 500 is kind "unknown" (toAppError.ts:10-18, :211).
      await expect(page.getByText(UNKNOWN_ERROR_DESCRIPTION, { exact: true })).toBeVisible();
      await expect(page.getByText(OLD_UNKNOWN_TAIL, { exact: false })).toHaveCount(0);
      await captureEvidence(page, 'E02_dash_error_unknown_copy.png', { caption: 'N1 500 [mocked] → errors.unknown.description (vi.json:63)' });
      await page.unrouteAll({ behavior: 'ignoreErrors' });
      const reread = waitForApi(page, 'GET', SUMMARIES_RE, [200]);
      await page.getByRole('button', { name: RETRY, exact: true }).click();
      await reread;
      await expect(page.getByText(LIST_ERROR_TITLE, { exact: true })).toHaveCount(0);
    });
  });

  test('E02 · SCR-06 375 px sheet snap dots by keyboard: each "Mức N" is described, focus shows its tooltip inside the screen, Enter on "Mức 1" drops to the 88 px peek', async ({ browser }) => {
    await withAdmin(
      browser,
      async (admin) => {
        const { page } = admin;
        await page.goto(ROUTES.notifications);
        const sheet = notificationDrawer(page);
        await expect(sheet).toBeVisible();
        const group = sheet.getByRole('group', { name: SHEET_GROUP, exact: true }); // DRW:251
        const dot = (level: 1 | 2 | 3): Locator => group.getByRole('button', { name: snapButton(level), exact: true });
        // Same rest wait as the compact test above (BUG-137): the spring slide is JS, not stopped by `animations: 'disabled'`.
        const restingTop = COMPACT.height - Math.round(COMPACT.height * 0.9);
        await expect
          .poll(async () => {
            const before = await sheet.evaluate((el) => el.getBoundingClientRect().top);
            await page.waitForTimeout(150);
            const after = await sheet.evaluate((el) => el.getBoundingClientRect().top);
            return Math.abs(after - before) < 0.5 && Math.abs(after - restingTop) <= 2;
          })
          .toBe(true);
        for (const level of [1, 2, 3] as const) {
          await expect(dot(level)).toHaveAccessibleDescription(SNAP_HINTS[level]); // DRW:253-271 sr-only hint via aria-describedby
        }

        await dot(1).focus();
        const tip = page.getByRole('tooltip').filter({ hasText: SNAP_HINTS[1] });
        await expect(tip).toBeVisible(); // TT:14 400 ms dwell, TT:195 onFocus
        const shown = { tip: await tip.boundingBox(), dot: await dot(1).boundingBox() };
        expect(shown.tip !== null && shown.tip.x >= 0 && shown.tip.x + shown.tip.width <= COMPACT.width && shown.tip.y >= 0, 'tooltip inside the screen (TT:91-110)').toBe(true);
        await captureEvidence(page, 'E02_notif_snap_tooltip.png', { caption: `focus on "Mức 1" → tooltip "${SNAP_HINTS[1]}"` });

        await page.keyboard.press('Enter'); // SR:552-557 a lone key keeps its native action (BUG-151)
        await expect(dot(1)).toHaveAttribute('aria-pressed', 'true');
        await expect.poll(async () => Math.abs((await sheet.evaluate((el) => el.getBoundingClientRect().height)) - SNAP_PEEK_PX)).toBeLessThanOrEqual(2);
        const after = { tipVisible: await tip.isVisible(), tip: await tip.boundingBox(), dot: await dot(1).boundingBox() };
        await captureEvidence(page, 'E02_notif_snap_peek.png', { caption: `Enter on "Mức 1" → ${String(SNAP_PEEK_PX)} px peek; tooltip ${after.tipVisible ? 'still shown' : 'gone'}` });
        await attachJson('E02_notif_snap_keyboard.json', { viewport: COMPACT, shown, after });
        // Finding candidate (UI/Low): TT measures its anchor only when it shows (TT:66-77); a tooltip still shown after
        // the sheet dropped stays where the dot used to be.
        if (after.tipVisible && after.tip !== null && after.dot !== null) {
          expect.soft(Math.abs(after.tip.y + after.tip.height - after.dot.y), 'a shown tooltip follows its dot after the snap').toBeLessThanOrEqual(24);
        }
        await page.keyboard.press('Escape');
        await expect.poll(() => pathname(page)).toBe(ROUTES.dashboard);
      },
      COMPACT,
    );
  });

  test('E02 · SCR-05 → /pipeline at 375 px: the breadcrumb names the project from the N1 cache, cut with "…" at 140 px, full name in `title` (BUG-165)', async ({ browser }) => {
    await withAdmin(
      browser,
      async (admin) => {
        const { page } = admin;
        const project = await createProject(admin, 'crumbpl', unbroken80('cp'));
        const list = await reloadDashboard(page);
        // BE apps/api/projects/summaries.py:189: no floor / no upload → "processing" → UPD routes to /pipeline.
        expect(openPathOf(summaryOf(list, project.id))).toBe(ROUTES.project.pipeline(project.id));
        await projectCard(page, project.name).click();
        await expect.poll(() => pathname(page)).toBe(ROUTES.project.pipeline(project.id));
        // CPN:21-27 reads `project.summaries()` (written by the dashboard, UPD:276-279); ProcessingScreen.tsx:226-229 draws it.
        const crumb = page.getByRole('navigation', { name: PIPELINE_NAV, exact: true }).locator(`span[title="${project.name}"]`);
        await expect(crumb).toBeVisible();
        await expect(crumb).toHaveText(project.name);
        const metrics = await crumbMetrics(crumb);
        await captureEvidence(page, 'E02_dash_crumb_pipeline_375.png', { caption: `/pipeline crumb ${String(Math.round(metrics.width))} px, text-overflow ${metrics.textOverflow}` });
        expect(metrics.width).toBeLessThanOrEqual(CRUMB_MAX_PX + 0.5);
        expect(metrics.scroll, 'the name is cut, not wrapped').toBeGreaterThan(metrics.client);
        expect(metrics.textOverflow).toBe('ellipsis');

        // Deep link (reload, no cache). CPN:14-19: the level is skipped unless something else cached #24 — recorded only.
        await page.reload();
        await expect(page.getByRole('navigation', { name: PIPELINE_NAV, exact: true })).toBeVisible();
        const crumbAfterReload = await page.locator(`nav span[title="${project.name}"]`).count();
        await attachJson('E02_dash_crumb_pipeline_375.json', { viewport: COMPACT, landed: pathname(page), metrics, crumbAfterReload });
      },
      COMPACT,
    );
  });

  test('E02 · SCR-07 "Tải bản vẽ" → /upload at 375 px: the "Đường dẫn trang" breadcrumb names the project from the N1 cache, cut at 140 px with the full name in `title` (BUG-165)', async ({ browser }) => {
    await withAdmin(
      browser,
      async (admin) => {
        const { page } = admin;
        const project = await createProject(admin, 'crumbup', unbroken80('cu'));
        await clearSeenFlags(page);
        const { json } = await navigateAndWaitForApi(page, () => page.goto(ROUTES.onboarding, { waitUntil: 'commit' }), 'GET', SUMMARIES_RE, [200]);
        expect(gatewayOrder(summariesOf(json))[0]?.id, 'the fixture is the newest project').toBe(project.id); // UWS:222-228
        await page.getByRole('button', { name: ONBOARD.step2Action, exact: true }).click(); // UWS:325-328
        await expect.poll(() => pathname(page)).toBe(ROUTES.project.upload(project.id));
        // useFloorUploadScreen.ts:1171-1175 → FloorUploadScreen.tsx:194-203 → BC:125-134 (a middle level without onClick).
        const nav = page.getByRole('navigation', { name: BREADCRUMB_NAV, exact: true }).filter({ has: page.locator(`span[title="${project.name}"]`) });
        const crumb = nav.locator(`span[title="${project.name}"]`);
        await expect(crumb).toBeVisible();
        await expect(crumb).toHaveText(project.name);
        const metrics = await crumbMetrics(crumb);
        const listHeight = await nav.locator('ol').evaluate((el) => el.getBoundingClientRect().height);
        await captureEvidence(page, 'E02_onboard_crumb_upload_375.png', { caption: `/upload crumb ${String(Math.round(metrics.width))} px, breadcrumb ${String(Math.round(listHeight))} px high` });
        await attachJson('E02_onboard_crumb_upload_375.json', { viewport: COMPACT, landed: pathname(page), metrics, listHeight });
        expect(metrics.width).toBeLessThanOrEqual(CRUMB_MAX_PX + 0.5); // BC:130 max-w-[140px] below sm
        expect(metrics.scroll, 'the name is cut, not wrapped').toBeGreaterThan(metrics.client);
        expect(metrics.textOverflow).toBe('ellipsis'); // BC:130 truncate
        expect(metrics.lineHeight, 'BC:128-130 an 18 px line, not leading-none').toBe('18px');
        // One line: the tallest level is the 44 px "Dự án" button below 640 px (BC:142).
        expect(listHeight, 'the breadcrumb stays on one line').toBeLessThanOrEqual(44 + 1);
      },
      COMPACT,
    );
  });
});
