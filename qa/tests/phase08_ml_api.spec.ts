/**
 * Phase 8 - BE ML admin (N23-N27), part A: auth matrix and registry reads/refusals through the real API (QA-08 P13, skill
 * `qa-api-test`), no browser, NO mocks, NOTHING WRITTEN. Flows FL-B08M-01..05 of `QA-08/flows-C6.md`; one `test.step('[<row id>] ...')`
 * per row of `catalog-C6.md`. Endpoints: `/api/admin/ml/*` (AppBack apps/api/admin_ml_{registry,jobs,datasets}/router.py).
 * Helpers: `support/p08/P13.ts`; admin client `support/p08/admin.ts` `adminApi`; pool users `poolUser`.
 *
 * ## Own data (S2 decision 1)
 * Read-only shared pool users `engineer:p08-eng` and `viewer:p08-view` (only signed in, never changed). Admin = seed admin, only used for
 * `poolUser` (GET /api/users; invites only on the first fill of a slot) and read calls. No write ever succeeds here: every PUT/POST is
 * refused (401/403/428/400/422) before it can change state, family = openingAndFurnitureDetection, `versionId:null` never reaches the DB.
 *
 * ## Real-backend budget per run of this file
 * - `POST /api/auth/login` per IP (120 / 60 s on the QA stack, 30 BE default): FL-B08M-02 admin + viewer + engineer = 3, FL-B08M-03 1,
 *   FL-B08M-04 1, FL-B08M-05 1 = 6 (+ one refresh each); the anonymous flow 0.
 * - `POST /api/users/invitations` (30 / 3600 s per admin): 0 once `p08-eng`/`p08-view` are filled; first run ever 2.
 * - None of the 15 ML routes has a rate limiter (catalog B08M-D-050).
 */
import { expect, test, type APIRequestContext } from '@playwright/test';

import { newApiContext, signedInApi } from './support/api';
import { adminApi } from './support/p08/admin';
import {
  DATASET_ROUTES,
  FAMILIES,
  JOBS_ROUTES,
  ML,
  NO_MODEL_VERSION,
  OPENING,
  REGISTRY_ROUTES,
  asJson,
  call,
  expectError,
  itemsOf,
  readPage,
  type Json,
  type MlRoute,
  type Sent,
} from './support/p08/P13';
import { poolUser } from './support/p08/pool';

const ENV = 'environment: ';
const DIM = 'dimensionReading'; // versionId:null on a non-wall family is still 422 (service.py:150-152)

/** Every route of `routes` as `api`; each must answer `status`/`code` (401/403 error body). `hard` = bước H. */
async function sweep(
  api: APIRequestContext,
  id: string,
  routes: readonly MlRoute[],
  status: number,
  code: string,
  noResource: boolean,
  why: string,
  options: { write?: 'truncated' | 'body'; hard?: boolean } = {},
): Promise<void> {
  expect(routes.length, `${id}: route count`).toBeGreaterThan(0);
  for (const route of routes) {
    const write = route.method !== 'GET';
    const raw = options.write === 'truncated' && write ? '{"x":' : options.write === 'body' ? route.raw : undefined;
    const body = options.write === 'body' ? route.body : undefined;
    const sent = await call(api, id, route.slug, route.method, route.path, body, [why], raw === undefined ? {} : { raw });
    expectError(sent, status, code, undefined, noResource ? null : undefined, options.hard ?? false);
  }
}

