/**
 * Phase 8 — EDGE CASES, Track A: SCR-34 Model Library, SCR-35 Training Jobs, SCR-36 Model Registry, SCR-37 User
 * Management. Gaps left by `phase08_admin.spec.ts` (serial, one admin page); inventory in `qa/coverage/phase08.md`
 * (FE stamp ccd645a5).
 *
 * Every expected result cites the FE source of `F:/App/AppFront` @ ccd645a5 or, written `BE:`, AppBack @ 2ee030c5.
 * Short names (under `src/screens/admin/` unless a path is given):
 *   MLC ModelLibrary/ModelLibrary.container.tsx  ML  ModelLibrary/ModelLibrary.tsx   MLT ModelLibrary/ModelLibraryToolbar.tsx
 *   MLB ModelLibrary/ModelLibraryTable.tsx       MLD ModelLibrary/ModelLibraryDetail.tsx  MLS ModelLibrary/ModelLibrarySummary.tsx
 *   UML ModelLibrary/useModelLibrary.ts          MLG ModelLibrary/modelLibraryGateway.ts
 *   TJ  TrainingJobs/TrainingJobs.tsx            TJF TrainingJobs/TrainingJobForm.tsx    TJT TrainingJobs/TrainingJobsTable.tsx
 *   TDT TrainingJobs/TrainingDatasetsTab.tsx     UTJ TrainingJobs/useTrainingJobs.ts     TJG TrainingJobs/trainingJobsGateway.ts
 *   MR  ModelRegistry/ModelRegistry.tsx          MRA ModelRegistry/ModelRegistryActivateDialog.tsx
 *   MRV ModelRegistry/ModelRegistryVersionTable.tsx  MRD ModelRegistry/ModelRegistryDetail.tsx  UMR ModelRegistry/useModelRegistry.ts
 *   MRE ModelRegistry/modelRegistryErrors.ts
 *   UM  UserManagement/UserManagement.tsx        UMT UserManagement/UserManagementToolbar.tsx  UMB UserManagement/UserManagementTable.tsx
 *   UMD UserManagement/UserManagementDetail.tsx  UUM UserManagement/useUserManagement.ts   UMG UserManagement/userManagementGateway.ts
 *   PERM src/lib/auth/permissions.ts   NB src/lib/mutations/notificationBus.ts   UNF src/hooks/useNumericField.ts
 *   SR   src/lib/input/shortcutRegistry.ts   FT src/lib/input/focusTrap.ts   TAB src/components/ui/Tabs.tsx
 *   SEG  src/components/ui/SegmentedControl.tsx   I18N src/i18n/vi.json
 *
 * ## Accounts (real, no mock) — the admin is never changed
 * - Admin: every test opens its own browser context and signs the admin in through the API INSIDE that context
 *   (`POST /api/auth/login` 204 → refresh cookie in the context jar), so the password never goes through a UI field or
 *   a trace. The admin's role/status/profile are never written.
 * - ONE `engineer` invitee per worker, made lazily: the admin invites a run-unique `qa-<runId>-e08eng-…@example.test`
 *   (`POST /api/users/invitations`, BE:apps/api/users/router.py:55), the one-time token is read from the real mail in
 *   Mailpit, the invitee accepts it (`POST /api/auth/invitations/accept`) with a random password kept in worker memory
 *   only. Used (a) to sign in as a real engineer (forbidden / read-only states) and (b) as the row the admin edits
 *   (role, disable/enable, detail). `ensureEngineer()` puts it back to role `engineer` + status `active` (API) at the
 *   start of every test that relies on it and in the `finally` of every test that edits it. `afterAll` deletes it
 *   (`DELETE /api/users/{id}` with `{userId, confirmEmail}`) and every mail to its address.
 * - Two more throw-away addresses per run: one invited through the UI ("Gửi lời mời", mail caught by Mailpit) and one
 *   invited through the API as the target of the UI delete. Both are deleted in `finally`.
 *
 * ## Non-serial, independent
 * Each test: own context, own sign-in, own preconditions (`ensureEngineer()`, own invitee), own cleanup in `finally`.
 * Global registry state (SCR-36) is never written: the activation dialog is only opened and cancelled, and a route
 * guard ABORTS any `PUT …/model-families/*\/active` the page might still send (none is expected; the count is asserted 0).
 * The same guard style keeps "Bắt đầu huấn luyện" (opt-in, ML compute) from ever reaching the server.
 *
 * ## Mocks — "[mocked response]" in the title (4 of 32, 12.5 %; rules.maxMockedShare 0.35)
 * - `GET /api/library` 500, `GET /api/admin/ml/training-jobs` 500, `GET /api/admin/ml/model-families` 500,
 *   `GET /api/users` 500 — unpairable: a 5xx is not producible on the shared stack (rows for `coverage/phase08-be.md`).
 *
 * ## Real-backend budget per run (BE defaults; `qa-limits.override.yml` raises LOGIN_IP_LIMIT to 120 / 60 s and
 *    RECOVERY_IP_LIMIT to 60 / 900 s)
 * - `POST /api/auth/login` per IP: admin 1 per test (27 UI tests that need the admin) + 1 admin API per worker +
 *   engineer 4 = ~32 per run, spread over minutes; 0 failed logins (no lockout path for any account).
 * - `POST /api/users/invitations` `users_invite` 30 / 3600 s per admin (BE:apps/api/users/router.py:32-43, shared with
 *   `/resend`): 3 per run (engineer + UI invite + delete target), +1 per failed test (Playwright restarts the worker and
 *   the engineer is re-made). Phases 1 (8) + 2 (≤ 9) + 7 (≤ 6) + this file (≤ 5) stay under 30.
 * - `recovery_ip` counts the one accept per worker.
 * - `PATCH /api/users/{id}/role`, `POST …/disable|enable`, `DELETE /api/users/{id}`: no `rate_limit(` on them
 *   (BE:apps/api/users/router.py:85-121): ≤ 2 + ≤ 2 + 3 per run, + `ensureEngineer()` fixes when needed.
 * - `POST /api/auth/refresh` 300 / 60 s per session: 1 per page load.
 * - `/api/admin/ml/*` and `/api/library*`: reads only, no rate limit.
 */
import { randomUUID } from 'node:crypto';

import { expect, request, test } from '@playwright/test';
import type { APIRequestContext, APIResponse, Browser, BrowserContext, Locator, Page, Request, Route } from '@playwright/test';

import { ROUTES, loginUrl, pathOf } from '../../e2e/fixtures/routes';
import { navigateThenWaitForApi, waitForApi, waitForApiWhere, type ApiResult } from '../../e2e/fullstack/apiWatch';
import { readBaseUrl } from '../../e2e/fullstack/env';
import { apiBaseUrl } from './support/api';
import { dashboardLoaded, readAdminCredentials } from './support/auth';
import { TEST_DATA_PREFIX, attachJson, captureEvidence, testEmail } from './support/evidence';
import { linkFrom, waitForMail } from './support/mailpit';
import { typeHeight } from './support/numeric-field';

/* ---------------------------------------------------------------- constants (each cites its source) */

const DESKTOP = { width: 1440, height: 900 } as const;
/** MLC:58 NARROW_QUERY `(width < 1024px)`: below it the table becomes cards. */
const NARROW = { width: 800, height: 900 } as const;
type Viewport = { readonly width: number; readonly height: number };

const REFRESH_API = '/api/auth/refresh';
const INVITE_SUBJECT = 'Lời mời tham gia AppFront'; // BE:auth_recovery/messages.py (phase07_account_edge INVITE_SUBJECT)
const MAILPIT_URL = (process.env.E2E_MAILPIT_URL ?? 'http://localhost:8025').replace(/\/+$/u, '');
/** Admin access token lives 600 s (BE:auth/settings.py:31) — refreshed well before. */
const ADMIN_TOKEN_MAX_AGE_MS = 480_000;
/** A "nothing was sent" claim waits this long after the last action. */
const QUIET_MS = 2_500;
/** react-query may retry a failed read before the error state paints (src/lib/query/cachePolicy.ts:79). */
const ERROR_PAINT_TIMEOUT_MS = 30_000;
/** NB:8 DEFAULT_GROUP_WINDOW_MS — same-type toasts inside it merge into "Hoàn tác N thay đổi"; waited out on purpose. */
const TOAST_GROUP_WINDOW_MS = 5_000;
const GENERIC_UNKNOWN = 'Hệ thống đã ghi nhận và sẽ kiểm tra. Hãy thử lại sau ít phút.'; // I18N:61-64 errors.unknown.description

/* Endpoints (src/api/endpoints.ts:1-12,65-77,131-133,319-329). */
const LIBRARY_LIST = '/api/library';
const JOBS = '/api/admin/ml/training-jobs';
const DATASETS = '/api/admin/ml/datasets';
const FAMILIES = '/api/admin/ml/model-families';
const VERSIONS = '/api/admin/ml/model-versions';
const USERS = '/api/users';
const INVITATIONS = '/api/users/invitations';
const ACTIVE_PUT = /^\/api\/admin\/ml\/model-families\/[^/]+\/active$/u;

/* SCR-34 Model Library. */
const LIB = {
  search: 'tìm model', // MLT:17
  category: 'danh mục', // MLT:19
  viewMode: 'Chế độ xem', // MLT:20
  table: 'Bảng', // MLT:22-25
  grid: 'Lưới',
  gridList: 'lưới mẫu 3D', // MLB:33
  noMatch: 'Không tìm thấy mẫu 3D phù hợp.', // MLB:31
  emptyTitle: 'Chưa có mẫu 3D nào', // ML:39
  errorTitle: 'Không tải được thư viện mẫu 3D', // ML:41
  readOnly: 'Vai trò của bạn chỉ xem được thư viện, nên mọi hành động sửa danh mục không hiện', // UML:102-103
  totalCount: 'Tổng số mẫu 3D', // MLS:12
  heavyCount: 'model nặng', // MLS:14
  detail: 'Chi tiết model', // MLD:293
  closeDetail: 'Đóng panel chi tiết mẫu 3D', // MLD:306
  preview: 'Xem trước mô hình', // MLD:103
  triangles: 'Số tam giác', // MLD:173, MLB:29
  metadata: 'Siêu dữ liệu model', // MLD:215
  declared: 'Máy chủ khai', // MLD:176
  autoSpinNote: 'Khung xem trước không tự quay; kéo chuột trong khung để xoay model', // UML:104, MLG:101 canAutoSpin false
  fields: ['Kích thước bao', 'Số tam giác', 'dung lượng', 'nhóm'], // UML:106-109,282-288
  name: 'Tên', // MLB:26
} as const;

/* SCR-35 Training Jobs. */
const TRAIN = {
  title: 'Theo dõi huấn luyện', // TJ:30
  crumbHere: 'Huấn luyện', // TJ:29
  tabs: 'Phần của trang huấn luyện', // TJ:31
  tabJobs: 'Lượt huấn luyện', // TJ:32
  tabDatasets: 'Bộ dữ liệu', // TJ:33
  familyFilter: 'Lọc theo họ', // TJ:34
  create: 'Tạo lượt huấn luyện', // TJ:36
  forbiddenTitle: 'Không có quyền truy cập', // TJ:37
  forbiddenBody: 'Chỉ quản trị viên hệ thống xem được trang huấn luyện.', // TJ:38
  related: 'Model AI của chuỗi xử lý', // UTJ:151,161
  emptyTitle: 'Chưa có lượt huấn luyện', // TJT:20
  emptyFiltered: 'Không có lượt nào khớp bộ lọc.', // UTJ:147
  errorTitle: 'Không đọc được dữ liệu huấn luyện', // TJT:19
  readFallback: 'Không đọc được dữ liệu huấn luyện.', // TJG:134
  retry: 'Thử lại', // TJT:18
  dsFamily: 'Loại mô hình', // TDT:19
  dsList: 'Danh sách bộ dữ liệu', // TDT:20
  dsVersions: 'Phiên bản', // TDT:21
  dsNote: 'Trang này chỉ xem; bộ dữ liệu dựng bằng công cụ dòng lệnh.', // TDT:22
  dsEmptyTitle: 'Chưa có bộ dữ liệu', // TDT:25
  dsEmpty: 'Chưa có bộ dữ liệu nào. Dựng bằng công cụ dòng lệnh.', // UTJ:148
  formFamily: 'Loại mô hình', // TJF:20
  formDataset: 'Bộ dữ liệu', // TJF:21
  formBaseModel: 'Model nền', // TJF:23
  epochs: 'Số vòng', // TJF:24
  close: 'Đóng', // TJF:25
  submit: 'Bắt đầu huấn luyện', // TJF:26
  epochsDefault: '50', // UTJ:95 DEFAULT_TRAINING_EPOCHS
  epochsInvalid: 'Số vòng phải từ 1 đến 300.', // TJG:127, UTJ:646-650,765
  belowMin: 'Giá trị không nhỏ hơn 1.', // UNF:71 (min = UTJ:96 TRAINING_EPOCHS_MIN)
  aboveMax: 'Giá trị không quá 300.', // UNF:72 (max = UTJ:97 TRAINING_EPOCHS_MAX)
} as const;
/** UTJ:109-113 FAMILY_LABELS (also the order of DATASET_FAMILY_OPTIONS, UTJ:185-187). */
const ML_FAMILY_LABEL = {
  wallSegmentation: 'Tách lớp tường',
  openingAndFurnitureDetection: 'Nhận diện cửa và đồ đạc',
  dimensionReading: 'Đọc kích thước',
} as const;
type MlFamily = keyof typeof ML_FAMILY_LABEL;
/** UMR:62-66 MODEL_FAMILY_ORDER. */
const FAMILY_ORDER: readonly MlFamily[] = ['wallSegmentation', 'openingAndFurnitureDetection', 'dimensionReading'];
/** UMR:78-82 FAMILY_NAMES (lower case, used inside sentences). */
const FAMILY_NAME: Readonly<Record<MlFamily, string>> = {
  wallSegmentation: 'tách lớp tường',
  openingAndFurnitureDetection: 'nhận diện cửa và đồ đạc',
  dimensionReading: 'đọc kích thước',
};

