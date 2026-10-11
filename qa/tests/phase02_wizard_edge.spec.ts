/**
 * Phase 2 — create-project wizard EDGE CASES, Track A (admin): the SCR-05 "Tạo dự án mới" dialog opened from `/`.
 * Second edge file for the wizard: `phase02_dashboard_edge.spec.ts` already holds 11 wizard tests (step 1 validation +
 * slug, Esc/close controls on step 1, apply-field heights, basement/add/delete rows, 50-floor cap, review + Back,
 * [held response] busy + double click + undo, 33-char code blocked at step 1, [mocked response] network lost on every attempt).
 * Nothing here repeats them. Inventory rows: `qa/coverage/.phase02-edge-wizard.rows.md` (W42…, merge into phase02.md).
 *
 * Every expected result cites the FE source of this worktree (5afd8b8a) or, written `BE:`, the AppBack source.
 * Source abbreviations (same as coverage/phase02.md):
 *   CPM  src/screens/project/CreateProjectModal/CreateProjectModal.tsx   UCPM useCreateProjectModal.ts (same folder)
 *   SF   StepFloors.tsx (same folder)   CPC CreateProjectModal.container.tsx (same folder)
 *   NF   src/hooks/useNumericField.ts   NFC src/components/ui/NumericField.tsx   NUM src/lib/format/number.ts
 *   INP  src/components/ui/Input.tsx    SEL src/hooks/useSelect.ts   MOD src/components/overlay/Modal.tsx
 *   FT   src/lib/input/focusTrap.ts     FR  src/components/ui/FieldRow.tsx   LIM src/domain/project/limits.ts
 *   RTY  src/lib/http/retry.ts          HTC src/lib/http/client.ts   TAE src/lib/errors/toAppError.ts
 *   CON  src/api/contracts.ts           UPD src/screens/dashboard/ProjectDashboard/useProjectDashboard.ts
 *   BE:schemas  AppBack apps/api/projects/schemas.py   BE:service  apps/api/projects/service.py
 *
 * ## Known bugs pinned here (F:/App/qa-results/BUG-LOG.md)
 * Titles starting `[BUG-NNN]` assert the bug log's "Mong đợi" and are EXPECTED TO FAIL while that bug is open. The
 * evidence shot is taken BEFORE the failing assertion, and source-behaviour checks run first (or as `expect.soft`
 * where the bug check has to come early), so a failing run still documents the whole state.
 *
 * ## Non-serial
 * Every test opens its OWN browser context, its own viewport and its own data (`qa-<runId>-…` names, deleted in
 * `finally` — the fixture project AND anything the wizard created in that context). No test reads another's result.
 * Only the session is carried: the storage state of the previous test's context is handed to the next one; when its
 * cookie is refused (a test died before saving it) the helper signs in again. Same approach as the dashboard edge file.
 *
 * ## Mocks ("[mocked response]" in the title) — only states the shared stack cannot produce safely (6 of 30 = 20 %)
 * - `POST /api/projects` 422 `VALIDATION` with `field` `address` / `code` / `floors.3.name` — paired with the API "create body rules" test
 *   (the real stack cannot reach these 422s any more: the FE blocks 201-char addresses, 33-char codes and blank floor names first).
 * - `POST /api/projects` 500 — unpairable: 5xx.
 * - `POST /api/projects` 503 on the first attempt, the real create on the retry — unpairable: 5xx (503).
 * - `POST /api/projects` network abort on the first attempt, the real create on the retry — unpairable: network loss.
 * "[held response]" = the real response, only delayed, to see a transient state (busy, Esc while busy, double Enter).
 *
 * ## Real-backend request budget per run (BE:apps/api/auth/settings.py:31-36, login_guard.py)
 * - `POST /api/auth/login` (30 / 60 s per IP): ONE UI sign-in when the worker starts this file; Playwright restarts
 *   the worker after a failed test, so +1 per failed test (10 are expected to fail while the bugs are open: the 9
 *   `[BUG-…]` tests + the cap-with-basement case → ≤ 11 sign-ins, each ≥ 10 s apart, ≤ 6 a minute). +1 if a carried cookie is refused. No failed login attempt at all.
 * - `POST /api/auth/refresh` (300 / 60 s per IP): one per page load, ~2 per test (~60 for the file) — far from the cap.
 * - `POST /api/projects` reaching the server: 1 API fixture + 7 UI creates that succeed (all deleted in `finally`)
 *   + no refused 422 (address 201, code 33 and blank floor names are blocked at step 1/2; the 422 mapping is mocked). The mocked 500 and the mocked first
 *   attempts of the 503/abort tests never reach the server; each of those retries creates one project (counted above).
 * - `DELETE /api/projects/{id}`: one per created project (8). No notification, recovery, invitation or mail call.
 * - QA-02 shared-components block (FE 271538cb, last describe, 6 tests): no project created, ~12 refreshes, 0 extra
 *   sign-in, no mock. Expected soft failures there (finding candidates): same-value apply keeps a stale refusal, and the
 *   locked "Có tầng hầm" loses its own description at the cap. NOTE (not edited here): "floor cap with a basement" above
 *   clicks the switch at 50 floors, which 271538cb now disables (UCPM:907) — that click waits out the action timeout.
 * Access tokens live 600 s (BE settings.py:31): each test reuses the token of its own sign-in/refresh.
 */
import { expect, test } from '@playwright/test';
import type { Browser, BrowserContext, Locator, Page, Response, Route } from '@playwright/test';

import { ROUTES } from '../../e2e/fixtures/routes';
import { waitForApi, watchApi } from '../../e2e/fullstack/apiWatch';
import type { ApiEntry, ApiResult } from '../../e2e/fullstack/apiWatch';
import { readBaseUrl } from '../../e2e/fullstack/env';
import { apiBaseUrl } from './support/api';
import { dashboardLoaded, signInAdmin } from './support/auth';
import { TEST_DATA_PREFIX, attachJson, captureEvidence, shootOnSoftFail } from './support/evidence';

/* ---------------------------------------------------------------- constants (each cites its source) */

/** `src/api/endpoints.ts` under the `/api` base (create = CON:202-211 body); refresh = `src/lib/auth/session.ts:43`. */
const SUMMARIES_RE = /^\/api\/project-summaries$/u;
const PROJECTS_API = '/api/projects';
const PROJECTS_RE = /^\/api\/projects$/u;
const REFRESH_PATH = '/api/auth/refresh';
const SESSION_TIMEOUT_MS = 30_000;

const DESKTOP = { width: 1440, height: 900 } as const;
const COMPACT = { width: 375, height: 812 } as const;
type Viewport = { readonly width: number; readonly height: number };

/** Sr-only screen state, CPM:75-83, UCPM:493-511. */
const STATE = { loading: 'đang tải', error: 'lỗi', partial: 'một phần', success: 'thành công', collapsed: 'thu gọn' } as const;
const STATE_RE = /^(rỗng|đang tải|một phần|lỗi|thành công|Không có quyền|thu gọn)$/u;

/* Wizard copy. */
const WIZARD_TITLE = 'Tạo dự án mới'; // CPM:245
const stepLabel = (step: number): string => `Bước ${String(step)} / 3`; // UCPM:684, CPM:259-262
const DISCARD_TITLE = 'Đóng và bỏ các thay đổi chưa lưu?'; // CPM:252
const DISCARD_HINT = 'Nhấn Esc lần nữa hoặc bấm "Đóng, bỏ thay đổi" để đóng.'; // CPM:253
const DISCARD_ACTION = 'Đóng, bỏ thay đổi'; // CPM:254
const CLOSE_DIALOG = 'Đóng hộp thoại'; // MOD:167
const HEIGHT_MISSING = 'Chưa nhập chiều cao thông thuỷ.'; // UCPM:113
const CHAIN_BROKEN = 'Chưa tính được cao độ vì tầng bên dưới còn thiếu chiều cao hợp lệ.'; // UCPM:235
const NUMERIC_MIN = 'Giá trị không nhỏ hơn 2 m.'; // NF:43, LIM:34
const NUMERIC_MAX = 'Giá trị không quá 10 m.'; // NF:44, LIM:35
const APPLY_LABEL = 'Chiều cao áp cho mọi tầng'; // SF:131
const APPLY_ALL = 'Áp cho mọi tầng'; // SF:145
const ADD_FLOOR = 'Thêm tầng'; // SF:127
const BASEMENT_TOGGLE = 'Có tầng hầm'; // SF:38
const BASEMENT_NAME = 'Tầng hầm'; // UCPM:602
const BUILDING_TYPES = ['Nhà ở', 'Thương mại', 'Công nghiệp', 'Hỗn hợp', 'Khác'] as const; // UCPM:71-77
const VALIDATION_DESCRIPTION = 'Kiểm tra lại các trường được đánh dấu rồi thử lại.'; // vi.json:39 (errors.validation)
const UNKNOWN_DESCRIPTION = 'Hệ thống đã ghi nhận và sẽ kiểm tra. Bấm "Tạo dự án" để thử lại — những gì đã nhập vẫn còn.'; // vi.json project.createModal.problems.unknownKeepsForm
const ADDRESS_TOO_LONG = 'Địa chỉ không quá 200 ký tự.'; // vi.json project.createModal.problems.addressTooLong
const CODE_TOO_LONG = 'Mã dự án không quá 32 ký tự.'; // vi.json project.createModal.problems.codeTooLong
const FLOOR_NAME_MISSING = 'Chưa nhập tên tầng.'; // vi.json project.createModal.floors.missingName
const FIX_AT_STEP_1 = 'Sửa ở bước 1'; // vi.json project.createModal.problems.fixAtStep
/** 422 sentences on step 3 / on the field (problems.serverRefusedFieldNotice / serverRefusedField). */
const serverRefusedNotice = (label: string): string => `Máy chủ không nhận ${label} này. Sửa ô được đánh dấu ở bước 1 rồi thử lại.`;
const serverRefusedField = (label: string): string => `Máy chủ không nhận ${label} này. Sửa rồi thử lại.`;
const FLOOR_COUNT_MAX = 50; // LIM:25-27 "basement included"
const createdToast = (name: string): string => `Đã tạo dự án "${name}".`; // UCPM:669
/** BE:schemas:27-28 — code ≤ 32, address ≤ 200; floor name ≥ 1 after trim (:54, `clean_text` :31-39). */
const BE_CODE_MAX = 32;
const BE_ADDRESS_MAX = 200;
/** FT:39-46 — what a Tab press can reach inside the dialog (negative tabindex excluded at :62-64). */
const FOCUSABLE_SELECTOR = 'a[href], button:not([disabled]), input:not([disabled]):not([type="hidden"]), select:not([disabled]), textarea:not([disabled]), [tabindex]';

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

const uniqueName = (slug: string): string => `${TEST_DATA_PREFIX}${slug}-${Date.now().toString(36)}`;
const countApi = (api: readonly ApiEntry[], method: string, path: string, status?: number): number =>
  api.filter((e) => e.method === method && e.path === path && (status === undefined || e.status === status)).length;
/** ASCII only, so the FE `.length` and the BE `len()` (code points, after NFC) agree; never ends in a space. */
const asciiText = (seed: string, length: number): string => `${seed.repeat(Math.ceil(length / seed.length)).slice(0, length - 1)}X`;

/** The BE 422 envelope `{code, requestId, field}` (BE:apps/api/core/errors.py:80-85, :136-157), as a `route.fulfill` argument. */
const validation422 = (field: string): Parameters<Route['fulfill']>[0] => ({
  status: 422,
  contentType: 'application/json',
  body: JSON.stringify({ code: 'VALIDATION', requestId: 'qa-mocked-response', field }),
});

/** A promise the test opens by hand — holds a real response ("[held response]"). */
function gate(): { readonly wait: Promise<void>; readonly open: () => void } {
  let open: () => void = () => undefined;
  const wait = new Promise<void>((resolve) => {
    open = resolve;
  });
  return { wait, open };
}

/**
 * BUG-141: the shared `navigateThenWaitForApi` (e2e/fullstack/apiWatch.ts) used to await `navigate()` BEFORE it registered
 * the wait, so a response that landed before `goto/reload({ waitUntil: 'commit' })` returned was missed and the test timed
 * out on a loaded page. The shared helper registers first since FIX-986 (and ignores responses of the old document); this
 * local one, which waits first and runs both together, is kept as it was.
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

/** Every `POST /api/projects` this page sends goes through `handler` (attempt = 1, 2, …); other methods pass. */
async function routeCreate(page: Page, handler: (route: Route, attempt: number) => Promise<void>): Promise<string[]> {
  const keys: string[] = [];
  await page.route((url) => url.pathname === PROJECTS_API, async (route) => {
    if (route.request().method() !== 'POST') {
      await route.fallback();
      return;
    }
    keys.push(route.request().headers()['idempotency-key'] ?? '');
    await handler(route, keys.length);
  });
  return keys;
}

/* ---------------------------------------------------------------- locators (labels verified in src/) */

