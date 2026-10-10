/**
 * Phase 2 — dedicated UI-verification cases (skill `qa-verify-ui`): one test per visible state of
 * SCR-05 (dashboard + create-project wizard), SCR-06 (notifications) and SCR-07 (onboarding), each at
 * 1440 / 1024 / 768 / 375 (`support/ui-verify.ts`), evidence `U02_<state>_<width>.png` + `U02_<state>.json`.
 * Reviewed by the "verify ui" step with the qa-review-ui checklist. Model: `phase01_auth_ui.spec.ts`.
 *
 * Budget — logins: 1 real admin API login (`signedInApi`, SCR-05 group), no browser login.
 * Writes (all on `qa-<runId>-u02-…` projects, all deleted by this file):
 *   - SCR-05 group setup: 1 `POST /api/projects` (80-char name) + 1 `DELETE` in `afterAll`;
 *   - `U02_dash_rename_toast`: 1 `POST` (API) + 4 `PATCH /api/projects/:id` (one rename per width, UI) + 1 `DELETE` (API);
 *   - `U02_dash_create_toast`: up to 4 `POST /api/projects` through the wizard (one per width) + as many `DELETE` (API);
 *     the create toast's "Hoàn tác" is never clicked;
 *   - `U02_wizard_server_422`: up to 4 `POST /api/projects` the server refuses with 422 (33-char "Mã dự án"): no write.
 * Nothing else is sent: the delete dialog is never confirmed, the 80-char rename field is left unchanged
 * (`commitRename` returns early, `useProjectDashboard.ts`), "Đánh dấu (tất cả) đã đọc" is never clicked.
 * Sessions: every screen reads Phase 1's admin storage state (`support/state.ts`); each test opens its OWN context
 * and writes the rotated refresh cookie back in `finally` (same chain as `phase01_auth_ui.spec.ts`), 4 loads per
 * test → 33 tests × 4 = 132 `POST /api/auth/refresh` over several minutes (`auth_refresh_total` 300 / 60 s per sid).
 *
 * Faked responses (5 of 33 states = 15 %, suite limit 35 %), each titled `[mocked response]` with its pair:
 *   - `U02_dash_load_error` (N1 500) and `U02_notif_load_error` (`GET /api/notifications` 500): unpairable, a 5xx
 *     cannot be produced on the shared stack;
 *   - `U02_dash_partial` (real N1 + one row the client cannot decode): unpairable, the BE never emits a row that
 *     fails the FE's strict decode;
 *   - `U02_dash_empty` and `U02_onboarding_no_project` (N1 `{ items: [] }`): PAIR NEEDED in
 *     `phase02_dashboard_api.spec.ts` — a user with no membership gets `GET /api/project-summaries` 200 `items: []`
 *     (the admin always has CP-2; listed in `coverage/.phase02-mainui.rows.md`).
 * `U02_dash_loading` is `[held response]`: the real N1, only delayed — not a mock.
 * Data-dependent: `U02_notif_empty` skips when the admin has notifications, `U02_notif_row_hover` when it has none.
 *
 * BUG-143: framer-motion entrances (Drawer, BottomSheet, Modal, toasts, onboarding cards) are JS transforms that
 * `animations: 'disabled'` does not stop, and `verifyUi` measures right after `open` returns — so every overlay
 * state ends with `settled(<overlay>)` (finite animations done, box + opacity still for 3 frames).
 * Non-serial: each test uses its own fresh context and page.
 *
 * Long data: one project named with exactly 80 characters (`PROJECT_NAME_MAX_LENGTH`, `src/domain/project/limits.ts:23`;
 * BE `NAME_MAX` 80, `apps/api/projects/schemas.py:26`) is created through the API before the SCR-05 group and
 * deleted after it; being the newest it is the hero card (sort "Cập nhật gần đây", `ProjectDashboard.tsx`).
 */
import {
  expect,
  test,
  type APIRequestContext,
  type Browser,
  type BrowserContext,
  type Locator,
  type Page,
  type Response,
  type Route,
} from '@playwright/test';

import { ROUTES } from '../../e2e/fixtures/routes';
import { readBaseUrl } from '../../e2e/fullstack/env';
import { signedInApi } from './support/api';
import { readAdminCredentials } from './support/auth';
import { TEST_DATA_PREFIX } from './support/evidence';
import { ADMIN_STORAGE_STATE_FILE } from './support/state';
import { verifyUi } from './support/ui-verify';