/* SCR-36 Model Registry. */
const REG = {
  title: 'Chọn mô hình AI đang dùng', // MR:29
  crumbHere: 'Mô hình AI', // MR:28
  picker: 'Loại mô hình', // MR:30
  active: 'Đang dùng', // MR:31, MRV:18
  revert: 'Tắt AI, dùng thuật toán cũ', // MR:32
  errorTitle: 'Không đọc được danh sách model', // MR:35
  readFallback: 'Không đọc được danh sách model.', // MRE:20
  retry: 'Thử lại', // MR:34
  emptyTitle: 'Chưa có phiên bản', // MR:37
  forbiddenTitle: 'Không có quyền truy cập', // MR:38
  forbiddenBody: 'Chỉ quản trị viên hệ thống xem được model AI.', // MR:39
  detailPanel: 'Chi tiết phiên bản', // MR:40
  placeholder: 'Chọn một phiên bản để xem chi tiết.', // MRD:13
  related: 'Lượt huấn luyện', // UMR:94 TRAINING_JOBS_LINK
  activate: 'Kích hoạt', // MRV:17
  cancel: 'Huỷ', // MRA:14
  classic: 'Đường cổ điển', // UMR:100
  noActive: 'Chưa kích hoạt bản nào', // UMR:101
  blockedNotEvaluated: 'Chỉ kích hoạt được bản đã đánh giá.', // UMR:111
  blockedFormat: 'Chỉ kích hoạt được bản định dạng onnx.', // UMR:112
  emptyBase: 'Họ này chưa có phiên bản nào. Tải trọng số bằng công cụ dòng lệnh, hoặc chờ một lượt huấn luyện xong.', // UMR:125
  emptyClassic: 'Đang dùng đường cổ điển.', // UMR:126
  dialogBody: 'Lượt xử lý mới dùng bản này ngay; lượt đang chạy giữ model đã ghim.', // UMR:127
  dialogWarning: 'Bản đang dùng chưa đánh giá xong nên sau khi đổi sẽ chưa kích hoạt lại được.', // UMR:129
  fields: ['Mã', 'Mã băm', 'Định dạng', 'Số đo', 'Người tạo', 'Ngày tạo'], // UMR:113-120,276-292
  partialTail: 'phiên bản đang chờ hoặc đang đánh giá; chỉ kích hoạt được bản đã đánh giá.', // UMR:178-180
} as const;
/** UMR:102-107 evaluation labels. */
const EVALUATION_LABEL: Readonly<Record<string, string>> = {
  pending: 'Chờ đánh giá',
  running: 'Đang đánh giá',
  completed: 'Đã đánh giá',
  failed: 'Đánh giá không thành công',
};
/** UMR:96,158 — the seed label reads lower case inside a sentence. */
const inSentence = (label: string): string => (label === 'Gốc' ? 'gốc' : label);
const activateTitle = (label: string, family: MlFamily): string => `Kích hoạt ${inSentence(label)} cho ${FAMILY_NAME[family]}?`; // UMR:160-162

/* SCR-37 User Management. */
const USR = {
  search: 'Tìm người dùng', // UMT:26
  role: 'Vai', // UMT:28
  status: 'Trạng thái', // UMT:29
  all: 'Tất cả', // UMT:30
  invite: 'Mời người dùng', // UMT:31
  inviteRole: 'Vai cho lời mời', // UMT:32
  inviteEmails: 'Email người được mời', // UMT:33
  inviteSubmit: 'Gửi lời mời', // UMT:35
  inviteCancel: 'Huỷ', // UMT:36
  validSuffix: 'địa chỉ hợp lệ', // UMT:37
  summaryUsers: 'Người dùng', // UMT:39
  summaryAdmins: 'Quản trị', // UMT:40
  summaryPending: 'Lời mời đang chờ', // UMT:41
  matrixButton: 'Xem ma trận quyền', // UM:50
  matrixTitle: 'Ma trận quyền theo vai trò', // UM:51-52
  errorTitle: 'Không tải được danh sách người dùng', // UM:55
  retry: 'Thử lại', // UM:57
  noMatchTitle: 'Không tìm thấy người dùng', // UMB:39
  noMatchBody: 'Không ai khớp với từ khoá hoặc bộ lọc đang chọn.', // UMB:40
  clearSearch: 'Xoá tìm kiếm và bộ lọc', // UMB:42
  disable: 'Vô hiệu hoá', // UMB:45
  enable: 'Bật lại', // UMB:46
  remove: 'Xoá', // UMB:47
  projectsHeader: 'Số dự án', // UMB:35
  detail: 'Chi tiết người dùng', // UMD:370
  closeDetail: 'Đóng chi tiết người dùng', // UMD:106
  memberships: 'Dự án tham gia', // UMD:135
  noMemberships: 'Người này chưa tham gia dự án nào', // UMD:139
  activity: 'Hoạt động gần đây', // UMD:198
  noActivity: 'Chưa có hoạt động nào', // UMD:202
  removeSection: 'Xoá người dùng', // UMD:231
  removeSectionText: 'Xoá hẳn người dùng này khỏi hệ thống.', // UMD:234
  removeEmailLabel: 'Địa chỉ thư', // UMD:264
  removeLater: 'Để sau', // UMD:275
  removeConfirm: 'Xác nhận xoá vĩnh viễn', // UMD:282
  removeWarning:
    'Xoá hẳn gỡ luôn phần ghi công của người này trong lịch sử và không hoàn tác được; gõ đúng địa chỉ thư của họ để xác nhận', // UUM:150-151
  backLabel: 'Về bảng điều khiển', // UUM:135
  lastAdmin: 'Đây là quản trị cuối cùng, hệ thống cần ít nhất một người giữ vai này', // UUM:139
  forbidden:
    'Vai của bạn chưa quản lý được người dùng nên danh sách tài khoản không hiện; bảng dưới đây cho biết mỗi vai làm được những việc gì', // UUM:140-141
  inviteHint: 'Ngăn cách nhiều địa chỉ bằng dấu phẩy hoặc xuống dòng', // UUM:144
  inviteNeedsEmail: 'Nhập ít nhất một địa chỉ thư để gửi lời mời', // UUM:147
  inviteFixInvalid: 'Sửa địa chỉ chưa đúng dạng rồi mới gửi được', // UUM:148
  invalidLine: (bad: string): string => `Chưa đúng dạng địa chỉ thư: ${bad}. Viết theo dạng ten@congty.vn`, // UUM:145-146,222-225
  roleChanged: 'Đã đổi vai', // UUM:153
  noLoss: 'Kỹ sư — Vai mới giữ nguyên mọi việc họ đang làm được', // UUM:154,818
  disabledTitle: 'Đã vô hiệu hoá tài khoản', // UUM:157
  enabledTitle: 'Đã bật lại tài khoản', // UUM:158
  invitedTitle: 'Đã gửi lời mời', // UUM:160
  removedTitle: 'Đã xoá tài khoản', // UUM:162
  membershipBlocked: 'Vai trong từng dự án theo vai của hệ thống; hệ thống chưa có đường đổi riêng cho một dự án', // UMG:350-351
} as const;
/** UMG:129-138 ROLE_LABELS / STATUS_LABELS. */
const ROLE_LABEL = { admin: 'Quản trị', engineer: 'Kỹ sư', viewer: 'Người xem' } as const;
const STATUS_LABEL = { active: 'Đang hoạt động', pending: 'Chờ chấp nhận', disabled: 'Đã vô hiệu hoá' } as const;
/** UMG:171-179 PERMISSION_MATRIX_ROWS × PERM:49-86 (admin / engineer / viewer). */
const MATRIX: ReadonlyArray<{ readonly label: string; readonly admin: boolean; readonly engineer: boolean; readonly viewer: boolean }> = [
  { label: 'Tải bản vẽ', admin: true, engineer: true, viewer: false },
  { label: 'Sửa hình học', admin: true, engineer: true, viewer: false },
  { label: 'Duyệt QC', admin: true, engineer: true, viewer: false },
  { label: 'Đổi bộ luật', admin: true, engineer: false, viewer: false },
  { label: 'Xuất', admin: true, engineer: true, viewer: false },
  { label: 'Chia sẻ', admin: true, engineer: true, viewer: false },
  { label: 'Quản lý người dùng', admin: true, engineer: false, viewer: false },
];
const lowerFirst = (text: string): string => text.charAt(0).toLowerCase() + text.slice(1);
/** UMG:192-194 permissionCellSrLabel. */
const cellSr = (role: keyof typeof ROLE_LABEL, row: string, allowed: boolean): string =>
  `${lowerFirst(ROLE_LABEL[role])}: ${allowed ? 'được phép' : 'không được phép'} ${lowerFirst(row)}`;
/** UMG:226-233 permissionsLostBetween('engineer', 'viewer') in matrix-row order. */
const ENGINEER_TO_VIEWER = `${ROLE_LABEL.viewer} — Vai mới không còn: ${MATRIX.filter((r) => r.engineer && !r.viewer)
  .map((r) => r.label)
  .join(', ')}`; // UUM:819

/* ---------------------------------------------------------------- small helpers */

type Json = Record<string, unknown>;

const asRecord = (value: unknown, what: string): Json => {
  if (typeof value !== 'object' || value === null || Array.isArray(value)) throw new Error(`${what}: not a JSON object`);
  return value as Json;
};
const asList = (value: unknown, what: string): Json[] => {
  if (!Array.isArray(value)) throw new Error(`${what}: not a JSON array`);
  return value.map((item, index) => asRecord(item, `${what}[${String(index)}]`));
};
const itemsOf = (value: unknown, what: string): Json[] => asList(asRecord(value, what).items, `${what}.items`);
const str = (record: Json, key: string): string => (typeof record[key] === 'string' ? (record[key] as string) : '');
const uniq = (): string => `${Date.now().toString(36)}${Math.random().toString(36).slice(2, 6)}`;
const escapeRegExp = (text: string): string => text.replace(/[.*+?^${}()|[\]\\]/gu, '\\$&');
const exactText = (text: string): RegExp => new RegExp(`^\\s*${escapeRegExp(text)}\\s*$`, 'u');
const pathnameOf = (url: string): string => new URL(url).pathname;

/** Next GET of `path` (exact pathname) answered 200 whose query passes `where`. Register BEFORE the action. */
function readOf(page: Page, path: string, where: (url: URL) => boolean = () => true): Promise<ApiResult> {
  return waitForApiWhere(
    page,
    (response) => {
      const url = new URL(response.url());
      return response.request().method() === 'GET' && url.pathname === path && response.status() === 200 && where(url);
    },
    undefined,
    `GET ${path}`,
  );
}

/** Every request from now on that passes `match` (method + path). */
function recordRequests(page: Page, match: (req: Request) => boolean): { readonly list: () => string[]; readonly stop: () => void } {
  const seen: string[] = [];
  const onRequest = (req: Request): void => {
    if (match(req)) seen.push(`${req.method()} ${pathOf(req.url())}`);
  };
  page.on('request', onRequest);
  return { list: () => [...seen], stop: () => page.off('request', onRequest) };
}

/**
 * Safety net for a write this file must never send for real (global registry state, ML compute): the request is
 * ABORTED and counted. Expected count is always 0 — it is a guard, not a mocked response.
 */
async function guardWrites(page: Page, method: string, path: RegExp): Promise<{ readonly count: () => number; readonly release: () => Promise<void> }> {
  let count = 0;
  const matcher = (url: URL): boolean => path.test(url.pathname);
  const handler = async (route: Route): Promise<void> => {
    if (route.request().method() !== method) return route.fallback();
    count += 1;
    return route.abort();
  };
  await page.route(matcher, handler);
  return { count: () => count, release: () => page.unroute(matcher, handler) };
}

/** Opens a custom `Select` (button role=combobox, portaled listbox) and picks one option. */
async function pickOption(page: Page, combobox: Locator, option: string): Promise<void> {
  await combobox.click();
  await page.getByRole('option', { name: option, exact: true }).click();
}

const toastWith = (page: Page, text: string): Locator => page.getByRole('status').filter({ hasText: text });
/** `<dl><div><dt>caption</dt><dd>value</dd></div>` (MLS:20-27, UMT:97-110). */
const figure = (scope: Locator, caption: string): Locator =>
  scope.locator('div').filter({ has: scope.page().locator('dt', { hasText: exactText(caption) }) }).locator('dd');

/* ---------------------------------------------------------------- admin API (setup / cleanup only) */

interface AdminApi {
  readonly ctx: APIRequestContext;
  token: string;
  tokenAt: number;
}

let adminPromise: Promise<AdminApi> | undefined;

/** Access token from a refresh body (src/lib/auth/refresh.ts:85-100: flat or under `data`). */
function accessTokenOf(json: unknown): string {
  const body = asRecord(json, 'refresh');
  const root = typeof body.data === 'object' && body.data !== null ? asRecord(body.data, 'refresh.data') : body;
  const token = typeof root.accessToken === 'string' ? root.accessToken : String(root.access_token ?? '');
  if (token === '') throw new Error('refresh: no access token');
  return token;
}

