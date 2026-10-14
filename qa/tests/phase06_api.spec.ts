/**
 * Phase 6 BACKEND through the real API (skill `qa-api-test`, QA-06b P8): rule-config N21 / N22 and versions
 * N17 / #36 / N18 / N19 / N20. No browser, NO mocks, 10 flows (flows-C6 `FL-B06-G-01..10`), one `test.step('[B06-G-nnn] ..')`
 * per catalog row, one JSON exchange `B06-G-nnn_<slug>.json` per call (secrets redacted by `captureExchange`).
 *   GET   /api/projects/:p/rule-config                       BE rules/router.py:21-26 -> service.py:90-95
 *   PUT   /api/projects/:p/rule-config (versioned)           BE rules/router.py:29-38 -> service.py:98-148, schemas.py:23-50
 *   GET   /api/projects/:p/versions?floorId=                 BE versions/router.py:37-45 -> service.py:142-163
 *   GET   /api/projects/:p/versions/:v | .../snapshot        BE versions/router.py:48-59 -> service.py:129-139,166-176
 *   POST  /api/projects/:p/versions/:v/restore (versioned)   BE versions/router.py:62-82 -> service.py:217-298
 *   PATCH /api/projects/:p/versions/:v/label                 BE versions/router.py:85-91 -> service.py:301-338
 * Non-serial, own data: each flow builds `qa-<runId>-b06-...` projects and deletes them in `finally`; helpers in
 * `support/p06/apiCalls.ts`. SP flows (06..10) need `E2E_DRAWING_PNG` (fake-ML pipeline run -> versions v1 "before" + v2 "after").
 * Pool users (real invited viewer / engineer, slots `p06-api-viewer`, `p06-api-engineer`) are shared, released by the coordinator.
 *
 * Request budget per run (BE defaults; QA stack `qa-limits.override.yml` raises the login limit):
 * - `POST /api/auth/login` per IP 30 / 60 s (override 120): admin 1 per flow = 10 (FL-01 anonymous: 0) + pool logins 4
 *   (FL-05 viewer + non-member engineer, FL-10 viewer + engineer) = 13, 0 failed.
 * - `drawings_init` 60 / 600 s per user: 5 (FL-06..FL-10 each seed one pipeline project; +1 per restarted worker).
 * - `members_add` 60 / 3600 s per actor: 3 (FL-05 viewer, FL-10 viewer + engineer).
 * - Idempotency rows: FL-09 leaves 1 (24 h TTL); N19 / N22 are versioned (no idempotency table, core/routing.py:227-232).
 * - No rate limit on the 7 routes (grep `rate_limit(` in rules/, versions/: none).
 */
import { randomUUID } from 'node:crypto';

import { expect, test } from '@playwright/test';

import { ProjectRuleConfigSchema, UpdateRuleConfigSchema } from '../../src/api/schemas/ruleConfig';
import {
  FloorVersionSnapshotSchema,
  FloorVersionSummarySchema,
  LabelVersionSchema,
  RestoreVersionSchema,
} from '../../src/api/schemas/versions';
import { PIPELINE_TIMEOUT_MS } from '../../e2e/fullstack/env';
import { newApiContext, signedInApi } from './support/api';
import { writeLayer, qcLayer } from './support/layerSeed';
import {
  addProjectMember,
  createPipelineProject,
  createProject,
  envDrawingPng,
  poolUser,
  type PoolUser,
} from './support/phase03Seed';
import {
  BEFORE_PIPELINE_NOTE,
  Cleanup,
  MISSING_PROJECT,
  MISSING_VERSION,
  PIPELINE_NAME,
  RULE_CONFIG_KEYS,
  SNAPSHOT_KEYS,
  SUMMARY_KEYS,
  SUMMARY_OPTIONAL,
  SYSTEM_PIPELINE,
  VERSION_KEYS,
  activityOf,
  adminApi,
  afterNote,
  asArray,
  asJson,
  beforeNote,
  call,
  deleteOnCleanup,
  expectConflict,
  expectError,
  expectKeys,
  expectZod,
  floorIds,
  labelPath,
  layerDoc,
  listPath,
  ownerOf,
  restorePath,
  ruleConfigPath,
  snapshotPath,
  updatedAt,
  versionPath,
  versions,
  type Json,
  type Method,
  type Sent,
} from './support/p06/apiCalls';

const OVER_1_MIB = 1_048_576 + 4_096; // core/middleware.py:217-236 (Content-Length > route body_limit -> 413); routing.py:46
const bigBody = (base: Json): Buffer => Buffer.from(JSON.stringify({ ...base, pad: 'a'.repeat(OVER_1_MIB) }));
const SP_TIMEOUT_MS = PIPELINE_TIMEOUT_MS + 180_000;

/** SP flows need the env drawing; checked before any login. */
const needDrawing = (): void => test.skip(!process.env.E2E_DRAWING_PNG, 'Environment: E2E_DRAWING_PNG is not set (qa.config.json env.vars)');

/** Seed SP: pipeline project (floor 1 = finished fake-ML run, versions v1 + v2), floor ids, deleted in cleanup. */
async function seedPipeline(admin: Awaited<ReturnType<typeof adminApi>>, cleanup: Cleanup, slug: string): Promise<{ pid: string; f1: string; f2: string }> {
  const seeded = await createPipelineProject(admin, slug, envDrawingPng(), ['Tầng 1', 'Tầng 2']);
  deleteOnCleanup(cleanup, admin, seeded.projectId);
  const { f1, f2 } = await floorIds(admin, seeded.projectId);
  return { pid: seeded.projectId, f1, f2 };
}

/** Real pool member of `pid` (viewer | engineer): setup add + 1 login. */
async function memberApi(admin: Awaited<ReturnType<typeof adminApi>>, cleanup: Cleanup, pid: string, role: 'viewer' | 'engineer', add = true): Promise<{ user: PoolUser; api: Awaited<ReturnType<typeof signedInApi>> }> {
  const user = await poolUser(admin, role, `p06-api-${role}`);
  if (add) await addProjectMember(admin, pid, user.email);
  const api = await signedInApi(user.email, user.password);
  cleanup.add(() => api.dispose());
  return { user, api };
}

