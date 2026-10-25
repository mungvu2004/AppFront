/**
 * Phase 2 — Dashboard & project creation (Track A, admin). E2E-TEST-PLAN.md §4, SCR-05 → SCR-07.
 *
 * Produces CP-2: `project.projectId` + `project.projectName` in `tests/.state/runtime-session.json`,
 * read from the real `POST /api/projects` response (`ProjectSchema.id` / `.name`, `src/api/schemas/index.ts`).
 *
 * R6: the create-project toast's "Hoàn tác" deletes CP-2 and is NEVER clicked here. The only "Hoàn tác"
 * clicks target the rename toast and the mark-read / mark-all toasts, each located by its own message text.
 *
 * Request budget (serial, one context): 1 UI login (`signInAdmin`, `POST /api/auth/login`), then one
 * `POST /api/auth/refresh` per full page load (≈ 8). Writes: 2 `POST /api/projects` (CP-2 + one
 * `qa-<runId>-m02-full-…` project), 2 `PATCH /api/projects/:id` (rename + its undo), 1 `DELETE /api/projects/:id`
 * (the `m02-full` project, through the UI; `afterAll` deletes it with the page's own access token if the delete
 * test did not). Mark-read / mark-all are always undone inside the 8 s window: 0 `POST /api/notifications/read*`.
 * Read-after-navigate waits register BEFORE the navigation (`gotoThenApi`): BUG-141 (`navigateThenWaitForApi` used to
 * register after `goto` and missed a fast N1; it registers first since FIX-986, this file keeps its local helper).
 */
import { expect, test } from '@playwright/test';
import type { BrowserContext, Locator, Page, Response } from '@playwright/test';

import { ROUTES } from '../../e2e/fixtures/routes';
import { waitForApi, watchApi } from '../../e2e/fullstack/apiWatch';
import type { ApiEntry, ApiResult } from '../../e2e/fullstack/apiWatch';
import { signInAdmin } from './support/auth';
import { TEST_DATA_PREFIX, attachJson, captureEvidence } from './support/evidence';
import { readState, requireState, updateState } from './support/state';

/** `src/lib/mutations/undoTicket.ts:18` (not imported: that module pulls `@/` aliases at runtime). */
const UNDO_WINDOW_MS = 8_000;
/** Default stack of the wizard: `createDefaultFloorRows` + `nextFloorName` (`useCreateProjectModal.ts`). */
const DEFAULT_FLOOR_NAMES = ['Tầng trệt', 'Tầng 1', 'Tầng 2', 'Tầng 3'] as const;
const FLOOR_HEIGHT_M = '3';
/** `WELCOME_SEEN_KEY_PREFIX` (`useWelcomeScreen.ts:164`); value written is `'true'`. */
const WELCOME_SEEN_PREFIX = 'appfront:onboarding-welcome-seen:';
/** Sidebar status filters (`PROJECT_STATUS_FILTER_OPTIONS`, `useProjectDashboard.ts:76`). */
const STATUS_FILTERS = ['Đang xử lý', 'Cần duyệt', 'Hoàn thành'] as const;
const TABLE_HEADERS = ['Tên dự án', 'Trạng thái', 'Chi tiết', 'Tiến độ duyệt', 'Cập nhật'] as const;
/** `ContextMenu.tsx:102` aria-label (NOT "Tùy chọn": tone-mark placement changed in c6e6b126, coverage F1). */
const CARD_MENU = 'Tuỳ chọn';
/* SCR-06 copy: NotificationCenter.tsx:55-56, useNotificationCenter.ts:160-161. */
const MARK_READ = 'Đánh dấu đã đọc';
const MARK_ALL_READ = 'Đánh dấu đã đọc hết';
const MARKED_ALL_READ = 'Đã đánh dấu tất cả là đã đọc';
/* SCR-07 copy: useWelcomeScreen.ts:128-140 (STRINGS). */
const ONBOARD_UPLOAD = 'Tải bản vẽ';
const ONBOARD_REVIEW = 'Duyệt kết quả';
const ONBOARD_REVIEW_LOCKED = 'Cần tải bản vẽ trước.';
/* Wizard step 1 extras: CreateProjectModal.tsx:109-149, useCreateProjectModal.ts:71-79 (types), :602 (basement). */
const FULL_ADDRESS = 'Số 1 Phố Huế';
const FULL_TYPE = 'Thương mại';
const BASEMENT_NAME = 'Tầng hầm';

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
const dashboardHeading = (page: Page): Locator => page.getByRole('heading', { name: 'Chọn dự án để làm tiếp', exact: true });
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
  page.getByRole('radiogroup', { name: 'Lọc theo trạng thái', exact: true }).getByRole('radio', { name: label, exact: true }); // S-02: radiogroup in the "Dự án" section, no counts