async function refreshAdmin(admin: AdminApi): Promise<void> {
  const res = await admin.ctx.post(REFRESH_API);
  expect(res.status(), 'admin POST /api/auth/refresh').toBe(200);
  admin.token = accessTokenOf(await res.json());
  admin.tokenAt = Date.now();
}

async function adminApi(): Promise<AdminApi> {
  adminPromise ??= (async () => {
    const base = apiBaseUrl();
    const ctx = await request.newContext({ baseURL: base, extraHTTPHeaders: { Origin: base } });
    const { email, password } = readAdminCredentials();
    const login = await ctx.post('/api/auth/login', { data: { email, password, rememberMe: false } });
    if (login.status() !== 204) {
      await ctx.dispose();
      throw new Error(`admin POST /api/auth/login → ${String(login.status())} (expected 204)`);
    }
    const admin: AdminApi = { ctx, token: '', tokenAt: 0 };
    await refreshAdmin(admin);
    return admin;
  })();
  const admin = await adminPromise;
  if (Date.now() - admin.tokenAt > ADMIN_TOKEN_MAX_AGE_MS) await refreshAdmin(admin);
  return admin;
}

async function asAdmin(method: 'GET' | 'POST' | 'PATCH' | 'DELETE', path: string, data?: unknown): Promise<APIResponse> {
  const admin = await adminApi();
  return admin.ctx.fetch(path, { method, headers: { Authorization: `Bearer ${admin.token}` }, ...(data === undefined ? {} : { data }) });
}

/** `GET /api/users` → `users` (BE:apps/api/users/schemas.py:35-39 AdminUserListOut). */
async function listUsersApi(): Promise<Json[]> {
  const res = await asAdmin('GET', USERS);
  expect(res.status(), 'setup: GET /api/users').toBe(200);
  return asList(asRecord(await res.json(), 'GET /api/users').users, 'users');
}

/** Invites `email` through the API; returns the pending user record (BE:apps/api/users/router.py:55-62 → 201 list). */
async function inviteApi(email: string, role: 'engineer' | 'viewer'): Promise<Json> {
  const sent = await asAdmin('POST', INVITATIONS, { emails: [email], role });
  expect(sent.status(), 'setup: POST /api/users/invitations').toBe(201);
  const user = asList(await sent.json(), 'invitations').find((u) => u.email === email);
  if (user === undefined) throw new Error('setup: the invitation response has no row for the invited address');
  return user;
}

/** Best-effort delete (BE:apps/api/users/router.py:111-121, body `{userId, confirmEmail}`); 404 = already gone. */
async function deleteUserApi(id: string, email: string): Promise<void> {
  const res = await asAdmin('DELETE', `${USERS}/${id}`, { userId: id, confirmEmail: email }).catch(() => null);
  if (res !== null && ![200, 404].includes(res.status())) {
    test.info().annotations.push({ type: 'cleanup', description: `DELETE /api/users/${id} → ${String(res.status())}` });
  }
}

async function sweepMails(address: string): Promise<void> {
  const query = encodeURIComponent(`to:"${address}"`);
  const found = (await (await fetch(`${MAILPIT_URL}/api/v1/search?query=${query}&limit=100`)).json()) as { messages?: Array<{ ID: string }> };
  const ids = (found.messages ?? []).map((m) => m.ID);
  if (ids.length === 0) return;
  await fetch(`${MAILPIT_URL}/api/v1/messages`, { method: 'DELETE', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ IDs: ids }) });
}

/* ---------------------------------------------------------------- the engineer (one per worker) */

interface Engineer {
  readonly id: string;
  readonly email: string;
  readonly name: string;
  /** Random, worker memory only, never logged or attached. */
  readonly password: string;
}

let engineerPromise: Promise<Engineer> | undefined;
let invitedEngineer: { readonly id: string; readonly email: string } | undefined;

async function makeEngineer(): Promise<Engineer> {
  const email = testEmail('e08eng');
  const since = new Date(Date.now() - 5_000);
  const user = await inviteApi(email, 'engineer');
  const id = str(user, 'id');
  invitedEngineer = { id, email };

  const mail = await waitForMail(email, since, 30_000, INVITE_SUBJECT);
  const token = new URLSearchParams(new URL(linkFrom(mail, '/login/invitation')).hash.slice(1)).get('token');
  if (!token) throw new Error('invitation mail: no #token');

  const name = `${TEST_DATA_PREFIX}e08eng-${uniq()}`;
  const password = `Qa-${randomUUID()}`;
  const base = apiBaseUrl();
  const anon = await request.newContext({ baseURL: base, extraHTTPHeaders: { Origin: base } });
  try {
    const accept = await anon.post('/api/auth/invitations/accept', { data: { token, fullName: name, password } });
    expect(accept.status(), 'setup: POST /api/auth/invitations/accept').toBe(204);
  } finally {
    await anon.dispose();
  }
  return { id, email, name, password };
}

/** The worker's engineer, back to role `engineer` + status `active` (API) whatever an earlier test left. */
async function ensureEngineer(): Promise<Engineer> {
  engineerPromise ??= makeEngineer();
  const user = await engineerPromise;
  const row = (await listUsersApi()).find((u) => u.id === user.id);
  if (row === undefined) throw new Error('setup: the engineer invitee is missing from GET /api/users');
  if (row.status === 'disabled') {
    const res = await asAdmin('POST', `${USERS}/${user.id}/enable`, {});
    expect(res.status(), 'setup: POST /api/users/{id}/enable').toBe(200);
  }
  if (row.role !== 'engineer') {
    const res = await asAdmin('PATCH', `${USERS}/${user.id}/role`, { role: 'engineer', userId: user.id });
    expect(res.status(), 'setup: PATCH /api/users/{id}/role').toBe(200);
  }
  return user;
}

/** `finally` form of {@link ensureEngineer}: never replaces the test's own failure. */
async function restoreEngineer(): Promise<void> {
  try {
    await ensureEngineer();
  } catch (error) {
    test.info().annotations.push({ type: 'cleanup', description: `engineer restore: ${String(error)}` });
  }
}

test.afterAll(async () => {
  if (invitedEngineer !== undefined) {
    await deleteUserApi(invitedEngineer.id, invitedEngineer.email);
    await sweepMails(invitedEngineer.email).catch(() => undefined);
  }
  if (adminPromise !== undefined) await (await adminPromise.catch(() => null))?.ctx.dispose();
});

/* ---------------------------------------------------------------- per-test browser sessions */

interface Session {
  readonly context: BrowserContext;
  readonly page: Page;
}

/** New context, `email`/`password` signed in through the API INSIDE it (refresh cookie in its jar), `body`, close. */
async function signedIn(
  browser: Browser,
  credentials: { readonly email: string; readonly password: string },
  body: (session: Session) => Promise<void>,
  viewport: Viewport = DESKTOP,
): Promise<void> {
  const context = await browser.newContext({ baseURL: readBaseUrl(), viewport });
  const page = await context.newPage();
  try {
    const login = await context.request.post('/api/auth/login', {
      headers: { Origin: apiBaseUrl() },
      data: { email: credentials.email, password: credentials.password, rememberMe: false },
    });
    expect(login.status(), 'POST /api/auth/login (in-context sign-in)').toBe(204);
    await body({ context, page });
  } finally {
    await context.close().catch(() => undefined);
  }
}

const asAdminUi = (browser: Browser, body: (session: Session) => Promise<void>, viewport: Viewport = DESKTOP): Promise<void> =>
  signedIn(browser, readAdminCredentials(), body, viewport);

/* ---------------------------------------------------------------- screen openers (fresh page each time) */

async function openLibrary(page: Page): Promise<Json[]> {
  const list = readOf(page, LIBRARY_LIST);
  await page.goto(ROUTES.adminModels);
  return asList((await list).json, 'GET /api/library'); // src/api/client.ts:1082 decodeList: a bare array
}

async function openTraining(page: Page): Promise<Json[]> {
  const list = readOf(page, JOBS, (url) => !url.searchParams.has('family') && !url.searchParams.has('status'));
  await page.goto(ROUTES.adminTrainingJobs);
  return itemsOf((await list).json, 'GET training-jobs');
}

async function openRegistry(page: Page): Promise<{ readonly families: Json[]; readonly walls: Json[] }> {
  const families = readOf(page, FAMILIES);
  // UMR:385 the screen opens on walls; UMR:404-410 its versions are read at once.
  const walls = readOf(page, VERSIONS, (url) => url.searchParams.get('family') === 'wallSegmentation');
  await page.goto(ROUTES.adminTrainingModels);
  return { families: itemsOf((await families).json, 'GET model-families'), walls: itemsOf((await walls).json, 'GET model-versions') };
}

async function openUsers(page: Page): Promise<Json[]> {
  const list = readOf(page, USERS);
  await page.goto(ROUTES.adminUsers);
  const users = asList(asRecord((await list).json, 'GET /api/users').users, 'users');
  await expect(page.getByLabel(USR.search, { exact: true })).toBeVisible();
  return users;
}

const libRows = (page: Page): Locator => page.locator('tbody tr');
const libSearch = (page: Page): Locator => page.getByLabel(LIB.search, { exact: true });
const viewRadio = (page: Page, name: string): Locator =>
  page.getByRole('radiogroup', { name: LIB.viewMode, exact: true }).getByRole('radio', { name, exact: true });

const userRow = (page: Page, email: string): Locator => page.locator('tbody tr').filter({ hasText: email });

const familyOf = (families: readonly Json[], family: MlFamily): Json => {
  const record = families.find((item) => item.family === family);
  if (record === undefined) throw new Error(`GET model-families: no family ${family}`);
  return record;
};
/** MRV:29-40 the version row: a table row holding the label button. */
const versionRow = (page: Page, label: string): Locator =>
  page.getByRole('row').filter({ has: page.getByRole('button', { name: label, exact: true }) }).first();
const activeCard = (page: Page): Locator => page.getByRole('region', { name: REG.active, exact: true }); // MR:90-95
const registryPicker = (page: Page): Locator => page.getByRole('radiogroup', { name: REG.picker, exact: true });

/** Selects `family` on the registry picker (click) and returns its first versions page. */
async function selectRegistryFamily(page: Page, family: MlFamily): Promise<Json[]> {
  const read = readOf(page, VERSIONS, (url) => url.searchParams.get('family') === family);
  await registryPicker(page).getByRole('radio', { name: ML_FAMILY_LABEL[family], exact: true }).click();
  return itemsOf((await read).json, `GET model-versions (${family})`);
}

/* ================================================================= anonymous gate */

test.describe('E08 anonymous', () => {
  test('E08 · SCR-34/35/36 anonymous → /login?next=<path> on every admin route, no /api/library or /api/admin read', async ({ browser }) => {
    // G1 (plan §0): SessionBootstrap sends an anonymous user to `/login?next=…`; the admin routes are inside the gated
    // group (src/routes/router.tsx:386-389). SCR-37 is proven by E01 (phase01_auth_edge "anonymous on the routes of …").
    const context = await browser.newContext({ baseURL: readBaseUrl(), viewport: DESKTOP });
    const page = await context.newPage();
    const reads = recordRequests(page, (req) => /^\/api\/(?:library|admin)\b/u.test(pathnameOf(req.url())));
    const landed: Record<string, string> = {};
    try {
      for (const path of [ROUTES.adminModels, ROUTES.adminTrainingJobs, ROUTES.adminTrainingModels]) {
        await page.goto(path);
        await expect.poll(() => pathOf(page.url()), { message: path }).toBe(loginUrl(path));
        landed[path] = pathOf(page.url());
      }
      await expect(page.getByRole('button', { name: 'Đăng nhập', exact: true })).toBeVisible();
      expect(reads.list(), 'no admin/library read without a session').toEqual([]);
      await captureEvidence(page, 'E08_anonymous_gate.png', { caption: Object.entries(landed).map(([from, to]) => `${from} → ${to}`) });
      await attachJson('E08_anonymous_gate.json', { landed, adminReads: reads.list() });
    } finally {
      reads.stop();
      await context.close();
    }
  });
});

/* ================================================================= SCR-34 Model Library */

