/**
 * Phase 11 · users + session · API (flows-C3 FL-11U-A1..A4). Real backend. Only fresh users (invited per flow, deleted in
 * `finally`) and the pool slot `p11-session-api` are touched; every login here is a NEW session (own cookie jar).
 */
import { expect, test } from '@playwright/test';
import type { APIRequestContext, APIResponse } from '@playwright/test';

import { captureExchange, newApiContext, signedInApi } from './support/api';
import { readAdminCredentials } from './support/auth';
import { poolUser, type PoolUser } from './support/phase03Seed';
import { p11Slot } from './support/p11/common';
import { cleanAll, cookieHeader, disposeFreshUser, inviteEmail, inviteFreshUser } from './support/p11/P13';

const EVIL_ORIGIN = 'https://evil.example.test';
/** A `Set-Cookie` that deletes the cookie (Max-Age=0 or an Expires in 1970). */
const CLEARS_COOKIE = /max-age=0|expires=[^;]*1970/iu;

const adminApi = (): Promise<APIRequestContext> => {
  const creds = readAdminCredentials();
  return signedInApi(creds.email, creds.password);
};

const codeOf = async (res: { json: () => Promise<unknown> }): Promise<unknown> => ((await res.json()) as { code?: unknown }).code;

const setCookies = (res: { headersArray: () => { name: string; value: string }[] }): string[] =>
  res.headersArray().filter((header) => header.name.toLowerCase() === 'set-cookie').map((header) => header.value);