test.describe('SCR-B06 phase-6 backend (rule-config N21 / N22, versions N17-N20 / #36)', () => {
  test('SCR-B06 · FL-B06-G-01 · anonymous: every one of the 7 routes answers 401 before the project gate, the 428 guard and the body', async () => {
    // core/routing.py:129-135 (principal before the body); rules/router.py:17; versions/router.py:30.
    const anon = await newApiContext();
    try {
      const unauth = async (ev: string, method: Method, path: string, data: unknown, claim: string): Promise<Sent> => {
        const sent = await call(anon, ev, method, path, data, [`401 UNAUTHENTICATED: ${claim}`]);
        expectError(sent, 401, 'UNAUTHENTICATED');
        return sent;
      };
      await test.step('[B06-G-001] anon GET rule-config', async () => {
        const sent = await unauth('B06-G-001_anon_get', 'GET', ruleConfigPath(MISSING_PROJECT), undefined, 'no Bearer, before the project gate (routing.py:129-135; rules/router.py:17)');
        expect(sent.res.status()).toBe(401);
      });
      await test.step('[B06-G-011] anon PUT valid body', async () => {
        await unauth('B06-G-011_anon_put', 'PUT', ruleConfigPath(MISSING_PROJECT), { baseVersion: 0, body: { overrides: {} } }, 'valid body, no principal');
      });
      await test.step('[B06-G-012] anon PUT without baseVersion', async () => {
        const sent = await unauth('B06-G-012_anon_put_no_base', 'PUT', ruleConfigPath(MISSING_PROJECT), { body: { overrides: {} } }, 'principal before the 428 guard');
        expect.soft(asJson(sent.body).code).not.toBe('PRECONDITION_REQUIRED');
      });
      await test.step('[B06-G-013] anon PUT truncated JSON', async () => {
        const sent = await unauth('B06-G-013_anon_put_truncated', 'PUT', ruleConfigPath(MISSING_PROJECT), Buffer.from('{"baseVersion": 0,'), 'not 400 MALFORMED_JSON');
        expect.soft(asJson(sent.body).code).not.toBe('MALFORMED_JSON');
      });
      await test.step('[B06-G-080] anon list', async () => {
        await unauth('B06-G-080_anon_list', 'GET', listPath(MISSING_PROJECT, 'F1'), undefined, 'versions list (versions/router.py:30)');
      });
      await test.step('[B06-G-110] anon read', async () => {
        await unauth('B06-G-110_anon_read', 'GET', versionPath(MISSING_PROJECT, MISSING_VERSION), undefined, 'version read');
      });
      await test.step('[B06-G-130] anon snapshot', async () => {
        await unauth('B06-G-130_anon_snapshot', 'GET', snapshotPath(MISSING_PROJECT, MISSING_VERSION, 'F1'), undefined, 'snapshot');
      });
      await test.step('[B06-G-150] anon restore', async () => {
        await unauth('B06-G-150_anon_restore', 'POST', restorePath(MISSING_PROJECT, MISSING_VERSION), { baseVersion: 0, body: { floorId: 'F1' } }, 'restore');
      });
      await test.step('[B06-G-200] anon label', async () => {
        await unauth('B06-G-200_anon_label', 'PATCH', `${versionPath(MISSING_PROJECT, MISSING_VERSION)}/label`, { label: 'e2e' }, 'label');
      });
    } finally {
      await anon.dispose();
    }
  });

  test('SCR-B06 · FL-B06-G-02 · rule-config lifecycle: first write, read-back, touch, own repeat, 409 stale / future, reset, Idempotency-Key ignored', async () => {
    // rules/service.py:90-95 (read), 98-148 (INSERT ... ON CONFLICT, UPDATE ... WHERE revision = base, own repeat, 409); core/routing.py:227-232.
    const cleanup = new Cleanup();
    try {
      const admin = await adminApi(cleanup);
      const project = await createProject(admin, 'b06-rules', 0);
      const pid = project.projectId;
      deleteOnCleanup(cleanup, admin, pid);
      const overrides = {
        'WALL-THICKNESS': { enabled: false },
        'DOOR-WIDTH': { severity: 'critical', thresholds: { 'door.minWidthMm': 600 } },
        GENERAL: { thresholds: { 'general.jointToleranceMm': 500 } },
        'ROOM-AREA-BELOW-MINIMUM': { thresholds: { 'room.minArea.bedroom': 60 } },
        'WALL-UNSUPPORTED': { thresholds: { 'wallSupport.minSupportShare': 0.5 } },
      };
      const first = { baseVersion: 0, body: { overrides } };
      let put1: Sent | undefined;
      let t1: unknown;

      await test.step('[B06-G-006] malformed project id -> 404 project', async () => {
        const sent = await call(admin, 'B06-G-006_malformed_project', 'GET', ruleConfigPath('prj_bad'), undefined, ['404 NOT_FOUND resource project without a DB query (projects/access.py:36-41)']);
        expect(sent.res.status()).toBe(404);
        expectError(sent, 404, 'NOT_FOUND', { resource: 'project' });
      });
      await test.step('[B06-G-014] first write base 0 with catalog bounds', async () => {
        expectZod(UpdateRuleConfigSchema, first, 'own N22 body (the FE could send it)');
        const t0 = await updatedAt(admin, pid, 'B06-G-014_project_t0');
        const sent = await call(admin, 'B06-G-014_put_base0', 'PUT', ruleConfigPath(pid), first, [
          '200 {revision: 1, overrides}: inclusive bounds door.minWidthMm 600, room.minArea 60, minSupportShare 0.5; GENERAL carries thresholds only (service.py:79; catalog.py:72-93)',
        ]);
        expect(sent.res.status()).toBe(200);
        expect.soft(expectKeys(sent.body, RULE_CONFIG_KEYS)).toEqual({ revision: 1, overrides });
        expectZod(ProjectRuleConfigSchema, sent.body, 'N22 200');
        put1 = sent;
        t1 = t0; // replaced in G-018
      });
      await test.step('[B06-G-003] read after PUT', async () => {
        const sent = await call(admin, 'B06-G-003_read_after_put', 'GET', ruleConfigPath(pid), undefined, ['200: N21 = the N22 answer byte for byte (service.py:90-95,143)']);
        expect.soft(sent.res.status()).toBe(200);
        expect.soft(sent.body).toEqual(put1?.body);
        expectZod(ProjectRuleConfigSchema, sent.body, 'N21');
      });
      await test.step('[B06-G-018] won write touches the project', async () => {
        const after = await updatedAt(admin, pid, 'B06-G-018_project_t1');
        expect.soft(after, 'updatedAt changed by the won write (service.py:142)').not.toBe(t1);
        t1 = after;
      });
      await test.step('[B06-G-020] own repeat -> same revision, project not touched', async () => {
        const sent = await call(admin, 'B06-G-020_put_repeat', 'PUT', ruleConfigPath(pid), first, ['200 revision 1: same writer + body + base = revision - 1 (service.py:145-147)']);
        expect.soft(sent.res.status()).toBe(200);
        expect.soft(sent.body).toEqual(put1?.body);
        expect.soft(await updatedAt(admin, pid, 'B06-G-020_project_t2'), 'a repeat does not touch the project').toBe(t1);
      });
      await test.step('[B06-G-026] stale base -> 409 currentVersion 1, remoteChanges []', async () => {
        const sent = await call(admin, 'B06-G-026_put_stale', 'PUT', ruleConfigPath(pid), { baseVersion: 0, body: { overrides: { 'WALL-LENGTH': { enabled: false } } } }, ['409 VERSION_CONFLICT currentVersion 1, remoteChanges [] (service.py:148)']);
        expect.soft(expectConflict(sent, 1), 'rule-config conflicts carry no field changes').toEqual([]);
      });
      await test.step('[B06-G-027] future base 7 -> 409, not 422', async () => {
        const sent = await call(admin, 'B06-G-027_put_future', 'PUT', ruleConfigPath(pid), { ...first, baseVersion: 7 }, ['409 VERSION_CONFLICT currentVersion 1: base > revision is a conflict (service.py:103,148)']);
        expect.soft(expectConflict(sent, 1)).toEqual([]);
      });
      await test.step('[B06-G-029] state after two 409 unchanged', async () => {
        const sent = await call(admin, 'B06-G-029_read_after_409', 'GET', ruleConfigPath(pid), undefined, ['200: N21 unchanged after the two 409 (service.py:118-131)']);
        expect.soft(sent.res.status()).toBe(200);
        expect.soft(sent.body).toEqual(put1?.body);
      });
      await test.step('[B06-G-030] reset to defaults', async () => {
        const sent = await call(admin, 'B06-G-030_put_reset', 'PUT', ruleConfigPath(pid), { baseVersion: 1, body: { overrides: {} } }, ['200 {revision: 2, overrides: {}}: PUT replaces the whole map']);
        expect.soft(sent.res.status()).toBe(200);
        expect.soft(sent.body).toEqual({ revision: 2, overrides: {} });
      });
      await test.step('[B06-G-032] Idempotency-Key on the versioned route is ignored', async () => {
        const sent = await call(admin, 'B06-G-032_put_idempotency_key', 'PUT', ruleConfigPath(pid), { baseVersion: 2, body: { overrides: {} } }, [
          '200 revision 3: a malformed Idempotency-Key is not even read on a versioned route (core/routing.py:227-232)',
        ], { 'Idempotency-Key': 'abc' });
        expect.soft(sent.res.status()).toBe(200);
        expect.soft(asJson(sent.body).revision).toBe(3);
      });
    } finally {
      await cleanup.run();
    }
  });

  test('SCR-B06 · FL-B06-G-03 · N22 envelope: gate order (404 before 428), 428, 400, W21, strict baseVersion / body / overrides, 413', async () => {
    // core/routing.py:138-163 (W21, 428), core/errors.py:170-174; rules/router.py:3-4; rules/schemas.py:43-50; core/middleware.py:217-236.
    const cleanup = new Cleanup();
    try {
      const admin = await adminApi(cleanup);
      const pid = (await createProject(admin, 'b06-rules', 0)).projectId;
      deleteOnCleanup(cleanup, admin, pid);
      const put = (ev: string, data: unknown, claim: string, path = ruleConfigPath(pid)): Promise<Sent> => call(admin, ev, 'PUT', path, data, [claim]);
      const ok = (extra: Json = {}): Json => ({ baseVersion: 0, body: { overrides: {} }, ...extra });

      await test.step('[B06-G-036] malformed / missing project id + no baseVersion -> 404 project', async () => {
        const first = await put('B06-G-036_malformed_no_base', { body: {} }, '404 resource project: the project gate runs before the 428 guard (rules/router.py:3-4)', ruleConfigPath('prj_bad'));
        expect(first.res.status()).toBe(404);
        expectError(first, 404, 'NOT_FOUND', { resource: 'project' });
        expectError(await put('B06-G-036_missing_no_base', { body: {} }, '404 resource project (well-formed, no row)', ruleConfigPath(MISSING_PROJECT)), 404, 'NOT_FOUND', { resource: 'project' });
      });
      await test.step('[B06-G-033] no baseVersion -> 428', async () => {
        expectError(await put('B06-G-033_no_base', { body: { overrides: {} } }, '428 PRECONDITION_REQUIRED before Pydantic (routing.py:154-163)'), 428, 'PRECONDITION_REQUIRED');
      });
      await test.step('[B06-G-034] array / string body -> 428', async () => {
        expectError(await put('B06-G-034_array', [], '428: body is not an object with baseVersion'), 428, 'PRECONDITION_REQUIRED');
        expectError(await put('B06-G-034_string', 'junk', '428: body is a JSON string'), 428, 'PRECONDITION_REQUIRED');
      });
      await test.step('[B06-G-035] truncated JSON -> 400 MALFORMED_JSON without field', async () => {
        expectError(await put('B06-G-035_truncated', Buffer.from('{"baseVersion": 0,'), '400 MALFORMED_JSON (core/errors.py:170-174)'), 400, 'MALFORMED_JSON', { field: null });
      });
      await test.step('[B06-G-037] body projectId differs from path -> PATH_BODY_MISMATCH', async () => {
        expectError(await put('B06-G-037_mismatch', ok({ projectId: MISSING_PROJECT }), '422 PATH_BODY_MISMATCH field projectId (W21, routing.py:138-151)'), 422, 'PATH_BODY_MISMATCH', { field: 'projectId' });
      });
      await test.step('[B06-G-038] body projectId equals path -> VALIDATION (strict keys)', async () => {
        expectError(await put('B06-G-038_equal', ok({ projectId: pid }), '422 VALIDATION field projectId: unknown key (W1)'), 422, 'VALIDATION', { field: 'projectId' });
      });
      await test.step('[B06-G-039] baseVersion "0" / -1 / 1.5 / null -> VALIDATION', async () => {
        for (const [slug, value] of [['string', '0'], ['negative', -1], ['fraction', 1.5], ['null', null]] as const) {
          expectError(await put(`B06-G-039_${slug}`, ok({ baseVersion: value }), '422 VALIDATION field baseVersion: strict int >= 0 (schemas.py:49)'), 422, 'VALIDATION', { field: 'baseVersion' });
        }
      });
      await test.step('[B06-G-040] body missing -> VALIDATION body', async () => {
        expectError(await put('B06-G-040_body_missing', { baseVersion: 0 }, '422 VALIDATION field body'), 422, 'VALIDATION', { field: 'body' });
      });
      await test.step('[B06-G-043] overrides missing / array -> VALIDATION body.overrides', async () => {
        expectError(await put('B06-G-043_missing', { baseVersion: 0, body: {} }, '422 field body.overrides (schemas.py:43)'), 422, 'VALIDATION', { field: 'body.overrides' });
        expectError(await put('B06-G-043_array', { baseVersion: 0, body: { overrides: [] } }, '422 field body.overrides: not a map'), 422, 'VALIDATION', { field: 'body.overrides' });
      });
      await test.step('[B06-G-064] body over 1 MiB -> 413 PAYLOAD_TOO_LARGE', async () => {
        // S5-confirm: the web proxy lets a 1.0 MiB body through to the API (otherwise nginx answers 413 without the W7 body)
        const sent = await put('B06-G-064_over_1mib', bigBody(ok()), '413 PAYLOAD_TOO_LARGE before the handler (core/middleware.py:217-236; routing.py:46)');
        expectError(sent, 413, 'PAYLOAD_TOO_LARGE');
      });
    } finally {
      await cleanup.run();
    }
  });

  test('SCR-B06 · FL-B06-G-04 · N22 schema + catalog: override shapes, GENERAL rules, order catalog-before-version, nothing written, inclusive bounds', async () => {
    // rules/schemas.py:14-50; rules/service.py:62-80,106-108; catalog.py:72-93; core/errors.py:136-157 (field_of).
    const cleanup = new Cleanup();
    try {
      const admin = await adminApi(cleanup);
      const pid = (await createProject(admin, 'b06-rules', 0)).projectId;
      deleteOnCleanup(cleanup, admin, pid);
      const ok = (overrides: unknown, baseVersion = 0): Json => ({ baseVersion, body: { overrides } });
      const put = (ev: string, data: unknown, claim: string): Promise<Sent> => call(admin, ev, 'PUT', ruleConfigPath(pid), data, [claim]);
      let t0: unknown;

      await test.step('[B06-G-045] empty override {} for a catalog code -> VALIDATION', async () => {
        t0 = await updatedAt(admin, pid, 'B06-G-045_project_t0');
        const sent = await put('B06-G-045_empty_override', ok({ 'WALL-THICKNESS': {} }), '422 VALIDATION field body.overrides: an override needs >= 1 key (schemas.py:33-34)');
        expect(sent.res.status()).toBe(422);
        expectError(sent, 422, 'VALIDATION', { field: 'body.overrides' });
      });
      await test.step('[B06-G-046] empty override for GENERAL -> field body.overrides (no user key leaks)', async () => {
        // ⚑ today `field` is "body.overrides.general": field_of keeps every alnum dict key (core/errors.py:136-157)
        const sent = await put('B06-G-046_general_empty', ok({ GENERAL: {} }), '422 VALIDATION field body.overrides: a user dict key must not leak into field');
        expectError(sent, 422, 'VALIDATION', { field: 'body.overrides' });
      });
      await test.step('[B06-G-047] enabled null / "false" -> VALIDATION', async () => {
        for (const [slug, value] of [['null', null], ['string', 'false']] as const) {
          expectError(await put(`B06-G-047_${slug}`, ok({ 'WALL-THICKNESS': { enabled: value } }), '422 VALIDATION: StrictBool, null rejected (schemas.py:26,35-36)'), 422, 'VALIDATION', { field: 'body.overrides' });
        }
      });
      await test.step('[B06-G-048] severity "error" -> VALIDATION', async () => {
        expectError(await put('B06-G-048_severity', ok({ 'WALL-THICKNESS': { severity: 'error' } }), '422 VALIDATION: enum critical | warning | suggestion (schemas.py:20)'), 422, 'VALIDATION', { field: 'body.overrides' });
      });
      await test.step('[B06-G-049] thresholds {} / bad key / string value -> VALIDATION', async () => {
        const bodies: Array<[string, unknown]> = [
          ['empty', {}],
          ['key_pattern', { minThickness: 50 }],
          ['string_value', { 'wall.minThicknessMm': '50' }],
        ];
        for (const [slug, thresholds] of bodies) {
          expectError(await put(`B06-G-049_${slug}`, ok({ 'WALL-THICKNESS': { thresholds } }), '422 VALIDATION: min_length 1; key pattern; strict float (schemas.py:15,28)'), 422, 'VALIDATION', { field: 'body.overrides' });
        }
      });
      await test.step('[B06-G-055] GENERAL carrying wall.minThicknessMm -> RULE_THRESHOLD_UNKNOWN', async () => {
        expectError(await put('B06-G-055_general_foreign', ok({ GENERAL: { thresholds: { 'wall.minThicknessMm': 50 } } }), '422 RULE_THRESHOLD_UNKNOWN: GENERAL takes only general.* thresholds (service.py:62-80)'), 422, 'RULE_THRESHOLD_UNKNOWN', { field: 'body.overrides' });
      });
      await test.step('[B06-G-061] catalog check before version check', async () => {
        expectError(await put('B06-G-061_catalog_before_version', ok({ 'WALL-FOO': { enabled: false } }, 9), '422 RULE_CODE_UNKNOWN, not 409: catalog before version (service.py:106-108)'), 422, 'RULE_CODE_UNKNOWN', { field: 'body.overrides' });
      });
      await test.step('[B06-G-062] rejected bodies write nothing', async () => {
        const sent = await call(admin, 'B06-G-062_read_after', 'GET', ruleConfigPath(pid), undefined, ['200 {revision 0, overrides {}}: no rejected body was written']);
        expect.soft(sent.res.status()).toBe(200);
        expect.soft(sent.body).toEqual({ revision: 0, overrides: {} });
        expect.soft(await updatedAt(admin, pid, 'B06-G-062_project_t1'), 'rejected writes never touch the project').toBe(t0);
      });
      await test.step('[B06-G-057] range bounds are inclusive', async () => {
        const share05 = await put('B06-G-057_share_05', ok({ 'WALL-UNSUPPORTED': { thresholds: { 'wallSupport.minSupportShare': 0.5 } } }, 0), '200 revision 1: minSupportShare 0.5 (service.py:79)');
        expect(share05.res.status()).toBe(200);
        const share1 = await put('B06-G-057_share_1', ok({ 'WALL-UNSUPPORTED': { thresholds: { 'wallSupport.minSupportShare': 1 } } }, 1), '200 revision 2: minSupportShare 1 (upper bound, integer accepted)');
        expect.soft(share1.res.status()).toBe(200);
        const bounds = { 'WALL-THICKNESS': { thresholds: { 'wall.minThicknessMm': 30, 'wall.maxThicknessMm': 1000 } }, 'ESCAPE-DISTANCE': { thresholds: { 'escape.maxDistanceMm': 100000 } } };
        const edge = await put('B06-G-057_bounds', ok(bounds, 2), '200 revision 3: wall min 30 / max 1000 and escape.maxDistanceMm 100000 are inclusive bounds');
        expect.soft(edge.res.status()).toBe(200);
        expect.soft(edge.body).toEqual({ revision: 3, overrides: bounds });
      });
    } finally {
      await cleanup.run();
    }
  });

  test('SCR-B06 · FL-B06-G-05 · rule-config roles: viewer reads, viewer cannot write (403 before 428), non-member engineer gets 404', async () => {
    // rules/router.py:21-38 (N21 any member, N22 ruleset.edit); projects/access.py:45-100; matrix.py:53.
    const cleanup = new Cleanup();
    try {
      const admin = await adminApi(cleanup);
      const pid = (await createProject(admin, 'b06-rules', 0)).projectId;
      deleteOnCleanup(cleanup, admin, pid);
      const viewer = (await memberApi(admin, cleanup, pid, 'viewer')).api;
      const outsider = (await memberApi(admin, cleanup, pid, 'engineer', false)).api;

      await test.step('[B06-G-004] viewer member reads', async () => {
        const sent = await call(viewer, 'B06-G-004_viewer_read', 'GET', ruleConfigPath(pid), undefined, ['200: any member reads (require_project() without a key, rules/router.py:23)']);
        expect(sent.res.status()).toBe(200);
        expect.soft(sent.body).toEqual({ revision: 0, overrides: {} });
      });
      await test.step('[B06-G-065] viewer member PUT valid -> 403 FORBIDDEN, config unchanged', async () => {
        const sent = await call(viewer, 'B06-G-065_viewer_put', 'PUT', ruleConfigPath(pid), { baseVersion: 0, body: { overrides: {} } }, ['403 FORBIDDEN without resource: ruleset.edit is false for a viewer (access.py:99-100; matrix.py:53)']);
        expect.soft(expectError(sent, 403, 'FORBIDDEN'), '403 carries no resource').not.toHaveProperty('resource');
        const kept = await call(admin, 'B06-G-065_read_after', 'GET', ruleConfigPath(pid), undefined, ['200 {revision 0}: the viewer wrote nothing']);
        expect.soft(kept.body).toEqual({ revision: 0, overrides: {} });
      });
      await test.step('[B06-G-066] viewer member PUT without baseVersion -> 403, not 428', async () => {
        expectError(await call(viewer, 'B06-G-066_viewer_put_no_base', 'PUT', ruleConfigPath(pid), { body: {} }, ['403 FORBIDDEN: the permission gate runs before the 428 guard']), 403, 'FORBIDDEN');
      });
      await test.step('[B06-G-071] non-member engineer N21 and N22 -> 404 project', async () => {
        expectError(await call(outsider, 'B06-G-071_outsider_get', 'GET', ruleConfigPath(pid), undefined, ['404 resource project: 404 beats 403 (access.py:78-86)']), 404, 'NOT_FOUND', { resource: 'project' });
        expectError(await call(outsider, 'B06-G-071_outsider_put', 'PUT', ruleConfigPath(pid), { baseVersion: 0, body: { overrides: {} } }, ['404 resource project on the write too']), 404, 'NOT_FOUND', { resource: 'project' });
      });
    } finally {
      await cleanup.run();
    }
  });

  test('SCR-B06 · FL-B06-G-06 · versions list after a real pipeline run: shape, creators, notes, paging, limit and cursor errors', async () => {
    // versions/router.py:37-45; service.py:142-163; core/pagination.py:44-113; pipeline_persist/service.py:182-198; messages.py:18-20.
    needDrawing();
    test.setTimeout(SP_TIMEOUT_MS);
    const cleanup = new Cleanup();
    try {
      const admin = await adminApi(cleanup);
      const { pid, f1, f2 } = await seedPipeline(admin, cleanup, 'b06-ver-list');
      let v2id = '';
      let v1id = '';
      let cursor = '';

      await test.step('[B06-G-081] list after a real pipeline run', async () => {
        const doc = await layerDoc(admin, 'B06-G-081_layer', pid, f1, '200 N16 of the AI-written floor (revision after the pipeline write)');
        const { items, body } = await versions(admin, 'B06-G-081_list', pid, f1, '200 {items}: [v2 after, v1 before], sequence desc, exact keys');
        expect(items.map((v) => v.sequence)).toEqual([2, 1]);
        expect.soft(body, 'single page -> no nextCursor').not.toHaveProperty('nextCursor');
        const [v2, v1] = items;
        if (v2 === undefined || v1 === undefined) throw new Error('N17 did not list two versions');
        expect.soft(v2).toMatchObject({ creatorId: SYSTEM_PIPELINE, creatorName: PIPELINE_NAME, hasSnapshot: true, floorRevision: doc.revision });
        expect.soft(v2, 'the "after" version has no note').not.toHaveProperty('note');
        expect.soft(v2).not.toHaveProperty('label');
        expect.soft(v1).toMatchObject({ creatorId: SYSTEM_PIPELINE, creatorName: PIPELINE_NAME, hasSnapshot: true, note: BEFORE_PIPELINE_NOTE });
        expect.soft(Number(v1.floorRevision), 'before < after').toBeLessThan(Number(v2.floorRevision));
        v2id = String(v2.id);
        v1id = String(v1.id);
      });
      await test.step('[B06-G-086] limit=1 pages, limit=200', async () => {
        const page1 = await versions(admin, 'B06-G-086_page1', pid, f1, '200 limit 1 -> [v2] + string nextCursor (service.py:157-163)', '&limit=1');
        expect.soft(page1.items.map((v) => v.id)).toEqual([v2id]);
        expect.soft(typeof page1.body.nextCursor).toBe('string');
        cursor = String(page1.body.nextCursor);
        const page2 = await versions(admin, 'B06-G-086_page2', pid, f1, '200 page 2 = [v1] without nextCursor', `&limit=1&cursor=${encodeURIComponent(cursor)}`);
        expect.soft(page2.items.map((v) => v.id)).toEqual([v1id]);
        expect.soft(page2.body).not.toHaveProperty('nextCursor');
        const max = await versions(admin, 'B06-G-086_limit200', pid, f1, '200: limit 200 is the route ceiling (router.py:42)', '&limit=200');
        expect.soft(max.items).toHaveLength(2);
      });
      await test.step('[B06-G-087] limit 0 / 201 / abc -> VALIDATION limit', async () => {
        for (const limit of ['0', '201', 'abc']) {
          const sent = await call(admin, `B06-G-087_limit_${limit}`, 'GET', listPath(pid, f1, `&limit=${limit}`), undefined, ['422 VALIDATION field limit: 1..200 (router.py:39-42)']);
          expectError(sent, 422, 'VALIDATION', { field: 'limit' });
        }
      });
      await test.step('[B06-G-089] unknown floorId -> 404 floor', async () => {
        const sent = await call(admin, 'B06-G-089_floor_unknown', 'GET', listPath(pid, 'nope'), undefined, ['404 NOT_FOUND resource floor']);
        expectError(sent, 404, 'NOT_FOUND', { resource: 'floor' });
      });
      await test.step('[B06-G-091] cursor of another floor / tampered / abc.def -> CURSOR_INVALID before the floor lookup', async () => {
        const claim = '422 CURSOR_INVALID: MAC + op + floor digest checked BEFORE the floor lookup (service.py:150-153; pagination.py:96-113)';
        expectError(await call(admin, 'B06-G-091_other_floor', 'GET', listPath(pid, f2, `&cursor=${encodeURIComponent(cursor)}`), undefined, [claim]), 422, 'CURSOR_INVALID');
        expectError(await call(admin, 'B06-G-091_tampered', 'GET', listPath(pid, f1, `&cursor=${encodeURIComponent(`${cursor}x`)}`), undefined, [claim]), 422, 'CURSOR_INVALID');
        expectError(await call(admin, 'B06-G-091_garbage', 'GET', listPath(pid, f1, '&cursor=abc.def'), undefined, [claim]), 422, 'CURSOR_INVALID');
        expectError(await call(admin, 'B06-G-091_unknown_floor', 'GET', listPath(pid, 'nope', '&cursor=abc.def'), undefined, [claim]), 422, 'CURSOR_INVALID');
      });
      await test.step('[B06-G-099] malformed project id -> 404 project', async () => {
        const sent = await call(admin, 'B06-G-099_malformed_project', 'GET', listPath('prj_bad', f1), undefined, ['404 resource project without a DB query']);
        expectError(sent, 404, 'NOT_FOUND', { resource: 'project' });
      });
    } finally {
      await cleanup.run();
    }
  });

  test('SCR-B06 · FL-B06-G-07 · version read + snapshot + cross-project: #36 keys, N18 = N16, order of checks, IDOR via project Q, deleted project', async () => {
    // versions/service.py:93-112,129-139,166-176; versions/schemas.py:20-50; projects/access.py:64-86.
    needDrawing();
    test.setTimeout(SP_TIMEOUT_MS);
    const cleanup = new Cleanup();
    try {
      const admin = await adminApi(cleanup);
      const { pid, f1, f2 } = await seedPipeline(admin, cleanup, 'b06-ver-read');
      const q = (await createProject(admin, 'b06-ver-q', 0)).projectId;
      deleteOnCleanup(cleanup, admin, q);
      const start = await versions(admin, 'B06-G-111_setup_list', pid, f1, 'setup: [v2 after, v1 before]');
      const v2 = start.items[0];
      const v1 = start.items[1];
      if (v2 === undefined || v1 === undefined) throw new Error('setup: N17 did not list two versions');
      const v2id = String(v2.id);
      const v1id = String(v1.id);

      await test.step('[B06-G-111] read the pipeline versions', async () => {
        for (const [slug, v, hasNote] of [['v2', v2id, false], ['v1', v1id, true]] as const) {
          const sent = await call(admin, `B06-G-111_read_${slug}`, 'GET', versionPath(pid, v), undefined, ['200 #36 Version: id, projectId, sequence, createdAt, creatorId (+ note only when set) (schemas.py:20-28)']);
          expect(sent.res.status()).toBe(200);
          const out = expectKeys(sent.body, VERSION_KEYS, ['note']);
          expect.soft(out).toMatchObject({ id: v, projectId: pid, creatorId: SYSTEM_PIPELINE });
          expect.soft('note' in out, `${slug} note present`).toBe(hasNote);
        }
      });
      await test.step('[B06-G-114] ver_bad and an unknown id -> 404 version', async () => {
        for (const [slug, v] of [['malformed', 'ver_bad'], ['missing', MISSING_VERSION]] as const) {
          const sent = await call(admin, `B06-G-114_${slug}`, 'GET', versionPath(pid, v), undefined, ['404 NOT_FOUND resource version; a malformed id is answered without a query (service.py:99-100)']);
          expectError(sent, 404, 'NOT_FOUND', { resource: 'version' });
        }
      });
      await test.step('[B06-G-115] version of P under project Q -> 404 version', async () => {
        const sent = await call(admin, 'B06-G-115_cross_read', 'GET', versionPath(q, v2id), undefined, ['404 resource version: _locate filters project_id (service.py:105)']);
        expectError(sent, 404, 'NOT_FOUND', { resource: 'version' });
      });
      await test.step('[B06-G-131] snapshot of the AI version', async () => {
        const doc = await layerDoc(admin, 'B06-G-131_layer', pid, f1, '200 N16 at the same revision');
        const sent = await call(admin, 'B06-G-131_snapshot_v2', 'GET', snapshotPath(pid, v2id, f1), undefined, ['200 {versionId, layer, dimensions}; layer + dimensions equal N16 at the same revision; walls non-empty (service.py:166-176)']);
        expect(sent.res.status()).toBe(200);
        const snap = expectKeys(sent.body, SNAPSHOT_KEYS);
        expectZod(FloorVersionSnapshotSchema, sent.body, 'N18 v2');
        expect.soft(snap.versionId).toBe(v2id);
        expect.soft(snap.layer, 'layer = N16 layer').toEqual(doc.layer);
        expect.soft(snap.dimensions, 'dimensions = N16 dimensions').toEqual(doc.dimensions);
        expect.soft(asArray(asJson(snap.layer).walls, 'walls').length, 'the AI layer has walls').toBeGreaterThan(0);
      });
      await test.step('[B06-G-133] snapshot of the pipeline "before" version has no walls', async () => {
        // S5-confirm: the "before" layer of a fresh floor is empty (walls: [])
        const sent = await call(admin, 'B06-G-133_snapshot_v1', 'GET', snapshotPath(pid, v1id, f1), undefined, ['200: v1 = the floor before the AI write, layer.walls []']);
        expect(sent.res.status()).toBe(200);
        expectZod(FloorVersionSnapshotSchema, sent.body, 'N18 v1');
        expect.soft(asArray(asJson(asJson(sent.body).layer).walls, 'walls')).toEqual([]);
      });
      await test.step('[B06-G-135] other floor / unknown nope -> VERSION_FLOOR_MISMATCH floorId', async () => {
        const claim = '422 VERSION_FLOOR_MISMATCH field floorId (service.py:171-172)';
        expectError(await call(admin, 'B06-G-135_other_floor', 'GET', snapshotPath(pid, v2id, f2), undefined, [claim]), 422, 'VERSION_FLOOR_MISMATCH', { field: 'floorId' });
        expectError(await call(admin, 'B06-G-135_unknown_floor', 'GET', snapshotPath(pid, v2id, 'nope'), undefined, [claim]), 422, 'VERSION_FLOOR_MISMATCH', { field: 'floorId' });
      });
      await test.step('[B06-G-137] check order: ver_bad + wrong floor -> 404 version first', async () => {
        const sent = await call(admin, 'B06-G-137_order', 'GET', snapshotPath(pid, 'ver_bad', f2), undefined, ['404 resource version before the floor mismatch (service.py:169-173)']);
        expectError(sent, 404, 'NOT_FOUND', { resource: 'version' });
      });
      await test.step('[B06-G-183] restore of P version under Q -> 404 version, P history unchanged', async () => {
        const doc = await layerDoc(admin, 'B06-G-183_layer', pid, f1, '200 N16 revision of P');
        const sent = await call(admin, 'B06-G-183_cross_restore', 'POST', restorePath(q, v2id), { baseVersion: Number(doc.revision), body: { floorId: f1 } }, ['404 resource version (service.py:105)']);
        expectError(sent, 404, 'NOT_FOUND', { resource: 'version' });
        expect.soft((await versions(admin, 'B06-G-183_list_after', pid, f1, '200: P history unchanged')).items).toEqual(start.items);
      });
      await test.step('[B06-G-224] label of P version under Q -> 404 version, P unchanged', async () => {
        const sent = await call(admin, 'B06-G-224_cross_label', 'PATCH', labelPath(q, v2id), { label: 'e2e' }, ['404 resource version (service.py:105)']);
        expectError(sent, 404, 'NOT_FOUND', { resource: 'version' });
        expect.soft((await versions(admin, 'B06-G-224_list_after', pid, f1, '200: no label written on P')).items).toEqual(start.items);
      });
      await test.step('[B06-G-098] soft-deleted project -> 404 project', async () => {
        const gone = await call(admin, 'B06-G-098_delete_q', 'DELETE', `/api/projects/${q}`, undefined, ['setup: soft-delete project Q -> 200']);
        expect(gone.res.status()).toBe(200);
        expectError(await call(admin, 'B06-G-098_deleted_list', 'GET', listPath(q, f1), undefined, ['404 resource project: soft-deleted project (projects/access.py:76)']), 404, 'NOT_FOUND', { resource: 'project' });
      });
    } finally {
      await cleanup.run();
    }
  });

  test('SCR-B06 · FL-B06-G-08 · restore: guards, 409 rolls back the "before", restore AI version, replay, no-op, restore v1', async () => {
    // versions/router.py:62-82; service.py:179-298; snapshots.py:223-264 (K18); spatial_write/writer.py:349-372 (409).
    needDrawing();
    test.setTimeout(SP_TIMEOUT_MS);
    const cleanup = new Cleanup();
    try {
      const admin = await adminApi(cleanup);
      const { pid, f1 } = await seedPipeline(admin, cleanup, 'b06-ver-restore');
      const owner = await ownerOf(admin, pid);
      const start = await versions(admin, 'B06-G-151_setup_list', pid, f1, 'setup: [v2 after, v1 before] from the pipeline');
      const v2 = start.items[0];
      const v1 = start.items[1];
      if (v2 === undefined || v1 === undefined) throw new Error('setup: N17 did not list two versions');
      const v2id = String(v2.id);
      const v1id = String(v1.id);
      const r1 = Number(v2.floorRevision);
      const snap2 = await call(admin, 'B06-G-151_setup_snapshot_v2', 'GET', snapshotPath(pid, v2id, f1), undefined, ['setup: the content restore must bring back']);
      expect(snap2.res.status()).toBe(200);
      const aiLayer = asJson(snap2.body).layer;
      // A human edit after the pipeline (#35 at base r1): the AI row is no longer "current".
      await writeLayer({ request: admin, headers: {} }, pid, f1, qcLayer);
      const r2 = r1 + 1;
      expect((await layerDoc(admin, 'B06-G-151_setup_layer', pid, f1, 'setup: N16 revision r1 + 1 after the human write')).revision).toBe(r2);
      const post = (ev: string, v: string, data: unknown, claim: string): Promise<Sent> => call(admin, ev, 'POST', restorePath(pid, v), data, [claim]);
      const good = (base: number, floorId = f1): Json => ({ baseVersion: base, body: { floorId } });
      let restored: Sent | undefined;

      await test.step('[B06-G-151] no baseVersion -> 428', async () => {
        expectZod(RestoreVersionSchema, good(r2), 'own N19 body (the FE could send it)');
        const sent = await post('B06-G-151_no_base', v2id, { body: { floorId: f1 } }, '428 PRECONDITION_REQUIRED before Pydantic (routing.py:154-163)');
        expect(sent.res.status()).toBe(428);
        expectError(sent, 428, 'PRECONDITION_REQUIRED');
      });
      await test.step('[B06-G-152] truncated JSON -> 400 MALFORMED_JSON', async () => {
        expectError(await post('B06-G-152_truncated', v2id, Buffer.from('{"baseVersion": 1,'), '400 MALFORMED_JSON, no field'), 400, 'MALFORMED_JSON', { field: null });
      });
      await test.step('[B06-G-153] projectId / versionId in body differ from path -> PATH_BODY_MISMATCH', async () => {
        expectError(await post('B06-G-153_project', v2id, { ...good(r2), projectId: MISSING_PROJECT }, '422 PATH_BODY_MISMATCH field projectId (W21)'), 422, 'PATH_BODY_MISMATCH', { field: 'projectId' });
        expectError(await post('B06-G-153_version', v2id, { ...good(r2), versionId: v1id }, '422 PATH_BODY_MISMATCH field versionId (W21)'), 422, 'PATH_BODY_MISMATCH', { field: 'versionId' });
      });
      await test.step('[B06-G-155] body missing -> VALIDATION body', async () => {
        expectError(await post('B06-G-155_body_missing', v2id, { baseVersion: r2 }, '422 VALIDATION field body'), 422, 'VALIDATION', { field: 'body' });
      });
      await test.step('[B06-G-156] body.floorId empty / missing -> VALIDATION body.floorId', async () => {
        expectError(await post('B06-G-156_empty', v2id, { baseVersion: r2, body: { floorId: '' } }, '422 field body.floorId: min length 1 (schemas.py:56)'), 422, 'VALIDATION', { field: 'body.floorId' });
        expectError(await post('B06-G-156_missing', v2id, { baseVersion: r2, body: {} }, '422 field body.floorId: required'), 422, 'VALIDATION', { field: 'body.floorId' });
      });
      await test.step('[B06-G-160] stale base r1 after a human write -> 409 with remoteChanges', async () => {
        const sent = await post('B06-G-160_stale', v2id, good(r1), '409 VERSION_CONFLICT currentVersion r2, remoteChanges >= 1 with changedBy = the writer (writer.py W20)');
        expect(sent.res.status()).toBe(409);
        const changes = expectConflict(sent, r2);
        expect.soft(changes.length, 'remoteChanges lists the human edit').toBeGreaterThan(0);
        expect.soft(changes.every((c) => asJson(c).changedBy === owner.id), 'every remote change is the admin write').toBe(true);
      });
      await test.step('[B06-G-161] state after the 409: no version survives', async () => {
        const list = await versions(admin, 'B06-G-161_list', pid, f1, '200: still [v2, v1] - the "before" version is rolled back with the request (service.py:1-5)');
        expect.soft(list.items.map((v) => v.id)).toEqual([v2id, v1id]);
      });
      await test.step('[B06-G-162] restore the AI version at the current base -> 201', async () => {
        restored = await post('B06-G-162_restore_v2', v2id, good(r2), '201 FloorVersionSummary: sequence 4, floorRevision r2 + 1, note, creator = caller, hasSnapshot, no label (service.py:254-298; messages.py:8-10)');
        expect(restored.res.status()).toBe(201);
        expectZod(FloorVersionSummarySchema, restored.body, 'N19 201');
        const after = expectKeys(restored.body, SUMMARY_KEYS, SUMMARY_OPTIONAL);
        expect.soft(after).toMatchObject({ sequence: 4, floorRevision: r2 + 1, note: afterNote(2), creatorId: owner.id, creatorName: owner.name, hasSnapshot: true });
        expect.soft(after).not.toHaveProperty('label');
      });
      await test.step('[B06-G-163] history after the restore', async () => {
        const list = await versions(admin, 'B06-G-163_list', pid, f1, '200: [v4 (= the 201 body), v3 "before" the restore, v2, v1] (messages.py:13-15)');
        expect.soft(list.items.map((v) => v.sequence)).toEqual([4, 3, 2, 1]);
        expect.soft(list.items[0], 'N17 head = the 201 body').toEqual(restored?.body);
        expect.soft(list.items[1]).toMatchObject({ sequence: 3, floorRevision: r2, note: beforeNote(2), creatorId: owner.id, creatorName: owner.name });
      });
      await test.step('[B06-G-164] floor content after the restore', async () => {
        const doc = await layerDoc(admin, 'B06-G-164_layer', pid, f1, '200 N16: revision r2 + 1, layer = the v2 snapshot');
        expect.soft(doc.revision).toBe(r2 + 1);
        expect.soft(doc.layer, 'N16 layer = N18 v2 layer').toEqual(aiLayer);
      });
      await test.step('[B06-G-166] own repeat -> 200 same row, no new version, no extra activity', async () => {
        const sent = await post('B06-G-166_replay', v2id, good(r2), '200: own repeat (same user, version, base) returns the same row (service.py:179-197,232-234)');
        expect.soft(sent.res.status()).toBe(200);
        expect.soft(sent.body).toEqual(restored?.body);
        expect.soft((await versions(admin, 'B06-G-166_list', pid, f1, '200: still 4 versions')).items.map((v) => v.sequence)).toEqual([4, 3, 2, 1]);
        expect.soft((await activityOf(admin, owner.id, v2id, 'version.restore', 'B06-G-166_activity')).length, 'one version.restore row only').toBe(1);
      });
      await test.step('[B06-G-169] restore of content equal to the floor -> 201 existing row', async () => {
        const v4id = String(asJson(restored?.body).id);
        const sent = await post('B06-G-169_noop', v4id, good(r2 + 1), '201 with the EXISTING v4 (K18): no new version; floorRevision = baseVersion');
        expect.soft(sent.res.status()).toBe(201);
        expect.soft(sent.body).toEqual(restored?.body);
      });
      await test.step('[B06-G-171] restore v1 (before the AI write) -> sequence 5, empty layer', async () => {
        const sent = await post('B06-G-171_restore_v1', v1id, good(r2 + 1), '201 sequence 5, floorRevision r2 + 2, note v1; the "before" is not duplicated (snapshots.py:242-244)');
        expect(sent.res.status()).toBe(201);
        expect.soft(asJson(sent.body)).toMatchObject({ sequence: 5, floorRevision: r2 + 2, note: afterNote(1) });
        const doc = await layerDoc(admin, 'B06-G-171_layer', pid, f1, '200 N16: revision r2 + 2, no walls');
        expect.soft(doc.revision).toBe(r2 + 2);
        expect.soft(asArray(asJson(doc.layer).walls, 'walls')).toEqual([]);
        expect.soft((await versions(admin, 'B06-G-171_list', pid, f1, '200: [v5, v4, v3, v2, v1]')).items.map((v) => v.sequence)).toEqual([5, 4, 3, 2, 1]);
      });
    } finally {
      await cleanup.run();
    }
  });

  test('SCR-B06 · FL-B06-G-09 · label: set / same / list, UTF-16 limit, control and format characters, removal, check order, Idempotency-Key, 413', async () => {
    // versions/router.py:85-91; schemas.py:66-69; service.py:54-57,301-338; core/idempotency.py:79-96,198-234.
    needDrawing();
    test.setTimeout(SP_TIMEOUT_MS);
    const cleanup = new Cleanup();
    try {
      const admin = await adminApi(cleanup);
      const { pid, f1 } = await seedPipeline(admin, cleanup, 'b06-ver-label');
      const owner = await ownerOf(admin, pid);
      const start = await versions(admin, 'B06-G-201_setup_list', pid, f1, 'setup: [v2, v1] from the pipeline');
      const v2 = start.items[0];
      if (v2 === undefined) throw new Error('setup: no v2');
      const v2id = String(v2.id);
      const revision0 = (await layerDoc(admin, 'B06-G-201_setup_layer', pid, f1, 'setup: N16 revision before labelling')).revision;
      const patch = (ev: string, data: unknown, claim: string, headers?: Record<string, string>, v = v2id): Promise<Sent> => call(admin, ev, 'PATCH', labelPath(pid, v), data, [claim], headers);
      /** 200 FloorVersionSummary of the same row; `label === null` = key absent (W2). */
      const labelled = (sent: Sent, label: string | null, what: string): void => {
        expect.soft(sent.res.status(), `${what} status`).toBe(200);
        expectZod(FloorVersionSummarySchema, sent.body, what);
        const body = expectKeys(sent.body, SUMMARY_KEYS, SUMMARY_OPTIONAL);
        const { label: _a, ...rest } = body;
        const { label: _b, ...base } = v2;
        expect.soft(rest, `${what}: every other field unchanged`).toEqual(base);
        if (label === null) expect.soft(body, `${what}: label removed`).not.toHaveProperty('label');
        else expect.soft(body.label, `${what}: label`).toBe(label);
      };
      const rejected = async (slug: string, label: unknown, claim: string): Promise<void> => {
        expectError(await patch(slug, { label }, claim), 422, 'VALIDATION', { field: 'label' });
      };

      await test.step('[B06-G-201] NFD diacritics and padding -> NFC + trimmed', async () => {
        const raw = `  ${'Bản gửi chủ đầu tư'.normalize('NFD')}  `;
        expectZod(LabelVersionSchema, { label: raw }, 'own N20 body');
        const sent = await patch('B06-G-201_set', { label: raw }, '200: label stored nfc(strip) "Bản gửi chủ đầu tư", same row returned (service.py:301-311)');
        expect(sent.res.status()).toBe(200);
        labelled(sent, 'Bản gửi chủ đầu tư', 'N20 set');
      });
      await test.step('[B06-G-203] a label is no version', async () => {
        const list = await versions(admin, 'B06-G-203_list', pid, f1, '200: still 2 versions (service.py:314-321)');
        expect.soft(list.items.map((v) => v.sequence)).toEqual([2, 1]);
        expect.soft((await layerDoc(admin, 'B06-G-203_layer', pid, f1, '200 N16: revision unchanged by a label')).revision).toBe(revision0);
      });
      await test.step('[B06-G-205] same label again -> 200, no UPDATE, one activity', async () => {
        labelled(await patch('B06-G-205_same', { label: 'Bản gửi chủ đầu tư' }, '200: unchanged label -> no UPDATE, no activity (service.py:324-325)'), 'Bản gửi chủ đầu tư', 'N20 same');
        expect.soft((await activityOf(admin, owner.id, v2id, 'version.label', 'B06-G-205_activity')).length, 'the unchanged label logs nothing').toBe(1);
      });
      await test.step('[B06-G-206] label visible in the list', async () => {
        const list = await versions(admin, 'B06-G-206_list', pid, f1, '200: N17 head carries the label');
        expect.soft(list.items[0]?.label).toBe('Bản gửi chủ đầu tư');
      });
      await test.step('[B06-G-207] 60 UTF-16 units (a x60, 30 emoji) -> 200', async () => {
        labelled(await patch('B06-G-207_a60', { label: 'a'.repeat(60) }, '200: 60 units (service.py:54,308-309)'), 'a'.repeat(60), 'a x60');
        labelled(await patch('B06-G-207_emoji30', { label: '\u{1F600}'.repeat(30) }, '200: 30 emoji = 60 UTF-16 units'), '\u{1F600}'.repeat(30), '30 emoji');
      });
      await test.step('[B06-G-208] 70 trailing spaces -> stripped to a', async () => {
        labelled(await patch('B06-G-208_trailing', { label: `a${' '.repeat(70)}` }, '200: stripped before the length check'), 'a', 'trailing spaces');
      });
      await test.step('[B06-G-210] control / format characters -> 422 label', async () => {
        const claim = '422 VALIDATION field label: Cc / Cf refused (service.py:57,309)';
        await rejected('B06-G-210_bell_cc', 'Bản\u0007', claim);
        await rejected('B06-G-210_rlo_cf', 'Bản‮', claim);
        await rejected('B06-G-210_lrm_cf', 'Bản‎', claim);
      });
      await test.step('[B06-G-213] versionId in body differs from path -> PATH_BODY_MISMATCH', async () => {
        const sent = await patch('B06-G-213_mismatch', { label: 'x', versionId: String(start.items[1]?.id) }, '422 PATH_BODY_MISMATCH field versionId (W21)');
        expectError(sent, 422, 'PATH_BODY_MISMATCH', { field: 'versionId' });
      });
      await test.step('[B06-G-214] "" and spaces only remove the label', async () => {
        labelled(await patch('B06-G-214_empty', { label: '' }, '200: "" removes the label (service.py:311, W2: key absent)'), null, 'N20 ""');
        labelled(await patch('B06-G-214_spaces', { label: '    ' }, '200: spaces only -> stripped to "" -> no label'), null, 'N20 spaces');
      });
      await test.step('[B06-G-215] label checked before the version lookup', async () => {
        const sent = await patch('B06-G-215_before_lookup', { label: 'a'.repeat(61) }, '422 field label, not 404: normalize_label runs before _locate (service.py:322-323)', undefined, 'ver_bad');
        expectError(sent, 422, 'VALIDATION', { field: 'label' });
      });
      await test.step('[B06-G-217] Idempotency-Key "abc" -> VALIDATION idempotencyKey', async () => {
        const sent = await patch('B06-G-217_bad_key', { label: 'k' }, '422 VALIDATION field idempotencyKey: key shorter than 8 (core/idempotency.py:79-83)', { 'Idempotency-Key': 'abc' });
        expectError(sent, 422, 'VALIDATION', { field: 'idempotencyKey' });
      });
      const key = `qa-${randomUUID()}`;
      let first: Sent | undefined;
      await test.step('[B06-G-218] valid key replayed with the same body -> identical 200', async () => {
        first = await patch('B06-G-218_first', { label: 'k1' }, '200 label k1, response stored under the key', { 'Idempotency-Key': key });
        labelled(first, 'k1', 'idem first');
        const replay = await patch('B06-G-218_replay', { label: 'k1' }, '200 replayed: same key + same body (idempotency.py:232-233)', { 'Idempotency-Key': key });
        expect.soft(replay.res.status()).toBe(200);
        expect.soft(replay.body).toEqual(first.body);
      });
      await test.step('[B06-G-219] same key, another body -> IDEMPOTENCY_KEY_REUSED', async () => {
        const sent = await patch('B06-G-219_reused', { label: 'k2' }, '422 IDEMPOTENCY_KEY_REUSED (idempotency.py:230-231)', { 'Idempotency-Key': key });
        expectError(sent, 422, 'IDEMPOTENCY_KEY_REUSED');
      });
      await test.step('[B06-G-226] body over 1 MiB -> 413', async () => {
        const sent = await call(admin, 'B06-G-226_over_1mib', 'PATCH', labelPath(pid, v2id), bigBody({ label: 'x' }), ['413 PAYLOAD_TOO_LARGE before the handler (core/middleware.py:217-236)']);
        expectError(sent, 413, 'PAYLOAD_TOO_LARGE');
      });
      await test.step('[B06-G-228] ZWJ emoji sequence label -> 200', async () => {
        // ⚑ U+200D is category Cf and is refused today (service.py:57,309); only bidi / control characters are meant to be refused.
        const family = '\u{1F468}‍\u{1F469}‍\u{1F467}';
        labelled(await patch('B06-G-228_zwj', { label: family }, '200: a ZWJ emoji sequence is a valid label'), family, 'ZWJ family emoji');
      });
    } finally {
      await cleanup.run();
    }
  });

  test('SCR-B06 · FL-B06-G-10 · versions roles: viewer reads and gets 403 on restore / label, engineer restores and labels', async () => {
    // versions/router.py:33-34 (_Member / _Editor layer.edit); packages/domain/permissions/matrix.py:47; projects/access.py:45-100.
    needDrawing();
    test.setTimeout(SP_TIMEOUT_MS);
    const cleanup = new Cleanup();
    try {
      const admin = await adminApi(cleanup);
      const { pid, f1 } = await seedPipeline(admin, cleanup, 'b06-ver-roles');
      const start = await versions(admin, 'B06-G-097_setup_list', pid, f1, 'setup: [v2, v1] from the pipeline');
      const v2 = start.items[0];
      const v1 = start.items[1];
      if (v2 === undefined || v1 === undefined) throw new Error('setup: N17 did not list two versions');
      const v2id = String(v2.id);
      const v1id = String(v1.id);
      const r1 = Number(v2.floorRevision);
      const viewer = (await memberApi(admin, cleanup, pid, 'viewer')).api;
      const engineer = await memberApi(admin, cleanup, pid, 'engineer');

      await test.step('[B06-G-097] viewer member lists', async () => {
        const sent = await call(viewer, 'B06-G-097_viewer_list', 'GET', listPath(pid, f1), undefined, ['200: any member reads (versions/router.py:33)']);
        expect(sent.res.status()).toBe(200);
      });
      await test.step('[B06-G-118] viewer member reads a version', async () => {
        const sent = await call(viewer, 'B06-G-118_viewer_read', 'GET', versionPath(pid, v2id), undefined, ['200 #36 for a viewer member']);
        expect.soft(sent.res.status()).toBe(200);
      });
      await test.step('[B06-G-142] viewer member reads a snapshot', async () => {
        const sent = await call(viewer, 'B06-G-142_viewer_snapshot', 'GET', snapshotPath(pid, v2id, f1), undefined, ['200 N18 for a viewer member']);
        expect.soft(sent.res.status()).toBe(200);
      });
      await test.step('[B06-G-180] viewer member restore -> 403 before 428, Pydantic and the version lookup', async () => {
        const claim = '403 FORBIDDEN without resource: layer.edit is false for a viewer; the gate runs before the 428 guard, Pydantic and the version lookup';
        const cases: Array<[string, string, unknown]> = [
          ['valid', v1id, { baseVersion: r1, body: { floorId: f1 } }],
          ['no_body', v1id, undefined],
          ['malformed_version', 'ver_bad', { baseVersion: r1, body: { floorId: f1 } }],
        ];
        for (const [slug, v, data] of cases) {
          const sent = await call(viewer, `B06-G-180_${slug}`, 'POST', restorePath(pid, v), data, [claim]);
          expect.soft(expectError(sent, 403, 'FORBIDDEN'), '403 carries no resource').not.toHaveProperty('resource');
        }
      });
      await test.step('[B06-G-221] viewer member label -> 403, label unchanged', async () => {
        const claim = '403 FORBIDDEN for a valid and an invalid body';
        expectError(await call(viewer, 'B06-G-221_valid', 'PATCH', labelPath(pid, v2id), { label: 'viewer' }, [claim]), 403, 'FORBIDDEN');
        expectError(await call(viewer, 'B06-G-221_invalid', 'PATCH', labelPath(pid, v2id), { label: 5 }, [claim]), 403, 'FORBIDDEN');
        expect.soft((await versions(admin, 'B06-G-221_list_after', pid, f1, '200: the viewer labelled and restored nothing')).items).toEqual(start.items);
      });
      await test.step('[B06-G-181] engineer member restore -> 201 by the engineer', async () => {
        const sent = await call(engineer.api, 'B06-G-181_engineer_restore', 'POST', restorePath(pid, v1id), { baseVersion: r1, body: { floorId: f1 } }, [
          '201: engineer restores v1; the "after" version is created by the engineer, floorRevision r1 + 1 (service.py:230,288-297)',
        ]);
        expect(sent.res.status()).toBe(201);
        expectZod(FloorVersionSummarySchema, sent.body, 'engineer N19');
        expect.soft(asJson(sent.body)).toMatchObject({ creatorId: engineer.user.id, note: afterNote(1), floorRevision: r1 + 1 });
      });
      await test.step('[B06-G-222] engineer member label -> 200', async () => {
        const sent = await call(engineer.api, 'B06-G-222_engineer_label', 'PATCH', labelPath(pid, v2id), { label: 'engineer' }, ['200: engineer has layer.edit (matrix.py:47)']);
        expect.soft(sent.res.status()).toBe(200);
        expect.soft(asJson(sent.body).label).toBe('engineer');
      });
    } finally {
      await cleanup.run();
    }
  });
});