const dashboardHeading = (page: Page): Locator => page.getByRole('heading', { name: 'Dự án của tôi', exact: true }); // PD:198
const newProjectButton = (page: Page): Locator => page.getByRole('button', { name: /^Dự án mới/u }); // PD:188-190 (+ "N" hint)
const projectList = (page: Page): Locator => page.getByRole('list', { name: 'Danh sách dự án', exact: true }); // PD:151
const projectCard = (page: Page, name: string): Locator => projectList(page).getByRole('listitem', { name, exact: true }); // PCT:68-72
const wizard = (page: Page): Locator => page.getByRole('dialog', { name: WIZARD_TITLE, exact: true }); // CPM:243-245
const toastWith = (page: Page, text: string): Locator => page.getByRole('status').filter({ hasText: text }); // TST:117
const stateAnnouncement = (scope: Locator): Locator => scope.getByRole('status').filter({ hasText: STATE_RE }); // CPM:298-300
const nameField = (dialog: Locator): Locator => dialog.getByLabel('Tên dự án'); // CPM:100-108
const codeField = (dialog: Locator): Locator => dialog.getByLabel('Mã dự án'); // CPM:109-115
const addressField = (dialog: Locator): Locator => dialog.getByLabel('Địa chỉ'); // CPM:118-123
const notesField = (dialog: Locator): Locator => dialog.getByLabel('Ghi chú'); // CPM:143-149
const buildingType = (dialog: Locator): Locator => dialog.getByRole('combobox'); // CPM:124-141, Select.tsx:136
const nextButton = (dialog: Locator): Locator => dialog.getByRole('button', { name: 'Tiếp tục', exact: true }); // CPM:288-290
const createButton = (dialog: Locator): Locator => dialog.getByRole('button', { name: 'Tạo dự án', exact: true }); // CPM:292-294
const backButton = (dialog: Locator): Locator => dialog.getByRole('button', { name: 'Quay lại', exact: true }); // CPM:278-280
const cancelButton = (dialog: Locator): Locator => dialog.getByRole('button', { name: 'Huỷ', exact: true }); // CPM:284-286
const stepText = (dialog: Locator, step: number): Locator => dialog.getByText(stepLabel(step), { exact: true }).first();
const discardWarning = (dialog: Locator): Locator => dialog.getByText(DISCARD_TITLE, { exact: true });
const applyField = (dialog: Locator): Locator => dialog.getByLabel(APPLY_LABEL); // SF:130-138
const applyButton = (dialog: Locator): Locator => dialog.getByRole('button', { name: APPLY_ALL, exact: true }); // SF:139-146
const addFloorButton = (dialog: Locator): Locator => dialog.getByRole('button', { name: ADD_FLOOR, exact: true }); // SF:120-128
const basementSwitch = (dialog: Locator): Locator => dialog.getByRole('switch', { name: BASEMENT_TOGGLE }); // SF:34-40, Toggle.tsx:80-86
const floorNameBoxes = (dialog: Locator): Locator => dialog.getByRole('textbox', { name: /^Tên tầng/u }); // SF:87-92
const floorNameBox = (dialog: Locator, floor: string): Locator => dialog.getByRole('textbox', { name: `Tên tầng ${floor}`, exact: true });
const heightBox = (dialog: Locator, floor: string): Locator =>
  dialog.getByRole('textbox', { name: `Chiều cao thông thuỷ tầng ${floor}`, exact: true }); // SF:95-104
const deleteFloorButton = (dialog: Locator, floor: string): Locator => dialog.getByRole('button', { name: `Xoá ${floor}`, exact: true }); // SF:108-113
/** One floor row of step 2, found by its name box (SF:78-115). */
const floorRow = (dialog: Locator, page: Page, floor: string): Locator =>
  dialog.getByRole('row').filter({ has: page.getByRole('textbox', { name: `Tên tầng ${floor}`, exact: true }) });
const elevationCell = (row: Locator): Locator => row.getByRole('cell').nth(2); // SF:106
/** Step 3 value cell: FieldRow label span → its column div → the sibling value column (FR:66-76). */
const reviewValue = (dialog: Locator, label: string): Locator =>
  dialog.getByText(label, { exact: true }).locator('xpath=../following-sibling::div[1]');
/** `Modal.Body` (MOD:182-191): header, body, footer, then the sr-only state span. */
const modalBody = (dialog: Locator): Locator => dialog.locator('xpath=./div[2]');

async function openWizard(page: Page): Promise<Locator> {
  await newProjectButton(page).click();
  const dialog = wizard(page);
  await expect(stepText(dialog, 1)).toBeVisible();
  return dialog;
}

/** The `N` shortcut (UPD:382-385): from the heading so no text field has the focus (shortcutRegistry.ts:23-26). */
async function openWizardWithN(page: Page): Promise<Locator> {
  await dashboardHeading(page).click();
  await page.keyboard.press('n');
  const dialog = wizard(page);
  await expect(stepText(dialog, 1)).toBeVisible();
  return dialog;
}

/** Dirty form: "Huỷ" asks first, "Đóng, bỏ thay đổi" closes (UCPM:624-639). */
async function discardWizard(dialog: Locator): Promise<void> {
  await cancelButton(dialog).click();
  await dialog.getByRole('button', { name: DISCARD_ACTION, exact: true }).click();
  await expect(dialog).toHaveCount(0);
}

/** Keyboard press of a button — used at 375 px where the 560 px dialog puts it off screen (CPM:63-64). */
async function pressButton(page: Page, button: Locator): Promise<void> {
  await button.focus();
  await page.keyboard.press('Enter');
}

async function toStep2(dialog: Locator, name: string): Promise<void> {
  await nameField(dialog).fill(name);
  await nextButton(dialog).click();
  await expect(stepText(dialog, 2)).toBeVisible();
}

/**
 * Types a height into a NumericField and blurs: NF:105-111 commits on blur.
 * BUG-224: focusing the box makes `handleFocus` (NF:103-111) write the committed value back into it; a `fill()` fired
 * right after the focus raced that render and left "32.500" / "10abc". So: focus, let the render land (two frames),
 * select all, insert the text in one go, check it is exactly what was typed, then Tab.
 */
async function typeHeight(field: Locator, text: string): Promise<void> {
  const page = field.page();
  await field.focus();
  await page.evaluate(() => new Promise<void>((resolve) => requestAnimationFrame(() => requestAnimationFrame(() => resolve()))));
  await field.press('Control+A');
  if (text === '') await field.press('Delete');
  else await page.keyboard.insertText(text);
  await expect(field).toHaveValue(text);
  await field.press('Tab');
}

/** Shared height, committed then applied to every row (UCPM:590-594). */
async function applyHeight(dialog: Locator, metres: string): Promise<void> {
  await typeHeight(applyField(dialog), metres);
  await expect(applyButton(dialog)).toBeEnabled();
  await applyButton(dialog).click();
}

/** Step 1 → 3 with a 3 m stack, the shortest valid path. */
async function toReview(dialog: Locator, name: string): Promise<void> {
  await toStep2(dialog, name);
  await applyHeight(dialog, '3');
  await nextButton(dialog).click();
  await expect(stepText(dialog, 3)).toBeVisible();
}

/** The Tab ring of the dialog (FT:56-68) and where the focus sits in it (-1 = not on a ring element). */
interface FocusRing {
  readonly labels: readonly string[];
  readonly index: number;
}
const focusRing = (dialog: Locator): Promise<FocusRing> =>
  dialog.evaluate((root, selector) => {
    const describe = (el: HTMLElement): string => {
      const labelled = el.id === '' ? null : document.querySelector(`label[for="${CSS.escape(el.id)}"]`);
      return el.getAttribute('aria-label') ?? labelled?.textContent ?? ((el.textContent ?? '').trim() || el.tagName);
    };
    const ring = Array.from(root.querySelectorAll<HTMLElement>(selector)).filter(
      (el) => !(Number.parseInt(el.getAttribute('tabindex') ?? '0', 10) < 0) && el.closest('[hidden], [aria-hidden="true"]') === null,
    );
    return { labels: ring.map(describe), index: ring.indexOf(document.activeElement as HTMLElement) };
  }, FOCUSABLE_SELECTOR);
const focusIsInside = (dialog: Locator): Promise<boolean> =>
  dialog.evaluate((root) => root !== document.activeElement && root.contains(document.activeElement));
const focusedLabel = async (dialog: Locator): Promise<string> => {
  const ring = await focusRing(dialog);
  return ring.labels[ring.index] ?? '(outside the Tab ring)';
};
const topOf = async (locator: Locator): Promise<number> => (await locator.boundingBox())?.y ?? Number.NaN;

/* ---------------------------------------------------------------- session + fixtures (same as phase02_dashboard_edge) */

type StorageState = Awaited<ReturnType<BrowserContext['storageState']>>;

/** Storage state of the last closed context — its refresh cookie is the live one. Reset with the worker. */
let carriedState: StorageState | undefined;

interface Admin {
  readonly context: BrowserContext;
  readonly page: Page;
  readonly api: ApiEntry[];
  /** Access token of this context's latest refresh — sent as Bearer by the fixture calls, never logged. */
  readonly token: string;
  /** Project ids this test owns; deleted when the context closes. */
  readonly cleanup: string[];
}

/** Refresh body: `accessToken`/`access_token`, optional `data` wrapper (src/lib/auth/refresh.ts:85-100). */
function readToken(json: unknown): string {
  const body = asRecord(json, 'POST /api/auth/refresh');
  const root = typeof body.data === 'object' && body.data !== null ? asRecord(body.data, 'refresh.data') : body;
  const token =
    typeof root.accessToken === 'string' ? root.accessToken : typeof root.access_token === 'string' ? root.access_token : '';
  if (token === '') throw new Error('POST /api/auth/refresh: no access token in the body');
  return token;
}

const waitToken = (page: Page): Promise<string> => {
  const pending = page
    .waitForResponse(
      (r: Response) => r.request().method() === 'POST' && new URL(r.url()).pathname === REFRESH_PATH && r.status() === 200,
      { timeout: SESSION_TIMEOUT_MS },
    )
    .then(async (r) => readToken(await r.json()));
  pending.catch(() => undefined);
  return pending;
};

async function openAdmin(browser: Browser, viewport: Viewport): Promise<Admin> {
  const context = await browser.newContext({
    baseURL: readBaseUrl(),
    viewport,
    ...(carriedState !== undefined ? { storageState: carriedState } : {}),
  });
  try {
    const page = await context.newPage();
    const api = watchApi(page);
    let token = waitToken(page);
    let landed: 'session' | 'login' = 'login';
    if (carriedState !== undefined) {
      await page.goto(ROUTES.dashboard, { waitUntil: 'commit' });
      landed = await Promise.race([
        token.then(() => 'session' as const),
        page.waitForURL((url) => url.pathname === ROUTES.login, { timeout: SESSION_TIMEOUT_MS }).then(() => 'login' as const),
      ]);
    }
    if (landed === 'login') {
      // No carried state, or its cookie was refused (SessionBootstrap sent us to /login): one real sign-in.
      token = waitToken(page);
      await signInAdmin(page);
    }
    const resolved = await token;
    await dashboardLoaded(page);
    return { context, page, api, token: resolved, cleanup: [] };
  } catch (error) {
    await context.close();
    throw error;
  }
}

const bearer = (admin: Admin): Record<string, string> => ({ Origin: apiBaseUrl(), Authorization: `Bearer ${admin.token}` });

/** Fixture project through the real API (BE:router.py:54-63, `name` 3–80 chars, BE:schemas:25-26). */
async function createProject(admin: Admin, name: string): Promise<string> {
  const response = await admin.page.request.post(PROJECTS_API, { headers: bearer(admin), data: { name } });
  expect(response.status(), `fixture POST ${PROJECTS_API} "${name}"`).toBe(201);
  const id = stringField(asRecord(await response.json(), 'POST /api/projects'), 'id', 'POST /api/projects');
  admin.cleanup.push(id);
  return id;
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
    await admin.page.request.delete(`${PROJECTS_API}/${id}`, { headers: bearer(admin) }).catch(() => undefined);
  }
  try {
    carriedState = await admin.context.storageState();
  } catch {
    carriedState = undefined;
  }
  await admin.context.close().catch(() => undefined);
}

async function withAdmin(browser: Browser, body: (admin: Admin) => Promise<void>, viewport: Viewport = DESKTOP): Promise<void> {
  const admin = await openAdmin(browser, viewport);
  try {
    await body(admin);
  } finally {
    await unrouteAll(admin.page);
    await closeAdmin(admin);
  }
}

async function unrouteAll(page: Page): Promise<void> {
  await page.unrouteAll({ behavior: 'ignoreErrors' }).catch(() => undefined);
}

/* ================================================================= step 1 + keyboard + focus */