test.describe('E08 SCR-34 Model Library', () => {
  test('E08 · SCR-34 search folds case, diacritics and outer spaces; a miss shows "Không tìm thấy mẫu 3D phù hợp." in table and grid, summary counts 0', async ({ browser }) => {
    await asAdminUi(browser, async ({ page }) => {
      const items = await openLibrary(page);
      test.skip(items.length === 0, 'environment: library is empty ("Chưa có mẫu 3D nào"), nothing to search');
      await expect(libSearch(page)).toBeVisible();

      // UML:216-221 matchesSearchText: foldForSearch (NFD, strip marks, lower case, đ→d) on BOTH sides, query trimmed.
      const name = (await libRows(page).first().locator('td').nth(1).innerText()).trim();
      const typed = `  ${name.normalize('NFD').replace(/\p{M}/gu, '').replace(/đ/gu, 'd').replace(/Đ/gu, 'D').toUpperCase()}  `;
      await libSearch(page).fill(typed);
      await expect(libRows(page).getByRole('button', { name, exact: true }).first()).toBeVisible();

      // A miss: Table.Empty "Không tìm thấy mẫu 3D phù hợp." (MLB:217-218); the summary is built from the FILTERED rows
      // (UML:397 buildSummary(rows)) → "Tổng số mẫu 3D" 0 and "mẫu 3D nặng" 0 (UML:262-278).
      const miss = `qa-e08-no-model-${uniq()}`;
      await libSearch(page).fill(miss);
      await expect(page.getByText(LIB.noMatch, { exact: true })).toBeVisible();
      await expect(page.getByTestId('model-library-total-count')).toHaveText('0');
      await expect(page.getByTestId('model-library-heavy-count')).toHaveText('0');
      await captureEvidence(page, 'E08_library_search_miss_table.png', { caption: `tìm model = "${miss}"` });

      // Same miss in "Lưới": a plain <p> instead of the grid list (MLB:145-147).
      await viewRadio(page, LIB.grid).click();
      await expect(page.getByText(LIB.noMatch, { exact: true })).toBeVisible();
      await expect(page.getByRole('list', { name: LIB.gridList })).toHaveCount(0);
      await captureEvidence(page, 'E08_library_search_miss_grid.png', { caption: `Lưới, tìm model = "${miss}"` });
      await attachJson('E08_library_search.json', { listed: items.length, folded: typed, foundName: name, miss });
    });
  });

  test('E08 · SCR-34 sort: "Tên" ascending by default; "Số tam giác" ascending then descending in numeric order; "Tên" back to none', async ({ browser }) => {
    await asAdminUi(browser, async ({ page }) => {
      const items = await openLibrary(page);
      test.skip(items.length === 0, 'environment: library is empty, nothing to sort');
      await expect(libSearch(page)).toBeVisible();

      const nameHead = page.getByRole('columnheader', { name: LIB.name, exact: true });
      const triHead = page.getByRole('columnheader', { name: LIB.triangles, exact: true });
      // UML:320-323 default sort { key: 'name', direction: 'asc' }; src/components/ui/Table.tsx:163 aria-sort.
      await expect(nameHead).toHaveAttribute('aria-sort', 'ascending');
      await expect(triHead).toHaveAttribute('aria-sort', 'none');

      // Names → triangleCount from the real list (only when names are unique; otherwise the digits of the cell).
      const byName = new Map<string, number>();
      const duplicate = items.some((item) => {
        const key = str(item, 'name');
        if (byName.has(key)) return true;
        byName.set(key, Number(item.triangleCount));
        return false;
      });
      const shownCounts = async (): Promise<number[]> => {
        if (!duplicate) {
          const names = await libRows(page).locator('td:nth-child(2)').allInnerTexts();
          return names.map((text) => byName.get(text.trim()) ?? Number.NaN);
        }
        const cells = await libRows(page).locator('td:nth-child(5)').allInnerTexts();
        return cells.map((text) => Number(text.replace(/\D/gu, '')));
      };
      const isOrdered = (values: number[], dir: 1 | -1): boolean => values.every((v, i) => i === 0 || dir * (v - (values[i - 1] ?? v)) >= 0);

      // UML:554-559 sortBy: a new key starts ascending, the same key flips; UML:232-249 compareRows numeric.
      await triHead.click();
      await expect(triHead).toHaveAttribute('aria-sort', 'ascending');
      await expect(nameHead).toHaveAttribute('aria-sort', 'none');
      const ascending = await shownCounts();
      expect(isOrdered(ascending, 1), `ascending triangle counts: ${ascending.join(',')}`).toBe(true);

      await triHead.click();
      await expect(triHead).toHaveAttribute('aria-sort', 'descending');
      const descending = await shownCounts();
      expect(isOrdered(descending, -1), `descending triangle counts: ${descending.join(',')}`).toBe(true);
      await captureEvidence(page, 'E08_library_sort_desc.png', { caption: `Số tam giác descending: ${descending.slice(0, 8).join(', ')}` });
      await attachJson('E08_library_sort.json', { ascending, descending, source: duplicate ? 'cell digits' : 'GET /api/library triangleCount' });
    });
  });

  test('E08 · SCR-34 keyboard: ArrowRight picks "Lưới", Enter on a focused card opens "Chi tiết model" (GET /api/library/:id); close button removes it', async ({ browser }) => {
    await asAdminUi(browser, async ({ page }) => {
      const items = await openLibrary(page);
      test.skip(items.length === 0, 'environment: library is empty, no card to open');
      await expect(libSearch(page)).toBeVisible();

      // SEG:128-139 ArrowRight moves the checked segment and the focus.
      await viewRadio(page, LIB.table).focus();
      await page.keyboard.press('ArrowRight');
      await expect(viewRadio(page, LIB.grid)).toHaveAttribute('aria-checked', 'true');
      const grid = page.getByRole('list', { name: LIB.gridList });
      await expect(grid).toBeVisible();

      // MLB:152-166 a card is role=listitem, tabIndex 0, Enter → openDetail; UML:344-354 detail read.
      const card = grid.getByRole('listitem').first();
      const name = (await card.getAttribute('aria-label')) ?? '';
      const detailRead = waitForApiWhere(
        page,
        (response) => response.request().method() === 'GET' && pathnameOf(response.url()).startsWith(`${LIBRARY_LIST}/`) && response.status() === 200,
        undefined,
        'GET /api/library/:id',
      );
      await card.focus();
      await page.keyboard.press('Enter');
      const read = await detailRead;
      const panel = page.locator(`aside[aria-label="${LIB.detail}"]`);
      await expect(panel).toBeVisible();
      await expect(panel.getByRole('heading', { name, exact: true })).toBeVisible();
      // MLD:101-149 preview frame + note, MLD:171-195 triangle counts, MLD:213-230 four metadata rows.
      await expect(panel.getByRole('region', { name: LIB.preview, exact: true })).toBeVisible();
      await expect(panel.getByText(LIB.autoSpinNote, { exact: true })).toBeVisible();
      await expect(panel.getByRole('region', { name: LIB.triangles, exact: true })).toContainText(LIB.declared);
      const metadata = panel.getByRole('region', { name: LIB.metadata, exact: true });
      for (const label of LIB.fields) await expect(metadata).toContainText(label);
      await captureEvidence(page, 'E08_library_keyboard_detail.png', { caption: `Enter on card "${name}" → ${pathOf(read.response.url())}` });

      await panel.getByRole('button', { name: LIB.closeDetail, exact: true }).click(); // MLD:305-310 closeDetail
      await expect(panel).toHaveCount(0);
      await attachJson('E08_library_keyboard_detail.json', { card: name, detailRead: pathOf(read.response.url()) });
    });
  });

  test('E08 · SCR-34 below 1024 px: stacked cards even after "Lưới"; a card name opens "Chi tiết model"', async ({ browser }) => {
    await asAdminUi(
      browser,
      async ({ page }) => {
        const items = await openLibrary(page);
        test.skip(items.length === 0, 'environment: library is empty, no card to show');
        await expect(libSearch(page)).toBeVisible();

        // MLB:189-192 isNarrow → card list whatever viewMode is (UML:516-517 state 'collapsed').
        await viewRadio(page, LIB.grid).click();
        await expect(viewRadio(page, LIB.grid)).toHaveAttribute('aria-checked', 'true');
        await expect(page.getByRole('table')).toHaveCount(0);
        await expect(page.getByRole('list', { name: LIB.gridList })).toHaveCount(0);
        const name = str(items[0] ?? {}, 'name');
        const cardButton = page.getByRole('listitem').getByRole('button', { name, exact: true }).first();
        await expect(cardButton).toBeVisible();

        await cardButton.click(); // MLB:108-114
        await expect(page.locator(`aside[aria-label="${LIB.detail}"]`)).toBeVisible();
        await captureEvidence(page, 'E08_library_narrow_cards.png', { caption: `${String(NARROW.width)} px, "Lưới" checked → cards; detail open` });
      },
      NARROW,
    );
  });

  test('E08 · SCR-34 refresh resets search, view mode and sort (local state only)', async ({ browser }) => {
    await asAdminUi(browser, async ({ page }) => {
      const items = await openLibrary(page);
      test.skip(items.length === 0, 'environment: library is empty');
      await expect(libSearch(page)).toBeVisible();

      await page.getByRole('columnheader', { name: LIB.triangles, exact: true }).click();
      await libSearch(page).fill('qa-e08');
      await viewRadio(page, LIB.grid).click();
      await expect(viewRadio(page, LIB.grid)).toHaveAttribute('aria-checked', 'true');

      // UML:317-323: search, filter, view mode and sort are useState — nothing in the URL or storage.
      await navigateThenWaitForApi(page, () => page.reload(), 'GET', /^\/api\/library$/u, [200]);
      await expect(libSearch(page)).toHaveValue('');
      await expect(viewRadio(page, LIB.table)).toHaveAttribute('aria-checked', 'true');
      await expect(page.getByRole('columnheader', { name: LIB.name, exact: true })).toHaveAttribute('aria-sort', 'ascending');
      await expect(page.getByRole('combobox', { name: LIB.category, exact: true })).toContainText(/^Tất cả \(\d+\)$/u);
      await captureEvidence(page, 'E08_library_refresh_reset.png', { caption: 'after reload: search empty, Bảng, Tên ascending, Tất cả' });
    });
  });

  test('E08 · SCR-34 [mocked response] GET /api/library 500 → "Không tải được thư viện mẫu 3D", no toolbar and no retry button; a reload recovers', async ({ browser }) => {
    await asAdminUi(browser, async ({ page }) => {
      let served = 0;
      const matcher = (url: URL): boolean => url.pathname === LIBRARY_LIST;
      const fail = async (route: Route): Promise<void> => {
        if (route.request().method() !== 'GET') return route.fallback();
        served += 1;
        return route.fulfill({ status: 500, contentType: 'application/json', body: JSON.stringify({ detail: 'qa-e08 mocked 500' }) });
      };
      await page.route(matcher, fail);
      try {
        await page.goto(ROUTES.adminModels);
        // ML:93-99 error branch: InlineAlert(title, describeError(...).description) — UML:498-502; 500 → unknown (I18N:61-64).
        await expect(page.getByText(LIB.errorTitle, { exact: true })).toBeVisible({ timeout: ERROR_PAINT_TIMEOUT_MS });
        await expect(page.getByText(GENERIC_UNKNOWN, { exact: true })).toBeVisible();
        await expect(libSearch(page)).toHaveCount(0);
        // The view wires no action on this alert (ML:96) although the hook has retryLoad (UML:570-572).
        await expect(page.getByRole('button', { name: 'Thử lại', exact: true })).toHaveCount(0);
        await captureEvidence(page, 'E08_library_500.png');

        await page.unroute(matcher, fail);
        await navigateThenWaitForApi(page, () => page.reload(), 'GET', /^\/api\/library$/u, [200]);
        await expect(page.getByText(LIB.errorTitle, { exact: true })).toHaveCount(0);
        await expect(libSearch(page).or(page.getByText(LIB.emptyTitle, { exact: true }))).toBeVisible();
        await captureEvidence(page, 'E08_library_500_reload.png');
        await attachJson('E08_library_500.json', { mockedResponses: served, status: 500, afterReload: 200 });
      } finally {
        await page.unroute(matcher, fail).catch(() => undefined);
      }
    });
  });

  test('E08 · SCR-34 real engineer: read-only reason, list still shown, no write control', async ({ browser }) => {
    const engineer = await ensureEngineer();
    await signedIn(browser, engineer, async ({ page }) => {
      const items = await openLibrary(page);
      if (items.length === 0) {
        // ML:85-90: an empty library is the EmptyState branch, which comes before the read-only alert.
        await expect(page.getByText(LIB.emptyTitle, { exact: true })).toBeVisible();
      } else {
        // MLG:111-125 canManage = can('manage','library') → false for engineer (PERM:64-75); UML:506-509,577 → alert.
        await expect(page.getByText(LIB.readOnly, { exact: true })).toBeVisible();
        await expect(libSearch(page)).toBeVisible();
        await expect(libRows(page)).toHaveCount(items.length);
      }
      await expect(page.getByRole('button', { name: /tải lên|xoá|sửa|lưu/iu })).toHaveCount(0);
      await captureEvidence(page, 'E08_library_engineer_read_only.png', { caption: `engineer; ${String(items.length)} model(s) listed` });
    });
  });
});

/* ================================================================= SCR-35 Training Jobs */

