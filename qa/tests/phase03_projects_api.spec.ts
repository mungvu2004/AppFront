/**
 * Phase 3 — BE1 lifecycle flows through the REAL API (QA-03d P12, skill `qa-api-test`): projects, floors and members,
 * one `test()` per flow of `flow-plan.md` (`phase03_projects_api.spec.ts`), one `test.step('[<row id>] …')` per catalog
 * row, in the planned order. No browser, no mocks. Rows already asserted by `phase03_pipeline_api.spec.ts` are not
 * repeated (api-author-map.md). Helpers: `support/p03/P12.ts`; pool users: `support/phase03Seed.ts` `poolUser`.
 * `BE:` = `F:/App/AppBack` main 2ee030c5, paths under `apps/api/`.
 *
 * ## Non-serial, own data, parallel-safe (--workers N runs files side by side)
 * Each flow signs in on its own and deletes its project in `finally`. Pool users live in P12's OWN slots
 * (`engineer:p12-proj-owner`, `engineer:p12-proj-member`); FL-A1-02 disables `p12-proj-member` on purpose and
 * re-enables it in cleanup (`p12User` also re-enables before use, so a crashed run heals itself). The shared viewer
 * (`viewer:shared`) is only added to this file's own project.
 *
 * ## Real-backend budget per run of this file
 * - `POST /api/auth/login` (LOGIN_IP_LIMIT 120 / 60 s on the QA stack): FL-A1-01 2, FL-A1-02 2, FL-A1-03 4 → 8.
 * - `POST /api/users/invitations` (30 / 3600 s per admin): 0 when the pool slots are filled; first run ever 2
 *   (one per slot, phase03Seed `poolUser`). Never invites in a loop.
 * - `drawings_init` (per user, 300 / 600 s on the QA stack): FL-A1-01 1 on `p12-proj-owner`; the admin spends none.
 * - `members_add` (60 / 3600 s per actor): admin 3 (FL-A1-02 1 refused, FL-A1-03 2), `p12-proj-owner` 5.
 * - #42 / #43 disable / enable: admin 1 + 1 (+ 1 enable per `p12User`).
 * - Pipeline worker: no run (the FL-A1-01 upload stays `receiving`).
 */
import { expect, test, type APIRequestContext } from '@playwright/test';

import { testEmail } from './support/evidence';
import {
  Cleanup,
  JSON_CT,
  PREFIX,
  addMember,
  adminApi,
  asArray,
  asJson,
  call,
  disableUser,
  drawingPng,
  errBody,
  expectError,
  latestItems,
  layerPath,
  newLevelId,
  ownProject,
  p12User,
  receivingUpload,
  settingsBody,
  summaryOf,
  uniq,
  userApi,
} from './support/p03/P12';
import { poolUser } from './support/phase03Seed';

const SLOT_OWNER = 'p12-proj-owner';
const SLOT_MEMBER = 'p12-proj-member';

/** #12 floor list → `{id, order, drawings}` rows in the order the BE returns them. */
async function floorRows(api: APIRequestContext, ev: string, pid: string): Promise<Array<Record<string, unknown>>> {
  const sent = await call(api, ev, 'GET', `/api/projects/${pid}/floors`, undefined, [
    'read-back: 200 FloorOut[] of live floors sorted by (order, pk) (floors/service.py:197-199)',
  ]);
  expect(sent.res.status(), '#12').toBe(200);
  return asArray(sent.body).map((f) => asJson(f));
}