test.describe('E02 SCR-05 wizard edge — step 1, keyboard and focus', () => {
  test('[BUG-133] E02 · wizard opened with "N" is pristine (no error, focus in "Tên dự án"); "n" off-field is swallowed by the dialog, in-field it types', async ({ browser }) => {
    // BUG-133 fixed: the name's complaint ("Chưa nhập tên dự án.") waits for the first keystroke (`nameTouched`);
    // a neutral hint (nameHint) shows instead. FT:179 focuses the first focusable (MOD:163-171 X).
    await withAdmin(browser, async (admin) => {
      const { page } = admin;
      const dialog = await openWizardWithN(page);
      await expect.poll(() => focusIsInside(dialog), 'focus trap activated (MOD:59-72)').toBe(true);
      const pristine = {
        alerts: await dialog.getByRole('alert').allInnerTexts(),
        nameInvalid: await nameField(dialog).getAttribute('aria-invalid'),
        focused: await focusedLabel(dialog),
      };
      await captureEvidence(page, 'E02_wiz_n_pristine.png', { caption: `opened with "n"; focus on "${pristine.focused}"` });
      await attachJson('E02_wiz_n_pristine.json', pristine);
      expect.soft(pristine.alerts, 'no error on a form nobody touched (BUG-133)').toEqual([]);
      expect.soft(pristine.nameInvalid, '"Tên dự án" not aria-invalid (INP:91) before a touch').toBeNull();
      expect.soft(pristine.focused, 'initial focus in "Tên dự án" (BUG-133)').toBe('Tên dự án');

      // Source behaviour: the dialog scope is modal (shortcutRegistry.ts:16-21, MOD:77-80) — "n" off a text field opens
      // nothing and changes nothing; inside the field it is plain typing.
      await nameField(dialog).fill('ab');
      await dialog.getByRole('button', { name: CLOSE_DIALOG, exact: true }).focus();
      await page.keyboard.press('n');
      await expect(page.getByRole('dialog')).toHaveCount(1);
      await expect(nameField(dialog)).toHaveValue('ab');
      await expect(stepText(dialog, 1)).toBeVisible();
      await nameField(dialog).press('End');
      await page.keyboard.press('n');
      await expect(nameField(dialog)).toHaveValue('abn');
      await expect(dialog.getByRole('alert')).toHaveCount(0); // 3 chars → UCPM:147-149 satisfied
      await discardWizard(dialog);
    });
  });

  test('E02 · wizard focus trap: Tab / Shift+Tab wrap inside the dialog on steps 1 and 2; closing returns focus to "Dự án mới"', async ({ browser }) => {
    await withAdmin(browser, async (admin) => {
      const { page } = admin;
      const dialog = await openWizard(page);
      await expect.poll(() => focusIsInside(dialog)).toBe(true);
      const report: Record<string, unknown> = {};

      for (const step of [1, 2] as const) {
        if (step === 2) {
          await nameField(dialog).fill('Dự án bẫy focus');
          await nextButton(dialog).click();
          await expect(stepText(dialog, 2)).toBeVisible();
        }
        const ring = await focusRing(dialog);
        report[`step${String(step)}`] = ring.labels;
        const last = ring.labels.length - 1;
        expect(last, `step ${String(step)} has several focusable controls`).toBeGreaterThan(0);
        // FT:131-134: Shift+Tab on the first lands on the last, Tab on the last lands on the first.
        await dialog.getByRole('button', { name: CLOSE_DIALOG, exact: true }).focus(); // first in DOM (MOD:163-171)
        expect((await focusRing(dialog)).index).toBe(0);
        await page.keyboard.press('Shift+Tab');
        expect((await focusRing(dialog)).index, `step ${String(step)}: Shift+Tab from the first`).toBe(last);
        await page.keyboard.press('Tab');
        expect((await focusRing(dialog)).index, `step ${String(step)}: Tab from the last`).toBe(0);
        for (let press = 0; press <= last + 1; press += 1) {
          await page.keyboard.press('Tab');
          expect(await focusIsInside(dialog), `step ${String(step)} Tab #${String(press + 1)} stays inside`).toBe(true);
        }
      }
      await captureEvidence(page, 'E02_wiz_focus_trap.png', { caption: `step 2 focus cycle: ${(report.step2 as string[]).join(' → ')}` });
      await attachJson('E02_wiz_focus_trap.json', report);

      await discardWizard(dialog);
      await expect(newProjectButton(page), 'focus goes home to the opener (FT:138-142)').toBeFocused();
    });
  });

  test('E02 · wizard "Loại công trình" by keyboard: arrows open on the current value and wrap, Enter selects, Tab closes without selecting; review shows it', async ({ browser }) => {
    await withAdmin(browser, async (admin) => {
      const { page } = admin;
      const dialog = await openWizard(page);
      const combo = buildingType(dialog);
      const listbox = page.getByRole('listbox');
      await expect(combo).toContainText(BUILDING_TYPES[0]); // UCPM:79

      await combo.focus();
      await page.keyboard.press('ArrowDown'); // SEL:42-46 opens, highlight = current (SEL:24-29)
      await expect(listbox).toBeVisible();
      await expect(combo).toHaveAttribute('aria-expanded', 'true'); // Select.tsx:139
      await expect(listbox.getByRole('option', { name: BUILDING_TYPES[0] })).toHaveAttribute('aria-selected', 'true');
      await page.keyboard.press('ArrowDown');
      await page.keyboard.press('ArrowDown'); // 0 → 2
      await page.keyboard.press('Enter'); // SEL:63-71
      await expect(listbox).toHaveCount(0);
      await expect(combo).toContainText(BUILDING_TYPES[2]);
      await expect(combo).toBeFocused(); // SEL:31-34

      await page.keyboard.press('ArrowUp'); // opens on "Công nghiệp" (2)
      await expect(listbox).toBeVisible();
      for (let press = 0; press < 3; press += 1) await page.keyboard.press('ArrowUp'); // 2 → 1 → 0 → 4 (SEL:59-62 wraps)
      await page.keyboard.press('Enter');
      await expect(combo).toContainText(BUILDING_TYPES[4]);

      await page.keyboard.press('Enter'); // opens on "Khác" (4)
      await expect(listbox).toBeVisible();
      await page.keyboard.press('ArrowDown'); // 4 → 0, not chosen
      await captureEvidence(page, 'E02_wiz_type_keyboard.png', { caption: 'list open, highlight moved to "Nhà ở", not chosen yet' });
      await page.keyboard.press('Tab'); // SEL:72-74 closes, keeps the value
      await expect(listbox).toHaveCount(0);
      await expect(combo).toContainText(BUILDING_TYPES[4]);
      await expect(dialog, 'Tab closing the list never closes the dialog').toBeVisible();

      await toReview(dialog, 'Dự án loại khác');
      await expect(reviewValue(dialog, 'Loại công trình')).toHaveText(BUILDING_TYPES[4]); // CPM:164-165,177
      await discardWizard(dialog);
    });
  });

  test('[BUG-122] E02 · wizard header: the gap between "Tạo dự án mới" and "Bước 1 / 3" fits one 24 px grid step', async ({ browser }) => {
    // EXPECTED TO FAIL while BUG-122 is open: MOD:157 header pb-4 + CPM:247 body py-6 + CPM:259 mb-4 stack up.
    await withAdmin(browser, async (admin) => {
      const { page } = admin;
      const dialog = await openWizard(page);
      const title = dialog.getByRole('heading', { name: WIZARD_TITLE, exact: true }); // MOD:160
      const indicator = dialog.locator('p').filter({ hasText: /^Bước 1 \/ 3$/u }); // CPM:259
      const titleBox = await title.boundingBox();
      const indicatorBox = await indicator.boundingBox();
      if (titleBox === null || indicatorBox === null) throw new Error('title or step indicator not laid out');
      const gap = indicatorBox.y - (titleBox.y + titleBox.height);
      const fontSize = await indicator.evaluate((el) => getComputedStyle(el).fontSize);
      await captureEvidence(page, 'E02_wiz_header_gap.png', { caption: `title → "Bước 1 / 3" gap ${gap.toFixed(1)} px, indicator ${fontSize}` });
      await attachJson('E02_wiz_header_gap.json', { gapPx: gap, titleBox, indicatorBox, indicatorFontSize: fontSize });
      expect(gap, 'header gap ≤ one 24 px grid step (BUG-122 "Mong đợi")').toBeLessThanOrEqual(24);
      await page.keyboard.press('Escape');
      await expect(dialog).toHaveCount(0);
    });
  });
});

/* ================================================================= step 2 floors */

