/**
 * Phase 8 - SCR-37 `/admin/users` READ side, MOCKED RESPONSES (QA-08 P10, flows-C4 FL-37U-M1..M4).
 * Every flow title carries `[mocked response]`: 5xx / 401 / 403 / slow / broken payload / "only me" cannot be produced
 * on the shared stack. Each flow ends with `unroute` (or its real pair): FL-37U-M1 last step is a real `GET /api/users` 200;
 * the real pairs of M2/M3/M4 are FL-37U-01, FL-37U-02 and FL-37U-U1 (phase08_users_edge / _ui).
 * Held responses use a promise (`deferred`), never a fixed wait (pattern of phase03_processing_mocked_edge).
 * Source (FE): UM UserManagement.tsx:53-57,106-116 (EMPTY_TITLE, ERROR_TITLE, retry), UMT UserManagementToolbar.tsx,
 * UMB UserManagementTable.tsx:199-310 (name button opens the panel), UMD UserManagementDetail.tsx:135-210 (regions),
 * UMH useUserManagement.ts:116 (ACTIVITY_LIMIT 10), :166-202 (activity labels), Table.tsx:235 (skeleton 8 x colSpan).
 *
 * ## Users
 * Admin seed (read only, never written) in the browser: `signInAdmin` = 1 UI login per flow (M1 two: after the 401).
 * `adminApi()` = 1 API login (setup: own row + the shared read-only engineer `p08-eng` row for M2/M3).
 * ## Request budget
 * `POST /api/auth/login`: 3 flows x (1 UI + 1 API) + M1 extra 1 + M4 (1 UI + 0 API) = 8 (limit 120 / 60 s per IP).
 * `POST /api/auth/refresh`: ~1 per page load (about 25 loads) + the real refresh the 401 of 37U-G-006 triggers.
 * `POST /api/users/invitations`: 0 (nothing is sent; the shared slot `p08-eng` exists or costs 1 from the admin seed).
 * Writes to the BE: none (every mutation-looking click is mocked or not reached).
 */
import { expect, test, type Locator, type Page } from '@playwright/test';

import { ROUTES } from '../../e2e/fixtures/routes';
import { signedInApi } from './support/api';
import { readAdminCredentials, signInAdmin } from './support/auth';
import { captureEvidence } from './support/evidence';
import { poolUser } from './support/p08/pool';
import { DESKTOP, DESKTOP_VIEWPORTS } from './support/p08/admin';
import { USERS_RE, deferred, detailRe, json, realUsers, requestLog, wireError, type Json } from './support/p08/P10';
import { verifyUi } from './support/ui-verify';

const T = {
  errorTitle: 'Không tải được danh sách người dùng', // UM:55
  retry: 'Thử lại', // UM:57
  emptyTitle: 'Chưa có người dùng nào khác', // UM:53
  emptyBody: 'Mới chỉ có mình bạn ở đây', // UMH:143
  invite: 'Mời người dùng', // UMT:31
  inviteEmails: 'Email người được mời', // UMT:33
  search: 'Tìm người dùng', // UMT:26
  detail: 'Chi tiết người dùng', // UMD:370
  noMemberships: 'Người này chưa tham gia dự án nào', // UMD:139
  noActivity: 'Chưa có hoạt động nào', // UMD:202
  disabledBadge: 'Đã vô hiệu hoá', // UMG STATUS_LABELS
  enable: 'Bật lại', // UMB:46
  disable: 'Vô hiệu hoá', // UMB:45
} as const;

const getList = (page: Page, status?: number) =>
  page.waitForResponse((r) => r.request().method() === 'GET' && USERS_RE.test(r.url()) && (status === undefined || r.status() === status));
const alertOf = (page: Page): Locator => page.getByRole('alert').filter({ hasText: T.errorTitle });
const rows = (page: Page): Locator => page.locator('tbody tr');
const summaryDigits = async (page: Page): Promise<string> =>
  (await page.locator('dl').filter({ hasText: 'Lời mời đang chờ' }).innerText()).replace(/\D+/gu, ' ').trim();

