/**
 * QA-11 P15 — phase 11 destructive BE flows, part B (API only, no browser pages): FL-B11-05 measurements delete,
 * FL-B11-06 straighten, FL-B11-07 version restore / rule-config reset / per-floor scale, FL-B11-08 logout + remote revoke.
 * Own projects and own users only (shared admin session file, main chain and other phases' pool users are never touched).
 *
 *   BE measurements/router.py:30-56 (#16-#18)   quality/router.py:34-62 (#30-#32)   versions/router.py:62-82 (N19)
 *   rules/router.py:21-38 (N21/N22)             spatial_write PUT …/spatial/layer (#35)   auth/router.py:287-296 (logout)
 *   users/router.py:95 (disable)                core/routing.py:166-187 (Idempotency-Key)
 */
import { expect, test, type APIRequestContext } from '@playwright/test';

import { newApiContext, signedInApi } from './support/api';
import { readAdminCredentials } from './support/auth';
import { attachJson } from './support/evidence';
import { layerPathOf, qcLayer, writeLayer } from './support/layerSeed';
import { p11Slot } from './support/p11/common';
import {
  asArray,
  asJson,
  call,
  deleteInvitedUser,
  expectError,
  inviteAcceptedUser,
  measurementBody,
  newKey,
  refreshCookieOf,
  REFRESH_COOKIE,
} from './support/p11/P15';
import {
  createPipelineProject,
  createProject,
  createSkewedDrawingProject,
  deleteSeededProject,
  envDrawingPng,
  poolUser,
  rotatedPng,
  SKEW_DEG,
  waitForQualityFindings,
} from './support/phase03Seed';

const PROJECTS = '/api/projects';
const CORNERS = [
  { xRatio: 0.05, yRatio: 0.05 }, { xRatio: 0.95, yRatio: 0.05 }, { xRatio: 0.95, yRatio: 0.95 }, { xRatio: 0.05, yRatio: 0.95 },
];

async function adminApi(): Promise<APIRequestContext> {
  const { email, password } = readAdminCredentials();
  return signedInApi(email, password);
}

const idsOf = (list: unknown, key: string): string[] => asArray(list, key).map((row) => String(asJson(row, key).id));

