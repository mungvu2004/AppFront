/**
 * Phase 2 — Dashboard & project creation (Track A, admin). E2E-TEST-PLAN.md §4, SCR-05 → SCR-07.
 *
 * Produces CP-2: `project.projectId` + `project.projectName` in `tests/.state/runtime-session.json`,
 * read from the real `POST /api/projects` response (`ProjectSchema.id` / `.name`, `src/api/schemas/index.ts`).
 *
 * R6: the create-project toast's "Hoàn tác" deletes CP-2 and is NEVER clicked here. The only "Hoàn tác"
 * clicks target the rename toast and the mark-read toast, each located by its own message text.
 */
import { expect, test } from '@playwright/test';
import type { BrowserContext, Locator, Page, Response } from '@playwright/test';

import { ROUTES } from '../../e2e/fixtures/routes';
import { navigateThenWaitForApi, waitForApi, watchApi } from '../../e2e/fullstack/apiWatch';
import type { ApiEntry } from '../../e2e/fullstack/apiWatch';
import { signInAdmin } from './support/auth';
import { captureEvidence } from './support/evidence';
import { readState, requireState, updateState } from './support/state';

/** `src/lib/mutations/undoTicket.ts:18` (not imported: that module pulls `@/` aliases at runtime). */
const UNDO_WINDOW_MS = 8_000;
/** Default stack of the wizard: `createDefaultFloorRows` + `nextFloorName` (`useCreateProjectModal.ts`). */
const DEFAULT_FLOOR_NAMES = ['Tầng trệt', 'Tầng 1', 'Tầng 2', 'Tầng 3'] as const;
const FLOOR_HEIGHT_M = '3';
/** `WELCOME_SEEN_KEY_PREFIX` (`useWelcomeScreen.ts:164`); value written is `'true'`. */
const WELCOME_SEEN_PREFIX = 'appfront:onboarding-welcome-seen:';
/** Sidebar status filters (`PROJECT_STATUS_FILTER_OPTIONS`, `useProjectDashboard.ts:76`). */
const STATUS_FILTERS = ['Đang xử lý', 'Cần QC', 'Hoàn thành'] as const;
const TABLE_HEADERS = ['Tên dự án', 'Trạng thái', 'Chi tiết', 'Tiến độ duyệt', 'Cập nhật'] as const;

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

const floorNamesOf = (value: unknown, what: string): string[] => {
  if (!Array.isArray(value)) throw new Error(`${what}: "floors" is not an array`);
  return value.map((floor, index) => stringField(asRecord(floor, `${what}.floors[${String(index)}]`), 'name', what));
};

const pathOf = (page: Page): string => new URL(page.url()).pathname;
const escapeRegExp = (text: string): string => text.replace(/[.*+?^${}()|[\]\\]/gu, '\\$&');
const pad = (value: number): string => String(value).padStart(2, '0');

/** CP-2 name `E2E-QA-<yyyymmdd-hhmm>` (local time). */
function cp2Name(now = new Date()): string {
  const date = `${String(now.getFullYear())}${pad(now.getMonth() + 1)}${pad(now.getDate())}`;
  return `E2E-QA-${date}-${pad(now.getHours())}${pad(now.getMinutes())}`;
}

/* Locators — every label verified in src/ (file noted). */
const dashboardHeading = (page: Page): Locator => page.getByRole('heading', { name: 'Dự án của tôi', exact: true });
const projectList = (page: Page): Locator => page.getByRole('list', { name: 'Danh sách dự án', exact: true });
/** `ProjectCardTile.tsx`: `<article role="listitem" aria-label={name}>`. */
const projectCards = (page: Page): Locator => projectList(page).locator('article[role="listitem"]');
const projectCard = (page: Page, name: string): Locator =>
  projectList(page).getByRole('listitem', { name, exact: true });
const searchBox = (page: Page): Locator => page.getByRole('searchbox', { name: 'Tìm dự án', exact: true });
const noMatch = (page: Page): Locator => page.getByText('Không tìm thấy dự án phù hợp', { exact: true });
const wizard = (page: Page): Locator => page.getByRole('dialog', { name: 'Tạo dự án mới', exact: true });
const toastWith = (page: Page, text: string): Locator => page.getByRole('status').filter({ hasText: text });
/** `DashboardSidebar.tsx`: label + count spans inside one `aria-pressed` button. */
const statusFilterButton = (page: Page, label: string): Locator =>
  page.getByRole('button', { name: new RegExp(`^${escapeRegExp(label)}\\s*\\d+$`, 'u') });
