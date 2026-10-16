/**
 * Phase 8 — SCR-34/36 BACKEND ML admin through the real API (QA-08 P14, skill `qa-api-test`), no browser, NO mocks.
 * Flows FL-B08M-06..10 of `QA-08/flows-C6.md` (N24 refusals + no-op, N24 real wall activation with restore, N26 upload
 * refusals, N28 dataset reads, N29 dataset create); one `test()` per flow, one `test.step('[<row id>] …')` per catalog row.
 * Endpoints: PUT /api/admin/ml/model-families/{family}/active, POST /api/admin/ml/model-versions (refused only),
 * GET/POST /api/admin/ml/datasets, GET /api/admin/ml/datasets/{id}/versions. `BE:` = AppBack main `apps/api/`.
 *
 * ## Global state
 * - FL-B08M-07 is the ONLY real activation (family `wallSegmentation`): `withWallRestore` records the wall family's active version and
 *   puts it back in `finally`; the flow's own hard step G-064 restores first. Revision grows by 2 (not restorable).
 *   Never run in parallel with UI SCR-36 on the wall family.
 * - FL-B08M-08 stores nothing (every upload is refused); compared against the model-versions id list.
 * - FL-B08M-07 adds 2 `MODEL_ACTIVATE` activity rows per run (not restorable).
 * - FL-B08M-10 creates 4 datasets (G-127 setup needs a NEW name: a 409 is not stored, routing.py:276) `${TEST_DATA_PREFIX}b08m-${RUN_ID}-<attempt>-<n>` PERMANENTLY (no delete API, cleanup.mjs has no dataset code): <= 3 per run, listed in the report.
 *
 * ## Real-backend budget per run of this file
 * - `POST /api/auth/login`: 1 admin (`adminApi`, 5 flows = 5 logins; limit 120 / 60 s on the QA stack, 30 BE default).
 * - No invitations (admin seed only; no pool user needed: every row of P14 is admin). Idempotency rows: 2 (FL-B08M-10 G-126, G-127, 24 h TTL).
 * - ~120 requests in total; no ML route of P14 has a rate limit.
 */
import { randomUUID } from 'node:crypto';

import { expect, test } from '@playwright/test';

import { TEST_DATA_PREFIX, RUN_ID } from './support/evidence';
import { adminApi } from './support/p08/admin';
import {
  DIMENSION,
  FAMILIES,
  ML,
  NO_DATASET,
  NO_MODEL_VERSION,
  OPENING,
  WALL,
  activeBody,
  activePath,
  asJson,
  buildMlUpload,
  call,
  expectError,
  familyRow,
  rawPost413,
  readFamilies,
  readVersions,
  sha256,
  withWallRestore,
  type Json,
} from './support/p08/P14';

const items = (body: unknown): Json[] => (asJson(body).items as Json[]) ?? [];
const familiesState = (rows: readonly { family: string; revision: number; activeVersionId?: string }[]): string =>
  JSON.stringify(rows.map((r) => [r.family, r.revision, r.activeVersionId ?? null]).sort());

