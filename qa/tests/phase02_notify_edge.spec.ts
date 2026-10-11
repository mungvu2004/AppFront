/**
 * Phase 2 — EDGE CASES with a SECOND REAL USER: SCR-06 notifications (bell drawer on `/`, route `/thong-bao`) and
 * SCR-07 onboarding (`/onboarding`). Gaps left by `phase02_dashboard.spec.ts` + `phase02_dashboard_edge.spec.ts`
 * (whose SCR-06/07 tests run as the admin and skip when the admin has no notification). Coverage rows of this file:
 * `qa/coverage/.phase02-edge-notify.rows.md` (same table as `qa/coverage/phase02.md`, FE stamp 5afd8b8a).
 *
 * Every expected result cites the FE source (5afd8b8a) or, written `BE:`, AppBack (`apps/api/…`).
 *   NC  src/screens/system/NotificationCenter/NotificationCenter.tsx   UNC useNotificationCenter.ts (same folder)
 *   NCC NotificationCenter.container.tsx  NCG notificationCenterGateway.ts  NM notificationModel.ts
 *   DRW src/components/overlay/Drawer.tsx  FT src/lib/input/focusTrap.ts  TT src/components/ui/Tooltip.tsx
 *   IB  src/components/ui/IconButton.tsx   TST src/components/feedback/Toast.tsx
 *   WS  src/screens/onboarding/WelcomeScreen/WelcomeScreen.tsx  UWS useWelcomeScreen.ts  WSC WelcomeScreen.container.tsx
 *   PS  src/screens/project/ProjectSettings/ProjectSettings.tsx
 *
 * ## The second user (real, no mock)
 * One `engineer` invitee per WORKER, made lazily by the first test that needs it: the admin invites a run-unique
 * `qa-<runId>-notify-…@example.test` (`POST /api/users/invitations`, BE:users/router.py:55-62), the one-time token is
 * read from the real mail in Mailpit, and the invitee accepts it (`POST /api/auth/invitations/accept`) with a random
 * password kept in worker memory only. `test.afterAll` deletes the user (`DELETE /api/users/{id}`) and every mail to
 * that address. Notifications are produced for real: the admin creates a `qa-<runId>-…` project and adds the
 * invitee (`POST /api/projects/{id}/members`) → `projectInvite` (BE:notifications/invite_sinks.py:20-50).
 *
 * ## Non-serial, independent
 * Every test opens its own browser context, signs the invitee in through the API inside that context (no UI login),
 * creates the projects it needs and deletes them in `finally`. Deleting a project hides its notifications
 * (`visible_to_owner`, BE:notifications/service.py:53-60), so each test starts from an EMPTY inbox and NO project
 * whatever ran before; tests that rely on that assert it first (precondition read from the page's own N4/N1 body).
 * Nothing a test leaves in the invitee's inbox is read by another test.
 *
 * ## Mocks — "[mocked response]" in the title (1 of 19)
 * - `POST /api/notifications/read` 500 — unpairable: 5xx is not producible on the shared stack.
 *
 * ## Admin: only through the API, never its inbox
 * The admin is never signed in through the UI, its password never changes, it never sends `read`/`read-all`
 * (it only invites, creates/deletes its own `qa-` projects and adds the invitee). The admin's own inbox is untouched.
 *
 * ## Real-backend budget per run (BE defaults; the QA stack adds `qa-limits.override.yml`)
 * - `POST /api/auth/login` per IP 30 / 60 s (BE:auth/settings.py:36-37; override 120): admin API sign-in 1 per worker
 *   (+1 per failed test — Playwright restarts the worker), invitee API sign-in 1 per test = 19. Tests take ≥ 10 s each
 *   (slowMo 400), so ≤ 7 a minute. 0 failed logins.
 * - `POST /api/users/invitations` 30 / 3600 s per admin (BE:users/router.py:32-43): 1 per worker = 1 + 1 per failed
 *   test. Up to five tests are expected to fail on open bugs (BUG-114, BUG-124 ×2, BUG-125, BUG-127) → ≤ 6. Phase 1 (8) + phase-2 API
 *   (3) + this file (≤ 6) = 17 ≤ 30.
 * - `recovery_ip` 10 / 900 s per IP (BE:auth_recovery/settings.py:24-25; override 60) counts the accepts: same as the
 *   invitations (≤ 6); with the phase-2 API spec's 3 → 9 ≤ 10.
 * - `members_add` 60 / 3600 s per actor (BE:project_members/router.py:26-33): 13 per run (admin).
 * - `POST /api/projects`: 13 per run (11 tests), every one deleted in `finally`. Projects/notifications routes have no limit.
 * - `POST /api/auth/refresh` 300 / 60 s per session: one per page load (invitee) + one per 8 min (admin API).
 */
import { randomUUID } from 'node:crypto';

import { expect, request, test } from '@playwright/test';
import type { APIRequestContext, APIResponse, Browser, BrowserContext, Locator, Page } from '@playwright/test';

import { ROUTES } from '../../e2e/fixtures/routes';
import { waitForApi, watchApi } from '../../e2e/fullstack/apiWatch';
import type { ApiEntry, ApiResult } from '../../e2e/fullstack/apiWatch';
import { readBaseUrl } from '../../e2e/fullstack/env';
import { apiBaseUrl } from './support/api';
import { dashboardLoaded, readAdminCredentials } from './support/auth';
import { TEST_DATA_PREFIX, attachJson, captureEvidence, testEmail } from './support/evidence';
import { linkFrom, waitForMail } from './support/mailpit';

/* ---------------------------------------------------------------- constants (each cites its source) */

/** `src/api/endpoints.ts:13,188-192,276-277` under `/api`. */
const NOTIFICATIONS_RE = /^\/api\/notifications$/u;
const MARK_READ_API = '/api/notifications/read';
const MARK_ALL_READ_API = '/api/notifications/read-all';
const ACCEPT_INVITE_RE = /^\/api\/notifications\/[^/]+\/accept-invite$/u;
const SUMMARIES_RE = /^\/api\/project-summaries$/u;
const STREAM_PATH = '/api/streams/notifications';
const INVITE_SUBJECT = 'Lời mời tham gia AppBack'; // BE:auth_recovery/messages.py (phase02_dashboard_api `invite`)
const MAILPIT_URL = (process.env.E2E_MAILPIT_URL ?? 'http://localhost:8025').replace(/\/+$/u, '');

/** `src/lib/mutations/undoTicket.ts:18`. */
const UNDO_WINDOW_MS = 8_000;
/** Admin access token lives 600 s (BE:auth/settings.py:31) — refreshed well before. */
const ADMIN_TOKEN_MAX_AGE_MS = 480_000;
const ARRIVAL_TIMEOUT_MS = 20_000;
/** Tooltip dwell (TT:14) + its 120 ms entrance (TT:113). */
const TOOLTIP_SHOWN_MS = 2_000;
/** WCAG 2.2 AA SC 2.5.8 "Target Size (Minimum)" — the suite's a11y standard (skill qa-review-a11y). */
const MIN_TARGET_PX = 24;

const DESKTOP = { width: 1440, height: 900 } as const;
const LAPTOP = { width: 1024, height: 768 } as const;
const COMPACT = { width: 375, height: 812 } as const;
type Viewport = { readonly width: number; readonly height: number };