test.describe('E02 SCR-05 wizard edge — step 2 floors', () => {
  test('E02 · wizard row height parsing: "3,5" / "3.5" / "  2,5 " / "1e1" commit; "-3" and "10,01" are refused and keep the height; "" and "abc" erase it', async ({ browser }) => {
    await withAdmin(browser, async (admin) => {
      const { page } = admin;
      const dialog = await openWizard(page);
      await toStep2(dialog, 'Dự án nhập chiều cao');
      await applyHeight(dialog, '3');
      const ground = heightBox(dialog, 'Tầng trệt');
      const groundRow = floorRow(dialog, page, 'Tầng trệt');
      const floor1 = elevationCell(floorRow(dialog, page, 'Tầng 1'));
      await expect(floor1).toHaveText('3,0 m');

      // number.ts parseNumber: trim; a dot is a thousands mark only beside a comma or in exact 3-digit groups ("3.5" = 3,5, BUG-132); parseFloat. The next floor sits on this one's ceiling (UCPM:256-276).
      for (const [typed, level] of [['3,5', '3,5 m'], ['3.5', '3,5 m'], ['  2,5 ', '2,5 m'], ['1e1', '10,0 m']] as const) {
        await typeHeight(ground, typed);
        await expect(floor1, `"${typed}" on "Tầng trệt"`).toHaveText(level);
      }
      // "1e1" is parseFloat's scientific notation — accepted as 10 m (NUM:263), worth knowing.

      // NF:41-46 refuses out-of-range and never commits (NF:58): the row keeps 10 m, the field shows the local error
      // (row.problem is null so NFC:62 `error || props.error` is not overridden by the spread at NFC:71).
      for (const [typed, message] of [['-3', NUMERIC_MIN], ['10,01', NUMERIC_MAX]] as const) {
        await typeHeight(ground, typed);
        await expect(groundRow.getByRole('alert'), `"${typed}" refused`).toHaveText(message);
        await expect(floor1, `"${typed}" keeps the committed 10 m`).toHaveText('10,0 m');
      }
      await captureEvidence(page, 'E02_wiz_row_height_refused.png', { caption: `"10,01" on "Tầng trệt" → "${NUMERIC_MAX}", 10 m kept` });

      // "" → parseNumber undefined → onChange(undefined) → height erased (UCPM:578-583): the row says so, the chain above breaks.
      await typeHeight(heightBox(dialog, 'Tầng 2'), '');
      await expect(floorRow(dialog, page, 'Tầng 2').getByRole('alert')).toHaveText(HEIGHT_MISSING);
      await expect(elevationCell(floorRow(dialog, page, 'Tầng 2'))).toHaveText('—');
      await expect(floorRow(dialog, page, 'Tầng 3').getByRole('alert')).toHaveText(CHAIN_BROKEN);
      await expect(floor1).toHaveText('10,0 m');
      await typeHeight(heightBox(dialog, 'Tầng 2'), '3');
      await expect(floorRow(dialog, page, 'Tầng 3').getByRole('alert')).toHaveCount(0);

      // "abc" is NOT refused like "-3": parseFloat gives NaN → undefined → the committed height is silently erased.
      await typeHeight(ground, 'abc');
      await expect(groundRow.getByRole('alert')).toHaveText(HEIGHT_MISSING);
      for (const floor of ['Tầng 1', 'Tầng 2', 'Tầng 3']) {
        await expect(floorRow(dialog, page, floor).getByRole('alert')).toHaveText(CHAIN_BROKEN);
      }
      await expect(floor1).toHaveText('—');
      await expect(nextButton(dialog)).toBeDisabled(); // UCPM:487
      await captureEvidence(page, 'E02_wiz_row_height_erased.png', { caption: '"abc" on "Tầng trệt" erased the 10 m height' });
      await discardWizard(dialog);
    });
  });

  test('[BUG-132] E02 · wizard apply field: "3.5" after a 3 m apply keeps the floors and applies 3,5 m', async ({ browser }) => {
    // BUG-132 fixed: parseNumber reads a lone dot as a decimal point, so "3.5" commits as 3,5 m (it used to drop the dot → 35 → refused,
    // leaving the stale 3 m for "Áp cho mọi tầng").
    await withAdmin(browser, async (admin) => {
      const { page } = admin;
      const dialog = await openWizard(page);
      await toStep2(dialog, 'Dự án áp 3.5');
      await applyHeight(dialog, '3');
      const floor1 = elevationCell(floorRow(dialog, page, 'Tầng 1'));
      await expect(floor1).toHaveText('3,0 m');

      await typeHeight(applyField(dialog), '3.5');
      const state = {
        fieldShows: await applyField(dialog).inputValue(),
        fieldErrors: await applyField(dialog).locator('xpath=ancestor::div[contains(@class,"flex-col")][1]').getByRole('alert').allInnerTexts(),
        applyEnabled: await applyButton(dialog).isEnabled(),
      };
      await captureEvidence(page, 'E02_wiz_apply_3dot5.png', { caption: `apply field after "3.5"+Tab shows "${state.fieldShows}", errors ${JSON.stringify(state.fieldErrors)}` });
      await attachJson('E02_wiz_apply_3dot5.json', state);
      await expect(floor1, 'typing in the apply field never erases the floors (BUG-132 "Mong đợi")').toHaveText('3,0 m');
      expect.soft(state.fieldErrors, '3.5 is inside 2–10 m: no max-range error').not.toContain(NUMERIC_MAX);

      await applyButton(dialog).click();
      await expect(floor1, '"3.5" applied as 3,5 m (BUG-132 "Mong đợi")').toHaveText('3,5 m');
      await discardWizard(dialog);
    });
  });

  test('E02 · wizard "Áp cho mọi tầng" then edit one row restacks the levels; applying again overwrites the edit; a new row starts empty', async ({ browser }) => {
    await withAdmin(browser, async (admin) => {
      const { page } = admin;
      const dialog = await openWizard(page);
      await toStep2(dialog, 'Dự án sửa một tầng');
      await applyHeight(dialog, '3');
      const level = (floor: string): Locator => elevationCell(floorRow(dialog, page, floor));

      await typeHeight(heightBox(dialog, 'Tầng 1'), '4'); // UCPM:578-583
      // 0 → 3 → 3+4 → 7+3 (UCPM:256-276, alignFloors.ts:451-453)
      for (const [floor, at] of [['Tầng trệt', '0,0 m'], ['Tầng 1', '3,0 m'], ['Tầng 2', '7,0 m'], ['Tầng 3', '10,0 m']] as const) {
        await expect(level(floor)).toHaveText(at);
      }
      await expect(applyField(dialog), 'the apply field keeps its value (UCPM:468, :585-587)').toHaveValue('3');
      await captureEvidence(page, 'E02_wiz_apply_then_edit.png', { caption: 'apply 3 m, then "Tầng 1" = 4 m' });

      await addFloorButton(dialog).click(); // UCPM:559-566: new row, no height
      await expect(floorRow(dialog, page, 'Tầng 4').getByRole('alert')).toHaveText(HEIGHT_MISSING);
      await applyButton(dialog).click(); // UCPM:593 writes EVERY row — the 4 m edit is gone too
      await expect(heightBox(dialog, 'Tầng 1')).toHaveValue('3');
      await expect(level('Tầng 2')).toHaveText('6,0 m');
      await expect(level('Tầng 4')).toHaveText('12,0 m');
      await expect(dialog.getByRole('table').getByRole('alert')).toHaveCount(0);
      await expect(nextButton(dialog)).toBeEnabled();
      await captureEvidence(page, 'E02_wiz_apply_overwrites.png');
      await discardWizard(dialog);
    });
  });

  test('E02 · wizard basement by keyboard: Space toggles it, its own height sets a negative level, "Thêm tầng" still names "Tầng 4", deleting the row unticks the switch', async ({ browser }) => {
    await withAdmin(browser, async (admin) => {
      const { page } = admin;
      const dialog = await openWizard(page);
      await toStep2(dialog, 'Dự án tầng hầm');
      const basement = basementSwitch(dialog);
      await basement.focus();
      await page.keyboard.press('Space'); // Toggle.tsx:80-92 is a <button role=switch>
      await expect(basement).toHaveAttribute('aria-checked', 'true');
      await expect(floorNameBoxes(dialog)).toHaveCount(5);
      await expect(floorNameBoxes(dialog).first()).toHaveAttribute('aria-label', `Tên tầng ${BASEMENT_NAME}`); // UCPM:602 first

      await applyHeight(dialog, '3');
      await typeHeight(heightBox(dialog, BASEMENT_NAME), '4');
      await expect(elevationCell(floorRow(dialog, page, BASEMENT_NAME))).toHaveText(/^[-−]4,0 m$/u); // UCPM:285-289
      await expect(elevationCell(floorRow(dialog, page, 'Tầng trệt'))).toHaveText('0,0 m'); // the datum never moves
      await typeHeight(heightBox(dialog, BASEMENT_NAME), '10');
      await expect(elevationCell(floorRow(dialog, page, BASEMENT_NAME))).toHaveText(/^[-−]10,0 m$/u); // ≥ -30 m (LIM:30)

      await addFloorButton(dialog).click(); // aboveCount counts kind 'floor' only (UCPM:563)
      await expect(floorNameBox(dialog, 'Tầng 4')).toBeVisible();
      await expect(floorNameBox(dialog, 'Tầng 5')).toHaveCount(0);
      await captureEvidence(page, 'E02_wiz_basement_keyboard.png', { caption: 'basement -10,0 m; "Thêm tầng" → "Tầng 4"' });

      await deleteFloorButton(dialog, BASEMENT_NAME).click(); // hasBasement is derived from the rows (UCPM:697)
      await expect(basement).toHaveAttribute('aria-checked', 'false');
      await basement.focus();
      await page.keyboard.press('Space');
      // A fresh basement row, no height (UCPM:602) — the rest of the stack is untouched.
      await expect(floorRow(dialog, page, BASEMENT_NAME).getByRole('alert')).toHaveText(HEIGHT_MISSING);
      await expect(elevationCell(floorRow(dialog, page, 'Tầng 1'))).toHaveText('3,0 m');
      await expect(nextButton(dialog)).toBeDisabled();
      await discardWizard(dialog);
    });
  });

  test('E02 · wizard floor rows by keyboard: typing a new name keeps the focus, Enter on "Xoá Tầng 2" removes it, focus stays trapped; the next "Thêm tầng" repeats "Tầng 3"', async ({ browser }) => {
    await withAdmin(browser, async (admin) => {
      const { page } = admin;
      const dialog = await openWizard(page);
      await toStep2(dialog, 'Dự án đổi tên tầng');

      const box = floorNameBox(dialog, 'Tầng 1');
      await box.focus();
      await page.keyboard.press('Control+A');
      await page.keyboard.type('Tầng lửng'); // UCPM:573-576; the label follows the value (SF:91)
      // MOD:45-55: onClose kept in a ref so typing never re-activates the trap and steals the focus.
      await expect(floorNameBox(dialog, 'Tầng lửng')).toBeFocused();
      await expect(deleteFloorButton(dialog, 'Tầng lửng')).toBeVisible(); // SF:110

      await pressButton(page, deleteFloorButton(dialog, 'Tầng 2')); // SF:108-113 → UCPM:568-571
      await expect(floorNameBox(dialog, 'Tầng 2')).toHaveCount(0);
      await expect(floorNameBoxes(dialog)).toHaveCount(3);
      await page.keyboard.press('Tab'); // the pressed button is gone; FT:129-134 pulls the focus back in
      expect(await focusIsInside(dialog), 'focus inside the dialog after the row left').toBe(true);

      // nextFloorName(aboveCount) (UCPM:185-187, :563) counts rows, not names: 3 rows → "Tầng 3", already taken.
      await addFloorButton(dialog).click();
      await expect(floorNameBox(dialog, 'Tầng 3')).toHaveCount(2);
      await expect(deleteFloorButton(dialog, 'Tầng 3')).toHaveCount(2);
      await captureEvidence(page, 'E02_wiz_rows_keyboard.png', { caption: 'after deleting "Tầng 2", "Thêm tầng" adds a second "Tầng 3"' });
      await attachJson('E02_wiz_rows_keyboard.json', { names: await floorNameBoxes(dialog).evaluateAll((els) => els.map((el) => (el as HTMLInputElement).value)) });
      await discardWizard(dialog);
    });
  });

  test('E02 · wizard floor cap with a basement: at 50 floors "Có tầng hầm" is locked, so no 51st row (LIM:25 "basement included")', async ({ browser }) => {
    // BUG-221: since BUG-150/BUG-177 the switch is disabled at the cap (described by the cap note); clicking a disabled
    // button only times out, so the case asserts the lock and the 50 rows instead.
    test.setTimeout(240_000);
    await withAdmin(browser, async (admin) => {
      const { page } = admin;
      const dialog = await openWizard(page);
      await toStep2(dialog, 'Dự án năm mươi tầng hầm');
      const add = addFloorButton(dialog);
      for (let floors = 4; floors < FLOOR_COUNT_MAX; floors += 1) await add.click();
      await expect(floorNameBoxes(dialog)).toHaveCount(FLOOR_COUNT_MAX);
      await expect(add).toBeDisabled(); // UCPM:490, SF:125

      await expect(basementSwitch(dialog)).toBeDisabled();
      await expect(basementSwitch(dialog)).toHaveAttribute('aria-checked', 'false');
      const rows = await floorNameBoxes(dialog).count();
      await basementSwitch(dialog).scrollIntoViewIfNeeded(); // the switch sits above the list (SF:43-50)
      await captureEvidence(page, 'E02_wiz_cap_basement.png', { caption: `50 floors, top of step 2: "Có tầng hầm" locked ("Thêm tầng" too, asserted) → ${String(rows)} rows` });
      await attachJson('E02_wiz_cap_basement.json', { rows, limit: FLOOR_COUNT_MAX, basementChecked: await basementSwitch(dialog).getAttribute('aria-checked') });
      expect(rows, `at most ${String(FLOOR_COUNT_MAX)} rows, basement included (LIM:25-27)`).toBeLessThanOrEqual(FLOOR_COUNT_MAX);
      await discardWizard(dialog);
    });
  });

  test('[BUG-120] E02 · wizard step 2 opens neutral: no row is flagged before any height is typed', async ({ browser }) => {
    // BUG-120 fixed (FIX-1011): rows complain only once a height is typed or applied (UCPM:696-698 floorsTouched).
    await withAdmin(browser, async (admin) => {
      const { page } = admin;
      const dialog = await openWizard(page);
      await toStep2(dialog, 'Dự án tầng chưa nhập');
      const table = dialog.getByRole('table');
      await expect(floorNameBoxes(dialog)).toHaveCount(4);
      const fresh = {
        alerts: await table.getByRole('alert').allInnerTexts(),
        invalidFields: await table.locator('[aria-invalid="true"]').count(),
        nextEnabled: await nextButton(dialog).isEnabled(),
        nextDescribedBy: await nextButton(dialog).getAttribute('aria-describedby'),
      };
      await captureEvidence(page, 'E02_wiz_step2_fresh.png', { caption: `fresh step 2: ${String(fresh.alerts.length)} row errors` });
      await attachJson('E02_wiz_step2_fresh.json', fresh);
      expect.soft(fresh.alerts, 'no row error before a touch (BUG-120 "Mong đợi")').toEqual([]);
      expect.soft(fresh.invalidFields, 'no red field before a touch').toBe(0);

      // Source behaviour after one apply: every row clean, "Tiếp tục" enabled (UCPM:487).
      await applyHeight(dialog, '3');
      await expect(table.getByRole('alert')).toHaveCount(0);
      await expect(nextButton(dialog)).toBeEnabled();
      await discardWizard(dialog);
    });
  });

  test('E02 · wizard "Quay lại" to step 1 and back keeps every step-2 edit: basement, renamed and added rows, per-row and shared heights', async ({ browser }) => {
    await withAdmin(browser, async (admin) => {
      const { page } = admin;
      const dialog = await openWizard(page);
      await toStep2(dialog, 'Dự án khứ hồi');
      await basementSwitch(dialog).focus();
      await page.keyboard.press('Space');
      await applyHeight(dialog, '3');
      await typeHeight(heightBox(dialog, 'Tầng 1'), '4');
      await floorNameBox(dialog, 'Tầng 3').fill('Tầng mái');
      await addFloorButton(dialog).click();
      await typeHeight(heightBox(dialog, 'Tầng 4'), '3');
      const expected = [[BASEMENT_NAME, /^[-−]3,0 m$/u], ['Tầng trệt', '0,0 m'], ['Tầng 1', '3,0 m'], ['Tầng 2', '7,0 m'], ['Tầng mái', '10,0 m'], ['Tầng 4', '13,0 m']] as const;

      await backButton(dialog).click(); // UCPM:614-616 — only the step changes
      await expect(stepText(dialog, 1)).toBeVisible();
      await nameField(dialog).press('End');
      await page.keyboard.type(' B'); // a step-1 edit must not reset the floors (UCPM:528-536 touches name/code only)
      await nextButton(dialog).click();
      await expect(stepText(dialog, 2)).toBeVisible();

      await expect(basementSwitch(dialog)).toHaveAttribute('aria-checked', 'true');
      await expect(heightBox(dialog, 'Tầng 1')).toHaveValue('4');
      await expect(applyField(dialog)).toHaveValue('3');
      for (const [floor, at] of expected) await expect(elevationCell(floorRow(dialog, page, floor))).toHaveText(at);
      await captureEvidence(page, 'E02_wiz_back_keeps_floors.png');

      await nextButton(dialog).click();
      await expect(reviewValue(dialog, 'Tên dự án')).toHaveText('Dự án khứ hồi B');
      await expect(reviewValue(dialog, 'Số tầng')).toHaveText('6'); // CPM:179-181
      await expect(dialog.getByText('Tầng mái', { exact: true })).toBeVisible(); // CPM:184-189
      await discardWizard(dialog);
    });
  });
});

/* ================================================================= step 3 review + discard + compact */