/* Copy — every string checked in src/ (file noted). */
const DASHBOARD_TITLE = 'Dự án của tôi'; // ProjectDashboard.tsx h1
const PROJECT_LIST = 'Danh sách dự án'; // ProjectDashboard.tsx renderProjectGrid
const SEARCH_LABEL = 'Tìm dự án'; // ProjectDashboard.tsx header Input
const NO_MATCH_TITLE = 'Không tìm thấy dự án phù hợp'; // ProjectDashboard.tsx EmptyState
const CLEAR_FILTERS = 'Xoá bộ lọc';
const VIEW_MODE = 'Kiểu xem';
const STATUS_FILTER_NARROW = 'Lọc theo trạng thái'; // ProjectDashboard.tsx, state 'collapsed' (< 1024 px)
const STATUS_QC = 'Cần QC'; // PROJECT_STATUS_FILTER_OPTIONS, useProjectDashboard.ts:76-81
const SORT_DEFAULT = 'Cập nhật gần đây'; // PROJECT_SORT_OPTIONS, useProjectDashboard.ts:83-88
const SORT_BY_NAME = 'Tên A–Z';
const CARD_MENU = 'Tuỳ chọn'; // components/canvas/ContextMenu.tsx:102
const DELETE_TITLE = 'Xoá dự án?'; // ProjectDashboard.tsx:331 Modal (A9)
const KEEP_PROJECT = 'Để nguyên';
const LIST_ERROR_TITLE = 'Không tải được danh sách dự án'; // ProjectDashboard.tsx:251-257
const RETRY = 'Thử lại'; // ProjectDashboard.tsx:256, NotificationCenter.tsx:60
const EMPTY_TITLE = 'Chưa có dự án nào'; // ProjectDashboard.tsx:258-268
const EMPTY_DESCRIPTION = 'Tạo dự án đầu tiên để bắt đầu số hoá bản vẽ.';
const EMPTY_ACTION = 'Tạo dự án mới';
const unreadRowsNotice = (count: number): string => `Có ${String(count)} dự án chưa đọc được`; // useProjectDashboard.ts:482
const renamedToast = (name: string): string => `Đã đổi tên thành "${name}"`; // useProjectDashboard.ts:424
const createdToast = (name: string): string => `Đã tạo dự án "${name}".`; // useCreateProjectModal.ts:668-673
const UNDO = 'Hoàn tác'; // components/feedback/Toast.tsx:143
const NARROW_MAX_WIDTH = 1023; // NARROW_VIEWPORT_QUERY, useProjectDashboard.ts:90
/* Wizard: CreateProjectModal.tsx, StepFloors.tsx, useCreateProjectModal.ts:684 (`Bước N / 3`). */
const WIZARD_TITLE = 'Tạo dự án mới';
const NEW_PROJECT = /^Dự án mới/u; // Button carries the `N` shortcut hint (phase02_dashboard.spec.ts openWizard)
const NAME_LABEL = 'Tên dự án';
const CODE_LABEL = 'Mã dự án'; // CreateProjectModal.tsx:110
const NAME_REQUIRED = 'Chưa nhập tên dự án.';
const NEXT = 'Tiếp tục';
const CANCEL = 'Huỷ';
const SHARED_HEIGHT_LABEL = 'Chiều cao áp cho mọi tầng'; // StepFloors.tsx:131
const APPLY_HEIGHT = 'Áp cho mọi tầng'; // StepFloors.tsx:145
const ADD_FLOOR = 'Thêm tầng'; // StepFloors.tsx:127
const DEFAULT_FLOORS = ['Tầng trệt', 'Tầng 1', 'Tầng 2', 'Tầng 3'] as const; // useCreateProjectModal.ts:82, :185-197
const HEIGHT_MISSING = 'Chưa nhập chiều cao thông thuỷ.'; // useCreateProjectModal.ts:113
const NUMERIC_MAX = 'Giá trị phải <= 10'; // useNumericField.ts:44, limits.ts:35
const NO_FLOORS = 'Chưa có tầng nào'; // StepFloors.tsx:61
const NO_FLOORS_HINT = 'Thêm ít nhất một tầng để sang bước xem lại.'; // StepFloors.tsx:62
const FLOOR_COUNT_MAX = 50; // limits.ts:27, useCreateProjectModal.ts:490
const VALIDATION_DESCRIPTION = 'Kiểm tra lại các trường được đánh dấu rồi thử lại.'; // src/i18n/vi.json:39 (errors.validation)
const CREATE_PROJECT = 'Tạo dự án';
const DISCARD_TITLE = 'Đóng và bỏ các thay đổi chưa lưu?'; // CreateProjectModal.tsx:252
const DISCARD_HINT = 'Nhấn Esc lần nữa, hoặc bấm nút bên cạnh, để xác nhận đóng.'; // CreateProjectModal.tsx:253
const DISCARD_CONFIRM = 'Đóng, bỏ thay đổi';
const FLOOR_HEIGHT_M = '3';
/* SCR-06: NotificationCenter.tsx:54-68, notificationModel.ts:114-118. */
const BELL = 'Thông báo';
const NOTIFICATION_FILTER = 'Lọc thông báo';
const FILTER_UNREAD = 'Chưa đọc';
const FILTER_MENTIONS = 'Nhắc đến tôi';
const MARK_READ = 'Đánh dấu đã đọc'; // NotificationCenter.tsx:56
const NOTIFICATIONS_EMPTY = 'Không có thông báo mới';
const NOTIFICATIONS_EMPTY_DESCRIPTION = 'Chúng tôi sẽ báo khi AI xử lý xong hoặc có người nhắc đến bạn.'; // NotificationCenter.tsx:65
const NOTIFICATIONS_PARTIAL = 'Có thể chưa cập nhật'; // NotificationCenter.tsx:66
const NOTIFICATIONS_ERROR = 'Không tải được thông báo';
/* SCR-07: useWelcomeScreen.ts:122-146, :164. */
const WELCOME_SEEN_PREFIX = 'appfront:onboarding-welcome-seen:';
const WELCOME_GREETING = /^Chào .+, bắt đầu trong ba bước$/u;
const WELCOME_STEPS = ['Tạo dự án', 'Tải bản vẽ theo từng tầng', 'Duyệt kết quả và dựng 3D'] as const;
const WELCOME_SKIP = 'Bỏ qua';
const WELCOME_CREATE = 'Tạo dự án'; // STRINGS.step1Action
const WELCOME_UPLOAD = 'Tải bản vẽ'; // STRINGS.step2Action
const WELCOME_UPLOAD_LOCKED = 'Cần tạo dự án trước.'; // STRINGS.step2Locked
const WELCOME_REVIEW = 'Duyệt kết quả'; // STRINGS.step3Action
const WELCOME_REVIEW_LOCKED = 'Cần tải bản vẽ trước.'; // STRINGS.step3Locked

/* Endpoints (src/api/endpoints.ts) and fakes. */
const SUMMARIES_PATH = '/api/project-summaries';
const NOTIFICATIONS_PATH = '/api/notifications';
const PROJECTS_PATH = '/api/projects';
/** `[held response]` delay: long enough for measure + 4 shots of one width, then the real N1 goes through. */
const HOLD_MS = 20_000;
/** Error states: the screens show them once react-query gives up (edge spec waits up to 45 s, `SLOW_STATE_MS`). */
const SLOW_STATE_MS = 45_000;
/**
 * `safeParseList` refuses the WHOLE list when more than 20 % of rows are bad (`MAX_INVALID_RATIO`,
 * src/api/schemas/decode.ts:7, :205-224): one bad row needs at least 4 readable ones next to it.
 */
const MIN_READABLE_ROWS = 4;
/** `projectIdSchema` alphabet (src/api/schemas/projectSummaries.ts:25). */
const PROJECT_ID_ALPHABET = '0123456789ABCDEFGHJKMNPQRSTVWXYZ';