/* SCR-06 copy. */
const MARK_ALL_READ = 'Đánh dấu tất cả đã đọc'; // NC:55
const MARK_READ = 'Đánh dấu đã đọc'; // NC:56
const NOTIF_TITLE = 'Thông báo'; // NC:54 (drawer / sheet heading)
const NOTIF_SETTINGS = 'Mở cài đặt thông báo'; // NC:57
const NOTIF_FILTER = 'Lọc thông báo'; // NC:58
const VIEW_ALL = 'Xem tất cả'; // NC:59
const UNREAD_HINT = /^chưa đọc\. /u; // NC:62,166 (sr-only prefix of an unread row's sentence button)
const NOTIF_EMPTY = 'Không có thông báo mới'; // NC:64
const NOTIF_EMPTY_DESCRIPTION = 'Chúng tôi sẽ báo khi AI xử lý xong hoặc có người nhắc đến bạn.'; // NC:65
const NOTIF_PARTIAL = 'Có thể chưa cập nhật'; // NotificationCenter.tsx PARTIAL_NOTICE: a failed write only (a tab with no match is 'empty', BUG-179)
/** One empty-state sentence per tab (BUG-126); the two filtered tabs also offer "Hiện mọi thông báo". */
const NOTIF_EMPTY_UNREAD = 'Không có thông báo chưa đọc'; // NotificationCenter.tsx EMPTY_COPY.unread
const NOTIF_EMPTY_MENTIONS = 'Chưa có ai nhắc đến bạn'; // NotificationCenter.tsx EMPTY_COPY.mentions
const NOTIF_SHOW_EVERYTHING = 'Hiện mọi thông báo'; // NotificationCenter.tsx SHOW_EVERYTHING_LABEL
const NOTIF_FILTERS = { all: 'Tất cả', unread: 'Chưa đọc', mentions: 'Nhắc đến tôi' } as const; // NM:114-118
const ACCEPT = 'Chấp nhận'; // notificationCenterGateway.ts:182 (projectInvite → kind 'accept'; capitalised since BUG-181, A6)
const ACCEPTED = 'Đã chấp nhận'; // useNotificationCenter.ts inviteStatus: replaces the button once the accept is done
const NEAR_PX = 24; // largest gap between the gear and its tooltip that still reads as "next to it"
const TODAY = 'Hôm nay'; // UNC:154, NC:264 (section aria-label)
const LIVE = {
  empty: 'Không có thông báo nào', // UNC:156
  allRead: 'Không còn thông báo chưa đọc', // UNC:157
  unread: (badge: string): string => `Có ${badge} thông báo chưa đọc`, // UNC:166-168
} as const;
const MARKED_READ = 'Đã đánh dấu là đã đọc'; // UNC:161
const MARKED_ALL_READ = 'Đã đánh dấu tất cả là đã đọc'; // UNC:160
const UNDO = 'Hoàn tác'; // TST:143
const SETTINGS_HEADING = 'Cài đặt dự án'; // PS:93
const SHEET_GROUP = 'Chiều cao tấm trượt'; // DRW:245
const snapButton = (level: number): string => `Mức ${String(level)}`; // DRW:252

/* SCR-07 copy, UWS:122-146. */
const WELCOME_SEEN_PREFIX = 'appfront:onboarding-welcome-seen:'; // UWS:164
const ONBOARD = {
  step1Action: 'Tạo dự án',
  step2Action: 'Tải bản vẽ',
  step2Locked: 'Cần tạo dự án trước.',
  step3Action: 'Duyệt kết quả',
  step3Locked: 'Cần tải bản vẽ trước.',
  sample: 'Xem dự án mẫu',
  tutorial: 'Xem hướng dẫn 2 phút',
  skip: 'Bỏ qua',
  finish: 'Vào danh sách dự án',
} as const;
const greetingFor = (name: string): string => `Chào ${name}, bắt đầu trong ba bước`; // UWS:123-124,301-305

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

const pathname = (page: Page): string => new URL(page.url()).pathname;
const uniq = (): string => `${Date.now().toString(36)}${Math.random().toString(36).slice(2, 6)}`;
const countApi = (api: readonly ApiEntry[], method: string, path: string): number =>
  api.filter((entry) => entry.method === method && entry.path === path).length;

interface Box {
  readonly x: number;
  readonly y: number;
  readonly width: number;
  readonly height: number;
}

/** Bounding box once a JS (framer-motion) slide has stopped: two equal reads in a row. Evidence must not catch the
 * panel mid-slide (BUG-137) — `captureEvidence` only freezes CSS animations. */
async function settledBox(locator: Locator): Promise<Box> {
  const seen: { previous: Box | null; settled: Box | null } = { previous: null, settled: null };
  await expect
    .poll(
      async () => {
        const box = await locator.boundingBox();
        const before = seen.previous;
        const same =
          box !== null &&
          before !== null &&
          Math.abs(box.x - before.x) < 0.5 &&
          Math.abs(box.y - before.y) < 0.5 &&
          Math.abs(box.width - before.width) < 0.5 &&
          Math.abs(box.height - before.height) < 0.5;
        seen.previous = box;
        if (same) seen.settled = box;
        return same;
      },
      { intervals: [150, 150, 250, 250, 500], timeout: 10_000, message: 'panel stopped moving' },
    )
    .toBe(true);
  if (seen.settled === null) throw new Error('settledBox: no box');
  return seen.settled;
}

/** Page wider than the viewport = a horizontal scroll bar (BUG-114, BUG-124). */
const horizontalOverflow = (page: Page): Promise<number> =>
  page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);

/* ---------------------------------------------------------------- locators (labels verified in src/) */

const bell = (page: Page): Locator => page.getByRole('button', { name: 'Thông báo', exact: true }); // NC:61,389-391
const panel = (page: Page): Locator => page.getByRole('dialog', { name: 'Thông báo', exact: true }); // NC:54,288, DRW:146-148
const rowOf = (scope: Locator, projectName: string): Locator => scope.getByRole('listitem').filter({ hasText: projectName });
const sentenceOf = (row: Locator): Locator => row.getByRole('button').first(); // NC:161-169
const markReadButtons = (scope: Locator): Locator => scope.getByRole('button', { name: MARK_READ, exact: true });
const liveRegion = (scope: Locator): Locator => scope.locator('p[role="status"]'); // NC:333-335
const headerBadge = (scope: Locator): Locator => scope.locator('h3 + span'); // NC:303-307
const filterRadio = (scope: Locator, label: string): Locator =>
  scope.getByRole('radiogroup', { name: NOTIF_FILTER, exact: true }).getByRole('radio', { name: label, exact: true });
const toastWith = (page: Page, text: string): Locator => page.getByRole('status').filter({ hasText: text });
const greeting = (page: Page): Locator => page.getByRole('heading', { level: 1 });

/** Bell drawer open and painted (NC:243-285), slide finished. */
async function openDrawer(page: Page): Promise<Locator> {
  const drawer = panel(page);
  if ((await drawer.count()) === 0) await bell(page).click();
  await expect(drawer).toBeVisible();
  await expect(
    drawer
      .locator('section')
      .first()
      .or(drawer.getByText(NOTIF_EMPTY, { exact: true }))
      .or(drawer.getByText(NOTIF_PARTIAL, { exact: true })),
  ).toBeVisible();
  await settledBox(drawer);
  return drawer;
}

/* ---------------------------------------------------------------- admin (API only, one login per worker) */

interface AdminApi {
  readonly ctx: APIRequestContext;
  token: string;
  tokenAt: number;
  userId: string;
}

let adminPromise: Promise<AdminApi> | undefined;

async function refreshAdmin(admin: AdminApi): Promise<void> {
  const res = await admin.ctx.post('/api/auth/refresh');
  expect(res.status(), 'admin POST /api/auth/refresh').toBe(200);
  const body = asRecord(await res.json(), 'refresh');
  const root = typeof body.data === 'object' && body.data !== null ? asRecord(body.data, 'refresh.data') : body; // src/lib/auth/refresh.ts:85-100
  const token = typeof root.accessToken === 'string' ? root.accessToken : String(root.access_token ?? '');
  if (token === '') throw new Error('admin refresh: no access token');
  admin.token = token;
  admin.tokenAt = Date.now();
  admin.userId = String(asRecord(root.user, 'refresh.user').id);
}

