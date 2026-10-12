/**
 * Phase 4 — spatial BACKEND behind the QC screens, real HTTP (skill `qa-api-test`), no browser, NO mocks (QA-04c pack P8).
 * Four flows, each ONE test of sequential steps titled with the catalog row id in brackets (catalog rows of `qa/coverage`, `flow-plan.md` FL-BE-*):
 *   FL-BE-01  settings N5 + quality #30 reads (SCR-14 / SCR-16 / SCR-18 / SCR-22 call them)
 *   FL-BE-02  #35 request headers and side channels (Origin, If-Match, Idempotency-Key, no event) + admin non-member
 *   FL-BE-03  scale across drawings: human scale before / between drawings, apply-all race, floor area, dashboard counts
 *   FL-BE-04  after a pipeline: level.reviewed vs provisional scale, QUALITY_LAYER_REVIEWED, versions N17
 * The 12 older tests (`phase04_qc_layers_api.spec.ts`) keep the layer read / write / versioning / scale rules.
 * `BE:` = `F:/App/AppBack` (main). Suspected bugs (flow-plan ⚑) assert the CORRECT behaviour and stay red if the app is wrong.
 *
 * ## Non-serial, own data
 * Every flow signs in on its own and creates its own `qa-<runId>-…` project(s); cleanup in `finally`
 * (`deleteSeededProject`; a project made by the pool engineer is deleted by the admin it adds as member, BUG-513).
 * Non-admin users are POOL users of slot `p04-p8` (`phase03Seed.poolUser`, never invited here). The flows with uploads sign
 * in as the pool ADMIN of this file (own `drawings_init` bucket: 60 / 600 s per user).
 *
 * ## Request budget per run (BE defaults + `qa-limits.override.yml`)
 * - `POST /api/auth/login` per IP 30 / 60 s (override 120): FL-BE-01 5 (main admin, pool admin / viewer / engineer, anon none),
 *   FL-BE-02 2 (+ 1 refresh), FL-BE-03 2, FL-BE-04 3 -> 12 at most.
 * - `drawings_init`: FL-BE-01 1, FL-BE-03 3, FL-BE-04 3 = 7 of 60 per 600 s for the pool admin; 7 real fake-ML runs.
 * - No rate limit on N16 / #35 / #33 / N15 / #12 / N5 / N6 / #30 / N17 / N1. Pool invitations: only on the first use of a slot.
 * - FL-BE-02 reads the engineer's activity + notifications twice; SSE is not opened (the stream needs a cookie session).
 */
import { request, expect, test, type APIRequestContext } from '@playwright/test';

import { VersionConflictBodySchema } from '../../src/api/schemas/errors';
import { FloorSchema } from '../../src/api/schemas/index';
import { ProjectSettingsSchema } from '../../src/api/schemas/projectSettings';
import { ImageQualityAssessmentSchema } from '../../src/api/schemas/quality';
import { SpatialGraphDocumentSchema } from '../../src/api/schemas/spatialGraph';
import { FloorLayerDocumentSchema, FloorLayerWriteResultSchema } from '../../src/api/schemas/spatialLayer';
import { FloorVersionPageSchema } from '../../src/api/schemas/versions';
import { PIPELINE_TIMEOUT_MS } from '../../e2e/fullstack/env';
import { newApiContext, signedInApi } from './support/api';
import { readAdminCredentials } from './support/auth';
import { TEST_DATA_PREFIX } from './support/evidence';
import {
  addProjectMember,
  createPipelineProject,
  createProject,
  deleteSeededProject,
  envDrawingPng,
  listFloors,
  poolUser,
  uploadDrawing,
  waitForRunOutcome,
  type PoolRole,
  type PoolUser,
} from './support/phase03Seed';
import {
  Cleanup,
  GOOD_CORNERS,
  approveAll,
  asArray,
  asJson,
  bearerContext,
  call,
  expectError,
  expectKeys,
  expectWritten,
  expectZod,
  furnitureOf,
  itemCount,
  layerOf,
  layerPath,
  note,
  objs,
  qualityPath,
  roomOf,
  settingsBody,
  sid,
  versionsPath,
  wallOf,
  writeBody,
  type Json,
  type Sent,
} from './support/p04/P8';

const SLOT = 'p04-p8';
const PREFIX = TEST_DATA_PREFIX;
const SYSTEM_PIPELINE = 'system:pipeline'; // packages/core/errors.py:144
const PIPELINE_NAME = 'hệ thống AI'; // apps/worker/pipeline_persist/constants.py:5
const SETTINGS_KEYS = ['buildingType', 'confidenceThreshold', 'defaultScaleMmPerPx', 'lengthUnit', 'revision', 'snapToleranceMm'] as const;

/* ------------------------------------------------------------------ small helpers */

async function mainAdmin(cleanup: Cleanup): Promise<APIRequestContext> {
  const { email, password } = readAdminCredentials();
  const api = await signedInApi(email, password);
  cleanup.add(() => api.dispose());
  return api;
}

interface Signed {
  readonly user: PoolUser;
  readonly api: APIRequestContext;
}

/** Pool user of this file's slot, signed in (1 login). */
async function poolApi(main: APIRequestContext, role: PoolRole, cleanup: Cleanup): Promise<Signed> {
  const user = await poolUser(main, role, SLOT);
  const api = await signedInApi(user.email, user.password);
  cleanup.add(() => api.dispose());
  return { user, api };
}

/** Registers the soft delete of a seeded project (a 403 from a non-admin owner falls back to the admin, BUG-513). */
function dropProject(cleanup: Cleanup, api: APIRequestContext, projectId: string): void {
  cleanup.add(async () => {
    const failed = await deleteSeededProject(api, projectId);
    if (failed !== null) note(`cleanup: ${failed}`);
  });
}