test.describe('E02 SCR-05 wizard edge — review, discard, compact', () => {
  test('E02 · wizard review shows long values whole: 80-char name, 200-char address, 32-char code, 3-line notes — nothing clipped, no sideways scroll', async ({ browser }) => {
    await withAdmin(browser, async (admin) => {
      const { page } = admin;
      const dialog = await openWizard(page);
      const name = `${`${TEST_DATA_PREFIX}review Chung cu Binh Minh `.repeat(4).slice(0, 79)}Z`; // LIM:23 = 80
      const address = asciiText('So 12 duong Lang, Dong Da, Ha Noi; ', BE_ADDRESS_MAX);
      const code = `DA-${'ABCDEFGHIJKLMNOPQRSTUVWXYZ012'}`; // 32 = BE:schemas:27
      const notes = 'Dòng một\nDòng hai\nDòng ba';
      expect([name.length, address.length, code.length]).toEqual([80, BE_ADDRESS_MAX, BE_CODE_MAX]);
      await nameField(dialog).fill(name);
      await codeField(dialog).fill(code);
      await addressField(dialog).fill(address);
      await notesField(dialog).fill(notes);
      await nextButton(dialog).click();
      await applyHeight(dialog, '3');
      await nextButton(dialog).click();
      await expect(stepText(dialog, 3)).toBeVisible();

      // CPM:174-178: raw values, `toHaveText` compares whitespace-normalised text (the notes' line breaks too).
      await expect(reviewValue(dialog, 'Tên dự án')).toHaveText(name);
      await expect(reviewValue(dialog, 'Mã dự án')).toHaveText(code);
      await expect(reviewValue(dialog, 'Địa chỉ')).toHaveText(address);
      await expect(reviewValue(dialog, 'Ghi chú')).toHaveText(notes);
      const overflow = {
        cells: await dialog.evaluate((root) =>
          Array.from(root.querySelectorAll<HTMLElement>('.w-\\[60\\%\\]')).map((el) => ({ text: (el.textContent ?? '').slice(0, 24), scroll: el.scrollWidth, client: el.clientWidth })),
        ), // FR:71
        body: await modalBody(dialog).evaluate((el) => ({ scroll: el.scrollWidth, client: el.clientWidth })),
        notesShownAs: await reviewValue(dialog, 'Ghi chú').innerText(), // line breaks are not kept (no pre-line on FR:71)
      };
      await captureEvidence(page, 'E02_wiz_review_long.png', { caption: 'step 3 with 80/32/200-char values and 3-line notes' });
      await attachJson('E02_wiz_review_long.json', overflow);
      for (const cell of overflow.cells) expect.soft(cell.scroll, `value "${cell.text}…" not clipped`).toBeLessThanOrEqual(cell.client + 1);
      expect(overflow.body.scroll, 'no sideways scroll in the dialog body').toBeLessThanOrEqual(overflow.body.client + 1);
      await discardWizard(dialog);
    });
  });

  test('[BUG-121] E02 · wizard review: each label sits on its value\'s line, and the floor levels say they are "Cao độ"', async ({ browser }) => {
    // EXPECTED TO FAIL while BUG-121 is open: FR:66 pads the label column `pt-[9px]`, the value column has none (FR:71);
    // the floor list (CPM:183-190) prints "0,0 m…" with no heading.
    await withAdmin(browser, async (admin) => {
      const { page } = admin;
      const dialog = await openWizard(page);
      await toReview(dialog, 'Dự án căn hàng');
      const offsets: Record<string, number> = {};
      for (const label of ['Tên dự án', 'Loại công trình', 'Số tầng']) {
        const labelTop = await dialog.getByText(label, { exact: true }).evaluate((el) => el.getBoundingClientRect().top);
        const valueTop = await reviewValue(dialog, label).evaluate((el) => {
          const range = document.createRange();
          range.selectNodeContents(el);
          return range.getClientRects()[0]?.top ?? el.getBoundingClientRect().top;
        });
        offsets[label] = labelTop - valueTop;
      }
      const elevationHeading = await dialog.getByText('Cao độ', { exact: true }).count();
      await captureEvidence(page, 'E02_wiz_review_alignment.png', { caption: `label − value top: ${JSON.stringify(offsets)} px` });
      await attachJson('E02_wiz_review_alignment.json', { offsets, elevationHeading });
      for (const [label, offset] of Object.entries(offsets)) expect.soft(Math.abs(offset), `"${label}" label vs value (BUG-121)`).toBeLessThanOrEqual(3);
      expect(elevationHeading, 'the floor list names its numbers "Cao độ" like step 2 (SF:72)').toBeGreaterThan(0);
      await discardWizard(dialog);
    });
  });

  test('E02 · wizard discard on steps 2 and 3: "Huỷ" twice closes step 2; Esc on step 3 warns, "Quay lại" clears the warning, the backdrop warns again and Esc then closes; reopen is blank; no POST', async ({ browser }) => {
    await withAdmin(browser, async (admin) => {
      const { page } = admin;
      let dialog = await openWizard(page);
      await toStep2(dialog, 'Dự án bỏ ở bước 2');
      await cancelButton(dialog).click(); // UCPM:630-634 dirty → warn
      await expect(discardWarning(dialog)).toBeVisible();
      await cancelButton(dialog).click(); // UCPM:630-632 already warned → close
      await expect(dialog).toHaveCount(0);

      dialog = await openWizard(page);
      await toReview(dialog, 'Dự án bỏ ở bước 3');
      await page.keyboard.press('Escape');
      await expect(discardWarning(dialog)).toBeVisible();
      await expect(dialog.getByText(DISCARD_HINT, { exact: true })).toBeVisible();
      await backButton(dialog).click(); // moving through the wizard answers the prompt: keep editing (BUG-189, goBack)
      await expect(stepText(dialog, 2)).toBeVisible();
      await expect(discardWarning(dialog)).toHaveCount(0);
      await captureEvidence(page, 'E02_wiz_discard_step2_3.png', { caption: 'Esc on step 3, then "Quay lại": step 2 without the discard warning' });
      await page.mouse.click(8, DESKTOP.height / 2); // backdrop (MOD:108-117) → requestClose → dirty again → warns, does not close
      await expect(discardWarning(dialog)).toBeVisible();
      await expect(dialog).toBeVisible();
      await page.keyboard.press('Escape'); // already warned → second Esc closes
      await expect(dialog).toHaveCount(0);

      dialog = await openWizard(page); // CPM:309-328 new key per opening
      await expect(nameField(dialog)).toHaveValue('');
      await expect(discardWarning(dialog)).toHaveCount(0);
      await page.keyboard.press('Escape'); // pristine → closes at once
      await expect(dialog).toHaveCount(0);
      expect(countApi(admin.api, 'POST', PROJECTS_API)).toBe(0);
    });
  });

  test('[BUG-123] E02 · wizard 375 px discard warning: the fields do not jump, and "bấm nút bên cạnh" matches where the button is', async ({ browser }) => {
    // EXPECTED TO FAIL while BUG-123 is open: the alert is inserted as the first child of Modal.Body (CPM:248-257),
    // above the fields, and CPM:253 says "bên cạnh" whatever the layout.
    await withAdmin(
      browser,
      async (admin) => {
        const { page } = admin;
        const dialog = await openWizardWithN(page);
        await nameField(dialog).fill('Dự án nháp 375');
        const before = await topOf(nameField(dialog));
        await page.keyboard.press('Escape');
        await expect(discardWarning(dialog)).toBeVisible();
        const after = await topOf(nameField(dialog));
        const hintLocator = dialog.getByText(/^Nhấn Esc lần nữa/u); // CPM:253
        const hintText = await hintLocator.innerText();
        const action = await dialog.getByRole('button', { name: DISCARD_ACTION, exact: true }).boundingBox();
        const hint = await hintLocator.boundingBox();
        if (action === null || hint === null) throw new Error('discard alert not laid out');
        const buttonBelow = action.y >= hint.y + hint.height - 1;
        await captureEvidence(page, 'E02_wiz_discard_375.png', { caption: `fields moved ${(after - before).toFixed(0)} px; button ${buttonBelow ? 'below' : 'beside'} the hint` });
        await attachJson('E02_wiz_discard_375.json', { nameTopBefore: before, nameTopAfter: after, action, hint, buttonBelow, hintText });
        expect.soft(after - before, 'the warning does not push the fields down (BUG-123)').toBeLessThanOrEqual(1);
        if (buttonBelow) expect(hintText, 'the button sits below the hint, so the copy cannot say "bên cạnh"').not.toContain('bên cạnh');
        await page.keyboard.press('Escape');
        await expect(dialog).toHaveCount(0);
      },
      COMPACT,
    );
  });

  test('[BUG-110] E02 · wizard 375 px: step 2 has no sideways scroll and "Tiếp tục" is on screen and clickable to step 3', async ({ browser }) => {
    // EXPECTED TO FAIL while BUG-110 is open: Modal width pinned 560 (CPM:63-64, MOD:132) inside a 375 px viewport,
    // and the floor table (SF:67) is wider than the dialog. The setup uses the keyboard so it can reach step 2 at all.
    await withAdmin(
      browser,
      async (admin) => {
        const { page } = admin;
        const dialog = await openWizardWithN(page);
        await nameField(dialog).fill('Dự án 375');
        await pressButton(page, nextButton(dialog));
        await expect(stepText(dialog, 2)).toBeVisible();
        await typeHeight(applyField(dialog), '3');
        await pressButton(page, applyButton(dialog));
        await expect(elevationCell(floorRow(dialog, page, 'Tầng 1'))).toHaveText('3,0 m');

        const layout = {
          viewport: COMPACT,
          dialog: await dialog.boundingBox(),
          next: await nextButton(dialog).boundingBox(),
          body: await modalBody(dialog).evaluate((el) => ({ scroll: el.scrollWidth, client: el.clientWidth })),
        };
        await captureEvidence(page, 'E02_wiz_375_step2.png', { caption: `375 px step 2: "Tiếp tục" at x=${String(layout.next?.x ?? 'n/a')}` });
        await attachJson('E02_wiz_375_step2.json', layout);
        expect.soft(layout.body.scroll, 'no sideways scroll inside the dialog').toBeLessThanOrEqual(layout.body.client + 1);
        const next = layout.next;
        expect(next !== null && next.x >= 0 && next.x + next.width <= COMPACT.width, '"Tiếp tục" fully on screen').toBe(true);
        await nextButton(dialog).click({ timeout: 5_000 });
        await expect(stepText(dialog, 3)).toBeVisible();
        await discardWizard(dialog);
      },
      COMPACT,
    );
  });
});

/* ================================================================= create */