/** `POST /api/auth/login` (BE:auth/router.py, camelCase) once per worker; the context keeps the refresh cookie. */
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
    const admin: AdminApi = { ctx, token: '', tokenAt: 0, userId: '' };
    await refreshAdmin(admin);
    return admin;
  })();
  const admin = await adminPromise;
  if (Date.now() - admin.tokenAt > ADMIN_TOKEN_MAX_AGE_MS) await refreshAdmin(admin);
  return admin;
}

async function asAdmin(method: 'GET' | 'POST' | 'DELETE', path: string, data?: unknown): Promise<APIResponse> {
  const admin = await adminApi();
  return admin.ctx.fetch(path, {
    method,
    headers: { Authorization: `Bearer ${admin.token}` },
    ...(data === undefined ? {} : { data }),
  });
}

/* ---------------------------------------------------------------- the invitee (one per worker) */

interface Invitee {
  readonly id: string;
  readonly email: string;
  readonly name: string;
  /** Random, worker memory only, never logged or attached. */
  readonly password: string;
}

let inviteePromise: Promise<Invitee> | undefined;
/** Set as soon as the invitation exists, so `afterAll` can delete the user even if the accept failed. */
let invitedUser: { readonly id: string; readonly email: string } | undefined;

async function makeInvitee(): Promise<Invitee> {
  const email = testEmail('notify');
  const since = new Date(Date.now() - 5_000);
  const sent = await asAdmin('POST', '/api/users/invitations', { emails: [email], role: 'engineer' }); // BE:users/router.py:55-62
  expect(sent.status(), 'setup: POST /api/users/invitations').toBe(201);
  const user = asList(await sent.json(), 'invitations').find((u) => u.email === email);
  expect(user?.status, 'setup: the invitee is pending').toBe('pending');
  const id = String(user?.id);
  invitedUser = { id, email };

  const mail = await waitForMail(email, since, 30_000, INVITE_SUBJECT);
  // `{PUBLIC_BASE_URL}/login/invitation#token=…` (BE:auth_recovery/messages.py).
  const token = new URLSearchParams(new URL(linkFrom(mail, '/login/invitation')).hash.slice(1)).get('token');
  if (!token) throw new Error('invitation mail: no #token');

  const name = `${TEST_DATA_PREFIX}notify-${uniq()}`;
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

const invitee = (): Promise<Invitee> => (inviteePromise ??= makeInvitee());

async function sweepMails(address: string): Promise<void> {
  const query = encodeURIComponent(`to:"${address}"`);
  const found = (await (await fetch(`${MAILPIT_URL}/api/v1/search?query=${query}&limit=100`)).json()) as {
    messages?: Array<{ ID: string }>;
  };
  const ids = (found.messages ?? []).map((m) => m.ID);
  if (ids.length === 0) return;
  await fetch(`${MAILPIT_URL}/api/v1/messages`, {
    method: 'DELETE',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ IDs: ids }),
  });
}

test.afterAll(async () => {
  if (invitedUser !== undefined) {
    const { id, email } = invitedUser;
    const res = await asAdmin('DELETE', `/api/users/${id}`, { userId: id, confirmEmail: email }).catch(() => null);
    if (res !== null && res.status() !== 200) console.warn(`cleanup: DELETE /api/users/${id} → ${String(res.status())}`);
    await sweepMails(email).catch(() => undefined);
  }
  if (adminPromise !== undefined) await (await adminPromise.catch(() => null))?.ctx.dispose();
});

/* ---------------------------------------------------------------- per-test session */

interface Session {
  readonly user: Invitee;
  readonly context: BrowserContext;
  readonly page: Page;
  readonly api: ApiEntry[];
  /** Project ids this test created; deleted in `finally`. */
  readonly projects: string[];
}

interface SharedProject {
  readonly id: string;
  readonly name: string;
}

/** Admin creates a `qa-` project and adds the invitee → one `projectInvite` (BE:invite_sinks.py:20-50). */
async function sharedProject(session: Session, slug: string): Promise<SharedProject> {
  const name = `${TEST_DATA_PREFIX}${slug}-${uniq()}`;
  const created = await asAdmin('POST', '/api/projects', { name }); // BE:projects/router.py:54-63
  expect(created.status(), `fixture POST /api/projects "${name}"`).toBe(201);
  const id = String(asRecord(await created.json(), 'project').id);
  session.projects.push(id);
  const added = await asAdmin('POST', `/api/projects/${id}/members`, { email: session.user.email }); // BE:project_members/router.py:42-70
  expect(added.status(), 'fixture POST /api/projects/{id}/members').toBe(201);
  return { id, name };
}