test.describe('users + session API', () => {
  test('api · FL-11U-A1 · admin · vô hiệu / bật lại / xoá trên user riêng', async () => {
    test.setTimeout(120_000);
    const admin = await adminApi();
    let fu: PoolUser | null = null;
    let reinvited: PoolUser | null = null;
    let deletedFu = false;
    try {
      fu = await inviteFreshUser(admin, 'engineer', 'api1');
      const user = fu;
      await test.step('[11U-G-181] POST disable {} → 200 status=disabled', async () => {
        const res = await admin.post(`/api/users/${user.id}/disable`, { data: {} });
        expect(res.status()).toBe(200);
        const body = (await captureExchange('A11_11U-G-181_disable.json', { method: 'POST', path: '/api/users/{id}/disable', body: {} }, res, ['200', 'status=disabled'])) as { status?: string };
        expect(body.status).toBe('disabled');
      });

      await test.step('[11U-G-182] disable lần 2 → 200, hoạt động không thêm dòng', async () => {
        const before = (await (await admin.get(`/api/users/${user.id}/activity`)).json()) as unknown[];
        const res = await admin.post(`/api/users/${user.id}/disable`, { data: {} });
        expect(res.status()).toBe(200);
        const after = await admin.get(`/api/users/${user.id}/activity`);
        expect(after.status()).toBe(200);
        expect(((await after.json()) as unknown[]).length).toBe(before.length);
        await captureExchange('A11_11U-G-182_disable-twice.json', { method: 'POST', path: '/api/users/{id}/disable', body: {} }, res, ['200', `activity rows unchanged (${String(before.length)})`]);
      });

      await test.step('[11U-G-183] POST enable → 200 status=active', async () => {
        const res = await admin.post(`/api/users/${user.id}/enable`, { data: {} });
        expect(res.status()).toBe(200);
        const body = (await captureExchange('A11_11U-G-183_enable.json', { method: 'POST', path: '/api/users/{id}/enable', body: {} }, res, ['200', 'status=active'])) as { status?: string };
        expect(body.status).toBe('active');
      });

      await test.step('[11U-G-184] DELETE {userId, confirmEmail} → 200 trả AdminUser', async () => {
        const res = await admin.delete(`/api/users/${user.id}`, { data: { userId: user.id, confirmEmail: user.email } });
        expect(res.status()).toBe(200);
        deletedFu = true;
        const body = (await captureExchange('A11_11U-G-184_delete.json', { method: 'DELETE', path: '/api/users/{id}', body: { userId: user.id, confirmEmail: user.email } }, res, ['200', 'AdminUser of the user before deletion'])) as { id?: string; email?: string };
        expect(body.id).toBe(user.id);
        expect(body.email).toBe(user.email);
      });

      await test.step('[11U-A-116] DELETE lần 2 → 404 NOT_FOUND', async () => {
        const res = await admin.delete(`/api/users/${user.id}`, { data: { userId: user.id, confirmEmail: user.email } });
        expect(res.status()).toBe(404);
        expect(await codeOf(res)).toBe('NOT_FOUND');
        await captureExchange('A11_11U-A-116_delete-twice.json', { method: 'DELETE', path: '/api/users/{id}', body: { userId: user.id, confirmEmail: user.email } }, res, ['404', 'code=NOT_FOUND']);
        const gone = await admin.get(`/api/users/${user.id}/memberships`);
        expect(gone.status(), 'deleted user: GET memberships').toBe(404);
      });

      await test.step('[11U-A-117] mời lại đúng email → 201', async () => {
        // BE users/router.py:55 — the email is released after a delete (deleted_at out of the email key)
        reinvited = await inviteEmail(admin, 'engineer', user.email, user.name);
        const again = await admin.get(`/api/users/${reinvited.id}/memberships`);
        expect(again.status(), 'new user with the released email exists').toBe(200);
        expect(reinvited.id).not.toBe(user.id);
      });
    } finally {
      await cleanAll([
        async () => { if (fu !== null) await disposeFreshUser(admin, fu, { deletedInFlow: deletedFu }); },
        async () => { if (reinvited !== null) await disposeFreshUser(admin, reinvited); },
        () => admin.dispose(),
      ]);
    }
  });

  test('api · FL-11U-A2 · engineer + ẩn danh · bị cấm', async () => {
    test.setTimeout(120_000);
    const admin = await adminApi();
    let fu: PoolUser | null = null;
    let engineerApi: APIRequestContext | null = null;
    let anon: APIRequestContext | null = null;
    try {
      fu = await inviteFreshUser(admin, 'engineer', 'api2');
      const user = fu;
      anon = await newApiContext();
      const anonApi = anon;
      const pu = await poolUser(admin, 'engineer', p11Slot('session-api'));
      engineerApi = await signedInApi(pu.email, pu.password);
      const delBody = { userId: user.id, confirmEmail: user.email };

      await test.step('[11U-D-153] engineer disable + DELETE → 403, user còn', async () => {
        // users/router.py:45 require_permission("user.manage")
        const off = await engineerApi!.post(`/api/users/${user.id}/disable`, { data: {} });
        expect(off.status()).toBe(403);
        expect(await codeOf(off)).toBe('FORBIDDEN');
        const del = await engineerApi!.delete(`/api/users/${user.id}`, { data: delBody });
        expect(del.status()).toBe(403);
        expect(await codeOf(del)).toBe('FORBIDDEN');
        await captureExchange('A11_11U-D-153_engineer-forbidden.json', { method: 'DELETE', path: '/api/users/{id}', body: delBody }, del, ['403 FORBIDDEN on disable and DELETE']);
        const still = await admin.get(`/api/users/${user.id}/memberships`);
        expect(still.status(), 'user untouched').toBe(200);
      });

      await test.step('[11U-D-154] ẩn danh disable + DELETE → 401', async () => {
        const off = await anonApi.post(`/api/users/${user.id}/disable`, { data: {} });
        expect(off.status()).toBe(401);
        expect(await codeOf(off)).toBe('UNAUTHENTICATED');
        const del = await anonApi.delete(`/api/users/${user.id}`, { data: delBody });
        expect(del.status()).toBe(401);
        expect(await codeOf(del)).toBe('UNAUTHENTICATED');
        await captureExchange('A11_11U-D-154_anonymous.json', { method: 'DELETE', path: '/api/users/{id}', body: delBody }, del, ['401 UNAUTHENTICATED on disable and DELETE']);
        const still = await admin.get(`/api/users/${user.id}/memberships`);
        expect(still.status(), 'user untouched').toBe(200);
      });
    } finally {
      await cleanAll([
        async () => { if (anon !== null) await anon.dispose(); },
        async () => { if (engineerApi !== null) await engineerApi.dispose(); },
        async () => { if (fu !== null) await disposeFreshUser(admin, fu); },
        () => admin.dispose(),
      ]);
    }
  });

  test('api · FL-11U-A3 · engineer · logout và refresh', async () => {
    test.setTimeout(120_000);
    const admin = await adminApi();
    const sessions: APIRequestContext[] = [];
    const replayers: APIRequestContext[] = [];
    /** Every replay of an old cookie gets its own empty-jar context (policy 12) and the cookie goes in by hand. */
    const replay = async (path: string, cookie: string): Promise<APIResponse> => {
      const ctx = await newApiContext();
      replayers.push(ctx);
      return ctx.post(path, { headers: { Cookie: cookie } });
    };
    try {
      const pu = await poolUser(admin, 'engineer', p11Slot('session-api'));
      // three NEW sessions (own cookie jars); the pool user is never disabled or password-changed
      const s1 = await signedInApi(pu.email, pu.password);
      sessions.push(s1);
      const s2 = await signedInApi(pu.email, pu.password);
      sessions.push(s2);
      const s3 = await signedInApi(pu.email, pu.password);
      sessions.push(s3);
      const s1Cookies = await cookieHeader(s1);
      const s2Cookies = await cookieHeader(s2);
      const s3Cookies = await cookieHeader(s3);
      let logout1: APIResponse | null = null;

      await test.step('[11U-G-342] logout với Origin lạ: 403 ORIGIN_MISMATCH + Set-Cookie xoá cookie, phiên KHÔNG thu hồi', async () => {
        // decided behaviour: AppBack/docs/charter/BE-00.md:246 ("403 vẫn kèm Set-Cookie xoá hai cookie (không thu hồi ở server)");
        // core/origin.py:53-56 (403 ORIGIN_MISMATCH); auth/router.py:288-293 clears cookies WITHOUT revoke_by_cookie
        const res = await s3.post('/api/auth/logout', { headers: { Origin: EVIL_ORIGIN } });
        expect(res.status()).toBe(403);
        expect(await codeOf(res)).toBe('ORIGIN_MISMATCH');
        const clears = setCookies(res).some((cookie) => CLEARS_COOKIE.test(cookie));
        const after = await replay('/api/auth/refresh', s3Cookies);
        await captureExchange('A11_11U-G-342_logout-evil-origin.json', { method: 'POST', path: '/api/auth/logout' }, res, ['403 ORIGIN_MISMATCH', `cookie cleared by response: ${String(clears)}`, `refresh with old cookie afterwards: ${String(after.status())} (session not revoked: 200)`]);
        expect(clears, 'Set-Cookie xoá cookie (BE-00.md:246)').toBe(true);
        expect(setCookies(res).filter((cookie) => CLEARS_COOKIE.test(cookie)).length, 'cả hai cookie bị xoá').toBeGreaterThanOrEqual(2);
        expect(after.status(), 'refresh token vẫn sống: phiên không bị thu hồi').toBe(200);
      });

      await test.step('[11U-A-309] S1 logout; phiên S2 vẫn refresh được', async () => {
        logout1 = await s1.post('/api/auth/logout');
        // /api/me with cookie only is always 401 (core/routing.py:130-133): the evidence is a refresh of the other session
        const alive = await replay('/api/auth/refresh', s2Cookies);
        expect(alive.status()).toBe(200);
        await captureExchange('A11_11U-A-309_other-session-alive.json', { method: 'POST', path: '/api/auth/refresh' }, alive, ['200 for the second session after the first logged out']);
      });

      await test.step('[11U-G-341] logout S1 → 204 và Set-Cookie xoá cả hai cookie', async () => {
        expect(logout1!.status()).toBe(204);
        const cookies = setCookies(logout1!);
        expect(cookies.length, 'two Set-Cookie headers').toBeGreaterThanOrEqual(2);
        for (const cookie of cookies) expect(cookie).toMatch(CLEARS_COOKIE);
        await captureExchange('A11_11U-G-341_logout-cookies.json', { method: 'POST', path: '/api/auth/logout' }, logout1!, ['204', 'both cookies expired']);
      });

      await test.step('[11U-A-308] refresh với cookie cũ của S1 → 401 SESSION_REVOKED', async () => {
        // oracle: auth/sessions.py:449-453 (row kept, revoked_at set → RefreshDenied SESSION_REVOKED)
        const res = await replay('/api/auth/refresh', s1Cookies);
        expect(res.status()).toBe(401);
        expect(await codeOf(res)).toBe('SESSION_REVOKED');
        await captureExchange('A11_11U-A-308_old-refresh.json', { method: 'POST', path: '/api/auth/refresh' }, res, ['401 SESSION_REVOKED']);
      });

      await test.step('[11U-A-310] logout lặp với cookie đã thu hồi → 204', async () => {
        const res = await replay('/api/auth/logout', s1Cookies);
        expect(res.status()).toBe(204);
        await captureExchange('A11_11U-A-310_logout-twice.json', { method: 'POST', path: '/api/auth/logout' }, res, ['204 idempotent']);
      });
    } finally {
      await cleanAll([...replayers, ...sessions, admin].map((ctx) => () => ctx.dispose()));
    }
  });

  test('api · FL-11U-A4 · user thường · DELETE /api/me và GET /api/me/sessions chưa có', async () => {
    test.setTimeout(90_000);
    const admin = await adminApi();
    let fuApi: APIRequestContext | null = null;
    try {
      // pool user, no invite (rate limit 30/h per admin): both calls are read-only while the routes do not exist
      const fu = await poolUser(admin, 'engineer', p11Slot('session-api'));
      const api = await signedInApi(fu.email, fu.password);
      fuApi = api;
      await test.step('[11U-G-211] DELETE /api/me → 404|405, GET /api/me/sessions → 404', async () => {
        // MR (users/me router) only has GET/PATCH /me and PUT /me/avatar
        const del = await api.delete('/api/me');
        const sessions = await api.get('/api/me/sessions');
        // oracle: catalog-C3:122 (404 hoặc 405); core/errors.py:54-57 maps 404 and 405 to NOT_FOUND
        expect([404, 405], `DELETE /api/me → ${del.status()}`).toContain(del.status());
        expect(await codeOf(del)).toBe('NOT_FOUND');
        expect(sessions.status()).toBe(404);
        expect(await codeOf(sessions)).toBe('NOT_FOUND');
        await captureExchange('A11_11U-G-211_me-sessions.json', { method: 'GET', path: '/api/me/sessions' }, sessions, ['404 NOT_FOUND', `DELETE /api/me is ${del.status()} NOT_FOUND`]);
      });
    } finally {
      await cleanAll([
        async () => { if (fuApi !== null) await fuApi.dispose(); },
        () => admin.dispose(),
      ]);
    }
  });
});
