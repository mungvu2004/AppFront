/**
 * Phase 5 — backend behind the 3D screens (`/3d`, `/3d/measure`, `/m/du-an`) through the real API (skill `qa-api-test`),
 * no browser, NO mocks. Plan: QA-05c `flows-C6.md` FL-BE5-01..04 (38 catalog rows B05-G-*). The measurement routes
 * #16 / #17 / #18 keep their own suite `phase05_3d_viewer_api.spec.ts` (FL-A5-01..08).
 * Helpers: `support/p05/P7.ts` (call + exchange evidence `A05_<row>_<slug>.json`, seeds, layer edits).
 *
 * ## Budget per run (BE defaults + `qa-limits.override.yml`)
 * - Logins (`signedInApi`) <= 5 per flow: FL-BE5-01 admin + viewer + admin2 (3); FL-BE5-02 admin + engineer + demoted (3);
 *   FL-BE5-03 admin + engineer (2); FL-BE5-04 none. 8 in total, 0 failed — below LOGIN_IP_LIMIT (BE:auth/settings.py:36-37).
 * - 0 new invitations: pool slots `p05-api` (viewer / engineer / admin) and `p05-api-demote` exist from earlier phases
 *   or are created once (`poolUser`); one #41 role change + its restore in `finally`.
 * - No rate limit on any route hit here (grep `rate_limit(` in projects/, spatial_read/, spatial_write/, rules/, templates/,
 *   measurements/, telemetry/; nginx has no `limit_req` on /api/ or the static paths).
 * - Projects: FL-BE5-01 3 (Q2L + DEL), FL-BE5-02 1, FL-BE5-03 1 — all deleted in `finally`.
 */
import { createHash } from 'node:crypto';
import { readFileSync } from 'node:fs';

import { expect, test } from '@playwright/test';

import { ProjectSchema } from '../../src/api/schemas/index';
import { SpatialGraphDocumentSchema } from '../../src/api/schemas/spatialGraph';
import { propertyTemplateDraftOf } from '../../src/lib/pascal/template';
import { newApiContext, signedInApi } from './support/api';
import { poolUser } from './support/phase03Seed';
import {
  Cleanup, MISSING_PROJECT, DEMOTE_SLOT, adminApi, asJson, call, deletedProjectId, expectError, expectZod, graphPath,
  instant, itemsOf, layerOf, layerPath, measurementsPath, memberApi, mintedEntities, moveWall, note, objs, projectDoc,
  projectPath, putLayer, readGraphDoc, readLayerDoc, revisionIn, rulePath, seedProject, templatesPath, versionsPath,
  type Json, type Method,
} from './support/p05/P7';

const API = 'A05 phase-5 backend behind the 3D screens';

