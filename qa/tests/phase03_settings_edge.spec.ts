/**
 * Phase 3 — SCR-08 project settings, REAL flows (QA-03d agent P1; plan `flow-plan.md` § phase03_settings_edge).
 * One `test()` per flow FL-08-01 … FL-08-09, walked in the user's order; one `test.step('[<row id>] …')` per catalog row
 * (`flow-catalog.md`), plus two `[extra]` steps kept from the old isolated edge file (S19, S21; no catalog row).
 * `H` rows use a hard `expect` (later steps depend on them), `S` rows `expect.soft`.
 *
 * FE source cited by file (this worktree, qa/phase03-depth c16f2428):
 *   PS  src/screens/project/ProjectSettings/ProjectSettings.tsx   UPS useProjectSettings.ts   UPM useProjectMembers.ts
 *   GT  GeneralTab.tsx  UT UnitsTab.tsx  MT MembersTab.tsx  AMF AddMemberForm.tsx  DZ DangerZoneTab.tsx
 *   MRD MemberRemoveDialog.tsx  RD ProjectSettingsReloadDialog.tsx  SE settingsErrors.ts  PSG projectSettingsGateway.ts
 *   PSC ProjectSettings.container.tsx  NF src/hooks/useNumericField.ts  NUM src/lib/format/number.ts
 *   INP src/components/ui/Input.tsx  TABS src/components/ui/Tabs.tsx  SEL src/hooks/useSelect.ts
 *   TST src/components/feedback/Toast.tsx  SI src/components/feedback/SaveIndicator.tsx  USI src/hooks/useSaveIndicator.ts
 *   MOD src/components/overlay/Modal.tsx  I18N src/i18n/vi.json
 *
 * ## Non-serial, real stack only
 * Each flow opens its OWN browser context and signs the admin in there (own refresh family: never reads or writes the
 * shared admin storage file, so parallel spec files cannot rotate each other's cookie), takes this context's
 * access token for a Bearer API client (`api`), seeds its OWN `qa-<runId>-08-…` project with `phase03Seed.createProject`
 * and deletes it in `finally`. No mock: every 4xx here is the real backend's (409 from a real PUT elsewhere, 422s from
 * BE validation, 404 from a project deleted elsewhere). "Held" = the real request only delayed (`holdFirst`), then sent.
 * Two technique notes: FL-08-08 enters settings by an in-app history push (no screen links to settings except the
 * notification centre), so Back is an SPA navigation that unmounts the screen; edits that must land inside one
 * 800 ms autosave window are written in ONE `page.evaluate` (native value setter + `input` event), so slowMo in a
 * watched run cannot split them.
 *
 * ## Real-backend budget per run (all 9 flows)
 * - `POST /api/auth/login` (120 / 60 s per IP): 9 admin (one per flow, API login in the flow's context) + 1 engineer
 *   (FL-08-05 cleanup: the admin left that project, only its engineer member can delete it).
 * - `POST /api/auth/refresh`: 1 per flow (Bearer token) + 1 per page load ≈ 35.
 * - `POST /api/users/invitations`: 0 when the pool already holds `engineer:p1-settings` / `viewer:p1-settings`
 *   (`F:/App/qa-results/user-pool-phase03.json`); 1 each on the first fill ever (phase03Seed.poolUser, own slot).
 * - `POST /api/projects`: 9 (one per flow except FL-08-08's unknown id … plus FL-08-08's own), every one deleted.
 * - `POST /api/projects/:id/members` (members_add 60 / 3600 s per actor): ~6 (2 refused 422, engineer ×2, viewer ×2 API).
 * - `PATCH /api/projects/:id` ~20, `PUT /api/projects/:id/settings` ~45, `DELETE /api/floors/:id` 2: no limit.
 * - `drawings_init`: 0 (no upload in this file).
 */
import { expect, request, test } from '@playwright/test';
import type { APIRequestContext, Browser, BrowserContext, Locator, Page, Route } from '@playwright/test';

import { ROUTES } from '../../e2e/fixtures/routes';
import { waitForApi, watchApi } from '../../e2e/fullstack/apiWatch';
import type { ApiEntry } from '../../e2e/fullstack/apiWatch';
import { readBaseUrl } from '../../e2e/fullstack/env';
import { signedInApi } from './support/api';
import { readAdminCredentials } from './support/auth';
import { TEST_DATA_PREFIX, attachJson, captureEvidence, testEmail } from './support/evidence';
import { createProject, deleteSeededProject, poolUser, type PoolUser, type SeededProject } from './support/phase03Seed';

/* ---------------------------------------------------------------- constants (each cites its source) */

const DESKTOP = { width: 1440, height: 900 } as const;
const COMPACT = { width: 375, height: 812 } as const;
type Viewport = { readonly width: number; readonly height: number };

/** Autosave fires 800 ms after the last edit (UPS createAutosave default); "nothing was sent" waits past it. */
const QUIET_MS = 2_500;
const REFRESH_API = '/api/auth/refresh';
const PROJECTS_API = '/api/projects';
/** Own pool slot: FL-08-05 changes these users' memberships, so no other file may share them (parallel files). */
const POOL_SLOT = 'p1-settings';

const SETTINGS_TABS = 'Nhóm cài đặt'; // PS TAB_GROUP_LABEL
const TAB = { general: 'Chung', units: 'Đơn vị đo', members: 'Thành viên', danger: 'Vùng nguy hiểm' } as const; // UPS TAB_LABELS
const NAME_LABEL = 'Tên dự án'; // GT
const CODE_LABEL = 'Mã dự án'; // GT
const CODE_HINT = 'Mã ngắn để tra cứu nhanh'; // GT
const ADDRESS_LABEL = 'Địa chỉ'; // GT
const BUILDING_LABEL = 'Loại công trình'; // GT
const NOTES_LABEL = 'Ghi chú'; // GT
const SNAP_LABEL = 'Dung sai bắt điểm'; // UT
const CONFIDENCE_LABEL = 'Ngưỡng tin cậy'; // UT
const SCALE_LABEL = 'Tỉ lệ bản vẽ'; // UT

const NAME_EMPTY = 'Chưa nhập tên dự án.'; // UPS nameProblemFor
const NAME_TOO_SHORT = 'Tên dự án cần ít nhất 3 ký tự.'; // UPS nameProblemFor (PROJECT_LIMITS.nameMinLength 3)
const NAME_CONTROL_TAB = 'Tên dự án có ký tự điều khiển (U+0009); hãy xoá ký tự đó.'; // UPS forbiddenCharProblem
const NAME_BIDI = 'Tên dự án có ký tự đảo chiều chữ (U+202E); hãy xoá ký tự đó.'; // UPS forbiddenCharProblem
const CODE_BIDI = 'Mã dự án có ký tự đảo chiều chữ (U+202E); hãy xoá ký tự đó.';
const ADDRESS_BIDI = 'Địa chỉ có ký tự đảo chiều chữ (U+202E); hãy xoá ký tự đó.';
const NOTES_BIDI = 'Ghi chú có ký tự đảo chiều chữ (U+202E); hãy xoá ký tự đó.';
const NOTES_BEL = 'Ghi chú có ký tự điều khiển (U+0007); hãy xoá ký tự đó.';
const NOTES_TOO_LONG = 'Ghi chú không quá 500 ký tự.'; // UPS notesProblemFor
const EMPTY_BLOCKED = 'Giá trị đã lưu không xoá trống được; hãy nhập giá trị khác.'; // SE emptyBlocked
const FIELD_REJECTED = 'Giá trị này chưa hợp lệ nên chưa được lưu; hãy sửa lại.'; // SE fieldRejected
const UNSAVED_PROBLEMS = 'Chưa lưu vì còn ô cần sửa'; // SE unsavedProblems / chipRejected
const CHIP_RELOAD = 'Chưa lưu: cần tải lại bản mới nhất'; // SE chipReload
const SAVE_FAILURE_TITLE = 'Chưa lưu hết'; // PS
const CONFLICT_TITLE = 'Cài đặt đã đổi ở nơi khác'; // PS
const CONFLICT_SENTENCE = 'Cài đặt dự án vừa được đổi ở nơi khác. Tải lại để xem bản mới nhất.'; // SE conflict
const RELOAD = 'Tải lại'; // PS action, RD confirm
const RELOAD_DIALOG = 'Tải lại sẽ bỏ thay đổi chưa lưu'; // RD
const RELOAD_DIALOG_BODY = 'Những thay đổi chưa lưu trên màn này sẽ mất, và bản mới nhất từ máy chủ sẽ thay vào chỗ đó.'; // RD
const KEEP_CHANGES = 'Giữ thay đổi'; // RD
const SAVED_TOAST = 'Đã lưu cài đặt dự án.'; // UPS SAVED_TOAST_MESSAGE
const UNDO = 'Hoàn tác'; // TST
const CHIP = { idle: 'Chưa có thay đổi', dirty: 'Có thay đổi chờ đồng bộ', saving: 'Đang lưu…' } as const; // I18N autosave.*
const SAVED_AT = /^Đã lưu lúc \d{1,2}:\d{2}$/u; // I18N common.saved_at
const LOAD_ERROR = 'Không tải được cài đặt dự án'; // PS
const GENERIC_NOT_FOUND = 'Nội dung này có thể đã bị xoá, hoặc đường dẫn chưa đúng.'; // I18N errors.notFound
const BACK_TO_PROJECTS = 'Về danh sách dự án'; // ProjectSpatialGate BACK_TO_PROJECTS_LABEL
const MEMBER = {
  email: 'Email người cần thêm', // AMF
  add: 'Thêm thành viên', // AMF
  required: 'Chưa nhập địa chỉ email.', // UPM
  already: 'Người này đã là thành viên.',
  unavailable: 'Không thêm được: địa chỉ này chưa có tài khoản đang hoạt động.',
  badEmail: 'Địa chỉ email chưa đúng.',
  lastEditor: 'Không gỡ được: dự án cần ít nhất một người sửa được cài đặt.',
  keep: 'Để nguyên',
  remove: 'Gỡ',
  otherMessage: 'Người này sẽ không còn truy cập được dự án. Muốn quay lại phải thêm lại.',
  selfMessage: 'Bạn sẽ mất quyền xem dự án này. Muốn quay lại phải nhờ người khác thêm lại.',
} as const;
const ROLE_BADGE = { admin: 'Quản trị', engineer: 'Kỹ sư', viewer: 'Người xem' } as const; // UPS ROLE_LABELS
const DANGER = {
  deleteProjectTitle: 'Xoá dự án này?', // UPS DANGER_TITLES
  deleteProject: 'Xoá dự án',
  typeName: 'Gõ lại tên dự án để xác nhận', // PS
  keep: 'Để nguyên', // PS
  deletedNotice: /Đã xoá dự án( "[^"]+")?\./u, // UPS PROJECT_DELETED_NOTICE; G3-37 nêu tên dự án
  deleteFloorsTitle: 'Xoá mọi tầng của dự án?',
  deleteFloors: 'Xoá mọi tầng',
  noFloorsTitle: 'Chưa có tầng nào', // DZ EmptyState
  noFloorsDescription: 'Dự án chưa có tầng nào, nên ở đây chưa có gì để xoá ngoài chính dự án.', // DZ
} as const;

/* ---------------------------------------------------------------- small helpers */

type Json = Record<string, unknown>;

const asRecord = (value: unknown, what: string): Json => {
  if (typeof value !== 'object' || value === null || Array.isArray(value)) throw new Error(`${what}: not a JSON object`);
  return value as Json;
};

const uniq = (): string => `${Date.now().toString(36)}${Math.random().toString(36).slice(2, 6)}`;
const escapeRegExp = (text: string): string => text.replace(/[.*+?^${}()|[\]\\]/gu, '\\$&');
const pathOf = (page: Page): string => new URL(page.url()).pathname;
const quiet = (page: Page): Promise<void> => page.waitForTimeout(QUIET_MS);

/** Writes the page sent since `mark`, minus session / telemetry chatter. */
const writesSince = (log: readonly ApiEntry[], mark: number): string[] =>
  log
    .slice(mark)
    .filter((entry) => entry.method !== 'GET' && entry.path !== REFRESH_API && !entry.path.startsWith('/api/telemetry'))
    .map((entry) => `${entry.method} ${entry.path} ${String(entry.status)}`);

const countSince = (log: readonly ApiEntry[], mark: number, method: string, path: RegExp): number =>
  log.slice(mark).filter((entry) => entry.method === method && path.test(entry.path)).length;