/** New context, invitee signed in through the API inside it (sets the refresh cookie), `body`, cleanup. */
async function asInvitee(browser: Browser, body: (session: Session) => Promise<void>, viewport: Viewport = DESKTOP): Promise<void> {
  const user = await invitee();
  const context = await browser.newContext({ baseURL: readBaseUrl(), viewport });
  const page = await context.newPage();
  const session: Session = { user, context, page, api: watchApi(page), projects: [] };
  try {
    // Same login as `signedInApi` (support/api.ts) but inside this context, so the refresh cookie is the page's.
    const login = await context.request.post('/api/auth/login', {
      headers: { Origin: apiBaseUrl() },
      data: { email: user.email, password: user.password, rememberMe: false },
    });
    expect(login.status(), 'invitee POST /api/auth/login').toBe(204);
    await body(session);
  } finally {
    for (const id of session.projects) {
      const res = await asAdmin('DELETE', `/api/projects/${id}`).catch(() => null);
      if (res !== null && res.status() !== 200 && res.status() !== 404) console.warn(`cleanup: DELETE /api/projects/${id} → ${String(res.status())}`);
    }
    await context.close().catch(() => undefined);
  }
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

/** Full load of `/` (or `/thong-bao`), returning the N4 list the page itself received (NCG:274-280, UNC:447-450). */
async function loadWithInbox(page: Page, path: string = ROUTES.dashboard): Promise<Json[]> {
  const { json } = await navigateAndWaitForApi(page, () => page.goto(path, { waitUntil: 'commit' }), 'GET', NOTIFICATIONS_RE, [200]);
  if (path === ROUTES.dashboard) await dashboardLoaded(page);
  return asList(json, 'GET /api/notifications');
}

const inviteOf = (inbox: readonly Json[], projectId: string): Json => {
  const found = inbox.find((n) => n.projectId === projectId && n.kind === 'projectInvite');
  if (found === undefined) throw new Error(`no projectInvite for ${projectId} in GET /api/notifications`);
  return found;
};

/* ================================================================= SCR-06 notifications */

test.describe('E02 SCR-06 notifications as a second real user (invitee)', () => {
  test('E02 · SCR-06 empty inbox (real): no badge, one empty sentence per filter, mark-all disabled, live "Không có thông báo nào"', async ({ browser }) => {
    await asInvitee(browser, async ({ page }) => {
      const inbox = await loadWithInbox(page);
      expect(inbox, 'precondition: the invitee owns no visible notification').toEqual([]);
      await expect(bell(page)).toHaveText(''); // NC:401 (badge '' → no Badge), UNC:932
      const drawer = await openDrawer(page);
      await expect(drawer.getByText(NOTIF_EMPTY, { exact: true })).toBeVisible(); // NC:254-255
      await expect(drawer.getByText(NOTIF_EMPTY_DESCRIPTION, { exact: true })).toBeVisible();
      await expect(drawer.getByRole('button', { name: MARK_ALL_READ, exact: true })).toBeDisabled(); // NC:239
      await expect(headerBadge(drawer)).toHaveCount(0); // NC:303
      await expect(liveRegion(drawer)).toHaveText(LIVE.empty); // UNC:920-921

      // BUG-126: no row to show is the 'empty' state, and each tab says what it filters; the two filtered tabs offer a way back.
      const seen: Record<string, string> = {};
      for (const [label, title] of [[NOTIF_FILTERS.unread, NOTIF_EMPTY_UNREAD], [NOTIF_FILTERS.mentions, NOTIF_EMPTY_MENTIONS]] as const) {
        await filterRadio(drawer, label).click();
        await expect(filterRadio(drawer, label)).toHaveAttribute('aria-checked', 'true');
        await expect(drawer.getByText(title, { exact: true })).toBeVisible();
        await expect(drawer.getByText(NOTIF_EMPTY, { exact: true }), 'not the "Tất cả" sentence').toHaveCount(0);
        await expect(drawer.getByRole('button', { name: NOTIF_SHOW_EVERYTHING, exact: true })).toBeVisible();
        await expect(drawer.getByText(NOTIF_PARTIAL, { exact: true })).toHaveCount(0);
        seen[label] = title;
      }
      await captureEvidence(page, 'E02_ntf_empty_inbox.png', { caption: `fresh invitee, filter "${NOTIF_FILTERS.mentions}": "${NOTIF_EMPTY_MENTIONS}" + "${NOTIF_SHOW_EVERYTHING}"` });
      await attachJson('E02_ntf_empty_inbox.json', { inbox: inbox.length, emptySentencePerFilter: seen, bug: 'BUG-126' });
    });
  });

  test('E02 · SCR-06 two real invites: newest first in one "Hôm nay" group; bell, header and live region say 2', async ({ browser }) => {
    await asInvitee(browser, async (session) => {
      const { page } = session;
      const older = await sharedProject(session, 'ntf-order-a');
      const newer = await sharedProject(session, 'ntf-order-b');
      const inbox = await loadWithInbox(page);
      expect(inbox.map((n) => n.projectId), 'N4 newest first (BE:service.py:162-170)').toEqual([newer.id, older.id]);

      await expect(bell(page)).toHaveText('2'); // UNC:800-803
      const drawer = await openDrawer(page);
      const today = drawer.getByRole('region', { name: TODAY, exact: true }); // NC:264, UNC:352-355
      const rows = today.getByRole('listitem');
      await expect(rows).toHaveCount(2);
      await expect(rows.nth(0)).toContainText(newer.name); // UNC:805-811 sort createdAt desc
      await expect(rows.nth(1)).toContainText(older.name);
      for (const index of [0, 1]) {
        await expect(sentenceOf(rows.nth(index))).toHaveAccessibleName(UNREAD_HINT); // NC:166
        await expect(rows.nth(index).getByRole('button', { name: ACCEPT, exact: true })).toBeVisible(); // NCG:182
      }
      await expect(headerBadge(drawer)).toHaveText('2'); // NC:303-307
      await expect(liveRegion(drawer)).toHaveText(LIVE.unread('2')); // UNC:918-919
      await captureEvidence(page, 'E02_ntf_two_invites.png', { caption: `rows: ${newer.name} then ${older.name}; badge 2` });
      await attachJson('E02_ntf_two_invites.json', { order: inbox.map((n) => n.projectName), badge: '2' });
    });
  });

  test('E02 · SCR-06 "Chấp nhận" on a real projectInvite POSTs accept-invite (200), keeps the drawer open, turns the row read, shows "Đã chấp nhận" and clears the badge', async ({ browser }) => {
    await asInvitee(browser, async (session) => {
      const { page } = session;
      const project = await sharedProject(session, 'ntf-accept');
      const notification = inviteOf(await loadWithInbox(page), project.id);
      expect(notification.isRead).toBe(false);
      await expect(bell(page)).toHaveText('1');

      const drawer = await openDrawer(page);
      const row = rowOf(drawer, project.name);
      await expect(sentenceOf(row)).toHaveAccessibleName(UNREAD_HINT);
      const accepted = waitForApi(page, 'POST', ACCEPT_INVITE_RE, [200]);
      const relisted = waitForApi(page, 'GET', NOTIFICATIONS_RE, [200]); // invalidationMap.acceptInvite (UNC:627-632)
      await row.getByRole('button', { name: ACCEPT, exact: true }).click(); // UNC:755-765 kind 'accept'
      const { response, json } = await accepted;
      expect(new URL(response.url()).pathname).toBe(`/api/notifications/${String(notification.id)}/accept-invite`);
      expect(response.request().postDataJSON()).toEqual({}); // src/api/client.ts:1128, BE NotificationEmptyBody
      expect(asRecord(json, 'accept-invite')).toMatchObject({ id: notification.id, kind: 'projectInvite', isRead: true }); // BE:service.py:204-210
      await relisted;

      // NC:231-236: only a 'navigate' action closes; 'accept' keeps the drawer and the route.
      await expect(drawer).toBeVisible();
      expect(pathname(page)).toBe(ROUTES.dashboard);
      await expect(sentenceOf(row)).not.toHaveAccessibleName(UNREAD_HINT);
      await expect(markReadButtons(row)).toHaveCount(0); // NC:187
      await expect(bell(page)).toHaveText('');
      await expect(liveRegion(drawer)).toHaveText(LIVE.allRead); // UNC:922
      // BUG-181 / ND-C1: the button gives way to "Đã chấp nhận" (this session only), so there is no second press from the UI;
      // the server-side idempotence (a second accept answers 200 again, BE:service.py:191-195) is proven by the API "accept" test.
      await expect(row.getByText(ACCEPTED, { exact: true })).toBeVisible();
      await expect(row.getByRole('button', { name: ACCEPT, exact: true })).toHaveCount(0);
      await captureEvidence(page, 'E02_ntf_accept_invite.png', { caption: `"${ACCEPT}" → POST …/accept-invite 200; drawer open, row read, "${ACCEPTED}", badge cleared` });
      await attachJson('E02_ntf_accept_invite.json', { notification: notification.id, status: response.status(), accepted: true, drawerOpen: true });
    });
  });

  test('E02 · SCR-06 clicking a real unread row in the drawer: POST /read at once, lands on "Cài đặt dự án" of that project, drawer closed', async ({ browser }) => {
    await asInvitee(browser, async (session) => {
      const { page } = session;
      const project = await sharedProject(session, 'ntf-row-drawer');
      const notification = inviteOf(await loadWithInbox(page), project.id);
      const drawer = await openDrawer(page);
      const posted = page.waitForResponse((r) => r.request().method() === 'POST' && new URL(r.url()).pathname === MARK_READ_API);
      await sentenceOf(rowOf(drawer, project.name)).click(); // UNC:726-738: no undo window on a row click
      const response = await posted;
      expect(response.status()).toBe(204);
      expect(response.request().postDataJSON()).toEqual({ ids: [notification.id] });
      // projectInvite → place projectSettings → ROUTES.project.settings (NCG:96-101,135-136).
      await expect.poll(() => pathname(page)).toBe(ROUTES.project.settings(project.id));
      await expect(page.getByRole('heading', { level: 1, name: SETTINGS_HEADING, exact: true })).toBeVisible();
      await expect(panel(page)).toHaveCount(0);
      await captureEvidence(page, 'E02_ntf_row_drawer.png', { caption: `row click → ${pathname(page)}` });

      // Read-back through the page's own N4: the server kept it read.
      const after = inviteOf(await loadWithInbox(page), project.id);
      expect(after.isRead).toBe(true);
      await attachJson('E02_ntf_row_drawer.json', { landed: ROUTES.project.settings(project.id), postIds: [notification.id], readAfterReload: after.isRead });
    });
  });

  test('E02 · SCR-06 on /thong-bao (direct load) a row click lands on its project and stays there — the route close does not bounce to /', async ({ browser }) => {
    await asInvitee(browser, async (session) => {
      const { page } = session;
      const project = await sharedProject(session, 'ntf-row-route');
      inviteOf(await loadWithInbox(page, ROUTES.notifications), project.id);
      const route = panel(page);
      await expect(route).toBeVisible(); // NCC:223 pinned open
      await settledBox(route);
      await sentenceOf(rowOf(route, project.name)).click();
      const target = ROUTES.project.settings(project.id);
      await expect.poll(() => pathname(page)).toBe(target);
      // NC:221-224 calls onClose 180 ms later; NCC:202-213 must ignore it after goTo (B-V2-04) — otherwise a direct
      // load (`location.key === 'default'`) sends the user to `/` (NCC:215-218). Give it 4× that time.
      await expect(page.getByRole('heading', { level: 1, name: SETTINGS_HEADING, exact: true })).toBeVisible();
      await page.waitForTimeout(720);
      expect(pathname(page)).toBe(target);
      await captureEvidence(page, 'E02_ntf_row_route.png', { caption: `/thong-bao row → ${target}, still there after the close fade` });
      await attachJson('E02_ntf_row_route.json', { from: ROUTES.notifications, landed: pathname(page) });
    });
  });

  test('E02 · SCR-06 filter "Nhắc đến tôi" on an inbox with only an invite: its own empty state "Chưa có ai nhắc đến bạn", no row; "Chưa đọc" keeps it; the badge ignores the filter', async ({ browser }) => {
    await asInvitee(browser, async (session) => {
      const { page } = session;
      const project = await sharedProject(session, 'ntf-filter');
      await loadWithInbox(page);
      const drawer = await openDrawer(page);
      const rows = drawer.getByRole('listitem');

      await filterRadio(drawer, NOTIF_FILTERS.mentions).click(); // UNC:331-332: commentMention only
      await expect(drawer.getByText(NOTIF_EMPTY_MENTIONS, { exact: true })).toBeVisible(); // BUG-126/179: 'empty', worded per tab
      await expect(drawer.getByRole('button', { name: NOTIF_SHOW_EVERYTHING, exact: true })).toBeVisible();
      await expect(rows).toHaveCount(0);
      await expect(drawer.getByText(NOTIF_PARTIAL, { exact: true })).toHaveCount(0); // nothing failed: no yellow strip
      await expect(drawer.getByText(NOTIF_EMPTY, { exact: true })).toHaveCount(0); // the "Tất cả" sentence belongs to that tab
      await expect(bell(page)).toHaveText('1'); // UNC:252 unreadCount does not follow the filter
      await expect(headerBadge(drawer)).toHaveText('1');
      await captureEvidence(page, 'E02_ntf_filter_mentions.png', { caption: `"${NOTIF_FILTERS.mentions}" with one projectInvite → "${NOTIF_EMPTY_MENTIONS}"` });

      await filterRadio(drawer, NOTIF_FILTERS.unread).click(); // UNC:329-330
      await expect(rows).toHaveCount(1);
      await expect(rows.first()).toContainText(project.name);
      await filterRadio(drawer, NOTIF_FILTERS.all).click();
      await expect(rows).toHaveCount(1);
      await attachJson('E02_ntf_filter_mentions.json', { mentions: 0, unread: 1, all: 1, badge: '1' });
    });
  });

  test('E02 · SCR-06 "Đánh dấu tất cả đã đọc" with 2 real unread: rows read at once, then ONE POST /read with both ids after 8 s (no read-all); reload keeps them read', async ({ browser }) => {
    await asInvitee(browser, async (session) => {
      const { page, api } = session;
      const a = await sharedProject(session, 'ntf-all-a');
      const b = await sharedProject(session, 'ntf-all-b');
      const inbox = await loadWithInbox(page);
      const ids = [inviteOf(inbox, a.id).id, inviteOf(inbox, b.id).id].map(String).sort();

      const drawer = await openDrawer(page);
      await expect(markReadButtons(drawer)).toHaveCount(2);
      const sent = page.waitForResponse(
        (r) => r.request().method() === 'POST' && new URL(r.url()).pathname === MARK_READ_API,
        { timeout: UNDO_WINDOW_MS + 15_000 },
      );
      const clickedAt = Date.now();
      await drawer.getByRole('button', { name: MARK_ALL_READ, exact: true }).click(); // UNC:793-798 → deferMarkRead
      await expect(markReadButtons(drawer)).toHaveCount(0); // pending overlay UNC:461-471
      await expect(bell(page)).toHaveText('');
      await expect(liveRegion(drawer)).toHaveText(LIVE.allRead);
      await expect(toastWith(page, MARKED_ALL_READ)).toBeVisible();

      const response = await sent;
      const elapsed = Date.now() - clickedAt;
      expect(response.status()).toBe(204);
      const body = asRecord(response.request().postDataJSON() as unknown, 'POST read body');
      expect((Array.isArray(body.ids) ? body.ids.map(String) : []).sort(), 'the ids visible at the click (UNC:644-647)').toEqual(ids);
      expect(elapsed, 'sent at the end of the undo window').toBeGreaterThanOrEqual(UNDO_WINDOW_MS - 1_000);
      expect(countApi(api, 'POST', MARK_ALL_READ_API), 'read-all is no longer used (UNC:644-647)').toBe(0);

      const reloaded = await loadWithInbox(page);
      expect([inviteOf(reloaded, a.id).isRead, inviteOf(reloaded, b.id).isRead]).toEqual([true, true]);
      await expect(bell(page)).toHaveText('');
      const after = await openDrawer(page);
      await expect(markReadButtons(after)).toHaveCount(0);
      await captureEvidence(page, 'E02_ntf_mark_all_sent.png', { caption: `POST /read {2 ids} after ${String(elapsed)} ms; after reload both read, no badge` });
      await attachJson('E02_ntf_mark_all_sent.json', { ids: ids.length, elapsedMs: elapsed, status: response.status(), readAllCalls: 0 });
    });
  });

  test('E02 · SCR-06 [mocked response] POST /read fails (500) after the undo window: row back to unread, badge back, "Có thể chưa cập nhật" (unpairable: 5xx)', async ({ browser }) => {
    await asInvitee(browser, async (session) => {
      const { page } = session;
      const project = await sharedProject(session, 'ntf-read-500');
      await loadWithInbox(page);
      await page.route((url) => url.pathname === MARK_READ_API, async (route) => {
        if (route.request().method() !== 'POST') {
          await route.fallback();
          return;
        }
        await route.fulfill({ status: 500, contentType: 'application/json', body: '{"code":"INTERNAL"}' });
      });

      const drawer = await openDrawer(page);
      const row = rowOf(drawer, project.name);
      await row.hover(); // NC:190-191: the button shows on hover / focus-within
      const failed = page.waitForResponse(
        (r) => r.request().method() === 'POST' && new URL(r.url()).pathname === MARK_READ_API,
        { timeout: UNDO_WINDOW_MS + 15_000 },
      );
      await row.getByRole('button', { name: MARK_READ, exact: true }).click(); // UNC:710-715
      await expect(markReadButtons(row)).toHaveCount(0);
      await expect(bell(page)).toHaveText('');
      expect((await failed).status()).toBe(500); // 500 is not retried for POST (src/lib/http/retry.ts RETRYABLE_STATUSES)

      // createOptimisticMutation restores the snapshot (createOptimisticMutation.ts:54-58), the pending overlay is
      // cleared on settle (UNC:678), and a failed mark-read makes the state "partial" (UNC:881).
      await expect(drawer.getByText(NOTIF_PARTIAL, { exact: true })).toBeVisible();
      await expect(markReadButtons(row)).toHaveCount(1);
      await expect(sentenceOf(row)).toHaveAccessibleName(UNREAD_HINT);
      await expect(bell(page)).toHaveText('1');
      await expect(liveRegion(drawer)).toHaveText(LIVE.unread('1'));
      await page.mouse.move(0, 0);
      await captureEvidence(page, 'E02_ntf_read_500_rollback.png', { caption: 'POST /api/notifications/read → 500 [mocked]: row unread again, "Có thể chưa cập nhật"' });
      await attachJson('E02_ntf_read_500_rollback.json', { mocked: 'POST /api/notifications/read 500', pair: 'unpairable: 5xx', badgeAfter: '1' });
    });
  });

  test('E02 · SCR-06 keyboard: Enter on the bell focuses "Đánh dấu tất cả đã đọc"; Shift+Tab wraps to "Xem tất cả"; Tab reaches a row, which reveals "Đánh dấu đã đọc"; Enter opens it', async ({ browser }) => {
    await asInvitee(browser, async (session) => {
      const { page } = session;
      const project = await sharedProject(session, 'ntf-keys');
      await loadWithInbox(page);
      await bell(page).focus();
      await page.keyboard.press('Enter');
      const drawer = await openDrawer(page);
      const markAll = drawer.getByRole('button', { name: MARK_ALL_READ, exact: true });
      await expect(markAll).toBeFocused(); // FT:183 first focusable (enabled: one unread)

      await page.keyboard.press('Shift+Tab'); // FT:126-133 wraps to the last
      await expect(drawer.getByRole('button', { name: VIEW_ALL, exact: true })).toBeFocused();
      await page.keyboard.press('Tab');
      await expect(markAll).toBeFocused();

      const row = rowOf(drawer, project.name);
      const sentence = sentenceOf(row);
      let presses = 0;
      while (presses < 10 && !(await sentence.evaluate((el) => el === document.activeElement))) {
        await page.keyboard.press('Tab');
        presses += 1;
      }
      await expect(sentence, 'Tab reaches the row sentence').toBeFocused();
      // NC:188-192: `group-focus-within:opacity-100` reveals the hover-only button for keyboard users.
      const markReadWrap = row.getByRole('button', { name: MARK_READ, exact: true }).locator('xpath=..');
      await expect.poll(() => markReadWrap.evaluate((el) => getComputedStyle(el).opacity)).toBe('1');
      await captureEvidence(page, 'E02_ntf_keyboard_row.png', { caption: `Tab ×${String(presses)} → row sentence focused; "${MARK_READ}" visible` });

      await page.keyboard.press('Enter');
      await expect.poll(() => pathname(page)).toBe(ROUTES.project.settings(project.id));
      await expect(panel(page)).toHaveCount(0);
      await attachJson('E02_ntf_keyboard_row.json', { tabsToRow: presses, landed: pathname(page) });
    });
  });

  test('E02 · SCR-06 BUG-114: with nothing unread the gear takes the opening focus; its tooltip is inside the viewport, near the gear, no horizontal scroll', async ({ browser }) => {
    await asInvitee(browser, async ({ page }) => {
      expect(await loadWithInbox(page), 'precondition: empty inbox → "Đánh dấu tất cả đã đọc" disabled').toEqual([]);
      const drawer = await openDrawer(page);
      const gear = drawer.getByRole('button', { name: NOTIF_SETTINGS, exact: true });
      // NC:239 disables mark-all → FT:39-44,183 the gear is the first focusable; IB:58-63 wraps it in a Tooltip whose
      // position is read once, at focus/hover (TT:37-63) — i.e. possibly while the drawer still slides in (DRW:118-120).
      await expect(gear).toBeFocused();
      const tooltip = page.getByRole('tooltip').filter({ hasText: NOTIF_SETTINGS });
      await expect(tooltip).toBeVisible({ timeout: TOOLTIP_SHOWN_MS });
      const tip = await settledBox(tooltip);
      const anchor = await settledBox(gear);
      const overflow = await horizontalOverflow(page);
      // BUG-183: a tooltip that leaves the viewport (BUG-114: it sits right of the 1440 px edge) is not in a viewport shot.
      // Shoot the whole scrollable page then, so the tooltip is on the image next to the gear (focus ring, same drawer).
      const tipOutside = tip.x < 0 || tip.x + tip.width > DESKTOP.width;
      await captureEvidence(page, 'E02_ntf_gear_tooltip.png', { fullPage: tipOutside || overflow > 0, caption: `tooltip x=${String(Math.round(tip.x))}…${String(Math.round(tip.x + tip.width))}; gear centre ${String(Math.round(anchor.x + anchor.width / 2))}; overflow ${String(overflow)} px` });
      await attachJson('E02_ntf_gear_tooltip.json', { tooltip: tip, gear: anchor, horizontalOverflowPx: overflow, bug: 'BUG-114' });

      // BUG-114 fixed: the gear is 38 px from the right edge and the tooltip 144 px wide, so it can no longer be centred on the gear
      // AND above it AND inside the viewport — it is pushed inside and flipped below. What must hold: inside the viewport,
      // near the gear (no gap wider than NEAR_PX on either axis), and no horizontal scroll.
      const gapX = Math.max(0, tip.x - (anchor.x + anchor.width), anchor.x - (tip.x + tip.width));
      const gapY = Math.max(0, tip.y - (anchor.y + anchor.height), anchor.y - (tip.y + tip.height));
      const viewport = page.viewportSize() ?? DESKTOP;
      expect.soft(tip.x >= 0 && tip.y >= 0 && tip.x + tip.width <= viewport.width && tip.y + tip.height <= viewport.height, 'tooltip inside the viewport').toBe(true);
      expect.soft(Math.max(gapX, gapY), `tooltip near the gear (gap x ${String(Math.round(gapX))}, y ${String(Math.round(gapY))} px)`).toBeLessThanOrEqual(NEAR_PX);
      expect(overflow, 'overflowX = 0').toBe(0);
    });
  });

  test('E02 · SCR-06 realtime: a projectInvite created while the dashboard is open arrives over SSE — badge 1, row in "Hôm nay", no list re-read', async ({ browser }) => {
    await asInvitee(browser, async (session) => {
      const { page, api } = session;
      const stream = page.waitForRequest((r) => new URL(r.url()).pathname === STREAM_PATH, { timeout: 30_000 }); // NCG:304-319
      expect(await loadWithInbox(page), 'precondition: empty inbox').toEqual([]);
      await stream;
      await expect(bell(page)).toHaveText('');
      const listReads = countApi(api, 'GET', '/api/notifications');

      // N3 → notify → XADD after commit (BE:invite_sinks.py:1-5) → SSE `notifications` (BE:stream_providers.py).
      const project = await sharedProject(session, 'ntf-live');
      await expect(bell(page)).toHaveText('1', { timeout: ARRIVAL_TIMEOUT_MS }); // UNC:522-539 setQueryData, no fetch
      expect(countApi(api, 'GET', '/api/notifications'), 'the row came from the stream, not a re-read (UNC:541-543)').toBe(listReads);
      const drawer = await openDrawer(page);
      const today = drawer.getByRole('region', { name: TODAY, exact: true });
      await expect(rowOf(today, project.name)).toBeVisible();
      await expect(liveRegion(drawer)).toHaveText(LIVE.unread('1'));
      await captureEvidence(page, 'E02_ntf_realtime_arrival.png', { caption: `member added while open → badge 1, row "${project.name}" without GET /api/notifications` });
      await attachJson('E02_ntf_realtime_arrival.json', { listReadsBefore: listReads, listReadsAfter: countApi(api, 'GET', '/api/notifications'), badge: '1' });
    });
  });

  test('E02 · SCR-06 mark one read, then leave for /thong-bao inside the window: the POST still leaves once at ~8 s and the route shows the row read', async ({ browser }) => {
    await asInvitee(browser, async (session) => {
      const { page } = session;
      const project = await sharedProject(session, 'ntf-leave-send');
      const notification = inviteOf(await loadWithInbox(page), project.id);
      const drawer = await openDrawer(page);
      const row = rowOf(drawer, project.name);
      await row.hover();
      const sent = page.waitForResponse(
        (r) => r.request().method() === 'POST' && new URL(r.url()).pathname === MARK_READ_API,
        { timeout: UNDO_WINDOW_MS + 15_000 },
      );
      const clickedAt = Date.now();
      await row.getByRole('button', { name: MARK_READ, exact: true }).click();
      await drawer.getByRole('button', { name: VIEW_ALL, exact: true }).click(); // UNC:767-770
      await expect.poll(() => pathname(page)).toBe(ROUTES.notifications);
      const route = panel(page);
      await expect(route).toBeVisible();
      // UNC:455-458 (ponytail): the overlay lives in the unmounted bell instance; the route instance may show it unread.
      const unreadOnArrival = await markReadButtons(rowOf(route, project.name)).count();

      // UNC:649-652,677-681: leaving does not send early; the timer still fires and calls the gateway directly.
      const response = await sent;
      const elapsed = Date.now() - clickedAt;
      expect(response.status()).toBe(204);
      expect(response.request().postDataJSON()).toEqual({ ids: [notification.id] });
      expect(elapsed).toBeGreaterThanOrEqual(UNDO_WINDOW_MS - 1_000);
      await expect(markReadButtons(rowOf(route, project.name))).toHaveCount(0); // `.finally(invalidateList)` UNC:680
      await expect(headerBadge(route)).toHaveCount(0);
      await settledBox(route);
      await captureEvidence(page, 'E02_ntf_leave_then_sent.png', { caption: `left at once; POST /read after ${String(elapsed)} ms; row read on /thong-bao` });
      await expect.poll(() => countApi(session.api, 'POST', MARK_READ_API), 'one POST /read').toBe(1);
      const posts = countApi(session.api, 'POST', MARK_READ_API);
      await attachJson('E02_ntf_leave_then_sent.json', { elapsedMs: elapsed, unreadOnArrivalAtRoute: unreadOnArrival, posts });
    });
  });

  test('E02 · SCR-06 mark one read, leave for /thong-bao, then "Hoàn tác" on the toast: nothing is sent and the row stays unread on the server', async ({ browser }) => {
    await asInvitee(browser, async (session) => {
      const { page } = session;
      const project = await sharedProject(session, 'ntf-leave-undo');
      await loadWithInbox(page);
      const drawer = await openDrawer(page);
      const row = rowOf(drawer, project.name);
      await row.hover();
      await row.getByRole('button', { name: MARK_READ, exact: true }).click();
      await drawer.getByRole('button', { name: VIEW_ALL, exact: true }).click();
      await expect.poll(() => pathname(page)).toBe(ROUTES.notifications);

      // The toast lives on the app-wide NotificationHost (UNC:649-652), so "Hoàn tác" survives the route change.
      await toastWith(page, MARKED_READ).getByRole('button', { name: UNDO, exact: true }).click(); // UNC:699-702
      await page.mouse.move(0, 0);
      const leaked = await page
        .waitForRequest((r) => r.method() === 'POST' && new URL(r.url()).pathname === MARK_READ_API, { timeout: UNDO_WINDOW_MS + 2_000 })
        .then(() => true, () => false);
      expect(leaked, 'POST /read sent despite "Hoàn tác"').toBe(false);

      const reloaded = await loadWithInbox(page, ROUTES.notifications);
      expect(inviteOf(reloaded, project.id).isRead, 'server row still unread').toBe(false);
      const route = panel(page);
      await expect(sentenceOf(rowOf(route, project.name))).toHaveAccessibleName(UNREAD_HINT);
      await settledBox(route);
      await captureEvidence(page, 'E02_ntf_leave_then_undo.png', { caption: '"Hoàn tác" after leaving → no POST /read; row unread after reload' });
      await attachJson('E02_ntf_leave_then_undo.json', { postSent: leaked, isReadAfterReload: false });
    });
  });

  for (const viewport of [DESKTOP, LAPTOP]) {
    test(`E02 · SCR-06 BUG-124: /thong-bao at ${String(viewport.width)} — once the slide stops, the 400 px panel sits 8 px from the right edge with its filters and "Xem tất cả" on screen`, async ({ browser }) => {
      await asInvitee(
        browser,
        async ({ page }) => {
          await loadWithInbox(page, ROUTES.notifications);
          const route = panel(page);
          const box = await settledBox(route);
          const mentions = await filterRadio(route, NOTIF_FILTERS.mentions).boundingBox();
          const viewAll = await route.getByRole('button', { name: VIEW_ALL, exact: true }).boundingBox();
          const overflow = await horizontalOverflow(page);
          const tag = String(viewport.width);
          await captureEvidence(page, `E02_ntf_route_${tag}.png`, { caption: `panel x=${String(Math.round(box.x))} w=${String(Math.round(box.width))}; overflow ${String(overflow)} px` });
          await attachJson(`E02_ntf_route_${tag}.json`, { viewport, panel: box, mentions, viewAll, horizontalOverflowPx: overflow, bug: 'BUG-124' });

          // DRW:67,158-159: desktop drawer (≥ 1024, DRW:70) is 400 px wide with `my-2 mr-2`, inside `justify-end`.
          expect.soft(Math.round(box.width), 'panel width').toBe(400);
          expect.soft(Math.round(viewport.width - (box.x + box.width)), 'gap to the right edge').toBe(8);
          for (const [what, b] of [['"Nhắc đến tôi"', mentions], ['"Xem tất cả"', viewAll]] as const) {
            expect.soft(b !== null && b.x >= 0 && b.x + b.width <= viewport.width && b.y + b.height <= viewport.height, `${what} inside the viewport`).toBe(true);
          }
          expect(overflow, 'no horizontal scroll').toBeLessThanOrEqual(0);
        },
        viewport,
      );
    });
  }

  test('E02 · SCR-06 BUG-125/137: /thong-bao at 375 — after the slide the sheet spans the width at 90 % height, title on one line, snap targets ≥ 24 px', async ({ browser }) => {
    await asInvitee(
      browser,
      async ({ page }) => {
        await loadWithInbox(page, ROUTES.notifications);
        const sheet = panel(page); // DRW:70 → BottomSheet (DRW:195-233)
        const box = await settledBox(sheet);
        // BUG-192: `h3` also matches the empty state's title ("Không có thông báo mới"); the sheet's own heading is by name.
        const title = sheet.getByRole('heading', { name: NOTIF_TITLE, exact: true });
        // Lines of the title text: distinct tops of its client rects.
        const titleLines = await title.evaluate((el) => {
          const range = document.createRange();
          range.selectNodeContents(el);
          return new Set(Array.from(range.getClientRects()).map((r) => Math.round(r.top))).size;
        });
        const snaps = sheet.getByRole('group', { name: SHEET_GROUP, exact: true }).getByRole('button');
        const snapBoxes = await Promise.all([0, 1, 2].map((i) => snaps.nth(i).boundingBox()));
        const overflow = await horizontalOverflow(page);
        await captureEvidence(page, 'E02_ntf_route_375.png', { caption: `sheet y=${String(Math.round(box.y))} h=${String(Math.round(box.height))}; title lines ${String(titleLines)}` });
        await attachJson('E02_ntf_route_375.json', { viewport: COMPACT, sheet: box, titleLines, snapBoxes, horizontalOverflowPx: overflow });

        await expect(snaps.nth(2)).toHaveAccessibleName(snapButton(3));
        await expect(snaps.nth(2)).toHaveAttribute('aria-pressed', 'true'); // DRW:72 opens at level 2 ("Mức 3")
        expect.soft(Math.round(box.x), 'sheet left').toBe(0);
        expect.soft(Math.round(box.width), 'sheet width').toBe(COMPACT.width);
        expect.soft(Math.abs(box.height - Math.round(COMPACT.height * 0.9)), 'sheet 90 % (DRW:33)').toBeLessThanOrEqual(1);
        expect.soft(Math.abs(box.y + box.height - COMPACT.height), 'sheet bottom on the screen edge').toBeLessThanOrEqual(1);
        // NCC:223 isCompact → NC:295-299 stacks the header, so the title row has the full width.
        expect.soft(titleLines, '"Thông báo" on one line').toBe(1);
        for (const b of snapBoxes) expect.soft(b !== null && b.width >= MIN_TARGET_PX && b.height >= MIN_TARGET_PX, 'snap target ≥ 24 px (DRW:251)').toBe(true);
        expect(overflow, 'no horizontal scroll').toBeLessThanOrEqual(0);
      },
      COMPACT,
    );
  });
});

/* ================================================================= SCR-07 onboarding */

test.describe('E02 SCR-07 onboarding as a second real user (invitee)', () => {
  test('E02 · SCR-07 no project (real): greeting with the invitee name, "Tạo dự án" open, "Tải bản vẽ" / "Duyệt kết quả" locked with their reasons, flag not set', async ({ browser }) => {
    await asInvitee(browser, async ({ page, user }) => {
      const { json } = await navigateAndWaitForApi(page, () => page.goto(ROUTES.onboarding, { waitUntil: 'commit' }), 'GET', SUMMARIES_RE, [200]);
      expect(asList(asRecord(json, 'N1').items, 'N1 items'), 'precondition: the invitee is in no project').toEqual([]);

      await expect(greeting(page)).toHaveText(greetingFor(user.name)); // UWS:301-305 name first
      const create = page.getByRole('button', { name: ONBOARD.step1Action, exact: true });
      const upload = page.getByRole('button', { name: ONBOARD.step2Action, exact: true });
      const review = page.getByRole('button', { name: ONBOARD.step3Action, exact: true });
      await expect(create).toBeEnabled(); // UWS:346 card 1 open
      await expect(upload).toBeDisabled(); // UWS:347 locked without a project, WS:228
      await expect(upload).toHaveAccessibleDescription(ONBOARD.step2Locked); // UWS:373, WS:230,234-237
      await expect(review).toBeDisabled(); // UWS:348
      await expect(review).toHaveAccessibleDescription(ONBOARD.step3Locked); // UWS:385
      await expect(page.getByRole('button', { name: ONBOARD.finish, exact: true })).toHaveCount(0); // WS:316, UWS:451
      await expect(page.getByRole('listitem')).toHaveCount(3); // engineer, not viewer (UWS:391-395)
      await page.waitForTimeout(400); // cards stagger in with motion (WS:205-208, ≤ 48 ms delay + 180 ms)
      await captureEvidence(page, 'E02_onb_no_project.png', { caption: `invitee without project: card 1 open, 2/3 locked "${ONBOARD.step2Locked}" / "${ONBOARD.step3Locked}"` });

      // screenState 'empty' never sets the flag (UWS:294-297).
      const flag = await page.evaluate((key) => window.localStorage.getItem(key), `${WELCOME_SEEN_PREFIX}${user.id}`);
      expect(flag).toBeNull();
      await attachJson('E02_onb_no_project.json', { projects: 0, greeting: greetingFor(user.name), seenFlag: flag });
    });
  });

  test('E02 · SCR-07 the seen flag is per user: another user\'s flag does not hide the screen; "Bỏ qua" sets only this user\'s key; a direct load then redirects to /', async ({ browser }) => {
    await asInvitee(browser, async ({ page, user }) => {
      const other = (await adminApi()).userId; // e.g. the admin skipped it earlier in the same browser
      const otherKey = `${WELCOME_SEEN_PREFIX}${other}`;
      const ownKey = `${WELCOME_SEEN_PREFIX}${user.id}`;
      await loadWithInbox(page); // origin for localStorage
      await page.evaluate((key) => window.localStorage.setItem(key, 'true'), otherKey);

      await page.goto(ROUTES.onboarding); // WSC:136-142 reads `prefix + own id` only (UWS:169-187)
      await expect(greeting(page)).toHaveText(greetingFor(user.name));
      expect(pathname(page)).toBe(ROUTES.onboarding);

      await page.getByRole('button', { name: ONBOARD.skip, exact: true }).click(); // UWS:400-403
      await expect.poll(() => pathname(page)).toBe(ROUTES.dashboard);
      const keys = await page.evaluate(
        ([own, foreign]) => ({ own: window.localStorage.getItem(own), foreign: window.localStorage.getItem(foreign) }),
        [ownKey, otherKey] as const,
      );
      expect(keys).toEqual({ own: 'true', foreign: 'true' }); // UWS:190-198

      await page.goto(ROUTES.onboarding); // full load: Navigate replace → `/` (WSC:140)
      await expect.poll(() => pathname(page)).toBe(ROUTES.dashboard);
      await dashboardLoaded(page);
      await captureEvidence(page, 'E02_onb_flag_per_user.png', { caption: `/onboarding with ${ownKey}=true → redirected to /` });
      await attachJson('E02_onb_flag_per_user.json', { ownKey: 'set', foreignKeyUntouched: keys.foreign === 'true', afterDirectLoad: pathname(page) });
    });
  });

  test('E02 · SCR-07 BUG-127: at 375 the three quiet links follow DOM order by Tab and are ≥ 24 px targets; Enter on "Bỏ qua" leaves to /', async ({ browser }) => {
    await asInvitee(
      browser,
      async ({ page, user }) => {
        await page.goto(ROUTES.onboarding);
        await expect(greeting(page)).toHaveText(greetingFor(user.name));
        const sample = page.getByRole('button', { name: ONBOARD.sample, exact: true });
        const tutorial = page.getByRole('button', { name: ONBOARD.tutorial, exact: true });
        const skip = page.getByRole('button', { name: ONBOARD.skip, exact: true });
        await skip.scrollIntoViewIfNeeded();
        const boxes = { sample: await sample.boundingBox(), tutorial: await tutorial.boundingBox(), skip: await skip.boundingBox() };
        await captureEvidence(page, 'E02_onb_links_375.png', {
          fullPage: true,
          caption: Object.entries(boxes).map(([k, b]) => `${k}: ${b === null ? '—' : `${String(Math.round(b.width))}×${String(Math.round(b.height))}`}`).join(' · '),
        });
        await attachJson('E02_onb_links_375.json', { viewport: COMPACT, boxes, minTargetPx: MIN_TARGET_PX, bug: 'BUG-127' });
        for (const [what, b] of Object.entries(boxes)) {
          expect.soft(b !== null && b.height >= MIN_TARGET_PX && b.width >= MIN_TARGET_PX, `${what} target ≥ 24 × 24 px`).toBe(true);
        }

        // WS:325-341: sample → tutorial (aria-disabled stays in the Tab order, WS:149-157) → skip.
        await sample.focus();
        await page.keyboard.press('Tab');
        await expect(tutorial).toBeFocused();
        await page.keyboard.press('Tab');
        await expect(skip).toBeFocused();
        await page.keyboard.press('Enter');
        await expect.poll(() => pathname(page)).toBe(ROUTES.dashboard);
      },
      COMPACT,
    );
  });
});