test.describe('E08 SCR-35 Training Jobs', () => {
  test('E08 · SCR-35 "Lọc theo họ" = Tách lớp tường reads training-jobs?family=wallSegmentation; result rows or "Không có lượt nào khớp bộ lọc."', async ({ browser }) => {
    await asAdminUi(browser, async ({ page }) => {
      await openTraining(page);
      const filter = page.getByRole('radiogroup', { name: TRAIN.familyFilter, exact: true });
      await expect(filter.getByRole('radio', { name: 'Tất cả', exact: true })).toHaveAttribute('aria-checked', 'true');

      // UTJ:405-413 jobFilter → listJobs({family}) (src/api/adminMlJobsClient.ts:178-179).
      const read = readOf(page, JOBS, (url) => url.searchParams.get('family') === 'wallSegmentation');
      await filter.getByRole('radio', { name: ML_FAMILY_LABEL.wallSegmentation, exact: true }).click();
      const res = await read;
      const items = itemsOf(res.json, 'GET training-jobs?family');
      await expect(filter.getByRole('radio', { name: ML_FAMILY_LABEL.wallSegmentation, exact: true })).toHaveAttribute('aria-checked', 'true');

      if (items.length === 0) {
        // TJT:121-122 + UTJ:815-820: filtered and nothing back → emptyFiltered.
        await expect(page.getByText(TRAIN.emptyTitle, { exact: true })).toBeVisible();
        await expect(page.getByText(TRAIN.emptyFiltered, { exact: true })).toBeVisible();
      } else {
        // TJT:28-38 the open button shows the family label.
        const labels = await page.locator('tbody tr button[aria-pressed]').allInnerTexts();
        expect(labels.length).toBeGreaterThan(0);
        expect(labels.every((label) => label.trim() === ML_FAMILY_LABEL.wallSegmentation), labels.join(' | ')).toBe(true);
      }
      await captureEvidence(page, 'E08_training_family_filter.png', { caption: `${pathOf(res.response.url())} → ${String(items.length)} item(s)` });

      await filter.getByRole('radio', { name: 'Tất cả', exact: true }).click();
      await expect(filter.getByRole('radio', { name: 'Tất cả', exact: true })).toHaveAttribute('aria-checked', 'true');
      await attachJson('E08_training_family_filter.json', { request: pathOf(res.response.url()), items: items.length });
    });
  });

  test('E08 · SCR-35 tabs keyboard: ArrowRight / ArrowLeft / End / Home move selection and focus', async ({ browser }) => {
    await asAdminUi(browser, async ({ page }) => {
      await openTraining(page);
      const list = page.getByRole('tablist', { name: TRAIN.tabs, exact: true });
      const jobs = list.getByRole('tab', { name: TRAIN.tabJobs, exact: true });
      const datasets = list.getByRole('tab', { name: TRAIN.tabDatasets, exact: true });
      await expect(jobs).toHaveAttribute('aria-selected', 'true');

      // TAB:98-118 ArrowRight/ArrowLeft/Home/End → onChange + focus the new tab.
      await jobs.focus();
      await page.keyboard.press('ArrowRight');
      await expect(datasets).toHaveAttribute('aria-selected', 'true');
      await expect(datasets).toBeFocused();
      await page.keyboard.press('ArrowLeft');
      await expect(jobs).toHaveAttribute('aria-selected', 'true');
      await expect(jobs).toBeFocused();
      await page.keyboard.press('End');
      await expect(datasets).toHaveAttribute('aria-selected', 'true');
      await expect(page.getByText(TRAIN.dsNote, { exact: true })).toBeVisible();
      await captureEvidence(page, 'E08_training_tabs_keyboard.png', { caption: 'End → "Bộ dữ liệu" selected and focused' });
      await page.keyboard.press('Home');
      await expect(jobs).toHaveAttribute('aria-selected', 'true');
      await expect(jobs).toBeFocused();
    });
  });

  test('E08 · SCR-35 "Bộ dữ liệu" tab: read-only note, "Loại mô hình" switch reads datasets per family, list or empty copy', async ({ browser }) => {
    await asAdminUi(browser, async ({ page }) => {
      await openTraining(page);
      const checkBranch = async (items: Json[], family: MlFamily): Promise<void> => {
        if (items.length === 0) {
          // TDT:80-83 + UTJ:815-817.
          await expect(page.getByText(TRAIN.dsEmptyTitle, { exact: true })).toBeVisible();
          await expect(page.getByText(TRAIN.dsEmpty, { exact: true })).toBeVisible();
        } else {
          // TDT:86-105: nav list (first selected, UTJ:551-553) + versions section.
          const nav = page.getByRole('navigation', { name: TRAIN.dsList, exact: true });
          await expect(nav.getByRole('button').first()).toHaveAttribute('aria-pressed', 'true');
          expect(await nav.getByRole('button').count(), `${family}: datasets listed`).toBeGreaterThanOrEqual(items.length);
          await expect(page.getByRole('region', { name: TRAIN.dsVersions, exact: true })).toBeVisible();
        }
      };

      // UTJ:544-548 tab datasets query (family = datasetFamily, default wallSegmentation).
      const walls = readOf(page, DATASETS, (url) => url.searchParams.get('family') === 'wallSegmentation');
      await page.getByRole('tab', { name: TRAIN.tabDatasets, exact: true }).click();
      const wallItems = itemsOf((await walls).json, 'GET datasets (walls)');
      await expect(page.getByText(TRAIN.dsNote, { exact: true })).toBeVisible(); // TDT:120
      const group = page.getByRole('tabpanel').getByRole('radiogroup', { name: TRAIN.dsFamily, exact: true });
      await expect(group.getByRole('radio')).toHaveText(FAMILY_ORDER.map((f) => ML_FAMILY_LABEL[f])); // UTJ:185-187
      await checkBranch(wallItems, 'wallSegmentation');

      const dim = readOf(page, DATASETS, (url) => url.searchParams.get('family') === 'dimensionReading');
      await group.getByRole('radio', { name: ML_FAMILY_LABEL.dimensionReading, exact: true }).click();
      const dimItems = itemsOf((await dim).json, 'GET datasets (dimension)');
      await expect(group.getByRole('radio', { name: ML_FAMILY_LABEL.dimensionReading, exact: true })).toHaveAttribute('aria-checked', 'true');
      await checkBranch(dimItems, 'dimensionReading');
      await captureEvidence(page, 'E08_training_datasets_tab.png', { caption: `walls ${String(wallItems.length)} dataset(s), dimensionReading ${String(dimItems.length)}` });
      await attachJson('E08_training_datasets_tab.json', { wallSegmentation: wallItems.length, dimensionReading: dimItems.length });
    });
  });

  test('E08 · SCR-35 form "Số vòng": 0 / 301 / empty refused, submit disabled, Enter sends nothing; 1 and 300 accepted; never submitted', async ({ browser }) => {
    await asAdminUi(browser, async ({ page }) => {
      await openTraining(page);
      const guard = await guardWrites(page, 'POST', new RegExp(`^${escapeRegExp(JOBS)}$`, 'u'));
      try {
        await page.getByRole('button', { name: TRAIN.create, exact: true }).click();
        const dialog = page.getByRole('dialog', { name: TRAIN.create });
        await expect(dialog).toBeVisible();
        const epochs = dialog.getByLabel(TRAIN.epochs, { exact: true });
        const submit = dialog.getByRole('button', { name: TRAIN.submit, exact: true });
        await expect(epochs).toHaveValue(TRAIN.epochsDefault);

        // UNF:69-74: the field's own refusal (not committed, so the form keeps 50).
        await typeHeight(epochs, '0');
        await expect(dialog.getByText(TRAIN.belowMin, { exact: true })).toBeVisible();
        await typeHeight(epochs, '301');
        await expect(dialog.getByText(TRAIN.aboveMax, { exact: true })).toBeVisible();
        // Empty commits `undefined` → UTJ:646-652 epochsValid false → "Số vòng phải từ 1 đến 300.", canSubmit false.
        await typeHeight(epochs, '');
        await expect(dialog.getByText(TRAIN.epochsInvalid, { exact: true })).toBeVisible();
        await expect(submit).toBeDisabled();
        await captureEvidence(page, 'E08_training_epochs_invalid.png', { caption: 'Số vòng empty → refused, submit disabled' });

        // TJF:71-74,79 Enter submits the form → UTJ:654-655 returns while !canSubmit. The guard aborts anything that leaks.
        await epochs.press('Enter');
        await expect(dialog).toBeVisible();

        for (const ok of ['1', '300']) {
          await typeHeight(epochs, ok);
          await expect(dialog.getByText(TRAIN.epochsInvalid, { exact: true })).toHaveCount(0);
          await expect(dialog.getByText(TRAIN.belowMin, { exact: true })).toHaveCount(0);
          await expect(dialog.getByText(TRAIN.aboveMax, { exact: true })).toHaveCount(0);
        }
        await captureEvidence(page, 'E08_training_epochs_valid.png', { caption: 'Số vòng 300 accepted (never submitted)' });
        await dialog.getByRole('button', { name: TRAIN.close, exact: true }).click();
        await expect(page.getByRole('dialog')).toHaveCount(0);
        await page.waitForTimeout(QUIET_MS);
        expect(guard.count(), 'no POST /api/admin/ml/training-jobs was attempted').toBe(0);
        await attachJson('E08_training_epochs.json', { postAttempts: guard.count(), refused: ['0', '301', ''], accepted: ['1', '300'] });
      } finally {
        await guard.release().catch(() => undefined);
      }
    });
  });

  test('E08 · SCR-35 form keyboard: Enter opens it (datasets read for walls), family switch re-reads datasets, Esc closes and focus returns; no POST', async ({ browser }) => {
    await asAdminUi(browser, async ({ page }) => {
      await openTraining(page);
      const guard = await guardWrites(page, 'POST', new RegExp(`^${escapeRegExp(JOBS)}$`, 'u'));
      try {
        const opener = page.getByRole('button', { name: TRAIN.create, exact: true });
        // UTJ:517-521 form datasets query, enabled while the form is open, family = formFamily (default walls, UTJ:388).
        const walls = readOf(page, DATASETS, (url) => url.searchParams.get('family') === 'wallSegmentation');
        await opener.focus();
        await page.keyboard.press('Enter');
        const dialog = page.getByRole('dialog', { name: TRAIN.create });
        await expect(dialog).toBeVisible();
        const wallItems = itemsOf((await walls).json, 'GET datasets (form walls)');

        const families = dialog.getByRole('radiogroup', { name: TRAIN.formFamily, exact: true });
        await expect(families.getByRole('radio', { name: ML_FAMILY_LABEL.wallSegmentation, exact: true })).toHaveAttribute('aria-checked', 'true');
        // TJF:41 the picker is disabled without options; UTJ:522-524 the first dataset is preselected.
        const datasetPicker = dialog.getByRole('combobox', { name: TRAIN.formDataset, exact: true });
        if (wallItems.length === 0) await expect(datasetPicker).toBeDisabled();
        else await expect(datasetPicker).toContainText(str(wallItems[0] ?? {}, 'name'));

        const opening = readOf(page, DATASETS, (url) => url.searchParams.get('family') === 'openingAndFurnitureDetection');
        await families.getByRole('radio', { name: ML_FAMILY_LABEL.openingAndFurnitureDetection, exact: true }).click();
        const openingItems = itemsOf((await opening).json, 'GET datasets (form opening)');
        // src/api/schemas/adminMl.ts:64-67 TRAINING_BASE_MODELS; UTJ:539-541 first one preselected.
        const base = dialog.getByRole('radiogroup', { name: TRAIN.formBaseModel, exact: true });
        await expect(base.getByRole('radio')).toHaveText(['yolov8n', 'yolov8s']);
        await expect(base.getByRole('radio', { name: 'yolov8n', exact: true })).toHaveAttribute('aria-checked', 'true');
        await captureEvidence(page, 'E08_training_form_keyboard.png', { caption: `opening family: ${String(openingItems.length)} dataset(s); base yolov8n` });

        // Modal: focusTrap onEscape → onClose; release() sends focus home to the opener (FT:183-213).
        await page.keyboard.press('Escape');
        await expect(page.getByRole('dialog')).toHaveCount(0);
        await expect(opener).toBeFocused();
        await page.waitForTimeout(QUIET_MS);
        expect(guard.count(), 'no POST /api/admin/ml/training-jobs was attempted').toBe(0);
        await attachJson('E08_training_form_keyboard.json', { wallDatasets: wallItems.length, openingDatasets: openingItems.length, postAttempts: guard.count() });
      } finally {
        await guard.release().catch(() => undefined);
      }
    });
  });

  test('E08 · SCR-35 ↔ SCR-36 related links and Back: "Model AI của chuỗi xử lý" → /admin/training/models, "Lượt huấn luyện" → /admin/training/jobs', async ({ browser }) => {
    await asAdminUi(browser, async ({ page }) => {
      await openTraining(page);
      // TJ:44-62 header: breadcrumb (current "Huấn luyện"), h1, related link (UTJ:161 RELATED_LINK).
      const crumbs = page.getByRole('navigation', { name: 'Đường dẫn trang', exact: true });
      await expect(crumbs, 'breadcrumb removed').toHaveCount(0);
      await expect(page.getByRole('heading', { level: 1, name: TRAIN.title, exact: true })).toBeVisible();

      const families = readOf(page, FAMILIES);
      await page.getByRole('link', { name: TRAIN.related, exact: true }).click();
      await families;
      await expect.poll(() => pathOf(page.url())).toBe(ROUTES.adminTrainingModels);
      await expect(page.getByRole('heading', { level: 1, name: REG.title, exact: true })).toBeVisible(); // MR:58
      await expect(crumbs, 'breadcrumb removed').toHaveCount(0);
      await captureEvidence(page, 'E08_related_links_registry.png', { caption: `"${TRAIN.related}" → ${pathOf(page.url())}` });

      const jobs = readOf(page, JOBS);
      await page.getByRole('link', { name: REG.related, exact: true }).click(); // MR:60-64, UMR:94
      await jobs;
      await expect.poll(() => pathOf(page.url())).toBe(ROUTES.adminTrainingJobs);
      await expect(page.getByRole('heading', { level: 1, name: TRAIN.title, exact: true })).toBeVisible();

      await page.goBack();
      await expect.poll(() => pathOf(page.url())).toBe(ROUTES.adminTrainingModels);
      await expect(page.getByRole('heading', { level: 1, name: REG.title, exact: true })).toBeVisible();
      await captureEvidence(page, 'E08_related_links_back.png', { caption: `Back → ${pathOf(page.url())}` });
      await attachJson('E08_related_links.json', { trainingToRegistry: ROUTES.adminTrainingModels, registryToTraining: ROUTES.adminTrainingJobs, back: pathOf(page.url()) });
    });
  });

  test('E08 · SCR-35 [mocked response] GET training-jobs 500 → "Không đọc được dữ liệu huấn luyện" with "Thử lại"; toolbar stays; retry reads again', async ({ browser }) => {
    await asAdminUi(browser, async ({ page }) => {
      let served = 0;
      const matcher = (url: URL): boolean => url.pathname === JOBS;
      const fail = async (route: Route): Promise<void> => {
        if (route.request().method() !== 'GET') return route.fallback();
        served += 1;
        return route.fulfill({ status: 500, contentType: 'application/json', body: JSON.stringify({ detail: 'qa-e08 mocked 500' }) });
      };
      await page.route(matcher, fail);
      try {
        await page.goto(ROUTES.adminTrainingJobs);
        // TJT:107-116 error alert; UTJ:584 state error; TJG:171-182 describeReadError → readFallback for a 500.
        await expect(page.getByText(TRAIN.errorTitle, { exact: true })).toBeVisible({ timeout: ERROR_PAINT_TIMEOUT_MS });
        await expect(page.getByText(TRAIN.readFallback, { exact: true })).toBeVisible();
        await expect(page.getByRole('button', { name: TRAIN.create, exact: true })).toBeVisible(); // TJ:5-6 toolbar kept
        await captureEvidence(page, 'E08_training_500.png');

        await page.unroute(matcher, fail);
        const read = readOf(page, JOBS);
        await page.getByRole('button', { name: TRAIN.retry, exact: true }).click(); // UTJ:728-731 onRetry → refetch
        await read;
        await expect(page.getByText(TRAIN.errorTitle, { exact: true })).toHaveCount(0);
        await expect(page.getByText(TRAIN.emptyTitle, { exact: true }).or(page.locator('tbody tr').first())).toBeVisible();
        await captureEvidence(page, 'E08_training_500_retry.png');
        await attachJson('E08_training_500.json', { mockedResponses: served, status: 500, afterRetry: 200 });
      } finally {
        await page.unroute(matcher, fail).catch(() => undefined);
      }
    });
  });

  test('E08 · SCR-35 real engineer: "Không có quyền truy cập", no tabs or create button, no /api/admin/ml request', async ({ browser }) => {
    const engineer = await ensureEngineer();
    await signedIn(browser, engineer, async ({ page }) => {
      const reads = recordRequests(page, (req) => pathnameOf(req.url()).startsWith('/api/admin/ml'));
      try {
        await page.goto(ROUTES.adminTrainingJobs);
        // TJG:39-41 admin only; UTJ:399-402 queries disabled; TJ:133-140 forbidden branch keeps the header.
        await expect(page.getByRole('heading', { name: TRAIN.forbiddenTitle, exact: true })).toBeVisible();
        await expect(page.getByText(TRAIN.forbiddenBody, { exact: true })).toBeVisible();
        await expect(page.getByRole('heading', { level: 1, name: TRAIN.title, exact: true })).toBeVisible();
        await expect(page.getByRole('tab')).toHaveCount(0);
        await expect(page.getByRole('button', { name: TRAIN.create, exact: true })).toHaveCount(0);
        await page.waitForTimeout(QUIET_MS);
        expect(reads.list(), 'no /api/admin/ml request for an engineer').toEqual([]);
        await captureEvidence(page, 'E08_training_engineer_forbidden.png', { caption: 'engineer; /api/admin/ml requests: 0' });
        await attachJson('E08_training_engineer_forbidden.json', { adminMlRequests: reads.list() });
      } finally {
        reads.stop();
      }
    });
  });
});