test.describe('E02 SCR-05 wizard edge — create', () => {
  test('E02 · wizard [held response] keyboard create: Enter on "Tiếp tục" leaves the focus on "Tạo dự án"; Enter twice sends ONE POST; toast + card; reopen is blank', async ({ browser }) => {
    await withAdmin(browser, async (admin) => {
      const { page } = admin;
      const name = uniqueName('wiz-keys');
      const hold = gate();
      const keys = await routeCreate(page, async (route) => {
        await hold.wait;
        await route.continue();
      });

      const dialog = await openWizard(page);
      await buildingType(dialog).click();
      await page.getByRole('option', { name: BUILDING_TYPES[3], exact: true }).click();
      await notesField(dialog).fill('Ghi chú không có trường trên dây');
      await toStep2(dialog, name);
      await applyHeight(dialog, '3');
      await pressButton(page, nextButton(dialog));
      await expect(stepText(dialog, 3)).toBeVisible();
      // CPM:287-295: both buttons are a `Button` in the same slot, so React keeps the DOM node — focus stays on it.
      await expect(createButton(dialog), 'focus now on "Tạo dự án": one more Enter creates without a look at the review').toBeFocused();

      const created = waitForApi(page, 'POST', PROJECTS_RE, [201]);
      await page.keyboard.press('Enter');
      await page.keyboard.press('Enter');
      await expect(createButton(dialog)).toBeDisabled(); // CPM:292, UCPM:489
      await expect(stateAnnouncement(dialog)).toHaveText(STATE.loading); // UCPM:496
      await captureEvidence(page, 'E02_wiz_keyboard_create_busy.png', { caption: 'Enter, Enter on "Tạo dự án" — POST held' });
      hold.open();
      const { response, json } = await created;
      const body = asRecord(response.request().postDataJSON() as unknown, 'POST /api/projects body');
      expect(keys.length, 'one POST for two Enters (UCPM:641-643)').toBe(1);
      expect(Object.keys(body), 'CPC:71: "Loại công trình" has no wire field — dropped').not.toContain('buildingType');
      expect(Object.keys(body), 'CPC:71: "Ghi chú" has no wire field — dropped').not.toContain('notes');
      await unrouteAll(page);

      await expect(dialog).toHaveCount(0);
      await expect(projectCard(page, name)).toBeVisible();
      await expect(toastWith(page, createdToast(name))).toBeVisible(); // UCPM:668-673
      await captureEvidence(page, 'E02_wiz_keyboard_create_done.png', { caption: `1 POST → 201 ${stringField(asRecord(json, 'POST'), 'id', 'POST')}` });
      await attachJson('E02_wiz_keyboard_create.json', { posts: keys.length, idempotencyKey: keys[0] !== '', bodyKeys: Object.keys(body) });

      const again = await openWizard(page); // CPM:309-328: a created project never comes back on reopen (B-V3-02)
      await expect(nameField(again)).toHaveValue('');
      await expect(codeField(again)).toHaveValue('');
      await expect(buildingType(again)).toContainText(BUILDING_TYPES[0]);
      await expect(again.getByRole('button', { name: 'Quay lại' })).toHaveCount(0); // step 1 (CPM:277)
      await page.keyboard.press('Escape');
      await expect(again).toHaveCount(0);
    });
  });

  test('E02 · wizard padded and whitespace-only fields: name/code are trimmed, blank address is not sent, toast and card use the trimmed name', async ({ browser }) => {
    await withAdmin(browser, async (admin) => {
      const { page } = admin;
      const name = uniqueName('wiz-trim');
      const dialog = await openWizard(page);
      await nameField(dialog).fill(`   ${name}   `);
      await codeField(dialog).fill('  QA-TRIM  ');
      await addressField(dialog).fill('     ');
      await notesField(dialog).fill('   ');
      await nextButton(dialog).click();
      await applyHeight(dialog, '3');
      await nextButton(dialog).click();
      await expect(reviewValue(dialog, 'Tên dự án')).toHaveText(name);
      // CPM:176 compares the RAW value to '' — a spaces-only address shows a blank cell, not "—", though nothing is sent.
      const addressCell = (await reviewValue(dialog, 'Địa chỉ').innerText()).trim();

      const created = waitForApi(page, 'POST', PROJECTS_RE, [201]);
      await createButton(dialog).click();
      const { response } = await created;
      const body = asRecord(response.request().postDataJSON() as unknown, 'POST /api/projects body');
      expect(body.name, 'UCPM:647 trims the name').toBe(name);
      expect(body.code, 'UCPM:649 trims the code').toBe('QA-TRIM');
      expect(Object.keys(body), 'CPC:72: an address trimmed to "" is left out').not.toContain('address');
      await expect(toastWith(page, createdToast(name))).toBeVisible(); // UCPM:669 uses request.name
      await expect(projectCard(page, name)).toBeVisible();
      await captureEvidence(page, 'E02_wiz_trimmed_create.png', { caption: `sent name "${name}", code "QA-TRIM", no address` });
      await attachJson('E02_wiz_trimmed_create.json', { body, reviewAddressCell: addressCell });
      expect(addressCell, 'review of a spaces-only address (CPM:176) — blank, not "—"').toBe('');
    });
  });

  test('E02 · wizard duplicate name: a name another project already has is accepted (201, no "trùng" message) and both cards show', async ({ browser }) => {
    await withAdmin(browser, async (admin) => {
      const { page } = admin;
      const name = uniqueName('wiz-dup');
      await createProject(admin, name); // BE:service:243-244 — no unique-name rule, no 409 on this route
      await navigateAndWaitForApi(page, () => page.reload({ waitUntil: 'commit' }), 'GET', SUMMARIES_RE, [200]);
      await dashboardLoaded(page);
      await expect(projectCard(page, name)).toHaveCount(1);

      const dialog = await openWizard(page);
      await toReview(dialog, name);
      const created = waitForApi(page, 'POST', PROJECTS_RE, [201]);
      await createButton(dialog).click();
      await created;
      await expect(dialog).toHaveCount(0);
      await expect(page.getByText(/trùng/u)).toHaveCount(0); // UCPM:204-206 only on 409
      await expect(projectCard(page, name)).toHaveCount(2);
      await captureEvidence(page, 'E02_wiz_duplicate_name.png', { caption: `two cards named "${name}"` });
    });
  });

  test('[BUG-186] E02 · wizard "Địa chỉ" boundary: 201 characters → step 1 names the limit and blocks "Tiếp tục" (no POST); 200 characters → created', async ({ browser }) => {
    await withAdmin(browser, async (admin) => {
      const { page } = admin;
      // The FE counts like the BE (BE:schemas:28,53: after trim + NFC) and caps the address at 200 at step 1 (BUG-186).
      const tooLong = asciiText('So 12 duong Lang, Dong Da, Ha Noi; ', BE_ADDRESS_MAX + 1);
      const dialog = await openWizard(page);
      await nameField(dialog).fill(uniqueName('wiz-addr'));
      await addressField(dialog).fill(tooLong);
      await expect(dialog.getByText(ADDRESS_TOO_LONG, { exact: true })).toBeVisible();
      await expect(addressField(dialog)).toHaveAttribute('aria-invalid', 'true');
      await expect(nextButton(dialog), '201 characters cannot leave step 1').toBeDisabled();
      await captureEvidence(page, 'E02_wiz_address_201.png', { caption: `address 201 chars → "${ADDRESS_TOO_LONG}", "Tiếp tục" locked` });
      expect(countApi(admin.api, 'POST', PROJECTS_API), 'nothing was sent').toBe(0);

      // Exactly 200 passes the FE and the BE.
      const name = uniqueName('wiz-addr200');
      await nameField(dialog).fill(name);
      await addressField(dialog).fill(tooLong.slice(0, BE_ADDRESS_MAX - 1) + 'X');
      await expect(dialog.getByText(ADDRESS_TOO_LONG, { exact: true })).toHaveCount(0);
      await expect(nextButton(dialog)).toBeEnabled();
      await nextButton(dialog).click();
      await applyHeight(dialog, '3');
      await nextButton(dialog).click();
      const created = waitForApi(page, 'POST', PROJECTS_RE, [201]);
      await createButton(dialog).click();
      const ok = await created;
      expect(String(asRecord(ok.response.request().postDataJSON() as unknown, 'POST body').address).length).toBe(BE_ADDRESS_MAX);
      await expect(projectCard(page, name)).toBeVisible();
      await captureEvidence(page, 'E02_wiz_address_200.png', { caption: 'address 200 chars → 201' });
    });
  });

  test('[BUG-129] E02 · wizard [mocked response] create 422 field "address" (paired: API "create body rules"): the server refusal marks "Địa chỉ" and "Sửa ở bước 1" leads there', async ({ browser }) => {
    await withAdmin(browser, async (admin) => {
      const { page } = admin;
      const keys = await routeCreate(page, (route) => route.fulfill(validation422('address')));
      const dialog = await openWizard(page);
      await toReview(dialog, uniqueName('wiz-addr422'));
      await createButton(dialog).click();
      await expect(dialog.getByText(serverRefusedNotice('địa chỉ'), { exact: true })).toBeVisible();
      await expect(dialog.getByText(VALIDATION_DESCRIPTION, { exact: true }), 'a 422 with a field gets its own sentence').toHaveCount(0);
      await expect(stateAnnouncement(dialog)).toHaveText(STATE.error);
      expect(keys.length, 'one POST').toBe(1);
      await captureEvidence(page, 'E02_wiz_address_422_mocked.png', { caption: 'POST /api/projects → 422 field address [mocked]' });
      await dialog.getByRole('button', { name: FIX_AT_STEP_1, exact: true }).click();
      await expect(stepText(dialog, 1)).toBeVisible();
      await expect(addressField(dialog)).toHaveAttribute('aria-invalid', 'true');
      await expect(dialog.getByText(serverRefusedField('địa chỉ'), { exact: true })).toBeVisible();
      await expect(nameField(dialog)).not.toHaveAttribute('aria-invalid', 'true');
      await addressField(dialog).fill('So 1 Tran Hung Dao');
      await expect(dialog.getByText(serverRefusedField('địa chỉ'), { exact: true }), 'editing the refused value retires the refusal').toHaveCount(0);
      await expect(nextButton(dialog)).toBeEnabled();
      await discardWizard(dialog);
    });
  });

  test('[BUG-176] E02 · wizard code boundary: 33 characters → "Mã dự án" names the limit, not "Tên dự án", and blocks "Tiếp tục" (no POST); 32 unlocks it', async ({ browser }) => {
    await withAdmin(browser, async (admin) => {
      const { page } = admin;
      const dialog = await openWizard(page);
      await nameField(dialog).fill(uniqueName('wiz-code'));
      await codeField(dialog).fill('C'.repeat(BE_CODE_MAX + 1)); // BE:schemas:27,52
      await expect(dialog.getByText(CODE_TOO_LONG, { exact: true })).toBeVisible();
      const marks = {
        codeInvalid: await codeField(dialog).getAttribute('aria-invalid'),
        nameInvalid: await nameField(dialog).getAttribute('aria-invalid'),
        next: await nextButton(dialog).isEnabled(),
      };
      await captureEvidence(page, 'E02_wiz_code_33.png', { caption: `code 33 chars: code aria-invalid=${String(marks.codeInvalid)}, name aria-invalid=${String(marks.nameInvalid)}, "Tiếp tục" enabled=${String(marks.next)}` });
      await attachJson('E02_wiz_code_33.json', marks);
      expect(marks.codeInvalid, '"Mã dự án" is the field to fix').toBe('true');
      expect(marks.nameInvalid, '"Tên dự án" was fine').toBeNull();
      expect(marks.next, '33 characters cannot leave step 1').toBe(false);
      expect(countApi(admin.api, 'POST', PROJECTS_API), 'nothing was sent').toBe(0);

      await codeField(dialog).fill('C'.repeat(BE_CODE_MAX));
      await expect(dialog.getByText(CODE_TOO_LONG, { exact: true })).toHaveCount(0);
      await expect(nextButton(dialog), 'a code of 32 characters passes').toBeEnabled();
      await discardWizard(dialog);
    });
  });

  test('[BUG-129] E02 · wizard [mocked response] create 422 field "code" (paired: API "create body rules"): the refusal marks "Mã dự án" (not "Tên dự án"); fixing the code alone unlocks the create', async ({ browser }) => {
    await withAdmin(browser, async (admin) => {
      const { page } = admin;
      const keys = await routeCreate(page, (route) => route.fulfill(validation422('code')));
      const dialog = await openWizard(page);
      await toReview(dialog, uniqueName('wiz-code422'));
      await createButton(dialog).click();
      await expect(dialog.getByText(serverRefusedNotice('mã dự án'), { exact: true })).toBeVisible();
      await expect(dialog.getByText(VALIDATION_DESCRIPTION, { exact: true })).toHaveCount(0);
      expect(keys.length, 'one POST').toBe(1);

      await backButton(dialog).click();
      await backButton(dialog).click();
      await expect(stepText(dialog, 1)).toBeVisible();
      const marks = {
        codeInvalid: await codeField(dialog).getAttribute('aria-invalid'),
        nameInvalid: await nameField(dialog).getAttribute('aria-invalid'),
        alerts: await dialog.getByRole('alert').allInnerTexts(),
      };
      await captureEvidence(page, 'E02_wiz_code_422_marks.png', { caption: `422 field code [mocked]: code aria-invalid=${String(marks.codeInvalid)}, name aria-invalid=${String(marks.nameInvalid)}` });
      await attachJson('E02_wiz_code_422_marks.json', marks);
      expect.soft(marks.codeInvalid, '"Mã dự án" is the field the server refused (BUG-129)').toBe('true');
      expect.soft(marks.nameInvalid, '"Tên dự án" was fine').toBeNull();

      await codeField(dialog).fill('DA-OTHER');
      await expect(nextButton(dialog), 'a different code alone makes the form submittable again (BUG-129)').toBeEnabled();
      await discardWizard(dialog);
    });
  });

  test('[BUG-185] E02 · wizard blank floor name: step 2 says "Chưa nhập tên tầng." on the row and locks "Tiếp tục" (no POST); a name unlocks it', async ({ browser }) => {
    await withAdmin(browser, async (admin) => {
      const { page } = admin;
      const dialog = await openWizard(page);
      await toStep2(dialog, uniqueName('wiz-floorname'));
      await applyHeight(dialog, '3');
      await expect(nextButton(dialog)).toBeEnabled();
      await floorNameBoxes(dialog).nth(3).fill('   '); // blank after trim
      await expect(dialog.getByText(FLOOR_NAME_MISSING, { exact: true })).toBeVisible();
      await expect(nextButton(dialog), 'a floor without a name cannot continue').toBeDisabled();
      await captureEvidence(page, 'E02_wiz_floor_name_blank.png', { caption: 'floor 4 named "   " → "Chưa nhập tên tầng.", "Tiếp tục" locked' });
      expect(countApi(admin.api, 'POST', PROJECTS_API), 'nothing was sent').toBe(0);
      await floorNameBoxes(dialog).nth(3).fill('Tầng 3');
      await expect(dialog.getByText(FLOOR_NAME_MISSING, { exact: true })).toHaveCount(0);
      await expect(nextButton(dialog)).toBeEnabled();
      await discardWizard(dialog);
    });
  });

  test('[BUG-129] E02 · wizard [mocked response] create 422 field "floors.3.name" (paired: API "floors bounds"): the notice names the floor and "Sửa ở bước 2" leads back', async ({ browser }) => {
    await withAdmin(browser, async (admin) => {
      const { page } = admin;
      const keys = await routeCreate(page, (route) => route.fulfill(validation422('floors.3.name')));
      const dialog = await openWizard(page);
      await toReview(dialog, uniqueName('wiz-floor422'));
      await createButton(dialog).click();
      await expect(dialog.getByText('Máy chủ không nhận tầng "Tầng 3". Sửa ở bước 2 rồi thử lại.', { exact: true })).toBeVisible();
      await expect(dialog.getByText(VALIDATION_DESCRIPTION, { exact: true })).toHaveCount(0);
      await expect(stateAnnouncement(dialog)).toHaveText(STATE.error);
      expect(keys.length, 'one POST').toBe(1);
      await captureEvidence(page, 'E02_wiz_floor_name_422_mocked.png', { caption: 'POST /api/projects → 422 field floors.3.name [mocked]' });
      await dialog.getByRole('button', { name: 'Sửa ở bước 2', exact: true }).click();
      await expect(stepText(dialog, 2)).toBeVisible();
      await discardWizard(dialog);
    });
  });

  test('[BUG-184] E02 · wizard [held response] Esc while creating: the dialog stays shut to closing (no discard warning), the held POST creates the project and the dialog then closes itself with its toast', async ({ browser }) => {
    await withAdmin(browser, async (admin) => {
      const { page } = admin;
      const name = uniqueName('wiz-escbusy');
      const hold = gate();
      await routeCreate(page, async (route) => {
        await hold.wait;
        await route.continue();
      });
      const dialog = await openWizard(page);
      await toReview(dialog, name);
      await createButton(dialog).click();
      await expect(stateAnnouncement(dialog)).toHaveText(STATE.loading);
      await expect(cancelButton(dialog)).toBeDisabled(); // CPM:284

      // requestClose returns early while isSubmitting (BUG-184): the POST cannot be taken back, so Esc closes nothing.
      await page.keyboard.press('Escape');
      await page.keyboard.press('Escape');
      await expect(dialog).toBeVisible();
      await expect(discardWarning(dialog)).toHaveCount(0);
      await captureEvidence(page, 'E02_wiz_esc_while_busy.png', { caption: 'POST held; Esc twice → dialog still open, no discard warning' });

      const created = waitForApi(page, 'POST', PROJECTS_RE, [201]);
      hold.open();
      await created;
      await unrouteAll(page);
      await expect(dialog).toHaveCount(0); // closed by the finished create, not by Esc
      await expect(toastWith(page, createdToast(name))).toBeVisible();
      await expect(projectCard(page, name)).toBeVisible();
      await captureEvidence(page, 'E02_wiz_esc_while_busy_created.png', { caption: 'Esc ignored while creating — project created, dialog closed, toast' });
      await attachJson('E02_wiz_esc_while_busy.json', { created: countApi(admin.api, 'POST', PROJECTS_API, 201) });
    });
  });

  test('[BUG-129] E02 · wizard [mocked response] create 500 (unpairable: 5xx): one POST, generic notice, review kept — and "Tạo dự án" usable to retry', async ({ browser }) => {
    // BUG-129 fixed: a failure that names no field marks nothing, so "Tạo dự án" stays usable.
    await withAdmin(browser, async (admin) => {
      const { page } = admin;
      const keys = await routeCreate(page, (route) => route.fulfill({ status: 500, contentType: 'application/json', body: '{}' }));
      const name = uniqueName('wiz-500');
      const dialog = await openWizard(page);
      await toReview(dialog, name);
      await createButton(dialog).click();
      // 500 is not in RTY:3 → no retry; TAE:10-18 has no 500 → 'unknown' → the wizard's own sentence (problems.unknownKeepsForm).
      await expect(dialog.getByText(UNKNOWN_DESCRIPTION, { exact: true }).first()).toBeVisible();
      await expect(stateAnnouncement(dialog)).toHaveText(STATE.error);
      await expect(stepText(dialog, 3)).toBeVisible();
      await expect(reviewValue(dialog, 'Tên dự án')).toHaveText(name);
      expect(keys.length, 'a 500 is not retried (RTY:3, :91-93)').toBe(1);
      await captureEvidence(page, 'E02_wiz_create_500.png', { caption: 'POST /api/projects → 500 [mocked]' });
      await attachJson('E02_wiz_create_500.json', { posts: keys.length, createEnabled: await createButton(dialog).isEnabled() });
      await expect(createButton(dialog), '"Tạo dự án" can be pressed again to retry (BUG-129 "Mong đợi")').toBeEnabled();
      await discardWizard(dialog);
    });
  });

  test('E02 · wizard [mocked response] create 503 once (unpairable: 5xx) is retried with the SAME Idempotency-Key; one project, toast', async ({ browser }) => {
    await withAdmin(browser, async (admin) => {
      const { page } = admin;
      // BUG-191: the retry is held until the failed state has been shot, so the image shows the wizard between the 503
      // and the second attempt (not only the finished dashboard).
      const retryGate = gate();
      const keys = await routeCreate(page, async (route, attempt) => {
        if (attempt === 1) await route.fulfill({ status: 503, contentType: 'application/json', body: '{}' });
        else {
          await retryGate.wait;
          await route.continue();
        }
      });
      const name = uniqueName('wiz-503');
      const dialog = await openWizard(page);
      await toReview(dialog, name);
      const created = waitForApi(page, 'POST', PROJECTS_RE, [201]);
      await createButton(dialog).click();
      await expect.poll(() => keys.length, { message: 'attempt 2 reached the route (held)' }).toBe(2);
      await expect(dialog).toBeVisible();
      await captureEvidence(page, 'E02_wiz_create_503_held.png', { caption: `attempt 1 → 503 [mocked]; attempt 2 held, Idempotency-Key ${keys[1] === keys[0] ? 'same as attempt 1' : 'DIFFERENT'}; wizard still open` });
      retryGate.open();
      await created; // RTY:3 503 retryable; POST with an Idempotency-Key is (RTY:25-26, CPC:90); delay 300 ms + jitter (RTY:5)
      expect(keys.length).toBe(2);
      expect(keys[0], 'Idempotency-Key present').not.toBe('');
      expect(keys[1], 'the retry reuses the key (HTC:400-411)').toBe(keys[0]);
      await expect(dialog).toHaveCount(0);
      await expect(toastWith(page, createdToast(name))).toBeVisible();
      await expect(projectCard(page, name)).toHaveCount(1);
      await captureEvidence(page, 'E02_wiz_create_503_retry.png', { caption: '503 [mocked] then 201 with the same Idempotency-Key' });
      await attachJson('E02_wiz_create_503_retry.json', { attempts: keys.length, sameKey: keys[0] === keys[1], created: countApi(admin.api, 'POST', PROJECTS_API, 201) });
    });
  });

  test('E02 · wizard [mocked response] network abort on the first create attempt (unpairable: network loss) is retried silently; exactly one project', async ({ browser }) => {
    await withAdmin(browser, async (admin) => {
      const { page } = admin;
      // BUG-191: same hold as the 503 case — the shot between the aborted attempt and its retry.
      const retryGate = gate();
      const keys = await routeCreate(page, async (route, attempt) => {
        if (attempt === 1) await route.abort('failed');
        else {
          await retryGate.wait;
          await route.continue();
        }
      });
      const name = uniqueName('wiz-abort');
      const dialog = await openWizard(page);
      await toReview(dialog, name);
      const created = waitForApi(page, 'POST', PROJECTS_RE, [201]);
      await createButton(dialog).click();
      await expect.poll(() => keys.length, { message: 'attempt 2 reached the route (held)' }).toBe(2);
      await expect(dialog).toBeVisible();
      await captureEvidence(page, 'E02_wiz_create_abort_held.png', { caption: `attempt 1 aborted [mocked]; attempt 2 held, Idempotency-Key ${keys[1] === keys[0] ? 'same as attempt 1' : 'DIFFERENT'}; wizard still open` });
      retryGate.open();
      await created; // RTY:17-23 TypeError = network → retried for a keyed POST (RTY:95), HTC:568-583
      expect(keys.length).toBe(2);
      expect(keys[1]).toBe(keys[0]);
      await expect(dialog).toHaveCount(0);
      await expect(page.getByText('Không liên lạc được với máy chủ', { exact: false })).toHaveCount(0); // no notice for a recovered loss
      await expect(projectCard(page, name)).toHaveCount(1);
      await captureEvidence(page, 'E02_wiz_create_abort_retry.png', { caption: 'first POST aborted [mocked], retry 201, one card' });
      await attachJson('E02_wiz_create_abort_retry.json', { attempts: keys.length, sameKey: keys[0] === keys[1], created: countApi(admin.api, 'POST', PROJECTS_API, 201) });
    });
  });
});