const bell = (page: Page): Locator => page.getByRole('button', { name: 'Thông báo', exact: true });
const notificationDrawer = (page: Page): Locator => page.getByRole('dialog', { name: 'Thông báo', exact: true });

async function openWizard(page: Page): Promise<Locator> {
  // The button carries the `N` shortcut hint, hence the prefix match (chain.fullstack.ts step 3).
  await page.getByRole('button', { name: /^Dự án mới/u }).click();
  const dialog = wizard(page);
  await expect(dialog).toBeVisible();
  return dialog;
}

test.describe.configure({ mode: 'serial' });

let context: BrowserContext;
let page: Page;
let api: ApiEntry[];

test.beforeAll(async ({ browser }, testInfo) => {
  const { baseURL, viewport } = testInfo.project.use;
  context = await browser.newContext({
    ...(baseURL !== undefined ? { baseURL } : {}),
    viewport: viewport ?? { width: 1440, height: 900 },
  });
  page = await context.newPage();
  api = watchApi(page);
  await signInAdmin(page);
});

test.afterAll(async () => {
  await context?.close();
});

test.describe('SCR-05 Dashboard (/)', () => {
  test('SCR-05 load: h1 "Dự án của tôi"; list "Danh sách dự án" or "Chưa có dự án nào"', async () => {
    const summaries = await navigateThenWaitForApi(
      page,
      () => page.goto(ROUTES.dashboard, { waitUntil: 'commit' }),
      'GET',
      /^\/api\/project-summaries$/u,
      [200],
    );

    expect(Array.isArray(asRecord(summaries.json, 'GET /api/project-summaries').items)).toBe(true);
    await expect(dashboardHeading(page)).toBeVisible();
    await expect(
      projectList(page).or(page.getByText('Chưa có dự án nào', { exact: true }).first()).first(),
    ).toBeVisible();
    await captureEvidence(page, '05_dash_loaded.png');
  });

  test('SCR-05 wizard validation: empty name shows "Chưa nhập tên dự án."', async () => {
    const dialog = await openWizard(page);

    // Step 1 has no "Tạo dự án" button (it only exists on step 3, CreateProjectModal.tsx:291):
    // with an empty name the step is blocked — the error is rendered and "Tiếp tục" is disabled.
    await expect(dialog.getByRole('alert').filter({ hasText: 'Chưa nhập tên dự án.' })).toBeVisible();
    await expect(dialog.getByRole('button', { name: 'Tiếp tục', exact: true })).toBeDisabled();
    await captureEvidence(page, '05_wizard_validation.png');

    // Pristine form: "Huỷ" closes without the discard prompt (`requestClose`, useCreateProjectModal.ts).
    await dialog.getByRole('button', { name: 'Huỷ', exact: true }).click();
    await expect(dialog).toHaveCount(0);
  });

  test('SCR-05 create CP-2 (proven sequence): POST /api/projects 200/201, 4 default floors, card shown', async () => {
    const name = cp2Name();
    const dialog = await openWizard(page);

    await dialog.getByLabel('Tên dự án').fill(name);
    await dialog.getByRole('button', { name: 'Tiếp tục', exact: true }).click();
    // The four default floors have no height yet: "Tiếp tục" stays locked until a shared height is applied.
    await dialog.getByLabel('Chiều cao áp cho mọi tầng').fill(FLOOR_HEIGHT_M);
    await dialog.getByRole('button', { name: 'Áp cho mọi tầng', exact: true }).click();
    await dialog.getByRole('button', { name: 'Tiếp tục', exact: true }).click();

    const created = waitForApi(page, 'POST', /^\/api\/projects$/u, [200, 201]);
    await dialog.getByRole('button', { name: 'Tạo dự án', exact: true }).click();
    const { response, json } = await created;

    // Request (`toProjectWriteBody` → `toProjectWirePayload`): floors[] in stack order.
    const sent = asRecord(response.request().postDataJSON() as unknown, 'POST /api/projects request');
    expect(stringField(sent, 'name', 'request')).toBe(name);
    expect(floorNamesOf(sent.floors, 'request')).toEqual([...DEFAULT_FLOOR_NAMES]);

    // Response (`ProjectSchema`): id, name, floors[].
    const body = asRecord(json, 'POST /api/projects response');
    const projectId = stringField(body, 'id', 'POST /api/projects response');
    const projectName = stringField(body, 'name', 'POST /api/projects response');
    expect(projectName).toBe(name);
    expect(floorNamesOf(body.floors, 'response').sort()).toEqual([...DEFAULT_FLOOR_NAMES].sort());

    updateState((draft) => {
      draft.project.projectId = projectId;
      draft.project.projectName = projectName;
    });
    expect(readState().project).toEqual({ projectId, projectName });

    await expect(dialog).toHaveCount(0);
    await expect(projectCard(page, projectName)).toBeVisible();
    await expect(toastWith(page, `Đã tạo dự án "${projectName}".`)).toBeVisible();
    await captureEvidence(page, '05_dash_project_created.png');
    // R6: never touch that toast; park the pointer so hover does not pause its 8 s timer.
    await page.mouse.move(0, 0);
  });

  test('SCR-05 wizard discard: dirty → "Huỷ" → "Đóng, bỏ thay đổi" closes the modal', async () => {
    const before = api.filter((entry) => entry.method === 'POST' && entry.path === '/api/projects').length;
    const dialog = await openWizard(page);

    await dialog.getByLabel('Tên dự án').fill(`discard-${String(Date.now())}`);
    await dialog.getByRole('button', { name: 'Huỷ', exact: true }).click();
    await expect(dialog.getByText('Đóng và bỏ các thay đổi chưa lưu?', { exact: true })).toBeVisible();
    await captureEvidence(page, '05_wizard_discard.png');

    await dialog.getByRole('button', { name: 'Đóng, bỏ thay đổi', exact: true }).click();
    await expect(dialog).toHaveCount(0);
    expect(api.filter((entry) => entry.method === 'POST' && entry.path === '/api/projects').length).toBe(before);
  });

  test('SCR-05 search: CP-2 name → one card; nonsense → no match; "Xoá bộ lọc" restores', async () => {
    const projectName = requireState((s) => s.project.projectName, 'project.projectName', 'Phase 2 (SCR-05 create)');
    await expect(projectCards(page).first()).toBeVisible();
    const total = await projectCards(page).count();

    await searchBox(page).fill(projectName);
    await expect(projectCards(page)).toHaveCount(1);
    await expect(projectCard(page, projectName)).toBeVisible();
    await captureEvidence(page, '05_dash_search.png');

    await searchBox(page).fill(`zz-khong-co-${String(Date.now())}`);
    await expect(noMatch(page)).toBeVisible();
    await expect(projectList(page)).toHaveCount(0);

    await page.getByRole('button', { name: 'Xoá bộ lọc', exact: true }).click();
    await expect(searchBox(page)).toHaveValue('');
    await expect(projectCards(page)).toHaveCount(total);
  });

  test('SCR-05 view controls: sort "Tên A–Z", view "Bảng", status filters (aria-pressed)', async () => {
    // Sort: legacy `Select` → `role="combobox"` button showing the current label (Select.tsx).
    await page.getByRole('combobox').filter({ hasText: 'Cập nhật gần đây' }).click();
    await page.getByRole('option', { name: 'Tên A–Z', exact: true }).click();
    await expect(page.getByRole('combobox').filter({ hasText: 'Tên A–Z' })).toBeVisible();

    const names = await projectCards(page).evaluateAll((cards) => cards.map((card) => card.getAttribute('aria-label') ?? ''));
    const expected = await page.evaluate(
      (list) => [...list].sort((a, b) => a.localeCompare(b, 'vi')),
      names,
    );
    expect(names).toEqual(expected);

    // View: SegmentedControl "Kiểu xem" → radio "Bảng".
    const viewMode = page.getByRole('radiogroup', { name: 'Kiểu xem', exact: true });
    await viewMode.getByRole('radio', { name: 'Bảng', exact: true }).click();
    await expect(viewMode.getByRole('radio', { name: 'Bảng', exact: true })).toHaveAttribute('aria-checked', 'true');
    await expect(page.getByRole('columnheader')).toHaveText([...TABLE_HEADERS]);

    const rows = page.getByRole('main').locator('tbody tr');
    for (const label of STATUS_FILTERS) {
      const filter = statusFilterButton(page, label);
      await filter.click();
      await expect(filter).toHaveAttribute('aria-pressed', 'true');
      const count = Number(/(\d+)$/u.exec((await filter.innerText()).trim())?.[1] ?? Number.NaN);
      expect(Number.isInteger(count), `count shown on "${label}"`).toBe(true);
      if (count === 0) {
        await expect(noMatch(page)).toBeVisible();
      } else {
        await expect(rows).toHaveCount(count);
        await expect(rows.filter({ hasNotText: label })).toHaveCount(0);
      }
    }
    await captureEvidence(page, '05_dash_view_controls.png');

    // Back to the defaults the next rows rely on (card grid, all statuses, newest first).
    await statusFilterButton(page, 'Tất cả').click();
    await expect(statusFilterButton(page, 'Tất cả')).toHaveAttribute('aria-pressed', 'true');
    await viewMode.getByRole('radio', { name: 'Lưới', exact: true }).click();
    await page.getByRole('combobox').filter({ hasText: 'Tên A–Z' }).click();
    await page.getByRole('option', { name: 'Cập nhật gần đây', exact: true }).click();
    await expect(projectList(page)).toBeVisible();
  });

  test('SCR-05 rename + undo: PATCH /api/projects/:id twice, rename toast "Hoàn tác" restores the name', async () => {
    const projectId = requireState((s) => s.project.projectId, 'project.projectId', 'Phase 2 (SCR-05 create)');
    const projectName = requireState((s) => s.project.projectName, 'project.projectName', 'Phase 2 (SCR-05 create)');
    const patchPath = new RegExp(`^/api/projects/${escapeRegExp(projectId)}$`, 'u');
    const renamed = `${projectName}-R`;

    // The create toast must be gone first so no "Hoàn tác" but the rename one is on screen (R6).
    await page.mouse.move(0, 0);
    await expect(toastWith(page, `Đã tạo dự án "${projectName}".`)).toHaveCount(0, { timeout: UNDO_WINDOW_MS * 2 });

    await page.getByRole('button', { name: `Tuỳ chọn cho ${projectName}`, exact: true }).click();
    await page.getByRole('menu', { name: 'Tùy chọn' }).getByRole('menuitem', { name: 'Đổi tên', exact: true }).click();
    const input = page.getByRole('textbox', { name: `Đổi tên ${projectName}`, exact: true });
    await input.fill(renamed);

    const renamePatch = waitForApi(page, 'PATCH', patchPath, [200]);
    await input.press('Enter');
    expect(stringField(asRecord((await renamePatch).json, 'PATCH rename'), 'name', 'PATCH rename')).toBe(renamed);
    await expect(projectCard(page, renamed)).toBeVisible();

    const renameToast = toastWith(page, `Đã đổi tên thành "${renamed}"`);
    await expect(renameToast).toBeVisible();
    const undoPatch = waitForApi(page, 'PATCH', patchPath, [200]);
    await renameToast.getByRole('button', { name: 'Hoàn tác', exact: true }).click();
    const serverName = stringField(asRecord((await undoPatch).json, 'PATCH undo'), 'name', 'PATCH undo');

    expect(serverName).toBe(projectName);
    await expect(toastWith(page, `Đã khôi phục tên "${projectName}"`)).toBeVisible();
    await expect(projectCard(page, projectName)).toBeVisible();
    await captureEvidence(page, '05_dash_rename_undo.png');

    updateState((draft) => {
      draft.project.projectName = serverName;
    });
    expect(readState().project.projectName).toBe(serverName);
    await page.mouse.move(0, 0);
  });

  test('SCR-05 card click: routes by status (processing → /pipeline, qc → walls|/floors, done → /3d)', async () => {
    const projectId = requireState((s) => s.project.projectId, 'project.projectId', 'Phase 2 (SCR-05 create)');
    const projectName = requireState((s) => s.project.projectName, 'project.projectName', 'Phase 2 (SCR-05 create)');

    const { json } = await navigateThenWaitForApi(
      page,
      () => page.goto(ROUTES.dashboard, { waitUntil: 'commit' }),
      'GET',
      /^\/api\/project-summaries$/u,
      [200],
    );
    const items = asRecord(json, 'GET /api/project-summaries').items;
    const summary = (Array.isArray(items) ? items : [])
      .map((item, index) => asRecord(item, `items[${String(index)}]`))
      .find((item) => item.id === projectId);
    if (summary === undefined) {
      throw new Error(`CP-2 ${projectId} is not on the first page of GET /api/project-summaries`);
    }

    // `derivedStatusOf` + `routeForProject` (useProjectDashboard.ts:192, :221).
    const total = Number(summary.wallsTotalCount);
    const reviewed = Number(summary.wallsReviewedCount);
    const status = total > 0 && reviewed >= total ? 'done' : summary.status === 'processing' ? 'processing' : 'qc';
    const defaultFloorId = typeof summary.defaultFloorId === 'string' ? summary.defaultFloorId : undefined;
    const expectedPath =
      status === 'processing'
        ? ROUTES.project.pipeline(projectId)
        : status === 'done'
          ? ROUTES.project.viewer(projectId)
          : defaultFloorId === undefined
            ? ROUTES.project.floors(projectId)
            : ROUTES.project.walls(projectId, defaultFloorId);

    // One card on screen (the hero), so the click lands on CP-2 and nowhere else.
    await searchBox(page).fill(projectName);
    await expect(projectCards(page)).toHaveCount(1);
    await projectCard(page, projectName).click();

    await expect.poll(() => pathOf(page)).toBe(expectedPath);
    await captureEvidence(page, '05_dash_open_project.png');
  });
});