/* ================================================================= SCR-36 Model Registry */

test.describe('E08 SCR-36 Model Registry', () => {
  test('E08 · SCR-36 version label → "Chi tiết phiên bản" (GET model-versions/:id): title, evaluation badge, six fields; placeholder before', async ({ browser }) => {
    await asAdminUi(browser, async ({ page }) => {
      const { walls } = await openRegistry(page);
      let family: MlFamily = 'wallSegmentation';
      let versions = walls;
      for (const next of FAMILY_ORDER.slice(1)) {
        if (versions.length > 0) break;
        family = next;
        versions = await selectRegistryFamily(page, next);
      }
      test.skip(versions.length === 0, 'environment: no model version in any family');

      const panel = page.getByRole('complementary', { name: REG.detailPanel, exact: true });
      await expect(panel).toContainText(REG.placeholder); // MRD:15-17

      const version = versions[0] ?? {};
      const id = str(version, 'id');
      const label = str(version, 'label');
      const read = readOf(page, `${VERSIONS}/${id}`); // UMR:421-425 selectedQuery
      const button = versionRow(page, label).getByRole('button', { name: label, exact: true });
      await button.click();
      await read;
      await expect(button).toHaveAttribute('aria-pressed', 'true'); // MRV:32
      // MRD:28-46 + UMR:256-299 buildDetail.
      await expect(panel.getByRole('heading', { name: label, exact: true })).toBeVisible();
      await expect(panel).toContainText(EVALUATION_LABEL[str(version, 'evaluationStatus')] ?? '');
      for (const field of REG.fields) await expect(panel.locator('dt', { hasText: exactText(field) })).toBeVisible();
      await expect(panel.getByText(id, { exact: true })).toBeVisible();
      await captureEvidence(page, 'E08_registry_version_detail.png', { caption: `${family}: "${label}" → GET ${VERSIONS}/${id}` });
      await attachJson('E08_registry_version_detail.json', { family, versionId: id, label });
    });
  });

  test('E08 · SCR-36 every family via ArrowRight: "Đang dùng", blocked reasons, partial notice, empty / no-active copy match GET model-versions', async ({ browser }) => {
    await asAdminUi(browser, async ({ page }) => {
      const { families, walls } = await openRegistry(page);
      const summary: Record<string, unknown> = {};

      for (const [index, family] of FAMILY_ORDER.entries()) {
        let versions = walls;
        if (index > 0) {
          // SEG:128-139 ArrowRight on the picker selects the next family → UMR:567-573 → versions read.
          const read = readOf(page, VERSIONS, (url) => url.searchParams.get('family') === family);
          const previous = FAMILY_ORDER[index - 1] ?? 'wallSegmentation';
          await registryPicker(page).getByRole('radio', { name: ML_FAMILY_LABEL[previous], exact: true }).focus();
          await page.keyboard.press('ArrowRight');
          versions = itemsOf((await read).json, `GET model-versions (${family})`);
        }
        await expect(registryPicker(page).getByRole('radio', { name: ML_FAMILY_LABEL[family], exact: true })).toHaveAttribute('aria-checked', 'true');

        const record = familyOf(families, family);
        const activeId = typeof record.activeVersionId === 'string' ? record.activeVersionId : null;
        const card = activeCard(page);
        await expect(card).toBeVisible();
        // UMR:227-253 buildActiveCard.
        if (activeId === null) {
          await expect(card).toContainText(family === 'wallSegmentation' ? REG.classic : REG.noActive);
          await expect(card.getByRole('button', { name: REG.revert, exact: true })).toHaveCount(0);
        } else {
          await expect(card.getByRole('button', { name: REG.revert, exact: true })).toHaveCount(family === 'wallSegmentation' ? 1 : 0);
        }

        if (versions.length === 0) {
          // MR:148-149 + UMR:336-340 emptyMessage.
          await expect(page.getByText(REG.emptyTitle, { exact: true })).toBeVisible();
          const message = family === 'wallSegmentation' && activeId === null ? `${REG.emptyBase} ${REG.emptyClassic}` : REG.emptyBase;
          await expect(page.getByText(message, { exact: true })).toBeVisible();
        } else {
          await expect(page.locator('tbody tr')).toHaveCount(versions.length);
          const labels = versions.map((v) => str(v, 'label'));
          for (const version of versions) {
            const label = str(version, 'label');
            if (labels.filter((l) => l === label).length > 1) continue; // ambiguous row, not asserted
            const row = versionRow(page, label);
            const activate = row.getByRole('button', { name: REG.activate, exact: true });
            // MRV:42-67 ActivateControl + UMR:201-206 activateBlockedReason.
            if (version.id === activeId) {
              await expect(row).toContainText(REG.active);
              await expect(activate).toHaveCount(0);
            } else if (version.evaluationStatus !== 'completed') {
              await expect(activate).toBeDisabled();
              await expect(row).toContainText(REG.blockedNotEvaluated);
            } else if (version.weightsFormat !== 'onnx') {
              await expect(activate).toBeDisabled();
              await expect(row).toContainText(REG.blockedFormat);
            } else {
              await expect(activate).toBeEnabled();
            }
          }
        }
        // MR:147 + UMR:178-180,342-343 partial notice counts pending + running.
        const pending = versions.filter((v) => v.evaluationStatus === 'pending' || v.evaluationStatus === 'running').length;
        if (pending > 0) await expect(page.getByText(`${String(pending)} ${REG.partialTail}`, { exact: true })).toBeVisible();
        else await expect(page.getByText(REG.partialTail, { exact: false })).toHaveCount(0);

        await captureEvidence(page, `E08_registry_family_${family}.png`, {
          caption: `${family}: ${String(versions.length)} version(s), active ${activeId ?? 'none'}, pending ${String(pending)}`,
        });
        summary[family] = { versions: versions.length, activeVersionId: activeId, pending };
      }
      await attachJson('E08_registry_families.json', summary);
    });
  });

  test('E08 · SCR-36 activation dialog: title, body and warning from the data; "Huỷ" and Esc close it; no PUT ever leaves the page', async ({ browser }) => {
    await asAdminUi(browser, async ({ page }) => {
      const guard = await guardWrites(page, 'PUT', ACTIVE_PUT);
      try {
        const { families, walls } = await openRegistry(page);
        let found: { family: MlFamily; candidate: Json; versions: Json[] } | null = null;
        // CP-8 lives in the opening family; any family with an activatable row works for a cancel-only test.
        for (const family of ['openingAndFurnitureDetection', 'wallSegmentation', 'dimensionReading'] as const) {
          const versions = family === 'wallSegmentation' ? walls : await selectRegistryFamily(page, family);
          if (family === 'wallSegmentation') await registryPicker(page).getByRole('radio', { name: ML_FAMILY_LABEL[family], exact: true }).click();
          const activeId = familyOf(families, family).activeVersionId;
          const candidate = versions.find((v) => v.id !== activeId && v.evaluationStatus === 'completed' && v.weightsFormat === 'onnx');
          if (candidate !== undefined) {
            found = { family, candidate, versions };
            break;
          }
        }
        test.skip(found === null, 'environment: no activatable (completed onnx, not active) version in any family — CP-8 missing');
        if (found === null) return;

        const { family, candidate, versions } = found;
        const label = str(candidate, 'label');
        const activeId = familyOf(families, family).activeVersionId;
        const cardBefore = (await activeCard(page).innerText()).trim();

        await versionRow(page, label).getByRole('button', { name: REG.activate, exact: true }).click(); // UMR:575-585
        const dialog = page.getByRole('dialog', { name: activateTitle(label, family), exact: true }); // UMR:160-162
        await expect(dialog).toBeVisible();
        await expect(dialog).toContainText(REG.dialogBody); // UMR:127,326
        // UMR:315-319 warning when the active version is known and not completed.
        const active = versions.find((v) => v.id === activeId);
        if (active !== undefined) {
          await expect(dialog.getByText(REG.dialogWarning, { exact: true })).toHaveCount(active.evaluationStatus === 'completed' ? 0 : 1);
        }
        await captureEvidence(page, 'E08_registry_dialog_open.png', { caption: `${family}: "${activateTitle(label, family)}" (cancelled below)` });

        await dialog.getByRole('button', { name: REG.cancel, exact: true }).click(); // MRA:35-37 onCloseDialog
        await expect(page.getByRole('dialog')).toHaveCount(0);

        await versionRow(page, label).getByRole('button', { name: REG.activate, exact: true }).click();
        await expect(dialog).toBeVisible();
        await page.keyboard.press('Escape'); // Modal focusTrap onEscape (A12)
        await expect(page.getByRole('dialog')).toHaveCount(0);

        await page.waitForTimeout(QUIET_MS);
        expect(guard.count(), 'no PUT …/model-families/*/active was attempted').toBe(0);
        await expect(activeCard(page)).toHaveText(cardBefore);
        await captureEvidence(page, 'E08_registry_dialog_cancelled.png', { caption: `Huỷ + Esc: PUT attempts ${String(guard.count())}, "Đang dùng" unchanged` });
        await attachJson('E08_registry_dialog_cancel.json', { family, candidate: str(candidate, 'id'), activeVersionId: activeId ?? null, putAttempts: guard.count() });
      } finally {
        await guard.release().catch(() => undefined);
      }
    });
  });

  test('E08 · SCR-36 [mocked response] GET model-families 500 → "Không đọc được danh sách model" with "Thử lại"; picker stays; retry reads again', async ({ browser }) => {
    await asAdminUi(browser, async ({ page }) => {
      let served = 0;
      const matcher = (url: URL): boolean => url.pathname === FAMILIES;
      const fail = async (route: Route): Promise<void> => {
        if (route.request().method() !== 'GET') return route.fallback();
        served += 1;
        return route.fulfill({ status: 500, contentType: 'application/json', body: JSON.stringify({ detail: 'qa-e08 mocked 500' }) });
      };
      await page.route(matcher, fail);
      try {
        await page.goto(ROUTES.adminTrainingModels);
        // MR:124-133 error alert; UMR:440,452 readError; MRE:59-74 describeReadError → readFallback for a 500.
        await expect(page.getByText(REG.errorTitle, { exact: true })).toBeVisible({ timeout: ERROR_PAINT_TIMEOUT_MS });
        await expect(page.getByText(REG.readFallback, { exact: true })).toBeVisible();
        await expect(registryPicker(page)).toBeVisible(); // MR:187-193 outside VersionsArea
        await captureEvidence(page, 'E08_registry_500.png');

        await page.unroute(matcher, fail);
        const read = readOf(page, FAMILIES);
        await page.getByRole('button', { name: REG.retry, exact: true }).click(); // UMR:638-642 onRetry
        await read;
        await expect(page.getByText(REG.errorTitle, { exact: true })).toHaveCount(0);
        await expect(activeCard(page)).toBeVisible();
        await captureEvidence(page, 'E08_registry_500_retry.png');
        await attachJson('E08_registry_500.json', { mockedResponses: served, status: 500, afterRetry: 200 });
      } finally {
        await page.unroute(matcher, fail).catch(() => undefined);
      }
    });
  });

  test('E08 · SCR-36 real engineer: "Không có quyền truy cập", no family picker, no /api/admin/ml request', async ({ browser }) => {
    const engineer = await ensureEngineer();
    await signedIn(browser, engineer, async ({ page }) => {
      const reads = recordRequests(page, (req) => pathnameOf(req.url()).startsWith('/api/admin/ml'));
      try {
        await page.goto(ROUTES.adminTrainingModels);
        // UMR:395-396,450 not admin → forbidden, queries disabled; MR:172-178 header + EmptyState.
        await expect(page.getByRole('heading', { name: REG.forbiddenTitle, exact: true })).toBeVisible();
        await expect(page.getByText(REG.forbiddenBody, { exact: true })).toBeVisible();
        await expect(page.getByRole('link', { name: REG.related, exact: true })).toBeVisible();
        await expect(registryPicker(page)).toHaveCount(0);
        await page.waitForTimeout(QUIET_MS);
        expect(reads.list(), 'no /api/admin/ml request for an engineer').toEqual([]);
        await captureEvidence(page, 'E08_registry_engineer_forbidden.png', { caption: 'engineer; /api/admin/ml requests: 0' });
        await attachJson('E08_registry_engineer_forbidden.json', { adminMlRequests: reads.list() });
      } finally {
        reads.stop();
      }
    });
  });
});