test.describe(API, () => {
  test('SCR-BE · FL-BE5-01 · gate reads behind /3d, /3d/measure, /m/du-an: anonymous, roles, contract decode, non-member', async () => {
    const cleanup = new Cleanup();
    const anon = await newApiContext();
    cleanup.add(() => anon.dispose());
    try {
      const admin = await adminApi(cleanup);
      const [t1, t2] = await seedProject(admin, cleanup, 'p05be-gate', ['Tầng 1', 'Tầng 2'], 2);
      if (!t1 || !t2) throw new Error('seed Q2L: two floors expected');
      const p = t1.projectId;
      const del = await deletedProjectId(admin);
      const viewer = await memberApi(admin, cleanup, 'viewer', p);
      const admin2 = await memberApi(admin, cleanup, 'admin', null);
      const n15Admin = await readGraphDoc(admin, 'B05-G-020_admin_n15', p);

      await test.step('[B05-G-002] anonymous on #24, N15, N16, N21, #35 (truncated JSON), #29, #9 → 401 UNAUTHENTICATED', async () => {
        // core/routing.py:129-136 (principal before the body / path ids).
        const routes: Array<[string, Method, string, unknown]> = [
          ['p24', 'GET', projectPath(p), undefined],
          ['n15', 'GET', graphPath(p), undefined],
          ['n16', 'GET', layerPath(p, t1.floorId), undefined],
          ['n21', 'GET', rulePath(p), undefined],
          ['n35_truncated', 'PUT', layerPath(p, t1.floorId), Buffer.from('{"baseVersion":1,"body":{"layer":')],
          ['n29', 'POST', templatesPath(p), { name: 'x', objectKind: 'room', fields: {} }],
          ['n9', 'GET', '/api/feature-flags', undefined],
        ];
        for (const [slug, method, path, data] of routes) {
          const sent = await call(anon, `B05-G-002_anon_${slug}`, method, path, data, ['401 UNAUTHENTICATED before the body is read']);
          expectError(sent, 401, 'UNAUTHENTICATED');
        }
      });

      await test.step('[B05-G-011] the real #24 body decodes with the FE zod ProjectSchema', async () => {
        const body = await projectDoc(admin, 'B05-G-011_project', p);
        expectZod(ProjectSchema, body, '#24');
      });

      await test.step('[B05-G-007] viewer member row in #24 members[] has system role viewer', async () => {
        // ACC:24-29,103-108; FE `rolesOf` reads this row.
        const body = await projectDoc(admin, 'B05-G-007_project', p);
        const row = objs(body.members, 'members').find((m) => m.id === viewer.user.id);
        expect.soft(row, 'viewer is listed in members[]').toBeDefined();
        expect.soft(row?.role).toBe('viewer');
      });

      await test.step('[B05-G-020] N15 as the viewer equals the admin\'s N15', async () => {
        const sent = await call(viewer.api, 'B05-G-020_viewer_n15', 'GET', graphPath(p), undefined, ['200: any member reads N15, same document']);
        expect.soft(sent.res.status()).toBe(200);
        expect.soft(sent.body).toEqual(n15Admin);
      });

      await test.step('[B05-G-021] N15 floorRevisions equal N16 revision per floor, = 1 after the seed write', async () => {
        for (const [i, floor] of [t1, t2].entries()) {
          const doc = await readLayerDoc(admin, `B05-G-021_n16_t${String(i + 1)}`, p, floor.floorId);
          expect.soft(revisionIn(n15Admin, floor.floorId), `${floor.floorName} N15 revision`).toBe(doc.revision);
          expect.soft(doc.revision, `${floor.floorName} seed revision`).toBe(1);
        }
      });

      await test.step('[B05-G-027] the real N15 body decodes with the FE zod SpatialGraphDocumentSchema', async () => {
        const graph = await readGraphDoc(admin, 'B05-G-027_n15', p);
        expectZod(SpatialGraphDocumentSchema, graph, 'N15');
      });

      await test.step('[B05-G-032] N21 as the viewer → 200 {revision: 0, overrides: {}}', async () => {
        const sent = await call(viewer.api, 'B05-G-032_viewer_n21', 'GET', rulePath(p), undefined, ['200 for any member; never configured']);
        expect.soft(sent.res.status()).toBe(200);
        expect.soft(sent.body).toEqual({ revision: 0, overrides: {} });
      });

      await test.step('[B05-G-005] admin non-member: #24, N15, #16 → 404 resource project (404 beats 403)', async () => {
        // ACC:94-101 (K08).
        for (const [slug, path] of [['p24', projectPath(p)], ['n15', graphPath(p)], ['p16', measurementsPath(p)]] as const) {
          const sent = await call(admin2.api, `B05-G-005_admin2_${slug}`, 'GET', path, undefined, ['404 resource project for a system admin who is not a member']);
          expectError(sent, 404, 'NOT_FOUND', { resource: 'project' });
        }
      });

      await test.step('[B05-G-006] nope / prj_000… / DEL id on #24, N15, N21 → 404 resource project', async () => {
        // ACC:36-41,94-101: a malformed id is answered without a DB query.
        for (const [idSlug, id] of [['nope', 'nope'], ['missing', MISSING_PROJECT], ['deleted', del]] as const) {
          for (const [slug, path] of [['p24', projectPath(id)], ['n15', graphPath(id)], ['n21', rulePath(id)]] as const) {
            const sent = await call(admin, `B05-G-006_${idSlug}_${slug}`, 'GET', path, undefined, ['404 resource project']);
            expectError(sent, 404, 'NOT_FOUND', { resource: 'project' });
          }
        }
      });

      await test.step('[B05-G-013] reads of #24 and N15 never move updatedAt', async () => {
        // R24:49 (read only): /3d/measure reads #24 twice + N15.
        const before = await projectDoc(admin, 'B05-G-013_p24_before', p);
        await projectDoc(admin, 'B05-G-013_p24_again', p);
        await readGraphDoc(admin, 'B05-G-013_n15', p);
        const after = await projectDoc(admin, 'B05-G-013_p24_after', p);
        expect.soft(after.updatedAt).toBe(before.updatedAt);
      });
    } finally {
      await cleanup.run();
    }
  });

  test('SCR-BE · FL-BE5-02 · 3D autosave #35: base from N15, conflict with a QC writer, "Tải lại", storey move, audit, demotion', async () => {
    test.setTimeout(120_000);
    const cleanup = new Cleanup();
    try {
      const admin = await adminApi(cleanup);
      const [t1, t2] = await seedProject(admin, cleanup, 'p05be-save', ['Tầng 1', 'Tầng 2'], 2);
      if (!t1 || !t2) throw new Error('seed Q2L: two floors expected');
      const p = t1.projectId;
      const w2 = await memberApi(admin, cleanup, 'engineer', p);
      // The pooled demote user may be stuck at viewer from an aborted run: set engineer before it signs in.
      const demUser = await poolUser(admin, 'engineer', DEMOTE_SLOT);
      const reset = await admin.patch(`/api/users/${demUser.id}/role`, { data: { userId: demUser.id, role: 'engineer' } });
      expect(reset.status(), 'setup: demote slot back to engineer').toBe(200);
      const dem = await memberApi(admin, cleanup, 'engineer', p, DEMOTE_SLOT);
      // State before step 1 (steps 8 and 9 compare against it).
      const updatedBefore = (await projectDoc(admin, 'B05-G-163_project_before', p)).updatedAt;
      const versionsBefore = itemsOf((await call(admin, 'B05-G-162_versions_before', 'GET', versionsPath(p, t1.floorId), undefined, ['N17 before the first #35'])).body, 'N17').length;
      let rev = revisionIn(await readGraphDoc(admin, 'B05-G-040_n15_base', p), t1.floorId);
      let conflict: Json = {};

      await test.step('[B05-G-040] PUT Tầng 1 with baseVersion from N15 floorRevisions → 200 revision + 1', async () => {
        const doc = await readLayerDoc(admin, 'B05-G-040_n16', p, t1.floorId);
        const sent = await putLayer(admin, 'B05-G-040_put', p, t1.floorId, rev, moveWall(layerOf(doc), 0, 100), ['200 {revision: base + 1, layer}']);
        expect(sent.res.status(), 'first #35 on the N15 base').toBe(200);
        expect(asJson(sent.body).revision).toBe(rev + 1);
        rev += 1;
        expect.soft(revisionIn(await readGraphDoc(admin, 'B05-G-040_n15_after', p), t1.floorId)).toBe(rev);
      });

      await test.step('[B05-G-041] layer with wall / opening / room / furniture minted by the FE createId → 200, N16 lists the ids', async () => {
        // EID:68-115; FE lib/pascal/toSpatial.ts:111-125.
        const doc = await readLayerDoc(admin, 'B05-G-041_n16', p, t1.floorId);
        const layer = layerOf(doc);
        const minted = mintedEntities(String(asJson(doc.level).id));
        layer.walls.push(minted.wall);
        layer.openings.push(minted.opening);
        layer.rooms.push(minted.room);
        layer.furniture.push(minted.furniture);
        const sent = await putLayer(admin, 'B05-G-041_put', p, t1.floorId, rev, layer, ['200 revision + 1; ids claimed for the project']);
        expect.soft(sent.res.status(), JSON.stringify(sent.body).slice(0, 200)).toBe(200);
        rev += 1;
        const back = layerOf(await readLayerDoc(admin, 'B05-G-041_n16_after', p, t1.floorId));
        expect.soft(back.walls.map((w) => w.id)).toContain(minted.wall.id);
        expect.soft(back.openings.map((o) => o.id)).toContain(minted.opening.id);
        expect.soft(back.rooms.map((r) => r.id)).toContain(minted.room.id);
        expect.soft(back.furniture.map((f) => f.id)).toContain(minted.furniture.id);
      });

      await test.step('[B05-G-042] geometry edit of a human-reviewed item sent reviewed:false → item and level end up unreviewed', async () => {
        // FE C2 rule: an edit clears `reviewed`. First mark wall 1 human + reviewed (allowed: source human).
        let doc = await readLayerDoc(admin, 'B05-G-042_n16', p, t1.floorId);
        let layer = layerOf(doc);
        for (const item of [...layer.walls, ...layer.openings, ...layer.rooms, ...layer.furniture]) Object.assign(item, { reviewed: true, source: 'human' });
        const marked = await putLayer(admin, 'B05-G-042_put_reviewed', p, t1.floorId, rev, layer, ['200: human items may be reviewed']);
        expect(marked.res.status()).toBe(200);
        rev = Number(asJson(marked.body).revision);
        doc = await readLayerDoc(admin, 'B05-G-042_n16_reviewed', p, t1.floorId);
        expect.soft(asJson(doc.level).reviewed, 'level reviewed once every item is').toBe(true);
        layer = moveWall(layerOf(doc), 1, 50);
        Object.assign(layer.walls[1] ?? {}, { reviewed: false });
        const edited = await putLayer(admin, 'B05-G-042_put_edit', p, t1.floorId, rev, layer, ['200: edited geometry, reviewed:false']);
        expect.soft(edited.res.status()).toBe(200);
        rev = Number(asJson(edited.body).revision);
        const after = await readLayerDoc(admin, 'B05-G-042_n16_after', p, t1.floorId);
        expect.soft(layerOf(after).walls[1]?.reviewed, 'item reviewed').toBe(false);
        expect.soft(asJson(after.level).reviewed, 'level reviewed').toBe(false);
      });

      await test.step('[B05-G-043] E writes at the current base, then admin writes at its older base → 409 VERSION_CONFLICT', async () => {
        const base = rev;
        const doc = await readLayerDoc(admin, 'B05-G-043_n16', p, t1.floorId);
        const theirs = layerOf(doc);
        Object.assign(theirs.walls[0] ?? {}, { thicknessMm: 250 });
        const e = await putLayer(w2.api, 'B05-G-043_e_put', p, t1.floorId, base, theirs, ['200: E writes first']);
        expect(e.res.status()).toBe(200);
        rev = base + 1;
        const mine = moveWall(layerOf(doc), 0, 20);
        const sent = await putLayer(admin, 'B05-G-043_admin_stale', p, t1.floorId, base, mine, ['409 VERSION_CONFLICT with currentVersion and remoteChanges']);
        conflict = expectError(sent, 409, 'VERSION_CONFLICT');
        expect.soft(conflict.currentVersion).toBe(rev);
        expect.soft(objs(conflict.remoteChanges, 'remoteChanges').length, 'remoteChanges not empty').toBeGreaterThan(0);
      });

      await test.step('[B05-G-044] remoteChanges[0] names E: changedBy = E id, changedByName = E name from #24 members[]', async () => {
        // SW:36-42; WR:593-617.
        const members = objs((await projectDoc(admin, 'B05-G-044_project', p)).members, 'members');
        const first = objs(conflict.remoteChanges, 'remoteChanges')[0];
        expect.soft(first?.changedBy).toBe(w2.user.id);
        expect.soft(first?.changedByName).toBe(members.find((m) => m.id === w2.user.id)?.name);
      });

      await test.step('[B05-G-060] "Tải lại": N16 revision == 409 currentVersion with E\'s layer; PUT on it → 200 revision + 1', async () => {
        const doc = await readLayerDoc(admin, 'B05-G-060_n16', p, t1.floorId);
        expect.soft(doc.revision).toBe(conflict.currentVersion);
        expect.soft(layerOf(doc).walls[0]?.thicknessMm, 'E\'s thickness').toBe(250);
        // An unchanged layer is a 200 that keeps the revision (writer.py:340-341), so change one detail.
        const sent = await putLayer(admin, 'B05-G-060_put', p, t1.floorId, Number(doc.revision), moveWall(layerOf(doc), 0, 10), ['200 revision + 1 on the reloaded base']);
        expect.soft(sent.res.status()).toBe(200);
        expect.soft(asJson(sent.body).revision).toBe(Number(doc.revision) + 1);
        rev = Number(asJson(sent.body).revision);
      });

      await test.step('[B05-G-052] ⚑5 wall moved to the other storey: Tầng 2 PUT → 422 LAYER_INTEGRITY_BROKEN {count: 1}; release on Tầng 1 → 200; Tầng 2 again → 200', async () => {
        // WR:560-572; EID:68-115. ⚑5: the UI must not leave the target floor blocked (FE SLS:89-97) — asserted here as the BE half.
        const d1 = await readLayerDoc(admin, 'B05-G-052_n16_t1', p, t1.floorId);
        const d2 = await readLayerDoc(admin, 'B05-G-052_n16_t2', p, t2.floorId);
        const l1 = layerOf(d1);
        const taken = l1.walls.find((w) => (w.openingIds as unknown[]).length === 0);
        if (!taken) throw new Error('no wall without openings on Tầng 1');
        const l2 = layerOf(d2);
        l2.walls.push({ ...taken, levelId: asJson(d2.level).id });
        const first = await putLayer(admin, 'B05-G-052_t2_blocked', p, t2.floorId, Number(d2.revision), l2, ['422 LAYER_INTEGRITY_BROKEN count 1: the id is live on Tầng 1']);
        expectError(first, 422, 'LAYER_INTEGRITY_BROKEN');
        expect.soft(asJson(first.body).count).toBe(1);
        l1.walls = l1.walls.filter((w) => w.id !== taken.id);
        const release = await putLayer(admin, 'B05-G-052_t1_release', p, t1.floorId, rev, l1, ['200: the source floor lets the id go']);
        expect.soft(release.res.status()).toBe(200);
        rev = Number(asJson(release.body).revision);
        const second = await putLayer(admin, 'B05-G-052_t2_ok', p, t2.floorId, Number(d2.revision), l2, ['200: the same Tầng 2 body after the release']);
        expect.soft(second.res.status()).toBe(200);
      });

      await test.step('[B05-G-162] #35 creates no version and no notification', async () => {
        // WR:502-530 (no on_after_commit).
        const versions = itemsOf((await call(admin, 'B05-G-162_versions_after', 'GET', versionsPath(p, t1.floorId), undefined, ['N17 count unchanged'])).body, 'N17');
        expect.soft(versions.length).toBe(versionsBefore);
        const notes = itemsOf((await call(w2.api, 'B05-G-162_notifications_after', 'GET', '/api/notifications', undefined, ['E has no notification about this project from a write'])).body, 'notifications');
        // projectInvite is the add-member notice (other flows share this pool user); only write-made ones count.
        expect.soft(notes.filter((n) => n.projectId === p && n.kind !== 'projectInvite')).toEqual([]);
      });

      await test.step('[B05-G-163] updatedAt advanced; N15 floorRevisions Tầng 1 = the last 200\'s revision', async () => {
        const after = (await projectDoc(admin, 'B05-G-163_project_after', p)).updatedAt;
        expect.soft(instant(after)).toBeGreaterThan(instant(updatedBefore));
        expect.soft(revisionIn(await readGraphDoc(admin, 'B05-G-163_n15', p), t1.floorId)).toBe(rev);
      });

      await test.step('[B05-G-062] floor soft-deleted between the 409 and the reload → N16 404 resource floor', async () => {
        const del = await call(admin, 'B05-G-062_floor_delete', 'DELETE', `/api/floors/${t2.floorId}`, undefined, ['setup: soft-delete Tầng 2 → 200']);
        expect(del.res.status()).toBe(200);
        const sent = await call(admin, 'B05-G-062_n16_after_delete', 'GET', layerPath(p, t2.floorId), undefined, ['404 resource floor']);
        expectError(sent, 404, 'NOT_FOUND', { resource: 'floor' });
      });

      await test.step('[B05-G-008] engineer demoted to viewer by #41 → next #35 is 403 FORBIDDEN within 5 s', async () => {
        // AUS:21,35; auth/sessions.py:608-618 (principal cache <= AUTH_PRINCIPAL_CACHE_TTL_S = 5 s).
        // #41 bumps token_version and clears the principal cache: the old Bearer is revoked (401), a new session sees viewer (403).
        const doc = await readLayerDoc(dem.api, 'B05-G-008_n16', p, t1.floorId);
        const before = await putLayer(dem.api, 'B05-G-008_engineer_put', p, t1.floorId, Number(doc.revision), moveWall(layerOf(doc), 2, 10), ['200: engineer member may write']);
        expect(before.res.status(), 'engineer member may write').toBe(200);
        cleanup.add(async () => {
          const back = await admin.patch(`/api/users/${dem.user.id}/role`, { data: { userId: dem.user.id, role: 'engineer' } });
          if (back.status() !== 200) throw new Error(`restore role -> ${String(back.status())}`);
        });
        const role = await call(admin, 'B05-G-008_demote', 'PATCH', `/api/users/${dem.user.id}/role`, { userId: dem.user.id, role: 'viewer' }, ['setup: #41 engineer -> viewer']);
        expect(role.res.status()).toBe(200);
        const stale = await putLayer(dem.api, 'B05-G-008_old_token_put', p, t1.floorId, Number(asJson(before.body).revision), layerOf(doc), ['401 SESSION_REVOKED: the old Bearer died with the role change (sessions.py:575-578)']);
        expectError(stale, 401, 'SESSION_REVOKED');
        const fresh = await signedInApi(dem.user.email, dem.user.password);
        cleanup.add(() => fresh.dispose());
        const after = await readLayerDoc(fresh, 'B05-G-008_fresh_n16', p, t1.floorId);
        const denied = await putLayer(fresh, 'B05-G-008_viewer_put', p, t1.floorId, Number(after.revision), moveWall(layerOf(after), 2, 10), ['403 FORBIDDEN: the new session is a viewer']);
        expectError(denied, 403, 'FORBIDDEN');
        note('B05-G-008: FE copy "Bạn không còn quyền sửa tầng này." is asserted by the UI layer.');
      });
    } finally {
      await cleanup.run();
    }
  });

  test('SCR-BE · FL-BE5-03 · writes of the 3D tools besides the layer: pin retry / undo across two sessions, 3D pick values, "Lưu làm khuôn mẫu"', async () => {
    const cleanup = new Cleanup();
    try {
      const admin = await adminApi(cleanup);
      const [floor] = await seedProject(admin, cleanup, 'p05be-tools');
      if (!floor) throw new Error('seed P1: one floor expected');
      const p = floor.projectId;
      const e = await memberApi(admin, cleanup, 'engineer', p);
      const rec = (id: string, over: Json = {}): Json => ({
        id, name: `Đo ${id}`, mode: 'pointToPoint', points: [{ x: 0, y: 0 }, { x: 1000, y: 0 }], rawValueMm: 1000, ...over,
      });
      const ids = async (ev: string, who = admin): Promise<Json[]> => {
        const sent = await call(who, ev, 'GET', measurementsPath(p), undefined, ['200 bare array of records']);
        expect(sent.res.status(), ev).toBe(200);
        return objs(sent.body, '#16');
      };
      expect((await call(admin, 'B05-G-086_seed_ms1', 'POST', measurementsPath(p), rec('MS-0001'), ['setup: 201 MS-0001'])).res.status()).toBe(201);

      await test.step('[B05-G-086] pin retry after a 409: E pinned MS-0002; admin\'s draft MS-0002 → 409 id; re-read lists E\'s; MS-0003 → 201', async () => {
        // MTG:646-672 (freshIdentity = re-read + next id).
        const theirs = rec('MS-0002', { name: 'Đo của E' });
        expect.soft((await call(e.api, 'B05-G-086_e_pin', 'POST', measurementsPath(p), theirs, ['201: E pins MS-0002'])).res.status()).toBe(201);
        const clash = await call(admin, 'B05-G-086_admin_clash', 'POST', measurementsPath(p), rec('MS-0002', { rawValueMm: 2 }), ['409 MEASUREMENT_ID_TAKEN field id']);
        expectError(clash, 409, 'MEASUREMENT_ID_TAKEN', { field: 'id' });
        expect.soft((await ids('B05-G-086_reread')).find((r) => r.id === 'MS-0002')).toEqual(theirs);
        expect.soft((await call(admin, 'B05-G-086_admin_retry', 'POST', measurementsPath(p), rec('MS-0003'), ['201: renumbered'])).res.status()).toBe(201);
      });

      await test.step('[B05-G-087] undo after another session reused the id: re-POST → 409; re-read; MS-0004 → 201; E\'s MS-0003 untouched', async () => {
        // MUT:183-195; MTG:691-694.
        const old = rec('MS-0003');
        expect.soft((await call(admin, 'B05-G-087_delete', 'DELETE', `${measurementsPath(p)}/MS-0003`, undefined, ['204'])).res.status()).toBe(204);
        const theirs = rec('MS-0003', { name: 'Đo của E 3', rawValueMm: 3 });
        expect.soft((await call(e.api, 'B05-G-087_e_create', 'POST', measurementsPath(p), theirs, ['201: E reuses the id'])).res.status()).toBe(201);
        expectError(await call(admin, 'B05-G-087_undo', 'POST', measurementsPath(p), old, ['409 MEASUREMENT_ID_TAKEN']), 409, 'MEASUREMENT_ID_TAKEN', { field: 'id' });
        const now = await ids('B05-G-087_reread');
        expect.soft((await call(admin, 'B05-G-087_renumbered', 'POST', measurementsPath(p), { ...old, id: 'MS-0004' }, ['201 as MS-0004'])).res.status()).toBe(201);
        expect.soft(now.find((r) => r.id === 'MS-0003')).toEqual(theirs);
      });

      await test.step('[B05-G-088] 3D pick values: height with fractional x/y/z → 201; #16 returns the same floats, z kept', async () => {
        const points = [{ x: 1234.5678, y: -0.25, z: 2750.25 }, { x: 1234.5678, y: -0.25, z: 0.125 }];
        const sent = await call(admin, 'B05-G-088_create', 'POST', measurementsPath(p), rec('MS-0005', { mode: 'height', points, rawValueMm: 2750.125 }), ['201 height']);
        expect.soft(sent.res.status()).toBe(201);
        expect.soft((await ids('B05-G-088_list')).find((r) => r.id === 'MS-0005')?.points).toEqual(points);
      });

      await test.step('[B05-G-089] floorArea 4000 x 5000 square with rawValueMm 1 → 201, stored as sent', async () => {
        const points = [{ x: 0, y: 0 }, { x: 4000, y: 0 }, { x: 4000, y: 5000 }, { x: 0, y: 5000 }];
        const sent = await call(admin, 'B05-G-089_create', 'POST', measurementsPath(p), rec('MS-0006', { mode: 'floorArea', points, rawValueMm: 1 }), ['201: BE stores the sent rawValueMm']);
        expect.soft(sent.res.status()).toBe(201);
        expect.soft((await ids('B05-G-089_list')).find((r) => r.id === 'MS-0006')?.rawValueMm).toBe(1);
      });

      const layerDoc = await readLayerDoc(admin, 'B05-G-120_n16', p, floor.floorId);
      const layer = layerOf(layerDoc);
      const wall = layer.walls[0];
      const door = layer.openings[0];
      const room = layer.rooms[0];
      const table = layer.furniture[0];
      if (!wall || !door || !room || !table) throw new Error('qcLayer entities missing');
      const draftOf = (entity: Json): Json => {
        const draft = propertyTemplateDraftOf(entity as never);
        if (draft === null) throw new Error(`no draft for ${String(entity.id)}`);
        return draft as unknown as Json;
      };

      await test.step('[B05-G-120] the 4 drafts the FE builds from wall / door / room / table → 201 each, scope project, fields echoed', async () => {
        // TPL:29,32-60,82-86; name = "Khuôn <loại> <id>".
        for (const [slug, entity] of [['wall', wall], ['opening', door], ['room', room], ['furniture', table]] as const) {
          const draft = draftOf(entity);
          const sent = await call(admin, `B05-G-120_${slug}`, 'POST', templatesPath(p), draft, [`201 ${slug} template`]);
          expect.soft(sent.res.status(), slug).toBe(201);
          const body = asJson(sent.body);
          expect.soft(body.scope).toBe('project');
          expect.soft(body.fields).toEqual(draft.fields);
          expect.soft(body.name).toBe(draft.name);
          expect.soft(String(body.name)).toContain(String(entity.id));
        }
      });

      await test.step('[B05-G-121] furniture rotationDeg 359.5 → 201; 360 → 422 field fields.rotationDeg', async () => {
        // TS:17,51 ([0, 360)); FE normalises in toSpatial.ts:105-109.
        const base = draftOf(table);
        const ok = await call(admin, 'B05-G-121_359_5', 'POST', templatesPath(p), { ...base, fields: { ...asJson(base.fields), rotationDeg: 359.5 } }, ['201']);
        expect.soft(ok.res.status()).toBe(201);
        const bad = await call(admin, 'B05-G-121_360', 'POST', templatesPath(p), { ...base, fields: { ...asJson(base.fields), rotationDeg: 360 } }, ['422 VALIDATION fields.rotationDeg']);
        expectError(bad, 422, 'VALIDATION', { field: 'fields.rotationDeg' });
      });
    } finally {
      await cleanup.run();
    }
  });

  test('SCR-BE · FL-BE5-04 · static Pascal resources and headers of the web image (no auth)', async () => {
    const web = await newApiContext();
    const head = (h: Record<string, string>, k: string): string | undefined => h[k.toLowerCase()];
    const mountPath = '/assets/pascal/pascal-mount.js';
    let mountBody = '';
    let csp = '';
    try {
      await test.step('[B05-G-140] pascal-mount.js: 200 JavaScript, no-cache, CSP, nosniff', async () => {
        // NG:75-79.
        const sent = await call(web, 'B05-G-140_mount', 'GET', mountPath, undefined, ['200 javascript, Cache-Control no-cache, CSP, nosniff']);
        mountBody = typeof sent.body === 'string' ? sent.body : '';
        const h = sent.res.headers();
        expect(sent.res.status(), 'pascal-mount.js').toBe(200);
        expect.soft(head(h, 'content-type')).toMatch(/javascript/u);
        expect.soft(head(h, 'cache-control')).toBe('no-cache');
        expect.soft(head(h, 'content-security-policy')).toBeTruthy();
        expect.soft(head(h, 'x-content-type-options')).toBe('nosniff');
      });

      await test.step('[B05-G-141] ?v=<8 hex> and ?v=…&attempt=1 → 200, same bytes and headers', async () => {
        // UPV:58-73; vite.config.ts:20-26.
        const v = createHash('sha256').update(mountBody).digest('hex').slice(0, 8);
        const plain = await web.get(mountPath);
        for (const [slug, query] of [['v', `?v=${v}`], ['attempt', `?v=${v}&attempt=1`]] as const) {
          const sent = await call(web, `B05-G-141_${slug}`, 'GET', `${mountPath}${query}`, undefined, ['200, same bytes and headers as without the query']);
          expect.soft(sent.res.status()).toBe(200);
          expect.soft(sent.body).toBe(mountBody);
          expect.soft(head(sent.res.headers(), 'cache-control')).toBe(head(plain.headers(), 'cache-control'));
          expect.soft(head(sent.res.headers(), 'content-security-policy')).toBe(head(plain.headers(), 'content-security-policy'));
        }
      });

      await test.step('[B05-G-142] first hashed ./<name>-<hash8>.js chunk → 200, immutable one-year cache', async () => {
        // NG:68-72.
        const match = /\.\/([\w.-]+-[A-Za-z0-9_-]{8}\.js)/u.exec(mountBody);
        expect(match, 'pascal-mount.js imports a hashed chunk').not.toBeNull();
        const sent = await call(web, 'B05-G-142_chunk', 'GET', `/assets/pascal/${match?.[1] ?? ''}`, undefined, ['200 Cache-Control public, max-age=31536000, immutable']);
        expect.soft(sent.res.status()).toBe(200);
        expect.soft(head(sent.res.headers(), 'cache-control')).toBe('public, max-age=31536000, immutable');
      });

      await test.step('[B05-G-144] /draco/draco_decoder.wasm → 200 application/wasm', async () => {
        const sent = await call(web, 'B05-G-144_draco', 'GET', '/draco/draco_decoder.wasm', undefined, ['200 application/wasm']);
        expect.soft(sent.res.status()).toBe(200);
        expect.soft(head(sent.res.headers(), 'content-type')).toContain('application/wasm');
      });

      await test.step('[B05-G-145] ⚑1 /basis/basis_transcoder.wasm → 200 wasm; /basis/qa-missing.wasm → 404 (not text/html)', async () => {
        // NG:63-66: no /basis/ location today, `location /` answers index.html 200.
        const found = await call(web, 'B05-G-145_basis', 'GET', '/basis/basis_transcoder.wasm', undefined, ['200 application/wasm']);
        expect.soft(found.res.status()).toBe(200);
        expect.soft(head(found.res.headers(), 'content-type')).toContain('application/wasm');
        const missing = await call(web, 'B05-G-145_missing', 'GET', '/basis/qa-missing.wasm', undefined, ['404, not the SPA index.html']);
        expect.soft(missing.res.status(), 'missing basis file').toBe(404);
        // nginx's own 404 page is text/html; what must not come back is the SPA index (location / try_files fallback).
        expect.soft(String(missing.body), 'not the SPA index.html').not.toContain('id="root"');
      });

      const ktx = '/pascal/material/concrete/concrete_plate/concrete_plate_basecolor_512.ktx2';
      await test.step('[B05-G-146] ⚑1 existing .ktx2 → 200 non-HTML; /pascal/material/qa-missing.ktx2 → 404', async () => {
        const found = await call(web, 'B05-G-146_ktx2', 'GET', ktx, undefined, ['200 with a non-HTML content type']);
        expect.soft(found.res.status()).toBe(200);
        expect.soft(head(found.res.headers(), 'content-type') ?? '').not.toContain('text/html');
        const missing = await call(web, 'B05-G-146_missing', 'GET', '/pascal/material/qa-missing.ktx2', undefined, ['404, not the SPA index.html']);
        expect.soft(missing.res.status(), 'missing material').toBe(404);
      });

      await test.step('[B05-G-147] .ktx2 headers: CSP + nosniff, Cache-Control public max-age=86400, ETag + Last-Modified', async () => {
        // /pascal/ is a bounded cache, not immutable (app_locations.conf:94-98).
        const h = (await call(web, 'B05-G-147_ktx2_headers', 'GET', ktx, undefined, ['CSP + nosniff, Cache-Control public max-age=86400, ETag + Last-Modified'])).res.headers();
        expect.soft(head(h, 'content-security-policy')).toBeTruthy();
        expect.soft(head(h, 'x-content-type-options')).toBe('nosniff');
        expect.soft(head(h, 'cache-control')).toBe('public, max-age=86400'); // app_locations.conf location /pascal/
        expect.soft(head(h, 'etag')).toBeTruthy();
        expect.soft(head(h, 'last-modified')).toBeTruthy();
      });

      await test.step('[B05-G-148] CSP of /projects/x/3d has the Pascal sources', async () => {
        // SH:6.
        const sent = await call(web, 'B05-G-148_csp', 'GET', '/projects/x/3d', undefined, ['CSP with wasm-unsafe-eval, worker blob:, connect self, img data: blob:']);
        csp = head(sent.res.headers(), 'content-security-policy') ?? '';
        expect(csp, 'CSP header').not.toBe('');
        expect.soft(csp).toContain("script-src 'self' 'wasm-unsafe-eval'");
        expect.soft(csp).toContain("worker-src 'self' blob:");
        expect.soft(csp).toContain("connect-src 'self'");
        expect.soft(csp).toContain("img-src 'self' data: blob:");
      });

      await test.step('[B05-G-149] the Pascal furniture catalog is self-hosted: no external origin in src / thumbnail, CSP not widened, a catalog asset is served locally', async () => {
        // vendor catalog-items.tsx (F-15 fix ee93939c): src / thumbnail are /items/<dir>/..., served at /pascal/items/.
        const source = readFileSync(new URL('../../vendor/pascal/packages/editor/src/components/ui/item-catalog/catalog-items.tsx', import.meta.url), 'utf8');
        const external = [...new Set([...source.matchAll(/\b(?:src|thumbnail):\s*'(https?:\/\/[^/']+)/gu)].map((m) => m[1] ?? ''))];
        expect.soft(external, 'external origins used by the catalog').toEqual([]);
        const local = /\b(?:src|thumbnail):\s*'(\/items\/[^']+)'/u.exec(source)?.[1];
        expect(local, 'catalog has a local /items/ asset').toBeDefined();
        const sent = await call(web, 'B05-G-149_local_asset', 'GET', `/pascal${local ?? ''}`, undefined, ['200 non-HTML: the catalog asset is served by the web image']);
        expect.soft(sent.res.status()).toBe(200);
        expect.soft(head(sent.res.headers(), 'content-type') ?? '').not.toContain('text/html');
        for (const name of ['connect-src', 'img-src']) {
          const directive = new RegExp(`${name}\\s([^;]*)`, 'u').exec(csp)?.[1] ?? '';
          expect.soft(directive.split(/\s+/u).filter((t) => /^https?:/u.test(t) && !/localhost|127\.0\.0\.1/u.test(t)), `${name} has no external origin`).toEqual([]);
        }
      });

      await test.step('[B05-G-150] HEAD / (MobileViewer ping) → 200, no-cache', async () => {
        // NM:54-77; NG:86-89.
        const sent = await call(web, 'B05-G-150_head', 'HEAD', '/', undefined, ['200 Cache-Control no-cache']);
        expect.soft(sent.res.status()).toBe(200);
        expect.soft(head(sent.res.headers(), 'cache-control')).toBe('no-cache');
      });

      await test.step('[B05-G-151] deep links /projects/<p>/3d, /3d/measure, /m/du-an/<p> → 200 text/html, no-cache, CSP', async () => {
        for (const [slug, path] of [
          ['3d', `/projects/${MISSING_PROJECT}/3d`],
          ['measure', `/projects/${MISSING_PROJECT}/3d/measure`],
          ['mobile', `/m/du-an/${MISSING_PROJECT}`],
        ] as const) {
          const sent = await call(web, `B05-G-151_${slug}`, 'GET', path, undefined, ['200 text/html index, no-cache, CSP']);
          expect.soft(sent.res.status(), path).toBe(200);
          expect.soft(head(sent.res.headers(), 'content-type')).toContain('text/html');
          expect.soft(head(sent.res.headers(), 'cache-control')).toBe('no-cache');
          expect.soft(head(sent.res.headers(), 'content-security-policy')).toBeTruthy();
        }
      });
    } finally {
      await web.dispose();
    }
  });
});
