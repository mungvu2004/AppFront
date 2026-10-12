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
 * - `drawings_init` (per user, 300 / 600 s on the QA stack): FL-A1-01 2 on `p12-proj-owner` (seed + BE1-G-050); the
 *   admin spends none.
 * - `members_add` (60 / 3600 s per actor): admin 5 (FL-A1-01 1 owner into Q, FL-A1-02 1 refused, FL-A1-03 3 incl. the
 *   own-email 200 of BE1-G-088), `p12-proj-owner` 6 (+1 FL-A1-01 admin into P for BE1-G-050). Viewer 403s are refused
 *   before the limiter (project_members/router.py:46) and spend nothing.
 * - Projects: FL-A1-01 2 (P by the owner, deleted in-flow by the admin at BE1-G-050; Q by the admin), FL-A1-02 1,
 *   FL-A1-03 1. #27 DELETE is admin-only (BUG-513), so an owner-made project the admin is not a member of (FL-A1-02)
 *   is NOT removed by `ownProject`'s cleanup (it notes the 403).
 * - #42 / #43 disable / enable: admin 1 + 1 (+ 1 enable per `p12User`).
 * - S1: FL-A1-01 opens 1 stream of `p12-proj-owner` (BE1-G-050, answered 404).
 * - Pipeline worker: no run (the FL-A1-01 uploads stay `receiving`).
 * - QA-03i added FL-A1-01 BE1-G-155 / 143 / 050 and FL-A1-03 BE1-G-086 / 088 / 083 / 102 / 141 / 140 / 105 / 107
 *   (`BE:` main 4633e479 for these).
 */
import { expect, test, type APIRequestContext } from '@playwright/test';