const put = (api: APIRequestContext, ev: string, pid: string, fid: string, data: unknown, claims: readonly string[], headers?: Record<string, string>): Promise<Sent> =>
  call(api, ev, 'PUT', layerPath(pid, fid), data, claims, headers);

/** N16 read-back: 200 + the FE zod; returns the body. */
async function readLayer(api: APIRequestContext, ev: string, pid: string, fid: string, claim: string): Promise<Json> {
  const sent = await call(api, ev, 'GET', layerPath(pid, fid), undefined, [claim]);
  expect(sent.res.status(), `N16 ${ev}`).toBe(200);
  expectZod(FloorLayerDocumentSchema, sent.body, 'N16');
  return asJson(sent.body);
}

/** N15 read-back: 200 + the FE zod; returns the body. */
async function readGraph(api: APIRequestContext, ev: string, pid: string, claim: string): Promise<Json> {
  const sent = await call(api, ev, 'GET', `/api/projects/${pid}/spatial`, undefined, [claim]);
  expect(sent.res.status(), `N15 ${ev}`).toBe(200);
  expectZod(SpatialGraphDocumentSchema, sent.body, 'N15');
  return asJson(sent.body);
}

/** #12 read-back: 200 + the FE zod per floor; returns the items in server order. */
async function readFloors(api: APIRequestContext, ev: string, pid: string, claim: string): Promise<Json[]> {
  const sent = await call(api, ev, 'GET', `/api/projects/${pid}/floors`, undefined, [claim]);
  expect(sent.res.status(), `#12 ${ev}`).toBe(200);
  return objs(sent.body, '#12').map((f) => {
    expectZod(FloorSchema, f, '#12 item');
    return f;
  });
}

/** N1 summary row of one project (every page at limit 500, like the FE). */
async function summaryOf(api: APIRequestContext, ev: string, pid: string): Promise<Json> {
  let cursor: string | undefined;
  for (let page = 0; page < 20; page += 1) {
    const path = `/api/project-summaries?limit=500${cursor === undefined ? '' : `&cursor=${encodeURIComponent(cursor)}`}`;
    const sent = await call(api, `${ev}_p${String(page)}`, 'GET', path, undefined, ['200 CursorPage of ProjectSummary (N1)']);
    expect(sent.res.status(), 'N1').toBe(200);
    const body = expectKeys(sent.body, ['items'], ['nextCursor']);
    const row = objs(body.items, 'items').find((item) => item.id === pid);
    if (row !== undefined) return row;
    if (typeof body.nextCursor !== 'string') break;
    cursor = body.nextCursor;
  }
  throw new Error(`N1 does not list ${pid}`);
}

const levelOf = (doc: Json): Json => asJson(doc.level, 'level');
const layerIn = (doc: Json): Json => asJson(doc.layer, 'layer');
const scaleOf = (doc: Json): number => Number(levelOf(doc).scaleMillimetresPerPixel);
const buildingOf = (graph: Json): Json => asJson(asJson(graph.graph, 'graph').building, 'building');

/** Pool admin of this file's slot + its project factory: the flows that upload sign in as this user. */
async function ownerOf(main: APIRequestContext, cleanup: Cleanup): Promise<Signed> {
  return poolApi(main, 'admin', cleanup);
}

/* ------------------------------------------------------------------ tests */