const NAME_MAX_LENGTH = 80;
/** Exactly 80 chars, run-unique: `qa-<runId>-u02-<base36 time> ` + Vietnamese filler, never ending in a space. */
function longName(tag: string): string {
  const head = `${TEST_DATA_PREFIX}${tag}-${Date.now().toString(36)} `;
  const name = `${head}${'Khu phức hợp văn phòng Bình Minh '.repeat(4)}`.slice(0, NAME_MAX_LENGTH - 1);
  return `${name}A`;
}
const WIZARD_LONG_NAME = longName('u02-wizard'); // typed into the wizard only, never sent
if (WIZARD_LONG_NAME.length !== NAME_MAX_LENGTH) throw new Error(`WIZARD_LONG_NAME is ${WIZARD_LONG_NAME.length} chars`);
/** 80-char term no project can match (testDataPrefix + a random tail), as phase01's NO_MATCH_TERM. */
const NO_MATCH_TERM = longName('u02-khong-co-du-an');
const shortName = (slug: string): string => `${TEST_DATA_PREFIX}${slug}-${Date.now().toString(36)}`;

/* Locators. */
const dashboardHeading = (page: Page): Locator => page.getByRole('heading', { name: DASHBOARD_TITLE, exact: true });
const projectCard = (page: Page, name: string): Locator =>
  page.getByRole('list', { name: PROJECT_LIST, exact: true }).getByRole('listitem', { name, exact: true });
const wizard = (page: Page): Locator => page.getByRole('dialog', { name: WIZARD_TITLE, exact: true });
const bell = (page: Page): Locator => page.getByRole('button', { name: BELL, exact: true });
const drawer = (page: Page): Locator => page.getByRole('dialog', { name: BELL, exact: true });
const toastWith = (page: Page, text: string): Locator => page.getByRole('status').filter({ hasText: text }); // Toast.tsx:117
/** `DashboardSidebar.tsx`: label + count inside one `aria-pressed` button (as phase02_dashboard.spec.ts). */
const sidebarFilter = (page: Page, label: string): Locator =>
  page.getByRole('button', { name: new RegExp(`^${label}\\s*\\d+$`, 'u') });
const isNarrow = (page: Page): boolean => (page.viewportSize()?.width ?? 1440) <= NARROW_MAX_WIDTH;
const pathnameOf = (response: Response): string => new URL(response.url()).pathname;

/** Own context from the admin storage state; the rotated refresh cookie goes back to the file (phase01 chain). */
async function verifyAsAdmin(
  browser: Browser,
  name: string,
  open: (page: Page) => Promise<void>,
  prepare?: (context: BrowserContext) => Promise<void>,
): Promise<void> {
  const context = await browser.newContext({ baseURL: readBaseUrl(), storageState: ADMIN_STORAGE_STATE_FILE });
  try {
    await prepare?.(context);
    await verifyUi(await context.newPage(), name, open);
  } finally {
    await context.storageState({ path: ADMIN_STORAGE_STATE_FILE });
    await context.close();
  }
}

/**
 * BUG-143: Drawer / BottomSheet / Modal / onboarding cards enter with framer-motion (JS transforms,
 * `components/overlay/Drawer.tsx`, `Modal.tsx:109-135`), toasts with a CSS keyframe (`Toast.tsx:121`). Waits for
 * the finite animations under `target`, then for its box and opacity to hold still for 3 frames, so the layout is
 * measured (and shot) where it comes to rest, not mid-slide.
 */
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

async function openDashboard(page: Page): Promise<void> {
  await page.goto(ROUTES.dashboard);
  await expect(dashboardHeading(page)).toBeVisible({ timeout: 15_000 });
  await expect(page.getByRole('searchbox', { name: SEARCH_LABEL, exact: true })).toBeVisible();
}

async function openWizard(page: Page): Promise<Locator> {
  await openDashboard(page);
  await page.getByRole('button', { name: NEW_PROJECT }).click();
  const dialog = wizard(page);
  await expect(dialog).toBeVisible();
  return dialog;
}

/** `Bước N / 3` is printed twice (visible `<p>` + sr-only status); the first is the visible one. */
const stepLabel = (dialog: Locator, step: number): Locator => dialog.getByText(`Bước ${String(step)} / 3`, { exact: true }).first();

/** Step 1 → step 2 with `name`. */
async function toStep2(dialog: Locator, name: string): Promise<void> {
  await dialog.getByLabel(NAME_LABEL).fill(name);
  await dialog.getByRole('button', { name: NEXT, exact: true }).click();
  await expect(stepLabel(dialog, 2)).toBeVisible();
}

/** Shared height, blurred (useNumericField.ts:105-111 commits on blur), applied to every row (useCreateProjectModal.ts:590-594). */
async function applySharedHeight(dialog: Locator): Promise<void> {
  const field = dialog.getByLabel(SHARED_HEIGHT_LABEL);
  await field.fill(FLOOR_HEIGHT_M);
  await field.press('Tab');
  await dialog.getByRole('button', { name: APPLY_HEIGHT, exact: true }).click();
}

/** Notification drawer settled: a day group, the empty / no-match state, or the error state (NotificationCenter.tsx). */
async function expectDrawerSettled(page: Page): Promise<void> {
  const panel = drawer(page);
  await expect(panel).toBeVisible();
  await expect(
    panel
      .locator('section')
      .first()
      .or(panel.getByText(NOTIFICATIONS_EMPTY, { exact: true }))
      .or(panel.getByText(NOTIFICATIONS_PARTIAL, { exact: true }))
      .or(panel.getByText(NOTIFICATIONS_ERROR, { exact: true }))
      .first(),
  ).toBeVisible({ timeout: 15_000 });
}

async function openBellDrawer(page: Page): Promise<Locator> {
  await openDashboard(page);
  await bell(page).click();
  await expectDrawerSettled(page);
  return drawer(page);
}

/**
 * `WelcomeRoute` reads the seen flag once at mount and the screen writes it on `success`
 * (WelcomeScreen.container.tsx:139-140, useWelcomeScreen.ts:294-297), so it is cleared before EVERY load.
 */
const clearSeenFlagsOnLoad = (context: BrowserContext): Promise<void> =>
  context.addInitScript((prefix) => {
    try {
      for (const key of Object.keys(window.localStorage)) {
        if (key.startsWith(prefix)) window.localStorage.removeItem(key);
      }
    } catch {
      // about:blank has no storage; nothing to clear there.
    }
  }, WELCOME_SEEN_PREFIX);

const routeSummaries = (context: BrowserContext, handler: (route: Route) => Promise<void>): Promise<void> =>
  context.route((url) => url.pathname === SUMMARIES_PATH, handler);