test.describe('A03 · phase-3 BE1 lifecycles (projects, floors, members) — QA-03d P12', () => {
  test('FL-A1-01 · BE1 · owner shapes floors: malformed bodies, order tie, reorder rollup, delete + undo with a new id, delete replay', async () => {
    const cleanup = new Cleanup();
    try {
      const admin = await adminApi(cleanup);
      const owner = await p12User(admin, 'engineer', SLOT_OWNER);
      const e1 = await userApi(owner, cleanup);
      const project = await ownProject(e1, 'FL-A1-01', cleanup, ['A', 'B']);
      const pid = project.id;
      const [a, b] = project.floors as [string, string];
      // Seed: one receiving upload on B (1 init + 1 chunk on the owner's own bucket).
      const uid = await receivingUpload(e1, 'FL-A1-01_seed_b', pid, b, drawingPng(), `${PREFIX}a1-01-b.png`);

      await test.step('[BE1-G-013] truncated JSON on PATCH project / POST floors / PATCH spatial / POST members → 400 MALFORMED_JSON each, nothing written', async () => {
        const read = async (ev: string): Promise<Record<string, unknown>> => {
          const sent = await call(e1, ev, 'GET', `/api/projects/${pid}`, undefined, ['read-back: 200 ProjectOut (#24)']);
          expect(sent.res.status()).toBe(200);
          const p = asJson(sent.body);
          return {
            name: p.name,
            updatedAt: p.updatedAt,
            floors: asArray(p.floors).map((f) => asJson(f)).map((f) => [f.id, f.name, f.order]),
            members: asArray(p.members).map((m) => asJson(m).id),
          };
        };
        const before = await read('BE1-G-013_project_before');
        const routes = [
          ['patch_project', 'PATCH', `/api/projects/${pid}`, '{"name": "renamed'],
          ['create_floor', 'POST', `/api/projects/${pid}/floors`, `{"id": "${newLevelId()}", "name": "C", "order": 2,`],
          ['patch_spatial', 'PATCH', `/api/projects/${pid}/floors/${a}/spatial`, '{"heightMm": 2800'],
          ['add_member', 'POST', `/api/projects/${pid}/members`, '{"email": "x@'],
        ] as const;
        for (const [slug, method, path, data] of routes) {
          const sent = await call(e1, `BE1-G-013_${slug}_400`, method, path, data, [
            '400 MALFORMED_JSON: the W21 guard reads the body (routing.py:100-112) and JSON parsing fails before Pydantic (errors.py:172-174)',
          ], JSON_CT);
          expectError(sent, 400, 'MALFORMED_JSON');
        }
        expect.soft(await read('BE1-G-013_project_after'), 'nothing written: name, updatedAt, floors and members unchanged').toEqual(before);
      });

      await test.step('[BE1-G-177] PATCH B spatial {order: 0} (= A) → 200; #12 lists A then B (tie broken by pk); N1 defaultFloorId from the new orders', async () => {
        const sent = await call(e1, 'BE1-G-177_patch_b_order0_200', 'PATCH', `/api/projects/${pid}/floors/${b}/spatial`, { order: 0 }, [
          '200 FloorOut order 0: orders are not unique (floors/service.py:310-311)',
        ]);
        expect(sent.res.status(), 'order tie accepted').toBe(200);
        expect.soft(asJson(sent.body).order).toBe(0);
        const rows = await floorRows(e1, 'BE1-G-177_floors', pid);
        expect(rows.map((f) => f.id), '#12: same order → creation (pk) order, A first').toEqual([a, b]);
        expect.soft(rows.map((f) => f.order)).toEqual([0, 0]);
        const summary = await summaryOf(e1, 'BE1-G-177_n1', pid);
        expect.soft(summary, 'N1 lists the project').toBeDefined();
        // summaries.py:217-227: first of (fully reviewed, floor_order, level id) — a tie on order falls to the level id.
        expect.soft(summary?.defaultFloorId, 'N1 defaultFloorId on an order tie = the smaller level id').toBe([a, b].sort()[0]);
        expect.soft(summary?.floorCount).toBe(2);
      });

      await test.step('[BE1-G-165] PATCH /api/floors/reorder [B, A] → 200; N1 defaultFloorId = B (follows the new first floor)', async () => {
        const sent = await call(e1, 'BE1-G-165_reorder_200', 'PATCH', '/api/floors/reorder', { floorIds: [b, a] }, [
          '200 FloorOut[] in the new order; set_floor_orders updates the N1 rollup (projects/summaries.py)',
        ]);
        expect(sent.res.status(), 'reorder').toBe(200);
        expect.soft(asArray(sent.body).map((f) => asJson(f).id)).toEqual([b, a]);
        const summary = await summaryOf(e1, 'BE1-G-165_n1', pid);
        expect(summary?.defaultFloorId, 'N1 defaultFloorId follows the new first floor').toBe(b);
      });

      let newB = '';
      await test.step('[BE1-G-148] DELETE B (has an upload) → 200; FE undo re-POSTs B with a NEW id → 201; #12 drawings [], no N7 item, N16 revision 0', async () => {
        const n7Before = await latestItems(e1, 'BE1-G-148_n7_before', pid, '200 N7: the receiving upload of B is listed');
        expect.soft(n7Before.map((i) => i.uploadId), 'precondition: B has its receiving upload').toContain(uid);
        const del = await call(e1, 'BE1-G-148_delete_b_200', 'DELETE', `/api/floors/${b}`, undefined, ['200 FloorOut snapshot taken before the delete (#11)']);
        expect(del.res.status(), 'DELETE B').toBe(200);
        const snap = asJson(del.body);
        newB = newLevelId();
        // FE undo (plan D_09): re-create with the snapshot fields but a client-made NEW level id.
        const undo = await call(e1, 'BE1-G-148_undo_new_id_201', 'POST', `/api/projects/${pid}/floors`, {
          id: newB, name: snap.name, order: snap.order, elevationMm: snap.elevationMm, heightMm: snap.heightMm,
        }, ['201 FloorOut with the NEW id: only a same-id re-create restores uploads / spatial (floors/service.py:118-131)']);
        expect(undo.res.status(), 'undo with a new id').toBe(201);
        expect.soft(asJson(undo.body).id).toBe(newB);
        const rows = await floorRows(e1, 'BE1-G-148_floors', pid);
        expect.soft(rows.map((f) => f.id).sort(), '#12: A + the new B, the deleted B is gone').toEqual([a, newB].sort());
        expect.soft(rows.find((f) => f.id === newB)?.drawings, 'new B has no drawing').toEqual([]);
        const n7 = await latestItems(e1, 'BE1-G-148_n7_after', pid, '200 N7: no item for the deleted B nor for the new B');
        expect.soft(n7.filter((i) => i.floorId === b || i.floorId === newB || i.uploadId === uid), 'the upload of the deleted floor is not restored').toEqual([]);
        const layer = await call(e1, 'BE1-G-148_n16_new_b', 'GET', layerPath(pid, newB), undefined, ['200 N16 of the new B: revision 0 (no spatial restored)']);
        expect.soft(layer.res.status()).toBe(200);
        expect.soft(asJson(layer.body).revision, 'N16 revision 0: spatial of the deleted id not carried over').toBe(0);
      });

      await test.step('[BE1-G-149] DELETE A with Idempotency-Key K → 200 snapshot; same DELETE + K → 404 floor (resolver before replay)', async () => {
        const key = `qa-p12-del-${uniq()}`;
        const first = await call(e1, 'BE1-G-149_delete_a_key_200', 'DELETE', `/api/floors/${a}`, undefined, ['200 FloorOut snapshot of A'], { 'Idempotency-Key': key });
        expect.soft(first.res.status()).toBe(200);
        expect.soft(asJson(first.body).id).toBe(a);
        const again = await call(e1, 'BE1-G-149_delete_a_same_key_404', 'DELETE', `/api/floors/${a}`, undefined, [
          '404 NOT_FOUND resource floor: project_of_floor runs before the idempotency guard (routing.py:166-187, resolvers.py:53-59), so the stored 200 is NOT replayed',
        ], { 'Idempotency-Key': key });
        expectError(again, 404, 'NOT_FOUND', { resource: 'floor' });
      });
    } finally {
      await cleanup.run();
    }
  });

  test('FL-A1-02 · BE1 · owner manages members: non-member admin refused, idempotent add, unavailable users, disabled last editor', async () => {
    const cleanup = new Cleanup();
    try {
      const admin = await adminApi(cleanup);
      const owner = await p12User(admin, 'engineer', SLOT_OWNER);
      const member = await p12User(admin, 'engineer', SLOT_MEMBER);
      const e1 = await userApi(owner, cleanup);
      const project = await ownProject(e1, 'FL-A1-02', cleanup, []);
      const pid = project.id;
      const path = `/api/projects/${pid}/members`;
      const memberIds = async (ev: string): Promise<unknown[]> => {
        const sent = await call(e1, ev, 'GET', `/api/projects/${pid}`, undefined, ['read-back: #24 members']);
        expect(sent.res.status()).toBe(200);
        return asArray(asJson(sent.body).members).map((m) => asJson(m).id);
      };

      await test.step('[BE1-G-084] system admin who is not a member adds E2 to E1\'s project → 404 NOT_FOUND resource project (K08), no membership', async () => {
        const sent = await call(admin, 'BE1-G-084_admin_non_member_404', 'POST', path, { email: member.email }, [
          '404 NOT_FOUND resource project: require_project joins the membership even for a system admin (projects/access.py:78-86)',
        ]);
        expectError(sent, 404, 'NOT_FOUND', { resource: 'project' });
        expect.soft(await memberIds('BE1-G-084_members_after'), 'still only the owner').toEqual([owner.id]);
      });

      await test.step('[BE1-G-096] E1 adds E2 with Idempotency-Key K → 201; same K + body → the same 201 body, E2 listed once; same K + another email → 422 IDEMPOTENCY_KEY_REUSED', async () => {
        const key = `qa-p12-member-${uniq()}`;
        const first = await call(e1, 'BE1-G-096_add_key_201', 'POST', path, { email: member.email }, ['201 UserOut of E2'], { 'Idempotency-Key': key });
        expect(first.res.status(), 'first add').toBe(201);
        const replay = await call(e1, 'BE1-G-096_add_same_key_201', 'POST', path, { email: member.email }, [
          'the STORED 201 body replayed (core/idempotency.py:225-234): one membership, one sink call',
        ], { 'Idempotency-Key': key });
        expect.soft(replay.res.status()).toBe(201);
        expect.soft(replay.body).toEqual(first.body);
        const ids = await memberIds('BE1-G-096_members_after');
        expect.soft(ids.filter((id) => id === member.id), 'E2 listed once').toHaveLength(1);
        const other = await call(e1, 'BE1-G-096_same_key_other_email_422', 'POST', path, { email: testEmail('p12-other') }, [
          '422 IDEMPOTENCY_KEY_REUSED: same key, another body digest',
        ], { 'Idempotency-Key': key });
        expectError(other, 422, 'IDEMPOTENCY_KEY_REUSED');
      });

      await test.step('[BE1-G-092] unknown email → 422 MEMBER_USER_UNAVAILABLE field email; admin disables E2, adding E2 → the same code / field, bodies equal but requestId (no enumeration)', async () => {
        const unknown = await call(e1, 'BE1-G-092_unknown_email_422', 'POST', path, { email: testEmail('p12-nobody') }, [
          '422 MEMBER_USER_UNAVAILABLE field email (project_members/service.py:32-39)',
        ]);
        const unknownBody = expectError(unknown, 422, 'MEMBER_USER_UNAVAILABLE', { field: 'email' });
        await disableUser(admin, member, 'BE1-G-092_admin_disables_e2_200', cleanup);
        // Variant: the disabled account is E2 (already a member) instead of a throw-away D — the availability check runs
        // before the membership lookup, so a disabled member is refused the same way, and one invitation is saved.
        const disabled = await call(e1, 'BE1-G-092_disabled_user_422', 'POST', path, { email: member.email }, [
          '422 MEMBER_USER_UNAVAILABLE field email: a disabled account answers exactly like an unknown email',
        ]);
        const disabledBody = expectError(disabled, 422, 'MEMBER_USER_UNAVAILABLE', { field: 'email' });
        const strip = (body: Record<string, unknown>): Record<string, unknown> => Object.fromEntries(Object.entries(body).filter(([k]) => k !== 'requestId'));
        expect.soft(strip(disabledBody), 'identical bodies except requestId').toEqual(strip(unknownBody));
      });

      await test.step('[BE1-G-110] E2 (the only other editor) disabled → E1 DELETE /members/{E1} → 422 MEMBER_LAST_EDITOR; N3 still lists E1', async () => {
        const sent = await call(e1, 'BE1-G-110_remove_self_422', 'DELETE', `${path}/${owner.id}`, undefined, [
          '422 MEMBER_LAST_EDITOR: a disabled editor is not counted (projects/memberships.py:80-91, status == "active")',
        ]);
        expectError(sent, 422, 'MEMBER_LAST_EDITOR');
        expect.soft(await memberIds('BE1-G-110_members_after'), 'E1 is still a member').toContain(owner.id);
      });
    } finally {
      await cleanup.run();
    }
  });

  test('FL-A1-03 · BE1 · roles on the admin project: viewer / non-member refused before body validation, engineer member deletes the project', async () => {
    const cleanup = new Cleanup();
    try {
      const admin = await adminApi(cleanup);
      const viewer = await poolUser(admin, 'viewer');
      const engMember = await p12User(admin, 'engineer', SLOT_OWNER);
      const engOutsider = await p12User(admin, 'engineer', SLOT_MEMBER);
      const project = await ownProject(admin, 'FL-A1-03', cleanup, ['T1']);
      const pid = project.id;
      const fid = project.floors[0] as string;
      await addMember(admin, 'FL-A1-03_setup_add_viewer', pid, viewer.email);
      await addMember(admin, 'FL-A1-03_setup_add_engineer', pid, engMember.email);
      const vApi = await userApi(viewer, cleanup);
      const outApi = await userApi(engOutsider, cleanup);
      const memApi = await userApi(engMember, cleanup);

      await test.step('[BE1-G-011] INVALID bodies: viewer member → 403 FORBIDDEN on settings PUT / POST floors / PATCH spatial / POST members (never 422), reorder 403 once its resolver accepts the set; engineer non-member → 404', async () => {
        // Each body breaks a Pydantic / service rule; the permission dependency runs first (core/routing.py:9-12).
        const routes = [
          ['settings', 'PUT', `/api/projects/${pid}/settings`, { baseVersion: 0, body: settingsBody({ buildingType: 'castle' }) }, 'project'],
          ['floor_create', 'POST', `/api/projects/${pid}/floors`, { id: 'nope', name: '' }, 'project'],
          ['floor_patch', 'PATCH', `/api/projects/${pid}/floors/${fid}/spatial`, { heightMm: -1 }, 'project'],
          ['members', 'POST', `/api/projects/${pid}/members`, { email: 'not-an-email' }, 'project'],
        ] as const;
        for (const [slug, method, path, data] of routes) {
          const sent = await call(vApi, `BE1-G-011_viewer_${slug}_403`, method, path, data, [
            '403 FORBIDDEN: viewer member lacks the edit key, checked before the body (projects/access.py:78-86)',
          ]);
          expectError(sent, 403, 'FORBIDDEN');
        }
        // #13 has no project in its path: its resolver reads floorIds FIRST and judges the set (resolvers.py:84-120,
        // "lỗi của resolver thắng"), so an invalid set is 422 for anyone; the role gate answers once the set resolves.
        const badSet = { floorIds: [fid, newLevelId()] };
        const viewerBadSet = await call(vApi, 'BE1-G-011_viewer_reorder_bad_set_422', 'PATCH', '/api/floors/reorder', badSet, [
          '422 FLOOR_REORDER_MISMATCH field floorIds: the #13 resolver judges the set before require_project (by design)',
        ]);
        expectError(viewerBadSet, 422, 'FLOOR_REORDER_MISMATCH', { field: 'floorIds' });
        const viewerReorder = await call(vApi, 'BE1-G-011_viewer_reorder_403', 'PATCH', '/api/floors/reorder', { floorIds: [fid] }, [
          '403 FORBIDDEN: the set resolves to the project, the viewer lacks layer.edit',
        ]);
        expectError(viewerReorder, 403, 'FORBIDDEN');
        for (const [slug, method, path, data, resource] of [...routes, ['reorder', 'PATCH', '/api/floors/reorder', badSet, 'floor'] as const]) {
          const sent = await call(outApi, `BE1-G-011_outsider_${slug}_404`, method, path, data, [
            `404 NOT_FOUND resource ${resource}: not a member (K08), before the body`,
          ]);
          expectError(sent, 404, 'NOT_FOUND', { resource });
        }
      });

      await test.step('[BE1-G-047] engineer MEMBER (not the creator) DELETE /api/projects/{id} → 200; admin GET → 404 (BE allows what SCR-08 hides as "Vùng nguy hiểm")', async () => {
        const del = await call(memApi, 'BE1-G-047_engineer_member_delete_200', 'DELETE', `/api/projects/${pid}`, undefined, [
          '200 ProjectOut: DELETE needs project.settings.edit, which an engineer member has (projects/router.py:79, matrix.py:51)',
        ]);
        expect(del.res.status(), 'engineer member deletes the admin project').toBe(200);
        const gone = await call(admin, 'BE1-G-047_admin_read_404', 'GET', `/api/projects/${pid}`, undefined, ['404 NOT_FOUND project: soft-deleted']);
        expectError(gone, 404, 'NOT_FOUND', { resource: 'project' });
        expect.soft(errBody(gone.body).code).toBe('NOT_FOUND');
      });
    } finally {
      await cleanup.run();
    }
  });
});