const bell = (page: Page): Locator => page.getByRole('button', { name: 'Thông báo', exact: true });
const notificationDrawer = (page: Page): Locator => page.getByRole('dialog', { name: 'Thông báo', exact: true });

async function openWizard(page: Page): Promise<Locator> {
  // The button carries the `N` shortcut hint, hence the prefix match (chain.fullstack.ts step 3).
  await page.getByRole('button', { name: /^Tạo dự án\s*N$/u }).click();
  const dialog = wizard(page);
  await expect(dialog).toBeVisible();
  return dialog;
}

/** BUG-141: the wait is registered BEFORE the navigation, so a fast response is never missed. */
async function gotoThenApi(page: Page, url: string, method: string, path: RegExp, statuses: readonly number[]): Promise<ApiResult> {
  const pending = waitForApi(page, method, path, statuses);
  pending.catch(() => undefined);
  await page.goto(url, { waitUntil: 'commit' });
  return pending;
}

/**
 * BUG-143: Drawer / Modal / BottomSheet enter with framer-motion (JS transform, `Drawer.tsx`, `Modal.tsx:109-135`),
 * which `animations: 'disabled'` does not stop. Waits for the finite animations under `target` and for its box and
 * opacity to hold still for 3 frames before a shot.
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

/** Access token of the page's latest `POST /api/auth/refresh` (refresh.ts:85-100, optional `data`); never logged. */
function latestAccessToken(log: readonly ApiEntry[]): string | undefined {
  for (const entry of [...log].reverse()) {
    if (entry.method !== 'POST' || entry.path !== '/api/auth/refresh' || entry.status !== 200) continue;
    if (typeof entry.json !== 'object' || entry.json === null) continue;
    const body = entry.json as Json;
    const root = typeof body.data === 'object' && body.data !== null ? (body.data as Json) : body;
    const token = typeof root.accessToken === 'string' ? root.accessToken : root.access_token;
    if (typeof token === 'string' && token !== '') return token;
  }
  return undefined;
}

/** N1 rows as the onboarding hook reads them (`mostRecentProject`, useWelcomeScreen.ts:222-228). */
function newestSummary(json: unknown): Json {
  const items = asRecord(json, 'GET /api/project-summaries').items;
  const rows = (Array.isArray(items) ? items : []).map((item, index) => asRecord(item, `items[${String(index)}]`));
  const newest = rows.reduce<Json | undefined>(
    (best, row) =>
      best === undefined || Date.parse(stringField(row, 'updatedAt', 'N1 row')) > Date.parse(stringField(best, 'updatedAt', 'N1 row'))
        ? row
        : best,
    undefined,
  );
  if (newest === undefined) throw new Error('GET /api/project-summaries: no project (CP-2 should exist)');
  return newest;
}

test.describe.configure({ mode: 'serial' });

let context: BrowserContext;
let page: Page;
let api: ApiEntry[];
/** The `m02-full` project the full-create test makes; the delete test removes it, `afterAll` if it did not. */
let fullProject: { id: string; name: string; deleted: boolean } | undefined;

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
  try {
    if (fullProject !== undefined && !fullProject.deleted) {
      const token = latestAccessToken(api);
      const origin = new URL(page.url()).origin;
      const res = token === undefined
        ? undefined
        : await page.request.delete(`/api/projects/${fullProject.id}`, {
            headers: { Origin: origin, Authorization: `Bearer ${token}` },
          });
      if (res?.status() !== 200) {
        test.info().annotations.push({ type: 'cleanup', description: `DELETE ${fullProject.id} → ${String(res?.status() ?? 'no token')}` });
      }
    }
  } catch (error) {
    test.info().annotations.push({ type: 'cleanup', description: String(error) });
  } finally {
    await context?.close();
  }
});