test.describe('phase 11 · destroy B (API)', () => {
  test('SCR-API · FL-B11-05 · admin · Xoá phép đo', async () => {
    const admin = await adminApi();
    const anon = await newApiContext();
    let projectId = '';
    try {
      const mPath = (id = ''): string => `${PROJECTS}/${projectId}/measurements${id ? `/${id}` : ''}`;
      await test.step('[B11-msr-000] seed: own project + MS-0001, MS-0002 → 201 x2', async () => {
        projectId = (await createProject(admin, 'msr', 1)).projectId;
        for (const id of ['MS-0001', 'MS-0002']) {
          const sent = await call(admin, `B11-msr-000_${id}`, 'POST', mPath(), measurementBody(id), ['201 created']);
          expect(sent.res.status(), `POST ${id}`).toBe(201);
        }
      });
      await test.step('[B11-msr-007] anonymous DELETE MS-0001 → 401; list still 2', async () => {
        const denied = await call(anon, 'B11-msr-007_anon_delete', 'DELETE', mPath('MS-0001'), undefined, ['401 no token']);
        expectError(denied, 401, 'UNAUTHENTICATED');
        const list = await call(admin, 'B11-msr-007_list', 'GET', mPath(), undefined, ['200 still two records']);
        expect.soft(list.res.status()).toBe(200);
        expect.soft(idsOf(list.body, 'list')).toEqual(['MS-0001', 'MS-0002']);
      });
      const key = newKey();
      await test.step('[B11-msr-011] DELETE MS-0001 twice with the same Idempotency-Key → 204 + 204, empty body', async () => {
        for (const run of ['first', 'second']) {
          const sent = await call(admin, `B11-msr-011_${run}`, 'DELETE', mPath('MS-0001'), undefined, ['204 empty body (router.py:44, routing.py:166-185)'], { 'Idempotency-Key': key });
          expect.soft(sent.res.status(), `${run} DELETE`).toBe(204);
          expect.soft((await sent.res.body()).length, `${run} body empty`).toBe(0);
        }
      });
      await test.step('[B11-msr-008] DELETE MS-0001 without a key → 404 resource measurement', async () => {
        expectError(await call(admin, 'B11-msr-008_again', 'DELETE', mPath('MS-0001'), undefined, ['404 measurement (hard delete)']), 404, 'NOT_FOUND', 'measurement');
      });
      await test.step('[B11-msr-009] GET measurements → 200, only MS-0002', async () => {
        const list = await call(admin, 'B11-msr-009_list', 'GET', mPath(), undefined, ['200 [MS-0002]']);
        expect.soft(list.res.status()).toBe(200);
        expect.soft(idsOf(list.body, 'list')).toEqual(['MS-0002']);
      });
      await test.step('[B11-msr-010] POST MS-0001 again (undo) → 201 then 200 original; list has MS-0001', async () => {
        const body = measurementBody('MS-0001');
        const first = await call(admin, 'B11-msr-010_undo', 'POST', mPath(), body, ['201 re-created (router.py:30-38)']);
        expect.soft(first.res.status()).toBe(201);
        const second = await call(admin, 'B11-msr-010_resend', 'POST', mPath(), body, ['200 the stored record, unchanged']);
        expect.soft(second.res.status()).toBe(200);
        expect.soft(asJson(second.body).id).toBe('MS-0001');
        expect.soft(asJson(second.body).rawValueMm).toBe(body.rawValueMm);
        const list = await call(admin, 'B11-msr-010_list', 'GET', mPath(), undefined, ['200 contains MS-0001']);
        expect.soft(idsOf(list.body, 'list')).toContain('MS-0001');
      });
    } finally {
      if (projectId) await deleteSeededProject(admin, projectId);
      await anon.dispose();
      await admin.dispose();
    }
  });

  test('SCR-API · FL-B11-06 · admin · Nắn thẳng: ẩn danh, hậu quả, tầng đã xoá', async ({ browser }) => {
    test.setTimeout(240_000);
    const admin = await adminApi();
    const anon = await newApiContext();
    let projectId = '';
    try {
      const drawingPath = process.env.E2E_DRAWING_PNG;
      if (!drawingPath) throw new Error('E2E_DRAWING_PNG is not set');
      const seeded = await createSkewedDrawingProject(admin, 'qlt', await rotatedPng(browser, drawingPath, SKEW_DEG));
      projectId = seeded.projectId;
      const floorId = seeded.floorId;
      const qPath = (tail = ''): string => `${PROJECTS}/${projectId}/floors/${floorId}/quality${tail}`;
      let before = { sourceUrl: '', ids: [] as string[] };
      const read = async (ev: string, claim: string): Promise<{ sourceUrl: string; ids: string[]; measured: boolean; status: number }> => {
        const sent = await call(admin, ev, 'GET', qPath(), undefined, [claim]);
        const row = asArray(asJson(sent.body).floors, 'floors').map((f) => asJson(f, 'floor')).find((f) => f.floorId === floorId) ?? {};
        return { status: sent.res.status(), measured: row.isMeasured === true, sourceUrl: String(row.sourceUrl), ids: idsOf(row.findings ?? [], 'findings') };
      };
      await test.step('[B11-qlt-000] seed: skewed drawing measured → GET quality 200 isMeasured=true', async () => {
        await waitForQualityFindings(admin, projectId, floorId);
        const got = await read('B11-qlt-000_quality', '200 isMeasured=true with findings');
        expect(got.status).toBe(200);
        expect(got.measured, 'isMeasured').toBe(true);
        expect(got.ids.length, 'at least one finding to be renewed').toBeGreaterThan(0);
        before = { sourceUrl: got.sourceUrl, ids: got.ids };
      });
      await test.step('[B11-qlt-012] anonymous straighten + corners → 401 x2; GET quality unchanged', async () => {
        expectError(await call(anon, 'B11-qlt-012_straighten', 'POST', qPath('/straighten'), {}, ['401 no token']), 401, 'UNAUTHENTICATED');
        expectError(await call(anon, 'B11-qlt-012_corners', 'POST', qPath('/corners'), { corners: CORNERS }, ['401 no token (valid body)']), 401, 'UNAUTHENTICATED');
        const after = await read('B11-qlt-012_after', '200 same sourceUrl and finding ids');
        expect.soft(after.sourceUrl).toBe(before.sourceUrl);
        expect.soft(after.ids).toEqual(before.ids);
      });
      await test.step('[B11-qlt-020] POST straighten {} then GET quality → new sourceUrl, new finding ids', async () => {
        const done = await call(admin, 'B11-qlt-020_straighten', 'POST', qPath('/straighten'), {}, ['200 straightened page']);
        expect.soft(done.res.status()).toBe(200);
        const after = await read('B11-qlt-020_after', '200 sourceUrl changed, old finding ids gone (quality_read_assessment)');
        expect.soft(after.sourceUrl).not.toBe(before.sourceUrl);
        expect.soft(after.ids.filter((id) => before.ids.includes(id)), 'old finding ids still listed').toEqual([]);
      });
      await test.step('[B11-qlt-013] DELETE /api/floors/{F} then straighten → 404 resource floor', async () => {
        const gone = await call(admin, 'B11-qlt-013_delete_floor', 'DELETE', `/api/floors/${floorId}`, undefined, ['200 floor soft-deleted']);
        expect(gone.res.status(), 'DELETE floor').toBe(200);
        expectError(await call(admin, 'B11-qlt-013_straighten', 'POST', qPath('/straighten'), {}, ['404 floor (quality/service straighten, test C08)']), 404, 'NOT_FOUND', 'floor');
      });
    } finally {
      if (projectId) await deleteSeededProject(admin, projectId);
      await anon.dispose();
      await admin.dispose();
    }
  });

  test('SCR-API · FL-B11-07 · admin · Phục hồi phiên bản, khôi phục mặc định luật, áp từng tầng', async () => {
    test.setTimeout(300_000);
    const admin = await adminApi();
    const anon = await newApiContext();
    let projectId = '';
    try {
      // Versions exist only after a pipeline run (BE apps/worker/pipeline_persist/service.py:182-198; #35 writes make none),
      // so the seed is a pipeline project (floor 1 = drawing) instead of createQcProject.
      const seed = await createPipelineProject(admin, 'ver', envDrawingPng(), ['Tầng 1', 'Tầng 2', 'Tầng 3']);
      projectId = seed.projectId;
      const floors: string[] = [seed.floorId];
      const layerOf = (f: string): string => layerPathOf(projectId, f);
      const versionsPath = `${PROJECTS}/${projectId}/versions?floorId=${encodeURIComponent(seed.floorId)}`;
      const rulePath = `${PROJECTS}/${projectId}/rule-config`;
      const api = { request: admin, headers: {} };
      let afterId = '';
      const revisionOf = async (ev: string, f: string, claim: string): Promise<number> => {
        const sent = await call(admin, ev, 'GET', layerOf(f), undefined, [claim]);
        expect(sent.res.status(), `N16 ${ev}`).toBe(200);
        return Number(asJson(sent.body).revision);
      };
      const wallIds = (doc: unknown): string[] => idsOf(asJson(asJson(doc).layer).walls ?? [], 'walls').sort();

      await test.step('[B11-ver-000] seed: pipeline project, 3 floors; N16 200 per floor; versions listed', async () => {
        const all = await call(admin, 'B11-ver-000_project', 'GET', `${PROJECTS}/${projectId}`, undefined, ['200 floors']);
        const rows = asArray(asJson(all.body).floors, 'floors').map((r) => asJson(r, 'floor'));
        floors.splice(0, floors.length, ...rows.sort((a, b) => Number(a.order) - Number(b.order)).map((r) => String(r.id)));
        expect(floors.length, 'three floors').toBe(3);
        for (const [index, f] of floors.entries()) await revisionOf(`B11-ver-000_layer${String(index + 1)}`, f, '200 N16');
        await writeLayer(api, projectId, floors[1] as string, qcLayer); // floor 2 gets an edit: its revision moves (used by B11-set-001)
        const list = await call(admin, 'B11-ver-000_versions', 'GET', versionsPath, undefined, ['200 [after, before] from the pipeline']);
        expect(list.res.status()).toBe(200);
        const items = asArray(asJson(list.body).items, 'items').map((i) => asJson(i, 'item'));
        expect(items.length, 'pipeline made >= 2 versions').toBeGreaterThanOrEqual(2);
        afterId = String(items[0]?.id);
      });
      await test.step('[B11-ver-012] anonymous POST restore → 401', async () => {
        expectError(await call(anon, 'B11-ver-012_anon', 'POST', `${PROJECTS}/${projectId}/versions/${afterId}/restore`, { baseVersion: 0, body: { floorId: floors[0] } }, ['401 no token (valid body)']), 401, 'UNAUTHENTICATED');
      });
      await test.step('[B11-rul-007] anonymous PUT rule-config → 401', async () => {
        expectError(await call(anon, 'B11-rul-007_anon', 'PUT', rulePath, { baseVersion: 0, body: { overrides: {} } }, ['401 no token (valid body)']), 401, 'UNAUTHENTICATED');
      });
      await test.step('[B11-ver-013] human edit then restore the pipeline version → layer back to it; "before" version exists', async () => {
        const snap = await call(admin, 'B11-ver-013_snapshot', 'GET', `${PROJECTS}/${projectId}/versions/${afterId}/snapshot?floorId=${encodeURIComponent(floors[0] as string)}`, undefined, ['200 content restore must bring back']);
        expect(snap.res.status()).toBe(200);
        const aiWalls = wallIds(snap.body);
        const edited = await writeLayer(api, projectId, floors[0] as string, qcLayer); // the human edit (qcLayer walls)
        const editedIds = idsOf(edited.walls, 'walls');
        expect(editedIds.length, 'edit added walls').toBeGreaterThan(0);
        const rev = await revisionOf('B11-ver-013_rev', floors[0] as string, '200 revision after the edit');
        const restored = await call(admin, 'B11-ver-013_restore', 'POST', `${PROJECTS}/${projectId}/versions/${afterId}/restore`, { baseVersion: rev, body: { floorId: floors[0] } }, ['201 FloorVersionSummary "after"']);
        expect(restored.res.status(), 'restore').toBe(201);
        const doc = await call(admin, 'B11-ver-013_layer', 'GET', layerOf(floors[0] as string), undefined, ['200 layer = the restored snapshot']);
        expect.soft(wallIds(doc.body)).toEqual(aiWalls);
        expect.soft(wallIds(doc.body).filter((id) => editedIds.includes(id)), 'walls added after the version are gone').toEqual([]);
        const list = await call(admin, 'B11-ver-013_versions', 'GET', versionsPath, undefined, ['200 has the "trạng thái trước khi phục hồi" version']);
        const notes = asArray(asJson(list.body).items, 'items').map((i) => String(asJson(i, 'item').note ?? ''));
        expect.soft(notes.some((n) => n.startsWith('trạng thái trước khi phục hồi')), `notes ${JSON.stringify(notes)}`).toBe(true);
      });
      await test.step('[B11-rul-001] PUT overrides (base 0) then PUT {} (base 1) → 200 revision 2, overrides {}', async () => {
        const one = await call(admin, 'B11-rul-001_set', 'PUT', rulePath, { baseVersion: 0, body: { overrides: { 'WALL-THICKNESS': { enabled: true, thresholds: { 'wall.minThicknessMm': 100 } } } } }, ['200 revision 1']);
        expect(one.res.status(), 'first PUT').toBe(200);
        expect(asJson(one.body).revision).toBe(1);
        const reset = await call(admin, 'B11-rul-001_reset', 'PUT', rulePath, { baseVersion: 1, body: { overrides: {} } }, ['200 revision 2, overrides {}']);
        expect.soft(reset.res.status()).toBe(200);
        expect.soft(asJson(reset.body).revision).toBe(2);
        expect.soft(asJson(reset.body).overrides).toEqual({});
      });
      await test.step('[B11-rul-002] GET rule-config → {revision 2, overrides {}}', async () => {
        const got = await call(admin, 'B11-rul-002_get', 'GET', rulePath, undefined, ['200 {revision:2, overrides:{}}']);
        expect.soft(got.res.status()).toBe(200);
        expect.soft(got.body).toEqual({ revision: 2, overrides: {} });
      });
      await test.step('[B11-set-001] save scale floor 1, 2 (stale base), 3 → 200, 409 VERSION_CONFLICT, 200; no rollback', async () => {
        // saveScale = scale-only #35 PUT per floor (src/lib/autosave/spatialLayerSave.ts:361; useAutosave.ts:579).
        const [f1, f2, f3] = floors as [string, string, string];
        const r1 = await revisionOf('B11-set-001_r1', f1, '200 base floor 1');
        const r3 = await revisionOf('B11-set-001_r3', f3, '200 base floor 3');
        const put = (ev: string, f: string, base: number): ReturnType<typeof call> =>
          call(admin, ev, 'PUT', layerOf(f), { baseVersion: base, body: { scaleMillimetresPerPixel: 3 } }, ['scale-only #35 write']);
        const a = await put('B11-set-001_floor1', f1, r1);
        expect.soft(a.res.status(), 'floor 1').toBe(200);
        const b = await put('B11-set-001_floor2', f2, 0); // floor 2 has revision >= 1 (edited in the seed step)
        expectError(b, 409, 'VERSION_CONFLICT');
        const c = await put('B11-set-001_floor3', f3, r3);
        expect.soft(c.res.status(), 'floor 3').toBe(200);
        expect.soft(await revisionOf('B11-set-001_after1', f1, '200 floor 1 kept its write'), 'floor 1 not rolled back').toBeGreaterThan(r1);
        expect.soft(await revisionOf('B11-set-001_after3', f3, '200 floor 3 kept its write'), 'floor 3 not rolled back').toBeGreaterThan(r3);
      });
    } finally {
      if (projectId) await deleteSeededProject(admin, projectId);
      await anon.dispose();
      await admin.dispose();
    }
  });

  test('SCR-API · FL-B11-08 · engineer + invitee · Đăng xuất, thu hồi phiên', async () => {
    test.setTimeout(240_000);
    const admin = await adminApi();
    const sessions: APIRequestContext[] = [];
    let victim: { id: string; email: string; password: string } | undefined;
    try {
      const engineer = await poolUser(admin, 'engineer', p11Slot('destroy-b'));
      const open = async (email: string, password: string): Promise<APIRequestContext> => {
        const ctx = await signedInApi(email, password);
        sessions.push(ctx);
        return ctx;
      };
      const s1 = await open(engineer.email, engineer.password);
      const s2 = await open(engineer.email, engineer.password);
      victim = await inviteAcceptedUser(admin, 'viewer', 'p11-destroy-b-u3');
      const t1 = await open(victim.email, victim.password);
      const t2 = await open(victim.email, victim.password);
      let oldCookie = '';
      await test.step('[B11-out-000] seed: S1, S2 (engineer) and T1, T2 (invitee) GET /api/me → 200', async () => {
        for (const [name, ctx] of [['s1', s1], ['s2', s2], ['t1', t1], ['t2', t2]] as const) {
          const sent = await call(ctx, `B11-out-000_${name}`, 'GET', '/api/me', undefined, ['200 live session']);
          expect(sent.res.status(), `${name} /api/me`).toBe(200);
        }
        oldCookie = await refreshCookieOf(s1);
      });
      await test.step('[B11-out-008] S1 logout → 204; S2 GET /api/me still 200', async () => {
        const out = await call(s1, 'B11-out-008_logout', 'POST', '/api/auth/logout', undefined, ['204']);
        expect.soft(out.res.status()).toBe(204);
        const other = await call(s2, 'B11-out-008_s2', 'GET', '/api/me', undefined, ['200 the other session lives (revoke_by_cookie)']);
        expect.soft(other.res.status()).toBe(200);
      });
      await test.step('[B11-out-006] refresh with the logged-out cookie → 401, no new token', async () => {
        const replay = await newApiContext({ Cookie: `${REFRESH_COOKIE}=${oldCookie}` });
        try {
          const sent = await call(replay, 'B11-out-006_refresh', 'POST', '/api/auth/refresh', undefined, ['401 SESSION_REVOKED (sessions.py:452-453), no accessToken']);
          expectError(sent, 401, 'SESSION_REVOKED');
          const body = asJson(sent.body);
          expect.soft(body.accessToken ?? body.access_token, 'no token issued').toBeUndefined();
        } finally {
          await replay.dispose();
        }
      });
      await test.step('[B11-out-007] S1 GET /api/me with the old access token → record real behaviour', async () => {
        // UNKNOWN — NEED VERIFICATION: 401 SESSION_REVOKED (verifier checks the session) or 200 until the token expires.
        const sent = await call(s1, 'B11-out-007_me', 'GET', '/api/me', undefined, ['401 SESSION_REVOKED or 200 until expiry (auth/verifier.py)']);
        const verdict = sent.res.status() === 401 ? String(asJson(sent.body).code) : sent.res.status() === 200 ? 'VALID_UNTIL_EXPIRY' : `status ${String(sent.res.status())}`;
        await attachJson('B11-out-007_verdict.json', { status: sent.res.status(), verdict });
        expect(['SESSION_REVOKED', 'VALID_UNTIL_EXPIRY']).toContain(verdict);
      });
      await test.step('[B11-out-011] S2 logout twice with the same Idempotency-Key → 204 + 204', async () => {
        const key = newKey();
        for (const run of ['first', 'second']) {
          const sent = await call(s2, `B11-out-011_${run}`, 'POST', '/api/auth/logout', undefined, ['204 (core/routing.py)'], { 'Idempotency-Key': key });
          expect.soft(sent.res.status(), `${run} logout`).toBe(204);
        }
      });
      await test.step('[B11-out-009] admin disables U → T1, T2 /api/me 401 SESSION_REVOKED, refresh 401, login 403', async () => {
        const off = await call(admin, 'B11-out-009_disable', 'POST', `/api/users/${victim?.id}/disable`, {}, ['200 sessions revoked (users/service.py:297-309)']);
        expect(off.res.status(), 'disable').toBe(200);
        for (const [name, ctx] of [['t1', t1], ['t2', t2]] as const) {
          expectError(await call(ctx, `B11-out-009_me_${name}`, 'GET', '/api/me', undefined, ['401 SESSION_REVOKED']), 401, 'SESSION_REVOKED');
          const ref = await call(ctx, `B11-out-009_refresh_${name}`, 'POST', '/api/auth/refresh', undefined, ['401']);
          expect.soft(ref.res.status(), `${name} refresh`).toBe(401);
        }
        const anon = await newApiContext();
        try {
          const login = await call(anon, 'B11-out-009_login', 'POST', '/api/auth/login', { email: victim?.email, password: victim?.password, rememberMe: false }, ['403 disabled account']);
          expect.soft(login.res.status(), 'login').toBe(403);
        } finally {
          await anon.dispose();
        }
      });
    } finally {
      if (victim) await deleteInvitedUser(admin, victim);
      for (const ctx of sessions) await ctx.dispose();
      await admin.dispose();
    }
  });
});