import { readAdminCredentials } from './support/auth';
import { testEmail } from './support/evidence';
import {
  Cleanup,
  JSON_CT,
  PREFIX,
  SseConn,
  addMember,
  adminApi,
  asArray,
  asJson,
  call,
  captureStream,
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
  streamCookieOf,
  streamPath,
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
  test('FL-A1-01 · BE1 · owner shapes floors: malformed bodies, order tie, reorder rollup and set size, delete + undo with a new id, delete replay, ambiguous id, project-delete cascade', async () => {
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

      await test.step('[BE1-G-155] PATCH /api/floors/reorder with floorIds [] and with 51 ids (> FLOORS_MAX 50) → 422 VALIDATION field floorIds each; order unchanged', async () => {
        const cases = [
          ['empty', []],
          ['51_ids', Array.from({ length: 51 }, () => newLevelId())],
        ] as const;
        for (const [slug, floorIds] of cases) {
          const sent = await call(e1, `BE1-G-155_reorder_${slug}_422`, 'PATCH', '/api/floors/reorder', { floorIds }, [
            '422 VALIDATION field floorIds: the #13 resolver wants 1..FLOORS_MAX strings before any lookup (floors/resolvers.py:62-89)',
          ]);
          expectError(sent, 422, 'VALIDATION', { field: 'floorIds' });
        }
        expect.soft((await floorRows(e1, 'BE1-G-155_floors_after', pid)).map((f) => f.id), 'order unchanged').toEqual([b, a]);
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

      await test.step('[BE1-G-143] admin project Q (owner added as member) gets a floor with the new B id → DELETE /api/floors/{newB} → 409 FLOOR_ID_AMBIGUOUS; both projects keep the floor', async () => {
        // Q is the admin's so that cleanup can delete it (#27 is admin-only, BUG-513); for the owner both are member projects.
        const q = await ownProject(admin, 'FL-A1-01_q', cleanup, []);
        await addMember(admin, 'BE1-G-143_setup_add_owner_to_q', q.id, owner.email);
        const twin = await call(e1, 'BE1-G-143_create_same_id_in_q_201', 'POST', `/api/projects/${q.id}/floors`, {
          id: newB, name: `${PREFIX}twin`, order: 0, elevationMm: 0, heightMm: 3000,
        }, ['setup: 201 — a level id is unique per project only']);
        expect(twin.res.status(), 'setup: same level id in Q').toBe(201);
        const sent = await call(e1, 'BE1-G-143_delete_ambiguous_409', 'DELETE', `/api/floors/${newB}`, undefined, [
          '409 FLOOR_ID_AMBIGUOUS: the flat path matches a live floor in two member projects (floors/resolvers.py:39-50, errors.py:10)',
        ]);
        expectError(sent, 409, 'FLOOR_ID_AMBIGUOUS');
        expect.soft((await floorRows(e1, 'BE1-G-143_floors_p', pid)).map((f) => f.id), 'P keeps newB').toContain(newB);
        expect.soft((await floorRows(e1, 'BE1-G-143_floors_q', q.id)).map((f) => f.id), 'Q keeps newB').toEqual([newB]);
      });

      await test.step('[BE1-G-050] project with a settings row and a receiving upload is deleted (admin, added as member) → N5 / #12 → 404 project; #6 / #7 / #8 → 404 project (gate first); S1 → 404 upload', async () => {
        const put = await call(e1, 'BE1-G-050_setup_settings_200', 'PUT', `/api/projects/${pid}/settings`, { baseVersion: 0, body: settingsBody() }, ['setup: 200 N6 revision 1 (a settings row exists)']);
        expect(put.res.status(), 'setup: settings row').toBe(200);
        const gone = await receivingUpload(e1, 'BE1-G-050_seed', pid, newB, drawingPng(), `${PREFIX}a1-01-gone.png`);
        await addMember(e1, 'BE1-G-050_setup_add_admin', pid, readAdminCredentials().email);
        const del = await call(admin, 'BE1-G-050_admin_deletes_project_200', 'DELETE', `/api/projects/${pid}`, undefined, ['setup: #27 soft delete by an admin member → 200 (projects/router.py:80)']);
        expect(del.res.status(), 'setup: project deleted').toBe(200);
        const reads = [
          ['settings_n5', 'GET', `/api/projects/${pid}/settings`, undefined],
          ['floors_12', 'GET', `/api/projects/${pid}/floors`, undefined],
          ['chunk_6', 'POST', `/api/projects/${pid}/drawings/uploads/${gone}/chunks`, { chunk: 'AAAA', chunkIndex: 0 }],
          ['complete_7', 'POST', `/api/projects/${pid}/drawings/uploads/${gone}/complete`, { uploadId: gone }],
          ['progress_8', 'GET', `/api/projects/${pid}/drawings/uploads/${gone}/progress`, undefined],
        ] as const;
        for (const [slug, method, path, data] of reads) {
          const sent = await call(e1, `BE1-G-050_${slug}_404`, method, path, data, [
            '404 NOT_FOUND resource project: require_project joins Project.deleted_at IS NULL and runs before the upload lookup (projects/access.py:62-83, drawings/router.py:35-36)',
          ]);
          expectError(sent, 404, 'NOT_FOUND', { resource: 'project' });
        }
        const path = streamPath(pid, gone);
        const s1 = await SseConn.open(path, { cookie: await streamCookieOf(e1) });
        await s1.close();
        await captureStream('BE1-G-050_s1_404', path, { cookie: '<owner stream cookie>' }, s1, ['404 NOT_FOUND resource upload (drawings/stream_providers.py:43-62)']);
        expect.soft(s1.status).toBe(404);
        expect.soft(errBody(s1.errorBody)).toMatchObject({ code: 'NOT_FOUND', resource: 'upload' });
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

  test('FL-A1-03 · BE1 · roles on the admin project: member add read-back and own email, viewer / non-member refused before body validation, viewer member writes and floor delete refused, engineer member refused the project delete (admin-only, BUG-513), unknown member, last editor', async () => {
    const cleanup = new Cleanup();
    try {
      const admin = await adminApi(cleanup);
      const viewer = await poolUser(admin, 'viewer');
      const engMember = await p12User(admin, 'engineer', SLOT_OWNER);
      const engOutsider = await p12User(admin, 'engineer', SLOT_MEMBER);
      const project = await ownProject(admin, 'FL-A1-03', cleanup, ['T1']);
      const pid = project.id;
      const fid = project.floors[0] as string;
      const adminId = String(asJson(asArray(project.project.members)[0]).id);
      await addMember(admin, 'FL-A1-03_setup_add_viewer', pid, viewer.email);
      const vApi = await userApi(viewer, cleanup);
      const outApi = await userApi(engOutsider, cleanup);
      const memApi = await userApi(engMember, cleanup);
      const membersPath = `/api/projects/${pid}/members`;
      const readProject = async (ev: string): Promise<Record<string, unknown>> => {
        const sent = await call(admin, ev, 'GET', `/api/projects/${pid}`, undefined, ['read-back: 200 ProjectOut (#24) members + updatedAt']);
        expect(sent.res.status(), '#24').toBe(200);
        return asJson(sent.body);
      };
      const memberIds = async (ev: string): Promise<string[]> => asArray((await readProject(ev)).members).map((m) => String(asJson(m).id)).sort();
      const floorIds = async (ev: string): Promise<unknown[]> => (await floorRows(admin, ev, pid)).map((f) => f.id);
      const invitesFor = async (api: APIRequestContext, ev: string): Promise<Array<Record<string, unknown>>> => {
        const sent = await call(api, ev, 'GET', '/api/notifications', undefined, ["200 #19 the caller's visible notifications, newest first (notifications/router.py:25-29)"]);
        expect(sent.res.status(), '#19').toBe(200);
        return asArray(sent.body).map((n) => asJson(n)).filter((n) => n.kind === 'projectInvite' && n.projectId === pid);
      };

      await test.step('[BE1-G-086] admin adds the engineer → 201 UserOut {id, email, name, role} (no avatarUrl); #24 lists them and updatedAt grows; activity member.add; the engineer gets one projectInvite', async () => {
        const before = await readProject('BE1-G-086_project_before');
        const sent = await call(admin, 'BE1-G-086_add_engineer_201', 'POST', membersPath, { email: engMember.email }, [
          '201 UserOut of the new member; avatarUrl absent without an avatar (project_members/service.py:61-94, projects/wire.py:38-49,135-146)',
        ]);
        expect(sent.res.status(), 'N3 add').toBe(201);
        const out = asJson(sent.body);
        expect.soft(Object.keys(out).sort(), 'UserOut keys, avatarUrl absent').toEqual(['email', 'id', 'name', 'role']);
        expect.soft(out).toMatchObject({ id: engMember.id, email: engMember.email, role: 'engineer' });
        const after = await readProject('BE1-G-086_project_after');
        expect.soft(asArray(after.members).map((m) => asJson(m).id), '#24 members lists the engineer').toContain(engMember.id);
        expect.soft(Date.parse(String(after.updatedAt)), 'touch_project pushed updatedAt').toBeGreaterThan(Date.parse(String(before.updatedAt)));
        const log = await call(admin, 'BE1-G-086_admin_activity', 'GET', `/api/users/${adminId}/activity`, undefined, [
          "#40 the admin's activity, newest first: a member.add row whose objectCode is the engineer (service.py:79-88, users/service.py:263-278)",
        ]);
        expect.soft(log.res.status()).toBe(200);
        const row = asArray(log.body).map((r) => asJson(r)).find((r) => r.objectCode === engMember.id);
        expect.soft(row?.kind, 'newest activity on the engineer').toBe('member.add');
        expect.soft(Date.parse(String(row?.at)), 'written by this add').toBeGreaterThanOrEqual(Date.parse(String(before.updatedAt)));
        expect.soft(await invitesFor(memApi, 'BE1-G-086_engineer_notifications'), 'one projectInvite for the added engineer (notifications/invite_sinks.py:23-50)').toHaveLength(1);
      });

      await test.step('[BE1-G-088] admin adds its own email → 200 UserOut of itself (already a member): members unchanged, no projectInvite to itself', async () => {
        const before = await memberIds('BE1-G-088_members_before');
        const sent = await call(admin, 'BE1-G-088_add_self_200', 'POST', membersPath, { email: readAdminCredentials().email }, [
          '200: created=False → status 200, no activity, no sink call, no touch (project_members/router.py:68-69, service.py:79-94)',
        ]);
        expect(sent.res.status(), 'N3 own email').toBe(200);
        expect.soft(asJson(sent.body).id).toBe(adminId);
        expect.soft(await memberIds('BE1-G-088_members_after'), 'members unchanged').toEqual(before);
        expect.soft(await invitesFor(admin, 'BE1-G-088_admin_notifications'), 'no self-notification (the sink also skips user == actor, invite_sinks.py:33-34)').toEqual([]);
      });

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

      await test.step('[BE1-G-083] viewer member adds an existing active user (valid body) → 403 FORBIDDEN; nobody added', async () => {
        // The members_add limiter runs AFTER the edit gate (project_members/router.py:44-46): a viewer never spends the
        // 60 / 3600 s bucket and never sees 429. Not measurable without burning the bucket, so only the 403 is asserted.
        const sent = await call(vApi, 'BE1-G-083_viewer_add_403', 'POST', membersPath, { email: engOutsider.email }, [
          '403 FORBIDDEN: viewer lacks project.settings.edit, refused before the limiter (project_members/router.py:36-46)',
        ]);
        expect.soft(expectError(sent, 403, 'FORBIDDEN'), 'no resource on a 403').not.toHaveProperty('resource');
        expect.soft(await memberIds('BE1-G-083_members_after'), 'the outsider was not added').not.toContain(engOutsider.id);
      });

      await test.step('[BE1-G-102] viewer member removes the engineer → 403 FORBIDDEN; the engineer stays a member', async () => {
        const sent = await call(vApi, 'BE1-G-102_viewer_remove_403', 'DELETE', `${membersPath}/${engMember.id}`, undefined, [
          '403 FORBIDDEN: N4 has the same project.settings.edit gate (project_members/router.py:36-39,73-75)',
        ]);
        expectError(sent, 403, 'FORBIDDEN');
        expect.soft(await memberIds('BE1-G-102_members_after')).toContain(engMember.id);
      });

      await test.step('[BE1-G-141] viewer member DELETE /api/floors/{T1} → 403 FORBIDDEN (resolver passes, layer.edit fails); T1 still listed', async () => {
        const sent = await call(vApi, 'BE1-G-141_viewer_floor_delete_403', 'DELETE', `/api/floors/${fid}`, undefined, [
          '403 FORBIDDEN: project_of_floor finds the member project, then require_project("layer.edit") refuses the viewer (floors/router.py:24,38-43)',
        ]);
        expectError(sent, 403, 'FORBIDDEN');
        expect.soft(await floorIds('BE1-G-141_floors_after'), 'T1 not deleted').toEqual([fid]);
      });

      await test.step('[BE1-G-140] engineer NON-member DELETE /api/floors/{T1} → 404 NOT_FOUND resource floor (non-member projects are not counted, K08); T1 still listed', async () => {
        const sent = await call(outApi, 'BE1-G-140_outsider_floor_delete_404', 'DELETE', `/api/floors/${fid}`, undefined, [
          '404 NOT_FOUND resource floor: the resolver only joins projects the caller is a member of (floors/resolvers.py:23-36,39-50)',
        ]);
        expectError(sent, 404, 'NOT_FOUND', { resource: 'floor' });
        expect.soft(await floorIds('BE1-G-140_floors_after'), 'T1 not deleted').toEqual([fid]);
      });

      await test.step('[BE1-G-047] engineer MEMBER (not the creator) DELETE /api/projects/{id} → 403 FORBIDDEN; admin GET → 200 (only an admin deletes, as SCR-08 "Vùng nguy hiểm")', async () => {
        // BUG-513 (FIX-2331): #27 is require_project("admin") — member first (404, K08), then the system role admin
        // (AppBack apps/api/projects/router.py:80, access.py:88-98); FE useProjectSettings.ts:755 canDelete is admin-only.
        const del = await call(memApi, 'BE1-G-047_engineer_member_delete_403', 'DELETE', `/api/projects/${pid}`, undefined, [
          '403 FORBIDDEN: an engineer member is not an admin (projects/router.py:80, access.py:96)',
        ]);
        expectError(del, 403, 'FORBIDDEN');
        const kept = await call(admin, 'BE1-G-047_admin_read_200', 'GET', `/api/projects/${pid}`, undefined, ['200 ProjectOut: the refused DELETE left the project in place']);
        expect(kept.res.status(), 'project still exists').toBe(200);
      });

      await test.step('[BE1-G-105] admin removes a live user who is not a member, then a well-formed unknown id → 404 NOT_FOUND resource member each', async () => {
        for (const [slug, id] of [['live_non_member', engOutsider.id], ['unknown', `usr_${'0'.repeat(26)}`]] as const) {
          const sent = await call(admin, `BE1-G-105_remove_${slug}_404`, 'DELETE', `${membersPath}/${id}`, undefined, [
            '404 NOT_FOUND resource member: no membership row joins this user (project_members/service.py:42-46,108-116)',
          ]);
          expectError(sent, 404, 'NOT_FOUND', { resource: 'member' });
        }
      });

      await test.step('[BE1-G-107] admin removes the engineer → 200; then removes itself, the last active editor (the viewer remains) → 422 MEMBER_LAST_EDITOR, members unchanged', async () => {
        const removed = await call(admin, 'BE1-G-107_remove_engineer_200', 'DELETE', `${membersPath}/${engMember.id}`, undefined, ['200 UserOut of the engineer (built before the removal)']);
        expect(removed.res.status(), 'setup: remove the other editor').toBe(200);
        const before = await memberIds('BE1-G-107_members_before');
        expect.soft(before, 'admin + viewer left').toEqual([adminId, viewer.id].sort());
        const self = await call(admin, 'BE1-G-107_remove_self_last_editor_422', 'DELETE', `${membersPath}/${adminId}`, undefined, [
          '422 MEMBER_LAST_EDITOR: editors = active admin / engineer members = [admin]; a viewer is not an editor (service.py:49-52,111-118; projects/memberships.py:25,74-91)',
        ]);
        expectError(self, 422, 'MEMBER_LAST_EDITOR');
        expect.soft(await memberIds('BE1-G-107_members_after'), 'nothing changed').toEqual(before);
      });
    } finally {
      await cleanup.run();
    }
  });
});