test.describe('phase 08 · ML admin API · A', () => {
  test('SCR-34..36 · FL-B08M-01 · anonymous and bad bearer on all 15 ML routes', async () => {
    const anon = await newApiContext();
    const why = 'no Authorization -> 401 UNAUTHENTICATED (core/routing.py:128-135)';
    try {
      await test.step('[B08M-D-001] anonymous on registry N23-N27 -> 401', async () => {
        expect(REGISTRY_ROUTES, '5 registry routes').toHaveLength(5);
        await sweep(anon, 'B08M-D-001', REGISTRY_ROUTES, 401, 'UNAUTHENTICATED', false, why, { hard: true });
      });
      await test.step('[B08M-D-002] anonymous on jobs N32-N37 -> 401', async () => {
        expect(JOBS_ROUTES, '6 jobs routes').toHaveLength(6);
        await sweep(anon, 'B08M-D-002', JOBS_ROUTES, 401, 'UNAUTHENTICATED', false, why);
      });
      await test.step('[B08M-D-003] anonymous on datasets N28-N31 -> 401', async () => {
        expect(DATASET_ROUTES, '4 datasets routes').toHaveLength(4);
        await sweep(anon, 'B08M-D-003', DATASET_ROUTES, 401, 'UNAUTHENTICATED', false, why);
      });
      await test.step('[B08M-D-004] anonymous truncated JSON -> 401, never 400', async () => {
        const writes = [...REGISTRY_ROUTES, ...JOBS_ROUTES, ...DATASET_ROUTES].filter((r) => r.method !== 'GET');
        expect(writes, 'POST/PUT ML routes').toHaveLength(6);
        await sweep(anon, 'B08M-D-004', writes, 401, 'UNAUTHENTICATED', false, 'truncated JSON `{"x":` still 401, never 400 MALFORMED_JSON (auth before body, routing.py:128-133)', { write: 'truncated' });
      });
      await test.step('[B08M-D-005] Bearer not-a-jwt -> 401', async () => {
        const sent = await call(anon, 'B08M-D-005', 'garbage_bearer', 'GET', `${ML}/model-families`, undefined, ['Bearer not-a-jwt -> 401 UNAUTHENTICATED (routing.py:134)'], {
          headers: { Authorization: 'Bearer not-a-jwt' },
        });
        expectError(sent, 401, 'UNAUTHENTICATED');
      });
      await test.step('[B08M-D-006] Basic scheme -> 401', async () => {
        const sent = await call(anon, 'B08M-D-006', 'basic_scheme', 'GET', `${ML}/datasets`, undefined, ['Authorization: Basic xxx -> 401 UNAUTHENTICATED (scheme != bearer, routing.py:130-132)'], {
          headers: { Authorization: 'Basic xxx' },
        });
        expectError(sent, 401, 'UNAUTHENTICATED');
      });
    } finally {
      await anon.dispose();
    }
  });

  test('SCR-34..36 · FL-B08M-02 · viewer and engineer get 403 on all 15 ML routes', async () => {
    test.setTimeout(120_000);
    const admin = await adminApi();
    let viewer: APIRequestContext | undefined;
    let engineer: APIRequestContext | undefined;
    try {
      const v = await poolUser(admin, 'viewer', 'p08-view');
      const e = await poolUser(admin, 'engineer', 'p08-eng');
      viewer = await signedInApi(v.email, v.password);
      engineer = await signedInApi(e.email, e.password);
      const forbid = (api: APIRequestContext, id: string, routes: readonly MlRoute[], hard = false): Promise<void> =>
        sweep(api, id, routes, 403, 'FORBIDDEN', true, '403 FORBIDDEN, no resource (router-level require_admin)', { write: 'body', hard });
      const invalidBodies = async (api: APIRequestContext, id: string): Promise<void> => {
        for (const [slug, path] of [['job_create_invalid', `${ML}/training-jobs`], ['dataset_create_invalid', `${ML}/datasets`]] as const) {
          const sent = await call(api, id, slug, 'POST', path, { family: 5, epochs: 'x' }, ['invalid body -> 403 FORBIDDEN, not 422: the role gate runs before body validation']);
          expectError(sent, 403, 'FORBIDDEN', undefined, null);
        }
      };
      const noBase = async (api: APIRequestContext, id: string): Promise<void> => {
        const sent = await call(api, id, 'activate_no_base', 'PUT', `${ML}/model-families/wallSegmentation/active`, { body: { versionId: null } }, [
          '403 FORBIDDEN, not 428: the permission dependency runs before the W20 guard (routing.py:10)',
        ]);
        expectError(sent, 403, 'FORBIDDEN', undefined, null);
      };
      const notMultipart = async (api: APIRequestContext, id: string): Promise<void> => {
        const sent = await call(api, id, 'upload_not_multipart', 'POST', `${ML}/model-versions`, undefined, ['non-multipart body -> 403 FORBIDDEN before the stream is read'], { raw: 'not multipart' });
        expectError(sent, 403, 'FORBIDDEN', undefined, null);
      };

      await test.step('[B08M-D-011] viewer on registry -> 403', () => forbid(viewer!, 'B08M-D-011', REGISTRY_ROUTES, true));
      await test.step('[B08M-D-012] viewer on jobs -> 403', () => forbid(viewer!, 'B08M-D-012', JOBS_ROUTES));
      await test.step('[B08M-D-013] viewer on datasets -> 403', () => forbid(viewer!, 'B08M-D-013', DATASET_ROUTES));
      await test.step('[B08M-D-014] viewer invalid body -> 403 not 422', () => invalidBodies(viewer!, 'B08M-D-014'));
      await test.step('[B08M-D-015] viewer PUT active without baseVersion -> 403 not 428', () => noBase(viewer!, 'B08M-D-015'));
      await test.step('[B08M-D-016] viewer non-multipart upload -> 403', () => notMultipart(viewer!, 'B08M-D-016'));
      await test.step('[B08M-D-021] engineer on registry -> 403', () => forbid(engineer!, 'B08M-D-021', REGISTRY_ROUTES));
      await test.step('[B08M-D-022] engineer on jobs -> 403', () => forbid(engineer!, 'B08M-D-022', JOBS_ROUTES));
      await test.step('[B08M-D-023] engineer on datasets -> 403', () => forbid(engineer!, 'B08M-D-023', DATASET_ROUTES));
      await test.step('[B08M-D-024] engineer invalid body -> 403 not 422', () => invalidBodies(engineer!, 'B08M-D-024'));
      await test.step('[B08M-D-025] engineer PUT active without baseVersion -> 403 not 428', () => noBase(engineer!, 'B08M-D-025'));
      await test.step('[B08M-D-026] engineer non-multipart upload -> 403', () => notMultipart(engineer!, 'B08M-D-026'));
      await test.step('[B08M-D-030] admin control reads -> 200', async () => {
        for (const [slug, path] of [['families', `${ML}/model-families`], ['jobs', `${ML}/training-jobs`], ['datasets', `${ML}/datasets`]] as const) {
          const sent = await call(admin, 'B08M-D-030', slug, 'GET', path, undefined, ['admin control: 200 (the 403s above are about the role, not a broken route)']);
          expect(sent.res.status(), `admin GET ${path}`).toBe(200);
        }
      });
    } finally {
      await viewer?.dispose();
      await engineer?.dispose();
      await admin.dispose();
    }
  });

  test('SCR-36 · FL-B08M-03 · registry read: families and versions list filters', async () => {
    const admin = await adminApi();
    try {
      let families: Json[] = [];
      await test.step('[B08M-G-001] GET model-families: 3 items in order', async () => {
        // service.py:55-65, schemas.py ModelFamilyOut
        const sent = await call(admin, 'B08M-G-001', 'families', 'GET', `${ML}/model-families`, undefined, ['200 {items}: wallSegmentation, openingAndFurnitureDetection, dimensionReading; {family, revision} + activeVersionId only when set']);
        expect(sent.res.status()).toBe(200);
        families = itemsOf(sent.body);
        expect(families.map((f) => f.family)).toEqual([...FAMILIES]);
        for (const f of families) {
          expect(typeof f.revision, `${String(f.family)} revision`).toBe('number');
          if ('activeVersionId' in f) expect(typeof f.activeVersionId).toBe('string');
        }
      });
      await test.step('[B08M-G-002] families: nextCursor absent', async () => {
        const sent = await call(admin, 'B08M-G-002', 'families', 'GET', `${ML}/model-families`, undefined, ['3 families, never paged: nextCursor key absent']);
        expect.soft(asJson(sent.body)).not.toHaveProperty('nextCursor');
      });
      await test.step('[B08M-G-003] family without active version: key absent, not null', async () => {
        // W2, schemas.py family_out
        for (const f of families) expect.soft(f.activeVersionId, `${String(f.family)}: activeVersionId is never null`).not.toBeNull();
        const lacking = families.filter((f) => !('activeVersionId' in f));
        expect.soft(lacking.length, `${ENV}a family without an active version (dimensionReading or wall on the classic path)`).toBeGreaterThan(0);
        await call(admin, 'B08M-G-003', 'families', 'GET', `${ML}/model-families`, undefined, [`families without activeVersionId key: ${lacking.map((f) => String(f.family)).join(', ') || 'none'}`]);
      });
      await test.step('[B08M-G-004] families wire has no extra columns', async () => {
        for (const f of families) {
          const extra = Object.keys(f).filter((k) => !['family', 'revision', 'activeVersionId'].includes(k));
          expect.soft(extra, `${String(f.family)}: no lastWriterId / lastBodySha256 / extras`).toEqual([]);
        }
        await call(admin, 'B08M-G-004', 'families', 'GET', `${ML}/model-families`, undefined, ['keys subset of {family, revision, activeVersionId}']);
      });
      await test.step('[B08M-G-010] versions default: newest first, no internal columns, metrics iff completed', async () => {
        // service.py:174-200, schemas.py metrics_out
        const sent = await call(admin, 'B08M-G-010', 'versions', 'GET', `${ML}/model-versions`, undefined, ['200 page newest first by (createdAt, id) desc; no weightsKey/pinnedName/evaluationAttempts/evaluationErrorCode']);
        expect.soft(sent.res.status()).toBe(200);
        const versions = itemsOf(sent.body);
        expect.soft(versions.length, `${ENV}model versions seeded`).toBeGreaterThan(0);
        // wire createdAt is cut to ms while the BE sorts on microseconds: assert time only, never the id tie-break
        const times = versions.map((v) => Date.parse(String(v.createdAt)));
        expect.soft(times, 'createdAt not increasing').toEqual([...times].sort((a, b) => b - a));
        for (const v of versions) {
          for (const key of ['weightsKey', 'pinnedName', 'evaluationAttempts', 'evaluationErrorCode']) expect.soft(v).not.toHaveProperty(key);
          expect.soft(v.metrics !== undefined, 'metrics present iff completed').toBe(v.evaluationStatus === 'completed');
        }
      });
      await test.step('[B08M-G-011] ?family filters each of the 3 families', async () => {
        for (const family of FAMILIES) {
          const sent = await call(admin, 'B08M-G-011', family, 'GET', `${ML}/model-versions?family=${family}`, undefined, [`?family=${family}: every item has that family (service.py:186-187)`]);
          expect.soft(sent.res.status()).toBe(200);
          for (const v of itemsOf(sent.body)) expect.soft(v.family).toBe(family);
        }
      });
      await test.step('[B08M-G-012] ?family=doors -> 422', async () => {
        const sent = await call(admin, 'B08M-G-012', 'family_doors', 'GET', `${ML}/model-versions?family=doors`, undefined, ['422 VALIDATION field "family" (service.py:182-183)']);
        expectError(sent, 422, 'VALIDATION', 'family');
      });
      await test.step('[B08M-G-013] ?limit=0 -> 422', async () => {
        const sent = await call(admin, 'B08M-G-013', 'limit_0', 'GET', `${ML}/model-versions?limit=0`, undefined, ['422 VALIDATION field "limit" (pagination.py:56-58)']);
        expectError(sent, 422, 'VALIDATION', 'limit');
      });
      await test.step('[B08M-G-014] ?limit=201 -> 422', async () => {
        const sent = await call(admin, 'B08M-G-014', 'limit_201', 'GET', `${ML}/model-versions?limit=201`, undefined, ['route max 200 (router.py:35): 422 VALIDATION field "limit"']);
        expectError(sent, 422, 'VALIDATION', 'limit');
      });
      await test.step('[B08M-G-015] ?limit=200 and ?limit=1 -> 200', async () => {
        for (const limit of [200, 1]) {
          const sent = await call(admin, 'B08M-G-015', `limit_${limit}`, 'GET', `${ML}/model-versions?limit=${limit}`, undefined, [`limit=${limit} boundary -> 200`]);
          expect.soft(sent.res.status(), `limit=${limit}`).toBe(200);
        }
      });
      await test.step('[B08M-G-016] ?limit=abc and ?limit=1.5 -> 422', async () => {
        for (const [slug, limit] of [['abc', 'abc'], ['1_5', '1.5']] as const) {
          const sent = await call(admin, 'B08M-G-016', `limit_${slug}`, 'GET', `${ML}/model-versions?limit=${limit}`, undefined, [`limit=${limit} (int parse) -> 422 VALIDATION field "limit"`]);
          expectError(sent, 422, 'VALIDATION', 'limit');
        }
      });
      await test.step('[B08M-G-017] ?cursor=garbage -> 422 CURSOR_INVALID', async () => {
        const sent = await call(admin, 'B08M-G-017', 'cursor_garbage', 'GET', `${ML}/model-versions?cursor=garbage`, undefined, ['unsigned cursor -> 422 CURSOR_INVALID, no field (pagination.py:96-113)']);
        expectError(sent, 422, 'CURSOR_INVALID', null);
      });
    } finally {
      await admin.dispose();
    }
  });

  test('SCR-36 · FL-B08M-04 · registry read: paging, cursors, single version', async () => {
    const admin = await adminApi();
    try {
      const all = await readPage(admin, `${ML}/model-versions?limit=200`);
      const enc = encodeURIComponent;
      const versionsUrl = (query: string): string => `${ML}/model-versions?${query}`;
      let cursor = '';
      await test.step('[B08M-G-018] limit=1 then cursor -> second newest row', async () => {
        // service.py:188-191
        const p1 = await call(admin, 'B08M-G-018', 'page1', 'GET', versionsUrl('limit=1'), undefined, ['page 1: 1 item + nextCursor (b64.b64)']);
        expect(p1.res.status()).toBe(200);
        expect(itemsOf(p1.body)).toHaveLength(1);
        cursor = String(asJson(p1.body).nextCursor ?? '');
        expect(cursor, `${ENV}at least 2 model versions so page 1 has a nextCursor`).toMatch(/^[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+$/u);
        const p2 = await call(admin, 'B08M-G-018', 'page2', 'GET', versionsUrl(`limit=1&cursor=${enc(cursor)}`), undefined, ['page 2 first item = the 2nd newest row (tuple compare)']);
        expect(p2.res.status()).toBe(200);
        const fresh = await readPage(admin, `${ML}/model-versions?limit=200`);
        const at = fresh.findIndex((v) => v.id === itemsOf(p1.body)[0]?.id);
        expect(at, 'page-1 row is in a fresh read').toBeGreaterThanOrEqual(0);
        expect(itemsOf(p2.body)[0]?.id).toBe(fresh[at + 1]?.id);
      });
      await test.step('[B08M-G-019] limit >= row count: no nextCursor', async () => {
        // service.py:192-200
        const sent = await call(admin, 'B08M-G-019', 'last_page', 'GET', versionsUrl('limit=200'), undefined, ['limit >= row count: nextCursor absent on the last page']);
        expect.soft(itemsOf(sent.body).length, `${ENV}fewer than 200 versions for a last-page check`).toBeLessThan(200);
        expect.soft(asJson(sent.body)).not.toHaveProperty('nextCursor');
      });
      await test.step('[B08M-G-020] cursor reused with another family -> 422', async () => {
        const sent = await call(admin, 'B08M-G-020', 'other_family', 'GET', versionsUrl(`limit=1&family=${OPENING}&cursor=${enc(cursor)}`), undefined, ['cursor issued without filter, reused with &family -> 422 CURSOR_INVALID (digest differs)']);
        expectError(sent, 422, 'CURSOR_INVALID', null);
      });
      await test.step('[B08M-G-021] model-versions cursor on training-jobs -> 422', async () => {
        const sent = await call(admin, 'B08M-G-021', 'other_op', 'GET', `${ML}/training-jobs?cursor=${enc(cursor)}`, undefined, ['cursor of another op -> 422 CURSOR_INVALID']);
        expectError(sent, 422, 'CURSOR_INVALID', null);
      });
      await test.step('[B08M-G-022] cursor payload edited -> 422', async () => {
        const [payload, mac] = cursor.split('.');
        const sent = await call(admin, 'B08M-G-022', 'tampered', 'GET', versionsUrl(`cursor=${enc(`${payload!}x.${mac!}`)}`), undefined, ['payload edited, MAC kept -> 422 CURSOR_INVALID']);
        expectError(sent, 422, 'CURSOR_INVALID', null);
      });
      await test.step('[B08M-G-023] same cursor with its own family filter -> 200', async () => {
        const family = FAMILIES.find((f) => all.filter((v) => v.family === f).length >= 2);
        expect.soft(family, `${ENV}a family with at least 2 model versions`).toBeDefined();
        if (family === undefined) return;
        const p1 = await call(admin, 'B08M-G-023', 'page1', 'GET', versionsUrl(`limit=1&family=${family}`), undefined, [`page 1 of family ${family}`]);
        const own = String(asJson(p1.body).nextCursor ?? '');
        expect.soft(own, 'nextCursor for the filtered page').not.toBe('');
        const sent = await call(admin, 'B08M-G-023', 'page2', 'GET', versionsUrl(`limit=1&family=${family}&cursor=${enc(own)}`), undefined, ['same filter as issued (digest equal) -> 200, items of that family']);
        expect.soft(sent.res.status()).toBe(200);
        for (const v of itemsOf(sent.body)) expect.soft(v.family).toBe(family);
      });
      await test.step('[B08M-G-030] GET version deep-equals its list row', async () => {
        const row = (await readPage(admin, `${ML}/model-versions?limit=200`))[0];
        expect(row, `${ENV}at least one model version`).toBeDefined();
        const sent = await call(admin, 'B08M-G-030', 'one', 'GET', `${ML}/model-versions/${String(row!.id)}`, undefined, ['200 body deep-equals its list row (service.py read_version)']);
        expect.soft(sent.res.status()).toBe(200);
        expect.soft(sent.body).toEqual(row);
      });
      await test.step('[B08M-G-031] unknown well-formed id -> 404', async () => {
        const sent = await call(admin, 'B08M-G-031', 'unknown', 'GET', `${ML}/model-versions/${NO_MODEL_VERSION}`, undefined, ['404 NOT_FOUND resource "modelVersion" (errors.py version_not_found)']);
        expectError(sent, 404, 'NOT_FOUND', undefined, 'modelVersion');
      });
      await test.step('[B08M-G-032] id garbage -> 404 not 422', async () => {
        const sent = await call(admin, 'B08M-G-032', 'garbage', 'GET', `${ML}/model-versions/garbage`, undefined, ['404 NOT_FOUND "modelVersion", never 422']);
        expectError(sent, 404, 'NOT_FOUND', undefined, 'modelVersion');
      });
      await test.step('[B08M-G-033] id with %00 -> proxy 400 (nginx, before the API), never 500', async () => {
        // Q12-Q14 decision: nginx answers 400 text/html for %00 in the URL path (evidence A08_B08M-G-033_nul.json); NUL stays covered in the body (G-054) and by pytest
        const sent = await call(admin, 'B08M-G-033', 'nul', 'GET', `${ML}/model-versions/mdl_x%00`, undefined, ['proxy 400 text/html for %00 in the path; never 500']);
        expect(sent.res.status(), 'proxy 400, not 500').toBe(400);
        expect.soft(sent.res.headers()['content-type'], 'nginx html page').toContain('text/html');
      });
    } finally {
      await admin.dispose();
    }
  });

  test('SCR-36 · FL-B08M-05 · N24 body-shape refusals, nothing written', async () => {
    const admin = await adminApi();
    try {
      // Only the row of the family this flow PUTs to is compared: dimensionReading is activated by nobody else (FL-B08M-07 wall, main FL-M-36R-01 opening).
      const rowOf = (items: Json[]): string => JSON.stringify(items.find((f) => f.family === DIM));
      const snapshot = async (id: string, slug: string): Promise<string> => {
        const res = await call(admin, id, slug, 'GET', `${ML}/model-families`, undefined, [`GET families: the ${DIM} row (revision, activeVersionId) for the nothing-written check`]);
        return rowOf(itemsOf(res.body));
      };
      const before = rowOf(await readPage(admin, `${ML}/model-families`));
      const revision = Number((JSON.parse(before) as Json).revision);
      expect(Number.isInteger(revision), `setup: ${DIM} revision`).toBe(true);
      const put = (id: string, slug: string, body: unknown, why: string, options: { raw?: string } = {}): Promise<Sent> =>
        call(admin, id, slug, 'PUT', `${ML}/model-families/${DIM}/active`, body, [why], options);
      const invalid = (field: string, sent: Sent): void => void expectError(sent, 422, 'VALIDATION', field);

      await test.step('[B08M-G-040] no baseVersion -> 428', async () => {
        // routing.py:154-163
        const sent = await put('B08M-G-040', 'no_base', { body: { versionId: null } }, '428 PRECONDITION_REQUIRED before Pydantic');
        expectError(sent, 428, 'PRECONDITION_REQUIRED', undefined, undefined, true);
        expect(await snapshot('B08M-G-040', 'after'), 'nothing written').toBe(before);
      });
      await test.step('[B08M-G-041] JSON array body -> 428', async () => {
        const sent = await put('B08M-G-041', 'array', undefined, '428 PRECONDITION_REQUIRED (routing.py:159-161)', { raw: '[1]' });
        expectError(sent, 428, 'PRECONDITION_REQUIRED');
      });
      await test.step('[B08M-G-042] malformed JSON -> 400', async () => {
        const sent = await put('B08M-G-042', 'malformed', undefined, '400 MALFORMED_JSON', { raw: '{"baseVersion":' });
        expectError(sent, 400, 'MALFORMED_JSON');
      });
      await test.step('[B08M-G-043] baseVersion "R" -> 422', async () => {
        invalid('baseVersion', await put('B08M-G-043', 'string', { baseVersion: 'R', body: { versionId: null } }, '422 VALIDATION field "baseVersion" (strict int)'));
      });
      await test.step('[B08M-G-044] baseVersion -1 / 1.5 / true -> 422', async () => {
        for (const [slug, baseVersion] of [['neg', -1], ['float', 1.5], ['bool', true]] as const) {
          invalid('baseVersion', await put('B08M-G-044', slug, { baseVersion, body: { versionId: null } }, `baseVersion ${String(baseVersion)} -> 422 field "baseVersion" (strict, ge=0)`));
        }
      });
      await test.step('[B08M-G-045] unknown outer key force -> 422', async () => {
        invalid('force', await put('B08M-G-045', 'force', { baseVersion: revision, body: { versionId: null }, force: true }, '422 VALIDATION field "force" (extra=forbid, C03)'));
      });
      await test.step('[B08M-G-046] body without versionId -> 422', async () => {
        invalid('body.versionId', await put('B08M-G-046', 'no_version_id', { baseVersion: revision, body: {} }, '422 VALIDATION field "body.versionId" (required, nullable)'));
      });
      await test.step('[B08M-G-047] body with unknown inner key -> 422', async () => {
        invalid('body.x', await put('B08M-G-047', 'inner_key', { baseVersion: revision, body: { versionId: null, x: 1 } }, '422 VALIDATION field "body.x" (extra=forbid on both shells)'));
      });
      await test.step('[B08M-G-048] body.versionId a number -> 422', async () => {
        invalid('body.versionId', await put('B08M-G-048', 'number', { baseVersion: revision, body: { versionId: 7 } }, '422 VALIDATION field "body.versionId"'));
        expect.soft(await snapshot('B08M-G-048', 'after'), 'nothing written by any refusal').toBe(before);
      });
    } finally {
      await admin.dispose();
    }
  });
});