/* ================================================================= QA-02 shared components (FE 271538cb)
 * Wizard gaps left by the shared-component changes merged in 271538cb (coverage/phase02.md rows S10-S15). Sources at
 * 271538cb: NF = src/hooks/useNumericField.ts, NFC = src/components/ui/NumericField.tsx, NUM = src/lib/format/number.ts,
 * TG = src/components/ui/Toggle.tsx, BV = src/components/ui/buttonVariants.ts, Table.tsx = src/components/ui/Table.tsx,
 * SR = src/lib/input/shortcutRegistry.ts, CSS = src/styles/globals.css, SF / CPM / UCPM at their 271538cb lines.
 * Budget of this block: no project is created (every test discards the wizard), ~2 refreshes per test, no login
 * beyond the worker's own, no mock.
 */

const KEEP_EDITING = 'Tiếp tục sửa'; // CPM:202-204 (vi.json project.createModal.discard.keepEditing, changed in 271538cb)
const FLOORS_HINT = 'Nhập chiều cao thông thuỷ cho từng tầng, hoặc dùng "Áp cho mọi tầng", để sang bước xem lại.'; // UCPM:474
/** UCPM:477: every height in, something else still blocks step 2 (BUG-120, FIX-1011). */
const FLOORS_FIX_HINT = 'Sửa các tầng đang báo lỗi để sang bước xem lại.';
const FLOOR_CAP_NOTE = `Đã đủ ${String(FLOOR_COUNT_MAX)} tầng, mức tối đa (kể cả tầng hầm).`; // UCPM:469 (formatNumber(50) = "50")
const BASEMENT_DESCRIPTION = 'Tầng hầm luôn nằm dưới tầng trệt; cao độ của nó là số âm.'; // SF:49
const STEPPER_BUTTON = /^(Tăng|Giảm) giá trị$/u; // the hover stepper NFC drew before 271538cb (removed, NFC:27-29)

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