const projectRe = (id: string): RegExp => new RegExp(`^/api/projects/${escapeRegExp(id)}$`, 'u');
const settingsRe = (id: string): RegExp => new RegExp(`^/api/projects/${escapeRegExp(id)}/settings$`, 'u');
const membersRe = (id: string): RegExp => new RegExp(`^/api/projects/${escapeRegExp(id)}/members$`, 'u');
const memberRe = (id: string): RegExp => new RegExp(`^/api/projects/${escapeRegExp(id)}/members/[^/]+$`, 'u');
const floorDeleteRe = /^\/api\/floors\/[^/]+$/u;

/** JSON body of a sent request (PATCH #26 is the body itself; PUT N6 wraps it: `{baseVersion, body}`). */
const sentJson = (result: { readonly response: { request: () => { postDataJSON: () => unknown } } }, what: string): Json =>
  asRecord(result.response.request().postDataJSON() as unknown, what);
const sentSettingsBody = (result: Parameters<typeof sentJson>[0]): Json => asRecord(sentJson(result, 'PUT settings').body, 'PUT settings body');

const field = (page: Page, label: string): Locator => page.getByRole('textbox', { name: label, exact: true });
const toastWith = (page: Page, text: string | RegExp): Locator => page.getByRole('status').filter({ hasText: text }); // TST role=status
/** Header save chip (PS `SaveIndicator`, SI role=status). */
const saveChip = (page: Page): Locator => page.locator('header').getByRole('status');
const tablist = (page: Page): Locator => page.getByRole('navigation', { name: 'Mục trong trang', exact: true }); // S-04: mục lục trái (link), không còn tablist
/** A tab by its label; the accessible name may carry a problem badge after it (TABS:141-152). */
const tab = (page: Page, label: string): Locator => tablist(page).getByRole('link', { name: new RegExp(`^${escapeRegExp(label)}`, 'u') });
const failureBox = (page: Page): Locator => page.getByRole('alert').filter({ hasText: SAVE_FAILURE_TITLE });
/** Alerts of the screen itself: the app announcer keeps a hidden `role="alert"` region on every page (announcer.ts). */
const screenAlerts = (page: Page): Locator => page.getByRole('alert').and(page.locator(':not([data-announcer])'));
const conflictStrip = (page: Page): Locator => page.getByRole('alert').filter({ hasText: CONFLICT_TITLE });
const horizontalOverflow = (page: Page): Promise<number> =>
  page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
const isFocused = (target: Locator): Promise<boolean> => target.evaluate((el) => el === document.activeElement).catch(() => false);

/** Presses Tab until `target` holds focus (at most `max` presses); `true` when it got there. */
async function tabTo(page: Page, target: Locator, max = 25): Promise<boolean> {
  for (let i = 0; i < max; i += 1) {
    if (await isFocused(target)) return true;
    await page.keyboard.press('Tab');
  }
  return isFocused(target);
}

/**
 * Writes several labelled fields in ONE page task (native value setter + `input` event, so React's onChange runs),
 * then optionally Back / reload in the same task: everything lands inside one 800 ms autosave window whatever slowMo is.
 */
async function setValues(page: Page, values: ReadonlyArray<readonly [string, string]>, then: 'none' | 'back' | 'reload' = 'none'): Promise<void> {
  await page.evaluate(
    ({ pairs, after }) => {
      for (const [label, value] of pairs) {
        const tag = [...document.querySelectorAll('label')].find((node) => node.textContent?.trim() === label);
        const control = tag?.htmlFor ? document.getElementById(tag.htmlFor) : null;
        if (!(control instanceof HTMLInputElement) && !(control instanceof HTMLTextAreaElement)) throw new Error(`no field labelled "${label}"`);
        const proto = control instanceof HTMLInputElement ? HTMLInputElement.prototype : HTMLTextAreaElement.prototype;
        Object.getOwnPropertyDescriptor(proto, 'value')?.set?.call(control, value);
        control.dispatchEvent(new Event('input', { bubbles: true }));
      }
      if (after === 'back') history.back();
      if (after === 'reload') location.reload();
    },
    { pairs: values, after: then },
  );
}

/**
 * Types into a NumericField without leaving it (NF commits on blur or 800 ms later). Same BUG-224 guard as
 * `support/numeric-field.ts typeHeight`: focus, let the focus render land, select all, insert in one go.
 */
async function typeNumber(box: Locator, text: string, commit = false): Promise<void> {
  const page = box.page();
  await box.focus();
  await page.evaluate(() => new Promise<void>((resolve) => requestAnimationFrame(() => requestAnimationFrame(() => resolve()))));
  await box.press('Control+A');
  if (text === '') await box.press('Delete');
  else await page.keyboard.insertText(text);
  await expect(box).toHaveValue(text);
  if (commit) await box.press('Tab');
}