/** `CursorEnvelopeSchema` (src/api/schemas/common.ts:65-70): `items` + optional `nextCursor`. */
const fulfillNoProject = (route: Route): Promise<void> =>
  route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ items: [] }) });

/** Onboarding cards came in (staggered motion.li, WelcomeScreen.tsx:204-207). */
async function expectWelcomeCards(page: Page): Promise<void> {
  await expect(page.getByRole('heading', { level: 1 })).toHaveText(WELCOME_GREETING, { timeout: 15_000 });
  for (const title of WELCOME_STEPS) {
    await expect(page.getByRole('heading', { level: 2, name: title, exact: true })).toBeVisible();
  }
  await settled(page.getByRole('listitem').last());
}

test.describe('U02 UI verify — SCR-05 dashboard (with an 80-character project this file creates)', () => {
  let admin: APIRequestContext | undefined;
  let project: { id: string; name: string } | undefined;

  test.beforeAll(async () => {
    const { email, password } = readAdminCredentials();
    admin = await signedInApi(email, password);
    const requested = longName('u02');
    expect(requested.length).toBe(NAME_MAX_LENGTH);
    const res = await admin.post(PROJECTS_PATH, { data: { name: requested } });
    expect(res.status(), 'setup: POST /api/projects').toBe(201);
    const body = (await res.json()) as { id?: unknown; name?: unknown };
    // Recorded BEFORE the checks below, so `afterAll` deletes it even if one fails (phase01 review-1).
    if (typeof body.id === 'string') project = { id: body.id, name: typeof body.name === 'string' ? body.name : requested };
    expect(body.name, 'setup: the server kept the 80-char name').toBe(requested);
  });

  test.afterAll(async () => {
    try {
      if (admin && project) {
        const res = await admin.delete(`${PROJECTS_PATH}/${project.id}`);
        if (res.status() !== 200) test.info().annotations.push({ type: 'cleanup', description: `DELETE project → ${res.status()}` });
      }
    } catch (error) {
      test.info().annotations.push({ type: 'cleanup', description: String(error) });
    } finally {
      await admin?.dispose();
    }
  });

  const longProject = (): { id: string; name: string } => {
    if (!project) throw new Error('setup: the long-name project was not created');
    return project;
  };
  const adminApi = (): APIRequestContext => {
    if (!admin) throw new Error('setup: no signed-in API client');
    return admin;
  };
  /** Deletes this file's own projects; a failure is an annotation, never a second error over the test's own. */
  async function deleteProjects(ids: readonly string[]): Promise<void> {
    for (const id of ids) {
      try {
        const res = await adminApi().delete(`${PROJECTS_PATH}/${id}`);
        if (res.status() !== 200) test.info().annotations.push({ type: 'cleanup', description: `DELETE ${id} → ${res.status()}` });
      } catch (error) {
        test.info().annotations.push({ type: 'cleanup', description: `DELETE ${id}: ${String(error)}` });
      }
    }
  }

  async function openWithLongProject(page: Page): Promise<void> {
    await openDashboard(page);
    await expect(projectCard(page, longProject().name)).toBeVisible();
  }

  test('U02 · SCR-05 dashboard loaded, hero card with an 80-char name (long data)', async ({ browser }) => {
    await verifyAsAdmin(browser, 'U02_dash_loaded', openWithLongProject);
  });

  test('U02 · SCR-05 table view ("Kiểu xem" = "Bảng")', async ({ browser }) => {
    await verifyAsAdmin(browser, 'U02_dash_table', async (p) => {
      await openWithLongProject(p);
      const table = p.getByRole('radiogroup', { name: VIEW_MODE, exact: true }).getByRole('radio', { name: 'Bảng', exact: true });
      await table.click();
      await expect(table).toHaveAttribute('aria-checked', 'true');
      // BUG-139: PW 1.45.2 maps a `<th>` without `scope` (components/ui/Table.tsx:167) to role "cell",
      // so getByRole('columnheader') finds nothing; the first header cell is read from the markup.
      await expect(p.getByRole('main').locator('thead th').first()).toHaveText(NAME_LABEL);
      await expect(p.getByRole('main').locator('tbody tr').filter({ hasText: longProject().name })).toBeVisible();
    });
  });

  test('U02 · SCR-05 sort list open', async ({ browser }) => {
    await verifyAsAdmin(browser, 'U02_dash_sort_open', async (p) => {
      await openWithLongProject(p);
      await p.getByRole('combobox').filter({ hasText: SORT_DEFAULT }).click();
      await expect(p.getByRole('option', { name: SORT_BY_NAME, exact: true })).toBeVisible();
      await settled(p.getByRole('listbox'));
    });
  });

  test('U02 · SCR-05 status filter "Cần QC" (sidebar ≥1024, segmented control <1024)', async ({ browser }) => {
    await verifyAsAdmin(browser, 'U02_dash_status_filter', async (p) => {
      await openWithLongProject(p);
      if (isNarrow(p)) {
        const radio = p
          .getByRole('radiogroup', { name: STATUS_FILTER_NARROW, exact: true })
          .getByRole('radio', { name: STATUS_QC, exact: true });
        await radio.click();
        await expect(radio).toHaveAttribute('aria-checked', 'true');
      } else {
        const button = sidebarFilter(p, STATUS_QC);
        await button.click();
        await expect(button).toHaveAttribute('aria-pressed', 'true');
      }
      // Either the matching cards or the no-match state, depending on the run's projects. Below 1024 px a filter with
      // no match shows "Chưa có dự án nào" instead (BUG-111, useProjectDashboard.ts:362-369 `collapsed` beats `partial`):
      // that width then records an openError — the product bug, not this case.
      await expect(
        p.getByRole('list', { name: PROJECT_LIST, exact: true }).or(p.getByText(NO_MATCH_TITLE, { exact: true })).first(),
      ).toBeVisible();
    });
  });

  test('U02 · SCR-05 search with no match (80-char term)', async ({ browser }) => {
    await verifyAsAdmin(browser, 'U02_dash_search_no_match', async (p) => {
      await openWithLongProject(p);
      await p.getByRole('searchbox', { name: SEARCH_LABEL, exact: true }).fill(NO_MATCH_TERM);
      // < 1024 px: BUG-111 ("Chưa có dự án nào" instead of the no-match state) → openError at 768/375.
      await expect(p.getByText(NO_MATCH_TITLE, { exact: true })).toBeVisible();
      await expect(p.getByRole('button', { name: CLEAR_FILTERS, exact: true })).toBeVisible();
    });
  });

  test('U02 · SCR-05 card menu open (Mở / Đổi tên / Xoá)', async ({ browser }) => {
    await verifyAsAdmin(browser, 'U02_dash_card_menu', async (p) => {
      await openWithLongProject(p);
      await p.getByRole('button', { name: `Tuỳ chọn cho ${longProject().name}`, exact: true }).click();
      const menu = p.getByRole('menu', { name: CARD_MENU, exact: true });
      await expect(menu).toBeVisible();
      await expect(menu.getByRole('menuitem', { name: 'Xoá', exact: true })).toBeVisible();
      await settled(menu);
    });
  });

  test('U02 · SCR-05 rename field open on the 80-char card (left unchanged, no PATCH)', async ({ browser }) => {
    await verifyAsAdmin(browser, 'U02_dash_rename_field', async (p) => {
      await openWithLongProject(p);
      const { name } = longProject();
      await p.getByRole('button', { name: `Tuỳ chọn cho ${name}`, exact: true }).click();
      await p.getByRole('menu', { name: CARD_MENU, exact: true }).getByRole('menuitem', { name: 'Đổi tên', exact: true }).click();
      await expect(p.getByRole('textbox', { name: `Đổi tên ${name}`, exact: true })).toHaveValue(name);
    });
  });

  test('U02 · SCR-05 delete confirmation dialog (A9, never confirmed)', async ({ browser }) => {
    await verifyAsAdmin(browser, 'U02_dash_delete_confirm', async (p) => {
      await openWithLongProject(p);
      const { name } = longProject();
      await p.getByRole('button', { name: `Tuỳ chọn cho ${name}`, exact: true }).click();
      await p.getByRole('menu', { name: CARD_MENU, exact: true }).getByRole('menuitem', { name: 'Xoá', exact: true }).click();
      const dialog = p.getByRole('dialog', { name: DELETE_TITLE, exact: true });
      await expect(dialog).toBeVisible();
      await expect(dialog.getByText(name, { exact: false })).toBeVisible();
      await expect(dialog.getByRole('button', { name: KEEP_PROJECT, exact: true })).toBeVisible();
      await settled(dialog);
    });
  });

  test('U02 · SCR-05 [held response] loading: skeleton cards while N1 is held', async ({ browser }) => {
    await verifyAsAdmin(browser, 'U02_dash_loading', async (p) => {
      // A fresh hold per width: the real N1 goes through after HOLD_MS (never answered by the test).
      await p.unrouteAll({ behavior: 'ignoreErrors' });
      await p.route((url) => url.pathname === SUMMARIES_PATH, async (route) => {
        await new Promise((resolve) => setTimeout(resolve, HOLD_MS));
        await route.continue().catch(() => undefined);
      });
      await p.goto(ROUTES.dashboard);
      await expect(dashboardHeading(p)).toBeVisible({ timeout: 15_000 });
      await expect(p.locator('main .animate-pulse').first()).toBeVisible(); // ProjectDashboard.tsx:245-250
      await expect(p.getByText(/^\d+ dự án$/u)).toHaveCount(0); // no count line while loading (ProjectDashboard.tsx:199)
    });
  });

  test('U02 · SCR-05 [mocked response] N1 fails (500): "Không tải được danh sách dự án" + "Thử lại"', async ({ browser }) => {
    test.setTimeout(300_000);
    // unpairable: a 5xx on GET /api/project-summaries cannot be produced on the shared stack.
    await verifyAsAdmin(
      browser,
      'U02_dash_load_error',
      async (p) => {
        await p.goto(ROUTES.dashboard);
        await expect(p.getByText(LIST_ERROR_TITLE, { exact: true })).toBeVisible({ timeout: SLOW_STATE_MS });
        await expect(p.getByRole('button', { name: RETRY, exact: true })).toBeVisible();
      },
      (context) => routeSummaries(context, (route) => route.fulfill({ status: 500, contentType: 'application/json', body: '{}' })),
    );
  });

  test('U02 · SCR-05 [mocked response] no project: "Chưa có dự án nào" + "Tạo dự án mới"', async ({ browser }) => {
    // pair needed: phase02_dashboard_api.spec.ts — a user with no membership gets N1 200 `items: []` (see file header).
    await verifyAsAdmin(
      browser,
      'U02_dash_empty',
      async (p) => {
        await p.goto(ROUTES.dashboard);
        await expect(p.getByText(EMPTY_TITLE, { exact: true })).toBeVisible({ timeout: 15_000 });
        await expect(p.getByText(EMPTY_DESCRIPTION, { exact: true })).toBeVisible(); // canCreate (admin)
        await expect(p.getByRole('button', { name: EMPTY_ACTION, exact: true })).toBeVisible();
      },
      (context) => routeSummaries(context, fulfillNoProject),
    );
  });

  test('U02 · SCR-05 [mocked response] one unreadable row: "Có 1 dự án chưa đọc được" over the readable cards', async ({ browser }) => {
    // unpairable: the BE never emits a row that fails the FE's strict decode (projectSummaries.ts `.strict()`, id regex).
    await verifyAsAdmin(
      browser,
      'U02_dash_partial',
      async (p) => {
        await p.goto(ROUTES.dashboard);
        await expect(p.getByText(unreadRowsNotice(1), { exact: true })).toBeVisible({ timeout: 15_000 }); // useProjectDashboard.ts:482
        await expect(p.getByRole('list', { name: PROJECT_LIST, exact: true })).toBeVisible(); // A11: one bad row never locks the rest
      },
      (context) =>
        routeSummaries(context, async (route) => {
          const real = await route.fetch();
          const body = (await real.json()) as Record<string, unknown>;
          const items = (Array.isArray(body.items) ? body.items : []) as Record<string, unknown>[];
          const first = items[0];
          if (first === undefined) throw new Error('N1 has no project to copy (the long-name project should exist)');
          // Readable fillers (valid ids, `qa-…-u02-mau-N` names) so the one bad row stays under 20 % (decode.ts:205-224).
          const fillers = Array.from({ length: Math.max(0, MIN_READABLE_ROWS - items.length) }, (_unused, index) => ({
            ...first,
            id: `prj_${'Z'.repeat(25)}${PROJECT_ID_ALPHABET[index] ?? '0'}`,
            name: `${TEST_DATA_PREFIX}u02-mau-${String(index + 1)}`,
          }));
          const broken = { ...first, id: 'not-a-project-id' }; // fails /^prj_[0-9A-HJKMNP-TV-Z]{26}$/ (projectSummaries.ts:25)
          // BUG-142: explicit status/type/body — never the real response's content-length.
          await route.fulfill({
            status: 200,
            contentType: 'application/json',
            body: JSON.stringify({ ...body, items: [...items, ...fillers, broken] }),
          });
        }),
    );
  });

  test('U02 · SCR-05 rename toast with "Hoàn tác" (real PATCH on this file\'s own project, never undone)', async ({ browser }) => {
    const base = shortName('u02-ren');
    const res = await adminApi().post(PROJECTS_PATH, { data: { name: base } });
    expect(res.status(), 'setup: POST /api/projects').toBe(201);
    const id = ((await res.json()) as { id?: unknown }).id;
    if (typeof id !== 'string') throw new Error('setup: POST /api/projects returned no id');
    let current = base;
    try {
      await verifyAsAdmin(browser, 'U02_dash_rename_toast', async (p) => {
        await openDashboard(p);
        await expect(projectCard(p, current)).toBeVisible();
        const next = current === base ? `${base}-R` : base;
        await p.getByRole('button', { name: `Tuỳ chọn cho ${current}`, exact: true }).click();
        await p.getByRole('menu', { name: CARD_MENU, exact: true }).getByRole('menuitem', { name: 'Đổi tên', exact: true }).click();
        const input = p.getByRole('textbox', { name: `Đổi tên ${current}`, exact: true });
        await input.fill(next);
        const patched = p.waitForResponse((r) => r.request().method() === 'PATCH' && pathnameOf(r) === `${PROJECTS_PATH}/${id}`);
        await input.press('Enter'); // useProjectDashboard.ts commitRename → renameTo
        expect((await patched).status(), 'PATCH /api/projects/:id').toBe(200);
        current = next;
        const toast = toastWith(p, renamedToast(next));
        await expect(toast.getByRole('button', { name: UNDO, exact: true })).toBeVisible();
        await settled(toast);
      });
    } finally {
      await deleteProjects([id]);
    }
  });

  test('U02 · SCR-05 create toast "Đã tạo dự án …" with "Hoàn tác" (real wizard POST per width, deleted after)', async ({ browser }) => {
    test.setTimeout(300_000);
    const created: string[] = [];
    try {
      await verifyAsAdmin(browser, 'U02_dash_create_toast', async (p) => {
        const name = shortName('u02-tao');
        const dialog = await openWizard(p);
        await toStep2(dialog, name);
        await applySharedHeight(dialog);
        await dialog.getByRole('button', { name: NEXT, exact: true }).click();
        await expect(stepLabel(dialog, 3)).toBeVisible();
        const posted = p.waitForResponse((r) => r.request().method() === 'POST' && pathnameOf(r) === PROJECTS_PATH);
        await dialog.getByRole('button', { name: CREATE_PROJECT, exact: true }).click();
        const response = await posted;
        const body = (await response.json().catch(() => ({}))) as { id?: unknown };
        if (typeof body.id === 'string') created.push(body.id); // before the checks: cleanup never misses one
        expect([200, 201], 'POST /api/projects').toContain(response.status());
        await expect(dialog).toHaveCount(0);
        const toast = toastWith(p, createdToast(name));
        await expect(toast.getByRole('button', { name: UNDO, exact: true })).toBeVisible(); // never clicked
        await settled(toast);
      });
    } finally {
      await deleteProjects(created);
    }
  });
});