test.describe('E02 SCR-05 wizard edge — QA-02 shared components (FE 271538cb)', () => {
  test('E02 · wizard step 2 hint: "Tiếp tục" is described by the hint for as long as it is locked — the height hint while a height is missing, the fix hint once every height is in; the floor table has four column headers', async ({ browser }) => {
    await withAdmin(browser, async (admin) => {
      const { page } = admin;
      const dialog = await openWizard(page);
      await toStep2(dialog, 'Dự án gợi ý bước hai');
      const hint = dialog.getByText(FLOORS_HINT, { exact: true });
      // UCPM:702-707 floorsHint while rows > 0 && !canGoNextStep2; SF:56-60 draws it; CPM:350 describes "Tiếp tục".
      await expect(hint).toBeVisible();
      await expect(nextButton(dialog)).toBeDisabled();
      await expect(nextButton(dialog)).toHaveAccessibleDescription(FLOORS_HINT);
      // Table.tsx:177-179 scope="col" → SF:90-93 four column headers, the last one named by aria-label only.
      const heads = dialog.getByRole('table').getByRole('columnheader');
      await expect(heads).toHaveCount(4);
      await expect(dialog.getByRole('columnheader', { name: 'Xoá tầng', exact: true })).toHaveCount(1);
      const scopes = await dialog.getByRole('table').locator('thead th').evaluateAll((cells) => cells.map((cell) => cell.getAttribute('scope')));
      expect(scopes).toEqual(['col', 'col', 'col', 'col']);
      await captureEvidence(page, 'E02_wiz_floors_hint.png', { caption: 'fresh step 2: hint shown, "Tiếp tục" disabled and described by it' });

      // UCPM:718-724 setFloorHeight → touchFloors → floorsTouched: the rows speak, and the locked "Tiếp tục" keeps its hint (BUG-120).
      await typeHeight(heightBox(dialog, 'Tầng trệt'), '3');
      await expect(floorRow(dialog, page, 'Tầng 1').getByRole('alert')).toHaveText(HEIGHT_MISSING);
      await expect(hint).toBeVisible();
      await expect(nextButton(dialog)).toBeDisabled();
      await expect(nextButton(dialog)).toHaveAccessibleDescription(FLOORS_HINT);
      await captureEvidence(page, 'E02_wiz_floors_hint_kept.png', { caption: '"Tầng trệt" = 3 → "Tầng 1" says its height is missing; the hint still describes "Tiếp tục"' });
      const hintAfterEdit = await hint.count();

      // Every height in → step 2 can go on: no hint, no description (CPM:350).
      await applyHeight(dialog, '3');
      await expect(nextButton(dialog)).toBeEnabled();
      await expect(hint).toHaveCount(0);
      expect(await nextButton(dialog).getAttribute('aria-describedby'), 'CPM:350 no description without the hint').toBeNull();

      // Heights all in, a blank floor name blocks again (BUG-185) → the second hint (UCPM:477, :707).
      await floorNameBox(dialog, 'Tầng 3').fill('');
      const fixHint = dialog.getByText(FLOORS_FIX_HINT, { exact: true });
      await expect(fixHint).toBeVisible();
      await expect(nextButton(dialog)).toBeDisabled();
      await expect(nextButton(dialog)).toHaveAccessibleDescription(FLOORS_FIX_HINT);
      await captureEvidence(page, 'E02_wiz_floors_fix_hint.png', { caption: 'every height in, "Tầng 3" name blank → "Tiếp tục" described by the fix hint' });
      await attachJson('E02_wiz_floors_hint.json', { scopes, hintAfterEdit });
      await discardWizard(dialog);
    });
  });

  test('E02 · wizard height by keyboard: no hover stepper is drawn; ArrowUp/ArrowDown step by 1, Shift by 10, clamped to 2–10 m; Tab commits', async ({ browser }) => {
    await withAdmin(browser, async (admin) => {
      const { page } = admin;
      const dialog = await openWizard(page);
      await toStep2(dialog, 'Dự án phím mũi tên');
      const ground = heightBox(dialog, 'Tầng trệt');
      await ground.hover(); // the removed stepper showed on hover only
      await expect(dialog.getByRole('button', { name: STEPPER_BUTTON })).toHaveCount(0); // NFC:27-29
      await ground.focus();
      // NF:127-141: empty box → 0 + 1 → clamped to min 2; Shift ×10 → 13 → clamped to max 10 (LIM:34-35).
      for (const [key, shows] of [['ArrowUp', '2'], ['ArrowUp', '3'], ['Shift+ArrowUp', '10'], ['ArrowDown', '9']] as const) {
        await page.keyboard.press(key);
        await expect(ground, `${key} → ${shows}`).toHaveValue(shows);
      }
      await page.keyboard.press('Tab'); // NF:113-119 commit on blur
      await expect(floorRow(dialog, page, 'Tầng trệt').getByRole('alert')).toHaveCount(0);
      // BUG-222: a floor without its own height has no level, "—" (computeFloorStack; same rule as the "" / "abc" case of
      // the row-height parsing test): "Tầng 1" shows the 9 m below it only once it has a height of its own.
      await expect(elevationCell(floorRow(dialog, page, 'Tầng 1'))).toHaveText('—');

      const first = heightBox(dialog, 'Tầng 1');
      await first.focus();
      await page.keyboard.press('ArrowDown'); // 0 − 1 → clamped up to the 2 m floor, never a refusal
      await expect(first).toHaveValue('2');
      await page.keyboard.press('Tab');
      await expect(elevationCell(floorRow(dialog, page, 'Tầng 1')), '"Tầng 1" (2 m) sits on the committed 9 m').toHaveText('9,0 m');
      await expect(elevationCell(floorRow(dialog, page, 'Tầng 2')), '"Tầng 2" has no height yet').toHaveText('—');
      await captureEvidence(page, 'E02_wiz_arrow_keys.png', { caption: 'Tầng trệt: ↑ ↑ Shift+↑ ↓ → 9; Tầng 1 (empty): ↓ → 2; both committed on Tab ("Tầng 1" at 9,0 m, "Tầng 2" no height "—")' });
      await attachJson('E02_wiz_arrow_keys.json', { steps: ['ArrowUp=2', 'ArrowUp=3', 'Shift+ArrowUp=10', 'ArrowDown=9', 'empty ArrowDown=2'], stepperButtons: 0 });
      await discardWizard(dialog);
    });
  });

  test('E02 · wizard refused height stays in its box with the unit sentence ("12", "2.500" = 2 500, "0.75"); a new "Áp cho mọi tầng" value clears it — the same value should too (BUG-160)', async ({ browser }) => {
    await withAdmin(browser, async (admin) => {
      const { page } = admin;
      const dialog = await openWizard(page);
      await toStep2(dialog, 'Dự án giá trị bị từ chối');
      await applyHeight(dialog, '3');
      const ground = heightBox(dialog, 'Tầng trệt');
      const groundAlert = floorRow(dialog, page, 'Tầng trệt').getByRole('alert');
      const floor1 = elevationCell(floorRow(dialog, page, 'Tầng 1'));

      // NF:49-53 the sentence names the unit; NF:145-150 the refused text stays (error !== null); 3 m stays committed.
      // NUM:245, :274-275: a dot grouping exactly three digits is a thousands mark ("2.500" = 2500), a lone dot is decimal ("0.75").
      for (const [typed, message] of [['12', NUMERIC_MAX], ['2.500', NUMERIC_MAX], ['0.75', NUMERIC_MIN]] as const) {
        await typeHeight(ground, typed);
        await expect(groundAlert, `"${typed}" refused`).toHaveText(message);
        await expect(ground, `"${typed}" stays in the box after Tab`).toHaveValue(typed);
        await expect(floor1, `"${typed}" never committed`).toHaveText('3,0 m');
      }
      await captureEvidence(page, 'E02_wiz_refused_kept.png', { caption: `"0.75" on "Tầng trệt" → "${NUMERIC_MIN}", text kept in the box, 3 m still committed` });

      // Apply the SAME 3 m: NF:41-44 clears a refusal only when the value prop changes; 3 → 3 is no change.
      await applyButton(dialog).click();
      const same = { value: await ground.inputValue(), alerts: await groundAlert.allInnerTexts() };
      await captureEvidence(page, 'E02_wiz_refused_same_apply.png', { caption: `"Áp cho mọi tầng" with the same 3 m: box "${same.value}", alerts ${JSON.stringify(same.alerts)}` });

      // Apply a NEW value: the refusal goes with the old text (NF:38-44), every row shows 4.
      await typeHeight(applyField(dialog), '4');
      await applyButton(dialog).click();
      await expect(ground).toHaveValue('4');
      await expect(groundAlert).toHaveCount(0);
      await expect(floor1).toHaveText('4,0 m');
      await captureEvidence(page, 'E02_wiz_refused_new_apply.png', { caption: '"Áp cho mọi tầng" 4 m → refusal cleared, "Tầng 1" at 4,0 m' });
      await attachJson('E02_wiz_refused.json', { sameValueApply: same, newValueApply: { value: '4', alerts: [] } });
      // Finding candidate (Logic/Low) when these fail: an apply that writes the committed value leaves the stale refusal on screen
      // while the row really holds 3 m (NF:40 promises an "apply to all" replaces the refused text).
      expect.soft(same.value, 'apply of the same value replaces the refused text').toBe('3');
      expect.soft(same.alerts, 'apply of the same value clears the refusal').toEqual([]);
      await discardWizard(dialog);
    });
  });

  test('E02 · wizard 50-floor cap note: "Đã đủ 50 tầng…" describes "Thêm tầng" and the locked "Có tầng hầm"; one floor less unlocks both; with a basement the switch stays usable at the cap', async ({ browser }) => {
    test.setTimeout(240_000);
    await withAdmin(browser, async (admin) => {
      const { page } = admin;
      const dialog = await openWizard(page);
      await toStep2(dialog, 'Dự án trần năm mươi tầng');
      const add = addFloorButton(dialog);
      const basement = basementSwitch(dialog);
      const note = dialog.getByText(FLOOR_CAP_NOTE, { exact: true });
      await expect(note).toHaveCount(0);
      await expect(basement).toHaveAccessibleDescription(BASEMENT_DESCRIPTION); // TG:69, :88, :130

      for (let floors = 4; floors < FLOOR_COUNT_MAX; floors += 1) await add.click(); // "Tầng 4" … "Tầng 49" (UCPM:205-207)
      await expect(floorNameBoxes(dialog)).toHaveCount(FLOOR_COUNT_MAX);
      // UCPM:664 canAddFloor, :906 floorCapNote, :907 canToggleBasement = hasBasement || canAddFloor; SF:43-50, :144-158.
      await expect(add).toBeDisabled();
      await expect(note).toBeVisible();
      await expect(add).toHaveAccessibleDescription(FLOOR_CAP_NOTE);
      await expect(basement).toBeDisabled();
      const describedBy = await basement.evaluate((el) =>
        (el.getAttribute('aria-describedby') ?? '')
          .split(/\s+/u)
          .filter((id) => id !== '')
          .map((id) => ({ id, found: document.getElementById(id) !== null })),
      );
      // BUG-220: with 50 rows the note (foot of the list, under "Thêm tầng") and the switch (top of step 2) never share
      // one view: each is scrolled into view for its own shot.
      await note.scrollIntoViewIfNeeded();
      await captureEvidence(page, 'E02_wiz_cap_note.png', { caption: `50 floors, foot of the list: note "${FLOOR_CAP_NOTE}" under the locked "Thêm tầng"` });
      await basement.scrollIntoViewIfNeeded();
      await captureEvidence(page, 'E02_wiz_cap_note_switch.png', { caption: `50 floors, top of step 2: "Có tầng hầm" locked; switch describedby ${JSON.stringify(describedBy)}` });
      await attachJson('E02_wiz_cap_note.json', { rows: FLOOR_COUNT_MAX, describedBy });
      await expect(basement, 'the locked switch says why').toHaveAccessibleDescription(new RegExp(FLOOR_CAP_NOTE.replace(/[.*+?^${}()|[\]\\]/gu, '\\$&'), 'u'));
      // Finding candidate (a11y/Low) when this fails: TG:69 joins the extra id into `descId`, and TG:130 reuses that joined
      // string as the description span's own id ("…-desc create-project-floor-cap"), so "…-desc" resolves to nothing
      // and the switch loses its own sentence exactly when it is locked (TG:15-16 promises it is read first).
      await basement.scrollIntoViewIfNeeded();
      await shootOnSoftFail(page, 'E02_wiz_cap_switch_desc_softfail.png', `locked "Có tầng hầm" at 50 floors: describedby ${JSON.stringify(describedBy)} (own sentence expected first)`, () =>
        expect.soft(basement, 'own description, then the cap note').toHaveAccessibleDescription(`${BASEMENT_DESCRIPTION} ${FLOOR_CAP_NOTE}`),
      );

      await deleteFloorButton(dialog, 'Tầng 49').click(); // UCPM removeFloor
      await expect(floorNameBoxes(dialog)).toHaveCount(FLOOR_COUNT_MAX - 1);
      await expect(note).toHaveCount(0);
      await expect(add).toBeEnabled();
      await expect(basement).toBeEnabled();
      await expect(basement).toHaveAccessibleDescription(BASEMENT_DESCRIPTION);

      await basement.click(); // UCPM:782 setHasBasement: the basement row is the 50th
      await expect(basement).toHaveAttribute('aria-checked', 'true');
      await expect(floorNameBoxes(dialog)).toHaveCount(FLOOR_COUNT_MAX);
      await expect(note).toBeVisible();
      await expect(add).toBeDisabled();
      await expect(basement, 'hasBasement keeps the switch usable at the cap (UCPM:907)').toBeEnabled();
      await basement.scrollIntoViewIfNeeded();
      await captureEvidence(page, 'E02_wiz_cap_basement_toggle.png', { caption: '49 floors + basement = 50, top of step 2: "Có tầng hầm" on and still usable' });
      await note.scrollIntoViewIfNeeded();
      await captureEvidence(page, 'E02_wiz_cap_basement_toggle_foot.png', { caption: `49 floors + basement = 50, foot of the list: note "${FLOOR_CAP_NOTE}", "Thêm tầng" locked` });
      await basement.click();
      await expect(floorNameBoxes(dialog)).toHaveCount(FLOOR_COUNT_MAX - 1);
      await expect(dialog.getByRole('textbox', { name: `Tên tầng ${BASEMENT_NAME}`, exact: true })).toHaveCount(0);
      await expect(note).toHaveCount(0);
      await discardWizard(dialog);
    });
  });

  test('E02 · wizard discard prompt: "Tiếp tục sửa" (click, or Enter) keeps the form; Space on the solid "Đóng, bỏ thay đổi" closes it; nothing sent (BUG-151, BUG-155)', async ({ browser }) => {
    await withAdmin(browser, async (admin) => {
      const { page } = admin;
      const dialog = await openWizard(page);
      const name = 'Dự án tiếp tục sửa';
      await nameField(dialog).fill(name);
      await cancelButton(dialog).click(); // UCPM:816 requestClose, dirty → prompt
      const prompt = dialog.getByRole('alert').filter({ hasText: DISCARD_TITLE }); // CPM:185-209
      await expect(prompt).toBeVisible();
      await expect(prompt).toContainText(DISCARD_HINT);
      const keep = prompt.getByRole('button', { name: KEEP_EDITING, exact: true });
      const discard = prompt.getByRole('button', { name: DISCARD_ACTION, exact: true });
      const paint = await dangerPaint(discard); // CPM:205 variant="danger", BV:12
      const keepBg = await keep.evaluate((el) => getComputedStyle(el).backgroundColor);
      expect(paint.bg, '"Đóng, bỏ thay đổi" filled with --state-violation-text').toBe(paint.wantBg);
      expect(paint.fg).toBe(paint.wantFg);
      expect(keepBg, '"Tiếp tục sửa" is not the danger fill').not.toBe(paint.bg);
      await captureEvidence(page, 'E02_wiz_keep_editing.png', { caption: 'discard prompt: "Tiếp tục sửa" + solid "Đóng, bỏ thay đổi"' });

      await keep.click(); // UCPM:936 keepEditing
      await expect(prompt).toHaveCount(0);
      await expect(stepText(dialog, 1)).toBeVisible();
      await expect(nameField(dialog)).toHaveValue(name);

      await nameField(dialog).focus();
      await page.keyboard.press('Escape'); // dirty Esc → the same prompt
      await expect(prompt).toBeVisible();
      await keep.focus();
      await page.keyboard.press('Enter'); // SR:552-557 a lone key keeps its native action inside the dialog (BUG-151)
      await expect(prompt).toHaveCount(0);
      await expect(dialog).toBeVisible();
      await expect(nameField(dialog)).toHaveValue(name);
      await captureEvidence(page, 'E02_wiz_keep_editing_kbd.png', { caption: 'Esc → prompt → Enter on "Tiếp tục sửa" → form kept' });

      await cancelButton(dialog).click();
      await expect(prompt).toBeVisible();
      await discard.focus();
      await page.keyboard.press('Space');
      await expect(dialog).toHaveCount(0);
      const posts = countApi(admin.api, 'POST', PROJECTS_API);
      await attachJson('E02_wiz_keep_editing.json', { paint, keepBg, posts });
      expect(posts, 'no POST /api/projects').toBe(0);
    });
  });

  test('E02 · wizard "Có tầng hầm" switch: the 36×20 track keeps a 24 px tall hit area — a click 1 px above or below it toggles (BUG-158)', async ({ browser }) => {
    await withAdmin(browser, async (admin) => {
      const { page } = admin;
      const dialog = await openWizard(page);
      await toStep2(dialog, 'Dự án vùng bấm công tắc');
      const basement = basementSwitch(dialog);
      await expect(basement).toHaveAttribute('aria-checked', 'false');
      // TG:94-97 `h-5 w-9` + `hit-y-24`; CSS:299 `.hit-y-24::before { inset: -2px 0 }`.
      const probe = await basement.evaluate((el) => {
        const r = el.getBoundingClientRect();
        const x = r.left + r.width / 2;
        const hits = (y: number): boolean => {
          const hit = document.elementFromPoint(x, y);
          return hit !== null && (hit === el || el.contains(hit));
        };
        return { x, top: r.top, bottom: r.bottom, width: r.width, height: r.height, above1: hits(r.top - 1), below1: hits(r.bottom + 1), above4: hits(r.top - 4) };
      });
      await attachJson('E02_wiz_switch_hit_area.json', probe);
      expect(Math.round(probe.height), 'visible track stays 20 px').toBe(20);
      expect(probe.above1, '1 px above the track is still the switch').toBe(true);
      expect(probe.below1, '1 px below the track is still the switch').toBe(true);
      expect(probe.above4, '4 px above is outside the 24 px area').toBe(false);

      await page.mouse.click(probe.x, probe.top - 1);
      await expect(basement).toHaveAttribute('aria-checked', 'true');
      await expect(dialog.getByRole('textbox', { name: `Tên tầng ${BASEMENT_NAME}`, exact: true })).toHaveCount(1);
      await captureEvidence(page, 'E02_wiz_switch_hit_area.png', { caption: 'click 1 px above the 20 px track → "Có tầng hầm" on, "Tầng hầm" row added' });
      const after = await basement.boundingBox();
      await page.mouse.click(probe.x, (after?.y ?? probe.top) + (after?.height ?? probe.height) + 1);
      await expect(basement).toHaveAttribute('aria-checked', 'false');
      await discardWizard(dialog);
    });
  });
});