/** Holds the FIRST matching request until `release()`, then lets it through to the real backend (a delay, not a mock). */
async function holdFirst(page: Page, match: (url: URL, method: string) => boolean): Promise<{ readonly seen: Promise<void>; release: () => Promise<void> }> {
  let open: () => void = () => undefined;
  let seenResolve: () => void = () => undefined;
  const gate = new Promise<void>((resolve) => (open = resolve));
  const seen = new Promise<void>((resolve) => (seenResolve = resolve));
  let held = false;
  const handler = async (route: Route): Promise<void> => {
    const req = route.request();
    if (held || !match(new URL(req.url()), req.method())) {
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

/** `initialsOf` (src/lib/format/initials.ts) — the avatar text a member row should show. */
function initialsOf(name: string, email = ''): string {
  const source = name.trim() || (email.split('@')[0] ?? '');
  const words = source.split(/\s+/u).filter((word) => word !== '');
  const first = words[0];
  const last = words[words.length - 1];
  if (first === undefined || last === undefined) return '';
  const letters = words.length === 1 ? Array.from(first).slice(0, 2) : [Array.from(first)[0], Array.from(last)[0]];
  return letters.join('').toLocaleUpperCase('vi');
}

/* ---------------------------------------------------------------- admin session + Bearer API */

interface Session {
  readonly context: BrowserContext;
  readonly page: Page;
  readonly log: ApiEntry[];
  /** Bearer client of this context's own refresh (the "other writer" and the seeds). */
  readonly api: APIRequestContext;
  /** Project ids deleted when the session closes (200 / 404 both fine). */
  readonly cleanup: string[];
}

function readAccessToken(json: unknown): string {
  const body = asRecord(json, 'POST /api/auth/refresh');
  const root = typeof body.data === 'object' && body.data !== null ? asRecord(body.data, 'refresh.data') : body;
  const token = typeof root.accessToken === 'string' ? root.accessToken : typeof root.access_token === 'string' ? root.access_token : '';
  if (token === '') throw new Error('POST /api/auth/refresh: no access token in the body');
  return token;
}

async function openSession(browser: Browser, viewport: Viewport): Promise<Session> {
  const base = readBaseUrl();
  // Own sign-in in this context's own cookie jar (not the shared admin storage file): spec files run in parallel
  // (--workers 4), and a refresh cookie rotated here must not break another file's session.
  const context = await browser.newContext({ baseURL: base, viewport });
  try {
    const { email, password } = readAdminCredentials();
    const login = await context.request.post('/api/auth/login', { data: { email, password, rememberMe: false }, headers: { Origin: base } });
    expect(login.status(), 'POST /api/auth/login (admin, own context)').toBe(204);
    const refreshed = await context.request.post(REFRESH_API, { headers: { Origin: base } });
    expect(refreshed.status(), 'POST /api/auth/refresh (flow token)').toBe(200);
    const token = readAccessToken(await refreshed.json());
    const api = await request.newContext({ baseURL: base, extraHTTPHeaders: { Origin: base, Authorization: `Bearer ${token}` } });
    const page = await context.newPage();
    return { context, page, log: watchApi(page), api, cleanup: [] };
  } catch (error) {
    await context.close();
    throw error;
  }
}

async function withSession(browser: Browser, body: (s: Session) => Promise<void>, viewport: Viewport = DESKTOP): Promise<void> {
  const s = await openSession(browser, viewport);
  try {
    await body(s);
  } finally {
    for (const id of s.cleanup) await deleteSeededProject(s.api, id);
    await s.api.dispose().catch(() => undefined);
    await s.context.close().catch(() => undefined);
  }
}

async function seed(s: Session, slug: string, floors = 0): Promise<SeededProject> {
  const project = await createProject(s.api, slug, floors);
  s.cleanup.push(project.projectId);
  return project;
}

async function openSettings(page: Page, project: { readonly projectId: string; readonly name: string }): Promise<void> {
  await page.goto(ROUTES.project.settings(project.projectId));
  await expect(field(page, NAME_LABEL)).toHaveValue(project.name);
}

/** N6 read + full-body write from "elsewhere" (BE project_settings/router.py), same shape the screen sends (PSG toUnitsBody). */
async function putSettingsElsewhere(api: APIRequestContext, projectId: string, notes: string): Promise<void> {
  const read = await api.get(`${PROJECTS_API}/${projectId}/settings`);
  expect(read.status(), 'API GET settings (the other writer)').toBe(200);
  const current = asRecord(await read.json(), 'GET settings');
  const written = await api.put(`${PROJECTS_API}/${projectId}/settings`, {
    data: {
      baseVersion: current.revision,
      body: {
        buildingType: current.buildingType,
        lengthUnit: current.lengthUnit,
        snapToleranceMm: current.snapToleranceMm,
        confidenceThreshold: current.confidenceThreshold,
        defaultScaleMmPerPx: current.defaultScaleMmPerPx,
        notes,
      },
    },
  });
  expect(written.status(), 'API PUT settings (the other writer)').toBe(200);
}

interface MemberRow {
  readonly id: string;
  readonly name: string;
  readonly email: string;
}

async function readMembers(api: APIRequestContext, projectId: string): Promise<MemberRow[]> {
  const read = await api.get(`${PROJECTS_API}/${projectId}`);
  expect(read.status(), `API GET ${PROJECTS_API}/:id`).toBe(200);
  const rows = asRecord(await read.json(), 'GET project').members;
  return (Array.isArray(rows) ? rows : []).map((row) => {
    const m = asRecord(row, 'member');
    return { id: String(m.id), name: String(m.name), email: String(m.email) };
  });
}

/* ================================================================= flows */

test.describe('E03 SCR-08 project settings — real flows (QA-03d P1)', () => {
  test('SCR-08 · FL-08-01 · admin fixes a bad project name, then renames it and sees it on the dashboard', async ({ browser }) => {
    await withSession(browser, async (s) => {
      const { page, log } = s;
      const project = await seed(s, '08-a-007');
      const name = field(page, NAME_LABEL);
      const pid = project.projectId;

      await test.step('[08-C-001] deep link opens "Chung"; emptied / 3 spaces → "Chưa nhập tên dự án."; no PATCH', async () => {
        await openSettings(page, project);
        await expect(tab(page, TAB.general)).toHaveAttribute('aria-current', 'true');
        await expect(name).toHaveAttribute('maxlength', '80'); // GT, PSG nameMaxLength (fold: maxlength 80)
        const mark = log.length;
        await name.fill('');
        await expect(page.getByText(NAME_EMPTY, { exact: true })).toBeVisible();
        await name.fill('   ');
        await expect(page.getByText(NAME_EMPTY, { exact: true })).toBeVisible(); // trimmed (UPS nameProblemFor)
        await quiet(page);
        expect(countSince(log, mark, 'PATCH', projectRe(pid)), 'no PATCH while the name is refused').toBe(0);
        await captureEvidence(page, 'E03_08-C-001_name-empty.png');
      });

      await test.step('[08-E-003] field error wiring: <p role=alert>, aria-invalid, aria-describedby → error id; hint id without error', async () => {
        const error = page.getByRole('alert').filter({ hasText: NAME_EMPTY });
        const errorId = await error.getAttribute('id');
        expect.soft(errorId, 'INP: error <p> carries an id').toBeTruthy();
        await expect.soft(name).toHaveAttribute('aria-invalid', 'true');
        await expect.soft(name).toHaveAttribute('aria-describedby', new RegExp(`(^|\\s)${escapeRegExp(errorId ?? '?')}(\\s|$)`, 'u'));
        // "Mã dự án" has no error and a hint: its describedby points at the hint (INP hintId).
        const code = field(page, CODE_LABEL);
        await expect.soft(code).not.toHaveAttribute('aria-invalid', 'true');
        const hintId = await code.getAttribute('aria-describedby');
        expect.soft(hintId === null ? '' : await page.locator(`[id="${hintId}"]`).innerText(), 'describedby → the hint').toBe(CODE_HINT);
      });

      await test.step('[08-E-002] with 1 problem the contents link name is "Chung Cần sửa"', async () => {
        await expect.soft(tablist(page).getByRole('link', { name: /^Chung.?Cần sửa$/u })).toHaveCount(1);
        await captureEvidence(page, 'E03_08-E-002_tab-badge-name.png');
      });

      await test.step('[08-C-002] "ab" → "Tên dự án cần ít nhất 3 ký tự."; no PATCH', async () => {
        const mark = log.length;
        await name.fill('ab');
        await expect.soft(page.getByText(NAME_TOO_SHORT, { exact: true })).toBeVisible();
        await quiet(page);
        expect.soft(countSince(log, mark, 'PATCH', projectRe(pid)), 'no PATCH for 2 characters').toBe(0);
        await captureEvidence(page, 'E03_08-C-002_name-short.png');
      });

      await test.step('[08-C-007] a tab inside the name → "… ký tự điều khiển (U+0009) …"; no PATCH', async () => {
        const mark = log.length;
        await name.fill('qa\tten du an');
        await expect.soft(page.getByText(NAME_CONTROL_TAB, { exact: true })).toBeVisible();
        await quiet(page);
        expect.soft(countSince(log, mark, 'PATCH', projectRe(pid)), 'no PATCH with a control character').toBe(0);
        await captureEvidence(page, 'E03_08-C-007_name-control.png');
      });

      await test.step('[08-C-006] name + U+202E → "… ký tự đảo chiều chữ (U+202E) …"; chip "Chưa lưu vì còn ô cần sửa"; no PATCH', async () => {
        const mark = log.length;
        await name.fill(`${project.name}\u202E`);
        await expect.soft(page.getByText(NAME_BIDI, { exact: true })).toBeVisible();
        await expect.soft(saveChip(page)).toHaveText(UNSAVED_PROBLEMS);
        await quiet(page);
        expect.soft(countSince(log, mark, 'PATCH', projectRe(pid)), 'no PATCH with a bidi mark').toBe(0);
        await expect.soft(failureBox(page)).toHaveCount(0);
        await captureEvidence(page, 'E03_08-C-006_name-bidi.png');
      });

      await test.step('[08-C-003] exactly 3 characters → no message, PATCH 200', async () => {
        const patch = waitForApi(page, 'PATCH', projectRe(pid), [200]);
        await name.fill('abc');
        expect(sentJson(await patch, 'PATCH').name).toBe('abc');
        await expect(screenAlerts(page)).toHaveCount(0);
      });

      await test.step('[08-C-004] maxlength 80; an 80-character name → PATCH 200, field keeps 80 chars', async () => {
        const long = `${TEST_DATA_PREFIX}08-c-004-`.padEnd(80, 'x');
        const patch = waitForApi(page, 'PATCH', projectRe(pid), [200]);
        await name.fill(long);
        expect(String(sentJson(await patch, 'PATCH').name).length).toBe(80);
        await expect(name).toHaveValue(long);
      });

      await test.step('[08-C-008] "  name  " → PATCH has the raw text, field adopts the trimmed server value, no second PATCH', async () => {
        const core = `${TEST_DATA_PREFIX}08-c-008-${uniq()}`;
        const patch = waitForApi(page, 'PATCH', projectRe(pid), [200]);
        await name.fill(`  ${core}  `);
        const sent = await patch;
        const mark = log.length;
        expect.soft(sentJson(sent, 'PATCH').name, 'raw text on the wire').toBe(`  ${core}  `);
        await expect.soft(name).toHaveValue(core); // UPS adoptSavedParts
        await quiet(page);
        expect.soft(countSince(log, mark, 'PATCH', projectRe(pid)), 'no ghost second PATCH').toBe(0);
      });

      await test.step('[08-C-009] name typed in NFD → field adopts the NFC value, chip "Đã lưu lúc …", no second PATCH', async () => {
        const stem = `${TEST_DATA_PREFIX}08-c-009-cafe`;
        const patch = waitForApi(page, 'PATCH', projectRe(pid), [200]);
        await name.fill(`${stem}\u0301`);
        await patch;
        const mark = log.length;
        await expect.soft(name).toHaveValue(`${stem}\u0301`.normalize('NFC')); // BE clean_text trim → NFC
        await expect.soft(saveChip(page)).toHaveText(SAVED_AT);
        await quiet(page);
        expect.soft(countSince(log, mark, 'PATCH', projectRe(pid)), 'no ghost second PATCH').toBe(0);
      });

      await test.step('[08-B-017] 2 emoji → PATCH 422; field sentence under "Tên dự án"; tab "Chung" badge 1', async () => {
        const patch = waitForApi(page, 'PATCH', projectRe(pid), [422]);
        await name.fill('\u{1F3E0}\u{1F3E2}'); // 4 UTF-16 units ≥ 3 for the FE, 2 code points < 3 for BE NAME_MIN
        const { json } = await patch;
        expect.soft(asRecord(json, '422').field, 'BE names the field').toBe('name');
        await expect.soft(page.getByRole('alert').filter({ hasText: FIELD_REJECTED })).toHaveCount(1);
        await expect.soft(tablist(page).getByRole('link', { name: /^Chung.?Cần sửa$/u })).toHaveCount(1);
        await captureEvidence(page, 'E03_08-B-017_name-422-emoji.png');
        await attachJson('E03_08-B-017_name-422-emoji.json', { response: json as Json });
      });

      const renamed = `${TEST_DATA_PREFIX}08-a-007-${uniq()}`;
      await test.step('[08-A-007] valid new name → PATCH body only `name`; toast; "/" shows the card with the new name', async () => {
        const patch = waitForApi(page, 'PATCH', projectRe(pid), [200]);
        await name.fill(renamed);
        expect(Object.keys(sentJson(await patch, 'PATCH'))).toEqual(['name']);
        await expect(toastWith(page, SAVED_TOAST).first()).toBeVisible();
        await page.goto(ROUTES.dashboard);
        const list = page.getByRole('list', { name: 'Danh sách dự án', exact: true });
        await expect(list.getByRole('listitem', { name: renamed, exact: true })).toBeVisible();
        await captureEvidence(page, 'E03_08-A-007_renamed-on-dashboard.png');
      });

      await test.step('[extra] S19 "Mã dự án" of three spaces passes the field, server 422 `code` → one sentence at the field, no "Chưa lưu hết"', async () => {
        await openSettings(page, { projectId: pid, name: renamed });
        // UPS codeProblemFor checks the trimmed text only; PSG sends "   "; BE ProjectCode strips → min_length 1 → 422.
        const patch = waitForApi(page, 'PATCH', projectRe(pid), [422]);
        await field(page, CODE_LABEL).fill('   ');
        const { json } = await patch;
        expect.soft(asRecord(json, '422').field).toBe('code');
        await expect.soft(page.getByText(FIELD_REJECTED, { exact: true })).toHaveCount(1);
        await expect.soft(failureBox(page)).toHaveCount(0);
        await expect.soft(saveChip(page)).toContainText(UNSAVED_PROBLEMS);
        await captureEvidence(page, 'E03_extra-S19_code-422-field.png');
      });

      await test.step('[extra] S21 name + code in one PATCH, 422 on `code` → "Chưa lưu hết": "Chưa lưu được tên dự án và mã dự án. …"', async () => {
        const patch = waitForApi(page, 'PATCH', projectRe(pid), [422]);
        await setValues(page, [
          [NAME_LABEL, `${renamed}x`.slice(-80)],
          [CODE_LABEL, '    '],
        ]);
        expect.soft(Object.keys(sentJson(await patch, 'PATCH')).sort(), 'one PATCH carries name and code').toEqual(['code', 'name']);
        await expect.soft(failureBox(page)).toContainText('Chưa lưu được tên dự án và mã dự án. Sửa lại giá trị đó, hệ thống sẽ tự lưu tiếp.');
        await expect.soft(page.getByText(FIELD_REJECTED, { exact: true })).toHaveCount(1);
        await captureEvidence(page, 'E03_extra-S21_mixed-422-box.png');
      });
    });
  });

  test('SCR-08 · FL-08-02 · admin edits notes, type, code and address: autosave chip, toast, undo, field refusals', async ({ browser }) => {
    test.setTimeout(200_000);
    await withSession(browser, async (s) => {
      const { page, log } = s;
      const project = await seed(s, '08-b-006');
      const pid = project.projectId;
      const notes = field(page, NOTES_LABEL);
      await page.clock.install(); // before goto: the 8 s toast window and the 60 s chip age are driven by runFor

      await test.step('[08-B-006] chip "Chưa có thay đổi" → "Có thay đổi chờ đồng bộ" → "Đang lưu…" → "Đã lưu lúc HH:MM"', async () => {
        await openSettings(page, project);
        await expect(saveChip(page)).toHaveText(CHIP.idle);
        // Pause the page clock so the 800 ms dirty window cannot slip by; hold the PUT to see "Đang lưu…".
        await page.clock.pauseAt(await page.evaluate(() => Date.now() + 50));
        const hold = await holdFirst(page, (url, method) => method === 'PUT' && settingsRe(pid).test(url.pathname));
        const put = waitForApi(page, 'PUT', settingsRe(pid), [200]);
        try {
          await notes.fill(`qa chip ${uniq()}`);
          await expect(saveChip(page)).toHaveText(CHIP.dirty);
          await page.clock.resume();
          await hold.seen;
          await expect(saveChip(page)).toHaveText(CHIP.saving);
          await captureEvidence(page, 'E03_08-B-006_chip-saving.png');
        } finally {
          await page.clock.resume().catch(() => undefined);
          await hold.release();
        }
        await put;
        await expect(saveChip(page)).toHaveText(SAVED_AT);
        await captureEvidence(page, 'E03_08-B-006_chip-saved.png');
      });

      await test.step('[08-E-004] the save chip is role=status aria-live=polite', async () => {
        await expect.soft(saveChip(page)).toHaveAttribute('aria-live', 'polite');
        // Let the first save toast run out (8 s, TST rAF countdown) so the next steps see one toast at a time.
        await page.clock.runFor(9_000);
        await expect(toastWith(page, SAVED_TOAST)).toHaveCount(0);
      });

      let burst = '';
      let before = '';
      await test.step('[08-A-013] a burst of keys in "Ghi chú" → exactly one PUT ~800 ms after the last key, body.notes = final text', async () => {
        before = await notes.inputValue();
        burst = `qa burst ${uniq()}`;
        const mark = log.length;
        const put = waitForApi(page, 'PUT', settingsRe(pid), [200]);
        await notes.focus();
        await page.keyboard.press('Control+A');
        await notes.pressSequentially(burst, { delay: 40 });
        expect(sentSettingsBody(await put).notes).toBe(burst);
        await quiet(page);
        expect(countSince(log, mark, 'PUT', settingsRe(pid)), 'one PUT for the whole burst').toBe(1);
      });

      await test.step('[08-E-005] toast "Đã lưu cài đặt dự án." is role=status; Tab reaches "Hoàn tác", Enter activates it', async () => {
        const toast = toastWith(page, SAVED_TOAST).first();
        await expect.soft(toast).toBeVisible();
        const undo = toast.getByRole('button', { name: UNDO, exact: true });
        await notes.focus();
        expect.soft(await tabTo(page, undo), 'Tab reaches the toast "Hoàn tác"').toBe(true);
        await captureEvidence(page, 'E03_08-E-005_toast-undo-focus.png');
      });

      await test.step('[08-A-014] the undo sends a second PUT restoring the previous notes; the field shows them', async () => {
        const undo = toastWith(page, SAVED_TOAST).first().getByRole('button', { name: UNDO, exact: true });
        const put = waitForApi(page, 'PUT', settingsRe(pid), [200]);
        if (await isFocused(undo)) await page.keyboard.press('Enter');
        else await undo.click(); // E-005 already reported the focus failure
        const body = sentSettingsBody(await put);
        // PSG toUnitsBody: empty notes travel as an absent key.
        if (before === '') expect(body.notes, 'previous notes were empty → key absent').toBeUndefined();
        else expect(body.notes).toBe(before);
        await expect(notes).toHaveValue(before);
        await captureEvidence(page, 'E03_08-A-014_undo-restored.png');
        await page.clock.runFor(9_000);
      });

      await test.step('[08-A-011] "Loại công trình" lists 5 types; "Công nghiệp" → PUT buildingType "industrial", no PATCH; kept after reload', async () => {
        const select = page.getByRole('combobox', { name: BUILDING_LABEL, exact: true });
        await select.click();
        await expect.soft(page.getByRole('option')).toHaveText(['Nhà ở', 'Thương mại', 'Công nghiệp', 'Hỗn hợp', 'Khác']); // UPS BUILDING_TYPE_OPTIONS
        const mark = log.length;
        const put = waitForApi(page, 'PUT', settingsRe(pid), [200]);
        await page.getByRole('option', { name: 'Công nghiệp', exact: true }).click();
        expect(sentSettingsBody(await put).buildingType).toBe('industrial');
        expect(countSince(log, mark, 'PATCH', projectRe(pid)), 'building type is not a #26 field').toBe(0);
        await page.reload();
        await expect(page.getByRole('combobox', { name: BUILDING_LABEL, exact: true })).toContainText('Công nghiệp');
        await captureEvidence(page, 'E03_08-A-011_building-type-kept.png');
      });

      await test.step('[08-A-015] save toast: hovered it stays past 8 s; pointer off + 8 s → toast and "Hoàn tác" gone, no extra request', async () => {
        const put = waitForApi(page, 'PUT', settingsRe(pid), [200]);
        await notes.fill(`qa toast ${uniq()}`);
        await put;
        const toast = toastWith(page, SAVED_TOAST).first();
        await expect(toast).toBeVisible();
        const mark = log.length;
        await toast.hover();
        await page.clock.runFor(9_000);
        await expect.soft(toast, 'hovered: the countdown is paused (TST isHovered)').toBeVisible();
        await captureEvidence(page, 'E03_08-A-015_toast-hovered.png');
        await page.mouse.move(5, 5);
        await page.clock.runFor(9_000);
        await expect.soft(toastWith(page, SAVED_TOAST)).toHaveCount(0);
        await expect.soft(page.getByRole('button', { name: UNDO, exact: true })).toHaveCount(0);
        expect.soft(writesSince(log, mark), 'the expiry sends nothing').toEqual([]);
        await captureEvidence(page, 'E03_08-A-015_toast-expired.png');
      });

      await test.step('[08-B-007] 60 s after the save the chip reads "Đã lưu 1 phút trước"', async () => {
        await page.clock.runFor(61_000); // USI tick every 30 s; > 60 s → relative label
        await expect.soft(saveChip(page)).toHaveText(/^Đã lưu 1 phút trước$/u);
        await captureEvidence(page, 'E03_08-B-007_chip-1-minute.png');
      });

      await test.step('[08-A-012] "Tên dự án" + "Ghi chú" inside one 800 ms window → one PATCH + one PUT, exactly one toast', async () => {
        const mark = log.length;
        const patch = waitForApi(page, 'PATCH', projectRe(pid), [200]);
        const put = waitForApi(page, 'PUT', settingsRe(pid), [200]);
        await setValues(page, [
          [NAME_LABEL, `${project.name}-2`.slice(-80)],
          [NOTES_LABEL, `qa pair ${uniq()}`],
        ]);
        await Promise.all([patch, put]);
        await quiet(page);
        expect(countSince(log, mark, 'PATCH', projectRe(pid)), 'one PATCH').toBe(1);
        expect(countSince(log, mark, 'PUT', settingsRe(pid)), 'one PUT').toBe(1);
        await expect(toastWith(page, SAVED_TOAST)).toHaveCount(1);
        await captureEvidence(page, 'E03_08-A-012_one-toast.png');
        await page.clock.runFor(9_000);
      });

      await test.step('[08-C-018] multi-line note with a tab saves (newline kept); U+0007 → "… ký tự điều khiển (U+0007) …"', async () => {
        const multi = `dòng một\n\tdòng hai ${uniq()}`;
        const put = waitForApi(page, 'PUT', settingsRe(pid), [200]);
        await notes.fill(multi);
        expect.soft(sentSettingsBody(await put).notes, 'PUT keeps the newline and the tab').toBe(multi);
        await notes.fill(`${multi}\u0007`);
        await expect.soft(page.getByText(NOTES_BEL, { exact: true })).toBeVisible();
        await captureEvidence(page, 'E03_08-C-018_notes-bel.png');
        await notes.fill(multi); // fix: back to the saved text, nothing to send
      });

      await test.step('[08-C-016] 500 characters → PUT 200, "500 / 500 ký tự"; 501 → "Ghi chú không quá 500 ký tự.", no PUT', async () => {
        const put = waitForApi(page, 'PUT', settingsRe(pid), [200]);
        await notes.fill('a'.repeat(500));
        expect.soft(String(sentSettingsBody(await put).notes).length).toBe(500);
        await expect.soft(page.getByText('500 / 500 ký tự', { exact: true })).toBeVisible();
        const mark = log.length;
        await notes.fill('a'.repeat(501));
        await expect.soft(page.getByText(NOTES_TOO_LONG, { exact: true })).toBeVisible();
        await quiet(page);
        expect.soft(countSince(log, mark, 'PUT', settingsRe(pid)), 'no PUT over 500 characters').toBe(0);
        await captureEvidence(page, 'E03_08-C-016_notes-501.png');
      });

      let markBidi = 0;
      await test.step('[08-C-017] notes + U+202E → "Ghi chú có ký tự đảo chiều chữ (U+202E); hãy xoá ký tự đó."', async () => {
        markBidi = log.length;
        await notes.fill('qa \u202Eghi chú');
        await expect.soft(page.getByText(NOTES_BIDI, { exact: true })).toBeVisible();
        await captureEvidence(page, 'E03_08-C-017_notes-bidi.png');
      });

      await test.step('[08-B-008] same state: chip "Chưa lưu vì còn ô cần sửa", no PUT, no "Chưa lưu hết"', async () => {
        await expect.soft(saveChip(page)).toHaveText(UNSAVED_PROBLEMS);
        await quiet(page);
        expect.soft(countSince(log, markBidi, 'PUT', settingsRe(pid)), 'a refused character sends no PUT').toBe(0);
        await expect.soft(failureBox(page)).toHaveCount(0);
        await captureEvidence(page, 'E03_08-B-008_chip-unsaved-problems.png');
      });

      await test.step('[08-B-016] notes of 3 spaces → PUT 422 body.notes → field sentence; chip "Chưa lưu vì còn ô cần sửa"; no "Chưa lưu hết"', async () => {
        const put = waitForApi(page, 'PUT', settingsRe(pid), [422]);
        await notes.fill('   ');
        const { json } = await put;
        expect.soft(asRecord(json, '422').field).toBe('body.notes'); // SE PROBLEM_KEY_BY_WIRE_FIELD
        await expect.soft(page.getByText(FIELD_REJECTED, { exact: true })).toHaveCount(1);
        await expect.soft(saveChip(page)).toHaveText(UNSAVED_PROBLEMS);
        await expect.soft(failureBox(page)).toHaveCount(0);
        await captureEvidence(page, 'E03_08-B-016_notes-422-field.png');
        await attachJson('E03_08-B-016_notes-422-field.json', { response: json as Json });
      });

      await test.step('[08-B-018] typing in the refused "Ghi chú" removes the server sentence at once; the new value goes out (PUT 200)', async () => {
        const put = waitForApi(page, 'PUT', settingsRe(pid), [200]);
        await notes.fill(`qa fixed ${uniq()}`);
        await expect(page.getByText(FIELD_REJECTED, { exact: true })).toHaveCount(0);
        await put;
        await page.clock.runFor(9_000);
      });

      const code = field(page, CODE_LABEL);
      const address = field(page, ADDRESS_LABEL);
      await test.step('[08-C-012] "Mã dự án" typed then cleared inside 800 ms (nothing saved) → no message, no PATCH', async () => {
        const mark = log.length;
        await setValues(page, [
          [CODE_LABEL, 'QA-X'],
          [CODE_LABEL, ''],
        ]);
        await quiet(page);
        await expect.soft(code).toHaveValue('');
        await expect.soft(screenAlerts(page)).toHaveCount(0);
        expect.soft(countSince(log, mark, 'PATCH', projectRe(pid)), 'empty code is not sent').toBe(0);
      });

      await test.step('[08-C-013] "Mã dự án" + U+202E → "Mã dự án có ký tự đảo chiều chữ (U+202E) …"; then cleared', async () => {
        await code.fill('QA\u202E1');
        await expect.soft(page.getByText(CODE_BIDI, { exact: true })).toBeVisible();
        await captureEvidence(page, 'E03_08-C-013_code-bidi.png');
        await code.fill('');
        await expect(page.getByText(CODE_BIDI, { exact: true })).toHaveCount(0);
      });

      await test.step('[08-C-014] "Địa chỉ" + U+202E → "Địa chỉ có ký tự đảo chiều chữ (U+202E) …"; then cleared', async () => {
        await address.fill('qa \u202Eđịa chỉ');
        await expect.soft(page.getByText(ADDRESS_BIDI, { exact: true })).toBeVisible();
        await captureEvidence(page, 'E03_08-C-014_address-bidi.png');
        await address.fill('');
        await expect(page.getByText(ADDRESS_BIDI, { exact: true })).toHaveCount(0);
      });

      await test.step('[08-C-010] "Mã dự án" maxlength 32 + hint "Mã ngắn để tra cứu nhanh"; "Địa chỉ" maxlength 200', async () => {
        await expect.soft(code).toHaveAttribute('maxlength', '32');
        await expect.soft(page.getByText(CODE_HINT, { exact: true })).toBeVisible();
        await expect.soft(address).toHaveAttribute('maxlength', '200');
      });

      await test.step('[08-C-011] save code "QA-E03" + an address, then empty both → "Giá trị đã lưu không xoá trống được …" ×2; no PATCH', async () => {
        const saved = waitForApi(page, 'PATCH', projectRe(pid), [200]);
        await setValues(page, [
          [CODE_LABEL, 'QA-E03'],
          [ADDRESS_LABEL, 'qa địa chỉ e03'],
        ]);
        const body = sentJson(await saved, 'PATCH');
        expect.soft(body.code).toBe('QA-E03');
        expect.soft(body.address).toBe('qa địa chỉ e03');
        await expect(saveChip(page)).toHaveText(SAVED_AT);
        const mark = log.length;
        await code.fill('');
        await address.fill('');
        await expect.soft(page.getByText(EMPTY_BLOCKED, { exact: true })).toHaveCount(2);
        await quiet(page);
        expect.soft(countSince(log, mark, 'PATCH', projectRe(pid)), 'no PATCH with an emptied code/address').toBe(0);
        await captureEvidence(page, 'E03_08-C-011_code-address-empty.png');
      });

      await test.step('[08-B-026] also empty name + 501-char notes → tab "Chung" badge 4; "Đơn vị đo" and "Thành viên" no badge', async () => {
        await field(page, NAME_LABEL).fill('');
        await notes.fill('a'.repeat(501));
        await expect.soft(tab(page, TAB.general)).toHaveText(/^Chung\s*4$/u);
        await expect.soft(tab(page, TAB.units)).toHaveText(TAB.units);
        await expect.soft(tab(page, TAB.members)).toHaveText(TAB.members);
        await captureEvidence(page, 'E03_08-B-026_tab-badge-4.png');
      });
    });
  });

  test('SCR-08 · FL-08-03 · admin tunes "Đơn vị đo": snap tolerance, confidence and scale bounds, parsing, keyboard', async ({ browser }) => {
    test.setTimeout(200_000);
    await withSession(browser, async (s) => {
      const { page, log } = s;
      const project = await seed(s, '08-c-019');
      const pid = project.projectId;
      const snap = field(page, SNAP_LABEL);
      const confidence = field(page, CONFIDENCE_LABEL);
      const scale = field(page, SCALE_LABEL);
      const units = async (): Promise<void> => {
        await tab(page, TAB.units).click();
        await expect(snap).toBeVisible();
      };

      await test.step('[08-A-003] "Đơn vị đo", reload → "Chung" selected again (tab not in the URL)', async () => {
        await openSettings(page, project);
        await units();
        await page.reload();
        await expect(field(page, NAME_LABEL)).toHaveValue(project.name);
        await expect(tab(page, TAB.general)).toHaveAttribute('aria-current', 'true');
        await captureEvidence(page, 'E03_08-A-003_reload-back-to-general.png');
        await units();
      });

      await test.step('[08-C-033] read-only line "Mét vuông — ví dụ 248,60 m²"', async () => {
        await expect.soft(page.getByText('Mét vuông — ví dụ 248,60 m²', { exact: true })).toBeVisible();
        await captureEvidence(page, 'E03_08-C-033_area-unit-line.png');
      });

      await test.step('[08-C-019] snap 0 / 121 refused at the field, Escape restores, no PUT; 120 → PUT 120', async () => {
        const before = await snap.inputValue();
        const mark = log.length;
        await typeNumber(snap, '0');
        await expect.soft(page.getByText('Giá trị không nhỏ hơn 1 mm.', { exact: true })).toBeVisible(); // NF validate
        await typeNumber(snap, '121');
        await expect.soft(page.getByText('Giá trị không quá 120 mm.', { exact: true })).toBeVisible();
        await captureEvidence(page, 'E03_08-C-019_snap-refused.png');
        await snap.press('Escape');
        await expect.soft(snap).toHaveValue(before);
        await quiet(page);
        expect.soft(countSince(log, mark, 'PUT', settingsRe(pid)), 'refused values send no PUT').toBe(0);
        const put = waitForApi(page, 'PUT', settingsRe(pid), [200]);
        await typeNumber(snap, '120', true);
        expect.soft(sentSettingsBody(await put).snapToleranceMm).toBe(120);
      });

      await test.step('[08-C-020] snap 1 (min) → PUT 200 snapToleranceMm 1', async () => {
        const put = waitForApi(page, 'PUT', settingsRe(pid), [200]);
        await typeNumber(snap, '1', true);
        expect.soft(sentSettingsBody(await put).snapToleranceMm).toBe(1);
      });

      await test.step('[08-C-021] "2,5" → "Dung sai bắt điểm phải là số nguyên."; no PUT', async () => {
        const mark = log.length;
        await typeNumber(snap, '2,5', true);
        await expect.soft(page.getByText('Dung sai bắt điểm phải là số nguyên.', { exact: true })).toBeVisible(); // SE snapNotInteger
        await quiet(page);
        expect.soft(countSince(log, mark, 'PUT', settingsRe(pid))).toBe(0);
        await captureEvidence(page, 'E03_08-C-021_snap-not-integer.png');
        // NF already committed 2,5 (Escape would show it again): the fix is the saved value, which sends nothing.
        await typeNumber(snap, '1', true);
        await expect(page.getByText('Dung sai bắt điểm phải là số nguyên.', { exact: true })).toHaveCount(0);
      });

      await test.step('[08-C-022] cleared → "Chưa nhập dung sai bắt điểm."; no PUT', async () => {
        const mark = log.length;
        await typeNumber(snap, '', true);
        await expect.soft(page.getByText('Chưa nhập dung sai bắt điểm.', { exact: true })).toBeVisible();
        // Catalog fixed by QA-03e (hint dropped): Input.tsx:42,110-120 renders the hint only while the field has no error,
        // so the error replaces it and the field is not described by a hint.
        await expect.soft(snap).not.toHaveAttribute('aria-describedby', /-hint(\s|$)/u);
        await quiet(page);
        expect.soft(countSince(log, mark, 'PUT', settingsRe(pid))).toBe(0);
        await captureEvidence(page, 'E03_08-C-022_snap-empty.png');
        await typeNumber(snap, '1', true);
      });

      await test.step('[08-C-023] "abc" behaves as empty; "12abc" → PUT snapToleranceMm 12, no message', async () => {
        await typeNumber(snap, 'abc', true);
        await expect.soft(page.getByText('Chưa nhập dung sai bắt điểm.', { exact: true })).toBeVisible();
        const put = waitForApi(page, 'PUT', settingsRe(pid), [200]);
        await typeNumber(snap, '12abc', true);
        expect.soft(sentSettingsBody(await put).snapToleranceMm).toBe(12); // NUM parseFloat leniency
        await expect.soft(page.getByText('Chưa nhập dung sai bắt điểm.', { exact: true })).toHaveCount(0);
      });

      await test.step('[08-E-012] ArrowUp/Down ±1, Shift ±10, clamped 1..120; one PUT after the last key; Escape before commit reverts', async () => {
        const mark = log.length;
        const put = waitForApi(page, 'PUT', settingsRe(pid), [200]);
        await snap.focus();
        await snap.press('ArrowUp'); // 13
        await snap.press('Shift+ArrowUp'); // 23
        await snap.press('ArrowDown'); // 22
        await expect.soft(snap).toHaveValue('22');
        expect.soft(sentSettingsBody(await put).snapToleranceMm).toBe(22);
        await quiet(page);
        expect.soft(countSince(log, mark, 'PUT', settingsRe(pid)), 'one PUT for the key run').toBe(1);
        const markClamp = log.length;
        await typeNumber(snap, '119');
        await snap.press('Shift+ArrowUp');
        await expect.soft(snap, 'clamped to max 120').toHaveValue('120');
        await snap.press('Escape');
        await expect.soft(snap).toHaveValue('22');
        await typeNumber(snap, '5');
        await snap.press('Shift+ArrowDown');
        await expect.soft(snap, 'clamped to min 1').toHaveValue('1');
        await snap.press('Escape');
        await expect.soft(snap).toHaveValue('22');
        await quiet(page);
        expect.soft(countSince(log, markClamp, 'PUT', settingsRe(pid)), 'Escape before commit sends nothing').toBe(0);
      });

      await test.step('[08-C-024] "Ngưỡng tin cậy" shows "0,75" with hint "75%"; "75" → "Giá trị không quá 1."; Escape', async () => {
        await expect.soft(confidence).toHaveValue('0,75');
        await expect.soft(page.getByText(/^75\s?%$/u)).toBeVisible();
        await typeNumber(confidence, '75');
        await expect.soft(page.getByText('Giá trị không quá 1.', { exact: true })).toBeVisible();
        await captureEvidence(page, 'E03_08-C-024_confidence-75.png');
        await confidence.press('Escape');
        await expect.soft(confidence).toHaveValue('0,75');
      });

      await test.step('[08-C-025] "-0,1" → "Giá trị không nhỏ hơn 0."; 0 then 1 each → PUT 200', async () => {
        await typeNumber(confidence, '-0,1');
        await expect.soft(page.getByText('Giá trị không nhỏ hơn 0.', { exact: true })).toBeVisible();
        await confidence.press('Escape');
        for (const value of [0, 1]) {
          const put = waitForApi(page, 'PUT', settingsRe(pid), [200]);
          await typeNumber(confidence, String(value), true);
          expect.soft(sentSettingsBody(await put).confidenceThreshold).toBe(value);
        }
      });

      await test.step('[08-C-026] "Ngưỡng tin cậy" cleared + blur → box back to the previous value, no message, no PUT', async () => {
        const mark = log.length;
        await typeNumber(confidence, '', true);
        await expect.soft(confidence).toHaveValue('1');
        await quiet(page);
        expect.soft(countSince(log, mark, 'PUT', settingsRe(pid))).toBe(0);
        await expect.soft(screenAlerts(page)).toHaveCount(0);
      });

      await test.step('[08-C-027] "0,7555" → one PUT; server 0.756 adopted, hint "76%"; no second PUT', async () => {
        const mark = log.length;
        const put = waitForApi(page, 'PUT', settingsRe(pid), [200]);
        await typeNumber(confidence, '0,7555', true);
        const result = await put;
        expect.soft(sentSettingsBody(result).confidenceThreshold).toBe(0.7555);
        expect.soft(asRecord(result.json, 'PUT answer').confidenceThreshold, 'BE rounds HALF_UP to 3 places').toBe(0.756);
        await expect.soft(page.getByText(/^76\s?%$/u)).toBeVisible();
        await quiet(page);
        expect.soft(countSince(log, mark, 'PUT', settingsRe(pid)), 'no second PUT').toBe(1);
        await captureEvidence(page, 'E03_08-C-027_confidence-rounded.png');
      });

      await test.step('[08-C-028] "Tỉ lệ bản vẽ" "0,005" / "1000,5" refused; 0,01 and 1000 save', async () => {
        await typeNumber(scale, '0,005');
        await expect.soft(page.getByText('Giá trị không nhỏ hơn 0,01.', { exact: true })).toBeVisible();
        await typeNumber(scale, '1000,5');
        await expect.soft(page.getByText('Giá trị không quá 1.000.', { exact: true })).toBeVisible();
        await captureEvidence(page, 'E03_08-C-028_scale-refused.png');
        await scale.press('Escape');
        for (const [typed, sent] of [['0,01', 0.01], ['1000', 1000]] as const) {
          const put = waitForApi(page, 'PUT', settingsRe(pid), [200]);
          await typeNumber(scale, typed, true);
          expect.soft(sentSettingsBody(await put).defaultScaleMmPerPx).toBe(sent);
        }
      });

      await test.step('[08-C-029] "2.5" and "2,5" both send 2.5; "2.500" reads as 2500 → "Giá trị không quá 1.000."', async () => {
        for (const typed of ['2.5', '3', '2,5']) {
          const put = waitForApi(page, 'PUT', settingsRe(pid), [200]);
          await typeNumber(scale, typed, true);
          expect.soft(sentSettingsBody(await put).defaultScaleMmPerPx, `"${typed}"`).toBe(typed === '3' ? 3 : 2.5);
        }
        await typeNumber(scale, '2.500');
        await expect.soft(page.getByText('Giá trị không quá 1.000.', { exact: true })).toBeVisible(); // NUM THOUSANDS_GROUPED
        await scale.press('Escape');
      });

      await test.step('[08-C-030] cleared → "Chưa nhập tỉ lệ bản vẽ." + "Chưa nói được quãng thật vì tỉ lệ chưa hợp lệ."; no PUT', async () => {
        const mark = log.length;
        await typeNumber(scale, '', true);
        await expect.soft(page.getByText('Chưa nhập tỉ lệ bản vẽ.', { exact: true })).toBeVisible();
        await expect.soft(page.getByText('Chưa nói được quãng thật vì tỉ lệ chưa hợp lệ.', { exact: true })).toBeVisible();
        await quiet(page);
        expect.soft(countSince(log, mark, 'PUT', settingsRe(pid))).toBe(0);
        await captureEvidence(page, 'E03_08-C-030_scale-empty.png');
        await typeNumber(scale, '2,5', true); // the saved value back: nothing to send
      });

      await test.step('[08-C-031] 2,5 saved → hint "2,5 milimét trên mỗi điểm ảnh" + "100 điểm ảnh ứng với 250 mm ngoài thực tế."', async () => {
        await expect.soft(page.getByText('2,5 milimét trên mỗi điểm ảnh', { exact: true })).toBeVisible();
        await expect.soft(page.getByText('100 điểm ảnh ứng với 250 mm ngoài thực tế.', { exact: true })).toBeVisible();
        await captureEvidence(page, 'E03_08-C-031_scale-preview.png');
      });
    });
  });

  test('SCR-08 · FL-08-04 · settings changed elsewhere: 409 strip, partial save, reload dialog, rename elsewhere', async ({ browser }) => {
    test.setTimeout(160_000);
    await withSession(browser, async (s) => {
      const { page, log, api } = s;
      const project = await seed(s, '08-b-009');
      const pid = project.projectId;
      const notes = field(page, NOTES_LABEL);
      const name = field(page, NAME_LABEL);
      const apiNotes = `qa api ${uniq()}`;

      await test.step('[08-B-009] API PUT, then edit "Ghi chú" → PUT 409; conflict strip + sentence + "Tải lại"; no "Chưa lưu hết"', async () => {
        await openSettings(page, project);
        await putSettingsElsewhere(api, pid, apiNotes);
        const conflict = waitForApi(page, 'PUT', settingsRe(pid), [409]);
        await notes.fill(`qa ui ${uniq()}`);
        await conflict;
        await expect(conflictStrip(page)).toContainText(CONFLICT_SENTENCE);
        await expect(conflictStrip(page).getByRole('button', { name: RELOAD, exact: true })).toBeVisible();
        await expect(failureBox(page)).toHaveCount(0);
        await captureEvidence(page, 'E03_08-B-009_conflict-strip.png');
      });

      await test.step('[08-B-010] chip "Chưa lưu: cần tải lại bản mới nhất"', async () => {
        await expect.soft(saveChip(page)).toHaveText(CHIP_RELOAD);
        await captureEvidence(page, 'E03_08-B-010_chip-reload.png');
      });

      await test.step('[08-B-012] edit only "Tên dự án" → PATCH 200; no PUT re-sends the held notes', async () => {
        const mark = log.length;
        const patch = waitForApi(page, 'PATCH', projectRe(pid), [200]);
        await name.fill(`${project.name}-b`.slice(-80));
        await patch;
        await quiet(page);
        expect(countSince(log, mark, 'PUT', settingsRe(pid)), 'R2: the 409 notes are not re-sent').toBe(0);
      });

      await test.step('[08-B-013] edit "Ghi chú" again → exactly one new PUT (409), no retry loop', async () => {
        const mark = log.length;
        const conflict = waitForApi(page, 'PUT', settingsRe(pid), [409]);
        await notes.fill(`qa ui again ${uniq()}`);
        await conflict;
        await quiet(page);
        await quiet(page);
        expect.soft(countSince(log, mark, 'PUT', settingsRe(pid)), 'one PUT, no retry loop').toBe(1);
      });

      await test.step('[08-B-011] name + notes in one window → PATCH 200 + PUT 409: strip AND "Chưa lưu hết" "Đã lưu tên dự án, chưa lưu ghi chú."', async () => {
        const patch = waitForApi(page, 'PATCH', projectRe(pid), [200]);
        const conflict = waitForApi(page, 'PUT', settingsRe(pid), [409]);
        await setValues(page, [
          [NAME_LABEL, `${project.name}-c`.slice(-80)],
          [NOTES_LABEL, `qa pair ${uniq()}`],
        ]);
        await Promise.all([patch, conflict]);
        await expect.soft(conflictStrip(page)).toBeVisible();
        await expect.soft(failureBox(page)).toContainText('Đã lưu tên dự án, chưa lưu ghi chú.');
        await captureEvidence(page, 'E03_08-B-011_strip-and-partial-box.png');
      });

      const stripReload = conflictStrip(page).getByRole('button', { name: RELOAD, exact: true });
      await test.step('[08-E-014] both strips are role=alert; Tab reaches the strip\'s "Tải lại"', async () => {
        await expect.soft(page.getByRole('alert').filter({ hasText: CONFLICT_TITLE })).toHaveCount(1);
        await expect.soft(page.getByRole('alert').filter({ hasText: SAVE_FAILURE_TITLE })).toHaveCount(1);
        await page.getByRole('heading', { name: 'Đặt thông tin, đơn vị đo và thành viên của dự án', exact: true }).click();
        expect.soft(await tabTo(page, stripReload, 10), 'Tab reaches "Tải lại"').toBe(true);
      });

      const dialog = page.getByRole('dialog', { name: RELOAD_DIALOG, exact: true });
      await test.step('[08-E-008] "Tải lại" → dialog: focus inside; Esc = "Giữ thay đổi"; focus back on the strip\'s "Tải lại"', async () => {
        if (await isFocused(stripReload)) await page.keyboard.press('Enter');
        else await stripReload.click();
        await expect(dialog).toBeVisible();
        await expect.poll(() => dialog.evaluate((el) => el.contains(document.activeElement)), { message: 'focus moved into the dialog' }).toBe(true);
        await captureEvidence(page, 'E03_08-E-008_reload-dialog.png');
        await page.keyboard.press('Escape');
        await expect(dialog).toHaveCount(0);
        await expect.soft(stripReload).toBeFocused();
      });

      await test.step('[08-B-014] dialog body; "Giữ thay đổi" keeps the draft; "Tải lại" refetches: server notes shown, strip gone', async () => {
        const draft = await notes.inputValue();
        await stripReload.click();
        await expect(dialog).toContainText(RELOAD_DIALOG_BODY);
        await dialog.getByRole('button', { name: KEEP_CHANGES, exact: true }).click();
        await expect(dialog).toHaveCount(0);
        await expect(notes).toHaveValue(draft);
        await stripReload.click();
        const refetch = waitForApi(page, 'GET', settingsRe(pid), [200]);
        await dialog.getByRole('button', { name: RELOAD, exact: true }).click();
        await refetch;
        await expect(notes).toHaveValue(apiNotes);
        await expect(conflictStrip(page)).toHaveCount(0);
        await captureEvidence(page, 'E03_08-B-014_reloaded-server-copy.png');
      });

      await test.step('[08-B-015] API PUT again, edit → 409; type the saved notes back; "Tải lại" reloads at once, no dialog', async () => {
        const second = `qa api 2 ${uniq()}`;
        await putSettingsElsewhere(api, pid, second);
        const conflict = waitForApi(page, 'PUT', settingsRe(pid), [409]);
        await notes.fill(`qa ui 3 ${uniq()}`);
        await conflict;
        await notes.fill(apiNotes); // = the saved copy: no unsaved diff
        const refetch = waitForApi(page, 'GET', settingsRe(pid), [200]);
        await stripReload.click();
        await expect.soft(dialog).toHaveCount(0);
        await refetch;
        await expect.soft(notes).toHaveValue(second);
        await expect.soft(conflictStrip(page)).toHaveCount(0);
      });

      await test.step('[08-B-025] API PATCH name elsewhere → no strip; the field keeps the old name until a page reload', async () => {
        const shown = await name.inputValue();
        const elsewhere = `${TEST_DATA_PREFIX}08-b-025-${uniq()}`;
        const patched = await api.patch(`${PROJECTS_API}/${pid}`, { data: { name: elsewhere } });
        expect(patched.status(), 'API PATCH name (the other writer)').toBe(200);
        await quiet(page);
        await expect.soft(conflictStrip(page)).toHaveCount(0);
        await expect.soft(name).toHaveValue(shown);
        await captureEvidence(page, 'E03_08-B-025_old-name-kept.png');
        await page.reload();
        await expect.soft(name).toHaveValue(elsewhere);
      });
    });
  });

  test('SCR-08 · FL-08-05 · admin manages members: refusals, add, undo, role badges, remove others, leave the project', async ({ browser }) => {
    test.setTimeout(200_000);
    await withSession(browser, async (s) => {
      const { page, log, api } = s;
      // Plan: "fresh admin (pool)". Deviation: the env admin is the actor (no extra admin invitation, users_invite is
      // near its 30 / h cap); a second viewer is replaced by re-adding the same viewer (one pool viewer, one invite less).
      const engineer: PoolUser = await poolUser(api, 'engineer', POOL_SLOT);
      const viewer: PoolUser = await poolUser(api, 'viewer', POOL_SLOT);
      const project = await seed(s, '08-a-016');
      const pid = project.projectId;
      const self = (await readMembers(api, pid))[0];
      if (self === undefined) throw new Error('setup: the creator is not listed as a member');
      let selfRemoved = false;

      try {
        const email = field(page, MEMBER.email);
        const add = page.getByRole('button', { name: MEMBER.add, exact: true });
        const removeButton = (name: string): Locator => page.getByRole('button', { name: `Gỡ ${name}`, exact: true });
        const removeDialog = (name: string): Locator => page.getByRole('dialog', { name: `Gỡ ${name} khỏi dự án?`, exact: true });
        const membersTab = async (): Promise<void> => {
          await tab(page, TAB.members).click();
          await expect(email).toBeVisible();
        };

        await test.step('[08-B-027] "Thành viên": "1 thành viên", row with initials avatar, name, badge "Quản trị"', async () => {
          await openSettings(page, { projectId: pid, name: project.name });
          await membersTab();
          await expect(page.getByText('1 thành viên', { exact: true })).toBeVisible();
          const row = page.getByRole('listitem').filter({ hasText: self.name });
          await expect(row).toBeVisible();
          await expect(row.getByText(ROLE_BADGE.admin, { exact: true })).toBeVisible();
          await expect.soft(row.getByLabel(self.name, { exact: true }).first()).toHaveText(initialsOf(self.name, self.email));
          await captureEvidence(page, 'E03_08-B-027_one-member.png');
        });

        await test.step('[08-A-020] "Gỡ {self}" → dialog; Esc closes; reopen, "Để nguyên" closes; no DELETE', async () => {
          const mark = log.length;
          await removeButton(self.name).click();
          await expect(removeDialog(self.name)).toContainText(MEMBER.selfMessage);
          await page.keyboard.press('Escape');
          await expect.soft(removeDialog(self.name)).toHaveCount(0);
          await removeButton(self.name).click();
          await removeDialog(self.name).getByRole('button', { name: MEMBER.keep, exact: true }).click();
          await expect.soft(removeDialog(self.name)).toHaveCount(0);
          expect.soft(countSince(log, mark, 'DELETE', memberRe(pid)), 'cancel sends nothing').toBe(0);
        });

        await test.step('[08-B-037] "Gỡ" self as the only editor → DELETE 422; alert inside the dialog; dialog stays; "Để nguyên"', async () => {
          await removeButton(self.name).click();
          const del = waitForApi(page, 'DELETE', memberRe(pid), [422]);
          await removeDialog(self.name).getByRole('button', { name: MEMBER.remove, exact: true }).click();
          await del; // BE project_members MEMBER_LAST_EDITOR
          await expect.soft(removeDialog(self.name).getByRole('alert')).toHaveText(MEMBER.lastEditor);
          await expect.soft(removeDialog(self.name)).toBeVisible();
          await captureEvidence(page, 'E03_08-B-037_last-editor-422.png');
          await removeDialog(self.name).getByRole('button', { name: MEMBER.keep, exact: true }).click();
          await expect(removeDialog(self.name)).toHaveCount(0);
        });

        await test.step('[08-C-034] "Thêm thành viên" with an empty email → "Chưa nhập địa chỉ email."; no request', async () => {
          const mark = log.length;
          await add.click();
          await expect.soft(page.getByText(MEMBER.required, { exact: true })).toBeVisible();
          expect.soft(countSince(log, mark, 'POST', membersRe(pid))).toBe(0);
          await captureEvidence(page, 'E03_08-C-034_email-required.png');
        });

        await test.step('[08-C-038] typing in "Email người cần thêm" clears the error line', async () => {
          await email.fill('a');
          await expect.soft(page.getByText(MEMBER.required, { exact: true })).toHaveCount(0);
        });

        await test.step('[08-C-035] "abc" → native validation blocks the submit (typeMismatch), no POST, no Vietnamese sentence', async () => {
          const mark = log.length;
          await email.fill('abc');
          await add.click();
          expect.soft(await email.evaluate((el) => (el as HTMLInputElement).validity.typeMismatch), 'validity.typeMismatch').toBe(true);
          await quiet(page);
          expect.soft(countSince(log, mark, 'POST', membersRe(pid))).toBe(0);
          await expect.soft(page.getByRole('tabpanel').getByRole('alert')).toHaveCount(0);
          await captureEvidence(page, 'E03_08-C-035_native-email-check.png');
        });

        await test.step('[08-C-036] "a@b" → POST 422 field email → "Địa chỉ email chưa đúng."', async () => {
          const post = waitForApi(page, 'POST', membersRe(pid), [422]);
          await email.fill('a@b');
          await add.click();
          const { json } = await post;
          expect.soft(asRecord(json, '422').field).toBe('email');
          await expect.soft(page.getByText(MEMBER.badEmail, { exact: true })).toBeVisible();
          await captureEvidence(page, 'E03_08-C-036_email-422.png');
        });

        await test.step('[08-E-011] own email upper-case + Enter submits like the button; the error under the input is role=alert', async () => {
          await email.fill(readAdminCredentials().email.toUpperCase());
          await email.press('Enter');
          await expect.soft(page.getByRole('alert').filter({ hasText: MEMBER.already })).toBeVisible();
        });

        await test.step('[08-B-032] that error reads "Người này đã là thành viên."; no POST (the gateway reads first)', async () => {
          await expect.soft(page.getByText(MEMBER.already, { exact: true })).toBeVisible();
          // The POST count since C-036's 422: only that one.
          expect.soft(log.filter((e) => e.method === 'POST' && membersRe(pid).test(e.path)).length, 'no POST for an existing member').toBe(1);
          await captureEvidence(page, 'E03_08-B-032_already-member.png');
        });

        await test.step('[08-B-031] unknown address → POST 422 → "Không thêm được: … chưa có tài khoản đang hoạt động."; still "1 thành viên"', async () => {
          const post = waitForApi(page, 'POST', membersRe(pid), [422]);
          await email.fill(testEmail('p1-08-b-031-nobody'));
          await add.click();
          await post;
          await expect.soft(page.getByText(MEMBER.unavailable, { exact: true })).toBeVisible();
          await expect.soft(page.getByText('1 thành viên', { exact: true })).toBeVisible();
          await captureEvidence(page, 'E03_08-B-031_no-account.png');
        });

        let engineerName = engineer.name;
        await test.step('[08-C-037] "  ENGINEER@…  " → POST body email trimmed + lower-cased, Idempotency-Key header', async () => {
          const sent = page.waitForRequest((req) => req.method() === 'POST' && membersRe(pid).test(new URL(req.url()).pathname));
          const post = waitForApi(page, 'POST', membersRe(pid), [200, 201]);
          await email.fill(`  ${engineer.email.toUpperCase()}  `);
          await add.click();
          const req = await sent;
          expect(asRecord(req.postDataJSON() as unknown, 'POST members').email).toBe(engineer.email.toLowerCase());
          expect(req.headers()['idempotency-key'] ?? '', 'Idempotency-Key header').not.toBe('');
          engineerName = String(asRecord((await post).json, 'POST members answer').name);
        });

        await test.step('[08-A-016] POST 201; box cleared; "2 thành viên"; toast "Đã thêm {name}; hoàn tác sẽ gỡ người này, …"', async () => {
          await expect(email).toHaveValue('');
          await expect(page.getByText('2 thành viên', { exact: true })).toBeVisible();
          await expect(toastWith(page, `Đã thêm ${engineerName}; hoàn tác sẽ gỡ người này, thông báo mời đã gửi không thu hồi được.`).first()).toBeVisible();
          await captureEvidence(page, 'E03_08-A-016_member-added.png');
        });

        await test.step('[08-A-017] toast "Hoàn tác" → DELETE /projects/:id/members/:uid; engineer gone, "1 thành viên"', async () => {
          const del = waitForApi(page, 'DELETE', memberRe(pid), [200, 204]);
          await toastWith(page, `Đã thêm ${engineerName}`).first().getByRole('button', { name: UNDO, exact: true }).click();
          await del;
          await expect(page.getByText('1 thành viên', { exact: true })).toBeVisible();
          await expect(removeButton(engineerName)).toHaveCount(0);
          await captureEvidence(page, 'E03_08-A-017_member-undo.png');
        });

        let viewerName = viewer.name;
        await test.step('[08-B-028] re-add the engineer by the form, a viewer by API, reload → badges "Quản trị" / "Kỹ sư" / "Người xem"', async () => {
          const post = waitForApi(page, 'POST', membersRe(pid), [200, 201]);
          await email.fill(engineer.email);
          await add.click();
          await post;
          await expect(page.getByText('2 thành viên', { exact: true })).toBeVisible();
          const added = await api.post(`${PROJECTS_API}/${pid}/members`, { data: { email: viewer.email } });
          expect(added.status(), 'API add the viewer').toBe(201);
          viewerName = String(asRecord(await added.json(), 'POST members').name);
          await page.reload();
          await expect(field(page, NAME_LABEL)).toBeVisible();
          await membersTab();
          await expect(page.getByText('3 thành viên', { exact: true })).toBeVisible();
          for (const [who, badge] of [
            [self.name, ROLE_BADGE.admin],
            [engineerName, ROLE_BADGE.engineer],
            [viewerName, ROLE_BADGE.viewer],
          ] as const) {
            await expect(page.getByRole('listitem').filter({ hasText: who }).getByText(badge, { exact: true })).toBeVisible();
          }
          await captureEvidence(page, 'E03_08-B-028_role-badges.png');
        });

        await test.step('[08-E-010] every row has its own unique "Gỡ {name}" label', async () => {
          const labels = await page.getByRole('listitem').getByRole('button').evaluateAll((nodes) => nodes.map((n) => n.getAttribute('aria-label') ?? ''));
          expect.soft(labels.sort()).toEqual([`Gỡ ${self.name}`, `Gỡ ${engineerName}`, `Gỡ ${viewerName}`].sort());
          expect.soft(new Set(labels).size).toBe(labels.length);
        });

        await test.step('[08-E-009] "Gỡ {viewer}": focus inside, Tab trapped, Esc closes, focus back on "Gỡ {viewer}"', async () => {
          await removeButton(viewerName).click();
          const dialog = removeDialog(viewerName);
          await expect(dialog).toBeVisible();
          await expect.poll(() => dialog.evaluate((el) => el.contains(document.activeElement)), { message: 'focus inside' }).toBe(true);
          for (let i = 0; i < 4; i += 1) {
            await page.keyboard.press('Tab');
            expect.soft(await dialog.evaluate((el) => el.contains(document.activeElement)), `Tab ${String(i + 1)} stays inside`).toBe(true);
          }
          await page.keyboard.press('Escape');
          await expect(dialog).toHaveCount(0);
          await expect.soft(removeButton(viewerName)).toBeFocused();
        });

        await test.step('[08-A-018] "Gỡ {viewer}" → dialog copy → "Gỡ" → DELETE; toast "Đã gỡ {name} khỏi dự án."; list shrinks', async () => {
          await removeButton(viewerName).click();
          const dialog = removeDialog(viewerName);
          await expect(dialog).toContainText(MEMBER.otherMessage);
          const del = waitForApi(page, 'DELETE', memberRe(pid), [200, 204]);
          await dialog.getByRole('button', { name: MEMBER.remove, exact: true }).click();
          await del;
          await expect(toastWith(page, `Đã gỡ ${viewerName} khỏi dự án.`).first()).toBeVisible();
          await expect(page.getByText('2 thành viên', { exact: true })).toBeVisible();
          await captureEvidence(page, 'E03_08-A-018_member-removed.png');
        });

        await test.step('[08-B-038] open "Gỡ {viewer}", API removes the viewer, confirm → 404 taken as success: dialog closes, toast', async () => {
          const added = await api.post(`${PROJECTS_API}/${pid}/members`, { data: { email: viewer.email } });
          expect(added.status(), 'API re-add the viewer').toBe(201);
          await page.reload();
          await expect(field(page, NAME_LABEL)).toBeVisible();
          await membersTab();
          await removeButton(viewerName).click();
          const viewerId = String(asRecord(await added.json(), 'POST members').id);
          const gone = await api.delete(`${PROJECTS_API}/${pid}/members/${viewerId}`);
          expect(gone.status(), 'API removes the viewer first').toBe(200);
          const del = waitForApi(page, 'DELETE', memberRe(pid), [404]);
          await removeDialog(viewerName).getByRole('button', { name: MEMBER.remove, exact: true }).click();
          await del;
          await expect.soft(removeDialog(viewerName)).toHaveCount(0);
          await expect.soft(toastWith(page, `Đã gỡ ${viewerName} khỏi dự án.`).first()).toBeVisible();
          await captureEvidence(page, 'E03_08-B-038_already-gone.png');
        });

        await test.step('[08-A-019] "Gỡ {self}" with the engineer still editing → self copy; DELETE 200; lands on "/" with no toast', async () => {
          await removeButton(self.name).click();
          const dialog = removeDialog(self.name);
          await expect(dialog).toContainText(MEMBER.selfMessage);
          const del = waitForApi(page, 'DELETE', memberRe(pid), [200, 204]);
          await dialog.getByRole('button', { name: MEMBER.remove, exact: true }).click();
          await del;
          selfRemoved = true;
          await expect.poll(() => pathOf(page)).toBe(ROUTES.dashboard);
          await expect.soft(toastWith(page, 'Đã gỡ')).toHaveCount(0);
          await captureEvidence(page, 'E03_08-A-019_left-project.png');
        });
      } finally {
        if (selfRemoved) {
          // The admin is no member any more (BE require_project: 404 for a non-member): the engineer deletes it.
          const engApi = await signedInApi(engineer.email, engineer.password);
          await deleteSeededProject(engApi, pid);
          await engApi.dispose();
        }
      }
    });
  });

  test('SCR-08 · FL-08-06 · admin clears all floors, then deletes the project from "Vùng nguy hiểm"', async ({ browser }) => {
    await withSession(browser, async (s) => {
      const { page, log } = s;
      const project = await seed(s, '08-a-025', 2);
      const pid = project.projectId;
      const panel = page.getByRole('region', { name: TAB.danger });
      const floorsDialog = page.getByRole('dialog', { name: DANGER.deleteFloorsTitle, exact: true });
      const projectDialog = page.getByRole('dialog', { name: DANGER.deleteProjectTitle, exact: true });
      const openProjectDialog = panel.getByRole('button', { name: DANGER.deleteProject, exact: true });
      const typed = projectDialog.getByRole('textbox', { name: DANGER.typeName, exact: true });
      const confirm = projectDialog.getByRole('button', { name: DANGER.deleteProject, exact: true });
      let savedName = project.name;

      await test.step('[08-B-042] "Vùng nguy hiểm" reads "Xoá toàn bộ 2 tầng cùng bản vẽ và mô hình của chúng. Không hoàn tác được."', async () => {
        await openSettings(page, project);
        await tab(page, TAB.danger).click();
        await expect(panel).toContainText('Xoá toàn bộ 2 tầng cùng bản vẽ và mô hình của chúng. Không hoàn tác được.');
        await captureEvidence(page, 'E03_08-B-042_danger-two-floors.png');
      });

      await test.step('[08-A-026] "Xoá mọi tầng" → dialog; Esc closes; reopen, "Để nguyên" closes; no DELETE floor', async () => {
        const mark = log.length;
        await panel.getByRole('button', { name: DANGER.deleteFloors, exact: true }).click();
        await expect(floorsDialog).toBeVisible();
        await page.keyboard.press('Escape');
        await expect.soft(floorsDialog).toHaveCount(0);
        await panel.getByRole('button', { name: DANGER.deleteFloors, exact: true }).click();
        await floorsDialog.getByRole('button', { name: DANGER.keep, exact: true }).click();
        await expect.soft(floorsDialog).toHaveCount(0);
        expect.soft(countSince(log, mark, 'DELETE', floorDeleteRe)).toBe(0);
      });

      await test.step('[08-A-025] confirm (no typed name) → DELETE ×2 floors; toast "Đã xoá 2 tầng của dự án."', async () => {
        const mark = log.length;
        await panel.getByRole('button', { name: DANGER.deleteFloors, exact: true }).click();
        await expect(floorsDialog.getByRole('textbox')).toHaveCount(0);
        await floorsDialog.getByRole('button', { name: DANGER.deleteFloors, exact: true }).click();
        await expect.poll(() => countSince(log, mark, 'DELETE', floorDeleteRe)).toBe(2);
        await expect(toastWith(page, 'Đã xoá 2 tầng của dự án.').first()).toBeVisible();
        await captureEvidence(page, 'E03_08-A-025_floors-deleted.png');
      });

      await test.step('[08-B-041] EmptyState "Chưa có tầng nào" + its sentence; only the "Xoá dự án" row', async () => {
        await expect.soft(panel.getByText(DANGER.noFloorsTitle, { exact: true })).toBeVisible();
        await expect.soft(panel.getByText(DANGER.noFloorsDescription, { exact: true })).toBeVisible();
        await expect.soft(panel.getByRole('button', { name: DANGER.deleteFloors, exact: true })).toHaveCount(0);
        await expect.soft(openProjectDialog).toBeVisible();
        await captureEvidence(page, 'E03_08-B-041_danger-no-floor.png');
      });

      await test.step('[08-A-024] name edited, "Xoá dự án" opened before the autosave lands → the hint shows the SAVED name', async () => {
        const draft = `${TEST_DATA_PREFIX}08-a-024-${uniq()}`;
        // Hold the PATCH (a delay, not a mock) so "before the autosave lands" does not depend on speed.
        const hold = await holdFirst(page, (url, method) => method === 'PATCH' && projectRe(pid).test(url.pathname));
        const patch = waitForApi(page, 'PATCH', projectRe(pid), [200]);
        try {
          await tab(page, TAB.general).click();
          await field(page, NAME_LABEL).fill(draft);
          await tab(page, TAB.danger).click();
          await openProjectDialog.click();
          await expect.soft(projectDialog.getByText(savedName, { exact: true })).toBeVisible(); // PS Input hint
          await expect.soft(projectDialog.getByText(draft, { exact: true })).toHaveCount(0);
          await captureEvidence(page, 'E03_08-A-024_hint-saved-name.png');
          await projectDialog.getByRole('button', { name: DANGER.keep, exact: true }).click();
        } finally {
          await hold.release();
        }
        await patch;
        savedName = draft;
      });

      await test.step('[08-E-006] dialog role=dialog aria-modal "Xoá dự án này?"; focus inside; Tab cycles; Esc closes; focus back on "Xoá dự án"', async () => {
        await openProjectDialog.click();
        await expect(projectDialog).toHaveAttribute('aria-modal', 'true');
        await expect.poll(() => projectDialog.evaluate((el) => el.contains(document.activeElement)), { message: 'focus inside' }).toBe(true);
        for (let i = 0; i < 5; i += 1) {
          await page.keyboard.press('Tab');
          expect.soft(await projectDialog.evaluate((el) => el.contains(document.activeElement)), `Tab ${String(i + 1)} stays inside`).toBe(true);
        }
        await page.keyboard.press('Escape');
        await expect(projectDialog).toHaveCount(0);
        await expect.soft(openProjectDialog).toBeFocused();
      });

      await test.step('[08-A-023] the name typed in another letter case → confirm stays disabled', async () => {
        await openProjectDialog.click();
        await typed.fill(savedName.toUpperCase());
        await expect.soft(confirm).toBeDisabled();
      });

      await test.step('[08-A-022] the name with leading / trailing spaces → confirm enabled; then "Để nguyên"', async () => {
        await typed.fill(`  ${savedName}  `);
        await expect.soft(confirm).toBeEnabled();
        await projectDialog.getByRole('button', { name: DANGER.keep, exact: true }).click();
        await expect(projectDialog).toHaveCount(0);
      });

      await test.step('[08-A-027] reopened → the typed confirmation box is empty', async () => {
        await openProjectDialog.click();
        await expect.soft(typed).toHaveValue('');
      });

      await test.step('[08-A-021] wrong name keeps confirm disabled; exact name → DELETE /projects/:id → "/" + "Đã xoá dự án."; card gone', async () => {
        await typed.fill(`${savedName}x`);
        await expect(confirm).toBeDisabled();
        await typed.fill(savedName);
        await expect(confirm).toBeEnabled();
        const del = waitForApi(page, 'DELETE', projectRe(pid), [200, 204]);
        await confirm.click();
        await del;
        await expect.poll(() => pathOf(page)).toBe(ROUTES.dashboard);
        await expect(toastWith(page, DANGER.deletedNotice).first()).toBeVisible();
        const list = page.getByRole('list', { name: 'Danh sách dự án', exact: true });
        await expect(list.getByRole('listitem').first().or(page.getByText('Chưa có dự án nào', { exact: true }))).toBeVisible();
        await expect(list.getByRole('listitem', { name: savedName, exact: true })).toHaveCount(0);
        await captureEvidence(page, 'E03_08-A-021_project-deleted.png');
      });
    });
  });

  test('SCR-08 · FL-08-07 · project deleted elsewhere: both danger actions fail inside their dialog', async ({ browser }) => {
    await withSession(browser, async (s) => {
      const { page, log, api } = s;
      const project = await seed(s, '08-b-044', 1);
      const pid = project.projectId;
      const panel = page.getByRole('region', { name: TAB.danger });
      const projectDialog = page.getByRole('dialog', { name: DANGER.deleteProjectTitle, exact: true });

      await openSettings(page, project);
      await tab(page, TAB.danger).click();
      await expect(panel).toBeVisible();
      const gone = await api.delete(`${PROJECTS_API}/${pid}`);
      expect(gone.status(), 'the other writer deletes the project').toBe(200);

      await test.step('[08-B-047] "Xoá mọi tầng" confirm → GET project 404 → the 404 sentence in the dialog; no DELETE floor', async () => {
        const mark = log.length;
        await panel.getByRole('button', { name: DANGER.deleteFloors, exact: true }).click();
        const dialog = page.getByRole('dialog', { name: DANGER.deleteFloorsTitle, exact: true });
        const read = waitForApi(page, 'GET', projectRe(pid), [404]);
        await dialog.getByRole('button', { name: DANGER.deleteFloors, exact: true }).click();
        await read; // PSG deleteAllFloors reads #24 first
        await expect(dialog).toContainText(GENERIC_NOT_FOUND);
        expect(countSince(log, mark, 'DELETE', floorDeleteRe)).toBe(0);
        await captureEvidence(page, 'E03_08-B-047_floors-404.png');
        await dialog.getByRole('button', { name: DANGER.keep, exact: true }).click();
        await expect(dialog).toHaveCount(0);
      });

      await test.step('[08-B-044] "Xoá dự án" exact name → DELETE 404 → the same sentence; dialog stays, confirm usable, URL unchanged', async () => {
        await panel.getByRole('button', { name: DANGER.deleteProject, exact: true }).click();
        await projectDialog.getByRole('textbox', { name: DANGER.typeName, exact: true }).fill(project.name);
        const del = waitForApi(page, 'DELETE', projectRe(pid), [404]);
        await projectDialog.getByRole('button', { name: DANGER.deleteProject, exact: true }).click();
        await del;
        await expect(projectDialog).toContainText(GENERIC_NOT_FOUND);
        await expect(projectDialog.getByRole('button', { name: DANGER.deleteProject, exact: true })).toBeEnabled();
        expect(pathOf(page)).toBe(ROUTES.project.settings(pid));
        await captureEvidence(page, 'E03_08-B-044_project-404.png');
      });

      // QA-03e (BUG-511, FIX-2205): the failure goes to dangerDialogError, shown as an InlineAlert (role="alert") under the
      // consequence sentence, which stays in its <p> (useProjectSettings.ts:1417, ProjectSettings.tsx:161-162).
      await test.step('[08-E-007] the failure sentence is announced (inside role=alert) under the kept consequence sentence', async () => {
        const announced = await projectDialog.getByText(GENERIC_NOT_FOUND, { exact: true }).evaluate((el) =>
          Boolean(el.closest('[role="alert"], [role="status"], [aria-live]:not([aria-live="off"])')),
        );
        expect.soft(announced, 'the failure sentence sits in a live region').toBe(true);
      });
    });
  });

  test('SCR-08 · FL-08-08 · leaving the screen mid-edit (Back flushes, reload drops) and an unknown project link', async ({ browser }) => {
    await withSession(browser, async (s) => {
      const { page } = s;
      const project = await seed(s, '08-a-005');
      const pid = project.projectId;
      const notes = field(page, NOTES_LABEL);
      const puts: string[] = [];
      page.on('request', (req) => {
        if (req.method() === 'PUT' && settingsRe(pid).test(new URL(req.url()).pathname)) puts.push(String(req.postData()));
      });
      const flushed = `qa back ${uniq()}`;

      await test.step('[08-A-005] "/" then settings in-app; type "Ghi chú", Back within 800 ms → exactly one PUT still sent after leaving', async () => {
        await page.goto(ROUTES.dashboard);
        await expect(page.getByRole('heading', { level: 1 })).toBeVisible();
        // No screen links to settings, so enter it in-app: a history push the router follows (popstate), not a page load.
        await page.evaluate((path) => {
          history.pushState({}, '', path);
          dispatchEvent(new PopStateEvent('popstate', { state: {} }));
        }, ROUTES.project.settings(pid));
        await expect(field(page, NAME_LABEL)).toHaveValue(project.name);
        await setValues(page, [[NOTES_LABEL, flushed]], 'back');
        await expect.poll(() => pathOf(page)).toBe(ROUTES.dashboard);
        await expect.poll(() => puts.length, { message: 'the R13 flush PUT after leaving' }).toBe(1);
        await quiet(page);
        expect(puts.length, 'exactly one PUT').toBe(1);
        expect(asRecord(asRecord(JSON.parse(puts[0] ?? '{}') as unknown, 'PUT').body, 'PUT body').notes).toBe(flushed);
        await attachJson('E03_08-A-005_flush-on-back.json', { puts: puts.length });
      });

      await test.step('[08-A-006] reopen; type "Ghi chú", reload within 800 ms → no PUT; the field shows the last saved notes', async () => {
        await openSettings(page, project);
        await expect(notes).toHaveValue(flushed);
        const before = puts.length;
        await setValues(page, [[NOTES_LABEL, `qa lost ${uniq()}`]], 'reload');
        await expect(field(page, NAME_LABEL)).toHaveValue(project.name);
        await quiet(page);
        expect.soft(puts.length - before, 'a reload drops the pending edit (no beforeunload flush)').toBe(0);
        await expect.soft(notes).toHaveValue(flushed);
        await captureEvidence(page, 'E03_08-A-006_reload-drops-edit.png');
      });

      const unknownId = `prj_qa-p1-${uniq()}`; // not prj_<ULID>: BE 404 before any DB read (projects/access.py)
      const alert = page.getByRole('alert').filter({ hasText: LOAD_ERROR });
      await test.step('[08-B-002] random id → "Không tải được cài đặt dự án" + 404 sentence + "Về danh sách dự án"; no "Thử lại"', async () => {
        await page.goto(ROUTES.project.settings(unknownId));
        await expect(alert).toContainText(GENERIC_NOT_FOUND);
        await expect(alert.getByRole('button', { name: BACK_TO_PROJECTS, exact: true })).toBeVisible();
        await expect(alert.getByRole('button', { name: 'Thử lại', exact: true })).toHaveCount(0);
        await captureEvidence(page, 'E03_08-B-002_unknown-project.png');
      });

      await test.step('[08-B-003] no role=status "Chưa có thay đổi" chip in the error state', async () => {
        await expect.soft(saveChip(page)).toHaveCount(0);
        await expect.soft(page.getByRole('status').filter({ hasText: CHIP.idle })).toHaveCount(0);
      });

      await test.step('[08-A-028] "Về danh sách dự án" → "/"', async () => {
        await alert.getByRole('button', { name: BACK_TO_PROJECTS, exact: true }).click();
        await expect.poll(() => pathOf(page)).toBe(ROUTES.dashboard);
        await captureEvidence(page, 'E03_08-A-028_back-to-projects.png');
      });
    });
  });

  test('SCR-08 · FL-08-09 · narrow window: "Nhóm cài đặt" select, keyboard, resize back to the tab strip', async ({ browser }) => {
    await withSession(
      browser,
      async (s) => {
        const { page } = s;
        const project = await seed(s, '08-f-021');
        const select = page.getByRole('combobox', { name: SETTINGS_TABS, exact: true });

        await test.step('[08-F-021] at 375 no tablist; "Nhóm cài đặt" → "Vùng nguy hiểm" shows "Xoá dự án"; no horizontal scroll', async () => {
          await openSettings(page, project);
          await expect(tablist(page)).toHaveCount(0);
          await select.click();
          await page.getByRole('option', { name: TAB.danger, exact: true }).click();
          await expect(page.getByRole('button', { name: DANGER.deleteProject, exact: true })).toBeVisible();
          expect(await horizontalOverflow(page), 'no horizontal scroll at 375 px').toBeLessThanOrEqual(0);
          await captureEvidence(page, 'E03_08-F-021_compact-select.png');
        });

        await test.step('[08-E-013] the select by keyboard: Space opens, Esc closes, Enter opens, arrows move, Enter selects "Đơn vị đo"', async () => {
          await select.focus();
          await page.keyboard.press(' ');
          await expect.soft(select).toHaveAttribute('aria-expanded', 'true');
          await page.keyboard.press('Escape');
          await expect.soft(select).toHaveAttribute('aria-expanded', 'false');
          await page.keyboard.press('Enter');
          await expect.soft(select).toHaveAttribute('aria-expanded', 'true');
          await page.keyboard.press('ArrowDown'); // highlight starts on "Vùng nguy hiểm" (SEL), wraps to "Chung"
          await page.keyboard.press('ArrowDown'); // "Đơn vị đo"
          await page.keyboard.press('Enter');
          await expect.soft(field(page, SNAP_LABEL)).toBeVisible();
        });

        await test.step('[08-F-022] 1280 without reload → tablist, "Đơn vị đo" still active; back to 800 → the select, same panel', async () => {
          await page.setViewportSize({ width: 1280, height: 900 });
          await expect.soft(tab(page, TAB.units)).toHaveAttribute('aria-current', 'true');
          await expect.soft(field(page, SNAP_LABEL)).toBeVisible();
          await captureEvidence(page, 'E03_08-F-022_resized-1280.png');
          await page.setViewportSize({ width: 800, height: 900 });
          await expect.soft(tablist(page)).toHaveCount(0);
          await expect.soft(select).toContainText(TAB.units);
          await expect.soft(field(page, SNAP_LABEL)).toBeVisible();
          await captureEvidence(page, 'E03_08-F-022_resized-800.png');
        });

        await test.step('[08-E-001] at 1280: Arrow keys wrap, Home/End jump, focus follows, one tabindex=0; tabpanel focusable + labelled', async () => {
          await page.setViewportSize({ width: 1280, height: 900 });
          const order = [TAB.general, TAB.units, TAB.members, TAB.danger];
          await tab(page, TAB.units).focus();
          const expectActive = async (label: string, why: string): Promise<void> => {
            await expect.soft(tab(page, label), why).toHaveAttribute('aria-current', 'true');
            await expect.soft(tab(page, label), `${why}: focus follows`).toBeFocused();
          };
          await page.keyboard.press('ArrowRight');
          await expectActive(TAB.members, 'ArrowRight');
          await page.keyboard.press('End');
          await expectActive(TAB.danger, 'End');
          await page.keyboard.press('ArrowRight');
          await expectActive(TAB.general, 'ArrowRight wraps to the first');
          await page.keyboard.press('ArrowLeft');
          await expectActive(TAB.danger, 'ArrowLeft wraps to the last');
          await page.keyboard.press('Home');
          await expectActive(TAB.general, 'Home');
          const tabindex = await Promise.all(order.map((label) => tab(page, label).getAttribute('tabindex')));
          expect.soft(tabindex, 'only the active tab is in the Tab order').toEqual(['0', '-1', '-1', '-1']);
          const panel = page.getByRole('region', { name: TAB.general });
          await expect.soft(panel).toHaveAttribute('tabindex', '0');
          await captureEvidence(page, 'E03_08-E-001_tablist-keyboard.png');
        });
      },
      COMPACT,
    );
  });
});