test.describe('U02 UI verify — SCR-05 create-project wizard (never sent, except the 422 state)', () => {
  test('U02 · SCR-05 wizard step 1, empty name → "Chưa nhập tên dự án."', async ({ browser }) => {
    await verifyAsAdmin(browser, 'U02_wizard_name_required', async (p) => {
      const dialog = await openWizard(p);
      // Pristine step 1 already shows the complaint and locks "Tiếp tục" (phase02_dashboard.spec.ts validation case).
      await expect(dialog.getByRole('alert').filter({ hasText: NAME_REQUIRED })).toBeVisible();
      await expect(dialog.getByRole('button', { name: NEXT, exact: true })).toBeDisabled();
      await settled(dialog);
    });
  });

  test('U02 · SCR-05 wizard step 2, four default floors', async ({ browser }) => {
    await verifyAsAdmin(browser, 'U02_wizard_floors', async (p) => {
      const dialog = await openWizard(p);
      await toStep2(dialog, `${TEST_DATA_PREFIX}u02-wizard`);
      await expect(dialog.getByLabel(SHARED_HEIGHT_LABEL)).toBeVisible();
      await settled(dialog);
    });
  });

  test('U02 · SCR-05 wizard step 2 validation: shared height "10,01" → "Giá trị phải <= 10", rows "Chưa nhập chiều cao thông thuỷ."', async ({ browser }) => {
    await verifyAsAdmin(browser, 'U02_wizard_height_refused', async (p) => {
      const dialog = await openWizard(p);
      await toStep2(dialog, `${TEST_DATA_PREFIX}u02-cao`);
      const field = dialog.getByLabel(SHARED_HEIGHT_LABEL);
      await field.fill('10,01');
      await field.press('Tab'); // useNumericField.ts:41-46 refuses out of range on blur
      await expect(dialog.getByText(NUMERIC_MAX, { exact: true })).toBeVisible();
      await expect(dialog.getByRole('alert').filter({ hasText: HEIGHT_MISSING }).first()).toBeVisible(); // useCreateProjectModal.ts:239-243
      await expect(dialog.getByRole('button', { name: APPLY_HEIGHT, exact: true })).toBeDisabled(); // useCreateProjectModal.ts:491
      await settled(dialog);
    });
  });

  test('U02 · SCR-05 wizard step 2 with every floor removed → "Chưa có tầng nào"', async ({ browser }) => {
    await verifyAsAdmin(browser, 'U02_wizard_no_floors', async (p) => {
      const dialog = await openWizard(p);
      await toStep2(dialog, `${TEST_DATA_PREFIX}u02-rong`);
      for (const floor of DEFAULT_FLOORS) {
        await dialog.getByRole('button', { name: `Xoá ${floor}`, exact: true }).click(); // StepFloors.tsx:107-114
      }
      await expect(dialog.getByText(NO_FLOORS, { exact: true })).toBeVisible(); // StepFloors.tsx:58-64
      await expect(dialog.getByText(NO_FLOORS_HINT, { exact: true })).toBeVisible();
      await expect(dialog.getByRole('button', { name: NEXT, exact: true })).toBeDisabled(); // useCreateProjectModal.ts:487
      await settled(dialog);
    });
  });

  test('U02 · SCR-05 wizard floor cap: 50 floors, "Thêm tầng" disabled (long list)', async ({ browser }) => {
    test.setTimeout(480_000);
    await verifyAsAdmin(browser, 'U02_wizard_floor_cap', async (p) => {
      const dialog = await openWizard(p);
      await toStep2(dialog, `${TEST_DATA_PREFIX}u02-50-tang`);
      const add = dialog.getByRole('button', { name: ADD_FLOOR, exact: true });
      for (let floors = DEFAULT_FLOORS.length; floors < FLOOR_COUNT_MAX; floors += 1) await add.click();
      await expect(dialog.getByRole('textbox', { name: /^Tên tầng /u })).toHaveCount(FLOOR_COUNT_MAX); // StepFloors.tsx:87-92
      await expect(add).toBeDisabled(); // useCreateProjectModal.ts:490, StepFloors.tsx:125
      await settled(dialog);
    });
  });

  test('U02 · SCR-05 wizard step 3 review with an 80-char name (long data, "Tạo dự án" never clicked)', async ({ browser }) => {
    await verifyAsAdmin(browser, 'U02_wizard_review_long_name', async (p) => {
      const dialog = await openWizard(p);
      await toStep2(dialog, WIZARD_LONG_NAME);
      await applySharedHeight(dialog);
      await dialog.getByRole('button', { name: NEXT, exact: true }).click();
      await expect(stepLabel(dialog, 3)).toBeVisible();
      await expect(dialog.getByText(WIZARD_LONG_NAME, { exact: true })).toBeVisible();
      await expect(dialog.getByRole('button', { name: CREATE_PROJECT, exact: true })).toBeVisible();
      await settled(dialog);
    });
  });

  test('U02 · SCR-05 wizard server 422 (33-char "Mã dự án"): violation notice, "Tạo dự án" locked', async ({ browser }) => {
    test.setTimeout(240_000);
    await verifyAsAdmin(browser, 'U02_wizard_server_422', async (p) => {
      // FE puts no cap on the code (CreateProjectModal.tsx:109-115); BE caps it at 32 (BE apps/api/projects/schemas.py:27,52).
      const dialog = await openWizard(p);
      await dialog.getByLabel(NAME_LABEL).fill(shortName('u02-422'));
      await dialog.getByLabel(CODE_LABEL).fill('C'.repeat(33));
      await dialog.getByRole('button', { name: NEXT, exact: true }).click();
      await expect(stepLabel(dialog, 2)).toBeVisible();
      await applySharedHeight(dialog);
      await dialog.getByRole('button', { name: NEXT, exact: true }).click();
      await expect(stepLabel(dialog, 3)).toBeVisible();
      const refused = p.waitForResponse((r) => r.request().method() === 'POST' && pathnameOf(r) === PROJECTS_PATH);
      await dialog.getByRole('button', { name: CREATE_PROJECT, exact: true }).click();
      expect((await refused).status(), 'POST /api/projects with a 33-char code').toBe(422);
      // useCreateProjectModal.ts:658-663: describeError(validation) → violation notice; submit locked.
      await expect(dialog.getByText(VALIDATION_DESCRIPTION, { exact: true }).first()).toBeVisible();
      await expect(dialog.getByRole('button', { name: CREATE_PROJECT, exact: true })).toBeDisabled();
      await settled(dialog);
    });
  });

  test('U02 · SCR-05 wizard dirty → "Huỷ" → discard prompt (not confirmed)', async ({ browser }) => {
    await verifyAsAdmin(browser, 'U02_wizard_discard', async (p) => {
      const dialog = await openWizard(p);
      await dialog.getByLabel(NAME_LABEL).fill(`${TEST_DATA_PREFIX}u02-discard`);
      await dialog.getByRole('button', { name: CANCEL, exact: true }).click();
      await expect(dialog.getByText(DISCARD_TITLE, { exact: true })).toBeVisible();
      await expect(dialog.getByRole('button', { name: DISCARD_CONFIRM, exact: true })).toBeVisible();
      await settled(dialog);
    });
  });

  test('U02 · SCR-05 wizard dirty → Esc → discard prompt with the "Nhấn Esc lần nữa…" hint (not confirmed)', async ({ browser }) => {
    await verifyAsAdmin(browser, 'U02_wizard_discard_esc', async (p) => {
      const dialog = await openWizard(p);
      await dialog.getByLabel(NAME_LABEL).fill(`${TEST_DATA_PREFIX}u02-esc`);
      await p.keyboard.press('Escape'); // dirty → warn (useCreateProjectModal.ts:618-639)
      await expect(dialog.getByText(DISCARD_TITLE, { exact: true })).toBeVisible();
      await expect(dialog.getByText(DISCARD_HINT, { exact: true })).toBeVisible();
      await settled(dialog);
    });
  });
});