test.describe('A04 phase-4 spatial backend flows (settings N5, quality #30, #35 headers, scale, versions N17)', () => {
  test('A04 · FL-BE-01 · settings N5 and quality #30 reads behind the QC screens', async () => {
    // project_settings/router.py:22-39, read.py:29-37; quality/router.py:30-37, assessments.py:248-279; files/router.py:33-40.
    test.setTimeout(PIPELINE_TIMEOUT_MS + 240_000);
    const cleanup = new Cleanup();
    try {
      const main = await mainAdmin(cleanup);
      const owner = await ownerOf(main, cleanup);
      const viewer = await poolApi(main, 'viewer', cleanup);
      const engineer = await poolApi(main, 'engineer', cleanup);
      const p = await createProject(owner.api, 'be01', 2);
      dropProject(cleanup, owner.api, p.projectId);
      const q = await createProject(owner.api, 'be01-b', 1);
      dropProject(cleanup, owner.api, q.projectId);
      const pid = p.projectId;
      const f1 = p.floors[0]?.id ?? '';
      const f2 = p.floors[1]?.id ?? '';
      const qFloor = q.floors[0]?.id ?? '';
      expect(f1 !== '' && f2 !== '' && qFloor !== '', 'setup: floors of both projects').toBe(true);
      await addProjectMember(owner.api, pid, viewer.user.email);
      const uploadId = await uploadDrawing(owner.api, pid, f1, envDrawingPng(), `${PREFIX}be01.png`);
      const settingsPath = `/api/projects/${pid}/settings`;

      const fresh = await call(owner.api, 'be01_settings_admin', 'GET', settingsPath, undefined, ['200 ProjectSettingsOut of a project nobody saved yet']);
      await test.step('[16-G-003] settings read for confidenceThreshold → GET /projects/:p/settings 200', async () => {
        expect.soft(fresh.res.status()).toBe(200);
        expectZod(ProjectSettingsSchema, fresh.body, 'N5');
        expect.soft(typeof asJson(fresh.body).confidenceThreshold).toBe('number');
      });

      const asViewer = await call(viewer.api, 'be01_settings_viewer', 'GET', settingsPath, undefined, ['200 for a viewer member']);
      await test.step('[BE5-G-008] viewer member → 200 ProjectSettingsOut', async () => {
        expect.soft(asViewer.res.status()).toBe(200);
        expectKeys(asViewer.body, SETTINGS_KEYS, ['notes']);
      });

      await test.step('[BE5-G-009] never saved → revision 0 and confidenceThreshold 0.75 (the FE default on error)', async () => {
        expect.soft(asJson(fresh.body)).toMatchObject({ revision: 0, confidenceThreshold: 0.75 });
      });

      const outside = await call(engineer.api, 'be01_settings_non_member', 'GET', settingsPath, undefined, ['404 resource project for a non-member']);
      await test.step('[BE5-G-010] non-member → 404 resource project (the FE swallows it and keeps the default threshold)', async () => {
        expectError(outside, 404, 'NOT_FOUND', { resource: 'project' });
      });

      const saved = await call(owner.api, 'be01_settings_put_09', 'PUT', settingsPath, { baseVersion: 0, body: settingsBody({ confidenceThreshold: 0.9 }) }, ['200 revision 1, 0.9']);
      const readBack = await call(owner.api, 'be01_settings_read_09', 'GET', settingsPath, undefined, ['200 N5 returns 0.9']);
      const rounded = await call(owner.api, 'be01_settings_put_1235', 'PUT', settingsPath, { baseVersion: 1, body: settingsBody({ confidenceThreshold: 0.1235 }) }, ['200 revision 2, 0.1235 → 0.124 HALF_UP']);
      const readRounded = await call(owner.api, 'be01_settings_read_1235', 'GET', settingsPath, undefined, ['200 N5 returns 0.124']);
      await test.step('[BE5-G-011] threshold written through N6 (0.9) is read back by N5; three decimals HALF_UP (0.1235 → 0.124)', async () => {
        expect.soft(saved.res.status()).toBe(200);
        expect.soft(asJson(readBack.body)).toMatchObject({ revision: 1, confidenceThreshold: 0.9 });
        expect.soft(rounded.res.status()).toBe(200);
        expect.soft(asJson(readRounded.body)).toMatchObject({ revision: 2, confidenceThreshold: 0.124 });
      });

      const anon = await newApiContext();
      cleanup.add(() => anon.dispose());
      const anonymous = await call(anon, 'be01_settings_anonymous', 'GET', settingsPath, undefined, ['401 UNAUTHENTICATED']);
      await test.step('[BE5-G-012] anonymous → 401 UNAUTHENTICATED', async () => {
        expectError(anonymous, 401, 'UNAUTHENTICATED');
      });

      const run = await waitForRunOutcome(owner.api, pid, uploadId);
      expect(run.status, `setup: the pipeline run of floor 1 (${String(run.error)})`).toBe('completed');
      const viewerQuality = await call(viewer.api, 'be01_quality_viewer', 'GET', qualityPath(pid, f1), undefined, ['200 #30 for a viewer member (SCR-22 opens for viewers)']);
      await test.step('[BE5-G-013] viewer member reads #30 → 200', async () => {
        expect.soft(viewerQuality.res.status()).toBe(200);
        expectZod(ImageQualityAssessmentSchema, viewerQuality.body, '#30');
      });

      const idor: Array<[string, Sent]> = [];
      for (const [slug, fid] of [['unknown', sid('L')], ['malformed', 'nope'], ['foreign', qFloor]] as const) {
        idor.push([slug, await call(owner.api, `be01_quality_${slug}_404`, 'GET', qualityPath(pid, fid), undefined, [`404 resource floor (${slug} floor id)`])]);
      }
      await test.step('[BE5-G-015] floor that does not exist / wrong shape / of another project (IDOR) → 404 resource floor', async () => {
        for (const [, sent] of idor) expectError(sent, 404, 'NOT_FOUND', { resource: 'floor' });
      });

      const noDrawing = await call(owner.api, 'be01_quality_no_drawing_404', 'GET', qualityPath(q.projectId, qFloor), undefined, ['404 resource upload: no floor of the project has a drawing']);
      await test.step('[BE5-G-016] no floor has a drawing → 404 resource upload (the SCR-14 / SCR-22 "no drawing" branch)', async () => {
        expectError(noDrawing, 404, 'NOT_FOUND', { resource: 'upload' });
      });

      const other = await call(owner.api, 'be01_quality_floor_without_drawing', 'GET', qualityPath(pid, f2), undefined, [
        '200: the asked floor has no drawing, floor 1 has → floorId = floor 1 and floors[] has no row for floor 2',
      ]);
      await test.step('[BE5-G-017] asked floor without a drawing while another has one → 200, floorId = the first drawn floor, floors[] lacks the asked floor', async () => {
        expect.soft(other.res.status()).toBe(200);
        const body = asJson(other.body);
        expect.soft(body.floorId).toBe(f1);
        expect.soft(objs(body.floors, 'floors').map((f) => f.floorId)).not.toContain(f2);
        note('FE contract suspicion C5: SCR-14 builds an "UNKNOWN" error from this answer (scaleCalibrationGateway.ts:296-310)');
      });

      const measured = await call(owner.api, 'be01_quality_after_run', 'GET', qualityPath(pid, f1), undefined, ['200 #30 after the run: the floor row has sourceUrl, isMeasured, measurement, frame']);
      const floorRow = objs(asJson(measured.body).floors, 'floors').find((f) => f.floorId === f1) ?? {};
      await test.step('[BE5-G-018] after the run floors[] carries a signed sourceUrl, isMeasured, measurement and frame', async () => {
        expect.soft(measured.res.status()).toBe(200);
        expectZod(ImageQualityAssessmentSchema, measured.body, '#30');
        expect.soft(String(floorRow.sourceUrl ?? '').length, 'sourceUrl').toBeGreaterThan(0);
        expect.soft(floorRow.isMeasured, 'isMeasured').toBe(true);
        expect.soft(floorRow.measurement, 'measurement').toBeDefined();
        expect.soft(floorRow.frame, 'frame').toBeDefined();
      });

      await test.step('[BE5-G-019] GET sourceUrl (the SCR-14 / SCR-22 background) → 200 image/*', async () => {
        const url = String(floorRow.sourceUrl ?? '');
        const files = url.startsWith('/') ? owner.api : await request.newContext();
        try {
          const file = await files.get(url);
          expect.soft(file.status(), 'the signed page URL serves the drawing').toBe(200);
          expect.soft(file.headers()['content-type'] ?? '').toMatch(/^image\//u);
          await file.dispose();
        } finally {
          if (files !== owner.api) await files.dispose();
        }
      });

      const fake = await call(anon, 'be01_files_fake_token', 'GET', `/api/files/qa-fake-${sid('F').toLowerCase()}`, undefined, ['404 NOT_FOUND: one answer for every failure']);
      await test.step('[BE5-G-023] fake file token → 404 NOT_FOUND', async () => {
        expectError(fake, 404, 'NOT_FOUND');
      });
    } finally {
      await cleanup.run();
    }
  });

  test('A04 · FL-BE-02 · #35 request headers and side channels: Origin, If-Match, Idempotency-Key shape, no event, admin non-member', async () => {
    // spatial_write/router.py:29-67, writer.py:502-530; core/origin.py; core/routing.py:227-254; projects/access.py:78-92.
    const cleanup = new Cleanup();
    try {
      const main = await mainAdmin(cleanup);
      const eng = await poolApi(main, 'engineer', cleanup);
      const p = await createProject(eng.api, 'be02', 1);
      dropProject(cleanup, eng.api, p.projectId);
      const pid = p.projectId;
      const fid = p.floors[0]?.id ?? '';
      expect(fid, 'setup: the engineer project has a floor').not.toBe('');
      const scale = (n: number): Json => writeBody(n, { scaleMillimetresPerPixel: 2 + n });

      const foreign = await put(eng.api, 'be02_origin_foreign', pid, fid, scale(0), ['200: Bearer + a foreign Origin'], { Origin: 'https://evil.example' });
      const bare = await bearerContext(eng.api);
      cleanup.add(() => bare.dispose());
      const bareSent = await put(bare, 'be02_origin_none', pid, fid, scale(1), ['200: Bearer and NO Origin header']);
      await test.step('[BE4-G-009] #35 with a Bearer and a foreign / missing Origin → 200 as usual (Origin is checked on cookie routes only)', async () => {
        expectWritten(foreign, 1, 'foreign Origin');
        expectWritten(bareSent, 2, 'no Origin');
      });

      const conditional = await put(eng.api, 'be02_if_match', pid, fid, scale(2), ['200: If-Match / If-None-Match are ignored, no 412'], {
        'If-Match': '"2"',
        'If-None-Match': '*',
      });
      await test.step('[BE4-G-010] If-Match / If-None-Match are ignored: the optimistic lock is baseVersion only (no 412 branch)', async () => {
        expectWritten(conditional, 3, 'If-Match');
      });

      const oddKey = await put(eng.api, 'be02_idempotency_key_shape', pid, fid, scale(3), ['200: a 7-character key with a dot'], { 'Idempotency-Key': 'ab.cdef' });
      await test.step('[BE4-G-058] Idempotency-Key of the wrong shape (7 characters, ".") → 200: the guard is not mounted, nothing checks the pattern', async () => {
        expectWritten(oddKey, 4, 'odd key');
      });

      const activityPath = `/api/users/${eng.user.id}/activity`;
      const read = async (ev: string): Promise<{ activity: unknown; notifications: unknown; updatedAt: string }> => {
        const activity = await call(main, `be02_activity_${ev}`, 'GET', activityPath, undefined, ['200 activity rows of the writer']);
        const notifications = await call(eng.api, `be02_notifications_${ev}`, 'GET', '/api/notifications', undefined, ['200 notifications of the writer']);
        const project = await call(eng.api, `be02_project_${ev}`, 'GET', `/api/projects/${pid}`, undefined, ['200 ProjectOut']);
        expect.soft(activity.res.status(), 'activity').toBe(200);
        expect.soft(notifications.res.status(), 'notifications').toBe(200);
        return { activity: activity.body, notifications: notifications.body, updatedAt: String(asJson(project.body).updatedAt) };
      };
      const before = await read('before');
      const touched = await put(eng.api, 'be02_write_for_events', pid, fid, scale(4), ['200: a real write']);
      const after = await read('after');
      await test.step('[BE4-G-045] a #35 emits no activity row and no notification (only touch_project moves updatedAt); no SSE is opened by the write', async () => {
        expectWritten(touched, 5, 'write');
        expect.soft(after.activity, 'activity log unchanged').toEqual(before.activity);
        expect.soft(after.notifications, 'notifications unchanged').toEqual(before.notifications);
        expect.soft(Date.parse(after.updatedAt), 'touch_project').toBeGreaterThan(Date.parse(before.updatedAt));
      });

      const walls = [wallOf(fid)];
      const base = await put(eng.api, 'be02_zod_write', pid, fid, writeBody(5, { layer: layerOf({ walls }) }), ['200 {revision, layer}']);
      const stale = await put(eng.api, 'be02_zod_conflict', pid, fid, writeBody(5, { layer: layerOf({ walls: [wallOf(fid)] }) }), ['409 VERSION_CONFLICT']);
      const n16 = await call(eng.api, 'be02_zod_n16', 'GET', layerPath(pid, fid), undefined, ['200 N16']);
      const meta33 = await call(eng.api, 'be02_zod_meta33', 'GET', `/api/projects/${pid}/floors/${fid}/spatial`, undefined, ['200 #33']);
      const n15 = await call(eng.api, 'be02_zod_n15', 'GET', `/api/projects/${pid}/spatial`, undefined, ['200 N15']);
      await test.step('[BE4-G-018] every 200 decodes with the FE zod (N16, #35 result, #33, N15) and the 409 with VersionConflictBodySchema', async () => {
        expectWritten(base, 6, 'layer write');
        expectZod(FloorLayerWriteResultSchema, base.body, '#35 200');
        expectZod(FloorLayerDocumentSchema, n16.body, 'N16');
        expectZod(FloorSchema, meta33.body, '#33');
        expectZod(SpatialGraphDocumentSchema, n15.body, 'N15');
        expectError(stale, 409, 'VERSION_CONFLICT');
        expectZod(VersionConflictBodySchema, stale.body, '409');
      });

      const paths: Array<[string, 'GET' | 'PUT', string, unknown]> = [
        ['n16', 'GET', layerPath(pid, fid), undefined],
        ['meta33', 'GET', `/api/projects/${pid}/floors/${fid}/spatial`, undefined],
        ['n15', 'GET', `/api/projects/${pid}/spatial`, undefined],
        ['floors', 'GET', `/api/projects/${pid}/floors`, undefined],
        ['put', 'PUT', layerPath(pid, fid), scale(6)],
      ];
      const nonMember: Sent[] = [];
      for (const [slug, method, path, data] of paths) {
        nonMember.push(await call(main, `be02_admin_non_member_${slug}`, method, path, data, ['404 resource project: a system admin who is not a member (K08)']));
      }
      await test.step('[BE4-G-007] system admin who is NOT a member → 404 resource project on N16 / #33 / N15 / #12 / #35, never 403', async () => {
        for (const sent of nonMember) expectError(sent, 404, 'NOT_FOUND', { resource: 'project' });
      });
    } finally {
      await cleanup.run();
    }
  });

  test('A04 · FL-BE-03 · scale across drawings: human scale before a drawing, re-upload pages, apply-all race, floor area, dashboard counts', async () => {
    // spatial_write/writer.py:365-401,430-455,492-530; spatial_read/assemble.py:27-41; projects/summaries.py:133; floors/router.py.
    test.setTimeout(3 * PIPELINE_TIMEOUT_MS + 300_000);
    const cleanup = new Cleanup();
    try {
      const main = await mainAdmin(cleanup);
      const owner = await ownerOf(main, cleanup);
      const p = await createProject(owner.api, 'be03', 2);
      dropProject(cleanup, owner.api, p.projectId);
      const pid = p.projectId;
      const f1 = p.floors[0]?.id ?? '';
      const f2 = p.floors[1]?.id ?? '';
      expect(f1 !== '' && f2 !== '', 'setup: two floors').toBe(true);
      const png = envDrawingPng();
      const HUMAN_1 = 3.5;
      const HUMAN_2 = 4.25;

      const floorsBefore = await readFloors(owner.api, 'be03_floors_before_upload', pid, '200 #12: two floors, drawings []');
      // Floor 2 first: its pipeline scale (no human scale involved) is the reference for what a clean run gives this drawing.
      const up3 = await uploadDrawing(owner.api, pid, f2, png, `${PREFIX}be03-c.png`);
      const run3 = await waitForRunOutcome(owner.api, pid, up3);
      expect(run3.status, `setup: run of floor 2 (${String(run3.error)})`).toBe('completed');
      const n16Reference = await readLayer(owner.api, 'be03_n16_f2_reference', pid, f2, '200 N16 of floor 2 after a clean run: the pipeline scale');
      const pipelineScale = scaleOf(n16Reference);
      const n16Fresh = await readLayer(owner.api, 'be03_n16_fresh', pid, f1, '200 N16 revision 0 of a floor without a drawing');
      const humanBeforeDrawing = await put(owner.api, 'be03_human_scale_without_drawing', pid, f1, writeBody(0, { scaleMillimetresPerPixel: HUMAN_1 }), [
        '200 revision 1: a human scale saved while the floor has no drawing (scale_page_key NULL)',
      ]);
      const n16Human0 = await readLayer(owner.api, 'be03_n16_human_no_drawing', pid, f1, '200 N16: scale 3.5, no scaleStatus');
      const up1 = await uploadDrawing(owner.api, pid, f1, png, `${PREFIX}be03-a.png`);
      const run1 = await waitForRunOutcome(owner.api, pid, up1);
      expect(run1.status, `setup: first run (${String(run1.error)})`).toBe('completed');
      const n16Post1 = await readLayer(owner.api, 'be03_n16_after_first_run', pid, f1, '200 N16 after the first pipeline run');
      const n15Post1 = await readGraph(owner.api, 'be03_n15_after_first_run', pid, '200 N15 after the first run');

      await test.step('[BE4-G-028] ⚑ human scale saved before any drawing, then drawing + pipeline: the pipeline scale wins (scaleStatus "unresolved", scale ≠ the human value)', async () => {
        expect.soft(humanBeforeDrawing.res.status()).toBe(200);
        expect.soft(n16Fresh.revision).toBe(0);
        expect.soft(scaleOf(n16Post1), 'the scale of the first drawing is the pipeline one, not the stale human value').not.toBe(HUMAN_1);
        expect.soft(n16Post1.scaleStatus, 'a scale without evidence for this page stays provisional').toBe('unresolved');
      });
      await test.step('[BE4-G-091] ⚑ scale saved on a floor without a drawing carries no page: N16 shows it (no scaleStatus) before the drawing, N15 shows the pipeline scale after', async () => {
        expect.soft(n16Human0, 'no drawing → no page to demote against').not.toHaveProperty('scaleStatus');
        expect.soft(scaleOf(n16Human0)).toBe(HUMAN_1);
        const level = objs(asJson(n15Post1.graph).levels, 'levels').find((l) => l.id === f1);
        expect.soft(level?.scaleMillimetresPerPixel, 'N15 level scale after the run').not.toBe(HUMAN_1);
      });

      const rev1 = Number(n16Post1.revision);
      const human2 = await put(owner.api, 'be03_human_scale_on_drawing', pid, f1, writeBody(rev1, { scaleMillimetresPerPixel: HUMAN_2 }), ['200: a human scale on the drawn page']);
      const n16Human = await readLayer(owner.api, 'be03_n16_human_on_drawing', pid, f1, '200 N16: scale 4.25, no scaleStatus (same page)');
      const up2 = await uploadDrawing(owner.api, pid, f1, png, `${PREFIX}be03-b.png`);
      const run2 = await waitForRunOutcome(owner.api, pid, up2);
      expect(run2.status, `setup: second run (${String(run2.error)})`).toBe('completed');
      const n16Post2 = await readLayer(owner.api, 'be03_n16_after_second_run', pid, f1, '200 N16 after a second drawing');

      await test.step('[BE4-G-027] human scale, then another drawing page → scaleStatus "unresolved" again (demoted by page)', async () => {
        expect.soft(human2.res.status()).toBe(200);
        expect.soft(n16Human, 'human scale on the drawn page is not provisional').not.toHaveProperty('scaleStatus');
        expect.soft(scaleOf(n16Human)).toBe(HUMAN_2);
        expect.soft(n16Post2.scaleStatus).toBe('unresolved');
      });
      await test.step('[BE4-G-092] pipeline re-run on another page replaces the human scale without rescaling it (same page keeps rank 3: not reachable over HTTP)', async () => {
        expect.soft(scaleOf(n16Post2), 'the new page brings the pipeline scale').not.toBe(HUMAN_2);
        expect.soft(scaleOf(n16Post2), 'same drawing, same pipeline scale as the clean run of floor 2').toBeCloseTo(pipelineScale, 3);
        note('same-page re-run (human scale kept, rank 3 > 2) has no HTTP trigger: pytest test_merge_on_same_page_keeps_higher_ranked_scale');
      });

      const floorsAfter = await readFloors(owner.api, 'be03_floors_after_upload', pid, '200 #12: both floors with a drawing');
      await test.step('[BE5-G-004] #12 sorted by (order, pk): drawings [] before an upload, ≥ 1 once the run has finished (the FE derives hasDrawing from it)', async () => {
        expect.soft(floorsBefore.map((f) => f.id)).toEqual([f1, f2]);
        for (const f of floorsBefore) expect.soft(f.drawings, 'before any upload').toEqual([]);
        expect.soft(floorsAfter.map((f) => f.id)).toEqual([f1, f2]);
        for (const f of floorsAfter) expect.soft(asArray(f.drawings, 'drawings').length, `drawings of ${String(f.id)}`).toBeGreaterThanOrEqual(1);
      });

      const graph = await readGraph(owner.api, 'be03_n15_before_race', pid, '200 N15 floorRevisions: the bases of apply-all');
      const revisions = new Map(objs(graph.floorRevisions, 'floorRevisions').map((r) => [String(r.floorId), Number(r.revision)]));
      const baseF1 = revisions.get(f1) ?? -1;
      const baseF2 = revisions.get(f2) ?? -1;
      const room = roomOf(f2, { w: 4000, h: 5000 });
      const anotherTab = await put(owner.api, 'be03_other_tab_write', pid, f2, writeBody(baseF2, { layer: layerOf({ walls: [wallOf(f2)], rooms: [room] }) }), [
        '200: another tab writes floor 2 after apply-all read N15',
      ]);
      const applyF1 = await put(owner.api, 'be03_apply_all_f1', pid, f1, writeBody(baseF1, { scaleMillimetresPerPixel: 5 }), ['200: floor 1 is still at the N15 revision']);
      const applyF2 = await put(owner.api, 'be03_apply_all_f2_stale', pid, f2, writeBody(baseF2, { scaleMillimetresPerPixel: 5 }), ['409 VERSION_CONFLICT: floor 2 moved since N15']);
      await test.step('[BE4-G-094] "Áp cho mọi tầng" with one floor just written by another tab (old N15 revision) → that floor 409 VERSION_CONFLICT (counted as failed), the other 200', async () => {
        expect.soft(anotherTab.res.status()).toBe(200);
        expectWritten(applyF1, baseF1 + 1, 'apply floor 1');
        const conflict = expectError(applyF2, 409, 'VERSION_CONFLICT');
        expectZod(VersionConflictBodySchema, applyF2.body, '409');
        expect.soft(objs(conflict.remoteChanges, 'remoteChanges').length, 'the other tab logged rows').toBeGreaterThan(0);
      });

      const meta33 = await call(owner.api, 'be03_meta33_area', 'GET', `/api/projects/${pid}/floors/${f2}/spatial`, undefined, ['200 #33 with areaM2 20']);
      const floorsArea = await readFloors(owner.api, 'be03_floors_area', pid, '200 #12 areaM2');
      await test.step('[BE4-G-105] areaM2 after a #35 with a room is on #33 (and #12): 4000 × 5000 mm → 20', async () => {
        expect.soft(meta33.res.status()).toBe(200);
        expect.soft(asJson(meta33.body).areaM2).toBe(20);
        expect.soft(floorsArea.find((f) => f.id === f2)?.areaM2).toBe(20);
      });

      const s0 = await summaryOf(owner.api, 'be03_summary_before', pid);
      const approvedWall = wallOf(f2, { source: 'human', reviewed: true });
      const reviewedWrite = await put(owner.api, 'be03_review_one_wall', pid, f2, writeBody(baseF2 + 1, { layer: layerOf({ walls: [approvedWall], rooms: [room] }) }), [
        '200: the single wall of floor 2 is reviewed',
      ]);
      const s1 = await summaryOf(owner.api, 'be03_summary_after', pid);
      await test.step('[BE4-G-042] dashboard N1: wallsReviewedCount follows the reviewed walls written by #35 (walls total unchanged)', async () => {
        expect.soft(reviewedWrite.res.status()).toBe(200);
        expect.soft(s1.wallsTotalCount).toBe(s0.wallsTotalCount);
        expect.soft(Number(s1.wallsReviewedCount)).toBe(Number(s0.wallsReviewedCount) + 1);
      });
    } finally {
      await cleanup.run();
    }
  });

  test('A04 · FL-BE-04 · after a pipeline: SCR-11 lock, manual add, level reviewed vs provisional scale, versions', async () => {
    // spatial_read/assemble.py:44-53, documents.py:165-176; quality/service.py:114-120; versions/router.py:37-59, snapshots.py:243-264.
    test.setTimeout(3 * PIPELINE_TIMEOUT_MS + 300_000);
    const cleanup = new Cleanup();
    try {
      const main = await mainAdmin(cleanup);
      const owner = await ownerOf(main, cleanup);
      const viewer = await poolApi(main, 'viewer', cleanup);
      const png = envDrawingPng();
      const seeded = await createPipelineProject(owner.api, 'be04', png, ['Tầng 1', 'Tầng 2', 'Tầng 3']);
      const pid = seeded.projectId;
      dropProject(cleanup, owner.api, pid);
      const rows = await listFloors(owner.api, pid);
      const f1 = seeded.floorId;
      const f2 = rows[1]?.id ?? '';
      const f3 = rows[2]?.id ?? '';
      expect(f1 !== '' && f2 !== '' && f3 !== '', 'setup: three floors').toBe(true);
      await addProjectMember(owner.api, pid, viewer.user.email);
      const [u2, u3] = await Promise.all([
        uploadDrawing(owner.api, pid, f2, png, `${PREFIX}be04-b.png`),
        uploadDrawing(owner.api, pid, f3, png, `${PREFIX}be04-c.png`),
      ]);
      for (const [uid, label] of [[u2, 'floor 2'], [u3, 'floor 3']] as const) {
        const run = await waitForRunOutcome(owner.api, pid, uid);
        expect(run.status, `setup: run of ${label} (${String(run.error)})`).toBe('completed');
      }

      // Floor 2: approve everything after the pipeline, then save a human scale.
      const a0 = await readLayer(owner.api, 'be04_f2_n16', pid, f2, '200 N16 of floor 2 after its run');
      const a0Layer = layerIn(a0);
      if (itemCount(a0Layer) === 0) note('floor 2: the fake-ML run produced no item: the approve-all step has nothing to approve');
      const approved = await put(owner.api, 'be04_f2_approve_all', pid, f2, writeBody(a0.revision, { layer: approveAll(a0Layer) }), ['200: every wall / opening / room / furniture reviewed by a human']);
      const a1 = await readLayer(owner.api, 'be04_f2_n16_approved', pid, f2, '200 N16: all reviewed, scale still the pipeline one');
      const g1 = await readGraph(owner.api, 'be04_n15_approved', pid, '200 N15 after approve-all');
      await test.step('[BE4-G-024] ⚑ everything approved after a pipeline (scale "pipeline") but SCR-14 not done → level.reviewed and building.reviewed stay false', async () => {
        expect.soft(approved.res.status()).toBe(200);
        expect.soft(a1.scaleStatus, 'the scale is still provisional').toBe('unresolved');
        expect.soft(levelOf(a1).reviewed, 'level.reviewed under a provisional scale').toBe(false);
        expect.soft(buildingOf(g1).reviewed, 'building.reviewed').toBe(false);
        note('C5 suspicion: the QC copy says everything is approved while level.reviewed stays false until SCR-14 saves a human scale');
      });

      const humanScale = await put(owner.api, 'be04_f2_human_scale', pid, f2, writeBody(a1.revision, { scaleMillimetresPerPixel: 2 }), ['200: SCR-14 saves a human scale']);
      const a2 = await readLayer(owner.api, 'be04_f2_n16_scaled', pid, f2, '200 N16: human scale → level.reviewed follows');
      const straighten = await call(owner.api, 'be04_f2_straighten_422', 'POST', qualityPath(pid, f2, '/straighten'), {}, ['422 QUALITY_LAYER_REVIEWED']);
      const corners = await call(owner.api, 'be04_f2_corners_422', 'POST', qualityPath(pid, f2, '/corners'), { corners: GOOD_CORNERS }, ['422 QUALITY_LAYER_REVIEWED']);
      await test.step('[BE5-G-021] SCR-14 saves a human scale (#35) → SCR-11 "Tự động nắn" (#32) and "Chọn góc thủ công" (#31) → 422 QUALITY_LAYER_REVIEWED', async () => {
        expect.soft(humanScale.res.status()).toBe(200);
        expect.soft(a2, 'a human scale is not provisional').not.toHaveProperty('scaleStatus');
        expect.soft(levelOf(a2).reviewed, 'all reviewed + human scale').toBe(objs(layerIn(a2).walls, 'walls').length > 0);
        expectError(straighten, 422, 'QUALITY_LAYER_REVIEWED');
        expectError(corners, 422, 'QUALITY_LAYER_REVIEWED');
      });

      // Floor 3: a single unreviewed human item (SCR-17 "Thêm thủ công").
      const c0 = await readLayer(owner.api, 'be04_f3_n16', pid, f3, '200 N16 of floor 3 after its run');
      const c0Layer = layerIn(c0);
      const manual = furnitureOf(f3, { source: 'human', reviewed: false });
      const withManual = { ...c0Layer, furniture: [...objs(c0Layer.furniture, 'furniture'), manual] };
      const added = await put(owner.api, 'be04_f3_manual_item', pid, f3, writeBody(c0.revision, { layer: withManual }), ['200: a human, unreviewed furniture item added']);
      const straighten3 = await call(owner.api, 'be04_f3_straighten_422', 'POST', qualityPath(pid, f3, '/straighten'), {}, ['422 QUALITY_LAYER_REVIEWED']);
      const corners3 = await call(owner.api, 'be04_f3_corners_422', 'POST', qualityPath(pid, f3, '/corners'), { corners: GOOD_CORNERS }, ['422 QUALITY_LAYER_REVIEWED']);
      await test.step('[BE5-G-022] SCR-17 "Thêm thủ công" an unreviewed human item also blocks #32 and #31 (has_human_geometry)', async () => {
        expect.soft(added.res.status()).toBe(200);
        expectError(straighten3, 422, 'QUALITY_LAYER_REVIEWED');
        expectError(corners3, 422, 'QUALITY_LAYER_REVIEWED');
      });

      // Floor 1: the pipeline output is still untouched (no write since the run).
      const listPath = `?floorId=${encodeURIComponent(f1)}`;
      const n16Fresh = await readLayer(owner.api, 'be04_f1_n16_fresh', pid, f1, '200 N16 of floor 1: the revision the AI version recorded');
      const v0 = await call(owner.api, 'be04_f1_versions_fresh', 'GET', versionsPath(pid, listPath), undefined, ['200 N17: [after, before]']);
      const v0Items = objs(asJson(v0.body).items, 'items');
      await test.step('[BE5-G-026] pipeline done → N17 [after, before], system:pipeline / "hệ thống AI", after.floorRevision = the N16 revision', async () => {
        expect.soft(v0.res.status()).toBe(200);
        expectZod(FloorVersionPageSchema, v0.body, 'N17');
        expect.soft(v0Items.map((v) => v.sequence)).toEqual([2, 1]);
        expect.soft(v0Items[0]).toMatchObject({ creatorId: SYSTEM_PIPELINE, creatorName: PIPELINE_NAME, floorRevision: n16Fresh.revision });
        expect.soft(v0Items[1]).toMatchObject({ creatorId: SYSTEM_PIPELINE, creatorName: PIPELINE_NAME });
      });

      const f1Layer = layerIn(n16Fresh);
      const firstWall = objs(f1Layer.walls, 'walls')[0];
      const approvedLayer =
        firstWall === undefined
          ? { ...f1Layer, walls: [wallOf(f1, { source: 'human', reviewed: true })] }
          : { ...f1Layer, walls: objs(f1Layer.walls, 'walls').map((w) => (w === firstWall ? { ...w, source: 'human', reviewed: true, confidence: 1 } : w)) };
      const firstWrite = await put(owner.api, 'be04_f1_first_write', pid, f1, writeBody(n16Fresh.revision, { layer: approvedLayer }), ['200: "Duyệt đoạn này" is the first #35 after the pipeline']);
      const v1 = await call(owner.api, 'be04_f1_versions_after_first', 'GET', versionsPath(pid, listPath), undefined, ['200 N17 after the first write']);
      const afterRevision = Number(v0Items[0]?.floorRevision);
      await test.step('[BE5-G-027] first #35 after the pipeline: N16 revision = after.floorRevision + 1, so no version matches the current revision (the AI row loses "Hiện tại")', async () => {
        const out = expectWritten(firstWrite, afterRevision + 1, 'first write');
        const items = objs(asJson(v1.body).items, 'items');
        expect.soft(items.map((v) => Number(v.floorRevision)), 'no version at the current revision').not.toContain(Number(out.revision));
      });

      const secondLayer = { ...approvedLayer, walls: [...objs(approvedLayer.walls, 'walls'), wallOf(f1, { source: 'human', reviewed: true, from: [0, 777], to: [4000, 777] })] };
      const secondWrite = await put(owner.api, 'be04_f1_autosave', pid, f1, writeBody(afterRevision + 1, { layer: secondLayer }), ['200: an autosave']);
      const v2 = await call(owner.api, 'be04_f1_versions_after_autosave', 'GET', versionsPath(pid, listPath), undefined, ['200 N17 right after the autosave']);
      await test.step('[BE5-G-028] an autosave (#35) creates no version: N17 still lists exactly the 2 pipeline versions', async () => {
        expectWritten(secondWrite, afterRevision + 2, 'autosave');
        expect.soft(objs(asJson(v1.body).items, 'items')).toHaveLength(2);
        expect.soft(objs(asJson(v2.body).items, 'items')).toHaveLength(2);
      });

      const noFloor = await call(owner.api, 'be04_versions_no_floor_id', 'GET', versionsPath(pid), undefined, ['422 VALIDATION field floorId']);
      const ghost = await call(owner.api, 'be04_versions_unknown_floor', 'GET', versionsPath(pid, `?floorId=${sid('L')}`), undefined, ['404 resource floor']);
      const asViewer = await call(viewer.api, 'be04_versions_viewer', 'GET', versionsPath(pid, listPath), undefined, ['200 for a viewer member']);
      await test.step('[BE5-G-029] N17 without floorId → 422 field floorId; unknown floor → 404 floor; viewer member → 200', async () => {
        expectError(noFloor, 422, 'VALIDATION', { field: 'floorId' });
        expectError(ghost, 404, 'NOT_FOUND', { resource: 'floor' });
        expect.soft(asViewer.res.status()).toBe(200);
        expectZod(FloorVersionPageSchema, asViewer.body, 'N17 viewer');
      });
    } finally {
      await cleanup.run();
    }
  });
});
