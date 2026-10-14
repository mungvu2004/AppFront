/**
 * Phase 11 (QA-11 P14): destructive BE API flows FL-B11-01..04 - floors, project, members, users.
 * Pure `request` layer (no browser). Every victim is created by its own flow on a private project / invited user and
 * cleaned in `finally`. Main chain (`runtime-session.json`, CP-2, `admin.storage.json`) is never touched.
 * Sources: floors/router.py:30-50, project_members/router.py:73-80, users/router.py:49-100, core/routing.py (Idempotency-Key),
 * auth/router.py (login), core/errors.py (W7 body: code/resource).
 */
import { expect, test, type APIRequestContext } from '@playwright/test';

import { newApiContext, signedInApi } from './support/api';
import { addProjectMember, createProject, listFloors, poolUser } from './support/phase03Seed';
import { bogusFloorId } from './support/p03/P10';
import { p11Slot } from './support/p11/common';
import { adminApi, asObj, bodyOf, cleanProject, deleteVictim, evi, idemKey, inviteAcceptedUser, runCleanups, send, type VictimUser } from './support/p11/P14';

const IDS = (rows: unknown[]): string[] => rows.map((r) => String(asObj(r).id));

test.describe('Phase 11 · destroy API (floors, project, members, users)', () => {
  test('SCR-API · FL-B11-01 · admin · Xoá tầng, hoàn tác, xoá lại, xoá song song', async () => {
    test.setTimeout(120_000);
    const admin = await adminApi();
    const anon = await newApiContext();
    const project = await createProject(admin, 'flr', 3);
    const pid = project.projectId;
    const [f1, f2, f3] = project.floors.map((f) => f.id) as [string, string, string];
    let f1Body: Record<string, unknown> = {};
    const floorsPath = `/api/projects/${pid}/floors`;
    try {
      await test.step('[B11-flr-000] seed: 3 floors', async () => {
        const res = await admin.get(floorsPath);
        await evi('B11-flr-000', '', 'GET', floorsPath, null, res, ['seed: 3 floors']);
        expect(res.status()).toBe(200);
        expect(((await res.json()) as unknown[]).length).toBe(3);
      });

      await test.step('[B11-flr-005] anonymous DELETE floor -> 401 UNAUTHENTICATED, list unchanged', async () => {
        const res = await send(anon, 'DELETE', `/api/floors/${f3}`);
        await evi('B11-flr-005', '', 'DELETE', `/api/floors/${f3}`, null, res, ['401 UNAUTHENTICATED; 3 floors remain']);
        expect.soft(res.status()).toBe(401);
        expect.soft((await bodyOf(res)).code).toBe('UNAUTHENTICATED');
        const list = (await (await admin.get(floorsPath)).json()) as unknown[];
        expect.soft(list.length).toBe(3);
      });

      await test.step('[B11-flr-018] two parallel DELETE of the same floor -> {200, 404}, no 5xx', async () => {
        const [a, b] = await Promise.all([send(admin, 'DELETE', `/api/floors/${f1}`), send(admin, 'DELETE', `/api/floors/${f1}`)]);
        await evi('B11-flr-018', 'a', 'DELETE', `/api/floors/${f1}`, null, a, ['one of {200,404}']);
        await evi('B11-flr-018', 'b', 'DELETE', `/api/floors/${f1}`, null, b, ['one of {200,404}']);
        expect.soft([a.status(), b.status()].sort()).toEqual([200, 404]);
        const ok = a.status() === 200 ? a : b;
        f1Body = await bodyOf(ok);
      });

      await test.step('[B11-flr-009] floor list: no F1, F2+F3 in order', async () => {
        const res = await admin.get(floorsPath);
        await evi('B11-flr-009', '', 'GET', floorsPath, null, res, ['F1 gone; F2,F3 by order']);
        expect.soft(res.status()).toBe(200);
        const rows = ((await res.json()) as unknown[]).map(asObj).sort((x, y) => Number(x.order) - Number(y.order));
        expect.soft(IDS(rows)).toEqual([f2, f3]);
      });

      await test.step('[B11-flr-010] GET spatial of deleted floor -> 404', async () => {
        const path = `${floorsPath}/${f1}/spatial`;
        const res = await admin.get(path);
        const body = await bodyOf(res);
        await evi('B11-flr-010', '', 'GET', path, null, res, [`404 (resource=${String(body.resource)} recorded)`]);
        expect.soft(res.status()).toBe(404);
        expect.soft(body.code).toBe('NOT_FOUND');
      });

      await test.step('[B11-flr-011] GET quality of deleted floor -> 404 NOT_FOUND resource floor', async () => {
        const path = `${floorsPath}/${f1}/quality`;
        const res = await admin.get(path);
        const body = await bodyOf(res);
        await evi('B11-flr-011', '', 'GET', path, null, res, ['404 NOT_FOUND resource floor']);
        expect.soft(res.status()).toBe(404);
        expect.soft(body.code).toBe('NOT_FOUND');
        expect.soft(body.resource).toBe('floor');
      });

      await test.step('[B11-flr-017] re-create F1 with its old body (same id) -> 201, listed; DELETE -> 200', async () => {
        const data = {
          id: f1,
          name: f1Body.name,
          order: f1Body.order,
          elevationMm: f1Body.elevationMm,
          heightMm: f1Body.heightMm,
        };
        const created = await send(admin, 'POST', floorsPath, data);
        await evi('B11-flr-017', 'post', 'POST', floorsPath, data, created, ['201 same id']);
        expect.soft(created.status()).toBe(201);
        expect.soft((await bodyOf(created)).id).toBe(f1);
        const list = (await (await admin.get(floorsPath)).json()) as unknown[];
        expect.soft(IDS(list)).toContain(f1);
        const del = await send(admin, 'DELETE', `/api/floors/${f1}`);
        await evi('B11-flr-017', 'delete', 'DELETE', `/api/floors/${f1}`, null, del, ['200']);
        expect.soft(del.status()).toBe(200);
      });

      await test.step('[B11-flr-019] DELETE F2 twice with the same Idempotency-Key -> 200 identical, F2 gone', async () => {
        const key = idemKey('flr');
        const one = await send(admin, 'DELETE', `/api/floors/${f2}`, undefined, { 'Idempotency-Key': key });
        const two = await send(admin, 'DELETE', `/api/floors/${f2}`, undefined, { 'Idempotency-Key': key });
        await evi('B11-flr-019', 'first', 'DELETE', `/api/floors/${f2}`, null, one, ['200']);
        await evi('B11-flr-019', 'replay', 'DELETE', `/api/floors/${f2}`, null, two, ['200 same body as first']);
        expect.soft(one.status()).toBe(200);
        expect.soft(two.status()).toBe(200);
        expect.soft(await two.json()).toEqual(await one.json());
        const list = (await (await admin.get(floorsPath)).json()) as unknown[];
        expect.soft(IDS(list).filter((id) => id === f2)).toHaveLength(0);
      });

      await test.step('[B11-flr-020] "delete all floors" loop [F3, bogus] -> 200 then 404 floor; no rollback', async () => {
        const bogus = bogusFloorId();
        const ok = await send(admin, 'DELETE', `/api/floors/${f3}`);
        const ghost = await send(admin, 'DELETE', `/api/floors/${bogus}`);
        await evi('B11-flr-020', 'f3', 'DELETE', `/api/floors/${f3}`, null, ok, ['200']);
        await evi('B11-flr-020', 'bogus', 'DELETE', `/api/floors/${bogus}`, null, ghost, ['404 resource floor']);
        expect.soft(ok.status()).toBe(200);
        expect.soft(ghost.status()).toBe(404);
        expect.soft((await bodyOf(ghost)).resource).toBe('floor');
        expect.soft(await listFloors(admin, pid)).toHaveLength(0);
      });
    } finally {
      await runCleanups([() => cleanProject(admin, pid), () => anon.dispose(), () => admin.dispose()]);
    }
  });

  test('SCR-API · FL-B11-02 · admin · Xoá dự án và hậu quả dây chuyền', async () => {
    test.setTimeout(150_000);
    const admin = await adminApi();
    const anon = await newApiContext();
    const p1 = await createProject(admin, 'prj', 2);
    const p2 = await createProject(admin, 'prj2', 1);
    const pid = p1.projectId;
    const floor = p1.floors[0]!;
    const viewer = await poolUser(admin, 'viewer', p11Slot('destroy-api'));
    await addProjectMember(admin, pid, viewer.email);
    const v: APIRequestContext = await signedInApi(viewer.email, viewer.password);
    const gone = async (api: APIRequestContext, method: 'GET' | 'POST' | 'PUT', path: string, data?: unknown) => {
      const res = await send(api, method, path, data);
      return { res, body: await bodyOf(res) };
    };
    try {
      await test.step('[B11-prj-000] seed: GET P1 = 200 for admin and viewer', async () => {
        const a = await admin.get(`/api/projects/${pid}`);
        const b = await v.get(`/api/projects/${pid}`);
        await evi('B11-prj-000', 'admin', 'GET', `/api/projects/${pid}`, null, a, ['200']);
        await evi('B11-prj-000', 'viewer', 'GET', `/api/projects/${pid}`, null, b, ['200']);
        expect(a.status()).toBe(200);
        expect(b.status()).toBe(200);
      });

      await test.step('[B11-prj-007] anonymous DELETE project -> 401; P1 still 200', async () => {
        const res = await send(anon, 'DELETE', `/api/projects/${pid}`);
        await evi('B11-prj-007', '', 'DELETE', `/api/projects/${pid}`, null, res, ['401; P1 still readable']);
        expect.soft(res.status()).toBe(401);
        expect.soft((await admin.get(`/api/projects/${pid}`)).status()).toBe(200);
      });

      await test.step('[B11-prj-020] two parallel DELETE of P2 -> {200, 404}', async () => {
        const path = `/api/projects/${p2.projectId}`;
        const [a, b] = await Promise.all([send(admin, 'DELETE', path), send(admin, 'DELETE', path)]);
        await evi('B11-prj-020', 'a', 'DELETE', path, null, a, ['{200,404}']);
        await evi('B11-prj-020', 'b', 'DELETE', path, null, b, ['{200,404}']);
        expect.soft([a.status(), b.status()].sort()).toEqual([200, 404]);
      });

      await test.step('[B11-prj-021] DELETE P1 twice with the same Idempotency-Key -> 200, identical, has P1 name', async () => {
        const key = idemKey('prj');
        const path = `/api/projects/${pid}`;
        const one = await send(admin, 'DELETE', path, undefined, { 'Idempotency-Key': key });
        const two = await send(admin, 'DELETE', path, undefined, { 'Idempotency-Key': key });
        await evi('B11-prj-021', 'first', 'DELETE', path, null, one, ['200']);
        await evi('B11-prj-021', 'replay', 'DELETE', path, null, two, ['200 same body']);
        expect.soft(one.status()).toBe(200);
        expect.soft(two.status()).toBe(200);
        const first = await one.json();
        expect.soft(await two.json()).toEqual(first);
        expect.soft(asObj(first).name).toBe(p1.name);
      });

      await test.step('[B11-prj-010] GET P1 (admin, viewer) -> 404 NOT_FOUND project', async () => {
        for (const [who, api] of [['admin', admin], ['viewer', v]] as const) {
          const { res, body } = await gone(api, 'GET', `/api/projects/${pid}`);
          await evi('B11-prj-010', who, 'GET', `/api/projects/${pid}`, null, res, ['404 NOT_FOUND project']);
          expect.soft(res.status(), who).toBe(404);
          expect.soft(body.code, who).toBe('NOT_FOUND');
          expect.soft(body.resource, who).toBe('project');
        }
      });

      await test.step('[B11-prj-011] project lists exclude P1 (admin, viewer)', async () => {
        for (const [who, api] of [['admin', admin], ['viewer', v]] as const) {
          for (const path of ['/api/projects', '/api/project-summaries']) {
            const res = await api.get(path);
            await evi('B11-prj-011', `${who}${path.replace(/\W+/gu, '-')}`, 'GET', path, null, res, ['200 without P1']);
            expect.soft(res.status(), `${who} ${path}`).toBe(200);
            expect.soft(JSON.stringify(await res.json()), `${who} ${path}`).not.toContain(pid);
          }
        }
      });

      await test.step('[B11-prj-012] GET and POST floors of P1 -> 404 project', async () => {
        const path = `/api/projects/${pid}/floors`;
        const data = { id: bogusFloorId(), name: 'Tầng x', order: 5, elevationMm: 15_000, heightMm: 3_000 };
        const g = await gone(admin, 'GET', path);
        const p = await gone(admin, 'POST', path, data);
        await evi('B11-prj-012', 'get', 'GET', path, null, g.res, ['404 project']);
        await evi('B11-prj-012', 'post', 'POST', path, data, p.res, ['404 project']);
        for (const r of [g, p]) {
          expect.soft(r.res.status()).toBe(404);
          expect.soft(r.body.resource).toBe('project');
        }
      });

      await test.step('[B11-prj-013] spatial and quality of a floor of P1 -> 404 project', async () => {
        for (const leaf of ['spatial', 'quality']) {
          const path = `/api/projects/${pid}/floors/${floor.id}/${leaf}`;
          const { res, body } = await gone(admin, 'GET', path);
          await evi('B11-prj-013', leaf, 'GET', path, null, res, ['404 project']);
          expect.soft(res.status(), leaf).toBe(404);
          expect.soft(body.resource, leaf).toBe('project');
        }
      });

      await test.step('[B11-prj-014] settings and rule-config (GET, PUT) of P1 -> 404 project', async () => {
        const put = { baseVersion: 0, body: { overrides: {} } };
        const cases = [
          ['settings', 'GET', `/api/projects/${pid}/settings`, undefined],
          ['rule-get', 'GET', `/api/projects/${pid}/rule-config`, undefined],
          ['rule-put', 'PUT', `/api/projects/${pid}/rule-config`, put],
        ] as const;
        for (const [tag, method, path, data] of cases) {
          const { res, body } = await gone(admin, method, path, data);
          await evi('B11-prj-014', tag, method, path, data, res, ['404 project']);
          expect.soft(res.status(), tag).toBe(404);
          expect.soft(body.resource, tag).toBe('project');
        }
      });

      await test.step('[B11-prj-019] project spatial and versions of P1 -> 404 project', async () => {
        for (const leaf of ['spatial', 'versions']) {
          const path = `/api/projects/${pid}/${leaf}`;
          const { res, body } = await gone(admin, 'GET', path);
          await evi('B11-prj-019', leaf, 'GET', path, null, res, ['404 project']);
          expect.soft(res.status(), leaf).toBe(404);
          expect.soft(body.resource, leaf).toBe('project');
        }
      });

      await test.step('[B11-prj-023] viewer session intact: /api/me and /api/projects 200, no P1', async () => {
        const me = await v.get('/api/me');
        const list = await v.get('/api/projects');
        await evi('B11-prj-023', 'me', 'GET', '/api/me', null, me, ['200']);
        await evi('B11-prj-023', 'projects', 'GET', '/api/projects', null, list, ['200 without P1']);
        expect.soft(me.status()).toBe(200);
        expect.soft(list.status()).toBe(200);
        expect.soft(JSON.stringify(await list.json())).not.toContain(pid);
      });
    } finally {
      await runCleanups([
        () => cleanProject(admin, pid),
        () => cleanProject(admin, p2.projectId),
        () => v.dispose(),
        () => anon.dispose(),
        () => admin.dispose(),
      ]);
    }
  });

  test('SCR-API · FL-B11-03 · admin · Gỡ thành viên', async () => {
    test.setTimeout(120_000);
    const admin = await adminApi();
    const anon = await newApiContext();
    const project = await createProject(admin, 'mem', 1);
    const pid = project.projectId;
    const floor = project.floors[0]!;
    const viewer = await poolUser(admin, 'viewer', p11Slot('destroy-api'));
    await addProjectMember(admin, pid, viewer.email);
    const v = await signedInApi(viewer.email, viewer.password);
    const member = `/api/projects/${pid}/members/${viewer.id}`;
    try {
      await test.step('[B11-mem-000] seed: member can GET the project', async () => {
        const res = await v.get(`/api/projects/${pid}`);
        await evi('B11-mem-000', '', 'GET', `/api/projects/${pid}`, null, res, ['200 as member']);
        expect(res.status()).toBe(200);
      });

      await test.step('[B11-mem-009] anonymous DELETE member -> 401; member still reads project', async () => {
        const res = await send(anon, 'DELETE', member);
        await evi('B11-mem-009', '', 'DELETE', member, null, res, ['401']);
        expect.soft(res.status()).toBe(401);
        expect.soft((await v.get(`/api/projects/${pid}`)).status()).toBe(200);
      });

      await test.step('[B11-mem-013] admin DELETE member twice with the same key -> 200 UserOut identical', async () => {
        const key = idemKey('mem');
        const one = await send(admin, 'DELETE', member, undefined, { 'Idempotency-Key': key });
        const two = await send(admin, 'DELETE', member, undefined, { 'Idempotency-Key': key });
        await evi('B11-mem-013', 'first', 'DELETE', member, null, one, ['200 UserOut']);
        await evi('B11-mem-013', 'replay', 'DELETE', member, null, two, ['200 same body']);
        expect.soft(one.status()).toBe(200);
        expect.soft(two.status()).toBe(200);
        const first = asObj(await one.json());
        expect.soft(Object.keys(first).sort()).toEqual(['email', 'id', 'name', 'role']);
        expect.soft(first.id).toBe(viewer.id);
        expect.soft(await two.json()).toEqual(first);
      });

      await test.step('[B11-mem-010] DELETE member again without key -> 404 resource member', async () => {
        const res = await send(admin, 'DELETE', member);
        const body = await bodyOf(res);
        await evi('B11-mem-010', '', 'DELETE', member, null, res, ['404 member']);
        expect.soft(res.status()).toBe(404);
        expect.soft(body.resource).toBe('member');
      });

      await test.step('[B11-mem-011] removed member: GET floors, PATCH floor spatial -> 404 project (not 403)', async () => {
        const get = await v.get(`/api/projects/${pid}/floors`);
        const patchPath = `/api/projects/${pid}/floors/${floor.id}/spatial`;
        const patchData = { name: floor.name };
        const patch = await send(v, 'PATCH', patchPath, patchData);
        await evi('B11-mem-011', 'get', 'GET', `/api/projects/${pid}/floors`, null, get, ['404 project']);
        await evi('B11-mem-011', 'patch', 'PATCH', patchPath, patchData, patch, ['404 project']);
        for (const res of [get, patch]) {
          expect.soft(res.status()).toBe(404);
          expect.soft((await bodyOf(res)).resource).toBe('project');
        }
      });

      await test.step('[B11-mem-012] removed member: /api/me and /api/projects 200, no project; session alive', async () => {
        const me = await v.get('/api/me');
        const list = await v.get('/api/projects');
        await evi('B11-mem-012', 'me', 'GET', '/api/me', null, me, ['200']);
        await evi('B11-mem-012', 'projects', 'GET', '/api/projects', null, list, ['200 without project']);
        expect.soft(me.status()).toBe(200);
        expect.soft(list.status()).toBe(200);
        expect.soft(JSON.stringify(await list.json())).not.toContain(pid);
      });
    } finally {
      await runCleanups([() => cleanProject(admin, pid), () => v.dispose(), () => anon.dispose(), () => admin.dispose()]);
    }
  });

  test('SCR-API · FL-B11-04 · admin · Vô hiệu, bật lại, xoá người dùng', async () => {
    test.setTimeout(180_000);
    const admin = await adminApi();
    const anon = await newApiContext();
    let u1: VictimUser | undefined;
    let u2: VictimUser | undefined;
    let s1: APIRequestContext | undefined;
    let oldCookie = '';
    const fresh: APIRequestContext[] = [];
    // every login runs in its own empty-jar context so `anon` stays anonymous for later steps (policy 12)
    const login = async (user: { email: string; password: string }) => {
      const ctx = await newApiContext();
      fresh.push(ctx);
      return { ctx, res: await ctx.post('/api/auth/login', { data: { email: user.email, password: user.password, rememberMe: false } }) };
    };
    const delBody = (u: { id: string; email: string }) => ({ userId: u.id, confirmEmail: u.email });
    try {
      u1 = await inviteAcceptedUser(admin, 'viewer', 'p11-destroy-u1');
      u2 = await inviteAcceptedUser(admin, 'viewer', 'p11-destroy-u2');
      s1 = await signedInApi(u1.email, u1.password);
      oldCookie = (await s1.storageState()).cookies.map((c) => `${c.name}=${c.value}`).join('; ');
      const [a, b] = [u1, u2];
      await test.step('[B11-usr-000] seed: both users exist (memberships 200)', async () => {
        for (const u of [a, b]) {
          const res = await admin.get(`/api/users/${u.id}/memberships`);
          await evi('B11-usr-000', u === a ? 'u1' : 'u2', 'GET', `/api/users/${u.id}/memberships`, null, res, ['200']);
          expect(res.status()).toBe(200);
        }
      });

      await test.step('[B11-usr-007] anonymous disable / enable / delete U2 -> 401 x3; U2 untouched', async () => {
        const calls = [
          ['disable', 'POST', `/api/users/${b.id}/disable`, {}],
          ['enable', 'POST', `/api/users/${b.id}/enable`, {}],
          ['delete', 'DELETE', `/api/users/${b.id}`, delBody(b)],
        ] as const;
        for (const [tag, method, path, data] of calls) {
          const res = await send(anon, method, path, data);
          await evi('B11-usr-007', tag, method, path, data, res, ['401']);
          expect.soft(res.status(), tag).toBe(401);
        }
        expect.soft((await admin.get(`/api/users/${b.id}/memberships`)).status()).toBe(200);
      });

      await test.step('[B11-usr-013] disable U2 then login -> 403, no cookie', async () => {
        const off = await send(admin, 'POST', `/api/users/${b.id}/disable`, {});
        expect(off.status()).toBe(200);
        const { res } = await login(b);
        await evi('B11-usr-013', '', 'POST', '/api/auth/login', { email: b.email }, res, ['403 ACCOUNT_DISABLED, no set-cookie']);
        expect.soft(res.status()).toBe(403);
        expect.soft((await bodyOf(res)).code).toBe('ACCOUNT_DISABLED');
        expect.soft(res.headers()['set-cookie']).toBeUndefined();
      });

      await test.step('[B11-usr-012] enable U2 then login -> 204, refresh 200', async () => {
        const on = await send(admin, 'POST', `/api/users/${b.id}/enable`, {});
        expect(on.status()).toBe(200);
        const { ctx, res } = await login(b);
        await evi('B11-usr-012', 'login', 'POST', '/api/auth/login', { email: b.email }, res, ['204']);
        expect.soft(res.status()).toBe(204);
        const refreshed = await ctx.post('/api/auth/refresh');
        await evi('B11-usr-012', 'refresh', 'POST', '/api/auth/refresh', null, refreshed, ['200 new session']);
        expect.soft(refreshed.status()).toBe(200);
      });

      const key = idemKey('usr');
      const delPath = `/api/users/${a.id}`;
      await test.step('[B11-usr-030] DELETE U1 key K -> 200; same K other confirmEmail -> 422 IDEMPOTENCY_KEY_REUSED', async () => {
        const one = await send(admin, 'DELETE', delPath, delBody(a), { 'Idempotency-Key': key });
        await evi('B11-usr-030', 'first', 'DELETE', delPath, delBody(a), one, ['200']);
        expect(one.status()).toBe(200);
        const other = { userId: a.id, confirmEmail: `other-${a.email}` };
        const two = await send(admin, 'DELETE', delPath, other, { 'Idempotency-Key': key });
        await evi('B11-usr-030', 'reused', 'DELETE', delPath, other, two, ['422 IDEMPOTENCY_KEY_REUSED']);
        expect.soft(two.status()).toBe(422);
        expect.soft((await bodyOf(two)).code).toBe('IDEMPOTENCY_KEY_REUSED');
      });

      await test.step('[B11-usr-029] DELETE U1 again with key K and original body -> 200 stored copy (not 404)', async () => {
        const res = await send(admin, 'DELETE', delPath, delBody(a), { 'Idempotency-Key': key });
        await evi('B11-usr-029', '', 'DELETE', delPath, delBody(a), res, ['200 stored response']);
        expect.soft(res.status()).toBe(200);
      });

      await test.step('[B11-usr-026] login as deleted U1 -> rejected (401/403), no cookie', async () => {
        const { res } = await login(a);
        await evi('B11-usr-026', '', 'POST', '/api/auth/login', { email: a.email }, res, ['401 INVALID_CREDENTIALS (soft-deleted account is not found)']);
        // oracle: auth/router.py:139-148,175-177 (_find_account filters deleted_at), users/service.py:452-453, error_codes.py:19
        expect.soft(res.status()).toBe(401);
        expect.soft((await bodyOf(res)).code).toBe('INVALID_CREDENTIALS');
        expect.soft(res.headers()['set-cookie']).toBeUndefined();
      });

      await test.step('[B11-usr-027] old S1 token: /api/me and refresh -> 401 SESSION_REVOKED', async () => {
        const me = await s1!.get('/api/me'); // Bearer of the old session
        await evi('B11-usr-027', 'me', 'GET', '/api/me', null, me, ['401 SESSION_REVOKED']);
        expect.soft(me.status()).toBe(401);
        expect.soft((await bodyOf(me)).code).toBe('SESSION_REVOKED');
        // replay the old refresh cookie from an empty-jar context (policy 9/12); oracle: auth/sessions.py:449-453
        const replay = await newApiContext();
        fresh.push(replay);
        const refreshed = await replay.post('/api/auth/refresh', { headers: { Cookie: oldCookie } });
        await evi('B11-usr-027', 'refresh', 'POST', '/api/auth/refresh', null, refreshed, ['401 SESSION_REVOKED']);
        expect.soft(refreshed.status()).toBe(401);
        expect.soft((await bodyOf(refreshed)).code).toBe('SESSION_REVOKED');
      });

      await test.step('[B11-usr-028] deleted U1 memberships and activity -> 404 NOT_FOUND user', async () => {
        for (const leaf of ['memberships', 'activity']) {
          const path = `/api/users/${a.id}/${leaf}`;
          const res = await admin.get(path);
          const body = await bodyOf(res);
          await evi('B11-usr-028', leaf, 'GET', path, null, res, [`404 user (real: ${String(res.status())} ${String(body.resource)})`]);
          expect.soft(res.status(), leaf).toBe(404);
          expect.soft(body.code, leaf).toBe('NOT_FOUND');
        }
      });
    } finally {
      await runCleanups([
        async () => { if (u2) await deleteVictim(admin, u2); },
        async () => { if (u1) await deleteVictim(admin, u1); },
        async () => { await s1?.dispose(); },
        ...fresh.map((c) => () => c.dispose()),
        () => anon.dispose(),
        () => admin.dispose(),
      ]);
    }
  });
});