test.describe('U02 UI verify — SCR-06 notifications', () => {
  test('U02 · SCR-06 bell → drawer "Thông báo"', async ({ browser }) => {
    await verifyAsAdmin(browser, 'U02_notif_drawer', async (p) => {
      const panel = await openBellDrawer(p);
      await expect(panel.getByRole('radiogroup', { name: NOTIFICATION_FILTER, exact: true })).toBeVisible();
      await settled(panel);
    });
  });

  test('U02 · SCR-06 drawer filter "Chưa đọc"', async ({ browser }) => {
    await verifyAsAdmin(browser, 'U02_notif_filter_unread', async (p) => {
      const panel = await openBellDrawer(p);
      // Client-side filter (useNotificationCenter.ts matchesFilter): no request, no write.
      const unread = panel
        .getByRole('radiogroup', { name: NOTIFICATION_FILTER, exact: true })
        .getByRole('radio', { name: FILTER_UNREAD, exact: true });
      await unread.click();
      await expect(unread).toHaveAttribute('aria-checked', 'true');
      await expectDrawerSettled(p);
      await settled(panel);
    });
  });

  test('U02 · SCR-06 drawer filter "Nhắc đến tôi" (no match → "Có thể chưa cập nhật", or empty)', async ({ browser }) => {
    await verifyAsAdmin(browser, 'U02_notif_filter_mentions', async (p) => {
      const panel = await openBellDrawer(p);
      const mentions = panel
        .getByRole('radiogroup', { name: NOTIFICATION_FILTER, exact: true })
        .getByRole('radio', { name: FILTER_MENTIONS, exact: true }); // notificationModel.ts:114-118
      await mentions.click();
      await expect(mentions).toHaveAttribute('aria-checked', 'true');
      await expectDrawerSettled(p); // useNotificationCenter.ts:877-883: empty beats the filter, else "partial"
      await settled(panel);
    });
  });

  test('U02 · SCR-06 drawer empty: "Không có thông báo mới" (skips when the admin has notifications)', async ({ browser }) => {
    await verifyAsAdmin(browser, 'U02_notif_empty', async (p) => {
      const panel = await openBellDrawer(p);
      const rows = await panel.locator('li').count();
      test.skip(rows > 0, `data: the admin has ${String(rows)} notification(s); the empty state needs none (useNotificationCenter.ts:877-879)`);
      await expect(panel.getByText(NOTIFICATIONS_EMPTY, { exact: true })).toBeVisible();
      await expect(panel.getByText(NOTIFICATIONS_EMPTY_DESCRIPTION, { exact: true })).toBeVisible();
      await settled(panel);
    });
  });

  test('U02 · SCR-06 notification row hovered: row actions shown (skips when the admin has none)', async ({ browser }) => {
    await verifyAsAdmin(browser, 'U02_notif_row_hover', async (p) => {
      const panel = await openBellDrawer(p);
      const rows = panel.locator('li');
      const total = await rows.count();
      test.skip(total === 0, 'data: the admin has no notification yet (they come from the pipeline, Phase 3)');
      await settled(panel);
      const row = rows.first();
      await row.hover();
      // Unread rows reveal "Đánh dấu đã đọc" on hover (NotificationCenter.tsx:187-198, group-hover:opacity-100).
      const markRead = row.getByRole('button', { name: MARK_READ, exact: true });
      if ((await markRead.count()) > 0) await expect(markRead).toBeVisible();
      await settled(row);
    });
  });

  test('U02 · SCR-06 [mocked response] list read fails (500): "Không tải được thông báo" + "Thử lại"', async ({ browser }) => {
    test.setTimeout(300_000);
    // unpairable: a 5xx on GET /api/notifications cannot be produced on the shared stack.
    await verifyAsAdmin(
      browser,
      'U02_notif_load_error',
      async (p) => {
        await openDashboard(p);
        await bell(p).click();
        const panel = drawer(p);
        await expect(panel.getByText(NOTIFICATIONS_ERROR, { exact: true })).toBeVisible({ timeout: SLOW_STATE_MS }); // NotificationCenter.tsx:245-253
        await expect(panel.getByRole('button', { name: RETRY, exact: true })).toBeVisible();
        await settled(panel);
      },
      (context) =>
        context.route(
          (url) => url.pathname === NOTIFICATIONS_PATH,
          (route) =>
            route.request().method() === 'GET'
              ? route.fulfill({ status: 500, contentType: 'application/json', body: '{}' })
              : route.fallback(),
        ),
    );
  });

  test('U02 · SCR-06 /thong-bao full-screen notification center', async ({ browser }) => {
    await verifyAsAdmin(browser, 'U02_notif_route', async (p) => {
      await p.goto(ROUTES.notifications);
      await expectDrawerSettled(p);
      await expect(p.getByRole('heading', { name: BELL, exact: true })).toBeVisible();
      await settled(drawer(p)); // BUG-143: measured mid-slide in run-11 ("Nhắc đến tôi", "Xem tất cả" off-screen)
    });
  });
});