/* ================================================================= SCR-37 User Management */

test.describe('E08 SCR-37 User Management', () => {
  test('E08 · SCR-37 search miss with filters → "Không tìm thấy người dùng"; "Xoá tìm kiếm và bộ lọc" resets all three and focuses the search box', async ({ browser }) => {
    await ensureEngineer(); // ≥ 2 users, so the screen is not in its "empty" state (UUM:994-996)
    await asAdminUi(browser, async ({ page }) => {
      const users = await openUsers(page);
      const search = page.getByLabel(USR.search, { exact: true });
      const role = page.getByRole('combobox', { name: USR.role, exact: true });
      const status = page.getByRole('combobox', { name: USR.status, exact: true });

      await pickOption(page, role, ROLE_LABEL.viewer);
      await pickOption(page, status, STATUS_LABEL.pending);
      const miss = `qa-e08-nobody-${uniq()}`;
      await search.fill(miss);
      // UMB:169-178,282-284 NoMatchState.
      await expect(page.getByText(USR.noMatchTitle, { exact: true })).toBeVisible();
      await expect(page.getByText(USR.noMatchBody, { exact: true })).toBeVisible();
      await captureEvidence(page, 'E08_users_no_match.png', { caption: `Vai=Người xem, Trạng thái=Chờ chấp nhận, tìm="${miss}"` });

      // UUM:1066-1070 onClearSearch resets search + both filters; UM:131-137 focus back to the search box (BUG-082).
      await page.getByRole('button', { name: USR.clearSearch, exact: true }).click();
      await expect(search).toHaveValue('');
      await expect(role).toContainText(USR.all);
      await expect(status).toContainText(USR.all);
      await expect(search).toBeFocused();
      await expect(page.locator('tbody tr')).toHaveCount(users.length);
      await captureEvidence(page, 'E08_users_no_match_cleared.png', { caption: 'after "Xoá tìm kiếm và bộ lọc": all rows, search focused' });
      await attachJson('E08_users_no_match.json', { miss, rowsAfterClear: users.length, searchFocused: true });
    });
  });

  test('E08 · SCR-37 summary counts match GET /api/users; upper-case email search still finds the row; own row "Xoá" follows the last-admin rule', async ({ browser }) => {
    const engineer = await ensureEngineer();
    await asAdminUi(browser, async ({ page }) => {
      const users = await openUsers(page);
      // UUM:627-633 summary: users.length, ACTIVE admins (UUM:262-271), pending invites.
      const admins = users.filter((u) => u.role === 'admin' && u.status === 'active').length;
      const pending = users.filter((u) => u.status === 'pending').length;
      await expect(page.getByTestId('user-summary-users')).toHaveText(String(users.length));
      await expect(page.getByTestId('user-summary-admins')).toHaveText(String(admins));
      await expect(page.getByTestId('user-summary-pending')).toHaveText(String(pending));

      // UUM:351-359 matchesSearch folds case on name AND email.
      const search = page.getByLabel(USR.search, { exact: true });
      await search.fill(engineer.email.toUpperCase());
      await expect(page.locator('tbody tr')).toHaveCount(1);
      await expect(userRow(page, engineer.email)).toHaveCount(1);

      // UUM:282-284,337: the remove control is replaced only for the last ACTIVE admin.
      const { email } = readAdminCredentials();
      await search.fill(email);
      const own = userRow(page, email);
      await expect(own).toHaveCount(1);
      if (admins <= 1) {
        await expect(own).toContainText(USR.lastAdmin);
        await expect(own.getByRole('button', { name: USR.remove, exact: true })).toHaveCount(0);
      } else {
        await expect(own.getByRole('button', { name: USR.remove, exact: true })).toBeVisible(); // never clicked
      }
      await captureEvidence(page, 'E08_users_summary_own_row.png', { caption: `users ${String(users.length)}, active admins ${String(admins)}, pending ${String(pending)}` });
      await attachJson('E08_users_summary.json', { users: users.length, activeAdmins: admins, pending, ownRemove: admins <= 1 ? 'last-admin text' : 'button' });
    });
  });

  test('E08 · SCR-37 invite panel without sending: empty / invalid / mixed / duplicate input, reasons and chip; Esc while typing keeps it, Esc outside and "Huỷ" close it; no POST', async ({ browser }) => {
    await ensureEngineer();
    await asAdminUi(browser, async ({ page }) => {
      await openUsers(page);
      const guard = await guardWrites(page, 'POST', new RegExp(`^${escapeRegExp(INVITATIONS)}$`, 'u'));
      try {
        await page.getByRole('button', { name: USR.invite, exact: true }).click();
        const box = page.getByLabel(USR.inviteEmails, { exact: true });
        const submit = page.getByRole('button', { name: USR.inviteSubmit, exact: true });
        const chip = (n: number): Locator => page.getByText(`${String(n)} ${USR.validSuffix}`, { exact: true });
        await expect(box).toBeVisible();
        await expect(page.getByText(USR.inviteHint, { exact: true })).toBeVisible(); // UUM:930
        // UUM:216-230 inviteFeedback + UUM:925-929 canSubmit.
        await expect(submit).toBeDisabled();
        await expect(page.getByText(USR.inviteNeedsEmail, { exact: true })).toBeVisible();

        const a = testEmail('e08never-a');
        const b = testEmail('e08never-b');
        await box.fill('abc');
        await expect(page.getByText(USR.invalidLine('abc'), { exact: true })).toBeVisible();
        await expect(page.getByText(USR.inviteFixInvalid, { exact: true })).toBeVisible();
        await expect(submit).toBeDisabled();

        await box.fill(`abc, ${a}`);
        await expect(page.getByText(USR.invalidLine('abc'), { exact: true })).toBeVisible();
        await expect(chip(1)).toBeVisible(); // UMT:124-128
        await expect(submit).toBeDisabled();

        // UMG:319-338 parseInviteEmails splits on comma/newline, trims, de-duplicates.
        await box.fill(`${a},\n${a}\n ${b} `);
        await expect(page.getByText(/^Chưa đúng dạng địa chỉ thư:/u)).toHaveCount(0);
        await expect(chip(2)).toBeVisible();
        await expect(submit).toBeEnabled(); // never clicked here
        await expect(page.getByText(USR.inviteNeedsEmail, { exact: true })).toHaveCount(0);
        await captureEvidence(page, 'E08_users_invite_validation.png', { caption: '3 entries, 1 duplicate → "2 địa chỉ hợp lệ", submit enabled (not sent)' });

        // SR:23-26 nothing fires while a text box has focus → the sidePanel Esc (UM:145-157) does not close the panel.
        await box.focus();
        await page.keyboard.press('Escape');
        await expect(box).toBeVisible();
        // Focus out of the text box → Esc closes the invite panel (UM:150-151) and clears it (UUM:1110-1113).
        await page.evaluate(() => (document.activeElement as HTMLElement | null)?.blur());
        await page.keyboard.press('Escape');
        await expect(box).toHaveCount(0);
        await page.getByRole('button', { name: USR.invite, exact: true }).click();
        await expect(box).toHaveValue('');

        await box.fill(a);
        await page.getByRole('button', { name: USR.inviteCancel, exact: true }).click(); // UMT:149-151
        await expect(box).toHaveCount(0);
        await page.getByRole('button', { name: USR.invite, exact: true }).click();
        await expect(box).toHaveValue('');
        await page.waitForTimeout(QUIET_MS);
        expect(guard.count(), 'no POST /api/users/invitations was attempted').toBe(0);
        await captureEvidence(page, 'E08_users_invite_reopened_empty.png', { caption: `reopened after Huỷ / Esc: empty; POST attempts ${String(guard.count())}` });
        await attachJson('E08_users_invite_validation.json', { postAttempts: guard.count(), escWhileTyping: 'kept open', escOutside: 'closed + cleared' });
      } finally {
        await guard.release().catch(() => undefined);
      }
    });
  });

  test('E08 · SCR-37 "Gửi lời mời" (real, Mailpit sink): POST /api/users/invitations 201 role viewer, toast, row "Chờ chấp nhận", pending +1; cleaned up', async ({ browser }) => {
    await ensureEngineer();
    const email = testEmail('e08inv');
    let createdId: string | null = null;
    try {
      await asAdminUi(browser, async ({ page }) => {
        const users = await openUsers(page);
        const pendingBefore = users.filter((u) => u.status === 'pending').length;

        await page.getByRole('button', { name: USR.invite, exact: true }).click();
        await page.getByLabel(USR.inviteEmails, { exact: true }).fill(email);
        await expect(page.getByRole('combobox', { name: USR.inviteRole, exact: true })).toContainText(ROLE_LABEL.viewer); // UUM:485
        const post = waitForApi(page, 'POST', new RegExp(`^${escapeRegExp(INVITATIONS)}$`, 'u'), [201]);
        await page.getByRole('button', { name: USR.inviteSubmit, exact: true }).click();
        const sent = await post;
        const body = sent.response.request().postDataJSON() as Json;
        expect(body, 'POST body (UUM:1116-1129)').toEqual({ emails: [email], role: 'viewer' });
        createdId = str(asList(sent.json, 'invitations').find((u) => u.email === email) ?? {}, 'id') || null;

        // UUM:1131-1137 close + clear + toast(title, emails).
        await expect(toastWith(page, USR.invitedTitle)).toContainText(email);
        await expect(page.getByLabel(USR.inviteEmails, { exact: true })).toHaveCount(0);
        await page.getByLabel(USR.search, { exact: true }).fill(email);
        await expect(userRow(page, email)).toContainText(STATUS_LABEL.pending);
        await expect(page.getByTestId('user-summary-pending')).toHaveText(String(pendingBefore + 1));
        await captureEvidence(page, 'E08_users_invited_ui.png', { caption: `POST ${INVITATIONS} 201 → ${email} Chờ chấp nhận` });
        await attachJson('E08_users_invited_ui.json', { request: { emails: [email], role: 'viewer' }, status: 201, pendingBefore, pendingAfter: pendingBefore + 1 });
      });
    } finally {
      if (createdId !== null) await deleteUserApi(createdId, email);
      else {
        const leftover = (await listUsersApi().catch(() => [] as Json[])).find((u) => u.email === email);
        if (leftover !== undefined) await deleteUserApi(str(leftover, 'id'), email);
      }
      await sweepMails(email).catch(() => undefined);
    }
  });

  test('E08 · SCR-37 role select on the engineer row: Kỹ sư → Người xem (PATCH role, toast lists lost rights), back → "giữ nguyên"', async ({ browser }) => {
    const engineer = await ensureEngineer();
    try {
      await asAdminUi(browser, async ({ page }) => {
        await openUsers(page);
        await page.getByLabel(USR.search, { exact: true }).fill(engineer.email);
        const row = userRow(page, engineer.email);
        const select = row.getByRole('combobox', { name: `Vai của ${engineer.name}`, exact: true }); // UMB:59,84-99
        await expect(select).toContainText(ROLE_LABEL.engineer);
        const rolePath = new RegExp(`^${escapeRegExp(`${USERS}/${engineer.id}/role`)}$`, 'u');

        const toViewer = waitForApi(page, 'PATCH', rolePath, [200]);
        await pickOption(page, select, ROLE_LABEL.viewer);
        const first = await toViewer;
        expect(first.response.request().postDataJSON(), 'PATCH body').toEqual({ role: 'viewer', userId: engineer.id });
        // UUM:780-830 toast "Đã đổi vai" + lost permissions (UMG:226-233).
        await expect(toastWith(page, USR.roleChanged)).toContainText(ENGINEER_TO_VIEWER);
        await expect(select).toContainText(ROLE_LABEL.viewer);
        await captureEvidence(page, 'E08_users_role_viewer.png', { caption: `PATCH role viewer 200; toast "${ENGINEER_TO_VIEWER}"` });

        // NB:150-181 a second same-type toast inside 5 s merges into "Hoàn tác 2 thay đổi"; wait the window out.
        await page.waitForTimeout(TOAST_GROUP_WINDOW_MS + 300);
        const toEngineer = waitForApi(page, 'PATCH', rolePath, [200]);
        await pickOption(page, select, ROLE_LABEL.engineer);
        await toEngineer;
        await expect(toastWith(page, USR.noLoss)).toBeVisible();
        await expect(select).toContainText(ROLE_LABEL.engineer);
        await captureEvidence(page, 'E08_users_role_back.png', { caption: `PATCH role engineer 200; toast "${USR.noLoss}"` });
        await attachJson('E08_users_role.json', { first: { role: 'viewer', status: first.response.status() }, second: { role: 'engineer' } });
      });
    } finally {
      await restoreEngineer();
    }
  });

  test('E08 · SCR-37 "Vô hiệu hoá" then "Bật lại" on the engineer row: POST disable / enable 200, status and button swap, toasts', async ({ browser }) => {
    const engineer = await ensureEngineer();
    try {
      await asAdminUi(browser, async ({ page }) => {
        await openUsers(page);
        await page.getByLabel(USR.search, { exact: true }).fill(engineer.email);
        const row = userRow(page, engineer.email);
        await expect(row).toContainText(STATUS_LABEL.active);

        const disable = waitForApi(page, 'POST', new RegExp(`^${escapeRegExp(`${USERS}/${engineer.id}/disable`)}$`, 'u'), [200]);
        await row.getByRole('button', { name: USR.disable, exact: true }).click(); // UMB:152-154
        await disable;
        // UMB:145-148 disabled → "Bật lại"; UUM:841-866 toast with the user's name.
        await expect(row).toContainText(STATUS_LABEL.disabled);
        await expect(row.getByRole('button', { name: USR.enable, exact: true })).toBeVisible();
        await expect(toastWith(page, USR.disabledTitle)).toContainText(engineer.name);
        await captureEvidence(page, 'E08_users_disabled.png', { caption: `POST ${USERS}/${engineer.id}/disable 200` });

        await page.waitForTimeout(TOAST_GROUP_WINDOW_MS + 300); // NB:150-181 group window
        const enable = waitForApi(page, 'POST', new RegExp(`^${escapeRegExp(`${USERS}/${engineer.id}/enable`)}$`, 'u'), [200]);
        await row.getByRole('button', { name: USR.enable, exact: true }).click();
        await enable;
        await expect(row).toContainText(STATUS_LABEL.active);
        await expect(row.getByRole('button', { name: USR.disable, exact: true })).toBeVisible();
        await expect(toastWith(page, USR.enabledTitle)).toContainText(engineer.name);
        await captureEvidence(page, 'E08_users_enabled.png', { caption: `POST ${USERS}/${engineer.id}/enable 200` });
      });
    } finally {
      await restoreEngineer();
    }
  });

  test('E08 · SCR-37 "Xoá" a pending invitee: wrong email keeps confirm disabled, "Để sau" closes and resets, upper-case exact email → DELETE 200, toast, row gone', async ({ browser }) => {
    await ensureEngineer();
    const email = testEmail('e08del');
    const created = await inviteApi(email, 'viewer');
    const id = str(created, 'id');
    const name = str(created, 'name');
    let deleted = false;
    try {
      await asAdminUi(browser, async ({ page }) => {
        await openUsers(page);
        await page.getByLabel(USR.search, { exact: true }).fill(email);
        const row = userRow(page, email);
        await expect(row).toContainText(STATUS_LABEL.pending);

        await row.getByRole('button', { name: USR.remove, exact: true }).click(); // UMB:157-163
        const dialog = page.getByRole('dialog', { name: `Xoá hẳn ${name}?`, exact: true }); // UMD:254
        await expect(dialog).toBeVisible();
        await expect(dialog).toContainText(USR.removeWarning);
        await expect(dialog).toContainText(`Gõ lại ${email} để xác nhận.`);
        const input = dialog.getByLabel(USR.removeEmailLabel, { exact: true });
        const confirm = dialog.getByRole('button', { name: USR.removeConfirm, exact: true });
        await expect(confirm).toBeDisabled();
        await input.fill(`x${email}`);
        await expect(confirm).toBeDisabled(); // UUM:939-953 isMatch false

        await dialog.getByRole('button', { name: USR.removeLater, exact: true }).click();
        await expect(page.getByRole('dialog')).toHaveCount(0);
        await row.getByRole('button', { name: USR.remove, exact: true }).click();
        await expect(input).toHaveValue(''); // UUM:1144-1147 onOpenRemove clears the typed email

        // UUM:941-942 compare trims and lower-cases both sides; BE normalize_email casefolds (BE:packages/core/text.py:17-19).
        await input.fill(email.toUpperCase());
        await expect(confirm).toBeEnabled();
        await captureEvidence(page, 'E08_users_delete_confirm.png', { caption: 'upper-case exact address → "Xác nhận xoá vĩnh viễn" enabled' });

        const del = waitForApi(page, 'DELETE', new RegExp(`^${escapeRegExp(`${USERS}/${id}`)}$`, 'u'), [200]);
        await confirm.click();
        const res = await del;
        deleted = true;
        expect(res.response.request().postDataJSON(), 'DELETE body').toEqual({ confirmEmail: email.toUpperCase(), userId: id });
        await expect(page.getByRole('dialog')).toHaveCount(0);
        await expect(toastWith(page, USR.removedTitle)).toBeVisible(); // UUM:1159-1166
        await expect(userRow(page, email)).toHaveCount(0);
        await captureEvidence(page, 'E08_users_deleted.png', { caption: `DELETE ${USERS}/${id} 200; row gone` });
        await attachJson('E08_users_deleted.json', { id, confirmEmail: 'upper-case of the invited address', status: 200 });
      });
    } finally {
      if (!deleted) await deleteUserApi(id, email);
      await sweepMails(email).catch(() => undefined);
    }
  });

  test('E08 · SCR-37 detail panel of the engineer: memberships and activity reads, profile badges, remove section; table drops to 3 columns; close restores', async ({ browser }) => {
    const engineer = await ensureEngineer();
    await asAdminUi(browser, async ({ page }) => {
      await openUsers(page);
      await page.getByLabel(USR.search, { exact: true }).fill(engineer.email);
      const row = userRow(page, engineer.email);
      await expect(page.getByRole('columnheader', { name: USR.projectsHeader, exact: true })).toBeVisible();

      // UUM:542-560 memberships + activity reads for the selected user.
      const memberships = readOf(page, `${USERS}/${engineer.id}/memberships`);
      const activity = readOf(page, `${USERS}/${engineer.id}/activity`);
      await row.getByRole('button', { name: engineer.name, exact: true }).click(); // UMB:305-311
      const memberList = asList((await memberships).json, 'memberships');
      const activityList = asList((await activity).json, 'activity');

      const panel = page.locator(`aside[aria-label="${USR.detail}"]`);
      await expect(panel).toBeVisible();
      await expect(panel.getByRole('heading', { name: engineer.name, exact: true })).toBeVisible(); // UMD:97
      await expect(panel).toContainText(engineer.email);
      await expect(panel).toContainText(ROLE_LABEL.engineer);
      await expect(panel).toContainText(STATUS_LABEL.active);

      const memberRegion = panel.getByRole('region', { name: USR.memberships, exact: true });
      if (memberList.length === 0) await expect(memberRegion).toContainText(USR.noMemberships);
      else await expect(memberRegion.getByText(USR.membershipBlocked, { exact: true })).toHaveCount(memberList.length); // UUM:886-892
      await expect(memberRegion.getByRole('combobox')).toHaveCount(0);

      const activityRegion = panel.getByRole('region', { name: USR.activity, exact: true });
      if (activityList.length === 0) await expect(activityRegion).toContainText(USR.noActivity);
      else await expect(activityRegion.getByRole('listitem')).toHaveCount(Math.min(activityList.length, 10)); // UUM:116,895-901

      const removeRegion = panel.getByRole('region', { name: USR.removeSection, exact: true });
      await expect(removeRegion).toContainText(USR.removeSectionText);
      await expect(removeRegion.getByRole('button', { name: USR.remove, exact: true })).toBeVisible(); // never clicked
      // UMB:243-258,269: with a user selected the table keeps 3 columns.
      await expect(page.getByRole('columnheader', { name: USR.projectsHeader, exact: true })).toHaveCount(0);
      await captureEvidence(page, 'E08_users_detail.png', { caption: `memberships ${String(memberList.length)}, activity ${String(activityList.length)}` });

      await panel.getByRole('button', { name: USR.closeDetail, exact: true }).click(); // UMD:105-110
      await expect(panel).toHaveCount(0);
      await expect(page.getByRole('columnheader', { name: USR.projectsHeader, exact: true })).toBeVisible();
      await attachJson('E08_users_detail.json', { memberships: memberList.length, activity: activityList.length });
    });
  });

  test('E08 · SCR-37 permission matrix: 21 screen-reader cells match permissions.ts; Esc closes and focus returns to "Xem ma trận quyền"', async ({ browser }) => {
    await asAdminUi(browser, async ({ page }) => {
      await openUsers(page);
      const opener = page.getByRole('button', { name: USR.matrixButton, exact: true });
      await opener.click();
      const dialog = page.getByRole('dialog', { name: USR.matrixTitle, exact: true });
      await expect(dialog).toBeVisible();

      const expected: string[] = [];
      for (const row of MATRIX) {
        for (const role of ['admin', 'engineer', 'viewer'] as const) expected.push(cellSr(role, row.label, row[role]));
      }
      for (const line of expected) await expect(dialog.getByText(line, { exact: true }), line).toHaveCount(1); // UMG:181-215
      await captureEvidence(page, 'E08_users_matrix.png', { caption: `${String(expected.length)} cells checked against src/lib/auth/permissions.ts` });

      await page.keyboard.press('Escape');
      await expect(page.getByRole('dialog')).toHaveCount(0);
      await expect(opener).toBeFocused();
      await attachJson('E08_users_matrix.json', { cells: expected });
    });
  });

  test('E08 · SCR-37 [mocked response] GET /api/users 500 → "Không tải được danh sách người dùng" with "Thử lại"; retry reads again', async ({ browser }) => {
    await asAdminUi(browser, async ({ page }) => {
      let served = 0;
      const matcher = (url: URL): boolean => url.pathname === USERS;
      const fail = async (route: Route): Promise<void> => {
        if (route.request().method() !== 'GET') return route.fallback();
        served += 1;
        return route.fulfill({ status: 500, contentType: 'application/json', body: JSON.stringify({ detail: 'qa-e08 mocked 500' }) });
      };
      await page.route(matcher, fail);
      try {
        await page.goto(ROUTES.adminUsers);
        // UM:103-112 error alert; UUM:966-970 describeError → unknown for a 500 (I18N:61-64).
        await expect(page.getByText(USR.errorTitle, { exact: true })).toBeVisible({ timeout: ERROR_PAINT_TIMEOUT_MS });
        await expect(page.getByText(GENERIC_UNKNOWN, { exact: true })).toBeVisible();
        await captureEvidence(page, 'E08_users_500.png');

        await page.unroute(matcher, fail);
        const read = readOf(page, USERS);
        await page.getByRole('button', { name: USR.retry, exact: true }).click(); // UUM:1184-1186 invalidate
        await read;
        await expect(page.getByText(USR.errorTitle, { exact: true })).toHaveCount(0);
        await expect(page.locator('tbody tr').first().or(page.getByRole('button', { name: USR.invite, exact: true }).first())).toBeVisible();
        await captureEvidence(page, 'E08_users_500_retry.png');
        await attachJson('E08_users_500.json', { mockedResponses: served, status: 500, afterRetry: 200 });
      } finally {
        await page.unroute(matcher, fail).catch(() => undefined);
      }
    });
  });

  test('E08 · SCR-37 real engineer: forbidden reason + permission matrix only, no GET /api/users, "Về bảng điều khiển" → /', async ({ browser }) => {
    const engineer = await ensureEngineer();
    await signedIn(browser, engineer, async ({ page }) => {
      const reads = recordRequests(page, (req) => req.method() === 'GET' && pathnameOf(req.url()).startsWith(USERS));
      try {
        await page.goto(ROUTES.adminUsers);
        // UMG:245-253 canManageUsers false; UUM:536-540 list query disabled; UM:159-168 forbidden branch.
        await expect(page.getByText(USR.forbidden, { exact: true })).toBeVisible();
        await expect(page.getByText(USR.matrixTitle, { exact: true })).toBeVisible();
        await expect(page.getByText(cellSr('engineer', 'Quản lý người dùng', false), { exact: true })).toHaveCount(1);
        await expect(page.getByRole('button', { name: USR.invite, exact: true })).toHaveCount(0);
        await expect(page.getByLabel(USR.search, { exact: true })).toHaveCount(0);
        await page.waitForTimeout(QUIET_MS);
        expect(reads.list(), 'no GET /api/users* for an engineer').toEqual([]);
        await captureEvidence(page, 'E08_users_engineer_forbidden.png', { caption: 'engineer; GET /api/users requests: 0' });

        // UUM:1261 backLink → ROUTES.dashboard; UserManagement.container.tsx onNavigateBack (router navigate).
        await page.getByRole('link', { name: USR.backLabel, exact: true }).click();
        await expect.poll(() => pathOf(page.url())).toBe(ROUTES.dashboard);
        await dashboardLoaded(page);
        await captureEvidence(page, 'E08_users_engineer_back.png', { caption: `"${USR.backLabel}" → ${pathOf(page.url())}` });
        await attachJson('E08_users_engineer_forbidden.json', { usersReads: reads.list(), back: pathOf(page.url()) });
      } finally {
        reads.stop();
      }
    });
  });
});