test.describe('SCR-05 Dashboard (/)', () => {
  test('SCR-05 load: h1 "Dự án của tôi"; list "Danh sách dự án" or "Chưa có dự án nào"', async () => {
    const summaries = await gotoThenApi(page, ROUTES.dashboard, 'GET', /^\/api\/project-summaries$/u, [200]);

    expect(Array.isArray(asRecord(summaries.json, 'GET /api/project-summaries').items)).toBe(true);
    await expect(dashboardHeading(page)).toBeVisible();
    await expect(
      projectList(page).or(page.getByText('Chưa có dự án nào', { exact: true }).first()).first(),
    ).toBeVisible();
    await captureEvidence(page, '05_dash_loaded.png');
  });

  test('SCR-05 wizard validation: pristine step 1 shows only the hint; a name typed then erased shows "Chưa nhập tên dự án."', async () => {
    const dialog = await openWizard(page);

    // Step 1 has no "Tạo dự án" button (it only exists on step 3, CreateProjectModal.tsx:291).
    // BUG-133: a form nobody typed into is not wrong yet — a neutral hint, no error, "Tiếp tục" disabled.
    await expect(dialog.getByText('Bắt buộc, từ 3 đến 80 ký tự.', { exact: true })).toBeVisible();
    await expect(dialog.getByRole('alert')).toHaveCount(0);
    await expect(dialog.getByRole('button', { name: /^Tiếp: /u })).toHaveCount(0);
    // The complaint arrives with the first keystroke: with an empty name the step stays blocked.
    await dialog.getByLabel('Tên dự án').fill('a');
    await dialog.getByLabel('Tên dự án').fill('');
    await expect(dialog.getByRole('alert').filter({ hasText: 'Chưa nhập tên dự án.' })).toBeVisible();
    await expect(dialog.getByRole('button', { name: /^Tiếp: /u })).toHaveCount(0);
    await settled(dialog);
    await captureEvidence(page, '05_wizard_validation.png');

    // BUG-208: typing then erasing leaves the form dirty (isDirty never resets), so "Huỷ" asks first
    // (`requestClose`, useCreateProjectModal.ts); confirm the discard to close.
    await dialog.getByRole('button', { name: 'Huỷ', exact: true }).click();
    await dialog.getByRole('button', { name: 'Đóng, bỏ thay đổi', exact: true }).click();
    await expect(dialog).toHaveCount(0);
  });

  test('SCR-05 create CP-2 (proven sequence): POST /api/projects 200/201, 4 default floors, card shown', async () => {
    const name = cp2Name();
    const dialog = await openWizard(page);

    await dialog.getByLabel('Tên dự án').fill(name);
    await dialog.getByRole('button', { name: /^Tiếp: /u }).click();
    // The four default floors have no height yet: "Tiếp tục" stays locked until a shared height is applied.
    await dialog.getByLabel('Chiều cao áp cho mọi tầng').fill(FLOOR_HEIGHT_M);
    await dialog.getByRole('button', { name: 'Áp cho mọi tầng', exact: true }).click();
    await dialog.getByRole('button', { name: /^Tiếp: /u }).click();

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

    await dialog.getByLabel('Tên dự án').fill(`${TEST_DATA_PREFIX}discard-${Date.now().toString(36)}`);
    await dialog.getByRole('button', { name: 'Huỷ', exact: true }).click();
    await expect(dialog.getByText('Đóng và bỏ các thay đổi chưa lưu?', { exact: true })).toBeVisible();
    await settled(dialog);
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
    // BUG-115 fixed: `Table.Head` carries scope="col" (getByRole('columnheader') works); the header row is still read
    // from the markup (`thead th`), the same cells.
    await expect(page.getByRole('main').locator('thead th')).toHaveText([...TABLE_HEADERS]);

    const rows = page.getByRole('main').locator('tbody tr');
    for (const label of STATUS_FILTERS) {
      const filter = statusFilterButton(page, label);
      await filter.click();
      await expect(filter).toHaveAttribute('aria-checked', 'true');
      const count = Number(/(\d+)$/u.exec((await filter.innerText()).trim())?.[1] ?? Number.NaN);
      expect(Number.isInteger(count), `count shown on "${label}"`).toBe(true);
      if (count === 0) {
        await expect(noMatch(page)).toBeVisible();
      } else {
        await expect(rows).toHaveCount(count);
        await expect(rows.filter({ hasNotText: label })).toHaveCount(0);
      }
    }

    // BUG-166: the loop above ends on the last filter ("Hoàn thành", usually 0 rows → only the no-match state). The shot is
    // taken back on "Tất cả" so it shows what the case claims: "Bảng" on, header row and the rows in "Tên A–Z" order.
    await statusFilterButton(page, 'Tất cả').click();
    await expect(statusFilterButton(page, 'Tất cả')).toHaveAttribute('aria-checked', 'true');
    await expect(page.getByRole('main').locator('thead th')).toHaveText([...TABLE_HEADERS]);
    await expect(rows.first()).toBeVisible();
    await captureEvidence(page, '05_dash_view_controls.png', { caption: 'view "Bảng", sort "Tên A–Z", filter "Tất cả"' });

    // Back to the defaults the next rows rely on (card grid, all statuses, newest first).
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
    await page.getByRole('menu', { name: CARD_MENU, exact: true }).getByRole('menuitem', { name: 'Đổi tên', exact: true }).click();
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

    const { json } = await gotoThenApi(page, ROUTES.dashboard, 'GET', /^\/api\/project-summaries$/u, [200]);
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

    // One card on screen (search narrows it to CP-2), so the click lands on CP-2 and nowhere else.
    await searchBox(page).fill(projectName);
    await expect(projectCards(page)).toHaveCount(1);
    await projectCard(page, projectName).click();

    await expect.poll(() => pathOf(page)).toBe(expectedPath);
    await captureEvidence(page, '05_dash_open_project.png');
  });

  test('SCR-05 wizard full create: address, type "Thương mại", notes, basement → POST body with 5 floors; card + toast "Đã tạo dự án"', async () => {
    await page.goto(ROUTES.dashboard);
    await expect(dashboardHeading(page)).toBeVisible();
    const name = `${TEST_DATA_PREFIX}m02-full-${Date.now().toString(36)}`;
    const dialog = await openWizard(page);

    // Step 1 (CreateProjectModal.tsx:100-149): name, the auto code, address, "Loại công trình" Select, notes.
    await dialog.getByLabel('Tên dự án').fill(name);
    await openMore(dialog);
    await dialog.getByLabel('Địa chỉ').fill(FULL_ADDRESS);
    await dialog.getByRole('combobox').click();
    await page.getByRole('option', { name: FULL_TYPE, exact: true }).click();
    await openMore(dialog);
    await dialog.getByLabel('Ghi chú').fill('Ghi chú QA');
    const code = await dialog.getByLabel('Mã dự án').inputValue(); // auto from the name (useCreateProjectModal.ts:533-535)
    await dialog.getByRole('button', { name: /^Tiếp: /u }).click();

    // Step 2: "Có tầng hầm" puts "Tầng hầm" first (StepFloors.tsx:34-40, useCreateProjectModal.ts:596-606).
    const basement = dialog.getByRole('switch', { name: 'Có tầng hầm' });
    await basement.click();
    await expect(basement).toHaveAttribute('aria-checked', 'true');
    const height = dialog.getByLabel('Chiều cao áp cho mọi tầng');
    await height.fill(FLOOR_HEIGHT_M);
    await height.press('Tab'); // useNumericField commits on blur (useNumericField.ts:105-111)
    await dialog.getByRole('button', { name: 'Áp cho mọi tầng', exact: true }).click();
    await dialog.getByRole('button', { name: /^Tiếp: /u }).click();
    await expect(dialog.locator('[aria-current="step"]').filter({ hasText: 'Xem lại' })).toBeVisible(); // useCreateProjectModal.ts:684

    const created = waitForApi(page, 'POST', /^\/api\/projects$/u, [200, 201]);
    await dialog.getByRole('button', { name: 'Tạo dự án', exact: true }).click();
    const { response, json } = await created;
    const body = asRecord(json, 'POST /api/projects response');
    // Recorded before the checks, so the delete test / afterAll removes it even if one fails.
    fullProject = { id: stringField(body, 'id', 'POST /api/projects response'), name, deleted: false };

    // `toProjectWriteBody` (CreateProjectModal.container.tsx:57-75) → `toProjectWirePayload` (api/contracts.ts:202-211):
    // address and code go out; type and notes have no wire field yet and are dropped.
    const sent = asRecord(response.request().postDataJSON() as unknown, 'POST /api/projects request');
    const floors = [BASEMENT_NAME, ...DEFAULT_FLOOR_NAMES];
    expect(stringField(sent, 'name', 'request')).toBe(name);
    expect(sent.address).toBe(FULL_ADDRESS);
    if (code !== '') expect(sent.code).toBe(code);
    expect(floorNamesOf(sent.floors, 'request')).toEqual(floors);
    expect(floorNamesOf(body.floors, 'response').sort()).toEqual([...floors].sort());

    await expect(dialog).toHaveCount(0);
    await expect(projectCard(page, name)).toBeVisible();
    await expect(toastWith(page, `Đã tạo dự án "${name}".`)).toBeVisible(); // useCreateProjectModal.ts:668-673
    await captureEvidence(page, '05_dash_full_create.png');
    await attachJson('05_dash_full_create.json', {
      status: response.status(),
      id: fullProject.id,
      sentKeys: Object.keys(sent).sort(),
      floors,
    });
    await page.mouse.move(0, 0); // never hover the toast: its "Hoàn tác" would delete the project (A8)
  });

  test('SCR-05 delete (A9): "Xoá" → "Xoá dự án?" → "Xoá dự án" → DELETE 200, the card leaves, no undo toast', async () => {
    const target = fullProject;
    if (target === undefined) throw new Error('the full-create test did not create its project');

    // The create toast carries the name; it must be gone before "no toast with the name" means anything.
    await page.mouse.move(0, 0);
    await expect(toastWith(page, `Đã tạo dự án "${target.name}".`)).toHaveCount(0, { timeout: UNDO_WINDOW_MS * 2 });

    await page.getByRole('button', { name: `Tuỳ chọn cho ${target.name}`, exact: true }).click(); // ProjectCardTile.tsx:97-107
    await page.getByRole('menu', { name: CARD_MENU, exact: true }).getByRole('menuitem', { name: 'Xoá', exact: true }).click(); // projectMenuGroups.ts:25
    const dialog = page.getByRole('dialog', { name: 'Xoá dự án?', exact: true }); // ProjectDashboard.tsx:329-353
    await expect(
      dialog.getByText(`"${target.name}" và toàn bộ bản vẽ, mô hình liên quan sẽ bị xoá vĩnh viễn.`, { exact: true }),
    ).toBeVisible();
    await expect(dialog.getByText('Không hoàn tác được.', { exact: true })).toBeVisible();
    await settled(dialog);
    await captureEvidence(page, '05_dash_delete_confirm.png');

    const removed = waitForApi(page, 'DELETE', new RegExp(`^/api/projects/${escapeRegExp(target.id)}$`, 'u'), [200]);
    await dialog.getByRole('button', { name: 'Xoá dự án', exact: true }).click();
    await removed;
    target.deleted = true;
    await expect(dialog).toHaveCount(0);
    await expect(projectCard(page, target.name)).toHaveCount(0);
    await expect(toastWith(page, target.name)).toHaveCount(0); // A9 asked first, so no undo toast (useProjectDashboard.ts:442)
    await captureEvidence(page, '05_dash_deleted.png', { caption: `DELETE /api/projects/${target.id} → 200; card gone; no toast` });
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
    await settled(drawer);
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

    // `exact`: excludes "Đánh dấu đã đọc hết". Only unread rows carry this button.
    const markButtons = drawer.getByRole('button', { name: MARK_READ, exact: true });
    const unread = await markButtons.count();
    test.skip(unread === 0, 'data: no unread notification for the admin right now (needs e.g. CP-5); nothing to mark read');

    const isMarkRead = (response: Response): boolean =>
      response.request().method() === 'POST' && new URL(response.url()).pathname === '/api/notifications/read';
    const markReadRequests = (): number =>
      api.filter((entry) => entry.method === 'POST' && entry.path === '/api/notifications/read').length;
    const before = markReadRequests();

    // Coverage F2: a `has` locator is resolved INSIDE each <li>, so it must be page-rooted, not drawer-rooted.
    const row = drawer.locator('li').filter({ has: page.getByRole('button', { name: MARK_READ, exact: true }) }).first();
    await row.hover();
    await row.getByRole('button', { name: MARK_READ, exact: true }).click();
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

  test('SCR-06 "Đánh dấu đã đọc hết" + "Hoàn tác": every unread row comes back, no POST /api/notifications/read*', async () => {
    await page.goto(ROUTES.dashboard);
    await expect(dashboardHeading(page)).toBeVisible();
    await bell(page).click();
    const drawer = notificationDrawer(page);
    const errorTitle = drawer.getByText('Không tải được thông báo', { exact: true });
    await expect(
      drawer.locator('section').first().or(drawer.getByText('Không có thông báo mới', { exact: true })).or(errorTitle).first(),
    ).toBeVisible();
    expect(await errorTitle.count(), 'notification list failed to load').toBe(0);

    const markAll = drawer.getByRole('button', { name: MARK_ALL_READ, exact: true }); // NotificationCenter.tsx:239, :310
    const markButtons = drawer.getByRole('button', { name: MARK_READ, exact: true }); // unread rows only (NotificationCenter.tsx:187-198)
    const unread = await markButtons.count();
    if (unread === 0) {
      // Data branch (no unread notification before Phase 3): the control is there and disabled.
      await expect(markAll).toBeDisabled();
      await settled(drawer);
      await captureEvidence(page, '06_notif_mark_all.png', { caption: 'no unread notification → "Đánh dấu đã đọc hết" disabled' });
      await attachJson('06_notif_mark_all.json', { unread, branch: 'disabled' });
      return;
    }

    const isMarkRead = (response: Response): boolean =>
      response.request().method() === 'POST' && new URL(response.url()).pathname.startsWith('/api/notifications/read');
    const sentBefore = api.filter((entry) => entry.method === 'POST' && entry.path.startsWith('/api/notifications/read')).length;

    await markAll.click(); // useNotificationCenter.ts:793-798 → deferMarkRead (8 s window)
    await expect(markButtons).toHaveCount(0);
    // The drawer overlay sits above the app-wide toast (NotificationHost): close it first.
    await page.keyboard.press('Escape');
    await expect(drawer).toHaveCount(0);
    await toastWith(page, MARKED_ALL_READ).getByRole('button', { name: 'Hoàn tác', exact: true }).click();
    await page.mouse.move(0, 0);
    await bell(page).click();
    await expect(markButtons).toHaveCount(unread);
    await settled(drawer);
    await captureEvidence(page, '06_notif_mark_all.png', { caption: `mark all (${String(unread)}) → "Hoàn tác" → ${String(unread)} unread again` });

    const leaked = await page
      .waitForResponse(isMarkRead, { timeout: UNDO_WINDOW_MS + 2_000 })
      .then(() => true, () => false);
    expect(leaked, 'POST /api/notifications/read* sent despite "Hoàn tác"').toBe(false);
    expect(api.filter((entry) => entry.method === 'POST' && entry.path.startsWith('/api/notifications/read')).length).toBe(sentBefore);
    await attachJson('06_notif_mark_all.json', { unread, branch: 'undone', postSent: leaked });
  });

  test('SCR-06 /thong-bao: a page inside the app frame (G1-15) — h1, filters, list; no dialog; Esc stays', async () => {
    await page.goto(ROUTES.notifications);
    const heading = page.getByRole('heading', { level: 1, name: 'Xem việc mới từ thông báo', exact: true });
    await expect(heading).toBeVisible();
    await expect(page.getByRole('radiogroup', { name: 'Lọc thông báo' })).toBeVisible();
    await expect(page.getByRole('dialog', { name: 'Thông báo' })).toHaveCount(0);
    await captureEvidence(page, '06_notif_route.png');

    // A page, not an overlay: Esc has nothing to close (NotificationCenter.container.tsx, NotificationCenterRoute).
    await page.keyboard.press('Escape');
    await expect.poll(() => pathOf(page)).toBe(ROUTES.notifications);
    await expect(heading).toBeVisible();
  });
});

test.describe('SCR-07 Onboarding (/onboarding)', () => {
  test('SCR-07 cards follow the newest project: "Tải bản vẽ" → /projects/{newest}/upload, "Duyệt kết quả" locked until walls exist; flag not set', async () => {
    await page.evaluate((prefix) => {
      for (const key of Object.keys(window.localStorage)) {
        if (key.startsWith(prefix)) window.localStorage.removeItem(key);
      }
    }, WELCOME_SEEN_PREFIX);

    const { json } = await gotoThenApi(page, ROUTES.onboarding, 'GET', /^\/api\/project-summaries$/u, [200]);
    // The hook's own rule: most recently updated project (useWelcomeScreen.ts:222-228, :268-273).
    const newest = newestSummary(json);
    const newestId = stringField(newest, 'id', 'newest N1 row');
    const walls = Number(newest.wallsTotalCount);
    const reviewed = Number(newest.wallsReviewedCount);

    await expect(page.getByRole('heading', { level: 1 })).toHaveText('Bắt đầu dự án đầu tiên trong ba bước');
    const upload = page.getByRole('button', { name: ONBOARD_UPLOAD, exact: true });
    const review = page.getByRole('button', { name: ONBOARD_REVIEW, exact: true });
    await expect(upload).toBeEnabled(); // card 2 is locked only with no project (WelcomeScreen.tsx:226)
    if (walls > 0) {
      await expect(review).toBeEnabled();
    } else {
      await expect(review).toBeDisabled();
      await expect(review).toHaveAccessibleDescription(ONBOARD_REVIEW_LOCKED); // WelcomeScreen.tsx:226-237
    }
    await settled(page.getByRole('listitem').last()); // cards enter with a staggered motion (WelcomeScreen.tsx:204-207)
    await captureEvidence(page, '07_onboard_cards.png', { caption: `newest ${newestId}: walls ${String(walls)}, reviewed ${String(reviewed)}` });

    await upload.click(); // goUpload → leave() → ROUTES.project.upload(latest.id) (useWelcomeScreen.ts:325-328)
    await expect.poll(() => pathOf(page)).toBe(ROUTES.project.upload(newestId));
    const allDone = walls > 0 && reviewed === walls; // only then does the screen write the flag itself (useWelcomeScreen.ts:294-297)
    const flags = await page.evaluate(
      (prefix) => Object.keys(window.localStorage).filter((key) => key.startsWith(prefix)).length,
      WELCOME_SEEN_PREFIX,
    );
    if (!allDone) expect(flags, 'seen flag after partial progress').toBe(0);
    await attachJson('07_onboard_cards.json', { newestId, walls, reviewed, landed: pathOf(page), seenFlags: flags });
  });

  test('SCR-07 flag cleared → three steps → "Bỏ qua" sets the seen flag, lands on /; reload redirects to /', async () => {
    // Clear every per-user seen flag on this origin (the uid is not known before the refresh below).
    await page.evaluate((prefix) => {
      for (const key of Object.keys(window.localStorage)) {
        if (key.startsWith(prefix)) window.localStorage.removeItem(key);
      }
    }, WELCOME_SEEN_PREFIX);

    // `session.user.id` comes only from the refresh payload, `data` wrapper optional (src/lib/auth/refresh.ts).
    const { json } = await gotoThenApi(page, ROUTES.onboarding, 'POST', /^\/api\/auth\/refresh$/u, [200]);
    const body = asRecord(json, 'POST /api/auth/refresh');
    const root = typeof body.data === 'object' && body.data !== null ? asRecord(body.data, 'refresh.data') : body;
    const uid = stringField(asRecord(root.user, 'refresh.user'), 'id', 'refresh.user');
    const seenKey = `${WELCOME_SEEN_PREFIX}${uid}`;

    await expect(page.getByRole('heading', { level: 1 })).toHaveText('Bắt đầu dự án đầu tiên trong ba bước');
    for (const title of ['Tạo dự án', 'Tải bản vẽ theo từng tầng', 'Duyệt kết quả và dựng 3D']) {
      await expect(page.getByRole('heading', { level: 3, name: title, exact: true })).toBeVisible();
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

/** Địa chỉ và Ghi chú nằm sau nút "Thông tin bổ sung" (StepInfo); mở nếu còn đóng. */
async function openMore(dialog: import('@playwright/test').Locator): Promise<void> {
  const toggle = dialog.getByRole('button', { name: /Thông tin bổ sung/u });
  if ((await toggle.getAttribute('aria-expanded')) === 'false') await toggle.click();
}