test.describe('U02 UI verify — SCR-07 onboarding', () => {
  test('U02 · SCR-07 /onboarding with the seen flag cleared → three steps', async ({ browser }) => {
    await verifyAsAdmin(
      browser,
      'U02_onboarding_steps',
      async (p) => {
        await p.goto(ROUTES.onboarding);
        await expectWelcomeCards(p);
        await expect(p.getByRole('button', { name: WELCOME_SKIP, exact: true })).toBeVisible();
      },
      clearSeenFlagsOnLoad,
    );
  });

  test('U02 · SCR-07 card 1 "Tạo dự án" → create dialog on /onboarding', async ({ browser }) => {
    await verifyAsAdmin(
      browser,
      'U02_onboarding_create_dialog',
      async (p) => {
        await p.goto(ROUTES.onboarding);
        await expectWelcomeCards(p);
        await p.getByRole('button', { name: WELCOME_CREATE, exact: true }).click(); // useWelcomeScreen.ts:317-323 → WelcomeScreen.container.tsx:82-103
        const dialog = wizard(p);
        await expect(stepLabel(dialog, 1)).toBeVisible();
        await settled(dialog);
      },
      clearSeenFlagsOnLoad,
    );
  });

  test('U02 · SCR-07 [mocked response] no project: card 1 open, cards 2/3 locked "Cần tạo dự án trước." / "Cần tải bản vẽ trước."', async ({ browser }) => {
    // pair needed: same as U02_dash_empty (N1 200 `items: []` for a user with no membership).
    await verifyAsAdmin(
      browser,
      'U02_onboarding_no_project',
      async (p) => {
        await p.goto(ROUTES.onboarding);
        await expectWelcomeCards(p);
        // useWelcomeScreen.ts:345-396 (no project → card 2/3 locked), WelcomeScreen.tsx:221-237 (disabled + aria-describedby).
        await expect(p.getByRole('button', { name: WELCOME_CREATE, exact: true })).toBeEnabled();
        const upload = p.getByRole('button', { name: WELCOME_UPLOAD, exact: true });
        await expect(upload).toBeDisabled();
        await expect(upload).toHaveAccessibleDescription(WELCOME_UPLOAD_LOCKED);
        const review = p.getByRole('button', { name: WELCOME_REVIEW, exact: true });
        await expect(review).toBeDisabled();
        await expect(review).toHaveAccessibleDescription(WELCOME_REVIEW_LOCKED);
      },
      async (context) => {
        await clearSeenFlagsOnLoad(context);
        await routeSummaries(context, fulfillNoProject);
      },
    );
  });
});