/** Own row (admin seed) and the shared read-only engineer row, from the real list. */
async function setupRows(): Promise<{ self: Json; peer: Json; peerName: string }> {
  const { email, password } = readAdminCredentials();
  const api = await signedInApi(email, password);
  try {
    const pe = await poolUser(api, 'engineer', 'p08-eng'); // packs.md S2 decision 1
    const users = await realUsers(api);
    const self = users.find((u) => u.email === email);
    const peer = users.find((u) => u.id === pe.id);
    if (self === undefined || peer === undefined) throw new Error('setup: admin or p08-eng missing from GET /api/users');
    return { self, peer, peerName: String(peer.name) };
  } finally {
    await api.dispose();
  }
}

test.describe('A08 SCR-37 users read, mocked responses', () => {
  test.use({ viewport: DESKTOP });

  test('SCR-37 · FL-37U-M1 · [mocked response] Lỗi đọc danh sách; cặp thật = bước cuối GET /api/users 200', async ({ page }) => {
    test.setTimeout(120_000);
    let mode: 'e500' | 'e403' | 'e401' | 'empty' | 'badrow' | 'boom' = 'e500';
    const reads = requestLog(page, 'GET', USERS_RE);
    await page.route(USERS_RE, (route) => {
      if (route.request().method() !== 'GET') return route.fallback();
      switch (mode) {
        case 'e500':
          return json(route, 500, wireError('INTERNAL'));
        case 'e403':
          return json(route, 403, wireError('FORBIDDEN'));
        case 'e401':
          return json(route, 401, wireError('UNAUTHENTICATED'));
        case 'empty':
          return json(route, 200, {});
        case 'badrow':
          return json(route, 200, { total: 1, users: [{ id: 'usr_x', email: 'x@example.test', name: 'X', status: 'active', projectCount: 0, lastActiveAt: null, zzzUnknown: true }] });
        default:
          // schema-valid (day 31 of February passes the zod datetime regex) but an Invalid Date when the row formats it
          return json(route, 200, { total: 1, users: [{ id: 'usr_boom', email: 'boom@example.test', name: 'Boom', role: 'viewer', status: 'active', projectCount: 0, lastActiveAt: '2026-02-31T10:00:00Z' }] });
      }
    });
    await signInAdmin(page, ROUTES.adminUsers);

    await test.step('[37U-B-004] GET /api/users 500 -> alert + describeError description', async () => {
      // cachePolicy.ts:81-84 retry.query = 1, but 5xx/429 belong to the HTTP client's own ladder (queryClient.ts shouldRetry, BUG-570):
      // the number of GETs per failure is not fixed, hence the '>= 1' counts below
      await expect(alertOf(page)).toBeVisible({ timeout: 20_000 });
      const text = (await alertOf(page).innerText()).replace(T.errorTitle, '').replace(T.retry, '').trim();
      expect(text.length, 'alert carries the describeError description').toBeGreaterThan(0);
      await captureEvidence(page, 'E08_37U-B-004_users.png');
    });

    await test.step('[37U-G-003] same 500 -> no skeleton, no table', async () => {
      expect.soft(await page.getByRole('table').count(), 'no table in the error state').toBe(0);
      expect.soft(await rows(page).count(), 'no skeleton rows').toBe(0);
      expect.soft(reads.count(), 'at least one read reached the mock').toBeGreaterThanOrEqual(1);
      await captureEvidence(page, 'E08_37U-G-003_users.png');
    });

    await test.step('[37U-B-008] toolbar stays in the error: search + 2 filters, summary 0/0/0', async () => {
      await expect.soft(page.getByLabel(T.search, { exact: true })).toBeVisible();
      await expect.soft(page.getByRole('combobox', { name: 'Vai', exact: true })).toBeVisible();
      await expect.soft(page.getByRole('combobox', { name: 'Trạng thái', exact: true })).toBeVisible();
      expect.soft(await summaryDigits(page)).toBe('0 0 0');
      await captureEvidence(page, 'E08_37U-B-008_users.png');
    });

    await test.step('[37U-B-006] "Thử lại" still 500 -> one alert, request count +', async () => {
      const before = reads.count();
      const next = getList(page);
      await page.getByRole('button', { name: T.retry, exact: true }).click();
      expect((await next).status()).toBe(500);
      await expect(alertOf(page)).toHaveCount(1, { timeout: 20_000 });
      expect.soft(reads.count(), 'retry sent at least one more GET').toBeGreaterThan(before);
      await captureEvidence(page, 'E08_37U-B-006_users.png');
    });

    await test.step('[37U-B-009] body {} (no users) -> error alert, not a blank screen', async () => {
      mode = 'empty';
      const next = getList(page, 200);
      await page.getByRole('button', { name: T.retry, exact: true }).click();
      await next;
      await expect.soft(alertOf(page)).toBeVisible({ timeout: 20_000 });
      expect.soft((await page.locator('body').innerText()).trim().length).toBeGreaterThan(0);
      await captureEvidence(page, 'E08_37U-B-009_users.png');
    });

    await test.step('[37U-G-008] row without role + unknown field -> alert (no broken row)', async () => {
      mode = 'badrow';
      const next = getList(page, 200);
      await page.getByRole('button', { name: T.retry, exact: true }).click();
      await next;
      await expect.soft(alertOf(page)).toBeVisible({ timeout: 20_000 });
      expect.soft(await rows(page).count()).toBe(0);
      await captureEvidence(page, 'E08_37U-G-008_users.png');
    });

    await test.step('[37U-G-004] 403 -> error alert, no stale list', async () => {
      mode = 'e403';
      const next = getList(page, 403);
      await page.getByRole('button', { name: T.retry, exact: true }).click();
      await next;
      await expect.soft(alertOf(page)).toBeVisible({ timeout: 20_000 });
      expect.soft(await rows(page).count()).toBe(0);
      await captureEvidence(page, 'E08_37U-G-004_users.png');
    });

    await test.step('[37U-G-006] 401 -> /login?next=%2Fadmin%2Fusers, no generic alert', async () => {
      mode = 'e401';
      await page.getByRole('button', { name: T.retry, exact: true }).click();
      await expect.soft(page).toHaveURL(/\/login\?next=%2Fadmin%2Fusers/u, { timeout: 20_000 });
      expect.soft(await alertOf(page).count(), 'no generic list alert on /login').toBe(0);
      await captureEvidence(page, 'E08_37U-G-006_users.png');
    });

    await test.step('[37U-B-010] payload that makes the row builder throw -> ScreenErrorBoundary with retry', async () => {
      mode = 'boom';
      await signInAdmin(page, ROUTES.adminUsers); // the 401 ended the session
      // zod (schemas/users.ts isoDateTimeSchema) rejects 31 February, so this payload ends in the READ-ERROR alert, not in the
      // boundary. No payload that passes the schema and makes buildRow throw was found (formatTimestamp datetime.ts:184-193 and
      // formatCalendarDate never throw): the boundary itself is NOT asserted. UNKNOWN — NEED VERIFICATION.
      test.info().annotations.push({ type: 'UNKNOWN', description: '37U-B-010: ScreenErrorBoundary not reachable from a schema-valid payload' });
      await expect.soft(alertOf(page), 'schema-invalid payload -> read-error alert').toBeVisible({ timeout: 20_000 });
      expect.soft(await page.getByRole('table').count()).toBe(0);
      await captureEvidence(page, 'E08_37U-B-010_users.png');
    });

    await test.step('[37U-B-005] unroute, real "Thử lại" -> GET /api/users 200 and the table replaces the alert', async () => {
      await page.unroute(USERS_RE);
      const real = getList(page, 200);
      await page.getByRole('button', { name: T.retry, exact: true }).click();
      expect((await real).status()).toBe(200);
      await expect.soft(page.getByRole('table')).toBeVisible();
      expect.soft(await alertOf(page).count()).toBe(0);
      reads.stop();
      await captureEvidence(page, 'E08_37U-B-005_users.png');
    });
  });

  test('SCR-37 · FL-37U-M2 · [mocked response] Loading và rỗng; cặp thật = FL-37U-01 bước 1', async ({ page }) => {
    test.setTimeout(120_000);
    const { self, peer, peerName } = await setupRows();
    const gate = deferred();
    let mode: 'slow' | 'self' | 'disabled' = 'slow';
    const writes = requestLog(page, 'POST', /\/api\/users\/invitations$/u);
    await page.route(USERS_RE, async (route) => {
      if (route.request().method() !== 'GET') return route.fallback();
      if (mode === 'slow') {
        await gate.promise;
        return json(route, 200, { total: 1, users: [self] });
      }
      if (mode === 'self') return json(route, 200, { total: 1, users: [self] });
      return json(route, 200, { total: 2, users: [self, { ...peer, status: 'disabled' }] });
    });
    try {
      await signInAdmin(page, ROUTES.adminUsers);

      await test.step('[37U-B-001] held list -> 8 skeleton rows x 6 columns, headers visible', async () => {
        await expect(rows(page)).toHaveCount(8);
        const spans = await rows(page).locator('td').evaluateAll((tds) => tds.map((td) => td.getAttribute('colspan')));
        expect(new Set(spans), 'one 6-wide cell per skeleton row').toEqual(new Set(['6']));
        await expect(page.locator('thead th')).toHaveCount(6);
        await captureEvidence(page, 'E08_37U-B-001_users.png');
        gate.release();
      });

      await test.step('[37U-B-002] only me -> EmptyState with title, teaching text and invite button', async () => {
        mode = 'self';
        const next = getList(page, 200);
        await page.goto(ROUTES.adminUsers);
        await next;
        await expect.soft(page.getByText(T.emptyTitle, { exact: true })).toBeVisible();
        await expect.soft(page.getByText(T.emptyBody)).toBeVisible();
        await expect.soft(page.getByRole('button', { name: T.invite, exact: true }).last()).toBeVisible();
        await captureEvidence(page, 'E08_37U-B-002_users.png');
      });

      await test.step('[37U-B-003] EmptyState "Mời người dùng" opens the email field (nothing sent)', async () => {
        await page.getByRole('button', { name: T.invite, exact: true }).last().click();
        await expect.soft(page.getByRole('textbox', { name: T.inviteEmails, exact: true })).toBeVisible();
        expect.soft(writes.count(), 'no POST /api/users/invitations').toBe(0);
        await captureEvidence(page, 'E08_37U-B-003_users.png');
      });

      await test.step('[37U-B-014] row with status disabled -> badge, "Bật lại", no "Vô hiệu hoá"', async () => {
        mode = 'disabled';
        const next = getList(page, 200);
        await page.goto(ROUTES.adminUsers);
        await next;
        const row = rows(page).filter({ hasText: String(peer.email) });
        await expect.soft(row.getByText(T.disabledBadge, { exact: true })).toBeVisible();
        await expect.soft(row.getByRole('button', { name: T.enable, exact: true })).toBeVisible();
        await expect.soft(row.getByRole('button', { name: T.disable, exact: true })).toHaveCount(0);
        await captureEvidence(page, 'E08_37U-B-014_users.png', { caption: `${peerName} shown as disabled (mock, not written)` });
      });
    } finally {
      gate.release();
      writes.stop();
      await page.unroute(USERS_RE);
    }
  });

  test('SCR-37 · FL-37U-M3 · [mocked response] Chi tiết: hoạt động nhiều, lỗi memberships/activity; cặp thật = FL-37U-02', async ({ page }) => {
    test.setTimeout(120_000);
    const { peer, peerName } = await setupRows();
    type Mode = 'ok' | 'slow' | '500' | '404';
    let memMode: Mode = 'ok';
    let actMode: Mode = 'ok';
    let actBody: Json[] = [];
    const gate = deferred();
    await page.route(detailRe('memberships'), async (route) => {
      if (memMode === 'slow') await gate.promise;
      if (memMode === '500') return json(route, 500, wireError('INTERNAL'));
      if (memMode === '404') return json(route, 404, wireError('NOT_FOUND'));
      return json(route, 200, []);
    });
    await page.route(detailRe('activity'), (route) =>
      actMode === '500' ? json(route, 500, wireError('INTERNAL')) : json(route, 200, actBody),
    );
    const panel = page.locator(`aside[aria-label="${T.detail}"]`);
    const memberships = panel.getByRole('region', { name: 'Dự án tham gia', exact: true });
    const activity = panel.getByRole('region', { name: 'Hoạt động gần đây', exact: true });
    /** Opens the peer's panel from a fresh page load (query cache is per load). */
    const openPeer = async (): Promise<void> => {
      await page.goto(ROUTES.adminUsers);
      const row = rows(page).filter({ hasText: String(peer.email) });
      await row.getByRole('button', { name: peerName, exact: true }).click();
      await expect(panel).toBeVisible();
    };
    const at = (i: number): string => new Date(Date.UTC(2026, 0, 1, 0, i)).toISOString();
    try {
      await signInAdmin(page, ROUTES.adminUsers);

      await test.step('[37U-A-024] 12 shuffled activity records -> exactly 10 items, newest first', async () => {
        // 12 records, order scrambled; kinds known (UMH:182-202)
        const order = [3, 11, 0, 7, 5, 9, 1, 10, 2, 8, 4, 6];
        actBody = order.map((i) => ({ id: `act_${String(i)}`, at: at(i), kind: 'project.create', objectCode: `OBJ-${String(i)}`, objectLabel: `Obj ${String(i)}` }));
        await openPeer();
        await expect(activity.getByRole('listitem')).toHaveCount(10);
        const first = await activity.getByRole('listitem').first().innerText();
        expect.soft(first, 'newest (OBJ-11) first').toContain('Obj 11');
        const last = await activity.getByRole('listitem').last().innerText();
        expect.soft(last, 'tenth newest (OBJ-2) last').toContain('Obj 2');
        await captureEvidence(page, 'E08_37U-A-024_users.png');
      });

      await test.step('[37U-A-025] kinds user.invite and zzz.x -> "Mời người dùng" and "Thao tác khác"', async () => {
        actBody = [
          { id: 'act_a', at: at(2), kind: 'user.invite', objectCode: 'U-1', objectLabel: 'Người A' },
          { id: 'act_b', at: at(1), kind: 'zzz.x', objectCode: 'U-2', objectLabel: 'Người B' },
        ];
        await openPeer();
        await expect.soft(activity.getByRole('listitem')).toHaveCount(2);
        await expect.soft(activity).toContainText('Mời người dùng');
        await expect.soft(activity).toContainText('Thao tác khác');
        await captureEvidence(page, 'E08_37U-A-025_users.png');
      });

      await test.step('[37U-B-017] memberships held -> a loading indicator, never the "no project" sentence', async () => {
        // ⚑ correct behaviour: red while the empty sentence flashes under a pending read
        memMode = 'slow';
        const seen = page.waitForRequest((r) => detailRe('memberships').test(r.url()));
        await page.goto(ROUTES.adminUsers);
        const row = rows(page).filter({ hasText: String(peer.email) });
        await row.getByRole('button', { name: peerName, exact: true }).click();
        await seen;
        await expect(panel).toBeVisible();
        await expect.soft(memberships.getByText(T.noMemberships), 'no empty sentence while pending').toHaveCount(0);
        // The region itself carries aria-busy (UserManagementDetail.tsx DetailMemberships; the Skeleton inside is decorative); a descendant-only locator never matches it (RR: not found).
        await expect.soft(memberships.and(page.locator('[aria-busy="true"]')).or(memberships.locator('[role="status"], [aria-busy="true"]')).first(), 'a loading indicator').toBeVisible();
        await captureEvidence(page, 'E08_37U-B-017_users.png');
        gate.release();
      });

      await test.step('[37U-B-015] memberships 500 -> read error, not "no project" (⚑)', async () => {
        memMode = '500';
        await openPeer();
        await expect.soft(memberships.getByText(T.noMemberships)).toHaveCount(0);
        await expect.soft(memberships.getByRole('alert').or(memberships.getByText(/không tải được|lỗi/iu)).first()).toBeVisible();
        await captureEvidence(page, 'E08_37U-B-015_users.png');
      });

      await test.step('[37U-G-005] memberships 404 -> error or panel closed, never the empty sentence (⚑)', async () => {
        memMode = '404';
        const answered = page.waitForResponse((x) => detailRe('memberships').test(x.url()) && x.status() === 404);
        await openPeer();
        await answered;
        await expect.soft(page.getByText(T.noMemberships)).toHaveCount(0);
        await expect
          .configure({ soft: true })
          .poll(async () => (await panel.count()) === 0 || (await panel.getByRole('alert').count()) > 0, { message: 'error alert in the panel, or the panel closed' })
          .toBe(true);
        await captureEvidence(page, 'E08_37U-G-005_users.png');
      });

      await test.step('[37U-B-016] activity 500 -> error, not "Chưa có hoạt động nào" (⚑)', async () => {
        memMode = 'ok';
        actMode = '500';
        await openPeer();
        await expect.soft(activity.getByText(T.noActivity)).toHaveCount(0);
        await expect.soft(activity.getByRole('alert').or(activity.getByText(/không tải được|lỗi/iu)).first()).toBeVisible();
        await captureEvidence(page, 'E08_37U-B-016_users.png');
      });
    } finally {
      gate.release();
      await page.unroute(detailRe('memberships'));
      await page.unroute(detailRe('activity'));
    }
  });

  test('SCR-37 · FL-37U-M4 · [mocked response] UI 4 khổ: lỗi, skeleton, rỗng; cặp thật = FL-37U-U1', async ({ page }) => {
    test.setTimeout(240_000);
    const { email, password } = readAdminCredentials();
    const api = await signedInApi(email, password);
    const self = (await realUsers(api)).find((u) => u.email === email);
    await api.dispose();
    if (self === undefined) throw new Error('setup: admin row missing from GET /api/users');
    const gate = deferred();
    let mode: 'e500' | 'slow' | 'self' = 'e500';
    await page.route(USERS_RE, async (route) => {
      if (route.request().method() !== 'GET') return route.fallback();
      if (mode === 'e500') return json(route, 500, wireError('INTERNAL'));
      if (mode === 'slow') {
        await gate.promise;
        return json(route, 200, { total: 1, users: [self] });
      }
      return json(route, 200, { total: 1, users: [self] });
    });
    try {
      await signInAdmin(page, ROUTES.adminUsers);

      await test.step('[37U-F-010] 500 -> alert + "Thử lại" compact at 4 widths', async () => {
        await verifyUi(
          page,
          'U08_37U-F-010_users_error',
          async (p) => {
            await p.goto(ROUTES.adminUsers);
            await expect(alertOf(p)).toBeVisible({ timeout: 20_000 });
            await expect(p.getByRole('button', { name: T.retry, exact: true })).toBeVisible();
          },
          DESKTOP_VIEWPORTS,
        );
        await expect(alertOf(page)).toBeVisible();
      });

      await test.step('[37U-F-011] held -> 8 x 6 skeleton at 4 widths', async () => {
        mode = 'slow';
        await verifyUi(
          page,
          'U08_37U-F-011_users_skeleton',
          async (p) => {
            await p.goto(ROUTES.adminUsers);
            await expect.soft(rows(p)).toHaveCount(8);
            await expect.soft(p.locator('thead th')).toHaveCount(6);
          },
          DESKTOP_VIEWPORTS,
        );
        gate.release();
      });

      await test.step('[37U-F-012] only me -> EmptyState + button at 4 widths', async () => {
        mode = 'self';
        await verifyUi(
          page,
          'U08_37U-F-012_users_empty',
          async (p) => {
            await p.goto(ROUTES.adminUsers);
            await expect.soft(p.getByText(T.emptyTitle, { exact: true })).toBeVisible();
            await expect.soft(p.getByRole('button', { name: T.invite, exact: true }).last()).toBeVisible();
          },
          DESKTOP_VIEWPORTS,
        );
      });

      await test.step('[37U-C-011] same empty payload at 1440 and 768 -> same title (⚑ 768 must keep the text)', async () => {
        const texts: string[] = [];
        for (const vp of [{ width: 1440, height: 900 }, { width: 768, height: 1024 }]) {
          await page.setViewportSize(vp);
          await page.goto(ROUTES.adminUsers);
          const title = page.getByText(T.emptyTitle, { exact: true });
          await expect.soft(title, `${String(vp.width)}px shows the title`).toBeVisible();
          texts.push(((await title.count()) > 0 ? await title.first().innerText() : '').trim());
        }
        expect.soft(texts[1]).toBe(texts[0]);
        await captureEvidence(page, 'E08_37U-C-011_users.png');
      });
    } finally {
      gate.release();
      await page.unroute(USERS_RE);
    }
  });
});