test.describe('SCR-06 Notifications', () => {
  test('SCR-06 bell (exact "Thông báo"): drawer "Thông báo" + radiogroup "Lọc thông báo"', async () => {
    await page.goto(ROUTES.dashboard);
    await expect(dashboardHeading(page)).toBeVisible();

    await bell(page).click();
    const drawer = notificationDrawer(page);
    await expect(drawer).toBeVisible();
    await expect(bell(page)).toHaveAttribute('aria-expanded', 'true');
    await expect(drawer.getByRole('radiogroup', { name: 'Lọc thông báo', exact: true })).toBeVisible();
    await captureEvidence(page, '06_notif_drawer.png');
  });

  test('SCR-06 mark-read + undo within 8 s: item reverts, no POST /api/notifications/read', async () => {
    const drawer = notificationDrawer(page);
    if ((await drawer.count()) === 0) await bell(page).click();
    await expect(drawer).toBeVisible();

    // Settled: a day group, the empty state, or the error state (NotificationCenter.tsx).
    const errorTitle = drawer.getByText('Không tải được thông báo', { exact: true });
    await expect(
      drawer
        .locator('section')
        .first()
        .or(drawer.getByText('Không có thông báo mới', { exact: true }))
        .or(errorTitle)
        .first(),
    ).toBeVisible();
    expect(await errorTitle.count(), 'notification list failed to load').toBe(0);

    // `exact`: excludes "Đánh dấu tất cả đã đọc". Only unread rows carry this button.
    const markButtons = drawer.getByRole('button', { name: 'Đánh dấu đã đọc', exact: true });
    const unread = await markButtons.count();
    test.skip(unread === 0, 'data: no unread notification for the admin right now (needs e.g. CP-5); nothing to mark read');

    const isMarkRead = (response: Response): boolean =>
      response.request().method() === 'POST' && new URL(response.url()).pathname === '/api/notifications/read';
    const markReadRequests = (): number =>
      api.filter((entry) => entry.method === 'POST' && entry.path === '/api/notifications/read').length;
    const before = markReadRequests();

    const row = drawer.locator('li').filter({ has: markButtons }).first();
    await row.hover();
    await row.getByRole('button', { name: 'Đánh dấu đã đọc', exact: true }).click();
    await expect(markButtons).toHaveCount(unread - 1);

    // The undo lives on the app-wide NotificationHost toast, message `NOTIFICATION_CENTER_TEXT.markedRead`.
    const markToast = toastWith(page, 'Đã đánh dấu là đã đọc');
    await markToast.getByRole('button', { name: 'Hoàn tác', exact: true }).click();
    await expect(markButtons).toHaveCount(unread);
    await captureEvidence(page, '06_notif_markread_undo.png');

    // Absence proof bounded by the product's own undo window: had the timer survived the undo,
    // `sendMarkRead` would fire at UNDO_WINDOW_MS. A network wait, not a sleep.
    const leaked = await page
      .waitForResponse(isMarkRead, { timeout: UNDO_WINDOW_MS + 2_000 })
      .then(() => true, () => false);
    expect(leaked, 'POST /api/notifications/read sent despite "Hoàn tác"').toBe(false);
    expect(markReadRequests()).toBe(before);
    await expect(markButtons).toHaveCount(unread);
  });

  test('SCR-06 /thong-bao: drawer forced open; Esc leaves to / (no in-app history)', async () => {
    await page.goto(ROUTES.notifications);
    const drawer = notificationDrawer(page);
    await expect(drawer).toBeVisible();
    await expect(page.getByRole('heading', { name: 'Thông báo', exact: true })).toBeVisible();
    await captureEvidence(page, '06_notif_route.png');

    // Direct load ⇒ `location.key === 'default'` ⇒ `navigate('/', { replace: true })` (NotificationCenter.container.tsx).
    await page.keyboard.press('Escape');
    await expect.poll(() => pathOf(page)).toBe(ROUTES.dashboard);
    await expect(dashboardHeading(page)).toBeVisible();
    await expect(drawer).toHaveCount(0);
  });
});