test.describe('phase08 ML admin API B', () => {
  test('SCR-36 · FL-B08M-06 · N24 domain refusals and no-op, nothing written', async () => {
    const admin = await adminApi();
    try {
      const baseline = await readFamilies(admin);
      const opening = familyRow(baseline, OPENING);
      const dimension = familyRow(baseline, DIMENSION);
      const versions = await readVersions(admin);
      const put = (id: string, slug: string, family: string, body: unknown, why: string) =>
        call(admin, id, slug, 'PUT', activePath(family), body, [why]);

      await test.step('[B08M-G-049] family `doors` in the path -> 404 modelFamily', async () => {
        const sent = await put('B08M-G-049', 'family_doors', 'doors', activeBody(0, null), '404 NOT_FOUND resource modelFamily (service.py:141-142)');
        expectError(sent, 404, 'NOT_FOUND', undefined, 'modelFamily', true);
      });
      await test.step('[B08M-G-050] dimensionReading with versionId null -> 422 MODEL_VERSION_FAMILY_MISMATCH', async () => {
        const sent = await put('B08M-G-050', 'dimension_null', DIMENSION, activeBody(dimension.revision, null), '422 MODEL_VERSION_FAMILY_MISMATCH (null only for walls, service.py:150-152)');
        expectError(sent, 422, 'MODEL_VERSION_FAMILY_MISMATCH');
      });
      await test.step('[B08M-G-051] opening family with versionId null -> 422, families unchanged', async () => {
        const sent = await put('B08M-G-051', 'opening_null', OPENING, activeBody(opening.revision, null), '422 MODEL_VERSION_FAMILY_MISMATCH; GET families unchanged');
        expectError(sent, 422, 'MODEL_VERSION_FAMILY_MISMATCH');
        expect.soft(familiesState(await readFamilies(admin)), 'families unchanged').toBe(familiesState(baseline));
      });
      await test.step('[B08M-G-052] baseVersion = revision + 1 -> 409 VERSION_CONFLICT', async () => {
        const active = opening.activeVersionId;
        expect.soft(active, 'environment: opening family needs an active version').toBeTruthy();
        const sent = await put('B08M-G-052', 'stale_base', OPENING, activeBody(opening.revision + 1, active ?? NO_MODEL_VERSION), '409 VERSION_CONFLICT currentVersion = revision, remoteChanges [] (service.py:145-148)');
        const body = expectError(sent, 409, 'VERSION_CONFLICT');
        expect.soft(body.currentVersion).toBe(opening.revision);
        expect.soft(body.remoteChanges).toEqual([]);
      });
      await test.step('[B08M-G-053] well-formed unknown versionId -> 404 modelVersion', async () => {
        const sent = await put('B08M-G-053', 'unknown_version', OPENING, activeBody(opening.revision, NO_MODEL_VERSION), '404 NOT_FOUND resource modelVersion (service.py:95-98)');
        expectError(sent, 404, 'NOT_FOUND', undefined, 'modelVersion');
      });
      await test.step('[B08M-G-054] garbage id and NUL id -> 404 modelVersion, not 500', async () => {
        for (const [slug, id] of [['garbage', 'garbage'], ['nul', 'mdl_\u0000x']] as const) {
          const sent = await put('B08M-G-054', `version_${slug}`, OPENING, activeBody(opening.revision, id), `404 NOT_FOUND modelVersion for ${slug}; NOT 500`);
          expectError(sent, 404, 'NOT_FOUND', undefined, 'modelVersion');
        }
      });
      await test.step('[B08M-G-055] wall version sent to the opening family -> 422 MODEL_VERSION_FAMILY_MISMATCH', async () => {
        const wall = versions.find((v) => v.family === WALL);
        expect.soft(wall, 'environment: a wallSegmentation version').toBeDefined();
        const sent = await put('B08M-G-055', 'other_family', OPENING, activeBody(opening.revision, wall?.id ?? NO_MODEL_VERSION), '422 MODEL_VERSION_FAMILY_MISMATCH (service.py:99-100)');
        expectError(sent, 422, 'MODEL_VERSION_FAMILY_MISMATCH');
      });
      await test.step('[B08M-G-056] non-onnx version -> 422 MODEL_FORMAT_UNSUPPORTED', async () => {
        const v = versions.find((x) => x.weightsFormat !== 'onnx');
        expect.soft(v, 'environment: a safetensors version').toBeDefined();
        const family = familyRow(baseline, v?.family ?? OPENING);
        const sent = await put('B08M-G-056', 'not_onnx', family.family, activeBody(family.revision, v?.id ?? NO_MODEL_VERSION), '422 MODEL_FORMAT_UNSUPPORTED (service.py:101-102)');
        expectError(sent, 422, 'MODEL_FORMAT_UNSUPPORTED');
      });
      await test.step('[B08M-G-057] onnx version not completed -> 422 MODEL_VERSION_NOT_EVALUATED', async () => {
        const v = versions.find((x) => x.weightsFormat === 'onnx' && x.evaluationStatus !== 'completed');
        expect.soft(v, 'environment: an onnx version that is not completed').toBeDefined();
        const family = familyRow(baseline, v?.family ?? OPENING);
        const sent = await put('B08M-G-057', 'not_evaluated', family.family, activeBody(family.revision, v?.id ?? NO_MODEL_VERSION), '422 MODEL_VERSION_NOT_EVALUATED (service.py:103-104)');
        expectError(sent, 422, 'MODEL_VERSION_NOT_EVALUATED');
      });
      await test.step('[B08M-G-058] re-activate the active opening version -> 200 current row, revision kept', async () => {
        expect(opening.activeVersionId, 'environment: opening family needs an active version').toBeTruthy();
        const sent = await put('B08M-G-058', 'noop_same_version', OPENING, activeBody(opening.revision, opening.activeVersionId!), '200 {activeVersionId, family, revision} equal to the current row (service.py:155-156)');
        expect.soft(sent.res.status()).toBe(200);
        expect.soft(asJson(sent.body)).toEqual({ activeVersionId: opening.activeVersionId, family: OPENING, revision: opening.revision });
      });
      await test.step('[B08M-G-059] after every refusal GET families equals the baseline', async () => {
        const after = await call(admin, 'B08M-G-059', 'families_after', 'GET', `${ML}/model-families`, undefined, ['every family revision + activeVersionId equals the baseline (no write)']);
        expect.soft(familiesState(items(after.body) as never)).toBe(familiesState(baseline));
      });
    } finally {
      await admin.dispose();
    }
  });

  test('SCR-36 · FL-B08M-07 · N24 real activation of the wall family with restore', async () => {
    const admin = await adminApi();
    try {
      // Q13: a wall version is never activated by QA. No active wall version -> skip the real activation (G-061..064), run only the no-write check.
      const before = familyRow(await readFamilies(admin), WALL);
      if (!before.activeVersionId) {
        test.info().annotations.push({ type: 'environment', description: 'no active wall version - Q13, DEBT' });
        await test.step('[B08M-G-061] SKIPPED real activation (no active wall version, Q13); no-write check: family row readable, nothing written', async () => {
          const again = familyRow(await readFamilies(admin), WALL);
          expect.soft(again.family, 'wall family row is listed').toBe(WALL);
          expect.soft(again.revision, 'revision unchanged: no write happened').toBe(before.revision);
          expect.soft(again.activeVersionId, 'still no active version').toBeUndefined();
        });
        return;
      }
      await withWallRestore(admin, async (wall) => {
        const R = wall.revision;
        const captured = wall.activeVersionId;
        expect(captured, 'environment: wallSegmentation needs an active version to restore').toBeTruthy();
        const put = (id: string, slug: string, body: unknown, why: string) => call(admin, id, slug, 'PUT', activePath(WALL), body, [why]);

        await test.step('[B08M-G-061] REAL write: wall versionId null with baseVersion R -> 200 revision R+1, no activeVersionId', async () => {
          const sent = await put('B08M-G-061', 'wall_null', activeBody(R, null), '200 {family wallSegmentation, revision R+1}, activeVersionId absent (set_active_version)');
          expect(sent.res.status()).toBe(200);
          const body = asJson(sent.body);
          expect(body.family).toBe(WALL);
          expect(body.revision).toBe(R + 1);
          expect(body).not.toHaveProperty('activeVersionId');
          const row = familyRow(await readFamilies(admin), WALL);
          expect.soft(row.revision).toBe(R + 1);
          expect.soft(row.activeVersionId).toBeUndefined();
        });
        await test.step('[B08M-G-062] REAL repeat of the identical PUT -> 200, revision stays R+1', async () => {
          const sent = await put('B08M-G-062', 'wall_repeat', activeBody(R, null), '200 current row, revision stays R+1 (_is_repeat)');
          expect.soft(sent.res.status()).toBe(200);
          expect.soft(asJson(sent.body).revision).toBe(R + 1);
        });
        await test.step('[B08M-G-063] baseVersion R with a different body -> 409 VERSION_CONFLICT currentVersion R+1', async () => {
          const sent = await put('B08M-G-063', 'wall_conflict', activeBody(R, captured!), '409 VERSION_CONFLICT currentVersion R+1 (not a repeat of the same body)');
          const body = expectError(sent, 409, 'VERSION_CONFLICT');
          expect.soft(body.currentVersion).toBe(R + 1);
        });
        await test.step('[B08M-G-064] RESTORE: baseVersion R+1 with the captured version -> 200 revision R+2', async () => {
          const sent = await put('B08M-G-064', 'wall_restore', activeBody(R + 1, captured!), '200 {activeVersionId captured, revision R+2}; GET families confirms');
          expect(sent.res.status()).toBe(200);
          const body = asJson(sent.body);
          expect(body.activeVersionId).toBe(captured);
          expect(body.revision).toBe(R + 2);
          const row = familyRow(await readFamilies(admin), WALL);
          expect(row.activeVersionId, 'restore proof').toBe(captured);
        });
      });
    } finally {
      await admin.dispose();
    }
  });

  test('SCR-36 · FL-B08M-08 · N26 upload refusals, nothing stored', async () => {
    const admin = await adminApi();
    try {
      const idsOf = async (): Promise<string> => JSON.stringify((await readVersions(admin)).map((v) => v.id));
      const baseline = await idsOf();
      const weights = Buffer.concat([Buffer.from([0x08]), Buffer.from('qa08-onnx-junk')]);
      // G-075..078 send zip bytes (never onnx-looking): if the BE regressed and accepted the metadata it still stops at 422 MODEL_FORMAT_UNSUPPORTED before storing
      const pk = Buffer.from('PKqa08');
      const meta = (over: Json = {}): Json => ({
        checksumSha256: sha256(weights),
        family: WALL,
        label: `${TEST_DATA_PREFIX}b08m-up`,
        weightsFormat: 'onnx',
        ...over,
      });
      const upload = (id: string, slug: string, built: ReturnType<typeof buildMlUpload>, why: string) =>
        call(admin, id, slug, 'POST', `${ML}/model-versions`, undefined, [why], { headers: built.headers, raw: built.data });

      await test.step('[B08M-G-070] Content-Type application/json -> 422 VALIDATION', async () => {
        const sent = await call(admin, 'B08M-G-070', 'json_body', 'POST', `${ML}/model-versions`, meta(), ['422 VALIDATION (no multipart boundary, upload.py _boundary)']);
        expectError(sent, 422, 'VALIDATION', undefined, undefined, true);
      });
      await test.step('[B08M-G-071] first part named weights -> 422 field weights', async () => {
        const built = buildMlUpload({ parts: [{ name: 'weights', content: weights, filename: 'w.bin' }, { name: 'metadata', content: JSON.stringify(meta()) }] });
        expectError(await upload('B08M-G-071', 'weights_first', built, '422 VALIDATION field weights (first part must be metadata)'), 422, 'VALIDATION', 'weights');
      });
      await test.step('[B08M-G-072] metadata only -> 422 field weights', async () => {
        const built = buildMlUpload({ parts: [{ name: 'metadata', content: JSON.stringify(meta()) }] });
        expectError(await upload('B08M-G-072', 'no_weights', built, '422 VALIDATION field weights'), 422, 'VALIDATION', 'weights');
      });
      await test.step('[B08M-G-073] third part extra -> 422 field extra', async () => {
        const built = buildMlUpload({ parts: [{ name: 'metadata', content: JSON.stringify(meta()) }, { name: 'weights', content: weights, filename: 'w.bin' }, { name: 'extra', content: 'x' }] });
        expectError(await upload('B08M-G-073', 'third_part', built, '422 VALIDATION field extra; nothing stored'), 422, 'VALIDATION', 'extra');
        expect.soft(await idsOf(), 'nothing stored').toBe(baseline);
      });
      await test.step('[B08M-G-074] metadata over 16 KiB -> 422 field metadata', async () => {
        const big = JSON.stringify(meta({ label: 'a'.repeat(17 * 1024) }));
        expect(big.length).toBeGreaterThan(16 * 1024);
        const built = buildMlUpload({ metadata: big, weights });
        expectError(await upload('B08M-G-074', 'metadata_17k', built, '422 VALIDATION field metadata (METADATA_MAX_BYTES)'), 422, 'VALIDATION', 'metadata');
      });
      await test.step('[B08M-G-075] metadata with unknown key x -> 422 field x', async () => {
        const built = buildMlUpload({ metadata: meta({ x: 1, checksumSha256: sha256(pk) }), weights: pk });
        expectError(await upload('B08M-G-075', 'unknown_key', built, '422 VALIDATION field x (C03)'), 422, 'VALIDATION', 'x');
      });
      await test.step('[B08M-G-076] checksumSha256 not 64 lowercase hex -> 422 field checksumSha256', async () => {
        for (const [slug, value] of [['short', 'abc'], ['upper', sha256(weights).toUpperCase()]] as const) {
          const built = buildMlUpload({ metadata: meta({ checksumSha256: value }), weights: pk });
          expectError(await upload('B08M-G-076', `checksum_${slug}`, built, `422 VALIDATION field checksumSha256 (${slug})`), 422, 'VALIDATION', 'checksumSha256');
        }
      });
      await test.step('[B08M-G-077] family doors / weightsFormat pt -> 422 field family / weightsFormat', async () => {
        const fam = buildMlUpload({ metadata: meta({ family: 'doors', checksumSha256: sha256(pk) }), weights: pk });
        expectError(await upload('B08M-G-077', 'family_doors', fam, '422 VALIDATION field family'), 422, 'VALIDATION', 'family');
        const fmt = buildMlUpload({ metadata: meta({ weightsFormat: 'pt', checksumSha256: sha256(pk) }), weights: pk });
        expectError(await upload('B08M-G-077', 'format_pt', fmt, '422 VALIDATION field weightsFormat'), 422, 'VALIDATION', 'weightsFormat');
      });
      await test.step('[B08M-G-078] label empty / over the limit -> 422 field label', async () => {
        for (const [slug, label] of [['empty', ''], ['long', 'L'.repeat(81)]] as const) {
          const built = buildMlUpload({ metadata: meta({ label, checksumSha256: sha256(pk) }), weights: pk });
          expectError(await upload('B08M-G-078', `label_${slug}`, built, `422 VALIDATION field label (${slug}, max 80)`), 422, 'VALIDATION', 'label');
        }
      });
      await test.step('[B08M-G-079] onnx declared, bytes start PK -> 422 MODEL_FORMAT_UNSUPPORTED', async () => {
        const zip = Buffer.from('PK\u0003\u0004qa08');
        const built = buildMlUpload({ metadata: meta({ checksumSha256: sha256(zip) }), weights: zip });
        expectError(await upload('B08M-G-079', 'zip_bytes', built, '422 MODEL_FORMAT_UNSUPPORTED (_head_matches)'), 422, 'MODEL_FORMAT_UNSUPPORTED');
        expect.soft(await idsOf(), 'version list unchanged').toBe(baseline);
      });
      await test.step('[B08M-G-080] onnx-looking bytes, wrong checksum -> 422 MODEL_CHECKSUM_MISMATCH', async () => {
        const built = buildMlUpload({ metadata: meta({ checksumSha256: sha256(Buffer.from('other')) }), weights });
        expectError(await upload('B08M-G-080', 'checksum_mismatch', built, '422 MODEL_CHECKSUM_MISMATCH field checksumSha256; version list unchanged'), 422, 'MODEL_CHECKSUM_MISMATCH', 'checksumSha256');
        expect.soft(await idsOf(), 'version list unchanged').toBe(baseline);
      });
      await test.step('[B08M-G-081] Content-Length 536870913 -> 413 PAYLOAD_TOO_LARGE', async () => {
        const sent = await rawPost413(`${ML}/model-versions`, 536_870_913); // limit + 1 (UPLOAD_BODY_LIMIT 536870912)
        expect(sent.status, '413 before the handler (middleware.py:218-233)').toBe(413);
        expect.soft((JSON.parse(sent.text) as Json).code).toBe('PAYLOAD_TOO_LARGE');
        expect.soft(await idsOf(), 'version list unchanged').toBe(baseline);
      });
    } finally {
      await admin.dispose();
    }
  });

  test('SCR-34 · FL-B08M-09 · datasets read: list, filters, versions 404 and contract', async () => {
    const admin = await adminApi();
    try {
      const get = (id: string, slug: string, path: string, why: string) => call(admin, id, slug, 'GET', path, undefined, [why]);
      const list = await readDatasets(admin);

      await test.step('[B08M-G-100] GET datasets default: newest first, only {createdAt, family, id, name}', async () => {
        const sent = await get('B08M-G-100', 'list', `${ML}/datasets`, '200 page newest first by (createdAt,id); items carry only createdAt/family/id/name');
        expect(sent.res.status()).toBe(200);
        const rows = items(sent.body);
        for (const r of rows) expect.soft(Object.keys(r).sort()).toEqual(['createdAt', 'family', 'id', 'name']);
        const ord = (r: Json): [number, string] => [Date.parse(String(r.createdAt)), String(r.id)];
        const sorted = [...rows].sort((a, b) => ord(b)[0] - ord(a)[0] || (ord(b)[1] < ord(a)[1] ? -1 : 1));
        expect.soft(rows.map((x) => x.id), 'newest first').toEqual(sorted.map((x) => x.id));
      });
      await test.step('[B08M-G-101] ?family=<each family> -> only that family', async () => {
        for (const family of FAMILIES) {
          const sent = await get('B08M-G-101', `family_${family}`, `${ML}/datasets?family=${family}`, `200, every item has family ${family}`);
          expect.soft(sent.res.status()).toBe(200);
          for (const r of items(sent.body)) expect.soft(r.family).toBe(family);
        }
      });
      await test.step('[B08M-G-102] ?family=doors -> 422 field family', async () => {
        expectError(await get('B08M-G-102', 'family_doors', `${ML}/datasets?family=doors`, '422 VALIDATION field family'), 422, 'VALIDATION', 'family');
      });
      await test.step('[B08M-G-103] ?limit=0 and ?limit=201 -> 422 field limit', async () => {
        for (const limit of [0, 201]) {
          expectError(await get('B08M-G-103', `limit_${limit}`, `${ML}/datasets?limit=${limit}`, `422 VALIDATION field limit (${limit})`), 422, 'VALIDATION', 'limit');
        }
      });
      await test.step('[B08M-G-104] ?cursor=x.y -> 422 CURSOR_INVALID', async () => {
        expectError(await get('B08M-G-104', 'cursor', `${ML}/datasets?cursor=x.y`, '422 CURSOR_INVALID'), 422, 'CURSOR_INVALID');
      });
      await test.step('[B08M-G-110] versions of unknown dst_000... -> 404 dataset', async () => {
        expectError(await get('B08M-G-110', 'unknown', `${ML}/datasets/${NO_DATASET}/versions`, '404 NOT_FOUND resource dataset'), 404, 'NOT_FOUND', undefined, 'dataset');
      });
      await test.step('[B08M-G-111] versions of id garbage -> 404 dataset, never 422', async () => {
        expectError(await get('B08M-G-111', 'garbage', `${ML}/datasets/garbage/versions`, '404 NOT_FOUND dataset'), 404, 'NOT_FOUND', undefined, 'dataset');
      });
      await test.step('[B08M-G-112] versions of an id with %00 -> proxy 400 (nginx, before the API), never 500', async () => {
        // Q12-Q14 decision: nginx answers 400 text/html for %00 in the URL path (evidence A08_B08M-G-112_nul.json); NUL stays covered in the body (G-054) and by pytest
        const sent = await get('B08M-G-112', 'nul', `${ML}/datasets/dst_%00x/versions`, 'proxy 400 text/html for %00 in the path; never 500');
        expect(sent.res.status(), 'proxy 400, not 500').toBe(400);
        expect.soft(sent.res.headers()['content-type'], 'nginx html page').toContain('text/html');
      });
      await test.step('[B08M-G-114] versions of a dataset that has some: order and fields', async () => {
        let found: { id: string; rows: Json[] } | undefined;
        for (const d of list) {
          const res = await admin.get(`${ML}/datasets/${String(d.id)}/versions`);
          const rows = items(await res.json());
          if (rows.length > 0) {
            found = { id: String(d.id), rows };
            break;
          }
        }
        expect.soft(found, 'environment: a dataset with at least one version').toBeDefined();
        if (found) {
          const sent = await get('B08M-G-114', 'versions', `${ML}/datasets/${found.id}/versions`, 'sequence strictly descending; manifestSha256+splitCounts iff ready; failureCode iff failed; no internal fields');
          const rows = items(sent.body);
          const seq = rows.map((r) => Number(r.sequence));
          for (let i = 1; i < seq.length; i += 1) expect.soft(seq[i]).toBeLessThan(seq[i - 1]!);
          for (const r of rows) {
            expect.soft('manifestSha256' in r, 'manifestSha256 iff ready').toBe(r.status === 'ready');
            expect.soft('splitCounts' in r, 'splitCounts iff ready').toBe(r.status === 'ready');
            expect.soft('failureCode' in r, 'failureCode iff failed').toBe(r.status === 'failed');
            for (const k of ['projectIds', 'requeueCount', 'createdBy', 'buildStartedAt']) expect.soft(r).not.toHaveProperty(k);
          }
        }
      });
      await test.step('[B08M-G-115] versions cursor of dataset A used on dataset B -> 422 CURSOR_INVALID', async () => {
        let cursor: string | undefined;
        let a = '';
        for (const d of list) {
          const res = await admin.get(`${ML}/datasets/${String(d.id)}/versions?limit=1`);
          const next = asJson(await res.json()).nextCursor;
          if (typeof next === 'string') {
            cursor = next;
            a = String(d.id);
            break;
          }
        }
        expect.soft(cursor, 'environment: a dataset with at least 2 versions (cursor source)').toBeDefined();
        const b = list.find((d) => String(d.id) !== a);
        expect.soft(b, 'environment: a second dataset').toBeDefined();
        if (cursor && b) {
          const sent = await get('B08M-G-115', 'cursor_other_dataset', `${ML}/datasets/${String(b.id)}/versions?cursor=${encodeURIComponent(cursor)}`, '422 CURSOR_INVALID (datasetId in filters digest)');
          expectError(sent, 422, 'CURSOR_INVALID');
        }
      });
    } finally {
      await admin.dispose();
    }
  });

  test('SCR-34 · FL-B08M-10 · dataset create: 201, 409 name collisions, idempotency, paging', async () => {
    const admin = await adminApi();
    try {
      const attempt = Date.now().toString(36); // datasets cannot be deleted: a unique token per run keeps reruns/retries from 409
      const name = (n: number | string): string => `${TEST_DATA_PREFIX}b08m-${RUN_ID}-${attempt}-${n}`;
      const post = (id: string, slug: string, body: Json, why: string, headers?: Record<string, string>) =>
        call(admin, id, slug, 'POST', `${ML}/datasets`, body, [why], headers ? { headers } : {});
      const n1 = name(1);
      const n2 = `${name('Straße-é-2')}`; // NFC: U+00DF, U+00E9
      const n3 = name(3);
      let first = '';

      await test.step('[B08M-G-120] POST datasets -> 201, listed first', async () => {
        const sent = await post('B08M-G-120', 'create', { name: n1, family: OPENING }, '201 {createdAt, family, id dst_, name}; GET /datasets lists it first');
        expect(sent.res.status()).toBe(201);
        const body = asJson(sent.body);
        expect(Object.keys(body).sort()).toEqual(['createdAt', 'family', 'id', 'name']);
        expect(String(body.id)).toMatch(/^dst_/u);
        first = String(body.id);
        expect.soft((await readDatasets(admin))[0]?.id).toBe(first);
      });
      await test.step('[B08M-G-121] same name again -> 409 DATASET_NAME_TAKEN', async () => {
        expectError(await post('B08M-G-121', 'dup', { name: n1, family: OPENING }, '409 DATASET_NAME_TAKEN'), 409, 'DATASET_NAME_TAKEN');
      });
      await test.step('[B08M-G-122] UPPER case / outer spaces -> 409 DATASET_NAME_TAKEN', async () => {
        for (const [slug, value] of [['upper', n1.toUpperCase()], ['spaces', `  ${n1}  `]] as const) {
          expectError(await post('B08M-G-122', slug, { name: value, family: OPENING }, `409 DATASET_NAME_TAKEN (${slug})`), 409, 'DATASET_NAME_TAKEN');
        }
      });
      await test.step('[B08M-G-123] Straße then STRASSE -> 409 (casefold)', async () => {
        const made = await post('B08M-G-123', 'strasse_create', { name: n2, family: OPENING }, '201 for the Straße name');
        expect(made.res.status()).toBe(201);
        const twin = n2.replace('Straße', 'STRASSE');
        expectError(await post('B08M-G-123', 'strasse_twin', { name: twin, family: OPENING }, '409 (casefold maps U+00DF to ss)'), 409, 'DATASET_NAME_TAKEN');
      });
      await test.step('[B08M-G-124] NFD twin of an NFC name -> 409, stored name NFC', async () => {
        const nfd = n2.normalize('NFD');
        expect(nfd).not.toBe(n2);
        expectError(await post('B08M-G-124', 'nfd_twin', { name: nfd, family: OPENING }, '409 (clean_text NFC before name_key)'), 409, 'DATASET_NAME_TAKEN');
        const stored = (await readDatasets(admin)).find((d) => d.name === n2);
        expect.soft(stored, 'the NFC name is stored and returned NFC').toBeDefined();
      });
      await test.step('[B08M-G-126] Idempotency-Key replay -> same response, one dataset', async () => {
        const key = { 'Idempotency-Key': randomUUID() };
        const body = { name: n3, family: OPENING };
        const a = await post('B08M-G-126', 'idem_first', body, 'first create 201', key);
        const b = await post('B08M-G-126', 'idem_replay', body, 'replay equals the first (same id)', key);
        expect.soft(a.res.status()).toBe(201);
        expect.soft(b.res.status()).toBe(a.res.status());
        expect.soft(asJson(b.body).id).toBe(asJson(a.body).id);
        expect.soft((await readDatasets(admin)).filter((d) => d.name === n3)).toHaveLength(1);
      });
      await test.step('[B08M-G-127] same Idempotency-Key, different body -> 422 IDEMPOTENCY_KEY_REUSED', async () => {
        const key = { 'Idempotency-Key': randomUUID() };
        // a 409 is not stored (routing.py:276): the setup must succeed (201) with a NEW name so the key is stored with this body
        const setup = await post('B08M-G-127', 'idem_setup', { name: name(4), family: OPENING }, 'setup: first use of the key with a NEW name (201, key stored)', key);
        expect.soft(setup.res.status(), 'setup creates a dataset and stores the key').toBe(201);
        const sent = await post('B08M-G-127', 'idem_reused', { name: `${n3}-other`, family: OPENING }, '422 IDEMPOTENCY_KEY_REUSED', key);
        expectError(sent, 422, 'IDEMPOTENCY_KEY_REUSED');
      });
      await test.step('[B08M-G-105] limit=1 then cursor: strictly after', async () => {
        const all = await readDatasets(admin);
        const p1 = await call(admin, 'B08M-G-105', 'page1', 'GET', `${ML}/datasets?limit=1`, undefined, ['page 1: one item + nextCursor']);
        expect(items(p1.body)).toHaveLength(1);
        const cursor = asJson(p1.body).nextCursor;
        expect(typeof cursor, 'nextCursor on page 1').toBe('string');
        const p2 = await call(admin, 'B08M-G-105', 'page2', 'GET', `${ML}/datasets?limit=1&cursor=${encodeURIComponent(String(cursor))}`, undefined, ['page 2: first item is the 2nd newest']);
        expect.soft(items(p1.body)[0]?.id).toBe(all[0]?.id);
        expect.soft(items(p2.body)[0]?.id).toBe(all[1]?.id);
      });
      await test.step('[B08M-G-113] versions of a fresh dataset -> 200 {items:[]}', async () => {
        const sent = await call(admin, 'B08M-G-113', 'fresh_versions', 'GET', `${ML}/datasets/${first}/versions`, undefined, ['200 {items: []}, no nextCursor']);
        expect(sent.res.status()).toBe(200);
        expect.soft(asJson(sent.body).items).toEqual([]);
        expect.soft(asJson(sent.body)).not.toHaveProperty('nextCursor');
      });
    } finally {
      await admin.dispose();
    }
  });
});

async function readDatasets(api: Awaited<ReturnType<typeof adminApi>>): Promise<Json[]> {
  const res = await api.get(`${ML}/datasets?limit=200`);
  expect(res.status(), 'GET datasets').toBe(200);
  return items(await res.json());
}