test.describe('SCR-07 Onboarding (/onboarding)', () => {
  test('SCR-07 flag cleared → three steps → "Bỏ qua" sets the seen flag, lands on /; reload redirects to /', async () => {
    // Clear every per-user seen flag on this origin (the uid is not known before the refresh below).
    await page.evaluate((prefix) => {
      for (const key of Object.keys(window.localStorage)) {
        if (key.startsWith(prefix)) window.localStorage.removeItem(key);
      }
    }, WELCOME_SEEN_PREFIX);

    // `session.user.id` comes only from the refresh payload, `data` wrapper optional (src/lib/auth/refresh.ts).
    const { json } = await navigateThenWaitForApi(
      page,
      () => page.goto(ROUTES.onboarding, { waitUntil: 'commit' }),
      'POST',
      /^\/api\/auth\/refresh$/u,
      [200],
    );
    const body = asRecord(json, 'POST /api/auth/refresh');
    const root = typeof body.data === 'object' && body.data !== null ? asRecord(body.data, 'refresh.data') : body;
    const uid = stringField(asRecord(root.user, 'refresh.user'), 'id', 'refresh.user');
    const seenKey = `${WELCOME_SEEN_PREFIX}${uid}`;

    await expect(page.getByRole('heading', { level: 1 })).toHaveText(/^Chào .+, bắt đầu trong ba bước$/u);
    for (const title of ['Tạo dự án', 'Tải bản vẽ theo từng tầng', 'Duyệt kết quả và dựng 3D']) {
      await expect(page.getByRole('heading', { level: 2, name: title, exact: true })).toBeVisible();
    }

    await page.getByRole('button', { name: 'Bỏ qua', exact: true }).click();
    await expect.poll(() => pathOf(page)).toBe(ROUTES.dashboard);
    await expect(dashboardHeading(page)).toBeVisible();
    expect(await page.evaluate((key) => window.localStorage.getItem(key), seenKey)).toBe('true');

    await page.goto(ROUTES.onboarding);
    await expect.poll(() => pathOf(page)).toBe(ROUTES.dashboard);
    await expect(dashboardHeading(page)).toBeVisible();
    await expect(page.getByRole('button', { name: 'Bỏ qua', exact: true })).toHaveCount(0);
    await captureEvidence(page, '07_onboard_skip.png');
  });
});
